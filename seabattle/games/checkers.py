"""Русские шашки (упрощённо, обязательный бой)."""
from __future__ import annotations

from typing import Any

# Board 8x8: 0 empty, 1 p1 man, 2 p1 king, -1 p2 man, -2 p2 king
# p1 moves "up" (decreasing row), starts on bottom; p2 moves down.


def init_state(options: dict[str, Any] | None = None) -> dict[str, Any]:
    board = [[0] * 8 for _ in range(8)]
    for r in range(8):
        for c in range(8):
            if (r + c) % 2 == 1:
                if r < 3:
                    board[r][c] = -1
                elif r > 4:
                    board[r][c] = 1
    return {"board": board}


def on_both_joined(room: dict[str, Any]) -> None:
    room["phase"] = "playing"
    room["turn"] = "p1"
    room["message"] = f"Ходят белые — {room['players']['p1']['name']}"


def _side(piece: int) -> int:
    return 1 if piece > 0 else (-1 if piece < 0 else 0)


def _is_king(piece: int) -> bool:
    return abs(piece) == 2


def _inside(r: int, c: int) -> bool:
    return 0 <= r < 8 and 0 <= c < 8


def _captures(board: list[list[int]], r: int, c: int) -> list[tuple[int, int, int, int]]:
    """Return list of (to_r, to_c, cap_r, cap_c)."""
    piece = board[r][c]
    if not piece:
        return []
    side = _side(piece)
    out = []
    dirs = [(-1, -1), (-1, 1), (1, -1), (1, 1)]
    if _is_king(piece):
        for dr, dc in dirs:
            cr, cc = r + dr, c + dc
            while _inside(cr, cc) and board[cr][cc] == 0:
                cr += dr
                cc += dc
            if not _inside(cr, cc) or _side(board[cr][cc]) != -side:
                continue
            tr, tc = cr + dr, cc + dc
            while _inside(tr, tc) and board[tr][tc] == 0:
                out.append((tr, tc, cr, cc))
                tr += dr
                tc += dc
    else:
        for dr, dc in dirs:
            cr, cc = r + dr, c + dc
            tr, tc = r + 2 * dr, c + 2 * dc
            if _inside(tr, tc) and board[tr][tc] == 0 and _inside(cr, cc) and _side(board[cr][cc]) == -side:
                out.append((tr, tc, cr, cc))
    return out


def _simple_moves(board: list[list[int]], r: int, c: int) -> list[tuple[int, int]]:
    piece = board[r][c]
    if not piece:
        return []
    side = _side(piece)
    out = []
    if _is_king(piece):
        for dr, dc in [(-1, -1), (-1, 1), (1, -1), (1, 1)]:
            nr, nc = r + dr, c + dc
            while _inside(nr, nc) and board[nr][nc] == 0:
                out.append((nr, nc))
                nr += dr
                nc += dc
    else:
        fwd = -1 if side > 0 else 1
        for dc in (-1, 1):
            nr, nc = r + fwd, c + dc
            if _inside(nr, nc) and board[nr][nc] == 0:
                out.append((nr, nc))
    return out


def _all_captures(board: list[list[int]], side: int) -> list[tuple[int, int, int, int, int, int]]:
    moves = []
    for r in range(8):
        for c in range(8):
            if _side(board[r][c]) == side:
                for tr, tc, cr, cc in _captures(board, r, c):
                    moves.append((r, c, tr, tc, cr, cc))
    return moves


def _has_any_move(board: list[list[int]], side: int) -> bool:
    if _all_captures(board, side):
        return True
    for r in range(8):
        for c in range(8):
            if _side(board[r][c]) == side and _simple_moves(board, r, c):
                return True
    return False


def _promote(piece: int, r: int) -> int:
    if piece == 1 and r == 0:
        return 2
    if piece == -1 and r == 7:
        return -2
    return piece


