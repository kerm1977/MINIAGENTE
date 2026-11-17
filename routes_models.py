import json
import os
import uuid

from flask import Blueprint, Response, jsonify, request
from werkzeug.utils import secure_filename

import catalog
import ollama_client
import scaffold
from config import ALLOWED_MODEL_EXT, OLLAMA_HOST, SYSTEM_PROMPT, UPLOAD_DIR

bp = Blueprint("models", __name__)


def err(e, code=400):
    return jsonify({"error": str(e)}), code


@bp.get("/api/status")
def api_status():
    import file_ops

    try:
        data = ollama_client.status()
    except Exception as e:
        data = {"ok": False, "error": str(e), "host": OLLAMA_HOST}
    data["workspace"] = file_ops.WORKSPACE_DIR
    return jsonify(data)


@bp.get("/api/models")
def api_models():
    try:
        return jsonify({"models": ollama_client.list_models()})
    except Exception as e:
        return err(e, 502)


@bp.delete("/api/models/<path:name>")
def api_delete(name):
    try:
        return jsonify(ollama_client.delete(name))
    except Exception as e:
        return err(e)


@bp.post("/api/models/pull")
def api_pull():
    name = (request.get_json(force=True) or {}).get("name", "").strip()
    if not name:
        return err("Falta name")
    try:
        return jsonify(ollama_client.pull(name))
    except Exception as e:
        return err(e, 502)


@bp.post("/api/models/pull-stream")
def api_pull_stream():
    """Descarga un modelo emitiendo progreso NDJSON (completed/total)."""
    name = (request.get_json(force=True) or {}).get("name", "").strip()
    if not name:
        return err("Falta name")

    def gen():
        try:
            for ev in ollama_client.pull_stream(name):
                yield json.dumps(ev) + "\n"
            yield json.dumps({"done": True, "status": "success"}) + "\n"
        except Exception as e:
            yield json.dumps({"done": True, "status": "error", "error": str(e)}) + "\n"

    return Response(gen(), mimetype="application/x-ndjson")


@bp.post("/api/models/create")
def api_create():
    data = request.get_json(force=True) or {}
    name = data.get("name", "").strip()
    source = data.get("base", "").strip()
    if not name or not source:
        return err("Faltan name o base")
    modelfile = ollama_client.default_modelfile(source, data.get("system", ""))
    try:
        return jsonify(ollama_client.create(name, modelfile))
    except Exception as e:
        return err(e, 502)


@bp.post("/api/models/upload")
def api_upload():
    f = request.files.get("file")
    name = request.form.get("name", "").strip()
    if not f or not f.filename:
        return err("Falta archivo")
    if not name:
        name = os.path.splitext(secure_filename(f.filename))[0]
    if os.path.splitext(f.filename)[1].lower() not in ALLOWED_MODEL_EXT:
        return err("Solo se aceptan archivos .gguf")
    path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4().hex}_{secure_filename(f.filename)}")
    f.save(path)
    modelfile = ollama_client.default_modelfile(
        path, request.form.get("system", SYSTEM_PROMPT)
    )
    try:
        result = ollama_client.create(name, modelfile)
    except Exception as e:
        return err(e, 502)
    return jsonify({"name": name, "result": result, "gguf": path})


def _catalog_with_installed(force=False):
    try:
        installed = {m["name"] for m in ollama_client.list_models()}
    except Exception:
        installed = set()
    entries = catalog.catalog_entries(force)
    for entry in entries:
        entry["installed"] = entry["name"] in installed
    return entries


@bp.get("/api/catalog")
def api_catalog():
    return jsonify({"catalog": _catalog_with_installed()})


@bp.post("/api/catalog/refresh")
def api_catalog_refresh():
    """Busca modelos nuevos en la librería oficial de Ollama."""
    try:
        entries = _catalog_with_installed(force=True)
        nuevos = sum(1 for e in entries if e.get("tag") == "nuevo")
        return jsonify({"catalog": entries, "count": len(entries), "nuevos": nuevos})
    except Exception as e:
        return err(e, 502)
