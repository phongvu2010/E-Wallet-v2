import React, { useEffect, useState } from "react";
import { analyticsService } from "../services/analyticsService";
import { MonthlyCategorySpending, CreditUtilization } from "../types/analytics";
import { Card } from "../components/common/Card";
import { Badge } from "../components/common/Badge";
import { Spinner } from "../components/common/Spinner";
import { SpendingDonutChart } from "../components/charts/SpendingDonutChart";
import { MonthlySpendingBarChart } from "../components/charts/MonthlySpendingBarChart";
import { formatCurrency, formatDate, getRiskLevelColor } from "../utils/formatters";
import { BarChart3, PieChart, ShieldAlert, TrendingUp } from "lucide-react";

export const AnalyticsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [monthlySpending, setMonthlySpending] = useState<MonthlyCategorySpending[]>([]);
  const [utilization, setUtilization] = useState<CreditUtilization[]>([]);

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const [spRes, utRes] = await Promise.all([
        analyticsService.getMonthlySpending(50),
        analyticsService.getCreditUtilization(),
      ]);
      setMonthlySpending(spRes);
      setUtilization(utRes);
    } catch (err) {
      console.error("Error loading analytics", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-slate-400 font-medium">Đang tải báo cáo tài chính...</p>
      </div>
    );
  }

  // Aggregate by Parent Category
  const parentCategoryMap: Record<string, number> = {};
  monthlySpending.forEach((item) => {
    const parentName = item.parent_category_name || item.category_name;
    parentCategoryMap[parentName] =
      (parentCategoryMap[parentName] || 0) + Number(item.total_spending);
  });

  const parentCategoryChartData = Object.entries(parentCategoryMap).map(
    ([name, value]) => ({
      name,
      value,
      color: "",
    })
  );

  const totalSpendingSum = Object.values(parentCategoryMap).reduce(
    (a, b) => a + b,
    0
  );

  return (
    <div className="space-y-8">
      {/* 1. Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-400" />
          <span>Báo Cáo Phân Tích & Quản Trị Rủi Ro Tín Dụng</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Phân tích cơ cấu chi tiêu theo nhóm danh mục và giám sát tỷ lệ sử dụng hạn mức
        </p>
      </div>

      {/* 2. Credit Utilization Matrix */}
      <Card>
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Ma Trận Tỷ Lệ Sử Dụng Hạn Mức (Credit Utilization Matrix)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Khuyến nghị chuẩn quốc tế: Duy trì tỷ lệ &lt; 30% để tối ưu điểm tín dụng CIC
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {utilization.map((card) => {
            const risk = getRiskLevelColor(card.risk_level);
            return (
              <div
                key={card.account_id}
                className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">
                    {card.account_name}
                  </span>
                  <Badge variant={risk.badge as any} size="sm">
                    {card.risk_level}
                  </Badge>
                </div>

                <div className="flex items-baseline justify-between font-mono">
                  <span className="text-2xl font-bold text-slate-100">
                    {Number(card.utilization_percentage).toFixed(1)}%
                  </span>
                  <span className="text-xs text-slate-400">
                    {formatCurrency(card.current_balance)} / {formatCurrency(card.credit_limit)}
                  </span>
                </div>

                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${risk.bg}`}
                    style={{ width: `${Math.min(100, Math.max(0, card.utilization_percentage))}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 3. Category Spending Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
            <PieChart className="w-4 h-4 text-emerald-400" />
            <span>Phân Bổ Theo Nhóm Danh Mục</span>
          </h3>
          <SpendingDonutChart
            data={parentCategoryChartData}
            totalAmount={totalSpendingSum}
          />
        </Card>

        <Card className="lg:col-span-2">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
            <TrendingUp className="w-4 h-4 text-sky-400" />
            <span>Chi Tiết Chi Tiêu Theo Tháng & Hạng Mục</span>
          </h3>

          <div className="overflow-x-auto max-h-80 overflow-y-auto pr-1">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Tháng</th>
                  <th className="py-2.5 px-3">Hạng Mục Chi Tiêu</th>
                  <th className="py-2.5 px-3">Nhóm Cha</th>
                  <th className="py-2.5 px-3 text-center">Số GD</th>
                  <th className="py-2.5 px-3 text-right font-bold">Tổng Chi Tiêu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {monthlySpending.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-mono text-slate-300">
                      {formatDate(item.month, "MM/yyyy")}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-200">
                      {item.category_name}
                    </td>
                    <td className="py-2 px-3 text-slate-400">
                      {item.parent_category_name}
                    </td>
                    <td className="py-2 px-3 text-center font-mono text-slate-400">
                      {item.transaction_count}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400">
                      {formatCurrency(Number(item.total_spending))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};
