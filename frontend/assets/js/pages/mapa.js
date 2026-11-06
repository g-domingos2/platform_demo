// mapa.js
(function initMapa() {
  const el = document.getElementById("map");
  if (!el) return;

  // Centro inicial (Brasil) ao recarregar a pagina
  const map = L.map("map", {
    zoomControl: false,
    scrollWheelZoom: false,
    zoomSnap: 0.25,
    zoomDelta: 0.25,
    wheelPxPerZoomLevel: 180
  }).setView([-14.235, -51.9253], 5);

  // Expõe referência para debug/integrações e corrige resize após mudanças de layout
  window.icMap = map;

  // Base: Satélite (Esri World Imagery)
  const satelliteTiles = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 19,
      attribution: "Tiles © Esri"
    }
  ).addTo(map);

  // (Opcional) camada de labels por cima, fica bem “Google-like”
  const labelTiles = L.tileLayer(
    "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 19,
      opacity: 0.85
    }
  ).addTo(map);
  const terrainTiles = L.tileLayer(
    "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 17,
      attribution: "Map data © OpenStreetMap contributors, SRTM | Map style © OpenTopoMap"
    }
  );


  // Hint de zoom com Ctrl + scroll
  const zoomHint = document.createElement("div");
  zoomHint.className = "map-zoom-hint";
  zoomHint.textContent = "Pressione Ctrl e role a tela simultaneamente para aplicar zoom no mapa";
  el.appendChild(zoomHint);

  let hintTimer = null;
  const showZoomHint = () => {
    zoomHint.classList.add("is-visible");
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = setTimeout(() => {
      zoomHint.classList.remove("is-visible");
    }, 1200);
  };

  let wheelMode = "free";
  const applyWheelMode = () => {
    if (wheelMode === "ctrl") {
      map.scrollWheelZoom.disable();
    } else {
      map.scrollWheelZoom.enable();
    }
  };
  applyWheelMode();

  window.icMapSetWheelMode = (mode) => {
    wheelMode = mode === "free" ? "free" : "ctrl";
    applyWheelMode();
  };

  el.addEventListener("wheel", (e) => {
    if (wheelMode === "ctrl" && !e.ctrlKey) showZoomHint();
  }, { passive: true });

  window.addEventListener("keydown", (e) => {
    if (wheelMode !== "ctrl") return;
    if (e.key === "Control") map.scrollWheelZoom.enable();
  });

  window.addEventListener("keyup", (e) => {
    if (wheelMode !== "ctrl") return;
    if (e.key === "Control") map.scrollWheelZoom.disable();
  });

  window.addEventListener("blur", () => {
    if (wheelMode !== "ctrl") return;
    map.scrollWheelZoom.disable();
  });

  const invalidate = () => {
    map.invalidateSize({ pan: false, debounceMoveend: true });
  };

  // Resize normal da janela
  window.addEventListener("resize", invalidate);

  // Mudanças de layout (ex.: colapsar sidebar)
  window.addEventListener("ic:layout-change", () => {
    // rAF + pequeno atraso para pegar o layout já aplicado
    requestAnimationFrame(invalidate);
    setTimeout(invalidate, 180);
  });

  // =========================
  // Pivos no mapa
  // =========================
  const pivotLayer = L.layerGroup().addTo(map);
  // DEMO: animação leve — partes que se movem (braço, faixa, carrinho) ficam
  // registradas e são atualizadas no lugar, sem recriar o mapa inteiro.
  const _pivotMotionRegistry = new Map();
  const _rainstarMotionRegistry = new Map();
  try {
    if (!map.getPane("icPivotMotion")) {
      const pane = map.createPane("icPivotMotion");
      pane.style.zIndex = 405;
      pane.style.pointerEvents = "none";
    }
  } catch (_) { }
  const mdnLayer = L.layerGroup().addTo(map);
  const repLayer = L.layerGroup().addTo(map);
  const pumpLayer = L.layerGroup().addTo(map);
  const centralLayer = L.layerGroup().addTo(map);
  const carretelLayer = L.layerGroup().addTo(map);
  const linestarLayer = L.layerGroup().addTo(map);
  const weatherLayer = L.layerGroup().addTo(map);
  const talhaoLayer = L.layerGroup().addTo(map);
  const plvLayer = L.layerGroup().addTo(map);
  const cosmofieldLayer = L.layerGroup().addTo(map);
  const connectivityLineLayer = L.layerGroup().addTo(map);
  const connectivityGpsLayer = L.layerGroup().addTo(map);
  const connectivityFxLayer = L.layerGroup().addTo(map);

  const extendBoundsWithLayer = (bounds, layer) => extendBoundsWithLayerSafe(bounds, layer);

  // Connectivity mode: tracks all scannable dot markers
  let _connectivityMarkers = [];
  let _connectivityScanState = new Map();
  let _connectivityScanTimer = null;
  let _connectivityFarmId = null;
  let _connectivitySelected = null;
  let _connectivityDetailRadio = "controlador"; // "controlador" | "gps"
  let _connectivityScanRound = 0;
  let _connectivityRadarRaf = null;
  let _connectivityScanDone = false;
  let _lastRenderedFarm = null;
  let _lastRenderOptions = {};

  let _fitTimer = null;
  const scheduleFitMapToVisibleItems = () => {
    if (_fitTimer) clearTimeout(_fitTimer);
    _fitTimer = setTimeout(() => {
      _fitTimer = null;
      map.invalidateSize({ pan: false, debounceMoveend: true });
      fitMapToVisibleItemsSafe();
    }, 80);
  };

  const fitMapToVisibleItems = () => {
    const layers = [
      pivotLayer,
      mdnLayer,
      repLayer,
      pumpLayer,
      centralLayer,
      carretelLayer,
      linestarLayer,
      weatherLayer,
      talhaoLayer,
      plvLayer,
      cosmofieldLayer
    ];

    let bounds = null;
    layers.forEach((layer) => {
      if (!layer || !map.hasLayer(layer)) return;
      try {
        bounds = extendBoundsWithLayer(bounds, layer);
      } catch (_) {
        // ignorar layers sem bounds válidos
      }
    });

    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
    } else {
      // DEMO: fazenda ainda sem equipamentos → centraliza na localização da fazenda
      const farm = window.IcFarmGetActive?.() || window.IcFarmActive || null;
      const fLat = Number(farm?.lat);
      const fLng = Number(farm?.lng);
      if (Number.isFinite(fLat) && Number.isFinite(fLng) && (fLat !== 0 || fLng !== 0)) {
        map.setView([fLat, fLng], 15, { animate: false });
      }
    }
  };

  const extendBoundsWithLayerSafe = (bounds, layer) => {
    if (!layer) return bounds;

    if (typeof layer.eachLayer === "function") {
      layer.eachLayer((childLayer) => {
        bounds = extendBoundsWithLayerSafe(bounds, childLayer);
      });
      return bounds;
    }

    if (typeof layer.getBounds === "function") {
      try {
        const layerBounds = layer.getBounds();
        if (layerBounds && layerBounds.isValid()) {
          if (!bounds) return L.latLngBounds(layerBounds);
          bounds.extend(layerBounds);
        }
      } catch (_) {
        // ignorar layers sem bounds validos
      }
      return bounds;
    }

    if (typeof layer.getLatLng === "function") {
      try {
        const latLng = layer.getLatLng();
        if (latLng) {
          if (!bounds) return L.latLngBounds(latLng, latLng);
          bounds.extend(latLng);
        }
      } catch (_) {
        // ignorar markers invalidos
      }
    }

    return bounds;
  };

  const fitMapToVisibleItemsSafe = () => {
    const layers = [
      pivotLayer,
      mdnLayer,
      repLayer,
      pumpLayer,
      centralLayer,
      carretelLayer,
      linestarLayer,
      weatherLayer,
      talhaoLayer,
      plvLayer,
      cosmofieldLayer
    ];

    let bounds = null;
    layers.forEach((layer) => {
      if (!layer || !map.hasLayer(layer)) return;
      bounds = extendBoundsWithLayerSafe(bounds, layer);
    });

    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
    } else {
      // DEMO: fazenda ainda sem equipamentos → centraliza na localização da fazenda
      const farm = window.IcFarmGetActive?.() || window.IcFarmActive || null;
      const fLat = Number(farm?.lat);
      const fLng = Number(farm?.lng);
      if (Number.isFinite(fLat) && Number.isFinite(fLng) && (fLat !== 0 || fLng !== 0)) {
        map.setView([fLat, fLng], 15, { animate: false });
      }
    }
  };

  const toNumber = (value) => {
    const s = String(value ?? "").trim();
    if (!s) return null;
    const num = Number(s.replace(",", "."));
    return Number.isFinite(num) ? num : null;
  };

  const parseLatLngText = (text) => {
    const raw = String(text || "").trim();
    if (!raw) return null;
    const parts = raw
      .replaceAll(";", ",")
      .split(/,|\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length < 2) return null;
    const lat = toNumber(parts[0]);
    const lng = toNumber(parts[1]);
    if (lat === null || lng === null) return null;
    return { lat, lng };
  };

  const bearingRad = (from, to) => {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const lat1 = toRad(from.lat);
    const lat2 = toRad(to.lat);
    const dLng = toRad(to.lng - from.lng);
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return Math.atan2(y, x);
  };

  const destinationPoint = (origin, distance, bearing) => {
    const R = 6378137;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const toDeg = (rad) => (rad * 180) / Math.PI;
    const delta = distance / R;
    const theta = bearing;
    const phi1 = toRad(origin.lat);
    const lambda1 = toRad(origin.lng);

    const sinPhi1 = Math.sin(phi1);
    const cosPhi1 = Math.cos(phi1);
    const sinDelta = Math.sin(delta);
    const cosDelta = Math.cos(delta);

    const sinPhi2 = sinPhi1 * cosDelta + cosPhi1 * sinDelta * Math.cos(theta);
    const phi2 = Math.asin(Math.max(-1, Math.min(1, sinPhi2)));
    const y = Math.sin(theta) * sinDelta * cosPhi1;
    const x = cosDelta - sinPhi1 * Math.sin(phi2);
    const lambda2 = lambda1 + Math.atan2(y, x);

    return { lat: toDeg(phi2), lng: toDeg(lambda2) };
  };

  const getPivotVisualStyle = () => localStorage.getItem("ic:pivot-visual-style") || "solid";
  const clampPercent = (value) => Math.max(0, Math.min(100, Number(value) || 0));
  const interpolatePoint = (from, to, ratio) => ({
    lat: from.lat + (to.lat - from.lat) * ratio,
    lng: from.lng + (to.lng - from.lng) * ratio,
  });

  const buildFullRing = (center, outerRadius, innerRadius, stepDeg = 4) => {
    const outer = [];
    const inner = [];


    for (let deg = 0; deg <= 360; deg += stepDeg) {
      const rad = (deg * Math.PI) / 180;
      const outerPoint = destinationPoint(center, outerRadius, rad);
      outer.push(L.latLng(outerPoint.lat, outerPoint.lng));
    }

    for (let deg = 360; deg >= 0; deg -= stepDeg) {
      const rad = (deg * Math.PI) / 180;
      const innerPoint = destinationPoint(center, innerRadius, rad);
      inner.push(L.latLng(innerPoint.lat, innerPoint.lng));
    }

    return [outer, inner];
  };

  const CONNECTIVITY_COLORS = Object.freeze({
    dot: "#94a3b8",
    central: "#fbbf24",
    pivotGhost: {
      color: "#ffffff",
      opacity: 0.6,
      weight: 1.5
    }
  });

  const isConnectivityMode = () => document.body.classList.contains("is-conectividade");

  const CONNECTIVITY_SCAN_COLORS = Object.freeze({
    idle: CONNECTIVITY_COLORS.dot,
    found: "#22c55e",
    missing: "#ef4444",
    central: CONNECTIVITY_COLORS.central
  });

  // Alcance de um enlace direto de rádio entre dois nós (mock).
  const MESH_LINK_RANGE_M = 2600;

  const hashString = (value) => {
    const str = String(value || "");
    let hash = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  };

  const distanceMeters = (from, to) => {
    if (!from || !to) return Infinity;
    try {
      return L.latLng(from.lat, from.lng).distanceTo([to.lat, to.lng]);
    } catch (_) {
      return Infinity;
    }
  };

  const isZeroCentral = (lat, lng) => toNumber(lat) === 0 && toNumber(lng) === 0;

  const getFarmCentralNode = (farm) => {
    if (!farm || isZeroCentral(farm.centralLat, farm.centralLng)) return null;
    const lat = toNumber(farm.centralLat);
    const lng = toNumber(farm.centralLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      id: "__central__",
      name: farm.centralName || "Central",
      type: "central",
      category: "central",
      tech: "radio",
      center: { lat, lng },
      radio: farm.centralRadio || farm.centralId || "C0FFEE",
      isCentral: true
    };
  };

  // SmartTouch, CenterStar, LineStar, Cosmofield e a Estação Meteorológica
  // usam 4G próprio: não entram na malha IrriMesh de rádio, mas ainda são
  // verificados na busca.
  const CONNECTIVITY_4G_TYPES = Object.freeze(["centerstar", "linestar", "rainstar", "cosmofield", "smarttouch", "estacao_metereologica", "estacao_meteorologica", "weather_station"]);
  // No mock, CenterStar/LineStar aparecem com o nome do produto — detecta pelo
  // nome quando o type não é explícito.
  const CONNECTIVITY_4G_NAME_RE = /\b(center\s*star|line\s*star|smart\s*touch)\b/i;

  const resolveConnectivityTech = (item) => {
    const type = String(item?.type || "").toLowerCase();
    const category = String(item?.category || "").toLowerCase();
    if (CONNECTIVITY_4G_TYPES.includes(type)) return "4g";
    if (category === "cosmofields" || type === "cosmofield") return "4g";
    if (category === "carreteis" && (type === "linestar" || type === "rainstar")) return "4g";
    if (CONNECTIVITY_4G_NAME_RE.test(item?.name || item?.label || "")) return "4g";
    return "radio";
  };

  const getConnectivityItemPoint = (item) => {
    if (!item) return null;
    if (item.isCentral && item.center) return item.center;
    const lat = toNumber(item?.data?.lat ?? item?.lat);
    const lng = toNumber(item?.data?.lng ?? item?.lng);
    const genericPoint = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    return extractRainstarData(item)?.center ||
      extractPivotData(item)?.center ||
      extractMdnData(item)?.center ||
      extractRepeaterData(item)?.center ||
      extractPumpData(item)?.center ||
      extractCentralData(item)?.center ||
      extractLineStar(item)?.ptA ||
      extractCosmofieldData(item)?.center ||
      genericPoint ||
      null;
  };

  const getConnectivityGpsPoint = (item) => {
    const pivot = extractPivotData(item);
    if (!pivot) return null;
    return pivot.ref || getNorthReferencePoint(pivot.center, pivot.radius);
  };

  const getConnectivityNodes = (farm, options = {}) => {
    const nodes = [];
    const central = getFarmCentralNode(farm);
    if (central) nodes.push(central);
    const equipments = Array.isArray(farm?.equipments) ? farm.equipments : [];
    equipments.forEach((item) => {
      const center = getConnectivityItemPoint(item);
      if (!center) return;
      nodes.push({
        ...item,
        center,
        tech: resolveConnectivityTech(item),
        radio: item?.data?.radio || item?.data?.radioId || item?.serial || item?.id
      });
      if (options.includeGps && resolveConnectivityTech(item) === "radio") {
        const gpsPoint = getConnectivityGpsPoint(item);
        if (gpsPoint) {
          nodes.push({
            ...item,
            id: `${item.id}:gps`,
            name: `${item.name || "Pivô"} GPS`,
            center: gpsPoint,
            tech: "radio",
            radio: item?.data?.gpsRadio || `${item.id}GPS`,
            isGpsNode: true
          });
        }
      }
    });
    if (Array.isArray(farm?.pivos)) {
      const existing = new Set(equipments.map((item) => String(item?.id || "")));
      farm.pivos.forEach((pivo) => {
        if (existing.has(String(pivo?.id || ""))) return;
        const shaped = { ...pivo, type: pivo.type || "smart_connect", category: "pivos", data: pivo };
        const center = getConnectivityItemPoint(shaped);
        if (center) nodes.push({ ...shaped, center, tech: resolveConnectivityTech(shaped), radio: pivo.radio || pivo.id });
      });
    }
    return nodes;
  };

  // O nó de GPS participa da malha como um painel próprio (recebe e transmite).
  // Tem estado de varredura independente do controlador, mockado de forma
  // determinística a partir do id + rodada da última busca.
  const connectivityGpsFound = (node) => {
    if (!_connectivityScanDone && _connectivityScanState.size === 0) return false;
    const baseId = String(node.id).replace(/:gps$/, "");
    // Correlaciona um pouco com o controlador: se o controlador caiu, o GPS
    // tem mais chance de também estar fora; senão, quase sempre presente.
    const ctrlFound = _connectivityScanState.get(baseId)?.found;
    const h = hashString(`gps:${_lastRenderedFarm?.id || ""}:${baseId}:${_connectivityScanRound}`);
    return ctrlFound === false ? (h % 3 === 0) : (h % 13 !== 0);
  };

  // Estado de varredura do nó. GPS resolve pelo próprio painel; os demais pelo
  // resultado da busca (Central sempre presente).
  const connectivityNodeFound = (node) => {
    if (!node) return false;
    if (node.isCentral) return true;
    if (node.isGpsNode) return connectivityGpsFound(node);
    return !!_connectivityScanState.get(String(node.id))?.found;
  };

  // Existe enlace de rádio direto entre dois nós? Ambos precisam estar
  // "encontrados" (ou ser a Central) e dentro de um alcance de mock.
  // Rádios diferentes não se falam: controlador â†” controlador, GPS â†” GPS; a
  // Central conversa com os dois.
  const connectivityLinkExists = (a, b) => {
    if (!a || !b || a.tech !== "radio" || b.tech !== "radio") return false;
    if (String(a.id).replace(/:gps$/, "") === String(b.id).replace(/:gps$/, "")) return false;
    const aGps = !!a.isGpsNode;
    const bGps = !!b.isGpsNode;
    if (!a.isCentral && !b.isCentral && aGps !== bGps) return false;
    if (!connectivityNodeFound(a) || !connectivityNodeFound(b)) return false;
    const meters = distanceMeters(a.center, b.center);
    const range = (a.isCentral || b.isCentral) ? MESH_LINK_RANGE_M * 1.35 : MESH_LINK_RANGE_M;
    return meters <= range;
  };

  // Escala de nível só para os Registros (análise nó-a-nó, válida ali).
  // 4 níveis de intensidade (sem "Erro" — enlace que existe sempre cai em um
  // destes). Cores no padrão da legenda antiga: verde → verde-claro → laranja
  // → vermelho.
  const CONNECTIVITY_LEVELS = Object.freeze([
    { min: -72, label: "Muito forte", labelEn: "Very strong", color: "#16a34a" },
    { min: -84, label: "Forte", labelEn: "Strong", color: "#22c55e" },
    { min: -95, label: "Moderado", labelEn: "Moderate", color: "#f59e0b" },
    { min: -Infinity, label: "Fraco", labelEn: "Weak", color: "#ef4444" }
  ]);

  // Sinal do enlace nó-a-nó (mock determinístico): dBm em função da distância
  // relativa ao alcance + um leve jitter estável por par.
  const connectivityLinkSignal = (a, b) => {
    const meters = distanceMeters(a.center, b.center);
    const range = (a.isCentral || b.isCentral) ? MESH_LINK_RANGE_M * 1.35 : MESH_LINK_RANGE_M;
    const ratio = Math.min(1, meters / range);
    const jitter = ((hashString(`${a.id}~${b.id}`) % 11) - 5); // -5..+5
    const dBm = Math.round(-45 - ratio * 45 + jitter);
    const level = CONNECTIVITY_LEVELS.find((lv) => dBm >= lv.min) || CONNECTIVITY_LEVELS[CONNECTIVITY_LEVELS.length - 1];
    // 4 barras: -50 dBm ou melhor = cheio; -95 ou pior = 1 barra.
    const bars = Math.max(1, Math.min(4, Math.round((dBm + 95) / 45 * 4)));
    return { dBm, level, bars };
  };

  const isConnectivityPivotMoving = (item) => {
    const resolved = window.IcResolvePivotStatus?.(item);
    const raw = `${resolved?.key || ""} ${resolved?.statusText || ""} ${item?.status || ""}`.toLowerCase();
    return ["irrigando", "irrigating", "movendo", "dry_irrigation", "fertigation"].some((key) => raw.includes(key));
  };

  // Verificação de aparelhos 4G (CenterStar, LineStar, Cosmofield): não passam
  // pela malha de rádio, então são checados direto contra a operadora. O mock
  // usa o mesmo sinal de "sem comunicação" do Cosmofield e um hash estável
  // para simular quedas pontuais nos demais.
  const resolveConnectivity4gStatus = (item, index) => {
    const type = String(item?.type || "").toLowerCase();
    const category = String(item?.category || "").toLowerCase();
    if (type === "cosmofield" || category === "cosmofields") {
      // Índice do Cosmofield na fazenda: o mock de "sem comunicação" depende dele.
      let idx = index;
      if (idx == null) {
        idx = (_lastRenderedFarm?.equipments || [])
          .filter((e) => e.type === "cosmofield" || e.category === "cosmofields")
          .findIndex((e) => String(e.id) === String(item?.id));
        if (idx < 0) idx = 0;
      }
      const reading = cosmofieldReading(item, idx);
      return { online: !reading.isOffline, reason: reading.isOffline ? "offline" : "ok" };
    }
    const offline = (hashString(`4g:${_lastRenderedFarm?.id || ""}:${item?.id || ""}`) % 7) === 0;
    return { online: !offline, reason: offline ? "offline" : "ok" };
  };

  window.IcConnectivityModel = Object.freeze({
    resolveTech: resolveConnectivityTech,
    linkExists: connectivityLinkExists,
    isPivotMoving: isConnectivityPivotMoving,
    getNodes: getConnectivityNodes,
    getCentralNode: getFarmCentralNode
  });


  const buildSectorRing = (center, radius, innerRadius, bearingRefDeg, startAngle, endAngle, stepDeg = 2) => {
    let start = parseFloat(startAngle) || 0;
    let end = parseFloat(endAngle) || 360;
    if (end <= start) end += 360;

    const outer = [];
    const inner = [];

    for (let angle = start; angle <= end; angle += stepDeg) {
      const point = destinationPoint(center, radius, ((bearingRefDeg + angle) * Math.PI) / 180);
      outer.push(L.latLng(point.lat, point.lng));
    }

    const outerEnd = destinationPoint(center, radius, ((bearingRefDeg + end) * Math.PI) / 180);
    outer.push(L.latLng(outerEnd.lat, outerEnd.lng));

    for (let angle = end; angle >= start; angle -= stepDeg) {
      const point = destinationPoint(center, innerRadius, ((bearingRefDeg + angle) * Math.PI) / 180);
      inner.push(L.latLng(point.lat, point.lng));
    }

    const innerStart = destinationPoint(center, innerRadius, ((bearingRefDeg + start) * Math.PI) / 180);
    inner.push(L.latLng(innerStart.lat, innerStart.lng));

    return outer.concat(inner);
  };

  const PIVOT_COLORS = Object.freeze({
    // Valores exatos da plataforma oficial (capturados do Google Maps dela).
    outline: "#DAC422",
    stroke: "#DAC422",
    fill: "#DAC422",
    // Campo mandante da opacidade base dos pivôs na visão geral.
    fillOpacity: 0.8,
    parcelStroke: "#f7e0b2",
    parcelFillOpacity: 0.88,
    ref: "#ffffff",
    refFill: "#ffffff",
    statusText: "PAINEL ENERGIZADO",
    statusClass: "is-warning"
  });

  const PIVOT_SIM_STATUS_VISUALS = Object.freeze({
    irrigating: {
      fill: "#4679ed",
      stroke: "#4679ed",
      outline: "#4679ed",
      statusText: "IRRIGANDO",
      statusClass: "is-info"
    },
    dry_irrigation: {
      fill: "#54341c",
      stroke: "#54341c",
      outline: "#54341c",
      statusText: "MOVENDO A SECO",
      statusClass: "is-brown"
    },
    fertigation: {
      fill: "#6366f1",
      stroke: "#4f46e5",
      outline: "#4338ca",
      statusText: "FERTIRRIGACAO",
      statusClass: "is-purple"
    }
  });

  const getCentralMarkerHtml = () => `
    <div class="map-central-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path class="rep-path-4" d="M16.247 7.761a6 6 0 0 1 0 8.478"/>
        <path class="rep-path-5" d="M19.075 4.933a10 10 0 0 1 0 14.134"/>
        <path class="rep-path-2" d="M4.925 19.067a10 10 0 0 1 0-14.134"/>
        <path class="rep-path-3" d="M7.753 16.239a6 6 0 0 1 0-8.478"/>
        <circle cx="12" cy="12" r="2" fill="currentColor"/>
      </svg>
    </div>
  `;

  const getPivotSimulationStore = () => {
    if (!window.IcPivotSimulationRuntime || typeof window.IcPivotSimulationRuntime !== "object") {
      window.IcPivotSimulationRuntime = { states: {}, version: 1 };
    }
    if (!window.IcPivotSimulationRuntime.states || typeof window.IcPivotSimulationRuntime.states !== "object") {
      window.IcPivotSimulationRuntime.states = {};
    }
    return window.IcPivotSimulationRuntime;
  };

  const getPivotBaseFillOpacity = () => {
    const opacity = Number(PIVOT_COLORS.fillOpacity);
    if (!Number.isFinite(opacity)) return 0.22;
    return Math.max(0, Math.min(1, opacity));
  };

  const getPivotBaseVisuals = () => ({
    fill: PIVOT_COLORS.fill,
    stroke: PIVOT_COLORS.stroke,
    outline: PIVOT_COLORS.outline,
    fillOpacity: getPivotBaseFillOpacity(),
    statusText: PIVOT_COLORS.statusText,
    statusClass: PIVOT_COLORS.statusClass,
  });

  const normalizeAngleSpan = (startAngle, endAngle) => {
    const start = parseFloat(startAngle) || 0;
    let end = parseFloat(endAngle) || 360;
    if (end <= start) end += 360;
    return end - start;
  };

  const getPivotSimulationState = (pivotId) => {
    if (!pivotId) return null;
    return getPivotSimulationStore().states?.[pivotId] || null;
  };

  const STATUS_BAND_INNER_RATIO = 0.9;
  const STATUS_PROGRESS_KEYS = new Set(["irrigando", "movendo_a_seco", "ferti_irrigando"]);

  const getPivotBearingRefDeg = (pivot) => {
    if (!pivot?.ref || !pivot?.center) return 0;
    return (bearingRad(pivot.center, pivot.ref) * 180) / Math.PI;
  };

  const getPivotVisuals = (pivot, equip) => {
    const resolvedStatus = window.IcResolvePivotStatus?.(equip) || null;
    const simState = getPivotSimulationState(equip?.id);
    const span = pivot?.isSector ? normalizeAngleSpan(pivot.startAngle, pivot.endAngle) : 360;
    const startOffset = pivot?.isSector ? (parseFloat(pivot.startAngle) || 0) : 0;
    const progress = clampPercent(simState?.progress);

    if (resolvedStatus?.visual) {
      const statusKey = String(resolvedStatus.key || "");
      const hasProgressBand = STATUS_PROGRESS_KEYS.has(statusKey);
      const bandProgress = hasProgressBand ? progress : (statusKey === "irrigacao_finalizada" ? 100 : 0);
      const lineProgress = hasProgressBand ? progress : 0;
      // Pivô operado (com operação ativa): usa o ângulo real, sem offset randômico.
      const motionInfo = window.IcGetPivotMotionInfo?.(equip?.id) || null;
      const seed = getPivotTooltipSeed(equip?.id || "");
      const isMoved = (seed % 10) < 7;
      const seedOffset = (isMoved && !motionInfo) ? ((seed * 37) % span) : 0;

      // Soma o progresso da simulação ao offset inicial (randômico só p/ pivôs sem operação)
      const finalArmAngle = startOffset + (seedOffset + (span * lineProgress) / 100) % span;

      // Lâmina (banda irrigada): só o arco que o braço já varreu desde o início da
      // irrigação. Em pivô operado, começa no ângulo da operação (não em 0°).
      let bandStartAngle = startOffset + seedOffset;
      let bandEndAngle = startOffset + seedOffset + (span * bandProgress) / 100;
      const isIrrigatingPhase = statusKey === "irrigando" || statusKey === "ferti_irrigando";
      const isFinishedArc = statusKey === "irrigacao_finalizada" && motionInfo?.finished
        && Number.isFinite(motionInfo.startAngleDeg) && Number.isFinite(motionInfo.stopAngleDeg);
      if (motionInfo && isIrrigatingPhase && Number.isFinite(motionInfo.startAngleDeg)) {
        if (motionInfo.dirSign < 0) {
          bandStartAngle = finalArmAngle;
          bandEndAngle = motionInfo.startAngleDeg;
        } else {
          bandStartAngle = motionInfo.startAngleDeg;
          bandEndAngle = finalArmAngle;
        }
        // Evita desenhar volta inteira quando início ≈ fim (varredura ~0).
        if (Math.abs(bandEndAngle - bandStartAngle) < 0.01) bandEndAngle = bandStartAngle + 0.01;
      } else if (isFinishedArc) {
        // Finalizada: borda azul só no arco que foi irrigado.
        if (motionInfo.dirSign < 0) {
          bandStartAngle = motionInfo.stopAngleDeg;
          bandEndAngle = motionInfo.startAngleDeg;
        } else {
          bandStartAngle = motionInfo.startAngleDeg;
          bandEndAngle = motionInfo.stopAngleDeg;
        }
        if (Math.abs(bandEndAngle - bandStartAngle) < 0.01) bandEndAngle = bandStartAngle + 0.01;
      }

      return {
        ...PIVOT_COLORS,
        fill: resolvedStatus.visual.fill,
        stroke: resolvedStatus.visual.stroke,
        outline: resolvedStatus.visual.outline || resolvedStatus.visual.stroke,
        outerFill: resolvedStatus.visual.outerFill || "",
        outerFillOpacity: resolvedStatus.visual.outerFillOpacity || 0,
        fillOpacity: resolvedStatus.visual.fillOpacity ?? getPivotBaseFillOpacity(),
        parcelStroke: resolvedStatus.visual.outerFill || resolvedStatus.visual.stroke,
        statusText: resolvedStatus.statusText,
        statusClass: resolvedStatus.statusClass,
        progress: bandProgress,
        lineProgress,
        bandProgress,
        statusKey,
        armAngleOffset: finalArmAngle,
        fixedArmAngleOffset: startOffset,
        bandStartAngle,
        bandEndAngle,
        // Ângulos da operação (verde = partida, vermelho = parada) — só durante a operação ativa.
        opStartAngleDeg: (motionInfo && !motionInfo.finished) ? (motionInfo.startAngleDeg ?? null) : null,
        opStopAngleDeg: (motionInfo && !motionInfo.finished) ? (motionInfo.stopAngleDeg ?? null) : null,
        // Sentido de giro do braço: -1 = reverso (anti-horário), 1 = avanço (horário).
        armDirSign: (motionInfo && motionInfo.dirSign < 0) ? -1 : 1,
      };
    }

    const shouldUseSimulation = Boolean(simState && (simState.isRunning || simState.progress > 0));

    if (!shouldUseSimulation) {
      const seed = getPivotTooltipSeed(equip?.id || "");
      // Aleatoriza a posição de alguns pivôs para mostrar movimento (aprox. 70%)
      const isMoved = (seed % 10) < 7;
      const randomOffset = isMoved ? ((seed * 37) % span) : 0;

      return {
        ...PIVOT_COLORS,
        progress: 0,
        lineProgress: 0,
        bandProgress: 0,
        fixedArmAngleOffset: startOffset,
        armAngleOffset: randomOffset,
      };
    }

    const simVisual = PIVOT_SIM_STATUS_VISUALS[simState.mode] || PIVOT_SIM_STATUS_VISUALS.irrigating;

    return {
      ...PIVOT_COLORS,
      ...simVisual,
      progress,
      lineProgress: progress,
      bandProgress: progress,
      fixedArmAngleOffset: startOffset,
      armAngleOffset: startOffset + (span * progress) / 100,
    };
  };

  const getMdnMarkerVisual = () => {
    const zoom = Number(map?.getZoom?.() ?? 15);
    const factor = Math.max(0.5, Math.min(1, (zoom - 5) / 10));
    const size = Math.round(48 * factor);
    const border = Math.max(2, Math.round(3 * factor));
    const ring = Math.max(1, Math.round(3 * factor));
    const font = Math.max(10, Math.round(12 * factor));
    return { size, border, ring, font };
  };

  const getLineStarVisuals = (equip) => {
    const resolvedStatus = window.IcResolvePivotStatus?.(equip) || null;
    const simState = getPivotSimulationState(equip?.id);
    const progress = clampPercent(simState?.progress);

    if (resolvedStatus?.visual) {
      const statusKey = String(resolvedStatus.key || "");
      const hasProgressTrack = STATUS_PROGRESS_KEYS.has(statusKey);
      return {
        statusKey,
        fill: resolvedStatus.visual.fill,
        stroke: resolvedStatus.visual.stroke,
        outline: resolvedStatus.visual.outline || resolvedStatus.visual.stroke,
        fillOpacity: Math.max(0.38, Math.min(0.74, (resolvedStatus.visual.fillOpacity ?? getPivotBaseFillOpacity()) * 0.82)),
        progressFill: resolvedStatus.visual.outerFill || resolvedStatus.visual.stroke,
        lineProgress: hasProgressTrack ? progress : 0,
        statusText: resolvedStatus.statusText || resolvedStatus.badgeText || "PIVO LINEAR",
        statusClass: resolvedStatus.statusClass || "is-warning",
      };
    }

    return {
      statusKey: "",
      fill: PIVOT_COLORS.fill,
      stroke: PIVOT_COLORS.stroke,
      outline: PIVOT_COLORS.outline,
      fillOpacity: getPivotBaseFillOpacity(),
      progressFill: PIVOT_COLORS.stroke,
      lineProgress: 0,
      statusText: "PIVO LINEAR",
      statusClass: "is-warning",
    };
  };

  window.IcMapPivotVisualUtils = Object.freeze({
    buildFullRing,
    buildSectorRing,
    getCentralMarkerHtml,
    getPivotBearingRefDeg,
    getPivotBaseVisuals,
    getPivotBaseFillOpacity,
    getPivotVisualStyle,
    getPivotVisuals,
    statusBandInnerRatio: STATUS_BAND_INNER_RATIO,
  });

  const getNorthReferencePoint = (center, radius) => {
    if (!center || !Number.isFinite(radius) || radius <= 0) return null;
    return destinationPoint(center, radius, 0);
  };

  const resolveSmartTouchReference = (equip, center, radius) => {
    if (!center || !Number.isFinite(radius) || radius <= 0) return null;

    const refLat = toNumber(equip?.data?.refLat);
    const refLng = toNumber(equip?.data?.refLng);
    const directRef =
      Number.isFinite(refLat) && Number.isFinite(refLng)
        ? { lat: refLat, lng: refLng }
        : parseLatLngText(equip?.data?.ref);
    if (directRef) return directRef;

    const linkedPivotId = String(equip?.data?.linkedPivotId || "").trim();
    if (linkedPivotId) {
      const farm = window.IcFarmGetActive?.() || window.IcFarmActive || null;
      const linkedEquip = Array.isArray(farm?.equipments)
        ? farm.equipments.find((item) => String(item?.id || "") === linkedPivotId && String(item?.id || "") !== String(equip?.id || ""))
        : null;
      const linkedPivot = linkedEquip ? extractPivotData(linkedEquip) : null;
      if (linkedPivot?.center && linkedPivot?.ref) {
        return destinationPoint(center, radius, bearingRad(linkedPivot.center, linkedPivot.ref));
      }
    }

    return getNorthReferencePoint(center, radius);
  };

  const extractPivotData = (equip) => {
    if (!equip || !equip.type || !equip.data) return null;

    if (equip.type === "smart_connect") {
      const centerLat = toNumber(equip.data.centerLat);
      const centerLng = toNumber(equip.data.centerLng);
      const refLat = toNumber(equip.data.refLat);
      const refLng = toNumber(equip.data.refLng);
      const center =
        Number.isFinite(centerLat) && Number.isFinite(centerLng)
          ? { lat: centerLat, lng: centerLng }
          : parseLatLngText(equip.data.center);
      const ref =
        Number.isFinite(refLat) && Number.isFinite(refLng)
          ? { lat: refLat, lng: refLng }
          : parseLatLngText(equip.data.ref);
 
      if (!center) return null;
      let radius = toNumber(equip.data.radius);
      if ((!radius || radius <= 0) && ref) {
        radius = L.latLng(center.lat, center.lng).distanceTo([ref.lat, ref.lng]);
      }
      if (!radius || radius <= 0) return null;
 
      const isSector = equip.data.isSector === true || equip.data.isSector === "true";
      const startAngle = equip.data.startAngle;
      const endAngle = equip.data.endAngle;
 
      return { center, radius, ref, isSector, startAngle, endAngle };
    }

    if (equip.type === "smarttouch") {
      const lat = toNumber(equip.data.lat);
      const lng = toNumber(equip.data.lng);
      const center =
        Number.isFinite(lat) && Number.isFinite(lng)
          ? { lat, lng }
          : parseLatLngText(equip.data.loc);
      const radius = toNumber(equip.data.radius);
      if (!center || !radius || radius <= 0) return null;
      const isSector = equip.data.isSector === true || equip.data.isSector === "true";
      const startAngle = equip.data.startAngle;
      const endAngle = equip.data.endAngle;
      return {
        center,
        radius,
        ref: resolveSmartTouchReference(equip, center, radius),
        linkedPivotId: equip.data.linkedPivotId,
        parcels: equip.data.parcels || [],
        isSector,
        startAngle,
        endAngle
      };
    }

    return null;
  };



  const RAINSTAR_STATUS_VISUALS = Object.freeze({
    irrigating: {
      label: "IRRIGANDO",
      shortLabel: "Irrigando",
      badgeClass: "map-card__equip-badge--info",
      statusClass: "is-info",
      fill: "#3b82f6",
      remainingFill: "#d98c00",
      stroke: "#ffffff",
    },
    stopped_stop_sensor: {
      label: "PARADO POR SENSOR DE PARADA",
      shortLabel: "Stand-By",
      badgeClass: "map-card__equip-badge--warn",
      statusClass: "is-warning",
      fill: "#3b82f6",
      remainingFill: "#d98c00",
      markerFill: "#d98c00",
      stroke: "#ffffff",
    },
    speed_not_reached: {
      label: "VELOCIDADE NÃO ATINGIDA",
      shortLabel: "Alerta",
      badgeClass: "map-card__equip-badge--danger",
      statusClass: "is-danger",
      fill: "#ef4444",
      remainingFill: "#d98c00",
      stroke: "#ffffff",
    },
    disconnected: {
      label: "DESCONECTADO",
      shortLabel: "Offline",
      badgeClass: "map-card__equip-badge--neutral",
      statusClass: "is-neutral",
      fill: "#6b7280",
      remainingFill: "#6b7280",
      stroke: "#ffffff",
    },
    waiting_connection: {
      label: "ESPERANDO CONEXÃO",
      shortLabel: "Aguardando",
      badgeClass: "map-card__equip-badge--neutral",
      statusClass: "is-neutral",
      fill: "#6b7280",
      remainingFill: "#6b7280",
      stroke: "#ffffff",
    },
  });

  const resolveRainstarStatus = (equip) => {
    const raw = String(equip?.data?.status || equip?.status || "stopped_stop_sensor").toLowerCase();
    return RAINSTAR_STATUS_VISUALS[raw] || RAINSTAR_STATUS_VISUALS.stopped_stop_sensor;
  };
  window.IcResolveRainstarStatus = resolveRainstarStatus;

  const readPoint = (data, latKeys, lngKeys) => {
    const lat = latKeys.map((key) => toNumber(data?.[key])).find(Number.isFinite);
    const lng = lngKeys.map((key) => toNumber(data?.[key])).find(Number.isFinite);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  };

  const extractRainstarData = (equip) => {
    const type = String(equip?.type || "").toLowerCase();
    const category = String(equip?.category || "").toLowerCase();
    if (type !== "rainstar" || category !== "carreteis") return null;
    const data = equip?.data || {};
    const reel = readPoint(data, ["reelLat", "lat", "centerLat"], ["reelLng", "lng", "centerLng"]);
    if (!reel) return null;

    const start = readPoint(data, ["startLat", "initialLat", "refLat"], ["startLng", "initialLng", "refLng"]);
    const hasLane = Boolean(start) && Number.isFinite(distanceMeters(start, reel)) && distanceMeters(start, reel) > 2;
    const fullLength = hasLane ? distanceMeters(start, reel) : (toNumber(data.hoseLength) || toNumber(data.length) || 0);
    const pulledPipe = Math.max(0, toNumber(data.pulledPipeLength ?? data.hosePulledLength) || 0);
    const pendingStart = data.startPositionPendingIrrigation === true || data.startPositionPendingIrrigation === "true";
    const explicitProgress = toNumber(data.irrigationProgress);
    const irrigatedPipe = toNumber(data.irrigatedPipeLength ?? data.completedPipeLength);
    let progress = 0;
    if (hasLane && fullLength > 0) {
      if (Number.isFinite(explicitProgress)) {
        progress = explicitProgress > 1 ? explicitProgress / 100 : explicitProgress;
      } else if (Number.isFinite(irrigatedPipe)) {
        progress = irrigatedPipe / fullLength;
      } else {
        progress = pendingStart ? 0 : pulledPipe / fullLength;
      }
      progress = Math.max(0, Math.min(1, progress));
    }
    const center = hasLane ? interpolatePoint(start, reel, progress) : reel;
    return {
      reel,
      start,
      center,
      hasLane,
      fullLength,
      pulledPipe,
      progress,
      width: Math.max(18, toNumber(data.workingWidth ?? data.width) || 72),
    };
  };
  window.IcExtractRainstarData = extractRainstarData;

  const escapeTooltipHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const getPivotTooltipSeed = (value) =>
    String(value || "")
      .split("")
      .reduce((sum, char) => sum + char.charCodeAt(0), 0);

  // Estado "ligada via internet" da bomba — determinístico p/ o preview,
  // compartilhado entre marcador no mapa, lista lateral e contadores do card.
  // O usuário pode ligar/desligar pelo modal; a escolha fica salva no localStorage.
  const BOMBA_OVERRIDE_KEY = "ic:bomba-running";
  const readBombaOverrides = () => {
    try { return JSON.parse(localStorage.getItem(BOMBA_OVERRIDE_KEY)) || {}; }
    catch (_) { return {}; }
  };
  const bombaItemKey = (item) => String(item?.id || item?.data?.serial || item?.name || "");

  const resolveBombaRunning = (item) => {
    if (!item) return false;
    const overrides = readBombaOverrides();
    const key = bombaItemKey(item);
    if (Object.prototype.hasOwnProperty.call(overrides, key)) return !!overrides[key];
    const data = item.data || item;
    if (data.running != null) return !!data.running;
    if (item.running != null) return !!item.running;
    const statusText = data.status || data.statusBomba || item.status || item.statusBomba || "";
    if (/ligad/i.test(statusText)) return true;
    if (/deslig/i.test(statusText)) return false;
    return getPivotTooltipSeed(item.id || data.serial || item.name || "") % 2 === 1;
  };

  const resolveBombaStatus = (item) => {
    const data = item?.data || item || {};
    const raw = String(data.status || data.statusBomba || item?.status || item?.statusBomba || "").toLowerCase();
    const isAlert = data.semComunicacao === true || data.alert === true || data.alerta === true || /alert|falha|offline|sem comunica/.test(raw);
    if (isAlert) {
      return { key: "alert", label: "Alerta", text: "ALERTA", badgeClass: "map-card__equip-badge--danger", statusClass: "is-danger", running: false };
    }
    const running = resolveBombaRunning(item);
    return running
      ? { key: "running", label: "Ligada via internet", text: "LIGADA VIA INTERNET", badgeClass: "map-card__equip-badge--info", statusClass: "is-info", running: true }
      : { key: "stopped", label: "Desligada", text: "DESLIGADA", badgeClass: "map-card__equip-badge--warn", statusClass: "is-warning", running: false };
  };

  window.IcResolveBombaRunning = resolveBombaRunning;
  window.IcResolveBombaStatus = resolveBombaStatus;

  // Status do Medidor de Nível — usado no marcador do mapa e no resumo do
  // card de equipamentos. Mesmas cores do resto do painel.
  const resolveMdnStatus = (equip) => {
    const data = equip?.data || {};
    const statusText = String(data.status || "").toLowerCase();
    if (data.semComunicacao === true || statusText === "offline" || statusText.includes("sem comunica")) {
      return { key: "offline", label: "Sem comunicação", badgeClass: "map-card__equip-badge--danger", color: "#dc2626" };
    }
    const percent = toNumber(data.levelPercent ?? data.percent ?? data.nivelPercent ?? data.current?.percent);
    const min = toNumber(data.nivelValMin);
    const max = toNumber(data.nivelValMax);
    if (Number.isFinite(percent)) {
      if (Number.isFinite(max) && percent >= max) {
        return { key: "high", label: "Nível cheio", badgeClass: "map-card__equip-badge--info", color: "#3b82f6" };
      }
      if (Number.isFinite(min) && percent <= min) {
        return { key: "low", label: "Nível baixo", badgeClass: "map-card__equip-badge--warn", color: "#dac422" };
      }
    }
    return { key: "normal", label: "Nível normal", badgeClass: "map-card__equip-badge--success", color: "#16a34a" };
  };
  window.IcResolveMdnStatus = resolveMdnStatus;

  // Liga/desliga a bomba (preview), salva a escolha e re-renderiza mapa + lista.
  window.IcSetBombaRunning = (id, running) => {
    const key = String(id || "");
    if (!key) return;
    const overrides = readBombaOverrides();
    overrides[key] = !!running;
    try { localStorage.setItem(BOMBA_OVERRIDE_KEY, JSON.stringify(overrides)); } catch (_) {}
    const farm = window.IcFarmGetActive?.() || window.icFarmData || window.IcFarmActive || null;
    if (farm && typeof window.IcMapRenderPivots === "function") window.IcMapRenderPivots(farm);
    window.IcFarmsRenderEquipment?.();
    window.IcMapUpdateCardStatusCounts?.();
  };

  const formatPivotTooltipNumber = (value, digits = 1) => {
    const parsed = toNumber(value);
    return Number.isFinite(parsed) ? parsed.toFixed(digits) : null;
  };

  const formatPivotTooltipDate = (value) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${dd} ${months[date.getMonth()]} ${date.getFullYear()} ${hh}:${mm}`;
  };

  const resolvePivotTooltipLastCommunication = (source, seed, fallback = null) => {
    const preferredText = [
      source?.lastCommunicationText,
      source?.ultimaComunicacaoTexto,
      source?.lastSeenText,
      source?.updatedLabel,
    ].find((item) => String(item || "").trim());
    if (preferredText) return String(preferredText).trim();

    const rawDate = [
      source?.lastCommunication,
      source?.ultimaComunicacao,
      source?.lastSeenAt,
      source?.updatedAt,
    ]
      .map((item) => formatPivotTooltipDate(item))
      .find(Boolean);
    if (rawDate) return rawDate;
    if (fallback !== null) return fallback;

    const day = String(1 + (seed % 28)).padStart(2, "0");
    const hour = String((seed * 3) % 24).padStart(2, "0");
    const minute = String((seed * 7) % 60).padStart(2, "0");
    return `${day} abr 2026 ${hour}:${minute}`;
  };

  const buildPivotTooltipSummary = (pivot, equip, pivotColors) => {
    const source = window.Pivos?.data?.getPivotData?.(equip?.id) || equip?.data || {};
    const seed = getPivotTooltipSeed(equip?.id || source?.id || equip?.name || "");
    const fallbackAngle = Number.isFinite(pivotColors?.armAngleOffset)
      ? Math.round(((pivotColors.armAngleOffset % 360) + 360) % 360)
      : null;
    const angleValue =
      toNumber(source?.currentAngle) ??
      toNumber(source?.angle) ??
      toNumber(source?.angulo) ??
      toNumber(source?.anguloAtual) ??
      fallbackAngle ??
      ((seed * 7) % 360);
    const pressureCenterValue =
      formatPivotTooltipNumber(
        source?.pressaoCentro ??
          source?.pressureCenter ??
          source?.centerPressure ??
          source?.pressaoC ??
          (3.5 + (seed % 20) / 10),
        1
      ) || "--";
    const pluviometerValue =
      formatPivotTooltipNumber(
        source?.pluviometro ??
          source?.pluviometer ??
          source?.rain24h ??
          source?.chuva24h ??
          source?.pluvio ??
          (5 + (seed % 150) / 10),
        1
      ) || "--";
    const hoursRaw =
      toNumber(source?.horas) ??
      toNumber(source?.hours) ??
      toNumber(source?.totalHours) ??
      toNumber(source?.workingHours) ??
      (150 + (seed % 200));

    const turnCount = 
      toNumber(source?.turnCount) ?? 
      toNumber(source?.voltas) ?? 
      toNumber(source?.voltasTotais) ??
      (seed % 10);
      
    const pressureMotorValue = formatPivotTooltipNumber(
      source?.pressaoMotor ??
      source?.motorPressure ??
      source?.lastTowerPressure ??
      source?.pressaoUltimaTorre ??
      (2.8 + (seed % 15) / 10),
      1
    ) || "--";

    const voltageRaw = toNumber(source?.voltage ?? source?.voltagem ?? source?.tensao ?? source?.volt);
    const voltageLabel = Number.isFinite(voltageRaw) ? `${Math.round(voltageRaw)} V` : `${200 + (seed % 40)} V`;

    return {
      angleLabel: `${Math.round(angleValue)}°`,
      pressureCenterLabel: pressureCenterValue === "--" ? pressureCenterValue : `${pressureCenterValue} bar`,
      pressureMotorLabel: pressureMotorValue === "--" ? pressureMotorValue : `${pressureMotorValue} bar`,
      pluviometerLabel: pluviometerValue === "--" ? "0mm" : `${pluviometerValue}mm`,
      hoursLabel: Number.isFinite(hoursRaw) ? `${Math.round(hoursRaw)}h00min` : "00h00min",
      turnCountLabel: String(turnCount),
      voltageLabel,
      lastCommunication: resolvePivotTooltipLastCommunication(source, seed),
    };
  };

  const _PIVOT_STATUS_EN = {
    "PAINEL ENERGIZADO": "ENERGIZED PANEL",
    "IRRIGANDO": "IRRIGATING",
    "MOVENDO A SECO": "DRY MOVING",
    "PARADO": "STOPPED",
    "FALHA DE PRESSÃO": "PRESSURE FAILURE",
    "DESALINHAMENTO": "MISALIGNMENT",
    "TENSÃO BAIXA": "LOW VOLTAGE",
    "PICO DE TENSÃO": "VOLTAGE PEAK",
  };
  const toEnPivotStatus = (text) => _PIVOT_STATUS_EN[String(text || "").trim().toUpperCase()] || text;

  const buildTooltipDetailHtml = (icon, value, options = {}) => {
    const iconMarkup = String(options?.iconMarkup || "").trim();
    const imgStyle = `width: 15px; height: 15px; object-fit: contain; filter: invert(33%) sepia(14%) saturate(620%) hue-rotate(175deg) brightness(80%) contrast(90%);`;
    const iconHtml = iconMarkup || `<img src="./assets/img/svg/${icon}" style="${imgStyle}">`;
    return `
      <span class="pivot-tooltip__detail">
        ${iconHtml}
        <span>${escapeTooltipHtml(value)}</span>
      </span>
    `;
  };

  // Legenda extra do status quando o pivô está operando: lâmina (mm) + direção + tempo restante.
  const DISPLAY_LAP_HOURS_AT_100 = 14; // ~14h por volta a 100% (estimativa só p/ exibição)
  const buildPivotStatusExtraHtml = (pivotId) => {
    const info = window.IcGetPivotMotionInfo?.(pivotId);
    if (!info) return "";
    const dirIcon = info.dirSign < 0 ? "fa-arrow-rotate-left" : "fa-arrow-rotate-right";
    const dirTitle = info.dirSign < 0 ? "Reverso" : "Avanço";
    // Lâmina de água da operação (mm).
    const lamina = Number(info.laminaMm) > 0 ? `${info.laminaMm.toFixed(2)} mm` : "";
    // Tempo restante estimado da volta atual, em HH:MM (proporcional à velocidade).
    const lapMin = DISPLAY_LAP_HOURS_AT_100 * (100 / Math.max(1, info.speedPct)) * 60;
    const remFrac = info.dirSign < 0 ? (info.progress / 100) : ((100 - info.progress) / 100);
    const remMin = Math.max(0, Math.round(remFrac * lapMin));
    const hh = Math.floor(remMin / 60);
    const mm = String(remMin % 60).padStart(2, "0");
    return ` <span class="pivot-tooltip__status-meta">`
      + (lamina ? `${lamina} ` : "")
      + `<i class="fa-solid ${dirIcon}" title="${dirTitle}"></i> `
      + `${hh}:${mm}`
      + `</span>`;
  };
  // Disponível p/ a lista lateral de equipamentos reusar a mesma legenda.
  window.IcBuildPivotStatusMeta = buildPivotStatusExtraHtml;

  const buildPivotDetailsTooltipHtml = (pivot, equip, pivotColors, titleOverride = null) => {
    const summary = buildPivotTooltipSummary(pivot, equip, pivotColors);
    const name = escapeTooltipHtml(titleOverride || equip?.name || "Pivo");
    const _rawStatus = pivotColors?.statusText || "PAINEL ENERGIZADO";
    const statusText = escapeTooltipHtml(_rawStatus);
    const statusClass = escapeTooltipHtml(pivotColors?.statusClass || "is-warning");
    const statusExtra = buildPivotStatusExtraHtml(equip?.id);

    return `
      <div class="pivot-tooltip pivot-tooltip--pivot-card">
        <div class="pivot-tooltip__topline">
          <span class="pivot-tooltip__name">${name}</span>
          <span class="pivot-tooltip__status ${statusClass}">${statusText}${statusExtra}</span>
        </div>
        <div class="pivot-tooltip__details-grid">
          ${buildTooltipDetailHtml("circle-gauge.svg", summary.angleLabel)}
          ${buildTooltipDetailHtml("gauge.svg", summary.pressureCenterLabel)}
          ${buildTooltipDetailHtml("clock.svg", summary.hoursLabel)}
          ${equip?.type !== "smarttouch" ? buildTooltipDetailHtml("cloud-rain.svg", summary.pluviometerLabel) : ""}
          ${equip?.type !== "smarttouch" ? buildTooltipDetailHtml("gauge.svg", summary.pressureMotorLabel) : ""}
          ${buildTooltipDetailHtml("zap.svg", summary.voltageLabel)}
        </div>
        <span class="pivot-tooltip__date"><span class="comm-label">Última comunicação:</span> ${escapeTooltipHtml(summary.lastCommunication)}</span>
      </div>
    `;
  };

  const readLineStarKpiValue = (id) => {
    const text = document.getElementById(id)?.textContent;
    return String(text || "").trim() || null;
  };

  const buildLineStarTooltipSummary = (equip, visual) => {
    const source = equip?.data || {};
    const seed = getPivotTooltipSeed(equip?.id || source?.id || equip?.name || "");
    const simProgress = clampPercent(getPivotSimulationState(equip?.id)?.progress);
    const rawPressure =
      toNumber(source?.pressaoAtual) ??
      toNumber(source?.pressureBar) ??
      toNumber(source?.pressao);
    const rawHours =
      toNumber(source?.horimetro) ??
      toNumber(source?.hours) ??
      toNumber(source?.runtimeHours) ??
      toNumber(source?.workingHours);
    const rawPluviometer =
      toNumber(source?.pluviometro) ??
      toNumber(source?.pluviometer) ??
      toNumber(source?.rain24h) ??
      toNumber(source?.chuva24h);
    const rawTurnCount =
      toNumber(source?.corridas) ??
      toNumber(source?.turnCount) ??
      toNumber(source?.voltas);
    const rawSpeed =
      toNumber(source?.velocidadeAtual) ??
      toNumber(source?.speedMetersHour) ??
      toNumber(source?.speedMph);
    const fallbackPosition = simProgress > 0 ? `${Math.round(simProgress)}%` : "45%";
    const fallbackPressure = Number.isFinite(rawPressure) && rawPressure <= 10
      ? `${rawPressure.toFixed(1)} bar`
      : "3.8 bar";
    const fallbackHours = Number.isFinite(rawHours) ? `${Math.round(rawHours)}h` : "420h";
    const fallbackPluviometer = Number.isFinite(rawPluviometer)
      ? `${rawPluviometer.toFixed(1)} mm`
      : "0.0 mm";
    const fallbackTurnCount = Number.isFinite(rawTurnCount) ? String(Math.round(rawTurnCount)) : "12";
    const fallbackSpeed = Number.isFinite(rawSpeed) && rawSpeed <= 10
      ? `${rawSpeed.toFixed(1)} m/h`
      : "1.2 m/h";

    return {
      positionLabel: readLineStarKpiValue("kpiLinPosVal") || fallbackPosition,
      pressureLabel: readLineStarKpiValue("kpiLinPressaoVal") || fallbackPressure,
      hoursLabel: readLineStarKpiValue("kpiLinHorasVal") || fallbackHours,
      pluviometerLabel: readLineStarKpiValue("kpiLinPluvVal") || fallbackPluviometer,
      turnCountLabel: readLineStarKpiValue("kpiLinVoltasVal") || fallbackTurnCount,
      speedLabel: readLineStarKpiValue("kpiLinVelVal") || fallbackSpeed,
      lastCommunication: resolvePivotTooltipLastCommunication(source, seed),
      statusText: escapeTooltipHtml(visual?.statusText || "PAINEL ENERGIZADO"),
      statusClass: escapeTooltipHtml(visual?.statusClass || "is-warning"),
      name: escapeTooltipHtml(equip?.name || "LineStar"),
    };
  };

  const buildLineStarDetailsTooltipHtml = (equip, visual) => {
    const summary = buildLineStarTooltipSummary(equip, visual);

    return `
      <div class="pivot-tooltip pivot-tooltip--pivot-card">
        <div class="pivot-tooltip__topline">
          <span class="pivot-tooltip__name">${summary.name}</span>
          <span class="pivot-tooltip__status ${summary.statusClass}">${summary.statusText}</span>
        </div>
        <div class="pivot-tooltip__details-grid">
          ${buildTooltipDetailHtml("waypoints.svg", summary.positionLabel, {
            iconMarkup: '<div class="pincard__kpi-icon"><i class="fa-solid fa-arrows-left-right" style="color: #64748b;"></i></div>'
          })}
          ${buildTooltipDetailHtml("gauge.svg", summary.pressureLabel)}
          ${buildTooltipDetailHtml("clock.svg", summary.hoursLabel)}
          ${buildTooltipDetailHtml("wind.svg", summary.speedLabel)}
        </div>
        <span class="pivot-tooltip__date"><span class="comm-label">Última comunicação:</span> ${escapeTooltipHtml(summary.lastCommunication)}</span>
      </div>
    `;
  };

  window.IcMapTooltipUtils = Object.freeze({
    buildPivotTooltipSummary,
    buildLineStarTooltipSummary,
    buildLineStarDetailsTooltipHtml,
    getLineStarVisuals,
    resolvePivotTooltipLastCommunication,
  });

  const extractMdnData = (equip) => {
    if (!equip || equip.type !== "medidor" || !equip.data) return null;
    const lat = toNumber(equip.data.lat);
    const lng = toNumber(equip.data.lng);
    const center =
      Number.isFinite(lat) && Number.isFinite(lng)
        ? { lat, lng }
        : parseLatLngText(equip.data.loc);
    if (!center) return null;

    const statusText = String(equip.data.status || "").toLowerCase();
    const offline = equip.data.semComunicacao === true || statusText === "offline" || statusText.includes("sem comunica");
    const percentRaw =
      toNumber(equip.data.levelPercent) ??
      toNumber(equip.data.percent) ??
      toNumber(equip.data.nivelPercent) ??
      toNumber(equip.data.current?.percent);
    const hasReading = percentRaw !== null;
    const percent = percentRaw === null ? (offline ? 0 : 82) : Math.max(0, Math.min(100, percentRaw));
    const metersRaw =
      toNumber(equip.data.levelMeters) ??
      toNumber(equip.data.nivelMeters) ??
      toNumber(equip.data.levelM) ??
      toNumber(equip.data.nivelM) ??
      toNumber(equip.data.current?.meters);
    const meters = metersRaw === null ? 4.24 : Math.max(0, metersRaw);
    const seed = getPivotTooltipSeed(equip.id || equip.data.serial || equip.name || "");
    const lastCommunication = resolvePivotTooltipLastCommunication(
      {
        ...equip.data,
        lastCommunicationText: equip.data.lastCommunicationText || equip.data.ultimaComunicacaoTexto,
        lastCommunication: equip.data.lastCommunication || equip.data.ultimaComunicacao,
        lastSeenAt: equip.data.lastSeenAt || equip.updatedAt || equip.createdAt,
        updatedAt: equip.data.updatedAt || equip.updatedAt || equip.createdAt,
      },
      seed
    );
    const minPercent = toNumber(equip.data.nivelValMin) ?? toNumber(equip.data.valorMinimo) ?? toNumber(equip.data.minPercent) ?? null;
    const maxPercent = toNumber(equip.data.nivelValMax) ?? toNumber(equip.data.valorMaximo) ?? toNumber(equip.data.maxPercent) ?? null;
    return { center, percent, meters, lastCommunication, offline, hasReading, minPercent, maxPercent };
  };

  const extractRepeaterData = (equip) => {
    if (!equip || equip.type !== "repetidora" || !equip.data) return null;
    const lat = toNumber(equip.data.lat);
    const lng = toNumber(equip.data.lng);
    const center =
      Number.isFinite(lat) && Number.isFinite(lng)
        ? { lat, lng }
        : parseLatLngText(equip.data.loc);
    if (!center) return null;
    const seed = getPivotTooltipSeed(equip.id || equip.data.serial || equip.name || "");
    const lastCommunication = resolvePivotTooltipLastCommunication(
      {
        ...equip.data,
        lastCommunicationText: equip.data.lastCommunicationText || equip.data.ultimaComunicacaoTexto,
        lastCommunication: equip.data.lastCommunication || equip.data.ultimaComunicacao,
        lastSeenAt: equip.data.lastSeenAt || equip.updatedAt || equip.createdAt,
        updatedAt: equip.data.updatedAt || equip.updatedAt || equip.createdAt,
      },
      seed
    );
    const height = toNumber(equip.data.height) ?? toNumber(equip.data.altura) ?? null;
    return { center, lastCommunication, height };
  };

  const extractWeatherStationData = (equip) => {
    if (!equip || !equip.data) return null;
    const type = String(equip.type || "").toLowerCase();
    if (type !== "estacao_metereologica" && type !== "estacao_meteorologica" && type !== "weather_station") return null;
    const data = equip.data;
    const lat = toNumber(data.lat);
    const lng = toNumber(data.lng);
    const center =
      Number.isFinite(lat) && Number.isFinite(lng)
        ? { lat, lng }
        : parseLatLngText(data.loc);
    if (!center) return null;
    const status = String(data.status || "").toLowerCase();
    const offline = data.semComunicacao === true || status === "offline";
    const c = (data.current && typeof data.current === "object") ? data.current : {};
    return {
      center,
      offline,
      lastCommunication: data.updated || equip.updatedAt || equip.createdAt || "",
      current: {
        temperature: toNumber(c.temperature),
        humidity: toNumber(c.humidity),
        windSpeed: toNumber(c.windSpeed),
        windDir: c.windDir ?? null,
        windDirDeg: toNumber(c.windDirDeg ?? c.windDir),
        rainDay: toNumber(c.rainDay),
        eto: toNumber(c.eto),
        solarRadiation: toNumber(c.solarRadiation),
        solarRadiationDay: toNumber(c.solarRadiationDay),
      },
    };
  };

  const extractCosmofieldData = (equip) => {
    if (!equip || equip.type !== "cosmofield" || !equip.data) return null;
    const lat = toNumber(equip.data.lat);
    const lng = toNumber(equip.data.lng);
    const center =
      Number.isFinite(lat) && Number.isFinite(lng)
        ? { lat, lng }
        : parseLatLngText(equip.data.loc);
    if (!center) return null;
    return { center };
  };

  const extractPumpData = (equip) => {
    if (!equip || equip.type !== "irripump" || !equip.data) return null;
    const lat = toNumber(equip.data.lat);
    const lng = toNumber(equip.data.lng);
    const center =
      Number.isFinite(lat) && Number.isFinite(lng)
        ? { lat, lng }
        : parseLatLngText(equip.data.loc);
    if (!center) return null;
    const pressureRaw =
      toNumber(equip.data.pressureBar) ??
      toNumber(equip.data.pressure) ??
      toNumber(equip.data.pressaoBar) ??
      toNumber(equip.data.pressao);
    const pressure = pressureRaw === null ? 0 : Math.max(0, pressureRaw);
    const seed = getPivotTooltipSeed(equip.id || equip.data.serial || equip.name || "");
    const running = resolveBombaRunning(equip);
    const statusText = String(equip.data.status || equip.data.statusBomba || "").toLowerCase();
    const offline = equip.data.semComunicacao === true || statusText.includes("offline") || statusText.includes("sem comunica");
    const lastCommunication = resolvePivotTooltipLastCommunication(
      {
        ...equip.data,
        lastCommunicationText: equip.data.lastCommunicationText || equip.data.ultimaComunicacaoTexto,
        lastCommunication: equip.data.lastCommunication || equip.data.ultimaComunicacao,
        lastSeenAt: equip.data.lastSeenAt || equip.data.updatedAt || equip.updatedAt,
        updatedAt: equip.data.updatedAt || equip.updatedAt,
      },
      seed,
      "04 mar 2026 15:15"
    );
    return { center, pressure, lastCommunication, running, offline };
  };
  const extractCentralData = (equip) => {
    if (!equip || !equip.data) return null;
    if (equip.type !== "smart_connect" && equip.type !== "smarttouch") return null;

    // Se tiver raio, provavelmente é um pivo e já foi desenhado no pivotLayer
    const pivot = extractPivotData(equip);
    if (pivot && pivot.radius > 0) return null;

    const lat = toNumber(equip.data.lat || equip.data.centerLat);
    const lng = toNumber(equip.data.lng || equip.data.centerLng);
    if (lat === 0 && lng === 0) return null;
    const center =
      Number.isFinite(lat) && Number.isFinite(lng)
        ? { lat, lng }
        : parseLatLngText(equip.data.loc || equip.data.center);

    if (!center) return null;
    return { center };
  };

  const getConnectivityMarkerFill = (equip) => {
    const tech = resolveConnectivityTech(equip);
    const state = _connectivityScanState.get(String(equip?.id || ""));
    // 4G resolve o próprio estado sem participar da varredura de rádio, mas o
    // pino segue o mesmo padrão verde/vermelho — só não desenha linhas.
    if (tech === "4g") {
      const online = state ? state.found !== false : resolveConnectivity4gStatus(equip).online;
      if (!state && !_connectivityScanDone) return CONNECTIVITY_SCAN_COLORS.idle;
      return online ? CONNECTIVITY_SCAN_COLORS.found : CONNECTIVITY_SCAN_COLORS.missing;
    }
    if (!state) return CONNECTIVITY_SCAN_COLORS.idle;
    return state.found ? CONNECTIVITY_SCAN_COLORS.found : CONNECTIVITY_SCAN_COLORS.missing;
  };

  // Endereço de rádio para exibição: usa o valor real quando parece um endereço
  // (hex de 12-16 chars); senão gera um mock hex estável a partir do id.
  const connectivityRadioAddr = (node) => {
    const raw = String(node?.radio || "");
    if (/^[0-9A-Fa-f]{12,16}$/.test(raw)) return raw.toUpperCase();
    const h = hashString(`radio:${node?.id || ""}`).toString(16).toUpperCase().padStart(8, "0");
    return `0013A200${h}`;
  };

  // Tooltip de hover no modo Conectividade: nome, rádio e última comunicação —
  // no mesmo padrão do balão do produto.
  const buildConnectivityTooltip = (equip, fallbackName) => {
    const name = escapeTooltipHtml(equip?.name || fallbackName || "Equipamento");
    const radio = escapeTooltipHtml(connectivityRadioAddr(equip));
    const seed = getPivotTooltipSeed(equip?.id || equip?.name || "");
    const lastComm = escapeTooltipHtml(
      resolvePivotTooltipLastCommunication(equip?.data || equip || {}, seed)
    );
    const commLabel = escapeTooltipHtml(window.IcI18n?.t?.("Última comunicação:") ?? "Última comunicação:");
    return `
      <div class="pivot-tooltip conn-tooltip">
        <span class="pivot-tooltip__name">${name}</span>
        <span class="conn-tooltip__radio">${radio}</span>
        <span class="pivot-tooltip__date"><span class="comm-label">${commLabel}</span> ${lastComm}</span>
      </div>`;
  };

  const registerConnectivityMarker = (latLng, equip, layer, label, options = {}) => {
    const marker = L.circleMarker([latLng.lat, latLng.lng], {
      radius: options.radius || (resolveConnectivityTech(equip) === "4g" ? 6 : 5),
      color: "rgba(17,17,17,0.42)",
      weight: 1.25,
      fillColor: getConnectivityMarkerFill(equip),
      fillOpacity: 1,
      interactive: true,
      equipId: equip.id,
      connTech: resolveConnectivityTech(equip),
    }).addTo(layer).bindTooltip(buildConnectivityTooltip(equip, label), {
      direction: "top",
      offset: [0, -6],
      opacity: 1,
      className: "pivot-tooltip-wrap conn-tooltip-wrap",
    });
    marker.on("click", (event) => {
      if (window.IcEquipmentDeleteShortcut?.handleMapClick?.(equip, event)) return;
      if (!isConnectivityMode()) return;
      window.IcConnectivitySelect?.(equip.id);
    });
    _connectivityMarkers.push(marker);
    return marker;
  };

  // ---- LineStar helpers: zero-angle markers ----
  // Dois triângulos nas bordas longas do retângulo, de frente um para o outro,
  // indicando o ângulo zero (ponta A da trilha).
  const drawLineStarZeroAngleMarkers = (layer, track, options = {}) => {
    if (!layer || !track?.ptA || !track?.ptB) return;

    const hasWidthA = Number(track.widthA) > 0;
    const hasWidthB = Number(track.widthB) > 0;
    if (!hasWidthA && !hasWidthB) return;

    const brng = bearingRad(track.ptA, track.ptB);
    const offsetPerp = (origin, meters, side) => destinationPoint(origin, meters, brng + (side * Math.PI / 2));
    const refColor = options.color || "#ffffff";

    const selectedSide = options.hoseSide === "B" ? "B" : "A";

    const drawMarker = (origin, width, side) => {
      if (!(Number(width) > 0)) return;
      const edge = offsetPerp(origin, width, side);
      const triHeight = width * 0.44;
      const triHalfBase = width * 0.20;
      const tipBearing = side === -1 ? brng + Math.PI / 2 : brng - Math.PI / 2;
      const base1 = destinationPoint(edge, triHalfBase, brng);
      const base2 = destinationPoint(edge, triHalfBase, brng + Math.PI);
      const tip = destinationPoint(edge, triHeight, tipBearing);

      L.polygon([base1, base2, tip].map((p) => [p.lat, p.lng]), {
        color: "#000000",
        weight: 1.2,
        opacity: 0.25,
        fillColor: refColor,
        fillOpacity: 0.95,
        interactive: false,
      }).addTo(layer);
    };

    if (hasWidthA && hasWidthB) {
      if (selectedSide === "A") drawMarker(track.ptA, track.widthA, -1);
      else drawMarker(track.ptB, track.widthB, 1);
      return;
    }

    const markerOrigin = selectedSide === "A" ? track.ptA : track.ptB;
    if (hasWidthA) drawMarker(markerOrigin, track.widthA, -1);
    else if (hasWidthB) drawMarker(markerOrigin, track.widthB, 1);
  };

  // ---- LineStar (pivô linear) ----
  const extractLineStar = (equip) => {
    if (!equip || equip.type !== "linestar" || !equip.data) return null;
    const latA = toNumber(equip.data.latA);
    const lngA = toNumber(equip.data.lngA);
    const latB = toNumber(equip.data.latB);
    const lngB = toNumber(equip.data.lngB);
    const legacyWidth = toNumber(equip.data.width);
    const storedWidthA = toNumber(equip.data.widthA);
    const storedWidthB = toNumber(equip.data.widthB);
    const hasSeparateWidths = Object.prototype.hasOwnProperty.call(equip.data, "widthA") ||
      Object.prototype.hasOwnProperty.call(equip.data, "widthB");
    const legacyHalfWidth = Number.isFinite(legacyWidth) && legacyWidth > 0 ? legacyWidth / 2 : 0;
    const legacySingleSide = equip.data.widthSide === -1 || equip.data.widthSide === 1;
    const widthA = hasSeparateWidths
      ? Math.max(0, storedWidthA || 0)
      : (legacySingleSide ? (equip.data.widthSide === -1 ? legacyWidth || 0 : 0) : legacyHalfWidth);
    const widthB = hasSeparateWidths
      ? Math.max(0, storedWidthB || 0)
      : (legacySingleSide ? (equip.data.widthSide === 1 ? legacyWidth || 0 : 0) : legacyHalfWidth);
    if (!Number.isFinite(latA) || !Number.isFinite(lngA) ||
      !Number.isFinite(latB) || !Number.isFinite(lngB)) return null;
    return {
      ptA: { lat: latA, lng: lngA },
      ptB: { lat: latB, lng: lngB },
      widthA,
      widthB,
      width: widthA + widthB,
    };
  };

  const drawLineStar = (ls, equip) => {
    const visual = getLineStarVisuals(equip);
    const ptA = ls.ptA;
    const ptB = ls.ptB;
    const widthA = ls.widthA;
    const widthB = ls.widthB;
    const width = ls.width;
    const seed = getPivotTooltipSeed(equip.id || "");
    const randomRatio = (seed % 10) < 7 ? ((seed * 11) % 75 + 10) / 100 : 0.5;
    const midPoint = interpolatePoint(ptA, ptB, randomRatio);
    const progressRatio = clampPercent(visual.lineProgress) / 100;
    // Soma o progresso à posição inicial randômica para evitar saltos
    const currentRatio = (randomRatio + progressRatio) % 1;
    const progressPoint = progressRatio > 0 ? interpolatePoint(ptA, ptB, currentRatio) : null;

    if (isConnectivityMode()) {
       // Loop do corredor (ghost)
       if (widthA > 0 || widthB > 0) {
         const br = bearingRad(ptA, ptB);
         const op = (origin, m, s) => destinationPoint(origin, m, br + (s * Math.PI / 2));
         [
           { meters: widthA, side: -1 },
           { meters: widthB, side: 1 },
         ].forEach(({ meters, side }) => {
           if (!(meters > 0)) return;
           const aEdge = op(ptA, meters, side), bEdge = op(ptB, meters, side);
           L.polygon([[ptA.lat, ptA.lng], [ptB.lat, ptB.lng], [bEdge.lat, bEdge.lng], [aEdge.lat, aEdge.lng]], {
             ...CONNECTIVITY_COLORS.pivotGhost,
             fillOpacity: 0,
             interactive: false
           }).addTo(linestarLayer);
         });
       }

       if (midPoint) registerConnectivityMarker(midPoint, equip, linestarLayer, equip.name || "LineStar");
       return;
    }

    const isFinished = visual.statusKey === "irrigacao_finalizada";
    const outerStrokeColor = isFinished ? (visual.progressFill || visual.stroke) : visual.outline;
    const outerStrokeWeight = isFinished ? 6.2 : 2.5;
    const innerStrokeWeight = isFinished ? 6.4 : 2;
    const outerStrokeOpacity = isFinished ? 0.96 : 0.85;

    // Helper: bearing from A→B in radians
    const brng = bearingRad(ptA, ptB);

    // Helper: offset a point perpendicular to the bearing by `meters`
    const offsetPerp = (origin, meters, side) => {
      const perpRad = brng + (side * Math.PI / 2);
      return destinationPoint(origin, meters, perpRad);
    };
    const offsetAlong = (origin, meters, direction) => {
      const dirRad = direction >= 0 ? brng : brng + Math.PI;
      return destinationPoint(origin, meters, dirRad);
    };

    // Draw corridor polygon if we have a width
    [
      { meters: widthA, side: -1 },
      { meters: widthB, side: 1 },
    ].forEach(({ meters, side }) => {
      if (!(meters > 0)) return;
      const aEdge = offsetPerp(ptA, meters, side);
      const bEdge = offsetPerp(ptB, meters, side);
      const points = [[ptA.lat, ptA.lng], [ptB.lat, ptB.lng], [bEdge.lat, bEdge.lng], [aEdge.lat, aEdge.lng]];
      L.polygon(points, {
        color: outerStrokeColor, weight: outerStrokeWeight, opacity: outerStrokeOpacity, fillOpacity: 0, interactive: false
      }).addTo(linestarLayer);
      L.polygon(points, {
        color: isFinished ? outerStrokeColor : visual.stroke, weight: innerStrokeWeight, opacity: isFinished ? 0.9 : 0.75,
        fillColor: visual.fill, fillOpacity: visual.fillOpacity
      }).addTo(linestarLayer);

      if (progressPoint && midPoint) {
        const pEdge = offsetPerp(progressPoint, meters, side);
        const sEdge = offsetPerp(midPoint, meters, side);
        L.polygon(
          [[midPoint.lat, midPoint.lng], [progressPoint.lat, progressPoint.lng], [pEdge.lat, pEdge.lng], [sEdge.lat, sEdge.lng]],
          {
            color: visual.stroke,
            weight: 0,
            fillColor: visual.progressFill,
            fillOpacity: Math.min(0.5, visual.fillOpacity + 0.14),
            interactive: false,
          }
        ).addTo(linestarLayer);
      }
    });

    // 1. Trilha invisivel, mantida so para clique e tooltip
    const axisLayer = L.polyline(
      [[ptA.lat, ptA.lng], [ptB.lat, ptB.lng]],
      {
        color: "transparent",
        weight: 18,
        opacity: 0,
        interactive: true
      }
    ).addTo(linestarLayer);

    // Linha invisível mais grossa para facilitar o clique

    // 2. Barra do Pivô (A linha que cruza a trilha)
    // Se estiver em simulação/progresso, desenha na posição atual. Caso contrário, no meio.
    const anchorPoint = progressPoint || midPoint;

    if (width > 0 && anchorPoint) {
      const crossLeft = offsetPerp(anchorPoint, widthA, -1);
      const crossRight = offsetPerp(anchorPoint, widthB, 1);

      // Sombra/Outline da barra
      L.polyline(
        [[crossLeft.lat, crossLeft.lng], [crossRight.lat, crossRight.lng]],
        { color: "#000000", weight: 4.2, opacity: 0.35, interactive: false }
      ).addTo(linestarLayer);

      // Barra Branca Sólida (Equipamento)
      L.polyline(
        [[crossLeft.lat, crossLeft.lng], [crossRight.lat, crossRight.lng]],
        { color: "#ffffff", weight: 2.5, opacity: 1, interactive: false }
      ).addTo(linestarLayer);
    }



    // Triângulo de direção no linestar — sobre a barra branca, aponta para onde o pivô vai
    if (STATUS_PROGRESS_KEYS.has(visual.statusKey) && !isFinished && width > 0 && progressRatio < 0.96) {
      const anchor    = progressPoint || midPoint;
      const triHeight   = width * 0.22;
      const triHalfBase = width * 0.12;
      const tip         = destinationPoint(anchor, triHeight,    brng);
      const base1       = destinationPoint(anchor, triHalfBase,  brng - Math.PI / 2);
      const base2       = destinationPoint(anchor, triHalfBase,  brng + Math.PI / 2);
      const toLL        = p => [p.lat, p.lng];
      L.polygon([toLL(base1), toLL(base2), toLL(tip)], {
        color: "#000000", weight: 1.2, opacity: 0.25,
        fillColor: "#ffffff", fillOpacity: 0.95,
        interactive: false
      }).addTo(linestarLayer);
    }

    // Marcadores de início (verde) e fim (vermelho) - LineStar (Apenas em simulação/movimento)
    if (midPoint && width > 0 && progressRatio > 0) {
      const sL = offsetPerp(midPoint, widthA, -1), sR = offsetPerp(midPoint, widthB, 1);
      L.polyline([[sL.lat, sL.lng], [sR.lat, sR.lng]], {
        color: "#26DB23", weight: 1.5, dashArray: "4, 4", opacity: 0.8, interactive: false
      }).addTo(linestarLayer);

      const eL = offsetPerp(ptB, widthA, -1), eR = offsetPerp(ptB, widthB, 1);
      L.polyline([[eL.lat, eL.lng], [eR.lat, eR.lng]], {
        color: "#E92400", weight: 1.5, dashArray: "4, 4", opacity: 0.8, interactive: false
      }).addTo(linestarLayer);
    }

    // Marcador do lado dos acoplamentos (hoseSide)
    if (width > 0) {
      const hoseSide = equip.data?.hoseSide || "A";
      drawLineStarZeroAngleMarkers(linestarLayer, ls, { color: "#ffffff", opacity: 0.96, hoseSide });
    }

    // Tooltip
    const tooltipHtml = buildLineStarDetailsTooltipHtml(equip, visual);
    axisLayer.bindTooltip(tooltipHtml, {
      permanent: false,
      direction: "top",
      className: "pivot-tooltip-wrap pivot-tooltip-wrap--pivot-card",
      opacity: 1,
      offset: [0, -10]
    });

    axisLayer.on("click", (event) => {
      if (window.IcEquipmentDeleteShortcut?.handleMapClick?.(equip, event)) return;
      const action = localStorage.getItem('ic:pivot-click-action') || 'details';

      if (action === 'schedule') {
        if (window.OpModal && typeof window.OpModal.open === "function") {
          const position = window.IcPivotSimulationRuntime?.states?.[equip.id]?.progress ?? 0;
          window.OpModal.open({
            title: equip.name || "Pivô Linear",
            pivotId: equip.id,
            isLinear: true,
            position: position,
            isPeakHour: true
          });
        }
      } else {
        if (window.IcLineStar && typeof window.IcLineStar.open === "function") {
          window.IcLineStar.open({ linestarId: equip.id, fromMap: true });
        }
      }
    });
  };


  const buildRainstarLanePolygon = (from, to, widthMeters) => {
    if (!from || !to) return null;
    const len = distanceMeters(from, to);
    if (!Number.isFinite(len) || len <= 0.5) return null;
    const bearing = bearingRad(from, to);
    const half = Math.max(6, (Number(widthMeters) || 72) / 2);
    const aLeft = destinationPoint(from, half, bearing - Math.PI / 2);
    const aRight = destinationPoint(from, half, bearing + Math.PI / 2);
    const bRight = destinationPoint(to, half, bearing + Math.PI / 2);
    const bLeft = destinationPoint(to, half, bearing - Math.PI / 2);
    return [[aLeft.lat, aLeft.lng], [bLeft.lat, bLeft.lng], [bRight.lat, bRight.lng], [aRight.lat, aRight.lng]];
  };

  const formatRainstarDecimal = (value, digits = 1) => {
    const n = toNumber(value);
    if (!Number.isFinite(n)) return "--";
    return n.toFixed(digits).replace(/\.0$/, "");
  };

  const buildRainstarTooltipHtml = (rainstar, equip) => {
    const data = equip?.data || {};
    const visual = resolveRainstarStatus(equip);
    const name = escapeTooltipHtml(equip?.name || data.name || "Carretel");
    const speed = toNumber(data.currentSpeed);
    const statusMeta = speed == null
      ? ""
      : ` <span class="pivot-tooltip__status-meta"><i class="fa-solid fa-droplet"></i> ${formatRainstarDecimal(speed, 1)}m/h${data.timeRemaining ? ` <i class="fa-regular fa-clock"></i> ${escapeTooltipHtml(data.timeRemaining)}` : ""}</span>`;
    const pulled = `${formatRainstarDecimal(data.pulledPipeLength ?? data.hosePulledLength, 1)}m`.replace(".0m", "m");
    const pressure = toNumber(data.currentPressure ?? data.pressureValue);
    const pressureLabel = pressure == null ? "--" : `${pressure.toFixed(2)}bar`;
    const signalLabel = data.signal || (data.connected === false ? "Sem sinal" : "Bom");
    const battery = toNumber(data.battery);
    const batteryLabel = battery == null ? "--" : `${battery.toFixed(0)}%`;
    const lastCommunication = data.lastCommunication ? formatPivotTooltipDate(data.lastCommunication) : resolvePivotTooltipLastCommunication(data, getPivotTooltipSeed(equip?.id || equip?.name || "rainstar"));
    const signalIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M5.5 13.5a9 9 0 0 1 13 0"/><path d="M2.5 10.5a13 13 0 0 1 19 0"/><path d="M12 20h.01"/></svg>';
    const routeIcon = '<svg viewBox="0 0 512 512" height="18" width="18"><path fill="rgba(0,0,0,0.88)" d="M268.537,116.46c-25.779,0-46.751,20.973-46.751,46.751s20.972,46.751,46.751,46.751 c25.785,0,46.763-20.973,46.763-46.751S294.322,116.46,268.537,116.46z M268.537,185.783c-12.445,0-22.572-10.125-22.572-22.572 c0-12.446,10.125-22.571,22.572-22.571c12.452,0,22.584,10.125,22.584,22.571C291.121,175.658,280.989,185.783,268.537,185.783z"/><path fill="rgba(0,0,0,0.88)" d="M365.967,126.571c-1.379-3.663-2.98-7.279-4.76-10.749c-3.045-5.942-10.334-8.286-16.274-5.242 c-5.941,3.047-8.287,10.332-5.242,16.274c1.361,2.656,2.588,5.427,3.645,8.236c1.824,4.847,6.427,7.834,11.317,7.834 c1.415,0,2.853-0.25,4.257-0.779C365.159,139.794,368.318,132.82,365.967,126.571z"/><path fill="rgba(0,0,0,0.88)" d="M268.537,0c-89.995,0-163.211,73.217-163.211,163.211v169.256H92.329c-6.677,0-12.09,5.414-12.09,12.09v41.71 c0,6.676,5.413,12.09,12.09,12.09h14.214l10.94,102.833c0.654,6.148,5.841,10.811,12.022,10.811h34.976 c6.182,0,11.368-4.663,12.022-10.811l10.94-102.833h14.203c6.677,0,12.09-5.414,12.09-12.09v-41.71 c0-6.676-5.413-12.09-12.09-12.09h-12.984v-26.874c24.258,13.684,51.479,20.829,79.876,20.829 c90.001,0,163.223-73.217,163.223-163.211S358.538,0,268.537,0z"/></svg>';
    const gaugeIcon = '<img src="./assets/img/svg/gauge.svg" alt="Pressão Atual" style="filter: invert(33%) sepia(14%) saturate(620%) hue-rotate(175deg) brightness(80%) contrast(90%); height: 18px; width: 18px;">';
    const batteryIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.88)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(-90deg);"><rect x="2" y="7" width="16" height="10" rx="2" ry="2"/><line x1="22" y1="11" x2="22" y2="13"/></svg>';
    const preIcon = '<span></span>';
    const postIcon = '<span></span>';

    return `
      <div class="pivot-tooltip rainstar-tooltip">
        <div class="pivot-tooltip__topline">
          <span class="pivot-tooltip__name">${name}</span>
          <span class="pivot-tooltip__status ${visual.statusClass}">${escapeTooltipHtml(visual.label)}${statusMeta}</span>
        </div>
        <div class="pivot-tooltip__details-grid">
          ${buildTooltipDetailHtml("", pulled, { iconMarkup: routeIcon })}
          ${buildTooltipDetailHtml("", pressureLabel, { iconMarkup: gaugeIcon })}
          ${buildTooltipDetailHtml("", escapeTooltipHtml(signalLabel), { iconMarkup: signalIcon })}
          ${buildTooltipDetailHtml("", batteryLabel, { iconMarkup: batteryIcon })}
          ${buildTooltipDetailHtml("", `Pré - ${data.preIrrigation?.enabled ? "Habilitado" : "Desabilitado"}`, { iconMarkup: preIcon })}
          ${buildTooltipDetailHtml("", `Pós - ${data.postIrrigation?.enabled ? "Habilitado" : "Desabilitado"}`, { iconMarkup: postIcon })}
        </div>
        <span class="pivot-tooltip__date"><span class="comm-label">Última comunicação:</span> ${escapeTooltipHtml(lastCommunication)}</span>
      </div>`;
  };

  // Ícone do carretel (mangueira enrolada) — o mesmo no mapa principal, no
  // minimapa da tela de detalhes e no modal de Posição Inicial da Irrigação.
  const buildRainstarReelIcon = () => L.divIcon({
    className: "map-carretel-reel",
    html: `
      <svg viewBox="0 0 72 54" aria-hidden="true" focusable="false">
        <path d="M10 42 H36" />
        <path d="M10 50 H42" />
        <path d="M10 39 V53" />
        <path d="M24 39 V53" />
        <circle cx="46" cy="28" r="22" />
        <circle cx="46" cy="28" r="16" />
        <circle cx="46" cy="28" r="10" />
        <circle cx="46" cy="28" r="4" />
      </svg>`,
    iconSize: [44, 34],
    iconAnchor: [22, 17],
  });
  window.IcRainstarReelIcon = buildRainstarReelIcon;

  // Carretel e seta têm tamanho fixo no terreno: crescem e encolhem com o
  // zoom, mantendo a mesma proporção com a faixa. No zoom de referência
  // ficam no tamanho base do ícone (em px) vezes RAINSTAR_ICON_SIZE_FACTOR.
  const RAINSTAR_ICON_REF_ZOOM = 16;
  const RAINSTAR_ICON_SIZE_FACTOR = 3;
  const rainstarIconScaledMaps = new WeakSet();
  const bindRainstarIconScale = (targetMap) => {
    if (!targetMap || rainstarIconScaledMaps.has(targetMap)) return;
    rainstarIconScaledMaps.add(targetMap);
    const container = targetMap.getContainer();
    const apply = (zoom) => {
      if (!Number.isFinite(zoom)) return;
      container.style.setProperty("--carretel-icon-scale", String(RAINSTAR_ICON_SIZE_FACTOR * Math.pow(2, zoom - RAINSTAR_ICON_REF_ZOOM)));
    };
    targetMap.on("zoomanim", (event) => apply(event.zoom));
    targetMap.on("zoom zoomend", () => apply(targetMap.getZoom()));
    apply(targetMap.getZoom());
  };
  window.IcBindRainstarIconScale = bindRainstarIconScale;
  bindRainstarIconScale(map);

  // Desenho puro da faixa/seta do carretel — usado tanto pelo mapa principal
  // quanto pelo minimapa da tela de detalhes, pra garantir que os dois
  // fiquem visualmente idênticos (mesma faixa, mesmas cores de status,
  // mesma seta de direção, mesmo ícone do carretel).
  const getRainstarLaneParts = (rainstar) => {
    const cartPoint = interpolatePoint(rainstar.start, rainstar.reel, rainstar.progress);
    return {
      irrigated: rainstar.progress > 0.01 ? buildRainstarLanePolygon(rainstar.start, cartPoint, rainstar.width) : null,
      remaining: rainstar.progress < 0.99 ? buildRainstarLanePolygon(cartPoint, rainstar.reel, rainstar.width) : null,
    };
  };

  const drawRainstarLane = (targetLayer, rainstar, visual, laneOpts = {}) => {
    const layers = [];
    // keepEmpty: cria as faixas mesmo vazias, pra animação só trocar a geometria
    const keepEmpty = laneOpts.keepEmpty === true;
    const refs = {};
    layers.refs = refs;
    if (rainstar.hasLane) {
      const parts = getRainstarLaneParts(rainstar);
      const irrigatedPolygon = parts.irrigated || (keepEmpty ? [] : null);
      const remainingPolygon = parts.remaining || (keepEmpty ? [] : null);
      const wholePolygon = buildRainstarLanePolygon(rainstar.start, rainstar.reel, rainstar.width);
      if (wholePolygon) {
        layers.push(L.polygon(wholePolygon, {
          color: visual.stroke,
          weight: 2.5,
          fillOpacity: 0,
          interactive: false,
        }).addTo(targetLayer));
      }
      if (remainingPolygon) {
        layers.push(refs.remaining = L.polygon(remainingPolygon, {
          color: visual.stroke,
          weight: 1.1,
          fillColor: visual.remainingFill,
          fillOpacity: 0.86,
        }).addTo(targetLayer));
      }
      if (irrigatedPolygon) {
        layers.push(refs.irrigated = L.polygon(irrigatedPolygon, {
          color: visual.stroke,
          weight: 1.1,
          fillColor: visual.fill,
          fillOpacity: 0.74,
        }).addTo(targetLayer));
      }
      layers.push(L.polyline([[rainstar.start.lat, rainstar.start.lng], [rainstar.reel.lat, rainstar.reel.lng]], {
        color: "rgba(255,255,255,0.72)",
        weight: 1,
        interactive: false,
      }).addTo(targetLayer));
    }

    // Ícone do carretel na posição do carretel. Sem posição inicial definida
    // (carretel recém-criado) ele é o único desenho: sem faixa e sem seta.
    layers.push(L.marker([rainstar.reel.lat, rainstar.reel.lng], {
      icon: buildRainstarReelIcon(),
    }).addTo(targetLayer));

    if (rainstar.hasLane) {
      // Cor do carro aspersor/seta: usa markerFill quando o status precisa destacar
      // o ponto de parada (ex.: alerta) com uma cor diferente da faixa já
      // irrigada atrás dele.
      const markerColor = visual.markerFill || visual.fill;
      // Seta aponta no sentido do movimento do carro aspersor: do início em direção ao carretel.
      const angleDeg = (bearingRad(rainstar.start, rainstar.reel) * 180) / Math.PI;
      const icon = L.divIcon({
        className: "map-carretel-arrow-marker",
        html: `
          <div class="map-carretel-arrow" style="--carretel-angle:${angleDeg}deg;">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2 L20 19 L12 15 L4 19 Z" fill="${markerColor}" stroke="#111827" stroke-width="1.5" stroke-linejoin="round"/>
            </svg>
          </div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      // Seta sempre por cima do ícone do carretel quando o carro chega perto dele.
      layers.push(refs.arrow = L.marker([rainstar.center.lat, rainstar.center.lng], { icon, zIndexOffset: 1000 }).addTo(targetLayer));
    }
    return layers;
  };
  window.IcDrawRainstarLane = drawRainstarLane;

  const drawRainstar = (rainstar, equip) => {
    const isConn = isConnectivityMode();
    const visual = resolveRainstarStatus(equip);
    if (isConn) {
      registerConnectivityMarker(rainstar.center, equip, carretelLayer, equip.name || "Carretel");
      if (rainstar.hasLane) {
        L.polyline([[rainstar.start.lat, rainstar.start.lng], [rainstar.reel.lat, rainstar.reel.lng]], {
          color: "rgba(17,17,17,0.28)",
          weight: 2,
          dashArray: "6 5",
          interactive: false,
        }).addTo(carretelLayer);
      }
      return;
    }

    const tooltipHtml = buildRainstarTooltipHtml(rainstar, equip);
    const layers = drawRainstarLane(carretelLayer, rainstar, visual, { keepEmpty: true });
    if (equip?.id && rainstar.hasLane) {
      _rainstarMotionRegistry.set(String(equip.id), {
        equip, layers, refs: layers.refs || {},
        sig: [visual.fill, visual.remainingFill, visual.stroke, visual.markerFill].join("|"),
      });
    }

    layers.forEach((layer) => {
      if (!layer.bindTooltip) return;
    layer.bindTooltip(tooltipHtml, {
      permanent: false,
      direction: "top",
      className: "pivot-tooltip-wrap",
      opacity: 1,
      offset: [-15, -10]
    });
      layer.on?.("click", (event) => {
        if (window.IcEquipmentDeleteShortcut?.handleMapClick?.(equip, event)) return;
        const action = localStorage.getItem("ic:pivot-click-action") || "details";
        if (action === "schedule" && window.IcCarretel?.openStartModal) {
          window.IcCarretel.openStartModal(equip);
        } else {
          window.IcCarretel?.open?.({ carretelId: equip.id, fromMap: true });
        }
      });
    });
  };


  const drawPivot = (pivot, equip) => {
    let layer;
    const isConn = isConnectivityMode();
    const targetLayer = pivotLayer;

    if (isConn) {
       registerConnectivityMarker(pivot.center, equip, targetLayer, equip.name || "Pivô");
       
       // Ghost geometry below - define styles here for reuse
       const ghostStyle = { 
         ...CONNECTIVITY_COLORS.pivotGhost, 
         fillOpacity: 0, 
         interactive: false 
       };

       if (pivot.isSector && pivot.startAngle !== undefined && pivot.endAngle !== undefined && pivot.ref) {
         const br = (bearingRad(pivot.center, pivot.ref) * 180 / Math.PI);
         const pts = buildSectorRing(pivot.center, pivot.radius, 0, br, pivot.startAngle, pivot.endAngle).slice(0, -1); // slice to get just the outer-line-ish polygon
         L.polygon(pts, ghostStyle).addTo(targetLayer);
       } else {
         L.circle([pivot.center.lat, pivot.center.lng], { radius: pivot.radius, ...ghostStyle }).addTo(targetLayer);
       }
       return;
    }

    const visualStyle = getPivotVisualStyle();

    const useOuterBand = visualStyle === "outer_band";
    const pivotColors = getPivotVisuals(pivot, equip);
    const innerRadius = pivot.radius * (pivotColors.outerFill ? STATUS_BAND_INNER_RATIO : 0.8);
    const hasStatusBand = Boolean(pivotColors.outerFill) && innerRadius > 0;
    const shapeFillOpacity = hasStatusBand ? (pivotColors.fillOpacity ?? 0.92) : (useOuterBand ? 0 : pivotColors.fillOpacity);
    const bandFillColor = hasStatusBand ? pivotColors.outerFill : pivotColors.fill;
    const bandFillOpacity = hasStatusBand
      ? (pivotColors.outerFillOpacity ?? 0.98)
      : (useOuterBand ? Math.min(pivotColors.fillOpacity, 0.82) : 0);
    const bandProgress = Math.max(0, Math.min(100, Number(pivotColors.bandProgress) || 0));

    if (pivot.isSector && pivot.startAngle !== undefined && pivot.endAngle !== undefined && pivot.ref) {
      const centerLL = L.latLng(pivot.center.lat, pivot.center.lng);
      const startAngle = parseFloat(pivot.startAngle) || 0;
      let endAngle = parseFloat(pivot.endAngle) || 360;
      if (endAngle <= startAngle) endAngle += 360;

      const points = [centerLL];

      const lat1 = pivot.center.lat * Math.PI / 180;
      const lon1 = pivot.center.lng * Math.PI / 180;
      const lat2 = pivot.ref.lat * Math.PI / 180;
      const lon2 = pivot.ref.lng * Math.PI / 180;

      const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
      const bearingRef = Math.atan2(y, x) * 180 / Math.PI;

      const step = 2;
      const R = 6378137;
      const d = pivot.radius / R;

      for (let angle = startAngle; angle <= endAngle; angle += step) {
        const brng = (bearingRef + angle) * Math.PI / 180;
        const pointLat = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
        const pointLng = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(pointLat));
        points.push(L.latLng(pointLat * 180 / Math.PI, pointLng * 180 / Math.PI));
      }

      const brngEnd = (bearingRef + endAngle) * Math.PI / 180;
      const endLat = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brngEnd));
      const endLng = lon1 + Math.atan2(Math.sin(brngEnd) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(endLat));
      points.push(L.latLng(endLat * 180 / Math.PI, endLng * 180 / Math.PI));

      points.push(centerLL);

      L.polygon(points, {
        color: pivotColors.outline,
        weight: 3,
        opacity: 1,
        fillOpacity: 0,
        interactive: false,
      }).addTo(targetLayer);
 
      layer = L.polygon(points, {
        color: pivotColors.stroke,
        weight: 3,
        fillColor: pivotColors.fill,
        fillOpacity: shapeFillOpacity,
      }).addTo(targetLayer);
 
    } else {
      L.circle([pivot.center.lat, pivot.center.lng], {
        radius: pivot.radius,
        color: pivotColors.outline,
        weight: 3,
        opacity: 1,
        fillOpacity: 0,
        interactive: false,
      }).addTo(targetLayer);
      layer = L.circle([pivot.center.lat, pivot.center.lng], {
        radius: pivot.radius,
        color: pivotColors.stroke,
        weight: 3,
        fillColor: pivotColors.fill,
        fillOpacity: shapeFillOpacity,
      }).addTo(targetLayer);
 
    }

    // Tooltip customizado ("Balão")
    const tooltipHtml = buildPivotDetailsTooltipHtml(pivot, equip, pivotColors);

    /* tooltip legado removido
      <div class="pivot-tooltip">
        <span class="pivot-tooltip__name">${equip.name || "Pivô"}</span>
        <span class="pivot-tooltip__status ${pivotColors.statusClass}">${pivotColors.statusText}</span>
        <span class="pivot-tooltip__date">${progressLabel}</span>
      </div>
    */

    layer.bindTooltip(tooltipHtml, {
      permanent: false,
      direction: "top",
      className: "pivot-tooltip-wrap pivot-tooltip-wrap--pivot-card",
      opacity: 1,
      offset: [0, -10]
    });

    layer.on("click", (event) => {
      if (window.IcEquipmentDeleteShortcut?.handleMapClick?.(equip, event)) return;
      const action = localStorage.getItem('ic:pivot-click-action') || 'details';

      if (action === 'schedule') {
        if (window.OpModal && typeof window.OpModal.open === "function") {
          window.OpModal.open({
            title: equip.name || "Pivô",
            pivotId: equip.id
          });
        }
      } else {
        if (window.IcPivos && typeof window.IcPivos.open === "function") {
          window.IcPivos.open({ pivotId: equip.id, fromMap: true });
        }
      }
    });

    // Partes móveis (faixa de progresso + braço/linhas) num grupo próprio,
    // atualizado no lugar pela animação (ver updateMotionLayersOnly).
    const motionGroup = L.layerGroup().addTo(targetLayer);
    drawPivotDynamicParts(pivot, pivotColors, motionGroup);
    if (equip?.id) {
      _pivotMotionRegistry.set(String(equip.id), {
        pivot, equip, group: motionGroup, layer,
        sig: getPivotMotionSignature(pivotColors),
      });
    }
    return;

    const baseAng = bearingRad(pivot.center, pivot.ref) + ((pivotColors.fixedArmAngleOffset || 0) * Math.PI / 180);
    const lineAng = bearingRad(pivot.center, pivot.ref) + ((pivotColors.armAngleOffset || 0) * Math.PI / 180);

    // Triângulo de direção — aponta na direção da rotação, sobre o braço
    if (STATUS_PROGRESS_KEYS.has(pivotColors.statusKey)) { // DEMO: seta sempre visível (antes sumia perto de 0°/360°)
      const tangentFwd  = lineAng + Math.PI / 2;
      const triHeight   = pivot.radius * 0.18;
      const triHalfBase = pivot.radius * 0.09;
      const anchor      = destinationPoint(pivot.center, pivot.radius * 0.91, lineAng);
      const tip         = destinationPoint(anchor, triHeight,    tangentFwd);
      const base1       = destinationPoint(anchor, triHalfBase,  lineAng);
      const base2       = destinationPoint(anchor, triHalfBase,  lineAng + Math.PI);
      const toLL        = p => [p.lat, p.lng];
      L.polygon([toLL(base1), toLL(base2), toLL(tip)], {
        color: "#ffffff", weight: 1, opacity: 0.95,
        fillColor: "#ffffff", fillOpacity: 0.95,
        interactive: false
      }).addTo(targetLayer);
    }
    const lineEnd = destinationPoint(pivot.center, pivot.radius, lineAng);
    L.polyline(
      [
        [pivot.center.lat, pivot.center.lng],
        [lineEnd.lat, lineEnd.lng],
      ],
      { color: pivotColors.ref, weight: 2, opacity: 0.95 }
    ).addTo(targetLayer);

    const wedgeAngle = (5 * Math.PI) / 180;
    const left = destinationPoint(pivot.center, pivot.radius, baseAng - wedgeAngle);
    const right = destinationPoint(pivot.center, pivot.radius, baseAng + wedgeAngle);
    const inner = destinationPoint(pivot.center, pivot.radius * 0.82, baseAng);
    L.polygon(
      [
        [left.lat, left.lng],
        [right.lat, right.lng],
        [inner.lat, inner.lng],
      ],
      { color: pivotColors.ref, weight: 1, fillColor: pivotColors.refFill, fillOpacity: 0.95 }
    ).addTo(targetLayer);
  };

  const getPivotMotionSignature = (c) => [
    c.statusKey, c.fill, c.stroke, c.outline, c.fillOpacity, c.outerFill,
    Math.round((c.armAngleOffset || 0) * 10), Math.round((c.bandProgress || 0) * 10),
    Math.round((c.bandStartAngle || 0) * 10), Math.round((c.bandEndAngle || 0) * 10),
    Math.round(c.lineProgress || 0), c.opStartAngleDeg, c.opStopAngleDeg, c.armDirSign,
  ].join("|");

  // Faixa de status/progresso + braço, setas e linhas de partida/parada.
  // Tudo não-interativo: pode ser redesenhado a cada quadro sem roubar o
  // hover/clique/balão do círculo do pivô.
  const drawPivotDynamicParts = (pivot, pivotColors, group) => {
    const opts = { interactive: false, pane: "icPivotMotion" };
    const useOuterBand = getPivotVisualStyle() === "outer_band";
    const innerRadius = pivot.radius * (pivotColors.outerFill ? STATUS_BAND_INNER_RATIO : 0.8);
    const hasStatusBand = Boolean(pivotColors.outerFill) && innerRadius > 0;
    const bandFillColor = hasStatusBand ? pivotColors.outerFill : pivotColors.fill;
    const bandFillOpacity = hasStatusBand
      ? (pivotColors.outerFillOpacity ?? 0.98)
      : (useOuterBand ? Math.min(pivotColors.fillOpacity, 0.82) : 0);
    const bandProgress = Math.max(0, Math.min(100, Number(pivotColors.bandProgress) || 0));
    // Onde a faixa de progresso já pintou, ela cobre também a borda clara do pivô
    // (traço da mesma cor e da mesma grossura da borda), igual à plataforma oficial.
    const bandStyle = hasStatusBand
      ? { ...opts, color: bandFillColor, weight: 3, opacity: bandFillOpacity, lineJoin: "miter", fillColor: bandFillColor, fillOpacity: bandFillOpacity }
      : { ...opts, color: pivotColors.stroke, weight: 0, fillColor: bandFillColor, fillOpacity: bandFillOpacity };
    const isSector = pivot.isSector && pivot.startAngle !== undefined && pivot.endAngle !== undefined && pivot.ref;

    if (isSector) {
      const bearingRef = getPivotBearingRefDeg(pivot);
      const startAngle = parseFloat(pivot.startAngle) || 0;
      let endAngle = parseFloat(pivot.endAngle) || 360;
      if (endAngle <= startAngle) endAngle += 360;
      if (hasStatusBand && bandProgress > 0) {
        L.polygon(buildSectorRing(pivot.center, pivot.radius, innerRadius, bearingRef, pivotColors.bandStartAngle, pivotColors.bandEndAngle), bandStyle).addTo(group);
      } else if (useOuterBand && innerRadius > 0) {
        L.polygon(buildSectorRing(pivot.center, pivot.radius, innerRadius, bearingRef, startAngle, endAngle), bandStyle).addTo(group);
      }
    } else if (hasStatusBand && bandProgress > 0 && pivot.ref) {
      L.polygon(buildSectorRing(pivot.center, pivot.radius, innerRadius, getPivotBearingRefDeg(pivot), pivotColors.bandStartAngle, pivotColors.bandEndAngle), bandStyle).addTo(group);
    } else if (useOuterBand && innerRadius > 0) {
      L.polygon(buildFullRing(pivot.center, pivot.radius, innerRadius), bandStyle).addTo(group);
    }

    drawPivotReferenceOverlay(pivot, pivotColors, group, opts);
  };

  const drawPivotReferenceOverlay = (pivot, pivotColors, targetLayer, extraOpts = {}) => {
    if (!pivot?.ref || !pivot?.center) return;
    const _L = L;
    const L2 = {
      polygon: (pts, o) => _L.polygon(pts, { ...o, ...extraOpts }),
      polyline: (pts, o) => _L.polyline(pts, { ...o, ...extraOpts }),
    };

    const baseAng = bearingRad(pivot.center, pivot.ref) + ((pivotColors.fixedArmAngleOffset || 0) * Math.PI / 180);
    const lineAng = bearingRad(pivot.center, pivot.ref) + ((pivotColors.armAngleOffset || 0) * Math.PI / 180);

    // Triangulo de direcao sobre o braco do pivo (aponta no sentido do giro: reverso = anti-horario).
    if (STATUS_PROGRESS_KEYS.has(pivotColors.statusKey)) { // DEMO: seta sempre visível (antes sumia perto de 0°/360°)
      const dirSign = pivotColors.armDirSign < 0 ? -1 : 1;
      const tangentFwd = lineAng + dirSign * (Math.PI / 2);
      const triHeight = pivot.radius * 0.18;
      const triHalfBase = pivot.radius * 0.09;
      const anchor = destinationPoint(pivot.center, pivot.radius * 0.91, lineAng);
      const tip = destinationPoint(anchor, triHeight, tangentFwd);
      const base1 = destinationPoint(anchor, triHalfBase, lineAng);
      const base2 = destinationPoint(anchor, triHalfBase, lineAng + Math.PI);
      const toLL = (point) => [point.lat, point.lng];
      L2.polygon([toLL(base1), toLL(base2), toLL(tip)], {
        color: "#ffffff",
        weight: 1,
        opacity: 0.95,
        fillColor: "#ffffff",
        fillOpacity: 0.95,
        interactive: false
      }).addTo(targetLayer);
    }

    const lineEnd = destinationPoint(pivot.center, pivot.radius, lineAng);
    // Braço igual à plataforma oficial: branco sólido, sem sombra preta.
    L2.polyline(
      [
        [pivot.center.lat, pivot.center.lng],
        [lineEnd.lat, lineEnd.lng],
      ],
      { color: pivotColors.ref, weight: 3, opacity: 1 }
    ).addTo(targetLayer);

    const wedgeAngle = (5 * Math.PI) / 180;
    const left = destinationPoint(pivot.center, pivot.radius, baseAng - wedgeAngle);
    const right = destinationPoint(pivot.center, pivot.radius, baseAng + wedgeAngle);
    const inner = destinationPoint(pivot.center, pivot.radius * 0.82, baseAng);
    L2.polygon(
      [
        [left.lat, left.lng],
        [right.lat, right.lng],
        [inner.lat, inner.lng],
      ],
      { color: pivotColors.ref, weight: 1, fillColor: pivotColors.refFill, fillOpacity: 0.95 }
    ).addTo(targetLayer);

    // Linhas de partida (verde) e parada (vermelho).
    const hasOpAngles = Number.isFinite(pivotColors.opStartAngleDeg);
    if (hasOpAngles) {
      // Operação ativa: verde no ângulo de partida, vermelho no ângulo de parada.
      const refRad = bearingRad(pivot.center, pivot.ref);
      const startAng = refRad + (pivotColors.opStartAngleDeg * Math.PI / 180);
      const startEnd = destinationPoint(pivot.center, pivot.radius, startAng);
      L2.polyline([[pivot.center.lat, pivot.center.lng], [startEnd.lat, startEnd.lng]], {
        color: "#26DB23", weight: 1.5, dashArray: "4, 4", opacity: 0.9, interactive: false
      }).addTo(targetLayer);

      if (Number.isFinite(pivotColors.opStopAngleDeg)) {
        const endAng = refRad + (pivotColors.opStopAngleDeg * Math.PI / 180);
        const endPos = destinationPoint(pivot.center, pivot.radius, endAng);
        L2.polyline([[pivot.center.lat, pivot.center.lng], [endPos.lat, endPos.lng]], {
          color: "#E92400", weight: 1.5, dashArray: "4, 4", opacity: 0.9, interactive: false
        }).addTo(targetLayer);
      }
    } else if (pivotColors.lineProgress > 0) {
      // Fallback (simulação genérica): início/fim do setor.
      const startAng = bearingRad(pivot.center, pivot.ref) + (pivotColors.bandStartAngle * Math.PI / 180);
      const startEnd = destinationPoint(pivot.center, pivot.radius, startAng);
      L2.polyline([[pivot.center.lat, pivot.center.lng], [startEnd.lat, startEnd.lng]], {
        color: "#26DB23", weight: 1.5, dashArray: "4, 4", opacity: 0.8, interactive: false
      }).addTo(targetLayer);

      const span = pivot.isSector ? normalizeAngleSpan(pivot.startAngle, pivot.endAngle) : 360;
      const endAng = startAng + (span * Math.PI / 180);
      const endPos = destinationPoint(pivot.center, pivot.radius, endAng);
      L2.polyline([[pivot.center.lat, pivot.center.lng], [endPos.lat, endPos.lng]], {
        color: "#E92400", weight: 1.5, dashArray: "4, 4", opacity: 0.8, interactive: false
      }).addTo(targetLayer);
    }
  };

  const drawMdn = (mdn, equip) => {
    if (isConnectivityMode()) {
       registerConnectivityMarker(mdn.center, equip, mdnLayer, equip.name || "MDN");
       return;
    }

    const status = resolveMdnStatus(equip);
    const val = mdn.hasReading ? mdn.percent : (mdn.offline ? 0 : 72.45);
    const label = mdn.offline ? "—" : `${Number(val).toFixed(2)}%`;
    const visual = getMdnMarkerVisual();
    const icon = L.divIcon({
      className: "",
      html: `
        <div class="map-mdn-marker is-${status.key} ${val === 0 || mdn.offline ? 'is-empty' : ''}" style="--level:${Math.round(val)}%;--mdn-color:${status.color};--mdn-size:${visual.size}px;--mdn-border:${visual.border}px;--mdn-ring:${visual.ring}px;--mdn-font:${visual.font}px;">
          <div class="mdn-water"></div>
          <span class="map-mdn-marker__value">${label}</span>
        </div>`,
      iconSize: [visual.size, visual.size],
      iconAnchor: [Math.round(visual.size / 2), Math.round(visual.size / 2)],
    });
    const layer = L.marker([mdn.center.lat, mdn.center.lng], { icon }).addTo(mdnLayer);

    const tooltipHtml = `
      <div class="pivot-tooltip pivot-tooltip--pivot-card">
        <div class="pivot-tooltip__topline">
          <span class="pivot-tooltip__name">${escapeTooltipHtml(equip.name || "MDN")}</span>
          <span class="pivot-tooltip__status ${mdn.offline ? "is-danger" : status.key === "low" ? "is-warning" : status.key === "high" ? "is-info" : "is-success"}">
            ${mdn.offline ? "SEM COMUNICAÇÃO" : `${mdn.percent.toFixed(2)}% (${mdn.meters.toFixed(2)}m)`}
          </span>
        </div>
        <div class="pincard__kpis mdnd-kpis" style="margin-top:8px;">
          <div class="pincard__kpi">
            <div class="pincard__kpi-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.116 4.104A1 1 0 0 1 6.11 3h11.78a1 1 0 0 1 .994 1.105L17.19 20.21A2 2 0 0 1 15.2 22H8.8a2 2 0 0 1-2-1.79z"></path><path d="M6 12a5 5 0 0 1 6 0 5 5 0 0 0 6 0"></path></svg>
            </div>
            <div class="pincard__kpi-val">Min.: ${mdn.minPercent !== null ? `${mdn.minPercent}%` : "—"}</div>
          </div>
          <div class="pincard__kpi">
            <div class="pincard__kpi-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.116 4.104A1 1 0 0 1 6.11 3h11.78a1 1 0 0 1 .994 1.105L17.19 20.21A2 2 0 0 1 15.2 22H8.8a2 2 0 0 1-2-1.79z"></path><path d="M6 12a5 5 0 0 1 6 0 5 5 0 0 0 6 0"></path></svg>
            </div>
            <div class="pincard__kpi-val">Max.: ${mdn.maxPercent !== null ? `${mdn.maxPercent}%` : "—"}</div>
          </div>
          <div class="pincard__kpi">
            <div class="pincard__kpi-icon">
              <i class="fa-solid fa-battery-full" style="color:${mdn.offline ? '#ef4444' : '#16a34a'}; transform:rotate(-90deg); display:inline-block;"></i>
            </div>
            <div class="pincard__kpi-val">${mdn.offline ? "-" : "Carregada"}</div>
          </div>
        </div>
        <span class="pivot-tooltip__date"><span>Última comunicação:</span> ${escapeTooltipHtml(mdn.lastCommunication)}</span>
      </div>
    `;

    layer.bindTooltip(tooltipHtml, {
      permanent: false,
      direction: "top",
      className: "pivot-tooltip-wrap pivot-tooltip-wrap--pivot-card",
      opacity: 1,
      offset: [0, -10]
    });

    layer.on("click", (event) => {
      if (window.IcEquipmentDeleteShortcut?.handleMapClick?.(equip, event)) return;
      if (window.IcMdnDetails && typeof window.IcMdnDetails.open === "function") {
        window.IcMdnDetails.open({ mdnId: equip.id, fromMap: true });
      }
    });
  };

  // Profundidade de solo considerada no cálculo da lâmina (cm).
  const COSMOFIELD_ROOT_DEPTH_CM = 40;

  // Traduz para o idioma ativo da plataforma. O tooltip é HTML gerado em
  // JS e injetado pelo Leaflet, fora da varredura do DOM feita pelo i18n.
  const tCf = (text) => window.IcI18n?.t?.(text) ?? text;

  // Data curta (dd mmm) para o Cosmofield. Sem valor real, cai num mock
  // determinístico: hoje + offsetDays.
  const formatCosmofieldDate = (value, offsetDays) => {
    const parsed = value ? new Date(value) : null;
    const date = parsed && !Number.isNaN(parsed.getTime())
      ? parsed
      : new Date(Date.now() + offsetDays * 86400000);
    // Locale ativo da plataforma: os meses acompanham o idioma.
    // pt-BR gera "28 de ago." — o "de" e o ponto final não cabem na célula.
    return date
      .toLocaleDateString(window.IcI18n?.getLocale?.() || "pt-BR", { day: "2-digit", month: "short" })
      .replace(/\sde\s/g, " ")
      .replace(/\.$/, "");
  };

  // Célula do tooltip do Cosmofield: rótulo pequeno em cima, valor forte
  // embaixo. Diferente de buildTooltipDetailHtml (que põe "rótulo: valor"
  // numa linha só), aqui o número não disputa espaço com o texto.
  const cosmofieldTooltipCell = (icon, label, value) => `
        <div class="cf-tip__cell">
          <img class="cf-tip__cell-icon" src="./assets/img/svg/${icon}" alt="">
          <div class="cf-tip__cell-body">
            <span class="cf-tip__cell-label">${escapeTooltipHtml(label)}</span>
            <span class="cf-tip__cell-value">${escapeTooltipHtml(value)}</span>
          </div>
        </div>`;

  // "há 3h", "há 2 dias" — texto curto para o aviso de sem comunicação.
  const formatElapsed = (minutes) => {
    if (minutes === null || !Number.isFinite(minutes)) return "—";
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = minutes / 60;
    if (hours < 48) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)} ${window.IcI18n?.t?.("dias") ?? "dias"}`;
  };

  // Abaixo desta tensão a sonda é dada como bateria baixa.
  const COSMOFIELD_LOW_BATTERY_V = 11.5;

  // Sem transmitir por mais de 2h (4 ciclos de 30 min), a sonda é dada
  // como sem comunicação.
  const COSMOFIELD_OFFLINE_MINUTES = 120;

  // Leitura da sonda e sua posição na faixa de manejo (trigger → CC).
  // Compartilhado entre o marcador e o tooltip, pra que a cor do ícone e a
  // da barra nunca divirjam.
  const cosmofieldReading = (equip, index = 0) => {
    const source = equip?.data || {};
    const seed = getPivotTooltipSeed(equip?.id || "");

    const wiltingPoint = toNumber(source.wiltingPoint);
    const fieldCapacity = toNumber(source.fieldCapacity);
    const triggerPct = toNumber(source.triggerIrrigation);
    const targetPct = toNumber(source.targetIrrigation);
    const hasRange = wiltingPoint !== null && fieldCapacity !== null && fieldCapacity > wiltingPoint;
    const hasTrigger = triggerPct !== null && triggerPct >= 0 && triggerPct <= 100;

    // Mock dentro da faixa de manejo — ver comentário em drawCosmofield.
    const triggerFloor = triggerPct ?? 50;
    const mockBandRatio = [0.82, 0.14, 0.55, 0.33][index % 4];
    const mockAvailablePct = triggerFloor + (100 - triggerFloor) * mockBandRatio;
    const mockMoisture = hasRange
      ? wiltingPoint + (fieldCapacity - wiltingPoint) * (mockAvailablePct / 100)
      : 18 + (seed % 200) / 10;

    const moistureValue = toNumber(source.moisture ?? source.umidade) ?? mockMoisture;
    const availablePct = hasRange
      ? Math.round(Math.max(0, Math.min(100, ((moistureValue - wiltingPoint) / (fieldCapacity - wiltingPoint)) * 100)) * 10) / 10
      : null;

    // Comunicação: a sonda transmite a cada 30 min. Passadas 2h sem
    // reportar, a leitura deixa de valer — o solo pode ter secado desde
    // então. Offline tem precedência sobre o estado de umidade, porque um
    // "adequado" calculado sobre dado velho engana mais que informa.
    const lastSeenRaw = source.lastCommunication ?? source.ultimaComunicacao
      ?? source.lastSeenAt ?? source.updatedAt;
    const lastSeen = lastSeenRaw ? new Date(lastSeenRaw) : null;
    const lastSeenMs = lastSeen && !Number.isNaN(lastSeen.getTime()) ? lastSeen.getTime() : null;

    // Sem telemetria, o atraso é mockado por índice: a maioria transmitindo
    // no ciclo normal e o terceiro Cosmofield mudo há horas, pra que o
    // alerta de comunicação tenha o que mostrar.
    const mockMinutes = [12, 34, 490, 26][index % 4];
    const minutesSince = lastSeenMs === null
      ? mockMinutes
      : (Date.now() - lastSeenMs) / 60000;
    const isOffline = minutesSince !== null && minutesSince > COSMOFIELD_OFFLINE_MINUTES;

    const belowTrigger = hasTrigger && availablePct !== null && availablePct < triggerPct;
    // Bateria: abaixo de 11.5 V a sonda entra em alerta — nessa faixa o
    // painel solar já não sustenta o ciclo de transmissão. O índice 5
    // (Cosmofield 6) é o caso mockado de bateria baixa.
    const mockBattery = index === 5 ? 10.8 : 11.9 + (seed % 10) / 10;
    const batteryValue = toNumber(source.batteryVoltage ?? source.tensaoBateria) ?? mockBattery;
    const lowBattery = Number.isFinite(batteryValue) && batteryValue < COSMOFIELD_LOW_BATTERY_V;

    // Status do selo e do cartão. Alerta: água abaixo do gatilho, sem
    // comunicação ou bateria baixa. Atenção: acima do gatilho e abaixo de
    // 50% da faixa. TESTE: a faixa vai do gatilho até o alvo (a mesma da
    // escala de cores), não até a CC. Adequado: de 50% da faixa em diante.
    let status = "adequate";
    if (isOffline || lowBattery || belowTrigger) status = "alert";
    else if (hasTrigger && availablePct !== null) {
      const bandTop = Math.min(100, Math.max(targetPct ?? 100, triggerPct));
      const band = bandTop > triggerPct
        ? (availablePct - triggerPct) / (bandTop - triggerPct)
        : 1;
      if (band < 0.5) status = "attention";
    }

    // Cor do ícone e da barra: escala RdYlGn pela água disponível. Sem
    // comunicação não há cor (cinza). Bateria baixa não altera a barra.
    const scaleColor = isOffline
      ? null
      : window.IcMapIcons?.cosmofieldScaleColor?.(availablePct, {
        trigger: triggerPct ?? 50,
        // Acima de 100% não bloqueia, mas a faixa é limitada a 100%.
        target: Math.min(100, targetPct ?? 100),
      }) ?? null;

    // Ícone e selos: só três cores, pelo status.
    const statusColor = window.IcMapIcons?.cosmofieldStatusColor?.(status) ?? null;

    return {
      source, seed, moistureValue, availablePct, triggerPct, targetPct, statusColor,
      batteryValue, lowBattery,
      wiltingPoint, fieldCapacity, hasRange, hasTrigger, belowTrigger,
      status, scaleColor,
      isOffline, minutesSince,
    };
  };

  // Exposto para o card de equipamentos (view.render.js) usar a mesma
  // leitura do marcador e do tooltip — cor e números não podem divergir.
  window.IcCosmofieldReading = cosmofieldReading;

  // Status da sonda: selo do tooltip e barra de status da tela de Detalhes.
  // Só vermelho, amarelo e verde. Com problema de equipamento, o próprio
  // problema (sem comunicação vence bateria baixa); senão a água disponível,
  // no mesmo texto do selo do card. label já sai traduzido.
  const cosmofieldStatusOf = (reading) => {
    const t = (text) => window.IcI18n?.t?.(text) ?? text;
    const red = "background:#dc2626;color:#ffffff;";
    if (reading?.isOffline) return { cls: "is-danger", label: t("SEM COMUNICAÇÃO"), style: red };
    if (reading?.lowBattery) return { cls: "is-danger", label: t("BATERIA BAIXA"), style: red };
    const cls = reading?.status === "alert" ? "is-danger"
      : (reading?.status === "attention" ? "is-warning" : "is-success");
    // O selo segue a mesma cor do ícone: verde, amarelo ou vermelho pelo status.
    const tint = reading?.statusColor || null;
    const style = tint
      ? `background:${tint};color:${window.IcMapIcons?.cosmofieldTextOn?.(tint) || "#fff"};`
      : "";
    const label = Number.isFinite(reading?.availablePct)
      ? `${reading.availablePct.toFixed(0)}% ${t("da água disponível")}`
      : `${(reading?.moistureValue ?? 0).toFixed(1)}%`;
    return { cls, label, style };
  };
  window.IcCosmofieldStatus = cosmofieldStatusOf;

  const drawCosmofield = (cf, equip, index = 0) => {
    if (isConnectivityMode()) {
       registerConnectivityMarker(cf.center, equip, cosmofieldLayer, equip.name || "Cosmofield");
       return;
    }

    // Cor do ícone acompanha a leitura, igual à barra do tooltip. SVG
    // compartilhado com o minimapa da tela de Detalhes (core/map-icons.js).
    const reading = cosmofieldReading(equip, index);

    const icon = window.IcMapIcons.cosmofieldIcon({
      color: reading.statusColor || "",
      alert: reading.status === "alert",
    });
    const layer = L.marker([cf.center.lat, cf.center.lng], { icon }).addTo(cosmofieldLayer);

    const {
      source, seed, moistureValue, wiltingPoint, fieldCapacity,
      availablePct: availableWaterPct, triggerPct,
      hasRange: hasSoilRange, hasTrigger, scaleColor,
      isOffline, minutesSince, batteryValue, lowBattery,
    } = reading;

    // Traço quando não há leitura nem mock possível.
    const fmt = (value, mock, suffix, digits = 1) => {
      const num = toNumber(value) ?? mock;
      return num === null ? "—" : `${num.toFixed(digits)}${suffix}`;
    };



    // moistureValue já vem do helper (leitura real ou mock da faixa).
    const moisture = `${moistureValue.toFixed(1)}%`;
    const battery = `${batteryValue.toFixed(2)} V`;

    // Lâmina para levar o solo da umidade atual até a capacidade de campo:
    // (CC - umidade) em % vol. sobre a profundidade explorada. Já no solo
    // ou acima da CC, não há o que repor.
    const currentBlade = (() => {
      const explicit = toNumber(source.recommendedBlade ?? source.laminaRecomendada);
      if (explicit !== null) return `${explicit.toFixed(2)} mm`;

      if (fieldCapacity === null) return "—";

      const deficit = fieldCapacity - moistureValue;
      const depthMm = COSMOFIELD_ROOT_DEPTH_CM * 10;
      return `${Math.max(0, (deficit / 100) * depthMm).toFixed(2)} mm`;
    })();
    // Sonda transmite de meia em meia hora: sem dado real, mostra a última
    // transmissão como "agora menos 30 min". O resolvedor dos pivôs gerava
    // datas de meses atrás, o que dava a impressão de equipamento mudo.
    const lastCommunication = (() => {
      const explicit = resolvePivotTooltipLastCommunication(source, seed, "");
      if (explicit) return explicit.replace(/\s\d{4}\s/, " ");

      const when = new Date(Date.now() - 30 * 60000);
      const locale = window.IcI18n?.getLocale?.() || "pt-BR";
      const day = when
        .toLocaleDateString(locale, { day: "2-digit", month: "short" })
        .replace(/\sde\s/g, " ")
        .replace(/\.$/, "");
      const time = when.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
      return `${day} ${time}`;
    })();

    // Data em que a lâmina recomendada deve ser aplicada. Mock: 0–6 dias à
    // frente, determinístico pelo id.
    const nextIrrigationDate = formatCosmofieldDate(
      source.nextIrrigationDate ?? source.dataProximaIrrigacao,
      seed % 7
    );

    const availableWaterHtml = hasSoilRange ? `
        <div class="cf-tip__bar">
          <div class="cf-tip__bar-fill ${isOffline ? "is-offline" : ""}" style="width:${availableWaterPct}%;${scaleColor ? `background:${scaleColor};` : ""}"></div>
          ${hasTrigger ? `<span class="cf-tip__bar-trigger" style="left:${triggerPct}%;" title="${escapeTooltipHtml(`${tCf("Trigger")}: ${triggerPct.toFixed(0)}%`)}"></span>` : ""}
        </div>
        <div class="cf-tip__scale">
          <span>${tCf("Ponto de murcha permanente")} ${wiltingPoint.toFixed(1)}%</span>
          <span>${availableWaterPct.toFixed(0)}${tCf("% da água disponível")}</span>
          <span>${tCf("Capacidade de campo")} ${fieldCapacity.toFixed(1)}%</span>
        </div>` : "";

    // Status no topo do tooltip: espelha o estado da sonda em vez de um
    // "ATIVO" fixo, que contradizia o próprio aviso de sem comunicação.
    // Os rótulos tinham saído junto com a legenda das faixas de irrigação
    // (27de4b6) e o selo ficava só a cor, sem texto.
    const cosmofieldStatus = cosmofieldStatusOf(reading);

    const lowBatteryHtml = (!isOffline && lowBattery) ? `
        <div class="cf-tip__offline cf-tip__offline--battery">
          <i class="fa-solid fa-battery-quarter" aria-hidden="true"></i>
          <span>${tCf("Bateria baixa")} — ${batteryValue.toFixed(2)} V</span>
        </div>` : "";

    const offlineHtml = isOffline ? `
        <div class="cf-tip__offline">
          <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
          <span>${tCf("Sem comunicação")} — ${tCf("última leitura há {v}").replace("{v}", formatElapsed(minutesSince))}</span>
        </div>` : "";

    const tooltipHtml = `
      <div class="pivot-tooltip pivot-tooltip--pivot-card pivot-tooltip--cosmofield">
        <div class="pivot-tooltip__topline">
          <span class="pivot-tooltip__name">${escapeTooltipHtml(equip.name || "Cosmofield")}</span>
          <span class="pivot-tooltip__status ${cosmofieldStatus.cls}" style="${cosmofieldStatus.style || ""}">${escapeTooltipHtml(cosmofieldStatus.label)}</span>
        </div>
        <div class="cf-tip__hero">
          <span class="cf-tip__hero-value ${isOffline ? "is-stale" : ""}">${moisture}</span><span class="cf-tip__hero-label">vol.</span>
          ${availableWaterHtml}
          ${offlineHtml}
          ${lowBatteryHtml}
        </div>
        <div class="cf-tip__grid">
          ${cosmofieldTooltipCell("waves-arrow-down.svg", tCf("Lâmina recomendada"), currentBlade)}
          ${cosmofieldTooltipCell("calendar-1.svg", tCf("Próxima irrigação"), nextIrrigationDate)}
          ${cosmofieldTooltipCell("zap.svg", tCf("Tensão da bateria"), battery)}
          ${cosmofieldTooltipCell("radio.svg", tCf("Última transmissão"), lastCommunication)}
        </div>
      </div>
    `;

    layer.bindTooltip(tooltipHtml, {
      permanent: false,
      direction: "top",
      className: "pivot-tooltip-wrap pivot-tooltip-wrap--pivot-card pivot-tooltip-wrap--cosmofield",
      opacity: 1,
      offset: [0, -10]
    });

    layer.on("click", (event) => {
      if (window.IcEquipmentDeleteShortcut?.handleMapClick?.(equip, event)) return;
      const action = localStorage.getItem("ic:cosmofield-click-action") || "modal";

      if (action === "modal" && window.IcCosmofieldModal?.open) {
        window.IcCosmofieldModal.open({
          name: equip.name || "Cosmofield",
          equipId: equip.id,
          data: equip.data || {},
          index,
        });
        return;
      }

      // Navega pela rota, não chamando a tela direto: a rota fecha as demais
      // páginas antes de abrir. Abrir na mão deixava a tela anterior
      // montada no pageSlot, e a do Cosmofield vinha com resto de outras
      // páginas. A rota abre os Detalhes já na sonda clicada.
      window.IcNavigate?.("cosmofield", { equipId: equip.id, fromMap: true });
    });
  };

  const drawRepeater = (rep, equip) => {
    if (isConnectivityMode()) {
       registerConnectivityMarker(rep.center, equip, repLayer, equip.name || "Repetidora");
       return;
    }

    const icon = L.divIcon({
      className: "map-rep-marker",
      html: `
        <div class="map-rep-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path class="rep-path-4" d="M16.247 7.761a6 6 0 0 1 0 8.478"/>
            <path class="rep-path-5" d="M19.075 4.933a10 10 0 0 1 0 14.134"/>
            <path class="rep-path-2" d="M4.925 19.067a10 10 0 0 1 0-14.134"/>
            <path class="rep-path-3" d="M7.753 16.239a6 6 0 0 1 0-8.478"/>
            <circle cx="12" cy="12" r="2"/>
          </svg>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    const layer = L.marker([rep.center.lat, rep.center.lng], { icon }).addTo(repLayer);

    const tooltipHtml = `
      <div class="pivot-tooltip pivot-tooltip--pivot-card" style="padding:8px 10px;gap:6px;min-width:160px;max-width:260px;">
        <div class="pivot-tooltip__topline">
          <span class="pivot-tooltip__name" style="font-size:12px;line-height:1.1;">${escapeTooltipHtml(equip.name || "Repetidora")}</span>
        </div>
        <div class="pivot-tooltip__details-grid" style="gap:4px 8px;">
          ${buildTooltipDetailHtml("", rep.height !== null ? `${rep.height} m` : "—", { iconMarkup: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#64748b;"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>` })}
        </div>
        <span class="pivot-tooltip__date" style="font-size:10px;margin-top:0;"><span class="comm-label">Última comunicação:</span> ${escapeTooltipHtml(rep.lastCommunication)}</span>
      </div>
    `;

    layer.bindTooltip(tooltipHtml, {
      permanent: false,
      direction: "top",
      className: "pivot-tooltip-wrap",
      opacity: 1,
      offset: [0, -10]
    });

    layer.on("click", (event) => {
      if (window.IcEquipmentDeleteShortcut?.handleMapClick?.(equip, event)) return;
      if (window.IcRepetidoraEdit && typeof window.IcRepetidoraEdit.open === "function") {
        window.IcRepetidoraEdit.open({ repId: equip.id, fromMap: true });
        return;
      }

      if (window.IcToggleView && typeof window.IcToggleView === "function") {
        window.IcToggleView("equipamentos", "form", equip.id);
        return;
      }

      if (window.IcEquipamentos && window.IcEquipamentos.repetidora && typeof window.IcEquipamentos.repetidora.open === "function") {
        window.IcEquipamentos.repetidora.open({ equipmentId: equip.id, fromMap: true });
        return;
      }

      if (window.IcRepetidoraDetails && typeof window.IcRepetidoraDetails.open === "function") {
        window.IcRepetidoraDetails.open({ repetidoraId: equip.id, fromMap: true });
        return;
      }
    });
  };

  const drawWeatherStation = (ws, equip) => {
    // A estação Davis conecta por 4G próprio (não entra na malha IrriMesh):
    // no modo Conectividade aparece como um ponto 4G, igual Cosmofield.
    if (isConnectivityMode()) {
      registerConnectivityMarker(ws.center, equip, weatherLayer, equip.name || "Estação Meteorológica");
      return;
    }

    // Ícone de anemômetro (concha + cata-vento), no padrão do produto Davis —
    // compartilhado com o minimapa da tela de Detalhes (core/map-icons.js).
    const icon = window.IcMapIcons?.weatherStationIcon?.();
    const layer = L.marker([ws.center.lat, ws.center.lng], { icon }).addTo(weatherLayer);

    // Aquece o cache da previsão para esta estação — a tela de detalhe abre
    // instantânea depois.
    if (window.IcEstacaoDetails?.prefetch) {
      window.IcEstacaoDetails.prefetch(ws.center.lat, ws.center.lng, equip.data?.current || {});
    }

    const fmtN = (v, unit, dec = 2) => (Number.isFinite(v) ? `${v.toFixed(dec)} ${unit}` : `-- ${unit}`);
    const c = ws.current || {};
    const radW = Number.isFinite(c.solarRadiation) ? `${Math.round(c.solarRadiation)} W/m²` : fmtN(c.solarRadiationDay, "MJ/m²", 1);
    // Mesmos ícones e valores do card de equipamentos (view.render.js):
    // ETo (broto), Chuva, Temperatura, Umidade (gota), Vento, Radiação.
    const ETO_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3c-.6.7-.6 1.6 0 2.3s.6 1.6 0 2.3"/><path d="M11.7 3c-.6.7-.6 1.6 0 2.3s.6 1.6 0 2.3"/><path d="M15.4 3c-.6.7-.6 1.6 0 2.3s.6 1.6 0 2.3"/><path d="M12 19.5c-.2-3 1.3-5.8 4.8-6.4.2 3-1.3 5.8-4.8 6.4Z"/><path d="M12 19.5c.1-2.5-1.2-4.6-3.9-5-.1 2.5 1.2 4.6 3.9 5Z"/><path d="M12 19.5V15"/><path d="M4 19.5h16"/><path d="M9 22h6"/></svg>';
    const HUM_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5S12.5 5.5 12 3c-.5 2.5-2 4.9-4 6.5S5 13 5 15a7 7 0 0 0 7 7Z"/></svg>';
    const lastComm = ws.lastCommunication
      ? new Date(ws.lastCommunication).toLocaleString(window.IcI18n?.getLocale?.() || "pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).replace(".", "")
      : "—";

    const tooltipHtml = `
      <div class="pivot-tooltip pivot-tooltip--pivot-card">
        <div class="pivot-tooltip__topline">
          <span class="pivot-tooltip__name">${escapeTooltipHtml(equip.name || "Estação Meteorológica")}</span>
          ${ws.offline ? '<span class="pivot-tooltip__status is-warning">SEM COMUNICAÇÃO</span>' : ""}
        </div>
        <div class="pivot-tooltip__ws-grid">
          <span>${ETO_SVG} <span>ETo</span> ${fmtN(c.eto, "mm")}</span>
          <span><i class="fa-solid fa-cloud-rain"></i> <span>Chuva</span> ${fmtN(c.rainDay, "mm", 1)}</span>
          <span><i class="fa-solid fa-temperature-half"></i> <span>Temp.</span> ${fmtN(c.temperature, "°C", 1)}</span>
          <span>${HUM_SVG} <span>Umidade</span> ${fmtN(c.humidity, "%", 0)}</span>
          <span><i class="fa-solid fa-wind"></i> <span>Vento</span> ${fmtN(c.windSpeed, "m/s", 1)}</span>
          <span><i class="fa-solid fa-sun"></i> <span>Radiação</span> ${radW}</span>
        </div>
        <span class="pivot-tooltip__date"><span>Última comunicação:</span> ${escapeTooltipHtml(lastComm)}</span>
      </div>
    `;

    layer.bindTooltip(tooltipHtml, {
      permanent: false, direction: "top",
      className: "pivot-tooltip-wrap pivot-tooltip-wrap--pivot-card",
      opacity: 1, offset: [0, -12],
    });

    layer.on("click", (event) => {
      if (window.IcEquipmentDeleteShortcut?.handleMapClick?.(equip, event)) return;
      const action = localStorage.getItem("ic:weather-station-click-action") || "modal";
      if (action === "modal" && window.IcEstacaoModal && typeof window.IcEstacaoModal.open === "function") {
        window.IcEstacaoModal.open({ name: equip.name || "Estação Meteorológica", equipId: equip.id, data: equip.data || {} });
        return;
      }
      if (window.IcEstacaoDetails && typeof window.IcEstacaoDetails.open === "function") {
        window.IcEstacaoDetails.open({ estId: equip.id, fromMap: true });
        return;
      }
      if (window.IcEstacaoEdit && typeof window.IcEstacaoEdit.open === "function") {
        window.IcEstacaoEdit.open({ estId: equip.id, fromMap: true });
      }
    });
  };

  const drawPump = (pump, equip) => {
    if (isConnectivityMode()) {
       registerConnectivityMarker(pump.center, equip, pumpLayer, equip.name || "Bomba");
       return;
    }

    // Silhueta simples da bomba (só o contorno, sem detalhes internos), com
    // traço preto e preenchimento conforme o status — mesmas cores do card
    // de equipamentos: azul = ligada, amarelo = desligada, vermelho = alerta.
    const pumpColor = pump.offline ? "#DA1D29" : (pump.running ? "#4679ed" : "#DAC422");
    const icon = L.divIcon({
      className: "map-pump-marker",
      html: `
        <svg xmlns="http://www.w3.org/2000/svg" width="33" height="30" viewBox="0 0 40 32" fill="${pumpColor}" stroke="#111827" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">
          <path d="M10 2h10v5h3a3 3 0 0 1 3 3v2h5a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-5v2a3 3 0 0 1-3 3h1l2.5 5h-21l2.5-5h1a3 3 0 0 1-3-3V10a3 3 0 0 1 3-3h3V2z"/>
        </svg>`,
      iconSize: [33, 30],
      iconAnchor: [16, 15],
    });
    const layer = L.marker([pump.center.lat, pump.center.lng], { icon }).addTo(pumpLayer);

    const tooltipHtml = `
      <div class="pivot-tooltip pivot-tooltip--pivot-card">
        <div class="pivot-tooltip__topline">
          <span class="pivot-tooltip__name">${escapeTooltipHtml(equip.name || "Bomba")}</span>
          <span class="pivot-tooltip__status ${pump.offline ? "is-danger" : (pump.running ? "is-info" : "is-warning")}">${pump.offline ? "SEM COMUNICACAO" : (pump.running ? "LIGADA VIA INTERNET" : "DESLIGADA")}</span>
        </div>
        <span class="pivot-tooltip__date">Ultima comunicacao: ${escapeTooltipHtml(pump.lastCommunication)}</span>
      </div>
    `;

    layer.bindTooltip(tooltipHtml, {
      permanent: false,
      direction: "top",
      className: "pivot-tooltip-wrap pivot-tooltip-wrap--pivot-card",
      opacity: 1,
      offset: [0, -10]
    });

    layer.on("click", (event) => {
      if (window.IcEquipmentDeleteShortcut?.handleMapClick?.(equip, event)) return;
      const action = localStorage.getItem('ic:pivot-click-action') || 'details';
      if (action === 'schedule') {
        if (window.IcBombaModal && typeof window.IcBombaModal.open === "function") {
          window.IcBombaModal.open({ name: equip.name || "Bomba", equipId: equip.id, running: pump.running });
        }
      } else {
        if (window.IcBombaDetails && typeof window.IcBombaDetails.open === "function") {
          window.IcBombaDetails.open({ BmbId: equip.id, fromMap: true });
        }
      }
    });
  };
  const drawCentral = (central, equip) => {
    if (isConnectivityMode()) {
       L.circleMarker([central.center.lat, central.center.lng], {
         radius: 7, // Slightly larger for central
         color: "rgba(17,17,17,0.45)",
         weight: 1.5,
         fillColor: CONNECTIVITY_COLORS.central, // Yellow
         fillOpacity: 1,
         interactive: true,
       }).addTo(centralLayer).bindTooltip(buildConnectivityTooltip(equip, "Central"), {
         direction: "top",
         offset: [0, -6],
         opacity: 1,
         className: "pivot-tooltip-wrap conn-tooltip-wrap",
       });
       return;
    }

    const icon = L.divIcon({
      className: "map-central-marker",
      html: getCentralMarkerHtml(),
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    const layer = L.marker([central.center.lat, central.center.lng], { icon }).addTo(centralLayer);

    const tooltipHtml = `
      <div class="pivot-tooltip">
        <span class="pivot-tooltip__name">${equip.name || "Central"}</span>
      </div>
    `;

    layer.bindTooltip(tooltipHtml, {
      permanent: false,
      direction: "top",
      className: "pivot-tooltip-wrap",
      opacity: 1,
      offset: [0, -10]
    });

    layer.on("click", (event) => {
      window.IcEquipmentDeleteShortcut?.handleMapClick?.(equip, event);
    });
  };

  const renderLastMapContext = (options = {}) => {
    if (!_lastRenderedFarm) return;
    renderMapEquipments(_lastRenderedFarm, { ..._lastRenderOptions, ...options });
  };

  const renderMapEquipments = (farm, options = {}) => {
    if (!map || !farm) return;

    const equipments = Array.isArray(farm.equipments) ? farm.equipments : [];
    const isConnectivity = isConnectivityMode();
    const farmId = String(farm.id || "");
    if (isConnectivity && _connectivityFarmId !== farmId) {
      clearInterval(_connectivityScanTimer);
      _connectivityScanTimer = null;
      clearConnectivityUi();
      _connectivityScanState = new Map();
      _connectivitySelected = null;
      _connectivityScanDone = false;
      _connectivityFarmId = farmId;
    } else if (!isConnectivity) {
      clearInterval(_connectivityScanTimer);
      _connectivityScanTimer = null;
      _connectivityFarmId = null;
      _connectivityScanState = new Map();
      _connectivitySelected = null;
      _connectivityScanDone = false;
      clearConnectivityUi();
      setConnectivityTerrain(false);
    }
    _lastRenderedFarm = farm;
    _lastRenderOptions = { ...options };

    _connectivityMarkers = [];
    connectivityGpsLayer.clearLayers();
    _pivotMotionRegistry.forEach((entry) => { try { entry.group.remove(); } catch (_) { } });
    _pivotMotionRegistry.clear();
    _rainstarMotionRegistry.clear();
    pivotLayer.clearLayers();
    mdnLayer.clearLayers();
    repLayer.clearLayers();
    pumpLayer.clearLayers();
    centralLayer.clearLayers();
    carretelLayer.clearLayers();
    linestarLayer.clearLayers();
    // Sem esta limpeza cada re-render empilhava um marcador novo por cima do
    // anterior: dois ícones sobrepostos no mesmo ponto, e o de cima roubava
    // o hover do de baixo — o tooltip parecia não abrir.
    cosmofieldLayer.clearLayers();
    // Idem para a estação meteorológica: sem esta limpeza o ícone do
    // anemômetro empilhava a cada re-render (4 marcadores no mesmo ponto).
    weatherLayer.clearLayers();
    connectivityLineLayer.clearLayers();

    if (isConnectivity) {
      ensureConnectivityControls();
      renderConnectivityLegend();
      renderConnectivityLogsBar();
      const centralNode = getFarmCentralNode(farm);
      if (centralNode) drawCentral({ center: centralNode.center }, centralNode);
    }

    equipments.forEach((equip) => {
      const rainstar = extractRainstarData(equip);
      if (rainstar) {
        drawRainstar(rainstar, equip);
        return;
      }

      const pivot = extractPivotData(equip);
      if (!pivot) return;

      // SmartTouch divisions are drawn differently
      if (equip.type === "smarttouch") {
        if (pivot.parcels.length > 0 && pivot.center) {
          let bearingRef = getPivotBearingRefDeg(pivot);
          let linkedPivotName = "Pivô";
          let statusBadge = PIVOT_COLORS.statusText;
          let badgeClass = PIVOT_COLORS.statusClass;
          let linkedVisual = PIVOT_COLORS;

          if (pivot.linkedPivotId) {
            const linked = equipments.find(e => e.id === pivot.linkedPivotId);
            if (linked) {
              linkedPivotName = linked.name || "Pivô";
              const lp = extractPivotData(linked);
              if (lp) {
                linkedVisual = getPivotVisuals(lp, linked);
                statusBadge = linkedVisual.statusText;
                badgeClass = linkedVisual.statusClass;
              }
              if (lp && lp.center && lp.ref) {
                bearingRef = (bearingRad(lp.center, lp.ref) * 180 / Math.PI);
              }
            }
          }

          // Draw interactive sectors for tooltips
          pivot.parcels.forEach(parcel => {
            const startAngle = parseFloat(parcel.startAngle) || 0;
            let endAngle = parseFloat(parcel.endAngle) || 0;
            if (endAngle <= startAngle) endAngle += 360;

            const points = [L.latLng(pivot.center.lat, pivot.center.lng)];
            const R = 6378137;
            const d = pivot.radius / R;
            const lat1 = pivot.center.lat * Math.PI / 180;
            const lon1 = pivot.center.lng * Math.PI / 180;

            for (let a = startAngle; a <= endAngle; a += 5) {
              const brng = (bearingRef + a) * Math.PI / 180;
              const pLat = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
              const pLng = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(pLat));
              points.push(L.latLng(pLat * 180 / Math.PI, pLng * 180 / Math.PI));
            }
            const brngEnd = (bearingRef + endAngle) * Math.PI / 180;
            const eLat = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brngEnd));
            const eLng = lon1 + Math.atan2(Math.sin(brngEnd) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(eLat));
            points.push(L.latLng(eLat * 180 / Math.PI, eLng * 180 / Math.PI));
            points.push(L.latLng(pivot.center.lat, pivot.center.lng));

            const sector = L.polygon(points, {
              color: linkedVisual.parcelStroke || PIVOT_COLORS.parcelStroke,
              fillColor: linkedVisual.fill || PIVOT_COLORS.fill,
              fillOpacity: linkedVisual.parcelFillOpacity || PIVOT_COLORS.parcelFillOpacity,
              weight: 1.5
            }).addTo(pivotLayer);

            const tooltipHtml = buildPivotDetailsTooltipHtml(
              pivot, 
              equip, 
              linkedVisual, 
              `${linkedPivotName} - ${parcel.name || "Parcela"}`
            );
            sector.bindTooltip(tooltipHtml, {
              permanent: false,
              direction: "top",
              className: "pivot-tooltip-wrap",
              opacity: 1,
              offset: [0, -10]
            });
          });

          // Draw division lines
          const angles = new Set();
          pivot.parcels.forEach(p => {
            angles.add(p.startAngle);
            angles.add(p.endAngle);
          });

          angles.forEach(angle => {
            const ang = (bearingRef + (parseFloat(angle) || 0)) * Math.PI / 180;
            const lineEnd = destinationPoint(pivot.center, pivot.radius, ang);
            L.polyline(
              [
                [pivot.center.lat, pivot.center.lng],
                [lineEnd.lat, lineEnd.lng],
              ],
              { color: PIVOT_COLORS.ref, weight: 1.5, opacity: 0.8 }
            ).addTo(pivotLayer);
          });

          drawPivotReferenceOverlay(pivot, linkedVisual, pivotLayer);

          return; // Somente retorna se desenhou parcelas
        }
      }


      drawPivot(pivot, equip);
    });

    // Draw pivots registered via Cadastros (farm.pivos) not already in farm.equipments
    if (Array.isArray(farm.pivos)) {
      const equipIds = new Set(equipments.map(e => e.id));
      farm.pivos.forEach((pivo) => {
        if (equipIds.has(pivo.id)) return;
        const lat = parseFloat(pivo.lat);
        const lng = parseFloat(pivo.lng);
        const radius = parseFloat(pivo.radius);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !radius || radius <= 0) return;
        const center = { lat, lng };
        const refLat = parseFloat(pivo.refLat);
        const refLng = parseFloat(pivo.refLng);
        const ref = (Number.isFinite(refLat) && Number.isFinite(refLng)) ? { lat: refLat, lng: refLng } : null;
        const isPartial = pivo.isPartial === true || pivo.isPartial === "true";
        let pivot;
        if (isPartial && ref) {
          const sLat = parseFloat(pivo.startLat), sLng = parseFloat(pivo.startLng);
          const eLat = parseFloat(pivo.endLat), eLng = parseFloat(pivo.endLng);
          if (Number.isFinite(sLat) && Number.isFinite(sLng) && Number.isFinite(eLat) && Number.isFinite(eLng)) {
            const refBrg = bearingRad(center, ref) * 180 / Math.PI;
            const startBrg = bearingRad(center, { lat: sLat, lng: sLng }) * 180 / Math.PI;
            const endBrg = bearingRad(center, { lat: eLat, lng: eLng }) * 180 / Math.PI;
            pivot = {
              center, radius, ref, isSector: true,
              startAngle: ((startBrg - refBrg) + 360) % 360,
              endAngle: ((endBrg - refBrg) + 360) % 360
            };
          } else {
            pivot = { center, radius, ref, isSector: false };
          }
        } else {
          pivot = { center, radius, ref, isSector: false };
        }
        drawPivot(pivot, { id: pivo.id, name: pivo.name || "Pivô", type: "smart_connect", category: "pivos" });
      });
    }

    equipments.forEach((equip) => {
      const mdn = extractMdnData(equip);
      if (!mdn) return;
      drawMdn(mdn, equip);
    });

    equipments.forEach((equip) => {
      const rep = extractRepeaterData(equip);
      if (!rep) return;
      drawRepeater(rep, equip);
    });

    equipments.forEach((equip) => {
      const ws = extractWeatherStationData(equip);
      if (!ws) return;
      drawWeatherStation(ws, equip);
    });

    // Índice entre os Cosmofields da fazenda: enquanto não há telemetria, é
    // ele que faz um aparecer perto da capacidade de campo e outro seco, em
    // vez de todos com a mesma leitura.
    let cosmofieldIndex = 0;
    equipments.forEach((equip) => {
      const cf = extractCosmofieldData(equip);
      if (!cf) return;
      drawCosmofield(cf, equip, cosmofieldIndex++);
    });

    equipments.forEach((equip) => {
      const pump = extractPumpData(equip);
      if (!pump) return;
      drawPump(pump, equip);
    });

    equipments.forEach((equip) => {
      const central = extractCentralData(equip);
      if (!central) return;
      drawCentral(central, equip);
    });

    // DEMO: central cadastrada na fazenda (Editar fazenda › rádio + localização)
    // também aparece na Visão Geral, não só em Conectividade.
    if (!isConnectivity && !equipments.some((equip) => extractCentralData(equip))) {
      const farmCentral = getFarmCentralNode(farm);
      if (farmCentral) drawCentral({ center: farmCentral.center }, farmCentral);
    }

    // LineStar (pivô linear)
    equipments.forEach((equip) => {
      const ls = extractLineStar(equip);
      if (!ls) return;
      drawLineStar(ls, equip);
    });

    if (isConnectivity) {
      renderConnectivityGpsMarkers();
      if (document.getElementById("connLogs")) renderConnectivityLogs();
    }

    if (options.fitToItems === true) {
      scheduleFitMapToVisibleItems();
    }

    window.IcHeatmap?.refresh(farm);
  };

  window.IcMapRenderPivots = renderMapEquipments;
  window.IcMapClearPivots = () => {
    _connectivityMarkers = [];
    _lastRenderedFarm = null;
    _lastRenderOptions = {};
    _pivotMotionRegistry.forEach((entry) => { try { entry.group.remove(); } catch (_) { } });
    _pivotMotionRegistry.clear();
    _rainstarMotionRegistry.clear();
    pivotLayer.clearLayers();

    mdnLayer.clearLayers();
    repLayer.clearLayers();
    pumpLayer.clearLayers();
    centralLayer.clearLayers();
    carretelLayer.clearLayers();
    linestarLayer.clearLayers();
    weatherLayer.clearLayers();
    talhaoLayer.clearLayers();
    plvLayer.clearLayers();
    cosmofieldLayer.clearLayers();
    connectivityLineLayer.clearLayers();
    connectivityGpsLayer.clearLayers();
    stopConnectivityRadar();
    clearConnectivityUi();
    setConnectivityTerrain(false);
    if (_connectivityScanTimer) clearInterval(_connectivityScanTimer);
    _connectivityScanState = new Map();
    _connectivityFarmId = null;
    _connectivitySelected = null;
  };

  function clearConnectivityUi() {
    document.getElementById("connLegend")?.remove();
    document.getElementById("connLogsBar")?.remove();
    document.getElementById("connLogs")?.remove();
    document.getElementById("connControls")?.remove();
  }

  function setConnectivityTerrain(enabled) {
    if (enabled) {
      if (map.hasLayer(satelliteTiles)) map.removeLayer(satelliteTiles);
      if (map.hasLayer(labelTiles)) map.removeLayer(labelTiles);
      if (!map.hasLayer(terrainTiles)) terrainTiles.addTo(map);
      return;
    }
    if (map.hasLayer(terrainTiles)) map.removeLayer(terrainTiles);
    if (!map.hasLayer(satelliteTiles)) satelliteTiles.addTo(map);
    if (!map.hasLayer(labelTiles)) labelTiles.addTo(map);
  }

  function getConnPref(key) {
    try { return localStorage.getItem(key) === "1"; } catch (_) { return false; }
  }

  function setConnPref(key, value) {
    try { localStorage.setItem(key, value ? "1" : "0"); } catch (_) {}
  }

  const CONN_TOGGLES = [
    { key: "terrain", pref: "ic:conn-relevo", icon: "fa-mountain-sun" },
    { key: "keep-lines", pref: "ic:conn-keep-lines", icon: "fa-diagram-project" },
    { key: "show-gps", pref: "ic:conn-show-gps", icon: "fa-location-crosshairs" },
  ];

  function applyConnToggle(key, on) {
    if (key === "terrain") setConnectivityTerrain(on);
    if (key === "show-gps") {
      renderConnectivityGpsMarkers();
      // GPS desligado: se a análise era do rádio de GPS, volta pro controlador.
      if (!on && _connectivityDetailRadio === "gps") {
        _connectivityDetailRadio = "controlador";
        if (document.getElementById("connLogs")) renderConnectivityLogs();
      }
    }
  }

  function ensureConnectivityControls() {
    if (document.getElementById("connControls")) return;
    const t = (text) => window.IcI18n?.t?.(text) ?? text;
    const controls = document.createElement("div");
    controls.className = "conn-controls";
    controls.id = "connControls";
    L.DomEvent.disableClickPropagation(controls);
    controls.innerHTML = CONN_TOGGLES.map((tg) => `
      <button type="button" class="conn-ctrl-btn" data-conn-toggle="${tg.key}"
              title="${t(tg.label)}" aria-label="${t(tg.label)}" aria-pressed="false">
        <i class="fa-solid ${tg.icon}" aria-hidden="true"></i>
        <span class="conn-ctrl-btn__tip">${t(tg.label)}</span>
      </button>
    `).join("");
    // Posiciona logo abaixo do botão de Tela Cheia (canto superior direito).
    const mapActions = document.querySelector(".map-actions");
    (mapActions || document.querySelector(".map-actions__col") || el).appendChild(controls);

    CONN_TOGGLES.forEach((tg) => {
      const btn = controls.querySelector(`[data-conn-toggle="${tg.key}"]`);
      const on = getConnPref(tg.pref);
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", String(on));
    });
    setConnectivityTerrain(getConnPref("ic:conn-relevo"));

    controls.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-conn-toggle]");
      if (!btn) return;
      const tg = CONN_TOGGLES.find((x) => x.key === btn.dataset.connToggle);
      if (!tg) return;
      const on = !getConnPref(tg.pref);
      setConnPref(tg.pref, on);
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", String(on));
      applyConnToggle(tg.key, on);
    });
  }

  // Legenda como seletor que abre/fecha, igual ao filtro de Equipamentos,
  // logo abaixo dele na coluna de ações do mapa.
  function renderConnectivityLegend() {
    if (document.getElementById("connLegend")) return;
    const t = (text) => window.IcI18n?.t?.(text) ?? text;
    const anchor = document.getElementById("mapEquip");
    const host = anchor?.parentElement || document.querySelector(".map-actions__col") || el;
    const wrap = document.createElement("div");
    wrap.className = "map-equip conn-legend";
    wrap.id = "connLegend";
    wrap.innerHTML = `
      <button class="map-equip__bar" type="button" aria-expanded="false" aria-controls="connLegendPanel">
        <span class="map-equip__icon"><i class="fa-solid fa-list-ul" aria-hidden="true"></i></span>
        <span class="map-equip__label">${t("Legenda")}</span>
        <span class="map-equip__chev"><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></span>
      </button>
      <div class="map-equip__panel conn-legend__panel" id="connLegendPanel" role="region" aria-label="${t("Legenda")}">
        <div class="conn-legend__section">
          <strong>${t("Dispositivo")}:</strong>
          <span><b style="background:${CONNECTIVITY_SCAN_COLORS.found}"></b>${t("Encontrado")}</span>
          <span><b style="background:${CONNECTIVITY_SCAN_COLORS.missing}"></b>${t("Não encontrado")}</span>
          <span><b style="background:${CONNECTIVITY_SCAN_COLORS.central}"></b>${t("Central")}</span>
        </div>
        <div class="conn-legend__section">
          <strong>${t("Linha")}:</strong>
          ${CONNECTIVITY_LEVELS.map((lv) => `<span><i class="conn-legend__stroke" style="background:${lv.color}"></i>${t(lv.label)}</span>`).join("")}
        </div>
      </div>
    `;
    if (anchor) anchor.insertAdjacentElement("afterend", wrap);
    else host.appendChild(wrap);
    const bar = wrap.querySelector(".map-equip__bar");
    bar.addEventListener("click", (e) => {
      e.stopPropagation();
      // Legenda e filtro de Equipamentos nunca abertos ao mesmo tempo.
      const equip = document.getElementById("mapEquip");
      if (equip && wrap !== equip) {
        equip.classList.remove("is-open");
        equip.querySelector(".map-equip__bar")?.setAttribute("aria-expanded", "false");
      }
      const open = wrap.classList.toggle("is-open");
      bar.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target)) {
        wrap.classList.remove("is-open");
        bar.setAttribute("aria-expanded", "false");
      }
    });
  }

  // Botão "Registros" em barra larga, ao lado de Equipamentos e Legenda,
  // para dar mais destaque (antes ficava na coluna de ícones empilhados).
  function renderConnectivityLogsBar() {
    if (document.getElementById("connLogsBar")) return;
    const t = (text) => window.IcI18n?.t?.(text) ?? text;
    const anchor = document.getElementById("connLegend") || document.getElementById("mapEquip");
    const host = anchor?.parentElement || document.querySelector(".map-actions__col") || el;
    const wrap = document.createElement("div");
    wrap.className = "map-equip conn-logs-bar";
    wrap.id = "connLogsBar";
    L.DomEvent.disableClickPropagation(wrap);
    wrap.innerHTML = `
      <button class="map-equip__bar" type="button" data-conn-action="logs" aria-pressed="false">
        <span class="map-equip__icon"><i class="fa-solid fa-list" aria-hidden="true"></i></span>
        <span class="map-equip__label">${t("Registros")}</span>
      </button>
    `;
    if (anchor) anchor.insertAdjacentElement("afterend", wrap);
    else host.appendChild(wrap);
    wrap.querySelector(".map-equip__bar").addEventListener("click", (e) => {
      e.stopPropagation();
      const btn = e.currentTarget;
      const open = document.getElementById("connLogs");
      if (open) { open.remove(); btn.classList.remove("is-active"); btn.setAttribute("aria-pressed", "false"); }
      else {
        renderConnectivityLogs();
        btn.classList.add("is-active");
        btn.setAttribute("aria-pressed", "true");
      }
    });
  }

  // Status de comunicação de um equipamento: online/offline. Nesta camada só
  // importa se o nó foi encontrado (rádio) ou está online (4G).
  function connectivityEquipHealth(id) {
    // Sem busca executada: não há status de comunicação a mostrar.
    if (!_connectivityScanDone && _connectivityScanState.size === 0) return null;
    const nodes = getConnectivityNodes(_lastRenderedFarm);
    const node = nodes.find((n) => String(n.id) === String(id));
    if (!node) return null;
    if (node.tech === "4g") {
      const state = _connectivityScanState.get(String(id));
      const online = state ? state.found !== false : resolveConnectivity4gStatus(node).online;
      return { tech: "4g", online };
    }
    const found = _connectivityScanState.get(String(id))?.found;
    return { tech: "radio", connected: !!found, found: !!found };
  }

  function applyConnectivityCardState(id) {
    const wrap = document.querySelector(`[data-equip-badges="${id}"]`);
    if (!wrap) return;
    const item = getConnectivityNodes(_lastRenderedFarm).find((node) => String(node.id) === String(id));
    const tech = resolveConnectivityTech(item);
    wrap.querySelectorAll(".is-connectivity-tag").forEach((tag) => {
      tag.classList.remove("is-scanning", "is-online", "is-offline", "is-4g");
      const state = _connectivityScanState.get(String(id));
      if (tech === "4g") {
        tag.textContent = "4G";
        tag.classList.add("is-4g");
        const offline4g = state ? state.found === false : !resolveConnectivity4gStatus(item).online;
        if (offline4g) tag.classList.add("is-offline");
        tag.title = window.IcI18n?.t?.(offline4g ? "Sem comunicação" : "Verificado") || "";
        return;
      }
      if (!state) return;
      tag.classList.add(state.found ? "is-online" : "is-offline");
      tag.title = window.IcI18n?.t?.(state.found ? "Encontrado" : "Sem comunicação") || "";
    });
    renderConnectivityCardSignal(id, wrap);
  }

  // Marca o status de comunicação no card do equipamento (sidebar). O offline
  // é sinalizado só pela cor vermelha das próprias badges (Controlador/GPS/4G);
  // sem texto extra — a intensidade de sinal não é válida num nó isolado.
  function renderConnectivityCardSignal(id, wrap) {
    const card = wrap.closest(".map-card__equip");
    if (!card) return;
    card.querySelector(".map-card__signal")?.remove();
    const health = connectivityEquipHealth(id);
    const status = !health ? "unknown"
      : health.tech === "4g" ? (health.online ? "4g" : "4g-off")
      : (health.tech === "radio" && !_connectivityScanState.get(String(id))) ? "unknown"
      : health.connected ? "found"
      : "offline";
    card.dataset.connStatus = status;
  }

  window.IcConnectivityApplyCardState = applyConnectivityCardState;

  function updateConnectivityMarkerState(id, opts = {}) {
    _connectivityMarkers.forEach((marker) => {
      if (String(marker.options.equipId) !== String(id)) return;
      const fakeEquip = marker.options.connTech === "4g"
        ? { id, type: "cosmofield" }
        : { id, type: "smart_connect" };
      marker.setStyle({ fillColor: getConnectivityMarkerFill(fakeEquip) });
      if (opts.pulse) {
        const r = marker.options.radius || 5;
        // Pulso suave: anel efêmero em torno do pino, sem "pular" o raio do pino.
        const ring = L.circleMarker(marker.getLatLng(), {
          radius: r,
          color: getConnectivityMarkerFill(fakeEquip),
          weight: 2,
          opacity: 0.9,
          fill: false,
          interactive: false,
        }).addTo(connectivityFxLayer);
        let t0 = null;
        const grow = (ts) => {
          if (t0 === null) t0 = ts;
          const k = Math.min(1, (ts - t0) / 420);
          ring.setRadius(r + k * 14);
          ring.setStyle({ opacity: 0.9 * (1 - k) });
          if (k < 1) requestAnimationFrame(grow);
          else connectivityFxLayer.removeLayer(ring);
        };
        requestAnimationFrame(grow);
      }
    });
    applyConnectivityCardState(id);
  }

  function renderConnectivityGpsMarkers() {
    connectivityGpsLayer.clearLayers();
    if (!isConnectivityMode() || !getConnPref("ic:conn-show-gps")) return;
    const scanned = _connectivityScanDone || _connectivityScanState.size > 0;
    getConnectivityNodes(_lastRenderedFarm, { includeGps: true })
      .filter((node) => node.isGpsNode)
      .forEach((node) => {
        // GPS participa da malha: pino segue verde/vermelho da busca.
        const fill = !scanned ? CONNECTIVITY_SCAN_COLORS.idle
          : connectivityNodeFound(node) ? CONNECTIVITY_SCAN_COLORS.found
          : CONNECTIVITY_SCAN_COLORS.missing;
        const gpsMarker = L.circleMarker([node.center.lat, node.center.lng], {
          radius: 4,
          color: "#ffffff",
          weight: 1.4,
          fillColor: fill,
          fillOpacity: 1,
          interactive: true
        }).addTo(connectivityGpsLayer).bindTooltip(buildConnectivityTooltip(node, "GPS"), {
          direction: "top",
          offset: [0, -6],
          opacity: 1,
          className: "pivot-tooltip-wrap conn-tooltip-wrap",
        });
        // Clicar no pino do GPS seleciona o rádio de GPS nos Registros.
        const baseId = String(node.id).replace(/:gps$/, "");
        gpsMarker.on("click", () => {
          if (!isConnectivityMode()) return;
          selectConnectivityRadio(baseId, "gps");
        });
      });
  }

  window.IcConnectivityScanDone = () => _connectivityScanDone;

  // Quantos equipamentos de uma categoria estão sem comunicação (após a busca).
  window.IcConnectivityCategoryOffline = (category) => {
    if (!_connectivityScanDone) return 0;
    const equipments = Array.isArray(_lastRenderedFarm?.equipments) ? _lastRenderedFarm.equipments : [];
    let offline = 0;
    equipments.forEach((item) => {
      const cat = item.category === "carreteis" && item.type === "linestar" ? "linestars" : item.category;
      if (cat !== category) return;
      const h = connectivityEquipHealth(item.id);
      if (!h) return;
      if (h.tech === "4g" ? h.online === false : (_connectivityScanState.get(String(item.id)) && !h.connected)) offline += 1;
    });
    return offline;
  };

  window.IcConnectivityScan = () => {
    if (!_lastRenderedFarm || !isConnectivityMode()) return;
    const nodes = getConnectivityNodes(_lastRenderedFarm).filter((node) => !node.isCentral);
    if (!nodes.length) return;
    if (_connectivityScanTimer) clearInterval(_connectivityScanTimer);
    _connectivityScanDone = false;
    const button = document.getElementById("btnCreateEquipment");
    const t = (text) => window.IcI18n?.t?.(text) ?? text;
    const central = getFarmCentralNode(_lastRenderedFarm);
    const farm = _lastRenderedFarm;
    const round = _connectivityScanRound++;
    const unavailable = new Set();
    _connectivityScanState = new Map();
    // Aparelhos 4G (CenterStar/LineStar/Cosmofield) são verificados à parte da
    // malha: já resolvem o próprio estado, sem participar da varredura de rádio.
    let cosmofieldIx = 0;
    (farm.equipments || []).forEach((item) => {
      if (resolveConnectivityTech(item) !== "4g") return;
      const idx = item.category === "cosmofields" ? cosmofieldIx++ : 0;
      const status = resolveConnectivity4gStatus(item, idx);
      _connectivityScanState.set(String(item.id), { found: status.online, tech: "4g" });
    });
    nodes.forEach((node) => {
      if (node.tech === "radio") _connectivityScanState.set(String(node.id), { found: false });
      applyConnectivityCardState(node.id);
    });
    renderConnectivityGpsMarkers();
    _connectivityMarkers.forEach((marker) => {
      if (marker.options.connTech === "4g") {
        marker.setStyle({ fillColor: getConnectivityMarkerFill({ id: marker.options.equipId, type: "cosmofield" }) });
      } else {
        marker.setStyle({ fillColor: CONNECTIVITY_SCAN_COLORS.missing });
      }
    });
    const order = nodes
      .filter((node) => node.tech === "radio")
      .map((node) => ({ node, dist: central ? distanceMeters(central.center, node.center) : hashString(node.id) }))
      .sort((a, b) => a.dist - b.dist)
      .map((entry) => entry.node);
    // Simula quedas pontuais na malha: rotaciona um rádio "sem comunicação" a cada busca.
    const candidates = order.filter((node) => !unavailable.has(String(node.id)));
    if (candidates.length > 2) unavailable.add(String(candidates[round % candidates.length].id));
    connectivityLineLayer.clearLayers();
    connectivityFxLayer.clearLayers();
    startConnectivityRadar(central, order);
    const total = Math.max(1, order.length);
    let progress = 0;
    let index = 0;
    if (button) button.classList.add("is-scanning");
    const renderButton = () => {
      if (button) button.innerHTML = `<span class="map-card__cta-ico"><i class="fa-solid fa-wifi"></i></span><span>${t("Buscar Rádios")}</span> ${progress}%`;
    };
    renderButton();
    _connectivityScanTimer = setInterval(() => {
      progress = Math.min(100, progress + 4);
      let advanced = false;
      while (index < order.length && progress >= Math.round(((index + 1) / total) * 92)) {
        const node = order[index++];
        const miss = unavailable.has(String(node.id)) || (hashString(`${farm.id}:${node.id}:${round}`) % 11) === 0;
        _connectivityScanState.set(String(node.id), { found: !miss });
        updateConnectivityMarkerState(node.id, { pulse: true });
        advanced = true;
      }
      renderButton();
      // Atualiza os Registros enquanto os nós vão respondendo.
      if (advanced && document.getElementById("connLogs")) renderConnectivityLogs();
      if (progress >= 100) {
        clearInterval(_connectivityScanTimer);
        _connectivityScanTimer = null;
        order.slice(index).forEach((node) => {
          _connectivityScanState.set(String(node.id), { found: !unavailable.has(String(node.id)) });
          updateConnectivityMarkerState(node.id, { pulse: true });
        });
        stopConnectivityRadar();
        if (button) button.classList.remove("is-scanning");
        _connectivityScanDone = true;
        renderConnectivityGpsMarkers();
        if (document.getElementById("connLogs")) renderConnectivityLogs();
        window.IcMapUpdateCardStatusCounts?.(); // resumo "Sem comunicação" por categoria
        // O botão fica em "100%" até nova busca ou sair/voltar da página.
        renderButton();
      }
    }, 130);
  };

  // Pulso suave na Central enquanto a busca roda — mesmo tamanho do pulso dos
  // pinos (raio em pixels), não uma varredura de quilômetros.
  function startConnectivityRadar(central, order) {
    stopConnectivityRadar();
    const origin = central?.center
      || order.map((n) => n.center).reduce((a, c, _, arr) => ({
        lat: a.lat + c.lat / arr.length, lng: a.lng + c.lng / arr.length,
      }), { lat: 0, lng: 0 });
    if (!origin || (!origin.lat && !origin.lng)) return;
    const baseR = 7;
    const ring = L.circleMarker([origin.lat, origin.lng], {
      radius: baseR, color: "#38bdf8", weight: 2, opacity: 0.6,
      fill: false, interactive: false,
    }).addTo(connectivityFxLayer);
    let t0 = null;
    const tick = (ts) => {
      if (t0 === null) t0 = ts;
      const k = ((ts - t0) % 1100) / 1100;
      ring.setRadius(baseR + k * 14);
      ring.setStyle({ opacity: 0.6 * (1 - k) });
      _connectivityRadarRaf = requestAnimationFrame(tick);
    };
    _connectivityRadarRaf = requestAnimationFrame(tick);
  }

  function stopConnectivityRadar() {
    if (_connectivityRadarRaf) cancelAnimationFrame(_connectivityRadarRaf);
    _connectivityRadarRaf = null;
    connectivityFxLayer.clearLayers();
  }

  function escapeConn(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function getSelectedConnectivityNode(selectedId) {
    return getConnectivityNodes(_lastRenderedFarm).find((node) => String(node.id) === String(selectedId));
  }

  // Nós candidatos a enlace com o nó de análise: se ele é GPS, os alvos são os
  // outros nós de GPS (+ Central); senão, os controladores (+ Central).
  function connectivityLinkTargets(analysisNode) {
    const wantGps = !!analysisNode?.isGpsNode;
    return getConnectivityNodes(_lastRenderedFarm, { includeGps: wantGps })
      .filter((n) => n.isCentral || (wantGps ? n.isGpsNode : !n.isGpsNode));
  }

  // Linhas entre o nó selecionado e os vizinhos de rádio com quem ele se
  // comunica. Cor segue a intensidade do enlace (análise nó-a-nó); tooltip
  // mostra o dBm. 4G não desenha linha.
  function drawConnectivityLines(selectedNode) {
    if (!getConnPref("ic:conn-keep-lines")) connectivityLineLayer.clearLayers();
    else connectivityLineLayer.eachLayer((line) => {
      if (line.options.connectivitySource === selectedNode?.id) connectivityLineLayer.removeLayer(line);
    });
    if (!selectedNode || selectedNode.tech !== "radio") return;
    const t = (text) => window.IcI18n?.t?.(text) ?? text;
    const nodes = connectivityLinkTargets(selectedNode);
    nodes.forEach((node) => {
      if (!connectivityLinkExists(selectedNode, node)) return;
      const sig = connectivityLinkSignal(selectedNode, node);
      L.polyline(
        [[selectedNode.center.lat, selectedNode.center.lng], [node.center.lat, node.center.lng]],
        { connectivitySource: selectedNode.id, color: sig.level.color, weight: 3, opacity: 0.9 }
      ).addTo(connectivityLineLayer)
        .bindTooltip(`${escapeConn(node.name || t("Equipamento"))} · ${t(sig.level.label)} (${sig.dBm} dBm)`, { sticky: true });
    });
  }

  // Nó de análise conforme o rádio escolhido (controlador = o próprio nó;
  // gps = ponto do GPS do pivô, com o endereço do rádio de GPS).
  function connectivityAnalysisNode(selectedNode, radioKind) {
    if (radioKind !== "gps") return selectedNode;
    const gpsPoint = getConnectivityGpsPoint(selectedNode);
    if (!gpsPoint) return selectedNode;
    return {
      ...selectedNode,
      id: `${selectedNode.id}:gps`,
      center: gpsPoint,
      radio: selectedNode?.data?.gpsRadio || `${selectedNode.id}GPS`,
      isGpsNode: true
    };
  }

  // Seleciona um equipamento/rádio: desenha as linhas dele no mapa e abre os
  // Registros na aba "Conexões" (a força das conexões vive só nos Registros).
  function selectConnectivityRadio(id, radioKind) {
    const item = getSelectedConnectivityNode(id);
    if (!item) return;
    const is4g = item.tech === "4g";
    let kind = radioKind === "gps" ? "gps" : "controlador";
    if (kind === "gps") {
      const hasGps = !is4g && !!getConnectivityGpsPoint(item);
      if (!hasGps || !getConnPref("ic:conn-show-gps")) kind = "controlador";
    }
    _connectivitySelected = String(id || "");
    _connectivityDetailRadio = kind;
    drawConnectivityLines(connectivityAnalysisNode(item, kind));
    // Abre os Registros já na aba "Conexões".
    if (!document.getElementById("connLogs")) {
      renderConnectivityLogs();
      const bar = document.querySelector('#connLogsBar .map-equip__bar');
      bar?.classList.add("is-active");
      bar?.setAttribute("aria-pressed", "true");
    } else {
      renderConnectivityLogs();
    }
    const connTab = document.querySelector('#connLogs [data-tab="connections"]');
    connTab?.click();
  }

  window.IcConnectivitySelect = (id) => selectConnectivityRadio(id, "controlador");
  window.IcConnectivitySelectRadio = (id, radioKind) => selectConnectivityRadio(id, radioKind);

  function renderConnectivityLogs() {
    const t = (text) => window.IcI18n?.t?.(text) ?? text;
    const farm = _lastRenderedFarm || {};
    const nodes = getConnectivityNodes(farm).filter((node) => node.tech === "radio" && !node.isGpsNode);
    const central = nodes.find((n) => n.isCentral);
    const now = new Date();
    const stamp = (offset) => {
      const d = new Date(now.getTime() - offset * 60000);
      const pad = (n) => String(n).padStart(2, "0");
      return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    const radioAddr = (node) => escapeConn(connectivityRadioAddr(node));
    // Mostra o id só quando é um número curto (id "de verdade"); ids internos
    // longos ou com sufixo não entram entre parênteses.
    const shortId = (raw) => {
      const s = String(raw ?? "").replace(/:gps$/, "");
      return /^\d{1,7}$/.test(s) ? s : "";
    };
    const nodeLabel = (node) => {
      const name = escapeConn(node?.name || t("Equipamento"));
      const id = shortId(node?.numericId ?? node?.code ?? node?.id);
      return id ? `${name} <span class="conn-logs__id">(${escapeConn(id)})</span>` : name;
    };
    const farmName = escapeConn(farm?.name || farm?.label || t("Fazenda"));
    const farmId = shortId(farm?.code ?? farm?.number ?? farm?.id);
    const farmLine = `<a class="conn-logs__farm">${farmName}${farmId ? ` (${escapeConn(farmId)})` : ""}</a>`;

    // Aba "Devices Found": todos os nós de rádio encontrados na busca.
    const found = nodes.filter((n) => n.isCentral || _connectivityScanState.get(String(n.id))?.found);
    let seq = 0;
    const deviceEntries = found.flatMap((node) => {
      if (node.isCentral) return [];
      const i = seq++;
      return [{
        search: `${farmName} ${farmId} ${node.name} ${node.id} ${radioAddr(node)}`.toLowerCase(),
        html: `
          <div class="conn-logs__row conn-logs__row--block">
            <time>${stamp(i * 3)}</time>
            ${farmLine}
            <div class="conn-logs__field"><span>${t("Dispositivos:")}</span> ${nodeLabel(node)}</div>
            <div class="conn-logs__field"><span>${t("Rádio:")}</span> <code>${radioAddr(node)}</code></div>
          </div>`
      }];
    });

    // Aba "Connections": só as conexões do dispositivo/rádio selecionado no
    // card de detalhe. Sem seleção, a aba fica vazia com uma instrução.
    let connEntries = [];
    let connEmptyMsg = t("Selecione um dispositivo no mapa para ver suas conexões.");
    if (_connectivitySelected) {
      const selNode = getSelectedConnectivityNode(_connectivitySelected);
      if (selNode && selNode.tech === "radio") {
        const analysisNode = connectivityAnalysisNode(selNode, _connectivityDetailRadio);
        const radioTxt = _connectivityDetailRadio === "gps" ? "GPS" : t("Controlador");
        const links = connectivityLinkTargets(analysisNode)
          .filter((n) => connectivityLinkExists(analysisNode, n))
          .map((n) => ({ n, sig: connectivityLinkSignal(analysisNode, n) }))
          .sort((a, b) => b.sig.dBm - a.sig.dBm);
        connEntries = links.map(({ n, sig }, i) => ({
          search: `${selNode.name} ${radioAddr(analysisNode)} ${n.name} ${radioAddr(n)} ${sig.level.labelEn} ${sig.dBm}`.toLowerCase(),
          html: `
          <div class="conn-logs__row conn-logs__row--block">
            <time>${stamp(i * 4)}</time>
            ${farmLine}
            <div class="conn-logs__field"><span>${t("De:")}</span> ${escapeConn(selNode.name || t("Equipamento"))} <span class="conn-logs__id">(${escapeConn(radioTxt)})</span> <code>${radioAddr(analysisNode)}</code></div>
            <div class="conn-logs__field"><span>${t("Para:")}</span> ${escapeConn(n.name || t("Equipamento"))} <code>${radioAddr(n)}</code></div>
            <div class="conn-logs__field"><span>${t("Intensidade da conexão:")}</span> <b style="color:${sig.level.color}">${t(sig.level.label)} (${sig.dBm} dBm)</b></div>
          </div>`
        }));
        if (!connEntries.length) connEmptyMsg = t("Sem vizinhos de rádio ao alcance.");
      } else if (selNode) {
        connEmptyMsg = t("Aparelho 4G");
      }
    }
    let panel = document.getElementById("connLogs");
    if (!panel) {
      panel = document.createElement("aside");
      panel.className = "conn-logs";
      panel.id = "connLogs";
      L.DomEvent.disableClickPropagation(panel);
      L.DomEvent.disableScrollPropagation(panel);
      el.appendChild(panel);
    }
    panel.innerHTML = `
      <header class="conn-logs__header">
        <h3>${t("Registros")}</h3>
        <button type="button" class="conn-icon-btn" data-conn-close-logs title="${t("Fechar")}" aria-label="${t("Fechar")}"><i class="fa-solid fa-xmark"></i></button>
      </header>
      <input class="conn-logs__search" type="search" placeholder="${t("Buscar registros...")}" aria-label="${t("Buscar registros...")}">
      <div class="edit-panel__tabs conn-logs__tabs">
        <button class="edit-panel__tab is-active" type="button" data-tab="devices">${t("Dispositivos encontrados")}</button>
        <button class="edit-panel__tab" type="button" data-tab="connections">${t("Conexões")}</button>
      </div>
      <div class="edit-panel__tab-body is-active" data-tab-body="devices">${deviceEntries.map((e) => `<div data-log-row="${e.search}">${e.html}</div>`).join("")}</div>
      <div class="edit-panel__tab-body" data-tab-body="connections">${connEntries.length
        ? connEntries.map((e) => `<div data-log-row="${e.search}">${e.html}</div>`).join("")
        : `<p class="conn-logs__empty">${connEmptyMsg}</p>`}</div>
    `;
    panel.querySelector("[data-conn-close-logs]")?.addEventListener("click", () => {
      panel.remove();
      const bar = document.querySelector('#connLogsBar .map-equip__bar');
      bar?.classList.remove("is-active");
      bar?.setAttribute("aria-pressed", "false");
    });
    panel.querySelectorAll("[data-tab]").forEach((tab) => {
      tab.addEventListener("click", () => {
        const target = tab.getAttribute("data-tab");
        panel.querySelectorAll("[data-tab]").forEach((btn) => btn.classList.toggle("is-active", btn === tab));
        panel.querySelectorAll("[data-tab-body]").forEach((body) => body.classList.toggle("is-active", body.getAttribute("data-tab-body") === target));
      });
    });
    panel.querySelector(".conn-logs__search")?.addEventListener("input", (event) => {
      const q = event.target.value.trim().toLowerCase();
      panel.querySelectorAll("[data-log-row]").forEach((row) => {
        row.style.display = row.getAttribute("data-log-row").includes(q) ? "" : "none";
      });
    });
  }

  window.addEventListener("ic:lang-change", () => {
    if (!isConnectivityMode()) return;
    const logsOpen = !!document.getElementById("connLogs");
    clearConnectivityUi();
    ensureConnectivityControls();
    renderConnectivityLegend();
    renderConnectivityLogsBar();
    connectivityLineLayer.clearLayers();
    if (logsOpen) {
      renderConnectivityLogs();
      document.querySelector('#connLogsBar .map-equip__bar')?.classList.add("is-active");
    }
  });

  // Bind do botão "Buscar Rádios"
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("#btnCreateEquipment.is-connectivity");
    if (btn) {
       e.preventDefault();
       window.IcConnectivityScan();
    }
  });



  // Expor camadas para o filtro
  window.icLayers = {
    pivos: pivotLayer,
    medidores: mdnLayer,
    pluviometros: plvLayer,
    repetidoras: repLayer,
    bombas: pumpLayer,
    carreteis: carretelLayer,
    linestars: linestarLayer,
    linestar: linestarLayer,
    estacoes: weatherLayer,
    cosmofields: cosmofieldLayer,
    talhoes: talhaoLayer
  };

  // =========================
  // Heatmap de Irrigação (heatmap.js v2)
  // =========================
  let _heatOverlay = null;
  let _heatVisible = false;

  const R_EARTH = 6378137;

  // Converte metros em graus de latitude
  const mToLat = (m) => (m / R_EARTH) * (180 / Math.PI);
  // Converte metros em graus de longitude dado uma latitude
  const mToLng = (m, lat) => (m / (R_EARTH * Math.cos(lat * Math.PI / 180))) * (180 / Math.PI);

  // Ponto deslocado a partir de um centro dado distância e ângulo (em graus)
  function offsetPoint(lat, lng, distM, angleDeg) {
    const rad = angleDeg * Math.PI / 180;
    return {
      lat: lat + mToLat(distM * Math.cos(rad)),
      lng: lng + mToLng(distM * Math.sin(rad), lat)
    };
  }

  // Gerador pseudo-aleatório estável (seeded) — garante mesma visualização toda vez
  function seededRng(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  // Fallback: simulated farm with 4 pivots for demo when no real farm is loaded
  function _simulatedFarm() {
    const center = map.getCenter();
    const lat = center.lat, lng = center.lng;
    return {
      equipments: [
        { id: "sim1", category: "pivos", data: { centerLat: lat + 0.012, centerLng: lng - 0.015, radius: 400 } },
        { id: "sim2", category: "pivos", data: { centerLat: lat - 0.008, centerLng: lng + 0.010, radius: 350 } },
        { id: "sim3", category: "pivos", data: { centerLat: lat + 0.020, centerLng: lng + 0.022, radius: 500 } },
        { id: "sim4", category: "pivos", data: { centerLat: lat - 0.018, centerLng: lng - 0.008, radius: 280 } },
      ],
      pivos: []
    };
  }

  function generateHeatPoints(farm) {
    const src = farm || _simulatedFarm();
    const equipments = Array.isArray(src?.equipments) ? src.equipments : [];
    const pivos = Array.isArray(src?.pivos) ? src.pivos : [];

    const allPivots = [
      ...equipments.filter(e => {
        const cat = String(e?.category || "").toLowerCase();
        const type = String(e?.type || "").toLowerCase();
        return cat === "pivos" || type === "smart_connect" || type === "smarttouch";
      }),
      ...pivos.map(p => ({ data: p, _fromLegacy: true }))
    ];

    const allPoints = [];
    let globalMax = 0;

    allPivots.forEach(equip => {
      const d = equip._fromLegacy ? equip.data : (equip.data || {});
      const lat = parseFloat(d.centerLat ?? d.lat);
      const lng = parseFloat(d.centerLng ?? d.lng);
      const radius = parseFloat(d.radius) || 300;
      if (!isFinite(lat) || !isFinite(lng)) return;

      const isSector = d.isSector === true || d.isSector === "true";
      const maxAngle = isSector ? (parseFloat(d.endAngle) || 270) : 360;

      // Ângulo de referência (bearing do ponto de referência)
      let refBearing = 0;
      if (d.refLat && d.refLng) {
        const rLat = parseFloat(d.refLat);
        const rLng = parseFloat(d.refLng);
        refBearing = Math.atan2(
          Math.sin((rLng - lng) * Math.PI / 180) * Math.cos(rLat * Math.PI / 180),
          Math.cos(lat * Math.PI / 180) * Math.sin(rLat * Math.PI / 180) -
          Math.sin(lat * Math.PI / 180) * Math.cos(rLat * Math.PI / 180) *
          Math.cos((rLng - lng) * Math.PI / 180)
        ) * 180 / Math.PI;
      }

      // Seed estável baseado no ID do equipamento
      const seedNum = String(equip.id || lat + lng).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      const rng = seededRng(seedNum);
      const laminaBase = 20 + (seedNum % 50); // 20–70mm

      // Simula segmentos com lâminas diferentes (como parcelas reais)
      const numSectors = 3 + (seedNum % 4); // 3–6 "parcelas"
      const sectorLaminas = Array.from({ length: numSectors }, (_, i) => {
        const sectorSeed = seedNum + i * 137;
        return laminaBase * (0.4 + (sectorSeed % 100) / 100);
      });

      // Distribui pontos uniformemente na área (distribuição uniforme no círculo)
      const numPoints = Math.min(200, Math.max(80, Math.floor(radius / 5)));

      for (let i = 0; i < numPoints; i++) {
        // Distribuição uniforme no disco: r = R * sqrt(rand)
        const r = radius * Math.sqrt(rng());
        const angleRad = rng() * (maxAngle * Math.PI / 180);
        const angleDeg = refBearing + (angleRad * 180 / Math.PI);

        const pt = offsetPoint(lat, lng, r, angleDeg);

        // Qual "parcela" esse ponto está
        const sectorIdx = Math.floor((angleRad / (maxAngle * Math.PI / 180)) * numSectors);
        const baseLamina = sectorLaminas[Math.min(sectorIdx, sectorLaminas.length - 1)];

        // Variação radial: bordas recebem menos água que o centro
        const radialFactor = 0.6 + 0.4 * (1 - r / radius);
        // Ruído pequeno para textura natural
        const noise = 0.85 + rng() * 0.3;
        const value = baseLamina * radialFactor * noise;

        if (value > globalMax) globalMax = value;
        allPoints.push({ lat: pt.lat, lng: pt.lng, value });
      }
    });

    return { data: allPoints, max: globalMax || 1, min: 0 };
  }

  function renderHeatmap(farm) {
    if (_heatOverlay) {
      map.removeLayer(_heatOverlay);
      _heatOverlay = null;
    }
    if (!_heatVisible) return;

    const dataset = generateHeatPoints(farm || _lastRenderedFarm);
    if (!dataset.data.length) return;

    _heatOverlay = L.heatmapOverlay({
      radius: 50,
      blur: 0.85,
      gradient: {
        "0.2": "rgb(0,0,200)",
        "0.4": "rgb(0,200,200)",
        "0.6": "rgb(80,220,50)",
        "0.75": "rgb(255,200,0)",
        "0.9": "rgb(255,100,0)",
        "1.0": "rgb(220,30,30)"
      },
      maxOpacity: 0.82,
      minOpacity: 0.0,
    }).addTo(map);

    _heatOverlay.setData(dataset);
  }

  window.IcHeatmap = {
    toggle(farm) {
      _heatVisible = !_heatVisible;
      renderHeatmap(farm || _lastRenderedFarm);
    },
    refresh(farm) {
      if (_heatVisible) renderHeatmap(farm || _lastRenderedFarm);
    },
    isVisible() { return _heatVisible; }
  };

  map.on("zoomend", () => {
    const isPluviometriaMode =
      document.body.classList.contains("is-pluviometria") ||
      document.body.classList.contains("is-pluviometria-edit") ||
      document.body.classList.contains("is-pluvd");

    if (isPluviometriaMode) {
      window.IcMapClearPivots?.();
      window.Plv?.views?.map?.renderMarkers?.();
      return;
    }

    renderLastMapContext({ fitToItems: false });
  });

  const rerenderActiveFarmPivots = () => {
    renderLastMapContext({ fitToItems: false });
  };

  // Re-render de movimento (simulação): redesenhar o mapa a cada frame recria as camadas
  // do Leaflet e mata o balão/clique. Equilíbrio: anima enquanto o mouse se move ou está
  // fora do mapa; estabiliza (pausa o re-render) quando o cursor fica parado sobre o mapa
  // (pra ler o balão) ou durante um clique/arraste.
  let _overMap = false;
  let _lastMoveTs = 0;
  let _suspendUntil = 0;
  let _lastMotionRender = 0;
  try {
    const mapEl = map.getContainer();
    mapEl.addEventListener("pointerenter", () => { _overMap = true; });
    mapEl.addEventListener("pointerleave", () => {
      _overMap = false;
    });
    mapEl.addEventListener("pointermove", () => { _lastMoveTs = Date.now(); });
    mapEl.addEventListener("pointerdown", () => { _suspendUntil = Date.now() + 600; });
  } catch (_) {}

  // DEMO: atualiza só as partes que se movem (braço/faixa do pivô, faixa e
  // carrinho do carretel) mexendo nas camadas existentes. O círculo do pivô,
  // os balões e os cliques não são recriados → nada pisca nem trava.
  // Retorna false quando algo mudou de verdade (status/cor) e precisa do
  // redesenho completo.
  // Durante o zoom o Leaflet ainda não reposicionou o "palco" das camadas;
  // redesenhar nesse meio tempo deixava braço/faixa/carretel deslocados.
  let _mapZooming = false;
  let _zoomSettleTimer = null;
  map.on("zoomstart", () => { _mapZooming = true; clearTimeout(_zoomSettleTimer); });
  map.on("zoomanim", () => { _mapZooming = true; clearTimeout(_zoomSettleTimer); });
  map.on("zoomend", () => {
    clearTimeout(_zoomSettleTimer);
    _zoomSettleTimer = setTimeout(() => { _mapZooming = false; }, 120);
  });

  const updateMotionLayersOnly = () => {
    if (isConnectivityMode()) return false;
    if (!_lastRenderedFarm) return false;
    let ok = true;

    _pivotMotionRegistry.forEach((entry) => {
      if (!ok) return;
      const pivot = (entry.equip?.type ? extractPivotData(entry.equip) : null) || entry.pivot;
      if (!pivot) return;
      const c = getPivotVisuals(pivot, entry.equip);
      const sig = getPivotMotionSignature(c);
      if (sig === entry.sig) return;
      const prev = entry.sig.split("|");
      const next = sig.split("|");
      // status/cores (6 primeiros campos) mudaram → redesenho completo
      if (prev.slice(0, 6).join("|") !== next.slice(0, 6).join("|")) { ok = false; return; }
      entry.pivot = pivot;
      entry.sig = sig;
      entry.group.clearLayers();
      drawPivotDynamicParts(pivot, c, entry.group);
      if (entry.layer?.isTooltipOpen?.()) {
        try { entry.layer.setTooltipContent(buildPivotDetailsTooltipHtml(pivot, entry.equip, c)); } catch (_) { }
      }
    });
    if (!ok) return false;

    _rainstarMotionRegistry.forEach((entry) => {
      if (!ok) return;
      const r = extractRainstarData(entry.equip);
      if (!r?.hasLane) { ok = false; return; }
      const visual = resolveRainstarStatus(entry.equip);
      const sig = [visual.fill, visual.remainingFill, visual.stroke, visual.markerFill].join("|");
      if (sig !== entry.sig) { ok = false; return; }
      const parts = getRainstarLaneParts(r);
      entry.refs.remaining?.setLatLngs(parts.remaining || []);
      entry.refs.irrigated?.setLatLngs(parts.irrigated || []);
      entry.refs.arrow?.setLatLng([r.center.lat, r.center.lng]);
      const open = (entry.layers || []).find((l) => l?.isTooltipOpen?.());
      if (open) {
        try { open.setTooltipContent(buildRainstarTooltipHtml(r, entry.equip)); } catch (_) { }
      }
    });
    return ok;
  };

  let _fullRenderRetry = null;
  const rerenderMotion = () => {
    const now = Date.now();
    if (now - _lastMotionRender < 50) return; // ~20fps
    if (_mapZooming || map._animatingZoom) return; // espera o zoom assentar
    _lastMotionRender = now;
    if (updateMotionLayersOnly()) return;
    // Mudou status/cor: redesenho completo (raro). Só espera clique/arraste acabar.
    if (now < _suspendUntil) {
      clearTimeout(_fullRenderRetry);
      _fullRenderRetry = setTimeout(rerenderActiveFarmPivots, _suspendUntil - now + 20);
      return;
    }
    rerenderActiveFarmPivots();
  };
  window.IcMapUpdateMotionOnly = updateMotionLayersOnly;

  window.addEventListener("ic:sim-start", rerenderActiveFarmPivots);
  window.addEventListener("ic:sim-pause", rerenderActiveFarmPivots);
  window.addEventListener("ic:sim-stop", rerenderActiveFarmPivots);
  window.addEventListener("ic:sim-status-change", rerenderActiveFarmPivots);
  window.addEventListener("ic:sim-tick", rerenderMotion);
  window.addEventListener("ic:pivot-motion-tick", rerenderMotion);
})();

(function initMapSimulationBar() {
  const bar = document.getElementById("mapSimBar");
  if (!bar) return;

  const toggle = document.getElementById("mapSimBarToggle");
  const body = document.getElementById("mapSimBarBody");
  const track = document.getElementById("mapSimBarTrack");
  const runAllBtn = document.getElementById("mapSimBarRunAll");
  if (!toggle || !body || !track || !runAllBtn) return;

  const TICK_MS = 250;
  const FULL_ROTATION_MS = 180000; // DEMO: mais lento (3 min por volta)
  const PROGRESS_STEP = (TICK_MS / FULL_ROTATION_MS) * 100;
  const MODES = Object.freeze({
    irrigating: { label: "Irrigacao normal", chip: "Irrigando", cardClass: "is-irrigating" },
    dry_irrigation: { label: "Irrigacao a seco", chip: "A seco", cardClass: "is-dry-irrigation" },
    fertigation: { label: "Fertirrigacao", chip: "Fertirrigacao", cardClass: "is-fertigation" },
  });

  const getStore = () => {
    if (!window.IcPivotSimulationRuntime || typeof window.IcPivotSimulationRuntime !== "object") {
      window.IcPivotSimulationRuntime = { states: {}, version: 1 };
    }
    if (!window.IcPivotSimulationRuntime.states || typeof window.IcPivotSimulationRuntime.states !== "object") {
      window.IcPivotSimulationRuntime.states = {};
    }
    return window.IcPivotSimulationRuntime;
  };

  const getActiveFarm = () => window.IcFarmGetActive?.() || window.IcFarmActive || null;

  const collectPivots = (farm) => {
    if (!farm) return [];
    const items = [];
    const seen = new Set();

    (farm.equipments || []).forEach((equip) => {
      const type = String(equip?.type || "").toLowerCase();
      const category = String(equip?.category || "").toLowerCase();
      const isPivot = category === "pivos" || type === "smart_connect" || type === "smarttouch" || type === "linestar";
      if (!isPivot || !equip?.id || seen.has(equip.id)) return;
      seen.add(equip.id);
      items.push({
        id: equip.id,
        name: equip.name || (type === "linestar" ? "Pivo linear" : "Pivo"),
      });
    });

    (farm.pivos || []).forEach((pivo) => {
      if (!pivo?.id || seen.has(pivo.id)) return;
      seen.add(pivo.id);
      items.push({
        id: pivo.id,
        name: pivo.name || "Pivo",
      });
    });

    return items;
  };

  const getRuntime = (pivotId) => {
    const store = getStore();
    if (!store.states[pivotId]) {
      store.states[pivotId] = {
        mode: "irrigating",
        progress: 0,
        isRunning: false,
      };
    }
    return store.states[pivotId];
  };

  const getCardStatus = (runtime) => {
    const modeMeta = MODES[runtime.mode] || MODES.irrigating;
    if (runtime.isRunning) return { text: modeMeta.chip, className: modeMeta.cardClass };
    if ((runtime.progress || 0) >= 100) return { text: "Concluido", className: modeMeta.cardClass };
    if ((runtime.progress || 0) > 0) return { text: "Pausado", className: modeMeta.cardClass };
    return { text: "Pronto", className: "is-panel-off" };
  };

  const getGlobalRunState = (pivots) => {
    const runtimes = pivots.map((pivot) => getRuntime(pivot.id));
    const anyRunning = runtimes.some((runtime) => runtime.isRunning);
    const allCompleted = runtimes.length > 0 && runtimes.every((runtime) => (runtime.progress || 0) >= 100);
    return { anyRunning, allCompleted };
  };

  const rerenderMap = () => {
    if (!document.body.classList.contains("is-visao-geral")) return;
    const farm = getActiveFarm();
    if (farm && typeof window.IcMapRenderPivots === "function") {
      window.IcMapRenderPivots(farm);
    }
  };

  const renderCards = () => {
    const farm = getActiveFarm();
    const farmId = String(farm?.id || "");
    const store = getStore();
    if (store.activeFarmId !== farmId) {
      store.activeFarmId = farmId;
    }

    const pivotsCompact = collectPivots(farm);
    if (!pivotsCompact.length) {
      track.innerHTML = '<div class="map-simbar__empty">Crie pivôs na fazenda ativa para começar a simulação.</div>';
      runAllBtn.disabled = true;
      runAllBtn.classList.remove("is-running");
      runAllBtn.innerHTML = '<i class="fa-solid fa-play"></i> Rodar todos';
      return;
    }

    runAllBtn.disabled = false;
    const globalState = getGlobalRunState(pivotsCompact);
    runAllBtn.classList.toggle("is-running", globalState.anyRunning);
    if (globalState.anyRunning) {
      runAllBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pausar todos';
    } else if (globalState.allCompleted) {
      runAllBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Rodar novamente';
    } else {
      runAllBtn.innerHTML = '<i class="fa-solid fa-play"></i> Rodar todos';
    }

    track.innerHTML = pivotsCompact.map((pivot) => {
      const runtime = getRuntime(pivot.id);
      const status = getCardStatus(runtime);

      return `
        <article class="map-simcard ${runtime.isRunning ? "is-running" : ""}" data-sim-pivot="${pivot.id}" data-mode="${runtime.mode}">
          <div class="map-simcard__title">
            <span class="map-simcard__name">${pivot.name}</span>
            <span class="map-simcard__status ${status.className}">${status.text}</span>
          </div>

          <label class="map-simcard__field">
            <span class="map-simcard__label">Modo da simulacao</span>
            <select class="map-simcard__select" id="mapSimMode-${pivot.id}" name="mapSimMode-${pivot.id}" data-sim-mode="${pivot.id}">
              <option value="irrigating" ${runtime.mode === "irrigating" ? "selected" : ""}>Irrigacao normal</option>
              <option value="dry_irrigation" ${runtime.mode === "dry_irrigation" ? "selected" : ""}>Irrigacao a seco</option>
              <option value="fertigation" ${runtime.mode === "fertigation" ? "selected" : ""}>Fertirrigacao</option>
            </select>
          </label>
        </article>
      `;
    }).join("");
    return;

    const pivots = collectPivots(farm);
    if (!pivots.length) {
      track.innerHTML = '<div class="map-simbar__empty">Crie pivôs na fazenda ativa para começar a simulacao.</div>';
      return;
    }

    track.innerHTML = pivots.map((pivot) => {
      const runtime = getRuntime(pivot.id);
      const modeMeta = MODES[runtime.mode] || MODES.irrigating;
      const status = getCardStatus(runtime);
      const progress = Math.max(0, Math.min(100, Number(runtime.progress) || 0));
      const angle = Math.round((progress / 100) * 360);
      const playLabel = runtime.isRunning ? "Pausar" : progress > 0 && progress < 100 ? "Retomar" : "Play";

      return `
        <article class="map-simcard ${runtime.isRunning ? "is-running" : ""}" data-sim-pivot="${pivot.id}" data-mode="${runtime.mode}" style="--sim-progress:${progress}%;">
          <div class="map-simcard__top">
            <div class="map-simcard__title">
              <span class="map-simcard__name">${pivot.name}</span>
              <span class="map-simcard__meta"><span>Angulo atual</span> ${angle}<span>° de 360°</span></span>
            </div>
            <span class="map-simcard__status ${status.className}">${status.text}</span>
          </div>

          <label class="map-simcard__field">
            <span class="map-simcard__label">Modo da simulacao</span>
            <select class="map-simcard__select" id="mapSimMode-${pivot.id}" name="mapSimMode-${pivot.id}" data-sim-mode="${pivot.id}">
              <option value="irrigating" ${runtime.mode === "irrigating" ? "selected" : ""}>Irrigacao normal</option>
              <option value="dry_irrigation" ${runtime.mode === "dry_irrigation" ? "selected" : ""}>Irrigacao a seco</option>
              <option value="fertigation" ${runtime.mode === "fertigation" ? "selected" : ""}>Fertirrigacao</option>
            </select>
          </label>

          <div class="map-simcard__field">
            <div class="map-simcard__progress-meta">
              <span>${modeMeta.label}</span>
              <strong>${progress.toFixed(1)}%</strong>
            </div>
            <div class="map-simcard__progress-rail">
              <span class="map-simcard__progress-fill"></span>
            </div>
          </div>

          <div class="map-simcard__actions">
            <button class="map-simcard__btn map-simcard__btn--play ${runtime.isRunning ? "is-running" : ""}" type="button" data-sim-play="${pivot.id}">
              <i class="fa-solid ${runtime.isRunning ? "fa-pause" : "fa-play"}"></i>
              ${playLabel}
            </button>
            <button class="map-simcard__btn map-simcard__btn--stop" type="button" data-sim-stop="${pivot.id}">
              <i class="fa-solid fa-rotate-left"></i>
              Zerar
            </button>
          </div>
        </article>
      `;
    }).join("");
  };

  toggle.addEventListener("click", () => {
    const isCollapsed = bar.classList.toggle("is-collapsed");
    toggle.setAttribute("aria-expanded", String(!isCollapsed));
    body.setAttribute("aria-hidden", String(isCollapsed));
  });

  track.addEventListener("change", (event) => {
    const select = event.target.closest("[data-sim-mode]");
    if (!select) return;
    const pivotId = select.getAttribute("data-sim-mode");
    const runtime = getRuntime(pivotId);
    runtime.mode = select.value in MODES ? select.value : "irrigating";
    renderCards();
    rerenderMap();
  });

  runAllBtn.addEventListener("click", () => {
    const farm = getActiveFarm();
    const pivots = collectPivots(farm);
    if (!pivots.length) return;

    const { anyRunning, allCompleted } = getGlobalRunState(pivots);
    pivots.forEach((pivot) => {
      const runtime = getRuntime(pivot.id);
      if (anyRunning) {
        runtime.isRunning = false;
        return;
      }

      if (allCompleted || (runtime.progress || 0) >= 100) {
        runtime.progress = 0;
      }
      runtime.isRunning = true;
    });

    renderCards();
    rerenderMap();
  });

  track.addEventListener("click", (event) => {
    const playBtn = event.target.closest("[data-sim-play]");
    if (playBtn) {
      const pivotId = playBtn.getAttribute("data-sim-play");
      const runtime = getRuntime(pivotId);
      if ((runtime.progress || 0) >= 100) {
        runtime.progress = 0;
      }
      runtime.isRunning = !runtime.isRunning;
      renderCards();
      rerenderMap();
      return;
    }

    const stopBtn = event.target.closest("[data-sim-stop]");
    if (!stopBtn) return;
    const pivotId = stopBtn.getAttribute("data-sim-stop");
    const runtime = getRuntime(pivotId);
    runtime.isRunning = false;
    runtime.progress = 0;
    renderCards();
    rerenderMap();
  });

  setInterval(() => {
    const store = getStore();
    let shouldRender = false;
    Object.values(store.states).forEach((runtime) => {
      if (!runtime?.isRunning) return;
      runtime.progress = Math.min(100, (Number(runtime.progress) || 0) + PROGRESS_STEP);
      if (runtime.progress >= 100) {
        runtime.progress = 100;
        runtime.isRunning = false;
      }
      shouldRender = true;
    });

    const activeFarmId = String(getActiveFarm()?.id || "");
    if (store.activeFarmId !== activeFarmId) {
      shouldRender = true;
    }

    if (!shouldRender) return;
    renderCards();
    rerenderMap();
  }, TICK_MS);

  window.IcMapSimulation = {
    refresh() {
      renderCards();
    },
    rerenderMap,
    getState(pivotId) {
      return getRuntime(pivotId);
    },
    stopAll() {
      const store = getStore();
      Object.values(store.states).forEach((runtime) => {
        runtime.isRunning = false;
        runtime.progress = 0;
      });
      renderCards();
      rerenderMap();
    }
  };

  renderCards();
})();

(function initMapCard() {
  const toggles = document.querySelectorAll(".map-card__item--toggle");
  if (!toggles.length) return;

  toggles.forEach(toggle => {
    toggle.addEventListener("click", () => {
      const panelId = toggle.dataset.panel;
      const panel = document.querySelector(`.map-card__panel[data-panel="${panelId}"]`);
      if (!panel) return;

      const isOpen = panel.classList.toggle("is-open");
      toggle.classList.toggle("is-open", isOpen);
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      panel.setAttribute("aria-hidden", isOpen ? "false" : "true");
      window.IcMapSidebarLayoutSync?.();
    });
  });
})();

(function initMapCardStatusCounts() {
  const CATEGORIES = ["pivos", "bombas", "medidores", "pluviometros", "repetidoras", "carreteis", "linestars", "estacoes", "cosmofields"];

  const MODULE_BADGE = {
    online: { cls: "map-card__equip-badge--success" },
    offline: { cls: "map-card__equip-badge--neutral" }
  };

  const PIVOT_SHORT_LABEL = {
    painel_energizado: "Stand-By",
    irrigando: "Irrigando",
    movendo_a_seco: "Seco",
    irrigacao_finalizada: "Finalizado",
    painel_desligado: "Desligado",
    preparando_irrigar: "Preparando",
    alerta: "Alerta",
    desligado_sem_internet: "Sem internet",
    ferti_irrigando: "Ferti"
  };

  const BADGE_ORDER = [
    "map-card__equip-badge--danger",
    "map-card__equip-badge--info",
    "map-card__equip-badge--brown",
    "map-card__equip-badge--ferti",
    "map-card__equip-badge--complete",
    "map-card__equip-badge--success",
    "map-card__equip-badge--warn",
    "map-card__equip-badge--neutral"
  ];

  function getActiveFarm() {
    return window.IcFarmGetActive?.() || window.IcFarmActive || null;
  }

  function addToGroups(groups, cls, label) {
    const key = `${cls}|${label}`;
    if (!groups[key]) groups[key] = { cls, label, count: 0 };
    groups[key].count++;
  }

  const BADGE_VISIBLE_LIMIT = 3;

  function buildBadgesHtml(groups) {
    // Ponto único onde todos os rótulos de contagem viram HTML: traduzir
    // aqui cobre pivôs, bombas, medidores e Cosmofield de uma vez. Eles são
    // escritos em innerHTML, fora da varredura do DOM feita pelo i18n.
    const tBadge = (text) => window.IcI18n?.t?.(text) ?? text;
    const entries = Object.values(groups);
    const ordered = BADGE_ORDER.flatMap((cls) => entries.filter((group) => group.cls === cls));
    const visible = ordered.slice(0, BADGE_VISIBLE_LIMIT);
    const hidden = ordered.slice(BADGE_VISIBLE_LIMIT);
    const visibleHtml = visible
      .map((group) => `<span class="map-card__equip-badge ${group.cls}">${group.count} ${tBadge(group.label)}</span>`)
      .join("");
    if (!hidden.length) return visibleHtml;
    const tooltip = hidden.map((g) => `${g.count} ${tBadge(g.label)}`).join(", ");
    const overflowHtml = `<span class="map-card__equip-badge map-card__equip-badge--overflow" title="${tooltip}">+${hidden.length}</span>`;
    return visibleHtml + overflowHtml;
  }

  function updateCounts() {
    const farm = getActiveFarm();
    const equipments = Array.isArray(farm?.equipments) ? farm.equipments : [];

    CATEGORIES.forEach((cat) => {
      const toggle = document.querySelector(`.map-card__item--toggle[data-panel="${cat}"]`);
      if (!toggle) return;

      let catEquips = equipments.filter((equip) => equip?.category === cat);
      if (cat === "carreteis") {
        catEquips = equipments.filter((equip) => equip?.category === "carreteis" && equip?.type !== "linestar");
      }
      if (cat === "linestars") {
        catEquips = equipments.filter((equip) => equip?.category === "carreteis" && equip?.type === "linestar");
      }
      if (cat === "pivos" && farm) {
        const equipIds = new Set(equipments.map((equip) => equip.id));
        (farm.pivos || []).forEach((pivo) => {
          if (!equipIds.has(pivo.id)) catEquips.push(pivo);
        });
      }

      let countsEl = toggle.querySelector(".map-card__toggle-counts");
      if (!countsEl) {
        countsEl = document.createElement("span");
        countsEl.className = "map-card__toggle-counts";
        const chevron = toggle.querySelector("i");
        if (chevron) toggle.insertBefore(countsEl, chevron);
        else toggle.appendChild(countsEl);
      }

      if (!catEquips.length) {
        countsEl.innerHTML = "";
        return;
      }

      // Modo Conectividade: só um resumo de "Sem comunicação" por categoria.
      if (document.body.classList.contains("is-conectividade")) {
        const off = window.IcConnectivityCategoryOffline?.(cat) || 0;
        const tBadge = (text) => window.IcI18n?.t?.(text) ?? text;
        countsEl.innerHTML = off
          ? `<span class="map-card__equip-badge map-card__equip-badge--danger">${off} ${tBadge("Sem comunicação")}</span>`
          : "";
        return;
      }

      // Repetidoras não exibem badges de status na lista
      if (cat === "repetidoras") {
        countsEl.innerHTML = "";
        return;
      }

      // Estação meteorológica: só online/offline conforme o status real
      // (data.status / data.semComunicacao). Não faz parte da IrriMesh, então
      // não herda o fallback genérico de "Offline".
      if (cat === "estacoes") {
        const tBadge = (text) => window.IcI18n?.t?.(text) ?? text;
        let offline = 0;
        catEquips.forEach((equip) => {
          const s = String(equip?.data?.status || "").toLowerCase();
          if (equip?.data?.semComunicacao === true || s === "offline") offline += 1;
        });
        countsEl.innerHTML = offline
          ? `<span class="map-card__equip-badge map-card__equip-badge--danger">${offline} ${tBadge("Offline")}</span>`
          : "";
        return;
      }

      const groups = {};
      catEquips.forEach((equip) => {
        if (cat === "pivos" || cat === "linestars") {
          const resolved = window.IcResolvePivotStatus?.(equip);
          const cls = resolved?.badgeClass || "map-card__equip-badge--warn";
          const label = PIVOT_SHORT_LABEL[resolved?.key] || resolved?.label || "Stand-By";
          addToGroups(groups, cls, label);
          return;
        }

        if (cat === "carreteis") {
          const st = window.IcResolveRainstarStatus?.(equip) || { badgeClass: "map-card__equip-badge--warn", shortLabel: "Stand-By" };
          addToGroups(groups, st.badgeClass, st.shortLabel || st.label || "Stand-By");
          return;
        }

        if (cat === "bombas") {
          const status = window.IcResolveBombaStatus?.(equip) || { badgeClass: "map-card__equip-badge--warn" };
          addToGroups(groups, status.badgeClass, status.label || "Desligada");
          return;
        }

        if (cat === "medidores") {
          const st = window.IcResolveMdnStatus?.(equip)
            || { key: "normal", badgeClass: "map-card__equip-badge--success" };
          addToGroups(groups, st.badgeClass, st.label || "Nível normal");
          return;
        }

        if (cat === "cosmofields") {
          // Agrupa pelo estado da irrigação, não por online/offline: o que
          // importa numa sonda é se o solo já pede água.
          const reading = window.IcCosmofieldReading?.(equip, catEquips.indexOf(equip));
          // Alerta: água abaixo do gatilho, sem comunicação ou bateria baixa.
          // Atenção: abaixo de 50% da faixa. Regras em IcCosmofieldReading.
          const meta = reading?.status === "alert"
            ? { cls: "map-card__equip-badge--danger", label: "Alerta" }
            : (reading?.status === "attention"
              ? { cls: "map-card__equip-badge--warn", label: "Atenção" }
              : { cls: "map-card__equip-badge--success", label: "Adequado" });
          addToGroups(groups, meta.cls, meta.label);
          return;
        }

        const modules = equip?.data?.modules;
        if (Array.isArray(modules) && modules.length) {
          modules.forEach((moduleItem) => {
            const meta = MODULE_BADGE[moduleItem?.status] || {
              cls: "map-card__equip-badge--warn",
              label: "Desconhecido"
            };
            addToGroups(groups, meta.cls, meta.label);
          });
          return;
        }

        addToGroups(groups, "map-card__equip-badge--neutral", "Offline");
      });

      const forceCarousel = cat === "cosmofields" && Object.keys(groups).length > 1;
      applyCountsCarousel(countsEl, groups, { force: forceCarousel, uppercase: cat === "cosmofields" });
    });
  }

  // Monta os badges num "trilho" que roda em loop quando não cabem. A máscara
  // (CSS) faz o badge desaparecer atrás do rótulo da categoria.
  function applyCountsCarousel(countsEl, groups, options = {}) {
    if (!countsEl) return;
    countsEl.classList.remove("is-scrolling");
    countsEl.style.removeProperty("--marquee-dur");

    const tBadge = (text) => window.IcI18n?.t?.(text) ?? text;
    const ordered = Object.values(groups).sort((a, b) => b.count - a.count);
    if (!ordered.length) { countsEl.innerHTML = ""; return; }

    const badgeHtml = ordered
      .map((g) => `<span class="map-card__equip-badge ${g.cls}${options.uppercase ? " is-caps" : ""}">${g.count} ${tBadge(g.label)}</span>`)
      .join("");
    countsEl.innerHTML = `<span class="map-card__toggle-counts-track">${badgeHtml}</span>`;
    const track = countsEl.firstElementChild;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!track) return;
        const oneSetWidth = track.scrollWidth;
        const containerWidth = countsEl.clientWidth;
        const shouldScroll = options.force || (oneSetWidth > containerWidth + 2 && containerWidth > 0);
        if (!shouldScroll) return;
        // Reconstrói o trilho com badges duplicados: animar translateX(-50%)
        // volta exatamente pro início, sem "salto".
        track.innerHTML = badgeHtml + badgeHtml;
        track.style.transform = "translateX(0)";
        track.style.willChange = "transform";
        // Remove e readiciona a classe para forçar reinício da animação CSS
        countsEl.classList.remove("is-scrolling");
        void countsEl.offsetWidth; // força reflow
        countsEl.classList.add("is-scrolling");
        const dur = Math.max(7, Math.round(oneSetWidth / 20));
        countsEl.style.setProperty("--marquee-dur", `${dur}s`);
      });
    });
  }

  window.IcMapUpdateCardStatusCounts = updateCounts;
  updateCounts();
  // Os contadores juntam número + rótulo traduzido ("2 Atenção"), que o
  // tradutor do DOM não reconhece como chave: redesenha ao trocar o idioma.
  window.addEventListener("ic:lang-change", updateCounts);
})();

(function initMapEquipBar() {
  const container = document.getElementById("mapEquip");
  if (!container) return;

  const bar = container.querySelector(".map-equip__bar");
  const panel = container.querySelector(".map-equip__panel");

  if (bar && panel) {
    bar.addEventListener("click", (e) => {
      e.stopPropagation();
      // Legenda e filtro de Equipamentos nunca abertos ao mesmo tempo.
      const legend = document.getElementById("connLegend");
      if (legend) {
        legend.classList.remove("is-open");
        legend.querySelector(".map-equip__bar")?.setAttribute("aria-expanded", "false");
      }
      const isOpen = container.classList.toggle("is-open");
      bar.setAttribute("aria-expanded", isOpen);
    });

    // Fechar ao clicar fora
    document.addEventListener("click", (e) => {
      if (!container.contains(e.target)) {
        container.classList.remove("is-open");
        bar.setAttribute("aria-expanded", "false");
      }
    });
  }

  const stopEvent = (event) => {
    if (!event) return;
    event.stopPropagation();
  };

  const bindStop = (el) => {
    if (!el) return;
    ["pointerdown", "mousedown", "touchstart", "click", "dblclick", "wheel"].forEach((evt) => {
      el.addEventListener(evt, stopEvent);
    });
  };

  bindStop(container);

  // Lógica de Filtros
  const switches = container.querySelectorAll(".map-equip__switch");

  const updateVisibility = (filterType, isVisible) => {
    // 1. Mapa
    if (window.icMap && window.icLayers && window.icLayers[filterType]) {
      const layer = window.icLayers[filterType];
      if (isVisible) {
        window.icMap.addLayer(layer);
      } else {
        window.icMap.removeLayer(layer);
      }
    }

    // 2. Sidebar (Dashboard Card)
    const sidebarItem = document.querySelector(`.map-card__item[data-panel="${filterType}"]`);
    const sidebarPanel = document.querySelector(`.map-card__panel[data-panel="${filterType}"]`);

    if (sidebarItem) sidebarItem.style.display = isVisible ? "" : "none";
    if (sidebarPanel) {
      if (!isVisible) {
        sidebarPanel.classList.remove("is-open");
        sidebarItem.classList.remove("is-open");
        sidebarItem.setAttribute("aria-expanded", "false");
        sidebarPanel.setAttribute("aria-hidden", "true");
      }
    }
  };

  switches.forEach(sw => {
    sw.addEventListener("change", (e) => {
      const type = sw.dataset.filter;
      const isChecked = sw.checked;

      if (type === "all") {
        switches.forEach(s => {
          if (s !== sw) {
            s.checked = isChecked;
            updateVisibility(s.dataset.filter, isChecked);
          }
        });
      } else {
        updateVisibility(type, isChecked);

        // Se desmarcar algum, desmarca o "Todos"
        const allSw = Array.from(switches).find(s => s.dataset.filter === "all");
        if (!isChecked && allSw) {
          allSw.checked = false;
        }
      }
    });
  });

  // Botão de Fullscreen
  const btnFs = document.getElementById("btnMapFullscreen");
  if (btnFs) {
    btnFs.addEventListener("click", (e) => {
      e.stopPropagation();
      const fsContainer = document.querySelector(".main--map") || document.documentElement;

      if (!document.fullscreenElement) {
        if (fsContainer.requestFullscreen) {
          fsContainer.requestFullscreen();
        } else if (fsContainer.webkitRequestFullscreen) {
          fsContainer.webkitRequestFullscreen();
        } else if (fsContainer.msRequestFullscreen) {
          fsContainer.msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        }
      }
    });

    document.addEventListener("fullscreenchange", () => {
      const ico = btnFs.querySelector("i");
      if (!ico) return;

      const isFs = !!document.fullscreenElement;

      if (isFs) {
        ico.classList.replace("fa-expand", "fa-compress");
      } else {
        ico.classList.replace("fa-compress", "fa-expand");
      }

      // Ocultar/Exibir elementos solicitados
      const selectors = ["#mapCard", ".pluv-mapbar", ".map-equip__bar", ".pluv-layer-card__bar", "#mapWeatherCard", "#btnWeeklySchedule"];
      selectors.forEach(sel => {
        const item = document.querySelector(sel);
        if (item) {
          item.style.display = isFs ? "none" : "";
        }
      });
    });
  }

  // --- ESTUDO DE SINAL (PNG OVERLAYS) ---
  const signalState = {
    enabled: false,
    opacity: 0.7,
    scale: 0.045, // Base 1.0x
    overlays: [],
    layerGroup: L.layerGroup()
  };

  const SIGNAL_IMAGES = [
    { name: "principal_brazil_v6_100dbm_tx5m_rx3.0m_latm12_444739_lonm45_421809.png", lat: -12.444739, lon: -45.421809 },
    { name: "repetidora_brazil_v6_100dbm_tx5m_rx3.0m_latm12_385878_lonm45_421498.png", lat: -12.385878, lon: -45.421498 },
    { name: "repetidora_brazil_v6_100dbm_tx5m_rx3.0m_latm12_405983_lonm45_462822.png", lat: -12.405983, lon: -45.462822 },
    { name: "repetidora_brazil_v6_100dbm_tx5m_rx3.0m_latm12_427024_lonm45_425307.png", lat: -12.427024, lon: -45.425307 },
    { name: "repetidora_brazil_v6_100dbm_tx5m_rx3.0m_latm12_440203_lonm45_452926.png", lat: -12.440203, lon: -45.452926 }
  ];

  function setupSignalStudyControls() {
    const btnToggle = document.getElementById("btnToggleSignal");
    const panel = document.getElementById("mapSignalPanel");
    const btnClose = document.getElementById("btnCloseSignalPanel");
    const chkEnable = document.getElementById("chkEnableSignal");
    const rangeOpacity = document.getElementById("rangeSignalOpacity");
    const opacityVal = document.getElementById("signalOpacityValue");

    if (!btnToggle || !panel) return;

    // Impedir que cliques e arrastos no painel movam o mapa
    L.DomEvent.disableClickPropagation(panel);
    L.DomEvent.disableScrollPropagation(panel);
    L.DomEvent.on(panel, 'mousedown touchstart dblclick mousewheel', L.DomEvent.stopPropagation);

    btnToggle.addEventListener("click", () => {
      panel.classList.toggle("is-visible");
      const isVisible = panel.classList.contains("is-visible");
      panel.setAttribute("aria-hidden", !isVisible);
    });

    btnClose.addEventListener("click", () => {
      panel.classList.remove("is-visible");
      panel.setAttribute("aria-hidden", "true");
    });

    chkEnable.addEventListener("change", (e) => {
      signalState.enabled = e.target.checked;
      if (signalState.enabled) {
        if (SIGNAL_IMAGES.length > 0) {
          const first = SIGNAL_IMAGES[0];
          if (window.icMap) {
            window.icMap.flyTo([first.lat, first.lon], 14, { duration: 1.5 });
            signalState.layerGroup.addTo(window.icMap);
          }
        }
      } else {
        signalState.layerGroup.remove();
      }
    });

    rangeOpacity.addEventListener("input", (e) => {
      const val = e.target.value;
      const opacity = val / 100;
      signalState.opacity = opacity;
      if (opacityVal) opacityVal.textContent = `${val}%`;
      signalState.overlays.forEach(ov => ov.setOpacity(opacity));
    });

    // Controle de Visibilidade por Rota
    const mapSignalControl = document.getElementById("mapSignalControl");
    const handleRouteVisibility = (event) => {
      const activeNav = document.querySelector('.nav__item.is-active');
      const route = event?.detail?.route || activeNav?.getAttribute("data-route");
      
      if (mapSignalControl) {
        if (route === "conectividade") {
          mapSignalControl.classList.remove("is-hidden");
        } else {
          mapSignalControl.classList.add("is-hidden");
          panel.classList.remove("is-visible");
          
          // DESATIVAR ESTUDO DE SINAL AO SAIR
          if (signalState.enabled) {
            signalState.enabled = false;
            chkEnable.checked = false;
            signalState.layerGroup.remove();
          }
        }
      }
    };

    // Monitora Cliques no Menu
    document.querySelectorAll(".nav__item").forEach(item => {
      item.addEventListener("click", () => {
        // Pequeno delay para garantir que a classe 'is-active' foi aplicada
        setTimeout(handleRouteVisibility, 50);
      });
    });

    window.addEventListener("ic:route-change", handleRouteVisibility);

    // Estado inicial
    handleRouteVisibility();

    // Criar uma Pane especial para o sinal ficar por baixo de tudo (menos os tiles)
    if (window.icMap && !window.icMap.getPane('signalStudyPane')) {
      const pane = window.icMap.createPane('signalStudyPane');
      pane.style.zIndex = 350; // Abaixo dos overlays padrão (400) e marcadores (600)
      pane.style.pointerEvents = 'none';
    }

    // Configuração do Ícone CloudRF
    const cloudRfIcon = L.icon({
      iconUrl: './assets/img/estudo-de-sinal/cloudrf.png',
      iconSize: [28, 28], // Um pouco menor
      iconAnchor: [14, 14],
    });

    // Init Overlays e Marcadores
    const factor = 1.5;
    const baseSize = 0.045;
    const initialSize = baseSize * factor;
    signalState.scale = initialSize;

    SIGNAL_IMAGES.forEach(img => {
      // 1. Criar a Mancha de Sinal (PNG) - Agora usando a Pane inferior
      const bounds = [
        [img.lat - initialSize, img.lon - initialSize],
        [img.lat + initialSize, img.lon + initialSize]
      ];
      const imageUrl = `./assets/img/estudo-de-sinal/${img.name}`;
      const overlay = L.imageOverlay(imageUrl, bounds, {
        opacity: signalState.opacity,
        interactive: false,
        pane: 'signalStudyPane' // <<--- MÁGICA AQUI
      });
      signalState.overlays.push(overlay);
      signalState.layerGroup.addLayer(overlay);

      // 2. Criar o Marcador do Centro (Torre) - Este continua por cima
      const marker = L.marker([img.lat, img.lon], {
        icon: cloudRfIcon,
        interactive: false,
        zIndexOffset: 1000 
      });
      signalState.layerGroup.addLayer(marker);
    });
  }

  setupSignalStudyControls();

})();
