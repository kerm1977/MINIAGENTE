"""Motores de IA alternativos a Ollama.

Todos se normalizan al stream NDJSON de Ollama que el frontend ya consume:
{"model":..., "message":{"role":"assistant","content":...}, "done":false}
y una línea final {"done":true}.

Motores:
  - ollama:   nativo (delega en ollama_client)
  - lmstudio: servidor local de LM Studio (OpenAI-compatible, :1234)
  - llamacpp: llama-server de llama.cpp (OpenAI-compatible, :8080)
  - openai:   cualquier API compatible OpenAI (OpenAI, Groq, OpenRouter...)

La API compatible se configura con OPENAI_BASE_URL y OPENAI_API_KEY.
"""
import json
import os

import requests

import ollama_client

BACKENDS = {
    "ollama": {
        "label": "Ollama",
        "kind": "ollama",
    },
    "lmstudio": {
        "label": "LM Studio",
        "kind": "openai",
        "base": "http://localhost:1234/v1",
        "env_key": "LMSTUDIO_API_KEY",
    },
    "llamacpp": {
        "label": "llama.cpp server",
        "kind": "openai",
        "base": "http://localhost:8080/v1",
        "env_key": "LLAMACPP_API_KEY",
    },
    "openai": {
        "label": "API compatible OpenAI",
        "kind": "openai",
        "base": os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1"),
        "env_key": "OPENAI_API_KEY",
    },
}


def _cfg(backend):
    cfg = BACKENDS.get(backend)
    if not cfg:
        raise ValueError(f"Motor desconocido: {backend}")
    return cfg


def _api_key(cfg):
    return os.environ.get(cfg.get("env_key") or "", "") or None


def _headers(cfg):
    key = _api_key(cfg)
    return {"Authorization": f"Bearer {key}"} if key else {}


def backend_status(backend):
    cfg = _cfg(backend)
    if cfg["kind"] == "ollama":
        st = ollama_client.status()
        return {"ok": st["ok"], "detail": st.get("version") or st.get("error")}
    try:
        r = requests.get(cfg["base"] + "/models", headers=_headers(cfg),
                         timeout=3)
        ok = r.status_code < 400
        return {"ok": ok, "detail": "en línea" if ok else f"HTTP {r.status_code}"}
    except requests.RequestException as e:
        return {"ok": False, "detail": str(e)[:120]}


def list_backends():
    return [
        {"id": k, "label": v["label"], **backend_status(k)}
        for k, v in BACKENDS.items()
    ]


def list_models(backend):
    cfg = _cfg(backend)
    if cfg["kind"] == "ollama":
        return ollama_client.list_models()
    r = requests.get(cfg["base"] + "/models", headers=_headers(cfg), timeout=10)
    if r.status_code >= 400:
        raise RuntimeError(f"{cfg['label']} HTTP {r.status_code}")
    return [
        {"name": m.get("id"), "size": 0, "modified_at": ""}
        for m in r.json().get("data", []) if m.get("id")
    ]


def _openai_options(options):
    out = {}
    for src, dst in (("temperature", "temperature"),
                     ("num_predict", "max_tokens"),
                     ("top_p", "top_p"), ("seed", "seed")):
        if options.get(src) is not None:
            out[dst] = options[src]
    if out.get("max_tokens", 0) == -1:
        out.pop("max_tokens")
    return out


def chat_stream(backend, model, messages, options=None):
    """Yield líneas NDJSON con formato Ollama para cualquier motor."""
    cfg = _cfg(backend)
    if cfg["kind"] == "ollama":
        yield from ollama_client.chat_stream(model, messages, options)
        return
    body = {
        "model": model, "messages": messages, "stream": True,
        **_openai_options(options or {}),
    }
    try:
        resp = requests.post(
            cfg["base"] + "/chat/completions",
            json=body, headers=_headers(cfg), stream=True, timeout=None,
        )
    except requests.RequestException as e:
        yield json.dumps({"error": f"{cfg['label']}: {e}"}).encode() + b"\n"
        return
    if resp.status_code >= 400:
        yield json.dumps({
            "error": f"{cfg['label']} HTTP {resp.status_code}: "
                     f"{resp.text[:200]}"
        }).encode() + b"\n"
        return
    for raw in resp.iter_lines():
        if not raw or not raw.startswith(b"data:"):
            continue
        data = raw[5:].strip()
        if data == b"[DONE]":
            yield json.dumps({"done": True}).encode() + b"\n"
            return
        try:
            chunk = json.loads(data)
        except ValueError:
            continue
        delta = (chunk.get("choices") or [{}])[0].get("delta") or {}
        content = delta.get("content") or ""
        yield json.dumps({
            "model": model,
            "created_at": chunk.get("created", ""),
            "message": {"role": "assistant", "content": content},
            "done": bool((chunk.get("choices") or [{}])[0].get("finish_reason")),
        }).encode() + b"\n"
    yield json.dumps({"done": True}).encode() + b"\n"
