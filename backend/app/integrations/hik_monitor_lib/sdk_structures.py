"""
Hikvision Monitor Library - SDK Structures
==========================================
ctypes structures for Hikvision HCNetSDK.
Cross-platform support for Windows and Linux.
"""

import sys
from ctypes import Structure, Union, c_byte, c_ubyte, c_char, c_ushort, c_int, c_long, c_float, c_void_p, c_uint
from datetime import datetime
from enum import IntEnum

# Cross-platform DWORD definition
# Windows: DWORD = unsigned long (4 bytes) from wintypes
# Linux: DWORD = unsigned int (4 bytes) per HCNetSDK.h line 37
if sys.platform == "win32":
    from ctypes.wintypes import DWORD
else:
    DWORD = c_uint

# ============================================================================
# CONSTANTS
# ============================================================================

SERIALNO_LEN = 48
NAME_LEN = 32
PASSWD_LEN = 16
MAX_DISKNUM_V30 = 33
MAX_CHANNUM_V30 = 64
MAX_IP_DEVICE_V40 = 64
MAX_DOMAIN_NAME = 64
SDK_MAX_IP_LEN = 64
SUPPORT_PD_NUM = 16
MAX_NAMELEN = 32
MAX_SMART_ATTR_NUM = 30
NET_SDK_MAX_FILE_PATH = 256  # Max file path length for SDK

# SDK Configuration Commands
NET_DVR_GET_DEVICECFG_V40 = 1100
NET_SDK_INIT_CFG_SDK_PATH = 2  # SDK path configuration type for NET_DVR_SetSDKInitCfg
NET_DVR_GET_HDCFG = 1054
NET_DVR_GET_HDCFG_V40 = 6122
NET_DVR_GET_HDCFG_V50 = 4153
NET_DVR_GET_HD_STATUS = 6170
NET_DVR_GET_WORKSTATE_V40 = 1007
NET_DVR_GET_IPPARACFG_V40 = 1062
NET_DVR_GET_PHY_DISK_INFO = 6306
NET_DVR_GET_HDD_SMART_INFO = 3262

# Important SMART Attribute IDs
SMART_ATTR_POWER_ON_HOURS = 9
SMART_ATTR_REALLOCATED_SECTORS = 5
SMART_ATTR_TEMPERATURE = 194

# Critical HDD statuses requiring replacement
CRITICAL_HDD_STATUSES = {2, 3, 17, 18}


# ============================================================================
# ENUMS
# ============================================================================

class HDStatus(IntEnum):
    """HDD Status codes."""
    NORMAL = 0
    RAW = 1
    ERROR = 2
    SMART_FAILED = 3
    MISMATCH = 4
    SLEEP = 5
    OFFLINE = 6
    EXPAND = 7
    REPAIRING = 10
    FORMATTING = 11
    WAITING_FORMAT = 12
    UNINSTALLED = 13
    NOT_EXIST = 14
    DELETING = 15
    LOCKED = 16
    WARNING = 17
    BAD = 18
    HIDDEN = 19
    UNAUTHORIZED = 20
    NOT_FORMATTED = 21


class HDType(IntEnum):
    """HDD Type codes."""
    LOCAL = 0
    ESATA = 1
    NAS = 2
    ISCSI = 3
    ARRAY = 4
    SD_CARD = 5
    MINSAS = 6


class DeviceWorkState(IntEnum):
    """Device work state."""
    NORMAL = 0
    CPU_HIGH = 1
    HARDWARE_ERROR = 2


class DiskWorkState(IntEnum):
    """Disk work state."""
    ACTIVE = 0
    SLEEP = 1
    ABNORMAL = 2
    SLEEP_ERROR = 3
    NOT_FORMATTED = 4
    CANT_CONNECT = 5
    FORMATTING = 6
    FULL = 7
    OTHER = 8


# ============================================================================
# STRUCTURES
# ============================================================================

