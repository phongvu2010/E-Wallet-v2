import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_institutions(client: AsyncClient):
    response = await client.get("/api/v1/institutions")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 3  # Shinhan, HSBC, Sacombank


@pytest.mark.asyncio
async def test_category_tree(client: AsyncClient):
    response = await client.get("/api/v1/categories/tree")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    # Check parent category with children
    parent_names = [c["name"] for c in data]
    assert "Chi tiêu" in parent_names
    chi_tieu = next(c for c in data if c["name"] == "Chi tiêu")
    assert "children" in chi_tieu
    assert len(chi_tieu["children"]) >= 1


@pytest.mark.asyncio
async def test_merchants_list(client: AsyncClient):
    response = await client.get("/api/v1/merchants?search=Shopee")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_statements_reconciliation(client: AsyncClient):
    response = await client.get("/api/v1/statements/reconciliation")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if len(data) > 0:
        first_stmt = data[0]
        assert "expected_statement_balance" in first_stmt
        assert "reconciliation_status" in first_stmt


@pytest.mark.asyncio
async def test_statements_payment_status(client: AsyncClient):
    response = await client.get("/api/v1/statements/payment-status")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if len(data) > 0:
        first_stmt = data[0]
        assert "payment_status" in first_stmt
        assert "remaining_balance_to_pay" in first_stmt


@pytest.mark.asyncio
async def test_rewards_list(client: AsyncClient):
    response = await client.get("/api/v1/rewards")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_transaction_create_and_delete(client: AsyncClient):
    # 1. Get an existing account
    acc_res = await client.get("/api/v1/accounts")
    accounts = acc_res.json()
    assert len(accounts) > 0
    acc_id = accounts[0]["id"]

    # 2. Create a test transaction
    tx_payload = {
        "account_id": acc_id,
        "transaction_date": "2026-08-20",
        "raw_description": "TEST TRANSACTION AUTOMATION",
        "transaction_type": "PURCHASE",
        "amount": "150000.00",
        "fee": "0.00",
        "total_amount": "150000.00",
        "note": "Pytest temporary record",
    }
    create_res = await client.post("/api/v1/transactions", json=tx_payload)
    assert create_res.status_code == 201
    created_tx = create_res.json()
    tx_id = created_tx["id"]
    assert created_tx["raw_description"] == "TEST TRANSACTION AUTOMATION"
    assert float(created_tx["total_amount"]) == 150000.0

    # 3. Get by ID
    get_res = await client.get(f"/api/v1/transactions/{tx_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == tx_id

    # 4. Update transaction
    update_res = await client.put(
        f"/api/v1/transactions/{tx_id}",
        json={"note": "Updated by pytest"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["note"] == "Updated by pytest"

    # 5. Delete transaction
    del_res = await client.delete(f"/api/v1/transactions/{tx_id}")
    assert del_res.status_code == 204

    # 6. Verify deletion
    verify_res = await client.get(f"/api/v1/transactions/{tx_id}")
    assert verify_res.status_code == 404
