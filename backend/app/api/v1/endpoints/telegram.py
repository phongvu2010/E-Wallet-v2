"""Telegram Bot Router for Webhook updates, service status, and configuration reloads."""

from typing import Any, Dict

from fastapi import APIRouter, BackgroundTasks, Request, status

from app.services.telegram_bot_service import TelegramBotService

router = APIRouter()


@router.get(
    "/status",
    summary="Get Telegram Bot service status & polling worker diagnostics",
)
async def get_telegram_status():
    """Retrieve runtime state of Telegram Bot background polling and active transaction drafts."""
    return TelegramBotService.get_status()


@router.post(
    "/reload",
    summary="Reload Telegram Bot configuration & restart polling worker",
)
async def reload_telegram_bot():
    """Trigger immediate reload of Telegram Bot token/chat_id and restart background polling."""
    TelegramBotService.reload()
    return {
        "success": True,
        "message": "Telegram Bot service reloaded successfully.",
        "status": TelegramBotService.get_status(),
    }


@router.post(
    "/webhook",
    status_code=status.HTTP_200_OK,
    summary="Telegram Webhook Receiver Endpoint",
)
async def telegram_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
):
    """Receive and dispatch webhook events directly from Telegram Bot API."""
    try:
        update_data: Dict[str, Any] = await request.json()
    except Exception:
        return {"ok": False, "error": "Invalid JSON payload"}

    # Process in background task so webhook responds immediately with 200 OK
    inst = TelegramBotService.get_instance()
    background_tasks.add_task(inst.process_update, update_data)

    return {"ok": True}
