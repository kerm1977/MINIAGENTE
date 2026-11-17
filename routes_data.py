import os
import re
import shutil
import subprocess
import time

from flask import Blueprint, jsonify, request, send_file

import db
import file_ops
import iconos
import precreados
import scaffold

bp = Blueprint("data", __name__)


def err(e, code=400):
    return jsonify({"error": str(e)}), code


@bp.get("/api/files")
def api_files():
    path = request.args.get("path", ".")
    root = bool(request.args.get("root"))
    res = file_ops.run_tool({"tool": "list_files", "path": path}, root)
    return jsonify(res)


@bp.get("/api/filetree")
def api_filetree():
    """Lista plana de rutas relativas de archivos bajo una carpeta del workspace."""
    path = request.args.get("path", "")
    try:
        root = file_ops._resolve(path, False)
    except PermissionError as e:
        return err(e, 403)
    if not os.path.isdir(root):
        return err("No es carpeta", 404)
    out = []
    for dp, dns, fns in os.walk(root):
        dns.sort()
        for fn in sorted(fns):
            rel = os.path.relpath(os.path.join(dp, fn), root).replace("\\", "/")
            out.append(rel)
        if len(out) >= 800:
            break
    return jsonify({"files": out})


@bp.get("/api/file")
def api_file_read():
    path = request.args.get("path", "")
    try:
        target = file_ops._resolve(path, False)
        with open(target, "rb") as f:
            data = f.read(file_ops.MAX_READ_BYTES)
        return jsonify({"ok": True, "path": path,
                        "content": data.decode("utf-8", "replace")})
    except PermissionError as e:
        return err(e, 403)
    except Exception as e:
        return err(e, 404)


@bp.post("/api/file")
def api_file_write():
    data = request.get_json(force=True) or {}
    path = data.get("path", "")
    content = file_ops.with_header(path, data.get("content", ""))
    try:
        target = file_ops._resolve(path, False)
        if len(content.encode()) > file_ops.MAX_WRITE_BYTES:
            return err("Archivo demasiado grande")
        os.makedirs(os.path.dirname(target), exist_ok=True)
        # backup de la versión anterior para el botón "volver"
        if os.path.isfile(target):
            bak = target + ".bak"
            try:
                import shutil
                shutil.copy2(target, bak)
            except OSError:
                pass
        with open(target, "w", encoding="utf-8") as f:
            f.write(content)
        return jsonify({"ok": True, "bytes": len(content.encode())})
    except PermissionError as e:
        return err(e, 403)


@bp.post("/api/file/revert")
def api_file_revert():
    """Restaura el .bak de un archivo (versión anterior)."""
    data = request.get_json(force=True) or {}
    path = data.get("path", "")
    try:
        target = file_ops._resolve(path, False)
        bak = target + ".bak"
        if not os.path.isfile(bak):
            return err("No hay versión anterior", 404)
        import shutil
        shutil.copy2(bak, target)
        os.remove(bak)
        return jsonify({"ok": True})
    except PermissionError as e:
        return err(e, 403)


@bp.get("/api/projects")
def api_projects():
    return jsonify({"projects": scaffold.list_projects()})


@bp.post("/api/projects")
def api_new_project():
    name = (request.get_json(force=True) or {}).get("name", "").strip()
    try:
        return jsonify(scaffold.create_project(name))
    except Exception as e:
        return err(e)


@bp.get("/api/sessions")
def api_sessions():
    return jsonify({"sessions": db.list_sessions()})


@bp.post("/api/sessions")
def api_new_session():
    data = request.get_json(force=True) or {}
    title = data.get("title", "").strip() or "Sin título"
    sid = db.new_session(title, data.get("model", ""))
    return jsonify({"id": sid})


@bp.get("/api/sessions/<int:sid>")
def api_get_session(sid):
    return jsonify({"messages": db.get_messages(sid)})


