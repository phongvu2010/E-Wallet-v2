import React, { useMemo, useState } from "react";
import { Building2, Calendar, ChevronDown, ChevronUp, DollarSign, Percent, ShieldAlert } from "lucide-react";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { CurrencyInput } from "../common/CurrencyInput";
import { Input } from "../common/Input";
import { Modal } from "../common/Modal";
import { Select } from "../common/Select";
import { useToast } from "../../context/ToastContext";
import { useCreateLoan } from "../../hooks/useFinanceMutations";
import { useAccounts, useInstitutions } from "../../hooks/useFinanceQueries";
import { Account } from "../../types/account";
import { Institution } from "../../types/institution";
import { InterestMethod, LoanCreatePayload, LoanType } from "../../types/loan";
import { formatAccountLabel, formatCurrency, formatDate, formatRate } from "../../utils/formatters";
import { FormErrors, parseNumeric, validateLoanForm } from "../../utils/validators";

interface CreateLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LOAN_TYPES: { value: LoanType; label: string }[] = [
  { value: "MORTGAGE", label: "Vay mua nhà / Thế chấp BĐS" },
  { value: "CONSUMER", label: "Vay tiêu dùng tín chấp" },
  { value: "AUTO", label: "Vay mua ô tô / Phương tiện" },
  { value: "BUSINESS", label: "Vay kinh doanh / Hộ kinh doanh" },
  { value: "OVERDRAFT", label: "Vay thấu chi tài khoản" },
  { value: "OTHER", label: "Gói vay khác" },
];

const INTEREST_METHODS: { value: InterestMethod; label: string }[] = [
  { value: "EQUAL_INSTALLMENT", label: "Dư nợ giảm dần - Trả góp đều (Gốc + Lãi cố định mỗi tháng / Niên kim)" },
  { value: "REDUCING_BALANCE", label: "Dư nợ giảm dần - Gốc chia đều (Lãi giảm dần, Tổng trả giảm dần)" },
  { value: "FLAT", label: "Lãi cố định trên gốc ban đầu (Flat rate)" },
];

