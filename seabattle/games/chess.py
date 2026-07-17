"""Шахматы — базовые правила + шах/мат."""
from __future__ import annotations

from typing import Any

# board[r][c]: None or piece like 'P','p','K','k' — uppercase = white(p1), lowercase = black(p2)
# row 0 = black back rank, row 7 = white back rank


def _start() -> list[list[str | None]]:
    back = list("rnbqkbnr")
    board: list[list[str | None]] = [[None] * 8 for _ in range(8)]
    board[0] = [p for p in back]
    board[1] = ["p"] * 8
    board[6] = ["P"] * 8
    board[7] = [p.upper() for p in back]
    return board


def init_state(options: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"board": _start(), "castling": {"p1": {"K": True, "Q": True}, "p2": {"K": True, "Q": True}}}


def on_both_joined(room: dict[str, Any]) -> None:
    room["phase"] = "playing"
    room["turn"] = "p1"
    room["message"] = f"Ход белых — {room['players']['p1']['name']}"


def _is_white(piece: str | None) -> bool:
    return bool(piece and piece.isupper())


def _side_of(piece: str | None) -> int:
    if not piece:
        return 0
    return 1 if piece.isupper() else -1


def _find_king(board: list[list[str | None]], white: bool) -> tuple[int, int] | None:
    target = "K" if white else "k"
    for r in range(8):
        for c in range(8):
            if board[r][c] == target:
                return r, c
    return None


def _in(r: int, c: int) -> bool:
    return 0 <= r < 8 and 0 <= c < 8


def _ray_attacks(board: list[list[str | None]], r: int, c: int, dirs: list[tuple[int, int]], enemy_set: set[str]) -> bool:
    for dr, dc in dirs:
        nr, nc = r + dr, c + dc
        while _in(nr, nc):
            p = board[nr][nc]
            if p:
                if p in enemy_set:
                    return True
                break
            nr += dr
            nc += dc
    return False


def _is_attacked(board: list[list[str | None]], r: int, c: int, by_white: bool) -> bool:
    # pawns
    if by_white:
        for dc in (-1, 1):
            pr, pc = r + 1, c + dc
            if _in(pr, pc) and board[pr][pc] == "P":
                return True
    else:
        for dc in (-1, 1):
            pr, pc = r - 1, c + dc
            if _in(pr, pc) and board[pr][pc] == "p":
                return True
    # knights
    kn = "N" if by_white else "n"
    for dr, dc in [(-2, -1), (-2, 1), (-1, -2), (-1, 2), (1, -2), (1, 2), (2, -1), (2, 1)]:
        nr, nc = r + dr, c + dc
        if _in(nr, nc) and board[nr][nc] == kn:
            return True
    # king
    kg = "K" if by_white else "k"
    for dr in (-1, 0, 1):
        for dc in (-1, 0, 1):
            if dr == 0 and dc == 0:
                continue
            nr, nc = r + dr, c + dc
            if _in(nr, nc) and board[nr][nc] == kg:
                return True
    # bishops/queens
    bq = {"B", "Q"} if by_white else {"b", "q"}
    if _ray_attacks(board, r, c, [(-1, -1), (-1, 1), (1, -1), (1, 1)], bq):
        return True
    # rooks/queens
    rq = {"R", "Q"} if by_white else {"r", "q"}
    if _ray_attacks(board, r, c, [(-1, 0), (1, 0), (0, -1), (0, 1)], rq):
        return True
    return False


def _in_check(board: list[list[str | None]], white: bool) -> bool:
    pos = _find_king(board, white)
    if not pos:
        return True
    return _is_attacked(board, pos[0], pos[1], by_white=not white)


def _clone(board: list[list[str | None]]) -> list[list[str | None]]:
    return [row[:] for row in board]


