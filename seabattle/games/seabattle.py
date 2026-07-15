"""Морской бой — логика комнаты."""
from __future__ import annotations

import random
from typing import Any

BOARD_PRESETS = {
    "small": {"label": "Маленькое", "grid": 8, "fleet": [3, 2, 2, 1, 1, 1]},
    "medium": {"label": "Среднее", "grid": 10, "fleet": [4, 3, 3, 2, 2, 2, 1, 1, 1, 1]},
    "large": {"label": "Большое", "grid": 12, "fleet": [5, 4, 3, 3, 2, 2, 2, 2, 1, 1, 1, 1]},
}


def empty_board(n: int) -> list[list[int]]:
    return [[0 for _ in range(n)] for _ in range(n)]


def init_state(options: dict[str, Any] | None = None) -> dict[str, Any]:
    options = options or {}
    size_key = str(options.get("size") or "medium").lower()
    if size_key not in BOARD_PRESETS:
        size_key = "medium"
    preset = BOARD_PRESETS[size_key]
    grid = preset["grid"]
    return {
        "size": size_key,
        "size_label": preset["label"],
        "grid": grid,
        "fleet": list(preset["fleet"]),
        "phase": "placing",
        "boards": {"p1": empty_board(grid), "p2": empty_board(grid)},
        "shots": {"p1": empty_board(grid), "p2": empty_board(grid)},
        "ships": {"p1": [], "p2": []},
        "ready": {"p1": False, "p2": False},
    }


def on_both_joined(room: dict[str, Any]) -> None:
    room["phase"] = "placing"
    room["message"] = "Оба игрока на месте. Расставьте корабли."
    room["state"]["phase"] = "placing"


def validate_ships(ships: list[dict[str, Any]], fleet: list[int], grid: int) -> tuple[bool, str, list[list[int]]]:
    if not isinstance(ships, list) or len(ships) != len(fleet):
        return False, "Нужно расставить весь флот", empty_board(grid)
    sizes = sorted(int(s.get("size", 0)) for s in ships)
    if sizes != sorted(fleet):
        return False, "Неверный состав флота", empty_board(grid)
    board = empty_board(grid)
    occupied: set[tuple[int, int]] = set()
    for ship in ships:
        try:
            size = int(ship["size"])
            x = int(ship["x"])
            y = int(ship["y"])
            horiz = bool(ship.get("horizontal", True))
        except (KeyError, TypeError, ValueError):
            return False, "Некорректные данные корабля", empty_board(grid)
        cells = []
        for i in range(size):
            cx = x + i if horiz else x
            cy = y if horiz else y + i
            if not (0 <= cx < grid and 0 <= cy < grid):
                return False, "Корабль выходит за поле", empty_board(grid)
            cells.append((cx, cy))
        for cx, cy in cells:
            if (cx, cy) in occupied:
                return False, "Корабли пересекаются", empty_board(grid)
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    nx, ny = cx + dx, cy + dy
                    if (nx, ny) in occupied and (nx, ny) not in cells:
                        return False, "Корабли не должны касаться", empty_board(grid)
        for cx, cy in cells:
            occupied.add((cx, cy))
            board[cy][cx] = 1
    return True, "ok", board


def _ship_cells(board: list[list[int]], x: int, y: int, grid: int) -> set[tuple[int, int]]:
    stack = [(x, y)]
    cells: set[tuple[int, int]] = set()
    while stack:
        cx, cy = stack.pop()
        if (cx, cy) in cells or not (0 <= cx < grid and 0 <= cy < grid) or board[cy][cx] != 1:
            continue
        cells.add((cx, cy))
        stack.extend([(cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)])
    return cells


def _mark_aura(board: list[list[int]], shots: list[list[int]], x: int, y: int, grid: int) -> None:
    cells = _ship_cells(board, x, y, grid)
    if not cells or any(shots[cy][cx] != 1 for cx, cy in cells):
        return
    for cx, cy in cells:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < grid and 0 <= ny < grid and shots[ny][nx] == 0 and board[ny][nx] == 0:
                    shots[ny][nx] = 2


