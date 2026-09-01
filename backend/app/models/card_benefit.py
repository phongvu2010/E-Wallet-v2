import uuid

from sqlalchemy import (
    Boolean,
    Column,
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
from app.models.reward import RewardTypeEnum


class CardBenefit(Base):
    __tablename__ = "card_benefits"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=False,
    )
    category_id = Column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
    )
    category_keyword = Column(String(100), nullable=True)
    merchant_pattern = Column(String(150), nullable=True)
    reward_type = Column(
        Enum(RewardTypeEnum, name="reward_type_enum", create_type=False),
        nullable=False,
        default=RewardTypeEnum.CASHBACK,
    )
    reward_rate_percent = Column(Numeric(5, 2), nullable=False, default=0.00)
    point_multiplier = Column(Numeric(5, 2), default=1.00)
    min_spend_per_txn = Column(Numeric(15, 2), default=0.00)
    max_reward_monthly = Column(Numeric(15, 2), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP")
    )

    # Relationships
    account = relationship("Account", backref="benefits")
    category = relationship("Category")
