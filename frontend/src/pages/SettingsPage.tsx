import React, { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  Bell,
  Bot,
  Check,
  CheckCircle2,
  Clock,
  CloudDownload,
  Copy,
  Database,
  Edit3,
  ExternalLink,
  FileSpreadsheet,
  FolderPlus,
  FolderTree,
  HelpCircle,
  Layers,
  Palette,
  Play,
  Plus,
  RefreshCw,
  Save,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Tag,
  Terminal,
  Trash2,
} from "lucide-react";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { Input } from "../components/common/Input";
import { Modal } from "../components/common/Modal";
import { Select } from "../components/common/Select";
import { Spinner } from "../components/common/Spinner";
import { useToast } from "../context/ToastContext";
import {
  useCreateCategory,
  useDeleteCategory,
  useTestTelegram,
  useUpdateCategory,
  useUpdateNotificationSettings,
} from "../hooks/useFinanceMutations";
import {
  useCategoryTree,
  useNotificationSettings,
  useSchedulerStatus,
  useTelegramBotStatus,
} from "../hooks/useFinanceQueries";
import { etlService } from "../services/etlService";
import { notificationService } from "../services/notificationService";
import { telegramService } from "../services/telegramService";
import { Category, CategoryTreeNode, CategoryType } from "../types/category";
import { getCategoryTypeLabel } from "../utils/formatters";

