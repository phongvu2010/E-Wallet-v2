-- ====================================================================
-- CREDIT WALLET 2.0 - DATABASE INITIALIZATION SCHEMA
-- PostgreSQL 16+ (Docker & Supabase Ready)
-- ====================================================================

-- Enable UUID & Trigram Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ====================================================================
-- ENUMS
-- ====================================================================
CREATE TYPE account_type_enum AS ENUM ('CREDIT_CARD', 'DEBIT_CARD', 'BANK_ACCOUNT', 'E_WALLET', 'CASH', 'SAVINGS');
CREATE TYPE account_status_enum AS ENUM ('ACTIVE', 'LOCKED', 'CLOSED', 'EXPIRED', 'REPLACED');
CREATE TYPE category_type_enum AS ENUM ('EXPENSE', 'INCOME', 'TRANSFER', 'ADJUSTMENT', 'FEE_INTEREST');
CREATE TYPE statement_status_enum AS ENUM ('OPEN', 'BILLED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE');
CREATE TYPE transaction_type_enum AS ENUM (
    'PURCHASE',              -- Chi tiêu mua sắm thông thường
    'INCOME',                -- Thu nhập (Lương, Thưởng, Lãi tiết kiệm, Thu nhập khác)
    'REPAYMENT',             -- Thanh toán dư nợ thẻ / Nạp tiền
    'INSTALLMENT_PRINCIPAL', -- Trừ số tiền gốc khi chuyển đổi sang trả góp (ghi có âm)
    'INSTALLMENT_MONTHLY',   -- Tiền trả góp định kỳ hàng tháng
    'FEE',                   -- Phí thường niên, phí SMS, phí chuyển đổi...
    'INTEREST',              -- Lãi suất phát sinh
    'REFUND',                -- Hoàn tiền đơn hàng hủy
    'CASHBACK_CREDIT',       -- Tiền hoàn Cashback ghi có vào thẻ
    'CASH_ADVANCE',          -- Ứng tiền mặt
    'ADJUSTMENT',            -- Điều chỉnh giao dịch
    'TRANSFER'               -- Chuyển tiền nội bộ giữa các tài khoản
);
CREATE TYPE installment_status_enum AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED', 'EARLY_SETTLED');
CREATE TYPE reward_type_enum AS ENUM ('POINT', 'CASHBACK', 'MILE');
CREATE TYPE loan_type_enum AS ENUM ('MORTGAGE', 'CONSUMER', 'AUTO', 'BUSINESS', 'OVERDRAFT', 'OTHER');
CREATE TYPE interest_method_enum AS ENUM ('REDUCING_BALANCE', 'EQUAL_INSTALLMENT', 'FLAT');
CREATE TYPE loan_status_enum AS ENUM ('ACTIVE', 'PAID_OFF', 'OVERDUE', 'CANCELLED');
CREATE TYPE loan_schedule_status_enum AS ENUM ('UNPAID', 'PAID', 'OVERDUE');

-- ====================================================================
-- 1. INSTITUTIONS (TỔ CHỨC TÀI CHÍNH / NGÂN HÀNG)
-- ====================================================================
CREATE TABLE institutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) UNIQUE NOT NULL, -- 'SHINHAN', 'HSBC', 'SACOMBANK'
    name VARCHAR(100) NOT NULL,
    short_name VARCHAR(50),
    logo_url VARCHAR(255),
    hotline VARCHAR(20),
    website VARCHAR(150),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- 2. ACCOUNTS (TÀI KHOẢN / THẺ TÍN DỤNG)
-- ====================================================================
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID, -- Sẵn sàng cho Supabase auth.users(id) / Multi-tenant
    institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
    account_name VARCHAR(100) NOT NULL, -- "Shinhan Hi-Point Gold", "Vietcombank Priority", "Ví Tiền Mặt"
    account_type account_type_enum NOT NULL DEFAULT 'CREDIT_CARD',
    card_number_masked VARCHAR(25) DEFAULT '', -- "4696 72xx xxxx 2958", "0123456789" (hoặc chuỗi rỗng nếu là ví tiền mặt)
    card_number_last4 VARCHAR(4) DEFAULT '', -- "2958", "0642", "6789"
    initial_balance DECIMAL(15, 2) DEFAULT 0.00, -- Số dư ban đầu khi mở tài khoản/ví (VND)
    credit_limit DECIMAL(15, 2) DEFAULT 0.00 CONSTRAINT chk_accounts_credit_limit CHECK (credit_limit >= 0), -- Hạn mức tín dụng (VND)
    billing_day_of_month INT CHECK (billing_day_of_month BETWEEN 1 AND 31), -- Ngày chốt sao kê danh nghĩa (ví dụ: ngày 20)
    grace_period_days INT DEFAULT 15 CONSTRAINT chk_accounts_grace_period CHECK (grace_period_days >= 0), -- Số ngày gia hạn thanh toán sau sao kê
    status account_status_enum DEFAULT 'ACTIVE',

    -- Xử lý trường hợp Cấp lại thẻ / Đổi thẻ (Card Reissuance)
    replaces_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL, -- Trỏ tới thẻ cũ đã bị thay thế/hết hạn
    opened_date DATE, -- Ngày mở thẻ
    closed_date DATE, -- Ngày đóng/hủy thẻ (khi được thay thế bởi thẻ mới)

    color_hex VARCHAR(7) DEFAULT '#3b82f6',
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- 3. CATEGORIES (DANH MỤC PHÂN CẤP)
-- ====================================================================
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    user_id UUID, -- NULL nếu là danh mục mặc định của hệ thống (is_system = TRUE), có giá trị nếu do user tự tạo
    name VARCHAR(100) NOT NULL, -- "Nhà hàng & F&B", "Dịch vụ số & Ứng dụng"
    category_type category_type_enum NOT NULL DEFAULT 'EXPENSE',
    icon VARCHAR(50),
    color VARCHAR(20),
    is_system BOOLEAN DEFAULT FALSE, -- Danh mục mặc định của hệ thống
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_category_parent_name_user UNIQUE NULLS NOT DISTINCT (parent_id, name, user_id)
);

-- ====================================================================
-- 4. MERCHANTS & ALIASES (ĐƠN VỊ CHẤP NHẬN THẺ & QUY TẮC MAPPING)
-- ====================================================================
CREATE TABLE merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cleaned_name VARCHAR(100) NOT NULL UNIQUE, -- "Ministop", "Shopee", "Starbucks" (Chống trùng lặp)
    default_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    website VARCHAR(150),
    logo_url VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Bảng mapping chuỗi sao kê gốc (raw pattern) sang Merchant chuẩn hóa
