(function () {
  "use strict";
  const tMsg = (text) => window.IcI18n?.t?.(text) ?? text;
  const Cad = (window.Cad = window.Cad || {});

  const state = Cad.state;
  const FARM_API_URL = Cad.FARM_API_URL;
  const ENERGIA_STORAGE_KEY = "ic_relatorios_energia";
  const APP_STATE_STORAGE_KEY = "ic_app_state_v1";
  const FARM_FRESH_START_RESET_KEY = "ic_farm_fresh_start_reset_v3";
  const FARM_EMPTY_START_KEY = "ic_farm_empty_start_v3";

  // Versão da semente já aplicada neste navegador. Sem backend (GitHub
  // Pages), o localStorage manda; mas quando publicamos um farms.json novo
  // ele precisa chegar a quem já visitou o site, senão a cópia antiga do
  // navegador esconde os dados atualizados para sempre.
  const FARM_SEED_VERSION_KEY = "ic_farms_seed_version";
  const PLUV_EMPTY_START_KEY = "ic_pluvio_empty_start_v2";
  let appStatePersistChain = Promise.resolve();

  function decodeLikelyMojibake(value) { return Cad.encoding.decodeLikelyMojibake(value); }
  function sanitizeMojibakeDeep(value, seen) { return Cad.encoding.sanitizeMojibakeDeep(value, seen); }

  function normalizeFarmRecord(farm) {
    const src = sanitizeMojibakeDeep(farm && typeof farm === "object" ? farm : {});
    const latAlt = src.lat ?? src.latitude ?? src.location?.lat ?? src.location?.latitude ?? src.coords?.lat;
    const lngAlt = src.lng ?? src.longitude ?? src.location?.lng ?? src.location?.longitude ?? src.coords?.lng;

    // Migrate: merge legacy `equipamentos` key into canonical `equipments`, deduplicating by id.
    // Also strip entries that were auto-injected by the old pivos equipment bridge (_fromPivos flag).
    const listA = Array.isArray(src.equipments) ? src.equipments : [];
    const listB = Array.isArray(src.equipamentos) ? src.equipamentos : [];
    const seenIds = new Set();
    const mergedEquipments = [...listA, ...listB].filter((e) => {
      if (e?.data?._fromPivos) return false; // remove old bridge auto-injections
      const eid = String(e?.id || "");
      if (!eid || seenIds.has(eid)) return false;
      seenIds.add(eid);
      return true;
    });

    const normalized = {
      ...src,
      lat: latAlt ?? "",
      lng: lngAlt ?? "",
      owner: src.owner ?? src.proprietario ?? "",
      contact: src.contact ?? src.technical?.contact_phone ?? src.phone ?? src.email ?? src.billing?.phone ?? src.billing?.email ?? "",
      equipments: mergedEquipments,
    };
    delete normalized.equipamentos;
    return normalized;
  }

  function normalizeFarmDataset(farms) {
    return (Array.isArray(farms) ? farms : []).map(normalizeFarmRecord);
  }

  function resetFarmOperationalMemoryIfNeeded() {
    try {
      if (localStorage.getItem(FARM_FRESH_START_RESET_KEY) === "1") return false;
    } catch (_) { }

    let changed = false;
    let farms = [];

    try {
      const stored = JSON.parse(localStorage.getItem("ic_farms") || "null");
      if (Array.isArray(stored)) {
        farms = stored;
      }
    } catch (_) { }

    if (!farms.length && Array.isArray(window.IcData?.cadastros?.fazendas)) {
      farms = window.IcData.cadastros.fazendas;
    }

    const safeFarms = normalizeFarmDataset(farms);
    if (safeFarms.length) changed = true;

    try {
      localStorage.setItem("ic_farms", JSON.stringify([]));
      sessionStorage.removeItem("ic_active_farm");
      sessionStorage.removeItem("ic_active_farm_id");

      const talhoesRaw = localStorage.getItem("ic_talhoes");
      if (talhoesRaw && talhoesRaw !== "{}") changed = true;
      localStorage.removeItem("ic_talhoes");

      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (
          key.startsWith("ic_pluvios_") ||
          key.startsWith("ic_talhoes_") ||
          key.startsWith("talhoes_")
        ) {
          keysToRemove.push(key);
        }
      }
      if (keysToRemove.length) changed = true;
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch (_) { }

    if (window.IcData?.cadastros) {
      window.IcData.cadastros.talhoes = {};
      window.IcData.cadastros.fazendas = [];
    }
    window.IcFarmsAll = [];
    window.IcFarmActive = null;

    try {
      localStorage.setItem(FARM_FRESH_START_RESET_KEY, "1");
      if (changed) {
        localStorage.setItem(FARM_EMPTY_START_KEY, "1");
        localStorage.setItem(PLUV_EMPTY_START_KEY, "1");
      }
    } catch (_) { }

    return changed;
  }

  function syncFarmDataset(farms) {
    const safeFarms = normalizeFarmDataset(farms);
    window.IcData = window.IcData || {};
    window.IcData.cadastros = window.IcData.cadastros || {};
    window.IcData.cadastros.fazendas = safeFarms;
    try { localStorage.setItem("ic_farms", JSON.stringify(safeFarms)); } catch (_) { }
    try {
      const activeFarmId = sessionStorage.getItem("ic_active_farm") || sessionStorage.getItem("ic_active_farm_id");
      const hasActiveFarm = activeFarmId && safeFarms.some((farm) => String(farm?.id || "") === String(activeFarmId));
      if (activeFarmId && !hasActiveFarm) {
        sessionStorage.removeItem("ic_active_farm");
        sessionStorage.removeItem("ic_active_farm_id");
        if (window.IcFarmActive?.id && String(window.IcFarmActive.id) === String(activeFarmId)) {
          window.IcFarmActive = null;
        }
      }
    } catch (_) { }
    try {
      if (safeFarms.length > 0) localStorage.removeItem(FARM_EMPTY_START_KEY);
    } catch (_) { }
  }

  function getAllFarms() {
    try {
      const stored = JSON.parse(localStorage.getItem("ic_farms") || "null");
      if (Array.isArray(stored) && stored.length) {
        window.IcData = window.IcData || {};
        window.IcData.cadastros = window.IcData.cadastros || {};
        window.IcData.cadastros.fazendas = stored;
        return normalizeFarmDataset(stored);
      }
    } catch (_) { }
    const farms = window.IcData?.cadastros?.fazendas;
    if (Array.isArray(farms)) return normalizeFarmDataset(farms);
    return [];
  }

  // Requisição de carga em andamento. loadFarmDataset é disparado a cada troca
  // de tela e também depois de salvar, então várias chamadas se acumulavam em
  // paralelo pedindo o mesmo dataset — era isso que enchia a aba Network de
  // requisições `farms` e fazia a navegação parecer travada. Enquanto uma
  // estiver voando, as demais aguardam a mesma promessa.
  let farmDatasetLoadInFlight = null;

  async function loadFarmDataset() {
    if (farmDatasetLoadInFlight) return farmDatasetLoadInFlight;
    farmDatasetLoadInFlight = loadFarmDatasetUncached()
      .finally(() => { farmDatasetLoadInFlight = null; });
    return farmDatasetLoadInFlight;
  }

  async function loadFarmDatasetUncached() {
    const apiUrl = `${window.IC_API_CONFIG?.baseUrl || ""}/api/farms`;
    if (window.IC_API_CONFIG?.usesStaticData) {
      // Sem backend (GitHub Pages), o localStorage é a única persistência que
      // existe: é para lá que persistFarmDataset grava, e as edições do
      // usuário têm precedência sobre farms.json. Recarregar o JSON a cada
      // chamada — como se fazia antes — desfazia toda edição salva, porque
      // esta função roda a cada troca de tela.
      //
      // A exceção é um deploy novo: quando o farms.json publicado muda, ele
      // repovoa uma vez e sobrescreve a cópia guardada. Sem isso, quem já
      // visitou o site nunca veria os dados atualizados.
      let seedFarms = null;
      let seedVersion = "";
      try {
        const response = await fetch("./data/farms.json", { cache: "no-store" });
        if (response.ok) {
          seedVersion = response.headers.get("etag")
            || response.headers.get("last-modified")
            || "";
          const parsed = await response.json();
          if (Array.isArray(parsed)) seedFarms = parsed;
        }
      } catch (_) { }

      try {
        const appliedVersion = localStorage.getItem(FARM_SEED_VERSION_KEY) || "";
        // DEMO: a semente só vale na 1ª visita — nunca sobrescreve o que o
        // usuário criou (use o botão "Resetar demo" para voltar ao zero).
        if (!window.IC_DEMO && seedFarms && seedVersion && seedVersion !== appliedVersion) {
          syncFarmDataset(seedFarms);
          localStorage.setItem(FARM_SEED_VERSION_KEY, seedVersion);
          if (seedFarms.length > 0) localStorage.removeItem(FARM_EMPTY_START_KEY);
          return true;
        }
      } catch (_) { }

      try {
        const stored = JSON.parse(localStorage.getItem("ic_farms") || "null");
        if (Array.isArray(stored) && stored.length > 0) {
          syncFarmDataset(stored);
          return true;
        }
        // Base zerada de propósito pelo usuário: respeita o estado vazio em vez
        // de repovoar tudo com a semente.
        if (Array.isArray(stored) && localStorage.getItem(FARM_EMPTY_START_KEY) === "1") {
          syncFarmDataset(stored);
          return true;
        }
      } catch (_) { }

      // Primeira visita: aplica a semente já carregada acima.
      if (Array.isArray(seedFarms)) {
        syncFarmDataset(seedFarms);
        try {
          if (seedVersion) localStorage.setItem(FARM_SEED_VERSION_KEY, seedVersion);
          if (seedFarms.length > 0) localStorage.removeItem(FARM_EMPTY_START_KEY);
        } catch (_) { }
        return true;
      }
      console.warn("[Cadastros] Falha ao carregar fazendas da base estatica.");
    }

    // Try API first if configured
    if (window.IC_API_CONFIG?.baseUrl) {
      try {
        const response = await fetch(apiUrl, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json().catch(() => null);
        const apiFarms = Array.isArray(payload) ? payload : payload?.farms;
        if (Array.isArray(apiFarms)) {
          syncFarmDataset(apiFarms);
          try {
            if (apiFarms.length > 0) localStorage.removeItem(FARM_EMPTY_START_KEY);
          } catch (_) { }
          return true;
        }
      } catch (error) {
        console.warn("[Cadastros] Falha ao carregar fazendas da API.", error);
      }
    }

    try {
      const stored = JSON.parse(localStorage.getItem("ic_farms") || "null");
      if (localStorage.getItem(FARM_EMPTY_START_KEY) === "1" && (!Array.isArray(stored) || stored.length === 0)) {
        syncFarmDataset([]);
        return true;
      }
    } catch (_) { }

    // If localStorage is empty, seed from static data/farms.json
    try {
      const stored = localStorage.getItem("ic_farms");
      const hasStored = stored && stored !== "[]" && stored !== "null";
      if (!hasStored) {
        const r = await fetch("./data/farms.json");
        if (r.ok) {
          const farms = await r.json();
          if (Array.isArray(farms) && farms.length) {
            syncFarmDataset(farms);
            console.info("[Cadastros] Base de dados inicializada a partir de data/farms.json");
            return true;
          }
        }
      }
    } catch (_) { }

    return false;
  }

  async function persistFarmDataset(farms) {
    const safeFarms = normalizeFarmDataset(farms);
    syncFarmDataset(safeFarms);

    const apiUrl = `${window.IC_API_CONFIG?.baseUrl || ""}/api/farms`;
    if (!window.IC_API_CONFIG?.baseUrl) return true;

    // O dado já está salvo localmente (syncFarmDataset acima). O envio à API é
    // uma réplica: se demorar ou cair, o salvamento não pode ficar pendurado
    // esperando por ele — era isso que deixava o botão Salvar desabilitado por
    // vários segundos e dava a impressão de que a tela tinha travado.
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 5000) : null;

    try {
      const response = await fetch(apiUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(safeFarms),
        signal: controller?.signal
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const payload = await response.json().catch(() => null);
      const apiFarms = Array.isArray(payload) ? payload : payload?.farms;
      if (Array.isArray(apiFarms)) {
        syncFarmDataset(apiFarms);
      }
      return true;
    } catch (error) {
      console.warn("[Cadastros] Falha ao persistir fazendas na API. Usando backup local.", error);
      // O backup local já foi gravado, então o salvamento é considerado bem
      // sucedido: retornar false aqui mostraria um erro ao usuário mesmo com o
      // dado preservado.
      return true;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  function normalizeEnergiaDataset(source) {
    const src = sanitizeMojibakeDeep(source && typeof source === "object" ? source : {});
    return {
      contratos: Array.isArray(src.contratos) ? src.contratos : [],
      energia_mensal: Array.isArray(src.energia_mensal) ? src.energia_mensal : [],
      feriados: Array.isArray(src.feriados) ? src.feriados : []
    };
  }

  function normalizeOperacaoDataset(source) {
    const src = sanitizeMojibakeDeep(source && typeof source === "object" ? source : {});
    const activitiesByFarm = src.activitiesByFarm && typeof src.activitiesByFarm === "object" && !Array.isArray(src.activitiesByFarm)
      ? src.activitiesByFarm
      : {};
    const completionCounter = Number(src.completionCounter);
    return {
      activitiesByFarm: Object.fromEntries(
        Object.entries(activitiesByFarm).map(([key, value]) => [String(key), Array.isArray(value) ? value : []])
      ),
      completionCounter: Number.isFinite(completionCounter) && completionCounter >= 0
        ? Math.floor(completionCounter)
        : 0
    };
  }

  function defaultAppState() {
    return {
      energia: normalizeEnergiaDataset(null),
      talhoesByFarm: {},
      pluviosByFarm: {},
      operacao: normalizeOperacaoDataset(null)
    };
  }

  function normalizeAppState(source) {
    const src = sanitizeMojibakeDeep(source && typeof source === "object" ? source : {});
    const talhoesByFarm = src.talhoesByFarm && typeof src.talhoesByFarm === "object" && !Array.isArray(src.talhoesByFarm)
      ? src.talhoesByFarm
      : {};
    const pluviosByFarm = src.pluviosByFarm && typeof src.pluviosByFarm === "object" && !Array.isArray(src.pluviosByFarm)
      ? src.pluviosByFarm
      : {};
    const normalizeMapOfLists = (mapObj) => Object.fromEntries(
      Object.entries(mapObj).map(([key, value]) => [String(key), Array.isArray(value) ? value : []])
    );

    return {
      energia: normalizeEnergiaDataset(src.energia),
      talhoesByFarm: normalizeMapOfLists(talhoesByFarm),
      pluviosByFarm: normalizeMapOfLists(pluviosByFarm),
      operacao: normalizeOperacaoDataset(src.operacao)
    };
  }

  function syncAppStateCache(appState) {
    const normalized = normalizeAppState(appState);
    window.IcAppState = normalized;
    window.IcData = window.IcData || {};
    window.IcData.cadastros = window.IcData.cadastros || {};
    window.IcData.relatorios = window.IcData.relatorios || {};
    window.IcData.cadastros.talhoes = normalized.talhoesByFarm;
    window.IcData.relatorios.energia = normalized.energia;
    try { localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(normalized)); } catch (_) { }
    try { localStorage.setItem(ENERGIA_STORAGE_KEY, JSON.stringify(normalized.energia)); } catch (_) { }
    try { localStorage.setItem("ic_talhoes", JSON.stringify(normalized.talhoesByFarm)); } catch (_) { }
    try {
      Object.entries(normalized.talhoesByFarm).forEach(([farmId, items]) => {
        localStorage.setItem(`talhoes_${farmId}`, JSON.stringify(Array.isArray(items) ? items : []));
      });
      Object.entries(normalized.pluviosByFarm).forEach(([farmId, items]) => {
        localStorage.setItem(`ic_pluvios_${farmId}`, JSON.stringify(Array.isArray(items) ? items : []));
      });
    } catch (_) { }
    return normalized;
  }

  function getLegacyAppStateSnapshot() {
    const next = defaultAppState();
    try {
      const energiaRaw = JSON.parse(localStorage.getItem(ENERGIA_STORAGE_KEY) || "null");
      next.energia = normalizeEnergiaDataset(energiaRaw);
    } catch (_) { }
    try {
      const talhoesRaw = JSON.parse(localStorage.getItem("ic_talhoes") || "null");
      if (talhoesRaw && typeof talhoesRaw === "object" && !Array.isArray(talhoesRaw)) {
        next.talhoesByFarm = Object.fromEntries(
          Object.entries(talhoesRaw).map(([key, value]) => [String(key), Array.isArray(value) ? value : []])
        );
      }
    } catch (_) { }
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith("ic_pluvios_")) continue;
        const farmId = key.slice("ic_pluvios_".length);
        try {
          const raw = JSON.parse(localStorage.getItem(key) || "null");
          next.pluviosByFarm[farmId] = Array.isArray(raw) ? raw : [];
        } catch (_) {
          next.pluviosByFarm[farmId] = [];
        }
      }
    } catch (_) { }
    try {
      const legacyActivities = JSON.parse(localStorage.getItem("ic_op_activities") || "null");
      if (Array.isArray(legacyActivities)) {
        const farmId = getCurrentContextFarmId() || "default";
        next.operacao.activitiesByFarm[farmId] = legacyActivities;
      }
    } catch (_) { }
    try {
      const legacyCounter = Number(localStorage.getItem("ic_op_completion_counter"));
      if (Number.isFinite(legacyCounter) && legacyCounter >= 0) {
        next.operacao.completionCounter = Math.floor(legacyCounter);
      }
    } catch (_) { }
    return normalizeAppState(next);
  }

  function getSharedAppState() {
    if (window.IcAppState) return normalizeAppState(window.IcAppState);
    try {
      const stored = JSON.parse(localStorage.getItem(APP_STATE_STORAGE_KEY) || "null");
      if (stored && typeof stored === "object") {
        return syncAppStateCache(stored);
      }
    } catch (_) { }
    return syncAppStateCache(getLegacyAppStateSnapshot());
  }

  async function loadSharedAppState() {
    const apiUrl = `${window.IC_API_CONFIG?.baseUrl || ""}/api/app-state`;
    if (window.IC_API_CONFIG?.baseUrl) {
      try {
        const response = await fetch(apiUrl, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json().catch(() => null);
        if (payload && typeof payload === "object") {
          syncAppStateCache(payload);
          return true;
        }
      } catch (error) {
        console.warn("[Cadastros] Falha ao carregar estado compartilhado da API.", error);
      }
    }

    // Sem backend, o estado salvo localmente tem precedência sobre o JSON
    // estático — este é apenas a semente da primeira visita. Sem isso, cada
    // navegação recarregava o arquivo e desfazia o que havia sido salvo.
    if (!window.IC_API_CONFIG?.baseUrl) {
      try {
        const stored = JSON.parse(localStorage.getItem(APP_STATE_STORAGE_KEY) || "null");
        if (stored && typeof stored === "object") {
          syncAppStateCache(stored);
          return true;
        }
      } catch (_) { }
    }

    try {
      const response = await fetch("../data/app-state.json", { headers: { Accept: "application/json" } });
      if (response.ok) {
        const payload = await response.json().catch(() => null);
        if (payload && typeof payload === "object") {
          syncAppStateCache(payload);
          return true;
        }
      }
    } catch (_) { }

    syncAppStateCache(getSharedAppState());
    return false;
  }

  function persistSharedAppState(nextState) {
    const normalized = syncAppStateCache(nextState);
    if (!window.IC_API_CONFIG?.baseUrl) return Promise.resolve(normalized);

    const apiUrl = `${window.IC_API_CONFIG.baseUrl}/api/app-state`;
    appStatePersistChain = appStatePersistChain
      .catch(() => null)
      .then(async () => {
        try {
          const response = await fetch(apiUrl, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(normalized)
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const payload = await response.json().catch(() => null);
          const serverState = payload?.appState || payload;
          if (serverState && typeof serverState === "object") {
            return syncAppStateCache(serverState);
          }
          return normalized;
        } catch (error) {
          console.warn("[Cadastros] Falha ao persistir estado compartilhado na API. Usando backup local.", error);
          return normalized;
        }
      });
    return appStatePersistChain;
  }

  function updateSharedAppState(mutator) {
    const current = getSharedAppState();
    const candidate = typeof mutator === "function" ? mutator(current) : mutator;
    const next = normalizeAppState(candidate && typeof candidate === "object"
      ? { ...current, ...candidate }
      : current);
    syncAppStateCache(next);
    persistSharedAppState(next);
    return next;
  }

  function loadEnergiaDataset() {
    window.IcData = window.IcData || {};
    window.IcData.relatorios = window.IcData.relatorios || {};
    const appState = getSharedAppState();
    const normalized = normalizeEnergiaDataset(appState.energia || window.IcData.relatorios.energia);
    window.IcData.relatorios.energia = normalized;
    try { localStorage.setItem(ENERGIA_STORAGE_KEY, JSON.stringify(normalized)); } catch (_) { }
    return normalized;
  }

  function persistEnergiaDataset(energia) {
    window.IcData = window.IcData || {};
    window.IcData.relatorios = window.IcData.relatorios || {};

    const normalized = normalizeEnergiaDataset(energia || window.IcData.relatorios.energia);
    window.IcData.relatorios.energia = normalized;
    try { localStorage.setItem(ENERGIA_STORAGE_KEY, JSON.stringify(normalized)); } catch (_) { }
    updateSharedAppState((appState) => ({
      ...appState,
      energia: normalized
    }));
    return normalized;
  }

  function getActiveFarmView() {
    const farm = window.IcFarmActive || getAllFarms()[0] || null;
    if (farm) {
      const lat = Number(farm.lat);
      const lng = Number(farm.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
        return { center: [lat, lng], zoom: 14 };
      }
      // Fallback: usar coordenadas da central da fazenda
      const cLat = Number(farm.centralLat);
      const cLng = Number(farm.centralLng);
      if (Number.isFinite(cLat) && Number.isFinite(cLng) && (cLat !== 0 || cLng !== 0)) {
        return { center: [cLat, cLng], zoom: 14 };
      }
    }
    // Fallback: usar o primeiro pivô cadastrado
    const pivoRecords = getAllPivosRecords();
    for (const p of pivoRecords) {
      const lat = Number(p.lat ?? p.center?.lat);
      const lng = Number(p.lng ?? p.center?.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
        return { center: [lat, lng], zoom: 14 };
      }
    }
    // Fallback: usar o primeiro equipamento com coordenadas cadastradas
    const allFarmsEq = getAllFarms();
    for (const f of allFarmsEq) {
      for (const e of (Array.isArray(f.equipments) ? f.equipments : [])) {
        const lat = Number(e?.data?.lat ?? e?.lat);
        const lng = Number(e?.data?.lng ?? e?.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
          return { center: [lat, lng], zoom: 14 };
        }
      }
    }
    return Cad.BR_VIEW;
  }

  function getCurrentContextFarmId() {
    const farms = getAllFarms();
    if (!farms.length) return "";
    const activeFarm = window.IcFarmActive;
    if (activeFarm?.id && farms.some((farm) => String(farm.id) === String(activeFarm.id))) {
      return String(activeFarm.id);
    }
    return String(farms[0].id || "");
  }

  // --- Talhoes Storage ---
  function _loadTalhoesFromStorage() {
    const appState = getSharedAppState();
    window.IcData = window.IcData || {};
    window.IcData.cadastros = window.IcData.cadastros || {};
    window.IcData.cadastros.talhoes = appState.talhoesByFarm || {};
    try { localStorage.setItem("ic_talhoes", JSON.stringify(window.IcData.cadastros.talhoes)); } catch (_) { }
  }

  function getTalhoesByFarm(farmId) {
    if (!farmId) return [];
    const talhoes = window.IcData?.cadastros?.talhoes;
    if (!talhoes) return [];
    return Array.isArray(talhoes[farmId]) ? talhoes[farmId] : [];
  }

  function saveTalhoesByFarm(farmId, items) {
    if (!farmId) return;
    window.IcData = window.IcData || {};
    window.IcData.cadastros = window.IcData.cadastros || {};
    window.IcData.cadastros.talhoes = window.IcData.cadastros.talhoes || {};
    window.IcData.cadastros.talhoes[farmId] = Array.isArray(items) ? items : [];
    try { localStorage.setItem("ic_talhoes", JSON.stringify(window.IcData.cadastros.talhoes)); } catch (_) { }
    updateSharedAppState((appState) => ({
      ...appState,
      talhoesByFarm: {
        ...(appState.talhoesByFarm || {}),
        [String(farmId)]: Array.isArray(items) ? items : []
      }
    }));
  }

  function getPluviosByFarm(farmId) {
    if (!farmId) return [];
    const appState = getSharedAppState();
    const map = appState.pluviosByFarm || {};
    return Array.isArray(map[farmId]) ? map[farmId] : [];
  }

  function savePluviosByFarm(farmId, items) {
    if (!farmId) return;
    const safeItems = Array.isArray(items) ? items : [];
    try { localStorage.setItem(`ic_pluvios_${farmId}`, JSON.stringify(safeItems)); } catch (_) { }
    updateSharedAppState((appState) => ({
      ...appState,
      pluviosByFarm: {
        ...(appState.pluviosByFarm || {}),
        [String(farmId)]: safeItems
      }
    }));
  }

  function getOperacaoByFarm(farmId) {
    if (!farmId) return [];
    const appState = getSharedAppState();
    const operacao = normalizeOperacaoDataset(appState.operacao);
    return Array.isArray(operacao.activitiesByFarm[farmId]) ? operacao.activitiesByFarm[farmId] : [];
  }

  function saveOperacaoByFarm(farmId, items, completionCounter) {
    if (!farmId) return;
    const safeItems = Array.isArray(items) ? items : [];
    updateSharedAppState((appState) => {
      const operacaoAtual = normalizeOperacaoDataset(appState.operacao);
      const nextCounter = Number(completionCounter);
      return {
        ...appState,
        operacao: {
          activitiesByFarm: {
            ...(operacaoAtual.activitiesByFarm || {}),
            [String(farmId)]: safeItems
          },
          completionCounter: Number.isFinite(nextCounter) && nextCounter >= 0
            ? Math.floor(nextCounter)
            : operacaoAtual.completionCounter
        }
      };
    });
  }

  function getOperacaoCompletionCounter() {
    const appState = getSharedAppState();
    return normalizeOperacaoDataset(appState.operacao).completionCounter;
  }

  function nextOperacaoCompletionCounter() {
    const next = getOperacaoCompletionCounter() + 1;
    updateSharedAppState((appState) => {
      const operacaoAtual = normalizeOperacaoDataset(appState.operacao);
      return {
        ...appState,
        operacao: {
          ...operacaoAtual,
          completionCounter: next
        }
      };
    });
    return next;
  }

  function parseTalhaoCompositeId(compositeId) {
    const raw = String(compositeId || "");
    const sep = raw.indexOf("::");
    if (sep === -1) return null;
    return {
      farmId: decodeURIComponent(raw.slice(0, sep)),
      talhaoId: decodeURIComponent(raw.slice(sep + 2))
    };
  }

  function buildTalhaoCompositeId(farmId, talhaoId) {
    return `${encodeURIComponent(String(farmId || ""))}::${encodeURIComponent(String(talhaoId || ""))}`;
  }

  function getCurrentTalhaoFormFarmId() {
    const parsed = parseTalhaoCompositeId(state.editingId);
    return parsed?.farmId ? String(parsed.farmId) : getCurrentContextFarmId();
  }

  function getCurrentEditingTalhaoId() {
    const parsed = parseTalhaoCompositeId(state.editingId);
    return parsed?.talhaoId ? String(parsed.talhaoId) : "";
  }

  function getAllTalhoesRecords(farmFilterId = null) {
    if (false && state.currentType === "sistemas-irrigacao") {
      const parsed = parsePivoCompositeId(id);
      if (!parsed?.pivoId) return;
      const farms = getAllFarms();
      const farm = farms.find((item) => String(item.id) === String(parsed.farmId));
      if (!farm) return;
      farm.pivos = Array.isArray(farm.pivos) ? farm.pivos : [];
      const sourcePivo = farm.pivos.find((item) => String(item.id) === String(parsed.pivoId));
      if (!sourcePivo) return;
      const clone = JSON.parse(JSON.stringify(sourcePivo));
      clone.id = `pivo_${Date.now()}`;
      clone.name = `${clone.name || "Pivô Central"} (Cópia)`;
      farm.pivos.push(clone);
      persistFarmDataset(farms);
      Cad.lists.renderPivos();
      alert(tMsg("Pivô central duplicado com sucesso!"));
      return;
    }

    if (false && state.currentType === "sistemas-irrigacao") {
      const parsed = parsePivoCompositeId(id);
      if (!parsed?.farmId || !parsed?.pivoId) return;
      const farms = getAllFarms();
      const farm = farms.find((item) => String(item.id) === String(parsed.farmId));
      if (!farm) return;
      farm.pivos = Array.isArray(farm.pivos) ? farm.pivos : [];
      const sourcePivo = farm.pivos.find((item) => String(item.id) === String(parsed.pivoId));
      if (!sourcePivo) return;

      const clone = JSON.parse(JSON.stringify(sourcePivo));
      clone.id = `pivo_${Date.now()}`;
      clone.name = `${clone.name || "Pivô Central"} (Cópia)`;
      farm.pivos.push(clone);
      persistFarmDataset(farms);
      Cad.lists.renderPivos();
      alert(tMsg("Pivô central duplicado com sucesso!"));
      return;
    }

    const farms = getAllFarms();
    const targetFarmId = String(farmFilterId || getCurrentContextFarmId() || "");
    const rows = [];
    farms.forEach((farm) => {
      if (targetFarmId && String(farm.id) !== targetFarmId) return;
      const items = getTalhoesByFarm(farm.id);
      items.forEach((item) => {
        rows.push({
          ...item,
          farmId: farm.id,
          farmName: farm.name || "-"
        });
      });
    });
    return rows;
  }

  // --- Pivos Data ---
  function parsePivoCompositeId(compositeId) {
    const raw = String(compositeId || "");
    const sep = raw.indexOf("::");
    if (sep === -1) return null;
    return {
      farmId: decodeURIComponent(raw.slice(0, sep)),
      pivoId: decodeURIComponent(raw.slice(sep + 2))
    };
  }

  function buildPivoCompositeId(farmId, pivoId) {
    return `${encodeURIComponent(String(farmId || ""))}::${encodeURIComponent(String(pivoId || ""))}`;
  }

  function getAllPivosRecords(farmFilterId = null) {
    const farms = getAllFarms();
    const targetFarmId = String(farmFilterId || getCurrentContextFarmId() || "");
    const rows = [];
    const seen = new Set();
    farms.forEach((farm) => {
      if (targetFarmId && String(farm.id) !== targetFarmId) return;
      const list = Array.isArray(farm.pivos) ? farm.pivos : [];
      list.forEach((pivo) => {
        const key = `${farm.id}::${pivo?.id || ""}`;
        if (seen.has(key)) return;
        seen.add(key);
        rows.push({
          ...pivo,
          farmId: farm.id,
          farmName: farm.name || "-"
        });
      });

      const equipments = Array.isArray(farm.equipments) ? farm.equipments : [];
      equipments
        .filter((equip) => String(equip?.category || "").toLowerCase() === "pivos")
        .forEach((equip) => {
          const data = equip?.data || {};
          const pivoId = equip?.id || `pivo_${Date.now()}`;
          const key = `${farm.id}::${pivoId}`;
          if (seen.has(key)) return;
          seen.add(key);

          rows.push({
            id: pivoId,
            farmId: farm.id,
            farmName: farm.name || "-",
            name: equip?.name || data?.name || "Pivo Central",
            manufacturer: data?.manufacturer || "",
            panelType: data?.panelType || "",
            communicationType: data?.communicationType || data?.commType || "",
            lat: data?.centerLat ?? data?.lat ?? "",
            lng: data?.centerLng ?? data?.lng ?? "",
            refLat: data?.refLat ?? "",
            refLng: data?.refLng ?? "",
            radius: data?.radius ?? "",
            flow: data?.flow ?? data?.performance ?? "",
            pumpPower: data?.pumpPower ?? data?.power ?? "",
            data
          });
        });
    });
    return rows;
  }

  function normalizePivoRecord(source, farmId) {
    const src = source && typeof source === "object" ? source : {};
    const srcData = src.data && typeof src.data === "object" ? src.data : {};
    const normalizeParcelas = (value) => {
      const list = Array.isArray(value) ? value : [];
      return list
        .map((item, idx) => {
          const start = Number(item?.startAngle);
          const end = Number(item?.endAngle);
          return {
            id: String(item?.id || `parcela_${idx + 1}`),
            name: String(item?.name || "").trim() || `Parcela ${idx + 1}`,
            startAngle: Number.isFinite(start) ? ((start % 360) + 360) % 360 : 0,
            endAngle: Number.isFinite(end) ? ((end % 360) + 360) % 360 : 360
          };
        })
        .filter((item) => item.name);
    };
    const normalizeSegments = (value) => {
      const list = Array.isArray(value) ? value : [];
      if (!list.length) return [{ id: "seg_0", name: "", startAngle: 0, endAngle: 360 }];
      return list.map((item, idx) => {
        const start = Number(item?.startAngle);
        const end = Number(item?.endAngle);
        return {
          id: String(item?.id || `seg_${idx}`),
          name: String(item?.name || ""),
          startAngle: Number.isFinite(start) ? ((start % 360) + 360) % 360 : 0,
          endAngle: Number.isFinite(end) ? ((end % 360) + 360) % 360 : 360
        };
      });
    };
    const toBooleanFlag = Cad.geo.toBooleanFlag;
    const inferredControllerType = (() => {
      const current = String(src.controllerType || srcData.controllerType || "").trim();
      if (current) return current;
      const panelTypeRaw = String(src.panelType || srcData.panelType || "").toLowerCase();
      if (panelTypeRaw.includes("smart touch") || panelTypeRaw.includes("smarttouch")) return "smarttouch";
      if (panelTypeRaw.includes("smart connect") || panelTypeRaw.includes("smartconnect") || panelTypeRaw.includes("nexus")) return "smart_connect";
      return "none";
    })();

    return {
      id: src.id || `pivo_${Date.now()}`,
      farmId: farmId || src.farmId || "",
      talhaoIds: Array.isArray(src.talhaoIds)
        ? src.talhaoIds.map((id) => String(id))
        : Array.isArray(srcData.talhaoIds)
          ? srcData.talhaoIds.map((id) => String(id))
          : [],
      pumpIds: Array.isArray(src.pumpIds)
        ? src.pumpIds.map((id) => String(id))
        : Array.isArray(srcData.pumpIds)
          ? srcData.pumpIds.map((id) => String(id))
          : [],
      monitorIds: Array.isArray(src.monitorIds)
        ? src.monitorIds.map((id) => String(id))
        : Array.isArray(srcData.monitorIds)
          ? srcData.monitorIds.map((id) => String(id))
          : [],
      name: src.name || srcData.name || "",
      controllerType: inferredControllerType,
      manufacturer: src.manufacturer || srcData.manufacturer || "",
      panelType: src.panelType || srcData.panelType || "",
      communicationType: src.communicationType || srcData.communicationType || srcData.commType || "",
      panelEnabled: src.panelEnabled !== false,
      lat: src.lat ?? src.center?.lat ?? srcData.centerLat ?? srcData.lat ?? "",
      lng: src.lng ?? src.center?.lng ?? srcData.centerLng ?? srcData.lng ?? "",
      refLat: src.refLat ?? srcData.refLat ?? "",
      refLng: src.refLng ?? srcData.refLng ?? "",
      radius: src.radius ?? srcData.radius ?? "",
      flow: src.flow ?? srcData.flow ?? srcData.performance ?? "",
      speed: src.speed ?? "",
      maxAngle: src.maxAngle ?? 360,
      isPartial: toBooleanFlag(src.isPartial),
      alignNorth: !!src.alignNorth,
      startLat: src.startLat ?? "",
      startLng: src.startLng ?? "",
      endLat: src.endLat ?? "",
      endLng: src.endLng ?? "",
      lastTowerLat: src.lastTowerLat ?? "",
      lastTowerLng: src.lastTowerLng ?? "",
      lastTowerRadius: src.lastTowerRadius ?? "",
      towerSpeed: src.towerSpeed ?? 100,
      hasParcelas: src.hasParcelas !== undefined ? !!src.hasParcelas : (Array.isArray(src.parcelas) && src.parcelas.length > 0),
      pumpPower: src.pumpPower ?? srcData.pumpPower ?? srcData.power ?? "",
      pumpTime: src.pumpTime ?? "",
      delayTime: src.delayTime ?? "",
      unstableTime: src.unstableTime ?? srcData.unstableTime ?? "",
      pressureType: src.pressureType ?? srcData.pressureType ?? "",
      sensorScale: src.sensorScale ?? srcData.sensorScale ?? "",
      voltageController: !!(src.voltageController ?? srcData.voltageController),
      voltageMin: src.voltageMin ?? srcData.voltageMin ?? "",
      voltageMax: src.voltageMax ?? srcData.voltageMax ?? "",
      voltageTimeLimit: src.voltageTimeLimit ?? srcData.voltageTimeLimit ?? "",
      enablePluviometro: !!(src.enablePluviometro ?? srcData.enablePluviometro),
      pluvioScale: src.pluvioScale ?? srcData.pluvioScale ?? "",
      pluvioStopCondition: src.pluvioStopCondition ?? srcData.pluvioStopCondition ?? "decrement",
      pluvioValue: src.pluvioValue ?? srcData.pluvioValue ?? "",
      enableFertirrigacao: !!(src.enableFertirrigacao ?? srcData.enableFertirrigacao),
      enableAutorreversao: !!(src.enableAutorreversao ?? srcData.enableAutorreversao),
      autorreversaoCondition: src.autorreversaoCondition ?? srcData.autorreversaoCondition ?? "fim_curso",
      autorreversaoWait: src.autorreversaoWait ?? srcData.autorreversaoWait ?? "30s",
      radioCentral: src.radioCentral ?? srcData.radioCentral ?? "0013A20042000001",
      radioControl: src.radioControl ?? srcData.radioControl ?? "0013A20042000002",
      radioGps: src.radioGps ?? srcData.radioGps ?? "0013A20042000003",
      radioBomba: src.radioBomba ?? srcData.radioBomba ?? "0000000000000000",
      language: src.language ?? srcData.language ?? "pt",
      peakDays: Array.isArray(src.peakDays) ? src.peakDays : (Array.isArray(srcData.peakDays) ? srcData.peakDays : []),
      peak1Start: src.peak1Start ?? srcData.peak1Start ?? "",
      peak1End: src.peak1End ?? srcData.peak1End ?? "",
      peak2Start: src.peak2Start ?? srcData.peak2Start ?? "",
      peak2End: src.peak2End ?? srcData.peak2End ?? "",
      peak3Start: src.peak3Start ?? srcData.peak3Start ?? "",
      peak3End: src.peak3End ?? srcData.peak3End ?? "",
      pumpTimeLimit: src.pumpTimeLimit ?? srcData.pumpTimeLimit ?? "",
      parcelas: normalizeParcelas(src.parcelas ?? srcData.parcelas),
      segments: normalizeSegments(src.segments ?? srcData.segments),
      canhaoMode: src.canhaoMode || "off",
      canhaoSegments: Array.isArray(src.canhaoSegments)
        ? src.canhaoSegments.map((s, i) => ({
          id: String(s.id || `cs_${i}`),
          startAngle: ((Number(s.startAngle ?? 270) % 360) + 360) % 360,
          endAngle: ((Number(s.endAngle ?? 90) % 360) + 360) % 360
        }))
        : []
    };
  }

  function getFarmEquipmentList(farm) {
    // Canonical source: farm.equipments (after migration from legacy equipamentos)
    const listA = Array.isArray(farm?.equipments) ? farm.equipments : [];
    const listB = Array.isArray(farm?.equipamentos) ? farm.equipamentos : [];

    const merged = [...listA, ...listB];
    const seen = new Set();
    const deduped = merged.filter((item) => {
      const id = String(item?.id || "");
      const key = id || `${item?.type || ""}_${item?.name || ""}_${item?.createdAt || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Correct controllerType from farm.pivos for pivot-category equipment
    const pivoMap = new Map((Array.isArray(farm?.pivos) ? farm.pivos : []).map((p) => [String(p.id), p]));
    return deduped.map((item) => {
      if (item?.category !== "pivos") return item;
      const matchingPivo = pivoMap.get(String(item?.id || ""));
      if (!matchingPivo?.controllerType) return item;
      return { ...item, type: matchingPivo.controllerType };
    });
  }

  function findEquipmentById(id) {
    const rawId = String(id || "");
    const farms = getAllFarms();
    for (const farm of farms) {
      const list = getFarmEquipmentList(farm);
      const equipment = list.find((item) => String(item?.id || "") === rawId);
      if (equipment) return { farm, equipment };
    }
    return null;
  }

  Cad.data = {
    normalizeFarmRecord,
    normalizeFarmDataset,
    normalizeEnergiaDataset,
    normalizeOperacaoDataset,
    normalizeAppState,
    loadFarmDataset,
    loadSharedAppState,
    loadEnergiaDataset,
    persistFarmDataset,
    persistEnergiaDataset,
    getSharedAppState,
    persistSharedAppState,
    syncFarmDataset,
    getAllFarms,
    getActiveFarmView,
    getCurrentContextFarmId,
    _loadTalhoesFromStorage,
    getTalhoesByFarm,
    saveTalhoesByFarm,
    getPluviosByFarm,
    savePluviosByFarm,
    getOperacaoByFarm,
    saveOperacaoByFarm,
    getOperacaoCompletionCounter,
    nextOperacaoCompletionCounter,
    getAllTalhoesRecords,
    getAllPivosRecords,
    parsePivoCompositeId,
    buildPivoCompositeId,
    parseTalhaoCompositeId,
    buildTalhaoCompositeId,
    getCurrentTalhaoFormFarmId,
    getCurrentEditingTalhaoId,
    normalizePivoRecord,
    getFarmEquipmentList,
    findEquipmentById
  };

  resetFarmOperationalMemoryIfNeeded();

})();