export const SettingsPage: React.FC = () => {
  const { data: categories = [], isLoading: catLoading } = useCategoryTree();
  const { data: notifSettings } = useNotificationSettings();
  const { data: schedulerStatus } = useSchedulerStatus();
  const { data: telegramBotStatus, refetch: refetchTelegramStatus } = useTelegramBotStatus();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Category Mutations & State
  const createCategoryMutation = useCreateCategory();
  const updateCategoryMutation = useUpdateCategory();
  const deleteCategoryMutation = useDeleteCategory();

  const [categoryTypeTab, setCategoryTypeTab] = useState<string>("ALL");
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [isDeleteCatModalOpen, setIsDeleteCatModalOpen] = useState(false);
  const [catModalMode, setCatModalMode] = useState<"create_parent" | "create_child" | "edit">("create_parent");
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catFormName, setCatFormName] = useState("");
  const [catFormType, setCatFormType] = useState<CategoryType>("EXPENSE");
  const [catFormParentId, setCatFormParentId] = useState("");
  const [catFormColor, setCatFormColor] = useState("#10b981");
  const [catFormIcon, setCatFormIcon] = useState("Tag");
  const [targetDeleteCat, setTargetDeleteCat] = useState<Category | null>(null);
  const [catFormError, setCatFormError] = useState<string | null>(null);

  const COLOR_PALETTE = [
    "#10b981", // Emerald
    "#06b6d4", // Cyan
    "#3b82f6", // Blue
    "#6366f1", // Indigo
    "#8b5cf6", // Purple
    "#d946ef", // Fuchsia
    "#ec4899", // Pink
    "#f43f5e", // Rose
    "#f59e0b", // Amber
    "#eab308", // Yellow
    "#64748b", // Slate
  ];

  const handleOpenCreateParent = () => {
    setCatModalMode("create_parent");
    setEditingCat(null);
    setCatFormName("");
    setCatFormType(
      categoryTypeTab !== "ALL" ? (categoryTypeTab as CategoryType) : "EXPENSE"
    );
    setCatFormParentId("");
    setCatFormIcon("Tag");
    setCatFormColor("#10b981");
    setCatFormError(null);
    setIsCatModalOpen(true);
  };

  const handleOpenCreateChild = (parent: CategoryTreeNode) => {
    setCatModalMode("create_child");
    setEditingCat(null);
    setCatFormName("");
    setCatFormType(parent.category_type);
    setCatFormParentId(parent.id);
    setCatFormIcon("Tag");
    setCatFormColor(parent.color || "#0284c7");
    setCatFormError(null);
    setIsCatModalOpen(true);
  };

  const handleOpenEditCategory = (cat: Category) => {
    setCatModalMode("edit");
    setEditingCat(cat);
    setCatFormName(cat.name);
    setCatFormType(cat.category_type);
    setCatFormParentId(cat.parent_id || "");
    setCatFormIcon(cat.icon || "Tag");
    setCatFormColor(cat.color || "#3b82f6");
    setCatFormError(null);
    setIsCatModalOpen(true);
  };

  const handleOpenDeleteCategory = (cat: Category) => {
    setTargetDeleteCat(cat);
    setIsDeleteCatModalOpen(true);
  };

  const handleSubmitCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catFormName.trim()) {
      setCatFormError("Tên danh mục không được để trống!");
      return;
    }
    setCatFormError(null);

    try {
      if (catModalMode === "edit" && editingCat) {
        await updateCategoryMutation.mutateAsync({
          id: editingCat.id,
          payload: {
            name: catFormName.trim(),
            category_type: catFormType,
            parent_id: catFormParentId ? catFormParentId : null,
            icon: catFormIcon || undefined,
            color: catFormColor || undefined,
          },
        });
        toast.success(`Đã cập nhật danh mục "${catFormName.trim()}" thành công!`);
      } else if (catModalMode === "create_parent") {
        await createCategoryMutation.mutateAsync({
          name: catFormName.trim(),
          category_type: catFormType,
          parent_id: undefined,
          icon: catFormIcon || undefined,
          color: catFormColor || undefined,
        });
        toast.success(`Đã tạo nhóm danh mục "${catFormName.trim()}" thành công!`);
      } else if (catModalMode === "create_child") {
        await createCategoryMutation.mutateAsync({
          name: catFormName.trim(),
          category_type: catFormType,
          parent_id: catFormParentId,
          icon: catFormIcon || undefined,
          color: catFormColor || undefined,
        });
        toast.success(`Đã tạo danh mục con "${catFormName.trim()}" thành công!`);
      }
      setIsCatModalOpen(false);
    } catch (err: any) {
      setCatFormError(err.message || "Lỗi khi lưu danh mục.");
      toast.error(`Lỗi: ${err.message}`);
    }
  };

  const handleConfirmDeleteCategory = async () => {
    if (!targetDeleteCat) return;
    try {
      await deleteCategoryMutation.mutateAsync(targetDeleteCat.id);
      toast.success(`Đã xóa danh mục "${targetDeleteCat.name}" thành công!`);
      setIsDeleteCatModalOpen(false);
      setTargetDeleteCat(null);
    } catch (err: any) {
      toast.error(`Lỗi khi xóa danh mục: ${err.message}`);
    }
  };

  // Notification Settings Form State
  const [telegramToken, setTelegramToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [isTelegramEnabled, setIsTelegramEnabled] = useState(false);
  const [remindDays, setRemindDays] = useState(3);
  const [utilThreshold, setUtilThreshold] = useState(80);
  const [isScanningNow, setIsScanningNow] = useState(false);
  const [isReloadingBot, setIsReloadingBot] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);

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
      refetchTelegramStatus();
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

  const handleReloadTelegramBot = async () => {
    setIsReloadingBot(true);
    try {
      const res = await telegramService.reload();
      if (res.success) {
        toast.success("Đã làm mới và khởi động lại dịch vụ Telegram Bot!");
        refetchTelegramStatus();
      }
    } catch (err: any) {
      toast.error(`Lỗi làm mới Bot: ${err.message}`);
    } finally {
      setIsReloadingBot(false);
    }
  };

  const handleCopyPrompt = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPrompt(text);
    toast.success(`Đã sao chép: "${text}"`);
    setTimeout(() => setCopiedPrompt(null), 2000);
  };

  const handleTriggerManualScan = async () => {
    setIsScanningNow(true);
    try {
      const res = await notificationService.scanAlerts();
      toast.success(
        `Quét thành công! Hệ thống đã tạo ${res.alerts_created} thông báo / cảnh báo mới.`
      );
      queryClient.invalidateQueries({ queryKey: ["notification-summary"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["scheduler-status"] });
    } catch (err: any) {
      toast.error(`Lỗi khi quét cảnh báo: ${err.message}`);
    } finally {
      setIsScanningNow(false);
    }
  };

  // ETL Sync & Google Sheets state
  const [googleSheetId, setGoogleSheetId] = useState(
    ""
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
          Quản lý kênh cảnh báo Telegram Bot, tiến trình giám sát nền và công cụ nạp dữ liệu từ Google Sheets / Excel
        </p>
      </div>

      {/* 2. Automated Monitoring & Background Scheduler Card */}
      <Card className="space-y-4 border-emerald-500/20 bg-slate-900/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Tự Động Hóa Giám Sát & Quét Cảnh Báo</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  BACKGROUND ENGINE
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Tiến trình nền tự động quét hạn trả nợ, lịch trả góp, tỷ lệ sử dụng hạn mức và điểm thưởng
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleTriggerManualScan}
            isLoading={isScanningNow}
            leftIcon={<Play className="w-3.5 h-3.5 fill-current" />}
            className="w-full sm:w-auto justify-center"
          >
            Quét Cảnh Báo Ngay
          </Button>
        </div>

        {/* Scheduler Diagnostic Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              <span>Chu kỳ quét tự động</span>
            </span>
            <p className="font-mono font-bold text-slate-200 text-sm">
              Mỗi {schedulerStatus?.interval_hours ?? 6} Giờ
            </p>
          </div>

          <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Lần quét gần nhất</span>
            </span>
            <p className="font-mono font-semibold text-slate-300 text-xs truncate">
              {schedulerStatus?.last_run_at
                ? new Date(schedulerStatus.last_run_at).toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "2-digit",
                    month: "2-digit",
                  })
                : "Chưa quét"}
            </p>
          </div>

          <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span>Tổng chu kỳ hoàn tất</span>
            </span>
            <p className="font-mono font-bold text-slate-200 text-sm">
              {schedulerStatus?.total_scans_completed ?? 0} lần
            </p>
          </div>

          <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
              <Bell className="w-3.5 h-3.5 text-teal-400" />
              <span>Cảnh báo mới nhất</span>
            </span>
            <p className="font-mono font-bold text-emerald-400 text-sm">
              {schedulerStatus?.last_alerts_generated ?? 0} alerts
            </p>
          </div>
        </div>
      </Card>

      {/* 3. Smart Notification & Telegram Bot 2-Way Assistant Settings */}
      <Card className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Bot className="w-5 h-5 text-emerald-400" />
              <span>Cấu Hình Trợ Lý Telegram Bot & Thông Báo Tự Động</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Ra lệnh ghi chép giao dịch, tra cứu dư nợ thẻ, Net worth và nhận cảnh báo hạn thanh toán tức thời trên Telegram
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={telegramBotStatus?.polling_active ? "success" : isTelegramEnabled ? "warning" : "neutral"}>
              {telegramBotStatus?.polling_active
                ? "BOT 2-WAY ACTIVE"
                : isTelegramEnabled
                ? "CHỜ KẾT NỐI"
                : "TELEGRAM DISABLED"}
            </Badge>
          </div>
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
              label="Telegram Chat ID (Chủ Tài Khoản)"
              placeholder="VD: 987654321"
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
                Kích hoạt Telegram Bot & Thông báo
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
                  {isTelegramEnabled ? "Đang bật" : "Đang tắt"}
                </span>
              </label>
            </div>
          </div>

          {/* Telegram Bot 2-Way Commands Cheatsheet */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/30 via-slate-950 to-slate-900 border border-emerald-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-emerald-300 uppercase tracking-wide">
                  Hướng Dẫn Ra Lệnh & Tra Cứu Qua Bot Telegram
                </span>
              </div>
              <span className="text-[11px] text-slate-400">Nhấn vào câu lệnh để sao chép nhanh</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {/* Box 1: Natural Language Transaction Commands */}
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
                <p className="font-semibold text-slate-200 flex items-center gap-1.5 text-[11px]">
                  <span>✍️ Thêm Giao Dịch Tự Nhiên (1-Click Ghi Sổ):</span>
                </p>
                <div className="space-y-1.5">
                  {[
                    "Ăn trưa 45k tiền mặt",
                    "Cafe Highland 50k thẻ Techcombank",
                    "Chuyển 2tr từ VCB sang MoMo phí 1k",
                    "Nhận lương 25tr vào Vietcombank",
                    "Trả nợ thẻ TPBank 5 triệu",
                    "Đổ xăng 80k tiền mặt hôm qua",
                  ].map((cmd) => (
                    <button
                      key={cmd}
                      type="button"
                      onClick={() => handleCopyPrompt(cmd)}
                      className="w-full flex items-center justify-between p-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-500/30 text-left font-mono text-[11px] text-slate-300 group transition-all"
                    >
                      <span className="text-emerald-300 group-hover:text-emerald-200">{cmd}</span>
                      {copiedPrompt === cmd ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Box 2: Quick Lookup Commands */}
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
                <p className="font-semibold text-slate-200 flex items-center gap-1.5 text-[11px]">
                  <span>💳 Lệnh Tra Cứu Tài Chính Tức Thời:</span>
                </p>
                <div className="space-y-1.5">
                  {[
                    { cmd: "/du_no", desc: "Dư nợ, hạn mức & tỷ lệ sử dụng thẻ" },
                    { cmd: "/tai_san", desc: "Tổng tài sản ròng Net Worth & các ví" },
                    { cmd: "/sap_den_han", desc: "Nghĩa vụ sao kê/trả góp trong 30 ngày" },
                    { cmd: "/chi_tieu", desc: "Top hạng mục chi tiêu tháng này" },
                    { cmd: "/start", desc: "Xem menu hướng dẫn tương tác" },
                  ].map((item) => (
                    <button
                      key={item.cmd}
                      type="button"
                      onClick={() => handleCopyPrompt(item.cmd)}
                      className="w-full flex items-center justify-between p-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-sky-950/40 border border-slate-800 hover:border-sky-500/30 text-left text-[11px] text-slate-300 group transition-all"
                    >
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-sky-300 font-bold group-hover:text-sky-200">{item.cmd}</span>
                        <span className="text-slate-400 font-sans text-[10px]">({item.desc})</span>
                      </div>
                      {copiedPrompt === item.cmd ? (
                        <Check className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
            <div className="flex items-center gap-2">
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
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReloadTelegramBot}
                isLoading={isReloadingBot}
                leftIcon={<RefreshCw className="w-3.5 h-3.5 text-amber-400" />}
                title="Khởi động lại vòng lặp Telegram Polling"
              >
                Tải Lại Bot Service
              </Button>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={updateNotifMutation.isPending}
            >
              Lưu Cấu Hình Thông Báo & Bot
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

      {/* 4. Interactive Category Manager (CRUD) */}
      <Card className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-emerald-400" />
                <span>Quản Lý Cây Danh Mục Thu Chi Phân Cấp (2 Cấp)</span>
              </h3>
              <Badge variant="info">
                {categories.length} Nhóm Cha • {categories.reduce((acc, c) => acc + (c.children?.length || 0), 0)} Mục Con
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Thêm mới, tùy chỉnh và xóa danh mục phân cấp theo nhu cầu chi tiêu & thu nhập cá nhân của bạn
            </p>
          </div>

          <Button
            variant="primary"
            onClick={handleOpenCreateParent}
            leftIcon={<FolderPlus className="w-4 h-4" />}
          >
            Thêm Nhóm Danh Mục (Cấp 1)
          </Button>
        </div>

        {/* Category Type Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 w-fit">
          {[
            { id: "ALL", label: "Tất cả", count: categories.length },
            {
              id: "EXPENSE",
              label: "Chi tiêu",
              count: categories.filter((c) => c.category_type === "EXPENSE").length,
            },
            {
              id: "INCOME",
              label: "Thu nhập",
              count: categories.filter((c) => c.category_type === "INCOME").length,
            },
            {
              id: "TRANSFER",
              label: "Chuyển tiền",
              count: categories.filter((c) => c.category_type === "TRANSFER").length,
            },
            {
              id: "FEE_INTEREST",
              label: "Phí & Lãi",
              count: categories.filter((c) => c.category_type === "FEE_INTEREST").length,
            },
            {
              id: "ADJUSTMENT",
              label: "Điều chỉnh",
              count: categories.filter((c) => c.category_type === "ADJUSTMENT").length,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategoryTypeTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                categoryTypeTab === tab.id
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>{tab.label}</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 rounded-full font-mono text-slate-300">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {catLoading && categories.length === 0 ? (
          <div className="h-40 flex items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {categories
              .filter((parent: CategoryTreeNode) => {
                if (categoryTypeTab === "ALL") return true;
                return parent.category_type === categoryTypeTab;
              })
              .map((parent: CategoryTreeNode) => {
                const childCount = parent.children?.length || 0;
                const typeColor =
                  parent.category_type === "INCOME"
                    ? "success"
                    : parent.category_type === "EXPENSE"
                    ? "danger"
                    : parent.category_type === "TRANSFER"
                    ? "info"
                    : "warning";

                return (
                  <div
                    key={parent.id}
                    className="p-4 bg-slate-950/70 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-start gap-3"
                    style={{
                      borderTopColor: parent.color || "#10b981",
                      borderTopWidth: "3px",
                    }}
                  >
                    {/* Parent Header */}
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                            style={{ backgroundColor: parent.color || "#10b981" }}
                          />
                          <h4
                            className="font-bold text-sm text-slate-100 truncate"
                            title={parent.name}
                          >
                            {parent.name}
                          </h4>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenCreateChild(parent)}
                            className="p-1 px-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 text-sky-400 hover:text-sky-300 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                            title="Thêm danh mục con vào nhóm này"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Mục con</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditCategory(parent)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors"
                            title="Chỉnh sửa nhóm danh mục"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenDeleteCategory(parent)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                            title="Xóa nhóm danh mục"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant={typeColor as any} size="sm">
                          {getCategoryTypeLabel(parent.category_type)}
                        </Badge>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {childCount} mục con
                        </span>
                        {parent.is_system && (
                          <span className="text-[10px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                            Mặc định
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Children List */}
                    <div className="space-y-1 pt-2 border-t border-slate-800/80 max-h-48 overflow-y-auto pr-1">
                      {parent.children && parent.children.length > 0 ? (
                        parent.children.map((child: Category) => (
                          <div
                            key={child.id}
                            className="group flex items-center justify-between text-xs py-1.5 px-2.5 rounded-xl bg-slate-900/40 hover:bg-slate-800/70 border border-transparent hover:border-slate-700/60 text-slate-300 transition-all"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{
                                  backgroundColor: child.color || parent.color || "#0284c7",
                                }}
                              />
                              <span className="truncate font-medium text-slate-200">
                                {child.name}
                              </span>
                              {child.is_system && (
                                <span className="text-[9px] text-slate-500 font-mono">
                                  System
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity shrink-0">
                              <button
                                type="button"
                                onClick={() => handleOpenEditCategory(child)}
                                className="p-1 rounded text-slate-400 hover:text-emerald-400 transition-colors"
                                title="Sửa danh mục con"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenDeleteCategory(child)}
                                className="p-1 rounded text-slate-400 hover:text-rose-400 transition-colors"
                                title="Xóa danh mục con"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-center rounded-xl bg-slate-900/30 border border-dashed border-slate-800 text-xs text-slate-500">
                          <p>Chưa có danh mục con</p>
                          <button
                            type="button"
                            onClick={() => handleOpenCreateChild(parent)}
                            className="text-xs font-semibold text-sky-400 hover:text-sky-300 mt-1 inline-flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Thêm mục con ngay</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </Card>

      {/* Category Create / Edit Modal */}
      <Modal
        isOpen={isCatModalOpen}
        onClose={() => setIsCatModalOpen(false)}
        title={
          catModalMode === "edit"
            ? `Chỉnh Sửa Danh Mục: ${editingCat?.name || ""}`
            : catModalMode === "create_child"
            ? `Thêm Danh Mục Con Mới`
            : "Thêm Nhóm Danh Mục Mới (Cấp 1)"
        }
      >
        <form onSubmit={handleSubmitCategory} className="space-y-4">
          <Input
            label="Tên danh mục"
            placeholder="VD: Cà phê & Trà sữa, Tiền thưởng, Mua sắm Online..."
            value={catFormName}
            onChange={(e) => setCatFormName(e.target.value)}
            required
            autoFocus
          />

          {/* Category Type Select */}
          {catModalMode !== "create_child" && (!editingCat || !editingCat.parent_id) ? (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Loại danh mục
              </label>
              <Select
                value={catFormType}
                onChange={(e) => setCatFormType(e.target.value as CategoryType)}
                options={[
                  { value: "EXPENSE", label: "Chi tiêu" },
                  { value: "INCOME", label: "Thu nhập" },
                  { value: "TRANSFER", label: "Chuyển tiền" },
                  { value: "FEE_INTEREST", label: "Phí & Lãi suất" },
                  { value: "ADJUSTMENT", label: "Điều chỉnh / Hoàn tiền" },
                ]}
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nhóm danh mục cha
              </label>
              <Select
                value={catFormParentId}
                onChange={(e) => setCatFormParentId(e.target.value)}
                options={categories
                  .filter((p) => !editingCat || p.id !== editingCat.id)
                  .map((p) => ({
                    value: p.id,
                    label: p.name,
                  }))}
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Loại danh mục ({getCategoryTypeLabel(catFormType)}) sẽ tự động thừa hưởng theo nhóm cha.
              </p>
            </div>
          )}

          {/* Color Picker Presets */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-emerald-400" />
              <span>Màu sắc nhận diện</span>
            </label>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCatFormColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    catFormColor === c
                      ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
            <Input
              value={catFormColor}
              onChange={(e) => setCatFormColor(e.target.value)}
              placeholder="VD: #10b981"
            />
          </div>

          {catFormError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 font-medium">
              {catFormError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCatModalOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={
                createCategoryMutation.isPending || updateCategoryMutation.isPending
              }
            >
              {catModalMode === "edit" ? "Lưu Thay Đổi" : "Tạo Danh Mục"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Category Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteCatModalOpen}
        onClose={() => setIsDeleteCatModalOpen(false)}
        title="Xác Nhận Xóa Danh Mục"
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs text-rose-300 space-y-1.5">
            <p className="font-bold flex items-center gap-1.5 text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span>Cảnh báo xóa dữ liệu:</span>
            </p>
            <p>
              Bạn có chắc chắn muốn xóa danh mục{" "}
              <b className="text-rose-100 underline">"{targetDeleteCat?.name}"</b>?
            </p>
            {!targetDeleteCat?.parent_id && (
              <p className="text-[11px] text-rose-400/90">
                ⚠️ Vì đây là Nhóm danh mục Cha (Cấp 1), toàn bộ các Danh mục Con trực thuộc cũng sẽ bị xóa theo (Cascade).
              </p>
            )}
          </div>

          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-xs text-slate-400">
            💡 <b>Bảo đảm an toàn:</b> Toàn bộ các giao dịch cũ thuộc danh mục này sẽ tự động chuyển về trạng thái <i>"Chưa phân loại"</i>, <b>không bị xóa hay ảnh hưởng số dư tài chính</b>.
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteCatModalOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleConfirmDeleteCategory}
              isLoading={deleteCategoryMutation.isPending}
            >
              Xác Nhận Xóa
            </Button>
          </div>
        </div>
      </Modal>

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
