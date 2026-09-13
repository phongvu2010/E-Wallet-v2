import datetime
from decimal import Decimal
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account, AccountStatusEnum, AccountTypeEnum
from app.models.category import Category, CategoryTypeEnum
from app.models.debt import Debt, DebtStatusEnum, DebtTypeEnum
from app.models.transaction import Transaction, TransactionTypeEnum
from app.schemas.debt import DebtCreate, DebtRepaymentCreate
from app.services.debt_service import DebtService


@pytest.mark.asyncio
async def test_create_borrow_debt_and_repay_with_extra_tip(db_session: AsyncSession):
    """Test full lifecycle of a personal borrowing debt:

    1. Borrow 5,000,000 VND from friend Nam into Bank Account.
    2. Repay 2,000,000 VND principal in period 1.
    3. Repay 3,000,000 VND principal + 200,000 VND extra thank-you tip in period 2.
    4. Validate status is PAID_OFF and both transactions are recorded cleanly.
    """
    # 1. Setup mock account
    acc = Account(
        account_name="Techcombank Main",
        account_type=AccountTypeEnum.BANK_ACCOUNT,
        initial_balance=Decimal("10000000.00"),
        status=AccountStatusEnum.ACTIVE,
    )
    db_session.add(acc)

    # Setup category for thank-you tip
    cat = Category(
        name="Quà tặng & Cảm ơn",
        category_type=CategoryTypeEnum.EXPENSE,
        is_system=True,
    )
    cat_parent = Category(
        id=uuid.UUID("cccccccc-3e4a-4be6-9333-18ebaf270e2e"),
        name="Chuyển tiền & Trả nợ",
        category_type=CategoryTypeEnum.TRANSFER,
        is_system=True,
    )
    cat_borrow = Category(
        id=uuid.UUID("cccccccc-3e4a-4be6-9333-18ebaf270004"),
        parent_id=cat_parent.id,
        name="Đi vay tiền",
        category_type=CategoryTypeEnum.TRANSFER,
        is_system=True,
    )
    cat_repay = Category(
        id=uuid.UUID("cccccccc-3e4a-4be6-9333-18ebaf270005"),
        parent_id=cat_parent.id,
        name="Trả nợ vay",
        category_type=CategoryTypeEnum.TRANSFER,
        is_system=True,
    )
    db_session.add_all([cat, cat_parent, cat_borrow, cat_repay])
    await db_session.flush()

    # 2. Create Borrow Debt (Vay bạn Nam 5tr)
    payload_create = DebtCreate(
        counterparty_name="Bạn Nam",
        counterparty_phone="0901234567",
        debt_type=DebtTypeEnum.BORROW,
        principal_amount=Decimal("5000000.00"),
        start_date=datetime.date(2026, 9, 1),
        due_date=datetime.date(2026, 10, 1),
        account_id=acc.id,
        note="Vay lo việc cá nhân",
    )
    created_debt = await DebtService.create(db_session, payload_create)

    assert created_debt.counterparty_name == "Bạn Nam"
    assert created_debt.debt_type == DebtTypeEnum.BORROW
    assert created_debt.principal_amount == Decimal("5000000.00")
    assert created_debt.remaining_amount == Decimal("5000000.00")
    assert created_debt.status == DebtStatusEnum.ACTIVE

    # Verify initial transaction has correct category_id (Đi vay tiền)
    tx_borrow_stmt = select(Transaction).where(Transaction.transaction_type == TransactionTypeEnum.DEBT_BORROW)
    tx_borrow_res = await db_session.execute(tx_borrow_stmt)
    tx_borrow = tx_borrow_res.scalar_one()
    assert tx_borrow.category_id == cat_borrow.id

    # 3. Repay Period 1: 2,000,000 VND principal
    payload_repay_1 = DebtRepaymentCreate(
        repayment_date=datetime.date(2026, 9, 15),
        principal_paid=Decimal("2000000.00"),
        extra_amount=Decimal("0.00"),
        account_id=acc.id,
        note="Trả đợt 1",
    )
    debt_after_p1 = await DebtService.record_repayment(
        db_session, created_debt.id, payload_repay_1
    )

    assert debt_after_p1.remaining_amount == Decimal("3000000.00")
    assert debt_after_p1.total_paid_principal == Decimal("2000000.00")
    assert debt_after_p1.total_extra_amount == Decimal("0.00")
    assert debt_after_p1.status == DebtStatusEnum.ACTIVE
    assert len(debt_after_p1.repayments) == 1

    # Verify repayment transaction has correct category_id (Trả nợ vay)
    tx_repay_stmt = select(Transaction).where(Transaction.transaction_type == TransactionTypeEnum.DEBT_REPAY)
    tx_repay_res = await db_session.execute(tx_repay_stmt)
    tx_repay = tx_repay_res.scalars().first()
    assert tx_repay.category_id == cat_repay.id

    # 4. Repay Period 2: 3,000,000 VND principal + 200,000 VND appreciation tip
    payload_repay_2 = DebtRepaymentCreate(
        repayment_date=datetime.date(2026, 9, 30),
        principal_paid=Decimal("3000000.00"),
        extra_amount=Decimal("200000.00"),
        account_id=acc.id,
        extra_category_id=cat.id,
        note="Tất toán nợ + gửi Nam 200k uống cafe cảm ơn",
    )
    debt_after_p2 = await DebtService.record_repayment(
        db_session, created_debt.id, payload_repay_2
    )

    assert debt_after_p2.remaining_amount == Decimal("0.00")
    assert debt_after_p2.total_paid_principal == Decimal("5000000.00")
    assert debt_after_p2.total_extra_amount == Decimal("200000.00")
    assert debt_after_p2.status == DebtStatusEnum.PAID_OFF
    assert len(debt_after_p2.repayments) == 2

    # Check latest repayment
    latest_r = debt_after_p2.repayments[0]
    assert latest_r.principal_paid == Decimal("3000000.00")
    assert latest_r.extra_amount == Decimal("200000.00")
    assert latest_r.total_amount == Decimal("3200000.00")


