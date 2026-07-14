#!/usr/bin/env python3
"""Морской бой — онлайн на двоих через комнаты с кодом."""
from __future__ import annotations

import json
import random
import secrets
import time
from typing import Any

import redis
from flask import Flask, jsonify, request

ROOM_TTL = 3 * 60 * 60  # 3 часа
CODE_LEN = 6
DEFAULT_NAME = "Капитан"

BOARD_PRESETS = {
    "small": {
        "label": "Маленькое",
        "grid": 8,
        "fleet": [3, 2, 2, 1, 1, 1],
    },
    "medium": {
        "label": "Среднее",
        "grid": 10,
        "fleet": [4, 3, 3, 2, 2, 2, 1, 1, 1, 1],
    },
    "large": {
        "label": "Большое",
        "grid": 12,
        "fleet": [5, 4, 3, 3, 2, 2, 2, 2, 1, 1, 1, 1],
    },
}

app = Flask(__name__)
rds = redis.Redis(host="127.0.0.1", port=6379, db=1, decode_responses=True)


def room_key(code: str) -> str:
    return f"seabattle:room:{code}"


def new_code() -> str:
    for _ in range(40):
        code = "".join(str(random.randint(0, 9)) for _ in range(CODE_LEN))
        if not rds.exists(room_key(code)):
            return code
    raise RuntimeError("Не удалось создать код комнаты")


def empty_board(n: int) -> list[list[int]]:
    return [[0 for _ in range(n)] for _ in range(n)]


def save_room(code: str, room: dict[str, Any]) -> None:
    rds.setex(room_key(code), ROOM_TTL, json.dumps(room, ensure_ascii=False))


def load_room(code: str) -> dict[str, Any] | None:
    raw = rds.get(room_key(code))
    if not raw:
        return None
    return json.loads(raw)


def delete_room(code: str) -> None:
    rds.delete(room_key(code))


def player_slot(room: dict[str, Any], token: str) -> str | None:
    for slot in ("p1", "p2"):
        p = room["players"].get(slot)
        if p and p.get("token") == token:
            return slot
    return None


def opponent(slot: str) -> str:
    return "p2" if slot == "p1" else "p1"


def room_grid(room: dict[str, Any]) -> int:
    return int(room.get("grid") or BOARD_PRESETS["medium"]["grid"])


def room_fleet(room: dict[str, Any]) -> list[int]:
    fleet = room.get("fleet")
    if isinstance(fleet, list) and fleet:
        return [int(x) for x in fleet]
    return list(BOARD_PRESETS["medium"]["fleet"])


def normalize_name(raw: Any, fallback: str = DEFAULT_NAME) -> str:
    name = str(raw or "").strip()[:20]
    return name or fallback


def make_player(token: str, name: str, grid: int) -> dict[str, Any]:
    return {
        "token": token,
        "name": name,
        "ready": False,
        "board": empty_board(grid),
        "ships": [],
        "shots": empty_board(grid),
    }


def validate_ships(
    ships: list[dict[str, Any]], fleet: list[int], grid: int
) -> tuple[bool, str, list[list[int]]]:
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

        cells: list[tuple[int, int]] = []
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


def all_ships_sunk(board: list[list[int]], shots: list[list[int]], grid: int) -> bool:
    for y in range(grid):
        for x in range(grid):
            if board[y][x] == 1 and shots[y][x] != 1:
                return False
    return True


def mark_sunk_aura(board: list[list[int]], shots: list[list[int]], x: int, y: int, grid: int) -> None:
    stack = [(x, y)]
    ship_cells: set[tuple[int, int]] = set()
    while stack:
        cx, cy = stack.pop()
        if (cx, cy) in ship_cells:
            continue
        if not (0 <= cx < grid and 0 <= cy < grid):
            continue
        if board[cy][cx] != 1:
            continue
        ship_cells.add((cx, cy))
        stack.extend([(cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)])

    if not ship_cells:
        return
    if any(shots[cy][cx] != 1 for cx, cy in ship_cells):
        return

    for cx, cy in ship_cells:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < grid and 0 <= ny < grid and shots[ny][nx] == 0 and board[ny][nx] == 0:
                    shots[ny][nx] = 2


def is_ship_just_sunk(board: list[list[int]], shots: list[list[int]], x: int, y: int, grid: int) -> bool:
    stack = [(x, y)]
    cells: set[tuple[int, int]] = set()
    while stack:
        cx, cy = stack.pop()
        if (cx, cy) in cells:
            continue
        if not (0 <= cx < grid and 0 <= cy < grid):
            continue
        if board[cy][cx] != 1:
            continue
        cells.add((cx, cy))
        stack.extend([(cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)])
    return bool(cells) and all(shots[cy][cx] == 1 for cx, cy in cells)