def _all_sunk(board: list[list[int]], shots: list[list[int]], grid: int) -> bool:
    for y in range(grid):
        for x in range(grid):
            if board[y][x] == 1 and shots[y][x] != 1:
                return False
    return True


def apply_action(room: dict[str, Any], slot: str, action: dict[str, Any]) -> tuple[bool, str]:
    st = room["state"]
    kind = action.get("type")
    grid = int(st["grid"])
    opp = "p2" if slot == "p1" else "p1"

    if kind == "place":
        if room["phase"] not in ("placing", "lobby"):
            return False, "Сейчас нельзя менять расстановку"
        ok, err, board = validate_ships(action.get("ships") or [], list(st["fleet"]), grid)
        if not ok:
            return False, err
        st["boards"][slot] = board
        st["ships"][slot] = action.get("ships") or []
        st["ready"][slot] = True
        room["message"] = f"{room['players'][slot]['name']} готов."
        if st["ready"]["p1"] and st["ready"]["p2"]:
            room["phase"] = "playing"
            st["phase"] = "battle"
            room["turn"] = random.choice(["p1", "p2"])
            room["message"] = f"Бой начался! Ходит {room['players'][room['turn']]['name']}."
        return True, "ok"

    if kind == "shot":
        if room["phase"] != "playing" or st.get("phase") != "battle":
            return False, "Сейчас не фаза боя"
        if room["turn"] != slot:
            return False, "Сейчас ход соперника"
        try:
            x, y = int(action["x"]), int(action["y"])
        except (KeyError, TypeError, ValueError):
            return False, "Неверные координаты"
        if not (0 <= x < grid and 0 <= y < grid):
            return False, "Вне поля"
        shots = st["shots"][slot]
        if shots[y][x] != 0:
            return False, "Сюда уже стреляли"
        board = st["boards"][opp]
        if board[y][x] == 1:
            shots[y][x] = 1
            _mark_aura(board, shots, x, y, grid)
            if _all_sunk(board, shots, grid):
                room["phase"] = "done"
                room["winner"] = slot
                room["turn"] = None
                room["message"] = f"Победа! {room['players'][slot]['name']} потопил весь флот."
            else:
                cells = _ship_cells(board, x, y, grid)
                sunk = all(shots[cy][cx] == 1 for cx, cy in cells)
                room["message"] = f"{'Корабль потоплен!' if sunk else 'Ранен!'} Ход {room['players'][slot]['name']}."
        else:
            shots[y][x] = 2
            room["turn"] = opp
            room["message"] = f"Мимо. Ход {room['players'][opp]['name']}."
        return True, "ok"

    return False, "Неизвестное действие"


def public_view(room: dict[str, Any], viewer: str | None) -> dict[str, Any]:
    st = room["state"]
    grid = int(st["grid"])
    out = {
        "size": st["size"],
        "size_label": st["size_label"],
        "grid": grid,
        "fleet": st["fleet"],
        "phase": st.get("phase") or room["phase"],
        "ready": st["ready"],
        "board": None,
        "incoming": None,
        "enemy": None,
    }
    if viewer and room["players"].get(viewer):
        out["board"] = st["boards"][viewer]
        out["enemy"] = st["shots"][viewer]
        opp = "p2" if viewer == "p1" else "p1"
        if room["players"].get(opp):
            out["incoming"] = st["shots"][opp]
    return out


def _ship_cells_left(board: list[list[int]], shots_on: list[list[int]]) -> int:
    n = 0
    for y, row in enumerate(board):
        for x, v in enumerate(row):
            if v == 1 and shots_on[y][x] != 1:
                n += 1
    return n


