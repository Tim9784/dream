from flask import Flask, request, jsonify
from flask_cors import CORS
import openai
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
        
        # Отправляем запрос к OpenAI
        client = openai.OpenAI(api_key=api_key)
        
        # Используем только gpt-4o-mini с оптимизированными параметрами
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "Ты психолог по интерпретации снов. Даешь краткие, но полезные интерпретации."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.7,
            max_tokens=600  # Уменьшено для ускорения
        )
        
        interpretation = response.choices[0].message.content
        
        return jsonify({'interpretation': interpretation})
        
    except openai.AuthenticationError as e:
        print("Authentication error: {}".format(e))
        error_details = e.response if hasattr(e, 'response') else 'No response'
        print("Error details: {}".format(error_details))
        return jsonify({'error': 'INVALID_KEY', 'message': 'Неверный API ключ: {}'.format(str(e))}), 401
    except openai.APIError as e:
        print("API error: {}".format(e))
        print("Error type: {}".format(type(e).__name__))
        print("Error message: {}".format(str(e)))
        if hasattr(e, 'response'):
            print("Response: {}".format(e.response))
        if hasattr(e, 'status_code'):
            print("Status code: {}".format(e.status_code))
        # Если это ошибка аутентификации, возвращаем 401
        if hasattr(e, 'status_code') and e.status_code == 401:
            return jsonify({'error': 'INVALID_KEY', 'message': 'Неверный API ключ: {}'.format(str(e))}), 401
        return jsonify({'error': 'API_ERROR', 'message': 'Ошибка API: {}'.format(str(e))}), 500
    except openai.APIConnectionError as e:
        print("API Connection error: {}".format(e))
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

