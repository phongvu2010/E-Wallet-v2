import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_bank_and_cash_accounts(client: AsyncClient):
    # 1. Create Cash Wallet
    cash_res = await client.post(
        "/api/v1/accounts",
        json={
            "account_name": "Ví Tiền Mặt Cá Nhân",
            "account_type": "CASH",
            "initial_balance": 5000000.0,
            "color_hex": "#10b981",
        },
    )
    assert cash_res.status_code == 201
    cash_data = cash_res.json()
    assert cash_data["account_name"] == "Ví Tiền Mặt Cá Nhân"
    assert cash_data["account_type"] == "CASH"
    assert float(cash_data["initial_balance"]) == 5000000.0

    # 2. Create Bank Account (e.g. Techcombank)
    bank_res = await client.post(
        "/api/v1/accounts",
        json={
            "account_name": "Techcombank Lương",
            "account_type": "BANK_ACCOUNT",
            "card_number_masked": "1903 8888 9999",
            "initial_balance": 25000000.0,
            "color_hex": "#ef4444",
        },
    )
    assert bank_res.status_code == 201
    bank_data = bank_res.json()
    assert bank_data["account_name"] == "Techcombank Lương"
    assert bank_data["account_type"] == "BANK_ACCOUNT"
    assert float(bank_data["initial_balance"]) == 25000000.0


@pytest.mark.asyncio
async def test_income_transaction_and_transfer(client: AsyncClient):
    # 1. Create Bank Account for salary
    bank_res = await client.post(
        "/api/v1/accounts",
        json={
            "account_name": "Vietcombank Nhận Lương",
            "account_type": "BANK_ACCOUNT",
            "initial_balance": 10000000.0,
            "color_hex": "#059669",
        },
    )
    assert bank_res.status_code == 201
    bank_id = bank_res.json()["id"]

    # 2. Create Income Transaction (Lương tháng)
    income_res = await client.post(
        "/api/v1/transactions",
        json={
            "account_id": bank_id,
            "transaction_date": "2026-09-01",
            "raw_description": "CONG TY CP ABC TRA LUONG THANG 8",
            "transaction_type": "INCOME",
            "amount": 35000000.0,
            "total_amount": 35000000.0,
            "note": "Nhận lương chuyển khoản",
        },
    )
    assert income_res.status_code == 201
    income_data = income_res.json()
    assert income_data["transaction_type"] == "INCOME"
    assert float(income_data["total_amount"]) == 35000000.0

    # 3. Create Cash Wallet and Transfer from VCB to Cash Wallet (Rút ATM)
    cash_res = await client.post(
        "/api/v1/accounts",
        json={
            "account_name": "Ví Tiền Mặt Rút ATM",
            "account_type": "CASH",
            "initial_balance": 1000000.0,
            "color_hex": "#10b981",
        },
    )
    assert cash_res.status_code == 201
    cash_id = cash_res.json()["id"]

    transfer_res = await client.post(
        "/api/v1/transactions",
        json={
            "account_id": bank_id,
            "transfer_to_account_id": cash_id,
            "transaction_date": "2026-09-02",
            "raw_description": "RUT TIEN MAT ATM VCB",
            "transaction_type": "TRANSFER",
            "amount": 5000000.0,
            "total_amount": 5000000.0,
            "note": "Rút tiền mặt chi tiêu hàng ngày",
        },
    )
    assert transfer_res.status_code == 201
    assert transfer_res.json()["transaction_type"] == "TRANSFER"


@pytest.mark.asyncio
async def test_net_worth_and_cash_flow_endpoints(client: AsyncClient):
    # 1. Test Net Worth endpoint
    nw_res = await client.get("/api/v1/analytics/net-worth")
    assert nw_res.status_code == 200
    nw_data = nw_res.json()
    assert "total_liquid_assets" in nw_data
    assert "total_credit_debt" in nw_data
    assert "net_worth" in nw_data
    assert "active_asset_accounts_count" in nw_data
    assert "active_credit_cards_count" in nw_data

    # 2. Test Monthly Cash Flow endpoint
    cf_res = await client.get("/api/v1/analytics/cash-flow")
    assert cf_res.status_code == 200
    cf_data = cf_res.json()
    assert isinstance(cf_data, list)

    # 3. Test Dashboard Overview Net Worth fields
    overview_res = await client.get("/api/v1/analytics/overview")
    assert overview_res.status_code == 200
    overview_data = overview_res.json()
    assert "total_liquid_assets" in overview_data
    assert "net_worth" in overview_data
    assert "monthly_income_current_month" in overview_data


@pytest.mark.asyncio
async def test_wallet_transfer_with_fees(client: AsyncClient):
    # 1. Create Wallet A (5,000,000đ) and Wallet B (1,000,000đ)
    wallet_a_res = await client.post(
        "/api/v1/accounts",
        json={
            "account_name": "Ví Momo Nguồn A",
            "account_type": "E_WALLET",
            "initial_balance": 5000000.0,
            "color_hex": "#d946ef",
        },
    )
    assert wallet_a_res.status_code == 201
    wallet_a_id = wallet_a_res.json()["id"]

    wallet_b_res = await client.post(
        "/api/v1/accounts",
        json={
            "account_name": "Ví ZaloPay Đích B",
            "account_type": "E_WALLET",
            "initial_balance": 1000000.0,
            "color_hex": "#06b6d4",
        },
    )
    assert wallet_b_res.status_code == 201
    wallet_b_id = wallet_b_res.json()["id"]

    # 2. Transfer 500,000đ from Wallet A to Wallet B with fee 1,100đ (total_amount = 501,100đ)
    transfer_res = await client.post(
        "/api/v1/transactions",
        json={
            "account_id": wallet_a_id,
            "transfer_to_account_id": wallet_b_id,
            "transaction_date": "2026-09-05",
            "raw_description": "Chuyen tien Momo sang ZaloPay",
            "transaction_type": "TRANSFER",
            "amount": 500000.0,
            "fee": 1100.0,
            "total_amount": 501100.0,
            "note": "Phí giao dịch chuyển ví",
        },
    )
    assert transfer_res.status_code == 201
    tx_data = transfer_res.json()
    assert tx_data["amount"] == 500000.0
    assert tx_data["fee"] == 1100.0
    assert tx_data["total_amount"] == 501100.0

    # 3. Check Live Balances
    live_res = await client.get("/api/v1/accounts/live-balance")
    assert live_res.status_code == 200
    balances = {b["account_id"]: b["live_current_balance"] for b in live_res.json()}

    # Wallet A should have 5,000,000 - 501,100 = 4,498,900đ
    assert balances[wallet_a_id] == 4498900.0
    # Wallet B should have 1,000,000 + 500,000 = 1,500,000đ (NOT 1,501,100đ)
    assert balances[wallet_b_id] == 1500000.0
