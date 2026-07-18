"""Подключение к MySQL из config.json (общие таблицы пользователей/рейтинга)."""
from __future__ import annotations

import json
import os
import threading
from typing import Any, Optional

_lock = threading.Lock()
_SCHEMA_VERSION = 2
_schema_ready_version = 0


def load_config() -> dict[str, Any]:
    path = os.environ.get("PANEL_CONFIG") or os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "config.json"
    )
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
            return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def mysql_cfg(cfg: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    data = cfg if cfg is not None else load_config()
    raw = data.get("mysql") if isinstance(data.get("mysql"), dict) else {}
    return raw if isinstance(raw, dict) else {}


def connect(cfg: Optional[dict[str, Any]] = None):
    try:
        import pymysql
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError("pymysql не установлен") from exc
    mc = mysql_cfg(cfg)
    if not (mc.get("host") and mc.get("user") and mc.get("database")):
        raise RuntimeError("MySQL не настроен в config.json")
    return pymysql.connect(
        host=str(mc["host"]),
        user=str(mc["user"]),
        password=str(mc.get("password") or ""),
        database=str(mc["database"]),
        port=int(mc.get("port") or 3306),
        charset="utf8mb4",
        autocommit=True,
        connect_timeout=10,
        read_timeout=30,
        write_timeout=30,
        cursorclass=pymysql.cursors.DictCursor,
    )


def ensure_schema(cfg: Optional[dict[str, Any]] = None) -> None:
    global _schema_ready_version
    if _schema_ready_version >= _SCHEMA_VERSION:
        return
    with _lock:
        if _schema_ready_version >= _SCHEMA_VERSION:
            return
        with connect(cfg) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS `omove_users` (
                      `id` INT NOT NULL AUTO_INCREMENT,
                      `email` VARCHAR(191) NOT NULL,
                      `name` VARCHAR(40) NOT NULL,
                      `wins` INT NOT NULL DEFAULT 0,
                      `games` INT NOT NULL DEFAULT 0,
                      `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                      `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                        ON UPDATE CURRENT_TIMESTAMP,
                      PRIMARY KEY (`id`),
                      UNIQUE KEY `uq_email` (`email`),
                      KEY `idx_wins` (`wins`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS `omove_magic` (
                      `token` CHAR(64) NOT NULL,
                      `email` VARCHAR(191) NOT NULL,
                      `name` VARCHAR(40) NOT NULL,
                      `exp` DOUBLE NOT NULL,
                      `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                      PRIMARY KEY (`token`),
                      KEY `idx_email` (`email`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS `omove_sessions` (
                      `token` CHAR(64) NOT NULL,
                      `user_id` INT NOT NULL,
                      `exp` DOUBLE NOT NULL,
                      `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                      PRIMARY KEY (`token`),
                      KEY `idx_user` (`user_id`),
                      KEY `idx_exp` (`exp`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS `omove_user_game_stats` (
                      `user_id` INT NOT NULL,
                      `game` VARCHAR(32) NOT NULL,
                      `wins` INT NOT NULL DEFAULT 0,
                      `games` INT NOT NULL DEFAULT 0,
                      `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                        ON UPDATE CURRENT_TIMESTAMP,
                      PRIMARY KEY (`user_id`, `game`),
                      KEY `idx_game` (`game`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                    """
                )
        _schema_ready_version = _SCHEMA_VERSION
