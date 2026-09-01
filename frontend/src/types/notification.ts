export type NotificationType =
  | "PAYMENT_DUE"
  | "OVERDUE_ALERT"
  | "UTILIZATION_HIGH"
  | "REWARD_EXPIRING"
  | "ETL_SYNC_COMPLETED"
  | "EARLY_SETTLED"
  | "SYSTEM_ANNOUNCEMENT";

export type NotificationSeverity = "INFO" | "SUCCESS" | "WARNING" | "DANGER";

export interface NotificationItem {
  id: string;
  user_id?: string;
  title: string;
  message: string;
  notification_type: NotificationType;
  severity: NotificationSeverity;
  is_read: boolean;
  action_url?: string;
  metadata_json?: Record<string, any>;
  created_at: string;
}

export interface NotificationSettings {
  id: string;
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  is_telegram_enabled: boolean;
  is_in_app_enabled: boolean;
  remind_days_before: number;
  remind_utilization_threshold: number;
  created_at?: string;
  updated_at?: string;
}

export interface NotificationSettingsUpdate {
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  is_telegram_enabled?: boolean;
  is_in_app_enabled?: boolean;
  remind_days_before?: number;
  remind_utilization_threshold?: number;
}

export interface NotificationSummary {
  unread_count: number;
  total_count: number;
  items: NotificationItem[];
}

export interface TelegramTestResponse {
  success: boolean;
  message: string;
  detail?: string;
}
