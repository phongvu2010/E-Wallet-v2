import React from "react";
import {
  Banknote,
  Building2,
  CheckCircle2,
  CreditCard,
  PieChart as PieIcon,
  PiggyBank,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useNetWorth } from "../../hooks/useFinanceQueries";
import { formatCurrency } from "../../utils/formatters";
import { Spinner } from "../common/Spinner";

export const NetWorthHeroWidget: React.FC = () => {
  const { data: nw, isLoading } = useNetWorth();

  if (isLoading || !nw) {
    return (
      <div className="h-44 rounded-3xl bg-slate-900/60 border border-slate-800 flex items-center justify-center">
        <Spinner size="md" />
      </div>
    );
  }

  const totalAssets = Number(nw.total_liquid_assets);
  const totalDebt = Number(nw.total_credit_debt);
  const netWorth = Number(nw.net_worth);
  const totalLimit = Number(nw.total_credit_limit);

  // Asset breakdown percentages
  const bankPct = totalAssets > 0 ? (Number(nw.total_bank_assets) / totalAssets) * 100 : 0;
  const cashPct = totalAssets > 0 ? (Number(nw.total_cash_assets) / totalAssets) * 100 : 0;
  const ewalletPct = totalAssets > 0 ? (Number(nw.total_ewallet_assets) / totalAssets) * 100 : 0;
  const savingsPct = totalAssets > 0 ? (Number(nw.total_savings_assets) / totalAssets) * 100 : 0;

  return (
    <div className="relative rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-slate-900 via-slate-900/95 to-emerald-950/40 border border-emerald-500/30 shadow-2xl overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Net Worth Hero */}
        <div className="lg:col-span-6 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Wealth & Net Worth Management</span>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Tổng Giá Trị Tài Sản Ròng (Net Worth)
            </p>
            <div className="flex items-baseline gap-3 mt-1.5">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-emerald-300 tracking-tight">
                {formatCurrency(netWorth)}
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              = Tổng Tài sản có ({formatCurrency(totalAssets)}) − Tổng Nợ thẻ ({formatCurrency(totalDebt)})
            </p>
          </div>

          {/* Asset Allocation Mini Progress Bar */}
          <div className="pt-2">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 font-medium">
              <span>Cơ cấu Tài sản thanh khoản</span>
              <span>{nw.active_asset_accounts_count} tài khoản / ví</span>
            </div>
            <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden flex gap-0.5 p-0.5">
              <div
                style={{ width: `${bankPct}%` }}
                className="bg-sky-500 rounded-full transition-all"
                title={`Ngân hàng: ${bankPct.toFixed(1)}%`}
              />
              <div
                style={{ width: `${cashPct}%` }}
                className="bg-emerald-500 rounded-full transition-all"
                title={`Tiền mặt: ${cashPct.toFixed(1)}%`}
              />
              <div
                style={{ width: `${ewalletPct}%` }}
                className="bg-pink-500 rounded-full transition-all"
                title={`Ví điện tử: ${ewalletPct.toFixed(1)}%`}
              />
              <div
                style={{ width: `${savingsPct}%` }}
                className="bg-purple-500 rounded-full transition-all"
                title={`Tiết kiệm: ${savingsPct.toFixed(1)}%`}
              />
            </div>

            <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 mt-2 font-medium">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-500" />
                Ngân hàng ({formatCurrency(nw.total_bank_assets)})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Tiền mặt ({formatCurrency(nw.total_cash_assets)})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-pink-500" />
                Ví điện tử ({formatCurrency(nw.total_ewallet_assets)})
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Key Metric Blocks */}
        <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card 1: Liquid Assets */}
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60 shadow-lg hover:border-emerald-500/40 transition-colors">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-300">Tổng Tài Sản Có</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-bold text-slate-100 mt-2">
              {formatCurrency(totalAssets)}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium mt-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Khả dụng tức thời</span>
            </div>
          </div>

          {/* Card 2: Credit Card Liabilities */}
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60 shadow-lg hover:border-amber-500/40 transition-colors">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-300">Tổng Dư Nợ Thẻ</span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-bold text-slate-100 mt-2">
              {formatCurrency(totalDebt)}
            </p>
            <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
              <span>Hạn mức còn:</span>
              <span className="font-semibold text-sky-400">
                {formatCurrency(nw.total_available_credit)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
