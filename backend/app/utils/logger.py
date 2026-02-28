"""
Centralized logging configuration for the CRM application.
Supports multiple log levels controlled by environment variables.
"""
import logging
import sys
from typing import Optional, Any, Dict

# Lazy import to avoid circular dependency
_settings = None


def _get_settings():
    """Lazy load settings to avoid circular import."""
    global _settings
    if _settings is None:
        from app.config import settings
        _settings = settings
    return _settings


def setup_logger(name: str, level: Optional[str] = None) -> logging.Logger:
    """
    Configure and return a logger with proper formatting and handlers.

    Args:
        name: Logger name (usually __name__)
        level: Optional override for log level (DEBUG, INFO, WARNING, ERROR)
               If not provided, uses settings.LOG_LEVEL

    Returns:
        Configured logger instance

    Example:
        >>> from app.utils.logger import setup_logger
        >>> logger = setup_logger(__name__)
        >>> logger.info("Application started")
        [2024-01-17 10:30:45] INFO [app.main] Application started
    """
    logger = logging.getLogger(name)

    # Get log level from ENV or parameter
    settings = _get_settings()
    log_level_str = level or getattr(settings, 'LOG_LEVEL', 'INFO').upper()
    log_level = getattr(logging, log_level_str, logging.INFO)
    logger.setLevel(log_level)

    # Prevent duplicate handlers
    if logger.handlers:
        return logger

    # Console handler with formatting
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(log_level)

    # Format: [2024-01-17 10:30:45] INFO [module.name] Message
    formatter = logging.Formatter(
        '[%(asctime)s] %(levelname)s [%(name)s] %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)

    return logger


def mask_sensitive_data(data: Any) -> Any:
    """
    Mask sensitive fields in dictionaries for safe logging.

    Recursively masks password, token, secret, api_key, and credential fields.

    Args:
        data: Dictionary potentially containing sensitive data

    Returns:
        Dictionary with sensitive fields masked as '***MASKED***'

    Example:
        >>> mask_sensitive_data({'username': 'admin', 'password': 'secret123'})
        {'username': 'admin', 'password': '***MASKED***'}
    """
    SENSITIVE_KEYS = {'password', 'token', 'secret', 'api_key', 'credential', 'passwd', 'pwd'}

    if not isinstance(data, dict):
        return data

    masked = {}
    for key, value in data.items():
        # Check if key contains sensitive keyword
        if any(sensitive in key.lower() for sensitive in SENSITIVE_KEYS):
            masked[key] = '***MASKED***'
        elif isinstance(value, dict):
            # Recursively mask nested dictionaries
            masked[key] = mask_sensitive_data(value)
        elif isinstance(value, list):
            # Mask items in lists
            masked[key] = [mask_sensitive_data(item) if isinstance(item, dict) else item for item in value]
        else:
            masked[key] = value

    return masked


# Convenience function for quick debug logging
def log_dict(logger_instance: logging.Logger, level: str, message: str, data: Dict[str, Any]) -> None:
    """
    Log a dictionary with automatic sensitive data masking.

    Args:
        logger_instance: Logger instance to use
        level: Log level (debug, info, warning, error)
        message: Log message
        data: Dictionary to log (will be automatically masked)

    Example:
        >>> logger = setup_logger(__name__)
        >>> credentials = {'host': '192.168.1.1', 'password': 'secret'}
        >>> log_dict(logger, 'debug', 'Connecting to device', credentials)
        [2024-01-17 10:30:45] DEBUG [app.api] Connecting to device: {'host': '192.168.1.1', 'password': '***MASKED***'}
    """
    masked_data = mask_sensitive_data(data)
    log_method = getattr(logger_instance, level.lower(), logger_instance.info)
    log_method(f"{message}: {masked_data}")
