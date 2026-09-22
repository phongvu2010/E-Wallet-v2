-- ====================================================================
-- CREDIT WALLET 2.0 - SUPABASE DATABASE TEARDOWN & CLEANUP SCRIPT
-- PostgreSQL 16+ (Docker Local & Supabase SQL Editor Compatible)
-- ====================================================================
-- Lưu ý an toàn (Safety Note):
-- Script này sẽ xóa sạch toàn bộ Views, Tables, Functions, Triggers,
-- và Enum Types đã được khởi tạo bởi dự án Credit Wallet trên schema public.
-- Lệnh CASCADE tự động dọn sạch các ràng buộc khóa ngoại (Foreign Keys),
-- Row Level Security (RLS) Policies, Indexes và Triggers đi kèm.
-- ====================================================================

-- --------------------------------------------------------------------
-- 0. GIẢI PHÓNG TẤT CẢ POSTGRESQL SESSION ADVISORY LOCKS
-- --------------------------------------------------------------------
-- Mở toàn bộ khóa cố vấn (bao gồm lock 88481234 của Background Leader Coordinator)
-- để tránh tình trạng worker process bị treo hoặc lock connection khi reset DB.
SELECT pg_advisory_unlock_all();

-- --------------------------------------------------------------------
-- 1. XÓA CÁC ANALYTIC VIEWS (10 VIEWS)
-- --------------------------------------------------------------------
DROP VIEW IF EXISTS v_monthly_cash_flow CASCADE;
DROP VIEW IF EXISTS v_net_worth_overview CASCADE;
DROP VIEW IF EXISTS v_account_live_balance CASCADE;
DROP VIEW IF EXISTS v_installment_monthly_forecast CASCADE;
DROP VIEW IF EXISTS v_upcoming_payment_obligations CASCADE;
DROP VIEW IF EXISTS v_credit_utilization CASCADE;
DROP VIEW IF EXISTS v_statement_payment_status CASCADE;
DROP VIEW IF EXISTS v_statement_reconciliation CASCADE;
DROP VIEW IF EXISTS v_account_overview CASCADE;
DROP VIEW IF EXISTS v_monthly_category_spending CASCADE;

-- --------------------------------------------------------------------
-- 2. XÓA CÁC BẢNG DỮ LIỆU (20 TABLES - THEO THỨ TỰ RÀNG BUỘC PHỤ THUỘC)
-- --------------------------------------------------------------------

-- 2.1. Bảng Trạng thái Phân tán Multi-Worker & Rate Limiting (Mới cập nhật)
DROP TABLE IF EXISTS rate_limit_records CASCADE;
DROP TABLE IF EXISTS telegram_draft_sessions CASCADE;

-- 2.2. Bảng Sổ Nợ Dân Sự & Vay Mượn P2P
DROP TABLE IF EXISTS debt_repayments CASCADE;
DROP TABLE IF EXISTS debts CASCADE;

-- 2.3. Bảng Ưu Đãi & Quyền Lợi Thẻ
DROP TABLE IF EXISTS card_benefits CASCADE;

-- 2.4. Bảng Thông Báo & Cấu Hình Nhắc Nợ
DROP TABLE IF EXISTS notification_settings CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;

-- 2.5. Bảng Điểm Thưởng, Cashback & Dặm Bay
DROP TABLE IF EXISTS reward_ledgers CASCADE;

-- 2.6. Bảng Gói Vay Tài Chính Lãi Suất Thả Nổi
DROP TABLE IF EXISTS loan_rate_histories CASCADE;
DROP TABLE IF EXISTS loan_schedules CASCADE;
DROP TABLE IF EXISTS loans CASCADE;

-- 2.7. Bảng Gói Trả Góp & Lịch Trả Định Kỳ
DROP TABLE IF EXISTS installment_schedules CASCADE;
DROP TABLE IF EXISTS installment_plans CASCADE;

-- 2.8. Bảng Sổ Cái Giao Dịch & Sao Kê Thẻ
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS statements CASCADE;

-- 2.9. Bảng Đơn Vị Chấp Nhận Thẻ & Định Danh Tên Giao Dịch
DROP TABLE IF EXISTS merchant_aliases CASCADE;
DROP TABLE IF EXISTS merchants CASCADE;

