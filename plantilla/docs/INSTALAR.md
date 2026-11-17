# Instalación de la Mega Plantilla Flask

## Opción fácil (Windows)

1. Doble clic en **`instalar.bat`** — crea `.venv` e instala todas las
   dependencias (Flask, bcrypt, exportadores, yt-dlp, whisper, etc.).
2. Doble clic en **`start.bat`** — levanta la app en
   `http://localhost:51793`.

## Opción manual

```bat
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

## Portable entre equipos

La carpeta completa es portable: copia la carpeta entera a otra PC con
Python 3.10+ y ejecuta `instalar.bat` + `start.bat`. Los datos viven en:

- `app.db` — SQLite embebido (usuarios, sesiones, snippets).
- `models/` — modelos GGUF locales.
- `exports/` — archivos exportados.
- `downloads/` — videos descargados con yt-dlp.
- `uploads/` — archivos subidos.

## Primeros pasos

1. Entra a `/registro`, crea tu cuenta (valida correo minúsculas, nombres
   Title Case, contraseña con letras y números).
2. Los campos de contraseña muestran el ojito para ver/ocultar.
3. El botón de teléfono de la barra superior activa la **magic bar**
   inferior (vista móvil). El botón sol/luna cambia el tema.
