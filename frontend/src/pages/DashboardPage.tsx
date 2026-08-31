import React, { useEffect, useState } from "react";
import { analyticsService } from "../services/analyticsService";
import { accountService } from "../services/accountService";
import { DashboardOverview, UpcomingObligation, MonthlyCategorySpending } from "../types/analytics";
import { AccountLiveBalance } from "../types/account";
import { MetricCard } from "../components/cards/MetricCard";
import { CreditCardVisual } from "../components/cards/CreditCardVisual";
import { ObligationCard } from "../components/cards/ObligationCard";
import { SpendingDonutChart } from "../components/charts/SpendingDonutChart";
import { MonthlySpendingBarChart } from "../components/charts/MonthlySpendingBarChart";
import { Card } from "../components/common/Card";
import { Spinner } from "../components/common/Spinner";
import { formatCurrency, getRiskLevelColor } from "../utils/formatters";
import {
  CreditCard,
  Wallet,
  TrendingDown,
  AlertTriangle,
  Calendar,
  PieChart as PieIcon,
  BarChart3,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  useDashboardOverview,
  useAccountLiveBalances,
  useMonthlySpending,
  useUpcomingObligations,
} from "../hooks/useFinanceQueries";

export const DashboardPage: React.FC = () => {
  const { data: overview, isLoading: overviewLoading } = useDashboardOverview();
  const { data: accounts = [], isLoading: accountsLoading } = useAccountLiveBalances();
  const { data: obligations = [] } = useUpcomingObligations(30);
  const { data: monthlySpending = [] } = useMonthlySpending(20);

  if ((overviewLoading && !overview) || !overview) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-slate-400 font-medium">Đang tải dữ liệu tài chính...</p>
      </div>
    );
  }

  const riskColor = getRiskLevelColor(overview.overall_risk_level);

  // Group latest month category spending for donut chart
  const currentMonthCategories = monthlySpending
    .slice(0, 7)
    .map((item) => ({
      name: item.category_name,
      value: Number(item.total_spending),
      color: "",
    }));

  const currentMonthTotal = currentMonthCategories.reduce(
    (acc, curr) => acc + curr.value,
    0
  );

  return (
    <div className="space-y-8">
      {/* 1. Header Hero Banner */}
      <div className="relative rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-500/20 shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Real-time Financial Ledger</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Sổ cái Quản lý Dư nợ Thẻ Tín Dụng
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-xl">
              Hệ thống tự động cập nhật số dư thực tế tức thời (Live Balance) và hạn mức khả dụng từ các giao dịch sau ngày chốt sao kê.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/transactions"
              className="px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-semibold text-sm hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-950/40 inline-flex items-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              <span>Quản lý Giao dịch</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard
          title="Tổng Hạn Mức Tín Dụng"
          value={formatCurrency(overview.total_credit_limit)}
          subtitle={`${overview.active_cards_count} thẻ đang hoạt động`}
          icon={<CreditCard className="w-6 h-6 text-sky-400" />}
        />

        <MetricCard
          title="Dư Nợ Thực Tế Tức Thời"
          value={formatCurrency(overview.total_live_balance)}
          subtitle="Bao gồm chi tiêu chưa lên sao kê"
          icon={<TrendingDown className="w-6 h-6 text-rose-400" />}
          progress={Number(overview.overall_utilization_percentage)}
          progressColor={riskColor.bg}
        />

        <MetricCard
          title="Hạn Mức Khả Dụng Còn Lại"
          value={formatCurrency(overview.total_available_limit)}
          subtitle="Có thể sử dụng quẹt thẻ ngay"
          icon={<Wallet className="w-6 h-6 text-emerald-400" />}
        />

        <MetricCard
          title="Tỷ Lệ Sử Dụng Hạn Mức"
          value={`${Number(overview.overall_utilization_percentage).toFixed(1)}%`}
          badgeText={overview.overall_risk_level}
          badgeVariant={
            overview.overall_risk_level.includes("CRITICAL")
              ? "danger"
              : overview.overall_risk_level.includes("HIGH")
              ? "warning"
              : "success"
          }
          icon={<AlertTriangle className="w-6 h-6 text-amber-400" />}
        />
      </div>

      {/* 3. Credit Cards Visual Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-400" />
              <span>Danh Sách Thẻ Tín Dụng ({accounts.filter((acc) => acc.status !== "CLOSED" && acc.status !== "REPLACED").length})</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Nhấn vào từng thẻ để xem chi tiết hạn mức và giao dịch
            </p>
          </div>
          <Link
            to="/accounts"
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Xem tất cả thẻ →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts
            .filter((acc) => acc.status !== "CLOSED" && acc.status !== "REPLACED")
            .map((acc) => (
              <CreditCardVisual key={acc.account_id} account={acc} />
            ))}
        </div>
      </div>

      {/* 4. Charts & Upcoming Obligations Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Spending Donut Chart */}
        <Card className="lg:col-span-1 flex flex-col h-full">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-2">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-emerald-400" />
              <span>Cơ Cấu Chi Tiêu Tháng Này</span>
            </h3>
            <Link
              to="/analytics"
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Chi tiết
            </Link>
          </div>

          <SpendingDonutChart
            data={currentMonthCategories}
            totalAmount={currentMonthTotal}
          />
        </Card>

        {/* Upcoming Payment Obligations */}
        <Card className="lg:col-span-2 flex flex-col h-full">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sky-400" />
                <span>Nghĩa Vụ Thanh Toán Sắp Tới (30 ngày)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Tổng số tiền cần chuẩn bị:{" "}
                <span className="text-slate-200 font-bold font-mono">
                  {formatCurrency(overview.total_upcoming_due_30d)}
                </span>
              </p>
            </div>
            <Link
              to="/statements"
              className="text-xs font-semibold text-sky-400 hover:text-sky-300"
            >
              Lịch sao kê →
            </Link>
          </div>

          {obligations.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-500 text-sm">
              Không có khoản nợ sao kê hoặc trả góp nào đến hạn trong 30 ngày tới
            </div>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1 flex-1">
              {obligations.slice(0, 4).map((ob, idx) => (
                <ObligationCard key={idx} obligation={ob} />
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* 5. Historical Spending Trend */}
      <Card>
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-400" />
              <span>Xu Hướng Chi Tiêu Hàng Tháng</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Đã tự động bù trừ các khoản hoàn tiền, giảm phí và hủy giao dịch
            </p>
          </div>
          <Link
            to="/analytics"
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300"
          >
            Báo cáo chi tiết →
          </Link>
        </div>

        <MonthlySpendingBarChart
          data={monthlySpending.reduce((acc: any[], curr) => {
            const existing = acc.find((a) => a.month === curr.month);
            if (existing) {
              existing.total_spending += Number(curr.total_spending);
            } else {
              acc.push({
                month: curr.month,
                total_spending: Number(curr.total_spending),
              });
            }
            return acc;
          }, [])}
        />
      </Card>
    </div>
  );
};
