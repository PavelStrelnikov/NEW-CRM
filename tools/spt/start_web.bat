@echo off
REM Start SPT Web Backend
REM Windows batch script

echo ========================================
echo   SPT Web Backend Starter
echo ========================================
echo.

REM Check if venv exists
if not exist "venv\" (
    echo [ERROR] Virtual environment not found!
    echo Please run: python -m venv venv
    echo Then: venv\Scripts\activate
    echo Then: pip install -r requirements.txt
    pause
    exit /b 1
)

REM Activate venv
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Check if .env exists
if not exist ".env" (
    echo [WARNING] .env file not found!
    echo Please create .env from .env.example
    echo.
)

REM Start backend
echo Starting backend on http://localhost:8001
echo Press Ctrl+C to stop
echo.
python web\backend\api.py

pause
