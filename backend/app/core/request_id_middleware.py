import re
import uuid
import logging
from contextvars import ContextVar
from typing import Optional
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse

logger = logging.getLogger("backend.request_id")

# Context variable for accessing request ID across async call stacks
_request_id_ctx_var: ContextVar[str] = ContextVar("request_id", default="")

# Safe pattern: Alphanumeric, dash, underscore, 4 to 64 chars, no newlines/control chars
SAFE_REQUEST_ID_REGEX = re.compile(r"^[a-zA-Z0-9_-]{4,64}$")
MAX_REQUEST_ID_LEN = 64

def sanitize_request_id(candidate: Optional[str]) -> Optional[str]:
    """
    Validates and sanitizes an incoming X-Request-ID header value.
    Rejects malformed, dangerous (newline/control chars), or oversized strings.
    """
    if not candidate or not isinstance(candidate, str):
        return None
    cleaned = candidate.strip()
    if len(cleaned) < 4 or len(cleaned) > MAX_REQUEST_ID_LEN:
        return None
    if not SAFE_REQUEST_ID_REGEX.match(cleaned):
        return None
    return cleaned

def generate_request_id() -> str:
    """Generates a compact, unique UUID4-based request identifier."""
    return f"req_{uuid.uuid4().hex[:16]}"

def get_current_request_id() -> str:
    """Returns the current request ID from contextvar, or empty string if unset."""
    return _request_id_ctx_var.get() or ""

class RequestIdMiddleware(BaseHTTPMiddleware):
    """
    Lightweight FastAPI/Starlette middleware for request correlation.
    1. Ingests or generates a sanitized X-Request-ID.
    2. Attaches request_id to request.state and async contextvar.
    3. Guarantees X-Request-ID header in every HTTP response.
    4. Catches unhandled 500 exceptions, returning safe structured error JSON with request_id.
    """
    async def dispatch(self, request: Request, call_next) -> Response:
        incoming_id = request.headers.get("X-Request-ID")
        sanitized_id = sanitize_request_id(incoming_id)
        request_id = sanitized_id or generate_request_id()

        # Attach to request state and contextvar
        request.state.request_id = request_id
        token = _request_id_ctx_var.set(request_id)

        try:
            response: Response = await call_next(request)
            response.headers["X-Request-ID"] = request_id
            return response
        except Exception as exc:
            logger.error(
                f"[INTERNAL ERROR] [{request_id}] {request.method} {request.url.path} - {exc.__class__.__name__}: {str(exc)}",
                exc_info=True
            )
            return JSONResponse(
                status_code=500,
                headers={"X-Request-ID": request_id},
                content={
                    "status": "error",
                    "code": "INTERNAL_SERVER_ERROR",
                    "detail": "An unexpected internal server error occurred.",
                    "request_id": request_id
                }
            )
        finally:
            _request_id_ctx_var.reset(token)
