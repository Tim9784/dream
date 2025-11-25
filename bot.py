import os
import json
import asyncio
from datetime import datetime, timedelta, time
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
from dotenv import load_dotenv

# Загружаем переменные окружения
load_dotenv()

# Токен бота из переменных окружения
BOT_TOKEN = os.getenv('BOT_TOKEN')

# Файл для хранения данных
DATA_FILE = 'dad_arrival.json'

# Загружаем сохраненные данные
def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

# Сохраняем данные
def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# Команда /start
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Привет! Я бот для отслеживания приезда папы.\n\n"
        "Используй команду /setdate чтобы установить дату и время приезда папы.\n"
        "Формат: /setdate ДД.ММ.ГГГГ ЧЧ:ММ\n"
        "Например: /setdate 25.12.2024 15:30"
    )

# Команда /setdate - установка даты приезда
async def setdate(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = str(update.effective_chat.id)
    
    if not context.args:
        await update.message.reply_text(
            "Используй формат: /setdate ДД.ММ.ГГГГ ЧЧ:ММ\n"
            "Например: /setdate 25.12.2024 15:30"
        )
        return
    
    try:
        # Парсим дату и время
        date_str = ' '.join(context.args)
        arrival_datetime = datetime.strptime(date_str, '%d.%m.%Y %H:%M')
        
        # Проверяем, что дата в будущем
        if arrival_datetime <= datetime.now():
            await update.message.reply_text("Дата должна быть в будущем!")
            return
        
        # Сохраняем данные
        data = load_data()
        if chat_id not in data:
            data[chat_id] = {}
        data[chat_id]['arrival_datetime'] = arrival_datetime.isoformat()
        data[chat_id]['chat_id'] = chat_id
        save_data(data)
        
        await update.message.reply_text(
            f"✅ Дата установлена: {arrival_datetime.strftime('%d.%m.%Y %H:%M')}\n"
            f"Теперь я буду каждый день в 00:00 напоминать, сколько осталось до приезда папы!"
        )
    except ValueError:
        await update.message.reply_text(
            "❌ Неверный формат даты!\n"
            "Используй: /setdate ДД.ММ.ГГГГ ЧЧ:ММ\n"
            "Например: /setdate 25.12.2024 15:30"
        )

# Команда /check - проверить текущее время до приезда
async def check(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = str(update.effective_chat.id)
    data = load_data()
    
    if chat_id not in data or 'arrival_datetime' not in data[chat_id]:
        await update.message.reply_text("Дата приезда еще не установлена. Используй /setdate")
        return
    
    arrival_datetime = datetime.fromisoformat(data[chat_id]['arrival_datetime'])
    now = datetime.now()
    
    if arrival_datetime <= now:
        await update.message.reply_text("Папа уже должен был приехать! Установи новую дату через /setdate")
        return
    
    time_left = arrival_datetime - now
    hours_left = int(time_left.total_seconds() / 3600)
    
    await update.message.reply_text(
        f"⏰ Папа приедет через {hours_left} часов"
    )

# Функция для отправки ежедневных напоминаний
async def send_daily_reminders(context: ContextTypes.DEFAULT_TYPE):
    data = load_data()
    now = datetime.now()
    
    for chat_id, chat_data in data.items():
        if 'arrival_datetime' not in chat_data:
            continue
        
        try:
            arrival_datetime = datetime.fromisoformat(chat_data['arrival_datetime'])
            
            # Проверяем, что дата еще в будущем
            if arrival_datetime <= now:
                continue
            
            # Вычисляем оставшееся время
            time_left = arrival_datetime - now
            hours_left = int(time_left.total_seconds() / 3600)
            
            # Отправляем сообщение
            await context.bot.send_message(
                chat_id=chat_id,
                text=f"⏰ Папа приедет через {hours_left} часов"
            )
        except Exception as e:
            print(f"Ошибка при отправке сообщения в чат {chat_id}: {e}")

# Callback для ежедневных напоминаний
async def daily_reminder_callback(context: ContextTypes.DEFAULT_TYPE):
    await send_daily_reminders(context)

# Основная функция
def main():
    if not BOT_TOKEN:
        print("Ошибка: BOT_TOKEN не установлен! Создай файл .env с BOT_TOKEN=твой_токен")
        return
    
    # Создаем приложение
    application = Application.builder().token(BOT_TOKEN).build()
    
    # Регистрируем обработчики команд
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("setdate", setdate))
    application.add_handler(CommandHandler("check", check))
    
    # Запускаем планировщик ежедневных напоминаний
    job_queue = application.job_queue
    if job_queue:
        # Планируем отправку каждый день в 00:00
        job_queue.run_daily(daily_reminder_callback, time=time(hour=0, minute=0))
    
    # Запускаем бота
    print("Бот запущен!")
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    main()

