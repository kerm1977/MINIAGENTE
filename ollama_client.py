import json
import os
import shutil
import subprocess
import time

import requests

from config import MODELS_DIR, OLLAMA_EXE, OLLAMA_HOST

_autostart_ts = 0.0


class OllamaError(Exception):
    pass


def _api(path):
    return f"{OLLAMA_HOST}/api{path}"


def _check(resp):
    if resp.status_code >= 400:
        detail = resp.text.strip()[:300]
        raise OllamaError(f"Ollama {resp.status_code}: {detail}")
    return resp


def status():
    try:
        data = _check(requests.get(_api("/version"), timeout=5)).json()
    except requests.RequestException as e:
        return {"ok": False, "error": str(e), "host": OLLAMA_HOST}
    return {"ok": True, "version": data.get("version"), "host": OLLAMA_HOST}


def _ollama_exe():
    if OLLAMA_EXE and os.path.exists(OLLAMA_EXE):
        return OLLAMA_EXE
    return shutil.which("ollama") or shutil.which("ollama.exe")


def ensure_running(timeout=15):
    """Devuelve el status; si Ollama no responde, lanza 'ollama serve'.

    El arranque se intenta como máximo una vez cada 30 segundos para no
    acumular procesos si el puerto sigue sin responder.
    """
    global _autostart_ts
    st = status()
    if st["ok"]:
        st["autostart"] = False
        return st
    exe = _ollama_exe()
    if not exe or time.time() - _autostart_ts < 30:
        st["autostart"] = False
        return st
    _autostart_ts = time.time()
    env = os.environ.copy()
    env.setdefault("OLLAMA_MODELS", MODELS_DIR)
    flags = 0
    if os.name == "nt":
        flags = subprocess.CREATE_NO_WINDOW | subprocess.DETACHED_PROCESS
    try:
        subprocess.Popen(
            [exe, "serve"], env=env,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            creationflags=flags,
        )
    except OSError as e:
        st["autostart"] = False
        st["error"] = str(e)
        return st
    deadline = time.time() + timeout
    while time.time() < deadline:
        time.sleep(0.5)
        st = status()
        if st["ok"]:
            st["autostart"] = True
            return st
    st["autostart"] = "pending"
    return st


def list_models():
    resp = _check(requests.get(_api("/tags"), timeout=10))
    return [
        {
            "name": m.get("name") or m.get("model"),
            "size": m.get("size", 0),
            "modified_at": m.get("modified_at", ""),
        }
        for m in resp.json().get("models", [])
    ]


def pull(name):
    resp = requests.post(
        _api("/pull"),
        json={"name": name, "model": name, "stream": False},
        timeout=None,
    )
    return _check(resp).json()


def pull_stream(name):
    """Pull con stream=True: yield dicts de progreso de Ollama."""
    resp = requests.post(
        _api("/pull"),
        json={"name": name, "model": name, "stream": True},
        stream=True,
        timeout=None,
    )
    _check(resp)
    for line in resp.iter_lines():
        if line:
            data = parse_ndjson_line(line)
            if data:
                yield data


def create(name, modelfile):
    resp = requests.post(
        _api("/create"),
        json={"name": name, "model": name, "modelfile": modelfile, "stream": False},
        timeout=None,
    )
    return _check(resp).json()


def delete(name):
    resp = requests.delete(
        _api("/delete"), json={"name": name, "model": name}, timeout=30
    )
    _check(resp)
    return {"deleted": name}


def chat_stream(model, messages, options=None):
    body = {"model": model, "messages": messages, "stream": True,
            "keep_alive": "30m"}
    if options:
        body["options"] = options
    resp = requests.post(
        _api("/chat"),
        json=body,
        stream=True,
        timeout=None,
    )
    _check(resp)
    for line in resp.iter_lines():
        if line:
            yield line


def default_modelfile(source, system_prompt):
    lines = [f"FROM {source}"]
    if system_prompt:
        escaped = system_prompt.replace('"""', '\\"\\"\\"')
        lines.append(f'SYSTEM """{escaped}"""')
    lines.append("PARAMETER temperature 0.2")
    return "\n".join(lines) + "\n"


def parse_ndjson_line(raw):
    try:
        return json.loads(raw.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return None