CREATE TABLE merchant_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    pattern VARCHAR(150) NOT NULL UNIQUE, -- Ví dụ: 'PAYOO*MINISTOP%', 'CTY TNHH MINISTOP VN%', 'SHOPEE%'
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- 5. STATEMENTS (KỲ SAO KÊ)
-- ====================================================================
CREATE TABLE statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID, -- Sẵn sàng cho Supabase auth.users(id) / Multi-tenant
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    statement_date DATE NOT NULL, -- Ngày lập sao kê (VD: 2026-08-17)
    start_date DATE NOT NULL, -- Ngày bắt đầu chu kỳ
    end_date DATE NOT NULL, -- Ngày kết thúc chu kỳ
    payment_due_date DATE NOT NULL, -- Ngày đến hạn thanh toán
    credit_limit DECIMAL(15, 2) NOT NULL,

    -- Dữ liệu tài chính sao kê
    previous_balance DECIMAL(15, 2) DEFAULT 0.00, -- Dư nợ kỳ trước
    purchases_amount DECIMAL(15, 2) DEFAULT 0.00, -- Mua sắm & rút tiền trong kỳ
    installments_amount DECIMAL(15, 2) DEFAULT 0.00, -- Trả góp trong kỳ
    fees_and_charges DECIMAL(15, 2) DEFAULT 0.00, -- Tổng phí & lãi
    payments_received DECIMAL(15, 2) DEFAULT 0.00, -- Tổng tiền đã thanh toán vào thẻ
    statement_balance DECIMAL(15, 2) NOT NULL, -- Dư nợ cuối kỳ
    minimum_payment DECIMAL(15, 2) NOT NULL, -- Thanh toán tối thiểu
    surplus_amount DECIMAL(15, 2) DEFAULT 0.00, -- Dư có

    status statement_status_enum DEFAULT 'BILLED',
    source_file_path VARCHAR(255), -- "data/Shinhan Bank/076_credit_20082026_P000480198.pdf"
    file_hash VARCHAR(64), -- SHA-256 chống import trùng lặp
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_account_statement UNIQUE (account_id, statement_date)
);

-- ====================================================================
-- 6. TRANSACTIONS (GIAO DỊCH)
-- ====================================================================
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID, -- Sẵn sàng cho Supabase auth.users(id) / Multi-tenant
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    statement_id UUID REFERENCES statements(id) ON DELETE SET NULL, -- Kỳ sao kê chứa giao dịch này

    -- Liên kết Trả góp, Chuyển tiền & Kỳ sao kê được thanh toán
    installment_plan_id UUID, -- Sẽ gắn foreign key tới installment_plans(id) ở mục 7
    transfer_to_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL, -- Tài khoản đích nếu là giao dịch thanh toán/nạp tiền
    settles_statement_id UUID REFERENCES statements(id) ON DELETE SET NULL, -- Kỳ sao kê được thanh toán bởi giao dịch REPAYMENT này

    transaction_date DATE NOT NULL, -- Ngày quẹt thẻ / giao dịch
    post_date DATE, -- Ngày hệ thống ghi nợ (Post date)

    raw_description VARCHAR(500), -- Chuỗi gốc từ sao kê: "STARBUCKS SU VAN HANH" (Tùy chọn với giao dịch nhập tay)
    merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    transaction_type transaction_type_enum NOT NULL DEFAULT 'PURCHASE',

    -- Hỗ trợ Giao dịch Ngoại tệ & Đa tiền tệ (Foreign Currency)
    original_amount DECIMAL(15, 2), -- Số tiền nguyên tệ (VD: 15.99 USD, 1500 JPY)
    original_currency VARCHAR(3) DEFAULT 'VND', -- Đơn vị tiền tệ gốc (VND, USD, EUR, SGD, JPY...)
    exchange_rate DECIMAL(18, 6) DEFAULT 1.0000, -- Tỷ giá quy đổi tại ngày hạch toán (VD: 25450.0000)
    foreign_fee DECIMAL(15, 2) DEFAULT 0.00, -- Phí xử lý giao dịch ngoại tệ (VND)

    -- Số tiền giao dịch quy đổi (VND)
    -- Quy ước dấu tiền tệ (Sign Convention):
    --   (+) Mang dấu Dương đối với khoản nợ / chi tiêu: PURCHASE, FEE, INTEREST, INSTALLMENT_MONTHLY, CASH_ADVANCE, ADJUSTMENT, TRANSFER
    --   (-) Mang dấu Âm đối với khoản ghi có / giảm nợ: REPAYMENT, REFUND, CASHBACK_CREDIT, INSTALLMENT_PRINCIPAL
    amount DECIMAL(15, 2) NOT NULL, -- Số tiền gốc quy đổi (VND)
    fee DECIMAL(15, 2) DEFAULT 0.00, -- Phí đi kèm (VND)
    total_amount DECIMAL(15, 2) NOT NULL, -- amount + fee (mang dấu tương ứng với loại giao dịch)

    note TEXT, -- Ghi chú cá nhân
    is_installment BOOLEAN DEFAULT FALSE,
    tx_fingerprint VARCHAR(64) UNIQUE, -- SHA-256 fingerprint chống trùng lặp giao dịch (Idempotency)
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_transactions_sign_convention CHECK (
        (transaction_type IN ('REPAYMENT', 'REFUND', 'CASHBACK_CREDIT', 'INSTALLMENT_PRINCIPAL') AND total_amount <= 0)
        OR
        (transaction_type IN ('PURCHASE', 'INSTALLMENT_MONTHLY', 'INTEREST', 'CASH_ADVANCE', 'TRANSFER', 'INCOME') AND total_amount >= 0)
        OR
        (transaction_type IN ('ADJUSTMENT', 'FEE')) -- Cho phép FEE mang dấu âm khi hoàn phí
    )
);

-- Trigger Function tự động sinh SHA-256 Fingerprint cho giao dịch nếu chưa được cung cấp
CREATE OR REPLACE FUNCTION fn_generate_tx_fingerprint()
RETURNS TRIGGER AS $$
DECLARE
    v_occ_idx INT;
