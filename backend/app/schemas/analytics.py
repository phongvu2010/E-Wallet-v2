from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

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


class NetWorthOverviewRead(BaseModel):
    total_liquid_assets: Decimal
    total_bank_assets: Decimal
    total_cash_assets: Decimal
    total_ewallet_assets: Decimal
    total_savings_assets: Decimal
    total_credit_debt: Decimal
    total_credit_limit: Decimal
    total_available_credit: Decimal
    net_worth: Decimal
    active_asset_accounts_count: int
    active_credit_cards_count: int


class MonthlyCashFlowRead(BaseModel):
    month: date
    total_income: Decimal
    total_expense: Decimal
    net_savings: Decimal
    savings_rate_percent: Decimal
    total_transactions_count: int


class DashboardOverviewRead(BaseModel):
    total_liquid_assets: Decimal = Decimal("0.00")
    total_bank_assets: Decimal = Decimal("0.00")
    total_cash_assets: Decimal = Decimal("0.00")
    total_ewallet_assets: Decimal = Decimal("0.00")
    total_credit_limit: Decimal = Decimal("0.00")
    total_live_balance: Decimal = Decimal("0.00")
    total_available_limit: Decimal = Decimal("0.00")
    net_worth: Decimal = Decimal("0.00")
    overall_utilization_percentage: Decimal = Decimal("0.00")
    overall_risk_level: str = "OPTIMAL (<30%)"
    active_cards_count: int = 0
    active_asset_accounts_count: int = 0
    upcoming_obligations_count: int = 0
    total_upcoming_due_30d: Decimal = Decimal("0.00")
    monthly_spending_current_month: Decimal = Decimal("0.00")
    monthly_income_current_month: Decimal = Decimal("0.00")
