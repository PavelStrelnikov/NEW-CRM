"""
OCR label scanning service.

Wraps ocrlib to scan device labels and map extracted fields
to CRM asset properties. No database access.
"""
import logging
from typing import Optional

from ocrlib import scan_label, create_provider, ScanResult, CREDENTIAL_FIELDS

from app.config import settings

logger = logging.getLogger(__name__)

# Asset type codes that support OCR label scanning
OCR_SUPPORTED_TYPES = {"ROUTER", "SWITCH", "ACCESS_POINT"}

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB

# OCR key → (crm_property_key, crm_basic_field, label_en, label_he) per asset type
# None means the field is shown in preview but has no auto-mapping target.
FIELD_MAPPINGS: dict[str, dict[str, tuple[Optional[str], Optional[str], str, str]]] = {
    "ROUTER": {
        "mac_address":     (None,             None,            "MAC Address",    "כתובת MAC"),
        "serial_number":   (None,             "serial_number", "Serial Number",  "מספר סידורי"),
        "device_username": ("admin_username",  None,           "Admin Username", "שם משתמש מנהל"),
        "device_password": ("admin_password",  None,           "Admin Password", "סיסמת מנהל"),
        "wifi_ssid":       ("wifi_name",       None,           "Wi-Fi Name",    "שם רשת Wi-Fi"),
        "wifi_password":   ("wifi_password",   None,           "Wi-Fi Password", "סיסמת Wi-Fi"),
        "default_ip":      (None,              None,           "Default IP",     "כתובת IP ברירת מחדל"),
        "gateway":         (None,              None,           "Gateway",        "שער ברירת מחדל"),
    },
    "ACCESS_POINT": {
        "mac_address":     (None,             None,            "MAC Address",    "כתובת MAC"),
        "serial_number":   (None,             "serial_number", "Serial Number",  "מספר סידורי"),
        "device_username": (None,              None,           "Admin Username", "שם משתמש מנהל"),
        "device_password": (None,              None,           "Admin Password", "סיסמת מנהל"),
        "wifi_ssid":       ("wifi_ssid",       None,           "Wi-Fi SSID",    "שם רשת Wi-Fi"),
        "wifi_password":   ("wifi_password",   None,           "Wi-Fi Password", "סיסמת Wi-Fi"),
        "default_ip":      (None,              None,           "Default IP",     "כתובת IP ברירת מחדל"),
        "gateway":         (None,              None,           "Gateway",        "שער ברירת מחדל"),
    },
    "SWITCH": {
        "mac_address":     (None,             None,            "MAC Address",    "כתובת MAC"),
        "serial_number":   (None,             "serial_number", "Serial Number",  "מספר סידורי"),
        "device_username": ("admin_username",  None,           "Admin Username", "שם משתמש מנהל"),
        "device_password": ("admin_password",  None,           "Admin Password", "סיסמת מנהל"),
        "wifi_ssid":       (None,              None,           "Wi-Fi SSID",    "שם רשת Wi-Fi"),
        "wifi_password":   (None,              None,           "Wi-Fi Password", "סיסמת Wi-Fi"),
        "default_ip":      (None,              None,           "Default IP",     "כתובת IP ברירת מחדל"),
        "gateway":         (None,              None,           "Gateway",        "שער ברירת מחדל"),
    },
}


def _get_provider():
    """Create OCR provider using configured API key."""
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    return create_provider(api_key=api_key)


async def scan_device_label(
    image_bytes: bytes,
    asset_type_code: str,
) -> dict:
    """
    Scan a device label image and return fields mapped to CRM properties.

    Args:
        image_bytes: Raw image file bytes (JPEG/PNG/WebP).
        asset_type_code: One of ROUTER, SWITCH, ACCESS_POINT.

    Returns:
        Dict matching LabelScanResponse schema.

    Raises:
        ValueError: If asset_type_code is not supported.
        RuntimeError: If OCR processing fails.
    """
    if asset_type_code not in OCR_SUPPORTED_TYPES:
        raise ValueError(
            f"Label scanning not supported for {asset_type_code}. "
            f"Supported types: {', '.join(sorted(OCR_SUPPORTED_TYPES))}"
        )

    type_mappings = FIELD_MAPPINGS[asset_type_code]
    provider = _get_provider()

    logger.info("Starting label scan for asset type %s", asset_type_code)
    result: ScanResult = await scan_label(image_bytes, provider=provider)
    logger.info(
        "Label scan completed in %dms, confidence=%.2f, fields_found=%d",
        result.processing_time_ms,
        result.ocr_confidence,
        sum(1 for f in result.extraction.fields.values() if f is not None),
    )

    mapped_fields = []
    for ocr_key, extracted in result.extraction.fields.items():
        mapping = type_mappings.get(ocr_key)
        if mapping:
            crm_prop, crm_basic, label_en, label_he = mapping
        else:
            crm_prop, crm_basic, label_en, label_he = None, None, ocr_key, ocr_key

        mapped_fields.append({
            "ocr_key": ocr_key,
            "value": extracted.value if extracted else None,
            "raw_value": extracted.raw_value if extracted and ocr_key in CREDENTIAL_FIELDS else None,
            "confidence": extracted.confidence if extracted else 0.0,
            "alternatives": extracted.alternatives if extracted else [],
            "crm_property_key": crm_prop,
            "crm_basic_field": crm_basic,
            "label_en": label_en,
            "label_he": label_he,
        })

    return {
        "fields": mapped_fields,
        "ocr_confidence": result.ocr_confidence,
        "provider_name": result.provider_name,
        "processing_time_ms": result.processing_time_ms,
        "rotation_applied": result.rotation_applied,
        "raw_text": result.raw_text,
        "warnings": result.extraction.warnings,
    }
