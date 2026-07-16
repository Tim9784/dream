from __future__ import annotations

import random
from typing import Any

# Небольшой список русских слов (без пробелов и дефисов)
_WORDS = [
    "КОТ", "СОБАКА", "ДОМ", "МОЛОКО", "ДЕРЕВО", "МАШИНА", "ЯБЛОКО", "РЫБА", "ШКОЛА",
    "ЛАМПА", "ТРАВА", "СНЕГ", "КРОВАТЬ", "КНИГА", "СОЛНЦЕ", "ОКНО", "СТОЛ", "ЧАЙ",
    "КОФЕ", "МОРЕ", "ГОРЫ", "ЗВЕЗДА", "ЛИСА", "ЖУРАВЛЬ", "МУЗЫКА", "ПЛИТА", "ТАРЕЛКА",
]

_ALPHABET = list("АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ")
_MAX_WRONG = 6


def init_state(options: dict[str, Any] | None = None) -> dict[str, Any]:
    word = random.choice(_WORDS).upper()
    return {
        "phase": "playing",
        "word": word,               # секрет
        "guessed": [],              # уже названные буквы (строки)
        "wrong": 0,
        "max_wrong": _MAX_WRONG,
        "alphabet": _ALPHABET,
    }


def _masked(word: str, guessed: list[str]) -> str:
    s = []
    gs = set(guessed)
    for ch in word:
        s.append(ch if ch in gs else "_")
    return " ".join(s)


def _check_done(st: dict[str, Any]) -> tuple[bool, str | None, str]:
    word = st["word"]
    guessed = st["guessed"]
    wrong = int(st["wrong"])
    if all((ch in guessed) for ch in set(word)):
        return True, "p1", f"Угадано слово: {word}"
    if wrong >= int(st["max_wrong"]):
        return True, None, f"Не угадал. Слово: {word}"
    return False, None, ""


def on_both_joined(room: dict[str, Any]) -> None:
    # Соло-режим: сразу ход игрока p1
    room["phase"] = "playing"
    room["turn"] = "p1"
    room["message"] = "Отгадывай буквы"


def apply_action(room: dict[str, Any], slot: str, action: dict[str, Any]) -> tuple[bool, str]:
    if room["phase"] != "playing":
        return False, "Партия не в игре"
    if room.get("turn") and room["turn"] != slot:
        return False, "Сейчас ход соперника"

    st = room["state"]
    kind = action.get("type")
    if kind != "guess":
        return False, "Неизвестное действие"
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

    done, winner, msg = _check_done(st)
    if done:
        room["phase"] = "done"
        room["turn"] = None
        room["winner"] = winner
        room["message"] = msg
    return True, "ok"


def public_view(room: dict[str, Any], viewer: str | None) -> dict[str, Any]:
    st = room["state"]
    return {
        "phase": st.get("phase") or room.get("phase"),
        "masked": _masked(st["word"], st["guessed"]),
        "guessed": list(st["guessed"]),
        "wrong": int(st["wrong"]),
        "max_wrong": int(st["max_wrong"]),
        "alphabet": _ALPHABET,
    }

