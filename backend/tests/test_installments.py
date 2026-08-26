import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_installments(client: AsyncClient):
    response = await client.get("/api/v1/installments")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if len(data) > 0:
        first_plan = data[0]
        assert "product_name" in first_plan
        assert "total_amount" in first_plan
        assert "term_months" in first_plan
        assert "schedules" in first_plan


@pytest.mark.asyncio
async def test_installment_forecast(client: AsyncClient):
    response = await client.get("/api/v1/installments/forecast")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if len(data) > 0:
        assert "billing_month" in data[0]
        assert "total_monthly_payment" in data[0]
