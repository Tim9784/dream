"""Регистрация и вход по magic-link на email."""
from __future__ import annotations

import html
import re
import secrets
import smtplib
import subprocess
import time
from email import charset as charset_mod
from email.header import Header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr, formatdate, make_msgid, parseaddr
from typing import Any, Optional

from db import connect, ensure_schema, load_config

EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")
SAFE_NAME_RE = re.compile(r"[\x00-\x1f\x7f<>{}[\]\\\"`]")
# короткий токен: не ломается переносами в почтовых клиентах
TOKEN_RE = re.compile(r"^[0-9a-f]{16,64}$")
MAGIC_TTL = 30 * 60
SESSION_TTL = 60 * 60 * 24 * 30
SESSION_COOKIE = "omove_sid"

# не рвём URL quoted-printable переносами
charset_mod.add_charset("utf-8", charset_mod.BASE64, charset_mod.BASE64, "utf-8")


def normalize_email(raw: Any) -> str:
    email = str(raw or "").strip().lower()
    if len(email) > 191 or not EMAIL_RE.match(email):
        return ""
    return email


def normalize_display_name(raw: Any, fallback: str = "Игрок") -> str:
    name = SAFE_NAME_RE.sub("", str(raw or "").strip())[:20].strip()
    return name or fallback


def normalize_magic_token(raw: Any) -> str:
    token = str(raw or "").strip().lower()
    if not TOKEN_RE.match(token):
        return ""
    return token


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


def mail_from_parts() -> tuple[str, str]:
    """(display_from_header, envelope_from_email)"""
    cfg = load_config()
    addr = str(cfg.get("mail_from") or "Omove.ru <noreply@omove.ru>").strip()
    name, email = parseaddr(addr)
    if not email:
        email = "noreply@omove.ru"
    display = name or "Omove.ru"
    header = formataddr((str(Header(display, "utf-8")), email))
    return header, email


def build_login_email(name: str, link: str) -> tuple[str, str]:
    """Возвращает (text_body, html_body)."""
    safe_name = name.strip() or "Игрок"
    # короткая ссылка целиком на одной строке — её легко скопировать
    text = (
        "Omove.ru — вход\n"
        "\n"
        f"Привет, {safe_name}!\n"
        "\n"
        "Открой ссылку для входа (действует 30 минут):\n"
        f"{link}\n"
        "\n"
        "Если ты не запрашивал вход — просто удали письмо.\n"
    )
    href = html.escape(link, quote=True)
    name_html = html.escape(safe_name)
    # «Bulletproof»-кнопка таблицей — кликабельна в Yandex/Mail.ru/Outlook
    html_body = f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Вход на Omove.ru</title>
</head>
<body style="margin:0;padding:0;background:#0b1724;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0b1724;">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:480px;background:#102033;border:1px solid #27445f;">
          <tr>
            <td style="padding:28px 24px;font-family:Arial,Helvetica,sans-serif;color:#e8f1f8;">
              <div style="font-size:26px;font-weight:700;color:#7dd3fc;margin:0 0 16px 0;">Omove.ru</div>
              <div style="font-size:16px;line-height:1.5;margin:0 0 8px 0;">Привет, {name_html}!</div>
              <div style="font-size:15px;line-height:1.5;color:#c5d7e6;margin:0 0 22px 0;">
                Нажми кнопку, чтобы войти на сайт. Ссылка действует 30 минут.
              </div>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto 22px auto;">
                <tr>
                  <td align="center" bgcolor="#38bdf8" style="border-radius:10px;">
                    <a href="{href}" target="_blank"
                       style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#042029;text-decoration:none;border-radius:10px;">
                      Войти на Omove.ru
                    </a>
                  </td>
                </tr>
              </table>
              <div style="font-size:13px;line-height:1.5;color:#9db4c6;margin:0 0 6px 0;">Или открой ссылку:</div>
              <div style="font-size:14px;line-height:1.5;margin:0;">
                <a href="{href}" target="_blank" style="color:#7dd3fc;text-decoration:underline;">{href}</a>
              </div>
              <div style="font-size:12px;line-height:1.5;color:#6f8799;margin:20px 0 0 0;">
                Если ты не запрашивал вход — просто удали письмо.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
    return text, html_body


