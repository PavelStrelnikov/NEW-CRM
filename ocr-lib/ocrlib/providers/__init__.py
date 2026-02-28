"""
OCR provider registry and factory.
"""
from ocrlib.providers.base import OCRProvider
from ocrlib.providers.gemini import GeminiProvider

__all__ = ["OCRProvider", "GeminiProvider", "create_provider"]


def create_provider(
    provider_name: str | None = None,
    *,
    api_key: str | None = None,
    model: str | None = None,
) -> OCRProvider:
    """
    Create an OCR provider by name.

    Args:
        provider_name: Provider name (default: "gemini").
        api_key: API key (passed to provider constructor).
        model: Model name override.

    Returns:
        An initialized OCRProvider instance.
    """
    name = (provider_name or "gemini").lower()

    if name == "gemini":
        return GeminiProvider(api_key=api_key, model=model)

    raise ValueError(f"Unknown OCR provider: {name!r}. Supported: gemini")
