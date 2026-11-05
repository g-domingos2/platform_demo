// assets/js/pages/equipamentos/irripump.js
(function () {
  "use strict";
  const tMsg = (text) => window.IcI18n?.t?.(text) ?? text;

  // Namespace global (mantém compatível com teu wizard)
  window.IcEquipamentos = window.IcEquipamentos || {};

  // =========================
  // Helpers (sem mudar lógica)
  // =========================
  // escapeHtml/parseLatLng compartilhados — ver assets/js/core/geo-utils.js
  const { escapeHtml, parseLatLng } = window.IcGeo;
  // pinIcon/uid compartilhados — ver assets/js/core/map-icons.js
  const { pinIcon, uid } = window.IcMapIcons;

  // =========================
  // Configuração das funções
  // =========================
  const FUNCS = [
    {
      key: "automacao",
      title: "Automação",
      icon: "fa-gears",
      selectLabel: "Tipo de Automação",
      options: ["Bomba de Superfície", "Bomba Submersa"],
    },
    {
      key: "vazao",
      title: "Medição de Vazão",
      icon: "fa-gauge-high",
      selectLabel: "Tipo de Medição de Vazão",
      options: ["Hidrômetro", "Medidor Eletrônico"],
    },
    {
      key: "nivel",
      title: "Medição de Nível",
      icon: "fa-water",
      selectLabel: "Tipo de Medição de Nível",
      options: ["Poço", "Reservatório", "Rio"],
    },
    {
      key: "corrente_tensao",
      title: "Medição de Corrente e Tensão",
      icon: "fa-bolt",
      selectLabel: "Tipo de Medição de Corrente e Tensão",
      options: ["Digital Soft Starter", "Digital Inversora", "Sensores Analógicos"],
    },
  ];

  // =========================
  // Implementação do Irripump
  // =========================
  window.IcEquipamentos.irripump = {
    label: "Irripump",

    // =================
    // STEP 2
    // =================
    renderStep2(container, state) {
      const loc = state.loc ?? "";

      container.innerHTML = `
        <div class="equip-page ip-page">
          <div class="equip-page__title"></div>
          <div class="equip-page__sub"></div>

          <div class="equip-form">
            <div class="equip-field">
              <label class="equip-label" for="ipLoc"><span class="equip-required">*</span>Localização do equipamento</label>
              <div class="rp-loc__row">
                <div class="rp-loc__input">
                  <input class="equip-input" id="ipLoc" placeholder="Ex: -23.5505, -46.6333" value="${escapeHtml(loc)}" />
                </div>
                <button class="equip-btn btn btn--outline rp-loc__btn" type="button" data-action="ip-get-loc">
                  <i class="fa-solid fa-location-dot" aria-hidden="true" style="color:#22c55e;"></i> Obter Localização
                </button>
              </div>
            </div>

            <!-- MAPA REAL AQUI -->
            <div id="ipMiniMap" class="equip-mini-map"></div>
            <div class="equip-mini-map__hint"></div>
          </div>
        </div>
      `;

      // Mantém a mesma lógica: inicializa Leaflet após injetar HTML
      this.initMiniMap(container, state);
    },

    initMiniMap(container, state) {
      // Leaflet precisa existir (mesma regra)
      if (!window.L) return;

      const mapEl = container.querySelector("#ipMiniMap");
      const inputLoc = container.querySelector("#ipLoc");
      if (!mapEl || !inputLoc) return;

      // Se já existe mapa anterior (re-render), destrói pra não bugar (mesma lógica)
      if (state._miniMap) {
        try {
          state._miniMap.remove();
        } catch (e) {
          // sem log pra não poluir
        }
        state._miniMap = null;
      }

      // Centro default (mesmo)
      let center = [-16.767, -47.613];
      let zoom = 16;

      // Se já tem coordenadas no estado, usa elas (mesmo)
      if (typeof state.lat === "number" && typeof state.lng === "number") {
        center = [state.lat, state.lng];
        zoom = 17;
      }

      // Cria mapa (mesmo)
      const miniMap = L.map(mapEl, { zoomControl: false }).setView(center, zoom);

      // Base satélite (mesmo)
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, attribution: "Tiles © Esri" }
      ).addTo(miniMap);

      // Labels (opcional) (mesmo)
      L.tileLayer(
        "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, opacity: 0.85 }
      ).addTo(miniMap);

      // Marker (pin verde padrão)
      const marker = L.marker(center, { icon: pinIcon() }).addTo(miniMap);

      // Clique no mapa -> atualiza marker + input + state (mesmo)
      miniMap.on("click", (e) => {
        const { lat, lng } = e.latlng;

        marker.setLatLng([lat, lng]);

        const txt = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        inputLoc.value = txt;

        state.loc = txt;
        state.lat = lat;
        state.lng = lng;
      });

      // Guarda no state pra controlar re-render (mesmo)
      state._miniMap = miniMap;

      // Correção de render no modal/aba (mesmo)
      setTimeout(() => miniMap.invalidateSize(), 120);

      // Botão "Obter Localização" — usa o GPS do dispositivo
      const locBtn = container.querySelector('[data-action="ip-get-loc"]');
      if (locBtn && navigator.geolocation) {
        locBtn.addEventListener("click", () => {
          locBtn.disabled = true;
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude, longitude } = pos.coords;
              marker.setLatLng([latitude, longitude]);
              miniMap.setView([latitude, longitude], 17);

              const txt = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
              inputLoc.value = txt;
              state.loc = txt;
              state.lat = latitude;
              state.lng = longitude;
              locBtn.disabled = false;
            },
            () => { locBtn.disabled = false; },
            { enableHighAccuracy: true, timeout: 8000 }
          );
        });
      }
    },

    // ✅ Mantido: wizard chama isso antes do Step 3
    readStep2(container) {
      const loc = container.querySelector("#ipLoc")?.value?.trim() || "";

      const parsed = parseLatLng(loc);

      return {
        loc,
        lat: parsed?.lat ?? null,
        lng: parsed?.lng ?? null,
      };
    },

    // ✅ Mantido: validação do Step 2
    validateStep2(data) {
      if (data.lat === null || data.lng === null) {
        return {
          ok: false,
          msg: "Informe uma Localização válida (Latitude, Longitude) ou clique no mapa.",
        };
      }

      return { ok: true, msg: "" };
    },

    // ✅ Novo: wizard chama isso antes do Step 4
    readStep3(container) {
      const nome = container.querySelector("#ipNome")?.value?.trim() || "";
      const serial = container.querySelector("#ipSerial")?.value?.trim() || "";

      return { nome, serial };
    },

    // ✅ Novo: validação do Step 3 (Módulos)
    validateStep3(data) {
      if (!data.nome) return { ok: false, msg: "Informe o Nome do Equipamento." };
      if (!data.serial) return { ok: false, msg: "Informe o ID / Serial number." };
      return { ok: true, msg: "" };
    },

    // =================
    // STEP 3 — Configuração (fluxo reduzido: Equipamento > Localização > Configuração)
    // =================
    renderConfigStep(container, state) {
      if (!state.powerUnit) state.powerUnit = "cv";
      if (!state.version) state.version = "5.1";
      const powerLabel = state.powerUnit === "kw" ? "kW" : "CV";
      const isGh = state.version === "5.2";

      const flowVal = state.flow || "";
      const enableConsumptionLimit = !!state.enableConsumptionLimit;
      const consumptionLimit = state.consumptionLimit || "";
      const enableSensorScale = !!state.enableSensorScale;
      const sensorScaleLimit = state.sensorScaleLimit || "";
      const enablePressureSensor = !!state.enablePressureSensor;
      const volumePerPulse = state.volumePerPulse || "";
      const orgao = state.orgao || "ana";
      const identId = state.identId || "";
      const energyTime = state.energyTime || "";

      // Medidor de nível vinculado — só existe na versão 5.2 (GH), agora
      // dentro da própria Ficha Técnica (Step 3), sem step separado.
      const medidorOptions = [];
      if (isGh) {
        const allFarms = window.IcFarmsAll || [];
        allFarms.forEach((farm) => {
          (farm.equipments || []).forEach((eq) => {
            const type = String(eq?.type || "").toLowerCase();
            const cat = String(eq?.category || "").toLowerCase();
            if (type === "medidor" || cat === "medidores") {
              medidorOptions.push({ id: eq.id, label: eq.name || eq?.data?.nome || "Medidor" });
            }
          });
        });
      }
      const medidorId = state.medidorId || "";
      const hasMedidor = !!medidorId;
      const levelOn = state.levelOn ?? "";
      const levelOff = state.levelOff ?? "";
      const medidorOptionsHtml = medidorOptions
        .map((o) => `<option value="${escapeHtml(o.id)}" ${medidorId === o.id ? "selected" : ""}>${escapeHtml(o.label)}</option>`)
        .join("");

      // Bloco de potência unificado: 5.0/5.1/5.2 (GH) usam o mesmo layout — potência sempre em kW.
      const powerBlockHtml = `
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
            <div class="sc-field">
              <label class="equip-label" for="ipCfgPower"><span class="equip-required">*</span> Potência elétrica <span class="edit-panel__tooltip-icon" data-tooltip="Potência real (absorvida): energia efetivamente absorvida da rede elétrica para operar o equipamento no ponto de trabalho atual, considerando o rendimento e a conversão para o sistema internacional de unidades."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="ipCfgPower" type="text" inputmode="decimal" value="${escapeHtml(state.power || "")}" />
                <span class="sc-input-suffix">kW</span>
              </div>
            </div>
          </div>
        `;

      // Tail (parte de baixo do formulário) muda conforme a versão: a 5.2
      // (GH) segue o mesmo layout do edit da Bomba GH — Vazão/Escala do
      // sensor/Volume por pulso sempre editáveis (sem toggle), Órgão
      // Regulatório/ID de Identificação, e só o toggle de limite de consumo.
      // As 5.0/5.1 mantêm o layout atual (Vazão + 3 toggles).
      const tailHtml = isGh
        ? `
          <div class="edit-panel__grid-3" style="grid-template-columns: 1fr 1fr 1fr;">
            <div class="pivo-edit__field">
              <label for="ipCfgFlow"><span class="equip-required">*</span> Vazão</label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="ipCfgFlow" type="text" inputmode="decimal" placeholder="0" value="${escapeHtml(flowVal)}" />
                <span class="sc-input-suffix">m³/h</span>
              </div>
            </div>

            <div class="pivo-edit__field">
              <label for="ipCfgSensorScaleLimit"><span class="equip-required">*</span> Escala do sensor</label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="ipCfgSensorScaleLimit" type="text" inputmode="decimal" placeholder="0" value="${escapeHtml(sensorScaleLimit)}" />
                <span class="sc-input-suffix">MCA</span>
              </div>
            </div>

            <div class="pivo-edit__field">
              <label for="ipCfgVolumePerPulse"><span class="equip-required">*</span> Volume por pulso</label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="ipCfgVolumePerPulse" type="text" inputmode="decimal" placeholder="0" value="${escapeHtml(volumePerPulse)}" />
                <span class="sc-input-suffix">m³/pulso</span>
              </div>
            </div>
          </div>

          <div class="edit-panel__grid-3" style="grid-template-columns: 1fr 1fr; margin-top:16px;">
            <div class="pivo-edit__field">
              <label for="ipCfgOrgao">Órgão regulatório</label>
              <select class="equip-input" id="ipCfgOrgao">
                <option value="ana" ${orgao === "ana" ? "selected" : ""}>Agência Nacional de Águas e Saneamento Básico (ANA)</option>
              </select>
            </div>
            <div class="pivo-edit__field">
              <label for="ipCfgIdentId">Código de identificação <span class="edit-panel__tooltip-icon" data-tooltip="Código de identificação vinculado à outorga/licença emitida pelo órgão regulatório (ex: ANA) para este ponto de captação. Você encontra esse código no documento de outorga do produtor."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="edit-panel__input-wrap">
                <input class="edit-panel__input" id="ipCfgIdentId" type="text" placeholder="Ex: PRT_010_4" value="${escapeHtml(identId)}" />
              </div>
            </div>
          </div>

          <div class="pref-divider" style="margin:0;"></div>

          <div>
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
              <label for="ipCfgEnableConsumptionLimit" style="font-size:13px; color:#0f172a; font-weight:600; cursor:pointer;">Habilitar limite de consumo de água</label>
              <label class="pivo-edit__switch">
                <input id="ipCfgEnableConsumptionLimit" type="checkbox" ${enableConsumptionLimit ? "checked" : ""} />
                <span class="pivo-edit__switch-slider"></span>
              </label>
            </div>

            <div class="edit-panel__grid-3" style="grid-template-columns: 1fr 2fr;">
              <div class="pivo-edit__field">
                <label for="ipCfgConsumptionLimit">Limite de consumo mensal</label>
                <div class="sc-input-group">
                  <input class="equip-input sc-input${enableConsumptionLimit ? "" : " is-disabled"}" id="ipCfgConsumptionLimit" type="text" inputmode="decimal" placeholder="0" value="${escapeHtml(consumptionLimit)}" ${enableConsumptionLimit ? "" : "disabled"} />
                  <span class="sc-input-suffix">m³</span>
                </div>
              </div>
            </div>
          </div>

          <div class="pref-divider" style="margin:0;"></div>

          <div>
            <h3 class="pref-section-title" style="margin:0 0 12px;">Medidor de nível vinculado</h3>
            <div style="background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;padding:10px 14px;border-radius:8px;font-size:13px;display:flex;align-items:center;gap:8px;margin-bottom:16px;">
              <i class="fa-solid fa-circle-info" style="color:#3b82f6;"></i>
              Nessa aba você pode vincular 1 equipamento do tipo "Medidor de nível". Esse vínculo servirá para otimizar o funcionamento em conjunto entre as bombas e medidores de nível para automatizar o processo de ligar/desligar equipamento.
            </div>

            <div class="edit-panel__grid-3" style="grid-template-columns:1fr 1fr;">
              <div class="pivo-edit__field">
                <label for="ipMedidorId">Medidor de nível vinculado</label>
                <select class="equip-input" id="ipMedidorId">
                  <option value="">Nenhum</option>
                  ${medidorOptionsHtml}
                </select>
              </div>
            </div>

            <div id="ipMedidorThresholds" style="display:${hasMedidor ? "" : "none"}; margin-top:16px;">
              <div class="edit-panel__grid-3" style="grid-template-columns:1fr 1fr;">
                <div class="pivo-edit__field">
                  <label for="ipMedidorLevelOn">Ligar bomba quando nível abaixar de</label>
                  <div class="sc-input-group">
                    <input class="equip-input sc-input" id="ipMedidorLevelOn" type="text" inputmode="decimal" placeholder="0" value="${escapeHtml(String(levelOn))}" />
                    <span class="sc-input-suffix">%</span>
                  </div>
                </div>
                <div class="pivo-edit__field">
                  <label for="ipMedidorLevelOff">Desligar bomba quando nível atingir</label>
                  <div class="sc-input-group">
                    <input class="equip-input sc-input" id="ipMedidorLevelOff" type="text" inputmode="decimal" placeholder="100" value="${escapeHtml(String(levelOff))}" />
                    <span class="sc-input-suffix">%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `
        : `
          <div class="edit-panel__grid-3" style="grid-template-columns: 1fr 1fr 1fr;">
            <div class="pivo-edit__field">
              <label for="ipCfgFlow"><span class="equip-required">*</span> Vazão</label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="ipCfgFlow" type="text" inputmode="decimal" placeholder="0" value="${escapeHtml(flowVal)}" />
                <span class="sc-input-suffix">m³/h</span>
              </div>
            </div>
          </div>

          <div class="pref-divider" style="margin:0;"></div>

          <div>
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
              <label for="ipCfgEnableConsumptionLimit" style="font-size:13px; color:#0f172a; font-weight:600; cursor:pointer;">Habilitar limite de consumo de água</label>
              <label class="pivo-edit__switch">
                <input id="ipCfgEnableConsumptionLimit" type="checkbox" ${enableConsumptionLimit ? "checked" : ""} />
                <span class="pivo-edit__switch-slider"></span>
              </label>
            </div>

            <div class="edit-panel__grid-3" style="grid-template-columns: 1fr 2fr;">
              <div class="pivo-edit__field">
                <label for="ipCfgConsumptionLimit">Limite de consumo mensal</label>
                <div class="sc-input-group">
                  <input class="equip-input sc-input${enableConsumptionLimit ? "" : " is-disabled"}" id="ipCfgConsumptionLimit" type="text" inputmode="decimal" placeholder="0" value="${escapeHtml(consumptionLimit)}" ${enableConsumptionLimit ? "" : "disabled"} />
                  <span class="sc-input-suffix">m³</span>
                </div>
              </div>
            </div>
          </div>

          <div class="pref-divider" style="margin:0;"></div>

          <div>
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
              <label for="ipCfgEnableSensorScale" style="font-size:13px; color:#0f172a; font-weight:600; cursor:pointer;">Habilitar sensor de pressão</label>
              <label class="pivo-edit__switch">
                <input id="ipCfgEnableSensorScale" type="checkbox" ${enableSensorScale ? "checked" : ""} />
                <span class="pivo-edit__switch-slider"></span>
              </label>
            </div>

            <div class="edit-panel__grid-3" style="grid-template-columns: 1fr 2fr;">
              <div class="pivo-edit__field">
                <label for="ipCfgSensorScaleLimit">Escala do sensor de pressão</label>
                <div class="sc-input-group">
                  <input class="equip-input sc-input${enableSensorScale ? "" : " is-disabled"}" id="ipCfgSensorScaleLimit" type="text" inputmode="decimal" placeholder="0" value="${escapeHtml(sensorScaleLimit)}" ${enableSensorScale ? "" : "disabled"} />
                  <span class="sc-input-suffix">bar</span>
                </div>
              </div>
            </div>
          </div>
        `;

      container.innerHTML = `
        <div class="sc-config pivo-edit-specifics">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
            <div class="sc-field">
              <label class="equip-label" for="ipCfgNome"><span class="equip-required">*</span>Nome do equipamento</label>
              <input class="equip-input" id="ipCfgNome" type="text" placeholder="Bomba 01" value="${escapeHtml(state.nome || "")}" />
            </div>
            <div class="sc-field">
              <label class="equip-label" for="ipCfgVersao"><span class="equip-required">*</span>Versão</label>
              <select class="equip-input" id="ipCfgVersao">
                <option value="5.0" ${state.version === "5.0" ? "selected" : ""}>5.0</option>
                <option value="5.1" ${state.version === "5.1" ? "selected" : ""}>5.1</option>
                <option value="5.2" ${state.version === "5.2" ? "selected" : ""}>5.2 (GH)</option>
              </select>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
            <div class="pivo-edit__field">
              <label for="ipCfgEnergyTime2">
                <span class="equip-required">*</span> Tempo de energia
                <i class="fa-regular fa-circle-question edit-panel__tooltip-icon" title="Tempo de espera antes de retomar a operação após uma queda de energia."></i>
              </label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="ipCfgEnergyTime2" type="text" inputmode="decimal" placeholder="0" value="${escapeHtml(energyTime)}" />
                <span class="sc-input-suffix">min</span>
              </div>
            </div>
            <div></div>
          </div>

          ${powerBlockHtml}

          ${tailHtml}
        </div>
      `;

      const powerInput = container.querySelector("#ipCfgPower");
      powerInput?.addEventListener("input", () => { state.power = powerInput.value; });

      // Versão: trocar para/de 5.2 (GH) re-renderiza o step com o layout correto
      container.querySelector("#ipCfgVersao")?.addEventListener("change", (e) => {
        // guarda o que já foi digitado antes de re-renderizar
        Object.assign(state, this.readConfigStep(container));
        state.version = e.target.value;
        this.renderConfigStep(container, state);
        // reaplica o dropdown customizado nos <select> recém-renderizados
        if (window.IcEquipSelectInit) window.IcEquipSelectInit(container);
      });

      // Limite de consumo de água
      const enableConsumptionLimitInput = container.querySelector("#ipCfgEnableConsumptionLimit");
      const consumptionLimitInput = container.querySelector("#ipCfgConsumptionLimit");
      if (enableConsumptionLimitInput && consumptionLimitInput) {
        enableConsumptionLimitInput.addEventListener("change", () => {
          const enabled = enableConsumptionLimitInput.checked;
          state.enableConsumptionLimit = enabled;
          consumptionLimitInput.disabled = !enabled;
          consumptionLimitInput.classList.toggle("is-disabled", !enabled);
          if (!enabled) {
            consumptionLimitInput.value = "";
            state.consumptionLimit = "";
          }
        });
      }

      // Sensor de escala (só existe como toggle nas versões 5.0/5.1; na 5.2 é fixo)
      const enableSensorScaleInput = container.querySelector("#ipCfgEnableSensorScale");
      const sensorScaleLimitInput = container.querySelector("#ipCfgSensorScaleLimit");
      if (enableSensorScaleInput && sensorScaleLimitInput) {
        enableSensorScaleInput.addEventListener("change", () => {
          const enabled = enableSensorScaleInput.checked;
          state.enableSensorScale = enabled;
          sensorScaleLimitInput.disabled = !enabled;
          sensorScaleLimitInput.classList.toggle("is-disabled", !enabled);
          if (!enabled) {
            sensorScaleLimitInput.value = "";
            state.sensorScaleLimit = "";
          }
        });
      }

      // Medidor de nível vinculado (só na versão 5.2/GH)
      const medidorSelect = container.querySelector("#ipMedidorId");
      const medidorThresholds = container.querySelector("#ipMedidorThresholds");
      const medidorLevelOnInput = container.querySelector("#ipMedidorLevelOn");
      const medidorLevelOffInput = container.querySelector("#ipMedidorLevelOff");
      if (medidorSelect) {
        medidorSelect.addEventListener("change", () => {
          state.medidorId = medidorSelect.value;
          if (medidorThresholds) medidorThresholds.style.display = medidorSelect.value ? "" : "none";
        });
        if (window.IcEquipSelectInit) window.IcEquipSelectInit(container);
      }
      medidorLevelOnInput?.addEventListener("input", () => { state.levelOn = medidorLevelOnInput.value; });
      medidorLevelOffInput?.addEventListener("input", () => { state.levelOff = medidorLevelOffInput.value; });
    },

    readConfigStep(container) {
      const isGh = container.querySelector("#ipCfgVersao")?.value === "5.2";
      return {
        nome: container.querySelector("#ipCfgNome")?.value?.trim() || "",
        version: container.querySelector("#ipCfgVersao")?.value || "5.1",
        powerUnit: "kw",
        power: container.querySelector("#ipCfgPower")?.value?.trim() || "",
        flow: container.querySelector("#ipCfgFlow")?.value?.trim() || "",
        enableConsumptionLimit: container.querySelector("#ipCfgEnableConsumptionLimit")?.checked ?? false,
        consumptionLimit: container.querySelector("#ipCfgConsumptionLimit")?.value?.trim() || "",
        enableSensorScale: isGh ? true : (container.querySelector("#ipCfgEnableSensorScale")?.checked ?? false),
        sensorScaleLimit: container.querySelector("#ipCfgSensorScaleLimit")?.value?.trim() || "",
        enablePressureSensor: container.querySelector("#ipCfgEnablePressureSensor")?.checked ?? false,
        volumePerPulse: container.querySelector("#ipCfgVolumePerPulse")?.value?.trim() || "",
        orgao: container.querySelector("#ipCfgOrgao")?.value || "",
        identId: container.querySelector("#ipCfgIdentId")?.value?.trim() || "",
        energyTime: container.querySelector("#ipCfgEnergyTime2")?.value?.trim() || "",
        medidorId: container.querySelector("#ipMedidorId")?.value || "",
        levelOn: container.querySelector("#ipMedidorLevelOn")?.value?.trim() || "",
        levelOff: container.querySelector("#ipMedidorLevelOff")?.value?.trim() || "",
      };
    },

    validateConfigStep(data) {
      const isGh = data.version === "5.2";
      const missing = [];
      if (!data.nome) missing.push("Nome do equipamento");
      if (!data.power) missing.push("Potência elétrica");
      if (!data.flow) missing.push("Vazão");
      if (!data.energyTime) missing.push("Tempo de energia");
      if (isGh) {
        if (!data.sensorScaleLimit) missing.push("Escala do sensor");
        if (!data.volumePerPulse) missing.push("Volume por pulso");
        if (!data.medidorId) missing.push("Medidor de nível vinculado");
      }
      if (missing.length) {
        return { ok: false, msg: `Preencha os campos obrigatórios:\n• ${missing.join("\n• ")}` };
      }
      return { ok: true, msg: "" };
    },

    // =================
    // STEP 4 — Conectividade
    // =================
    renderConnectivityStep(container, state) {
      if (!state.commType) state.commType = "XBEE";
      const isXbee = state.commType === "XBEE";

      container.innerHTML = `
        <div class="sc-config pivo-edit-specifics">
          <!-- Tipo de comunicação (oculto por enquanto — 4G ainda não implementado) -->
          <div class="sc-config__grid" style="display:none; margin-bottom:16px;">
            <div class="sc-field">
              <label class="equip-label" for="ipConnCommType"><span class="equip-required">*</span>Tipo de comunicação</label>
              <select class="equip-input" id="ipConnCommType" disabled>
                <option value="XBEE" ${isXbee ? "selected" : ""}>Rádio</option>
                <option value="4G" ${!isXbee ? "selected" : ""}>4G</option>
              </select>
            </div>
          </div>

          <div id="ipConnGatewayField" class="edit-panel__grid-3" style="display:${isXbee ? "none" : ""};">
            <div class="farm-radio-field">
              <div class="farm-radio-field__header">
                <span class="farm-radio-field__label">ID do equipamento <span class="equip-required">*</span></span>
              </div>
              <div class="farm-radio-field__value">
                <div class="sc-input-group">
                  <input class="equip-input sc-input farm-radio-input" id="ipConnGateway" type="text" placeholder="10000000351D266D" value="${escapeHtml(state.gateway || "")}" />
                  <div class="farm-radio-actions">
                    <button type="button" class="farm-radio-clear" title="Limpar" data-clear="ipConnGateway"><i class="fa-solid fa-xmark"></i></button>
                    <span class="farm-radio-status"><i class="fa-solid fa-check"></i></span>
                  </div>
                  <button type="button" class="farm-radio-qr" title="Escanear QR Code"><i class="fa-solid fa-qrcode"></i></button>
                </div>
              </div>
            </div>
          </div>

          <div id="ipConnRadioGrid" class="edit-panel__grid-3" style="display:${isXbee ? "" : "none"};">
            <div class="farm-radio-field">
              <div class="farm-radio-field__header">
                <span class="farm-radio-field__label"><span class="equip-required">*</span> Rádio da bomba</span>
                <button type="button" class="farm-radio-field__edit" id="ipConnRadioReload" title="Sincronizar rádio"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>
              </div>
              <div class="farm-radio-field__value">
                <div class="sc-input-group">
                  <input class="equip-input sc-input farm-radio-input" id="ipConnRadioBomba" type="text" value="${escapeHtml(state.radioBomba || "0000000000000000")}" readonly />
                  <div class="farm-radio-actions">
                    <button type="button" class="farm-radio-clear" title="Limpar" data-clear="ipConnRadioBomba"><i class="fa-solid fa-xmark"></i></button>
                    <span class="farm-radio-status"><i class="fa-solid fa-check" id="ipConnRadioDot" style="color:#9ca3af;font-size:11px;"></i></span>
                  </div>
                  <button type="button" class="farm-radio-qr" title="Escanear QR Code"><i class="fa-solid fa-qrcode"></i></button>
                </div>
              </div>
            </div>

            <div class="farm-radio-field" style="border:none; background:transparent; box-shadow:none;"></div>
          </div>
        </div>
      `;

      this.bindConnectivityStep(container, state);
      if (window.IcEquipSelectInit) window.IcEquipSelectInit(container);
    },

    bindConnectivityStep(container, state) {
      container.querySelector("#ipConnCommType")?.addEventListener("change", (e) => {
        state.commType = e.target.value;
        const isXbee = state.commType === "XBEE";
        const radioGrid = container.querySelector("#ipConnRadioGrid");
        const radioGridTitle = container.querySelector("#ipConnRadioGridTitle");
        const gatewayField = container.querySelector("#ipConnGatewayField");
        if (radioGrid) radioGrid.style.display = isXbee ? "" : "none";
        if (radioGridTitle) radioGridTitle.style.display = isXbee ? "" : "none";
        if (gatewayField) gatewayField.style.display = isXbee ? "none" : "";
      });

      const radioCentralInput = container.querySelector("#ipConnRadioCentral");
      const radioBombaInput = container.querySelector("#ipConnRadioBomba");
      const gatewayInput = container.querySelector("#ipConnGateway");

      radioCentralInput?.addEventListener("input", () => { state.radioCentral = radioCentralInput.value.trim(); });
      radioBombaInput?.addEventListener("input", () => { state.radioBomba = radioBombaInput.value.trim(); });
      gatewayInput?.addEventListener("input", () => { state.gateway = gatewayInput.value.trim(); });

      container.querySelectorAll("[data-clear]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const target = container.querySelector(`#${btn.dataset.clear}`);
          if (target) { target.value = ""; target.dispatchEvent(new Event("input")); }
        });
      });
    },

    readConnectivityStep(container) {
      return {
        commType: container.querySelector("#ipConnCommType")?.value || "XBEE",
        radioCentral: container.querySelector("#ipConnRadioCentral")?.value?.trim() || "",
        radioBomba: container.querySelector("#ipConnRadioBomba")?.value?.trim() || "",
        gateway: container.querySelector("#ipConnGateway")?.value?.trim() || "",
      };
    },

    validateConnectivityStep(data) {
      const missing = [];
      const isXbee = data.commType === "XBEE";
      if (!data.commType) missing.push("Tipo de comunicação");
      if (isXbee && !data.radioBomba) missing.push("Rádio da bomba");
      if (!isXbee && !data.gateway) missing.push("ID do equipamento");
      if (missing.length) {
        return { ok: false, msg: `Preencha os campos obrigatórios:\n• ${missing.join("\n• ")}` };
      }
      return { ok: true, msg: "" };
    },

    // =================
    // STEP 3
    // =================
    renderStep3(container, state) {
      const nome = state.nome ?? "";
      const serial = state.serial ?? "";
      state.modules = state.modules || [
        {
          id: "m1",
          name: "Módulo 1",
          title: "Irripump",
          desc: "Controlador remoto de bomba",
          serial: "IRP-23-00981",
          lastSeen: "há 2 min",
          status: "online",
          source: "Manual",
        },
      ];

      const cards = state.modules
        .map((m) => {
          const title = m.title || "Irripump";
          const desc = m.desc || "Controlador remoto de bomba";
          const radio = m.serial || "—";
          const lastSeen = m.lastSeen || "há 2 min";
          const status = m.status === "offline" ? "is-offline" : "is-online";
          const statusLabel = status === "is-online" ? "Online" : "Offline";

          return `
            <div class="ip-mod-card card">
              <div class="ip-mod-card__top">
                <div class="ip-mod-head">
                  <span class="ip-mod-title">${escapeHtml(title)}</span>
                  <span class="ip-mod-status ${status}" aria-label="${statusLabel}"></span>
                </div>
                <button
                  class="ip-mod-del"
                  type="button"
                  data-action="ip-mod-del"
                  data-id="${escapeHtml(m.id)}"
                  aria-label="Excluir módulo"
                >
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
              <div class="ip-mod-desc">${escapeHtml(desc)}</div>
              <div class="ip-mod-meta"><span class="meta-label">Número do Rádio:</span> ${escapeHtml(radio)}</div>
              <div class="ip-mod-meta"><span class="comm-label">Última comunicação:</span> ${escapeHtml(lastSeen)}</div>
            </div>
          `;
        })
        .join("");

      container.innerHTML = `
        <div class="equip-form ip-mod-form">
          <div class="equip-form__row">
            <div class="equip-field">
              <label class="equip-label" for="ipSerial"><span class="equip-required">*</span>ID / Serial number</label>
              <input class="equip-input" id="ipSerial" placeholder="Ex: GH2-001234" value="${escapeHtml(serial)}" />
            </div>
            <button class="equip-btn btn equip-btn--primary" type="button" data-action="ip-test">Tentar Conexão</button>
          </div>
          <div class="equip-field">
            <label class="equip-label" for="ipNome"><span class="equip-required">*</span>Nome do Equipamento</label>
            <input class="equip-input" id="ipNome" placeholder="Ex: Bomba Principal, Poço 01" value="${escapeHtml(nome)}" />
          </div>
        </div>

        <div class="ip-step">
          <div class="ip-step__row">
            <div>
              <div class="ip-step__title">Descoberta de Módulos</div>
              <div class="ip-step__sub">Adicione os módulos manualmente</div>
            </div>

            <button class="equip-btn btn equip-btn--primary" type="button" data-action="ip-mod-open">
              <i class="fa-solid fa-plus"></i> Adicionar Módulo
            </button>
          </div>

          <div class="ip-mod-zone">
            ${cards || `<div class="ip-empty">Nenhum módulo cadastrado.</div>`}
          </div>
        </div>

        <!-- MODAL: adicionar módulo (dentro do card) -->
        <div class="ip-modal" data-ip-modal aria-hidden="true">
          <div class="ip-modal__backdrop" data-ip-close></div>
          <div class="ip-modal__dialog" role="dialog" aria-modal="true" aria-label="Adicionar Módulo
          
          ">
            <div class="ip-modal__head">
              <div class="ip-modal__title">Adicionar Módulo</div>
              <button class="ip-modal__x" type="button" data-ip-close aria-label="Fechar">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div class="ip-modal__body">
              <label class="equip-label" for="ipModSerial"><span class="equip-required">*</span>Serial do Módulo</label>
              <input class="equip-input" id="ipModSerial" placeholder="Ex: GH2-001A-M01" />
            </div>

            <div class="ip-modal__foot">
              <button class="create-equip__btn btn create-equip__btn--ghost" type="button" data-ip-close>Cancelar</button>
              <button class="create-equip__btn btn create-equip__btn--primary" type="button" data-action="ip-mod-add">Adicionar</button>
            </div>
          </div>
        </div>
      `;

      // IMPORTANTE: mantém onclick (substitui sempre) pra não duplicar listeners (mesma lógica)
      container.onclick = (e) => {
        const btn = e.target.closest("[data-action], [data-ip-close]");
        if (!btn) return;

        const equipNameInput = container.querySelector("#ipNome");
        if (equipNameInput) {
          state.nome = equipNameInput.value.trim();
        }

        const equipSerialInput = container.querySelector("#ipSerial");
        if (equipSerialInput) {
          state.serial = equipSerialInput.value.trim();
        }

        const modalEl = container.querySelector("[data-ip-modal]");
        const serialInput = container.querySelector("#ipModSerial");
        if (!modalEl) return;

        // ABRIR MODAL
        if (btn.dataset.action === "ip-mod-open") {
          modalEl.classList.add("is-open");
          modalEl.setAttribute("aria-hidden", "false");

          if (serialInput) {
            serialInput.value = "";
            serialInput.focus();
          }
          return;
        }

        // FECHAR MODAL (X / backdrop / Cancelar)
        if (btn.hasAttribute("data-ip-close")) {
          modalEl.classList.remove("is-open");
          modalEl.setAttribute("aria-hidden", "true");
          return;
        }

        // ADICIONAR MÓDULO
        if (btn.dataset.action === "ip-mod-add") {
          const serial = (serialInput?.value || "").trim();
          if (!serial) {
            alert(tMsg("Informe o serial do módulo."));
            return;
          }

          // Mantém o mesmo gerador de id (não troca por uid pra não “mudar nada”)
          const id = Math.random().toString(16).slice(2, 10);

          state.modules = state.modules || [];
          state.modules.push({
            id,
            name: `Módulo ${state.modules.length + 1}`,
            title: "Irripump",
            desc: "Controlador remoto de bomba",
            serial,
            lastSeen: "há 2 min",
            status: "online",
            source: "Manual",
          });

          // fecha modal
          modalEl.classList.remove("is-open");
          modalEl.setAttribute("aria-hidden", "true");

          // re-render step 3
          this.renderStep3(container, state);
          return;
        }

        // EXCLUIR MÓDULO
        if (btn.dataset.action === "ip-mod-del") {
          const id = btn.dataset.id;
          state.modules = (state.modules || []).filter((m) => m.id !== id);
          this.renderStep3(container, state);
        }
      };
    },

    // =================
    // STEP 4
    // =================
    renderStep4(container, state) {
      const mod =
        (state.modules && state.modules[0]) || {
          name: "Módulo 1",
          serial: "—",
          source: "Manual",
        };

      state.funcs = state.funcs || {};
      state.funcParams = state.funcParams || {};

    const rows = FUNCS.map((f) => {
      const checked = !!state.funcs[f.key];
      const selected = state.funcParams[f.key] || "";
      const pending = checked && !selected;

      const rowClass = [
        "func-row",
        checked ? "is-active" : "is-inactive",
        pending ? "is-pending" : "",
      ]
        .filter(Boolean)
        .join(" ");

      const options = f.options
        .map((opt) => {
          const val = escapeHtml(opt);
          const isSelected = selected === opt ? "is-selected" : "";
          return `<button type="button" class="func-select__option ${isSelected}" data-action="func-select-option" data-key="${escapeHtml(
            f.key
          )}" data-value="${val}">${val}</button>`;
        })
        .join("");

      return `
        <div class="${rowClass}" data-func="${escapeHtml(f.key)}">
          <label class="func-row__head">
            <span class="func-row__check">
              <input
                type="checkbox"
                name="func_toggle_${escapeHtml(f.key)}"
                data-action="func-toggle"
                data-key="${escapeHtml(f.key)}"
                ${checked ? "checked" : ""}
              />
              <span class="func-row__checkmark"></span>
            </span>
            <span class="func-row__ico">
              <i class="fa-solid ${escapeHtml(f.icon || "fa-circle-dot")}"></i>
            </span>
            <span class="func-row__text">
              <span class="func-row__title">${escapeHtml(f.title)}</span>
              <span class="func-row__sub">${escapeHtml(f.selectLabel)}</span>
            </span>
            ${pending ? `<span class="func-row__badge pill">Pendente</span>` : ""}
          </label>

          <div class="func-row__body ${checked ? "" : "is-disabled"}">
            <div class="func-select ${checked ? "" : "is-disabled"}" data-key="${escapeHtml(f.key)}">
              <button
                type="button"
                class="func-select__trigger"
                data-action="func-select-toggle"
                data-key="${escapeHtml(f.key)}"
                ${checked ? "" : "disabled"}
              >
                <span class="func-select__label">${escapeHtml(selected || "Selecionar tipo...")}</span>
                <span class="func-select__chev"><i class="fa-solid fa-chevron-down"></i></span>
              </button>
              <div class="func-select__list" role="listbox">
                ${options}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    const activeCount = FUNCS.filter((f) => state.funcs?.[f.key]).length;
    const pendingCount = FUNCS.filter(
      (f) => state.funcs?.[f.key] && !state.funcParams?.[f.key]
    ).length;

      container.innerHTML = `
        <div class="equip-page">
          <div class="equip-page__title">Configuração de Módulos e Funções</div>
          <div class="equip-page__sub">Configure as funções de cada módulo detectado. Ative as funcionalidades desejadas e selecione os tipos correspondentes.</div>

          <div class="mod-panel card">
            <div class="mod-panel__head">
              <div class="mod-panel__module">
                <span class="mod-panel__ico"><i class="fa-solid fa-microchip"></i></span>
                <div class="mod-panel__module-info">
                  <div class="mod-panel__title">${escapeHtml(mod.name)}</div>
                  <div class="mod-panel__meta">Serial: ${escapeHtml(mod.serial)} • ${escapeHtml(mod.source)}</div>
                </div>
                <span class="mod-panel__badge pill">${escapeHtml(mod.source || "Manual")}</span>
              </div>

              <button class="mod-panel__danger btn" type="button" data-action="ip-mod-del-first">
                <i class="fa-solid fa-trash"></i> Excluir módulo
              </button>
            </div>

            <div class="mod-panel__stats">
              <span class="mod-stat mod-stat--ok">
                <span class="mod-stat__dot"></span>
                ${activeCount} <span>função(ões) ativas</span>
              </span>
              <span class="mod-stat mod-stat--warn">
                <span class="mod-stat__dot"></span>
                ${pendingCount} <span>pendente(s) de configuração</span>
              </span>
            </div>

            <div class="func-list">
              ${rows}
            </div>
          </div>
        </div>
      `;

      // ✅ Listener local do Step 4 (mesma lógica)
      container.onchange = (e) => {
        const el = e.target;
        if (!(el instanceof Element)) return;

        const action = el.getAttribute("data-action");
        if (!action) return;

        // Toggle checkbox
        if (action === "func-toggle") {
          const key = el.getAttribute("data-key");
          const checked = el.checked === true;

          state.funcs[key] = checked;
          if (!checked) state.funcParams[key] = "";

          // habilita/desabilita o select do mesmo bloco
          const row = el.closest(".func-row");
          const body = row?.querySelector(".func-row__body");
          const selectWrap = row?.querySelector(".func-select");
          const trigger = row?.querySelector(".func-select__trigger");
          const label = row?.querySelector(".func-select__label");
          const options = row?.querySelectorAll(".func-select__option");

          if (body) body.classList.toggle("is-disabled", !checked);
          if (selectWrap) selectWrap.classList.toggle("is-disabled", !checked);
          if (trigger) trigger.disabled = !checked;
          if (!checked) {
            if (label) label.textContent = "Selecionar tipo...";
            options?.forEach((opt) => opt.classList.remove("is-selected"));
            if (selectWrap) selectWrap.classList.remove("is-open");
          }
          return;
        }
      };

      container.onclick = (e) => {
        const target = e.target;
        if (!(target instanceof Element)) return;

        const actionEl = target.closest("[data-action]");
        const action = actionEl?.getAttribute("data-action");
        if (!action) {
          // close open selects when clicking elsewhere inside container
          container
            .querySelectorAll(".func-select.is-open")
            .forEach((el) => el.classList.remove("is-open"));
          return;
        }

        if (action === "ip-mod-del-first") {
          state.modules = (state.modules || []).slice(1);
          state.funcs = {};
          state.funcParams = {};
          this.renderStep4(container, state);
          return;
        }

        if (action === "func-select-toggle") {
          const key = actionEl.getAttribute("data-key");
          const wrap = container.querySelector(`.func-select[data-key="${key}"]`);
          if (wrap?.classList.contains("is-disabled")) return;

          container
            .querySelectorAll(".func-select.is-open")
            .forEach((el) => {
              if (el !== wrap) el.classList.remove("is-open");
            });
          wrap?.classList.toggle("is-open");
          return;
        }

        if (action === "func-select-option") {
          const key = actionEl.getAttribute("data-key");
          const value = actionEl.getAttribute("data-value") || "";
          state.funcParams[key] = value;

          const wrap = container.querySelector(`.func-select[data-key="${key}"]`);
          const label = wrap?.querySelector(".func-select__label");
          const options = wrap?.querySelectorAll(".func-select__option");
          if (label) label.textContent = value;
          options?.forEach((opt) => opt.classList.toggle("is-selected", opt === actionEl));
          wrap?.classList.remove("is-open");
          // re-render to update "pendente" badge and stats
          this.renderStep4(container, state);
          return;
        }
      };

      // Botao Excluir (opcional) tratado no handler acima
    },

    // =================
    // STEP 5 (Resumo)
    // =================
// =================
// STEP 5 — Vincular equipamento (novo)
// =================
renderStep5(container, state) {
  if (!Array.isArray(state.vinculos)) state.vinculos = [];

  const allFarms = window.IcFarmsAll || [];
  const pivotOptions = [];
  allFarms.forEach((farm) => {
    (farm.equipments || []).forEach((eq) => {
      if (eq.category === "pivos") {
        pivotOptions.push({ id: eq.id, label: eq.name });
      }
    });
  });

  container.innerHTML = `
    <div class="equip-page equip-page--link">
      <div class="equip-page__title">Vincular equipamento</div>
      <div class="equip-page__sub">Informe a qual equipamento este Irripump será vinculado.</div>

      <div class="equip-form">
        <div class="equip-field">
          <label class="equip-label" for="ipVinculoTrigger"><span class="equip-required">*</span>Equipamento vínculo</label>
          <div class="ip-multiselect" id="ipVinculoWrap">
            <button type="button" class="equip-input ip-multiselect__trigger" id="ipVinculoTrigger">
              <span class="ip-multiselect__label ip-multiselect__label--placeholder" id="ipVinculoLabel">Selecione os pivôs…</span>
              <i class="fa-solid fa-chevron-down"></i>
            </button>
            <div class="ip-multiselect__dropdown" id="ipVinculoDropdown" style="display:none;">
              <div class="ip-multiselect__search-wrap">
                <i class="fa-solid fa-magnifying-glass ip-multiselect__search-icon"></i>
                <input class="ip-multiselect__search" id="ipVinculoSearch" type="text" placeholder="Buscar pivô…" autocomplete="off">
              </div>
              <div class="ip-multiselect__list" id="ipVinculoList"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const selected = new Set(state.vinculos);
  const wrap     = container.querySelector("#ipVinculoWrap");
  const trigger  = container.querySelector("#ipVinculoTrigger");
  const dropdown = container.querySelector("#ipVinculoDropdown");
  const search   = container.querySelector("#ipVinculoSearch");
  const list     = container.querySelector("#ipVinculoList");
  const labelEl  = container.querySelector("#ipVinculoLabel");

  const updateLabel = () => {
    if (selected.size === 0) {
      labelEl.textContent = "Selecione os pivôs…";
      labelEl.classList.add("ip-multiselect__label--placeholder");
    } else {
      const names = pivotOptions.filter(o => selected.has(o.id)).map(o => o.label);
      labelEl.textContent = names.join(", ");
      labelEl.classList.remove("ip-multiselect__label--placeholder");
    }
    state.vinculos = [...selected];
  };

  const renderList = (filter = "") => {
    const q = filter.toLowerCase();
    list.innerHTML = "";
    const filtered = pivotOptions.filter(o => o.label.toLowerCase().includes(q));
    if (!filtered.length) {
      list.innerHTML = `<div class="ip-multiselect__empty">Nenhum pivô encontrado</div>`;
      return;
    }
    filtered.forEach(o => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "ip-multiselect__option" + (selected.has(o.id) ? " is-selected" : "");
      item.dataset.id = o.id;
      item.innerHTML = `<span class="ip-multiselect__check"><i class="fa-solid fa-check"></i></span>${escapeHtml(o.label)}`;
      item.addEventListener("click", () => {
        if (selected.has(o.id)) selected.delete(o.id);
        else selected.add(o.id);
        item.classList.toggle("is-selected", selected.has(o.id));
        updateLabel();
      });
      list.appendChild(item);
    });
  };

  const positionDropdown = () => {
    const rect = trigger.getBoundingClientRect();
    dropdown.style.top   = `${rect.bottom + 4}px`;
    dropdown.style.left  = `${rect.left}px`;
    dropdown.style.width = `${rect.width}px`;
  };

  renderList();
  updateLabel();

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = dropdown.style.display !== "none";
    dropdown.style.display = isOpen ? "none" : "block";
    wrap.classList.toggle("is-open", !isOpen);
    if (!isOpen) { positionDropdown(); search.value = ""; renderList(); search.focus(); }
  });

  search.addEventListener("input", () => renderList(search.value));

  document.addEventListener("click", function closeOut(e) {
    if (!wrap.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = "none";
      wrap.classList.remove("is-open");
      document.removeEventListener("click", closeOut);
    }
  });
},

