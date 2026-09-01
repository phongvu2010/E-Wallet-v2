import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_ai_chat_advisor_endpoint(client: AsyncClient):
    response = await client.post(
        "/api/v1/ai/chat",
        json={
            "message": "Dư nợ và hạn mức khả dụng của tôi hiện tại là bao nhiêu?",
            "include_financial_context": True,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data
    assert len(data["reply"]) > 10
    assert "suggested_followups" in data
