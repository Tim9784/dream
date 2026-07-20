"""OUNO — сброс карт по цвету или знаку (2–4 игрока). Оригинальная игра."""
from __future__ import annotations

import random
from typing import Any

SLOTS = ("p1", "p2", "p3", "p4")
# Цвета: коралл, бирюза, янтарь, фиолет — свои названия
COLORS = ("c", "t", "a", "v")
COLOR_LABEL = {
    "c": "Коралл",
    "t": "Бирюза",
    "a": "Янтарь",
    "v": "Фиолет",
}
# Значения: 0–9, S=стоп, Z=разворот, D=+2; WW=радуга, WX=радуга+4
NUMS = "0123456789"
SPECIALS = ("S", "Z", "D")
HAND_SIZE = 7


def _build_deck() -> list[str]:
    deck: list[str] = []
    for col in COLORS:
        deck.append(f"{col}0")
        for n in "123456789":
            deck.extend([f"{col}{n}", f"{col}{n}"])
        for sp in SPECIALS:
            deck.extend([f"{col}{sp}", f"{col}{sp}"])
    deck.extend(["WW"] * 4)
    deck.extend(["WX"] * 4)
    return deck


def _color(card: str) -> str | None:
    if card in ("WW", "WX"):
        return None
    return card[0]


def _face(card: str) -> str:
    if card in ("WW", "WX"):
        return card
    return card[1]


def _is_wild(card: str) -> bool:
    return card in ("WW", "WX")


def _card_label(card: str) -> str:
    if card == "WW":
        return "★"
    if card == "WX":
        return "★+4"
    face = _face(card)
    if face == "S":
        return "стоп"
    if face == "Z":
        return "↻"
    if face == "D":
        return "+2"
    return face


def init_state(options: dict[str, Any] | None = None) -> dict[str, Any]:
    options = options or {}
    try:
        n = int(options.get("players") or options.get("max_players") or 2)
    except (TypeError, ValueError):
        n = 2
    n = max(2, min(4, n))
    return {
        "deck": [],
        "discard": [],
        "hands": {},
        "order": [],
        "direction": 1,
        "current_color": "c",
        "top": None,
        "pending_draw": 0,
        "drawn": None,
        "must_choose_color": False,
        "max_players": n,
    }


def _seat_order(room: dict[str, Any]) -> list[str]:
    return [s for s in SLOTS if room.get("players", {}).get(s)]


def _next_slot(st: dict[str, Any], slot: str, steps: int = 1) -> str:
    order = list(st["order"])
    if not order:
        return slot
    if slot not in order:
        return order[0]
    i = order.index(slot)
    d = int(st.get("direction") or 1)
    for _ in range(max(1, steps)):
        i = (i + d) % len(order)
    return order[i]


def _draw(st: dict[str, Any], n: int = 1) -> list[str]:
    got: list[str] = []
    for _ in range(n):
        if not st["deck"]:
            top = st["discard"].pop() if st["discard"] else None
            rest = list(st["discard"])
            st["discard"] = [top] if top else []
            random.shuffle(rest)
            st["deck"] = rest
        if not st["deck"]:
            break
        got.append(st["deck"].pop())
    return got


def _can_play(card: str, st: dict[str, Any]) -> bool:
    top = st.get("top")
    color = st.get("current_color")
    if not top:
        return True
    if _is_wild(card):
        return True
    if _color(card) == color:
        return True
    if _face(card) == _face(top) and not _is_wild(top):
        return True
    # дикая на столе уже задала цвет — матч только по цвету выше
    return False


def _finish_if_won(room: dict[str, Any], slot: str) -> bool:
    st = room["state"]
    if st["hands"].get(slot):
        return False
    name = room["players"][slot]["name"]
    room["phase"] = "done"
    room["winner"] = slot
    room["winners"] = [slot]
    room["loser"] = None
    room["result"] = "win"
    room["turn"] = None
    room["message"] = f"{name} сбросил все карты — победа!"
    return True


