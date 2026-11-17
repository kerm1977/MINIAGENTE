// Selector de motor de IA (Ollama, LM Studio, llama.cpp, API OpenAI).
// El backend elegido se guarda en prefs y viaja en cada /api/chat.

function currentBackend() {
  const s = $("backendSelect");
  return (s && s.value) || "ollama";
}

async function loadBackends() {
  const sel = $("backendSelect");
  if (!sel) return;
  let items;
  try {
    ({ backends: items } = await api("/api/backends"));
  } catch (e) {
    sel.innerHTML = '<option value="ollama">Ollama</option>';
    return;
  }
  const prev = sel.value;
  sel.innerHTML = "";
  for (const b of items) {
    const opt = new Option(
      b.label + (b.ok ? "" : " (apagado)"), b.id);
    opt.title = b.detail || "";
    sel.add(opt);
  }
  const prefs = await loadPrefs();
  const wanted = _prefs.backend || prev || "ollama";
  if ([...sel.options].some((o) => o.value === wanted)) sel.value = wanted;
}

function wireBackendSelect() {
  const sel = $("backendSelect");
  if (!sel) return;
  sel.addEventListener("change", () => {
    savePref("backend", sel.value);
    loadModels();
    loadStatus();
    setModelTag();
  });
}
