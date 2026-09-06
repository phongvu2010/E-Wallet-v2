import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  CreditCard,
  Receipt,
  FileSpreadsheet,
  Clock,
  BarChart3,
  Gift,
  Settings,
  Wallet,
} from "lucide-react";
import { clsx } from "clsx";

interface NavItem {
  name: string;
  path: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { name: "Tổng quan", path: "/", icon: <LayoutDashboard className="w-5 h-5 shrink-0" /> },
  { name: "Thẻ & Hạn mức", path: "/accounts", icon: <CreditCard className="w-5 h-5 shrink-0" /> },
  { name: "Sổ cái Giao dịch", path: "/transactions", icon: <Receipt className="w-5 h-5 shrink-0" /> },
  { name: "Sao kê & Đối soát", path: "/statements", icon: <FileSpreadsheet className="w-5 h-5 shrink-0" /> },
  { name: "Trả góp & Khoản vay", path: "/installments", icon: <Clock className="w-5 h-5 shrink-0" /> },
  { name: "Báo cáo Phân tích", path: "/analytics", icon: <BarChart3 className="w-5 h-5 shrink-0" /> },
  { name: "Điểm thưởng & Hoàn tiền", path: "/rewards", icon: <Gift className="w-5 h-5 shrink-0" /> },
  { name: "Cài đặt & Đồng bộ", path: "/settings", icon: <Settings className="w-5 h-5 shrink-0" /> },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  isCollapsed = true,
  onToggleCollapse,
}) => {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={clsx(
          "fixed top-0 left-0 z-50 h-screen bg-slate-900/95 border-r border-slate-800/80 backdrop-blur-xl flex flex-col transition-all duration-300 ease-in-out lg:translate-x-0",
          isOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0",
          isCollapsed ? "lg:w-20" : "lg:w-64"
        )}
      >
        {/* Logo / Header */}
        <div
          className={clsx(
            "flex items-center h-20 border-b border-slate-800/80 transition-all duration-300",
            isCollapsed ? "lg:justify-center lg:px-2 px-5" : "px-5"
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onToggleCollapse}
              title={isCollapsed ? "Mở rộng thanh điều hướng" : "Credit Wallet 2.0"}
              className="p-2.5 bg-gradient-to-tr from-emerald-500 to-emerald-400 rounded-xl shadow-lg shadow-emerald-950/50 text-slate-950 shrink-0 hover:scale-105 transition-transform focus:outline-none"
            >
              <Wallet className="w-6 h-6 stroke-[2.5]" />
            </button>
            <div
              className={clsx(
                "transition-opacity duration-200 overflow-hidden",
                isCollapsed ? "lg:hidden block" : "block"
              )}
            >
              <h1 className="font-bold text-base text-slate-100 tracking-tight flex items-center gap-1.5 whitespace-nowrap">
                Credit Wallet <span className="text-xs px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-mono font-semibold">2.0</span>
              </h1>
              <p className="text-[11px] text-slate-400 font-medium whitespace-nowrap">Sổ cái thẻ tín dụng</p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              title={isCollapsed ? item.name : undefined}
              className={({ isActive }: { isActive: boolean }) =>
                clsx(
                  "group relative flex items-center rounded-xl text-sm font-medium transition-all duration-200",
                  isCollapsed
                    ? "lg:justify-center lg:px-2.5 lg:py-3 px-3.5 py-2.5 gap-3.5"
                    : "gap-3.5 px-3.5 py-2.5",
                  isActive
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm font-semibold"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                )
              }
            >
              <div className="shrink-0">{item.icon}</div>
              <span
                className={clsx(
                  "whitespace-nowrap transition-opacity duration-200",
                  isCollapsed ? "lg:hidden block" : "block"
                )}
              >
                {item.name}
              </span>

              {/* Floating Tooltip on Desktop when Collapsed */}
              {isCollapsed && (
                <div className="hidden lg:group-hover:flex absolute left-full ml-3 px-3 py-1.5 rounded-xl bg-slate-900 text-slate-100 text-xs font-semibold whitespace-nowrap shadow-2xl border border-slate-700/80 pointer-events-none z-50 animate-in fade-in zoom-in-95 duration-150">
                  {item.name}
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer info */}
        <div className={clsx("border-t border-slate-800/80 transition-all duration-300", isCollapsed ? "lg:p-2 p-4" : "p-4")}>
          {isCollapsed ? (
            <div className="hidden lg:flex justify-center p-2">
              <div
                title="PostgreSQL 16 Online (Docker & FastAPI v2.0)"
                className="w-9 h-9 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-center cursor-help group relative"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <div className="hidden group-hover:flex absolute left-full ml-3 px-3 py-1.5 rounded-xl bg-slate-900 text-slate-100 text-xs font-medium whitespace-nowrap shadow-2xl border border-slate-700/80 pointer-events-none z-50 animate-in fade-in zoom-in-95 duration-150">
                  PostgreSQL 16 Online
                </div>
              </div>
            </div>
          ) : null}

          <div
            className={clsx(
              "p-3 bg-slate-950/60 rounded-xl border border-slate-800/60 text-xs text-slate-400",
              isCollapsed ? "lg:hidden block" : "block"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-medium text-slate-300">PostgreSQL 16 Online</span>
            </div>
            <p className="text-[11px] text-slate-400">Docker & FastAPI v2.0</p>
          </div>
        </div>
      </aside>
    </>
  );
};
