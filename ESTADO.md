# mini-agent — Estado del proyecto

Registro de todo lo implementado (local, sin nube, UI en español).

## Arranque
- Servidor: `PORT=7861 .\.venv312\Scripts\python.exe app.py` → http://localhost:7861
- Ollama con `OLLAMA_MODELS=...\modelos`. Hardware: CPU 8 núcleos, 17 GB RAM, sin GPU.

## Chat / modelos
- Enter envía; "+" modal para archivos/carpeta/repo GitHub.
- Nube ☁ de modelos instalados; etiqueta "modelo: X" bajo el chat.
- Panel ⚙ (fixed, centrado siempre): peso/memoria/dispositivo/tokens/hilos, "Analizar equipo" (hwinfo se guarda en SQLite una vez), modelos ideales paginados 5 en 5 con botones numerados.
- Contador de tokens `~N tok · X tok/s` bajo Acceso root durante generación.
- Campana 🔔 junto al estado de Ollama: modelos nuevos gratis no instalados, lista completa con scroll, peso estimado `~N GB`, poll 5 min; "(N nuevos)" junto a Descargar modelo.
- Filtros: embeddings/OCR/guardias/audio/tool-use/médicos/math/autocompletado ocultos de catálogo, campana e ideales; 🔴 descartados; indicador 🟢/🟡 de calidad para código; "✓ funciona en tu equipo".
- Todas las respuestas en español; guía de UI en el prompt; tool JSON como bloque copiable.
- VAD dictado por voz.

## Sesiones / persistencia
- Sesiones colapsables auto-guardadas en SQLite tras cada respuesta.
- Prefs en SQLite: model, preset, mem, device, maxtok, threads, root, hwinfo, ed_dir, ed_file, ed_pane_w, ed_tree_w, sidebar_w, ed_wrap, ed_recent.
- `workspace/state.json`: prefs + modelos instalados + último proyecto/archivo, regenerado en cada cambio.

## Proyectos creados
- Cada plantilla (mega-flask 51793, bootstrap 51793, tailwind 51794, bulma 51795, flexbox 51796) muestra nombre + menú ⋮ con: info técnica (framework, plantilla, puerto, OTA), Trabajar, Guardar nueva versión, Sobrescribir (4 confirmaciones), trabajo.zip, zip, instalar en Descargas/Miniagente, Guardar en GitHub (usuario+token+repo).
- Versiones `versiones/<fw>-vN.0.zip` restaurables y descargables; nunca se pierden.
- OTA: `ota.py` + `version.json` con /api/ota/info|check|apply.
- `instalar.bat`: venv + dependencias + levanta servidor.
- Máx. 250 líneas por archivo; puertos improbables únicos.

## Editor split (estilo Sublime)
- Se abre con "Trabajar" o ⋮ → "Editor (split)"; separador arrastrable `#splitBar` (200px–80%) y `#edSplit` árbol/código y `#sideSplit` panel lateral — todos persisten su ancho.
- Árbol: carpetas primero, expandibles (▶/▼), íconos `bi-filetype-*` por extensión.
- Código: gutter de líneas alineado, resaltado por lenguaje (kw/str/cm/num/tag/fn), Tab=4 espacios, doble clic = línea completa, Ctrl+Z deshacer, Ctrl+Shift+Z/Ctrl+Y rehacer, autoguardado 1.5 s, wrap/no-wrap con margen de 20px junto al scroll.
- Primera línea comentada con `archivo: nombre` según extensión (py/js/css/html/sql/bat…; JSON sin comentario).
- Punto rosado ● en archivos modificados por el agente; ● rojo en carpetas padre.
- "Registro de cambios" bajo Proyectos creados: cada archivo trabajado + botón ↩ que restaura `.bak` (backup automático por escritura vía /api/file/revert).
- Mensaje verde al finalizar: "✔ ha finalizado la edición de los archivos: …".
- "Nuevo proyecto": limpia árbol, editor, log y estado persistido.
- "Recientes": últimos 5 proyectos (dir + archivo), restaura estado completo.
- Estado del editor se restaura idéntico al reingresar.

## UI
- Navbar "Agente" centrada + ⋮ (Apariencia modal: claro/oscuro, color tema, tamaño fuente; Editor; Exportar/Importar JSON).
- Sidebar móvil 94vw/520px sólido; texto de ítems indentado 5pt (excepto Proyectos creados).
- Íconos planos pastel; sombras tenues.

## Archivos clave
- `app.py`, `routes_data.py` (filetree, file GET/POST, /api/file/revert, prefs→state.json), `file_ops.py` (with_header, .bak), `precreados.py` (templates/<fw>, versiones), `db.py` (prefs), `catalog.py`, `ollama_client.py`, `static/panels.js`, `static/app.js`, `static/ajustes.js`, `templates/index.html`, `static/style.css`.
