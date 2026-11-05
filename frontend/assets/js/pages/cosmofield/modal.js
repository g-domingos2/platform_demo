// assets/js/pages/cosmofield/modal.js
(function () {
  "use strict";

  const { escapeHtml } = window.IcGeo;

  // Profundidade de solo considerada no cálculo da lâmina (cm).
  const ROOT_DEPTH_CM = 40;

  // Traduz para o idioma ativo da plataforma. Fora do DOM varrido pelo
  // i18n, então precisa do t() explícito.
  const t = (text) => window.IcI18n?.t?.(text) ?? text;

  const fmtPct = (value) => {
    const raw = String(value ?? "").trim();
    if (!raw) return "—";
    const num = Number(raw.replace(",", "."));
    return Number.isFinite(num) ? `${num.toFixed(2)}%` : "—";
  };

  // Modal flutuante sobre o mapa — mesma ideia do IcBombaModal: mostra o
  // essencial da sonda sem sair da visão geral, e o botão Detalhes leva
  // para a tela completa do Cosmofield.
  window.IcCosmofieldModal = {
    open({ name = "Cosmofield", equipId, data = {}, index = 0 } = {}) {
      const MODAL_ID = "icCosmofieldFloatModal";
      if (document.getElementById(MODAL_ID)) return;

      if (!document.getElementById("icCfFloatStyles")) {
        const style = document.createElement("style");
        style.id = "icCfFloatStyles";
        style.textContent = `
          #icCosmofieldFloatModal { position:fixed;inset:0;z-index:23000;display:flex;align-items:center;justify-content:center;padding:16px; }
          #icCosmofieldFloatModal .ic-cf-backdrop { position:absolute;inset:0;background:rgba(15,23,42,.4);backdrop-filter:blur(3px); }
          #icCosmofieldFloatModal .ic-cf-dialog { position:relative;background:#fff;width:100%;max-width:400px;border-radius:12px;box-shadow:0 20px 40px -8px rgba(0,0,0,.2);display:flex;flex-direction:column;animation:icCfUp .25s ease-out; }
          @keyframes icCfUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
          #icCosmofieldFloatModal .ic-cf-header { padding:14px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f1f5f9; }
          #icCosmofieldFloatModal .ic-cf-title { margin:0;font-size:16px;font-weight:600;color:#0f172a; }
          #icCosmofieldFloatModal .ic-cf-close { background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;width:24px;height:24px;display:flex;align-items:center;justify-content:center; }
          #icCosmofieldFloatModal .ic-cf-close:hover { color:#475569; }
          #icCosmofieldFloatModal .ic-cf-content { padding:16px 20px 20px;display:flex;flex-direction:column;gap:16px; }
          #icCosmofieldFloatModal .ic-cf-moisture { display:flex;align-items:baseline;justify-content:center;gap:4px; }
          #icCosmofieldFloatModal .ic-cf-moisture-value { font-size:32px;font-weight:700;color:#7cc142;line-height:1; }
          /* Sem comunicação: a leitura pode estar velha, então o verde de
             "dado atual" dá lugar ao cinza. */
          #icCosmofieldFloatModal .ic-cf-moisture-value.is-stale { color:#94a3b8; }
          [data-theme="dark"] #icCosmofieldFloatModal .ic-cf-moisture-value.is-stale { color:#94a3b8; }
          #icCosmofieldFloatModal .ic-cf-moisture-label { font-size:12px;color:#64748b; }
          #icCosmofieldFloatModal .ic-cf-bar { position:relative;height:16px;border-radius:999px;background:#f1f5f9; }
          #icCosmofieldFloatModal .ic-cf-bar-fill { overflow:hidden; }
          #icCosmofieldFloatModal .ic-cf-bar-fill { position:absolute;inset:0 auto 0 0;background:#7cc142;border-radius:999px; }
          #icCosmofieldFloatModal .ic-cf-bar-fill.is-offline { background:#94a3b8; }
          #icCosmofieldFloatModal .ic-cf-offline { display:flex;align-items:center;gap:9px;padding:10px 12px;border-radius:8px;border-left:3px solid #94a3b8;background:rgba(148,163,184,.16);font-size:12.5px;font-weight:600;color:#475569; }
          #icCosmofieldFloatModal .ic-cf-offline i { color:#64748b;font-size:14px;flex-shrink:0; }
          [data-theme="dark"] #icCosmofieldFloatModal .ic-cf-offline { background:rgba(148,163,184,.18);color:#cbd5e1; }
          [data-theme="dark"] #icCosmofieldFloatModal .ic-cf-offline i { color:#94a3b8; }
          #icCosmofieldFloatModal .ic-cf-offline--battery { border-left-color:#dc2626;background:rgba(220,38,38,.1);color:#b91c1c; }
          #icCosmofieldFloatModal .ic-cf-offline--battery i { color:#dc2626; }
          [data-theme="dark"] #icCosmofieldFloatModal .ic-cf-offline--battery { background:rgba(220,38,38,.18);color:#fca5a5; }
          [data-theme="dark"] #icCosmofieldFloatModal .ic-cf-offline--battery i { color:#f87171; }
          #icCosmofieldFloatModal .ic-cf-bar-trigger { position:absolute;top:-5px;bottom:-5px;width:3px;margin-left:-1.5px;border-radius:2px;background:#0f172a;opacity:.7; }
          [data-theme="dark"] #icCosmofieldFloatModal .ic-cf-bar-trigger { background:#e2e8f0;opacity:.7; }
          #icCosmofieldFloatModal .ic-cf-scale { display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-top:6px;font-size:11px;color:#94a3b8; }
          #icCosmofieldFloatModal .ic-cf-scale span { flex:1 1 0;min-width:0; }
          #icCosmofieldFloatModal .ic-cf-scale span:first-child { text-align:left; }
          #icCosmofieldFloatModal .ic-cf-scale span:nth-child(2) { text-align:center; }
          #icCosmofieldFloatModal .ic-cf-scale span:last-child { text-align:right; }
          #icCosmofieldFloatModal .ic-cf-rows { display:flex;flex-direction:column;gap:8px; }
          #icCosmofieldFloatModal .ic-cf-info { display:flex;align-items:flex-start;gap:7px;margin-top:-4px;padding-top:12px;border-top:1px solid #f1f5f9;font-size:11.5px;line-height:1.4;color:#64748b; }
          #icCosmofieldFloatModal .ic-cf-info i { margin-top:1px;flex-shrink:0;color:#94a3b8; }
          #icCosmofieldFloatModal .ic-cf-row { display:flex;justify-content:space-between;align-items:center;font-size:13px; }
          #icCosmofieldFloatModal .ic-cf-row-label { color:#64748b; }
          #icCosmofieldFloatModal .ic-cf-row-value { color:#0f172a;font-weight:500; }
          #icCosmofieldFloatModal .ic-cf-footer { padding:12px 20px;border-top:1px solid #f1f5f9;display:flex;justify-content:flex-end;gap:8px; }
          #icCosmofieldFloatModal .ic-cf-btn-close { height:34px;padding:0 16px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;color:#475569;font-size:13px;font-weight:500;cursor:pointer; }
          #icCosmofieldFloatModal .ic-cf-btn-close:hover { border-color:#94a3b8;color:#0f172a; }

          [data-theme="dark"] #icCosmofieldFloatModal .ic-cf-dialog { background:#141414;box-shadow:0 20px 40px -8px rgba(0,0,0,.6); }
          [data-theme="dark"] #icCosmofieldFloatModal .ic-cf-header { border-bottom-color:rgba(255,255,255,.08); }
          [data-theme="dark"] #icCosmofieldFloatModal .ic-cf-title { color:#f1f5f9; }
          [data-theme="dark"] #icCosmofieldFloatModal .ic-cf-row-value { color:#f1f5f9; }
          [data-theme="dark"] #icCosmofieldFloatModal .ic-cf-bar { background:rgba(255,255,255,.08); }
          [data-theme="dark"] #icCosmofieldFloatModal .ic-cf-footer { border-top-color:rgba(255,255,255,.08); }
          [data-theme="dark"] #icCosmofieldFloatModal .ic-cf-info { border-top-color:rgba(255,255,255,.08); }
          [data-theme="dark"] #icCosmofieldFloatModal .ic-cf-btn-close { background:#141414;color:#cbd5e1;border-color:rgba(255,255,255,.12); }
        `;
        document.head.appendChild(style);
      }

      // Mesmo mock determinístico do tooltip do mapa (mapa.js): enquanto a
      // telemetria não existe, o valor vem do id, então modal e tooltip
      // mostram o mesmo número para o mesmo equipamento.
      const seed = String(equipId || "")
        .split("")
        .reduce((sum, char) => sum + char.charCodeAt(0), 0);

      // String vazia precisa virar null, não 0: Number("") === 0, e isso
      // fazia o ?? abaixo nunca cair no mock — o modal mostrava 0.00 em
      // tudo enquanto o tooltip do mapa mostrava os valores.
      const num = (value) => {
        const raw = String(value ?? "").trim();
        if (!raw) return null;
        const parsed = Number(raw.replace(",", "."));
        return Number.isFinite(parsed) ? parsed : null;
      };

      // Mesma derivação do tooltip do mapa: sem telemetria, a umidade sai da
      // faixa útil do solo cadastrado, posicionada pelo índice do
      // equipamento — assim modal e tooltip mostram o mesmo número.
      const wpRaw = num(data.wiltingPoint);
      const fcRaw = num(data.fieldCapacity);
      // Faixa de manejo: entre o trigger e a capacidade de campo.
      const triggerFloor = num(data.triggerIrrigation) ?? 50;
      const mockBandRatio = [0.82, 0.14, 0.55, 0.33][index % 4];
      const mockAvailablePct = triggerFloor + (100 - triggerFloor) * mockBandRatio;
      const mockMoisture = (wpRaw !== null && fcRaw !== null && fcRaw > wpRaw)
        ? wpRaw + (fcRaw - wpRaw) * (mockAvailablePct / 100)
        : 18 + (seed % 200) / 10;

      const moisture = num(data.moisture ?? data.umidade) ?? mockMoisture;
      const hasMoisture = Number.isFinite(moisture);

      // Mesmo mock do mapa: o índice 5 (Cosmofield 6) é o caso de bateria
      // baixa, e abaixo de 11.5 V a sonda entra em alerta.
      const mockBattery = index === 5 ? 10.8 : 11.9 + (seed % 10) / 10;
      const battery = num(data.batteryVoltage ?? data.tensaoBateria) ?? mockBattery;
      const lowBattery = battery < 11.5;

      // Datas: sem valor real caem num mock determinístico pelo id — a
      // próxima irrigação à frente, a atualização da recomendação atrás.
      const fmtDate = (value, offsetDays) => {
        const parsed = value ? new Date(value) : null;
        const date = parsed && !Number.isNaN(parsed.getTime())
          ? parsed
          : new Date(Date.now() + offsetDays * 86400000);
        const pad = (n) => String(n).padStart(2, "0");
        return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
      };

      const nextIrrigation = fmtDate(data.nextIrrigationDate ?? data.dataProximaIrrigacao, seed % 7);
      const updatedAt = fmtDate(data.recommendationUpdatedAt ?? data.dataAtualizacaoRecomendacao, -(seed % 3) - 1);

      // Umidade em relação a PM e CC: a leitura sozinha não diz se o solo
      // está seco ou encharcado — o que importa é onde ela cai entre o
      // ponto de murcha e a capacidade de campo.
      const wp = num(data.wiltingPoint);
      const fc = num(data.fieldCapacity);
      const hasRange = wp !== null && fc !== null && fc > wp;
      // Posição relativa na faixa útil (0% = murcha, 100% = capacidade).
      const availablePct = hasRange
        ? Math.round(Math.max(0, Math.min(100, ((moisture - wp) / (fc - wp)) * 100)) * 10) / 10
        : null;

      // Trigger: ponto da água disponível em que a irrigação deve começar.
      // Marcado na barra pra deixar claro se a leitura já cruzou o limite.
      const trigger = num(data.triggerIrrigation);
      const hasTrigger = trigger !== null && trigger >= 0 && trigger <= 100;

      // Cor pela posição na faixa de manejo (trigger → CC); vermelho abaixo
      // do trigger.
      // Sem comunicação há mais de 2h: a leitura pode estar velha.
      const lastSeenRaw = data.lastCommunication ?? data.ultimaComunicacao ?? data.lastSeenAt ?? data.updatedAt;
      const lastSeen = lastSeenRaw ? new Date(lastSeenRaw) : null;
      const lastSeenMs = lastSeen && !Number.isNaN(lastSeen.getTime()) ? lastSeen.getTime() : null;
      // Mesmo mock por índice do mapa (mapa.js), pra modal e marcador
      // concordarem sobre quem está sem comunicação.
      const minutesSince = lastSeenMs === null
        ? [12, 34, 490, 26][index % 4]
        : (Date.now() - lastSeenMs) / 60000;
      const isOffline = minutesSince !== null && minutesSince > 120;

      // Barra na escala RdYlGn pela água disponível (vermelho no gatilho ou
      // abaixo, verde no alvo ou acima).
      // Bateria baixa não muda a cor; sem comunicação a barra fica cinza e
      // mantém a posição da última leitura.
      const barColor = isOffline
        ? null
        : window.IcMapIcons?.cosmofieldScaleColor?.(availablePct, {
          trigger: trigger ?? 50,
          target: Math.min(100, num(data.targetIrrigation) ?? 100),
        }) ?? null;

      // Lâmina para levar o solo da umidade atual até a capacidade de campo:
      // (CC - umidade) em % vol. sobre a profundidade explorada. Já no solo
      // ou acima da CC, não há o que repor.
      const explicitBlade = num(data.recommendedBlade ?? data.laminaRecomendada);
      const blade = explicitBlade !== null
        ? explicitBlade
        : (fc !== null ? Math.max(0, ((fc - moisture) / 100) * ROOT_DEPTH_CM * 10) : null);

      const rows = [
        [t("Lâmina recomendada"), blade === null ? "—" : `${blade.toFixed(2)} mm`],
        [t("Próxima irrigação"), nextIrrigation],
        [t("Recomendação atualizada"), updatedAt],
        [t("Trigger de irrigação"), hasTrigger ? `${trigger.toFixed(2)}% ${t("da água disponível")}` : "—"],
        [t("Tensão da bateria"), `${battery.toFixed(2)} V`],
        [t("Equipamento vinculado"), data.linkedPivotName ? escapeHtml(data.linkedPivotName) : "—"],
      ]
        .map(([label, value]) => `
              <div class="ic-cf-row">
                <span class="ic-cf-row-label">${label}</span>
                <span class="ic-cf-row-value">${value}</span>
              </div>`)
        .join("");

      const el = document.createElement("div");
      el.id = MODAL_ID;
      el.innerHTML = `
        <div class="ic-cf-backdrop"></div>
        <div class="ic-cf-dialog" role="dialog" aria-modal="true" aria-label="${escapeHtml(name)}">
          <header class="ic-cf-header">
            <h3 class="ic-cf-title">${escapeHtml(name)}</h3>
            <div style="display:flex;align-items:center;gap:8px;">
              <button type="button" class="op-modal__details-btn" id="icCfGoDetails">${t("Detalhes")}</button>
              <button class="ic-cf-close" id="icCfClose" aria-label="${t("Fechar")}"><i class="fa-solid fa-xmark"></i></button>
            </div>
          </header>
          <div class="ic-cf-content">
            ${(!isOffline && lowBattery) ? `<div class="ic-cf-offline ic-cf-offline--battery">
              <i class="fa-solid fa-battery-quarter" aria-hidden="true"></i>
              <span>${t("Bateria baixa")} — ${battery.toFixed(2)} V</span>
            </div>` : ""}
            ${isOffline ? `<div class="ic-cf-offline">
              <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
              <span>${t("Sem comunicação")} — ${t("última leitura há {v}").replace("{v}", minutesSince < 1440 ? `${Math.round(minutesSince / 60)}h` : `${Math.round(minutesSince / 1440)} ${t("dias")}`)}</span>
            </div>` : ""}
            <div>
              <div class="ic-cf-moisture">
                <span class="ic-cf-moisture-value ${isOffline ? "is-stale" : ""}">${hasMoisture ? `${moisture.toFixed(2)}%` : "—"}</span>
                <span class="ic-cf-moisture-label">vol.</span>
              </div>
              <div class="ic-cf-bar" style="margin-top:10px;">
                <div class="ic-cf-bar-fill ${isOffline ? "is-offline" : ""}" style="width:${availablePct === null ? Math.max(0, Math.min(100, moisture)) : availablePct}%;${barColor ? `background:${barColor};` : ""}"></div>
                ${hasTrigger ? `<span class="ic-cf-bar-trigger" style="left:${trigger}%;" title="${t("Trigger")}: ${trigger.toFixed(2)}%"></span>` : ""}
              </div>
              ${hasRange ? `
              <div class="ic-cf-scale">
                <span>${t("Ponto de murcha permanente")} ${wp.toFixed(2)}%</span>
                <span>${availablePct.toFixed(2)}${t("% da água disponível")}</span>
                <span>${t("Capacidade de campo")} ${fc.toFixed(2)}%</span>
              </div>` : ""}
            </div>
            <div class="ic-cf-rows">${rows}</div>
            <div class="ic-cf-info">
              <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
              <span>${t("A recomendação de irrigação é gerada diariamente às 13:00 (horário local).")}</span>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(el);

      const close = () => {
        el.remove();
        document.removeEventListener("keydown", onKey);
      };

      function onKey(event) {
        if (event.key === "Escape") close();
      }

      el.querySelector(".ic-cf-backdrop").addEventListener("click", close);
      el.querySelector("#icCfClose").addEventListener("click", close);
      document.addEventListener("keydown", onKey);

      el.querySelector("#icCfGoDetails").addEventListener("click", () => {
        close();
        // Navega pela rota: ela fecha as demais páginas antes de abrir os
        // Detalhes do Cosmofield (na sonda deste modal). Abrir a tela direto
        // deixaria a anterior montada no pageSlot.
        window.IcNavigate?.("cosmofield", { equipId, fromMap: true });
      });
    },
  };
})();
