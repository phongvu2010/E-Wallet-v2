/**
 * Formats a numeric or string amount into a localized currency string (VND or USD).
 *
 * @param amount - The numerical amount or string representation.
 * @param currency - The 3-letter currency ISO code (e.g. 'VND', 'USD'). Default is 'VND'.
 * @returns Formatted currency string with appropriate symbol and thousands separators.
 */
export function formatCurrency(amount: number | string | undefined | null, currency: string = "VND"): string {
  if (amount === undefined || amount === null) {
    return "0 ₫";
  }

  const num = typeof amount === "number" ? amount : parseFloat(String(amount));
  if (isNaN(num)) {
    return "0 ₫";
  }

  if (currency.toUpperCase() === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  }

  // Format VND with comma grouping
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(num);
}

/**
 * Formats an ISO date string into a user-friendly Vietnamese date format.
 *
 * @param dateString - The raw ISO date string (YYYY-MM-DD or ISO timestamp).
 * @param formatStr - Output format pattern ('dd/MM/yyyy' or 'MM/yyyy').
 * @returns Formatted date string or fallback '--/--/----'.
 */
export function formatDate(dateString: string | undefined | null, formatStr: string = "dd/MM/yyyy"): string {
  if (!dateString) return "--/--/----";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;

    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();

    if (formatStr === "dd/MM/yyyy") {
      return `${day}/${month}/${year}`;
    }
    if (formatStr === "MM/yyyy") {
      return `${month}/${year}`;
    }
    return `${day}/${month}/${year}`;
  } catch {
    return dateString;
  }
}

/**
 * Maps a credit utilization risk assessment tier to Tailwind CSS style classes.
 *
 * @param riskLevel - Risk tier description ('OPTIMAL', 'MODERATE', 'HIGH', 'CRITICAL').
 * @returns Object containing badge, text, and background Tailwind classes.
 */
export function getRiskLevelColor(riskLevel: string = ""): {
  badge: string;
  text: string;
  bg: string;
} {
  const upper = riskLevel.toUpperCase();
  if (upper.includes("CRITICAL") || upper.includes(">70")) {
    return {
      badge: "bg-rose-500/10 text-rose-400 border-rose-500/30",
      text: "text-rose-400",
      bg: "bg-rose-500",
    };
  }
  if (upper.includes("HIGH") || upper.includes(">50")) {
    return {
      badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
      text: "text-amber-400",
      bg: "bg-amber-500",
    };
  }
  if (upper.includes("MODERATE") || upper.includes(">30")) {
    return {
      badge: "bg-blue-500/10 text-blue-400 border-blue-500/30",
      text: "text-blue-400",
      bg: "bg-blue-500",
    };
  }
  return {
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    text: "text-emerald-400",
    bg: "bg-emerald-500",
  };
}

/**
 * Returns brand gradient background styles matching specific banking institutions.
 *
 * @param bankName - Name of the bank / card issuer.
 * @returns Tailwind gradient and border classes.
 */
export function getBankGradient(bankName: string = ""): string {
  const upper = bankName.toUpperCase();
  if (upper.includes("SHINHAN")) {
    return "from-sky-900 via-blue-900 to-indigo-950 border-blue-700/40";
  }
  if (upper.includes("HSBC")) {
    return "from-red-950 via-slate-900 to-rose-950 border-rose-700/40";
  }
  if (upper.includes("SACOM")) {
    return "from-cyan-950 via-blue-950 to-slate-900 border-cyan-700/40";
  }
  return "from-slate-900 via-slate-850 to-slate-950 border-slate-700/40";
}

/**
 * Maps transaction type enum codes to Vietnamese display labels and styling badge colors.
 *
 * @param type - Transaction type enum string.
 * @returns Object with localized label and Tailwind color classes.
 */
