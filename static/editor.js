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

// Contexto del editor para el chat: archivo abierto y su contenido actual.
function editorContexto() {
  if (!edFile) return null;
  return { path: edFile, dir: edDir, content: edText() };
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
