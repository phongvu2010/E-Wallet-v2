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
  { name: "Tổng quan", path: "/", icon: <LayoutDashboard className="w-5 h-5" /> },
  { name: "Thẻ & Hạn mức", path: "/accounts", icon: <CreditCard className="w-5 h-5" /> },
  { name: "Sổ cái Giao dịch", path: "/transactions", icon: <Receipt className="w-5 h-5" /> },
  { name: "Sao kê & Đối soát", path: "/statements", icon: <FileSpreadsheet className="w-5 h-5" /> },
  { name: "Trả góp & Dự phóng", path: "/installments", icon: <Clock className="w-5 h-5" /> },
  { name: "Báo cáo Phân tích", path: "/analytics", icon: <BarChart3 className="w-5 h-5" /> },
  { name: "Điểm thưởng & Hoàn tiền", path: "/rewards", icon: <Gift className="w-5 h-5" /> },
  { name: "Cài đặt & Đồng bộ", path: "/settings", icon: <Settings className="w-5 h-5" /> },
];

export const Sidebar: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
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
          "fixed top-0 left-0 z-50 h-screen w-64 bg-slate-900/90 border-r border-slate-800/80 backdrop-blur-xl flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo / Header */}
        <div className="flex items-center gap-3 px-6 h-20 border-b border-slate-800/80">
          <div className="p-2.5 bg-gradient-to-tr from-emerald-500 to-emerald-400 rounded-xl shadow-lg shadow-emerald-950/50 text-slate-950">
            <Wallet className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="font-bold text-base text-slate-100 tracking-tight flex items-center gap-1.5">
              Credit Wallet <span className="text-xs px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-mono font-semibold">2.0</span>
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">Sổ cái thẻ tín dụng</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm font-semibold"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                )
              }
            >
              {item.icon}
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-800/80">
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/60 text-xs text-slate-400">
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
