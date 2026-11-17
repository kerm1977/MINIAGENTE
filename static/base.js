const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function post(obj) {
  return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) };
}

async function api(path, opts) {
  const r = await fetch(path, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || r.statusText);
  return data;
}

function sideMsg(t) { $("sideMsg").innerHTML = t; }

function toggleSidebar() {
  const sb = $("sidebar"), bd = $("sideBackdrop");
  if (window.matchMedia("(max-width: 767.98px)").matches) {
    const open = sb.classList.toggle("open");
    bd.classList.toggle("d-none", !open);
  } else {
    sb.classList.toggle("collapsed");
  }
}

function closeSidebar() {
  $("sidebar").classList.remove("open");
  $("sideBackdrop").classList.add("d-none");
}

function msgOllama(e) {
  const m = String(e && e.message || e);
  if (/11434|Failed to establish|NetworkError|Failed to fetch/i.test(m)) {
    return "Ollama no está corriendo en este equipo. Instálalo desde ollama.com/download y ejecútalo, luego reintenta.";
  }
  return m;
}

async function loadStatus() {
  const d = $("statusDot");
  const motor = typeof currentBackend === "function" ? currentBackend() : "ollama";
  try {
    if (motor !== "ollama") {
      const { backends: items } = await api("/api/backends");
      const b = (items || []).find((x) => x.id === motor) || {};
      d.textContent = b.ok ? `${motor} en línea` : `${motor} apagado`;
      d.className = "badge " + (b.ok ? "bg-success" : "bg-danger");
      return;
    }
    const s = await api("/api/status");
    d.textContent = s.ok ? `Ollama ${s.version}` : "Ollama desconectado";
    d.className = "badge " + (s.ok ? "bg-success" : "bg-danger");
  } catch (e) {
    d.textContent = "sin conexión";
    d.className = "badge bg-secondary";
  }
}
