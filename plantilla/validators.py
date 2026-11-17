"""Validaciones estandarizadas (ver REGLAS.md).

Cada regla devuelve el valor limpio o lanza RuleError.
Las reglas se registran en RULES para uso genérico con validate().
"""
import re

PHONE_RE = re.compile(r"^\+?[0-9]{7,15}$")
EMAIL_RE = re.compile(r"^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$")
NAME_PART_RE = re.compile(r"^[A-ZÁÉÍÓÚÑ][a-záéíóúñ'’.-]+$")


class RuleError(ValueError):
    pass


def telefono(value):
    """Solo dígitos, 7-15 caracteres, '+' inicial opcional. Sin letras."""
    digits = re.sub(r"[\s()-]", "", str(value or ""))
    if not PHONE_RE.match(digits):
        raise RuleError("Teléfono inválido: solo dígitos (7-15), '+' opcional")
    return digits


def email(value):
    """Correo SIEMPRE en minúsculas, con @ y dominio con punto/extensión."""
    raw = str(value or "").strip()
    if not raw or any(c.isupper() for c in raw):
        raise RuleError("El correo debe estar en minúsculas")
    cleaned = raw.lower()
    if not EMAIL_RE.match(cleaned):
        raise RuleError("Correo inválido: formato usuario@dominio.ext")
    return cleaned


def nombre(value):
    """Title Case: cada palabra empieza con mayúscula, resto minúsculas."""
    parts = str(value or "").strip().split()
    if not parts:
        raise RuleError("Nombre vacío")
    for part in parts:
        if not NAME_PART_RE.match(part):
            raise RuleError(f"Nombre/apellido en Title Case: '{part}'")
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


def password(value, campo="contraseña"):
    """Mínimo 8 caracteres con letra y número."""
    v = str(value or "")
    if len(v) < 8:
        raise RuleError(f"{campo} debe tener al menos 8 caracteres")
    if not re.search(r"[a-zA-Z]", v) or not re.search(r"\d", v):
        raise RuleError(f"{campo} debe mezclar letras y números")
    return v


RULES = {
    "telefono": telefono,
    "email": email,
    "nombre": nombre,
    "no_vacio": no_vacio,
    "entero": entero,
    "password": password,
}


def validate(rule, value, **kwargs):
    fn = RULES.get(rule)
    if not fn:
        raise RuleError(f"Regla desconocida: {rule}")
    return fn(value, **kwargs)
