import { Merchant } from "./merchant";

export type InstallmentStatus = "ACTIVE" | "COMPLETED" | "CANCELLED" | "EARLY_SETTLED";

export interface InstallmentSchedule {
  id: string;
  installment_plan_id: string;
  statement_id?: string;
  installment_index: number;
  total_installments: number;
  due_date: string;
  principal_amount: number;
  interest_amount: number;
  total_installment_amount: number;
  is_billed: boolean;
  created_at?: string;
}

export interface InstallmentPlan {
  id: string;
  account_id: string;
  origin_transaction_id?: string;
  product_name: string;
  merchant_id?: string;
  start_date: string;
  total_amount: number;
  conversion_fee: number;
  interest_rate_percent: number;
  term_months: number;
  monthly_principal: number;
  monthly_interest: number;
  monthly_payment: number;
  remaining_balance: number;
  status: InstallmentStatus;
  created_at?: string;
  merchant?: Merchant;
  schedules?: InstallmentSchedule[];
}

export interface InstallmentForecast {
  billing_month: string;
  active_plans_count: number;
  total_principal_due: number;
  total_interest_due: number;
  total_monthly_payment: number;
}

export interface EarlySettlePayload {
  statement_id?: string;
  fee_percent?: number;
  custom_fee?: number;
}

export interface EarlySettleResult {
  plan_id: string;
  product_name: string;
  settled_principal: number;
  early_settlement_fee: number;
  new_status: InstallmentStatus;
}
