// assets/js/pages/pluviometria/view.rainheatmap.js
// Heatmap de precipitação sobreposto nos polígonos dos talhões (aba Pluviometria)
(function () {
  "use strict";

  const Plv = (window.Plv = window.Plv || {});
  const rainHeat = (Plv.rainHeat = Plv.rainHeat || {});

  let _overlay   = null;
  let _legendEl  = null;
  let _visible   = false;

  const RAIN_FLOOR_RATIO = 0.035;
  const RAIN_FLOOR_MM = 0.25;
  const RAIN_SCALE_MIN_MM = 18;
  const RAIN_SCALE_PAD_RATIO = 1.28;
  const RAIN_HEAT_GRADIENT = Object.freeze({
    "0.0": "rgb(239,248,255)",
    "0.22": "rgb(219,234,254)",
    "0.44": "rgb(147,197,253)",
    "0.66": "rgb(59,130,246)",
    "0.84": "rgb(37,99,235)",
    "1.0": "rgb(30,64,175)"
  });

  // ─── Seeded RNG ──────────────────────────────────────────────────────────

  function seededRng(seed) {
    let s = Math.abs(seed % 2147483647) || 1;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  // ─── Geometria ───────────────────────────────────────────────────────────

  // Ray-casting: retorna true se (lat, lng) está dentro do polígono
  function pointInPolygon(lat, lng, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].lng, yi = poly[i].lat;
      const xj = poly[j].lng, yj = poly[j].lat;
      if ((yi > lat) !== (yj > lat) &&
          lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }

  // Distância aproximada em graus (rápida, suficiente para pesos IDW)
  function dist2(lat1, lng1, lat2, lng2) {
    const dlat = lat1 - lat2;
    const dlng = (lng1 - lng2) * Math.cos(lat1 * Math.PI / 180);
    return dlat * dlat + dlng * dlng;
  }

  // IDW (Inverse Distance Weighting)
  function idwValue(lat, lng, sources) {
    let num = 0, den = 0;
    for (const s of sources) {
      const d2 = dist2(lat, lng, s.lat, s.lng);
      const w = 1 / (d2 + 1e-10);
      num += w * s.value;
      den += w;
    }
    return den > 0 ? num / den : 0;
  }

  function toRainNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(String(value).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  // ─── Pluviômetros fictícios ───────────────────────────────────────────────
  // Quando os pluviômetros reais têm mm=0, gera fontes de chuva simuladas
  // posicionadas dentro/ao redor do polígono do talhão

  function mockRainSources(talhao, rng) {
    const pts  = talhao.points;
    const lats = pts.map(p => p.lat);
    const lngs = pts.map(p => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

    const seed  = String(talhao.id).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const base  = 18 + (seed % 45);   // 18–62 mm base por talhão

    // 3 a 5 "núcleos de chuva" (simula frentes e células convectivas)
    const n = 3 + (seed % 3);
    const sources = [];
    for (let i = 0; i < n; i++) {
      // posiciona o núcleo dentro do bounding box (pode cair fora do polígono
      // mas o IDW ainda funciona — pontos externos influenciam a borda)
      const lat = minLat + rng() * (maxLat - minLat);
      const lng = minLng + rng() * (maxLng - minLng);
      // valor varia entre 40% e 130% do base
      const value = base * (0.4 + rng() * 0.9);
      sources.push({ lat, lng, value });
    }
    return sources;
  }

  // ─── Geração de pontos dentro do talhão ─────────────────────────────────

  function generateTalhaoPoints(talhao, realPluvios) {
    const pts = talhao.points;
    if (!Array.isArray(pts) || pts.length < 3) return [];

    const lats = pts.map(p => p.lat);
    const lngs = pts.map(p => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

    const seed = String(talhao.id).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const rng  = seededRng(seed);

    // Fontes de valor: pluviômetros reais com mm>0 ou, se não houver, núcleos fictícios
    const realSources = (realPluvios || [])
      .map((p) => {
        const lat = toRainNumber(p?.lat);
        const lng = toRainNumber(p?.lng);
        const value =
          toRainNumber(p?.mm) ??
          toRainNumber(p?.chuva) ??
          toRainNumber(p?.rainMm) ??
          toRainNumber(p?.data?.mm);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || value === null) return null;
        return { lat, lng, value: Math.max(0, value) };
      })
      .filter(Boolean);

    const sources = realSources.length > 0 ? realSources : mockRainSources(talhao, rng);
    const sourceMax = sources.reduce((max, item) => Math.max(max, item.value), 0);
    const rainFloor = Math.max(RAIN_FLOOR_MM, sourceMax * RAIN_FLOOR_RATIO);

    // Densidade: ~1 ponto / 2 ha, mín 80, máx 500
    const areaHa   = parseFloat(talhao.area) || 100;
    const numPoints = Math.max(220, Math.min(1400, Math.floor(areaHa * 4)));
    const midLat = (minLat + maxLat) / 2;
    const latSpan = Math.max(1e-8, maxLat - minLat);
    const lngSpan = Math.max(1e-8, (maxLng - minLng) * Math.cos(midLat * Math.PI / 180));
    const aspect = Math.max(0.35, Math.min(3, lngSpan / latSpan));
    const rows = Math.max(10, Math.ceil(Math.sqrt(numPoints / aspect)));
    const cols = Math.max(10, Math.ceil(rows * aspect));
    const stepLat = (maxLat - minLat) / rows;
    const stepLng = (maxLng - minLng) / cols;

    const result = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const lat = minLat + (row + 0.5) * stepLat + (rng() - 0.5) * stepLat * 0.62;
        const lng = minLng + (col + 0.5) * stepLng + (rng() - 0.5) * stepLng * 0.62;

        if (!pointInPolygon(lat, lng, pts)) continue;

      // Interpolação IDW + ruído de textura
        const base  = idwValue(lat, lng, sources);
        const noise = 0.9 + rng() * 0.2;
        const value = Math.max(rainFloor, base * noise);

        result.push({ lat, lng, value });
      }
    }

    return result;
  }

  // ─── Leitura dos talhões da fazenda ativa ────────────────────────────────

  function getActiveTalhoes() {
    // 1) Via Cad.data (preferencial — já carregado em memória)
    const farmId = sessionStorage.getItem("ic_active_farm") ||
                   sessionStorage.getItem("ic_active_farm_id") ||
                   window.IcFarmActive?.id || null;

    if (!farmId) return _fallbackTalhoes();

    if (typeof window.Cad?.data?.getTalhoesByFarm === "function") {
      const list = window.Cad.data.getTalhoesByFarm(farmId);
      if (Array.isArray(list) && list.length) return list;
    }

    // 2) Via IcData.cadastros.talhoes (mesma memória, atalho)
    const cached = window.IcData?.cadastros?.talhoes;
    if (cached && Array.isArray(cached[farmId]) && cached[farmId].length) {
      return cached[farmId];
    }

    // 3) Leitura direta do localStorage (chave correta do projeto)
    try {
      const raw = localStorage.getItem("ic_app_state_v1");
      if (raw) {
        const state = JSON.parse(raw);
        const list  = state?.talhoesByFarm?.[farmId];
        if (Array.isArray(list) && list.length) return list;
      }
    } catch (_) {}

    // 4) Leitura do arquivo estático de dados (GitHub Pages / dev)
    return _fallbackTalhoes();
  }

  // Carrega o app-state.json estático como última alternativa
  let _staticTalhoes = null;
  function _fallbackTalhoes() {
    if (_staticTalhoes !== null) return _staticTalhoes;
    // Retorna [] enquanto não chegou (assíncrono); a próxima chamada usará o cache
    _staticTalhoes = [];
    fetch("./data/app-state.json")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        const farmId = sessionStorage.getItem("ic_active_farm") ||
                       sessionStorage.getItem("ic_active_farm_id") ||
                       window.IcFarmActive?.id;
        // pega a primeira fazenda disponível se não tiver ID salvo
        const byFarm = data.talhoesByFarm || {};
        const key    = farmId && byFarm[farmId] ? farmId : Object.keys(byFarm)[0];
        _staticTalhoes = Array.isArray(byFarm[key]) ? byFarm[key] : [];
        // Re-renderiza se o toggle já estava ativo
        if (_visible) render();
      })
      .catch(() => {});
    return [];
  }

  function getPluvios() {
    // Tenta obter pluviômetros com leituras reais da fazenda ativa
    const farmId = sessionStorage.getItem("ic_active_farm") ||
                   sessionStorage.getItem("ic_active_farm_id") ||
                   window.IcFarmActive?.id;

    if (farmId) {
      try {
        const raw = localStorage.getItem("ic_app_state_v1");
        if (raw) {
          const state = JSON.parse(raw);
          const list  = state?.pluviosByFarm?.[farmId];
          if (Array.isArray(list)) return list;
        }
      } catch (_) {}
    }

    return Plv.data?.PLUVIOS || [];
  }

  // ─── Legenda ──────────────────────────────────────────────────────────────

  function ensureLegend() {
    if (_legendEl) return;

    _legendEl = document.createElement("div");
    _legendEl.id = "rainHeatLegend";
    _legendEl.innerHTML = `
      <div class="heatmap-legend__body">
        <div class="heatmap-legend__title">Precipitação (mm)</div>
        <div class="heatmap-legend__bar heatmap-legend__bar--rain"></div>
        <div class="heatmap-legend__scale">
          <span>0</span>
          <span data-slot="q1"></span>
          <span data-slot="q2"></span>
          <span data-slot="q3"></span>
          <span data-slot="max"></span>
        </div>
      </div>
    `;

    const mapEl = document.getElementById("map");
    if (mapEl) mapEl.appendChild(_legendEl);
  }


  function _updateScale(maxMm) {
    if (!_legendEl) return;
    _legendEl.querySelector("[data-slot='q1']").textContent = Math.round(maxMm * 0.25);
    _legendEl.querySelector("[data-slot='q2']").textContent = Math.round(maxMm * 0.5);
    _legendEl.querySelector("[data-slot='q3']").textContent = Math.round(maxMm * 0.75);
    _legendEl.querySelector("[data-slot='max']").textContent = Math.round(maxMm);
  }

  // ─── Overlay ──────────────────────────────────────────────────────────────

  function _removeOverlay() {
    if (_overlay && window.icMap) {
      try { window.icMap.removeLayer(_overlay); } catch (_) {}
    }
    _overlay = null;
  }

  function render() {
    _removeOverlay();
    if (!_visible) return;
    if (!window.icMap || typeof L === "undefined" || typeof L.heatmapOverlay !== "function") return;

    const talhoes = getActiveTalhoes();
    if (!talhoes.length) return;

    const pluvios    = getPluvios();
    const allPoints  = [];
    let   globalMax  = 0;

    for (const talhao of talhoes) {
      const pts = generateTalhaoPoints(talhao, pluvios);
      for (const p of pts) {
        if (p.value > globalMax) globalMax = p.value;
        allPoints.push(p);
      }
    }

    if (!allPoints.length) return;

    _overlay = L.heatmapOverlay({
      radius: 48,
      blur: 0.94,
      legacyGradient: RAIN_HEAT_GRADIENT,
      legacyGradientOld: {
        "0.0": "rgb(219,234,254)",   // azul muito claro
        "0.25": "rgb(147,197,253)",  // azul claro
        "0.5": "rgb(59,130,246)",    // azul médio
        "0.72": "rgb(29,78,216)",    // azul escuro
        "0.88": "rgb(30,27,175)",    // índigo
        "1.0":  "rgb(67,20,180)"     // roxo escuro (chuva intensa)
      },
      gradient: RAIN_HEAT_GRADIENT,
      maxOpacity: 0.52,
      minOpacity: 0.07,
    }).addTo(window.icMap);

    const scaleMax = Math.max(globalMax * RAIN_SCALE_PAD_RATIO, RAIN_SCALE_MIN_MM);
    _overlay.setData({ data: allPoints, max: scaleMax, min: 0 });

    ensureLegend();
    _legendEl.style.display = "";
    _legendEl.classList.add("is-active");
    _updateScale(scaleMax);
  }

  // ─── API pública ──────────────────────────────────────────────────────────

  rainHeat.render  = render;
  rainHeat.refresh = () => { if (_visible) render(); };

  rainHeat.show = () => {
    _visible = true;
    render();
  };

  rainHeat.hide = () => {
    _removeOverlay();
    _visible = false;
    if (_legendEl) {
      _legendEl.style.display = "none";
      _legendEl.classList.remove("is-active");
    }
  };

  rainHeat.activate = () => {};

  rainHeat.deactivate = () => {
    rainHeat.hide();
    // Sync checkbox do painel geo
    const geoToggle = document.getElementById("chuvaGeoRainHeatToggle");
    if (geoToggle) geoToggle.checked = false;
  };

  rainHeat.isVisible = () => _visible;

})();
