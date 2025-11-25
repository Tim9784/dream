#!/bin/bash
# Скрипт для исправления server.py для Python 3.5 на сервере

# Создаем резервную копию
cp server.py server.py.backup

# Исправляем f-строки на .format()
sed -i 's/prompt = f"""Проанализируй сон и дай интерпретацию. Опиши значения символов и событий. Будь конкретным.\n\nСон: {dream_text}\n\nИнтерпретация на русском:"""/prompt = """Проанализируй сон и дай интерпретацию. Опиши значения символов и событий. Будь конкретным.\n\nСон: {}\n\nИнтерпретация на русском:""".format(dream_text)/' server.py

# Заменяем все остальные f-строки
sed -i 's/f"Authentication error: {e}"/"Authentication error: {}".format(e)/' server.py
sed -i 's/f"Error details: {e.response if hasattr(e, '\''response'\'') else '\''No response'\''}"/error_details = e.response if hasattr(e, '\''response'\'') else '\''No response'\''\n        print("Error details: {}".format(error_details))/' server.py
sed -i "s/f'Неверный API ключ: {str(e)}'/\"Неверный API ключ: {}\".format(str(e))/" server.py
sed -i 's/f"API error: {e}"/"API error: {}".format(e)/' server.py
sed -i 's/f"Error type: {type(e).__name__}"/"Error type: {}".format(type(e).__name__)/' server.py
sed -i 's/f"Error message: {str(e)}"/"Error message: {}".format(str(e))/' server.py
sed -i 's/f"Response: {e.response}"/"Response: {}".format(e.response)/' server.py
sed -i 's/f"Status code: {e.status_code}"/"Status code: {}".format(e.status_code)/' server.py
sed -i "s/f'Ошибка API: {str(e)}'/\"Ошибка API: {}\".format(str(e))/" server.py
sed -i 's/f"API Connection error: {e}"/"API Connection error: {}".format(e)/' server.py
sed -i "s/f'Ошибка подключения: {str(e)}'/\"Ошибка подключения: {}\".format(str(e))/" server.py
sed -i 's/f"Unexpected error: {e}"/"Unexpected error: {}".format(e)/' server.py
sed -i 's/f"Error type: {type(e)}"/"Error type: {}".format(type(e))/' server.py
sed -i 's/f"Error class: {type(e).__name__}"/"Error class: {}".format(type(e).__name__)/' server.py
sed -i "s/f'Неожиданная ошибка: {str(e)}'/\"Неожиданная ошибка: {}\".format(str(e))/" server.py

echo "Файл исправлен! Резервная копия сохранена в server.py.backup"

