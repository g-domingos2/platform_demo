// assets/js/pages/chuva-geo/core.state.js
(function () {
  'use strict';

  const Cg = (window.ChuvaGeo = window.ChuvaGeo || {});
  const state = (Cg.state = Cg.state || {});

  if (typeof state.isOpen !== 'boolean') state.isOpen = false;
  if (typeof state.uiBound !== 'boolean') state.uiBound = false;
  if (typeof state.userTouched !== 'boolean') state.userTouched = false;
  if (typeof state.showRain !== 'boolean') state.showRain = false;
  if (typeof state.showIrrigation !== 'boolean') state.showIrrigation = false;
  if (typeof state.rainOpacity !== 'number') state.rainOpacity = 0.7;
  if (typeof state.rainMaxMm !== 'number') state.rainMaxMm = 25;

  state.layers = state.layers || { rain: null, irrigation: null };
})();
