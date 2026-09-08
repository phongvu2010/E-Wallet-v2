import React, { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Gift,
  Info,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { CurrencyInput } from "../common/CurrencyInput";
import { Input } from "../common/Input";
import { Modal } from "../common/Modal";
import { Select } from "../common/Select";
import { useToast } from "../../context/ToastContext";
import { useRepayDebt } from "../../hooks/useFinanceMutations";
import { useAccounts, useCategoryTree } from "../../hooks/useFinanceQueries";
import { Account } from "../../types/account";
import { Debt } from "../../types/debt";
import { formatCategoryTreeToGroups } from "../../utils/categoryHelpers";
import { formatAccountLabel, formatCurrency } from "../../utils/formatters";

interface RepayDebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  debt: Debt | null;
}

export const RepayDebtModal: React.FC<RepayDebtModalProps> = ({
  isOpen,
  onClose,
  debt,
}) => {
  const [repaymentDate, setRepaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [principalPaid, setPrincipalPaid] = useState<number | undefined>(undefined);
  const [extraAmount, setExtraAmount] = useState<number | undefined>(undefined);
  const [accountId, setAccountId] = useState("");
  const [extraCategoryId, setExtraCategoryId] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const { data: accounts = [] } = useAccounts();
  const { data: categoryTree = [] } = useCategoryTree();
  const categoryGroups = formatCategoryTreeToGroups(categoryTree);
  const repayDebtMutation = useRepayDebt();
  const { toast } = useToast();

  useEffect(() => {
    if (debt) {
      setRepaymentDate(new Date().toISOString().split("T")[0]);
      setPrincipalPaid(debt.remaining_amount);
      setExtraAmount(undefined);
      setAccountId(debt.account_id || "");
      setExtraCategoryId("");
      setNote("");
      setFormError(null);
    }
  }, [debt]);

  if (!debt) return null;

  const isBorrow = debt.debt_type === "BORROW";
  const numPrincipal = Number(principalPaid || 0);
  const numExtra = Number(extraAmount || 0);
  const totalPayment = numPrincipal + numExtra;

  const handlePayFull = () => {
    setPrincipalPaid(debt.remaining_amount);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!numPrincipal || numPrincipal <= 0) {
      setFormError("Vui lòng nhập số tiền gốc trả/thu hợp lệ (> 0)");
      return;
    }

    if (numPrincipal > debt.remaining_amount) {
      setFormError(
        `Số tiền gốc trả (${formatCurrency(numPrincipal)}) vượt quá dư nợ còn lại (${formatCurrency(
          debt.remaining_amount
        )}). Vui lòng điền phần trả dư vào ô "Tiền bồi dưỡng / Cảm ơn"!`
      );
      return;
    }

    setFormError(null);

    try {
      await repayDebtMutation.mutateAsync({
        id: debt.id,
        payload: {
          repayment_date: repaymentDate,
          principal_paid: numPrincipal,
          extra_amount: numExtra > 0 ? numExtra : undefined,
          account_id: accountId || undefined,
          extra_category_id: extraCategoryId || undefined,
          note: note.trim() || undefined,
        },
      });

      toast.success(
        isBorrow
          ? `Đã trả ${formatCurrency(numPrincipal)} nợ gốc cho ${debt.counterparty_name}` +
              (numExtra > 0 ? ` (kèm ${formatCurrency(numExtra)} tiền bồi dưỡng)` : "")
          : `Đã thu hồi ${formatCurrency(numPrincipal)} nợ gốc từ ${debt.counterparty_name}` +
              (numExtra > 0 ? ` (kèm ${formatCurrency(numExtra)} tiền cảm ơn)` : "")
      );

      onClose();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || "Không thể thực hiện trả nợ. Vui lòng thử lại.");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isBorrow ? "Thanh Toán / Trả Nợ Bạn Bè" : "Thu Hồi Nợ Đã Cho Vay"}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
            {formError}
          </div>
        )}

        {/* Header Summary Banner */}
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 block">
              {isBorrow ? "Khoản nợ đối với:" : "Khoản cho vay đối với:"}
            </span>
            <div className="text-sm font-bold text-slate-100 flex items-center gap-2 mt-0.5">
              <span>{debt.counterparty_name}</span>
              <Badge variant={isBorrow ? "warning" : "info"}>
                {isBorrow ? "Tôi Đi Vay" : "Tôi Cho Vay"}
              </Badge>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-semibold text-slate-400 block">Dư nợ gốc còn lại:</span>
            <span className="text-base font-extrabold text-amber-400">
              {formatCurrency(debt.remaining_amount)}
            </span>
          </div>
        </div>

        {/* Principal Repayment Input */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-slate-300">
              {isBorrow ? "Số Tiền Gốc Trả Đợt Này (VNĐ) *" : "Số Tiền Gốc Thu Hồi Đợt Này (VNĐ) *"}
            </label>
            <button
              type="button"
              onClick={handlePayFull}
              className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 transition-colors"
            >
              Trả hết ({formatCurrency(debt.remaining_amount)})
            </button>
          </div>
          <CurrencyInput
            value={principalPaid}
            onValueChange={(val) => setPrincipalPaid(val)}
            placeholder={`Tối đa ${debt.remaining_amount.toLocaleString("vi-VN")}`}
          />
          <p className="text-[11px] text-slate-400 mt-1">
            💡 Khoản tiền gốc này chỉ dùng để xóa nợ, <strong>hoàn toàn không tính vào Chi phí/Thu nhập sinh hoạt</strong>.
          </p>
        </div>

        {/* Extra Tip / Appreciation Input */}
        <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-3">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
            <Gift className="w-4 h-4" />
            <span>
              {isBorrow
                ? "Tiền Bồi Dưỡng / Cảm Ơn / Quà Thêm (Tùy chọn)"
                : "Tiền Cà Phê / Cảm Ơn Nhận Thêm (Tùy chọn)"}
            </span>
          </div>

          <CurrencyInput
            value={extraAmount}
            onValueChange={(val) => setExtraAmount(val)}
            placeholder="VD: 200,000 (Nếu có trả dư thêm để cảm ơn)"
          />

          {numExtra > 0 && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Danh Mục Phân Loại Khoản Tiền Bồi Dưỡng
              </label>
              <Select
                value={extraCategoryId}
                onChange={(e) => setExtraCategoryId(e.target.value)}
                className="text-xs"
              >
                <option value="">
                  {isBorrow ? "-- Mặc định: Chi tiêu khác / Quà tặng --" : "-- Mặc định: Thu nhập khác --"}
                </option>
                {categoryGroups.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
              <p className="text-[11px] text-amber-300/80 mt-1">
                ✨ Số tiền {formatCurrency(numExtra)} này <strong>sẽ được ghi nhận chuẩn xác vào {isBorrow ? "Chi tiêu thực tế" : "Thu nhập thực tế"}</strong> trong báo cáo tài chính của bạn.
              </p>
            </div>
          )}
        </div>

        {/* Account Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            {isBorrow ? "Ví / Tài Khoản Trích Tiền Thanh Toán" : "Ví / Tài Khoản Nhận Tiền Thu Nợ"}
          </label>
          <div className="relative">
            <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10 pointer-events-none" />
            <Select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="pl-9"
            >
              <option value="">-- Không trích số dư (Ghi nhận sổ riêng) --</option>
              {accounts.map((acc: Account) => (
                <option key={acc.id} value={acc.id}>
                  {formatAccountLabel(acc)}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Date & Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Ngày Giao Dịch *
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                type="date"
                value={repaymentDate}
                onChange={(e) => setRepaymentDate(e.target.value)}
                className="pl-9"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Ghi Chú Đợt Trả
            </label>
            <Input
              type="text"
              placeholder="VD: Trả đợt 1, tất toán kèm cafe..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        {/* Summary Breakdown Box */}
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-300">
            <span>Tiền gốc {isBorrow ? "trả nợ" : "thu hồi"}:</span>
            <span className="font-semibold text-slate-100">{formatCurrency(numPrincipal)}</span>
          </div>
          {numExtra > 0 && (
            <div className="flex justify-between text-amber-400 font-medium">
              <span>Tiền bồi dưỡng / cảm ơn:</span>
              <span>+ {formatCurrency(numExtra)}</span>
            </div>
          )}
          <div className="border-t border-slate-800 pt-1.5 flex justify-between font-bold text-slate-100">
            <span>Tổng tiền biến động thực tế qua ví:</span>
            <span className="text-sm text-sky-400">{formatCurrency(totalPayment)}</span>
          </div>
          <div className="flex justify-between text-[11px] text-slate-400 pt-0.5">
            <span>Dư nợ gốc còn lại sau đợt này:</span>
            <span className="font-bold text-emerald-400">
              {formatCurrency(Math.max(0, debt.remaining_amount - numPrincipal))}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Hủy Bỏ
          </Button>
          <Button
            type="submit"
            isLoading={repayDebtMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold"
          >
            {isBorrow ? "Xác Nhận Trả Nợ" : "Xác Nhận Thu Nợ"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
