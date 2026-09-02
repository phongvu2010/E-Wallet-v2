import { Category, CategoryTreeNode } from "../types/category";
import { TransactionType } from "../types/transaction";

/**
 * Filter categories tree based on current transaction type.
 *
 * Rules:
 * - PURCHASE: Show only pure consumer spending (EXPENSE), excluding technical items (Trả góp, Tất toán, Thanh toán, Phí...).
 * - FEE: Show only Fee items (FEE_INTEREST, excluding Lãi suất).
 * - INTEREST: Show only Interest items (Lãi suất).
 * - REPAYMENT: Show Payment & Income settlement categories (Thanh toán dư nợ, Nạp tiền).
 * - INSTALLMENT_MONTHLY: Show Installment categories (Trả góp, Tất toán trả góp).
 * - INSTALLMENT_PRINCIPAL: Show Installment principal conversion (Chuyển đổi sang trả góp).
 * - REFUND: Show Adjustment / Refund (Hủy giao dịch) plus consumer categories for original expense refunding.
 * - CASHBACK_CREDIT: Show Cashback categories (Hoàn tiền Cashback).
 * - CASH_ADVANCE: Show Cash advance / Other expenses.
 * - ADJUSTMENT / TRANSFER: Show respective adjustment/transfer categories.
 */
export function filterCategoryTreeByTransactionType(
  tree: CategoryTreeNode[],
  txType: TransactionType
): CategoryTreeNode[] {
  if (!tree || tree.length === 0) return [];

  const cleanText = (s?: string) => (s || "").toLowerCase().trim();

  switch (txType) {
    case "PURCHASE":
      return tree
        .filter((parent) => parent.category_type === "EXPENSE" || cleanText(parent.name).includes("chi tiêu"))
        .map((parent) => ({
          ...parent,
          children: (parent.children || []).filter((child) => {
            const name = cleanText(child.name);
            // Exclude technical installment or payment items from normal purchases
            return (
              !name.includes("trả góp") &&
              !name.includes("tất toán") &&
              !name.includes("thanh toán") &&
              !name.includes("phí") &&
              !name.includes("lãi")
            );
          }),
        }))
        .filter((parent) => (parent.children && parent.children.length > 0) || !parent.parent_id);

    case "FEE":
      return tree
        .filter((parent) => parent.category_type === "FEE_INTEREST" || cleanText(parent.name).includes("phí"))
        .map((parent) => ({
          ...parent,
          children: (parent.children || []).filter((child) => {
            const name = cleanText(child.name);
            return !name.includes("lãi suất");
          }),
        }))
        .filter((parent) => (parent.children && parent.children.length > 0) || !parent.parent_id);

    case "INTEREST":
      return tree
        .filter((parent) => parent.category_type === "FEE_INTEREST" || cleanText(parent.name).includes("lãi"))
        .map((parent) => ({
          ...parent,
          children: (parent.children || []).filter((child) => cleanText(child.name).includes("lãi")),
        }))
        .filter((parent) => (parent.children && parent.children.length > 0) || !parent.parent_id);

    case "REPAYMENT":
      return tree
        .filter(
          (parent) =>
            parent.category_type === "TRANSFER" ||
            parent.category_type === "INCOME" ||
            cleanText(parent.name).includes("thanh toán") ||
            cleanText(parent.name).includes("thu nhập")
        )
        .map((parent) => ({
          ...parent,
          children: (parent.children || []).filter((child) => {
            const name = cleanText(child.name);
            return name.includes("thanh toán") || name.includes("nạp tiền");
          }),
        }))
        .filter((parent) => (parent.children && parent.children.length > 0) || !parent.parent_id);

    case "INSTALLMENT_MONTHLY":
      return tree
        .filter((parent) => parent.category_type === "EXPENSE" || cleanText(parent.name).includes("chi tiêu"))
        .map((parent) => ({
          ...parent,
          children: (parent.children || []).filter((child) => {
            const name = cleanText(child.name);
            return name.includes("trả góp") || name.includes("tất toán");
          }),
        }))
        .filter((parent) => (parent.children && parent.children.length > 0) || !parent.parent_id);

    case "INSTALLMENT_PRINCIPAL":
      return tree
        .filter((parent) => parent.category_type === "ADJUSTMENT" || cleanText(parent.name).includes("điều chỉnh"))
        .map((parent) => ({
          ...parent,
          children: (parent.children || []).filter((child) => cleanText(child.name).includes("chuyển đổi sang trả góp")),
        }))
        .filter((parent) => (parent.children && parent.children.length > 0) || !parent.parent_id);

    case "REFUND":
      return tree
        .map((parent) => ({
          ...parent,
          children: (parent.children || []).filter((child) => {
            const name = cleanText(child.name);
            // Allow "Hủy giao dịch" or original purchase categories
            return !name.includes("thanh toán") && !name.includes("phí") && !name.includes("lãi");
          }),
        }))
        .filter((parent) => (parent.children && parent.children.length > 0) || !parent.parent_id);

    case "CASHBACK_CREDIT":
      return tree
        .filter((parent) => parent.category_type === "INCOME" || cleanText(parent.name).includes("hoàn tiền"))
        .map((parent) => ({
          ...parent,
          children: (parent.children || []).filter((child) => cleanText(child.name).includes("hoàn tiền")),
        }))
        .filter((parent) => (parent.children && parent.children.length > 0) || !parent.parent_id);

    default:
      return tree;
  }
}

