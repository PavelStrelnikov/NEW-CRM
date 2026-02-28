"""
SPT Web API Backend
FastAPI server that orchestrates existing SPT services
"""
import os
import sys
import tempfile
import logging
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from services.speech_to_text import SpeechToTextService
from services.translate import TranslationService
from services.normalize_ticket import TicketNormalizationService

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
env_path = Path(__file__).parent.parent.parent / '.env'
if env_path.exists():
    load_dotenv(env_path)
    logger.info(f"Loaded .env from {env_path}")
else:
    logger.warning(f".env file not found at {env_path}")

# Initialize FastAPI app
app = FastAPI(
    title="SPT Web API",
    description="Speech Processing Test - Web Interface",
    version="1.0.0"
)

# Configure CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Response model
class SpeechToTicketResponse(BaseModel):
    detected_language: str
    raw_text: str
    translated_text: Optional[str] = None
    normalized_text: str
    output_language: str


# Initialize services (lazy loading)
_speech_service: Optional[SpeechToTextService] = None
_translate_service: Optional[TranslationService] = None
_normalize_service: Optional[TicketNormalizationService] = None


def get_services():
    """Initialize services if not already initialized"""
    global _speech_service, _translate_service, _normalize_service

    if _speech_service is None:
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found in environment variables")

        model_name = os.getenv('GEMINI_MODEL', 'gemini-2.0-flash')

        # Initialize services
        _speech_service = SpeechToTextService(api_key, model_name)
        _translate_service = TranslationService(api_key, model_name)

        prompts_dir = Path(__file__).parent.parent.parent / 'prompts'
        _normalize_service = TicketNormalizationService(
            api_key,
            prompts_dir,
            model_name
        )

        logger.info("Services initialized successfully")

    return _speech_service, _translate_service, _normalize_service


# Frontend paths
FRONTEND_DIR = Path(__file__).parent.parent / "frontend"


@app.get("/")
async def serve_index():
    """Serve frontend index.html"""
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/api/health")
async def health():
    """Health check with service status"""
    try:
        get_services()
        return {
            "status": "healthy",
            "services": {
                "speech_to_text": "ready",
                "translation": "ready",
                "normalization": "ready"
            }
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "error": str(e)
            }
        )


@app.post("/api/speech-to-ticket", response_model=SpeechToTicketResponse)
async def speech_to_ticket(
    audio: UploadFile = File(...),
    output_language: str = Form(default="he"),
    force_translation: bool = Form(default=True)
):
    """
    Convert speech audio to normalized ticket text

    Args:
        audio: Audio file (wav, mp3, m4a, webm, ogg)
        output_language: Target language (ru or he)
        force_translation: Force translation to output language

    Returns:
        JSON with detected language, raw transcript, and normalized text
    """
    temp_file_path = None

    try:
        logger.info(f"Processing audio file: {audio.filename}")

        # Validate audio file
        if not audio.content_type.startswith('audio/'):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type: {audio.content_type}. Expected audio file."
            )

        # Validate output language
        if output_language not in ['ru', 'he']:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid output language: {output_language}. Must be 'ru' or 'he'."
            )

        # Initialize services
        speech_service, translate_service, normalize_service = get_services()

        # Save uploaded file to temporary location
        suffix = Path(audio.filename).suffix or '.webm'
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            content = await audio.read()
            temp_file.write(content)
            temp_file_path = temp_file.name

        logger.info(f"Saved temporary file: {temp_file_path}")

        # Step 1: Speech-to-Text
        logger.info("Step 1: Transcribing audio...")
        raw_text, detected_language = speech_service.transcribe_audio(temp_file_path)

        logger.info(
            f"Transcription complete. Language: {detected_language}, "
            f"Length: {len(raw_text)} chars"
        )

        # Step 2: Translation (if needed)
        translated_text = None
        translation_needed = force_translation and detected_language != output_language

        if translation_needed:
            logger.info(f"Step 2: Translating {detected_language} → {output_language}...")
            translated_text = translate_service.translate(
                raw_text,
                output_language,
                detected_language
            )
            text_to_normalize = translated_text
            normalize_language = output_language
            logger.info("Translation complete")
        else:
            logger.info("Step 2: Translation not needed, using original text")
            text_to_normalize = raw_text
            normalize_language = detected_language

        # Step 3: Normalization
        logger.info(f"Step 3: Normalizing text in {normalize_language}...")
        normalized_text = normalize_service.normalize_ticket(
            text_to_normalize,
            normalize_language
        )
        logger.info("Normalization complete")

        # Prepare response
        response = SpeechToTicketResponse(
            detected_language=detected_language,
            raw_text=raw_text,
            translated_text=translated_text,
            normalized_text=normalized_text,
            output_language=normalize_language
        )

        logger.info("Processing complete, returning response")
        return response

    except HTTPException:
        raise

    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        logger.exception("Error processing audio")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing audio: {str(e)}"
        )

    finally:
        # Clean up temporary file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
                logger.info(f"Cleaned up temporary file: {temp_file_path}")
            except Exception as e:
                logger.warning(f"Failed to delete temporary file: {e}")


@app.get("/api/languages")
async def get_languages():
    """Get list of supported languages"""
    return {
        "supported_languages": {
            "ru": "Russian",
            "he": "Hebrew",
            "en": "English"
        },
        "normalization_languages": {
            "ru": "Russian",
            "he": "Hebrew"
        }
    }


# Mount frontend static files (CSS, JS) — AFTER all API routes so /api/* takes priority
app.mount("/", StaticFiles(directory=str(FRONTEND_DIR)), name="frontend")


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv('SPT_WEB_PORT', 8001))

    logger.info(f"Starting SPT Web API on http://localhost:{port}")
    logger.info(f"Open http://localhost:{port} in your browser")
    logger.info("Press Ctrl+C to stop")

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info"
    )
