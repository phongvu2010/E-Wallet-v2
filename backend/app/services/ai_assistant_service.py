import json
import os
from decimal import Decimal
from typing import Any, Dict, List, Optional

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

import time

from app.schemas.ai import AIChatMessage, AIChatRequest, AIChatResponse


class AIAssistantService:
    """Intelligent Financial Advisor Service using Google Gemini API with fallback."""

    # In-memory financial context cache with 30s TTL
    _context_cache: Optional[Dict[str, Any]] = None
    _context_cache_time: float = 0.0
    _CACHE_TTL_SECONDS: float = 30.0

    @staticmethod
    async def get_financial_context(
        db: AsyncSession, force_refresh: bool = False
    ) -> Dict[str, Any]:
        """Aggregate current live financial metrics from database views to feed into AI system prompt.

        Caches the aggregated dictionary for 30 seconds to optimize response speed during chat turns.
        """
        now = time.time()
        if (
            not force_refresh
            and AIAssistantService._context_cache is not None
            and (now - AIAssistantService._context_cache_time) < AIAssistantService._CACHE_TTL_SECONDS
        ):
            return AIAssistantService._context_cache
        # 1. Accounts Live Balances (Both Asset accounts and Credit cards)
        sql_cards = """
        SELECT account_name, account_type, is_asset, bank_name, card_number_masked, credit_limit,
               live_current_balance, live_available_limit, live_utilization_percentage, live_risk_level
        FROM v_account_live_balance
        WHERE status = 'ACTIVE'
        ORDER BY is_asset DESC, live_current_balance DESC;
        """
        res_cards = await db.execute(text(sql_cards))
        cards = [dict(r) for r in res_cards.mappings().all()]

        # 1.1 Net Worth Overview
        sql_nw = "SELECT * FROM v_net_worth_overview;"
        res_nw = await db.execute(text(sql_nw))
        nw_row = res_nw.mappings().one_or_none()
        nw_dict = dict(nw_row) if nw_row else {}

        # 2. Upcoming Obligations
        sql_ob = """
        SELECT obligation_type, account_name, due_date, days_remaining, total_amount_due
        FROM v_upcoming_payment_obligations
        WHERE days_remaining <= 30
        ORDER BY due_date ASC;
        """
        res_ob = await db.execute(text(sql_ob))
        obligations = [dict(r) for r in res_ob.mappings().all()]

        # 3. Monthly Spending by category
        sql_spending = """
        SELECT category_name, parent_category_name, transaction_count, total_spending
        FROM v_monthly_category_spending
        WHERE month = DATE_TRUNC('month', CURRENT_DATE)::DATE
        ORDER BY total_spending DESC
        LIMIT 6;
        """
        res_spending = await db.execute(text(sql_spending))
        spending = [dict(r) for r in res_spending.mappings().all()]

        # 4. Installments Forecast
        sql_inst = """
        SELECT billing_month, active_plans_count, total_monthly_payment
        FROM v_installment_monthly_forecast
        LIMIT 4;
        """
        res_inst = await db.execute(text(sql_inst))
        installments = [dict(r) for r in res_inst.mappings().all()]

        # Convert Decimals and dates to strings
        def sanitize(obj):
            if isinstance(obj, Decimal):
                return float(obj)
            if hasattr(obj, "isoformat"):
                return obj.isoformat()
            return obj

        ctx = {
            "net_worth_overview": {k: sanitize(v) for k, v in nw_dict.items()},
            "accounts_and_cards": [{k: sanitize(v) for k, v in c.items()} for c in cards],
            "upcoming_obligations_30d": [
                {k: sanitize(v) for k, v in o.items()} for o in obligations
            ],
            "current_month_top_spending": [
                {k: sanitize(v) for k, v in s.items()} for s in spending
            ],
            "installment_forecast": [
                {k: sanitize(v) for k, v in i.items()} for i in installments
            ],
        }

        AIAssistantService._context_cache = ctx
        AIAssistantService._context_cache_time = time.time()
        return ctx

    @staticmethod
    def _generate_rule_based_reply(query: str, ctx: Dict[str, Any]) -> AIChatResponse:
        """Intelligent local fallback response generator when Gemini API Key is not set."""
        q_lower = query.lower()
        nw = ctx.get("net_worth_overview", {})
        accounts = ctx.get("accounts_and_cards", [])
        obs = ctx.get("upcoming_obligations_30d", [])
        spendings = ctx.get("current_month_top_spending", [])

        asset_accounts = [a for a in accounts if a.get("is_asset")]
        credit_cards = [a for a in accounts if not a.get("is_asset")]

        total_assets = nw.get("total_liquid_assets", sum(a.get("live_current_balance", 0) for a in asset_accounts))
        total_debt = nw.get("total_credit_debt", sum(c.get("live_current_balance", 0) for c in credit_cards))
        net_worth = nw.get("net_worth", total_assets - total_debt)
        total_limit = nw.get("total_credit_limit", sum(c.get("credit_limit", 0) for c in credit_cards))
        overall_util = (total_debt / total_limit) * 100 if total_limit > 0 else 0

        if any(
            k in q_lower
            for k in ["tài sản", "net worth", "tổng tài sản", "tài sản ròng", "tiền mặt", "ngân hàng"]
        ):
            reply = (
                f"💎 **Báo cáo Tài Sản Ròng & Sức Khỏe Tài Chính (Net Worth):**\n\n"
                f"- **Tổng Tài Sản Có (Liquid Assets):** **{total_assets:,.0f} VNĐ**\n"
                f"  • Tiền gửi Ngân hàng: {nw.get('total_bank_assets', 0):,.0f}đ\n"
                f"  • Ví tiền mặt: {nw.get('total_cash_assets', 0):,.0f}đ\n"
                f"  • Ví điện tử: {nw.get('total_ewallet_assets', 0):,.0f}đ\n"
                f"- **Tổng Dư Nợ Thẻ Tín Dụng:** **{total_debt:,.0f} VNĐ**\n"
                f"- 🏆 **TÀI SẢN RÒNG (NET WORTH):** **{net_worth:,.0f} VNĐ**\n\n"
                f"**Danh sách Tài khoản & Ví tiền:**\n"
            )
            for a in asset_accounts:
                reply += f"• **{a['account_name']}** ({a['bank_name']}): **{a['live_current_balance']:,.0f} VNĐ**\n"

            return AIChatResponse(
                reply=reply,
                suggested_followups=[
                    "Dư nợ và hạn mức thẻ tín dụng hiện tại?",
                    "Khoản nợ nào sắp đến hạn thanh toán?",
                    "Cơ cấu chi tiêu tháng này của tôi?",
                ],
                insights={"net_worth": net_worth, "total_assets": total_assets},
            )

        elif any(
            k in q_lower
            for k in ["dư nợ", "số dư", "hạn mức", "tổng tiền", "bao nhiêu tiền", "thẻ"]
        ):
            reply = (
                f"📊 **Báo cáo Tình hình Dư nợ Thẻ & Hạn Mức Tức thời:**\n\n"
                f"- **Tổng Hạn Mức Tín Dụng:** {total_limit:,.0f} VNĐ ({len(credit_cards)} thẻ đang hoạt động)\n"
                f"- **Dư Nợ Thực Tế Tức Thời (Live Debt):** {total_debt:,.0f} VNĐ\n"
                f"- **Hạn Mức Khả Dụng Còn Lại:** {(total_limit - total_debt):,.0f} VNĐ\n"
                f"- **Tỷ Lệ Sử Dụng Hạn Mức:** **{overall_util:.1f}%** ({'An toàn (<30%)' if overall_util < 30 else 'Cần chú ý (>50%)'})\n\n"
                f"**Chi tiết từng thẻ:**\n"
            )
            for c in credit_cards:
                reply += f"• **{c['account_name']}** ({c['bank_name']}): Dư nợ {c['live_current_balance']:,.0f}đ / Hạn mức {c['credit_limit']:,.0f}đ ({c['live_utilization_percentage']:.1f}% - {c['live_risk_level']})\n"

            return AIChatResponse(
                reply=reply,
                suggested_followups=[
                    "Tổng tài sản ròng Net Worth hiện tại?",
                    "Khoản nợ nào sắp đến hạn thanh toán?",
                    "Nên dùng thẻ nào để quẹt ăn uống?",
                ],
                insights={"overall_utilization": overall_util},
            )

        elif any(
            k in q_lower for k in ["hạn", "đến hạn", "thanh toán", "trả nợ", "sắp tới"]
        ):
            if not obs:
                reply = "🎉 **Tuyệt vời!** Bạn không có khoản nợ sao kê hoặc kỳ trả góp nào đến hạn thanh toán trong vòng 30 ngày tới."
            else:
                total_due = sum(o.get("total_amount_due", 0) for o in obs)
                reply = (
                    f"⏰ **Các Khoản Nghĩa Vụ Thanh Toán Sắp Tới (30 ngày):**\n\n"
                    f"Tổng số tiền cần chuẩn bị thanh toán: **{total_due:,.0f} VNĐ**\n\n"
                )
                for o in obs:
                    days = o.get("days_remaining", 0)
                    time_desc = "HÔM NAY" if days == 0 else f"còn {days} ngày"
                    reply += f"• **{o['account_name']}** ({o['obligation_type']}): **{o['total_amount_due']:,.0f} VNĐ** - Hạn chót: `{o['due_date']}` ({time_desc})\n"
                reply += "\n💡 *Khuyến nghị: Hãy thanh toán trước hạn 1-2 ngày để tránh chậm trễ ghi nhận giữa các ngân hàng.*"

            return AIChatResponse(
                reply=reply,
                suggested_followups=[
                    "Dư nợ các thẻ hiện tại là bao nhiêu?",
                    "Dự phóng trả góp các tháng tới?",
                    "Làm sao để tối ưu điểm tín dụng CIC?",
                ],
            )

        elif any(
            k in q_lower for k in ["tiêu", "chi tiêu", "danh mục", "mua sắm", "ăn uống"]
        ):
            total_sp = sum(s.get("total_spending", 0) for s in spendings)
            reply = (
                f"🛍️ **Cơ Cấu Chi Tiêu Tháng Này:**\n\n"
                f"Tổng chi tiêu ghi nhận trong tháng: **{total_sp:,.0f} VNĐ**\n\n"
                f"**Top hạng mục chi tiêu nhiều nhất:**\n"
            )
            for s in spendings:
                reply += f"• **{s['category_name']}** ({s['parent_category_name']}): {s['total_spending']:,.0f} VNĐ ({s['transaction_count']} giao dịch)\n"

            reply += "\n💡 *Mẹo: Khi đi ăn uống hoặc mua sắm, bạn có thể dùng tính năng 'Đề xuất Thẻ Chi Tiêu' để nhận tối đa 5% - 8% hoàn tiền.*"

            return AIChatResponse(
                reply=reply,
                suggested_followups=[
                    "Thẻ nào hoàn tiền ăn uống cao nhất?",
                    "Tôi có khoản nợ nào sắp đến hạn không?",
                    "Tỷ lệ sử dụng hạn mức của tôi thế nào?",
                ],
            )

        else:
            reply = (
                f"Xin chào! Tôi là **AI Financial Advisor** của Credit Wallet 2.0.\n\n"
                f"Tôi có thể hỗ trợ bạn theo dõi và phân tích tài chính cá nhân:\n"
                f"• 💳 **Kiểm tra Dư nợ Live Balance & Hạn mức khả dụng**\n"
                f"• ⏰ **Theo dõi lịch trả nợ sao kê & trả góp sắp đến hạn**\n"
                f"• 💡 **Tư vấn chọn thẻ quẹt tối ưu mức hoàn tiền Cashback/Point**\n"
                f"• 📊 **Phân tích cơ cấu chi tiêu và rủi ro tín dụng CIC**\n\n"
                f"Bạn có thể hỏi tôi bất kỳ câu hỏi nào về tình hình tài chính của bạn!"
            )
            return AIChatResponse(
                reply=reply,
                suggested_followups=[
                    "Dư nợ và hạn mức khả dụng hiện tại?",
                    "Các khoản cần thanh toán trong 30 ngày tới?",
                    "Cơ cấu chi tiêu tháng này của tôi?",
                ],
            )

    @staticmethod
    async def chat(db: AsyncSession, payload: AIChatRequest) -> AIChatResponse:
        """Process chat query via Google Gemini API or intelligent context fallback."""
        ctx = {}
        if payload.include_financial_context:
            ctx = await AIAssistantService.get_financial_context(db)

        gemini_api_key = os.getenv("GEMINI_API_KEY")

        # If no API key configured, use intelligent rule-based response
        if not gemini_api_key:
            return AIAssistantService._generate_rule_based_reply(payload.message, ctx)

        # Gemini API System Prompt
        system_prompt = f"""
Bạn là AI Financial Advisor & Copilot cao cấp trong ứng dụng Credit Wallet 2.0.
Nhiệm vụ của bạn là hỗ trợ người dùng quản lý tài chính thẻ tín dụng thông minh, nhắc nhở nợ, tối ưu hóa điểm thưởng/hoàn tiền và kiểm soát rủi ro điểm tín dụng CIC.

Dữ liệu tài chính thời gian thực của người dùng hiện tại:
```json
{json.dumps(ctx, ensure_ascii=False, indent=2)}
```

Nguyên tắc trả lời:
1. Luôn sử dụng tiếng Việt tự nhiên, lịch sự, chuyên nghiệp, định dạng Markdown rõ ràng với emoji trực quan.
2. Trả lời chính xác dựa trên số liệu thực tế trong context (Dư nợ live, Hạn mức, Lịch trả nợ).
3. Đưa ra lời khuyên thực tế (VD: nhắc thanh toán trước ngày đến hạn, khuyến nghị giữ tỷ lệ sử dụng hạn mức < 30%).
4. Luôn đính kèm 2-3 câu hỏi gợi ý tiếp theo phù hợp.
"""

        contents = []
        for msg in payload.history[-6:]:
            role = "user" if msg.role == "user" else "model"
            contents.append({"role": role, "parts": [{"text": msg.content}]})

        contents.append({"role": "user", "parts": [{"text": payload.message}]})

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={gemini_api_key}"
        request_body = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": contents,
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 1000,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(url, json=request_body)
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        text_resp = candidates[0]["content"]["parts"][0]["text"]
                        return AIChatResponse(
                            reply=text_resp,
                            suggested_followups=[
                                "Chi tiết dư nợ các thẻ hiện tại?",
                                "Tôi có khoản nợ nào sắp đến hạn không?",
                                "Đề xuất thẻ quẹt ăn uống nhận cashback cao nhất?",
                            ],
                        )
        except Exception as e:
            print(f"[AIAssistantService] Gemini API call failed: {e}")

        # Fallback if API fails
        return AIAssistantService._generate_rule_based_reply(payload.message, ctx)
