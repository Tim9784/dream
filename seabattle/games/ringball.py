"""Кольцо — соло-игра: крути кольцо с отверстием, лови шарик."""
from __future__ import annotations

from typing import Any


def init_state(options: dict[str, Any] | None = None) -> dict[str, Any]:
    options = options or {}
    try:
        best = max(0, int(options.get("best") or 0))
    except (TypeError, ValueError):
        best = 0
    return {
        "score": 0,
        "best": best,
        "speed_level": 1,
    }


def rematch_options(room: dict[str, Any]) -> dict[str, Any]:
    st = room.get("state") or {}
    try:
        best = max(0, int(st.get("best") or 0), int(st.get("score") or 0))
    except (TypeError, ValueError):
        best = 0
    return {"best": best}


def on_both_joined(room: dict[str, Any]) -> None:
    room["phase"] = "playing"
    room["turn"] = "p1"
    room["winner"] = None
    room["loser"] = None
    room["result"] = None
    room["message"] = "Крути кольцо — шарик должен выпасть в отверстие"
    st = room.setdefault("state", init_state())
    st["score"] = 0
    st["speed_level"] = 1
    try:
        st["best"] = max(0, int(st.get("best") or 0))
    except (TypeError, ValueError):
        st["best"] = 0


def apply_action(room: dict[str, Any], slot: str, action: dict[str, Any]) -> tuple[bool, str]:
    if slot != "p1":
        return False, "Только один игрок"
    typ = str(action.get("type") or "")
    st = room.setdefault("state", init_state())

    if typ == "score":
        if room.get("phase") != "playing":
            return False, "Игра не идёт"
        try:
            reported = int(action.get("score"))
        except (TypeError, ValueError):
            reported = int(st.get("score") or 0) + 1
        cur = int(st.get("score") or 0)
        # клиент шлёт итоговый счёт; принимаем только рост на 1 (или текущий+1)
        if reported < cur:
            return False, "Счёт не может уменьшаться"
        if reported > cur + 1:
            reported = cur + 1
        if reported == cur:
            reported = cur + 1
        st["score"] = reported
        st["speed_level"] = 1 + reported // 3
        if reported > int(st.get("best") or 0):
            st["best"] = reported
        room["message"] = f"Счёт: {reported}"
        return True, "ok"

    if typ == "miss":
        if room.get("phase") != "playing":
            return False, "Игра не идёт"
        try:
            reported = int(action.get("score"))
        except (TypeError, ValueError):
            reported = int(st.get("score") or 0)
        reported = max(0, min(reported, int(st.get("score") or 0) + 1))
        if reported > int(st.get("score") or 0):
            st["score"] = reported
        score = int(st.get("score") or 0)
        if score > int(st.get("best") or 0):
            st["best"] = score
        room["phase"] = "done"
        room["turn"] = None
        room["winner"] = None
        room["loser"] = "p1"
        room["result"] = "miss"
        room["message"] = f"Мимо! Счёт: {score}"
        return True, "ok"

    return False, "Неизвестное действие"


def public_view(room: dict[str, Any], viewer: str | None) -> dict[str, Any]:
    st = room.get("state") or {}
    return {
        "score": int(st.get("score") or 0),
        "best": int(st.get("best") or 0),
        "speed_level": int(st.get("speed_level") or 1),
        "solo": True,
    }
