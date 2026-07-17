"""Стек-дуэль — соревновательный тетрис на двоих (скрытая игра)."""
from __future__ import annotations

import random
import time
from typing import Any

W, H = 10, 20
# Ячейки: 0 пусто, 1–7 цвет фигуры
COLORS = {
    "I": 1,
    "O": 2,
    "T": 3,
    "S": 4,
    "Z": 5,
    "J": 6,
    "L": 7,
}
SHAPES: dict[str, list[list[tuple[int, int]]]] = {
    "I": [
        [(-1, 0), (0, 0), (1, 0), (2, 0)],
        [(1, -1), (1, 0), (1, 1), (1, 2)],
        [(-1, 1), (0, 1), (1, 1), (2, 1)],
        [(0, -1), (0, 0), (0, 1), (0, 2)],
    ],
    "O": [
        [(0, 0), (1, 0), (0, 1), (1, 1)],
        [(0, 0), (1, 0), (0, 1), (1, 1)],
        [(0, 0), (1, 0), (0, 1), (1, 1)],
        [(0, 0), (1, 0), (0, 1), (1, 1)],
    ],
    "T": [
        [(-1, 0), (0, 0), (1, 0), (0, 1)],
        [(0, -1), (0, 0), (0, 1), (1, 0)],
        [(-1, 0), (0, 0), (1, 0), (0, -1)],
        [(0, -1), (0, 0), (0, 1), (-1, 0)],
    ],
    "S": [
        [(0, 0), (1, 0), (-1, 1), (0, 1)],
        [(0, -1), (0, 0), (1, 0), (1, 1)],
        [(0, 0), (1, 0), (-1, 1), (0, 1)],
        [(0, -1), (0, 0), (1, 0), (1, 1)],
    ],
    "Z": [
        [(-1, 0), (0, 0), (0, 1), (1, 1)],
        [(1, -1), (0, 0), (1, 0), (0, 1)],
        [(-1, 0), (0, 0), (0, 1), (1, 1)],
        [(1, -1), (0, 0), (1, 0), (0, 1)],
    ],
    "J": [
        [(-1, 0), (0, 0), (1, 0), (-1, 1)],
        [(0, -1), (0, 0), (0, 1), (1, 1)],
        [(-1, 0), (0, 0), (1, 0), (1, -1)],
        [(0, -1), (0, 0), (0, 1), (-1, -1)],
    ],
    "L": [
        [(-1, 0), (0, 0), (1, 0), (1, 1)],
        [(0, -1), (0, 0), (0, 1), (1, -1)],
        [(-1, 0), (0, 0), (1, 0), (-1, -1)],
        [(0, -1), (0, 0), (0, 1), (-1, 1)],
    ],
}
BAG = list(SHAPES.keys())
LINE_SCORE = {1: 100, 2: 300, 3: 500, 4: 800}


def empty_board() -> list[list[int]]:
    return [[0 for _ in range(W)] for _ in range(H)]


def _new_bag() -> list[str]:
    bag = BAG[:]
    random.shuffle(bag)
    return bag


def _spawn_piece(kind: str) -> dict[str, Any]:
    return {"type": kind, "x": 4, "y": 0, "rot": 0}


def _cells(piece: dict[str, Any]) -> list[tuple[int, int]]:
    kind = piece["type"]
    rot = int(piece["rot"]) % 4
    ox, oy = int(piece["x"]), int(piece["y"])
    return [(ox + dx, oy + dy) for dx, dy in SHAPES[kind][rot]]


def _fits(board: list[list[int]], piece: dict[str, Any]) -> bool:
    for x, y in _cells(piece):
        if x < 0 or x >= W or y >= H:
            return False
        if y >= 0 and board[y][x]:
            return False
    return True


def _lock(board: list[list[int]], piece: dict[str, Any]) -> None:
    color = COLORS[piece["type"]]
    for x, y in _cells(piece):
        if 0 <= y < H and 0 <= x < W:
            board[y][x] = color


def _clear_lines(board: list[list[int]]) -> int:
    kept = [row for row in board if not all(cell != 0 for cell in row)]
    cleared = H - len(kept)
    while len(kept) < H:
        kept.insert(0, [0] * W)
    board[:] = kept
    return cleared