/**
 * Find default Category ID for a given transaction type.
 */
export function getDefaultCategoryForTransactionType(
  categories: Category[],
  txType: TransactionType
): string {
  if (!categories || categories.length === 0) return "";

  const clean = (s?: string) => (s || "").toLowerCase().trim();

  let targetKeywords: string[] = [];

  switch (txType) {
    case "REPAYMENT":
      targetKeywords = ["thanh toán dư nợ", "thanh toán"];
      break;
    case "INSTALLMENT_MONTHLY":
      targetKeywords = ["trả góp"];
      break;
    case "INSTALLMENT_PRINCIPAL":
      targetKeywords = ["chuyển đổi sang trả góp"];
      break;
    case "INTEREST":
      targetKeywords = ["lãi suất"];
      break;
    case "FEE":
      targetKeywords = ["phí thường niên", "phí sms", "phí chuyển đổi"];
      break;
    case "CASHBACK_CREDIT":
      targetKeywords = ["hoàn tiền cashback", "hoàn tiền"];
      break;
    case "REFUND":
      targetKeywords = ["hủy giao dịch"];
      break;
    case "CASH_ADVANCE":
      targetKeywords = ["rút tiền", "chi tiêu khác"];
      break;
    case "PURCHASE":
      targetKeywords = ["nhà hàng", "siêu thị", "chi tiêu khác"];
      break;
    default:
      break;
  }

  for (const kw of targetKeywords) {
    const found = categories.find((c) => clean(c.name).includes(kw));
    if (found) return found.id;
  }

  return "";
}

/**
 * Infer the appropriate Transaction Type from a selected Category.
 */
export function inferTransactionTypeFromCategory(
  category: Category | undefined
): TransactionType | null {
  if (!category) return null;

  const name = (category.name || "").toLowerCase().trim();
  const catType = category.category_type;

  if (name.includes("lãi suất")) {
    return "INTEREST";
  }
  if (catType === "FEE_INTEREST" || name.includes("phí")) {
    return "FEE";
  }
  if (name.includes("thanh toán dư nợ") || name.includes("nạp tiền") || catType === "TRANSFER") {
    return "REPAYMENT";
  }
  if (name.includes("hoàn tiền cashback") || name.includes("hoàn tiền")) {
    return "CASHBACK_CREDIT";
  }
  if (name.includes("hủy giao dịch")) {
    return "REFUND";
  }
  if (name.includes("chuyển đổi sang trả góp")) {
    return "INSTALLMENT_PRINCIPAL";
  }
  if (name === "trả góp" || name === "tất toán trả góp") {
    return "INSTALLMENT_MONTHLY";
  }
  if (catType === "EXPENSE") {
    return "PURCHASE";
  }

  return null;
}

/**
 * Transform category tree into grouped select options format.
 */
export function formatCategoryTreeToGroups(tree: CategoryTreeNode[]) {
  return tree.map((parent: CategoryTreeNode) => ({
    label: parent.name,
    options: [
      ...(parent.children && parent.children.length > 0
        ? parent.children.map((child: Category) => ({
            value: child.id,
            label: child.name,
          }))
        : [{ value: parent.id, label: `${parent.name} (Chung)` }]),
    ],
  }));
}
