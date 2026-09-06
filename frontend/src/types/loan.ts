import { Institution } from "./institution";

export type LoanType = "MORTGAGE" | "CONSUMER" | "AUTO" | "BUSINESS" | "OVERDRAFT" | "OTHER";
export type InterestMethod = "REDUCING_BALANCE" | "EQUAL_INSTALLMENT" | "FLAT";
export type LoanStatus = "ACTIVE" | "PAID_OFF" | "OVERDUE" | "CANCELLED";
export type LoanScheduleStatus = "UNPAID" | "PAID" | "OVERDUE";

export interface LoanSchedule {
  id: string;
  loan_id: string;
  period_index: number;
  total_periods: number;
  due_date: string;
  applied_interest_rate: number;
  beginning_balance: number;
  principal_amount: number;
  interest_amount: number;
  monthly_fee?: number;
  total_payment: number;
  ending_balance: number;
  status: LoanScheduleStatus;
  paid_date?: string | null;
  paid_amount?: number | null;
  transaction_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface LoanRateHistory {
  id: string;
  loan_id: string;
  old_rate: number;
  new_rate: number;
  old_monthly_fee?: number;
  new_monthly_fee?: number;
  effective_from_period: number;
  effective_date: string;
  reason?: string | null;
  created_at?: string;
}

export interface Loan {
  id: string;
  user_id?: string | null;
  account_id?: string | null;
  institution_id?: string | null;
  loan_name: string;
  loan_code?: string | null;
  loan_type: LoanType;
  interest_method: InterestMethod;
  principal_amount: number;
  term_months: number;
  monthly_fee?: number;
  start_date: string;
  billing_day_of_month: number;
  current_interest_rate: number;
  base_rate?: number;
  floating_margin?: number;
  remaining_principal: number;
  total_paid_principal: number;
  total_paid_interest: number;
  total_projected_interest: number;
  status: LoanStatus;
  note?: string | null;
  created_at?: string;
  updated_at?: string;
  institution?: Institution | null;
  schedules?: LoanSchedule[];
  rate_histories?: LoanRateHistory[];
}

export interface LoanCreatePayload {
  account_id?: string | null;
  institution_id?: string | null;
  loan_name: string;
  loan_code?: string | null;
  loan_type: LoanType;
  interest_method: InterestMethod;
  principal_amount: number;
  term_months: number;
  monthly_fee?: number;
  start_date: string;
  billing_day_of_month?: number;
  current_interest_rate: number;
  base_rate?: number;
  floating_margin?: number;
  note?: string | null;
}

export interface LoanUpdatePayload {
  account_id?: string | null;
  institution_id?: string | null;
  loan_name?: string;
  loan_code?: string | null;
  loan_type?: LoanType;
  monthly_fee?: number;
  billing_day_of_month?: number;
  note?: string | null;
  status?: LoanStatus;
}

export interface AdjustLoanRatePayload {
  new_interest_rate: number;
  new_monthly_fee?: number;
  effective_from_period: number;
  effective_date?: string;
  reason?: string;
}

export interface PayLoanPeriodPayload {
  period_index: number;
  payment_account_id?: string | null;
  paid_amount?: number;
  paid_date?: string;
  note?: string;
}

export interface EarlySettleLoanPayload {
  settlement_account_id?: string | null;
  fee_percent?: number;
  custom_fee?: number;
  settlement_date?: string;
}

export interface LoanSummaryKPIs {
  total_active_loans: number;
  total_remaining_principal: number;
  total_paid_interest: number;
  total_paid_principal: number;
  due_this_month_amount: number;
  due_this_month_count: number;
}
