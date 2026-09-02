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


@pytest.mark.asyncio
async def test_merchant_suggestions_endpoint(client: AsyncClient):
    response = await client.get("/api/v1/merchants/suggestions?limit=20")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if len(data) > 0:
        first_m = data[0]
        assert "id" in first_m
        assert "cleaned_name" in first_m
        assert "aliases" in first_m


@pytest.mark.asyncio
async def test_create_transaction_with_merchant_and_installment(client: AsyncClient):
    # 1. Get an active account
    acc_res = await client.get("/api/v1/accounts")
    accounts = [a for a in acc_res.json() if a.get("status") == "ACTIVE"]
    assert len(accounts) > 0
    acc_id = accounts[0]["id"]

    # 2. Create transaction with merchant_name and inline installment
    tx_payload = {
        "account_id": acc_id,
        "transaction_date": "2026-08-25",
        "raw_description": "APPLE STORE VIETNAM - IPHONE 16",
        "merchant_name": "Apple Store",
        "transaction_type": "PURCHASE",
        "original_amount": "999.00",
        "original_currency": "USD",
        "exchange_rate": "25450.0000",
        "foreign_fee": "635000.00",
        "amount": "25424550.00",
        "fee": "635000.00",
        "total_amount": "26059550.00",
        "note": "Smart transaction with installment conversion",
        "convert_to_installment": {
            "product_name": "iPhone 16 Pro Max 256GB",
            "term_months": 6,
            "conversion_fee": "635000.00",
            "interest_rate_percent": "0.00",
        },
    }

    create_res = await client.post("/api/v1/transactions", json=tx_payload)
    assert create_res.status_code == 201
    created_tx = create_res.json()
    tx_id = created_tx["id"]

    assert created_tx["is_installment"] is True
    assert created_tx["installment_plan_id"] is not None
    assert created_tx["original_currency"] == "USD"
    assert float(created_tx["original_amount"]) == 999.0

    # 3. Verify the created installment plan
    plan_id = created_tx["installment_plan_id"]
    plan_res = await client.get(f"/api/v1/installments/{plan_id}")
    assert plan_res.status_code == 200
    plan_data = plan_res.json()
    assert plan_data["product_name"] == "iPhone 16 Pro Max 256GB"
    assert plan_data["term_months"] == 6
    assert len(plan_data["schedules"]) == 6

    # 4. Clean up transaction and plan
    del_res = await client.delete(f"/api/v1/transactions/{tx_id}")
    assert del_res.status_code == 200
