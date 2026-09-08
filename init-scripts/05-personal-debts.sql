-- ====================================================================
-- CREDIT WALLET 2.0 - PERSONAL DEBTS & P2P LENDING SCHEMA EXTENSION
-- ====================================================================

-- 1. ENUMS FOR PERSONAL DEBTS
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'debt_type_enum') THEN
        CREATE TYPE debt_type_enum AS ENUM (
            'BORROW', -- Mình đi vay người khác (Nợ phải trả / Liability)
            'LEND'    -- Mình cho người khác vay (Nợ phải thu / Asset Receivable)
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'debt_status_enum') THEN
        CREATE TYPE debt_status_enum AS ENUM (
            'ACTIVE',    -- Đang có dư nợ (Chưa trả hết / Chưa thu hết)
            'PAID_OFF',  -- Đã tất toán hoàn toàn
            'CANCELLED'  -- Đã hủy
        );
    END IF;
END $$;

-- 2. PERSONAL DEBTS TABLE (BẢNG SỔ NỢ DÂN SỰ)
CREATE TABLE IF NOT EXISTS debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID, -- Sẵn sàng cho Multi-tenant Supabase
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL, -- Tài khoản nhận tiền (khi đi vay) hoặc xuất tiền (khi cho vay)
    counterparty_name VARCHAR(150) NOT NULL, -- Tên người vay / người cho vay ("Bạn Nam", "Anh Tuấn", "Chị Mai")
    counterparty_phone VARCHAR(20),
    debt_type debt_type_enum NOT NULL DEFAULT 'BORROW', -- BORROW (Tôi đi vay) | LEND (Tôi cho vay)
    principal_amount DECIMAL(15, 2) NOT NULL CONSTRAINT chk_debt_principal CHECK (principal_amount > 0),
    remaining_amount DECIMAL(15, 2) NOT NULL CONSTRAINT chk_debt_remaining CHECK (remaining_amount >= 0),
    total_paid_principal DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    total_extra_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00, -- Tổng tiền bồi dưỡng / cảm ơn / lãi phát sinh
    start_date DATE NOT NULL,
    due_date DATE, -- Ngày hẹn trả (tùy chọn)
    status debt_status_enum NOT NULL DEFAULT 'ACTIVE',
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_debts_user_status ON debts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_debts_type ON debts(debt_type);
CREATE INDEX IF NOT EXISTS idx_debts_account ON debts(account_id);

