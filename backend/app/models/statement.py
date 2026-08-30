import uuid
from sqlalchemy import (
    Column,
    String,
    Numeric,
    Date,
    DateTime,
    ForeignKey,
    Enum,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
import enum


class StatementStatusEnum(str, enum.Enum):
    OPEN = "OPEN"
    BILLED = "BILLED"
    PAID = "PAID"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    OVERDUE = "OVERDUE"


class Statement(Base):
    __tablename__ = "statements"
    __table_args__ = (
        UniqueConstraint("account_id", "statement_date", name="uq_account_statement"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    account_id = Column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=False,
    )
    statement_date = Column(Date, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    payment_due_date = Column(Date, nullable=False)
    credit_limit = Column(Numeric(15, 2), nullable=False)

    previous_balance = Column(Numeric(15, 2), default=0.00)
    purchases_amount = Column(Numeric(15, 2), default=0.00)
    installments_amount = Column(Numeric(15, 2), default=0.00)
    fees_and_charges = Column(Numeric(15, 2), default=0.00)
    payments_received = Column(Numeric(15, 2), default=0.00)
    statement_balance = Column(Numeric(15, 2), nullable=False)
    minimum_payment = Column(Numeric(15, 2), nullable=False)
    surplus_amount = Column(Numeric(15, 2), default=0.00)

    status = Column(
        Enum(StatementStatusEnum, name="statement_status_enum", create_type=False),
        default=StatementStatusEnum.BILLED,
    )
    source_file_path = Column(String(255), nullable=True)
    file_hash = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

    # Relationships
    account = relationship("Account", back_populates="statements")
    transactions = relationship(
        "Transaction",
        foreign_keys="Transaction.statement_id",
        back_populates="statement",
    )
    settling_transactions = relationship(
        "Transaction",
        foreign_keys="Transaction.settles_statement_id",
        back_populates="settles_statement",
    )
    installment_schedules = relationship("InstallmentSchedule", back_populates="statement")
    reward_ledgers = relationship("RewardLedger", back_populates="statement", cascade="all, delete-orphan")
