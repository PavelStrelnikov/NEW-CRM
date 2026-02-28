# Quick Start Guide - SPT

**Get up and running in 5 minutes**

## Prerequisites

- Python 3.10 or higher
- Gemini API key (get from [Google AI Studio](https://makersuite.google.com/app/apikey))
- Audio file for testing (mp3, wav, m4a, ogg)

## Installation (3 steps)

### 1. Navigate to project
```bash
cd tools/spt
```

### 2. Install dependencies
```bash
# Create virtual environment (optional but recommended)
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate

# Install packages
pip install -r requirements.txt
```

### 3. Configure API key
```bash
# Copy example config
copy .env.example .env  # Windows
# OR
cp .env.example .env    # Linux/Mac

# Edit .env and add your API key
# GEMINI_API_KEY=your_actual_key_here
```

## First Test Run

### Option A: Test with audio file

```bash
# Place an audio file in audio_samples/
# Then run:
python app/main.py audio_samples/your_audio.mp3
```

### Option B: Test without audio (text only)

```bash
# Quick test of normalization only
python test_text_only.py
```

## Expected Output

```
🚀 Starting Speech Processing Pipeline
   Audio file: audio_samples/test.mp3
   Output language: HE
   Force translation: True
   Model: gemini-2.0-flash-exp

============================================================
STEP 1: Speech-to-Text
============================================================
Detected language: ru
Transcript length: 156 chars

============================================================
STEP 2: Translation
============================================================
Translation needed: ru → he
...

============================================================
STEP 3: Normalization
============================================================
Normalizing in he
...

╔══════════════════════════════════════════════════════════╗
║                    PROCESSING RESULTS                    ║
╚══════════════════════════════════════════════════════════╝

📍 Detected Language: RU

────────────────────────────────────────────────────────────
🎤 RAW TRANSCRIPT
────────────────────────────────────────────────────────────
[Your transcribed audio text]

────────────────────────────────────────────────────────────
🌐 TRANSLATED TEXT (HE)
────────────────────────────────────────────────────────────
[Hebrew translation]

────────────────────────────────────────────────────────────
✅ NORMALIZED TICKET TEXT (HE)
────────────────────────────────────────────────────────────
לקוח: [Client name]
תקלה: [Issue description]
פרטים: [Details]
...

════════════════════════════════════════════════════════════

✅ Processing complete!
```

## Common Use Cases

### Keep original language
```bash
python app/main.py audio.mp3 --no-force-translate
```

### Output in Russian
```bash
python app/main.py audio.mp3 -o ru
```

### Verbose logging (for debugging)
```bash
python app/main.py audio.mp3 -v
```

## Troubleshooting

**"GEMINI_API_KEY not found"**
→ Edit `.env` and add your API key

**"Audio file not found"**
→ Check the file path is correct

**"Empty response from Gemini"**
→ Check your API quota and internet connection

## Next Steps

1. Read full [README.md](README.md) for detailed documentation
2. Customize prompts in `prompts/` folder
3. Test with your own audio recordings
4. Experiment with different languages and settings

---

**Need help?** Check the logs with `-v` flag or review README.md
