import datetime
from decimal import Decimal
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account, AccountStatusEnum, AccountTypeEnum
from app.schemas.installment import InstallmentPlanCreate
from app.services.installment_service import InstallmentService


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


@pytest.mark.asyncio
async def test_installment_rounding_adjusted_in_first_period(db_session: AsyncSession):
    """Test that installment rounding remainder is adjusted in period 1."""
    acc = Account(
        account_name="Thẻ Tín Dụng Trả Góp",
        account_type=AccountTypeEnum.CREDIT_CARD,
        initial_balance=Decimal("0.00"),
        credit_limit=Decimal("50000000.00"),
        status=AccountStatusEnum.ACTIVE,
    )
    db_session.add(acc)
    await db_session.flush()

    payload = InstallmentPlanCreate(
        account_id=acc.id,
        product_name="iPhone 16 Pro Max",
        total_amount=Decimal("10000000.00"),
        term_months=3,
        start_date=datetime.date(2026, 1, 1),
    )
    plan = await InstallmentService.create(db_session, payload)
    assert plan is not None
    assert len(plan.schedules) == 3

    # Base monthly = 3,333,333.33
    # Period 1 = 10,000,000 - 2 * 3,333,333.33 = 3,333,333.34
    assert plan.schedules[0].principal_amount == Decimal("3333333.34")
    assert plan.schedules[1].principal_amount == Decimal("3333333.33")
    assert plan.schedules[2].principal_amount == Decimal("3333333.33")

    total_principals = sum(s.principal_amount for s in plan.schedules)
    assert total_principals == Decimal("10000000.00")
