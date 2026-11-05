// assets/js/pages/estacoes/modal.js
// Modal flutuante sobre o mapa — mesma ideia do IcCosmofieldModal: mostra o
// essencial da estação meteorológica sem sair da visão geral. ETo e Chuva do
// dia em destaque (são os dados prioritários da análise). Botão "Detalhes"
// leva para a tela completa.
(function () {
  "use strict";

  const { escapeHtml } = window.IcGeo;
  const t = (text) => window.IcI18n?.t?.(text) ?? text;

  const ETO_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3c-.6.7-.6 1.6 0 2.3s.6 1.6 0 2.3"/><path d="M11.7 3c-.6.7-.6 1.6 0 2.3s.6 1.6 0 2.3"/><path d="M15.4 3c-.6.7-.6 1.6 0 2.3s.6 1.6 0 2.3"/><path d="M12 19.5c-.2-3 1.3-5.8 4.8-6.4.2 3-1.3 5.8-4.8 6.4Z"/><path d="M12 19.5c.1-2.5-1.2-4.6-3.9-5-.1 2.5 1.2 4.6 3.9 5Z"/><path d="M12 19.5V15"/><path d="M4 19.5h16"/><path d="M9 22h6"/></svg>';
  const HUM_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5S12.5 5.5 12 3c-.5 2.5-2 4.9-4 6.5S5 13 5 15a7 7 0 0 0 7 7Z"/></svg>';

  const num = (v) => {
    const raw = String(v ?? "").trim();
    if (!raw) return null;
    const n = Number(raw.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };
  const f1 = (v) => (v === null ? "—" : v.toFixed(1));
  const f2 = (v) => (v === null ? "—" : v.toFixed(2));
  const f0 = (v) => (v === null ? "—" : String(Math.round(v)));

  window.IcEstacaoModal = {
    open({ name = "Estação Meteorológica", equipId, data = {} } = {}) {
      const MODAL_ID = "icEstacaoFloatModal";
      if (document.getElementById(MODAL_ID)) return;

      if (!document.getElementById("icEstdFloatStyles")) {
        const style = document.createElement("style");
        style.id = "icEstdFloatStyles";
        style.textContent = `
          #icEstacaoFloatModal { position:fixed;inset:0;z-index:23000;display:flex;align-items:center;justify-content:center;padding:16px; }
          #icEstacaoFloatModal .ic-estd-backdrop { position:absolute;inset:0;background:rgba(15,23,42,.4);backdrop-filter:blur(3px); }
          #icEstacaoFloatModal .ic-estd-dialog { position:relative;background:#fff;width:100%;max-width:420px;border-radius:12px;box-shadow:0 20px 40px -8px rgba(0,0,0,.2);display:flex;flex-direction:column;animation:icEstdUp .25s ease-out; }
          @keyframes icEstdUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
          #icEstacaoFloatModal .ic-estd-header { padding:14px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f1f5f9;gap:8px; }
          #icEstacaoFloatModal .ic-estd-title { margin:0;font-size:16px;font-weight:600;color:#0f172a;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
          #icEstacaoFloatModal .ic-estd-offline { display:flex;align-items:center;gap:9px;padding:10px 12px;border-radius:8px;border-left:3px solid #94a3b8;background:rgba(148,163,184,.16);font-size:12.5px;font-weight:600;color:#475569; }
          #icEstacaoFloatModal .ic-estd-offline i { color:#64748b;font-size:14px;flex-shrink:0; }
          [data-theme="dark"] #icEstacaoFloatModal .ic-estd-offline { background:rgba(148,163,184,.18);color:#cbd5e1; }
          #icEstacaoFloatModal .ic-estd-close { background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;width:24px;height:24px;display:flex;align-items:center;justify-content:center; }
          #icEstacaoFloatModal .ic-estd-close:hover { color:#475569; }
          #icEstacaoFloatModal .ic-estd-content { padding:16px 20px 20px;display:flex;flex-direction:column;gap:14px; }
          #icEstacaoFloatModal .ic-estd-priority { display:grid;grid-template-columns:1fr 1fr;gap:10px; }
          #icEstacaoFloatModal .ic-estd-priority__item { background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;text-align:center; }
          #icEstacaoFloatModal .ic-estd-priority__label { font-size:11px;color:#166534;font-weight:600;display:flex;align-items:center;justify-content:center;gap:6px; }
          #icEstacaoFloatModal .ic-estd-priority__value { font-size:24px;font-weight:700;color:#15803d;line-height:1.1;margin-top:4px; }
          #icEstacaoFloatModal .ic-estd-priority__value small { font-size:13px;font-weight:600;color:#4d7c56; }
          #icEstacaoFloatModal .ic-estd-rows { display:grid;grid-template-columns:1fr 1fr;gap:12px 16px; }
          #icEstacaoFloatModal .ic-estd-row { display:flex;flex-direction:column;align-items:center;gap:2px;font-size:12.5px;text-align:center; }
          #icEstacaoFloatModal .ic-estd-row-label { color:#64748b;display:flex;align-items:center;justify-content:center;gap:6px;font-size:11px; }
          #icEstacaoFloatModal .ic-estd-row-label svg,#icEstacaoFloatModal .ic-estd-row-label i { width:13px;color:#94a3b8;flex-shrink:0; }
          #icEstacaoFloatModal .ic-estd-row-value { color:#0f172a;font-weight:600;font-size:14px; }
          #icEstacaoFloatModal .ic-estd-foot { padding-top:12px;border-top:1px solid #f1f5f9;font-size:11.5px;color:#94a3b8; }

          [data-theme="dark"] #icEstacaoFloatModal .ic-estd-dialog { background:#141414;box-shadow:0 20px 40px -8px rgba(0,0,0,.6); }
          [data-theme="dark"] #icEstacaoFloatModal .ic-estd-header { border-bottom-color:rgba(255,255,255,.08); }
          [data-theme="dark"] #icEstacaoFloatModal .ic-estd-title { color:#f1f5f9; }
          [data-theme="dark"] #icEstacaoFloatModal .ic-estd-row-value { color:#f1f5f9; }
          [data-theme="dark"] #icEstacaoFloatModal .ic-estd-priority__item { background:rgba(34,197,94,.12);border-color:rgba(34,197,94,.3); }
          [data-theme="dark"] #icEstacaoFloatModal .ic-estd-foot { border-top-color:rgba(255,255,255,.08); }
        `;
        document.head.appendChild(style);
      }

      const status = String(data.status || "").toLowerCase();
      const offline = data.semComunicacao === true || status === "offline";
      const c = (data.current && typeof data.current === "object") ? data.current : {};

      const eto = num(c.eto);
      const rainDay = num(c.rainDay);
      const temp = num(c.temperature);
      const humidity = num(c.humidity);
      const windSpeed = num(c.windSpeed);
      const radiation = num(c.solarRadiation);
      const radiationDay = num(c.solarRadiationDay);
      const radTxt = radiation !== null
        ? `${f0(radiation)} W/m²`
        : (radiationDay !== null ? `${f1(radiationDay)} MJ/m²` : "—");

      const lastComm = data.updated
        ? new Date(data.updated).toLocaleString(window.IcI18n?.getLocale?.() || "pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).replace(".", "")
        : "—";

      // Mesma disposição do card de equipamentos (view.render.js): ETo e Chuva
      // do dia em destaque, seguidos de Temperatura, Umidade, Vento e Radiação.
      const rows = [
        ['<i class="fa-solid fa-temperature-half"></i>', t("Temperatura"), temp === null ? "—" : `${f1(temp)} °C`],
        [HUM_ICON, t("Umidade"), humidity === null ? "—" : `${f0(humidity)} %`],
        ['<i class="fa-solid fa-wind"></i>', t("Vento"), windSpeed === null ? "—" : `${f1(windSpeed)} m/s`],
        ['<i class="fa-solid fa-sun"></i>', t("Radiação"), radTxt],
      ].map(([ico, l, v]) => `
        <div class="ic-estd-row"><span class="ic-estd-row-label">${ico} ${l}</span><span class="ic-estd-row-value">${v}</span></div>`).join("");

      const el = document.createElement("div");
      el.id = MODAL_ID;
      el.innerHTML = `
        <div class="ic-estd-backdrop"></div>
        <div class="ic-estd-dialog" role="dialog" aria-modal="true" aria-label="${escapeHtml(name)}">
          <header class="ic-estd-header">
            <h3 class="ic-estd-title">${escapeHtml(name)}</h3>
            <button type="button" class="op-modal__details-btn" id="icEstdGoDetails">${t("Detalhes")}</button>
            <button class="ic-estd-close" id="icEstdClose" aria-label="${t("Fechar")}"><i class="fa-solid fa-xmark"></i></button>
          </header>
          <div class="ic-estd-content">
            ${offline ? `<div class="ic-estd-offline"><i class="fa-solid fa-triangle-exclamation"></i><span>${t("Sem comunicação")}</span></div>` : ""}
            <div class="ic-estd-priority">
              <div class="ic-estd-priority__item">
                <span class="ic-estd-priority__label">${ETO_ICON} ${t("ETo (hoje)")}</span>
                <div class="ic-estd-priority__value">${eto === null ? "—" : f2(eto)} <small>mm</small></div>
              </div>
              <div class="ic-estd-priority__item">
                <span class="ic-estd-priority__label"><i class="fa-solid fa-cloud-rain"></i> ${t("Chuva (hoje)")}</span>
                <div class="ic-estd-priority__value">${rainDay === null ? "—" : f1(rainDay)} <small>mm</small></div>
              </div>
            </div>
            <div class="ic-estd-rows">${rows}</div>
            <div class="ic-estd-foot">${t("Última comunicação")}: ${escapeHtml(lastComm)}</div>
          </div>
        </div>
      `;

      document.body.appendChild(el);

      const close = () => {
        el.remove();
        document.removeEventListener("keydown", onKey);
      };
      function onKey(e) { if (e.key === "Escape") close(); }

      el.querySelector(".ic-estd-backdrop").addEventListener("click", close);
      el.querySelector("#icEstdClose").addEventListener("click", close);
      document.addEventListener("keydown", onKey);

      el.querySelector("#icEstdGoDetails").addEventListener("click", () => {
        close();
        window.IcEstacaoDetails?.open?.({ estId: equipId, fromMap: true });
      });
    },
  };
})();
