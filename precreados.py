"""Proyectos precreados descargables: un zip por framework CSS.

La base es siempre `plantilla/` (módulos Python, rutas, exporters,
downloaders, auth, modelos y REGLAS.md).
Cada variante en `variantes/<fw>/` reemplaza los templates que trae y
puede añadir assets extra (p. ej. `static/vendor/tailwind.js`).
"""
import fnmatch
import io
import shutil
import zipfile
from pathlib import Path

DESTINO = Path.home() / "Downloads" / "Miniagente"

BASE = Path(__file__).parent / "plantilla"
VARIANTES = Path(__file__).parent / "variantes"

FRAMEWORKS = {
    "bootstrap": "Bootstrap 5 + íconos",
    "tailwind": "Tailwind CSS",
    "bulma": "Bulma CSS",
    "flexbox": "Flexbox puro (sin framework)",
}

# Puerto improbable único por proyecto — nunca se repiten.
PORT_MAP = {
    "bootstrap": 51793,
    "tailwind": 51794,
    "bulma": 51795,
    "flexbox": 51796,
}
PORT_PATCH_FILES = {"app.py", "start.bat", "instalar.bat", "docs/INSTALAR.md"}

# Lo que trae la plantilla base y no aplica a otras variantes.
SOLO_BOOTSTRAP = {"static/vendor/bootstrap.min.css", "static/vendor/bootstrap.bundle.min.js"}
BASE_DOCS = {"docs/INSTALAR.md"}

# Carpetas/archivos generados que nunca van en el zip.
IGNORAR = [
    "*/.venv/*", "*/__pycache__/*", "__pycache__/*", "*.pyc", "*.db",
    "*/exports/*", "*/downloads/*", "*/uploads/*", "app.db",
]


def frameworks():
    """Lista los proyectos con su framework, puerto y si trae OTA."""
    out = [{"id": "mega-flask", "label": "Mega Plantilla Flask (Bootstrap)",
            "port": PORT_MAP["bootstrap"], "ota": True,
            "plantilla": "plantilla/", "framework": "Bootstrap 5"}]
    out += [{"id": k, "label": v, "port": PORT_MAP[k], "ota": True,
             "plantilla": "plantilla/ + variantes/" + k + "/", "framework": v}
            for k, v in FRAMEWORKS.items()]
    return out


def _files(folder):
    return {p.relative_to(folder).as_posix(): p
            for p in folder.rglob("*") if p.is_file()}


def _ignorado(rel):
    return any(fnmatch.fnmatch(rel, pat) for pat in IGNORAR)


def build_zip(fw):
    """Zip en memoria del proyecto completo para el framework dado."""
    if fw == "mega-flask":
        fw = "bootstrap"
    elif fw not in FRAMEWORKS:
        raise ValueError(f"framework desconocido: {fw}")
    root = f"proyecto-{fw}"
    base_files = {rel: p for rel, p in _files(BASE).items() if not _ignorado(rel)}
    var_files = _files(VARIANTES / fw) if (VARIANTES / fw).is_dir() else {}
    # La variante pisa lo que trae la base con el mismo nombre.
    base_files = {rel: p for rel, p in base_files.items() if rel not in var_files}
    if fw != "bootstrap":
        drop = SOLO_BOOTSTRAP | BASE_DOCS
        base_files = {rel: p for rel, p in base_files.items() if rel not in drop}

    port = PORT_MAP[fw]

    def _write(z, rel, p):
        if rel in PORT_PATCH_FILES:
            z.writestr(f"{root}/{rel}",
                       p.read_text(encoding="utf-8").replace("51793", str(port)))
        else:
            z.write(p, f"{root}/{rel}")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for rel, p in sorted(base_files.items()):
            _write(z, rel, p)
        for rel, p in sorted(var_files.items()):
            _write(z, rel, p)
    buf.seek(0)
    return buf


def extract_to_downloads(fw):
    """Extrae el proyecto directo en ~/Downloads/Miniagente/proyecto-<fw>."""
    if fw == "mega-flask":
        fw = "bootstrap"
    if fw not in FRAMEWORKS:
        raise ValueError(f"framework desconocido: {fw}")
    buf = build_zip(fw)
    target = DESTINO / f"proyecto-{fw}"
    target.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(buf) as z:
        z.extractall(DESTINO)
    return {"ok": True, "path": str(target)}


# --- Plantillas editables + control de versiones ---

WORK = Path(__file__).parent / "workspace" / "templates"
VER_DIR = Path(__file__).parent / "versiones"
MAX_LINES = 250
CODE_EXTS = {".py", ".html", ".css", ".js", ".md", ".txt", ".json", ".yaml"}


def _resolve_fw(fw):
    fw = "bootstrap" if fw == "mega-flask" else fw
    if fw not in FRAMEWORKS:
        raise ValueError(f"framework desconocido: {fw}")
    return fw


def _merged_files(fw):
    """{rel: path} igual que build_zip pero sin comprimir."""
    fw = _resolve_fw(fw)
    base_files = {rel: p for rel, p in _files(BASE).items() if not _ignorado(rel)}
    var_files = _files(VARIANTES / fw) if (VARIANTES / fw).is_dir() else {}
    merged = {rel: p for rel, p in base_files.items() if rel not in var_files}
    if fw != "bootstrap":
        drop = SOLO_BOOTSTRAP | BASE_DOCS
        merged = {rel: p for rel, p in merged.items() if rel not in drop}
    merged.update(var_files)
    return merged


