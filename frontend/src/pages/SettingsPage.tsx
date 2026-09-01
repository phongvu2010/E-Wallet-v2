import React, { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Database,
  FolderTree,
  RefreshCw,
  Send,
  Settings,
  ShieldAlert,
  Terminal,
} from "lucide-react";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { Input } from "../components/common/Input";
import { Spinner } from "../components/common/Spinner";
import { useToast } from "../context/ToastContext";
import {
  useTestTelegram,
  useUpdateNotificationSettings,
} from "../hooks/useFinanceMutations";
import {
  useCategoryTree,
  useNotificationSettings,
} from "../hooks/useFinanceQueries";
import { etlService } from "../services/etlService";
import { Category, CategoryTreeNode } from "../types/category";

export const SettingsPage: React.FC = () => {
  const { data: categories = [], isLoading: catLoading } = useCategoryTree();
  const { data: notifSettings } = useNotificationSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Notification Settings Form State
  const [telegramToken, setTelegramToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [isTelegramEnabled, setIsTelegramEnabled] = useState(false);
  const [remindDays, setRemindDays] = useState(3);
  const [utilThreshold, setUtilThreshold] = useState(70);

  const updateNotifMutation = useUpdateNotificationSettings();
  const testTelegramMutation = useTestTelegram();

  useEffect(() => {
    if (notifSettings) {
      setTelegramToken(notifSettings.telegram_bot_token || "");
      setTelegramChatId(notifSettings.telegram_chat_id || "");
      setIsTelegramEnabled(notifSettings.is_telegram_enabled || false);
      setRemindDays(notifSettings.remind_days_before || 3);
      setUtilThreshold(notifSettings.remind_utilization_threshold || 70);
    }
  }, [notifSettings]);

  const handleSaveNotifSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateNotifMutation.mutateAsync({
        telegram_bot_token: telegramToken.trim(),
        telegram_chat_id: telegramChatId.trim(),
        is_telegram_enabled: isTelegramEnabled,
        remind_days_before: Number(remindDays),
        remind_utilization_threshold: Number(utilThreshold),
      });
      toast.success("Lưu cấu hình thông báo thành công!");
    } catch (err: any) {
      toast.error(`Lỗi cập nhật cấu hình: ${err.message}`);
    }
  };

  const handleTestTelegram = async () => {
    if (!telegramToken.trim() || !telegramChatId.trim()) {
      toast.error("Vui lòng nhập Bot Token và Chat ID trước khi test!");
      return;
    }
    try {
      const res = await testTelegramMutation.mutateAsync({
        bot_token: telegramToken.trim(),
        chat_id: telegramChatId.trim(),
      });
      if (res.success) {
        toast.success("Gửi tin nhắn Telegram thử nghiệm thành công! Hãy kiểm tra điện thoại.");
      } else {
        toast.error(`Gửi tin nhắn thất bại: ${res.message}`);
      }
    } catch (err: any) {
      toast.error(`Lỗi kết nối: ${err.message}`);
    }
  };

  // ETL Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncOutput, setSyncOutput] = useState<string>("");

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    setSyncOutput("Bắt đầu thực thi ETL Migration script từ Excel và PDF...");
    toast.info("Đang chạy đồng bộ dữ liệu sao kê...");
    try {
      const res = await etlService.sync();
      if (res.success) {
        setSyncOutput(res.data.output || "Đồng bộ thành công!");
        toast.success("Đồng bộ dữ liệu ETL thành công!");
        queryClient.invalidateQueries();
      } else {
        setSyncOutput(res.message + "\n" + (res.data.output || ""));
        toast.error(`Đồng bộ thất bại: ${res.message}`);
      }
    } catch (err: any) {
      setSyncOutput(`Lỗi thực thi: ${err.message}`);
      toast.error(`Lỗi thực thi: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Settings className="w-5 h-5 text-emerald-400" />
          <span>Cài Đặt Hệ Thống, Thông Báo & Đồng Bộ ETL</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Quản lý kênh cảnh báo Telegram Bot, cây danh mục thu chi và công cụ nạp dữ liệu
        </p>
      </div>

      {/* 2. Smart Notification & Telegram Bot Settings */}
      <Card className="space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Bell className="w-4 h-4 text-emerald-400" />
              <span>Cấu Hình Thông Báo Tự Động & Telegram Push Alerts</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Đẩy thông báo tự động về Telegram khi sắp đến hạn thanh toán hoặc vượt ngưỡng hạn mức
            </p>
          </div>
          <Badge variant={isTelegramEnabled ? "success" : "neutral"}>
            {isTelegramEnabled ? "TELEGRAM ACTIVE" : "TELEGRAM DISABLED"}
          </Badge>
        </div>

        <form onSubmit={handleSaveNotifSettings} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Telegram Bot Token"
              placeholder="VD: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
              value={telegramToken}
              onChange={(e) => setTelegramToken(e.target.value)}
            />
            <Input
              label="Telegram Chat ID"
              placeholder="VD: 987654321 hoặc @your_channel"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-950/60 rounded-2xl border border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nhắc nợ trước (Ngày)
              </label>
              <input
                type="number"
                min={1}
                max={15}
                value={remindDays}
                onChange={(e) => setRemindDays(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">Khuyến nghị: 3 - 5 ngày</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Ngưỡng cảnh báo hạn mức (%)
              </label>
              <input
                type="number"
                min={30}
                max={100}
                value={utilThreshold}
                onChange={(e) => setUtilThreshold(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">Cảnh báo khi quẹt &gt; 70%</p>
            </div>

            <div className="flex flex-col justify-center">
              <label className="text-xs font-semibold text-slate-300 mb-1.5">
                Kích hoạt gửi tin Telegram
              </label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isTelegramEnabled}
                  onChange={(e) => setIsTelegramEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                <span className="ml-3 text-xs font-medium text-slate-300">
                  {isTelegramEnabled ? "Bật" : "Tắt"}
                </span>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestTelegram}
              isLoading={testTelegramMutation.isPending}
              leftIcon={<Send className="w-3.5 h-3.5 text-sky-400" />}
            >
              Gửi Thử Tin Nhắn Telegram
            </Button>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={updateNotifMutation.isPending}
            >
              Lưu Cấu Hình Thông Báo
            </Button>
          </div>
        </form>
      </Card>

      {/* 3. ETL Sync Panel */}
      <Card className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-emerald-400" />
              <span>Đồng Bộ Dữ Liệu Tự Động (ETL Migration)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Đọc dữ liệu từ file <b>data/My Credit Wallet 2.0.xlsx</b> và các tệp sao kê PDF trong thư mục data/
            </p>
          </div>

          <Button
            variant="primary"
            onClick={handleTriggerSync}
            isLoading={isSyncing}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            {isSyncing ? "Đang Đồng Bộ..." : "Chạy Đồng Bộ Ngay"}
          </Button>
        </div>

        {/* Terminal Output */}
        {syncOutput && (
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto max-h-60 overflow-y-auto space-y-1">
            <div className="flex items-center gap-2 text-slate-500 pb-2 border-b border-slate-800">
              <Terminal className="w-4 h-4" />
              <span>ETL Console Output:</span>
            </div>
            <pre className="whitespace-pre-wrap leading-relaxed">{syncOutput}</pre>
          </div>
        )}
      </Card>

      {/* 4. Category Tree */}
      <Card>
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-sky-400" />
              <span>Cây Danh Mục Thu Chi Phân Cấp (2 Cấp)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Cấu trúc danh mục phục vụ báo cáo và phân loại giao dịch tự động
            </p>
          </div>
        </div>

        {catLoading && categories.length === 0 ? (
          <div className="h-40 flex items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((parent: CategoryTreeNode) => (
              <div
                key={parent.id}
                className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-200">{parent.name}</h4>
                  <Badge variant="info" size="sm">
                    {parent.category_type}
                  </Badge>
                </div>

                <div className="space-y-1 pt-1 border-t border-slate-800/80">
                  {parent.children && parent.children.length > 0 ? (
                    parent.children.map((child: Category) => (
                      <div
                        key={child.id}
                        className="flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-slate-800/40 text-slate-300"
                      >
                        <span>• {child.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {child.is_system ? "System" : "Custom"}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500 italic">Không có mục con</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 5. Connection & Environment Details */}
      <Card>
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-3">
          <Database className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-slate-100">Thông Tin Môi Trường Hệ Thống</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <p className="text-slate-400">Database Engine</p>
            <p className="font-bold text-slate-200 mt-1">PostgreSQL 16-alpine</p>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <p className="text-slate-400">Backend API</p>
            <p className="font-bold text-slate-200 mt-1">FastAPI 0.115+ / Python 3.12</p>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <p className="text-slate-400">AI Intelligence</p>
            <p className="font-bold text-emerald-400 mt-1">Gemini Copilot Ready</p>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <p className="text-slate-400">Security Layer</p>
            <p className="font-bold text-emerald-400 mt-1">Supabase & RLS Ready</p>
          </div>
        </div>
      </Card>
    </div>
  );
};
