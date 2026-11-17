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
