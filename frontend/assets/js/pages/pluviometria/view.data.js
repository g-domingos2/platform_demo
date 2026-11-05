// assets/js/pages/pluviometria/view.data.js
(function () {
  "use strict";

  const Plv = (window.Plv = window.Plv || {});
  const data = (Plv.data = Plv.data || {});
  const state = (Plv.state = Plv.state || {});
  const dom = (Plv.dom = Plv.dom || {});
  const views = (Plv.views = Plv.views || {});
  const dataView = (views.data = views.data || {});
  const $ = dom.$ || ((id) => document.getElementById(id));

  function renderData() {
    const title = $("pluvDataTitle");
    const hint = $("pluvDataHint");
    const kpis = $("pluvKpis");
    if (!title || !hint || !kpis) return;

    const list = Plv.cards?.selectedList?.() || [];

    if (Plv.cards?.isAllMode?.()) {
      title.textContent = "Dados — Todos os pluviômetros";
      hint.textContent = "Sem seleção: mostrando dados agregados.";
    } else if (state.selected.size === 1) {
      const only = list[0];
      title.textContent = `Dados — ${only?.nome || "Selecionado"}`;
      hint.textContent = "Mostrando apenas do selecionado.";
    } else {
      title.textContent = `Dados — ${state.selected.size} selecionados`;
      hint.textContent = "Mostrando apenas dos selecionados.";
    }

    // KPIs (placeholder)
    const total = list.reduce((acc, p) => acc + (Number(p.mm) || 0), 0);
    const off = list.filter((p) => p.semComunicacao).length;
    const max = list.reduce((m, p) => Math.max(m, Number(p.mm) || 0), 0);

    kpis.innerHTML = `
      <div class="pluv-box card">
        <div class="pluv-box__t">Chuva (soma)</div>
        <div class="pluv-box__v">${total.toFixed(1)} mm</div>
      </div>
      <div class="pluv-box card">
        <div class="pluv-box__t">Máximo (sensor)</div>
        <div class="pluv-box__v">${max.toFixed(1)} mm</div>
      </div>
      <div class="pluv-box card">
        <div class="pluv-box__t">Sem comunicação</div>
        <div class="pluv-box__v">${off}</div>
      </div>
    `;
  }

  async function mountPanel() {
    const slot = $("pageSlot");
    if (!slot) return;

    // você disse que está em frontend/pages/pluviometria.html
    const html = await fetch("./pages/pluviometria.html").then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); });
    slot.innerHTML = html;

    Plv.cards?.bindPluvFilters?.();
    Plv.maintenance?.bindMaintFilters?.();

    Plv.views?.edit?.bindSettingsUI?.();
    Plv.views?.edit?.initSettingsFocus?.();
  }

  async function showMainView() {
    document.body.classList.add("is-pluviometria");
    document.body.classList.add("pluv-panel-open");
    document.body.classList.remove("is-pluviometria-edit");
    Plv.maintenance?.stopMaintTimelineTicker?.();
    document.body.classList.remove("pluv-settings-open");
    window.IcMapClearPivots?.();

    // Mantemos os pivôs e marcadores da fazenda ativos no Dashboard
    // Plv.views?.map?.resetPluvPanelState?.();
    // window.IcMapClearPivots?.();
    // window.IcFarmHideMarkers?.();
    data.loadPluviosFromStorage?.();

    if (window.IcFarmApplyGeo && window.IcFarmActive) {
      window.IcFarmApplyGeo(window.IcFarmActive);
    }

    // const mapCard = $("mapCard");
    // if (mapCard) mapCard.style.display = "none";

    state.pluvFilter = "highlights";
    state.pluvSearch = "";
    state.maintFilter = null;
    state.expanded.clear();

    await mountPanel();

    const activeFarm = window.IcFarmGetActive?.() || window.IcFarmActive;
    const farmNameEl = $("pluvHeaderFarmName");
    if (farmNameEl) {
      farmNameEl.textContent = activeFarm?.name || "Fazenda Desconhecida";
    }

    Plv.periodPicker?.initPeriodPicker?.();
    Plv.maintenance?.renderMaintenanceCards?.();
    Plv.maintenance?.bindMaintenanceCards?.();
    Plv.cards?.hydrateRainIcons?.($("pluvPanel") || document);

    Plv.cards?.syncSelectionUI?.();
    const searchInput = $("pluvSearchInput");
    if (searchInput) searchInput.value = state.pluvSearch;
    Plv.cards?.renderCards?.();
    renderData();
    Plv.views?.map?.renderMarkers?.();
    if (state.pendingMapFocusId) {
      const focused = (data.PLUVIOS || []).find((item) => item.id === state.pendingMapFocusId);
      const lat = Number(focused?.lat);
      const lng = Number(focused?.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        window.icMap?.setView?.([lat, lng], 16);
      }
      state.pendingMapFocusId = null;
    }
    window.IcChuvaGeo?.open?.();

    Plv.rain?.bindRainUI?.();
    Plv.rain?.renderRainChart?.();
    bindClampPanels();
    scheduleClampPanels();
    Plv.views?.map?.bindPluvMapbar?.();
    Plv.reports?.bindReportFilter?.();
    Plv.views?.map?.updatePeriodDisplays?.();

    const map = window.icMap;
    if (map && typeof map.invalidateSize === "function") {
      map.invalidateSize({ pan: false });
      requestAnimationFrame(() => map.invalidateSize({ pan: false }));
      setTimeout(() => map.invalidateSize({ pan: false }), 180);
    }
  }

  function clampPanelList(listEl, count) {
    if (!listEl) return;
    const items = Array.from(listEl.children).filter((el) => el && el.nodeType === 1);
    if (items.length === 0) return;

    const take = Math.min(count, items.length);
    const styles = getComputedStyle(listEl);
    const gap = parseFloat(styles.rowGap || styles.gap || "0") || 0;

    let total = 0;
    for (let i = 0; i < take; i++) {
      total += items[i].getBoundingClientRect().height;
      if (i < take - 1) total += gap;
    }

    if (total > 0) {
      listEl.style.setProperty("--pluv-scroll-max", `${Math.ceil(total)}px`);
    }
  }

  function clampPanels() {
    clampPanelList(document.querySelector(".pluv-events"), 3);
    clampPanelList(document.querySelector(".pluv-maint"), 3);
  }

  function scheduleClampPanels() {
    if (state.clampTimer) clearTimeout(state.clampTimer);
    requestAnimationFrame(clampPanels);
    state.clampTimer = setTimeout(clampPanels, 140);
  }

  function bindClampPanels() {
    if (state.clampBound) return;
    state.clampBound = true;
    window.addEventListener("resize", scheduleClampPanels);
  }

  dataView.renderData = renderData;
  dataView.mountPanel = mountPanel;
  dataView.showMainView = showMainView;
  dataView.bindClampPanels = bindClampPanels;
  dataView.scheduleClampPanels = scheduleClampPanels;
})();
