import React, { useState } from "react";
import { Award, Coins, Gift, Sparkles } from "lucide-react";
import { Badge } from "../components/common/Badge";
import { Card } from "../components/common/Card";
import { Select } from "../components/common/Select";
import { Spinner } from "../components/common/Spinner";
import { useAccounts, useRewards } from "../hooks/useFinanceQueries";
import { Account } from "../types/account";
import { RewardLedger } from "../types/reward";
import { formatAccountLabel, formatCurrency, formatDate } from "../utils/formatters";

export const RewardsPage: React.FC = () => {
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

  const { data: accounts = [] } = useAccounts();
  const {
    data: rewards = [],
    isLoading: rewardsLoading,
  } = useRewards(selectedAccountId || undefined);

  if (rewardsLoading && rewards.length === 0) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-slate-400 font-medium">Đang tải sổ cái điểm thưởng...</p>
      </div>
    );
  }

  // Calculate totals
  const totalPoints = rewards
    .filter((r: RewardLedger) => r.reward_type === "POINT")
    .reduce((sum: number, r: RewardLedger) => sum + Number(r.earned_this_month), 0);

  const totalCashback = rewards
    .filter((r: RewardLedger) => r.reward_type === "CASHBACK")
    .reduce((sum: number, r: RewardLedger) => sum + Number(r.earned_this_month), 0);

  return (
    <div className="space-y-6">
      {/* 1. Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Gift className="w-5 h-5 text-emerald-400" />
            <span>Sổ Cái Điểm Thưởng & Hoàn Tiền Cashback</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Quản lý Shinhan Points, Tiền hoàn Cashback HSBC/Sacombank và hạn sử dụng
          </p>
        </div>

        <div className="w-full sm:w-64">
          <Select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            options={[
              { value: "", label: "Tất cả các thẻ" },
              ...accounts.map((a: Account) => ({
                value: a.id,
                label: formatAccountLabel(a),
              })),
            ]}
          />
        </div>
      </div>

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Tổng Shinhan Points Đã Tích Lũy</p>
            <p className="text-xl font-bold text-amber-400 font-mono mt-0.5">
              {totalPoints.toLocaleString()} Points
            </p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Tổng Tiền Hoàn Cashback Đã Tích Lũy</p>
            <p className="text-xl font-bold text-emerald-400 font-mono mt-0.5">
              {formatCurrency(totalCashback)}
            </p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Tổng Bản Ghi Điểm Thưởng</p>
            <p className="text-xl font-bold text-slate-100 font-mono mt-0.5">
              {rewards.length} Kỳ sao kê
            </p>
          </div>
        </Card>
      </div>

      {/* 3. Rewards History Table */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <h3 className="text-base font-bold text-slate-100">Lịch Sử Điểm Thưởng Theo Kỳ Sao Kê</h3>
        </div>

        {rewards.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-slate-500 text-sm">
            Không có dữ liệu điểm thưởng
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Loại Phần Thưởng</th>
                  <th className="py-3 px-4 text-right">Tồn Đầu Kỳ</th>
                  <th className="py-3 px-4 text-right">Tích Lũy Kỳ Này</th>
                  <th className="py-3 px-4 text-right">Đã Dùng / Đổi</th>
                  <th className="py-3 px-4 text-right font-bold text-slate-200">Khả Dụng</th>
                  <th className="py-3 px-4 text-right text-rose-400">Sắp Hết Hạn</th>
                  <th className="py-3 px-4 text-center">Hạn Dùng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {rewards.map((r: RewardLedger) => (
                  <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <Badge
                        variant={
                          r.reward_type === "POINT"
                            ? "warning"
                            : r.reward_type === "CASHBACK"
                            ? "success"
                            : "info"
                        }
                      >
                        {r.reward_type}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                      {Number(r.previous_remaining).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-emerald-400 font-bold">
                      +{Number(r.earned_this_month).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                      {Number(r.used_this_month).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-100">
                      {Number(r.available_balance).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-rose-400">
                      {Number(r.expiring_amount) > 0
                        ? Number(r.expiring_amount).toLocaleString()
                        : "-"}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-slate-400">
                      {formatDate(r.expiration_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
