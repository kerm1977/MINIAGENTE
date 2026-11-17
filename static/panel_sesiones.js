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