def _send_via_smtp(from_email: str, to_addr: str, raw_message: bytes) -> None:
    cfg = load_config()
    smtp_cfg = cfg.get("smtp") if isinstance(cfg.get("smtp"), dict) else {}
    host = str(smtp_cfg.get("host") or "").strip()
    if not host:
        raise RuntimeError("SMTP не настроен")
    port = int(smtp_cfg.get("port") or 587)
    user = str(smtp_cfg.get("user") or "").strip()
    password = str(smtp_cfg.get("password") or "")
    use_ssl = bool(smtp_cfg.get("ssl") or port == 465)
    use_tls = bool(smtp_cfg.get("tls", True)) and not use_ssl
    if use_ssl:
        server = smtplib.SMTP_SSL(host, port, timeout=20)
    else:
        server = smtplib.SMTP(host, port, timeout=20)
    try:
        server.ehlo()
        if use_tls:
            server.starttls()
            server.ehlo()
        if user:
            server.login(user, password)
        server.sendmail(from_email, [to_addr], raw_message)
    finally:
        try:
            server.quit()
        except Exception:
            pass


def _send_via_sendmail(from_email: str, to_addr: str, raw_message: bytes) -> None:
    # -t читает получателей из заголовков; -i не останавливается на строке "."
    proc = subprocess.run(
        ["/usr/sbin/sendmail", "-i", "-t", "-f", from_email or "noreply@omove.ru"],
        input=raw_message,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=20,
        check=False,
    )
    if proc.returncode != 0:
        err = (proc.stderr or b"").decode("utf-8", errors="replace")[:300]
        raise RuntimeError(err or "Не удалось отправить письмо")


def send_email(to_addr: str, subject: str, text_body: str, html_body: str | None = None) -> None:
    to_addr = normalize_email(to_addr)
    if not to_addr:
        raise ValueError("Некорректный email")
    from_header, from_email = mail_from_parts()

    if html_body:
        msg = MIMEMultipart("alternative")
        msg.attach(MIMEText(text_body, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))
    else:
        msg = MIMEText(text_body, "plain", "utf-8")

    msg["From"] = from_header
    msg["To"] = to_addr
    msg["Subject"] = str(Header(subject, "utf-8"))
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="omove.ru")
    msg["Reply-To"] = from_email
    msg["X-Mailer"] = "Omove.ru Auth"
    msg["Auto-Submitted"] = "auto-generated"
    msg["X-Auto-Response-Suppress"] = "All"

    raw = msg.as_bytes()
    cfg = load_config()
    smtp_cfg = cfg.get("smtp") if isinstance(cfg.get("smtp"), dict) else {}
    if smtp_cfg.get("host") and smtp_cfg.get("user"):
        _send_via_smtp(from_email, to_addr, raw)
    else:
        _send_via_sendmail(from_email, to_addr, raw)


def create_magic_link(email: str, name: str) -> str:
    ensure_schema()
    # 16 hex-символов (~https://omove.ru/a/0123456789abcdef) — целиком копируется
    token = secrets.token_hex(8)
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


def magic_login_url(token: str) -> str:
    return f"{site_base_url()}/a/{token}"


def request_login_link(email_raw: Any, name_raw: Any) -> dict[str, Any]:
    email = normalize_email(email_raw)
    if not email:
        return {"ok": False, "error": "Укажи корректный email"}
    name = normalize_display_name(name_raw)
    token = create_magic_link(email, name)
    link = magic_login_url(token)
    text_body, html_body = build_login_email(name, link)
    send_email(email, "Вход на Omove.ru", text_body, html_body)
    out = {"ok": True, "email": email}
    # для Gmail без SPF письма часто не доходят — подсказка в UI
    if email.endswith("@gmail.com") or email.endswith("@googlemail.com"):
        out["hint"] = (
            "Письма на Gmail могут не доходить, пока для omove.ru в DNS нет SPF. "
            "Проверь «Спам» или используй другой email (Яндекс/Mail.ru)."
        )
    return out


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
    token = normalize_magic_token(token)
    if not token:
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
