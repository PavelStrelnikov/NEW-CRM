"""
Image preprocessing pipeline for OCR.

All operations use Pillow only (no OpenCV dependency).
Designed for device label sticker photos taken by phone cameras.
"""
import logging
from io import BytesIO

from PIL import Image, ImageFilter, ImageOps

logger = logging.getLogger(__name__)

MAX_DIMENSION = 3000   # px — larger images have diminishing OCR returns
MIN_DIMENSION = 50     # px — too small to contain useful text

# Rotations to try when auto-detecting orientation
ROTATION_ANGLES = [0, 180, 90, 270]


def load_and_validate(raw_bytes: bytes) -> tuple[Image.Image, int, int]:
    """
    Open image, validate size, apply EXIF rotation.

    Returns:
        (pil_image, original_width, original_height)
    """
    try:
        img = Image.open(BytesIO(raw_bytes))
    except Exception as exc:
        raise ValueError(f"Cannot open image: {exc}") from exc

    original_width, original_height = img.size
    logger.info(
        "Input image: %dx%d, mode=%s, format=%s",
        original_width, original_height, img.mode, img.format,
    )

    if original_width < MIN_DIMENSION or original_height < MIN_DIMENSION:
        raise ValueError(
            f"Image too small ({original_width}x{original_height}). "
            f"Minimum {MIN_DIMENSION}x{MIN_DIMENSION}px."
        )

    # EXIF auto-rotate (phone cameras embed orientation in EXIF)
    img = ImageOps.exif_transpose(img)

    # Convert to RGB (handle RGBA, palette, CMYK, etc.)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    return img, original_width, original_height


def _enhance(img: Image.Image, allow_resize: bool = True) -> bytes:
    """Apply enhancement pipeline and export as PNG bytes."""
    # Resize if too large (skip when processing pre-cropped images)
    if allow_resize:
        max_side = max(img.size)
        if max_side > MAX_DIMENSION:
            scale = MAX_DIMENSION / max_side
            new_size = (int(img.width * scale), int(img.height * scale))
            img = img.resize(new_size, Image.LANCZOS)

    # Grayscale
    img = img.convert("L")

    # Auto-contrast (normalize brightness)
    img = ImageOps.autocontrast(img, cutoff=2)

    # Sharpen (helps slightly blurry phone photos)
    img = img.filter(ImageFilter.SHARPEN)

    # Export as lossless PNG
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def preprocess_image(raw_bytes: bytes) -> tuple[bytes, int, int]:
    """
    Preprocess a raw image for OCR (single orientation, no rotation search).

    Returns:
        (processed_png_bytes, original_width, original_height)

    Raises:
        ValueError: if image is corrupt or too small.
    """
    img, original_width, original_height = load_and_validate(raw_bytes)
    processed_bytes = _enhance(img)

    logger.info("Preprocessed: %d bytes PNG", len(processed_bytes))
    return processed_bytes, original_width, original_height


def preprocess_all_rotations(raw_bytes: bytes) -> tuple[list[tuple[int, bytes]], int, int]:
    """
    Preprocess an image at multiple rotations for orientation detection.

    Device labels are often photographed upside-down or sideways.
    This produces preprocessed variants at 0, 180, 90, 270 so the
    caller can OCR each and pick the best confidence.

    Returns:
        (
            [(angle, processed_png_bytes), ...],
            original_width,
            original_height,
        )
    """
    img, original_width, original_height = load_and_validate(raw_bytes)

    variants: list[tuple[int, bytes]] = []
    for angle in ROTATION_ANGLES:
        if angle == 0:
            rotated = img.copy()
        else:
            rotated = img.rotate(angle, expand=True)
        processed = _enhance(rotated)
        variants.append((angle, processed))

    logger.info(
        "Prepared %d rotation variants (%s)",
        len(variants),
        ", ".join(f"{a}\u00b0" for a, _ in variants),
    )

    return variants, original_width, original_height


def preprocess_final(raw_bytes: bytes) -> tuple[bytes, int, int]:
    """
    Preprocess a pre-cropped/rotated image for OCR.

    The image has already been cropped and rotated by the frontend (Canvas).
    No resize — preserves original resolution pixel-perfect.

    Returns:
        (processed_png_bytes, original_width, original_height)
    """
    img, original_width, original_height = load_and_validate(raw_bytes)
    processed_bytes = _enhance(img, allow_resize=False)

    logger.info(
        "Preprocessed (no resize): %dx%d, %d bytes PNG",
        img.width, img.height, len(processed_bytes),
    )
    return processed_bytes, original_width, original_height


def preprocess_manual(
    raw_bytes: bytes,
    rotate: int = 0,
    crop: tuple[int, int, int, int] | None = None,
) -> tuple[bytes, int, int]:
    """
    Preprocess with manual rotation and/or crop.

    Args:
        raw_bytes: raw image file bytes
        rotate: rotation angle in degrees (0, 90, 180, 270)
        crop: (x, y, width, height) in original image coordinates, or None

    Returns:
        (processed_png_bytes, original_width, original_height)
    """
    img, original_width, original_height = load_and_validate(raw_bytes)

    # Crop first (before rotation, in original coords)
    if crop is not None:
        x, y, w, h = crop
        # Clamp to image bounds
        x = max(0, min(x, img.width - 1))
        y = max(0, min(y, img.height - 1))
        w = min(w, img.width - x)
        h = min(h, img.height - y)
        if w > MIN_DIMENSION and h > MIN_DIMENSION:
            img = img.crop((x, y, x + w, y + h))
            logger.info("Cropped to (%d, %d, %d, %d)", x, y, w, h)

    # Rotate
    if rotate and rotate != 0:
        img = img.rotate(rotate, expand=True)
        logger.info("Manual rotation: %d\u00b0", rotate)

    processed = _enhance(img)
    return processed, original_width, original_height
