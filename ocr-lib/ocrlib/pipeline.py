"""
High-level OCR scanning pipeline.

Chains: preprocessing -> OCR -> normalization -> extraction -> scoring.
Tries multiple rotations and picks the best result.
"""
import logging
import time

from ocrlib.models import OCRResult, ScanResult
from ocrlib.providers.base import OCRProvider
from ocrlib.providers import create_provider
from ocrlib.preprocessing import preprocess_all_rotations, preprocess_final, preprocess_manual
from ocrlib.normalizer import normalize_text
from ocrlib.extractor import extract_fields

logger = logging.getLogger(__name__)


async def scan_label(
    image_bytes: bytes,
    *,
    provider: OCRProvider | None = None,
    mode: str = "auto",
    rotate: int = 0,
    crop: tuple[int, int, int, int] | None = None,
) -> ScanResult:
    """
    Full OCR pipeline: preprocess -> OCR -> normalize -> extract -> pick best.

    Args:
        image_bytes: Raw image file bytes (JPEG/PNG/WebP).
        provider: OCR provider instance. If None, creates default GeminiProvider.
        mode: "auto" (try all rotations), "manual" (apply rotate/crop),
              "pre_cropped" (image already cropped by caller).
        rotate: Manual rotation degrees (used when mode="manual").
        crop: (x, y, w, h) crop rectangle (used when mode="manual").

    Returns:
        ScanResult with best extraction, OCR text, and metadata.

    Raises:
        ValueError: If image is invalid or too small.
        RuntimeError: If all OCR attempts fail.
    """
    t0 = time.monotonic()

    if provider is None:
        provider = create_provider()

    # 1. Preprocess
    if mode == "pre_cropped":
        processed_bytes, orig_w, orig_h = preprocess_final(image_bytes)
        variants = [(0, processed_bytes)]
    elif mode == "manual":
        processed_bytes, orig_w, orig_h = preprocess_manual(image_bytes, rotate, crop)
        variants = [(rotate, processed_bytes)]
    else:  # "auto"
        variants, orig_w, orig_h = preprocess_all_rotations(image_bytes)

    # 2. OCR each rotation variant, score by extracted fields
    best_result: OCRResult | None = None
    best_angle: int = 0
    best_score: float = -1
    best_extraction = None
    best_normalized: str = ""
    all_attempts: list[dict] = []

    for angle, variant_bytes in variants:
        label = f"{angle}\u00b0"
        try:
            ocr_result = await provider.extract_text(variant_bytes)
            text = ocr_result.text.strip()
            if not text:
                all_attempts.append({
                    "angle": angle,
                    "confidence": 0.0, "text_length": 0, "fields_found": 0,
                })
                continue

            # Normalize and extract fields for scoring
            norm = normalize_text(ocr_result.text)
            extr = extract_fields(norm, ocr_result.confidence)

            # Score = fields found * 10 + confidence
            # This prioritizes results that actually extract useful data
            fields_found = sum(1 for v in extr.fields.values() if v is not None)
            score = fields_found * 10 + ocr_result.confidence

            all_attempts.append({
                "angle": angle,
                "confidence": round(ocr_result.confidence, 3),
                "text_length": len(text),
                "fields_found": fields_found,
                "score": round(score, 3),
            })

            logger.info(
                "%s: conf=%.3f, text_len=%d, fields=%d, score=%.1f",
                label, ocr_result.confidence, len(text), fields_found, score,
            )

            if score > best_score:
                best_result = ocr_result
                best_angle = angle
                best_score = score
                best_extraction = extr
                best_normalized = norm

        except Exception as exc:
            logger.warning("OCR failed at %s: %s", label, exc)
            all_attempts.append({
                "angle": angle,
                "confidence": 0.0, "text_length": 0,
                "fields_found": 0, "error": str(exc),
            })

    if best_result is None or not best_result.text.strip():
        # If all attempts failed with errors, show the actual error
        errors = [a["error"] for a in all_attempts if a.get("error")]
        if errors:
            raise RuntimeError(errors[0])
        raise RuntimeError(
            "OCR returned empty text at all rotations. "
            "Image may be too blurry or not contain text."
        )

    logger.info(
        "Best: %d\u00b0 (score=%.1f, conf=%.3f)",
        best_angle, best_score, best_result.confidence,
    )

    # Log raw and normalized text for debugging
    logger.info("--- RAW TEXT ---\n%s", best_result.text)
    logger.info("--- NORMALIZED ---\n%s", best_normalized)

    elapsed_ms = int((time.monotonic() - t0) * 1000)

    return ScanResult(
        extraction=best_extraction,
        raw_text=best_result.text,
        normalized_text=best_normalized,
        ocr_confidence=round(best_result.confidence, 3),
        provider_name=best_result.provider_name,
        rotation_applied=best_angle,
        image_dimensions=(orig_w, orig_h),
        processing_time_ms=elapsed_ms,
        rotation_attempts=all_attempts,
    )
