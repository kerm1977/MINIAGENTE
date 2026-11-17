# REGLAS del proyecto — Mini Agente Code

Estas reglas aplican SIEMPRE, a todo archivo nuevo o modificado, en este
proyecto y en cualquier proyecto generado a partir de esta plantilla.
El agente las tiene en su system prompt y debe cumplirlas sin excepción.

## 1. Código

- **Máximo 250 líneas por archivo.** Si un módulo crece, se divide en
  archivos más pequeños con nombres claros.
- **Prohibido CDNs.** Nada de `cdn.jsdelivr.net`, `unpkg`, `cdnjs`, Google
  Fonts u otras URLs externas en HTML/JS. Toda librería de frontend vive
  localmente en `static/vendor/` (Bootstrap, Bootstrap Icons, html2canvas,
  jsPDF ya incluidos).
- Idioma del código y la UI: **español**.
- Sin secretos ni credenciales en el código; usar variables de entorno.
- Preferir editar archivos existentes antes que crear nuevos.
- Cada funcionalidad va en su módulo (`exporters.py`, `downloader.py`,
  `validators.py`, `db.py`, `file_ops.py`, `ollama_client.py`, `catalog.py`,
  `config.py`) para poder cargarla o no usarla sin romper el resto.

## 2. Validaciones (implementadas en `validators.py`)

- **Teléfono**: solo dígitos, 7–15 caracteres; opcional un `+` inicial.
  Sin letras, ni espacios obligatorios (`(`, `)`, `-` se limpian).
- **Correo**: JAMÁS en mayúsculas. Se valida en minúsculas
  `usuario@dominio.tld`. Cualquier letra mayúscula es error.
- **Nombres y apellidos**: siempre Title Case — cada palabra empieza con
  mayúscula (`Ana María`, `José Pérez`). Minúsculas o MAYÚSCULAS
  completas son error.
- **Numéricos**: campos numéricos solo aceptan números enteros o decimales
  válidos; se rechaza texto mezclado.
- **Vacíos**: campos obligatorios nunca vacíos ni solo espacios.

Para agregar una regla nueva: añadirla como función en `validators.py`,
registrarla en el dict `RULES` y documentarla en esta sección.

## 3. Módulos precargados (mega plantilla)

Todo esto viene instalado con `start.bat` y disponible de inmediato:

- **Web**: Flask, Flask-SQLAlchemy, Flask-Login, Flask-Bcrypt,
  Flask-CORS, Flask-WTF, Flask-Migrate.
- **Seguridad**: bcrypt, cryptography, PyJWT, `hashlib` (SHA-256, builtin).
- **Exportar**: fpdf2 (PDF), Pillow (PNG/JPG/imágenes), python-docx (Word),
  openpyxl (Excel), python-pptx (PowerPoint), JSON nativo.
- **Gráficos/datos**: matplotlib, pandas.
- **IA/media**: ollama (modelos locales), yt-dlp (videos),
  opencv-python-headless (procesamiento de imágenes).
- **Iconos/emojis**: `iconos.py` con paquetes estilo WhatsApp, Facebook,
  Instagram, Messenger, Signal y UI web (API `/api/emojis`).
- **Datos**: SQLite embebido (`mini_agent.db`): sesiones, mensajes,
  snippets y plantillas reutilizables.

Si un proyecto no usa un módulo, simplemente no se importa; no hace falta
desinstalar nada ni modificar la plantilla.

## 4. Herramientas del agente

El modelo puede emitir bloques ```` ```tool ```` con JSON por línea:
`list_files`, `read_file`, `write_file`, `mkdir`, `delete`, `run` (solo
con acceso root autorizado), `export` (pdf/png/jpg/docx/xlsx/pptx/json),
`download_video`, `video_info`, `save_template`, `load_template`,
`list_templates`, `new_project` (genera un proyecto Flask completo en
`workspace/projects/<name>` con esta misma mega plantilla). Las rutas son
relativas a `workspace/` salvo modo root.

## 4.1 Interfaz

- Modo oscuro y modo claro con el botón sol/luna de la barra superior
  (se guarda la preferencia en localStorage).
- Selector de emojis junto al campo de texto (paquetes de `iconos.py`).

## 5. Proyectos nuevos

`scaffold.py` copia `plantilla/` a `workspace/projects/<nombre>` — es la
mega plantilla completa: todos los módulos, validaciones, `REGLAS.md`,
`start.bat`, vendor local y modo dark/light. Pedir "créame un proyecto
Flask llamado X" al agente o usar el panel Proyectos = mismo resultado.

## 6. Arranque (Windows)

Doble clic en `start.bat` — crea `.venv`, actualiza pip, instala
`requirements.txt` y levanta `http://localhost:7860`. Sin pasos manuales.
Requiere Python 3.10+ y, para los modelos, Ollama corriendo.
