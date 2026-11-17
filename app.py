import json
import os

from flask import Flask, Response, jsonify, render_template, request, stream_with_context

import backends
import consola
import db
import file_ops
import ollama_client
import routes_data
import routes_models
from config import OLLAMA_HOST, SYSTEM_PROMPT, UPLOAD_DIR

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024 * 1024
app.config["TEMPLATES_AUTO_RELOAD"] = True
app.register_blueprint(routes_models.bp)
app.register_blueprint(routes_data.bp)
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(file_ops.WORKSPACE_DIR, exist_ok=True)
db.init()
MAX_TOOL_ROUNDS = 4


def err(e, code=400):
    return jsonify({"error": str(e)}), code


@app.get("/")
def index():
    return render_template(
        "index.html", host=OLLAMA_HOST, workspace=file_ops.WORKSPACE_DIR
    )


def _append_delta(buf, payload):
    msg = payload.get("message") or {}
    if msg.get("content"):
        buf.append(msg["content"])


def _chat_rounds(backend, model, messages, root_mode, holder, options=None):
    for _ in range(MAX_TOOL_ROUNDS):
        buf = []
        for line in backends.chat_stream(backend, model, messages, options):
            payload = ollama_client.parse_ndjson_line(line)
            if payload:
                _append_delta(buf, payload)
            yield line + b"\n"
        text = "".join(buf)
        holder["reply"] = file_ops.strip_tool_blocks(text) or text
        calls = file_ops.extract_tool_calls(text)
        if not calls:
            return
        results = [{"call": c, "result": file_ops.run_tool(c, root_mode)} for c in calls]
        yield (json.dumps({"tool_results": results}) + "\n").encode()
        messages = messages + [
            {"role": "assistant", "content": file_ops.strip_tool_blocks(text) or text},
            {
                "role": "user",
                "content": "Resultados de herramientas:\n"
                + json.dumps(results, ensure_ascii=False)[:6000]
                + "\nContinúa.",
            },
        ]


@app.get("/api/autoevolucionar")
def api_autoevolucionar():
    """Diagnóstico del propio agente + recomendaciones (semi-autónomo)."""
    import importlib.metadata as im

    base = os.path.dirname(os.path.abspath(__file__))
    skip = {"modelos", "__pycache__", "node_modules", ".venv", ".venv312",
            "vendor", "uploads", "workspace", "saved_workspaces", ".git",
            ".agente", "plantilla", "variantes"}
    grandes, total = [], 0
    for dirp, dns, fns in os.walk(base):
        dns[:] = [d for d in dns if d not in skip and not d.startswith(".")]
        for fn in fns:
            if not fn.endswith((".py", ".js", ".html", ".css")):
                continue
            total += 1
            try:
                n = sum(1 for _ in open(
                    os.path.join(dirp, fn), encoding="utf-8",
                    errors="replace"))
            except OSError:
                continue
            if n > 250:
                grandes.append(
                    (os.path.relpath(os.path.join(dirp, fn), base)
                     .replace("\\", "/"), n))
    deps = {}
    for pkg in ("flask", "requests", "waitress", "flask-cors"):
        try:
            deps[pkg] = im.version(pkg)
        except im.PackageNotFoundError:
            deps[pkg] = None
    errores = consola.get_errors()
    rep = ["## Diagnóstico del agente", "",
           f"- Archivos propios revisados: **{total}**",
           f"- Errores en consola: **{len(errores)}**",
           f"- Ollama: **{'en línea' if ollama_client.status()['ok'] else 'apagado'}**",
           "", "### Librerías", ""]
    rep += [f"- {k}: {v or 'no instalada'}" for k, v in deps.items()]
    if "waitress" in deps and not deps["waitress"]:
        rep.append("\n> Instala `waitress` para servir en modo producción.")
    rep += ["", "### Violación de regla 250 líneas",
            ""]
    if grandes:
        rep += [f"- `{p}` — {n} líneas" for p, n in
                sorted(grandes, key=lambda x: -x[1])]
        rep.append("\n> Pide: *'divide el archivo X en módulos'* y lo "
                   "reorganizo sin perder funciones.")
    else:
        rep.append("- Ninguna.")
    rep += ["", "### Sugerencias de mejora", "",
            "1. Servir con waitress (producción) en vez del dev server.",
            "2. Mover rutas de `/api/chat` a un blueprint propio.",
            "3. Deduplicar mensajes guardados en SQLite.",
            "4. Excluir `.git` de los zips de trabajo (posible fuga de token).",
            "", "Ordéname cualquiera de estas mejoras y la aplico con tu "
            "autorización."]
    return jsonify({"reporte": "\n".join(rep),
                    "archivos_grandes": grandes})


@app.get("/api/errors")
def api_errors_get():
    return jsonify({"errors": consola.get_errors()})


