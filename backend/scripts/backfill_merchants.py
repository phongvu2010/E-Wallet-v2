import asyncio
import re
from sqlalchemy import text, select, update
from app.core.database import AsyncSessionLocal
from app.models.merchant import Merchant
from app.models.category import Category
from app.models.transaction import Transaction, TransactionTypeEnum
from app.models.loan import Loan
from app.models.debt import Debt, DebtRepayment
from app.models.installment import InstallmentPlan


async def run_backfill():
    async with AsyncSessionLocal() as db:
        print("=== 1. Updating stored procedure fn_early_settle_installment_plan ===")
        fn_sql = """
CREATE OR REPLACE FUNCTION fn_early_settle_installment_plan(
    p_plan_id UUID,
    p_statement_id UUID DEFAULT NULL,
    p_fee_percent DECIMAL DEFAULT 2.00,
    p_custom_fee DECIMAL DEFAULT NULL
)
RETURNS TABLE (
    plan_id UUID,
    product_name VARCHAR(150),
    settled_principal DECIMAL(15, 2),
    early_settlement_fee DECIMAL(15, 2),
    new_status installment_status_enum
)
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
    v_account_id UUID;
    v_user_id UUID;
    v_product_name VARCHAR(150);
    v_status installment_status_enum;
    v_remaining_balance DECIMAL(15, 2);
    v_merchant_id UUID;
    v_fee_amount DECIMAL(15, 2) := 0.00;
    v_installment_category_id UUID;
    v_fee_category_id UUID;
BEGIN
    SELECT account_id, user_id, installment_plans.product_name, status, remaining_balance, merchant_id
    INTO v_account_id, v_user_id, v_product_name, v_status, v_remaining_balance, v_merchant_id
    FROM installment_plans
    WHERE id = p_plan_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Gói trả góp với ID % không tồn tại.', p_plan_id;
    END IF;

    IF v_status != 'ACTIVE' THEN
        RAISE EXCEPTION 'Gói trả góp "%" không ở trạng thái ACTIVE (Trạng thái hiện tại: %).', v_product_name, v_status;
    END IF;

    IF v_remaining_balance <= 0 THEN
        RAISE EXCEPTION 'Gói trả góp "%" đã hết dư nợ.', v_product_name;
    END IF;

    IF p_custom_fee IS NOT NULL THEN
        v_fee_amount := p_custom_fee;
    ELSIF p_fee_percent > 0 THEN
        v_fee_amount := ROUND(v_remaining_balance * (p_fee_percent / 100.0), 2);
    END IF;

    SELECT id INTO v_installment_category_id 
    FROM categories 
    WHERE name IN ('Trả góp định kỳ thẻ', 'Trả góp', 'Chi tiêu khác') 
    ORDER BY (name = 'Trả góp định kỳ thẻ') DESC 
    LIMIT 1;

    SELECT id INTO v_fee_category_id
    FROM categories
    WHERE name IN ('Phí thường niên thẻ', 'Phí SMS & Dịch vụ tài khoản', 'Phí & Lãi ngân hàng', 'Phí & Lãi', 'Phí chuyển đổi trả góp')
    ORDER BY (name = 'Phí & Lãi ngân hàng') DESC 
    LIMIT 1;

    INSERT INTO transactions (
        user_id, account_id, statement_id, installment_plan_id, merchant_id, category_id,
        transaction_date, post_date, raw_description,
        transaction_type, amount, fee, total_amount, note, is_installment
    ) VALUES (
        v_user_id, v_account_id, p_statement_id, p_plan_id, v_merchant_id, v_installment_category_id,
        CURRENT_DATE, CURRENT_DATE, 'Tất toán trả góp trước hạn: ' || v_product_name,
        'INSTALLMENT_MONTHLY', v_remaining_balance, 0.00, v_remaining_balance,
        'Ghi nợ tất toán toàn bộ dư nợ trả góp trước hạn', TRUE
    );

    IF v_fee_amount > 0 THEN
        INSERT INTO transactions (
            user_id, account_id, statement_id, installment_plan_id, merchant_id, category_id,
            transaction_date, post_date, raw_description,
            transaction_type, amount, fee, total_amount, note, is_installment
        ) VALUES (
            v_user_id, v_account_id, p_statement_id, p_plan_id, v_merchant_id, v_fee_category_id,
            CURRENT_DATE, CURRENT_DATE, 'Phí tất toán trả góp trước hạn (' || p_fee_percent || '%): ' || v_product_name,
            'FEE', v_fee_amount, 0.00, v_fee_amount,
            'Phí phạt tất toán trả góp trước hạn', FALSE
        );
    END IF;

    UPDATE installment_schedules
    SET is_billed = TRUE,
        statement_id = COALESCE(p_statement_id, statement_id)
    WHERE installment_plan_id = p_plan_id AND is_billed = FALSE;

    UPDATE installment_plans
    SET remaining_balance = 0.00,
        status = 'EARLY_SETTLED'::installment_status_enum
    WHERE id = p_plan_id;

    RETURN QUERY
    SELECT p_plan_id, v_product_name, v_remaining_balance, v_fee_amount, 'EARLY_SETTLED'::installment_status_enum;
END;
$$;
"""
        await db.execute(text(fn_sql))
        await db.commit()
        print("  -> Stored procedure updated.")

        # Resolve 'Trả nợ vay' category
        print("\n=== 2. Resolving 'Trả nợ vay' category ===")
        cat_res = await db.execute(
            select(Category).where(
                Category.name.in_(["Trả nợ vay", "Trả nợ", "Trả nợ gốc", "Chuyển tiền & Trả nợ"])
            ).order_by((Category.name == "Trả nợ vay").desc()).limit(1)
        )
        repayment_category = cat_res.scalar_one_or_none()
        if not repayment_category:
            cat_res2 = await db.execute(select(Category).where(Category.name.ilike("%Trả nợ%")).limit(1))
            repayment_category = cat_res2.scalar_one_or_none()
        
        print(f"  -> Repayment category resolved: {repayment_category.name if repayment_category else 'None'} ({repayment_category.id if repayment_category else 'None'})")

        # Function helper to resolve or create merchant
        async def resolve_or_create_merchant(raw_name: str, cat_id=None) -> Merchant:
            cleaned = raw_name.strip()
            m_res = await db.execute(
                select(Merchant).where(Merchant.cleaned_name.ilike(cleaned)).limit(1)
            )
            merchant = m_res.scalar_one_or_none()
            if not merchant:
                merchant = Merchant(
                    cleaned_name=cleaned,
                    default_category_id=cat_id,
                )
                db.add(merchant)
                await db.flush()
                print(f"  [+] Created merchant: '{cleaned}' (ID: {merchant.id})")
            else:
                print(f"  [=] Found existing merchant: '{merchant.cleaned_name}' (ID: {merchant.id})")
            return merchant

        # 3. Backfill Loans
        print("\n=== 3. Backfilling Loans & Loan Transactions ===")
        loans_res = await db.execute(select(Loan))
        loans = loans_res.scalars().all()
        for loan in loans:
            merchant = await resolve_or_create_merchant(loan.loan_name, repayment_category.id if repayment_category else None)
            
            # Find transactions that match loan name
            txs_res = await db.execute(
                select(Transaction).where(
                    Transaction.raw_description.ilike(f"%{loan.loan_name}%")
                )
            )
            txs = txs_res.scalars().all()
            print(f"  Found {len(txs)} transactions matching loan '{loan.loan_name}'")
            for tx in txs:
                tx.merchant_id = merchant.id
                # If transaction is repayment, update category to 'Trả nợ vay'
                if repayment_category and (
                    "thanh toán" in (tx.raw_description or "").lower()
                    or "tất toán" in (tx.raw_description or "").lower()
                    or "trả nợ" in (tx.raw_description or "").lower()
                    or tx.transaction_type in [TransactionTypeEnum.DEBT_REPAY, TransactionTypeEnum.REPAYMENT]
                ):
                    tx.category_id = repayment_category.id
            await db.flush()

        # 4. Backfill Debts
        print("\n=== 4. Backfilling Debts & Debt Transactions ===")
        debts_res = await db.execute(select(Debt))
        debts = debts_res.scalars().all()
        for debt in debts:
            merchant = await resolve_or_create_merchant(debt.counterparty_name)
            
            # Collect transaction IDs linked via debt & debt repayments
            linked_tx_ids = set()
            if debt.origin_transaction_id:
                linked_tx_ids.add(debt.origin_transaction_id)
            
            rep_res = await db.execute(select(DebtRepayment).where(DebtRepayment.debt_id == debt.id))
            for rep in rep_res.scalars().all():
                if rep.transaction_id:
                    linked_tx_ids.add(rep.transaction_id)
                if rep.extra_transaction_id:
                    linked_tx_ids.add(rep.extra_transaction_id)
            
            # Also find transactions matching counterparty name
            txs_res = await db.execute(
                select(Transaction).where(
                    Transaction.raw_description.ilike(f"%{debt.counterparty_name}%")
                )
            )
            for tx in txs_res.scalars().all():
                linked_tx_ids.add(tx.id)

            if linked_tx_ids:
                txs_to_update = await db.execute(
                    select(Transaction).where(Transaction.id.in_(list(linked_tx_ids)))
                )
                tx_list = txs_to_update.scalars().all()
                print(f"  Found {len(tx_list)} transactions matching debt counterparty '{debt.counterparty_name}'")
                for tx in tx_list:
                    tx.merchant_id = merchant.id
            else:
                print(f"  Found 0 transactions matching debt counterparty '{debt.counterparty_name}'")
            await db.flush()

        # 5. Backfill Installment Plans
        print("\n=== 5. Backfilling Installment Plans ===")
        plans_res = await db.execute(select(InstallmentPlan))
        plans = plans_res.scalars().all()
        for plan in plans:
            if not plan.merchant_id and plan.product_name:
                merchant = await resolve_or_create_merchant(plan.product_name)
                plan.merchant_id = merchant.id
            elif plan.merchant_id:
                m_res = await db.execute(select(Merchant).where(Merchant.id == plan.merchant_id))
                merchant = m_res.scalar_one_or_none()
            else:
                merchant = None

            if merchant:
                # Update transactions associated with this installment plan
                txs_res = await db.execute(
                    select(Transaction).where(
                        (Transaction.installment_plan_id == plan.id) |
                        (Transaction.raw_description.ilike(f"%{plan.product_name}%"))
                    )
                )
                txs = txs_res.scalars().all()
                print(f"  Found {len(txs)} transactions for installment plan '{plan.product_name}'")
                for tx in txs:
                    if not tx.merchant_id:
                        tx.merchant_id = merchant.id
            await db.flush()

        await db.commit()
        print("\n=== Backfill completed successfully! ===")


if __name__ == "__main__":
    asyncio.run(run_backfill())
