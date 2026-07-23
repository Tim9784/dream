#!/usr/bin/env python3
"""Лобби игр: морской бой, шашки, шахматы, крестики-нолики, нарды, дурак, OUNO."""
from __future__ import annotations

import json
import os
import random
import re
import secrets
import tempfile
import time
from typing import Any

from flask import Flask, g, jsonify, make_response, redirect, render_template, request

import auth as auth_mod
from games import GAMES, get_game
from memory_store import FileStore, MemoryStore, MySQLStore
from ratings import leaderboard as rating_leaderboard
from ratings import maybe_record_finished
from ratings import user_game_stats as rating_user_game_stats
from stats import snapshot as stats_snapshot
from stats import track_finished, track_join, track_room_created, track_visit

ROOM_TTL = 3 * 60 * 60
CODE_LEN = 6
DEFAULT_NAME = "Лиса"
AI_NAME = "Компьютер"
AI_THINK_SEC = 1.0
MAX_JSON_BYTES = 12_000
MAX_ROOMS = 400
SLOTS = ("p1", "p2", "p3", "p4")
TOKEN_RE = re.compile(r"^[0-9a-f]{32}$")
SAFE_NAME_RE = re.compile(r"[\x00-\x1f\x7f<>{}[\]\\\"`]")
ANIMAL_NAMES = (
    "Лиса", "Волк", "Медведь", "Заяц", "Ёж", "Белка", "Выдра", "Рысь", "Тигр", "Лев",
    "Панда", "Коала", "Енот", "Барсук", "Олень", "Лось", "Кабан", "Бобёр", "Сова", "Орёл",
    "Сокол", "Ворон", "Пингвин", "Дельфин", "Кит", "Акула", "Осьминог", "Краб", "Черепаха", "Лягушка",
    "Кот", "Пёс", "Хомяк", "Капибара", "Лама", "Альпака", "Жираф", "Зебра", "Слон", "Носорог",
    "Крокодил", "Хамелеон", "Попугай", "Пеликан", "Фламинго", "Ехидна", "Кенгуру", "Сурикат", "Мангуст", "Нерпа",
)

# Redis rate limits: (max_hits, window_sec)
RL_CREATE = (8, 60)
RL_JOIN = (15, 60)
RL_ACTION = (240, 60)
RL_POLL = (180, 60)
RL_GLOBAL_WRITE = (400, 10)
# Ссылки на почту: по IP мягче (NAT/общий Wi‑Fi), по email строже
RL_AUTH_IP = (20, 60 * 60)
RL_AUTH_EMAIL = (5, 60 * 60)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_JSON_BYTES
app.config["JSON_AS_ASCII"] = False


def _load_config() -> dict[str, Any]:
    path = os.environ.get("PANEL_CONFIG") or os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "config.json"
    )
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
            return data if isinstance(data, dict) else {}
    except Exception:
        return {}


_CFG = _load_config()
app.config["SECRET_KEY"] = str(_CFG.get("secret_key") or secrets.token_hex(24))


def _make_store():
    """MySQL (config) → Redis → FileStore → MemoryStore."""
    mysql_cfg = _CFG.get("mysql") if isinstance(_CFG.get("mysql"), dict) else {}
    if mysql_cfg.get("host") and mysql_cfg.get("user") and mysql_cfg.get("database"):
        try:
            store = MySQLStore(
                host=str(mysql_cfg["host"]),
                user=str(mysql_cfg["user"]),
                password=str(mysql_cfg.get("password") or ""),
                database=str(mysql_cfg["database"]),
                port=int(mysql_cfg.get("port") or 3306),
                table=str(mysql_cfg.get("table") or "omove_kv"),
            )
            store.ping()
            return store, Exception
        except Exception:
            pass

    try:
        import redis as _redis

        client = _redis.Redis(host="127.0.0.1", port=6379, db=1, decode_responses=True)
        client.ping()
        return client, _redis.RedisError
    except Exception:
        pass

    # На CGI каждый запрос — новый процесс: MemoryStore теряет комнаты.
    base = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(base, "data", "store"),
        os.path.join(base, "..", "tmp", "store"),
        os.path.join(tempfile.gettempdir(), "omove-lobby-store"),
    ]
    for path in candidates:
        try:
            os.makedirs(path, mode=0o700, exist_ok=True)
            probe = os.path.join(path, ".write_test")
            with open(probe, "w", encoding="utf-8") as fh:
                fh.write("ok")
            os.remove(probe)
            return FileStore(path), Exception
        except Exception:
            continue
    return MemoryStore(), Exception


rds, RedisError = _make_store()

SITE_TITLE = str(_CFG.get("site_title") or "Omove.ru").strip() or "Omove.ru"
# Скрытый путь статистики — не светим в UI обычным пользователям
STATS_PATH = str(_CFG.get("stats_path") or "m-k7p2qx9w").strip().strip("/")
if not re.fullmatch(r"[A-Za-z0-9_-]{6,64}", STATS_PATH):
    STATS_PATH = "m-k7p2qx9w"


