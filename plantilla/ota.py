"""Sistema de actualización OTA: version.json + check/apply."""
import io
import json
import zipfile
from pathlib import Path

import requests
from flask import Blueprint, jsonify, request

bp = Blueprint("ota", __name__)

BASE_DIR = Path(__file__).parent
VER_FILE = BASE_DIR / "version.json"
OTA_MANIFEST_URL = BASE_DIR / "ota_source.txt"


def _version():
    try:
        return json.loads(VER_FILE.read_text(encoding="utf-8")).get("version", "0.0")
    except Exception:
        return "0.0"


@bp.get("/api/ota/info")
def ota_info():
    src = OTA_MANIFEST_URL.read_text().strip() if OTA_MANIFEST_URL.exists() else ""
    return jsonify({"version": _version(), "source": src or None})


@bp.post("/api/ota/check")
def ota_check():
    """Compara la versión local con el manifest remoto en ota_source.txt."""
    url = (request.get_json(force=True) or {}).get("url")
    if not url and OTA_MANIFEST_URL.exists():
        url = OTA_MANIFEST_URL.read_text().strip()
    if not url:
        return jsonify({"error": "sin fuente OTA (ota_source.txt)"}), 400
    try:
        r = requests.get(url, timeout=10)
        remote = r.json()
    except Exception as e:
        return jsonify({"error": str(e)}), 502
    local = _version()
    rv = remote.get("version", "0.0")
    return jsonify({
        "local": local,
        "remote": rv,
        "update_available": rv != local,
        "zip_url": remote.get("zip_url"),
    })


@bp.post("/api/ota/apply")
def ota_apply():
    """Descarga el zip remoto y lo extrae sobre el proyecto."""
    data = request.get_json(force=True) or {}
    zip_url = data.get("zip_url")
    if not zip_url:
        return jsonify({"error": "falta zip_url"}), 400
    try:
        r = requests.get(zip_url, timeout=120)
        r.raise_for_status()
        with zipfile.ZipFile(io.BytesIO(r.content)) as z:
            z.extractall(BASE_DIR)
    except Exception as e:
        return jsonify({"error": str(e)}), 502
    return jsonify({"ok": True, "version": _version()})
