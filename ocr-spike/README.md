# OCR Label Scanner -- Sandbox

Standalone web tool for testing OCR extraction from device label photos (routers, NVRs, switches, access points). Uses [ocrlib](../ocr-lib/) for all OCR logic.

> **Security:** This tool extracts passwords and credentials from device labels.
> Images are sent to Google Gemini API. Credentials appear in HTTP responses.
> Use **only on localhost**. Do NOT deploy to any shared or public server.

## Setup

1. Get a Gemini API key at https://aistudio.google.com/apikey

2. Configure:
   ```bash
   cd ocr-spike
   cp .env.example .env
   # Edit .env and set GEMINI_API_KEY
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Run:
   ```bash
   uvicorn backend.main:app --reload
   ```

5. Open http://localhost:8000

## Usage

- Upload a device label photo (JPEG/PNG/WebP, max 10 MB)
- The tool auto-rotates and finds the best orientation
- Extracted fields: MAC, serial, username, passwords, WiFi SSID/password, IP, gateway
- Use the crop tool for labels that are part of a larger photo
- Credential fields are masked in the UI; click to reveal

## Project structure

```
ocr-spike/
  backend/
    main.py           # Thin FastAPI wrapper around ocrlib
  frontend/
    index.html        # Single-page web UI
  .env.example        # Configuration template
  requirements.txt    # Python dependencies
```

All OCR logic (preprocessing, provider, normalization, field extraction) lives in `../ocr-lib/`. This sandbox is just a web UI for testing.

## Configuration (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | -- | Google Gemini API key (required) |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Gemini model to use |

## API

### `POST /scan`

Upload a device label image, get extracted fields.

**Request:** `multipart/form-data` with `file` field (JPEG, PNG, or WebP, max 10MB).

Optional form fields: `rotate`, `crop_x`, `crop_y`, `crop_w`, `crop_h`, `pre_cropped`.

**Response:**
```json
{
  "raw_text": "...",
  "normalized_text": "...",
  "contains_credentials": true,
  "ocr_provider": "gemini",
  "ocr_confidence": 0.90,
  "processing_time_ms": 2100,
  "image_dimensions": [1920, 1080],
  "rotation_applied": 0,
  "warnings": ["Credentials detected in label - handle with care"],
  "fields": {
    "mac_address": {
      "value": "AA:BB:CC:DD:EE:FF",
      "raw_match": "aa:bb:cc:dd:ee:ff",
      "confidence": 0.95,
      "alternatives": []
    },
    "device_password": {
      "value": "********",
      "raw_value": "A1B2C3D4",
      "confidence": 0.7,
      "alternatives": []
    }
  }
}
```

Password fields: `value` is masked (`********`), actual value in `raw_value`. Fields not found: `null`.

### `GET /health`

Returns OCR provider status.

### `GET /config`

Returns available providers (currently Gemini only).