def current_user() -> dict[str, Any] | None:
    return getattr(g, "user", None)


def attach_user_to_player(player: dict[str, Any], user: dict[str, Any] | None) -> None:
    if not user:
        return
    player["user_id"] = int(user["id"])


def mark_game_finished(room: dict[str, Any]) -> None:
    """Сайт-статистика + рейтинг авторизованных игроков."""
    if not room.get("stats_finished"):
        room["stats_finished"] = True
        track_finished(rds, room.get("game") or "")
    maybe_record_finished(room)


def set_session_cookie(resp, token: str):
    resp.set_cookie(
        auth_mod.SESSION_COOKIE,
        token,
        max_age=auth_mod.SESSION_TTL,
        httponly=True,
        samesite="Lax",
        secure=request.is_secure,
        path="/",
    )
    return resp


def clear_session_cookie(resp):
    resp.set_cookie(
        auth_mod.SESSION_COOKIE,
        "",
        max_age=0,
        httponly=True,
        samesite="Lax",
        secure=request.is_secure,
        path="/",
    )
    return resp


def room_key(code: str) -> str:
    return f"lobby:room:{code}"


def client_ip() -> str:
    # Доверяем только X-Real-IP от локального nginx
    if request.remote_addr in ("127.0.0.1", "::1"):
        ip = (request.headers.get("X-Real-IP") or "").strip()
        if ip and len(ip) < 64:
            return ip
    return request.remote_addr or "0.0.0.0"


def rate_limit(bucket: str, limit: int, window: int) -> bool:
    """True если запрос разрешён."""
    key = f"lobby:rl:{bucket}"
    try:
        n = rds.incr(key)
        if n == 1:
            rds.expire(key, window)
        return n <= limit
    except RedisError:
        return True


def too_many() -> tuple[Any, int]:
    return jsonify({"ok": False, "error": "Слишком много запросов. Подожди немного."}), 429


def new_code() -> str:
    for _ in range(40):
        code = "".join(str(random.randint(0, 9)) for _ in range(CODE_LEN))
        if not rds.exists(room_key(code)):
            return code
    raise RuntimeError("Не удалось создать код комнаты")


def count_rooms() -> int:
    try:
        return sum(1 for _ in rds.scan_iter(match="lobby:room:*", count=200))
    except RedisError:
        return 0


def save_room(code: str, room: dict[str, Any]) -> None:
    try:
        room["rev"] = int(room.get("rev") or 0) + 1
    except (TypeError, ValueError):
        room["rev"] = 1
    rds.setex(room_key(code), ROOM_TTL, json.dumps(room, ensure_ascii=False))


def load_room(code: str) -> dict[str, Any] | None:
    if not code.isdigit() or len(code) != CODE_LEN:
        return None
    raw = rds.get(room_key(code))
    if raw is None or raw == "":
        return None
    if isinstance(raw, dict):
        return raw
    try:
        data = json.loads(raw)
    except (TypeError, ValueError, json.JSONDecodeError):
        return None
    return data if isinstance(data, dict) else None


def delete_room(code: str) -> None:
    rds.delete(room_key(code))


def random_animal(exclude: str | None = None) -> str:
    pool = [a for a in ANIMAL_NAMES if a != exclude] or list(ANIMAL_NAMES)
    return random.choice(pool)


def normalize_name(raw: Any, fallback: str | None = None) -> str:
    name = str(raw or "").strip()[:20]
    name = SAFE_NAME_RE.sub("", name).strip()
    if name:
        return name
    return fallback if fallback is not None else random_animal()


def valid_token(token: str) -> bool:
    return bool(token and TOKEN_RE.match(token))


def player_slot(room: dict[str, Any], token: str) -> str | None:
    if not valid_token(token):
        return None
    for slot, p in (room.get("players") or {}).items():
        if p and p.get("token") == token:
            return slot
    return None


def opponent(slot: str) -> str:
    return "p2" if slot == "p1" else "p1"


def filled_slots(room: dict[str, Any]) -> list[str]:
    return [s for s in SLOTS if room.get("players", {}).get(s)]


def empty_slot(room: dict[str, Any]) -> str | None:
    max_p = int(room.get("max_players") or 2)
    for s in SLOTS[:max_p]:
        if not room.get("players", {}).get(s):
            return s
    return None


def _promote_lobby_host(room: dict[str, Any]) -> None:
    """Если p1 вышел из лобби — передать организатора следующему игроку."""
    players = room.get("players") or {}
    if players.get("p1"):
        return
    max_p = int(room.get("max_players") or 2)
    for s in SLOTS[1:max_p]:
        if players.get(s):
            players["p1"] = players[s]
            players[s] = None
            return


