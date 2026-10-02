import copy
import logging
import re
from typing import Optional
import uvicorn.config
from uvicorn.logging import AccessFormatter

# Regex matching sensitive query parameters: token, access_token, refresh_token, password, secret, api_key, etc.
QUERY_CREDENTIAL_REGEX = re.compile(
    r'([?&](?:token|access_token|refresh_token|auth_token|auth|jwt|password|passwd|secret|api_key|apikey|x-worker-key|worker_key)=)([^&\s"\'\`]+)',
    re.IGNORECASE
)

# Regex matching Authorization / Bearer tokens in headers or log lines
AUTH_HEADER_REGEX = re.compile(
    r'((?:authorization["\']?\s*:\s*["\']?(?:Bearer\s+)?|Bearer\s+))([^"\'\s,]+)',
    re.IGNORECASE
)

# Regex matching internal worker keys (headers or parameters)
WORKER_KEY_REGEX = re.compile(
    r'((?:x-worker-key|worker_key)["\']?\s*[:=]\s*["\']?)([^"\'\s,]+)',
    re.IGNORECASE
)

# Regex matching passwords or secrets in key-value formats
PASSWORD_REGEX = re.compile(
    r'((?:password|passwd|secret)["\']?\s*[:=]\s*["\']?)([^"\'\s,]+)',
    re.IGNORECASE
)

# Regex matching base64 raw image payloads
IMAGE_DATA_REGEX = re.compile(
    r'(data:image\/[a-zA-Z0-9.+_-]+;base64,)([A-Za-z0-9+/=]{20,})',
    re.IGNORECASE
)

# Regex matching raw JWT structure: eyJ... . eyJ... . ...
RAW_JWT_REGEX = re.compile(
    r'\b(eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+)\b'
)


def redact_credentials(text: str) -> str:
    """
    Sanitizes authentication secrets from text, query strings, headers, and logs.
    Replaces sensitive credentials with '[REDACTED]'.
    """
    if not text or not isinstance(text, str):
        return text
    text = QUERY_CREDENTIAL_REGEX.sub(r'\g<1>[REDACTED]', text)
    text = AUTH_HEADER_REGEX.sub(r'\g<1>[REDACTED]', text)
    text = WORKER_KEY_REGEX.sub(r'\g<1>[REDACTED]', text)
    text = PASSWORD_REGEX.sub(r'\g<1>[REDACTED]', text)
    text = IMAGE_DATA_REGEX.sub(r'\g<1>[REDACTED]', text)
    text = RAW_JWT_REGEX.sub('[REDACTED]', text)
    return text


class CredentialRedactionFilter(logging.Filter):
    """
    Centralized logging filter that sanitizes credentials from:
    1. Uvicorn access log arguments (tuple: client_addr, method, full_path, http_version, status_code)
    2. Any standard log record message (record.msg)
    3. Colorized formatter attributes, formatted messages, and tracebacks
    """
    def filter(self, record: logging.LogRecord) -> bool:
        # Sanitize record.args (where Uvicorn stores request_line components)
        if record.args and isinstance(record.args, tuple):
            record.args = tuple(redact_credentials(a) if isinstance(a, str) else a for a in record.args)
        elif record.args and isinstance(record.args, list):
            record.args = [redact_credentials(a) if isinstance(a, str) else a for a in record.args]
        elif record.args and isinstance(record.args, dict):
            record.args = {k: redact_credentials(v) if isinstance(v, str) else v for k, v in record.args.items()}

        # Sanitize record.msg
        if isinstance(record.msg, str):
            record.msg = redact_credentials(record.msg)

        # Sanitize color_message (used by Uvicorn ColourizedFormatter)
        if hasattr(record, "color_message") and isinstance(record.color_message, str):
            record.color_message = redact_credentials(record.color_message)

        # Sanitize message attribute if already computed
        if hasattr(record, "message") and isinstance(record.message, str):
            record.message = redact_credentials(record.message)

        # Sanitize exception traceback text if already formatted
        if hasattr(record, "exc_text") and isinstance(record.exc_text, str):
            record.exc_text = redact_credentials(record.exc_text)

        # Sanitize stack_info if present
        if hasattr(record, "stack_info") and isinstance(record.stack_info, str):
            record.stack_info = redact_credentials(record.stack_info)

        return True


class RedactedAccessFormatter(AccessFormatter):
    """
    Production Uvicorn AccessFormatter subclass that ensures the request_line
    argument (path + query string) is redacted before output formatting.
    """
    def formatMessage(self, record: logging.LogRecord) -> str:
        if record.args and isinstance(record.args, tuple):
            record.args = tuple(redact_credentials(a) if isinstance(a, str) else a for a in record.args)
        return super().formatMessage(record)


def get_redacted_uvicorn_log_config() -> dict:
    """
    Returns an updated Uvicorn LOGGING_CONFIG injecting RedactedAccessFormatter
    and CredentialRedactionFilter for zero-leak access logging across stdout/stderr.
    """
    cfg = copy.deepcopy(uvicorn.config.LOGGING_CONFIG)
    cfg["formatters"]["access"]["()"] = "backend.app.core.logging_sanitizer.RedactedAccessFormatter"
    cfg["filters"] = {
        "credential_redaction": {
            "()": "backend.app.core.logging_sanitizer.CredentialRedactionFilter"
        }
    }
    if "handlers" in cfg:
        if "access" in cfg["handlers"]:
            cfg["handlers"]["access"]["filters"] = ["credential_redaction"]
        if "default" in cfg["handlers"]:
            cfg["handlers"]["default"]["filters"] = ["credential_redaction"]
    return cfg


def install_credential_redaction_filter():
    """
    Programmatically attaches CredentialRedactionFilter and RedactedAccessFormatter
    to all active Uvicorn and root loggers/handlers.
    Safe to call multiple times (idempotent).
    """
    filter_instance = CredentialRedactionFilter()

    # Target key access and root loggers
    target_loggers = [
        logging.getLogger("uvicorn.access"),
        logging.getLogger("uvicorn"),
        logging.getLogger("uvicorn.error"),
        logging.getLogger("backend"),
        logging.getLogger()  # root logger
    ]

    for log in target_loggers:
        if not any(isinstance(f, CredentialRedactionFilter) for f in log.filters):
            log.addFilter(filter_instance)
        for h in log.handlers:
            if not any(isinstance(f, CredentialRedactionFilter) for f in h.filters):
                h.addFilter(filter_instance)
            # If handler uses AccessFormatter, upgrade to RedactedAccessFormatter
            if isinstance(h.formatter, AccessFormatter) and not isinstance(h.formatter, RedactedAccessFormatter):
                h.setFormatter(RedactedAccessFormatter(fmt=getattr(h.formatter, "_fmt", None), use_colors=h.formatter.use_colors))

    # Also attach to any active loggers in loggerDict
    for _, log_obj in list(logging.Logger.manager.loggerDict.items()):
        if isinstance(log_obj, logging.Logger):
            if not any(isinstance(f, CredentialRedactionFilter) for f in log_obj.filters):
                log_obj.addFilter(filter_instance)
            for h in log_obj.handlers:
                if not any(isinstance(f, CredentialRedactionFilter) for f in h.filters):
                    h.addFilter(filter_instance)
