import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Coins,
  CreditCard,
  Globe,
  Percent,
  Plus,
  Receipt,
  Search,
  Sparkles,
  Zap,
} from "lucide-react";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { CurrencyInput } from "../common/CurrencyInput";
import { Input } from "../common/Input";
import { Modal } from "../common/Modal";
import { Select } from "../common/Select";
import { useToast } from "../../context/ToastContext";
import { useCreateTransaction } from "../../hooks/useFinanceMutations";
import {
  useAccountLiveBalances,
  useAccounts,
  useCategories,
  useCategoryTree,
  useInstallments,
  useMerchantSuggestions,
  useStatementPaymentStatus,
} from "../../hooks/useFinanceQueries";
import { recommendationService } from "../../services/recommendationService";
import { Account, AccountLiveBalance } from "../../types/account";
import { Category, CategoryTreeNode } from "../../types/category";
import { InstallmentPlan } from "../../types/installment";
import { MerchantSuggestion } from "../../types/merchant";
import { StatementPaymentStatus } from "../../types/statement";
import {
  TransactionCreatePayload,
  TransactionType,
} from "../../types/transaction";
import { CardRecommendationItem } from "../../types/cardRecommendation";
import { formatCurrency, formatDate } from "../../utils/formatters";
import {
  inferTransactionTypeFromCategory,
  resolveCategoryHierarchy,
} from "../../utils/categoryHelpers";

interface SmartCreateTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultAccountId?: string;
}

// Preset Quick Chips
interface PresetChip {
  id: string;
  icon: string;
  label: string;
  type: TransactionType;
  categoryKeyword: string;
  defaultDesc: string;
  color: string;
}

const PRESET_CHIPS: PresetChip[] = [
  {
    id: "income",
    icon: "💰",
    label: "Lương & Thu nhập",
    type: "INCOME",
    categoryKeyword: "Lương",
    defaultDesc: "Nhận tiền lương chuyển khoản",
    color: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20",
  },
  {
    id: "transfer",
    icon: "🔄",
    label: "Chuyển tiền / Rút ATM",
    type: "TRANSFER",
    categoryKeyword: "Chuyển khoản",
    defaultDesc: "Rút tiền mặt ATM / Chuyển khoản nội bộ",
    color: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/20",
  },
  {
    id: "fnb",
    icon: "☕",
    label: "Cà phê & Ăn uống",
    type: "PURCHASE",
    categoryKeyword: "Nhà hàng",
    defaultDesc: "STARBUCKS COFFEE",
    color: "bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20",
  },
  {
    id: "supermarket",
    icon: "🛒",
    label: "Siêu thị & Tiêu dùng",
    type: "PURCHASE",
    categoryKeyword: "Siêu thị",
    defaultDesc: "MINISTOP / WINMART",
    color: "bg-teal-500/10 text-teal-300 border-teal-500/30 hover:bg-teal-500/20",
  },
  {
    id: "online",
    icon: "📦",
    label: "Mua sắm Online / TMĐT",
    type: "PURCHASE",
    categoryKeyword: "Thương mại điện tử",
    defaultDesc: "SHOPEE PAY / LAZADA",
    color: "bg-sky-500/10 text-sky-300 border-sky-500/30 hover:bg-sky-500/20",
  },
  {
    id: "transport",
    icon: "🚗",
    label: "Xăng xe & Grab",
    type: "PURCHASE",
    categoryKeyword: "Giao thông",
    defaultDesc: "GRAB RIDE / PETROLIMEX",
    color: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/20",
  },
  {
    id: "repayment",
    icon: "💳",
    label: "Thanh toán nợ thẻ",
    type: "REPAYMENT",
    categoryKeyword: "Thanh toán",
    defaultDesc: "Thanh toán dư nợ sao kê",
    color: "bg-teal-500/10 text-teal-300 border-teal-500/30 hover:bg-teal-500/20",
  },
  {
    id: "fee",
    icon: "🏷️",
    label: "Phí dịch vụ / SMS",
    type: "FEE",
    categoryKeyword: "Phí & Lãi",
    defaultDesc: "Phí dịch vụ tài khoản",
    color: "bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/20",
  },
];

const CURRENCIES = [
  { code: "VND", name: "Việt Nam Đồng (₫)", rate: 1.0 },
  { code: "USD", name: "US Dollar ($)", rate: 25450.0 },
  { code: "EUR", name: "Euro (€)", rate: 27800.0 },
  { code: "JPY", name: "Japanese Yen (¥)", rate: 172.0 },
  { code: "SGD", name: "Singapore Dollar (S$)", rate: 19200.0 },
  { code: "GBP", name: "British Pound (£)", rate: 32600.0 },
  { code: "AUD", name: "Australian Dollar (A$)", rate: 16800.0 },
  { code: "KRW", name: "Korean Won (₩)", rate: 18.5 },
  { code: "THB", name: "Thai Baht (฿)", rate: 740.0 },
];

