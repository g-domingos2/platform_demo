// assets/js/demo-carretel-sim.js
// DEMO — simulação de carretel (Rainstar).
// Ao iniciar, o carrinho sai da posição inicial e é recolhido até o carretel:
// a faixa vai ficando azul (irrigada) e o restante segue laranja. No fim, o
// sensor de parada atua e o carretel volta para Stand-By.
// Os dados são escritos direto em equip.data (o mesmo objeto que o mapa, o
// card lateral, o tooltip e a tela de detalhes já leem) e salvos no localStorage.
(function initDemoCarretelSim() {
  "use strict";

  // 1 s real = 1000 s simulados → 400 m a 18,8 m/h levam ~77 s na tela.
  const ACCEL = 1000;
  const DEFAULT_SPEED = 18.8; // m/h
  const RENDER_EVERY_MS = 50;
  const DETAILS_EVERY_MS = 1000;
  const SAVE_EVERY_MS = 2500;

  const STATUS_OPTIONS = [
    { value: "irrigating", label: "Irrigando" },
    { value: "stopped_stop_sensor", label: "Stand-By (sensor de parada)" },
    { value: "speed_not_reached", label: "Velocidade não atingida" },
    { value: "disconnected", label: "Desconectado" },
    { value: "waiting_connection", label: "Esperando conexão" },
  ];

  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const num = (v) => {
    const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };
  function distance(a, b) {
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function activeFarm() {
    return window.IcFarmGetActive?.() || window.IcFarmActive || null;
  }
  function carreteis() {
    const farm = activeFarm();
    return (farm?.equipments || []).filter((e) => String(e?.type || "") === "rainstar" && String(e?.category || "") === "carreteis");
  }
  function findEquip(id) {
    return carreteis().find((e) => String(e.id) === String(id)) || null;
  }

  function laneInfo(d) {
    const reelLat = num(d.reelLat ?? d.lat ?? d.centerLat);
    const reelLng = num(d.reelLng ?? d.lng ?? d.centerLng);
    const startLat = num(d.startLat ?? d.initialLat ?? d.refLat);
    const startLng = num(d.startLng ?? d.initialLng ?? d.refLng);
    if ([reelLat, reelLng, startLat, startLng].some((v) => v === null)) return null;
    const length = distance({ lat: startLat, lng: startLng }, { lat: reelLat, lng: reelLng });
    return length > 2 ? { length } : null;
  }

  function fmtDuration(hours) {
    if (!Number.isFinite(hours) || hours <= 0) return "";
    const totalMin = Math.round(hours * 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? `${h}h ${String(m).padStart(2, "0")}min` : `${m}min`;
  }

  function currentProgress(d) {
    if (d.startPositionPendingIrrigation === true || d.startPositionPendingIrrigation === "true") return 0;
    const p = num(d.irrigationProgress);
    if (p === null) return 0;
    return Math.max(0, Math.min(1, p > 1 ? p / 100 : p));
  }

  function applyProgress(equip, progress) {
    const d = equip.data || (equip.data = {});
    const lane = laneInfo(d);
    const L = lane?.length || 0;
    const p = Math.max(0, Math.min(1, progress));
    d.irrigationProgress = p;
    d.irrigatedPipeLength = Math.round(p * L * 10) / 10;
    d.pulledPipeLength = Math.round((1 - p) * L * 10) / 10;
    d.hosePulledLength = d.pulledPipeLength;
    const speed = num(d.currentSpeed);
    if (d.status === "irrigating" && speed) {
      d.timeRemaining = fmtDuration(((1 - p) * L) / speed);
    }
  }

  function irrigationRateMm(d, speed) {
    const flow = num(d.flowRate ?? d.flow); // m³/h
    const width = num(d.workingWidth ?? d.width); // m
    if (!flow || !width || !speed) return null;
    return Math.round(((flow * 1000) / (speed * width)) * 100) / 100;
  }

  // ---------------------------------------------------------------- persistência
  let saveTimer = null;
  function saveNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    try {
      const farms = window.CreateFarm?.state?.farms;
      if (Array.isArray(farms) && farms.length) localStorage.setItem("ic_farms", JSON.stringify(farms));
    } catch (_) { }
  }
  function saveSoon() {
    if (!saveTimer) saveTimer = setTimeout(saveNow, SAVE_EVERY_MS);
  }

  // ---------------------------------------------------------------- render
  let lastRender = 0;
  let lastDetails = 0;
  function refreshViews(force) {
    const now = Date.now();
    if (force || now - lastRender >= RENDER_EVERY_MS) {
      lastRender = now;
      // mesmo evento usado pelo movimento dos pivôs (re-render com throttle e
      // sem atrapalhar o tooltip quando o mouse está parado em cima do mapa)
      if (force) {
        const farm = activeFarm();
        if (farm && !document.body.classList.contains("is-pluviometria")) window.IcMapRenderPivots?.(farm);
      } else {
        window.dispatchEvent(new CustomEvent("ic:pivot-motion-tick"));
      }
    }
    if (force || now - lastDetails >= DETAILS_EVERY_MS) {
      lastDetails = now;
      if (document.getElementById("carretelStatus")) {
        try { window.IcCarretel?.renderData?.(); } catch (_) { }
      }
    }
    if (force) {
      window.IcFarmsRenderEquipment?.();
      window.dispatchEvent(new CustomEvent("ic:carretel-sim-change"));
    }
  }

  // ---------------------------------------------------------------- loop
  let raf = null;
  let lastTs = 0;
  function frame(ts) {
    const dt = lastTs ? Math.min(250, ts - lastTs) : 0;
    lastTs = ts;
    let any = false;
    let changed = false;

    carreteis().forEach((equip) => {
      const d = equip.data || {};
      if (d.status !== "irrigating") return;
      const lane = laneInfo(d);
      if (!lane) return;
      any = true;
      const speed = num(d.currentSpeed) || DEFAULT_SPEED;
      const advance = ((speed * ACCEL) / 3600) * (dt / 1000); // metros
      let p = currentProgress(d) + advance / lane.length;
      // pressão oscilando levemente, pra parecer leitura real
      const baseP = num(d._demoBasePressure) || 7.2;
      d.currentPressure = Math.round((baseP + Math.sin(ts / 900) * 0.08) * 100) / 100;
      if (p >= 1) {
        finish(equip);
        changed = true;
        return;
      }
      applyProgress(equip, p);
    });

    if (changed) refreshViews(true);
    else if (any) refreshViews(false);
    if (any) saveSoon();

    if (any) raf = requestAnimationFrame(frame);
    else { raf = null; lastTs = 0; }
  }
  function ensureLoop() {
    if (raf == null) { lastTs = 0; raf = requestAnimationFrame(frame); }
  }

  // ---------------------------------------------------------------- comandos
  function start(id, opts = {}) {
    const equip = findEquip(id);
    if (!equip) return false;
    const d = equip.data || (equip.data = {});
    if (!laneInfo(d)) {
      window.IcNotify?.error?.("Este carretel não tem posição no mapa.");
      return false;
    }
    let p = currentProgress(d);
    if (p >= 0.999) p = 0; // mangueira puxada de novo → recomeça a faixa
    const speed = num(opts.speed) || num(d.currentSpeed) || DEFAULT_SPEED;
    d.status = "irrigating";
    d.statusText = "IRRIGANDO";
    d.connected = true;
    d.currentSpeed = speed;
    d._demoBasePressure = Math.max(num(d.minPressure ?? d.pressure) || 0, 6.8) + Math.random() * 0.8;
    d.currentPressure = Math.round(d._demoBasePressure * 100) / 100;
    const rate = irrigationRateMm(d, speed);
    if (rate) d.irrigationRate = rate;
    d.startPositionPendingIrrigation = false;
    d.lastCommunication = new Date().toISOString();
    applyProgress(equip, p);
    saveNow();
    refreshViews(true);
    ensureLoop();
    return true;
  }

  function finish(equip) {
    const d = equip.data || {};
    d.status = "stopped_stop_sensor";
    d.statusText = "PARADO POR SENSOR DE PARADA";
    applyProgress(equip, 1);
    d.currentSpeed = null;
    d.currentPressure = 0;
    d.timeRemaining = "";
    d.lastCommunication = new Date().toISOString();
    saveNow();
  }

  function setStatus(id, key) {
    if (key === "irrigating") return start(id);
    const equip = findEquip(id);
    if (!equip) return false;
    const d = equip.data || (equip.data = {});
    d.status = key;
    d.statusText = (STATUS_OPTIONS.find((s) => s.value === key)?.label || "").toUpperCase();
    d.connected = key !== "disconnected" && key !== "waiting_connection";
    d.signal = d.connected ? "Bom" : "Sem sinal";
    if (key === "speed_not_reached") {
      d.currentSpeed = Math.round((num(d.currentSpeed) || DEFAULT_SPEED) * 0.4 * 10) / 10;
    } else {
      d.currentSpeed = null;
      d.currentPressure = d.connected ? 0 : null;
    }
    d.timeRemaining = "";
    d.lastCommunication = new Date().toISOString();
    applyProgress(equip, currentProgress(d));
    saveNow();
    refreshViews(true);
    return true;
  }

  function stop(id) {
    return setStatus(id, "stopped_stop_sensor");
  }

  // Volta o carrinho para a posição inicial (mangueira toda puxada)
  function reset(id) {
    const equip = findEquip(id);
    if (!equip) return false;
    const d = equip.data || (equip.data = {});
    d.status = "stopped_stop_sensor";
    d.statusText = "PARADO POR SENSOR DE PARADA";
    d.currentSpeed = null;
    d.currentPressure = 0;
    d.timeRemaining = "";
    applyProgress(equip, 0);
    d.startPositionPendingIrrigation = true;
    saveNow();
    refreshViews(true);
    return true;
  }

  // Retoma carretéis que estavam irrigando antes de um reload
  setInterval(() => {
    if (raf != null) return;
    if (carreteis().some((e) => e?.data?.status === "irrigating" && laneInfo(e.data))) ensureLoop();
  }, 1000);

  window.IcCarretelSim = {
    STATUS_OPTIONS,
    DEFAULT_SPEED,
    list: carreteis,
    start,
    stop,
    reset,
    setStatus,
    getStatus: (id) => findEquip(id)?.data?.status || "stopped_stop_sensor",
    getProgress: (id) => currentProgress(findEquip(id)?.data || {}),
    hasLane: (id) => !!laneInfo(findEquip(id)?.data || {}),
  };
})();
