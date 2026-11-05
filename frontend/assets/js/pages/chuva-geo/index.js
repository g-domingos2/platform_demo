// assets/js/pages/chuva-geo/index.js
(function () {
  'use strict';

  const Cg = (window.ChuvaGeo = window.ChuvaGeo || {});
  const state = (Cg.state = Cg.state || {});
  const layers = (Cg.layers = Cg.layers || {});
  const panel = (Cg.panel = Cg.panel || {});
  const dom = (Cg.dom = Cg.dom || {});
  const $ = dom.$ || ((id) => document.getElementById(id));

  async function mountPanel() {
    const existing = $('chuvaGeoPanel');
    if (existing) return existing;

    const slot = $('pluvLayerSlot');
    if (!slot) return null;
    const html = await fetch('./pages/chuva-geo.html').then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); });
    slot.innerHTML = html;
    return $('chuvaGeoPanel');
  }

  function applyLayers() {
    if (state.showRain) layers.rain?.add?.();
    else layers.rain?.remove?.();

    if (state.showIrrigation) layers.irrigation?.add?.();
    else layers.irrigation?.remove?.();
  }

  function resetDefaults() {
    state.showRain = false;
    state.showIrrigation = false;
    state.userTouched = false;
    applyLayers();
    panel.syncUI?.();
  }

  function ensureDefaultOff() {
    if (state.userTouched) return;
    if (!state.showRain && !state.showIrrigation) return;
    state.showRain = false;
    state.showIrrigation = false;
    applyLayers();
    panel.syncUI?.();
  }

  function refreshMapLayout() {
    const map = window.icMap;
    if (map && typeof map.invalidateSize === 'function') {
      map.invalidateSize({ pan: false });
      requestAnimationFrame(() => map.invalidateSize({ pan: false }));
      setTimeout(() => map.invalidateSize({ pan: false }), 180);
    }
    window.dispatchEvent(new Event('ic:layout-change'));
  }

  async function open() {
    if (state.isOpen) {
      panel.syncUI?.();
      applyLayers();
      return;
    }

    state.isOpen = true;
    const panelEl = await mountPanel();
    if (!panelEl) {
      state.isOpen = false;
      return;
    }

    if (!state.uiBound) {
      panel.bindUI?.();
      state.uiBound = true;
    }
    panel.syncUI?.();
    applyLayers();
    refreshMapLayout();
  }

  function close() {
    if (!state.isOpen) return;
    state.isOpen = false;

    layers.rain?.remove?.();
    layers.irrigation?.remove?.();

    refreshMapLayout();
  }

  window.IcChuvaGeo = {
    open,
    close,
    applyLayers,
    resetDefaults,
    ensureDefaultOff,
  };
})();
