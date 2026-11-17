import json
import os
import time

EXPORT_DIR = os.path.join(os.path.dirname(__file__), "workspace", "exports")


def _out(name, ext):
    os.makedirs(EXPORT_DIR, exist_ok=True)
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in (name or "doc"))[:60]
    path = os.path.join(EXPORT_DIR, f"{safe}_{int(time.time())}.{ext}")
    return path


def _lines(content):
    if isinstance(content, list):
        return [str(x) for x in content]
    return str(content).splitlines() or [""]


def to_pdf(content, title="documento"):
    from fpdf import FPDF

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 13)
    pdf.multi_cell(0, 8, title[:80], new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", size=11)
    for line in _lines(content):
        safe = line.encode("latin-1", "replace").decode("latin-1")
        pdf.multi_cell(0, 6, safe, new_x="LMARGIN", new_y="NEXT")
    path = _out(title, "pdf")
    pdf.output(path)
    return path


def to_image(content, title="imagen", fmt="png"):
    from PIL import Image, ImageDraw

    lines = _lines(content)
    w = max(600, min(1600, 20 + max(len(l) for l in lines) * 8))
    h = 40 + 20 * len(lines)
    img = Image.new("RGB", (w, h), "#0d1117")
    d = ImageDraw.Draw(img)
    d.text((20, 20), "\n".join(lines), fill="#e6edf3")
    path = _out(title, "jpg" if fmt in ("jpg", "jpeg") else "png")
    img.save(path, "JPEG" if path.endswith("jpg") else "PNG")
    return path


def to_docx(content, title="documento"):
    from docx import Document

    doc = Document()
    doc.add_heading(title[:80], 0)
    for line in _lines(content):
        doc.add_paragraph(line)
    path = _out(title, "docx")
    doc.save(path)
    return path


def to_xlsx(rows, title="tabla"):
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    if isinstance(rows, str):
        rows = [r.split(",") for r in rows.splitlines() if r.strip()]
    for row in rows or _lines(rows):
        ws.append(row if isinstance(row, (list, tuple)) else [row])
    path = _out(title, "xlsx")
    wb.save(path)
    return path


def to_pptx(content, title="presentacion"):
    from pptx import Presentation
    from pptx.util import Inches

    prs = Presentation()
    slide = prs.slides.add_slide(prs.slide_layouts[1])
    slide.shapes.title.text = title[:80]
    slide.placeholders[1].text = "\n".join(_lines(content))[:3000]
    path = _out(title, "pptx")
    prs.save(path)
    return path


def to_json(data, title="datos"):
    path = _out(title, "json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return path


def from_json(path_or_text):
    if os.path.exists(path_or_text):
        with open(path_or_text, encoding="utf-8") as f:
            return json.load(f)
    return json.loads(path_or_text)


def export(fmt, content, title="export"):
    fmt = (fmt or "").lower().lstrip(".")
    if fmt == "pdf":
        return to_pdf(content, title)
    if fmt in ("png", "jpg", "jpeg"):
        return to_image(content, title, fmt)
    if fmt in ("docx", "word"):
        return to_docx(content, title)
    if fmt in ("xlsx", "excel"):
        return to_xlsx(content, title)
    if fmt in ("pptx", "powerpoint", "ppt"):
        return to_pptx(content, title)
    if fmt == "json":
        return to_json(content, title)
    raise ValueError(f"Formato no soportado: {fmt}")
