export function formatCurrency(amount: number | undefined | null, currency: string = "VND"): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return "0 ₫";
  }

  if (currency.toUpperCase() === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  }

  // Format VND with comma grouping
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

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

export function getTransactionTypeLabel(type: string): { label: string; color: string } {
  switch (type) {
    case "PURCHASE":
      return { label: "Chi tiêu", color: "text-rose-400 bg-rose-500/10 border-rose-500/20" };
    case "REPAYMENT":
      return { label: "Thanh toán nợ", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
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
      return { label: "Chuyển khoản", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" };
    default:
      return { label: type, color: "text-slate-400 bg-slate-500/10 border-slate-500/20" };
  }
}
