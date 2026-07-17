"""Бильярд (пул 8-ball) — детерминированная физика, мультиплеер."""
from __future__ import annotations

import math
import random
from typing import Any

TABLE_W = 2.0
TABLE_H = 1.0
BALL_R = 0.0285
POCKET_R = 0.054
POCKET_MOUTH = 0.068
SIDE_MOUTH = 0.074

# Скорость в единицах стола / сек. Сервер 8 CPU — считаем плотно.
MAX_SPEED = 3.4
MIN_SPEED = 0.008
SLEEP_SPEED = 0.015
FRICTION = 0.72          # замедление сукна |v|/s (слабее → живой разбой)
RESTITUTION = 0.98       # шар–шар
CUSHION_REST = 0.82
CUSHION_FRICTION = 0.22
SLOP = 0.00012           # допуск касания без коррекции
BAUMGARTE = 0.22         # доля overlap за шаг при разведении
DT = 1.0 / 480.0         # мелкий шаг — нет tunneling
MAX_TIME = 16.0
SOLVER_ITERS = 4
FRAME_DT = 1.0 / 40.0
MAX_FRAMES = 140

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


def _gap_x(x: float) -> bool:
    if x <= POCKET_MOUTH or x >= TABLE_W - POCKET_MOUTH:
        return True
    return abs(x - TABLE_W / 2) <= SIDE_MOUTH


def _gap_y(y: float) -> bool:
    return y <= POCKET_MOUTH or y >= TABLE_H - POCKET_MOUTH


def _rack() -> list[dict[str, Any]]:
    """Плотная пирамида: шары касаются (2R), без рандомной утряски."""
    balls: list[dict[str, Any]] = [{
        "id": 0,
        "x": TABLE_W * 0.25,
        "y": TABLE_H * 0.5,
        "vx": 0.0,
        "vy": 0.0,
        "pocketed": False,
        "sleep": True,
    }]
    apex_x = TABLE_W * 0.70
    apex_y = TABLE_H * 0.5
    # 8 в центре, углы разнотипные
    order = [1, 14, 3, 9, 8, 11, 6, 12, 5, 15, 10, 7, 2, 13, 4]
    gap = BALL_R * 2.0
    row_dx = gap * math.sqrt(3) / 2.0
    idx = 0
    for row in range(5):
        for col in range(row + 1):
            bid = order[idx]
            idx += 1
            balls.append({
                "id": bid,
                "x": apex_x + row * row_dx,
                "y": apex_y + (col - row / 2.0) * gap,
                "vx": 0.0,
                "vy": 0.0,
                "pocketed": False,
                "sleep": True,
            })
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
        "shot_id": 0,
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


def _speed(b: dict[str, Any]) -> float:
    return math.hypot(b["vx"], b["vy"])


def _wake(b: dict[str, Any]) -> None:
    b["sleep"] = False


def _maybe_sleep(b: dict[str, Any]) -> None:
    if _speed(b) < SLEEP_SPEED:
        b["vx"] = b["vy"] = 0.0
        b["sleep"] = True


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
    cue["sleep"] = True
    for _ in range(120):
        x = random.uniform(BALL_R * 1.5, TABLE_W * 0.42)
        y = random.uniform(BALL_R * 1.5, TABLE_H - BALL_R * 1.5)
        cue["x"], cue["y"] = x, y
        if _pocket_check(cue):
            continue
        if all(_dist(cue, b) >= BALL_R * 2.1 for b in _alive(st["balls"]) if b["id"] != 0):
            return
    cue["x"], cue["y"] = TABLE_W * 0.25, TABLE_H * 0.5


def _pocket_check(ball: dict[str, Any]) -> bool:
    for px, py in _pockets():
        pr = POCKET_R * (1.06 if abs(px - TABLE_W / 2) < 1e-9 else 1.0)
        if math.hypot(ball["x"] - px, ball["y"] - py) <= pr:
            return True
    return False


