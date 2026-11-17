"""Manifiesto PWA: genera el manifest.json con permisos solicitables.

Solo incluye permisos que el navegador/Android realmente permite pedir
(Permissions API). Los experimentales o no soportados se omiten a propósito.

Uso:
    from pwa import manifest
    data = manifest(nombre="Mi App", color="#0d6efd")
"""

# Permisos que sí se pueden solicitar (Permissions API / manifest).
PERMISOS_ANDROID = [
    "camera",
    "microphone",
    "geolocation",
    "notifications",
    "accelerometer",
    "ambient-light-sensor",
    "gyroscope",
    "magnetometer",
    "bluetooth",
    "usb",
    "serial",
    "midi",
    "clipboard-read",
    "clipboard-write",
    "payment-handler",
    "persistent-storage",
    "push",
    "screen-wake-lock",
]

ICON_192 = "/static/icons/icon-192.png"
ICON_512 = "/static/icons/icon-512.png"
ICON_MASKABLE = "/static/icons/icon-maskable-512.png"


def manifest(nombre="Mi Proyecto", color="#0d6efd", fondo="#ffffff",
             start_url="/", display="standalone"):
    """Devuelve el dict del manifest.json listo para jsonify."""
    corto = nombre if len(nombre) <= 12 else nombre[:11] + "…"
    return {
        "name": nombre,
        "short_name": corto,
        "description": "Aplicación Flask con soporte PWA",
        "lang": "es",
        "dir": "ltr",
        "start_url": start_url,
        "scope": "/",
        "display": display,
        "orientation": "portrait",
        "background_color": fondo,
        "theme_color": color,
        "categories": ["utilities", "productivity"],
        "icons": [
            {"src": ICON_192, "sizes": "192x192", "type": "image/png", "purpose": "any"},
            {"src": ICON_512, "sizes": "512x512", "type": "image/png", "purpose": "any"},
            {"src": ICON_MASKABLE, "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
        ],
        "shortcuts": [
            {"name": "Inicio", "url": "/",
             "icons": [{"src": ICON_192, "sizes": "192x192"}]},
        ],
        "permissions": PERMISOS_ANDROID,
        "prefer_related_applications": False,
    }
