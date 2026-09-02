export interface MonthlyCategorySpending {
  month: string;
  category_name: string;
  parent_category_name: string;
  transaction_count: number;
  total_spending: number;
}

export interface CreditUtilization {
  account_id: string;
  account_name: string;
  bank_name?: string;
  card_number_masked: string;
  credit_limit: number;
  current_balance: number;
  available_limit: number;
  utilization_percentage: number;
  risk_level: string;
}

export interface UpcomingObligation {
  obligation_type: "STATEMENT" | "INSTALLMENT";
  reference_id: string;
  account_name: string;
  card_number_masked: string;
  due_date: string;
  days_remaining: number;
  total_amount_due: number;
  minimum_amount_due: number;
  payment_status: string;
}

export interface NetWorthOverview {
  total_liquid_assets: number;
  total_bank_assets: number;
  total_cash_assets: number;
  total_ewallet_assets: number;
  total_savings_assets: number;
  total_credit_debt: number;
  total_credit_limit: number;
  total_available_credit: number;
  net_worth: number;
  active_asset_accounts_count: number;
  active_credit_cards_count: number;
}

export interface MonthlyCashFlow {
  month: string;
  total_income: number;
  total_expense: number;
  net_savings: number;
  savings_rate_percent: number;
  total_transactions_count: number;
}

export interface DashboardOverview {
  total_liquid_assets: number;
  total_bank_assets: number;
  total_cash_assets: number;
  total_ewallet_assets: number;
  total_credit_limit: number;
  total_live_balance: number;
  total_available_limit: number;
  net_worth: number;
  overall_utilization_percentage: number;
  overall_risk_level: string;
  active_cards_count: number;
  active_asset_accounts_count: number;
  upcoming_obligations_count: number;
  total_upcoming_due_30d: number;
  monthly_spending_current_month: number;
  monthly_income_current_month: number;
}
