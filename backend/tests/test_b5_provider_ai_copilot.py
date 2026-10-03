import pytest
from httpx import ASGITransport, AsyncClient
from bson import ObjectId
from unittest.mock import AsyncMock, patch

from backend.app.main import app
from backend.app.db.mongodb import db_instance, get_database
from backend.app.core.security import create_access_token
from backend.app.services.nvidia_service import nvidia_service
from backend.tests.mock_db import MockDatabase
import backend.app.routers.provider.equipment as eq_module

mock_db = MockDatabase()
db_instance.db = mock_db
db_instance.client = mock_db.client

async def override_get_database():
    return mock_db

app.dependency_overrides[get_database] = override_get_database

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.fixture(autouse=True)
def reset_db_state(monkeypatch):
    db_instance.db = mock_db
    db_instance.client = mock_db.client
    app.dependency_overrides[get_database] = override_get_database
    mock_db.users.records = []
    mock_db.equipment_catalog.records = []
    mock_db.farms.records = []
    mock_db.predictions.records = []
    mock_db.devices.records = []
    mock_db.iot_telemetry.records = []
    eq_module._in_memory_catalog = []
    eq_module._fleet_availability.clear()
    monkeypatch.setattr(eq_module, "_load_disk_catalog", lambda: list(eq_module._in_memory_catalog))
    monkeypatch.setattr(eq_module, "_save_disk_catalog", lambda: None)
    yield
    mock_db.users.records = []
    mock_db.equipment_catalog.records = []
    mock_db.farms.records = []
    mock_db.predictions.records = []
    mock_db.devices.records = []
    mock_db.iot_telemetry.records = []
    eq_module._in_memory_catalog = []
    eq_module._fleet_availability.clear()


async def create_test_user(name: str, email: str, role: str = "equipment_provider", phone: str = "9876543210"):
    user_id = ObjectId()
    user_doc = {
        "_id": user_id,
        "id": str(user_id),
        "name": name,
        "email": email,
        "role": role,
        "phone": phone,
        "mobile": phone,
        "provider_profile": {
            "business_name": f"{name} Services",
            "is_online": True
        }
    }
    mock_db.users.records.append(user_doc)
    token = create_access_token(subject=str(user_id), role=role)
    return str(user_id), token, phone


async def create_test_equipment(user_id: str, title: str, category: str = "tractor", phone: str = "9876543210", available: bool = True):
    eq_id = f"EQ-{ObjectId()}"
    eq_doc = {
        "id": eq_id,
        "equipment_id": eq_id,
        "title": title,
        "name": title,
        "category": category,
        "providerId": user_id,
        "owner_id": user_id,
        "userId": user_id,
        "phone": phone,
        "contactPhone": phone,
        "horsepower": "55 HP",
        "rate": "₹900/hr",
        "implements": ["Rotavator", "Disc Harrow"],
        "available": available,
        "secret_token": "SUPER_SECRET_TOKEN_DO_NOT_LEAK",
        "internal_id": "SYS_INTERNAL_12345"
    }
    mock_db.equipment_catalog.records.append(eq_doc)
    eq_module._in_memory_catalog.append(eq_doc)
    return eq_doc


