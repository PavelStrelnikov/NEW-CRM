"""
Hikvision Monitor Library - Exceptions
======================================
Custom exceptions for the library.
"""


class HikvisionError(Exception):
    """Base exception for all Hikvision-related errors."""
    pass


class SdkNotFoundError(HikvisionError):
    """SDK DLL file not found."""

    def __init__(self, path: str):
        self.path = path
        super().__init__(f"HCNetSDK.dll not found at: {path}")


class SdkInitError(HikvisionError):
    """SDK initialization failed."""

    def __init__(self, error_code: int = None):
        self.error_code = error_code
        msg = "SDK initialization failed"
        if error_code:
            msg += f", error code: {error_code}"
        super().__init__(msg)


class DeviceConnectionError(HikvisionError):
    """Failed to connect to device."""

    def __init__(self, ip: str, port: int, error_code: int, error_msg: str = None):
        self.ip = ip
        self.port = port
        self.error_code = error_code
        self.error_msg = error_msg

        msg = f"Failed to connect to {ip}:{port}, SDK error code: {error_code}"
        if error_msg:
            msg += f" ({error_msg})"
        super().__init__(msg)


class DeviceNotConnectedError(HikvisionError):
    """Operation attempted without active connection."""

    def __init__(self):
        super().__init__("Not connected to device. Call connect() first.")


class IsapiError(HikvisionError):
    """ISAPI request failed."""

    def __init__(self, endpoint: str, error_code: int = None):
        self.endpoint = endpoint
        self.error_code = error_code
        msg = f"ISAPI request failed: {endpoint}"
        if error_code:
            msg += f", error code: {error_code}"
        super().__init__(msg)


class ConfigurationError(HikvisionError):
    """SDK configuration retrieval failed."""

    def __init__(self, command: int, error_code: int = None):
        self.command = command
        self.error_code = error_code
        msg = f"Failed to get configuration (command: {command})"
        if error_code:
            msg += f", error code: {error_code}"
        super().__init__(msg)


# SDK Error codes mapping (common ones)
SDK_ERROR_CODES = {
    0: "No error",
    1: "User name or password error",
    2: "Not authorized",
    3: "SDK not initialized",
    4: "Channel number error",
    5: "Connection timeout",
    6: "Network connection error",
    7: "Network receive error",
    8: "Network send error",
    9: "Connection count max",
    10: "SDK version mismatch",
    12: "Device offline",
    17: "Parameter error",
    29: "User locked",
    34: "SDK resource error",
    41: "Risk password",
    47: "Device type not supported",
    91: "Function not supported",
}


def get_sdk_error_message(error_code: int) -> str:
    """Get human-readable error message for SDK error code."""
    return SDK_ERROR_CODES.get(error_code, f"Unknown error ({error_code})")
