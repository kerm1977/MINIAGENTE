// Modo "Mejorar agente": chat separado cuyas órdenes actúan ÚNICA y
// exclusivamente sobre el código del propio agente (self_mode en el backend).
// No usa el archivo abierto en el editor ni el workspace del usuario.

const _mejoraMsgs = [];
let _mejoraBusy = false;
let _mejoraAbort = null;

function mejoraMsg(role, html) {
  const div = document.createElement("div");
  div.className = "msg msg-" + role;
  div.innerHTML = `<div class="role">${role === "user" ? "tú" : role}</div><div class="body">${html}</div>`;
  $("mejoraChat").appendChild(div);
  $("mejoraChat").scrollTop = $("mejoraChat").scrollHeight;
  return div.querySelector(".body");
}

async function diagnosticoAgente() {
  const body = mejoraMsg("assistant", '<span class="text-secondary">diagnosticando…</span>');
  try {
    const r = await api("/api/autoevolucionar");
    body.innerHTML = renderMd(r.reporte || "Sin novedad.");
  } catch (e) {
    body.innerHTML = `<div class="text-danger">${esc(e.message)}</div>`;
  }
}

async function sendMejora() {
  const inp = $("mejoraInput");
  const text = inp.value.trim();
  if (!text || _mejoraBusy) return;
  const model = $("modelSelect").value;
  if (!model) { sideMsg("Elige un modelo primero"); return; }
  _mejoraBusy = true;
  _mejoraAbort = new AbortController();
  inp.value = "";
  mejoraMsg("user", esc(text));
  const body = mejoraMsg("assistant", '<span class="text-secondary">pensando…</span>');
  let buf = "";
  try {
    const r = await fetch("/api/chat", { ...post({
      model,
      backend: typeof currentBackend === "function" ? currentBackend() : "ollama",
      messages: [..._mejoraMsgs, { role: "user", content: text }],
      self_mode: true,
      options: { num_ctx: parseInt($("genMem").value, 10) || 4096,
                 temperature: 0.3 },
    }), signal: _mejoraAbort.signal });
    _mejoraMsgs.push({ role: "user", content: text });
    const rd = r.body.getReader(), dec = new TextDecoder();
    let chunk = "";
    for (;;) {
      const { done, value } = await rd.read();
      if (done) break;
      chunk += dec.decode(value, { stream: true });
      const lines = chunk.split("\n"); chunk = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        let p; try { p = JSON.parse(line); } catch { continue; }
        if (p.error) { body.innerHTML += `<div class="text-danger">${esc(p.error)}</div>`; continue; }
        if (p.tool_results) {
          for (const t of p.tool_results) body.appendChild(toolChip(t.call, t.result));
          buf = ""; continue;
        }
        if (p.message && p.message.content) {
          buf += p.message.content;
          const parts = [...body.querySelectorAll(".toolchip")];
          body.innerHTML = renderMd(buf);
          parts.forEach((el) => body.appendChild(el));
          $("mejoraChat").scrollTop = $("mejoraChat").scrollHeight;
        }
      }
    }
    if (buf) _mejoraMsgs.push({ role: "assistant", content: buf });
  } catch (e) {
    if (e && e.name === "AbortError")
      body.innerHTML += '<div class="text-secondary small">— detenido —</div>';
    else
      body.innerHTML += `<div class="text-danger">${esc(e.message)}</div>`;
  }
  _mejoraBusy = false;
}

function stopMejora() { if (_mejoraAbort) _mejoraAbort.abort(); }

function wireMejora() {
  const inp = $("mejoraInput");
  if (!inp) return;
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMejora(); }
  });
  $("mejoraModal").addEventListener("shown.bs.modal", () => {
    if (!$("mejoraChat").children.length) diagnosticoAgente();
  });
}
