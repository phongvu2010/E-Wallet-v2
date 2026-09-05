import json
import os
import re
import time
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction import TransactionTypeEnum
from app.schemas.ai import (
    AIChatMessage,
    AIChatRequest,
    AIChatResponse,
    AITransactionDraft,
)


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
        SELECT account_id, account_name, account_type, is_asset, bank_name, card_number_masked, credit_limit,
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

        # 5. Categories list for AI Category Matching
        sql_cats = """
        SELECT c.id, c.name, c.category_type, p.name AS parent_name
        FROM categories c
        LEFT JOIN categories p ON c.parent_id = p.id
        ORDER BY c.parent_id NULLS FIRST, c.name ASC;
        """
        res_cats = await db.execute(text(sql_cats))
        categories = [dict(r) for r in res_cats.mappings().all()]

        # Convert Decimals, UUIDs, and dates to strings
        def sanitize(obj):
            if isinstance(obj, Decimal):
                return float(obj)
            if isinstance(obj, UUID):
                return str(obj)
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
            "available_categories": [
                {k: sanitize(v) for k, v in cat.items()} for cat in categories
            ],
        }

        AIAssistantService._context_cache = ctx
        AIAssistantService._context_cache_time = time.time()
        return ctx

    # -------------------------------------------------------------------------
    # Vietnamese Natural Language Parser Helper Methods
    # -------------------------------------------------------------------------

    @staticmethod
    def _parse_vietnamese_amount(text_input: str) -> Optional[Decimal]:
        """Extract monetary amount in VND from natural Vietnamese sentence."""
        t = text_input.strip()

        # 1. Patterns like 1tr5, 2tr500, 1tr2, 3trieu5
        m_mix = re.search(r"(\d+)\s*(?:tr|triệu|trieu)\s*(\d+)", t, re.IGNORECASE)
        if m_mix:
            val_main = int(m_mix.group(1))
            val_sub_str = m_mix.group(2)
            if len(val_sub_str) == 1:
                val_sub = int(val_sub_str) * 100000
            elif len(val_sub_str) == 2:
                val_sub = int(val_sub_str) * 10000
            elif len(val_sub_str) == 3:
                val_sub = int(val_sub_str) * 1000
            else:
                val_sub = int(val_sub_str)
            return Decimal(str(val_main * 1000000 + val_sub))

        # 2. Millions: 1.5tr, 1,5 triệu, 25tr, 25 triệu, 25trieu
        m_mil = re.search(r"(\d+(?:[.,]\d+)?)\s*(?:tr|triệu|trieu)\b", t, re.IGNORECASE)
        if m_mil:
            num_str = m_mil.group(1).replace(",", ".")
            return Decimal(str(int(float(num_str) * 1000000)))

        # 3. Billions: 1.5 tỷ, 2 tỷ
        m_bil = re.search(r"(\d+(?:[.,]\d+)?)\s*(?:tỷ|ty)\b", t, re.IGNORECASE)
        if m_bil:
            num_str = m_bil.group(1).replace(",", ".")
            return Decimal(str(int(float(num_str) * 1000000000)))

        # 4. Thousands: 50k, 500k, 500 nghìn, 500 ngàn, 500k đ
        m_k = re.search(r"(\d+(?:[.,]\d+)?)\s*(?:k|nghìn|ngàn|nghin|ngan)\b", t, re.IGNORECASE)
        if m_k:
            num_str = m_k.group(1).replace(",", ".")
            return Decimal(str(int(float(num_str) * 1000)))

        # 5. Formatted standard numbers: 50.000, 50,000, 1.200.000, 45000đ, 50000 vnd
        m_std = re.search(
            r"(?:^|\s|[:=])(\d{1,3}(?:[.,]\d{3})+(?:\s*(?:vnđ|vnd|đ|đồng))?|\d{4,}(?:\s*(?:vnđ|vnd|đ|đồng))?)",
            t,
            re.IGNORECASE,
        )
        if m_std:
            raw = m_std.group(1)
            raw_clean = re.sub(r"[^\d.,]", "", raw)
            if "." in raw_clean and "," in raw_clean:
                raw_clean = raw_clean.replace(".", "").replace(",", ".")
            elif "." in raw_clean:
                raw_clean = raw_clean.replace(".", "")
            elif "," in raw_clean:
                raw_clean = raw_clean.replace(",", "")
            if raw_clean.isdigit():
                return Decimal(raw_clean)

        return None

    @staticmethod
    def _parse_vietnamese_fee(text_input: str) -> Decimal:
        """Extract transaction fee in VND if mentioned (e.g. 'phí 1.100đ', 'phí 1k', 'phí 5000')."""
        m = re.search(
            r"(?:phí|phí gd|phí ck|fee)\s*(?:là|hết|mất|:)?\s*(\d+(?:[.,]\d+)?)\s*(k|nghìn|ngàn|đ|vnd|vnđ)?",
            text_input,
            re.IGNORECASE,
        )
        if m:
            val_str = m.group(1).replace(",", ".")
            unit = (m.group(2) or "").lower()
            if unit in ["k", "nghìn", "ngàn"]:
                return Decimal(str(int(float(val_str) * 1000)))
            raw_clean = re.sub(r"[^\d]", "", m.group(1))
            if raw_clean:
                return Decimal(raw_clean)
        return Decimal("0.00")

    @staticmethod
    def _parse_vietnamese_date(text_input: str) -> date:
        """Extract transaction date (hôm nay, hôm qua, ngày mai, 05/09, 2026-09-05)."""
        today = date.today()
        lower = text_input.lower()

        if "hôm qua" in lower or "hom qua" in lower:
            return today - timedelta(days=1)
        if "hôm kia" in lower or "hom kia" in lower:
            return today - timedelta(days=2)
        if "ngày mai" in lower or "ngay mai" in lower:
            return today + timedelta(days=1)

        # Standard date pattern: 05/09, 05-09-2026, 2026-09-05
        m_iso = re.search(r"(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})", text_input)
        if m_iso:
            try:
                return date(int(m_iso.group(1)), int(m_iso.group(2)), int(m_iso.group(3)))
            except Exception:
                pass

        m_vn = re.search(r"(?:ngày\s+)?(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{4}))?", text_input, re.IGNORECASE)
        if m_vn:
            try:
                d = int(m_vn.group(1))
                mon = int(m_vn.group(2))
                y = int(m_vn.group(3)) if m_vn.group(3) else today.year
                return date(y, mon, d)
            except Exception:
                pass

        return today

    @staticmethod
    def _detect_transaction_type(text_input: str) -> TransactionTypeEnum:
        """Classify transaction type from natural language prompt."""
        lower = text_input.lower()

        # 1. TRANSFER
        if any(w in lower for w in [
            "chuyển khoản", "chuyển tiền", "chuyển sang", "bắn tiền", "chuyển cho",
            "transfer", "rút tiền mặt", "rút atm", "nạp ví", "nạp sang ví", "chuyển "
        ]) or re.search(r"\bchuyển\b", lower) or (("từ " in lower or "sang " in lower) and "chuyển" in lower):
            return TransactionTypeEnum.TRANSFER


        # 2. INCOME
        if any(w in lower for w in [
            "lương", "nhận lương", "thu nhập", "thưởng", "tiền về", "được cho",
            "income", "nhận tiền", "được thưởng"
        ]):
            return TransactionTypeEnum.INCOME

        # 3. REPAYMENT
        if any(w in lower for w in [
            "trả nợ thẻ", "thanh toán nợ", "thanh toán thẻ", "trả nợ", "trả thẻ",
            "repayment", "nạp tiền vào thẻ", "thanh toán sao kê"
        ]):
            return TransactionTypeEnum.REPAYMENT

        # 4. CASHBACK / REFUND
        if any(w in lower for w in ["hoàn tiền", "cashback", "hoàn phí"]):
            return TransactionTypeEnum.CASHBACK_CREDIT
        if any(w in lower for w in ["hủy đơn", "hoàn trả", "refund", "hủy giao dịch"]):
            return TransactionTypeEnum.REFUND

        # 5. FEE / INTEREST
        if any(w in lower for w in ["phí sms", "phí thường niên", "phí dịch vụ", "phí duy trì", "phí chuyển đổi"]):
            return TransactionTypeEnum.FEE
        if any(w in lower for w in ["lãi suất", "tiền lãi", "interest"]):
            return TransactionTypeEnum.INTEREST

        # 6. Default: PURCHASE
        return TransactionTypeEnum.PURCHASE

    @staticmethod
    def _match_accounts(
        text_input: str,
        accounts: List[Dict[str, Any]],
        tx_type: TransactionTypeEnum,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
        """Fuzzy match source account and destination account (if transfer) from user's active accounts."""
        lower = text_input.lower()

        def score_acc(acc: Dict[str, Any], query_str: str) -> int:
            score = 0
            acc_name = (acc.get("account_name") or "").lower()
            bank_name = (acc.get("bank_name") or "").lower()
            acc_type = (acc.get("account_type") or "").lower()
            last4 = (acc.get("card_number_last4") or (acc.get("card_number_masked") or "").replace(" ", "")[-4:]).lower()


            aliases = {
                "techcombank": ["techcombank", "techcom", "tcb"],
                "vietcombank": ["vietcombank", "vcb", "ngoại thương"],
                "mbbank": ["mbbank", "mb bank", "mb", "quân đội"],
                "vpbank": ["vpbank", "vp bank", "vpb"],
                "tpbank": ["tpbank", "tp bank", "tpb", "tiên phong"],
                "shinhan": ["shinhan", "shinhan bank"],
                "acb": ["acb", "á châu"],
                "bidv": ["bidv", "đầu tư phát triển"],
                "vietinbank": ["vietinbank", "vietin", "ctg"],
                "momo": ["momo", "ví momo"],
                "zalopay": ["zalopay", "zalo pay", "zalo"],
                "cash": ["tiền mặt", "tiền mat", "cash", "ví tiền mặt"],
                "cake": ["cake"],
                "timo": ["timo"],
            }

            for bank_key, syns in aliases.items():
                if bank_key in bank_name or bank_key in acc_name:
                    if any(syn in query_str for syn in syns):
                        score += 10
                elif (bank_key == "cash" and acc_type == "cash") or (bank_key == "momo" and "momo" in acc_name):
                    if any(syn in query_str for syn in syns):
                        score += 10

            if acc_name in query_str and len(acc_name) > 2:
                score += 15
            if last4 and last4 in query_str and len(last4) == 4 and last4 not in ["cash", "ewal", "bank", "save"]:
                score += 20
            if "thẻ tín dụng" in query_str and acc_type == "credit_card":
                score += 3
            if "thẻ" in query_str and acc_type == "credit_card":
                score += 2
            if "tiền mặt" in query_str and acc_type == "cash":
                score += 5
            if "ví" in query_str and acc_type == "e_wallet":
                score += 4
            return score

        source_acc = None
        dest_acc = None

        if tx_type == TransactionTypeEnum.TRANSFER:
            m = re.search(r"từ\s+(.+?)\s+(?:sang|đến|cho|vào)\s+(.+)", lower)
            if not m:
                m = re.search(r"chuyển\s+(?:tiền\s+)?(?:khoản\s+)?(.+?)\s+(?:sang|đến|cho|vào)\s+(.+)", lower)
            if not m:
                m = re.search(r"(.+?)\s+(?:sang|cho|vào)\s+(.+)", lower)

            if m:
                src_str = m.group(1)
                dst_str = m.group(2)

                src_candidates = sorted(accounts, key=lambda a: score_acc(a, src_str), reverse=True)
                if src_candidates and score_acc(src_candidates[0], src_str) > 0:
                    source_acc = src_candidates[0]

                dst_pool = [a for a in accounts if not source_acc or str(a.get("account_id")) != str(source_acc.get("account_id"))]
                dst_candidates = sorted(dst_pool, key=lambda a: score_acc(a, dst_str), reverse=True)
                if dst_candidates and score_acc(dst_candidates[0], dst_str) > 0:
                    dest_acc = dst_candidates[0]

        if not source_acc:
            scored = sorted(accounts, key=lambda a: score_acc(a, lower), reverse=True)
            if scored and score_acc(scored[0], lower) > 0:
                source_acc = scored[0]

        # Default fallback
        if not source_acc and accounts:
            if tx_type == TransactionTypeEnum.INCOME:
                bank_accs = [a for a in accounts if a.get("account_type") == "BANK_ACCOUNT"]
                source_acc = bank_accs[0] if bank_accs else accounts[0]
            elif tx_type == TransactionTypeEnum.PURCHASE:
                cards = [a for a in accounts if a.get("account_type") == "CREDIT_CARD"]
                source_acc = cards[0] if cards else accounts[0]
            else:
                source_acc = accounts[0]

        if tx_type == TransactionTypeEnum.TRANSFER and not dest_acc and len(accounts) > 1:
            other_accs = [a for a in accounts if not source_acc or str(a.get("account_id")) != str(source_acc.get("account_id"))]
            if other_accs:
                dest_acc = other_accs[0]

        return source_acc, dest_acc

    @staticmethod
    def _match_category(
        text_input: str,
        categories: List[Dict[str, Any]],
        tx_type: TransactionTypeEnum,
    ) -> Optional[Dict[str, Any]]:
        """Smartly match category from natural language prompt and transaction type."""
        lower = text_input.lower()

        cat_keywords = [
            (["cafe", "cà phê", "highland", "starbucks", "trà sữa", "phúc long", "katinat", "ăn", "uống", "cơm", "phở", "bún", "lẩu", "nhà hàng", "f&b", "ăn trưa", "ăn sáng", "ăn tối", "pizza", "kfc", "lotteria", "mcdonald", "trà"], "Nhà hàng & F&B"),
            (["siêu thị", "winmart", "coopmart", "bách hóa", "lotte", "aeon", "chợ", "tiện lợi", "circle k", "ministop", "familymart", "gs25", "7-eleven", "tạp hóa"], "Siêu thị & Tiện lợi"),
            (["shopee", "lazada", "tiki", "tiktok", "mua sắm", "quần áo", "giày", "thời trang", "uniqlo", "zara", "váy", "áo", "quần"], "Thương mại điện tử"),
            (["công nghệ", "máy tính", "điện thoại", "iphone", "laptop", "tai nghe", "bàn phím", "chuột", "ipad", "macbook"], "Cửa hàng công nghệ"),
            (["xăng", "đổ xăng", "petrolimex", "grab", "be", "taxi", "giao hàng", "vé xe", "vé máy bay", "di chuyển", "gửi xe", "vé tàu"], "Di chuyển & Vận tải"),
            (["điện", "nước", "internet", "viettel", "fpt", "netflix", "spotify", "icloud", "youtube", "phần mềm", "app store", "google play"], "Dịch vụ số & Ứng dụng"),
            (["thuốc", "bệnh viện", "khám", "nha khoa", "y tế", "pharmacity", "long châu", "tiệm thuốc", "nước muối", "khẩu trang"], "Y tế & Sức khỏe"),
            (["cắt tóc", "spa", "mỹ phẩm", "skincare", "gội đầu", "làm móng", "nail", "massage"], "Chăm sóc cá nhân"),
            (["du lịch", "khách sạn", "resort", "agoda", "booking", "homestay", "tour"], "Du lịch"),
            (["lương", "thưởng", "thu nhập", "tiền lương", "hoa hồng"], "Lương & Thu nhập"),
            (["thanh toán dư nợ", "trả nợ", "thanh toán thẻ"], "Thanh toán dư nợ"),
            (["phí sms", "sms"], "Phí SMS"),
            (["phí thường niên"], "Phí thường niên"),
            (["lãi", "lãi suất"], "Lãi suất"),
            (["cashback", "hoàn tiền"], "Hoàn tiền Cashback"),
        ]

        for keywords, target_name in cat_keywords:
            if any(kw in lower for kw in keywords):
                for cat in categories:
                    if (cat.get("name") or "").lower() == target_name.lower():
                        return cat

        type_default_names = {
            TransactionTypeEnum.INCOME: ["Lương & Thu nhập", "Thu nhập", "Lương"],
            TransactionTypeEnum.TRANSFER: ["Chuyển khoản", "Chuyển tiền", "Thanh toán"],
            TransactionTypeEnum.REPAYMENT: ["Thanh toán dư nợ", "Thanh toán"],
            TransactionTypeEnum.FEE: ["Phí SMS", "Phí thường niên", "Phí & Lãi"],
            TransactionTypeEnum.INTEREST: ["Lãi suất", "Phí & Lãi"],
            TransactionTypeEnum.CASHBACK_CREDIT: ["Hoàn tiền Cashback", "Hoàn tiền"],
            TransactionTypeEnum.REFUND: ["Hủy giao dịch", "Điều chỉnh / Hủy"],
            TransactionTypeEnum.PURCHASE: ["Chi tiêu khác", "Chi tiêu"],
        }
        targets = type_default_names.get(tx_type, ["Chi tiêu khác", "Chi tiêu"])
        for t_name in targets:
            for cat in categories:
                if (cat.get("name") or "").lower() == t_name.lower():
                    return cat
        return categories[0] if categories else None

    @staticmethod
    def _extract_merchant_name(text_input: str) -> Optional[str]:
        """Extract brand / merchant name if present in text."""
        merchants = [
            "Highlands Coffee", "Highland", "Starbucks", "The Coffee House", "Phúc Long", "Katinat",
            "ShopeeFood", "Shopee", "Lazada", "Tiki", "Grab", "Be", "Gojek", "WinMart", "Co.opmart",
            "Circle K", "FamilyMart", "Ministop", "GS25", "7-Eleven", "Petrolimex", "Uniqlo", "Zara",
            "Pharmacity", "Long Châu", "Netflix", "Spotify", "Apple", "Google", "FPT Shop",
            "Thế Giới Di Động", "CellphoneS", "Phở Thìn", "KFC", "Lotteria", "McDonald's", "Pizza Hut",
            "Pizza 4P's", "Bách Hóa Xanh", "Agoda", "Booking.com"
        ]
        for m in merchants:
            if re.search(r"\b" + re.escape(m) + r"\b", text_input, re.IGNORECASE):
                return m
        return None

    @staticmethod
    def _parse_transaction_intent_rule_based(
        query: str, ctx: Dict[str, Any]
    ) -> Optional[AIChatResponse]:
        """Rule-based Vietnamese NLP parser to detect and extract transaction creation draft from chat."""
        q_lower = query.lower()

        # Check intent triggers
        trigger_words = [
            "thêm giao dịch", "tạo giao dịch", "thêm chi tiêu", "thêm thu nhập", "thêm khoản",
            "ghi chép", "ghi sổ", "nhập giao dịch", "log giao dịch", "thêm gd", "thêm chuyển",
            "vừa chi", "vừa tiêu", "vừa mua", "vừa ăn", "vừa uống", "vừa chuyển",
            "vừa nhận", "vừa trả", "vừa nạp", "vừa thanh toán", "đã chi", "đã chuyển", "đã mua",
            "chi tiêu", "chi ", "mua ", "ăn trưa", "ăn tối", "ăn sáng", "uống cafe", "uống trà",
            "đổ xăng", "chuyển khoản", "chuyển tiền", "nhận lương", "trả nợ thẻ", "thanh toán thẻ",
            "hoàn tiền", "hủy đơn", "phí sms", "ăn "
        ]
        has_trigger = any(tw in q_lower for tw in trigger_words)
        amount = AIAssistantService._parse_vietnamese_amount(query)

        if not has_trigger and not amount:
            return None
        if not amount:
            # User might say "thêm giao dịch cafe" without amount
            return None

        # Extract parameters
        fee = AIAssistantService._parse_vietnamese_fee(query)
        tx_date = AIAssistantService._parse_vietnamese_date(query)
        tx_type = AIAssistantService._detect_transaction_type(query)

        accounts = ctx.get("accounts_and_cards", [])
        categories = ctx.get("available_categories", [])

        source_acc, dest_acc = AIAssistantService._match_accounts(query, accounts, tx_type)
        cat = AIAssistantService._match_category(query, categories, tx_type)
        merchant = AIAssistantService._extract_merchant_name(query)

        # Build raw description and notes
        acc_name = source_acc.get("account_name", "Tài khoản mặc định") if source_acc else "Tài khoản mặc định"
        acc_id = source_acc.get("account_id") if source_acc else None
        acc_bank = source_acc.get("bank_name") if source_acc else None

        dst_id = dest_acc.get("account_id") if dest_acc else None
        dst_name = dest_acc.get("account_name") if dest_acc else None

        cat_name = cat.get("name") if cat else "Chi tiêu khác"
        cat_id = cat.get("id") if cat else None
        parent_cat_name = cat.get("parent_name") if cat else None

        if merchant:
            raw_desc = f"{merchant}"
        elif tx_type == TransactionTypeEnum.INCOME:
            raw_desc = "Nhận lương / thu nhập"
        elif tx_type == TransactionTypeEnum.TRANSFER:
            raw_desc = f"Chuyển tiền sang {dst_name}" if dst_name else "Chuyển tiền nội bộ"
        elif tx_type == TransactionTypeEnum.REPAYMENT:
            raw_desc = f"Thanh toán nợ thẻ {acc_name}"
        elif cat_name and cat_name != "Chi tiêu khác":
            raw_desc = f"{cat_name}"
        else:
            raw_desc = "Chi tiêu mua sắm"

        draft = AITransactionDraft(
            action_type="CREATE_TRANSACTION",
            account_id=acc_id,
            account_name=acc_name,
            account_bank_name=acc_bank,
            transaction_type=tx_type,
            amount=amount,
            fee=fee,
            total_amount=amount + fee,
            transaction_date=tx_date,
            post_date=tx_date,
            category_id=cat_id,
            category_name=cat_name,
            parent_category_name=parent_cat_name,
            merchant_name=merchant,
            raw_description=raw_desc,
            note=query,
            transfer_to_account_id=dst_id,
            transfer_to_account_name=dst_name,
            confidence_score=0.95,
        )

        type_labels = {
            TransactionTypeEnum.PURCHASE: "Chi tiêu",
            TransactionTypeEnum.INCOME: "Thu nhập",
            TransactionTypeEnum.TRANSFER: "Chuyển tiền",
            TransactionTypeEnum.REPAYMENT: "Thanh toán nợ",
            TransactionTypeEnum.FEE: "Phí dịch vụ",
            TransactionTypeEnum.INTEREST: "Tiền lãi",
            TransactionTypeEnum.CASHBACK_CREDIT: "Hoàn tiền Cashback",
            TransactionTypeEnum.REFUND: "Hủy đơn / Hoàn tiền",
        }
        type_str = type_labels.get(tx_type, "Giao dịch")

        reply = (
            f"✨ **Tôi đã soạn thảo giao dịch {type_str} {amount:,.0f} VNĐ!**\n\n"
            f"• **Số tiền:** **{amount:,.0f} VNĐ**" + (f" *(Phí: {fee:,.0f}đ)*" if fee > 0 else "") + "\n"
            f"• **Tài khoản nguồn:** **{acc_name}**" + (f" ➡️ **{dst_name}**" if tx_type == TransactionTypeEnum.TRANSFER and dst_name else "") + "\n"
            f"• **Danh mục:** `{parent_cat_name + ' > ' if parent_cat_name else ''}{cat_name}`\n"
            f"• **Ngày ghi nhận:** `{tx_date.strftime('%d/%m/%Y')}`\n\n"
            f"👉 *Vui lòng kiểm tra lại thẻ bên dưới và nhấn **[Xác nhận Ghi Sổ]** để lưu vào sổ cái nhé!*"
        )

        return AIChatResponse(
            reply=reply,
            action="PREPARE_TRANSACTION",
            transaction_draft=draft,
            suggested_followups=[
                "Kiểm tra số dư các tài khoản?",
                "Cơ cấu chi tiêu tháng này của tôi?",
                "Khoản nợ nào sắp đến hạn thanh toán?",
            ],
        )

    @staticmethod
    def _generate_rule_based_reply(query: str, ctx: Dict[str, Any]) -> AIChatResponse:
        """Intelligent local fallback response generator when Gemini API Key is not set."""
        # 1. First, check if user is asking to add a transaction!
        tx_intent_res = AIAssistantService._parse_transaction_intent_rule_based(query, ctx)
        if tx_intent_res:
            return tx_intent_res

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

            reply += "\n💡 *Mẹo: Bạn có thể ra lệnh cho tôi thêm giao dịch mới bất kỳ lúc nào, ví dụ: 'Vừa ăn trưa 45k tiền mặt' hoặc 'Mua cafe 50k bằng thẻ Techcombank'!*"

            return AIChatResponse(
                reply=reply,
                suggested_followups=[
                    "Thêm chi tiêu 45k cafe Highland bằng Techcombank",
                    "Vừa ăn trưa 120k tiền mặt",
                    "Chuyển khoản 2tr từ VCB sang MoMo",
                ],
            )

        else:
            reply = (
                f"Xin chào! Tôi là **AI Financial Advisor & Copilot** của Credit Wallet 2.0.\n\n"
                f"Tôi có thể hỗ trợ bạn theo dõi và quản lý tài chính thông minh:\n"
                f"• ✍️ **Thêm giao dịch siêu nhanh qua câu lệnh chat** *(VD: 'Ăn trưa 50k tiền mặt', 'Mua cafe 45k thẻ TCB', 'Chuyển 2tr VCB sang MoMo')*\n"
                f"• 💳 **Kiểm tra Dư nợ Live Balance & Hạn mức khả dụng**\n"
                f"• ⏰ **Theo dõi lịch trả nợ sao kê & trả góp sắp đến hạn**\n"
                f"• 📊 **Phân tích cơ cấu chi tiêu & sức khỏe tài sản ròng Net Worth**\n\n"
                f"Hãy nhắn cho tôi câu hỏi hoặc ra lệnh thêm giao dịch mới bất kỳ lúc nào!"
            )
            return AIChatResponse(
                reply=reply,
                suggested_followups=[
                    "☕ Chi 45k cafe Highland bằng Techcombank",
                    "🍜 Ăn trưa 120k tiền mặt",
                    "💸 Chuyển 2tr từ VCB sang MoMo",
                    "Dư nợ và hạn mức khả dụng hiện tại?",
                ],
            )

    @staticmethod
    async def chat(db: AsyncSession, payload: AIChatRequest) -> AIChatResponse:
        """Process chat query via Google Gemini API or intelligent context fallback."""
        ctx = {}
        if payload.include_financial_context:
            ctx = await AIAssistantService.get_financial_context(db)

        # If user is asking to create transaction, test rule-based parser first
        # as it guarantees 100% structured data and zero latency
        q_lower = payload.message.lower()
        if any(w in q_lower for w in ["thêm", "vừa", "mua", "chi", "ăn", "uống", "chuyển", "lương", "trả nợ", "nạp"]):
            tx_draft_res = AIAssistantService._parse_transaction_intent_rule_based(payload.message, ctx)
            if tx_draft_res:
                return tx_draft_res

        gemini_api_key = os.getenv("GEMINI_API_KEY")

        # If no API key configured, use intelligent rule-based response
        if not gemini_api_key:
            return AIAssistantService._generate_rule_based_reply(payload.message, ctx)

        # Gemini API System Prompt
        system_prompt = f"""
Bạn là AI Financial Advisor & Copilot cao cấp trong ứng dụng Credit Wallet 2.0.
Nhiệm vụ của bạn là hỗ trợ người dùng quản lý tài chính thẻ tín dụng, nhắc nợ, phân tích chi tiêu và THÊM GIAO DỊCH MỚI TỰ ĐỘNG khi người dùng yêu cầu.

Dữ liệu tài chính thời gian thực của người dùng hiện tại:
```json
{json.dumps(ctx, ensure_ascii=False, indent=2)}
```

QUY TẮC PHẢN HỒI:
1. Nếu người dùng YÊU CẦU THÊM / GHI CHÉP GIAO DỊCH (VD: "thêm chi tiêu...", "vừa mua...", "vừa ăn...", "chuyển khoản...", "nhận lương...", "trả nợ thẻ..."):
Hãy trả về DUY NHẤT một khối JSON hợp lệ theo định dạng sau (được bọc trong ```json ... ```):
{{
  "action": "PREPARE_TRANSACTION",
  "reply": "Tôi đã soạn thảo giao dịch chi tiêu cafe 45.000đ từ thẻ Techcombank. Bạn hãy kiểm tra lại và bấm Xác nhận Ghi Sổ nhé!",
  "transaction_draft": {{
    "action_type": "CREATE_TRANSACTION",
    "account_id": "<UUID của tài khoản nguồn trong context>",
    "account_name": "<Tên tài khoản>",
    "account_bank_name": "<Tên ngân hàng>",
    "transaction_type": "PURCHASE" | "INCOME" | "TRANSFER" | "REPAYMENT" | "FEE" | "INTEREST" | "CASHBACK_CREDIT" | "REFUND",
    "amount": 45000,
    "fee": 0,
    "transaction_date": "2026-09-06",
    "category_id": "<UUID danh mục phù hợp trong context>",
    "category_name": "<Tên danh mục>",
    "parent_category_name": "<Tên danh mục cha>",
    "merchant_name": "Highlands Coffee",
    "raw_description": "Cà phê Highlands",
    "note": "Chi tiêu cafe",
    "transfer_to_account_id": "<UUID tài khoản đích nếu là TRANSFER>"
  }},
  "suggested_followups": ["Xem số dư sau khi thêm", "Cơ cấu chi tiêu tháng này"]
}}

2. Nếu là câu hỏi tư vấn tài chính, hỏi số dư, nợ đến hạn, phân tích chi tiêu:
Trả lời bằng Markdown tiếng Việt tự nhiên, lịch sự, chuyên nghiệp, chính xác theo số liệu thực tế trong context, đính kèm 2-3 câu hỏi gợi ý tiếp theo.
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
                        # Check if response is structured JSON for transaction preparation
                        try:
                            clean_json = text_resp.strip()
                            if clean_json.startswith("```json"):
                                clean_json = clean_json[7:]
                            if clean_json.startswith("```"):
                                clean_json = clean_json[3:]
                            if clean_json.endswith("```"):
                                clean_json = clean_json[:-3]
                            parsed_json = json.loads(clean_json.strip())
                            if isinstance(parsed_json, dict) and "reply" in parsed_json:
                                draft_obj = None
                                if parsed_json.get("transaction_draft"):
                                    draft_obj = AITransactionDraft(**parsed_json["transaction_draft"])
                                return AIChatResponse(
                                    reply=parsed_json.get("reply", ""),
                                    action=parsed_json.get("action"),
                                    transaction_draft=draft_obj,
                                    suggested_followups=parsed_json.get("suggested_followups", [
                                        "Chi tiết dư nợ các thẻ hiện tại?",
                                        "Cơ cấu chi tiêu tháng này?",
                                    ]),
                                )
                        except Exception:
                            pass

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
