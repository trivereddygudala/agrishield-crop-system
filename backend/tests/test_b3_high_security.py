import pytest
import io
from httpx import ASGITransport, AsyncClient
from bson import ObjectId
from PIL import Image

from backend.app.main import app
from backend.app.db.mongodb import db_instance, get_database
from backend.app.core.config import settings
from backend.app.core.security import create_access_token
from backend.tests.mock_db import MockDatabase
import backend.app.routers.provider.equipment as eq_module

mock_db = MockDatabase()
db_instance.db = mock_db

async def override_get_database():
    return mock_db

app.dependency_overrides[get_database] = override_get_database

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.fixture(autouse=True)
async def reset_test_state():
    db_instance.db = mock_db
    app.dependency_overrides[get_database] = override_get_database
    mock_db.users.records = []
    mock_db.devices.records = []
    mock_db.equipment_bookings.records = []
    mock_db.equipment_catalog.records = []
    mock_db.equipment_chat_messages.records = []
    mock_db.predictions.records = []
    mock_db.notifications.records = []
    mock_db.idempotency_records.records = []
    eq_module._in_memory_bookings = []
    eq_module._in_memory_catalog = []
    eq_module._in_memory_chat_threads = {}
    yield
    mock_db.users.records = []
    mock_db.devices.records = []
    mock_db.equipment_bookings.records = []
    mock_db.equipment_catalog.records = []
    mock_db.equipment_chat_messages.records = []
    mock_db.predictions.records = []
    mock_db.notifications.records = []
    mock_db.idempotency_records.records = []
    eq_module._in_memory_bookings = []
    eq_module._in_memory_catalog = []
    eq_module._in_memory_chat_threads = {}

async def create_user(name: str, email: str, role: str, phone: str = "9876543210"):
    user_id = ObjectId()
    user_doc = {
        "_id": user_id,
        "id": str(user_id),
        "name": name,
        "email": email,
        "role": role,
        "phone": phone,
        "mobile": phone,
    }
    mock_db.users.records.append(user_doc)
    token = create_access_token(subject=str(user_id), role=role)
    return str(user_id), token

def generate_valid_jpeg():
    buf = io.BytesIO()
    img = Image.new("RGB", (64, 64), color=(73, 109, 137))
    img.save(buf, format="JPEG")
    return buf.getvalue()


