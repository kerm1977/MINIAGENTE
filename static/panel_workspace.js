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
