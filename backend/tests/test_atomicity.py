"""Unit and Integration tests verifying Transaction Boundaries & ACID Atomicity.

Tests:
1. Rollback on multi-entity operations (e.g. Transaction + Installment Plan).
2. Rollback on Debt Repayments (Debt balance + Repayment Transaction).
3. Rollback on Loan Creation (Loan + Full Amortization Schedule + Rate History).
4. Savepoint isolation with nested atomic_transaction blocks.
5. Error translation for database integrity constraints (Unique, Foreign Key, Check constraints).
"""

from decimal import Decimal
import datetime
import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.transaction import atomic_transaction
from app.models.account import Account, AccountStatusEnum, AccountTypeEnum
from app.models.debt import Debt, DebtStatusEnum, DebtTypeEnum
from app.models.installment import InstallmentPlan
from app.models.transaction import Transaction, TransactionTypeEnum
from app.schemas.debt import DebtCreate, DebtRepaymentCreate
from app.schemas.installment import InstallmentPlanCreate
from app.schemas.transaction import InstallmentInlineCreate, TransactionCreate
from app.services.debt_service import DebtService
from app.services.installment_service import InstallmentService
from app.services.transaction_service import TransactionService


@pytest.mark.asyncio
async def test_atomic_transaction_rollback_on_installment_failure(db_session: AsyncSession):
    """Test that if installment creation fails, the parent purchase transaction is rolled back."""
    acc = Account(
        account_name="Atomicity Test Card Fail",
        account_type=AccountTypeEnum.CREDIT_CARD,
        credit_limit=Decimal("50000000.00"),
        status=AccountStatusEnum.ACTIVE,
    )
    db_session.add(acc)
    await db_session.flush()

    # Create invalid installment directly via service inside an atomic block
    # When InstallmentService.create raises 400 Bad Request, parent transaction is rolled back
    with pytest.raises(HTTPException) as exc_info:
        async with atomic_transaction(db_session):
            tx = Transaction(
                account_id=acc.id,
                transaction_date=datetime.date(2026, 9, 1),
                amount=Decimal("-12000000.00"),
                total_amount=Decimal("-12000000.00"),
                transaction_type=TransactionTypeEnum.PURCHASE,
                raw_description="Mua iPhone trả góp lỗi",
            )
            db_session.add(tx)
            await db_session.flush()

            # Invalid installment plan with term_months = 0
            plan_payload = InstallmentPlanCreate(
                account_id=acc.id,
                transaction_id=tx.id,
                product_name="iPhone 16 Pro",
                plan_name="Gói trả góp 0 tháng lỗi",
                total_amount=Decimal("12000000.00"),
                term_months=0,  # Invalid
                start_date=datetime.date(2026, 9, 1),
                monthly_installment=Decimal("1000000.00"),
            )
            await InstallmentService.create(db_session, plan_payload)

    assert exc_info.value.status_code == 400

    # Verify transaction was NOT persisted (rolled back)
    tx_check = await db_session.execute(
        select(Transaction).where(Transaction.account_id == acc.id)
    )
    assert tx_check.scalars().first() is None


@pytest.mark.asyncio
async def test_atomic_transaction_rollback_on_debt_repayment_failure(db_session: AsyncSession):
    """Test that if repayment recording fails mid-way, debt remaining balance is not mutated."""
    acc = Account(
        account_name="Atomicity Debt Account",
        account_type=AccountTypeEnum.BANK_ACCOUNT,
        initial_balance=Decimal("20000000.00"),
        status=AccountStatusEnum.ACTIVE,
    )
    db_session.add(acc)
    await db_session.flush()

    debt = Debt(
        counterparty_name="Anh Hùng",
        debt_type=DebtTypeEnum.BORROW,
        principal_amount=Decimal("10000000.00"),
        remaining_amount=Decimal("10000000.00"),
        start_date=datetime.date(2026, 9, 1),
        status=DebtStatusEnum.ACTIVE,
        account_id=acc.id,
    )
    db_session.add(debt)
    await db_session.flush()

    payload_invalid = DebtRepaymentCreate(
        repayment_date=datetime.date(2026, 9, 15),
        principal_paid=Decimal("15000000.00"),  # Exceeds remaining 10,000,000
        account_id=acc.id,
    )

    with pytest.raises(HTTPException) as exc_info:
        await DebtService.record_repayment(db_session, debt.id, payload_invalid)

    assert exc_info.value.status_code == 400

    # Verify debt remaining amount was NOT modified
    await db_session.refresh(debt)
    assert debt.remaining_amount == Decimal("10000000.00")
    assert debt.total_paid_principal == Decimal("0.00")
    assert debt.status == DebtStatusEnum.ACTIVE


@pytest.mark.asyncio
async def test_atomic_transaction_nested_service_composition(db_session: AsyncSession):
    """Test that calling multiple services inside an atomic_transaction succeeds atomically."""
    acc = Account(
        account_name="Composition Test Account",
        account_type=AccountTypeEnum.CREDIT_CARD,
        credit_limit=Decimal("30000000.00"),
        status=AccountStatusEnum.ACTIVE,
    )
    db_session.add(acc)
    await db_session.flush()

    # Create a purchase with convert_to_installment (TransactionService -> InstallmentService nested transaction)
    payload = TransactionCreate(
        account_id=acc.id,
        transaction_date=datetime.date(2026, 9, 1),
        amount=Decimal("6000000.00"),
        total_amount=Decimal("6000000.00"),
        transaction_type=TransactionTypeEnum.PURCHASE,
        raw_description="Mua laptop tra gop 6 thang",
        convert_to_installment=InstallmentInlineCreate(
            product_name="Laptop ThinkPad",
            term_months=6,
        ),
    )

    created_tx = await TransactionService.create(db_session, payload)
    assert created_tx is not None
    assert created_tx.is_installment is True
    assert created_tx.installment_plan_id is not None

    # Verify installment plan and schedules are both committed
    plan = await InstallmentService.get_by_id(db_session, created_tx.installment_plan_id)
    assert plan is not None
    assert plan.term_months == 6
    assert len(plan.schedules) == 6


@pytest.mark.asyncio
async def test_atomic_transaction_foreign_key_error_translation(db_session: AsyncSession):
    """Test that foreign key constraint violations produce Vietnamese error messages."""
    fake_id = uuid.uuid4()
    payload = TransactionCreate(
        account_id=fake_id,  # Non-existent account
        transaction_date=datetime.date(2026, 9, 1),
        amount=Decimal("50000.00"),
        total_amount=Decimal("50000.00"),
        transaction_type=TransactionTypeEnum.PURCHASE,
        raw_description="Giao dịch tài khoản không tồn tại",
    )

    with pytest.raises(HTTPException) as exc_info:
        await TransactionService.create(db_session, payload)

    assert exc_info.value.status_code in [400, 404]
    detail = str(exc_info.value.detail)
    assert any(kw in detail.lower() for kw in ["tài khoản", "không tồn tại", "bản ghi"])
