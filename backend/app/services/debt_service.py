import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.category import Category, CategoryTypeEnum
from app.models.debt import Debt, DebtRepayment, DebtStatusEnum, DebtTypeEnum
from app.models.transaction import Transaction, TransactionTypeEnum
from app.schemas.debt import (
    DebtCreate,
    DebtRead,
    DebtRepaymentCreate,
    DebtRepaymentRead,
    DebtSummaryKPIs,
    DebtUpdate,
)


class DebtService:
    """Business service layer for Personal Debts & Peer-to-Peer Informal Borrowing/Lending."""

    @staticmethod
    def _serialize_debt(debt: Debt) -> DebtRead:
        """Convert Debt ORM instance with loaded relationships into Pydantic DebtRead schema."""
        repayments_read = []
        for r in debt.repayments:
            repayments_read.append(
                DebtRepaymentRead(
                    id=r.id,
                    debt_id=r.debt_id,
                    account_id=r.account_id,
                    account_name=r.account.account_name if r.account else None,
                    account_bank_name=(
                        r.account.institution.name
                        if r.account and r.account.institution
                        else None
                    ),
                    repayment_date=r.repayment_date,
                    principal_paid=r.principal_paid,
                    extra_amount=r.extra_amount,
                    total_amount=r.total_amount,
                    transaction_id=r.transaction_id,
                    extra_transaction_id=r.extra_transaction_id,
                    note=r.note,
                    created_at=r.created_at,
                )
            )

        return DebtRead(
            id=debt.id,
            user_id=debt.user_id,
            account_id=debt.account_id,
            account_name=debt.account.account_name if debt.account else None,
            account_bank_name=(
                debt.account.institution.name
                if debt.account and debt.account.institution
                else None
            ),
            counterparty_name=debt.counterparty_name,
            counterparty_phone=debt.counterparty_phone,
            debt_type=debt.debt_type,
            principal_amount=debt.principal_amount,
            remaining_amount=debt.remaining_amount,
            total_paid_principal=debt.total_paid_principal,
            total_extra_amount=debt.total_extra_amount,
            start_date=debt.start_date,
            due_date=debt.due_date,
            status=debt.status,
            note=debt.note,
            created_at=debt.created_at,
            updated_at=debt.updated_at,
            repayments=repayments_read,
        )

    @staticmethod
    async def get_all(
        db: AsyncSession,
        debt_type: Optional[DebtTypeEnum] = None,
        status_filter: Optional[DebtStatusEnum] = None,
        search: Optional[str] = None,
    ) -> List[DebtRead]:
        """Fetch all personal debts matching filters."""
        query = (
            select(Debt)
            .options(
                selectinload(Debt.account),
                selectinload(Debt.repayments).selectinload(DebtRepayment.account),
            )
            .order_by(
                # ACTIVE debts first, then latest start_date
                Debt.status.asc(),
                Debt.start_date.desc(),
                Debt.created_at.desc(),
            )
        )
        if debt_type:
            query = query.where(Debt.debt_type == debt_type)
        if status_filter:
            query = query.where(Debt.status == status_filter)
        if search:
            query = query.where(Debt.counterparty_name.ilike(f"%{search.strip()}%"))

        result = await db.execute(query)
        debts = result.scalars().all()
        return [DebtService._serialize_debt(d) for d in debts]

    @staticmethod
    async def get_by_id(db: AsyncSession, debt_id: UUID) -> DebtRead:
        """Fetch a specific debt by UUID with full repayment history."""
        query = (
            select(Debt)
            .options(
                selectinload(Debt.account),
                selectinload(Debt.repayments).selectinload(DebtRepayment.account),
            )
            .where(Debt.id == debt_id)
        )
        result = await db.execute(query)
        debt = result.scalar_one_or_none()
        if not debt:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Khoản nợ với ID {debt_id} không tồn tại",
            )
        return DebtService._serialize_debt(debt)

    @staticmethod
    async def get_kpis(db: AsyncSession) -> DebtSummaryKPIs:
        """Calculate aggregated summary KPIs for Borrowing (Đi vay) and Lending (Cho vay)."""
        query = select(Debt)
        result = await db.execute(query)
        all_debts = result.scalars().all()

        kpis = DebtSummaryKPIs()
        for d in all_debts:
            if d.debt_type == DebtTypeEnum.BORROW:
                kpis.total_borrow_count += 1
                kpis.total_borrow_principal += d.principal_amount
                if d.status == DebtStatusEnum.ACTIVE:
                    kpis.total_borrow_remaining += d.remaining_amount
                kpis.total_borrow_paid += d.total_paid_principal
                kpis.total_borrow_extra_paid += d.total_extra_amount
            elif d.debt_type == DebtTypeEnum.LEND:
                kpis.total_lend_count += 1
                kpis.total_lend_principal += d.principal_amount
                if d.status == DebtStatusEnum.ACTIVE:
                    kpis.total_lend_remaining += d.remaining_amount
                kpis.total_lend_collected += d.total_paid_principal
                kpis.total_lend_extra_received += d.total_extra_amount

        return kpis

    @staticmethod
    async def create(db: AsyncSession, payload: DebtCreate) -> DebtRead:
        """Create a new debt record and automatically log the initial cash inflow/outflow transaction."""
        p0 = payload.principal_amount
        if p0 <= Decimal("0.00"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Số tiền gốc vay/mượn phải lớn hơn 0",
            )

        debt = Debt(
            counterparty_name=payload.counterparty_name.strip(),
            counterparty_phone=payload.counterparty_phone.strip() if payload.counterparty_phone else None,
            debt_type=payload.debt_type,
            principal_amount=p0,
            remaining_amount=p0,
            total_paid_principal=Decimal("0.00"),
            total_extra_amount=Decimal("0.00"),
            start_date=payload.start_date,
            due_date=payload.due_date,
            account_id=payload.account_id,
            status=DebtStatusEnum.ACTIVE,
            note=payload.note.strip() if payload.note else None,
        )
        db.add(debt)
        await db.flush()

        # Automatically create the initial transaction if an account is selected
        if payload.account_id:
            if payload.debt_type == DebtTypeEnum.BORROW:
                # Tiền đi vay nhận về ví/tài khoản (+Asset Inflow)
                tx_init = Transaction(
                    account_id=payload.account_id,
                    transaction_date=payload.start_date,
                    post_date=payload.start_date,
                    transaction_type=TransactionTypeEnum.DEBT_BORROW,
                    amount=p0,
                    fee=Decimal("0.00"),
                    total_amount=p0,
                    raw_description=f"Nhận tiền vay: {payload.counterparty_name.strip()}",
                    note=payload.note or f"Vay mượn từ {payload.counterparty_name.strip()}",
                )
            else:
                # Tiền xuất ra cho bạn bè vay mượn (-Asset Outflow)
                tx_init = Transaction(
                    account_id=payload.account_id,
                    transaction_date=payload.start_date,
                    post_date=payload.start_date,
                    transaction_type=TransactionTypeEnum.DEBT_LEND,
                    amount=p0,
                    fee=Decimal("0.00"),
                    total_amount=p0,
                    raw_description=f"Cho vay tiền: {payload.counterparty_name.strip()}",
                    note=payload.note or f"Cho {payload.counterparty_name.strip()} vay tiền",
                )
            db.add(tx_init)

        try:
            await db.commit()
            return await DebtService.get_by_id(db, debt.id)
        except Exception as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Lỗi khi tạo khoản nợ: {str(e)}",
            )

    @staticmethod
    async def update(db: AsyncSession, debt_id: UUID, payload: DebtUpdate) -> DebtRead:
        """Update metadata of a debt record."""
        query = select(Debt).where(Debt.id == debt_id)
        result = await db.execute(query)
        debt = result.scalar_one_or_none()
        if not debt:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Khoản nợ với ID {debt_id} không tồn tại",
            )

        if payload.counterparty_name is not None:
            debt.counterparty_name = payload.counterparty_name.strip()
        if payload.counterparty_phone is not None:
            debt.counterparty_phone = payload.counterparty_phone.strip() if payload.counterparty_phone else None
        if payload.due_date is not None:
            debt.due_date = payload.due_date
        if payload.status is not None:
            debt.status = payload.status
        if payload.note is not None:
            debt.note = payload.note.strip() if payload.note else None

        debt.updated_at = datetime.datetime.now(datetime.timezone.utc)

        try:
            await db.commit()
            return await DebtService.get_by_id(db, debt.id)
        except Exception as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Lỗi khi cập nhật khoản nợ: {str(e)}",
            )

    @staticmethod
    async def record_repayment(
        db: AsyncSession, debt_id: UUID, payload: DebtRepaymentCreate
    ) -> DebtRead:
        """Record a partial or full repayment, handling extra appreciation / tip amounts separately."""
        query = select(Debt).where(Debt.id == debt_id)
        result = await db.execute(query)
        debt = result.scalar_one_or_none()
        if not debt:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Khoản nợ với ID {debt_id} không tồn tại",
            )

        if debt.status != DebtStatusEnum.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Khoản nợ này không ở trạng thái ACTIVE (Hiện tại: {debt.status.value})",
            )

        principal_paid = payload.principal_paid
        extra_amount = payload.extra_amount or Decimal("0.00")

        if principal_paid <= Decimal("0.00"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Số tiền gốc trả/thu phải lớn hơn 0",
            )

        if principal_paid > debt.remaining_amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Số tiền gốc trả ({principal_paid:,.0f}đ) vượt quá dư nợ còn lại ({debt.remaining_amount:,.0f}đ). Vui lòng điền phần trả dư vào ô 'Tiền bồi dưỡng / Cảm ơn'!",
            )

        total_paid_this_time = principal_paid + extra_amount
        acc_id = payload.account_id or debt.account_id

        # 1. Transaction cho phần nợ gốc (Principal)
        tx_principal = None
        if acc_id:
            if debt.debt_type == DebtTypeEnum.BORROW:
                # Tôi trả nợ cho bạn -> Trích tiền khỏi tài khoản (-Asset Outflow, không tính vào Expense P&L)
                tx_principal = Transaction(
                    account_id=acc_id,
                    transaction_date=payload.repayment_date,
                    post_date=payload.repayment_date,
                    transaction_type=TransactionTypeEnum.DEBT_REPAY,
                    amount=principal_paid,
                    fee=Decimal("0.00"),
                    total_amount=principal_paid,
                    raw_description=f"Trả nợ gốc: {debt.counterparty_name}",
                    note=payload.note or f"Trả nợ gốc cho {debt.counterparty_name}",
                )
            else:
                # Bạn trả nợ cho tôi -> Tiền vào tài khoản (+Asset Inflow, không tính vào Income P&L)
                tx_principal = Transaction(
                    account_id=acc_id,
                    transaction_date=payload.repayment_date,
                    post_date=payload.repayment_date,
                    transaction_type=TransactionTypeEnum.DEBT_COLLECT,
                    amount=principal_paid,
                    fee=Decimal("0.00"),
                    total_amount=-principal_paid,  # Negative sign convention for DEBT_COLLECT credit
                    raw_description=f"Thu hồi nợ gốc: {debt.counterparty_name}",
                    note=payload.note or f"Thu hồi nợ gốc từ {debt.counterparty_name}",
                )
            db.add(tx_principal)
            await db.flush()

        # 2. Transaction cho phần tiền bồi dưỡng / cảm ơn (Extra / Tip - nếu có)
        tx_extra = None
        if acc_id and extra_amount > Decimal("0.00"):
            # Tìm danh mục phù hợp
            cat_id = payload.extra_category_id
            if not cat_id:
                if debt.debt_type == DebtTypeEnum.BORROW:
                    # Tìm danh mục "Chi tiêu khác" hoặc "Quà tặng"
                    cat_stmt = select(Category.id).where(
                        Category.category_type == CategoryTypeEnum.EXPENSE
                    ).order_by(Category.name.asc()).limit(1)
                    res_cat = await db.execute(cat_stmt)
                    cat_id = res_cat.scalar_one_or_none()
                else:
                    # Tìm danh mục "Thu nhập khác"
                    cat_stmt = select(Category.id).where(
                        Category.category_type == CategoryTypeEnum.INCOME
                    ).order_by(Category.name.asc()).limit(1)
                    res_cat = await db.execute(cat_stmt)
                    cat_id = res_cat.scalar_one_or_none()

            if debt.debt_type == DebtTypeEnum.BORROW:
                # Tiền trả thêm cảm ơn người cho vay -> Là CHI TIÊU THỰC TẾ (Expense)
                tx_extra = Transaction(
                    account_id=acc_id,
                    category_id=cat_id,
                    transaction_date=payload.repayment_date,
                    post_date=payload.repayment_date,
                    transaction_type=TransactionTypeEnum.PURCHASE,
                    amount=extra_amount,
                    fee=Decimal("0.00"),
                    total_amount=extra_amount,
                    raw_description=f"Tiền bồi dưỡng / cảm ơn khi trả nợ: {debt.counterparty_name}",
                    note=f"Tiền bồi dưỡng cảm ơn {debt.counterparty_name} (Khoản vay {debt.principal_amount:,.0f}đ)",
                )
            else:
                # Tiền cảm ơn / cà phê nhận thêm từ người vay -> Là THU NHẬP THỰC TẾ (Income)
                tx_extra = Transaction(
                    account_id=acc_id,
                    category_id=cat_id,
                    transaction_date=payload.repayment_date,
                    post_date=payload.repayment_date,
                    transaction_type=TransactionTypeEnum.INCOME,
                    amount=extra_amount,
                    fee=Decimal("0.00"),
                    total_amount=extra_amount,
                    raw_description=f"Tiền bồi dưỡng / cảm ơn nhận được: {debt.counterparty_name}",
                    note=f"Tiền cảm ơn nhận từ {debt.counterparty_name} (Khoản cho vay {debt.principal_amount:,.0f}đ)",
                )
            db.add(tx_extra)
            await db.flush()

        # 3. Tạo bản ghi DebtRepayment
        repayment = DebtRepayment(
            debt_id=debt.id,
            account_id=acc_id,
            repayment_date=payload.repayment_date,
            principal_paid=principal_paid,
            extra_amount=extra_amount,
            total_amount=total_paid_this_time,
            transaction_id=tx_principal.id if tx_principal else None,
            extra_transaction_id=tx_extra.id if tx_extra else None,
            note=payload.note.strip() if payload.note else None,
        )
        db.add(repayment)

        # 4. Cập nhật dư nợ và trạng thái khoản nợ
        new_remaining = max(Decimal("0.00"), debt.remaining_amount - principal_paid)
        debt.remaining_amount = new_remaining
        debt.total_paid_principal += principal_paid
        debt.total_extra_amount += extra_amount

        if new_remaining <= Decimal("0.00"):
            debt.status = DebtStatusEnum.PAID_OFF

        debt.updated_at = datetime.datetime.now(datetime.timezone.utc)

        try:
            await db.commit()
            return await DebtService.get_by_id(db, debt.id)
        except Exception as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Lỗi khi ghi nhận trả nợ: {str(e)}",
            )

    @staticmethod
    async def delete(db: AsyncSession, debt_id: UUID) -> bool:
        """Delete a debt record and all its associated repayments."""
        query = select(Debt).where(Debt.id == debt_id)
        result = await db.execute(query)
        debt = result.scalar_one_or_none()
        if not debt:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Khoản nợ với ID {debt_id} không tồn tại",
            )

        await db.delete(debt)
        try:
            await db.commit()
            return True
        except Exception as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Lỗi khi xóa khoản nợ: {str(e)}",
            )
