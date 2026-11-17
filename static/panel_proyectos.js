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
