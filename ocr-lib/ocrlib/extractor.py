"""
Regex-based field extraction from normalized OCR text.

Extracts:
  - mac_address
  - serial_number
  - device_username
  - device_password
  - wifi_ssid
  - wifi_password
  - default_ip
  - gateway

All rules are label-based: look for a known label, then capture the value
after a separator (:, =, space).  No ML.
"""
from __future__ import annotations

import logging
import re
from typing import Optional

from ocrlib.models import ExtractedField, ExtractionResult, CREDENTIAL_FIELDS, MASK

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# MAC address
# ---------------------------------------------------------------------------

# Matches common MAC formats:
#   AA:BB:CC:DD:EE:FF | AA-BB-CC-DD-EE-FF | AABB.CCDD.EEFF | AABBCCDDEEFF
_MAC_PATTERN = re.compile(
    r"(?i)"
    r"(?:[0-9A-F]{2}[:\-]){5}[0-9A-F]{2}"       # colon/dash separated
    r"|(?:[0-9A-F]{4}\.){2}[0-9A-F]{4}"           # dot separated (Cisco)
    r"|(?<![0-9A-Fa-f])[0-9A-F]{12}(?![0-9A-Fa-f])"  # no separator, 12 hex
)

# Labeled MAC: "MAC" or "MAC ADDR" followed by separator and value
# More permissive — allows OCR-garbled separators and spaces within the MAC
_MAC_LABEL_RE = re.compile(
    r"(?i)(?:MAC(?:\s*ADDR(?:ESS)?)?|ETHERNET|ETH)\s*[=:\s]\s*"
    r"([0-9A-Fa-f]{2}[\s:\-.]?[0-9A-Fa-f]{2}[\s:\-.]?[0-9A-Fa-f]{2}[\s:\-.]?"
    r"[0-9A-Fa-f]{2}[\s:\-.]?[0-9A-Fa-f]{2}[\s:\-.]?[0-9A-Fa-f]{2})"
)

_INVALID_MACS = {"FF:FF:FF:FF:FF:FF", "00:00:00:00:00:00"}

# OCR commonly misreads: O→0, I→1, l→1, B→8, G→6, S→5
_OCR_HEX_FIX = str.maketrans("OoIlGgSs", "00111655")


def _normalize_mac(raw: str) -> str:
    """Normalize any MAC format to AA:BB:CC:DD:EE:FF."""
    # First fix common OCR misreads in hex context
    fixed = raw.translate(_OCR_HEX_FIX)
    hex_only = re.sub(r"[^0-9A-Fa-f]", "", fixed).upper()
    if len(hex_only) != 12:
        # Try original without OCR fix
        hex_only = re.sub(r"[^0-9A-Fa-f]", "", raw).upper()
    if len(hex_only) != 12:
        return raw.upper()
    return ":".join(hex_only[i:i+2] for i in range(0, 12, 2))


def _is_valid_mac(mac: str) -> bool:
    normalized = _normalize_mac(mac)
    if normalized in _INVALID_MACS:
        return False
    # Check it's actually a valid hex MAC
    hex_only = re.sub(r"[^0-9A-F]", "", normalized)
    if len(hex_only) != 12:
        return False
    # Reject multicast (first octet LSB = 1)
    first_octet = int(normalized[:2], 16)
    if first_octet & 1:
        return False
    return True


def _extract_mac(text: str) -> list[str]:
    """Find all valid MAC addresses in text, return normalized."""
    result: list[str] = []

    # 1. Try label-based extraction first (most reliable)
    for m in _MAC_LABEL_RE.findall(text):
        normalized = _normalize_mac(m)
        if _is_valid_mac(normalized) and normalized not in result:
            result.append(normalized)

    # 2. Fallback: find standalone MAC patterns
    for m in _MAC_PATTERN.findall(text):
        normalized = _normalize_mac(m)
        if _is_valid_mac(normalized) and normalized not in result:
            result.append(normalized)

    return result


# ---------------------------------------------------------------------------
# Label-based extractors
# ---------------------------------------------------------------------------

_SEP = r"\s*[=:\s]\s*"   # separator between label and value


def _label_regex(labels: list[str], value_pattern: str) -> re.Pattern:
    """Build a regex: (LABEL)(separator)(VALUE), case-insensitive."""
    label_alt = "|".join(re.escape(lb) for lb in labels)
    return re.compile(
        rf"(?i)(?:{label_alt}){_SEP}({value_pattern})"
    )


# --- Serial Number --------------------------------------------------------

