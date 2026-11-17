# Plan de refactorización a producción — Mini Agente

Objetivo: mismo conjunto de funciones, más ágil, eficiente y con
comportamiento de agente profesional en modo producción.

## 1. Servidor en modo producción (sin quitar nada)

- **waitress** como servidor WSGI: `pip install waitress` y
  `waitress-serve --host 127.0.0.1 --port 7861 --threads=8 app:app`.
- `start.bat` pasa a usar waitress si está instalado (fallback a Flask dev).
- Cambiar `host="0.0.0.0"` por `127.0.0.1` por defecto: la app es local;
  exponerla a la LAN solo si el usuario lo pide (`HOST=0.0.0.0`).

## 2. Estructura (regla: máx. 250 líneas por archivo)

| Archivo hoy | Propuesta |
|---|---|
| `panels.js` (~1180) | `editor.js` (editor split), `panel_modelos.js`, `panel_sesiones.js`, `panel_proyectos.js` |
| `app.js` (~440) | `chat.js` (send/stream) + `app.js` (init/exportar/importar) |
| `index.html` (~430) | parciales Jinja: `navbar.html`, `modales.html`, `sidebar.html` |
| `routes_data.py` (~600) | `routes_files.py`, `routes_templates.py`, `routes_workspace.py` |
| `app.py` (~250) | `routes_chat.py` para `/api/chat` + `chat_tools.py` |

## 3. Seguridad

- Excluir `.git` y `.agente` de los zips de trabajo (`work_zip`/`_zip_dir`):
  hoy puede viajar el token de GitHub guardado en `.git/config`.
- No escribir el PAT en la URL del remote: usar
  `git -c http.extraheader` o credential helper temporal.
- CSRF en `/api/*`: mismo origen ya ayuda; añadir cabecera `X-Requested-With`
  y rechazar origen externo.

## 4. Datos y rendimiento

- Deduplicar `add_message` (persistSession manda el array completo):
  insertar solo mensajes nuevos (rowid del último guardado).
- Índice `memoria.json` por proyecto (ya existe): reutilizarlo en el
  prompt en vez de releer archivos.
- `keep_alive` del modelo configurable; `num_ctx` guiado por la memoria
  real del equipo (ya está `/api/hwinfo`).

## 5. Comportamiento de agente

- Flujo: `project_map` → memoria → lectura selectiva → edición multi-archivo.
- Preguntar ante ambigüedad (varias barras, varios archivos candidatos).
- Tarjetas de tarea contraíbles por acción (hecho).
- Consola de errores propia (hecho) + `log_error` en cada `err()` del server.
- Modo "Mejorar agente": chat aislado con acceso al propio código (hecho).

## 6. Autoevolución (semi-autónoma)

- `/api/autoevolucionar`: diagnóstico (archivos >250, librerías, errores).
- El usuario aprueba la mejora desde el chat de "Mejorar agente";
  el agente la aplica con `write_file` sobre su propio código.
- Opcional futuro: `POST /api/autoevolucionar/aplicar` para actualizar
  librerías (`pip install -U <pkg>`) previa confirmación del usuario.
