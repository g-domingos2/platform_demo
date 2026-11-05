// assets/js/pages/estacoes/view.details.js
// Tela de detalhe da Estação Meteorológica — no padrão da tela de detalhe do
// pivô (.pivos-view > .pincard > .pivo-agenda > .pivo-bottom-row). Sem herança
// do Medidor de Nível.
//
// Dados: o dia atual vem da leitura da estação física (equip.data.current);
// a previsão e o histórico por dia vêm da API Open-Meteo, com cache em
// localStorage (busca 1x por hora por coordenada) — a tela pinta na hora com
// data.current e a previsão preenche depois.
(function () {
  "use strict";

  const Est = (window.Est = window.Est || {});
  const state = (Est.state = Est.state || {});
  const views = (Est.views = Est.views || {});
  const detailsView = (views.details = views.details || {});
  const $ = (id) => document.getElementById(id);

  let minimapInstance = null;
  let minimapMarker = null;
  let detailsEventsBound = false;
  let onDocClickDetails = null;
  let forecastReqSeq = 0;
  const edit = {};

  // Cache do HTML da tela — o fetch só acontece uma vez; reaberturas são
  // instantâneas. Pré-carrega em idle time.
  const TEMPLATE_URL = "./pages/estacao-meteorologica.html";
  let templatePromise = null;
  function loadTemplate() {
    if (!templatePromise) {
      templatePromise = fetch(TEMPLATE_URL)
        .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
        .catch((err) => { templatePromise = null; throw err; });
    }
    return templatePromise;
  }
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => loadTemplate().catch(() => {}), { timeout: 1500 });
  } else {
    setTimeout(() => loadTemplate().catch(() => {}), 1500);
  }

  const { getActiveFarmSafe, getFarmEquipmentsSafe, isWeatherStationEquipment } = window.IcFarm;
  const { toNumber, parseLatLngText, setText, formatLastUpdate } = window.IcEquipUtils;
  const { pinIcon } = window.IcMapIcons;

  // Ícone padrão de evapotranspiração (ETo) — usado em toda a plataforma:
  // planta brotando + ondas de vapor + linha do solo.
  const ETO_ICON = window.IcEtoIcon || '<svg class="ic-eto-icon" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3c-.6.7-.6 1.6 0 2.3s.6 1.6 0 2.3"/><path d="M11.7 3c-.6.7-.6 1.6 0 2.3s.6 1.6 0 2.3"/><path d="M15.4 3c-.6.7-.6 1.6 0 2.3s.6 1.6 0 2.3"/><path d="M12 19.5c-.2-3 1.3-5.8 4.8-6.4.2 3-1.3 5.8-4.8 6.4Z"/><path d="M12 19.5c.1-2.5-1.2-4.6-3.9-5-.1 2.5 1.2 4.6 3.9 5Z"/><path d="M12 19.5V15"/><path d="M4 19.5h16"/><path d="M9 22h6"/></svg>';

  // ─── Formatação ──────────────────────────────────────────────────────────

  const num = (v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const f1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : "--");
  const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : "--");
  const f0 = (v) => (Number.isFinite(v) ? String(Math.round(v)) : "--");
  const tC = (v) => (Number.isFinite(v) ? `${f1(v)} °C` : "—");
  const tPct = (v) => (Number.isFinite(v) ? `${f0(v)} %` : "—");
  const tMs = (v) => (Number.isFinite(v) ? `${f1(v)} m/s` : "—");
  const tMm = (v, d = 1) => (Number.isFinite(v) ? `${v.toFixed(d)} mm` : "—");
  const tWm2 = (v) => (Number.isFinite(v) ? `${f0(v)} W/m²` : "—");
  const tMJ = (v) => (Number.isFinite(v) ? `${f1(v)} MJ/m²` : "—");
  const tHpa = (v) => (Number.isFinite(v) ? `${f1(v)} hPa` : "—");
  const tLux = (v) => (Number.isFinite(v) ? new Intl.NumberFormat("pt-BR").format(Math.round(v)) + " lux" : "—");

  function windDirText(deg, name) {
    if (name && typeof name === "string") {
      return Number.isFinite(deg) ? `${name} (${f0(deg)}°)` : name;
    }
    if (!Number.isFinite(deg)) return "—";
    const dirs = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"];
    return `${dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8]} (${f0(deg)}°)`;
  }

  function fmtDayShort(iso) {
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }
  function fmtWeekday(iso) {
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return "";
    const s = d.toLocaleDateString(window.IcI18n?.getLocale?.() || "pt-BR", { weekday: "long" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function fmtDateFull(iso) {
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR");
  }

  // ─── Equipamentos ────────────────────────────────────────────────────────

  function getEstacoesList() {
    return getFarmEquipmentsSafe(getActiveFarmSafe()).filter(isWeatherStationEquipment);
  }
  function getFocusEst() {
    const list = getEstacoesList();
    if (!list.length) return null;
    if (state.detailsFocusId) {
      return list.find((m) => String(m.id) === String(state.detailsFocusId)) || list[0];
    }
    return list[0];
  }

  function normalizeEst(equip) {
    const data = equip?.data || {};
    const name = equip?.name || data.name || data.nome || "Estação";
    const id = equip?.id || name;
    const lat = toNumber(data.lat);
    const lng = toNumber(data.lng);
    const center =
      Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : parseLatLngText(data.loc);
    const status = String(data.status || "").toLowerCase();
    const offline = data.semComunicacao === true || status === "offline";
    const updated = data.updated || equip?.updatedAt || equip?.createdAt || "";
    const current = (data.current && typeof data.current === "object") ? data.current : null;
    return {
      id, name, center, offline, updated, current,
      lat, lng,
      provider: data.provider || "davis",
      davisId: data.davisId || data.davis_id || data.identificacaoDavis || "",
      stationId: data.stationId || data.station_id || data.idEstacao || "",
      apiKey: data.apiKey || data.api_key || data.chaveApi || "",
      apiSecret: data.apiSecret || data.api_secret || data.segredoApi || "",
    };
  }

  // ─── API Open-Meteo (cache-first) ───────────────────────────────────────

  const WEATHER_CACHE_KEY = "ic_estd_weather_cache_v2";
  const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

  function buildUrl(lat, lng) {
    const p = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      current: "temperature_2m,relative_humidity_2m,dew_point_2m,surface_pressure,precipitation,wind_speed_10m,wind_gusts_10m,wind_direction_10m,shortwave_radiation,uv_index",
      daily: "et0_fao_evapotranspiration,precipitation_sum,temperature_2m_max,temperature_2m_min,temperature_2m_mean,relative_humidity_2m_mean,shortwave_radiation_sum,wind_speed_10m_max,wind_direction_10m_dominant,uv_index_max",
      timezone: "America/Sao_Paulo",
      wind_speed_unit: "ms",
      past_days: "31",
      forecast_days: "7",
    });
    return `https://api.open-meteo.com/v1/forecast?${p.toString()}`;
  }

  function readCache(key) {
    try {
      const all = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) || "{}");
      const hit = all[key];
      if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;
    } catch (_) {}
    return null;
  }
  function writeCache(key, data) {
    try {
      const all = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) || "{}");
      all[key] = { at: Date.now(), data };
      localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(all));
    } catch (_) {}
  }

  // Séries plausíveis para quando a API não responde (offline / ambiente sem
  // rede). Determinístico por coordenada — a tela nunca fica "Carregando…".
  function mockWeather(lat, lng, current) {
    let seed = Math.abs(Math.round((lat * 1000 + lng * 1000)));
    const rng = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    const baseTemp = Number.isFinite(Number(current?.tempMean)) ? Number(current.tempMean) : 26;
    const days = [];
    const start = new Date();
    start.setDate(start.getDate() - 31);
    for (let i = 0; i < 38; i++) {
      const d = new Date(start.getTime() + i * 86400000);
      const iso = d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const tMean = baseTemp + (rng() - 0.5) * 6;
      const rain = rng() < 0.7 ? 0 : Math.round(rng() * 220) / 10;
      days.push({
        date: iso,
        eto: Math.round((3.5 + rng() * 3.5) * 100) / 100,
        precip: rain,
        tempMax: Math.round((tMean + 5 + rng() * 3) * 10) / 10,
        tempMin: Math.round((tMean - 6 - rng() * 2) * 10) / 10,
        tempMean: Math.round(tMean * 10) / 10,
        rhMean: Math.round(45 + rng() * 45),
        radiation: Math.round((15 + rng() * 12) * 10) / 10,
        windMax: Math.round((2 + rng() * 5) * 10) / 10,
        windDir: Math.round(rng() * 360),
        uvMax: Math.round((5 + rng() * 6) * 10) / 10,
      });
    }
    return { days, current: {}, _mock: true };
  }

  async function fetchWeather(lat, lng, currentReading) {
    const key = `${lat.toFixed(4)}|${lng.toFixed(4)}`;
    const cached = readCache(key);
    if (cached) return cached;
    let json;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3500);
      const res = await fetch(buildUrl(lat, lng), { method: "GET", signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      json = await res.json();
    } catch (err) {
      console.warn("[estdetails] Open-Meteo indisponível — usando série mockada.", err);
      const mock = mockWeather(lat, lng, currentReading);
      // cache curto pro mock: revalida da API na próxima abertura
      try {
        const all = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) || "{}");
        all[key] = { at: Date.now() - CACHE_TTL_MS + 5 * 60 * 1000, data: mock };
        localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(all));
      } catch (_) {}
      return mock;
    }
    const daily = json?.daily || {};
    const time = Array.isArray(daily.time) ? daily.time : [];
    const days = time.map((date, i) => ({
      date,
      eto: num(daily.et0_fao_evapotranspiration?.[i]),
      precip: num(daily.precipitation_sum?.[i]),
      tempMax: num(daily.temperature_2m_max?.[i]),
      tempMin: num(daily.temperature_2m_min?.[i]),
      tempMean: num(daily.temperature_2m_mean?.[i]),
      rhMean: num(daily.relative_humidity_2m_mean?.[i]),
      radiation: num(daily.shortwave_radiation_sum?.[i]),
      windMax: num(daily.wind_speed_10m_max?.[i]),
      windDir: num(daily.wind_direction_10m_dominant?.[i]),
      uvMax: num(daily.uv_index_max?.[i]),
    }));
    const c = json?.current || {};
    const current = {
      temperature: num(c.temperature_2m),
      humidity: num(c.relative_humidity_2m),
      dewPoint: num(c.dew_point_2m),
      pressure: num(c.surface_pressure),
      precipitation: num(c.precipitation),
      windSpeed: num(c.wind_speed_10m),
      windGust: num(c.wind_gusts_10m),
      windDir: num(c.wind_direction_10m),
      solarRadiation: num(c.shortwave_radiation),
      uvIndex: num(c.uv_index),
    };
    const out = { days, current, todayIso: json?.daily?.time?.find((d) => d === json?.current?.time?.slice(0, 10)) || null };
    writeCache(key, out);
    return out;
  }

  // Dias do período selecionado: até hoje, N dias para trás.
  function periodDays() {
    const map = { "7d": 7, "15d": 15, "30d": 30 };
    return map[state._period] || 7;
  }
  function forecastForPeriod() {
    const fc = state._forecast;
    if (!fc || !Array.isArray(fc.days)) return { history: [], forecast: [] };
    const todayIdx = fc.days.findIndex((d) => d.date === todayIsoSp());
    const cut = todayIdx >= 0 ? todayIdx : fc.days.length - 8;
    const n = periodDays();
    return {
      history: fc.days.slice(Math.max(0, cut - n + 1), cut + 1),
      forecast: fc.days.slice(cut, cut + 6),
    };
  }
  function todayIsoSp() {
    return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  }

  // ─── Ciclo de vida ───────────────────────────────────────────────────────

  async function showDetailsView(options = {}) {
    const estId = options.estId ?? null;
    const tab = options.tab === "general" ? "general" : options.tab === "history" ? "history" : "config";
    const previousFocusId = state.detailsFocusId || null;
    if (estId) state.detailsFocusId = estId;
    if (!state._period) state._period = "7d";

    // Se já estiver aberto no mesmo equipamento, só re-renderiza
    const existingOverlay = $("estdEditOverlay");
    if (existingOverlay) {
      if (estId && String(previousFocusId) !== String(estId)) {
        state._forecast = null;
      }
      renderDetails();
      populateSelector();
      loadForecast();
      activateTab(tab);
      existingOverlay.querySelector("#estdPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    // Cancela uma remoção ainda pendente da última vez que o painel foi fechado
    if (edit._overlayRemoveTimer) {
      clearTimeout(edit._overlayRemoveTimer);
      edit._overlayRemoveTimer = null;
    }

    window.icMapSetWheelMode?.("ctrl");
    unbindDetailsEvents();

    // Cria (ou reutiliza) o overlay que desliza da direita, igual ao padrão config/faturamento
    let overlay = $("estdEditOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "estdEditOverlay";
      overlay.className = "config-overlay";
      overlay.style.zIndex = 1200 + document.querySelectorAll(".config-overlay").length;
      document.body.appendChild(overlay);
    }
    const positionOverlay = window.IcOverlay?.positionOverlay;
    if (positionOverlay) positionOverlay(overlay);

    // Reposiciona se a sidebar colapsar/expandir
    edit._resizeObserver?.disconnect();
    const mainEl = document.querySelector(".main");
    if (mainEl && typeof ResizeObserver === "function") {
      edit._resizeObserver = new ResizeObserver(() => {
        if (positionOverlay) positionOverlay(overlay);
      });
      edit._resizeObserver.observe(mainEl);
    }

    let html;
    try {
      html = await loadTemplate();
    } catch (err) {
      console.error("[estdetails] Falha ao carregar estacao-meteorologica.html", err);
      edit._resizeObserver?.disconnect();
      edit._resizeObserver = null;
      overlay.remove();
      window.icMapSetWheelMode?.("free");
      return;
    }

    overlay.innerHTML = `<div class="config-page">${html}</div>`;

    bindDetailsEvents();
    renderDetails();
    populateSelector();
    activateTab(tab);
    window.dispatchEvent(new Event("ic:layout-change"));

    // Se já há previsão em cache para esta coordenada, renderiza síncrono
    const d0 = getFocusEst() ? normalizeEst(getFocusEst()) : null;
    if (d0 && d0.center) {
      const key = `${Number(d0.center.lat).toFixed(4)}|${Number(d0.center.lng).toFixed(4)}`;
      const cached = readCache(key);
      if (cached) {
        state._forecast = cached;
        renderForecast();
        renderDetails();
      }
    }
    loadForecast();

    // Anima a entrada (slide da direita)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => overlay.classList.add("is-open"));
    });

    setTimeout(() => overlay.querySelector("#estdPanel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);

    const map = window.icMap;
    if (map && typeof map.invalidateSize === "function") {
      map.invalidateSize({ pan: false });
      requestAnimationFrame(() => map.invalidateSize({ pan: false }));
      setTimeout(() => map.invalidateSize({ pan: false }), 180);
    }
  }

  function destroyDetailsView() {
    edit._resizeObserver?.disconnect();
    edit._resizeObserver = null;
    const overlay = $("estdEditOverlay");
    if (overlay) {
      overlay.classList.remove("is-open");
      clearTimeout(edit._overlayRemoveTimer);
      edit._overlayRemoveTimer = setTimeout(() => {
        edit._overlayRemoveTimer = null;
        overlay.remove();
      }, 320);
    }
    // NÃO limpa #pageSlot — a tela de detalhes continua por baixo do overlay
    document.body.classList.remove("is-farm-edit");
    state.detailsFocusId = null;
    unbindDetailsEvents();
    // Os mapas Leaflet (minimapa da Geral + mapa somente-leitura da
    // Localização) precisam ser destruídos explicitamente aqui.
    destroyMinimap();
    if (locationMapInstance) {
      try { locationMapInstance.remove(); } catch (_) {}
      locationMapInstance = null;
    }
    const mapCard = $("mapCard");
    if (mapCard) mapCard.style.display = "";
    const wCard = $("mapWeatherCard");
    if (wCard) wCard.style.display = "";
    window.icMapSetWheelMode?.("free");
    const map = window.icMap;
    if (map && typeof map.invalidateSize === "function") {
      map.invalidateSize({ pan: false });
      requestAnimationFrame(() => map.invalidateSize({ pan: false }));
      setTimeout(() => map.invalidateSize({ pan: false }), 220);
    }
    window.dispatchEvent(new Event("ic:layout-change"));
  }

  function isDetailsOpen() {
    return document.body.classList.contains("is-farm-edit") && !!$("estdPanel");
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  function renderDetails() {
    const equip = getFocusEst();
    if (!equip) return;
    const d = normalizeEst(equip);
    // A aba "Leituras" mostra SÓ o que a estação mede (data.current). Nada
    // de previsão aqui — a previsão vive na aba "Previsão do tempo".
    const c = d.current || {};

    setText("estdTitleLabel", d.name);
    setText("estdSelectBtn", d.name);
    setText("estdLastUpdate", formatLastUpdate(d.updated));
    setText("estdKpiComm", formatLastUpdate(d.updated));

    const bar = $("estdStatusBar");
    const text = $("estdStatusText");
    if (bar) {
      bar.classList.toggle("is-offline", d.offline);
      bar.classList.toggle("is-running", !d.offline);
    }
    if (text) text.textContent = d.offline ? "SEM COMUNICAÇÃO" : "MONITORANDO";

    const v = {
      eto: num(c.eto),
      rainDay: num(c.rainDay) ?? num(c.precipitation),
      temp: num(c.temperature),
      humidity: num(c.humidity),
      windSpeed: num(c.windSpeed),
      radiation: num(c.solarRadiation),
      radiationDay: num(c.solarRadiationDay),
    };

    // Indicadores do dia atual (faixa cf-stats) — só o que a estação mede
    setText("estdKpiTemp", tC(v.temp));
    setText("estdKpiHumidity", tPct(v.humidity));
    setText("estdKpiWind", tMs(v.windSpeed));
    setText("estdKpiRadiation", Number.isFinite(v.radiation) ? tWm2(v.radiation) : tMJ(v.radiationDay));
    setText("estdKpiEto", tMm(v.eto, 2));
    setText("estdKpiRainDay", tMm(v.rainDay, 1));

    ensureHourly(d);
    renderChart();
    renderRawTable();
  }

  // ─── Série horária (mock determinístico) ─────────────────────────────────
  //
  // O mock não guarda histórico da estação — geramos uma série horária
  // plausível e determinística por estação (mesma ideia do Cosmofield), com
  // 30 dias de leituras terminando na última comunicação. A leitura mais
  // recente casa com data.current.

  const RAW_PAGE_SIZE = 15;
  const HOURLY_DAYS = 30;

  function ensureHourly(d) {
    const sig = `${d.id}|${d.updated}`;
    if (state._hourlySig === sig && Array.isArray(state._hourly)) return;

    const c = d.current || {};
    const base = {
      temp: num(c.temperature) ?? 26,
      humidity: num(c.humidity) ?? 55,
      wind: num(c.windSpeed) ?? 3,
      radiationPeak: num(c.solarRadiation) ?? 650,
      etoDay: num(c.eto) ?? 5,
      battery: 12.7,
    };
    let seed = 0;
    for (const ch of sig) seed = (seed * 31 + ch.charCodeAt(0)) % 2147483647;
    const rng = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

    const end = new Date(d.updated || Date.now());
    end.setMinutes(0, 0, 0);
    const rows = [];
    const total = HOURLY_DAYS * 24;

    // Chuva vem em pancadas de algumas horas, não em horas isoladas. Um
    // temporal começa de vez em quando e dura ~2–7h, com intensidade que
    // sobe e desce. Fora disso, seco.
    let stormLeft = 0;   // horas restantes da pancada atual
    let stormLen = 0;    // duração total da pancada
    let stormPeak = 0;   // mm/h no pico

    for (let i = total - 1; i >= 0; i--) {
      const t = new Date(end.getTime() - i * 3600000);
      const hour = t.getHours();
      const dayPhase = Math.sin(((hour - 9) / 24) * 2 * Math.PI); // pico ~15h
      const isRecent = i === 0;

      // O dia corrente fica seco — combina com a leitura atual da estação
      // (Chuva hoje = 0). As pancadas ficam no histórico.
      let rain = 0;
      if (i >= 20) {
        if (stormLeft <= 0 && rng() < 0.018) {
          stormLen = 2 + Math.floor(rng() * 6);
          stormLeft = stormLen;
          stormPeak = 2 + rng() * 12;
        }
        if (stormLeft > 0) {
          const phase = (stormLen - stormLeft + 0.5) / stormLen; // 0→1 ao longo da pancada
          const shape = Math.sin(phase * Math.PI);               // sobe e desce
          rain = round1(Math.max(0, stormPeak * shape * (0.55 + rng() * 0.6)));
          stormLeft -= 1;
        }
      }

      rows.push({
        ts: t.toISOString(),
        temp: isRecent ? base.temp : round1(base.temp + dayPhase * 6 + (rng() - 0.5) * 2 - (rain > 0 ? 2.5 : 0)),
        humidity: isRecent ? base.humidity : clamp(round0(base.humidity - dayPhase * 22 + (rng() - 0.5) * 8 + (rain > 0 ? 22 : 0)), 8, 100),
        wind: isRecent ? base.wind : round1(Math.max(0, base.wind + Math.max(0, dayPhase) * 2.5 + (rng() - 0.5) * 1.5 + (rain > 0 ? 1.8 : 0))),
        radiation: hour >= 6 && hour <= 18 ? round0(Math.max(0, base.radiationPeak * Math.max(0, dayPhase) * (rain > 0 ? 0.35 : 1) + (rng() - 0.5) * 60)) : 0,
        rain,
        eto: round2(Math.max(0, (base.etoDay / 24) * (1 + Math.max(0, dayPhase)) * (rain > 0 ? 0.4 : 1) + (rng() - 0.5) * 0.05)),
        battery: round2(base.battery + Math.sin(hour / 24 * Math.PI) * 0.4 - 0.1 + (rng() - 0.5) * 0.05),
      });
    }
    state._hourly = rows;
    state._hourlySig = sig;
    if (typeof state._rawPage !== "number") state._rawPage = 0;
  }

  const round0 = (n) => Math.round(n);
  const round1 = (n) => Math.round(n * 10) / 10;
  const round2 = (n) => Math.round(n * 100) / 100;
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  // ─── Gráfico das leituras ────────────────────────────────────────────────
  //
  // Mesma linguagem visual do gráfico do Cosmofield: eixo primário (esq.) e
  // secundário (dir.) com escala e rótulos próprios, tooltip que acompanha o
  // cursor (e vira perto da borda), navegador com alças de arraste e atalhos
  // de zoom. Series toggláveis pela legenda. O SVG recalcula o viewBox a
  // partir do tamanho real do container a cada render — nunca fica esticado.

  // Cada série tem o seu próprio eixo (escala independente). No lado primário
  // (esquerda): Temperatura, Umidade e Vento. No secundário (direita): ETo +
  // Chuva compartilham um eixo em mm; Radiação e Bateria têm o seu.
  const CHART_SERIES = {
    temp:      { color: "#ef4444", axisId: "temp",  label: "Temperatura", unit: "°C",   dec: 1 },
    humidity:  { color: "#0ea5e9", axisId: "hum",   label: "Umidade",     unit: "%",    dec: 0 },
    wind:      { color: "#14b8a6", axisId: "wind",  label: "Vento",       unit: "m/s",  dec: 1 },
    eto:       { color: "#16a34a", axisId: "water", label: "ETo",         unit: "mm",   dec: 2 },
    rain:      { color: "#3b82f6", axisId: "water", label: "Chuva",       unit: "mm",   dec: 1, kind: "bar" },
    radiation: { color: "#f59e0b", axisId: "rad",   label: "Radiação",    unit: "W/m²", dec: 0 },
    battery:   { color: "#a855f7", axisId: "batt",  label: "Bateria",     unit: "V",    dec: 2, dashed: true },
  };

  // order = distância a partir da área do gráfico (0 = eixo mais interno).
  // zeroBased: escala começa em 0 (a de temperatura acompanha os dados).
  const CHART_AXES = {
    temp:  { side: "left",  order: 0, unit: "°C",   color: "#ef4444", zeroBased: false },
    hum:   { side: "left",  order: 1, unit: "%",    color: "#0ea5e9", zeroBased: true },
    wind:  { side: "left",  order: 2, unit: "m/s",  color: "#14b8a6", zeroBased: true },
    water: { side: "right", order: 0, unit: "mm",   color: "#3b82f6", zeroBased: true },
    rad:   { side: "right", order: 1, unit: "W/m²", color: "#f59e0b", zeroBased: true },
    batt:  { side: "right", order: 2, unit: "V",    color: "#a855f7", zeroBased: true },
  };

  const CHART_ZOOM = { "24h": 24, "7d": 24 * 7, "15d": 24 * 15, "30d": 24 * 30, all: Infinity };

  const chart = {
    bound: false,
    winStart: 0,
    winEnd: 0,
    zoomKey: "7d",
  };

  function chartActiveSeries() {
    if (!state._chartSeries) {
      state._chartSeries = { temp: true, humidity: true, wind: true, radiation: true, eto: true, rain: true, battery: true };
    }
    return state._chartSeries;
  }

  function chartRows() {
    return Array.isArray(state._hourly) ? state._hourly : [];
  }

  function chartSetWindow(start, end) {
    const total = chartRows().length;
    if (total < 2) return;
    start = Math.max(0, Math.min(start, total - 2));
    end = Math.max(start + 2, Math.min(end, total));
    chart.winStart = start;
    chart.winEnd = end;
    chartDrawMain();
    chartDrawNavRange();
  }

  function chartApplyZoom(key) {
    chart.zoomKey = key;
    const total = chartRows().length;
    const len = Math.min(CHART_ZOOM[key] || CHART_ZOOM["7d"], total);
    chartSetWindow(total - len, total);
    document.querySelectorAll("#estdChartCard [data-estd-zoom]").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.estdZoom === key);
    });
  }

  const SVGNS = "http://www.w3.org/2000/svg";
  function mkSvg(tag, attrs) {
    const el = document.createElementNS(SVGNS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  function chartFmtX(date, spanHours) {
    if (spanHours <= 48) {
      return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }
    if (spanHours <= 24 * 20) {
      return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    }
    return date.toLocaleDateString(window.IcI18n?.getLocale?.() || "pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
  }

  // Constrói os eixos ativos a partir das séries ligadas. Cada eixo tem a sua
  // própria escala (min/max sobre a janela visível) e uma posição x — os
  // eixos vão se afastando da área do gráfico conforme a ordem.
  const AXIS_COL_W = 38;
  function chartBuildAxes(keys, rows, from, to, W, PAD_T, plotBottom) {
    const byId = {};
    keys.forEach((k) => {
      const id = CHART_SERIES[k].axisId;
      if (!byId[id]) byId[id] = { id, ...CHART_AXES[id], seriesKeys: [] };
      byId[id].seriesKeys.push(k);
    });
    const list = Object.values(byId);
    list.forEach((ax) => {
      let min = Infinity, max = -Infinity;
      ax.seriesKeys.forEach((k) => {
        for (let i = from; i < to; i++) {
          const v = rows[i]?.[k];
          if (Number.isFinite(v)) { if (v < min) min = v; if (v > max) max = v; }
        }
      });
      if (!Number.isFinite(max)) { min = 0; max = 1; }
      if (ax.zeroBased) min = Math.min(0, min);
      else min -= (max - min || 1) * 0.1;
      max += (max - min || 1) * 0.08;
      if (max === min) max += 1;
      ax.min = min;
      ax.max = max;
      ax.y = (v) => plotBottom - ((v - min) / (max - min)) * (plotBottom - PAD_T);
      ax.valueAt = (frac) => min + frac * (max - min);
    });
    const left = list.filter((a) => a.side === "left").sort((a, b) => a.order - b.order);
    const right = list.filter((a) => a.side === "right").sort((a, b) => a.order - b.order);
    const PAD_L = Math.max(14, left.length * AXIS_COL_W + 6);
    const PAD_R = Math.max(14, right.length * AXIS_COL_W + 6);
    left.forEach((a, idx) => { a.x = PAD_L - idx * AXIS_COL_W; });
    right.forEach((a, idx) => { a.x = W - PAD_R + idx * AXIS_COL_W; });
    return { byId, left, right, PAD_L, PAD_R };
  }

  function chartEnsureTip() {
    const card = $("estdChartCard");
    if (!card) return null;
    let tip = card.querySelector(".cf-tip");
    if (!tip) {
      tip = document.createElement("div");
      tip.className = "cf-tip";
      card.appendChild(tip);
    }
    return tip;
  }

  function chartDrawMain() {
    const svg = $("estdChartSvg");
    const rows = chartRows();
    if (!svg || rows.length < 2) return;

    const rect = svg.getBoundingClientRect();
    const W = Math.max(320, Math.round(rect.width) || 1000);
    const H = Math.max(200, Math.round(rect.height) || 340);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

    const active = chartActiveSeries();
    const keys = Object.keys(CHART_SERIES).filter((k) => active[k]);

    const PAD_T = 16;
    const PAD_B = 28;
    const plotH = H - PAD_T - PAD_B;
    const plotBottom = PAD_T + plotH;

    const from = chart.winStart;
    const to = chart.winEnd;
    const n = to - from;

    const axes = chartBuildAxes(keys, rows, from, to, W, PAD_T, plotBottom);
    const PAD_L = axes.PAD_L;
    const PAD_R = axes.PAD_R;
    const plotW = W - PAD_L - PAD_R;
    const xAt = (i) => PAD_L + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
    const axisOf = (k) => axes.byId[CHART_SERIES[k].axisId];

    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.appendChild(mkSvg("rect", { x: 0, y: 0, width: W, height: H, fill: "transparent" }));

    // Gridlines horizontais (5 divisões) — as frações valem para todos os eixos.
    const TICKS = 5;
    for (let g = 0; g <= TICKS; g++) {
      const y = plotBottom - (g / TICKS) * plotH;
      svg.appendChild(mkSvg("line", { x1: PAD_L, y1: y, x2: PAD_L + plotW, y2: y, stroke: "#eef2f7", "stroke-width": 1 }));
    }

    // Um eixo vertical por série ativa (ou par ETo/Chuva), com escala própria.
    [...axes.left, ...axes.right].forEach((ax) => {
      const isLeft = ax.side === "left";
      svg.appendChild(mkSvg("line", { x1: ax.x, y1: PAD_T, x2: ax.x, y2: plotBottom, stroke: ax.color, "stroke-width": 1, opacity: 0.35 }));
      for (let g = 0; g <= TICKS; g++) {
        const frac = g / TICKS;
        const y = plotBottom - frac * plotH;
        const t = mkSvg("text", {
          x: isLeft ? ax.x - 4 : ax.x + 4, y: y + 3,
          "text-anchor": isLeft ? "end" : "start", "font-size": 9, fill: ax.color,
        });
        t.textContent = chartFmtTick(ax.valueAt(frac));
        svg.appendChild(t);
      }
      const unit = mkSvg("text", {
        x: isLeft ? ax.x - 2 : ax.x + 2, y: PAD_T - 5,
        "text-anchor": isLeft ? "end" : "start", "font-size": 9, "font-weight": 600, fill: ax.color,
      });
      unit.textContent = ax.unit;
      svg.appendChild(unit);
    });

    // Barras (chuva) primeiro, para ficarem atrás das linhas.
    keys.filter((k) => CHART_SERIES[k].kind === "bar").forEach((k) => {
      const cfg = CHART_SERIES[k];
      const ax = axisOf(k);
      const bw = Math.max(2, Math.min(12, (plotW / n) * 0.7));
      for (let i = 0; i < n; i++) {
        const val = rows[from + i]?.[k];
        if (!Number.isFinite(val) || val <= 0) continue;
        const by = ax.y(val);
        svg.appendChild(mkSvg("rect", {
          x: (xAt(i) - bw / 2).toFixed(1), y: by.toFixed(1),
          width: bw.toFixed(1), height: Math.max(0, plotBottom - by).toFixed(1),
          fill: cfg.color, opacity: 0.55,
        }));
      }
    });

    // Linhas.
    keys.filter((k) => CHART_SERIES[k].kind !== "bar").forEach((k) => {
      const cfg = CHART_SERIES[k];
      const ax = axisOf(k);
      let d = "";
      let started = false;
      for (let i = 0; i < n; i++) {
        const val = rows[from + i]?.[k];
        if (!Number.isFinite(val)) { started = false; continue; }
        d += (started ? "L" : "M") + xAt(i).toFixed(1) + " " + ax.y(val).toFixed(1) + " ";
        started = true;
      }
      if (d) {
        svg.appendChild(mkSvg("path", {
          d, fill: "none", stroke: cfg.color, "stroke-width": 1.8, "stroke-linejoin": "round",
          ...(cfg.dashed ? { "stroke-dasharray": "5 3" } : {}),
        }));
      }
    });

    // Rótulos do eixo X.
    const spanHours = n;
    const xStep = Math.max(1, Math.round(n / 8));
    for (let i = 0; i < n; i += xStep) {
      const t = mkSvg("text", { x: xAt(i).toFixed(1), y: H - 8, "text-anchor": "middle", "font-size": 10, fill: "#94a3b8" });
      t.textContent = chartFmtX(new Date(rows[from + i].ts), spanHours);
      svg.appendChild(t);
    }

    // Tooltip: linha-guia + marcadores + balão.
    const guide = mkSvg("line", { x1: 0, y1: PAD_T, x2: 0, y2: plotBottom, stroke: "#cbd5e1", "stroke-width": 1, "stroke-dasharray": "3 3", opacity: 0, "pointer-events": "none" });
    svg.appendChild(guide);
    const dots = keys.filter((k) => CHART_SERIES[k].kind !== "bar").map((k) => {
      const c = mkSvg("circle", { r: 3.5, cx: 0, cy: 0, fill: CHART_SERIES[k].color, stroke: "#fff", "stroke-width": 1.5, opacity: 0, "pointer-events": "none" });
      svg.appendChild(c);
      return { k, c };
    });

    const tip = chartEnsureTip();
    const card = $("estdChartCard");
    const hideTip = () => {
      if (tip) tip.classList.remove("is-visible");
      guide.setAttribute("opacity", 0);
      dots.forEach((d) => d.c.setAttribute("opacity", 0));
    };

    const hover = mkSvg("rect", { x: PAD_L, y: PAD_T, width: plotW, height: plotH, fill: "transparent" });
    hover.addEventListener("mousemove", (event) => {
      const box = svg.getBoundingClientRect();
      const px = ((event.clientX - box.left) / box.width) * W;
      let i = Math.round(((px - PAD_L) / plotW) * (n - 1));
      if (i < 0) i = 0;
      if (i > n - 1) i = n - 1;
      const row = rows[from + i];
      if (!row) { hideTip(); return; }
      const cx = xAt(i);

      guide.setAttribute("x1", cx);
      guide.setAttribute("x2", cx);
      guide.setAttribute("opacity", 1);

      const lines = [];
      keys.forEach((k) => {
        const cfg = CHART_SERIES[k];
        const val = row[k];
        if (!Number.isFinite(val)) return;
        if (cfg.kind !== "bar") {
          const dot = dots.find((d) => d.k === k);
          if (dot) { dot.c.setAttribute("cx", cx); dot.c.setAttribute("cy", axisOf(k).y(val)); dot.c.setAttribute("opacity", 1); }
        }
        if (cfg.kind === "bar" && val <= 0) return;
        lines.push(`<div class="cf-tip__row"><i class="cf-tip__dot" style="background:${cfg.color}"></i>${cfg.label}: <strong>${val.toFixed(cfg.dec)} ${cfg.unit}</strong></div>`);
      });

      if (tip) {
        const dt = new Date(row.ts);
        tip.innerHTML = `<div class="cf-tip__date">${dt.toLocaleDateString(window.IcI18n?.getLocale?.() || "pt-BR", { weekday: "short", day: "2-digit", month: "short" }).replace(/\./g, "")}, ${dt.toLocaleTimeString(window.IcI18n?.getLocale?.() || "pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>${lines.join("")}`;
        tip.classList.add("is-visible");
        const scaleX = box.width / W;
        const scaleY = box.height / H;
        const cardBox = card.getBoundingClientRect();
        const visibleCys = dots.filter((d) => d.c.getAttribute("opacity") === "1").map((d) => Number(d.c.getAttribute("cy")));
        const cyTop = visibleCys.length ? Math.min(...visibleCys) : PAD_T + plotH / 2;
        const leftPx = box.left - cardBox.left + cx * scaleX;
        const topPx = box.top - cardBox.top + (Number.isFinite(cyTop) ? cyTop : plotH / 2) * scaleY;
        tip.style.left = Math.round(leftPx) + "px";
        tip.style.top = Math.round(topPx) + "px";
        tip.classList.toggle("is-flipped", leftPx + tip.offsetWidth + 24 > cardBox.width);
      }
    });
    hover.addEventListener("mouseleave", hideTip);
    svg.appendChild(hover);
  }

  function chartFmtTick(v) {
    const abs = Math.abs(v);
    if (abs >= 100) return String(Math.round(v));
    if (abs >= 10) return (Math.round(v * 10) / 10).toString();
    return (Math.round(v * 100) / 100).toString();
  }

  function chartDrawNav() {
    const svg = $("estdChartNavSvg");
    const rows = chartRows();
    if (!svg || rows.length < 2) return;
    const rect = svg.getBoundingClientRect();
    const W = Math.max(200, Math.round(rect.width) || 1000);
    const H = Math.max(20, Math.round(rect.height) || 46);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    // Série de referência do navegador: primeira série de linha ativa, ou
    // temperatura como padrão.
    const active = chartActiveSeries();
    const refKey = Object.keys(CHART_SERIES).find((k) => active[k] && CHART_SERIES[k].kind !== "bar") || "temp";
    const color = CHART_SERIES[refKey].color;
    const n = rows.length;
    let min = Infinity, max = -Infinity;
    rows.forEach((r) => { const v = r[refKey]; if (Number.isFinite(v)) { if (v < min) min = v; if (v > max) max = v; } });
    if (!Number.isFinite(min)) { min = 0; max = 1; }
    if (max === min) max = min + 1;
    const padT = H * 0.12, padB = H * 0.14;
    const x = (i) => (i / (n - 1)) * W;
    const y = (v) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);

    let d = "";
    let started = false;
    for (let i = 0; i < n; i++) {
      const v = rows[i][refKey];
      if (!Number.isFinite(v)) { started = false; continue; }
      d += (started ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1) + " ";
      started = true;
    }
    if (d) {
      const area = d + `L${W} ${H} L0 ${H} Z`;
      svg.appendChild(mkSvg("path", { d: area, fill: color, opacity: 0.12, stroke: "none" }));
      svg.appendChild(mkSvg("path", { d, fill: "none", stroke: color, "stroke-width": 1.3 }));
    }
  }

  function chartDrawNavRange() {
    const total = chartRows().length;
    if (!total) return;
    const range = $("estdNavRange");
    const maskL = $("estdNavMaskLeft");
    const maskR = $("estdNavMaskRight");
    if (!range) return;
    const pctL = (chart.winStart / total) * 100;
    const pctR = (chart.winEnd / total) * 100;
    range.style.left = `${pctL}%`;
    range.style.width = `${pctR - pctL}%`;
    if (maskL) maskL.style.width = `${pctL}%`;
    if (maskR) maskR.style.width = `${100 - pctR}%`;
  }

  function chartBindOnce() {
    if (chart.bound) return;
    const card = $("estdChartCard");
    if (!card) return;
    chart.bound = true;

    // Zoom.
    card.querySelectorAll("[data-estd-zoom]").forEach((btn) => {
      btn.addEventListener("click", () => chartApplyZoom(btn.dataset.estdZoom));
    });

    // Legenda: liga/desliga série.
    card.querySelectorAll("[data-estd-series]").forEach((btn) => {
      const k = btn.dataset.estdSeries;
      btn.classList.toggle("is-active", !!chartActiveSeries()[k]);
      btn.addEventListener("click", () => {
        const a = chartActiveSeries();
        a[k] = !a[k];
        btn.classList.toggle("is-active", a[k]);
        chartDrawMain();
        chartDrawNav();
      });
    });

    // Arraste do navegador (mover / redimensionar a janela).
    const range = $("estdNavRange");
    const navigator = $("estdChartNavigator");
    if (range && navigator) {
      let mode = null, startX = 0, s0 = 0, e0 = 0;
      const onMove = (e) => {
        if (!mode) return;
        const rect = navigator.getBoundingClientRect();
        const total = chartRows().length;
        const delta = ((e.clientX - startX) / rect.width) * total;
        if (mode === "move") {
          const len = e0 - s0;
          let s = Math.round(s0 + delta);
          s = Math.max(0, Math.min(s, total - len));
          chartSetWindow(s, s + len);
        } else if (mode === "l") {
          chartSetWindow(Math.round(s0 + delta), chart.winEnd);
        } else if (mode === "r") {
          chartSetWindow(chart.winStart, Math.round(e0 + delta));
        }
        document.querySelectorAll("#estdChartCard [data-estd-zoom]").forEach((b) => b.classList.remove("is-active"));
      };
      const onUp = () => {
        mode = null;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      const onDown = (m) => (e) => {
        mode = m;
        startX = e.clientX;
        s0 = chart.winStart;
        e0 = chart.winEnd;
        e.preventDefault();
        e.stopPropagation();
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      };
      range.addEventListener("mousedown", onDown("move"));
      range.querySelector('[data-handle="l"]')?.addEventListener("mousedown", onDown("l"));
      range.querySelector('[data-handle="r"]')?.addEventListener("mousedown", onDown("r"));
    }

    // Redesenha quando o container muda de tamanho.
    const plot = card.querySelector(".cf-chart-card__plot");
    if (typeof ResizeObserver !== "undefined" && plot) {
      let pending = false;
      const ro = new ResizeObserver(() => {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => { pending = false; chartDrawMain(); chartDrawNav(); chartDrawNavRange(); });
      });
      ro.observe(plot);
    }
  }

  function renderChart() {
    if (chartRows().length < 2) return;
    chartBindOnce();
    const total = chartRows().length;
    // Primeira renderização (ou troca de estação): aplica o zoom padrão.
    if (chart.winEnd === 0 || chart.winEnd > total || chart.winStart >= chart.winEnd) {
      chartApplyZoom(chart.zoomKey || "7d");
    }
    chartDrawMain();
    chartDrawNav();
    chartDrawNavRange();
  }


  // ─── Leituras (tabela horária paginada) ──────────────────────────────

  function renderRawTable() {
    const body = $("estdRawTableBody");
    const rows = state._hourly;
    if (!body || !Array.isArray(rows)) return;

    const sorted = [...rows].reverse(); // mais recente primeiro
    const totalPages = Math.max(1, Math.ceil(sorted.length / RAW_PAGE_SIZE));
    if (state._rawPage >= totalPages) state._rawPage = totalPages - 1;
    if (state._rawPage < 0) state._rawPage = 0;
    const start = state._rawPage * RAW_PAGE_SIZE;
    const page = sorted.slice(start, start + RAW_PAGE_SIZE);

    body.innerHTML = page.map((r) => {
      const dt = new Date(r.ts);
      const dstr = dt.toLocaleString(window.IcI18n?.getLocale?.() || "pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "").replace(".", "");
      return `<tr>
        <td>${dstr}</td>
        <td>${f1(r.temp)}</td>
        <td>${f0(r.humidity)}</td>
        <td>${f1(r.wind)}</td>
        <td>${f0(r.radiation)}</td>
        <td>${r.rain ? f1(r.rain) : "—"}</td>
        <td>${f2(r.eto)}</td>
        <td>${f2(r.battery)}</td>
      </tr>`;
    }).join("");

    setText("estdRawCount", `${sorted.length} leituras`);

    const pag = $("estdRawPagination");
    if (pag) {
      pag.innerHTML = `
        <button type="button" class="btn-page" data-raw-nav="prev" ${state._rawPage === 0 ? "disabled" : ""}><i class="fa-solid fa-chevron-left"></i></button>
        <span class="btn-page__info">${state._rawPage + 1} / ${totalPages}</span>
        <button type="button" class="btn-page" data-raw-nav="next" ${state._rawPage >= totalPages - 1 ? "disabled" : ""}><i class="fa-solid fa-chevron-right"></i></button>
      `;
    }
  }

  // ─── Aba Configurações (Ficha Técnica + Localização) ────────────────────
  //
  // A estação não entra na malha de rádio (igual Cosmofield) — sem aba de
  // Conectividade. O que se edita são as credenciais do provedor (hoje só
  // Davis). A localização vem automática do próprio equipamento junto com
  // as leituras — por isso a aba "Localização" é só informativa (sem
  // editar/"Obter Localização").

  function renderConfigForm() {
    const equip = getFocusEst();
    const d = equip ? normalizeEst(equip) : null;
    if (!d) return;

    const lastCommHtml = `<span class="comm-label">Última comunicação:</span> ${formatLastUpdate(d.updated)}`;
    document.querySelectorAll("#estdPanel .ws-last-comm-display").forEach((el) => { el.innerHTML = lastCommHtml; });

    const set = (id, val) => { const el = $(id); if (el) el.value = val ?? ""; };
    set("wsEditProvider", d.provider || "davis");
    if (window.IcEquipSelectInit) window.IcEquipSelectInit($("wsEditProvider")?.closest(".edit-panel__body") || document);
    set("wsEditName", d.name);
    set("wsEditDavisId", d.davisId);
    set("wsEditApiKey", d.apiKey);
    set("wsEditApiSecret", d.apiSecret);
    set("wsEditStationId", d.stationId);

    const coordsEl = $("wsEditLocationCoords");
    if (coordsEl) {
      coordsEl.value = d.center ? `${Number(d.center.lat).toFixed(6)}, ${Number(d.center.lng).toFixed(6)}` : "—";
    }
  }

  // Mapa somente-leitura da aba "Localização" (Configurações) — mesma
  // finalidade do minimapa da Geral, mas sem interação nenhuma (sem
  // arrastar/clicar/zoom): é só pra conferir visualmente que a posição
  // que a Davis está mandando bate com o talhão certo. Renderiza sob
  // demanda (só quando o usuário abre essa sub-aba), porque o Leaflet
  // precisa do container já visível pra medir o tamanho certo.
  let locationMapInstance = null;
  function renderLocationMap() {
    const container = $("wsEditLocationMap");
    if (!container || !window.L) return;
    const d = getFocusEst() ? normalizeEst(getFocusEst()) : null;

    if (locationMapInstance) {
      try { locationMapInstance.remove(); } catch (_) {}
      locationMapInstance = null;
    }
    if (!d || !d.center) return;

    const center = [Number(d.center.lat), Number(d.center.lng)];
    locationMapInstance = L.map(container, {
      zoomControl: true, attributionControl: false,
      dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
    }).setView(center, 16);

    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19 }).addTo(locationMapInstance);
    L.tileLayer("https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, opacity: 0.85 }).addTo(locationMapInstance);
    L.marker(center, { icon: pinIcon() }).addTo(locationMapInstance);

    setTimeout(() => locationMapInstance?.invalidateSize?.(), 100);
  }

  function buildSavePayload() {
    const name = $("wsEditName")?.value?.trim();
    if (!name) return { error: "Informe o nome da estação meteorológica." };
    const equip = getFocusEst();
    const farm = getActiveFarmSafe();
    const provider = $("wsEditProvider")?.value?.trim() || "davis";
    return {
      id: state.detailsFocusId || equip?.id,
      farmId: farm?.id || "",
      name,
      provider,
      providerLabel: "Davis",
      vendor: "Davis",
      davisId: $("wsEditDavisId")?.value?.trim() || "",
      stationId: $("wsEditStationId")?.value?.trim() || "",
      apiKey: $("wsEditApiKey")?.value?.trim() || "",
      apiSecret: $("wsEditApiSecret")?.value?.trim() || "",
    };
  }

  function applySave(payload) {
    const farm = getActiveFarmSafe();
    const equip = (Array.isArray(farm?.equipments) ? farm.equipments : []).find((e) => String(e.id) === String(payload.id));
    if (!equip) return;
    equip.name = payload.name;
    equip.data = {
      ...(equip.data || {}),
      name: payload.name, nome: payload.name, provider: payload.provider, providerLabel: payload.providerLabel, vendor: "Davis",
      davisId: payload.davisId, stationId: payload.stationId,
      apiKey: payload.apiKey, apiSecret: payload.apiSecret,
    };
    if (window.IcMapRenderPivots && farm) setTimeout(() => window.IcMapRenderPivots(farm), 0);
  }

  async function persistEstPayload(payload) {
    if (!payload?.farmId || !payload?.id) return false;
    if (typeof window.Cad?.data?.getAllFarms !== "function" || typeof window.Cad?.data?.persistFarmDataset !== "function") return false;

    const farms = window.Cad.data.getAllFarms();
    const farmIndex = farms.findIndex((f) => String(f?.id || "") === String(payload.farmId || ""));
    if (farmIndex < 0) return false;

    const targetFarm = { ...farms[farmIndex] };
    const equipments = (Array.isArray(targetFarm?.equipments) ? targetFarm.equipments : []).map((item) => ({
      ...item, data: item?.data && typeof item.data === "object" ? { ...item.data } : {},
    }));
    const equipIndex = equipments.findIndex((item) => String(item?.id || "") === String(payload.id || ""));
    if (equipIndex < 0) return false;

    equipments[equipIndex] = {
      ...equipments[equipIndex],
      name: payload.name,
      data: {
        ...equipments[equipIndex].data,
        name: payload.name, nome: payload.name, provider: payload.provider, providerLabel: payload.providerLabel, vendor: "Davis",
        davisId: payload.davisId, stationId: payload.stationId,
        apiKey: payload.apiKey, apiSecret: payload.apiSecret,
      },
    };
    targetFarm.equipments = equipments;
    farms[farmIndex] = targetFarm;
    await window.Cad.data.persistFarmDataset(farms);
    window.CreateFarm?.setters?.setFarms?.(farms);
    return true;
  }

  // Troca a aba ativa (Geral / Configurações / Histórico) e ajusta os botões
  // do titlebar (Exportar só na Geral, Salvar só em Configurações).
  function activateTab(key) {
    const panel = $("estdPanel");
    if (!panel) return;
    // A aba "Geral" (data-dev-only) só reaparece com dev features ligado
    // (Ctrl+D — ver app.js). Reaplica aqui porque essa tela é carregada em
    // #pageSlot depois do toggle inicial do app.js, então precisa se
    // atualizar sozinha toda vez que renderiza.
    panel.querySelectorAll("[data-dev-only]").forEach((el) => {
      el.classList.toggle("is-hidden", !window.__icDevFeaturesOn);
    });
    panel.querySelectorAll(".edit-panel__tab").forEach((t) => {
      const on = t.dataset.tab === key;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", String(on));
    });
    panel.querySelectorAll(".edit-panel__tab-body").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.tabBody === key);
    });
    // .edit-panel__save é display:inline-flex — vence o atributo [hidden].
    // Alterna pelo style inline pra não depender de regra CSS.
    const toggleBtn = (el, show) => {
      if (!el) return;
      el.hidden = !show;
      el.style.display = show ? "" : "none";
    };
    toggleBtn($("estdExportBtn"), key === "general");
    toggleBtn($("estdSaveBtn"), key === "config");
    if (key === "config") renderConfigForm();
    if (key === "general") setTimeout(renderChart, 40);
  }

  // A previsão exibida aqui é EXATAMENTE a mesma do card "Clima" da visão
  // geral — mesma fonte (Open-Meteo via IcMapWeather), mesmo cache, mesmas
  // coordenadas (fazenda ativa). Assim os dois nunca divergem.
  // A aba "Previsão" mostra EXATAMENTE os mesmos cards do card "Clima" da visão
  // geral — mesmo componente (window.IcMapWeather.renderForecastCards), mesma
  // fonte de dados (state._climaForecast, de IcMapWeather.getDailyRows()).
  function renderForecast() {
    const host = $("estdForecast");
    if (!host) return;

    const climaRows = Array.isArray(state._climaForecast) ? state._climaForecast : null;
    const rows = climaRows && climaRows.length
      ? climaRows
      : forecastForPeriod().forecast.map((d) => ({
          date: d.date,
          et0: num(d.eto), precip: num(d.precip), prob: NaN,
          tempMean: num(d.tempMean), tempMin: num(d.tempMin), tempMax: num(d.tempMax),
          rhMean: num(d.rhMean), radiation: num(d.radiation),
          windSpeed: num(d.windMax ?? d.windSpeed), windDir: num(d.windDir),
        }));

    if (typeof window.IcMapWeather?.renderForecastCards === "function") {
      const n = window.IcMapWeather.renderForecastCards(host, rows, { limit: 7, detailsOpen: true });
      if (!n) host.innerHTML = `<div class="estd-forecast__empty">Previsão indisponível.</div>`;
      return;
    }

    if (!rows.length) {
      host.innerHTML = `<div class="estd-forecast__empty">Previsão indisponível.</div>`;
    }
  }

  async function loadForecast() {
    const d = getFocusEst() ? normalizeEst(getFocusEst()) : null;
    const host = $("estdForecast");
    const reqId = ++forecastReqSeq;

    // Preferido: os mesmos dados do card "Clima".
    try {
      const rows = await window.IcMapWeather?.getDailyRows?.();
      if (reqId !== forecastReqSeq) return;
      if (Array.isArray(rows) && rows.length) {
        state._climaForecast = rows;
        renderForecast();
        return;
      }
    } catch (_) {}

    // Fallback: busca própria pelas coordenadas da estação.
    if (!d || !d.center) {
      if (host && !host.querySelector(".estd-fc-day")) host.innerHTML = `<div class="estd-forecast__empty">Sem coordenadas para buscar a previsão.</div>`;
      return;
    }
    try {
      const fc = await fetchWeather(Number(d.center.lat), Number(d.center.lng), d.current);
      if (reqId !== forecastReqSeq) return;
      state._forecast = fc;
      renderForecast();
      renderDetails();
    } catch (err) {
      if (reqId !== forecastReqSeq) return;
      console.warn("[estdetails] Falha ao carregar previsão.", err);
      if (host && !host.querySelector(".estd-fc-day")) host.innerHTML = `<div class="estd-forecast__empty">Não foi possível carregar a previsão.</div>`;
    }
  }

  // ─── Exportação ──────────────────────────────────────────────────────────

  // Exporta as leituras horárias da estação (a mesma série da aba "Leituras"),
  // recortadas pelo período escolhido no calendário.
  const EXPORT_COLS = {
    temp:      { label: "Temp. (°C)",      get: (r) => (Number.isFinite(r.temp) ? r.temp.toFixed(1) : "") },
    humidity:  { label: "Umidade (%)",     get: (r) => (Number.isFinite(r.humidity) ? String(Math.round(r.humidity)) : "") },
    wind:      { label: "Vento (m/s)",     get: (r) => (Number.isFinite(r.wind) ? r.wind.toFixed(1) : "") },
    radiation: { label: "Radiação (W/m²)", get: (r) => (Number.isFinite(r.radiation) ? String(Math.round(r.radiation)) : "") },
    rain:      { label: "Chuva (mm)",      get: (r) => (r.rain ? r.rain.toFixed(1) : "") },
    eto:       { label: "ETo (mm)",        get: (r) => (Number.isFinite(r.eto) ? r.eto.toFixed(2) : "") },
    battery:   { label: "Bateria (V)",     get: (r) => (Number.isFinite(r.battery) ? r.battery.toFixed(2) : "") },
  };

  // Período de exportação — o mesmo popover de calendário da Pluviometria
  // (window.Plv.period). Sem seleção ainda: últimos 7 dias.
  function getExportRange() {
    const p = window.Plv?.period?.getPeriod?.();
    if (p && p.start && p.end) return { start: new Date(p.start), end: new Date(p.end) };
    const end = new Date(); end.setHours(0, 0, 0, 0);
    const start = new Date(end); start.setDate(start.getDate() - 6);
    return { start, end };
  }

  function syncExportRangeLabel() {
    const el = $("estdExportRange")?.querySelector(".pivo-agenda__period-label");
    if (!el) return;
    const r = getExportRange();
    const f = (d) => d.toLocaleDateString("pt-BR");
    el.textContent = `${f(r.start)} → ${f(r.end)}`;
  }

  function buildExportRows(cols) {
    const range = getExportRange();
    const startMs = new Date(range.start).setHours(0, 0, 0, 0);
    const endMs = new Date(range.end).setHours(23, 59, 59, 999);
    const src = Array.isArray(state._hourly) ? state._hourly : [];
    const rows = src
      .filter((r) => { const t = new Date(r.ts).getTime(); return t >= startMs && t <= endMs; })
      .sort((a, b) => new Date(b.ts) - new Date(a.ts));
    const fmtDt = (ts) => new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "");
    const header = ["Data e hora", ...cols.map((k) => EXPORT_COLS[k].label)];
    const data = rows.map((r) => [fmtDt(r.ts), ...cols.map((k) => EXPORT_COLS[k].get(r))]);
    return { header, data };
  }

  function slug(s) {
    return String(s || "estacao").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  function downloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportCsv(name, rows) {
    const esc = (v) => {
      const s = String(v ?? "");
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [rows.header, ...rows.data].map((r) => r.map(esc).join(";"));
    downloadFile("" + lines.join("\r\n"), `estacao-${slug(name)}.csv`, "text/csv");
  }

  function exportExcel(name, rows) {
    // Excel abre HTML com extensão .xls — mesmo truque do Cosmofield.
    const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><style>table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px}th{background:#f1f5f9}</style></head>
      <body><table>
        <thead><tr>${rows.header.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
        <tbody>${rows.data.map((r) => `<tr>${r.map((c) => `<td>${esc(c || "—")}</td>`).join("")}</tr>`).join("")}</tbody>
      </table></body></html>`;
    downloadFile(html, `estacao-${slug(name)}.xls`, "application/vnd.ms-excel");
  }

  function exportPdf(name, rows) {
    const win = window.open("", "_blank");
    if (!win) return;
    const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(name)}</title>
      <style>
        body{font:12px system-ui,sans-serif;color:#0f172a;padding:24px}
        h1{font-size:18px;margin:0 0 16px}
        table{width:100%;border-collapse:collapse;font-size:10px}
        th,td{padding:4px 6px;border-bottom:1px solid #e5e7eb;text-align:left}
        th{background:#f8fafc}
      </style></head><body>
      <h1>${esc(name)} <span>— leituras da estação</span></h1>
      <table>
        <thead><tr>${rows.header.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
        <tbody>${rows.data.map((r) => `<tr>${r.map((c) => `<td>${esc(c || "—")}</td>`).join("")}</tr>`).join("")}</tbody>
      </table></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }

  function bindExportModal() {
    const modal = $("estdExportModal");
    if (!modal || modal.dataset.bound) return;
    modal.dataset.bound = "1";

    const open = () => {
      // Popover de período compartilhado — mesmo comportamento da Pluviometria.
      try { window.Plv?.periodPicker?.initPeriodPicker?.(); } catch (_) {}
      syncExportRangeLabel();
      modal.setAttribute("aria-hidden", "false");
      modal.classList.add("is-open");
      document.body.classList.add("is-estd-export-open");
    };
    const close = () => {
      modal.setAttribute("aria-hidden", "true");
      modal.classList.remove("is-open");
      document.body.classList.remove("is-estd-export-open");
    };

    $("estdExportBtn")?.addEventListener("click", open);
    modal.querySelectorAll("[data-estd-export-close]").forEach((el) => el.addEventListener("click", close));

    // Atualiza o rótulo do período quando o calendário compartilhado muda.
    document.addEventListener("pluv:periodChanged", () => {
      if (modal.classList.contains("is-open")) syncExportRangeLabel();
    });

    // Conteúdo (checkboxes) — mantém pelo menos um marcado.
    modal.querySelectorAll("[data-estd-export-col] input").forEach((input) => {
      input.addEventListener("change", () => {
        const checked = modal.querySelectorAll("[data-estd-export-col] input:checked");
        if (!checked.length) { input.checked = true; return; }
        input.closest("[data-estd-export-col]").classList.toggle("is-active", input.checked);
      });
    });

    // Formato do arquivo.
    modal.querySelectorAll("[data-estd-format]").forEach((btn) => {
      btn.addEventListener("click", () => {
        modal.querySelectorAll("[data-estd-format]").forEach((b) => b.classList.toggle("is-active", b === btn));
      });
    });

    $("estdExportConfirm")?.addEventListener("click", () => {
      const format = modal.querySelector("[data-estd-format].is-active")?.dataset.estdFormat || "Excel";
      const cols = [...modal.querySelectorAll("[data-estd-export-col] input:checked")]
        .map((i) => i.closest("[data-estd-export-col]").dataset.estdExportCol);
      if (!cols.length) return;
      const rows = buildExportRows(cols);
      const name = getFocusEst()?.name || "Estação";
      if (format === "CSV") exportCsv(name, rows);
      else if (format === "PDF") exportPdf(name, rows);
      else exportExcel(name, rows);
      close();
    });
  }

  // ─── Selector ────────────────────────────────────────────────────────────

  function populateSelector() {
    const menu = $("estdSelectorMenu");
    if (!menu) return;
    const list = getEstacoesList();
    const current = getFocusEst();
    if (!list.length) {
      menu.innerHTML = `<div style="padding:10px 12px;font-size:12px;color:#64748b;">Nenhuma estação meteorológica encontrada.</div>`;
      return;
    }
    menu.innerHTML = list.map((m) => {
      const name = m.name || m.data?.nome || "Estação";
      const active = current && String(m.id) === String(current.id);
      return `<button class="pivo-selector__item ${active ? "is-selected" : ""}" type="button" data-estd-option data-value="${m.id}">
        ${active ? '<i class="fa-solid fa-check" style="color:#7c3aed;font-size:11px;"></i>' : ""}
        ${name}
      </button>`;
    }).join("");
  }

  // ─── Eventos ─────────────────────────────────────────────────────────────

  function bindDetailsEvents() {
    if (detailsEventsBound) return;
    detailsEventsBound = true;

    bindExportModal();

    const panel = $("estdPanel");
    if (panel) {
      panel.addEventListener("click", (e) => {
        if (e.target.closest(".js-details-back")) {
          destroyDetailsView();
          return;
        }

        // Abas superiores — Geral / Configurações / Histórico
        const tab = e.target.closest(".edit-panel__tab");
        if (tab && tab.dataset.tab) {
          activateTab(tab.dataset.tab);
          return;
        }

        // Navegação lateral de cada aba
        const navItem = e.target.closest(".edit-panel__nav-item");
        if (navItem && navItem.dataset.target) {
          const body = navItem.closest(".edit-panel__body");
          if (body) {
            body.querySelectorAll(".edit-panel__nav-item").forEach((n) => n.classList.remove("is-active"));
            body.querySelectorAll(".edit-panel__section").forEach((s) => s.classList.remove("is-active"));
            navItem.classList.add("is-active");
            const sec = body.querySelector(navItem.dataset.target);
            if (sec) sec.classList.add("is-active");
            if (navItem.dataset.target === "#estdSecDashboard") setTimeout(renderChart, 30);
            if (navItem.dataset.target === "#estdSecRaw") renderRawTable();
            if (navItem.dataset.target === "#wsEditLocation") setTimeout(renderLocationMap, 30);
          }
          return;
        }

        // Paginação da tabela de dados brutos
        const rawNav = e.target.closest("[data-raw-nav]");
        if (rawNav && !rawNav.disabled) {
          state._rawPage = (state._rawPage || 0) + (rawNav.dataset.rawNav === "next" ? 1 : -1);
          renderRawTable();
          return;
        }

        // Salvar (aba Configurações)
        if (e.target.closest("#estdSaveBtn")) {
          const payload = buildSavePayload();
          if (payload.error) { alert(payload.error); return; }
          applySave(payload);
          const btn = $("estdSaveBtn");
          const orig = btn ? btn.innerHTML : "";
          if (btn) btn.innerHTML = '<i class="fa-solid fa-check"></i> Salvo!';
          setTimeout(() => { const b = $("estdSaveBtn"); if (b) b.innerHTML = orig; }, 900);
          (async () => {
            try {
              const ok = await persistEstPayload(payload);
              if (!ok) window.IcNotify?.error?.("Não foi possível salvar a estação meteorológica.", 3000);
              else { populateSelector(); renderDetails(); }
            } catch (err) {
              console.error("[estd] Falha ao gravar a estação meteorológica.", err);
              window.IcNotify?.error?.("Não foi possível salvar a estação meteorológica.", 3000);
            }
          })();
          return;
        }

        // Mostrar/ocultar segredo de API
        const secretToggle = e.target.closest("#wsEditSecretToggle");
        if (secretToggle) {
          const secret = $("wsEditApiSecret");
          if (secret) {
            const shown = secret.type === "text";
            secret.type = shown ? "password" : "text";
            const icon = secretToggle.querySelector("i");
            if (icon) icon.className = shown ? "fa-regular fa-eye-slash" : "fa-regular fa-eye";
          }
          return;
        }

        // Limpar campo (botão × dentro dos inputs da Configuração)
        const clearBtn = e.target.closest("#estdPanel .edit-panel__input-actions button[aria-label='Limpar campo']");
        if (clearBtn) {
          const input = clearBtn.closest(".edit-panel__input-wrap")?.querySelector("input");
          if (input && !input.readOnly) input.value = "";
          return;
        }

        // Histórico — expandir/recolher detalhes
        const expandBtn = e.target.closest("[data-toggle-details]");
        if (expandBtn) {
          const row = document.getElementById(`details-${expandBtn.dataset.toggleDetails}`);
          if (row) {
            const open = row.style.display !== "none";
            row.style.display = open ? "none" : "table-row";
            const icon = expandBtn.querySelector("i");
            if (icon) icon.className = open ? "fa-solid fa-plus" : "fa-solid fa-minus";
          }
          return;
        }

      });
    }

    onDocClickDetails = (e) => {
      const menu = $("estdSelectorMenu");
      if (!menu) return;
      const option = e.target.closest("[data-estd-option]");
      if (option) {
        const id = option.getAttribute("data-value");
        if (id) {
          state.detailsFocusId = id;
          menu.style.display = "none";
          state._forecast = null;
          populateSelector();
          renderDetails();
              loadForecast();
        }
        return;
      }
      const selectBtn = e.target.closest("#estdSelectBtn");
      if (selectBtn) {
        e.stopPropagation();
        const hidden = getComputedStyle(menu).display === "none";
        menu.style.display = hidden ? "flex" : "none";
        return;
      }
      if (!menu.contains(e.target)) menu.style.display = "none";
    };
    document.addEventListener("click", onDocClickDetails);
  }

  function unbindDetailsEvents() {
    detailsEventsBound = false;
    // O gráfico volta a se vincular ao DOM recriado na próxima abertura.
    chart.bound = false;
    chart.winStart = 0;
    chart.winEnd = 0;
    if (onDocClickDetails) {
      document.removeEventListener("click", onDocClickDetails);
      onDocClickDetails = null;
    }
  }

  // ─── Minimapa ────────────────────────────────────────────────────────────

  function initMinimap() {
    const container = $("estdMinimap");
    if (!container || !window.L) return;
    const d = getFocusEst() ? normalizeEst(getFocusEst()) : null;
    const hasCoords = d && d.center;
    const center = hasCoords ? [Number(d.center.lat), Number(d.center.lng)] : [-15.79, -47.88];
    const zoom = hasCoords ? 16 : 4;

    if (minimapInstance) {
      try { minimapInstance.remove(); } catch (_) {}
      minimapInstance = null;
      minimapMarker = null;
    }

    minimapInstance = L.map(container, {
      zoomControl: false, attributionControl: false,
      dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
    }).setView(center, zoom);

    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19 }).addTo(minimapInstance);
    L.tileLayer("https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, opacity: 0.85 }).addTo(minimapInstance);

    if (hasCoords) {
      minimapMarker = L.circleMarker([Number(d.center.lat), Number(d.center.lng)], {
        radius: 8, color: "#6d28d9", fillColor: "#7c3aed", fillOpacity: 0.9, weight: 2,
      }).addTo(minimapInstance);
    }
    setTimeout(() => minimapInstance?.invalidateSize?.(), 100);
  }

  function updateMinimap() {
    if (!minimapInstance || !window.L) return;
    const d = getFocusEst() ? normalizeEst(getFocusEst()) : null;
    if (!d || !d.center) return;
    const ll = [Number(d.center.lat), Number(d.center.lng)];
    minimapInstance.setView(ll, 16, { animate: false });
    if (minimapMarker) minimapMarker.setLatLng(ll);
    else minimapMarker = L.circleMarker(ll, { radius: 8, color: "#6d28d9", fillColor: "#7c3aed", fillOpacity: 0.9, weight: 2 }).addTo(minimapInstance);
    setTimeout(() => minimapInstance?.invalidateSize?.(), 50);
  }

  function destroyMinimap() {
    if (minimapInstance) {
      try { minimapInstance.remove(); } catch (_) {}
      minimapInstance = null;
      minimapMarker = null;
    }
  }

  // Aquece o cache da previsão para uma coordenada — chamado pelo mapa ao
  // desenhar o marcador da estação, para a tela de detalhe abrir instantânea.
  function prefetchWeather(lat, lng, currentReading) {
    const la = Number(lat), lo = Number(lng);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) return;
    const key = `${la.toFixed(4)}|${lo.toFixed(4)}`;
    if (readCache(key)) return;
    fetchWeather(la, lo, currentReading).catch(() => {});
  }

  detailsView.showDetailsView = showDetailsView;
  detailsView.destroyDetailsView = destroyDetailsView;
  detailsView.prefetchWeather = prefetchWeather;

  // Camada de dados exposta pra tela de Detalhes (weatherstation-details.js)
  // reaproveitar — é lógica pura (sem DOM/classe/estilo), então compartilhar
  // aqui não tem o risco de acoplamento visual entre telas que motivou
  // renomear pivo-*/cf-* pra weatherstation-* na tela de Detalhes.
  Est.data = {
    getEstacoesList,
    getFocusEst,
    normalizeEst,
    ensureHourly,
    fetchWeather,
    readCache,
    todayIsoSp,
  };
})();
