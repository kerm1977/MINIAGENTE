import json

import requests

from config import OLLAMA_HOST


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