class NET_DVR_LOCAL_SDK_PATH(Structure):
    """
    SDK path configuration structure.

    Used with NET_DVR_SetSDKInitCfg(NET_SDK_INIT_CFG_SDK_PATH, ...) to specify
    the path to HCNetSDKCom folder containing SDK component DLLs.

    This MUST be called BEFORE NET_DVR_Init() to allow SDK to find its components
    when the application runs from a different directory.
    """
    _fields_ = [
        ("sPath", c_char * NET_SDK_MAX_FILE_PATH),  # Path to SDK (with HCNetSDKCom subfolder)
        ("byRes", c_byte * 128),                     # Reserved
    ]


class NET_DVR_IPADDR(Structure):
    """IP address structure (IPv4/IPv6)."""
    _fields_ = [
        ("sIpV4", c_char * 16),
        ("sIpV6", c_char * 128),
    ]


class NET_DVR_TIME(Structure):
    """Time structure."""
    _fields_ = [
        ("dwYear", DWORD),
        ("dwMonth", DWORD),
        ("dwDay", DWORD),
        ("dwHour", DWORD),
        ("dwMinute", DWORD),
        ("dwSecond", DWORD),
    ]

    def to_datetime(self) -> datetime:
        """Convert to Python datetime."""
        try:
            return datetime(
                self.dwYear, self.dwMonth, self.dwDay,
                self.dwHour, self.dwMinute, self.dwSecond
            )
        except ValueError:
            return datetime.min

    @classmethod
    def from_datetime(cls, dt: datetime) -> 'NET_DVR_TIME':
        """Create from Python datetime."""
        t = cls()
        t.dwYear = dt.year
        t.dwMonth = dt.month
        t.dwDay = dt.day
        t.dwHour = dt.hour
        t.dwMinute = dt.minute
        t.dwSecond = dt.second
        return t


class NET_DVR_DEVICEINFO_V30(Structure):
    """Device information v3.0."""
    _fields_ = [
        ("sSerialNumber", c_byte * SERIALNO_LEN),
        ("byAlarmInPortNum", c_ubyte),
        ("byAlarmOutPortNum", c_ubyte),
        ("byDiskNum", c_ubyte),
        ("byDVRType", c_ubyte),
        ("byChanNum", c_ubyte),
        ("byStartChan", c_ubyte),
        ("byAudioChanNum", c_ubyte),
        ("byIPChanNum", c_ubyte),
        ("byZeroChanNum", c_byte),
        ("byMainProto", c_byte),
        ("bySubProto", c_byte),
        ("bySupport", c_byte),
        ("bySupport1", c_byte),
        ("bySupport2", c_byte),
        ("wDevType", c_ushort),
        ("bySupport3", c_byte),
        ("byMultiStreamProto", c_byte),
        ("byStartDChan", c_ubyte),
        ("byStartDTalkChan", c_ubyte),
        ("byHighDChanNum", c_ubyte),
        ("bySupport4", c_byte),
        ("byLanguageType", c_byte),
        ("byVoiceInChanNum", c_byte),
        ("byStartVoiceInChanNo", c_byte),
        ("bySupport5", c_byte),
        ("bySupport6", c_byte),
        ("byMirrorChanNum", c_byte),
        ("wStartMirrorChanNo", c_ushort),
        ("bySupport7", c_byte),
        ("byRes2", c_byte),
    ]


class NET_DVR_DEVICEINFO_V40(Structure):
    """Device information v4.0."""
    _fields_ = [
        ("struDeviceV30", NET_DVR_DEVICEINFO_V30),
        ("bySupportLock", c_byte),
        ("byRetryLoginTime", c_byte),
        ("byPasswordLevel", c_byte),
        ("byProxyType", c_byte),
        ("dwSurplusLockTime", DWORD),
        ("byCharEncodeType", c_byte),
        ("bySupportDev5", c_byte),
        ("bySupport", c_byte),
        ("byLoginMode", c_byte),
        ("dwOEMCode", DWORD),
        ("iResidualValidity", c_int),
        ("byResidualValidity", c_byte),
        ("bySingleStartDTalkChan", c_byte),
        ("bySingleDTalkChanNums", c_byte),
        ("byPassWordResetLevel", c_byte),
        ("bySupportStreamEncrypt", c_byte),
        ("byMarketType", c_byte),
        ("byTLSCap", c_byte),
        ("byRes2", c_byte * 237),
    ]


