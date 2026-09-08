import enum
import uuid

from sqlalchemy import (
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


class DebtTypeEnum(str, enum.Enum):
    BORROW = "BORROW"  # Tôi đi vay bạn bè/người thân (Nợ phải trả / Liability)
    LEND = "LEND"      # Tôi cho bạn bè/người thân vay (Nợ phải thu / Asset Receivable)


class DebtStatusEnum(str, enum.Enum):
    ACTIVE = "ACTIVE"        # Đang có dư nợ
    PAID_OFF = "PAID_OFF"    # Đã tất toán hoàn toàn
    CANCELLED = "CANCELLED"  # Đã hủy


class Debt(Base):
    """Personal Debt / Peer-to-Peer Informal Borrowing & Lending."""

    __tablename__ = "debts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    account_id = Column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="SET NULL"),
        nullable=True,
    )
    counterparty_name = Column(String(150), nullable=False)
    counterparty_phone = Column(String(20), nullable=True)
    debt_type = Column(
        Enum(DebtTypeEnum, name="debt_type_enum"),
        nullable=False,
        default=DebtTypeEnum.BORROW,
    )
    principal_amount = Column(Numeric(15, 2), nullable=False)
    remaining_amount = Column(Numeric(15, 2), nullable=False)
    total_paid_principal = Column(Numeric(15, 2), nullable=False, default=0.00)
    total_extra_amount = Column(Numeric(15, 2), nullable=False, default=0.00)
    start_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=True)
    status = Column(
        Enum(DebtStatusEnum, name="debt_status_enum"),
        nullable=False,
        default=DebtStatusEnum.ACTIVE,
    )
    note = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=text("CURRENT_TIMESTAMP"),
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=text("CURRENT_TIMESTAMP"),
    )

    # Relationships
    account = relationship("Account", foreign_keys=[account_id], lazy="joined")
    repayments = relationship(
        "DebtRepayment",
        back_populates="debt",
        cascade="all, delete-orphan",
        order_by="desc(DebtRepayment.repayment_date)",
    )


class DebtRepayment(Base):
    """Repayment record for a personal debt, supporting extra appreciation/tip payments."""

    __tablename__ = "debt_repayments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    debt_id = Column(
        UUID(as_uuid=True),
        ForeignKey("debts.id", ondelete="CASCADE"),
        nullable=False,
    )
    account_id = Column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="SET NULL"),
        nullable=True,
    )
    repayment_date = Column(Date, nullable=False)
    principal_paid = Column(Numeric(15, 2), nullable=False)
    extra_amount = Column(Numeric(15, 2), nullable=False, default=0.00)
    total_amount = Column(Numeric(15, 2), nullable=False)
    transaction_id = Column(
        UUID(as_uuid=True),
        ForeignKey("transactions.id", ondelete="SET NULL"),
        nullable=True,
    )
    extra_transaction_id = Column(
        UUID(as_uuid=True),
        ForeignKey("transactions.id", ondelete="SET NULL"),
        nullable=True,
    )
    note = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=text("CURRENT_TIMESTAMP"),
    )

    # Relationships
    debt = relationship("Debt", back_populates="repayments")
    account = relationship("Account", foreign_keys=[account_id], lazy="joined")
    transaction = relationship("Transaction", foreign_keys=[transaction_id], lazy="joined")
    extra_transaction = relationship("Transaction", foreign_keys=[extra_transaction_id], lazy="joined")
