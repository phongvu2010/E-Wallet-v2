"""Telegram Bot Service for 2-way conversational interaction, financial lookups, and transaction logging.

Supports:
1. Long-polling background worker (zero-config, works on local development & production).
2. Webhook receiver endpoint (POST /api/v1/telegram/webhook).
3. Natural language transaction intent parsing via rule-based NLP / Gemini Copilot.
4. Interactive Telegram Inline Keyboard confirmation cards ([✅ Xác nhận Ghi Sổ] / [❌ Hủy bỏ]).
5. Direct execution of `TransactionService.create` upon 1-click confirmation.
6. Quick lookup commands (/du_no, /tai_san, /sap_den_han, /chi_tieu, /start, /help).
"""

import asyncio
from datetime import date, datetime
from decimal import Decimal
import time
from typing import Any, Dict, List, Optional
import uuid

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.transaction import TransactionTypeEnum
from app.schemas.ai import AIChatRequest, AITransactionDraft
from app.schemas.transaction import TransactionCreate
from app.services.ai_assistant_service import AIAssistantService
from app.services.notification_service import NotificationService
from app.services.transaction_service import TransactionService


class TelegramBotService:
    """Service managing Telegram 2-way bot polling, webhook processing, interactive buttons, and transaction drafting."""

    _instance: Optional["TelegramBotService"] = None
    _task: Optional[asyncio.Task] = None
    _is_running: bool = False
    _last_poll_at: Optional[datetime] = None
    _last_error: Optional[str] = None
    _last_update_id: int = 0

    # In-memory transaction draft cache with TTL (15 minutes)
    # Key: draft_id (str/UUID), Value: { 'draft': AITransactionDraft, 'created_at': float, 'chat_id': str, ... }
    _draft_cache: Dict[str, Dict[str, Any]] = {}
    _draft_ttl_seconds: float = 900.0  # 15 minutes

    @classmethod
    def get_instance(cls) -> "TelegramBotService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    def get_status(cls) -> Dict[str, Any]:
        """Return real-time diagnostic status of the Telegram Bot Service."""
        inst = cls.get_instance()
        # Clean expired drafts
        inst._cleanup_expired_drafts()
        return {
            "is_running": inst._is_running,
            "polling_active": inst._task is not None and not inst._task.done(),
            "active_drafts_count": len(inst._draft_cache),
            "last_poll_at": inst._last_poll_at.isoformat() if inst._last_poll_at else None,
            "last_error": inst._last_error,
            "last_update_id": inst._last_update_id,
        }

    @classmethod
    def reload(cls):
        """Signal background polling worker to restart or reload settings immediately."""
        inst = cls.get_instance()
        if inst._task and not inst._task.done():
            inst._task.cancel()
        if inst._is_running:
            inst._task = asyncio.create_task(inst._polling_loop())

    @classmethod
    def start(cls):
        """Start background Telegram long-polling worker."""
        inst = cls.get_instance()
        inst._is_running = True
        if inst._task is None or inst._task.done():
            inst._task = asyncio.create_task(inst._polling_loop())

    @classmethod
    async def stop(cls):
        """Gracefully stop background Telegram polling worker."""
        inst = cls.get_instance()
        inst._is_running = False
        if inst._task and not inst._task.done():
            inst._task.cancel()
            try:
                await inst._task
            except asyncio.CancelledError:
                pass
            inst._task = None

    # -------------------------------------------------------------------------
    # Draft Cache Management
    # -------------------------------------------------------------------------

    def _cleanup_expired_drafts(self):
        """Purge drafts older than TTL."""
        now = time.time()
        expired_keys = [
            k for k, v in self._draft_cache.items()
            if (now - v.get("created_at", 0)) > self._draft_ttl_seconds
        ]
        for k in expired_keys:
            self._draft_cache.pop(k, None)

    def _store_draft(self, draft: AITransactionDraft, chat_id: str) -> str:
        """Store draft in memory and return unique draft ID."""
        self._cleanup_expired_drafts()
        draft_id = str(uuid.uuid4())[:8]  # Short 8-char UUID for Telegram callback_data size limits
        self._draft_cache[draft_id] = {
            "draft": draft,
            "chat_id": str(chat_id),
            "created_at": time.time(),
        }
        return draft_id

    def _get_draft(self, draft_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve active draft by ID."""
        self._cleanup_expired_drafts()
        return self._draft_cache.get(draft_id)

    def _remove_draft(self, draft_id: str):
        """Remove draft from cache."""
        self._draft_cache.pop(draft_id, None)

    # -------------------------------------------------------------------------
    # Background Polling Loop
    # -------------------------------------------------------------------------

    async def _polling_loop(self):
        """Long-polling loop for Telegram Bot updates."""
        print("[TelegramBot] Polling service starting...")
        # Brief warmup delay
        await asyncio.sleep(2)

        while self._is_running:
            self._last_poll_at = datetime.now()
            bot_token = None
            try:
                # Fetch settings
                async with AsyncSessionLocal() as session:
                    settings = await NotificationService.get_settings(session)

                if not settings or not settings.is_telegram_enabled or not settings.telegram_bot_token:
                    # Telegram is disabled or token not set, wait and check again
                    await asyncio.sleep(10)
                    continue

                bot_token = settings.telegram_bot_token.strip()
                url = f"https://api.telegram.org/bot{bot_token}/getUpdates"
                params = {
                    "offset": self._last_update_id + 1 if self._last_update_id > 0 else 0,
                    "timeout": 25,
                    "allowed_updates": ["message", "callback_query"],
                }

                async with httpx.AsyncClient(timeout=35.0) as client:
                    resp = await client.get(url, params=params)
                    if resp.status_code == 200:
                        data = resp.json()
                        if data.get("ok"):
                            updates = data.get("result", [])
                            for update in updates:
                                update_id = update.get("update_id", 0)
                                if update_id > self._last_update_id:
                                    self._last_update_id = update_id

                                # Process update
                                await self.process_update(update, bot_token=bot_token)
                        else:
                            self._last_error = data.get("description", "Unknown Telegram API response")
                            await asyncio.sleep(5)
                    elif resp.status_code == 409:
                        # Conflict: another instance or webhook is active
                        self._last_error = "Webhook is active or another getUpdates instance is running."
                        await asyncio.sleep(15)
                    elif resp.status_code == 401:
                        self._last_error = "Invalid Telegram Bot Token."
                        await asyncio.sleep(30)
                    else:
                        self._last_error = f"HTTP {resp.status_code}: {resp.text}"
                        await asyncio.sleep(5)

            except asyncio.CancelledError:
                break
            except Exception as e:
                self._last_error = str(e)
                print(f"[TelegramBot] Polling error: {e}")
                await asyncio.sleep(5)

        print("[TelegramBot] Polling service stopped.")

    # -------------------------------------------------------------------------
    # Update Dispatcher
    # -------------------------------------------------------------------------

    async def process_update(self, update: Dict[str, Any], bot_token: Optional[str] = None):
        """Process incoming Telegram update (from polling or webhook)."""
        async with AsyncSessionLocal() as session:
            settings = await NotificationService.get_settings(session)
            token = bot_token or (settings.telegram_bot_token if settings else None)

            if not token:
                return

            if "message" in update:
                await self._handle_message(session, token, settings, update["message"])
            elif "callback_query" in update:
                await self._handle_callback_query(session, token, settings, update["callback_query"])

    # -------------------------------------------------------------------------
    # Message Handler
    # -------------------------------------------------------------------------

    async def _handle_message(
        self,
        db: AsyncSession,
        bot_token: str,
        settings: Any,
        message: Dict[str, Any],
    ):
        """Handle incoming text message from Telegram user."""
        chat_id = str(message.get("chat", {}).get("id", ""))
        message_id = message.get("message_id")
        text_input = (message.get("text") or "").strip()

        if not chat_id or not text_input:
            return

        configured_chat_id = (settings.telegram_chat_id or "").strip()

        # Security check: verify if sender matches configured Chat ID
        if configured_chat_id and str(chat_id) != configured_chat_id:
            msg = (
                "🔒 *Tài khoản Telegram chưa được phân quyền!*\n\n"
                f"• Chat ID hiện tại của bạn: `{chat_id}`\n\n"
                "👉 Để kích hoạt tính năng ra lệnh thêm giao dịch và tra cứu tài chính từ Telegram, "
                "vui lòng copy **Chat ID** trên và dán vào mục **Cài đặt (Settings) > Telegram Bot** "
                "trên ứng dụng Credit Wallet 2.0."
            )
            await NotificationService.send_telegram_message(bot_token, chat_id, msg)
            return

        # Handle Commands
        lower = text_input.lower()

        # 1. /start & /help
        if lower.startswith("/start") or lower.startswith("/help") or lower == "help" or lower == "menu":
            help_text = (
                "🤖 *Xin chào! Tôi là Trợ Lý AI Tài Chính Credit Wallet 2.0*\n\n"
                "Tôi có thể giúp bạn ghi chép chi tiêu siêu tốc và tra cứu tài chính tức thời ngay tại đây:\n\n"
                "✍️ *1. Ra Lệnh Thêm Giao Dịch Tự Nhiên:*\n"
                "• `Ăn trưa 45k tiền mặt`\n"
                "• `Cafe Highland 50k thẻ Techcombank`\n"
                "• `Chuyển 2tr từ VCB sang MoMo phí 1k`\n"
                "• `Nhận lương 25tr vào Vietcombank`\n"
                "• `Trả nợ thẻ TPBank 5 triệu`\n"
                "• `Đổ xăng 80k tiền mặt hôm qua`\n\n"
                "💳 *2. Tra Cứu Tài Chính Nhanh:*\n"
                "• `/du_no` : Dư nợ & hạn mức khả dụng các thẻ tín dụng\n"
                "• `/tai_san` : Tổng tài sản ròng Net Worth & số dư các ví\n"
                "• `/sap_den_han` : Các khoản nợ/kỳ trả góp đến hạn 30 ngày\n"
                "• `/chi_tieu` : Top hạng mục chi tiêu tháng này\n\n"
                "👉 *Hãy gửi tin nhắn hoặc ra lệnh bất kỳ lúc nào để trải nghiệm!*"
            )
            await NotificationService.send_telegram_message(bot_token, chat_id, help_text)
            return

        # 2. Financial Lookup Commands
        if lower == "/du_no" or lower.startswith("/du_no"):
            ctx = await AIAssistantService.get_financial_context(db, force_refresh=True)
            cards = [a for a in ctx.get("accounts_and_cards", []) if not a.get("is_asset")]
            nw = ctx.get("net_worth_overview", {})

            total_limit = nw.get("total_credit_limit", sum(c.get("credit_limit", 0) for c in cards))
            total_debt = nw.get("total_credit_debt", sum(c.get("live_current_balance", 0) for c in cards))
            avail = total_limit - total_debt
            util = (total_debt / total_limit * 100) if total_limit > 0 else 0

            msg = (
                "📊 *BÁO CÁO DƯ NỢ & HẠN MỨC THẺ TÍN DỤNG*\n\n"
                f"• Tổng hạn mức: *{total_limit:,.0f} VNĐ*\n"
                f"• Tổng dư nợ hiện tại: *{total_debt:,.0f} VNĐ*\n"
                f"• Hạn mức khả dụng: *{avail:,.0f} VNĐ*\n"
                f"• Tỷ lệ sử dụng hạn mức: *{util:.1f}%* "
                f"({'🟢 An toàn (<30%)' if util < 30 else '🟠 Cần chú ý (>50%)'})\n\n"
                "*Chi tiết từng thẻ:*\n"
            )
            for c in cards:
                c_name = c.get("account_name", "Thẻ tín dụng")
                c_bank = c.get("bank_name", "")
                c_bal = c.get("live_current_balance", 0)
                c_lim = c.get("credit_limit", 0)
                c_util = c.get("live_utilization_percentage", 0)
                c_risk = c.get("live_risk_level", "SAFE")
                risk_icon = "🟢" if c_risk == "SAFE" else ("🟠" if c_risk == "WARNING" else "🔴")
                msg += f"{risk_icon} *{c_name}* ({c_bank}): Dư nợ *{c_bal:,.0f}đ* / Hạn mức {c_lim:,.0f}đ ({c_util:.1f}%)\n"

            await NotificationService.send_telegram_message(bot_token, chat_id, msg)
            return

        if lower == "/tai_san" or lower.startswith("/tai_san"):
            ctx = await AIAssistantService.get_financial_context(db, force_refresh=True)
            nw = ctx.get("net_worth_overview", {})
            assets = [a for a in ctx.get("accounts_and_cards", []) if a.get("is_asset")]

            total_assets = nw.get("total_liquid_assets", sum(a.get("live_current_balance", 0) for a in assets))
            total_debt = nw.get("total_credit_debt", 0)
            net_worth = nw.get("net_worth", total_assets - total_debt)

            msg = (
                "💎 *BÁO CÁO TỔNG TÀI SẢN RÒNG (NET WORTH)*\n\n"
                f"• 💰 *Tổng tài sản có (Liquid Assets):* *{total_assets:,.0f} VNĐ*\n"
                f"  - Tiền gửi Ngân hàng: {nw.get('total_bank_assets', 0):,.0f}đ\n"
                f"  - Ví tiền mặt: {nw.get('total_cash_assets', 0):,.0f}đ\n"
                f"  - Ví điện tử: {nw.get('total_ewallet_assets', 0):,.0f}đ\n"
                f"• 💳 *Tổng dư nợ thẻ tín dụng:* *{total_debt:,.0f} VNĐ*\n"
                f"• 🏆 *TÀI SẢN RÒNG (NET WORTH):* *{net_worth:,.0f} VNĐ*\n\n"
                "*Số dư các tài khoản & ví:*\n"
            )
            for a in assets:
                a_name = a.get("account_name", "Ví")
                a_bank = a.get("bank_name", "")
                a_bal = a.get("live_current_balance", 0)
                msg += f"• *{a_name}* ({a_bank}): *{a_bal:,.0f} VNĐ*\n"

            await NotificationService.send_telegram_message(bot_token, chat_id, msg)
            return

        if lower == "/sap_den_han" or lower.startswith("/sap_den_han"):
            ctx = await AIAssistantService.get_financial_context(db, force_refresh=True)
            obs = ctx.get("upcoming_obligations_30d", [])

            if not obs:
                msg = "🎉 *Tuyệt vời!* Bạn không có khoản nợ sao kê hoặc kỳ trả góp nào đến hạn thanh toán trong vòng 30 ngày tới."
            else:
                total_due = sum(o.get("total_amount_due", 0) for o in obs)
                msg = (
                    "⏰ *CÁC NGHĨA VỤ THANH TOÁN SẮP ĐẾN HẠN (30 ngày)*\n\n"
                    f"• Tổng số tiền cần thanh toán: *{total_due:,.0f} VNĐ*\n\n"
                    "*Chi tiết các khoản:*\n"
                )
                for o in obs:
                    days = o.get("days_remaining", 0)
                    time_desc = "🔴 HÔM NAY" if days == 0 else f"còn {days} ngày"
                    msg += (
                        f"• *{o.get('account_name')}* ({o.get('obligation_type')}): "
                        f"*{o.get('total_amount_due', 0):,.0f} VNĐ* - Hạn chót: `{o.get('due_date')}` ({time_desc})\n"
                    )
                msg += "\n💡 *Khuyến nghị: Hãy thanh toán trước hạn 1-2 ngày để tránh phí phạt & lãi suất chậm nộp.*"

            await NotificationService.send_telegram_message(bot_token, chat_id, msg)
            return

        if lower == "/chi_tieu" or lower.startswith("/chi_tieu"):
            ctx = await AIAssistantService.get_financial_context(db, force_refresh=True)
            spendings = ctx.get("current_month_top_spending", [])
            total_sp = sum(s.get("total_spending", 0) for s in spendings)

            msg = (
                "🛍️ *CƠ CẤU CHI TIÊU THÁNG NÀY*\n\n"
                f"• Tổng chi tiêu ghi nhận: *{total_sp:,.0f} VNĐ*\n\n"
                "*Top hạng mục chi tiêu nhiều nhất:*\n"
            )
            for s in spendings:
                p_cat = f"{s.get('parent_category_name')} > " if s.get("parent_category_name") else ""
                msg += f"• *{p_cat}{s.get('category_name')}*: *{s.get('total_spending', 0):,.0f} VNĐ* ({s.get('transaction_count', 0)} giao dịch)\n"

            msg += "\n💡 *Bạn có thể ra lệnh ghi sổ nhanh bất kỳ lúc nào, ví dụ: 'Ăn trưa 45k tiền mặt' hoặc 'Cafe 50k thẻ Techcombank'!*"
            await NotificationService.send_telegram_message(bot_token, chat_id, msg)
            return

        # 3. Process Natural Language Transaction Command
        ctx = await AIAssistantService.get_financial_context(db)
        parsed_intent = AIAssistantService._parse_transaction_intent_rule_based(text_input, ctx)

        if parsed_intent and parsed_intent.transaction_draft:
            draft = parsed_intent.transaction_draft
            draft_id = self._store_draft(draft, chat_id)

            type_labels = {
                TransactionTypeEnum.PURCHASE: "Chi tiêu 💸",
                TransactionTypeEnum.INCOME: "Thu nhập 💰",
                TransactionTypeEnum.TRANSFER: "Chuyển tiền 🔄",
                TransactionTypeEnum.REPAYMENT: "Thanh toán nợ 💳",
                TransactionTypeEnum.FEE: "Phí dịch vụ 🧾",
                TransactionTypeEnum.INTEREST: "Lãi suất 📈",
                TransactionTypeEnum.CASHBACK_CREDIT: "Hoàn tiền Cashback 🎁",
                TransactionTypeEnum.REFUND: "Hủy đơn / Hoàn tiền ↩️",
            }
            type_str = type_labels.get(draft.transaction_type, "Giao dịch")

            fee_info = f" *(Phí: {draft.fee:,.0f}đ)*" if (draft.fee and draft.fee > 0) else ""
            dst_info = f" ➡️ *{draft.transfer_to_account_name}*" if (draft.transaction_type == TransactionTypeEnum.TRANSFER and draft.transfer_to_account_name) else ""
            cat_display = f"{draft.parent_category_name} > " if draft.parent_category_name else ""
            cat_display += draft.category_name or "Chi tiêu khác"

            card_text = (
                "✨ *XÁC NHẬN GIAO DỊCH MỚI*\n\n"
                f"• *Loại:* {type_str}\n"
                f"• *Số tiền:* *{draft.amount:,.0f} VNĐ*{fee_info}\n"
                f"• *Tài khoản nguồn:* *{draft.account_name}*{dst_info}\n"
                f"• *Danh mục:* `{cat_display}`\n"
                f"• *Ngày ghi nhận:* `{draft.transaction_date.strftime('%d/%m/%Y')}`\n"
                f"• *Nội dung:* _{draft.raw_description}_\n\n"
                "👉 *Vui lòng nhấn [✅ Xác nhận Ghi Sổ] bên dưới để lưu vào sổ cái:*"
            )

            reply_markup = {
                "inline_keyboard": [
                    [
                        {"text": "✅ Xác nhận Ghi Sổ", "callback_data": f"confirm_tx:{draft_id}"},
                        {"text": "❌ Hủy bỏ", "callback_data": f"cancel_tx:{draft_id}"},
                    ]
                ]
            }

            await NotificationService.send_telegram_message(
                bot_token, chat_id, card_text, reply_markup=reply_markup
            )
            return

        # 4. Fallback to conversational AI Copilot (Gemini / rule-based general questions)
        ai_resp = await AIAssistantService.chat(
            db,
            AIChatRequest(
                message=text_input,
                include_financial_context=True,
            ),
        )

        if ai_resp.transaction_draft:
            draft = ai_resp.transaction_draft
            draft_id = self._store_draft(draft, chat_id)
            type_str = draft.transaction_type.value if hasattr(draft.transaction_type, "value") else str(draft.transaction_type)
            reply_markup = {
                "inline_keyboard": [
                    [
                        {"text": "✅ Xác nhận Ghi Sổ", "callback_data": f"confirm_tx:{draft_id}"},
                        {"text": "❌ Hủy bỏ", "callback_data": f"cancel_tx:{draft_id}"},
                    ]
                ]
            }
            await NotificationService.send_telegram_message(
                bot_token, chat_id, ai_resp.reply, reply_markup=reply_markup
            )
        else:
            await NotificationService.send_telegram_message(bot_token, chat_id, ai_resp.reply)

    # -------------------------------------------------------------------------
    # Callback Query Handler (Inline Keyboard Button Clicks)
    # -------------------------------------------------------------------------

    async def _handle_callback_query(
        self,
        db: AsyncSession,
        bot_token: str,
        settings: Any,
        callback_query: Dict[str, Any],
    ):
        """Handle inline button clicks from Telegram messages."""
        cb_id = callback_query.get("id")
        data = callback_query.get("data", "")
        from_user = callback_query.get("from", {})
        sender_id = str(from_user.get("id", ""))
        message = callback_query.get("message", {})
        chat_id = str(message.get("chat", {}).get("id", ""))
        message_id = message.get("message_id")

        if not cb_id or not data or not chat_id or not message_id:
            return

        configured_chat_id = (settings.telegram_chat_id or "").strip()
        if configured_chat_id and sender_id != configured_chat_id and chat_id != configured_chat_id:
            await NotificationService.answer_telegram_callback_query(
                bot_token, cb_id, text="⚠️ Bạn không có quyền thao tác trên tài khoản này.", show_alert=True
            )
            return

        # 1. Confirm Transaction
        if data.startswith("confirm_tx:"):
            draft_id = data.split(":", 1)[1]
            cached = self._get_draft(draft_id)

            if not cached or not cached.get("draft"):
                await NotificationService.answer_telegram_callback_query(
                    bot_token, cb_id, text="⚠️ Giao dịch nháp đã hết hạn hoặc không tồn tại.", show_alert=True
                )
                await NotificationService.edit_telegram_message(
                    bot_token,
                    chat_id,
                    message_id,
                    "⚠️ *Giao dịch nháp đã hết hạn hoặc đã được xử lý trước đó.*",
                    reply_markup=None,
                )
                return

            draft: AITransactionDraft = cached["draft"]

            try:
                # Construct TransactionCreate payload
                payload = TransactionCreate(
                    account_id=draft.account_id,
                    transaction_date=draft.transaction_date,
                    post_date=draft.post_date or draft.transaction_date,
                    amount=draft.amount,
                    fee=draft.fee or Decimal("0.00"),
                    total_amount=draft.total_amount,
                    transaction_type=draft.transaction_type,
                    category_id=draft.category_id,
                    merchant_name=draft.merchant_name,
                    raw_description=draft.raw_description,
                    note=draft.note,
                    transfer_to_account_id=draft.transfer_to_account_id,
                )

                created_tx = await TransactionService.create(db, payload)
                # Remove from cache
                self._remove_draft(draft_id)

                # Acknowledge callback
                await NotificationService.answer_telegram_callback_query(
                    bot_token, cb_id, text="✅ Đã ghi sổ cái thành công!"
                )

                # Format successful update message
                type_labels = {
                    TransactionTypeEnum.PURCHASE: "Chi tiêu 💸",
                    TransactionTypeEnum.INCOME: "Thu nhập 💰",
                    TransactionTypeEnum.TRANSFER: "Chuyển tiền 🔄",
                    TransactionTypeEnum.REPAYMENT: "Thanh toán nợ 💳",
                    TransactionTypeEnum.FEE: "Phí dịch vụ 🧾",
                    TransactionTypeEnum.INTEREST: "Lãi suất 📈",
                    TransactionTypeEnum.CASHBACK_CREDIT: "Hoàn tiền Cashback 🎁",
                    TransactionTypeEnum.REFUND: "Hủy đơn / Hoàn tiền ↩️",
                }
                type_str = type_labels.get(draft.transaction_type, "Giao dịch")
                fee_info = f" *(Phí: {draft.fee:,.0f}đ)*" if (draft.fee and draft.fee > 0) else ""
                dst_info = f" ➡️ *{draft.transfer_to_account_name}*" if (draft.transaction_type == TransactionTypeEnum.TRANSFER and draft.transfer_to_account_name) else ""
                cat_display = f"{draft.parent_category_name} > " if draft.parent_category_name else ""
                cat_display += draft.category_name or "Chi tiêu khác"

                success_msg = (
                    "✅ *ĐÃ GHI SỔ CÁI THÀNH CÔNG!*\n\n"
                    f"• *Loại:* {type_str}\n"
                    f"• *Số tiền:* *{draft.amount:,.0f} VNĐ*{fee_info}\n"
                    f"• *Tài khoản:* *{draft.account_name}*{dst_info}\n"
                    f"• *Danh mục:* `{cat_display}`\n"
                    f"• *Ngày ghi nhận:* `{draft.transaction_date.strftime('%d/%m/%Y')}`\n"
                    f"• *Nội dung:* _{draft.raw_description}_\n"
                    f"• *Mã giao dịch:* `{created_tx.id}`\n\n"
                    "🎉 *Số dư và hạn mức live balance của các tài khoản đã được tự động cập nhật lại.*"
                )

                await NotificationService.edit_telegram_message(
                    bot_token,
                    chat_id,
                    message_id,
                    success_msg,
                    reply_markup=None,
                )

            except Exception as e:
                await NotificationService.answer_telegram_callback_query(
                    bot_token, cb_id, text=f"❌ Lỗi ghi sổ: {str(e)}", show_alert=True
                )

        # 2. Cancel Transaction
        elif data.startswith("cancel_tx:"):
            draft_id = data.split(":", 1)[1]
            self._remove_draft(draft_id)

            await NotificationService.answer_telegram_callback_query(
                bot_token, cb_id, text="❌ Đã hủy giao dịch nháp."
            )

            cancel_msg = (
                "❌ *ĐÃ HỦY GIAO DỊCH NHÁP*\n\n"
                "Giao dịch đã được hủy bỏ và không lưu vào sổ cái. "
                "Bạn có thể gửi câu lệnh mới bất kỳ lúc nào!"
            )
            await NotificationService.edit_telegram_message(
                bot_token,
                chat_id,
                message_id,
                cancel_msg,
                reply_markup=None,
            )


telegram_bot_service = TelegramBotService.get_instance()
