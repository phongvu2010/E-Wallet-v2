import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_accounts(client: AsyncClient):
    response = await client.get("/api/v1/accounts")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    # Verify field structure
    first_acc = data[0]
    assert "account_name" in first_acc
    assert "card_number_masked" in first_acc
    assert "credit_limit" in first_acc


@pytest.mark.asyncio
async def test_accounts_live_balance(client: AsyncClient):
    response = await client.get("/api/v1/accounts/live-balance")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    first_row = data[0]
    assert "live_current_balance" in first_row
    assert "live_available_limit" in first_row
    assert "live_risk_level" in first_row


@pytest.mark.asyncio
async def test_accounts_overview(client: AsyncClient):
    response = await client.get("/api/v1/accounts/overview")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert "latest_statement_balance" in data[0]
