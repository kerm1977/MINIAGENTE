// Validaciones en el navegador (espejo de validators.py).
// Uso: <form data-validar> con inputs data-rule="nombre|telefono|email|password".
(function () {
  const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;
  const FAKE_DOMAINS = ["example.com", "test.com", "mailinator.com", "tempmail.com",
    "10minutemail.com", "guerrillamail.com", "yopmail.com", "fake.com"];

  const titleCase = (v) => v.toLowerCase().replace(/(^|\s)(\p{L})/gu,
    (m, sp, ch) => sp + ch.toUpperCase());

  const rules = {
    nombre: {
      filter: (v) => titleCase(v.replace(/[^\p{L}\s'.-]/gu, "").replace(/\s{2,}/g, " ")),
      check: (v) => v.trim() ? "" : "Campo obligatorio",
    },
    telefono: {
      filter: (v) => v.replace(/(?!^\+)[^\d]/g, "").slice(0, 16),
      check: (v) => /^\+?\d{7,15}$/.test(v) ? "" : "Solo números (7 a 15 dígitos)",
    },
    email: {
      filter: (v) => v.toLowerCase().replace(/\s/g, ""),
      check: (v) => {
        if (!EMAIL_RE.test(v)) return "Correo inválido: usuario@dominio.com";
        const dom = v.split("@")[1];
        if (FAKE_DOMAINS.includes(dom)) return "Usa un correo real, no temporal";
        if (/\.\./.test(v)) return "Correo inválido";
        return "";
      },
    },
    password: {
      filter: (v) => v,
      check: (v) => !v ? "" : (v.length >= 8 && /[a-z]/i.test(v) && /\d/.test(v))
        ? "" : "Mínimo 8 caracteres con letras y números",
    },
  };

  function showError(input, msg) {
    let small = input.closest("label")?.querySelector("small.err-js");
    if (!small && input.closest("label")) {
      small = document.createElement("small");
      small.className = "err err-js";
      input.closest("label").appendChild(small);
    }
    if (small) small.textContent = msg;
    input.classList.toggle("invalid", !!msg);
  }

  function bind(input) {
    const rule = rules[input.dataset.rule];
    if (!rule) return;
    input.addEventListener("input", () => {
      const pos = input.selectionStart;
      const before = input.value;
      input.value = rule.filter(input.value);
      if (input.type !== "email" && before.length === input.value.length) {
        try { input.setSelectionRange(pos, pos); } catch (e) { /* noop */ }
      }
    });
    input.addEventListener("blur", () => showError(input, rule.check(input.value)));
  }

  function init() {
    document.querySelectorAll("[data-rule]").forEach(bind);
    document.querySelectorAll("form[data-validar]").forEach((form) => {
      form.addEventListener("submit", (e) => {
        let ok = true;
        form.querySelectorAll("[data-rule]").forEach((input) => {
          const rule = rules[input.dataset.rule];
          input.value = rule.filter(input.value);
          let msg = rule.check(input.value);
          if (!msg && input.required && !input.value.trim()) msg = "Campo obligatorio";
          showError(input, msg);
          if (msg) ok = false;
        });
        if (!ok) e.preventDefault();
        else if (!form.getAttribute("method")) {
          e.preventDefault();
          alert("Formulario válido ✔");
        }
      });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
