import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

# Prefer local venv if present
_venv_site = os.path.join(ROOT, "venv", "lib")
if os.path.isdir(_venv_site):
    for name in os.listdir(_venv_site):
        site = os.path.join(_venv_site, name, "site-packages")
        if os.path.isdir(site) and site not in sys.path:
            sys.path.insert(0, site)

from app import app as application  # noqa: E402
