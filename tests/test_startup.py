"""
Simple script to test if the FastAPI application can start.
"""
import sys

try:
    from app.main import app
    from app.config import settings

    print("[OK] FastAPI app imported successfully")
    print(f"[OK] App title: {app.title}")
    print(f"[OK] Debug mode: {settings.DEBUG}")
    print(f"[OK] Database URL configured: {settings.DATABASE_URL[:30]}...")
    print("\n[OK] Application configuration is valid!")
    print("\nTo start the server, run:")
    print("  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000")
    print("\nTo start PostgreSQL:")
    print("  docker compose up -d")
    print("\nThen visit:")
    print("  http://localhost:8000/docs (API documentation)")
    print("  http://localhost:8000/health (Health check)")

except Exception as e:
    print(f"[ERROR] {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
