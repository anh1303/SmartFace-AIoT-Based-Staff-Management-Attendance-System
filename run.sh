#!/usr/bin/env bash

# ======================================================================
#   SMARTFACE AIoT - STAFF MANAGEMENT AND ATTENDANCE SYSTEM
#   Script dieu khien va khoi chay he thong danh cho macOS (va Linux)
# ======================================================================

# Xac dinh thu muc goc cua du an
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Ham dung man hinh cho nguoi dung nhan phim
pause() {
  echo ""
  read -n 1 -s -r -p "Nhan phim bat ky de tiep tuc . . ."
  echo ""
}

# Ham tu dong kiem tra va tao file .env neu chua ton tai
check_env() {
  if [ ! -f "$DIR/backend/.env" ]; then
    echo "[THONG BAO] Dang tao backend/.env tu .env.example..."
    cp "$DIR/backend/.env.example" "$DIR/backend/.env"
  fi
  if [ ! -f "$DIR/frontend/.env" ]; then
    echo "[THONG BAO] Dang tao frontend/.env tu .env.example..."
    cp "$DIR/frontend/.env.example" "$DIR/frontend/.env"
  fi
}

# Ham mo cua so Terminal moi tren macOS
open_terminal() {
  local title="$1"
  local cmd="$2"

  if [[ "$OSTYPE" == "darwin"* ]] && command -v osascript >/dev/null 2>&1; then
    # Tren macOS: Mo cua so Terminal.app moi va thuc thi lenh
    osascript -e "tell application \"Terminal\" to do script \"echo -n -e '\\033]0;$title\\007'; cd '$DIR' && $cmd\"" >/dev/null
  else
    # Fallback cho Linux hoac moi truong khong co AppleScript: Chay background
    echo "[INFO] Dang chay trong background: $title"
    (cd "$DIR" && eval "$cmd") &
  fi
}

menu() {
  while true; do
    clear
    echo "======================================================================"
    echo "  SMARTFACE AIoT - STAFF MANAGEMENT AND ATTENDANCE SYSTEM"
    echo "======================================================================"
    echo ""
    echo "  [1] Chay toan bo he thong - Docker DB, Backend va Frontend"
    echo "  [2] Chay Backend va Frontend - Khong dung Docker"
    echo "  [3] Chi chay Backend - Port 3000"
    echo "  [4] Chi chay Frontend - Port 5173"
    echo "  [5] Khoi dong Docker Database - PostgreSQL va pgAdmin"
    echo "  [6] Cai dat dependencies cho Backend va Frontend"
    echo "  [7] Chay Prisma Migrate va Seed Data"
    echo "  [0] Thoat"
    echo ""
    echo "======================================================================"
    read -p "Chon chuc nang [0-7] (Mac dinh: 1): " choice
    choice=${choice:-1}

    case "$choice" in
      1)
        check_env
        echo ""
        echo "Dang khoi dong Docker Database..."
        docker compose -f "$DIR/backend/docker-compose.yml" up -d
        echo ""
        echo "Dang khoi chay Backend va Frontend trong cua so Terminal moi..."
        open_terminal "SmartFace Backend" "cd '$DIR/backend' && npm run dev"
        open_terminal "SmartFace Frontend" "cd '$DIR/frontend' && npm run dev"
        echo "Da khoi chay cac dich vu thanh cong!"
        pause
        ;;
      2)
        check_env
        echo ""
        echo "Dang khoi chay Backend va Frontend trong cua so Terminal moi..."
        open_terminal "SmartFace Backend" "cd '$DIR/backend' && npm run dev"
        open_terminal "SmartFace Frontend" "cd '$DIR/frontend' && npm run dev"
        echo "Da mo 2 cua so Terminal chay Backend va Frontend!"
        pause
        ;;
      3)
        check_env
        echo ""
        echo "Dang khoi chay Backend Server trong cua so Terminal moi..."
        open_terminal "SmartFace Backend" "cd '$DIR/backend' && npm run dev"
        pause
        ;;
      4)
        check_env
        echo ""
        echo "Dang khoi chay Frontend Web App trong cua so Terminal moi..."
        open_terminal "SmartFace Frontend" "cd '$DIR/frontend' && npm run dev"
        pause
        ;;
      5)
        echo ""
        echo "Dang khoi dong PostgreSQL va pgAdmin qua Docker..."
        docker compose -f "$DIR/backend/docker-compose.yml" up -d
        pause
        ;;
      6)
        check_env
        echo ""
        echo "Dang cai dat dependencies cho Backend..."
        (cd "$DIR/backend" && npm install)
        echo ""
        echo "Dang cai dat dependencies cho Frontend..."
        (cd "$DIR/frontend" && npm install)
        echo "Cai dat hoan tat!"
        pause
        ;;
      7)
        check_env
        echo ""
        echo "Dang tao Prisma Client, Migrate va Seed Database..."
        (
          cd "$DIR/backend" && \
          npm run prisma:generate && \
          npm run prisma:migrate && \
          npm run prisma:seed
        )
        echo "Database Migrate va Seed hoan tat!"
        pause
        ;;
      0)
        echo "Tam biet!"
        exit 0
        ;;
      *)
        echo "Lua chon khong hop le!"
        sleep 1
        ;;
    esac
  done
}

menu