@pytest.mark.asyncio
async def test_create_lend_debt_and_collect_with_extra(db_session: AsyncSession):
    """Test lending to a friend and collecting back with extra coffee money."""
    acc = Account(
        account_name="Ví Tiền Mặt",
        account_type=AccountTypeEnum.CASH,
        initial_balance=Decimal("5000000.00"),
        status=AccountStatusEnum.ACTIVE,
    )
    # Setup categories for lending and collecting
    cat_lend = Category(
        id=uuid.UUID("cccccccc-3e4a-4be6-9333-18ebaf270006"),
        name="Cho vay tiền",
        category_type=CategoryTypeEnum.TRANSFER,
        is_system=True,
    )
    cat_collect = Category(
        id=uuid.UUID("cccccccc-3e4a-4be6-9333-18ebaf270007"),
        name="Thu hồi nợ",
        category_type=CategoryTypeEnum.TRANSFER,
        is_system=True,
    )
    db_session.add_all([acc, cat_lend, cat_collect])
    await db_session.flush()

    # 1. Cho bạn Tuấn mượn 2,000,000 VND
    payload_lend = DebtCreate(
        counterparty_name="Tuấn",
        debt_type=DebtTypeEnum.LEND,
        principal_amount=Decimal("2000000.00"),
        start_date=datetime.date(2026, 9, 5),
        account_id=acc.id,
        note="Cho Tuấn mượn tiền đóng tiền nhà",
    )
    lend_debt = await DebtService.create(db_session, payload_lend)

    assert lend_debt.debt_type == DebtTypeEnum.LEND
    assert lend_debt.remaining_amount == Decimal("2000000.00")

    # Verify initial lend transaction has correct category_id (Cho vay tiền)
    tx_lend_stmt = select(Transaction).where(Transaction.transaction_type == TransactionTypeEnum.DEBT_LEND)
    tx_lend_res = await db_session.execute(tx_lend_stmt)
    tx_lend = tx_lend_res.scalar_one()
    assert tx_lend.category_id == cat_lend.id

    # 2. Tuấn trả lại 2,000,000 VND gốc + 100,000 VND cảm ơn
    payload_collect = DebtRepaymentCreate(
        repayment_date=datetime.date(2026, 9, 20),
        principal_paid=Decimal("2000000.00"),
        extra_amount=Decimal("100000.00"),
        account_id=acc.id,
        note="Tuấn gửi lại tiền + 100k mời cafe",
    )
    collected_debt = await DebtService.record_repayment(
        db_session, lend_debt.id, payload_collect
    )

    assert collected_debt.remaining_amount == Decimal("0.00")
    assert collected_debt.total_paid_principal == Decimal("2000000.00")
    assert collected_debt.total_extra_amount == Decimal("100000.00")
    assert collected_debt.status == DebtStatusEnum.PAID_OFF

    # Verify collect transaction has correct category_id (Thu hồi nợ)
    tx_collect_stmt = select(Transaction).where(Transaction.transaction_type == TransactionTypeEnum.DEBT_COLLECT)
    tx_collect_res = await db_session.execute(tx_collect_stmt)
    tx_collect = tx_collect_res.scalar_one()
    assert tx_collect.category_id == cat_collect.id


@pytest.mark.asyncio
async def test_debt_summary_kpis(db_session: AsyncSession):
    """Test KPI aggregation for personal debts."""
    kpis = await DebtService.get_kpis(db_session)
    assert kpis is not None
    assert isinstance(kpis.total_borrow_count, int)
    assert isinstance(kpis.total_lend_count, int)


@pytest.mark.asyncio
async def test_get_debts_api_endpoint(client: AsyncClient, db_session: AsyncSession):
    """Test GET /api/v1/debts endpoint serialization with account and institution."""
    acc = Account(
        account_name="Vietcombank Digital",
        account_type=AccountTypeEnum.BANK_ACCOUNT,
        initial_balance=Decimal("2000000.00"),
        status=AccountStatusEnum.ACTIVE,
    )
    db_session.add(acc)
    await db_session.flush()

    payload_create = DebtCreate(
        counterparty_name="Chị Mai",
        debt_type=DebtTypeEnum.BORROW,
        principal_amount=Decimal("3000000.00"),
        start_date=datetime.date(2026, 9, 10),
        account_id=acc.id,
    )
    await DebtService.create(db_session, payload_create)

    response = await client.get("/api/v1/debts")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    target = next((d for d in data if d["counterparty_name"] == "Chị Mai"), None)
    assert target is not None
    assert target["account_name"] == "Vietcombank Digital"

