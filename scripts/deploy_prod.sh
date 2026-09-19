#!/usr/bin/env bash

# ====================================================================
# CREDIT WALLET 2.0 - PRODUCTION DEPLOYMENT & UPGRADE AUTOMATION SCRIPT
# ====================================================================
# Usage:
#   chmod +x scripts/deploy_prod.sh
#   ./scripts/deploy_prod.sh [--local-db]
# ====================================================================

set -e

# Color helpers
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}====================================================${NC}"
echo -e "${GREEN}  Credit Wallet 2.0 - Production Deployment Script   ${NC}"
echo -e "${GREEN}====================================================${NC}"

# 1. Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}[ERROR] File .env không tồn tại!${NC}"
    echo -e "${YELLOW}Vui lòng tạo tệp .env từ mẫu .env.production.example:${NC}"
    echo -e "  cp .env.production.example .env"
    echo -e "  nano .env"
    exit 1
fi

# 2. Check Docker and Docker Compose
if ! command -v docker &> /dev/null; then
    echo -e "${RED}[ERROR] Docker chưa được cài đặt trên máy chủ.${NC}"
    exit 1
fi

# Determine if running with local DB profile or external (Supabase)
USE_LOCAL_DB=false
if [[ "$1" == "--local-db" ]] || grep -q "POSTGRES_HOST=db" .env; then
    USE_LOCAL_DB=true
fi

# 3. Pull / Build and Deploy
echo -e "\n${YELLOW}[1/4] Đang build và khởi chạy các Docker containers production...${NC}"

if [ "$USE_LOCAL_DB" = true ]; then
    echo -e "  -> Chế độ: Đầy đủ Database PostgreSQL cục bộ + Backend + Frontend"
    docker compose -f docker-compose.prod.yml --profile local up -d --build --remove-orphans
else
    echo -e "  -> Chế độ: Kết nối Database Cloud (Supabase/RDS) + Backend + Frontend"
    docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
fi

# 4. Wait for services to be healthy
echo -e "\n${YELLOW}[2/4] Đang kiểm tra trạng thái sức khỏe (Health Check)...${NC}"
sleep 5

# Display Container Status
docker compose -f docker-compose.prod.yml ps

# 5. Verify Backend API Health
echo -e "\n${YELLOW}[3/4] Kiểm tra Backend Health Endpoint...${NC}"
MAX_RETRIES=10
RETRY_COUNT=0
HEALTH_OK=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health || true)
    if [ "$HTTP_STATUS" == "200" ]; then
        HEALTH_OK=true
        break
    fi
    echo "  Đang chờ Backend khởi động... ($((RETRY_COUNT+1))/$MAX_RETRIES)"
    sleep 3
    RETRY_COUNT=$((RETRY_COUNT+1))
done

if [ "$HEALTH_OK" = true ]; then
    echo -e "${GREEN}  ✓ Backend API đang hoạt động bình thường (HTTP 200 OK)${NC}"
else
    echo -e "${RED}  ✗ Cảnh báo: Backend API chưa phản hồi 200. Kiểm tra logs bằng: docker compose -f docker-compose.prod.yml logs backend${NC}"
fi

# 6. Success Output
echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN}  Triển khai Production thành công!                 ${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "• Frontend Dashboard: http://localhost:80"
echo -e "• Backend API Health: http://localhost:8000/health"
echo -e "• Kiểm tra logs:      docker compose -f docker-compose.prod.yml logs -f"
echo -e "• Dừng hệ thống:      docker compose -f docker-compose.prod.yml down"
echo -e "${GREEN}====================================================${NC}"