def _lobby_status_message(room: dict[str, Any]) -> str:
    max_p = int(room.get("max_players") or 2)
    filled = len(filled_slots(room))
    names = [
        p["name"]
        for s in SLOTS[:max_p]
        for p in [(room.get("players") or {}).get(s)]
        if p
    ]
    if seats_ready(room):
        return f"Все на месте · организатор может начать · {filled}/{max_p}"
    return f"В лобби: {', '.join(names)} · ждём игроков… {filled}/{max_p}"


def max_players_for(game_id: str, data: dict[str, Any] | None = None) -> int:
    data = data or {}
    if game_id in ("durak", "blik"):
        try:
            n = int(data.get("players") or data.get("max_players") or 2)
        except (TypeError, ValueError):
            n = 2
        return max(2, min(4, n))
    return 2


def seats_ready(room: dict[str, Any]) -> bool:
    return len(filled_slots(room)) >= int(room.get("max_players") or 2)


def start_game_room(room: dict[str, Any]) -> None:
    mod = get_game(room["game"])
    if not mod:
        return
    room["rematch_votes"] = {}
    room["winner"] = None
    room["winners"] = None
    room["loser"] = None
    room["result"] = None
    if hasattr(mod, "on_players_ready"):
        mod.on_players_ready(room)
    else:
        mod.on_both_joined(room)
    maybe_schedule_ai(room)


def restart_game_room(room: dict[str, Any]) -> None:
    """Новая партия с теми же игроками и токенами."""
    mod = get_game(room["game"])
    if not mod:
        return
    options: dict[str, Any] = {}
    if room["game"] == "seabattle":
        options["size"] = (room.get("state") or {}).get("size") or "medium"
    if room["game"] in ("durak", "blik"):
        options["players"] = int(room.get("max_players") or 2)
        options["max_players"] = options["players"]
    if hasattr(mod, "rematch_options"):
        try:
            options.update(mod.rematch_options(room) or {})
        except Exception:
            pass
    room["state"] = mod.init_state(options)
    room["turn"] = None
    room["ai_due"] = None
    room["ratings_recorded"] = False
    start_game_room(room)


def read_json() -> dict[str, Any] | None:
    if request.content_length and request.content_length > MAX_JSON_BYTES:
        return None
    data = request.get_json(silent=True)
    if data is None:
        return {}
    if not isinstance(data, dict) or len(data) > 40:
        return None
    return data


def public_state(room: dict[str, Any], viewer: str | None) -> dict[str, Any]:
    game_id = room["game"]
    meta = GAMES[game_id]
    mod = meta["module"]
    players_out = {}
    max_p = int(room.get("max_players") or 2)
    for slot in SLOTS[:max_p]:
        p = (room.get("players") or {}).get(slot)
        players_out[slot] = None if not p else {
            "name": p["name"],
            "connected": True,
            "ai": bool(p.get("ai")),
            "rematch": bool((room.get("rematch_votes") or {}).get(slot)),
        }

    game_view = mod.public_view(room, viewer)
    win_pct = None
    if room.get("vs_ai") and viewer and room["players"].get(viewer) and not room["players"][viewer].get("ai"):
        if hasattr(mod, "win_chance"):
            try:
                win_pct = int(mod.win_chance(room, viewer))
                win_pct = max(0, min(100, win_pct))
            except Exception:
                win_pct = None
    human_slots = [s for s, p in (room.get("players") or {}).items() if p and not p.get("ai")]
    votes = room.get("rematch_votes") or {}
    return {
        "code": room["code"],
        "game": game_id,
        "game_title": meta["title"],
        "phase": room["phase"],
        "turn": room.get("turn"),
        "winner": room.get("winner"),
        "winners": room.get("winners"),
        "loser": room.get("loser"),
        "result": room.get("result"),
        "message": room.get("message", ""),
        "players": players_out,
        "you": viewer,
        "your_name": room["players"][viewer]["name"] if viewer and room["players"].get(viewer) else None,
        "vs_ai": bool(room.get("vs_ai")),
        "vs_local": bool(room.get("vs_local")),
        "max_players": int(room.get("max_players") or 2),
        "players_count": len(filled_slots(room)),
        "is_host": viewer == "p1",
        "can_start": (
            room.get("phase") == "lobby"
            and not room.get("vs_ai")
            and not room.get("vs_local")
            and seats_ready(room)
        ),
        "rematch_votes": {s: bool(votes.get(s)) for s in human_slots},
        "rematch_ready": bool(human_slots) and all(votes.get(s) for s in human_slots),
        "win_chance": win_pct,
        "rev": int(room.get("rev") or 0),
        "game_state": game_view,
    }


def schedule_ai(room: dict[str, Any]) -> None:
    """Отложить ход робота ~на секунду, чтобы не ходил мгновенно."""
    if not room.get("vs_ai"):
        return
    room["ai_due"] = time.time() + AI_THINK_SEC