def _gen_moves(board: list[list[str | None]], r: int, c: int) -> list[tuple[int, int]]:
    piece = board[r][c]
    if not piece:
        return []
    white = piece.isupper()
    kind = piece.upper()
    moves: list[tuple[int, int]] = []
    enemy = -1 if white else 1

    def add_slide(dirs: list[tuple[int, int]]) -> None:
        for dr, dc in dirs:
            nr, nc = r + dr, c + dc
            while _in(nr, nc):
                p = board[nr][nc]
                if not p:
                    moves.append((nr, nc))
                else:
                    if _side_of(p) == enemy:
                        moves.append((nr, nc))
                    break
                nr += dr
                nc += dc

    if kind == "P":
        step = -1 if white else 1
        start = 6 if white else 1
        if _in(r + step, c) and not board[r + step][c]:
            moves.append((r + step, c))
            if r == start and not board[r + 2 * step][c]:
                moves.append((r + 2 * step, c))
        for dc in (-1, 1):
            nr, nc = r + step, c + dc
            if _in(nr, nc) and board[nr][nc] and _side_of(board[nr][nc]) == enemy:
                moves.append((nr, nc))
    elif kind == "N":
        for dr, dc in [(-2, -1), (-2, 1), (-1, -2), (-1, 2), (1, -2), (1, 2), (2, -1), (2, 1)]:
            nr, nc = r + dr, c + dc
            if _in(nr, nc) and _side_of(board[nr][nc]) != (1 if white else -1):
                moves.append((nr, nc))
    elif kind == "B":
        add_slide([(-1, -1), (-1, 1), (1, -1), (1, 1)])
    elif kind == "R":
        add_slide([(-1, 0), (1, 0), (0, -1), (0, 1)])
    elif kind == "Q":
        add_slide([(-1, -1), (-1, 1), (1, -1), (1, 1), (-1, 0), (1, 0), (0, -1), (0, 1)])
    elif kind == "K":
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                if dr == dc == 0:
                    continue
                nr, nc = r + dr, c + dc
                if _in(nr, nc) and _side_of(board[nr][nc]) != (1 if white else -1):
                    moves.append((nr, nc))
    return moves


def _path_clear(board: list[list[str | None]], r: int, c0: int, c1: int) -> bool:
    lo, hi = (c0, c1) if c0 < c1 else (c1, c0)
    for c in range(lo + 1, hi):
        if board[r][c]:
            return False
    return True


def _castling_targets(
    board: list[list[str | None]],
    white: bool,
    rights: dict[str, bool] | None,
) -> list[tuple[int, int, str]]:
    """Возможные клетки рокировки короля: (tr, tc, side) где side in ('K','Q')."""
    if not rights:
        return []
    row = 7 if white else 0
    king = "K" if white else "k"
    rook = "R" if white else "r"
    if board[row][4] != king:
        return []
    # нельзя рокироваться из шаха
    if _in_check(board, white):
        return []
    out: list[tuple[int, int, str]] = []
    enemy_white = not white

    # короткая (O-O): король e→g, ладья h→f
    if rights.get("K") and board[row][7] == rook and _path_clear(board, row, 4, 7):
        if (
            not _is_attacked(board, row, 4, by_white=enemy_white)
            and not _is_attacked(board, row, 5, by_white=enemy_white)
            and not _is_attacked(board, row, 6, by_white=enemy_white)
        ):
            out.append((row, 6, "K"))

    # длинная (O-O-O): король e→c, ладья a→d
    if rights.get("Q") and board[row][0] == rook and _path_clear(board, row, 4, 0):
        if (
            not _is_attacked(board, row, 4, by_white=enemy_white)
            and not _is_attacked(board, row, 3, by_white=enemy_white)
            and not _is_attacked(board, row, 2, by_white=enemy_white)
        ):
            out.append((row, 2, "Q"))
    return out


def _apply_move_on(
    board: list[list[str | None]],
    fr: int,
    fc: int,
    tr: int,
    tc: int,
) -> list[list[str | None]]:
    """Применить ход (включая рокировку) на копии доски."""
    nb = _clone(board)
    piece = nb[fr][fc]
    nb[tr][tc] = piece
    nb[fr][fc] = None
    if piece and piece.upper() == "P" and tr in (0, 7):
        nb[tr][tc] = "Q" if piece.isupper() else "q"
    # рокировка: король шагнул на 2 клетки по горизонтали
    if piece and piece.upper() == "K" and fr == tr and abs(tc - fc) == 2:
        row = fr
        if tc == 6:  # O-O
            nb[row][5] = nb[row][7]
            nb[row][7] = None
        elif tc == 2:  # O-O-O
            nb[row][3] = nb[row][0]
            nb[row][0] = None
    return nb


