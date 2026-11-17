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
  try {
    const s = await api("/api/status");
    d.textContent = s.ok ? `Ollama ${s.version}` : "Ollama desconectado";
    d.className = "badge " + (s.ok ? "bg-success" : "bg-danger");
  } catch (e) {
    d.textContent = "sin conexión";
    d.className = "badge bg-secondary";
  }
}

async function loadModels() {
  const sel = $("modelSelect"), base = $("newBase"), list = $("modelList");
  let models;
  try {
    ({ models } = await api("/api/models"));
  } catch (e) {
    list.innerHTML = `<div class="list-group-item bg-transparent text-warning small">${esc(msgOllama(e))}</div>`;
    return;
  }
  sel.innerHTML = ""; base.innerHTML = '<option value="">Base: elige modelo instalado</option>';
  list.innerHTML = "";
  const EMBED = /bge|embed|nomic|mxbai/i;
  for (const m of models) {
    const esEmbed = EMBED.test(m.name);
    const opt = new Option(esEmbed ? `${m.name} (solo embeddings)` : m.name, m.name);
    sel.add(opt);
    base.add(new Option(m.name, m.name));
    const item = document.createElement("div");
    item.className = "list-group-item bg-transparent d-flex justify-content-between align-items-center";
    item.innerHTML = `<span>${esc(m.name)} ${esEmbed ? '<span class="badge bg-warning-subtle text-warning-emphasis small">embeddings, no chat</span> ' : ""}<small class="text-secondary">${(m.size / 1e9).toFixed(1)}GB</small></span>` +
      `<button class="btn btn-sm btn-outline-danger" title="Eliminar"><i class="bi bi-x"></i></button>`;
    item.querySelector("button").onclick = async () => {
      if (!(await confirmModal("Eliminar modelo", `¿Eliminar ${m.name} de los modelos instalados?`))) return;
      await api("/api/models/" + encodeURIComponent(m.name), { method: "DELETE" });
      loadModels();
    };
    list.appendChild(item);
  }
  const menu = $("modelMenu");
  if (menu) {
    menu.innerHTML = "";
    for (const m of models) {
      const li = document.createElement("li");
      li.innerHTML = `<button class="dropdown-item small">${esc(m.name)}</button>`;
      li.querySelector("button").onclick = () => { $("modelSelect").value = m.name; savePref("model", m.name); setModelTag(); };
      menu.appendChild(li);
    }
  }
  const prefs = await loadPrefs();
  if (prefs.model && [...sel.options].some((o) => o.value === prefs.model)) sel.value = prefs.model;
  setModelTag();
}

function setModelTag() {
  const tag = $("modelTag");
  if (!tag) return;
  const m = $("modelSelect").value;
  tag.textContent = m ? "modelo: " + m : "sin modelo activo";
  tag.title = m ? `Config: ${$("genPreset").value} · ${$("genMem").selectedOptions[0].textContent} · ${$("genDevice").value} — clic para prueba de rendimiento` : "";
}

let _prefs = {};

async function loadPrefs() {
  try { _prefs = await api("/api/prefs"); } catch { _prefs = {}; }
  return _prefs;
}

function savePref(key, value) {
  _prefs[key] = value;
  api("/api/prefs", post({ key, value })).catch(() => {});
}

function wireGenPrefs() {
  const map = { genPreset: "preset", genMem: "mem", genDevice: "device", genMaxTok: "maxtok", genThreads: "threads", modelSelect: "model" };
  for (const [id, key] of Object.entries(map)) {
    const el = $(id);
    if (!el) continue;
    if (id !== "modelSelect" && _prefs[key] && [...el.options].some((o) => o.value === _prefs[key])) {
      el.value = _prefs[key];
    }
    el.addEventListener("change", () => savePref(key, el.value));
  }
  const root = $("rootMode");
  if (root) {
    if (_prefs.root === "1") root.checked = true;
    if (_prefs.root === "0") root.checked = false;
    root.addEventListener("change", () => savePref("root", root.checked ? "1" : "0"));
  }
}

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

async function loadFiles() {
  const res = await api("/api/files?path=." + ($("rootMode").checked ? "&root=1" : ""));
  $("fileTree").textContent = res.ok ? (res.tree.join("\n") || "(vacío)") : res.error;
}

