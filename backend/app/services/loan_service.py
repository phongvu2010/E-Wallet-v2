import calendar
import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.category import Category
from app.models.loan import (
    InterestMethodEnum,
    Loan,
    LoanRateHistory,
    LoanSchedule,
    LoanScheduleStatusEnum,
    LoanStatusEnum,
)
from app.models.transaction import Transaction, TransactionTypeEnum
from app.schemas.loan import (
    AdjustLoanRateRequest,
    EarlySettleLoanRequest,
    LoanCreate,
    LoanSummaryKPIs,
    LoanUpdate,
    PayLoanPeriodRequest,
)


def add_months_to_date(
    base_date: datetime.date, months_to_add: int, target_day: Optional[int] = None
) -> datetime.date:
    """Calculate the target due date after adding `months_to_add` months to `base_date`.

    Safely handles month-end bounds (e.g. Feb 28/29 or April 30) and aligns with the desired target day.
    """
    year = base_date.year + (base_date.month + months_to_add - 1) // 12
    month = (base_date.month + months_to_add - 1) % 12 + 1
    max_days = calendar.monthrange(year, month)[1]
    day = target_day if target_day is not None else base_date.day
    day = min(max(1, day), max_days)
    return datetime.date(year, month, day)


def calculate_equal_installment_pmt(principal: Decimal, annual_rate: Decimal, term_months: int) -> Decimal:
    """Calculate fixed monthly payment (PMT / Equal Monthly Installment / Annuity).
    
    Formula: PMT = P * [r_m * (1 + r_m)^N] / [(1 + r_m)^N - 1]
    where r_m = (annual_rate / 100) / 12
    """
    if term_months <= 0:
        return principal
    if annual_rate <= Decimal("0.00"):
        return round(principal / Decimal(term_months), 2)
    
    r_m = float(annual_rate / Decimal("1200.00"))
    p = float(principal)
    n = term_months
    factor = (1.0 + r_m) ** n
    if factor == 1.0:
        return round(principal / Decimal(term_months), 2)
    pmt = p * (r_m * factor) / (factor - 1.0)
    return Decimal(str(round(pmt, 2)))


