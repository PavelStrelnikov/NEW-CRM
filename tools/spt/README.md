# Speech Processing Test (SPT)

**Isolated sandbox for testing AI-powered voice-to-ticket conversion**

## 📋 Overview

SPT is a standalone testing environment for validating the full voice-to-ticket pipeline for the New CRM system. It processes technician voice recordings and converts them into structured, professional ticket descriptions.

**This is NOT integrated with the main CRM** — it's a proof-of-concept sandbox for experimentation.

## 🎯 Purpose

Test the complete pipeline:
```
Voice Audio → Speech-to-Text → Language Detection →
→ (Optional) Translation → Normalization → Structured Ticket Text
```

### Key Features

- ✅ **Speech-to-Text**: Accurate transcription using Gemini API
- ✅ **Language Detection**: Automatic detection of Russian, Hebrew, English
- ✅ **Translation**: Optional translation to target language
- ✅ **Normalization**: AI-powered conversion of casual speech to professional ticket text
- ✅ **Configurable**: Control output language and translation behavior
- ✅ **Web UI**: Browser-based interface with one-click recording (NEW!)

### 🌐 Two Interfaces Available

**1. CLI (Command Line)**
- Process audio files from disk
- Batch processing
- Automation-friendly
- Terminal-based

**2. Web UI (Browser)**
- Live voice recording
- Chat-like interface
- Mobile-friendly
- User-friendly

See [Web UI Guide](web/WEB_UI_GUIDE.md) for web interface documentation.

## 🏗 Architecture

```
tools/spt/
├── app/
│   └── main.py                 # CLI entry point
├── services/
│   ├── speech_to_text.py       # Gemini-based transcription
│   ├── translate.py            # Gemini-based translation
│   └── normalize_ticket.py     # Text normalization
├── prompts/
│   ├── normalize_ru.txt        # Russian normalization prompt
│   └── normalize_he.txt        # Hebrew normalization prompt
├── web/                        # Web UI (NEW!)
│   ├── backend/
│   │   └── api.py              # FastAPI server
│   ├── frontend/
│   │   ├── index.html          # Web interface
│   │   ├── app.js              # Recording + API logic
│   │   └── style.css           # Styling
│   └── WEB_UI_GUIDE.md         # Web UI documentation
├── audio_samples/              # Test audio files
├── .env                        # Configuration (create from .env.example)
├── .env.example                # Configuration template
├── requirements.txt            # Python dependencies
├── start_web.bat/sh            # Web backend launcher
└── README.md                   # This file
```

### Pipeline Flow

```
┌─────────────┐
│ Audio File  │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│ Speech-to-Text      │ ← Gemini API
│ + Language Detection│
└──────┬──────────────┘
       │
       ▼
   ┌───────────┐
   │ Translation│ ← Gemini API (if needed)
   └─────┬─────┘
         │
         ▼
   ┌──────────────┐
   │ Normalization│ ← Gemini API with custom prompts
   └──────┬───────┘
          │
          ▼
   ┌──────────────────┐
   │ Structured Ticket│
   └──────────────────┘
```

## 🚀 Quick Start

### 1. Installation

```bash
# Navigate to SPT directory
cd tools/spt

# Create virtual environment (recommended)
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configuration

```bash
# Copy example configuration
cp .env.example .env

# Edit .env and add your Gemini API key
# GEMINI_API_KEY=your_actual_key_here
```

### 3. Run Pipeline

```bash
# Basic usage (output in Hebrew)
python app/main.py audio_samples/technician_report.mp3

# Output in Russian
python app/main.py audio_samples/technician_report.mp3 -o ru

# Keep original language (no translation)
python app/main.py audio_samples/technician_report.mp3 --no-force-translate

# Use different model
python app/main.py audio_samples/technician_report.mp3 -m gemini-pro

# Verbose logging
python app/main.py audio_samples/technician_report.mp3 -v
```

### 4. Web UI (Optional)

**Start web backend:**
```bash
# Windows
start_web.bat

# Linux/Mac
chmod +x start_web.sh
./start_web.sh

