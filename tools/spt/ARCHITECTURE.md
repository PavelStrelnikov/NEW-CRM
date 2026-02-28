# SPT Architecture Documentation

## System Overview

Speech Processing Test (SPT) is a modular pipeline system for converting voice recordings into structured ticket descriptions.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│                     (CLI - app/main.py)                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PIPELINE ORCHESTRATOR                        │
│              (SpeechProcessingPipeline class)                   │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Service 1  │  │   Service 2  │  │   Service 3  │         │
│  │ Speech-to-   │→→│  Translation │→→│ Normalization│         │
│  │    Text      │  │   (optional) │  │              │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       GEMINI API CLIENT                         │
│              (google.generativeai library)                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │   Gemini API   │
                    │  (Cloud-based) │
                    └────────────────┘
```

## Component Breakdown

### 1. CLI Interface (app/main.py)

**Responsibilities**:
- Parse command-line arguments
- Load configuration from .env
- Instantiate pipeline
- Display results to user

**Key Functions**:
- `main()`: Entry point with Click decorators
- `SpeechProcessingPipeline.print_results()`: Format output

**Dependencies**:
- `click`: CLI framework
- `python-dotenv`: Environment variable loading

---

### 2. Pipeline Orchestrator (SpeechProcessingPipeline)

**Responsibilities**:
- Coordinate service calls in correct order
- Decide whether translation is needed
- Handle error propagation
- Aggregate results

**Flow**:
```python
def process_audio(audio_path):
    # 1. Transcribe
    transcript, lang = speech_service.transcribe_audio(audio_path)

    # 2. Translate (conditional)
    if force_translation and lang != output_lang:
        transcript = translate_service.translate(transcript, output_lang)
        lang = output_lang

    # 3. Normalize
    normalized = normalize_service.normalize_ticket(transcript, lang)

    return results
```

---

### 3. Service Layer

#### 3.1 Speech-to-Text Service

**File**: `services/speech_to_text.py`

**Responsibilities**:
- Upload audio to Gemini API
- Transcribe audio to text
- Detect language of speech

**Key Methods**:
```python
class SpeechToTextService:
    def transcribe_audio(audio_path) -> (text, language):
        # Upload audio file
        # Send to Gemini with transcription prompt
        # Parse response for language code and text
        # Return (transcript, language_code)
```

**Supported Audio Formats**:
- MP3, WAV, M4A, OGG
- Max file size: 20 MB (Gemini limit)

**Language Detection**:
- Returns ISO 639-1 codes: `ru`, `he`, `en`
- Uses structured prompt to enforce format

---

#### 3.2 Translation Service

**File**: `services/translate.py`

**Responsibilities**:
- Translate text between Russian, Hebrew, English
- Preserve technical terminology
- Maintain tone and meaning

**Key Methods**:
```python
class TranslationService:
    def translate(text, target_lang, source_lang=None) -> str:
        # Build translation prompt
        # Call Gemini API
        # Return translated text
```

**Optimization**:
- Skips translation if source == target
- Auto-detects source language if not provided

---

#### 3.3 Normalization Service

**File**: `services/normalize_ticket.py`

**Responsibilities**:
- Load language-specific prompts
- Convert casual speech to structured ticket text
- Enforce brevity and factual accuracy

**Key Methods**:
```python
class TicketNormalizationService:
    def normalize_ticket(text, language) -> str:
        # Load prompt for language
        # Append user text to prompt
        # Call Gemini API
        # Return normalized ticket text
```

**Prompt System**:
- Prompts stored in `prompts/normalize_{lang}.txt`
- Prompts loaded at initialization
- One prompt per supported language

---

## Data Flow Diagram

```
┌──────────┐
│ Audio    │
│ File     │
└────┬─────┘
     │
     ▼
┌────────────────────────┐
│ Speech-to-Text         │
│                        │
│ Input:  audio bytes    │
│ Output: text, lang     │
│ API:    Gemini (file)  │
└────┬───────────────────┘
     │
     ▼
  ┌──────────────┐
  │ Need         │◄─── Config: force_translation
  │ Translation? │◄─── Detected: language
  └───┬──────┬───┘     Output: target_language
      │      │
     NO     YES
      │      │
      │      ▼
      │  ┌──────────────────┐
      │  │ Translation      │
      │  │                  │
      │  │ Input:  text     │
      │  │ Output: text     │
      │  │ API:    Gemini   │
      │  └────┬─────────────┘
      │       │
      └───────┤
              ▼
     ┌────────────────────┐
     │ Normalization      │
     │                    │
     │ Input:  text       │
     │ Prompt: lang-based │
     │ Output: ticket     │
     │ API:    Gemini     │
     └────┬───────────────┘
          │
          ▼
     ┌──────────┐
     │ Ticket   │
     │ Text     │
     └──────────┘
