"""Подкидной дурак: 2–4 игрока, колода 36. Последний с картами — дурак; пустой стол = ничья."""
from __future__ import annotations

import random
from typing import Any

RANKS = "6789TJQKA"
SUITS = "shdc"
RANK_ORDER = {r: i for i, r in enumerate(RANKS)}
HAND_SIZE = 6
MAX_ATTACKS = 6
SLOTS = ("p1", "p2", "p3", "p4")

SUIT_LABEL = {"s": "♠", "h": "♥", "d": "♦", "c": "♣"}
RANK_LABEL = {
    "6": "6", "7": "7", "8": "8", "9": "9", "T": "10",
    "J": "В", "Q": "Д", "K": "К", "A": "Т",
}


def _deck36() -> list[str]:
    return [r + s for s in SUITS for r in RANKS]


def _rank(card: str) -> str:
    return card[0]


def _suit(card: str) -> str:
    return card[1]


def _card_label(card: str) -> str:
    return f"{RANK_LABEL[_rank(card)]}{SUIT_LABEL[_suit(card)]}"


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


def _sort_hand(hand: list[str], trump: str) -> list[str]:
    return sorted(
        hand,
        key=lambda c: (0 if _suit(c) == trump else 1, RANK_ORDER[_rank(c)], _suit(c)),
    )


def _seat_list(room: dict[str, Any]) -> list[str]:
    st = room.get("state") or {}
    order = list(st.get("order") or [])
    if order:
        return order
    return [s for s in SLOTS if room.get("players", {}).get(s)]


def _alive(st: dict[str, Any]) -> list[str]:
    """Ещё в игре (не вышли «в отбой»)."""
    out = set(st.get("out") or [])
    return [s for s in st["order"] if s not in out]


def _with_cards(st: dict[str, Any]) -> list[str]:
    return [s for s in _alive(st) if st["hands"].get(s)]


def _next_alive(st: dict[str, Any], slot: str) -> str | None:
    alive = _alive(st)
    if not alive:
        return None
    if slot not in alive:
        return alive[0]
    i = alive.index(slot)
    return alive[(i + 1) % len(alive)]


def _mark_outs(st: dict[str, Any]) -> None:
    if st["deck"]:
        return
    out = list(st.get("out") or [])
    for s in st["order"]:
        if s not in out and not st["hands"].get(s):
            out.append(s)
    st["out"] = out


def _end_draw(room: dict[str, Any], msg: str = "Ничья!") -> None:
    room["phase"] = "done"
    room["winner"] = None
    room["loser"] = None
    room["result"] = "draw"
    room["turn"] = None
    room["message"] = msg


def _end_fool(room: dict[str, Any], loser: str) -> None:
    names = {s: room["players"][s]["name"] for s in _seat_list(room) if room["players"].get(s)}
    winners = [s for s in names if s != loser]
    room["phase"] = "done"
    room["winner"] = winners[0] if len(winners) == 1 else None
    room["winners"] = winners
    room["loser"] = loser
    room["result"] = "fool"
    room["turn"] = None
    if len(winners) == 1:
        room["message"] = f"{names[winners[0]]} победил! {names[loser]} — дурак"
    else:
        wtxt = ", ".join(names[s] for s in winners)
        room["message"] = f"{names[loser]} — дурак. Вышли: {wtxt}"


def _finish_if_needed(room: dict[str, Any]) -> bool:
    st = room["state"]
    _mark_outs(st)
    if st["deck"]:
        return False
    remaining = _alive(st)
    if len(remaining) == 0:
        _end_draw(room, "Ничья — все вышли")
        return True
    if len(remaining) == 1:
        last = remaining[0]
        if not st["hands"].get(last):
            _end_draw(room, "Ничья — стол опустел")
            return True
        _end_fool(room, last)
        return True
    # двое+ ещё с картами (или пустые но колода пуста уже marked out)
    with_cards = _with_cards(st)
    if len(with_cards) == 0:
        _end_draw(room, "Ничья — все вышли")
        return True
    if len(with_cards) == 1 and len(remaining) == 1:
        _end_fool(room, with_cards[0])
        return True
    return False


