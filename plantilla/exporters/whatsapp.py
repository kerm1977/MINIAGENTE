"""Importar/exportar chats estilo WhatsApp (.txt/.csv)."""
import csv
import io
import re

# Formato típico: [12/3/24, 10:30:45] Nombre: mensaje
MSG_RE = re.compile(
    r"^\[?(\d{1,2}/\d{1,2}/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?)\]?\s+"
    r"([^:]+):\s*(.*)$"
)


def export_messages(messages, fmt="txt", title="chat", out_fn=None):
    """messages: lista de dicts {sender, text, time?}."""
    rows = []
    for m in messages or []:
        sender = m.get("sender") or m.get("author") or "Desconocido"
        text = m.get("text") or m.get("content") or ""
        time = m.get("time") or m.get("timestamp") or ""
        rows.append((time, sender, text))
    if fmt == "csv":
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["hora", "remitente", "mensaje"])
        w.writerows(rows)
        path = out_fn(title, "csv")
        with open(path, "w", encoding="utf-8", newline="") as f:
            f.write(buf.getvalue())
        return path
    lines = [f"[{t}] {s}: {x}" if t else f"{s}: {x}" for t, s, x in rows]
    path = out_fn(title, "txt")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    return path


def parse_messages(text):
    """Parsea texto exportado de WhatsApp a [{'time','sender','text'}]."""
    out = []
    for line in (text or "").splitlines():
        m = MSG_RE.match(line.strip())
        if m:
            out.append({"time": m.group(1).strip(),
                        "sender": m.group(2).strip(),
                        "text": m.group(3).strip()})
    return out
