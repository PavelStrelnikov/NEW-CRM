"""
Text-only testing script for normalization without audio files
Useful for rapid prompt iteration and testing
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from services.normalize_ticket import TicketNormalizationService
from services.translate import TranslationService


def test_normalization():
    """Test normalization with sample texts"""

    # Load environment
    load_dotenv()
    api_key = os.getenv('GEMINI_API_KEY')

    if not api_key:
        print("Error: GEMINI_API_KEY not found")
        return

    # Initialize services
    prompts_dir = Path(__file__).parent / 'prompts'
    normalizer = TicketNormalizationService(api_key, prompts_dir)
    translator = TranslationService(api_key)

    print("=" * 80)
    print("TEXT-ONLY NORMALIZATION TEST")
    print("=" * 80)
    print()

    # Sample texts
    samples = [
        {
            'text': "Так короче был на объекте у Когана вчера, там камеры глючат опять, ну то есть три штуки показывают нормально а остальные вообще черный экран, проверял кабели все вроде целые, может регик умер не знаю",
            'language': 'ru',
            'name': 'Russian technician report (cameras)'
        },
        {
            'text': "היי אני אצל משה בפיצרייה ברמת גן, הוא אמר שהאזעקה לא מפסיקה לצפצף, החיישן ליד הדלת האחורית כנראה התקלקל, בדקתי את הסוללה היא בסדר, צריך להחליף את החיישן",
            'language': 'he',
            'name': 'Hebrew technician report (alarm)'
        },
        {
            'text': "Слушай ну я тут у клиента на Дизенгоф, свитч вообще мертвый, индикаторы не горят, попробовал другой блок питания тоже самое, короче похоже железо умерло надо менять",
            'language': 'ru',
            'name': 'Russian technician report (switch)'
        }
    ]

    for i, sample in enumerate(samples, 1):
        print(f"\n{'=' * 80}")
        print(f"TEST {i}: {sample['name']}")
        print(f"{'=' * 80}")
        print()

        # Original text
        print("📝 ORIGINAL TEXT:")
        print("-" * 80)
        print(sample['text'])
        print()

        # Normalize
        print(f"🔧 NORMALIZING (language: {sample['language']})...")
        print()

        try:
            normalized = normalizer.normalize_ticket(
                sample['text'],
                sample['language']
            )

            print("✅ NORMALIZED OUTPUT:")
            print("-" * 80)
            print(normalized)
            print()

            # Optional: translate to other language
            if sample['language'] == 'ru':
                print("🌐 TRANSLATING TO HEBREW...")
                translated = translator.translate(
                    normalized,
                    target_language='he',
                    source_language='ru'
                )
                print("-" * 80)
                print(translated)
                print()

        except Exception as e:
            print(f"❌ Error: {e}")

        print()

    print("=" * 80)
    print("TESTING COMPLETE")
    print("=" * 80)


if __name__ == '__main__':
    test_normalization()
