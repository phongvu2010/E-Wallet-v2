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
import { formatAccountLabel, formatCurrency, formatDate } from "../../utils/formatters";
import {
  TransactionFlow,
  filterCategoryTreeByFlow,
  getDefaultCategoryForFlow,
  inferFlowFromTransactionType,
  inferTransactionTypeFromCategory,
  resolveCategoryHierarchy,
} from "../../utils/categoryHelpers";

interface SmartCreateTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultAccountId?: string;
  initialData?: Partial<TransactionCreatePayload>;
}

// Preset Quick Chips
interface PresetChip {
  id: string;
  icon: string;
  label: string;
  flow: TransactionFlow;
  categoryKeyword: string;
  defaultDesc: string;
  color: string;
}

const PRESET_CHIPS: PresetChip[] = [
  {
    id: "fnb",
    icon: "☕",
    label: "Cà phê & Ăn uống",
    flow: "EXPENSE",
    categoryKeyword: "Cà phê",
    defaultDesc: "STARBUCKS / HIGHLANDS",
    color: "bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20",
  },
  {
    id: "supermarket",
    icon: "🛒",
    label: "Siêu thị & Đi chợ",
    flow: "EXPENSE",
    categoryKeyword: "Siêu thị",
    defaultDesc: "WINMART / COOPMART",
    color: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20",
  },
  {
    id: "online",
    icon: "📦",
    label: "Mua sắm Online / TMĐT",
    flow: "EXPENSE",
    categoryKeyword: "Online",
    defaultDesc: "SHOPEE / LAZADA / TIKI",
    color: "bg-sky-500/10 text-sky-300 border-sky-500/30 hover:bg-sky-500/20",
  },
  {
    id: "transport",
    icon: "⛽",
    label: "Xăng xe & Grab",
    flow: "EXPENSE",
    categoryKeyword: "Xăng xe",
    defaultDesc: "PETROLIMEX / GRAB",
    color: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/20",
  },
  {
    id: "income",
    icon: "💰",
    label: "Lương & Thu nhập",
    flow: "INCOME",
    categoryKeyword: "Lương",
    defaultDesc: "Nhận tiền lương tháng",
    color: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20",
  },
  {
    id: "transfer",
    icon: "🔄",
    label: "Chuyển tiền nội bộ",
    flow: "TRANSFER",
    categoryKeyword: "Chuyển khoản",
    defaultDesc: "Chuyển tiền nội bộ",
    color: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/20",
  },
  {
    id: "repayment",
    icon: "💳",
    label: "Thanh toán nợ thẻ",
    flow: "REPAYMENT",
    categoryKeyword: "Thanh toán",
    defaultDesc: "Thanh toán sao kê thẻ",
    color: "bg-teal-500/10 text-teal-300 border-teal-500/30 hover:bg-teal-500/20",
  },
  {
    id: "fee",
    icon: "🏷️",
    label: "Phí thường niên / SMS",
    flow: "EXPENSE",
    categoryKeyword: "Phí",
    defaultDesc: "Phí thường niên thẻ",
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
  { value: "INCOME", label: "Khoản thu nhập (Lương, Thưởng...) (+)" },
  { value: "TRANSFER", label: "Chuyển tiền giữa các tài khoản / ví" },
  { value: "REPAYMENT", label: "Thanh toán dư nợ thẻ (-)" },
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
> = ({ isOpen, onClose, defaultAccountId, initialData }) => {
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

  // Asset accounts (for bank transfer / income reception)
  const assetAccounts = useMemo(
    () =>
      activeAccounts.filter(
        (a: Account) => a.is_asset ?? a.account_type !== "CREDIT_CARD"
      ),
    [activeAccounts]
  );

  // Credit accounts (for purchases & repayments)
  const creditAccounts = useMemo(
    () =>
      activeAccounts.filter(
        (a: Account) => !(a.is_asset ?? a.account_type !== "CREDIT_CARD")
      ),
    [activeAccounts]
  );

  // Mutations
  const createMutation = useCreateTransaction();

  // High-Level Flow Tab State: EXPENSE | INCOME | TRANSFER | REPAYMENT
  const [activeFlow, setActiveFlow] = useState<TransactionFlow>("EXPENSE");

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

  // Filtered categories for current flow
  const filteredCategoryTree = useMemo(() => {
    return filterCategoryTreeByFlow(categoryTree, activeFlow);
  }, [categoryTree, activeFlow]);

  const selectedParent = useMemo(() => {
    return filteredCategoryTree.find((p: CategoryTreeNode) => p.id === parentCategoryId);
  }, [filteredCategoryTree, parentCategoryId]);

  const effectiveCategoryId = useMemo(() => {
    return subCategoryId || parentCategoryId || "";
  }, [subCategoryId, parentCategoryId]);

  const currentCategory = useMemo(() => {
    if (!effectiveCategoryId) return null;
    return categories.find((c: Category) => c.id === effectiveCategoryId) || null;
  }, [effectiveCategoryId, categories]);

  // Installment plans for the selected account
  const { data: accountInstallments = [] } = useInstallments(
    selectedAccountId || undefined
  );

  // Statements for selected account
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

  // Set default account on load
  useEffect(() => {
    if (defaultAccountId) {
      setSelectedAccountId(defaultAccountId);
    } else if (activeAccounts.length > 0 && !selectedAccountId) {
      if (activeFlow === "INCOME" && assetAccounts.length > 0) {
        setSelectedAccountId(assetAccounts[0].id);
      } else if (activeFlow === "EXPENSE" && creditAccounts.length > 0) {
        setSelectedAccountId(creditAccounts[0].id);
      } else {
        setSelectedAccountId(activeAccounts[0].id);
      }
    }
  }, [defaultAccountId, activeAccounts, selectedAccountId, activeFlow, assetAccounts, creditAccounts]);

  // Synchronize initialData when provided (e.g. from AI Copilot bot chat)
  useEffect(() => {
    if (isOpen && initialData) {
      if (initialData.transaction_type) {
        const flow = inferFlowFromTransactionType(initialData.transaction_type);
        setActiveFlow(flow);
        setTransactionType(initialData.transaction_type);
      }
      if (initialData.account_id) setSelectedAccountId(initialData.account_id);
      if (initialData.transaction_date) setTransactionDate(initialData.transaction_date);
      if (initialData.amount) setAmountVND(String(initialData.amount));
      if (initialData.fee !== undefined) setFeeVND(String(initialData.fee));
      if (initialData.raw_description) setRawDescription(initialData.raw_description);
      if (initialData.merchant_name) setSelectedMerchantName(initialData.merchant_name);
      if (initialData.transfer_to_account_id) setTransferToAccountId(initialData.transfer_to_account_id);
      if (initialData.note) setNote(initialData.note);
      if (initialData.category_id && categories.length > 0) {
        const { parentId, subId } = resolveCategoryHierarchy(initialData.category_id, categories, categoryTree);
        if (parentId) setParentCategoryId(parentId);
        if (subId) setSubCategoryId(subId);
      }
    }
  }, [isOpen, initialData, categories, categoryTree]);

  // Set default category when flow changes or modal opens
  useEffect(() => {
    if (isOpen && filteredCategoryTree.length > 0) {
      if (!parentCategoryId || !filteredCategoryTree.some((p) => p.id === parentCategoryId)) {
        const firstParent = filteredCategoryTree[0];
        setParentCategoryId(firstParent.id);
        setSubCategoryId(firstParent.children?.[0]?.id || "");
      }
    }
  }, [isOpen, activeFlow, filteredCategoryTree, parentCategoryId]);

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

  // Flow Tab Switch Handler
  const handleFlowChange = (newFlow: TransactionFlow) => {
    setActiveFlow(newFlow);
    setCreateErrors({});

    const flowTree = filterCategoryTreeByFlow(categoryTree, newFlow);
    if (flowTree.length > 0) {
      const firstParent = flowTree[0];
      setParentCategoryId(firstParent.id);
      setSubCategoryId(firstParent.children?.[0]?.id || "");
    }

    if (newFlow === "EXPENSE") {
      setTransactionType("PURCHASE");
      if (creditAccounts.length > 0 && (!selectedAccountId || !creditAccounts.some(a => a.id === selectedAccountId))) {
        setSelectedAccountId(creditAccounts[0].id);
      }
    } else if (newFlow === "INCOME") {
      setTransactionType("INCOME");
      if (assetAccounts.length > 0 && (!selectedAccountId || !assetAccounts.some(a => a.id === selectedAccountId))) {
        setSelectedAccountId(assetAccounts[0].id);
      }
    } else if (newFlow === "TRANSFER") {
      setTransactionType("TRANSFER");
      setIsInstallment(false);
      const defaultTransferCat = getDefaultCategoryForFlow(categories, "TRANSFER");
      if (defaultTransferCat) {
        const hierarchy = resolveCategoryHierarchy(defaultTransferCat, categories, categoryTree);
        setParentCategoryId(hierarchy.parentId);
        setSubCategoryId(hierarchy.subId);
      }
      if (activeAccounts.length > 1 && !transferToAccountId) {
        const other = activeAccounts.find((a) => a.id !== selectedAccountId);
        if (other) setTransferToAccountId(other.id);
      }
    } else if (newFlow === "REPAYMENT") {
      setTransactionType("REPAYMENT");
      setIsInstallment(false);
      const defaultRepayCat = getDefaultCategoryForFlow(categories, "REPAYMENT");
      if (defaultRepayCat) {
        const hierarchy = resolveCategoryHierarchy(defaultRepayCat, categories, categoryTree);
        setParentCategoryId(hierarchy.parentId);
        setSubCategoryId(hierarchy.subId);
      }
      if (creditAccounts.length > 0 && !transferToAccountId) {
        setTransferToAccountId(creditAccounts[0].id);
      }
      if (assetAccounts.length > 0 && (!selectedAccountId || !assetAccounts.some(a => a.id === selectedAccountId))) {
        setSelectedAccountId(assetAccounts[0].id);
      }
    }
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
      const inferred = inferTransactionTypeFromCategory(targetCat, activeFlow);
      setTransactionType(inferred);
    }
  };

  // Parent Category Change Handler (Cấp 1)
  const handleParentCategoryChange = (newParentId: string) => {
    setParentCategoryId(newParentId);
    const parentNode = filteredCategoryTree.find((p: CategoryTreeNode) => p.id === newParentId);
    const firstChild = parentNode?.children?.[0]?.id || "";
    setSubCategoryId(firstChild);

    const targetCat = categories.find((c: Category) => c.id === (firstChild || newParentId));
    if (targetCat) {
      const inferred = inferTransactionTypeFromCategory(targetCat, activeFlow);
      setTransactionType(inferred);
    }
  };

  // Subcategory Change Handler (Cấp 2)
  const handleSubCategoryChange = (newSubId: string) => {
    setSubCategoryId(newSubId);
    const targetCat = categories.find((c: Category) => c.id === (newSubId || parentCategoryId));
    if (targetCat) {
      const inferred = inferTransactionTypeFromCategory(targetCat, activeFlow);
      setTransactionType(inferred);
    }
  };

  // Preset Chip Click Handler
  const handleApplyPreset = (chip: PresetChip) => {
    handleFlowChange(chip.flow);
    setRawDescription(chip.defaultDesc);
    setSelectedMerchantName(chip.defaultDesc.split(" ")[0]);

    if (chip.categoryKeyword) {
      const kw = chip.categoryKeyword.toLowerCase();
      const found = categories.find((c: Category) =>
        c.name.toLowerCase().includes(kw)
      );
      if (found) {
        setCategoryFromId(found.id);
      }
    }
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
      activeFlow === "EXPENSE" &&
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
  }, [activeFlow, parsedAmtVND, effectiveCategoryId, selectedCategoryLabel, selectedMerchantName, rawDescription]);

  // Validation
  const validateForm = () => {
    const errs: Record<string, string> = {};
    if (!selectedAccountId) {
      errs.account_id = "Vui lòng chọn tài khoản nguồn";
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
    if ((activeFlow === "TRANSFER" || activeFlow === "REPAYMENT") && !transferToAccountId) {
      errs.transfer_to_account_id =
        activeFlow === "TRANSFER"
          ? "Vui lòng chọn tài khoản / ví nhận tiền"
          : "Vui lòng chọn thẻ tín dụng cần thanh toán";
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

    let finalType = transactionType;
    if (activeFlow === "TRANSFER") finalType = "TRANSFER";
    else if (activeFlow === "REPAYMENT") finalType = "REPAYMENT";
    else if (activeFlow === "INCOME" && finalType !== "CASHBACK_CREDIT") finalType = "INCOME";

    let finalCatId = effectiveCategoryId || undefined;
    if (activeFlow === "TRANSFER" && !finalCatId) {
      finalCatId = getDefaultCategoryForFlow(categories, "TRANSFER") || undefined;
    } else if (activeFlow === "REPAYMENT" && !finalCatId) {
      finalCatId = getDefaultCategoryForFlow(categories, "REPAYMENT") || undefined;
    }

    const payload: TransactionCreatePayload = {
      account_id: selectedAccountId,
      transaction_date: transactionDate,
      post_date: transactionDate,
      raw_description:
        rawDescription.trim() ||
        (activeFlow === "TRANSFER"
          ? "Chuyển tiền nội bộ"
          : activeFlow === "REPAYMENT"
          ? "Thanh toán nợ thẻ"
          : activeFlow === "INCOME"
          ? "Thu nhập"
          : currentCategory?.name || "Chi tiêu"),
      merchant_id: selectedMerchantId || undefined,
      merchant_name: selectedMerchantName || undefined,
      category_id: finalCatId,
      transaction_type: finalType,
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
    if (isInstallment && activeFlow === "EXPENSE") {
      payload.convert_to_installment = {
        product_name:
          installmentProductName.trim() || rawDescription.trim() || "Gói trả góp 0%",
        term_months: Number(installmentTerm),
        conversion_fee: parseFloat(installmentFee) || 0,
        interest_rate_percent: 0,
      };
    }

    // Transfer or Repayment target account link
    if ((activeFlow === "TRANSFER" || activeFlow === "REPAYMENT") && transferToAccountId) {
      payload.transfer_to_account_id = transferToAccountId;
    }

    // Statement link
    if (activeFlow === "REPAYMENT" && settlesStatementId) {
      payload.settles_statement_id = settlesStatementId;
    }

    try {
      await createMutation.mutateAsync(payload);
      toast.success(
        activeFlow === "TRANSFER"
          ? "Chuyển tiền giữa các tài khoản thành công!"
          : activeFlow === "REPAYMENT"
          ? "Ghi nhận thanh toán dư nợ thẻ thành công!"
          : activeFlow === "INCOME"
          ? "Ghi nhận khoản thu nhập thành công!"
          : isInstallment
          ? "Tạo giao dịch và tự động lập gói trả góp thành công!"
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
      title="Thêm Giao Dịch Mới"
      maxWidth="4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Top: 4 Primary Transaction Flow Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 bg-slate-950/80 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => handleFlowChange("EXPENSE")}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
              activeFlow === "EXPENSE"
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <span>💸</span>
            <span>Chi Tiêu</span>
          </button>
          <button
            type="button"
            onClick={() => handleFlowChange("INCOME")}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
              activeFlow === "INCOME"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <span>💰</span>
            <span>Thu Nhập</span>
          </button>
          <button
            type="button"
            onClick={() => handleFlowChange("TRANSFER")}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
              activeFlow === "TRANSFER"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <span>🔄</span>
            <span>Chuyển Tiền</span>
          </button>
          <button
            type="button"
            onClick={() => handleFlowChange("REPAYMENT")}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
              activeFlow === "REPAYMENT"
                ? "bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <span>💳</span>
            <span>Trả Nợ Thẻ</span>
          </button>
        </div>

        {/* Preset Quick Chips Bar */}
        <div className="bg-slate-950/40 p-2.5 rounded-2xl border border-slate-800/60">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <span className="text-[11px] font-semibold text-slate-400 shrink-0 flex items-center gap-1 mr-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Gợi ý:</span>
            </span>
            {PRESET_CHIPS.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => handleApplyPreset(chip)}
                className={`px-2.5 py-1 rounded-xl border text-[11px] font-medium transition-all flex items-center gap-1.5 shrink-0 ${chip.color}`}
              >
                <span>{chip.icon}</span>
                <span>{chip.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* ================= LEFT COLUMN: Transaction Core Details (7 Cols) ================= */}
          <div className="lg:col-span-7 space-y-4">
            {/* Account Selector Row */}
            {activeFlow === "TRANSFER" ? (
              <div className="p-3.5 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Select
                    label="Từ Tài Khoản (Nguồn trích tiền)"
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    options={activeAccounts.map((a: Account) => ({
                      value: a.id,
                      label: formatAccountLabel(a),
                    }))}
                    error={errors.account_id}
                    required
                  />
                  <Select
                    label="Đến Tài Khoản / Ví (Đích nhận tiền)"
                    value={transferToAccountId}
                    onChange={(e) => setTransferToAccountId(e.target.value)}
                    options={[
                      { value: "", label: "-- Chọn tài khoản đích --" },
                      ...activeAccounts
                        .filter((a: Account) => a.id !== selectedAccountId)
                        .map((a: Account) => ({
                          value: a.id,
                          label: formatAccountLabel(a),
                        })),
                    ]}
                    error={errors.transfer_to_account_id}
                    required
                  />
                </div>
                <p className="text-[11px] text-cyan-300/80">
                  💡 Số tiền chuyển sẽ được trừ vào tài khoản nguồn và cộng nguyên vẹn vào tài khoản đích. Phí chuyển (nếu có) sẽ trừ thêm vào tài khoản nguồn.
                </p>
              </div>
            ) : activeFlow === "REPAYMENT" ? (
              <div className="p-3.5 rounded-2xl bg-teal-950/20 border border-teal-500/30 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Select
                    label="Nguồn Trích Tiền (TK Ngân hàng / Ví)"
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    options={activeAccounts.map((a: Account) => ({
                      value: a.id,
                      label: formatAccountLabel(a),
                    }))}
                    error={errors.account_id}
                    required
                  />
                  <Select
                    label="Thẻ Tín Dụng Cần Thanh Toán"
                    value={transferToAccountId}
                    onChange={(e) => setTransferToAccountId(e.target.value)}
                    options={[
                      { value: "", label: "-- Chọn thẻ tín dụng --" },
                      ...creditAccounts.map((a: Account) => ({
                        value: a.id,
                        label: formatAccountLabel(a),
                      })),
                    ]}
                    error={errors.transfer_to_account_id}
                    required
                  />
                </div>
              </div>
            ) : (
              <div>
                <Select
                  label={activeFlow === "INCOME" ? "Tài Khoản Nhận Tiền" : "Tài Khoản / Thẻ Chi Trả"}
                  value={selectedAccountId}
                  onChange={(e) => {
                    setSelectedAccountId(e.target.value);
                    if (errors.account_id) setCreateErrors((prev) => ({ ...prev, account_id: "" }));
                  }}
                  error={errors.account_id}
                  options={
                    activeAccounts.length > 0
                      ? activeAccounts.map((a: Account) => ({
                          value: a.id,
                          label: formatAccountLabel(a),
                        }))
                      : [{ value: "", label: "Không có tài khoản đang hoạt động", disabled: true }]
                  }
                  required
                />
                {currentLiveAccount && (
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 px-1">
                    <span>
                      Số dư/Khả dụng:{" "}
                      <strong className="text-emerald-400 font-mono">
                        {formatCurrency(currentLiveAccount.live_available_limit || currentLiveAccount.live_current_balance)}
                      </strong>
                    </span>
                    {!currentLiveAccount.is_asset && (
                      <span className={currentLiveAccount.live_risk_level.includes("CRITICAL") ? "text-rose-400 font-bold" : "text-slate-400"}>
                        Dư nợ: {Number(currentLiveAccount.live_utilization_percentage).toFixed(0)}%
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Date Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-400">
                    Ngày Giao Dịch
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setTransactionDate(new Date().toISOString().split("T")[0])}
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
                      setCreateErrors((prev) => ({ ...prev, transaction_date: "" }));
                  }}
                  error={errors.transaction_date}
                  required
                />
              </div>

              {/* Merchant / Description Input for Expense/Income */}
              <div className="relative" ref={merchantDropdownRef}>
                <Input
                  label={activeFlow === "INCOME" ? "Nguồn Thu / Người Gửi (Tùy chọn)" : "Đơn Vị / Nội Dung (Tùy chọn)"}
                  placeholder={
                    activeFlow === "INCOME"
                      ? "Công ty, Khách hàng, Thưởng..."
                      : "STARBUCKS, WinMart, Grab, Tiền chợ..."
                  }
                  value={rawDescription}
                  onChange={(e) => {
                    setRawDescription(e.target.value);
                    setSelectedMerchantName(e.target.value);
                    setIsSearchingMerchant(true);
                  }}
                  onFocus={() => setIsSearchingMerchant(true)}
                  leftIcon={<Search className="w-4 h-4 text-emerald-400" />}
                />

                {/* Autocomplete Dropdown List */}
                {isSearchingMerchant && filteredMerchants.length > 0 && activeFlow === "EXPENSE" && (
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
            </div>

            {/* 2-Tier Hierarchical Category Picker (For Expense & Income) */}
            {(activeFlow === "EXPENSE" || activeFlow === "INCOME") && (
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Select
                      label="Nhóm Danh Mục (Cấp 1)"
                      value={parentCategoryId}
                      onChange={(e) => handleParentCategoryChange(e.target.value)}
                      options={[
                        { value: "", label: "-- Chọn Nhóm Danh Mục --" },
                        ...filteredCategoryTree.map((p: CategoryTreeNode) => ({
                          value: p.id,
                          label: p.name,
                        })),
                      ]}
                      required
                    />
                  </div>

                  <div>
                    <Select
                      label="Danh Mục Chi Tiết (Cấp 2)"
                      value={subCategoryId}
                      onChange={(e) => handleSubCategoryChange(e.target.value)}
                      options={[
                        {
                          value: "",
                          label:
                            selectedParent && selectedParent.children && selectedParent.children.length > 0
                              ? "-- Chọn danh mục chi tiết --"
                              : selectedParent
                              ? `-- Dùng nhóm: ${selectedParent.name} --`
                              : "-- Chọn nhóm trước --",
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

                {/* Selected Category Info Badge */}
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
                        Danh mục: <strong className="text-slate-100">{currentCategory.name}</strong>
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

                {/* Advanced Override for Technical Transaction Type */}
                {showAdvancedTxType && (
                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                    <Select
                      label="Loại Giao Dịch Kế Toán Hệ Thống (Nâng cao)"
                      value={transactionType}
                      onChange={(e) => setTransactionType(e.target.value as TransactionType)}
                      options={TRANSACTION_TYPES}
                    />
                    <p className="text-[10px] text-slate-500 italic">
                      💡 Mặc định hệ thống tự động nhận diện chính xác theo Luồng và Danh mục bạn chọn.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Multi-Currency & Amount Inputs */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-200">
                    Số Tiền {activeFlow === "TRANSFER" ? "Chuyển" : ""}
                  </span>
                </div>

                {activeFlow === "EXPENSE" && (
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
                )}
              </div>

              {isForeignCurrency && activeFlow === "EXPENSE" ? (
                <div className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/30 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <Select
                      label="Ngoại Tệ"
                      value={currencyCode}
                      onChange={(e) => handleCurrencyChange(e.target.value)}
                      options={CURRENCIES.filter((c) => c.code !== "VND").map((c) => ({
                        value: c.code,
                        label: `${c.code}`,
                      }))}
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
                      onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)}
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
                      if (errors.amount) setCreateErrors((prev) => ({ ...prev, amount: "" }));
                    }}
                    onChangeRaw={(raw) => setAmountVND(raw)}
                    error={errors.amount}
                    required
                  />

                  <CurrencyInput
                    label={activeFlow === "TRANSFER" ? "Phí Chuyển Tiền (VNĐ)" : "Phí Giao Dịch Đi Kèm (VNĐ)"}
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
                placeholder="Ghi chú thêm về mục đích chi tiêu / nội dung giao dịch..."
              />
            </div>
          </div>

          {/* ================= RIGHT COLUMN: Contextual Recommendation / Installments / Settlement (5 Cols) ================= */}
          <div className="lg:col-span-5 space-y-4 flex flex-col">
            {/* 1. Live Card Recommendation Card (For Expense) */}
            {activeFlow === "EXPENSE" && (
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
                        {recommendation.bank_name} •••• {recommendation.card_number_masked}
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
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Tiền nhận lại ước tính:</span>
                        <strong className="text-emerald-400 font-mono font-bold">
                          +{formatCurrency(recommendation.estimated_reward_amount)}
                        </strong>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full text-xs text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/10"
                      onClick={() => setSelectedAccountId(recommendation.account_id)}
                    >
                      Dùng Thẻ Này Ngay
                    </Button>
                  </div>
                ) : (
                  <div className="py-3 text-center text-xs text-slate-400">
                    Nhập số tiền và danh mục để nhận gợi ý thẻ quẹt tối đa quyền lợi hoàn tiền!
                  </div>
                )}
              </div>
            )}

            {/* 2. 0% Installment Plan Converter (For Expense) */}
            {activeFlow === "EXPENSE" && (
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Percent className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-slate-200">
                      Chuyển Đổi Trả Góp 0%
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isInstallment}
                      onChange={(e) => setIsInstallment(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>

                {isInstallment && (
                  <div className="space-y-3 pt-2 animate-fadeIn">
                    <div className="grid grid-cols-2 gap-2.5">
                      <Select
                        label="Kỳ Hạn"
                        value={String(installmentTerm)}
                        onChange={(e) => setInstallmentTerm(Number(e.target.value))}
                        options={[
                          { value: "3", label: "3 Tháng" },
                          { value: "6", label: "6 Tháng" },
                          { value: "9", label: "9 Tháng" },
                          { value: "12", label: "12 Tháng" },
                        ]}
                      />
                      <CurrencyInput
                        label="Phí Chuyển Đổi (VNĐ)"
                        placeholder="0"
                        value={installmentFee}
                        onValueChange={(val) => setInstallmentFee(String(val))}
                        onChangeRaw={(raw) => setInstallmentFee(raw)}
                      />
                    </div>
                    {parsedAmtVND > 0 && (
                      <div className="p-2.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs flex items-center justify-between text-amber-300">
                        <span>Số tiền trả mỗi kỳ ({installmentTerm} tháng):</span>
                        <strong className="font-mono text-sm">
                          {formatCurrency(Math.round(parsedAmtVND / installmentTerm))} / kỳ
                        </strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 3. Statement Settlement Selection (For Repayment) */}
            {activeFlow === "REPAYMENT" && (
              <div className="p-4 rounded-2xl bg-teal-950/20 border border-teal-500/30 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-teal-300">
                  <Receipt className="w-4 h-4 text-teal-400" />
                  <span>Kỳ Sao Kê Cần Quyết Toán</span>
                </div>
                {pendingStatements.length > 0 ? (
                  <div className="space-y-2">
                    <Select
                      label="Chọn Kỳ Sao Kê"
                      value={settlesStatementId}
                      onChange={(e) => {
                        const sId = e.target.value;
                        setSettlesStatementId(sId);
                        const st = pendingStatements.find((s) => s.statement_id === sId);
                        if (st && Number(st.remaining_balance_to_pay) > 0) {
                          setAmountVND(String(st.remaining_balance_to_pay));
                        }
                      }}
                      options={[
                        { value: "", label: "-- Không gắn kỳ sao kê cụ thể --" },
                        ...pendingStatements.map((st: StatementPaymentStatus) => ({
                          value: st.statement_id,
                          label: `Sao kê ${formatDate(st.statement_date)} (Còn nợ: ${formatCurrency(st.remaining_balance_to_pay)})`,
                        })),
                      ]}
                    />
                    {settlesStatementId && (
                      <p className="text-[11px] text-teal-400">
                        ✅ Giao dịch thanh toán này sẽ được liên kết trực tiếp vào kỳ sao kê đã chọn để đối soát 3 chiều.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    Không có kỳ sao kê nào đang mở hoặc còn nợ trên thẻ này.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy Bỏ
          </Button>
          <Button type="submit" variant="primary" isLoading={createMutation.isPending}>
            {activeFlow === "TRANSFER"
              ? "Xác Nhận Chuyển Tiền"
              : activeFlow === "REPAYMENT"
              ? "Xác Nhận Trả Nợ Thẻ"
              : activeFlow === "INCOME"
              ? "Ghi Nhận Thu Nhập"
              : "Lưu Giao Dịch"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
