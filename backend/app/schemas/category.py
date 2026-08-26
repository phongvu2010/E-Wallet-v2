from typing import Optional, List
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from backend.app.models.category import CategoryTypeEnum


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
