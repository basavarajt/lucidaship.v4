"""
Standardised API response helpers.
Every endpoint returns {success, data, error} for consistency.
"""

from typing import Any, Optional
from fastapi.responses import JSONResponse


def success_response(data: Any = None, status_code: int = 200) -> JSONResponse:
    """Return a standardised success response."""
    return JSONResponse(
        status_code=status_code,
        content={
            "success": True,
            "data": data,
            "error": None,
        },
    )


def error_response(code: str, message: str, status_code: int = 400) -> JSONResponse:
    """Return a standardised error response."""
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "data": None,
            "error": {
                "code": code,
                "message": message,
            },
        },
    )
