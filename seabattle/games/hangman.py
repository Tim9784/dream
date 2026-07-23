from __future__ import annotations

import random
import re
from typing import Any

# Небольшой список русских слов (без пробелов и дефисов) — для соло / с роботом
_WORDS = [
    "КОТ", "СОБАКА", "ДОМ", "МОЛОКО", "ДЕРЕВО", "МАШИНА", "ЯБЛОКО", "РЫБА", "ШКОЛА",
    "ЛАМПА", "ТРАВА", "СНЕГ", "КРОВАТЬ", "КНИГА", "СОЛНЦЕ", "ОКНО", "СТОЛ", "ЧАЙ",
    "КОФЕ", "МОРЕ", "ГОРЫ", "ЗВЕЗДА", "ЛИСА", "ЖУРАВЛЬ", "МУЗЫКА", "ПЛИТА", "ТАРЕЛКА",
]

_ALPHABET = list("АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ")
_MAX_WRONG = 6
_WORD_RE = re.compile(r"^[А-ЯЁ]{2,16}$")


def init_state(options: dict[str, Any] | None = None) -> dict[str, Any]:
    options = options or {}
    setter = options.get("setter") or "p1"
    guesser = options.get("guesser") or ("p2" if setter == "p1" else "p1")
    if setter == guesser:
        setter, guesser = "p1", "p2"
    return {
        "mode": "solo",
        "round_phase": "playing",
        "word": "",
        "guessed": [],
        "wrong": 0,
        "max_wrong": _MAX_WRONG,
        "alphabet": _ALPHABET,
        "setter": setter,
        "guesser": guesser,
    }


def _masked(word: str, guessed: list[str]) -> str:
    gs = set(guessed)
    return " ".join(ch if ch in gs else "_" for ch in word)


def _normalize_word(raw: Any) -> str | None:
    word = str(raw or "").strip().upper().replace("Ё", "Ё")
    word = re.sub(r"\s+", "", word)
    if not _WORD_RE.match(word):
        return None
    return word


def _human_slots(room: dict[str, Any]) -> list[str]:
    return [s for s, p in (room.get("players") or {}).items() if p and not p.get("ai")]


def _name(room: dict[str, Any], slot: str) -> str:
    p = (room.get("players") or {}).get(slot) or {}
    return p.get("name") or slot


def _start_solo(room: dict[str, Any]) -> None:
    st = room["state"]
    st["mode"] = "solo"
    st["round_phase"] = "playing"
    st["word"] = random.choice(_WORDS).upper()
    st["guessed"] = []
    st["wrong"] = 0
    st["setter"] = None
    st["guesser"] = "p1"
    room["phase"] = "playing"
    room["turn"] = "p1"
    room["winner"] = None
    room["loser"] = None
    room["result"] = None
    room["message"] = "Отгадывай буквы"


def _start_versus_pick(room: dict[str, Any], setter: str, guesser: str) -> None:
    st = room["state"]
    st["mode"] = "versus"
    st["round_phase"] = "pick_word"
    st["word"] = ""
    st["guessed"] = []
    st["wrong"] = 0
    st["setter"] = setter
    st["guesser"] = guesser
    room["phase"] = "playing"
    room["turn"] = setter
    room["winner"] = None
    room["loser"] = None
    room["result"] = None
    room["message"] = f"{_name(room, setter)} загадывает слово — {_name(room, guesser)} пока не смотрит"


def on_both_joined(room: dict[str, Any]) -> None:
    humans = _human_slots(room)
    st = room["state"]
    # соло / робот — случайное слово
    if room.get("vs_ai") or len(humans) < 2:
        _start_solo(room)
        return
    setter = st.get("setter") or "p1"
    guesser = st.get("guesser") or ("p2" if setter == "p1" else "p1")
    if setter not in humans:
        setter = humans[0]
    if guesser not in humans or guesser == setter:
        guesser = next(s for s in humans if s != setter)
    _start_versus_pick(room, setter, guesser)


def rematch_options(room: dict[str, Any]) -> dict[str, Any]:
    """При рематче вдвоём — меняем роли местами."""
    st = room.get("state") or {}
    if st.get("mode") != "versus":
        return {}
    setter = st.get("setter")
    guesser = st.get("guesser")
    if not setter or not guesser:
        return {}
    return {"setter": guesser, "guesser": setter}


