import api from "./api";

export interface TelegramBotStatus {
  is_running: boolean;
  polling_active: boolean;
  active_drafts_count: number;
  last_poll_at: string | null;
  last_error: string | null;
  last_update_id: number;
}

export const telegramService = {
  getStatus: async (): Promise<TelegramBotStatus> => {
    const res = await api.get<TelegramBotStatus>("/telegram/status");
    return res.data;
  },

  reload: async (): Promise<{ success: boolean; message: string; status: TelegramBotStatus }> => {
    const res = await api.post<{ success: boolean; message: string; status: TelegramBotStatus }>("/telegram/reload");
    return res.data;
  },
};
