# Hikvision Monitor Library - Linux Installation

## System Dependencies

The Hikvision SDK for Linux requires the following system libraries.

### Ubuntu 20.04+ / Debian 11+

```bash
sudo apt-get update
sudo apt-get install -y \
    libuuid1 \
    libssl1.1 \
    zlib1g \
    libc6
```

**Note:** If `libssl1.1` is not available (Ubuntu 22.04+), the SDK includes bundled `libssl.so.1.1` and `libcrypto.so.1.1`.

### CentOS 8+ / RHEL 8+

```bash
sudo dnf install -y \
    libuuid \
    openssl-libs \
    zlib \
    glibc
```

## SDK Structure

After installation, the library automatically searches for SDK in:

```
hik_monitor_lib/lib/linux64/lib/
├── libhcnetsdk.so      # Main library
├── libHCCore.so        # Core
├── libhpr.so           # HPR library
├── libcrypto.so.1.1    # OpenSSL (bundled)
├── libssl.so.1.1       # OpenSSL (bundled)
└── HCNetSDKCom/        # SDK components
    ├── libHCAlarm.so
    ├── libHCGeneralCfgMgr.so
    ├── libHCPreview.so
    └── ...
```

## File Permissions

After copying `.so` files, set execute permissions:

```bash
chmod +x lib/linux64/lib/*.so
chmod +x lib/linux64/lib/HCNetSDKCom/*.so
```

## LD_LIBRARY_PATH

The library automatically adds paths to `LD_LIBRARY_PATH`.
If needed, set manually:

```bash
export LD_LIBRARY_PATH=/path/to/hik_monitor_lib/lib/linux64/lib:$LD_LIBRARY_PATH
export LD_LIBRARY_PATH=/path/to/hik_monitor_lib/lib/linux64/lib/HCNetSDKCom:$LD_LIBRARY_PATH
```

Or add to `~/.bashrc` for persistence:

```bash
echo 'export LD_LIBRARY_PATH=/path/to/hik_monitor_lib/lib/linux64/lib:$LD_LIBRARY_PATH' >> ~/.bashrc
echo 'export LD_LIBRARY_PATH=/path/to/hik_monitor_lib/lib/linux64/lib/HCNetSDKCom:$LD_LIBRARY_PATH' >> ~/.bashrc
source ~/.bashrc
```

## Verify Installation

```python
from hik_monitor_lib import HikvisionManager

try:
    manager = HikvisionManager()
    print(f"SDK loaded: {manager._platform}")
except Exception as e:
    print(f"Error: {e}")
```

## Check Missing Dependencies

If SDK fails to load, check for missing libraries:

```bash
ldd lib/linux64/lib/libhcnetsdk.so | grep "not found"
```

## Known Issues

### GLIBC Version
SDK requires GLIBC >= 2.17. Check your version:
```bash
ldd --version
```

### SELinux
On systems with SELinux, you may need to:
```bash
sudo setenforce 0  # Temporary
# Or add a rule for .so files
```

### 32-bit vs 64-bit
This library uses 64-bit SDK (`linux64`). Ensure you're running on a 64-bit system:
```bash
uname -m  # Should output x86_64
```

## Troubleshooting

### Error: "cannot open shared object file"

1. Check the file exists:
   ```bash
   ls -la lib/linux64/lib/libhcnetsdk.so
   ```

2. Check permissions:
   ```bash
   chmod +x lib/linux64/lib/*.so
   ```

3. Check dependencies:
   ```bash
   ldd lib/linux64/lib/libhcnetsdk.so
   ```

### Error: "undefined symbol"

This usually means a component library is missing. Ensure all files from `HCNetSDKCom/` are present and in `LD_LIBRARY_PATH`.

### Error: "GLIBC_X.XX not found"

Your system GLIBC is too old. Options:
- Upgrade your OS
- Build GLIBC from source (advanced)
- Use a Docker container with a newer distro