async function loadSessions() {
  const { sessions } = await api("/api/sessions");
  const list = $("sessionList");
  list.innerHTML = "";
  for (const s of sessions) {
    const item = document.createElement("div");
    item.className = "list-group-item bg-transparent" +
      (s.id === currentSessionId ? " active" : "");
    const fecha = new Date(s.created_at * 1000).toLocaleString();
    item.innerHTML = `<div class="d-flex justify-content-between align-items-center gap-2">` +
      `<span class="text-truncate small">${esc(s.title)}</span>` +
      `<span class="d-flex gap-1">` +
      `<button class="btn btn-sm btn-outline-secondary py-0 open-btn" title="Continuar esta conversación"><i class="bi bi-play" style="color:#7fb2f0"></i></button>` +
      `<button class="btn btn-sm btn-outline-secondary py-0 del-btn" title="Eliminar sesión"><i class="bi bi-trash" style="color:#f2a5b6"></i></button>` +
      `</span></div>` +
      `<small class="text-secondary">${s.n_msgs} mensajes · ${fecha}</small>`;
    item.querySelector(".open-btn").onclick = () => openSession(s.id);
    item.querySelector(".del-btn").onclick = () => deleteSession(s.id, s.title);
    list.appendChild(item);
  }
}

let delStepN = 1, delSid = null, delTitle = "", delModal = null;

function deleteSession(sid, title) {
  delSid = sid; delTitle = title; delStepN = 1;
  renderDelStep();
  (delModal || (delModal = new bootstrap.Modal($("delModal")))).show();
}

function renderDelStep() {
  const texts = [
    `¿Seguro que quieres eliminar la sesión "${delTitle}"?`,
    "Se borrarán todos sus mensajes guardados para siempre.",
    "Última confirmación: esta acción no se puede deshacer.",
  ];
  $("delTitle").textContent = `Eliminar sesión — paso ${delStepN} de 3`;
  $("delBody").textContent = texts[delStepN - 1];
  $("delFoot").innerHTML =
    (delStepN > 1 ? '<button class="btn btn-outline-secondary btn-sm" onclick="delStep(-1)">← Atrás</button>' : "") +
    '<button class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">Cancelar</button>' +
    (delStepN < 3
      ? '<button class="btn btn-primary btn-sm" onclick="delStep(1)">Continuar →</button>'
      : '<button class="btn btn-danger btn-sm" onclick="doDelete()">Sí, eliminar</button>');
}

function delStep(d) {
  delStepN = Math.min(3, Math.max(1, delStepN + d));
  renderDelStep();
}

async function doDelete() {
  delModal.hide();
  await api("/api/sessions/" + delSid, { method: "DELETE" });
  if (currentSessionId === delSid) {
    currentSessionId = null;
    messages.length = 0;
    $("chat").innerHTML = "";
  }
  loadSessions();
}

async function newSession() {
  if (messages.length && !currentSessionId) {
    try {
      const sid = await ensureSession(messages[0].content || "Conversación", $("modelSelect").value);
      await api(`/api/sessions/${sid}/messages`, post({ messages }));
    } catch (e) {}
  }
  currentSessionId = null;
  messages.length = 0;
  $("chat").innerHTML = "";
  loadSessions();
}

async function openSession(sid) {
  const { messages: stored } = await api("/api/sessions/" + sid);
  currentSessionId = sid;
  messages.length = 0;
  $("chat").innerHTML = "";
  for (const m of stored) {
    messages.push({ role: m.role, content: m.content });
    addMsg(m.role, m.role === "user" ? esc(m.content) : renderMd(m.content));
  }
  loadSessions();
}

function applyTheme(t) {
  document.documentElement.setAttribute("data-bs-theme", t);
  localStorage.setItem("theme", t);
  const i = document.querySelector("#themeBtn i");
  if (i) i.className = t === "dark" ? "bi bi-sun" : "bi bi-moon";
}

function toggleTheme() {
  applyTheme(document.documentElement.getAttribute("data-bs-theme") === "dark" ? "light" : "dark");
}

async function loadProjects() {
  const { projects } = await api("/api/projects");
  $("projectList").innerHTML = projects.length
    ? projects.map((p) => `<div><i class="bi bi-folder"></i> ${esc(p)}</div>`).join("")
    : '<span class="text-secondary">sin proyectos aún</span>';
}

async function newProject() {
  const name = $("projName").value.trim();
  if (!name) { sideMsg("Pon un nombre, p. ej. mi-app"); return; }
  sideMsg("Creando proyecto " + name + "…");
  try {
    const r = await api("/api/projects", post({ name }));
    sideMsg("Proyecto creado en " + r.path);
    loadProjects(); loadFiles();
  } catch (e) { sideMsg("Error: " + e.message); }
}

async function guardarPrecreado(fw) {
  sideMsg("Instalando proyecto-" + fw + " en Descargas/Miniagente…");
  try {
    const r = await api("/api/precreados/" + fw + "/guardar");
    sideMsg("Listo en " + r.path);
  } catch (e) { sideMsg("Error: " + e.message); }
}