@bp.post("/api/sessions/<int:sid>/messages")
def api_save_msgs(sid):
    msgs = (request.get_json(force=True) or {}).get("messages", [])
    n = 0
    for m in msgs:
        if m.get("role") and m.get("content"):
            db.add_message(sid, m["role"], m["content"])
            n += 1
    return jsonify({"saved": n})


@bp.delete("/api/sessions/<int:sid>")
def api_del_session(sid):
    db.delete_session(sid)
    return jsonify({"deleted": sid})


@bp.get("/api/snippets")
def api_snippets():
    return jsonify({"snippets": db.list_snippets()})


@bp.get("/api/snippets/<int:sid>")
def api_snippet(sid):
    row = db.get_snippet(sid)
    return jsonify(row) if row else err("No existe", 404)


@bp.post("/api/snippets")
def api_save_snippet():
    data = request.get_json(force=True) or {}
    content = data.get("content", "")
    if not content.strip():
        return err("Sin contenido")
    sid = db.save_snippet(
        data.get("session_id"), data.get("lang", ""),
        data.get("title", ""), content,
    )
    return jsonify({"id": sid})


@bp.get("/api/emojis")
def api_emojis():
    return jsonify({"packs": iconos.list_packs()})


@bp.get("/api/emojis/<pack_id>")
def api_emoji_pack(pack_id):
    return jsonify(iconos.get_pack(pack_id))


@bp.get("/api/precreados")
def api_precreados():
    return jsonify({"frameworks": precreados.frameworks()})


@bp.get("/api/precreados/<fw>.zip")
def api_precreado_zip(fw):
    try:
        buf = precreados.build_zip(fw)
    except ValueError as e:
        return err(e, 404)
    return send_file(buf, mimetype="application/zip", as_attachment=True,
                     download_name=f"proyecto-{fw}.zip")


@bp.get("/api/precreados/<fw>/guardar")
def api_precreado_guardar(fw):
    try:
        return jsonify(precreados.extract_to_downloads(fw))
    except ValueError as e:
        return err(e, 404)
    except Exception as e:
        return err(e, 500)


@bp.post("/api/templates/<fw>/trabajar")
def api_tpl_trabajar(fw):
    try:
        return jsonify(precreados.load_work(fw))
    except ValueError as e:
        return err(e, 404)


@bp.post("/api/templates/<fw>/version")
def api_tpl_version(fw):
    try:
        return jsonify(precreados.save_version(fw))
    except ValueError as e:
        return err(e)


@bp.post("/api/templates/<fw>/sobrescribir")
def api_tpl_overwrite(fw):
    try:
        return jsonify(precreados.overwrite_source(fw))
    except ValueError as e:
        return err(e)


@bp.get("/api/templates/<fw>/versiones")
def api_tpl_versiones(fw):
    try:
        return jsonify({"versiones": precreados.list_versions(fw)})
    except ValueError as e:
        return err(e, 404)


@bp.post("/api/templates/<fw>/version/<ver>/trabajar")
def api_tpl_ver_trabajar(fw, ver):
    try:
        return jsonify(precreados.restore_version(fw, ver))
    except ValueError as e:
        return err(e, 404)


@bp.get("/api/templates/<fw>/version/<ver>.zip")
def api_tpl_ver_zip(fw, ver):
    try:
        buf = precreados.version_zip(fw, ver)
        return send_file(buf, mimetype="application/zip",
                         as_attachment=True, download_name=f"{ver}.zip")
    except ValueError as e:
        return err(e, 404)


@bp.get("/api/templates/<fw>/trabajo.zip")
def api_tpl_zip(fw):
    try:
        buf = precreados.work_zip(fw)
        return send_file(buf, mimetype="application/zip",
                         as_attachment=True, download_name=f"proyecto-{fw}.zip")
    except ValueError as e:
        return err(e, 404)


