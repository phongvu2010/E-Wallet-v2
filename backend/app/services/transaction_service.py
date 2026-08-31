from typing import List, Optional, Tuple
from uuid import UUID
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, or_, text
from fastapi import HTTPException, status

from app.models.transaction import Transaction, TransactionTypeEnum
from app.schemas.transaction import (
    TransactionCreate,
    TransactionUpdate,
    TransactionFilterParams,
    TransactionSummaryRead,
)
from app.schemas.common import PaginationParams


class TransactionService:
    @staticmethod
    async def get_filtered(
        db: AsyncSession,
        filter_params: TransactionFilterParams,
        pagination: PaginationParams,
    ) -> Tuple[List[Transaction], int]:
        query = (
            select(Transaction)
            .options(
                selectinload(Transaction.category),
                selectinload(Transaction.merchant),
            )
        )

        conditions = []

        if filter_params.account_id:
            conditions.append(Transaction.account_id == filter_params.account_id)
        if filter_params.statement_id:
            conditions.append(Transaction.statement_id == filter_params.statement_id)
        if filter_params.category_id:
            conditions.append(Transaction.category_id == filter_params.category_id)
        if filter_params.merchant_id:
            conditions.append(Transaction.merchant_id == filter_params.merchant_id)
        if filter_params.transaction_type:
            conditions.append(Transaction.transaction_type == filter_params.transaction_type)
        if filter_params.start_date:
            conditions.append(Transaction.transaction_date >= filter_params.start_date)
        if filter_params.end_date:
            conditions.append(Transaction.transaction_date <= filter_params.end_date)
        if filter_params.is_installment is not None:
            conditions.append(Transaction.is_installment == filter_params.is_installment)
        if filter_params.min_amount is not None:
            conditions.append(func.abs(Transaction.total_amount) >= filter_params.min_amount)
        if filter_params.max_amount is not None:
            conditions.append(func.abs(Transaction.total_amount) <= filter_params.max_amount)
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
        query = query.order_by(Transaction.transaction_date.desc(), Transaction.created_at.desc())
        query = query.offset(pagination.offset).limit(pagination.page_size)

        result = await db.execute(query)
        transactions = result.scalars().all()

        return transactions, total_count

    @staticmethod
    async def get_by_id(db: AsyncSession, transaction_id: UUID) -> Transaction:
        query = (
            select(Transaction)
            .options(
                selectinload(Transaction.category),
                selectinload(Transaction.merchant),
                selectinload(Transaction.account),
                selectinload(Transaction.statement),
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
    async def create(db: AsyncSession, payload: TransactionCreate) -> Transaction:
        tx_data = payload.model_dump()

        # Enforce sign conventions based on transaction_type
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

        tx = Transaction(**tx_data)
        db.add(tx)
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
    async def update(db: AsyncSession, transaction_id: UUID, payload: TransactionUpdate) -> Transaction:
        tx = await TransactionService.get_by_id(db, transaction_id)
        update_data = payload.model_dump(exclude_unset=True)
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
        sql = """
        SELECT
            COUNT(id) AS total_transactions,
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