_SERIAL_RE = _label_regex(
    [
        "HW S/N", "HW SN", "H/W S/N",
        "SERIAL NUMBER (S/N)",                                   # B-Fiber format
        "S/N", "SN", "SERIAL NUMBER", "SERIAL NO", "SERIAL NO.",
        "SERIAL", "SER. NO", "SER.NO", "SER NO",
        # Hebrew
        "\u05DE\u05E1\u05E4\u05E8 \u05E1\u05D9\u05D3\u05D5\u05E8\u05D9",  # מספר סידורי
        "\u05E1\u05E8\u05D9\u05D0\u05DC\u05D9",                # סריאלי
        "\u05DE\u05E1' \u05E1\u05E8\u05D9\u05D0\u05DC\u05D9",  # מס' סריאלי
    ],
    # Require at least one digit to avoid "NUMBER" false positive from "SERIAL NUMBER"
    r"(?=[A-Za-z0-9\-]*\d)[A-Za-z0-9\-]{4,30}",
)


_SERIAL_CONTEXT_RE = re.compile(
    r"(?i)(?:SERIAL|S/N|SN|\u05DE\u05E1\u05E4\u05E8 \u05E1\u05D9\u05D3\u05D5\u05E8\u05D9)"
)
# Standalone serial-like value: alphanumeric, 8-30 chars, starts with letter
_SERIAL_STANDALONE_RE = re.compile(r"\b([A-Z][A-Z0-9\-]{7,29})\b")


def _extract_serial(text: str) -> list[str]:
    # 1. Try label-based extraction first
    results = list(dict.fromkeys(m.strip() for m in _SERIAL_RE.findall(text)))
    if results:
        return results

    # 2. Fallback: scan lines NEAR a serial-label context (within 3 lines)
    #    for standalone serial-like values.
    lines = text.split("\n")
    context_lines: set[int] = set()
    for i, line in enumerate(lines):
        if _SERIAL_CONTEXT_RE.search(line):
            for j in range(max(0, i - 1), min(len(lines), i + 4)):
                context_lines.add(j)

    if not context_lines:
        return []

    for i in context_lines:
        for m in _SERIAL_STANDALONE_RE.findall(lines[i]):
            val = m.strip()
            if not any(c.isdigit() for c in val):
                continue
            if val not in results:
                results.append(val)
    return results


# --- Username -------------------------------------------------------------

# Specific labels (preferred) — won't match section headers like "WIRELESS USER CODES:"
_USERNAME_SPECIFIC_RE = _label_regex(
    [
        "ACCESS USERNAME", "DEFAULT USER", "USER NAME", "USERNAME",
        "LOGIN", "ADMIN USER",
        # Hebrew
        "\u05E9\u05DD \u05DE\u05E9\u05EA\u05DE\u05E9",  # שם משתמש
    ],
    r"[A-Za-z0-9@._\-]{2,30}",
)
# Bare "USER" — fallback only (too generic, matches "USER CODES" etc.)
_USERNAME_FALLBACK_RE = _label_regex(
    ["USER"],
    r"[A-Za-z0-9@._\-]{2,30}",
)


def _extract_username(text: str) -> list[str]:
    results = list(dict.fromkeys(m.strip() for m in _USERNAME_SPECIFIC_RE.findall(text)))
    if results:
        return results
    return list(dict.fromkeys(m.strip() for m in _USERNAME_FALLBACK_RE.findall(text)))


# --- Password (device) ----------------------------------------------------

_PASSWORD_RE = _label_regex(
    [
        "DEFAULT PASSWORD", "DEVICE PASSWORD", "ACCESS PASSWORD",
        "ACCESS KEY", "PASSWORD", "PASS",
        "P/W", "PWD",
        # Hebrew
        "\u05E1\u05D9\u05E1\u05DE\u05D4",  # סיסמה (with heh)
        "\u05E1\u05D9\u05E1\u05DE\u05D0",  # סיסמא (with alef)
    ],
    r".{3,40}",
)


def _extract_password(text: str) -> list[str]:
    results: list[str] = []
    for m in _PASSWORD_RE.findall(text):
        val = m.strip()
        # Stop at end of line
        val = val.split("\n")[0].strip()
        if val and val not in results:
            results.append(val)
    return results


# --- WiFi SSID -------------------------------------------------------------

_SSID_RE = _label_regex(
    [
        "SSID", "WIFI NAME", "WI-FI NAME", "NETWORK NAME",
        "WIRELESS NAME", "WIFI SSID",
        # Hebrew
        "\u05E9\u05DD \u05D4\u05E8\u05E9\u05EA",   # שם הרשת
        "\u05E9\u05DD \u05E8\u05E9\u05EA",           # שם רשת
    ],
    r".{1,32}",
)


def _extract_wifi_ssid(text: str) -> list[str]:
    results: list[str] = []
    for m in _SSID_RE.findall(text):
        val = m.strip().split("\n")[0].strip()
        if val and val not in results:
            results.append(val)
    return results


# --- WiFi Password ---------------------------------------------------------