// =================
// STEP 6 — Resumo (era o Step 5)
// =================
renderStep6(container, state) {
  const modules = state.modules || [];

  const funcsAtivas = FUNCS.filter((f) => state.funcs?.[f.key]).map((f) => ({
    key: f.key,
    name: f.title,
    param: state.funcParams?.[f.key] || "",
  }));

  const missing = funcsAtivas.filter((x) => !x.param);

  const funcsHtml = funcsAtivas.length
    ? funcsAtivas
        .map((x) => {
          const hasParam = !!x.param;
          return `
            <div class="summary-func ${hasParam ? "is-ok" : "is-missing"}">
              <div class="summary-func__head">
                <span class="summary-func__title">${escapeHtml(x.name)}</span>
                <span class="summary-func__badge pill">${hasParam ? "OK" : "Pendente"}</span>
              </div>
              <div class="summary-func__param">
                ${hasParam ? escapeHtml(x.param) : "Tipo não selecionado"}
              </div>
              ${hasParam ? "" : `<div class="summary-func__meta">Selecione o tipo no Step 4.</div>`}
            </div>
          `;
        })
        .join("")
    : `<div class="muted">Nenhuma função selecionada.</div>`;

  const progressParts = [
    modules.length ? 1 : 0,
    funcsAtivas.length ? 1 : 0,
    funcsAtivas.length && missing.length === 0 ? 1 : 0,
  ];
  const progress = Math.round((progressParts.reduce((acc, n) => acc + n, 0) / 3) * 100);

  const warn = missing.length
    ? `
      <div class="equip-warn">
        <div class="equip-warn__title">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span>Atenção: faltam parâmetros em</span> ${missing.length} <span>função(ões)</span>
        </div>
        <div class="equip-warn__chips">
          ${missing.map((m) => `<span class="warn-chip">${escapeHtml(m.name)}</span>`).join("")}
        </div>
        <div class="equip-warn__hint">Volte no Step 4 e selecione o tipo para cada função marcada.</div>
      </div>
    `
    : "";

  const moduleRows = modules
    .map(
      (m) => `
        <tr>
          <td class="td-strong">${escapeHtml(m.name)}</td>
          <td>${escapeHtml(m.serial || "—")}</td>
          <td>${escapeHtml(m.source || "—")}</td>
        </tr>
      `
    )
    .join("");

  container.innerHTML = `
    <div class="equip-page equip-summary">
      <div class="equip-page__title">Resumo da Configuração</div>
      <div class="equip-page__sub">Revise todas as informações antes de finalizar o cadastro</div>

      ${warn}

      <div class="summary-grid2">
        <div class="summary-card card">
          <div class="summary-card__head">Informações Gerais</div>
          <div class="kv-grid">
            <div class="kv">
              <div class="kv__k">Nome do Equipamento</div>
              <div class="kv__v">${escapeHtml(state.nome || "—")}</div>
            </div>
            <div class="kv">
              <div class="kv__k">Localização</div>
              <div class="kv__v">${escapeHtml(state.loc || "—")}</div>
            </div>
            <div class="kv">
              <div class="kv__k">ID/Serial</div>
              <div class="kv__v">${escapeHtml(state.serial || "—")}</div>
            </div>
            <div class="kv">
              <div class="kv__k">Vínculo</div>
              <div class="kv__v">${escapeHtml(state.vinculo || "—")}</div>
            </div>
            <div class="kv">
              <div class="kv__k">Tipo de Equipamento</div>
              <div class="kv__v"><strong>Irripump</strong></div>
            </div>
          </div>
        </div>

        <div class="summary-card card">
          <div class="summary-card__head">Status do Cadastro</div>
          <div class="summary-progress" role="group" aria-label="Progresso do cadastro">
            <div class="summary-progress__label">Pronto para finalizar</div>
            <div
              class="summary-progress__bar"
              role="progressbar"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow="${progress}"
            >
              <span style="width:${progress}%"></span>
            </div>
            <div class="summary-progress__meta">${progress}%</div>
          </div>

          <div class="status-list">
            <div class="status-item">
              <span class="status-dot ${modules.length ? "is-ok" : "is-warn"}"></span>
              <span class="status-label">Módulos</span>
              <span class="status-val">${modules.length ? `${modules.length} <span>configurado(s)</span>` : "Nenhum módulo"}</span>
            </div>
            <div class="status-item">
              <span class="status-dot ${funcsAtivas.length ? "is-ok" : "is-warn"}"></span>
              <span class="status-label">Funções ativas</span>
              <span class="status-val">${funcsAtivas.length ? `${funcsAtivas.length} <span>selecionada(s)</span>` : "Nenhuma"}</span>
            </div>
            <div class="status-item">
              <span class="status-dot ${missing.length ? "is-warn" : "is-ok"}"></span>
              <span class="status-label">Parâmetros</span>
              <span class="status-val">${missing.length ? "Faltando" : "OK"}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="summary-grid2 summary-grid2--stack">
        <div class="summary-card card">
          <div class="summary-card__head">Funções e Parâmetros</div>
          <div class="summary-card__sub">Confira os tipos selecionados para cada função ativa.</div>
          <div class="summary-funcs">
            ${funcsHtml}
          </div>
        </div>

        <div class="summary-card card">
          <div class="summary-card__head"><span>Módulos Configurados</span> (${modules.length})</div>
          <div class="summary-card__sub">Lista dos módulos vinculados a este equipamento.</div>
          <div class="table-wrap">
            <table class="tbl tbl--modules">
              <thead>
                <tr>
                  <th>Nome do Módulo</th>
                  <th>Serial</th>
                  <th>Origem</th>
                </tr>
              </thead>
              <tbody>
                ${moduleRows || `<tr><td colspan="3" class="muted">Nenhum módulo configurado.</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
      `;
    },
  };
})();
