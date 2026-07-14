"""Game engines for lobby multiplayer."""

from . import backgammon, checkers, chess, durak, seabattle, tictactoe

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
        "blurb": "Подкидной на двоих, колода 36",
        "module": durak,
    },
}

def get_game(game_id: str):
    meta = GAMES.get(game_id)
    return meta["module"] if meta else None
