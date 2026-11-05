// demo.js — extras do projeto Fazenda Demo
(function () {
  if (!window.IC_DEMO) return;

  // Botão "Resetar demo": apaga tudo que foi criado e volta à fazenda vazia
  const modal = document.createElement("div");
  modal.className = "demo-reset";
  modal.innerHTML = `
    <div class="demo-reset__box" role="dialog" aria-modal="true">
      <h4>Resetar demo?</h4>
      <p>Isso apaga a central, pivôs, carretéis e tudo que foi criado neste navegador, e volta para a Fazenda Demo vazia.</p>
      <div class="demo-reset__actions">
        <button type="button" data-demo-cancel>Cancelar</button>
        <button type="button" class="is-danger" data-demo-confirm>Resetar</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const close = () => modal.classList.remove("is-open");
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  modal.querySelector("[data-demo-cancel]").addEventListener("click", close);
  modal.querySelector("[data-demo-confirm]").addEventListener("click", () => {
    try {
      const keep = new Set(["ic:theme", "ic_sidebar_collapsed"]);
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
      keys.forEach((k) => { if (k && !keep.has(k)) localStorage.removeItem(k); });
      sessionStorage.clear();
    } catch (_) { }
    location.reload();
  });

  document.getElementById("btnDemoReset")?.addEventListener("click", (e) => {
    e.preventDefault();
    modal.classList.add("is-open");
  });

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