def _gravity_sec(level: int) -> float:
    return max(0.12, 0.85 - (max(1, level) - 1) * 0.07)


def _fill_queue(pl: dict[str, Any], n: int = 5) -> None:
    while len(pl["queue"]) < n:
        if not pl["bag"]:
            pl["bag"] = _new_bag()
        pl["queue"].append(pl["bag"].pop())


def _spawn(pl: dict[str, Any]) -> bool:
    _fill_queue(pl)
    kind = pl["queue"].pop(0)
    _fill_queue(pl)
    piece = _spawn_piece(kind)
    pl["piece"] = piece
    pl["drop_at"] = time.time() + _gravity_sec(int(pl["level"]))
    if not _fits(pl["board"], piece):
        pl["piece"] = None
        pl["alive"] = False
        return False
    return True


def _make_player() -> dict[str, Any]:
    pl: dict[str, Any] = {
        "board": empty_board(),
        "piece": None,
        "queue": [],
        "bag": _new_bag(),
        "score": 0,
        "lines": 0,
        "level": 1,
        "alive": True,
        "drop_at": time.time(),
    }
    _spawn(pl)
    return pl


def init_state(options: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "phase": "ready",
        "players": {"p1": _make_player(), "p2": _make_player()},
        "seed": secrets_token(),
    }


def secrets_token() -> str:
    return format(random.getrandbits(32), "08x")


def on_both_joined(room: dict[str, Any]) -> None:
    room["phase"] = "playing"
    room["turn"] = None  # оба играют одновременно
    room["message"] = "Падайте и набирайте очки! Кто больше — тот победил."
    st = room["state"]
    st["phase"] = "playing"
    now = time.time()
    for slot in ("p1", "p2"):
        pl = st["players"][slot]
        pl["drop_at"] = now + _gravity_sec(int(pl["level"]))


def _paint(board: list[list[int]], piece: dict[str, Any] | None, ghost: bool = False) -> list[list[int]]:
    out = [row[:] for row in board]
    if not piece:
        return out
    ghost_piece = dict(piece)
    if ghost:
        while True:
            nxt = dict(ghost_piece)
            nxt["y"] = int(ghost_piece["y"]) + 1
            if not _fits(board, nxt):
                break
            ghost_piece = nxt
        for x, y in _cells(ghost_piece):
            if 0 <= y < H and 0 <= x < W and out[y][x] == 0:
                out[y][x] = -COLORS[piece["type"]]
    for x, y in _cells(piece):
        if 0 <= y < H and 0 <= x < W:
            out[y][x] = COLORS[piece["type"]]
    return out


def _apply_clear(pl: dict[str, Any], cleared: int) -> None:
    if cleared <= 0:
        return
    pl["lines"] = int(pl["lines"]) + cleared
    pl["score"] = int(pl["score"]) + LINE_SCORE.get(cleared, 0) * int(pl["level"])
    pl["level"] = 1 + int(pl["lines"]) // 10


def _hard_drop(pl: dict[str, Any]) -> None:
    piece = pl.get("piece")
    if not piece or not pl.get("alive"):
        return
    dist = 0
    while True:
        nxt = dict(piece)
        nxt["y"] = int(piece["y"]) + 1
        if not _fits(pl["board"], nxt):
            break
        piece = nxt
        dist += 1
    pl["piece"] = piece
    pl["score"] = int(pl["score"]) + dist * 2
    _lock(pl["board"], piece)
    cleared = _clear_lines(pl["board"])
    _apply_clear(pl, cleared)
    _spawn(pl)


def _soft_step(pl: dict[str, Any]) -> bool:
    """Один шаг вниз. True если фигура ещё в воздухе."""
    piece = pl.get("piece")
    if not piece or not pl.get("alive"):
        return False
    nxt = dict(piece)
    nxt["y"] = int(piece["y"]) + 1
    if _fits(pl["board"], nxt):
        pl["piece"] = nxt
        return True
    _lock(pl["board"], piece)
    cleared = _clear_lines(pl["board"])
    _apply_clear(pl, cleared)
    _spawn(pl)
    return False


