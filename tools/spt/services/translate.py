"""
Translation service using Gemini API
Supports translation between Russian, Hebrew, and English
"""
import logging
import google.generativeai as genai

logger = logging.getLogger(__name__)


class TranslationService:
    """Service for translating text using Gemini API"""

    LANGUAGE_NAMES = {
        'ru': 'Russian',
        'he': 'Hebrew',
        'en': 'English'
    }

    def __init__(self, api_key: str, model_name: str = "gemini-2.0-flash"):
        """
        Initialize Translation service

        Args:
            api_key: Gemini API key
            model_name: Gemini model to use
        """
        self.api_key = api_key
        self.model_name = model_name
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(model_name)
        logger.info(f"Initialized TranslationService with model: {model_name}")

    def translate(
        self,
        text: str,
        target_language: str,
        source_language: str | None = None
    ) -> str:
        """
        Translate text to target language

        Args:
            text: Text to translate
            target_language: Target language code ('ru', 'he', 'en')
            source_language: Source language code (optional, will auto-detect)

        Returns:
            Translated text

        Raises:
            ValueError: If language codes are invalid
        """
        if target_language not in self.LANGUAGE_NAMES:
            raise ValueError(
                f"Unsupported target language: {target_language}. "
                f"Supported: {list(self.LANGUAGE_NAMES.keys())}"
            )

        if source_language and source_language not in self.LANGUAGE_NAMES:
            raise ValueError(
                f"Unsupported source language: {source_language}. "
                f"Supported: {list(self.LANGUAGE_NAMES.keys())}"
            )

        # Skip translation if source and target are the same
        if source_language and source_language == target_language:
            logger.info(
                f"Source and target languages are the same ({source_language}), "
                "skipping translation"
            )
            return text

        logger.info(
            f"Translating text "
            f"from {source_language or 'auto-detect'} "
            f"to {target_language}"
        )

        # Build prompt
        target_lang_name = self.LANGUAGE_NAMES[target_language]

        if source_language:
            source_lang_name = self.LANGUAGE_NAMES[source_language]
            prompt = f"""
Translate the following text from {source_lang_name} to {target_lang_name}.
Preserve the meaning, technical terminology, and tone.
Do not add any explanations or comments.
Provide only the translated text.

Text to translate:
{text}
"""
        else:
            prompt = f"""
Translate the following text to {target_lang_name}.
Preserve the meaning, technical terminology, and tone.
Do not add any explanations or comments.
Provide only the translated text.

Text to translate:
{text}
"""

        try:
            response = self.model.generate_content(prompt)

            if not response.text:
                raise ValueError("Empty response from Gemini API")

            translated_text = response.text.strip()

            logger.info(
                f"Translation complete. "
                f"Original length: {len(text)}, "
                f"Translated length: {len(translated_text)}"
            )

            return translated_text

        except Exception as e:
            logger.error(f"Error translating text: {e}")
            raise

    def get_supported_languages(self) -> dict:
        """Get dictionary of supported language codes and names"""
        return self.LANGUAGE_NAMES.copy()
