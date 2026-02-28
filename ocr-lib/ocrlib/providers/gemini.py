"""
Google Gemini Vision OCR provider.

Sends device label images to Google's Gemini API for text extraction.
Requires a GEMINI_API_KEY (passed explicitly or via environment variable).
"""
import asyncio
import os
import logging

from ocrlib.models import OCRResult
from ocrlib.providers.base import OCRProvider

logger = logging.getLogger(__name__)


class GeminiProvider(OCRProvider):
    """
    Google Gemini Vision OCR provider.

    Args:
        api_key: Gemini API key. If None, reads from GEMINI_API_KEY env var.
        model: Gemini model name. If None, reads from GEMINI_MODEL env var
               (default: gemini-2.0-flash).
    """

    PROMPT = (
        "You are an OCR engine. Extract ALL text visible in this image exactly as written.\n"
        "\n"
        "Rules:\n"
        "- Return ONLY the text found in the image, nothing else\n"
        "- Preserve the original line structure (one line of text = one line in output)\n"
        "- Include ALL text: labels, values, serial numbers, MAC addresses, passwords, IP addresses\n"
        "- Do NOT interpret, summarize, translate, or reformat the text\n"
        "- Do NOT add explanations, headers, or markdown formatting\n"
        "- Do NOT censor or redact any text including passwords and credentials\n"
        "- If text is in Hebrew, preserve the Hebrew characters exactly\n"
        "- If text is partially illegible, make your best attempt and include it\n"
        "- Preserve exact spacing between label and value (e.g., \"S/N: ABC123\")\n"
    )

    DEFAULT_CONFIDENCE = 0.90

    def __init__(self, api_key: str | None = None, model: str | None = None):
        import google.genai as genai  # fail fast if not installed

        resolved_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not resolved_key:
            raise ValueError(
                "Gemini API key is required. Pass api_key parameter or set GEMINI_API_KEY env var. "
                "Get a key at https://aistudio.google.com/apikey"
            )

        self._client = genai.Client(api_key=resolved_key)
        self._model = model or os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
        self._genai = genai
        logger.info("GeminiProvider initialized (model=%s)", self._model)

    @property
    def name(self) -> str:
        return "gemini"

    async def extract_text(self, image_bytes: bytes, **kwargs) -> OCRResult:
        """Call Gemini Vision API."""
        return await asyncio.to_thread(self._run_sync, image_bytes)

    # -- private -----------------------------------------------------------

    def _run_sync(self, image_bytes: bytes) -> OCRResult:
        image_part = self._genai.types.Part.from_bytes(
            data=image_bytes,
            mime_type="image/png",
        )

        try:
            response = self._client.models.generate_content(
                model=self._model,
                contents=[image_part, self.PROMPT],
                config=self._genai.types.GenerateContentConfig(
                    temperature=0,
                    max_output_tokens=4096,
                ),
            )
        except Exception as exc:
            error_msg = str(exc).lower()
            if "429" in error_msg or "rate" in error_msg:
                raise RuntimeError(
                    "Gemini API rate limit exceeded. Wait 60s or try again later."
                ) from exc
            if "401" in error_msg or "403" in error_msg or "api key" in error_msg:
                raise RuntimeError(
                    "Gemini API authentication failed. Check GEMINI_API_KEY."
                ) from exc
            raise RuntimeError(f"Gemini API error: {exc}") from exc

        text = (response.text or "").strip()

        # Strip markdown code fences if Gemini wraps the output
        if text.startswith("```") and text.endswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1]).strip()

        logger.debug("Gemini: %d chars extracted", len(text))

        return OCRResult(
            text=text,
            confidence=self.DEFAULT_CONFIDENCE,
            word_confidences=[],
            provider_name=self.name,
        )
