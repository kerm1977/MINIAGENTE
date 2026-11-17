async function loadModels() {
  const sel = $("modelSelect"), base = $("newBase"), list = $("modelList");
  let models;
  try {
    const motor = typeof currentBackend === "function" ? currentBackend() : "ollama";
    ({ models } = await api("/api/models?backend=" + motor));
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
    if (motor !== "ollama") item.querySelector("button").remove();
    else item.querySelector("button").onclick = async () => {
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
