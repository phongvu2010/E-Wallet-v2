import uuid
from sqlalchemy import (
    Column,
    String,
    Numeric,
    Integer,
    Date,
    DateTime,
    Boolean,
    ForeignKey,
    Enum,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
import enum


class InstallmentStatusEnum(str, enum.Enum):
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    EARLY_SETTLED = "EARLY_SETTLED"


class InstallmentPlan(Base):
    __tablename__ = "installment_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    account_id = Column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=False,
    )
    origin_transaction_id = Column(
        UUID(as_uuid=True),
        ForeignKey("transactions.id", ondelete="SET NULL"),
        nullable=True,
    )
    product_name = Column(String(150), nullable=False)
    merchant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("merchants.id", ondelete="SET NULL"),
        nullable=True,
    )
    start_date = Column(Date, nullable=False)

    total_amount = Column(Numeric(15, 2), nullable=False)
    conversion_fee = Column(Numeric(15, 2), default=0.00)
    interest_rate_percent = Column(Numeric(5, 2), default=0.00)
    term_months = Column(Integer, nullable=False)

    monthly_principal = Column(Numeric(15, 2), nullable=False)
    monthly_interest = Column(Numeric(15, 2), default=0.00)
    monthly_payment = Column(Numeric(15, 2), nullable=False)

    remaining_balance = Column(Numeric(15, 2), nullable=False)
    status = Column(
        Enum(InstallmentStatusEnum, name="installment_status_enum", create_type=False),
        default=InstallmentStatusEnum.ACTIVE,
    )
    created_at = Column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

    # Relationships
    account = relationship("Account", back_populates="installment_plans")
    merchant = relationship("Merchant", back_populates="installment_plans")
    origin_transaction = relationship(
        "Transaction",
        foreign_keys=[origin_transaction_id],
        backref="origin_installment_plan",
    )
    schedules = relationship(
        "InstallmentSchedule",
        back_populates="plan",
        cascade="all, delete-orphan",
        order_by="InstallmentSchedule.installment_index",
    )
    transactions = relationship(
        "Transaction",
        foreign_keys="Transaction.installment_plan_id",
        back_populates="installment_plan",
    )


class InstallmentSchedule(Base):
    __tablename__ = "installment_schedules"
    __table_args__ = (
        UniqueConstraint("installment_plan_id", "installment_index", name="uq_plan_index"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    installment_plan_id = Column(
        UUID(as_uuid=True),
        ForeignKey("installment_plans.id", ondelete="CASCADE"),
        nullable=False,
    )
    statement_id = Column(
        UUID(as_uuid=True),
        ForeignKey("statements.id", ondelete="SET NULL"),
        nullable=True,
    )
    installment_index = Column(Integer, nullable=False)
    total_installments = Column(Integer, nullable=False)
    due_date = Column(Date, nullable=False)
    principal_amount = Column(Numeric(15, 2), nullable=False)
    interest_amount = Column(Numeric(15, 2), default=0.00)
    total_installment_amount = Column(Numeric(15, 2), nullable=False)
    is_billed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

    # Relationships
    plan = relationship("InstallmentPlan", back_populates="schedules")
    statement = relationship("Statement", back_populates="installment_schedules")
