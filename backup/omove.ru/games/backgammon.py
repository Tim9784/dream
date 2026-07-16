"""Длинные нарды — классические русские правила."""
from __future__ import annotations

import random
from typing import Any

# Пункты 0..23. Оба идут по кругу в одну сторону (возрастание с wrap).
# p1 старт (голова): 0, путь 0→23 → вынос
# p2 старт (голова): 12, путь 12→23→0→11 → вынос
# Выбивания нет: нельзя вставать на пункт с любой чужой шашкой.


def _start_board() -> list[int]:
    b = [0] * 24
    b[0] = 15   # все белые на голове
    b[12] = -15  # все чёрные на своей голове
    return b


def init_state(options: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "board": _start_board(),
        "bar": {"p1": 0, "p2": 0},  # в длинных не используется, оставляем для совместимости UI
        "off": {"p1": 0, "p2": 0},
        "dice": [],
        "rolled": False,
        "left_head": False,  # уже снимали с головы в этом ходу
        "variant": "long",
    }


def on_both_joined(room: dict[str, Any]) -> None:
    room["phase"] = "playing"
    room["turn"] = "p1"
    room["state"]["dice"] = []
    room["state"]["rolled"] = False
    room["state"]["left_head"] = False
    room["message"] = f"Ход {room['players']['p1']['name']} — бросай кости"


def _head(slot: str) -> int:
    return 0 if slot == "p1" else 12


def _home_points(slot: str) -> set[int]:
    # последние 6 пунктов пути перед выносом
    if slot == "p1":
        return {18, 19, 20, 21, 22, 23}
    return {6, 7, 8, 9, 10, 11}


def _point_owner(v: int) -> str | None:
    if v > 0:
        return "p1"
    if v < 0:
        return "p2"
    return None


def _count_on_point(v: int, slot: str) -> int:
    if slot == "p1":
        return max(0, v)
    return max(0, -v)


def _sign(slot: str) -> int:
    return 1 if slot == "p1" else -1


def _distance_forward(slot: str, frm: int, steps: int) -> int | str:
    """Сдвиг вперёд по кругу. Если уходим за дом — 'off' при достаточном шаге."""
    if slot == "p1":
        # путь линейный 0..23
        to = frm + steps
        if to > 23:
            return "off"
        return to
    # p2: 12..23,0..11
    # нормализуем позицию в "прогресс" 0..23 от головы
    progress = (frm - 12) % 24
    nxt = progress + steps
    if nxt > 23:
        return "off"
    return (12 + nxt) % 24


def _pip_to_off(slot: str, frm: int) -> int:
    if slot == "p1":
        return 24 - frm
    progress = (frm - 12) % 24
    return 24 - progress


def _all_home(board: list[int], slot: str) -> bool:
    home = _home_points(slot)
    for i in range(24):
        n = _count_on_point(board[i], slot)
        if n and i not in home:
            return False
    return True


def _can_land(board: list[int], slot: str, to: int) -> bool:
    owner = _point_owner(board[to])
    if owner and owner != slot:
        return False
    return True


def _legal_from(room: dict[str, Any], slot: str, die: int) -> list[tuple[int, int | str]]:
    st = room["state"]
    board = st["board"]
    head = _head(slot)
    left_head = bool(st.get("left_head"))
    home = _all_home(board, slot)
    moves: list[tuple[int, int | str]] = []

    for i in range(24):
        if _count_on_point(board[i], slot) <= 0:
            continue
        # с головы — только одну шашку за ход
        if i == head and left_head and _count_on_point(board[head], slot) > 0:
            # если на голове ещё есть шашки и уже ходили с головы — нельзя
            continue

        to = _distance_forward(slot, i, die)
        if to == "off":
            if not home:
                continue
            need = _pip_to_off(slot, i)
            # точный или больший, если нет шашек дальше от края
            if die == need:
                moves.append((i, "off"))
            elif die > need:
                farther_ok = True
                # дальше = больший прогресс
                if slot == "p1":
                    for j in range(i + 1, 24):
                        if board[j] > 0:
                            farther_ok = False
                            break
                else:
                    my_prog = (i - 12) % 24
                    for j in range(24):
                        if _count_on_point(board[j], slot) <= 0:
                            continue
                        if (j - 12) % 24 > my_prog:
                            farther_ok = False
                            break
                if farther_ok:
                    moves.append((i, "off"))
        else:
            assert isinstance(to, int)
            if _can_land(board, slot, to):
                moves.append((i, to))
    return moves


def _has_any_move(room: dict[str, Any], slot: str, dice: list[int]) -> bool:
    for d in set(dice):
        if _legal_from(room, slot, d):
            return True
    return False


def _apply_one(st: dict[str, Any], slot: str, frm: int, to: int | str) -> None:
    board = st["board"]
    sign = _sign(slot)
    head = _head(slot)
    board[frm] -= sign
    if frm == head:
        st["left_head"] = True
    if to == "off":
        st["off"][slot] += 1
        return
    to = int(to)
    board[to] += sign


