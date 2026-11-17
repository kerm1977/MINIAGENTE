"""Códigos QR: PNG y SVG con segno (Python puro, sin dependencias pesadas).

Uso:
    from exporters import export
    path = export("qr", "https://ejemplo.com", "qr")   # PNG
    path = export("qrsvg", "Hola", "qr")               # SVG
"""
import os
import time

from config import EXPORT_DIR


def _out(title, ext):
    os.makedirs(EXPORT_DIR, exist_ok=True)
    safe = "".join(c if c.isalnum() or c in "-_" else "_"
                   for c in (title or "qr"))[:60]
    return os.path.join(EXPORT_DIR, f"{safe}_{int(time.time())}.{ext}")


def to_qr(content, title="qr", fmt="png", scale=8, border=2):
    """Genera un QR a partir de texto o lista de líneas. Devuelve la ruta."""
    try:
        import segno
    except ImportError as e:
        raise RuntimeError("Falta 'segno': ejecuta  pip install segno") from e
    lines = content if isinstance(content, (list, tuple)) else str(content).splitlines()
    text = "\n".join(str(x) for x in lines) or " "
    qr = segno.make(text, error="m")
    if fmt == "svg":
        path = _out(title, "svg")
        qr.save(path, kind="svg", border=border, dark="#111111", light="#ffffff")
    else:
        path = _out(title, "png")
        scale = max(2, min(20, int(scale)))
        qr.save(path, kind="png", scale=scale, border=border)
    return path