class NET_DVR_USER_LOGIN_INFO(Structure):
    """Login parameters."""
    _fields_ = [
        ("sDeviceAddress", c_char * 129),
        ("byUseTransport", c_byte),
        ("wPort", c_ushort),
        ("sUserName", c_char * 64),
        ("sPassword", c_char * 64),
        ("cbLoginResult", c_void_p),
        ("pUser", c_void_p),
        ("bUseAsynLogin", c_int),
        ("byProxyType", c_byte),
        ("byUseUTCTime", c_byte),
        ("byLoginMode", c_byte),
        ("byHttps", c_byte),
        ("iProxyID", c_int),
        ("byVerifyMode", c_byte),
        ("byRes3", c_byte * 119),
    ]


class NET_DVR_SINGLE_HD(Structure):
    """Single HDD information (basic)."""
    _fields_ = [
        ("dwHDNo", DWORD),
        ("dwCapacity", DWORD),
        ("dwFreeSpace", DWORD),
        ("dwHdStatus", DWORD),
        ("byHDAttr", c_byte),
        ("byHDType", c_byte),
        ("byDiskDriver", c_byte),
        ("byRes1", c_byte),
        ("dwHdGroup", DWORD),
        ("byRecycling", c_byte),
        ("bySupportFormatType", c_byte),
        ("byFormatType", c_byte),
        ("byRes2", c_byte),
        ("dwStorageType", DWORD),
        ("dwPictureCapacity", DWORD),
        ("dwFreePictureSpace", DWORD),
        ("byRes3", c_byte * 104),
    ]


class NET_DVR_HDCFG(Structure):
    """HDD configuration."""
    _fields_ = [
        ("dwSize", DWORD),
        ("dwHDCount", DWORD),
        ("struHDInfo", NET_DVR_SINGLE_HD * MAX_DISKNUM_V30),
    ]


class NET_DVR_SINGLE_HD_V50(Structure):
    """Single HDD information v5.0 (with model and manufacturer)."""
    _fields_ = [
        ("dwHDNo", DWORD),
        ("dwCapacity", DWORD),
        ("dwFreeSpace", DWORD),
        ("dwHdStatus", DWORD),
        ("byHDAttr", c_byte),
        ("byHDType", c_byte),
        ("byDiskDriver", c_byte),
        ("byGenusGroup", c_byte),
        ("dwHdGroup", DWORD),
        ("byRecycling", c_byte),
        ("bySupportFormatType", c_byte),
        ("byFormatType", c_byte),
        ("byRes2", c_byte),
        ("dwStorageType", DWORD),
        ("dwPictureCapacity", DWORD),
        ("dwFreePictureSpace", DWORD),
        ("byDiskLocation", c_byte * 16),
        ("bySupplierName", c_byte * 32),
        ("byDiskModel", c_byte * 64),
        ("szHDLocateIP", c_char * SDK_MAX_IP_LEN),
        ("byRes3", c_byte * 80),
    ]


class NET_DVR_HDCFG_V50(Structure):
    """HDD configuration v5.0."""
    _fields_ = [
        ("dwSize", DWORD),
        ("dwHDCount", DWORD),
        ("struHDInfoV50", NET_DVR_SINGLE_HD_V50 * MAX_DISKNUM_V30),
        ("byRes", c_byte * 128),
    ]