def public_state(room: dict[str, Any], viewer: str | None) -> dict[str, Any]:
    grid = room_grid(room)
    players_out = {}
    for slot in ("p1", "p2"):
        p = room["players"].get(slot)
        if not p:
            players_out[slot] = None
            continue
        players_out[slot] = {
            "name": p["name"],
            "ready": p["ready"],
            "connected": True,
        }

    own_board = None
    enemy_shots_view = None
    enemy_board_hits = None

    if viewer:
        me = room["players"][viewer]
        own_board = me["board"]
        own_shots = me["shots"]
        opp = room["players"].get(opponent(viewer))
        if opp:
            enemy_shots_view = opp["shots"]
            enemy_board_hits = own_shots

    size_key = room.get("size", "medium")
    preset = BOARD_PRESETS.get(size_key, BOARD_PRESETS["medium"])

    return {
        "code": room["code"],
        "phase": room["phase"],
        "turn": room.get("turn"),
        "winner": room.get("winner"),
        "message": room.get("message", ""),
        "players": players_out,
        "you": viewer,
        "your_name": room["players"][viewer]["name"] if viewer else None,
        "board": own_board,
        "incoming": enemy_shots_view,
        "enemy": enemy_board_hits,
        "fleet": room_fleet(room),
        "grid": grid,
        "size": size_key,
        "size_label": preset["label"],
    }


@app.get("/")
def index():
    return INDEX_HTML


@app.post("/api/room/create")
def create_room():
    data = request.get_json(silent=True) or {}
    name = normalize_name(data.get("name"), DEFAULT_NAME)
    size_key = str(data.get("size") or "medium").lower()
    if size_key not in BOARD_PRESETS:
        return jsonify({"ok": False, "error": "Неизвестный размер поля"}), 400
    preset = BOARD_PRESETS[size_key]
    grid = preset["grid"]
    fleet = list(preset["fleet"])

    code = new_code()
    token = secrets.token_hex(16)
    room = {
        "code": code,
        "phase": "lobby",
        "created": time.time(),
        "turn": None,
        "winner": None,
        "size": size_key,
        "grid": grid,
        "fleet": fleet,
        "message": f"Ждём второго игрока… Поле: {preset['label']} ({grid}×{grid})",
        "players": {
            "p1": make_player(token, name, grid),
            "p2": None,
        },
    }
    save_room(code, room)
    return jsonify({"ok": True, "code": code, "token": token, "slot": "p1", "state": public_state(room, "p1")})


@app.post("/api/room/join")
def join_room():
    data = request.get_json(silent=True) or {}
    code = str(data.get("code", "")).strip()
    name = normalize_name(data.get("name"), DEFAULT_NAME)
    if not code.isdigit() or len(code) != CODE_LEN:
        return jsonify({"ok": False, "error": "Код — 6 цифр"}), 400
    room = load_room(code)
    if not room:
        return jsonify({"ok": False, "error": "Комната не найдена"}), 404
    if room["players"]["p2"] is not None:
        return jsonify({"ok": False, "error": "Комната уже заполнена"}), 409
    if room["phase"] not in ("lobby", "placing"):
        return jsonify({"ok": False, "error": "Игра уже началась"}), 409

    grid = room_grid(room)
    token = secrets.token_hex(16)
    room["players"]["p2"] = make_player(token, name, grid)
    room["phase"] = "placing"
    room["message"] = "Оба игрока на месте. Расставьте корабли."
    save_room(code, room)
    return jsonify({"ok": True, "code": code, "token": token, "slot": "p2", "state": public_state(room, "p2")})


@app.get("/api/room/<code>")
def get_room(code: str):
    room = load_room(code)
    if not room:
        return jsonify({"ok": False, "error": "Комната не найдена"}), 404
    token = request.args.get("token", "")
    slot = player_slot(room, token) if token else None
    return jsonify({"ok": True, "state": public_state(room, slot)})


@app.post("/api/room/<code>/place")
def place_ships(code: str):
    room = load_room(code)
    if not room:
        return jsonify({"ok": False, "error": "Комната не найдена"}), 404
    data = request.get_json(silent=True) or {}
    token = str(data.get("token", ""))
    slot = player_slot(room, token)
    if not slot:
        return jsonify({"ok": False, "error": "Нет доступа"}), 403
    if room["phase"] not in ("placing", "lobby"):
        return jsonify({"ok": False, "error": "Сейчас нельзя менять расстановку"}), 409

    ok, err, board = validate_ships(data.get("ships") or [], room_fleet(room), room_grid(room))
    if not ok:
        return jsonify({"ok": False, "error": err}), 400

    room["players"][slot]["board"] = board
    room["players"][slot]["ships"] = data["ships"]
    room["players"][slot]["ready"] = True
    room["message"] = f"{room['players'][slot]['name']} готов."

    p1 = room["players"]["p1"]
    p2 = room["players"]["p2"]
    if p1 and p2 and p1["ready"] and p2["ready"]:
        room["phase"] = "battle"
        room["turn"] = random.choice(["p1", "p2"])
        starter = room["players"][room["turn"]]["name"]
        room["message"] = f"Бой начался! Ходит {starter}."

    save_room(code, room)
    return jsonify({"ok": True, "state": public_state(room, slot)})


