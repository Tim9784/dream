#!/usr/bin/env python3
"""Морской бой — онлайн на двоих через комнаты с кодом."""
from __future__ import annotations

import json
import os
import random
import secrets
import time
from typing import Any

import redis
from flask import Flask, jsonify, request

ROOM_TTL = 3 * 60 * 60  # 3 часа
CODE_LEN = 6
GRID = 10
FLEET = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1]

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


def empty_board() -> list[list[int]]:
    return [[0 for _ in range(GRID)] for _ in range(GRID)]


def save_room(code: str, room: dict[str, Any]) -> None:
    rds.setex(room_key(code), ROOM_TTL, json.dumps(room, ensure_ascii=False))


def load_room(code: str) -> dict[str, Any] | None:
    raw = rds.get(room_key(code))
    if not raw:
        return None
    return json.loads(raw)


def player_slot(room: dict[str, Any], token: str) -> str | None:
    for slot in ("p1", "p2"):
        p = room["players"].get(slot)
        if p and p.get("token") == token:
            return slot
    return None


def opponent(slot: str) -> str:
    return "p2" if slot == "p1" else "p1"


def validate_ships(ships: list[dict[str, Any]]) -> tuple[bool, str, list[list[int]]]:
    if not isinstance(ships, list) or len(ships) != len(FLEET):
        return False, "Нужно расставить весь флот", empty_board()

    sizes = sorted(int(s.get("size", 0)) for s in ships)
    if sizes != sorted(FLEET):
        return False, "Неверный состав флота", empty_board()

    board = empty_board()
    occupied: set[tuple[int, int]] = set()

    for ship in ships:
        try:
            size = int(ship["size"])
            x = int(ship["x"])
            y = int(ship["y"])
            horiz = bool(ship.get("horizontal", True))
        except (KeyError, TypeError, ValueError):
            return False, "Некорректные данные корабля", empty_board()

        cells: list[tuple[int, int]] = []
        for i in range(size):
            cx = x + i if horiz else x
            cy = y if horiz else y + i
            if not (0 <= cx < GRID and 0 <= cy < GRID):
                return False, "Корабль выходит за поле", empty_board()
            cells.append((cx, cy))

        for cx, cy in cells:
            if (cx, cy) in occupied:
                return False, "Корабли пересекаются", empty_board()
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    nx, ny = cx + dx, cy + dy
                    if (nx, ny) in occupied and (nx, ny) not in cells:
                        return False, "Корабли не должны касаться", empty_board()

        for cx, cy in cells:
            occupied.add((cx, cy))
            board[cy][cx] = 1

    return True, "ok", board


def all_ships_sunk(board: list[list[int]], shots: list[list[int]]) -> bool:
    for y in range(GRID):
        for x in range(GRID):
            if board[y][x] == 1 and shots[y][x] != 1:
                return False
    return True


def mark_sunk_aura(board: list[list[int]], shots: list[list[int]], x: int, y: int) -> None:
    """После потопления отметить соседние клетки как промахи (для UI)."""
    # Найти все клетки корабля через flood fill по попаданиям+палубам
    stack = [(x, y)]
    ship_cells: set[tuple[int, int]] = set()
    while stack:
        cx, cy = stack.pop()
        if (cx, cy) in ship_cells:
            continue
        if not (0 <= cx < GRID and 0 <= cy < GRID):
            continue
        if board[cy][cx] != 1:
            continue
        ship_cells.add((cx, cy))
        stack.extend([(cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)])

    if not ship_cells:
        return
    if any(shots[cy][cx] != 1 for cx, cy in ship_cells):
        return  # ещё не потоплен

    for cx, cy in ship_cells:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < GRID and 0 <= ny < GRID and shots[ny][nx] == 0 and board[ny][nx] == 0:
                    shots[ny][nx] = 2  # miss around sunk ship


