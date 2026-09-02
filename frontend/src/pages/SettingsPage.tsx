import React, { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Bell,
  CloudDownload,
  Database,
  ExternalLink,
  FileSpreadsheet,
  FolderTree,
  HelpCircle,
  RefreshCw,
  Save,
  Send,
  Settings,
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
  const [utilThreshold, setUtilThreshold] = useState(80);

  // Mutations
  const updateNotifMutation = useUpdateNotificationSettings();
  const testTelegramMutation = useTestTelegram();

  // Populate notification form when data is loaded
  useEffect(() => {
    if (notifSettings) {
      setTelegramToken(notifSettings.telegram_bot_token || "");
      setTelegramChatId(notifSettings.telegram_chat_id || "");
      setIsTelegramEnabled(notifSettings.is_telegram_enabled || false);
      setRemindDays(notifSettings.remind_days_before || 3);
      setUtilThreshold(notifSettings.remind_utilization_threshold || 80);
    }
  }, [notifSettings]);

  const handleSaveNotifSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateNotifMutation.mutateAsync({
        telegram_bot_token: telegramToken.trim() || undefined,
        telegram_chat_id: telegramChatId.trim() || undefined,
        is_telegram_enabled: isTelegramEnabled,
        remind_days_before: Number(remindDays),
        remind_utilization_threshold: Number(utilThreshold),
      });
      toast.success("Lưu cấu hình thông báo thành công!");
    } catch (err: any) {
      toast.error(`Lỗi lưu cài đặt: ${err.message}`);
    }
  };

  const handleTestTelegram = async () => {
    if (!telegramToken.trim() || !telegramChatId.trim()) {
      toast.error("Vui lòng nhập đầy đủ Bot Token và Chat ID trước khi kiểm tra!");
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

  // ETL Sync & Google Sheets state
  const [googleSheetId, setGoogleSheetId] = useState(
    "16kks0eL-j7SNxBAR3NlU5n1viIEvTjg-fAu9yWC9mAk"
  );
  const [sourceType, setSourceType] = useState<"google_sheet" | "excel">(
    "google_sheet"
  );
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [hasLocalExcel, setHasLocalExcel] = useState(true);
  const [hasCachedSheet, setHasCachedSheet] = useState(false);
  const [showSheetGuide, setShowSheetGuide] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncOutput, setSyncOutput] = useState<string>("");

  // Fetch ETL initial config
  useEffect(() => {
    etlService
      .getConfig()
      .then((res) => {
        if (res.success && res.data) {
          if (res.data.google_sheet_id)
            setGoogleSheetId(res.data.google_sheet_id);
          if (res.data.source_type)
            setSourceType(res.data.source_type as any);
          setHasLocalExcel(res.data.has_local_excel);
          setHasCachedSheet(res.data.has_cached_sheet);
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveSheetConfig = async () => {
    if (!googleSheetId.trim()) {
      toast.error("Vui lòng nhập Google Sheet ID hoặc đường dẫn URL");
      return;
    }
    setIsSavingConfig(true);
    try {
      const res = await etlService.updateConfig(googleSheetId.trim());
      if (res.success) {
        setGoogleSheetId(res.data.google_sheet_id);
        toast.success("Đã lưu cấu hình Google Sheet ID thành công!");
      } else {
        toast.error(`Lỗi: ${res.message}`);
      }
    } catch (err: any) {
      toast.error(`Lỗi khi lưu: ${err.message}`);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    const targetSource =
      sourceType === "google_sheet"
        ? `Google Sheets (${googleSheetId.slice(0, 8)}...)`
        : "File Excel nội bộ (My Credit Wallet 2.0.xlsx)";
    setSyncOutput(
      `[Khởi chạy] Đang bắt đầu đồng bộ ETL Migration từ ${targetSource}...`
    );
    toast.info(`Đang chạy đồng bộ dữ liệu từ ${targetSource}...`);
    try {
      const res = await etlService.sync(
        sourceType === "google_sheet" ? googleSheetId : undefined,
        sourceType
      );
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

  // Build clean Google Sheet URL for direct link opening
  const directSheetUrl = googleSheetId.startsWith("http")
    ? googleSheetId
    : `https://docs.google.com/spreadsheets/d/${googleSheetId}/edit`;

  return (
    <div className="space-y-8">
      {/* 1. Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Settings className="w-5 h-5 text-emerald-400" />
          <span>Cài Đặt Hệ Thống, Thông Báo & Đồng Bộ ETL</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Quản lý kênh cảnh báo Telegram Bot, cây danh mục thu chi và công cụ nạp dữ liệu từ Google Sheets / Excel
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
              <p className="text-[10px] text-slate-500 mt-1">Cảnh báo khi quẹt &gt; 80%</p>
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

      {/* 3. ETL Sync Panel - Google Sheets & Excel */}
      <Card className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <CloudDownload className="w-4 h-4 text-emerald-400" />
                <span>Đồng Bộ Dữ Liệu Tự Động (ETL Migration)</span>
              </h3>
              <Badge variant={sourceType === "google_sheet" ? "success" : "neutral"}>
                {sourceType === "google_sheet" ? "GOOGLE SHEETS" : "LOCAL EXCEL"}
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Đồng bộ dữ liệu trực tuyến từ Google Sheets: Tự động đối chiếu (Smart 2-Tier Matching), gộp giao dịch thủ công, cập nhật ngày bút toán (post_date), gán sao kê và đối soát 3 chiều.
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

        {/* Source Selector Tabs */}
        <div className="flex items-center gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800 w-fit">
          <button
            type="button"
            onClick={() => setSourceType("google_sheet")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              sourceType === "google_sheet"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <CloudDownload className="w-3.5 h-3.5 text-emerald-400" />
            <span>Google Sheets (Trực Tuyến)</span>
          </button>
          <button
            type="button"
            onClick={() => setSourceType("excel")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              sourceType === "excel"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-sky-400" />
            <span>Tệp Excel Nội Bộ (data/My Credit Wallet 2.0.xlsx)</span>
          </button>
        </div>

        {/* Google Sheet ID Input & Action Row */}
        {sourceType === "google_sheet" && (
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex flex-col md:flex-row md:items-end gap-3">
              <div className="flex-1">
                <Input
                  label="Google Sheet ID hoặc Đường Dẫn URL"
                  placeholder="VD: 16kks0eL-j7SNxBAR3NlU5n1viIEvTjg-fAu9yWC9mAk hoặc link https://docs.google.com/..."
                  value={googleSheetId}
                  onChange={(e) => setGoogleSheetId(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSaveSheetConfig}
                  isLoading={isSavingConfig}
                  leftIcon={<Save className="w-3.5 h-3.5 text-emerald-400" />}
                >
                  Lưu Cấu Hình
                </Button>

                <a
                  href={directSheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-700 text-sky-300 hover:bg-slate-800 hover:text-sky-200 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Mở Google Sheet</span>
                </a>

                <button
                  type="button"
                  onClick={() => setShowSheetGuide(!showSheetGuide)}
                  className="p-2 text-slate-400 hover:text-amber-300 rounded-xl hover:bg-slate-900 transition-colors"
                  title="Hướng dẫn phân quyền Google Sheet"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Status Bar */}
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-1">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Mã Sheet hiện tại:</span>
                <code className="text-emerald-300 font-mono font-semibold">
                  {googleSheetId.slice(0, 16)}...
                </code>
              </span>
              {hasCachedSheet && (
                <span className="text-slate-500">• Đã có bản sao lưu offline (Cache)</span>
              )}
              {hasLocalExcel && (
                <span className="text-slate-500">• Có tệp Excel dự phòng</span>
              )}
            </div>

            {/* Guide Box (Expandable) */}
            {showSheetGuide && (
              <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs space-y-2 animate-fadeIn">
                <div className="flex items-center gap-1.5 font-bold text-amber-300">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Hướng dẫn cấp quyền đọc cho Google Sheet:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px] leading-relaxed">
                  <li>
                    Mở trang tính:{" "}
                    <a
                      href={directSheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-400 underline"
                    >
                      {directSheetUrl}
                    </a>
                  </li>
                  <li>
                    Bấm nút <b>"Chia sẻ" (Share)</b> ở góc trên bên phải màn hình.
                  </li>
                  <li>
                    Tại mục <b>"Quyền truy cập chung" (General access)</b>, chọn:
                    <span className="text-amber-200 font-semibold ml-1">
                      "Bất kỳ ai có đường liên kết" (Anyone with the link)
                    </span>{" "}
                    với quyền <b>"Người xem" (Viewer)</b>.
                  </li>
                  <li>
                    Bấm <b>"Xong" (Done)</b> và quay lại đây bấm <b>"Chạy Đồng Bộ Ngay"</b>.
                  </li>
                </ol>
              </div>
            )}
          </div>
        )}

        {/* Local Excel Information */}
        {sourceType === "excel" && (
          <div className="p-3.5 rounded-xl bg-sky-950/20 border border-sky-500/30 text-xs text-sky-200/90 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-sky-400 shrink-0" />
              <span>
                Nguồn nạp: <b>data/My Credit Wallet 2.0.xlsx</b> (Tệp Excel lưu trữ trong mã nguồn máy chủ)
              </span>
            </div>
            <Badge variant={hasLocalExcel ? "success" : "danger"}>
              {hasLocalExcel ? "TỆP KHẢ DỤNG" : "KHÔNG TÌM THẤY TỆP"}
            </Badge>
          </div>
        )}

        {/* Terminal Output */}
        {syncOutput && (
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto max-h-64 overflow-y-auto space-y-1">
            <div className="flex items-center gap-2 text-slate-500 pb-2 border-b border-slate-800">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>ETL Console Output:</span>
            </div>
            <pre className="whitespace-pre-wrap leading-relaxed font-mono">{syncOutput}</pre>
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
