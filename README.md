# Credit Wallet 2.0 - Full-Stack Architecture (PostgreSQL + FastAPI + React Vite)

Hệ thống sổ cái tài chính cá nhân hoàn chỉnh chuyên sâu cho thẻ tín dụng: Database PostgreSQL 16, Backend RESTful API FastAPI, và Dashboard giao diện người dùng React 18 (TypeScript + Vite + Tailwind CSS + Recharts).

---

## 🚀 1. Khởi động nhanh với Docker Compose

Chạy toàn bộ hệ thống gồm Database PostgreSQL, Backend API và Frontend Dashboard chỉ với một câu lệnh:

```bash
# A. KHI DÙNG SUPABASE CLOUD (Chỉ chạy Backend & Frontend, không tốn tài nguyên chạy DB local):
docker compose up -d --build

# B. KHI DÙNG DOCKER POSTGRES CỤC BỘ (Khởi chạy đầy đủ cả PostgreSQL, Backend & Frontend):
docker compose --profile local up -d --build

# Kiểm tra trạng thái các containers
docker compose ps

# Dừng hệ thống
docker compose --profile local down
```

### Các cổng dịch vụ truy cập:
* **Frontend Web Dashboard:** [http://localhost:3000](http://localhost:3000)
* **Backend API Swagger Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
* **ReDoc API Documentation:** [http://localhost:8000/redoc](http://localhost:8000/redoc)
* **Backend Health Check:** [http://localhost:8000/health](http://localhost:8000/health)
* **PostgreSQL Database:** `localhost:5432`

---

## 💻 2. Chạy Trực Tiếp Cục Bộ (Local Development)

### A. Khởi chạy Backend FastAPI
```bash
# 1. Cài đặt dependencies
pip install -r backend/requirements.txt

# 2. Nạp dữ liệu sao kê (nếu mới khởi tạo DB)
python scripts/migrate_data.py

# 3. Chạy FastAPI Server
cd backend && uvicorn app.main:app --reload --port 8000
```

### B. Khởi chạy Frontend React Vite
```bash
# 1. Di chuyển vào thư mục frontend & cài đặt thư viện
cd frontend
npm install

# 2. Khởi chạy Vite Dev Server
npm run dev
```
Truy cập giao diện tại: [http://localhost:5173](http://localhost:5173)

---

## 🧪 3. Kiểm thử Tự động (Automated Testing)

Chạy toàn bộ 20 kịch bản kiểm thử tự động với `pytest`:
```bash
python -m pytest backend/tests -v
```

Kiểm tra build frontend:
```bash
cd frontend && npm run build
```

---

## 📱 4. Các Phân Hệ Giao Diện Dashboard (Frontend Pages)

| Trang | Mô tả tính năng |
| :--- | :--- |
| **`Dashboard`** | Tổng quan tài chính (Live Balance, Hạn mức khả dụng), Widget **Đề Xuất Thẻ Chi Tiêu Tối Ưu (Card Recommendation)**, Trợ lý ảo **AI Financial Advisor**, Donut chart chi tiêu & Lịch 30 ngày obligations. |
| **`Thẻ & Hạn mức`** | Chi tiết từng thẻ, bóc tách dư nợ chưa lên sao kê (`unbilled_net_amount`), Ma trận **Chính sách Ưu đãi & Hoàn tiền (Card Benefits Matrix)**, modal chỉnh sửa hạn mức và khóa/mở khóa thẻ an toàn. |
| **`Sổ cái Giao dịch`** | Bảng giao dịch đa lọc (thẻ, loại giao dịch, ngày, tìm kiếm text), phân trang, badge màu sắc rõ ràng, modal Thêm mới & Xóa giao dịch. |
| **`Sao kê & Đối soát`** | Báo cáo đối soát tài chính `MATCHED`/`DISCREPANCY` (`v_statement_reconciliation`) và tiến độ thanh toán từng kỳ (`v_statement_payment_status`). |
| **`Trả góp & Dự phóng`** | Lịch biểu từng kỳ trả góp, Modal **Tất toán trước hạn (Early Settle)** gọi procedure database, biểu đồ dự phóng dòng tiền (`v_installment_monthly_forecast`). |
| **`Báo cáo Phân tích`** | Ma trận quản trị rủi ro hạn mức (Credit Utilization Matrix), biểu đồ cơ cấu chi tiêu nhóm danh mục cha - con và lịch sử chi tiêu. |
| **`Điểm thưởng & Hoàn tiền`**| Sổ cái tích lũy Shinhan Point, Cashback HSBC/Sacombank, dặm bay và cảnh báo điểm sắp hết hạn. |
| **`Cài đặt & Đồng bộ`** | Cấu hình **Telegram Bot Alerts & Thông báo Thông minh**, Nút kích hoạt Re-sync ETL, xem cây danh mục phân cấp 2 cấp. |

---

## 🔔 5. Tính năng Nổi Bật Vừa Nâng Cấp

1. **Smart Notifications & Telegram Alerts**:
   - Tự động quét điều kiện cảnh báo: nhắc nợ sao kê/trả góp trước 3-5 ngày, cảnh báo chạm trần hạn mức >70%, cảnh báo điểm thưởng sắp hết hạn.
   - Chuông thông báo In-App trên Navbar kèm push tin nhắn tức thì qua Telegram Bot.
2. **Card Recommendation Engine**:
   - Nhập số tiền & danh mục dự kiến chi tiêu -> Phân tích ma trận ưu đãi của Shinhan/HSBC/Sacombank + kiểm tra hạn mức khả dụng live -> Đề xuất thẻ tối ưu #1 kèm lý giải minh bạch.
3. **AI Financial Copilot & PDF Parser (Google Gemini API)**:
   - Trợ lý AI trả lời ngôn ngữ tự nhiên về tình hình tài chính cá nhân với context thời gian thực.
   - Trích xuất cấu trúc giao dịch tự động trực tiếp từ tệp PDF sao kê ngân hàng.

---

## 🔌 6. Thông tin kết nối & Biến môi trường

```dotenv
POSTGRES_DB=credit_wallet
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password_here
POSTGRES_PORT=5432
POSTGRES_HOST=localhost
DATABASE_URL=postgresql://your_user:your_password_here@localhost:5432/credit_wallet
DEBUG=true
PROJECT_NAME="Credit Wallet 2.0 API"
# Tùy chọn: Tích hợp AI Financial Advisor & Telegram Bot
GEMINI_API_KEY=your_gemini_api_key_here
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_telegram_chat_id_here
```

---

## 📁 7. Cấu trúc thư mục dự án

```text
├── backend/                      # Backend Service (FastAPI + SQLAlchemy 2.0 Async)
│   ├── app/
│   │   ├── api/v1/endpoints/     # 13 router modules (accounts, txs, notifications, recommendations, ai...)
│   │   ├── core/                 # config, database session & get_db
│   │   ├── models/               # 10 SQLAlchemy ORM Models
│   │   ├── schemas/              # Pydantic V2 schemas & validation
│   │   ├── services/             # Business logic layer (ETL, Notifications, Recommender, AI Assistant...)
│   │   └── main.py               # FastAPI App entrypoint
│   ├── tests/                    # 25+ Automated Unit & Integration tests
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                     # Frontend App (React 18 + Vite + Tailwind + Recharts)
│   ├── src/
│   │   ├── components/           # NotificationBell, CardRecommendationWidget, AICopilotDrawer, Cards, Charts
│   │   ├── pages/                # 8 Dashboard pages
│   │   ├── services/             # Axios API client services
│   │   ├── types/                # TypeScript interfaces
│   │   ├── utils/                # Formatters & Constants
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── data/                         # Tệp sao kê PDF (Shinhan, HSBC, Sacombank) & Excel
├── init-scripts/                 # DDL Schema, Notifications & Card Benefits seeds
├── scripts/migrate_data.py       # ETL script
├── docker-compose.yml            # Khởi chạy toàn bộ hệ thống
├── pytest.ini
└── README.md
```

