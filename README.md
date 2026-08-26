# Credit Wallet 2.0 - Database & FastAPI Backend Architecture

Hệ thống cơ sở dữ liệu và Backend RESTful API quản lý tài chính, theo dõi dư nợ và đối soát giao dịch thẻ tín dụng cá nhân trên Docker (PostgreSQL 16 & FastAPI).

---

## 🚀 1. Khởi động nhanh với Docker

```bash
# 1. Khởi động toàn bộ Database PostgreSQL & Backend FastAPI Service
docker compose up -d

# 2. Kiểm tra trạng thái containers
docker compose ps

# 3. Dừng hệ thống
docker compose down
```

Sau khi khởi động container thành công:
* **Interactive API Docs (Swagger UI):** [http://localhost:8000/docs](http://localhost:8000/docs)
* **ReDoc API Documentation:** [http://localhost:8000/redoc](http://localhost:8000/redoc)
* **Health Check Endpoint:** [http://localhost:8000/health](http://localhost:8000/health)

---

## 💻 2. Chạy Backend trực tiếp trên máy chủ cục bộ (Local Development)

### Bước 1: Cài đặt thư viện Python
```bash
pip install -r backend/requirements.txt
```

### Bước 2: Cấu hình biến môi trường
Sao chép tệp mẫu `.env.example` thành `.env` (nếu chưa có):
```bash
cp .env.example .env
```

### Bước 3: Nạp dữ liệu ban đầu từ Excel & PDF (nếu cần)
```bash
python scripts/migrate_data.py
```

### Bước 4: Khởi chạy FastAPI Server
```bash
uvicorn backend.app.main:app --reload --port 8000
```

---

## 🧪 3. Kiểm thử Tự động (Automated Testing)

Chạy toàn bộ bộ test kiểm thử tự động (Unit & Integration Tests) với `pytest`:
```bash
python -m pytest backend/tests -v
```

---

## 🔌 4. Thông tin kết nối & Biến môi trường

### A. Thông số kết nối Database mặc định
* **Host:** `localhost`
* **Port:** `5432`
* **Database Name:** `credit_wallet`
* **Username:** `postgres`
* **Password:** `postgres`
* **Connection String (URI):** `postgresql://postgres:postgres@localhost:5432/credit_wallet`

### B. Nội dung tệp `.env`
```dotenv
POSTGRES_DB=credit_wallet
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_PORT=5432
POSTGRES_HOST=localhost
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/credit_wallet
DEBUG=true
PROJECT_NAME="Credit Wallet 2.0 API"
```

---

## 🌐 5. Danh mục Endpoints API (FastAPI RESTful)

| Router Prefix | Mô tả chi tiết Endpoints |
| :--- | :--- |
| **`/api/v1/accounts`** | Quản lý thẻ tín dụng, CRUD, báo cáo **Dư nợ tức thời** (`/live-balance`) và tổng quan thẻ (`/overview`). |
| **`/api/v1/transactions`** | Sổ cái giao dịch, phân trang, đa lọc (ngày, danh mục, merchant, loại giao dịch, khoảng tiền, tìm kiếm text), tổng kết dòng tiền (`/summary`). |
| **`/api/v1/statements`** | Danh sách kỳ sao kê, đối soát dư nợ thực tế vs sao kê (`/reconciliation`), theo dõi tiến độ thanh toán nợ (`/payment-status`). |
| **`/api/v1/installments`** | Quản lý gói trả góp, lịch biểu từng kỳ (`schedules`), dự phóng dòng tiền trả góp (`/forecast`), và Function **Tất toán trước hạn** (`/{id}/early-settle`). |
| **`/api/v1/analytics`** | Dashboard tổng quan (`/overview`), thống kê chi tiêu theo danh mục (`/monthly-spending`), tỷ lệ sử dụng hạn mức & cảnh báo rủi ro (`/credit-utilization`), lịch nghĩa vụ thanh toán trong 30 ngày (`/upcoming-obligations`). |
| **`/api/v1/categories`** | Danh mục thu chi phân cấp, trả về cây danh mục 2 cấp (`/tree`), tạo danh mục tùy chỉnh. |
| **`/api/v1/merchants`** | Đơn vị chấp nhận thẻ chuẩn hóa, tìm kiếm merchant, thêm quy tắc alias mapping (`/aliases`). |
| **`/api/v1/institutions`** | Danh mục ngân hàng / tổ chức tài chính (Shinhan, HSBC, Sacombank...). |
| **`/api/v1/rewards`** | Sổ cái điểm thưởng (Shinhan Point), hoàn tiền (Cashback), dặm bay (Miles), và hạn dùng điểm. |
| **`/api/v1/etl`** | Kích hoạt đồng bộ & nạp lại dữ liệu từ tệp sao kê Excel / PDF (`/sync`). |

---

## 📊 6. Cấu trúc Database Schema & Views

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
| `v_account_live_balance` | Báo cáo **Dư nợ thực tế tức thời** (Live Balance) và **Hạn mức khả dụng thực tế** (cộng dồn chi tiêu & trừ thanh toán chưa chốt sao kê) |
| `v_monthly_category_spending`| Thống kê chi tiêu thực tế theo tháng và danh mục (tự động bù trừ hoàn tiền / hủy giao dịch) |
| `v_statement_payment_status` | Theo dõi tiến độ thanh toán sao kê động (`PAID`, `PARTIALLY_PAID`, `BILLED`, `OVERDUE`) |
| `v_credit_utilization` | Tỷ lệ sử dụng hạn mức tín dụng và đánh giá rủi ro tín dụng (Credit Utilization Ratio) |
| `v_upcoming_payment_obligations`| Danh sách các nghĩa vụ thanh toán sắp tới (Sao kê & Trả góp) trong 30 ngày |
| `v_installment_monthly_forecast`| Dự phóng dòng tiền trả góp cố định từng tháng trong tương lai |

---

## 📁 7. Cấu trúc thư mục dự án

```text
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── endpoints/
│   │   │       │   ├── accounts.py
│   │   │       │   ├── analytics.py
│   │   │       │   ├── categories.py
│   │   │       │   ├── etl.py
│   │   │       │   ├── installments.py
│   │   │       │   ├── institutions.py
│   │   │       │   ├── merchants.py
│   │   │       │   ├── rewards.py
│   │   │       │   ├── statements.py
│   │   │       │   └── transactions.py
│   │   │       └── api.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── database.py
│   │   ├── models/
│   │   │   ├── account.py
│   │   │   ├── category.py
│   │   │   ├── institution.py
│   │   │   ├── installment.py
│   │   │   ├── merchant.py
│   │   │   ├── reward.py
│   │   │   ├── statement.py
│   │   │   └── transaction.py
│   │   ├── schemas/
│   │   │   ├── account.py
│   │   │   ├── analytics.py
│   │   │   ├── category.py
│   │   │   ├── common.py
│   │   │   ├── institution.py
│   │   │   ├── installment.py
│   │   │   ├── merchant.py
│   │   │   ├── reward.py
│   │   │   ├── statement.py
│   │   │   └── transaction.py
│   │   ├── services/
│   │   │   ├── account_service.py
│   │   │   ├── analytics_service.py
│   │   │   ├── etl_service.py
│   │   │   ├── installment_service.py
│   │   │   └── transaction_service.py
│   │   └── main.py
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_accounts.py
│   │   ├── test_analytics.py
│   │   ├── test_health.py
│   │   ├── test_installments.py
│   │   ├── test_more_endpoints.py
│   │   └── test_transactions.py
│   ├── Dockerfile
│   └── requirements.txt
├── data/
│   ├── HSBC/
│   ├── Sacombank/
│   ├── Shinhan Bank/
│   └── My Credit Wallet 2.0.xlsx
├── init-scripts/
│   ├── 01-schema.sql
│   ├── 02-seed-categories.sql
│   └── 03-seed-institutions.sql
├── scripts/
│   └── migrate_data.py
├── .env
├── .env.example
├── docker-compose.yml
├── pytest.ini
└── README.md
```
