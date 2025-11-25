from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os

app = Flask(__name__)
CORS(app)  # Разрешаем запросы из браузера

@app.route('/api/interpret', methods=['POST'])
def interpret_dream():
    try:
        data = request.json
        dream_text = data.get('dream')
        api_key = data.get('api_key')
        
        if not dream_text:
            return jsonify({'error': 'Текст сна не предоставлен'}), 400
        
        if not api_key:
            return jsonify({'error': 'API ключ не предоставлен'}), 400
        
        # Обрезаем пробелы у ключа
        api_key = api_key.strip()
        
        # Оптимизированный промпт (короче = быстрее)
        prompt = """Проанализируй сон и дай интерпретацию. Опиши значения символов и событий. Будь конкретным.

Сон: {}

Интерпретация на русском:""".format(dream_text)
        
        # Отправляем запрос к OpenAI через API напрямую (совместимо с Python 3.5)
        headers = {
            "Authorization": "Bearer {}".format(api_key),
            "Content-Type": "application/json"
        }
        
        data = {
            "model": "gpt-4o-mini",
            "messages": [
                {
                    "role": "system",
                    "content": "Ты психолог по интерпретации снов. Даешь краткие, но полезные интерпретации."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.7,
            "max_tokens": 600
        }
        
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers=headers,
            json=data,
            timeout=60
        )
        
        response.raise_for_status()
        result = response.json()
        interpretation = result["choices"][0]["message"]["content"]
        
        return jsonify({'interpretation': interpretation})
        
    except requests.exceptions.HTTPError as e:
        print("HTTP error: {}".format(e))
        status_code = e.response.status_code if hasattr(e, 'response') else None
        error_message = str(e)
        
        try:
            error_data = e.response.json() if hasattr(e, 'response') else {}
            error_message = error_data.get('error', {}).get('message', str(e))
        except:
            pass
        
        print("Status code: {}".format(status_code))
        print("Error message: {}".format(error_message))
        
        # Если это ошибка аутентификации, возвращаем 401
        if status_code == 401:
            return jsonify({'error': 'INVALID_KEY', 'message': 'Неверный API ключ: {}'.format(error_message)}), 401
        return jsonify({'error': 'API_ERROR', 'message': 'Ошибка API: {}'.format(error_message)}), status_code or 500
    except requests.exceptions.RequestException as e:
        print("Connection error: {}".format(e))
        return jsonify({'error': 'CONNECTION_ERROR', 'message': 'Ошибка подключения: {}'.format(str(e))}), 500
    except Exception as e:
        print("Unexpected error: {}".format(e))
        print("Error type: {}".format(type(e)))
        print("Error class: {}".format(type(e).__name__))
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'UNKNOWN_ERROR', 'message': 'Неожиданная ошибка: {}'.format(str(e))}), 500

if __name__ == '__main__':
    # Получаем хост и порт из переменных окружения или используем значения по умолчанию
    host = os.getenv('HOST', '0.0.0.0')  # 0.0.0.0 для доступа извне на Linux
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('DEBUG', 'False').lower() == 'true'  # Отключаем debug для продакшена
    
    app.run(host=host, port=port, debug=debug)

