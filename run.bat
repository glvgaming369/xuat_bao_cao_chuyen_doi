@echo off
title Shopee Affiliate Exporter
chcp 65001 > nul

echo ====================================================================
echo      KHỞI CHẠY HỆ THỐNG XUẤT BÁO CÁO SHOPEE AFFILIATE (V3.1.0)
echo ====================================================================
echo.

:: Di chuyển tới thư mục chứa file script .bat này
cd /d "%~dp0"

:: Kiểm tra xem Node.js đã được cài đặt chưa
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [LỖI] Không tìm thấy Node.js trên máy tính của bạn!
    echo Vui lòng tải và cài đặt Node.js từ: https://nodejs.org/
    echo.
    pause
    exit /b
)

:: Tự động mở trình duyệt web tới giao diện UI sau 2 giây (để chờ server khởi động)
start /b cmd /c "timeout /t 2 >nul && start http://localhost:3000"

:: Chạy Web Server Node.js
echo [System] Đang khởi chạy Server điều khiển...
echo [System] Server sẽ lắng nghe tại: http://localhost:3000
echo [System] Nhấn Ctrl+C trong cửa sổ này để tắt tool.
echo --------------------------------------------------------------------
echo.

node server.js

if %errorlevel% neq 0 (
    echo.
    echo [LỖI] Server gặp sự cố khi đang chạy hoặc bị xung đột cổng 3000.
    echo Vui lòng kiểm tra lại.
    echo.
    pause
)