def public_state(room: dict[str, Any], viewer: str | None) -> dict[str, Any]:
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

    you = None
    own_board = None
    own_shots = None
    enemy_shots_view = None
    enemy_board_hits = None

    if viewer:
        you = viewer
        me = room["players"][viewer]
        own_board = me["board"]
        own_shots = me["shots"]  # то, чем я стрелял по врагу
        opp = room["players"].get(opponent(viewer))
        if opp:
            # Что враг видит на моём поле = его shots по мне... нет:
            # shots игрока A — клетки куда A стрелял по B.
            # На своём поле показываем попадания/промахи противника:
            enemy_fire = opp["shots"]
            own_view = empty_board()
            for y in range(GRID):
                for x in range(GRID):
                    if enemy_fire[y][x]:
                        own_view[y][x] = enemy_fire[y][x]
            # own_board остаётся для расстановки; incoming shots отдельно
            enemy_shots_view = enemy_fire

            # Поле врага: только результаты моих выстрелов (без его кораблей)
            enemy_board_hits = own_shots

    return {
        "code": room["code"],
        "phase": room["phase"],
        "turn": room.get("turn"),
        "winner": room.get("winner"),
        "message": room.get("message", ""),
        "players": players_out,
        "you": you,
        "your_name": room["players"][viewer]["name"] if viewer else None,
        "board": own_board,
        "incoming": enemy_shots_view,
        "enemy": enemy_board_hits,
        "fleet": FLEET,
        "grid": GRID,
    }


@app.get("/")
def index():
    return INDEX_HTML


@app.post("/api/room/create")
def create_room():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()[:20] or "Игрок 1"
    code = new_code()
    token = secrets.token_hex(16)
    room = {
        "code": code,
        "phase": "lobby",  # lobby | placing | battle | done
        "created": time.time(),
        "turn": None,
        "winner": None,
        "message": "Ждём второго игрока…",
        "players": {
            "p1": {
                "token": token,
                "name": name,
                "ready": False,
                "board": empty_board(),
                "ships": [],
                "shots": empty_board(),
            },
            "p2": None,
        },
    }
    save_room(code, room)
    return jsonify({"ok": True, "code": code, "token": token, "slot": "p1", "state": public_state(room, "p1")})


@app.post("/api/room/join")
def join_room():
    data = request.get_json(silent=True) or {}
    code = str(data.get("code", "")).strip()
    name = str(data.get("name", "")).strip()[:20] or "Игрок 2"
    if not code.isdigit() or len(code) != CODE_LEN:
        return jsonify({"ok": False, "error": "Код — 6 цифр"}), 400
    room = load_room(code)
    if not room:
        return jsonify({"ok": False, "error": "Комната не найдена"}), 404
    if room["players"]["p2"] is not None:
        return jsonify({"ok": False, "error": "Комната уже заполнена"}), 409
    if room["phase"] not in ("lobby", "placing"):
        return jsonify({"ok": False, "error": "Игра уже началась"}), 409

    token = secrets.token_hex(16)
    room["players"]["p2"] = {
        "token": token,
        "name": name,
        "ready": False,
        "board": empty_board(),
        "ships": [],
        "shots": empty_board(),
    }
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

    ok, err, board = validate_ships(data.get("ships") or [])
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

    try:
        x = int(data["x"])
        y = int(data["y"])
    except (KeyError, TypeError, ValueError):
        return jsonify({"ok": False, "error": "Неверные координаты"}), 400
    if not (0 <= x < GRID and 0 <= y < GRID):
        return jsonify({"ok": False, "error": "Вне поля"}), 400

    me = room["players"][slot]
    opp_slot = opponent(slot)
    opp = room["players"][opp_slot]

    if me["shots"][y][x] != 0:
        return jsonify({"ok": False, "error": "Сюда уже стреляли"}), 400

    if opp["board"][y][x] == 1:
        me["shots"][y][x] = 1  # hit
        mark_sunk_aura(opp["board"], me["shots"], x, y)
        if all_ships_sunk(opp["board"], me["shots"]):
            room["phase"] = "done"
            room["winner"] = slot
            room["message"] = f"Победа! {me['name']} потопил весь флот."
            room["turn"] = None
        else:
            # попадание — ход остаётся
            sunk = is_ship_just_sunk(opp["board"], me["shots"], x, y)
            room["message"] = f"{'Корабль потоплен!' if sunk else 'Ранен!'} Ход {me['name']}."
    else:
        me["shots"][y][x] = 2  # miss
        room["turn"] = opp_slot
        room["message"] = f"Мимо. Ход {opp['name']}."

    save_room(code, room)
    return jsonify({"ok": True, "state": public_state(room, slot)})


