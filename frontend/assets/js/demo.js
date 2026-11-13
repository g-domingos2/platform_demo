// demo.js — extras do projeto Fazenda Demo
(function () {
  if (!window.IC_DEMO) return;

  // Rádio da central editável em "Editar fazenda" (na demo a central é criada do zero)
  document.addEventListener("click", (e) => {
    const clear = e.target.closest("#farmEditPanel .farm-radio-clear");
    if (!clear) return;
    const input = clear.closest(".sc-input-group")?.querySelector("input");
    if (input) { input.value = ""; input.focus(); }
  });
  document.addEventListener("input", (e) => {
    if (e.target?.id !== "farmEditCentralRadio") return;
    const el = e.target;
    const v = el.value.toUpperCase().replace(/[^0-9A-F]/g, "").slice(0, 16);
    if (v !== el.value) el.value = v;
  });
})();
