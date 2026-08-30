import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import text
from fastapi import HTTPException, status

from app.models.installment import (
    InstallmentPlan,
    InstallmentSchedule,
    InstallmentStatusEnum,
)
from app.schemas.installment import (
    InstallmentPlanCreate,
    EarlySettleRequest,
    EarlySettleResponse,
    InstallmentForecastRead,
)


class InstallmentService:
    @staticmethod
    async def get_all(
        db: AsyncSession,
        account_id: Optional[UUID] = None,
        status_filter: Optional[InstallmentStatusEnum] = None,
    ) -> List[InstallmentPlan]:
        query = (
            select(InstallmentPlan)
            .options(
                selectinload(InstallmentPlan.merchant),
                selectinload(InstallmentPlan.schedules),
            )
        )
        if account_id:
            query = query.where(InstallmentPlan.account_id == account_id)
        if status_filter:
            query = query.where(InstallmentPlan.status == status_filter)

        query = query.order_by(InstallmentPlan.start_date.desc(), InstallmentPlan.created_at.desc())
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def get_by_id(db: AsyncSession, plan_id: UUID) -> InstallmentPlan:
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
    async def create(db: AsyncSession, payload: InstallmentPlanCreate) -> InstallmentPlan:
        term = payload.term_months
        if term <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Term months must be greater than 0",
            )

        tot_amt = payload.total_amount
        base_monthly = round(tot_amt / term, 2)
        accumulated_principal = Decimal("0.00")

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
            if i == term:
                period_principal = round(tot_amt - accumulated_principal, 2)
            else:
                period_principal = base_monthly
                accumulated_principal += period_principal

            due_date = payload.start_date + datetime.timedelta(days=30 * i)

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

        await db.commit()
        return await InstallmentService.get_by_id(db, plan.id)

    @staticmethod
    async def early_settle(
        db: AsyncSession,
        plan_id: UUID,
        payload: EarlySettleRequest,
    ) -> EarlySettleResponse:
        # Call PostgreSQL Stored Function fn_early_settle_installment_plan
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
            "custom_fee": float(payload.custom_fee) if payload.custom_fee is not None else None,
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
        sql = "SELECT * FROM v_installment_monthly_forecast ORDER BY billing_month ASC;"
        result = await db.execute(text(sql))
        rows = result.mappings().all()
        return [InstallmentForecastRead(**dict(row)) for row in rows]
