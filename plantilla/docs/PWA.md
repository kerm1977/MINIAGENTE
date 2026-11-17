# PWA — Guía rápida

La plantilla incluye `pwa.py` (módulo generador de manifiesto) y la ruta
`GET /api/pwa/manifest`, enlazada desde `templates/base.html`.

## Personalizar el manifiesto

Edita `pwa.py` → `manifest()` o llama a la ruta con parámetros:

```
/api/pwa/manifest?nombre=MiApp&color=%230d6efd&fondo=%23ffffff
```

- `nombre`: nombre completo de la app.
- `color`: color del tema (barra de estado).
- `fondo`: color de fondo del splash.

## Íconos (obligatorios para instalar)

Coloca estos archivos en `static/icons/`:

- `icon-192.png` (192×192)
- `icon-512.png` (512×512)
- `icon-maskable-512.png` (512×512 con zona segura)

Sin íconos, Chrome/Android no ofrece "Instalar app".

## Permisos

`PERMISOS_ANDROID` en `pwa.py` lista solo los permisos que la Permissions
API permite solicitar de verdad (cámara, micrófono, geolocalización,
notificaciones, sensores, Bluetooth, USB, etc.). Los experimentales o no
soportados (p. ej. `window-management`, `xr-spatial-tracking`) se omiten a
propósito. En Android, cada permiso debe pedirse en tiempo de ejecución con
`navigator.permissions.query()` / la API correspondiente.

## Service worker (opcional pero recomendado)

Crea `static/sw.js` con una caché básica y regístralo en `base.html`:

```js
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/static/sw.js");
}
```
