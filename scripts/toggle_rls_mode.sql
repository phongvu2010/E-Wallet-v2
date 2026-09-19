-- ====================================================================
-- CREDIT WALLET 2.0 - ROW LEVEL SECURITY (RLS) MODE SWITCHER
-- ====================================================================
-- Tài liệu & Script chuyển đổi giữa 2 chế độ vận hành:
-- 1. PERSONAL / SINGLE-USER MODE (Mặc định cho cá nhân nội bộ, chưa cần Auth)
-- 2. MULTI-TENANT / AUTH MODE (Cho tương lai khi đã tích hợp Supabase Auth / JWT)
-- ====================================================================

-- --------------------------------------------------------------------
-- PHẦN 1: CHUYỂN SANG PERSONAL / SINGLE-USER MODE (KHUYẾN NGHỊ HIỆN TẠI)
-- --------------------------------------------------------------------
-- Mục đích:
-- - Vô hiệu hóa RLS trên 18 bảng nghiệp vụ.
-- - Đảm bảo ứng dụng chạy mượt mà trên cả Docker Local lẫn Supabase Cloud,
--   ngay cả khi kết nối qua user thông thường không có cờ BYPASSRLS.
-- - Triệt tiêu hoàn toàn rủi ro truy vấn trả về rỗng do `auth.uid() = NULL`.
--
-- Thực thi khối lệnh dưới đây:

DO $$
BEGIN
    RAISE NOTICE '>>> Đang chuyển sang PERSONAL / SINGLE-USER MODE (Vô hiệu hóa RLS)...';

    -- 1. Danh mục & Tổ chức tài chính
    ALTER TABLE institutions DISABLE ROW LEVEL SECURITY;
    ALTER TABLE merchants DISABLE ROW LEVEL SECURITY;
    ALTER TABLE merchant_aliases DISABLE ROW LEVEL SECURITY;
    ALTER TABLE categories DISABLE ROW LEVEL SECURITY;

    -- 2. Tài khoản & Sổ cái giao dịch
    ALTER TABLE accounts DISABLE ROW LEVEL SECURITY;
    ALTER TABLE statements DISABLE ROW LEVEL SECURITY;
    ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;

    -- 3. Trả góp & Điểm thưởng
    ALTER TABLE installment_plans DISABLE ROW LEVEL SECURITY;
    ALTER TABLE installment_schedules DISABLE ROW LEVEL SECURITY;
    ALTER TABLE card_benefits DISABLE ROW LEVEL SECURITY;
    ALTER TABLE reward_ledgers DISABLE ROW LEVEL SECURITY;

    -- 4. Gói vay tài chính
    ALTER TABLE loans DISABLE ROW LEVEL SECURITY;
    ALTER TABLE loan_schedules DISABLE ROW LEVEL SECURITY;
    ALTER TABLE loan_rate_histories DISABLE ROW LEVEL SECURITY;

    -- 5. Sổ nợ cá nhân P2P
    ALTER TABLE debts DISABLE ROW LEVEL SECURITY;
    ALTER TABLE debt_repayments DISABLE ROW LEVEL SECURITY;

    -- 6. Thông báo & Cấu hình cảnh báo
    ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
    ALTER TABLE notification_settings DISABLE ROW LEVEL SECURITY;

    RAISE NOTICE '>>> THÀNH CÔNG: Đã vô hiệu hóa RLS trên toàn bộ 18 bảng. Hệ thống sẵn sàng cho Personal Mode!';
END $$;


-- --------------------------------------------------------------------
-- PHẦN 2: CHUYỂN SANG MULTI-TENANT / AUTH MODE (TƯƠNG LAI)
-- --------------------------------------------------------------------
-- Mục đích:
-- - Tái kích hoạt RLS trên 18 bảng.
-- - Áp dụng các chính sách cô lập dữ liệu theo `auth.uid() = user_id`.
-- - YÊU CẦU: Hệ thống backend phải có middleware giải mã JWT token
--   và set session variable: `SET LOCAL request.jwt.claim.sub = '<user_id>'`.
--
-- Chỉ thực thi khi bạn bắt đầu triển khai Phase 3 (Supabase Auth / Multi-user):
/*
DO $$
BEGIN
    RAISE NOTICE '>>> Đang chuyển sang MULTI-TENANT / AUTH MODE (Kích hoạt RLS)...';

    -- 1. Danh mục & Tổ chức tài chính
    ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
    ALTER TABLE merchant_aliases ENABLE ROW LEVEL SECURITY;
    ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

    -- 2. Tài khoản & Sổ cái giao dịch
    ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE statements ENABLE ROW LEVEL SECURITY;
    ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

    -- 3. Trả góp & Điểm thưởng
    ALTER TABLE installment_plans ENABLE ROW LEVEL SECURITY;
    ALTER TABLE installment_schedules ENABLE ROW LEVEL SECURITY;
    ALTER TABLE card_benefits ENABLE ROW LEVEL SECURITY;
    ALTER TABLE reward_ledgers ENABLE ROW LEVEL SECURITY;

    -- 4. Gói vay tài chính
    ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
    ALTER TABLE loan_schedules ENABLE ROW LEVEL SECURITY;
    ALTER TABLE loan_rate_histories ENABLE ROW LEVEL SECURITY;

    -- 5. Sổ nợ cá nhân P2P
    ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE debt_repayments ENABLE ROW LEVEL SECURITY;

    -- 6. Thông báo & Cấu hình cảnh báo
    ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
    ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

    RAISE NOTICE '>>> THÀNH CÔNG: Đã kích hoạt RLS trên 18 bảng cho Multi-Tenant Mode!';
END $$;
*/
