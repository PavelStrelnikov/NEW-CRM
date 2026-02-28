"""
Data models for the OCR label scanning library.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


# ---------------------------------------------------------------------------
# OCR provider result
# ---------------------------------------------------------------------------

@dataclass
class OCRResult:
    """Result from an OCR provider."""
    text: str                                       # Full extracted text
    confidence: float                               # Average confidence 0.0-1.0
    word_confidences: list[float] = field(default_factory=list)
    provider_name: str = ""


# ---------------------------------------------------------------------------
# Field extraction result
# ---------------------------------------------------------------------------

CREDENTIAL_FIELDS = {"device_password", "wifi_password"}
MASK = "********"


@dataclass
class ExtractedField:
    value: str                              # Normalized / display value
    raw_match: str                          # Original match from OCR text
    confidence: float                       # 0.0 - 1.0
    alternatives: list[str] = field(default_factory=list)
    # For credential fields only:
    raw_value: Optional[str] = None         # Unmasked value (passwords)


@dataclass
class ExtractionResult:
    fields: dict[str, Optional[ExtractedField]]
    contains_credentials: bool
    warnings: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Full scan pipeline result
# ---------------------------------------------------------------------------

@dataclass
class ScanResult:
    """Full result from scan_label() pipeline."""
    extraction: ExtractionResult
    raw_text: str
    normalized_text: str
    ocr_confidence: float
    provider_name: str
    rotation_applied: int
    image_dimensions: tuple[int, int]
    processing_time_ms: int
    rotation_attempts: list[dict]
