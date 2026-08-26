import React, { useEffect, useState } from "react";
import { accountService } from "../services/accountService";
import { Account, AccountLiveBalance } from "../types/account";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Badge } from "../components/common/Badge";
import { Modal } from "../components/common/Modal";
import { Input } from "../components/common/Input";
import { Spinner } from "../components/common/Spinner";
import { CreditCardVisual } from "../components/cards/CreditCardVisual";
import { formatCurrency, formatDate, getRiskLevelColor } from "../utils/formatters";
import {
  CreditCard,
  Plus,
  Edit2,
  Calendar,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  CheckCircle2,
} from "lucide-react";

export const AccountsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [liveBalances, setLiveBalances] = useState<AccountLiveBalance[]>([]);
  const [selectedAcc, setSelectedAcc] = useState<AccountLiveBalance | null>(null);

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editAccountId, setEditAccountId] = useState<string | null>(null);
  const [editLimit, setEditLimit] = useState<string>("");
  const [editNote, setEditNote] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetchAccountsData();
  }, []);

  const fetchAccountsData = async () => {
    setLoading(true);
    try {
      const [accRes, liveRes] = await Promise.all([
        accountService.getAll(),
        accountService.getLiveBalances(),
      ]);
      setAccounts(accRes);
      setLiveBalances(liveRes);
      if (liveRes.length > 0 && !selectedAcc) {
        setSelectedAcc(liveRes[0]);
      }
    } catch (err) {
      console.error("Error fetching accounts data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (acc: Account) => {
    setEditAccountId(acc.id);
    setEditLimit(String(acc.credit_limit));
    setEditNote(acc.note || "");
    setIsEditOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAccountId) return;
    setIsUpdating(true);
    try {
      await accountService.update(editAccountId, {
        credit_limit: parseFloat(editLimit) || 0,
        note: editNote,
      });
      setIsEditOpen(false);
      await fetchAccountsData();
    } catch (err) {
      console.error("Error updating account", err);
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-slate-400 font-medium">Đang tải danh sách thẻ...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-400" />
            <span>Danh Mục Thẻ & Hạn Mức Tín Dụng</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Theo dõi chi tiết dư nợ sao kê, các giao dịch phát sinh chưa chốt và hạn mức khả dụng
          </p>
        </div>
      </div>

      {/* 2. Visual Card Showcase */}
      <div>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
          Thẻ Đang Hoạt Động (Nhấn để chọn đối soát)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {liveBalances.map((acc) => (
            <CreditCardVisual
              key={acc.account_id}
              account={acc}
              isSelected={selectedAcc?.account_id === acc.account_id}
              onClick={() => setSelectedAcc(acc)}
            />
          ))}
        </div>
      </div>

      {/* 3. Detailed Account Audit & Breakdown Table */}
      <Card>
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100">
              Chi Tiết Dư Nợ & Hạn Mức Khả Dụng Thực Tế (Live Breakdown)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Công thức: Dư nợ sao kê gần nhất + Chi tiêu chưa sao kê - Thanh toán chưa sao kê = Dư nợ thực tế
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Tên Thẻ / Ngân Hàng</th>
                <th className="py-3 px-4">Số Thẻ</th>
                <th className="py-3 px-4 text-right">Hạn Mức</th>
                <th className="py-3 px-4 text-right">Dư Nợ Sao Kê</th>
                <th className="py-3 px-4 text-right">Chưa Lên Sao Kê (Net)</th>
                <th className="py-3 px-4 text-right font-bold text-slate-200">Dư Nợ Tức Thời</th>
                <th className="py-3 px-4 text-right text-emerald-400 font-bold">Khả Dụng</th>
                <th className="py-3 px-4 text-center">Trạng Thái</th>
                <th className="py-3 px-4 text-center">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {liveBalances.map((acc) => {
                const rawAcc = accounts.find((a) => a.id === acc.account_id);
                const risk = getRiskLevelColor(acc.live_risk_level);
                return (
                  <tr
                    key={acc.account_id}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-200">{acc.account_name}</div>
                      <div className="text-[11px] text-slate-400">{acc.bank_name}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      {acc.card_number_masked}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                      {formatCurrency(acc.credit_limit)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                      {formatCurrency(acc.latest_statement_balance)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono">
                      <div className={acc.unbilled_net_amount > 0 ? "text-rose-400" : "text-emerald-400"}>
                        {acc.unbilled_net_amount > 0 ? "+" : ""}
                        {formatCurrency(acc.unbilled_net_amount)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {acc.unbilled_transaction_count} giao dịch
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-100">
                      {formatCurrency(acc.live_current_balance)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                      {formatCurrency(acc.live_available_limit)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <Badge
                        variant={
                          acc.status === "ACTIVE"
                            ? "success"
                            : acc.status === "REPLACED"
                            ? "warning"
                            : "neutral"
                        }
                      >
                        {acc.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {rawAcc && (
                        <button
                          onClick={() => handleOpenEdit(rawAcc)}
                          className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors"
                          title="Chỉnh sửa hạn mức / ghi chú"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 4. Edit Account Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Cập Nhật Thông Tin Thẻ Tín Dụng"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <Input
            label="Hạn Mức Tín Dụng (VNĐ)"
            type="number"
            value={editLimit}
            onChange={(e) => setEditLimit(e.target.value)}
            required
          />
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Ghi Chú Cá Nhân
            </label>
            <textarea
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
              rows={3}
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              placeholder="VD: Thẻ dùng cho chi tiêu ăn uống tích điểm 5x..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditOpen(false)}
            >
              Hủy
            </Button>
            <Button type="submit" variant="primary" isLoading={isUpdating}>
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
