@echo off
REM Cau hinh hien thi tieng Viet (UTF-8)
chcp 65001 > nul
title SmartFace AIoT - System Manager

:menu
cls
echo ======================================================================
echo   SMARTFACE AIoT - STAFF MANAGEMENT AND ATTENDANCE SYSTEM
echo ======================================================================
echo.
echo   [1] Chay toan bo he thong - Docker DB, Backend va Frontend
echo   [2] Chay Backend va Frontend - Khong dung Docker
echo   [3] Chi chay Backend - Port 3000
echo   [4] Chi chay Frontend - Port 5173
echo   [5] Khoi dong Docker Database - PostgreSQL va pgAdmin
echo   [6] Cai dat dependencies cho Backend va Frontend
echo   [7] Chay Prisma Migrate va Seed Data
echo   [0] Thoat
echo.
echo ======================================================================
set choice=1
set /p choice="Chon chuc nang [0-7] (Mac dinh: 1): "

if "%choice%"=="1" goto run_all
if "%choice%"=="2" goto run_dev
if "%choice%"=="3" goto run_backend
if "%choice%"=="4" goto run_frontend
if "%choice%"=="5" goto run_docker
if "%choice%"=="6" goto install_deps
if "%choice%"=="7" goto seed_db
if "%choice%"=="0" exit
goto menu

:run_all
echo.
echo Dang khoi dong Docker Database...
docker compose -f backend/docker-compose.yml up -d
echo.
echo Dang khoi chay Backend va Frontend...
start "SmartFace Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"
start "SmartFace Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"
echo Da khoi chay cac dich vu thanh cong!
pause
goto menu

:run_dev
echo.
echo Dang khoi chay Backend va Frontend...
start "SmartFace Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"
start "SmartFace Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"
echo Da mo 2 cua so chay Backend va Frontend!
pause
goto menu

:run_backend
echo.
echo Dang khoi chay Backend Server...
start "SmartFace Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"
pause
goto menu

:run_frontend
echo.
echo Dang khoi chay Frontend Web App...
start "SmartFace Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"
pause
goto menu

:run_docker
echo.
echo Dang khoi dong PostgreSQL va pgAdmin qua Docker...
docker compose -f backend/docker-compose.yml up -d
pause
goto menu

:install_deps
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

:seed_db
echo.
echo Dang tao Prisma Client, Migrate va Seed Database...
cd /d "%~dp0backend"
call npm run prisma:generate
call npm run prisma:migrate
call npm run prisma:seed
cd /d "%~dp0"
echo Database Migrate va Seed hoan tat!
pause
goto menu