BEGIN
    IF NEW.tx_fingerprint IS NULL OR NEW.tx_fingerprint = '' THEN
        -- Đếm xem trước đó trong cùng ngày đã có bao nhiêu giao dịch giống hệt như thế này
        SELECT COUNT(*) + 1 INTO v_occ_idx
        FROM transactions
        WHERE account_id = NEW.account_id
          AND transaction_date = NEW.transaction_date
          AND COALESCE(raw_description, '') = COALESCE(NEW.raw_description, '')
          AND total_amount = NEW.total_amount;

        -- Sinh SHA-256 fingerprint với đúng chỉ số xuất hiện thực tế (1, 2, 3...)
        NEW.tx_fingerprint := encode(
            digest(
                NEW.account_id::text || '|' ||
                NEW.transaction_date::text || '|' ||
                COALESCE(NEW.post_date::text, '') || '|' ||
                COALESCE(NEW.raw_description, '') || '|' ||
                NEW.total_amount::text || '|' ||
                COALESCE(NEW.original_amount::text, '') || '|' ||
                COALESCE(NEW.original_currency, 'VND') || '|' ||
                v_occ_idx::text,
                'sha256'
            ),
            'hex'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_tx_fingerprint
BEFORE INSERT ON transactions
FOR EACH ROW
EXECUTE FUNCTION fn_generate_tx_fingerprint();

-- ====================================================================
-- 7. INSTALLMENT PLANS & SCHEDULES (TRẢ GÓP)
-- ====================================================================
CREATE TABLE installment_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID, -- Sẵn sàng cho Supabase auth.users(id) / Multi-tenant
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    origin_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL, -- Giao dịch gốc được chuyển đổi sang trả góp
    product_name VARCHAR(150) NOT NULL, -- "Máy in 3D Qidi Q2 Combo", "iPhone 14 Pro"
    merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
    start_date DATE NOT NULL,

    total_amount DECIMAL(15, 2) NOT NULL CONSTRAINT chk_installment_total_amount CHECK (total_amount >= 0), -- Tổng số tiền trả góp (16,416,800 VND)
    conversion_fee DECIMAL(15, 2) DEFAULT 0.00, -- Phí chuyển đổi (655,030.32 VND)
    interest_rate_percent DECIMAL(5, 2) DEFAULT 0.00, -- 0% lãi suất
    term_months INT NOT NULL CONSTRAINT chk_installment_term_months CHECK (term_months > 0), -- 3, 6, 9, 12 tháng

    monthly_principal DECIMAL(15, 2) NOT NULL, -- Tiền gốc mỗi tháng
    monthly_interest DECIMAL(15, 2) DEFAULT 0.00,
    monthly_payment DECIMAL(15, 2) NOT NULL, -- Số tiền trả góp kỳ này (5,472,266.66)

    remaining_balance DECIMAL(15, 2) NOT NULL CONSTRAINT chk_installment_remaining_balance CHECK (remaining_balance >= 0), -- Dư nợ gốc còn lại
    status installment_status_enum DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Bổ sung Khóa ngoại từ transactions trỏ sang installment_plans (Liên kết 2 chiều an toàn)
ALTER TABLE transactions
    ADD CONSTRAINT fk_transactions_installment_plan
    FOREIGN KEY (installment_plan_id) REFERENCES installment_plans(id) ON DELETE SET NULL;

-- Chi tiết lịch từng kỳ trả góp
CREATE TABLE installment_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installment_plan_id UUID NOT NULL REFERENCES installment_plans(id) ON DELETE CASCADE,
    statement_id UUID REFERENCES statements(id) ON DELETE SET NULL,
    installment_index INT NOT NULL, -- Kỳ số (1, 2, 3...)
    total_installments INT NOT NULL, -- Tổng kỳ (3) -> "Kỳ 01/03"
    due_date DATE NOT NULL,
    principal_amount DECIMAL(15, 2) NOT NULL,
    interest_amount DECIMAL(15, 2) DEFAULT 0.00,
    total_installment_amount DECIMAL(15, 2) NOT NULL,
    is_billed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_plan_index UNIQUE (installment_plan_id, installment_index)
);

-- Trigger Function tự động cập nhật remaining_balance & status cho installment_plans
CREATE OR REPLACE FUNCTION fn_update_installment_remaining_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_plan_id UUID;
    v_total_amount DECIMAL(15, 2);
    v_billed_principal DECIMAL(15, 2);
    v_new_remaining DECIMAL(15, 2);
    v_current_status installment_status_enum;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        v_plan_id := OLD.installment_plan_id;
    ELSE
        v_plan_id := NEW.installment_plan_id;
    END IF;

    SELECT total_amount, status INTO v_total_amount, v_current_status
    FROM installment_plans
    WHERE id = v_plan_id;

    IF v_total_amount IS NOT NULL THEN
        SELECT COALESCE(SUM(principal_amount), 0.00) INTO v_billed_principal
        FROM installment_schedules
        WHERE installment_plan_id = v_plan_id AND is_billed = TRUE;

        v_new_remaining := GREATEST(0.00, v_total_amount - v_billed_principal);

        UPDATE installment_plans
        SET remaining_balance = v_new_remaining,
            status = CASE
                WHEN v_current_status IN ('CANCELLED', 'EARLY_SETTLED') THEN v_current_status
                WHEN v_new_remaining <= 0.00 THEN 'COMPLETED'::installment_status_enum
                WHEN v_new_remaining > 0.00 AND v_current_status = 'COMPLETED' THEN 'ACTIVE'::installment_status_enum
                ELSE status
            END
        WHERE id = v_plan_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_installment_remaining_balance
AFTER INSERT OR UPDATE OF is_billed, principal_amount OR DELETE ON installment_schedules
FOR EACH ROW
EXECUTE FUNCTION fn_update_installment_remaining_balance();

-- ====================================================================
-- STORED PROCEDURE / FUNCTION: TẤT TOÁN TRẢ GÓP TRƯỚC HẠN (EARLY SETTLEMENT)
-- ====================================================================
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
) AS $$
DECLARE
    v_account_id UUID;
    v_product_name VARCHAR(150);
    v_status installment_status_enum;
    v_remaining_balance DECIMAL(15, 2);
    v_fee_amount DECIMAL(15, 2) := 0.00;
    v_installment_category_id UUID;
    v_fee_category_id UUID;
