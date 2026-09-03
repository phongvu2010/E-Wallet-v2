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
