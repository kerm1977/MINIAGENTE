// Menú hamburguesa superior + magic bar inferior (vista móvil).
(function () {
  const burger = document.getElementById("hamburger");
  const nav = document.getElementById("topnav");
  if (burger && nav) {
    burger.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      burger.setAttribute("aria-expanded", open);
      burger.querySelector("i").className = open ? "bi bi-x-lg" : "bi bi-list";
    });
  }

  const magicBtn = document.getElementById("magicToggle");
  const setMagic = (on) => {
    document.body.classList.toggle("magic-on", on);
    localStorage.setItem("magicbar", on ? "1" : "0");
  };
  setMagic(localStorage.getItem("magicbar") === "1");
  if (magicBtn) magicBtn.addEventListener("click", () => {
    setMagic(!document.body.classList.contains("magic-on"));
  });

  const here = location.pathname;
  document.querySelectorAll(".magicbar a").forEach((a) => {
    a.classList.toggle("active", a.getAttribute("href") === here);
  });
})();