BEGIN
    -- 1. Trích xuất thông tin gói trả góp
    SELECT account_id, installment_plans.product_name, status, remaining_balance
    INTO v_account_id, v_product_name, v_status, v_remaining_balance
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

    -- 2. Tính Phí tất toán trước hạn
    IF p_custom_fee IS NOT NULL THEN
        v_fee_amount := p_custom_fee;
    ELSIF p_fee_percent > 0 THEN
        v_fee_amount := ROUND(v_remaining_balance * (p_fee_percent / 100.0), 2);
    END IF;

    -- Lấy category_id của "Phí chuyển đổi trả góp" hoặc "Phí & Lãi"
    SELECT id INTO v_installment_category_id FROM categories WHERE name = 'Trả góp' LIMIT 1;
    SELECT id INTO v_fee_category_id
    FROM categories
    WHERE name = 'Phí chuyển đổi trả góp' OR name = 'Phí & Lãi'
    LIMIT 1;

    -- 3. Ghi nợ dư nợ tiền gốc tất toán còn lại vào bảng transactions
    INSERT INTO transactions (
        account_id, statement_id, installment_plan_id, category_id,
        transaction_date, post_date, raw_description,
        transaction_type, amount, fee, total_amount, note, is_installment
    ) VALUES (
        v_account_id, p_statement_id, p_plan_id, v_installment_category_id,
        CURRENT_DATE, CURRENT_DATE, 'Tất toán trả góp trước hạn: ' || v_product_name,
        'INSTALLMENT_MONTHLY', v_remaining_balance, 0.00, v_remaining_balance,
        'Ghi nợ tất toán toàn bộ dư nợ trả góp trước hạn', TRUE
    );

    -- 4. Ghi nợ Phí Tất toán trước hạn vào bảng transactions (nếu có)
    IF v_fee_amount > 0 THEN
        INSERT INTO transactions (
            account_id, statement_id, installment_plan_id, category_id,
            transaction_date, post_date, raw_description,
            transaction_type, amount, fee, total_amount, note, is_installment
        ) VALUES (
            v_account_id, p_statement_id, p_plan_id, v_fee_category_id,
            CURRENT_DATE, CURRENT_DATE, 'Phí tất toán trả góp trước hạn (' || p_fee_percent || '%): ' || v_product_name,
            'FEE', v_fee_amount, 0.00, v_fee_amount,
            'Phí phạt tất toán trả góp trước hạn', FALSE
        );
    END IF;

    -- 5. Cập nhật tất cả các kỳ chưa billed trong installment_schedules thành is_billed = TRUE
    UPDATE installment_schedules
    SET is_billed = TRUE,
        statement_id = COALESCE(p_statement_id, statement_id)
    WHERE installment_plan_id = p_plan_id AND is_billed = FALSE;

    -- 6. Cập nhật trạng thái gói trả góp thành EARLY_SETTLED và dư nợ gốc về 0.00
    UPDATE installment_plans
    SET remaining_balance = 0.00,
        status = 'EARLY_SETTLED'::installment_status_enum
    WHERE id = p_plan_id;

    RETURN QUERY
    SELECT p_plan_id, v_product_name, v_remaining_balance, v_fee_amount, 'EARLY_SETTLED'::installment_status_enum;
END;
$$ LANGUAGE plpgsql;

-- ====================================================================
-- 7.1. LOANS, LOAN SCHEDULES & RATE HISTORIES (GÓI VAY TÀI CHÍNH LÃI SUẤT THẢ NỔI)
-- ====================================================================
CREATE TABLE loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
    loan_name VARCHAR(150) NOT NULL,
    loan_code VARCHAR(50),
    loan_type loan_type_enum NOT NULL DEFAULT 'MORTGAGE',
    interest_method interest_method_enum NOT NULL DEFAULT 'EQUAL_INSTALLMENT',
    principal_amount DECIMAL(15, 2) NOT NULL CONSTRAINT chk_loan_principal CHECK (principal_amount > 0),
    term_months INT NOT NULL CONSTRAINT chk_loan_term CHECK (term_months > 0),
    start_date DATE NOT NULL,
    billing_day_of_month INT DEFAULT 15 CONSTRAINT chk_loan_billing_day CHECK (billing_day_of_month BETWEEN 1 AND 31),
    current_interest_rate DECIMAL(5, 2) NOT NULL CONSTRAINT chk_loan_rate CHECK (current_interest_rate >= 0),
    base_rate DECIMAL(5, 2) DEFAULT 0.00,
    floating_margin DECIMAL(5, 2) DEFAULT 0.00,
    monthly_fee DECIMAL(15, 2) DEFAULT 0.00,
    remaining_principal DECIMAL(15, 2) NOT NULL,
    total_paid_principal DECIMAL(15, 2) DEFAULT 0.00,
    total_paid_interest DECIMAL(15, 2) DEFAULT 0.00,
    total_projected_interest DECIMAL(15, 2) DEFAULT 0.00,
    status loan_status_enum NOT NULL DEFAULT 'ACTIVE',
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE loan_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    period_index INT NOT NULL,
    total_periods INT NOT NULL,
    due_date DATE NOT NULL,
    applied_interest_rate DECIMAL(5, 2) NOT NULL,
    beginning_balance DECIMAL(15, 2) NOT NULL,
    principal_amount DECIMAL(15, 2) NOT NULL,
    interest_amount DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
    monthly_fee DECIMAL(15, 2) DEFAULT 0.00,
    total_payment DECIMAL(15, 2) NOT NULL,
    ending_balance DECIMAL(15, 2) NOT NULL,
    status loan_schedule_status_enum NOT NULL DEFAULT 'UNPAID',
    paid_date DATE,
    paid_amount DECIMAL(15, 2),
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_loan_period UNIQUE (loan_id, period_index)
);

CREATE TABLE loan_rate_histories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    old_rate DECIMAL(5, 2) NOT NULL,
    new_rate DECIMAL(5, 2) NOT NULL,
    old_monthly_fee DECIMAL(15, 2) DEFAULT 0.00,
    new_monthly_fee DECIMAL(15, 2) DEFAULT 0.00,
    effective_from_period INT NOT NULL,
    effective_date DATE NOT NULL,
    reason VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loans_institution ON loans(institution_id);
CREATE INDEX idx_loan_schedules_loan_id ON loan_schedules(loan_id);
CREATE INDEX idx_loan_schedules_due_date ON loan_schedules(due_date);
CREATE INDEX idx_loan_rate_histories_loan_id ON loan_rate_histories(loan_id);

