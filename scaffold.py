"""Genera proyectos Flask nuevos a partir de la mega plantilla."""
import os
import re
import shutil

TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "plantilla")
PROJECTS_DIR = os.path.join(os.path.dirname(__file__), "workspace", "projects")
NAME_RE = re.compile(r"^[a-z][a-z0-9_-]{0,60}$")


def list_projects():
    if not os.path.isdir(PROJECTS_DIR):
        return []
    return sorted(
        d for d in os.listdir(PROJECTS_DIR)
        if os.path.isdir(os.path.join(PROJECTS_DIR, d))
    )


def create_project(name):
    if not NAME_RE.match(name or ""):
        raise ValueError("Nombre inválido: usa minúsculas, dígitos, - y _ (ej: mi-app)")
    dest = os.path.join(PROJECTS_DIR, name)
    if os.path.exists(dest):
        raise FileExistsError(f"El proyecto '{name}' ya existe")
    shutil.copytree(
        TEMPLATE_DIR, dest,
        ignore=shutil.ignore_patterns(
            "__pycache__", "*.db", ".venv", "exports", "downloads", "uploads",
        ),
    )
    for sub in ("exports", "downloads", "uploads"):
        os.makedirs(os.path.join(dest, sub), exist_ok=True)
    return {
        "name": name,
        "path": dest,
        "arranque": "doble clic en instalar.bat (una vez) y luego start.bat, "
                    "o: python -m venv .venv && pip install -r requirements.txt "
                    "&& python app.py",
        "url": "http://localhost:5000",
        "modulos": sorted(
            f for f in os.listdir(dest) if f.endswith(".py")
        ),
    }
