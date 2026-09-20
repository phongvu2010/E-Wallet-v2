import hmac
from typing import Any, Dict

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, status

from app.core.config import settings
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
    """Receive and dispatch webhook events directly from Telegram Bot API with optional secret token verification."""
    # Security: Verify secret token if configured
    if settings.TELEGRAM_WEBHOOK_SECRET:
        secret_header = request.headers.get("X-Telegram-Bot-Api-Secret-Token") or ""
        if not hmac.compare_digest(secret_header, settings.TELEGRAM_WEBHOOK_SECRET):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid or missing Telegram webhook secret token",
            )

    try:
        update_data: Dict[str, Any] = await request.json()
    except Exception:
        return {"ok": False, "error": "Invalid JSON payload"}

    # Process in background task so webhook responds immediately with 200 OK
    inst = TelegramBotService.get_instance()
    background_tasks.add_task(inst.process_update, update_data)

    return {"ok": True}
