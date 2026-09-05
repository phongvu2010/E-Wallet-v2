from decimal import Decimal
from typing import List, Optional, Tuple
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, or_, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.models.account import Account
from app.models.category import Category
from app.models.installment import (
    InstallmentPlan,
    InstallmentSchedule,
    InstallmentStatusEnum,
)
from app.models.merchant import Merchant
from app.models.transaction import Transaction, TransactionTypeEnum
from app.schemas.common import PaginationParams
from app.schemas.transaction import (
    TransactionCreate,
    TransactionFilterParams,
    TransactionSummaryRead,
    TransactionUpdate,
)
from app.services.installment_service import add_months_to_date


class TransactionService:
    """Service layer managing ledger Transactions.

    Enforces sign convention rules (Credit vs Debit transactions), multi-criteria filtering,
    pagination, deduplication, and financial summary calculation.
    """

    @staticmethod
    async def get_filtered(
        db: AsyncSession,
        filter_params: TransactionFilterParams,
        pagination: PaginationParams,
    ) -> Tuple[List[Transaction], int]:
        """Query transactions with dynamic filtering criteria and pagination.

        Supports filtering by account, statement, category, merchant, transaction type,
        date range, amount range, installment flag, and keyword search across descriptions/notes.

        Args:
            db (AsyncSession): Active asynchronous database session.
            filter_params (TransactionFilterParams): Search and filter parameters.
            pagination (PaginationParams): Limit and offset configuration.

        Returns:
            Tuple[List[Transaction], int]: Tuple containing the list of matching transactions and total count.
        """
        query = select(Transaction).options(
            selectinload(Transaction.category),
            selectinload(Transaction.merchant),
            selectinload(Transaction.installment_plan),
        )

        conditions = []

        if filter_params.account_id:
            conditions.append(Transaction.account_id == filter_params.account_id)
        if filter_params.statement_id:
            conditions.append(Transaction.statement_id == filter_params.statement_id)
        if filter_params.category_id:
            conditions.append(
                or_(
                    Transaction.category_id == filter_params.category_id,
                    Transaction.category.has(Category.parent_id == filter_params.category_id),
                )
            )
        if filter_params.merchant_id:
            conditions.append(Transaction.merchant_id == filter_params.merchant_id)
        if filter_params.transaction_type:
            conditions.append(
                Transaction.transaction_type == filter_params.transaction_type
            )
        if filter_params.start_date:
            conditions.append(Transaction.transaction_date >= filter_params.start_date)
        if filter_params.end_date:
            conditions.append(Transaction.transaction_date <= filter_params.end_date)
        if filter_params.is_installment is not None:
            conditions.append(
                Transaction.is_installment == filter_params.is_installment
            )
        if filter_params.min_amount is not None:
            conditions.append(
                func.abs(Transaction.total_amount) >= filter_params.min_amount
            )
        if filter_params.max_amount is not None:
            conditions.append(
                func.abs(Transaction.total_amount) <= filter_params.max_amount
            )
        if filter_params.search:
            search_pattern = f"%{filter_params.search}%"
            conditions.append(
                or_(
                    Transaction.raw_description.ilike(search_pattern),
                    Transaction.note.ilike(search_pattern),
                )
            )

        if conditions:
            query = query.where(*conditions)

        # Count total records
        count_query = select(func.count()).select_from(query.subquery())
        total_count = await db.scalar(count_query) or 0

        # Pagination & Ordering
        query = query.order_by(
            Transaction.transaction_date.desc(), Transaction.created_at.desc()
        )
        query = query.offset(pagination.offset).limit(pagination.page_size)

        result = await db.execute(query)
        transactions = result.scalars().all()

        return transactions, total_count

    @staticmethod
    async def get_by_id(db: AsyncSession, transaction_id: UUID) -> Transaction:
        """Fetch a single transaction with all relational metadata loaded.

        Args:
            db (AsyncSession): Active asynchronous database session.
            transaction_id (UUID): Primary transaction identifier.

        Returns:
            Transaction: Transaction instance with category, merchant, account, and statement.

        Raises:
            HTTPException: 404 Not Found if transaction does not exist.
        """
        query = (
            select(Transaction)
            .options(
                selectinload(Transaction.category),
                selectinload(Transaction.merchant),
                selectinload(Transaction.account),
                selectinload(Transaction.statement),
                selectinload(Transaction.installment_plan),
            )
            .where(Transaction.id == transaction_id)
        )
        result = await db.execute(query)
        tx = result.scalar_one_or_none()
        if not tx:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Transaction with ID {transaction_id} not found",
            )
        return tx

    @staticmethod
    async def _resolve_default_category_for_type(
        db: AsyncSession,
        tx_type: TransactionTypeEnum,
        current_category_id: Optional[UUID],
    ) -> Optional[UUID]:
        """Auto-resolve default Category ID based on transaction type if not explicitly supplied."""
        if current_category_id:
            return current_category_id

        target_names = []
        if tx_type == TransactionTypeEnum.INCOME:
            target_names = ["Lương & Thu nhập", "Thu nhập", "Lương", "Thưởng", "Thu nhập khác"]
        elif tx_type == TransactionTypeEnum.TRANSFER:
            target_names = ["Chuyển khoản", "Chuyển tiền", "Thanh toán"]
        elif tx_type == TransactionTypeEnum.REPAYMENT:
            target_names = ["Thanh toán dư nợ", "Thanh toán"]
        elif tx_type == TransactionTypeEnum.INSTALLMENT_MONTHLY:
            target_names = ["Trả góp"]
        elif tx_type == TransactionTypeEnum.INSTALLMENT_PRINCIPAL:
            target_names = ["Chuyển đổi sang trả góp"]
        elif tx_type == TransactionTypeEnum.INTEREST:
            target_names = ["Lãi suất"]
        elif tx_type == TransactionTypeEnum.FEE:
            target_names = ["Phí thường niên", "Phí SMS", "Phí & Lãi"]
        elif tx_type == TransactionTypeEnum.CASHBACK_CREDIT:
            target_names = ["Hoàn tiền Cashback", "Hoàn tiền"]
        elif tx_type == TransactionTypeEnum.REFUND:
            target_names = ["Hủy giao dịch"]
        elif tx_type == TransactionTypeEnum.PURCHASE:
            target_names = ["Chi tiêu khác", "Chi tiêu"]

        for name in target_names:
            cat_res = await db.execute(
                select(Category.id).where(Category.name == name).limit(1)
            )
            found_id = cat_res.scalar_one_or_none()
            if found_id:
                return found_id
        return None

    @staticmethod
    async def _resolve_fallback_description(
        db: AsyncSession,
        raw_description: Optional[str],
        merchant_name: Optional[str],
        note: Optional[str],
        category_id: Optional[UUID],
        tx_type: TransactionTypeEnum,
    ) -> str:
        """Resolve a meaningful fallback description when raw_description is omitted by user."""
        if raw_description and raw_description.strip():
            return raw_description.strip()
        if merchant_name and merchant_name.strip():
            return merchant_name.strip()
        if note and note.strip():
            return note.strip()
        if category_id:
            cat = await db.get(Category, category_id)
            if cat and cat.name:
                return f"Chi tiêu {cat.name}" if tx_type == TransactionTypeEnum.PURCHASE else cat.name

        type_fallbacks = {
            TransactionTypeEnum.PURCHASE: "Chi tiêu mua sắm",
            TransactionTypeEnum.INCOME: "Thu nhập",
            TransactionTypeEnum.TRANSFER: "Chuyển tiền nội bộ",
            TransactionTypeEnum.REPAYMENT: "Thanh toán nợ thẻ",
            TransactionTypeEnum.INSTALLMENT_MONTHLY: "Trả góp định kỳ",
            TransactionTypeEnum.FEE: "Phí dịch vụ",
            TransactionTypeEnum.INTEREST: "Lãi suất phát sinh",
            TransactionTypeEnum.REFUND: "Hoàn tiền giao dịch",
            TransactionTypeEnum.CASHBACK_CREDIT: "Tiền hoàn Cashback",
            TransactionTypeEnum.CASH_ADVANCE: "Ứng tiền mặt",
            TransactionTypeEnum.ADJUSTMENT: "Điều chỉnh giao dịch",
        }
        return type_fallbacks.get(tx_type, "Giao dịch tài chính")

    @staticmethod
    async def create(db: AsyncSession, payload: TransactionCreate) -> Transaction:
        """Create a new transaction while strictly enforcing sign conventions.

        Credit/Inflow types (REPAYMENT, REFUND, CASHBACK_CREDIT, INSTALLMENT_PRINCIPAL)
        are stored as negative amounts (reducing card balance).
        Debit/Outflow types (PURCHASE, FEE, INTEREST, CASH_ADVANCE)
        are stored as positive amounts (increasing card balance).

        Supports optional automatic merchant normalization and inline 0% installment plan creation.

        Args:
            db (AsyncSession): Active asynchronous database session.
            payload (TransactionCreate): Validated transaction input data.

        Returns:
            Transaction: The newly created and re-queried transaction.

        Raises:
            HTTPException: 400 Bad Request if validation or commit fails.
        """
        tx_data = payload.model_dump()
        convert_installment = tx_data.pop("convert_to_installment", None)
        merchant_name = tx_data.pop("merchant_name", None)

        # Default post_date to transaction_date if omitted or None (for manual transactions)
        if not tx_data.get("post_date") and tx_data.get("transaction_date"):
            tx_data["post_date"] = tx_data["transaction_date"]

        # Auto-resolve category if missing
        tx_data["category_id"] = await TransactionService._resolve_default_category_for_type(
            db, tx_data.get("transaction_type", TransactionTypeEnum.PURCHASE), tx_data.get("category_id")
        )

        # Auto-resolve fallback description if empty (e.g. coffee vỉa hè / cash transaction)
        tx_data["raw_description"] = await TransactionService._resolve_fallback_description(
            db,
            tx_data.get("raw_description"),
            merchant_name,
            tx_data.get("note"),
            tx_data.get("category_id"),
            tx_data.get("transaction_type", TransactionTypeEnum.PURCHASE),
        )

        # 1. Resolve or dynamically create Merchant if merchant_name is provided and merchant_id is empty
        if not tx_data.get("merchant_id") and merchant_name and merchant_name.strip():
            m_clean = merchant_name.strip()
            find_m = await db.execute(
                select(Merchant).where(Merchant.cleaned_name.ilike(m_clean))
            )
            existing_m = find_m.scalar_one_or_none()
            if existing_m:
                tx_data["merchant_id"] = existing_m.id
            else:
                new_m = Merchant(
                    cleaned_name=m_clean,
                    default_category_id=tx_data.get("category_id"),
                )
                db.add(new_m)
                await db.flush()
                tx_data["merchant_id"] = new_m.id

        # 2. Enforce sign conventions based on transaction_type
        credit_types = {
            TransactionTypeEnum.REPAYMENT,
            TransactionTypeEnum.REFUND,
            TransactionTypeEnum.CASHBACK_CREDIT,
            TransactionTypeEnum.INSTALLMENT_PRINCIPAL,
        }
        total_amt = abs(tx_data["total_amount"])
        amt = abs(tx_data["amount"])

        if tx_data["transaction_type"] in credit_types:
            tx_data["total_amount"] = -total_amt
            tx_data["amount"] = -amt
        else:
            tx_data["total_amount"] = total_amt
            tx_data["amount"] = amt

        if (
            convert_installment
            or tx_data.get("installment_plan_id")
            or tx_data.get("transaction_type") == TransactionTypeEnum.INSTALLMENT_MONTHLY
        ):
            tx_data["is_installment"] = True

        tx = Transaction(**tx_data)
        db.add(tx)
        await db.flush()

        # 3. Handle inline Installment Plan & Schedule generation if requested
        if convert_installment:
            term = convert_installment.get("term_months", 3) or 3
            p_name = convert_installment.get("product_name") or tx.raw_description
            conv_fee = convert_installment.get("conversion_fee", Decimal("0.00")) or Decimal("0.00")
            int_rate = convert_installment.get("interest_rate_percent", Decimal("0.00")) or Decimal("0.00")
            plan_tot = abs(tx.total_amount)
            base_monthly = round(plan_tot / term, 2)
            accumulated_principal = Decimal("0.00")

            # Fetch account billing day
            acc_stmt = select(Account.billing_day_of_month).where(
                Account.id == tx.account_id
            )
            acc_res = await db.execute(acc_stmt)
            billing_day = acc_res.scalar_one_or_none()

            plan = InstallmentPlan(
                account_id=tx.account_id,
                origin_transaction_id=tx.id,
                product_name=p_name,
                merchant_id=tx.merchant_id,
                start_date=tx.transaction_date,
                total_amount=plan_tot,
                conversion_fee=conv_fee,
                interest_rate_percent=int_rate,
                term_months=term,
                monthly_principal=base_monthly,
                monthly_payment=base_monthly,
                remaining_balance=plan_tot,
                status=InstallmentStatusEnum.ACTIVE,
            )
            db.add(plan)
            await db.flush()

            # Generate monthly schedules with odd-cents balancing in the final period
            for i in range(1, term + 1):
                if i == term:
                    period_principal = round(plan_tot - accumulated_principal, 2)
                else:
                    period_principal = base_monthly
                    accumulated_principal += period_principal

                due_date = add_months_to_date(tx.transaction_date, i, billing_day)

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

            tx.installment_plan_id = plan.id

        try:
            await db.commit()
            return await TransactionService.get_by_id(db, tx.id)
        except Exception as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to create transaction: {str(e)}",
            )

    @staticmethod
    async def update(
        db: AsyncSession, transaction_id: UUID, payload: TransactionUpdate
    ) -> Transaction:
        """Update fields of an existing transaction (e.g. note, category, dates, amounts).

        Args:
            db (AsyncSession): Active asynchronous database session.
            transaction_id (UUID): Target transaction identifier.
            payload (TransactionUpdate): Partial update payload.

        Returns:
            Transaction: The updated transaction instance.

        Raises:
            HTTPException: 400 Bad Request on failure.
        """
        tx = await TransactionService.get_by_id(db, transaction_id)
        update_data = payload.model_dump(exclude_unset=True)

        # 1. Resolve dynamic Merchant if merchant_name is provided and merchant_id is empty
        merchant_name = update_data.pop("merchant_name", None)
        if merchant_name and merchant_name.strip() and not update_data.get("merchant_id"):
            m_clean = merchant_name.strip()
            find_m = await db.execute(
                select(Merchant).where(Merchant.cleaned_name.ilike(m_clean))
            )
            existing_m = find_m.scalar_one_or_none()
            if existing_m:
                update_data["merchant_id"] = existing_m.id
            else:
                new_m = Merchant(
                    cleaned_name=m_clean,
                    default_category_id=update_data.get("category_id") or tx.category_id,
                )
                db.add(new_m)
                await db.flush()
        # 2. Enforce sign conventions based on transaction_type
        tx_type = update_data.get("transaction_type", tx.transaction_type)

        # Handle raw_description fallback if updated to empty
        if "raw_description" in update_data:
            if update_data["raw_description"] and update_data["raw_description"].strip():
                update_data["raw_description"] = update_data["raw_description"].strip()
            else:
                update_data["raw_description"] = await TransactionService._resolve_fallback_description(
                    db,
                    None,
                    merchant_name,
                    update_data.get("note", tx.note),
                    update_data.get("category_id", tx.category_id),
                    tx_type,
                )

        # If transaction_date is updated and post_date is omitted, sync post_date for unbilled transactions
        if "transaction_date" in update_data and update_data["transaction_date"]:
            if "post_date" not in update_data or update_data["post_date"] is None:
                if tx.statement_id is None or tx.post_date == tx.transaction_date:
                    update_data["post_date"] = update_data["transaction_date"]
        credit_types = {
            TransactionTypeEnum.REPAYMENT,
            TransactionTypeEnum.REFUND,
            TransactionTypeEnum.CASHBACK_CREDIT,
            TransactionTypeEnum.INSTALLMENT_PRINCIPAL,
        }

        if "total_amount" in update_data:
            tot = abs(update_data["total_amount"])
            update_data["total_amount"] = -tot if tx_type in credit_types else tot
        elif "transaction_type" in update_data:
            tot = abs(tx.total_amount)
            update_data["total_amount"] = -tot if tx_type in credit_types else tot

        if "amount" in update_data:
            a = abs(update_data["amount"])
            update_data["amount"] = -a if tx_type in credit_types else a
        elif "transaction_type" in update_data:
            a = abs(tx.amount)
            update_data["amount"] = -a if tx_type in credit_types else a

        # Convert empty strings to None for nullable fields
        for field in [
            "note",
            "post_date",
            "original_currency",
            "installment_plan_id",
            "statement_id",
            "settles_statement_id",
        ]:
            if update_data.get(field) == "":
                update_data[field] = None

        if (
            update_data.get("installment_plan_id")
            or tx_type == TransactionTypeEnum.INSTALLMENT_MONTHLY
        ):
            update_data["is_installment"] = True
        elif (
            "installment_plan_id" in update_data
            and update_data["installment_plan_id"] is None
            and tx_type != TransactionTypeEnum.INSTALLMENT_MONTHLY
        ):
            update_data["is_installment"] = False

        for key, value in update_data.items():
            setattr(tx, key, value)

        try:
            await db.commit()
            return await TransactionService.get_by_id(db, tx.id)
        except Exception as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to update transaction: {str(e)}",
            )

    @staticmethod
    async def delete(db: AsyncSession, transaction_id: UUID) -> bool:
        """Delete a transaction from the ledger.

        Args:
            db (AsyncSession): Active asynchronous database session.
            transaction_id (UUID): Target transaction identifier.

        Returns:
            bool: True if deletion was successful.

        Raises:
            HTTPException: 400 Bad Request on deletion failure.
        """
        tx = await TransactionService.get_by_id(db, transaction_id)
        try:
            await db.delete(tx)
            await db.commit()
            return True
        except Exception as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to delete transaction: {str(e)}",
            )

    @staticmethod
    async def get_summary(
        db: AsyncSession,
        account_id: Optional[UUID] = None,
        statement_id: Optional[UUID] = None,
    ) -> TransactionSummaryRead:
        """Compute aggregated financial summary metrics for a card or statement period.

        Aggregates total purchases, repayments, fees & interest, and net cashflow.

        Args:
            db (AsyncSession): Active asynchronous database session.
            account_id (Optional[UUID]): Optional filter by account.
            statement_id (Optional[UUID]): Optional filter by statement cycle.

        Returns:
            TransactionSummaryRead: Statistical summary of spending, repayments, and net balance.
        """
        sql = """
        SELECT
            COUNT(id) AS total_transactions,
            COALESCE(SUM(CASE WHEN transaction_type = 'INCOME' THEN total_amount ELSE 0 END), 0) AS total_income,
            COALESCE(SUM(CASE WHEN transaction_type IN ('PURCHASE', 'INSTALLMENT_MONTHLY', 'CASH_ADVANCE') THEN total_amount ELSE 0 END), 0) AS total_spending,
            COALESCE(SUM(CASE WHEN transaction_type IN ('REPAYMENT', 'CASHBACK_CREDIT') THEN ABS(total_amount) ELSE 0 END), 0) AS total_repayments,
            COALESCE(SUM(CASE WHEN transaction_type IN ('FEE', 'INTEREST') THEN total_amount ELSE 0 END), 0) AS total_fees_interest,
            COALESCE(SUM(total_amount), 0) AS net_flow
        FROM transactions
        WHERE 1=1
        """
        params = {}
        if account_id:
            sql += " AND account_id = :account_id"
            params["account_id"] = str(account_id)
        if statement_id:
            sql += " AND statement_id = :statement_id"
            params["statement_id"] = str(statement_id)

        result = await db.execute(text(sql), params)
        row = result.mappings().one()
        return TransactionSummaryRead(**dict(row))
