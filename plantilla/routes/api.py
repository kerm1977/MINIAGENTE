"""APIs: validaciones, exportaciones, gráficos, QR, PWA y descargas yt-dlp."""
import json

from flask import Blueprint, jsonify, request, send_file

import exporters
import pwa
import validators
from exporters import graficos
from downloaders import video as dv

bp = Blueprint("api", __name__)


def err(e, code=400):
    return jsonify({"error": str(e)}), code


@bp.post("/api/validate/<rule>")
def api_validate(rule):
    value = (request.get_json(force=True) or {}).get("value", "")
    try:
        return jsonify({"ok": True, "value": validators.validate(rule, value)})
    except validators.RuleError as e:
        return err(e)


@bp.post("/api/export/<fmt>")
def api_export(fmt):
    data = request.get_json(force=True) or {}
    try:
        path = exporters.export(
            fmt, data.get("content", ""), data.get("title", "export")
        )
    except Exception as e:
        return err(e)
    return send_file(path, as_attachment=True)


@bp.get("/api/pwa/manifest")
def api_pwa_manifest():
    """Manifiesto PWA con permisos Android solicitables."""
    q = request.args
    return jsonify(pwa.manifest(
        nombre=q.get("nombre", "Mi Proyecto"),
        color=q.get("color", "#0d6efd"),
        fondo=q.get("fondo", "#ffffff"),
    ))


@bp.post("/api/graficos")
def api_graficos():
    """Genera un gráfico (barras/líneas/pastel) en PNG o SVG."""
    data = request.get_json(force=True) or {}
    try:
        path = graficos.render(
            tipo=data.get("tipo", "barras"),
            titulo=data.get("titulo", "Gráfico"),
            etiquetas=data.get("etiquetas", []),
            series=data.get("series", []),
            fmt=data.get("formato", "png"),
        )
    except Exception as e:
        return err(e)
    return send_file(path, as_attachment=True)


@bp.post("/api/import/json")
def api_import_json():
    """Importa un .json (archivo o texto) y devuelve su contenido."""
    f = request.files.get("file")
    if f:
        text = f.read().decode("utf-8", "replace")
    else:
        data = request.get_json(force=True, silent=True) or {}
        text = data.get("text", "")
    if not text:
        return err("Falta archivo o texto JSON")
    try:
        return jsonify({"data": json.loads(text)})
    except ValueError as e:
        return err(f"JSON inválido: {e}")


@bp.post("/api/whatsapp/export")
def api_wa_export():
    """Exporta un chat a .txt o .csv (formato WhatsApp)."""
    data = request.get_json(force=True) or {}
    try:
        path = exporters.export_whatsapp(
            data.get("messages", []),
            data.get("format", "txt"),
            data.get("title", "chat"),
        )
    except Exception as e:
        return err(e)
    return send_file(path, as_attachment=True)


@bp.post("/api/whatsapp/import")
def api_wa_import():
    """Importa un .txt de WhatsApp y devuelve los mensajes parseados."""
    f = request.files.get("file")
    if not f:
        return err("Falta archivo")
    try:
        text = f.read().decode("utf-8", "replace")
        return jsonify({"messages": exporters.parse_whatsapp(text)})
    except Exception as e:
        return err(e)


@bp.post("/api/download/video")
def api_download_video():
    data = request.get_json(force=True) or {}
    url = data.get("url", "").strip()
    if not url:
        return err("Falta url")
    try:
        if data.get("playlist"):
            return jsonify(dv.download_playlist(
                url, audio_only=bool(data.get("audio_only"))
            ))
        return jsonify(dv.download_video(
            url, audio_only=bool(data.get("audio_only"))
        ))
    except Exception as e:
        return err(e, 502)


@bp.post("/api/download/info")
def api_download_info():
    data = request.get_json(force=True) or {}
    try:
        return jsonify(dv.video_info(data.get("url", "").strip()))
    except Exception as e:
        return err(e, 502)