-- ====================================================================
-- 8. REWARD LEDGERS (ĐIỂM THƯỞNG, HOÀN TIỀN)
-- ====================================================================
CREATE TABLE reward_ledgers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID, -- Sẵn sàng cho Supabase auth.users(id) / Multi-tenant
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    statement_id UUID REFERENCES statements(id) ON DELETE CASCADE,
    reward_type reward_type_enum NOT NULL DEFAULT 'POINT',

    previous_remaining DECIMAL(15, 2) DEFAULT 0.00, -- Tồn đầu kỳ
    earned_this_month DECIMAL(15, 2) DEFAULT 0.00, -- Tích lũy trong kỳ
    used_this_month DECIMAL(15, 2) DEFAULT 0.00, -- Đã quy đổi / khấu trừ trong kỳ
    available_balance DECIMAL(15, 2) DEFAULT 0.00, -- Điểm khả dụng

    expiring_amount DECIMAL(15, 2) DEFAULT 0.00, -- Số điểm sắp hết hạn
    expiration_date DATE, -- Ngày hết hạn điểm

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_account_reward_statement UNIQUE (account_id, statement_id, reward_type)
);

-- ====================================================================
-- 9. INDEXES
-- ====================================================================
-- Index hỗ trợ Multi-tenancy & lọc theo user
CREATE INDEX idx_accounts_user ON accounts(user_id);
CREATE INDEX idx_categories_user ON categories(user_id);
CREATE INDEX idx_statements_user ON statements(user_id);
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_installment_plans_user ON installment_plans(user_id);
CREATE INDEX idx_reward_ledgers_user ON reward_ledgers(user_id);

-- Index hỗ trợ nghiệp vụ & liên kết bảng
CREATE INDEX idx_accounts_replaces ON accounts(replaces_account_id);
CREATE INDEX idx_merchant_aliases_merchant ON merchant_aliases(merchant_id);
CREATE INDEX idx_tx_account_date ON transactions(account_id, transaction_date DESC);
CREATE INDEX idx_tx_statement ON transactions(statement_id);
CREATE INDEX idx_tx_category ON transactions(category_id);
CREATE INDEX idx_tx_merchant ON transactions(merchant_id);
CREATE INDEX idx_tx_type ON transactions(transaction_type);
CREATE INDEX idx_tx_installment_plan ON transactions(installment_plan_id);
CREATE INDEX idx_tx_settles_statement ON transactions(settles_statement_id);
CREATE INDEX idx_tx_original_currency ON transactions(original_currency);
CREATE INDEX idx_tx_account_statement ON transactions(account_id, statement_id);
CREATE INDEX idx_statements_account_date ON statements(account_id, statement_date DESC);
CREATE INDEX idx_installment_account_status ON installment_plans(account_id, status);
CREATE INDEX idx_installment_sched_plan_billed ON installment_schedules(installment_plan_id, is_billed);

-- Trigram GIN Indexes hỗ trợ tìm kiếm khớp chuỗi sao kê thô và merchant pattern
CREATE INDEX idx_tx_raw_desc_trgm ON transactions USING gin (raw_description gin_trgm_ops);
CREATE INDEX idx_merchant_aliases_pattern_trgm ON merchant_aliases USING gin (pattern gin_trgm_ops);

-- Partial & Composite Indexes Tối ưu Hiệu năng (Performance Optimization)
-- 1. Tối ưu cực đại cho view v_account_live_balance khi quét giao dịch chưa lên sao kê
CREATE INDEX idx_tx_unbilled_live ON transactions (account_id, transaction_date, post_date, total_amount) WHERE statement_id IS NULL;
-- 2. Tối ưu cho view v_statement_payment_status khi tổng hợp thanh toán nợ
CREATE INDEX idx_tx_repayments ON transactions (account_id, transaction_date, total_amount) WHERE transaction_type = 'REPAYMENT';
-- 3. Tối ưu tìm kỳ sao kê mới nhất cho v_account_live_balance và v_credit_utilization
CREATE INDEX idx_statements_latest_lookup ON statements (account_id, statement_date DESC, statement_balance);
-- 4. Tối ưu sắp xếp và phân trang danh sách giao dịch
CREATE INDEX idx_tx_date_desc ON transactions (transaction_date DESC, created_at DESC);

-- ====================================================================
-- 10. ANALYTIC VIEWS (BÁO CÁO & ĐỐI SOÁT TÀI CHÍNH)
-- ====================================================================
-- View 1: Thống kê chi tiêu theo tháng và danh mục (Tự động bù trừ Hoàn tiền / Hủy giao dịch)
CREATE OR REPLACE VIEW v_monthly_category_spending AS
SELECT
    DATE_TRUNC('month', t.transaction_date)::DATE AS month,
    COALESCE(c.name, 'Chưa phân loại') AS category_name,
    COALESCE(parent_c.name, 'Chưa phân loại') AS parent_category_name,
    COUNT(t.id) AS transaction_count,
    SUM(t.total_amount) AS total_spending
FROM transactions t
LEFT JOIN categories c ON t.category_id = c.id
LEFT JOIN categories parent_c ON c.parent_id = parent_c.id
WHERE t.transaction_type IN (
    'PURCHASE',
    'INSTALLMENT_MONTHLY',
    'INSTALLMENT_PRINCIPAL',
    'FEE',
    'INTEREST',
    'CASH_ADVANCE',
    'REFUND',
    'ADJUSTMENT'
)
GROUP BY 1, 2, 3
ORDER BY 1 DESC, total_spending DESC;

-- View 2: Tổng quan tài khoản và tình trạng thẻ
CREATE OR REPLACE VIEW v_account_overview AS
SELECT
    a.id AS account_id,
    a.account_name,
    i.name AS bank_name,
    a.card_number_masked,
    a.credit_limit,
    COALESCE(latest_s.statement_balance, 0) AS latest_statement_balance,
    COALESCE(latest_s.payment_due_date, CURRENT_DATE) AS next_payment_due_date,
    a.status,
    a.replaces_account_id,
    rep_a.card_number_masked AS replaced_by_card_number
FROM accounts a
JOIN institutions i ON a.institution_id = i.id
LEFT JOIN accounts rep_a ON a.id = rep_a.replaces_account_id
LEFT JOIN LATERAL (
    SELECT statement_balance, payment_due_date
    FROM statements s
    WHERE s.account_id = a.id
    ORDER BY s.statement_date DESC
    LIMIT 1
) latest_s ON TRUE;