async function renderPrecreados() {
  const list = $("preList");
  if (!list) return;
  try {
    const { frameworks } = await api("/api/precreados");
    list.innerHTML = "";
    for (const f of frameworks) {
      const vers = (await api(`/api/templates/${f.id}/versiones`)).versiones || [];
      const info =
        `framework: ${esc(f.framework || f.label)} · plantilla: ${esc(f.plantilla || "-")}` +
        ` · puerto: ${f.port || "?"} · OTA: ${f.ota ? "sí" : "no"}`;
      const item = document.createElement("div");
      item.className = "list-group-item py-2";
      item.innerHTML =
        `<div class="d-flex align-items-center gap-2">` +
        `<i class="bi bi-file-zip text-secondary"></i>` +
        `<span class="flex-grow-1 small">${esc(f.label)}` +
        (vers.length ? ` <span class="text-secondary">(${vers.length} ver.)</span>` : "") +
        `</span>` +
        `<div class="dropdown">` +
        `<i class="bi bi-three-dots-vertical icon-btn" role="button" data-bs-toggle="dropdown"` +
        ` title="Opciones del proyecto"></i>` +
        `<ul class="dropdown-menu dropdown-menu-end small">` +
        `<li class="px-3 py-1 text-secondary" style="font-size:.75rem">${info}</li>` +
        `<li><hr class="dropdown-divider my-1"></li>` +
        `<li><a class="dropdown-item py-1" href="#" onclick="trabajarTpl('${f.id}');return false">` +
        `<i class="bi bi-pencil-square"></i> Trabajar (copia editable)</a></li>` +
        `<li><a class="dropdown-item py-1" href="#" onclick="nuevaVersionTpl('${f.id}');return false">` +
        `<i class="bi bi-bookmark-plus"></i> Guardar nueva versión</a></li>` +
        `<li><a class="dropdown-item py-1 text-warning" href="#" onclick="sobrescribirTpl('${f.id}');return false">` +
        `<i class="bi bi-exclamation-triangle"></i> Sobrescribir plantilla (4 pasos)</a></li>` +
        `<li><a class="dropdown-item py-1" href="/api/templates/${f.id}/trabajo.zip" download>` +
        `<i class="bi bi-file-zip"></i> Descargar trabajo.zip</a></li>` +
        `<li><a class="dropdown-item py-1" href="/api/precreados/${f.id}.zip" download>` +
        `<i class="bi bi-download"></i> Descargar proyecto zip</a></li>` +
        `<li><a class="dropdown-item py-1" href="#" onclick="guardarPrecreado('${f.id}');return false">` +
        `<i class="bi bi-folder2-open"></i> Instalar en Descargas/Miniagente</a></li>` +
        `<li><a class="dropdown-item py-1" href="#" onclick="githubTpl('${f.id}');return false">` +
        `<i class="bi bi-github"></i> Guardar en GitHub</a></li>` +
        `</ul></div>` +
        `</div>` +
        (vers.length
          ? `<div class="mt-1 small text-secondary">versiones: ` +
            vers.map((v) =>
              `<span class="icon-btn" role="button" title="Cargar ${v} como copia de trabajo"` +
              ` onclick="trabajarVersion('${f.id}','${v}')">${esc(v)}</span>` +
              ` <a href="/api/templates/${f.id}/version/${v}.zip" download title="Descargar ${v}"><i class="bi bi-download"></i></a>`
            ).join(" · ") + `</div>`
          : "");
      list.appendChild(item);
    }
  } catch (e) { sideMsg("Error: " + e.message); }
}

function githubTpl(fw) {
  $("ghFw").value = fw;
  $("ghRepo").value = "proyecto-" + fw;
  bootstrap.Modal.getOrCreateInstance($("ghModal")).show();
}

async function githubSave() {
  const fw = $("ghFw").value;
  const user = $("ghUser").value.trim();
  const token = $("ghToken").value.trim();
  const repo = $("ghRepo").value.trim();
  if (!user || !token) { sideMsg("Faltan usuario y token"); return; }
  bootstrap.Modal.getOrCreateInstance($("ghModal")).hide();
  sideMsg("Subiendo " + fw + " a github.com/" + user + "/" + repo + "…");
  try {
    const r = await api(`/api/templates/${fw}/github`, post({ user, token, repo }));
    sideMsg(`Guardado: <a href="${r.url}" target="_blank">${r.url}</a>`);
  } catch (e) { sideMsg("Error: " + e.message); }
  $("ghToken").value = "";
}

async function trabajarTpl(fw) {
  sideMsg("Cargando " + fw + " a workspace/templates/…");
  try {
    const r = await api(`/api/templates/${fw}/trabajar`, post({}));
    sideMsg(`Copia editable en <code>${r.path}</code> — pide al asistente que la modifique`);
    loadFiles();
    openEditor(r.path);
  } catch (e) { sideMsg("Error: " + e.message); }
}

