import React, { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Calendar, Phone, User, Wallet } from "lucide-react";
import { Button } from "../common/Button";
import { CurrencyInput } from "../common/CurrencyInput";
import { Input } from "../common/Input";
import { Modal } from "../common/Modal";
import { Select } from "../common/Select";
import { useToast } from "../../context/ToastContext";
import { useCreateDebt } from "../../hooks/useFinanceMutations";
import { useAccounts } from "../../hooks/useFinanceQueries";
import { Account } from "../../types/account";
import { DebtType } from "../../types/debt";
import { formatAccountLabel } from "../../utils/formatters";

interface CreateDebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: DebtType;
}

export const CreateDebtModal: React.FC<CreateDebtModalProps> = ({
  isOpen,
  onClose,
  defaultType = "BORROW",
}) => {
  const [debtType, setDebtType] = useState<DebtType>(defaultType);
  const [counterpartyName, setCounterpartyName] = useState("");
  const [counterpartyPhone, setCounterpartyPhone] = useState("");
  const [principalAmount, setPrincipalAmount] = useState<number | undefined>(undefined);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [accountId, setAccountId] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const { data: accounts = [] } = useAccounts();
  const createDebtMutation = useCreateDebt();
  const { toast } = useToast();

  const resetForm = () => {
    setCounterpartyName("");
    setCounterpartyPhone("");
    setPrincipalAmount(undefined);
    setStartDate(new Date().toISOString().split("T")[0]);
    setDueDate("");
    setAccountId("");
    setNote("");
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!counterpartyName.trim()) {
      setFormError("Vui lòng nhập tên người vay / cho vay");
      return;
    }

    if (!principalAmount || principalAmount <= 0) {
      setFormError("Vui lòng nhập số tiền gốc hợp lệ (> 0)");
      return;
    }

    setFormError(null);

    try {
      await createDebtMutation.mutateAsync({
        counterparty_name: counterpartyName.trim(),
        counterparty_phone: counterpartyPhone.trim() || undefined,
        debt_type: debtType,
        principal_amount: principalAmount,
        start_date: startDate,
        due_date: dueDate || undefined,
        account_id: accountId || undefined,
        note: note.trim() || undefined,
      });

      toast.success(
        debtType === "BORROW"
          ? `Đã ghi nhận khoản vay ${principalAmount.toLocaleString("vi-VN")}đ từ ${counterpartyName}`
          : `Đã ghi nhận khoản cho ${counterpartyName} vay ${principalAmount.toLocaleString("vi-VN")}đ`
      );

      resetForm();
      onClose();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || "Không thể tạo khoản nợ. Vui lòng thử lại.");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Ghi Nhận Vay Mượn Dân Sự"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
            {formError}
          </div>
        )}

        {/* Type Toggle Tabs */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-2">
            Hình Thức Vay Mượn
          </label>
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-900/80 border border-slate-800">
            <button
              type="button"
              onClick={() => setDebtType("BORROW")}
              className={`py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                debtType === "BORROW"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-900/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <ArrowDownLeft className="w-4 h-4 text-blue-300" />
              <span>Tôi Đi Vay (Nợ Phải Trả)</span>
            </button>
            <button
              type="button"
              onClick={() => setDebtType("LEND")}
              className={`py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                debtType === "LEND"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <ArrowUpRight className="w-4 h-4 text-indigo-300" />
              <span>Tôi Cho Vay (Nợ Phải Thu)</span>
            </button>
          </div>
        </div>

        {/* Counterparty Name & Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {debtType === "BORROW" ? "Vay của ai (Người cho vay) *" : "Cho ai vay (Người vay) *"}
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="VD: Bạn Nam, Anh Tuấn..."
                value={counterpartyName}
                onChange={(e) => setCounterpartyName(e.target.value)}
                className="pl-9"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Số Điện Thoại (Tùy chọn)
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="tel"
                placeholder="09xx xxx xxx"
                value={counterpartyPhone}
                onChange={(e) => setCounterpartyPhone(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>

        {/* Principal Amount */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Số Tiền Gốc Vay/Mượn (VNĐ) *
          </label>
          <CurrencyInput
            value={principalAmount}
            onValueChange={(val) => setPrincipalAmount(val)}
            placeholder="VD: 5,000,000"
          />
        </div>

        {/* Account Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            {debtType === "BORROW" ? "Ví / Tài Khoản Nhận Tiền Vay" : "Ví / Tài Khoản Trích Tiền Cho Vay"}
          </label>
          <div className="relative">
            <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10 pointer-events-none" />
            <Select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="pl-9"
            >
              <option value="">-- Không liên kết tài khoản (Ghi nhận sổ riêng) --</option>
              {accounts.map((acc: Account) => (
                <option key={acc.id} value={acc.id}>
                  {formatAccountLabel(acc)}
                </option>
              ))}
            </Select>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {debtType === "BORROW"
              ? "Chọn tài khoản để tự động cộng số dư thực tế khi nhận tiền vay mà không làm sai lệch thu nhập P&L."
              : "Chọn tài khoản để tự động trừ số dư thực tế khi xuất tiền cho vay mà không tính vào chi tiêu sinh hoạt."}
          </p>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Ngày Vay / Mượn *
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="pl-9"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Hạn Hẹn Trả (Tùy chọn)
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>

        {/* Note */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Ghi Chú
          </label>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="VD: Mượn tạm lo việc cá nhân, hẹn trả sau ngày 15..."
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Hủy Bỏ
          </Button>
          <Button
            type="submit"
            isLoading={createDebtMutation.isPending}
            className="bg-sky-600 hover:bg-sky-500 text-white"
          >
            Lưu Khoản Vay
          </Button>
        </div>
      </form>
    </Modal>
  );
};