def ai_should_act(room: dict[str, Any]) -> bool:
    if not room.get("vs_ai") or room.get("phase") == "done":
        return False
    ai_slot = room.get("ai_slot") or "p2"
    if room["game"] == "seabattle" and room["phase"] == "placing":
        return not bool(room["state"]["ready"].get(ai_slot))
    return room["phase"] == "playing" and room.get("turn") == ai_slot


def maybe_schedule_ai(room: dict[str, Any]) -> None:
    if ai_should_act(room):
        schedule_ai(room)


def run_ai_turns(room: dict[str, Any]) -> None:
    """Сделать ходы компьютера, пока его очередь / пока не разместил флот."""
    if not room.get("vs_ai"):
        return
    due = float(room.get("ai_due") or 0)
    if due and time.time() < due:
        return

    ai_slot = room.get("ai_slot") or "p2"
    mod = get_game(room["game"])
    if not mod or not hasattr(mod, "ai_action"):
        return

    acted = False
    for _ in range(60):
        if room["phase"] == "done":
            break

        # морской бой: AI ставит корабли в фазе placing
        if room["game"] == "seabattle" and room["phase"] == "placing":
            if room["state"]["ready"].get(ai_slot):
                break
            action = mod.ai_action(room, ai_slot)
            if not action:
                break
            ok, _ = mod.apply_action(room, ai_slot, action)
            if not ok:
                break
            acted = True
            continue

        if room["phase"] != "playing":
            break
        if room.get("turn") != ai_slot:
            break

        action = mod.ai_action(room, ai_slot)
        if not action:
            break
        ok, err = mod.apply_action(room, ai_slot, action)
        if not ok:
            # если AI не смог — не крутимся вечно
            room["message"] = room.get("message") or f"Компьютер: {err}"
            break
        acted = True

    if acted:
        room.pop("ai_due", None)
    elif ai_should_act(room) and not room.get("ai_due"):
        # ещё должен ходить, но хода не вышло — не крутимся; ждём следующий poll
        schedule_ai(room)

@app.before_request
def security_gate():
    g.client_ip = client_ip()
    g.user = None
    # отсекаем явно битые пути
    path = request.path or "/"
    if ".." in path or path.startswith("//"):
        return jsonify({"ok": False, "error": "Forbidden"}), 403

    sid = request.cookies.get(auth_mod.SESSION_COOKIE) or ""
    if sid:
        try:
            g.user = auth_mod.user_from_session(sid)
        except Exception:
            g.user = None

    if request.method == "POST":
        ip = g.client_ip
        if not rate_limit(f"write:{ip}", RL_GLOBAL_WRITE[0], RL_GLOBAL_WRITE[1]):
            return too_many()


@app.after_request
def security_headers(resp):
    resp.headers["X-Content-Type-Options"] = "nosniff"
    # SAMEORIGIN — DENY мешает проверке счётчика Яндекс.Метрики в части сценариев
    resp.headers["X-Frame-Options"] = "SAMEORIGIN"
    # strict-origin-when-cross-origin — чтобы Яндекс.Метрика видела переходы
    resp.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    resp.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    resp.headers["Cache-Control"] = resp.headers.get("Cache-Control") or "no-store"
    # не светим детали сервера
    resp.headers.pop("Server", None)
    return resp


@app.errorhandler(413)
def too_large(_err):
    return jsonify({"ok": False, "error": "Слишком большой запрос"}), 413


@app.errorhandler(404)
def not_found(_err):
    if request.path.startswith("/api/"):
        return jsonify({"ok": False, "error": "Не найдено"}), 404
    return jsonify({"ok": False, "error": "Не найдено"}), 404


@app.errorhandler(500)
def server_error(_err):
    return jsonify({"ok": False, "error": "Ошибка сервера"}), 500


@app.get("/")
def index():
    track_visit(rds, g.client_ip)
    return render_template("index.html", games=GAMES, site_title=SITE_TITLE)


@app.get(f"/{STATS_PATH}")
def stats_page():
    return render_template(
        "stats.html",
        stats_api=f"/{STATS_PATH}/api",
        site_title=SITE_TITLE,
    )


@app.get(f"/{STATS_PATH}/api")
def api_stats():
    return jsonify(stats_snapshot(rds, GAMES, count_rooms))


@app.get("/stats")
@app.get("/api/stats")
def stats_hidden():
    return jsonify({"ok": False, "error": "Не найдено"}), 404


@app.get("/api/games")
def list_games():
    return jsonify({
        "ok": True,
        "games": [
            {"id": gid, "title": meta["title"], "blurb": meta["blurb"]}
            for gid, meta in GAMES.items()
            if not meta.get("hidden")
        ],
    })


@app.get("/api/me")
def api_me():
    return jsonify({"ok": True, "user": current_user()})