class NET_DVR_PHY_DISK_INFO(Structure):
    """Physical disk information (for RAID/NVR).

    Disk types (byType):
        0 - normal
        1 - global hot-swap
        2 - array hot-swap
        3 - RAID array
        4 - offline
        5 - secondary normal
        6 - external
        7 - abnormal
        8 - SMART status abnormal  <-- Important: indicates SMART problem
        9 - sleeping
        10 - has bad blocks
        11 - SMR disk doesn't support RAID
        0xff - doesn't exist
    """
    _fields_ = [
        ("wPhySlot", c_ushort),
        ("byType", c_byte),
        ("byStatus", c_byte),
        ("byMode", c_byte * 40),
        ("dwHCapacity", DWORD),
        ("dwLCapacity", DWORD),
        ("byArrayName", c_byte * MAX_NAMELEN),
        ("wArrayID", c_ushort),
        ("byArrayInformation", c_byte),
        ("byRes", c_byte * 101),
    ]


class NET_DVR_PHY_DISK_LIST(Structure):
    """Physical disk list."""
    _fields_ = [
        ("dwSize", DWORD),
        ("dwCount", DWORD),
        ("struPhyDiskInfo", NET_DVR_PHY_DISK_INFO * SUPPORT_PD_NUM),
    ]


class NET_DVR_SMART_ATTR_INFO(Structure):
    """Single SMART attribute information.

    Important attributes:
        ID 5  - Reallocated Sectors Count
        ID 9  - Power-On Hours
        ID 194 - Temperature
        ID 197 - Current Pending Sector Count
        ID 198 - Offline Uncorrectable
    """
    _fields_ = [
        ("byAttrID", c_byte),
        ("byStatusFlags", c_byte),
        ("byAttrValue", c_byte),
        ("byWorst", c_byte),
        ("dwRawValue", c_byte * 6),
        ("byRes", c_byte * 2),
    ]


class NET_DVR_HDD_SMART_INFO(Structure):
    """HDD SMART information.

    Used with command NET_DVR_GET_HDD_SMART_INFO (3262).
    Parameter lChannel = disk number (1-based).
    """
    _fields_ = [
        ("dwSize", DWORD),
        ("byHDNo", c_byte),
        ("bySelfTestStatus", c_byte),
        ("byRes1", c_byte * 2),
        ("dwAttrCount", DWORD),
        ("struSmartAttrInfo", NET_DVR_SMART_ATTR_INFO * MAX_SMART_ATTR_NUM),
        ("byRes2", c_byte * 64),
    ]


class NET_DVR_DISKSTATE(Structure):
    """Disk state (from WORKSTATE)."""
    _fields_ = [
        ("dwVolume", DWORD),
        ("dwFreeSpace", DWORD),
        ("dwHardDiskStatic", DWORD),
    ]


class NET_DVR_CHANNELSTATE_V30(Structure):
    """Channel state."""
    _fields_ = [
        ("byRecordStatic", c_byte),
        ("bySignalStatic", c_byte),
        ("byHardwareStatic", c_byte),
        ("byRes1", c_byte),
        ("dwBitRate", DWORD),
        ("dwLinkNum", DWORD),
        ("dwClientIP", DWORD * 6),
        ("dwIPLinkNum", DWORD),
        ("byExistVideo", c_byte),
        ("byExistAudio", c_byte),
        ("byRes", c_byte * 2),
    ]


class NET_DVR_WORKSTATE_V40(Structure):
    """Device work state v4.0."""
    _fields_ = [
        ("dwSize", DWORD),
        ("dwDeviceStatic", DWORD),
        ("struHardDiskStatic", NET_DVR_DISKSTATE * MAX_DISKNUM_V30),
        ("struChanStatic", NET_DVR_CHANNELSTATE_V30 * 512),
        ("dwHasAlarmInStatic", DWORD * 512),
        ("dwHasAlarmOutStatic", DWORD * 512),
        ("dwLocalDisplay", DWORD),
        ("byAudioInChanStatus", c_byte * 2),
        ("byRes1", c_byte * 2),
        ("fHumidity", c_float),
        ("fTemperature", c_float),
        ("byRes", c_byte * 116),
    ]


