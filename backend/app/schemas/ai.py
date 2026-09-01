from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class AIChatMessage(BaseModel):
    role: str = Field(..., description="'user' or 'assistant' or 'system'")
    content: str


class AIChatRequest(BaseModel):
    message: str = Field(..., description="Câu hỏi hoặc yêu cầu của người dùng")
    history: List[AIChatMessage] = Field(
        default=[], description="Lịch sử hội thoại trước đó"
    )
    include_financial_context: bool = Field(
        default=True,
        description="Đính kèm bối cảnh số dư live, nợ đến hạn và chi tiêu vào prompt",
    )


class AIChatResponse(BaseModel):
    reply: str
    suggested_followups: List[str] = []
    insights: Optional[Dict[str, Any]] = None


class AIParsedTransactionItem(BaseModel):
    transaction_date: date
    post_date: Optional[date] = None
    raw_description: str
    amount: Decimal
    fee: Decimal = Decimal("0.00")
    total_amount: Decimal
    original_amount: Optional[Decimal] = None
    original_currency: Optional[str] = "VND"
    exchange_rate: Optional[Decimal] = Decimal("1.00")
    category_hint: Optional[str] = None
    transaction_type_hint: Optional[str] = "PURCHASE"


class AIParsedStatementResult(BaseModel):
    bank_detected: str
    account_number_hint: Optional[str] = None
    statement_date: date
    payment_due_date: date
    credit_limit: Decimal
    previous_balance: Decimal = Decimal("0.00")
    purchases_amount: Decimal = Decimal("0.00")
    payments_received: Decimal = Decimal("0.00")
    statement_balance: Decimal
    minimum_payment: Decimal
    earned_reward_points: Optional[Decimal] = None
    transactions: List[AIParsedTransactionItem] = []
    parsing_notes: Optional[str] = None


class AIPdfExtractionResponse(BaseModel):
    success: bool
    filename: str
    data: Optional[AIParsedStatementResult] = None
    error: Optional[str] = None
