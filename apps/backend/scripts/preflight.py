"""
Deployment preflight checks for Lucida backend.

This script intentionally avoids importing the ML stack so it can run even on
older local machines that cannot import the pinned NumPy wheels.
"""

from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings


def main() -> int:
    settings = get_settings()
    errors = []
    warnings = []

    if settings.is_production:
        if not settings.CLERK_SECRET_KEY:
            errors.append("CLERK_SECRET_KEY must be set in production.")
        explicit_origins = [origin.strip() for origin in settings.cors_origins_list if origin.strip() and origin.strip() != "*"]
        if not explicit_origins:
            errors.append("CORS_ORIGINS must include at least one explicit origin in production.")
    else:
        if not settings.CLERK_SECRET_KEY:
            warnings.append("CLERK_SECRET_KEY is unset; local dev auth bypass will be used.")

    if not settings.MODEL_ARTIFACTS_DIR:
        errors.append("MODEL_ARTIFACTS_DIR must not be empty.")

    if errors:
        print("Lucida preflight: FAILED")
        for item in errors:
            print(f"ERROR: {item}")
        for item in warnings:
            print(f"WARNING: {item}")
        return 1

    print("Lucida preflight: OK")
    for item in warnings:
        print(f"WARNING: {item}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
