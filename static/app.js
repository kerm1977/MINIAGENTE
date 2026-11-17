const messages = [];
let sending = false;
let currentSessionId = null;
let abortCtrl = null;

function renderMd(text) {
  let html = esc(text);
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
    `<div class="codeblock"><div class="codehead"><span>${lang === "tool" ? "json" : (lang || "code")}</span>` +
    `<button class="btn btn-sm btn-outline-secondary copy-btn">copiar</button>` +
    `<button class="btn btn-sm btn-outline-secondary save-btn">guardar</button></div>` +
    `<pre><code>${code.replace(/\n$/, "")}</code></pre></div>`);
  html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  return html.replace(/\n/g, "<br>");
}

function addMsg(role, html) {
  const div = document.createElement("div");
  div.className = "msg msg-" + role;
  div.innerHTML = `<div class="role">${role === "user" ? "tú" : role}</div><div class="body">${html}</div>`;
  $("chat").appendChild(div);
  $("chat").scrollTop = $("chat").scrollHeight;
  return div.querySelector(".body");
}

function toolChip(call, result) {
  const el = document.createElement("div");
  el.className = "toolchip " + (result.ok ? "ok" : "fail");
  const detail = result.error || result.path || result.command ||
    (result.tree ? result.tree.slice(0, 40).join("\n") : "") ||
    (result.stdout || "").slice(0, 300) || JSON.stringify(result).slice(0, 200);
  el.innerHTML = `<i class="bi bi-wrench"></i> <b>${esc(call.tool)}</b> ` +
    `<code>${esc(call.path || call.command || "")}</code>` +
    `<pre class="mb-0 mt-1 small">${esc(String(detail))}</pre>`;
  return el;
}

async function ensureSession(title, model) {
  if (currentSessionId) return currentSessionId;
  const r = await api("/api/sessions", post({ title: title.slice(0, 60), model }));
  currentSessionId = r.id;
  loadSessions();
  return r.id;
}

// Guardado continuo en SQLite para no perder nada si se cierra o se va la luz.
async function persistSession() {
  if (!currentSessionId || !messages.length) return;
  try {
    await api(`/api/sessions/${currentSessionId}/messages`, post({ messages }));
  } catch (e) { /* reintenta en el siguiente cambio */ }
}

let queue = [];
let tokT0 = 0;

async function send(fixedText) {
  if (typeof dictando === "function" && dictando()) await stopDictado();
  const text = fixedText != null ? fixedText : $("prompt").value.trim();
  const model = $("modelSelect").value;
  if (!text) return;
  if (!model) { sideMsg("No hay modelo seleccionado — instala uno del catálogo gratuito"); return; }
  if (sending) {
    queue.push(text);
    if (fixedText == null) $("prompt").value = "";
    addMsg("user", esc(text));
    return;
  }
  sending = true;
  abortCtrl = new AbortController();
  setSendUI(true);
  if (fixedText == null) $("prompt").value = "";
  addMsg("user", esc(text));
  const sid = await ensureSession(text, model).catch(() => null);
  const body = addMsg("assistant", '<span class="text-secondary">pensando…</span>');
  let buf = "";
  try {
    const preset = $("genPreset").value;
    const presets = {
      rapido:   { num_predict: 128,  temperature: 0.1 },
      moderado: { num_predict: 1024, temperature: 0.4 },
      avanzado: { num_predict: -1,   temperature: 0.6 },
    };
    const options = {
      num_ctx: parseInt($("genMem").value, 10),
      ...presets[preset],
    };
    const maxTok = $("genMaxTok") ? $("genMaxTok").value : "";
    if (maxTok !== "") options.num_predict = parseInt(maxTok, 10);
    const thr = $("genThreads") ? $("genThreads").value : "";
    if (thr !== "") options.num_thread = parseInt(thr, 10);
    else if ($("genDevice").value === "cpu") options.num_thread = preset === "rapido" ? 8 : 4;
    const r = await fetch("/api/chat", { ...post({
      model,
      messages: [...messages, { role: "user", content: text }],
      session_id: sid,
      root_mode: $("rootMode").checked,
      options,
    }), signal: abortCtrl.signal });
    messages.push({ role: "user", content: text });
    tokT0 = Date.now();
    const tc0 = $("tokCount");
    if (tc0) { tc0.classList.remove("d-none"); tc0.textContent = "0 tok"; }
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
        if (p.error) {
          let txt = p.error;
          if (/does not support chat/i.test(txt))
            txt += " — ese modelo es de embeddings y no sirve para conversar; elige otro en la nube ☁.";
          body.innerHTML += `<div class="text-danger">${esc(txt)}</div>`;
          continue;
        }
        if (p.tool_results) {
          for (const t of p.tool_results) body.appendChild(toolChip(t.call, t.result));
          markEdited(p.tool_results.map((t) => t.call && t.call.path).filter(Boolean));
          buf = ""; loadFiles(); continue;
        }
        if (p.message && p.message.content) {
          buf += p.message.content;
          body.innerHTML = renderMd(buf);
          const el = $("tokCount");
          if (el) {
            const s = (Date.now() - tokT0) / 1000;
            el.classList.remove("d-none");
            el.textContent = `~${Math.round(buf.length / 4)} tok · ${(buf.length / 4 / s).toFixed(1)} tok/s`;
          }
          $("chat").scrollTop = $("chat").scrollHeight;
        }
      }
    }
    if (buf) messages.push({ role: "assistant", content: buf });
    persistSession();
  } catch (e) {
    if (e && e.name === "AbortError") {
      body.innerHTML += `<div class="text-secondary small">— detenido —</div>`;
      if (messages.length && messages[messages.length - 1].role === "user") messages.pop();
      $("prompt").value = text;
    } else {
      body.innerHTML += `<div class="text-danger">${esc(e.message)}</div>`;
    }
  }
  abortCtrl = null;
  setSendUI(false);
  sending = false;
  if (editedPaths.size) {
    const names = [...editedPaths].join(", ");
    body.innerHTML += `<div class="text-success small mt-1">✔ ha finalizado la edición de los archivos: ${esc(names)}</div>`;
  }
  if (queue.length) send(queue.shift());
}

