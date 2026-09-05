from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID

import httpx
from fastapi import HTTPException, status
from sqlalchemy import func, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.notification import (
    Notification,
    NotificationSeverityEnum,
    NotificationSettings,
    NotificationTypeEnum,
)
from app.schemas.notification import (
    NotificationCreate,
    NotificationSettingsUpdate,
    NotificationSummaryRead,
    TelegramTestResponse,
)


class NotificationService:
    """Service layer managing In-App Notifications and Telegram Push Alerts."""

    @staticmethod
    async def get_all(
        db: AsyncSession,
        limit: int = 50,
        unread_only: bool = False,
    ) -> List[Notification]:
        """Fetch notifications ordered by creation timestamp descending."""
        query = select(Notification)
        if unread_only:
            query = query.where(Notification.is_read == False)  # noqa: E712
        query = query.order_by(Notification.created_at.desc()).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def get_summary(db: AsyncSession) -> NotificationSummaryRead:
        """Fetch unread counter and latest notifications for navbar bell icon."""
        # Unread count
        count_stmt = select(func.count(Notification.id)).where(
            Notification.is_read == False  # noqa: E712
        )
        total_stmt = select(func.count(Notification.id))

        unread_count = await db.scalar(count_stmt) or 0
        total_count = await db.scalar(total_stmt) or 0

        # Latest 10
        latest_stmt = (
            select(Notification)
            .order_by(Notification.created_at.desc())
            .limit(10)
        )
        res = await db.execute(latest_stmt)
        items = list(res.scalars().all())

        return NotificationSummaryRead(
            unread_count=unread_count,
            total_count=total_count,
            items=items,
        )

    @staticmethod
    async def mark_as_read(db: AsyncSession, notification_id: UUID) -> bool:
        """Mark a single notification as read."""
        res = await db.execute(
            select(Notification).where(Notification.id == notification_id)
        )
        notif = res.scalar_one_or_none()
        if not notif:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found",
            )
        notif.is_read = True
        await db.commit()
        return True

    @staticmethod
    async def mark_all_as_read(db: AsyncSession) -> int:
        """Mark all unread notifications as read."""
        stmt = text("UPDATE notifications SET is_read = TRUE WHERE is_read = FALSE;")
        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount

    @staticmethod
    async def create(db: AsyncSession, payload: NotificationCreate) -> Notification:
        """Create a new in-app notification record and trigger Telegram push if enabled."""
        notif = Notification(
            user_id=payload.user_id,
            title=payload.title,
            message=payload.message,
            notification_type=payload.notification_type,
            severity=payload.severity,
            action_url=payload.action_url,
            metadata_json=payload.metadata_json or {},
            is_read=False,
        )
        db.add(notif)
        await db.commit()
        await db.refresh(notif)

        # Trigger Telegram push in background
        settings = await NotificationService.get_settings(db)
        if settings and settings.is_telegram_enabled:
            emoji = {
                NotificationSeverityEnum.DANGER: "🔴",
                NotificationSeverityEnum.WARNING: "🟠",
                NotificationSeverityEnum.SUCCESS: "🟢",
                NotificationSeverityEnum.INFO: "ℹ️",
            }.get(payload.severity, "🔔")

            telegram_text = (
                f"{emoji} *{payload.title}*\n\n"
                f"{payload.message}\n\n"
                f"⏱ _Thời gian: {datetime.now().strftime('%d/%m/%Y %H:%M')}_"
            )
            await NotificationService.send_telegram_message(
                settings.telegram_bot_token,
                settings.telegram_chat_id,
                telegram_text,
            )

        return notif

    @staticmethod
    async def get_settings(db: AsyncSession) -> NotificationSettings:
        """Get or initialize notification settings singleton record."""
        res = await db.execute(select(NotificationSettings).limit(1))
        record = res.scalar_one_or_none()
        if not record:
            record = NotificationSettings(
                is_telegram_enabled=False,
                is_in_app_enabled=True,
                remind_days_before=3,
                remind_utilization_threshold=70,
            )
            db.add(record)
            await db.commit()
            await db.refresh(record)
        return record

    @staticmethod
    async def update_settings(
        db: AsyncSession, payload: NotificationSettingsUpdate
    ) -> NotificationSettings:
        """Update notification and Telegram configuration."""
        record = await NotificationService.get_settings(db)
        update_data = payload.model_dump(exclude_unset=True)
        for k, v in update_data.items():
            setattr(record, k, v)
        record.updated_at = func.now()
        await db.commit()
        await db.refresh(record)

        # Signal TelegramBotService to reload configuration immediately
        try:
            from app.services.telegram_bot_service import TelegramBotService
            TelegramBotService.reload()
        except Exception:
            pass

        return record

    @staticmethod
    async def send_telegram_message(
        bot_token: Optional[str],
        chat_id: Optional[str],
        message_text: str,
        reply_markup: Optional[Dict[str, Any]] = None,
        parse_mode: str = "Markdown",
    ) -> Dict[str, Any]:
        """Send message to Telegram via Bot API asynchronously with optional inline keyboard."""
        if not bot_token or not chat_id:
            return {
                "success": False,
                "message": "Thiếu Telegram Bot Token hoặc Chat ID.",
            }

        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload: Dict[str, Any] = {
            "chat_id": chat_id,
            "text": message_text,
            "parse_mode": parse_mode,
        }
        if reply_markup:
            payload["reply_markup"] = reply_markup

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, json=payload)
                data = response.json()
                if response.status_code == 200 and data.get("ok"):
                    return {
                        "success": True,
                        "message": "Gửi tin nhắn Telegram thành công!",
                        "result": data.get("result"),
                    }
                else:
                    return {
                        "success": False,
                        "message": f"Telegram API error: {data.get('description', 'Unknown error')}",
                        "detail": str(data),
                    }
        except Exception as e:
            return {"success": False, "message": f"Lỗi kết nối Telegram: {str(e)}"}

    @staticmethod
    async def edit_telegram_message(
        bot_token: Optional[str],
        chat_id: Optional[str],
        message_id: int,
        message_text: str,
        reply_markup: Optional[Dict[str, Any]] = None,
        parse_mode: str = "Markdown",
    ) -> Dict[str, Any]:
        """Edit an existing Telegram message text and remove or update inline keyboard."""
        if not bot_token or not chat_id:
            return {
                "success": False,
                "message": "Thiếu Telegram Bot Token hoặc Chat ID.",
            }

        url = f"https://api.telegram.org/bot{bot_token}/editMessageText"
        payload: Dict[str, Any] = {
            "chat_id": chat_id,
            "message_id": message_id,
            "text": message_text,
            "parse_mode": parse_mode,
        }
        if reply_markup is not None:
            payload["reply_markup"] = reply_markup

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, json=payload)
                data = response.json()
                if response.status_code == 200 and data.get("ok"):
                    return {
                        "success": True,
                        "message": "Cập nhật tin nhắn Telegram thành công!",
                        "result": data.get("result"),
                    }
                else:
                    return {
                        "success": False,
                        "message": f"Telegram API error: {data.get('description', 'Unknown error')}",
                        "detail": str(data),
                    }
        except Exception as e:
            return {"success": False, "message": f"Lỗi kết nối Telegram: {str(e)}"}

    @staticmethod
    async def answer_telegram_callback_query(
        bot_token: Optional[str],
        callback_query_id: str,
        text: Optional[str] = None,
        show_alert: bool = False,
    ) -> Dict[str, Any]:
        """Acknowledge Telegram callback query from inline buttons."""
        if not bot_token or not callback_query_id:
            return {"success": False, "message": "Thiếu Bot Token hoặc Callback Query ID."}

        url = f"https://api.telegram.org/bot{bot_token}/answerCallbackQuery"
        payload: Dict[str, Any] = {
            "callback_query_id": callback_query_id,
            "show_alert": show_alert,
        }
        if text:
            payload["text"] = text

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, json=payload)
                data = response.json()
                return {
                    "success": response.status_code == 200 and data.get("ok", False),
                    "detail": str(data),
                }
        except Exception as e:
            return {"success": False, "message": f"Lỗi answerCallbackQuery: {str(e)}"}

    @staticmethod
    async def test_telegram(
        db: AsyncSession,
        custom_token: Optional[str] = None,
        custom_chat_id: Optional[str] = None,
        custom_msg: Optional[str] = None,
    ) -> TelegramTestResponse:
        """Test sending a sample message to verify Telegram Bot configuration."""
        settings = await NotificationService.get_settings(db)
        token = custom_token or settings.telegram_bot_token
        chat_id = custom_chat_id or settings.telegram_chat_id

        if not token or not chat_id:
            return TelegramTestResponse(
                success=False,
                message="Vui lòng cung cấp đầy đủ Telegram Bot Token và Chat ID trước khi test.",
            )

        test_content = (
            custom_msg
            or "🔔 *Credit Wallet 2.0 - Test Thông Báo*\n\n"
            "Chúc mừng! Bạn đã cấu hình kết nối Telegram Bot thành công.\n"
            "Hệ thống sẽ tự động gửi thông báo nhắc hạn thanh toán sao kê, kỳ trả góp và cảnh báo rủi ro hạn mức tới đây."
        )

        res = await NotificationService.send_telegram_message(
            token, chat_id, test_content
        )
        return TelegramTestResponse(
            success=res["success"],
            message=res["message"],
            detail=res.get("detail"),
        )

    @staticmethod
    async def scan_and_generate_alerts(db: AsyncSession) -> int:
        """Evaluate business rules across analytical views and generate smart alerts.

        Evaluates:
        1. Upcoming Statement / Installment Due Dates within remind_days_before.
        2. Cards with high credit utilization exceeding remind_utilization_threshold (>70%).
        3. Expiring Reward Points / Cashback in the current billing period.
        """
        settings = await NotificationService.get_settings(db)
        days_ahead = settings.remind_days_before or 3
        util_threshold = settings.remind_utilization_threshold or 70

        alerts_created = 0

        # 1. Scan Upcoming Obligations (Statements and Installments)
        sql_obligations = """
        SELECT * FROM v_upcoming_payment_obligations
        WHERE days_remaining <= :days_ahead
        ORDER BY due_date ASC;
        """
        res_ob = await db.execute(text(sql_obligations), {"days_ahead": days_ahead})
        obligations = res_ob.mappings().all()

        for ob in obligations:
            days = int(ob["days_remaining"])
            amount_due = Decimal(str(ob["total_amount_due"]))
            account_desc = str(ob["card_number_masked"])
            ref_id = str(ob["reference_id"])

            # Check if an alert for this reference was already generated in the last 24h
            sql_check = """
            SELECT 1 FROM notifications
            WHERE metadata->>'reference_id' = :ref_id
              AND created_at > (CURRENT_TIMESTAMP - INTERVAL '24 hours')
            LIMIT 1;
            """
            check_res = await db.execute(text(sql_check), {"ref_id": ref_id})
            if not check_res.scalar_one_or_none():
                # Generate Notification
                severity = (
                    NotificationSeverityEnum.DANGER
                    if days <= 1
                    else NotificationSeverityEnum.WARNING
                )
                time_str = (
                    "HÔM NAY"
                    if days == 0
                    else (f"trong {days} ngày tới ({ob['due_date']})")
                )
                title = f"Nhắc Hạn Thanh Toán: {account_desc}"
                message = (
                    f"Khoản nợ {ob['obligation_type']} trị giá "
                    f"{amount_due:,.0f} VNĐ sẽ đến hạn thanh toán {time_str}. "
                    f"Vui lòng thanh toán trước hạn để tránh phát sinh phí phạt & lãi suất."
                )

                await NotificationService.create(
                    db,
                    NotificationCreate(
                        title=title,
                        message=message,
                        notification_type=NotificationTypeEnum.PAYMENT_DUE,
                        severity=severity,
                        action_url=(
                            "/statements"
                            if ob["obligation_type"] == "STATEMENT"
                            else "/installments"
                        ),
                        metadata_json={
                            "reference_id": ref_id,
                            "obligation_type": ob["obligation_type"],
                            "amount_due": float(amount_due),
                            "due_date": str(ob["due_date"]),
                        },
                    ),
                )
                alerts_created += 1

        # 2. Scan Credit Utilization (> threshold)
        sql_util = """
        SELECT * FROM v_credit_utilization
        WHERE utilization_percentage >= :thresh;
        """
        res_util = await db.execute(text(sql_util), {"thresh": util_threshold})
        high_cards = res_util.mappings().all()

        for card in high_cards:
            acc_id = str(card["account_id"])
            util_pct = float(card["utilization_percentage"])
            # Check if alert generated in last 3 days for this card
            sql_check_util = """
            SELECT 1 FROM notifications
            WHERE metadata->>'account_id' = :acc_id
              AND notification_type = 'UTILIZATION_HIGH'
              AND created_at > (CURRENT_TIMESTAMP - INTERVAL '3 days')
            LIMIT 1;
            """
            chk = await db.execute(text(sql_check_util), {"acc_id": acc_id})
            if not chk.scalar_one_or_none():
                title = f"Cảnh Báo Hạn Mức Cao: {card['account_name']}"
                message = (
                    f"Thẻ {card['account_name']} ({card['card_number_masked']}) đã sử dụng "
                    f"{util_pct:.1f}% hạn mức (Dư nợ: {Decimal(str(card['current_balance'])):,.0f} VNĐ / Hạn mức: {Decimal(str(card['credit_limit'])):,.0f} VNĐ). "
                    f"Vượt ngưỡng an toàn 70%, có thể ảnh hưởng đến điểm tín dụng CIC."
                )
                await NotificationService.create(
                    db,
                    NotificationCreate(
                        title=title,
                        message=message,
                        notification_type=NotificationTypeEnum.UTILIZATION_HIGH,
                        severity=NotificationSeverityEnum.DANGER,
                        action_url="/accounts",
                        metadata_json={"account_id": acc_id, "utilization": util_pct},
                    ),
                )
                alerts_created += 1

        # 3. Scan Expiring Rewards
        sql_reward = """
        SELECT r.*, a.account_name, a.card_number_masked 
        FROM reward_ledgers r
        JOIN accounts a ON r.account_id = a.id
        WHERE r.expiring_amount > 0 
          AND r.expiration_date IS NOT NULL
          AND r.expiration_date <= (CURRENT_DATE + INTERVAL '30 days');
        """
        res_rw = await db.execute(text(sql_reward))
        expiring_rewards = res_rw.mappings().all()

        for rw in expiring_rewards:
            rw_id = str(rw["id"])
            sql_check_rw = """
            SELECT 1 FROM notifications
            WHERE metadata->>'reward_id' = :rw_id
              AND created_at > (CURRENT_TIMESTAMP - INTERVAL '7 days')
            LIMIT 1;
            """
            chk_rw = await db.execute(text(sql_check_rw), {"rw_id": rw_id})
            if not chk_rw.scalar_one_or_none():
                exp_amt = float(rw["expiring_amount"])
                r_type = rw["reward_type"]
                title = f"Cảnh Báo Điểm Thưởng Sắp Hết Hạn: {rw['account_name']}"
                message = (
                    f"Bạn có {exp_amt:,.0f} {r_type} trên thẻ {rw['account_name']} "
                    f"sẽ hết hạn vào ngày {rw['expiration_date']}. Hãy quy đổi trước khi hết hạn!"
                )
                await NotificationService.create(
                    db,
                    NotificationCreate(
                        title=title,
                        message=message,
                        notification_type=NotificationTypeEnum.REWARD_EXPIRING,
                        severity=NotificationSeverityEnum.WARNING,
                        action_url="/rewards",
                        metadata_json={"reward_id": rw_id, "expiring_amount": exp_amt},
                    ),
                )
                alerts_created += 1

        return alerts_created
