-- ====================================================================
-- CREDIT WALLET 2.0 - NOTIFICATIONS & CARD BENEFITS SCHEMA EXTENSION
-- ====================================================================

-- 1. ENUMS FOR NOTIFICATIONS
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type_enum') THEN
        CREATE TYPE notification_type_enum AS ENUM (
            'PAYMENT_DUE',          -- Hạn thanh toán sao kê / kỳ trả góp sắp tới
            'OVERDUE_ALERT',        -- Cảnh báo nợ quá hạn
            'UTILIZATION_HIGH',     -- Tỷ lệ sử dụng hạn mức vượt ngưỡng an toàn (>70%)
            'REWARD_EXPIRING',      -- Điểm thưởng / Cashback sắp hết hạn
            'ETL_SYNC_COMPLETED',   -- Đồng bộ dữ liệu sao kê hoàn tất
            'EARLY_SETTLED',        -- Đã tất toán gói trả góp trước hạn
            'SYSTEM_ANNOUNCEMENT'   -- Thông báo hệ thống
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_severity_enum') THEN
        CREATE TYPE notification_severity_enum AS ENUM (
            'INFO',                 -- Thông tin chung
            'SUCCESS',              -- Thành công
            'WARNING',              -- Cảnh báo (nhắc nợ, điểm hết hạn)
            'DANGER'                -- Nguy cấp (quá hạn, chạm trần hạn mức)
        );
    END IF;
END $$;

-- 2. NOTIFICATIONS TABLE (THÔNG BÁO IN-APP)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID, -- Sẵn sàng cho Multi-tenancy
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    notification_type notification_type_enum NOT NULL DEFAULT 'PAYMENT_DUE',
    severity notification_severity_enum NOT NULL DEFAULT 'INFO',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    action_url VARCHAR(255), -- Link điều hướng nhanh trong Dashboard (VD: "/statements", "/accounts")
    metadata JSONB DEFAULT '{}'::jsonb, -- Thông tin bổ sung (amount, due_date, account_id...)
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read, created_at DESC);

