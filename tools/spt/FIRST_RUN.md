# 🚀 First Run Guide - SPT

**Your first successful run in under 10 minutes**

## What You'll Do

1. ✅ Set up Python environment
2. ✅ Configure API key
3. ✅ Test without audio (quick validation)
4. ✅ Test with audio (full pipeline)

---

## Step-by-Step Instructions

### Step 1: Navigate to Project (10 seconds)

```bash
cd C:\Users\Pavel\DEV\Claude\New-CRM\tools\spt
```

---

### Step 2: Create Virtual Environment (2 minutes)

**Why?** Isolate dependencies from your system Python.

```bash
# Create virtual environment
python -m venv venv

# Activate it
# On Windows:
venv\Scripts\activate

# On Linux/Mac:
source venv/bin/activate
```

You should see `(venv)` in your terminal prompt.

---

### Step 3: Install Dependencies (2 minutes)

```bash
pip install -r requirements.txt
```

Expected output:
```
Collecting google-generativeai>=0.8.0
Collecting python-dotenv>=1.0.0
...
Successfully installed google-generativeai-0.8.1 python-dotenv-1.0.1 ...
```

---

### Step 4: Configure API Key (1 minute)

```bash
# Copy the example file
copy .env.example .env

# Open .env in your editor
notepad .env

# Add your Gemini API key:
# GEMINI_API_KEY=AIzaSy...your-actual-key-here
```

**Where to get API key?**
- Go to: https://makersuite.google.com/app/apikey
- Create new key
- Copy and paste into .env

---

### Step 5: First Test - Text Only (30 seconds)

**Test normalization without needing audio files:**

```bash
python test_text_only.py
```

**Expected output:**
```
================================================================================
TEXT-ONLY NORMALIZATION TEST
================================================================================

================================================================================
TEST 1: Russian technician report (cameras)
================================================================================

📝 ORIGINAL TEXT:
────────────────────────────────────────────────────────────
Так короче был на объекте у Когана вчера...

🔧 NORMALIZING (language: ru)...

✅ NORMALIZED OUTPUT:
────────────────────────────────────────────────────────────
Клиент: Коган
Проблема: ...
...
```

**If this works, your setup is correct!** ✅

---

### Step 6: Test with Audio (if you have audio file)

**Option A: Use your own audio file**

```bash
# Place your audio file in audio_samples/
# Then run:
python app/main.py audio_samples/your_file.mp3
```

**Option B: Record a test audio**

1. Record 15-30 seconds of yourself speaking in Russian or Hebrew
2. Describe a simple technical issue (e.g., "Camera не работает")
3. Save as MP3 or WAV
4. Place in `audio_samples/`
5. Run the command above

**Option C: Skip audio testing**

If you don't have audio right now, that's fine! The text-only test proves the system works.

---

## Verification Checklist

After running test_text_only.py, you should see:

- ✅ No errors about missing API key
- ✅ "TEXT-ONLY NORMALIZATION TEST" header
- ✅ Multiple test cases processed
- ✅ Normalized outputs in structured format
- ✅ Translations (for Russian samples)

---

## Common First-Run Issues

### Issue 1: "GEMINI_API_KEY not found"

**Solution:**
```bash
# Check .env exists
dir .env

# Check it contains the key
type .env

# Make sure the line is:
# GEMINI_API_KEY=your_key_here
# (no spaces around =)
```

---

### Issue 2: "No module named 'google.generativeai'"

**Solution:**
```bash
# Make sure venv is activated (you should see (venv) in prompt)
venv\Scripts\activate

# Reinstall dependencies
pip install -r requirements.txt
```

---

### Issue 3: Import errors

**Solution:**
```bash
# Make sure you're in the right directory
cd tools/spt

# Check current directory
cd

# You should be in: ...\New-CRM\tools\spt
```

---

### Issue 4: API quota exceeded

**Solution:**
- You may have hit Gemini's free tier limit
- Wait a few minutes and try again
- Check your quota at: https://makersuite.google.com/

---

## Success Indicators

You'll know everything works when:

1. **test_text_only.py runs without errors**
2. **You see normalized ticket outputs**
3. **Translations appear for Russian text**
4. **No API key errors**

---

## Next Steps After First Run

Now that your environment is working:

1. **Read full documentation**
   - Open `README.md` for complete guide
   - Check `EXAMPLES.md` for real-world scenarios

2. **Try different options**
   ```bash
   # Output in Russian
   python test_text_only.py

   # With audio (if you have it)
   python app/main.py audio_samples/test.mp3 -o ru
   ```

3. **Customize prompts**
   - Edit `prompts/normalize_ru.txt`
   - Edit `prompts/normalize_he.txt`
   - Test your changes with test_text_only.py

4. **Experiment**
   - Try verbose mode: `-v`
   - Try different models: `-m gemini-pro`
   - Try different languages: `-o he` or `-o ru`

---

## Quick Reference

```bash
# Activate environment
venv\Scripts\activate

# Text-only test (fastest)
python test_text_only.py

# Full pipeline with audio
python app/main.py audio_samples/file.mp3

# With options
python app/main.py audio.mp3 -o he -v

# Help
python app/main.py --help

# Deactivate environment when done
deactivate
```

---

## Troubleshooting Quick Fixes

| Problem | Quick Fix |
|---------|-----------|
| Can't find python | Use `python3` instead |
| Can't activate venv | Use full path: `C:\...\venv\Scripts\activate` |
| Import errors | Check you're in `tools/spt/` directory |
| API errors | Verify key in `.env` file |
| Slow responses | Normal! API calls take 2-5 seconds each |

---

## Getting Help

1. **Check logs with verbose mode:**
   ```bash
   python test_text_only.py 2> errors.log
   # Check errors.log file
   ```

2. **Verify configuration:**
   ```bash
   type .env
   # Should show GEMINI_API_KEY=...
   ```

3. **Test API key separately:**
   ```bash
   python -c "import os; from dotenv import load_dotenv; load_dotenv(); print('Key loaded!' if os.getenv('GEMINI_API_KEY') else 'Key missing!')"
   ```

---

## Congratulations! 🎉

If you've made it here and seen normalized outputs, you've successfully:

- ✅ Set up the SPT environment
- ✅ Configured Gemini API
- ✅ Run your first AI pipeline
- ✅ Tested text normalization

**You're ready to start experimenting with voice-to-ticket conversion!**

---

**Need more details?** See `README.md` for comprehensive documentation.

**Want examples?** See `EXAMPLES.md` for real-world scenarios.

**Curious about architecture?** See `ARCHITECTURE.md` for technical details.