-- View 3: Báo cáo đối soát dư nợ sao kê với tổng số tiền giao dịch thực tế
CREATE OR REPLACE VIEW v_statement_reconciliation AS
SELECT
    s.id AS statement_id,
    a.account_name,
    a.card_number_masked,
    s.statement_date,
    s.previous_balance,
    s.purchases_amount,
    s.installments_amount,
    s.fees_and_charges,
    s.payments_received,
    s.statement_balance AS billed_statement_balance,
    COALESCE(SUM(t.total_amount), 0) AS net_period_transactions,
    (s.previous_balance + COALESCE(SUM(t.total_amount), 0)) AS expected_statement_balance,
    (s.statement_balance - (s.previous_balance + COALESCE(SUM(t.total_amount), 0))) AS discrepancy,
    CASE
        WHEN ABS(s.statement_balance - (s.previous_balance + COALESCE(SUM(t.total_amount), 0))) < 0.01 THEN 'MATCHED'
        ELSE 'DISCREPANCY'
    END AS reconciliation_status
FROM statements s
JOIN accounts a ON s.account_id = a.id
LEFT JOIN transactions t ON t.statement_id = s.id
GROUP BY s.id, a.account_name, a.card_number_masked, s.statement_date, s.previous_balance,
         s.purchases_amount, s.installments_amount, s.fees_and_charges, s.payments_received, s.statement_balance;

-- View 4: Theo dõi Tiến độ Thanh toán Sao kê (Payment Settlement Tracking)
CREATE OR REPLACE VIEW v_statement_payment_status AS
WITH statement_windows AS (
    SELECT
        s.id AS statement_id,
        s.account_id,
        s.statement_date,
        s.payment_due_date,
        s.statement_balance AS billed_amount,
        s.minimum_payment,
        -- Ngày bắt đầu nhận thanh toán: ngay sau ngày chốt sao kê
        s.statement_date AS payment_window_start,
        -- Ngày kết thúc nhận thanh toán: ngày chốt sao kê tiếp theo (nếu có) hoặc hạn thanh toán + 10 ngày
        COALESCE(
            LEAD(s.statement_date) OVER (PARTITION BY s.account_id ORDER BY s.statement_date ASC),
            s.payment_due_date + INTERVAL '10 days'
        ) AS payment_window_end
    FROM statements s
),
repayment_allocations AS (
    SELECT
        sw.statement_id,
        COALESCE(ABS(SUM(t.total_amount)), 0.00) AS total_paid_amount
    FROM statement_windows sw
    LEFT JOIN transactions t ON t.account_id = sw.account_id
        AND t.transaction_type = 'REPAYMENT'
        AND (
            -- 1. Ưu tiên khớp chính xác theo khóa ngoại settles_statement_id nếu có
            t.settles_statement_id = sw.statement_id
            OR
            -- 2. Fallback: Khớp theo khoảng thời gian thanh toán nợ của kỳ sao kê (nếu chưa gán settles_statement_id)
            (t.settles_statement_id IS NULL 
             AND t.transaction_date > sw.payment_window_start 
             AND t.transaction_date <= sw.payment_window_end)
        )
    GROUP BY sw.statement_id
)
SELECT
    s.id AS statement_id,
    a.id AS account_id,
    a.account_name,
    a.card_number_masked,
    s.statement_date,
    s.payment_due_date,
    s.statement_balance AS billed_amount,
    s.minimum_payment,
    -- Tổng số tiền đã thanh toán vào kỳ sao kê này
    COALESCE(ra.total_paid_amount, 0.00) AS total_paid_amount,
    -- Số tiền còn lại cần phải thanh toán
    GREATEST(0.00, s.statement_balance - COALESCE(ra.total_paid_amount, 0.00)) AS remaining_balance_to_pay,
    -- Trạng thái thanh toán động
    CASE
        WHEN s.statement_balance <= 0.00 THEN 'PAID'
        WHEN COALESCE(ra.total_paid_amount, 0.00) >= s.statement_balance THEN 'PAID'
        WHEN COALESCE(ra.total_paid_amount, 0.00) > 0.00 THEN 'PARTIALLY_PAID'
        WHEN CURRENT_DATE > s.payment_due_date THEN 'OVERDUE'
        ELSE 'BILLED'
    END AS payment_status,
    (s.payment_due_date - CURRENT_DATE) AS days_until_due
FROM statements s
JOIN accounts a ON s.account_id = a.id
LEFT JOIN repayment_allocations ra ON ra.statement_id = s.id;

-- View 5: Tỷ lệ Sử dụng Hạn mức Tín dụng & Đánh giá Rủi ro (Credit Utilization)
CREATE OR REPLACE VIEW v_credit_utilization AS
SELECT
    a.id AS account_id,
    a.account_name,
    i.short_name AS bank_name,
    a.card_number_masked,
    a.credit_limit,
    COALESCE(latest_s.statement_balance, 0.00) AS current_balance,
    GREATEST(0.00, a.credit_limit - COALESCE(latest_s.statement_balance, 0.00)) AS available_limit,
    ROUND((COALESCE(latest_s.statement_balance, 0.00) / a.credit_limit) * 100.0, 2) AS utilization_percentage,
    CASE
        WHEN (COALESCE(latest_s.statement_balance, 0.00) / a.credit_limit) > 0.70 THEN 'CRITICAL (>70%)'
        WHEN (COALESCE(latest_s.statement_balance, 0.00) / a.credit_limit) > 0.50 THEN 'HIGH (>50%)'
        WHEN (COALESCE(latest_s.statement_balance, 0.00) / a.credit_limit) > 0.30 THEN 'MODERATE (>30%)'
        ELSE 'OPTIMAL (<30%)'
    END AS risk_level
FROM accounts a
JOIN institutions i ON a.institution_id = i.id
LEFT JOIN LATERAL (
    SELECT statement_balance
    FROM statements s
    WHERE s.account_id = a.id
    ORDER BY s.statement_date DESC
    LIMIT 1
) latest_s ON TRUE
WHERE a.status = 'ACTIVE'
  AND a.credit_limit > 0;

-- View 6: Lịch Nhắc Thanh toán & Dòng tiền Sắp Đến Hạn (Upcoming Obligations)
CREATE OR REPLACE VIEW v_upcoming_payment_obligations AS
SELECT
    'STATEMENT' AS obligation_type,
    s.id AS reference_id,
    a.account_name,
    a.card_number_masked,
    s.payment_due_date AS due_date,
    (s.payment_due_date - CURRENT_DATE) AS days_remaining,
    s.statement_balance AS total_amount_due,
    s.minimum_payment AS minimum_amount_due,
    s.status::text AS payment_status
FROM statements s
JOIN accounts a ON s.account_id = a.id
WHERE s.payment_due_date >= CURRENT_DATE
  AND s.status IN ('BILLED', 'PARTIALLY_PAID', 'OVERDUE')

