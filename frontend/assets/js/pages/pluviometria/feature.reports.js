// assets/js/pages/pluviometria/feature.reports.js
(function () {
  "use strict";

  const Plv = (window.Plv = window.Plv || {});
  const reports = (Plv.reports = Plv.reports || {});

  function bindReportFilter() {
    const filter = document.querySelector(".pluv-reports__btn--filter");
    if (!filter || filter.dataset.bound) return;
    filter.dataset.bound = "1";
  }

  reports.bindReportFilter = bindReportFilter;
})();
