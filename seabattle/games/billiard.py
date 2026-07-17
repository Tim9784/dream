"""Бильярд (пул) — удар с траекторией и силой, игра на двоих."""
from __future__ import annotations

import math
import random
from typing import Any

TABLE_W = 2.0
TABLE_H = 1.0
BALL_R = 0.0285
# лузы чуть шире шара; борта обрываются у «рта» лузы
POCKET_R = 0.052
POCKET_MOUTH = 0.062
SIDE_MOUTH = 0.070

# физика: скорость в единицах стола / сек
MAX_SPEED = 2.6
MIN_SPEED = 0.012
FRICTION = 1.15          # линейное замедление |v|/s
SPIN_DRAG = 0.08         # лёгкое доп. трение
RESTITUTION = 0.93
CUSHION_REST = 0.78
CUSHION_FRICTION = 0.35  # гасит касательную у борта
DT = 1.0 / 200.0
MAX_TIME = 14.0
COLLISION_ITERS = 6
FRAME_DT = 1.0 / 28.0
MAX_FRAMES = 90

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


def _near_pocket_gap_x(x: float, side: bool = False) -> bool:
    """Точка у отверстия лузы на горизонтальном борту."""
    mouth = SIDE_MOUTH if side else POCKET_MOUTH
    if x <= mouth or x >= TABLE_W - mouth:
        return True
    mid = TABLE_W / 2
    return abs(x - mid) <= mouth


def _near_pocket_gap_y(y: float) -> bool:
    """Точка у отверстия лузы на вертикальном борту."""
    return y <= POCKET_MOUTH or y >= TABLE_H - POCKET_MOUTH


def _rack() -> list[dict[str, Any]]:
    balls: list[dict[str, Any]] = []
    balls.append({
        "id": 0,
        "x": TABLE_W * 0.25,
        "y": TABLE_H * 0.5,
        "vx": 0.0,
        "vy": 0.0,
        "pocketed": False,
    })
    apex_x = TABLE_W * 0.72
    apex_y = TABLE_H * 0.5
    # классическая пирамида: 8 в центре, углы — разнотипные
    order = [1, 9, 12, 6, 8, 14, 3, 10, 15, 4, 7, 11, 2, 13, 5]
    gap = BALL_R * 2.002
    row_dx = gap * math.cos(math.radians(30))
    idx = 0
    for row in range(5):
        for col in range(row + 1):
            bid = order[idx]
            idx += 1
            x = apex_x + row * row_dx
            y = apex_y + (col - row / 2) * gap
            balls.append({
                "id": bid,
                "x": x,
                "y": y,
                "vx": 0.0,
                "vy": 0.0,
                "pocketed": False,
            })
    # слегка «утрясти» пирамиду, чтобы не было микровложений
    for _ in range(12):
        for i in range(1, len(balls)):
            for j in range(i + 1, len(balls)):
                _separate(balls[i], balls[j])
    return balls