UNION ALL

SELECT
    'INSTALLMENT' AS obligation_type,
    sch.id AS reference_id,
    a.account_name,
    a.card_number_masked || ' (' || p.product_name || ' ' || sch.installment_index || '/' || sch.total_installments || ')',
    sch.due_date AS due_date,
    (sch.due_date - CURRENT_DATE) AS days_remaining,
    sch.total_installment_amount AS total_amount_due,
    sch.total_installment_amount AS minimum_amount_due,
    CASE WHEN sch.is_billed THEN 'BILLED' ELSE 'SCHEDULED' END AS payment_status
FROM installment_schedules sch
JOIN installment_plans p ON sch.installment_plan_id = p.id
JOIN accounts a ON p.account_id = a.id
WHERE sch.due_date >= CURRENT_DATE
  AND sch.is_billed = FALSE
  AND p.status = 'ACTIVE'
ORDER BY due_date ASC;

-- View 7: Dự phóng Dư nợ Trả góp Hàng tháng trong Tương lai (Installment Forecast)
CREATE OR REPLACE VIEW v_installment_monthly_forecast AS
SELECT
    TO_CHAR(sch.due_date, 'YYYY-MM') AS billing_month,
    COUNT(DISTINCT sch.installment_plan_id) AS active_plans_count,
    SUM(sch.principal_amount) AS total_principal_due,
    SUM(sch.interest_amount) AS total_interest_due,
    SUM(sch.total_installment_amount) AS total_monthly_payment
FROM installment_schedules sch
JOIN installment_plans p ON sch.installment_plan_id = p.id
WHERE p.status = 'ACTIVE' AND sch.is_billed = FALSE
GROUP BY TO_CHAR(sch.due_date, 'YYYY-MM')
ORDER BY billing_month ASC;

