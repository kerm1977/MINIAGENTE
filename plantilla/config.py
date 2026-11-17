"""Configuración central de la mega plantilla Flask."""
import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

SECRET_KEY = os.environ.get("SECRET_KEY", "cambia-esto-en-produccion")
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "sqlite:///" + os.path.join(BASE_DIR, "app.db"),
)

UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
EXPORT_DIR = os.path.join(BASE_DIR, "exports")
DOWNLOAD_DIR = os.path.join(BASE_DIR, "downloads")
MODELS_DIR = os.path.join(BASE_DIR, "models")

for _d in (UPLOAD_DIR, EXPORT_DIR, DOWNLOAD_DIR, MODELS_DIR):
    os.makedirs(_d, exist_ok=True)

# Colores de marca (paleta Bootstrap) — usar en CSS.
BRAND_ORANGE = "#0d6efd"
BRAND_BONE = "#f8f9fa"