class NET_DVR_IPDEVINFO_V31(Structure):
    """IP device information."""
    _fields_ = [
        ("byEnable", c_byte),
        ("byProType", c_byte),
        ("byEnableQuickAdd", c_byte),
        ("byCameraType", c_byte),
        ("sUserName", c_byte * NAME_LEN),
        ("sPassword", c_byte * PASSWD_LEN),
        ("byDomain", c_byte * MAX_DOMAIN_NAME),
        ("struIP", NET_DVR_IPADDR),
        ("wDVRPort", c_ushort),
        ("szDeviceID", c_byte * 32),
        ("byEnableTiming", c_byte),
        ("byCertificateValidation", c_byte),
    ]


class NET_DVR_IPCHANINFO(Structure):
    """IP channel information."""
    _fields_ = [
        ("byEnable", c_byte),
        ("byIPID", c_byte),
        ("byChannel", c_byte),
        ("byIPIDHigh", c_byte),
        ("byTransProtocol", c_byte),
        ("byGetStream", c_byte),
        ("byRes", c_byte * 30),
    ]


class NET_DVR_GET_STREAM_UNION(Union):
    """Union for stream retrieval.

    When byGetStreamType = 0 (direct connection), use struChanInfo.
    """
    _fields_ = [
        ("struChanInfo", NET_DVR_IPCHANINFO),
        ("byRes", c_byte * 492),
    ]


class NET_DVR_STREAM_MODE(Structure):
    """Stream mode."""
    _fields_ = [
        ("byGetStreamType", c_byte),
        ("byRes", c_byte * 3),
        ("uGetStream", NET_DVR_GET_STREAM_UNION),
    ]


class NET_DVR_IPPARACFG_V40(Structure):
    """IP channel configuration v4.0."""
    _fields_ = [
        ("dwSize", DWORD),
        ("dwGroupNum", DWORD),
        ("dwAChanNum", DWORD),
        ("dwDChanNum", DWORD),
        ("dwStartDChan", DWORD),
        ("byAnalogChanEnable", c_byte * MAX_CHANNUM_V30),
        ("struIPDevInfo", NET_DVR_IPDEVINFO_V31 * MAX_IP_DEVICE_V40),
        ("struStreamMode", NET_DVR_STREAM_MODE * MAX_CHANNUM_V30),
        ("byRes2", c_byte * 20),
    ]


class NET_DVR_FILECOND_V40(Structure):
    """File search conditions v4.0."""
    _fields_ = [
        ("lChannel", c_long),
        ("dwFileType", DWORD),
        ("dwIsLocked", DWORD),
        ("dwUseCardNo", DWORD),
        ("sCardNumber", c_byte * 32),
        ("struStartTime", NET_DVR_TIME),
        ("struStopTime", NET_DVR_TIME),
        ("byDrawFrame", c_byte),
        ("byFindType", c_byte),
        ("byQuickSearch", c_byte),
        ("bySpecialFindInfoType", c_byte),
        ("dwVolumeNum", DWORD),
        ("byWorkingDeviceGUID", c_byte * 16),
        ("uSpecialFindInfo", c_byte * 68),
        ("byStreamType", c_byte),
        ("byAudioFile", c_byte),
        ("byRes2", c_byte * 30),
    ]


class NET_DVR_FINDDATA_V40(Structure):
    """File search result v4.0."""
    _fields_ = [
        ("sFileName", c_char * 100),
        ("struStartTime", NET_DVR_TIME),
        ("struStopTime", NET_DVR_TIME),
        ("dwFileSize", DWORD),
        ("sCardNum", c_char * 32),
        ("byLocked", c_byte),
        ("byFileType", c_byte),
        ("byQuickSearch", c_byte),
        ("byRes", c_byte),
        ("dwFileIndex", DWORD),
        ("byStreamType", c_byte),
        ("byRes1", c_byte * 127),
    ]


