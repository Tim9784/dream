#!/usr/bin/env python3
"""Багрепорт-бот Omove.ru: сообщения пользователей пересылаются админу."""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

BASE_DIR = Path(__file__).resolve().parent
ADMIN_FILE = BASE_DIR / "data" / "telegram_admin.json"
OFFSET_FILE = BASE_DIR / "data" / "telegram_offset.json"
CONFIG_CANDIDATES = [
    Path(os.environ.get("PANEL_CONFIG", "")),
    BASE_DIR / "config.json",
    Path("/opt/minecraft-panel/config.json"),
]


def _load_config() -> dict[str, Any]:
    for path in CONFIG_CANDIDATES:
        if not path or not str(path):
            continue
        try:
            if path.is_file():
                with path.open("r", encoding="utf-8") as fh:
                    data = json.load(fh)
                if isinstance(data, dict):
                    return data
        except Exception:
            continue
    return {}


def _api(token: str, method: str, payload: dict[str, Any] | None = None, timeout: int = 60) -> dict[str, Any]:
    url = f"https://api.telegram.org/bot{token}/{method}"
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method="POST" if data else "GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            out = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Telegram HTTP {exc.code}: {body}") from exc
    if not out.get("ok"):
        raise RuntimeError(f"Telegram error: {out}")
    return out


def _read_json(path: Path, default: Any) -> Any:
    try:
        if path.is_file():
            with path.open("r", encoding="utf-8") as fh:
                return json.load(fh)
    except Exception:
        pass
    return default


def _write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, mode=0o700, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as fh:
        json.dump(value, fh, ensure_ascii=False, indent=2)
    tmp.replace(path)


def _admin_id(cfg: dict[str, Any]) -> int | None:
    env = os.environ.get("TELEGRAM_ADMIN_CHAT_ID", "").strip()
    if env.isdigit():
        return int(env)
    raw = cfg.get("telegram_admin_chat_id")
    if raw is not None and str(raw).isdigit():
        return int(raw)
    data = _read_json(ADMIN_FILE, {})
    if isinstance(data, dict) and str(data.get("chat_id", "")).lstrip("-").isdigit():
        return int(data["chat_id"])
    return None


def _set_admin(chat_id: int, username: str | None = None) -> None:
    _write_json(ADMIN_FILE, {
        "chat_id": chat_id,
        "username": username,
        "set_at": int(time.time()),
    })


def _user_label(msg: dict[str, Any]) -> str:
    user = msg.get("from") or {}
    parts = []
    name = " ".join(x for x in [user.get("first_name"), user.get("last_name")] if x)
    if name:
        parts.append(name)
    if user.get("username"):
        parts.append(f"@{user['username']}")
    uid = user.get("id")
    if uid is not None:
        parts.append(f"id={uid}")
    return " · ".join(parts) if parts else "неизвестный"


def _send_text(token: str, chat_id: int, text: str) -> None:
    _api(token, "sendMessage", {
        "chat_id": chat_id,
        "text": text[:4000],
        "disable_web_page_preview": True,
    }, timeout=30)


def _forward(token: str, admin_id: int, from_chat_id: int, message_id: int) -> None:
    _api(token, "forwardMessage", {
        "chat_id": admin_id,
        "from_chat_id": from_chat_id,
        "message_id": message_id,
    }, timeout=30)


def _handle_message(token: str, cfg: dict[str, Any], msg: dict[str, Any]) -> None:
    chat = msg.get("chat") or {}
    chat_id = int(chat.get("id"))
    text = (msg.get("text") or "").strip()
    admin = _admin_id(cfg)

    if text.startswith("/start"):
        if admin is None:
            _set_admin(chat_id, (msg.get("from") or {}).get("username"))
            _send_text(
                token,
                chat_id,
                "Вы назначены получателем багрепортов Omove.ru.\n"
                "Все сообщения от игроков будут приходить сюда.\n\n"
                "Ссылка для игроков: https://t.me/Omovebugreport_bot",
            )
            return
        if chat_id == admin:
            _send_text(token, chat_id, "Бот багрепортов активен. Сообщения игроков будут пересылаться вам.")
            return
        _send_text(
            token,
            chat_id,
            "Привет! Это бот багрепортов Omove.ru.\n"
            "Опиши проблему одним сообщением — оно уйдёт разработчику.",
        )
        return

    if text.startswith("/whoami"):
        _send_text(token, chat_id, f"Ваш chat_id: {chat_id}")
        return

    if admin is None:
        _send_text(
            token,
            chat_id,
            "Получатель багрепортов ещё не настроен.\n"
            "Владелец сайта должен первым написать боту /start.",
        )
        return

    if chat_id == admin:
        _send_text(token, chat_id, "Это ваш бот багрепортов. Сообщения игроков приходят сюда автоматически.")
        return

    # Пересылаем админу + короткий заголовок
    header = f"🐞 Багрепорт\nОт: {_user_label(msg)}"
    try:
        _send_text(token, admin, header)
        _forward(token, admin, chat_id, int(msg["message_id"]))
        _send_text(token, chat_id, "Спасибо! Сообщение отправлено разработчику.")
    except Exception as exc:
        print(f"[bugreport] forward failed: {exc}", file=sys.stderr, flush=True)
        _send_text(token, chat_id, "Не удалось отправить. Попробуй ещё раз чуть позже.")


def main() -> None:
    cfg = _load_config()
    token = (
        os.environ.get("TELEGRAM_BOT_TOKEN")
        or os.environ.get("BOT_TOKEN")
        or str(cfg.get("telegram_bot_token") or "")
    ).strip()
    if not token:
        print("TELEGRAM_BOT_TOKEN / config.telegram_bot_token не задан", file=sys.stderr)
        sys.exit(1)

    me = _api(token, "getMe", timeout=20)["result"]
    print(f"[bugreport] bot @{me.get('username')} started", flush=True)
    try:
        _api(token, "setMyCommands", {
            "commands": [
                {"command": "start", "description": "Начать / привязать админа"},
                {"command": "whoami", "description": "Показать свой chat_id"},
            ]
        }, timeout=20)
    except Exception as exc:
        print(f"[bugreport] setMyCommands: {exc}", file=sys.stderr, flush=True)

    offset = int(_read_json(OFFSET_FILE, {}).get("offset") or 0)

    while True:
        try:
            res = _api(token, "getUpdates", {
                "offset": offset,
                "timeout": 50,
                "allowed_updates": ["message"],
            }, timeout=70)
            updates = res.get("result") or []
            for upd in updates:
                offset = max(offset, int(upd["update_id"]) + 1)
                _write_json(OFFSET_FILE, {"offset": offset})
                msg = upd.get("message")
                if not msg:
                    continue
                _handle_message(token, cfg, msg)
        except KeyboardInterrupt:
            print("[bugreport] stop", flush=True)
            break
        except Exception as exc:
            print(f"[bugreport] loop error: {exc}", file=sys.stderr, flush=True)
            time.sleep(3)


if __name__ == "__main__":
    main()