def _finish(room: dict[str, Any], *, guesser_won: bool) -> None:
    st = room["state"]
    word = st.get("word") or ""
    room["phase"] = "done"
    room["turn"] = None
    if st.get("mode") == "solo":
        if guesser_won:
            room["winner"] = "p1"
            room["loser"] = None
            room["message"] = f"Угадано слово: {word}"
        else:
            room["winner"] = None
            room["loser"] = "p1"
            room["message"] = f"Не угадал. Слово: {word}"
        return
    setter = st.get("setter")
    guesser = st.get("guesser")
    if guesser_won:
        room["winner"] = guesser
        room["loser"] = setter
        room["message"] = f"{_name(room, guesser)} угадал слово: {word}"
    else:
        room["winner"] = setter
        room["loser"] = guesser
        room["message"] = f"{_name(room, guesser)} не угадал. Слово: {word}"


def apply_action(room: dict[str, Any], slot: str, action: dict[str, Any]) -> tuple[bool, str]:
    if room["phase"] != "playing":
        return False, "Партия не в игре"

    st = room["state"]
    kind = action.get("type")

    if kind == "set_word":
        if st.get("mode") != "versus" or st.get("round_phase") != "pick_word":
            return False, "Сейчас нельзя загадать слово"
        if slot != st.get("setter"):
            return False, "Слово загадывает другой игрок"
        word = _normalize_word(action.get("word"))
        if not word:
            return False, "Слово: 2–16 букв, только кириллица"
        st["word"] = word
        st["guessed"] = []
        st["wrong"] = 0
        st["round_phase"] = "playing"
        guesser = st["guesser"]
        room["turn"] = guesser
        room["message"] = f"{_name(room, guesser)} отгадывает слово"
        return True, "ok"

    if kind != "guess":
        return False, "Неизвестное действие"

    if st.get("round_phase") != "playing" or not st.get("word"):
        return False, "Сначала нужно загадать слово"
    if room.get("turn") and room["turn"] != slot:
        return False, "Сейчас ход соперника"
    if st.get("mode") == "versus" and slot != st.get("guesser"):
        return False, "Буквы называет отгадывающий"

    letter = str(action.get("letter") or "").strip().upper()
    if len(letter) != 1 or letter not in _ALPHABET:
        return False, "Нужна одна буква"
    if letter in st["guessed"]:
        return False, "Эту букву уже называли"

    st["guessed"].append(letter)
    if letter not in st["word"]:
        st["wrong"] = int(st["wrong"]) + 1
        room["message"] = f"Мимо. Ошибок: {st['wrong']}/{st['max_wrong']}"
    else:
        room["message"] = "Есть такая буква!"

    word = st["word"]
    guessed = st["guessed"]
    if all(ch in guessed for ch in set(word)):
        _finish(room, guesser_won=True)
    elif int(st["wrong"]) >= int(st["max_wrong"]):
        _finish(room, guesser_won=False)
    return True, "ok"


def public_view(room: dict[str, Any], viewer: str | None) -> dict[str, Any]:
    st = room["state"]
    mode = st.get("mode") or "solo"
    round_phase = st.get("round_phase") or "playing"
    word = st.get("word") or ""
    setter = st.get("setter")
    guesser = st.get("guesser")
    done = room.get("phase") == "done"
    is_setter = bool(viewer and setter and viewer == setter)
    show_secret = done or (mode == "versus" and is_setter and round_phase == "playing" and word)

    masked = ""
    if round_phase == "pick_word":
        masked = "· · ·"
    elif word:
        masked = _masked(word, st.get("guessed") or [])

    return {
        "phase": round_phase,
        "mode": mode,
        "round_phase": round_phase,
        "masked": masked,
        "word": word if show_secret else None,
        "guessed": list(st.get("guessed") or []),
        "wrong": int(st.get("wrong") or 0),
        "max_wrong": int(st.get("max_wrong") or _MAX_WRONG),
        "alphabet": _ALPHABET,
        "setter": setter,
        "guesser": guesser,
        "can_set_word": bool(
            mode == "versus"
            and round_phase == "pick_word"
            and viewer
            and viewer == setter
        ),
        "can_guess": bool(
            round_phase == "playing"
            and word
            and viewer
            and room.get("phase") == "playing"
            and room.get("turn") == viewer
            and (mode == "solo" or viewer == guesser)
        ),
    }
