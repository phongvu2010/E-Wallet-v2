import React from "react";
import { Menu, Bell, RefreshCw } from "lucide-react";
import { Button } from "../common/Button";

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
    <header className="sticky top-0 z-30 flex items-center justify-between h-20 px-6 sm:px-8 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="p-2 -ml-2 text-slate-400 rounded-xl hover:text-white hover:bg-slate-800 lg:hidden"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            isLoading={isRefreshing}
            leftIcon={<RefreshCw className="w-4 h-4" />}
            className="hidden sm:inline-flex"
          >
            Làm mới
          </Button>
        )}

        <div className="relative">
          <button className="p-2 text-slate-400 rounded-xl hover:text-white hover:bg-slate-800/60 transition-colors border border-slate-800">
            <Bell className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center font-bold text-xs text-white shadow-md shadow-emerald-950/50">
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
