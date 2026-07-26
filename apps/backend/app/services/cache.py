"""Small in-memory TTL cache for repeated scoring work."""

from __future__ import annotations

import time
from typing import Any


class TTLCache:
    """Simple TTL cache without external dependencies."""

    def __init__(self, ttl_seconds: int, max_size: int = 256) -> None:
        self.ttl_seconds = ttl_seconds
        self.max_size = max_size
        self._items: dict[str, tuple[float, Any]] = {}

    def get(self, key: str) -> Any | None:
        item = self._items.get(key)
        if not item:
            return None
        expires_at, value = item
        if expires_at < time.time():
            self._items.pop(key, None)
            return None
        return value

    def set(self, key: str, value: Any) -> None:
        if len(self._items) >= self.max_size:
            oldest_key = next(iter(self._items))
            self._items.pop(oldest_key, None)
        self._items[key] = (time.time() + self.ttl_seconds, value)