def work_dir(fw):
    return WORK / _resolve_fw(fw)


def load_work(fw):
    """Materializa la plantilla+variante en workspace/templates/<fw>."""
    fw = _resolve_fw(fw)
    d = work_dir(fw)
    if d.exists():
        shutil.rmtree(d)
    port = PORT_MAP[fw]
    for rel, src in _merged_files(fw).items():
        t = d / rel
        t.parent.mkdir(parents=True, exist_ok=True)
        if rel in PORT_PATCH_FILES:
            t.write_text(src.read_text(encoding="utf-8").replace("51793", str(port)),
                         encoding="utf-8")
        else:
            shutil.copy2(src, t)
    return {"ok": True, "path": f"templates/{fw}", "port": port}


def check_max_lines(d):
    """Archivos de código que superan MAX_LINES."""
    over = []
    for p in Path(d).rglob("*"):
        if p.is_file() and p.suffix.lower() in CODE_EXTS:
            try:
                n = sum(1 for _ in open(p, encoding="utf-8", errors="ignore"))
            except OSError:
                continue
            if n > MAX_LINES:
                over.append((p.relative_to(d).as_posix(), n))
    return over


def _zip_dir(d, root=""):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted(Path(d).rglob("*")):
            if p.is_file():
                z.write(p, f"{root}{p.relative_to(d).as_posix()}")
    buf.seek(0)
    return buf


def save_version(fw):
    """Guarda la copia de trabajo como versiones/<fw>-vN.0.zip."""
    fw = _resolve_fw(fw)
    d = work_dir(fw)
    if not d.is_dir():
        raise ValueError("primero pulsa 'Trabajar' para cargar la plantilla")
    over = check_max_lines(d)
    if over:
        lista = ", ".join(f"{r} ({n} líneas)" for r, n in over[:5])
        raise ValueError(f"Archivos sobre {MAX_LINES} líneas: {lista}")
    VER_DIR.mkdir(exist_ok=True)
    n = len(list(VER_DIR.glob(f"{fw}-v*.zip"))) + 1
    name = f"{fw}-v{n}.0.zip"
    (VER_DIR / name).write_bytes(_zip_dir(d).getvalue())
    return {"ok": True, "version": name.removesuffix(".zip")}


def list_versions(fw):
    fw = _resolve_fw(fw)
    if not VER_DIR.is_dir():
        return []
    return sorted(p.name.removesuffix(".zip") for p in VER_DIR.glob(f"{fw}-v*.zip"))


def overwrite_source(fw):
    """Escribe la copia de trabajo de vuelta a plantilla/ o variantes/<fw>/."""
    fw = _resolve_fw(fw)
    d = work_dir(fw)
    if not d.is_dir():
        raise ValueError("primero pulsa 'Trabajar' para cargar la plantilla")
    over = check_max_lines(d)
    if over:
        lista = ", ".join(f"{r} ({n} líneas)" for r, n in over[:5])
        raise ValueError(f"Archivos sobre {MAX_LINES} líneas: {lista}")
    import shutil
    written = 0
    if fw == "bootstrap":
        for rel, src in _files(d).items():
            t = BASE / rel
            t.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, t)
            written += 1
    else:
        base = _files(BASE)
        vd = VARIANTES / fw
        vd.mkdir(parents=True, exist_ok=True)
        for rel, src in _files(d).items():
            same = rel in base and base[rel].read_bytes() == src.read_bytes()
            if same:
                continue
            t = vd / rel
            t.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, t)
            written += 1
    return {"ok": True, "written": written}


def work_zip(fw):
    d = work_dir(_resolve_fw(fw))
    if not d.is_dir():
        raise ValueError("primero pulsa 'Trabajar' para cargar la plantilla")
    return _zip_dir(d, f"proyecto-{_resolve_fw(fw)}/")


def version_zip(fw, ver):
    """Devuelve el zip de una versión guardada (ej. 'bootstrap-v1.0')."""
    fw = _resolve_fw(fw)
    zpath = VER_DIR / f"{ver}.zip"
    if not zpath.is_file() or not zpath.name.startswith(f"{fw}-v"):
        raise ValueError("versión no encontrada: " + ver)
    return io.BytesIO(zpath.read_bytes())


def restore_version(fw, ver):
    """Descomprime una versión en la copia de trabajo para seguir editándola."""
    fw = _resolve_fw(fw)
    buf = version_zip(fw, ver)
    d = work_dir(fw)
    if d.exists():
        shutil.rmtree(d)
    d.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(buf) as z:
        z.extractall(d)
    # El zip trae prefijo proyecto-<fw>/: aplanar un nivel si existe.
    inner = d / f"proyecto-{fw}"
    if inner.is_dir():
        for p in inner.rglob("*"):
            if p.is_file():
                t = d / p.relative_to(inner)
                t.parent.mkdir(parents=True, exist_ok=True)
                p.rename(t)
        shutil.rmtree(inner)
    return {"ok": True, "path": f"templates/{fw}", "version": ver}
