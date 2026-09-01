export interface AIChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
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
