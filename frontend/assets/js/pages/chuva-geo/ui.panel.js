// assets/js/pages/chuva-geo/ui.panel.js
(function () {
  'use strict';

  const Cg = (window.ChuvaGeo = window.ChuvaGeo || {});
  const state = (Cg.state = Cg.state || {});
  const data = (Cg.data = Cg.data || {});
  const dom = (Cg.dom = Cg.dom || {});
  const layers = (Cg.layers = Cg.layers || {});
  const panel = (Cg.panel = Cg.panel || {});
  const $ = dom.$ || ((id) => document.getElementById(id));

  const RESET_OPACITY = 0.7;

  function toPercent(value) {
    return Math.round(value * 100);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function setOpacity(value) {
    const next = clamp(value, 0, 1);
    state.rainOpacity = next;
    layers.rain?.setOpacity?.(next);
    const slider = $('chuvaGeoOpacity');
    const label = $('chuvaGeoOpacityValue');
    if (slider) {
      const pct = toPercent(next);
      slider.value = String(pct);
      slider.style.setProperty('--cg-fill', `${pct}%`);
    }
    if (label) label.textContent = `${toPercent(next)}%`;
  }

  function updateLegend() {
    const maxLabel = $('chuvaGeoMaxLabel');
    const maxMm = state.rainMaxMm || data.rainMaxMm || 25;
    if (maxLabel) maxLabel.textContent = `${maxMm} mm`;
  }

  function updateDisabled() {
    const slider = $('chuvaGeoOpacity');
    const reset = $('chuvaGeoOpacityReset');
    const legend = $('chuvaGeoLegendSection');
    const disabled = !window.Plv?.rainHeat?.isVisible?.();
    if (slider) slider.disabled = disabled;
    if (reset) reset.disabled = disabled;
    if (legend) legend.classList.toggle('is-disabled', disabled);
  }

  function syncUI() {
    const rainHeatToggle = $('chuvaGeoRainHeatToggle');
    if (rainHeatToggle) rainHeatToggle.checked = !!window.Plv?.rainHeat?.isVisible?.();

    setOpacity(typeof state.rainOpacity === 'number' ? state.rainOpacity : RESET_OPACITY);
    updateLegend();
    updateDisabled();
  }

  function bindUI() {
    function haltEvent(event) {
      if (!event) return;
      event.stopPropagation();
    }

    function bindStopPropagation(target) {
      if (!target) return;
      const events = ['pointerdown', 'mousedown', 'touchstart', 'click', 'dblclick', 'wheel'];
      events.forEach((evt) => target.addEventListener(evt, haltEvent));
    }

    const panelRoot = $('chuvaGeoPanel');
    bindStopPropagation(panelRoot);

    const closeBtn = $('chuvaGeoClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        window.IcChuvaGeo?.close?.();
      });
    }

    const rainHeatToggle = $('chuvaGeoRainHeatToggle');
    if (rainHeatToggle) {
      bindStopPropagation(rainHeatToggle);
      rainHeatToggle.checked = !!window.Plv?.rainHeat?.isVisible?.();
      rainHeatToggle.addEventListener('change', () => {
        state.userTouched = true;
        if (rainHeatToggle.checked) {
          window.Plv?.rainHeat?.show?.();
        } else {
          window.Plv?.rainHeat?.hide?.();
        }
        updateDisabled();
      });
    }

    const slider = $('chuvaGeoOpacity');
    if (slider) {
      slider.value = String(toPercent(state.rainOpacity || RESET_OPACITY));
      bindStopPropagation(slider);
      slider.addEventListener('input', () => {
        const value = clamp(Number(slider.value) / 100, 0, 1);
        setOpacity(value);
      });
    }

    const reset = $('chuvaGeoOpacityReset');
    if (reset) {
      reset.addEventListener('click', () => {
        setOpacity(RESET_OPACITY);
      });
    }
  }

  panel.bindUI = bindUI;
  panel.syncUI = syncUI;
})();
