# Credit Wallet 2.0 - Database & Backend Architecture

Hệ thống cơ sở dữ liệu và công cụ quản lý tài chính, đối soát giao dịch thẻ tín dụng cá nhân trên Docker (PostgreSQL 16).

---

## 🚀 1. Khởi động nhanh với Docker

```bash
# 1. Khởi động container PostgreSQL
docker compose up -d

# 2. Kiểm tra trạng thái container
docker compose ps

# 3. Dừng hệ thống
docker compose down
```

---

## 🔌 2. Thông tin kết nối & Biến môi trường

### A. Thông số kết nối Database mặc định
* **Host:** `localhost`
* **Port:** `5432`
* **Database Name:** `credit_wallet`
* **Username:** `postgres`
* **Password:** `postgres`
* **Connection String (URI):** `postgresql://postgres:postgres@localhost:5432/credit_wallet`

### B. Tùy chỉnh qua tệp `.env`
Bạn có thể tùy biến cổng hoặc thông tin bảo mật bằng cách sao chép tệp mẫu:
```bash
cp .env.example .env
```

Nội dung tệp `.env`:
```dotenv
POSTGRES_DB=credit_wallet
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_PORT=5432
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/credit_wallet
```

### C. Kết nối qua các ứng dụng quản lý Database (DBeaver, TablePlus, DataGrip, VS Code)
* Chọn Driver: **PostgreSQL**
* Host / Port / User / Pass / DB: Dùng các thông số ở mục A (hoặc theo cấu hình `.env` của bạn).

---

## 📊 3. Cấu trúc Database Schema

| Bảng / View | Mục đích |
| :--- | :--- |
| `institutions` | Danh mục tổ chức tài chính / ngân hàng (Shinhan Bank, HSBC, Sacombank...) |
| `accounts` | Tài khoản, thẻ tín dụng, hạn mức, ngày chốt sao kê, chu kỳ ân hạn, liên kết thẻ cấp đổi (`replaces_account_id`) |
| `categories` | Cây danh mục thu chi phân cấp (Cấp 1 & Cấp 2, có ràng buộc chống trùng) |
| `merchants` | Đơn vị chấp nhận thẻ chuẩn hóa (Shopee, Ministop, Nguyễn Kim, Apple...) |
| `merchant_aliases` | Quy tắc ánh xạ chuỗi sao kê gốc (`raw_pattern`) sang đơn vị chấp nhận thẻ |
| `statements` | Kỳ sao kê thẻ tín dụng, dư nợ cuối kỳ, thanh toán tối thiểu, SHA-256 đối soát tệp |
| `transactions` | Toàn bộ giao dịch chi tiêu, thanh toán, hoàn tiền, phí, lãi (đơn vị tính VNĐ) |
| `installment_plans` | Các gói trả góp (sản phẩm, tổng tiền, kỳ hạn, phí chuyển đổi, dư nợ gốc còn lại) |
| `installment_schedules` | Chi tiết lịch biểu từng kỳ trả góp (Kỳ 01/03, 02/03...) |
| `reward_ledgers` | Sổ cái điểm thưởng Shinhan Point, dặm bay, tiền hoàn Cashback và ngày hết hạn |

### 📈 Các Views phân tích sẵn có:
* `v_monthly_category_spending`: Thống kê chi tiêu thực tế theo tháng và danh mục (đã tự động bù trừ các giao dịch hủy/hoàn tiền).
* `v_account_overview`: Báo cáo tổng quan số dư hiện tại, hạn mức, ngày đến hạn thanh toán và trạng thái từng thẻ.
* `v_account_live_balance`: Báo cáo **Dư nợ thực tế tức thời** (Live Balance) và **Hạn mức khả dụng thực tế** (cộng dồn chi tiêu và trừ thanh toán phát sinh sau ngày chốt sao kê).
* `v_statement_reconciliation`: Đối soát dư nợ sao kê so với tổng giao dịch thực tế trong kỳ.
* `v_statement_payment_status`: Theo dõi tiến độ thanh toán sao kê động (`PAID`, `PARTIALLY_PAID`, `BILLED`, `OVERDUE`).
* `v_credit_utilization`: Tỷ lệ sử dụng hạn mức tín dụng và đánh giá rủi ro tín dụng (Credit Utilization Ratio).
* `v_upcoming_payment_obligations`: Danh sách các nghĩa vụ thanh toán sắp tới (Sao kê & Trả góp) trong 30 ngày.
* `v_installment_monthly_forecast`: Dự phóng dòng tiền trả góp cố định từng tháng trong tương lai.

---

## 📁 4. Cấu trúc thư mục dự án

```text
├── data/
│   ├── HSBC/                     # 4 tệp sao kê PDF thẻ HSBC (2026)
│   ├── Shinhan Bank/             # 75 tệp sao kê PDF thẻ Shinhan Bank (2020 - 2026)
│   ├── Sacombank/                # 30 tệp sao kê PDF thẻ Sacombank & CSV chuẩn hóa
│   └── My Credit Wallet 2.0.xlsx # Tệp Excel tổng hợp & đối soát
├── init-scripts/                 # Scripts DDL tự động chạy khi khởi tạo PostgreSQL
│   ├── 01-schema.sql             # DDL tạo bảng, enum, khóa ngoại, view, index (Docker & Supabase ready)
│   ├── 02-seed-categories.sql    # Dữ liệu danh mục phân cấp mẫu
│   └── 03-seed-institutions.sql  # Dữ liệu ngân hàng mẫu
├── scripts/
│   └── migrate_data.py           # Script ETL nạp dữ liệu từ Excel & PDF vào DB
├── .env.example                  # Template biến môi trường
├── docker-compose.yml            # Cấu hình khởi chạy PostgreSQL
└── README.md
```

---

## 🔄 5. Cài đặt môi trường & Nạp dữ liệu

### Bước 1: Cài đặt thư viện Python
```bash
pip install pandas openpyxl psycopg2-binary pymupdf
```

### Bước 2: Thực thi nạp dữ liệu vào Database
```bash
python3 scripts/migrate_data.py
```

---

## 🔍 6. Truy vấn mẫu kiểm tra nhanh

```sql
-- 1. Xem Dư nợ Thực tế Tức thời (Live Balance) & Hạn mức khả dụng còn lại của từng thẻ
SELECT account_name, bank_name, credit_limit, latest_statement_balance, 
       unbilled_charges, unbilled_credits, unbilled_net_amount,
       live_current_balance, live_available_limit, live_utilization_percentage, live_risk_level
FROM v_account_live_balance;

-- 2. Xem tổng quan tình trạng các thẻ & dư nợ sao kê mới nhất
SELECT * FROM v_account_overview;

-- 3. Kiểm tra tiến độ thanh toán các kỳ sao kê
SELECT account_name, statement_date, payment_due_date, billed_amount, total_paid_amount, remaining_balance_to_pay, payment_status 
FROM v_statement_payment_status;

-- 4. Theo dõi tỷ lệ sử dụng hạn mức tín dụng
SELECT account_name, bank_name, credit_limit, current_balance, utilization_percentage, risk_level 
FROM v_credit_utilization;

-- 5. Xem lịch nhắc thanh toán sắp tới (Sao kê + Trả góp)
SELECT obligation_type, account_name, due_date, days_remaining, total_amount_due, payment_status 
FROM v_upcoming_payment_obligations;

-- 6. Thống kê top 10 hạng mục chi tiêu trong tháng gần nhất
SELECT * FROM v_monthly_category_spending LIMIT 10;
```
