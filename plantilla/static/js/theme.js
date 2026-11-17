// Modo claro/oscuro (guardado en localStorage).
(function () {
  const root = document.documentElement;
  const btn = document.getElementById("themeToggle");
  const apply = (t) => {
    root.setAttribute("data-theme", t);
    root.setAttribute("data-bs-theme", t);
    if (btn) btn.querySelector("i").className = t === "dark" ? "bi bi-sun" : "bi bi-moon-stars";
  };
  apply(localStorage.getItem("theme") || "light");
  if (btn) btn.addEventListener("click", () => {
    const t = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    localStorage.setItem("theme", t);
    apply(t);
  });
})();