export function getTransactionTypeLabel(type: string): { label: string; color: string } {
  switch (type) {
    case "INCOME":
      return { label: "Thu nhập", color: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30" };
    case "PURCHASE":
      return { label: "Chi tiêu", color: "text-rose-400 bg-rose-500/10 border-rose-500/20" };
    case "REPAYMENT":
      return { label: "Thanh toán nợ", color: "text-teal-400 bg-teal-500/10 border-teal-500/20" };
    case "INSTALLMENT_MONTHLY":
      return { label: "Trả góp kỳ", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" };
    case "INSTALLMENT_PRINCIPAL":
      return { label: "Ghi có trả góp", color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" };
    case "FEE":
      return { label: "Phí dịch vụ", color: "text-orange-400 bg-orange-500/10 border-orange-500/20" };
    case "INTEREST":
      return { label: "Lãi suất", color: "text-red-400 bg-red-500/10 border-red-500/20" };
    case "REFUND":
      return { label: "Hoàn tiền hủy đơn", color: "text-teal-400 bg-teal-500/10 border-teal-500/20" };
    case "CASHBACK_CREDIT":
      return { label: "Hoàn tiền Cashback", color: "text-green-400 bg-green-500/10 border-green-500/20" };
    case "CASH_ADVANCE":
      return { label: "Ứng tiền mặt", color: "text-purple-400 bg-purple-500/10 border-purple-500/20" };
    case "TRANSFER":
      return { label: "Chuyển khoản", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" };
    case "DEBT_BORROW":
      return { label: "Nhận tiền vay", color: "text-blue-300 bg-blue-500/15 border-blue-500/30" };
    case "DEBT_REPAY":
      return { label: "Trả nợ gốc", color: "text-amber-300 bg-amber-500/15 border-amber-500/30" };
    case "DEBT_LEND":
      return { label: "Cho mượn tiền", color: "text-indigo-300 bg-indigo-500/15 border-indigo-500/30" };
    case "DEBT_COLLECT":
      return { label: "Thu hồi nợ", color: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30" };
    default:
      return { label: type, color: "text-slate-400 bg-slate-500/10 border-slate-500/20" };
  }
}

/**
 * Maps category type enum to Vietnamese display label.
 */
export function getCategoryTypeLabel(type: string): string {
  switch (type) {
    case "EXPENSE":
      return "Chi tiêu";
    case "INCOME":
      return "Thu nhập";
    case "TRANSFER":
      return "Chuyển tiền";
    case "FEE_INTEREST":
      return "Phí & Lãi";
    case "ADJUSTMENT":
      return "Điều chỉnh";
    default:
      return type;
  }
}

/**
 * Formats an account display label to include the issuer / bank name prefix,
 * account name, and masked number / last 4 digits.
 *
 * Example:
 * - "Shinhan Bank: S-PayRoll Account - VND (•••• 1294)"
 * - "HSBC: VISA CASH BACK (•••• 0702)"
 * - "ZaloPay: TK Tra Sau (•••• 0535)"
 * - "MoMo: Túi Thần Tài (•••• 0535)"
 * - "Tiền mặt: Tiền Mặt Cá Nhân (•••• CASH)"
 */
export function formatAccountLabel(
  account: {
    account_name?: string;
    bank_name?: string;
    institution?: { short_name?: string; name?: string; code?: string } | null;
    card_number_masked?: string;
    card_number_last4?: string;
    account_type?: string;
  } | null | undefined
): string {
  if (!account || !account.account_name) return "";

  // 1. Determine the Issuer / Bank prefix
  let instName =
    account.institution?.short_name ||
    account.institution?.name ||
    account.bank_name ||
    "";

  if (!instName && account.account_type) {
    switch (account.account_type) {
      case "CASH":
        instName = "Tiền mặt";
        break;
      case "E_WALLET":
        instName = "Ví điện tử";
        break;
      case "SAVINGS":
        instName = "Tiết kiệm";
        break;
      case "BANK_ACCOUNT":
        instName = "Ngân hàng";
        break;
      case "CREDIT_CARD":
        instName = "Thẻ tín dụng";
        break;
      case "DEBIT_CARD":
        instName = "Thẻ ghi nợ";
        break;
      default:
        instName = "";
    }
  }

  // 2. Determine masked number / last 4 suffix
  let numPart = "";
  if (account.card_number_last4 && account.card_number_last4.trim()) {
    const raw4 = account.card_number_last4.trim();
    numPart = raw4.startsWith("••••") || raw4.startsWith("****") ? raw4 : `•••• ${raw4}`;
  } else if (account.card_number_masked && account.card_number_masked.trim()) {
    numPart = account.card_number_masked.trim();
  }

  const nameWithNum = numPart ? `${account.account_name} (${numPart})` : account.account_name;

  return instName ? `${instName}: ${nameWithNum}` : nameWithNum;
}
