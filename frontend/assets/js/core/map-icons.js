// assets/js/core/map-icons.js
// pinIcon/uid compartilhados entre medidor.js, irripump.js e pluviometro.js
// (as 3 páginas de equipamento que usam esse mesmo pin verde simples —
// smart-connect/smarttouch/linestar/repetidora têm pin próprio, com HTML
// diferente, não entram aqui). Mesmo padrão do core/geo-utils.js.
(function () {
  "use strict";

  function pinIcon() {
    if (!window.L) return null;
    return L.divIcon({
      className: "",
      html: '<div style="color:#16a34a;font-size:28px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5));"><i class="fa-solid fa-location-dot"></i></div>',
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    });
  }

  function uid() {
    return Math.random().toString(16).slice(2, 10);
  }

  // Ícone de anemômetro (concha + cata-vento) da Estação Meteorológica —
  // mesmo SVG usado no marcador do mapa principal (mapa.js:drawWeatherStation)
  // e no minimapa da tela de Detalhes, pra nunca desalinhar os dois.
  function weatherStationIcon() {
    if (!window.L) return null;
    return L.divIcon({
      className: "map-ws-marker",
      html: `
        <div class="map-ws-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 1200 1200" fill="currentColor" aria-hidden="true">
            <rect x="560" y="255" width="80" height="880"/>
            <path d="M150 150 405 260v210L150 470z"/>
            <rect x="380" y="258" width="440" height="84"/>
            <path d="M820 128 1085 300 820 472V345H700v-90h120z"/>
            <path d="M225 645 470 745v170L225 940z"/>
            <path fill-rule="evenodd" d="M455 605h250v360H455zm110 100h70v200h-70z"/>
            <rect x="700" y="742" width="150" height="86"/>
            <path d="M848 785a128 128 0 1 1 256 0 128 128 0 0 1-256 0zm90 0a38 38 0 1 0 76 0 38 38 0 0 0-76 0z"/>
          </svg>
        </div>
      `,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
  }

  // Escala RdYlGn (vermelho, amarelo, verde) da água disponível. TESTE: o
  // vermelho está na umidade gatilho (ou abaixo dela), o verde na umidade
  // alvo (ou acima) e o amarelo no meio. Compartilhada pelo ícone do mapa,
  // pelos selos de status e pelas barras do tooltip e do modal, pra que as
  // cores nunca divirjam.
  const RDYLGN_STOPS = [
    [0, [215, 48, 39]],
    [0.25, [252, 141, 89]],
    [0.5, [249, 217, 72]],
    [0.75, [166, 217, 106]],
    [1, [26, 152, 80]],
  ];

  function cosmofieldScaleColor(availablePct, { trigger = 50, target = 100 } = {}) {
    if (availablePct === null || availablePct === undefined || availablePct === "") return null;
    const value = Number(availablePct);
    if (!Number.isFinite(value)) return null;
    const low = Number.isFinite(Number(trigger)) ? Number(trigger) : 50;
    const high = Number.isFinite(Number(target)) ? Number(target) : 100;
    // Posição entre o gatilho (0) e o alvo (1); fora do intervalo, trava.
    let p;
    if (value <= low) p = 0;
    else if (value >= high) p = 1;
    else p = (value - low) / (high - low);
    for (let i = 1; i < RDYLGN_STOPS.length; i++) {
      const [p1, c1] = RDYLGN_STOPS[i];
      if (p > p1) continue;
      const [p0, c0] = RDYLGN_STOPS[i - 1];
      const f = (p - p0) / (p1 - p0);
      const rgb = c0.map((channel, k) => Math.round(channel + (c1[k] - channel) * f));
      return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    }
    return null;
  }

  // Cor do ícone e dos selos do Cosmofield: só três, pelo status (verde
  // Adequado, amarelo Atenção, vermelho Alerta). A escala RdYlGn fica só nas
  // barras de umidade.
  const COSMOFIELD_STATUS_COLORS = {
    adequate: "#16a34a",
    attention: "#eab308",
    alert: "#dc2626",
  };

  function cosmofieldStatusColor(status) {
    return COSMOFIELD_STATUS_COLORS[status] || COSMOFIELD_STATUS_COLORS.adequate;
  }

  // Cor do texto sobre um fundo (rgb(...) ou #hex): escuro em fundos claros
  // (amarelo), branco nos demais.
  function cosmofieldTextOn(color) {
    let r = 255, g = 255, b = 255;
    const rgb = String(color || "").match(/rgb((d+),s*(d+),s*(d+))/);
    const hex = String(color || "").match(/^#([0-9a-f]{6})$/i);
    if (rgb) { r = +rgb[1]; g = +rgb[2]; b = +rgb[3]; }
    else if (hex) { r = parseInt(hex[1].slice(0, 2), 16); g = parseInt(hex[1].slice(2, 4), 16); b = parseInt(hex[1].slice(4, 6), 16); }
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.62 ? "#1f2937" : "#ffffff";
  }

  // Gota com o nível de umidade do Cosmofield — mesmo SVG do marcador do
  // mapa principal (mapa.js:drawCosmofield) e do minimapa da tela de
  // Detalhes. color vem da escala RdYlGn pela água disponível. Sem
  // comunicação e bateria baixa são alertas de equipamento e pintam o ícone
  // de vermelho (só a barra de umidade fica cinza sem comunicação).
  function cosmofieldIcon({ color = "", offline = false, alert = false } = {}) {
    if (!window.L) return null;
    const isAlert = offline || alert;
    const tint = isAlert ? "#dc2626" : color;
    return L.divIcon({
      className: "map-cosmofield-marker",
      html: `
        <div class="map-cosmofield-icon ${isAlert ? "is-alert" : ""}" ${tint ? `style="color:${tint}"` : ""}>
          <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <defs><clipPath id="cf-marker-clip"><path d="M12 2.6 C12 2.6 5.4 9.7 5.4 14.2 a6.6 6.6 0 0 0 13.2 0 C18.6 9.7 12 2.6 12 2.6 Z"/></clipPath></defs>
            <rect x="4" y="16.6" width="16" height="7" fill="currentColor" stroke="none" clip-path="url(#cf-marker-clip)"/>
            <path d="M12 2.6 C12 2.6 5.4 9.7 5.4 14.2 a6.6 6.6 0 0 0 13.2 0 C18.6 9.7 12 2.6 12 2.6 Z"/>
            <g stroke-width="1.2">
              <circle cx="10.2" cy="10.4" r="0.8"/>
              <circle cx="13.8" cy="14.2" r="0.8"/>
              <path d="M14.2 10 L9.8 14.6"/>
            </g>
          </svg>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
  }

  window.IcMapIcons = {
    pinIcon,
    uid,
    weatherStationIcon,
    cosmofieldIcon,
    cosmofieldScaleColor,
    cosmofieldTextOn,
    cosmofieldStatusColor,
  };
})();