# ══════════════════════════════════════════════════════════════════════════════
# H-1 & H-2 TESTS: Booking Chat Identity & Authorship IDOR
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.anyio
async def test_h1_chat_sender_identity_enforced_from_current_user():
    """H-1: Farmer attempting to spoof provider/admin sender identity must be overridden."""
    farmer_id, farmer_token = await create_user("Ramu Farmer", "ramu@farmer.com", "farmer")
    prov_id, prov_token = await create_user("Kiran Provider", "kiran@prov.com", "equipment_provider")

    booking_id = "BK-TEST-H1"
    booking_doc = {
        "_id": ObjectId(),
        "id": booking_id,
        "bookingId": booking_id,
        "userId": farmer_id,
        "user_id": farmer_id,
        "providerId": prov_id,
        "provider_id": prov_id,
        "status": "confirmed"
    }
    mock_db.equipment_bookings.records.append(booking_doc)
    eq_module._in_memory_bookings.append(booking_doc)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Farmer sends message attempting to spoof role and name as Provider
        res = await ac.post(
            f"/api/v1/equipment/bookings/{booking_id}/messages",
            headers={"Authorization": f"Bearer {farmer_token}"},
            json={
                "id": "msg_spoof_1",
                "text": "Hello I am provider discounting price",
                "sender": "provider",
                "senderName": "Kiran Provider"
            }
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        msg = data["message"]

        # Sender MUST be farmer, senderName MUST be Ramu Farmer, and sender_id MUST be farmer_id
        assert msg["sender"] == "farmer"
        assert msg["senderName"] == "Ramu Farmer"
        assert msg["sender_id"] == farmer_id


@pytest.mark.anyio
async def test_h2_counterparty_cannot_delete_other_user_message():
    """H-2: Farmer participant cannot delete Provider's chat message in the same booking."""
    farmer_id, farmer_token = await create_user("Ramu Farmer", "ramu@farmer.com", "farmer")
    prov_id, prov_token = await create_user("Kiran Provider", "kiran@prov.com", "equipment_provider")

    booking_id = "BK-TEST-H2-DEL"
    booking_doc = {
        "_id": ObjectId(),
        "id": booking_id,
        "userId": farmer_id,
        "providerId": prov_id,
        "status": "confirmed"
    }
    mock_db.equipment_bookings.records.append(booking_doc)
    eq_module._in_memory_bookings.append(booking_doc)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Provider creates a message
        p_res = await ac.post(
            f"/api/v1/equipment/bookings/{booking_id}/messages",
            headers={"Authorization": f"Bearer {prov_token}"},
            json={"id": "msg_prov_del", "text": "Provider contractual statement"}
        )
        assert p_res.status_code == 200

        # Farmer attempts to delete Provider's message
        del_res = await ac.delete(
            f"/api/v1/equipment/bookings/{booking_id}/messages/msg_prov_del",
            headers={"Authorization": f"Bearer {farmer_token}"}
        )
        assert del_res.status_code == 403
        assert "only delete your own messages" in del_res.json()["detail"]


@pytest.mark.anyio
async def test_h2_counterparty_cannot_edit_other_user_message():
    """H-2: Provider participant cannot edit Farmer's chat message in the same booking."""
    farmer_id, farmer_token = await create_user("Ramu Farmer", "ramu@farmer.com", "farmer")
    prov_id, prov_token = await create_user("Kiran Provider", "kiran@prov.com", "equipment_provider")

    booking_id = "BK-TEST-H2-EDIT"
    booking_doc = {
        "_id": ObjectId(),
        "id": booking_id,
        "userId": farmer_id,
        "providerId": prov_id,
        "status": "confirmed"
    }
    mock_db.equipment_bookings.records.append(booking_doc)
    eq_module._in_memory_bookings.append(booking_doc)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Farmer posts message
        f_res = await ac.post(
            f"/api/v1/equipment/bookings/{booking_id}/messages",
            headers={"Authorization": f"Bearer {farmer_token}"},
            json={"id": "msg_farmer_edit", "text": "Original farmer agreement"}
        )
        assert f_res.status_code == 200

        # Provider attempts to edit Farmer's message
        edit_res = await ac.patch(
            f"/api/v1/equipment/bookings/{booking_id}/messages/msg_farmer_edit",
            headers={"Authorization": f"Bearer {prov_token}"},
            json={"text": "Forged alteration by provider"}
        )
        assert edit_res.status_code == 403
        assert "only edit your own messages" in edit_res.json()["detail"]


@pytest.mark.anyio
async def test_h2_author_can_edit_and_delete_own_message():
    """H-2: Author can successfully edit and delete their own message."""
    farmer_id, farmer_token = await create_user("Ramu Farmer", "ramu@farmer.com", "farmer")
    prov_id, prov_token = await create_user("Kiran Provider", "kiran@prov.com", "equipment_provider")

    booking_id = "BK-TEST-H2-OWN"
    booking_doc = {
        "_id": ObjectId(),
        "id": booking_id,
        "userId": farmer_id,
        "providerId": prov_id,
        "status": "confirmed"
    }
    mock_db.equipment_bookings.records.append(booking_doc)
    eq_module._in_memory_bookings.append(booking_doc)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Farmer creates message
        post_res = await ac.post(
            f"/api/v1/equipment/bookings/{booking_id}/messages",
            headers={"Authorization": f"Bearer {farmer_token}"},
            json={"id": "msg_own_1", "text": "Initial text"}
        )
        assert post_res.status_code == 200

        # Farmer edits own message
        edit_res = await ac.patch(
            f"/api/v1/equipment/bookings/{booking_id}/messages/msg_own_1",
            headers={"Authorization": f"Bearer {farmer_token}"},
            json={"text": "Updated text by author"}
        )
        assert edit_res.status_code == 200
        assert edit_res.json()["message"]["text"] == "Updated text by author"

        # Farmer deletes own message
        del_res = await ac.delete(
            f"/api/v1/equipment/bookings/{booking_id}/messages/msg_own_1",
            headers={"Authorization": f"Bearer {farmer_token}"}
        )
        assert del_res.status_code == 200
        assert del_res.json()["deleted_message_id"] == "msg_own_1"


@pytest.mark.anyio
async def test_h2_admin_can_manage_any_message():
    """H-2: Admin user can moderate/edit/delete any message in any thread."""
    farmer_id, _ = await create_user("Ramu Farmer", "ramu@farmer.com", "farmer")
    prov_id, prov_token = await create_user("Kiran Provider", "kiran@prov.com", "equipment_provider")
    admin_id, admin_token = await create_user("Super Admin", "admin@agrishield.com", "admin")

    booking_id = "BK-TEST-H2-ADMIN"
    booking_doc = {
        "_id": ObjectId(),
        "id": booking_id,
        "userId": farmer_id,
        "providerId": prov_id,
        "status": "confirmed"
    }
    mock_db.equipment_bookings.records.append(booking_doc)
    eq_module._in_memory_bookings.append(booking_doc)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Provider creates message
        await ac.post(
            f"/api/v1/equipment/bookings/{booking_id}/messages",
            headers={"Authorization": f"Bearer {prov_token}"},
            json={"id": "msg_for_admin", "text": "Content to moderate"}
        )

        # Admin edits message
        edit_res = await ac.patch(
            f"/api/v1/equipment/bookings/{booking_id}/messages/msg_for_admin",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"text": "[Content moderated by administrator]"}
        )
        assert edit_res.status_code == 200

        # Admin deletes message
        del_res = await ac.delete(
            f"/api/v1/equipment/bookings/{booking_id}/messages/msg_for_admin",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert del_res.status_code == 200


# ══════════════════════════════════════════════════════════════════════════════
# H-3 TESTS: Internal Worker Inference Endpoint
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.anyio
async def test_h3_worker_key_cannot_be_used_to_forge_jwt_authentication():
    """H-3: Verify that X-Worker-Key (derived via HMAC-SHA256) cannot be used to forge JWT access tokens."""
    from backend.app.core.config import get_worker_internal_secret
    from backend.app.core.security import decode_access_token
    from jose import jwt

    worker_key = get_worker_internal_secret()

    # 1. Ensure worker key is cryptographically separated and distinct from JWT_SECRET_KEY
    assert worker_key != settings.JWT_SECRET_KEY

    # 2. Token signed with worker_key must fail verification against JWT_SECRET_KEY
    forged_token = jwt.encode(
        {"sub": "attacker_fake_admin", "role": "admin", "exp": 9999999999},
        worker_key,
        algorithm=settings.JWT_ALGORITHM
    )

    with pytest.raises(jwt.JWTError):
        jwt.decode(forged_token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])

    decoded = await decode_access_token(forged_token)
    assert decoded is None


    # 3. Passing raw JWT_SECRET_KEY directly as X-Worker-Key must be rejected with 401
    transport = ASGITransport(app=app)
    jpeg_bytes = generate_valid_jpeg()
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/worker/predict",
            headers={"X-Worker-Key": settings.JWT_SECRET_KEY},
            files={"file": ("leaf.jpg", jpeg_bytes, "image/jpeg")}
        )
        assert res.status_code == 401


