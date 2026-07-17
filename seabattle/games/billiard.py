"""Бильярд (пул) — удар с траекторией и силой, игра на двоих."""
from __future__ import annotations

import math
import random
from typing import Any

TABLE_W = 2.0
TABLE_H = 1.0
BALL_R = 0.029
POCKET_R = 0.055
FRICTION = 0.992
MIN_SPEED = 0.0008
MAX_SPEED = 0.085
RESTITUTION = 0.96
CUSHION_REST = 0.90
MAX_STEPS = 2400
FRAME_EVERY = 4
MAX_FRAMES = 100

# цвета шаров: 0 биток, 1–7 сплошные, 8 чёрный, 9–15 полосатые
BALL_COLORS = {
    0: "#f8fafc",
    1: "#f59e0b",
    2: "#2563eb",
    3: "#dc2626",
    4: "#7c3aed",
    5: "#ea580c",
    6: "#16a34a",
    7: "#7f1d1d",
    8: "#111827",
    9: "#f59e0b",
    10: "#2563eb",
    11: "#dc2626",
    12: "#7c3aed",
    13: "#ea580c",
    14: "#16a34a",
    15: "#7f1d1d",
}


def _pockets() -> list[tuple[float, float]]:
    return [
        (0.0, 0.0),
        (TABLE_W / 2, 0.0),
        (TABLE_W, 0.0),
        (0.0, TABLE_H),
        (TABLE_W / 2, TABLE_H),
        (TABLE_W, TABLE_H),
    ]


def _rack() -> list[dict[str, Any]]:
    balls: list[dict[str, Any]] = []
    # биток
    balls.append({"id": 0, "x": TABLE_W * 0.25, "y": TABLE_H * 0.5, "vx": 0.0, "vy": 0.0, "pocketed": False})
    # треугольник справа
    apex_x = TABLE_W * 0.72
    apex_y = TABLE_H * 0.5
    order = [1, 9, 2, 10, 8, 11, 3, 12, 4, 13, 5, 14, 6, 15, 7]
    idx = 0
    gap = BALL_R * 2.05
    for row in range(5):
        for col in range(row + 1):
            if idx >= len(order):
                break
            bid = order[idx]
            idx += 1
            x = apex_x + row * gap * math.cos(math.radians(30))
            y = apex_y + (col - row / 2) * gap
            balls.append({"id": bid, "x": x, "y": y, "vx": 0.0, "vy": 0.0, "pocketed": False})
    return balls


def init_state(options: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "phase": "break",
        "balls": _rack(),
        "pockets": [{"x": p[0], "y": p[1]} for p in _pockets()],
        "table": {"w": TABLE_W, "h": TABLE_H, "r": BALL_R},
        "scores": {"p1": 0, "p2": 0},
        "groups": {"p1": None, "p2": None},  # "solid" | "stripe"
        "last_pocketed": [],
        "scratch": False,
        "frames": [],
        "animating": False,
        "ball_in_hand": False,
        "colors": BALL_COLORS,
        "winner_reason": None,
    }


def on_both_joined(room: dict[str, Any]) -> None:
    room["phase"] = "playing"
    room["turn"] = "p1"
    room["message"] = f"Разбивает {room['players']['p1']['name']} — целься и бей"
    room["state"]["phase"] = "break"