# Manual
python web/backend/api.py
```

**Open web interface:**
1. Backend will start on `http://localhost:8001`
2. Open `http://localhost:8001` in your browser
3. Click microphone button and speak
4. Click stop and convert to ticket

**Full guide:** See [web/WEB_UI_GUIDE.md](web/WEB_UI_GUIDE.md)

## 📖 Usage Examples

### Example 1: Russian Speech → Hebrew Ticket

**Input Audio** (Russian):
> "Так, короче был на объекте у Когана вчера, там камеры глючат опять, ну то есть три штуки показывают нормально а остальные вообще черный экран, проверял кабели все вроде целые, может регик умер не знаю"

**Output (Normalized Hebrew)**:
```
לקוח: כהן
תקלה: חלק מהמצלמות אינן מציגות תמונה
פרטים: 3 מצלמות עובדות תקין, שאר המצלמות מציגות מסך שחור. כבלים נבדקו - תקינים.
חשד: תקלה אפשרית ב-NVR.
```

### Example 2: Hebrew Speech → Hebrew Ticket (No Translation)

**Input Audio** (Hebrew):
> "היי אני אצל משה בפיצרייה ברמת גן, הוא אמר שהאזעקה לא מפסיקה לצפצף, החיישן ליד הדלת האחורית כנראה התקלקל, צריך להחליף אותו"

**Output (Normalized Hebrew)**:
```
לקוח: פיצרייה ברמת גן (משה)
תקלה: אזעקה מתמשכת
פרטים: חיישן בדלת אחורית גורם לצפצופים רציפים.
נדרש: החלפת חיישן.
```

### Example 3: Russian Speech → Russian Ticket

**Command**:
```bash
python app/main.py audio.mp3 -o ru --force-translate
```

**Input Audio** (Russian):
> "Слушай, был у клиента на Дизенгоф, там свитч вообще не работает, индикаторы не горят, попробовал другой блок питания, тоже самое, короче похоже он сдох"

**Output (Normalized Russian)**:
```
Клиент: объект на ул. Дизенгоф
Проблема: сетевой коммутатор не работает
Детали: индикаторы не светятся, замена блока питания не помогла.
Вывод: неисправность коммутатора.
```

## 🎛 Configuration Options

### Environment Variables (.env)

| Variable | Description | Default | Values |
|----------|-------------|---------|--------|
| `GEMINI_API_KEY` | Google Gemini API key | *(required)* | Your API key |
| `OUTPUT_LANGUAGE` | Default output language | `he` | `ru`, `he` |
| `FORCE_TRANSLATION` | Always translate to output language | `true` | `true`, `false` |
| `GEMINI_MODEL` | Gemini model to use | `gemini-2.0-flash` | Any Gemini model |
| `LOG_LEVEL` | Logging verbosity | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR` |

### CLI Options

```bash
python app/main.py [OPTIONS] AUDIO_FILE

Options:
  -o, --output-lang [ru|he]     Output language (default: he)
  -t, --force-translate         Force translation to output language (default: on)
  -T, --no-force-translate      Keep original language
  -m, --model TEXT              Gemini model name
  -v, --verbose                 Enable verbose logging
  --help                        Show help message
```

## 📊 Output Format

The pipeline generates:

1. **Detected Language**: Auto-detected language code
2. **Raw Transcript**: Verbatim transcription of the audio
3. **Translated Text**: (if translation was applied)
4. **Normalized Ticket Text**: Structured, professional ticket description

### Output Structure

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                           PROCESSING RESULTS                                 ║
╚══════════════════════════════════════════════════════════════════════════════╝

📍 Detected Language: RU

────────────────────────────────────────────────────────────────────────────────
🎤 RAW TRANSCRIPT
────────────────────────────────────────────────────────────────────────────────
[Original transcription here...]

────────────────────────────────────────────────────────────────────────────────
🌐 TRANSLATED TEXT (HE)
────────────────────────────────────────────────────────────────────────────────
[Translated text if applicable...]

────────────────────────────────────────────────────────────────────────────────
✅ NORMALIZED TICKET TEXT (HE)
────────────────────────────────────────────────────────────────────────────────
[Structured ticket description...]

════════════════════════════════════════════════════════════════════════════════
```

