import datetime
import os
import re
from decimal import Decimal
from typing import Any, Dict, List, Optional

import pymupdf
import httpx

from app.schemas.ai import (
    AIParsedStatementResult,
    AIParsedTransactionItem,
    AIPdfExtractionResponse,
)


class AIStatementParserService:
    """Intelligent Bank Statement PDF Parser using Gemini API / PyMuPDF OCR."""

    @staticmethod
    def _clean_num(val: Any) -> Decimal:
        if val is None:
            return Decimal("0.00")
        s = (
            str(val)
            .replace(",", "")
            .replace(" ", "")
            .replace("VND", "")
            .replace("VNĐ", "")
            .strip()
        )
        if s.endswith("CR") or s.endswith("-"):
            s = "-" + s.replace("CR", "").replace("-", "")
        try:
            return Decimal(s)
        except Exception:
            return Decimal("0.00")

    @staticmethod
    def _parse_pdf_text_rule_based(
        text_content: str, filename: str
    ) -> AIParsedStatementResult:
        """Parse raw text from bank statement PDF using robust rule-based extraction."""
        bank_detected = "SHINHAN"
        if "HSBC" in text_content.upper() or "HSBC" in filename.upper():
            bank_detected = "HSBC"
        elif "SACOMBANK" in text_content.upper() or "SACOM" in filename.upper():
            bank_detected = "SACOMBANK"

        # Regex for statement date
        stmt_date = datetime.date.today()
        m_date = re.search(r"(\d{2}[/-]\d{2}[/-]\d{4})", text_content)
        if m_date:
            try:
                d_str = m_date.group(1).replace("-", "/")
                stmt_date = datetime.datetime.strptime(d_str, "%d/%m/%Y").date()
            except Exception:
                pass

        due_date = stmt_date + datetime.timedelta(days=15)
        credit_limit = Decimal("50000000.00")
        stmt_balance = Decimal("0.00")
        min_payment = Decimal("0.00")

        # Scan for credit limit / balance lines
        for line in text_content.split("\n"):
            line_upper = line.upper()
            if "HẠN MỨC TÍN DỤNG" in line_upper or "CREDIT LIMIT" in line_upper:
                nums = re.findall(r"[\d,]+", line)
                if nums:
                    credit_limit = AIStatementParserService._clean_num(nums[-1])
            elif "DƯ NỢ CUỐI KỲ" in line_upper or "STATEMENT BALANCE" in line_upper:
                nums = re.findall(r"[\d,]+", line)
                if nums:
                    stmt_balance = AIStatementParserService._clean_num(nums[-1])
            elif "THANH TOÁN TỐI THIỂU" in line_upper or "MINIMUM PAYMENT" in line_upper:
                nums = re.findall(r"[\d,]+", line)
                if nums:
                    min_payment = AIStatementParserService._clean_num(nums[-1])

        # Scan transactions line by line
        transactions: List[AIParsedTransactionItem] = []
        # Pattern: DD/MM Description Amount
        tx_pattern = re.compile(
            r"(\d{2}/\d{2}(?:/\d{4})?)\s+([A-Za-z0-9\s*._-]+?)\s+([\d,]+(?:[.-]\d{2})?)"
        )
        for match in tx_pattern.finditer(text_content):
            t_date_str, desc, amt_str = match.groups()
            clean_amt = AIStatementParserService._clean_num(amt_str)
            if clean_amt > 0 and len(desc.strip()) > 3:
                try:
                    if len(t_date_str) == 5:
                        t_d = datetime.datetime.strptime(
                            f"{t_date_str}/{stmt_date.year}", "%d/%m/%Y"
                        ).date()
                    else:
                        t_d = datetime.datetime.strptime(t_date_str, "%d/%m/%Y").date()
                except Exception:
                    t_d = stmt_date

                transactions.append(
                    AIParsedTransactionItem(
                        transaction_date=t_d,
                        post_date=t_d,
                        raw_description=desc.strip(),
                        amount=clean_amt,
                        fee=Decimal("0.00"),
                        total_amount=clean_amt,
                        original_amount=clean_amt,
                        original_currency="VND",
                        category_hint="Chi tiêu thẻ",
                        transaction_type_hint="PURCHASE",
                    )
                )

        return AIParsedStatementResult(
            bank_detected=bank_detected,
            statement_date=stmt_date,
            payment_due_date=due_date,
            credit_limit=credit_limit,
            statement_balance=stmt_balance,
            minimum_payment=min_payment,
            transactions=transactions[:50],  # Sample transactions
            parsing_notes=f"Trích xuất thành công {len(transactions)} giao dịch từ tệp {filename}",
        )

    @staticmethod
    async def parse_pdf_file(
        file_path: str, filename: Optional[str] = None
    ) -> AIPdfExtractionResponse:
        """Extract bank statement structure directly from PDF file."""
        fn = filename or os.path.basename(file_path)

        if not os.path.exists(file_path):
            return AIPdfExtractionResponse(
                success=False,
                filename=fn,
                error=f"Tệp không tồn tại: {file_path}",
            )

        try:
            # 1. Read PDF text via PyMuPDF
            full_text = ""
            with pymupdf.open(file_path) as doc:
                for page in doc:
                    full_text += page.get_text() + "\n"

            # 2. Check if Gemini API available for advanced extraction
            gemini_api_key = os.getenv("GEMINI_API_KEY")
            if gemini_api_key and len(full_text.strip()) > 50:
                prompt = f"""
Trích xuất toàn bộ thông tin sao kê thẻ tín dụng từ nội dung văn bản sau thành định dạng JSON:
Nội dung:
\"\"\"{full_text[:4000]}\"\"\"

Yêu cầu trả về đúng JSON Schema:
{{
  "bank_detected": "SHINHAN" | "HSBC" | "SACOMBANK",
  "statement_date": "YYYY-MM-DD",
  "payment_due_date": "YYYY-MM-DD",
  "credit_limit": 50000000.0,
  "statement_balance": 12500000.0,
  "minimum_payment": 625000.0,
  "transactions": [
    {{
      "transaction_date": "YYYY-MM-DD",
      "raw_description": "STARBUCKS...",
      "amount": 120000.0,
      "total_amount": 120000.0
    }}
  ]
}}
"""
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={gemini_api_key}"
                try:
                    async with httpx.AsyncClient(timeout=25.0) as client:
                        resp = await client.post(
                            url,
                            json={
                                "contents": [
                                    {"role": "user", "parts": [{"text": prompt}]}
                                ],
                                "generationConfig": {
                                    "responseMimeType": "application/json"
                                },
                            },
                        )
                        if resp.status_code == 200:
                            data = resp.json()
                            candidate_text = data["candidates"][0]["content"]["parts"][0]["text"]
                            parsed_json = AIParsedStatementResult.model_validate_json(
                                candidate_text
                            )
                            return AIPdfExtractionResponse(
                                success=True,
                                filename=fn,
                                data=parsed_json,
                            )
                except Exception as e:
                    print(f"[AIStatementParser] Gemini API fallback to local parser: {e}")

            # 3. Rule-based extraction fallback
            result = AIStatementParserService._parse_pdf_text_rule_based(full_text, fn)
            return AIPdfExtractionResponse(
                success=True,
                filename=fn,
                data=result,
            )
        except Exception as e:
            return AIPdfExtractionResponse(
                success=False,
                filename=fn,
                error=f"Lỗi khi xử lý tệp PDF: {str(e)}",
            )
