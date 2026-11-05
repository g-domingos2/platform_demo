// assets/js/pages/equipamentos/rainstar.js
(function initRainstarEquipmentModule() {
  "use strict";

  window.IcEquipamentos = window.IcEquipamentos || {};

  const t = (text) => window.IcI18n?.t?.(text) ?? text;
  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const SETUP_METHODS = [
    "Puxando o carrinho (Padrão)",
    "Puxando a mangueira",
    "Direção autônoma",
  ];

  const MODELS = [
    "-",
    "eco ProRain F30",
    "eco ProRain F40",
    "eco ProRain F50",
    "Rainstar A2",
    "Rainstar A3",
    "Rainstar A4",
    "Rainstar E100",
    "Rainstar E11",
    "Rainstar E200",
    "Rainstar E21",
    "Rainstar E300",
    "Rainstar E31",
    "Rainstar E400",
    "Rainstar E41",
    "Rainstar E500",
    "Rainstar E51",
    "Rainstar E55 L",
    "Rainstar E55 XL",
    "Rainstar E600 4W",
    "Rainstar E600 4WB",
    "Rainstar T32",
    "Rainstar T42",
    "Rainstar T51",
    "Rainstar T61",
  ];

  const val = (state, key, fallback = "") => state?.[key] ?? state?.data?.[key] ?? fallback;
  const requiredError = (errors, key) => `<div class="rs-error ${errors?.[key] ? "" : "is-hidden"}">${t("Este campo é obrigatório")}</div>`;
  const optionHtml = (values, selected) => values.map((value) => `<option value="${escapeHtml(value)}" ${String(selected) === String(value) ? "selected" : ""}>${escapeHtml(t(value))}</option>`).join("");

  function digitsOnly(value, maxLength = 15) {
    return String(value || "").replace(/\D/g, "").slice(0, maxLength);
  }

  function decimalInput(value) {
    const normalized = String(value || "").replace(/,/g, ".").replace(/[^0-9.]/g, "");
    const parts = normalized.split(".");
    if (parts.length <= 1) return normalized;
    return `${parts.shift()}.${parts.join("")}`;
  }

  function bindText(container, state, key, selector, formatter) {
    const input = container.querySelector(selector);
    if (!input) return;
    input.addEventListener("input", () => {
      if (formatter) input.value = formatter(input.value);
      state[key] = input.value;
    });
  }

  function bindSelect(container, state, key, selector) {
    const input = container.querySelector(selector);
    if (!input) return;
    input.addEventListener("change", () => {
      state[key] = input.value;
    });
  }

  function field({ id, key, label, state, errors, unit = "", inputmode = "text", placeholder = "" }) {
    return `
      <div class="rs-field ${errors?.[key] ? "is-error" : ""}">
        <label class="equip-label" for="${id}"><span class="equip-required">*</span>${t(label)}</label>
        <div class="${unit ? "rs-input-group" : ""}">
          <input class="equip-input rs-input" id="${id}" type="text" inputmode="${inputmode}" value="${escapeHtml(val(state, key))}" placeholder="${escapeHtml(placeholder)}" />
          ${unit ? `<span class="rs-input-suffix">${escapeHtml(unit)}</span>` : ""}
        </div>
        ${requiredError(errors, key)}
      </div>`;
  }

  window.IcEquipamentos.rainstar = {
    label: "Carretel",
    setupMethods: SETUP_METHODS,
    models: MODELS,

    renderStep2(container, state = {}) {
      const errors = state._errors || {};
      const setupMethod = val(state, "setupMethod", val(state, "method", SETUP_METHODS[0]));
      const model = val(state, "model", "-");
      const nozzleDiameter = val(state, "nozzleDiameter", String(val(state, "nozzle", "")).replace(/\s*mm$/i, ""));
      const flowRate = val(state, "flowRate", val(state, "flow", ""));
      const workingWidth = val(state, "workingWidth", val(state, "width", ""));
      const minPressure = val(state, "minPressure", val(state, "pressure", ""));

      container.innerHTML = `
        <div class="sc-config">
          <div class="sc-config__grid">
            <div class="sc-field ${errors.name ? "is-error" : ""}">
              <label class="equip-label" for="rsName"><span class="equip-required">*</span>Nome do equipamento <span class="edit-panel__tooltip-icon" data-tooltip="Nome usado para identificar o carretel no mapa, nas listas e nos relatórios."><i class="fa-regular fa-circle-question"></i></span></label>
              <input class="equip-input" id="rsName" type="text" placeholder="Carretel 01" value="${escapeHtml(val(state, "name"))}" />
              <div class="sc-error ${errors.name ? "" : "is-hidden"}">${t("Este campo é obrigatório")}</div>
            </div>
            <div class="sc-field ${errors.setupMethod ? "is-error" : ""}">
              <label class="equip-label" for="rsSetupMethod"><span class="equip-required">*</span>Método de configuração <span class="edit-panel__tooltip-icon" data-tooltip="Como o carretel é preparado antes da irrigação: puxando o carrinho até a posição inicial (padrão) ou puxando a mangueira."><i class="fa-regular fa-circle-question"></i></span></label>
              <select class="equip-input" id="rsSetupMethod">${optionHtml(state.id ? SETUP_METHODS : [SETUP_METHODS[0]], setupMethod)}</select>
              <div class="sc-error ${errors.setupMethod ? "" : "is-hidden"}">${t("Este campo é obrigatório")}</div>
            </div>
            <div class="sc-field ${errors.model ? "is-error" : ""}">
              <label class="equip-label" for="rsModel"><span class="equip-required">*</span>Modelo <span class="edit-panel__tooltip-icon" data-tooltip="Modelo do carretel informado pelo fabricante. Define as características mecânicas usadas pelo controlador."><i class="fa-regular fa-circle-question"></i></span></label>
              <select class="equip-input" id="rsModel">${optionHtml(MODELS, model)}</select>
              <div class="sc-error ${errors.model ? "" : "is-hidden"}">${t("Este campo é obrigatório")}</div>
            </div>
            <div class="sc-field ${errors.flowRate ? "is-error" : ""}">
              <label class="equip-label" for="rsFlowRate"><span class="equip-required">*</span>Vazão <span class="edit-panel__tooltip-icon" data-tooltip="Vazão de água do canhão durante a irrigação, em m³/h. Usada no cálculo da lâmina e do volume aplicados."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="rsFlowRate" type="text" inputmode="decimal" value="${escapeHtml(flowRate)}" />
                <span class="sc-input-suffix">m³/h</span>
              </div>
              <div class="sc-error ${errors.flowRate ? "" : "is-hidden"}">${t("Este campo é obrigatório")}</div>
            </div>
            <div class="sc-field ${errors.hoseLength ? "is-error" : ""}">
              <label class="equip-label" for="rsHoseLength"><span class="equip-required">*</span>Comprimento da mangueira <span class="edit-panel__tooltip-icon" data-tooltip="Comprimento total da mangueira do carretel, em metros. Limita até onde o carrinho pode ser puxado."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="rsHoseLength" type="text" inputmode="decimal" value="${escapeHtml(val(state, "hoseLength", "400"))}" />
                <span class="sc-input-suffix">m</span>
              </div>
              <div class="sc-error ${errors.hoseLength ? "" : "is-hidden"}">${t("Este campo é obrigatório")}</div>
            </div>
            <div class="sc-field ${errors.workingWidth ? "is-error" : ""}">
              <label class="equip-label" for="rsWorkingWidth"><span class="equip-required">*</span>Largura de trabalho <span class="edit-panel__tooltip-icon" data-tooltip="Largura da faixa molhada pelo canhão, em metros. Usada no cálculo da área irrigada e da lâmina."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="rsWorkingWidth" type="text" inputmode="decimal" value="${escapeHtml(workingWidth)}" />
                <span class="sc-input-suffix">m</span>
              </div>
              <div class="sc-error ${errors.workingWidth ? "" : "is-hidden"}">${t("Este campo é obrigatório")}</div>
            </div>
            <div class="sc-field ${errors.minPressure ? "is-error" : ""}">
              <label class="equip-label" for="rsMinPressure"><span class="equip-required">*</span>Pressão mínima <span class="edit-panel__tooltip-icon" data-tooltip="Pressão mínima de operação, em bar. Abaixo dela o controlador considera falta de pressão e interrompe a irrigação."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="rsMinPressure" type="text" inputmode="decimal" value="${escapeHtml(minPressure)}" />
                <span class="sc-input-suffix">bar</span>
              </div>
              <div class="sc-error ${errors.minPressure ? "" : "is-hidden"}">${t("Este campo é obrigatório")}</div>
            </div>
            <div class="sc-field ${errors.nozzleDiameter ? "is-error" : ""}">
              <label class="equip-label" for="rsNozzleDiameter"><span class="equip-required">*</span>Diâmetro do bico <span class="edit-panel__tooltip-icon" data-tooltip="Diâmetro do bocal do canhão, em milímetros. Junto com a pressão, define a vazão e o alcance do jato."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="rsNozzleDiameter" type="text" inputmode="decimal" value="${escapeHtml(nozzleDiameter)}" />
                <span class="sc-input-suffix">mm</span>
              </div>
              <div class="sc-error ${errors.nozzleDiameter ? "" : "is-hidden"}">${t("Este campo é obrigatório")}</div>
            </div>
            <div class="sc-field ${errors.range ? "is-error" : ""}">
              <label class="equip-label" for="rsRange"><span class="equip-required">*</span>Alcance <span class="edit-panel__tooltip-icon" data-tooltip="Distância alcançada pelo jato do canhão, em metros."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="rsRange" type="text" inputmode="decimal" value="${escapeHtml(val(state, "range", ""))}" />
                <span class="rs-input-suffix">m</span>
              </div>
              <div class="sc-error ${errors.range ? "" : "is-hidden"}">${t("Este campo é obrigatório")}</div>
            </div>
          </div>

        </div>`;
      this.bindStep2(container, state);
    },

    bindStep2(container, state) {
      bindText(container, state, "name", "#rsName");
      bindSelect(container, state, "setupMethod", "#rsSetupMethod");
      bindSelect(container, state, "model", "#rsModel");
      bindText(container, state, "flowRate", "#rsFlowRate", decimalInput);
      bindText(container, state, "workingWidth", "#rsWorkingWidth", decimalInput);
      bindText(container, state, "hoseLength", "#rsHoseLength", decimalInput);
      bindText(container, state, "nozzleDiameter", "#rsNozzleDiameter", decimalInput);
      bindText(container, state, "minPressure", "#rsMinPressure", decimalInput);
      bindText(container, state, "range", "#rsRange", decimalInput);

    },

    readStep2(container) {
      const setupMethod = container.querySelector("#rsSetupMethod")?.value || "";
      const nozzleDiameter = container.querySelector("#rsNozzleDiameter")?.value?.trim() || "";
      const flowRate = container.querySelector("#rsFlowRate")?.value?.trim() || "";
      const workingWidth = container.querySelector("#rsWorkingWidth")?.value?.trim() || "";
      const minPressure = container.querySelector("#rsMinPressure")?.value?.trim() || "";
      return {
        name: container.querySelector("#rsName")?.value?.trim() || "",
        setupMethod,
        method: setupMethod,
        model: container.querySelector("#rsModel")?.value || "",
        flowRate,
        flow: flowRate,
        workingWidth,
        width: workingWidth,
        hoseLength: container.querySelector("#rsHoseLength")?.value?.trim() || "400",
        range: container.querySelector("#rsRange")?.value?.trim() || "",
        nozzleDiameter,
        nozzle: nozzleDiameter ? `${nozzleDiameter} mm` : "",
        minPressure,
        pressure: minPressure,
      };
    },

    validateStep2(data) {
      const errors = {};
      ["name", "setupMethod", "model", "flowRate", "workingWidth", "nozzleDiameter", "minPressure", "range"].forEach((key) => {
        if (!data[key] || data[key] === "-") errors[key] = true;
      });
      return { ok: Object.keys(errors).length === 0, errors };
    },

    // =================
    // STEP 3 — Pré e Pós-Irrigação (opcional, réplica exata do que já
    // existe na aba Geral da Configurações — mesmos campos/comportamento,
    // só o prefixo de id muda pra não colidir com os da tela de edição).
    // =================
    renderStep3(container, state = {}) {
      const preEnabled = !!val(state, "preEnabled", false);
      const postEnabled = !!val(state, "postEnabled", false);
      const preDuration = val(state, "preDuration", "");
      const preDistance = val(state, "preDistance", "");
      const postDuration = val(state, "postDuration", "");
      const postDistance = val(state, "postDistance", "");

      container.innerHTML = `
        <div class="rs-form rs-form--rainstar">
          <div style="margin-top:0;">
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
              <label for="rsPreEnabled" style="font-size:13px; color:#0f172a; font-weight:600; cursor:pointer;">${t("Pré-Irrigação")}</label>
              <label class="pivo-edit__switch">
                <input id="rsPreEnabled" type="checkbox" ${preEnabled ? "checked" : ""} />
                <span class="pivo-edit__switch-slider"></span>
              </label>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px;">
              <div class="rs-field">
                <label class="equip-label" for="rsPreDuration"><span class="equip-required">*</span>${t("Duração")} <span class="edit-panel__tooltip-icon" data-tooltip="Tempo, em minutos, em que o canhão irriga com o carrinho parado na posição inicial, antes de começar o recolhimento."><i class="fa-regular fa-circle-question"></i></span></label>
                <div class="rs-input-group${preEnabled ? "" : " rs-input-group--locked"}">
                  <input class="equip-input rs-input" id="rsPreDuration" type="text" inputmode="decimal" value="${escapeHtml(preDuration)}" placeholder="0" ${preEnabled ? "" : "disabled"} />
                  <span class="rs-input-suffix">min</span>
                </div>
              </div>
              <div class="rs-field">
                <label class="equip-label" for="rsPreDistance"><span class="equip-required">*</span>${t("Distância")} <span class="edit-panel__tooltip-icon" data-tooltip="Trecho inicial, em metros, em que a pré-irrigação é aplicada."><i class="fa-regular fa-circle-question"></i></span></label>
                <div class="rs-input-group${preEnabled ? "" : " rs-input-group--locked"}">
                  <input class="equip-input rs-input" id="rsPreDistance" type="text" inputmode="decimal" value="${escapeHtml(preDistance)}" placeholder="0" ${preEnabled ? "" : "disabled"} />
                  <span class="rs-input-suffix">m</span>
                </div>
              </div>
            </div>
          </div>

          <div style="height:1px; background:#e5e7eb; margin:20px 0 4px;"></div>

          <div style="margin-top:16px;">
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
              <label for="rsPostEnabled" style="font-size:13px; color:#0f172a; font-weight:600; cursor:pointer;">${t("Pós-Irrigação")}</label>
              <label class="pivo-edit__switch">
                <input id="rsPostEnabled" type="checkbox" ${postEnabled ? "checked" : ""} />
                <span class="pivo-edit__switch-slider"></span>
              </label>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px;">
              <div class="rs-field">
                <label class="equip-label" for="rsPostDuration"><span class="equip-required">*</span>${t("Duração")} <span class="edit-panel__tooltip-icon" data-tooltip="Tempo, em minutos, em que o canhão continua irrigando com o carrinho parado ao final do recolhimento, junto ao carretel."><i class="fa-regular fa-circle-question"></i></span></label>
                <div class="rs-input-group${postEnabled ? "" : " rs-input-group--locked"}">
                  <input class="equip-input rs-input" id="rsPostDuration" type="text" inputmode="decimal" value="${escapeHtml(postDuration)}" placeholder="0" ${postEnabled ? "" : "disabled"} />
                  <span class="rs-input-suffix">min</span>
                </div>
              </div>
              <div class="rs-field">
                <label class="equip-label" for="rsPostDistance"><span class="equip-required">*</span>${t("Distância")} <span class="edit-panel__tooltip-icon" data-tooltip="Trecho final, em metros, em que a pós-irrigação é aplicada."><i class="fa-regular fa-circle-question"></i></span></label>
                <div class="rs-input-group${postEnabled ? "" : " rs-input-group--locked"}">
                  <input class="equip-input rs-input" id="rsPostDistance" type="text" inputmode="decimal" value="${escapeHtml(postDistance)}" placeholder="0" ${postEnabled ? "" : "disabled"} />
                  <span class="rs-input-suffix">m</span>
                </div>
              </div>
            </div>
          </div>
        </div>`;
      this.bindStep3(container, state);
    },

    bindStep3(container, state) {
      bindText(container, state, "preDuration", "#rsPreDuration", decimalInput);
      bindText(container, state, "preDistance", "#rsPreDistance", decimalInput);
      bindText(container, state, "postDuration", "#rsPostDuration", decimalInput);
      bindText(container, state, "postDistance", "#rsPostDistance", decimalInput);

      [
        { toggleId: "rsPreEnabled", stateKey: "preEnabled", fields: [{ id: "rsPreDuration", stateKey: "preDuration" }, { id: "rsPreDistance", stateKey: "preDistance" }] },
        { toggleId: "rsPostEnabled", stateKey: "postEnabled", fields: [{ id: "rsPostDuration", stateKey: "postDuration" }, { id: "rsPostDistance", stateKey: "postDistance" }] },
      ].forEach(({ toggleId, stateKey, fields }) => {
        const toggle = container.querySelector(`#${toggleId}`);
        if (!toggle) return;
        toggle.addEventListener("change", () => {
          state[stateKey] = toggle.checked;
          fields.forEach(({ id, stateKey: fieldKey }) => {
            const input = container.querySelector(`#${id}`);
            if (!input) return;
            input.disabled = !toggle.checked;
            input.closest(".rs-input-group")?.classList.toggle("rs-input-group--locked", !toggle.checked);
            if (!toggle.checked) {
              input.value = "";
              state[fieldKey] = "";
            }
          });
        });
      });
    },

    readStep3(container) {
      // Estado interno do passo fica achatado (preEnabled/preDuration/...,
      // pro bindText/val funcionarem igual ao resto do arquivo), mas o
      // equipamento final espera o formato aninhado preIrrigation/
      // postIrrigation — mesmo shape lido por normalizeCrt() na
      // Configurações (carreteis/edit.js).
      const preEnabled = container.querySelector("#rsPreEnabled")?.checked ?? false;
      const preDuration = container.querySelector("#rsPreDuration")?.value?.trim() || "";
      const preDistance = container.querySelector("#rsPreDistance")?.value?.trim() || "";
      const postEnabled = container.querySelector("#rsPostEnabled")?.checked ?? false;
      const postDuration = container.querySelector("#rsPostDuration")?.value?.trim() || "";
      const postDistance = container.querySelector("#rsPostDistance")?.value?.trim() || "";
      return {
        preEnabled,
        preDuration,
        preDistance,
        postEnabled,
        postDuration,
        postDistance,
        preIrrigation: { enabled: preEnabled, duration: preDuration, distance: preDistance },
        postIrrigation: { enabled: postEnabled, duration: postDuration, distance: postDistance },
      };
    },

    validateStep3() {
      // Todos os campos são opcionais — nada bloqueia o avanço do passo.
      return { ok: true, errors: {} };
    },

    // =================
    // STEP 4 — Zonas de Irrigação
    // =================
    renderStep4(container, state = {}) {
      if (!Array.isArray(state.zones)) state.zones = [];
      const zones = state.zones;
      const ZONE_COLORS = ["#3b82f6", "#f97316", "#14b8a6", "#a16207"];
      const hoseLength = Number(val(state, 'hoseLength')) || 0;
      const totalRange = hoseLength > 0 ? hoseLength : 400;

      const renderBar = () => {
        if (!zones.length) return '<div id="rsZonesBar" style="display:none; margin-bottom:20px;"></div>';
        const barHtml = zones.slice().reverse().map((z, reverseIndex) => {
          const i = zones.length - 1 - reverseIndex;
          const startNumber = Number(z.start);
          const endNumber = Number(z.end);
          const hasStart = z.start !== "" && Number.isFinite(startNumber);
          const hasEnd = z.end !== "" && Number.isFinite(endNumber);
          const start = hasStart ? startNumber : 0;
          const end = hasEnd ? endNumber : start;
          const span = hasStart && hasEnd
            ? Math.max(start - end, 0)
            : totalRange / Math.max(zones.length, 1);
          const speedNum = Number(z.speed);
          const speedLabel = z.speed !== "" && Number.isFinite(speedNum) ? `${speedNum.toFixed(1)} m/h` : "--";
          const rangeLabel = hasStart && hasEnd ? `${end} m ← ${start} m` : "--";
          return `<div title="${t("Zona")} ${i + 1}: ${rangeLabel} | ${speedLabel}" style="flex:${Math.max(span, 1)} 0 0; min-width:0; height:100%; background:${ZONE_COLORS[i]}; border-right:2px solid #fff; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff; font-size:13px; line-height:1.25; font-weight:700; white-space:nowrap; overflow:hidden; padding:0 5px; box-sizing:border-box;"><span>${t("Zona")} ${i + 1}</span><span style="font-size:12px; font-weight:600; opacity:.95;">${rangeLabel}</span></div>`;
        }).join("");
        return `<div id="rsZonesBar" style="display:block; margin-bottom:20px;"><div style="display:grid; grid-template-columns:76px minmax(0,1fr) 76px; gap:10px; align-items:center;"><div style="display:flex; flex-direction:column; align-items:center; gap:5px; color:#0f172a; transform:translateY(8px);"><img class="create-equip__img" src="./assets/img/equipamentos/rainstar.png" alt="Carretel" style="width:54px; height:54px; object-fit:contain;" /><strong style="font-size:11px;">${t("Carretel")}</strong><span style="font-size:10px; color:#64748b;">0 m</span></div><div style="min-width:0;"><div style="display:flex; position:relative; height:58px; border-top:4px solid #cbd5e1; border-bottom:4px solid #cbd5e1; background:repeating-linear-gradient(90deg, #f8fafc 0, #f8fafc 24px, #f1f5f9 24px, #f1f5f9 25px);"><div style="position:absolute; left:0; right:0; top:50%; height:2px; transform:translateY(-50%); background:#94a3b8;"></div>${barHtml}</div></div><div style="display:flex; flex-direction:column; align-items:center; gap:5px; color:#0f172a; transform:translateY(6px);"><div aria-hidden="true" style="width:54px; height:54px;"></div><strong style="font-size:11px;">Comprimento da mangueira</strong><span style="font-size:10px; color:#64748b;">${totalRange} m</span></div></div></div>`;
      };

      const renderRows = () => {
        if (!zones.length) {
          return `<div id="rsZonesRows"><div class="edit-panel__history-no-data" style="padding:32px; text-align:center; color:#94a3b8; font-size:13px; border:1px dashed #e2e8f0; border-radius:8px;">${t("Nenhuma zona de irrigação cadastrada.")}</div></div>`;
        }
        const rowsHtml = zones.map((z, i) => {
          const startDisabled = i > 0;
          const prevEnd = i > 0 ? (Number(zones[i - 1]?.end) || 0) : 0;
          const startVal = startDisabled ? String(prevEnd) : (z.start ?? String(totalRange));
          return `
            <div style="display:grid; grid-template-columns:64px 1fr 1fr 1fr 32px; gap:12px; align-items:start; margin-bottom:12px;">
              <div class="pivo-edit__field" style="padding-top:6px;">
                <label style="visibility:hidden;">${t("Zona")}</label>
                <div style="font-size:13px; font-weight:600; color:#0f172a;">${t("Zona")} ${i + 1}</div>
              </div>
              <div class="pivo-edit__field">
                <label><span class="edit-panel__req">*</span> ${t("Início")} <span class="edit-panel__tooltip-icon" data-tooltip="Posição, em metros, onde a zona começa (medida a partir do carretel)."><i class="fa-regular fa-circle-question"></i></span></label>
                <div class="sc-input-group" id="rsStartGroup-${i}">
                  <input class="equip-input sc-input" type="number" step="0.1" data-zone-field="start" data-zone-index="${i}" value="${startVal}" ${startDisabled ? "disabled" : ""} />
                  <span class="sc-input-suffix">m</span>
                </div>
                <div id="rsZoneStartHint-${i}" style="display:none; font-size:11px; color:#dc2626; margin-top:4px;"></div>
              </div>
              <div class="pivo-edit__field">
                <label><span class="edit-panel__req">*</span> ${t("Fim")} <span class="edit-panel__tooltip-icon" data-tooltip="Posição, em metros, onde a zona termina (medida a partir do carretel). A última zona termina em 0."><i class="fa-regular fa-circle-question"></i></span></label>
                <div class="sc-input-group">
                  <input class="equip-input sc-input" type="number" step="0.1" data-zone-field="end" data-zone-index="${i}" value="${z.end ?? ""}" />
                  <span class="sc-input-suffix">m</span>
                </div>
                <div id="rsZoneHint-${i}" style="display:none; font-size:11px; color:#dc2626; margin-top:4px;"></div>
              </div>
              <div class="pivo-edit__field">
                <label><span class="edit-panel__req">*</span> ${t("Velocidade")} <span class="edit-panel__tooltip-icon" data-tooltip="Velocidade de recolhimento da mangueira nesta zona, em m/h. Quanto menor a velocidade, maior a lâmina aplicada."><i class="fa-regular fa-circle-question"></i></span></label>
                <div class="sc-input-group" id="rsSpeedGroup-${i}">
                  <input class="equip-input sc-input" type="number" step="0.1" data-zone-field="speed" data-zone-index="${i}" value="${z.speed ?? ""}" />
                  <span class="sc-input-suffix">m/h</span>
                </div>
                <div id="rsZoneSpeedHint-${i}" style="display:none; font-size:11px; color:#dc2626; margin-top:4px;">${t("Este campo é obrigatório")}</div>
              </div>
              <div class="pivo-edit__field">
                <label style="visibility:hidden;">${t("Zona")}</label>
                <button type="button" title="${t("Remover")}" data-zone-remove="${i}" style="display:block; border:none; background:transparent; cursor:pointer; color:#dc2626; font-size:14px;"><i class="fa-regular fa-trash-can"></i></button>
              </div>
            </div>`;
        }).join("");
        return `<div id="rsZonesRows">${rowsHtml}</div>`;
      };

      const refreshBar = () => {
        const currentBar = container.querySelector("#rsZonesBar");
        if (currentBar) currentBar.outerHTML = renderBar();
      };

      container.innerHTML = `
        <div class="rs-form rs-form--rainstar">
          <p style="font-size:13px; color:#64748b; margin:0 0 16px;">${t("Defina até 4 zonas, em metros, para aplicar velocidades diferentes ao longo do recolhimento da mangueira.")}</p>
          ${renderBar()}
          ${renderRows()}
          <div style="display:flex; align-items:center; justify-content:flex-end; margin-top:4px;">
            <button type="button" class="edit-panel__btn" id="rsCreateZoneBtn" style="width:100%; min-height:36px; justify-content:center; border-style:dashed; border-color:#cbd5e1; background:#fff; color:#64748b;"><i class="fa-solid fa-plus" style="color:#94a3b8;"></i> ${t("Criar Zona")}</button>
          </div>
        </div>`;
      this.bindStep4(container, state);
    },

    bindStep4(container, state) {
      const hoseLength = Number(val(state, 'hoseLength')) || 0;
      const totalRange = hoseLength > 0 ? hoseLength : 400;

      const updateHint = (i) => {
        const zones = state.zones || [];
        const z = zones[i];
        if (!z) return;
        const isLastZone = i === zones.length - 1;

        // --- Validar START ---
        const startInput = container.querySelector(`[data-zone-field="start"][data-zone-index="${i}"]`);
        const startGroup = startInput?.closest(".sc-input-group");
        const startHint = container.querySelector(`#rsZoneStartHint-${i}`);
        let startMsg = "";
        let startHasError = false;

        if (z.start !== "") {
          const valStart = Number(z.start) || 0;
          if (valStart < 0) {
            startMsg = `${t("Mínimo de")} 0m`;
            startHasError = true;
          } else if (valStart > totalRange) {
            startMsg = `${t("Máximo de")} ${totalRange}m`;
            startHasError = true;
          }
        }

        if (startGroup) startGroup.style.borderColor = startHasError ? "#dc2626" : "";
        if (startHint) {
          startHint.style.display = startHasError ? "block" : "none";
          startHint.textContent = startMsg;
        }

        const start = Number(z.start) || totalRange;

        // --- Validar END ---
        const endInput = container.querySelector(`[data-zone-field="end"][data-zone-index="${i}"]`);
        const hint = container.querySelector(`#rsZoneHint-${i}`);
        const endGroup = endInput?.closest(".sc-input-group");
        let msg = "";
        let hasError = false;

        if (z.end !== "") {
          const valEnd = Number(z.end) || 0;
          if (valEnd >= start) {
            msg = `${t("Deve terminar antes do início")}`;
            hasError = true;
          } else if (valEnd < 0 || (isLastZone && valEnd !== 0)) {
            msg = `${t("Deve terminar em 0")}`;
            hasError = true;
          }
        }

        if (endGroup) endGroup.style.borderColor = hasError ? "#dc2626" : "";
        if (hint) {
          hint.style.display = hasError ? "block" : "none";
          hint.textContent = msg;
        }

        // Speed: só mostra erro no blur (veja focusout handler abaixo)
      };

      const updateBtn = () => {
        const btn = container.querySelector("#rsCreateZoneBtn");
        if (!btn) return;
        const zones = state.zones || [];
        const canCreate = zones.length < 4;
        btn.disabled = !canCreate;
        btn.classList.toggle("is-disabled", !canCreate);
      };

      const syncZoneValues = () => {
        const zones = state.zones || [];
        container.querySelectorAll("[data-zone-field]").forEach((input) => {
          const idx = Number(input.dataset.zoneIndex);
          const field = input.dataset.zoneField;
          if (zones[idx]) zones[idx][field] = input.value;
        });
      };

      const reRender = () => {
        this.renderStep4(container, state);
      };

      // Bind inputs
      container.querySelectorAll('[data-zone-field]').forEach((input) => {
        input.addEventListener('input', (e) => {
          const idx = Number(e.target.dataset.zoneIndex);
          const field = e.target.dataset.zoneField;
          const zones = state.zones || [];
          if (zones[idx]) {
            zones[idx][field] = e.target.value;
            if (field === "end" && zones[idx + 1]) {
              zones[idx + 1].start = e.target.value;
              const nextStart = container.querySelector(`[data-zone-field="start"][data-zone-index="${idx + 1}"]`);
              if (nextStart) nextStart.value = e.target.value;
            }
            if (field === 'start' || field === 'end') {
              syncZoneValues();
              updateHint(idx);
              refreshBar();
            }
            if (field === 'speed') {
              // Limpa erro do speed ao digitar
              const speedGroup = e.target.closest(".sc-input-group");
              const speedHint = container.querySelector(`#rsZoneSpeedHint-${idx}`);
              if (speedGroup) speedGroup.style.borderColor = "";
              if (speedHint) speedHint.style.display = "none";
            }
          }
        });
        input.addEventListener('focusout', (e) => {
          const field = e.target.dataset.zoneField;
          const zones = state.zones || [];
          const idx = Number(e.target.dataset.zoneIndex);

          // Valida Speed no blur se estiver vazio
          if (field === "speed" && zones[idx] && e.target.value.trim() === "") {
            const speedGroup = e.target.closest(".sc-input-group");
            const speedHint = container.querySelector(`#rsZoneSpeedHint-${idx}`);
            if (speedGroup) speedGroup.style.borderColor = "#dc2626";
            if (speedHint) speedHint.style.display = "block";
          }

          if (field === 'end') {
            const hoseLength = Number(val(state, 'hoseLength')) || 0;
            const maxRange = hoseLength > 0 ? hoseLength : 400;
            let endValue = Number(e.target.value) || 0;
            if (endValue > maxRange) {
              e.target.value = maxRange;
              if (zones[idx]) zones[idx][field] = String(maxRange);
            }
          }

          if (field === 'start' || field === 'end') {
            syncZoneValues();
            if (zones.length) reRender();
          }
        });
      });

      // Bind remove
      container.querySelectorAll('[data-zone-remove]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const idx = Number(e.currentTarget.dataset.zoneRemove);
          state.zones.splice(idx, 1);
          reRender();
        });
      });

      // Bind create
      const createBtn = container.querySelector("#rsCreateZoneBtn");
      if (createBtn) {
        createBtn.addEventListener('click', () => {
          const zones = state.zones || [];
          if (zones.length >= 4) return;
          if (zones.length === 0) {
            const hoseLength = Number(val(state, "hoseLength")) || 0;
            zones.push({ start: String(hoseLength > 0 ? hoseLength : 400), end: "", speed: "" });
          } else {
            const prevEnd = Number(zones[zones.length - 1].end) || 0;
            zones.push({ start: String(prevEnd), end: "", speed: "" });
          }
          reRender();
        });
      }

      updateBtn();
      (state.zones || []).forEach((_, i) => updateHint(i));
    },

    zoneIsValid(z) {
      if (!z) return false;
      const start = Number(z?.start);
      const end = Number(z?.end);
      const speed = Number(z?.speed);
      return Number.isFinite(start) && Number.isFinite(end) && end < start && Number.isFinite(speed) && speed > 0;
    },

    readStep4(container) {
      const rows = container.querySelectorAll('[data-zone-field]');
      const zones = [];
      rows.forEach((input) => {
        const idx = Number(input.dataset.zoneIndex);
        const field = input.dataset.zoneField;
        if (!zones[idx]) zones[idx] = {};
        zones[idx][field] = input.value;
      });
      return { zones: zones.filter(Boolean) };
    },

    validateStep4(data) {
      const errors = {};
      if (!Array.isArray(data.zones)) data.zones = [];
      data.zones.forEach((z, i) => {
        const start = Number(z?.start);
        const end = Number(z?.end);
        const speed = Number(z?.speed);
        if (!Number.isFinite(end) || end <= start) errors[`zone${i}End`] = true;
        if (!Number.isFinite(speed) || speed <= 0) errors[`zone${i}Speed`] = true;
      });
      return { ok: Object.keys(errors).length === 0, errors };
    },

    // =================
    // STEP 5 — Conectividade
    // =================
    renderStep5(container, state = {}) {
      const errors = state._errors || {};
      const machineAddress = val(state, "machineAddress", val(state, "imei", ""));
      container.innerHTML = `
        <div class="rs-form rs-form--rainstar">
          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px;">
            <div class="farm-radio-field ${errors.machineAddress ? "is-error" : ""}">
              <div class="farm-radio-field__header">
                <span class="farm-radio-field__label"><span class="equip-required">*</span>${t("ID do equipamento")} <span class="edit-panel__tooltip-icon" data-tooltip="Identificador único do controlador do carretel (IMEI do modem 4G). Está na etiqueta do equipamento e pode ser lido pelo QR Code."><i class="fa-regular fa-circle-question"></i></span></span>
              </div>
              <div class="farm-radio-field__value">
                <div class="sc-input-group">
                  <input class="equip-input sc-input farm-radio-input" id="rsMachineAddress" type="text" inputmode="numeric" value="${escapeHtml(machineAddress)}" placeholder="000000000000000" />
                  <div class="farm-radio-actions">
                    <button type="button" class="farm-radio-clear" title="${escapeHtml(t("Limpar"))}"><i class="fa-solid fa-xmark"></i></button>
                    <span class="farm-radio-status"><i class="fa-solid fa-check"></i></span>
                  </div>
                  <button type="button" class="farm-radio-qr" title="${escapeHtml(t("Escanear QR Code"))}"><i class="fa-solid fa-qrcode"></i></button>
                </div>
              </div>
              ${requiredError(errors, "machineAddress")}
            </div>
            <div></div>
            <div></div>
          </div>
        </div>`;
      this.bindStep5(container, state);
    },

    bindStep5(container, state) {
      bindText(container, state, "machineAddress", "#rsMachineAddress", (value) => digitsOnly(value, 15));
      container.querySelector(".farm-radio-clear")?.addEventListener("click", () => {
        const input = container.querySelector("#rsMachineAddress");
        if (input) { input.value = ""; state.machineAddress = ""; }
      });
    },

    readStep5(container) {
      const machineAddress = container.querySelector("#rsMachineAddress")?.value?.trim() || "";
      return {
        machineAddress,
        imei: machineAddress,
        connectivityType: "4g",
      };
    },

    validateStep5(data) {
      const errors = {};
      if (!data.machineAddress) errors.machineAddress = true;
      return { ok: Object.keys(errors).length === 0, errors };
    },
  };
})();
