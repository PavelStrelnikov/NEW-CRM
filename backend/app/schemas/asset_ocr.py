"""
Pydantic schemas for OCR label scanning responses.
"""
from typing import Optional, List
from pydantic import BaseModel


class OcrMappedField(BaseModel):
    """A single OCR-extracted field mapped to a CRM property."""
    ocr_key: str
    value: Optional[str] = None
    raw_value: Optional[str] = None
    confidence: float = 0.0
    alternatives: List[str] = []
    crm_property_key: Optional[str] = None
    crm_basic_field: Optional[str] = None
    label_en: str
    label_he: str


class LabelScanResponse(BaseModel):
    """Response from POST /api/v1/assets/scan-label."""
    fields: List[OcrMappedField]
    ocr_confidence: float
    provider_name: str
    processing_time_ms: int
    rotation_applied: int
    raw_text: str
    warnings: List[str] = []
