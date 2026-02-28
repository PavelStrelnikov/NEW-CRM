"""
OCR Label Scanner — Spike / Sandbox.

Standalone FastAPI application for testing OCR extraction from device label photos.
NOT integrated with the CRM.  No database.  No image storage.

Uses ocrlib for all OCR logic (preprocessing, OCR, normalization, extraction).

Usage:
    cd ocr-spike
    uvicorn backend.main:app --reload
    Open http://localhost:8000
"""
import logging
from pathlib import Path

from dotenv import load_dotenv

# Load .env from project root (ocr-spike/.env) before any os.environ reads
_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_ENV_PATH)

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from ocrlib import scan_label, create_provider, OCRProvider

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="OCR Label Scanner (Spike)",
    description="Sandbox tool for testing OCR extraction from device label photos.",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:*", "http://127.0.0.1:*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

# ---------------------------------------------------------------------------
# OCR provider (singleton)
# ---------------------------------------------------------------------------

_provider: OCRProvider | None = None


def _get_provider() -> OCRProvider:
    global _provider
    if _provider is None:
        _provider = create_provider()
        logger.info("OCR provider initialized: %s", _provider.name)
    return _provider


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/", include_in_schema=False)
async def serve_frontend():
    """Serve the single-page frontend."""
    index = FRONTEND_DIR / "index.html"
    if not index.exists():
        return JSONResponse({"error": "frontend/index.html not found"}, status_code=404)
    return FileResponse(index, media_type="text/html")


@app.get("/health")
async def health():
    """Health check."""
    try:
        provider = _get_provider()
        return {"status": "ok", "ocr_provider": provider.name}
    except Exception as exc:
        return JSONResponse(
            {"status": "error", "detail": str(exc)},
            status_code=503,
        )


@app.get("/config")
async def get_config():
    """Return client configuration for the frontend."""
    return {
        "default_provider": "gemini",
        "providers": [
            {"name": "gemini", "label": "Gemini Flash (Google)", "available": True},
        ],
    }


@app.post("/scan")
async def scan_label_endpoint(
    file: UploadFile = File(...),
    rotate: int = Form(0),
    crop_x: int = Form(0),
    crop_y: int = Form(0),
    crop_w: int = Form(0),
    crop_h: int = Form(0),
    pre_cropped: int = Form(0),
):
    """
    Accept a device label image, run OCR, extract fields.

    Returns JSON with extracted fields, raw OCR text, and metadata.
    Image is processed in-memory and NEVER saved to disk.
    """
    # --- Validate upload ---
    content_type = file.content_type or ""
    if content_type not in ALLOWED_MIME:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {content_type}. "
                   f"Allowed: {', '.join(sorted(ALLOWED_MIME))}",
        )

    raw_bytes = await file.read()

    if len(raw_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large ({len(raw_bytes)} bytes). "
                   f"Max: {MAX_FILE_SIZE // (1024*1024)} MB",
        )

    if len(raw_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    # --- Determine mode ---
    if pre_cropped:
        mode = "pre_cropped"
    elif rotate != 0 or (crop_w > 0 and crop_h > 0):
        mode = "manual"
    else:
        mode = "auto"

    crop = (crop_x, crop_y, crop_w, crop_h) if crop_w > 0 and crop_h > 0 else None

    # --- Run OCR pipeline ---
    try:
        result = await scan_label(
            raw_bytes,
            provider=_get_provider(),
            mode=mode,
            rotate=rotate,
            crop=crop,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # --- Serialize fields ---
    fields_json = {}
    for key, field_val in result.extraction.fields.items():
        if field_val is None:
            fields_json[key] = None
        else:
            entry = {
                "value": field_val.value,
                "raw_match": field_val.raw_match,
                "confidence": round(field_val.confidence, 2),
                "alternatives": field_val.alternatives,
            }
            if field_val.raw_value is not None:
                entry["raw_value"] = field_val.raw_value
            fields_json[key] = entry

    # --- Build response ---
    response_data = {
        "raw_text": result.raw_text,
        "normalized_text": result.normalized_text,
        "contains_credentials": result.extraction.contains_credentials,
        "ocr_provider": result.provider_name,
        "ocr_confidence": result.ocr_confidence,
        "processing_time_ms": result.processing_time_ms,
        "image_dimensions": list(result.image_dimensions),
        "rotation_applied": result.rotation_applied,
        "rotation_attempts": result.rotation_attempts,
        "warnings": result.extraction.warnings,
        "fields": fields_json,
    }

    return JSONResponse(
        content=response_data,
        headers={
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