_WIFI_PASS_RE = _label_regex(
    [
        "WIFI PASSWORD", "WI-FI PASSWORD", "WIFI PASS", "WIFI KEY",
        "WPA KEY", "WPA2 KEY", "WPA PSK", "WPA2 PSK",
        "WIRELESS KEY", "WIRELESS PASSWORD",
        "NETWORK KEY", "SECURITY KEY",
        # Hebrew
        "\u05E1\u05D9\u05E1\u05DE\u05EA \u05D4\u05E8\u05E9\u05EA",  # סיסמת הרשת
        "\u05E1\u05D9\u05E1\u05DE\u05EA \u05E8\u05E9\u05EA",          # סיסמת רשת
        "\u05E1\u05D9\u05E1\u05DE\u05D4",                              # סיסמה (with heh)
        "\u05E1\u05D9\u05E1\u05DE\u05D0",                              # סיסמא (with alef)
    ],
    r".{4,63}",  # lowered from 8 to 4 — ISP labels can have short keys
)

# Standalone KEY/PIN — only if near WPA/WIFI/WIRELESS context
_KEY_STANDALONE_RE = _label_regex(["KEY", "PIN"], r".{4,63}")
_WIFI_CONTEXT_RE = re.compile(r"(?i)\b(?:WPA|WIFI|WI-FI|WIRELESS)\b")


def _extract_wifi_password(text: str) -> list[str]:
    results: list[str] = []

    for m in _WIFI_PASS_RE.findall(text):
        val = m.strip().split("\n")[0].strip()
        if val and val not in results:
            results.append(val)

    # Standalone KEY/PIN — only if WiFi context nearby (within 3 lines)
    if not results:
        lines = text.splitlines()
        for i, line in enumerate(lines):
            match = _KEY_STANDALONE_RE.search(line)
            if match:
                # Check context: 3 lines before/after
                context_window = "\n".join(lines[max(0, i-3):i+4])
                if _WIFI_CONTEXT_RE.search(context_window):
                    val = match.group(1).strip().split("\n")[0].strip()
                    if val and val not in results:
                        results.append(val)

    return results


# --- IP address ------------------------------------------------------------

_IPV4_RE = re.compile(r"\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b")

_IP_LABEL_RE = _label_regex(
    [
        "DEFAULT IP", "MANAGEMENT IP", "IP ADDRESS", "IP ADDR", "IP",
        # Hebrew
        "\u05DB\u05EA\u05D5\u05D1\u05EA \u05DE\u05DE\u05E9\u05E7 \u05D4\u05E0\u05EA\u05D1",  # כתובת ממשק הנתב
        "\u05DB\u05EA\u05D5\u05D1\u05EA \u05DE\u05DE\u05E9\u05E7",  # כתובת ממשק
        "\u05DB\u05EA\u05D5\u05D1\u05EA IP",                         # כתובת IP
    ],
    r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}",
)

_GATEWAY_RE = _label_regex(
    ["DEFAULT GATEWAY", "GATEWAY", "GW"],
    r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}",
)


def _is_valid_ip(ip: str) -> bool:
    parts = ip.split(".")
    if len(parts) != 4:
        return False
    for p in parts:
        try:
            n = int(p)
        except ValueError:
            return False
        if n < 0 or n > 255:
            return False
    if ip in ("0.0.0.0", "255.255.255.255"):
        return False
    return True


def _is_private_ip(ip: str) -> bool:
    parts = [int(p) for p in ip.split(".")]
    # 192.168.x.x, 10.x.x.x, 172.16-31.x.x
    if parts[0] == 192 and parts[1] == 168:
        return True
    if parts[0] == 10:
        return True
    if parts[0] == 172 and 16 <= parts[1] <= 31:
        return True
    return False


def _extract_default_ip(text: str) -> list[str]:
    """Extract default IP. Prefer label-based, fallback to any private IP."""
    # Try label-based first
    labeled = [m.strip() for m in _IP_LABEL_RE.findall(text)]
    labeled = [ip for ip in labeled if _is_valid_ip(ip)]
    if labeled:
        return list(dict.fromkeys(labeled))

    # Fallback: find all valid private IPs
    all_ips = _IPV4_RE.findall(text)
    valid = [ip for ip in all_ips if _is_valid_ip(ip) and _is_private_ip(ip)]
    return list(dict.fromkeys(valid))


def _extract_gateway(text: str) -> list[str]:
    """Extract gateway — only if explicit label found."""
    matches = [m.strip() for m in _GATEWAY_RE.findall(text)]
    return list(dict.fromkeys(ip for ip in matches if _is_valid_ip(ip)))


# ---------------------------------------------------------------------------
# Confidence scoring
# ---------------------------------------------------------------------------

