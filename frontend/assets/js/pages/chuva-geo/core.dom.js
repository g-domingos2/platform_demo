// assets/js/pages/chuva-geo/core.dom.js
(function () {
  'use strict';

  const Cg = (window.ChuvaGeo = window.ChuvaGeo || {});
  const dom = (Cg.dom = Cg.dom || {});

  dom.$ = dom.$ || ((id) => document.getElementById(id));
})();
