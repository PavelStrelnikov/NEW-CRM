"""
Abstract base class for OCR providers.
"""
from abc import ABC, abstractmethod

from ocrlib.models import OCRResult


class OCRProvider(ABC):
    """Abstract base for OCR backends."""

    @abstractmethod
    async def extract_text(self, image_bytes: bytes, **kwargs) -> OCRResult:
        """Run OCR on preprocessed image bytes (PNG). Returns OCRResult."""
        ...

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable provider name for logging / JSON responses."""
        ...