```

## Configuration System

### Environment Variables (.env)

```
GEMINI_API_KEY=xxx          # Required: API authentication
OUTPUT_LANGUAGE=he          # Default output language
FORCE_TRANSLATION=true      # Auto-translate to output lang
GEMINI_MODEL=gemini-...     # Model selection
LOG_LEVEL=INFO              # Logging verbosity
```

### CLI Override

Command-line flags override .env settings:
- `-o` / `--output-lang`: Override OUTPUT_LANGUAGE
- `-t` / `--force-translate`: Override FORCE_TRANSLATION
- `-m` / `--model`: Override GEMINI_MODEL
- `-v` / `--verbose`: Override LOG_LEVEL

**Priority**: CLI > .env > defaults

---

## Error Handling Strategy

### Error Categories

1. **Configuration Errors**
   - Missing API key → Exit with message
   - Invalid .env → Use defaults + warn

2. **File Errors**
   - Audio not found → FileNotFoundError
   - Unsupported format → ValueError

3. **API Errors**
   - Network timeout → Retry (not implemented)
   - Quota exceeded → Bubble to user
   - Empty response → ValueError

4. **Service Errors**
   - Invalid language code → Default to 'en'
   - Parsing failure → Use raw response

### Error Flow

```
Service raises exception
        ↓
Pipeline catches
        ↓
Pipeline logs error
        ↓
Pipeline re-raises OR returns partial results
        ↓
main() catches
        ↓
Print error to stderr
        ↓
Exit with code 1
```

---

## Extensibility Points

### Adding New Languages

1. **Add to service constants**:
   ```python
   SUPPORTED_LANGUAGES = {
       'ru': 'Russian',
       'he': 'Hebrew',
       'ar': 'Arabic'  # New
   }
   ```

2. **Create prompt file**:
   `prompts/normalize_ar.txt`

3. **Update CLI choices**:
   ```python
   @click.option('--output-lang', type=click.Choice(['ru', 'he', 'ar']))
   ```

### Adding New Services

1. Create `services/my_service.py`
2. Implement service class with standard interface
3. Add to pipeline in `app/main.py`:
   ```python
   self.my_service = MyService(api_key)
   result = self.my_service.process(data)
   ```

### Custom Output Formats

1. Add method to `SpeechProcessingPipeline`:
   ```python
   def export_json(results, path):
       ...

   def export_csv(results, path):
       ...
   ```

2. Add CLI option:
   ```python
   @click.option('--export', type=click.Choice(['json', 'csv']))
   ```

---

## Performance Characteristics

### Latency

| Stage | Time | Notes |
|-------|------|-------|
| File upload | 1-3s | Depends on file size |
| Transcription | 2-5s | Depends on audio length |
| Translation | 1-2s | Text-only, fast |
| Normalization | 1-2s | Text-only, fast |
| **Total** | **5-12s** | For typical 30s audio |

### API Costs

- Speech-to-Text: ~$0.001-0.01 per minute
- Translation: ~$0.0001 per request
- Normalization: ~$0.0001 per request

**Total per audio**: ~$0.001-0.01

### Scalability

- **Sequential processing**: One audio at a time
- **No caching**: Each run is independent
- **Stateless**: No database, no persistence

---

## Security Considerations

1. **API Key Storage**
   - Never hardcode in source
   - Use .env (gitignored)
   - Rotate keys regularly

2. **Audio Files**
   - Uploaded to Google servers
   - Auto-deleted after processing
   - Don't process sensitive content

3. **Logging**
   - Don't log API keys
   - Don't log full audio content
   - Truncate transcripts in debug logs

---

## Testing Strategy

### Unit Tests (not implemented)

```
tests/
├── test_speech_to_text.py
├── test_translate.py
└── test_normalize.py
```

### Integration Tests

- `test_text_only.py`: Test without audio files
- Manual: Test with real audio samples

### Test Data

- Sample audio files in `audio_samples/`
- Hardcoded text samples in `test_text_only.py`

---

## Future Architecture Improvements

1. **Async processing**: Use `asyncio` for parallel API calls
2. **Caching**: Cache translations and normalizations
3. **Retry logic**: Automatic retry on API failures
4. **Batch processing**: Process multiple files in one run
5. **Database integration**: Store results for analysis
6. **Web API**: RESTful endpoints for remote usage

---

**Last Updated**: 2026-02-07
**Version**: 1.0.0
