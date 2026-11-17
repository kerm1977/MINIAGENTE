"""Gráficos PNG/SVG con matplotlib: barras, líneas y pastel.

Uso:
    from exporters import graficos
    path = graficos.render("barras", "Ventas", ["Ene", "Feb"],
                           [{"nombre": "2026", "valores": [10, 20]}])
"""
import os
import time

from config import EXPORT_DIR


def _out(title, ext):
    os.makedirs(EXPORT_DIR, exist_ok=True)
    safe = "".join(c if c.isalnum() or c in "-_" else "_"
                   for c in (title or "grafico"))[:60]
    return os.path.join(EXPORT_DIR, f"{safe}_{int(time.time())}.{ext}")


def render(tipo="barras", titulo="Gráfico", etiquetas=None,
           series=None, fmt="png"):
    """Genera un gráfico y devuelve la ruta del archivo."""
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError as e:
        raise RuntimeError("Falta 'matplotlib': pip install matplotlib") from e

    etiquetas = list(etiquetas or [])
    series = [s for s in (series or []) if s.get("valores")]
    if not series:
        raise ValueError("No hay datos: envía 'series' con 'valores'.")

    fig, ax = plt.subplots(figsize=(7, 4))
    tipo = (tipo or "barras").lower()

    if tipo in ("linea", "line", "línea"):
        for s in series:
            ax.plot(etiquetas, s["valores"], marker="o", label=s.get("nombre", ""))
        ax.legend()
    elif tipo in ("pastel", "pie"):
        vals = series[0]["valores"][: len(etiquetas) or None]
        ax.pie(vals, labels=etiquetas or None, autopct="%1.1f%%")
        ax.axis("equal")
    else:  # barras (agrupadas si hay varias series)
        n = len(series)
        width = 0.8 / max(1, n)
        x = list(range(len(etiquetas)))
        for i, s in enumerate(series):
            offset = (i - (n - 1) / 2) * width
            ax.bar([xi + offset for xi in x], s["valores"],
                   width=width, label=s.get("nombre", ""))
        ax.set_xticks(x)
        ax.set_xticklabels(etiquetas)
        ax.legend()

    ax.set_title(titulo)
    fig.tight_layout()
    ext = "svg" if (fmt or "png").lower() == "svg" else "png"
    path = _out(titulo, ext)
    fig.savefig(path, format=ext, dpi=100, bbox_inches="tight")
    plt.close(fig)
    return path