@app.post("/api/errors")
def api_errors_post():
    data = request.get_json(force=True) or {}
    consola.log_error(data.get("origen", "cliente"), data.get("detalle", ""))
    return jsonify({"ok": True})


@app.delete("/api/errors")
def api_errors_del():
    consola.clear()
    return jsonify({"ok": True})


@app.errorhandler(Exception)
def api_excepcion(e):
    consola.log_error("servidor", f"{type(e).__name__}: {e}")
    return err(e, 500)


@app.post("/api/chat")
def api_chat():
    data = request.get_json(force=True) or {}
    model = data.get("model", "").strip()
    if not model:
        return err("Falta model")
    templates = ", ".join(t["name"] for t in db.list_templates()) or "ninguna"
    system = (
        SYSTEM_PROMPT + "\n\n" + file_ops.TOOLS_DOC
        + f"\n\nPlantillas guardadas disponibles (usa load_template para reutilizarlas): {templates}"
    )
    self_mode = bool(data.get("self_mode"))
    root_mode = bool(data.get("root_mode")) or self_mode
    if self_mode:
        base = os.path.dirname(os.path.abspath(__file__))
        system += (
            f"\n\nMODO MEJORAR AGENTE: trabajas única y exclusivamente sobre "
            f"el código del propio agente en {base}. Usa rutas absolutas de "
            "esa carpeta; NO toques el workspace del usuario ni otros "
            "proyectos. Antes de modificar, explica brevemente qué harás; "
            "escribe archivos completos y válidos con write_file; respeta "
            "REGLAS.md (máx. 250 líneas por archivo, sin CDNs, español)."
        )
    elif root_mode:
        system += (
            "\n\nEl usuario activó 'Acceso root': tienes permiso total sobre su "
            "computadora. Usa rutas absolutas de Windows directamente "
            "(ej. C:/Users/MINIOS/...) con list_files, read_file, write_file, "
            "mkdir, delete y 'run'. No pidas permisos ni digas que no puedes "
            "acceder: ejecuta las herramientas."
        )
    ed = data.get("editor") or {}
    if ed.get("path"):
        content = ed.get("content") or ""
        # Presupuesto: ~3500 tokens para system+historial+respuesta.
        # Cada token ≈ 3 caracteres; nunca exceder la ventana elegida.
        num_ctx = int((data.get("options") or {}).get("num_ctx") or 4096)
        cap = max(0, (num_ctx - 3500) * 3)
        if cap < 1500:
            system += (
                f"\n\nEl usuario tiene abierto en el editor el archivo "
                f"'{ed['path']}' (proyecto: {ed.get('dir') or 'ninguno'}). "
                "La ventana de contexto no alcanza para incluirlo: léelo con "
                "read_file si lo necesitas."
            )
        else:
            truncado = ""
            if len(content) > cap:
                content = content[:cap]
                truncado = ("\n[...truncado: excede el contexto; sube "
                            "'Memoria' en Ajustes o lee por partes]")
            system += (
                f"\n\nEl usuario tiene abierto en el editor el archivo "
                f"'{ed['path']}' (proyecto: {ed.get('dir') or 'ninguno'}). "
                "Este es su contenido actual, incluidos cambios sin guardar:\n"
                f"```\n{content}{truncado}\n```\n"
                "Cuando el usuario pida revisar 'el código del editor' o "
                "similar, refiere a este archivo sin pedir que te lo peguen."
            )
        if ed.get("dir"):
            try:
                import memoria

                target = file_ops._resolve(ed["dir"], root_mode)
                resto = cap - min(len(content), cap)
                if cap >= 1500 or resto > 1200:
                    system += (
                        "\n\nMemoria del proyecto (estructura y firmas):\n"
                        + memoria.digest(target, cap=min(4000, max(resto, 1500)))
                    )
            except Exception:
                pass
    messages = [{"role": "system", "content": system}]
    messages += data.get("messages", [])[-40:]
    session_id = data.get("session_id")
    options = data.get("options") or None
    holder = {"reply": ""}

    backend = data.get("backend", "ollama").strip() or "ollama"

    def gen():
        try:
            yield from _chat_rounds(backend, model, messages, root_mode,
                                   holder, options)
            if session_id and messages[-1]["role"] == "user":
                db.add_message(session_id, "user", messages[-1]["content"])
            if session_id and holder["reply"]:
                db.add_message(session_id, "assistant", holder["reply"])
            yield (json.dumps({"saved": session_id}) + "\n").encode()
        except Exception as e:
            yield (json.dumps({"error": str(e)}) + "\n").encode()

    return Response(stream_with_context(gen()), mimetype="application/x-ndjson")


if __name__ == "__main__":
    ollama_client.ensure_running()
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 7860)))