def _update_castling_rights(
    castling: dict[str, Any],
    board_before: list[list[str | None]],
    fr: int,
    fc: int,
    tr: int,
    tc: int,
) -> None:
    piece = board_before[fr][fc]
    if not piece:
        return
    slot = "p1" if piece.isupper() else "p2"
    rights = castling.setdefault(slot, {"K": True, "Q": True})
    kind = piece.upper()
    if kind == "K":
        rights["K"] = False
        rights["Q"] = False
    elif kind == "R":
        if fr == (7 if piece.isupper() else 0):
            if fc == 0:
                rights["Q"] = False
            elif fc == 7:
                rights["K"] = False
    # если съели ладью на исходной клетке — снять право соперника
    captured = board_before[tr][tc]
    if captured and captured.upper() == "R":
        opp = "p2" if captured.islower() else "p1"
        opp_rights = castling.setdefault(opp, {"K": True, "Q": True})
        home = 0 if captured.islower() else 7
        if tr == home and tc == 0:
            opp_rights["Q"] = False
        elif tr == home and tc == 7:
            opp_rights["K"] = False


def _legal_moves(
    board: list[list[str | None]],
    r: int,
    c: int,
    castling: dict[str, Any] | None = None,
) -> list[tuple[int, int]]:
    piece = board[r][c]
    if not piece:
        return []
    white = piece.isupper()
    legal: list[tuple[int, int]] = []
    for tr, tc in _gen_moves(board, r, c):
        nb = _apply_move_on(board, r, c, tr, tc)
        if not _in_check(nb, white):
            legal.append((tr, tc))
    if piece.upper() == "K":
        slot = "p1" if white else "p2"
        rights = (castling or {}).get(slot) if castling else None
        for tr, tc, _side in _castling_targets(board, white, rights):
            nb = _apply_move_on(board, r, c, tr, tc)
            if not _in_check(nb, white):
                legal.append((tr, tc))
    return legal


def _any_legal(board: list[list[str | None]], white: bool, castling: dict[str, Any] | None = None) -> bool:
    for r in range(8):
        for c in range(8):
            p = board[r][c]
            if p and p.isupper() == white and _legal_moves(board, r, c, castling):
                return True
    return False


def apply_action(room: dict[str, Any], slot: str, action: dict[str, Any]) -> tuple[bool, str]:
    if room["phase"] != "playing":
        return False, "Игра не идёт"
    if room["turn"] != slot:
        return False, "Сейчас ход соперника"
    white = slot == "p1"
    st = room["state"]
    board = st["board"]
    castling = st.setdefault("castling", {"p1": {"K": True, "Q": True}, "p2": {"K": True, "Q": True}})
    try:
        fr, fc = int(action["from_r"]), int(action["from_c"])
        tr, tc = int(action["to_r"]), int(action["to_c"])
    except (KeyError, TypeError, ValueError):
        return False, "Неверный ход"
    if not (_in(fr, fc) and _in(tr, tc)):
        return False, "Вне поля"
    piece = board[fr][fc]
    if not piece or piece.isupper() != white:
        return False, "Это не твоя фигура"
    if (tr, tc) not in _legal_moves(board, fr, fc, castling):
        return False, "Нелегальный ход"

    was_castle = piece.upper() == "K" and fr == tr and abs(tc - fc) == 2
    _update_castling_rights(castling, board, fr, fc, tr, tc)
    moved = _apply_move_on(board, fr, fc, tr, tc)
    st["board"][:] = moved
    board = st["board"]

    opp = "p2" if slot == "p1" else "p1"
    opp_white = not white
    castle_note = "Рокировка! " if was_castle else ""
    if _in_check(board, opp_white):
        if not _any_legal(board, opp_white, castling):
            room["phase"] = "done"
            room["winner"] = slot
            room["turn"] = None
            room["message"] = f"{castle_note}Мат! Победа {room['players'][slot]['name']}"
            return True, "ok"
        room["turn"] = opp
        room["message"] = f"{castle_note}Шах! Ход {room['players'][opp]['name']}"
    else:
        if not _any_legal(board, opp_white, castling):
            room["phase"] = "done"
            room["winner"] = None
            room["turn"] = None
            room["message"] = f"{castle_note}Пат — ничья"
        else:
            room["turn"] = opp
            room["message"] = f"{castle_note}Ход {room['players'][opp]['name']}"
    return True, "ok"


