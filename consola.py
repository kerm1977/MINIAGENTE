"""Consola de errores del servidor: ring buffer en memoria.

El frontend reporta sus errores con POST /api/errors; aquí también se
pueden registrar fallos del backend con log_error(). GET devuelve el
historial y DELETE lo vacía.
"""
import threading
import time

_lock = threading.Lock()
_errores = []
MAX_ERR = 300


def log_error(origen, detalle):
    item = {"ts": time.strftime("%H:%M:%S"),
            "origen": str(origen)[:80],
            "detalle": str(detalle)[:2000]}
    with _lock:
        _errores.append(item)
        if len(_errores) > MAX_ERR:
            _errores.pop(0)
    return item


def get_errors():
    with _lock:
        return list(_errores)


def clear():
    with _lock:
        _errores.clear()
