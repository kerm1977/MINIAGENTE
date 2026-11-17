"""Exportadores modulares: cada formato en su propio módulo.

Uso:
    from exporters import export
    path = export("pdf", "texto", "titulo")

Formatos: pdf, png, jpg, docx, xlsx, pptx, json, txt, qr, qrsvg (whatsapp aparte).
Gráficos (barras/líneas/pastel) en `exporters/graficos.py` vía /api/graficos.
"""
import os
import time

from config import EXPORT_DIR

from . import image, jsonio, office, pdf, qr, whatsapp  # noqa: F401


def _out(name, ext):
    os.makedirs(EXPORT_DIR, exist_ok=True)
    safe = "".join(c if c.isalnum() or c in "-_" else "_"
                   for c in (name or "doc"))[:60]
    return os.path.join(EXPORT_DIR, f"{safe}_{int(time.time())}.{ext}")


def _lines(content):
    if isinstance(content, list):
        return [str(x) for x in content]
    return str(content).splitlines() or [""]


def export(fmt, content, title="export"):
    """Punto único de exportación usado por routes/api.py."""
    fmt = (fmt or "").lower().lstrip(".")
    if fmt == "pdf":
        return pdf.to_pdf(content, title, _out)
    if fmt in ("png", "jpg", "jpeg"):
        return image.to_image(content, title, fmt, _out)
    if fmt in ("docx", "word"):
        return office.to_docx(content, title, _out, _lines)
    if fmt in ("xlsx", "excel"):
        return office.to_xlsx(content, title, _out, _lines)
    if fmt in ("pptx", "powerpoint", "ppt"):
        return office.to_pptx(content, title, _out, _lines)
    if fmt == "json":
        return jsonio.to_json(content, title, _out)
    if fmt == "txt":
        path = _out(title, "txt")
        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(_lines(content)))
        return path
    if fmt in ("qr", "qrcode"):
        return qr.to_qr(content, title, "png")
    if fmt in ("qrsvg", "qr-svg"):
        return qr.to_qr(content, title, "svg")
    raise ValueError(f"Formato no soportado: {fmt}")


def export_whatsapp(messages, fmt="txt", title="chat"):
    """Exporta mensajes estilo WhatsApp a .txt o .csv."""
    return whatsapp.export_messages(messages, fmt, title, _out)


def parse_whatsapp(text):
    """Parsea un .txt exportado de WhatsApp a lista de dicts."""
    return whatsapp.parse_messages(text)
