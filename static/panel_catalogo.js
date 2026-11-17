async function loadCatalog() {
  const list = $("catalogList");
  let catalog;
  try {
    ({ catalog } = await api("/api/catalog"));
  } catch (e) {
    list.innerHTML = `<div class="list-group-item bg-transparent text-warning small">${esc(msgOllama(e))}</div>`;
    return;
  }
  list.innerHTML = "";
  for (const m of catalog) {
    if (EMBED_RE.test(m.name) || CODE_RED.test(m.name)) continue; // solo útiles para chat/código
    const item = document.createElement("div");
    item.className = "list-group-item bg-transparent";
    const badge = m.installed
      ? '<span class="badge bg-success">instalado</span>'
      : `<button class="btn btn-sm btn-outline-primary py-0">instalar</button>`;
    item.innerHTML = `<div class="d-flex justify-content-between align-items-center">` +
      `<b>${esc(m.name)}</b>${badge}</div>` +
      `<div class="small"><span class="code-dot">${codeBadge(m.name)}</span> ${CODE_GREEN.test(m.name) ? "excelente para código" : "aceptable para código"}${cabeEnEquipo(m) === true ? ' <span class="text-success">✓ funciona en tu equipo</span>' : cabeEnEquipo(m) === false ? ' <span class="text-secondary">✗ no cabe aquí</span>' : ""}</div>` +
      `<div class="text-secondary">${esc(m.desc)}</div>` +
      `<div class="text-secondary">${m.size_gb != null ? m.size_gb + " GB" : "?"} · RAM ≥ ${m.ram_gb != null ? m.ram_gb + " GB" : "?"}</div>` +
      (m.tag === "nuevo" ? '<span class="badge bg-info mt-1">nuevo en ollama.com</span>' : "") +
      `<div class="progress pull-progress d-none mt-2" style="height:6px">` +
      `<div class="progress-bar progress-bar-striped progress-bar-animated" style="width:0%"></div></div>` +
      `<div class="small text-secondary pull-status mt-1"></div>`;
    if (!m.installed) {
      item.querySelector("button").onclick = () => pullByName(m.name, item);
    }
    list.appendChild(item);
  }
}

function filterCatalog() {
  const q = ($("catSearch").value || "").toLowerCase();
  $("catalogList").querySelectorAll(".list-group-item").forEach((it) =>
    it.classList.toggle("d-none", !!q && !it.textContent.toLowerCase().includes(q)));
}

async function refreshCatalog() {
  sideMsg("Buscando modelos nuevos en ollama.com…");
  try {
    const r = await api("/api/catalog/refresh", post({}));
    sideMsg(`Catálogo actualizado: ${r.count} modelos (${r.nuevos} nuevos)`);
    loadCatalog();
    checkNewModels();
  } catch (e) { sideMsg("Error: " + msgOllama(e)); }
}

// --- Campana de modelos nuevos ---
// Modelos que NO sirven para chat/programación: embeddings, OCR, seguridad,
// audio, extracción/tool-use, médicos, matemáticas y autocompletado base.
const EMBED_RE = /bge|embed|nomic|mxbai|gte-|minilm|paraphrase|granite-embedding|starcoder|codegemma|codellama.*-code|deepseek-coder.*-base|-ocr|guardian|guard3|shieldgemma|safeguard|minicheck|-audio|firefunction|tool-use|nexusraven|functiongemma|nuextract|reader-lm|meditron|medllama|medgemma|mathstral|-math|translategemma|stable-code|nsql/i;
let seenNew = new Set();

function estGb(name) {
  // Estima tamaño de descarga por los parámetros en el nombre (b/m).
  const m = name.match(/[:_-](\d+(?:\.\d+)?)(b|m)\b/i);
  if (!m) return "? GB";
  const n = parseFloat(m[1]);
  const gb = m[2].toLowerCase() === "b" ? n * 0.66 : n * 0.00066;
  return `~${gb.toFixed(1)} GB`;
}

// Calidad para programación: verde=excelente, amarillo=aceptable, rojo=no recomendado.
const CODE_GREEN = /qwen.*coder|devstral|wizardcoder|opencoder|phind|codegeex|magicoder|codeqwen|codebooga|yi-coder|deepcoder|granite-code|codestral|deepseek-coder-v2|starcoder2.*-instruct|kimi.*code|north-mini-code|dolphincoder|codeup|stablelm2-zephyr|qwen3|llama3\.3|phi4|mistral-small3|gpt-oss|glm-4|exaone|nemotron/i;
const CODE_RED = /smollm2:135m|tinyllama|orca-mini|llama2\b|llama2-chinese|llama2-uncensored|yarn-|yi\b|falcon\b|falcon2|stablelm-zephyr|stable-beluga|vicuna|wizard-vicuna|dolphin-phi|neural-chat|open-orca|platypus|everythinglm|duckdb|bakllava|sailor2|samantha|notux|notus|megadolphin|ornith|phonon|alfred|beam|clef|flint|kev|laya|bonsai|inkling|laguna|nimble|d1\b|d3|tev1|rnj|ripple|muse-|autotrust|athene/i;

function codeBadge(name) {
  if (CODE_RED.test(name)) return "🔴";
  if (CODE_GREEN.test(name)) return "🟢";
  return "🟡";
}
function esCodigoBueno(name) { return CODE_GREEN.test(name); }
function esCodigoMalo(name) { return CODE_RED.test(name); }

