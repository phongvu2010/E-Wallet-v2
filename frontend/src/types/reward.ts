export type RewardType = "POINT" | "CASHBACK" | "MILE";

export interface RewardLedger {
  id: string;
  account_id: string;
  statement_id?: string;
  reward_type: RewardType;
  previous_remaining: number;
  earned_this_month: number;
  used_this_month: number;
  available_balance: number;
  expiring_amount: number;
  expiration_date?: string;
  created_at?: string;
}
