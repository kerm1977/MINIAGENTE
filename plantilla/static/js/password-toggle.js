// Módulo independiente: "ojito" para ver/ocultar contraseñas.
// Se aplica solo a todo <input type="password">. No depende de otro código:
// si este archivo falla o se elimina, el resto de la app sigue funcionando.
(function () {
  const STYLE = `
    .pw-wrap{position:relative;display:flex;align-items:center;width:100%}
    .pw-wrap input{padding-right:2.6rem!important}
    .pw-eye{position:absolute;right:.4rem;top:50%;transform:translateY(-50%);
      border:none;background:transparent;cursor:pointer;font-size:1.15rem;
      color:inherit;opacity:.7;padding:.25rem;line-height:1}
    .pw-eye:hover{opacity:1}`;

  function injectStyle() {
    if (document.getElementById("pw-toggle-style")) return;
    const s = document.createElement("style");
    s.id = "pw-toggle-style";
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  function attach(input) {
    if (input.dataset.pwToggle) return;
    input.dataset.pwToggle = "1";
    const wrap = document.createElement("span");
    wrap.className = "pw-wrap";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pw-eye";
    btn.setAttribute("aria-label", "Mostrar contraseña");
    btn.innerHTML = '<i class="bi bi-eye"></i>';
    btn.addEventListener("click", () => {
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.innerHTML = show ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
      btn.setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña");
    });
    wrap.appendChild(btn);
  }

  function init() {
    try {
      injectStyle();
      document.querySelectorAll('input[type="password"]').forEach(attach);
    } catch (e) {
      console.warn("password-toggle:", e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
