// assets/js/pages/equipamentos/estacao-metereologica.js
(function () {
  "use strict";

  window.IcEquipamentos = window.IcEquipamentos || {};

  // escapeHtml/parseLatLng/formatLatLng compartilhados — ver assets/js/core/geo-utils.js
  const { escapeHtml, parseLatLng, formatLatLng } = window.IcGeo;

  function pinIcon() {
    if (!window.L) return null;
    return L.divIcon({
      className: "",
      html: '<div style="color:#16a34a;font-size:28px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5));"><i class="fa-solid fa-location-dot"></i></div>',
      iconSize: [28, 32],
      iconAnchor: [14, 32],
    });
  }

  const WEATHER_PROVIDERS = [
    {
      value: "davis",
      label: "Davis",
      vendor: "Davis",
      description: "Davis WeatherLink",
    },
  ];

  const DEFAULT_PROVIDER = WEATHER_PROVIDERS[0].value;
  const findProvider = (value) => WEATHER_PROVIDERS.find((provider) => provider.value === value);
  const providerByValue = (value) => findProvider(value) || WEATHER_PROVIDERS[0];
  const t = (key) => window.IcI18n?.t?.(key) ?? key;

  window.IcEquipamentos.estacao_metereologica = {
    label: "Estação Meteorológica",
    providers: WEATHER_PROVIDERS,

    // A localização da estação vem automática do provedor selecionado —
    // não há step de Localização no cadastro.

    // =================
    // STEP 2 — Ficha Técnica
    // =================
    renderStep2(container, state) {
      const errors = state._errors || {};
      const providerValue = state.provider || DEFAULT_PROVIDER;
      container.innerHTML = `
        <div class="ws-config">
          <div class="ws-grid ws-grid--top">
            <div class="ws-field ${errors.provider ? "is-error" : ""}">
              <label class="equip-label" for="wsProvider"><span class="equip-required">*</span>${t("Manufacturer")}</label>
              <select class="equip-input" id="wsProvider" data-equip-select aria-invalid="${errors.provider ? "true" : "false"}">
                ${WEATHER_PROVIDERS.map((option) => `
                  <option value="${escapeHtml(option.value)}" ${option.value === providerValue ? "selected" : ""}>${escapeHtml(t(option.label))}</option>
                `).join("")}
              </select>
              <div class="ws-error ${errors.provider ? "" : "is-hidden"}">${t("Este campo é obrigatório")}</div>
            </div>
          </div>
          ${this.renderDavisFields(state, errors)}
        </div>
      `;

      this.bindStep2(container, state);
      if (window.IcEquipSelectInit) window.IcEquipSelectInit(container);
    },

    renderDavisFields(state, errors) {
      return `
        <div class="ws-grid" data-weather-provider-fields="davis">
          <div class="ws-field ${errors.name ? "is-error" : ""}">
            <label class="equip-label" for="wsName"><span class="equip-required">*</span>${t("Nome do equipamento")}</label>
            <input class="equip-input" id="wsName" placeholder="${escapeHtml(t("Estação Meteorológica"))}" value="${escapeHtml(state.name || "")}" aria-invalid="${errors.name ? "true" : "false"}" />
            <div class="ws-error ${errors.name ? "" : "is-hidden"}">${t("Este campo é obrigatório")}</div>
          </div>

          <div class="ws-field ${errors.davisId ? "is-error" : ""}">
            <label class="equip-label" for="wsDavisId"><span class="equip-required">*</span>${t("Weather Station ID")} <span class="edit-panel__tooltip-icon" data-tooltip="${t("Identificador único da estação meteorológica fornecido pelo fabricante (ex: Davis). Você encontra este código no manual ou na etiqueta do dispositivo.")}"><i class="fa-regular fa-circle-question"></i></span></label>
            <input class="equip-input" id="wsDavisId" placeholder="001D0A719DBE" value="${escapeHtml(state.davisId || "")}" aria-invalid="${errors.davisId ? "true" : "false"}" />
            <div class="ws-error ${errors.davisId ? "" : "is-hidden"}">${t("Este campo é obrigatório")}</div>
          </div>

          <div class="ws-field ${errors.apiKey ? "is-error" : ""}">
            <label class="equip-label" for="wsApiKey"><span class="equip-required">*</span>${t("Chave de API")}</label>
            <input class="equip-input" id="wsApiKey" autocomplete="off" placeholder="aw12!fg4SYufdGg3@1ssD" value="${escapeHtml(state.apiKey || "")}" aria-invalid="${errors.apiKey ? "true" : "false"}" />
            <div class="ws-error ${errors.apiKey ? "" : "is-hidden"}">${t("Este campo é obrigatório")}</div>
          </div>

          <div class="ws-field ${errors.apiSecret ? "is-error" : ""}">
            <label class="equip-label" for="wsApiSecret"><span class="equip-required">*</span>${t("Segredo de API")}</label>
            <div class="ws-secret">
              <input class="equip-input" id="wsApiSecret" type="password" autocomplete="new-password" placeholder="••••••••••••••••" value="${escapeHtml(state.apiSecret || "")}" aria-invalid="${errors.apiSecret ? "true" : "false"}" />
              <button type="button" class="ws-secret__toggle" data-action="ws-toggle-secret" aria-label="${escapeHtml(t("Mostrar/ocultar segredo"))}"><i class="fa-regular fa-eye-slash"></i></button>
            </div>
            <div class="ws-error ${errors.apiSecret ? "" : "is-hidden"}">${t("Este campo é obrigatório")}</div>
          </div>
        </div>
      `;
    },

    bindStep2(container, state) {
      const bind = (id, key, options = {}) => {
        const el = container.querySelector(`#${id}`);
        if (!el) return;
        const eventName = options.event || "input";
        el.addEventListener(eventName, () => {
          const value = options.format ? options.format(el.value) : el.value.trim();
          if (options.format) el.value = value;
          state[key] = value;
        });
      };

      bind("wsProvider", "provider", { event: "change" });
      bind("wsName", "name");
      bind("wsDavisId", "davisId", { format: (value) => value.trim().toUpperCase() });
      bind("wsApiKey", "apiKey");
      bind("wsStationId", "stationId", { format: (value) => value.replace(/\D/g, "") });
      bind("wsApiSecret", "apiSecret");

      const providerSelect = container.querySelector("#wsProvider");
      if (providerSelect) {
        providerSelect.addEventListener("change", () => {
          state.provider = providerSelect.value || DEFAULT_PROVIDER;
          state.vendor = providerByValue(state.provider).vendor;
          state._errors = {};
          this.renderStep2(container, state);
        });
      }

      const toggle = container.querySelector('[data-action="ws-toggle-secret"]');
      const secret = container.querySelector("#wsApiSecret");
      if (toggle && secret) {
        toggle.addEventListener("click", () => {
          const shown = secret.type === "text";
          secret.type = shown ? "password" : "text";
          toggle.querySelector("i").className = shown ? "fa-regular fa-eye-slash" : "fa-regular fa-eye";
        });
      }
    },

    readStep2(container) {
      const providerValue = container.querySelector("#wsProvider")?.value?.trim() || DEFAULT_PROVIDER;
      const provider = providerByValue(providerValue);
      return {
        provider: provider.value,
        providerLabel: provider.label,
        vendor: provider.vendor,
        name: container.querySelector("#wsName")?.value?.trim() || "",
        davisId: container.querySelector("#wsDavisId")?.value?.trim().toUpperCase() || "",
        apiKey: container.querySelector("#wsApiKey")?.value?.trim() || "",
        apiSecret: container.querySelector("#wsApiSecret")?.value?.trim() || "",
        stationId: container.querySelector("#wsStationId")?.value?.trim().replace(/\D/g, "") || "",
      };
    },

    validateStep2(data) {
      const errors = {};
      if (!data.provider || !findProvider(data.provider)) errors.provider = true;
      if (data.provider === "davis") {
        if (!data.name) errors.name = true;
        if (!data.davisId) errors.davisId = true;
        if (!data.apiKey) errors.apiKey = true;
        if (!data.apiSecret) errors.apiSecret = true;
        if (!data.stationId) errors.stationId = true;
      }
      return { ok: Object.keys(errors).length === 0, errors };
    },
  };
})();
