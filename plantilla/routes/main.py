"""Rutas principales: home y salud del servidor."""
from flask import Blueprint, jsonify, render_template

bp = Blueprint("main", __name__)


@bp.get("/")
def index():
    return render_template("index.html")


@bp.get("/health")
def health():
    return jsonify({"ok": True})
