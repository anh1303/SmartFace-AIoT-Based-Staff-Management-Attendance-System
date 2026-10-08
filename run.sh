#!/usr/bin/env bash

# ======================================================================
#   SMARTFACE AIoT - STAFF MANAGEMENT AND ATTENDANCE SYSTEM
#   Script dieu khien va khoi chay he thong danh cho macOS (va Linux)
# ======================================================================

# Xac dinh thu muc goc cua du an
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FACE_AUTH_PYTHON="python3"
if [ -x "$DIR/face_auth/.venv/bin/python" ]; then
  FACE_AUTH_PYTHON="$DIR/face_auth/.venv/bin/python"
fi

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
  if [ ! -f "$DIR/face_auth/.env" ]; then
    cp "$DIR/face_auth/.env.example" "$DIR/face_auth/.env"
  fi
  if [ ! -f "$DIR/.env.compose" ]; then
    echo "[THONG BAO] Tao .env.compose; dien ten volume PBL6 hien co truoc khi chay Docker."
    cp "$DIR/.env.compose.example" "$DIR/.env.compose"
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
    echo "  [1] Chay toan bo (Backend, Frontend, Face Auth) - Dung Cloud DB (Mac dinh)"
    echo "  [2] Chay toan bo kem theo Docker Database Local (PostgreSQL + pgAdmin)"
    echo "  [3] Chi chay Backend - Port 3000"
    echo "  [4] Chi chay Frontend - Port 5173"
    echo "  [5] Chi khoi dong Docker Database Local (PostgreSQL + pgAdmin)"
    echo "  [6] Cai dat dependencies cho Backend va Frontend"
    echo "  [7] Chay Prisma Generate va Migrate (khong Seed)"
    echo "  [8] Mo Prisma Studio (Web GUI xem Database tren localhost:5555)"
    echo "  [0] Thoat"
    echo ""
    echo "======================================================================"
    read -p "Chon chuc nang [0-8] (Mac dinh: 1): " choice
    choice=${choice:-1}

    case "$choice" in
      1)
        check_env
        echo ""
        echo "Dang khoi chay Face Auth API, Backend va Frontend (Cloud DB) trong cua so Terminal moi..."
        open_terminal "SmartFace Backend" "cd '$DIR/backend' && npm run dev"
        open_terminal "SmartFace Frontend" "cd '$DIR/frontend' && npm run dev"
        open_terminal "SmartFace Face Auth API" "cd '$DIR/face_auth' && '$FACE_AUTH_PYTHON' -m uvicorn api_service:app --host 0.0.0.0 --port 5000"
        echo "Da mo terminal Face Auth API, Backend va Frontend. Kiem tra /health de xac nhan ready."
        pause
        ;;
      2)
        check_env
        echo ""
        echo "Dang khoi dong Docker Database Local..."
        if ! docker compose --env-file "$DIR/.env.compose" --profile tools -f "$DIR/docker-compose.yml" up -d; then
          echo "Khong khoi dong duoc PostgreSQL. Kiem tra Docker Desktop va .env.compose."
          pause
          continue
        fi
        echo ""
        echo "Dang khoi chay Face Auth API, Backend va Frontend trong cua so Terminal moi..."
        open_terminal "SmartFace Backend" "cd '$DIR/backend' && npm run dev"
        open_terminal "SmartFace Frontend" "cd '$DIR/frontend' && npm run dev"
        open_terminal "SmartFace Face Auth API" "cd '$DIR/face_auth' && '$FACE_AUTH_PYTHON' -m uvicorn api_service:app --host 0.0.0.0 --port 5000"
        echo "Da mo cac terminal. Kiem tra log va /health de xac nhan ready."
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
        check_env
        echo ""
        echo "Dang khoi dong PostgreSQL va pgAdmin qua Docker..."
        if ! docker compose --env-file "$DIR/.env.compose" --profile tools -f "$DIR/docker-compose.yml" up -d; then
          echo "Khong khoi dong duoc PostgreSQL. Kiem tra Docker Desktop va .env.compose."
          pause
          continue
        fi
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
        echo "Dang tao Prisma Client va Migrate Database (khong seed)..."
        if (
          cd "$DIR/backend" && \
          npm run prisma:generate && \
          npm run prisma:migrate
        ); then
          echo "Database migration hoan tat."
        else
          echo "Migration that bai; kiem tra loi phia tren."
        fi
        pause
        ;;
      8)
        check_env
        echo ""
        echo "Dang mo Prisma Studio tai http://localhost:5555..."
        open_terminal "SmartFace Prisma Studio" "cd '$DIR/backend' && npx prisma studio"
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
