import { Category } from "./category";
import { Merchant } from "./merchant";

export type TransactionType =
  | "PURCHASE"
  | "REPAYMENT"
  | "INSTALLMENT_PRINCIPAL"
  | "INSTALLMENT_MONTHLY"
  | "FEE"
  | "INTEREST"
  | "REFUND"
  | "CASHBACK_CREDIT"
  | "CASH_ADVANCE"
  | "ADJUSTMENT"
  | "TRANSFER";

export interface Transaction {
  id: string;
  account_id: string;
  statement_id?: string;
  installment_plan_id?: string;
  transfer_to_account_id?: string;
  settles_statement_id?: string;
  transaction_date: string;
  post_date?: string;
  raw_description: string;
  merchant_id?: string;
  category_id?: string;
  transaction_type: TransactionType;
  original_amount?: number;
  original_currency?: string;
  exchange_rate: number;
  foreign_fee: number;
  amount: number;
  fee: number;
  total_amount: number;
  note?: string;
  is_installment: boolean;
  tx_fingerprint?: string;
  created_at?: string;
  category?: Category;
  merchant?: Merchant;
}

export interface TransactionFilterParams {
  account_id?: string;
  statement_id?: string;
  category_id?: string;
  merchant_id?: string;
  transaction_type?: TransactionType;
  start_date?: string;
  end_date?: string;
  min_amount?: number;
  max_amount?: number;
  is_installment?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface TransactionSummary {
  total_transactions: number;
  total_spending: number;
  total_repayments: number;
  total_fees_interest: number;
  net_flow: number;
}

export interface TransactionCreatePayload {
  account_id: string;
  statement_id?: string;
  transaction_date: string;
  post_date?: string;
  raw_description: string;
  merchant_id?: string;
  category_id?: string;
  transaction_type?: TransactionType;
  original_amount?: number;
  original_currency?: string;
  exchange_rate?: number;
  foreign_fee?: number;
  amount: number;
  fee?: number;
  total_amount: number;
  note?: string;
}

export interface TransactionUpdatePayload {
  category_id?: string;
  merchant_id?: string;
  note?: string;
  statement_id?: string;
  settles_statement_id?: string;
  transaction_type?: TransactionType;
}