function setSendUI(on) {
  const s = $("sendBtn"), t = $("stopBtn");
  if (s) s.classList.toggle("d-none", on);
  if (t) t.classList.toggle("d-none", !on);
}

function stopGen() {
  if (abortCtrl) abortCtrl.abort();
}

/* Modal de confirmación genérico (reemplaza confirm()/alert()). */
function confirmModal(title, text, yesLabel) {
  return new Promise((res) => {
    $("confirmTitle").textContent = title;
    $("confirmBody").textContent = text;
    $("confirmYes").textContent = yesLabel || "Eliminar";
    const m = new bootstrap.Modal($("confirmModal"));
    $("confirmYes").onclick = () => { m.hide(); res(true); };
    $("confirmNo").onclick = () => { m.hide(); res(false); };
    $("confirmModal").addEventListener("hidden.bs.modal", () => res(false), { once: true });
    m.show();
  });
}

/* Limpieza de conversación con confirmación en 3 pasos. */
const CLEAR_STEPS = [
  { t: "¿Seguro que quieres limpiar la conversación?", back: false },
  { t: "Se borrarán los mensajes visibles (la sesión guardada no se elimina).", back: true },
  { t: "Última confirmación: esta acción no se puede deshacer.", back: true },
];
let clearStepN = 1, clearModal = null;

function clearChat() {
  clearStepN = 1;
  renderClearStep();
  (clearModal || (clearModal = new bootstrap.Modal($("clearModal")))).show();
}

function renderClearStep() {
  const s = CLEAR_STEPS[clearStepN - 1];
  $("clearTitle").textContent = `Limpiar conversación — paso ${clearStepN} de 3`;
  $("clearBody").textContent = s.t;
  $("clearFoot").innerHTML =
    (s.back ? '<button class="btn btn-outline-secondary btn-sm" onclick="clearStep(-1)">← Atrás</button>' : "") +
    '<button class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">Cancelar</button>' +
    (clearStepN < 3
      ? '<button class="btn btn-primary btn-sm" onclick="clearStep(1)">Continuar →</button>'
      : '<button class="btn btn-danger btn-sm" onclick="doClear()">Sí, limpiar todo</button>');
}

function clearStep(d) {
  clearStepN = Math.min(3, Math.max(1, clearStepN + d));
  renderClearStep();
}

async function doClear() {
  messages.length = 0;
  $("chat").innerHTML = "";
  clearModal.hide();
  if (currentSessionId) {
    const sid = currentSessionId;
    currentSessionId = null;
    try { await api("/api/sessions/" + sid, { method: "DELETE" }); } catch {}
    loadSessions();
  }
}

