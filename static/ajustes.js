/* Ajustes de apariencia: color de tema, modo claro/oscuro y tamaño de fuente. */
const TEMAS_DISPONIBLES = {
  naranja:  { nombre: "Naranja",   primary: "#f97316", primaryDark: "#ea580c" },
  lima:     { nombre: "Verde",     primary: "#a3e635", primaryDark: "#65a30d" },
  fucsia:   { nombre: "Rosa",      primary: "#f472b6", primaryDark: "#db2777" },
  celeste:  { nombre: "Azul",      primary: "#38bdf8", primaryDark: "#0284c7" },
  turquesa: { nombre: "Turquesa",  primary: "#2dd4bf", primaryDark: "#0d9488" },
  cafe:     { nombre: "Café",      primary: "#d6c9a8", primaryDark: "#a3925f" },
};

let escalaFuente = parseInt(localStorage.getItem("ma_font"), 10) || 18;
if (escalaFuente === 16) escalaFuente = 18;

function aplicarEscalaFuente() {
  escalaFuente = Math.max(12, Math.min(28, escalaFuente));
  document.documentElement.style.fontSize = escalaFuente + "px";
  localStorage.setItem("ma_font", escalaFuente);
  const el = document.getElementById("temaFuenteValor");
  if (el) el.textContent = escalaFuente + "px";
}

function cambiarEscala(delta) {
  escalaFuente += delta;
  aplicarEscalaFuente();
}

function aplicarColorTema(key) {
  const tema = TEMAS_DISPONIBLES[key] || TEMAS_DISPONIBLES.naranja;
  const root = document.documentElement;
  root.style.setProperty("--ma-primary", tema.primary);
  root.style.setProperty("--ma-primary-dark", tema.primaryDark);
  localStorage.setItem("ma_color", key);
  document.querySelectorAll(".tema-swatch").forEach((s) =>
    s.classList.toggle("activo", s.dataset.key === key));
  syncBotonesModo();
}

function setTemaModo(modo) {
  applyTheme(modo);
  syncBotonesModo();
}

function syncBotonesModo() {
  const oscuro = document.documentElement.getAttribute("data-bs-theme") === "dark";
  const bL = document.getElementById("btnThemeLight");
  const bD = document.getElementById("btnThemeDark");
  if (bL) bL.className = "btn btn-sm " + (oscuro ? "btn-outline-secondary" : "btn-primary");
  if (bD) bD.className = "btn btn-sm " + (oscuro ? "btn-primary" : "btn-outline-secondary");
}

function initAjustes() {
  const cont = document.getElementById("temaColores");
  if (cont) {
    cont.innerHTML = Object.entries(TEMAS_DISPONIBLES).map(([key, tema]) =>
      `<button type="button" class="tema-swatch" data-key="${key}" style="background-color:${tema.primaryDark}" title="${tema.nombre}" onclick="aplicarColorTema('${key}')">${tema.nombre[0]}</button>`
    ).join("");
  }
  aplicarEscalaFuente();
  aplicarColorTema(localStorage.getItem("ma_color") || "naranja");
  syncBotonesModo();
}

initAjustes();
