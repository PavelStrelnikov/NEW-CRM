"""
ocrlib -- OCR label scanning library.

Extract fields (MAC, serial, credentials, WiFi, IP) from device label photos
using Google Gemini Vision API.

High-level usage::

    from ocrlib import scan_label
    result = await scan_label(image_bytes)
    print(result.extraction.fields)

Low-level usage::

    from ocrlib.providers import create_provider
    from ocrlib.preprocessing import preprocess_final
    from ocrlib.normalizer import normalize_text
    from ocrlib.extractor import extract_fields

    provider = create_provider(api_key="...")
    processed, w, h = preprocess_final(raw_bytes)
    ocr_result = await provider.extract_text(processed)
    normalized = normalize_text(ocr_result.text)
    extraction = extract_fields(normalized, ocr_result.confidence)
"""
from ocrlib.models import (
    OCRResult,
    ExtractedField,
    ExtractionResult,
    ScanResult,
    CREDENTIAL_FIELDS,
    MASK,
)
from ocrlib.pipeline import scan_label
from ocrlib.providers import create_provider, GeminiProvider
from ocrlib.providers.base import OCRProvider

__all__ = [
    "scan_label",
    "create_provider",
    "OCRProvider",
    "GeminiProvider",
    "OCRResult",
    "ExtractedField",
    "ExtractionResult",
    "ScanResult",
    "CREDENTIAL_FIELDS",
    "MASK",
]
