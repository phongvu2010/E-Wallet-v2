import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  ExternalLink,
  Info,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useScanAlerts,
} from "../../hooks/useFinanceMutations";
import { useNotificationSummary } from "../../hooks/useFinanceQueries";
import { NotificationItem, NotificationSeverity } from "../../types/notification";
import { formatDate } from "../../utils/formatters";

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: summary, isLoading } = useNotificationSummary();
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();
  const scanMutation = useScanAlerts();

  const unreadCount = summary?.unread_count || 0;
  const items = summary?.items || [];

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await markReadMutation.mutateAsync(id);
  };

  const handleMarkAllRead = async () => {
    await markAllReadMutation.mutateAsync();
  };

  const handleScanNow = async () => {
    await scanMutation.mutateAsync();
  };

  const getSeverityIcon = (sev: NotificationSeverity) => {
    switch (sev) {
      case "DANGER":
        return <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />;
      case "WARNING":
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />;
      case "SUCCESS":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />;
      case "INFO":
      default:
        return <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors focus:outline-none"
        title="Thông báo thông minh"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-lg shadow-rose-950">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl shadow-slate-950 z-50 overflow-hidden flex flex-col max-h-[32rem]">
          {/* Header */}
          <div className="p-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-sm text-slate-100">Thông Báo Thông Minh</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-bold border border-rose-500/30">
                  {unreadCount} mới
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleScanNow}
                disabled={scanMutation.isPending}
                className="p-1 text-slate-400 hover:text-emerald-400 rounded-lg hover:bg-slate-800 transition-colors"
                title="Quét lại các cảnh báo ngay bây giờ"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${scanMutation.isPending ? "animate-spin text-emerald-400" : ""}`} />
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={markAllReadMutation.isPending}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold px-2 py-1 rounded-lg hover:bg-emerald-500/10 transition-colors"
                >
                  Đọc tất cả
                </button>
              )}
            </div>
          </div>

          {/* List Items */}
          <div className="divide-y divide-slate-800/60 overflow-y-auto flex-1">
            {isLoading && items.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">Đang tải thông báo...</div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500/40" />
                <span>Không có thông báo nào. Mọi nghĩa vụ tài chính đều an toàn!</span>
              </div>
            ) : (
              items.map((notif: NotificationItem) => (
                <div
                  key={notif.id}
                  className={`p-3.5 transition-colors flex items-start gap-3 relative group ${
                    notif.is_read ? "bg-transparent opacity-75 hover:bg-slate-800/20" : "bg-emerald-950/15 hover:bg-emerald-950/25"
                  }`}
                >
                  {getSeverityIcon(notif.severity)}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className={`text-xs font-bold truncate ${notif.is_read ? "text-slate-300" : "text-slate-100"}`}>
                        {notif.title}
                      </h4>
                      {!notif.is_read && (
                        <button
                          onClick={(e) => handleMarkAsRead(notif.id, e)}
                          className="text-[10px] text-slate-400 hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                          title="Đánh dấu đã đọc"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-300 mt-1 leading-relaxed line-clamp-2">
                      {notif.message}
                    </p>
                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-800/40">
                      <span className="text-[10px] text-slate-400 font-mono">
                        {formatDate(notif.created_at)}
                      </span>
                      {notif.action_url && (
                        <Link
                          to={notif.action_url}
                          onClick={() => setIsOpen(false)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300"
                        >
                          <span>Xem chi tiết</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-950 border-t border-slate-800 text-center">
            <Link
              to="/settings"
              onClick={() => setIsOpen(false)}
              className="text-xs font-medium text-slate-400 hover:text-emerald-400 transition-colors"
            >
              Cấu hình thông báo Telegram Bot →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
