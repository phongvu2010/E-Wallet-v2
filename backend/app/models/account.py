import uuid
from sqlalchemy import (
    Column,
    String,
    Numeric,
    Integer,
    Date,
    DateTime,
    ForeignKey,
    Text,
    Enum,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from backend.app.core.database import Base
import enum


class AccountTypeEnum(str, enum.Enum):
    CREDIT_CARD = "CREDIT_CARD"
    DEBIT_CARD = "DEBIT_CARD"
    BANK_ACCOUNT = "BANK_ACCOUNT"
    E_WALLET = "E_WALLET"


class AccountStatusEnum(str, enum.Enum):
    ACTIVE = "ACTIVE"
    LOCKED = "LOCKED"
    CLOSED = "CLOSED"
    EXPIRED = "EXPIRED"
    REPLACED = "REPLACED"


class Account(Base):
    __tablename__ = "accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    institution_id = Column(UUID(as_uuid=True), ForeignKey("institutions.id", ondelete="RESTRICT"), nullable=True)
    account_name = Column(String(100), nullable=False)
    account_type = Column(
        Enum(AccountTypeEnum, name="account_type_enum", create_type=False),
        nullable=False,
        default=AccountTypeEnum.CREDIT_CARD,
    )
    card_number_masked = Column(String(25), nullable=False)
    card_number_last4 = Column(String(4), nullable=False)
    credit_limit = Column(Numeric(15, 2), default=0.00)
    billing_day_of_month = Column(Integer, nullable=True)
    grace_period_days = Column(Integer, default=15)
    status = Column(
        Enum(AccountStatusEnum, name="account_status_enum", create_type=False),
        default=AccountStatusEnum.ACTIVE,
    )

    replaces_account_id = Column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="SET NULL"),
        nullable=True,
    )
    opened_date = Column(Date, nullable=True)
    closed_date = Column(Date, nullable=True)
    color_hex = Column(String(7), default="#3b82f6")
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

    # Relationships
    institution = relationship("Institution", back_populates="accounts")
    replaces_account = relationship("Account", remote_side=[id], backref="replaced_by")
    statements = relationship("Statement", back_populates="account", cascade="all, delete-orphan")
    transactions = relationship(
        "Transaction",
        foreign_keys="Transaction.account_id",
        back_populates="account",
        cascade="all, delete-orphan",
    )
    installment_plans = relationship("InstallmentPlan", back_populates="account", cascade="all, delete-orphan")
    reward_ledgers = relationship("RewardLedger", back_populates="account", cascade="all, delete-orphan")
