"""Рейтинг игроков по числу побед."""
from __future__ import annotations

from typing import Any, Optional

from db import connect, ensure_schema


def winner_slots(room: dict[str, Any]) -> list[str]:
    """Слоты победителей по полям комнаты."""
    result = str(room.get("result") or "")
    if result in ("draw",):
        return []
    winners = room.get("winners")
    if isinstance(winners, list) and winners:
        return [str(s) for s in winners if s]
    winner = room.get("winner")
    if winner:
        return [str(winner)]
    # дурак: есть loser, победители — остальные люди
    loser = room.get("loser")
    if loser and result in ("fool", "abort"):
        out = []
        for slot, p in (room.get("players") or {}).items():
            if not p or p.get("ai") or slot == loser:
                continue
            out.append(str(slot))
        return out
    return []


def record_match_result(room: dict[str, Any]) -> None:
    """Учитывает победы/партии для авторизованных игроков.

    Не считаем локальный hotseat (одно устройство).
    Ничьи и партии без победителя — только games, без wins.
    """
    if room.get("vs_local"):
        return
    if room.get("phase") != "done":
        return

    players = room.get("players") or {}
    win_set = set(winner_slots(room))
    # abort без единственного победителя — не трогаем рейтинг
    if room.get("result") == "abort" and not win_set:
        return

    touched: list[tuple[int, bool]] = []
    for slot, p in players.items():
        if not p or p.get("ai"):
            continue
        try:
            uid = int(p.get("user_id") or 0)
        except (TypeError, ValueError):
            uid = 0
        if uid <= 0:
            continue
        touched.append((uid, slot in win_set))

    if not touched:
        return

    ensure_schema()
    with connect() as conn:
        with conn.cursor() as cur:
            for uid, is_win in touched:
                if is_win:
                    cur.execute(
                        """
                        UPDATE `omove_users`
                        SET `games` = `games` + 1, `wins` = `wins` + 1
                        WHERE `id`=%s
                        """,
                        (uid,),
                    )
                else:
                    cur.execute(
                        """
                        UPDATE `omove_users`
                        SET `games` = `games` + 1
                        WHERE `id`=%s
                        """,
                        (uid,),
                    )


def leaderboard(limit: int = 20) -> list[dict[str, Any]]:
    ensure_schema()
    limit = max(1, min(100, int(limit or 20)))
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT `id`, `name`, `wins`, `games`
                FROM `omove_users`
                WHERE `wins` > 0 OR `games` > 0
                ORDER BY `wins` DESC, `games` ASC, `id` ASC
                LIMIT %s
                """,
                (limit,),
            )
            rows = cur.fetchall() or []
    out = []
    for i, row in enumerate(rows, start=1):
        out.append(
            {
                "rank": i,
                "id": int(row["id"]),
                "name": str(row["name"]),
                "wins": int(row.get("wins") or 0),
                "games": int(row.get("games") or 0),
            }
        )
    return out


def maybe_record_finished(room: dict[str, Any]) -> bool:
    """Записывает рейтинг один раз на партию. True если что-то поменяли в room."""
    if room.get("ratings_recorded"):
        return False
    room["ratings_recorded"] = True
    try:
        record_match_result(room)
    except Exception:
        # не ломаем игру из‑за сбоя рейтинга
        pass
    return True
