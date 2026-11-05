/* assets/js/components/op-programacoes.js */
(function () {
  "use strict";
  const tMsg = (text) => window.IcI18n?.t?.(text) ?? text;

  const STORAGE_KEY = "ic_op_activities__dev";
  const COMPLETION_COUNTER_KEY = "ic_op_completion_counter__dev";
  const ACTIVITIES_EVENT = "ic:op-activities-changed__dev";
  const PIVOT_STATUS_ENERGIZADO = "energizado";
  const PIVOT_STATUS_IRRIGANDO = "irrigando";
  const PIVOT_STATUS_SECO = "seco";
  const PIVOT_STATUS_PAUSADO = "pausado_pico";
  const PIVOT_DEFAULT_TOWER_SPEED_MH = 260;
  const IRRIGATION_COVER_MARGIN_DEG = 1;

  const escHtml = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

  const pad2 = (n) => String(n).padStart(2, "0");
  const asNum = (v, fb = 0) => {
    const raw = typeof v === "string" ? v.replace(",", ".") : v;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fb;
  };
  const toDateTimeLocalValue = (date) => {
    const d = date instanceof Date ? date : new Date();
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  };
  const toPtDateTimeValue = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return "";
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  };
  const parsePtDateTimeValue = (raw) => {
    const txt = String(raw || "").trim();
    const m = /^(\d{2})\/(\d{2})\/(\d{2}|\d{4})\s+(\d{2}):(\d{2})$/.exec(txt);
    if (!m) return null;
    const day = asNum(m[1], NaN);
    const mon = asNum(m[2], NaN);
    const yy = asNum(m[3], NaN);
    const hh = asNum(m[4], NaN);
    const mm = asNum(m[5], NaN);
    if (![day, mon, yy, hh, mm].every(Number.isFinite)) return null;
    const year = yy < 100 ? (2000 + yy) : yy;
    const d = new Date(year, mon - 1, day, hh, mm, 0, 0);
    if (Number.isNaN(d.getTime())) return null;
    if (d.getDate() !== day || (d.getMonth() + 1) !== mon || d.getFullYear() !== year) return null;
    return d;
  };
  const fmtDateTime = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "--";
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  };
  const fmtDateOnly = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "--";
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
  };
  const fmtDayMonth = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "--/--";
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
  };
  const normalizeAngle = (deg) => {
    const n = Number(deg);
    if (!Number.isFinite(n)) return null;
    return ((n % 360) + 360) % 360;
  };
  const angleDeltaCw = (from, to) => ((asNum(to, 0) - asNum(from, 0) + 360) % 360);
  const angleDeltaCcw = (from, to) => ((asNum(from, 0) - asNum(to, 0) + 360) % 360);
  const angleDistance = (a, b) => {
    const na = normalizeAngle(a);
    const nb = normalizeAngle(b);
    if (na == null || nb == null) return Infinity;
    return Math.min(angleDeltaCw(na, nb), angleDeltaCcw(na, nb));
  };
  const isAngleReached = (curr, target, tolerance = 2) => angleDistance(curr, target) <= Math.max(0.2, asNum(tolerance, 2));
  const didCrossTarget = (prev, curr, target, direction, tolerance = 2) => {
    const p = normalizeAngle(prev);
    const c = normalizeAngle(curr);
    const t = normalizeAngle(target);
    if (p == null || c == null || t == null) return false;
    const tol = Math.max(0.2, asNum(tolerance, 2));
    if (isAngleReached(c, t, tol)) return true;
    if (isAngleReached(p, t, tol)) return true;
    if (direction === "reverso") {
      const moved = angleDeltaCcw(p, c);
      const toTarget = angleDeltaCcw(p, t);
      return toTarget <= moved + tol;
    }
    const moved = angleDeltaCw(p, c);
    const toTarget = angleDeltaCw(p, t);
    return toTarget <= moved + tol;
  };
  const shortestDirectionFromTo = (from, to) => (angleDeltaCw(from, to) <= angleDeltaCcw(from, to) ? "avanco" : "reverso");
  const isDashboardRoute = () => !!document.querySelector('.nav__item[data-route="visao-geral"].is-active');
  const getModalHost = () => document.fullscreenElement || document.body;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const getTimelineNowTs = () => {
    const simNow = window.IcSimulation?.state?.currentTime;
    const d = simNow ? new Date(simNow) : new Date();
    const ts = d.getTime();
    return Number.isFinite(ts) ? ts : Date.now();
  };
  const getCurrentFarmId = () => String(
    window.CreateFarm?.state?.currentFarmId
      || sessionStorage.getItem("ic_active_farm")
      || sessionStorage.getItem("ic_active_farm_id")
      || "default"
  );
  const loadLegacyActivities = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  };
  const getLegacyCompletionCounter = () => Math.max(0, asNum(localStorage.getItem(COMPLETION_COUNTER_KEY), 0));

  const loadActivities = () => {
    const farmId = getCurrentFarmId();
    if (typeof window.Cad?.data?.getOperacaoByFarm === "function") {
      const shared = window.Cad.data.getOperacaoByFarm(farmId);
      if (Array.isArray(shared) && shared.length) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(shared)); } catch (_) { }
        return shared;
      }
      if (Array.isArray(shared)) return shared;
    }
    const legacy = loadLegacyActivities();
    if (legacy.length && typeof window.Cad?.data?.saveOperacaoByFarm === "function") {
      window.Cad.data.saveOperacaoByFarm(farmId, legacy, getLegacyCompletionCounter());
    }
    return legacy;
  };
  const saveActivities = (list) => {
    const safeList = Array.isArray(list) ? list : [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeList));
    if (typeof window.Cad?.data?.saveOperacaoByFarm === "function") {
      window.Cad.data.saveOperacaoByFarm(getCurrentFarmId(), safeList, getLegacyCompletionCounter());
    }
    window.dispatchEvent(new CustomEvent(ACTIVITIES_EVENT));
  };
  // Ambiente de demo: toda nova sessão/reload começa sem programações salvas.
  // Roda sempre no boot (não só uma vez), para nunca carregar dados de uma
  // demonstração anterior. Precisa zerar activitiesByFarm por completo (todas
  // as fazendas) direto no cache "ic_app_state_v1", que é a fonte que
  // Cad.data.getSharedAppState() lê primeiro — limpar só a fazenda atual não
  // bastava, pois entradas de outras fazendas continuavam presas no cache.
  const APP_STATE_CACHE_KEY = "ic_app_state_v1";
  const wipeLegacyActivitiesOnce = () => {
    if (window.IcOpRouter.active !== "dev") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    localStorage.removeItem(COMPLETION_COUNTER_KEY);
    try {
      const raw = JSON.parse(localStorage.getItem(APP_STATE_CACHE_KEY) || "null");
      if (raw && typeof raw === "object") {
        raw.operacao = { activitiesByFarm: {}, completionCounter: 0 };
        localStorage.setItem(APP_STATE_CACHE_KEY, JSON.stringify(raw));
      }
    } catch (_) { }
    if (window.IcAppState && typeof window.IcAppState === "object") {
      window.IcAppState.operacao = { activitiesByFarm: {}, completionCounter: 0 };
    }
    const farmId = getCurrentFarmId();
    if (typeof window.Cad?.data?.saveOperacaoByFarm === "function") {
      window.Cad.data.saveOperacaoByFarm(farmId, [], 0);
    }
  };
  wipeLegacyActivitiesOnce();

  const resetProgrammedActivitiesOnBoot = () => {
    const parsed = loadActivities();
    if (!Array.isArray(parsed)) {
      saveActivities([]);
      return;
    }
    const normalized = parsed.map((item) => {
      if (!item || typeof item !== "object") return item;
      const status = String(item.status || "");
      if (status !== "em_execucao" && status !== "pausada") return item;
      return {
        ...item,
        status: "programada",
        startedAt: null,
        lastTickAt: null,
        lastAngle: null,
        runMs: 0,
        irrigatedDeg: 0,
        irrigationTargetDeg: null,
        pauseState: false,
        pauseStartedAt: null,
        pauseReason: null,
        alertDecision: null,
        phase: null,
        execPlan: null
      };
    });
    if (JSON.stringify(normalized) !== JSON.stringify(parsed)) {
      saveActivities(normalized);
    }
  };
  resetProgrammedActivitiesOnBoot();
  const nextCompletionOrder = () => {
    if (typeof window.Cad?.data?.nextOperacaoCompletionCounter === "function") {
      const next = window.Cad.data.nextOperacaoCompletionCounter();
      localStorage.setItem(COMPLETION_COUNTER_KEY, String(next));
      return next;
    }
    const next = getLegacyCompletionCounter() + 1;
    localStorage.setItem(COMPLETION_COUNTER_KEY, String(next));
    return next;
  };
  Promise.resolve(window.Cad?.data?.loadSharedAppState?.())
    .then(() => {
      const farmId = getCurrentFarmId();
      if (typeof window.Cad?.data?.getOperacaoByFarm === "function") {
        const shared = window.Cad.data.getOperacaoByFarm(farmId);
        if (Array.isArray(shared)) {
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(shared)); } catch (_) { }
        }
      }
      if (typeof window.Cad?.data?.getOperacaoCompletionCounter === "function") {
        const counter = window.Cad.data.getOperacaoCompletionCounter();
        localStorage.setItem(COMPLETION_COUNTER_KEY, String(counter));
      }
      // A limpeza única de dados de demo roda de novo aqui, depois do estado
      // compartilhado (app-state.json) ter sido carregado, já que ele pode
      // sobrescrever o localStorage com as atividades antigas.
      wipeLegacyActivitiesOnce();
      window.dispatchEvent(new CustomEvent(ACTIVITIES_EVENT));
    })
    .catch(() => null);

  const getCurrentFarm = () => {
    const st = window.CreateFarm?.state;
    if (!st) return null;
    const farms = Array.isArray(st.farms) ? st.farms : [];
    return farms.find((f) => String(f.id) === String(st.currentFarmId)) || farms[0] || null;
  };

  const getFarmTimezone = () => String(getCurrentFarm()?.timezone || "").trim() || null;

  // Toast dedicado ao salvar Programações Múltiplas: light mode, centralizado
  // no rodapé da tela — diferente do toast global (.ic-toast), que é escuro e
  // fica no topo.
  const showBulkSaveToast = (message) => {
    let toast = document.getElementById("opBulkSaveToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "opBulkSaveToast";
      toast.className = "op-bulk-save-toast";
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<i class="fa-solid fa-circle-check"></i><span>${escHtml(message)}</span>`;
    toast.classList.remove("is-visible");
    setTimeout(() => {
      toast.classList.add("is-visible");
      setTimeout(() => toast.classList.remove("is-visible"), 1800);
    }, 30);
  };

  // Componentes de data/hora de "ts" no fuso da fazenda (não no fuso do
  // navegador) — usado para rotular o eixo X da timeline (Programações
  // Múltiplas), já que os ticks são posicionados sobre um range ancorado no
  // fuso da fazenda (farmMidnightTs).
  const farmDateParts = (ts) => {
    const tz = getFarmTimezone();
    const d = new Date(ts);
    if (!tz) {
      return {
        year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(),
        hours: d.getHours(), minutes: d.getMinutes()
      };
    }
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hourCycle: "h23"
      }).formatToParts(d).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
      return {
        year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
        hours: Number(parts.hour), minutes: Number(parts.minute)
      };
    } catch (_) {
      return {
        year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(),
        hours: d.getHours(), minutes: d.getMinutes()
      };
    }
  };

  // Meia-noite (00:00) do dia de "date" no fuso horário da fazenda, retornada
  // como um instante absoluto (epoch ms) — não no fuso do navegador. Sem isso,
  // o início do eixo X da timeline (Programações Múltiplas) usava o fuso local
  // de quem está com o navegador aberto, que pode divergir do fuso da fazenda.
  const farmMidnightTs = (date) => {
    const tz = getFarmTimezone();
    const d = date instanceof Date ? date : new Date(date);
    if (!tz) {
      const local = new Date(d);
      local.setHours(0, 0, 0, 0);
      return local.getTime();
    }
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).formatToParts(d).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
      // Constrói meia-noite local à fazenda como se fosse UTC, depois corrige
      // pelo offset real do fuso naquele instante.
      const asUtcMidnight = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
      const tzDate = new Date(new Date(asUtcMidnight).toLocaleString("en-US", { timeZone: tz }));
      const utcDate = new Date(new Date(asUtcMidnight).toLocaleString("en-US", { timeZone: "UTC" }));
      const offsetMs = utcDate.getTime() - tzDate.getTime();
      return asUtcMidnight + offsetMs;
    } catch (_) {
      const local = new Date(d);
      local.setHours(0, 0, 0, 0);
      return local.getTime();
    }
  };

  const isLineStarEquipment = (equip) => String(equip?.type || "").toLowerCase() === "linestar";
  const clampPercent = (value) => Math.max(0, Math.min(100, asNum(value, 0)));
  const distanceMetersBetween = (from, to) => {
    if (!from || !to) return 0;
    const earthRadius = 6378137;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad((to.lat || 0) - (from.lat || 0));
    const dLng = toRad((to.lng || 0) - (from.lng || 0));
    const lat1 = toRad(from.lat || 0);
    const lat2 = toRad(to.lat || 0);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };
  const getLineStarTrackLengthMeters = (equip) => {
    if (!isLineStarEquipment(equip)) return 0;
    const data = equip?.data || {};
    const explicitTrack = Math.max(0, asNum(data.trackLengthCalc ?? data.trackLength, 0));
    if (explicitTrack > 0) return explicitTrack;
    const pointA = {
      lat: asNum(data.latA, NaN),
      lng: asNum(data.lngA, NaN)
    };
    const pointB = {
      lat: asNum(data.latB, NaN),
      lng: asNum(data.lngB, NaN)
    };
    if (![pointA.lat, pointA.lng, pointB.lat, pointB.lng].every(Number.isFinite)) return 0;
    return distanceMetersBetween(pointA, pointB);
  };
  const getLineStarBaseSpeedMh = (equip) => {
    if (!isLineStarEquipment(equip)) return 0;
    const data = equip?.data || {};
    const rawMax = asNum(data.speedMax, NaN);
    if (Number.isFinite(rawMax) && rawMax > 0) return rawMax;
    const rawSpeed = asNum(data.speed ?? data.performance, NaN);
    if (Number.isFinite(rawSpeed) && rawSpeed > 0) {
      return rawSpeed <= 60 ? rawSpeed * 20 : rawSpeed;
    }
    return 400;
  };

  const getPivotEquipById = (pivotId) => {
    if (!pivotId) return null;
    const farm = getCurrentFarm();
    if (!farm) return null;
    const equips = window.IcGetDashboardEquipments
      ? window.IcGetDashboardEquipments(farm)
      : (Array.isArray(farm.equipments) ? farm.equipments : []);
    return equips.find((e) => {
      if (String(e?.id || "") !== String(pivotId)) return false;
      const category = String(e?.category || "").toLowerCase();
      return category === "pivos" || isLineStarEquipment(e);
    }) || null;
  };
  const isPivotInAlert = (pivotId) => {
    const equip = getPivotEquipById(pivotId);
    if (!equip || typeof window.IcResolvePivotStatus !== "function") return false;
    const st = window.IcResolvePivotStatus(equip);
    return String(st?.statusClass || "") === "is-alert";
  };

  const getPeakConfigByPivotId = (pivotId) => {
    const normKey = (v) =>
      String(v ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
    const parseContratos = () => {
      const energia = window.IcData?.relatorios?.energia;
      let contratos = Array.isArray(energia?.contratos) ? energia.contratos : [];
      if (!contratos.length) {
        try {
          const raw = JSON.parse(localStorage.getItem("ic_energia") || "null");
          contratos = Array.isArray(raw?.contratos) ? raw.contratos : [];
        } catch (_) {}
      }
      return contratos;
    };

    const contratos = parseContratos();
    const equip = getPivotEquipById(pivotId);
    const farm = getCurrentFarm();
    const pivo = Array.isArray(farm?.pivos) ? farm.pivos.find((p) => String(p?.id) === String(pivotId)) : null;

    const keys = new Set([
      normKey(pivotId),
      normKey(equip?.id),
      normKey(equip?.name),
      normKey(pivo?.id),
      normKey(pivo?.name)
    ].filter(Boolean));

    const hasValidPeak = (c) =>
      Array.isArray(c?.horariosPonta) &&
      c.horariosPonta.some((s) => typeof s?.inicio === "string" && typeof s?.fim === "string");

    const linkedMatch = contratos.find((c) => {
      const linked = Array.isArray(c?.pivosVinculados) ? c.pivosVinculados : [];
      if (!linked.length) return false;
      return linked.some((id) => keys.has(normKey(id)));
    });

    // Fallback: se houver somente um contrato com horario de ponta cadastrado, usa ele.
    const peakContracts = contratos.filter(hasValidPeak);
    const contrato = linkedMatch || (peakContracts.length === 1 ? peakContracts[0] : null);

    if (!contrato) return { hasPeak: false, slots: [], name: null };
    const slots = Array.isArray(contrato.horariosPonta) ? contrato.horariosPonta : [];
    const valid = slots.filter((s) => typeof s?.inicio === "string" && typeof s?.fim === "string");
    return { hasPeak: valid.length > 0, slots: valid, name: contrato.nome || null };
  };

  const toMinutes = (hhmm) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || "").trim());
    if (!m) return null;
    const hh = asNum(m[1], -1);
    const mm = asNum(m[2], -1);
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return hh * 60 + mm;
  };

  const isInPeak = (date, peakCfg) => {
    if (!peakCfg?.hasPeak) return false;
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return false;
    const minNow = d.getHours() * 60 + d.getMinutes();
    return peakCfg.slots.some((s) => {
      const a = toMinutes(s.inicio);
      const b = toMinutes(s.fim);
      if (a == null || b == null) return false;
      if (a <= b) return minNow >= a && minNow < b;
      return minNow >= a || minNow < b;
    });
  };

  const nextPeakEnd = (fromDate, peakCfg) => {
    const base = fromDate instanceof Date ? new Date(fromDate) : new Date();
    if (!peakCfg?.hasPeak) return base.toISOString();
    const probe = new Date(base);
    for (let i = 0; i < 48 * 60; i += 1) {
      if (!isInPeak(probe, peakCfg)) return probe.toISOString();
      probe.setMinutes(probe.getMinutes() + 1);
    }
    return probe.toISOString();
  };

  // Para "Apos horario de pico": fixa o inicio no fim do periodo de ponta
  // do MESMO DIA da data de referencia (ex.: 21:00 no dia atual).
  // Se houver multiplas janelas, usa o maior horario de fim do dia.
  const nextPeakEndSameDay = (fromDate, peakCfg) => {
    const base = fromDate instanceof Date ? new Date(fromDate) : new Date();
    if (!peakCfg?.hasPeak || !Array.isArray(peakCfg.slots) || !peakCfg.slots.length) return base.toISOString();
    let maxEndMin = null;
    peakCfg.slots.forEach((s) => {
      const endMin = toMinutes(s?.fim);
      if (endMin == null) return;
      if (maxEndMin == null || endMin > maxEndMin) maxEndMin = endMin;
    });
    if (maxEndMin == null) return base.toISOString();

    const target = new Date(base);
    target.setHours(Math.floor(maxEndMin / 60), maxEndMin % 60, 0, 0);
    return target.toISOString();
  };

  const nextPeakEndAtOrAfter = (fromDate, peakCfg) => {
    const base = fromDate instanceof Date ? new Date(fromDate) : new Date(fromDate);
    if (Number.isNaN(base.getTime())) return new Date();
    const sameDayEnd = new Date(nextPeakEndSameDay(base, peakCfg));
    if (Number.isNaN(sameDayEnd.getTime())) return base;
    if (sameDayEnd > base) return sameDayEnd;
    const nextDayEnd = new Date(sameDayEnd);
    nextDayEnd.setDate(nextDayEnd.getDate() + 1);
    return nextDayEnd;
  };

  const getPeakWindowEndingSameDay = (refDate, peakCfg) => {
    const base = refDate instanceof Date ? new Date(refDate) : new Date(refDate);
    if (Number.isNaN(base.getTime()) || !peakCfg?.hasPeak || !Array.isArray(peakCfg.slots) || !peakCfg.slots.length) return null;
    let pick = null;
    peakCfg.slots.forEach((s) => {
      const a = toMinutes(s?.inicio);
      const b = toMinutes(s?.fim);
      if (a == null || b == null) return;
      if (!pick || b > pick.endMin) pick = { startMin: a, endMin: b };
    });
    if (!pick) return null;
    const start = new Date(base);
    const end = new Date(base);
    start.setHours(Math.floor(pick.startMin / 60), pick.startMin % 60, 0, 0);
    end.setHours(Math.floor(pick.endMin / 60), pick.endMin % 60, 0, 0);
    if (pick.startMin > pick.endMin) {
      end.setDate(end.getDate() + 1);
    }
    return { start, end };
  };

  const intervalOverlapsPeak = (startDate, endDate, peakCfg) => {
    if (!peakCfg?.hasPeak || !Array.isArray(peakCfg.slots) || !peakCfg.slots.length) return false;
    const start = startDate instanceof Date ? new Date(startDate) : new Date(startDate);
    const end = endDate instanceof Date ? new Date(endDate) : new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
    if (end <= start) return false;

    const rangeStart = new Date(start);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(end);
    rangeEnd.setHours(0, 0, 0, 0);
    const days = Math.max(0, Math.ceil((rangeEnd - rangeStart) / (24 * 60 * 60 * 1000))) + 2;
    const overlaps = (a0, a1, b0, b1) => a0 < b1 && a1 > b0;

    for (let i = 0; i < days; i += 1) {
      const day = new Date(rangeStart);
      day.setDate(day.getDate() + i);
      for (const slot of peakCfg.slots) {
        const a = toMinutes(slot?.inicio);
        const b = toMinutes(slot?.fim);
        if (a == null || b == null) continue;
        const slotStart = new Date(day);
        slotStart.setHours(Math.floor(a / 60), a % 60, 0, 0);
        const slotEnd = new Date(day);
        if (a <= b) {
          slotEnd.setHours(Math.floor(b / 60), b % 60, 0, 0);
        } else {
          slotEnd.setDate(slotEnd.getDate() + 1);
          slotEnd.setHours(Math.floor(b / 60), b % 60, 0, 0);
        }
        if (overlaps(start, end, slotStart, slotEnd)) return true;
      }
    }
    return false;
  };

  const firstPeakOverlapEnd = (startDate, endDate, peakCfg) => {
    if (!peakCfg?.hasPeak || !Array.isArray(peakCfg.slots) || !peakCfg.slots.length) return null;
    const start = startDate instanceof Date ? new Date(startDate) : new Date(startDate);
    const end = endDate instanceof Date ? new Date(endDate) : new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    if (end <= start) return null;

    const rangeStart = new Date(start);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(end);
    rangeEnd.setHours(0, 0, 0, 0);
    const days = Math.max(0, Math.ceil((rangeEnd - rangeStart) / (24 * 60 * 60 * 1000))) + 2;
    const overlaps = (a0, a1, b0, b1) => a0 < b1 && a1 > b0;
    const ends = [];

    for (let i = 0; i < days; i += 1) {
      const day = new Date(rangeStart);
      day.setDate(day.getDate() + i);
      for (const slot of peakCfg.slots) {
        const a = toMinutes(slot?.inicio);
        const b = toMinutes(slot?.fim);
        if (a == null || b == null) continue;
        const slotStart = new Date(day);
        slotStart.setHours(Math.floor(a / 60), a % 60, 0, 0);
        const slotEnd = new Date(day);
        if (a <= b) {
          slotEnd.setHours(Math.floor(b / 60), b % 60, 0, 0);
        } else {
          slotEnd.setDate(slotEnd.getDate() + 1);
          slotEnd.setHours(Math.floor(b / 60), b % 60, 0, 0);
        }
        if (overlaps(start, end, slotStart, slotEnd)) ends.push(slotEnd);
      }
    }
    if (!ends.length) return null;
    ends.sort((x, y) => x - y);
    return ends[0];
  };

  const totalPeakOverlapMs = (startDate, endDate, peakCfg) => {
    if (!peakCfg?.hasPeak || !Array.isArray(peakCfg.slots) || !peakCfg.slots.length) return 0;
    const start = startDate instanceof Date ? new Date(startDate) : new Date(startDate);
    const end = endDate instanceof Date ? new Date(endDate) : new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return 0;

    const rangeStart = new Date(start);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(end);
    rangeEnd.setHours(0, 0, 0, 0);
    const days = Math.max(0, Math.ceil((rangeEnd - rangeStart) / (24 * 60 * 60 * 1000))) + 2;
    let total = 0;

    for (let i = 0; i < days; i += 1) {
      const day = new Date(rangeStart);
      day.setDate(day.getDate() + i);
      for (const slot of peakCfg.slots) {
        const a = toMinutes(slot?.inicio);
        const b = toMinutes(slot?.fim);
        if (a == null || b == null) continue;
        const slotStart = new Date(day);
        slotStart.setHours(Math.floor(a / 60), a % 60, 0, 0);
        const slotEnd = new Date(day);
        if (a <= b) {
          slotEnd.setHours(Math.floor(b / 60), b % 60, 0, 0);
        } else {
          slotEnd.setDate(slotEnd.getDate() + 1);
          slotEnd.setHours(Math.floor(b / 60), b % 60, 0, 0);
        }
        const overlapStart = Math.max(start.getTime(), slotStart.getTime());
        const overlapEnd = Math.min(end.getTime(), slotEnd.getTime());
        if (overlapEnd > overlapStart) total += (overlapEnd - overlapStart);
      }
    }
    return Math.max(0, total);
  };

  const listPeakOverlapWindows = (startDate, endDate, peakCfg) => {
    if (!peakCfg?.hasPeak || !Array.isArray(peakCfg.slots) || !peakCfg.slots.length) return [];
    const start = startDate instanceof Date ? new Date(startDate) : new Date(startDate);
    const end = endDate instanceof Date ? new Date(endDate) : new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return [];

    const rangeStart = new Date(start);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(end);
    rangeEnd.setHours(0, 0, 0, 0);
    const days = Math.max(0, Math.ceil((rangeEnd - rangeStart) / (24 * 60 * 60 * 1000))) + 2;
    const windows = [];

    for (let i = 0; i < days; i += 1) {
      const day = new Date(rangeStart);
      day.setDate(day.getDate() + i);
      for (const slot of peakCfg.slots) {
        const a = toMinutes(slot?.inicio);
        const b = toMinutes(slot?.fim);
        if (a == null || b == null) continue;
        const slotStart = new Date(day);
        slotStart.setHours(Math.floor(a / 60), a % 60, 0, 0);
        const slotEnd = new Date(day);
        if (a <= b) {
          slotEnd.setHours(Math.floor(b / 60), b % 60, 0, 0);
        } else {
          slotEnd.setDate(slotEnd.getDate() + 1);
          slotEnd.setHours(Math.floor(b / 60), b % 60, 0, 0);
        }
        const overlapStart = Math.max(start.getTime(), slotStart.getTime());
        const overlapEnd = Math.min(end.getTime(), slotEnd.getTime());
        if (overlapEnd > overlapStart) {
          windows.push({
            start: new Date(overlapStart),
            end: new Date(overlapEnd)
          });
        }
      }
    }
    windows.sort((x, y) => x.start - y.start);
    return windows;
  };
  const listPeakWindowsByPivotInRange = (pivotId, rangeStartTs, rangeEndTs) => {
    const peakCfg = getPeakConfigByPivotId(pivotId);
    if (!peakCfg?.hasPeak || !Array.isArray(peakCfg.slots) || !peakCfg.slots.length) return [];
    const rangeStart = new Date(rangeStartTs);
    const rangeEnd = new Date(rangeEndTs);
    if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime()) || rangeEnd <= rangeStart) return [];
    const day0 = new Date(rangeStart);
    day0.setHours(0, 0, 0, 0);
    day0.setDate(day0.getDate() - 1);
    const dayN = new Date(rangeEnd);
    dayN.setHours(0, 0, 0, 0);
    dayN.setDate(dayN.getDate() + 1);
    const windows = [];
    for (let d = new Date(day0); d <= dayN; d.setDate(d.getDate() + 1)) {
      for (const slot of peakCfg.slots) {
        const a = toMinutes(slot?.inicio);
        const b = toMinutes(slot?.fim);
        if (a == null || b == null) continue;
        const s = new Date(d);
        s.setHours(Math.floor(a / 60), a % 60, 0, 0);
        const e = new Date(d);
        if (a <= b) e.setHours(Math.floor(b / 60), b % 60, 0, 0);
        else {
          e.setDate(e.getDate() + 1);
          e.setHours(Math.floor(b / 60), b % 60, 0, 0);
        }
        const startTs = Math.max(rangeStart.getTime(), s.getTime());
        const endTs = Math.min(rangeEnd.getTime(), e.getTime());
        if (endTs > startTs) windows.push({ startTs, endTs });
      }
    }
    return windows.sort((x, y) => x.startTs - y.startTs);
  };

  const applyPeakPolicyWindow = (startDate, endDate, peakCfg, peakPolicy) => {
    const start = startDate instanceof Date ? new Date(startDate) : new Date(startDate);
    const end = endDate instanceof Date ? new Date(endDate) : new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return { start, end };
    }
    const baseDurationMs = end.getTime() - start.getTime();

    if (peakPolicy === "iniciar_apos_pico") {
      // Regra direta: inicio sempre apos fim do pico.
      const shiftedStart = nextPeakEndAtOrAfter(start, peakCfg);
      const shiftedEnd = new Date(shiftedStart.getTime() + baseDurationMs);
      return { start: shiftedStart, end: shiftedEnd };
    }

    if (peakPolicy === "pausar") {
      // Tempo produtivo  deg mantido; fim  deg estendido pelo total em ponta.
      // Itera at deg convergir porque o novo fim pode incluir novas janelas de pico.
      let effectiveDuration = baseDurationMs;
      for (let i = 0; i < 8; i += 1) {
        const candidateEnd = new Date(start.getTime() + effectiveDuration);
        const overlapMs = totalPeakOverlapMs(start, candidateEnd, peakCfg);
        const newDuration = baseDurationMs + overlapMs;
        if (Math.abs(newDuration - effectiveDuration) < 60 * 1000) {
          effectiveDuration = newDuration;
          break;
        }
        effectiveDuration = newDuration;
      }
      return { start, end: new Date(start.getTime() + effectiveDuration) };
    }

    return { start, end };
  };

  const getSimulationNow = () => {
    const simState = window.IcSimulation?.state;
    const simIsActive = !!(simState?.running || simState?.active);
    const simNow = simIsActive ? simState?.currentTime : null;
    const d = simNow ? new Date(simNow) : new Date();
    return Number.isNaN(d.getTime()) ? new Date() : d;
  };
  const getMinStartNow = () => {
    const sim = getSimulationNow();
    const real = new Date();
    return sim > real ? sim : real;
  };
  const clampStartToNow = (dateLike) => {
    const d = dateLike instanceof Date ? new Date(dateLike) : new Date(dateLike);
    const minNow = getMinStartNow();
    if (Number.isNaN(d.getTime())) return minNow;
    return d < minNow ? minNow : d;
  };

  // -- Hydraulic helpers (sector-aware) --------------------------------------

  const _normBearing = (v) => { const n = Number(v); return ((n % 360) + 360) % 360; };
  const _bearing = (lat1, lng1, lat2, lng2) => {
    const toRad = Math.PI / 180;
    const y = Math.sin((lng2 - lng1) * toRad) * Math.cos(lat2 * toRad);
    const x = Math.cos(lat1 * toRad) * Math.sin(lat2 * toRad) -
              Math.sin(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.cos((lng2 - lng1) * toRad);
    return _normBearing(Math.atan2(y, x) * (180 / Math.PI));
  };

  const _pivoSweepRatio = (pivo) => {
    if (!pivo) return 1;
    const isPartial = (function toBool(v) {
      if (typeof v === "string") return ["true","1","yes","sim","on"].includes(v.trim().toLowerCase());
      return !!v;
    })(pivo.isPartial);
    if (!isPartial) return 1;
    const [lat, lng] = [Number(pivo.lat), Number(pivo.lng)];
    const [sLat, sLng] = [Number(pivo.startLat), Number(pivo.startLng)];
    const [eLat, eLng] = [Number(pivo.endLat), Number(pivo.endLng)];
    if ([lat, lng, sLat, sLng, eLat, eLng].some((v) => !Number.isFinite(v))) return 1;
    const startBearing = _bearing(lat, lng, sLat, sLng);
    const endBearing = _bearing(lat, lng, eLat, eLng);
    let sweepDeg = _normBearing(endBearing - startBearing);
    if (sweepDeg <= 0) sweepDeg += 360;
    return Math.min(1, Math.max(0.0001, sweepDeg / 360));
  };

  /** Look up the richer pivo cadastros record for a given equipment ID. */
  const getPivoCadastrosData = (pivotId) => {
    if (!pivotId) return null;
    const farm = getCurrentFarm();
    if (!farm) return null;
    const pivos = Array.isArray(farm.pivos) ? farm.pivos : [];
    return pivos.find((p) => String(p.id) === String(pivotId)) || null;
  };

  const getPivotParcelas = (pivotId) => {
    const pivo = getPivoCadastrosData(pivotId);
    const parcelas = Array.isArray(pivo?.parcelas) ? pivo.parcelas : [];
    return parcelas
      .map((parcela) => {
        const start = normalizeAngle(parcela?.startAngle);
        const end = normalizeAngle(parcela?.endAngle);
        if (start == null || end == null) return null;
        return {
          id: String(parcela?.id || ""),
          name: String(parcela?.name || "Parcela"),
          startAngle: start,
          endAngle: end
        };
      })
      .filter(Boolean);
  };

  const getPivotUsefulSector = (pivotId) => {
    const pivo = getPivoCadastrosData(pivotId);
    if (!pivo) return null;
    const isPartial = (function toBool(v) {
      if (typeof v === "string") return ["true", "1", "yes", "sim", "on"].includes(v.trim().toLowerCase());
      return !!v;
    })(pivo.isPartial);
    if (!isPartial) return null;

    const lat = asNum(pivo.lat, NaN);
    const lng = asNum(pivo.lng, NaN);
    let startAbs = NaN;
    let endAbs = NaN;

    const sLat = asNum(pivo.startLat, NaN);
    const sLng = asNum(pivo.startLng, NaN);
    const eLat = asNum(pivo.endLat, NaN);
    const eLng = asNum(pivo.endLng, NaN);
    if ([lat, lng, sLat, sLng, eLat, eLng].every(Number.isFinite)) {
      startAbs = _bearing(lat, lng, sLat, sLng);
      endAbs = _bearing(lat, lng, eLat, eLng);
    } else {
      const startRel = normalizeAngle(pivo.startAngle);
      const endRel = normalizeAngle(pivo.endAngle);
      const rLat = asNum(pivo.refLat, NaN);
      const rLng = asNum(pivo.refLng, NaN);
      if (Number.isFinite(startRel) && Number.isFinite(endRel) && [lat, lng, rLat, rLng].every(Number.isFinite)) {
        const refAbs = _bearing(lat, lng, rLat, rLng);
        startAbs = normalizeAngle(refAbs + startRel);
        endAbs = normalizeAngle(refAbs + endRel);
      }
    }

    if (![startAbs, endAbs].every(Number.isFinite)) return null;
    let sweepDeg = angleDeltaCw(startAbs, endAbs);
    if (sweepDeg <= 0) sweepDeg += 360;
    if (sweepDeg >= 359.5) return null;
    return {
      startAbs: normalizeAngle(startAbs),
      endAbs: normalizeAngle(endAbs),
      sweepDeg
    };
  };

  const isAngleInsideSectorCw = (angle, sector) => {
    if (!sector) return true;
    const a = normalizeAngle(angle);
    if (a == null) return false;
    const span = angleDeltaCw(sector.startAbs, a);
    return span <= asNum(sector.sweepDeg, 360) + 1e-6;
  };
  const nearestSectorBoundary = (angle, sector) => {
    if (!sector) return normalizeAngle(angle);
    const a = normalizeAngle(angle);
    if (a == null) return sector.startAbs;
    if (isAngleInsideSectorCw(a, sector)) return a;
    const ds = angleDistance(a, sector.startAbs);
    const de = angleDistance(a, sector.endAbs);
    return ds <= de ? sector.startAbs : sector.endAbs;
  };
  const sectorMoveDeg = (from, to, dir, sector) => {
    if (!sector) return dir === "reverso" ? angleDeltaCcw(from, to) : angleDeltaCw(from, to);
    const f = nearestSectorBoundary(from, sector);
    const t = nearestSectorBoundary(to, sector);
    if (dir === "reverso") {
      const moved = angleDeltaCcw(f, t);
      const limit = angleDeltaCcw(f, sector.startAbs);
      return moved <= limit + 1e-6 ? moved : NaN;
    }
    const moved = angleDeltaCw(f, t);
    const limit = angleDeltaCw(f, sector.endAbs);
    return moved <= limit + 1e-6 ? moved : NaN;
  };

  const getPivotHistoryEntries = (pivotId, limit = 5) => {
    const toTs = (it) => {
      const d = new Date(it?.finishedAt || it?.startedAt || it?.startAt || 0);
      const ts = d.getTime();
      return Number.isFinite(ts) ? ts : 0;
    };
    const compareDone = (a, b) => {
      const ao = asNum(a?.completedOrder, NaN);
      const bo = asNum(b?.completedOrder, NaN);
      const aHas = Number.isFinite(ao) && ao > 0;
      const bHas = Number.isFinite(bo) && bo > 0;
      if (aHas || bHas) {
        if (!aHas) return 1;
        if (!bHas) return -1;
        if (bo !== ao) return bo - ao;
      }
      return toTs(b) - toTs(a);
    };
    const list = loadActivities()
      .filter((it) => it && String(it.pivotId) === String(pivotId) && it.status === "concluida")
      .sort(compareDone);
    return list.slice(0, Math.max(1, asNum(limit, 5)));
  };
  const formatCoverageAngle = (deg) => {
    const n = normalizeAngle(deg);
    if (n == null) return "--";
    return `${n.toFixed(1)}°`;
  };
  const getCoverageLabelForActivity = (activity, plan = null) => {
    const stopModeRaw = String(activity?.stopMode || "");
    const stopMode = stopModeRaw === "por_voltas" ? "volta_completa" : (stopModeRaw === "por_local" ? "por_angulos" : stopModeRaw);
    if (stopMode === "volta_completa") return "Total";
    if (stopMode === "por_parcela") {
      if (activity?.parcelName) return String(activity.parcelName);
      const parcelId = String(activity?.parcelId || "");
      if (parcelId) {
        const parcela = getPivotParcelas(activity?.pivotId).find((p) => String(p.id) === parcelId);
        if (parcela?.name) return String(parcela.name);
      }
      return "Parcela";
    }
    if (stopMode === "por_angulos") {
      const a0 = activity?.startAngle ?? activity?.angleStart ?? plan?.irrigationStartAngle;
      const a1 = activity?.endAngle ?? activity?.angleEnd ?? plan?.irrigationEndAngle;
      return `${formatCoverageAngle(a0)}-${formatCoverageAngle(a1)}`;
    }
    return "Total";
  };

  const buildExecutionPlan = (activity, currentAngle) => {
    const curr = normalizeAngle(currentAngle);
    const direction = activity?.direction === "reverso" ? "reverso" : "avanco";
    const stopModeRaw = String(activity?.stopMode || "volta_completa");
    const stopMode = stopModeRaw === "por_voltas" ? "volta_completa" : (stopModeRaw === "por_local" ? "por_angulos" : stopModeRaw);
    const usefulSector = getPivotUsefulSector(activity?.pivotId);
    const result = {
      mode: stopMode,
      dryTargetAngle: null,
      dryDirection: null,
      dryDistanceDeg: 0,
      irrigationStartAngle: curr,
      irrigationEndAngle: null,
      irrigationDirection: direction,
      irrigationTargetDeg: null,
      cycleDeg: 360,
      hasDryMove: false
    };

    if (stopMode === "por_parcela") {
      const parcelId = String(activity?.parcelId || "");
      const parcelName = String(activity?.parcelName || "").trim().toLowerCase();
      const parcel = getPivotParcelas(activity?.pivotId).find((p) => (
        (parcelId && String(p.id) === parcelId) ||
        (parcelName && String(p.name || "").trim().toLowerCase() === parcelName)
      ));
      if (parcel) {
        const irrStart = direction === "reverso" ? parcel.endAngle : parcel.startAngle;
        const irrEnd = direction === "reverso" ? parcel.startAngle : parcel.endAngle;
        result.irrigationStartAngle = irrStart;
        result.irrigationEndAngle = irrEnd;
      }
    } else if (stopMode === "por_angulos") {
      const startA = normalizeAngle(activity?.angleStart ?? activity?.startAngle);
      const endA = normalizeAngle(activity?.angleEnd ?? activity?.stopValue);
      // irrigationStartAngle sempre é de onde o pivô realmente parte (startA);
      // irrigationEndAngle é o alvo (endA). O sentido do percurso (avanço=CW,
      // reverso=CCW) já é resolvido depois via angleDeltaCw/angleDeltaCcw a
      // partir de irrigationDirection — não se troca start/end aqui, senão o
      // delta CCW/CW passa a medir o arco pelo caminho oposto (mais longo).
      if (startA != null) result.irrigationStartAngle = startA;
      if (endA != null) result.irrigationEndAngle = endA;
    } else {
      if (usefulSector) {
        // Pivô parcial: volta completa = cobrir 100% da área útil do setor.
        if (direction === "reverso") {
          result.irrigationStartAngle = normalizeAngle(usefulSector.endAbs);
          result.irrigationEndAngle = normalizeAngle(usefulSector.startAbs);
        } else {
          result.irrigationStartAngle = normalizeAngle(usefulSector.startAbs);
          result.irrigationEndAngle = normalizeAngle(usefulSector.endAbs);
        }
        result.cycleDeg = Math.max(0.1, usefulSector.sweepDeg);
        result.irrigationTargetDeg = result.cycleDeg;
      } else {
        const base = result.irrigationStartAngle;
        if (base != null) {
          // Volta completa com sobreposicao: 1deg antes + 1deg depois (avance/reverso).
          if (direction === "reverso") {
            result.irrigationStartAngle = normalizeAngle(base + IRRIGATION_COVER_MARGIN_DEG);
            result.irrigationEndAngle = normalizeAngle(base - IRRIGATION_COVER_MARGIN_DEG);
          } else {
            result.irrigationStartAngle = normalizeAngle(base - IRRIGATION_COVER_MARGIN_DEG);
            result.irrigationEndAngle = normalizeAngle(base + IRRIGATION_COVER_MARGIN_DEG);
          }
        } else {
          result.irrigationEndAngle = result.irrigationStartAngle;
        }
        result.cycleDeg = 360;
      }
    }

    // Para garantir cobertura, aplica sobra angular de seguranca no inicio/fim.
    if ((stopMode === "por_parcela" || stopMode === "por_angulos")
      && result.irrigationStartAngle != null
      && result.irrigationEndAngle != null) {
      if (direction === "reverso") {
        result.irrigationStartAngle = normalizeAngle(result.irrigationStartAngle + IRRIGATION_COVER_MARGIN_DEG);
        result.irrigationEndAngle = normalizeAngle(result.irrigationEndAngle - IRRIGATION_COVER_MARGIN_DEG);
      } else {
        result.irrigationStartAngle = normalizeAngle(result.irrigationStartAngle - IRRIGATION_COVER_MARGIN_DEG);
        result.irrigationEndAngle = normalizeAngle(result.irrigationEndAngle + IRRIGATION_COVER_MARGIN_DEG);
      }
      result.irrigationTargetDeg = direction === "reverso"
        ? angleDeltaCcw(result.irrigationStartAngle, result.irrigationEndAngle)
        : angleDeltaCw(result.irrigationStartAngle, result.irrigationEndAngle);
      if (!Number.isFinite(asNum(result.irrigationTargetDeg, NaN)) || asNum(result.irrigationTargetDeg, 0) <= 0) {
        result.irrigationTargetDeg = 360;
      }
    }

    // Em pivô parcial, mantém qualquer início/fim estritamente dentro da área útil.
    if (usefulSector && result.irrigationStartAngle != null && result.irrigationEndAngle != null) {
      result.irrigationStartAngle = nearestSectorBoundary(result.irrigationStartAngle, usefulSector);
      result.irrigationEndAngle = nearestSectorBoundary(result.irrigationEndAngle, usefulSector);
      if (stopMode !== "volta_completa") {
        const partialTarget = direction === "reverso"
          ? sectorMoveDeg(result.irrigationStartAngle, result.irrigationEndAngle, "reverso", usefulSector)
          : sectorMoveDeg(result.irrigationStartAngle, result.irrigationEndAngle, "avanco", usefulSector);
        if (Number.isFinite(partialTarget) && partialTarget > 0) {
          result.irrigationTargetDeg = partialTarget;
        }
      }
    }

    if (curr != null && result.irrigationStartAngle != null && angleDistance(curr, result.irrigationStartAngle) > 1.2) {
      const currNorm = usefulSector ? nearestSectorBoundary(curr, usefulSector) : curr;
      const targetNorm = usefulSector ? nearestSectorBoundary(result.irrigationStartAngle, usefulSector) : result.irrigationStartAngle;
      result.hasDryMove = true;
      result.dryTargetAngle = targetNorm;
      if (usefulSector) {
        // No parcial, posiciona dentro do setor para viabilizar a irrigação no sentido declarado.
        const dAvanco = sectorMoveDeg(currNorm, targetNorm, "avanco", usefulSector);
        const dReverso = sectorMoveDeg(currNorm, targetNorm, "reverso", usefulSector);
        const avancoOk = Number.isFinite(dAvanco);
        const reversoOk = Number.isFinite(dReverso);
        if (avancoOk && reversoOk) {
          result.dryDirection = dAvanco <= dReverso ? "avanco" : "reverso";
          result.dryDistanceDeg = Math.min(dAvanco, dReverso);
        } else if (avancoOk) {
          result.dryDirection = "avanco";
          result.dryDistanceDeg = dAvanco;
        } else if (reversoOk) {
          result.dryDirection = "reverso";
          result.dryDistanceDeg = dReverso;
        } else {
          const cw = angleDeltaCw(currNorm, targetNorm);
          const ccw = angleDeltaCcw(currNorm, targetNorm);
          result.dryDirection = cw <= ccw ? "avanco" : "reverso";
          result.dryDistanceDeg = Math.min(cw, ccw);
        }
      } else {
        const cw = angleDeltaCw(currNorm, targetNorm);
        const ccw = angleDeltaCcw(currNorm, targetNorm);
        result.dryDirection = cw <= ccw ? "avanco" : "reverso";
        result.dryDistanceDeg = Math.min(cw, ccw);
      }
    }
    return result;
  };

  const estimateDryMoveMs = (activity, currentAngle) => {
    const curr = normalizeAngle(currentAngle);
    if (curr == null) return 0;
    const equip = getPivotEquipById(activity?.pivotId);
    // Deslocamento a seco sempre roda a 100% de velocidade, independente da
    // velocidade configurada para a irrigação.
    const phys = calcPivotPhysics(equip, 100);
    const lapMsAtFullSpeed = Math.max(1, phys.lapHours * 3600 * 1000);
    const plan = buildExecutionPlan(activity, curr);
    if (!plan.hasDryMove || plan.dryTargetAngle == null) return 0;
    const dryDeg = Math.max(0, asNum(plan.dryDistanceDeg, 0));
    return (dryDeg / 360) * lapMsAtFullSpeed;
  };

  const resolveQueuedStartForActivity = (pivotId, candidateStartDate, durationMs, queueList, ignoreId = "") => {
    const base = candidateStartDate instanceof Date ? new Date(candidateStartDate) : new Date(candidateStartDate);
    if (Number.isNaN(base.getTime())) return base;
    const dur = Math.max(0, asNum(durationMs, 0));
    const windows = (Array.isArray(queueList) ? queueList : [])
      .filter((it) =>
        it &&
        String(it.pivotId || "") === String(pivotId || "") &&
        String(it.status || "") !== "concluida" &&
        String(it.id || "") !== String(ignoreId || "")
      )
      .map((it) => {
        const s = new Date(it?.startAt || it?.irrigationStartAt || it?.startedAt || 0).getTime();
        const e = new Date(it?.plannedEndAt || it?.finishedAt || it?.startAt || it?.startedAt || 0).getTime();
        if (!(Number.isFinite(s) && Number.isFinite(e) && e > s)) return null;
        return { s, e };
      })
      .filter(Boolean)
      .sort((a, b) => a.s - b.s);
    if (!windows.length || dur <= 0) return base;
    let candidate = base.getTime();
    for (let i = 0; i < 300; i += 1) {
      const candidateEnd = candidate + dur;
      const overlap = windows.find((w) => candidate < w.e && candidateEnd > w.s);
      if (!overlap) return new Date(candidate);
      candidate = Math.max(candidate, overlap.e);
    }
    return new Date(candidate);
  };

  const calculateActivityWindowFromStart = (activityLike, requestedStartDate, queueList = []) => {
    const req = requestedStartDate instanceof Date ? new Date(requestedStartDate) : new Date(requestedStartDate);
    if (Number.isNaN(req.getTime())) return null;
    const startMode = String(activityLike?.startMode || "agendado");
    const peakPolicy = String(activityLike?.peakPolicy || "pausar");
    const peakCfg = getPeakConfigByPivotId(activityLike?.pivotId);
    let requested = req;
    if (startMode === "pos_pico") requested = new Date(nextPeakEndSameDay(requested, peakCfg));

    const speedPct = asNum(activityLike?.speedPct, 100);
    const equip = getPivotEquipById(activityLike?.pivotId);
    const p = calcPivotPhysics(equip, speedPct);
    const lapMsAtSpeed = Math.max(1, p.lapHours * 3600 * 1000);
    // Deslocamento a seco (reposicionamento entre operações) sempre roda a
    // 100% de velocidade, independente da velocidade configurada para a
    // irrigação — só o trecho molhado respeita speedPct.
    const lapMsAtFullSpeed = Math.max(1, calcPivotPhysics(equip, 100).lapHours * 3600 * 1000);
    const startAngleBase = normalizeAngle(activityLike?.startAngle ?? window.IcGetPivotAngle?.(activityLike?.pivotId));
    const plan = buildExecutionPlan(activityLike, startAngleBase);

    let totalMs = 0;
    if (startMode !== "pos_pico" && plan.hasDryMove && plan.dryTargetAngle != null) {
      const dryDeg = plan.dryDirection === "reverso"
        ? angleDeltaCcw(startAngleBase, plan.dryTargetAngle)
        : angleDeltaCw(startAngleBase, plan.dryTargetAngle);
      totalMs += (dryDeg / 360) * lapMsAtFullSpeed;
    }
    const stopMode = String(activityLike?.stopMode || "");
    if (stopMode === "volta_completa") {
      const laps = Math.max(0.1, asNum(activityLike?.stopValue, 1));
      const perCycleDeg = Math.max(0.1, asNum(plan?.cycleDeg, 360));
      const sector = getPivotUsefulSector(activityLike?.pivotId);
      const baseSweepDeg = sector ? Math.max(0.1, asNum(sector.sweepDeg, 360)) : 360;
      if (sector) {
        totalMs += laps * lapMsAtSpeed * (perCycleDeg / baseSweepDeg);
      } else {
        totalMs += laps * lapMsAtSpeed;
        totalMs += ((2 * IRRIGATION_COVER_MARGIN_DEG) / 360) * lapMsAtSpeed;
      }
    } else if ((stopMode === "por_parcela" || stopMode === "por_angulos") && plan.irrigationStartAngle != null && plan.irrigationEndAngle != null) {
      const irrDeg = plan.irrigationDirection === "reverso"
        ? angleDeltaCcw(plan.irrigationStartAngle, plan.irrigationEndAngle)
        : angleDeltaCw(plan.irrigationStartAngle, plan.irrigationEndAngle);
      totalMs += (irrDeg / 360) * lapMsAtSpeed;
    } else {
      return null;
    }

    const queuedStart = resolveQueuedStartForActivity(
      activityLike?.pivotId,
      requested,
      totalMs,
      queueList,
      activityLike?.id || ""
    );
    if (Number.isNaN(queuedStart.getTime())) return null;

    const rawEnd = new Date(queuedStart.getTime() + Math.max(0, totalMs));
    const adjusted = applyPeakPolicyWindow(queuedStart, rawEnd, peakCfg, peakPolicy);
    return {
      start: adjusted?.start || queuedStart,
      end: adjusted?.end || rawEnd,
      totalMs: Math.max(0, totalMs)
    };
  };

  const calcPivotPhysics = (equip, speedPct) => {
    const data = equip?.data || {};
    if (isLineStarEquipment(equip)) {
      const trackLengthM = Math.max(1, getLineStarTrackLengthMeters(equip) || 1);
      const widthM = Math.max(1, asNum(data.irrigatedWidth ?? data.width, 80));
      const flowM3h = Math.max(0.1, asNum(data.flow ?? data.performance ?? equip?.flow, 200));
      const towerSpeedMh = Math.max(1, getLineStarBaseSpeedMh(equip) || 400);
      const speed = Math.max(1, asNum(speedPct, 100));
      const areaM2 = Math.max(1, trackLengthM * widthM);
      const lapHoursAt100 = trackLengthM / towerSpeedMh;
      const lapHours = lapHoursAt100 * (100 / speed);
      const volumeM3 = flowM3h * lapHours;
      const laminaMm = (volumeM3 / areaM2) * 1000;
      return {
        radiusM: trackLengthM,
        movementRadiusM: trackLengthM,
        flowM3h,
        areaM2,
        sweepRatio: 1,
        lapHoursAt100,
        lapHours,
        laminaMm,
        trackLengthM,
        widthM,
        towerSpeedMh
      };
    }

    const pivotId = equip?.id ?? data?.id;
    const pivo = getPivoCadastrosData(pivotId);

    const radiusM = Math.max(1, asNum(pivo?.radius ?? data.radius ?? equip?.radius, 500));
    const rawLastTower = pivo?.lastTowerRadius ?? data.lastTowerRadius ?? equip?.lastTowerRadius;
    // Raio da última torre: quando não configurado (vazio/0), a torre final
    // fica 20m antes do raio total irrigado (raio da última torre != raio
    // do canhão/alcance do jato final).
    const movementRadiusM = (rawLastTower !== "" && rawLastTower != null && Number.isFinite(asNum(rawLastTower, NaN)) && asNum(rawLastTower) > 0)
      ? asNum(rawLastTower)
      : Math.max(1, radiusM - 20);
    const towerSpeedMh = Math.max(0.1, asNum(pivo?.towerSpeed ?? data.towerSpeed ?? equip?.towerSpeed ?? pivo?.speed ?? data.speed ?? equip?.speed, PIVOT_DEFAULT_TOWER_SPEED_MH));
    const flowM3h = Math.max(0.1, asNum(pivo?.flow ?? data.vazao ?? data.flowRate ?? data.flow ?? data.performance ?? equip?.flow ?? equip?.vazao, 120));
    const speed = Math.max(1, asNum(speedPct, 100));

    const sweepRatio = _pivoSweepRatio(pivo);
    const areaM2 = Math.PI * radiusM * radiusM * sweepRatio;
    const fullLapCircumference = 2 * Math.PI * movementRadiusM;
    const fullLapHoursAt100 = fullLapCircumference / towerSpeedMh;
    const lapHoursAt100 = fullLapHoursAt100 * sweepRatio;
    const lapHours = lapHoursAt100 * (100 / speed);
    const volumeM3 = flowM3h * lapHours;
    const laminaMm = (volumeM3 / areaM2) * 1000;
    return { radiusM, movementRadiusM, flowM3h, areaM2, sweepRatio, lapHoursAt100, lapHours, laminaMm };
  };

  const getFarmPivots = () => {
    const sortByName = (arr) => arr.sort((a, b) =>
      String(a?.name || "").localeCompare(String(b?.name || ""), "pt-BR", { numeric: true, sensitivity: "base" })
    );
    const normCat = (v) => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const isPivotCategory = (v) => {
      const c = normCat(v);
      return c === "pivo" || c === "pivos" || c.includes("pivo");
    };
    const farm = getCurrentFarm();
    if (!farm) return [];
    const byId = new Map();
    const idKeys = [
      "id", "pid", "pivotId", "pivoId", "equipmentId", "equipmentID",
      "eqId", "uuid", "code", "codigo", "serial", "deviceId", "iotId"
    ];
    const nameKeys = ["name", "nome", "label", "titulo", "title", "displayName", "equipName", "equipmentName"];
    const addPivot = (idRaw, nameRaw) => {
      const name = String(nameRaw || "Pivo").trim() || "Pivo";
      let id = String(idRaw || "").trim();
      // Não cria pivô sintético genérico: isso gerava linhas "Pivo" duplicadas/fantasma.
      if (!id) {
        // Fallback seguro apenas para nomes no padrão P01, P02...
        const m = /^p\s*0*(\d{1,4})$/i.exec(name);
        if (!m) return;
        id = `pivot_name_${m[1]}`;
      }
      if (/^pivo$/i.test(name)) return;
      const prev = byId.get(id);
      if (!prev || !prev.name || /^pivo$/i.test(prev.name)) {
        byId.set(id, { id, name });
      }
    };
    const addPivotFromObj = (obj) => {
      if (!obj) return;
      const id = idKeys.map((k) => obj?.[k]).find((v) => v != null && String(v).trim() !== "");
      const name = nameKeys.map((k) => obj?.[k]).find((v) => v != null && String(v).trim() !== "");
      addPivot(id, name);
    };

    const addLineStarsFromEquipments = (list) => {
      (Array.isArray(list) ? list : [])
        .filter((equip) => isLineStarEquipment(equip))
        .forEach((equip) => {
          addPivotFromObj(equip);
          addPivotFromObj(equip?.data);
        });
    };

    const farmPivos = [
      ...(Array.isArray(farm.pivos) ? farm.pivos : []),
      ...(Array.isArray(farm.pivots) ? farm.pivots : []),
      ...(Array.isArray(farm.pivotList) ? farm.pivotList : [])
    ];
    farmPivos.forEach((p) => addPivotFromObj(p));
    const farmEquips = Array.isArray(farm.equipments) ? farm.equipments : [];
    farmEquips
      .filter((e) => isPivotCategory(e?.category || e?.type || e?.data?.category || e?.data?.type))
      .forEach((e) => addPivotFromObj(e));
    addLineStarsFromEquipments(farmEquips);
    const dashEquips = window.IcGetDashboardEquipments
      ? window.IcGetDashboardEquipments(farm)
      : [];
    (Array.isArray(dashEquips) ? dashEquips : [])
      .filter((e) => isPivotCategory(e?.category || e?.type || e?.data?.category || e?.data?.type))
      .forEach((e) => {
        addPivotFromObj(e);
        addPivotFromObj(e?.data);
      });
    addLineStarsFromEquipments(dashEquips);

    return sortByName(Array.from(byId.values()));
  };

  const openBulkScheduleModal = () => {
    const pivots = getFarmPivots();
    if (!pivots.length) {
      window.IcNotify?.warn?.("Nenhum pivo disponivel para programacao.", 1800);
      return;
    }
    const id = "opBulkScheduleModal__dev";
    document.getElementById(id)?.remove();

    const now = new Date();
    const dayVal = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    const html = `
      <div class="op-bulk-modal" id="${id}">
        <div class="op-bulk-modal__backdrop"></div>
        <div class="op-bulk-modal__dialog">
          <header class="op-bulk-modal__head">
            <h3>Multiplas programacoes</h3>
            <button type="button" class="op-bulk-modal__close" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>
          </header>
          <div class="op-bulk-modal__controls">
            <nav class="op-bulk-modal__days-nav js-bulk-days-nav" role="navigation" aria-label="Dias de programação"></nav>
          </div>
          <div class="op-bulk-modal__days js-bulk-days"></div>
          <footer class="op-bulk-modal__foot">
            <button type="button" class="btn btn--cancel js-bulk-cancel">Cancelar</button>
            <button type="button" class="btn btn--ok js-bulk-save">Salvar programacoes</button>
          </footer>
        </div>
      </div>
    `;
    getModalHost().insertAdjacentHTML("beforeend", html);
    const modal = document.getElementById(id);
    if (!modal) return;
    const dialogEl = modal.querySelector(".op-bulk-modal__dialog--grid");
    let autoRefreshTimer = null;
    const close = () => {
      if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
      }
      modal.remove();
    };

    const daysHost = modal.querySelector(".js-bulk-days");
    const daysNavHost = modal.querySelector(".js-bulk-days-nav");
    const parseTimeToMinutes = (raw) => {
      const m = /^(\d{1,2}):(\d{2})$/.exec(String(raw || "").trim());
      if (!m) return null;
      const h = asNum(m[1], -1);
      const n = asNum(m[2], -1);
      if (h < 0 || h > 23 || n < 0 || n > 59) return null;
      return h * 60 + n;
    };
    const addDayIso = (iso, inc) => {
      const d = new Date(`${iso}T00:00:00`);
      if (Number.isNaN(d.getTime())) return iso;
      d.setDate(d.getDate() + inc);
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    };
    const days = Array.from({ length: 7 }, (_, i) => addDayIso(dayVal, i));
    let selectedDayIso = days[0];
    const draftState = {};
    const dayTitle = (iso) => {
      const d = new Date(`${iso}T00:00:00`);
      if (Number.isNaN(d.getTime())) return iso;
      return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
    };
    const stopDynamicHtml = (pivotId, mode) => {
      if (mode === "volta_completa") {
        return `
          <div class="op-bulk-stop-inline">
            <input type="number" class="js-bulk-voltas" min="0.1" step="0.1" value="1">
            <span>x</span>
          </div>
        `;
      }
      if (mode === "por_parcela") {
        const parcelas = getPivotParcelas(pivotId);
        if (!parcelas.length) {
          return `<span class="op-bulk-stop-empty">Sem parcelas</span>`;
        }
        const opts = parcelas
          .map((p) => `<option value="${p.id}">${p.name}</option>`)
          .join("");
        return `<select class="js-bulk-parcela">${opts}</select>`;
      }
      return `
        <div class="op-bulk-stop-inline">
          <input type="number" class="js-bulk-ang-start" min="0" max="360" step="0.1" value="0">
          <span>-</span>
          <input type="number" class="js-bulk-ang-end" min="0" max="360" step="0.1" value="0">
        </div>
      `;
    };
    const rowKey = (dayIso, rowId) => `${dayIso}__${rowId}`;
    const makeMainRowId = (pivotId) => `${pivotId}__main`;
    const makeParcelRowId = (pivotId, parcelId) => `${pivotId}__parcela__${parcelId}`;
    const rowDefaults = (dayIso, rowId, i, initial = {}) => {
      const def = draftState[rowKey(dayIso, rowId)] || {};
      return {
        enabled: def.enabled ?? (initial.enabled ?? false),
        startMode: def.startMode || initial.startMode || "agendado",
        time: def.time || initial.time || `${pad2(6 + (i % 8))}:00`,
        direction: def.direction || initial.direction || "avanco",
        irrigationMode: def.irrigationMode || initial.irrigationMode || "molhado",
        stopMode: def.stopMode || initial.stopMode || "volta_completa",
        speedPct: Number.isFinite(asNum(def.speedPct, NaN)) ? asNum(def.speedPct) : asNum(initial.speedPct, 100),
        laminaMm: Number.isFinite(asNum(def.laminaMm, NaN)) ? asNum(def.laminaMm) : asNum(initial.laminaMm, 0),
        ferti: !!(def.ferti ?? initial.ferti),
        peakPolicy: def.peakPolicy || initial.peakPolicy || "pausar",
        stopValue: Number.isFinite(asNum(def.stopValue, NaN)) ? asNum(def.stopValue) : asNum(initial.stopValue, 1),
        parcelId: def.parcelId || initial.parcelId || "",
        angleStart: Number.isFinite(asNum(def.angleStart, NaN)) ? asNum(def.angleStart) : asNum(initial.angleStart, 0),
        angleEnd: Number.isFinite(asNum(def.angleEnd, NaN)) ? asNum(def.angleEnd) : asNum(initial.angleEnd, 0)
      };
    };
    const seedDraftFromActivities = () => {
      const activities = loadActivities()
        .filter((a) => a && a.status !== "concluida")
        .slice()
        .sort((a, b) => {
          const ta = new Date(a?.startAt || 0).getTime();
          const tb = new Date(b?.startAt || 0).getTime();
          return ta - tb;
        });
      activities.forEach((act) => {
        const pivotId = String(act?.pivotId || "");
        if (!pivotId) return;
        const startDt = new Date(act?.startAt || 0);
        if (Number.isNaN(startDt.getTime())) return;
        const dayIso = `${startDt.getFullYear()}-${pad2(startDt.getMonth() + 1)}-${pad2(startDt.getDate())}`;
        if (!days.includes(dayIso)) days.push(dayIso);
        const isParcela = String(act?.stopMode || "") === "por_parcela" && String(act?.parcelId || "");
        const rowId = isParcela ? makeParcelRowId(pivotId, String(act.parcelId)) : makeMainRowId(pivotId);
        const key = rowKey(dayIso, rowId);
        if (draftState[key]) return;
        draftState[key] = {
          enabled: true,
          startMode: String(act?.startMode || "agendado"),
          time: `${pad2(startDt.getHours())}:${pad2(startDt.getMinutes())}`,
          direction: String(act?.direction || "avanco"),
          irrigationMode: String(act?.irrigationMode || "molhado"),
          stopMode: String(act?.stopMode || (isParcela ? "por_parcela" : "volta_completa")),
          speedPct: asNum(act?.speedPct, 100),
          laminaMm: asNum(act?.laminaMm, 0),
          ferti: !!act?.ferti,
          peakPolicy: String(act?.peakPolicy || "pausar"),
          stopValue: asNum(act?.stopValue, 1),
          parcelId: String(act?.parcelId || ""),
          angleStart: asNum(act?.angleStart, 0),
          angleEnd: asNum(act?.angleEnd, 0)
        };
      });
      days.sort();
      if (!days.includes(selectedDayIso)) selectedDayIso = days[0] || dayVal;
    };
    seedDraftFromActivities();
    const rowHtml = (dayIso, p, i) => {
      const parcelas = getPivotParcelas(p.id);
      const mainRowId = makeMainRowId(p.id);
      const st = rowDefaults(dayIso, mainRowId, i);
      const expandBtn = parcelas.length
        ? `<button type="button" class="op-bulk-expand-btn js-bulk-expand-parcels" data-row-id="${mainRowId}" aria-expanded="false" title="Expandir parcelas">
             <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
           </button>`
        : "";
      const main = `
        <tr data-bulk-row data-row-id="${mainRowId}" data-day="${dayIso}" data-pivot-id="${p.id}" data-pivot-name="${escHtml(p.name)}">
          <td><input type="checkbox" class="js-bulk-enable" ${st.enabled ? "checked" : ""}></td>
          <td><div class="op-bulk-pivot-cell">${expandBtn}<span>${escHtml(p.name)}</span></div></td>
          <td>
            <select class="js-bulk-start-mode">
              <option value="agendado" ${st.startMode === "agendado" ? "selected" : ""}>Agendado</option>
              <option value="agora" ${st.startMode === "agora" ? "selected" : ""}>Agora</option>
              <option value="pos_pico" ${st.startMode === "pos_pico" ? "selected" : ""}>Apos pico</option>
            </select>
          </td>
          <td style="display:none;"><input type="time" class="js-bulk-time" value="${st.time}"></td>
          <td><input type="text" class="js-bulk-start-dt" value="--" readonly></td>
          <td><input type="text" class="js-bulk-end-dt" value="--" readonly></td>
          <td>
            <select class="js-bulk-dir">
              <option value="avanco" ${st.direction === "avanco" ? "selected" : ""}>Avanco</option>
              <option value="reverso" ${st.direction === "reverso" ? "selected" : ""}>Reverso</option>
            </select>
          </td>
          <td>
            <select class="js-bulk-irr">
              <option value="molhado" ${st.irrigationMode === "molhado" ? "selected" : ""}>Molhado</option>
              <option value="seco" ${st.irrigationMode === "seco" ? "selected" : ""}>Seco</option>
            </select>
          </td>
          <td>
            <select class="js-bulk-stop-mode">
              <option value="volta_completa" ${st.stopMode === "volta_completa" ? "selected" : ""}>Volta completa</option>
              <option value="por_parcela" ${st.stopMode === "por_parcela" ? "selected" : ""}>Por parcela</option>
              <option value="por_angulos" ${st.stopMode === "por_angulos" ? "selected" : ""}>Por angulos</option>
            </select>
          </td>
          <td class="js-bulk-stop-cell" data-stop-value="${st.stopValue}" data-parcel-id="${st.parcelId}" data-angle-start="${st.angleStart}" data-angle-end="${st.angleEnd}">${stopDynamicHtml(p.id, st.stopMode)}</td>
          <td><input type="number" class="js-bulk-speed" min="1" max="100" step="0.1" value="${st.speedPct}"></td>
          <td><input type="number" class="js-bulk-lamina" min="0.01" step="0.01" value="${st.laminaMm}"></td>
          <td>
            <select class="js-bulk-peak-policy">
              <option value="pausar" ${st.peakPolicy === "pausar" ? "selected" : ""}>Pausar HP</option>
              <option value="continuar" ${st.peakPolicy === "continuar" ? "selected" : ""}>Continuar</option>
              <option value="iniciar_apos_pico" ${st.peakPolicy === "iniciar_apos_pico" ? "selected" : ""}>Iniciar apos HP</option>
            </select>
          </td>
          <td><input type="checkbox" class="js-bulk-ferti" ${st.ferti ? "checked" : ""}></td>
        </tr>
      `;
      const subRows = parcelas.map((parcela, idx) => {
        const subRowId = makeParcelRowId(p.id, parcela.id);
        const subSt = rowDefaults(dayIso, subRowId, idx, {
          enabled: false,
          stopMode: "por_parcela",
          parcelId: parcela.id,
          irrigationMode: "molhado"
        });
        return `
          <tr class="op-bulk-subrow is-hidden" data-bulk-row data-row-id="${subRowId}" data-parent-row-id="${mainRowId}" data-day="${dayIso}" data-pivot-id="${p.id}" data-pivot-name="${escHtml(p.name)}" data-fixed-parcel-id="${parcela.id}">
            <td><input type="checkbox" class="js-bulk-enable" ${subSt.enabled ? "checked" : ""}></td>
            <td><div class="op-bulk-pivot-cell op-bulk-pivot-cell--sub"><span>${escHtml(p.name)} · ${escHtml(parcela.name)}</span></div></td>
            <td>
              <select class="js-bulk-start-mode">
                <option value="agendado" ${subSt.startMode === "agendado" ? "selected" : ""}>Agendado</option>
                <option value="agora" ${subSt.startMode === "agora" ? "selected" : ""}>Agora</option>
                <option value="pos_pico" ${subSt.startMode === "pos_pico" ? "selected" : ""}>Apos pico</option>
              </select>
            </td>
            <td style="display:none;"><input type="time" class="js-bulk-time" value="${subSt.time}"></td>
            <td><input type="text" class="js-bulk-start-dt" value="--" readonly></td>
            <td><input type="text" class="js-bulk-end-dt" value="--" readonly></td>
            <td>
              <select class="js-bulk-dir">
                <option value="avanco" ${subSt.direction === "avanco" ? "selected" : ""}>Avanco</option>
                <option value="reverso" ${subSt.direction === "reverso" ? "selected" : ""}>Reverso</option>
              </select>
            </td>
            <td>
              <select class="js-bulk-irr">
                <option value="molhado" ${subSt.irrigationMode === "molhado" ? "selected" : ""}>Molhado</option>
                <option value="seco" ${subSt.irrigationMode === "seco" ? "selected" : ""}>Seco</option>
              </select>
            </td>
            <td>
              <select class="js-bulk-stop-mode" disabled>
                <option value="por_parcela" selected>Por parcela</option>
              </select>
            </td>
            <td class="js-bulk-stop-cell" data-parcel-id="${parcela.id}">
              <select class="js-bulk-parcela"><option value="${parcela.id}" selected>${parcela.name}</option></select>
            </td>
            <td><input type="number" class="js-bulk-speed" min="1" max="100" step="0.1" value="${subSt.speedPct}"></td>
            <td><input type="number" class="js-bulk-lamina" min="0.01" step="0.01" value="${subSt.laminaMm}"></td>
            <td>
              <select class="js-bulk-peak-policy">
                <option value="pausar" ${subSt.peakPolicy === "pausar" ? "selected" : ""}>Pausar HP</option>
                <option value="continuar" ${subSt.peakPolicy === "continuar" ? "selected" : ""}>Continuar</option>
                <option value="iniciar_apos_pico" ${subSt.peakPolicy === "iniciar_apos_pico" ? "selected" : ""}>Iniciar apos HP</option>
              </select>
            </td>
            <td><input type="checkbox" class="js-bulk-ferti" ${subSt.ferti ? "checked" : ""}></td>
          </tr>
        `;
      }).join("");
      return main + subRows;
    };
    const captureDraftState = () => {
      modal.querySelectorAll("tr[data-bulk-row]").forEach((row) => {
        const dayIso = row.getAttribute("data-day") || "";
        const rowId = row.getAttribute("data-row-id") || row.getAttribute("data-pivot-id") || "";
        if (!dayIso || !rowId) return;
        const mode = row.querySelector(".js-bulk-stop-mode")?.value || "volta_completa";
        const rawStopValue = asNum(row.querySelector(".js-bulk-voltas")?.value, 1);
        draftState[rowKey(dayIso, rowId)] = {
          enabled: !!row.querySelector(".js-bulk-enable")?.checked,
          startMode: row.querySelector(".js-bulk-start-mode")?.value || "agendado",
          time: row.querySelector(".js-bulk-time")?.value || "06:00",
          direction: row.querySelector(".js-bulk-dir")?.value || "avanco",
          irrigationMode: row.querySelector(".js-bulk-irr")?.value || "molhado",
          stopMode: mode,
          speedPct: asNum(row.querySelector(".js-bulk-speed")?.value, 100),
          laminaMm: asNum(row.querySelector(".js-bulk-lamina")?.value, 0),
          ferti: !!row.querySelector(".js-bulk-ferti")?.checked,
          peakPolicy: row.querySelector(".js-bulk-peak-policy")?.value || "pausar",
          stopValue: Number.isFinite(rawStopValue) ? rawStopValue : 1,
          parcelId: row.querySelector(".js-bulk-parcela")?.value || "",
          angleStart: asNum(row.querySelector(".js-bulk-ang-start")?.value, 0),
          angleEnd: asNum(row.querySelector(".js-bulk-ang-end")?.value, 0)
        };
      });
    };
    const renderDays = () => {
      if (!daysHost) return;
      if (daysNavHost) {
        daysNavHost.innerHTML = `
          ${days.map((dayIso, i) => `
            <button type="button" class="op-bulk-days-nav__btn ${dayIso === selectedDayIso ? "is-active" : ""}" data-action="select-day" data-day="${dayIso}">
              ${dayTitle(dayIso)}
            </button>
          `).join("")}
          <button type="button" class="op-bulk-days-nav__add" data-action="add-day" aria-label="Adicionar dia"><i class="fa-solid fa-plus"></i></button>
        `;
      }
      const activeDayIso = selectedDayIso || days[0] || dayVal;
      daysHost.innerHTML = `
        <header class="op-bulk-day__head" data-day="${activeDayIso}">
          <strong>${dayTitle(activeDayIso)}</strong>
          <span>Programações</span>
        </header>
        <div class="op-bulk-modal__table-wrap">
          <table class="op-bulk-modal__table">
            <thead>
              <tr>
                <th>OK</th><th>Pivo</th><th>Inicio</th><th style="display:none;">Hora</th><th>Início</th><th>Fim</th><th>Direcao</th><th>Irrigacao</th>
                <th>Parada</th><th>Valor</th><th>Vel %</th><th>Lamina</th><th>Pico</th><th>Ferti</th>
              </tr>
            </thead>
            <tbody>${pivots.map((p, i) => rowHtml(activeDayIso, p, i)).join("")}</tbody>
          </table>
        </div>
      `;
      daysNavHost?.querySelectorAll("[data-action='select-day']").forEach((btn) => {
        btn.addEventListener("click", () => {
          captureDraftState();
          selectedDayIso = String(btn.getAttribute("data-day") || selectedDayIso);
          renderDays();
        });
      });
      daysNavHost?.querySelector("[data-action='add-day']")?.addEventListener("click", () => {
        captureDraftState();
        const next = addDayIso(days[days.length - 1], 1);
        days.push(next);
        selectedDayIso = next;
        renderDays();
      });
      daysHost.querySelectorAll(".js-bulk-expand-parcels").forEach((btn) => {
        btn.addEventListener("click", () => {
          const baseRowId = String(btn.getAttribute("data-row-id") || "");
          if (!baseRowId) return;
          const isExpanded = btn.getAttribute("aria-expanded") === "true";
          const nextExpanded = !isExpanded;
          btn.setAttribute("aria-expanded", nextExpanded ? "true" : "false");
          const icon = btn.querySelector("i");
          if (icon) {
            icon.classList.toggle("fa-chevron-right", !nextExpanded);
            icon.classList.toggle("fa-chevron-down", nextExpanded);
          }
          daysHost.querySelectorAll(`tr[data-parent-row-id="${baseRowId}"]`).forEach((sub) => {
            sub.classList.toggle("is-hidden", !nextExpanded);
          });
        });
      });
      const resolveQueuedStartPreview = (pivotId, candidateStartDate, queueList) => {
        const base = candidateStartDate instanceof Date ? new Date(candidateStartDate) : new Date(candidateStartDate);
        if (Number.isNaN(base.getTime())) return base;
        const latestEnd = (Array.isArray(queueList) ? queueList : [])
          .filter((it) => it && String(it.pivotId || "") === String(pivotId || "") && it.status !== "concluida")
          .reduce((acc, it) => {
            const end = new Date(it?.plannedEndAt || it?.finishedAt || it?.startAt || it?.startedAt || 0);
            if (Number.isNaN(end.getTime())) return acc;
            if (!acc || end > acc) return end;
            return acc;
          }, null);
        if (!latestEnd) return base;
        return latestEnd > base ? latestEnd : base;
      };
      const buildDurationPreview = (actLike, baseStartDate, peakCfg, peakPolicy) => {
        const speedPct = asNum(actLike?.speedPct, 100);
        const equip = getPivotEquipById(actLike?.pivotId);
        const p = calcPivotPhysics(equip, speedPct);
        const lapMsAtSpeed = Math.max(1, p.lapHours * 3600 * 1000);
        // Deslocamento a seco sempre roda a 100% de velocidade.
        const lapMsAtFullSpeed = Math.max(1, calcPivotPhysics(equip, 100).lapHours * 3600 * 1000);
        const startAngleBase = normalizeAngle(window.IcGetPivotAngle?.(actLike?.pivotId));
        const plan = buildExecutionPlan(actLike, startAngleBase);
        let totalMs = 0;
        if (actLike.startMode !== "pos_pico" && plan.hasDryMove && plan.dryTargetAngle != null) {
          const dryDeg = plan.dryDirection === "reverso"
            ? angleDeltaCcw(startAngleBase, plan.dryTargetAngle)
            : angleDeltaCw(startAngleBase, plan.dryTargetAngle);
          totalMs += (dryDeg / 360) * lapMsAtFullSpeed;
        }
        if (actLike.stopMode === "volta_completa") {
          const laps = Math.max(0.1, asNum(actLike.stopValue, 1));
          const perCycleDeg = Math.max(0.1, asNum(plan?.cycleDeg, 360));
          const sector = getPivotUsefulSector(actLike?.pivotId);
          const baseSweepDeg = sector ? Math.max(0.1, asNum(sector.sweepDeg, 360)) : 360;
          if (sector) {
            totalMs += laps * lapMsAtSpeed * (perCycleDeg / baseSweepDeg);
          } else {
            totalMs += laps * lapMsAtSpeed;
            totalMs += ((2 * IRRIGATION_COVER_MARGIN_DEG) / 360) * lapMsAtSpeed;
          }
        } else if ((actLike.stopMode === "por_parcela" || actLike.stopMode === "por_angulos")
          && plan.irrigationStartAngle != null && plan.irrigationEndAngle != null) {
          const irrDeg = plan.irrigationDirection === "reverso"
            ? angleDeltaCcw(plan.irrigationStartAngle, plan.irrigationEndAngle)
            : angleDeltaCw(plan.irrigationStartAngle, plan.irrigationEndAngle);
          totalMs += (irrDeg / 360) * lapMsAtSpeed;
        } else {
          return null;
        }
        const rawEnd = new Date(baseStartDate.getTime() + Math.max(0, totalMs));
        return applyPeakPolicyWindow(baseStartDate, rawEnd, peakCfg, peakPolicy);
      };
      const previewWindowForRow = (rw, queueList, nowRef) => {
        const pivotId = rw.getAttribute("data-pivot-id") || "";
        const dayIso = rw.getAttribute("data-day") || dayVal;
        const time = rw.querySelector(".js-bulk-time")?.value || "06:00";
        const startMode = rw.querySelector(".js-bulk-start-mode")?.value || "agendado";
        const direction = rw.querySelector(".js-bulk-dir")?.value || "avanco";
        const stopMode = rw.querySelector(".js-bulk-stop-mode")?.value || "volta_completa";
        const peakPolicy = rw.querySelector(".js-bulk-peak-policy")?.value || "pausar";
        const speedPct = Number(asNum(rw.querySelector(".js-bulk-speed")?.value, 100).toFixed(2));
        const startAtCandidate = new Date(`${dayIso}T${time}`);
        if (Number.isNaN(startAtCandidate.getTime()) || parseTimeToMinutes(time) == null) return null;
        const peakCfg = getPeakConfigByPivotId(pivotId);
        let requestedStart = startAtCandidate;
        if (startMode === "agora") requestedStart = new Date(nowRef);
        if (startMode === "pos_pico") requestedStart = new Date(nextPeakEndSameDay(startAtCandidate, peakCfg));
        requestedStart = resolveQueuedStartPreview(pivotId, requestedStart, queueList);
        if (Number.isNaN(requestedStart.getTime())) return null;
        const parcelId = stopMode === "por_parcela" ? String(rw.querySelector(".js-bulk-parcela")?.value || "") : "";
        const parcelData = stopMode === "por_parcela"
          ? getPivotParcelas(pivotId).find((p) => String(p.id) === parcelId)
          : null;
        const angleStart = stopMode === "por_angulos" ? normalizeAngle(rw.querySelector(".js-bulk-ang-start")?.value) : null;
        const angleEnd = stopMode === "por_angulos" ? normalizeAngle(rw.querySelector(".js-bulk-ang-end")?.value) : null;
        const stopValue = stopMode === "volta_completa"
          ? Number(Math.max(0.1, asNum(rw.querySelector(".js-bulk-voltas")?.value, 1)).toFixed(2))
          : 0;
        if (stopMode === "por_parcela" && !parcelData) return null;
        if (stopMode === "por_angulos" && (angleStart == null || angleEnd == null)) return null;
        const activityBase = {
          pivotId,
          direction,
          startMode,
          stopMode,
          stopValue,
          speedPct,
          parcelId: parcelData?.id || null,
          parcelName: parcelData?.name || null,
          angleStart,
          angleEnd
        };
        return buildDurationPreview(activityBase, requestedStart, peakCfg, peakPolicy);
      };
      daysHost.querySelectorAll("tr[data-bulk-row]").forEach((row) => {
        const pivotId = row.getAttribute("data-pivot-id");
        const speedInput = row.querySelector(".js-bulk-speed");
        const laminaInput = row.querySelector(".js-bulk-lamina");
        const equip = getPivotEquipById(pivotId);
        const syncLamina = () => {
          const p = calcPivotPhysics(equip, asNum(speedInput?.value, 100));
          if (laminaInput) laminaInput.value = p.laminaMm.toFixed(2);
        };
        const syncSpeed = () => {
          const p100 = calcPivotPhysics(equip, 100);
          const target = Math.max(0.0001, asNum(laminaInput?.value, p100.laminaMm));
          const pct = Math.min(100, Math.max(1, (p100.laminaMm / target) * 100));
          if (speedInput) speedInput.value = pct.toFixed(2);
        };
        const applyStopDynamic = () => {
          const mode = row.querySelector(".js-bulk-stop-mode")?.value || "volta_completa";
          const cell = row.querySelector(".js-bulk-stop-cell");
          if (!cell) return;
          const fixedParcelId = String(row.getAttribute("data-fixed-parcel-id") || "");
          if (fixedParcelId) {
            const parcelas = getPivotParcelas(pivotId);
            const parcela = parcelas.find((p) => String(p.id) === fixedParcelId);
            cell.innerHTML = `<select class="js-bulk-parcela"><option value="${escHtml(fixedParcelId)}" selected>${escHtml(parcela?.name || "Parcela")}</option></select>`;
            return;
          }
          cell.innerHTML = stopDynamicHtml(pivotId, mode);
          if (mode === "volta_completa") {
            const defStop = asNum(cell.getAttribute("data-stop-value"), 1);
            const inp = cell.querySelector(".js-bulk-voltas");
            if (inp) inp.value = Number.isFinite(defStop) ? String(defStop) : "1";
          } else if (mode === "por_parcela") {
            const defParcel = String(cell.getAttribute("data-parcel-id") || "");
            const sel = cell.querySelector(".js-bulk-parcela");
            if (sel && defParcel) sel.value = defParcel;
          } else if (mode === "por_angulos") {
            const a0 = asNum(cell.getAttribute("data-angle-start"), 0);
            const a1 = asNum(cell.getAttribute("data-angle-end"), 0);
            const i0 = cell.querySelector(".js-bulk-ang-start");
            const i1 = cell.querySelector(".js-bulk-ang-end");
            if (i0) i0.value = String(a0);
            if (i1) i1.value = String(a1);
          }
        };
        const updateRowDateTimes = () => {
          const dayIso = row.getAttribute("data-day") || "";
          const sectionRows = Array.from(daysHost.querySelectorAll(`tr[data-bulk-row][data-day="${dayIso}"]`));
          const sortedRows = sectionRows.sort((a, b) => {
            const ta = parseTimeToMinutes(a.querySelector(".js-bulk-time")?.value || "00:00");
            const tb = parseTimeToMinutes(b.querySelector(".js-bulk-time")?.value || "00:00");
            return (Number.isFinite(ta) ? ta : 0) - (Number.isFinite(tb) ? tb : 0);
          });
          const queue = loadActivities().slice();
          const nowRef = getSimulationNow();
          sortedRows.forEach((rw) => {
            const startOut = rw.querySelector(".js-bulk-start-dt");
            const endOut = rw.querySelector(".js-bulk-end-dt");
            const prev = previewWindowForRow(rw, queue, nowRef);
            if (prev?.start && prev?.end && !Number.isNaN(prev.start.getTime()) && !Number.isNaN(prev.end.getTime())) {
              if (startOut) startOut.value = toPtDateTimeValue(prev.start);
              if (endOut) endOut.value = toPtDateTimeValue(prev.end);
              if (rw.querySelector(".js-bulk-enable")?.checked) {
                queue.push({
                  id: `q_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
                  pivotId: rw.getAttribute("data-pivot-id") || "",
                  status: "programada",
                  startAt: prev.start.toISOString(),
                  plannedEndAt: prev.end.toISOString()
                });
              }
            } else {
              if (startOut) startOut.value = "--";
              if (endOut) endOut.value = "--";
            }
          });
        };
        const applyRowStartModeUI = () => {
          const startMode = row.querySelector(".js-bulk-start-mode")?.value || "agendado";
          const timeField = row.querySelector(".js-bulk-time");
          if (!timeField) return;
          const isScheduled = startMode === "agendado";
          timeField.disabled = !isScheduled;
          timeField.setAttribute("aria-readonly", isScheduled ? "false" : "true");
          timeField.title = isScheduled
            ? "Hora usada quando o modo de início é agendado"
            : "Hora automática conforme modo de início";
        };
        speedInput?.addEventListener("input", syncLamina);
        laminaInput?.addEventListener("input", syncSpeed);
        row.querySelector(".js-bulk-stop-mode")?.addEventListener("change", applyStopDynamic);
        row.querySelector(".js-bulk-start-mode")?.addEventListener("change", applyRowStartModeUI);
        row.querySelectorAll("input,select").forEach((el) => {
          el.addEventListener("input", updateRowDateTimes);
          el.addEventListener("change", updateRowDateTimes);
        });
        syncLamina();
        applyStopDynamic();
        applyRowStartModeUI();
        updateRowDateTimes();
      });
    };

    modal.querySelector(".op-bulk-modal__backdrop")?.addEventListener("click", close);
    modal.querySelector(".op-bulk-modal__close")?.addEventListener("click", close);
    modal.querySelector(".js-bulk-cancel")?.addEventListener("click", close);

    modal.querySelector(".js-bulk-save")?.addEventListener("click", () => {
      captureDraftState();
      const list = loadActivities();
      let created = 0;
      let invalid = 0;
      const nowRef = getSimulationNow();
      const saveDayIso = String(selectedDayIso || "");
      const rowsToSave = saveDayIso
        ? modal.querySelectorAll(`tr[data-bulk-row][data-day="${saveDayIso}"]`)
        : modal.querySelectorAll("tr[data-bulk-row]");
      const resolveQueuedStartAt = (pivotId, candidateStartDate, ignoreId = "") => {
        const base = candidateStartDate instanceof Date ? new Date(candidateStartDate) : new Date(candidateStartDate);
        if (Number.isNaN(base.getTime())) return base;
        const latestEnd = list
          .filter((it) =>
            it &&
            String(it.pivotId || "") === String(pivotId || "") &&
            it.status !== "concluida" &&
            String(it.id || "") !== String(ignoreId || "")
          )
          .reduce((acc, it) => {
            const end = new Date(it?.plannedEndAt || it?.finishedAt || it?.startAt || it?.startedAt || 0);
            if (Number.isNaN(end.getTime())) return acc;
            if (!acc || end > acc) return end;
            return acc;
          }, null);
        if (!latestEnd) return base;
        return latestEnd > base ? latestEnd : base;
      };
      const buildDurationMs = (actLike, baseStartDate, peakCfg, peakPolicy) => {
        const speedPct = asNum(actLike?.speedPct, 100);
        const equip = getPivotEquipById(actLike?.pivotId);
        const p = calcPivotPhysics(equip, speedPct);
        const lapMsAtSpeed = Math.max(1, p.lapHours * 3600 * 1000);
        // Deslocamento a seco sempre roda a 100% de velocidade.
        const lapMsAtFullSpeed = Math.max(1, calcPivotPhysics(equip, 100).lapHours * 3600 * 1000);
        const startAngleBase = normalizeAngle(window.IcGetPivotAngle?.(actLike?.pivotId));
        const plan = buildExecutionPlan(actLike, startAngleBase);
        let totalMs = 0;
        if (actLike.startMode !== "pos_pico" && plan.hasDryMove && plan.dryTargetAngle != null) {
          const dryDeg = plan.dryDirection === "reverso"
            ? angleDeltaCcw(startAngleBase, plan.dryTargetAngle)
            : angleDeltaCw(startAngleBase, plan.dryTargetAngle);
          totalMs += (dryDeg / 360) * lapMsAtFullSpeed;
        }
        if (actLike.stopMode === "volta_completa") {
          const laps = Math.max(0.1, asNum(actLike.stopValue, 1));
          const perCycleDeg = Math.max(0.1, asNum(plan?.cycleDeg, 360));
          const sector = getPivotUsefulSector(actLike?.pivotId);
          const baseSweepDeg = sector ? Math.max(0.1, asNum(sector.sweepDeg, 360)) : 360;
          if (sector) {
            totalMs += laps * lapMsAtSpeed * (perCycleDeg / baseSweepDeg);
          } else {
            totalMs += laps * lapMsAtSpeed;
            totalMs += ((2 * IRRIGATION_COVER_MARGIN_DEG) / 360) * lapMsAtSpeed;
          }
        } else if ((actLike.stopMode === "por_parcela" || actLike.stopMode === "por_angulos")
          && plan.irrigationStartAngle != null && plan.irrigationEndAngle != null) {
          const irrDeg = plan.irrigationDirection === "reverso"
            ? angleDeltaCcw(plan.irrigationStartAngle, plan.irrigationEndAngle)
            : angleDeltaCw(plan.irrigationStartAngle, plan.irrigationEndAngle);
          totalMs += (irrDeg / 360) * lapMsAtSpeed;
        } else {
          return null;
        }
        const rawEnd = new Date(baseStartDate.getTime() + Math.max(0, totalMs));
        return applyPeakPolicyWindow(baseStartDate, rawEnd, peakCfg, peakPolicy);
      };

      rowsToSave.forEach((row) => {
        const enabled = !!row.querySelector(".js-bulk-enable")?.checked;
        if (!enabled) return;
        const pivotId = row.getAttribute("data-pivot-id") || "";
        const pivotName = row.getAttribute("data-pivot-name") || "Pivo";
        const dayIso = row.getAttribute("data-day") || dayVal;
        const time = row.querySelector(".js-bulk-time")?.value || "06:00";
        const startMode = row.querySelector(".js-bulk-start-mode")?.value || "agendado";
        const direction = row.querySelector(".js-bulk-dir")?.value || "avanco";
        const irrigationMode = row.querySelector(".js-bulk-irr")?.value || "molhado";
        const stopMode = row.querySelector(".js-bulk-stop-mode")?.value || "volta_completa";
        const peakPolicy = row.querySelector(".js-bulk-peak-policy")?.value || "pausar";
        const speedPct = Number(asNum(row.querySelector(".js-bulk-speed")?.value, 100).toFixed(2));
        const laminaMm = Number(asNum(row.querySelector(".js-bulk-lamina")?.value, calcPivotPhysics(getPivotEquipById(pivotId), speedPct).laminaMm).toFixed(2));
        const startAtCandidate = new Date(`${dayIso}T${time}`);
        if (Number.isNaN(startAtCandidate.getTime()) || parseTimeToMinutes(time) == null) {
          invalid += 1;
          return;
        }
        const peakCfg = getPeakConfigByPivotId(pivotId);
        let requestedStart = startAtCandidate;
        if (startMode === "agora") requestedStart = new Date(nowRef);
        if (startMode === "pos_pico") requestedStart = new Date(nextPeakEndSameDay(startAtCandidate, peakCfg));
        requestedStart = resolveQueuedStartAt(pivotId, requestedStart);
        if (Number.isNaN(requestedStart.getTime())) {
          invalid += 1;
          return;
        }

        const parcelId = stopMode === "por_parcela" ? String(row.querySelector(".js-bulk-parcela")?.value || "") : "";
        const parcelData = stopMode === "por_parcela"
          ? getPivotParcelas(pivotId).find((p) => String(p.id) === parcelId)
          : null;
        const angleStart = stopMode === "por_angulos" ? normalizeAngle(row.querySelector(".js-bulk-ang-start")?.value) : null;
        const angleEnd = stopMode === "por_angulos" ? normalizeAngle(row.querySelector(".js-bulk-ang-end")?.value) : null;
        const stopValue = stopMode === "volta_completa"
          ? Number(Math.max(0.1, asNum(row.querySelector(".js-bulk-voltas")?.value, 1)).toFixed(2))
          : 0;
        if (stopMode === "por_parcela" && !parcelData) {
          invalid += 1;
          return;
        }
        if (stopMode === "por_angulos" && (angleStart == null || angleEnd == null)) {
          invalid += 1;
          return;
        }
        const activityBase = {
          pivotId,
          direction,
          startMode,
          stopMode,
          stopValue,
          speedPct,
          parcelId: parcelData?.id || null,
          parcelName: parcelData?.name || null,
          angleStart,
          angleEnd
        };
        const adjustedWindow = buildDurationMs(activityBase, requestedStart, peakCfg, peakPolicy);
        if (!adjustedWindow?.start || !adjustedWindow?.end || Number.isNaN(adjustedWindow.start.getTime()) || Number.isNaN(adjustedWindow.end.getTime())) {
          invalid += 1;
          return;
        }
        const finalStartAt = adjustedWindow.start.toISOString();
        list.push({
          id: `act_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
          pivotId,
          pivotName,
          status: "programada",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          startedAt: null,
          lastTickAt: null,
          runMs: 0,
          irrigatedDeg: 0,
          pauseState: false,
          finishedAt: null,
          plannedEndAt: adjustedWindow.end.toISOString(),
          startAngle: normalizeAngle(window.IcGetPivotAngle?.(pivotId)),
          endAngle: null,
          startAt: finalStartAt,
          irrigationStartAt: startMode === "pos_pico" ? finalStartAt : null,
          startMode,
          direction,
          irrigationMode,
          ferti: !!row.querySelector(".js-bulk-ferti")?.checked,
          speedPct,
          laminaMm,
          stopMode,
          stopValue,
          parcelId: parcelData?.id || null,
          parcelName: parcelData?.name || null,
          angleStart,
          angleEnd,
          peakPolicy,
          _peakPolicyApplied: true
        });
        created += 1;
      });
      if (!created) {
        window.IcNotify?.warn?.("Nenhuma atividade valida para salvar.", 1800);
        return;
      }
      saveActivities(list);
      const dayLabel = saveDayIso ? dayTitle(saveDayIso) : "";
      if (invalid > 0) {
        window.IcNotify?.warn?.(`${created} programada(s) em ${dayLabel}, ${invalid} ignorada(s).`, 2200);
      } else {
        window.IcNotify?.success?.(`${created} atividade(s) programada(s) em ${dayLabel}.`, 1800);
      }
      close();
    });
    renderDays();
  };

  const finalizeActivity = (act, simDate, plan, currAngle, opts = {}) => {
    const pivotId = act?.pivotId;
    if (!act || !pivotId) return;
    const finalBearing = normalizeAngle(
      opts?.snapEndAngle ?? plan?.irrigationEndAngle ?? currAngle ?? window.IcGetPivotAngle?.(pivotId)
    );
    act.status = "concluida";
    act.finishedAt = (simDate instanceof Date ? simDate : new Date(simDate)).toISOString();
    act.completedOrder = nextCompletionOrder();
    if (!Number.isFinite(asNum(act.executedSpeedPct, NaN))) act.executedSpeedPct = asNum(act.speedPct, 100);
    if (!Number.isFinite(asNum(act.executedLaminaMm, NaN))) {
      act.executedLaminaMm = asNum(act.laminaMm, calcPivotPhysics(getPivotEquipById(pivotId), asNum(act.speedPct, 100)).laminaMm);
    }
    if (finalBearing != null) {
      act.endAngle = finalBearing;
      window.IcSetSimPivotBearing?.(pivotId, finalBearing, true);
    }
    if (opts?.coverageLabel) act.coverageLabel = String(opts.coverageLabel);
    else act.coverageLabel = getCoverageLabelForActivity(act, plan);
    act.phase = "done";
    act.pauseState = false;
    act.pauseStartedAt = null;
    window.IcSetSimPivotSpeed?.(pivotId, null);
    window.IcSetSimPivotStatus?.(pivotId, PIVOT_STATUS_ENERGIZADO);
  };

  const executeActivitiesAt = (clockDate) => {
    const simDate = clockDate instanceof Date ? clockDate : new Date(clockDate);
    if (Number.isNaN(simDate.getTime())) return;
    const list = loadActivities();
    let changed = false;
    const itemTs = (it, key) => {
      const d = new Date(it?.[key] || 0);
      const ts = d.getTime();
      return Number.isFinite(ts) ? ts : 0;
    };
    const canRunNowByPivotQueue = (activity) => {
      const pid = String(activity?.pivotId || "");
      const aid = String(activity?.id || "");
      if (!pid || !aid) return true;
      const queue = list
        .filter((it) => it && String(it.pivotId || "") === pid && it.status !== "concluida")
        .sort((a, b) => {
          const pa = a?.status === "pausada" ? 0 : (a?.status === "em_execucao" ? 1 : 2);
          const pb = b?.status === "pausada" ? 0 : (b?.status === "em_execucao" ? 1 : 2);
          if (pa !== pb) return pa - pb;
          const sa = itemTs(a, "startAt");
          const sb = itemTs(b, "startAt");
          if (sa !== sb) return sa - sb;
          const ca = itemTs(a, "createdAt");
          const cb = itemTs(b, "createdAt");
          if (ca !== cb) return ca - cb;
          return String(a?.id || "").localeCompare(String(b?.id || ""));
        });
      return String(queue[0]?.id || "") === aid;
    };

    list.forEach((act) => {
      if (!act || !act.pivotId || act.status === "concluida") return;
      const stopModeRawNorm = String(act.stopMode || "");
      const stopModeNorm = stopModeRawNorm === "por_voltas" ? "volta_completa" : (stopModeRawNorm === "por_local" ? "por_angulos" : stopModeRawNorm);
      if (stopModeNorm === "volta_completa" && (!Number.isFinite(asNum(act.stopValue, NaN)) || asNum(act.stopValue, 0) <= 0)) {
        act.stopValue = 1;
        changed = true;
      }
      const peakCfg = getPeakConfigByPivotId(act.pivotId);
      const startAt = new Date(act.startAt || simDate);
      if (Number.isNaN(startAt.getTime())) return;

      if (act.status === "programada") {
        if (isPivotInAlert(act.pivotId)) return;
        // Pré-programações (Programações Múltiplas) só iniciam após confirmação do dia.
        if (act.needsConfirmation && !act.confirmedAt) return;
        // Fila global por pivô: só a 1ª atividade pendente pode iniciar.
        if (!canRunNowByPivotQueue(act)) return;
        let canStart = simDate >= startAt;
        let irrigationAnchorAt = null;

        // Garante consistencia para atividades antigas/salvas antes do ajuste:
        // politica "pausar" precisa ter o fim ja estendido pelo tempo em ponta.
        if (act.peakPolicy === "pausar" && !act._peakPolicyApplied && act.plannedEndAt) {
          const s = new Date(startAt);
          const e = new Date(act.plannedEndAt);
          if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && e > s) {
            const adj = applyPeakPolicyWindow(s, e, peakCfg, "pausar");
            if (adj?.end && !Number.isNaN(adj.end.getTime())) {
              act.plannedEndAt = adj.end.toISOString();
            }
          }
          act._peakPolicyApplied = true;
          changed = true;
        }

        // Regra global: independente do modo de inicio, se a janela [inicio-fim]
        // cruzar horario de pico e a politica for "iniciar apos pico", adia.
        if (act.peakPolicy === "iniciar_apos_pico") {
          const plannedStart = new Date(startAt);
          const plannedEnd = act.plannedEndAt ? new Date(act.plannedEndAt) : null;
          if (plannedEnd && !Number.isNaN(plannedEnd.getTime()) && plannedEnd > plannedStart) {
            const durationMs = plannedEnd.getTime() - plannedStart.getTime();
            const shiftedStart = nextPeakEndAtOrAfter(plannedStart, peakCfg);
            if (shiftedStart > plannedStart) {
              act.startAt = shiftedStart.toISOString();
              act.plannedEndAt = new Date(shiftedStart.getTime() + durationMs).toISOString();
              if (act.startMode === "pos_pico") act.irrigationStartAt = act.startAt;
              changed = true;
              return;
            }
          }
        }

        if (act.startMode === "pos_pico") {
          irrigationAnchorAt = new Date(act.irrigationStartAt || nextPeakEndSameDay(simDate, peakCfg));
          if (Number.isNaN(irrigationAnchorAt.getTime())) irrigationAnchorAt = new Date(nextPeakEndSameDay(simDate, peakCfg));
          const startAngleNowForDry = normalizeAngle(window.IcGetPivotAngle?.(act.pivotId));
          const dryMs = estimateDryMoveMs(act, startAngleNowForDry);
          let dryStartAt = new Date(irrigationAnchorAt.getTime() - dryMs);

          // Preferencia: evitar qualquer movimento (inclusive seco) dentro do HP,
          // sem deixar o seco "travado" quando ja pode ser executado antes.
          const peakWindow = getPeakWindowEndingSameDay(irrigationAnchorAt, peakCfg);
          if (peakWindow && dryMs > 0) {
            if (simDate < peakWindow.start) {
              // Antes do HP: executa seco agora para ja posicionar.
              dryStartAt = new Date(simDate);
              const dryEndAt = new Date(dryStartAt.getTime() + dryMs);
              if (dryEndAt > irrigationAnchorAt) irrigationAnchorAt = dryEndAt;
            } else if (simDate >= peakWindow.start && simDate < peakWindow.end) {
              // Durante HP: espera sair do HP e so entao executa seco.
              dryStartAt = new Date(peakWindow.end);
              irrigationAnchorAt = new Date(dryStartAt.getTime() + dryMs);
            } else {
              // Apos HP: inicia seco imediatamente.
              dryStartAt = new Date(simDate);
              const dryEndAt = new Date(dryStartAt.getTime() + dryMs);
              if (dryEndAt > irrigationAnchorAt) irrigationAnchorAt = dryEndAt;
            }
          }

          act.irrigationStartAt = irrigationAnchorAt.toISOString();
          canStart = simDate >= dryStartAt;
          if (!canStart) {
            changed = true;
            return;
          }
        } else if (act.peakPolicy === "iniciar_apos_pico") {
          // Fallback: se no momento de iniciar estiver em pico, empurra para saida do pico.
          if (isInPeak(simDate, peakCfg)) {
            act.startAt = nextPeakEnd(simDate, peakCfg);
            changed = true;
            return;
          }
        }
        if (!canStart) return;
        const startAngleNow = normalizeAngle(window.IcGetPivotAngle?.(act.pivotId));
        const plan = buildExecutionPlan(act, startAngleNow);
        act.execPlan = plan;
        act.startAngle = startAngleNow != null ? startAngleNow : normalizeAngle(act.startAngle);
        act.phase = plan.hasDryMove ? "dry_move" : "irrigating";
        if (act.phase === "dry_move") {
          window.IcSetSimPivotDirection?.(act.pivotId, plan.dryDirection === "reverso" ? -1 : 1);
          window.IcSetSimPivotSpeed?.(act.pivotId, 100); // movimento a seco sempre 100%
          window.IcSetSimPivotStatus?.(act.pivotId, PIVOT_STATUS_SECO);
        } else {
          if (plan.irrigationStartAngle != null) {
            window.IcSetSimPivotBearing?.(act.pivotId, plan.irrigationStartAngle, true);
            act.startAngle = normalizeAngle(plan.irrigationStartAngle);
            act.lastAngle = normalizeAngle(plan.irrigationStartAngle);
          }
          window.IcSetSimPivotDirection?.(act.pivotId, plan.irrigationDirection === "reverso" ? -1 : 1);
          window.IcSetSimPivotSpeed?.(act.pivotId, asNum(act.speedPct, 100));
          window.IcSetSimPivotStatus?.(act.pivotId, act.irrigationMode === "molhado" ? PIVOT_STATUS_IRRIGANDO : PIVOT_STATUS_SECO);
          act.coverageLabel = getCoverageLabelForActivity(act, plan);
        }
        act.status = "em_execucao";
        act.startedAt = simDate.toISOString();
        act.executedSpeedPct = asNum(act.speedPct, 100);
        act.executedLaminaMm = asNum(act.laminaMm, calcPivotPhysics(getPivotEquipById(act.pivotId), asNum(act.speedPct, 100)).laminaMm);
        act.irrigationTargetDeg = asNum(plan?.irrigationTargetDeg, NaN);
        act.lastTickAt = simDate.toISOString();
        // Mantem como referencia o angulo real de inicio da fase atual (evita salto de 360deg no 1o tick).
        act.lastAngle = normalizeAngle(act.lastAngle ?? act.startAngle ?? startAngleNow);
        act.runMs = 0;
        act.irrigatedDeg = 0;
        act.pauseState = false;
        act.pauseStartedAt = null;
        changed = true;
      }

      if (act.status === "em_execucao") {
        if (isPivotInAlert(act.pivotId)) {
          act.status = "pausada";
          act.pauseState = true;
          act.pauseReason = "alert";
          act.alertDecision = null;
          act.pauseStartedAt = simDate.toISOString();
          act.lastTickAt = simDate.toISOString();
          window.IcSetSimPivotSpeed?.(act.pivotId, null);
          // Não força PAUSA HP para manter apenas o estado de ALERTA visível.
          changed = true;
          return;
        }
        if (act.phase === "wait_irrigation_window") {
          const irrigationAt = new Date(act.irrigationStartAt || nextPeakEndSameDay(simDate, peakCfg));
          if (!Number.isNaN(irrigationAt.getTime()) && simDate >= irrigationAt) {
            const plan = act.execPlan || buildExecutionPlan(act, normalizeAngle(window.IcGetPivotAngle?.(act.pivotId)));
            act.execPlan = plan;
            act.phase = "irrigating";
            if (!Number.isFinite(asNum(act.executedSpeedPct, NaN))) act.executedSpeedPct = asNum(act.speedPct, 100);
            if (!Number.isFinite(asNum(act.executedLaminaMm, NaN))) {
              act.executedLaminaMm = asNum(act.laminaMm, calcPivotPhysics(getPivotEquipById(act.pivotId), asNum(act.speedPct, 100)).laminaMm);
            }
            if (!Number.isFinite(asNum(act.irrigationTargetDeg, NaN))) act.irrigationTargetDeg = asNum(plan?.irrigationTargetDeg, NaN);
            act.lastTickAt = simDate.toISOString();
            if (!Number.isFinite(asNum(act.irrigatedDeg, NaN))) act.irrigatedDeg = 0;
            if (plan.irrigationStartAngle != null) {
              window.IcSetSimPivotBearing?.(act.pivotId, plan.irrigationStartAngle, true);
              act.startAngle = normalizeAngle(plan.irrigationStartAngle);
              act.lastAngle = normalizeAngle(plan.irrigationStartAngle);
            }
            window.IcSetSimPivotDirection?.(act.pivotId, plan.irrigationDirection === "reverso" ? -1 : 1);
            window.IcSetSimPivotSpeed?.(act.pivotId, asNum(act.speedPct, 100));
            window.IcSetSimPivotStatus?.(act.pivotId, act.irrigationMode === "molhado" ? PIVOT_STATUS_IRRIGANDO : PIVOT_STATUS_SECO);
            act.coverageLabel = getCoverageLabelForActivity(act, plan);
            changed = true;
          }
          return;
        }
        if (act.phase === "dry_move" && isInPeak(simDate, peakCfg)) {
          act.status = "pausada";
          act.pauseState = true;
          act.pauseReason = "peak";
          act.pauseStartedAt = simDate.toISOString();
          window.IcSetSimPivotSpeed?.(act.pivotId, null);
          window.IcSetSimPivotStatus?.(act.pivotId, PIVOT_STATUS_PAUSADO);
          changed = true;
          return;
        }
        if (act.peakPolicy === "pausar" && act.phase !== "dry_move" && isInPeak(simDate, peakCfg)) {
          act.status = "pausada";
          act.pauseState = true;
          act.pauseReason = "peak";
          act.pauseStartedAt = simDate.toISOString();
          window.IcSetSimPivotSpeed?.(act.pivotId, null);
          window.IcSetSimPivotStatus?.(act.pivotId, PIVOT_STATUS_PAUSADO);
          changed = true;
          return;
        }
        const prevTick = new Date(act.lastTickAt || simDate);
        if (!Number.isNaN(prevTick.getTime()) && simDate > prevTick) {
          if (act.phase !== "dry_move") {
            act.runMs = asNum(act.runMs, 0) + (simDate.getTime() - prevTick.getTime());
          }
        }
        act.lastTickAt = simDate.toISOString();
        changed = true;

        const equip = getPivotEquipById(act.pivotId);
        const phys = calcPivotPhysics(equip, act.speedPct);
        const lapMs = phys.lapHours * 60 * 60 * 1000;
        const currAngle = normalizeAngle(window.IcGetPivotAngle?.(act.pivotId));
        const prevAngle = normalizeAngle(act.lastAngle != null ? act.lastAngle : currAngle);
        const plan = act.execPlan || buildExecutionPlan(act, currAngle);
        act.execPlan = plan;

        if (act.phase === "dry_move") {
          if (currAngle != null && didCrossTarget(prevAngle, currAngle, plan.dryTargetAngle, plan.dryDirection || "avanco", 2)) {
            const irrigationAt = act.startMode === "pos_pico"
              ? new Date(act.irrigationStartAt || nextPeakEndSameDay(simDate, peakCfg))
              : null;
            if (irrigationAt && !Number.isNaN(irrigationAt.getTime()) && simDate < irrigationAt) {
              act.phase = "wait_irrigation_window";
              act.startAngle = normalizeAngle(currAngle);
              act.lastAngle = normalizeAngle(currAngle);
              window.IcSetSimPivotSpeed?.(act.pivotId, null);
              window.IcSetSimPivotStatus?.(act.pivotId, PIVOT_STATUS_ENERGIZADO);
              changed = true;
            } else {
              act.phase = "irrigating";
              if (!Number.isFinite(asNum(act.executedSpeedPct, NaN))) act.executedSpeedPct = asNum(act.speedPct, 100);
              if (!Number.isFinite(asNum(act.executedLaminaMm, NaN))) {
                act.executedLaminaMm = asNum(act.laminaMm, calcPivotPhysics(getPivotEquipById(act.pivotId), asNum(act.speedPct, 100)).laminaMm);
              }
              if (!Number.isFinite(asNum(act.irrigationTargetDeg, NaN))) act.irrigationTargetDeg = asNum(plan?.irrigationTargetDeg, NaN);
              if (!Number.isFinite(asNum(act.irrigatedDeg, NaN))) act.irrigatedDeg = 0;
              if (plan.irrigationStartAngle != null) {
                window.IcSetSimPivotBearing?.(act.pivotId, plan.irrigationStartAngle, true);
              }
              window.IcSetSimPivotDirection?.(act.pivotId, plan.irrigationDirection === "reverso" ? -1 : 1);
              window.IcSetSimPivotSpeed?.(act.pivotId, asNum(act.speedPct, 100));
              window.IcSetSimPivotStatus?.(act.pivotId, act.irrigationMode === "molhado" ? PIVOT_STATUS_IRRIGANDO : PIVOT_STATUS_SECO);
              const snappedStart = normalizeAngle(plan.irrigationStartAngle ?? currAngle);
              act.startAngle = snappedStart;
              act.lastAngle = snappedStart;
              act.lastTickAt = simDate.toISOString();
              act.coverageLabel = getCoverageLabelForActivity(act, plan);
              changed = true;
              return;
            }
          }
          act.lastAngle = currAngle != null ? currAngle : prevAngle;
          return;
        }

        const stopModeRaw = String(act.stopMode || "");
        const stopMode = stopModeRaw === "por_voltas" ? "volta_completa" : (stopModeRaw === "por_local" ? "por_angulos" : stopModeRaw);
        if (act.phase === "irrigating" && currAngle != null && prevAngle != null) {
          const movedDeg = (plan.irrigationDirection === "reverso")
            ? angleDeltaCcw(prevAngle, currAngle)
            : angleDeltaCw(prevAngle, currAngle);
          act.irrigatedDeg = Math.max(0, asNum(act.irrigatedDeg, 0)) + Math.max(0, movedDeg);
          changed = true;
        }
        if (stopMode === "volta_completa" && asNum(act.stopValue, 1) > 0) {
          const laps = Math.max(0.1, asNum(act.stopValue, 1));
          const perCycleDeg = Math.max(0.1, asNum(plan?.cycleDeg, 360));
          const targetDeg = laps * perCycleDeg;
          const fullCircleMs = Math.max(1, lapMs / Math.max(0.0001, asNum(phys?.sweepRatio, 1)));
          const targetMs = laps * (perCycleDeg / 360) * fullCircleMs;
          const reachedByDegrees = asNum(act.irrigatedDeg, 0) >= targetDeg;
          const noAngleTelemetry = (currAngle == null || prevAngle == null);
          const reachedByTimeFallback = noAngleTelemetry && asNum(act.runMs, 0) >= targetMs;
          if (reachedByDegrees || reachedByTimeFallback) {
            finalizeActivity(act, simDate, plan, currAngle, { snapEndAngle: plan?.irrigationEndAngle });
            changed = true;
          }
        } else if ((stopMode === "por_angulos" || stopMode === "por_parcela") && plan.irrigationEndAngle != null) {
          const rawTargetDeg = asNum(act.irrigationTargetDeg, asNum(plan.irrigationTargetDeg, NaN));
          const hasTargetDeg = Number.isFinite(rawTargetDeg) && rawTargetDeg > 0;
          const targetDeg = hasTargetDeg ? rawTargetDeg : NaN;
          const progressDeg = asNum(act.irrigatedDeg, 0);
          // Regra global: encerra ao percorrer todo o arco programado (já com margens).
          // Fallback por cruzamento apenas quando não houver targetDeg válido.
          const reachedByProgress = hasTargetDeg && progressDeg >= targetDeg;
          const crossedTarget = !hasTargetDeg && currAngle != null
            && didCrossTarget(prevAngle, currAngle, plan.irrigationEndAngle, plan.irrigationDirection || "avanco", 2);
          if (reachedByProgress || crossedTarget) {
            const coverageLabel = stopMode === "por_angulos"
              ? `${formatCoverageAngle(act.startAngle)}-${formatCoverageAngle(plan?.irrigationEndAngle)}`
              : getCoverageLabelForActivity(act, plan);
            finalizeActivity(act, simDate, plan, currAngle, {
              snapEndAngle: plan?.irrigationEndAngle,
              coverageLabel
            });
            changed = true;
          }
        } else if (stopMode === "por_angulos" || stopMode === "por_parcela") {
          const plannedEnd = new Date(act.plannedEndAt || 0);
          if (!Number.isNaN(plannedEnd.getTime()) && simDate >= plannedEnd) {
            finalizeActivity(act, simDate, plan, currAngle, { snapEndAngle: currAngle });
            changed = true;
          }
        } else if (stopModeRaw === "sem_parar") {
          // legado
        }
        act.lastAngle = currAngle != null ? currAngle : prevAngle;
        changed = true;
      } else if (act.status === "pausada") {
        const pauseReason = String(act.pauseReason || (act.pauseState ? "peak" : ""));
        if (pauseReason === "alert") {
          const prevPauseTick = new Date(act.lastTickAt || act.pauseStartedAt || simDate);
          if (!Number.isNaN(prevPauseTick.getTime()) && simDate > prevPauseTick) {
            const deltaMs = simDate.getTime() - prevPauseTick.getTime();
            const plannedEnd = new Date(act.plannedEndAt || 0);
            if (!Number.isNaN(plannedEnd.getTime()) && deltaMs > 0) {
              act.plannedEndAt = new Date(plannedEnd.getTime() + deltaMs).toISOString();
            }
            if (String(act.phase || "") === "wait_irrigation_window") {
              const irrigationStart = new Date(act.irrigationStartAt || 0);
              if (!Number.isNaN(irrigationStart.getTime()) && deltaMs > 0) {
                act.irrigationStartAt = new Date(irrigationStart.getTime() + deltaMs).toISOString();
              }
            }
            act.lastTickAt = simDate.toISOString();
            changed = true;
          }
          if (isPivotInAlert(act.pivotId)) return;
          const decision = String(act.alertDecision || "");
          if (decision !== "continue") return;
          act.alertDecision = null;
          act.pauseReason = null;
          act.pauseState = false;
          act.pauseStartedAt = null;
          act.status = "em_execucao";
          act.lastTickAt = simDate.toISOString();
          const plan = act.execPlan || buildExecutionPlan(act, normalizeAngle(window.IcGetPivotAngle?.(act.pivotId)));
          act.execPlan = plan;
          if (act.phase === "dry_move") {
            window.IcSetSimPivotDirection?.(act.pivotId, plan.dryDirection === "reverso" ? -1 : 1);
            window.IcSetSimPivotSpeed?.(act.pivotId, 100); // movimento a seco sempre 100%
            window.IcSetSimPivotStatus?.(act.pivotId, PIVOT_STATUS_SECO);
          } else if (act.phase === "wait_irrigation_window") {
            window.IcSetSimPivotSpeed?.(act.pivotId, null);
            window.IcSetSimPivotStatus?.(act.pivotId, PIVOT_STATUS_ENERGIZADO);
          } else {
            window.IcSetSimPivotDirection?.(act.pivotId, plan.irrigationDirection === "reverso" ? -1 : 1);
            window.IcSetSimPivotSpeed?.(act.pivotId, asNum(act.speedPct, 100));
            window.IcSetSimPivotStatus?.(act.pivotId, act.irrigationMode === "molhado" ? PIVOT_STATUS_IRRIGANDO : PIVOT_STATUS_SECO);
          }
          changed = true;
          return;
        }
        if (!isInPeak(simDate, peakCfg)) {
          act.pauseStartedAt = null;
          act.pauseReason = null;
          act.status = "em_execucao";
          act.lastTickAt = simDate.toISOString();
          const plan = act.execPlan || buildExecutionPlan(act, normalizeAngle(window.IcGetPivotAngle?.(act.pivotId)));
          act.execPlan = plan;
          if (act.phase === "dry_move") {
            window.IcSetSimPivotDirection?.(act.pivotId, plan.dryDirection === "reverso" ? -1 : 1);
            window.IcSetSimPivotSpeed?.(act.pivotId, 100); // movimento a seco sempre 100%
            window.IcSetSimPivotStatus?.(act.pivotId, PIVOT_STATUS_SECO);
          } else if (act.phase === "wait_irrigation_window") {
            window.IcSetSimPivotSpeed?.(act.pivotId, null);
            window.IcSetSimPivotStatus?.(act.pivotId, PIVOT_STATUS_ENERGIZADO);
          } else {
            window.IcSetSimPivotDirection?.(act.pivotId, plan.irrigationDirection === "reverso" ? -1 : 1);
            window.IcSetSimPivotSpeed?.(act.pivotId, asNum(act.speedPct, 100));
            window.IcSetSimPivotStatus?.(act.pivotId, act.irrigationMode === "molhado" ? PIVOT_STATUS_IRRIGANDO : PIVOT_STATUS_SECO);
          }
          changed = true;
        }
      }
    });

    if (changed) saveActivities(list);
  };

  const IcAlertOpsContinue = (pivotId) => {
    const pid = String(pivotId || "");
    if (!pid) return;
    const list = loadActivities();
    let changed = false;
    let resumedRef = null;
    list.forEach((act) => {
      if (!act) return;
      if (String(act.pivotId || "") !== pid) return;
      if (String(act.status || "") !== "pausada") return;
      if (String(act.pauseReason || "") !== "alert") return;
      act.alertDecision = "continue";
      if (!resumedRef) resumedRef = act;
      changed = true;
    });
    if (changed) {
      // Remove o alerta imediatamente no mapa e retoma o estado operacional anterior.
      const phase = String(resumedRef?.phase || "");
      const mode = String(resumedRef?.irrigationMode || "molhado");
      const speed = asNum(resumedRef?.speedPct, 100);
      const plan = resumedRef?.execPlan || {};
      if (phase === "dry_move") {
        window.IcSetSimPivotDirection?.(pid, plan?.dryDirection === "reverso" ? -1 : 1);
        window.IcSetSimPivotSpeed?.(pid, 100);
        window.IcSetSimPivotStatus?.(pid, PIVOT_STATUS_SECO);
      } else if (phase === "wait_irrigation_window") {
        window.IcSetSimPivotSpeed?.(pid, null);
        window.IcSetSimPivotStatus?.(pid, PIVOT_STATUS_ENERGIZADO);
      } else {
        window.IcSetSimPivotDirection?.(pid, plan?.irrigationDirection === "reverso" ? -1 : 1);
        window.IcSetSimPivotSpeed?.(pid, speed);
        window.IcSetSimPivotStatus?.(pid, mode === "molhado" ? PIVOT_STATUS_IRRIGANDO : PIVOT_STATUS_SECO);
      }
      saveActivities(list);
    } else {
      // Fallback: se não houver atividade pausada por alerta, apenas limpa estado de alerta visual.
      window.IcSetSimPivotSpeed?.(pid, null);
      window.IcSetSimPivotStatus?.(pid, PIVOT_STATUS_ENERGIZADO);
    }
  };
  window.IcOpRouter.registerGlobal("IcAlertOpsContinue", "dev", IcAlertOpsContinue);

  const IcAlertOpsReprogram = (pivotId) => {
    const pid = String(pivotId || "");
    if (!pid) return;
    const list = loadActivities();
    const queue = list.slice();
    let changed = false;
    list.forEach((act) => {
      if (!act) return;
      if (String(act.pivotId || "") !== pid) return;
      if (String(act.status || "") !== "pausada") return;
      if (String(act.pauseReason || "") !== "alert") return;
      const candidateStart = getMinStartNow();
      act.status = "programada";
      act.pauseState = false;
      act.pauseReason = null;
      act.alertDecision = null;
      act.pauseStartedAt = null;
      act.startedAt = null;
      act.finishedAt = null;
      act.lastTickAt = null;
      act.runMs = 0;
      act.irrigatedDeg = 0;
      act.phase = null;
      act.execPlan = null;
      act.startAngle = normalizeAngle(window.IcGetPivotAngle?.(act.pivotId) ?? act.startAngle);
      const win = calculateActivityWindowFromStart(act, candidateStart, queue);
      if (win?.start && win?.end) {
        act.startAt = win.start.toISOString();
        act.plannedEndAt = win.end.toISOString();
        act.irrigationStartAt = String(act.startMode || "") === "pos_pico" ? act.startAt : null;
      } else {
        act.startAt = candidateStart.toISOString();
      }
      changed = true;
    });
    if (changed) saveActivities(list);
  };
  window.IcOpRouter.registerGlobal("IcAlertOpsReprogram", "dev", IcAlertOpsReprogram);

  const IcAlertOpsCancel = (pivotId) => {
    const pid = String(pivotId || "");
    if (!pid) return;
    const list = loadActivities();
    const nowIso = getMinStartNow().toISOString();
    let changed = false;
    list.forEach((act) => {
      if (!act) return;
      if (String(act.pivotId || "") !== pid) return;
      if (String(act.status || "") !== "em_execucao" && String(act.status || "") !== "pausada") return;
      act.status = "concluida";
      act.finishedAt = nowIso;
      act.pauseState = false;
      act.pauseReason = null;
      act.alertDecision = null;
      act.pauseStartedAt = null;
      act.lastTickAt = nowIso;
      changed = true;
    });
    if (changed) saveActivities(list);
    window.IcSetSimPivotSpeed?.(pid, null);
    window.IcSetSimPivotStatus?.(pid, PIVOT_STATUS_ENERGIZADO);
  };
  window.IcOpRouter.registerGlobal("IcAlertOpsCancel", "dev", IcAlertOpsCancel);

  const resetRunningActivitiesOnSimStop = () => {
    const list = loadActivities();
    let changed = false;
    list.forEach((act) => {
      if (!act || act.status === "concluida") return;
      if (act.status === "em_execucao" || act.status === "pausada") {
        act.status = "programada";
        act.startedAt = null;
        act.lastTickAt = null;
        act.lastAngle = null;
        act.runMs = 0;
        act.irrigatedDeg = 0;
        act.irrigationTargetDeg = null;
        act.pauseState = false;
        act.pauseStartedAt = null;
        act.pauseReason = null;
        act.alertDecision = null;
        act.phase = null;
        act.execPlan = null;
        window.IcSetSimPivotSpeed?.(act.pivotId, null);
        changed = true;
      }
    });
    if (changed) saveActivities(list);
  };

  const OpModal = window.IcOpRouter.getOpModalRegistrant("dev");

  function openBulkScheduleModalV2() {
    const pivots = getFarmPivots();
    if (!pivots.length) {
      window.IcNotify?.warn?.("Nenhum pivo disponivel para programacao.", 1800);
      return;
    }

    const id = "opBulkScheduleModalV2__dev";
    document.getElementById(id)?.remove();
    const now = getSimulationNow();
    const toIsoDay = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const addDays = (iso, n) => {
      const d = new Date(`${iso}T00:00:00`);
      d.setDate(d.getDate() + n);
      return toIsoDay(d);
    };
    const dayLabel = (iso) => {
      const d = new Date(`${iso}T00:00:00`);
      if (Number.isNaN(d.getTime())) return iso;
      return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
    };
    const timelineStartAnchorTs = now.getTime();
    const visibleDays = 8;
    const extendChunkDays = 14;
    let dayWidthPx = 150;
    let zoomTickH = 6;
    const ZOOM_STEPS = [6, 3, 2, 1];
    const leftColWidthPx = 60;
    const dialogHorizontalChromePx = 24;
    let loadedDays = visibleDays;
    const getDays = () => getDaysCoveringWindow(timelineStartAnchorTs, timelineStartAnchorTs + (loadedDays * DAY_MS));
    const getDaysCoveringWindow = (startTs, endTs) => {
      const out = [];
      const a = new Date(startTs);
      const b = new Date(endTs);
      if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || endTs <= startTs) return out;
      a.setHours(0, 0, 0, 0);
      b.setHours(0, 0, 0, 0);
      const cur = new Date(a);
      while (cur <= b) {
        out.push(toIsoDay(cur));
        cur.setDate(cur.getDate() + 1);
      }
      return out;
    };
    const keyOf = (pivotId, dayIso) => `${pivotId}__${dayIso}`;
    const draft = {};
    const deletedActivityIds = new Set();
    const isLinearPivotId = (pivotId) => isLineStarEquipment(getPivotEquipById(pivotId));
    const parseTimeParts = (raw) => {
      const match = /^(\d{1,2}):(\d{2})$/.exec(String(raw || "").trim());
      if (!match) return null;
      return {
        hours: Math.max(0, Math.min(23, asNum(match[1], 0))),
        minutes: Math.max(0, Math.min(59, asNum(match[2], 0)))
      };
    };
    const normalizeLinearUiMode = (cfg) => {
      const raw = String(cfg?.linearUiStopMode || cfg?.stopMode || "").trim().toLowerCase();
      if (raw === "por_posicao") return "por_posicao";
      if (raw === "por_passagens") return "por_passagens";
      return "sem_parar";
    };
    const resolveLinearStartPosition = (pivotId, fallback = 0) => {
      const runtime = window.IcPivotSimulationRuntime?.states?.[String(pivotId || "")];
      const runtimeProgress = clampPercent(runtime?.progress);
      if (runtime && Number.isFinite(asNum(runtime?.progress, NaN))) return runtimeProgress;
      return clampPercent(fallback);
    };
    const resolveLinearEquivalentPasses = (pivotId, uiMode, uiValue, directionValue, fallbackStart = 0) => {
      const startPct = resolveLinearStartPosition(pivotId, fallbackStart);
      const directionNorm = String(directionValue || "") === "reverso" ? "reverso" : "avanco";
      const distanceToBoundaryPct = directionNorm === "reverso"
        ? startPct
        : (100 - startPct);
      if (uiMode === "por_posicao") {
        const targetPct = clampPercent(uiValue);
        return {
          startPct,
          endPct: targetPct,
          equivalentPasses: Math.max(0.1, Math.abs(targetPct - startPct) / 100)
        };
      }
      if (uiMode === "por_passagens") {
        const passages = Math.max(0.1, asNum(uiValue, 1));
        const equivalentPasses = Math.max(0.1, (distanceToBoundaryPct / 100) + Math.max(0, passages - 1));
        const reachesForwardBoundary = directionNorm === "avanco";
        const fullTrips = Math.max(0, Math.ceil(passages - 1));
        const parityEndsForward = fullTrips % 2 === 0;
        const endPct = reachesForwardBoundary
          ? (parityEndsForward ? 100 : 0)
          : (parityEndsForward ? 0 : 100);
        return {
          startPct,
          endPct,
          equivalentPasses,
          passages
        };
      }
      return {
        startPct,
        endPct: directionNorm === "reverso" ? 0 : 100,
        equivalentPasses: Math.max(0.1, distanceToBoundaryPct / 100)
      };
    };
    const resolveModalStartDate = (pivotId, dayIso, cfg, modeOverride = null) => {
      const peakCfg = getPeakConfigByPivotId(pivotId);
      const mode = String(modeOverride || cfg?.startMode || "agendado");
      const safeTime = parseTimeParts(cfg?.time) || { hours: 6, minutes: 0 };
      const baseDate = new Date(`${dayIso}T00:00:00`);
      if (Number.isNaN(baseDate.getTime())) return getMinStartNow();
      baseDate.setHours(safeTime.hours, safeTime.minutes, 0, 0);
      if (mode === "agora") return getMinStartNow();
      if (mode === "pos_pico") return nextPeakEndSameDay(baseDate, peakCfg);
      return baseDate;
    };
    const buildBulkDraftConfig = (pivotId, baseCfg, formState) => {
      const cfg = { ...(baseCfg || {}) };
      const isLinear = isLinearPivotId(pivotId);
      const directionValue = String(formState?.direction || cfg.direction || "avanco") === "reverso" ? "reverso" : "avanco";
      const irrigationValue = String(formState?.irrigationMode || cfg.irrigationMode || "molhado") === "seco" ? "seco" : "molhado";
      const nextCfg = {
        ...cfg,
        enabled: true,
        startMode: String(formState?.startMode || cfg.startMode || "agendado"),
        time: String(cfg.time || "06:00"),
        direction: directionValue,
        irrigationMode: irrigationValue,
        speedPct: Math.max(1, asNum(formState?.speedPct, cfg.speedPct || 100)),
        laminaMm: Math.max(0, asNum(formState?.laminaMm, cfg.laminaMm || 0)),
        peakPolicy: String(cfg.peakPolicy || "pausar"),
        ferti: !!formState?.ferti,
        isLinear,
        parcelId: "",
        angleStart: 0,
        angleEnd: 0
      };

      if (isLinear) {
        const uiMode = normalizeLinearUiMode({ linearUiStopMode: formState?.stopMode });
        const linear = resolveLinearEquivalentPasses(
          pivotId,
          uiMode,
          formState?.stopValue,
          directionValue,
          cfg.linearPositionStart
        );
        nextCfg.stopMode = "volta_completa";
        nextCfg.stopValue = Number(linear.equivalentPasses.toFixed(3));
        nextCfg.linearUiStopMode = uiMode;
        nextCfg.linearUiStopValue = uiMode === "por_passagens"
          ? Math.max(0.1, asNum(linear.passages, formState?.stopValue || 1))
          : clampPercent(formState?.stopValue);
        nextCfg.linearPositionStart = clampPercent(linear.startPct);
        nextCfg.linearPositionEnd = clampPercent(linear.endPct);
        return nextCfg;
      }

      const uiStopMode = String(formState?.stopMode || "sem_parar");
      nextCfg.uiStopMode = uiStopMode;
      if (uiStopMode === "por_angulo") {
        nextCfg.stopMode = "por_angulos";
        nextCfg.stopValue = 0;
        nextCfg.angleStart = normalizeAngle(cfg.angleStart ?? asNum(window.IcGetPivotAngle?.(pivotId), 0)) ?? 0;
        nextCfg.angleEnd = normalizeAngle(formState?.stopValue) ?? 0;
        return nextCfg;
      }
      nextCfg.stopMode = "volta_completa";
      nextCfg.stopValue = uiStopMode === "por_voltas"
        ? Math.max(0.1, asNum(formState?.stopValue, cfg.stopValue || 1))
        : 1;
      nextCfg.angleStart = 0;
      nextCfg.angleEnd = 0;
      return nextCfg;
    };
    const buildPreviewActivityFromConfig = (pivotId, cfg) => {
      const parcelData = cfg.stopMode === "por_parcela"
        ? getPivotParcelas(pivotId).find((pp) => String(pp.id) === String(cfg.parcelId || ""))
        : null;
      return {
        pivotId,
        startMode: cfg.startMode,
        direction: cfg.direction,
        irrigationMode: cfg.irrigationMode,
        ferti: !!cfg.ferti,
        speedPct: Number(asNum(cfg.speedPct, 100).toFixed(2)),
        laminaMm: Number(asNum(cfg.laminaMm, 0).toFixed(2)),
        stopMode: cfg.stopMode,
        stopValue: cfg.stopMode === "volta_completa" ? Number(Math.max(0.1, asNum(cfg.stopValue, 1)).toFixed(3)) : 0,
        parcelId: parcelData?.id || null,
        parcelName: parcelData?.name || null,
        angleStart: cfg.stopMode === "por_angulos" ? normalizeAngle(cfg.angleStart) : null,
        angleEnd: cfg.stopMode === "por_angulos" ? normalizeAngle(cfg.angleEnd) : null,
        peakPolicy: cfg.peakPolicy || "pausar"
      };
    };
    const resolvePreviewWindowFromConfig = (pivotId, dayIso, cfg, queueList = []) => {
      const requestedStart = resolveModalStartDate(pivotId, dayIso, cfg, cfg.startMode);
      const activityBase = buildPreviewActivityFromConfig(pivotId, cfg);
      return calculateActivityWindowFromStart(activityBase, requestedStart, queueList);
    };
    const formatDurationText = (durationMs) => {
      const totalMinutes = Math.max(0, Math.round(asNum(durationMs, 0) / 60000));
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `Duracao estimada da operacao: ${hours} h ${minutes} min`;
    };
    const buildBulkEstimate = (pivotId, dayIso, cfg, queueList = []) => {
      const preview = resolvePreviewWindowFromConfig(pivotId, dayIso, cfg, queueList);
      if (!preview?.start || !preview?.end) {
        return {
          durationText: "Duracao estimada da operacao: --",
          endText: "Horario estimado para termino: --"
        };
      }
      return {
        durationText: formatDurationText(preview.end.getTime() - preview.start.getTime()),
        endText: `Horario estimado para termino: ${toPtDateTimeValue(preview.end)}`
      };
    };

    loadActivities()
      .filter((a) => a && a.status !== "concluida")
      .forEach((a) => {
        const pid = String(a?.pivotId || "");
        if (!pid) return;
        const dt = new Date(a?.startAt || 0);
        if (Number.isNaN(dt.getTime())) return;
        const dayIso = toIsoDay(dt);
        const key = keyOf(pid, dayIso);
        if (draft[key]) return;
        draft[key] = {
          activityId: String(a?.id || ""),
          enabled: true,
          startMode: String(a?.startMode || "agendado"),
          time: `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`,
          direction: String(a?.direction || "avanco"),
          irrigationMode: String(a?.irrigationMode || "molhado"),
          stopMode: String(a?.stopMode || "volta_completa"),
          stopValue: asNum(a?.stopValue, 1),
          parcelId: String(a?.parcelId || ""),
          angleStart: asNum(a?.angleStart, 0),
          angleEnd: asNum(a?.angleEnd, 0),
          speedPct: asNum(a?.speedPct, 100),
          laminaMm: asNum(a?.laminaMm, 0),
          peakPolicy: String(a?.peakPolicy || "pausar"),
          ferti: !!a?.ferti,
          isLinear: !!a?.isLinear || isLinearPivotId(pid),
          uiStopMode: String(a?.uiStopMode || ""),
          linearUiStopMode: String(a?.linearUiStopMode || ""),
          linearUiStopValue: asNum(a?.linearUiStopValue, 0),
          linearPositionStart: asNum(a?.linearPositionStart, 0),
          linearPositionEnd: asNum(a?.linearPositionEnd, 0)
        };
      });

    const defaultCell = (pivotId) => {
      const linear = isLinearPivotId(pivotId);
      return {
        activityId: "",
        enabled: false,
        startMode: "agendado",
        time: "06:00",
        direction: "avanco",
        irrigationMode: "molhado",
        stopMode: "volta_completa",
        stopValue: 1,
        parcelId: String(getPivotParcelas(pivotId)[0]?.id || ""),
        angleStart: 0,
        angleEnd: 0,
        speedPct: 100,
        laminaMm: Number(calcPivotPhysics(getPivotEquipById(pivotId), 100).laminaMm.toFixed(2)),
        peakPolicy: "pausar",
        ferti: false,
        isLinear: linear,
        uiStopMode: linear ? "" : "por_voltas",
        linearUiStopMode: linear ? "por_passagens" : "",
        linearUiStopValue: linear ? 1 : 0,
        linearPositionStart: linear ? resolveLinearStartPosition(pivotId, 0) : 0,
        linearPositionEnd: linear ? 100 : 0
      };
    };

    const html = `
      <div class="op-bulk-modal" id="${id}">
        <div class="op-bulk-modal__backdrop"></div>
        <div class="op-bulk-modal__dialog op-bulk-modal__dialog--grid">
          <header class="op-bulk-modal__head">
            <h3>Programações</h3>
            <button type="button" class="op-bulk-modal__close js-bulk-cancel" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>
          </header>
          <div class="op-bulk-weekly-wrap">
            <div class="op-bulk-weekly" id="opBulkWeekly"></div>
          </div>
          <footer class="op-bulk-modal__foot">
            <button type="button" class="btn btn--cancel js-bulk-cancel">Cancelar</button>
            <button type="button" class="btn btn--ok js-bulk-save">Salvar programacoes</button>
          </footer>
        </div>
      </div>
    `;
    getModalHost().insertAdjacentHTML("beforeend", html);
    const modal = document.getElementById(id);
    if (!modal) return;
    const dialogEl = modal.querySelector(".op-bulk-modal__dialog--grid");
    if (dialogEl) {
      const targetWidthPx = (visibleDays * dayWidthPx) + leftColWidthPx + dialogHorizontalChromePx;
      dialogEl.style.width = `min(${targetWidthPx}px, 98vw)`;
      dialogEl.style.maxWidth = "98vw";
    }

    const close = () => modal.remove();
    const weekly = modal.querySelector("#opBulkWeekly");
    if (weekly) {
      weekly.innerHTML = `
        <div class="op-bulk-timeline" style="width:100%;">
          <div class="op-timeline__body is-gantt">
            <div class="op-timeline__empty-main">Carregando timeline...</div>
          </div>
        </div>
      `;
    }
    const parseTime = (raw) => /^(\d{1,2}):(\d{2})$/.test(String(raw || "").trim());
    const coverageLabel = (cfg, pivotId) => {
      if (cfg?.isLinear) {
        const uiMode = normalizeLinearUiMode(cfg);
        if (uiMode === "por_posicao") return `Pos. ${clampPercent(cfg.linearPositionEnd).toFixed(0)}%`;
        if (uiMode === "por_passagens") return `${Math.max(0.1, asNum(cfg.linearUiStopValue || cfg.stopValue, 1)).toFixed(1)} pass.`;
        return String(cfg.direction || "") === "reverso" ? "Ate 0%" : "Ate 100%";
      }
      if (cfg?.uiStopMode === "sem_parar") return "Sem parar";
      if (cfg.stopMode === "por_parcela") {
        return getPivotParcelas(pivotId).find((p) => String(p.id) === String(cfg.parcelId))?.name || "Parcela";
      }
      if (cfg.stopMode === "por_angulos") return `${asNum(cfg.angleStart, 0).toFixed(1)}-${asNum(cfg.angleEnd, 0).toFixed(1)}`;
      return "Total";
    };
    const summary = (cfg, pivotId) =>
      `${asNum(cfg.speedPct, 100).toFixed(0)}% - ${asNum(cfg.laminaMm, 0).toFixed(2)} mm - ${coverageLabel(cfg, pivotId)}`;
    const weekLabel = (daysArr) => {
      const start = daysArr[0];
      const end = daysArr[daysArr.length - 1];
      if (!start || !end) return "--";
      return `${dayLabel(start)} - ${dayLabel(end)}`;
    };

    const floorTo6h = (ts) => {
      const d = new Date(ts);
      d.setMinutes(0, 0, 0);
      d.setHours(Math.floor(d.getHours() / 6) * 6);
      return d.getTime();
    };
    const roundTo5Min = (ts) => Math.round(ts / (5 * 60 * 1000)) * (5 * 60 * 1000);
    const escAttr = (txt) =>
      String(txt ?? "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const fmtDayTime = (ts) => {
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) return "--/-- --:--";
      return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    };
    const getDraftSegments = (pivotId, daysArr) => {
      return daysArr
        .map((dIso) => {
          const key = keyOf(pivotId, dIso);
          const cfg = draft[key];
          if (!cfg?.enabled) return null;
          const safeTime = /^(\d{1,2}):(\d{2})$/.test(String(cfg.time || "")) ? String(cfg.time) : "06:00";
          const startAt = new Date(`${dIso}T${safeTime}`);
          if (Number.isNaN(startAt.getTime())) return null;
          const parcelData = cfg.stopMode === "por_parcela"
            ? getPivotParcelas(pivotId).find((pp) => String(pp.id) === String(cfg.parcelId || ""))
            : null;
          const baseActivity = {
            pivotId,
            startMode: cfg.startMode,
            direction: cfg.direction,
            irrigationMode: cfg.irrigationMode,
            ferti: !!cfg.ferti,
            speedPct: Number(asNum(cfg.speedPct, 100).toFixed(2)),
            laminaMm: Number(asNum(cfg.laminaMm, 0).toFixed(2)),
            stopMode: cfg.stopMode,
            stopValue: cfg.stopMode === "volta_completa" ? Number(Math.max(0.1, asNum(cfg.stopValue, 1)).toFixed(2)) : 0,
            parcelId: parcelData?.id || null,
            parcelName: parcelData?.name || null,
            angleStart: cfg.stopMode === "por_angulos" ? normalizeAngle(cfg.angleStart) : null,
            angleEnd: cfg.stopMode === "por_angulos" ? normalizeAngle(cfg.angleEnd) : null,
            peakPolicy: cfg.peakPolicy || "pausar"
          };
          const win = calculateActivityWindowFromStart(baseActivity, startAt, []);
          const startMs = win?.start?.getTime?.() || startAt.getTime();
          const endMs = win?.end?.getTime?.() || (startMs + 60 * 60 * 1000);
          return {
            key,
            pivotId,
            dayIso: dIso,
            cfg,
            startMs,
            endMs
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.startMs - b.startMs);
    };
    const buildWeeklyHpBandsHtml = (pivotId, rangeStartTs, rangeEndTs, spanMs) => {
      const bands = listPeakWindowsByPivotInRange(pivotId, rangeStartTs, rangeEndTs);
      return bands.map((b) => {
        const left = Math.max(0, ((b.startTs - rangeStartTs) / spanMs) * 100);
        const width = Math.max(0.4, ((b.endTs - b.startTs) / spanMs) * 100);
        return `<span class="op-timeline__hp-band op-bulk-timeline__hp-band" style="left:${left.toFixed(3)}%;width:${width.toFixed(3)}%;"></span>`;
      }).join("");
    };

    const renderGrid = (opts = {}) => {
      if (!weekly) return;
      const measuredW = weekly.clientWidth;
      if (measuredW > 0) dayWidthPx = Math.max(80, (measuredW - leftColWidthPx) / zoomTickH);
      const days = getDays();
      // Início sempre em "agora" (âncora ao abrir o modal), meia-noite no
      // fuso horário da fazenda (não o fuso do navegador).
      const rangeStart = farmMidnightTs(timelineStartAnchorTs);
      const rangeEnd = rangeStart + (loadedDays * DAY_MS);
      const span = Math.max(1, rangeEnd - rangeStart);
      const axisDays = getDaysCoveringWindow(rangeStart, rangeEnd);
      const TICK_MS = zoomTickH * 60 * 60 * 1000;
      const hourTicks = [];
      let hourTs = Math.floor(rangeStart / TICK_MS) * TICK_MS;
      if (hourTs <= rangeStart) hourTs += TICK_MS;
      while (hourTs <= rangeEnd) {
        hourTicks.push(hourTs);
        hourTs += TICK_MS;
      }
      const dayTicks = axisDays.map((dIso) => new Date(`${dIso}T00:00:00`).getTime());
      const dayGridTicks = dayTicks.filter((ts) => ts > rangeStart && ts <= rangeEnd);
      const gridHourTicksHtml = hourTicks.map((ts) => {
        const left = Math.max(0, Math.min(100, ((ts - rangeStart) / span) * 100));
        const isMidnight = farmDateParts(ts).hours === 0;
        return `<span class="op-timeline__grid-line op-timeline__grid-line--hour ${isMidnight ? "is-midnight" : ""}" style="left:${left.toFixed(3)}%;"></span>`;
      }).join("");
      const gridDayTicksHtml = dayGridTicks.map((ts) => {
        const left = Math.max(0, Math.min(100, ((ts - rangeStart) / span) * 100));
        return `<span class="op-timeline__grid-line op-timeline__grid-line--day" style="left:${left.toFixed(3)}%;"></span>`;
      }).join("");
      const axisHourTicksHtml = hourTicks.map((ts) => {
        const left = Math.max(0, Math.min(100, ((ts - rangeStart) / span) * 100));
        const fp = farmDateParts(ts);
        const hh = `${pad2(fp.hours)}:${pad2(fp.minutes)}`;
        const isMidnight = fp.hours === 0;
        return `<span class="op-timeline__tick op-timeline__tick--hour ${isMidnight ? "is-midnight" : ""}" style="left:${left.toFixed(3)}%;"><span class="op-timeline__tick-label op-timeline__tick-label--hour ${isMidnight ? "is-midnight" : ""}">${hh}</span></span>`;
      }).join("");
      const axisDayLabelTicks = Array.from({ length: loadedDays }, (_, idx) => {
        const chunkStartTs = rangeStart + (idx * DAY_MS);
        return { chunkStartTs };
      });
      const axisDayTicksHtml = axisDayLabelTicks.map(({ chunkStartTs }, idx) => {
        const fp = farmDateParts(chunkStartTs);
        const noonTs = chunkStartTs + (12 * 60 * 60 * 1000);
        if (noonTs > rangeEnd) return "";
        const left = Math.max(0, ((noonTs - rangeStart) / span) * 100);
        const label = `${pad2(fp.day)}/${pad2(fp.month)}`;
        const edgeClass = idx === (axisDayLabelTicks.length - 1) ? " is-edge-end" : "";
        return `<span class="op-timeline__tick op-timeline__tick--day${edgeClass}" style="left:${left.toFixed(3)}%;"><span class="op-timeline__tick-label op-timeline__tick-label--day">${label}</span></span>`;
      }).join("");

      // Sem marcador visual de "agora" (linha vermelha e texto).
      const nowLineHtml = "";
      const nowAxisHtml = "";

      const uniq = new Map();
      pivots.forEach((p) => {
        const pid = String(p?.id || "").trim();
        const pname = String(p?.name || "").trim();
        if (!pid || !pname || /^pivo$/i.test(pname)) return;
        if (!uniq.has(pid)) uniq.set(pid, { id: pid, name: pname });
      });
      const sortedPivots = Array.from(uniq.values())
        .sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR", { numeric: true }));
      if (dialogEl) {
        const rowHeightPx = 28;
        const rowDividerPx = 1;
        const axisHeightPx = 34;
        const maxVisibleRows = 15;
        const visibleRows = Math.max(1, Math.min(maxVisibleRows, sortedPivots.length));
        const visibleHeightPx = axisHeightPx + (visibleRows * (rowHeightPx + rowDividerPx));
        dialogEl.style.setProperty("--bulk-visible-h", `${visibleHeightPx}px`);
      }

      const namesHtml = sortedPivots
        .map((p) => {
          const equip = getPivotEquipById(p.id);
          const resolved = equip && typeof window.IcResolvePivotStatus === "function" ? window.IcResolvePivotStatus(equip) : null;
          const isReady = resolved?.key === "preparando_irrigar";
          const dot = isReady ? `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#3c8452;margin-right:5px;flex-shrink:0;"></span>` : "";
          const style = isReady ? ` style="color:#3c8452;font-weight:600;"` : "";
          return `<div class="op-bulk-timeline__name-row"${style}>${dot}${p.name}</div>`;
        })
        .join("");

      // Expande cada rascunho em sub-segmentos: mov.seco, irrigação, pausa HP
      const expandDraftSegments = (pivotId, daysArr) => {
        const result = [];
        daysArr.forEach((dIso) => {
          const key = keyOf(pivotId, dIso);
          const cfg = draft[key];
          if (!cfg?.enabled) return;
          const safeTime = /^(\d{1,2}):(\d{2})$/.test(String(cfg.time || "")) ? String(cfg.time) : "06:00";
          const startAt = new Date(`${dIso}T${safeTime}`);
          if (Number.isNaN(startAt.getTime())) return;
          const parcelData = cfg.stopMode === "por_parcela"
            ? getPivotParcelas(pivotId).find((pp) => String(pp.id) === String(cfg.parcelId || ""))
            : null;
          const baseAct = {
            pivotId,
            startAt,
            startMode: cfg.startMode || "agendado",
            direction: cfg.direction,
            irrigationMode: cfg.irrigationMode,
            ferti: !!cfg.ferti,
            speedPct: Number(asNum(cfg.speedPct, 100).toFixed(2)),
            laminaMm: Number(asNum(cfg.laminaMm, 0).toFixed(2)),
            stopMode: cfg.stopMode,
            stopValue: cfg.stopMode === "volta_completa" ? Number(Math.max(0.1, asNum(cfg.stopValue, 1)).toFixed(2)) : 0,
            parcelId: parcelData?.id || null,
            parcelName: parcelData?.name || null,
            angleStart: cfg.stopMode === "por_angulos" ? normalizeAngle(cfg.angleStart) : null,
            angleEnd: cfg.stopMode === "por_angulos" ? normalizeAngle(cfg.angleEnd) : null,
            peakPolicy: cfg.peakPolicy || "pausar"
          };
          const sourceActivityId = String(cfg.activityId || "");
          // Mov. seco via estimateDryMoveMs (IIFE-level)
          // O tempo marcado pelo usuário = início da irrigação, não do movimento a seco.
          // Se houver mov. seco, ele acontece ANTES do tempo marcado.
          const startAngleBase = normalizeAngle(typeof window.IcGetPivotAngle === "function" ? window.IcGetPivotAngle(pivotId) : 0);
          const dryMs = estimateDryMoveMs(baseAct, startAngleBase) || 0;
          const isScheduled = String(cfg.startMode || "agendado") === "agendado";
          // Para modo agendado: desloca o início da atividade para antes do tempo marcado
          const requestedStart = (isScheduled && dryMs > 0) ? new Date(startAt.getTime() - dryMs) : startAt;
          const win = calculateActivityWindowFromStart(baseAct, requestedStart, []);
          const totalStartMs = win?.start?.getTime?.() || requestedStart.getTime();
          const totalEndMs = win?.end?.getTime?.() || (startAt.getTime() + 60 * 60 * 1000);
          const irrigStartMs = totalStartMs + dryMs;
          if (dryMs > 0) {
            result.push({ key, pivotId, dayIso: dIso, cfg, activityId: sourceActivityId, segmentType: "dry", segmentLabel: "Mov. Seco", startMs: totalStartMs, endMs: irrigStartMs });
          }

          // Irrigação intercalada com pausas HP via listPeakWindowsByPivotInRange (IIFE-level)
          const irrigLabel = String(cfg.irrigationMode || "") === "seco" ? "Seco" : "Irrigação";
          const opEndTs = totalEndMs;
          if (cfg.peakPolicy === "pausar") {
            const peaks = (listPeakWindowsByPivotInRange(pivotId, irrigStartMs, opEndTs) || [])
              .map((pk) => ({ startTs: pk?.startTs || pk?.start?.getTime?.() || 0, endTs: pk?.endTs || pk?.end?.getTime?.() || 0 }))
              .filter((pk) => pk.endTs > pk.startTs)
              .sort((a, b) => a.startTs - b.startTs);
            let cursor = irrigStartMs;
            peaks.forEach((pk) => {
              const ps = Math.max(cursor, pk.startTs);
              const pe = Math.min(opEndTs, pk.endTs);
              if (ps > cursor) result.push({ key, pivotId, dayIso: dIso, cfg, activityId: sourceActivityId, segmentType: "irrigation", segmentLabel: irrigLabel, startMs: cursor, endMs: ps });
              if (pe > ps)     result.push({ key, pivotId, dayIso: dIso, cfg, activityId: sourceActivityId, segmentType: "pause_hp",   segmentLabel: "PAUSA HP",   startMs: ps,     endMs: pe });
              cursor = Math.max(cursor, pe);
            });
            if (opEndTs > cursor) result.push({ key, pivotId, dayIso: dIso, cfg, activityId: sourceActivityId, segmentType: "irrigation", segmentLabel: irrigLabel, startMs: cursor, endMs: opEndTs });
          } else {
            result.push({ key, pivotId, dayIso: dIso, cfg, activityId: sourceActivityId, segmentType: "irrigation", segmentLabel: irrigLabel, startMs: irrigStartMs, endMs: opEndTs });
          }
        });
        return result.sort((a, b) => a.startMs - b.startMs);
      };

      const bulkBarColor = (seg) => {
        if (seg.segmentType === "dry")      return "#78350f";
        if (seg.segmentType === "pause_hp") return "#14b8a6";
        if (String(seg.cfg?.irrigationMode || "") === "seco") return "#78350f";
        return "#2563eb";
      };

      const bulkBarTip = (seg) => {
        const period = `${fmtDayTime(seg.startMs)} -> ${fmtDayTime(seg.endMs)}`;
        if (seg.segmentType === "dry")      return `Mov. Seco\n${period}`;
        if (seg.segmentType === "pause_hp") return `Pausa HP\n${period}`;
        return `${summary(seg.cfg, seg.pivotId)}\n${period}`;
      };

      const tracksHtml = sortedPivots
        .map((p) => {
          const hpBands = buildWeeklyHpBandsHtml(p.id, rangeStart, rangeEnd, span);
          const bars = expandDraftSegments(p.id, days).map((seg) => {
            const left = Math.max(0, ((seg.startMs - rangeStart) / span) * 100);
            const width = Math.max(0.6, ((seg.endMs - seg.startMs) / span) * 100);
            const tip = escAttr(bulkBarTip(seg));
            const isMain = seg.segmentType === "irrigation";
            const dragAttrs = isMain
              ? ` data-bulk-key="${escAttr(seg.key)}" data-start-ms="${seg.startMs}" data-end-ms="${seg.endMs}"`
              : "";
            const activityAttr = seg.activityId ? ` data-activity-id="${escAttr(seg.activityId)}"` : "";
            return `<span class="op-timeline__bar op-bulk-timeline__bar" data-segment-type="${seg.segmentType}" data-pivot-id="${escAttr(p.id)}" data-day="${escAttr(seg.dayIso)}"${activityAttr}${dragAttrs} data-tip="${tip}" style="left:${left.toFixed(3)}%;width:${width.toFixed(3)}%;background:${bulkBarColor(seg)};">${seg.segmentLabel}</span>`;
          }).join("");
          return `
            <div class="op-bulk-timeline__track-row">
              <div class="op-timeline__track op-bulk-timeline__track" data-pivot-id="${escAttr(p.id)}" data-pivot-name="${escAttr(p.name)}">
                ${hpBands}
                ${bars || ""}
              </div>
            </div>
          `;
        }).join("");

      weekly.innerHTML = `
        <div class="op-bulk-timeline-split__scroller" id="opBulkTimelineScroller">
          <div class="op-bulk-timeline-split" data-pivot-count="${sortedPivots.length}" data-track-count="${sortedPivots.length}">
            <div class="op-bulk-timeline-split__left">
              <div class="op-bulk-timeline__left-head">Equipamento</div>
              <div class="op-bulk-timeline__left-rows">${namesHtml}</div>
            </div>
            <div class="op-bulk-timeline-split__right">
              <div class="op-bulk-timeline op-bulk-timeline--main" style="width:${Math.max(1, days.length * dayWidthPx)}px;">
                <div class="op-timeline__body is-gantt">
                  <div class="op-timeline__axis op-bulk-timeline__axis-top">
                    <div class="op-timeline__axis-track">
                      ${axisHourTicksHtml}
                      ${axisDayTicksHtml}
                      ${nowAxisHtml}
                    </div>
                  </div>
                  <div class="op-timeline__rows-wrap">
                    <div class="op-timeline__grid">${gridHourTicksHtml}${gridDayTicksHtml}${nowLineHtml}</div>
                    <div class="op-timeline__rows">${tracksHtml}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      const panelEl = weekly.querySelector(".op-bulk-timeline--main");
      if (!panelEl) return;
      const scrollerEl = weekly.querySelector("#opBulkTimelineScroller");
      let hoverTip = panelEl.querySelector(".op-timeline__hover-tip");
      if (!hoverTip) {
        hoverTip = document.createElement("div");
        hoverTip.className = "op-timeline__hover-tip is-hidden";
        panelEl.appendChild(hoverTip);
      }
      const clearHover = () => {
        panelEl.querySelectorAll(".op-timeline__bar.is-hovered").forEach((el) => el.classList.remove("is-hovered"));
      };
      const positionTip = (bar, evt = null) => {
        if (!hoverTip || hoverTip.classList.contains("is-hidden")) return;
        const panelRect = panelEl.getBoundingClientRect();
        const tipRect = hoverTip.getBoundingClientRect();
        const barRect = bar.getBoundingClientRect();
        const cursorX = evt ? (evt.clientX - panelRect.left) : (barRect.left - panelRect.left + (barRect.width / 2));
        const x = Math.min(Math.max(8, cursorX - (tipRect.width / 2)), Math.max(8, panelRect.width - tipRect.width - 8));
        let y = (barRect.top - panelRect.top) - tipRect.height - 8;
        // Evita ficar "atrás" do cabeçalho sticky da timeline bulk.
        const stickyHeaderBottom = 34 + 6;
        if (y < stickyHeaderBottom) {
          y = (barRect.bottom - panelRect.top) + 8;
        }
        y = Math.max(8, Math.min(y, Math.max(8, panelRect.height - tipRect.height - 8)));
        hoverTip.style.left = `${Math.round(x)}px`;
        hoverTip.style.top = `${Math.round(y)}px`;
      };

      let dragState = null;
      const applyDragPreview = (clientX) => {
        if (!dragState) return;
        const rect = dragState.trackRect;
        if (!rect || rect.width <= 0) return;
        const rawDeltaPct = ((clientX - dragState.startClientX) / rect.width) * 100;
        const minDelta = -dragState.baseLeftPct;
        const maxDelta = 100 - (dragState.baseLeftPct + dragState.widthPct);
        const deltaPct = Math.max(minDelta, Math.min(maxDelta, rawDeltaPct));
        dragState.deltaPct = deltaPct;
        const nextLeft = dragState.baseLeftPct + deltaPct;
        dragState.bar.style.left = `${nextLeft.toFixed(3)}%`;
      };
      const openBarEditorOrActivity = (bar, evt = null) => {
        if (!bar) return;
        if (evt) evt.stopPropagation();
        const pid = String(bar.getAttribute("data-pivot-id") || "");
        const dayIso = String(bar.getAttribute("data-day") || "");
        if (!pid || !dayIso) return;
        openEditor(pid, dayIso, bar);
      };
      const finalizeDrag = (commit, opts = {}) => {
        if (!dragState) return;
        const state = dragState;
        dragState = null;
        state.bar.classList.remove("is-dragging");
        window.removeEventListener("pointermove", state.onMove);
        window.removeEventListener("pointerup", state.onUp);
        window.removeEventListener("pointercancel", state.onCancel);
        if (!commit || Math.abs(asNum(state.deltaPct, 0)) < 0.1) {
          if (opts.rerender !== false) renderGrid();
          return;
        }
        const oldKey = String(state.key || "");
        const cfg = draft[oldKey];
        if (!cfg) {
          renderGrid();
          return;
        }
        const shiftedStart = roundTo5Min(state.startMs + ((asNum(state.deltaPct, 0) / 100) * span));
        const clampedStart = Math.max(rangeStart, Math.min(rangeEnd - (5 * 60 * 1000), shiftedStart));
        const d = new Date(clampedStart);
        const newDayIso = toIsoDay(d);
        if (!days.includes(newDayIso)) {
          renderGrid();
          return;
        }
        const newTime = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
        const newKey = keyOf(state.pivotId, newDayIso);
        delete draft[oldKey];
        draft[newKey] = {
          ...cfg,
          enabled: true,
          startMode: "agendado",
          time: newTime
        };
        renderGrid();
      };

      panelEl.querySelectorAll(".op-bulk-timeline__bar").forEach((bar) => {
        bar.addEventListener("mouseenter", (evt) => {
          if (dragState) return;
          clearHover();
          bar.classList.add("is-hovered");
          hoverTip.textContent = bar.getAttribute("data-tip") || "Atividade";
          hoverTip.classList.remove("is-hidden");
          positionTip(bar, evt);
        });
        bar.addEventListener("mousemove", (evt) => {
          if (dragState) return;
          positionTip(bar, evt);
        });
        bar.addEventListener("mouseleave", () => {
          if (dragState) return;
          hoverTip.classList.add("is-hidden");
          bar.classList.remove("is-hovered");
        });
        bar.addEventListener("pointerdown", (evt) => {
          if (evt.button !== 0) return;
          // Apenas barras de irrigação (com data-bulk-key) são arrastáveis
          if (!bar.getAttribute("data-bulk-key")) return;
          const styleLeft = asNum(String((bar.getAttribute("style") || "").match(/left:\s*([\d.]+)%/)?.[1]), 0);
          const styleWidth = asNum(String((bar.getAttribute("style") || "").match(/width:\s*([\d.]+)%/)?.[1]), 1.2);
          const trackRect = bar.closest(".op-timeline__track")?.getBoundingClientRect?.();
          if (!trackRect || trackRect.width <= 0) return;
          const onMove = (moveEvt) => applyDragPreview(moveEvt.clientX);
          const onUp = () => {
            const moved = Math.abs(asNum(dragState?.deltaPct, 0)) >= 0.1;
            if (!moved) {
              finalizeDrag(false, { rerender: false });
              openBarEditorOrActivity(bar);
              return;
            }
            finalizeDrag(true);
          };
          const onCancel = () => finalizeDrag(false);
          dragState = {
            bar,
            key: String(bar.getAttribute("data-bulk-key") || ""),
            pivotId: String(bar.getAttribute("data-pivot-id") || ""),
            startMs: asNum(bar.getAttribute("data-start-ms"), Date.now()),
            startClientX: evt.clientX,
            baseLeftPct: styleLeft,
            widthPct: styleWidth,
            deltaPct: 0,
            trackRect,
            onMove,
            onUp,
            onCancel
          };
          bar.classList.add("is-dragging");
          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp, { once: true });
          window.addEventListener("pointercancel", onCancel, { once: true });
          evt.preventDefault();
        });
        bar.addEventListener("click", (evt) => {
          if (dragState) return;
          openBarEditorOrActivity(bar, evt);
        });
      });

      panelEl.querySelectorAll(".op-bulk-timeline__track").forEach((track) => {
        track.addEventListener("click", (evt) => {
          if (evt.target.closest(".op-bulk-timeline__bar")) return;
          const pid = String(track.getAttribute("data-pivot-id") || "");
          if (!pid) return;
          const rect = track.getBoundingClientRect();
          const rel = rect.width > 0 ? Math.max(0, Math.min(1, (evt.clientX - rect.left) / rect.width)) : 0;
          const clickedTs = rangeStart + Math.round(span * rel);
          const d = new Date(roundTo5Min(clickedTs));
          const dayIso = toIsoDay(d);
          if (!days.includes(dayIso)) return;
          const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
          openEditor(pid, dayIso, track, { enabled: true, startMode: "agendado", time });
        });
      });

      panelEl.addEventListener("mouseleave", () => {
        hoverTip.classList.add("is-hidden");
        clearHover();
      });
      if (opts?.restoreScroll && scrollerEl) {
        scrollerEl.scrollLeft = asNum(opts.restoreLeft, scrollerEl.scrollLeft);
        scrollerEl.scrollTop = asNum(opts.restoreTop, scrollerEl.scrollTop);
      } else if (scrollerEl && !scrollerEl.dataset.scrolledToNow) {
        // Abre já rolado até a hora atual, com uma pequena folga à esquerda.
        // Roda num rAF (layout já assentado) para não pegar clientWidth=0
        // do primeiro paint, que travava o scroll numa posição errada.
        requestAnimationFrame(() => {
          if (scrollerEl.dataset.scrolledToNow) return;
          scrollerEl.dataset.scrolledToNow = "1";
          const measuredNow = weekly.clientWidth;
          const dayWidthNow = measuredNow > 0 ? Math.max(80, (measuredNow - leftColWidthPx) / zoomTickH) : dayWidthPx;
          const totalWidthPx = Math.max(1, days.length * dayWidthNow);
          const nowLeftPx = ((timelineStartAnchorTs - rangeStart) / span) * totalWidthPx;
          const leadInPx = dayWidthNow * 0.15;
          scrollerEl.scrollLeft = Math.max(0, nowLeftPx - leadInPx);
        });
      }
      requestAnimationFrame(() => {
        const sc = modal.querySelector("#opBulkTimelineScroller");
        if (!sc || sc.dataset.bound === "1") return;
        sc.dataset.bound = "1";
        const rightPaneEl = weekly.querySelector(".op-bulk-timeline-split__right");
        if (rightPaneEl) {
          rightPaneEl.addEventListener("wheel", (evt) => {
            // Garante que rolar sobre as linhas da timeline use o mesmo scroller único.
            if (evt.ctrlKey) { evt.preventDefault(); return; }
            const onlyHorizontal = !!evt.shiftKey;
            const horizontalDelta = onlyHorizontal ? evt.deltaY : evt.deltaX;
            if (horizontalDelta) sc.scrollLeft += horizontalDelta;
            if (!onlyHorizontal && evt.deltaY) sc.scrollTop += evt.deltaY;
            evt.preventDefault();
          }, { passive: false });
        }
        sc.addEventListener("scroll", () => {
          lastScrollAtMs = Date.now();
          if (extendRaf) return;
          extendRaf = requestAnimationFrame(() => {
            extendRaf = 0;
            maybeExtendTimeline();
          });
        }, { passive: true });
        sc.addEventListener("wheel", (evt) => {
          const horizontalIntent = Math.abs(evt.deltaX) > Math.abs(evt.deltaY) || evt.shiftKey;
          if (!horizontalIntent) return;
          const movingRight = (evt.deltaX > 0) || (evt.shiftKey && evt.deltaY > 0);
          if (!movingRight) return;
          const thresholdPx = 180;
          const nearRight = (sc.scrollLeft + sc.clientWidth) >= (sc.scrollWidth - thresholdPx);
          if (!nearRight) return;
          maybeExtendTimeline();
        }, { passive: true });
      });
    };

    const openEditor = (pivotId, dayIso, anchorBtn, prefill = null) => {
      const key = keyOf(pivotId, dayIso);
      const seedCfg = {
        ...(draft[key] || defaultCell(pivotId)),
        ...(prefill || {})
      };
      const equip = getPivotEquipById(pivotId);
      const isLinear = isLineStarEquipment(equip);
      const pivotName = pivots.find((p) => String(p.id) === String(pivotId))?.name || equip?.name || pivotId;
      const currentAngle = normalizeAngle(seedCfg.angleStart ?? window.IcGetPivotAngle?.(pivotId)) ?? 0;
      const currentPosition = resolveLinearStartPosition(pivotId, seedCfg.linearPositionStart);
      const initialStopMode = isLinear
        ? normalizeLinearUiMode(seedCfg)
        : (String(seedCfg.uiStopMode || "").trim() || (seedCfg.stopMode === "por_angulos" ? "por_angulo" : "por_voltas"));
      const initialStopValue = isLinear
        ? (initialStopMode === "por_posicao"
            ? clampPercent(seedCfg.linearPositionEnd)
            : Math.max(0.1, asNum(seedCfg.linearUiStopValue || seedCfg.stopValue, 1)))
        : (initialStopMode === "por_angulo"
            ? asNum(seedCfg.angleEnd, currentAngle)
            : Math.max(0.1, asNum(seedCfg.stopValue, 1)));

      window.OpModal?.open?.({
        title: pivotName,
        pivotId,
        isLinear,
        angle: currentAngle,
        position: currentPosition,
        isPeakHour: getPeakConfigByPivotId(pivotId).hasPeak,
        startMode: seedCfg.startMode || "agendado",
        startAt: resolveModalStartDate(pivotId, dayIso, seedCfg),
        stopMode: initialStopMode,
        stopValue: initialStopValue,
        direction: seedCfg.direction || "avanco",
        irrigationMode: seedCfg.irrigationMode || "molhado",
        speedPct: seedCfg.speedPct || 100,
        laminaMm: seedCfg.laminaMm || 0,
        ferti: !!seedCfg.ferti,
        showClear: true,
        resolveStartAt: (mode) => resolveModalStartDate(pivotId, dayIso, seedCfg, mode),
        resolveEstimate: (formState) => {
          const nextCfg = buildBulkDraftConfig(pivotId, seedCfg, formState);
          nextCfg.time = String(seedCfg.time || "06:00");
          return buildBulkEstimate(pivotId, dayIso, nextCfg, loadActivities());
        },
        onClear: () => {
          if (seedCfg.activityId) deletedActivityIds.add(String(seedCfg.activityId));
          delete draft[key];
          renderGrid();
        },
        onSave: (formState) => {
          const nextCfg = buildBulkDraftConfig(pivotId, seedCfg, formState);
          nextCfg.time = String(seedCfg.time || nextCfg.time || "06:00");
          if (seedCfg.activityId) {
            nextCfg.activityId = String(seedCfg.activityId);
            deletedActivityIds.delete(String(seedCfg.activityId));
          }
          draft[key] = nextCfg;
          renderGrid();
        }
      });
    };

    modal.querySelector(".op-bulk-modal__backdrop")?.addEventListener("click", close);
    modal.querySelector(".js-bulk-cancel")?.addEventListener("click", close);

    modal.querySelector(".js-bulk-save")?.addEventListener("click", () => {
      const list = loadActivities().filter((item) => !deletedActivityIds.has(String(item?.id || "")));
      const queue = list.slice();
      let created = 0;
      let updated = 0;
      let invalid = 0;

      // Coleta entradas válidas do rascunho
      const draftEntries = [];
      Object.entries(draft).forEach(([k, cfg]) => {
        if (!cfg?.enabled) return;
        const [pivotId, dIso] = String(k || "").split("__");
        if (!pivotId || !dIso) { invalid += 1; return; }
        if (cfg.startMode === "agendado" && !parseTime(cfg.time || "")) { invalid += 1; return; }
        const startAtCandidate = cfg.startMode === "agora"
          ? getMinStartNow()
          : new Date(`${dIso}T${cfg.time}`);
        if (Number.isNaN(startAtCandidate.getTime())) { invalid += 1; return; }
        const p = pivots.find((it) => String(it.id) === String(pivotId));
        if (!p) { invalid += 1; return; }
        draftEntries.push({ k, cfg, pivotId, dIso, startAtCandidate, p });
      });

      // Ordena pelo tempo desejado: atividades mais cedo têm prioridade
      draftEntries.sort((a, b) => a.startAtCandidate.getTime() - b.startAtCandidate.getTime());

      draftEntries.forEach(({ cfg, pivotId, dIso, startAtCandidate, p }) => {
        const parcelData = cfg.stopMode === "por_parcela"
          ? getPivotParcelas(p.id).find((pp) => String(pp.id) === String(cfg.parcelId || ""))
          : null;
        if (cfg.stopMode === "por_parcela" && !parcelData) { invalid += 1; return; }
        const pivotAngle = normalizeAngle(window.IcGetPivotAngle?.(p.id));
        const existingId = String(cfg.activityId || "");
        const existingActivity = existingId
          ? list.find((item) => String(item?.id || "") === existingId)
          : null;
        const nowIso = new Date().toISOString();
        const activity = {
          ...(existingActivity || {}),
          id: existingId || `act_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
          pivotId: p.id,
          pivotName: p.name,
          status: "programada",
          createdAt: existingActivity?.createdAt || nowIso,
          updatedAt: nowIso,
          startedAt: null,
          lastTickAt: null,
          runMs: 0,
          irrigatedDeg: 0,
          pauseState: false,
          finishedAt: null,
          startAngle: pivotAngle,
          endAngle: null,
          startMode: cfg.startMode,
          direction: cfg.direction,
          irrigationMode: cfg.irrigationMode,
          ferti: !!cfg.ferti,
          speedPct: Number(asNum(cfg.speedPct, 100).toFixed(2)),
          laminaMm: Number(asNum(cfg.laminaMm, 0).toFixed(2)),
          stopMode: cfg.stopMode,
          stopValue: cfg.stopMode === "volta_completa" ? Number(Math.max(0.1, asNum(cfg.stopValue, 1)).toFixed(2)) : 0,
          parcelId: parcelData?.id || null,
          parcelName: parcelData?.name || null,
          angleStart: cfg.stopMode === "por_angulos" ? normalizeAngle(cfg.angleStart) : null,
          angleEnd: cfg.stopMode === "por_angulos" ? normalizeAngle(cfg.angleEnd) : null,
          peakPolicy: cfg.peakPolicy || "pausar",
          _peakPolicyApplied: true,
          isLinear: !!cfg.isLinear,
          uiStopMode: String(cfg.uiStopMode || ""),
          linearUiStopMode: String(cfg.linearUiStopMode || ""),
          linearUiStopValue: asNum(cfg.linearUiStopValue, 0),
          linearPositionStart: clampPercent(cfg.linearPositionStart),
          linearPositionEnd: clampPercent(cfg.linearPositionEnd),
          needsConfirmation: existingActivity ? !!existingActivity.needsConfirmation : true,
          confirmedAt: existingActivity ? (existingActivity.confirmedAt || null) : null
        };
        // Tempo marcado = início da irrigação; mov. seco acontece antes
        const dryMs = (cfg.startMode === "agendado") ? (estimateDryMoveMs(activity, pivotAngle) || 0) : 0;
        const reqStart = (cfg.startMode === "agendado" && dryMs > 0)
          ? new Date(startAtCandidate.getTime() - dryMs)
          : startAtCandidate;
        const win = calculateActivityWindowFromStart(activity, reqStart, queue);
        if (!win?.start || !win?.end) { invalid += 1; return; }
        activity.startAt = win.start.toISOString();
        activity.plannedEndAt = win.end.toISOString();
        if (cfg.startMode === "pos_pico") {
          activity.irrigationStartAt = activity.startAt;
        } else if (dryMs > 0) {
          activity.irrigationStartAt = new Date(win.start.getTime() + dryMs).toISOString();
        } else {
          activity.irrigationStartAt = null;
        }
        if (existingActivity) {
          const listIndex = list.findIndex((item) => String(item?.id || "") === existingId);
          if (listIndex >= 0) list[listIndex] = activity;
          else list.push(activity);
          const queueIndex = queue.findIndex((item) => String(item?.id || "") === existingId);
          if (queueIndex >= 0) queue[queueIndex] = activity;
          else queue.push(activity);
          updated += 1;
        } else {
          list.push(activity);
          queue.push(activity);
          created += 1;
        }
      });
      if (!created && !updated && !deletedActivityIds.size) {
        window.IcNotify?.warn?.("Nenhuma programacao valida para salvar.", 1800);
        return;
      }
      saveActivities(list);
      const savedCount = created + updated;
      if (invalid > 0) showBulkSaveToast(`${savedCount} salvas, ${invalid} ignoradas.`);
      else if (deletedActivityIds.size > 0 && savedCount === 0) showBulkSaveToast(`${deletedActivityIds.size} programações removidas.`);
      else showBulkSaveToast(`${savedCount} programações salvas.`);
      close();
    });

    let extendingTimeline = false;
    let lastExtendMs = 0;
    let renderQueued = false;
    let queuedOpts = null;
    const queueRenderGrid = (opts = {}) => {
      queuedOpts = { ...(queuedOpts || {}), ...(opts || {}) };
      if (renderQueued) return;
      renderQueued = true;
      requestAnimationFrame(() => {
        renderQueued = false;
        const runOpts = queuedOpts || {};
        queuedOpts = null;
        renderGrid(runOpts);
      });
    };
    let extendRaf = 0;
    let lastScrollAtMs = 0;
    const maybeExtendTimeline = () => {
      if (extendingTimeline) return;
      const scroller = modal.querySelector("#opBulkTimelineScroller");
      if (!scroller) return;
      const nowMs = Date.now();
      if ((nowMs - lastExtendMs) < 220) return;
      const thresholdPx = 220;
      if ((scroller.scrollLeft + scroller.clientWidth) < (scroller.scrollWidth - thresholdPx)) return;
      const prevLeft = scroller.scrollLeft;
      const prevTop = scroller.scrollTop;
      extendingTimeline = true;
      lastExtendMs = nowMs;
      loadedDays += extendChunkDays;
      queueRenderGrid({ restoreScroll: true, restoreLeft: prevLeft, restoreTop: prevTop });
      requestAnimationFrame(() => { extendingTimeline = false; });
    };
    if (weekly && !weekly.dataset.zoomBound) {
      weekly.dataset.zoomBound = "1";
      weekly.addEventListener("wheel", (e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        const scroller = weekly.querySelector("#opBulkTimelineScroller");
        const delta = e.deltaY < 0 ? 1 : -1;
        const idx = ZOOM_STEPS.indexOf(zoomTickH);
        const nextIdx = Math.max(0, Math.min(ZOOM_STEPS.length - 1, idx - delta));
        if (nextIdx === idx) return;
        zoomTickH = ZOOM_STEPS[nextIdx];
        queueRenderGrid({
          restoreScroll: true,
          restoreLeft: scroller ? scroller.scrollLeft : 0,
          restoreTop: scroller ? scroller.scrollTop : 0,
        });
      }, { passive: false });
    }

    queueRenderGrid();
  }

  OpModal.openBulkSchedule = () => openBulkScheduleModalV2();

  // API pública: cria uma operação (agendada/pós-pico) a partir do card de operação
  // (OpModal). O motor de simulação inicia a atividade sozinho quando o relógio
  // da simulação ultrapassar o horário marcado.
  const IcScheduleOperation = (op) => {
    if (!op || !op.pivotId) return null;
    const equip = getPivotEquipById(op.pivotId);
    const startMode = String(op.startMode || "agora");
    const requested = op.startAt instanceof Date ? new Date(op.startAt) : new Date(op.startAt || getMinStartNow());
    const startBase = (startMode === "agora" || Number.isNaN(requested.getTime()))
      ? getMinStartNow()
      : clampStartToNow(requested);

    // Prefere o ângulo de início informado pela operação (encadeamento entre operações);
    // se não houver, usa o ângulo atual do pivô.
    const pivotAngle = Number.isFinite(op.angle)
      ? normalizeAngle(op.angle)
      : normalizeAngle(window.IcGetPivotAngle?.(op.pivotId));
    const uiStop = String(op.stopMode || "sem_parar");
    let stopMode = "sem_parar";
    let stopValue = 0;
    let angleStart = null;
    let angleEnd = null;
    if (uiStop === "por_voltas") {
      stopMode = "volta_completa";
      stopValue = Math.max(0.1, asNum(op.stopValue, 1));
    } else if (uiStop === "por_angulo" || uiStop === "por_angulos") {
      stopMode = "por_angulos";
      angleStart = pivotAngle;
      angleEnd = normalizeAngle(op.stopValue);
    }

    const nowIso = new Date().toISOString();
    const activity = {
      id: `act_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      pivotId: op.pivotId,
      pivotName: op.pivotName || equip?.name || "Pivô",
      status: "programada",
      createdAt: nowIso,
      updatedAt: nowIso,
      startedAt: null,
      lastTickAt: null,
      runMs: 0,
      irrigatedDeg: 0,
      pauseState: false,
      finishedAt: null,
      startAngle: pivotAngle,
      endAngle: null,
      startMode,
      direction: op.direction === "reverso" ? "reverso" : "avanco",
      irrigationMode: op.irrigationMode === "molhado" ? "molhado" : "seco",
      ferti: !!op.ferti,
      speedPct: Number(asNum(op.speedPct, 100).toFixed(2)),
      laminaMm: Number(asNum(op.laminaMm, 0).toFixed(2)),
      stopMode,
      stopValue: stopMode === "volta_completa" ? Number(stopValue.toFixed(2)) : 0,
      parcelId: null,
      parcelName: null,
      angleStart,
      angleEnd,
      peakPolicy: "pausar",
      _peakPolicyApplied: true,
      isLinear: !!op.isLinear,
    };

    const list = loadActivities();
    // Tempo marcado = início da irrigação; mov. a seco acontece antes (quando agendado).
    const dryMs = (startMode === "agendado") ? (estimateDryMoveMs(activity, pivotAngle) || 0) : 0;
    const reqStart = (startMode === "agendado" && dryMs > 0)
      ? new Date(startBase.getTime() - dryMs)
      : startBase;
    const win = calculateActivityWindowFromStart(activity, reqStart, list);
    activity.startAt = (win?.start || startBase).toISOString();
    activity.plannedEndAt = win?.end ? win.end.toISOString() : null;
    if (startMode === "pos_pico") {
      activity.irrigationStartAt = activity.startAt;
    } else if (dryMs > 0) {
      activity.irrigationStartAt = new Date(new Date(activity.startAt).getTime() + dryMs).toISOString();
    } else {
      activity.irrigationStartAt = null;
    }

    list.push(activity);
    saveActivities(list);
    return activity;
  };
  window.IcOpRouter.registerGlobal("IcScheduleOperation", "dev", IcScheduleOperation);

  const bindBulkScheduleTrigger = () => {
    const btn = document.getElementById("btnWeeklySchedule");
    if (!btn || btn.dataset.programacoesBound === "1") return;
    btn.dataset.programacoesBound = "1";
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (window.IcOpRouter.active !== "dev") return;
      try {
        OpModal.openBulkSchedule?.();
      } catch (err) {
        console.error("Falha ao abrir Programações:", err);
        window.IcNotify?.warn?.("Nao foi possivel abrir Programacoes.", 2200);
      }
    });
  };

  bindBulkScheduleTrigger();

  if (!window.__icOpSchedulerInitDev) {
    window.__icOpSchedulerInitDev = true;
    window.addEventListener("ic:sim-start", (e) => {
      if (window.IcOpRouter.active !== "dev") return;
      executeActivitiesAt(e.detail?.time || new Date());
    });
    window.addEventListener("ic:sim-tick", (e) => {
      if (window.IcOpRouter.active !== "dev") return;
      executeActivitiesAt(e.detail?.time || new Date());
    });
    window.addEventListener("ic:sim-stop", () => {
      if (window.IcOpRouter.active !== "dev") return;
      resetRunningActivitiesOnSimStop();
    });
  }

  // --- CONFIRMAÇÃO DE PROGRAMAÇÕES MÚLTIPLAS (PRÓXIMAS 24H) ---
  // Atividades criadas em "Programações Múltiplas" são pré-programações:
  // só entram na fila de execução depois que o usuário confirma, dentro
  // da janela de 24h antes do horário marcado para rodar.
  const isWithinNext24h = (iso, refDate) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    const diffMs = d.getTime() - refDate.getTime();
    return diffMs <= (24 * 60 * 60 * 1000);
  };

  const getPendingConfirmationsToday = () => {
    const now = getSimulationNow();
    return loadActivities()
      .filter((act) => act
        && act.status === "programada"
        && act.needsConfirmation
        && !act.confirmedAt
        && isWithinNext24h(act.startAt, now))
      .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  };

  const getConfirmedActivitiesToday = () => {
    const now = getSimulationNow();
    return loadActivities()
      .filter((act) => act
        && act.needsConfirmation
        && act.confirmedAt
        && act.status !== "concluida"
        && isWithinNext24h(act.startAt, now))
      .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  };

  const scheduleStartModeLabel = (act) => {
    const mode = String(act.startMode || "agendado");
    if (mode === "agora") return "Agora";
    if (mode === "pos_pico") return "Após pico";
    return "Agendado";
  };
  const schedulePeakPolicyLabel = (act) => {
    const policy = String(act.peakPolicy || "");
    if (policy === "pausar") return "Pausar no pico";
    if (policy === "iniciar_apos_pico") return "Iniciar após pico";
    return "--";
  };
  const scheduleStopModeNorm = (act) => {
    const raw = String(act.stopMode || "");
    return raw === "por_voltas" ? "volta_completa" : (raw === "por_local" ? "por_angulos" : raw);
  };

  const buildScheduleTableRow = (act, { withCheckbox }) => {
    const mode = scheduleStopModeNorm(act);
    const coverage = mode === "por_angulos"
      ? `${escHtml(formatCoverageAngle(act.angleStart))}° → ${escHtml(formatCoverageAngle(act.angleEnd))}°`
      : escHtml(act.coverageLabel || getCoverageLabelForActivity(act));
    const direction = act.direction === "reverso" ? "Reverso" : "Avanço";
    const irrigationModeLabel = act.irrigationMode === "molhado" ? "Molhado" : "Seco";
    const speedLabel = `${escHtml(asNum(act.speedPct, 100))}%`;
    const laminaLabel = Number.isFinite(asNum(act.laminaMm, NaN)) && asNum(act.laminaMm, 0) > 0
      ? `${escHtml(asNum(act.laminaMm, 0).toFixed(1))} mm`
      : "--";
    const checkCell = withCheckbox
      ? `<td class="op-schedule-confirm__check">
          <input type="checkbox" class="op-schedule-confirm__row-check" checked>
        </td>`
      : "";
    return `
      <tr data-activity-id="${escHtml(act.id)}" data-pivot-id="${escHtml(act.pivotId)}" tabindex="0">
        ${checkCell}
        <td>${escHtml(act.pivotName || "--")}</td>
        <td>${escHtml(scheduleStartModeLabel(act))}</td>
        <td>${escHtml(fmtDateTime(act.startAt))}</td>
        <td>${escHtml(fmtDateTime(act.plannedEndAt))}</td>
        <td>${escHtml(direction)}</td>
        <td>${coverage}</td>
        <td>${escHtml(irrigationModeLabel)}</td>
        <td>${speedLabel}</td>
        <td>${laminaLabel}</td>
        <td>${act.ferti ? "Sim" : "Não"}</td>
        <td>${escHtml(schedulePeakPolicyLabel(act))}</td>
      </tr>
    `;
  };

  const scheduleModalStopModeToStorage = (mode) => {
    if (mode === "por_voltas") return "volta_completa";
    if (mode === "por_angulo") return "por_angulos";
    return "sem_parar";
  };
  const scheduleStorageStopModeToModal = (act) => {
    const mode = scheduleStopModeNorm(act);
    if (mode === "volta_completa") return "por_voltas";
    if (mode === "por_angulos") return "por_angulo";
    return "sem_parar";
  };

  // Estimativa genérica de duração/término a partir de um payload do modal
  // padrão (OpModal.open), sem depender de uma atividade já salva — usada como
  // resolveEstimate em qualquer lugar que abre o modal pra criar uma operação
  // nova (card do pivô, LineStar, cadastro de fazenda), não só na edição.
  const IcEstimateOperation = (payload) => {
    const pivotId = payload?.pivotId;
    if (!pivotId) return { durationText: "Duração estimada da operação: --", endText: "Horário estimado para término: --" };
    const startAtDate = payload.startAtDate instanceof Date && !Number.isNaN(payload.startAtDate.getTime())
      ? payload.startAtDate
      : getMinStartNow();
    const stopModeStorage = scheduleModalStopModeToStorage(payload.stopMode);
    // Ângulo atual real do pivô: prioriza payload.angle (o que o modal exibe
    // e o usuário vê em "Ângulo atual") — window.IcGetPivotAngle reflete o
    // motor de simulação, que pode nunca ter sido inicializado para este
    // pivô (retornando 0 por padrão) e divergir do ângulo real exibido.
    const currentAngle = Number.isFinite(asNum(payload.angle, NaN))
      ? asNum(payload.angle)
      : window.IcGetPivotAngle?.(pivotId);
    const activityLike = {
      pivotId,
      startMode: payload.startMode || "agora",
      direction: payload.direction || "avanco",
      irrigationMode: payload.irrigationMode || "molhado",
      speedPct: Math.max(1, asNum(payload.speedPct, 100)),
      stopMode: stopModeStorage,
      stopValue: stopModeStorage === "volta_completa" ? Math.max(0.1, asNum(payload.stopValue, 1)) : 0,
      // startAngle (não só angleStart) pra bater com o nome que
      // calculateActivityWindowFromStart lê como fonte primária do ângulo
      // atual — sem isso ele ignora este valor e recalcula via
      // window.IcGetPivotAngle, que pode divergir do ângulo real exibido.
      startAngle: normalizeAngle(currentAngle),
      angleStart: stopModeStorage === "por_angulos" ? normalizeAngle(currentAngle) : null,
      angleEnd: stopModeStorage === "por_angulos" ? normalizeAngle(payload.stopValue) : null,
      peakPolicy: "pausar"
    };
    const dryMs = (activityLike.startMode === "agendado") ? (estimateDryMoveMs(activityLike, normalizeAngle(currentAngle)) || 0) : 0;
    const reqStart = (activityLike.startMode === "agendado" && dryMs > 0)
      ? new Date(startAtDate.getTime() - dryMs)
      : startAtDate;
    const win = calculateActivityWindowFromStart(activityLike, reqStart, loadActivities());
    if (!win?.start || !win?.end) {
      return { durationText: "Duração estimada da operação: --", endText: "Horário estimado para término: --" };
    }
    const durationMs = win.end.getTime() - win.start.getTime();
    const hours = Math.floor(durationMs / 3600000);
    const minutes = Math.round((durationMs % 3600000) / 60000);
    return {
      durationText: `Duração estimada da operação: ${hours}h${String(minutes).padStart(2, "0")}min`,
      endText: `Horário estimado para término: ${toPtDateTimeValue(win.end)}`
    };
  };
  window.IcOpRouter.registerGlobal("IcEstimateOperation", "dev", IcEstimateOperation);

  // Aplica um payload do modal padrão (OpModal.open) em cima de uma atividade
  // existente, recalculando a janela real (início/fim, mov. a seco, pausa em
  // horário de pico) da mesma forma que o salvamento faz — reaproveitado
  // tanto para persistir quanto para estimar duração/término ao vivo.
  const applyScheduleEditorPayload = (act, payload, list) => {
    const startAtDate = payload.startAtDate instanceof Date && !Number.isNaN(payload.startAtDate.getTime())
      ? payload.startAtDate
      : new Date(act.startAt);
    const stopModeStorage = scheduleModalStopModeToStorage(payload.stopMode);
    const updated = {
      ...act,
      startMode: payload.startMode,
      direction: payload.direction,
      irrigationMode: payload.irrigationMode,
      speedPct: Math.max(1, asNum(payload.speedPct, 100)),
      laminaMm: Math.max(0, asNum(payload.laminaMm, act.laminaMm)),
      ferti: !!payload.ferti,
      fertiObs: payload.fertiObs || "",
      stopMode: stopModeStorage,
      stopValue: stopModeStorage === "volta_completa" ? Math.max(0.1, asNum(payload.stopValue, 1)) : 0,
      angleStart: stopModeStorage === "por_angulos" ? normalizeAngle(act.startAngle) : null,
      angleEnd: stopModeStorage === "por_angulos" ? normalizeAngle(payload.stopValue) : null
    };
    const dryMs = (updated.startMode === "agendado") ? (estimateDryMoveMs(updated, normalizeAngle(window.IcGetPivotAngle?.(act.pivotId))) || 0) : 0;
    const reqStart = (updated.startMode === "agendado" && dryMs > 0)
      ? new Date(startAtDate.getTime() - dryMs)
      : startAtDate;
    const win = calculateActivityWindowFromStart(updated, reqStart, list.filter((it) => String(it?.id || "") !== String(act.id)));
    updated.startAt = (win?.start || startAtDate).toISOString();
    updated.plannedEndAt = win?.end ? win.end.toISOString() : act.plannedEndAt;
    return updated;
  };

  const openScheduleActivityEditor = (act) => {
    if (!act) return;
    const equip = getPivotEquipById(act.pivotId);
    const isLinear = isLineStarEquipment(equip);
    const stopModeForModal = scheduleStorageStopModeToModal(act);
    const stopValueForModal = stopModeForModal === "por_angulo"
      ? asNum(act.angleEnd, normalizeAngle(window.IcGetPivotAngle?.(act.pivotId)) ?? 0)
      : Math.max(0.1, asNum(act.stopValue, 1));

    window.OpModal?.open?.({
      title: act.pivotName,
      pivotId: act.pivotId,
      isLinear,
      angle: normalizeAngle(act.startAngle ?? window.IcGetPivotAngle?.(act.pivotId)) ?? 0,
      isPeakHour: getPeakConfigByPivotId(act.pivotId).hasPeak,
      startMode: act.startMode || "agendado",
      startAt: act.startAt,
      stopMode: stopModeForModal,
      stopValue: stopValueForModal,
      direction: act.direction || "avanco",
      irrigationMode: act.irrigationMode || "molhado",
      speedPct: asNum(act.speedPct, 100),
      laminaMm: asNum(act.laminaMm, 0),
      ferti: !!act.ferti,
      fertiObs: act.fertiObs || "",
      showClear: true,
      onClear: () => {
        if (!window.confirm(tMsg("Excluir esta programação?"))) return;
        const list = loadActivities().filter((it) => String(it?.id || "") !== String(act.id));
        saveActivities(list);
        window.IcNotify?.success?.("Programação excluída.", 1800);
        refreshOpenScheduleModals();
      },
      resolveEstimate: (payload) => {
        const updated = applyScheduleEditorPayload(act, payload, loadActivities());
        const start = new Date(updated.startAt);
        const end = updated.plannedEndAt ? new Date(updated.plannedEndAt) : null;
        if (Number.isNaN(start.getTime()) || !end || Number.isNaN(end.getTime())) {
          return { durationText: "Duração estimada da operação: --", endText: "Horário estimado para término: --" };
        }
        const durationMs = end.getTime() - start.getTime();
        const hours = Math.floor(durationMs / 3600000);
        const minutes = Math.round((durationMs % 3600000) / 60000);
        return {
          durationText: `Duração estimada da operação: ${hours}h${String(minutes).padStart(2, "0")}min`,
          endText: `Horário estimado para término: ${fmtDateTime(updated.plannedEndAt)}`
        };
      },
      onSave: (payload) => {
        const list = loadActivities();
        const idx = list.findIndex((it) => String(it?.id || "") === String(act.id));
        if (idx < 0) return;
        list[idx] = applyScheduleEditorPayload(act, payload, list);
        saveActivities(list);
        window.IcNotify?.success?.("Programação atualizada.", 1800);
        refreshOpenScheduleModals();
      }
    });
  };

  // Se a tela de pendentes ou de confirmadas estiver aberta ao editar/excluir
  // uma linha, reconstrói a lista para refletir a mudança na hora, em vez de
  // deixar a linha excluída/alterada visível até o modal ser fechado e reaberto.
  const refreshOpenScheduleModals = () => {
    if (document.getElementById("opScheduleConfirmModal")) {
      scheduleAlertState.open = false;
      openScheduleConfirmModal();
    }
    if (document.getElementById("opScheduleConfirmedModal")) {
      confirmedModalState.open = false;
      openConfirmedScheduleModal();
    }
  };

  const bindScheduleRowClickToEdit = (modal, activities) => {
    modal.querySelectorAll("tr[data-activity-id]").forEach((tr) => {
      tr.addEventListener("click", (e) => {
        if (e.target.closest(".op-schedule-confirm__check")) return;
        const actId = tr.getAttribute("data-activity-id");
        const act = activities.find((it) => String(it.id) === String(actId));
        openScheduleActivityEditor(act);
      });
    });
  };

  const scheduleAlertState = { open: false };

  const getScheduleAlertsWrap = () => {
    const mapEl = document.getElementById("map");
    if (!mapEl) return null;
    let wrap = document.getElementById("mapScheduleAlerts");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "mapScheduleAlerts";
      wrap.className = "map-schedule-alerts";
      mapEl.appendChild(wrap);
    }
    return wrap;
  };

  const isDevFeaturesOn = () => !!window.__icDevFeaturesOn;

  const removeSchedulePopup = () => {
    document.getElementById("mapScheduleAlertPopup")?.remove();
  };

  const renderSchedulePopup = () => {
    const pending = getPendingConfirmationsToday();
    const wrap = getScheduleAlertsWrap();
    if (!pending.length || !wrap || !isDashboardRoute() || !isDevFeaturesOn() || scheduleAlertState.open) {
      removeSchedulePopup();
      return;
    }
    if (document.getElementById("mapScheduleAlertPopup")) return;
    const html = `
      <button type="button" class="map-schedule-alert" id="mapScheduleAlertPopup">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <span>${pending.length} <span>${pending.length === 1 ? "evento programado" : "eventos programados"}</span> <span>${pending.length === 1 ? "nas próximas 24h precisa de confirmação" : "nas próximas 24h precisam de confirmação"}</span></span>
        <i class="fa-solid fa-chevron-right map-schedule-alert__go"></i>
      </button>
    `;
    wrap.insertAdjacentHTML("beforeend", html);
    document.getElementById("mapScheduleAlertPopup")?.addEventListener("click", () => {
      openScheduleConfirmModal();
    });
  };

  function openScheduleConfirmModal() {
    const id = "opScheduleConfirmModal";
    document.getElementById(id)?.remove();
    const pending = getPendingConfirmationsToday();
    if (!pending.length) { removeSchedulePopup(); return; }
    scheduleAlertState.open = true;
    removeSchedulePopup();

    const rowsHtml = pending.map((act) => buildScheduleTableRow(act, { withCheckbox: true })).join("");

    const html = `
      <div class="op-modal__overlay" id="${id}">
        <div class="op-schedule-confirm" role="dialog" aria-modal="true" aria-label="Confirmar programações do dia">
          <div class="op-schedule-confirm__head">
            <div class="op-schedule-confirm__title">
              <i class="fa-solid fa-calendar-days"></i>
              Programações nas próximas 24h
            </div>
            <button type="button" class="op-schedule-confirm__close" id="opScheduleConfirmClose">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="op-schedule-confirm__body">
            <table class="op-schedule-confirm__table">
              <thead>
                <tr>
                  <th class="op-schedule-confirm__check">
                    <input type="checkbox" id="opScheduleConfirmAll" checked>
                  </th>
                  <th>Equipamento</th>
                  <th>Início</th>
                  <th>Início previsto</th>
                  <th>Fim previsto</th>
                  <th>Direção</th>
                  <th>Cobertura</th>
                  <th>Modo</th>
                  <th>Velocidade</th>
                  <th>Lâmina</th>
                  <th>Ferti</th>
                  <th>Pico</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
          <div class="op-schedule-confirm__footer">
            <span class="op-schedule-confirm__hint">Desmarque os eventos que não devem iniciar.</span>
            <button type="button" class="btn btn--ok" id="opScheduleConfirmBtn">Confirmar selecionados</button>
          </div>
        </div>
      </div>
    `;
    getModalHost().insertAdjacentHTML("beforeend", html);
    const modal = document.getElementById(id);

    const close = () => {
      modal?.remove();
      scheduleAlertState.open = false;
      renderSchedulePopup();
    };

    modal.querySelector("#opScheduleConfirmClose")?.addEventListener("click", close);
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });

    const allChk = modal.querySelector("#opScheduleConfirmAll");
    const rowChks = () => Array.from(modal.querySelectorAll(".op-schedule-confirm__row-check"));
    allChk?.addEventListener("change", () => {
      rowChks().forEach((c) => { c.checked = allChk.checked; });
    });
    modal.querySelectorAll(".op-schedule-confirm__row-check").forEach((chk) => {
      chk.addEventListener("change", () => {
        if (!chk.checked && allChk) allChk.checked = false;
        else if (allChk && rowChks().every((c) => c.checked)) allChk.checked = true;
      });
    });

    modal.querySelector("#opScheduleConfirmBtn")?.addEventListener("click", () => {
      const checkedIds = new Set(
        Array.from(modal.querySelectorAll("tr[data-activity-id]"))
          .filter((tr) => tr.querySelector(".op-schedule-confirm__row-check")?.checked)
          .map((tr) => tr.getAttribute("data-activity-id"))
      );
      if (!checkedIds.size) {
        window.IcNotify?.warn?.("Nenhum evento selecionado.", 1800);
        return;
      }
      const nowIso = new Date().toISOString();
      const list = loadActivities();
      list.forEach((act) => {
        if (act && checkedIds.has(String(act.id))) {
          act.confirmedAt = nowIso;
        }
      });
      saveActivities(list);
      window.IcNotify?.success?.(`${checkedIds.size} programação(ões) confirmada(s).`, 1800);
      close();
    });

    bindScheduleRowClickToEdit(modal, pending);
  }

  const removeConfirmedSchedulePopup = () => {
    document.getElementById("mapScheduleConfirmedPopup")?.remove();
  };

  const confirmedModalState = { open: false };

  const renderConfirmedSchedulePopup = () => {
    const confirmed = getConfirmedActivitiesToday();
    const wrap = getScheduleAlertsWrap();
    if (!confirmed.length || !wrap || !isDashboardRoute() || !isDevFeaturesOn() || confirmedModalState.open) {
      removeConfirmedSchedulePopup();
      return;
    }
    if (document.getElementById("mapScheduleConfirmedPopup")) return;
    const html = `
      <button type="button" class="map-schedule-alert map-schedule-alert--confirmed" id="mapScheduleConfirmedPopup">
        <i class="fa-solid fa-circle-check"></i>
        <span>${confirmed.length} <span>${confirmed.length === 1 ? "programação confirmada" : "programações confirmadas"}</span> <span>nas próximas 24h</span></span>
        <i class="fa-solid fa-chevron-right map-schedule-alert__go"></i>
      </button>
    `;
    wrap.insertAdjacentHTML("beforeend", html);
    document.getElementById("mapScheduleConfirmedPopup")?.addEventListener("click", () => {
      openConfirmedScheduleModal();
    });
  };

  function openConfirmedScheduleModal() {
    const id = "opScheduleConfirmedModal";
    document.getElementById(id)?.remove();
    const confirmed = getConfirmedActivitiesToday();
    if (!confirmed.length) { removeConfirmedSchedulePopup(); return; }
    confirmedModalState.open = true;
    removeConfirmedSchedulePopup();

    const rowsHtml = confirmed.map((act) => buildScheduleTableRow(act, { withCheckbox: false })).join("");

    const html = `
      <div class="op-modal__overlay" id="${id}">
        <div class="op-schedule-confirm" role="dialog" aria-modal="true" aria-label="Programações confirmadas nas próximas 24h">
          <div class="op-schedule-confirm__head">
            <div class="op-schedule-confirm__title">
              <i class="fa-solid fa-circle-check"></i>
              Programações confirmadas nas próximas 24h
            </div>
            <button type="button" class="op-schedule-confirm__close" id="opScheduleConfirmedClose">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="op-schedule-confirm__body">
            <table class="op-schedule-confirm__table">
              <thead>
                <tr>
                  <th>Equipamento</th>
                  <th>Início</th>
                  <th>Início previsto</th>
                  <th>Fim previsto</th>
                  <th>Direção</th>
                  <th>Cobertura</th>
                  <th>Modo</th>
                  <th>Velocidade</th>
                  <th>Lâmina</th>
                  <th>Ferti</th>
                  <th>Pico</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
          <div class="op-schedule-confirm__footer">
            <span class="op-schedule-confirm__hint">Clique em uma linha para ver ou editar a programação.</span>
          </div>
        </div>
      </div>
    `;
    getModalHost().insertAdjacentHTML("beforeend", html);
    const modal = document.getElementById(id);

    const close = () => {
      modal?.remove();
      confirmedModalState.open = false;
      renderConfirmedSchedulePopup();
    };

    modal.querySelector("#opScheduleConfirmedClose")?.addEventListener("click", close);
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });

    bindScheduleRowClickToEdit(modal, confirmed);
  }

  const renderBothSchedulePopups = () => {
    renderSchedulePopup();
    renderConfirmedSchedulePopup();
  };

  window.addEventListener(ACTIVITIES_EVENT, renderBothSchedulePopups);
  window.addEventListener("ic:sim-tick", () => {
    if (window.IcOpRouter.active !== "dev") return;
    renderBothSchedulePopups();
  });
  window.addEventListener("ic:route-change", () => {
    if (window.IcOpRouter.active !== "dev") return;
    renderBothSchedulePopups();
  });
  window.addEventListener("ic:dev-features-toggle", (e) => {
    if (e.detail?.variant !== "dev") return;
    if (!e.detail?.on) {
      removeSchedulePopup();
      removeConfirmedSchedulePopup();
      return;
    }
    bindBulkScheduleTrigger();
    renderBothSchedulePopups();
  });
  document.addEventListener("DOMContentLoaded", renderBothSchedulePopups);
  renderBothSchedulePopups();
})();
