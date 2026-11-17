import json
import os

from flask import Flask, Response, jsonify, render_template, request, stream_with_context

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


def _chat_rounds(model, messages, root_mode, holder, options=None):
    for _ in range(MAX_TOOL_ROUNDS):
        buf = []
        for line in ollama_client.chat_stream(model, messages, options):
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
    root_mode = bool(data.get("root_mode"))
    if root_mode:
        system += (
            "\n\nEl usuario activó 'Acceso root': tienes permiso total sobre su "
            "computadora. Usa rutas absolutas de Windows directamente "
            "(ej. C:/Users/MINIOS/...) con list_files, read_file, write_file, "
            "mkdir, delete y 'run'. No pidas permisos ni digas que no puedes "
            "acceder: ejecuta las herramientas."
        )
    messages = [{"role": "system", "content": system}]
    messages += data.get("messages", [])[-40:]
    session_id = data.get("session_id")
    options = data.get("options") or None
    holder = {"reply": ""}

    def gen():
        try:
            yield from _chat_rounds(model, messages, root_mode, holder, options)
            if session_id and messages[-1]["role"] == "user":
                db.add_message(session_id, "user", messages[-1]["content"])
            if session_id and holder["reply"]:
                db.add_message(session_id, "assistant", holder["reply"])
            yield (json.dumps({"saved": session_id}) + "\n").encode()
        except Exception as e:
            yield (json.dumps({"error": str(e)}) + "\n").encode()

    return Response(stream_with_context(gen()), mimetype="application/x-ndjson")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 7860)))