def is_ship_just_sunk(board: list[list[int]], shots: list[list[int]], x: int, y: int) -> bool:
    stack = [(x, y)]
    cells: set[tuple[int, int]] = set()
    while stack:
        cx, cy = stack.pop()
        if (cx, cy) in cells:
            continue
        if not (0 <= cx < GRID and 0 <= cy < GRID):
            continue
        if board[cy][cx] != 1:
            continue
        cells.add((cx, cy))
        stack.extend([(cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)])
    return bool(cells) and all(shots[cy][cx] == 1 for cx, cy in cells)


@app.get("/api/health")
def health():
    try:
        rds.ping()
        return jsonify({"ok": True})
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
:root{
  --bg0:#041523;
  --bg1:#0a2a3d;
  --sea:#0e4a5c;
  --foam:#7fd3e8;
  --accent:#36cfc9;
  --accent2:#f4a261;
  --hit:#ff6b6b;
  --miss:#7b9bb0;
  --ship:#d9e6f2;
  --ok:#52c41a;
  --text:#e8f4fa;
  --muted:#8aabb8;
  --panel:rgba(8,28,42,.72);
  --line:rgba(127,211,232,.22);
}
*{box-sizing:border-box}
html,body{margin:0;min-height:100%;}
body{
  font-family:'Outfit',system-ui,sans-serif;
  color:var(--text);
  background:
    radial-gradient(1200px 600px at 10% -10%, rgba(54,207,201,.18), transparent 55%),
    radial-gradient(900px 500px at 90% 10%, rgba(244,162,97,.12), transparent 50%),
    linear-gradient(165deg,var(--bg0),var(--bg1) 45%, #062032);
  background-attachment:fixed;
}
body::before{
  content:"";
  position:fixed;inset:0;pointer-events:none;opacity:.35;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cpath d='M0 60 Q30 40 60 60 T120 60' fill='none' stroke='%237fd3e8' stroke-opacity='.08' stroke-width='2'/%3E%3C/svg%3E");
}
.wrap{max-width:1100px;margin:0 auto;padding:20px 16px 48px;position:relative}
.brand{
  font-family:'Space Grotesk',sans-serif;
  font-weight:700;font-size:clamp(2rem,6vw,3.2rem);
  letter-spacing:-.03em;margin:8px 0 4px;
  background:linear-gradient(90deg,#e8f4fa,#7fd3e8 50%,#36cfc9);
  -webkit-background-clip:text;background-clip:text;color:transparent;
  animation:rise .7s ease both;
}
.tag{color:#9dc0d1;margin:0 0 22px;font-size:1.05rem;animation:rise .8s .05s ease both}
@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(54,207,201,.35)}50%{box-shadow:0 0 0 8px rgba(54,207,201,0)}}
.panel{
  background:var(--panel);backdrop-filter:blur(10px);
  border:1px solid var(--line);border-radius:18px;padding:20px;
  margin-bottom:16px;animation:rise .75s .1s ease both;
}
.row{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
label{display:flex;flex-direction:column;gap:6px;font-size:.9rem}
label span{color:#a9c5d4}
input[type=text]{
  background:#062838;border:1px solid var(--line);color:var(--text);
  border-radius:12px;padding:12px 14px;font:inherit;min-width:180px;outline:none;
}
input[type=text]:focus{border-color:var(--accent)}
.btn{
  border:0;border-radius:12px;padding:12px 18px;font:inherit;font-weight:700;
  cursor:pointer;transition:transform .15s ease, filter .15s ease;color:#042029;
  background:linear-gradient(135deg,var(--accent),#5eead4);
}
.btn:hover{transform:translateY(-1px);filter:brightness(1.05)}
.btn:active{transform:translateY(1px)}
.btn.ghost{background:transparent;color:var(--foam);border:1px solid var(--line)}
.btn.warn{background:linear-gradient(135deg,var(--accent2),#e76f51);color:#1d1208}
.btn:disabled{opacity:.45;cursor:not-allowed;transform:none}
.code-big{
  font-family:'Space Grotesk',sans-serif;font-size:clamp(2.2rem,8vw,3.5rem);
  letter-spacing:.28em;text-align:center;padding:8px 0 4px;color:var(--foam);
}
.hint{color:#93b4c5;font-size:.95rem;text-align:center}
.status{
  text-align:center;padding:12px 14px;border-radius:12px;margin-bottom:14px;
  background:rgba(54,207,201,.1);border:1px solid rgba(54,207,201,.25);color:#d7f6f4;
}
.boards{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:820px){.boards{grid-template-columns:1fr}}
.board-wrap h3{margin:0 0 10px;font-size:1rem;color:#b7d3e0;font-weight:600}
.grid{
  display:grid;grid-template-columns:repeat(10,1fr);gap:3px;
  user-select:none;touch-action:manipulation;
}
.cell{
  aspect-ratio:1;border-radius:6px;background:rgba(14,74,92,.55);
  border:1px solid rgba(127,211,232,.12);cursor:pointer;
  transition:background .12s ease, transform .12s ease;
}
.cell:hover{filter:brightness(1.15)}
.cell.ship{background:linear-gradient(160deg,#c9d9e8,#9eb6c9);border-color:#e8f2fa}
.cell.hit{background:radial-gradient(circle at 40% 35%,#ff9b9b,var(--hit));border-color:#ffb4b4;animation:pulse 1.2s ease}
.cell.miss{background:rgba(123,155,176,.35);border-color:transparent}
.cell.miss::after{content:"";display:block;width:28%;height:28%;margin:36% auto 0;border-radius:50%;background:#9eb5c6}
.cell.preview{background:rgba(54,207,201,.35);border-color:var(--accent)}
.cell.bad{background:rgba(255,107,107,.35);border-color:var(--hit)}
.cell.locked{cursor:default}
.toolbar{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}
.fleet{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.ship-chip{
  display:flex;gap:3px;padding:6px 8px;border-radius:10px;cursor:grab;
  background:#062838;border:1px solid var(--line);
}
.ship-chip .seg{width:14px;height:14px;border-radius:3px;background:#cfe0ec}
.ship-chip.used{opacity:.35;pointer-events:none}
.ship-chip.active{border-color:var(--accent);box-shadow:0 0 0 2px rgba(54,207,201,.25)}
.hidden{display:none!important}
.err{color:#ffb4b4;text-align:center;margin-top:8px;min-height:1.2em}
.footer{text-align:center;color:#6f8fa0;font-size:.85rem;margin-top:18px}
</style>
</head>
<body>
<div class="wrap">
  <h1 class="brand">Морской бой</h1>
  <p class="tag">Создай комнату, скинь код другу — и в бой с разных устройств.</p>

  <section id="home" class="panel">
    <div class="row">
      <label><span>Твоё имя</span><input id="name" type="text" maxlength="20" placeholder="Капитан"></label>
    </div>
    <div class="row" style="margin-top:14px">
      <button class="btn" id="btnCreate">Создать комнату</button>
    </div>
    <hr style="border:0;border-top:1px solid var(--line);margin:18px 0">
    <div class="row">
      <label><span>Код комнаты</span><input id="joinCode" type="text" maxlength="6" inputmode="numeric" placeholder="123456"></label>
      <button class="btn ghost" id="btnJoin" style="margin-top:22px">Войти</button>
    </div>
    <div class="err" id="homeErr"></div>
  </section>

  <section id="lobby" class="panel hidden">
    <div class="hint">Код для друга</div>
    <div class="code-big" id="codeView">------</div>
    <div class="hint" id="lobbyHint">Ждём второго игрока…</div>
    <div class="err" id="lobbyErr"></div>
  </section>

  <section id="place" class="panel hidden">
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

  <p class="footer">Классические правила · 10×10 · флот 4–3–3–2–2–2–1–1–1–1</p>
</div>
<script>
const FLEET = [4,3,3,2,2,2,1,1,1,1];
const GRID = 10;
const LS = {
  get(){ try{return JSON.parse(localStorage.getItem('seabattle')||'null')}catch{return null} },
  set(v){ localStorage.setItem('seabattle', JSON.stringify(v)) },
  clear(){ localStorage.removeItem('seabattle') }
};

let state = null;
let token = null;
let code = null;
let pollTimer = null;
let selectedSize = null;
let horizontal = true;
let placed = []; // {size,x,y,horizontal}

const $ = id => document.getElementById(id);
const show = id => { ['home','lobby','place','battle','done'].forEach(s => $(s).classList.toggle('hidden', s!==id)); };

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
    }catch(e){ /* ignore transient */ }
  }, 900);
}
function stopPoll(){ if(pollTimer){ clearInterval(pollTimer); pollTimer=null; } }

function applyState(s){
  state = s;
  if(s.phase==='lobby'){
    show('lobby');
    $('codeView').textContent = s.code;
    $('lobbyHint').textContent = s.message || 'Ждём второго игрока…';
  } else if(s.phase==='placing'){
    show('place');
    $('placeStatus').textContent = s.message || 'Расставьте корабли';
    if(s.players && s.you){
      const me = s.players[s.you];
      if(me && me.ready){
        $('btnReady').disabled = true;
        $('btnReady').textContent = 'Ожидаем соперника…';
      }
    }
  } else if(s.phase==='battle'){
    show('battle');
    renderBattle(s);
  } else if(s.phase==='done'){
    show('done');
    const win = s.winner === s.you;
    $('doneStatus').textContent = win ? 'Победа! Флот противника уничтожен.' : (s.message || 'Поражение');
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
  $('btnReady').disabled = placed.length !== FLEET.length;
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
    cell.classList.add(ok?'preview':'bad');
  });
}

function tryPlace(x,y){
  if(selectedSize==null) return;
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
  FLEET.filter((v,i,a)=>a.indexOf(v)===i).forEach(size=>{
    const left=counts[size]||0;
    for(let n=0;n<left;n++){
      const chip=document.createElement('div');
      chip.className='ship-chip'+(selectedSize===size?' active':'');
      chip.onclick=()=>{ selectedSize=size; renderFleet(); };
      for(let i=0;i<size;i++){ const seg=document.createElement('div'); seg.className='seg'; chip.appendChild(seg); }
      box.appendChild(chip);
    }
  });
  // mark selected if still available
  if(selectedSize!=null && !(counts[selectedSize]>0)) selectedSize=null;
}

function randomPlace(){
  placed=[];
  const order=[...FLEET].sort((a,b)=>b-a);
  for(const size of order){
    let ok=false;
    for(let t=0;t<400;t++){
      const horizontal=Math.random()>0.5;
      const x=Math.floor(Math.random()*(horizontal?GRID-size+1:GRID));
      const y=Math.floor(Math.random()*(horizontal?GRID:GRID-size+1));
      const ship={size,x,y,horizontal};
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
  // own: ships + incoming shots
  const own = emptyBoard();
  const board = s.board || emptyBoard();
  const incoming = s.incoming || emptyBoard();
  for(let y=0;y<GRID;y++) for(let x=0;x<GRID;x++){
    if(board[y][x]) own[y][x]=3; // ship
    if(incoming[y][x]===1) own[y][x]=1;
    else if(incoming[y][x]===2) own[y][x]=2;
  }
  drawBoard($('ownGrid'), own, false, false);
}

function drawBoard(el, matrix, clickable, enabled){
  el.innerHTML='';
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

$('btnCreate').onclick = async ()=>{
  $('homeErr').textContent='';
  try{
    const data = await api('/api/room/create', {method:'POST', body:JSON.stringify({name:$('name').value.trim()||'Игрок 1'})});
    token=data.token; code=data.code;
    LS.set({token,code,name:$('name').value.trim()});
    placed=[]; selectedSize=null; horizontal=true;
    buildPlaceGrid(); renderFleet();
    applyState(data.state); startPoll();
  }catch(e){ $('homeErr').textContent=e.message; }
};

$('btnJoin').onclick = async ()=>{
  $('homeErr').textContent='';
  try{
    const data = await api('/api/room/join', {method:'POST', body:JSON.stringify({
      name:$('name').value.trim()||'Игрок 2',
      code:($('joinCode').value||'').replace(/\D/g,'').slice(0,6)
    })});
    token=data.token; code=data.code;
    LS.set({token,code,name:$('name').value.trim()});
    placed=[]; selectedSize=null; horizontal=true;
    buildPlaceGrid(); renderFleet();
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
$('btnAgain').onclick=()=>{ LS.clear(); stopPoll(); location.reload(); };

$('joinCode').addEventListener('input', e=>{
  e.target.value = e.target.value.replace(/\D/g,'').slice(0,6);
});

(async function resume(){
  buildPlaceGrid(); renderFleet();
  const saved=LS.get();
  if(!saved||!saved.token||!saved.code) return;
  token=saved.token; code=saved.code;
  if(saved.name) $('name').value=saved.name;
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
