"""
Speech Processing Test (SPT) - Main CLI Application

Pipeline: Voice → Speech-to-Text → Language Detection →
         (optional) Translation → Normalization → Ticket Text
"""
import os
import sys
import logging
from pathlib import Path
from dotenv import load_dotenv
import click

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from services.speech_to_text import SpeechToTextService
from services.translate import TranslationService
from services.normalize_ticket import TicketNormalizationService


# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SpeechProcessingPipeline:
    """Main pipeline for processing voice input into ticket text"""

    def __init__(
        self,
        api_key: str,
        output_language: str = 'he',
        force_translation: bool = True,
        model_name: str = "gemini-2.0-flash"
    ):
        """
        Initialize the pipeline

        Args:
            api_key: Gemini API key
            output_language: Desired output language ('ru' or 'he')
            force_translation: Force translation to output_language
            model_name: Gemini model to use
        """
        self.output_language = output_language
        self.force_translation = force_translation

        # Get prompts directory
        project_root = Path(__file__).parent.parent
        prompts_dir = project_root / 'prompts'

        # Initialize services
        self.speech_service = SpeechToTextService(api_key, model_name)
        self.translate_service = TranslationService(api_key, model_name)
        self.normalize_service = TicketNormalizationService(
            api_key,
            prompts_dir,
            model_name
        )

        logger.info(
            f"Pipeline initialized: "
            f"output_language={output_language}, "
            f"force_translation={force_translation}"
        )

    def process_audio(self, audio_path: str | Path) -> dict:
        """
        Process audio file through full pipeline

        Args:
            audio_path: Path to audio file

        Returns:
            Dictionary with pipeline results:
            {
                'detected_language': str,
                'raw_transcript': str,
                'translation_needed': bool,
                'translated_text': str | None,
                'normalized_text': str,
                'output_language': str
            }
        """
        results = {}

        # Step 1: Speech-to-Text
        logger.info("=" * 60)
        logger.info("STEP 1: Speech-to-Text")
        logger.info("=" * 60)

        transcript, detected_lang = self.speech_service.transcribe_audio(audio_path)

        results['detected_language'] = detected_lang
        results['raw_transcript'] = transcript

        logger.info(f"Detected language: {detected_lang}")
        logger.info(f"Transcript length: {len(transcript)} chars")

        # Step 2: Translation (if needed)
        logger.info("")
        logger.info("=" * 60)
        logger.info("STEP 2: Translation")
        logger.info("=" * 60)

        translation_needed = (
            self.force_translation and
            detected_lang != self.output_language
        )

        if translation_needed:
            logger.info(
                f"Translation needed: {detected_lang} → {self.output_language}"
            )
            translated_text = self.translate_service.translate(
                transcript,
                self.output_language,
                detected_lang
            )
            results['translation_needed'] = True
            results['translated_text'] = translated_text
            text_to_normalize = translated_text
            normalize_language = self.output_language
        else:
            logger.info("Translation not needed")
            results['translation_needed'] = False
            results['translated_text'] = None
            text_to_normalize = transcript
            normalize_language = detected_lang

        # Step 3: Normalization
        logger.info("")
        logger.info("=" * 60)
        logger.info("STEP 3: Normalization")
        logger.info("=" * 60)

        logger.info(f"Normalizing in {normalize_language}")
        normalized_text = self.normalize_service.normalize_ticket(
            text_to_normalize,
            normalize_language
        )

        results['normalized_text'] = normalized_text
        results['output_language'] = normalize_language

        logger.info(f"Normalization complete")

        return results

    def print_results(self, results: dict):
        """Print pipeline results in readable format"""
        print("\n")
        print("╔" + "═" * 78 + "╗")
        print("║" + " " * 25 + "PROCESSING RESULTS" + " " * 35 + "║")
        print("╚" + "═" * 78 + "╝")
        print()

        # Detected Language
        print(f"📍 Detected Language: {results['detected_language'].upper()}")
        print()

        # Raw Transcript
        print("─" * 80)
        print("🎤 RAW TRANSCRIPT")
        print("─" * 80)
        print(results['raw_transcript'])
        print()

        # Translation (if applicable)
        if results['translation_needed']:
            print("─" * 80)
            print(f"🌐 TRANSLATED TEXT ({results['output_language'].upper()})")
            print("─" * 80)
            print(results['translated_text'])
            print()

        # Normalized Ticket Text
        print("─" * 80)
        print(f"✅ NORMALIZED TICKET TEXT ({results['output_language'].upper()})")
        print("─" * 80)
        print(results['normalized_text'])
        print()
        print("=" * 80)


@click.command()
@click.argument('audio_file', type=click.Path(exists=True))
@click.option(
    '--output-lang',
    '-o',
    type=click.Choice(['ru', 'he'], case_sensitive=False),
    default='he',
    help='Output language for the ticket (default: he)'
)
@click.option(
    '--force-translate/--no-force-translate',
    '-t/-T',
    default=True,
    help='Force translation to output language (default: true)'
)
@click.option(
    '--model',
    '-m',
    default='gemini-2.0-flash',
    help='Gemini model to use (default: gemini-2.0-flash)'
)
@click.option(
    '--verbose',
    '-v',
    is_flag=True,
    help='Enable verbose logging'
)
def main(audio_file, output_lang, force_translate, model, verbose):
    """
    Speech Processing Test - Convert voice to structured ticket text

    Process an audio file through the full pipeline:
    1. Speech-to-Text with language detection
    2. Translation (if needed)
    3. Normalization into structured ticket text

    Example:
        python app/main.py audio_samples/sample.mp3

        python app/main.py audio_samples/sample.mp3 -o ru --no-force-translate
    """
    # Set logging level
    if verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Load environment variables
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
        logger.info(f"Loaded .env from {env_path}")
    else:
        logger.warning(f".env file not found at {env_path}")

    # Get API key
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        click.echo(
            "❌ Error: GEMINI_API_KEY not found in environment variables",
            err=True
        )
        click.echo("Please create a .env file based on .env.example", err=True)
        sys.exit(1)

    # Override config with CLI options
    output_language = output_lang.lower()

    click.echo(f"\n🚀 Starting Speech Processing Pipeline")
    click.echo(f"   Audio file: {audio_file}")
    click.echo(f"   Output language: {output_language.upper()}")
    click.echo(f"   Force translation: {force_translate}")
    click.echo(f"   Model: {model}")
    click.echo()

    try:
        # Initialize pipeline
        pipeline = SpeechProcessingPipeline(
            api_key=api_key,
            output_language=output_language,
            force_translation=force_translate,
            model_name=model
        )

        # Process audio
        results = pipeline.process_audio(audio_file)

        # Print results
        pipeline.print_results(results)

        click.echo("\n✅ Processing complete!")

    except FileNotFoundError as e:
        click.echo(f"❌ Error: {e}", err=True)
        sys.exit(1)

    except ValueError as e:
        click.echo(f"❌ Error: {e}", err=True)
        sys.exit(1)

    except Exception as e:
        logger.exception("Unexpected error during processing")
        click.echo(f"❌ Unexpected error: {e}", err=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
