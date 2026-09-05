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


@pytest.mark.asyncio
async def test_disable_and_enable_account(client: AsyncClient):
    # 1. Get an existing account
    acc_res = await client.get("/api/v1/accounts")
    assert acc_res.status_code == 200
    accounts = acc_res.json()
    assert len(accounts) >= 1
    acc_id = accounts[0]["id"]
    orig_status = accounts[0]["status"]

    # 2. Disable account
    disable_res = await client.patch(f"/api/v1/accounts/{acc_id}/disable")
    assert disable_res.status_code == 200
    assert disable_res.json()["status"] == "LOCKED"

    # 3. Verify in get by ID
    get_res = await client.get(f"/api/v1/accounts/{acc_id}")
    assert get_res.status_code == 200
    assert get_res.json()["status"] == "LOCKED"

    # 4. Enable account
    enable_res = await client.patch(f"/api/v1/accounts/{acc_id}/enable")
    assert enable_res.status_code == 200
    assert enable_res.json()["status"] == "ACTIVE"

    # 5. Restore original status if needed
    if orig_status != "ACTIVE":
        await client.patch(
            f"/api/v1/accounts/{acc_id}/status", json={"status": orig_status}
        )


@pytest.mark.asyncio
async def test_toggle_and_patch_account_status(client: AsyncClient):
    acc_res = await client.get("/api/v1/accounts")
    assert acc_res.status_code == 200
    accounts = acc_res.json()
    assert len(accounts) >= 1
    acc_id = accounts[0]["id"]

    # Ensure starts as ACTIVE
    await client.patch(f"/api/v1/accounts/{acc_id}/enable")

    # Toggle to LOCKED
    toggle1 = await client.patch(f"/api/v1/accounts/{acc_id}/toggle-status")
    assert toggle1.status_code == 200
    assert toggle1.json()["status"] == "LOCKED"

    # Toggle back to ACTIVE
    toggle2 = await client.patch(f"/api/v1/accounts/{acc_id}/toggle-status")
    assert toggle2.status_code == 200
    assert toggle2.json()["status"] == "ACTIVE"

    # Update status explicitly
    patch_res = await client.patch(
        f"/api/v1/accounts/{acc_id}/status", json={"status": "LOCKED"}
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "LOCKED"

    # Restore
    await client.patch(f"/api/v1/accounts/{acc_id}/enable")


@pytest.mark.asyncio
async def test_update_account_note_empty_sets_null(client: AsyncClient):
    acc_res = await client.get("/api/v1/accounts")
    assert acc_res.status_code == 200
    accounts = acc_res.json()
    assert len(accounts) >= 1
    acc_id = accounts[0]["id"]
    orig_note = accounts[0].get("note")

    # 1. Update with non-empty note
    patch1 = await client.patch(
        f"/api/v1/accounts/{acc_id}", json={"note": "Test note content"}
    )
    assert patch1.status_code == 200
    assert patch1.json()["note"] == "Test note content"

    # 2. Update with empty string "" -> should become None/null
    patch2 = await client.patch(
        f"/api/v1/accounts/{acc_id}", json={"note": ""}
    )
    assert patch2.status_code == 200
    assert patch2.json()["note"] is None

    # 3. Update with whitespace only "   " -> should also become None/null
    patch3 = await client.patch(
        f"/api/v1/accounts/{acc_id}", json={"note": "   "}
    )
    assert patch3.status_code == 200
    assert patch3.json()["note"] is None

    # 4. Restore original note
    await client.patch(
        f"/api/v1/accounts/{acc_id}", json={"note": orig_note}
    )