## 🔧 Customization

### Adding New Languages

1. **Add language support** in `services/speech_to_text.py`:
   ```python
   SUPPORTED_LANGUAGES = {
       'ru': 'Russian',
       'he': 'Hebrew',
       'en': 'English',
       'ar': 'Arabic'  # New language
   }
   ```

2. **Create normalization prompt** in `prompts/normalize_ar.txt`

3. **Update translation service** in `services/translate.py`

### Customizing Normalization Prompts

Edit prompt files in `prompts/`:
- `normalize_ru.txt` — Russian normalization rules
- `normalize_he.txt` — Hebrew normalization rules

**Prompt Guidelines**:
- Keep prompts focused on factual extraction
- Avoid adding information not in the source
- Enforce brevity (5-7 lines max)
- Preserve technical details (equipment names, locations)

## 🧪 Testing

### Sample Audio Files

Place test audio files in `audio_samples/`:
- `.mp3`, `.wav`, `.ogg`, `.m4a` formats supported
- Typical length: 15-60 seconds
- Content: technician describing a service issue

### Test Scenarios

1. **Single language** (no translation):
   ```bash
   python app/main.py audio_samples/russian_tech.mp3 -o ru -T
   ```

2. **Cross-language** (with translation):
   ```bash
   python app/main.py audio_samples/russian_tech.mp3 -o he -t
   ```

3. **Language detection accuracy**:
   ```bash
   python app/main.py audio_samples/mixed_audio.mp3 -v
   ```

## ⚠️ Limitations

- **No UI**: Command-line only
- **No database**: Results are ephemeral (printed to console)
- **No CRM integration**: Standalone testing tool
- **API costs**: Each run consumes Gemini API quota
- **Supported languages**: Russian, Hebrew only for normalization

## 🔐 Security Notes

- **Never commit `.env`** to version control
- Store API keys securely
- Do not process sensitive audio in production environments
- This is a testing tool only

## 📚 Technical Details

### Dependencies

- `google-generativeai` — Gemini API client
- `python-dotenv` — Environment variable management
- `click` — CLI framework
- `pydub` — Audio format handling

### API Usage

Each pipeline run makes:
- 1 API call for speech-to-text
- 0-1 API calls for translation (if needed)
- 1 API call for normalization

**Total**: 2-3 Gemini API calls per audio file

### Performance

- **Speed**: ~3-10 seconds per audio file (depends on length and model)
- **Accuracy**: High for clear speech, lower for noisy environments
- **Cost**: ~$0.001-0.01 per run (varies by model and audio length)

## 🛠 Troubleshooting

### Common Issues

**Error: "GEMINI_API_KEY not found"**
- Ensure `.env` file exists in `tools/spt/`
- Verify `GEMINI_API_KEY=...` is set correctly

**Error: "Audio file not found"**
- Check file path is correct
- Use absolute path or path relative to `tools/spt/`

**Poor transcription quality**
- Try a different model (e.g., `gemini-pro`)
- Ensure audio is clear and minimal background noise
- Check audio format is supported

**Translation not working**
- Verify `FORCE_TRANSLATION=true` in `.env`
- Check language codes are correct (`ru`, `he`)

**Empty or strange normalization output**
- Review prompt files in `prompts/`
- Check the model supports the language
- Try with verbose logging (`-v`) to see API responses

## 🔄 Future Enhancements

Potential improvements (not implemented):
- [ ] Web UI for easier testing
- [ ] Batch processing multiple files
- [ ] Export results to JSON/CSV
- [ ] Integration with CRM database
- [ ] Support for more languages (English, Arabic)
- [ ] Real-time streaming transcription
- [ ] Speaker diarization (multiple speakers)
- [ ] Background noise filtering

## 📞 Support

This is an experimental tool. For issues:
1. Check logs with `-v` flag
2. Verify API key and configuration
3. Test with sample audio files
4. Review Gemini API documentation

## 📄 License

Internal tool for New CRM project. Not for external distribution.

---

**Last Updated**: 2026-02-07
**Version**: 1.0.0
**Status**: Experimental / Proof of Concept
