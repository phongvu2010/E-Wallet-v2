import {
  NotificationItem,
  NotificationSettings,
  NotificationSettingsUpdate,
  NotificationSummary,
  SchedulerStatus,
  TelegramTestResponse,
} from "../types/notification";
import api from "./api";

export const notificationService = {
  getSummary: async (): Promise<NotificationSummary> => {
    const res = await api.get<NotificationSummary>("/notifications/summary");
    return res.data;
  },

  getAll: async (limit = 50, unreadOnly = false): Promise<NotificationItem[]> => {
    const res = await api.get<NotificationItem[]>("/notifications", {
      params: { limit, unread_only: unreadOnly },
    });
    return res.data;
  },

  markRead: async (id: string): Promise<void> => {
    await api.patch(`/notifications/${id}/read`);
  },

  markAllRead: async (): Promise<{ count: number }> => {
    const res = await api.post<{ count: number }>("/notifications/mark-all-read");
    return res.data;
  },

  scanAlerts: async (): Promise<{ alerts_created: number }> => {
    const res = await api.post<{ alerts_created: number }>("/notifications/scan");
    return res.data;
  },

  getSettings: async (): Promise<NotificationSettings> => {
    const res = await api.get<NotificationSettings>("/notifications/settings");
    return res.data;
  },

  updateSettings: async (
    payload: NotificationSettingsUpdate
  ): Promise<NotificationSettings> => {
    const res = await api.put<NotificationSettings>(
      "/notifications/settings",
      payload
    );
    return res.data;
  },

  testTelegram: async (payload?: {
    bot_token?: string;
    chat_id?: string;
    custom_message?: string;
  }): Promise<TelegramTestResponse> => {
    const res = await api.post<TelegramTestResponse>(
      "/notifications/test-telegram",
      payload
    );
    return res.data;
  },

  getSchedulerStatus: async (): Promise<SchedulerStatus> => {
    const res = await api.get<SchedulerStatus>("/notifications/scheduler/status");
    return res.data;
  },
};