async function nuevaVersionTpl(fw) {
  try {
    const r = await api(`/api/templates/${fw}/version`, post({}));
    sideMsg("Guardada como " + r.version);
    renderPrecreados();
  } catch (e) { sideMsg("Error: " + e.message); }
}

async function trabajarVersion(fw, ver) {
  try {
    const r = await api(`/api/templates/${fw}/version/${ver}/trabajar`, post({}));
    sideMsg(`Versión ${ver} cargada en <code>${r.path}</code>`);
    loadFiles();
    openEditor(r.path);
  } catch (e) { sideMsg("Error: " + e.message); }
}

async function sobrescribirTpl(fw) {
  const pasos = [
    `paso 1/4 — vas a sobrescribir la plantilla "${fw}" con tu copia de trabajo.`,
    "paso 2/4 — esto puede causar pérdida de datos si la copia no está verificada.",
    "paso 3/4 — confirma que la copia funciona correctamente antes de continuar.",
    "paso 4/4 — última confirmación: ¿sobrescribir definitivamente?",
  ];
  for (const p of pasos) {
    if (!(await confirmModal("Sobrescribir plantilla", p, "Continuar"))) return;
  }
  try {
    const r = await api(`/api/templates/${fw}/sobrescribir`, post({}));
    sideMsg(`Sobrescrita: ${r.written} archivos actualizados`);
  } catch (e) { sideMsg("Error: " + e.message); }
}

// --- Editor split ---
let edFile = null;

function toggleEditor() {
  const p = $("editorPane");
  p.classList.toggle("d-none");
  $("splitBar").classList.toggle("d-none", p.classList.contains("d-none"));
}

// Separador arrastrable entre chat y editor split.
(function wireSplitBar() {
  const bar = document.getElementById("splitBar");
  if (!bar) return;
  let dragging = false;
  bar.addEventListener("mousedown", (e) => { dragging = true; e.preventDefault(); });
  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const p = $("editorPane");
    const w = window.innerWidth - e.clientX;
    p.style.width = Math.min(Math.max(w, 200), window.innerWidth * 0.8) + "px";
    p.classList.remove("col-md-5");
  });
  document.addEventListener("mouseup", () => {
    if (dragging) savePref("ed_pane_w", $("editorPane").style.width);
    dragging = false;
  });

  // Separador entre el árbol y el código dentro del editor.
  const edSplit = document.getElementById("edSplit");
  if (edSplit) {
    let edDrag = false;
    edSplit.addEventListener("mousedown", (e) => { edDrag = true; e.preventDefault(); });
    document.addEventListener("mousemove", (e) => {
      if (!edDrag) return;
      const pane = $("editorPane");
      const w = Math.min(Math.max(e.clientX - pane.getBoundingClientRect().left, 80), pane.offsetWidth - 120);
      $("edTree").style.width = w + "px";
    });
    document.addEventListener("mouseup", () => {
      if (edDrag) savePref("ed_tree_w", $("edTree").style.width);
      edDrag = false;
    });
  }

  // Separador del panel lateral (vista PC): ajusta el ancho del acordeón.
  const sideSplit = document.getElementById("sideSplit");
  if (sideSplit) {
    let sDrag = false;
    sideSplit.addEventListener("mousedown", (e) => { sDrag = true; e.preventDefault(); });
    document.addEventListener("mousemove", (e) => {
      if (!sDrag) return;
      const sb = document.getElementById("sidebar");
      if (!sb) return;
      const w = Math.min(Math.max(e.clientX, 160), window.innerWidth * 0.6);
      sb.classList.add("resizable");
      sb.style.width = w + "px";
      sb.style.maxWidth = w + "px";
    });
    document.addEventListener("mouseup", () => {
      if (sDrag) savePref("sidebar_w", $("sidebar").style.width);
      sDrag = false;
    });
  }
})();

let edDir = null;

const FILE_ICONS = {
  py: "bi-filetype-py", html: "bi-filetype-html", htm: "bi-filetype-html",
  css: "bi-filetype-css", js: "bi-filetype-js", jsx: "bi-filetype-jsx",
  ts: "bi-filetype-js", tsx: "bi-filetype-tsx", json: "bi-filetype-json",
  md: "bi-filetype-md", txt: "bi-filetype-txt", yml: "bi-filetype-yml",
  yaml: "bi-filetype-yml", xml: "bi-filetype-xml", sql: "bi-filetype-sql",
  php: "bi-filetype-php", sh: "bi-filetype-sh", bat: "bi-filetype-sh",
  svg: "bi-filetype-svg", png: "bi-filetype-png", jpg: "bi-filetype-jpg",
  rb: "bi-filetype-rb", java: "bi-filetype-java", cs: "bi-filetype-cs",
};
const fileIcon = (name) =>
  "bi " + (FILE_ICONS[(name.split(".").pop() || "").toLowerCase()] || "bi-file-earmark-code");

