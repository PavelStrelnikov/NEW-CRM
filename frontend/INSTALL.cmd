@echo off
REM CRM Frontend Installation Script
REM Run this in Command Prompt (not PowerShell)

echo ========================================
echo CRM Frontend - Installation
echo ========================================
echo.

cd /d "%~dp0"

echo [1/2] Installing npm dependencies...
call npm install

if errorlevel 1 (
    echo.
    echo ERROR: npm install failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo To start the frontend:
echo   npm run dev
echo.
echo Or run START.cmd
echo.
pause
