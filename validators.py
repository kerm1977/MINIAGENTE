"""Validaciones estandar del proyecto (ver REGLAS.md).

Uso:
    from validators import validate, RuleError
    validate("telefono", telefono)  # lanza RuleError o devuelve valor limpio
"""
import re

PHONE_RE = re.compile(r"^\+?[0-9]{7,15}$")
EMAIL_RE = re.compile(r"^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$")
NAME_PART_RE = re.compile(r"^[A-ZÁÉÍÓÚÑ][a-záéíóúñ'’.-]+$")


class RuleError(ValueError):
    pass


def telefono(value):
    digits = re.sub(r"[\s()-]", "", str(value or ""))
    if not PHONE_RE.match(digits):
        raise RuleError("Teléfono inválido: solo dígitos (7-15), '+' opcional")
    return digits


def email(value):
    if any(c.isupper() for c in str(value or "")):
        raise RuleError("El correo no puede contener mayúsculas")
    cleaned = str(value or "").strip().lower()
    if not EMAIL_RE.match(cleaned):
        raise RuleError("Correo inválido")
    return cleaned


def nombre(value):
    parts = str(value or "").strip().split()
    if not parts:
        raise RuleError("Nombre vacío")
    for part in parts:
        if not NAME_PART_RE.match(part):
            raise RuleError(f"Cada nombre/apellido debe ser Title Case: '{part}'")
    return " ".join(parts)


def no_vacio(value, campo="campo"):
    if not str(value or "").strip():
        raise RuleError(f"{campo} no puede estar vacío")
    return str(value).strip()


def entero(value, campo="campo", minimo=None, maximo=None):
    try:
        n = int(value)
    except (TypeError, ValueError):
        raise RuleError(f"{campo} debe ser numérico")
    if minimo is not None and n < minimo:
        raise RuleError(f"{campo} debe ser >= {minimo}")
    if maximo is not None and n > maximo:
        raise RuleError(f"{campo} debe ser <= {maximo}")
    return n


RULES = {
    "telefono": telefono,
    "email": email,
    "nombre": nombre,
    "no_vacio": no_vacio,
    "entero": entero,
}


def validate(rule, value, **kwargs):
    fn = RULES.get(rule)
    if not fn:
        raise RuleError(f"Regla desconocida: {rule}")
    return fn(value, **kwargs)
