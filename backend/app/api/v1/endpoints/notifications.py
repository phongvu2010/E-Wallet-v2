from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.notification import (
    NotificationCreate,
    NotificationRead,
    NotificationSettingsRead,
    NotificationSettingsUpdate,
    NotificationSummaryRead,
    TelegramTestRequest,
    TelegramTestResponse,
)
from app.services.notification_service import NotificationService

router = APIRouter()


@router.get(
    "",
    response_model=List[NotificationRead],
    summary="Get all in-app notifications",
)
async def list_notifications(
    limit: int = Query(default=50, ge=1, le=200),
    unread_only: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve list of in-app notifications ordered by timestamp descending."""
    return await NotificationService.get_all(db, limit, unread_only)


@router.get(
    "/summary",
    response_model=NotificationSummaryRead,
    summary="Get notification summary for navbar bell icon",
)
async def get_notifications_summary(db: AsyncSession = Depends(get_db)):
    """Fetch unread counter and latest in-app notifications."""
    return await NotificationService.get_summary(db)


@router.patch(
    "/{notification_id}/read",
    summary="Mark single notification as read",
)
async def mark_notification_read(
    notification_id: UUID, db: AsyncSession = Depends(get_db)
):
    """Mark a specific notification as read."""
    await NotificationService.mark_as_read(db, notification_id)
    return {"success": True, "message": "Notification marked as read"}


@router.post(
    "/mark-all-read",
    summary="Mark all notifications as read",
)
async def mark_all_notifications_read(db: AsyncSession = Depends(get_db)):
    """Mark all unread notifications as read."""
    count = await NotificationService.mark_all_as_read(db)
    return {
        "success": True,
        "message": f"Marked {count} notifications as read",
        "count": count,
    }


@router.post(
    "/scan",
    summary="Trigger immediate business rule evaluation and generate smart alerts",
)
async def scan_alerts(db: AsyncSession = Depends(get_db)):
    """Scan analytical views and generate smart notifications for due dates, high utilization, and expiring points."""
    created_count = await NotificationService.scan_and_generate_alerts(db)
    return {
        "success": True,
        "message": f"Scan completed. Generated {created_count} new smart alerts.",
        "alerts_created": created_count,
    }


@router.get(
    "/settings",
    response_model=NotificationSettingsRead,
    summary="Get notification and Telegram settings",
)
async def get_notification_settings(db: AsyncSession = Depends(get_db)):
    """Fetch current notification and Telegram Bot settings."""
    return await NotificationService.get_settings(db)


@router.put(
    "/settings",
    response_model=NotificationSettingsRead,
    summary="Update notification and Telegram settings",
)
async def update_notification_settings(
    payload: NotificationSettingsUpdate, db: AsyncSession = Depends(get_db)
):
    """Update notification preferences and Telegram Bot configuration."""
    return await NotificationService.update_settings(db, payload)


@router.post(
    "/test-telegram",
    response_model=TelegramTestResponse,
    summary="Send test message to Telegram Bot",
)
async def test_telegram_push(
    payload: Optional[TelegramTestRequest] = None,
    db: AsyncSession = Depends(get_db),
):
    """Send a sample verification message to Telegram chat."""
    token = payload.bot_token if payload else None
    chat_id = payload.chat_id if payload else None
    msg = payload.custom_message if payload else None
    return await NotificationService.test_telegram(db, token, chat_id, msg)
