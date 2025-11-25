"""
WSGI файл для запуска приложения через gunicorn на Linux серверах
"""
from server import app

if __name__ == "__main__":
    app.run()