@bp.post("/api/templates/<fw>/github")
def api_tpl_github(fw):
    """Crea un repo en GitHub con las credenciales dadas y sube la copia de trabajo."""
    data = request.get_json(force=True) or {}
    user = (data.get("user") or "").strip()
    token = (data.get("token") or "").strip()
    repo = (data.get("repo") or f"proyecto-{fw}").strip()
    if not user or not token:
        return err("Faltan usuario y token de GitHub")
    if not re.match(r"^[\w.-]+$", repo):
        return err("Nombre de repo no válido")
    try:
        src = precreados.work_dir(fw)
    except ValueError as e:
        return err(e, 404)
    if not src.is_dir():
        return err("primero pulsa 'Trabajar' para cargar la plantilla")
    try:
        import requests
        r = requests.post("https://api.github.com/user/repos",
                          json={"name": repo, "private": True},
                          headers={"Authorization": f"Bearer {token}",
                                   "Accept": "application/vnd.github+json"},
                          timeout=15)
        if r.status_code not in (201, 422):  # 422 = ya existe
            return err("GitHub: " + r.json().get("message", r.status_code), 502)
    except Exception as e:
        return err(e, 502)
    remote = f"https://{user}:{token}@github.com/{user}/{repo}.git"
    def _git(*args):
        return subprocess.run(["git", *args], cwd=src, capture_output=True,
                              text=True, timeout=120)
    if not (src / ".git").exists():
        _git("init")
        _git("checkout", "-b", "main")
    _git("add", "-A")
    _git("-c", "user.email=agente@local", "-c", "user.name=Agente",
         "commit", "-m", "Guardado desde mini-agent")
    _git("remote", "remove", "origin")
    p = _git("remote", "add", "origin", remote)
    if p.returncode != 0 and "exists" not in p.stderr:
        return err(p.stderr[-200:], 502)
    p = _git("push", "-u", "origin", "main", "--force")
    if p.returncode != 0:
        return err("push falló: " + p.stderr[-200:], 502)
    return jsonify({"ok": True, "url": f"https://github.com/{user}/{repo}"})


@bp.post("/api/upload")
def api_upload():
    files = request.files.getlist("files")
    if not files:
        return err("Sin archivos")
    stamp = time.strftime("%Y%m%d-%H%M%S")
    saved, skipped = [], 0
    for f in files:
        rel = (getattr(f, "webkitRelativePath", "") or f.filename or "").replace("\\", "/")
        parts = [p for p in rel.split("/") if p and p not in (".", "..")]
        if not parts or not f.filename:
            skipped += 1
            continue
        target_rel = os.path.join("uploads", stamp, *parts)
        try:
            target = file_ops._resolve(target_rel, False)
        except PermissionError:
            skipped += 1
            continue
        os.makedirs(os.path.dirname(target), exist_ok=True)
        f.save(target)
        saved.append(target_rel.replace("\\", "/"))
    return jsonify({"ok": True, "count": len(saved), "skipped": skipped, "saved": saved})


@bp.post("/api/repo/clone")
def api_repo_clone():
    url = (request.get_json(force=True) or {}).get("url", "").strip()
    if not re.match(r"^https://github\.com/[\w.-]+/[\w.-]+(\.git)?/?$", url):
        return err("URL no válida — usa https://github.com/usuario/repo")
    name = url.rstrip("/").removesuffix(".git").split("/")[-1]
    dest_rel = os.path.join("repos", name)
    dest = file_ops._resolve(dest_rel, False)
    if os.path.exists(dest):
        return err("Ya existe " + dest_rel.replace("\\", "/"))
    try:
        subprocess.run(
            ["git", "clone", "--depth", "1", url, dest],
            capture_output=True, text=True, timeout=180, check=True,
        )
    except FileNotFoundError:
        return err("git no está instalado en este equipo", 501)
    except subprocess.TimeoutExpired:
        _rmtree(dest)
        return err("La clonación tardó demasiado", 504)
    except subprocess.CalledProcessError as e:
        return err((e.stderr or e.stdout or "Error al clonar").strip()[-300:], 502)
    return jsonify({"ok": True, "path": dest_rel.replace("\\", "/")})


