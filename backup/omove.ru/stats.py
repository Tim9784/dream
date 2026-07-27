"""Простая метрика сайта: визиты, партии, игры, режимы."""
from __future__ import annotations

import hashlib
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

MSK = timezone(timedelta(hours=3))
DAY_TTL = 60 * 60 * 24 * 45  # дневные ключи ~45 суток


def _day(ts: float | None = None) -> str:
    dt = datetime.fromtimestamp(ts or time.time(), tz=MSK)
    return dt.strftime("%Y-%m-%d")


def _incr(store: Any, key: str, ttl: int | None = None) -> None:
    try:
        store.incr(key)
        if ttl:
            store.expire(key, ttl)
    except Exception:
        pass


def _get_int(store: Any, key: str) -> int:
    try:
        v = store.get(key)
        if v is None:
            return 0
        return int(v)
    except Exception:
        return 0


def track_visit(store: Any, ip: str) -> None:
    day = _day()
    _incr(store, "stats:total:visits")
    _incr(store, f"stats:day:{day}:visits", DAY_TTL)
    # уникальные за день (хэш IP, без хранения адреса)
    ip_h = hashlib.sha256((ip or "?").encode("utf-8")).hexdigest()[:16]
    uv_key = f"stats:uv:{day}:{ip_h}"
    try:
        if not store.exists(uv_key):
            store.setex(uv_key, DAY_TTL, "1")
            _incr(store, "stats:total:uniques")
            _incr(store, f"stats:day:{day}:uniques", DAY_TTL)
    except Exception:
        pass


def track_room_created(store: Any, game_id: str, vs_ai: bool, vs_local: bool) -> None:
    day = _day()
    _incr(store, "stats:total:rooms")
    _incr(store, f"stats:day:{day}:rooms", DAY_TTL)
    _incr(store, f"stats:game:{game_id}")
    _incr(store, f"stats:day:{day}:game:{game_id}", DAY_TTL)
    if vs_ai:
        mode = "ai"
    elif vs_local:
        mode = "local"
    else:
        mode = "online"
    _incr(store, f"stats:mode:{mode}")
    _incr(store, f"stats:day:{day}:mode:{mode}", DAY_TTL)


def track_join(store: Any) -> None:
    day = _day()
    _incr(store, "stats:total:joins")
    _incr(store, f"stats:day:{day}:joins", DAY_TTL)


def track_finished(store: Any, game_id: str) -> None:
    day = _day()
    _incr(store, "stats:total:finished")
    _incr(store, f"stats:day:{day}:finished", DAY_TTL)
    _incr(store, f"stats:finished:{game_id}")


def snapshot(
    store: Any,
    games: dict[str, Any],
    active_rooms: Callable[[], int],
) -> dict[str, Any]:
    today = _day()
    by_game = []
    for gid, meta in games.items():
        by_game.append({
            "id": gid,
            "title": meta.get("title") or gid,
            "rooms": _get_int(store, f"stats:game:{gid}"),
            "finished": _get_int(store, f"stats:finished:{gid}"),
            "today": _get_int(store, f"stats:day:{today}:game:{gid}"),
        })
    by_game.sort(key=lambda x: (-x["rooms"], x["title"]))

    days = []
    for i in range(13, -1, -1):
        d = (datetime.now(tz=MSK) - timedelta(days=i)).strftime("%Y-%m-%d")
        days.append({
            "date": d,
            "visits": _get_int(store, f"stats:day:{d}:visits"),
            "uniques": _get_int(store, f"stats:day:{d}:uniques"),
            "rooms": _get_int(store, f"stats:day:{d}:rooms"),
            "joins": _get_int(store, f"stats:day:{d}:joins"),
            "finished": _get_int(store, f"stats:day:{d}:finished"),
        })

    try:
        active = int(active_rooms())
    except Exception:
        active = 0

    return {
        "ok": True,
        "updated_at": int(time.time()),
        "today": today,
        "totals": {
            "visits": _get_int(store, "stats:total:visits"),
            "uniques": _get_int(store, "stats:total:uniques"),
            "rooms": _get_int(store, "stats:total:rooms"),
            "joins": _get_int(store, "stats:total:joins"),
            "finished": _get_int(store, "stats:total:finished"),
            "active_rooms": active,
        },
        "modes": {
            "ai": _get_int(store, "stats:mode:ai"),
            "local": _get_int(store, "stats:mode:local"),
            "online": _get_int(store, "stats:mode:online"),
        },
        "games": by_game,
        "days": days,
    }