// Árbol expandible: carpetas primero, archivos con ícono por tipo.
function buildTree(files, dir) {
  const root = { dirs: {}, files: [] };
  for (const rel of files) {
    const parts = rel.split("/");
    let node = root;
    for (let i = 0; i < parts.length - 1; i++)
      node = node.dirs[parts[i]] = node.dirs[parts[i]] || { dirs: {}, files: [] };
    node.files.push(rel);
  }
  const t = $("edTree");
  t.innerHTML = "";
  const render = (node, base, depth, parent) => {
    for (const name of Object.keys(node.dirs).sort()) {
      const sub = node.dirs[name];
      const rel = base ? base + "/" + name : name;
      const head = document.createElement("div");
      head.className = "icon-btn text-truncate fw-bold";
      head.style.paddingLeft = (depth * 0.8) + "rem";
      head.innerHTML = `<i class="bi bi-chevron-right"></i> <i class="bi bi-folder"></i> ${esc(name)}`;
      const body = document.createElement("div");
      body.style.display = "none";
      head.onclick = () => {
        const open = body.style.display !== "none";
        body.style.display = open ? "none" : "";
        head.querySelector(".bi-chevron-right, .bi-chevron-down")
          .className = "bi " + (open ? "bi-chevron-right" : "bi-chevron-down");
      };
      parent.appendChild(head); parent.appendChild(body);
      render(sub, rel, depth + 1, body);
    }
    for (const rel of node.files.sort()) {
      const name = rel.split("/").pop();
      const el = document.createElement("div");
      el.className = "icon-btn text-truncate ed-file";
      el.dataset.path = dir + "/" + rel;
      el.style.paddingLeft = (depth * 0.8 + 0.6) + "rem";
      el.innerHTML = `<i class="${fileIcon(name)}"></i> ${esc(name)}`;
      el.title = rel;
      el.onclick = () => openFile(dir + "/" + rel);
      parent.appendChild(el);
    }
  };
  render(root, "", 0, t);
  if (!t.children.length) t.textContent = "(vacío)";
}

// Marca en el árbol los archivos/carpetas que el agente modificó y los registra.
const editedPaths = new Set();

function markEdited(paths) {
  for (const p of paths) {
    if (!p || p.endsWith(".bak")) continue;
    const el = document.querySelector(`.ed-file[data-path="${p}"]`);
    if (el) {
      el.classList.add("ed-changed");
      // punto rojo en todas las carpetas padre
      let par = el.parentElement;
      while (par && par !== $("edTree")) {
        const head = par.previousElementSibling;
        if (head && head.querySelector(".bi-folder")) head.classList.add("ed-dir-changed");
        par = par.parentElement;
      }
    } else if (edDir && p.includes(edDir)) {
      document.querySelectorAll(".ed-file").forEach((e) => {
        if (p.endsWith(e.dataset.path.slice(edDir.length + 1))) e.classList.add("ed-changed");
      });
    }
    editedPaths.add(p);
    addEditLog(p);
  }
}

// Registro de cambios bajo Proyectos creados, con botón para volver atrás.
function addEditLog(path) {
  const log = $("editLog");
  if (!log) return;
  if (!log.dataset.title) {
    log.dataset.title = "1";
    log.innerHTML = `<div class="fw-bold mt-2">Registro de cambios</div>`;
  }
  const row = document.createElement("div");
  row.className = "d-flex justify-content-between align-items-center border-bottom py-1";
  row.innerHTML = `<span class="text-truncate" title="${esc(path)}">${esc(path)}</span>` +
    `<button class="btn btn-sm btn-outline-warning py-0" title="Volver a versión anterior">↩</button>`;
  row.querySelector("button").onclick = async () => {
    try {
      await api("/api/file/revert", post({ path }));
      row.remove();
      editedPaths.delete(path);
      sideMsg("Restaurada versión anterior de " + path);
      if (edFile === path) openFile(path);
    } catch (e) { sideMsg("Sin backup: " + e.message); }
  };
  log.appendChild(row);
}

// Recientes: últimos 5 proyectos trabajados.
function renderRecent() {
  const list = $("recentList");
  if (!list) return;
  const rec = Array.isArray(_prefs.ed_recent) ? _prefs.ed_recent : [];
  list.innerHTML = "";
  if (!rec.length) { list.innerHTML = '<div class="text-secondary">—</div>'; return; }
  for (const r of rec) {
    const b = document.createElement("button");
    b.className = "list-group-item list-group-item-action py-1";
    b.innerHTML = `<i class="bi bi-folder"></i> ${esc(r.dir)}` +
      (r.file ? ` <span class="text-secondary">· ${esc(r.file.split("/").pop())}</span>` : "");
    b.onclick = async () => {
      await openEditor(r.dir);
      if (r.file) openFile(r.file);
    };
    list.appendChild(b);
  }
}