RUNNING_PROCS = {}


def _free_port(start=51173):
    import socket
    for p in range(start, start + 200):
        with socket.socket() as s:
            try:
                s.bind(("127.0.0.1", p))
            except OSError:
                continue
            return p
    return 8000


def _entry_py(dest):
    for cand in ("app.py", "main.py", "run.py", "server.py", "manage.py"):
        p = os.path.join(dest, cand)
        if os.path.isfile(p):
            return p
    return None


@bp.post("/api/repo/run")
def api_repo_run():
    path = (request.get_json(force=True) or {}).get("path", "").strip()
    if not re.match(r"^repos/[\w.-]+$", path):
        return err("Ruta no válida — usa repos/<nombre>")
    dest = file_ops._resolve(path, False)
    if not os.path.isdir(dest):
        return err("No existe " + path)
    if path in RUNNING_PROCS and RUNNING_PROCS[path].poll() is None:
        return jsonify({"ok": True, "url": RUNNING_PROCS[path + ":url"], "already": True})
    steps = []
    venv = os.path.join(dest, ".venv")
    req = os.path.join(dest, "requirements.txt")
    pkg = os.path.join(dest, "package.json")
    py = None
    if os.path.isdir(venv):
        py = os.path.join(venv, "Scripts", "python.exe") if os.name == "nt" else os.path.join(venv, "bin", "python")
    else:
        py = shutil.which("python") or shutil.which("python3")
    try:
        if os.path.isfile(req):
            if not os.path.isdir(venv):
                subprocess.run([py, "-m", "venv", venv],
                               capture_output=True, text=True, timeout=120, check=True, cwd=dest)
                py = os.path.join(venv, "Scripts", "python.exe") if os.name == "nt" else os.path.join(venv, "bin", "python")
                steps.append("venv creado")
            r = subprocess.run([py, "-m", "pip", "install", "-r", "requirements.txt"],
                               capture_output=True, text=True, timeout=600, cwd=dest)
            if r.returncode != 0:
                return err("pip install falló: " + (r.stderr or "")[-300:], 502)
            steps.append("dependencias instaladas")
        entry = _entry_py(dest)
        port = _free_port()
        if entry:
            env = dict(os.environ, PORT=str(port))
            proc = subprocess.Popen([py, os.path.basename(entry)], cwd=dest, env=env)
            RUNNING_PROCS[path] = proc
            RUNNING_PROCS[path + ":url"] = f"http://localhost:{port}"
            steps.append(f"ejecutando {os.path.basename(entry)} en :{port}")
            return jsonify({"ok": True, "url": f"http://localhost:{port}", "steps": steps})
        if os.path.isfile(pkg):
            subprocess.run(["npm", "install"], capture_output=True, text=True,
                           timeout=600, cwd=dest, shell=(os.name == "nt"))
            proc = subprocess.Popen(["npm", "start"], cwd=dest,
                                    shell=(os.name == "nt"))
            RUNNING_PROCS[path] = proc
            RUNNING_PROCS[path + ":url"] = f"http://localhost:{port}"
            steps.append("npm install + npm start")
            return jsonify({"ok": True, "url": f"http://localhost:{port}", "steps": steps})
        return err("No encontré app.py/main.py ni package.json para ejecutar", 501)
    except subprocess.TimeoutExpired:
        return err("La instalación tardó demasiado", 504)
    except FileNotFoundError as e:
        return err(f"Falta herramienta en el equipo: {e}", 501)


@bp.post("/api/repo/stop")
def api_repo_stop():
    path = (request.get_json(force=True) or {}).get("path", "").strip()
    proc = RUNNING_PROCS.get(path)
    if proc and proc.poll() is None:
        proc.kill()
        return jsonify({"ok": True})
    return err("No está ejecutándose")


SAVED_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "saved_workspaces")


def _safe_name(name):
    return re.sub(r"[^\w.-]", "-", name or "").strip("-") or ""