class NET_DVR_XML_CONFIG_INPUT(Structure):
    """ISAPI XML request input parameters."""
    _fields_ = [
        ("dwSize", DWORD),
        ("lpRequestUrl", c_void_p),
        ("dwRequestUrlLen", DWORD),
        ("lpInBuffer", c_void_p),
        ("dwInBufferSize", DWORD),
        ("dwRecvTimeOut", DWORD),
        ("byForceEncrpt", c_byte),
        ("byNumOfMultiPart", c_byte),
        ("byMIMEType", c_byte),
        ("byRes1", c_byte),
        ("dwSendTimeOut", DWORD),
        ("byRes", c_byte * 24),
    ]


class NET_DVR_XML_CONFIG_OUTPUT(Structure):
    """ISAPI XML response output parameters."""
    _fields_ = [
        ("dwSize", DWORD),
        ("lpOutBuffer", c_void_p),
        ("dwOutBufferSize", DWORD),
        ("dwReturnedXMLSize", DWORD),
        ("lpStatusBuffer", c_void_p),
        ("dwStatusSize", DWORD),
        ("lpDataBuffer", c_void_p),
        ("byNumOfMultiPart", c_byte),
        ("byRes", c_byte * 23),
    ]


class NET_DVR_JPEGPARA(Structure):
    """JPEG capture parameters for NET_DVR_CaptureJPEGPicture_NEW.

    wPicSize: Picture resolution
        0xff - Auto (use current stream resolution)
        0 - CIF(352*288/352*240)
        1 - QCIF(176*144/176*120)
        2 - 4CIF(704*576/704*480)
        3 - UXGA(1600*1200)
        4 - SVGA(800*600)
        5 - HD720P(1280*720)
        6 - VGA(640*480)
        7 - XVGA(1280*960)
        8 - HD900P(1600*900)
        And more - see SDK header for full list

    wPicQuality: Picture quality
        0 - Best
        1 - Better
        2 - Average
    """
    _fields_ = [
        ("wPicSize", c_ushort),      # Picture resolution
        ("wPicQuality", c_ushort),   # Picture quality (0=best, 1=better, 2=average)
    ]


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_hd_status_name(status_code: int) -> str:
    """Convert HDD status code to human-readable name."""
    status_names = {
        0: "Normal",
        1: "RAW (unformatted)",
        2: "Error",
        3: "SMART Failed",
        4: "Mismatch",
        5: "Sleep",
        6: "Offline",
        7: "Expanding",
        10: "Repairing",
        11: "Formatting",
        12: "Waiting format",
        13: "Uninstalled",
        14: "Not exist",
        15: "Deleting",
        16: "Locked",
        17: "Warning",
        18: "Bad",
        19: "Hidden",
        20: "Unauthorized",
        21: "Not formatted",
    }
    return status_names.get(status_code, f"Unknown ({status_code})")


def get_hd_type_name(hd_type: int) -> str:
    """Convert HDD type code to human-readable name."""
    type_names = {
        0: "Local HDD",
        1: "eSATA",
        2: "NAS",
        3: "iSCSI",
        4: "RAID Array",
        5: "SD Card",
        6: "miniSAS",
    }
    return type_names.get(hd_type, f"Unknown ({hd_type})")


def is_hdd_critical(status_code: int, smart_status: str = "") -> bool:
    """
    Check if HDD status is critical (requires replacement).

    Args:
        status_code: HDD status code from SDK
        smart_status: SMART status string ("Pass", "Fail", "Warning")

    Returns:
        True if HDD requires replacement
    """
    if status_code in CRITICAL_HDD_STATUSES:
        return True
    if smart_status and smart_status.lower() == "fail":
        return True
    return False
