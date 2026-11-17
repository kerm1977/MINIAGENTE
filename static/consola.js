// Consola de errores: log exhaustivo de fallos del cliente y del servidor.
// Se abre desde el menú ⋮ del navbar ("Consola").

const _errores = [];
const MAX_ERR = 300;

function logError(origen, detalle) {
  const item = {
    ts: new Date().toLocaleTimeString(),
    origen: String(origen || "app"),
    detalle: String(detalle || "").slice(0, 2000),
  };
  _errores.push(item);
  if (_errores.length > MAX_ERR) _errores.shift();
  renderConsola();
  api("/api/errors", post(item)).catch(() => {});
  return item;
}

function renderConsola() {
  const list = $("errList");
  if (!list) return;
  const badge = $("errBadge");
  if (badge) {
    badge.textContent = _errores.length || "";
    badge.classList.toggle("d-none", !_errores.length);
  }
  if (!_errores.length) {
    list.innerHTML = '<div class="text-secondary small p-2">Sin errores registrados.</div>';
    return;
  }
  list.innerHTML = "";
  for (const e of [..._errores].reverse()) {
    const row = document.createElement("div");
    row.className = "border-bottom py-1 small";
    row.innerHTML = `<span class="text-secondary">${esc(e.ts)}</span> ` +
      `<span class="badge bg-secondary-subtle text-secondary-emphasis">${esc(e.origen)}</span> ` +
      `<span class="text-danger-emphasis">${esc(e.detalle)}</span>`;
    list.appendChild(row);
  }
}

async function loadServerErrors() {
  try {
    const { errors } = await api("/api/errors");
    for (const e of errors || []) {
      if (!_errores.some((x) => x.ts === e.ts && x.detalle === e.detalle))
        _errores.push(e);
    }
    renderConsola();
  } catch (e) { /* el servidor aún no expone /api/errors */ }
}

function copyConsola() {
  const txt = _errores.map((e) => `[${e.ts}] ${e.origen}: ${e.detalle}`).join("\n") || "(sin errores)";
  navigator.clipboard.writeText(txt).then(
    () => sideMsg("Registros copiados al portapapeles"),
    () => sideMsg("No se pudo copiar"),
  );
}

function clearConsola() {
  _errores.length = 0;
  renderConsola();
  api("/api/errors", { method: "DELETE" }).catch(() => {});
}

// Captura global de errores de JS y promesas rechazadas.
window.addEventListener("error", (e) =>
  logError(e.filename ? e.filename.split("/").pop() + ":" + e.lineno : "js",
           e.message));
window.addEventListener("unhandledrejection", (e) =>
  logError("promesa", e.reason && e.reason.message || e.reason));

// Envuelve api() para registrar cada llamada fallida.
const _apiBase = api;
api = async function (path, opts) {
  try {
    return await _apiBase(path, opts);
  } catch (e) {
    logError("api " + path, e.message);
    throw e;
  }
};

loadServerErrors();
