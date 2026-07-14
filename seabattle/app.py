#!/usr/bin/env python3
"""Лобби игр: морской бой, шашки, шахматы, крестики-нолики, нарды."""
from __future__ import annotations

import json
import random
import secrets
import time
from typing import Any

import redis
from flask import Flask, jsonify, render_template, request

from games import GAMES, get_game

ROOM_TTL = 3 * 60 * 60
CODE_LEN = 6
DEFAULT_NAME = "Капитан"

app = Flask(__name__)
rds = redis.Redis(host="127.0.0.1", port=6379, db=1, decode_responses=True)


def room_key(code: str) -> str:
    return f"lobby:room:{code}"


def new_code() -> str:
    for _ in range(40):
        code = "".join(str(random.randint(0, 9)) for _ in range(CODE_LEN))
        if not rds.exists(room_key(code)):
            return code
    raise RuntimeError("Не удалось создать код комнаты")


def save_room(code: str, room: dict[str, Any]) -> None:
    rds.setex(room_key(code), ROOM_TTL, json.dumps(room, ensure_ascii=False))


def load_room(code: str) -> dict[str, Any] | None:
    raw = rds.get(room_key(code))
    return json.loads(raw) if raw else None


def delete_room(code: str) -> None:
    rds.delete(room_key(code))


def normalize_name(raw: Any, fallback: str = DEFAULT_NAME) -> str:
    name = str(raw or "").strip()[:20]
    return name or fallback


def player_slot(room: dict[str, Any], token: str) -> str | None:
    for slot in ("p1", "p2"):
        p = room["players"].get(slot)
        if p and p.get("token") == token:
            return slot
    return None


def opponent(slot: str) -> str:
    return "p2" if slot == "p1" else "p1"


def public_state(room: dict[str, Any], viewer: str | None) -> dict[str, Any]:
    game_id = room["game"]
    meta = GAMES[game_id]
    mod = meta["module"]
    players_out = {}
    for slot in ("p1", "p2"):
        p = room["players"].get(slot)
        players_out[slot] = None if not p else {"name": p["name"], "connected": True}

    game_view = mod.public_view(room, viewer)
    return {
        "code": room["code"],
        "game": game_id,
        "game_title": meta["title"],
        "phase": room["phase"],
        "turn": room.get("turn"),
        "winner": room.get("winner"),
        "message": room.get("message", ""),
        "players": players_out,
        "you": viewer,
        "your_name": room["players"][viewer]["name"] if viewer and room["players"].get(viewer) else None,
        "game_state": game_view,
    }


@app.get("/")
def index():
    return render_template("index.html", games=GAMES)


@app.get("/api/games")
def list_games():
    return jsonify({
        "ok": True,
        "games": [
            {"id": gid, "title": meta["title"], "blurb": meta["blurb"]}
            for gid, meta in GAMES.items()
        ],
    })


@app.post("/api/room/create")
def create_room():
    data = request.get_json(silent=True) or {}
    game_id = str(data.get("game") or "").lower()
    if game_id not in GAMES:
        return jsonify({"ok": False, "error": "Выбери игру"}), 400
    mod = GAMES[game_id]["module"]
    name = normalize_name(data.get("name"))
    code = new_code()
    token = secrets.token_hex(16)
    options = {"size": data.get("size")} if game_id == "seabattle" else {}
    room = {
        "code": code,
        "game": game_id,
        "phase": "lobby",
        "created": time.time(),
        "turn": None,
        "winner": None,
        "message": "Ждём второго игрока…",
        "players": {
            "p1": {"token": token, "name": name},
            "p2": None,
        },
        "state": mod.init_state(options),
    }
    save_room(code, room)
    return jsonify({"ok": True, "code": code, "token": token, "slot": "p1", "state": public_state(room, "p1")})


@app.post("/api/room/join")
def join_room():
    data = request.get_json(silent=True) or {}
    code = str(data.get("code", "")).strip()
    name = normalize_name(data.get("name"))
    if not code.isdigit() or len(code) != CODE_LEN:
        return jsonify({"ok": False, "error": "Код — 6 цифр"}), 400
    room = load_room(code)
    if not room:
        return jsonify({"ok": False, "error": "Комната не найдена"}), 404
    if room["players"]["p2"] is not None:
        return jsonify({"ok": False, "error": "Комната уже заполнена"}), 409
    if room["phase"] != "lobby":
        return jsonify({"ok": False, "error": "Игра уже началась"}), 409

    token = secrets.token_hex(16)
    room["players"]["p2"] = {"token": token, "name": name}
    mod = GAMES[room["game"]]["module"]
    mod.on_both_joined(room)
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


@app.post("/api/room/<code>/action")
def room_action(code: str):
    room = load_room(code)
    if not room:
        return jsonify({"ok": False, "error": "Комната не найдена"}), 404
    data = request.get_json(silent=True) or {}
    token = str(data.get("token", ""))
    slot = player_slot(room, token)
    if not slot:
        return jsonify({"ok": False, "error": "Нет доступа"}), 403
    if not room["players"].get(opponent(slot)):
        return jsonify({"ok": False, "error": "Ждём соперника"}), 409

    mod = get_game(room["game"])
    ok, err = mod.apply_action(room, slot, data)
    if not ok:
        return jsonify({"ok": False, "error": err}), 400
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

    if opp and room["phase"] in ("placing", "playing"):
        room["phase"] = "done"
        room["winner"] = opp_slot
        room["turn"] = None
        room["message"] = f"{leaver} вышел. Победа за {opp['name']}!"
        room["players"][slot] = None
        save_room(code, room)
        return jsonify({"ok": True, "left": True})

    delete_room(code)
    return jsonify({"ok": True, "left": True})


@app.get("/api/health")
def health():
    try:
        rds.ping()
        return jsonify({"ok": True, "games": list(GAMES)})
    except redis.RedisError as e:
        return jsonify({"ok": False, "error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=18090, debug=True)
