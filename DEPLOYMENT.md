# CẨM NANG TRIỂN KHAI PRODUCTION (PRODUCTION DEPLOYMENT GUIDE)
## Ứng Dụng Quản Lý Tài Chính Cá Nhân - Credit Wallet 2.0

Tài liệu này hướng dẫn chi tiết từng bước để triển khai hệ thống **Credit Wallet 2.0** lên máy chủ Production (VPS Linux: Ubuntu 22.04 / 24.04 LTS, Debian, AWS EC2, DigitalOcean, Hetzner, Vultr...) đảm bảo tiêu chuẩn an toàn, bảo mật và hiệu năng cao.

---

## 🏗️ 1. Yêu Cầu Phần Cứng Máy Chủ (Server Specifications)

| Thông số | Tối thiểu (Minimum) | Khuyến nghị (Recommended) |
| :--- | :--- | :--- |
| **CPU** | 1 Core | 2 - 4 Cores |
| **RAM** | 1.5 GB | 2 GB - 4 GB |
| **Ổ cứng (SSD)** | 20 GB NVMe | 40 GB NVMe |
| **Hệ điều hành** | Ubuntu 22.04 / 24.04 LTS | Ubuntu 24.04 LTS |
| **Phần mềm** | Docker Engine 24+ & Docker Compose v2+ | Docker Engine 27+ |

---

## 🚀 2. Chuẩn Bị Máy Chủ VPS (Server Setup)

### Bước 2.1: Cập nhật hệ điều hành & cài đặt Docker
Đăng nhập SSH vào VPS bằng quyền root:

```bash
# Cập nhật packages
sudo apt update && sudo apt upgrade -y

# Cài đặt các công cụ cơ bản
sudo apt install -y curl wget git ufw htop ca-certificates gnupg

# Cài đặt Docker Engine & Docker Compose chính thức
curl -fsSL https://get.docker.com | sudo sh

# Cho phép user hiện tại chạy docker không cần sudo (tùy chọn)
sudo usermod -aG docker $USER
```

### Bước 2.2: Cấu hình tường lửa bảo mật (UFW Firewall)
Chỉ mở các cổng cần thiết cho web và SSH:

```bash
# Cho phép SSH, HTTP và HTTPS
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Kích hoạt tường lửa
sudo ufw enable
sudo ufw status
```

---

## 📦 3. Triển Khai Ứng Dụng (Application Deployment)

### Bước 3.1: Tải mã nguồn dự án
```bash
cd /opt
git clone https://github.com/phongvu2010/E-Wallet-v2.git e-wallet
cd e-wallet
```

### Bước 3.2: Cấu hình biến môi trường Production
Tạo file `.env` từ file mẫu production:

```bash
cp .env.production.example .env
nano .env
```

