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
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Calculation for live amortization preview
  const preview = useMemo(() => {
    const p0 = Number(principalAmount) || 0;
    const term = Number(termMonths) || 1;
    const rate = Number(interestRate) || 0;
    const fee = Number(monthlyFee) || 0;
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
    const newErrors: Record<string, string> = {};

    if (!loanName.trim()) newErrors.loanName = "Vui lòng nhập tên gói vay";
    const p = Number(principalAmount);
    if (isNaN(p) || p <= 0) newErrors.principalAmount = "Số tiền vay phải lớn hơn 0";
    const t = Number(termMonths);
    if (isNaN(t) || t <= 0) newErrors.termMonths = "Thời hạn vay phải lớn hơn 0 tháng";
    const r = Number(interestRate);
    if (isNaN(r) || r < 0) newErrors.interestRate = "Lãi suất không hợp lệ";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const payload: LoanCreatePayload = {
      loan_name: loanName.trim(),
      loan_code: loanCode.trim() || undefined,
      institution_id: institutionId || undefined,
      account_id: accountId || undefined,
      loan_type: loanType,
      interest_method: interestMethod,
      principal_amount: p,
      term_months: t,
      monthly_fee: Number(monthlyFee) || 0,
      start_date: startDate,
      billing_day_of_month: Number(billingDay) || 15,
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
                if (errors.loanName) setErrors((prev) => ({ ...prev, loanName: "" }));
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
                ...accounts.map((a: Account) => ({
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
                onChange={(val) => {
                  setPrincipalAmount(val);
                  if (errors.principalAmount) setErrors((prev) => ({ ...prev, principalAmount: "" }));
                }}
                placeholder="100,000,000"
              />
              {errors.principalAmount && <p className="text-xs text-rose-400 mt-1">{errors.principalAmount}</p>}
            </div>

            <div>
              <Input
                label="Thời Hạn Vay (Tháng)"
                type="number"
                min="1"
                max="360"
                value={termMonths}
                onChange={(e) => {
                  setTermMonths(e.target.value);
                  if (errors.termMonths) setErrors((prev) => ({ ...prev, termMonths: "" }));
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
                  if (errors.interestRate) setErrors((prev) => ({ ...prev, interestRate: "" }));
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
                onChange={(e) => setStartDate(e.target.value)}
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
                onChange={(e) => setBillingDay(e.target.value)}
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
                onChange={(val) => setMonthlyFee(val)}
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
          </div>
        </div>

        {/* 3. Live Amortization Summary Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">Ước Tính Thanh Toán Kỳ Đầu & Tổng Tiền Lãi</span>
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
            >
              {showPreview ? "Ẩn bảng lịch trình" : "Xem bảng lịch trình"}
              {showPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-[11px] text-slate-400 block">Kỳ Đầu Phải Trả</span>
              <span className="text-base font-bold font-mono text-emerald-400">
                {formatCurrency(preview.firstPayment)}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-[11px] text-slate-400 block">Tiền Gốc / Tháng</span>
              <span className="text-base font-bold font-mono text-slate-200">
                {formatCurrency(Math.round(Number(principalAmount) / (Number(termMonths) || 1)))}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 col-span-2 sm:col-span-1">
              <span className="text-[11px] text-slate-400 block">Tổng Lãi Dự Tính</span>
              <span className="text-base font-bold font-mono text-amber-400">
                {formatCurrency(preview.totalInterest)}
              </span>
            </div>
          </div>

          {/* Collapsible preview table */}
          {showPreview && (
            <div className="mt-3 max-h-48 overflow-y-auto rounded-xl border border-slate-800 text-xs">
              <table className="w-full text-left font-mono">
                <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase sticky top-0">
                  <tr>
                    <th className="py-2 px-2.5">Kỳ</th>
                    <th className="py-2 px-2.5 text-right">Tiền Gốc</th>
                    <th className="py-2 px-2.5 text-right">Lãi Suất</th>
                    <th className="py-2 px-2.5 text-right">Tiền Lãi</th>
                    <th className="py-2 px-2.5 text-right">Tổng Trả</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {preview.schedules.map((s) => (
                    <tr key={s.index} className="hover:bg-slate-800/40">
                      <td className="py-1.5 px-2.5 text-slate-300">Kỳ {s.index}</td>
                      <td className="py-1.5 px-2.5 text-right text-slate-200">{formatCurrency(s.principal)}</td>
                      <td className="py-1.5 px-2.5 text-right text-amber-300">{formatRate(interestRate)}</td>
                      <td className="py-1.5 px-2.5 text-right text-amber-400 font-medium">{formatCurrency(s.interest)}</td>
                      <td className="py-1.5 px-2.5 text-right font-bold text-emerald-400">{formatCurrency(s.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 4. Note */}
        <Input
          label="Ghi Chú Thêm (Tùy chọn)"
          placeholder="VD: Vay thế chấp sổ đỏ kỳ hạn 3 năm, ưu đãi 1 năm đầu..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy Bỏ
          </Button>
          <Button type="submit" variant="primary" isLoading={createLoanMutation.isPending}>
            Tạo Gói Vay & Sinh Lịch Trình
          </Button>
        </div>
      </form>
    </Modal>
  );
};
