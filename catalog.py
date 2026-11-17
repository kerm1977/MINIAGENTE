# Catálogo de modelos gratuitos de Ollama, orientados a código y equipos modestos.
# size_gb = descarga aproximada; ram_gb = RAM mínima recomendada.
# url = página oficial en el registro de Ollama (ruta de descarga).
import json
import os
import re
import time
import urllib.request

CACHE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "catalog_cache.json")
LIBRARY_URL = "https://ollama.com/library"
DAY_SECONDS = 86400

CATALOG = [
    {"name": "qwen2.5-coder:0.5b", "size_gb": 0.4, "ram_gb": 1, "tag": "minimo",
     "url": "https://ollama.com/library/qwen2.5-coder:0.5b",
     "desc": "Coder diminuto para equipos muy limitados"},
    {"name": "smollm2:135m", "size_gb": 0.1, "ram_gb": 0.5, "tag": "minimo",
     "url": "https://ollama.com/library/smollm2:135m",
     "desc": "El más pequeño; pruebas y CPU muy viejas"},
    {"name": "smollm2:360m", "size_gb": 0.2, "ram_gb": 0.5, "tag": "minimo",
     "url": "https://ollama.com/library/smollm2:360m",
     "desc": "Tiny generalista, respuestas rápidas"},
    {"name": "smollm2:1.7b", "size_gb": 1.0, "ram_gb": 2, "tag": "pequeno",
     "url": "https://ollama.com/library/smollm2:1.7b",
     "desc": "Pequeño generalista usable"},
    {"name": "tinyllama:1.1b", "size_gb": 0.6, "ram_gb": 1.5, "tag": "pequeno",
     "url": "https://ollama.com/library/tinyllama:1.1b",
     "desc": "Chat ligero clásico"},
    {"name": "llama3.2:1b", "size_gb": 0.8, "ram_gb": 2, "tag": "pequeno",
     "url": "https://ollama.com/library/llama3.2:1b",
     "desc": "Meta 1B, buen equilibrio"},
    {"name": "llama3.2:3b", "size_gb": 2.0, "ram_gb": 4, "tag": "medio",
     "url": "https://ollama.com/library/llama3.2:3b",
     "desc": "Meta 3B, calidad notable"},
    {"name": "qwen2.5-coder:1.5b", "size_gb": 1.0, "ram_gb": 2, "tag": "codigo",
     "url": "https://ollama.com/library/qwen2.5-coder:1.5b",
     "desc": "Coder pequeño recomendado para empezar"},
    {"name": "qwen2.5-coder:3b", "size_gb": 1.9, "ram_gb": 4, "tag": "codigo",
     "url": "https://ollama.com/library/qwen2.5-coder:3b",
     "desc": "Coder 3B, buena calidad/precio"},
    {"name": "qwen2.5-coder:7b", "size_gb": 4.7, "ram_gb": 8, "tag": "codigo",
     "url": "https://ollama.com/library/qwen2.5-coder:7b",
     "desc": "Coder 7B, el mejor gratuito pequeño"},
    {"name": "deepseek-coder:1.3b", "size_gb": 0.8, "ram_gb": 2, "tag": "codigo",
     "url": "https://ollama.com/library/deepseek-coder:1.3b",
     "desc": "DeepSeek coder diminuto"},
    {"name": "deepseek-coder:6.7b", "size_gb": 3.8, "ram_gb": 8, "tag": "codigo",
     "url": "https://ollama.com/library/deepseek-coder:6.7b",
     "desc": "DeepSeek coder completo"},
    {"name": "starcoder2:3b", "size_gb": 1.7, "ram_gb": 4, "tag": "codigo",
     "url": "https://ollama.com/library/starcoder2:3b",
     "desc": "StarCoder2 3B, autocompletado"},
    {"name": "starcoder2:7b", "size_gb": 4.1, "ram_gb": 8, "tag": "codigo",
     "url": "https://ollama.com/library/starcoder2:7b",
     "desc": "StarCoder2 7B"},
    {"name": "codegemma:2b", "size_gb": 1.6, "ram_gb": 4, "tag": "codigo",
     "url": "https://ollama.com/library/codegemma:2b",
     "desc": "Gemma orientado a código"},
    {"name": "gemma2:2b", "size_gb": 1.6, "ram_gb": 4, "tag": "medio",
     "url": "https://ollama.com/library/gemma2:2b",
     "desc": "Gemma2 2B generalista"},
    {"name": "phi3:mini", "size_gb": 2.3, "ram_gb": 4, "tag": "medio",
     "url": "https://ollama.com/library/phi3:mini",
     "desc": "Phi-3 mini 3.8B, razona bien"},
    {"name": "codellama:7b-code", "size_gb": 3.8, "ram_gb": 8, "tag": "codigo",
     "url": "https://ollama.com/library/codellama:7b-code",
     "desc": "Code Llama variante code"},
]


def _fetch_library():
    req = urllib.request.Request(LIBRARY_URL, headers={"User-Agent": "Mozilla/5.0"})
    html = urllib.request.urlopen(req, timeout=12).read().decode("utf-8", "ignore")
    return set(re.findall(r'href="/library/([\w.-]+)"', html))


def refresh(force=False):
    """Relee la librería oficial de Ollama; automática cada 24 h."""
    cache = {"ts": 0, "extra": []}
    try:
        cache.update(json.load(open(CACHE_FILE, encoding="utf-8")))
    except Exception:
        pass
    if not force and time.time() - cache.get("ts", 0) <= DAY_SECONDS:
        return cache
    names = _fetch_library()
    known = {e["name"].split(":")[0] for e in CATALOG}
    known |= {e["name"].split(":")[0] for e in cache.get("extra", [])}
    cache["extra"] += [
        {"name": n, "size_gb": None, "ram_gb": None, "tag": "nuevo",
         "url": f"https://ollama.com/library/{n}",
         "desc": "Descubierto en la librería oficial de Ollama"}
        for n in sorted(names) if n not in known
    ]
    cache["ts"] = time.time()
    json.dump(cache, open(CACHE_FILE, "w", encoding="utf-8"), ensure_ascii=False)
    return cache


def catalog_entries(force=False):
    try:
        cache = refresh(force)
    except Exception:
        cache = {"extra": []}
    return CATALOG + cache.get("extra", [])
