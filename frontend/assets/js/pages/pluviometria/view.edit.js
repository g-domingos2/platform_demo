// assets/js/pages/pluviometria/view.edit.js
(function () {
  "use strict";
  const tMsg = (text) => window.IcI18n?.t?.(text) ?? text;

  const Plv = (window.Plv = window.Plv || {});
  const data = (Plv.data = Plv.data || {});
  const state = (Plv.state = Plv.state || {});
  const dom = (Plv.dom = Plv.dom || {});
  const views = (Plv.views = Plv.views || {});
  const edit = (views.edit = views.edit || {});
  const $ = dom.$ || ((id) => document.getElementById(id));

  const formatLatLng =
    dom.formatLatLng ||
    ((lat, lng) => {
      if (lat == null || lng == null) return "—";
      const a = Number(lat);
      const b = Number(lng);
      if (Number.isNaN(a) || Number.isNaN(b)) return "—";
      return `${a.toFixed(6)}, ${b.toFixed(6)}`;
    });

  function parseLatLngText(value) {
    const raw = String(value || "").trim();
    if (!raw || raw === "—") return null;
    const match = raw.match(/(-?\d+(?:[.,]\d+)?)\s*[,;]\s*(-?\d+(?:[.,]\d+)?)/);
    if (!match) return null;
    const lat = Number(match[1].replace(",", "."));
    const lng = Number(match[2].replace(",", "."));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }

  function applyPluvioCoords(pluvio, lat, lng) {
    if (!pluvio || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    pluvio.lat = lat;
    pluvio.lng = lng;
    pluvio.__baseLat = lat;
    pluvio.__baseLng = lng;
    pluvio.__fixedLatLng = true;
    pluvio.__manualLocation = true;
  }

  async function mountEditPanel() {
    const slot = $("pageSlot");
    if (!slot) return false;

    try {
      const html = await fetch("./pages/pluviometria-edit.html").then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); });
      slot.innerHTML = html;

      bindEditUI();
      initSettingsFocus();
      renderEditSelect();
      renderEditSummary();
      initEditMap();
      return true;
    } catch (err) {
      console.error("[PluvEdit] Failed to load pluviometria-edit.html", err);
      return false;
    }
  }

  async function showEditView(options = {}) {
    document.body.classList.add("is-pluviometria");
    document.body.classList.add("is-pluviometria-edit");
    document.body.classList.remove("pluv-settings-open");

    const mapCard = $("mapCard");
    if (mapCard) mapCard.style.display = "none";

    data.loadPluviosFromStorage?.();

    state.isCreating = !!options.isNew;
    state.assocMapInitialized = false;
    state.assocSelectedId = null;

    if (state.isCreating) {
      state.settingsFocusId = "new_temp";
      const temp = {
        id: "new_temp",
        nome: "",
        sub: "",
        lat: null,
        lng: null,
        talhoesAssoc: [],
        status: "none",
        statusLabel: "Novo",
        tipo: "Báscula",
        alimentacao: "Bateria",
        unidade: "mm",
        uso: { irrigacao: true, alerts: true, relatorios: true },
      };
      data.PLUVIOS = (data.PLUVIOS || []).filter((p) => p.id !== "new_temp");
      data.PLUVIOS.unshift(temp);
    } else {
      data.PLUVIOS = (data.PLUVIOS || []).filter((p) => p.id !== "new_temp");
      if (!state.settingsFocusId || state.settingsFocusId === "new_temp") {
        state.settingsFocusId = (data.PLUVIOS[0] || {}).id;
      }
    }

    const mounted = await mountEditPanel();
    if (!mounted) {
      document.body.classList.remove("is-pluviometria-edit");
      if (mapCard) mapCard.style.display = "";
      return;
    }
    syncFocusFromSelection();
    initSettingsFocus();

    renderEditSelect();
    renderEditSummary();

    const map = window.icMap;
    if (map && typeof map.invalidateSize === "function") {
      map.invalidateSize({ pan: false });
      requestAnimationFrame(() => map.invalidateSize({ pan: false }));
      setTimeout(() => map.invalidateSize({ pan: false }), 180);
    }

    if (options.openSection) {
      requestAnimationFrame(() => openEditSection(options.openSection));
    }
  }

  function openEditSection(targetSelector) {
    if (!targetSelector) return;
    const configTab = document.querySelector('.edit-panel__tab[data-tab="config"]');
    configTab?.click();
    const nav = document.querySelector(`.edit-panel__nav-item[data-target="${targetSelector}"]`);
    nav?.click();
  }

  function bindEditUI() {
    const back = $("pluvEditBack");
    if (back && !back.dataset.bound) {
      back.dataset.bound = "1";
      back.addEventListener("click", (e) => {
        e.preventDefault();
        const pluvioId = state.settingsFocusId || (data.PLUVIOS || [])[0]?.id;
        window.IcPluvDetails?.open?.({ pluvioId, detailsType: "pluviometros" });
      });
    }

    const centerBtn = $("pluvEditCenterBtn");
    if (centerBtn && !centerBtn.dataset.bound) {
      centerBtn.dataset.bound = "1";
      centerBtn.addEventListener("click", () => {
        if (state.editMap) {
          const p = getFocusPluvio();
          if (p) {
            const c = state.editMap.getCenter();
            applyPluvioCoords(p, c.lat, c.lng);
          }
        }
        renderEditLocation();
        // ✅ atualiza marker/mapa SEM recriar mapa
        requestAnimationFrame(() => {
          updateEditMap();
          state.editMap?.invalidateSize?.({ pan: false });
        });

        // ✅ se o mapa de associação estiver aberto, move o marcador também
        syncAssocMarkerPositionForFocus();
      });
    }

    const centerInput = $("pluvEditCenter");
    if (centerInput && !centerInput.dataset.bound) {
      centerInput.dataset.bound = "1";
      const syncCenterInput = () => {
        const p = getFocusPluvio();
        const coords = parseLatLngText(centerInput.value);
        if (!p || !coords) return;
        applyPluvioCoords(p, coords.lat, coords.lng);
        updateEditMap();
        syncAssocMarkerPositionForFocus();
      };
      centerInput.addEventListener("change", syncCenterInput);
      centerInput.addEventListener("blur", syncCenterInput);
    }

    const pivotList = $("pluvEditPivotList");
    if (pivotList && !pivotList.dataset.bound) {
      pivotList.dataset.bound = "1";
      pivotList.addEventListener("change", (e) => {
        const input = e.target.closest("input[type='checkbox']");
        if (!input) return;
        const p = getFocusPluvio();
        if (!p) return;
        const value = input.value;
        const set = new Set(p.talhoesAssoc || []);
        if (input.checked) set.add(value);
        else set.delete(value);
        p.talhoesAssoc = Array.from(set);
      });
    }

    if (!document.body.dataset.editSelectBound) {
      document.body.dataset.editSelectBound = "1";
      document.addEventListener("click", (e) => {
        const pluvOption = e.target.closest("[data-pluv-option]");
        if (pluvOption) {
          const id = pluvOption.getAttribute("data-value");
          if (id) setSettingsFocus(id);
          closeCustomSelects();
          return;
        }

        const option = e.target.closest(".edit-panel__select-option");
        if (option) {
          const menu = option.closest("[data-edit-menu]");
          const kind = menu?.getAttribute("data-edit-menu");
          const value = option.getAttribute("data-value");
          const p = getFocusPluvio();
          if (kind && value && p) {
            const conf = (data.EDIT_SELECTS || {})[kind];
            if (conf) p[conf.key] = value;
            renderEditGeneral();
          }
          closeCustomSelects();
          return;
        }

        const pluvTrigger = e.target.closest("[data-pluv-select-trigger]");
        if (pluvTrigger) {
          const wrap = pluvTrigger.closest("[data-pluv-select]");
          if (!wrap) return;
          const isOpen = wrap.classList.contains("is-open");
          closeCustomSelects();
          wrap.classList.toggle("is-open", !isOpen);
          pluvTrigger.setAttribute("aria-expanded", !isOpen ? "true" : "false");
          return;
        }

        const trigger = e.target.closest("[data-edit-select]");
        if (trigger) {
          const wrap = trigger.closest(".edit-panel__select-field");
          if (!wrap) return;
          const isOpen = wrap.classList.contains("is-open");
          closeCustomSelects();
          wrap.classList.toggle("is-open", !isOpen);
          trigger.setAttribute("aria-expanded", !isOpen ? "true" : "false");
          return;
        }

        closeCustomSelects();
      });
    }

    document.querySelectorAll(".edit-panel__tab").forEach((tab) => {
      if (tab.dataset.bound) return;
      tab.dataset.bound = "1";
      tab.addEventListener("click", () => {
        const target = tab.getAttribute("data-tab");
        if (!target) return;
        document.querySelectorAll(".edit-panel__tab").forEach((btn) => {
          const active = btn === tab;
          btn.classList.toggle("is-active", active);
          btn.setAttribute("aria-selected", active ? "true" : "false");
        });
        document.querySelectorAll("[data-tab-body]").forEach((body) => {
          const active = body.getAttribute("data-tab-body") === target;
          body.classList.toggle("is-active", active);
        });
      });
    });

    document.querySelectorAll(".edit-panel__nav-item").forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", () => {
        document.querySelectorAll(".edit-panel__nav-item").forEach((item) => {
          item.classList.toggle("is-active", item === btn);
        });
        const target = btn.getAttribute("data-target");
        if (!target) return;
        document.querySelectorAll(".edit-panel__section").forEach((s) => s.classList.remove("is-active"));
        document.querySelector(target)?.classList.add("is-active");

        if (target === "#pluvEditMaintenance") {
          Plv.maintenance?.renderMaintenance?.();
        }

        if (target === "#pluvEditLocation") {
          setTimeout(() => {
            state.editMap?.invalidateSize?.();
            updateEditMap();
          }, 200);
        }
        if (target === "#pluvEditAssociation") {
          setTimeout(() => {
            initAssociationMap();
          }, 200);
        }
      });
    });

    const saveBtn = document.querySelector(".edit-panel__save");
    if (saveBtn && !saveBtn.dataset.bound) {
      saveBtn.dataset.bound = "1";
      saveBtn.addEventListener("click", handleSave);
    }
  }

  async function handleSave() {
    const p = getFocusPluvio();
    if (!p) return;

    const centerInput = $("pluvEditCenter");
    const typedCoords = parseLatLngText(centerInput?.value);
    if (typedCoords) {
      applyPluvioCoords(p, typedCoords.lat, typedCoords.lng);
    }

    const nameInput = $("pluvEditName");
    if (nameInput) p.nome = nameInput.value;

    const plotInput = $("pluvEditPlot");
    if (plotInput) p.sub = plotInput.value;

    if (state.isCreating && p.id === "new_temp") {
      p.id = "pluv_" + Date.now();
      state.settingsFocusId = p.id;
      state.isCreating = false;
    }

    state.selected?.clear?.();
    state.selected?.add?.(p.id);
    state.pendingMapFocusId = p.id;

    await data.persistPluvioToFarmEquipment?.(p);
    data.savePluviosToStorage?.();
    data.refreshPluvioRuntime?.();

    const activeFarm = window.IcFarmGetActive?.() || window.IcFarmActive;
    if (activeFarm) {
      window.IcMapRenderPivots?.(activeFarm);
      window.IcFarmApplyGeo?.(activeFarm);
    }

    const saveBtn = document.querySelector(".edit-panel__save");
    const originalHtml = saveBtn ? saveBtn.innerHTML : "";
    if (saveBtn) saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Salvo!';
    setTimeout(() => {
      if (saveBtn) saveBtn.innerHTML = originalHtml;
      Plv.views?.data?.showMainView?.();
    }, 800);
  }

  function syncFocusFromSelection() {
    if (state.selected?.size === 1) {
      const id = Array.from(state.selected)[0];
      if (id) setSettingsFocus(id);
    }
  }

  function getFocusPluvio() {
    return (
      (data.PLUVIOS || []).find((p) => p.id === state.settingsFocusId) ||
      (data.PLUVIOS || [])[0]
    );
  }

  function renderEditSelect() {
    const btn = $("pluvEditSelectBtn");
    const menu = $("pluvEditSelectMenu");
    if (!btn || !menu) return;

    const current =
      (data.PLUVIOS || []).find((p) => p.id === state.settingsFocusId) ||
      (data.PLUVIOS || [])[0];

    let currentLabel = "Selecionar pluviômetro";
    if (current) {
      if (current.id === "new_temp") currentLabel = "Novo Pluviômetro (Criando...)";
      else currentLabel = current.nome || "Novo Pluviômetro";
    }

    btn.textContent = currentLabel;
    btn.dataset.value = current?.id || "";

    menu.innerHTML = (data.PLUVIOS || [])
      .map((p) => {
        const label = p.nome || "Novo Pluviômetro";
        const isActive = current && p.id === current.id;
        return `
          <button class="edit-panel__select-option ${isActive ? "is-active" : ""}" type="button" data-pluv-option data-value="${p.id}">
            ${label}
          </button>
        `;
      })
      .join("");
  }

  function renderEditLocation() {
    const p = getFocusPluvio();
    if (!p) return;

    const center = $("pluvEditCenter");
    if (center) center.value = formatLatLng(p.lat, p.lng);

    const list = $("pluvEditPivotList");
    if (!list) return;

    const talhoes = data.loadTalhoes?.() || [];

    if (talhoes.length === 0) {
      list.innerHTML =
        '<div style="font-size:12px; color:#94a3b8; padding:4px;">Nenhum talhão encontrado nesta fazenda.</div>';
      return;
    }

    list.innerHTML = talhoes
      .map((t) => {
        const checked = (p.talhoesAssoc || []).includes(t.id);
        return `
          <label class="edit-panel__check">
            <input type="checkbox" value="${t.id}" ${checked ? "checked" : ""} />
            ${t.name || "Talhão"}
          </label>
        `;
      })
      .join("");
  }

  // ===============================
  // Edit map (single instance, move marker only)
  // ===============================
  function initEditMap() {
    const container = $("pluvEditMap");
    if (!container || !window.L) return;

    if (state.editMap) {
      // garante render ao voltar pra section
      requestAnimationFrame(() => state.editMap?.invalidateSize?.());
      updateEditMap();
      return;
    }

    state.editMap = L.map(container, { zoomControl: true, attributionControl: false });

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19 }
    ).addTo(state.editMap);

    L.tileLayer(
      "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, opacity: 0.85 }
    ).addTo(state.editMap);

    state.editMap.on("click", (e) => {
      const p = getFocusPluvio();
      if (!p || !e?.latlng) return;

      applyPluvioCoords(p, e.latlng.lat, e.latlng.lng);

      renderEditLocation();

      // move marker deste mapa
      updateEditMap();

      // move marker no mapa de associação (se estiver aberto)
      syncAssocMarkerPositionForFocus();
    });

    updateEditMap();
  }

  function updateEditMap() {
    const container = $("pluvEditMap");
    if (!container || !window.L) return;

    if (!state.editMap) initEditMap();
    if (!state.editMap) return;

    const p = getFocusPluvio();
    if (!p) return;

    const lat = p.lat == null || p.lat === "" ? NaN : Number(p.lat);
    const lng = p.lng == null || p.lng === "" ? NaN : Number(p.lng);

    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

    if (!hasCoords) {
      if (state.editMarker) {
        try { state.editMarker.remove(); } catch (_) { }
        state.editMarker = null;
      }
      state.editMap.setView([-15.79, -47.88], 4, { animate: false });
    } else {
      const ll = L.latLng(lat, lng);
      state.editMap.setView(ll, 16, { animate: false });

      if (state.editMarker) {
        state.editMarker.setLatLng(ll);
      } else {
        const pinIcon = L.divIcon({
          className: "",
          html: '<div style="color:#16a34a;font-size:28px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5));"><i class="fa-solid fa-location-dot"></i></div>',
          iconSize: [28, 28], iconAnchor: [14, 28],
        });
        state.editMarker = L.marker(ll, { icon: pinIcon, draggable: true }).addTo(state.editMap);

        state.editMarker.on("dragend", (e) => {
          const newPos = e.target.getLatLng();
          const p = getFocusPluvio();
          if (p) {
            applyPluvioCoords(p, newPos.lat, newPos.lng);
            renderEditLocation(); // Updates input field
            // Sync assoc marker if visible
            syncAssocMarkerPositionForFocus();
          }
        });
      }
    }

    setTimeout(() => state.editMap?.invalidateSize?.(), 50);
  }

  // compat: se alguém chamar, não quebra
  function initEditMapAt(center) {
    if (!Array.isArray(center) || center.length < 2) return;
    const p = getFocusPluvio();
    if (!p) return;
    applyPluvioCoords(p, center[0], center[1]);
    if (!state.editMap) initEditMap();
    updateEditMap();
  }

  function renderCustomSelect(kind, value) {
    const conf = (data.EDIT_SELECTS || {})[kind];
    if (!conf) return;
    const btn = document.querySelector(`[data-edit-select="${kind}"]`);
    const menu = document.querySelector(`[data-edit-menu="${kind}"]`);
    if (!btn || !menu) return;

    const current = value || conf.options[0];
    btn.textContent = current;
    btn.dataset.value = current;
    menu.innerHTML = conf.options
      .map(
        (opt) => `
          <button class="edit-panel__select-option ${opt === current ? "is-active" : ""}" type="button" data-value="${opt}">
            ${opt}
          </button>
        `
      )
      .join("");
  }

  function closeCustomSelects() {
    document.querySelectorAll(".edit-panel__select-field").forEach((wrap) => {
      wrap.classList.remove("is-open");
      const btn = wrap.querySelector("[data-edit-select]");
      if (btn) btn.setAttribute("aria-expanded", "false");
      const pluvBtn = wrap.querySelector("[data-pluv-select-trigger]");
      if (pluvBtn) pluvBtn.setAttribute("aria-expanded", "false");
    });
  }

  function renderEditGeneral() {
    const p = getFocusPluvio();
    if (!p) return;

    const note = $("pluvEditLastUpdate");
    if (note) note.innerHTML = p.updated ? `<span class="comm-label">Última comunicação:</span> ${p.updated}` : '<span class="comm-label">Última comunicação:</span> —';

    const name = $("pluvEditName");
    if (name) name.value = p.nome || "";

    const plot = $("pluvEditPlot");
    if (plot) plot.value = p.sub || "";

    const model = $("pluvEditModel");
    if (model) model.value = p.model || "";

    const network = $("pluvEditNetwork");
    if (network) network.value = p.net || "";

    const radioCentral = $("pluvEditRadioCentral");
    if (radioCentral) radioCentral.value = p.radioCentral || "";
    const radioControl = $("pluvEditRadioControl");
    if (radioControl) radioControl.value = p.radioControlador || "";
    const radioGps = $("pluvEditRadioGps");
    if (radioGps) radioGps.value = p.radioGps || "";

    renderCustomSelect("type", p.tipo || (data.EDIT_TYPES || [])[0]);
    renderCustomSelect("power", p.alimentacao || (data.EDIT_POWER || [])[0]);
    renderCustomSelect("unit", p.unidade || (data.EDIT_UNITS || [])[0]);

    const powerState = $("pluvEditPowerState");
    if (powerState) powerState.textContent = `Estado: ${p.alimentacaoEstado || "—"}`;

    const use = p.uso || {};
    const useIrr = $("pluvEditUseIrrigation");
    const useAlerts = $("pluvEditUseAlerts");
    const useReports = $("pluvEditUseReports");
    if (useIrr) useIrr.checked = !!use.irrigacao;
    if (useAlerts) useAlerts.checked = !!use.alertas;
    if (useReports) useReports.checked = !!use.relatorios;
  }

  function renderEditSummary() {
    renderEditGeneral();
    renderEditLocation();
    // mapa NÃO aqui: ele é controlado por setSettingsFocus / initEditMap / nav click
  }

  function renderSensors() {
    const host = document.querySelector('[data-section-body="sensors"]');
    if (!host) return;

    const p = getFocusPluvio();
    const dataItem =
      (p && (data.PLUV_SENSORS || {})[p.id]) || (data.PLUV_SENSORS || {})["norte-a"];
    if (!dataItem) return;

    const pulse = Number(dataItem.pulse);
    const pulseValue = Number.isFinite(pulse) ? pulse.toFixed(2) : String(dataItem.pulse || "");
    const min = Number(dataItem.thresholdMin);
    const mins = Number(dataItem.thresholdMinMinutes);

    host.innerHTML = `
      <div class="pluv-sensors">
        <div class="pluv-sensors__grid">
          <div class="pluv-sensors__field">
            <label for="pluvSensorModel">Modelo do Sensor</label>
            <input class="pluv-sensors__input" id="pluvSensorModel" value="${dataItem.model}" />
          </div>
          <div class="pluv-sensors__field">
            <label for="pluvSensorPulse">Valor por Pulso (mm)</label>
            <input class="pluv-sensors__input" id="pluvSensorPulse" type="number" inputmode="decimal" step="0.01" value="${pulseValue}" />
            <span class="pluv-sensors__hint">Até 2 casas decimais</span>
          </div>
        </div>

        <div class="pluv-sensors__divider"></div>

        <div class="pluv-sensors__section-title">Chuva Válida (threshold)</div>
        <div class="pluv-sensors__inline">
          <div class="pluv-sensors__field">
            <label for="pluvSensorMin">Mínimo (mm)</label>
            <input class="pluv-sensors__input" id="pluvSensorMin" value="${min}" />
          </div>
          <span class="pluv-sensors__inline-text">em</span>
          <div class="pluv-sensors__field">
            <label for="pluvSensorTime">Tempo (min)</label>
            <input class="pluv-sensors__input" id="pluvSensorTime" value="${mins}" />
          </div>
        </div>

        <div class="pluv-sensors__note">
          <span>Considera chuva válida se &gt;</span>${min}<span>mm em</span> ${mins} <span>minutos</span>
        </div>
      </div>
    `;
  }

  function clampLimit(value) {
    const n = Number(value);
    if (Number.isNaN(n)) return 10;
    return Math.min(99, Math.max(10, Math.round(n)));
  }

  function renderRedundancy() {
    const host = document.querySelector('[data-section-body="redundancy"]');
    if (!host) return;

    const p = getFocusPluvio();
    const dataItem =
      (p && (data.PLUV_REDUNDANCY || {})[p.id]) || (data.PLUV_REDUNDANCY || {})["norte-a"];
    if (!dataItem) return;

    const limit = clampLimit(dataItem.limit);
    const isAlertOn = !!dataItem.alertAuto;
    const hintText = isAlertOn
      ? "Alertar quando a diferença entre sensores exceder este limite"
      : "Ative o alerta para definir o limite de divergência";
    const disabledClass = isAlertOn ? "" : "is-disabled";
    const disabledAttr = isAlertOn ? "" : "disabled";

    host.innerHTML = `
      <div class="pluv-red">
        <div class="pluv-red__row pluv-red__row--main">
          <div class="pluv-red__control ${disabledClass}">
            <div class="pluv-red__label">Limite de divergência</div>
            <div class="pluv-red__slider">
              <input type="range" id="pluvRedRange" min="0" max="100" step="1" value="${limit}" data-red-range style="--red-fill: ${limit}%;" ${disabledAttr} />
              <span class="pluv-red__value" data-red-value>${limit}%</span>
            </div>
            <div class="pluv-red__hint" data-red-hint>${hintText}</div>
          </div>

          <div class="pluv-red__alert">
            <div class="pluv-red__alert-left">
              <span class="pluv-red__alert-ico"><i class="fa-solid fa-triangle-exclamation"></i></span>
              <div>
                <div class="pluv-red__title">Alerta automático</div>
                <div class="pluv-red__sub">quando exceder o limite</div>
              </div>
            </div>
            <button class="pluv-switch ${isAlertOn ? "is-on" : ""}" type="button" data-red-toggle="alert" aria-pressed="${isAlertOn ? "true" : "false"}"></button>
          </div>
        </div>
      </div>
    `;

    const rangeInput = host.querySelector("input[data-red-range]");
    if (rangeInput) {
      rangeInput.addEventListener("input", () => {
        const pct = `${rangeInput.value}%`;
        rangeInput.style.setProperty("--red-fill", pct);
        const valueEl = host.querySelector("[data-red-value]");
        if (valueEl) valueEl.textContent = pct;
      });
    }
  }

  // ===============================
  // Assoc map helpers (highlight + sync position)
  // ===============================
  function getAssocIcons() {
    if (!window.L) return null;
    if (state.assocIcons) return state.assocIcons;

    const normal = new L.Icon.Default();

    const selected = new L.Icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    state.assocIcons = { normal, selected };
    return state.assocIcons;
  }

  function ensureAssocMarker(p) {
    if (!state.assocMap || !p || p.lat == null || p.lng == null || !window.L) return null;

    state.assocMarkers = state.assocMarkers || {};
    const icons = getAssocIcons();
    if (!icons) return null;

    const { normal } = icons;
    let marker = state.assocMarkers[p.id];

    if (!marker) {
      marker = L.marker([p.lat, p.lng], { title: p.nome || "Pluviômetro", icon: normal }).addTo(
        state.assocMap
      );

      marker.bindPopup(`<b>${p.nome || "Pluviômetro"}</b><br/>${formatLatLng(p.lat, p.lng)}`);

      marker.on("click", () => {
        setSettingsFocus(p.id);
        renderAssociationList();
        highlightAssocMarker(p.id);
        const item = document.querySelector(`[data-assoc-id="${p.id}"]`);
        item?.scrollIntoView({ behavior: "smooth", block: "center" });
      });

      state.assocMarkers[p.id] = marker;
    } else {
      marker.setLatLng([p.lat, p.lng]);
      marker.setPopupContent(`<b>${p.nome || "Pluviômetro"}</b><br/>${formatLatLng(p.lat, p.lng)}`);
    }

    return marker;
  }

  function syncAssocMarkerPositionForFocus() {
    if (!state.assocMapInitialized) return;
    const p = getFocusPluvio();
    if (!p) return;
    ensureAssocMarker(p);
    highlightAssocMarker(p.id);
  }

  function highlightAssocMarker(id) {
    if (!state.assocMap || !state.assocMarkers || !window.L) return;
    const icons = getAssocIcons();
    if (!icons) return;

    const { normal, selected } = icons;

    // Remove previous selection
    if (state.assocSelectedId && state.assocMarkers[state.assocSelectedId]) {
      state.assocMarkers[state.assocSelectedId].setIcon(normal);
    }

    // Update global state if clearing
    if (!id) {
      state.assocSelectedId = null;
      state.settingsFocusId = null; // Clear global focus too
      renderAssociationList(); // Updates list UI
      return;
    }

    // Start manual link mode?
    // If we have a selected pluvio, we can click on a talhao polygon to link.
    // Let's show a toast or hint?
    const hint = document.getElementById("pluvAssocHint");
    if (hint) {
      hint.textContent = `Selecione um Talhão no mapa ou na lista para vincular a "${marker.options.title || "este pluviômetro"}"`;
      hint.style.display = "block";
    }

    state.assocSelectedId = id;

    const marker = state.assocMarkers[id];
    if (marker) {
      marker.setIcon(selected);
      state.assocMap.panTo(marker.getLatLng(), { animate: true });
      marker.openPopup();
    }
  }

  function handleTalhaoClick(tId) {
    if (!state.assocSelectedId) return; // No pluv selected

    const pId = state.assocSelectedId;

    // Check if already linked
    const existing = (state.associations || []).find(a => a.pluvId === pId && a.talhaoId === tId);
    if (existing) {
      if (existing.type === 'manual') {
        if (confirm(tMsg("Remover vínculo manual?"))) {
          state.associations = state.associations.filter(a => a !== existing);
        }
      } else {
        // Promote to manual
        existing.type = 'manual';
        existing.confidence = 'high';
        alert(tMsg("Vínculo confirmado como manual!"));
      }
    } else {
      // Create new manual link
      if (!state.associations) state.associations = [];
      state.associations.push({
        talhaoId: tId,
        pluvId: pId,
        type: 'manual',
        confidence: 'high'
      });
      // alert(tMsg("Vínculo manual criado!"));
    }

    // Re-render
    renderTalhoesList();
    renderAssociationList();
    renderTalhoesPolygons();
  }

  // ===============================
  // Geometry Helpers
  // ===============================

  function isPointInPolygon(point, vs) {
    // ray-casting algorithm based on
    // https://github.com/substack/point-in-polygon
    const x = point.lat, y = point.lng;
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
      const xi = vs[i].lat, yi = vs[i].lng;
      const xj = vs[j].lat, yj = vs[j].lng;
      const intersect = ((yi > y) != (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function getPolygonCentroid(points) {
    if (!points || points.length === 0) return null;
    let lat = 0, lng = 0;
    points.forEach(p => {
      lat += p.lat;
      lng += p.lng;
    });
    return { lat: lat / points.length, lng: lng / points.length };
  }

  function getTalhaoPoints(t) {
    if (!t.points) return [];
    // Handle Leaflet LatLng objects or plain objects
    if (t.points[0] && typeof t.points[0].lat === 'number') return t.points;
    return [];
  }

  // ===============================
  // Association Logic
  // ===============================

  function setSettingsFocus(id) {
    state.settingsFocusId = id;

    Plv.maintenance?.renderMaintenance?.();
    renderSensors();
    renderRedundancy();
    renderEditSelect();
    renderEditGeneral();
    renderEditLocation();

    // ✅ força update do mapa no timing certo
    requestAnimationFrame(() => {
      updateEditMap();
      state.editMap?.invalidateSize?.({ pan: false });
      requestAnimationFrame(() => {
        updateEditMap();
        state.editMap?.invalidateSize?.({ pan: false });
      });
    });

    // ✅ se assoc map estiver aberto
    syncAssocMarkerPositionForFocus();
  }

  function initSettingsFocus() {
    if (!state.settingsFocusId) {
      state.settingsFocusId = (data.PLUVIOS || [])[0]?.id || null;
    }
    setSettingsFocus(state.settingsFocusId);
  }

  // ===============================
  // Association Map & Talhões
  // ===============================

  function loadTalhoes() {
    state.talhoes = [];
    try {
      const farmId = sessionStorage.getItem("ic_active_farm") || sessionStorage.getItem("ic_active_farm_id") || "default";
      if (typeof window.Cad?.data?.getTalhoesByFarm === "function") {
        state.talhoes = window.Cad.data.getTalhoesByFarm(farmId) || [];
      } else {
        const key = `talhoes_${farmId}`;
        const raw = localStorage.getItem(key);
        if (raw) {
          state.talhoes = JSON.parse(raw);
        }
      }
    } catch (e) {
      console.warn("Pluviometria: Failed to load talhoes", e);
    }
  }

  function calculateAssociations() {
    // 1. Keep manual associations
    const manual = (state.associations || []).filter(a => a.type === 'manual');
    let newAssocs = [...manual];

    const pluvios = data.PLUVIOS || [];
    const talhoes = state.talhoes || [];

    pluvios.forEach(p => {
      // Skip if already manually linked to a primary? 
      // Logic: specific link can be whatever, but let's check matches

      let bestMatch = null;
      let bestDist = Infinity;

      // Check against all talhões
      talhoes.forEach(t => {
        // Skip if this pair is already manual
        if (manual.some(m => m.pluvId === p.id && m.talhaoId === t.id)) return;

        const tPoints = getTalhaoPoints(t);
        if (tPoints.length < 3) return;

        const pPoint = { lat: Number(p.lat), lng: Number(p.lng) };
        if (!Number.isFinite(pPoint.lat) || !Number.isFinite(pPoint.lng)) return;

        // Rule 1: Point in Polygon
        if (isPointInPolygon(pPoint, tPoints)) {
          // High confidence match
          newAssocs.push({
            talhaoId: t.id,
            pluvId: p.id,
            type: 'auto',
            confidence: 'high'
          });
        }
        // Rule 2: Distance (800m) REMOVED per user request.
        // Only strict containment is allowed.
      });
    });

    state.associations = newAssocs;
    // Re-render
    renderTalhoesList();
    renderAssociationList();
    renderTalhoesPolygons(); // Update map lines
  }

  function getAssociationsForTalhao(tId) {
    return (state.associations || []).filter(a => a.talhaoId === tId);
  }

  function getAssociationsForPluvio(pId) {
    return (state.associations || []).filter(a => a.pluvId === pId);
  }

  function renderTalhoesList() {
    const list = document.getElementById("pluvTalhoesList");
    const count = document.getElementById("pluvTalhoesCount");
    if (!list) return;

    const items = state.talhoes || [];
    if (count) count.textContent = items.length;

    if (items.length === 0) {
      list.innerHTML = `<div class="edit-panel__empty" style="border:0">Nenhum talhão encontrado.</div>`;
      return;
    }

    list.innerHTML = items.map(t => {
      const assocs = getAssociationsForTalhao(t.id);
      let plugsHtml = "";

      if (assocs.length > 0) {
        plugsHtml = assocs.map(a => {
          const p = (data.PLUVIOS || []).find(pl => pl.id === a.pluvId);
          const pName = p ? (p.nome || "Pluv") : a.pluvId;

          let badgeClass = "pluv-badge--neutral";
          let icon = "";
          if (a.type === 'auto') { badgeClass = "pluv-badge--success"; icon = "🟢"; }
          else if (a.type === 'suggested') { badgeClass = "pluv-badge--warn"; icon = "🟡"; }
          else if (a.type === 'manual') { badgeClass = "pluv-badge--info"; icon = "🔵"; }

          return `<div class="pluv-assoc__chip ${badgeClass}">${icon} ${pName}</div>`;
        }).join("");
      } else {
        plugsHtml = `<div class="pluv-assoc__chip pluv-badge--neutral">🔴 Sem vínculo</div>`;
      }

      return `
        <div class="pluv-assoc__item" data-talhao-id="${t.id}">
           <div class="pluv-assoc__item-row">
             <span class="pluv-assoc__item-name">${t.name || "Sem nome"}</span>
           </div>
           <div class="pluv-assoc__item-meta">${t.crop || "—"} • ${t.area ? t.area + " ha" : "—"}</div>
           <div class="pluv-assoc__chips">
             ${plugsHtml}
           </div>
        </div>
      `;
    }).join("");

    // Bind click for manual association
    list.querySelectorAll(".pluv-assoc__item").forEach(el => {
      el.addEventListener("click", () => {
        const tId = el.dataset.talhaoId;
        handleTalhaoClick(tId);
      });
    });
  }

  function renderTalhoesPolygons() {
    if (!state.assocMap || !window.L) return;

    if (!state.talhaoLayer) {
      state.talhaoLayer = L.featureGroup().addTo(state.assocMap);
    } else {
      state.talhaoLayer.clearLayers();
    }

    // Also clear connections layer
    if (!state.connLayer) {
      state.connLayer = L.layerGroup().addTo(state.assocMap);
    } else {
      state.connLayer.clearLayers();
    }

    const items = state.talhoes || [];
    items.forEach(t => {
      const pts = getTalhaoPoints(t);
      if (pts.length < 3) return;

      // Polygon
      const poly = L.polygon(pts, {
        color: '#16a34a',
        weight: 2,
        fillColor: '#16a34a',
        fillOpacity: 0.2,
        dashArray: null
      }).addTo(state.talhaoLayer);

      poly.bindTooltip(t.name, { permanent: false, direction: 'center', className: 'pluv-tooltip' });

      poly.on('mouseover', function () {
        this.setStyle({ weight: 3, fillOpacity: 0.4, color: '#15803d' });
      });
      poly.on('mouseout', function () {
        this.setStyle({ weight: 2, fillOpacity: 0.2, color: '#16a34a' });
      });

      // Click to associate
      poly.on('click', function () {
        handleTalhaoClick(t.id);
      });

      // Connections logic is separate
    });

    // Fit bounds if we have talhoes and map is not already focused on a specific marker?
    // Or just extend bounds?
    if (items.length > 0 && state.talhaoLayer.getLayers().length > 0) {
      try {
        // If manual/initial load, fit bounds
        if (!state.assocSelectedId) {
          state.assocMap.fitBounds(state.talhaoLayer.getBounds(), { padding: [50, 50] });
        }
      } catch (e) { console.warn("FitBounds error", e); }
    }

    // Connections
    items.forEach(t => {
      const assocs = getAssociationsForTalhao(t.id);
      assocs.forEach(a => {
        const p = (data.PLUVIOS || []).find(pl => pl.id === a.pluvId);
        if (p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))) {
          const center = getPolygonCentroid(t.points);
          if (center) {
            const color = a.type === 'auto' ? '#16a34a' : (a.type === 'suggested' ? '#eab308' : '#2563eb');
            const dash = a.type === 'suggested' ? '5, 5' : null;

            L.polyline([[center.lat, center.lng], [p.lat, p.lng]], {
              color: color,
              weight: 2,
              dashArray: dash,
              opacity: 0.6
            }).addTo(state.connLayer);
          }
        }
      });
    });
  }

  function initAssociationMap() {
    const container = document.getElementById("pluvAssocMap");
    if (!container || !window.L) return;

    // Button Auto-Associate logic
    const autoBtn = document.getElementById("btnAutoAssoc");
    if (autoBtn && !autoBtn.dataset.bound) {
      autoBtn.dataset.bound = "1";
      autoBtn.addEventListener("click", () => {
        calculateAssociations();
        // Toast?
        alert(tMsg("Associações recalculadas!"));
      });
    }

    if (state.assocMapInitialized) {
      state.assocMap?.invalidateSize?.();
      syncAssocMarkerPositionForFocus();
      // Ensure data is loaded
      loadTalhoes();
      renderAssociationList();
      // Ensure talhões are visible
      renderTalhoesList();
      renderTalhoesPolygons();
      return;
    }

    // Load Data
    loadTalhoes();
    renderTalhoesList();

    state.assocMap = L.map(container, { zoomControl: true, attributionControl: false }).setView(
      [-15.79, -47.88],
      4
    );

    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
    }).addTo(state.assocMap);

    L.tileLayer(
      "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, opacity: 0.85 }
    ).addTo(state.assocMap);

    // Render Polygons
    renderTalhoesPolygons();

    // Deselect on map click
    state.assocMap.on("click", () => {
      highlightAssocMarker(null);
    });

    if (state.assocMarkers) {
      Object.values(state.assocMarkers).forEach((m) => {
        try { m.remove(); } catch (_) { }
      });
    }
    state.assocMarkers = {};

    const pluvios = data.PLUVIOS || [];
    const bounds = L.latLngBounds();

    pluvios.forEach((p) => {
      if (p.lat != null && p.lng != null) {
        const m = ensureAssocMarker(p);
        if (m) bounds.extend(m.getLatLng());
      }
    });

    if (!bounds.isValid()) {
      state.assocMap.setView([-12.98, -48.06], 13);
    } else {
      state.assocMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }

    syncAssocMarkerPositionForFocus();

    const searchInput = document.getElementById("pluvAssocSearch");
    if (searchInput && !searchInput.dataset.bound) {
      searchInput.dataset.bound = "1";
      searchInput.addEventListener("input", () => {
        renderAssociationList();
      });
    }

    state.assocMapInitialized = true;
    renderAssociationList();
  }

  function renderAssociationList() {
    const list = document.getElementById("pluvAssocList");
    const count = document.getElementById("pluvAssocCount");
    const searchInput = document.querySelector("#pluvAssocSearch input");
    if (!list) return;

    let pluvios = data.PLUVIOS || [];

    if (searchInput && searchInput.value) {
      const term = searchInput.value.toLowerCase();
      pluvios = pluvios.filter(
        (p) =>
          (p.nome || "").toLowerCase().includes(term) ||
          (p.sub || "").toLowerCase().includes(term)
      );
    }

    if (count) count.textContent = pluvios.length;

    // Sort: Linked first? Or just list all.
    // Let's keep default sort but show badges.

    list.innerHTML = pluvios
      .map((p) => {
        const isSelected = p.id === state.settingsFocusId;
        const assocs = getAssociationsForPluvio(p.id);

        let badgeHtml = "";
        if (assocs.length > 0) {
          // Pick highest confidence or just show count?
          // "Vinculado (2)"
          const isAuto = assocs.some(a => a.type === 'auto');
          const isSug = assocs.some(a => a.type === 'suggested');
          const isManual = assocs.some(a => a.type === 'manual');

          if (isManual || isAuto) {
            badgeHtml = `<span class="pluv-badge--success" style="font-size:9px; padding:2px 4px; border-radius:4px;">Vinculado</span>`;
          } else if (isSug) {
            badgeHtml = `<span class="pluv-badge--warn" style="font-size:9px; padding:2px 4px; border-radius:4px;">Sugerido</span>`;
          }
        }

        return `
          <div class="pluv-assoc__item ${isSelected ? "is-selected" : ""}" data-assoc-id="${p.id}">
            <div class="pluv-assoc__item-row">
              <span class="pluv-assoc__item-name">${p.nome || "Novo Pluviômetro"}</span>
              ${badgeHtml}
              <i class="fa-solid fa-chevron-right"></i>
            </div>
            <div class="pluv-assoc__item-meta">&nbsp;</div>
          </div>
        `;
      })
      .join("");

    // Bind clicks
    list.querySelectorAll(".pluv-assoc__item").forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.dataset.assocId;
        setSettingsFocus(id);
      });
    });
  }

  function bindSettingsUI() {
    const editBtn = $("pluvEditBtn");
    if (editBtn && !editBtn.dataset.bound) {
      editBtn.dataset.bound = "1";
      editBtn.addEventListener("click", (e) => {
        e.preventDefault();
        showEditView({ isNew: false });
      });
    }
  }

  // Exports
  edit.mountEditPanel = mountEditPanel;
  edit.showEditView = showEditView;
  edit.openEditSection = openEditSection;
  edit.bindEditUI = bindEditUI;
  edit.bindSettingsUI = bindSettingsUI;
  edit.syncFocusFromSelection = syncFocusFromSelection;
  edit.getFocusPluvio = getFocusPluvio;
  edit.renderEditSelect = renderEditSelect;
  edit.renderEditLocation = renderEditLocation;
  edit.renderEditSummary = renderEditSummary;
  edit.renderEditGeneral = renderEditGeneral;
  edit.initEditMap = initEditMap;
  edit.updateEditMap = updateEditMap;
  edit.renderSensors = renderSensors;
  edit.renderRedundancy = renderRedundancy;
  edit.setSettingsFocus = setSettingsFocus;
  edit.initSettingsFocus = initSettingsFocus;

  // opcional console
  edit.initAssociationMap = initAssociationMap;
  edit.renderAssociationList = renderAssociationList;
  edit.initEditMapAt = initEditMapAt;
})();
