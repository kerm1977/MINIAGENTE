import json
import os
import re
import shutil

import db

WORKSPACE_DIR = os.environ.get(
    "WORKSPACE_DIR", os.path.join(os.path.dirname(__file__), "workspace")
)
MAX_WRITE_BYTES = 5 * 1024 * 1024
MAX_READ_BYTES = 200 * 1024
TOOL_BLOCK_RE = re.compile(r"```tool\s*\n(.*?)```", re.DOTALL)


_EXT_COMMENT = {
    ".py": "#", ".sh": "#", ".bat": "REM ", ".yml": "#", ".yaml": "#",
    ".toml": "#", ".rb": "#", ".txt": "#", ".cfg": "#", ".ini": "#",
    ".js": "//", ".jsx": "//", ".ts": "//", ".tsx": "//", ".css": "/* */",
    ".java": "//", ".cs": "//", ".c": "//", ".cpp": "//", ".php": "//",
    ".sql": "--", ".html": "<!-- -->", ".xml": "<!-- -->", ".md": "<!-- -->",
}


def with_header(path, content):
    """Antepone el nombre del archivo como comentario si no está ya."""
    ext = os.path.splitext(path)[1].lower()
    mark = _EXT_COMMENT.get(ext)
    if not mark or "archivo:" in content.split("\n", 1)[0]:
        return content
    name = os.path.basename(path)
    if mark == "/* */":
        return f"/* archivo: {name} */\n" + content
    if mark == "<!-- -->":
        return f"<!-- archivo: {name} -->\n" + content
    if mark == "REM ":
        return f"REM archivo: {name}\n" + content
    return f"{mark} archivo: {name}\n" + content


def _resolve(path, root_mode):
    if root_mode and re.match(r"^[a-zA-Z]:[\\/]|^\\\\", path):
        return os.path.abspath(path)
    base = "/" if root_mode else os.path.abspath(WORKSPACE_DIR)
    target = os.path.abspath(os.path.join(base, path.lstrip("/")))
    if not root_mode and not (target == base or target.startswith(base + os.sep)):
        raise PermissionError(f"Fuera del workspace: {path}")
    return target


def _tree(root, prefix="", depth=0, limit=400):
    if depth > 6:
        return []
    out = []
    try:
        entries = sorted(os.listdir(root))
    except OSError:
        return out
    for name in entries[:limit]:
        if name.startswith(".git"):
            continue
        full = os.path.join(root, name)
        out.append(prefix + name + ("/" if os.path.isdir(full) else ""))
        if os.path.isdir(full):
            out.extend(_tree(full, prefix + "  ", depth + 1, limit))
    return out


def run_tool(call, root_mode=False):
    tool = call.get("tool", "")
    try:
        if tool == "list_files":
            path = call.get("path", ".")
            target = _resolve(path, root_mode)
            return {"ok": True, "tree": _tree(target)}
        if tool == "read_file":
            target = _resolve(call["path"], root_mode)
            with open(target, "rb") as f:
                data = f.read(MAX_READ_BYTES)
            return {"ok": True, "path": call["path"], "content": data.decode("utf-8", "replace")}
        if tool == "write_file":
            target = _resolve(call["path"], root_mode)
            content = with_header(call["path"], call.get("content", ""))
            if len(content.encode()) > MAX_WRITE_BYTES:
                return {"ok": False, "error": "Archivo demasiado grande"}
            os.makedirs(os.path.dirname(target), exist_ok=True)
            with open(target, "w", encoding="utf-8") as f:
                f.write(content)
            return {"ok": True, "path": call["path"], "bytes": len(content.encode())}
        if tool == "mkdir":
            target = _resolve(call["path"], root_mode)
            os.makedirs(target, exist_ok=True)
            return {"ok": True, "path": call["path"]}
        if tool == "delete":
            target = _resolve(call["path"], root_mode)
            if os.path.isdir(target):
                shutil.rmtree(target)
            elif os.path.exists(target):
                os.remove(target)
            else:
                return {"ok": False, "error": "No existe"}
            return {"ok": True, "path": call["path"]}
        if tool == "run":
            if not root_mode:
                return {"ok": False, "error": "run requiere modo root autorizado"}
            import subprocess

            proc = subprocess.run(
                call["command"], shell=True, capture_output=True,
                text=True, timeout=call.get("timeout", 60), cwd=WORKSPACE_DIR,
            )
            return {"ok": proc.returncode == 0, "stdout": proc.stdout[-4000:], "stderr": proc.stderr[-4000:]}
        if tool == "export":
            import exporters

            path = exporters.export(
                call.get("format", "pdf"),
                call.get("content", ""),
                call.get("title", "export"),
            )
            return {"ok": True, "path": path}
        if tool == "download_video":
            import downloader

            info = downloader.download_video(
                call["url"], audio_only=bool(call.get("audio_only"))
            )
            return {"ok": True, **info}
        if tool == "video_info":
            import downloader

            return {"ok": True, **downloader.video_info(call["url"])}
        if tool == "save_template":
            db.save_template(
                call["name"], call.get("description", ""), call.get("content", "")
            )
            return {"ok": True, "name": call["name"]}
        if tool == "load_template":
            row = db.get_template(call["name"])
            if not row:
                return {"ok": False, "error": "Plantilla no existe"}
            return {"ok": True, "name": row["name"], "content": row["content"]}
        if tool == "list_templates":
            return {"ok": True, "templates": db.list_templates()}
        if tool == "new_project":
            import scaffold

            return {"ok": True, **scaffold.create_project(call["name"])}
        return {"ok": False, "error": f"Herramienta desconocida: {tool}"}
    except PermissionError as e:
        return {"ok": False, "error": str(e)}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}


def extract_tool_calls(text):
    calls = []
    for block in TOOL_BLOCK_RE.findall(text):
        for line in block.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                calls.append(json.loads(line))
            except ValueError:
                continue
    return calls


def strip_tool_blocks(text):
    return TOOL_BLOCK_RE.sub("", text).strip()


TOOLS_DOC = (
    "Puedes actuar sobre archivos emitiendo bloques ```tool con un JSON por línea. "
    "Herramientas: "
    'list_files {"tool":"list_files","path":"."} ; '
    'read_file {"tool":"read_file","path":"a.py"} ; '
    'write_file {"tool":"write_file","path":"a.py","content":"..."} (crea carpetas solas) ; '
    'mkdir {"tool":"mkdir","path":"src/"} ; '
    'delete {"tool":"delete","path":"a.py"} ; '
    'run {"tool":"run","command":"ls"} (solo con acceso root) ; '
    'export {"tool":"export","format":"pdf|png|jpg|docx|xlsx|pptx|json","title":"t","content":"..."} '
    "(guarda en workspace/exports) ; "
    'download_video {"tool":"download_video","url":"...","audio_only":false} (yt-dlp, '
    "guarda en workspace/downloads) ; "
    'video_info {"tool":"video_info","url":"..."} ; '
    'save_template {"tool":"save_template","name":"...","description":"...","content":"..."} ; '
    'load_template {"tool":"load_template","name":"..."} ; '
    'list_templates {"tool":"list_templates"} (plantillas reutilizables en SQLite) ; '
    'new_project {"tool":"new_project","name":"mi-app"} (crea proyecto Flask '
    "completo en workspace/projects/<name> con la mega plantilla: venv, reglas, "
    "módulos y start.bat). "
    "Las rutas son relativas al workspace salvo modo root, donde acepta rutas absolutas de Windows directamente (ej. C:/Users/MINIOS/mi-proyecto). Tras emitir herramientas, "
    "espera los resultados antes de continuar."
)
