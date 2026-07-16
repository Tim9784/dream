"""Простое in-memory хранилище как замена Redis на shared-хостинге."""
from __future__ import annotations

import threading
import time
from typing import Any, Iterator


class MemoryStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._data: dict[str, Any] = {}
        self._expire_at: dict[str, float] = {}

    def _purge_locked(self, key: str) -> None:
        exp = self._expire_at.get(key)
        if exp is not None and exp <= time.time():
            self._data.pop(key, None)
            self._expire_at.pop(key, None)

    def ping(self) -> bool:
        return True

    def get(self, key: str) -> Any:
        with self._lock:
            self._purge_locked(key)
            return self._data.get(key)

    def setex(self, key: str, ttl: int, value: Any) -> bool:
        with self._lock:
            self._data[key] = value
            self._expire_at[key] = time.time() + max(1, int(ttl))
            return True

    def delete(self, key: str) -> int:
        with self._lock:
            existed = 1 if key in self._data else 0
            self._data.pop(key, None)
            self._expire_at.pop(key, None)
            return existed

    def exists(self, key: str) -> int:
        with self._lock:
            self._purge_locked(key)
            return 1 if key in self._data else 0

    def incr(self, key: str) -> int:
        with self._lock:
            self._purge_locked(key)
            n = int(self._data.get(key) or 0) + 1
            self._data[key] = n
            return n

    def expire(self, key: str, ttl: int) -> bool:
        with self._lock:
            self._purge_locked(key)
            if key not in self._data:
                return False
            self._expire_at[key] = time.time() + max(1, int(ttl))
            return True

    def scan_iter(self, match: str = "*", count: int = 200) -> Iterator[str]:
        prefix = match[:-1] if match.endswith("*") else match
        with self._lock:
            keys = list(self._data.keys())
        for key in keys:
            with self._lock:
                self._purge_locked(key)
                if key not in self._data:
                    continue
            if match.endswith("*"):
                if key.startswith(prefix):
                    yield key
            elif key == match:
                yield key


class MemoryRedisError(Exception):
    pass
