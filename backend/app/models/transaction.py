import enum
import uuid

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class TransactionTypeEnum(str, enum.Enum):
    PURCHASE = "PURCHASE"
    INCOME = "INCOME"
    REPAYMENT = "REPAYMENT"
    INSTALLMENT_PRINCIPAL = "INSTALLMENT_PRINCIPAL"
    INSTALLMENT_MONTHLY = "INSTALLMENT_MONTHLY"
    FEE = "FEE"
    INTEREST = "INTEREST"
    REFUND = "REFUND"
    CASHBACK_CREDIT = "CASHBACK_CREDIT"
    CASH_ADVANCE = "CASH_ADVANCE"
    ADJUSTMENT = "ADJUSTMENT"
    TRANSFER = "TRANSFER"


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    account_id = Column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=False,
    )
    statement_id = Column(
        UUID(as_uuid=True),
        ForeignKey("statements.id", ondelete="SET NULL"),
        nullable=True,
    )
    installment_plan_id = Column(
        UUID(as_uuid=True),
        ForeignKey("installment_plans.id", ondelete="SET NULL"),
        nullable=True,
    )
    transfer_to_account_id = Column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="SET NULL"),
        nullable=True,
    )
    settles_statement_id = Column(
        UUID(as_uuid=True),
        ForeignKey("statements.id", ondelete="SET NULL"),
        nullable=True,
    )

    transaction_date = Column(Date, nullable=False)
    post_date = Column(Date, nullable=True)
    raw_description = Column(String(500), nullable=True)
    merchant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("merchants.id", ondelete="SET NULL"),
        nullable=True,
    )
    category_id = Column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
    )
    transaction_type = Column(
        Enum(TransactionTypeEnum, name="transaction_type_enum", create_type=False),
        nullable=False,
        default=TransactionTypeEnum.PURCHASE,
    )

    original_amount = Column(Numeric(15, 2), nullable=True)
    original_currency = Column(String(3), default="VND")
    exchange_rate = Column(Numeric(18, 6), default=1.0000)
    foreign_fee = Column(Numeric(15, 2), default=0.00)

    amount = Column(Numeric(15, 2), nullable=False)
    fee = Column(Numeric(15, 2), default=0.00)
    total_amount = Column(Numeric(15, 2), nullable=False)

    note = Column(Text, nullable=True)
    is_installment = Column(Boolean, default=False)
    tx_fingerprint = Column(String(64), unique=True, nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP")
    )

    # Relationships
    account = relationship(
        "Account", foreign_keys=[account_id], back_populates="transactions"
    )
    statement = relationship(
        "Statement", foreign_keys=[statement_id], back_populates="transactions"
    )
    settles_statement = relationship(
        "Statement",
        foreign_keys=[settles_statement_id],
        back_populates="settling_transactions",
    )
    installment_plan = relationship(
        "InstallmentPlan",
        foreign_keys=[installment_plan_id],
        back_populates="transactions",
    )
    transfer_to_account = relationship("Account", foreign_keys=[transfer_to_account_id])
    merchant = relationship("Merchant", back_populates="transactions")
    category = relationship("Category", back_populates="transactions")
