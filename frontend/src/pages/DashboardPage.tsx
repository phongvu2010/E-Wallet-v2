import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  Building2,
  Calendar,
  CreditCard,
  PieChart as PieIcon,
  PiggyBank,
  Plus,
  Smartphone,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { CreditCardVisual } from "../components/cards/CreditCardVisual";
import { MetricCard } from "../components/cards/MetricCard";
import { ObligationCard } from "../components/cards/ObligationCard";
import { CardRecommendationWidget } from "../components/cards/CardRecommendationWidget";
import { NetWorthHeroWidget } from "../components/cards/NetWorthHeroWidget";
import { MonthlySpendingBarChart } from "../components/charts/MonthlySpendingBarChart";
import { SpendingDonutChart } from "../components/charts/SpendingDonutChart";
import { CreateAccountModal } from "../components/accounts/CreateAccountModal";
import { SmartCreateTransactionModal } from "../components/transactions/SmartCreateTransactionModal";

import { Card } from "../components/common/Card";
import { Spinner } from "../components/common/Spinner";
import {
  useAccountLiveBalances,
  useDashboardOverview,
  useMonthlySpending,
  useUpcomingObligations,
} from "../hooks/useFinanceQueries";
import { AccountLiveBalance } from "../types/account";
import { MonthlyCategorySpending, UpcomingObligation } from "../types/analytics";
import { formatCurrency, getRiskLevelColor } from "../utils/formatters";

export const DashboardPage: React.FC = () => {
  const { data: overview, isLoading: overviewLoading } = useDashboardOverview();
  const { data: accounts = [] } = useAccountLiveBalances();
  const { data: obligations = [] } = useUpcomingObligations(30);
  const { data: monthlySpending = [] } = useMonthlySpending(20);

  const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);
  const [isCreateTxOpen, setIsCreateTxOpen] = useState(false);

  if ((overviewLoading && !overview) || !overview) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-slate-400 font-medium">Đang tải dữ liệu tài chính...</p>
      </div>
    );
  }

  const riskColor = getRiskLevelColor(overview.overall_risk_level);

  // Group asset accounts (bank, cash, e-wallet, savings) vs credit cards
  const assetAccounts = accounts.filter(
    (acc: AccountLiveBalance) =>
      acc.is_asset || acc.account_type !== "CREDIT_CARD"
  );
  const creditCards = accounts.filter(
    (acc: AccountLiveBalance) =>
      !acc.is_asset && (acc.account_type === "CREDIT_CARD" || !acc.account_type)
  );

  // Group latest month category spending for donut chart
  const currentMonthCategories = monthlySpending
    .slice(0, 7)
    .map((item: MonthlyCategorySpending) => ({
      name: item.category_name,
      value: Number(item.total_spending),
      color: "",
    }));

  const currentMonthTotal = currentMonthCategories.reduce(
    (acc: number, curr: { value: number }) => acc + curr.value,
    0
  );

  return (
    <div className="space-y-8">
      {/* 1. Net Worth Hero Banner */}
      <NetWorthHeroWidget />

      {/* Quick Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-semibold text-slate-200">
            Trung tâm Quản lý Tài chính Toàn diện (Ngân hàng, Tiền mặt & Thẻ tín dụng)
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsCreateAccountOpen(true)}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors border border-slate-700 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 text-sky-400" />
            <span>Thêm Tài Khoản / Ví</span>
          </button>
          <button
            type="button"
            onClick={() => setIsCreateTxOpen(true)}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold transition-colors shadow-lg shadow-emerald-950/40 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Giao Dịch Mới</span>
          </button>
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard
          title="Tổng Tài Sản Có (Liquid Assets)"
          value={formatCurrency(overview.total_liquid_assets)}
          subtitle={`${overview.active_asset_accounts_count} tài khoản / ví`}
          icon={<Wallet className="w-6 h-6 text-emerald-400" />}
        />

        <MetricCard
          title="Dư Nợ Thẻ Thực Tế Tức Thời"
          value={formatCurrency(overview.total_live_balance)}
          subtitle="Bao gồm chi tiêu chưa lên sao kê"
          icon={<TrendingDown className="w-6 h-6 text-rose-400" />}
          progress={Number(overview.overall_utilization_percentage)}
          progressColor={riskColor.bg}
        />

        <MetricCard
          title="Hạn Mức Khả Dụng Thẻ"
          value={formatCurrency(overview.total_available_limit)}
          subtitle={`Trên tổng hạn mức ${formatCurrency(overview.total_credit_limit)}`}
          icon={<CreditCard className="w-6 h-6 text-sky-400" />}
        />

        <MetricCard
          title="Tỷ Lệ Dư Nợ / Hạn Mức"
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

      {/* 3. Liquid Asset Accounts (Banks, Cash, E-Wallets) */}
      {assetAccounts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-sky-400" />
              <span>Tài Khoản Thanh Toán & Ví Tiền ({assetAccounts.length})</span>
            </h3>
            <Link
              to="/accounts"
              className="text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors"
            >
              Quản lý tài khoản →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {assetAccounts.map((acc: AccountLiveBalance) => (
              <div
                key={acc.account_id}
                className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-sky-500/50 transition-all shadow-lg flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: acc.color_hex || "#0284c7" }}
                    >
                      {acc.account_type === "CASH" ? (
                        <Banknote className="w-5 h-5" />
                      ) : acc.account_type === "E_WALLET" ? (
                        <Smartphone className="w-5 h-5" />
                      ) : acc.account_type === "SAVINGS" ? (
                        <PiggyBank className="w-5 h-5" />
                      ) : (
                        <Building2 className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-100">{acc.account_name}</h4>
                      <p className="text-xs text-slate-400">{acc.bank_name || acc.card_number_masked}</p>
                    </div>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium border border-slate-700">
                    {acc.account_type === "CASH"
                      ? "Tiền mặt"
                      : acc.account_type === "E_WALLET"
                      ? "Ví điện tử"
                      : acc.account_type === "SAVINGS"
                      ? "Tiết kiệm"
                      : "Ngân hàng"}
                  </span>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-baseline justify-between">
                  <span className="text-xs text-slate-400">Số dư hiện tại</span>
                  <span className="text-lg font-bold text-emerald-400 font-mono">
                    {formatCurrency(acc.live_current_balance)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Credit Cards Visual Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-400" />
              <span>Danh Sách Thẻ Tín Dụng ({creditCards.filter((acc: AccountLiveBalance) => acc.status !== "CLOSED" && acc.status !== "REPLACED").length})</span>
            </h3>
          </div>
          <Link
            to="/accounts"
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Xem tất cả thẻ →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {creditCards
            .filter((acc: AccountLiveBalance) => acc.status !== "CLOSED" && acc.status !== "REPLACED")
            .map((acc: AccountLiveBalance) => (
              <CreditCardVisual key={acc.account_id} account={acc} />
            ))}
        </div>
      </div>

      {/* 4. Smart Card Recommendation Engine Widget */}
      <CardRecommendationWidget />

      {/* 5. Charts & Upcoming Obligations Row */}
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
              {obligations.slice(0, 4).map((ob: UpcomingObligation, idx: number) => (
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
          data={monthlySpending.reduce((acc: any[], curr: MonthlyCategorySpending) => {
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

      {/* Modals */}
      <CreateAccountModal
        isOpen={isCreateAccountOpen}
        onClose={() => setIsCreateAccountOpen(false)}
      />

      <SmartCreateTransactionModal
        isOpen={isCreateTxOpen}
        onClose={() => setIsCreateTxOpen(false)}
      />
    </div>
  );
};
