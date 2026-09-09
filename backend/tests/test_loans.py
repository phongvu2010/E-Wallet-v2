import datetime
from decimal import Decimal
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loan import InterestMethodEnum, LoanTypeEnum
from app.schemas.loan import LoanCreate
from app.services.loan_service import LoanService


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


@pytest.mark.asyncio
async def test_loan_reducing_balance_rounding_adjusted_in_last_period(db_session: AsyncSession):
    """Test that decimal fractions/remainders are absorbed into the final period for REDUCING_BALANCE."""
    payload = LoanCreate(
        loan_name="Vay mua xe 3 tháng",
        loan_type=LoanTypeEnum.AUTO,
        interest_method=InterestMethodEnum.REDUCING_BALANCE,
        principal_amount=Decimal("10000000.00"),
        term_months=3,
        start_date=datetime.date(2026, 1, 1),
        billing_day_of_month=15,
        current_interest_rate=Decimal("12.00"),
    )
    loan = await LoanService.create(db_session, payload)
    assert loan is not None
    assert len(loan.schedules) == 3

    # Total principal = 10,000,000. Divided by 3 gives 3,333,333 base.
    # Periods 1 & 2 pay 3,333,333. Final period absorbs remainder: 10,000,000 - 2 * 3,333,333 = 3,333,334
    assert loan.schedules[0].principal_amount == Decimal("3333333.00")
    assert loan.schedules[1].principal_amount == Decimal("3333333.00")
    assert loan.schedules[2].principal_amount == Decimal("3333334.00")

    # Sum of principals must be EXACTLY 10,000,000
    total_principals = sum(s.principal_amount for s in loan.schedules)
    assert total_principals == Decimal("10000000.00")
    assert loan.schedules[2].ending_balance == Decimal("0.00")


@pytest.mark.asyncio
async def test_loan_flat_rate_rounding_adjusted_in_last_period(db_session: AsyncSession):
    """Test that decimal fractions/remainders are absorbed into the final period for FLAT rate."""
    payload = LoanCreate(
        loan_name="Vay tín chấp 3 tháng",
        loan_type=LoanTypeEnum.CONSUMER,
        interest_method=InterestMethodEnum.FLAT,
        principal_amount=Decimal("10000000.00"),
        term_months=3,
        start_date=datetime.date(2026, 1, 1),
        billing_day_of_month=15,
        current_interest_rate=Decimal("10.00"),
    )
    loan = await LoanService.create(db_session, payload)
    assert loan is not None
    assert len(loan.schedules) == 3

    assert loan.schedules[0].principal_amount == Decimal("3333333.00")
    assert loan.schedules[1].principal_amount == Decimal("3333333.00")
    assert loan.schedules[2].principal_amount == Decimal("3333334.00")

    total_principals = sum(s.principal_amount for s in loan.schedules)
    assert total_principals == Decimal("10000000.00")
    assert loan.schedules[2].ending_balance == Decimal("0.00")


@pytest.mark.asyncio
async def test_loan_equal_installment_sum_exact(db_session: AsyncSession):
    """Test that EQUAL_INSTALLMENT sum of principals matches principal_amount exactly."""
    payload = LoanCreate(
        loan_name="Vay mua nhà 12 tháng",
        loan_type=LoanTypeEnum.MORTGAGE,
        interest_method=InterestMethodEnum.EQUAL_INSTALLMENT,
        principal_amount=Decimal("100000000.00"),
        term_months=12,
        start_date=datetime.date(2026, 1, 1),
        billing_day_of_month=15,
        current_interest_rate=Decimal("10.50"),
    )
    loan = await LoanService.create(db_session, payload)
    assert loan is not None
    assert len(loan.schedules) == 12

    total_principals = sum(s.principal_amount for s in loan.schedules)
    assert total_principals == Decimal("100000000.00")
    assert loan.schedules[-1].ending_balance == Decimal("0.00")


@pytest.mark.asyncio
async def test_loan_adjust_floating_rate_multi_decimal_precision(db_session: AsyncSession):
    """Test creating and adjusting floating loan interest rate with arbitrary decimal precision (e.g. 8.525%, 7.1234%)."""
    from app.schemas.loan import AdjustLoanRateRequest

    payload = LoanCreate(
        loan_name="Vay mua nhà lãi thả nổi đa chữ số thập phân",
        loan_type=LoanTypeEnum.MORTGAGE,
        interest_method=InterestMethodEnum.REDUCING_BALANCE,
        principal_amount=Decimal("50000000.00"),
        term_months=6,
        start_date=datetime.date(2026, 1, 1),
        billing_day_of_month=15,
        current_interest_rate=Decimal("8.5255"),
    )
    loan = await LoanService.create(db_session, payload)
    assert loan is not None
    assert loan.current_interest_rate == Decimal("8.5255")

    # Adjust floating rate to 7.123456% from period 2
    adjust_payload = AdjustLoanRateRequest(
        new_interest_rate=Decimal("7.123456"),
        effective_from_period=2,
        reason="Ngân hàng điều chỉnh biên độ lãi suất kỳ mới",
    )
    updated_loan = await LoanService.adjust_floating_rate(db_session, loan.id, adjust_payload)
    assert updated_loan.current_interest_rate == Decimal("7.123456")
    assert updated_loan.schedules[0].applied_interest_rate == Decimal("8.5255")
    assert updated_loan.schedules[1].applied_interest_rate == Decimal("7.123456")
    assert len(updated_loan.rate_histories) == 2
    assert updated_loan.rate_histories[0].new_rate == Decimal("7.123456")

