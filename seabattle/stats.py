"""Метрика сайта: визиты/уники с фильтрацией ботов и повторных обновлений."""
from __future__ import annotations

import hashlib
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Mapping, Optional

MSK = timezone(timedelta(hours=3))
DAY_TTL = 60 * 60 * 24 * 45  # дневные ключи ~45 суток
# сессия визита: повторные открытия/F5 в окне не считаем новым визитом
VISIT_SESSION_SEC = 30 * 60

# типичные боты, превью мессенджеров, мониторы
_BOT_RE = re.compile(
    r"("
    r"bot|crawl|spider|slurp|fetch|monitor|check|scan|preview|"
    r"telegram|telegrambot|facebookexternalhit|facebot|twitterbot|"
    r"slackbot|discordbot|whatsapp|viber|vkshare|okhttp|"
    r"curl|wget|python-requests|httpclient|go-http|java/|"
    r"headless|phantom|selenium|lighthouse|pagespeed|"
    r"yandex(?:\.com)?/bots|googlebot|bingbot|baiduspider|duckduckbot|"
    r"semrush|ahrefs|mj12bot|dotbot|petalbot|bytespider|"
    r"uptimerobot|pingdom|statuscake|prerender"
    r")",
    re.I,
)


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


def _header(headers: Mapping[str, str] | None, name: str) -> str:
    if not headers:
        return ""
    try:
        return str(headers.get(name) or headers.get(name.lower()) or "")
    except Exception:
        return ""


def is_real_browser_hit(
    *,
    method: str = "GET",
    user_agent: str = "",
    headers: Mapping[str, str] | None = None,
) -> bool:
    """True только для похожего на человека захода в браузере."""
    if str(method or "GET").upper() != "GET":
        return False

    ua = (user_agent or "").strip()
    if len(ua) < 20:
        return False
    if _BOT_RE.search(ua):
        return False
    # у нормального браузера почти всегда есть Mozilla/ или похожий клиент
    ua_l = ua.lower()
    if not any(x in ua_l for x in ("mozilla", "applewebkit", "chrome", "safari", "firefox", "opr/", "edg/")):
        return False

    purpose = _header(headers, "Purpose").lower()
    sec_purpose = _header(headers, "Sec-Purpose").lower()
    if purpose == "prefetch" or "prefetch" in sec_purpose or "preview" in purpose:
        return False

    # если браузер прислал Sec-Fetch — принимаем только обычное открытие документа
    dest = _header(headers, "Sec-Fetch-Dest").lower()
    mode = _header(headers, "Sec-Fetch-Mode").lower()
    if dest or mode:
        if dest and dest != "document":
            return False
        if mode and mode not in ("navigate", "nested-navigate"):
            return False

    accept = _header(headers, "Accept").lower()
    if accept and "text/html" not in accept and "*/*" not in accept:
        return False

    return True


def _visitor_hash(ip: str, user_agent: str = "") -> str:
    raw = f"{ip or '?'}|{(user_agent or '')[:180]}"
    return hashlib.sha256(raw.encode("utf-8", errors="ignore")).hexdigest()[:16]


def track_visit(
    store: Any,
    ip: str,
    *,
    user_agent: str = "",
    method: str = "GET",
    headers: Mapping[str, str] | None = None,
) -> bool:
    """
    Учитывает визит, если это похоже на реального человека.
    Возвращает True, если визит записан.
    — боты / превью / curl отбрасываются
    — повтор в течение 30 минут с того же IP+UA не считается новым визитом
    — уник: 1 раз в сутки на IP+UA
    """
    if not is_real_browser_hit(method=method, user_agent=user_agent, headers=headers):
        return False

    day = _day()
    vid = _visitor_hash(ip, user_agent)

    # анти-F5 / возврат на главную в рамках сессии
    sess_key = f"stats:sess:{vid}"
    try:
        if store.exists(sess_key):
            return False
        store.setex(sess_key, VISIT_SESSION_SEC, "1")
    except Exception:
        # если store недоступен для сессии — лучше не накручивать
        return False

    _incr(store, "stats:total:visits")
    _incr(store, f"stats:day:{day}:visits", DAY_TTL)

    uv_key = f"stats:uv:{day}:{vid}"
    try:
        if not store.exists(uv_key):
            store.setex(uv_key, DAY_TTL, "1")
            _incr(store, "stats:total:uniques")
            _incr(store, f"stats:day:{day}:uniques", DAY_TTL)
    except Exception:
        pass
    return True


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
        "filter": {
            "bots": True,
            "prefetch": True,
            "session_minutes": VISIT_SESSION_SEC // 60,
            "note": "Визиты: без ботов/превью, не чаще 1 раза за 30 мин на IP+браузер. Уники: 1 раз в сутки.",
        },
    }
