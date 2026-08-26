import uuid
from sqlalchemy import (
    Column,
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

from backend.app.core.database import Base
import enum


class RewardTypeEnum(str, enum.Enum):
    POINT = "POINT"
    CASHBACK = "CASHBACK"
    MILE = "MILE"


class RewardLedger(Base):
    __tablename__ = "reward_ledgers"
    __table_args__ = (
        UniqueConstraint("account_id", "statement_id", "reward_type", name="uq_account_reward_statement"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    account_id = Column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=False,
    )
    statement_id = Column(
        UUID(as_uuid=True),
        ForeignKey("statements.id", ondelete="CASCADE"),
        nullable=True,
    )
    reward_type = Column(
        Enum(RewardTypeEnum, name="reward_type_enum", create_type=False),
        nullable=False,
        default=RewardTypeEnum.POINT,
    )

    previous_remaining = Column(Numeric(15, 2), default=0.00)
    earned_this_month = Column(Numeric(15, 2), default=0.00)
    used_this_month = Column(Numeric(15, 2), default=0.00)
    available_balance = Column(Numeric(15, 2), default=0.00)

    expiring_amount = Column(Numeric(15, 2), default=0.00)
    expiration_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

    # Relationships
    account = relationship("Account", back_populates="reward_ledgers")
    statement = relationship("Statement", back_populates="reward_ledgers")
