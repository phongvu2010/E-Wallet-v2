from typing import Optional, List
from uuid import UUID
from datetime import date
from decimal import Decimal
from pydantic import BaseModel


class MonthlyCategorySpendingRead(BaseModel):
    month: date
    category_name: str
    parent_category_name: str
    transaction_count: int
    total_spending: Decimal


class CreditUtilizationRead(BaseModel):
    account_id: UUID
    account_name: str
    bank_name: Optional[str] = None
    card_number_masked: str
    credit_limit: Decimal
    current_balance: Decimal
    available_limit: Decimal
    utilization_percentage: Decimal
    risk_level: str


class UpcomingObligationRead(BaseModel):
    obligation_type: str
    reference_id: UUID
    account_name: str
    card_number_masked: str
    due_date: date
    days_remaining: int
    total_amount_due: Decimal
    minimum_amount_due: Decimal
    payment_status: str


class DashboardOverviewRead(BaseModel):
    total_credit_limit: Decimal
    total_live_balance: Decimal
    total_available_limit: Decimal
    overall_utilization_percentage: Decimal
    overall_risk_level: str
    active_cards_count: int
    upcoming_obligations_count: int
    total_upcoming_due_30d: Decimal
    monthly_spending_current_month: Decimal