def _draw_to_six(st: dict[str, Any], order: list[str]) -> None:
    deck = st["deck"]
    trump = st["trump"]
    for slot in order:
        if slot in (st.get("out") or []):
            continue
        hand = st["hands"].setdefault(slot, [])
        while len(hand) < HAND_SIZE and deck:
            hand.append(deck.pop())
        st["hands"][slot] = _sort_hand(hand, trump)


def _refill_order(st: dict[str, Any]) -> list[str]:
    """Атакующий → по кругу → защитник последним."""
    order = []
    att = st["attacker"]
    defe = st["defender"]
    alive = _alive(st)
    if att in alive:
        order.append(att)
    # clockwise from attacker, skip defender until end
    if att in st["order"]:
        i0 = st["order"].index(att)
        for k in range(1, len(st["order"])):
            s = st["order"][(i0 + k) % len(st["order"])]
            if s == defe:
                continue
            if s in alive:
                order.append(s)
    if defe in alive and defe not in order:
        order.append(defe)
    return order


def _lowest_trump_holder(hands: dict[str, list[str]], order: list[str], trump: str) -> str:
    best: tuple[int, str] | None = None
    for slot in order:
        for c in hands.get(slot) or []:
            if _suit(c) != trump:
                continue
            ri = RANK_ORDER[_rank(c)]
            if best is None or ri < best[0]:
                best = (ri, slot)
    return best[1] if best else order[0]


def _start_round(room: dict[str, Any], attacker: str) -> None:
    st = room["state"]
    defender = _next_alive(st, attacker)
    if not defender or defender == attacker:
        _finish_if_needed(room)
        return
    st["attacker"] = attacker
    st["defender"] = defender
    st["table"] = []
    st["expect"] = "attack"
    st["throw_passed"] = []
    st["round_limit"] = min(MAX_ATTACKS, max(1, len(st["hands"].get(defender) or [])))
    room["turn"] = attacker
    room["message"] = f"{room['players'][attacker]['name']} ходит (атака)"


def _end_round_beat(room: dict[str, Any]) -> None:
    st = room["state"]
    st["discard"] = int(st.get("discard", 0)) + sum(1 + (1 if p.get("d") else 0) for p in st["table"])
    st["table"] = []
    attacker = st["attacker"]
    defender = st["defender"]
    _draw_to_six(st, _refill_order(st))
    _mark_outs(st)
    if _finish_if_needed(room):
        return
    # следующий атакующий — бывший защитник, если ещё в игре с картами/вообще alive
    next_att = defender if defender in _alive(st) else _next_alive(st, attacker)
    if not next_att:
        _finish_if_needed(room)
        return
    if not st["hands"].get(next_att) and not st["deck"]:
        next_att = _next_alive(st, next_att) or next_att
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
    _draw_to_six(st, _refill_order(st))
    _mark_outs(st)
    if _finish_if_needed(room):
        return
    # атакует следующий после защитника (защитник взял — пропускает атаку)
    next_att = _next_alive(st, defender)
    if not next_att:
        _finish_if_needed(room)
        return
    _start_round(room, next_att)


def _throw_candidates(st: dict[str, Any]) -> list[str]:
    """Кто может подкидывать: все живые кроме защитника, с картами."""
    defe = st["defender"]
    return [s for s in _with_cards(st) if s != defe]


def _next_throw_turn(st: dict[str, Any], after: str | None) -> str | None:
    cands = _throw_candidates(st)
    if not cands:
        return None
    passed = set(st.get("throw_passed") or [])
    # порядок: с атакующего по кругу
    order = st["order"]
    att = st["attacker"]
    rotated = []
    if att in order:
        i0 = order.index(att)
        for k in range(len(order)):
            s = order[(i0 + k) % len(order)]
            if s in cands:
                rotated.append(s)
    else:
        rotated = cands
    # start after `after`
    start = 0
    if after in rotated:
        start = (rotated.index(after) + 1) % len(rotated)
    for k in range(len(rotated)):
        s = rotated[(start + k) % len(rotated)]
        if s not in passed:
            return s
    return None


