import { Institution } from "./institution";

export type AccountType = "CREDIT_CARD" | "DEBIT_CARD" | "BANK_ACCOUNT" | "E_WALLET" | "CASH" | "SAVINGS";
export type AccountStatus = "ACTIVE" | "LOCKED" | "CLOSED" | "EXPIRED" | "REPLACED";

export interface Account {
  id: string;
  institution_id?: string;
  account_name: string;
  account_type: AccountType;
  card_number_masked: string;
  card_number_last4: string;
  initial_balance?: number;
  credit_limit: number;
  billing_day_of_month?: number;
  grace_period_days: number;
  status: AccountStatus;
  replaces_account_id?: string;
  opened_date?: string;
  closed_date?: string;
  color_hex?: string;
  note?: string;
  created_at?: string;
  updated_at?: string;
  institution?: Institution;
}

export interface AccountOverview {
  account_id: string;
  account_name: string;
  bank_name: string;
  card_number_masked: string;
  credit_limit: number;
  latest_statement_balance: number;
  next_payment_due_date: string;
  status: AccountStatus;
  replaces_account_id?: string;
  replaced_by_card_number?: string;
}

export interface AccountLiveBalance {
  account_id: string;
  account_name: string;
  account_type?: AccountType;
  is_asset?: boolean;
  bank_name?: string;
  card_number_masked?: string;
  color_hex?: string;
  initial_balance?: number;
  credit_limit: number;
  latest_statement_date?: string;
  latest_statement_balance: number;
  unbilled_charges: number;
  unbilled_credits: number;
  unbilled_net_amount: number;
  unbilled_transaction_count: number;
  live_current_balance: number;
  live_available_limit: number;
  live_utilization_percentage: number;
  live_risk_level: string;
  next_payment_due_date?: string;
  status: AccountStatus;
}

export interface AccountCreatePayload {
  institution_id?: string;
  account_name: string;
  account_type?: AccountType;
  card_number_masked?: string;
  card_number_last4?: string;
  initial_balance?: number;
  credit_limit?: number;
  billing_day_of_month?: number;
  grace_period_days?: number;
  status?: AccountStatus;
  replaces_account_id?: string;
  color_hex?: string;
  note?: string;
}

export interface AccountUpdatePayload {
  account_name?: string;
  initial_balance?: number;
  credit_limit?: number;
  billing_day_of_month?: number;
  grace_period_days?: number;
  status?: AccountStatus;
  replaces_account_id?: string;
  closed_date?: string;
  color_hex?: string;
  note?: string;
}
