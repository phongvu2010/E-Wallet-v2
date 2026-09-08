import calendar
import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.models.account import Account
from app.models.installment import (
    InstallmentPlan,
    InstallmentSchedule,
    InstallmentStatusEnum,
)
from app.schemas.installment import (
    EarlySettleRequest,
    EarlySettleResponse,
    InstallmentForecastRead,
    InstallmentPlanCreate,
)


def add_months_to_date(
    base_date: datetime.date, months_to_add: int, target_day: Optional[int] = None
) -> datetime.date:
    """Calculate the target due date after adding `months_to_add` months to `base_date`.

    Safely handles month-end bounds (e.g. Feb 28/29 or April 30) and aligns with the card's
    billing cycle closing day if provided.

    Args:
        base_date (datetime.date): The starting transaction date.
        months_to_add (int): Number of months to advance.
        target_day (Optional[int]): Desired day of month (e.g. card billing day). Defaults to base_date.day.

    Returns:
        datetime.date: The computed target date bounded by valid calendar days.
    """
    year = base_date.year + (base_date.month + months_to_add - 1) // 12
    month = (base_date.month + months_to_add - 1) % 12 + 1
    max_days = calendar.monthrange(year, month)[1]
    day = target_day if target_day is not None else base_date.day
    day = min(max(1, day), max_days)
    return datetime.date(year, month, day)


