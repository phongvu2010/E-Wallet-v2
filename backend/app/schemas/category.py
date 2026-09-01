from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.category import CategoryTypeEnum


class CategoryBase(BaseModel):
    name: str
    category_type: CategoryTypeEnum = CategoryTypeEnum.EXPENSE
    parent_id: Optional[UUID] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    is_system: bool = False


class CategoryCreate(CategoryBase):
    pass


class CategoryRead(CategoryBase):
    id: UUID
    user_id: Optional[UUID] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class CategoryTreeNode(CategoryRead):
    children: List[CategoryRead] = []
