"""
Speech-to-Text service using Gemini API
Supports Russian and Hebrew language detection
"""
import os
import logging
from pathlib import Path
from typing import Tuple, Optional
import google.generativeai as genai

logger = logging.getLogger(__name__)


class SpeechToTextService:
    """Service for converting audio to text using Gemini API"""

    SUPPORTED_LANGUAGES = {
        'ru': 'Russian',
        'he': 'Hebrew',
        'en': 'English'
    }

    def __init__(self, api_key: str, model_name: str = "gemini-2.0-flash"):
        """
        Initialize Speech-to-Text service

        Args:
            api_key: Gemini API key
            model_name: Gemini model to use
        """
        self.api_key = api_key
        self.model_name = model_name
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(model_name)
        logger.info(f"Initialized SpeechToTextService with model: {model_name}")

    def transcribe_audio(
        self,
        audio_path: str | Path,
        detect_language: bool = True
    ) -> Tuple[str, Optional[str]]:
        """
        Transcribe audio file to text and detect language

        Args:
            audio_path: Path to audio file
            detect_language: Whether to detect the language

        Returns:
            Tuple of (transcribed_text, detected_language_code)
            Language code is one of: 'ru', 'he', 'en', or None if detection disabled

        Raises:
            FileNotFoundError: If audio file doesn't exist
            ValueError: If audio format is not supported
        """
        audio_path = Path(audio_path)

        if not audio_path.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        logger.info(f"Transcribing audio file: {audio_path.name}")

        try:
            # Read audio bytes and determine MIME type
            audio_bytes = audio_path.read_bytes()
            suffix = audio_path.suffix.lower()
            mime_map = {
                '.webm': 'audio/webm',
                '.ogg': 'audio/ogg',
                '.mp3': 'audio/mpeg',
                '.mp4': 'audio/mp4',
                '.m4a': 'audio/mp4',
                '.wav': 'audio/wav',
            }
            mime_type = mime_map.get(suffix, 'audio/webm')
            logger.debug(f"Audio: {len(audio_bytes)} bytes, mime={mime_type}")

            # Send audio inline (avoids File API upload issues with short recordings)
            audio_part = genai.protos.Part(
                inline_data=genai.protos.Blob(mime_type=mime_type, data=audio_bytes)
            )

            # Create prompt for transcription with language detection
            if detect_language:
                prompt = """
Transcribe the following audio file accurately.
After transcription, identify the language of the speech.

Respond in the following format:
LANGUAGE: [language_code]
TRANSCRIPT: [full transcription]

Where language_code should be one of:
- ru (for Russian)
- he (for Hebrew)
- en (for English)

Provide the full, accurate transcription of everything said in the audio.
"""
            else:
                prompt = "Transcribe the following audio file accurately. Provide the full transcription of everything said."

            # Generate transcription
            response = self.model.generate_content([prompt, audio_part])

            if not response.text:
                raise ValueError("Empty response from Gemini API")

            result_text = response.text.strip()
            logger.debug(f"Raw response: {result_text[:200]}...")

            # Parse response
            if detect_language:
                language_code, transcript = self._parse_response(result_text)
            else:
                language_code = None
                transcript = result_text

            logger.info(
                f"Transcription complete. "
                f"Language: {language_code or 'not detected'}, "
                f"Length: {len(transcript)} chars"
            )

            return transcript, language_code

        except Exception as e:
            logger.error(f"Error transcribing audio: {e}")
            raise

    def _parse_response(self, response_text: str) -> Tuple[str, str]:
        """
        Parse Gemini response to extract language and transcript

        Args:
            response_text: Raw response from Gemini

        Returns:
            Tuple of (language_code, transcript)
        """
        lines = response_text.split('\n')
        language_code = None
        transcript_lines = []

        in_transcript = False

        for line in lines:
            line = line.strip()

            if line.startswith('LANGUAGE:'):
                lang = line.replace('LANGUAGE:', '').strip().lower()
                # Extract language code (handle cases like "ru (Russian)")
                language_code = lang.split()[0] if lang else None

            elif line.startswith('TRANSCRIPT:'):
                transcript_start = line.replace('TRANSCRIPT:', '').strip()
                if transcript_start:
                    transcript_lines.append(transcript_start)
                in_transcript = True

            elif in_transcript and line:
                transcript_lines.append(line)

        transcript = '\n'.join(transcript_lines).strip()

        # Fallback: if parsing failed, use entire response as transcript
        if not transcript:
            transcript = response_text

        # Validate language code
        if language_code and language_code not in self.SUPPORTED_LANGUAGES:
            logger.warning(
                f"Unknown language code '{language_code}', "
                f"expected one of {list(self.SUPPORTED_LANGUAGES.keys())}"
            )
            language_code = 'en'  # Default fallback

        return language_code or 'en', transcript

    def get_supported_languages(self) -> dict:
        """Get dictionary of supported language codes and names"""
        return self.SUPPORTED_LANGUAGES.copy()