@app.get("/api/profile")
def api_profile():
    """Профиль текущего пользователя: общие и поигровые счётчики."""
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "Нужно войти"}), 401
    try:
        by_game = rating_user_game_stats(int(user["id"]))
    except Exception:
        by_game = []
    # подписи и порядок известных игр
    known = []
    seen = set()
    for gid, meta in GAMES.items():
        if meta.get("hidden"):
            continue
        seen.add(gid)
        row = next((x for x in by_game if x.get("game") == gid), None)
        known.append(
            {
                "game": gid,
                "title": meta.get("title") or gid,
                "wins": int((row or {}).get("wins") or 0),
                "games": int((row or {}).get("games") or 0),
            }
        )
    for row in by_game:
        gid = str(row.get("game") or "")
        if not gid or gid in seen:
            continue
        known.append(
            {
                "game": gid,
                "title": gid,
                "wins": int(row.get("wins") or 0),
                "games": int(row.get("games") or 0),
            }
        )
    return jsonify(
        {
            "ok": True,
            "user": user,
            "by_game": known,
            "totals": {
                "wins": int(user.get("wins") or 0),
                "games": int(user.get("games") or 0),
            },
        }
    )


@app.post("/api/auth/request-link")
def api_auth_request_link():
    ip = g.client_ip
    data = read_json()
    if data is None:
        return jsonify({"ok": False, "error": "Неверный запрос"}), 400
    email = auth_mod.normalize_email(data.get("email"))
    if not email:
        return jsonify({"ok": False, "error": "Укажи корректный email"}), 400
    # сначала проверяем лимиты, не сжигая попытки на невалидном email
    if not rate_limit(f"authip:{ip}", RL_AUTH_IP[0], RL_AUTH_IP[1]):
        return too_many()
    if not rate_limit(f"authemail:{email}", RL_AUTH_EMAIL[0], RL_AUTH_EMAIL[1]):
        return jsonify({
            "ok": False,
            "error": "На этот email уже отправляли код. Подожди немного или проверь почту (и «Спам»).",
        }), 429
    try:
        result = auth_mod.request_login_link(email, data.get("name"))
    except Exception:
        return jsonify({"ok": False, "error": "Не удалось отправить письмо. Попробуй позже."}), 502
    if not result.get("ok"):
        return jsonify(result), 400
    payload = {
        "ok": True,
        "email": result.get("email"),
        "message": "Код для входа отправлен на email",
    }
    if result.get("hint"):
        payload["hint"] = result["hint"]
    return jsonify(payload)


@app.post("/api/auth/verify")
def api_auth_verify():
    ip = g.client_ip
    if not rate_limit(f"authv:{ip}", 20, 60):
        return too_many()
    data = read_json()
    if data is None:
        return jsonify({"ok": False, "error": "Неверный запрос"}), 400
    token = auth_mod.normalize_magic_token(data.get("token") or data.get("code"))
    try:
        result = auth_mod.consume_magic_token(token)
    except Exception:
        return jsonify({"ok": False, "error": "Ошибка авторизации"}), 500
    if not result:
        return jsonify({"ok": False, "error": "Код неверный или устарел. Запроси новый."}), 400
    resp = make_response(jsonify({"ok": True, "user": result["user"]}))
    return set_session_cookie(resp, result["session"])


@app.get("/a/<token>")
def auth_click_link(token: str):
    """Открытие ссылки из письма: только страница подтверждения.

    Почтовые сканеры часто делают GET заранее и иначе сжигают одноразовый токен.
    """
    ip = g.client_ip
    if not rate_limit(f"authv:{ip}", 40, 60):
        return too_many()
    try:
        info = auth_mod.peek_magic_token(token)
    except Exception:
        info = None
    if not info:
        return render_template(
            "auth_confirm.html",
            site_title=SITE_TITLE,
            invalid=True,
            token="",
            name="",
        )
    return render_template(
        "auth_confirm.html",
        site_title=SITE_TITLE,
        invalid=False,
        token=info["token"],
        name=info.get("name") or "",
    )


@app.post("/a/<token>")
def auth_confirm_link(token: str):
    """Подтверждение входа кнопкой — здесь токен погашается."""
    ip = g.client_ip
    if not rate_limit(f"authv:{ip}", 40, 60):
        return too_many()
    # POST тоже проходит global write rate-limit в before_request
    try:
        result = auth_mod.consume_magic_token(token)
    except Exception:
        result = None
    if not result:
        return render_template(
            "auth_confirm.html",
            site_title=SITE_TITLE,
            invalid=True,
            token="",
            name="",
        )
    resp = make_response(redirect("/?auth_ok=1", code=302))
    return set_session_cookie(resp, result["session"])


@app.post("/api/auth/logout")
def api_auth_logout():
    sid = request.cookies.get(auth_mod.SESSION_COOKIE) or ""
    try:
        auth_mod.delete_session(sid)
    except Exception:
        pass
    resp = make_response(jsonify({"ok": True}))
    return clear_session_cookie(resp)