def _alive(balls: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [b for b in balls if not b["pocketed"]]


def _dist(a: dict[str, Any], b: dict[str, Any]) -> float:
    return math.hypot(a["x"] - b["x"], a["y"] - b["y"])


def _group_of(ball_id: int) -> str | None:
    if 1 <= ball_id <= 7:
        return "solid"
    if 9 <= ball_id <= 15:
        return "stripe"
    return None


def _assign_groups(st: dict[str, Any], pocketed_ids: list[int], shooter: str) -> None:
    if st["groups"]["p1"] or st["groups"]["p2"]:
        return
    for bid in pocketed_ids:
        g = _group_of(bid)
        if not g:
            continue
        opp = "p2" if shooter == "p1" else "p1"
        st["groups"][shooter] = g
        st["groups"][opp] = "stripe" if g == "solid" else "solid"
        return


def _remaining(st: dict[str, Any], slot: str) -> int:
    g = st["groups"].get(slot)
    balls = st["balls"]
    if not g:
        # до назначения — любые цветные кроме 8
        return sum(1 for b in balls if not b["pocketed"] and b["id"] not in (0, 8))
    if g == "solid":
        return sum(1 for b in balls if not b["pocketed"] and 1 <= b["id"] <= 7)
    return sum(1 for b in balls if not b["pocketed"] and 9 <= b["id"] <= 15)


def _eight(st: dict[str, Any]) -> dict[str, Any]:
    return next(b for b in st["balls"] if b["id"] == 8)


def _cue(st: dict[str, Any]) -> dict[str, Any]:
    return next(b for b in st["balls"] if b["id"] == 0)


def _place_cue_safe(st: dict[str, Any]) -> None:
    cue = _cue(st)
    cue["pocketed"] = False
    cue["vx"] = cue["vy"] = 0.0
    for _ in range(80):
        x = random.uniform(BALL_R * 1.2, TABLE_W * 0.4)
        y = random.uniform(BALL_R * 1.2, TABLE_H - BALL_R * 1.2)
        cue["x"], cue["y"] = x, y
        if all(_dist(cue, b) >= BALL_R * 2.05 for b in _alive(st["balls"]) if b["id"] != 0):
            return
    cue["x"], cue["y"] = TABLE_W * 0.25, TABLE_H * 0.5


def _pocket_check(ball: dict[str, Any]) -> bool:
    for px, py in _pockets():
        if math.hypot(ball["x"] - px, ball["y"] - py) <= POCKET_R:
            return True
    return False


def _cushion(ball: dict[str, Any]) -> None:
    r = BALL_R
    if ball["x"] < r:
        ball["x"] = r
        ball["vx"] = abs(ball["vx"]) * CUSHION_REST
    elif ball["x"] > TABLE_W - r:
        ball["x"] = TABLE_W - r
        ball["vx"] = -abs(ball["vx"]) * CUSHION_REST
    if ball["y"] < r:
        ball["y"] = r
        ball["vy"] = abs(ball["vy"]) * CUSHION_REST
    elif ball["y"] > TABLE_H - r:
        ball["y"] = TABLE_H - r
        ball["vy"] = -abs(ball["vy"]) * CUSHION_REST


def _collide(a: dict[str, Any], b: dict[str, Any]) -> None:
    dx = b["x"] - a["x"]
    dy = b["y"] - a["y"]
    dist = math.hypot(dx, dy) or 1e-9
    min_d = BALL_R * 2
    if dist >= min_d:
        return
    nx, ny = dx / dist, dy / dist
    # развести
    overlap = min_d - dist
    a["x"] -= nx * overlap * 0.5
    a["y"] -= ny * overlap * 0.5
    b["x"] += nx * overlap * 0.5
    b["y"] += ny * overlap * 0.5
    dvx = a["vx"] - b["vx"]
    dvy = a["vy"] - b["vy"]
    vn = dvx * nx + dvy * ny
    if vn > 0:
        return
    impulse = -(1 + RESTITUTION) * vn / 2
    a["vx"] += impulse * nx
    a["vy"] += impulse * ny
    b["vx"] -= impulse * nx
    b["vy"] -= impulse * ny


def _snapshot(balls: list[dict[str, Any]]) -> list[list[float | int | None]]:
    out = []
    for b in balls:
        if b["pocketed"]:
            out.append([None, None, 1])
        else:
            out.append([round(b["x"], 4), round(b["y"], 4), 0])
    return out


def _simulate(st: dict[str, Any], angle: float, power: float) -> dict[str, Any]:
    balls = st["balls"]
    cue = _cue(st)
    if cue["pocketed"]:
        _place_cue_safe(st)
    speed = max(0.02, min(1.0, power)) * MAX_SPEED
    cue["vx"] = math.cos(angle) * speed
    cue["vy"] = math.sin(angle) * speed

    frames: list[list[list[float | int | None]]] = [_snapshot(balls)]
    pocketed_now: list[int] = []
    first_hit: int | None = None

    for step in range(MAX_STEPS):
        moving = False
        for b in _alive(balls):
            if abs(b["vx"]) > MIN_SPEED or abs(b["vy"]) > MIN_SPEED:
                moving = True
                b["x"] += b["vx"]
                b["y"] += b["vy"]
                b["vx"] *= FRICTION
                b["vy"] *= FRICTION
                if abs(b["vx"]) < MIN_SPEED:
                    b["vx"] = 0.0
                if abs(b["vy"]) < MIN_SPEED:
                    b["vy"] = 0.0
                _cushion(b)

        alive = _alive(balls)
        for i in range(len(alive)):
            for j in range(i + 1, len(alive)):
                if first_hit is None and (alive[i]["id"] == 0 or alive[j]["id"] == 0):
                    other = alive[j] if alive[i]["id"] == 0 else alive[i]
                    # считаем касание только если сблизились
                    if _dist(alive[i], alive[j]) <= BALL_R * 2.02:
                        first_hit = other["id"]
                _collide(alive[i], alive[j])

        for b in list(_alive(balls)):
            if _pocket_check(b):
                b["pocketed"] = True
                b["vx"] = b["vy"] = 0.0
                pocketed_now.append(b["id"])

        if step % FRAME_EVERY == 0:
            frames.append(_snapshot(balls))
            if len(frames) >= MAX_FRAMES:
                # проредить
                frames = frames[::2][:MAX_FRAMES]

        if not moving:
            break

    # финальный кадр
    frames.append(_snapshot(balls))
    if len(frames) > MAX_FRAMES:
        step_i = max(1, len(frames) // MAX_FRAMES)
        frames = frames[::step_i][:MAX_FRAMES]

    return {"frames": frames, "pocketed": pocketed_now, "first_hit": first_hit}


def _resolve_shot(room: dict[str, Any], slot: str, result: dict[str, Any]) -> None:
    st = room["state"]
    pocketed = [i for i in result["pocketed"] if i != 0]
    scratch = 0 in result["pocketed"]
    st["last_pocketed"] = pocketed
    st["scratch"] = scratch
    st["frames"] = result["frames"]
    st["animating"] = False
    st["phase"] = "playing"

    eight = _eight(st)
    opp = "p2" if slot == "p1" else "p1"

    if scratch:
        _place_cue_safe(st)
        st["ball_in_hand"] = True

    # чёрный забит
    if eight["pocketed"]:
        own_left = _remaining(st, slot)
        # свои ещё на столе или фол битком → поражение
        if own_left > 0 or scratch or not st["groups"].get(slot):
            room["phase"] = "done"
            room["winner"] = opp
            room["turn"] = None
            room["message"] = f"Чёрный забит не вовремя — победа {room['players'][opp]['name']}"
            st["winner_reason"] = "eight_early"
            return
        room["phase"] = "done"
        room["winner"] = slot
        room["turn"] = None
        room["message"] = f"Чёрный в лузе! Победа {room['players'][slot]['name']}"
        st["winner_reason"] = "eight"
        return

    if pocketed:
        _assign_groups(st, pocketed, slot)
        g = st["groups"].get(slot)
        good = []
        foul_other = False
        for bid in pocketed:
            bg = _group_of(bid)
            if not g:
                good.append(bid)
            elif bg == g:
                good.append(bid)
            elif bg and bg != g:
                foul_other = True
        st["scores"][slot] = int(st["scores"].get(slot) or 0) + len(good)

        # продолжить ход если забил свои и не фол
        if good and not scratch and not foul_other:
            room["turn"] = slot
            room["message"] = f"{room['players'][slot]['name']} забил — ход продолжается"
            st["ball_in_hand"] = False
            return

    # смена хода
    room["turn"] = opp
    if scratch:
        room["message"] = f"Биток в лузе — ход {room['players'][opp]['name']}"
    else:
        room["message"] = f"Ход {room['players'][opp]['name']}"


def apply_action(room: dict[str, Any], slot: str, action: dict[str, Any]) -> tuple[bool, str]:
    if room["phase"] != "playing":
        return False, "Игра не идёт"
    if room["turn"] != slot:
        return False, "Сейчас ход соперника"
    st = room["state"]
    kind = str(action.get("type") or "")

    if kind == "place_cue":
        if not st.get("ball_in_hand"):
            return False, "Сейчас нельзя ставить биток"
        try:
            x = float(action["x"])
            y = float(action["y"])
        except (KeyError, TypeError, ValueError):
            return False, "Неверные координаты"
        x = max(BALL_R, min(TABLE_W - BALL_R, x))
        y = max(BALL_R, min(TABLE_H - BALL_R, y))
        cue = _cue(st)
        cue["x"], cue["y"] = x, y
        cue["pocketed"] = False
        cue["vx"] = cue["vy"] = 0.0
        if any(_dist(cue, b) < BALL_R * 2.05 for b in _alive(st["balls"]) if b["id"] != 0):
            return False, "Слишком близко к другому шару"
        st["ball_in_hand"] = False
        room["message"] = f"{room['players'][slot]['name']} поставил биток — можно бить"
        return True, "ok"

    if kind != "shot":
        return False, "Неизвестное действие"
    if st.get("ball_in_hand"):
        return False, "Сначала поставь биток"
    try:
        angle = float(action.get("angle"))
        power = float(action.get("power"))
    except (TypeError, ValueError):
        return False, "Нужны угол и сила"
    power = max(0.08, min(1.0, power))
    st["frames"] = []
    result = _simulate(st, angle, power)
    _resolve_shot(room, slot, result)
    return True, "ok"


def public_view(room: dict[str, Any], viewer: str | None) -> dict[str, Any]:
    st = room["state"]
    balls_out = []
    for b in st["balls"]:
        balls_out.append({
            "id": b["id"],
            "x": None if b["pocketed"] else round(b["x"], 4),
            "y": None if b["pocketed"] else round(b["y"], 4),
            "pocketed": bool(b["pocketed"]),
            "color": BALL_COLORS.get(b["id"], "#999"),
            "stripe": 9 <= b["id"] <= 15,
            "eight": b["id"] == 8,
            "cue": b["id"] == 0,
        })
    return {
        "phase": st.get("phase"),
        "balls": balls_out,
        "pockets": st["pockets"],
        "table": st["table"],
        "scores": st["scores"],
        "groups": st["groups"],
        "frames": st.get("frames") or [],
        "last_pocketed": st.get("last_pocketed") or [],
        "scratch": bool(st.get("scratch")),
        "ball_in_hand": bool(st.get("ball_in_hand")),
        "colors": BALL_COLORS,
    }


def win_chance(room: dict[str, Any], slot: str) -> int:
    from .chance import clamp_chance, done_chance

    done = done_chance(room, slot)
    if done is not None:
        return done
    st = room["state"]
    me = _remaining(st, slot)
    opp = _remaining(st, "p2" if slot == "p1" else "p1")
    if me + opp <= 0:
        return 50
    return clamp_chance(int(50 + (opp - me) * 6))


def ai_action(room: dict[str, Any], slot: str) -> dict[str, Any] | None:
    st = room["state"]
    if st.get("ball_in_hand"):
        _place_cue_safe(st)
        st["ball_in_hand"] = False
        return {"type": "place_cue", "x": _cue(st)["x"], "y": _cue(st)["y"]}
    cue = _cue(st)
    if cue["pocketed"]:
        return None
    g = st["groups"].get(slot)
    targets = []
    for b in _alive(st["balls"]):
        if b["id"] == 0:
            continue
        if b["id"] == 8:
            if _remaining(st, slot) == 0 and g:
                targets.append(b)
            continue
        bg = _group_of(b["id"])
        if not g or bg == g:
            targets.append(b)
    if not targets:
        targets = [b for b in _alive(st["balls"]) if b["id"] not in (0, 8)]
    if not targets:
        targets = [b for b in _alive(st["balls"]) if b["id"] == 8]
    if not targets:
        return None
    t = min(targets, key=lambda b: math.hypot(b["x"] - cue["x"], b["y"] - cue["y"]))
    angle = math.atan2(t["y"] - cue["y"], t["x"] - cue["x"])
    angle += random.uniform(-0.08, 0.08)
    power = random.uniform(0.45, 0.85)
    return {"type": "shot", "angle": angle, "power": power}