def _apply_card_effects(room: dict[str, Any], slot: str, card: str, chosen_color: str | None) -> None:
    st = room["state"]
    name = room["players"][slot]["name"]
    face = _face(card)

    if _is_wild(card):
        col = chosen_color if chosen_color in COLORS else random.choice(COLORS)
        st["current_color"] = col
        st["must_choose_color"] = False
        if card == "WX":
            victim = _next_slot(st, slot)
            st["hands"][victim].extend(_draw(st, 4))
            room["turn"] = _next_slot(st, victim)
            room["message"] = (
                f"{name}: радуга +4 → {COLOR_LABEL[col]}. "
                f"{room['players'][victim]['name']} берёт 4"
            )
        else:
            room["turn"] = _next_slot(st, slot)
            room["message"] = f"{name}: радуга → {COLOR_LABEL[col]}"
        return

    st["current_color"] = _color(card) or st["current_color"]
    st["must_choose_color"] = False

    if face == "S":
        skipped = _next_slot(st, slot)
        room["turn"] = _next_slot(st, skipped)
        room["message"] = f"{name}: стоп — {room['players'][skipped]['name']} пропускает ход"
        return
    if face == "Z":
        if len(st["order"]) == 2:
            # вдвоём разворот = стоп
            skipped = _next_slot(st, slot)
            room["turn"] = _next_slot(st, skipped)
            room["message"] = f"{name}: разворот (как стоп) — {room['players'][skipped]['name']} ждёт"
        else:
            st["direction"] = -int(st.get("direction") or 1)
            room["turn"] = _next_slot(st, slot)
            room["message"] = f"{name}: разворот хода"
        return
    if face == "D":
        victim = _next_slot(st, slot)
        st["hands"][victim].extend(_draw(st, 2))
        room["turn"] = _next_slot(st, victim)
        room["message"] = f"{name}: +2 — {room['players'][victim]['name']} берёт 2"
        return

    room["turn"] = _next_slot(st, slot)
    left = len(st["hands"].get(slot) or [])
    if left == 1:
        room["message"] = f"{name}: OUNO! Осталась 1 карта. Ход {room['players'][room['turn']]['name']}"
    else:
        room["message"] = f"{name} сходил. Ход {room['players'][room['turn']]['name']}"


def on_players_ready(room: dict[str, Any]) -> None:
    order = _seat_order(room)
    if len(order) < 2:
        return
    st = room.get("state") or init_state({"players": len(order)})
    deck = _build_deck()
    random.shuffle(deck)
    hands = {s: [] for s in order}
    for _ in range(HAND_SIZE):
        for s in order:
            hands[s].append(deck.pop())

    # верхняя карта стола — не дикая
    top = deck.pop()
    while _is_wild(top):
        deck.insert(0, top)
        random.shuffle(deck)
        top = deck.pop()

    st.update({
        "deck": deck,
        "discard": [top],
        "hands": hands,
        "order": order,
        "direction": 1,
        "current_color": _color(top),
        "top": top,
        "pending_draw": 0,
        "drawn": None,
        "must_choose_color": False,
        "max_players": len(order),
    })
    room["state"] = st
    room["phase"] = "playing"
    room["rematch_votes"] = {}
    room["winner"] = None
    room["winners"] = None
    room["loser"] = None
    room["result"] = None
    room["turn"] = order[0]
    # если стартовая спецкарта — эффект на первого
    face = _face(top)
    if face == "S":
        room["turn"] = _next_slot(st, order[0])
        room["message"] = f"Старт со «стоп» — ход {room['players'][room['turn']]['name']}"
    elif face == "Z":
        st["direction"] = -1
        room["turn"] = _next_slot(st, order[0])
        room["message"] = f"Старт с разворота — ход {room['players'][room['turn']]['name']}"
    elif face == "D":
        hands[order[0]].extend(_draw(st, 2))
        room["turn"] = _next_slot(st, order[0])
        room["message"] = (
            f"Старт с +2 — {room['players'][order[0]]['name']} берёт 2. "
            f"Ход {room['players'][room['turn']]['name']}"
        )
    else:
        room["message"] = f"Ход {room['players'][order[0]]['name']}"


