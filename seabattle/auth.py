"""Регистрация и вход по magic-link на email."""
from __future__ import annotations

import re
import secrets
import subprocess
import time
from email.header import Header
from email.utils import formataddr, parseaddr
from typing import Any, Optional

from db import connect, ensure_schema, load_config

EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")
SAFE_NAME_RE = re.compile(r"[\x00-\x1f\x7f<>{}[\]\\\"`]")
MAGIC_TTL = 30 * 60
SESSION_TTL = 60 * 60 * 24 * 30
SESSION_COOKIE = "omove_sid"


def normalize_email(raw: Any) -> str:
    email = str(raw or "").strip().lower()
    if len(email) > 191 or not EMAIL_RE.match(email):
        return ""
    return email


def normalize_display_name(raw: Any, fallback: str = "Игрок") -> str:
    name = SAFE_NAME_RE.sub("", str(raw or "").strip())[:20].strip()
    return name or fallback


def public_user(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": int(row["id"]),
        "email": str(row["email"]),
        "name": str(row["name"]),
        "wins": int(row.get("wins") or 0),
        "games": int(row.get("games") or 0),
    }


def site_base_url() -> str:
    cfg = load_config()
    url = str(cfg.get("site_url") or "https://omove.ru").strip().rstrip("/")
    return url or "https://omove.ru"


def mail_from_addr() -> str:
    cfg = load_config()
    addr = str(cfg.get("mail_from") or "noreply@omove.ru").strip()
    name, email = parseaddr(addr)
    if not email:
        email = "noreply@omove.ru"
    display = name or "Omove.ru"
    return formataddr((str(Header(display, "utf-8")), email))


def send_email(to_addr: str, subject: str, body: str) -> None:
    to_addr = normalize_email(to_addr)
    if not to_addr:
        raise ValueError("Некорректный email")
    from_addr = mail_from_addr()
    _, from_email = parseaddr(from_addr)
    payload = (
        f"From: {from_addr}\r\n"
        f"To: {to_addr}\r\n"
        f"Subject: {Header(subject, 'utf-8')}\r\n"
        "MIME-Version: 1.0\r\n"
        "Content-Type: text/plain; charset=utf-8\r\n"
        "Content-Transfer-Encoding: 8bit\r\n"
        "\r\n"
        f"{body}"
    ).encode("utf-8")
    proc = subprocess.run(
        ["/usr/sbin/sendmail", "-i", "-f", from_email or "noreply@omove.ru", "--", to_addr],
        input=payload,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=20,
        check=False,
    )
    if proc.returncode != 0:
        err = (proc.stderr or b"").decode("utf-8", errors="replace")[:300]
        raise RuntimeError(err or "Не удалось отправить письмо")


def create_magic_link(email: str, name: str) -> str:
    ensure_schema()
    token = secrets.token_hex(32)
    exp = time.time() + MAGIC_TTL
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM `omove_magic` WHERE `email`=%s OR `exp` <= %s",
                (email, time.time()),
            )
            cur.execute(
                "INSERT INTO `omove_magic` (`token`, `email`, `name`, `exp`) VALUES (%s, %s, %s, %s)",
                (token, email, name, exp),
            )
    return token


def request_login_link(email_raw: Any, name_raw: Any) -> dict[str, Any]:
    email = normalize_email(email_raw)
    if not email:
        return {"ok": False, "error": "Укажи корректный email"}
    name = normalize_display_name(name_raw)
    token = create_magic_link(email, name)
    link = f"{site_base_url()}/?auth={token}"
    body = (
        f"Привет!\n\n"
        f"Чтобы войти на Omove.ru как «{name}», открой ссылку:\n\n"
        f"{link}\n\n"
        f"Ссылка действует 30 минут. Если ты не запрашивал вход — просто игнорируй письмо.\n"
    )
    send_email(email, "Вход на Omove.ru", body)
    return {"ok": True, "email": email}


def get_user_by_id(user_id: int) -> Optional[dict[str, Any]]:
    ensure_schema()
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT `id`, `email`, `name`, `wins`, `games` FROM `omove_users` WHERE `id`=%s LIMIT 1",
                (int(user_id),),
            )
            row = cur.fetchone()
    return public_user(row) if row else None


def get_user_by_email(email: str) -> Optional[dict[str, Any]]:
    ensure_schema()
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT `id`, `email`, `name`, `wins`, `games` FROM `omove_users` WHERE `email`=%s LIMIT 1",
                (email,),
            )
            row = cur.fetchone()
    return public_user(row) if row else None


def upsert_user(email: str, name: str) -> dict[str, Any]:
    ensure_schema()
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT `id`, `email`, `name`, `wins`, `games` FROM `omove_users` WHERE `email`=%s LIMIT 1",
                (email,),
            )
            row = cur.fetchone()
            if row:
                cur.execute(
                    "UPDATE `omove_users` SET `name`=%s WHERE `id`=%s",
                    (name, int(row["id"])),
                )
                row["name"] = name
                return public_user(row)
            cur.execute(
                "INSERT INTO `omove_users` (`email`, `name`) VALUES (%s, %s)",
                (email, name),
            )
            uid = int(cur.lastrowid)
    return get_user_by_id(uid) or {"id": uid, "email": email, "name": name, "wins": 0, "games": 0}


def create_session(user_id: int) -> str:
    ensure_schema()
    token = secrets.token_hex(32)
    exp = time.time() + SESSION_TTL
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM `omove_sessions` WHERE `user_id`=%s OR `exp` <= %s",
                (int(user_id), time.time()),
            )
            cur.execute(
                "INSERT INTO `omove_sessions` (`token`, `user_id`, `exp`) VALUES (%s, %s, %s)",
                (token, int(user_id), exp),
            )
    return token


def user_from_session(token: str) -> Optional[dict[str, Any]]:
    if not token or len(token) != 64:
        return None
    ensure_schema()
    now = time.time()
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT u.`id`, u.`email`, u.`name`, u.`wins`, u.`games`, s.`exp`
                FROM `omove_sessions` s
                JOIN `omove_users` u ON u.`id` = s.`user_id`
                WHERE s.`token`=%s
                LIMIT 1
                """,
                (token,),
            )
            row = cur.fetchone()
            if not row:
                return None
            if float(row["exp"]) <= now:
                cur.execute("DELETE FROM `omove_sessions` WHERE `token`=%s", (token,))
                return None
    return public_user(row)


def delete_session(token: str) -> None:
    if not token:
        return
    ensure_schema()
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM `omove_sessions` WHERE `token`=%s", (token,))


def consume_magic_token(token: str) -> Optional[dict[str, Any]]:
    if not token or len(token) != 64:
        return None
    ensure_schema()
    now = time.time()
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT `token`, `email`, `name`, `exp` FROM `omove_magic` WHERE `token`=%s LIMIT 1",
                (token,),
            )
            row = cur.fetchone()
            if not row:
                return None
            cur.execute("DELETE FROM `omove_magic` WHERE `token`=%s", (token,))
            if float(row["exp"]) <= now:
                return None
            email = normalize_email(row["email"])
            name = normalize_display_name(row["name"])
            if not email:
                return None
    user = upsert_user(email, name)
    sid = create_session(int(user["id"]))
    return {"user": user, "session": sid}
