# Dependency Fix - JWT Library Mismatch

**Issue**: `ModuleNotFoundError: No module named 'jwt'`

**Root Cause**: I used `import jwt` (PyJWT library) but your codebase uses `python-jose` (imported as `from jose import jwt`)

---

## What Was Fixed

### Updated Files

1. **app/guards.py**
   - Changed: `import jwt`
   - To: `from jose import jwt, JWTError`

2. **app/services/auth_service.py**
   - Changed: `import jwt` and `import bcrypt`
   - To: `from jose import jwt` and `from passlib.context import CryptContext`
   - Updated password hashing to use passlib (matches existing auth code)

---

## Why This Fix

Your existing auth code (`app/auth/security.py`) uses:
```python
from jose import JWTError, jwt
```

My new code incorrectly used:
```python
import jwt  # PyJWT library - wrong!
```

Now matches your existing pattern:
```python
from jose import jwt  # python-jose library - correct!
```

---

## Password Hashing

**Before** (my code):
```python
import bcrypt
bcrypt.hashpw(password.encode('utf-8'), salt)
```

**After** (matches your code):
```python
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
pwd_context.hash(password)
```

---

## Verification

```bash
✅ python -m py_compile app/guards.py
✅ python -m py_compile app/services/auth_service.py
✅ from app.main import app  # Successfully imports
```

---

## Dependencies Already Installed

Your `requirements.txt` already has:
- ✅ `python-jose[cryptography]>=3.3.0` - JWT handling
- ✅ `passlib[bcrypt]>=1.7.4` - Password hashing

No need to install anything new!

---

## Status

✅ **FIXED** - App should now start successfully

Try again:
```bash
uvicorn app.main:app --reload
```