// ¿El modelo cabe en este equipo según el último análisis guardado?
function cabeEnEquipo(m) {
  if (!hwCache) return null; // aún no se analizó
  const budget = (hwCache.ram_gb || 8) * 0.6;
  const preset = $("genPreset") ? $("genPreset").value : "rapido";
  const cap = { rapido: 4, moderado: 8, avanzado: 99 }[preset] || 4;
  const need = m.ram_gb || (m.size_gb ? m.size_gb * 1.5 : estRamGb(m.name));
  return need <= Math.min(budget, cap);
}

async function checkNewModels() {
  try {
    const { catalog } = await api("/api/catalog");
    const nuevos = catalog.filter((m) => m.tag === "nuevo" && !m.installed && !EMBED_RE.test(m.name) && !CODE_RED.test(m.name));
    const fresh = nuevos.filter((m) => !seenNew.has(m.name));
    const badge = $("bellBadge");
    const menu = $("bellMenu");
    if (!badge || !menu) return;
    if (nuevos.length === 0) {
      badge.classList.add("d-none");
      menu.innerHTML = '<li class="px-3 py-1 text-secondary">sin novedades</li>';
      return;
    }
    badge.textContent = nuevos.length;
    badge.classList.remove("d-none");
    const cnt = $("pullNewCount");
    if (cnt) cnt.textContent = `(${nuevos.length} nuevos)`;
    menu.innerHTML = nuevos.map((m) =>
      `<li><a class="dropdown-item py-1" href="#" onclick="pullByName('${esc(m.name)}', null);return false">` +
      `<i class="bi bi-download"></i> ${esc(m.name)} <span class="text-secondary">${m.size_gb ? m.size_gb + " GB" : estGb(m.name)}</span></a></li>`
    ).join("");
    if (fresh.length && seenNew.size) {
      sideMsg(`🔔 ${fresh.length} modelo(s) nuevo(s) gratis: ` + fresh.map((m) => m.name).join(", "));
    }
    seenNew = new Set(nuevos.map((m) => m.name));
  } catch { /* silencioso */ }
}

let pullCtrl = null;

async function pullByName(name, item) {
  sideMsg("Descargando " + name + "… (puede tardar)");
  const btn = item && item.querySelector("button");
  const bar = item && item.querySelector(".pull-progress");
  const fill = bar && bar.querySelector(".progress-bar");
  const stat = item && item.querySelector(".pull-status");
  if (btn) btn.disabled = true;
  if (bar) bar.classList.remove("d-none");
  pullCtrl = new AbortController();
  let stopEl = null;
  let statTxt = stat;
  if (stat) {
    statTxt = document.createElement("span");
    statTxt.className = "pull-txt";
    stat.appendChild(statTxt);
    stopEl = document.createElement("span");
    stopEl.className = "icon-btn ms-1";
    stopEl.innerHTML = '<i class="bi bi-stop-fill" style="color:#f2a5b6"></i>';
    stopEl.title = "Detener descarga";
    stopEl.onclick = () => pullCtrl.abort();
    stat.appendChild(stopEl);
  }
  try {
    if (item) {
      const r = await fetch("/api/models/pull-stream", { ...post({ name }), signal: pullCtrl.signal });
      if (!r.ok || !r.body) throw new Error("HTTP " + r.status);
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let ev;
          try { ev = JSON.parse(line); } catch { continue; }
          if (ev.error) throw new Error(ev.error);
          if (ev.completed != null && ev.total) {
            const pct = Math.min(100, Math.round((ev.completed / ev.total) * 100));
            if (fill) fill.style.width = pct + "%";
            if (statTxt) statTxt.textContent = (ev.status || "descargando") + " — " + pct + "%";
          }
        }
      }
      if (fill) { fill.style.width = "100%"; fill.classList.remove("progress-bar-animated"); }
      if (statTxt) statTxt.textContent = "Completado";
    } else {
      const r = await fetch("/api/models/pull-stream", { ...post({ name }), signal: pullCtrl.signal });
      if (!r.ok || !r.body) throw new Error("HTTP " + r.status);
      const reader = r.body.getReader();
      for (;;) { const { done } = await reader.read(); if (done) break; }
    }
    sideMsg("Listo: " + name); loadModels(); loadCatalog();
  } catch (e) {
    if (e && e.name === "AbortError") {
      sideMsg("Descarga detenida: " + name);
      if (statTxt) statTxt.textContent = "detenida";
    } else {
      sideMsg(msgOllama(e));
      if (statTxt) statTxt.textContent = "Error: " + msgOllama(e);
    }
    if (btn) btn.disabled = false;
  } finally {
    pullCtrl = null;
    if (stopEl) stopEl.remove();
  }
}

async function pullModel() {
  const name = $("pullName").value.trim();
  if (name) pullByName(name);
}

async function createModel() {
  const name = $("newName").value.trim(), base = $("newBase").value;
  if (!name || !base) { sideMsg("Falta nombre o base"); return; }
  sideMsg("Creando " + name + "…");
  try {
    await api("/api/models/create", post({ name, base, system: $("newSystem").value }));
    sideMsg("Creado: " + name); loadModels();
  } catch (e) { sideMsg("Error: " + e.message); }
}

async function uploadModel() {
  const f = $("upFile").files[0];
  if (!f) { sideMsg("Elige un .gguf"); return; }
  const fd = new FormData();
  fd.append("file", f); fd.append("name", $("upName").value.trim());
  sideMsg("Subiendo y registrando…");
  try {
    const r = await api("/api/models/upload", { method: "POST", body: fd });
    sideMsg("Registrado: " + r.name); loadModels(); loadCatalog();
  } catch (e) { sideMsg("Error: " + e.message); }
}
