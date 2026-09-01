from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.notification import (
    NotificationSeverityEnum,
    NotificationTypeEnum,
)


class NotificationBase(BaseModel):
    title: str
    message: str
    notification_type: NotificationTypeEnum = NotificationTypeEnum.PAYMENT_DUE
    severity: NotificationSeverityEnum = NotificationSeverityEnum.INFO
    action_url: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None


class NotificationCreate(NotificationBase):
    user_id: Optional[UUID] = None


class NotificationRead(NotificationBase):
    id: UUID
    user_id: Optional[UUID] = None
    is_read: bool
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class NotificationSettingsBase(BaseModel):
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    is_telegram_enabled: bool = False
    is_in_app_enabled: bool = True
    remind_days_before: int = 3
    remind_utilization_threshold: int = 70


class NotificationSettingsUpdate(BaseModel):
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    is_telegram_enabled: Optional[bool] = None
    is_in_app_enabled: Optional[bool] = None
    remind_days_before: Optional[int] = None
    remind_utilization_threshold: Optional[int] = None


class NotificationSettingsRead(NotificationSettingsBase):
    id: UUID
    user_id: Optional[UUID] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class TelegramTestRequest(BaseModel):
    bot_token: Optional[str] = None
    chat_id: Optional[str] = None
    custom_message: Optional[str] = None


class TelegramTestResponse(BaseModel):
    success: bool
    message: str
    detail: Optional[str] = None


class NotificationSummaryRead(BaseModel):
    unread_count: int
    total_count: int
    items: List[NotificationRead]