@pytest.mark.anyio
async def test_h3_anonymous_worker_predict_rejected_with_401():
    """H-3: Unauthenticated external POST to /api/worker/predict must be rejected with 401."""
    transport = ASGITransport(app=app)
    jpeg_bytes = generate_valid_jpeg()

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/worker/predict",
            files={"file": ("leaf.jpg", jpeg_bytes, "image/jpeg")}
        )
        assert res.status_code == 401
        assert "Internal worker endpoint" in res.json()["detail"]


@pytest.mark.anyio
async def test_h3_legitimate_internal_worker_predict_accepted():
    """H-3: Internal worker request presenting valid X-Worker-Key must authenticate successfully."""
    from backend.app.core.config import get_worker_internal_secret
    transport = ASGITransport(app=app)
    jpeg_bytes = generate_valid_jpeg()
    worker_key = get_worker_internal_secret()

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/worker/predict",
            headers={"X-Worker-Key": worker_key},
            files={"file": ("leaf.jpg", jpeg_bytes, "image/jpeg")}
        )
        # Should authenticate and run inference (or return success/result structure)
        assert res.status_code == 200
        data = res.json()
        assert "success" in data


@pytest.mark.anyio
async def test_h3_worker_predict_invalid_image_rejected():
    """H-3: Non-image payload sent to /worker/predict must be rejected by upload validator."""
    from backend.app.core.config import get_worker_internal_secret
    transport = ASGITransport(app=app)
    fake_content = b"Not a real image file content for testing"
    worker_key = get_worker_internal_secret()

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/worker/predict",
            headers={"X-Worker-Key": worker_key},
            files={"file": ("bad_leaf.jpg", fake_content, "image/jpeg")}
        )
        assert res.status_code == 400
        assert "magic byte" in res.json()["detail"].lower() or "invalid image" in res.json()["detail"].lower()