@app.get("/api/rating")
def api_rating():
    try:
        limit = int(request.args.get("limit") or 20)
    except (TypeError, ValueError):
        limit = 20
    try:
        rows = rating_leaderboard(limit)
    except Exception:
        rows = []
    return jsonify({"ok": True, "rating": rows, "user": current_user()})


@app.post("/api/room/create")
def create_room():
    ip = g.client_ip
    if not rate_limit(f"create:{ip}", RL_CREATE[0], RL_CREATE[1]):
        return too_many()
    if count_rooms() >= MAX_ROOMS:
        return jsonify({"ok": False, "error": "Сервер занят, попробуй позже"}), 503

    data = read_json()
    if data is None:
        return jsonify({"ok": False, "error": "Неверный запрос"}), 400
    game_id = str(data.get("game") or "").lower()
    if game_id not in GAMES:
        return jsonify({"ok": False, "error": "Выбери игру"}), 400
    mod = GAMES[game_id]["module"]
    user = current_user()
    default_name = (user or {}).get("name") if user else None
    name = normalize_name(data.get("name"), default_name)
    name2 = normalize_name(data.get("name2"), random_animal(name))
    vs_ai = bool(data.get("vs_ai"))
    vs_local = bool(data.get("vs_local"))
    if vs_ai and vs_local:
        return jsonify({"ok": False, "error": "Выбери один режим"}), 400
    # vs AI / local — всегда двое; по сети для дурака 2–4
    max_p = 2 if (vs_ai or vs_local) else max_players_for(game_id, data)
    code = new_code()
    token = secrets.token_hex(16)
    size = data.get("size")
    options: dict[str, Any] = {}
    if game_id == "seabattle":
        options["size"] = size if size in ("small", "medium", "large") else "medium"
    if game_id in ("durak", "blik"):
        options["players"] = max_p
        options["max_players"] = max_p

    if vs_local:
        msg = "Игра вдвоём на одном устройстве"
    elif vs_ai:
        msg = "Игра с компьютером"
    else:
        msg = f"В лобби: {name} · ждём игроков… 1/{max_p}"

    players = {s: None for s in SLOTS[:max_p]}
    players["p1"] = {"token": token, "name": name, "ai": False}
    attach_user_to_player(players["p1"], user)
    room = {
        "code": code,
        "game": game_id,
        "phase": "lobby",
        "created": time.time(),
        "turn": None,
        "winner": None,
        "winners": None,
        "loser": None,
        "result": None,
        "message": msg,
        "vs_ai": vs_ai,
        "vs_local": vs_local,
        "max_players": max_p,
        "ai_slot": "p2" if vs_ai else None,
        "players": players,
        "rematch_votes": {},
        "ratings_recorded": False,
        "state": mod.init_state(options),
    }

    tokens_out = {s: None for s in SLOTS[:max_p]}
    tokens_out["p1"] = token

    if vs_ai:
        room["players"]["p2"] = {
            "token": secrets.token_hex(16),
            "name": AI_NAME,
            "ai": True,
        }
        start_game_room(room)
    elif vs_local:
        token2 = secrets.token_hex(16)
        room["players"]["p2"] = {
            "token": token2,
            "name": name2,
            "ai": False,
        }
        tokens_out["p2"] = token2
        start_game_room(room)

    save_room(code, room)
    track_room_created(rds, game_id, vs_ai, vs_local)
    payload = {
        "ok": True,
        "code": code,
        "token": token,
        "slot": "p1",
        "vs_local": vs_local,
        "max_players": max_p,
        "tokens": tokens_out,
        "state": public_state(room, "p1"),
    }
    return jsonify(payload)


