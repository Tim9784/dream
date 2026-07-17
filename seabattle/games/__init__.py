"""Game engines for lobby multiplayer."""

from . import backgammon, billiard, blik, checkers, chess, durak, hangman, seabattle, tictactoe

GAMES = {
    "seabattle": {
        "title": "Морской бой",
        "blurb": "Расставь корабли и потопи флот",
        "module": seabattle,
    },
    "tictactoe": {
        "title": "Крестики-нолики",
        "blurb": "Классика 3×3",
        "module": tictactoe,
    },
    "checkers": {
        "title": "Шашки",
        "blurb": "Русские шашки 8×8",
        "module": checkers,
    },
    "chess": {
        "title": "Шахматы",
        "blurb": "Партия на двоих",
        "module": chess,
    },
    "backgammon": {
        "title": "Нарды",
        "blurb": "Длинные нарды — старт с одной головы",
        "module": backgammon,
    },
    "durak": {
        "title": "Дурак",
        "blurb": "Подкидной на 2–4 игрока, колода 36",
        "module": durak,
    },
    "blik": {
        "title": "OUNO",
        "blurb": "Сбрось карты по цвету или знаку — 2–4 игрока",
        "module": blik,
    },
    "hangman": {
        "title": "Виселица",
        "blurb": "Отгадай слово по буквам — соло",
        "module": hangman,
    },
    "billiard": {
        "title": "Бильярд",
        "blurb": "Пул на двоих — целься, сила, траектория",
        "module": billiard,
    },
}

def get_game(game_id: str):
    meta = GAMES.get(game_id)
    return meta["module"] if meta else None
