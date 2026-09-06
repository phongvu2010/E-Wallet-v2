import React from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Coins,
  CreditCard,
  Gift,
  Plane,
  Sparkles,
} from "lucide-react";
import { useAccounts, useRewards } from "../../hooks/useFinanceQueries";
import { RewardLedger } from "../../types/reward";
import { Account } from "../../types/account";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { Card } from "../common/Card";
import { Spinner } from "../common/Spinner";

export const RewardsCashbackWidget: React.FC = () => {
  const { data: rewards = [], isLoading: rewardsLoading } = useRewards();
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts();

  if (rewardsLoading || accountsLoading) {
    return (
      <Card className="h-44 flex items-center justify-center">
        <Spinner size="md" />
      </Card>
    );
  }

  // Aggregate points vs cashback
  let totalPoints = 0;
  let totalCashback = 0;
  let totalMiles = 0;
  let expiringSoonAmount = 0;
  let nearestExpDate: string | null = null;

  // Account lookup
  const accountMap = new Map<string, Account>();
  accounts.forEach((acc: Account) => accountMap.set(acc.id, acc));

  // Find latest reward ledger record per account
  const latestByAccount = new Map<string, RewardLedger>();
  rewards.forEach((r: RewardLedger) => {
    const existing = latestByAccount.get(r.account_id);
    if (!existing || (r.created_at && (!existing.created_at || r.created_at > existing.created_at))) {
      latestByAccount.set(r.account_id, r);
    }
  });

  latestByAccount.forEach((r: RewardLedger) => {
    const bal = Number(r.available_balance || 0);
    if (r.reward_type === "POINT") {
      totalPoints += bal;
    } else if (r.reward_type === "CASHBACK") {
      totalCashback += bal;
    } else if (r.reward_type === "MILE") {
      totalMiles += bal;
    }

    const expAmt = Number(r.expiring_amount || 0);
    if (expAmt > 0) {
      expiringSoonAmount += expAmt;
      if (r.expiration_date && (!nearestExpDate || r.expiration_date < nearestExpDate)) {
        nearestExpDate = r.expiration_date;
      }
    }
  });

  const hasRewards = totalPoints > 0 || totalCashback > 0 || totalMiles > 0;

  return (
    <Card className="p-5 bg-gradient-to-br from-slate-900 via-slate-900/95 to-amber-950/20 border-amber-500/20 flex flex-col justify-between">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3.5 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>Điểm Thưởng & Hoàn Tiền</span>
            </h3>
          </div>
        </div>

        <Link
          to="/rewards"
          className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1 group"
        >
          <span>Sổ cái thưởng</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* Primary Reward Blocks */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Points Block */}
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1 font-medium">
            <span className="flex items-center gap-1 text-amber-400">
              <Coins className="w-3 h-3" />
              <span>Điểm Thưởng</span>
            </span>
          </div>
          <p className="text-base sm:text-lg font-bold font-mono text-amber-300">
            {totalPoints.toLocaleString("vi-VN")} pts
          </p>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            ≈ {formatCurrency(totalPoints)}
          </span>
        </div>

        {/* Cashback Block */}
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1 font-medium">
            <span className="flex items-center gap-1 text-emerald-400">
              <Gift className="w-3 h-3" />
              <span>Hoàn Tiền Khả Dụng</span>
            </span>
          </div>
          <p className="text-base sm:text-lg font-bold font-mono text-emerald-400">
            {formatCurrency(totalCashback)}
          </p>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            Tự động cấn trừ dư nợ
          </span>
        </div>
      </div>

      {/* Expiring Soon Alert or Feature Summary */}
      {expiringSoonAmount > 0 ? (
        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <div className="truncate">
            <span className="font-semibold">{expiringSoonAmount.toLocaleString("vi-VN")} điểm</span>
            <span> sắp hết hạn</span>
            {nearestExpDate && <span> ({formatDate(nearestExpDate)})</span>}
          </div>
        </div>
      ) : (
        <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 text-slate-300 text-xs flex items-center justify-between">
          <span className="text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Tối ưu điểm CIC & hoàn tiền</span>
          </span>
          <span className="text-[11px] font-semibold text-emerald-400">
            Không có điểm hết hạn
          </span>
        </div>
      )}
    </Card>
  );
};
