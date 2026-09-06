import React from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Gauge,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useCashFlow, useDashboardOverview } from "../../hooks/useFinanceQueries";
import { formatCurrency } from "../../utils/formatters";
import { Card } from "../common/Card";
import { Spinner } from "../common/Spinner";

export const BudgetPaceWidget: React.FC = () => {
  const { data: cashFlowList = [], isLoading: cfLoading } = useCashFlow(1);
  const { data: overview, isLoading: ovLoading } = useDashboardOverview();

  if ((cfLoading && !overview) || (ovLoading && !overview)) {
    return (
      <Card className="h-44 flex items-center justify-center">
        <Spinner size="md" />
      </Card>
    );
  }

  const today = new Date();
  const currentDay = today.getDate();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const totalDaysInMonth = new Date(year, month, 0).getDate();

  // Progress of time in current month
  const timeElapsedPct = (currentDay / totalDaysInMonth) * 100;

  // Monthly numbers
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

  // Spending ratio vs income (or baseline if income is 0)
  const spendingRatio = income > 0 ? (expense / income) * 100 : 0;
  const paceDiff = spendingRatio - timeElapsedPct;

  let paceStatus: "SAFE" | "NORMAL" | "FAST" = "NORMAL";
  let paceBadge = "bg-sky-500/10 text-sky-400 border-sky-500/30";
  let paceTitle = "Chi tiêu đúng tiến độ";
  let paceDesc = `Đã qua ${currentDay}/${totalDaysInMonth} ngày (${timeElapsedPct.toFixed(0)}% chu kỳ tháng). Tốc độ chi tiêu đang tương xứng với tiến độ thời gian.`;

  if (income > 0) {
    if (paceDiff <= -10) {
      paceStatus = "SAFE";
      paceBadge = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      paceTitle = "Tốc độ chi tiêu rất an toàn";
      paceDesc = `Đã qua ${currentDay}/${totalDaysInMonth} ngày (${timeElapsedPct.toFixed(0)}% tháng), bạn mới dùng ${spendingRatio.toFixed(0)}% thu nhập.`;
    } else if (paceDiff > 10) {
      paceStatus = "FAST";
      paceBadge = "bg-amber-500/10 text-amber-400 border-amber-500/30";
      paceTitle = "Tốc độ chi tiêu hơi nhanh";
      paceDesc = `Đã qua ${currentDay}/${totalDaysInMonth} ngày (${timeElapsedPct.toFixed(0)}% tháng) nhưng chi tiêu đã chạm ${spendingRatio.toFixed(0)}% thu nhập.`;
    }
  } else {
    paceTitle = `Ngày ${currentDay}/${totalDaysInMonth} của tháng`;
    paceDesc = `Đã qua ${timeElapsedPct.toFixed(0)}% chu kỳ tháng. Tổng chi tiêu hiện tại: ${formatCurrency(expense)}.`;
  }

  return (
    <Card className="p-5 bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border-slate-800 flex flex-col justify-between">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Gauge className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>Đo Lường Tốc Độ Chi Tiêu</span>
            </h3>
          </div>
        </div>

        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${paceBadge}`}>
          {paceTitle}
        </span>
      </div>

      <div className="space-y-3.5">
        {/* Progress 1: Month Timeline Elapsed */}
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1 font-medium">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-sky-400" />
              <span>Tiến độ ngày trong tháng</span>
            </span>
            <span className="font-mono text-slate-300">
              Ngày {currentDay}/{totalDaysInMonth} ({timeElapsedPct.toFixed(0)}%)
            </span>
          </div>
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
            <div
              style={{ width: `${Math.min(100, timeElapsedPct)}%` }}
              className="h-full bg-sky-500 rounded-full transition-all"
            />
          </div>
        </div>

        {/* Progress 2: Spending vs Income */}
        {income > 0 && (
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1 font-medium">
              <span className="flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                <span>Chi tiêu / Thu nhập tháng</span>
              </span>
              <span className="font-mono text-slate-300">
                {formatCurrency(expense)} / {formatCurrency(income)} ({spendingRatio.toFixed(0)}%)
              </span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                style={{ width: `${Math.min(100, spendingRatio)}%` }}
                className={`h-full rounded-full transition-all ${
                  paceStatus === "SAFE"
                    ? "bg-emerald-500"
                    : paceStatus === "FAST"
                    ? "bg-amber-500"
                    : "bg-sky-500"
                }`}
              />
            </div>
          </div>
        )}

        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 flex items-start gap-2">
          {paceStatus === "SAFE" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : paceStatus === "FAST" ? (
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          ) : (
            <Sparkles className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          )}
          <p className="leading-relaxed text-[11px] text-slate-300">{paceDesc}</p>
        </div>
      </div>
    </Card>
  );
};