$("chat").addEventListener("click", async (e) => {
  const btn = e.target.closest(".copy-btn, .save-btn");
  if (!btn) return;
  const code = btn.closest(".codeblock").querySelector("code").textContent;
  if (btn.classList.contains("copy-btn")) {
    await navigator.clipboard.writeText(code);
    btn.textContent = "copiado"; setTimeout(() => (btn.textContent = "copiar"), 1200);
  } else {
    const lang = btn.closest(".codeblock").querySelector(".codehead span").textContent;
    await api("/api/snippets", post({ session_id: currentSessionId, lang, content: code }));
    btn.textContent = "guardado"; setTimeout(() => (btn.textContent = "guardar"), 1200);
  }
});
let emojiLoaded = false;
async function toggleEmoji() {
  const panel = $("emojiPanel");
  panel.classList.toggle("d-none");
  if (panel.classList.contains("d-none") || emojiLoaded) return;
  emojiLoaded = true;
  const { packs } = await api("/api/emojis");
  const tabs = $("emojiTabs");
  packs.forEach((p, i) => {
    const b = document.createElement("button");
    b.className = "btn btn-sm btn-outline-secondary py-0";
    b.textContent = p.label;
    b.onclick = () => loadEmojiPack(p.id);
    tabs.appendChild(b);
    if (i === 0) loadEmojiPack(p.id);
  });
}

async function loadEmojiPack(id) {
  const p = await api("/api/emojis/" + id);
  const grid = $("emojiGrid");
  grid.innerHTML = "";
  for (const e of p.emojis) {
    const b = document.createElement("button");
    b.className = "btn btn-sm btn-outline-secondary emoji-btn";
    b.textContent = e;
    b.onclick = () => { $("prompt").value += e; $("prompt").focus(); };
    grid.appendChild(b);
  }
}

$("prompt").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
});

/* Prueba de rendimiento del modelo activo: envía ping y mide tok/s. */
async function benchModel() {
  const model = $("modelSelect").value;
  const tag = $("modelTag");
  if (!model || !tag) return;
  const cfg = `${$("genPreset").value} · ${$("genMem").selectedOptions[0].textContent} · ${$("genDevice").value}`;
  tag.textContent = `probando ${model} (${cfg})…`;
  const t0 = performance.now();
  let n = 0, first = 0;
  try {
    const r = await fetch("/api/chat", { ...post({
      model, messages: [{ role: "user", content: "Responde solo: OK" }],
      options: { num_ctx: parseInt($("genMem").value, 10), num_predict: 32, temperature: 0 },
    }) });
    const rd = r.body.getReader(), dec = new TextDecoder();
    for (;;) {
      const { done, value } = await rd.read();
      if (done) break;
      for (const line of dec.decode(value, { stream: true }).split("\n")) {
        if (!line.trim()) continue;
        let p; try { p = JSON.parse(line); } catch { continue; }
        if (p.message && p.message.content) {
          if (!first) first = performance.now();
          n += p.message.content.split(/\s+/).length;
        }
      }
    }
    const secs = (performance.now() - t0) / 1000;
    const ttft = first ? ((first - t0) / 1000).toFixed(1) : "?";
    tag.textContent = `${model} · ${cfg} · ~${Math.max(1, Math.round(n / secs))} tok/s (1er token ${ttft}s)`;
    setTimeout(setModelTag, 8000);
  } catch (e) {
    tag.textContent = `prueba falló: ${e.message}`;
    setTimeout(setModelTag, 5000);
  }
}

$("modelTag").onclick = benchModel;

/* Analiza el hardware y aplica la config recomendada. */
let hwCache = null;

let hwPage = 0;