def public_view(room: dict[str, Any], viewer: str | None) -> dict[str, Any]:
    st = room["state"]
    castling = st.get("castling") or {"p1": {"K": True, "Q": True}, "p2": {"K": True, "Q": True}}
    out: dict[str, Any] = {
        "board": st["board"],
        "castling": castling,
        "castle_options": [],
        "legal_moves": [],
    }
    if (
        viewer
        and room.get("phase") == "playing"
        and room.get("turn") == viewer
        and room["players"].get(viewer)
    ):
        white = viewer == "p1"
        board = st["board"]
        for r in range(8):
            for c in range(8):
                p = board[r][c]
                if not p or p.isupper() != white:
                    continue
                for tr, tc in _legal_moves(board, r, c, castling):
                    out["legal_moves"].append({
                        "from_r": r,
                        "from_c": c,
                        "to_r": tr,
                        "to_c": tc,
                        "capture": bool(board[tr][tc]),
                    })
        row = 7 if white else 0
        king_c = 4
        rights = castling.get(viewer) or {}
        for tr, tc, side in _castling_targets(board, white, rights):
            if (tr, tc) not in _legal_moves(board, row, king_c, castling):
                continue
            short = side == "K"
            out["castle_options"].append({
                "side": side,
                "from_r": row,
                "from_c": king_c,
                "to_r": tr,
                "to_c": tc,
                "short": short,
                "label": "Короткая рокировка" if short else "Длинная рокировка",
            })
    return out


def win_chance(room: dict[str, Any], slot: str) -> int:
    from .chance import done_chance, score_to_chance

    done = done_chance(room, slot)
    if done is not None:
        return done
    white = slot == "p1"
    score = _eval_board(room["state"]["board"], white_perspective=white)
    return score_to_chance(score, scale=250)

VALUES = {"P": 100, "N": 320, "B": 330, "R": 500, "Q": 900, "K": 20000}

# simplified piece-square tables (white perspective; flip for black)
PST = {
    "P": [
        0,0,0,0,0,0,0,0,
        50,50,50,50,50,50,50,50,
        10,10,20,30,30,20,10,10,
        5,5,10,25,25,10,5,5,
        0,0,0,20,20,0,0,0,
        5,-5,-10,0,0,-10,-5,5,
        5,10,10,-20,-20,10,10,5,
        0,0,0,0,0,0,0,0,
    ],
    "N": [
        -50,-40,-30,-30,-30,-30,-40,-50,
        -40,-20,0,0,0,0,-20,-40,
        -30,0,10,15,15,10,0,-30,
        -30,5,15,20,20,15,5,-30,
        -30,0,15,20,20,15,0,-30,
        -30,5,10,15,15,10,5,-30,
        -40,-20,0,5,5,0,-20,-40,
        -50,-40,-30,-30,-30,-30,-40,-50,
    ],
    "B": [
        -20,-10,-10,-10,-10,-10,-10,-20,
        -10,0,0,0,0,0,0,-10,
        -10,0,10,10,10,10,0,-10,
        -10,5,5,10,10,5,5,-10,
        -10,0,10,10,10,10,0,-10,
        -10,10,10,10,10,10,10,-10,
        -10,5,0,0,0,0,5,-10,
        -20,-10,-10,-10,-10,-10,-10,-20,
    ],
    "R": [
        0,0,0,0,0,0,0,0,
        5,10,10,10,10,10,10,5,
        -5,0,0,0,0,0,0,-5,
        -5,0,0,0,0,0,0,-5,
        -5,0,0,0,0,0,0,-5,
        -5,0,0,0,0,0,0,-5,
        -5,0,0,0,0,0,0,-5,
        0,0,0,5,5,0,0,0,
    ],
    "Q": [
        -20,-10,-10,-5,-5,-10,-10,-20,
        -10,0,0,0,0,0,0,-10,
        -10,0,5,5,5,5,0,-10,
        -5,0,5,5,5,5,0,-5,
        0,0,5,5,5,5,0,-5,
        -10,5,5,5,5,5,0,-10,
        -10,0,5,0,0,0,0,-10,
        -20,-10,-10,-5,-5,-10,-10,-20,
    ],
    "K": [
        -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30,
        -20,-30,-30,-40,-40,-30,-30,-20,
        -10,-20,-20,-20,-20,-20,-20,-10,
        20,20,0,0,0,0,20,20,
        20,30,10,0,0,10,30,20,
    ],
}


