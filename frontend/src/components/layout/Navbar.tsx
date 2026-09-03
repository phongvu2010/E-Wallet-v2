import React from "react";
import { Menu, RefreshCw } from "lucide-react";
import { Button } from "../common/Button";
import { NotificationBell } from "../common/NotificationBell";

interface NavbarProps {
  onMenuClick: () => void;
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onMenuClick,
  title,
  subtitle,
  onRefresh,
  isRefreshing = false,
}) => {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 sm:h-20 px-4 sm:px-8 bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <button
          onClick={onMenuClick}
          aria-label="Open Menu"
          className="p-2 -ml-1 text-slate-400 rounded-xl hover:text-white hover:bg-slate-800 lg:hidden focus:outline-none"
        >
          <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
        <div className="min-w-0">
          <h2 className="text-base sm:text-xl font-bold text-slate-100 tracking-tight truncate">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate hidden xs:block">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            isLoading={isRefreshing}
            leftIcon={<RefreshCw className="w-4 h-4" />}
            className="hidden md:inline-flex"
          >
            Làm mới
          </Button>
        )}

        <NotificationBell />

        <div className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-slate-800">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center font-bold text-xs text-white shadow-md shadow-emerald-950/50">
            HV
          </div>
          <div className="hidden md:block text-left">
            <div className="text-sm font-semibold text-slate-200">Hoàng Vũ</div>
            <div className="text-[11px] text-emerald-400 font-mono">Personal Ledger</div>
          </div>
        </div>
      </div>
    </header>
  );
};