function pushRecent(dir, file) {
  let rec = Array.isArray(_prefs.ed_recent) ? _prefs.ed_recent.slice() : [];
  rec = rec.filter((r) => r.dir !== dir);
  rec.unshift({ dir, file: file || null });
  rec = rec.slice(0, 5);
  savePref("ed_recent", rec);
  renderRecent();
}

// "Nuevo proyecto": limpia el editor y el árbol para elegir otro proyecto.
function newProjectState() {
  edDir = null; edFile = null;
  $("edTree").innerHTML = "";
  if (edEl()) edEl().innerHTML = "";
  $("edPath").textContent = "editor";
  const log = $("editLog");
  if (log) { log.innerHTML = ""; delete log.dataset.title; }
  editedPaths.clear();
  savePref("ed_dir", "");
  savePref("ed_file", "");
  refreshEditorView();
  document.querySelectorAll(".ed-file,.ed-dir-changed").forEach((e) =>
    e.classList.remove("ed-changed", "ed-dir-changed"));
  sideMsg("Editor limpio — elige un proyecto en Proyectos creados");
}

async function openEditor(dir) {
  const p = $("editorPane");
  p.classList.remove("d-none");
  $("splitBar").classList.remove("d-none");
  $("edPath").textContent = dir;
  edDir = dir;
  savePref("ed_dir", dir);
  pushRecent(dir, edFile);
  try {
    const r = await api("/api/filetree?path=" + encodeURIComponent(dir));
    buildTree(r.files || [], dir);
  } catch (e) { $("edTree").textContent = "Error: " + e.message; }
}

// --- Resaltado de sintaxis + gutter + autoguardado ---
const KW = "def class import from return if else elif for while try except finally with as lambda pass break continue raise yield async await print True False None self and or not in is global nonlocal del assert const let var function new typeof instanceof do switch case default this extends static public private void int string bool echo fn pub use mod impl struct enum match package func go select defer chan";
const KW_RE = new RegExp("\\b(" + KW.split(" ").join("|") + ")\\b", "g");

function hlCode(code, ext) {
  let s = esc(code);
  // strings
  s = s.replace(/(&quot;|&#039;|&quot;|&apos;|"[^"\n]*"|'[^'\n]*'|`[^`\n]*`)/g,
    (m) => `<span class="tok-str">${m}</span>`);
  if (["html", "htm", "xml"].includes(ext)) {
    s = s.replace(/(&lt;\/?[a-zA-Z][^&]*?&gt;)/g, (m) => `<span class="tok-tag">${m}</span>`);
    s = s.replace(/(&lt;!--[\s\S]*?--&gt;)/g, (m) => `<span class="tok-cm">${m}</span>`);
  } else {
    s = s.replace(/(#[^\n]*|\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g, (m) => `<span class="tok-cm">${m}</span>`);
    s = s.replace(KW_RE, '<span class="tok-kw">$1</span>');
    s = s.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-num">$1</span>');
    s = s.replace(/\b([a-zA-Z_]\w*)(?=\()/g, '<span class="tok-fn">$1</span>');
  }
  return s;
}

// ===== Editor real (contenteditable): el texto coloreado ES el texto =====
function edEl() { return $("edCode"); }
// El render añade <i class="ed-eol">\n</i> para que el caret pueda llegar al
// final de archivos que terminan en salto de línea. edText() lo descuenta
// para no acumular una línea en blanco por cada tecla.
const EOL_HTML = '<i class="ed-eol">\n</i>';

function edText() {
  const el = edEl();
  if (!el) return "";
  const t = el.innerText.replace(/\u00a0/g, " ");
  const lc = el.lastChild;
  const ours = lc && lc.nodeType === 1 && lc.classList && lc.classList.contains("ed-eol");
  return ours && t.endsWith("\n") ? t.slice(0, -1) : t;
}

// Offset del caret en coordenadas de innerText (las mismas que usa edText).
// Inserta un marcador invisible, lee su índice en innerText y lo retira:
// así <br>/<div> del contenteditable cuentan igual que los saltos reales.
const CARET_MARK = "\u2063";

function caretOffset() {
  const el = edEl();
  const sel = window.getSelection();
  if (!el || !sel.rangeCount) return 0;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.startContainer)) return 0;
  const probe = document.createTextNode(CARET_MARK);
  const r = range.cloneRange();
  r.collapse(true);
  try { r.insertNode(probe); } catch { return edText().length; }
  const idx = el.innerText.indexOf(CARET_MARK);
  probe.remove();
  return idx < 0 ? edText().length : Math.min(idx, edText().length);
}

function setCaret(offset) {
  const el = edEl();
  if (!el) return;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let rest = offset, node, last = null;
  while ((node = walker.nextNode())) {
    last = node;
    if (node.length >= rest) {
      const sel = window.getSelection(), r = document.createRange();
      r.setStart(node, rest); r.collapse(true);
      sel.removeAllRanges(); sel.addRange(r);
      return;
    }
    rest -= node.length;
  }
  if (last) { // fuera de rango: caret al final del contenido
    const sel = window.getSelection(), r = document.createRange();
    r.setStart(last, last.length); r.collapse(true);
    sel.removeAllRanges(); sel.addRange(r);
  }
}

function renderCode() {
  const el = edEl();
  if (!el) return;
  const off = caretOffset();
  const ext = (edFile || "").split(".").pop().toLowerCase();
  el.innerHTML = hlCode(edText(), ext) + EOL_HTML;
  setCaret(off);
}

function refreshEditorView() {
  const el = edEl(), g = $("edGutter");
  if (!el || !g) return;
  const lines = edText().split("\n").length;
  g.textContent = Array.from({ length: lines }, (_, i) => i + 1).join("\n");
  g.scrollTop = el.scrollTop;
}

let saveTimer = null;
function scheduleAutosave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { if (edFile) saveEditor(true); }, 1500);
}

