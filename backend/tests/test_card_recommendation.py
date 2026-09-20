import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_card_benefits(client: AsyncClient):
    response = await client.get("/api/v1/recommendations/benefits")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_recommend_best_card(client: AsyncClient):
    response = await client.post(
        "/api/v1/recommendations/best-card",
        json={
            "amount": 1500000.0,
            "category_name": "Nhà hàng & F&B",
            "merchant_name": "Starbucks Coffee",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "requested_amount" in data
    assert float(data["requested_amount"]) == 1500000.0
    assert "detected_category" in data
    assert "recommendations" in data
    assert isinstance(data["recommendations"], list)


@pytest.mark.asyncio
async def test_create_and_fetch_card_benefit(client: AsyncClient):
    # 1. Fetch existing active account
    acc_res = await client.get("/api/v1/accounts")
    assert acc_res.status_code == 200
    accounts = acc_res.json()
    if not accounts:
        pytest.skip("No accounts seeded in database for benefit creation test")

    test_account = accounts[0]
    acc_id = test_account["id"]

    # 2. Create a test card benefit
    benefit_payload = {
        "account_id": acc_id,
        "category_keyword": "Ẩm thực cuối tuần",
        "merchant_pattern": "HIGHLANDS%",
        "reward_type": "CASHBACK",
        "reward_rate_percent": "5.00",
        "point_multiplier": "1.00",
        "min_spend_per_txn": "50000.00",
        "max_reward_monthly": "500000.00",
        "description": "Hoàn tiền 5% ăn uống cuối tuần",
        "is_active": True,
    }

    create_res = await client.post("/api/v1/recommendations/benefits", json=benefit_payload)
    assert create_res.status_code == 201
    created_data = create_res.json()

    # Verify relationships are loaded without MissingGreenlet and fields populated
    assert created_data["account_id"] == acc_id
    assert created_data["account_name"] == test_account["account_name"]
    if test_account.get("institution"):
        assert created_data["bank_name"] == test_account["institution"]["name"]
    assert created_data["reward_rate_percent"] == "5.00"

    # 3. Verify get_all_benefits loads it properly
    list_res = await client.get(f"/api/v1/recommendations/benefits?account_id={acc_id}")
    assert list_res.status_code == 200
    benefits_list = list_res.json()
    assert any(b["id"] == created_data["id"] for b in benefits_list)