async function recommendModels() {
  const hw = $("hwInfo");
  if (!hwCache || !hw) return;
  const preset = $("genPreset").value;
  const budget = (hwCache.ram_gb || 8) * 0.6; // deja RAM libre para el SO
  const cap = { rapido: 4, moderado: 8, avanzado: 99 }[preset] || 4;
  try {
    const { catalog } = await api("/api/catalog");
    const fits = catalog
      .filter((m) => {
        if (/bge|embed|nomic|mxbai|gte-|minilm|paraphrase|granite-embedding|starcoder|codegemma|codellama.*-code|deepseek-coder.*-base|-ocr|guardian|guard3|shieldgemma|safeguard|minicheck|-audio|firefunction|tool-use|nexusraven|functiongemma|nuextract|reader-lm|meditron|medllama|medgemma|mathstral|-math|translategemma|stable-code|nsql|smollm2:135m|tinyllama|orca-mini|llama2\b|yarn-|falcon\b|stablelm-zephyr|stable-beluga|vicuna|wizard-vicuna|dolphin-phi|neural-chat|open-orca|platypus|everythinglm|duckdb|bakllava|sailor2|samantha|notux|notus|megadolphin|ornith|phonon|alfred|beam|clef|flint|kev|laya|bonsai|inkling|laguna|nimble|d1\b|d3|tev1|rnj|ripple|muse-|autotrust|athene/i.test(m.name)) return false;
        const need = m.ram_gb || (m.size_gb ? m.size_gb * 1.5 : estRamGb(m.name));
        return need <= Math.min(budget, cap);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    renderHwModels(fits);
  } catch { /* silencioso */ }
}

function estRamGb(name) {
  const m = name.match(/[:_-](\d+(?:\.\d+)?)(b|m)\b/i);
  if (!m) return 99;
  const n = parseFloat(m[1]);
  return m[2].toLowerCase() === "b" ? n * 1.2 : n * 0.0012;
}

function renderHwModels(fits) {
  const PER = 5;
  const pages = Math.max(1, Math.ceil(fits.length / PER));
  hwPage = Math.min(hwPage, pages - 1);
  const items = fits.slice(hwPage * PER, hwPage * PER + PER);
  const box = $("hwModels");
  box.innerHTML = '<hr class="my-2"><div class="fw-bold mb-1">modelos ideales</div>' +
    (fits.length
      ? '<ul class="mb-1 ps-3">' + items.map((m) =>
          `<li><span class="hw-model ${m.installed ? "text-success" : ""}" ` +
          `role="button" style="cursor:pointer" data-name="${esc(m.name)}" ` +
          `title="${m.installed ? "instalado" : "clic para instalar"}">${esc(m.name)}</span>` +
          ` <span class="text-secondary">${m.tag || ""} · ${m.size_gb ? m.size_gb + " GB" : estGb(m.name)}</span></li>`
        ).join("") + "</ul>"
      : '<div class="text-secondary">ningún modelo del catálogo cabe en esta config</div>') +
    (pages > 1
      ? `<div class="d-flex justify-content-center align-items-center gap-1 mt-1">` +
        `<button class="btn btn-sm btn-outline-secondary py-0 hw-pg" data-pg="${hwPage - 1}" ${hwPage === 0 ? "disabled" : ""}>‹</button>` +
        Array.from({ length: Math.min(pages, 7) }, (_, i) => {
          const pg = Math.max(0, Math.min(hwPage - 3, pages - Math.min(pages, 7))) + i;
          return `<button class="btn btn-sm py-0 hw-pg ${pg === hwPage ? "btn-primary" : "btn-outline-secondary"}" data-pg="${pg}">${pg + 1}</button>`;
        }).join("") +
        `<button class="btn btn-sm btn-outline-secondary py-0 hw-pg" data-pg="${hwPage + 1}" ${hwPage >= pages - 1 ? "disabled" : ""}>›</button>` +
        `</div><div class="text-center text-secondary mt-1">${fits.length} modelos</div>`
      : `<div class="text-center text-secondary">${fits.length} modelos</div>`);
  for (const el of box.querySelectorAll(".hw-model")) {
    if (el.classList.contains("text-success")) continue;
    el.onclick = () => {
      const wrap = document.createElement("div");
      wrap.innerHTML =
        `<div class="progress pull-progress" style="height:6px">` +
        `<div class="progress-bar progress-bar-striped progress-bar-animated" style="width:0%"></div></div>` +
        `<div class="small text-secondary pull-status"></div>`;
      box.appendChild(wrap);
      pullByName(el.dataset.name, wrap).then(() => { recommendModels(); loadModels(); });
    };
  }
  for (const el of box.querySelectorAll(".hw-pg")) {
    el.onclick = (e) => { e.preventDefault(); hwPage = parseInt(el.dataset.pg, 10); recommendModels(); };
  }
}

async function analyzeHw() {
  const hw = $("hwInfo");
  hw.textContent = "analizando…";
  try {
    const { info, recomendado: r } = await api("/api/hwinfo");
    hwCache = info;
    savePref("hwinfo", JSON.stringify(info));
    const thrSel = $("genThreads");
    if (![...thrSel.options].some((o) => o.value === String(r.threads)))
      thrSel.add(new Option(String(r.threads), String(r.threads)));
    thrSel.value = String(r.threads); savePref("threads", r.threads);
    $("genMem").value = r.mem; savePref("mem", r.mem);
    $("genDevice").value = r.device; savePref("device", r.device);
    $("genPreset").value = r.preset; savePref("preset", r.preset);
    hw.innerHTML = `${esc(info.cpu)} · ${info.cores} núcleos · ${info.ram_gb || "?"} GB RAM` +
      (info.gpu ? ` · GPU ${esc(info.gpu)}` : " · sin GPU") +
      `<br>aplicado: ${r.preset} · ${r.threads} hilos · mem ${r.mem}`;
    setModelTag();
    await recommendModels();
  } catch (e) {
    hw.textContent = "error: " + e.message;
  }
}

$("genPanel").addEventListener("change", recommendModels);

loadStatus();
loadPrefs().then(() => {
  wireGenPrefs(); loadModels();
  if (_prefs.hwinfo) { try { hwCache = JSON.parse(_prefs.hwinfo); } catch {} }
  restoreEditor();
});
loadCatalog(); loadSessions(); loadFiles(); loadProjects(); renderPrecreados();
checkNewModels(); setInterval(checkNewModels, 300000);
setInterval(loadStatus, 15000);
