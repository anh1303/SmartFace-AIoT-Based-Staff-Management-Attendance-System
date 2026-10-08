@echo off
REM Cau hinh hien thi tieng Viet (UTF-8)
chcp 65001 > nul
title SmartFace AIoT - System Manager
cd /d "%~dp0"
set "FACE_AUTH_PYTHON=python"
if exist "%~dp0face_auth\.venv\Scripts\python.exe" set "FACE_AUTH_PYTHON=%~dp0face_auth\.venv\Scripts\python.exe"

:menu
cls
echo ======================================================================
echo   SMARTFACE AIoT - STAFF MANAGEMENT AND ATTENDANCE SYSTEM
echo ======================================================================
echo.
echo   [1] Chay toan bo (Backend, Frontend, Face Auth) - Dung Cloud DB (Mac dinh)
echo   [2] Chay toan bo kem theo Docker Database Local (PostgreSQL + pgAdmin)
echo   [3] Chi chay Backend - Port 3000
echo   [4] Chi chay Frontend - Port 5173
echo   [5] Chi khoi dong Docker Database Local (PostgreSQL + pgAdmin)
echo   [6] Cai dat dependencies cho Backend va Frontend
echo   [7] Chay Prisma Generate va Migrate (khong Seed)
echo   [8] Mo Prisma Studio (Web GUI xem Database tren localhost:5555)
echo   [0] Thoat
echo.
echo ======================================================================
set choice=1
set /p choice="Chon chuc nang [0-8] (Mac dinh: 1): "

if "%choice%"=="1" goto run_cloud
if "%choice%"=="2" goto run_all_docker
if "%choice%"=="3" goto run_backend
if "%choice%"=="4" goto run_frontend
if "%choice%"=="5" goto run_docker
if "%choice%"=="6" goto install_deps
if "%choice%"=="7" goto migrate_db
if "%choice%"=="8" goto open_studio
if "%choice%"=="0" exit
goto menu

:run_cloud
call :check_env
echo.
echo Dang khoi chay Face Auth API, Backend va Frontend (Cloud DB)...
start "SmartFace Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"
start "SmartFace Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"
start "SmartFace Face Auth API" cmd /k "cd /d "%~dp0face_auth" && "%FACE_AUTH_PYTHON%" -m uvicorn api_service:app --host 0.0.0.0 --port 5000"
echo Da mo cac terminal. Kiem tra log va /health de xac nhan ready.
pause
goto menu

:run_all_docker
call :check_env
echo.
echo Dang khoi dong Docker Database Local...
docker compose --env-file .env.compose --profile tools -f docker-compose.yml up -d
if errorlevel 1 (
    echo Khong khoi dong duoc PostgreSQL. Kiem tra Docker Desktop va .env.compose.
    pause
    goto menu
)
echo.
echo Dang khoi chay Face Auth API, Backend va Frontend...
start "SmartFace Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"
start "SmartFace Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"
start "SmartFace Face Auth API" cmd /k "cd /d "%~dp0face_auth" && "%FACE_AUTH_PYTHON%" -m uvicorn api_service:app --host 0.0.0.0 --port 5000"
echo Da mo cac terminal. Kiem tra log va /health de xac nhan ready.
pause
goto menu

:run_backend
call :check_env
echo.
echo Dang khoi chay Backend Server...
start "SmartFace Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"
pause
goto menu

:run_frontend
call :check_env
echo.
echo Dang khoi chay Frontend Web App...
start "SmartFace Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"
pause
goto menu

:run_docker
call :check_env
echo.
echo Dang khoi dong PostgreSQL va pgAdmin qua Docker...
docker compose --env-file .env.compose --profile tools -f docker-compose.yml up -d
if errorlevel 1 echo Khong khoi dong duoc PostgreSQL. Kiem tra Docker Desktop va .env.compose.
pause
goto menu

:install_deps
call :check_env
echo.
echo Dang cai dat dependencies cho Backend...
cd /d "%~dp0backend"
call npm install
echo.
echo Dang cai dat dependencies cho Frontend...
cd /d "%~dp0frontend"
call npm install
cd /d "%~dp0"
echo Cai dat hoan tat!
pause
goto menu

:migrate_db
call :check_env
echo.
echo Dang tao Prisma Client va Migrate Database (khong seed)...
cd /d "%~dp0backend"
call npm run prisma:generate
if errorlevel 1 goto migration_failed
call npm run prisma:migrate
if errorlevel 1 goto migration_failed
cd /d "%~dp0"
echo Database migration hoan tat!
goto migration_done
:migration_failed
cd /d "%~dp0"
echo Migration that bai. Kiem tra loi phia tren.
:migration_done
pause
goto menu

:open_studio
call :check_env
echo.
echo Dang mo Prisma Studio tai http://localhost:5555...
start "SmartFace Prisma Studio" cmd /k "cd /d "%~dp0backend" && npx prisma studio"
pause
goto menu

:check_env
if not exist "%~dp0face_auth\.env" (
    copy "%~dp0face_auth\.env.example" "%~dp0face_auth\.env" > nul
)
if not exist "%~dp0backend\.env" (
    echo [THONG BAO] Dang tao backend\.env tu .env.example...
    copy "%~dp0backend\.env.example" "%~dp0backend\.env" > nul
)
if not exist "%~dp0frontend\.env" (
    echo [THONG BAO] Dang tao frontend\.env tu .env.example...
    copy "%~dp0frontend\.env.example" "%~dp0frontend\.env" > nul
)
if not exist "%~dp0.env.compose" (
    echo [THONG BAO] Tao .env.compose va dien ten volume PostgreSQL PBL6 hien co.
    copy "%~dp0.env.compose.example" "%~dp0.env.compose" > nul
)
goto :eof
