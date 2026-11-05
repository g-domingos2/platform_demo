// assets/js/pages/pluviometria/core.dom.js
(function () {
  "use strict";

  const Plv = (window.Plv = window.Plv || {});
  const dom = (Plv.dom = Plv.dom || {});

  dom.$ = dom.$ || ((id) => document.getElementById(id));

  dom.formatDateBR = dom.formatDateBR || ((d) => {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  });

  dom.formatLatLng = dom.formatLatLng || ((lat, lng) => {
    if (lat == null || lng == null) return "—";
    const a = Number(lat);
    const b = Number(lng);
    if (Number.isNaN(a) || Number.isNaN(b)) return "—";
    return `${a.toFixed(6)}, ${b.toFixed(6)}`;
  });
})();
