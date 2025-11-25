#!/bin/bash
# Скрипт для запуска сервера на Linux

# Проверяем наличие виртуального окружения
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Устанавливаем переменные окружения по умолчанию
export HOST=${HOST:-0.0.0.0}
export PORT=${PORT:-5000}
export DEBUG=${DEBUG:-False}

# Определяем путь к gunicorn
GUNICORN_CMD=""
if [ -f "venv/bin/gunicorn" ]; then
    GUNICORN_CMD="venv/bin/gunicorn"
elif command -v gunicorn &> /dev/null; then
    GUNICORN_CMD="gunicorn"
fi

# Проверяем, установлен ли gunicorn
if [ -n "$GUNICORN_CMD" ]; then
    echo "Запуск через gunicorn..."
    $GUNICORN_CMD -w 4 -b ${HOST}:${PORT} wsgi:app
else
    echo "Gunicorn не найден. Запуск через Flask (не рекомендуется для продакшена)..."
    echo "Установите gunicorn: pip install gunicorn"
    python server.py
fi