def _calc_confidence(matches: list, ocr_confidence: float) -> float:
    if len(matches) == 0:
        return 0.0
    if len(matches) == 1 and ocr_confidence > 0.8:
        return 0.95
    if len(matches) == 1 and ocr_confidence > 0.5:
        return 0.8
    if len(matches) > 1:
        return 0.5   # ambiguous — multiple candidates
    # len == 1, low OCR confidence
    return 0.3


# ---------------------------------------------------------------------------
# Main extraction entry point
# ---------------------------------------------------------------------------

def extract_fields(normalized_text: str, ocr_confidence: float) -> ExtractionResult:
    """
    Extract all supported fields from normalized OCR text.

    Args:
        normalized_text: cleaned text from normalizer
        ocr_confidence: overall OCR confidence (0.0-1.0)

    Returns:
        ExtractionResult with fields dict and warnings.
    """
    warnings: list[str] = []
    fields: dict[str, Optional[ExtractedField]] = {}

    # --- MAC ---
    macs = _extract_mac(normalized_text)
    if macs:
        conf = _calc_confidence(macs, ocr_confidence)
        fields["mac_address"] = ExtractedField(
            value=macs[0],
            raw_match=macs[0],
            confidence=conf,
            alternatives=macs[1:],
        )
        if len(macs) > 1:
            warnings.append(f"Multiple MAC addresses found: {macs}. Verify correct value.")
    else:
        fields["mac_address"] = None

    # --- Serial ---
    serials = _extract_serial(normalized_text)
    if serials:
        conf = _calc_confidence(serials, ocr_confidence)
        fields["serial_number"] = ExtractedField(
            value=serials[0],
            raw_match=serials[0],
            confidence=conf,
            alternatives=serials[1:],
        )
        if len(serials) > 1:
            warnings.append(f"Multiple serial numbers found: {serials}. Verify correct value.")
    else:
        fields["serial_number"] = None

    # --- Username ---
    usernames = _extract_username(normalized_text)
    if usernames:
        conf = _calc_confidence(usernames, ocr_confidence)
        fields["device_username"] = ExtractedField(
            value=usernames[0],
            raw_match=usernames[0],
            confidence=conf,
            alternatives=usernames[1:],
        )
    else:
        fields["device_username"] = None

    # --- Password (device) ---
    passwords = _extract_password(normalized_text)
    if passwords:
        conf = _calc_confidence(passwords, ocr_confidence)
        fields["device_password"] = ExtractedField(
            value=MASK,
            raw_match=passwords[0],
            confidence=conf,
            alternatives=passwords[1:],
            raw_value=passwords[0],
        )
    else:
        fields["device_password"] = None

    # --- WiFi SSID ---
    ssids = _extract_wifi_ssid(normalized_text)
    if ssids:
        conf = _calc_confidence(ssids, ocr_confidence)
        fields["wifi_ssid"] = ExtractedField(
            value=ssids[0],
            raw_match=ssids[0],
            confidence=conf,
            alternatives=ssids[1:],
        )
    else:
        fields["wifi_ssid"] = None

    # --- WiFi Password ---
    wifi_passes = _extract_wifi_password(normalized_text)
    if wifi_passes:
        conf = _calc_confidence(wifi_passes, ocr_confidence)
        fields["wifi_password"] = ExtractedField(
            value=MASK,
            raw_match=wifi_passes[0],
            confidence=conf,
            alternatives=wifi_passes[1:],
            raw_value=wifi_passes[0],
        )
    else:
        fields["wifi_password"] = None

    # --- Default IP ---
    ips = _extract_default_ip(normalized_text)
    if ips:
        conf = _calc_confidence(ips, ocr_confidence)
        fields["default_ip"] = ExtractedField(
            value=ips[0],
            raw_match=ips[0],
            confidence=conf,
            alternatives=ips[1:],
        )
        if len(ips) > 1:
            warnings.append(f"Multiple IP addresses found: {ips}. Verify correct value.")
    else:
        fields["default_ip"] = None

    # --- Gateway ---
    gateways = _extract_gateway(normalized_text)
    if gateways:
        conf = _calc_confidence(gateways, ocr_confidence)
        fields["gateway"] = ExtractedField(
            value=gateways[0],
            raw_match=gateways[0],
            confidence=conf,
            alternatives=gateways[1:],
        )
    else:
        fields["gateway"] = None

    # --- Credential flag ---
    contains_credentials = any(
        fields.get(f) is not None for f in CREDENTIAL_FIELDS
    )
    if contains_credentials:
        warnings.insert(0, "Credentials detected in label - handle with care")

    logger.info(
        "Extracted %d fields (%d non-null), credentials=%s",
        len(fields),
        sum(1 for v in fields.values() if v is not None),
        contains_credentials,
    )

    return ExtractionResult(
        fields=fields,
        contains_credentials=contains_credentials,
        warnings=warnings,
    )
