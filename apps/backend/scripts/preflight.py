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
        explicit_origins = [
            origin.strip()
            for origin in settings.cors_origins_list
            if origin.strip() and origin.strip() != "*"
        ]
        if not explicit_origins:
            errors.append("CORS_ORIGINS must include at least one explicit origin in production.")

        if not settings.DATABASE_URL and not settings.ALLOW_PRODUCTION_SQLITE_FALLBACK:
            errors.append(
                "Production requires a persistent DATABASE_URL (managed SQL) or set ALLOW_PRODUCTION_SQLITE_FALLBACK=true for temporary testing."
            )

        if settings.GCS_BUCKET_NAME and not settings.GOOGLE_APPLICATION_CREDENTIALS:
            warnings.append(
                "GOOGLE_APPLICATION_CREDENTIALS is unset; Firebase/GCS will use Cloud Run Application Default Credentials."
            )
    elif not settings.GOOGLE_APPLICATION_CREDENTIALS:
        warnings.append("GOOGLE_APPLICATION_CREDENTIALS is unset; local dev auth bypass is available without credentials.")

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
