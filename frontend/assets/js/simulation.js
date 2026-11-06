// assets/js/simulation.js
(function initSimulation() {
  "use strict";

  const state = {
    active: false,
    running: false,
    startTime: null,
    endTime: null,
    dayDurationMin: 1,
    currentTime: null,
    _realStartedAt: null,
    _simStartedAt: null,
    _raf: null
  };

  const trigger = document.getElementById("btnSimMode");
  const bar = document.getElementById("simBar");
  if (!trigger || !bar) return;

  const periodSel = document.getElementById("simPeriod");
  const speedSel = document.getElementById("simSpeed");
  const btnPlayPause = document.getElementById("simPlayPause");
  const iconPlayPause = document.getElementById("simPlayPauseIcon");
  const btnStop = document.getElementById("simStop");
  const statusListEl = document.getElementById("simStatusList");
  const fill = document.getElementById("simProgressFill");
  const nowLabel = document.getElementById("simNow");
  const progressLbl = document.getElementById("simProgressLabel");
  const closeBtn = document.getElementById("btnSimClose");
  const minimizeBtn = document.getElementById("btnSimMinimize");

  const STATUS_META = Object.freeze({
    painel_energizado: {
      label: "Painel energizado",
      badgeText: "PAINEL ENERGIZADO",
      legend: "100% amarelo",
      statusText: "PAINEL ENERGIZADO",
      statusClass: "is-warning",
      badgeClass: "map-card__equip-badge--warn",
      visual: {
        fill: "#dac422",
        stroke: "#dac422",
        outline: "#dac422",
        outerFill: "",
        fillOpacity: 0.22,
        outerFillOpacity: 0
      }
    },
    irrigando: {
      label: "Irrigando",
      badgeText: "IRRIGANDO",
      legend: "80% azul + aro azul escuro",
      statusText: "IRRIGANDO",
      statusClass: "is-info",
      badgeClass: "map-card__equip-badge--info",
      visual: {
        fill: "#4679ed",      // oficial: preenchimento e borda da mesma cor
        stroke: "#4679ed",
        outline: "#4679ed",
        outerFill: "#2520ca", // oficial: #2218cb a 70% sobre o azul = #2520ca sólido
        fillOpacity: 0.8,
        outerFillOpacity: 1
      }
    },
    movendo_a_seco: {
      label: "Movendo a seco",
      badgeText: "MOVENDO A SECO",
      legend: "100% marrom em movimento",
      statusText: "MOVENDO A SECO",
      statusClass: "is-brown",
      badgeClass: "map-card__equip-badge--brown",
      visual: {
        fill: "#54341c",
        stroke: "#54341c",
        outline: "#54341c",
        outerFill: "",
        fillOpacity: 0.84,
        outerFillOpacity: 0
      }
    },
    irrigacao_finalizada: {
      label: "Irrigacao finalizada",
      badgeText: "FINALIZADA",
      legend: "80% amarelo + aro azul escuro",
      statusText: "IRRIGACAO FINALIZADA",
      statusClass: "is-complete",
      badgeClass: "map-card__equip-badge--complete",
      visual: {
        fill: "#DAC422",
        stroke: "#DAC422",
        outline: "#DAC422",
        outerFill: "#3026bc", // anel como aparece na oficial sobre o amarelo (sólido, sem emenda)
        fillOpacity: 0.8,
        outerFillOpacity: 1
      }
    },
    painel_desligado: {
      label: "Painel desligado",
      badgeText: "PAINEL DESLIGADO",
      legend: "100% laranja",
      statusText: "PAINEL DESLIGADO",
      statusClass: "is-warning",
      badgeClass: "map-card__equip-badge--warn",
      visual: {
        fill: "#f59e0b",
        stroke: "#d97706",
        outline: "#b45309",
        outerFill: "",
        fillOpacity: 0.84,
        outerFillOpacity: 0
      }
    },
    preparando_irrigar: {
      label: "Preparando para religar",
      badgeText: "PREPARANDO PARA RELIGAR",
      legend: "100% verde",
      statusText: "PREPARANDO PARA RELIGAR",
      statusClass: "is-success",
      badgeClass: "map-card__equip-badge--success",
      visual: {
        fill: "#22c55e",
        stroke: "#16a34a",
        outline: "#15803d",
        outerFill: "",
        fillOpacity: 0.84,
        outerFillOpacity: 0
      }
    },
    alerta: {
      label: "Alerta no pivô",
      badgeText: "ALERTA",
      legend: "100% vermelho",
      statusText: "ALERTA",
      statusClass: "is-danger",
      badgeClass: "map-card__equip-badge--danger",
      visual: {
        fill: "#ef4444",
        stroke: "#dc2626",
        outline: "#b91c1c",
        outerFill: "",
        fillOpacity: 0.84,
        outerFillOpacity: 0
      }
    },
    desligado_sem_internet: {
      label: "Desligado / sem internet",
      badgeText: "SEM INTERNET",
      legend: "100% cinza",
      statusText: "PIVO DESLIGADO / SEM INTERNET",
      statusClass: "is-neutral",
      badgeClass: "map-card__equip-badge--neutral",
      visual: {
        fill: "#6c706d",
        stroke: "#7a7a7a",
        outline: "#7a7a7a",
        outerFill: "",
        fillOpacity: 0.84,
        outerFillOpacity: 0
      }
    },
    ferti_irrigando: {
      label: "Ferti irrigando",
      badgeText: "FERTI",
      legend: "Centro azul-roxo claro + aro azul-roxo escuro",
      statusText: "FERTI IRRIGANDO",
      statusClass: "is-purple",
      badgeClass: "map-card__equip-badge--ferti",
      visual: {
        fill: "#a5b4fc",
        stroke: "#4f46e5",
        outline: "#3730a3",
        outerFill: "#4f46e5",
        fillOpacity: 0.82,
        outerFillOpacity: 0.98
      }
    }
  });

  function getRuntimeStore() {
    if (!window.IcPivotSimulationRuntime || typeof window.IcPivotSimulationRuntime !== "object") {
      window.IcPivotSimulationRuntime = { states: {}, statusOverrides: {}, version: 1 };
    }
    if (!window.IcPivotSimulationRuntime.states || typeof window.IcPivotSimulationRuntime.states !== "object") {
      window.IcPivotSimulationRuntime.states = {};
    }
    if (!window.IcPivotSimulationRuntime.statusOverrides || typeof window.IcPivotSimulationRuntime.statusOverrides !== "object") {
      window.IcPivotSimulationRuntime.statusOverrides = {};
    }
    if (!window.IcPivotSimulationRuntime.motion || typeof window.IcPivotSimulationRuntime.motion !== "object") {
      window.IcPivotSimulationRuntime.motion = {};
    }
    return window.IcPivotSimulationRuntime;
  }

  const getSimNowMs = () => {
    const t = state?.currentTime instanceof Date ? state.currentTime.getTime() : Date.now();
    return Number.isFinite(t) ? t : Date.now();
  };

  const ACTIVE_PROGRESS_STATUS_KEYS = new Set(["irrigando", "movendo_a_seco", "ferti_irrigando"]);

  function getBasePivotFillOpacity() {
    const opacity = window.IcMapPivotVisualUtils?.getPivotBaseFillOpacity?.();
    if (!Number.isFinite(opacity)) return 0.22;
    return Math.max(0, Math.min(1, opacity));
  }

  function getBasePivotVisuals() {
    const baseVisual = window.IcMapPivotVisualUtils?.getPivotBaseVisuals?.();
    if (!baseVisual || typeof baseVisual !== "object") {
      return {
        fill: "#fbbf24",
        stroke: "#fbbf24",
        outline: "#fbbf24",
        fillOpacity: getBasePivotFillOpacity(),
        statusText: "PAINEL ENERGIZADO",
        statusClass: "is-warning"
      };
    }
    return {
      fill: baseVisual.fill || "#fbbf24",
      stroke: baseVisual.stroke || baseVisual.fill || "#fbbf24",
      outline: baseVisual.outline || baseVisual.stroke || baseVisual.fill || "#fbbf24",
      fillOpacity: Number.isFinite(baseVisual.fillOpacity) ? baseVisual.fillOpacity : getBasePivotFillOpacity(),
      statusText: baseVisual.statusText || "PAINEL ENERGIZADO",
      statusClass: baseVisual.statusClass || "is-warning"
    };
  }

  function getStatusMeta(key) {
    return STATUS_META[key] || STATUS_META.painel_energizado;
  }

  function getStatusKeyForPivot(pivotId) {
    const key = getRuntimeStore().statusOverrides?.[pivotId];
    return key && STATUS_META[key] ? key : "painel_energizado";
  }

  function getPivotRuntime(pivotId) {
    const store = getRuntimeStore();
    if (!store.states[pivotId]) {
      store.states[pivotId] = {
        mode: "irrigating",
        progress: 0,
        isRunning: false
      };
    }
    return store.states[pivotId];
  }

  function getModeForStatus(statusKey) {
    if (statusKey === "ferti_irrigando") return "fertigation";
    if (statusKey === "movendo_a_seco") return "dry_irrigation";
    return "irrigating";
  }

  function getSimulationPercent() {
    if (!state.startTime || !state.endTime || !state.currentTime) return 0;
    const total = state.endTime - state.startTime;
    const elapsed = state.currentTime - state.startTime;
    if (total <= 0) return 0;
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  }

  function syncPivotRuntimeStates() {
    const pct = getSimulationPercent();
    const store = getRuntimeStore();
    getPivots().forEach((pivot) => {
      const pivotId = String(pivot.id || "");
      const statusKey = getStatusKeyForPivot(pivotId);
      const runtime = getPivotRuntime(pivotId);
      runtime.mode = getModeForStatus(statusKey);

      if (ACTIVE_PROGRESS_STATUS_KEYS.has(statusKey)) {
        const motion = store.motion[pivotId];
        if (motion && Number.isFinite(motion.speedPct) && motion.speedPct > 0) {
          // Movimento real por pivô — a posição é avançada pelo animador (tempo real).
          runtime.progress = motion.progress ?? 0;
          runtime.isRunning = true;
          startMotionLoop();
          return;
        }
        runtime.progress = pct;
        runtime.isRunning = state.running;
        return;
      }

      if (statusKey === "irrigacao_finalizada") {
        runtime.progress = 100;
        runtime.isRunning = false;
        return;
      }

      runtime.progress = 0;
      runtime.isRunning = false;
    });
  }

  function getActiveFarm() {
    return window.IcFarmGetActive?.() || window.IcFarmActive || null;
  }

  function isSimulatedPivotEquipment(equip) {
    const type = String(equip?.type || "").toLowerCase();
    const category = String(equip?.category || "").toLowerCase();
    return category === "pivos" || type === "smart_connect" || type === "smarttouch" || type === "linestar";
  }

  function refreshStatusViews() {
    const farm = getActiveFarm();
    if (farm && typeof window.IcMapRenderPivots === "function") {
      window.IcMapRenderPivots(farm);
    }
    window.IcFarmsRenderEquipment?.();
    window.dispatchEvent(new CustomEvent("ic:sim-status-change"));
  }

  window.IcResolvePivotStatus = (pivot) => {
    const pivotId = String(pivot?.id || "");
    const key = getStatusKeyForPivot(pivotId);
    const meta = getStatusMeta(key);
    const baseVisual = getBasePivotVisuals();
    return {
      key,
      label: meta.label,
      badgeText: meta.badgeText,
      legend: meta.legend,
      statusText: key === "painel_energizado" ? baseVisual.statusText : meta.statusText,
      statusClass: key === "painel_energizado" ? baseVisual.statusClass : meta.statusClass,
      badgeClass: meta.badgeClass,
      visual: {
        ...meta.visual,
        fill: key === "painel_energizado" ? baseVisual.fill : meta.visual.fill,
        stroke: key === "painel_energizado" ? baseVisual.stroke : meta.visual.stroke,
        outline: key === "painel_energizado" ? baseVisual.outline : meta.visual.outline,
        fillOpacity: key === "painel_energizado" ? baseVisual.fillOpacity : getBasePivotFillOpacity()
      }
    };
  };

  // Aliases p/ chaves legadas usadas pelo motor de programações (op-programacoes.js).
  const STATUS_KEY_ALIAS = {
    seco: "movendo_a_seco",
    energizado: "painel_energizado",
    pausado_pico: "painel_energizado",
    pausado: "painel_energizado",
    ferti: "ferti_irrigando",
  };

  window.IcSetSimPivotStatus = (pivotId, statusKey) => {
    const aliased = STATUS_KEY_ALIAS[statusKey] || statusKey;
    const key = STATUS_META[aliased] ? aliased : "painel_energizado";
    const id = String(pivotId || "");
    const store = getRuntimeStore();
    store.statusOverrides[id] = key;
    // Ao sair de um status ativo (parar/finalizar), encerra o movimento do pivô.
    if (!ACTIVE_PROGRESS_STATUS_KEYS.has(key)) delete store.motion[id];
    syncPivotRuntimeStates();
    refreshStatusViews();
  };

  // --- Movimento por pivô (chamado pelo motor de programações) -----------------
  const ensureMotion = (id) => {
    const store = getRuntimeStore();
    if (!store.motion[id]) {
      store.motion[id] = { progress: 0, speedPct: 100, dirSign: 1, baseSimMs: getSimNowMs() };
    }
    return store.motion[id];
  };

  window.IcSetSimPivotSpeed = (pivotId, pct) => {
    const id = String(pivotId || "");
    if (!id) return;
    const store = getRuntimeStore();
    if (pct == null) { delete store.motion[id]; return; }
    const m = ensureMotion(id);
    m.speedPct = Math.max(1, Number(pct) || 100);
    m.baseSimMs = getSimNowMs();
  };

  window.IcSetSimPivotDirection = (pivotId, dir) => {
    const id = String(pivotId || "");
    if (!id) return;
    const m = ensureMotion(id);
    m.dirSign = Number(dir) < 0 ? -1 : 1;
    m.baseSimMs = getSimNowMs();
  };

  window.IcSetSimPivotBearing = (pivotId, angleDeg, _snap) => {
    const id = String(pivotId || "");
    if (!id) return;
    const m = ensureMotion(id);
    const a = ((Number(angleDeg) % 360) + 360) % 360;
    if (Number.isFinite(a)) m.progress = (a / 360) * 100;
    m.baseSimMs = getSimNowMs();
  };

  window.IcGetPivotAngle = (pivotId) => {
    const m = getRuntimeStore().motion[String(pivotId || "")];
    return m && Number.isFinite(m.progress) ? (m.progress / 100) * 360 : 0;
  };

  // Infos de movimento p/ a legenda do pivô no mapa (progresso, direção, tempo restante da volta).
  window.IcGetPivotMotionInfo = (pivotId) => {
    const m = getRuntimeStore().motion[String(pivotId || "")];
    if (!m || !(Number(m.speedPct) > 0)) return null;
    const progress = Math.max(0, Math.min(100, m.progress ?? 0));
    const dirSign = m.dirSign < 0 ? -1 : 1;
    const lapMs = REAL_LAP_MS_AT_100 * (100 / Math.max(1, m.speedPct));
    const remainingFrac = dirSign < 0 ? (progress / 100) : ((100 - progress) / 100);
    // Ângulos de partida (verde) e parada (vermelho) da operação atual, se houver.
    const cur = Array.isArray(m.queue) ? m.queue[0] : null;
    let startAngleDeg = null;
    let stopAngleDeg = null;
    if (cur) {
      startAngleDeg = cur.startAngle;
      if (cur.stopType === "angle") {
        stopAngleDeg = (((cur.startAngle + (cur.dirSign < 0 ? -1 : 1) * cur.stopDistDeg) % 360) + 360) % 360;
      }
    } else if (m.finishedArc) {
      startAngleDeg = m.finishedArc.start;
      stopAngleDeg = m.finishedArc.stop;
    }
    return { progress, dirSign, speedPct: m.speedPct, laminaMm: Number(m.laminaMm) || 0, remainingMs: remainingFrac * lapMs, startAngleDeg, stopAngleDeg, finished: !!m.finished };
  };

  // --- Execução de operações (sequência) em tempo real, sem depender do Play global ---
  const opModeKey = (op) => {
    if (op?.ferti) return "ferti_irrigando";
    return op?.irrigationMode === "molhado" ? "irrigando" : "movendo_a_seco";
  };
  const normalizeOpForRun = (op) => {
    const dirSign = op?.direction === "reverso" ? -1 : 1;
    const speedPct = Math.max(1, Number(op?.speedPct) || 100);
    const startAngle = (((Number(op?.angle) || 0) % 360) + 360) % 360;
    const uiStop = String(op?.stopMode || "sem_parar");
    let stopType = "none";
    let stopDistDeg = 0;
    let stopLaps = 0;
    if (uiStop === "por_voltas") {
      stopType = "laps";
      stopLaps = Math.max(0.1, Number(op?.stopValue) || 1);
    } else if (uiStop === "por_angulo" || uiStop === "por_angulos") {
      stopType = "angle";
      const target = (((Number(op?.stopValue) || 0) % 360) + 360) % 360;
      let dist = dirSign > 0 ? ((target - startAngle + 360) % 360) : ((startAngle - target + 360) % 360);
      if (dist <= 0.0001) dist = 360;
      stopDistDeg = dist;
    }
    return { mode: opModeKey(op), dirSign, speedPct, startAngle, stopType, stopDistDeg, stopLaps, laminaMm: Number(op?.laminaMm) || 0 };
  };

  // Roda uma ou mais operações em sequência (ex.: mover a seco e depois irrigar).
  window.IcRunPivotOperations = (pivotId, ops) => {
    const id = String(pivotId || "");
    if (!id || !Array.isArray(ops) || !ops.length) return;
    const queue = ops.map(normalizeOpForRun);
    const first = queue[0];
    const store = getRuntimeStore();
    store.motion[id] = {
      progress: (first.startAngle / 360) * 100,
      speedPct: first.speedPct,
      dirSign: first.dirSign,
      laminaMm: first.laminaMm,
      queue,
      traveledDeg: 0,
    };
    store.statusOverrides[id] = first.mode;
    syncPivotRuntimeStates();
    refreshStatusViews();
    startMotionLoop();
  };

  // --- Animador de movimento em tempo real -------------------------------------
  // Faz o pivô operado girar no mapa assim que ligado, sem depender do Play global.
  const REAL_LAP_MS_AT_100 = 180000; // DEMO: 3 min por volta a 100% (mais lento em % menores) — ajuste aqui
  let _motionRaf = null;
  let _motionLastTs = 0;

  function hasActiveMotionPivot() {
    const store = getRuntimeStore();
    return Object.keys(store.motion).some((id) =>
      ACTIVE_PROGRESS_STATUS_KEYS.has(getStatusKeyForPivot(id)) && Number(store.motion[id]?.speedPct) > 0
    );
  }

  function rerenderMotionMap() {
    // Reaproveita o mesmo render usado pelo tick da simulação (respeita o contexto do mapa).
    window.dispatchEvent(new CustomEvent("ic:pivot-motion-tick"));
  }

  function motionFrame(ts) {
    const store = getRuntimeStore();
    const dt = _motionLastTs ? Math.max(0, ts - _motionLastTs) : 0;
    _motionLastTs = ts;
    let any = false;
    let transitioned = false;
    Object.keys(store.motion).forEach((id) => {
      const statusKey = getStatusKeyForPivot(id);
      const m = store.motion[id];
      if (!m || !(Number(m.speedPct) > 0) || !ACTIVE_PROGRESS_STATUS_KEYS.has(statusKey)) return;
      any = true;
      const lapMs = REAL_LAP_MS_AT_100 * (100 / Math.max(1, m.speedPct));
      const deltaProg = (m.dirSign < 0 ? -1 : 1) * (dt / lapMs) * 100;
      m.progress = ((((m.progress ?? 0) + deltaProg) % 100) + 100) % 100;

      // Sequência de operações: ao completar o arco da operação atual, passa p/ a próxima.
      if (Array.isArray(m.queue) && m.queue.length) {
        m.traveledDeg = (m.traveledDeg || 0) + Math.abs(deltaProg) * 3.6;
        const cur = m.queue[0];
        let done = false;
        if (cur.stopType === "angle") done = m.traveledDeg >= cur.stopDistDeg;
        else if (cur.stopType === "laps") done = m.traveledDeg >= cur.stopLaps * 360;
        if (done) {
          // Guarda o arco que foi efetivamente irrigado (p/ a banda azul de "finalizada").
          if (cur.mode === "irrigando" || cur.mode === "ferti_irrigando") {
            const stopDeg = cur.stopType === "angle"
              ? (((cur.startAngle + cur.dirSign * cur.stopDistDeg) % 360) + 360) % 360
              : (((m.progress * 3.6) % 360) + 360) % 360;
            m.lastIrrigArc = { start: cur.startAngle, stop: stopDeg, dirSign: cur.dirSign };
          }
          m.queue.shift();
          if (m.queue.length) {
            const nxt = m.queue[0];
            m.dirSign = nxt.dirSign;
            m.speedPct = nxt.speedPct;
            m.laminaMm = nxt.laminaMm;
            m.progress = (nxt.startAngle / 360) * 100;
            m.traveledDeg = 0;
            store.statusOverrides[id] = nxt.mode;
          } else if (m.lastIrrigArc) {
            // Terminou irrigando → estado "finalizada" (amarelo) com borda azul só no arco irrigado.
            store.motion[id] = {
              progress: (m.lastIrrigArc.stop / 360) * 100,
              speedPct: m.speedPct,
              dirSign: m.lastIrrigArc.dirSign,
              laminaMm: m.laminaMm,
              finished: true,
              finishedArc: m.lastIrrigArc,
            };
            store.statusOverrides[id] = "irrigacao_finalizada";
          } else {
            delete store.motion[id];
            store.statusOverrides[id] = "painel_energizado";
          }
          transitioned = true;
          return;
        }
      }

      const rt = getPivotRuntime(id);
      rt.progress = m.progress;
      rt.isRunning = true;
      rt.mode = getModeForStatus(getStatusKeyForPivot(id));
    });
    if (transitioned) refreshStatusViews(); // troca de fase: atualiza cor/legenda
    if (any) {
      rerenderMotionMap();
      _motionRaf = requestAnimationFrame(motionFrame);
    } else {
      _motionRaf = null;
      _motionLastTs = 0;
    }
  }

  function startMotionLoop() {
    if (_motionRaf != null || !hasActiveMotionPivot()) return;
    _motionLastTs = 0;
    _motionRaf = requestAnimationFrame(motionFrame);
  }

  window.IcClearSimPivotStatus = (pivotId) => {
    delete getRuntimeStore().statusOverrides[String(pivotId || "")];
    syncPivotRuntimeStates();
    refreshStatusViews();
  };

  const setPlayIcon = () => {
    if (iconPlayPause) iconPlayPause.className = "fa-solid fa-play";
    btnPlayPause?.classList.remove("is-active");
  };

  const setPauseIcon = () => {
    if (iconPlayPause) iconPlayPause.className = "fa-solid fa-pause";
    btnPlayPause?.classList.add("is-active");
  };

  function fmtDateTime(date) {
    if (!date) return "--/--/---- --:--";
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function applyPreset(key) {
    const now = new Date();
    const D = 24 * 60 * 60 * 1000;
    let end = new Date(now.getTime() + 7 * D);

    if (key === "1d") end = new Date(now.getTime() + 1 * D);
    if (key === "7d") end = new Date(now.getTime() + 7 * D);
    if (key === "15d") end = new Date(now.getTime() + 15 * D);
    if (key === "30d") end = new Date(now.getTime() + 30 * D);
    if (key === "1m") end = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate(), now.getHours(), now.getMinutes());

    state.startTime = now;
    state.endTime = end;
    state.currentTime = new Date(now);
    if (periodSel) periodSel.value = key;
    updateProgress();
  }

  function updateProgress() {
    if (!state.startTime || !state.endTime || !state.currentTime) {
      if (fill) fill.style.width = "0%";
      if (nowLabel) nowLabel.textContent = fmtDateTime(state.currentTime);
      if (progressLbl) progressLbl.textContent = "";
      return;
    }

    const total = state.endTime - state.startTime;
    const elapsed = state.currentTime - state.startTime;
    const pct = total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 0;

    if (fill) fill.style.width = `${pct}%`;
    if (nowLabel) nowLabel.textContent = fmtDateTime(state.currentTime);
    if (progressLbl) {
      progressLbl.textContent = `${fmtDateTime(state.startTime)} -> ${fmtDateTime(state.endTime)} | ${pct.toFixed(1)}%`;
    }
  }

  function computeDayDurationMin() {
    const totalSec = Number.parseFloat(speedSel?.value || "70") || 70;
    const periodMs = (state.endTime - state.startTime) || (24 * 60 * 60 * 1000);
    const simDays = periodMs / (24 * 60 * 60 * 1000);
    return (totalSec / 60) / Math.max(simDays, 1 / 1440);
  }

  function simMsPerRealMs() {
    const realMsPerSimDay = state.dayDurationMin * 60 * 1000;
    return (24 * 60 * 60 * 1000) / realMsPerSimDay;
  }

  function tick() {
    if (!state.running) return;

    const realElapsed = Date.now() - state._realStartedAt;
    const simElapsed = realElapsed * simMsPerRealMs();
    state.currentTime = new Date(state._simStartedAt.getTime() + simElapsed);

    if (state.endTime && state.currentTime >= state.endTime) {
      state.currentTime = new Date(state.endTime);
      updateProgress();
      syncPivotRuntimeStates();
      stop();
      return;
    }

    updateProgress();
    syncPivotRuntimeStates();
    window.dispatchEvent(new CustomEvent("ic:sim-tick", { detail: { time: new Date(state.currentTime) } }));
    state._raf = requestAnimationFrame(tick);
  }

  function play() {
    if (!state.startTime || !state.endTime || state.endTime <= state.startTime) return;
    if (!state.currentTime || state.currentTime >= state.endTime) state.currentTime = new Date(state.startTime);

    state.running = true;
    state._realStartedAt = Date.now();
    state._simStartedAt = new Date(state.currentTime);
    state.dayDurationMin = computeDayDurationMin();

    setPauseIcon();
    btnStop?.classList.remove("is-active");
    syncPivotRuntimeStates();
    state._raf = requestAnimationFrame(tick);
    window.dispatchEvent(new CustomEvent("ic:sim-start", { detail: { time: new Date(state.currentTime) } }));
  }

  function pause() {
    if (!state.running) return;
    cancelAnimationFrame(state._raf);
    state.running = false;
    syncPivotRuntimeStates();
    setPlayIcon();
    window.dispatchEvent(new CustomEvent("ic:sim-pause", { detail: { time: new Date(state.currentTime) } }));
  }

  function stop() {
    cancelAnimationFrame(state._raf);
    state.running = false;
    state.currentTime = state.startTime ? new Date(state.startTime) : null;

    setPlayIcon();
    if (btnStop) {
      btnStop.classList.add("is-active");
      setTimeout(() => btnStop.classList.remove("is-active"), 300);
    }

    updateProgress();
    syncPivotRuntimeStates();
    populateStatusList();
    window.dispatchEvent(new CustomEvent("ic:sim-stop"));
  }

  function getPivots() {
    const fromIc = window.icGetPivots?.();
    if (Array.isArray(fromIc)) return fromIc;

    const farm = getActiveFarm();
    if (!farm) return [];

    const items = [];
    const seen = new Set();

    (farm.equipments || []).forEach((equip) => {
      if (!isSimulatedPivotEquipment(equip) || !equip?.id || seen.has(equip.id)) return;
      seen.add(equip.id);
      items.push({
        id: equip.id,
        name: equip.name || (String(equip?.type || "").toLowerCase() === "linestar" ? "Pivo linear" : "Pivo")
      });
    });

    (farm.pivos || []).forEach((pivo) => {
      if (!pivo?.id || seen.has(pivo.id)) return;
      seen.add(pivo.id);
      items.push({ id: pivo.id, name: pivo.name || "Pivo" });
    });

    return items;
  }

  function statusOptionsHtml(selected) {
    const val = String(selected || "");
    const list = [
      { value: "painel_energizado", label: STATUS_META.painel_energizado.label },
      { value: "irrigando", label: STATUS_META.irrigando.label },
      { value: "movendo_a_seco", label: STATUS_META.movendo_a_seco.label },
      { value: "irrigacao_finalizada", label: STATUS_META.irrigacao_finalizada.label },
      { value: "painel_desligado", label: STATUS_META.painel_desligado.label },
      { value: "preparando_irrigar", label: STATUS_META.preparando_irrigar.label },
      { value: "alerta", label: STATUS_META.alerta.label },
      { value: "desligado_sem_internet", label: STATUS_META.desligado_sem_internet.label },
      { value: "ferti_irrigando", label: STATUS_META.ferti_irrigando.label }
    ];
    return list.map((it) => `<option value="${it.value}" ${val === it.value ? "selected" : ""}>${it.label}</option>`).join("");
  }

  function mapStatusFromRuntime(pivot) {
    return window.IcResolvePivotStatus?.(pivot)?.key || "painel_energizado";
  }

  function populateStatusList() {
    if (!statusListEl) return;

    const pivots = getPivots().slice().sort((a, b) => (a.name || "").localeCompare(b.name || "", "pt", { numeric: true }));
    statusListEl.innerHTML = "";

    const carreteis = (window.IcCarretelSim?.list?.() || []).slice().sort((a, b) => (a.name || "").localeCompare(b.name || "", "pt", { numeric: true }));

    if (!pivots.length && !carreteis.length) {
      statusListEl.innerHTML = '<div class="sim-bar__status-empty">Nenhum pivô ou carretel na fazenda. Crie em "Criar equipamento".</div>';
      return;
    }

    pivots.forEach((p) => {
      const initialStatus = mapStatusFromRuntime(p) || "irrigando";
      const row = document.createElement("div");
      row.className = "sim-bar__status-card";
      row.innerHTML = `
        <span class="sim-bar__status-name">${p.name || "Pivo"}</span>
        <select class="sim-bar__status-select" id="simStatusSelect-${p.id}" name="simStatusSelect-${p.id}" data-pivot-id="${p.id}">
          ${statusOptionsHtml(initialStatus)}
        </select>
      `;
      statusListEl.appendChild(row);
    });

    // DEMO: carretéis na barra de simulação
    carreteis.forEach((c) => {
      const cur = window.IcCarretelSim.getStatus(c.id);
      const hasLane = window.IcCarretelSim.hasLane(c.id);
      const opts = window.IcCarretelSim.STATUS_OPTIONS
        .map((o) => `<option value="${o.value}" ${o.value === cur ? "selected" : ""}>${o.label}</option>`).join("");
      const row = document.createElement("div");
      row.className = "sim-bar__status-card sim-bar__status-card--carretel";
      row.innerHTML = `
        <span class="sim-bar__status-name" title="Carretel"><i class="fa-solid fa-tape" aria-hidden="true"></i> ${c.name || "Carretel"}</span>
        <select class="sim-bar__status-select" data-carretel-id="${c.id}" ${hasLane ? "" : "disabled title=\"Carretel sem posição no mapa\""}>${opts}</select>
        <button type="button" class="sim-bar__carretel-reset" data-carretel-reset="${c.id}" title="Voltar o carrinho para o início" ${hasLane ? "" : "disabled"}><i class="fa-solid fa-backward-step"></i></button>
      `;
      statusListEl.appendChild(row);
    });
    statusListEl.querySelectorAll("[data-carretel-id]").forEach((sel) => {
      sel.addEventListener("change", () => window.IcCarretelSim?.setStatus(sel.getAttribute("data-carretel-id"), sel.value));
    });
    statusListEl.querySelectorAll("[data-carretel-reset]").forEach((btn) => {
      btn.addEventListener("click", () => window.IcCarretelSim?.reset(btn.getAttribute("data-carretel-reset")));
    });

    statusListEl.querySelectorAll(".sim-bar__status-select[data-pivot-id]").forEach((sel) => {
      sel.addEventListener("change", () => {
        const pid = String(sel.getAttribute("data-pivot-id") || "");
        const statusKey = sel.value;
        if (!pid) return;
        if (!statusKey) window.IcClearSimPivotStatus?.(pid);
        else window.IcSetSimPivotStatus?.(pid, statusKey);
      });
    });
  }

  function openBar() {
    state.active = true;
    bar.classList.add("is-open");
    bar.setAttribute("aria-hidden", "false");
    trigger.classList.add("is-active");
    document.body.classList.add("sim-bar-open");
    populateStatusList();
    updateProgress();
  }

  function minimizeBar() {
    state.active = false;
    bar.classList.remove("is-open");
    bar.setAttribute("aria-hidden", "true");
    trigger.classList.remove("is-active");
    document.body.classList.remove("sim-bar-open");
  }

  function closeBar() {
    pause();
    minimizeBar();
  }

  trigger.addEventListener("click", () => (state.active ? closeBar() : openBar()));
  closeBtn?.addEventListener("click", closeBar);
  minimizeBtn?.addEventListener("click", minimizeBar);

  periodSel?.addEventListener("change", () => applyPreset(periodSel.value || "7d"));
  btnPlayPause?.addEventListener("click", () => (state.running ? pause() : play()));
  btnStop?.addEventListener("click", stop);

  speedSel?.addEventListener("change", () => {
    if (state.running) {
      state._realStartedAt = Date.now();
      state._simStartedAt = new Date(state.currentTime);
      state.dayDurationMin = computeDayDurationMin();
    }
  });

  // DEMO: mantém o select do carretel em dia quando o status muda por fora (fim da faixa, modal Iniciar...)
  window.addEventListener("ic:carretel-sim-change", () => {
    if (!statusListEl) return;
    statusListEl.querySelectorAll("[data-carretel-id]").forEach((sel) => {
      const cur = window.IcCarretelSim?.getStatus(sel.getAttribute("data-carretel-id"));
      if (cur && sel.value !== cur) sel.value = cur;
    });
  });

  window.addEventListener("ic:layout-change", () => {
    if (state.active) populateStatusList();
  });

  applyPreset("7d");
  syncPivotRuntimeStates();
  populateStatusList();

  window.IcSimulation = {
    state,
    open: openBar,
    close: closeBar,
    refresh: populateStatusList
  };
})();
