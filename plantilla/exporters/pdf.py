"""Exportación a PDF con fpdf2."""


def to_pdf(content, title, out_fn):
    from fpdf import FPDF

    lines = content if isinstance(content, list) else str(content).splitlines()
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 13)
    pdf.multi_cell(0, 8, str(title)[:80], new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", size=11)
    for line in lines or [""]:
        safe = str(line).encode("latin-1", "replace").decode("latin-1")
        pdf.multi_cell(0, 6, safe, new_x="LMARGIN", new_y="NEXT")
    path = out_fn(title, "pdf")
    pdf.output(path)
    return path
