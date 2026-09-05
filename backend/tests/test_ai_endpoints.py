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


@pytest.mark.asyncio
async def test_ai_chat_add_purchase_transaction_command(client: AsyncClient):
    response = await client.post(
        "/api/v1/ai/chat",
        json={
            "message": "Thêm giao dịch mua cafe Highland 45.000đ bằng thẻ Techcombank",
            "include_financial_context": True,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data.get("action") == "PREPARE_TRANSACTION"
    draft = data.get("transaction_draft")
    assert draft is not None
    assert float(draft["amount"]) == 45000.0
    assert draft["transaction_type"] == "PURCHASE"
    assert "Highland" in (draft.get("merchant_name") or "") or "Highlands Coffee" in (draft.get("merchant_name") or "")


@pytest.mark.asyncio
async def test_ai_chat_add_transfer_transaction_command(client: AsyncClient):
    response = await client.post(
        "/api/v1/ai/chat",
        json={
            "message": "Chuyển khoản 2 triệu từ VCB sang MoMo phí 1k",
            "include_financial_context": True,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data.get("action") == "PREPARE_TRANSACTION"
    draft = data.get("transaction_draft")
    assert draft is not None
    assert float(draft["amount"]) == 2000000.0
    assert float(draft["fee"]) == 1000.0
    assert draft["transaction_type"] == "TRANSFER"


@pytest.mark.asyncio
async def test_ai_chat_add_income_transaction_command(client: AsyncClient):
    response = await client.post(
        "/api/v1/ai/chat",
        json={
            "message": "Vừa nhận lương 25tr vào tài khoản Vietcombank",
            "include_financial_context": True,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data.get("action") == "PREPARE_TRANSACTION"
    draft = data.get("transaction_draft")
    assert draft is not None
    assert float(draft["amount"]) == 25000000.0
    assert draft["transaction_type"] == "INCOME"