def win_chance(room: dict[str, Any], slot: str) -> int:
    from .chance import clamp_chance, done_chance, score_to_chance

    done = done_chance(room, slot)
    if done is not None:
        return done
    if room.get("phase") != "playing":
        return 50
    st = room["state"]
    opp = "p2" if slot == "p1" else "p1"
    my_left = _ship_cells_left(st["boards"][slot], st["shots"][opp])
    opp_left = _ship_cells_left(st["boards"][opp], st["shots"][slot])
    total = my_left + opp_left
    if total <= 0:
        return 50
    # больше целых клеток у тебя / меньше у врага = выше шанс
    score = (my_left - opp_left) / total * 6.0
    # бонус за уже нанесённый урон
    hits_on_opp = sum(1 for row in st["shots"][slot] for v in row if v == 1)
    hits_on_me = sum(1 for row in st["shots"][opp] for v in row if v == 1)
    score += (hits_on_opp - hits_on_me) * 0.15
    return score_to_chance(score, scale=1.8) if total else clamp_chance(50)


def _random_fleet(fleet: list[int], grid: int) -> list[dict[str, Any]]:
    import random as _rnd
    for _attempt in range(200):
        placed: list[dict[str, Any]] = []
        occupied: set[tuple[int, int]] = set()

        def ok(ship: dict[str, Any]) -> bool:
            cells = []
            for i in range(ship["size"]):
                cx = ship["x"] + i if ship["horizontal"] else ship["x"]
                cy = ship["y"] if ship["horizontal"] else ship["y"] + i
                if not (0 <= cx < grid and 0 <= cy < grid):
                    return False
                cells.append((cx, cy))
            for cx, cy in cells:
                if (cx, cy) in occupied:
                    return False
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = cx + dx, cy + dy
                        if (nx, ny) in occupied and (nx, ny) not in cells:
                            return False
            return True

        success = True
        for size in sorted(fleet, reverse=True):
            found = False
            for _ in range(400):
                horiz = _rnd.random() > 0.5
                x = _rnd.randint(0, grid - size if horiz else grid - 1)
                y = _rnd.randint(0, grid - 1 if horiz else grid - size)
                ship = {"size": size, "x": x, "y": y, "horizontal": horiz}
                if ok(ship):
                    cells = []
                    for i in range(size):
                        cx = x + i if horiz else x
                        cy = y if horiz else y + i
                        cells.append((cx, cy))
                        occupied.add((cx, cy))
                    placed.append(ship)
                    found = True
                    break
            if not found:
                success = False
                break
        if success and len(placed) == len(fleet):
            return placed
    raise RuntimeError("AI fleet fail")


def ai_action(room: dict[str, Any], slot: str) -> dict[str, Any] | None:
    st = room["state"]
    grid = int(st["grid"])
    if room["phase"] == "placing" or st.get("phase") == "placing":
        if st["ready"].get(slot):
            return None
        ships = _random_fleet(list(st["fleet"]), grid)
        return {"type": "place", "ships": ships}

    # battle shot — hunt/target + parity
    shots = st["shots"][slot]
    opp = "p2" if slot == "p1" else "p1"
    hits = [(x, y) for y in range(grid) for x in range(grid) if shots[y][x] == 1]
    # unfinished hits: adjacent unknown
    targets = []
    for x, y in hits:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < grid and 0 <= ny < grid and shots[ny][nx] == 0:
                targets.append((nx, ny))
    if targets:
        # prefer continuing a line of hits
        scored = []
        for nx, ny in targets:
            score = 0
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                px, py = nx + dx, ny + dy
                if 0 <= px < grid and 0 <= py < grid and shots[py][px] == 1:
                    score += 3
            scored.append((score, nx, ny))
        scored.sort(reverse=True)
        return {"type": "shot", "x": scored[0][1], "y": scored[0][2]}

    # probability heatmap for remaining ships
    fleet = list(st["fleet"])
    # approximate remaining length total by uncounted hits
    candidates = []
    for y in range(grid):
        for x in range(grid):
            if shots[y][x] != 0:
                continue
            # checkerboard parity + center bias
            score = 1 + (1 if (x + y) % 2 == 0 else 0)
            score += (grid / 2 - abs(x - (grid - 1) / 2)) * 0.05
            score += (grid / 2 - abs(y - (grid - 1) / 2)) * 0.05
            candidates.append((score, x, y))
    candidates.sort(reverse=True)
    if not candidates:
        return None
    return {"type": "shot", "x": candidates[0][1], "y": candidates[0][2]}
