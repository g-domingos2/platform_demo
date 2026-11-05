// assets/js/pages/pluviometria/index.js
(function () {
  "use strict";

  const Plv = (window.Plv = window.Plv || {});
  const data = (Plv.data = Plv.data || {});
  const state = (Plv.state = Plv.state || {});
  const views = (Plv.views = Plv.views || {});

  window.__devConfirmMaintenance = function () {
    if (!state.maintenanceState) return;
    state.maintenanceState.awaiting = false;
    state.maintenanceState.confirmedAt = "03/02/2026, 16:01";
    Plv.maintenance?.renderMaintenance?.();
  };

  window.IcPluviometria = {
    getSelectedCount() {
      return state.selected ? state.selected.size : 0;
    },

    getSelectedPluvios() {
      return Plv.cards?.selectedList?.() || [];
    },

    async open() {
      await views.data?.showMainView?.();
    },

    async initDashboardMode() {
      // Carrega dados e renderiza marcadores sem entrar na página completa
      if (data.loadPluviosFromStorage) await data.loadPluviosFromStorage();
      if (views.map?.bindPluvMapbar) views.map.bindPluvMapbar();
      if (views.map?.updatePeriodDisplays) views.map.updatePeriodDisplays();
    },

    async openEdit() {
      await views.edit?.showEditView?.();
    },

    close() {
      views.map?.resetPluvPanelState?.();
      Plv.maintenance?.stopMaintTimelineTicker?.();
      document.body.classList.remove("is-pluviometria");
      document.body.classList.remove("is-pluviometria-edit");
      document.body.classList.remove("pluv-has-selection");
      document.body.classList.remove("pluv-has-single-selection");
      document.body.classList.remove("pluv-settings-open");
      state.selected?.clear?.();
      state.expanded?.clear?.();

      // limpa slot
      const slot = document.getElementById("pageSlot");
      if (slot) slot.innerHTML = "";

      // remove markers APENAS se não estivermos no dashboard (indo para outra rota tipo Config ou Usuários)
      if (state.layer) {
        try { state.layer.remove(); } catch (_) { }
        state.layer = null;
      }
      if (window.icLayers) window.icLayers.pluviometros = null;

      // se estiver fechando pra valer (ex: trocando de fazenda), limpa. 
      // mas se estiver apenas "fechando a aba" dentro do dashboard, os marcadores ficam.

      // volta card do mapa
      const mapCard = document.getElementById("mapCard");
      if (mapCard) mapCard.style.display = "";

      // remove camada de chuva fora da Pluviometria
      // window.ChuvaGeo?.layers?.rain?.remove?.(); // Comentado para manter no dashboard

      // restaura ícones do mapa da fazenda ativa
      const activeFarm = window.IcFarmGetActive?.() || window.IcFarmActive;
      if (window.IcMapRenderPivots && activeFarm) {
        window.IcMapRenderPivots(activeFarm);
      }
      window.IcFarmShowMarker?.();

      refreshMap();

      // se outros módulos escutam isso (mapa.js já escuta)
      window.dispatchEvent(new Event("ic:layout-change"));
    },
  };

  function refreshMap() {
    const map = window.icMap;
    if (map && typeof map.invalidateSize === "function") {
      map.invalidateSize({ pan: false });
      requestAnimationFrame(() => map.invalidateSize({ pan: false }));
      setTimeout(() => map.invalidateSize({ pan: false }), 220);
    }
  }

  Plv.periodPicker?.initPeriodPicker?.();

  // ============================
  // Pluviometer Details Screen
  // ============================
  window.IcPluvDetails = {
    async open(options = {}) {
      const pluvioId = (options && typeof options === "object") ? (options.pluvioId ?? null) : options;
      const detailsType = (options && typeof options === "object") ? (options.detailsType || "pluviometros") : "pluviometros";
      if (pluvioId) Plv.state.detailsFocusId = pluvioId;
      await Plv.views?.details?.showDetailsView?.({ pluvioId, detailsType });
    },

    close() {
      Plv.views?.details?.destroyDetailsView?.();
    }
  };
})();
