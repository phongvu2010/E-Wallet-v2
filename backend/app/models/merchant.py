import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class Merchant(Base):
    __tablename__ = "merchants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cleaned_name = Column(String(100), unique=True, nullable=False)
    default_category_id = Column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
    )
    website = Column(String(150), nullable=True)
    logo_url = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

    # Relationships
    default_category = relationship("Category", back_populates="merchants")
    aliases = relationship("MerchantAlias", back_populates="merchant", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="merchant")
    installment_plans = relationship("InstallmentPlan", back_populates="merchant")


class MerchantAlias(Base):
    __tablename__ = "merchant_aliases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    merchant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("merchants.id", ondelete="CASCADE"),
        nullable=False,
    )
    pattern = Column(String(150), unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

    # Relationships
    merchant = relationship("Merchant", back_populates="aliases")
