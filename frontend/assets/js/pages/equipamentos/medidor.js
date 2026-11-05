// assets/js/pages/equipamentos/medidor.js
(function () {
  "use strict";

  window.IcEquipamentos = window.IcEquipamentos || {};

  // ========= Helpers =========
  // pinIcon compartilhado — ver assets/js/core/map-icons.js
  const { pinIcon } = window.IcMapIcons;
  // escapeHtml/parseLatLng compartilhados — ver assets/js/core/geo-utils.js
  const { escapeHtml, parseLatLng } = window.IcGeo;
  const t = (text) => window.IcI18n?.t?.(text) ?? text;

  window.IcEquipamentos.medidor = {
    label: "Medidor de Nível",

    // =================
    // STEP 2 — Localização
    // =================
    renderStep2(container, state) {
      const loc = state.loc ?? "";

      container.innerHTML = `
        <div class="equip-page equip-page--link">
          <div class="equip-page__title"></div>
          <div class="equip-page__sub"></div>

          <div class="equip-form">
            <div class="equip-field">
              <label class="equip-label" for="mdLoc"><span class="equip-required">*</span>Localização do equipamento</label>
              <div class="rp-loc__row">
                <div class="rp-loc__input">
                  <input class="equip-input" id="mdLoc" placeholder="Ex: -23.5505, -46.6333" value="${escapeHtml(loc)}" />
                </div>
                <button class="equip-btn btn btn--outline rp-loc__btn" type="button" data-action="md-get-loc">
                  <i class="fa-solid fa-location-dot" aria-hidden="true" style="color:#22c55e;"></i> Obter Localização
                </button>
              </div>
            </div>

            <div id="mdMiniMap" class="equip-mini-map"></div>
            <div class="equip-mini-map__hint"></div>
          </div>
        </div>
      `;

      this.initMiniMap(container, state);
    },

    initMiniMap(container, state) {
      if (!window.L) return;

      const mapEl = container.querySelector("#mdMiniMap");
      const inputLoc = container.querySelector("#mdLoc");
      if (!mapEl || !inputLoc) return;

      if (state._miniMap) {
        try { state._miniMap.remove(); } catch (e) {}
        state._miniMap = null;
      }

      let center = [-16.767, -47.613];
      let zoom = 16;

      if (typeof state.lat === "number" && typeof state.lng === "number") {
        center = [state.lat, state.lng];
        zoom = 17;
      }

      const miniMap = L.map(mapEl, { zoomControl: false }).setView(center, zoom);

      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, attribution: "Tiles © Esri" }
      ).addTo(miniMap);

      L.tileLayer(
        "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, opacity: 0.85 }
      ).addTo(miniMap);

      const marker = L.marker(center, { icon: pinIcon(), draggable: true }).addTo(miniMap);

      const setPoint = (lat, lng) => {
        marker.setLatLng([lat, lng]);

        const txt = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        inputLoc.value = txt;

        state.loc = txt;
        state.lat = lat;
        state.lng = lng;
      };

      miniMap.on("click", (e) => setPoint(e.latlng.lat, e.latlng.lng));
      marker.on("dragend", () => {
        const { lat, lng } = marker.getLatLng();
        setPoint(lat, lng);
      });

      state._miniMap = miniMap;
      setTimeout(() => miniMap.invalidateSize(), 120);

      // Botão "Obter Localização" — usa o GPS do dispositivo
      const locBtn = container.querySelector('[data-action="md-get-loc"]');
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

    readStep2(container) {
      const loc = container.querySelector("#mdLoc")?.value?.trim() || "";

      const parsed = parseLatLng(loc);

      return {
        loc,
        lat: parsed?.lat ?? null,
        lng: parsed?.lng ?? null,
      };
    },

    validateStep2(data) {
      if (data.lat === null || data.lng === null) {
        return { ok: false, msg: "Informe uma Localização válida (Latitude, Longitude) ou clique no mapa." };
      }
      return { ok: true, msg: "" };
    },

    // =================
    // STEP 3 — Ficha Técnica (fluxo reduzido: Equipamento > Localização > Ficha Técnica)
    // =================
    renderConfigStep(container, state) {
      if (!state.version) state.version = "5.2";
      if (!state.sensor) state.sensor = "5MCA - Novus";

      const SENSORS = ["5MCA - Novus", "5MCA", "30MCA", "20MCA", "15MCA", "10MCA", "100MCA"];
      // A versão GH do Medidor de Nível é a 5.3 (a 5.2 é o legado não-GH).
      // Só GH fala com GH — o vínculo de bombas só existe na 5.3 (GH).
      const VERSIONS = [
        { value: "5.2", label: "5.2" },
        { value: "5.3", label: "5.3 (GH)" },
      ];

      container.innerHTML = `
        <div class="sc-config">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
            <div class="sc-field">
              <label class="equip-label" for="mdCfgNome"><span class="equip-required">*</span>Nome do equipamento</label>
              <input class="equip-input" id="mdCfgNome" type="text" placeholder="Medidor 01" value="${escapeHtml(state.nome || "")}" />
            </div>
            <div class="sc-field">
              <label class="equip-label" for="mdCfgVersao"><span class="equip-required">*</span>Versão</label>
              <select class="equip-input" id="mdCfgVersao">
                ${VERSIONS.map((v) => `<option value="${v.value}" ${state.version === v.value ? "selected" : ""}>${v.label}</option>`).join("")}
              </select>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
            <div class="sc-field">
              <label class="equip-label" for="mdCfgSensor"><span class="equip-required">*</span>Sensor</label>
              <select class="equip-input" id="mdCfgSensor">
                ${SENSORS.map((s) => `<option value="${escapeHtml(s)}" ${state.sensor === s ? "selected" : ""}>${escapeHtml(s)}</option>`).join("")}
              </select>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
            <div style="display:flex;align-items:center;gap:6px;">
              <h3 for="mdCfgVazaoEnabled" style="font-size:14px;color:#334155;font-weight:600;margin:0;">Vazão Residual</h3>
              <span class="edit-panel__tooltip-icon" data-tooltip="Quando o medidor de nível é instalado em um rio, a plataforma Irricontrol fornece a opção de você adicionar as constantes da curva chave, obtida através de medidas. Através da equação da curva chave e pelo valor de nível medido, a plataforma calcula a vazão residual e a exibe nos relatórios e na tela do respectivo dispositivo."><i class="fa-regular fa-circle-question"></i></span>
            </div>
            <label class="pivo-edit__switch">
              <input id="mdCfgVazaoEnabled" type="checkbox" ${state.vazaoEnabled ? "checked" : ""}>
              <span class="pivo-edit__switch-slider"></span>
            </label>
          </div>
          <div id="mdCfgVazaoFields" style="display:${state.vazaoEnabled ? "grid" : "none"};grid-template-columns:1fr 1fr 1fr;gap:12px;">
            <div class="sc-field">
              <label class="equip-label" for="mdCfgCoefA">A</label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="mdCfgCoefA" type="text" inputmode="decimal" placeholder="0" value="${escapeHtml(state.coefA ?? "")}" />
                <span class="sc-input-suffix">x²</span>
              </div>
            </div>
            <div class="sc-field">
              <label class="equip-label" for="mdCfgCoefB">B</label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="mdCfgCoefB" type="text" inputmode="decimal" placeholder="0" value="${escapeHtml(state.coefB ?? "")}" />
                <span class="sc-input-suffix">x</span>
              </div>
            </div>
            <div class="sc-field">
              <label class="equip-label" for="mdCfgCoefC">C</label>
              <input class="equip-input" id="mdCfgCoefC" type="text" inputmode="decimal" placeholder="0" value="${escapeHtml(state.coefC ?? "")}" />
            </div>
          </div>
          <div id="mdCfgVazaoDivider" style="height:1px;background:#e5e7eb;margin:16px 0 0;display:none;"></div>
        </div>
      `;

      // Trocar a versão (5.2 <-> 5.3 GH) mostra/esconde o vínculo de bombas
      // inline dentro do próprio Step 3 — sem recriar o step inteiro.
      const verSel = container.querySelector("#mdCfgVersao");
      const vazaoDivider = container.querySelector("#mdCfgVazaoDivider");
      const toggleBombas = () => {
        state.version = verSel.value;
        let bombaWrap = container.querySelector("#mdCfgBombasWrap");
        if (state.version === "5.3") {
          if (vazaoDivider) vazaoDivider.style.display = "";
          if (!bombaWrap) {
            bombaWrap = document.createElement("div");
            bombaWrap.id = "mdCfgBombasWrap";
            container.appendChild(bombaWrap);
            this.renderBombasContent(bombaWrap, state);
          }
        } else {
          if (vazaoDivider) vazaoDivider.style.display = "none";
          if (bombaWrap) bombaWrap.remove();
        }
      };

      if (verSel) {
        verSel.addEventListener("change", toggleBombas);
      }

      // Estado inicial: mostra bombas se já estiver em 5.3
      toggleBombas();

      // Toggle Vazão Residual
      const vazaoToggle = container.querySelector("#mdCfgVazaoEnabled");
      const vazaoFields = container.querySelector("#mdCfgVazaoFields");
      if (vazaoToggle && vazaoFields) {
        vazaoToggle.addEventListener("change", () => {
          state.vazaoEnabled = vazaoToggle.checked;
          vazaoFields.style.display = state.vazaoEnabled ? "grid" : "none";
        });
      }
    },

    readConfigStep(container, state) {
      return {
        nome: container.querySelector("#mdCfgNome")?.value?.trim() || "",
        version: container.querySelector("#mdCfgVersao")?.value || "5.2",
        sensor: container.querySelector("#mdCfgSensor")?.value || "5MCA - Novus",
        vazaoEnabled: !!container.querySelector("#mdCfgVazaoEnabled")?.checked,
        coefA: container.querySelector("#mdCfgCoefA")?.value?.trim() || "",
        coefB: container.querySelector("#mdCfgCoefB")?.value?.trim() || "",
        coefC: container.querySelector("#mdCfgCoefC")?.value?.trim() || "",
        bombas: state?.version === "5.3" ? (state.bombas || []) : [],
      };
    },

    validateConfigStep(data) {
      const missing = [];
      if (!data.nome) missing.push("Nome do equipamento");
      if (missing.length) {
        return { ok: false, msg: `Preencha os campos obrigatórios:\n• ${missing.join("\n• ")}` };
      }
      return { ok: true, msg: "" };
    },

    // =================
    // STEP — Nível
    // =================
    renderNivelStep(container, state) {
      // O desligamento automático de bombas ao atingir o valor máximo só
      // existe na versão 5.3 (GH) — a 5.2 não tem step "Bombas Vinculadas"
      // nem fala com bombas GH, então o texto de apoio varia conforme a
      // versão pra não prometer um comportamento que a 5.2 não tem.
      const isGH = state.version === "5.3";
      const graphInfoText = "Esses valores servem para inserir linhas de referência aos gráficos de medição de nível. Na versão 5.3 (GH), o valor máximo também pode ser usado para desligar automaticamente as bombas GH vinculadas.";
      const maxValueTooltip = isGH
        ? "Valor máximo percentual desejado do nível máximo do reservatório. Ao atingir esse valor, o Medidor de Nível desliga automaticamente as bombas GH vinculadas."
        : "Valor máximo percentual desejado do nível máximo do reservatório, para referência visual das medições.";

      container.innerHTML = `
        <div class="sc-config">
          <h3 class="pref-section-title" style="margin-top:0; font-size:14px;">Informações do Sensor</h3>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="sc-field">
              <label class="equip-label" for="mdNivelMax"><span class="equip-required">*</span> Nível máximo do reservatório <span class="edit-panel__tooltip-icon" data-tooltip="Nível máximo de água que o reservatório foi projetado para suportar."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="mdNivelMax" type="text" inputmode="decimal" placeholder="0" value="${escapeHtml(state.nivelMax ?? "")}" />
                <span class="sc-input-suffix">m</span>
              </div>
            </div>
            <div class="sc-field">
              <label class="equip-label" for="mdNivelOffset"><span class="equip-required">*</span> Offset de medição <span class="edit-panel__tooltip-icon" data-tooltip="Valor de ajuste para medições de nível, caso a sonda não chegue até o fundo do reservatório. A quantos metros acima do fundo do reservatório o sensor está instalado?"><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="mdNivelOffset" type="text" inputmode="decimal" placeholder="0" value="${escapeHtml(state.nivelOffset ?? "")}" />
                <span class="sc-input-suffix">m</span>
              </div>
            </div>
          </div>

          <h3 class="pref-section-title" style="font-size:14px;">Configurações de Gráfico</h3>
          <div style="display: flex; align-items: center; gap: 8px; background: #e6f4ff; border: 1px solid #91caff; border-radius: 8px; padding: 8px 12px; font-size: 13px; color: rgba(0,0,0,0.88); margin-bottom: 16px;">
            <i class="fa-solid fa-circle-info" style="color: #1677ff;"></i>
            <span>${graphInfoText}</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="sc-field">
              <label class="equip-label" for="mdNivelMin"><span class="equip-required">*</span> Valor mínimo <span class="edit-panel__tooltip-icon" data-tooltip="Valor mínimo percentual desejado do nível máximo do reservatório, para referência visual das medições."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="mdNivelMin" type="text" inputmode="decimal" placeholder="0" value="${escapeHtml(state.nivelValMin ?? "")}" />
                <span class="sc-input-suffix">%</span>
              </div>
            </div>
            <div class="sc-field">
              <label class="equip-label" for="mdNivelValMax"><span class="equip-required">*</span> Valor máximo <span class="edit-panel__tooltip-icon" data-tooltip="${maxValueTooltip}"><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="mdNivelValMax" type="text" inputmode="decimal" placeholder="100" value="${escapeHtml(state.nivelValMax ?? "")}" />
                <span class="sc-input-suffix">%</span>
              </div>
            </div>
          </div>
        </div>
      `;
    },

    readNivelStep(container) {
      return {
        nivelMax: container.querySelector("#mdNivelMax")?.value?.trim() || "",
        nivelOffset: container.querySelector("#mdNivelOffset")?.value?.trim() || "",
        nivelValMin: container.querySelector("#mdNivelMin")?.value?.trim() || "",
        nivelValMax: container.querySelector("#mdNivelValMax")?.value?.trim() || "",
      };
    },

    validateNivelStep(data) {
      const missing = [];
      if (data.nivelMax === "") missing.push("Nível máximo do reservatório");
      if (data.nivelOffset === "") missing.push("Offset de medição");
      if (data.nivelValMin === "") missing.push("Valor mínimo");
      if (data.nivelValMax === "") missing.push("Valor máximo");
      if (missing.length) {
        return { ok: false, msg: `Preencha os campos obrigatórios:\n• ${missing.join("\n• ")}` };
      }
      return { ok: true, msg: "" };
    },

    // =================
    // Bombas Vinculadas (conteúdo reutilizável — inline no Step 3 ou step próprio)
    // =================
    renderBombasContent(container, state) {
      if (!Array.isArray(state.bombas)) state.bombas = [];

      const allFarms = window.IcFarmsAll || [];
      const bombaOptions = [];
      allFarms.forEach((farm) => {
        (farm.equipments || []).forEach((eq) => {
          // Só GH fala com GH: o Medidor de Nível GH (5.3) só vincula a
          // Irripumps GH (versão 5.2 do Irripump).
          if (eq.type === "irripump" && String(eq.data?.version) === "5.2") {
            bombaOptions.push({ id: eq.id, label: eq.name });
          }
        });
      });

      container.innerHTML = `
        <div class="pref-divider" style="margin:0;"></div>
        <div class="sc-config" style="margin-top:16px;">
          <div style="display: flex; align-items: center; gap: 8px; background: #e6f4ff; border: 1px solid #91caff; border-radius: 8px; padding: 8px 12px; font-size: 13px; color: rgba(0,0,0,0.88); margin-bottom: 16px;">
            <i class="fa-solid fa-circle-info" style="color: #1677ff;"></i>
            <span>Nesta aba você pode vincular o Medidor de Nível a até 10 bombas GH para que ele possa automaticamente interromper os bombeamentos ativos caso atinja os níveis configurados.</span>
          </div>

          <div class="sc-field">
            <label class="equip-label" for="mdBombaTrigger">Bombas vinculadas</label>
            <div class="equip-select" id="mdBombaWrap" style="position:relative;">
              <button type="button" class="equip-select__trigger" id="mdBombaTrigger" aria-haspopup="listbox" aria-expanded="false">
                <span class="equip-select__value" id="mdBombaTriggerLabel">Por favor selecione</span>
                <i class="fa-solid fa-chevron-down"></i>
              </button>
              <div class="equip-select__list" role="listbox" id="mdBombaMenu" style="display:none;"></div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px; background: #fffbe6; border: 1px solid #ffe58f; border-radius: 8px; padding: 8px 12px; font-size: 13px; color: rgba(0,0,0,0.88); margin-top: 16px;">
            <i class="fa-solid fa-circle-exclamation" style="color: #faad14;"></i>
            <span>Ao salvar, este dispositivo e as bombas vinculadas terão suas configurações atualizadas conforme as novas relações no sistema.</span>
          </div>
        </div>
      `;

      const trigger = container.querySelector("#mdBombaTrigger");
      const triggerLabel = container.querySelector("#mdBombaTriggerLabel");
      const menu = container.querySelector("#mdBombaMenu");

      const renderChips = () => {
        const linked = bombaOptions.filter((o) => state.bombas.includes(o.id));
        if (!linked.length) {
          triggerLabel.textContent = "Por favor selecione";
          return;
        }
        const MAX_VISIBLE = 5;
        const visible = linked.slice(0, MAX_VISIBLE);
        const hidden = linked.slice(MAX_VISIBLE);
        const chips = visible.map((b) => `
          <span class="farm-report__chip">
            <span class="farm-report__chip-label">${escapeHtml(b.label)}</span>
            <button type="button" data-unlink-bomba="${escapeHtml(b.id)}" title="Desvincular">×</button>
          </span>`).join("");
        const overflow = hidden.length
          ? `<span class="farm-report__chip farm-report__chip--count" title="${escapeHtml(hidden.map((b) => b.label).join(", "))}">+${hidden.length}</span>`
          : "";
        triggerLabel.innerHTML = `<span class="farm-report__chips">${chips}${overflow}</span>`;
      };

      const renderMenu = () => {
        const available = bombaOptions.filter((o) => !state.bombas.includes(o.id));
        menu.innerHTML = available.length
          ? available.map((o) => `<button class="equip-select__option" type="button" data-value="${escapeHtml(o.id)}">${escapeHtml(o.label)}</button>`).join("")
          : `<button class="equip-select__option" type="button" disabled>Nenhuma disponível</button>`;
      };

      renderChips();
      renderMenu();

      const positionMenu = () => {
        const rect = trigger.getBoundingClientRect();
        const margin = 12;
        const spaceBelow = window.innerHeight - rect.bottom - margin;
        const spaceAbove = rect.top - margin;
        const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
        const maxHeight = Math.min(240, Math.max(120, openUp ? spaceAbove : spaceBelow));
        menu.style.left = `${rect.left}px`;
        menu.style.width = `${rect.width}px`;
        menu.style.maxHeight = `${maxHeight}px`;
        if (openUp) {
          menu.style.top = "";
          menu.style.bottom = `${window.innerHeight - rect.top + 6}px`;
        } else {
          menu.style.bottom = "";
          menu.style.top = `${rect.bottom + 6}px`;
        }
      };

      const closeMenu = () => {
        menu.style.display = "none";
        trigger.setAttribute("aria-expanded", "false");
      };

      trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = menu.style.display === "block";
        if (isOpen) { closeMenu(); return; }
        menu.style.display = "block";
        positionMenu();
        trigger.setAttribute("aria-expanded", "true");
      });

      menu.addEventListener("click", (e) => {
        const opt = e.target.closest("[data-value]");
        if (!opt || opt.disabled) return;
        if (state.bombas.length >= 10) { alert(t("Você pode vincular no máximo 10 bombas.")); return; }
        const id = opt.dataset.value;
        if (!state.bombas.includes(id)) state.bombas.push(id);
        renderChips();
        renderMenu();
        positionMenu();
      });

      triggerLabel.addEventListener("click", (e) => {
        const unlinkBtn = e.target.closest("[data-unlink-bomba]");
        if (!unlinkBtn) return;
        e.stopPropagation();
        state.bombas = state.bombas.filter((id) => id !== unlinkBtn.dataset.unlinkBomba);
        renderChips();
        renderMenu();
      });

      document.addEventListener("click", function closeOut(e) {
        if (!container.contains(e.target)) { document.removeEventListener("click", closeOut); return; }
        if (!e.target.closest("#mdBombaWrap") && !e.target.closest("#mdBombaMenu")) closeMenu();
      });
    },

    renderBombasStep(container, state) {
      this.renderBombasContent(container, state);
    },

    readBombasStep(container, state) {
      return { bombas: Array.isArray(state.bombas) ? state.bombas : [] };
    },

    validateBombasStep() {
      return { ok: true, msg: "" };
    },

    // =================
    // STEP — Conectividade
    // =================
    renderConnectivityStep(container, state) {
      // No cadastro só existe o rádio do próprio equipamento. O "Rádio da
      // central" é fixo (definido pela central da fazenda) e só aparece na
      // tela de edição, como campo somente-leitura.
      container.innerHTML = `
        <div class="sc-config">
          <div class="edit-panel__grid-3" style="grid-template-columns: repeat(3, 1fr); margin-bottom:16px;">
            <div class="farm-radio-field">
              <div class="farm-radio-field__header">
                <span class="farm-radio-field__label"><span class="equip-required">*</span> Rádio do Medidor de Nível</span>
              </div>
              <div class="farm-radio-field__value">
                <div class="sc-input-group">
                  <input class="equip-input sc-input farm-radio-input" id="mdConnRadio" type="text" placeholder="0013A20011D5F4EE" value="${escapeHtml(state.radio || "")}" />
                  <div class="farm-radio-actions">
                    <button type="button" class="farm-radio-clear" title="Limpar" data-clear="mdConnRadio"><i class="fa-solid fa-xmark"></i></button>
                    <span class="farm-radio-status"><i class="fa-solid fa-check"></i></span>
                  </div>
                  <button type="button" class="farm-radio-qr" title="Escanear QR Code"><i class="fa-solid fa-qrcode"></i></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      container.querySelector("#mdConnRadio")?.addEventListener("input", (e) => { state.radio = e.target.value.trim(); });
      container.querySelectorAll("[data-clear]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const target = container.querySelector(`#${btn.dataset.clear}`);
          if (target) { target.value = ""; target.dispatchEvent(new Event("input")); }
        });
      });
    },

    readConnectivityStep(container) {
      return {
        radio: container.querySelector("#mdConnRadio")?.value?.trim() || "",
      };
    },

    validateConnectivityStep(data) {
      if (!data.radio) {
        return { ok: false, msg: "Preencha os campos obrigatórios:\n• Rádio do Medidor de Nível" };
      }
      return { ok: true, msg: "" };
    },

  };
})();