-- 2.10. Bảng Danh Mục Phân Cấp & Tài Khoản / Thẻ
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;

-- 2.11. Bảng Tổ Chức Tài Chính / Ngân Hàng
DROP TABLE IF EXISTS institutions CASCADE;

-- --------------------------------------------------------------------
-- 3. XÓA CÁC STORED PROCEDURES & BUSINESS FUNCTIONS
-- --------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_early_settle_installment_plan(UUID, UUID, DECIMAL, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS fn_early_settle_installment_plan CASCADE;

DROP FUNCTION IF EXISTS fn_update_installment_remaining_balance() CASCADE;
DROP FUNCTION IF EXISTS fn_update_installment_remaining_balance CASCADE;

DROP FUNCTION IF EXISTS fn_generate_tx_fingerprint() CASCADE;
DROP FUNCTION IF EXISTS fn_generate_tx_fingerprint CASCADE;

-- --------------------------------------------------------------------
-- 4. XÓA CÁC ENUM TYPES (15 ENUMS)
-- --------------------------------------------------------------------
DROP TYPE IF EXISTS debt_status_enum CASCADE;
DROP TYPE IF EXISTS debt_type_enum CASCADE;
DROP TYPE IF EXISTS notification_severity_enum CASCADE;
DROP TYPE IF EXISTS notification_type_enum CASCADE;
DROP TYPE IF EXISTS loan_schedule_status_enum CASCADE;
DROP TYPE IF EXISTS loan_status_enum CASCADE;
DROP TYPE IF EXISTS interest_method_enum CASCADE;
DROP TYPE IF EXISTS loan_type_enum CASCADE;
DROP TYPE IF EXISTS reward_type_enum CASCADE;
DROP TYPE IF EXISTS installment_status_enum CASCADE;
DROP TYPE IF EXISTS transaction_type_enum CASCADE;
DROP TYPE IF EXISTS statement_status_enum CASCADE;
DROP TYPE IF EXISTS category_type_enum CASCADE;
DROP TYPE IF EXISTS account_status_enum CASCADE;
DROP TYPE IF EXISTS account_type_enum CASCADE;

-- --------------------------------------------------------------------
-- 5. DỌN DẸP DOCKER LOCAL AUTH SHIM (AN TOÀN CHO SUPABASE)
-- --------------------------------------------------------------------
-- Lưu ý quan trọng:
-- - Trên Docker Local, schema `auth` và bảng `auth.users` được tạo giả lập (shim).
-- - Trên Supabase Cloud, schema `auth` do Supabase nội bộ quản lý (KHÔNG ĐƯỢC DROP).
-- Khối DO dưới đây kiểm tra nếu đang ở môi trường Docker Local (chỉ có bảng shim đơn giản)
-- thì mới xóa hàm và bảng shim, tuyệt đối không gây lỗi hay xóa nhầm trên Supabase.
DO $$
BEGIN
    -- Chỉ dọn dẹp schema auth nếu đây là shim giả lập của môi trường Docker Local.
    -- Nhận diện Docker Local shim: Bảng auth.users tồn tại nhưng KHÔNG có cột encrypted_password (cột chuẩn của Supabase Auth).
    -- Trên Supabase Cloud: Khối lệnh này sẽ tự động bỏ qua (Skip), không động đến schema auth hay hàm auth.uid() của hệ thống.
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'auth' AND table_name = 'users'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'encrypted_password'
    ) THEN
        DROP FUNCTION IF EXISTS auth.uid() CASCADE;
        DROP TABLE IF EXISTS auth.users CASCADE;
        DROP SCHEMA IF EXISTS auth CASCADE;
    END IF;
END $$;

-- --------------------------------------------------------------------
-- 6. EXTENSIONS (TÙY CHỌN)
-- --------------------------------------------------------------------
-- Mặc định giữ lại extension vì Supabase và PostgreSQL dùng chung cho nhiều dịch vụ.
-- Nếu bạn muốn gỡ bỏ hoàn toàn extension trên môi trường local, hãy bỏ comment 3 dòng dưới:
-- DROP EXTENSION IF EXISTS "pg_trgm" CASCADE;
-- DROP EXTENSION IF EXISTS "pgcrypto" CASCADE;
-- DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;