-- View 8: Dư nợ Thực tế Tức thời & Số dư Khả dụng Đa Tài khoản (Real-time Live Balance & Available Limit)
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
        -- Tổng chi tiêu, phí, lãi chưa lên sao kê (mang dấu dương)
        COALESCE(SUM(CASE
            WHEN t.total_amount > 0 AND t.transaction_type != 'INCOME' THEN t.total_amount
            ELSE 0
        END), 0.00) AS unbilled_charges,
        -- Tổng thanh toán, hoàn tiền chưa lên sao kê (lấy trị tuyệt đối)
        COALESCE(SUM(CASE
            WHEN t.total_amount < 0 THEN ABS(t.total_amount)
            ELSE 0
        END), 0.00) AS unbilled_credits,
        -- Chênh lệch ròng chưa lên sao kê
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
        -- Tiền vào (Inflows): Thu nhập trực tiếp + Hoàn tiền + Tiền chuyển đến từ tài khoản khác
        COALESCE((
            SELECT SUM(t_in.amount)
            FROM transactions t_in
            WHERE t_in.account_id = a.id AND t_in.transaction_type = 'INCOME'
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

        -- Tiền ra (Outflows): Chi tiêu mua sắm + Phí + Chuyển đi tài khoản khác / Nạp ví / Thanh toán thẻ
        COALESCE((
            SELECT SUM(t_out.total_amount)
            FROM transactions t_out
            WHERE t_out.account_id = a.id AND t_out.transaction_type IN ('PURCHASE', 'FEE', 'INTEREST', 'CASH_ADVANCE')
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
    -- Số dư hiện tại (Live Current Balance):
    --   - Đối với Thẻ tín dụng: Là dư nợ cần trả (Liability Debt)
    --   - Đối với Tài sản (Ngân hàng, Tiền mặt, Ví): Là số tiền khả dụng hiện có (Asset Balance)
    CASE
        WHEN a.account_type = 'CREDIT_CARD' THEN
            GREATEST(0.00, COALESCE(ls.latest_statement_balance, 0.00) + uts.unbilled_net_amount)
        ELSE
            GREATEST(0.00, COALESCE(a.initial_balance, 0.00) + COALESCE(aaf.total_inflows, 0.00) - COALESCE(aaf.total_outflows, 0.00))
    END AS live_current_balance,

    -- Hạn mức khả dụng / Số dư khả dụng (Live Available Limit / Balance):
    CASE
        WHEN a.account_type = 'CREDIT_CARD' THEN
            GREATEST(0.00, a.credit_limit - GREATEST(0.00, COALESCE(ls.latest_statement_balance, 0.00) + uts.unbilled_net_amount))
        ELSE
            GREATEST(0.00, COALESCE(a.initial_balance, 0.00) + COALESCE(aaf.total_inflows, 0.00) - COALESCE(aaf.total_outflows, 0.00))
    END AS live_available_limit,

    -- Tỷ lệ sử dụng hạn mức (Live Utilization Percentage - chỉ áp dụng cho Thẻ tín dụng):
    CASE
        WHEN a.account_type = 'CREDIT_CARD' AND a.credit_limit > 0 THEN
            ROUND((GREATEST(0.00, COALESCE(ls.latest_statement_balance, 0.00) + uts.unbilled_net_amount) / a.credit_limit) * 100.0, 2)
        ELSE 0.00
    END AS live_utilization_percentage,

    -- Phân loại mức độ rủi ro tức thời
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

-- View 9: Tổng quan Tài Sản Ròng Toàn diện (Net Worth & Wealth Distribution)
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
)
SELECT
    -- Tổng tài sản thanh khoản (Liquid Assets: Ngân hàng + Tiền mặt + Ví điện tử + Tiết kiệm)
    COALESCE(SUM(CASE WHEN is_asset = TRUE THEN live_current_balance ELSE 0.00 END), 0.00) AS total_liquid_assets,
    -- Bóc tách từng nhóm tài sản
    COALESCE(SUM(CASE WHEN account_type = 'BANK_ACCOUNT' THEN live_current_balance ELSE 0.00 END), 0.00) AS total_bank_assets,
    COALESCE(SUM(CASE WHEN account_type = 'CASH' THEN live_current_balance ELSE 0.00 END), 0.00) AS total_cash_assets,
    COALESCE(SUM(CASE WHEN account_type = 'E_WALLET' THEN live_current_balance ELSE 0.00 END), 0.00) AS total_ewallet_assets,
    COALESCE(SUM(CASE WHEN account_type = 'SAVINGS' THEN live_current_balance ELSE 0.00 END), 0.00) AS total_savings_assets,

    -- Tổng nghĩa vụ nợ thẻ tín dụng (Credit Card Debt)
    COALESCE(SUM(CASE WHEN is_asset = FALSE THEN live_current_balance ELSE 0.00 END), 0.00) AS total_credit_debt,
    COALESCE(SUM(CASE WHEN is_asset = FALSE THEN credit_limit ELSE 0.00 END), 0.00) AS total_credit_limit,
    COALESCE(SUM(CASE WHEN is_asset = FALSE THEN live_available_limit ELSE 0.00 END), 0.00) AS total_available_credit,

    -- TÀI SẢN RÒNG = Tổng Tài Sản Có - Tổng Nợ Thẻ
    (
        COALESCE(SUM(CASE WHEN is_asset = TRUE THEN live_current_balance ELSE 0.00 END), 0.00) -
        COALESCE(SUM(CASE WHEN is_asset = FALSE THEN live_current_balance ELSE 0.00 END), 0.00)
    ) AS net_worth,

    -- Đếm số lượng tài khoản theo từng nhóm
    COUNT(CASE WHEN is_asset = TRUE THEN 1 END) AS active_asset_accounts_count,
    COUNT(CASE WHEN is_asset = FALSE THEN 1 END) AS active_credit_cards_count
FROM account_metrics;

-- View 10: Thống kê Dòng tiền Thu - Chi - Thặng dư hàng tháng (Monthly Cash Flow)
CREATE OR REPLACE VIEW v_monthly_cash_flow AS
SELECT
    DATE_TRUNC('month', t.transaction_date)::DATE AS month,
    COALESCE(SUM(CASE WHEN t.transaction_type = 'INCOME' THEN t.amount ELSE 0.00 END), 0.00) AS total_income,
    COALESCE(SUM(CASE WHEN t.transaction_type IN ('PURCHASE', 'INSTALLMENT_MONTHLY', 'FEE', 'INTEREST', 'CASH_ADVANCE') THEN t.total_amount ELSE 0.00 END), 0.00) AS total_expense,
    (
        COALESCE(SUM(CASE WHEN t.transaction_type = 'INCOME' THEN t.amount ELSE 0.00 END), 0.00) -
        COALESCE(SUM(CASE WHEN t.transaction_type IN ('PURCHASE', 'INSTALLMENT_MONTHLY', 'FEE', 'INTEREST', 'CASH_ADVANCE') THEN t.total_amount ELSE 0.00 END), 0.00)
    ) AS net_savings,
    CASE
        WHEN COALESCE(SUM(CASE WHEN t.transaction_type = 'INCOME' THEN t.amount ELSE 0.00 END), 0.00) > 0 THEN
            ROUND((
                (
                    COALESCE(SUM(CASE WHEN t.transaction_type = 'INCOME' THEN t.amount ELSE 0.00 END), 0.00) -
                    COALESCE(SUM(CASE WHEN t.transaction_type IN ('PURCHASE', 'INSTALLMENT_MONTHLY', 'FEE', 'INTEREST', 'CASH_ADVANCE') THEN t.total_amount ELSE 0.00 END), 0.00)
                ) /
                COALESCE(SUM(CASE WHEN t.transaction_type = 'INCOME' THEN t.amount ELSE 0.00 END), 0.00)
            ) * 100.0, 2)
        ELSE 0.00
    END AS savings_rate_percent,
    COUNT(t.id) AS total_transactions_count
FROM transactions t
GROUP BY DATE_TRUNC('month', t.transaction_date)::DATE
ORDER BY month DESC;

-- ====================================================================
-- 11. SUPABASE INTEGRATION & ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================
-- Ghi chú dành cho môi trường phát triển:
-- 1. Khi chạy trên Docker PostgreSQL cục bộ (Local Development), các bảng
--    đã có sẵn cột `user_id UUID` và index tương ứng.
-- 2. Khi bạn triển khai dự án này lên Supabase (Cloud Production), hãy bỏ
--    comment toàn bộ khối lệnh bên dưới để kích hoạt liên kết auth.users(id)
--    và hệ thống phân quyền Row Level Security (RLS) bảo mật đa người dùng.
-- ====================================================================
/*
-- A. Gắn khóa ngoại tới bảng auth.users(id) của Supabase
ALTER TABLE accounts
    ADD CONSTRAINT fk_accounts_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE categories
    ADD CONSTRAINT fk_categories_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE statements
    ADD CONSTRAINT fk_statements_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE transactions
    ADD CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE installment_plans
    ADD CONSTRAINT fk_installment_plans_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE loans
    ADD CONSTRAINT fk_loans_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE reward_ledgers
    ADD CONSTRAINT fk_reward_ledgers_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- B. Kích hoạt Row Level Security (RLS) trên từng bảng
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE installment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE installment_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_rate_histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_aliases ENABLE ROW LEVEL SECURITY;

-- C. Chính sách RLS cho danh mục chung (Public read cho institutions & merchants)
CREATE POLICY "Allow public read on institutions"
    ON institutions FOR SELECT USING (true);

CREATE POLICY "Allow public read on merchants"
    ON merchants FOR SELECT USING (true);

CREATE POLICY "Allow public read on merchant_aliases"
    ON merchant_aliases FOR SELECT USING (true);

-- D. Chính sách RLS cho Categories (Xem danh mục hệ thống + Danh mục riêng của user)
CREATE POLICY "Users can read system and own categories"
    ON categories FOR SELECT
    USING (is_system = TRUE OR auth.uid() = user_id);

CREATE POLICY "Users can insert own categories"
    ON categories FOR INSERT
    WITH CHECK (auth.uid() = user_id AND is_system = FALSE);

CREATE POLICY "Users can update own categories"
    ON categories FOR UPDATE
    USING (auth.uid() = user_id AND is_system = FALSE);

CREATE POLICY "Users can delete own categories"
    ON categories FOR DELETE
    USING (auth.uid() = user_id AND is_system = FALSE);

-- E. Chính sách RLS độc quyền dữ liệu người dùng (Accounts, Statements, Transactions...)
CREATE POLICY "Users can manage own accounts"
    ON accounts FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own statements"
    ON statements FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own transactions"
    ON transactions FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own installment plans"
    ON installment_plans FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own installment schedules"
    ON installment_schedules FOR ALL
    USING (EXISTS (
        SELECT 1 FROM installment_plans p
        WHERE p.id = installment_schedules.installment_plan_id
          AND p.user_id = auth.uid()
    ));

CREATE POLICY "Users can manage own reward ledgers"
    ON reward_ledgers FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
*/
