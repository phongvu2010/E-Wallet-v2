import uuid
from sqlalchemy import (
    Column,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Enum,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from backend.app.core.database import Base
import enum


class CategoryTypeEnum(str, enum.Enum):
    EXPENSE = "EXPENSE"
    INCOME = "INCOME"
    TRANSFER = "TRANSFER"
    ADJUSTMENT = "ADJUSTMENT"
    FEE_INTEREST = "FEE_INTEREST"


class Category(Base):
    __tablename__ = "categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parent_id = Column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="CASCADE"),
        nullable=True,
    )
    user_id = Column(UUID(as_uuid=True), nullable=True)
    name = Column(String(100), nullable=False)
    category_type = Column(
        Enum(CategoryTypeEnum, name="category_type_enum", create_type=False),
        nullable=False,
        default=CategoryTypeEnum.EXPENSE,
    )
    icon = Column(String(50), nullable=True)
    color = Column(String(20), nullable=True)
    is_system = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

    # Relationships
    parent = relationship("Category", remote_side=[id], back_populates="children")
    children = relationship("Category", back_populates="parent", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="category")
    merchants = relationship("Merchant", back_populates="default_category")
