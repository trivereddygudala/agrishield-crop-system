import re
import urllib.parse
from fastapi import Request, Response, status
from starlette.middleware.base import BaseHTTPMiddleware
from backend.app.core.config import settings
from backend.app.core.security_walls import (
    is_ip_jailed,
    is_honeypot_path,
    jail_ip,
    inspect_for_threats,
    record_malicious_strike
)

def get_client_ip(request: Request) -> str:
    """Extract real client IP considering forward proxies."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        client_ip = get_client_ip(request)

        # ── WALL 2: Adaptive IP Jail Enforcement ───────────────────
        is_jailed, reason, remaining = is_ip_jailed(client_ip)
        if is_jailed:
            return Response(
                content=f'{{"detail": "Access Denied: Your IP has been temporarily restricted by the Security Firewall. Reason: {reason}. Remaining: {int(remaining or 0)}s."}}',
                status_code=status.HTTP_403_FORBIDDEN,
                media_type="application/json"
            )

        # ── WALL 1: Honeypot Decoy Trap Check ──────────────────────
        if is_honeypot_path(request.url.path):
            await jail_ip(client_ip, reason=f"Honeypot Decoy Hit: {request.url.path}", duration_hours=24.0)
            return Response(
                content='{"detail": "Access Denied: Malicious probe activity intercepted."}',
                status_code=status.HTTP_403_FORBIDDEN,
                media_type="application/json"
            )

        # ── Payload Size Protection ───────────────────────────────
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                length = int(content_length)
                max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
                if length > max_bytes:
                    return Response(
                        content='{"detail": "Payload Too Large. Maximum allowed size is 15MB."}',
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        media_type="application/json"
                    )
            except ValueError:
                pass

        # ── WALL 3: Deep Request Inspection WAF ───────────────────
        raw_query = str(request.query_params)
        decoded_query = urllib.parse.unquote(raw_query) if raw_query else ""
        decoded_path = urllib.parse.unquote(request.url.path)

        threat = inspect_for_threats(decoded_query) or inspect_for_threats(decoded_path)
        if threat:
            await record_malicious_strike(client_ip, threat)
            return Response(
                content=f'{{"detail": "Security Alert: Malicious request pattern blocked ({threat})."}}',
                status_code=status.HTTP_400_BAD_REQUEST,
                media_type="application/json"
            )

        response = await call_next(request)

        # ── Standard Enterprise Hardening Headers ─────────────────
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"

        if "Server" in response.headers:
            del response.headers["Server"]
        if "x-powered-by" in response.headers:
            del response.headers["x-powered-by"]

        if settings.ENV.lower() == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
            response.headers["Content-Security-Policy"] = "default-src 'self'; img-src 'self' data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline';"
            response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
            response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
            response.headers["Cross-Origin-Resource-Policy"] = "same-site"
        else:
            response.headers["Content-Security-Policy"] = "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: http: https: ws:;"
            response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"

        return response
