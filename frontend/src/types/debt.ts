export type DebtType = "BORROW" | "LEND";
export type DebtStatus = "ACTIVE" | "PAID_OFF" | "CANCELLED";

export interface DebtRepayment {
  id: string;
  debt_id: string;
  account_id?: string;
  account_name?: string;
  account_bank_name?: string;
  repayment_date: string;
  principal_paid: number;
  extra_amount: number;
  total_amount: number;
  transaction_id?: string;
  extra_transaction_id?: string;
  note?: string;
  created_at: string;
}

export interface Debt {
  id: string;
  user_id?: string;
  account_id?: string;
  account_name?: string;
  account_bank_name?: string;
  counterparty_name: string;
  counterparty_phone?: string;
  debt_type: DebtType;
  principal_amount: number;
  remaining_amount: number;
  total_paid_principal: number;
  total_extra_amount: number;
  start_date: string;
  due_date?: string;
  status: DebtStatus;
  note?: string;
  created_at: string;
  updated_at: string;
  repayments: DebtRepayment[];
}

export interface DebtCreatePayload {
  counterparty_name: string;
  counterparty_phone?: string;
  debt_type: DebtType;
  principal_amount: number;
  start_date: string;
  due_date?: string;
  account_id?: string;
  note?: string;
}

export interface DebtUpdatePayload {
  counterparty_name?: string;
  counterparty_phone?: string;
  due_date?: string;
  status?: DebtStatus;
  note?: string;
}

export interface DebtRepaymentPayload {
  repayment_date: string;
  principal_paid: number;
  extra_amount?: number;
  account_id?: string;
  extra_category_id?: string;
  note?: string;
}

export interface DebtSummaryKPIs {
  total_borrow_count: number;
  total_borrow_principal: number;
  total_borrow_remaining: number;
  total_borrow_paid: number;
  total_borrow_extra_paid: number;

  total_lend_count: number;
  total_lend_principal: number;
  total_lend_remaining: number;
  total_lend_collected: number;
  total_lend_extra_received: number;
}