def init_state(options: dict[str, Any] | None = None) -> dict[str, Any]:
    options = options or {}
    n = int(options.get("players") or options.get("max_players") or 2)
    n = max(2, min(4, n))
    return {
        "deck": [],
        "trump": "s",
        "trump_card": "As",
        "hands": {},
        "table": [],
        "order": [],
        "out": [],
        "attacker": "p1",
        "defender": "p2",
        "expect": "attack",
        "discard": 0,
        "round_limit": MAX_ATTACKS,
        "throw_passed": [],
        "max_players": n,
    }


def on_both_joined(room: dict[str, Any]) -> None:
    """Совместимость: старт, когда игроки собрались."""
    on_players_ready(room)


def on_players_ready(room: dict[str, Any]) -> None:
    order = [s for s in SLOTS if room.get("players", {}).get(s)]
    if len(order) < 2:
        return
    deck = _deck36()
    random.shuffle(deck)
    hands = {s: [] for s in order}
    for _ in range(HAND_SIZE):
        for s in order:
            if deck:
                hands[s].append(deck.pop())
    trump_card = deck[0] if deck else hands[order[0]][0]
    trump = _suit(trump_card)
    if deck:
        deck = deck[1:] + [trump_card]
    for s in order:
        hands[s] = _sort_hand(hands[s], trump)
    room["state"] = {
        "deck": deck,
        "trump": trump,
        "trump_card": trump_card,
        "hands": hands,
        "table": [],
        "order": order,
        "out": [],
        "attacker": order[0],
        "defender": order[1],
        "expect": "attack",
        "discard": 0,
        "round_limit": MAX_ATTACKS,
        "throw_passed": [],
        "max_players": len(order),
    }
    room["phase"] = "playing"
    room["winner"] = None
    room["winners"] = None
    room["loser"] = None
    room["result"] = None
    room["rematch_votes"] = {}
    attacker = _lowest_trump_holder(hands, order, trump)
    _start_round(room, attacker)
    room["message"] = (
        f"Козырь: {_card_label(trump_card)}. "
        f"Атакует {room['players'][attacker]['name']} · игроков: {len(order)}"
    )


def legal_actions(room: dict[str, Any], slot: str) -> list[dict[str, Any]]:
    if room["phase"] != "playing" or room.get("turn") != slot:
        return []
    st = room["state"]
    if slot in (st.get("out") or []):
        return []
    expect = st["expect"]
    hand = st["hands"].get(slot) or []
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

    if expect == "throw" and slot != st["defender"] and slot in _alive(st):
        out.append({"type": "pass"})
        if len(table) >= st["round_limit"]:
            return out
        defe_free = len(st["hands"].get(st["defender"]) or []) - len(_unbeaten(table))
        if defe_free <= 0:
            return out
        ranks = _table_ranks(table)
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
    hand = st["hands"].setdefault(slot, [])

    if atype == "attack":
        if st["expect"] not in ("attack", "throw"):
            return False, "Сейчас нельзя ходить картой"
        if st["expect"] == "attack" and slot != st["attacker"]:
            return False, "Атакует другой игрок"
        if st["expect"] == "throw" and slot == st["defender"]:
            return False, "Защитник не подкидывает"
        if card not in hand:
            return False, "Нет такой карты"
        if st["expect"] == "attack" and st["table"]:
            return False, "Уже есть атака"
        if st["expect"] == "throw":
            if _rank(card) not in _table_ranks(st["table"]):
                return False, "Можно подкидывать только по рангам на столе"
            if len(st["table"]) >= st["round_limit"]:
                return False, "Больше подкидывать нельзя"
            if len(st["hands"].get(st["defender"]) or []) <= len(_unbeaten(st["table"])):
                return False, "У защитника не хватает карт"
        hand.remove(card)
        st["table"].append({"a": card, "d": None})
        st["expect"] = "defend"
        st["throw_passed"] = []
        room["turn"] = st["defender"]
        room["message"] = f"{room['players'][slot]['name']} ходит {_card_label(card)}"
        _mark_outs(st)
        if not hand and not st["deck"]:
            _finish_if_needed(room)
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
            if not st["hands"].get(st["attacker"]) and not st["deck"] and len(_alive(st)) <= 2:
                # быстрый выход
                pass
            st["expect"] = "throw"
            st["throw_passed"] = []
            nxt = _next_throw_turn(st, None)
            if not nxt:
                _end_round_beat(room)
                return True, "ok"
            room["turn"] = nxt
            room["message"] += f". Подкид: {room['players'][nxt]['name']}"
        else:
            room["turn"] = st["defender"]
            st["expect"] = "defend"
        _mark_outs(st)
        return True, "ok"

    if atype == "take":
        if slot != st["defender"] or st["expect"] != "defend":
            return False, "Сейчас нельзя взять"
        room["message"] = f"{room['players'][slot]['name']} берёт карты"
        _end_round_take(room)
        return True, "ok"

    if atype == "pass":
        if st["expect"] != "throw" or slot == st["defender"]:
            return False, "Сейчас нельзя сказать «бито»/пас"
        if not _all_beaten(st["table"]):
            return False, "Есть неотбитые карты"
        passed = list(st.get("throw_passed") or [])
        if slot not in passed:
            passed.append(slot)
        st["throw_passed"] = passed
        nxt = _next_throw_turn(st, slot)
        if not nxt:
            room["message"] = "Бито!"
            _end_round_beat(room)
            return True, "ok"
        room["turn"] = nxt
        room["message"] = f"{room['players'][slot]['name']} пас. Ход: {room['players'][nxt]['name']}"
        return True, "ok"

    return False, "Неизвестное действие"


