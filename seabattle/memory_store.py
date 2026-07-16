"""Хранилище как замена Redis.

На shared-хостинге (CGI) каждый запрос — новый процесс, поэтому
данные пишем на диск с file-lock, а не только в RAM.
"""
from __future__ import annotations

import json
import os
import re
import tempfile
import threading
import time
from typing import Any, Iterator

try:
    import fcntl
except ImportError:  # pragma: no cover
    fcntl = None  # type: ignore


_SAFE_KEY = re.compile(r"[^A-Za-z0-9._-]+")


def _safe_name(key: str) -> str:
    return _SAFE_KEY.sub("_", key)[:180]


class MemoryStore:
    """In-process fallback (для gunicorn/одного воркера)."""

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


class FileStore:
    """Персистентное хранилище для CGI / нескольких процессов."""

    def __init__(self, root: str) -> None:
        self.root = root
        os.makedirs(self.root, mode=0o700, exist_ok=True)
        self._thread = threading.Lock()

    def _path(self, key: str) -> str:
        return os.path.join(self.root, _safe_name(key) + ".json")

    def _lock_path(self, key: str) -> str:
        return self._path(key) + ".lock"

    def _lock_file(self, fh, exclusive: bool = True) -> None:
        if fcntl is None:
            return
        fcntl.flock(fh.fileno(), fcntl.LOCK_EX if exclusive else fcntl.LOCK_SH)

    def _unlock_file(self, fh) -> None:
        if fcntl is None:
            return
        try:
            fcntl.flock(fh.fileno(), fcntl.LOCK_UN)
        except Exception:
            pass

    def _expired(self, rec: dict[str, Any] | None) -> bool:
        if not rec:
            return True
        exp = float(rec.get("exp") or 0)
        return bool(exp and exp <= time.time())

    def _parse_record(self, raw: str) -> dict[str, Any] | None:
        if not raw:
            return None
        try:
            rec = json.loads(raw)
        except json.JSONDecodeError:
            return None
        if not isinstance(rec, dict):
            return None
        if self._expired(rec):
            return None
        return rec

    def _read_record_unlocked(self, path: str) -> dict[str, Any] | None:
        if not os.path.exists(path):
            return None
        try:
            with open(path, "r", encoding="utf-8") as fh:
                raw = fh.read()
            rec = self._parse_record(raw)
            if rec is None and raw:
                # битый/пустой после гонки — ещё раз
                time.sleep(0.02)
                with open(path, "r", encoding="utf-8") as fh:
                    raw = fh.read()
                rec = self._parse_record(raw)
            if rec is None and os.path.exists(path):
                # протухший ключ
                try:
                    if not raw or self._parse_record(raw) is None:
                        # удаляем только явно протухшие
                        try:
                            probe = json.loads(raw) if raw else None
                        except json.JSONDecodeError:
                            probe = None
                        if isinstance(probe, dict) and self._expired(probe):
                            os.remove(path)
                except OSError:
                    pass
            return rec
        except (OSError, ValueError, TypeError):
            return None

    def _atomic_write(self, path: str, rec: dict[str, Any]) -> None:
        payload = json.dumps(rec, ensure_ascii=False, separators=(",", ":"))
        directory = os.path.dirname(path) or "."
        fd, tmp = tempfile.mkstemp(prefix=".tmp-", dir=directory)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                fh.write(payload)
                fh.flush()
                os.fsync(fh.fileno())
            os.replace(tmp, path)
        except Exception:
            try:
                os.remove(tmp)
            except OSError:
                pass
            raise

    def ping(self) -> bool:
        return os.path.isdir(self.root)

    def get(self, key: str) -> Any:
        with self._thread:
            path = self._path(key)
            lock_path = self._lock_path(key)
            os.makedirs(self.root, exist_ok=True)
            with open(lock_path, "a+", encoding="utf-8") as lf:
                self._lock_file(lf, exclusive=False)
                try:
                    rec = self._read_record_unlocked(path)
                    return None if rec is None else rec.get("v")
                finally:
                    self._unlock_file(lf)

    def setex(self, key: str, ttl: int, value: Any) -> bool:
        with self._thread:
            path = self._path(key)
            lock_path = self._lock_path(key)
            os.makedirs(self.root, exist_ok=True)
            with open(lock_path, "a+", encoding="utf-8") as lf:
                self._lock_file(lf, exclusive=True)
                try:
                    rec = {
                        "k": key,
                        "v": value,
                        "exp": time.time() + max(1, int(ttl)),
                    }
                    self._atomic_write(path, rec)
                    return True
                finally:
                    self._unlock_file(lf)

    def delete(self, key: str) -> int:
        with self._thread:
            path = self._path(key)
            lock_path = self._lock_path(key)
            os.makedirs(self.root, exist_ok=True)
            with open(lock_path, "a+", encoding="utf-8") as lf:
                self._lock_file(lf, exclusive=True)
                try:
                    if not os.path.exists(path):
                        return 0
                    try:
                        os.remove(path)
                        return 1
                    except OSError:
                        return 0
                finally:
                    self._unlock_file(lf)

    def exists(self, key: str) -> int:
        return 1 if self.get(key) is not None else 0

    def incr(self, key: str) -> int:
        with self._thread:
            path = self._path(key)
            os.makedirs(self.root, exist_ok=True)
            # гарантируем существование файла для flock
            if not os.path.exists(path):
                with open(path, "a", encoding="utf-8"):
                    pass
            with open(path, "r+", encoding="utf-8") as fh:
                self._lock_file(fh, exclusive=True)
                try:
                    raw = fh.read()
                    rec = None
                    if raw:
                        try:
                            rec = json.loads(raw)
                        except json.JSONDecodeError:
                            rec = None
                    if self._expired(rec):
                        rec = None
                    n = int((rec or {}).get("v") or 0) + 1
                    exp = (rec or {}).get("exp")
                    out = {"k": key, "v": n, "exp": exp}
                    payload = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
                    fh.seek(0)
                    fh.truncate()
                    fh.write(payload)
                    fh.flush()
                    os.fsync(fh.fileno())
                    return n
                finally:
                    self._unlock_file(fh)

    def expire(self, key: str, ttl: int) -> bool:
        with self._thread:
            path = self._path(key)
            lock_path = self._lock_path(key)
            os.makedirs(self.root, exist_ok=True)
            with open(lock_path, "a+", encoding="utf-8") as lf:
                self._lock_file(lf, exclusive=True)
                try:
                    rec = self._read_record_unlocked(path)
                    if rec is None:
                        return False
                    rec["k"] = key
                    rec["exp"] = time.time() + max(1, int(ttl))
                    self._atomic_write(path, rec)
                    return True
                finally:
                    self._unlock_file(lf)

    def scan_iter(self, match: str = "*", count: int = 200) -> Iterator[str]:
        prefix = match[:-1] if match.endswith("*") else None
        try:
            names = os.listdir(self.root)
        except OSError:
            return
        yielded = 0
        for name in names:
            if not name.endswith(".json") or name.startswith(".") or name.endswith(".lock"):
                continue
            path = os.path.join(self.root, name)
            rec = self._read_record_unlocked(path)
            if rec is None:
                continue
            key = rec.get("k")
            if not key:
                continue
            if prefix is not None:
                if not str(key).startswith(prefix):
                    continue
            elif key != match:
                continue
            yield str(key)
            yielded += 1
            if yielded >= count:
                break
