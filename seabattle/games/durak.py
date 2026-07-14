"""Подкидной дурак на двоих (колода 36)."""
from __future__ import annotations

import random
from typing import Any

RANKS = "6789TJQKA"
SUITS = "shdc"  # ♠ ♥ ♦ ♣
RANK_ORDER = {r: i for i, r in enumerate(RANKS)}
HAND_SIZE = 6
MAX_ATTACKS = 6


def _deck36() -> list[str]:
    return [r + s for s in SUITS for r in RANKS]


def _rank(card: str) -> str:
    return card[0]


def _suit(card: str) -> str:
    return card[1]


def _can_beat(attack: str, defend: str, trump: str) -> bool:
    if _suit(defend) == _suit(attack):
        return RANK_ORDER[_rank(defend)] > RANK_ORDER[_rank(attack)]
    return _suit(defend) == trump and _suit(attack) != trump


def _table_ranks(table: list[dict[str, Any]]) -> set[str]:
    ranks: set[str] = set()
    for pair in table:
        ranks.add(_rank(pair["a"]))
        if pair.get("d"):
            ranks.add(_rank(pair["d"]))
    return ranks


def _unbeaten(table: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [p for p in table if not p.get("d")]


def _all_beaten(table: list[dict[str, Any]]) -> bool:
    return bool(table) and all(p.get("d") for p in table)


def _opp(slot: str) -> str:
    return "p2" if slot == "p1" else "p1"


def _sort_hand(hand: list[str], trump: str) -> list[str]:
    return sorted(
        hand,
        key=lambda c: (0 if _suit(c) == trump else 1, RANK_ORDER[_rank(c)], _suit(c)),
    )


def _lowest_trump_holder(hands: dict[str, list[str]], trump: str) -> str:
    best: tuple[int, str] | None = None
    for slot in ("p1", "p2"):
        for c in hands[slot]:
            if _suit(c) != trump:
                continue
            ri = RANK_ORDER[_rank(c)]
            if best is None or ri < best[0]:
                best = (ri, slot)
    return best[1] if best else "p1"


def _draw_to_six(state: dict[str, Any], order: list[str]) -> None:
    deck = state["deck"]
    for slot in order:
        hand = state["hands"][slot]
        while len(hand) < HAND_SIZE and deck:
            hand.append(deck.pop())
        state["hands"][slot] = _sort_hand(hand, state["trump"])


def _finish_if_needed(room: dict[str, Any]) -> bool:
    """Проверка конца после розыгрыша. True если игра окончена."""
    st = room["state"]
    if st["deck"]:
        return False
    empty = [s for s in ("p1", "p2") if not st["hands"][s]]
    if len(empty) == 2:
        room["phase"] = "done"
        room["winner"] = None
        room["turn"] = None
        room["message"] = "Ничья — оба вышли"
        return True
    if len(empty) == 1:
        winner = empty[0]
        loser = _opp(winner)
        room["phase"] = "done"
        room["winner"] = winner
        room["turn"] = None
        room["message"] = (
            f"{room['players'][winner]['name']} победил! "
            f"{room['players'][loser]['name']} — дурак"
        )
        return True
    return False


def _start_round(room: dict[str, Any], attacker: str) -> None:
    st = room["state"]
    defender = _opp(attacker)
    st["attacker"] = attacker
    st["defender"] = defender
    st["table"] = []
    st["expect"] = "attack"
    st["round_limit"] = min(MAX_ATTACKS, max(1, len(st["hands"][defender])))
    room["turn"] = attacker
    room["message"] = f"{room['players'][attacker]['name']} ходит (атака)"


def _end_round_beat(room: dict[str, Any]) -> None:
    st = room["state"]
    st["discard"] = int(st.get("discard", 0)) + sum(
        1 + (1 if p.get("d") else 0) for p in st["table"]
    )
    st["table"] = []
    attacker = st["attacker"]
    defender = st["defender"]
    _draw_to_six(st, [attacker, defender])
    if _finish_if_needed(room):
        return
    # защитник становится атакующим, если у него ещё есть карты
    next_att = defender if st["hands"][defender] else attacker
    if not st["hands"][next_att]:
        next_att = defender if st["hands"][defender] else attacker
    if _finish_if_needed(room):
        return
    _start_round(room, next_att)


def _end_round_take(room: dict[str, Any]) -> None:
    st = room["state"]
    defender = st["defender"]
    attacker = st["attacker"]
    for p in st["table"]:
        st["hands"][defender].append(p["a"])
        if p.get("d"):
            st["hands"][defender].append(p["d"])
    st["hands"][defender] = _sort_hand(st["hands"][defender], st["trump"])
    st["table"] = []
    _draw_to_six(st, [attacker, defender])
    if _finish_if_needed(room):
        return
    # атакующий ходит снова
    _start_round(room, attacker)


def init_state(options: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "deck": [],
        "trump": "s",
        "trump_card": "As",
        "hands": {"p1": [], "p2": []},
        "table": [],
        "attacker": "p1",
        "defender": "p2",
        "expect": "attack",
        "discard": 0,
        "round_limit": MAX_ATTACKS,
    }


def on_both_joined(room: dict[str, Any]) -> None:
    deck = _deck36()
    random.shuffle(deck)
    hands = {"p1": [], "p2": []}
    for _ in range(HAND_SIZE):
        hands["p1"].append(deck.pop())
        hands["p2"].append(deck.pop())
    trump_card = deck[0] if deck else hands["p1"][0]
    trump = _suit(trump_card)
    # козырь лежит под колодой: карта внизу стопки
    if deck:
        deck = deck[1:] + [trump_card]

    hands["p1"] = _sort_hand(hands["p1"], trump)
    hands["p2"] = _sort_hand(hands["p2"], trump)
    room["state"] = {
        "deck": deck,
        "trump": trump,
        "trump_card": trump_card,
        "hands": hands,
        "table": [],
        "attacker": "p1",
        "defender": "p2",
        "expect": "attack",
        "discard": 0,
        "round_limit": MAX_ATTACKS,
    }
    room["phase"] = "playing"
    room["winner"] = None
    attacker = _lowest_trump_holder(hands, trump)
    _start_round(room, attacker)
    room["message"] = (
        f"Козырь: {_card_label(trump_card)}. "
        f"Атакует {room['players'][attacker]['name']}"
    )


SUIT_LABEL = {"s": "♠", "h": "♥", "d": "♦", "c": "♣"}
RANK_LABEL = {
    "6": "6", "7": "7", "8": "8", "9": "9", "T": "10",
    "J": "В", "Q": "Д", "K": "К", "A": "Т",
}


def _card_label(card: str) -> str:
    return f"{RANK_LABEL[_rank(card)]}{SUIT_LABEL[_suit(card)]}"


def legal_actions(room: dict[str, Any], slot: str) -> list[dict[str, Any]]:
    if room["phase"] != "playing" or room.get("turn") != slot:
        return []
    st = room["state"]
    expect = st["expect"]
    hand = st["hands"][slot]
    table = st["table"]
    trump = st["trump"]
    out: list[dict[str, Any]] = []

    if expect == "attack" and slot == st["attacker"]:
        for c in hand:
            out.append({"type": "attack", "card": c})
        return out

    if expect == "defend" and slot == st["defender"]:
        out.append({"type": "take"})
        unbeaten = _unbeaten(table)
        if unbeaten:
            target = unbeaten[0]["a"]
            for c in hand:
                if _can_beat(target, c, trump):
                    out.append({"type": "defend", "card": c, "target": target})
        return out

    if expect == "throw" and slot == st["attacker"]:
        out.append({"type": "pass"})
        if len(table) >= st["round_limit"]:
            return out
        if len(st["hands"][st["defender"]]) <= len(_unbeaten(table)):
            # нельзя подкинуть больше, чем у защитника свободных «слотов»
            # (учитываем уже непобитые)
            pass
        ranks = _table_ranks(table)
        defender_free = len(st["hands"][st["defender"]]) - len(_unbeaten(table))
        if defender_free <= 0:
            return out
        for c in hand:
            if _rank(c) in ranks:
                out.append({"type": "attack", "card": c})
        return out

    return out


def apply_action(room: dict[str, Any], slot: str, action: dict[str, Any]) -> tuple[bool, str]:
    if room["phase"] != "playing":
        return False, "Игра не идёт"
    if room["turn"] != slot:
        return False, "Сейчас ход соперника"

    st = room["state"]
    atype = str(action.get("type") or "")
    card = str(action.get("card") or "")
    trump = st["trump"]
    hand = st["hands"][slot]

    if atype == "attack":
        if slot != st["attacker"]:
            return False, "Атакует другой игрок"
        if st["expect"] not in ("attack", "throw"):
            return False, "Сейчас нельзя ходить картой"
        if card not in hand:
            return False, "Нет такой карты"
        if st["expect"] == "attack" and st["table"]:
            return False, "Уже есть атака"
        if st["expect"] == "throw":
            if _rank(card) not in _table_ranks(st["table"]):
                return False, "Можно подкидывать только по рангам на столе"
            if len(st["table"]) >= st["round_limit"]:
                return False, "Больше подкидывать нельзя"
            if len(st["hands"][st["defender"]]) <= len(_unbeaten(st["table"])):
                return False, "У защитника не хватает карт"
        hand.remove(card)
        st["table"].append({"a": card, "d": None})
        st["expect"] = "defend"
        room["turn"] = st["defender"]
        room["message"] = f"{room['players'][slot]['name']} ходит {_card_label(card)}"
        if not hand and not st["deck"] and _finish_if_needed(room):
            return True, "ok"
        return True, "ok"

    if atype == "defend":
        if slot != st["defender"] or st["expect"] != "defend":
            return False, "Сейчас не защита"
        if card not in hand:
            return False, "Нет такой карты"
        unbeaten = _unbeaten(st["table"])
        if not unbeaten:
            return False, "Нечего отбивать"
        target = unbeaten[0]
        if not _can_beat(target["a"], card, trump):
            return False, "Этой картой не побить"
        hand.remove(card)
        target["d"] = card
        room["message"] = (
            f"{room['players'][slot]['name']} бьёт "
            f"{_card_label(target['a'])} → {_card_label(card)}"
        )
        if _all_beaten(st["table"]):
            # если атакующий без карт и колода пуста — конец при бито позже;
            # даём атакующему подкинуть/пас
            if not st["hands"][st["attacker"]] and not st["deck"]:
                _end_round_beat(room)
                return True, "ok"
            st["expect"] = "throw"
            room["turn"] = st["attacker"]
            room["message"] += f". {room['players'][st['attacker']]['name']}: подкинуть или бито"
        else:
            # ещё есть непобитые — продолжаем защиту (на всякий случай)
            room["turn"] = st["defender"]
            st["expect"] = "defend"
        if not hand and not st["deck"]:
            # защитник вышел, но раунд ещё идёт — добьём на бито/взял
            pass
        return True, "ok"

    if atype == "take":
        if slot != st["defender"] or st["expect"] != "defend":
            return False, "Сейчас нельзя взять"
        room["message"] = f"{room['players'][slot]['name']} берёт карты"
        _end_round_take(room)
        return True, "ok"

    if atype == "pass":
        if slot != st["attacker"] or st["expect"] != "throw":
            return False, "Сейчас нельзя сказать «бито»"
        if not _all_beaten(st["table"]):
            return False, "Есть неотбитые карты"
        room["message"] = "Бито!"
        _end_round_beat(room)
        return True, "ok"

    return False, "Неизвестное действие"


def public_view(room: dict[str, Any], viewer: str | None) -> dict[str, Any]:
    st = room["state"]
    hands_pub = {}
    for slot in ("p1", "p2"):
        if viewer == slot:
            hands_pub[slot] = list(st["hands"][slot])
        else:
            hands_pub[slot] = [None] * len(st["hands"][slot])
    legal = legal_actions(room, viewer) if viewer else []
    return {
        "trump": st["trump"],
        "trump_card": st["trump_card"],
        "deck_count": len(st["deck"]),
        "discard": st.get("discard", 0),
        "hands": hands_pub,
        "hand_counts": {s: len(st["hands"][s]) for s in ("p1", "p2")},
        "table": list(st["table"]),
        "attacker": st["attacker"],
        "defender": st["defender"],
        "expect": st["expect"],
        "legal": legal,
        "labels": {
            "suits": SUIT_LABEL,
            "ranks": RANK_LABEL,
        },
    }


def ai_action(room: dict[str, Any], slot: str) -> dict[str, Any] | None:
    acts = legal_actions(room, slot)
    if not acts:
        return None
    st = room["state"]
    trump = st["trump"]

    def strength(card: str) -> int:
        return RANK_ORDER[_rank(card)] + (20 if _suit(card) == trump else 0)

    if st["expect"] == "defend":
        defend_opts = [a for a in acts if a["type"] == "defend"]
        if defend_opts:
            defend_opts.sort(key=lambda a: strength(a["card"]))
            # не тратим сильный козырь зря, если есть дешёвый бой
            pick = defend_opts[0]
            if strength(pick["card"]) >= 20 + 5 and len(defend_opts) > 1:
                non_heavy = [a for a in defend_opts if strength(a["card"]) < 20 + 5]
                if non_heavy:
                    pick = non_heavy[0]
            return pick
        return {"type": "take"}

    if st["expect"] == "attack":
        opts = [a for a in acts if a["type"] == "attack"]
        opts.sort(key=lambda a: strength(a["card"]))
        return opts[0] if opts else None

    if st["expect"] == "throw":
        opts = [a for a in acts if a["type"] == "attack"]
        # подкидываем только мелкие некозырные, иначе бито
        cheap = [a for a in opts if strength(a["card"]) < 8]
        if cheap:
            cheap.sort(key=lambda a: strength(a["card"]))
            return cheap[0]
        mid = [a for a in opts if strength(a["card"]) < 14]
        if mid and len(st["hands"][slot]) > 2:
            mid.sort(key=lambda a: strength(a["card"]))
            return mid[0]
        return {"type": "pass"}

    return acts[0]