def on_both_joined(room: dict[str, Any]) -> None:
    on_players_ready(room)


def legal_actions(room: dict[str, Any], slot: str) -> list[dict[str, Any]]:
    if room.get("phase") != "playing" or room.get("turn") != slot:
        return []
    st = room["state"]
    acts: list[dict[str, Any]] = []
    if st.get("must_choose_color"):
        for col in COLORS:
            acts.append({"type": "color", "color": col})
        return acts

    drawn = st.get("drawn")
    if drawn:
        if _can_play(drawn, st):
            if _is_wild(drawn):
                for col in COLORS:
                    acts.append({"type": "play_drawn", "color": col})
            else:
                acts.append({"type": "play_drawn"})
        acts.append({"type": "pass"})
        return acts

    hand = list(st["hands"].get(slot) or [])
    for card in hand:
        if not _can_play(card, st):
            continue
        if _is_wild(card):
            for col in COLORS:
                acts.append({"type": "play", "card": card, "color": col})
        else:
            acts.append({"type": "play", "card": card})
    acts.append({"type": "draw"})
    return acts


def apply_action(room: dict[str, Any], slot: str, action: dict[str, Any]) -> tuple[bool, str]:
    if room.get("phase") != "playing":
        return False, "Игра не идёт"
    if room.get("turn") != slot:
        return False, "Сейчас ход другого игрока"
    st = room["state"]
    atype = str(action.get("type") or "")

    if st.get("must_choose_color"):
        if atype != "color":
            return False, "Выбери цвет"
        col = str(action.get("color") or "")
        if col not in COLORS:
            return False, "Неверный цвет"
        st["current_color"] = col
        st["must_choose_color"] = False
        room["turn"] = _next_slot(st, slot)
        room["message"] = f"{room['players'][slot]['name']}: цвет {COLOR_LABEL[col]}"
        return True, "ok"

    if atype == "draw":
        if st.get("drawn"):
            return False, "Уже взял карту"
        got = _draw(st, 1)
        if not got:
            return False, "Колода пуста"
        card = got[0]
        st["drawn"] = card
        if _can_play(card, st):
            room["message"] = f"{room['players'][slot]['name']} взял карту — можно сходить или пас"
        else:
            st["hands"][slot].append(card)
            st["drawn"] = None
            room["turn"] = _next_slot(st, slot)
            room["message"] = (
                f"{room['players'][slot]['name']} взял карту. "
                f"Ход {room['players'][room['turn']]['name']}"
            )
        return True, "ok"

    if atype == "pass":
        if not st.get("drawn"):
            return False, "Нечего пасовать"
        st["hands"][slot].append(st["drawn"])
        st["drawn"] = None
        room["turn"] = _next_slot(st, slot)
        room["message"] = f"{room['players'][slot]['name']} пас. Ход {room['players'][room['turn']]['name']}"
        return True, "ok"

    if atype == "play_drawn":
        card = st.get("drawn")
        if not card:
            return False, "Нет взятой карты"
        if not _can_play(card, st):
            return False, "Эту карту нельзя"
        color = str(action.get("color") or "") if _is_wild(card) else None
        if _is_wild(card) and color not in COLORS:
            return False, "Выбери цвет"
        st["drawn"] = None
        st["discard"].append(card)
        st["top"] = card
        _apply_card_effects(room, slot, card, color)
        if _finish_if_won(room, slot):
            return True, "ok"
        return True, "ok"

    if atype == "play":
        if st.get("drawn"):
            return False, "Сначала сыграй взятую или пас"
        card = str(action.get("card") or "")
        hand = st["hands"].get(slot) or []
        if card not in hand:
            return False, "Нет такой карты"
        if not _can_play(card, st):
            return False, "Карта не подходит"
        color = str(action.get("color") or "") if _is_wild(card) else None
        if _is_wild(card) and color not in COLORS:
            return False, "Выбери цвет"
        hand.remove(card)
        st["hands"][slot] = hand
        st["discard"].append(card)
        st["top"] = card
        _apply_card_effects(room, slot, card, color)
        if _finish_if_won(room, slot):
            return True, "ok"
        return True, "ok"

    return False, "Неизвестное действие"


