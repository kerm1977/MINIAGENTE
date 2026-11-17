"""Exportación a imagen PNG/JPG con Pillow (dibujo de texto simple)."""


def to_image(content, title, fmt, out_fn):
    from PIL import Image, ImageDraw

    lines = content if isinstance(content, list) else str(content).splitlines()
    lines = [str(x) for x in lines] or [""]
    w = max(600, min(1600, 20 + max(len(l) for l in lines) * 8))
    h = 40 + 20 * len(lines)
    img = Image.new("RGB", (w, h), "#f8f9fa")
    d = ImageDraw.Draw(img)
    d.text((20, 20), "\n".join(lines), fill="#1a1a1a")
    ext = "jpg" if fmt in ("jpg", "jpeg") else "png"
    path = out_fn(title, ext)
    img.save(path, "JPEG" if ext == "jpg" else "PNG")
    return path
