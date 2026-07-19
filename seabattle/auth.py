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
# код из письма: 6 цифр (основной способ) + старые hex-токены
TOKEN_RE = re.compile(r"^([0-9]{6}|[0-9a-f]{16,64})$")
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
    # убираем пробелы/дефисы из кода вида 123 456
    compact = re.sub(r"[\s\-]", "", token)
    if TOKEN_RE.match(compact):
        return compact
    return ""


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


def magic_login_url(token: str) -> str:
    """Оставлено для совместимости; вход теперь через код на сайте."""
    token = normalize_magic_token(token) or str(token or "").strip().lower()
    return f"http://omove.ru/a/{token}"


def build_login_email(name: str, code: str) -> tuple[str, str]:
    """Письмо только с кодом — без ссылок и кнопок."""
    safe_name = name.strip() or "Игрок"
    code = normalize_magic_token(code) or str(code or "").strip()
    text = (
        "Omove.ru — код для входа\n"
        "\n"
        f"Привет, {safe_name}!\n"
        "\n"
        "Твой код для входа:\n"
        f"{code}\n"
        "\n"
        "Открой omove.ru → «Войти» → вставь этот код → «Войти по коду».\n"
        "Срок действия — 30 минут.\n"
        "\n"
        "Если ты не запрашивал вход — просто удали письмо.\n"
    )
    name_html = html.escape(safe_name)
    code_html = html.escape(code)
    html_body = f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Код входа — Omove.ru</title>
</head>
<body style="margin:0;padding:0;background:#0b1724;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0b1724;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:480px;background:#102033;border:1px solid #27445f;border-collapse:collapse;">
          <tr>
            <td style="padding:28px 24px;font-family:Arial,Helvetica,sans-serif;color:#e8f1f8;">
              <div style="font-size:26px;font-weight:700;color:#7dd3fc;margin:0 0 16px 0;">Omove.ru</div>
              <div style="font-size:16px;line-height:1.5;margin:0 0 10px 0;">Привет, {name_html}!</div>
              <div style="font-size:15px;line-height:1.5;color:#c5d7e6;margin:0 0 18px 0;">
                Код для входа на сайте:
              </div>
              <div style="font-size:36px;font-weight:700;letter-spacing:0.18em;color:#e8f1f8;margin:0 0 8px 0;font-family:Consolas,Monaco,monospace;text-align:center;">
                {code_html}
              </div>
              <div style="font-size:15px;line-height:1.5;color:#c5d7e6;margin:18px 0 0 0;">
                Открой <strong>omove.ru</strong> → «Войти» → вставь код → «Войти по коду».
              </div>
              <div style="font-size:12px;line-height:1.5;color:#6f8799;margin:18px 0 0 0;">
                Срок — 30 минут. Если ты не запрашивал вход — просто удали письмо.
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
    # 6 цифр — удобно ввести с телефона
    exp = time.time() + MAGIC_TTL
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM `omove_magic` WHERE `email`=%s OR `exp` <= %s",
                (email, time.time()),
            )
            token = ""
            for _ in range(8):
                candidate = f"{secrets.randbelow(1_000_000):06d}"
                cur.execute(
                    "SELECT `token` FROM `omove_magic` WHERE `token`=%s LIMIT 1",
                    (candidate,),
                )
                if not cur.fetchone():
                    token = candidate
                    break
            if not token:
                token = f"{secrets.randbelow(1_000_000):06d}"
            cur.execute(
                "INSERT INTO `omove_magic` (`token`, `email`, `name`, `exp`) VALUES (%s, %s, %s, %s)",
                (token, email, name, exp),
            )
    return token


def request_login_link(email_raw: Any, name_raw: Any) -> dict[str, Any]:
    email = normalize_email(email_raw)
    if not email:
        return {"ok": False, "error": "Укажи корректный email"}
    # пустое имя при повторном входе — берём уже сохранённое в аккаунте
    raw_name = str(name_raw or "").strip()
    existing = get_user_by_email(email) if not raw_name else None
    if raw_name:
        name = normalize_display_name(raw_name)
    elif existing and existing.get("name"):
        name = normalize_display_name(existing["name"])
    else:
        name = normalize_display_name(raw_name)
    code = create_magic_link(email, name)
    text_body, html_body = build_login_email(name, code)
    send_email(email, f"Код входа: {code}", text_body, html_body)
    out = {"ok": True, "email": email}
    out["hint"] = (
        "Письмо отправлено. Скопируй 6-значный код из письма и вставь его ниже."
    )
    if email.endswith("@gmail.com") or email.endswith("@googlemail.com"):
        out["hint"] += " Если письма нет — проверь «Спам»."
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
    name = normalize_display_name(name)
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT `id`, `email`, `name`, `wins`, `games` FROM `omove_users` WHERE `email`=%s LIMIT 1",
                (email,),
            )
            row = cur.fetchone()
            if row:
                old = str(row.get("name") or "").strip()
                # не затираем выбранное имя дефолтом «Игрок» при повторном входе
                if name and name != "Игрок" and name != old:
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


def peek_magic_token(token: str) -> Optional[dict[str, Any]]:
    """Проверяет ссылку, не погашая её (чтобы префетч почты не сжигал вход)."""
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
            if float(row["exp"]) <= now:
                cur.execute("DELETE FROM `omove_magic` WHERE `token`=%s", (token,))
                return None
    return {
        "token": str(row["token"]),
        "email": normalize_email(row["email"]),
        "name": normalize_display_name(row["name"]),
    }


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
