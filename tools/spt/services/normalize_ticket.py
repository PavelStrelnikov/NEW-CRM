"""
Ticket normalization service using Gemini API
Converts unstructured technician speech into structured ticket text
"""
import logging
from pathlib import Path
import google.generativeai as genai

logger = logging.getLogger(__name__)


class TicketNormalizationService:
    """Service for normalizing unstructured speech into ticket text"""

    SUPPORTED_LANGUAGES = {
        'ru': 'Russian',
        'he': 'Hebrew'
    }

    def __init__(
        self,
        api_key: str,
        prompts_dir: str | Path,
        model_name: str = "gemini-2.0-flash"
    ):
        """
        Initialize Ticket Normalization service

        Args:
            api_key: Gemini API key
            prompts_dir: Directory containing normalization prompts
            model_name: Gemini model to use
        """
        self.api_key = api_key
        self.model_name = model_name
        self.prompts_dir = Path(prompts_dir)

        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(model_name)

        # Load prompts
        self.prompts = self._load_prompts()

        logger.info(
            f"Initialized TicketNormalizationService with model: {model_name}"
        )

    def _load_prompts(self) -> dict:
        """Load normalization prompts for each language"""
        prompts = {}

        for lang_code in self.SUPPORTED_LANGUAGES:
            prompt_file = self.prompts_dir / f"normalize_{lang_code}.txt"

            if not prompt_file.exists():
                logger.warning(f"Prompt file not found: {prompt_file}")
                continue

            with open(prompt_file, 'r', encoding='utf-8') as f:
                prompts[lang_code] = f.read()

            logger.debug(f"Loaded prompt for {lang_code}: {len(prompts[lang_code])} chars")

        return prompts

    def normalize_ticket(
        self,
        text: str,
        language: str
    ) -> str:
        """
        Normalize unstructured text into structured ticket description

        Args:
            text: Unstructured text (transcription or translated text)
            language: Language code ('ru' or 'he')

        Returns:
            Normalized ticket text

        Raises:
            ValueError: If language is not supported or prompt not found
        """
        if language not in self.SUPPORTED_LANGUAGES:
            raise ValueError(
                f"Unsupported language: {language}. "
                f"Supported: {list(self.SUPPORTED_LANGUAGES.keys())}"
            )

        if language not in self.prompts:
            raise ValueError(
                f"Normalization prompt not found for language: {language}"
            )

        if not text or not text.strip():
            logger.warning("Empty text passed to normalize_ticket, returning empty string")
            return ""

        logger.info(f"Normalizing text in {language}, length: {len(text)} chars")

        # Build full prompt
        prompt = self.prompts[language] + "\n" + text

        try:
            response = self.model.generate_content(prompt)

            if not response.text:
                raise ValueError("Empty response from Gemini API")

            normalized_text = response.text.strip()

            logger.info(
                f"Normalization complete. "
                f"Original: {len(text)} chars, "
                f"Normalized: {len(normalized_text)} chars"
            )

            return normalized_text

        except Exception as e:
            logger.error(f"Error normalizing text: {e}")
            raise

    def get_supported_languages(self) -> dict:
        """Get dictionary of supported language codes and names"""
        return self.SUPPORTED_LANGUAGES.copy()