def public_view(room: dict[str, Any], viewer: str | None) -> dict[str, Any]:
    st = room["state"]
    order = list(st.get("order") or _seat_list(room))
    hands_pub = {}
    hand_counts = {}
    for slot in order:
        hand = st["hands"].get(slot) or []
        hand_counts[slot] = len(hand)
        if viewer == slot:
            hands_pub[slot] = list(hand)
        else:
            hands_pub[slot] = [None] * len(hand)
    legal = legal_actions(room, viewer) if viewer else []
    return {
        "trump": st["trump"],
        "trump_card": st["trump_card"],
        "deck_count": len(st["deck"]),
        "discard": st.get("discard", 0),
        "hands": hands_pub,
        "hand_counts": hand_counts,
        "table": list(st["table"]),
        "order": order,
        "out": list(st.get("out") or []),
        "attacker": st.get("attacker"),
        "defender": st.get("defender"),
        "expect": st.get("expect"),
        "max_players": st.get("max_players") or len(order),
        "legal": legal,
        "labels": {"suits": SUIT_LABEL, "ranks": RANK_LABEL},
    }


def _hand_strength(hand: list[str], trump: str) -> float:
    s = 0.0
    for c in hand:
        s += RANK_ORDER[_rank(c)]
        if _suit(c) == trump:
            s += 6.5
    return s


def win_chance(room: dict[str, Any], slot: str) -> int:
    from .chance import done_chance, score_to_chance

    done = done_chance(room, slot)
    if done is not None:
        return done
    if room.get("result") == "draw":
        return 50
    if room.get("loser") == slot:
        return 0
    if room.get("winners") and slot in room["winners"]:
        return 100
    st = room["state"]
    trump = st["trump"]
    my = st["hands"].get(slot) or []
    others = [s for s in _alive(st) if s != slot]
    if not others:
        return 50
    their_s = sum(_hand_strength(st["hands"].get(s) or [], trump) for s in others) / len(others)
    my_s = _hand_strength(my, trump)
    avg_cards = sum(len(st["hands"].get(s) or []) for s in others) / len(others)
    card_bias = (avg_cards - len(my)) * 2.2
    score = (my_s - their_s) * 0.35 + card_bias
    return score_to_chance(score, scale=4.5)


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
            return defend_opts[0]
        return {"type": "take"}

    if st["expect"] == "attack":
        opts = [a for a in acts if a["type"] == "attack"]
        opts.sort(key=lambda a: strength(a["card"]))
        return opts[0] if opts else None

    if st["expect"] == "throw":
        opts = [a for a in acts if a["type"] == "attack"]
        cheap = [a for a in opts if strength(a["card"]) < 8]
        if cheap:
            cheap.sort(key=lambda a: strength(a["card"]))
            return cheap[0]
        return {"type": "pass"}

    return acts[0]
