-- ====================================================================
-- CREDIT WALLET 2.0 - DATABASE INITIALIZATION SCHEMA
-- PostgreSQL 16+
-- ====================================================================

-- Enable UUID Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================================
-- ENUMS
-- ====================================================================
CREATE TYPE account_type_enum AS ENUM ('CREDIT_CARD', 'DEBIT_CARD', 'BANK_ACCOUNT', 'E_WALLET');
CREATE TYPE account_status_enum AS ENUM ('ACTIVE', 'LOCKED', 'CLOSED', 'EXPIRED', 'REPLACED');
CREATE TYPE category_type_enum AS ENUM ('EXPENSE', 'INCOME', 'TRANSFER', 'ADJUSTMENT', 'FEE_INTEREST');
CREATE TYPE statement_status_enum AS ENUM ('OPEN', 'BILLED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE');
CREATE TYPE transaction_type_enum AS ENUM (
    'PURCHASE',              -- Chi tiêu mua sắm thông thường
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
CREATE TYPE installment_status_enum AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE reward_type_enum AS ENUM ('POINT', 'CASHBACK', 'MILE');

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
    institution_id UUID REFERENCES institutions(id) ON DELETE RESTRICT,
    account_name VARCHAR(100) NOT NULL, -- "Shinhan Hi-Point Gold", "HSBC Cash Back"
    account_type account_type_enum NOT NULL DEFAULT 'CREDIT_CARD',
    card_number_masked VARCHAR(25) NOT NULL, -- "4696 72xx xxxx 2958", "4696 7200 1584 0642"
    card_number_last4 VARCHAR(4) NOT NULL, -- "2958", "0642", "0702"
    currency VARCHAR(3) DEFAULT 'VND',
    credit_limit DECIMAL(15, 2) DEFAULT 0.00, -- Hạn mức tín dụng (VND)
    billing_day_of_month INT CHECK (billing_day_of_month BETWEEN 1 AND 31), -- Ngày chốt sao kê danh nghĩa (ví dụ: ngày 20)
    grace_period_days INT DEFAULT 15, -- Số ngày gia hạn thanh toán sau sao kê
    status account_status_enum DEFAULT 'ACTIVE',

    -- Xử lý trường hợp Cấp lại thẻ / Đổi thẻ (Card Reissuance)
    replaces_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL, -- Trỏ tới thẻ cũ đã bị thay thế/hết hạn
    opened_date DATE, -- Ngày mở thẻ
    closed_date DATE, -- Ngày đóng/hủy thẻ (khi được thay thế bởi thẻ mới)

    color_hex VARCHAR(7) DEFAULT '#3b82f6',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- 3. CATEGORIES (DANH MỤC PHÂN CẤP)
-- ====================================================================
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- "Nhà hàng & F&B", "Dịch vụ số & Ứng dụng"
    category_type category_type_enum NOT NULL DEFAULT 'EXPENSE',
    icon VARCHAR(50),
    color VARCHAR(20),
    is_system BOOLEAN DEFAULT FALSE, -- Danh mục mặc định của hệ thống
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_category_parent_name UNIQUE (parent_id, name)
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
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    statement_id UUID REFERENCES statements(id) ON DELETE SET NULL, -- Kỳ sao kê chứa giao dịch này

    -- Liên kết Trả góp & Chuyển tiền liên tài khoản
    installment_plan_id UUID, -- Sẽ gắn foreign key tới installment_plans(id) ở mục 7
    transfer_to_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL, -- Tài khoản đích nếu là giao dịch thanh toán/nạp tiền

    transaction_date DATE NOT NULL, -- Ngày quẹt thẻ / giao dịch
    post_date DATE, -- Ngày hệ thống ghi nợ (Post date)

    raw_description VARCHAR(255) NOT NULL, -- Chuỗi gốc từ sao kê: "STARBUCKS SU VAN HANH"
    merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    transaction_type transaction_type_enum NOT NULL DEFAULT 'PURCHASE',

    -- Xử lý đa tiền tệ & phí ngoại tệ
    original_currency VARCHAR(3) DEFAULT 'VND', -- USD, EUR, CNY...
    original_amount DECIMAL(15, 2) NOT NULL, -- 10.00 USD hoặc 580,000 VND
    fx_rate DECIMAL(15, 6) DEFAULT 1.000000, -- Tỷ giá quy đổi
    foreign_fee DECIMAL(15, 2) DEFAULT 0.00, -- Phí xử lý giao dịch ngoại tệ (Overseas Fee)

    -- Số tiền quy đổi VND chốt sổ
    amount DECIMAL(15, 2) NOT NULL, -- Số tiền gốc (VND)
    fee DECIMAL(15, 2) DEFAULT 0.00, -- Phí đi kèm (nếu có)
    total_amount DECIMAL(15, 2) NOT NULL, -- amount + fee + foreign_fee (âm nếu là thanh toán/hoàn tiền)

    note TEXT, -- Ghi chú cá nhân
    is_installment BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- 7. INSTALLMENT PLANS & SCHEDULES (TRẢ GÓP)
-- ====================================================================
CREATE TABLE installment_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    origin_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL, -- Giao dịch gốc được chuyển đổi sang trả góp
    product_name VARCHAR(150) NOT NULL, -- "Máy in 3D Qidi Q2 Combo", "iPhone 14 Pro"
    merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
    start_date DATE NOT NULL,

    total_amount DECIMAL(15, 2) NOT NULL, -- Tổng số tiền trả góp (16,416,800 VND)
    conversion_fee DECIMAL(15, 2) DEFAULT 0.00, -- Phí chuyển đổi (655,030.32 VND)
    interest_rate_percent DECIMAL(5, 2) DEFAULT 0.00, -- 0% lãi suất
    term_months INT NOT NULL, -- 3, 6, 9, 12 tháng

    monthly_principal DECIMAL(15, 2) NOT NULL, -- Tiền gốc mỗi tháng
    monthly_interest DECIMAL(15, 2) DEFAULT 0.00,
    monthly_payment DECIMAL(15, 2) NOT NULL, -- Số tiền trả góp kỳ này (5,472,266.66)

    remaining_balance DECIMAL(15, 2) NOT NULL, -- Dư nợ gốc còn lại
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

-- ====================================================================
-- 8. REWARD LEDGERS (ĐIỂM THƯỞNG, HOÀN TIỀN)
-- ====================================================================
CREATE TABLE reward_ledgers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
CREATE INDEX idx_accounts_replaces ON accounts(replaces_account_id);
CREATE INDEX idx_merchant_aliases_merchant ON merchant_aliases(merchant_id);
CREATE INDEX idx_tx_account_date ON transactions(account_id, transaction_date DESC);
CREATE INDEX idx_tx_statement ON transactions(statement_id);
CREATE INDEX idx_tx_category ON transactions(category_id);
CREATE INDEX idx_tx_merchant ON transactions(merchant_id);
CREATE INDEX idx_tx_type ON transactions(transaction_type);
CREATE INDEX idx_tx_installment_plan ON transactions(installment_plan_id);
CREATE INDEX idx_statements_account_date ON statements(account_id, statement_date DESC);
CREATE INDEX idx_installment_account_status ON installment_plans(account_id, status);

-- ====================================================================
-- 10. ANALYTIC VIEWS
-- ====================================================================
-- View 1: Thống kê chi tiêu theo tháng và danh mục (Bao gồm cả Hoàn tiền / Hủy giao dịch để bù trừ chính xác)
CREATE OR REPLACE VIEW v_monthly_category_spending AS
SELECT 
    DATE_TRUNC('month', t.transaction_date)::DATE AS month,
    c.name AS category_name,
    parent_c.name AS parent_category_name,
    COUNT(t.id) AS transaction_count,
    SUM(t.total_amount) AS total_spending
FROM transactions t
JOIN categories c ON t.category_id = c.id
LEFT JOIN categories parent_c ON c.parent_id = parent_c.id
WHERE t.transaction_type IN (
    'PURCHASE', 
    'INSTALLMENT_MONTHLY', 
    'FEE', 
    'INTEREST', 
    'CASH_ADVANCE',
    'REFUND', 
    'ADJUSTMENT'
)
GROUP BY 1, 2, 3
ORDER BY 1 DESC, total_spending DESC;

-- View 2: Tổng quan tài khoản và tình trạng thẻ (Bao gồm trạng thái thay thế thẻ)
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
    a.replaces_account_id
FROM accounts a
JOIN institutions i ON a.institution_id = i.id
LEFT JOIN LATERAL (
    SELECT statement_balance, payment_due_date
    FROM statements s
    WHERE s.account_id = a.id
    ORDER BY s.statement_date DESC
    LIMIT 1
) latest_s ON TRUE;