const TRANSACTION_TYPES: { value: TransactionType; label: string }[] = [
  { value: "PURCHASE", label: "Chi tiêu mua sắm thông thường (+)" },
  { value: "INCOME", label: "Khoản thu nhập (Lương, Thưởng, Tiền lãi...) (+)" },
  { value: "TRANSFER", label: "Chuyển tiền giữa các tài khoản / ví" },
  { value: "REPAYMENT", label: "Thanh toán dư nợ thẻ / Nạp tiền (-)" },
  { value: "INSTALLMENT_MONTHLY", label: "Trả góp định kỳ hàng tháng (+)" },
  { value: "INSTALLMENT_PRINCIPAL", label: "Ghi có chuyển đổi trả góp (-)" },
  { value: "FEE", label: "Phí dịch vụ / Phí thường niên (+)" },
  { value: "INTEREST", label: "Lãi suất phát sinh (+)" },
  { value: "REFUND", label: "Hoàn tiền đơn hàng hủy (-)" },
  { value: "CASHBACK_CREDIT", label: "Tiền hoàn Cashback ghi có (-)" },
  { value: "CASH_ADVANCE", label: "Ứng tiền mặt qua thẻ (+)" },
  { value: "ADJUSTMENT", label: "Điều chỉnh giao dịch" },
];

export const SmartCreateTransactionModal: React.FC<
  SmartCreateTransactionModalProps