def _clamp_speed(ball: dict[str, Any]) -> None:
    sp = _speed(ball)
    if sp > MAX_SPEED:
        k = MAX_SPEED / sp
        ball["vx"] *= k
        ball["vy"] *= k


def _friction(ball: dict[str, Any], dt: float) -> None:
    if ball.get("sleep"):
        return
    sp = _speed(ball)
    if sp < MIN_SPEED:
        ball["vx"] = ball["vy"] = 0.0
        ball["sleep"] = True
        return
    new_sp = sp - FRICTION * dt
    if new_sp <= MIN_SPEED:
        ball["vx"] = ball["vy"] = 0.0
        ball["sleep"] = True
        return
    k = new_sp / sp
    ball["vx"] *= k
    ball["vy"] *= k


def _cushion(ball: dict[str, Any]) -> bool:
    """Отскок от бортов; у луз борт отсутствует."""
    if ball.get("pocketed"):
        return False
    r = BALL_R
    hit = False
    x, y = ball["x"], ball["y"]

    if x < r and not _gap_y(y):
        ball["x"] = r
        if ball["vx"] < 0:
            ball["vx"] = -ball["vx"] * CUSHION_REST
            ball["vy"] *= (1.0 - CUSHION_FRICTION)
            hit = True
            _wake(ball)
    elif x > TABLE_W - r and not _gap_y(y):
        ball["x"] = TABLE_W - r
        if ball["vx"] > 0:
            ball["vx"] = -ball["vx"] * CUSHION_REST
            ball["vy"] *= (1.0 - CUSHION_FRICTION)
            hit = True
            _wake(ball)

    x, y = ball["x"], ball["y"]
    if y < r and not _gap_x(x):
        ball["y"] = r
        if ball["vy"] < 0:
            ball["vy"] = -ball["vy"] * CUSHION_REST
            ball["vx"] *= (1.0 - CUSHION_FRICTION)
            hit = True
            _wake(ball)
    elif y > TABLE_H - r and not _gap_x(x):
        ball["y"] = TABLE_H - r
        if ball["vy"] > 0:
            ball["vy"] = -ball["vy"] * CUSHION_REST
            ball["vx"] *= (1.0 - CUSHION_FRICTION)
            hit = True
            _wake(ball)

    # не даём улететь за стол мимо лузы
    if not _pocket_check(ball):
        nx = min(max(ball["x"], r * 0.05), TABLE_W - r * 0.05)
        ny = min(max(ball["y"], r * 0.05), TABLE_H - r * 0.05)
        if nx != ball["x"] or ny != ball["y"]:
            ball["x"], ball["y"] = nx, ny
    return hit


def _collide_pair(a: dict[str, Any], b: dict[str, Any]) -> bool:
    """Импульс + позиционная коррекция. Полностью детерминировано."""
    dx = b["x"] - a["x"]
    dy = b["y"] - a["y"]
    dist2 = dx * dx + dy * dy
    min_d = BALL_R * 2.0
    min_d2 = min_d * min_d
    if dist2 >= min_d2 or dist2 <= 0.0:
        if dist2 <= 0.0:
            # жёсткий детерминированный сдвиг по id
            dx, dy = (1.0, 0.0) if a["id"] < b["id"] else (-1.0, 0.0)
            dist2 = 1e-16
        else:
            return False

    dist = math.sqrt(dist2)
    nx, ny = dx / dist, dy / dist
    overlap = min_d - dist
    hit = False

    # позиционная коррекция только при реальном пересечении
    if overlap > SLOP:
        corr = (overlap - SLOP) * BAUMGARTE
        # если оба спят — почти не двигаем (стабильная пирамида)
        if a.get("sleep") and b.get("sleep"):
            corr *= 0.15
        a["x"] -= nx * corr * 0.5
        a["y"] -= ny * corr * 0.5
        b["x"] += nx * corr * 0.5
        b["y"] += ny * corr * 0.5
        hit = True

    dvx = a["vx"] - b["vx"]
    dvy = a["vy"] - b["vy"]
    vn = dvx * nx + dvy * ny
    if vn <= 0.0:
        return hit

    # спящие просыпаются при ударе
    _wake(a)
    _wake(b)

    # равные массы
    e = RESTITUTION
    # почти покоящийся контакт — меньше «взрыва» пирамиды от шума
    if vn < 0.04 and _speed(a) < 0.08 and _speed(b) < 0.08:
        e = 0.55
    impulse = -(1.0 + e) * vn / 2.0
    a["vx"] += impulse * nx
    a["vy"] += impulse * ny
    b["vx"] -= impulse * nx
    b["vy"] -= impulse * ny
    _clamp_speed(a)
    _clamp_speed(b)
    return True


