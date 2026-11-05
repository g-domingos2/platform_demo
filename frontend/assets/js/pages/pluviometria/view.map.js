// assets/js/pages/pluviometria/view.map.js
(function () {
  "use strict";

  const Plv = (window.Plv = window.Plv || {});
  const data = (Plv.data = Plv.data || {});
  const state = (Plv.state = Plv.state || {});
  const dom = (Plv.dom = Plv.dom || {});
  const views = (Plv.views = Plv.views || {});
  const mapView = (views.map = views.map || {});
  const $ = dom.$ || ((id) => document.getElementById(id));
  const formatDateBR = dom.formatDateBR || ((d) => {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  });

  async function openPluvPanel() {
    const isAlreadyOpen = document.body.classList.contains("pluv-panel-open");

    if (!isAlreadyOpen) {
      await window.IcPluviometria?.open?.();
      document.body.classList.add("pluv-panel-open");

      // Pequeno delay para o navegador processar a nova altura antes de scrollar
      setTimeout(() => {
        const target = $("pluvPanel") || $("pageSlot");
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    } else {
      window.IcPluviometria?.close?.();
      return;
    }

    window.IcChuvaGeo?.ensureDefaultOff?.();
    window.icMapSetWheelMode?.("ctrl");
  }

  function resetPluvPanelState() {
    document.body.classList.remove("pluv-panel-open");
    window.icMapSetWheelMode?.("free");
  }

  function bindPluvMapbar() {
    const button = document.querySelector(".pluv-mapbar__report");
    if (!button || button.dataset.bound) return;
    button.dataset.bound = "1";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      if (typeof window.IcNavigate === "function") {
        window.IcNavigate("relatorios", {
          initialReportTarget: "#reportRain",
        });
        return;
      }
      window.IcRelatorios?.open?.({
        initialReportTarget: "#reportRain",
      });
    });

  }

  function formatPeriodLabel() {
    const period = Plv.period?.getPeriod?.() || state.period || null;
    if (period && period.start && period.end) {
      return `${formatDateBR(period.start)} → ${formatDateBR(period.end)}`;
    }
    return "Últimas 24h";
  }

  function updatePeriodDisplays() {
    const period = Plv.period?.getPeriod?.() || state.period || null;
    const startLabelEl = document.querySelector(".pluv-mapbar__range-start");
    const endLabelEl = document.querySelector(".pluv-mapbar__range-end");
    if (startLabelEl && endLabelEl) {
      startLabelEl.textContent = period?.start ? formatDateBR(period.start) : "—";
      endLabelEl.textContent = period?.end ? formatDateBR(period.end) : "—";
    }

    const reportsLabel = document.querySelector(".pluv-reports__filter-label");
    if (reportsLabel) {
      reportsLabel.textContent = `Período: ${formatPeriodLabel()}`;
    }
    const rainLabel = document.querySelector(".rain__period-label");
    if (rainLabel) {
      rainLabel.textContent = `Período: ${formatPeriodLabel()}`;
    }
  }

  function iconFor(p) {
    const displayMm = String(p?.displayMm || "").trim();
    const cls = `pluv-pin ${p.semComunicacao ? "is-off" : ""}`;
    const mmValue = displayMm || (p.semComunicacao
      ? "--"
      : Number.isFinite(Number(p.mm))
        ? Number(p.mm).toFixed(1)
        : "--");
    return L.divIcon({
      className: "",
      html: `
        <div class="${cls}">
          <div class="pluv-pin__bubble">
            <div class="plv-text-wrap">
              <span class="pluv-pin__value">${mmValue}</span>
              <span class="pluv-pin__unit">mm</span>
            </div>
          </div>
        </div>
      `,
      iconSize: [44, 54],
      iconAnchor: [22, 54],
    });
  }

  function renderMarkers() {
    if (!window.icMap || !window.L) return;

    const strayLayer = window.icLayers?.pluviometros;
    if (strayLayer && state.layer && strayLayer !== state.layer) {
      try {
        strayLayer.clearLayers?.();
        if (window.icMap.hasLayer(strayLayer)) window.icMap.removeLayer(strayLayer);
      } catch (_) { }
      window.icLayers.pluviometros = state.layer;
    }

    const isPluviometriaActive =
      document.body.classList.contains("is-pluviometria") ||
      document.body.classList.contains("is-pluvd");

    if (!isPluviometriaActive) {
      if (state.layer) {
        try { state.layer.remove(); } catch (_) { }
        state.layer = null;
      }
      if (window.icLayers) window.icLayers.pluviometros = null;
      Plv.rainHeat?.deactivate?.();
      return;
    }

    // Ativa legenda do heatmap de chuva ao entrar na aba
    Plv.rainHeat?.activate?.();

    const isForbiddenMode = document.body.classList.contains("is-pluviometria-edit") ||
      document.body.classList.contains("is-farm-edit") ||
      document.body.classList.contains("is-pivo-details");

    if (isForbiddenMode) {
      if (state.layer) {
        try { state.layer.remove(); } catch (_) { }
        state.layer = null;
      }
      return;
    }

    if (state.layer) {
      // Verifica se a layer ainda está de fato no mapa (pode ter sido removida pelo details)
      const isOnMap = window.icMap.hasLayer(state.layer);
      if (isOnMap) {
        state.layer.clearLayers();
      } else {
        // Layer foi removida do mapa (ex: ao abrir detalhes) — cria uma nova
        state.layer = L.layerGroup().addTo(window.icMap);
        // Atualiza referência global se existir
        if (window.icLayers) window.icLayers.pluviometros = state.layer;
      }
    } else {
      // Primeira renderização — cria layer nova
      state.layer = L.layerGroup().addTo(window.icMap);
      if (window.icLayers) window.icLayers.pluviometros = state.layer;
    }

    const list = (Plv.cards?.selectedList?.() || data.PLUVIOS || []).filter((p) => {
      const lat = Number(p?.lat);
      const lng = Number(p?.lng);
      return Number.isFinite(lat) && Number.isFinite(lng);
    });
    if (!list.length) {
      state.layer.clearLayers();
      return;
    }

    // Separa marcadores com coordenadas idênticas aplicando offset radial
    const coordKey = (p) => p.lat.toFixed(6) + ',' + p.lng.toFixed(6);
    const coordCount = {};
    list.forEach((p) => { const k = coordKey(p); coordCount[k] = (coordCount[k] || 0) + 1; });
    const coordIdx = {};
    const OFFSET_DEG = 0.0008; // ~90 m
    const resolvedList = list.map((p) => {
      const k = coordKey(p);
      if (coordCount[k] <= 1) return p;
      const idx = coordIdx[k] = (coordIdx[k] || 0);
      coordIdx[k]++;
      const total = coordCount[k];
      const angle = (2 * Math.PI * idx) / total;
      return Object.assign({}, p, {
        lat: p.lat + OFFSET_DEG * Math.cos(angle),
        lng: p.lng + OFFSET_DEG * Math.sin(angle)
      });
    });

    resolvedList.forEach((p) => {
      const statusBadge = p.semComunicacao ? 'OFFLINE' : 'ONLINE';
      const badgeClass = p.semComunicacao ? 'is-danger' : 'is-info';
      const metricLabel = String(p?.displayMm || "").trim() || p.mm.toFixed(1);
      
      const tooltipHtml = `
        <div class="pivot-tooltip">
          <div class="pivot-tooltip__headline">
            <span class="pivot-tooltip__name">${p.nome}</span>
            <span class="pivot-tooltip__status ${badgeClass}">${statusBadge}</span>
          </div>
          <span class="pivot-tooltip__metric">${metricLabel} mm</span>
          <span class="pivot-tooltip__date"><span>Atualizado em:</span> ${p.updated}</span>
        </div>
      `;

      L.marker([p.lat, p.lng], { icon: iconFor(p) })
        .addTo(state.layer)
        .bindTooltip(tooltipHtml, {
          permanent: false,
          direction: "top",
          className: "pivot-tooltip-wrap pluv-tooltip-wrap",
          opacity: 1,
          offset: [0, -50]
        })
        .on("click", () => {
          window.IcPluvDetails?.open?.({ pluvioId: p.id });
        });
    });
  }

  function focusOnMapIfSingle() {
    if (state.selected.size !== 1) return;
    const only = (data.PLUVIOS || []).find((p) => state.selected.has(p.id));
    if (!only) return;
    window.icMap?.setView?.([only.lat, only.lng], 16);
  }

  mapView.openPluvPanel = openPluvPanel;
  mapView.resetPluvPanelState = resetPluvPanelState;
  mapView.bindPluvMapbar = bindPluvMapbar;
  mapView.formatPeriodLabel = formatPeriodLabel;
  mapView.updatePeriodDisplays = updatePeriodDisplays;
  mapView.renderMarkers = renderMarkers;
  mapView.focusOnMapIfSingle = focusOnMapIfSingle;
})();