class LoanService:
    """Financial Loans Management Service Layer.

    Provides amortized schedule calculation, floating interest rate recalculation,
    periodic payment processing, and loan settlement.
    """

    @staticmethod
    async def get_all(
        db: AsyncSession,
        status_filter: Optional[LoanStatusEnum] = None,
        institution_id: Optional[UUID] = None,
    ) -> List[Loan]:
        """Retrieve all loans with schedules, institutions, and rate history loaded."""
        query = (
            select(Loan)
            .options(
                selectinload(Loan.institution),
                selectinload(Loan.schedules),
                selectinload(Loan.rate_histories),
                selectinload(Loan.account),
            )
            .order_by(Loan.start_date.desc(), Loan.created_at.desc())
        )
        if status_filter:
            query = query.where(Loan.status == status_filter)
        if institution_id:
            query = query.where(Loan.institution_id == institution_id)

        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def get_by_id(db: AsyncSession, loan_id: UUID) -> Loan:
        """Retrieve a specific loan by UUID."""
        query = (
            select(Loan)
            .options(
                selectinload(Loan.institution),
                selectinload(Loan.schedules),
                selectinload(Loan.rate_histories),
                selectinload(Loan.account),
            )
            .where(Loan.id == loan_id)
        )
        result = await db.execute(query)
        loan = result.scalar_one_or_none()
        if not loan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Loan with ID {loan_id} not found",
            )
        return loan

    @staticmethod
    async def create(db: AsyncSession, payload: LoanCreate) -> Loan:
        """Create a financial loan and generate its full periodic amortization schedule."""
        term = payload.term_months
        if term <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Thời hạn vay phải lớn hơn 0 tháng",
            )
        if payload.principal_amount <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Số tiền vay gốc phải lớn hơn 0",
            )

        p0 = payload.principal_amount
        r_annual = payload.current_interest_rate
        monthly_fee = payload.monthly_fee or Decimal("0.00")
        base_monthly_principal = round(p0 / Decimal(term), 0)
        pmt = calculate_equal_installment_pmt(p0, r_annual, term)

        loan = Loan(
            account_id=payload.account_id,
            institution_id=payload.institution_id,
            loan_name=payload.loan_name.strip(),
            loan_code=payload.loan_code.strip() if payload.loan_code else None,
            loan_type=payload.loan_type,
            interest_method=payload.interest_method,
            principal_amount=p0,
            term_months=term,
            start_date=payload.start_date,
            billing_day_of_month=payload.billing_day_of_month,
            current_interest_rate=r_annual,
            base_rate=payload.base_rate or Decimal("0.00"),
            floating_margin=payload.floating_margin or Decimal("0.00"),
            monthly_fee=monthly_fee,
            remaining_principal=p0,
            total_paid_principal=Decimal("0.00"),
            total_paid_interest=Decimal("0.00"),
            total_projected_interest=Decimal("0.00"),
            status=LoanStatusEnum.ACTIVE,
            note=payload.note.strip() if payload.note else None,
        )
        db.add(loan)
        await db.flush()

        # Generate Amortization Schedule
        current_balance = p0
        total_projected_interest = Decimal("0.00")

        for i in range(1, term + 1):
            beginning_bal = current_balance
            due_date = add_months_to_date(
                payload.start_date, i, payload.billing_day_of_month
            )

            if payload.interest_method == InterestMethodEnum.EQUAL_INSTALLMENT:
                # Phương thức Trả góp đều (Niên kim cố định / PMT / EMI)
                # Tiền lãi mỗi tháng theo chuẩn ngân hàng: Dư nợ đầu * (r / 1200)
                period_interest = round(beginning_bal * (r_annual / Decimal("1200.00")), 0)
                if i == term:
                    # Kỳ cuối cùng hấp thụ toàn bộ số dư gốc còn lại để dư nợ về 0 đ
                    period_principal = beginning_bal
                else:
                    period_principal = min(beginning_bal, max(Decimal("0.00"), round(pmt - period_interest, 0)))
                total_payment = period_principal + period_interest + monthly_fee
                ending_bal = max(Decimal("0.00"), round(beginning_bal - period_principal, 0))
            elif payload.interest_method == InterestMethodEnum.FLAT:
                # Phương thức Lãi phẳng cố định trên gốc ban đầu
                period_principal = beginning_bal if i == term else min(beginning_bal, base_monthly_principal)
                period_interest = round(p0 * (r_annual / Decimal("1200.00")), 0)
                total_payment = period_principal + period_interest + monthly_fee
                ending_bal = max(Decimal("0.00"), round(beginning_bal - period_principal, 0))
            else:
                # Phương thức Dư nợ giảm dần - Gốc chia đều hàng tháng (REDUCING_BALANCE)
                period_principal = beginning_bal if i == term else min(beginning_bal, base_monthly_principal)
                period_interest = round(beginning_bal * (r_annual / Decimal("1200.00")), 0)
                total_payment = period_principal + period_interest + monthly_fee
                ending_bal = max(Decimal("0.00"), round(beginning_bal - period_principal, 0))

            current_balance = ending_bal
            total_projected_interest += period_interest

            schedule = LoanSchedule(
                loan_id=loan.id,
                period_index=i,
                total_periods=term,
                due_date=due_date,
                applied_interest_rate=r_annual,
                beginning_balance=beginning_bal,
                principal_amount=period_principal,
                interest_amount=period_interest,
                monthly_fee=monthly_fee,
                total_payment=total_payment,
                ending_balance=ending_bal,
                status=LoanScheduleStatusEnum.UNPAID,
            )
            db.add(schedule)

        loan.total_projected_interest = total_projected_interest

        # Initial rate history record
        init_history = LoanRateHistory(
            loan_id=loan.id,
            old_rate=r_annual,
            new_rate=r_annual,
            old_monthly_fee=monthly_fee,
            new_monthly_fee=monthly_fee,
            effective_from_period=1,
            effective_date=payload.start_date,
            reason="Lãi suất ban đầu khi giải ngân",
        )
        db.add(init_history)

        try:
            await db.commit()
            return await LoanService.get_by_id(db, loan.id)
        except Exception as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Không thể tạo gói vay: {str(e)}",
            )

    @staticmethod
    async def update(
        db: AsyncSession, loan_id: UUID, payload: LoanUpdate
    ) -> Loan:
        """Update loan metadata."""
        loan = await LoanService.get_by_id(db, loan_id)

        update_data = payload.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(loan, field, value)

        try:
            await db.commit()
            return await LoanService.get_by_id(db, loan.id)
        except Exception as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Không thể cập nhật gói vay: {str(e)}",
            )

    @staticmethod
    async def adjust_floating_rate(
        db: AsyncSession, loan_id: UUID, payload: AdjustLoanRateRequest
    ) -> Loan:
        """Adjust floating interest rate and/or monthly fee for all remaining unpaid periods.

        Preserves historical amounts for paid periods, recalculates interest for future periods,
        updates projected total interest, and logs the rate change history.
        """
        loan = await LoanService.get_by_id(db, loan_id)
        if loan.status != LoanStatusEnum.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Chỉ có thể điều chỉnh lãi suất cho gói vay đang hoạt động (ACTIVE). Trạng thái hiện tại: {loan.status}",
            )

        eff_period = payload.effective_from_period
        if eff_period < 1 or eff_period > loan.term_months:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Kỳ áp dụng {eff_period} không hợp lệ (Tổng số kỳ: {loan.term_months})",
            )

        old_rate = loan.current_interest_rate
        new_rate = payload.new_interest_rate
        old_monthly_fee = loan.monthly_fee or Decimal("0.00")
        new_monthly_fee = payload.new_monthly_fee if payload.new_monthly_fee is not None else old_monthly_fee
        eff_date = payload.effective_date or datetime.date.today()

        # Recalculate unpaid periods from eff_period onwards
        schedules_query = (
            select(LoanSchedule)
            .where(LoanSchedule.loan_id == loan.id)
            .order_by(LoanSchedule.period_index.asc())
        )
        schedules_res = await db.execute(schedules_query)
        all_schedules = schedules_res.scalars().all()

        unpaid_to_recalc = [
            s for s in all_schedules
            if s.period_index >= eff_period and s.status == LoanScheduleStatusEnum.UNPAID
        ]

        if unpaid_to_recalc:
            if loan.interest_method == InterestMethodEnum.EQUAL_INSTALLMENT:
                # Recalculate new PMT for remaining unpaid periods
                first_unpaid = unpaid_to_recalc[0]
                rem_bal = first_unpaid.beginning_balance
                rem_term = len(unpaid_to_recalc)
                new_pmt = calculate_equal_installment_pmt(rem_bal, new_rate, rem_term)

                cur_b = rem_bal
                for idx, s in enumerate(unpaid_to_recalc):
                    s.applied_interest_rate = new_rate
                    s.monthly_fee = new_monthly_fee
                    s.beginning_balance = cur_b

                    # Standard monthly interest: cur_b * (new_rate / 1200)
                    period_interest = round(cur_b * (new_rate / Decimal("1200.00")), 0)
                    s.interest_amount = period_interest

                    if idx == len(unpaid_to_recalc) - 1:
                        # Final unpaid period absorbs remaining balance
                        s.principal_amount = cur_b
                    else:
                        s.principal_amount = min(cur_b, max(Decimal("0.00"), round(new_pmt - period_interest, 0)))

                    s.total_payment = s.principal_amount + s.interest_amount + new_monthly_fee
                    s.ending_balance = max(Decimal("0.00"), round(cur_b - s.principal_amount, 0))
                    cur_b = s.ending_balance
            elif loan.interest_method == InterestMethodEnum.FLAT:
                for s in unpaid_to_recalc:
                    s.applied_interest_rate = new_rate
                    s.monthly_fee = new_monthly_fee
                    s.interest_amount = round(loan.principal_amount * (new_rate / Decimal("1200.00")), 0)
                    s.total_payment = s.principal_amount + s.interest_amount + new_monthly_fee
            else:  # REDUCING_BALANCE
                for s in unpaid_to_recalc:
                    s.applied_interest_rate = new_rate
                    s.monthly_fee = new_monthly_fee
                    s.interest_amount = round(s.beginning_balance * (new_rate / Decimal("1200.00")), 0)
                    s.total_payment = s.principal_amount + s.interest_amount + new_monthly_fee

        # Recalculate loan total projected interest
        new_projected_interest = loan.total_paid_interest + sum(
            s.interest_amount for s in all_schedules if s.status != LoanScheduleStatusEnum.PAID
        )

        loan.current_interest_rate = new_rate
        loan.monthly_fee = new_monthly_fee
        loan.total_projected_interest = new_projected_interest

        # Log rate history
        rate_history = LoanRateHistory(
            loan_id=loan.id,
            old_rate=old_rate,
            new_rate=new_rate,
            old_monthly_fee=old_monthly_fee,
            new_monthly_fee=new_monthly_fee,
            effective_from_period=eff_period,
            effective_date=eff_date,
            reason=payload.reason.strip() if payload.reason else "Điều chỉnh lãi suất thả nổi định kỳ",
        )
        db.add(rate_history)

        try:
            await db.commit()
            return await LoanService.get_by_id(db, loan.id)
        except Exception as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Lỗi khi điều chỉnh lãi suất: {str(e)}",
            )

    @staticmethod
    async def pay_period(
        db: AsyncSession, loan_id: UUID, payload: PayLoanPeriodRequest
    ) -> Loan:
        """Process a periodic loan payment. Marks the period as PAID and updates remaining principal."""
        loan = await LoanService.get_by_id(db, loan_id)

        sched_query = select(LoanSchedule).where(
            LoanSchedule.loan_id == loan.id,
            LoanSchedule.period_index == payload.period_index,
        )
        sched_res = await db.execute(sched_query)
        schedule = sched_res.scalar_one_or_none()

        if not schedule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy kỳ trả nợ số {payload.period_index}",
            )
        if schedule.status == LoanScheduleStatusEnum.PAID:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Kỳ số {payload.period_index} đã được thanh toán trước đó",
            )

        paid_amount = payload.paid_amount or schedule.total_payment
        paid_date = payload.paid_date or datetime.date.today()

        schedule.status = LoanScheduleStatusEnum.PAID
        schedule.paid_date = paid_date
        schedule.paid_amount = paid_amount

        # Create repayment transaction if source account is provided
        if payload.payment_account_id:
            # Find category for loan repayment
            cat_query = select(Category).where(
                Category.name.ilike("%thanh toán%") | Category.name.ilike("%chuyển tiền%")
            ).limit(1)
            cat_res = await db.execute(cat_query)
            cat = cat_res.scalar_one_or_none()

            tx = Transaction(
                account_id=payload.payment_account_id,
                category_id=cat.id if cat else None,
                transaction_date=paid_date,
                post_date=paid_date,
                raw_description=f"Thanh toán nợ vay kỳ {schedule.period_index}/{schedule.total_periods} - {loan.loan_name}",
                transaction_type=TransactionTypeEnum.REPAYMENT,
                amount=-abs(schedule.principal_amount),
                fee=schedule.interest_amount,
                total_amount=-abs(paid_amount),
                note=payload.note or f"Gốc: {schedule.principal_amount:,.0f} ₫, Lãi: {schedule.interest_amount:,.0f} ₫ (LS: {schedule.applied_interest_rate}%)",
            )
            db.add(tx)
            await db.flush()
            schedule.transaction_id = tx.id

        # Update loan running balances
        loan.total_paid_principal += schedule.principal_amount
        loan.total_paid_interest += schedule.interest_amount
        loan.remaining_principal = max(
            Decimal("0.00"), loan.remaining_principal - schedule.principal_amount
        )

        # Check if all schedules are paid
        scheds_unpaid_query = select(func.count(LoanSchedule.id)).where(
            LoanSchedule.loan_id == loan.id,
            LoanSchedule.status != LoanScheduleStatusEnum.PAID,
        )
        unpaid_count_res = await db.execute(scheds_unpaid_query)
        unpaid_count = unpaid_count_res.scalar_one()

        if unpaid_count == 0 or loan.remaining_principal <= Decimal("0.00"):
            loan.status = LoanStatusEnum.PAID_OFF

        await db.commit()
        return await LoanService.get_by_id(db, loan.id)

    @staticmethod
    async def early_settle(
        db: AsyncSession, loan_id: UUID, payload: EarlySettleLoanRequest
    ) -> Loan:
        """Execute full early loan settlement, waiving future interest and charging optional penalty fee."""
        loan = await LoanService.get_by_id(db, loan_id)
        if loan.status != LoanStatusEnum.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Chỉ có thể tất toán gói vay đang hoạt động (ACTIVE)",
            )

        settle_principal = loan.remaining_principal
        if settle_principal <= Decimal("0.00"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Gói vay đã hết dư nợ gốc cần thanh toán",
            )

        # Calculate penalty fee
        if payload.custom_fee is not None:
            penalty_fee = payload.custom_fee
        elif payload.fee_percent > Decimal("0.00"):
            penalty_fee = round(
                settle_principal * (payload.fee_percent / Decimal("100.00")), 2
            )
        else:
            penalty_fee = Decimal("0.00")

        settle_date = payload.settlement_date or datetime.date.today()
        total_settle_amount = settle_principal + penalty_fee

        # Mark all unpaid schedules as paid with waived interest
        schedules_query = select(LoanSchedule).where(
            LoanSchedule.loan_id == loan.id,
            LoanSchedule.status != LoanScheduleStatusEnum.PAID,
        )
        schedules_res = await db.execute(schedules_query)
        unpaid_schedules = schedules_res.scalars().all()

        for s in unpaid_schedules:
            s.status = LoanScheduleStatusEnum.PAID
            s.paid_date = settle_date
            s.paid_amount = s.principal_amount
            s.interest_amount = Decimal("0.00")  # Waived future interest
            s.total_payment = s.principal_amount

        # Create settlement transaction if source account is provided
        if payload.settlement_account_id:
            tx = Transaction(
                account_id=payload.settlement_account_id,
                transaction_date=settle_date,
                post_date=settle_date,
                raw_description=f"Tất toán trước hạn toàn bộ gói vay: {loan.loan_name}",
                transaction_type=TransactionTypeEnum.REPAYMENT,
                amount=-abs(settle_principal),
                fee=penalty_fee,
                total_amount=-abs(total_settle_amount),
                note=f"Tất toán gốc còn lại: {settle_principal:,.0f} ₫, Phí phạt trước hạn: {penalty_fee:,.0f} ₫",
            )
            db.add(tx)

        loan.total_paid_principal += settle_principal
        loan.remaining_principal = Decimal("0.00")
        loan.status = LoanStatusEnum.PAID_OFF
        loan.total_projected_interest = loan.total_paid_interest

        await db.commit()
        return await LoanService.get_by_id(db, loan.id)

    @staticmethod
    async def delete(db: AsyncSession, loan_id: UUID) -> bool:
        """Delete a loan and cascade all schedules and history."""
        loan = await LoanService.get_by_id(db, loan_id)
        await db.delete(loan)
        await db.commit()
        return True

    @staticmethod
    async def get_summary_kpis(db: AsyncSession) -> LoanSummaryKPIs:
        """Calculate high-level summary KPIs across all active loans."""
        loans_query = select(Loan).where(Loan.status == LoanStatusEnum.ACTIVE)
        loans_res = await db.execute(loans_query)
        active_loans = loans_res.scalars().all()

        total_active_loans = len(active_loans)
        total_remaining_principal = sum((l.remaining_principal for l in active_loans), Decimal("0.00"))
        total_paid_principal = sum((l.total_paid_principal for l in active_loans), Decimal("0.00"))
        total_paid_interest = sum((l.total_paid_interest for l in active_loans), Decimal("0.00"))

        # Due this month
        today = datetime.date.today()
        first_day_of_month = datetime.date(today.year, today.month, 1)
        next_month = today.month + 1 if today.month < 12 else 1
        next_year = today.year if today.month < 12 else today.year + 1
        last_day_of_month = datetime.date(next_year, next_month, 1) - datetime.timedelta(days=1)

        sched_due_query = select(LoanSchedule).join(Loan).where(
            Loan.status == LoanStatusEnum.ACTIVE,
            LoanSchedule.status == LoanScheduleStatusEnum.UNPAID,
            LoanSchedule.due_date >= first_day_of_month,
            LoanSchedule.due_date <= last_day_of_month,
        )
        sched_due_res = await db.execute(sched_due_query)
        due_schedules = sched_due_res.scalars().all()

        due_this_month_amount = sum((s.total_payment for s in due_schedules), Decimal("0.00"))
        due_this_month_count = len(due_schedules)

        return LoanSummaryKPIs(
            total_active_loans=total_active_loans,
            total_remaining_principal=total_remaining_principal,
            total_paid_interest=total_paid_interest,
            total_paid_principal=total_paid_principal,
            due_this_month_amount=due_this_month_amount,
            due_this_month_count=due_this_month_count,
        )
