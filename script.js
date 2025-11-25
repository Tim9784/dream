// Функция для преобразования сна в промпт для ChatGPT
function formatDreamPrompt(dreamText) {
    return `Проанализируй следующий сон и дай его интерпретацию. Опиши возможные значения символов и событий, которые происходили во сне. Будь конкретным и полезным.

Сон:
${dreamText}

Дай подробную интерпретацию этого сна на русском языке.`;
}

// Переменная для хранения интервала таймера
let timerInterval = null;
let startTime = null;

// Функция для форматирования времени
function formatTime(seconds) {
    if (seconds <= 0) return '0 сек';
    if (seconds < 60) return `${Math.ceil(seconds)} сек`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return `${mins} мин ${secs} сек`;
}

// Функция для обновления таймера
function updateTimer() {
    const timerContainer = document.getElementById('timer-container');
    const timerText = document.getElementById('timer-text');
    
    if (!timerContainer || !timerText || !startTime) return;
    
    const elapsed = (Date.now() - startTime) / 1000;
    // Примерное время ответа: 5-8 секунд, динамически корректируем
    const estimatedTime = Math.max(3, 8 - elapsed * 0.3);
    const remaining = Math.max(0, estimatedTime);
    
    if (remaining > 0) {
        timerText.textContent = `Примерное время до ответа: ${formatTime(remaining)}`;
    } else {
        timerText.textContent = 'Обработка...';
    }
}

// Функция для запуска таймера
function startTimer() {
    const timerContainer = document.getElementById('timer-container');
    if (timerContainer) {
        timerContainer.style.display = 'block';
    }
    startTime = Date.now();
    updateTimer();
    timerInterval = setInterval(updateTimer, 100);
}

// Функция для остановки таймера
function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    const timerContainer = document.getElementById('timer-container');
    if (timerContainer) {
        timerContainer.style.display = 'none';
    }
    startTime = null;
}

// Функция для интерпретации сна
async function interpretDream() {
    const dreamInput = document.getElementById('dream-input');
    const resultDiv = document.getElementById('result');
    const errorDiv = document.getElementById('error');
    const interpretationText = document.getElementById('interpretation-text');
    const errorText = document.getElementById('error-text');
    const btn = document.getElementById('interpret-btn');
    const btnText = document.getElementById('btn-text');
    const btnLoader = document.getElementById('btn-loader');

    const dreamText = dreamInput.value.trim();

    if (!dreamText) {
        alert('Пожалуйста, опишите ваш сон');
        return;
    }

    // Показываем загрузку и запускаем таймер
    btn.disabled = true;
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline-block';
    resultDiv.style.display = 'none';
    errorDiv.style.display = 'none';
    startTimer();

    try {
        const apiKey = getApiKey();

        // Отправляем запрос к нашему серверу
        const response = await fetch('http://localhost:5000/api/interpret', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Accept': 'application/json; charset=utf-8'
            },
            body: JSON.stringify({
                dream: dreamText,
                api_key: apiKey
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Server error:', errorData);
            if (response.status === 401 || errorData.error === 'INVALID_KEY') {
                // Неверный API ключ
                throw new Error('INVALID_KEY: ' + (errorData.message || 'Неверный API ключ'));
            }
            const errorMessage = errorData.message || errorData.error || 'Ошибка при обращении к API';
            throw new Error(errorMessage);
        }

        // Получаем ответ с правильной кодировкой
        const responseText = await response.text();
        const data = JSON.parse(responseText);
        const interpretation = data.interpretation;

        // Показываем результат (textContent автоматически обрабатывает UTF-8)
        interpretationText.textContent = interpretation;
        resultDiv.style.display = 'block';
        errorDiv.style.display = 'none';

    } catch (error) {
        console.error('Ошибка:', error);
        resultDiv.style.display = 'none';
        
        if (error.message.includes('INVALID_KEY')) {
            const message = error.message.replace('INVALID_KEY: ', '');
            errorText.textContent = 'Неверный API ключ: ' + message + '\n\nНажмите кнопку "Изменить API ключ" внизу страницы, чтобы ввести новый ключ.';
            errorDiv.style.display = 'block';
            if (confirm('Неверный API ключ: ' + message + '\n\nХотите ввести новый ключ?')) {
                changeApiKey();
            }
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            errorText.textContent = 'Не удалось подключиться к серверу.\n\nУбедитесь, что сервер запущен. Откройте терминал и выполните: python server.py';
            errorDiv.style.display = 'block';
        } else {
            errorText.textContent = 'Произошла ошибка:\n\n' + error.message + '\n\nПроверьте консоль браузера (F12) для деталей.';
            errorDiv.style.display = 'block';
        }
    } finally {
        // Убираем загрузку и останавливаем таймер
        stopTimer();
        btn.disabled = false;
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
    }
}

// Функция для получения API ключа
function getApiKey() {
    // Проверяем, есть ли ключ в localStorage
    let apiKey = localStorage.getItem('openai_api_key');
    
    if (!apiKey) {
        // Запрашиваем ключ у пользователя
        apiKey = prompt('Введите ваш OpenAI API ключ:');
        if (apiKey) {
            localStorage.setItem('openai_api_key', apiKey);
        } else {
            throw new Error('API ключ не предоставлен');
        }
    }
    
    return apiKey;
}

// Функция для изменения API ключа
function changeApiKey() {
    const newKey = prompt('Введите новый OpenAI API ключ:');
    if (newKey && newKey.trim()) {
        localStorage.setItem('openai_api_key', newKey.trim());
        alert('API ключ успешно изменен!');
    } else if (newKey !== null) {
        alert('Ключ не может быть пустым');
    }
}

// Обработчик для Enter в textarea (Shift+Enter для новой строки)
document.getElementById('dream-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && e.ctrlKey) {
        interpretDream();
    }
});

