#!/bin/bash
# Start SPT Web Backend
# Linux/Mac shell script

echo "========================================"
echo "  SPT Web Backend Starter"
echo "========================================"
echo ""

# Check if venv exists
if [ ! -d "venv" ]; then
    echo "[ERROR] Virtual environment not found!"
    echo "Please run: python -m venv venv"
    echo "Then: source venv/bin/activate"
    echo "Then: pip install -r requirements.txt"
    exit 1
fi

# Activate venv
echo "Activating virtual environment..."
source venv/bin/activate

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "[WARNING] .env file not found!"
    echo "Please create .env from .env.example"
    echo ""
fi

# Start backend
echo "Starting backend on http://localhost:8001"
echo "Press Ctrl+C to stop"
echo ""
python web/backend/api.py
