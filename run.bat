@echo off
setlocal EnableExtensions

REM Cau hinh hien thi tieng Viet (UTF-8)
chcp 65001 > nul
title SmartFace AIoT - System Manager

REM Xac dinh thu muc goc cua du an
set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

set "FACE_AUTH_PYTHON=python"
if exist "%ROOT_DIR%face_auth\.venv\Scripts\python.exe" (
    set "FACE_AUTH_PYTHON=%ROOT_DIR%face_auth\.venv\Scripts\python.exe"
)

:menu_loop
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
set "choice=1"
set /p "choice=Chon chuc nang [0-8] (Mac dinh: 1): "
set "choice=%choice:"=%"

if "%choice%"=="1" (
    call :run_all_cloud
) else if "%choice%"=="2" (
    call :run_all_docker
) else if "%choice%"=="3" (
    call :run_backend
) else if "%choice%"=="4" (
    call :run_frontend
) else if "%choice%"=="5" (
    call :run_docker
) else if "%choice%"=="6" (
    call :install_deps
) else if "%choice%"=="7" (
    call :migrate_db
) else if "%choice%"=="8" (
    call :open_studio
) else if "%choice%"=="0" (
    echo Tam biet!
    exit /b 0
) else (
    echo Lua chon khong hop le!
    ping 127.0.0.1 -n 2 > nul
)
goto menu_loop

REM ======================================================================
REM   CAC HAM THUC THI CHUC NANG
REM ======================================================================

:start_services
echo.
echo Dang khoi chay Face Auth API, Backend va Frontend trong cua so Terminal moi...
start "SmartFace Backend" cmd /k "cd /d "%ROOT_DIR%backend" && npm run dev"
start "SmartFace Frontend" cmd /k "cd /d "%ROOT_DIR%frontend" && npm run dev"
start "SmartFace Face Auth API" cmd /k "cd /d "%ROOT_DIR%face_auth" && "%FACE_AUTH_PYTHON%" -m uvicorn api_service:app --host 0.0.0.0 --port 5000"
echo Da mo cac terminal. Kiem tra log va /health de xac nhan ready.
goto :eof

:start_docker
echo.
echo Dang khoi dong PostgreSQL va pgAdmin qua Docker...
docker compose --env-file "%ROOT_DIR%.env.compose" --profile tools -f "%ROOT_DIR%docker-compose.yml" up -d
if errorlevel 1 (
    echo [LOI] Khong khoi dong duoc PostgreSQL. Kiem tra Docker Desktop va .env.compose.
    exit /b 1
)
exit /b 0

:run_all_cloud
call :check_env
call :start_services
pause
goto :eof

:run_all_docker
call :check_env
call :start_docker
if errorlevel 1 (
    pause
    goto :eof
)
call :start_services
pause
goto :eof

:run_backend
call :check_env
echo.
echo Dang khoi chay Backend Server trong cua so Terminal moi...
start "SmartFace Backend" cmd /k "cd /d "%ROOT_DIR%backend" && npm run dev"
pause
goto :eof

:run_frontend
call :check_env
echo.
echo Dang khoi chay Frontend Web App trong cua so Terminal moi...
start "SmartFace Frontend" cmd /k "cd /d "%ROOT_DIR%frontend" && npm run dev"
pause
goto :eof

:run_docker
call :check_env
call :start_docker
pause
goto :eof

:install_deps
call :check_env
echo.
echo Dang cai dat dependencies cho Backend...
pushd "%ROOT_DIR%backend"
call npm install
popd

echo.
echo Dang cai dat dependencies cho Frontend...
pushd "%ROOT_DIR%frontend"
call npm install
popd

echo.
echo Cai dat hoan tat!
pause
goto :eof

:migrate_db
call :check_env
echo.
echo Dang tao Prisma Client va Migrate Database (khong seed)...
pushd "%ROOT_DIR%backend"
call npm run prisma:generate
if errorlevel 1 (
    echo [LOI] Migration that bai; kiem tra loi phia tren.
    popd
    pause
    goto :eof
)
call npm run prisma:migrate
if errorlevel 1 (
    echo [LOI] Migration that bai; kiem tra loi phia tren.
    popd
    pause
    goto :eof
)
echo Database migration hoan tat.
popd
pause
goto :eof

:open_studio
call :check_env
echo.
echo Dang mo Prisma Studio tai http://localhost:5555...
start "SmartFace Prisma Studio" cmd /k "cd /d "%ROOT_DIR%backend" && npx prisma studio"
pause
goto :eof

:check_env
if not exist "%ROOT_DIR%backend\.env" (
    echo [THONG BAO] Dang tao backend\.env tu .env.example...
    copy "%ROOT_DIR%backend\.env.example" "%ROOT_DIR%backend\.env" > nul
)
if not exist "%ROOT_DIR%frontend\.env" (
    echo [THONG BAO] Dang tao frontend\.env tu .env.example...
    copy "%ROOT_DIR%frontend\.env.example" "%ROOT_DIR%frontend\.env" > nul
)
if not exist "%ROOT_DIR%face_auth\.env" (
    copy "%ROOT_DIR%face_auth\.env.example" "%ROOT_DIR%face_auth\.env" > nul
)
if not exist "%ROOT_DIR%.env.compose" (
    echo [THONG BAO] Tao .env.compose; dien ten volume PBL6 hien co truoc khi chay Docker.
    copy "%ROOT_DIR%.env.compose.example" "%ROOT_DIR%.env.compose" > nul
)
goto :eof
