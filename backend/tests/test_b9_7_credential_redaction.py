"""
B9.7 Production Security Hotfix Tests: Credential Redaction from Access Logs
============================================================================
Validates:
1. WebSocket URL with fake JWT in access log representation is sanitized to token=[REDACTED].
2. WebSocket URL in uvicorn.error (used by Uvicorn for WS handshake logging) is sanitized.
3. Fake JWT never appears anywhere in the formatted access logs.
4. Ordinary HTTP requests retain paths and non-sensitive query parameters.
5. Other sensitive parameters (access_token, password, secret, Authorization, X-Worker-Key, raw image data) are sanitized.
6. Non-sensitive query parameters and path elements remain intact.
7. B9.7 Request-ID correlation behavior remains completely functional.
8. WebSocket authentication behavior is unchanged (valid JWT accepted, missing/invalid rejected).
9. Idempotent filter installation across multiple invocations.
"""

import io
import logging
import pytest
from httpx import ASGITransport, AsyncClient
from starlette.testclient import TestClient

from backend.app.main import app
from backend.app.core.security import create_access_token
from backend.app.core.logging_sanitizer import (
    redact_credentials,
    CredentialRedactionFilter,
    RedactedAccessFormatter,
    install_credential_redaction_filter
)


def test_1_websocket_access_log_redacts_jwt():
    """1. Verify WebSocket URL with fake JWT in uvicorn.access is sanitized to token=[REDACTED]."""
    fake_jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.FAKE_SECRET_PAYLOAD_ABC123.SIGNATURE_XYZ"
    ws_path = f"/api/v1/notifications/ws/6a6725de7c0ce1751b2d0c7d?token={fake_jwt}&client=react_spa"
    
    args = ("10.0.0.1:45678", "GET", ws_path, "1.1", 101)
    record = logging.LogRecord(
        name="uvicorn.access",
        level=logging.INFO,
        pathname="uvicorn/protocols/http/h11_impl.py",
        lineno=480,
        msg='%s - "%s %s HTTP/%s" %d',
        args=args,
        exc_info=None
    )

    filt = CredentialRedactionFilter()
    filt.filter(record)

    formatter = RedactedAccessFormatter(
        fmt='%(levelprefix)s %(client_addr)s - "%(request_line)s" %(status_code)s',
        use_colors=False
    )
    formatted = formatter.format(record)

    # Assert secret is absent and redacted token is present
    assert fake_jwt not in formatted
    assert "token=[REDACTED]" in formatted
    assert "client=react_spa" in formatted
    assert "10.0.0.1:45678" in formatted
    assert "101" in formatted


def test_2_websocket_error_logger_redacts_jwt():
    """2. Verify WebSocket handshake log in uvicorn.error (default handler) is sanitized."""
    fake_jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.FAKE_SECRET_PAYLOAD_ABC123.SIGNATURE_XYZ"
    ws_path = f"/api/v1/notifications/ws/user_99?token={fake_jwt}&client=react_spa"

    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    logger = logging.getLogger("uvicorn.error")
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

    install_credential_redaction_filter()

    logger.info('%s - "WebSocket %s" [accepted]', "127.0.0.1:54321", ws_path)
    output = stream.getvalue()
    logger.removeHandler(handler)

    assert fake_jwt not in output
    assert "token=[REDACTED]" in output
    assert "client=react_spa" in output
    assert "WebSocket" in output


def test_3_ordinary_http_logging_preserved():
    """3. Verify ordinary HTTP requests retain their exact paths and non-sensitive query parameters."""
    normal_path = "/api/v1/devices/status?category=soil&limit=25&active=true"
    args = ("192.168.1.50:52000", "GET", normal_path, "1.1", 200)
    record = logging.LogRecord(
        name="uvicorn.access",
        level=logging.INFO,
        pathname="uvicorn",
        lineno=10,
        msg='%s - "%s %s HTTP/%s" %d',
        args=args,
        exc_info=None
    )

    filt = CredentialRedactionFilter()
    filt.filter(record)

    formatter = RedactedAccessFormatter(
        fmt='%(levelprefix)s %(client_addr)s - "%(request_line)s" %(status_code)s',
        use_colors=False
    )
    formatted = formatter.format(record)

    assert "category=soil" in formatted
    assert "limit=25" in formatted
    assert "active=true" in formatted
    assert "/api/v1/devices/status" in formatted
    assert "200" in formatted