def init_state(options: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "phase": "break",
        "balls": _rack(),
        "pockets": [{"x": p[0], "y": p[1]} for p in _pockets()],
        "table": {"w": TABLE_W, "h": TABLE_H, "r": BALL_R},
        "scores": {"p1": 0, "p2": 0},
        "groups": {"p1": None, "p2": None},
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
    for _ in range(100):
        x = random.uniform(BALL_R * 1.4, TABLE_W * 0.45)
        y = random.uniform(BALL_R * 1.4, TABLE_H - BALL_R * 1.4)
        cue["x"], cue["y"] = x, y
        if all(_dist(cue, b) >= BALL_R * 2.08 for b in _alive(st["balls"]) if b["id"] != 0):
            if not _pocket_check(cue):
                return
    cue["x"], cue["y"] = TABLE_W * 0.25, TABLE_H * 0.5


def _pocket_check(ball: dict[str, Any]) -> bool:
    # чуть легче падать в угол / бок, если шар уже у края
    for px, py in _pockets():
        pr = POCKET_R
        if abs(px - TABLE_W / 2) < 1e-9:
            pr = POCKET_R * 1.05
        if math.hypot(ball["x"] - px, ball["y"] - py) <= pr:
            return True
    return False


def _clamp_speed(ball: dict[str, Any]) -> None:
    sp = math.hypot(ball["vx"], ball["vy"])
    if sp > MAX_SPEED:
        k = MAX_SPEED / sp
        ball["vx"] *= k
        ball["vy"] *= k


def _apply_friction(ball: dict[str, Any], dt: float) -> None:
    sp = math.hypot(ball["vx"], ball["vy"])
    if sp < MIN_SPEED:
        ball["vx"] = ball["vy"] = 0.0
        return
    # линейное трение сукна + лёгкий drag
    decel = FRICTION + SPIN_DRAG * sp
    new_sp = sp - decel * dt
    if new_sp <= MIN_SPEED:
        ball["vx"] = ball["vy"] = 0.0
        return
    k = new_sp / sp
    ball["vx"] *= k
    ball["vy"] *= k


def _cushion(ball: dict[str, Any]) -> None:
    """Отскок от бортов с проёмами луз — шар не «проходит сквозь» дерево."""
    r = BALL_R
    x, y = ball["x"], ball["y"]

    # левый борт
    if x < r and not _near_pocket_gap_y(y):
        ball["x"] = r
        if ball["vx"] < 0:
            ball["vx"] = -ball["vx"] * CUSHION_REST
            ball["vy"] *= (1.0 - CUSHION_FRICTION)
    # правый
    elif x > TABLE_W - r and not _near_pocket_gap_y(y):
        ball["x"] = TABLE_W - r
        if ball["vx"] > 0:
            ball["vx"] = -ball["vx"] * CUSHION_REST
            ball["vy"] *= (1.0 - CUSHION_FRICTION)

    x, y = ball["x"], ball["y"]
    # нижний
    if y < r and not _near_pocket_gap_x(x, side=True):
        ball["y"] = r
        if ball["vy"] < 0:
            ball["vy"] = -ball["vy"] * CUSHION_REST
            ball["vx"] *= (1.0 - CUSHION_FRICTION)
    # верхний
    elif y > TABLE_H - r and not _near_pocket_gap_x(x, side=True):
        ball["y"] = TABLE_H - r
        if ball["vy"] > 0:
            ball["vy"] = -ball["vy"] * CUSHION_REST
            ball["vx"] *= (1.0 - CUSHION_FRICTION)

    # если вылетели за стол вне лузы — мягко вернуть
    if not _pocket_check(ball):
        ball["x"] = min(max(ball["x"], r * 0.15), TABLE_W - r * 0.15)
        ball["y"] = min(max(ball["y"], r * 0.15), TABLE_H - r * 0.15)


def _separate(a: dict[str, Any], b: dict[str, Any]) -> bool:
    if a.get("pocketed") or b.get("pocketed"):
        return False
    dx = b["x"] - a["x"]
    dy = b["y"] - a["y"]
    dist = math.hypot(dx, dy)
    min_d = BALL_R * 2
    if dist >= min_d - 1e-12:
        return False
    if dist < 1e-12:
        # совпали центры — толкнуть в случайном направлении
        ang = random.random() * math.tau
        dx, dy = math.cos(ang), math.sin(ang)
        dist = 1e-12
    nx, ny = dx / dist, dy / dist
    overlap = min_d - dist
    push = overlap * 0.5 + 1e-5
    a["x"] -= nx * push
    a["y"] -= ny * push
    b["x"] += nx * push
    b["y"] += ny * push
    return True


def _collide(a: dict[str, Any], b: dict[str, Any]) -> bool:
    """Упругий удар равных масс + позиционная коррекция."""
    if a.get("pocketed") or b.get("pocketed"):
        return False
    dx = b["x"] - a["x"]
    dy = b["y"] - a["y"]
    dist = math.hypot(dx, dy)
    min_d = BALL_R * 2
    if dist >= min_d - 1e-12:
        return False
    if dist < 1e-12:
        ang = random.random() * math.tau
        dx, dy = math.cos(ang), math.sin(ang)
        dist = 1e-12
    nx, ny = dx / dist, dy / dist
    overlap = min_d - dist
    push = overlap * 0.5 + 1e-5
    a["x"] -= nx * push
    a["y"] -= ny * push
    b["x"] += nx * push
    b["y"] += ny * push

    # vn > 0 — сближаются вдоль нормали a→b
    dvx = a["vx"] - b["vx"]
    dvy = a["vy"] - b["vy"]
    vn = dvx * nx + dvy * ny
    if vn <= 0:
        return True
    impulse = -(1.0 + RESTITUTION) * vn / 2.0
    tx, ty = -ny, nx
    vt = dvx * tx + dvy * ty
    friction_imp = max(-abs(impulse) * 0.12, min(abs(impulse) * 0.12, -vt * 0.08))
    a["vx"] += impulse * nx + friction_imp * tx
    a["vy"] += impulse * ny + friction_imp * ty
    b["vx"] -= impulse * nx + friction_imp * tx
    b["vy"] -= impulse * ny + friction_imp * ty
    _clamp_speed(a)
    _clamp_speed(b)
    return True


def _resolve_overlaps(balls: list[dict[str, Any]]) -> None:
    """Только позиционная коррекция — без лишних импульсов."""
    alive = _alive(balls)
    for _ in range(COLLISION_ITERS):
        moved = False
        for i in range(len(alive)):
            for j in range(i + 1, len(alive)):
                if _separate(alive[i], alive[j]):
                    moved = True
        for b in alive:
            _cushion(b)
        if not moved:
            break


def _snapshot(balls: list[dict[str, Any]]) -> list[list[float | int | None]]:
    out = []
    for b in balls:
        if b["pocketed"]:
            out.append([None, None, 1])
        else:
            out.append([round(b["x"], 4), round(b["y"], 4), 0])
    return out


def _any_moving(balls: list[dict[str, Any]]) -> bool:
    for b in _alive(balls):
        if abs(b["vx"]) > MIN_SPEED or abs(b["vy"]) > MIN_SPEED:
            return True
    return False


def _simulate(st: dict[str, Any], angle: float, power: float) -> dict[str, Any]:
    balls = st["balls"]
    cue = _cue(st)
    if cue["pocketed"]:
        _place_cue_safe(st)

    # перед ударом убрать микровложения в пирамиде
    _resolve_overlaps(balls)

    power = max(0.08, min(1.0, power))
    # кривая силы: слабые удары точнее, разбой — мощнее
    speed = (0.18 + 0.82 * (power ** 1.15)) * MAX_SPEED
    cue["vx"] = math.cos(angle) * speed
    cue["vy"] = math.sin(angle) * speed

    frames: list[list[list[float | int | None]]] = [_snapshot(balls)]
    pocketed_now: list[int] = []
    first_hit: int | None = None
    acc_frame = 0.0
    t = 0.0

    while t < MAX_TIME and _any_moving(balls):
        # адаптивный подшаг: быстрые шары — мельче dt
        max_sp = 0.0
        for b in _alive(balls):
            max_sp = max(max_sp, math.hypot(b["vx"], b["vy"]))
        step = DT
        if max_sp > 0:
            # не больше ~35% диаметра за шаг
            step = min(DT, (BALL_R * 0.7) / max_sp)
        step = max(step, DT * 0.25)

        for b in _alive(balls):
            b["x"] += b["vx"] * step
            b["y"] += b["vy"] * step
            _apply_friction(b, step)
            _cushion(b)

        # коллизии шар–шар + повторная коррекция бортов
        alive = _alive(balls)
        for i in range(len(alive)):
            for j in range(i + 1, len(alive)):
                ai, aj = alive[i], alive[j]
                touching = _dist(ai, aj) <= BALL_R * 2.02
                if touching and first_hit is None and (ai["id"] == 0 or aj["id"] == 0):
                    other = aj if ai["id"] == 0 else ai
                    first_hit = other["id"]
                _collide(ai, aj)
        for b in alive:
            _cushion(b)
        # второй проход — убрать остаточные пересечения
        _resolve_overlaps(balls)

        for b in list(_alive(balls)):
            if _pocket_check(b):
                b["pocketed"] = True
                b["vx"] = b["vy"] = 0.0
                pocketed_now.append(b["id"])

        t += step
        acc_frame += step
        if acc_frame >= FRAME_DT:
            acc_frame = 0.0
            frames.append(_snapshot(balls))
            if len(frames) >= MAX_FRAMES:
                frames = frames[::2][: MAX_FRAMES]

    # добить остаточные пересечения и стоп
    for b in _alive(balls):
        b["vx"] = b["vy"] = 0.0
    _resolve_overlaps(balls)
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

    if eight["pocketed"]:
        own_left = _remaining(st, slot)
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

        if good and not scratch and not foul_other:
            room["turn"] = slot
            room["message"] = f"{room['players'][slot]['name']} забил — ход продолжается"
            st["ball_in_hand"] = False
            return

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
        if any(_dist(cue, b) < BALL_R * 2.08 for b in _alive(st["balls"]) if b["id"] != 0):
            return False, "Слишком близко к другому шару"
        if _pocket_check(cue):
            return False, "Нельзя ставить биток в лузу"
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
    angle += random.uniform(-0.06, 0.06)
    power = random.uniform(0.4, 0.8)
    return {"type": "shot", "angle": angle, "power": power}