-- 3. DEBT REPAYMENTS TABLE (LỊCH SỬ CÁC LẦN TRẢ NỢ / THU NỢ)
CREATE TABLE IF NOT EXISTS debt_repayments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debt_id UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL, -- Tài khoản trích tiền trả hoặc nhận tiền thu nợ
    repayment_date DATE NOT NULL,
    principal_paid DECIMAL(15, 2) NOT NULL CONSTRAINT chk_repayment_principal CHECK (principal_paid > 0),
    extra_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00 CONSTRAINT chk_repayment_extra CHECK (extra_amount >= 0), -- Tiền bồi dưỡng / cảm ơn / quà thêm
    total_amount DECIMAL(15, 2) NOT NULL, -- principal_paid + extra_amount
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL, -- Transaction cho phần gốc
    extra_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL, -- Transaction cho phần tiền bồi dưỡng/cảm ơn
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_debt_repayments_debt_id ON debt_repayments(debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_repayments_date ON debt_repayments(repayment_date DESC);

-- 4. CẬP NHẬT CHECK CONSTRAINT TRÊN BẢNG TRANSACTIONS (NẾU CẦN)
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS chk_transactions_sign_convention;
ALTER TABLE transactions ADD CONSTRAINT chk_transactions_sign_convention CHECK (
    (transaction_type IN ('REPAYMENT', 'REFUND', 'CASHBACK_CREDIT', 'INSTALLMENT_PRINCIPAL', 'DEBT_COLLECT') AND total_amount <= 0)
    OR
    (transaction_type IN ('PURCHASE', 'INSTALLMENT_MONTHLY', 'INTEREST', 'CASH_ADVANCE', 'TRANSFER', 'INCOME', 'DEBT_BORROW', 'DEBT_REPAY', 'DEBT_LEND') AND total_amount >= 0)
    OR
    (transaction_type IN ('ADJUSTMENT', 'FEE'))
);

-- 5. CẬP NHẬT VIEW v_account_live_balance VÀ v_net_worth_overview
-- Lưu ý: DROP CASCADE các view cũ trước để tránh lỗi PostgreSQL 42P16 (cannot change name of view column)
-- khi chèn thêm cột mới vào vị trí giữa view trên Supabase/PostgreSQL.
DROP VIEW IF EXISTS v_net_worth_overview CASCADE;
DROP VIEW IF EXISTS v_account_live_balance CASCADE;

CREATE OR REPLACE VIEW v_account_live_balance AS
WITH latest_statement_per_account AS (
    SELECT DISTINCT ON (s.account_id)
        s.account_id,
        s.id AS latest_statement_id,
        s.statement_date AS latest_statement_date,
        s.statement_balance AS latest_statement_balance,
        s.payment_due_date AS next_payment_due_date
    FROM statements s
    ORDER BY s.account_id, s.statement_date DESC
),
unbilled_transactions_summary AS (
    SELECT
        a.id AS account_id,
        COALESCE(SUM(CASE
            WHEN t.total_amount > 0 AND t.transaction_type != 'INCOME' THEN t.total_amount
            ELSE 0
        END), 0.00) AS unbilled_charges,
        COALESCE(SUM(CASE
            WHEN t.total_amount < 0 THEN ABS(t.total_amount)
            ELSE 0
        END), 0.00) AS unbilled_credits,
        COALESCE(SUM(t.total_amount), 0.00) AS unbilled_net_amount,
        COUNT(t.id) AS unbilled_transaction_count
    FROM accounts a
    LEFT JOIN latest_statement_per_account ls ON a.id = ls.account_id
    LEFT JOIN transactions t ON t.account_id = a.id
        AND t.statement_id IS NULL
        AND (
            ls.latest_statement_date IS NULL
            OR COALESCE(t.post_date, t.transaction_date) > ls.latest_statement_date
        )
    GROUP BY a.id
),
asset_account_flows AS (
    SELECT
        a.id AS account_id,
        -- Tiền vào (Inflows): Thu nhập + Hoàn tiền + Tiền chuyển đến + Tiền đi vay nhận về (DEBT_BORROW) + Tiền thu nợ cho vay (DEBT_COLLECT)
        COALESCE((
            SELECT SUM(t_in.amount)
            FROM transactions t_in
            WHERE t_in.account_id = a.id AND t_in.transaction_type IN ('INCOME', 'DEBT_BORROW')
        ), 0.00) +
        COALESCE((
            SELECT SUM(ABS(t_in_neg.amount))
            FROM transactions t_in_neg
            WHERE t_in_neg.account_id = a.id AND t_in_neg.transaction_type = 'DEBT_COLLECT'
        ), 0.00) +
        COALESCE((
            SELECT SUM(ABS(t_ref.amount))
            FROM transactions t_ref
            WHERE t_ref.account_id = a.id AND t_ref.transaction_type IN ('REFUND', 'CASHBACK_CREDIT')
        ), 0.00) +
        COALESCE((
            SELECT SUM(ABS(t_trans.amount))
            FROM transactions t_trans
            WHERE t_trans.transfer_to_account_id = a.id
        ), 0.00) AS total_inflows,

        -- Tiền ra (Outflows): Chi tiêu mua sắm + Phí + Chuyển đi + Trả nợ cá nhân (DEBT_REPAY) + Xuất tiền cho mượn (DEBT_LEND)
        COALESCE((
            SELECT SUM(t_out.total_amount)
            FROM transactions t_out
            WHERE t_out.account_id = a.id AND t_out.transaction_type IN ('PURCHASE', 'FEE', 'INTEREST', 'CASH_ADVANCE', 'DEBT_REPAY', 'DEBT_LEND')
        ), 0.00) +
        COALESCE((
            SELECT SUM(ABS(t_trans_out.total_amount))
            FROM transactions t_trans_out
            WHERE t_trans_out.account_id = a.id AND (t_trans_out.transaction_type IN ('TRANSFER', 'REPAYMENT') OR t_trans_out.transfer_to_account_id IS NOT NULL)
        ), 0.00) AS total_outflows
    FROM accounts a
)
SELECT
    a.id AS account_id,
    a.account_name,
    a.account_type,
    (a.account_type != 'CREDIT_CARD') AS is_asset,
    COALESCE(i.short_name, i.name, CASE
        WHEN a.account_type = 'CASH' THEN 'Ví Tiền Mặt'
        WHEN a.account_type = 'E_WALLET' THEN 'Ví Điện Tử'
        WHEN a.account_type = 'SAVINGS' THEN 'Tiết Kiệm'
        ELSE 'Ngân hàng'
    END) AS bank_name,
    a.card_number_masked,
    a.color_hex,
    a.initial_balance,
    a.credit_limit,
    COALESCE(ls.latest_statement_date, a.opened_date) AS latest_statement_date,
    COALESCE(ls.latest_statement_balance, 0.00) AS latest_statement_balance,
    uts.unbilled_charges,
    uts.unbilled_credits,
    uts.unbilled_net_amount,
    uts.unbilled_transaction_count,
    CASE
        WHEN a.account_type = 'CREDIT_CARD' THEN
            GREATEST(0.00, COALESCE(ls.latest_statement_balance, 0.00) + uts.unbilled_net_amount)
        ELSE
            GREATEST(0.00, COALESCE(a.initial_balance, 0.00) + COALESCE(aaf.total_inflows, 0.00) - COALESCE(aaf.total_outflows, 0.00))
    END AS live_current_balance,
    CASE
        WHEN a.account_type = 'CREDIT_CARD' THEN
            GREATEST(0.00, a.credit_limit - GREATEST(0.00, COALESCE(ls.latest_statement_balance, 0.00) + uts.unbilled_net_amount))
        ELSE
            GREATEST(0.00, COALESCE(a.initial_balance, 0.00) + COALESCE(aaf.total_inflows, 0.00) - COALESCE(aaf.total_outflows, 0.00))
    END AS live_available_limit,
    CASE
        WHEN a.account_type = 'CREDIT_CARD' AND a.credit_limit > 0 THEN
            ROUND((GREATEST(0.00, COALESCE(ls.latest_statement_balance, 0.00) + uts.unbilled_net_amount) / a.credit_limit) * 100.0, 2)
        ELSE 0.00
    END AS live_utilization_percentage,
    CASE
        WHEN a.account_type != 'CREDIT_CARD' THEN 'OPTIMAL (<30%)'
        WHEN a.credit_limit = 0 THEN 'NO_LIMIT'
        WHEN (GREATEST(0.00, COALESCE(ls.latest_statement_balance, 0.00) + uts.unbilled_net_amount) / a.credit_limit) > 0.70 THEN 'CRITICAL (>70%)'
        WHEN (GREATEST(0.00, COALESCE(ls.latest_statement_balance, 0.00) + uts.unbilled_net_amount) / a.credit_limit) > 0.50 THEN 'HIGH (>50%)'
        WHEN (GREATEST(0.00, COALESCE(ls.latest_statement_balance, 0.00) + uts.unbilled_net_amount) / a.credit_limit) > 0.30 THEN 'MODERATE (>30%)'
        ELSE 'OPTIMAL (<30%)'
    END AS live_risk_level,
    ls.next_payment_due_date,
    a.status
FROM accounts a
LEFT JOIN institutions i ON a.institution_id = i.id
LEFT JOIN latest_statement_per_account ls ON a.id = ls.account_id
LEFT JOIN unbilled_transactions_summary uts ON a.id = uts.account_id
LEFT JOIN asset_account_flows aaf ON a.id = aaf.account_id
ORDER BY (a.account_type = 'CREDIT_CARD') DESC, live_current_balance DESC;

-- 6. CẬP NHẬT VIEW v_net_worth_overview ĐỂ TÍNH TOÀN DIỆN CẢ NỢ DÂN SỰ & NỢ PHẢI THU
CREATE OR REPLACE VIEW v_net_worth_overview AS
WITH account_metrics AS (
    SELECT
        account_type,
        is_asset,
        live_current_balance,
        live_available_limit,
        credit_limit
    FROM v_account_live_balance
    WHERE status = 'ACTIVE'
),
debt_metrics AS (
    SELECT
        COALESCE(SUM(CASE WHEN debt_type = 'BORROW' AND status = 'ACTIVE' THEN remaining_amount ELSE 0.00 END), 0.00) AS total_personal_debt_borrow,
        COALESCE(SUM(CASE WHEN debt_type = 'LEND' AND status = 'ACTIVE' THEN remaining_amount ELSE 0.00 END), 0.00) AS total_personal_receivables_lend
    FROM debts
)
SELECT
    COALESCE(SUM(CASE WHEN is_asset = TRUE THEN live_current_balance ELSE 0.00 END), 0.00) AS total_liquid_assets,
    COALESCE(SUM(CASE WHEN account_type = 'BANK_ACCOUNT' THEN live_current_balance ELSE 0.00 END), 0.00) AS total_bank_assets,
    COALESCE(SUM(CASE WHEN account_type = 'CASH' THEN live_current_balance ELSE 0.00 END), 0.00) AS total_cash_assets,
    COALESCE(SUM(CASE WHEN account_type = 'E_WALLET' THEN live_current_balance ELSE 0.00 END), 0.00) AS total_ewallet_assets,
    COALESCE(SUM(CASE WHEN account_type = 'SAVINGS' THEN live_current_balance ELSE 0.00 END), 0.00) AS total_savings_assets,

    -- Khoản phải thu cá nhân (Tiền cho bạn bè mượn chưa thu hồi)
    COALESCE((SELECT total_personal_receivables_lend FROM debt_metrics), 0.00) AS total_personal_receivables,

    -- Dư nợ thẻ tín dụng
    COALESCE(SUM(CASE WHEN is_asset = FALSE THEN live_current_balance ELSE 0.00 END), 0.00) AS total_credit_debt,
    COALESCE(SUM(CASE WHEN is_asset = FALSE THEN credit_limit ELSE 0.00 END), 0.00) AS total_credit_limit,
    COALESCE(SUM(CASE WHEN is_asset = FALSE THEN live_available_limit ELSE 0.00 END), 0.00) AS total_available_credit,

    -- Dư nợ vay bạn bè cá nhân (Tiền đi vay chưa trả)
    COALESCE((SELECT total_personal_debt_borrow FROM debt_metrics), 0.00) AS total_personal_debt,

    -- TÀI SẢN RÒNG (NET WORTH) = (Tài sản thanh khoản + Phải thu cho vay) - (Nợ thẻ tín dụng + Nợ vay cá nhân)
    (
        COALESCE(SUM(CASE WHEN is_asset = TRUE THEN live_current_balance ELSE 0.00 END), 0.00) +
        COALESCE((SELECT total_personal_receivables_lend FROM debt_metrics), 0.00) -
        COALESCE(SUM(CASE WHEN is_asset = FALSE THEN live_current_balance ELSE 0.00 END), 0.00) -
        COALESCE((SELECT total_personal_debt_borrow FROM debt_metrics), 0.00)
    ) AS net_worth,

    COUNT(CASE WHEN is_asset = TRUE THEN 1 END) AS active_asset_accounts_count,
    COUNT(CASE WHEN is_asset = FALSE THEN 1 END) AS active_credit_cards_count
FROM account_metrics;

-- 7. SUPABASE RLS INTEGRATION (TÙY CHỌN CHO SUPABASE CLOUD MULTI-TENANT)
/*
ALTER TABLE debts
    ADD CONSTRAINT fk_debts_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_repayments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own debts"
    ON debts FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own debt repayments"
    ON debt_repayments FOR ALL
    USING (EXISTS (
        SELECT 1 FROM debts d
        WHERE d.id = debt_repayments.debt_id
          AND d.user_id = auth.uid()
    ));
*/
