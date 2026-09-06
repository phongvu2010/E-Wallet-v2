from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.loan import LoanStatusEnum
from app.schemas.loan import (
    AdjustLoanRateRequest,
    EarlySettleLoanRequest,
    LoanCreate,
    LoanRead,
    LoanSummaryKPIs,
    LoanUpdate,
    PayLoanPeriodRequest,
)
from app.services.loan_service import LoanService

router = APIRouter()


@router.get(
    "/summary/kpis",
    response_model=LoanSummaryKPIs,
    summary="Get overall loans financial KPIs",
)
async def get_loans_summary_kpis(db: AsyncSession = Depends(get_db)):
    """Retrieve aggregate debt KPIs: Total remaining principal, total paid interest, and amount due this month."""
    return await LoanService.get_summary_kpis(db)


@router.get(
    "",
    response_model=List[LoanRead],
    summary="List all financial loans",
)
async def get_all_loans(
    status: Optional[LoanStatusEnum] = Query(default=None, description="Lọc theo trạng thái gói vay"),
    institution_id: Optional[UUID] = Query(default=None, description="Lọc theo tổ chức tín dụng"),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve all financial loans with institutions and schedules loaded."""
    return await LoanService.get_all(db, status_filter=status, institution_id=institution_id)


@router.get(
    "/{loan_id}",
    response_model=LoanRead,
    summary="Get single loan details with amortization schedule and rate history",
)
async def get_loan_by_id(
    loan_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Fetch loan details including its full amortization schedule and historical rate adjustments."""
    return await LoanService.get_by_id(db, loan_id=loan_id)


@router.post(
    "",
    response_model=LoanRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new financial loan package",
)
async def create_loan(
    payload: LoanCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new loan package and automatically generate its monthly repayment schedule."""
    return await LoanService.create(db, payload=payload)


@router.put(
    "/{loan_id}",
    response_model=LoanRead,
    summary="Update loan metadata",
)
async def update_loan(
    loan_id: UUID,
    payload: LoanUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update loan details such as name, code, institution, account, or note."""
    return await LoanService.update(db, loan_id=loan_id, payload=payload)


@router.post(
    "/{loan_id}/adjust-rate",
    response_model=LoanRead,
    summary="Adjust floating interest rate for remaining unpaid periods",
)
async def adjust_loan_rate(
    loan_id: UUID,
    payload: AdjustLoanRateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update floating interest rate from a specific period onwards.

    Recalculates interest amounts and total monthly payments for all remaining unpaid schedules,
    preserves paid periods, and creates an audit log in rate history.
    """
    return await LoanService.adjust_floating_rate(db, loan_id=loan_id, payload=payload)


@router.post(
    "/{loan_id}/pay-period",
    response_model=LoanRead,
    summary="Mark an installment period as paid and record transaction",
)
async def pay_loan_period(
    loan_id: UUID,
    payload: PayLoanPeriodRequest,
    db: AsyncSession = Depends(get_db),
):
    """Record payment for a single periodic installment and deduct remaining loan principal balance."""
    return await LoanService.pay_period(db, loan_id=loan_id, payload=payload)


@router.post(
    "/{loan_id}/early-settle",
    response_model=LoanRead,
    summary="Early settle the entire remaining loan principal",
)
async def early_settle_loan(
    loan_id: UUID,
    payload: EarlySettleLoanRequest,
    db: AsyncSession = Depends(get_db),
):
    """Pay off all remaining loan principal balance before maturity, waive future interest, and charge optional early settlement fee."""
    return await LoanService.early_settle(db, loan_id=loan_id, payload=payload)


@router.delete(
    "/{loan_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a financial loan package",
)
async def delete_loan(
    loan_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Delete a loan package and all associated schedules and rate history."""
    await LoanService.delete(db, loan_id=loan_id)
    return {"message": "Gói vay đã được xóa thành công"}
