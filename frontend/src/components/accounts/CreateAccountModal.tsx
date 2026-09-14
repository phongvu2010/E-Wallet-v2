import React, { useState } from "react";
import {
  Banknote,
  Building2,
  CheckCircle2,
  CreditCard,
  PiggyBank,
  Plus,
  Smartphone,
  Wallet,
} from "lucide-react";
import { useCreateAccount } from "../../hooks/useFinanceMutations";
import { useInstitutions } from "../../hooks/useFinanceQueries";
import { AccountType } from "../../types/account";
import { Institution } from "../../types/institution";
import { Button } from "../common/Button";
import { CurrencyInput } from "../common/CurrencyInput";
import { Input } from "../common/Input";
import { Modal } from "../common/Modal";
import { Select } from "../common/Select";
import { useToast } from "../../context/ToastContext";
import { FormErrors, parseNumeric, validateAccountForm } from "../../utils/validators";

interface CreateAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ACCOUNT_TYPE_OPTIONS: {
  type: AccountType;
  label: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  {
    type: "BANK_ACCOUNT",
    label: "Tài khoản Ngân hàng",
    desc: "VCB, Techcombank, MB, VPBank... (Tiền gửi thanh toán, nhận lương)",
    icon: <Building2 className="w-5 h-5 text-sky-400" />,
    color: "#0284c7",
  },
  {
    type: "CASH",
    label: "Ví Tiền mặt",
    desc: "Tiền mặt trong ví, quỹ chi tiêu hàng ngày",
    icon: <Banknote className="w-5 h-5 text-emerald-400" />,
    color: "#10b981",
  },
  {
    type: "E_WALLET",
    label: "Ví Điện tử",
    desc: "MoMo, ZaloPay, ShopeePay, ViettelPay...",
    icon: <Smartphone className="w-5 h-5 text-pink-400" />,
    color: "#ec4899",
  },
  {
    type: "CREDIT_CARD",
    label: "Thẻ Tín dụng",
    desc: "Shinhan, HSBC, Sacombank... (Quản lý sao kê, trả góp 0%, cashback)",
    icon: <CreditCard className="w-5 h-5 text-amber-400" />,
    color: "#f59e0b",
  },
  {
    type: "SAVINGS",
    label: "Sổ Tiết kiệm",
    desc: "Tiền gửi tiết kiệm ngân hàng có kỳ hạn hoặc tích lũy",
    icon: <PiggyBank className="w-5 h-5 text-purple-400" />,
    color: "#8b5cf6",
  },
];

const PRESET_COLORS = [
  "#0284c7", // Sky
  "#10b981", // Emerald
  "#ec4899", // Pink
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#ef4444", // Red
  "#3b82f6", // Blue
  "#64748b", // Slate
];