# ══════════════════════════════════════════════════════════════════════════════
# H-4 TESTS: IoT Command & Poll Security
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.anyio
async def test_h4_anonymous_command_rejected_with_401():
    """H-4: Anonymous POST to /devices/command must be rejected with 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Test both /api/v1/devices/command and /devices/command alias
        res1 = await ac.post("/api/v1/devices/command", json={"device_id": "ESP32_01", "command": "reboot"})
        assert res1.status_code == 401

        res2 = await ac.post("/devices/command", json={"device_id": "ESP32_01", "command": "reboot"})
        assert res2.status_code == 401


@pytest.mark.anyio
async def test_h4_unauthorized_role_command_rejected_with_403():
    """H-4: Equipment provider role cannot enqueue device commands."""
    prov_id, prov_token = await create_user("Kiran Prov", "kiran_p@agrishield.com", "equipment_provider")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/devices/command",
            headers={"Authorization": f"Bearer {prov_token}"},
            json={"device_id": "ESP32_01", "command": "reboot"}
        )
        assert res.status_code == 403
        assert "restricted to farmers and administrators" in res.json()["detail"]


@pytest.mark.anyio
async def test_h4_farmer_cannot_command_unowned_device():
    """H-4: Farmer A cannot enqueue commands for Farmer B's IoT device."""
    farmer_a_id, farmer_a_token = await create_user("Farmer A", "farmer_a@test.com", "farmer")
    farmer_b_id, farmer_b_token = await create_user("Farmer B", "farmer_b@test.com", "farmer")

    device_doc = {
        "_id": ObjectId(),
        "device_id": "ESP32_FARMER_B",
        "user_id": farmer_b_id,
        "pending_commands": []
    }
    mock_db.devices.records.append(device_doc)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/devices/command",
            headers={"Authorization": f"Bearer {farmer_a_token}"},
            json={"device_id": "ESP32_FARMER_B", "command": "open_valve"}
        )
        assert res.status_code == 403
        assert "belongs to another farmer" in res.json()["detail"]


@pytest.mark.anyio
async def test_h4_legitimate_owner_can_enqueue_device_command():
    """H-4: Legitimate owner farmer can successfully enqueue commands for their device."""
    farmer_id, farmer_token = await create_user("Owner Farmer", "owner@test.com", "farmer")

    device_doc = {
        "_id": ObjectId(),
        "device_id": "ESP32_MY_NODE",
        "user_id": farmer_id,
        "pending_commands": []
    }
    mock_db.devices.records.append(device_doc)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/devices/command",
            headers={"Authorization": f"Bearer {farmer_token}"},
            json={"device_id": "ESP32_MY_NODE", "command": "irrigation_start"}
        )
        assert res.status_code == 200
        assert res.json()["status"] == "success"

        # Check command exists in device
        dev = await mock_db.devices.find_one({"device_id": "ESP32_MY_NODE"})
        assert "irrigation_start" in dev["pending_commands"]


@pytest.mark.anyio
async def test_h4_admin_can_command_any_device():
    """H-4: Admin user can enqueue commands for any device."""
    admin_id, admin_token = await create_user("Admin User", "admin_iot@agrishield.com", "admin")

    device_doc = {
        "_id": ObjectId(),
        "device_id": "ESP32_ANY_NODE",
        "user_id": "some_other_id",
        "pending_commands": []
    }
    mock_db.devices.records.append(device_doc)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/devices/command",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"device_id": "ESP32_ANY_NODE", "command": "system_calibrate"}
        )
        assert res.status_code == 200
        assert res.json()["status"] == "success"


@pytest.mark.anyio
async def test_h4_anonymous_poll_commands_rejected_and_queue_not_drained():
    """H-4: Anonymous GET to /devices/poll-commands/{device_id} must be 401 and must NOT drain pending commands."""
    device_doc = {
        "_id": ObjectId(),
        "device_id": "ESP32_FIELD_NODE",
        "pending_commands": ["pulse_fan_high", "read_ph"]
    }
    mock_db.devices.records.append(device_doc)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Anonymous request
        res = await ac.get("/devices/poll-commands/ESP32_FIELD_NODE")
        assert res.status_code == 401

        # Check pending_commands in DB was NOT drained
        dev = await mock_db.devices.find_one({"device_id": "ESP32_FIELD_NODE"})
        assert len(dev["pending_commands"]) == 2
        assert dev["pending_commands"][0] == "pulse_fan_high"