class InstallmentService:
    """Service layer managing 0% and fee-based Credit Card Installment Plans.

    Handles creation of monthly installment amortization schedules, tracking of billed periods,
    cashflow forecasting, and automated early settlement via database stored functions.
    """

    @staticmethod
    async def get_all(
        db: AsyncSession,
        account_id: Optional[UUID] = None,
        status_filter: Optional[InstallmentStatusEnum] = None,
    ) -> List[InstallmentPlan]:
        """Retrieve all installment plans with their schedules and merchant details.

        Args:
            db (AsyncSession): Active asynchronous database session.
            account_id (Optional[UUID]): Optional filter by credit card account.
            status_filter (Optional[InstallmentStatusEnum]): Optional status filter (ACTIVE/SETTLED/CANCELLED).

        Returns:
            List[InstallmentPlan]: List of plans ordered by start date and creation timestamp.
        """
        query = select(InstallmentPlan).options(
            selectinload(InstallmentPlan.merchant),
            selectinload(InstallmentPlan.schedules),
        )
        if account_id:
            query = query.where(InstallmentPlan.account_id == account_id)
        if status_filter:
            query = query.where(InstallmentPlan.status == status_filter)

        query = query.order_by(
            InstallmentPlan.start_date.desc(), InstallmentPlan.created_at.desc()
        )
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def get_by_id(db: AsyncSession, plan_id: UUID) -> InstallmentPlan:
        """Retrieve a specific installment plan by primary UUID.

        Args:
            db (AsyncSession): Active asynchronous database session.
            plan_id (UUID): Installment plan identifier.

        Returns:
            InstallmentPlan: Plan with merchant, account, and schedules loaded.

        Raises:
            HTTPException: 404 Not Found if plan does not exist.
        """
        query = (
            select(InstallmentPlan)
            .options(
                selectinload(InstallmentPlan.merchant),
                selectinload(InstallmentPlan.schedules),
                selectinload(InstallmentPlan.account),
            )
            .where(InstallmentPlan.id == plan_id)
        )
        result = await db.execute(query)
        plan = result.scalar_one_or_none()
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Installment plan with ID {plan_id} not found",
            )
        return plan

    @staticmethod
    async def create(
        db: AsyncSession, payload: InstallmentPlanCreate
    ) -> InstallmentPlan:
        """Create an installment plan and automatically generate its periodic amortization schedules.

        Calculates monthly principal installments and balances any rounding odd cents into the final month.

        Args:
            db (AsyncSession): Active asynchronous database session.
            payload (InstallmentPlanCreate): Plan configuration (amount, term_months, conversion_fee, etc.).

        Returns:
            InstallmentPlan: The newly created plan and generated schedule items.

        Raises:
            HTTPException: 400 Bad Request if term <= 0 or creation fails.
        """
        term = payload.term_months
        if term <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Term months must be greater than 0",
            )

        tot_amt = payload.total_amount
        base_monthly = round(tot_amt / Decimal(term), 2)
        first_period_principal = tot_amt - (Decimal(term - 1) * base_monthly)

        # Get account billing_day_of_month
        acc_stmt = select(Account.billing_day_of_month).where(
            Account.id == payload.account_id
        )
        acc_res = await db.execute(acc_stmt)
        billing_day = acc_res.scalar_one_or_none()

        plan = InstallmentPlan(
            account_id=payload.account_id,
            origin_transaction_id=payload.origin_transaction_id,
            product_name=payload.product_name,
            merchant_id=payload.merchant_id,
            start_date=payload.start_date,
            total_amount=tot_amt,
            conversion_fee=payload.conversion_fee,
            interest_rate_percent=payload.interest_rate_percent,
            term_months=term,
            monthly_principal=base_monthly,
            monthly_payment=base_monthly,
            remaining_balance=tot_amt,
            status=InstallmentStatusEnum.ACTIVE,
        )
        db.add(plan)
        await db.flush()

        for i in range(1, term + 1):
            period_principal = first_period_principal if i == 1 else base_monthly
            due_date = add_months_to_date(payload.start_date, i, billing_day)

            sched = InstallmentSchedule(
                installment_plan_id=plan.id,
                installment_index=i,
                total_installments=term,
                due_date=due_date,
                principal_amount=period_principal,
                total_installment_amount=period_principal,
                is_billed=False,
            )
            db.add(sched)

        try:
            await db.commit()
            return await InstallmentService.get_by_id(db, plan.id)
        except Exception as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to create installment plan: {str(e)}",
            )

    @staticmethod
    async def early_settle(
        db: AsyncSession,
        plan_id: UUID,
        payload: EarlySettleRequest,
    ) -> EarlySettleResponse:
        """Execute early settlement for an active installment plan via PostgreSQL stored procedure.

        Invokes `fn_early_settle_installment_plan` which:
        1. Identifies remaining unbilled principal balance.
        2. Calculates bank penalty/settlement fee (% or fixed custom fee).
        3. Generates the final lump-sum settlement transaction.
        4. Marks all future installment schedules as billed/settled.
        5. Updates the plan status to SETTLED.

        Args:
            db (AsyncSession): Active asynchronous database session.
            plan_id (UUID): Target installment plan identifier.
            payload (EarlySettleRequest): Settlement parameters (fee %, optional custom fee, statement ID).

        Returns:
            EarlySettleResponse: Settlement execution summary and fees charged.

        Raises:
            HTTPException: 400 Bad Request on procedure execution failure.
        """
        sql = """
        SELECT * FROM fn_early_settle_installment_plan(
            :plan_id,
            :statement_id,
            :fee_percent,
            :custom_fee
        );
        """
        params = {
            "plan_id": str(plan_id),
            "statement_id": str(payload.statement_id) if payload.statement_id else None,
            "fee_percent": float(payload.fee_percent),
            "custom_fee": (
                float(payload.custom_fee) if payload.custom_fee is not None else None
            ),
        }

        try:
            result = await db.execute(text(sql), params)
            row = result.mappings().one()
            await db.commit()
            return EarlySettleResponse(
                plan_id=row["plan_id"],
                product_name=row["product_name"],
                settled_principal=row["settled_principal"],
                early_settlement_fee=row["early_settlement_fee"],
                new_status=InstallmentStatusEnum(row["new_status"]),
            )
        except Exception as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to early settle plan: {str(e)}",
            )

    @staticmethod
    async def get_forecast(db: AsyncSession) -> List[InstallmentForecastRead]:
        """Fetch future monthly installment cashflow obligations from view `v_installment_monthly_forecast`.

        Args:
            db (AsyncSession): Active asynchronous database session.

        Returns:
            List[InstallmentForecastRead]: Monthly forecasted payment principal and fees.
        """
        sql = "SELECT * FROM v_installment_monthly_forecast ORDER BY billing_month ASC;"
        result = await db.execute(text(sql))
        rows = result.mappings().all()
        return [InstallmentForecastRead(**dict(row)) for row in rows]