def apply_action(room: dict[str, Any], slot: str, action: dict[str, Any]) -> tuple[bool, str]:
    if room["phase"] != "playing":
        return False, "Игра не идёт"
    if room["turn"] != slot:
        return False, "Сейчас ход соперника"
    st = room["state"]
    kind = action.get("type")

    if kind == "roll":
        if st.get("rolled") and st.get("dice"):
            return False, "Кости уже брошены"
        d1, d2 = random.randint(1, 6), random.randint(1, 6)
        dice = [d1, d2, d1, d2] if d1 == d2 else [d1, d2]
        st["dice"] = dice
        st["rolled"] = True
        st["left_head"] = False
        if not _has_any_move(room, slot, dice):
            opp = "p2" if slot == "p1" else "p1"
            st["dice"] = []
            st["rolled"] = False
            room["turn"] = opp
            room["message"] = f"Нет ходов. Ход {room['players'][opp]['name']}"
        else:
            room["message"] = f"Выпало {d1}:{d2}. Ходи, {room['players'][slot]['name']}"
        return True, "ok"

    if kind == "move":
        dice = st.get("dice") or []
        if not dice:
            return False, "Сначала брось кости"
        try:
            die = int(action["die"])
            frm = action["from"]
            if frm == "bar":
                return False, "В длинных нардах нет бара"
            frm = int(frm)
            to = action["to"]
            if to != "off":
                to = int(to)
        except (KeyError, TypeError, ValueError):
            return False, "Неверный ход"
        if die not in dice:
            return False, "Нет такой кости"
        legal = _legal_from(room, slot, die)
        if (frm, to) not in legal:
            return False, "Нельзя так ходить"
        _apply_one(st, slot, frm, to)
        dice.remove(die)
        st["dice"] = dice

        if st["off"][slot] >= 15:
            room["phase"] = "done"
            room["winner"] = slot
            room["turn"] = None
            room["message"] = f"Победа! {room['players'][slot]['name']} вынес все шашки"
            return True, "ok"

        if dice and not _has_any_move(room, slot, dice):
            st["dice"] = []

        if not st["dice"]:
            opp = "p2" if slot == "p1" else "p1"
            st["rolled"] = False
            st["left_head"] = False
            room["turn"] = opp
            room["message"] = f"Ход {room['players'][opp]['name']} — бросай кости"
        else:
            room["message"] = f"Остались кости {st['dice']}. Ходи, {room['players'][slot]['name']}"
        return True, "ok"

    return False, "Неизвестное действие"


def public_view(room: dict[str, Any], viewer: str | None) -> dict[str, Any]:
    st = room["state"]
    legal: list[dict[str, Any]] = []
    if (
        viewer
        and room.get("phase") == "playing"
        and room.get("turn") == viewer
        and (st.get("dice") or [])
    ):
        for die in list(st["dice"]):
            for frm, to in _legal_from(room, viewer, die):
                legal.append({"die": die, "from": frm, "to": to})
    return {
        "board": st["board"],
        "bar": st["bar"],
        "off": st["off"],
        "dice": st["dice"],
        "rolled": st["rolled"],
        "legal": legal,
        "variant": "long",
    }


def win_chance(room: dict[str, Any], slot: str) -> int:
    from .chance import done_chance, score_to_chance

    done = done_chance(room, slot)
    if done is not None:
        return done
    opp = "p2" if slot == "p1" else "p1"
    # разница оценок — на равной позиции ≈ 50%
    score = _score_position(room["state"], slot) - _score_position(room["state"], opp)
    return score_to_chance(score, scale=55)


def _progress(slot: str, idx: int) -> int:
    if slot == "p1":
        return idx
    return (idx - 12) % 24


def _pip(board: list[int], slot: str) -> int:
    total = 0
    for i, v in enumerate(board):
        n = _count_on_point(v, slot)
        if n:
            total += n * (24 - _progress(slot, i))
    return total


def _score_position(st: dict[str, Any], slot: str) -> float:
    board = st["board"]
    off = st["off"]
    opp = "p2" if slot == "p1" else "p1"
    score = 0.0
    score -= _pip(board, slot) * 1.0
    score += _pip(board, opp) * 0.85
    score += off[slot] * 45
    score -= off[opp] * 40
    # бонус за блокеры (свои столбы)
    for i, v in enumerate(board):
        if _count_on_point(v, slot) >= 2:
            score += 1.2
        if _count_on_point(v, opp) >= 2:
            score -= 1.0
    return score


def ai_action(room: dict[str, Any], slot: str) -> dict[str, Any] | None:
    st = room["state"]
    if not st.get("rolled") or not st.get("dice"):
        return {"type": "roll"}

    dice = list(st["dice"])
    best = None
    best_score = -10**18
    for die in set(dice):
        for frm, to in _legal_from(room, slot, die):
            sim = {
                "board": [x for x in st["board"]],
                "bar": dict(st["bar"]),
                "off": dict(st["off"]),
                "dice": list(dice),
                "rolled": True,
                "left_head": bool(st.get("left_head")),
            }
            _apply_one(sim, slot, int(frm), to)
            score = _score_position(sim, slot)
            if to == "off":
                score += 25
            # стараться снимать с головы, когда можно продвинуться
            if frm == _head(slot):
                score += 2
            if score > best_score:
                best_score = score
                best = {"type": "move", "die": die, "from": frm, "to": to}
    return best