@app.post("/api/room/join")
def join_room():
    ip = g.client_ip
    if not rate_limit(f"join:{ip}", RL_JOIN[0], RL_JOIN[1]):
        return too_many()

    data = read_json()
    if data is None:
        return jsonify({"ok": False, "error": "Неверный запрос"}), 400
    code = str(data.get("code", "")).strip()
    user = current_user()
    name = normalize_name(data.get("name"), (user or {}).get("name") if user else None)
    token_in = str(data.get("token") or "")
    if not code.isdigit() or len(code) != CODE_LEN:
        return jsonify({"ok": False, "error": "Код — 6 цифр"}), 400
    room = load_room(code)
    if not room:
        return jsonify({"ok": False, "error": "Комната не найдена"}), 404
    if room.get("vs_ai"):
        return jsonify({"ok": False, "error": "Это партия с компьютером"}), 409
    if room.get("vs_local"):
        return jsonify({"ok": False, "error": "Это локальная партия на одном устройстве"}), 409

    # Переподключение в уже идущую партию по своему токену
    if valid_token(token_in):
        seat = player_slot(room, token_in)
        if seat:
            player = room["players"].get(seat) or {}
            player["connected"] = True
            player.pop("disconnected_at", None)
            if name:
                player["name"] = name
            attach_user_to_player(player, current_user())
            room["players"][seat] = player
            save_room(code, room)
            return jsonify({
                "ok": True,
                "code": code,
                "token": token_in,
                "slot": seat,
                "reconnected": True,
                "state": public_state(room, seat),
            })

    if room["phase"] != "lobby":
        return jsonify({
            "ok": False,
            "error": "Игра уже началась. Открой ту же вкладку или войди с того же устройства — сессия восстановится сама.",
        }), 409

    seat = empty_slot(room)
    if not seat:
        return jsonify({"ok": False, "error": "Комната уже заполнена"}), 409

    token = secrets.token_hex(16)
    room["players"][seat] = {"token": token, "name": name, "ai": False, "connected": True}
    attach_user_to_player(room["players"][seat], current_user())
    filled = len(filled_slots(room))
    max_p = int(room.get("max_players") or 2)
    names = [
        p["name"]
        for s in SLOTS[:max_p]
        for p in [(room.get("players") or {}).get(s)]
        if p
    ]
    if seats_ready(room):
        room["message"] = f"Все на месте · организатор может начать · {filled}/{max_p}"
    else:
        room["message"] = f"В лобби: {', '.join(names)} · ждём игроков… {filled}/{max_p}"
    save_room(code, room)
    track_join(rds)
    return jsonify({
        "ok": True,
        "code": code,
        "token": token,
        "slot": seat,
        "state": public_state(room, seat),
    })


@app.post("/api/room/<code>/start")
def start_room(code: str):
    """Организатор (p1) запускает сетевую партию, когда все места заняты."""
    ip = g.client_ip
    if not rate_limit(f"action:{ip}", RL_ACTION[0], RL_ACTION[1]):
        return too_many()
    room = load_room(code)
    if not room:
        return jsonify({"ok": False, "error": "Комната не найдена"}), 404
    data = read_json()
    if data is None:
        return jsonify({"ok": False, "error": "Неверный запрос"}), 400
    token = str(data.get("token", ""))
    slot = player_slot(room, token)
    if not slot:
        return jsonify({"ok": False, "error": "Нет доступа"}), 403
    if slot != "p1":
        return jsonify({"ok": False, "error": "Начать игру может только организатор"}), 403
    if room.get("vs_ai") or room.get("vs_local"):
        return jsonify({"ok": False, "error": "Эта партия уже запущена"}), 409
    if room["phase"] != "lobby":
        return jsonify({"ok": False, "error": "Игра уже началась"}), 409
    if not seats_ready(room):
        return jsonify({"ok": False, "error": "Ещё не все игроки в лобби"}), 409
    start_game_room(room)
    save_room(code, room)
    return jsonify({"ok": True, "state": public_state(room, slot)})


@app.get("/api/room/<code>")
def get_room(code: str):
    ip = g.client_ip
    if not rate_limit(f"poll:{ip}", RL_POLL[0], RL_POLL[1]):
        return too_many()
    # короткий повтор при гонке чтения/записи на FileStore
    room = load_room(code)
    if not room:
        time.sleep(0.05)
        room = load_room(code)
    if not room:
        return jsonify({"ok": False, "error": "Комната не найдена"}), 404
    dirty = False
    mod = get_game(room.get("game") or "")
    if mod and hasattr(mod, "tick"):
        try:
            if mod.tick(room):
                dirty = True
        except Exception:
            pass
    # если vs AI и почему-то не доиграл ход — догоняем
    if room.get("vs_ai"):
        was_done = room.get("phase") == "done"
        before = json.dumps(room, sort_keys=True, default=str)
        run_ai_turns(room)
        after = json.dumps(room, sort_keys=True, default=str)
        if (not was_done) and room.get("phase") == "done":
            mark_game_finished(room)
            dirty = True
        if before != after:
            dirty = True
    token = str(request.args.get("token", ""))
    slot = player_slot(room, token) if token else None
    # обновляем TTL комнаты, чтобы длинная партия не протухла
    if slot:
        try:
            rds.expire(room_key(code), ROOM_TTL)
        except RedisError:
            dirty = True
    if dirty:
        save_room(code, room)
    return jsonify({"ok": True, "state": public_state(room, slot)})


