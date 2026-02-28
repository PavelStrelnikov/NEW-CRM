"""
Text normalization for OCR output.

Cleans up raw OCR text before field extraction:
- Unicode normalization
- Replace exotic punctuation
- Remove regulatory / junk lines
- Preserve line structure and original case
"""
import re
import unicodedata

# Lines matching these patterns (fully) are considered junk and removed.
# Each pattern is checked case-insensitively against the stripped line.
_JUNK_LINE_PATTERNS: list[re.Pattern] = [
    # Regulatory marks
    re.compile(r"^[\s]*(?:CE|FCC|IC|UL|LISTED|APPROVED|RoHS|WEEE)[\s]*$", re.IGNORECASE),
    re.compile(r"^.*(?:FCC\s*ID|IC\s*:).*$", re.IGNORECASE),
    # Voltage / power lines
    re.compile(r"^.*(?:INPUT|OUTPUT).*(?:\d+\s*V|\d+\s*A|DC|AC).*$", re.IGNORECASE),
    re.compile(r"^.*\d+\s*V\s*~?\s*\d*\.?\d*\s*A.*$", re.IGNORECASE),
    # Copyright
    re.compile(r"^.*(?:\u00a9|COPYRIGHT|\(C\)).*$", re.IGNORECASE),
    # Country of origin (single line like "MADE IN CHINA")
    re.compile(r"^MADE\s+IN\s+\w+$", re.IGNORECASE),
    # Very short garbage (1-2 chars, likely OCR artifacts)
    re.compile(r"^.{0,2}$"),
]


def normalize_text(raw: str) -> str:
    """
    Normalize raw OCR text for field extraction.

    - NFKC unicode normalization
    - Replace exotic colons / dashes / equals
    - Collapse whitespace within lines
    - Remove pure-junk lines
    - Preserve line structure and original case

    Returns the cleaned text.
    """
    # Unicode normalization (NFKC: compatibility decomposition + canonical composition)
    text = unicodedata.normalize("NFKC", raw)

    # Replace exotic punctuation with ASCII equivalents
    replacements = {
        "\uff1a": ":",   # fullwidth colon
        "\u2014": "-",   # em dash
        "\u2013": "-",   # en dash
        "\u05be": "-",   # Hebrew maqaf
        "\uff1d": "=",   # fullwidth equals
        "\u2019": "'",   # right single quote
        "\u2018": "'",   # left single quote
        "\u201c": '"',   # left double quote
        "\u201d": '"',   # right double quote
    }
    for old, new in replacements.items():
        text = text.replace(old, new)

    # Split lines at label boundaries — when OCR puts multiple label:value
    # pairs on one line (common with Hebrew RTL labels + mixed LTR values).
    # Split when a non-Hebrew, non-separator char is followed by Hebrew text.
    # Excludes colon/equals so "label: HebrewValue" doesn't split.
    # e.g. "BeFiber803C סיסמת הרשת: 0050803" → two lines.
    # e.g. "(S/N( מספר סידורי" → two lines.
    text = re.sub(
        r"(?<=[^\u0590-\u05FF\s:=])\s+(?=[\u0590-\u05FF])",
        "\n", text,
    )
    # Also split before English labels that appear mid-line after a value
    text = re.sub(
        r"(?<=\S)\s{2,}(?=(?:S/N|MAC|SERIAL|SSID|PASSWORD|USER)\s*[:=])",
        "\n", text, flags=re.IGNORECASE,
    )

    # Fix reversed RTL lines: "VALUE :Hebrew label" → "Hebrew label: VALUE"
    # Gemini sometimes reads RTL labels in visual order (value first, then label).
    _RTL_REVERSED = re.compile(
        r"^([A-Za-z0-9][\w.\-]*)\s*:\s*([\u0590-\u05FF][\u0590-\u05FF\s]*)$"
    )

    # Process line by line
    cleaned_lines: list[str] = []
    for line in text.splitlines():
        # Collapse multiple spaces/tabs to single space
        line = re.sub(r"[ \t]+", " ", line).strip()

        # Skip empty or junk lines
        if not line:
            continue
        if any(pat.match(line) for pat in _JUNK_LINE_PATTERNS):
            continue

        # Fix reversed RTL: "VALUE :Hebrew label" → "Hebrew label: VALUE"
        m = _RTL_REVERSED.match(line)
        if m:
            line = f"{m.group(2).strip()}: {m.group(1).strip()}"

        cleaned_lines.append(line)

    return "\n".join(cleaned_lines)
