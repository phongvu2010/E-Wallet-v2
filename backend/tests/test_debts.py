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
    db_session.add(cat)
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
    db_session.add(acc)
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


@pytest.mark.asyncio
async def test_debt_summary_kpis(db_session: AsyncSession):
    """Test KPI aggregation for personal debts."""
    kpis = await DebtService.get_kpis(db_session)
    assert kpis is not None
    assert isinstance(kpis.total_borrow_count, int)
    assert isinstance(kpis.total_lend_count, int)