@app.post("/api/room/<code>/shot")
def fire_shot(code: str):
    room = load_room(code)
    if not room:
        return jsonify({"ok": False, "error": "Комната не найдена"}), 404
    data = request.get_json(silent=True) or {}
    token = str(data.get("token", ""))
    slot = player_slot(room, token)
    if not slot:
        return jsonify({"ok": False, "error": "Нет доступа"}), 403
    if room["phase"] != "battle":
        return jsonify({"ok": False, "error": "Сейчас не фаза боя"}), 409
    if room["turn"] != slot:
        return jsonify({"ok": False, "error": "Сейчас ход соперника"}), 409

    grid = room_grid(room)
    try:
        x = int(data["x"])
        y = int(data["y"])
    except (KeyError, TypeError, ValueError):
        return jsonify({"ok": False, "error": "Неверные координаты"}), 400
    if not (0 <= x < grid and 0 <= y < grid):
        return jsonify({"ok": False, "error": "Вне поля"}), 400

    me = room["players"][slot]
    opp_slot = opponent(slot)
    opp = room["players"][opp_slot]

    if me["shots"][y][x] != 0:
        return jsonify({"ok": False, "error": "Сюда уже стреляли"}), 400

    if opp["board"][y][x] == 1:
        me["shots"][y][x] = 1
        mark_sunk_aura(opp["board"], me["shots"], x, y, grid)
        if all_ships_sunk(opp["board"], me["shots"], grid):
            room["phase"] = "done"
            room["winner"] = slot
            room["message"] = f"Победа! {me['name']} потопил весь флот."
            room["turn"] = None
        else:
            sunk = is_ship_just_sunk(opp["board"], me["shots"], x, y, grid)
            room["message"] = f"{'Корабль потоплен!' if sunk else 'Ранен!'} Ход {me['name']}."
    else:
        me["shots"][y][x] = 2
        room["turn"] = opp_slot
        room["message"] = f"Мимо. Ход {opp['name']}."

    save_room(code, room)
    return jsonify({"ok": True, "state": public_state(room, slot)})


@app.post("/api/room/<code>/leave")
def leave_room(code: str):
    room = load_room(code)
    if not room:
        return jsonify({"ok": True, "left": True})
    data = request.get_json(silent=True) or {}
    token = str(data.get("token", ""))
    slot = player_slot(room, token)
    if not slot:
        return jsonify({"ok": True, "left": True})

    leaver = room["players"][slot]["name"]
    opp_slot = opponent(slot)
    opp = room["players"].get(opp_slot)

    if room["phase"] == "lobby":
        delete_room(code)
        return jsonify({"ok": True, "left": True})

    if room["phase"] in ("placing", "battle") and opp:
        room["phase"] = "done"
        room["winner"] = opp_slot
        room["turn"] = None
        room["message"] = f"{leaver} вышел из игры. Победа за {opp['name']}!"
        room["players"][slot] = None
        save_room(code, room)
        return jsonify({"ok": True, "left": True})

    delete_room(code)
    return jsonify({"ok": True, "left": True})


@app.get("/api/health")
def health():
    try:
        rds.ping()
        return jsonify({"ok": True, "sizes": {k: {"grid": v["grid"], "fleet": v["fleet"]} for k, v in BOARD_PRESETS.items()}})
    except redis.RedisError as e:
        return jsonify({"ok": False, "error": str(e)}), 500