@pytest.mark.anyio
async def test_01_jwt_role_equipment_provider_selects_machinery_copilot():
    """Test 1: Authenticated role 'equipment_provider' sets canonical equipment_provider role."""
    uid, token, _ = await create_test_user("Provider Raju", "raju@agri.com", "equipment_provider")
    await create_test_equipment(uid, "Mahindra 575 DI")

    with patch.object(nvidia_service, "chat_with_assistant", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = "Machinery advice."
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post(
                "/api/v1/ai/chat",
                headers={"Authorization": f"Bearer {token}"},
                json={"message": "How much diesel does my tractor consume?"}
            )
        assert res.status_code == 200
        assert mock_chat.called
        call_kwargs = mock_chat.call_args.kwargs
        context = call_kwargs["context"]
        assert context["user_role"] == "equipment_provider"
        assert "fleet_summary" in context
        assert len(context["fleet_summary"]) == 1
        assert context["fleet_summary"][0]["name"] == "Mahindra 575 DI"


@pytest.mark.anyio
async def test_02_jwt_role_provider_normalizes_to_equipment_provider():
    """Test 2: Authenticated role 'provider' normalizes to 'equipment_provider' canonical role."""
    uid, token, _ = await create_test_user("Provider Venkat", "venkat@agri.com", "provider")
    await create_test_equipment(uid, "Swaraj 744 FE")

    with patch.object(nvidia_service, "chat_with_assistant", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = "Machinery advice."
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post(
                "/api/v1/ai/chat",
                headers={"Authorization": f"Bearer {token}"},
                json={"message": "What is the maintenance schedule for my Swaraj?"}
            )
        assert res.status_code == 200
        assert mock_chat.called
        context = mock_chat.call_args.kwargs["context"]
        assert context["user_role"] == "equipment_provider"
        assert len(context["fleet_summary"]) == 1
        assert context["fleet_summary"][0]["name"] == "Swaraj 744 FE"


@pytest.mark.anyio
async def test_03_client_supplied_role_cannot_override_authenticated_role():
    """Test 3: Client cannot spoof provider or admin role via payload context."""
    uid, token, _ = await create_test_user("Farmer Suresh", "suresh@agri.com", "farmer")

    with patch.object(nvidia_service, "chat_with_assistant", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = "Agronomy advice."
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post(
                "/api/v1/ai/chat",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "message": "Tell me about my machines",
                    "context": {"user_role": "equipment_provider"}
                }
            )
        assert res.status_code == 200
        context = mock_chat.call_args.kwargs["context"]
        # Authenticated role MUST win
        assert context["user_role"] == "farmer"
        assert "fleet_summary" not in context


@pytest.mark.anyio
async def test_04_provider_receives_only_their_own_fleet_summary():
    """Test 4: Provider receives their own registered machinery in AI context."""
    p1_id, p1_token, _ = await create_test_user("Provider 1", "p1@agri.com", "equipment_provider")
    await create_test_equipment(p1_id, "John Deere 5050D", category="tractor")

    with patch.object(nvidia_service, "chat_with_assistant", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = "Machinery advice."
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post(
                "/api/v1/ai/chat",
                headers={"Authorization": f"Bearer {p1_token}"},
                json={"message": "What machines do I have?"}
            )
        assert res.status_code == 200
        context = mock_chat.call_args.kwargs["context"]
        fleet = context.get("fleet_summary", [])
        assert len(fleet) == 1
        assert fleet[0]["name"] == "John Deere 5050D"
        assert fleet[0]["category"] == "tractor"
        assert fleet[0]["availability"] == "Available"


@pytest.mark.anyio
async def test_05_provider_a_cannot_receive_provider_b_machinery():
    """Test 5: Cross-provider fleet isolation — Provider A cannot see Provider B's equipment."""
    p1_id, p1_token, _ = await create_test_user("Provider A", "pa@agri.com", "equipment_provider", "9111111111")
    p2_id, p2_token, _ = await create_test_user("Provider B", "pb@agri.com", "equipment_provider", "9222222222")

    await create_test_equipment(p1_id, "Provider A Drone 16L", category="drone", phone="9111111111")
    await create_test_equipment(p2_id, "Provider B Harvester", category="harvester", phone="9222222222")

    # Test Provider A's AI chat
    with patch.object(nvidia_service, "chat_with_assistant", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = "Machinery advice."
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post(
                "/api/v1/ai/chat",
                headers={"Authorization": f"Bearer {p1_token}"},
                json={"message": "List my fleet"}
            )
        assert res.status_code == 200
        context_a = mock_chat.call_args.kwargs["context"]
        fleet_names_a = [m["name"] for m in context_a.get("fleet_summary", [])]
        assert "Provider A Drone 16L" in fleet_names_a
        assert "Provider B Harvester" not in fleet_names_a

    # Test Provider B's AI chat
    with patch.object(nvidia_service, "chat_with_assistant", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = "Machinery advice."
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post(
                "/api/v1/ai/chat",
                headers={"Authorization": f"Bearer {p2_token}"},
                json={"message": "List my fleet"}
            )
        assert res.status_code == 200
        context_b = mock_chat.call_args.kwargs["context"]
        fleet_names_b = [m["name"] for m in context_b.get("fleet_summary", [])]
        assert "Provider B Harvester" in fleet_names_b
        assert "Provider A Drone 16L" not in fleet_names_b


@pytest.mark.anyio
async def test_06_provider_with_zero_machinery_gets_empty_fleet_summary():
    """Test 6: Provider with no registered equipment receives fleet_summary=[] without demo fallback."""
    uid, token, _ = await create_test_user("Zero Provider", "zero@agri.com", "equipment_provider")

    with patch.object(nvidia_service, "chat_with_assistant", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = "No machinery listed."
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post(
                "/api/v1/ai/chat",
                headers={"Authorization": f"Bearer {token}"},
                json={"message": "What machines do I have?"}
            )
        assert res.status_code == 200
        context = mock_chat.call_args.kwargs["context"]
        assert context["fleet_summary"] == []


@pytest.mark.anyio
async def test_07_farmer_gets_farmer_behavior_no_fleet_summary():
    """Test 7: Farmer does not receive fleet_summary and retains agronomist role."""
    uid, token, _ = await create_test_user("Farmer Anji", "anji@agri.com", "farmer")

    with patch.object(nvidia_service, "chat_with_assistant", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = "Tomato leaf spot advice."
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post(
                "/api/v1/ai/chat",
                headers={"Authorization": f"Bearer {token}"},
                json={"message": "My chilli crop has yellow spots"}
            )
        assert res.status_code == 200
        context = mock_chat.call_args.kwargs["context"]
        assert context["user_role"] == "farmer"
        assert "fleet_summary" not in context


@pytest.mark.anyio
async def test_08_admin_behavior_remains_unchanged():
    """Test 8: Admin user retains 'admin' role in AI context."""
    uid, token, _ = await create_test_user("Admin Super", "admin@agri.com", "admin")

    with patch.object(nvidia_service, "chat_with_assistant", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = "Admin diagnostic."
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post(
                "/api/v1/ai/chat",
                headers={"Authorization": f"Bearer {token}"},
                json={"message": "System status report"}
            )
        assert res.status_code == 200
        context = mock_chat.call_args.kwargs["context"]
        assert context["user_role"] == "admin"
        assert "fleet_summary" not in context


@pytest.mark.anyio
async def test_09_fleet_summary_sanitized_and_bounded():
    """Test 9: Fleet summary excludes internal secrets/IDs and is bounded to max 20 entries."""
    uid, token, _ = await create_test_user("Big Fleet Provider", "bigfleet@agri.com", "equipment_provider")
    
    # Create 25 machines
    for i in range(25):
        await create_test_equipment(uid, f"Machine Unit {i+1}")

    with patch.object(nvidia_service, "chat_with_assistant", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = "Fleet analysis."
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post(
                "/api/v1/ai/chat",
                headers={"Authorization": f"Bearer {token}"},
                json={"message": "Analyze my fleet capacity"}
            )
        assert res.status_code == 200
        context = mock_chat.call_args.kwargs["context"]
        fleet = context["fleet_summary"]
        assert len(fleet) <= 20  # Bounded size
        for item in fleet:
            assert "secret_token" not in item
            assert "internal_id" not in item
            assert "_id" not in item
            assert "name" in item
            assert "category" in item
            assert "availability" in item


@pytest.mark.anyio
async def test_10_no_global_catalog_fallback_for_provider_ai_context():
    """Test 10: Provider AI context does not fall back to other providers' public catalog machines."""
    # Machine owned by someone else
    other_uid = str(ObjectId())
    await create_test_equipment(other_uid, "Foreign Public Tractor", phone="9998887776")

    # New provider with zero equipment
    uid, token, _ = await create_test_user("Empty Prov", "empty@agri.com", "equipment_provider", phone="9111222333")

    with patch.object(nvidia_service, "chat_with_assistant", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = "No fleet."
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post(
                "/api/v1/ai/chat",
                headers={"Authorization": f"Bearer {token}"},
                json={"message": "Show my machines"}
            )
        assert res.status_code == 200
        context = mock_chat.call_args.kwargs["context"]
        assert context["fleet_summary"] == []


@pytest.mark.anyio
async def test_11_nvidia_service_system_prompt_fleet_inventory_formatting():
    """Test 11: Direct check that nvidia_service formats fleet_summary into system prompt."""
    context = {
        "user_role": "equipment_provider",
        "fleet_summary": [
            {
                "name": "Mahindra 575 DI",
                "category": "tractor",
                "horsepower": "45 HP",
                "rate": "₹800/hr",
                "availability": "Available",
                "implements": "Rotavator, Leveler"
            }
        ]
    }

    with patch.object(nvidia_service, "_execute_completion", new_callable=AsyncMock) as mock_exec:
        mock_exec.return_value = ("Test response.", "nvidia")
        await nvidia_service.chat_with_assistant(
            message="What implements do I have?",
            history=[],
            context=context
        )
        assert mock_exec.called
        call_messages = mock_exec.call_args[0][0]
        system_msg = next((m["content"] for m in call_messages if m["role"] == "system"), "")
        assert "AgriShield Machinery & Fleet Copilot" in system_msg
        assert "[Authenticated Provider Machinery & Fleet Inventory]" in system_msg
        assert "Mahindra 575 DI" in system_msg
        assert "Category: tractor" in system_msg
        assert "Power: 45 HP" in system_msg
        assert "Rental Rate: ₹800/hr" in system_msg
        assert "Implements: Rotavator, Leveler" in system_msg