def _solve(balls: list[dict[str, Any]]) -> None:
    alive = _alive(balls)
    for _ in range(SOLVER_ITERS):
        for i in range(len(alive)):
            for j in range(i + 1, len(alive)):
                _collide_pair(alive[i], alive[j])
        for ball in alive:
            _cushion(ball)


def _snapshot(balls: list[dict[str, Any]]) -> list[list[float | int | None]]:
    out = []
    for b in balls:
        if b["pocketed"]:
            out.append([None, None, 1])
        else:
            out.append([round(b["x"], 4), round(b["y"], 4), 0])
    return out


def _any_awake(balls: list[dict[str, Any]]) -> bool:
    for b in _alive(balls):
        if not b.get("sleep") and _speed(b) > MIN_SPEED:
            return True
        if _speed(b) > MIN_SPEED:
            return True
    return False


def _simulate(st: dict[str, Any], angle: float, power: float) -> dict[str, Any]:
    balls = st["balls"]
    cue = _cue(st)
    if cue["pocketed"]:
        _place_cue_safe(st)

    # гарантировать ключ sleep у старых комнат
    for ball in balls:
        if "sleep" not in ball:
            ball["sleep"] = _speed(ball) < SLEEP_SPEED

    power = max(0.08, min(1.0, float(power)))
    # кривая силы: разбой мощный
    speed = (0.22 + 0.78 * (power ** 1.05)) * MAX_SPEED
    cue["vx"] = math.cos(angle) * speed
    cue["vy"] = math.sin(angle) * speed
    cue["sleep"] = False

    frames: list[list[list[float | int | None]]] = [_snapshot(balls)]
    pocketed_now: list[int] = []
    first_hit: int | None = None
    acc_frame = 0.0
    t = 0.0
    idle_steps = 0

    while t < MAX_TIME:
        if not _any_awake(balls):
            idle_steps += 1
            if idle_steps > 4:
                break
        else:
            idle_steps = 0

        max_sp = 0.0
        for ball in _alive(balls):
            if not ball.get("sleep"):
                max_sp = max(max_sp, _speed(ball))
        # адаптивный подшаг: быстро — ещё мельче
        step = DT
        if max_sp > 1e-9:
            step = min(DT, (BALL_R * 0.45) / max_sp)
        step = max(step, DT * 0.2)

        for ball in _alive(balls):
            if ball.get("sleep"):
                continue
            ball["x"] += ball["vx"] * step
            ball["y"] += ball["vy"] * step
            _friction(ball, step)

        # первый контакт битка
        if first_hit is None:
            cue_b = _cue(st)
            if not cue_b["pocketed"]:
                for other in _alive(balls):
                    if other["id"] == 0:
                        continue
                    if _dist(cue_b, other) <= BALL_R * 2.02:
                        first_hit = other["id"]
                        break

        _solve(balls)

        for ball in list(_alive(balls)):
            if _pocket_check(ball):
                ball["pocketed"] = True
                ball["vx"] = ball["vy"] = 0.0
                ball["sleep"] = True
                pocketed_now.append(ball["id"])

        for ball in _alive(balls):
            _maybe_sleep(ball)

        t += step
        acc_frame += step
        if acc_frame >= FRAME_DT:
            acc_frame = 0.0
            frames.append(_snapshot(balls))
            if len(frames) >= MAX_FRAMES:
                # проредить равномерно
                keep = [frames[int(i * (len(frames) - 1) / (MAX_FRAMES - 1))] for i in range(MAX_FRAMES)]
                frames = keep

    for ball in _alive(balls):
        ball["vx"] = ball["vy"] = 0.0
        ball["sleep"] = True
    # финальная стабилизация без импульсов — только лёгкое разведение
    for _ in range(8):
        alive = _alive(balls)
        moved = False
        for i in range(len(alive)):
            for j in range(i + 1, len(alive)):
                a, c = alive[i], alive[j]
                dx = c["x"] - a["x"]
                dy = c["y"] - a["y"]
                dist = math.hypot(dx, dy)
                min_d = BALL_R * 2.0
                if 0 < dist < min_d - SLOP:
                    nx, ny = dx / dist, dy / dist
                    push = (min_d - dist) * 0.5
                    a["x"] -= nx * push
                    a["y"] -= ny * push
                    c["x"] += nx * push
                    c["y"] += ny * push
                    moved = True
        for ball in alive:
            _cushion(ball)
        if not moved:
            break

    frames.append(_snapshot(balls))
    if len(frames) > MAX_FRAMES:
        keep = [frames[int(i * (len(frames) - 1) / (MAX_FRAMES - 1))] for i in range(MAX_FRAMES)]
        frames = keep

    return {"frames": frames, "pocketed": pocketed_now, "first_hit": first_hit}