def _rm_ro(func, path, exc):
    os.chmod(path, 0o777)
    func(path)


def _rmtree(path):
    shutil.rmtree(path, onexc=_rm_ro)


@bp.get("/api/workspace/saved")
def api_saved_list():
    os.makedirs(SAVED_DIR, exist_ok=True)
    items = sorted(
        n for n in os.listdir(SAVED_DIR)
        if os.path.isdir(os.path.join(SAVED_DIR, n))
    )
    return jsonify({"saved": items})


@bp.post("/api/workspace/save")
def api_ws_save():
    name = _safe_name((request.get_json(force=True) or {}).get("name"))
    if not name:
        return err("Falta nombre")
    dest = os.path.join(SAVED_DIR, name)
    if os.path.exists(dest):
        _rmtree(dest)
    shutil.copytree(file_ops.WORKSPACE_DIR, dest)
    return jsonify({"ok": True, "name": name})


@bp.post("/api/workspace/restore")
def api_ws_restore():
    name = _safe_name((request.get_json(force=True) or {}).get("name"))
    src = os.path.join(SAVED_DIR, name)
    if not name or not os.path.isdir(src):
        return err("No existe esa copia", 404)
    dest = file_ops.WORKSPACE_DIR
    _rmtree(dest)
    shutil.copytree(src, dest)
    return jsonify({"ok": True, "name": name})


@bp.get("/api/hwinfo")
def api_hwinfo():
    import platform, shutil
    info = {
        "cpu": platform.processor() or platform.machine(),
        "cores": os.cpu_count() or 2,
        "ram_gb": None,
        "gpu": None,
        "os": platform.system(),
    }
    try:
        import psutil
        info["ram_gb"] = round(psutil.virtual_memory().total / 1e9, 1)
    except Exception:
        try:
            out = subprocess.run(
                ["powershell", "-NoProfile", "-Command",
                 "(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory"],
                capture_output=True, text=True, timeout=10,
            ).stdout.strip()
            if out.isdigit():
                info["ram_gb"] = round(int(out) / 1e9, 1)
        except Exception:
            pass
    try:
        if shutil.which("nvidia-smi"):
            out = subprocess.run(
                ["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
                capture_output=True, text=True, timeout=10,
            ).stdout.strip()
            if out:
                info["gpu"] = out.splitlines()[0]
    except Exception:
        pass
    rec = {
        "threads": max(2, min(16, info["cores"] - 2)),
        "mem": "4096" if (info["ram_gb"] or 8) >= 12 else "2048",
        "device": "auto" if info["gpu"] else "cpu",
        "preset": "rapido" if not info["gpu"] else "moderado",
    }
    return jsonify({"info": info, "recomendado": rec})


@bp.get("/api/prefs")
def api_get_prefs():
    return jsonify(db.get_prefs())


@bp.post("/api/prefs")
def api_set_pref():
    d = request.get_json(force=True) or {}
    db.set_pref(d.get("key", ""), d.get("value", ""))
    _write_state()
    return jsonify({"ok": True})


def _write_state():
    """Persiste el estado completo en workspace/state.json (modelos, prefs, proyecto)."""
    try:
        import ollama_client
        state = {
            "prefs": db.get_prefs(),
            "modelos_instalados": [m.get("name") for m in ollama_client.list_models()],
            "ultimo_proyecto": db.get_prefs().get("ed_dir"),
            "ultimo_archivo": db.get_prefs().get("ed_file"),
        }
        import json as _j
        p = os.path.join(file_ops.WORKSPACE_DIR, "state.json")
        with open(p, "w", encoding="utf-8") as f:
            _j.dump(state, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


@bp.post("/api/voz")
def api_voz():
    import voz

    f = request.files.get("audio")
    if not f:
        return err("Falta audio")
    try:
        return jsonify({"text": voz.transcribe(f)})
    except Exception as e:
        return err(e, 502)
