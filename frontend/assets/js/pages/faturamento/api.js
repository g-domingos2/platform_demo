// Aba "API" do Faturamento: mostra a chave da API da fazenda.
// A chave é automática (ver apiKeyPlan em data.js): existe só com API Irricontrol One contratada,
// é gerada ao salvar a contratação e uma nova é gerada sempre que a contratação muda.
// O usuário não gera nem regenera a chave sozinho; aqui só consulta e copia.
(function () {
  "use strict";

  const D = () => window.IcBillingData;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ui = { visible: false };

  function render() {
    const box = $("fbillApi");
    if (!box || !D()) return;
    const entry = D().getApiKey();
    const api = D().getContract().find((r) => r.key === "api");
    const count = api ? api.contracted : 0;

    let body;
    if (!entry) {
      // Sem chave: ou não há API contratada, ou a contratação pendente ainda será salva.
      body = D().apiKeyPlan() === "generate"
        ? `<div class="fbill-empty"><i class="fa-solid fa-key"></i><div class="fbill-empty__text">A chave será gerada ao salvar.</div></div>`
        : `<div class="fbill-empty"><i class="fa-solid fa-key"></i>
             <div class="fbill-empty__text">Nenhuma API contratada.</div>
             <p class="fbill-hint">Inscreva a API Irricontrol One em pelo menos um equipamento na aba Assinatura para receber a chave de acesso.</p>
           </div>`;
    } else {
      const k = entry.key;
      const shown = ui.visible ? k : k.slice(0, 8) + "•".repeat(24) + k.slice(-4);
      body = `
        <div class="fbill-apikey__count">${esc(D().tr(count === 1 ? "API contratada em {n} equipamento" : "API contratada em {n} equipamentos", { n: count }))}</div>
        <div class="fbill-apikey">
          <input class="edit-panel__input fbill-apikey__input" type="text" readonly value="${esc(shown)}" aria-label="Chave da API">
          <button type="button" class="fbill-btn fbill-btn--neutral" data-apikey="toggle" aria-label="${ui.visible ? "Ocultar chave" : "Mostrar chave"}"><i class="fa-solid ${ui.visible ? "fa-eye-slash" : "fa-eye"}"></i></button>
          <button type="button" class="fbill-btn fbill-btn--outline-primary" data-apikey="copy"><i class="fa-regular fa-copy"></i> Copiar</button>
        </div>
        <div class="fbill-apikey__meta">${esc(D().tr("Gerada em {d}", { d: D().fmtLong(new Date(entry.createdAt)) }))}</div>
        <p class="fbill-hint">Uma nova chave é gerada automaticamente sempre que a assinatura é alterada.</p>`;
    }

    box.innerHTML = `
      <div class="fbill-card fbill-card--apikey">
        <div class="fbill-card__head">
          <h3 class="fbill-card__title"><i class="fa-solid fa-key"></i> Chave da API</h3>
        </div>
        <p class="fbill-hint fbill-hint--top">A chave dá acesso aos dados da fazenda pela API Irricontrol One. Guarde-a em segredo e não a compartilhe.</p>
        ${body}
      </div>`;
  }

  function onClick(e) {
    const action = e.target.closest("[data-apikey]")?.dataset.apikey;
    if (!action) return;
    if (action === "toggle") {
      ui.visible = !ui.visible;
      render();
    } else if (action === "copy") {
      const entry = D().getApiKey();
      const done = () => (window.IcNotify?.success || alert)("Copiado para a área de transferência.");
      if (entry && navigator.clipboard?.writeText) navigator.clipboard.writeText(entry.key).then(done, () => {});
      else done();
    }
  }

  function bind() {
    const box = $("fbillApi");
    if (!box || box.dataset.bound) return;
    box.dataset.bound = "1";
    box.addEventListener("click", onClick);
  }

  window.IcFaturamentoApi = {
    render() { bind(); render(); },
    reset() { ui.visible = false; },
  };
})();