function toggleWrap() {
  const w = document.querySelector(".ed-wrap");
  w.classList.toggle("wrap-on");
  const on = w.classList.contains("wrap-on");
  const b = $("edWrap");
  if (b) b.classList.toggle("btn-primary", on);
  savePref("ed_wrap", on);
}

async function openFile(path) {
  try {
    const r = await api("/api/file?path=" + encodeURIComponent(path));
    edFile = path;
    const ext = path.split(".").pop().toLowerCase();
    edEl().innerHTML = hlCode(r.content, ext) + EOL_HTML;
    $("edPath").textContent = path;
    savePref("ed_file", path);
    if (edDir) pushRecent(edDir, path);
    document.querySelectorAll(".ed-file").forEach((e) =>
      e.classList.toggle("text-primary", e.dataset.path === path));
    refreshEditorView();
  } catch (e) { sideMsg("Error: " + e.message); }
}

async function saveEditor(silent) {
  if (!edFile) { sideMsg("Abre un archivo primero"); return; }
  try {
    await api("/api/file", post({ path: edFile, content: edText() }));
    if (!silent) sideMsg("Guardado " + edFile);
  } catch (e) { sideMsg("Error: " + e.message); }
}

// Eventos del editor: gutter, tab=4 espacios, autoguardado (undo nativo del navegador).
(function wireEditor() {
  const el = edEl();
  if (!el) return;
  el.addEventListener("input", () => {
    // re-colorea manteniendo la posición del caret
    const off = caretOffset();
    const ext = (edFile || "").split(".").pop().toLowerCase();
    el.innerHTML = hlCode(edText(), ext) + EOL_HTML;
    setCaret(off);
    refreshEditorView(); scheduleAutosave();
  });
  el.addEventListener("scroll", refreshEditorView);
  // pegar como texto plano
  el.addEventListener("paste", (e) => {
    e.preventDefault();
    document.execCommand("insertText", false,
      (e.clipboardData || window.clipboardData).getData("text"));
  });
  // Shift+D: extiende la selección a la siguiente ocurrencia del texto marcado.
  el.addEventListener("keydown", (e) => {
    if (e.shiftKey && !e.ctrlKey && !e.altKey && e.key.toUpperCase() === "D") {
      e.preventDefault();
      const sel = window.getSelection();
      if (!sel.rangeCount || sel.isCollapsed) return;
      const r = sel.getRangeAt(0);
      const txt = r.toString();
      const pre = r.cloneRange();
      pre.selectNodeContents(el);
      pre.setEnd(r.endContainer, r.endOffset);
      const endOff = pre.toString().length;
      const next = edText().indexOf(txt, endOff);
      if (next < 0) return;
      // extiende el rango hasta el final de la ocurrencia encontrada
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let rest = next + txt.length, node;
      while ((node = walker.nextNode())) {
        if (node.length >= rest) {
          r.setEnd(node, rest); sel.removeAllRanges(); sel.addRange(r);
          return;
        }
        rest -= node.length;
      }
    }
  });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      document.execCommand("insertText", false, "    ");
      refreshEditorView(); scheduleAutosave();
    }
    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "z") {
      e.preventDefault();
      document.execCommand("undo");
      refreshEditorView(); scheduleAutosave();
    }
    if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "z") ||
        (e.ctrlKey && e.key.toLowerCase() === "y")) {
      e.preventDefault();
      document.execCommand("redo");
      refreshEditorView(); scheduleAutosave();
    }
  });
})();