def apply_action(room: dict[str, Any], slot: str, action: dict[str, Any]) -> tuple[bool, str]:
    if room["phase"] != "playing":
        return False, "Игра не идёт"
    if room["turn"] != slot:
        return False, "Сейчас ход соперника"
    board = room["state"]["board"]
    side = 1 if slot == "p1" else -1
    try:
        fr, fc = int(action["from_r"]), int(action["from_c"])
        tr, tc = int(action["to_r"]), int(action["to_c"])
    except (KeyError, TypeError, ValueError):
        return False, "Неверный ход"
    if not (_inside(fr, fc) and _inside(tr, tc)):
        return False, "Вне поля"
    if _side(board[fr][fc]) != side:
        return False, "Это не твоя шашка"

    caps = _all_captures(board, side)
    if caps:
        match = next((m for m in caps if m[0] == fr and m[1] == fc and m[2] == tr and m[3] == tc), None)
        if not match:
            return False, "Нужно бить"
        _, _, _, _, cr, cc = match
        board[tr][tc] = _promote(board[fr][fc], tr)
        board[fr][fc] = 0
        board[cr][cc] = 0
        # multi-jump continues if more captures from landing
        more = _captures(board, tr, tc)
        if more:
            room["message"] = f"{room['players'][slot]['name']} продолжает бой"
            return True, "ok"
    else:
        simples = _simple_moves(board, fr, fc)
        if (tr, tc) not in simples:
            return False, "Нельзя так ходить"
        board[tr][tc] = _promote(board[fr][fc], tr)
        board[fr][fc] = 0

    opp = "p2" if slot == "p1" else "p1"
    opp_side = -side
    if not _has_any_move(board, opp_side):
        room["phase"] = "done"
        room["winner"] = slot
        room["turn"] = None
        room["message"] = f"Победа! {room['players'][slot]['name']}"
    else:
        room["turn"] = opp
        room["message"] = f"Ход {room['players'][opp]['name']}"
    return True, "ok"


def public_view(room: dict[str, Any], viewer: str | None) -> dict[str, Any]:
    return {"board": room["state"]["board"]}


def _clone_board(board: list[list[int]]) -> list[list[int]]:
    return [row[:] for row in board]


def _apply_move_sim(board: list[list[int]], move: tuple, side: int) -> tuple[list[list[int]], bool]:
    """Apply one move; return (board, continues_capture)."""
    fr, fc, tr, tc = move[0], move[1], move[2], move[3]
    nb = _clone_board(board)
    piece = nb[fr][fc]
    nb[tr][tc] = _promote(piece, tr)
    nb[fr][fc] = 0
    continues = False
    if len(move) == 6:
        cr, cc = move[4], move[5]
        nb[cr][cc] = 0
        continues = bool(_captures(nb, tr, tc))
    return nb, continues


def _moves_for_side(board: list[list[int]], side: int) -> list[tuple]:
    caps = _all_captures(board, side)
    if caps:
        return caps
    out = []
    for r in range(8):
        for c in range(8):
            if _side(board[r][c]) == side:
                for tr, tc in _simple_moves(board, r, c):
                    out.append((r, c, tr, tc))
    return out


def _eval_chk(board: list[list[int]], side: int) -> int:
    score = 0
    for r in range(8):
        for c in range(8):
            p = board[r][c]
            if not p:
                continue
            s = _side(p)
            val = 3 if abs(p) == 2 else 1
            # progress toward promotion
            if p == 1:
                val += (7 - r) * 0.05
            elif p == -1:
                val += r * 0.05
            score += val if s == side else -val
    return int(score * 100)


def _negamax_chk(board: list[list[int]], side: int, depth: int, alpha: int, beta: int) -> int:
    if depth == 0:
        return _eval_chk(board, side)
    moves = _moves_for_side(board, side)
    if not moves:
        return -100000
    best = -10**9
    for m in moves:
        nb, cont = _apply_move_sim(board, m, side)
        if cont:
            # same side continues
            val = _negamax_chk(nb, side, depth, alpha, beta)
        else:
            val = -_negamax_chk(nb, -side, depth - 1, -beta, -alpha)
        if val > best:
            best = val
        alpha = max(alpha, best)
        if alpha >= beta:
            break
    return best


def ai_action(room: dict[str, Any], slot: str) -> dict[str, Any] | None:
    board = room["state"]["board"]
    side = 1 if slot == "p1" else -1
    moves = _moves_for_side(board, side)
    if not moves:
        return None
    depth = 4
    best = moves[0]
    best_score = -10**9
    for m in moves:
        nb, cont = _apply_move_sim(board, m, side)
        if cont:
            score = _negamax_chk(nb, side, depth, -10**9, 10**9)
        else:
            score = -_negamax_chk(nb, -side, depth - 1, -10**9, 10**9)
        if score > best_score:
            best_score = score
            best = m
    return {"from_r": best[0], "from_c": best[1], "to_r": best[2], "to_c": best[3]}
