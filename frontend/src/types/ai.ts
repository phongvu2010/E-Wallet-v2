import { TransactionType } from "./transaction";

export interface AITransactionDraft {
  action_type?: string;
  account_id?: string;
  account_name?: string;
  account_bank_name?: string;
  transaction_type: TransactionType;
  amount: number;
  fee?: number;
  total_amount?: number;
  transaction_date: string;
  post_date?: string;
  category_id?: string;
  category_name?: string;
  parent_category_name?: string;
  merchant_name?: string;
  raw_description?: string;
  note?: string;
  transfer_to_account_id?: string;
  transfer_to_account_name?: string;
  confidence_score?: number;
}

export interface AIChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  action?: string;
  transaction_draft?: AITransactionDraft;
  draft_status?: "pending" | "confirmed" | "cancelled";
}

export interface AIChatRequest {
  message: string;
  history?: AIChatMessage[];
  include_financial_context?: boolean;
}

export interface AIChatResponse {
  reply: string;
  suggested_followups?: string[];
  insights?: Record<string, any>;
  action?: string;
  transaction_draft?: AITransactionDraft;
}


export interface AIParsedTransaction {
  transaction_date: string;
  post_date?: string;
  raw_description: string;
  amount: number;
  fee?: number;
  total_amount: number;
  original_amount?: number;
  original_currency?: string;
  exchange_rate?: number;
  category_hint?: string;
  transaction_type_hint?: string;
}

export interface AIParsedStatement {
  bank_detected: string;
  account_number_hint?: string;
  statement_date: string;
  payment_due_date: string;
  credit_limit: number;
  previous_balance: number;
  purchases_amount: number;
  payments_received: number;
  statement_balance: number;
  minimum_payment: number;
  earned_reward_points?: number;
  transactions: AIParsedTransaction[];
  parsing_notes?: string;
}

export interface AIPdfExtractionResponse {
  success: boolean;
  filename: string;
  data?: AIParsedStatement;
  error?: string;
}