def _resolve_shot(room: dict[str, Any], slot: str, result: dict[str, Any]) -> None:
    st = room["state"]
    pocketed = [i for i in result["pocketed"] if i != 0]
    scratch = 0 in result["pocketed"]
    st["last_pocketed"] = pocketed
    st["scratch"] = scratch
    st["frames"] = result["frames"]
    st["shot_id"] = int(st.get("shot_id") or 0) + 1
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
        cue["sleep"] = True
        if any(_dist(cue, b) < BALL_R * 2.08 for b in _alive(st["balls"]) if b["id"] != 0):
            return False, "Слишком близко к другому шару"
        if _pocket_check(cue):
            return False, "Нельзя ставить биток в лузу"
        st["ball_in_hand"] = False
        st["frames"] = []
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
    st["frames"] = []
    result = _simulate(st, angle, max(0.08, min(1.0, power)))
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
        "shot_id": int(st.get("shot_id") or 0),
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
        cue = _cue(st)
        return {"type": "place_cue", "x": cue["x"], "y": cue["y"]}
    cue = _cue(st)
    if cue["pocketed"]:
        return None
    g = st["groups"].get(slot)
    targets = []
    for ball in _alive(st["balls"]):
        if ball["id"] == 0:
            continue
        if ball["id"] == 8:
            if _remaining(st, slot) == 0 and g:
                targets.append(ball)
            continue
        bg = _group_of(ball["id"])
        if not g or bg == g:
            targets.append(ball)
    if not targets:
        targets = [ball for ball in _alive(st["balls"]) if ball["id"] not in (0, 8)]
    if not targets:
        targets = [ball for ball in _alive(st["balls"]) if ball["id"] == 8]
    if not targets:
        return None
    t = min(targets, key=lambda ball: math.hypot(ball["x"] - cue["x"], ball["y"] - cue["y"]))
    angle = math.atan2(t["y"] - cue["y"], t["x"] - cue["x"])
    angle += random.uniform(-0.05, 0.05)
    power = random.uniform(0.45, 0.85)
    return {"type": "shot", "angle": angle, "power": power}
