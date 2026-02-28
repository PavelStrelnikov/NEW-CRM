# ocrlib

OCR label scanning library -- extract fields from device label photos using Google Gemini Vision API.

Extracts: MAC address, serial number, username, device password, WiFi SSID, WiFi password, IP address, default gateway. Supports Hebrew and English labels.

## Install

```bash
cd ocr-lib
pip install -e .
```

Dependencies: `google-genai`, `Pillow` (installed automatically).

## Quick start

```python
from ocrlib import scan_label

result = await scan_label(image_bytes)

for name, field in result.extraction.fields.items():
    if field:
        print(f"{name}: {field.value} (confidence: {field.confidence:.0%})")
```

## API

### `scan_label(image_bytes, *, provider=None, mode="auto", rotate=0, crop=None) -> ScanResult`

Full pipeline: preprocess -> OCR -> normalize -> extract -> pick best rotation.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `image_bytes` | `bytes` | required | Raw image (JPEG/PNG/WebP) |
| `provider` | `OCRProvider \| None` | `None` | Provider instance. `None` = create default GeminiProvider |
| `mode` | `str` | `"auto"` | `"auto"` tries 4 rotations, `"manual"` applies rotate/crop, `"pre_cropped"` skips preprocessing |
| `rotate` | `int` | `0` | Rotation degrees (mode=manual) |
| `crop` | `tuple[int,int,int,int] \| None` | `None` | (x, y, w, h) crop rectangle (mode=manual) |

Returns `ScanResult`:
- `extraction.fields` -- dict of field name -> `ExtractedField | None`
- `extraction.contains_credentials` -- whether passwords were found
- `raw_text` / `normalized_text` -- OCR output before/after normalization
- `ocr_confidence` -- 0.0-1.0
- `provider_name`, `rotation_applied`, `image_dimensions`, `processing_time_ms`

### `create_provider(provider_name=None, *, api_key=None, model=None) -> OCRProvider`

Factory to create a provider. Pass explicit `api_key` or set `GEMINI_API_KEY` env var.

```python
from ocrlib import create_provider

provider = create_provider(api_key="your-key", model="gemini-2.0-flash")
result = await scan_label(image_bytes, provider=provider)
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | -- | Google Gemini API key (required if not passed explicitly) |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Gemini model to use |

## Low-level usage

Each pipeline step can be used independently:

```python
from ocrlib.providers import create_provider
from ocrlib.preprocessing import preprocess_final
from ocrlib.normalizer import normalize_text
from ocrlib.extractor import extract_fields

provider = create_provider(api_key="...")
processed, w, h = preprocess_final(raw_bytes)
ocr_result = await provider.extract_text(processed)
normalized = normalize_text(ocr_result.text)
extraction = extract_fields(normalized, ocr_result.confidence)
```

## Adding a new provider

1. Create `ocrlib/providers/your_provider.py`
2. Subclass `OCRProvider`:

```python
from ocrlib.providers.base import OCRProvider
from ocrlib.models import OCRResult

class YourProvider(OCRProvider):
    async def extract_text(self, image_bytes: bytes, **kwargs) -> OCRResult:
        # Call your OCR API with image_bytes (PNG format)
        text = ...
        return OCRResult(text=text, confidence=0.9, provider_name=self.name)

    @property
    def name(self) -> str:
        return "your-provider"
```

3. Register in `ocrlib/providers/__init__.py`:

```python
from ocrlib.providers.your_provider import YourProvider

# Add to create_provider():
if name == "your-provider":
    return YourProvider(api_key=api_key, model=model)
```

## Extracted fields

| Field | Key | Example |
|-------|-----|---------|
| MAC Address | `mac_address` | `AA:BB:CC:DD:EE:FF` |
| Serial Number | `serial_number` | `S/N123456789` |
| Username | `username` | `admin` |
| Device Password | `device_password` | `********` (masked) |
| WiFi SSID | `wifi_ssid` | `MyNetwork-5G` |
| WiFi Password | `wifi_password` | `********` (masked) |
| IP Address | `ip_address` | `192.168.1.1` |
| Default Gateway | `default_gateway` | `192.168.1.1` |

Credential fields (`device_password`, `wifi_password`) are masked in `field.value`. The original value is available in `field.raw_value`.
