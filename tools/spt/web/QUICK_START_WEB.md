# Quick Start - SPT Web UI

**Get the web interface running in 5 minutes**

---

## ⚡ Super Quick Start

### 1. Setup (First time only)

```bash
cd tools/spt

# Create .env from example
copy .env.example .env

# Edit .env and add your Gemini API key
notepad .env

# Install dependencies (if not already done)
pip install -r requirements.txt
```

### 2. Start Backend

**Windows:**
```bash
start_web.bat
```

**Linux/Mac:**
```bash
chmod +x start_web.sh
./start_web.sh
```

You should see:
```
Starting backend on http://localhost:8001
INFO:     Uvicorn running on http://0.0.0.0:8001
```

### 3. Open in Browser

Open `http://localhost:8001` in your browser (Chrome recommended).

---

## 🎤 How to Use

1. **Click microphone button** 🎤
2. **Allow microphone access** (browser permission)
3. **Speak** in Russian or Hebrew
4. **Click stop** ⏹
5. **Click "Convert to Ticket"** ✨
6. **View results** and copy normalized text 📋

---

## 🔧 Troubleshooting

**Backend won't start?**
```bash
# Check if .env exists
dir .env

# Check if API key is set
type .env

# Manually start backend
python web/backend/api.py
```

**Frontend can't connect?**
- Ensure backend is running on http://localhost:8001
- Check browser console for errors (F12)
- Try different browser (Chrome recommended)

**Microphone not working?**
- Grant microphone permission in browser
- Check browser supports MediaRecorder API
- Try Chrome/Edge (best support)

---

## 📚 Next Steps

- Read full [Web UI Guide](WEB_UI_GUIDE.md)
- Check [main README](../README.md) for CLI usage
- Review [Architecture docs](../ARCHITECTURE.md)

---

**Need help?** Check backend terminal for error messages
