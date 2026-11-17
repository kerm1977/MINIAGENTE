"""APIs de datos: sesiones, snippets, plantillas y modelos locales."""
import os

from flask import Blueprint, jsonify, request, send_file
from flask_login import current_user

import db
from config import MODELS_DIR

bp = Blueprint("data", __name__)


def err(e, code=400):
    return jsonify({"error": str(e)}), code


# ---------- Sesiones ----------

@bp.get("/api/sessions")
def api_sessions():
    q = db.Session.query.order_by(db.Session.created_at.desc()).limit(100)
    return jsonify({"sessions": [
        {"id": s.id, "title": s.title, "model": s.model,
         "created_at": s.created_at} for s in q
    ]})


@bp.post("/api/sessions")
def api_new_session():
    data = request.get_json(force=True) or {}
    s = db.Session(
        user_id=current_user.id if current_user.is_authenticated else None,
        title=(data.get("title") or "Sin título")[:120],
        model=data.get("model", ""),
    )
    db.session.add(s)
    db.session.commit()
    return jsonify({"id": s.id})


@bp.get("/api/sessions/<int:sid>")
def api_get_session(sid):
    msgs = db.Message.query.filter_by(session_id=sid).order_by(db.Message.id)
    return jsonify({"messages": [
        {"role": m.role, "content": m.content, "created_at": m.created_at}
        for m in msgs
    ]})


@bp.delete("/api/sessions/<int:sid>")
def api_del_session(sid):
    db.Message.query.filter_by(session_id=sid).delete()
    db.session.query(db.Session).filter_by(id=sid).delete()
    db.session.commit()
    return jsonify({"deleted": sid})


# ---------- Snippets ----------

@bp.get("/api/snippets")
def api_snippets():
    rows = db.Snippet.query.order_by(db.Snippet.created_at.desc()).limit(200)
    return jsonify({"snippets": [
        {"id": s.id, "title": s.title, "lang": s.lang,
         "preview": s.content[:80]} for s in rows
    ]})


@bp.post("/api/snippets")
def api_save_snippet():
    data = request.get_json(force=True) or {}
    if not data.get("content", "").strip():
        return err("Sin contenido")
    s = db.Snippet(title=data.get("title", "")[:120],
                   lang=data.get("lang", ""),
                   content=data["content"])
    db.session.add(s)
    db.session.commit()
    return jsonify({"id": s.id})


# ---------- Plantillas ----------

@bp.get("/api/templates")
def api_templates():
    rows = db.Template.query.order_by(db.Template.name)
    return jsonify({"templates": [
        {"id": t.id, "name": t.name, "description": t.description}
        for t in rows
    ]})


# ---------- Modelos locales (models/) ----------

@bp.get("/api/models")
def api_models():
    """Lista los GGUF guardados en la carpeta models/ del proyecto."""
    files = []
    if os.path.isdir(MODELS_DIR):
        for f in sorted(os.listdir(MODELS_DIR)):
            if f.lower().endswith(".gguf"):
                p = os.path.join(MODELS_DIR, f)
                files.append({"name": f, "size": os.path.getsize(p)})
    return jsonify({"models": files, "dir": MODELS_DIR})


@bp.get("/api/models/<path:fname>")
def api_model_download(fname):
    path = os.path.join(MODELS_DIR, fname)
    if not os.path.isfile(path):
        return err("No existe", 404)
    return send_file(path, as_attachment=True)
