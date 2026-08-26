export type StatementStatus = "OPEN" | "BILLED" | "PAID" | "PARTIALLY_PAID" | "OVERDUE";

export interface Statement {
  id: string;
  account_id: string;
  statement_date: string;
  start_date: string;
  end_date: string;
  payment_due_date: string;
  credit_limit: number;
  previous_balance: number;
  purchases_amount: number;
  installments_amount: number;
  fees_and_charges: number;
  payments_received: number;
  statement_balance: number;
  minimum_payment: number;
  surplus_amount: number;
  status: StatementStatus;
  source_file_path?: string;
  file_hash?: string;
  created_at?: string;
}

export interface StatementReconciliation {
  statement_id: string;
  account_name: string;
  card_number_masked: string;
  statement_date: string;
  previous_balance: number;
  purchases_amount: number;
  installments_amount: number;
  fees_and_charges: number;
  payments_received: number;
  billed_statement_balance: number;
  net_period_transactions: number;
  expected_statement_balance: number;
  discrepancy: number;
  reconciliation_status: "MATCHED" | "DISCREPANCY";
}

export interface StatementPaymentStatus {
  statement_id: string;
  account_id: string;
  account_name: string;
  card_number_masked: string;
  statement_date: string;
  payment_due_date: string;
  billed_amount: number;
  minimum_payment: number;
  total_paid_amount: number;
  remaining_balance_to_pay: number;
  payment_status: string;
  days_until_due: number;
}
