@echo off
REM CRM Frontend - Start Development Server
REM Make sure backend is running on port 8000

cd /d "%~dp0"

echo ========================================
echo CRM Frontend - Development Server
echo ========================================
echo.
echo Make sure the backend is running:
echo   uvicorn app.main:app --reload
echo.
echo Frontend will be available at:
echo   http://localhost:3000
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

call npm run dev