export const CreateLoanModal: React.FC<CreateLoanModalProps> = ({ isOpen, onClose }) => {
  const { toast } = useToast();
  const createLoanMutation = useCreateLoan();

  const { data: institutions = [] } = useInstitutions();
  const { data: accounts = [] } = useAccounts();

  // Form states
  const [loanName, setLoanName] = useState("");
  const [loanCode, setLoanCode] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [loanType, setLoanType] = useState<LoanType>("MORTGAGE");
  const [interestMethod, setInterestMethod] = useState<InterestMethod>("EQUAL_INSTALLMENT");
  const [principalAmount, setPrincipalAmount] = useState<number | string>(100000000);
  const [termMonths, setTermMonths] = useState<number | string>(12);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [billingDay, setBillingDay] = useState<number | string>(15);
  const [interestRate, setInterestRate] = useState<number | string>(8.5);
  const [monthlyFee, setMonthlyFee] = useState<number | string>(0);
  const [note, setNote] = useState("");

  const [showPreview, setShowPreview] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Calculation for live amortization preview
  const preview = useMemo(() => {
    const p0 = parseNumeric(principalAmount);
    const term = parseNumeric(termMonths) || 1;
    const rate = parseNumeric(interestRate);
    const fee = parseNumeric(monthlyFee);
    const rMonthly = rate / 1200;
    const basePrincipal = Math.round(p0 / term);

    if (p0 <= 0 || term <= 0) return { firstPayment: 0, totalInterest: 0, totalFee: 0, schedules: [] };

    // Calculate PMT for EQUAL_INSTALLMENT
    let pmt = basePrincipal;
    if (interestMethod === "EQUAL_INSTALLMENT" && rate > 0) {
      const factor = Math.pow(1 + rMonthly, term);
      pmt = Math.round(p0 * (rMonthly * factor) / (factor - 1));
    }

    let curBal = p0;
    let totInt = 0;
    const scheds = [];

    for (let i = 1; i <= term; i++) {
      let p = 0;
      let int = 0;

      if (interestMethod === "EQUAL_INSTALLMENT") {
        int = Math.round(curBal * rMonthly);
        if (i === term) {
          p = curBal;
        } else {
          p = Math.min(curBal, Math.max(0, pmt - int));
        }
      } else if (interestMethod === "FLAT") {
        p = i === term ? curBal : Math.min(curBal, basePrincipal);
        int = Math.round(p0 * rMonthly);
      } else {
        // REDUCING_BALANCE (Equal Principal)
        p = i === term ? curBal : Math.min(curBal, basePrincipal);
        int = Math.round(curBal * rMonthly);
      }

      const total = p + int + fee;
      const endBal = Math.max(0, curBal - p);
      curBal = endBal;
      totInt += int;

      scheds.push({
        index: i,
        principal: p,
        interest: int,
        fee,
        total,
        endingBalance: endBal,
      });
    }

    return {
      firstPayment: scheds[0]?.total || 0,
      totalInterest: totInt,
      totalFee: fee * term,
      schedules: scheds,
    };
  }, [principalAmount, termMonths, interestRate, monthlyFee, interestMethod]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validateLoanForm({
      loanName,
      loanCode,
      institutionId,
      accountId,
      loanType,
      interestMethod,
      principalAmount,
      termMonths,
      startDate,
      billingDay,
      interestRate,
      monthlyFee,
      note,
    });

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});

    const p = parseNumeric(principalAmount);
    const t = parseNumeric(termMonths);
    const r = parseNumeric(interestRate);

    const payload: LoanCreatePayload = {
      loan_name: loanName.trim(),
      loan_code: loanCode.trim() || undefined,
      institution_id: institutionId || undefined,
      account_id: accountId || undefined,
      loan_type: loanType,
      interest_method: interestMethod,
      principal_amount: p,
      term_months: t,
      monthly_fee: parseNumeric(monthlyFee),
      start_date: startDate,
      billing_day_of_month: parseNumeric(billingDay) || 15,
      current_interest_rate: r,
      note: note.trim() || undefined,
    };

    try {
      await createLoanMutation.mutateAsync(payload);
      toast.success(`Đã khởi tạo gói vay "${loanName.trim()}" thành công!`);
      onClose();
    } catch (err: any) {
      toast.error(`Lỗi khi tạo gói vay: ${err.message || "Vui lòng thử lại"}`);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Khởi Tạo Gói Vay Tài Chính (Lãi Suất Thả Nổi)" maxWidth="3xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Banner */}
        <div className="p-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="text-xs space-y-1">
            <p className="font-semibold text-indigo-200">Gói Vay Tài Chính & Lịch Trả Nợ Tự Động</p>
            <p className="text-slate-400">
              Hệ thống tự động sinh lịch trả nợ từng kỳ. Khi ngân hàng điều chỉnh lãi suất thả nổi, bạn có thể cập nhật để hệ thống tự tính lại cho các kỳ chưa thanh toán.
            </p>
          </div>
        </div>

        {/* 1. Basic Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Input
              label="Tên Gói Vay / Khoản Vay"
              placeholder="VD: Vay Mua Nhà VPBank, Vay Tiêu Dùng HSBC..."
              value={loanName}
              onChange={(e) => {
                setLoanName(e.target.value);
                if (errors.loanName) setErrors((prev) => ({ ...prev, loanName: undefined }));
              }}
              error={errors.loanName}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Ngân Hàng / Tổ Chức Tín Dụng
            </label>
            <Select
              value={institutionId}
              onChange={(e) => setInstitutionId(e.target.value)}
              options={[
                { value: "", label: "-- Chọn Ngân Hàng / Tổ Chức --" },
                ...institutions.map((i: Institution) => ({
                  value: i.id,
                  label: `${i.short_name || i.name} (${i.code})`,
                })),
              ]}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Loại Khoản Vay
            </label>
            <Select
              value={loanType}
              onChange={(e) => setLoanType(e.target.value as LoanType)}
              options={LOAN_TYPES}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Tài Khoản Liên Kết (Trích Nợ / Nhận Nợ)
            </label>
            <Select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              options={[
                { value: "", label: "-- Không liên kết tài khoản --" },
                ...accounts
                  .filter((a: Account) => a.status === "ACTIVE")
                  .map((a: Account) => ({
                    value: a.id,
                    label: formatAccountLabel(a),
                  })),
              ]}
            />
          </div>

          <div>
            <Input
              label="Mã Hợp Đồng Vay (Nếu có)"
              placeholder="VD: HDV-2026-VPB-01"
              value={loanCode}
              onChange={(e) => setLoanCode(e.target.value)}
            />
          </div>
        </div>

        {/* 2. Financial Parameters */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Thông Số Tài Chính & Lãi Suất</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Số Tiền Vay Gốc (VNĐ) <span className="text-rose-400">*</span>
              </label>
              <CurrencyInput
                value={principalAmount}
                onValueChange={(val) => {
                  setPrincipalAmount(val ?? "");
                  if (errors.principalAmount) setErrors((prev) => ({ ...prev, principalAmount: undefined }));
                }}
                error={errors.principalAmount}
                placeholder="100,000,000"
              />
            </div>

            <div>
              <Input
                label="Thời Hạn Vay (Tháng)"
                type="number"
                min="1"
                max="600"
                value={termMonths}
                onChange={(e) => {
                  setTermMonths(e.target.value);
                  if (errors.termMonths) setErrors((prev) => ({ ...prev, termMonths: undefined }));
                }}
                error={errors.termMonths}
                required
              />
            </div>

            <div>
              <Input
                label="Lãi Suất Ban Đầu (% / Năm)"
                type="number"
                step="any"
                min="0"
                max="100"
                placeholder="VD: 8.5 hoặc 8.525"
                value={interestRate}
                onChange={(e) => {
                  setInterestRate(e.target.value);
                  if (errors.interestRate) setErrors((prev) => ({ ...prev, interestRate: undefined }));
                }}
                error={errors.interestRate}
                required
              />
            </div>

            <div>
              <Input
                label="Ngày Giải Ngân / Bắt Đầu"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (errors.startDate) setErrors((prev) => ({ ...prev, startDate: undefined }));
                }}
                error={errors.startDate}
                required
              />
            </div>

            <div>
              <Input
                label="Ngày Trả Nợ Hàng Tháng"
                type="number"
                min="1"
                max="31"
                value={billingDay}
                onChange={(e) => {
                  setBillingDay(e.target.value);
                  if (errors.billingDay) setErrors((prev) => ({ ...prev, billingDay: undefined }));
                }}
                error={errors.billingDay}
                placeholder="15"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Phí Dịch Vụ / Quản Lý Hàng Tháng (VNĐ)
              </label>
              <CurrencyInput
                value={monthlyFee}
                onValueChange={(val) => {
                  setMonthlyFee(val ?? 0);
                  if (errors.monthlyFee) setErrors((prev) => ({ ...prev, monthlyFee: undefined }));
                }}
                error={errors.monthlyFee}
                placeholder="VD: 12,000"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Phương Thức Tính Lãi
              </label>
              <Select
                value={interestMethod}
                onChange={(e) => setInterestMethod(e.target.value as InterestMethod)}
                options={INTEREST_METHODS}
              />
            </div>

            <div className="sm:col-span-3">
              <Input
                label="Ghi Chú Gói Vay"
                placeholder="VD: Ưu đãi 6.5% trong 12 tháng đầu, sau đó thả nổi = LSTK 12T + biên độ 3.5%..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* 3. Live Preview Card */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200">Dự Tính Thanh Toán & Trả Nợ</span>
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              <span>{showPreview ? "Thu gọn bảng kỳ" : "Xem chi tiết bảng phân bổ kỳ"}</span>
              {showPreview ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-400 block mb-0.5">Kỳ Đầu Tiên Ước Tính</span>
              <span className="text-sm font-bold text-emerald-400">{formatCurrency(preview.firstPayment)}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-400 block mb-0.5">Tổng Lãi Dự Kiến</span>
              <span className="text-sm font-bold text-amber-400">{formatCurrency(preview.totalInterest)}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-400 block mb-0.5">Tổng Gốc + Lãi + Phí</span>
              <span className="text-sm font-bold text-indigo-400">
                {formatCurrency(parseNumeric(principalAmount) + preview.totalInterest + preview.totalFee)}
              </span>
            </div>
          </div>

          {/* Collapsible preview table */}
          {showPreview && preview.schedules.length > 0 && (
            <div className="mt-3 border border-slate-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-[11px] text-left">
                <thead className="bg-slate-950 text-slate-400 sticky top-0">
                  <tr>
                    <th className="p-2">Kỳ</th>
                    <th className="p-2 text-right">Gốc</th>
                    <th className="p-2 text-right">Lãi</th>
                    <th className="p-2 text-right">Tổng kỳ</th>
                    <th className="p-2 text-right">Dư nợ cuối</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {preview.schedules.slice(0, 24).map((s) => (
                    <tr key={s.index} className="hover:bg-slate-800/40">
                      <td className="p-2 font-mono text-slate-300">#{s.index}</td>
                      <td className="p-2 text-right font-mono text-slate-200">{formatCurrency(s.principal)}</td>
                      <td className="p-2 text-right font-mono text-amber-300">{formatCurrency(s.interest)}</td>
                      <td className="p-2 text-right font-mono font-bold text-emerald-300">{formatCurrency(s.total)}</td>
                      <td className="p-2 text-right font-mono text-slate-400">{formatCurrency(s.endingBalance)}</td>
                    </tr>
                  ))}
                  {preview.schedules.length > 24 && (
                    <tr>
                      <td colSpan={5} className="p-2 text-center text-slate-500 italic bg-slate-950/40">
                        ... và {preview.schedules.length - 24} kỳ tiếp theo
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Hủy Bỏ
          </Button>
          <Button
            type="submit"
            isLoading={createLoanMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
          >
            Khởi Tạo Gói Vay
          </Button>
        </div>
      </form>
    </Modal>
  );
};
