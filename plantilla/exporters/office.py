"""Exportación a Office: docx, xlsx, pptx."""


def to_docx(content, title, out_fn, lines_fn):
    from docx import Document

    doc = Document()
    doc.add_heading(str(title)[:80], 0)
    for line in lines_fn(content):
        doc.add_paragraph(line)
    path = out_fn(title, "docx")
    doc.save(path)
    return path


def to_xlsx(content, title, out_fn, lines_fn):
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    rows = content if isinstance(content, (list, tuple)) else lines_fn(content)
    for row in rows or []:
        ws.append(row if isinstance(row, (list, tuple)) else [row])
    path = out_fn(title, "xlsx")
    wb.save(path)
    return path


def to_pptx(content, title, out_fn, lines_fn):
    from pptx import Presentation

    prs = Presentation()
    slide = prs.slides.add_slide(prs.slide_layouts[1])
    slide.shapes.title.text = str(title)[:80]
    slide.placeholders[1].text = "\n".join(lines_fn(content))[:3000]
    path = out_fn(title, "pptx")
    prs.save(path)
    return path