def public_view(room: dict[str, Any], viewer: str | None) -> dict[str, Any]:
    st = room.get("state") or {}
    hands_out: dict[str, Any] = {}
    counts: dict[str, int] = {}
    for s in st.get("order") or []:
        hand = list(st.get("hands", {}).get(s) or [])
        counts[s] = len(hand)
        hands_out[s] = hand if s == viewer else [None] * len(hand)

    top = st.get("top")
    return {
        "top": top,
        "top_label": _card_label(top) if top else "",
        "top_color": _color(top) if top and not _is_wild(top) else None,
        "current_color": st.get("current_color"),
        "color_labels": COLOR_LABEL,
        "deck_count": len(st.get("deck") or []),
        "discard_count": len(st.get("discard") or []),
        "hands": hands_out,
        "hand_counts": counts,
        "order": list(st.get("order") or []),
        "direction": int(st.get("direction") or 1),
        "drawn": st.get("drawn") if viewer and room.get("turn") == viewer else None,
        "must_choose_color": bool(st.get("must_choose_color")) and room.get("turn") == viewer,
        "max_players": st.get("max_players") or 2,
        "legal": legal_actions(room, viewer) if viewer else [],
        "labels": {"faces": {"S": "стоп", "Z": "↻", "D": "+2", "WW": "★", "WX": "★+4"}},
    }


def ai_action(room: dict[str, Any], slot: str) -> dict[str, Any] | None:
    acts = legal_actions(room, slot)
    if not acts:
        return None
    # цвет по большинству в руке
    hand = list((room.get("state") or {}).get("hands", {}).get(slot) or [])
    tallies = {c: 0 for c in COLORS}
    for card in hand:
        col = _color(card)
        if col:
            tallies[col] += 1
    best_color = max(COLORS, key=lambda c: tallies[c])

    plays = [a for a in acts if a["type"] == "play" and not _is_wild(a.get("card", ""))]
    if plays:
        # предпочесть спецкарты чуть реже — обычные числа первыми
        plays.sort(key=lambda a: (0 if _face(a["card"]) in NUMS else 1, _face(a["card"])))
        return plays[0]

    wilds = [a for a in acts if a["type"] == "play" and _is_wild(a.get("card", ""))]
    if wilds:
        for a in wilds:
            if a.get("color") == best_color:
                return a
        return wilds[0]

    drawn_plays = [a for a in acts if a["type"] == "play_drawn"]
    if drawn_plays:
        for a in drawn_plays:
            if a.get("color") in (None, best_color):
                return a
        return drawn_plays[0]

    colors = [a for a in acts if a["type"] == "color"]
    if colors:
        for a in colors:
            if a.get("color") == best_color:
                return a
        return colors[0]

    if any(a["type"] == "pass" for a in acts):
        return {"type": "pass"}
    if any(a["type"] == "draw" for a in acts):
        return {"type": "draw"}
    return acts[0]


def win_chance(room: dict[str, Any], slot: str) -> int:
    from .chance import done_chance, score_to_chance

    done = done_chance(room, slot)
    if done is not None:
        return done
    st = room.get("state") or {}
    my = len(st.get("hands", {}).get(slot) or [])
    others = [
        len(st.get("hands", {}).get(s) or [])
        for s in st.get("order") or []
        if s != slot
    ]
    if not others:
        return 50
    # меньше карт — выше шанс
    score = max(0, 40 - my * 5) + max(0, min(others) * 3)
    return score_to_chance(score)