def _move(pl: dict[str, Any], dx: int) -> None:
    piece = pl.get("piece")
    if not piece or not pl.get("alive"):
        return
    nxt = dict(piece)
    nxt["x"] = int(piece["x"]) + dx
    if _fits(pl["board"], nxt):
        pl["piece"] = nxt


def _rotate(pl: dict[str, Any], dir_: int) -> None:
    piece = pl.get("piece")
    if not piece or not pl.get("alive"):
        return
    nxt = dict(piece)
    nxt["rot"] = (int(piece["rot"]) + dir_) % 4
    # простые wall kicks
    for kick in (0, -1, 1, -2, 2):
        trial = dict(nxt)
        trial["x"] = int(piece["x"]) + kick
        if _fits(pl["board"], trial):
            pl["piece"] = trial
            return


def _advance_player(pl: dict[str, Any], now: float) -> bool:
    """Гравитация по времени. True если состояние изменилось."""
    if not pl.get("alive") or not pl.get("piece"):
        return False
    changed = False
    guard = 0
    while pl.get("alive") and pl.get("piece") and now >= float(pl.get("drop_at") or 0) and guard < 40:
        guard += 1
        changed = True
        airborne = _soft_step(pl)
        if airborne:
            pl["drop_at"] = float(pl["drop_at"]) + _gravity_sec(int(pl["level"]))
        else:
            # после лока — следующий дроп уже выставлен в _spawn
            break
    return changed


def _finish_if_needed(room: dict[str, Any]) -> None:
    st = room["state"]
    p1 = st["players"]["p1"]
    p2 = st["players"]["p2"]
    if p1["alive"] or p2["alive"]:
        return
    room["phase"] = "done"
    st["phase"] = "done"
    s1, s2 = int(p1["score"]), int(p2["score"])
    n1 = room["players"]["p1"]["name"]
    n2 = room["players"]["p2"]["name"]
    if s1 > s2:
        room["winner"] = "p1"
        room["message"] = f"Победа {n1}! {s1} : {s2}"
    elif s2 > s1:
        room["winner"] = "p2"
        room["message"] = f"Победа {n2}! {s2} : {s1}"
    else:
        room["winner"] = None
        room["result"] = "draw"
        room["message"] = f"Ничья {s1}:{s2}"
    room["turn"] = None


def _update_scoreboard(room: dict[str, Any]) -> None:
    if room.get("phase") != "playing":
        return
    st = room["state"]
    p1, p2 = st["players"]["p1"], st["players"]["p2"]
    alive = [s for s in ("p1", "p2") if st["players"][s]["alive"]]
    if len(alive) == 1:
        other = "p2" if alive[0] == "p1" else "p1"
        room["message"] = (
            f"{room['players'][other]['name']} выбыл · "
            f"{room['players'][alive[0]]['name']} продолжает · "
            f"{p1['score']}:{p2['score']}"
        )
    elif len(alive) == 2:
        room["message"] = (
            f"{room['players']['p1']['name']}: {p1['score']} · "
            f"{room['players']['p2']['name']}: {p2['score']}"
        )


def tick(room: dict[str, Any]) -> bool:
    """Продвинуть гравитацию обоих игроков. True если было изменение."""
    if room.get("phase") != "playing":
        return False
    st = room.get("state") or {}
    if st.get("phase") != "playing":
        return False
    now = time.time()
    changed = False
    for slot in ("p1", "p2"):
        pl = st["players"].get(slot)
        if pl and _advance_player(pl, now):
            changed = True
    before = room.get("phase")
    _finish_if_needed(room)
    if room.get("phase") != before:
        changed = True
    if room.get("phase") == "playing":
        _update_scoreboard(room)
    return changed


def apply_action(room: dict[str, Any], slot: str, action: dict[str, Any]) -> tuple[bool, str]:
    if room["phase"] != "playing":
        return False, "Игра не идёт"
    tick(room)
    st = room["state"]
    pl = st["players"].get(slot)
    if not pl:
        return False, "Нет игрока"
    if not pl.get("alive"):
        return False, "Ты уже выбыл"
    kind = str(action.get("type") or "")
    if kind == "left":
        _move(pl, -1)
    elif kind == "right":
        _move(pl, 1)
    elif kind == "rotate" or kind == "rotate_cw":
        _rotate(pl, 1)
    elif kind == "rotate_ccw":
        _rotate(pl, -1)
    elif kind == "soft":
        if _soft_step(pl):
            pl["score"] = int(pl["score"]) + 1
            pl["drop_at"] = time.time() + _gravity_sec(int(pl["level"]))
    elif kind == "hard":
        _hard_drop(pl)
    elif kind == "tick":
        pass
    else:
        return False, "Неизвестное действие"
    _finish_if_needed(room)
    tick(room)
    if room.get("phase") == "playing":
        _update_scoreboard(room)
    return True, "ok"


