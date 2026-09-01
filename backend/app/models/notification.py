import enum
import uuid

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.core.database import Base


class NotificationTypeEnum(str, enum.Enum):
    PAYMENT_DUE = "PAYMENT_DUE"
    OVERDUE_ALERT = "OVERDUE_ALERT"
    UTILIZATION_HIGH = "UTILIZATION_HIGH"
    REWARD_EXPIRING = "REWARD_EXPIRING"
    ETL_SYNC_COMPLETED = "ETL_SYNC_COMPLETED"
    EARLY_SETTLED = "EARLY_SETTLED"
    SYSTEM_ANNOUNCEMENT = "SYSTEM_ANNOUNCEMENT"


class NotificationSeverityEnum(str, enum.Enum):
    INFO = "INFO"
    SUCCESS = "SUCCESS"
    WARNING = "WARNING"
    DANGER = "DANGER"


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(
        Enum(
            NotificationTypeEnum,
            name="notification_type_enum",
            create_type=False,
        ),
        nullable=False,
        default=NotificationTypeEnum.PAYMENT_DUE,
    )
    severity = Column(
        Enum(
            NotificationSeverityEnum,
            name="notification_severity_enum",
            create_type=False,
        ),
        nullable=False,
        default=NotificationSeverityEnum.INFO,
    )
    is_read = Column(Boolean, nullable=False, default=False)
    action_url = Column(String(255), nullable=True)
    metadata_json = Column("metadata", JSONB, default=dict)
    created_at = Column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP")
    )


class NotificationSettings(Base):
    __tablename__ = "notification_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), unique=True, nullable=True)
    telegram_bot_token = Column(String(255), nullable=True)
    telegram_chat_id = Column(String(100), nullable=True)
    is_telegram_enabled = Column(Boolean, default=False)
    is_in_app_enabled = Column(Boolean, default=True)
    remind_days_before = Column(Integer, default=3)
    remind_utilization_threshold = Column(Integer, default=70)
    created_at = Column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP")
    )
    updated_at = Column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP")
    )
