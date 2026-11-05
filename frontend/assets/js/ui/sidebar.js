// sidebar.js
(function () {
  const app = document.querySelector(".app");
  const btn = document.getElementById("btnSidebarToggle");

  if (!app || !btn) return;

  // Carregar preferência
  const saved = localStorage.getItem("ic_sidebar_collapsed");
  if (saved === "1") app.classList.add("is-collapsed");

  btn.addEventListener("click", () => {
    app.classList.toggle("is-collapsed");
    localStorage.setItem("ic_sidebar_collapsed", app.classList.contains("is-collapsed") ? "1" : "0");

    // Notifica que o layout mudou (ex.: largura do mapa)
    window.dispatchEvent(new CustomEvent("ic:layout-change", {
      detail: { sidebarCollapsed: app.classList.contains("is-collapsed") }
    }));
  });

  // Mantém teu highlight de rota e fecha overlays abertos
  const items = document.querySelectorAll(".nav__item");
  items.forEach(item => {
    item.addEventListener("click", () => {
      if (item.hasAttribute("data-demo-locked")) return;
      items.forEach(i => i.classList.remove("is-active"));
      item.classList.add("is-active");

      // Fecha todos os overlays de edição/config ao navegar
      window.IcConfig?.close?.();
      window.IcFaturamento?.close?.();
      window.Pivos?.views?.edit?.close?.();
      window.Bmb?.views?.edit?.close?.();
      window.Mdn?.views?.edit?.close?.();
      window.IcLineStarEdit?.close?.();
    });
  });
})();
