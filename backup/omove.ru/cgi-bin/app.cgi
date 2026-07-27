#!/home/u549672/omove.ru/www/venv/bin/python
import os, sys
ROOT = "/home/u549672/omove.ru/www"
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
os.chdir(ROOT)
from wsgiref.handlers import CGIHandler
from app import app
CGIHandler().run(app)
