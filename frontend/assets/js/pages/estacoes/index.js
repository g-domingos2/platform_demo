// assets/js/pages/estacoes/index.js
(function () {
  "use strict";

  const Est = (window.Est = window.Est || {});
  const views = (Est.views = Est.views || {});

  // Clique no mapa/lista abre a tela de Detalhes (cockpit, própria —
  // weatherstation-details.js), no mesmo padrão de Pivô/Bomba/Carretel.
  // "Editar" continua abrindo o painel de create+config (Configurações),
  // em estacao-meteorologica.html/view.details.js.
  window.IcEstacaoDetails = {
    async open(options = {}) {
      await window.IcWeatherStationDetails?.open?.(options);
    },

    close() {
      window.IcWeatherStationDetails?.close?.();
    },

    // Aquece o cache da previsão (chamado pelo mapa ao desenhar o marcador).
    prefetch(lat, lng, current) {
      views?.details?.prefetchWeather?.(lat, lng, current);
    }
  };

  window.IcEstacaoEdit = {
    async open(options = {}) {
      await views?.details?.showDetailsView?.({ ...options, tab: "config" });
    },
    close() {
      views?.details?.destroyDetailsView?.();
    },
  };
})();
