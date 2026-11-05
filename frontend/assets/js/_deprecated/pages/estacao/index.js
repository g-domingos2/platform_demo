// assets/js/pages/medidores/index.js
(function () {
  "use strict";

  const Mdn = (window.Mdn = window.Mdn || {});
  const views = (Mdn.views = Mdn.views || {});

  window.IcMdnDetails = {
    async open(options = {}) {
      await views?.details?.showDetailsView?.(options);
    },

    close() {
      views?.details?.destroyDetailsView?.();
    }
  };
})();
