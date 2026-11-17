# REGLAS del proyecto — Mega Plantilla Flask

Estas reglas aplican SIEMPRE, a todo archivo nuevo o modificado.

## 1. Código

- **Máximo 250 líneas por archivo.** Si un módulo crece, se divide.
- **Prohibido CDNs.** Toda librería de frontend vive en `static/vendor/`
  (Bootstrap, Bootstrap Icons, Tailwind local, html2canvas, jsPDF).
- Idioma del código y la UI: **español**.
- Sin secretos ni credenciales en el código; usar variables de entorno.
- Estructura modular: `routes/`, `exporters/`, `downloaders/`, `static/js/`,
  `static/css/`, `static/icons/`, `templates/`, `models/`.

## 2. Validaciones (`validators.py`)

- **Teléfono**: solo dígitos, 7–15 caracteres; `+` inicial opcional.
- **Correo**: SIEMPRE minúsculas, con `@` y dominio con punto y extensión.
- **Nombres/apellidos**: Title Case forzado (`Ana María`).
- **Contraseña**: mínimo 8, mezcla letras y números. Los inputs de contraseña
  llevan ojito de visibilidad vía `static/js/password-toggle.js` (módulo
  independiente, no toca el código principal).
- **Numéricos**: solo enteros/decimales válidos; campos vacíos = error.

Para agregar una regla: función en `validators.py` + registro en `RULES`.

## 3. Interfaz

- Navbar superior con **hamburger** a la derecha, colores originales de Bootstrap.
- Fondo claro estándar de Bootstrap, footer Bootstrap pequeño.
- **100% responsiva con Flexbox** en todos los tamaños (móvil → escritorio).
- **Magic bar inferior** estilo móvil: se activa/desactiva con el botón
  correspondiente y aparece fija abajo en pantallas pequeñas.
- Iconografía **flat gratuita** en `static/icons/icons.js` (SVG inline).
- Modo oscuro/claro con botón sol/luna (localStorage).

## 4. Módulos precargados

- **Web**: Flask, Flask-SQLAlchemy, Flask-Login, Flask-Bcrypt, Flask-CORS,
  Flask-WTF, Flask-Migrate.
- **Seguridad**: bcrypt, cryptography, PyJWT, hashlib.
- **Exportar** (`exporters/`): pdf, image (png/jpg), office (docx/xlsx/pptx),
  json (+importación `/api/import/json`), txt, qr (png/svg), whatsapp (txt/csv).
- **Gráficos** (`exporters/graficos.py`): barras, líneas y pastel en PNG/SVG.
- **PWA** (`pwa.py`): manifiesto con permisos Android en `/api/pwa/manifest`.
- **Descargar** (`downloaders/`): yt-dlp video individual y playlists.
- **Datos**: SQLite embebido (`app.db`): usuarios, sesiones, mensajes,
  snippets, plantillas.
- **IA/media**: ollama, faster-whisper, opencv-python-headless, matplotlib,
  pandas.

## 5. Modelos

Los modelos se guardan en `models/` (GGUF). `docs/MODELOS.md` mapea cada
tipo de proyecto con sus modelos recomendados. El catálogo completo del
mini-agente está en `catalog.py`.

## 6. Arranque (Windows)

Doble clic en `instalar.bat` (primera vez) y luego `start.bat`.
O manual: `python -m venv .venv && pip install -r requirements.txt &&
python app.py`.