def _eval_board(board: list[list[str | None]], white_perspective: bool) -> int:
    score = 0
    for r in range(8):
        for c in range(8):
            p = board[r][c]
            if not p:
                continue
            kind = p.upper()
            val = VALUES.get(kind, 0)
            idx = r * 8 + c
            pst = PST.get(kind, [0] * 64)
            if p.isupper():
                score += val + pst[idx]
            else:
                score -= val + pst[(7 - r) * 8 + c]
    return score if white_perspective else -score


def _all_moves(
    board: list[list[str | None]],
    white: bool,
    castling: dict[str, Any] | None = None,
) -> list[tuple[int, int, int, int]]:
    moves = []
    for r in range(8):
        for c in range(8):
            p = board[r][c]
            if p and p.isupper() == white:
                for tr, tc in _legal_moves(board, r, c, castling):
                    moves.append((r, c, tr, tc))
    # capture-ish ordering
    def key(m):
        fr, fc, tr, tc = m
        victim = board[tr][tc]
        # лёгкий бонус рокировке
        piece = board[fr][fc]
        castle_bonus = 30 if piece and piece.upper() == "K" and abs(tc - fc) == 2 else 0
        return -(VALUES.get(victim.upper(), 0) if victim else 0) - castle_bonus
    moves.sort(key=key)
    return moves


def _negamax(board: list[list[str | None]], depth: int, alpha: int, beta: int, white: bool) -> int:
    if depth == 0:
        return _eval_board(board, True) if white else -_eval_board(board, True)
    moves = _all_moves(board, white)
    if not moves:
        if _in_check(board, white):
            return -100000 + (4 - depth)
        return 0
    best = -10**9
    for fr, fc, tr, tc in moves:
        nb = _apply_move_on(board, fr, fc, tr, tc)
        val = -_negamax(nb, depth - 1, -beta, -alpha, not white)
        if val > best:
            best = val
        if best > alpha:
            alpha = best
        if alpha >= beta:
            break
    return best


def ai_action(room: dict[str, Any], slot: str) -> dict[str, Any] | None:
    white = slot == "p1"
    st = room["state"]
    board = st["board"]
    castling = st.get("castling")
    moves = _all_moves(board, white, castling)
    if not moves:
        return None
    depth = 3 if len(moves) < 35 else 2
    best_move = moves[0]
    best_score = -10**9
    for fr, fc, tr, tc in moves:
        nb = _apply_move_on(board, fr, fc, tr, tc)
        score = -_negamax(nb, depth - 1, -10**9, 10**9, not white)
        # tiny preference to central advances
        score += (3 - abs(3.5 - tc)) * 0.1
        # предпочтение рокировке в дебюте
        if abs(tc - fc) == 2 and board[fr][fc] and board[fr][fc].upper() == "K":
            score += 25
        if score > best_score:
            best_score = score
            best_move = (fr, fc, tr, tc)
    fr, fc, tr, tc = best_move
    return {"from_r": fr, "from_c": fc, "to_r": tr, "to_c": tc}
