import React from "react";
import { formatCurrency, getBankGradient } from "../../utils/formatters";
import { AccountLiveBalance } from "../../types/account";
import { Wifi, Sparkles, Lock } from "lucide-react";
import { clsx } from "clsx";

interface CreditCardVisualProps {
  account: AccountLiveBalance;
  onClick?: () => void;
  isSelected?: boolean;
}

export const CreditCardVisual: React.FC<CreditCardVisualProps> = ({
  account,
  onClick,
  isSelected = false,
}) => {
  const isLocked = account.status === "LOCKED";
  const bankGradient = getBankGradient(account.bank_name || account.account_name);
  const utilization = Math.min(100, Math.max(0, Number(account.live_utilization_percentage) || 0));

  return (
    <div
      onClick={onClick}
      className={clsx(
        "relative w-full rounded-2xl p-6 bg-gradient-to-br border shadow-xl transition-all duration-300 overflow-hidden cursor-pointer select-none",
        bankGradient,
        isLocked && "grayscale-[0.45] opacity-85 border-rose-500/40",
        isSelected
          ? "ring-2 ring-emerald-500 scale-[1.02] shadow-glow"
          : "hover:scale-[1.01] hover:shadow-2xl"
      )}
    >
      {/* Decorative background glass circle */}
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/5 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-white/5 rounded-full blur-2xl pointer-events-none" />

      {/* Card Header: Bank & Contactless */}
      <div className="flex items-center justify-between relative z-10">
        <div>
          <span className="text-xs uppercase tracking-wider font-semibold text-white/70">
            {account.bank_name || "Ngân hàng"}
          </span>
          <h4 className="text-base font-bold text-white tracking-wide">
            {account.account_name}
          </h4>
        </div>
        <div className="flex items-center gap-2 text-white/60">
          <Wifi className="w-5 h-5 rotate-90" />
          {isLocked ? (
            <span className="flex items-center gap-1 bg-rose-500/25 border border-rose-400/40 text-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
              <Lock className="w-3 h-3" />
              ĐÃ KHÓA
            </span>
          ) : (
            <Sparkles className="w-4 h-4 text-amber-400" />
          )}
        </div>
      </div>

      {/* Chip and Masked Card Number */}
      <div className="my-6 flex items-center justify-between relative z-10">
        {/* Realistic EMV Chip */}
        <div className="w-11 h-8 rounded-md bg-gradient-to-tr from-amber-300 via-amber-400 to-yellow-500 p-1 flex flex-col justify-between shadow-md border border-amber-500/40">
          <div className="w-full h-0.5 bg-amber-700/40" />
          <div className="w-full h-0.5 bg-amber-700/40" />
        </div>

        <div className="font-mono text-lg tracking-widest text-white/90 font-semibold drop-shadow">
          {account.card_number_masked}
        </div>
      </div>

      {/* Balances Section */}
      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/10 relative z-10 text-xs">
        <div>
          <p className="text-white/60 text-[11px] mb-0.5">Dư nợ thực tế (Live)</p>
          <p className="font-bold text-sm text-white font-mono">
            {formatCurrency(account.live_current_balance)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-white/60 text-[11px] mb-0.5">Hạn mức khả dụng</p>
          <p className="font-bold text-sm text-emerald-300 font-mono">
            {formatCurrency(account.live_available_limit)}
          </p>
        </div>
      </div>

      {/* Utilization Progress Bar */}
      <div className="mt-3 relative z-10">
        <div className="flex items-center justify-between text-[10px] text-white/60 mb-1">
          <span>Hạn mức: {formatCurrency(account.credit_limit)}</span>
          <span className="font-mono">{utilization.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-black/30 h-1.5 rounded-full overflow-hidden">
          <div
            className={clsx(
              "h-full rounded-full transition-all duration-500",
              utilization > 70
                ? "bg-rose-400"
                : utilization > 50
                ? "bg-amber-400"
                : utilization > 30
                ? "bg-sky-400"
                : "bg-emerald-400"
            )}
            style={{ width: `${utilization}%` }}
          />
        </div>
      </div>
    </div>
  );
};
