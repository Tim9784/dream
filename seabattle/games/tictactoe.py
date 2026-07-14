"""Крестики-нолики."""
from __future__ import annotations

from typing import Any

WINS = [
    (0, 1, 2), (3, 4, 5), (6, 7, 8),
    (0, 3, 6), (1, 4, 7), (2, 5, 8),
    (0, 4, 8), (2, 4, 6),
]


def init_state(options: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"board": [0] * 9}  # 0 empty, 1 = p1(X), 2 = p2(O)


def on_both_joined(room: dict[str, Any]) -> None:
    room["phase"] = "playing"
    room["turn"] = "p1"
    room["message"] = f"Ходит {room['players']['p1']['name']} (X)"


def _winner(board: list[int]) -> int | None:
    for a, b, c in WINS:
        if board[a] and board[a] == board[b] == board[c]:
            return board[a]
    if all(board):
        return 0  # draw
    return None


def apply_action(room: dict[str, Any], slot: str, action: dict[str, Any]) -> tuple[bool, str]:
    if room["phase"] != "playing":
        return False, "Игра не идёт"
    if room["turn"] != slot:
        return False, "Сейчас ход соперника"
    try:
        idx = int(action.get("cell"))
    except (TypeError, ValueError):
        return False, "Неверная клетка"
    if idx < 0 or idx > 8:
        return False, "Вне поля"
    board = room["state"]["board"]
    if board[idx]:
        return False, "Клетка занята"
    mark = 1 if slot == "p1" else 2
    board[idx] = mark
    result = _winner(board)
    opp = "p2" if slot == "p1" else "p1"
    if result == mark:
        room["phase"] = "done"
        room["winner"] = slot
        room["turn"] = None
        room["message"] = f"Победа! {room['players'][slot]['name']}"
    elif result == 0:
        room["phase"] = "done"
        room["winner"] = None
        room["turn"] = None
        room["message"] = "Ничья"
    else:
        room["turn"] = opp
        room["message"] = f"Ход {room['players'][opp]['name']}"
    return True, "ok"


def public_view(room: dict[str, Any], viewer: str | None) -> dict[str, Any]:
    return {"board": room["state"]["board"]}