INDEX_HTML = r"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Морской бой</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<style>
:root, html[data-theme="dark"]{
  --bg0:#041523;
  --bg1:#0a2a3d;
  --bg2:#062032;
  --glow1:rgba(54,207,201,.18);
  --glow2:rgba(244,162,97,.12);
  --foam:#7fd3e8;
  --accent:#36cfc9;
  --accent2:#f4a261;
  --hit:#ff6b6b;
  --text:#e8f4fa;
  --muted:#8aabb8;
  --soft:#9dc0d1;
  --label:#a9c5d4;
  --heading:#b7d3e0;
  --panel:rgba(8,28,42,.72);
  --line:rgba(127,211,232,.22);
  --input:#062838;
  --chip:#062838;
  --chip-seg:#cfe0ec;
  --status-bg:rgba(54,207,201,.1);
  --status-line:rgba(54,207,201,.25);
  --status-text:#d7f6f4;
  --hint:#93b4c5;
  --size-small:#8fb0c2;
  --cell:rgba(14,74,92,.55);
  --cell-line:rgba(127,211,232,.12);
  --ship-a:#c9d9e8;
  --ship-b:#9eb6c9;
  --ship-line:#e8f2fa;
  --miss-bg:rgba(123,155,176,.35);
  --miss-dot:#9eb5c6;
  --err:#ffb4b4;
  --danger-line:rgba(255,107,107,.45);
  --footer:#6f8fa0;
  --btn-text:#042029;
  --wave-opacity:.35;
  --brand-grad:linear-gradient(90deg,#e8f4fa,#7fd3e8 50%,#36cfc9);
}
html[data-theme="light"]{
  --bg0:#e8f4fa;
  --bg1:#d5ebf5;
  --bg2:#c5e2ef;
  --glow1:rgba(14,116,144,.12);
  --glow2:rgba(234,88,12,.08);
  --foam:#0e7490;
  --accent:#0d9488;
  --accent2:#ea580c;
  --hit:#dc2626;
  --text:#0f2740;
  --muted:#4b6b7d;
  --soft:#3d6a80;
  --label:#3f647a;
  --heading:#1f4b63;
  --panel:rgba(255,255,255,.78);
  --line:rgba(14,116,144,.22);
  --input:#ffffff;
  --chip:#f0f8fc;
  --chip-seg:#1f5f78;
  --status-bg:rgba(13,148,136,.1);
  --status-line:rgba(13,148,136,.28);
  --status-text:#0f4c5c;
  --hint:#3d6a80;
  --size-small:#4b6b7d;
  --cell:rgba(56,147,170,.22);
  --cell-line:rgba(14,116,144,.18);
  --ship-a:#1f5f78;
  --ship-b:#16485c;
  --ship-line:#0e7490;
  --miss-bg:rgba(100,130,150,.28);
  --miss-dot:#4b6b7d;
  --err:#b91c1c;
  --danger-line:rgba(220,38,38,.4);
  --footer:#5a7a8c;
  --btn-text:#ffffff;
  --wave-opacity:.22;
  --brand-grad:linear-gradient(90deg,#0f2740,#0e7490 50%,#0d9488);
}
*{box-sizing:border-box}
html,body{margin:0;min-height:100%;}
body{
  font-family:'Outfit',system-ui,sans-serif;
  color:var(--text);
  background:
    radial-gradient(1200px 600px at 10% -10%, var(--glow1), transparent 55%),
    radial-gradient(900px 500px at 90% 10%, var(--glow2), transparent 50%),
    linear-gradient(165deg,var(--bg0),var(--bg1) 45%, var(--bg2));
  background-attachment:fixed;
  transition:background .25s ease, color .25s ease;
}
body::before{
  content:"";
  position:fixed;inset:0;pointer-events:none;opacity:var(--wave-opacity);
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cpath d='M0 60 Q30 40 60 60 T120 60' fill='none' stroke='%237fd3e8' stroke-opacity='.08' stroke-width='2'/%3E%3C/svg%3E");
}
.wrap{max-width:1100px;margin:0 auto;padding:20px 16px 48px;position:relative}
.header-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.brand{
  font-family:'Space Grotesk',sans-serif;
  font-weight:700;font-size:clamp(2rem,6vw,3.2rem);
  letter-spacing:-.03em;margin:8px 0 4px;
  background:var(--brand-grad);
  -webkit-background-clip:text;background-clip:text;color:transparent;
  animation:rise .7s ease both;
}
.tag{color:var(--soft);margin:0 0 22px;font-size:1.05rem;animation:rise .8s .05s ease both}
@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(54,207,201,.35)}50%{box-shadow:0 0 0 8px rgba(54,207,201,0)}}
.panel{
  background:var(--panel);backdrop-filter:blur(10px);
  border:1px solid var(--line);border-radius:18px;padding:20px;
  margin-bottom:16px;animation:rise .75s .1s ease both;
}
.row{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
label{display:flex;flex-direction:column;gap:6px;font-size:.9rem}
label span,.field-label{color:var(--label)}
.section-title{margin:0 0 12px;font-size:1.1rem;color:var(--heading);font-weight:600}
input[type=text]{
  background:var(--input);border:1px solid var(--line);color:var(--text);
  border-radius:12px;padding:12px 14px;font:inherit;min-width:180px;outline:none;
}
input[type=text]:focus{border-color:var(--accent)}
.btn{
  border:0;border-radius:12px;padding:12px 18px;font:inherit;font-weight:700;
  cursor:pointer;transition:transform .15s ease, filter .15s ease;color:var(--btn-text);
  background:linear-gradient(135deg,var(--accent),#5eead4);
}
html[data-theme="light"] .btn{background:linear-gradient(135deg,#0d9488,#14b8a6)}
.btn:hover{transform:translateY(-1px);filter:brightness(1.05)}
.btn:active{transform:translateY(1px)}
.btn.ghost{background:transparent;color:var(--foam);border:1px solid var(--line)}
.btn.warn{background:linear-gradient(135deg,var(--accent2),#e76f51);color:#1d1208}
.btn.danger{background:transparent;color:var(--err);border:1px solid var(--danger-line)}
.btn:disabled{opacity:.45;cursor:not-allowed;transform:none}
.theme-btn{
  flex-shrink:0;margin-top:10px;min-width:118px;
  background:transparent;color:var(--foam);border:1px solid var(--line);
  border-radius:12px;padding:10px 14px;font:inherit;font-weight:600;cursor:pointer;
}
.theme-btn:hover{border-color:var(--accent)}
.size-pick{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.size-btn{
  flex:1;min-width:120px;text-align:left;padding:12px 14px;border-radius:12px;cursor:pointer;
  background:var(--chip);border:1px solid var(--line);color:var(--text);font:inherit;
}
.size-btn strong{display:block;font-size:1rem;margin-bottom:2px}
.size-btn small{color:var(--size-small)}
.size-btn.active{border-color:var(--accent);box-shadow:0 0 0 2px rgba(54,207,201,.25);background:rgba(54,207,201,.12)}
html[data-theme="light"] .size-btn.active{box-shadow:0 0 0 2px rgba(13,148,136,.2);background:rgba(13,148,136,.1)}
.code-big{
  font-family:'Space Grotesk',sans-serif;font-size:clamp(2.2rem,8vw,3.5rem);
  letter-spacing:.28em;text-align:center;padding:8px 0 4px;color:var(--foam);
}
.hint{color:var(--hint);font-size:.95rem;text-align:center}
.status{
  text-align:center;padding:12px 14px;border-radius:12px;margin-bottom:14px;
  background:var(--status-bg);border:1px solid var(--status-line);color:var(--status-text);
}
.boards{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:820px){.boards{grid-template-columns:1fr}}
.board-wrap h3{margin:0 0 10px;font-size:1rem;color:var(--heading);font-weight:600}
.grid{
  display:grid;gap:3px;
  user-select:none;touch-action:manipulation;
}
.cell{
  aspect-ratio:1;border-radius:6px;background:var(--cell);
  border:1px solid var(--cell-line);cursor:pointer;
  transition:background .12s ease, transform .12s ease;
}
.cell:hover{filter:brightness(1.15)}
.cell.ship{background:linear-gradient(160deg,var(--ship-a),var(--ship-b));border-color:var(--ship-line)}
.cell.hit{background:radial-gradient(circle at 40% 35%,#ff9b9b,var(--hit));border-color:#ffb4b4;animation:pulse 1.2s ease}
.cell.miss{background:var(--miss-bg);border-color:transparent}
.cell.miss::after{content:"";display:block;width:28%;height:28%;margin:36% auto 0;border-radius:50%;background:var(--miss-dot)}
.cell.preview{background:rgba(54,207,201,.35);border-color:var(--accent)}
.cell.bad{background:rgba(255,107,107,.35);border-color:var(--hit)}
.cell.locked{cursor:default}
.toolbar{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0;align-items:center}
.fleet{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.ship-chip{
  display:flex;gap:3px;padding:6px 8px;border-radius:10px;cursor:pointer;
  background:var(--chip);border:1px solid var(--line);
}
.ship-chip .seg{width:14px;height:14px;border-radius:3px;background:var(--chip-seg)}
.ship-chip.active{border-color:var(--accent);box-shadow:0 0 0 2px rgba(54,207,201,.25)}
.hidden{display:none!important}
.err{color:var(--err);text-align:center;margin-top:8px;min-height:1.2em}
.footer{text-align:center;color:var(--footer);font-size:.85rem;margin-top:18px}
.topbar{display:flex;justify-content:flex-end;margin-bottom:8px}
</style>
<script>
(function(){
  try{
    var t=localStorage.getItem('seabattle-theme');
    if(t!=='light'&&t!=='dark'){
      t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';
    }
    document.documentElement.setAttribute('data-theme', t);
  }catch(e){ document.documentElement.setAttribute('data-theme','dark'); }
})();
</script>
</head>
<body>
<div class="wrap">
  <div class="header-row">
    <div>
      <h1 class="brand">Морской бой</h1>
      <p class="tag">Создай комнату, скинь код другу — и в бой с разных устройств.</p>
    </div>
    <button type="button" class="theme-btn" id="btnTheme" aria-label="Сменить тему">Тема</button>
  </div>

  <section id="home" class="panel">
    <h2 class="section-title">Создать комнату</h2>
    <div class="row">
      <label><span>Твоё имя</span><input id="name" type="text" maxlength="20" value="Капитан" autocomplete="nickname"></label>
    </div>
    <div style="margin-top:14px">
      <span class="field-label" style="font-size:.9rem">Размер поля</span>
      <div class="size-pick" id="sizePick">
        <button type="button" class="size-btn" data-size="small"><strong>Маленькое</strong><small>8×8 · 6 кораблей</small></button>
        <button type="button" class="size-btn active" data-size="medium"><strong>Среднее</strong><small>10×10 · 10 кораблей</small></button>
        <button type="button" class="size-btn" data-size="large"><strong>Большое</strong><small>12×12 · 12 кораблей</small></button>
      </div>
    </div>
    <div class="row" style="margin-top:14px">
      <button class="btn" id="btnCreate">Создать</button>
    </div>
    <hr style="border:0;border-top:1px solid var(--line);margin:18px 0">
    <h2 class="section-title">Войти по коду</h2>
    <div class="row">
      <label><span>Твоё имя</span><input id="joinName" type="text" maxlength="20" value="Капитан" autocomplete="nickname"></label>
      <label><span>Код комнаты</span><input id="joinCode" type="text" maxlength="6" inputmode="numeric" placeholder="123456" autocomplete="off"></label>
      <button class="btn ghost" id="btnJoin" style="margin-top:22px">Войти</button>
    </div>
    <div class="err" id="homeErr"></div>
  </section>

  <section id="lobby" class="panel hidden">
    <div class="topbar"><button class="btn danger" id="btnExitLobby">Выход</button></div>
    <div class="hint">Код для друга</div>
    <div class="code-big" id="codeView">------</div>
    <div class="hint" id="lobbyHint">Ждём второго игрока…</div>
    <div class="hint" id="lobbyYou" style="margin-top:8px"></div>
    <div class="err" id="lobbyErr"></div>
  </section>

  <section id="place" class="panel hidden">
    <div class="topbar"><button class="btn danger" id="btnExitPlace">Выход</button></div>
    <div class="status" id="placeStatus">Расставь корабли. Корабли не должны касаться.</div>
    <div class="toolbar">
      <button class="btn ghost" id="btnRotate">Повернуть</button>
      <button class="btn ghost" id="btnRandom">Случайно</button>
      <button class="btn ghost" id="btnClear">Сбросить</button>
      <button class="btn" id="btnReady" disabled>Готов к бою</button>
    </div>
    <div class="fleet" id="fleet"></div>
    <div class="board-wrap" style="margin-top:14px">
      <h3>Твоё море</h3>
      <div class="grid" id="placeGrid"></div>
    </div>
    <div class="err" id="placeErr"></div>
  </section>

  <section id="battle" class="hidden">
    <div class="topbar"><button class="btn danger" id="btnExitBattle">Выход</button></div>
    <div class="status" id="battleStatus">Бой</div>
    <div class="boards">
      <div class="panel board-wrap">
        <h3>Враг</h3>
        <div class="grid" id="enemyGrid"></div>
      </div>
      <div class="panel board-wrap">
        <h3>Твои корабли</h3>
        <div class="grid" id="ownGrid"></div>
      </div>
    </div>
    <div class="err" id="battleErr"></div>
  </section>

  <section id="done" class="panel hidden">
    <div class="status" id="doneStatus">Игра окончена</div>
    <div class="row" style="justify-content:center;margin-top:10px">
      <button class="btn" id="btnAgain">На главную</button>
    </div>
  </section>

  <p class="footer" id="footerInfo">Выбери размер поля · классические правила · корабли не касаются</p>
</div>
<script>
const PRESETS = {
  small:  {label:'Маленькое', grid:8,  fleet:[3,2,2,1,1,1]},
  medium: {label:'Среднее',   grid:10, fleet:[4,3,3,2,2,2,1,1,1,1]},
  large:  {label:'Большое',   grid:12, fleet:[5,4,3,3,2,2,2,2,1,1,1,1]}
};
const LS = {
  get(){ try{return JSON.parse(localStorage.getItem('seabattle')||'null')}catch{return null} },
  set(v){ localStorage.setItem('seabattle', JSON.stringify(v)) },
  clear(){ localStorage.removeItem('seabattle') }
};

function currentTheme(){
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}
function applyTheme(theme){
  const t = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  try{ localStorage.setItem('seabattle-theme', t); }catch(_){}
  const btn = document.getElementById('btnTheme');
  if(btn) btn.textContent = t === 'light' ? 'Тёмная' : 'Светлая';
}
applyTheme(currentTheme());
document.getElementById('btnTheme').onclick = () => applyTheme(currentTheme() === 'light' ? 'dark' : 'light');

let state = null;
let token = null;
let code = null;
let pollTimer = null;
let selectedSize = null;
let horizontal = true;
let placed = [];
let chosenBoard = 'medium';
let FLEET = PRESETS.medium.fleet.slice();
let GRID = PRESETS.medium.grid;
let gridBuiltFor = null;

const $ = id => document.getElementById(id);
const show = id => { ['home','lobby','place','battle','done'].forEach(s => $(s).classList.toggle('hidden', s!==id)); };
const playerName = (el) => (el.value.trim() || 'Капитан');

function setBoardSize(key){
  if(!PRESETS[key]) key='medium';
  chosenBoard = key;
  document.querySelectorAll('.size-btn').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.size===key);
  });
}

document.querySelectorAll('.size-btn').forEach(btn=>{
  btn.onclick = () => setBoardSize(btn.dataset.size);
});

async function api(path, opts={}){
  const res = await fetch(path, {
    headers:{'Content-Type':'application/json', ...(opts.headers||{})},
    ...opts
  });
  const data = await res.json().catch(()=>({ok:false,error:'Ответ сервера'}));
  if(!res.ok || data.ok===false) throw new Error(data.error || 'Ошибка запроса');
  return data;
}

function startPoll(){
  stopPoll();
  pollTimer = setInterval(async ()=>{
    if(!code||!token) return;
    try{
      const data = await api(`/api/room/${code}?token=${encodeURIComponent(token)}`);
      applyState(data.state);
    }catch(e){
      if(String(e.message||'').includes('не найдена')){
        goHome('Комната закрыта');
      }
    }
  }, 900);
}
function stopPoll(){ if(pollTimer){ clearInterval(pollTimer); pollTimer=null; } }

function syncGridFromState(s){
  const nextGrid = s.grid || PRESETS.medium.grid;
  const nextFleet = (s.fleet && s.fleet.length) ? s.fleet.slice() : PRESETS.medium.fleet.slice();
  const changed = nextGrid !== GRID || nextFleet.join(',') !== FLEET.join(',');
  GRID = nextGrid;
  FLEET = nextFleet;
  if(changed || gridBuiltFor !== GRID){
    placed = [];
    selectedSize = null;
    buildPlaceGrid();
    renderFleet();
    gridBuiltFor = GRID;
  }
  const fleetTxt = FLEET.join('–');
  $('footerInfo').textContent = `${s.size_label||'Поле'} · ${GRID}×${GRID} · флот ${fleetTxt}`;
}

function applyState(s){
  state = s;
  syncGridFromState(s);
  if(s.phase==='lobby'){
    show('lobby');
    $('codeView').textContent = s.code;
    $('lobbyHint').textContent = s.message || 'Ждём второго игрока…';
    $('lobbyYou').textContent = s.your_name ? `Ты: ${s.your_name}` : '';
  } else if(s.phase==='placing'){
    show('place');
    $('placeStatus').textContent = s.message || 'Расставьте корабли';
    if(s.players && s.you){
      const me = s.players[s.you];
      if(me && me.ready){
        $('btnReady').disabled = true;
        $('btnReady').textContent = 'Ожидаем соперника…';
      } else {
        $('btnReady').textContent = 'Готов к бою';
        $('btnReady').disabled = placed.length !== FLEET.length;
      }
    }
  } else if(s.phase==='battle'){
    show('battle');
    renderBattle(s);
  } else if(s.phase==='done'){
    show('done');
    const win = s.winner === s.you;
    if(s.winner && s.you && !s.players[s.you]){
      $('doneStatus').textContent = s.message || 'Ты вышел из игры';
    } else {
      $('doneStatus').textContent = win ? 'Победа! Флот противника уничтожен.' : (s.message || 'Поражение');
    }
    stopPoll();
  }
}

function emptyBoard(){ return Array.from({length:GRID},()=>Array(GRID).fill(0)); }

function cellsOf(ship){
  const cells=[];
  for(let i=0;i<ship.size;i++){
    cells.push(ship.horizontal ? [ship.x+i, ship.y] : [ship.x, ship.y+i]);
  }
  return cells;
}

function canPlace(ship, ignoreIdx=-1){
  const cells = cellsOf(ship);
  for(const [x,y] of cells){
    if(x<0||y<0||x>=GRID||y>=GRID) return false;
  }
  const occupied = new Set();
  placed.forEach((s,i)=>{
    if(i===ignoreIdx) return;
    cellsOf(s).forEach(([x,y])=>occupied.add(x+','+y));
  });
  for(const [x,y] of cells){
    if(occupied.has(x+','+y)) return false;
    for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++){
      const k=(x+dx)+','+(y+dy);
      if(occupied.has(k) && !cells.some(([cx,cy])=>cx===x+dx&&cy===y+dy)) return false;
    }
  }
  return true;
}

function buildPlaceGrid(){
  const g = $('placeGrid');
  g.innerHTML='';
  g.style.gridTemplateColumns = `repeat(${GRID},1fr)`;
  for(let y=0;y<GRID;y++) for(let x=0;x<GRID;x++){
    const d=document.createElement('div');
    d.className='cell';
    d.dataset.x=x; d.dataset.y=y;
    d.onmouseenter=()=>preview(x,y);
    d.onmouseleave=()=>renderPlace();
    d.onclick=()=>tryPlace(x,y);
    g.appendChild(d);
  }
  renderPlace();
}

function renderPlace(){
  const board=emptyBoard();
  placed.forEach(s=>cellsOf(s).forEach(([x,y])=>{board[y][x]=1}));
  [...$('placeGrid').children].forEach(cell=>{
    const x=+cell.dataset.x, y=+cell.dataset.y;
    cell.className='cell'+(board[y][x]?' ship':'');
  });
  const readyLocked = state && state.players && state.you && state.players[state.you] && state.players[state.you].ready;
  $('btnReady').disabled = readyLocked || placed.length !== FLEET.length;
  renderFleet();
}

function preview(x,y){
  if(selectedSize==null) return;
  renderPlace();
  const ship={size:selectedSize,x,y,horizontal};
  const ok=canPlace(ship);
  cellsOf(ship).forEach(([cx,cy])=>{
    if(cx<0||cy<0||cx>=GRID||cy>=GRID) return;
    const cell=$('placeGrid').children[cy*GRID+cx];
    if(cell) cell.classList.add(ok?'preview':'bad');
  });
}

function tryPlace(x,y){
  if(selectedSize==null) return;
  if(state && state.players && state.you && state.players[state.you] && state.players[state.you].ready) return;
  const ship={size:selectedSize,x,y,horizontal};
  if(!canPlace(ship)){ $('placeErr').textContent='Сюда нельзя'; return; }
  placed.push(ship);
  selectedSize=null;
  $('placeErr').textContent='';
  renderPlace();
}

function renderFleet(){
  const box=$('fleet');
  box.innerHTML='';
  const used=placed.map(p=>p.size);
  const remaining=[...FLEET];
  used.forEach(sz=>{ const i=remaining.indexOf(sz); if(i>=0) remaining.splice(i,1); });
  const counts={};
  remaining.forEach(s=>counts[s]=(counts[s]||0)+1);
  [...new Set(FLEET)].forEach(size=>{
    const left=counts[size]||0;
    for(let n=0;n<left;n++){
      const chip=document.createElement('div');
      chip.className='ship-chip'+(selectedSize===size?' active':'');
      chip.onclick=()=>{ selectedSize=size; renderFleet(); };
      for(let i=0;i<size;i++){ const seg=document.createElement('div'); seg.className='seg'; chip.appendChild(seg); }
      box.appendChild(chip);
    }
  });
  if(selectedSize!=null && !(counts[selectedSize]>0)) selectedSize=null;
}

function randomPlace(){
  placed=[];
  const order=[...FLEET].sort((a,b)=>b-a);
  for(const size of order){
    let ok=false;
    for(let t=0;t<600;t++){
      const horiz=Math.random()>0.5;
      const x=Math.floor(Math.random()*(horiz?GRID-size+1:GRID));
      const y=Math.floor(Math.random()*(horiz?GRID:GRID-size+1));
      const ship={size,x,y,horizontal:horiz};
      if(canPlace(ship)){ placed.push(ship); ok=true; break; }
    }
    if(!ok){ placed=[]; return randomPlace(); }
  }
  selectedSize=null;
  renderPlace();
}

function renderBattle(s){
  const myTurn = s.turn===s.you;
  $('battleStatus').textContent = s.message || (myTurn?'Твой ход':'Ход соперника');
  drawBoard($('enemyGrid'), s.enemy||emptyBoard(), true, myTurn);
  const own = emptyBoard();
  const board = s.board || emptyBoard();
  const incoming = s.incoming || emptyBoard();
  for(let y=0;y<GRID;y++) for(let x=0;x<GRID;x++){
    if(board[y][x]) own[y][x]=3;
    if(incoming[y][x]===1) own[y][x]=1;
    else if(incoming[y][x]===2) own[y][x]=2;
  }
  drawBoard($('ownGrid'), own, false, false);
}

function drawBoard(el, matrix, clickable, enabled){
  el.innerHTML='';
  el.style.gridTemplateColumns = `repeat(${GRID},1fr)`;
  for(let y=0;y<GRID;y++) for(let x=0;x<GRID;x++){
    const v=matrix[y][x];
    const d=document.createElement('div');
    let cls='cell';
    if(v===1) cls+=' hit';
    else if(v===2) cls+=' miss';
    else if(v===3) cls+=' ship';
    if(!clickable || !enabled || v!==0) cls+=' locked';
    d.className=cls;
    if(clickable && enabled && v===0){
      d.onclick=()=>shoot(x,y);
    }
    el.appendChild(d);
  }
}

async function shoot(x,y){
  $('battleErr').textContent='';
  try{
    const data = await api(`/api/room/${code}/shot`, {method:'POST', body:JSON.stringify({token,x,y})});
    applyState(data.state);
  }catch(e){ $('battleErr').textContent=e.message; }
}

async function leaveGame(){
  stopPoll();
  const wasCode=code, wasToken=token;
  if(wasCode && wasToken){
    try{
      await api(`/api/room/${wasCode}/leave`, {method:'POST', body:JSON.stringify({token:wasToken})});
    }catch(_){}
  }
  goHome();
}

function goHome(msg){
  stopPoll();
  LS.clear();
  token=null; code=null; state=null; placed=[]; selectedSize=null;
  gridBuiltFor=null;
  FLEET = PRESETS[chosenBoard].fleet.slice();
  GRID = PRESETS[chosenBoard].grid;
  show('home');
  if(msg) $('homeErr').textContent = msg;
  else $('homeErr').textContent = '';
}

$('btnCreate').onclick = async ()=>{
  $('homeErr').textContent='';
  try{
    const name = playerName($('name'));
    const data = await api('/api/room/create', {method:'POST', body:JSON.stringify({name, size:chosenBoard})});
    token=data.token; code=data.code;
    LS.set({token,code,name});
    placed=[]; selectedSize=null; horizontal=true;
    applyState(data.state); startPoll();
  }catch(e){ $('homeErr').textContent=e.message; }
};

$('btnJoin').onclick = async ()=>{
  $('homeErr').textContent='';
  try{
    const joinName = playerName($('joinName'));
    const data = await api('/api/room/join', {method:'POST', body:JSON.stringify({
      name: joinName,
      code:($('joinCode').value||'').replace(/\D/g,'').slice(0,6)
    })});
    token=data.token; code=data.code;
    LS.set({token,code,name:joinName});
    placed=[]; selectedSize=null; horizontal=true;
    applyState(data.state); startPoll();
  }catch(e){ $('homeErr').textContent=e.message; }
};

$('btnRotate').onclick=()=>{ horizontal=!horizontal; };
$('btnRandom').onclick=()=>{ randomPlace(); $('placeErr').textContent=''; };
$('btnClear').onclick=()=>{ placed=[]; selectedSize=null; renderPlace(); };
$('btnReady').onclick=async ()=>{
  $('placeErr').textContent='';
  try{
    const data = await api(`/api/room/${code}/place`, {method:'POST', body:JSON.stringify({token, ships:placed})});
    applyState(data.state);
  }catch(e){ $('placeErr').textContent=e.message; }
};
$('btnAgain').onclick=()=>goHome();
$('btnExitLobby').onclick=()=>leaveGame();
$('btnExitPlace').onclick=()=>leaveGame();
$('btnExitBattle').onclick=()=>leaveGame();

$('joinCode').addEventListener('input', e=>{
  e.target.value = e.target.value.replace(/\D/g,'').slice(0,6);
});

(async function resume(){
  setBoardSize('medium');
  const saved=LS.get();
  if(!saved||!saved.token||!saved.code) return;
  token=saved.token; code=saved.code;
  if(saved.name){ $('name').value=saved.name; $('joinName').value=saved.name; }
  try{
    const data = await api(`/api/room/${code}?token=${encodeURIComponent(token)}`);
    applyState(data.state); startPoll();
  }catch{
    LS.clear();
  }
})();
</script>
</body>
</html>
"""


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=18090, debug=True)
