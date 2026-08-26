import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_transactions_paginated(client: AsyncClient):
    response = await client.get("/api/v1/transactions?page=1&page_size=10")
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "items" in data
    assert data["page"] == 1
    assert data["page_size"] == 10
    assert len(data["items"]) <= 10
    if len(data["items"]) > 0:
        first_tx = data["items"][0]
        assert "raw_description" in first_tx
        assert "total_amount" in first_tx
        assert "transaction_type" in first_tx


@pytest.mark.asyncio
async def test_transactions_summary(client: AsyncClient):
    response = await client.get("/api/v1/transactions/summary")
    assert response.status_code == 200
    data = response.json()
    assert "total_transactions" in data
    assert "total_spending" in data
    assert "total_repayments" in data
    assert "net_flow" in data
