import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_analytics_dashboard_overview(client: AsyncClient):
    response = await client.get("/api/v1/analytics/overview")
    assert response.status_code == 200
    data = response.json()
    assert "total_credit_limit" in data
    assert "total_live_balance" in data
    assert "total_available_limit" in data
    assert "overall_utilization_percentage" in data
    assert "overall_risk_level" in data


@pytest.mark.asyncio
async def test_analytics_monthly_spending(client: AsyncClient):
    response = await client.get("/api/v1/analytics/monthly-spending?limit=10")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if len(data) > 0:
        first_row = data[0]
        assert "month" in first_row
        assert "category_name" in first_row
        assert "total_spending" in first_row


@pytest.mark.asyncio
async def test_analytics_credit_utilization(client: AsyncClient):
    response = await client.get("/api/v1/analytics/credit-utilization")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if len(data) > 0:
        first_row = data[0]
        assert "account_name" in first_row
        assert "utilization_percentage" in first_row
        assert "risk_level" in first_row


@pytest.mark.asyncio
async def test_analytics_upcoming_obligations(client: AsyncClient):
    response = await client.get("/api/v1/analytics/upcoming-obligations")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if len(data) > 0:
        first_row = data[0]
        assert "obligation_type" in first_row
        assert "total_amount_due" in first_row
