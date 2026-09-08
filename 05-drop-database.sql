-- ====================================================================
-- CREDIT WALLET 2.0 - SUPABASE DATABASE TEARDOWN & CLEANUP SCRIPT
-- PostgreSQL 16+ (Supabase SQL Editor Ready)
-- ====================================================================
-- Lưu ý: Script này sẽ xoá sạch toàn bộ View, Table, Function, Trigger, 
-- và Enum Type đã được khởi tạo bởi dự án Credit Wallet trên schema public.
-- Lệnh CASCADE đảm bảo xoá sạch các ràng buộc khoá ngoại (kể cả tới auth.users),
-- RLS Policies và Triggers đi kèm.
-- ====================================================================

-- 1. XOÁ CÁC ANALYTIC VIEWS
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

-- 2. XOÁ CÁC BẢNG (CASCADE tự động dọn sạch Constraints, Triggers, Policies & Indexes)
DROP TABLE IF EXISTS debt_repayments CASCADE;
DROP TABLE IF EXISTS debts CASCADE;
DROP TABLE IF EXISTS card_benefits CASCADE;
DROP TABLE IF EXISTS notification_settings CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS reward_ledgers CASCADE;
DROP TABLE IF EXISTS loan_rate_histories CASCADE;
DROP TABLE IF EXISTS loan_schedules CASCADE;
DROP TABLE IF EXISTS loans CASCADE;
DROP TABLE IF EXISTS installment_schedules CASCADE;
DROP TABLE IF EXISTS installment_plans CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS statements CASCADE;
DROP TABLE IF EXISTS merchant_aliases CASCADE;
DROP TABLE IF EXISTS merchants CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS institutions CASCADE;

-- 3. XOÁ CÁC FUNCTIONS / PROCEDURES ĐÃ TẠO
DROP FUNCTION IF EXISTS fn_early_settle_installment_plan(UUID, UUID, DECIMAL, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS fn_early_settle_installment_plan CASCADE;
DROP FUNCTION IF EXISTS fn_update_installment_remaining_balance() CASCADE;
DROP FUNCTION IF EXISTS fn_update_installment_remaining_balance CASCADE;
DROP FUNCTION IF EXISTS fn_generate_tx_fingerprint() CASCADE;
DROP FUNCTION IF EXISTS fn_generate_tx_fingerprint CASCADE;

-- 4. XOÁ CÁC ENUM TYPES
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

-- 5. XOÁ EXTENSIONS (TÙY CHỌN)
-- Mặc định để comment vì Supabase dùng chung extension cho nhiều tính năng nội bộ.
-- Nếu bạn thực sự muốn gỡ bỏ hoàn toàn extension, hãy mở comment 3 dòng dưới:
-- DROP EXTENSION IF EXISTS "pg_trgm" CASCADE;
-- DROP EXTENSION IF EXISTS "pgcrypto" CASCADE;
-- DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;
