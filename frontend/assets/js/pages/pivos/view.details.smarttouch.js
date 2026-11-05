// assets/js/pages/pivos/view.details.smarttouch.js
(function () {
    "use strict";

    const Pivos = (window.Pivos = window.Pivos || {});
    const views = (Pivos.views = Pivos.views || {});
    const detailVariants = (views.detailVariants = views.detailVariants || {});

    detailVariants.smarttouch = Object.assign({}, detailVariants.smarttouch, {
        key: "smarttouch",
        templatePath: "./pages/pivo-smarttouch.details.html",
        bodyClass: "is-pivo-details-smarttouch",
        panelClass: "pivos-view--smarttouch"
    });
})();