@pytest.mark.anyio
async def test_h4_invalid_key_poll_commands_rejected_and_queue_not_drained():
    """H-4: GET with invalid API key must be 401 and must NOT drain pending commands."""
    device_doc = {
        "_id": ObjectId(),
        "device_id": "ESP32_FIELD_NODE_2",
        "pending_commands": ["pulse_fan_high"]
    }
    mock_db.devices.records.append(device_doc)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(
            "/api/v1/devices/poll-commands/ESP32_FIELD_NODE_2",
            headers={"X-IoT-API-Key": "completely_wrong_key"}
        )
        assert res.status_code == 401

        dev = await mock_db.devices.find_one({"device_id": "ESP32_FIELD_NODE_2"})
        assert len(dev["pending_commands"]) == 1


@pytest.mark.anyio
async def test_h4_authenticated_poll_commands_success_and_drains_queue():
    """H-4: Genuine device presenting valid X-IoT-API-Key polls and pops commands."""
    device_doc = {
        "_id": ObjectId(),
        "device_id": "ESP32_FIELD_NODE_3",
        "pending_commands": ["target_actuation_cmd"]
    }
    mock_db.devices.records.append(device_doc)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Authenticated poll
        res = await ac.get(
            "/devices/poll-commands/ESP32_FIELD_NODE_3",
            headers={"X-IoT-API-Key": settings.IOT_API_KEY}
        )
        assert res.status_code == 200
        assert res.json()["command"] == "target_actuation_cmd"

        # Subsequent poll should have command == None because queue was popped
        res2 = await ac.get(
            "/devices/poll-commands/ESP32_FIELD_NODE_3",
            headers={"X-IoT-API-Key": settings.IOT_API_KEY}
        )
        assert res2.status_code == 200
        assert res2.json()["command"] is None


@pytest.mark.anyio
async def test_h4_production_default_iot_key_rejected(monkeypatch):
    """H-4: Production must NOT accept the publicly known default key 'crop_iot_secure_key_2026'."""
    device_doc = {
        "_id": ObjectId(),
        "device_id": "ESP32_PROD_NODE_DEF",
        "pending_commands": ["irrigate_zone_1"]
    }
    mock_db.devices.records.append(device_doc)

    # Force production mode
    monkeypatch.setattr(settings, "ENV", "production")
    monkeypatch.setattr(settings, "IOT_SECURITY_MODE", "production")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Polling with default key in production must be rejected with 401
        res = await ac.get(
            "/devices/poll-commands/ESP32_PROD_NODE_DEF",
            headers={"X-IoT-API-Key": "crop_iot_secure_key_2026"}
        )
        assert res.status_code == 401

        # Verify command queue was NOT drained
        dev = await mock_db.devices.find_one({"device_id": "ESP32_PROD_NODE_DEF"})
        assert len(dev["pending_commands"]) == 1
        assert dev["pending_commands"][0] == "irrigate_zone_1"


@pytest.mark.anyio
async def test_h4_valid_configured_iot_key_polling_succeeds(monkeypatch):
    """H-4: When an explicit secret key is configured in production, polling succeeds and pops queue."""
    device_doc = {
        "_id": ObjectId(),
        "device_id": "ESP32_PROD_CONFIGURED_NODE",
        "pending_commands": ["irrigate_zone_2"]
    }
    mock_db.devices.records.append(device_doc)

    # Set explicit non-default production key
    custom_prod_key = "production_super_secret_esp32_device_key_999"
    monkeypatch.setattr(settings, "ENV", "production")
    monkeypatch.setattr(settings, "IOT_SECURITY_MODE", "production")
    monkeypatch.setattr(settings, "IOT_API_KEY", custom_prod_key)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(
            "/devices/poll-commands/ESP32_PROD_CONFIGURED_NODE",
            headers={"X-IoT-API-Key": custom_prod_key}
        )
        assert res.status_code == 200
        assert res.json()["command"] == "irrigate_zone_2"

        # Verify queue was drained
        dev = await mock_db.devices.find_one({"device_id": "ESP32_PROD_CONFIGURED_NODE"})
        assert len(dev["pending_commands"]) == 0