@app.post("/api/room/<code>/action")
def room_action(code: str):
    ip = g.client_ip
    if not rate_limit(f"action:{ip}", RL_ACTION[0], RL_ACTION[1]):
        return too_many()
    room = load_room(code)
    if not room:
        return jsonify({"ok": False, "error": "Комната не найдена"}), 404
    data = read_json()
    if data is None:
        return jsonify({"ok": False, "error": "Неверный запрос"}), 400
    token = str(data.get("token", ""))
    slot = player_slot(room, token)
    if not slot:
        return jsonify({"ok": False, "error": "Нет доступа"}), 403
    if room["players"].get(slot, {}).get("ai"):
        return jsonify({"ok": False, "error": "Ход компьютера"}), 403
    if room["phase"] == "lobby" or not seats_ready(room):
        return jsonify({"ok": False, "error": "Ждём игроков"}), 409

    mod = get_game(room["game"])
    if mod and hasattr(mod, "tick"):
        try:
            mod.tick(room)
        except Exception:
            pass
    was_done = room.get("phase") == "done"
    ok, err = mod.apply_action(room, slot, data)
    if not ok:
        return jsonify({"ok": False, "error": err}), 400

    maybe_schedule_ai(room)
    if room.get("vs_ai"):
        run_ai_turns(room)
    if (not was_done) and room.get("phase") == "done":
        mark_game_finished(room)
    save_room(code, room)
    return jsonify({"ok": True, "state": public_state(room, slot)})


@app.post("/api/room/<code>/rematch")
def rematch_room(code: str):
    """Играть заново с теми же людьми в этой комнате."""
    room = load_room(code)
    if not room:
        return jsonify({"ok": False, "error": "Комната не найдена"}), 404
    data = read_json()
    if data is None:
        return jsonify({"ok": False, "error": "Неверный запрос"}), 400
    token = str(data.get("token", ""))
    slot = player_slot(room, token)
    if not slot:
        return jsonify({"ok": False, "error": "Нет доступа"}), 403
    # повторный клик / другой игрок уже перезапустил — отдаём актуальное состояние,
    # а не ошибку «партия ещё не окончена»
    if room["phase"] != "done":
        return jsonify({
            "ok": True,
            "restarted": False,
            "already_started": True,
            "state": public_state(room, slot),
        })

    votes = room.setdefault("rematch_votes", {})
    # локально / с роботом — сразу новая партия
    if room.get("vs_ai") or room.get("vs_local"):
        restart_game_room(room)
        save_room(code, room)
        return jsonify({"ok": True, "restarted": True, "state": public_state(room, slot)})

    # уже голосовал — не дублируем, просто вернём состояние (ждём остальных)
    if votes.get(slot):
        return jsonify({
            "ok": True,
            "restarted": False,
            "state": public_state(room, slot),
        })

    votes[slot] = True
    humans = [s for s, p in (room.get("players") or {}).items() if p and not p.get("ai")]
    room["message"] = f"Играть заново: {sum(1 for s in humans if votes.get(s))}/{len(humans)}"
    if humans and all(votes.get(s) for s in humans):
        restart_game_room(room)
        restarted = True
    else:
        restarted = False
    save_room(code, room)
    return jsonify({"ok": True, "restarted": restarted, "state": public_state(room, slot)})


@app.post("/api/room/<code>/leave")
def leave_room(code: str):
    room = load_room(code)
    if not room:
        return jsonify({"ok": True, "left": True})
    data = read_json()
    if data is None:
        return jsonify({"ok": False, "error": "Неверный запрос"}), 400
    token = str(data.get("token", ""))
    slot = player_slot(room, token)
    if not slot:
        return jsonify({"ok": True, "left": True})
    if room["players"].get(slot, {}).get("ai"):
        return jsonify({"ok": False, "error": "Нельзя"}), 403

    leaver = room["players"][slot]["name"]

    if room.get("vs_ai") or room.get("vs_local"):
        delete_room(code)
        return jsonify({"ok": True, "left": True})

    if room["phase"] == "lobby":
        room["players"][slot] = None
        _promote_lobby_host(room)
        if not filled_slots(room):
            delete_room(code)
            return jsonify({"ok": True, "left": True})
        room["message"] = _lobby_status_message(room)
        save_room(code, room)
        return jsonify({"ok": True, "left": True})

    if room["phase"] in ("placing", "playing", "done"):
        others = [
            (s, p) for s, p in (room.get("players") or {}).items()
            if p and s != slot and not p.get("ai")
        ]
        room["players"][slot] = None
        if room["phase"] == "done":
            # вышел после игры — комната живёт для рематча остальных
            if not others:
                delete_room(code)
                return jsonify({"ok": True, "left": True})
            save_room(code, room)
            return jsonify({"ok": True, "left": True})

        room["phase"] = "done"
        room["turn"] = None
        room["result"] = "abort"
        if len(others) == 1:
            room["winner"] = others[0][0]
            room["message"] = f"{leaver} вышел. Победа за {others[0][1]['name']}!"
        else:
            room["winner"] = None
            room["message"] = f"{leaver} вышел. Партия окончена"
        mark_game_finished(room)
        save_room(code, room)
        return jsonify({"ok": True, "left": True})

    delete_room(code)
    return jsonify({"ok": True, "left": True})


@app.get("/api/health")
def health():
    try:
        rds.ping()
        return jsonify({"ok": True, "store": type(rds).__name__})
    except RedisError:
        return jsonify({"ok": False, "store": type(rds).__name__}), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=18090, debug=False)
