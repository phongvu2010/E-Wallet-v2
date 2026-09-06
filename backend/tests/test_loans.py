import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_loans_and_kpis(client: AsyncClient):
    # Test KPIs endpoint
    kpi_resp = await client.get("/api/v1/loans/summary/kpis")
    assert kpi_resp.status_code == 200
    kpis = kpi_resp.json()
    assert "total_active_loans" in kpis
    assert "total_remaining_principal" in kpis

    # Test List endpoint
    list_resp = await client.get("/api/v1/loans")
    assert list_resp.status_code == 200
    loans = list_resp.json()
    assert isinstance(loans, list)
