"""Memoria de código del proyecto: escaneo estructural ligero.

scan_project(root) recorre el proyecto una vez y guarda en
<root>/.agente/memoria.json un resumen por archivo (líneas, tamaño y
firmas: clases, funciones, componentes). digest(root) devuelve ese
resumen en texto compacto para inyectarlo al system prompt, así el
modelo "conoce" el código sin leer cada archivo.
"""
import json
import os
import re
import time

SKIP_DIRS = {".git", ".agente", "node_modules", "__pycache__", ".venv",
             ".venv312", "modelos", "vendor", "exports", "dist", "build"}
SKIP_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".woff",
            ".woff2", ".ttf", ".zip", ".rar", ".7z", ".db", ".sqlite",
            ".gguf", ".bin", ".pdf", ".mp3", ".mp4", ".wav"}
SIG_RES = [
    (re.compile(rb"^\s*(?:async\s+)?def\s+(\w+)|^\s*class\s+(\w+)", re.M), ".py"),
    (re.compile(rb"(?:async\s+)?function\s+(\w+)|(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(", re.M), ".js"),
    (re.compile(rb"^\s*def\s+(\w+)|^\s*class\s+(\w+)", re.M), ".html"),
]


def _sig(path, data):
    ext = os.path.splitext(path)[1].lower()
    sigs = []
    for rx, exts in SIG_RES:
        if ext == exts:
            for m in rx.finditer(data):
                name = m.group(1) or m.group(2)
                if name and len(sigs) < 12:
                    sigs.append(name.decode("utf-8", "replace"))
    return sigs


def scan_project(root):
    root = os.path.abspath(root)
    files, dirs, total_lines = [], set(), 0
    for base, dnames, fnames in os.walk(root):
        dnames[:] = [d for d in dnames if d not in SKIP_DIRS
                     and not d.startswith(".git")]
        rel_dir = os.path.relpath(base, root)
        dirs.add(rel_dir)
        for fn in fnames:
            full = os.path.join(base, fn)
            rel = os.path.normpath(os.path.join(rel_dir, fn))
            try:
                size = os.path.getsize(full)
            except OSError:
                continue
            entry = {"p": rel.replace("\\", "/"), "b": size, "sig": []}
            ext = os.path.splitext(fn)[1].lower()
            if ext not in SKIP_EXT and size < 400_000:
                try:
                    data = open(full, "rb").read()
                    entry["l"] = data.count(b"\n") + 1
                    total_lines += entry["l"]
                    entry["sig"] = _sig(fn, data)
                except OSError:
                    pass
            files.append(entry)
    mem = {"root": root, "at": int(time.time()),
           "totals": {"files": len(files), "dirs": len(dirs),
                      "lines": total_lines},
           "files": sorted(files, key=lambda f: f["p"])}
    try:
        os.makedirs(os.path.join(root, ".agente"), exist_ok=True)
        with open(os.path.join(root, ".agente", "memoria.json"),
                  "w", encoding="utf-8") as f:
            json.dump(mem, f, ensure_ascii=False)
    except OSError:
        pass
    return mem


def load(root, max_age=300):
    root = os.path.abspath(root)
    path = os.path.join(root, ".agente", "memoria.json")
    try:
        mem = json.load(open(path, encoding="utf-8"))
        if mem.get("root") == root and time.time() - mem.get("at", 0) < max_age:
            return mem
    except (OSError, ValueError):
        pass
    return scan_project(root)


def digest(root, cap=4000):
    """Resumen compacto del proyecto para el system prompt."""
    mem = load(root)
    t = mem["totals"]
    lines = [f"Proyecto: {mem['root']} — {t['dirs']} carpetas, "
             f"{t['files']} archivos, {t['lines']} líneas."]
    por_dir = {}
    for f in mem["files"]:
        d = os.path.dirname(f["p"]) or "."
        por_dir[d] = por_dir.get(d, 0) + 1
    lines.append("Carpetas: " + ", ".join(
        f"{d} ({n})" for d, n in sorted(por_dir.items())))
    lines.append("Archivos (líneas: símbolos):")
    for f in mem["files"]:
        lns = f.get("l", "?")
        sig = ", ".join(f["sig"][:6])
        row = f"- {f['p']} ({lns})" + (f": {sig}" if sig else "")
        lines.append(row)
        if sum(len(x) + 1 for x in lines) > cap:
            lines.append("... (memoria completa en .agente/memoria.json)")
            break
    return "\n".join(lines)
