import { AccountType } from "../types/account";
import { Debt, DebtType } from "../types/debt";
import { InterestMethod, LoanType } from "../types/loan";
import { TransactionType } from "../types/transaction";
import { TransactionFlow } from "./categoryHelpers";
import { formatCurrency } from "./formatters";

/**
 * Type representing form validation errors keyed by field name.
 */
export type FormErrors<T = Record<string, any>> = Partial<Record<keyof T | string, string>>;

/**
 * Check if a value is effectively empty (null, undefined, empty string, or whitespace only).
 */
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Safely parse numeric input (including string with commas/dots).
 */
export function parseNumeric(value: any): number {
  if (typeof value === "number") return isNaN(value) ? 0 : value;
  if (typeof value === "string") {
    // Remove non-numeric characters except '-' and '.'
    const cleaned = value.replace(/,/g, "").trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

/**
 * Check if a date string is a valid ISO date (YYYY-MM-DD).
 */
export function isValidDate(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== "string") return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

// ====================================================================
// STANDARD FORM VALIDATORS
// ====================================================================

/**
 * Validation schema for Creating/Editing Transactions.
 */
export interface TransactionFormValues {
  flow: TransactionFlow;
  transactionType: TransactionType;
  accountId: string;
  transferToAccountId?: string;
  transactionDate: string;
  amountVND: string | number;
  feeVND?: string | number;
  isForeignCurrency?: boolean;
  foreignAmount?: string | number;
  exchangeRate?: number;
  rawDescription?: string;
  categoryId?: string;
}

export function validateTransactionForm(values: TransactionFormValues): FormErrors<TransactionFormValues> {
  const errors: FormErrors<TransactionFormValues> = {};

  // 1. Source Account
  if (isEmpty(values.accountId)) {
    const msg = "Vui lòng chọn tài khoản nguồn";
    errors.accountId = msg;
    errors.account_id = msg;
  }

  // 2. Transaction Date
  if (isEmpty(values.transactionDate)) {
    const msg = "Vui lòng chọn ngày giao dịch";
    errors.transactionDate = msg;
    errors.transaction_date = msg;
  } else if (!isValidDate(values.transactionDate)) {
    const msg = "Định dạng ngày không hợp lệ (YYYY-MM-DD)";
    errors.transactionDate = msg;
    errors.transaction_date = msg;
  }

  // 3. Amount VND
  const parsedAmt = parseNumeric(values.amountVND);
  if (parsedAmt <= 0) {
    const msg = "Số tiền giao dịch phải lớn hơn 0 VNĐ";
    errors.amountVND = msg;
    errors.amount = msg;
  }

  // 4. Foreign Currency validation
  if (values.isForeignCurrency) {
    const fAmt = parseNumeric(values.foreignAmount);
    if (fAmt <= 0) {
      const msg = "Vui lòng nhập số tiền nguyên tệ hợp lệ (> 0)";
      errors.foreignAmount = msg;
      errors.foreign_amount = msg;
    }
  }

  // 5. Transfer / Repayment Destination Account
  if (values.flow === "TRANSFER" || values.flow === "REPAYMENT") {
    if (isEmpty(values.transferToAccountId)) {
      const msg =
        values.flow === "TRANSFER"
          ? "Vui lòng chọn tài khoản / ví nhận tiền"
          : "Vui lòng chọn thẻ tín dụng cần thanh toán";
      errors.transferToAccountId = msg;
      errors.transfer_to_account_id = msg;
    } else if (values.transferToAccountId === values.accountId) {
      const msg =
        values.flow === "TRANSFER"
          ? "Tài khoản nhận tiền phải khác tài khoản nguồn chuyển đi"
          : "Thẻ nhận thanh toán phải khác tài khoản trích tiền";
      errors.transferToAccountId = msg;
      errors.transfer_to_account_id = msg;
    }
  }

  return errors;
}

/**
 * Validation schema for Creating Personal Debt (Borrowing / Lending).
 */
export interface DebtFormValues {
  debtType: DebtType;
  counterpartyName: string;
  counterpartyPhone?: string;
  principalAmount?: number | string;
  startDate: string;
  dueDate?: string;
  accountId?: string;
  note?: string;
}

export function validateDebtForm(values: DebtFormValues): FormErrors<DebtFormValues> {
  const errors: FormErrors<DebtFormValues> = {};

  if (isEmpty(values.counterpartyName)) {
    errors.counterpartyName = "Vui lòng nhập tên người vay / cho vay";
  } else if (values.counterpartyName.trim().length < 2) {
    errors.counterpartyName = "Tên người vay / cho vay phải có ít nhất 2 ký tự";
  }

  const amt = parseNumeric(values.principalAmount);
  if (amt <= 0) {
    errors.principalAmount = "Vui lòng nhập số tiền gốc hợp lệ (> 0 VNĐ)";
  }

  if (isEmpty(values.startDate)) {
    errors.startDate = "Vui lòng chọn ngày bắt đầu ghi nợ";
  } else if (!isValidDate(values.startDate)) {
    errors.startDate = "Ngày bắt đầu không đúng định dạng YYYY-MM-DD";
  }

  if (!isEmpty(values.dueDate)) {
    if (!isValidDate(values.dueDate!)) {
      errors.dueDate = "Hạn trả nợ không đúng định dạng YYYY-MM-DD";
    } else if (values.dueDate! < values.startDate) {
      errors.dueDate = "Hạn trả nợ không được diễn ra trước ngày bắt đầu";
    }
  }

  if (values.counterpartyPhone && values.counterpartyPhone.trim().length > 0) {
    const phoneRegex = /^[0-9+()\-.\s]{8,20}$/;
    if (!phoneRegex.test(values.counterpartyPhone.trim())) {
      errors.counterpartyPhone = "Số điện thoại không đúng định dạng";
    }
  }

  return errors;
}

/**
 * Validation schema for Repaying Personal Debt.
 */
export interface RepayDebtFormValues {
  repaymentDate: string;
  principalPaid?: number | string;
  extraAmount?: number | string;
  accountId?: string;
  extraCategoryId?: string;
  note?: string;
}

export function validateRepayDebtForm(
  values: RepayDebtFormValues,
  debt: Debt
): FormErrors<RepayDebtFormValues> {
  const errors: FormErrors<RepayDebtFormValues> = {};

  if (isEmpty(values.repaymentDate)) {
    errors.repaymentDate = "Vui lòng chọn ngày trả / thu nợ";
  } else if (!isValidDate(values.repaymentDate)) {
    errors.repaymentDate = "Ngày trả nợ không hợp lệ";
  }

  const pPaid = parseNumeric(values.principalPaid);
  if (pPaid <= 0) {
    errors.principalPaid = "Vui lòng nhập số tiền gốc trả/thu hợp lệ (> 0 VNĐ)";
  } else if (pPaid > debt.remaining_amount) {
    errors.principalPaid = `Số tiền gốc trả (${formatCurrency(
      pPaid
    )}) vượt quá dư nợ còn lại (${formatCurrency(
      debt.remaining_amount
    )}). Vui lòng điền phần trả dôi dư vào ô "Tiền bồi dưỡng / Cảm ơn"!`;
  }

  const extra = parseNumeric(values.extraAmount);
  if (extra < 0) {
    errors.extraAmount = "Tiền bồi dưỡng / lãi không được âm";
  }

  return errors;
}

/**
 * Validation schema for Creating Financial Loan (Bank loan).
 */
export interface LoanFormValues {
  loanName: string;
  loanCode?: string;
  institutionId?: string;
  accountId?: string;
  loanType: LoanType;
  interestMethod: InterestMethod;
  principalAmount: number | string;
  termMonths: number | string;
  startDate: string;
  billingDay: number | string;
  interestRate: number | string;
  monthlyFee?: number | string;
  note?: string;
}

export function validateLoanForm(values: LoanFormValues): FormErrors<LoanFormValues> {
  const errors: FormErrors<LoanFormValues> = {};

  if (isEmpty(values.loanName)) {
    errors.loanName = "Vui lòng nhập tên gói vay";
  } else if (values.loanName.trim().length < 3) {
    errors.loanName = "Tên gói vay phải có ít nhất 3 ký tự";
  }

  const p = parseNumeric(values.principalAmount);
  if (p <= 0) {
    errors.principalAmount = "Số tiền vay phải lớn hơn 0 VNĐ";
  }

  const term = parseNumeric(values.termMonths);
  if (term <= 0 || !Number.isInteger(term)) {
    errors.termMonths = "Thời hạn vay phải là số nguyên dương (> 0 tháng)";
  } else if (term > 600) {
    errors.termMonths = "Thời hạn vay không được vượt quá 600 tháng (50 năm)";
  }

  const rate = parseNumeric(values.interestRate);
  if (rate < 0) {
    errors.interestRate = "Lãi suất không được là số âm";
  } else if (rate > 100) {
    errors.interestRate = "Lãi suất hàng năm không hợp lệ (> 100%/năm)";
  }

  const billing = parseNumeric(values.billingDay);
  if (billing < 1 || billing > 31 || !Number.isInteger(billing)) {
    errors.billingDay = "Ngày thanh toán hàng tháng phải từ 1 đến 31";
  }

  if (isEmpty(values.startDate)) {
    errors.startDate = "Vui lòng chọn ngày giải ngân / bắt đầu vay";
  } else if (!isValidDate(values.startDate)) {
    errors.startDate = "Ngày giải ngân không đúng định dạng YYYY-MM-DD";
  }

  const fee = parseNumeric(values.monthlyFee);
  if (fee < 0) {
    errors.monthlyFee = "Phí quản lý hàng tháng không được là số âm";
  }

  return errors;
}

/**
 * Validation schema for Adjusting Floating Loan Interest Rate.
 */
export interface AdjustLoanRateFormValues {
  effectiveDate: string;
  newRate: number | string;
  note?: string;
}

export function validateAdjustLoanRateForm(
  values: AdjustLoanRateFormValues
): FormErrors<AdjustLoanRateFormValues> {
  const errors: FormErrors<AdjustLoanRateFormValues> = {};

  if (isEmpty(values.effectiveDate)) {
    errors.effectiveDate = "Vui lòng chọn ngày áp dụng lãi suất mới";
  } else if (!isValidDate(values.effectiveDate)) {
    errors.effectiveDate = "Ngày áp dụng không đúng định dạng YYYY-MM-DD";
  }

  const rate = parseNumeric(values.newRate);
  if (rate < 0) {
    errors.newRate = "Lãi suất mới không được là số âm";
  } else if (rate > 100) {
    errors.newRate = "Lãi suất hàng năm không hợp lệ (> 100%/năm)";
  }

  return errors;
}

/**
 * Validation schema for Creating Account / Wallet / Credit Card.
 */
export interface AccountFormValues {
  accountType: AccountType;
  accountName: string;
  institutionId?: string;
  accountNumber?: string;
  initialBalance?: string | number;
  creditLimit?: string | number;
  billingDay?: string | number;
  gracePeriod?: string | number;
  note?: string;
}

export function validateAccountForm(values: AccountFormValues): FormErrors<AccountFormValues> {
  const errors: FormErrors<AccountFormValues> = {};

  if (isEmpty(values.accountName)) {
    errors.accountName = "Vui lòng nhập tên tài khoản hoặc ví";
  } else if (values.accountName.trim().length < 2) {
    errors.accountName = "Tên tài khoản phải có ít nhất 2 ký tự";
  }

  if (values.accountType === "CREDIT_CARD") {
    const limit = parseNumeric(values.creditLimit);
    if (limit <= 0) {
      errors.creditLimit = "Thẻ tín dụng bắt buộc phải có hạn mức tín dụng > 0 VNĐ";
    }

    const billing = parseNumeric(values.billingDay);
    if (billing < 1 || billing > 31 || !Number.isInteger(billing)) {
      errors.billingDay = "Ngày chốt sao kê hàng tháng phải từ ngày 1 đến 31";
    }

    const grace = parseNumeric(values.gracePeriod);
    if (grace < 0 || grace > 60 || !Number.isInteger(grace)) {
      errors.gracePeriod = "Thời gian miễn lãi phải từ 0 đến 60 ngày";
    }
  }

  return errors;
}