export const CreateAccountModal: React.FC<CreateAccountModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { toast } = useToast();
  const createMutation = useCreateAccount();
  const { data: institutions = [] } = useInstitutions();

  const [accountType, setAccountType] = useState<AccountType>("BANK_ACCOUNT");
  const [accountName, setAccountName] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [initialBalance, setInitialBalance] = useState("0");
  const [creditLimit, setCreditLimit] = useState("0");
  const [billingDay, setBillingDay] = useState("20");
  const [gracePeriod, setGracePeriod] = useState("15");
  const [selectedColor, setSelectedColor] = useState(ACCOUNT_TYPE_OPTIONS[0].color);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [error, setError] = useState<string | null>(null);

  const handleTypeSelect = (type: AccountType) => {
    setAccountType(type);
    setErrors({});
    const opt = ACCOUNT_TYPE_OPTIONS.find((o) => o.type === type);
    if (opt) setSelectedColor(opt.color);

    if (type === "CASH") {
      setAccountName("Ví Tiền Mặt Cá Nhân");
      setInstitutionId("");
    } else if (type === "E_WALLET") {
      setAccountName("Ví MoMo");
    } else if (type === "BANK_ACCOUNT") {
      setAccountName("Tài khoản Vietcombank");
    } else if (type === "CREDIT_CARD") {
      setAccountName("Thẻ Tín Dụng Mới");
    } else if (type === "SAVINGS") {
      setAccountName("Sổ Tiết Kiệm Tích Lũy");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validateAccountForm({
      accountType,
      accountName,
      institutionId,
      accountNumber,
      initialBalance,
      creditLimit,
      billingDay,
      gracePeriod,
      note,
    });

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setError(null);

    const numInitial = parseNumeric(initialBalance);
    const numLimit = parseNumeric(creditLimit);
    const numBilling = parseInt(billingDay) || 20;
    const numGrace = parseInt(gracePeriod) || 15;

    const rawNumber = accountNumber.trim();
    const last4 = rawNumber.length >= 4 ? rawNumber.slice(-4) : (rawNumber || accountType.slice(0, 4));
    const masked = rawNumber || (accountType === "CASH" ? "Ví tiền mặt" : accountName);

    try {
      await createMutation.mutateAsync({
        account_name: accountName.trim(),
        account_type: accountType,
        institution_id: institutionId || undefined,
        card_number_masked: masked,
        card_number_last4: last4,
        initial_balance: numInitial,
        credit_limit: accountType === "CREDIT_CARD" ? numLimit : 0,
        billing_day_of_month: accountType === "CREDIT_CARD" ? numBilling : undefined,
        grace_period_days: accountType === "CREDIT_CARD" ? numGrace : 0,
        color_hex: selectedColor,
        note: note.trim() || undefined,
      });

      toast.success("Tạo tài khoản / ví mới thành công!");
      onClose();
      // Reset form
      setAccountName("");
      setAccountNumber("");
      setInitialBalance("0");
      setCreditLimit("0");
      setNote("");
      setError(null);
      setErrors({});
    } catch (err: any) {
      setError(err.message || "Lỗi tạo tài khoản");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Thêm Tài Khoản / Ví Tiền Mới"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-medium">
            {error}
          </div>
        )}

        {/* 1. Chọn loại tài khoản */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            1. Chọn loại tài khoản / ví
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {ACCOUNT_TYPE_OPTIONS.map((opt) => {
              const isSelected = accountType === opt.type;
              return (
                <button
                  type="button"
                  key={opt.type}
                  onClick={() => handleTypeSelect(opt.type)}
                  className={`p-3 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                    isSelected
                      ? "bg-slate-800/90 border-emerald-500/80 shadow-lg shadow-emerald-950/30 ring-1 ring-emerald-500"
                      : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40"
                  }`}
                >
                  <div className="p-2 rounded-xl bg-slate-800 border border-slate-700/60 shrink-0">
                    {opt.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-100">{opt.label}</p>
                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Thông tin chi tiết */}
        <div className="space-y-4 pt-2 border-t border-slate-800/80">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
            2. Thông tin tài khoản
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Input
                label="Tên tài khoản / Ví"
                placeholder="VD: Vietcombank Lương, Ví Tiền Mặt..."
                value={accountName}
                onChange={(e) => {
                  setAccountName(e.target.value);
                  if (errors.accountName) setErrors((prev) => ({ ...prev, accountName: undefined }));
                }}
                error={errors.accountName}
                required
              />
            </div>

            {accountType !== "CASH" && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Tổ chức phát hành / Ngân hàng
                </label>
                <Select
                  value={institutionId}
                  onChange={(e) => setInstitutionId(e.target.value)}
                  options={[
                    { value: "", label: "-- Chọn Ngân hàng / Tổ chức --" },
                    ...institutions.map((i: Institution) => ({
                      value: i.id,
                      label: `${i.short_name || i.name} (${i.code})`,
                    })),
                  ]}
                />
              </div>
            )}

            {accountType !== "CASH" && (
              <div>
                <Input
                  label={accountType === "CREDIT_CARD" ? "Số thẻ (hoặc 4 số cuối)" : "Số tài khoản ngân hàng / Số ví"}
                  placeholder={accountType === "CREDIT_CARD" ? "VD: 4696 72xx xxxx 2958" : "VD: 1903 8888 9999"}
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                />
              </div>
            )}

            {/* Số dư ban đầu cho Asset Accounts */}
            {accountType !== "CREDIT_CARD" && (
              <div>
                <CurrencyInput
                  label="Số dư ban đầu (VNĐ)"
                  value={initialBalance}
                  onChange={setInitialBalance}
                  placeholder="0"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Số tiền hiện có trong tài khoản tại thời điểm bắt đầu theo dõi
                </p>
              </div>
            )}

            {/* Hạn mức tín dụng & ngày chốt sao kê cho Credit Card */}
            {accountType === "CREDIT_CARD" && (
              <>
                <div>
                  <CurrencyInput
                    label="Hạn mức tín dụng (VNĐ)"
                    value={creditLimit}
                    onValueChange={(val) => {
                      setCreditLimit(String(val));
                      if (errors.creditLimit) setErrors((prev) => ({ ...prev, creditLimit: undefined }));
                    }}
                    onChangeRaw={(raw) => setCreditLimit(raw)}
                    error={errors.creditLimit}
                    placeholder="50,000,000"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Input
                      label="Ngày chốt sao kê"
                      type="number"
                      min={1}
                      max={31}
                      value={billingDay}
                      onChange={(e) => {
                        setBillingDay(e.target.value);
                        if (errors.billingDay) setErrors((prev) => ({ ...prev, billingDay: undefined }));
                      }}
                      error={errors.billingDay}
                    />
                  </div>
                  <div>
                    <Input
                      label="Số ngày gia hạn"
                      type="number"
                      min={0}
                      max={60}
                      value={gracePeriod}
                      onChange={(e) => {
                        setGracePeriod(e.target.value);
                        if (errors.gracePeriod) setErrors((prev) => ({ ...prev, gracePeriod: undefined }));
                      }}
                      error={errors.gracePeriod}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Chọn màu sắc nhận diện */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Màu sắc đại diện
            </label>
            <div className="flex items-center gap-2.5">
              {PRESET_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setSelectedColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform flex items-center justify-center ${
                    selectedColor === c ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-slate-900" : "opacity-80 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {selectedColor === c && <CheckCircle2 className="w-4 h-4 text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Input
              label="Ghi chú"
              placeholder="Ghi chú thêm về tài khoản này..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" variant="primary" isLoading={createMutation.isPending}>
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Tạo Tài Khoản</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
};
