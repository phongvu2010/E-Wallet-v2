import React from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  DollarSign,
  PiggyBank,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useCashFlow, useDashboardOverview } from "../../hooks/useFinanceQueries";
import { formatCurrency } from "../../utils/formatters";
import { Card } from "../common/Card";
import { Spinner } from "../common/Spinner";

export const CashFlowSavingsWidget: React.FC = () => {
  const { data: cashFlowList = [], isLoading: cfLoading } = useCashFlow(1);
  const { data: overview, isLoading: ovLoading } = useDashboardOverview();

  if ((cfLoading && !overview) || (ovLoading && !overview)) {
    return (
      <Card className="h-44 flex items-center justify-center">
        <Spinner size="md" />
      </Card>
    );
  }

  // Current month cash flow
  const latestCf = cashFlowList.length > 0 ? cashFlowList[0] : null;

  const income = latestCf
    ? Number(latestCf.total_income)
    : overview
    ? Number(overview.monthly_income_current_month || 0)
    : 0;

  const expense = latestCf
    ? Number(latestCf.total_expense)
    : overview
    ? Number(overview.monthly_spending_current_month || 0)
    : 0;

  const netSavings = income - expense;
  const savingsRate = income > 0 ? Math.max(0, (netSavings / income) * 100) : 0;

  // Evaluation tier
  let rateColor = "from-rose-500 to-amber-500";
  let rateBadge = "bg-rose-500/10 text-rose-400 border-rose-500/30";
  let rateStatusText = "Cần kiểm soát chi tiêu";

  if (savingsRate >= 50) {
    rateColor = "from-emerald-400 to-teal-400";
    rateBadge = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    rateStatusText = "Xuất sắc: Tích lũy vượt trội";
  } else if (savingsRate >= 30) {
    rateColor = "from-teal-400 to-sky-400";
    rateBadge = "bg-teal-500/10 text-teal-400 border-teal-500/30";
    rateStatusText = "Tốt: Cơ cấu lành mạnh";
  } else if (savingsRate >= 10) {
    rateColor = "from-amber-400 to-yellow-400";
    rateBadge = "bg-amber-500/10 text-amber-400 border-amber-500/30";
    rateStatusText = "Trung bình: Cần tiết kiệm thêm";
  }

  const currentMonthLabel = new Date().toLocaleDateString("vi-VN", {
    month: "long",
    year: "numeric",
  });

  return (
    <Card className="p-6 bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3.5 mb-5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <PiggyBank className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>Dòng Tiền & Tỷ Lệ Tiết Kiệm</span>
              <span className="text-[11px] font-medium text-slate-400 capitalize">
                ({currentMonthLabel})
              </span>
            </h3>
          </div>
        </div>

        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${rateBadge}`}>
          {rateStatusText}
        </span>
      </div>

      {/* 3 Metric Blocks Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        {/* Income Block */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1 font-medium">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>Thu Nhập Tháng</span>
            </span>
          </div>
          <p className="text-lg sm:text-xl font-bold font-mono text-emerald-400">
            {formatCurrency(income)}
          </p>
        </div>

        {/* Expense Block */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1 font-medium">
            <span className="flex items-center gap-1.5 text-rose-400">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Chi Tiêu Tháng</span>
            </span>
          </div>
          <p className="text-lg sm:text-xl font-bold font-mono text-slate-100">
            {formatCurrency(expense)}
          </p>
        </div>

        {/* Net Savings Block */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1 font-medium">
            <span className="flex items-center gap-1.5 text-sky-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Thặng Dư Tích Lũy</span>
            </span>
          </div>
          <p
            className={`text-lg sm:text-xl font-bold font-mono ${
              netSavings >= 0 ? "text-sky-400" : "text-rose-400"
            }`}
          >
            {netSavings >= 0 ? "+" : ""}
            {formatCurrency(netSavings)}
          </p>
        </div>
      </div>

      {/* Savings Rate Progress Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">
            Tỷ Lệ Tiết Kiệm (Savings Rate = Thặng dư / Thu nhập):
          </span>
          <span className="font-bold text-slate-200 font-mono text-sm">
            {savingsRate.toFixed(1)}%
          </span>
        </div>

        <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden p-0.5">
          <div
            style={{ width: `${Math.min(100, Math.max(0, savingsRate))}%` }}
            className={`h-full rounded-full bg-gradient-to-r ${rateColor} transition-all duration-500`}
          />
        </div>

        <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>
            {netSavings >= 0
              ? `Bạn đã giữ lại được ${savingsRate.toFixed(1)}% thu nhập tháng này vào tài sản thanh khoản.`
              : "Chi tiêu trong tháng hiện đang vượt quá tổng thu nhập ghi nhận."}
          </span>
        </p>
      </div>
    </Card>
  );
};