def _player_public(pl: dict[str, Any], *, full: bool) -> dict[str, Any]:
    out = {
        "score": int(pl["score"]),
        "lines": int(pl["lines"]),
        "level": int(pl["level"]),
        "alive": bool(pl["alive"]),
        "board": _paint(pl["board"], pl.get("piece"), ghost=full),
        "w": W,
        "h": H,
    }
    if full:
        q = list(pl.get("queue") or [])
        out["next"] = q[0] if q else None
        out["queue"] = q[:3]
    return out


def public_view(room: dict[str, Any], viewer: str | None) -> dict[str, Any]:
    st = room["state"]
    you = viewer if viewer in ("p1", "p2") else "p1"
    opp = "p2" if you == "p1" else "p1"
    return {
        "phase": st.get("phase") or room.get("phase"),
        "you": _player_public(st["players"][you], full=True),
        "enemy": _player_public(st["players"][opp], full=False),
        "enemy_slot": opp,
    }


def win_chance(room: dict[str, Any], slot: str) -> int:
    from .chance import clamp_chance, done_chance

    done = done_chance(room, slot)
    if done is not None:
        return done
    st = room["state"]
    me = st["players"][slot]
    opp = st["players"]["p2" if slot == "p1" else "p1"]
    diff = int(me["score"]) - int(opp["score"])
    base = 50 + diff / 40.0
    if not me["alive"] and opp["alive"]:
        base -= 15
    if me["alive"] and not opp["alive"]:
        base += 15
    return clamp_chance(int(base))


def ai_action(room: dict[str, Any], slot: str) -> dict[str, Any] | None:
    """Простой ИИ: крутит и двигает к лучшему столбику, затем hard drop."""
    st = room["state"]
    pl = st["players"].get(slot)
    if not pl or not pl.get("alive") or not pl.get("piece"):
        return None
    tick(room)
    pl = st["players"][slot]
    if not pl.get("alive") or not pl.get("piece"):
        return None

    best = None
    piece0 = dict(pl["piece"])
    board0 = [row[:] for row in pl["board"]]
    for rot in range(4):
        for x in range(-2, W + 2):
            trial = {"type": piece0["type"], "x": x, "y": 0, "rot": rot}
            if not _fits(board0, trial):
                # опустить с верха: сначала найти валидный y
                ok = False
                for y in range(H):
                    trial["y"] = y
                    if _fits(board0, trial):
                        ok = True
                        break
                if not ok:
                    continue
            # drop
            while True:
                nxt = dict(trial)
                nxt["y"] = int(trial["y"]) + 1
                if not _fits(board0, nxt):
                    break
                trial = nxt
            board = [row[:] for row in board0]
            _lock(board, trial)
            cleared = _clear_lines(board)
            # эвристика: высота + дыры − линии
            heights = []
            holes = 0
            for c in range(W):
                col = [board[r][c] for r in range(H)]
                top = next((i for i, v in enumerate(col) if v), H)
                heights.append(H - top)
                seen = False
                for v in col:
                    if v:
                        seen = True
                    elif seen:
                        holes += 1
            score = cleared * 120 - sum(heights) - holes * 18 - max(heights) * 2
            move = (score, rot, x, int(trial["y"]))
            if best is None or move[0] > best[0]:
                best = move

    if not best:
        return {"type": "hard"}

    _, rot, x, _y = best
    cur = pl["piece"]
    # вернуть последовательность через одно действие за вызов AI
    if int(cur["rot"]) % 4 != rot:
        return {"type": "rotate"}
    if int(cur["x"]) < x:
        return {"type": "right"}
    if int(cur["x"]) > x:
        return {"type": "left"}
    return {"type": "hard"}