> = ({ isOpen, onClose, defaultAccountId }) => {
  const { toast } = useToast();

  // Queries
  const { data: accounts = [] } = useAccounts();
  const { data: liveBalances = [] } = useAccountLiveBalances();
  const { data: categories = [] } = useCategories();
  const { data: categoryTree = [] } = useCategoryTree();
  const { data: merchantSuggestions = [] } = useMerchantSuggestions();

  // Filter only ACTIVE accounts
  const activeAccounts = useMemo(
    () => accounts.filter((a: Account) => a.status === "ACTIVE"),
    [accounts]
  );

  // Mutations
  const createMutation = useCreateTransaction();

  // Form State
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [transactionDate, setTransactionDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [rawDescription, setRawDescription] = useState<string>("");
  const [selectedMerchantId, setSelectedMerchantId] = useState<string>("");
  const [selectedMerchantName, setSelectedMerchantName] = useState<string>("");
  const [transactionType, setTransactionType] =
    useState<TransactionType>("PURCHASE");
  const [parentCategoryId, setParentCategoryId] = useState<string>("");
  const [subCategoryId, setSubCategoryId] = useState<string>("");
  const [showAdvancedTxType, setShowAdvancedTxType] = useState<boolean>(false);

  // Currency & Multi-Currency State
  const [isForeignCurrency, setIsForeignCurrency] = useState<boolean>(false);
  const [currencyCode, setCurrencyCode] = useState<string>("USD");
  const [foreignAmount, setForeignAmount] = useState<string>("");
  const [exchangeRate, setExchangeRate] = useState<number>(25450.0);
  const [foreignFeePercent, setForeignFeePercent] = useState<number>(2.5);

  // VND amounts
  const [amountVND, setAmountVND] = useState<string>("");
  const [feeVND, setFeeVND] = useState<string>("0");

  // Installment State
  const [isInstallment, setIsInstallment] = useState<boolean>(false);
  const [installmentTerm, setInstallmentTerm] = useState<number>(3);
  const [installmentFee, setInstallmentFee] = useState<string>("0");
  const [installmentProductName, setInstallmentProductName] =
    useState<string>("");
  const [selectedInstallmentPlanId, setSelectedInstallmentPlanId] =
    useState<string>("");

  // Transfer State
  const [transferToAccountId, setTransferToAccountId] = useState<string>("");

  // Installment plans for the selected account (when INSTALLMENT_MONTHLY is chosen)
  const { data: accountInstallments = [] } = useInstallments(
    selectedAccountId || undefined
  );

  // Statement Settlement State
  const [settlesStatementId, setSettlesStatementId] = useState<string>("");

  const [note, setNote] = useState<string>("");
  const [errors, setCreateErrors] = useState<Record<string, string>>({});

  // Autocomplete UI State
  const [isSearchingMerchant, setIsSearchingMerchant] =
    useState<boolean>(false);
  const merchantDropdownRef = useRef<HTMLDivElement>(null);

  // Recommendations State
  const [recommendation, setRecommendation] =
    useState<CardRecommendationItem | null>(null);

  // Statements for selected account (when REPAYMENT is chosen)
  const { data: paymentStatuses = [] } = useStatementPaymentStatus(
    selectedAccountId || undefined
  );
  const pendingStatements = useMemo(
    () =>
      paymentStatuses.filter(
        (st: StatementPaymentStatus) =>
          st.payment_status !== "PAID" || Number(st.remaining_balance_to_pay) > 0
      ),
    [paymentStatuses]
  );

  // Set default account on load / change
  useEffect(() => {
    if (defaultAccountId) {
      setSelectedAccountId(defaultAccountId);
    } else if (activeAccounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(activeAccounts[0].id);
    }
  }, [defaultAccountId, activeAccounts, selectedAccountId]);

  // Click outside to close merchant autocomplete
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        merchantDropdownRef.current &&
        !merchantDropdownRef.current.contains(event.target as Node)
      ) {
        setIsSearchingMerchant(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update Exchange Rate when Currency changes
  const handleCurrencyChange = (code: string) => {
    setCurrencyCode(code);
    const curr = CURRENCIES.find((c) => c.code === code);
    if (curr) {
      setExchangeRate(curr.rate);
    }
  };

  // Recalculate VND Amount when Foreign Currency input changes
  useEffect(() => {
    if (isForeignCurrency) {
      const fAmt = parseFloat(foreignAmount) || 0;
      if (fAmt > 0 && exchangeRate > 0) {
        const baseVND = Math.round(fAmt * exchangeRate);
        const fFee = Math.round(baseVND * (foreignFeePercent / 100));
        setAmountVND(String(baseVND));
        setFeeVND(String(fFee));
      } else {
        setAmountVND("");
        setFeeVND("0");
      }
    }
  }, [isForeignCurrency, foreignAmount, exchangeRate, foreignFeePercent]);

  const effectiveCategoryId = useMemo(() => {
    return subCategoryId || parentCategoryId || "";
  }, [subCategoryId, parentCategoryId]);

  const selectedParent = useMemo(() => {
    return categoryTree.find((p: CategoryTreeNode) => p.id === parentCategoryId);
  }, [categoryTree, parentCategoryId]);

  const currentCategory = useMemo(() => {
    if (!effectiveCategoryId) return null;
    return categories.find((c: Category) => c.id === effectiveCategoryId) || null;
  }, [effectiveCategoryId, categories]);

  // Set default category when modal opens
  useEffect(() => {
    if (isOpen && categoryTree.length > 0 && !parentCategoryId) {
      const expenseParent =
        categoryTree.find((p: CategoryTreeNode) => p.category_type === "EXPENSE") ||
        categoryTree[0];
      setParentCategoryId(expenseParent.id);
      setSubCategoryId("");
      setTransactionType(inferTransactionTypeFromCategory(expenseParent));
    }
  }, [isOpen, categoryTree, parentCategoryId]);

  // Filtered Merchant Suggestions based on rawDescription
  const filteredMerchants = useMemo(() => {
    if (!rawDescription.trim()) return merchantSuggestions.slice(0, 8);
    const q = rawDescription.toLowerCase().trim();
    return merchantSuggestions
      .filter((m: MerchantSuggestion) => {
        const nameMatch = m.cleaned_name.toLowerCase().includes(q);
        const aliasMatch = m.aliases.some((a) => a.toLowerCase().includes(q));
        return nameMatch || aliasMatch;
      })
      .slice(0, 8);
  }, [merchantSuggestions, rawDescription]);

  // Contextual side effects when transaction type changes
  const applyTypeSideEffects = (newType: TransactionType) => {
    if (newType === "REPAYMENT") {
      setIsInstallment(false);
      setSelectedInstallmentPlanId("");
      if (pendingStatements.length > 0) {
        setSettlesStatementId(pendingStatements[0].statement_id);
        if (
          (!amountVND || parseFloat(amountVND) <= 0) &&
          Number(pendingStatements[0].remaining_balance_to_pay) > 0
        ) {
          setAmountVND(String(pendingStatements[0].remaining_balance_to_pay));
        }
      }
    } else if (newType === "INSTALLMENT_MONTHLY") {
      setIsInstallment(false);
      setSettlesStatementId("");
      if (accountInstallments.length > 0) {
        const activePlan =
          accountInstallments.find(
            (p: InstallmentPlan) => p.status === "ACTIVE"
          ) || accountInstallments[0];
        setSelectedInstallmentPlanId(activePlan.id);
        if (!amountVND || parseFloat(amountVND) <= 0) {
          setAmountVND(String(activePlan.monthly_payment));
        }
      }
    } else {
      setSettlesStatementId("");
      setSelectedInstallmentPlanId("");
    }
  };

  // Explicit or programmatic transaction type change handler
  const handleTransactionTypeChange = (newType: TransactionType) => {
    setTransactionType(newType);
    applyTypeSideEffects(newType);
  };

  // Helper to set category hierarchy & infer type from category ID
  const setCategoryFromId = (catId: string) => {
    if (!catId) {
      setParentCategoryId("");
      setSubCategoryId("");
      return;
    }
    const hierarchy = resolveCategoryHierarchy(catId, categories, categoryTree);
    setParentCategoryId(hierarchy.parentId);
    setSubCategoryId(hierarchy.subId);

    const targetCat = categories.find((c: Category) => c.id === catId);
    if (targetCat) {
      const inferred = inferTransactionTypeFromCategory(targetCat);
      setTransactionType(inferred);
      applyTypeSideEffects(inferred);
    }
  };

  // Parent Category Change Handler (Cấp 1)
  const handleParentCategoryChange = (newParentId: string) => {
    setParentCategoryId(newParentId);
    setSubCategoryId("");

    if (!newParentId) return;

    const parentNode = categoryTree.find(
      (p: CategoryTreeNode) => p.id === newParentId
    );
    if (parentNode) {
      const inferred = inferTransactionTypeFromCategory(parentNode);
      setTransactionType(inferred);
      applyTypeSideEffects(inferred);
    }
  };

  // Subcategory Change Handler (Cấp 2)
  const handleSubCategoryChange = (newSubId: string) => {
    setSubCategoryId(newSubId);

    const targetId = newSubId || parentCategoryId;
    if (!targetId) return;

    const targetCat = categories.find((c: Category) => c.id === targetId);
    if (targetCat) {
      const inferred = inferTransactionTypeFromCategory(targetCat);
      setTransactionType(inferred);
      applyTypeSideEffects(inferred);
    }
  };

  // Preset Chip Click Handler
  const handleApplyPreset = (chip: PresetChip) => {
    setRawDescription(chip.defaultDesc);
    setSelectedMerchantName(chip.defaultDesc.split(" ")[0]);

    if (chip.categoryKeyword) {
      const kw = chip.categoryKeyword.toLowerCase();
      const found = categories.find((c: Category) =>
        c.name.toLowerCase().includes(kw)
      );
      if (found) {
        setCategoryFromId(found.id);
        return;
      }
    }
    handleTransactionTypeChange(chip.type);
  };

  // Merchant Autocomplete Select
  const handleSelectMerchant = (m: MerchantSuggestion) => {
    setRawDescription(m.cleaned_name);
    setSelectedMerchantId(m.id);
    setSelectedMerchantName(m.cleaned_name);
    setIsSearchingMerchant(false);

    if (m.default_category_id) {
      setCategoryFromId(m.default_category_id);
    }
  };

  // Live Card Recommendation Engine In-Modal
  const parsedAmtVND = parseFloat(amountVND) || 0;
  const selectedCategoryLabel = useMemo(() => {
    if (!currentCategory) return "";
    return currentCategory.name;
  }, [currentCategory]);

  useEffect(() => {
    let isMounted = true;
    if (
      parsedAmtVND > 0 &&
      (selectedCategoryLabel || selectedMerchantName || rawDescription)
    ) {
      const timer = setTimeout(async () => {
        try {
          const res = await recommendationService.getBestCard({
            amount: parsedAmtVND,
            category_id: effectiveCategoryId || undefined,
            category_name: selectedCategoryLabel || undefined,
            merchant_name:
              selectedMerchantName || rawDescription.trim() || undefined,
          });
          if (isMounted && res.best_choice) {
            setRecommendation(res.best_choice);
          }
        } catch {
          // ignore error
        }
      }, 300);
      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    } else {
      setRecommendation(null);
    }
  }, [parsedAmtVND, effectiveCategoryId, selectedCategoryLabel, selectedMerchantName, rawDescription]);

  // Validation
  const validateForm = () => {
    const errs: Record<string, string> = {};
    if (!selectedAccountId) {
      errs.account_id = "Vui lòng chọn tài khoản / thẻ tín dụng";
    }
    if (!transactionDate) {
      errs.transaction_date = "Vui lòng chọn ngày giao dịch";
    }
    if (!amountVND || parsedAmtVND <= 0) {
      errs.amount = "Số tiền giao dịch phải lớn hơn 0 VNĐ";
    }
    if (isForeignCurrency && (!foreignAmount || parseFloat(foreignAmount) <= 0)) {
      errs.foreign_amount = "Vui lòng nhập số tiền nguyên tệ hợp lệ";
    }
    setCreateErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Form Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const baseAmount = parseFloat(amountVND) || 0;
    const feeAmount = parseFloat(feeVND) || 0;

    const payload: TransactionCreatePayload = {
      account_id: selectedAccountId,
      transaction_date: transactionDate,
      post_date: transactionDate,
      raw_description: rawDescription.trim() || undefined,
      merchant_id: selectedMerchantId || undefined,
      merchant_name: selectedMerchantName || undefined,
      category_id: effectiveCategoryId || undefined,
      transaction_type: transactionType,
      amount: baseAmount,
      fee: feeAmount,
      total_amount: baseAmount + feeAmount,
      note: note.trim() || undefined,
    };

    // Foreign currency fields
    if (isForeignCurrency) {
      payload.original_amount = parseFloat(foreignAmount) || baseAmount;
      payload.original_currency = currencyCode;
      payload.exchange_rate = exchangeRate;
      payload.foreign_fee = feeAmount;
    }

    // Installment fields
    if (isInstallment && transactionType === "PURCHASE") {
      payload.convert_to_installment = {
        product_name:
          installmentProductName.trim() || rawDescription.trim() || "Gói trả góp 0%",
        term_months: Number(installmentTerm),
        conversion_fee: parseFloat(installmentFee) || 0,
        interest_rate_percent: 0,
      };
    } else if (transactionType === "INSTALLMENT_MONTHLY") {
      if (selectedInstallmentPlanId) {
        payload.installment_plan_id = selectedInstallmentPlanId;
      }
      payload.is_installment = true;
    }

    // Settlement statement link
    if (transactionType === "REPAYMENT" && settlesStatementId) {
      payload.settles_statement_id = settlesStatementId;
    }

    // Transfer target account link
    if (transactionType === "TRANSFER" && transferToAccountId) {
      payload.transfer_to_account_id = transferToAccountId;
    }

    try {
      await createMutation.mutateAsync(payload);
      toast.success(
        isInstallment
          ? "Tạo giao dịch và tự động lập gói trả góp thành công!"
          : transactionType === "INSTALLMENT_MONTHLY" && selectedInstallmentPlanId
          ? "Tạo giao dịch và liên kết vào gói trả góp thành công!"
          : transactionType === "TRANSFER"
          ? "Chuyển tiền giữa các tài khoản thành công!"
          : transactionType === "INCOME"
          ? "Ghi nhận khoản thu nhập thành công!"
          : "Tạo giao dịch mới thành công!"
      );
      onClose();
      // Reset form
      setRawDescription("");
      setSelectedMerchantId("");
      setSelectedMerchantName("");
      setAmountVND("");
      setFeeVND("0");
      setForeignAmount("");
      setIsForeignCurrency(false);
      setIsInstallment(false);
      setSelectedInstallmentPlanId("");
      setTransferToAccountId("");
      setNote("");
      setSettlesStatementId("");
    } catch (err: any) {
      toast.error(`Lỗi tạo giao dịch: ${err.message}`);
    }
  };

  // Current selected account live balance data
  const currentLiveAccount = useMemo(() => {
    return liveBalances.find(
      (b: AccountLiveBalance) => b.account_id === selectedAccountId
    );
  }, [liveBalances, selectedAccountId]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Thêm Giao Dịch Mới Thông Minh"
      maxWidth="4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Top: Preset Quick Chips Bar */}
        <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
          <label className="block text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Mẫu Giao Dịch Nhanh (1-Chạm):</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_CHIPS.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => handleApplyPreset(chip)}
                className={`px-2.5 py-1 rounded-xl border text-xs font-medium transition-all flex items-center gap-1.5 ${chip.color}`}
              >
                <span>{chip.icon}</span>
                <span>{chip.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 2-Column Responsive Layout for Desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* ================= LEFT COLUMN: Core Transaction Details (7 Cols) ================= */}
          <div className="lg:col-span-7 space-y-4">
            {/* Account & Date Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Account Picker */}
              <div>
                <Select
                  label="Tài Khoản / Thẻ Tín Dụng"
                  value={selectedAccountId}
                  onChange={(e) => {
                    setSelectedAccountId(e.target.value);
                    if (errors.account_id)
                      setCreateErrors((prev) => ({ ...prev, account_id: "" }));
                  }}
                  error={errors.account_id}
                  options={
                    activeAccounts.length > 0
                      ? activeAccounts.map((a: Account) => ({
                          value: a.id,
                          label: `${a.account_name} (•••• ${a.card_number_last4})`,
                        }))
                      : [
                          {
                            value: "",
                            label: "Không có thẻ đang hoạt động",
                            disabled: true,
                          },
                        ]
                  }
                  required
                />
                {currentLiveAccount && (
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 px-1">
                    <span>
                      Khả dụng:{" "}
                      <strong className="text-emerald-400 font-mono">
                        {formatCurrency(currentLiveAccount.live_available_limit)}
                      </strong>
                    </span>
                    <span
                      className={
                        currentLiveAccount.live_risk_level.includes("CRITICAL")
                          ? "text-rose-400 font-bold"
                          : "text-slate-400"
                      }
                    >
                      Dư nợ: {Number(currentLiveAccount.live_utilization_percentage).toFixed(0)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Date Picker + Quick Buttons */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-400">
                    Ngày Giao Dịch
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setTransactionDate(new Date().toISOString().split("T")[0])
                      }
                      className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-emerald-400 hover:bg-slate-700"
                    >
                      Hôm nay
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const yesterday = new Date();
                        yesterday.setDate(yesterday.getDate() - 1);
                        setTransactionDate(yesterday.toISOString().split("T")[0]);
                      }}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-emerald-400 hover:bg-slate-700"
                    >
                      Hôm qua
                    </button>
                  </div>
                </div>
                <Input
                  type="date"
                  value={transactionDate}
                  onChange={(e) => {
                    setTransactionDate(e.target.value);
                    if (errors.transaction_date)
                      setCreateErrors((prev) => ({
                        ...prev,
                        transaction_date: "",
                      }));
                  }}
                  error={errors.transaction_date}
                  required
                />
              </div>
            </div>

            {/* Smart Merchant Autocomplete Input (Optional) */}
            <div className="relative" ref={merchantDropdownRef}>
              <Input
                label="Nội Dung / Đơn Vị Chấp Nhận Thẻ (Tùy chọn)"
                placeholder="Tùy chọn: STARBUCKS, Cafe vỉa hè, Tiền chợ, Bún bò..."
                value={rawDescription}
                onChange={(e) => {
                  setRawDescription(e.target.value);
                  setSelectedMerchantName(e.target.value);
                  setIsSearchingMerchant(true);
                  if (errors.raw_description)
                    setCreateErrors((prev) => ({
                      ...prev,
                      raw_description: "",
                    }));
                }}
                onFocus={() => setIsSearchingMerchant(true)}
                leftIcon={<Search className="w-4 h-4 text-emerald-400" />}
                error={errors.raw_description}
              />

              {/* Autocomplete Dropdown List */}
              {isSearchingMerchant && filteredMerchants.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-52 overflow-y-auto divide-y divide-slate-800/60">
                  <div className="p-2 bg-slate-950/80 text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center justify-between">
                    <span>Gợi ý Đơn Vị từ Cơ Sở Dữ Liệu</span>
                    <span>{filteredMerchants.length} kết quả</span>
                  </div>
                  {filteredMerchants.map((m: MerchantSuggestion) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSelectMerchant(m)}
                      className="w-full text-left p-2.5 hover:bg-emerald-500/10 hover:text-emerald-300 transition-colors flex items-center justify-between group"
                    >
                      <div>
                        <div className="text-xs font-semibold text-slate-100 group-hover:text-emerald-300">
                          {m.cleaned_name}
                        </div>
                        {m.aliases.length > 0 && (
                          <div className="text-[10px] text-slate-400 truncate max-w-xs">
                            Alias: {m.aliases.slice(0, 2).join(", ")}
                          </div>
                        )}
                      </div>
                      {m.default_category_name && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          {m.default_category_name}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 2-Tier Hierarchical Category Picker (Nhóm Cha Cấp 1 & Danh Mục Con Cấp 2) */}
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Select
                    label="Nhóm Danh Mục Cha (Cấp 1)"
                    value={parentCategoryId}
                    onChange={(e) => handleParentCategoryChange(e.target.value)}
                    options={[
                      { value: "", label: "-- Chọn Nhóm Danh Mục Cha --" },
                      ...categoryTree.map((p: CategoryTreeNode) => ({
                        value: p.id,
                        label: p.name,
                      })),
                    ]}
                    required
                  />
                </div>

                <div>
                  <Select
                    label="Danh Mục Con (Cấp 2)"
                    value={subCategoryId}
                    onChange={(e) => handleSubCategoryChange(e.target.value)}
                    options={[
                      {
                        value: "",
                        label:
                          selectedParent && selectedParent.children && selectedParent.children.length > 0
                            ? "-- Chọn danh mục con (Cấp 2) --"
                            : selectedParent
                            ? `-- Dùng nhóm cha: ${selectedParent.name} --`
                            : "-- Vui lòng chọn nhóm cha trước --",
                      },
                      ...((selectedParent?.children || []).map((c: Category) => ({
                        value: c.id,
                        label: c.name,
                      }))),
                    ]}
                    disabled={!parentCategoryId}
                  />
                </div>
              </div>

              {/* Category Status & Inferred Transaction Type Info Badge */}
              {currentCategory && (
                <div className="flex items-center justify-between text-[11px] px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-300">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                      style={{
                        backgroundColor:
                          currentCategory.color || selectedParent?.color || "#10b981",
                      }}
                    />
                    <span className="truncate">
                      Đã chọn: <strong className="text-slate-100">{currentCategory.name}</strong>
                    </span>
                    <span className="text-slate-600 hidden sm:inline">•</span>
                    <span className="text-emerald-400 font-medium hidden sm:inline">
                      Nghiệp vụ: {TRANSACTION_TYPES.find((t) => t.value === transactionType)?.label.split(" (")[0] || transactionType}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedTxType(!showAdvancedTxType)}
                    className="text-[10px] text-slate-400 hover:text-emerald-300 underline shrink-0 ml-2"
                  >
                    {showAdvancedTxType ? "Ẩn nâng cao" : "Tuỳ chỉnh nâng cao"}
                  </button>
                </div>
              )}

              {/* Advanced Override for Transaction Type */}
              {showAdvancedTxType && (
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <Select
                    label="Tuỳ chỉnh Loại Giao Dịch Hệ Thống (Nâng cao)"
                    value={transactionType}
                    onChange={(e) =>
                      handleTransactionTypeChange(e.target.value as TransactionType)
                    }
                    options={TRANSACTION_TYPES}
                  />
                  <p className="text-[10px] text-slate-500 italic">
                    💡 Mặc định hệ thống tự động nhận diện loại giao dịch từ danh mục bạn chọn. Bạn chỉ cần can thiệp nếu cần ghi nhận trường hợp đặc biệt.
                  </p>
                </div>
              )}
            </div>

            {/* Transfer Target Account Picker */}
            {transactionType === "TRANSFER" && (
              <div className="p-3.5 rounded-2xl bg-cyan-950/20 border border-cyan-500/30">
                <Select
                  label="Chuyển tới Tài Khoản / Ví Nhận Tiền"
                  value={transferToAccountId}
                  onChange={(e) => setTransferToAccountId(e.target.value)}
                  options={[
                    { value: "", label: "-- Chọn tài khoản / ví đích --" },
                    ...activeAccounts
                      .filter((a: Account) => a.id !== selectedAccountId)
                      .map((a: Account) => ({
                        value: a.id,
                        label: `${a.account_name} (${a.card_number_masked || a.account_type})`,
                      })),
                  ]}
                  required
                />
                <p className="text-[11px] text-cyan-400/80 mt-1 px-1">
                  💡 Tiền sẽ được trừ khỏi tài khoản nguồn và cộng vào tài khoản đích.
                </p>
              </div>
            )}

            {/* Multi-Currency & Amount Inputs */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-200">
                    Số Tiền & Ngoại Tệ
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsForeignCurrency(!isForeignCurrency)}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-all flex items-center gap-1 border ${
                    isForeignCurrency
                      ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                      : "bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200"
                  }`}
                >
                  <Globe className="w-3 h-3" />
                  <span>
                    {isForeignCurrency ? "FX Đang Bật" : "Ngoại tệ (USD/EUR...)"}
                  </span>
                </button>
              </div>

              {isForeignCurrency ? (
                <div className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/30 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <Select
                      label="Ngoại Tệ"
                      value={currencyCode}
                      onChange={(e) => handleCurrencyChange(e.target.value)}
                      options={CURRENCIES.filter((c) => c.code !== "VND").map(
                        (c) => ({
                          value: c.code,
                          label: `${c.code}`,
                        })
                      )}
                    />

                    <Input
                      label={`Số Tiền (${currencyCode})`}
                      type="number"
                      step="any"
                      placeholder="19.99"
                      value={foreignAmount}
                      onChange={(e) => setForeignAmount(e.target.value)}
                      error={errors.foreign_amount}
                      required
                    />

                    <Input
                      label="Tỷ Giá (VNĐ)"
                      type="number"
                      value={exchangeRate}
                      onChange={(e) =>
                        setExchangeRate(parseFloat(e.target.value) || 0)
                      }
                      required
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-purple-500/20">
                    <span className="text-slate-400">
                      Phí FX ({foreignFeePercent}%):{" "}
                      <strong className="text-amber-400 font-mono">
                        {formatCurrency(Number(feeVND))}
                      </strong>
                    </span>
                    <span className="text-slate-300">
                      Tổng VNĐ:{" "}
                      <strong className="text-emerald-400 font-mono text-sm">
                        {formatCurrency(Number(amountVND) + Number(feeVND))}
                      </strong>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <CurrencyInput
                    label="Số Tiền Giao Dịch (VNĐ)"
                    placeholder="VD: 250,000"
                    value={amountVND}
                    onValueChange={(val) => {
                      setAmountVND(String(val));
                      if (errors.amount)
                        setCreateErrors((prev) => ({ ...prev, amount: "" }));
                    }}
                    onChangeRaw={(raw) => setAmountVND(raw)}
                    error={errors.amount}
                    required
                  />

                  <CurrencyInput
                    label="Phí Đi Kèm (VNĐ)"
                    placeholder="0"
                    value={feeVND}
                    onValueChange={(val) => setFeeVND(String(val))}
                    onChangeRaw={(raw) => setFeeVND(raw)}
                  />
                </div>
              )}
            </div>

            {/* Note */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Ghi Chú Cá Nhân
              </label>
              <textarea
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 transition-colors"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ghi chú thêm về mục đích chi tiêu..."
              />
            </div>
          </div>

          {/* ================= RIGHT COLUMN: Live Recommendations, Installments & Settlement (5 Cols) ================= */}
          <div className="lg:col-span-5 space-y-4 flex flex-col">
            {/* 1. Live Card Recommendation Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/30 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-200">
                    Gợi Ý Thẻ Tối Ưu Live
                  </span>
                </div>
                {recommendation && (
                  <Badge variant="success" size="sm">
                    Tối ưu nhất
                  </Badge>
                )}
              </div>

              {recommendation && parsedAmtVND > 0 ? (
                <div className="space-y-2.5 animate-fadeIn">
                  <div>
                    <div className="text-sm font-extrabold text-emerald-400">
                      {recommendation.account_name}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {recommendation.bank_name} ••••{" "}
                      {recommendation.card_number_masked}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Quyền lợi:</span>
                      <strong className="text-emerald-300">
                        {recommendation.reward_type === "CASHBACK"
                          ? `Hoàn ${recommendation.reward_rate_percent}%`
                          : `Tích ${recommendation.reward_rate_percent}% Points`}
                      </strong>
                    </div>
                    {recommendation.reward_type === "CASHBACK" && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Ước tính hoàn:</span>
                        <strong className="text-emerald-400 font-mono">
                          +{formatCurrency(recommendation.estimated_reward_amount)}
                        </strong>
                      </div>
                    )}
                    <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                      {recommendation.reasons && recommendation.reasons.length > 0
                        ? recommendation.reasons[0]
                        : recommendation.benefit_description}
                    </p>
                  </div>

                  {selectedAccountId !== recommendation.account_id && (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() =>
                        setSelectedAccountId(recommendation.account_id)
                      }
                      className="w-full text-xs"
                    >
                      Dùng Thẻ Này Ngay
                    </Button>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 text-center space-y-1.5">
                  <CreditCard className="w-6 h-6 text-slate-600 mx-auto" />
                  <p className="text-xs font-semibold text-slate-300">
                    Nhập số tiền & chọn danh mục chi tiêu
                  </p>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Hệ thống sẽ tự động so sánh quyền lợi hoàn tiền / tích điểm của tất cả các thẻ để đề xuất thẻ tối ưu nhất cho bạn.
                  </p>
                </div>
              )}
            </div>

            {/* 2. One-Click Installment Conversion Panel */}
            {transactionType === "PURCHASE" && (
              <div className="border border-slate-800 rounded-2xl p-4 bg-slate-950/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Percent className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-bold text-slate-200">
                      Chuyển Đổi Trả Góp 0%
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    id="installment_toggle"
                    checked={isInstallment}
                    onChange={(e) => setIsInstallment(e.target.checked)}
                    className="w-4 h-4 text-emerald-500 bg-slate-900 border-slate-700 rounded focus:ring-emerald-500 cursor-pointer"
                  />
                </div>

                {isInstallment && (
                  <div className="pt-2.5 border-t border-slate-800/80 space-y-2.5 animate-fadeIn">
                    <Input
                      label="Tên Gói Trả Góp"
                      placeholder="VD: iPhone 16, Điện máy..."
                      value={installmentProductName}
                      onChange={(e) => setInstallmentProductName(e.target.value)}
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        label="Kỳ Hạn"
                        value={String(installmentTerm)}
                        onChange={(e) =>
                          setInstallmentTerm(parseInt(e.target.value, 10))
                        }
                        options={[
                          { value: "3", label: "3 Tháng" },
                          { value: "6", label: "6 Tháng" },
                          { value: "9", label: "9 Tháng" },
                          { value: "12", label: "12 Tháng" },
                          { value: "24", label: "24 Tháng" },
                        ]}
                      />

                      <CurrencyInput
                        label="Phí Chuyển Đổi"
                        placeholder="0"
                        value={installmentFee}
                        onValueChange={(val) => setInstallmentFee(String(val))}
                        onChangeRaw={(raw) => setInstallmentFee(raw)}
                      />
                    </div>

                    {parsedAmtVND > 0 && (
                      <div className="p-2 rounded-xl bg-sky-950/30 border border-sky-500/20 text-[11px] text-slate-300 flex items-center justify-between">
                        <span>
                          Mỗi tháng:{" "}
                          <strong className="text-sky-400 font-mono text-xs">
                            {formatCurrency(
                              Math.round(parsedAmtVND / installmentTerm)
                            )}
                          </strong>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          x {installmentTerm} kỳ
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 3. Statement Settlement Selection if REPAYMENT */}
            {transactionType === "REPAYMENT" && (
              <div className="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/30 space-y-2">
                <label className="block text-xs font-bold text-teal-300 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4" />
                  <span>Gạch Nợ Kỳ Sao Kê</span>
                </label>
                <Select
                  value={settlesStatementId}
                  onChange={(e) => {
                    setSettlesStatementId(e.target.value);
                    const found = pendingStatements.find(
                      (s) => s.statement_id === e.target.value
                    );
                    if (found && Number(found.remaining_balance_to_pay) > 0) {
                      setAmountVND(String(found.remaining_balance_to_pay));
                    }
                  }}
                  options={[
                    {
                      value: "",
                      label: "-- Khớp tự động theo ngày --",
                    },
                    ...pendingStatements.map((st: StatementPaymentStatus) => ({
                      value: st.statement_id,
                      label: `Kỳ ${formatDate(st.statement_date)} (Còn nợ ${formatCurrency(st.remaining_balance_to_pay)})`,
                    })),
                  ]}
                />
                <p className="text-[10px] text-teal-200/80">
                  Chọn kỳ sao kê để tự động cập nhật tiến độ thanh toán & đối soát.
                </p>
              </div>
            )}

            {/* 4. Link Existing Active Installment Plan if INSTALLMENT_MONTHLY */}
            {transactionType === "INSTALLMENT_MONTHLY" && (
              <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/30 space-y-2.5 animate-fadeIn">
                <div className="flex items-center gap-2 text-xs font-bold text-sky-300">
                  <Percent className="w-4 h-4 text-sky-400" />
                  <span>Liên Kết Gói Trả Góp Đang Chạy</span>
                </div>
                <Select
                  value={selectedInstallmentPlanId}
                  onChange={(e) => {
                    const planId = e.target.value;
                    setSelectedInstallmentPlanId(planId);
                    const foundPlan = accountInstallments.find(
                      (p: InstallmentPlan) => p.id === planId
                    );
                    if (foundPlan) {
                      if (
                        !rawDescription.trim() ||
                        rawDescription === "Trả góp định kỳ hàng tháng"
                      ) {
                        setRawDescription(`Trả góp: ${foundPlan.product_name}`);
                      }
                      setAmountVND(String(foundPlan.monthly_payment));
                    }
                  }}
                  options={[
                    { value: "", label: "-- Chọn gói trả góp để liên kết --" },
                    ...accountInstallments.map((p: InstallmentPlan) => ({
                      value: p.id,
                      label: `${p.product_name} • ${formatCurrency(p.monthly_payment)}/kỳ ${p.status === "ACTIVE" ? "(Đang chạy)" : "(Đã xong)"}`,
                    })),
                  ]}
                />
                {accountInstallments.length === 0 ? (
                  <p className="text-[11px] text-amber-300/90 leading-relaxed">
                    ⚠️ Thẻ này hiện chưa có gói trả góp nào. Bạn vẫn có thể tạo giao dịch trả góp độc lập hoặc tạo gói mới từ mục Chi tiêu.
                  </p>
                ) : (
                  <p className="text-[11px] text-sky-200/80 leading-relaxed">
                    💡 Chọn gói để hệ thống tự động điền số tiền kỳ trả góp ({accountInstallments.length} gói khả dụng) và cập nhật số dư gói.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Actions Bar (Always visible) */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <div className="text-xs text-slate-400">
            {parsedAmtVND > 0 && (
              <span>
                Tổng giao dịch:{" "}
                <strong className="text-emerald-400 font-mono text-sm">
                  {formatCurrency(parsedAmtVND + (parseFloat(feeVND) || 0))}
                </strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={createMutation.isPending}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              {isInstallment ? "Lập Giao Dịch & Trả Góp" : "Tạo Giao Dịch"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