def test_4_other_sensitive_parameters_redacted():
    """4. Verify access_token, password, secret, api_key, Authorization header, X-Worker-Key, and images are sanitized."""
    test_cases = [
        ("?access_token=SECRET_ACCESS_TOKEN", "access_token=[REDACTED]"),
        ("&refresh_token=SECRET_REFRESH_TOKEN", "refresh_token=[REDACTED]"),
        ("?password=SuperSecretPassword123", "password=[REDACTED]"),
        ("?secret=MySecretKey99", "secret=[REDACTED]"),
        ("&api_key=API_KEY_CONFIDENTIAL", "api_key=[REDACTED]"),
        ("Authorization: Bearer SECRET_BEARER_JWT", "Authorization: Bearer [REDACTED]"),
        ("Bearer SECRET_STANDALONE_BEARER", "Bearer [REDACTED]"),
        ("X-Worker-Key: SECRET_CLUSTER_WORKER_KEY", "X-Worker-Key: [REDACTED]"),
        ('{"password": "MySecretPassword"}', '{"password": "[REDACTED]"}'),
        ("data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////", "data:image/jpeg;base64,[REDACTED]")
    ]

    for raw, expected in test_cases:
        redacted = redact_credentials(raw)
        assert expected in redacted, f"Failed for {raw} -> {redacted}"
        assert "SECRET" not in redacted
        assert "SuperSecret" not in redacted


@pytest.mark.anyio
async def test_5_b9_7_request_id_correlation_unaffected():
    """5. Verify B9.7 Request-ID correlation header and diagnostics remain intact."""
    test_req_id = "test-security-hotfix-req-001"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/health", headers={"X-Request-ID": test_req_id})
        assert resp.status_code == 200
        assert resp.headers.get("X-Request-ID") == test_req_id
        data = resp.json()
        assert "diagnostics" in data
        assert "database" in data["diagnostics"]


def test_6_websocket_authentication_behavior_intact():
    """6. Verify WebSocket authentication semantics are completely preserved while logging is safe."""
    client = TestClient(app)
    user_id = "60c72b2f9b1d8b5a5f8e2c1a"

    # Test 6a: Missing token -> rejected with 4001
    with pytest.raises(Exception):
        with client.websocket_connect(f"/api/v1/notifications/ws/{user_id}") as ws:
            pass

    # Test 6b: Invalid token -> rejected with 4001
    with pytest.raises(Exception):
        with client.websocket_connect(f"/api/v1/notifications/ws/{user_id}?token=INVALID_TOKEN") as ws:
            pass

    # Test 6c: Valid token for matching user -> authenticates and connects successfully
    valid_token = create_access_token(subject=user_id)
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    target_logger = logging.getLogger("uvicorn.error")
    target_logger.addHandler(handler)
    target_logger.setLevel(logging.INFO)
    install_credential_redaction_filter()

    try:
        with client.websocket_connect(f"/api/v1/notifications/ws/{user_id}?token={valid_token}&client=react_spa") as ws:
            # Echo ping/pong
            ws.send_text("ping")
            resp = ws.receive_json()
            assert resp.get("status") == "ping_ack"
            assert resp.get("type") == "pong"
    finally:
        target_logger.removeHandler(handler)

    # Verify that in any logs captured during this connection, valid_token never appeared!
    captured_logs = stream.getvalue()
    assert valid_token not in captured_logs
    if "token=" in captured_logs:
        assert "token=[REDACTED]" in captured_logs


def test_7_idempotent_filter_installation():
    """7. Verify install_credential_redaction_filter can be invoked safely multiple times without duplication."""
    install_credential_redaction_filter()
    install_credential_redaction_filter()
    
    access_logger = logging.getLogger("uvicorn.access")
    redaction_filters = [f for f in access_logger.filters if isinstance(f, CredentialRedactionFilter)]
    assert len(redaction_filters) == 1, "Duplicate filters installed on logger"
