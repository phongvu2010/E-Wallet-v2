import { Category, CategoryTreeNode } from "../types/category";
import { TransactionType } from "../types/transaction";

export type TransactionFlow = "EXPENSE" | "INCOME" | "TRANSFER" | "REPAYMENT";

/**
 * Filter categories tree based on high-level transaction flow.
 */
export function filterCategoryTreeByFlow(
  tree: CategoryTreeNode[],
  flow: TransactionFlow
): CategoryTreeNode[] {
  if (!tree || tree.length === 0) return [];

  switch (flow) {
    case "EXPENSE":
      return tree.filter(
        (parent) =>
          parent.category_type === "EXPENSE" ||
          parent.category_type === "FEE_INTEREST" ||
          parent.name.includes("Ăn uống") ||
          parent.name.includes("Mua sắm") ||
          parent.name.includes("Di chuyển") ||
          parent.name.includes("Hóa đơn") ||
          parent.name.includes("Sức khỏe") ||
          parent.name.includes("Giải trí") ||
          parent.name.includes("Phí & Lãi") ||
          parent.name.includes("Chi tiêu")
      );

    case "INCOME":
      return tree.filter(
        (parent) =>
          parent.category_type === "INCOME" ||
          parent.name.includes("Lương") ||
          parent.name.includes("Thu nhập") ||
          parent.name.includes("Hoàn tiền")
      );

    case "TRANSFER":
    case "REPAYMENT":
      return tree.filter(
        (parent) =>
          parent.category_type === "TRANSFER" ||
          parent.name.includes("Chuyển tiền") ||
          parent.name.includes("Thanh toán")
      );

    default:
      return tree;
  }
}

/**
 * Infer High-Level Transaction Flow from a technical TransactionType.
 */
export function inferFlowFromTransactionType(txType: TransactionType): TransactionFlow {
  switch (txType) {
    case "INCOME":
    case "CASHBACK_CREDIT":
      return "INCOME";
    case "TRANSFER":
      return "TRANSFER";
    case "REPAYMENT":
      return "REPAYMENT";
    case "PURCHASE":
    case "FEE":
    case "INTEREST":
    case "INSTALLMENT_MONTHLY":
    case "INSTALLMENT_PRINCIPAL":
    case "CASH_ADVANCE":
    case "REFUND":
    case "ADJUSTMENT":
    default:
      return "EXPENSE";
  }
}

/**
 * Filter categories tree based on technical transaction type (backward compatibility).
 */
export function filterCategoryTreeByTransactionType(
  tree: CategoryTreeNode[],
  txType: TransactionType
): CategoryTreeNode[] {
  const flow = inferFlowFromTransactionType(txType);
  return filterCategoryTreeByFlow(tree, flow);
}

/**
 * Find default Category ID for a given high-level flow or transaction type.
 */
export function getDefaultCategoryForFlow(
  categories: Category[],
  flow: TransactionFlow
): string {
  if (!categories || categories.length === 0) return "";

  const clean = (s?: string) => (s || "").toLowerCase().trim();

  let targetKeywords: string[] = [];

  switch (flow) {
    case "EXPENSE":
      targetKeywords = ["nhà hàng", "cà phê", "siêu thị", "ăn uống", "chi tiêu khác"];
      break;
    case "INCOME":
      targetKeywords = ["tiền lương hàng tháng", "tiền lương", "lương & thu nhập", "lương"];
      break;
    case "TRANSFER":
      targetKeywords = ["chuyển khoản nội bộ", "chuyển khoản", "chuyển tiền"];
      break;
    case "REPAYMENT":
      targetKeywords = ["thanh toán dư nợ thẻ", "thanh toán dư nợ", "thanh toán"];
      break;
  }

  for (const kw of targetKeywords) {
    const found = categories.find((c) => clean(c.name).includes(kw));
    if (found) return found.id;
  }

  // Fallback to first available category
  return categories[0]?.id || "";
}

export function getDefaultCategoryForTransactionType(
  categories: Category[],
  txType: TransactionType
): string {
  const flow = inferFlowFromTransactionType(txType);
  return getDefaultCategoryForFlow(categories, flow);
}

/**
 * Infer the appropriate Transaction Type from a selected Category and current Flow.
 */
export function inferTransactionTypeFromCategory(
  category: Category | undefined,
  currentFlow?: TransactionFlow
): TransactionType {
  if (currentFlow === "TRANSFER") return "TRANSFER";
  if (currentFlow === "REPAYMENT") return "REPAYMENT";

  if (!category) {
    return currentFlow === "INCOME" ? "INCOME" : "PURCHASE";
  }

  const name = (category.name || "").toLowerCase().trim();
  const catType = category.category_type;

  // Specific keyword detections
  if (name.includes("lãi suất") || name.includes("tiền lãi")) {
    return "INTEREST";
  }
  if (name.includes("phí thường niên") || name.includes("phí sms") || name.includes("phí dịch vụ") || name.includes("phí & lãi") || catType === "FEE_INTEREST") {
    return "FEE";
  }
  if (name.includes("thanh toán dư nợ") || name.includes("thanh toán thẻ")) {
    return "REPAYMENT";
  }
  if (name.includes("chuyển khoản") || name.includes("chuyển tiền") || catType === "TRANSFER") {
    return "TRANSFER";
  }
  if (name.includes("cashback") || name.includes("hoàn tiền cashback") || name.includes("điểm thưởng")) {
    return "CASHBACK_CREDIT";
  }
  if (name.includes("hủy đơn") || name.includes("hoàn đơn") || name.includes("refund")) {
    return "REFUND";
  }
  if (name.includes("chuyển đổi sang trả góp")) {
    return "INSTALLMENT_PRINCIPAL";
  }
  if (name.includes("trả góp định kỳ") || name.includes("trả góp")) {
    return "INSTALLMENT_MONTHLY";
  }
  if (name.includes("ứng tiền") || name.includes("rút tiền mặt")) {
    return "CASH_ADVANCE";
  }
  if (catType === "INCOME" || name.includes("lương") || name.includes("thu nhập") || name.includes("thưởng") || currentFlow === "INCOME") {
    return "INCOME";
  }
  if (catType === "ADJUSTMENT") {
    return "ADJUSTMENT";
  }

  return "PURCHASE";
}

/**
 * Resolve parent category ID and subcategory ID given any category ID.
 */
export function resolveCategoryHierarchy(
  categoryId: string | undefined,
  categories: Category[],
  categoryTree: CategoryTreeNode[]
): { parentId: string; subId: string } {
  if (!categoryId) return { parentId: "", subId: "" };

  const found = categories.find((c) => c.id === categoryId);
  if (!found) {
    const parentInTree = categoryTree.find((p) => p.id === categoryId);
    if (parentInTree) return { parentId: parentInTree.id, subId: "" };
    return { parentId: "", subId: "" };
  }

  if (found.parent_id) {
    return { parentId: found.parent_id, subId: found.id };
  } else {
    // It's a parent category
    return { parentId: found.id, subId: "" };
  }
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
