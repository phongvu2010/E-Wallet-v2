import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_notification_summary(client: AsyncClient):
    response = await client.get("/api/v1/notifications/summary")
    assert response.status_code == 200
    data = response.json()
    assert "unread_count" in data
    assert "total_count" in data
    assert "items" in data


@pytest.mark.asyncio
async def test_notification_settings_flow(client: AsyncClient):
    # 1. Get settings
    get_res = await client.get("/api/v1/notifications/settings")
    assert get_res.status_code == 200
    settings = get_res.json()
    assert "is_in_app_enabled" in settings

    # 2. Update settings
    update_res = await client.put(
        "/api/v1/notifications/settings",
        json={
            "telegram_bot_token": "123456:TEST_TOKEN",
            "telegram_chat_id": "987654321",
            "is_telegram_enabled": False,
            "remind_days_before": 5,
            "remind_utilization_threshold": 75,
        },
    )
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["remind_days_before"] == 5
    assert updated["remind_utilization_threshold"] == 75


@pytest.mark.asyncio
async def test_test_telegram_endpoint(client: AsyncClient):
    response = await client.post(
        "/api/v1/notifications/test-telegram",
        json={
            "bot_token": "invalid_token",
            "chat_id": "invalid_chat_id",
            "custom_message": "Test message",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "success" in data
    assert "message" in data
