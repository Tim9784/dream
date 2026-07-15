"""Общая оценка шанса победы (0–100)."""
from __future__ import annotations

import math
from typing import Any


def clamp_chance(p: float) -> int:
    return int(max(1, min(99, round(p))))


def score_to_chance(score: float, scale: float = 1.0) -> int:
    """Сигмоида: score>0 → выше 50%."""
    s = float(scale) if scale else 1.0
    x = max(-12.0, min(12.0, score / s))
    p = 100.0 / (1.0 + math.exp(-x))
    return clamp_chance(p)


def done_chance(room: dict[str, Any], slot: str) -> int | None:
    if room.get("phase") != "done":
        return None
    if room.get("result") == "draw":
        return 50
    if room.get("loser") == slot:
        return 0
    winners = room.get("winners")
    if winners and slot in winners:
        return 100
    w = room.get("winner")
    if w == slot:
        return 100
    if w is None and not room.get("loser"):
        return 50
    return 0