**Các thông số quan trọng cần thay đổi trong `.env`:**
1. `POSTGRES_PASSWORD`: Đổi thành mật khẩu phức tạp (VD: `Tr0ngP@ssw0rd!2026`).
2. `BACKEND_CORS_ORIGINS`: Điền domain thật của bạn, ví dụ: `["https://wallet.yourdomain.com", "http://IP_VPS"]`.
3. `GEMINI_API_KEY`: API Key cho trợ lý AI và trích xuất PDF sao kê (lấy tại [Google AI Studio](https://aistudio.google.com/)).
4. `TELEGRAM_BOT_TOKEN` & `TELEGRAM_CHAT_ID`: Token nhận cảnh báo nợ & sao kê (tùy chọn).

Phân quyền bảo mật cho tệp `.env`:
```bash
chmod 600 .env
```

### Bước 3.3: Khởi chạy hệ thống bằng Docker Compose Prod
Bạn có 2 lựa chọn triển khai:

```bash
# LỰA CHỌN A: Khi chạy kèm PostgreSQL cục bộ trên máy chủ (Khuyên dùng cho VPS độc lập)
docker compose -f docker-compose.prod.yml --profile local up -d --build

# LỰA CHỌN B: Khi kết nối Database Cloud Supabase / Managed RDS
docker compose -f docker-compose.prod.yml up -d --build
```

Hoặc sử dụng script tự động hóa:
```bash
chmod +x scripts/deploy_prod.sh
./scripts/deploy_prod.sh --local-db
```

Kiểm tra trạng thái containers:
```bash
docker compose -f docker-compose.prod.yml ps
```

---

## 🔒 4. Cấu Hình Tên Miền (Domain) & SSL / HTTPS Miễn Phí

Để truy cập web an toàn qua `https://wallet.yourdomain.com`, bạn có 2 cách:

### Cách 1: Sử dụng Cloudflare (Nhanh & Tiện nhất)
1. Trỏ DNS bản ghi `A` của tên miền về địa chỉ IP của VPS (Bật Proxy màu cam Cloudflare).
2. Trong Cloudflare Dashboard $\rightarrow$ **SSL/TLS** $\rightarrow$ Chọn chế độ **Full** hoặc **Flexible**.
3. Bạn đã có HTTPS ngay lập tức mà không cần cài thêm cert trên VPS.

### Cách 2: Cài đặt Certbot (Let's Encrypt SSL) trực tiếp trên VPS
Nếu không dùng Cloudflare, hãy cài Nginx máy chủ làm reverse proxy SSL:

```bash
# 1. Đổi cổng WEB_PORT trong .env thành 3000 (để Nginx máy chủ dùng cổng 80/443)
# Sửa trong .env: WEB_PORT=3000
docker compose -f docker-compose.prod.yml --profile local up -d

# 2. Cài Nginx & Certbot trên máy chủ VPS
sudo apt install -y nginx certbot python3-certbot-nginx

# 3. Tạo cấu hình Reverse Proxy tại /etc/nginx/sites-available/wallet.conf
sudo tee /etc/nginx/sites-available/wallet.conf << 'EOF'
server {
    listen 80;
    server_name wallet.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 25M;
    }
}
EOF

# 4. Kích hoạt website & xin chứng chỉ SSL tự động
sudo ln -s /etc/nginx/sites-available/wallet.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d wallet.yourdomain.com
```

---

## 💾 5. Thiết Lập Tự Động Sao Lưu Database Hàng Ngày (Automated Backup)

Tạo script backup cơ sở dữ liệu và lưu giữ trong 14 ngày:

```bash
sudo mkdir -p /opt/backups/wallet

sudo tee /opt/backups/backup_db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups/wallet"
DATE=$(date +\%Y\%m\%d_\%H\%M\%S)
BACKUP_FILE="$BACKUP_DIR/credit_wallet_$DATE.sql.gz"

# Lấy container ID của PostgreSQL
CONTAINER_NAME="credit_wallet_db_prod"

# Thực hiện pg_dump và nén gzip
docker exec -t $CONTAINER_NAME pg_dump -U postgres credit_wallet | gzip > "$BACKUP_FILE"

# Xóa các bản backup cũ hơn 14 ngày
find $BACKUP_DIR -type f -name "*.sql.gz" -mtime +14 -delete

echo "[$DATE] Backup created at $BACKUP_FILE"
EOF

sudo chmod +x /opt/backups/backup_db.sh
```

Thiết lập Cronjob chạy tự động lúc **02:00 sáng mỗi ngày**:
```bash
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/backups/backup_db.sh >> /var/log/wallet_backup.log 2>&1") | crontab -
```

---

## 🔄 6. Quy Trình Cập Nhật Phiên Bản Mới (Rolling Upgrade)

Khi có commit mới trên Git, cập nhật hệ thống mà không làm mất dữ liệu:

```bash
cd /opt/e-wallet

# 1. Kéo code mới nhất
git pull origin main

# 2. Build lại image và cập nhật containers
docker compose -f docker-compose.prod.yml --profile local up -d --build --remove-orphans

# 3. Dọn dẹp images cũ không sử dụng
docker image prune -f
```

---

## 🛠️ 7. Xử Lý Sự Cố Thường Gặp (Troubleshooting)

### 1. Xem logs của từng service khi gặp sự cố
```bash
# Xem logs toàn bộ hệ thống (realtime)
docker compose -f docker-compose.prod.yml logs -f

# Xem riêng logs Backend API
docker compose -f docker-compose.prod.yml logs -f backend

# Xem riêng logs Nginx Frontend
docker compose -f docker-compose.prod.yml logs -f frontend
```

### 2. Lỗi `Database connection failed`
* Kiểm tra container PostgreSQL có đang chạy và healthy không: `docker compose -f docker-compose.prod.yml ps db`.
* Nếu dùng Supabase Cloud: Đảm bảo đã bật `POSTGRES_SSLMODE=require` trong `.env` và cổng `6543` không bị chặn bởi mạng server.

### 3. Khôi phục dữ liệu từ file backup `.sql.gz`
```bash
gunzip -c /opt/backups/wallet/credit_wallet_20260919.sql.gz | docker exec -i credit_wallet_db_prod psql -U postgres -d credit_wallet
```