-- 3. NOTIFICATION SETTINGS TABLE (CẤU HÌNH NHẬN THÔNG BÁO & TELEGRAM BOT)
CREATE TABLE IF NOT EXISTS notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE, -- 1 record cấu hình cho mỗi user
    telegram_bot_token VARCHAR(255),
    telegram_chat_id VARCHAR(100),
    is_telegram_enabled BOOLEAN DEFAULT FALSE,
    is_in_app_enabled BOOLEAN DEFAULT TRUE,
    remind_days_before INT DEFAULT 3 CONSTRAINT chk_remind_days CHECK (remind_days_before BETWEEN 1 AND 15),
    remind_utilization_threshold INT DEFAULT 70 CONSTRAINT chk_util_thresh CHECK (remind_utilization_threshold BETWEEN 30 AND 100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. CARD BENEFITS MATRIX (MA TRẬN CHÍNH SÁCH ƯU ĐÃI & HOÀN TIỀN CỦA THẺ)
CREATE TABLE IF NOT EXISTS card_benefits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    category_keyword VARCHAR(100), -- "Ẩm thực", "Online", "Siêu thị", "Cloud", "Chi tiêu thông thường"
    merchant_pattern VARCHAR(150), -- "%SHOPEE%", "%GRAB%", "%STARBUCKS%", "%TIKTOK%" (nếu áp dụng riêng merchant)
    reward_type reward_type_enum NOT NULL DEFAULT 'CASHBACK',
    reward_rate_percent DECIMAL(5, 2) NOT NULL DEFAULT 0.00, -- VD: 8.00 (8%), 5.00 (5%), 0.40 (0.4%)
    point_multiplier DECIMAL(5, 2) DEFAULT 1.00, -- VD: 5.0 (Tích điểm 5X)
    min_spend_per_txn DECIMAL(15, 2) DEFAULT 0.00, -- Chi tiêu tối thiểu / giao dịch để được hưởng
    max_reward_monthly DECIMAL(15, 2), -- Giới hạn hoàn tiền / tích điểm tối đa mỗi tháng (VD: 600,000 VND)
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_card_benefits_account ON card_benefits(account_id);
CREATE INDEX IF NOT EXISTS idx_card_benefits_category ON card_benefits(category_id);

-- 5. SEED INITIAL CARD BENEFITS (Dựa trên các thẻ thực tế: Shinhan Hi-Point, HSBC Live+/Cashback, Sacombank Platinum)
DO $$
DECLARE
    v_acc_shinhan UUID;
    v_acc_hsbc UUID;
    v_acc_sacom UUID;
    v_cat_fb UUID;
    v_cat_online UUID;
    v_cat_market UUID;
    v_cat_other UUID;
BEGIN
    -- Lấy ID thẻ Shinhan, HSBC, Sacombank
    SELECT a.id INTO v_acc_shinhan FROM accounts a JOIN institutions i ON a.institution_id = i.id WHERE i.code = 'SHINHAN' LIMIT 1;
    SELECT a.id INTO v_acc_hsbc FROM accounts a JOIN institutions i ON a.institution_id = i.id WHERE i.code = 'HSBC' LIMIT 1;
    SELECT a.id INTO v_acc_sacom FROM accounts a JOIN institutions i ON a.institution_id = i.id WHERE i.code = 'SACOMBANK' LIMIT 1;

    -- Lấy ID danh mục
    SELECT id INTO v_cat_fb FROM categories WHERE name = 'Nhà hàng & F&B' OR name = 'Ăn uống & Nhà hàng' LIMIT 1;
    SELECT id INTO v_cat_online FROM categories WHERE name = 'Dịch vụ số & Ứng dụng' OR name = 'Mua sắm & Thương mại điện tử' LIMIT 1;
    SELECT id INTO v_cat_market FROM categories WHERE name = 'Siêu thị & Bách hóa' OR name = 'Mua sắm tiêu dùng' LIMIT 1;
    SELECT id INTO v_cat_other FROM categories WHERE name = 'Chi tiêu khác' LIMIT 1;

    -- A. Thẻ HSBC (Live+ / Cash Back): Hoàn tiền 8% Ẩm thực, 6% Siêu thị, 0.5% chi tiêu khác
    IF v_acc_hsbc IS NOT NULL AND NOT EXISTS (SELECT 1 FROM card_benefits WHERE account_id = v_acc_hsbc) THEN
        INSERT INTO card_benefits (account_id, category_id, category_keyword, reward_type, reward_rate_percent, max_reward_monthly, description)
        VALUES 
            (v_acc_hsbc, v_cat_fb, 'Ẩm thực & Nhà hàng', 'CASHBACK', 8.00, 600000.00, 'Hoàn tiền 8% khi ăn uống tại nhà hàng, quán cafe (Tối đa 600k/tháng)'),
            (v_acc_hsbc, v_cat_market, 'Siêu thị & Tiêu dùng', 'CASHBACK', 6.00, 400000.00, 'Hoàn tiền 6% tại siêu thị Coopmart, WinMart, BigC, Tops Market'),
            (v_acc_hsbc, v_cat_other, 'Chi tiêu thông thường', 'CASHBACK', 0.50, NULL, 'Hoàn 0.5% không giới hạn cho mọi chi tiêu hợp lệ khác');
    END IF;

    -- B. Thẻ Sacombank Platinum / Cashback: Hoàn tiền 5% Mua sắm Online / Thương mại điện tử
    IF v_acc_sacom IS NOT NULL AND NOT EXISTS (SELECT 1 FROM card_benefits WHERE account_id = v_acc_sacom) THEN
        INSERT INTO card_benefits (account_id, category_id, category_keyword, reward_type, reward_rate_percent, max_reward_monthly, description)
        VALUES 
            (v_acc_sacom, v_cat_online, 'Online & E-commerce', 'CASHBACK', 5.00, 500000.00, 'Hoàn tiền 5% cho giao dịch mua sắm Online Shopee, Lazada, Tiki, Grab, Cloud'),
            (v_acc_sacom, v_cat_fb, 'Ăn uống & Cà phê', 'CASHBACK', 3.00, 300000.00, 'Hoàn tiền 3% ăn uống cuối tuần'),
            (v_acc_sacom, v_cat_other, 'Chi tiêu thông thường', 'CASHBACK', 0.50, NULL, 'Hoàn 0.5% không giới hạn cho các giao dịch khác');
    END IF;

    -- C. Thẻ Shinhan Hi-Point Gold: Tích 5% Shinhan Points đặc quyền (Ẩm thực, Siêu thị, Mua sắm), 0.4% cơ bản
    IF v_acc_shinhan IS NOT NULL AND NOT EXISTS (SELECT 1 FROM card_benefits WHERE account_id = v_acc_shinhan) THEN
        INSERT INTO card_benefits (account_id, category_id, category_keyword, reward_type, reward_rate_percent, point_multiplier, max_reward_monthly, description)
        VALUES 
            (v_acc_shinhan, v_cat_fb, 'Ẩm thực & Mua sắm', 'POINT', 5.00, 5.00, 400000.00, 'Tích lũy 5% Shinhan Point tại đối tác ẩm thực, Lotte, CJ CGV, Grab'),
            (v_acc_shinhan, v_cat_market, 'Siêu thị & Cửa hàng tiện lợi', 'POINT', 5.00, 5.00, 400000.00, 'Tích lũy 5% Shinhan Point tại Lotte Mart, Emart, Circle K, GS25'),
            (v_acc_shinhan, v_cat_other, 'Chi tiêu thông thường', 'POINT', 0.40, 1.00, NULL, 'Tích lũy 0.4% Shinhan Point chuẩn cho mọi giao dịch hợp lệ');
    END IF;
END $$;
