"""Нарды (короткие, упрощённые: без удвоения кубиков)."""
from __future__ import annotations

import random
from typing import Any

# points 0..23, p1 moves increasing index, p2 decreasing
# bar: p1_bar / p2_bar
# off: p1_off / p2_off
# board[i] >0 means p1 checkers count, <0 p2


def _start_board() -> list[int]:
    b = [0] * 24
    # short backgammon-ish classic setup from white's perspective
    b[0] = 2
    b[11] = 5
    b[16] = 3
    b[18] = 5
    b[23] = -2
    b[12] = -5
    b[7] = -3
    b[5] = -5
    return b


def init_state(options: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "board": _start_board(),
        "bar": {"p1": 0, "p2": 0},
        "off": {"p1": 0, "p2": 0},
        "dice": [],
        "rolled": False,
    }


def on_both_joined(room: dict[str, Any]) -> None:
    room["phase"] = "playing"
    room["turn"] = "p1"
    room["state"]["dice"] = []
    room["state"]["rolled"] = False
    room["message"] = f"Ход {room['players']['p1']['name']} — бросай кости"


def _dir(slot: str) -> int:
    return 1 if slot == "p1" else -1


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


def _all_home(board: list[int], bar: int, slot: str) -> bool:
    if bar:
        return False
    if slot == "p1":
        # home 18..23
        for i in range(0, 18):
            if board[i] > 0:
                return False
    else:
        for i in range(6, 24):
            if board[i] < 0:
                return False
    return True


def _dest(slot: str, frm: int | None, die: int) -> int | str:
    """Return point index or 'off'."""
    if frm == "bar":
        return die - 1 if slot == "p1" else 24 - die
    assert isinstance(frm, int)
    if slot == "p1":
        to = frm + die
        return "off" if to >= 24 else to
    to = frm - die
    return "off" if to < 0 else to


def _can_land(board: list[int], slot: str, to: int) -> bool:
    opp = "p2" if slot == "p1" else "p1"
    owner = _point_owner(board[to])
    if owner == opp and abs(board[to]) > 1:
        return False
    return True


def _legal_from(room: dict[str, Any], slot: str, die: int) -> list[tuple[str | int, int | str]]:
    st = room["state"]
    board = st["board"]
    bar = st["bar"][slot]
    moves = []
    if bar:
        to = _dest(slot, "bar", die)
        assert isinstance(to, int)
        if _can_land(board, slot, to):
            moves.append(("bar", to))
        return moves

    home = _all_home(board, 0, slot)
    for i in range(24):
        if _count_on_point(board[i], slot) <= 0:
            continue
        to = _dest(slot, i, die)
        if to == "off":
            if not home:
                continue
            # exact or higher only if no further checkers that could use exact — simplify allow if home
            if slot == "p1":
                # need exact unless no checkers further from home edge
                need = 24 - i
                if die == need or (die > need and all(board[j] <= 0 for j in range(i + 1, 24))):
                    moves.append((i, "off"))
            else:
                need = i + 1
                if die == need or (die > need and all(board[j] >= 0 for j in range(0, i))):
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


def _apply_one(st: dict[str, Any], slot: str, frm: str | int, to: int | str) -> None:
    board = st["board"]
    opp = "p2" if slot == "p1" else "p1"
    sign = 1 if slot == "p1" else -1
    if frm == "bar":
        st["bar"][slot] -= 1
    else:
        board[int(frm)] -= sign

    if to == "off":
        st["off"][slot] += 1
        return

    to = int(to)
    if _point_owner(board[to]) == opp and abs(board[to]) == 1:
        board[to] = 0
        st["bar"][opp] += 1
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
            if frm != "bar":
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
            dice = []
            st["dice"] = []

        if not st["dice"]:
            opp = "p2" if slot == "p1" else "p1"
            st["rolled"] = False
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
    }


def _pip(board: list[int], bar: dict, slot: str) -> int:
    total = bar.get(slot, 0) * 25
    for i, v in enumerate(board):
        n = _count_on_point(v, slot)
        if not n:
            continue
        if slot == "p1":
            total += n * (24 - i)
        else:
            total += n * (i + 1)
    return total


def _score_position(st: dict[str, Any], slot: str) -> float:
    board = st["board"]
    bar = st["bar"]
    off = st["off"]
    opp = "p2" if slot == "p1" else "p1"
    # lower pip better; hitting opponent bar good; own bar bad; off good
    score = 0.0
    score -= _pip(board, bar, slot) * 1.0
    score += _pip(board, bar, opp) * 0.9
    score += off[slot] * 40
    score -= off[opp] * 35
    score -= bar[slot] * 28
    score += bar[opp] * 22
    # blot penalty (single checkers)
    for i, v in enumerate(board):
        if _count_on_point(v, slot) == 1:
            score -= 3
        if _count_on_point(v, opp) == 1:
            score += 1.5
    return score


def ai_action(room: dict[str, Any], slot: str) -> dict[str, Any] | None:
    st = room["state"]
    if not st.get("rolled") or not st.get("dice"):
        return {"type": "roll"}

    dice = list(st["dice"])
    best = None
    best_score = -10**18
    # try each die + each legal from/to
    for die in set(dice):
        for frm, to in _legal_from(room, slot, die):
            # simulate
            import copy
            sim = {
                "board": [x for x in st["board"]],
                "bar": dict(st["bar"]),
                "off": dict(st["off"]),
                "dice": list(dice),
                "rolled": True,
            }
            _apply_one(sim, slot, frm, to)
            score = _score_position(sim, slot)
            # prefer hitting
            if isinstance(to, int) and _point_owner(st["board"][to]) and _point_owner(st["board"][to]) != slot and abs(st["board"][to]) == 1:
                score += 15
            if to == "off":
                score += 20
            if score > best_score:
                best_score = score
                best = {"type": "move", "die": die, "from": frm, "to": to}
    return best