// Restaura el editor tal como estaba al volver a entrar.
function restoreEditor() {
  const dir = _prefs.ed_dir, file = _prefs.ed_file;
  // tamaños de paneles y estado de ajustar líneas
  const sb = $("sidebar");
  if (sb && _prefs.sidebar_w) {
    sb.classList.add("resizable");
    sb.style.width = _prefs.sidebar_w;
    sb.style.maxWidth = _prefs.sidebar_w;
  }
  const pane = $("editorPane");
  if (pane && _prefs.ed_pane_w) {
    pane.style.width = _prefs.ed_pane_w;
    pane.classList.remove("col-md-5");
  }
  if (_prefs.ed_tree_w) $("edTree").style.width = _prefs.ed_tree_w;
  if (_prefs.ed_wrap) {
    const w = document.querySelector(".ed-wrap");
    if (w && !w.classList.contains("wrap-on")) w.classList.add("wrap-on");
    const b = $("edWrap");
    if (b) b.classList.add("btn-primary");
  }
  if (dir) openEditor(dir).then(() => { if (file) openFile(file); });
  renderRecent();
}

function exportJSON() {
  const data = { session_id: currentSessionId, exported_at: new Date().toISOString(), messages };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "conversacion.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importJSON(inp) {
  const f = inp && inp.files[0];
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    const msgs = Array.isArray(data) ? data : data.messages;
    if (!Array.isArray(msgs)) throw new Error("El JSON no contiene 'messages'");
    messages.length = 0;
    $("chat").innerHTML = "";
    currentSessionId = null;
    for (const m of msgs) {
      if (!m.role || !m.content) continue;
      messages.push({ role: m.role, content: m.content });
      addMsg(m.role, m.role === "user" ? esc(m.content) : renderMd(m.content));
    }
    sideMsg(`Conversación importada: ${messages.length} mensajes`);
  } catch (e) {
    sideMsg("Error al importar: " + e.message);
  }
  inp.value = "";
}

async function uploadFiles(inp) {
  if (!inp || !inp.files.length) { sideMsg("Elige archivos o una carpeta primero"); return; }
  const fd = new FormData();
  for (const f of inp.files) fd.append("files", f, f.webkitRelativePath || f.name);
  sideMsg(`Subiendo ${inp.files.length} archivos…`);
  try {
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.error) { sideMsg("Error: " + (d.error || r.statusText)); return; }
    sideMsg(`${d.count} archivos subidos a workspace/uploads/ — pide al asistente que analice esa carpeta`);
    inp.value = "";
    loadFiles();
  } catch (e) { sideMsg("Error de red al subir"); }
}
function uploadCode() { uploadFiles($("upCode")); }

async function cloneRepo() {
  const url = $("repoUrl").value.trim();
  if (!url) { sideMsg("Pega la URL del repo de GitHub"); return; }
  sideMsg("Clonando " + url + "…");
  try {
    const r = await api("/api/repo/clone", post({ url }));
    $("repoUrl").value = "";
    bootstrap.Modal.getOrCreateInstance($("addModal")).hide();
    loadFiles();
    sideMsg("Clonado en " + r.path + " — instalando…");
    try {
      const run = await api("/api/repo/run", post({ path: r.path }));
      sideMsg(`Listo: ${r.path} · ` +
        `<a href="${run.url}" target="_blank">abrir ${run.url}</a>`);
    } catch (e2) {
      sideMsg("Clonado en " + r.path + " (no se pudo ejecutar: " + e2.message + ")");
    }
  } catch (e) { sideMsg("Error: " + e.message); }
}

async function saveWorkspace() {
  const name = $("wsName").value.trim();
  if (!name) { sideMsg("Pon un nombre para la copia"); return; }
  try {
    await api("/api/workspace/save", post({ name }));
    sideMsg("Workspace guardado: " + name);
    $("wsName").value = "";
    loadSaved();
  } catch (e) { sideMsg("Error: " + e.message); }
}

async function loadSaved() {
  const list = $("savedList");
  if (!list) return;
  const { saved } = await api("/api/workspace/saved");
  list.innerHTML = saved.length
    ? saved.map((n) =>
      `<div class="list-group-item d-flex justify-content-between align-items-center bg-transparent py-1">` +
      `<span class="small">${esc(n)}</span>` +
      `<button class="btn btn-sm btn-outline-secondary py-0" onclick="restoreWs('${n}')">restaurar</button></div>`).join("")
    : '<span class="text-secondary small">sin copias guardadas</span>';
}

async function restoreWs(n) {
  if (!(await confirmModal("Restaurar workspace",
    `El contenido del workspace se reemplazará con la copia "${n}". ¿Continuar?`, "Restaurar"))) return;
  try {
    await api("/api/workspace/restore", post({ name: n }));
    sideMsg("Workspace restaurado: " + n);
    loadFiles();
  } catch (e) { sideMsg("Error: " + e.message); }
}

applyTheme(localStorage.getItem("theme") || "light");
loadSaved();
