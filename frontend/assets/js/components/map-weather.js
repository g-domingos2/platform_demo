// assets/js/components/map-weather.js
(function initMapWeatherCard() {
  "use strict";

  const weatherCardEl = document.getElementById("mapWeatherCard");
  const sideCardsEl = document.querySelector(".side-cards");
  const mapCardEl = document.getElementById("mapCard");
  const weatherGridEl = document.getElementById("mapWeatherGrid");
  const weatherDaysEl = document.getElementById("mwDays");
  const toggleEl = document.getElementById("weatherCardToggle");
  const bodyEl = document.getElementById("weatherCardBody");
  if (!weatherCardEl || !weatherGridEl || !weatherDaysEl) return;

  const WEATHER_MAX_VISIBLE_DAYS = 8;
  const WEATHER_DAILY_CACHE_KEY = "ic_weather_daily_cache_v4";
  const DEFAULT_FARM_HQ = { lat: -21.835392, lng: -46.94851 };
  const REFRESH_INTERVAL_MS = 60 * 60 * 1000;
  const FARM_WATCH_INTERVAL_MS = 5000;
  let requestSeq = 0;
  let lastFarmKey = "";

  const fmt1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : "--");
  const fmt0 = (v) => (Number.isFinite(v) ? `${Math.round(v)}` : "--");
  const fmtMm = (v) => (Number.isFinite(v) ? `${v.toFixed(1)} mm` : "--");
  const fmtMs = (v) => (Number.isFinite(v) ? `${v.toFixed(1)} m/s` : "--");
  const fmtMjm2 = (v) => (Number.isFinite(v) ? `${v.toFixed(1)} MJ/m²` : "--");
  const safeNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  };

  const getTodayIsoSp = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const fmtDay = (iso) => {
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return "--/--";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };
  const isEn = () => !!(window.IcI18n && window.IcI18n.isEnglish && window.IcI18n.isEnglish());
  const i18nLang = () => (window.IcI18n && window.IcI18n.getLang ? window.IcI18n.getLang() : (isEn() ? "en" : "pt-BR"));
  // Locale ativo (pt-BR / en-US / es-ES) para formatação de datas/dias.
  const i18nLocale = () => (window.IcI18n && window.IcI18n.getLocale ? window.IcI18n.getLocale() : (isEn() ? "en-US" : "pt-BR"));
  // Tradução pontual: usa o dicionário do idioma ativo; cai no "en" inline ou no pt.
  const tw = (pt, en) => {
    const i = window.IcI18n;
    if (i && i.t) { const h = i.t(pt); if (h !== pt) return h; }
    return i && i.isEnglish && i.isEnglish() ? en : pt;
  };
  const noDayLabel = () => tw("Dia", "Day");

  const fmtWeekday = (iso) => {
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return noDayLabel();
    const label = d.toLocaleDateString(i18nLocale(), { weekday: "long" });
    return label ? label.charAt(0).toUpperCase() + label.slice(1) : noDayLabel();
  };

  const windDirToText = (deg) => {
    if (!Number.isFinite(deg)) return "--";
    const lang = i18nLang();
    const dirs = lang === "en"
      ? ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
      : lang === "es"
      ? ["N", "NE", "E", "SE", "S", "SO", "O", "NO"]
      : ["N", "NE", "L", "SE", "S", "SO", "O", "NO"];
    const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
    return `${dirs[idx]} (${fmt0(deg)}°)`;
  };

  const toNumber = (value) => {
    const str = String(value ?? "").trim();
    if (!str) return null;
    const num = Number(str.replace(",", "."));
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

  const getCurrentFarm = () => {
    const state = window.CreateFarm?.state;
    if (!state) return null;
    const farms = Array.isArray(state.farms) ? state.farms : [];
    return farms.find((farm) => String(farm.id) === String(state.currentFarmId)) || farms[0] || null;
  };

  const getFarmWeatherCoords = (farm) => {
    if (!farm) return { ...DEFAULT_FARM_HQ };
    const lat = Number(farm.lat);
    const lng = Number(farm.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    const locCoords = parseLatLngText(farm.loc);
    if (locCoords) return locCoords;
    return { ...DEFAULT_FARM_HQ };
  };

  const getVisibleWeatherRows = (rows, todayIso) => {
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) return [];
    const todayKey = String(todayIso || "");
    let startIdx = list.findIndex((row) => String(row?.date || "") === todayKey);
    if (startIdx < 0 && todayKey) {
      startIdx = list.findIndex((row) => String(row?.date || "") >= todayKey);
    }
    if (startIdx < 0) startIdx = 0;
    return list.slice(startIdx, startIdx + WEATHER_MAX_VISIBLE_DAYS);
  };

  const syncSidebarLayout = () => {
    if (!sideCardsEl || !mapCardEl) return;
    // When weather is fully expanded, it covers the map card — no need to resize it
    if (weatherCardEl.classList.contains("is-expanded")) return;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const gap = parseFloat(getComputedStyle(sideCardsEl).gap || "8") || 8;
    const availableHeight = Math.max(280, viewportHeight - 48 - gap - Math.ceil(weatherCardEl.getBoundingClientRect().height));
    mapCardEl.style.setProperty("--map-card-max-height", `${availableHeight}px`);
  };

  let lastRenderedRows = null;

  const weatherCardLabels = () => ({
    temp: tw("Temperatura", "Temperature"),
    hum: tw("Umidade", "Humidity"),
    rad: tw("Radiação", "Radiation"),
    wind: tw("Vento", "Wind"),
    min: "Min",
    max: tw("Máx", "Max"),
  });

  // Card de um dia da previsão — o MESMO usado no card "Clima" da visão geral e
  // na aba "Previsão" da tela da estação meteorológica.
  const buildWeatherDayCard = (row, { isToday = false, idx = 0, detailsOpen = false } = {}) => {
    const L = weatherCardLabels();
    const card = document.createElement("div");
    card.className = `map-weather-day${isToday ? " is-today" : " is-forecast"}${detailsOpen ? " is-details-open" : ""}`;
    card.style.setProperty("--card-i", String(idx));
    card.dataset.date = String(row.date || "");
    card.innerHTML = `
        <div class="map-weather-day__head">
          <span class="map-weather-day__left">
            <span class="map-weather-day__weekday">${fmtWeekday(row.date)}</span>
            <span class="map-weather-day__meta">${fmtDay(row.date)}</span>
          </span>
          <span class="map-weather-day__right"></span>
        </div>
        <div class="map-weather-day__primary">
          <article class="map-weather-kpi map-weather-kpi--eto">
            <span class="map-weather-kpi__label"><svg class="map-weather-kpi__eto-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/></svg>ETo</span>
            <strong class="map-weather-kpi__value">${fmtMm(row.et0)}</strong>
          </article>
          <article class="map-weather-kpi map-weather-kpi--prec">
            <span class="map-weather-kpi__label"><svg class="map-weather-kpi__rain-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/></svg>Precip.</span>
            <strong class="map-weather-kpi__value">${fmtMm(row.precip)} <small>${fmt0(row.prob)}%</small></strong>
          </article>
        </div>
        <div class="map-weather-day__facts" aria-hidden="true">
          <article class="map-weather-fact map-weather-fact--temp">
            <span class="map-weather-fact__label"><svg class="map-weather-fact__svg-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg>${L.temp}</span>
            <strong class="map-weather-fact__value">${fmt1(row.tempMean)} <span class="map-weather-day__unit">°C</span></strong>
            <span class="map-weather-fact__sub-label">${L.min} ${fmt1(row.tempMin)}° / ${L.max} ${fmt1(row.tempMax)}°</span>
          </article>
          <article class="map-weather-fact">
            <span class="map-weather-fact__label"><svg class="map-weather-fact__svg-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/></svg>${L.hum}</span>
            <strong class="map-weather-fact__value">${fmt0(row.rhMean)}%</strong>
          </article>
          <article class="map-weather-fact">
            <span class="map-weather-fact__label"><svg class="map-weather-fact__svg-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>${L.rad}</span>
            <strong class="map-weather-fact__value">${fmt1(row.radiation)} <span class="map-weather-day__unit">MJ/m²</span></strong>
          </article>
          <article class="map-weather-fact map-weather-fact--wind">
            <span class="map-weather-fact__label"><svg class="map-weather-fact__svg-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.8 19.6A2 2 0 1 0 14 16H2"/><path d="M17.5 8a2.5 2.5 0 1 1 2 4H2"/><path d="M9.8 4.4A2 2 0 1 1 11 8H2"/></svg>${L.wind}</span>
            <strong class="map-weather-fact__value">${fmt1(row.windSpeed)} <span class="map-weather-day__unit">m/s</span></strong>
            <span class="map-weather-fact__wind-dir"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"/></svg>${windDirToText(row.windDir)}</span>
          </article>
        </div>
      `;
    return card;
  };

  const setWeatherDayDetails = (dayCard, shouldOpen) => {
    if (!dayCard) return;
    const btn = dayCard.querySelector(".map-weather-day__toggle");
    const facts = dayCard.querySelector(".map-weather-day__facts");
    const icon = btn?.querySelector("i");
    dayCard.classList.toggle("is-details-open", !!shouldOpen);
    if (btn) btn.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
    if (facts) {
      facts.setAttribute("aria-hidden", shouldOpen ? "false" : "true");
      facts.style.display = shouldOpen ? "grid" : "";
    }
    if (icon) {
      icon.classList.toggle("fa-plus", !shouldOpen);
      icon.classList.toggle("fa-minus", shouldOpen);
    }
  };

  const renderWeatherCards = (rows, todayIso) => {
    weatherDaysEl.innerHTML = "";
    const safeRows = getVisibleWeatherRows(rows, todayIso);
    lastRenderedRows = safeRows;
    weatherDaysEl.dataset.count = String(Math.max(safeRows.length, 1));
    weatherDaysEl.classList.add("is-opening");
    let todayIndex = safeRows.findIndex((row) => String(row?.date || "") === String(todayIso || ""));
    if (todayIndex < 0) todayIndex = safeRows.length ? 0 : -1;

    safeRows.forEach((row, idx) => {
      const card = buildWeatherDayCard(row, { isToday: idx === todayIndex, idx });
      const detailsToggle = card.querySelector(".map-weather-day__toggle");
      const factsEl = card.querySelector(".map-weather-day__facts");
      if (detailsToggle && factsEl) {
        detailsToggle.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          setWeatherDayDetails(card, !card.classList.contains("is-details-open"));
        });
      }
      weatherDaysEl.appendChild(card);
    });

    weatherDaysEl._setDayDetails = setWeatherDayDetails;
    requestAnimationFrame(() => weatherDaysEl.classList.remove("is-opening"));
  };

  // Exportado: renderiza os MESMOS cards de previsão num container qualquer
  // (aba "Previsão" da estação meteorológica). Por padrão abre os detalhes,
  // já que ali há espaço de sobra.
  const renderForecastCards = (hostEl, rows, { limit = 7, detailsOpen = true } = {}) => {
    if (!hostEl) return 0;
    const todayIso = getTodayIsoSp();
    const safeRows = getVisibleWeatherRows(rows, todayIso).slice(0, limit);
    hostEl.innerHTML = "";
    if (!safeRows.length) {
      hostEl.innerHTML = `<div class="estd-forecast__empty">${tw("Previsão indisponível.", "Forecast unavailable.")}</div>`;
      return 0;
    }
    let todayIndex = safeRows.findIndex((row) => String(row?.date || "") === String(todayIso || ""));
    if (todayIndex < 0) todayIndex = 0;
    safeRows.forEach((row, idx) => {
      hostEl.appendChild(buildWeatherDayCard(row, { isToday: idx === todayIndex, idx, detailsOpen }));
    });
    return safeRows.length;
  };

  const renderWeatherFallbackCard = () => {
    const todayIso = getTodayIsoSp();
    renderWeatherCards([{
      date: todayIso,
      prob: NaN,
      et0: NaN,
      precip: NaN,
      tempMax: NaN,
      tempMin: NaN,
      tempMean: NaN,
      windSpeed: NaN,
      windDir: NaN,
      radiation: NaN,
      rhMean: NaN
    }], todayIso);
    weatherGridEl.hidden = false;
    weatherCardEl.classList.add("is-ready");
  };

  const buildOpenMeteoUrl = (lat, lng) => {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      daily: "precipitation_probability_max,et0_fao_evapotranspiration,wind_direction_10m_dominant,wind_speed_10m_max,temperature_2m_max,temperature_2m_min,precipitation_sum,shortwave_radiation_sum,temperature_2m_mean,relative_humidity_2m_mean",
      timezone: "America/Sao_Paulo",
      wind_speed_unit: "ms"
    });
    return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  };

  const readWeatherDailyCache = () => {
    try {
      const raw = localStorage.getItem(WEATHER_DAILY_CACHE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  };

  const writeWeatherDailyCache = (cache) => {
    try {
      localStorage.setItem(WEATHER_DAILY_CACHE_KEY, JSON.stringify(cache || {}));
    } catch (_) {}
  };

  const weatherCacheKey = (lat, lng, dayIso) => `${Number(lat).toFixed(5)}|${Number(lng).toFixed(5)}|${dayIso}`;

  const getDailyCachedWeather = (lat, lng, dayIso) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !dayIso) return null;
    const cache = readWeatherDailyCache();
    const hit = cache[weatherCacheKey(lat, lng, dayIso)];
    if (!hit || !Array.isArray(hit.rows) || !hit.rows.length) return null;
    return {
      ...hit,
      rows: getVisibleWeatherRows(hit.rows, dayIso)
    };
  };

  const setDailyCachedWeather = (lat, lng, dayIso, rows) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !dayIso || !Array.isArray(rows) || !rows.length) return;
    const cache = readWeatherDailyCache();
    cache[weatherCacheKey(lat, lng, dayIso)] = {
      rows: rows.slice(),
      fetchedAt: new Date().toISOString(),
      dayIso
    };
    writeWeatherDailyCache(cache);
  };

  const updateWeatherCard = async (lat, lng) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      renderWeatherFallbackCard();
      return;
    }

    const todayIso = getTodayIsoSp();
    const cached = getDailyCachedWeather(lat, lng, todayIso);
    if (cached) {
      renderWeatherCards(cached.rows, todayIso);
      weatherGridEl.hidden = false;
      weatherCardEl.classList.add("is-ready");
      return;
    }

    const reqId = ++requestSeq;
    try {
      weatherGridEl.hidden = false;
      const response = await fetch(buildOpenMeteoUrl(lat, lng), { method: "GET" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (reqId !== requestSeq) return;

      const daily = data?.daily || {};
      const dayTimes = Array.isArray(daily.time) ? daily.time : [];
      const rows = dayTimes.map((date, index) => ({
        date,
        prob: safeNum(daily.precipitation_probability_max?.[index]),
        et0: safeNum(daily.et0_fao_evapotranspiration?.[index]),
        precip: safeNum(daily.precipitation_sum?.[index]),
        tempMax: safeNum(daily.temperature_2m_max?.[index]),
        tempMin: safeNum(daily.temperature_2m_min?.[index]),
        tempMean: safeNum(daily.temperature_2m_mean?.[index]),
        windSpeed: safeNum(daily.wind_speed_10m_max?.[index]),
        windDir: safeNum(daily.wind_direction_10m_dominant?.[index]),
        radiation: safeNum(daily.shortwave_radiation_sum?.[index]),
        rhMean: safeNum(daily.relative_humidity_2m_mean?.[index])
      }));

      if (!rows.length) {
        renderWeatherFallbackCard();
      } else {
        renderWeatherCards(rows, todayIso);
        setDailyCachedWeather(lat, lng, todayIso, rows);
      }
      weatherGridEl.hidden = false;
      weatherCardEl.classList.add("is-ready");
    } catch (error) {
      if (reqId !== requestSeq) return;
      if (!weatherDaysEl.children.length) renderWeatherFallbackCard();
      weatherGridEl.hidden = false;
      weatherCardEl.classList.toggle("is-ready", !!weatherDaysEl.children.length);
      console.warn("[WeatherCard] Falha ao carregar previsão.", error);
    }
  };

  const refreshFromCurrentFarm = () => {
    const farm = getCurrentFarm();
    const farmKey = farm ? `${farm.id || ""}:${farm.lat || ""}:${farm.lng || ""}:${farm.loc || ""}` : "";
    if (farmKey === lastFarmKey && weatherCardEl.classList.contains("is-ready")) return;
    lastFarmKey = farmKey;
    const coords = getFarmWeatherCoords(farm);
    updateWeatherCard(coords.lat, coords.lng);
  };

  if (toggleEl && bodyEl) {
    toggleEl.addEventListener("click", () => {
      const isExpanded = weatherCardEl.classList.contains("is-expanded");

      if (!isExpanded) {
        // Fechado → Expandido: bottom fixed bar com 7 dias lado a lado
        bodyEl.classList.add("is-open");
        toggleEl.classList.add("is-open");
        toggleEl.setAttribute("aria-expanded", "true");
        bodyEl.setAttribute("aria-hidden", "false");
        weatherCardEl.classList.add("is-expanded");
        void weatherCardEl.offsetWidth; // trigger reflow for animation
        // Auto-expand all day details on open
        weatherDaysEl.querySelectorAll(".map-weather-day").forEach((dayCard) => {
          weatherDaysEl._setDayDetails?.(dayCard, true);
        });
      } else {
        // Expandido → Fechado
        weatherCardEl.classList.remove("is-expanded");
        bodyEl.classList.remove("is-open");
        toggleEl.classList.remove("is-open");
        toggleEl.setAttribute("aria-expanded", "false");
        bodyEl.setAttribute("aria-hidden", "true");
        requestAnimationFrame(syncSidebarLayout);
      }
    });
  }

  // Ensure weather card is closed by default on initial load
  const closeWeatherCard = () => {
    if (!toggleEl || !bodyEl) return;
    bodyEl.classList.remove("is-open");
    toggleEl.classList.remove("is-open");
    toggleEl.setAttribute("aria-expanded", "false");
    bodyEl.setAttribute("aria-hidden", "true");
    weatherCardEl.classList.remove("is-expanded");
  };

  // Inject expand hint element into the toggle header
  if (toggleEl && !toggleEl.querySelector(".weather-card__expand-hint")) {
    const hint = document.createElement("span");
    hint.className = "weather-card__expand-hint";
    hint.setAttribute("aria-hidden", "true");
    hint.innerHTML = `<i class="fa-solid fa-up-right-and-down-left-from-center"></i> Expandir`;
    // Insert before the chevron (last child)
    const chevron = toggleEl.querySelector(".weather-card__chevron");
    if (chevron) toggleEl.insertBefore(hint, chevron);
    else toggleEl.appendChild(hint);
  }


  renderWeatherFallbackCard();
  closeWeatherCard();
  refreshFromCurrentFarm();
  requestAnimationFrame(syncSidebarLayout);

  let resizeRaf = null;
  const onResize = () => {
    if (resizeRaf !== null) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = null;
      syncSidebarLayout();
    });
  };

  let farmWatchTimer = null;
  let weatherRefreshTimer = null;
  const refreshWeatherTick = () => {
    const farm = getCurrentFarm();
    const coords = getFarmWeatherCoords(farm);
    updateWeatherCard(coords.lat, coords.lng);
  };
  const startPolling = () => {
    if (farmWatchTimer === null) farmWatchTimer = setInterval(refreshFromCurrentFarm, FARM_WATCH_INTERVAL_MS);
    if (weatherRefreshTimer === null) weatherRefreshTimer = setInterval(refreshWeatherTick, REFRESH_INTERVAL_MS);
  };
  const stopPolling = () => {
    if (farmWatchTimer !== null) { clearInterval(farmWatchTimer); farmWatchTimer = null; }
    if (weatherRefreshTimer !== null) { clearInterval(weatherRefreshTimer); weatherRefreshTimer = null; }
  };

  window.IcWeatherCardRefresh = refreshFromCurrentFarm;

  // Exposto para outras telas (ex.: detalhe da Estação Meteorológica) usarem
  // exatamente a mesma previsão do card "Clima" — mesma fonte, mesmo cache,
  // coordenadas da fazenda ativa.
  window.IcMapWeather = window.IcMapWeather || {};
  window.IcMapWeather.renderForecastCards = renderForecastCards;
  window.IcMapWeather.getDailyRows = async () => {
    const farm = getCurrentFarm();
    const coords = getFarmWeatherCoords(farm);
    if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
      return Array.isArray(lastRenderedRows) ? lastRenderedRows.slice() : [];
    }
    const todayIso = getTodayIsoSp();
    const cached = getDailyCachedWeather(coords.lat, coords.lng, todayIso);
    if (cached && Array.isArray(cached.rows) && cached.rows.length) return cached.rows.slice();
    try { await updateWeatherCard(coords.lat, coords.lng); } catch (_) {}
    const after = getDailyCachedWeather(coords.lat, coords.lng, todayIso);
    if (after && Array.isArray(after.rows)) return after.rows.slice();
    return Array.isArray(lastRenderedRows) ? lastRenderedRows.slice() : [];
  };
  window.IcMapSidebarLayoutSync = syncSidebarLayout;
  window.addEventListener("ic:layout-change", refreshFromCurrentFarm);
  window.addEventListener("ic:lang-change", refreshFromCurrentFarm);
  window.addEventListener("resize", onResize);
  window.addEventListener("focus", refreshFromCurrentFarm);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopPolling();
    } else {
      refreshFromCurrentFarm();
      startPolling();
    }
  });

  if (!document.hidden) startPolling();
})();
