// assets/js/pages/telemetria/index.js
(function () {
  "use strict";

  function getFarmName() {
    const farm = window.IcFarmGetActive?.() || window.icFarmData || window.IcFarmActive || null;
    return farm?.name || farm?.nome || "Fazenda";
  }

  function getEquipments() {
    const farm = window.IcFarmGetActive?.() || window.icFarmData || window.IcFarmActive || null;
    return Array.isArray(farm?.equipments) ? farm.equipments : [];
  }

  function getPivos() {
    const farm = window.IcFarmGetActive?.() || window.icFarmData || window.IcFarmActive || null;
    const fromEquipments = getEquipments().filter(e => {
      const cat  = String(e?.category || "").toLowerCase();
      const type = String(e?.type || "").toLowerCase();
      return cat === "pivos" || cat === "pivo" || cat === "pivot" || cat === "pivots"
          || type === "smart_connect" || type === "smarttouch";
    });
    // também pega pivôs no array legado farm.pivos
    const equipIds = new Set(fromEquipments.map(e => e.id));
    const fromPivos = Array.isArray(farm?.pivos)
      ? farm.pivos
          .filter(p => !equipIds.has(p.id))
          .map(p => ({ id: p.id, name: p.name || p.nome || "Pivô", category: "pivos", type: "smart_connect", data: p }))
      : [];
    return [...fromEquipments, ...fromPivos];
  }

  function getBombasData() {
    return getEquipments().filter(e => {
      const cat = String(e?.category || "").toLowerCase();
      const type = String(e?.type || "").toLowerCase();
      return cat === "bombas" || cat === "bomba" || type === "irripump";
    });
  }

  function normalizePluvToken(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function getPluvCreatedAtTime(equipment) {
    const raw = equipment?.createdAt || equipment?.updatedAt || equipment?.data?.createdAt || "";
    const time = Date.parse(raw);
    return Number.isFinite(time) ? time : 0;
  }

  function arePluviosClose(a, b) {
    const latA = Number(a?.data?.lat);
    const lngA = Number(a?.data?.lng);
    const latB = Number(b?.data?.lat);
    const lngB = Number(b?.data?.lng);
    if (![latA, lngA, latB, lngB].every(Number.isFinite)) return false;

    const metersPerDegLat = 111320;
    const avgLatRad = ((latA + latB) / 2) * (Math.PI / 180);
    const metersPerDegLng = Math.cos(avgLatRad) * 111320;
    const dy = (latA - latB) * metersPerDegLat;
    const dx = (lngA - lngB) * metersPerDegLng;
    return Math.hypot(dx, dy) <= 30;
  }

  function dedupePluviometros(items) {
    const uniques = [];

    (Array.isArray(items) ? items : []).forEach((item) => {
      const nameKey = normalizePluvToken(item?.name || item?.nome || item?.data?.nome);
      const serialKey = normalizePluvToken(item?.data?.serial || item?.serial);
      const duplicateIndex = uniques.findIndex((candidate) => {
        const sameName = normalizePluvToken(candidate?.name || candidate?.nome || candidate?.data?.nome) === nameKey;
        const sameSerial = normalizePluvToken(candidate?.data?.serial || candidate?.serial) === serialKey;
        return sameName && sameSerial && arePluviosClose(candidate, item);
      });

      if (duplicateIndex === -1) {
        uniques.push(item);
        return;
      }

      if (getPluvCreatedAtTime(item) >= getPluvCreatedAtTime(uniques[duplicateIndex])) {
        uniques[duplicateIndex] = item;
      }
    });

    return uniques;
  }

  function getPluviometros() {
    window.Plv?.data?.syncPluviosWithFarmEquipment?.();
    const pluvs = dedupePluviometros(getEquipments().filter(e => {
      const cat = String(e?.category || "").toLowerCase();
      const type = String(e?.type || "").toLowerCase();
      return cat === "pluviometros" || cat === "pluviometro" || type === "pluviometro";
    }));

    return [...pluvs].sort((a, b) => {
      const runtimeA = findPluvRuntimeForEquipment(a) || a?.data || a;
      const runtimeB = findPluvRuntimeForEquipment(b) || b?.data || b;
      const priorityA = runtimeA?.semComunicacao ? 0 : runtimeA?.status === "rain" ? 1 : 2;
      const priorityB = runtimeB?.semComunicacao ? 0 : runtimeB?.status === "rain" ? 1 : 2;
      if (priorityA !== priorityB) return priorityA - priorityB;

      const nameA = normalizeTelemText(a?.name || a?.nome || a?.data?.nome || runtimeA?.nome || "").toLowerCase();
      const nameB = normalizeTelemText(b?.name || b?.nome || b?.data?.nome || runtimeB?.nome || "").toLowerCase();
      return nameA.localeCompare(nameB, "pt-BR");
    });
  }

  function getPluvRuntimeList() {
    return Array.isArray(window.Plv?.data?.PLUVIOS) ? window.Plv.data.PLUVIOS : [];
  }

  function getPluvMatchKeys(item) {
    return [
      item?.id,
      item?.sourceEquipId,
      item?.name,
      item?.nome,
      item?.data?.nome,
      item?.data?.serial,
      item?.serial,
    ].map(normalizePluvToken).filter(Boolean);
  }

  function findPluvRuntimeForEquipment(equipment, index = 0) {
    const runtimeList = getPluvRuntimeList();
    const equipId = String(equipment?.id || "").trim();

    if (equipId) {
      const byId = runtimeList.find((item) => {
        return String(item?.sourceEquipId || "").trim() === equipId || String(item?.id || "").trim() === equipId;
      });
      if (byId) return byId;
    }

    const matchKeys = new Set(getPluvMatchKeys(equipment));
    if (matchKeys.size) {
      const byKey = runtimeList.find((item) => getPluvMatchKeys(item).some((key) => matchKeys.has(key)));
      if (byKey) return byKey;
    }

    return window.Plv?.data?.getSharedPluvioProfile?.(equipment, index) || null;
  }

  function normalizeTelemText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function extractTelemDuration(text) {
    const raw = normalizeTelemText(text);
    if (!raw) return "";
    const match = raw.match(/\bhá\s+(.+)$/i);
    if (match) return normalizeTelemText(match[1]);
    const matchAlt = raw.match(/\bem\s+(.+)$/i);
    if (matchAlt) return normalizeTelemText(matchAlt[1]);
    return "";
  }

  function extractTelemTime(text) {
    const raw = normalizeTelemText(text);
    if (!raw) return "";
    const hhmm = raw.match(/\b(\d{1,2}:\d{2})\b/);
    if (hhmm) return hhmm[1];
    const hour = raw.match(/\b(\d{1,2})h(\d{2})?\b/i);
    if (hour) return hour[2] ? `${hour[1]}:${hour[2]}` : `${hour[1]}h`;
    return "";
  }

  function extractTelemSince(text) {
    const raw = normalizeTelemText(text);
    if (!raw) return "";
    const match = raw.match(/\bdesde\s+(.+)$/i);
    if (match) return `desde ${normalizeTelemText(match[1])}`;
    const time = extractTelemTime(raw);
    return time ? `desde ${time}` : "";
  }

  function formatTelemIntensity(intensity) {
    const raw = normalizeTelemText(intensity).toLowerCase();
    if (!raw) return "Chuva";
    if (/chuva/.test(raw)) return raw.replace(/\bchuva\b/i, "Chuva");
    return `Chuva ${raw}`;
  }

  function buildTelemRuntimeContext(runtime) {
    if (!runtime) return "";

    if (runtime.semComunicacao) {
      const offlineFor = extractTelemDuration(runtime.updated) || extractTelemDuration(runtime.statusMeta);
      return offlineFor ? `Sem comunicação há ${offlineFor}` : "Sem comunicação";
    }

    if (runtime.status === "rain") {
      const intensity = formatTelemIntensity(runtime.intensidade);
      const since = extractTelemSince(runtime.intensidadeMeta) || extractTelemSince(runtime.statusMeta);
      if (since) return `${intensity} ${since}`;
      const duration = extractTelemDuration(runtime.statusMeta);
      return duration ? `${intensity} desde ${duration}` : intensity;
    }

    const lastTime = extractTelemTime(runtime.statusMeta) || extractTelemTime(runtime.intensidadeMeta);
    if (lastTime) return `Última chuva às ${lastTime}`;
    const lastDuration = extractTelemDuration(runtime.statusMeta);
    if (lastDuration) return `Última chuva há ${lastDuration}`;
    return "Sem chuva recente";
  }

  function buildTelemRuntimeDuration(runtime) {
    const source = runtime?.status === "rain" ? runtime?.statusMeta : (runtime?.statusMeta || runtime?.updated);
    const duration = extractTelemDuration(source);
    return duration ? `em ${duration}` : "--";
  }

  function resolvePluvCardData(equipment, index) {
    const base = equipment?.data && typeof equipment.data === "object" ? equipment.data : {};
    const runtime = findPluvRuntimeForEquipment(equipment, index);
    if (!runtime) return base;

    const context = buildTelemRuntimeContext(runtime);
    const duration = buildTelemRuntimeDuration(runtime);

    return {
      ...base,
      nome: runtime.nome || base.nome || equipment?.name || equipment?.nome,
      serial: runtime.serial || base.serial || "",
      sub: runtime.sub || base.sub || base.talhao || base.nomeTalhao || "",
      pivos: Array.isArray(runtime.pivos) ? [...runtime.pivos] : base.pivos,
      status: runtime.status || base.status,
      displayMm: runtime.displayMm,
      rainMm: runtime.mm,
      mm: runtime.mm,
      rainDuration: duration,
      duration,
      rainContext: context,
      context,
      situacao: context,
      isRaining: runtime.status === "rain",
      isAlert: !!runtime.semComunicacao,
      updatedText: runtime.updated,
      battery: runtime.battery,
      net: runtime.net,
      signal: !runtime.semComunicacao,
    };
  }

  function getMedidores() {
    return getEquipments().filter(e => {
      const cat = String(e?.category || "").toLowerCase();
      const type = String(e?.type || "").toLowerCase();
      return cat === "medidores" || cat === "medidor" || type === "medidor";
    });
  }

  // Mapeia badgeClass da simulação → classe CSS do badge da sidebar
  const SIM_BADGE_CLASS_MAP = {
    "map-card__equip-badge--warn":     "telem-side__badge--warning",
    "map-card__equip-badge--info":     "telem-side__badge--info",
    "map-card__equip-badge--complete": "telem-side__badge--success",
    "map-card__equip-badge--danger":   "telem-side__badge--danger",
    "map-card__equip-badge--brown":    "telem-side__badge--brown",
    "map-card__equip-badge--gray":     "telem-side__badge--gray",
  };

  function resolvePivotBadge(p) {
    const defaultRes = { text: "PAINEL ENERGIZADO", cls: "telem-side__badge--warning", iconCls: "gestao-op__timeline-icon--yellow" };
    const resolved = window.IcResolvePivotStatus?.(p);
    if (!resolved) return defaultRes;
    const pct = window.IcPivotSimulationRuntime?.states?.[String(p.id || "")]?.progress ?? 0;
    const showPct = pct > 0;
    const text = resolved.badgeText + (showPct ? ` - ${Math.round(pct)}%` : "");
    const cls = SIM_BADGE_CLASS_MAP[resolved.badgeClass] || "telem-side__badge--warning";
    
    let iconCls = "gestao-op__timeline-icon--yellow";
    if (cls === "telem-side__badge--danger") iconCls = "gestao-op__timeline-icon--red";
    else if (cls === "telem-side__badge--info") iconCls = "gestao-op__timeline-icon--blue";
    else if (cls === "telem-side__badge--success") iconCls = "gestao-op__timeline-icon--green";
    else if (cls === "telem-side__badge--brown") iconCls = "telem-timeline__icon--brown";
    else if (cls === "telem-side__badge--gray") iconCls = "telem-timeline__icon--gray";

    return { text, cls, iconCls };
  }

  function getPivotPriority(p) {
    const resolved = window.IcResolvePivotStatus?.(p);
    const key = resolved?.key || "painel_energizado";
    if (key === "alerta" || key === "desligado_sem_internet") return 1;
    if (key === "irrigando" || key === "ferti_irrigando") return 2;
    return 3;
  }

  function getBombaPriority(b) {
    const st = String(b?.status || b?.data?.status || "").toLowerCase();
    if (st.includes("alert") || st.includes("erro") || st.includes("falha")) return 1;
    if (st.includes("rodando") || st.includes("on") || st.includes("ligad") || st.includes("irrig") || st.includes("bombeando")) return 2;
    return 3;
  }

  function getCombinedPriority(item) {
    if (item?.kind === "bomba") return getBombaPriority(item.data);
    return getPivotPriority(item?.data);
  }

  function getPivotCard(p, farmName) {
    const { text: badgeText, cls: badgeCls, iconCls } = resolvePivotBadge(p);
    return `
      <div class="telem-side__item" data-pivot-id="${p.id}" data-equip-kind="pivo" data-priority="${getPivotPriority(p)}">
        <div class="telem-side__card-header">
          <div class="telem-side__card-icon">
            <div class="gestao-op__timeline-icon is-pivot ${iconCls}"></div>
          </div>
          <div class="telem-side__card-info">
              <div class="telem-side__title-group">
                <div class="telem-side__title-main">
                  <span class="telem-side__name">${p.name || p.nome || "Pivô"}</span>
                  <span class="telem-side__badge ${badgeCls}">${badgeText}</span>
                </div>
                <div class="telem-side__card-subtitle">${farmName}</div>
              </div>
          </div>
        </div>
        <div class="telem-side__card-actions">
          <button class="telem-side__action-btn telem-side__action-btn--start js-start-equip" type="button" aria-label="Iniciar pivô" title="Iniciar pivô">
            <img src="./assets/img/svg/circle-play.svg" alt="Iniciar" class="telem-side__action-icon telem-side__action-icon--play" />
            <span>Iniciar Pivô</span>
          </button>
          <button class="telem-side__action-btn telem-side__action-btn--stop js-stop-equip" type="button" aria-label="Parar pivô" title="Parar pivô">
            <img src="./assets/img/svg/pause.svg" alt="Parar" class="telem-side__action-icon telem-side__action-icon--pause" />
            <span>Parar Pivô</span>
          </button>
        </div>
      </div>`;
  }

  function getBombaCard(b, farmName) {
    const nome = b.name || b.nome || b.data?.nome || "Bomba";
    return `
      <div class="telem-side__item" data-equip-kind="bomba" data-priority="${getBombaPriority(b)}">
        <div class="telem-side__card-header">
          <div class="telem-side__card-icon">
            <div class="gestao-op__timeline-icon gestao-op__timeline-icon--blue telem-side__icon--pump">
              <img src="./assets/img/svg/pump.svg" alt="Bomba">
            </div>
          </div>
          <div class="telem-side__card-info">
              <div class="telem-side__title-group">
                <div class="telem-side__title-main">
                  <span class="telem-side__name">${nome}</span>
                  <span class="telem-side__badge telem-side__badge--danger">PARADA</span>
                </div>
                <div class="telem-side__card-subtitle">${farmName}</div>
              </div>
          </div>
        </div>
        <div class="telem-side__card-actions">
          <button class="telem-side__action-btn telem-side__action-btn--start js-start-equip" type="button" aria-label="Ligar bomba" title="Ligar bomba">
            <img src="./assets/img/svg/circle-play.svg" alt="Ligar" class="telem-side__action-icon telem-side__action-icon--play" />
            <span>Ligar Bomba</span>
          </button>
          <button class="telem-side__action-btn telem-side__action-btn--stop js-stop-equip" type="button" aria-label="Parar bomba" title="Parar bomba">
            <img src="./assets/img/svg/pause.svg" alt="Parar" class="telem-side__action-icon telem-side__action-icon--pause" />
            <span>Parar Bomba</span>
          </button>
        </div>
      </div>`;
  }


  function mountUnifiedSidebar() {
    if (document.getElementById("telemSidebar")) return;

    const farmName = getFarmName();
    const pivos = getPivos();
    const bombas = getBombasData();
    const equipments = [
      ...pivos.map((p) => ({ kind: "pivo", name: p.name || p.nome || "Pivo", data: p })),
      ...bombas.map((b) => ({ kind: "bomba", name: b.name || b.nome || b.data?.nome || "Bomba", data: b })),
    ].sort((a, b) => {
      const pA = getCombinedPriority(a);
      const pB = getCombinedPriority(b);
      if (pA !== pB) return pA - pB;
      if (a.kind !== b.kind) return a.kind === "pivo" ? -1 : 1;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

    const equipmentRows = equipments.length
      ? equipments.map((item) => (item.kind === "bomba"
        ? getBombaCard(item.data, farmName)
        : getPivotCard(item.data, farmName))).join("")
      : `<div class="telem-side__empty">Nenhum equipamento cadastrado</div>`;

    const wrapper = document.createElement("div");
    wrapper.id = "telemSidebar";
    wrapper.className = "telem-sidebar";
    wrapper.innerHTML = `
      <div class="telem-sidebar__panel">
        <div class="telem-side__header">
          <div class="telem-side__filters" role="tablist" aria-label="Filtrar equipamentos">
            <button type="button" class="telem-side__filter is-active" data-filter="all" aria-pressed="true">
              <span>Todos</span>
              <span class="telem-side__filter-count">${equipments.length}</span>
            </button>
            <button type="button" class="telem-side__filter" data-filter="pivo" aria-pressed="false">
              <span>Piv&ocirc;s</span>
              <span class="telem-side__filter-count">${pivos.length}</span>
            </button>
            <button type="button" class="telem-side__filter telem-side__filter--blue" data-filter="bomba" aria-pressed="false">
              <span>Bombas</span>
              <span class="telem-side__filter-count">${bombas.length}</span>
            </button>
          </div>
          <span class="telem-side__count telem-side__count--gray">${equipments.length}</span>
        </div>
        <div class="telem-side__list">${equipmentRows}</div>
      </div>
    `;

    const _row = getTelemMapRow();
    if (_row) _row.insertBefore(wrapper, _row.querySelector(".map"));

    wrapper.querySelectorAll("[data-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const filter = btn.dataset.filter || "all";
        wrapper.querySelectorAll("[data-filter]").forEach((item) => {
          const active = item === btn;
          item.classList.toggle("is-active", active);
          item.setAttribute("aria-pressed", active ? "true" : "false");
        });

        wrapper.querySelectorAll(".telem-side__item").forEach((item) => {
          const kind = item.dataset.equipKind || "pivo";
          item.hidden = !(filter === "all" || filter === kind);
        });
      });
    });
  }

  function getTelemMapRow() {
    let row = document.getElementById("telemMapRow");
    if (row) return row;
    const mapEl = document.querySelector(".map");
    const mainMap = document.querySelector(".main--map");
    if (!mapEl || !mainMap) return null;
    row = document.createElement("div");
    row.id = "telemMapRow";
    row.className = "telem-map-row";
    mainMap.insertBefore(row, mapEl);
    row.appendChild(mapEl);
    return row;
  }

  function mountSidebar() {
    mountUnifiedSidebar();
    return;
    if (document.getElementById("telemSidebar")) return;

    const farmName = getFarmName();
    const pivos = getPivos();
    const bombas = getBombasData();

    pivos.sort((a, b) => {
      const pA = getPivotPriority(a);
      const pB = getPivotPriority(b);
      if (pA !== pB) return pA - pB;
      return (a.name || a.nome || "").localeCompare(b.name || b.nome || "");
    });

    bombas.sort((a, b) => {
      const pA = getBombaPriority(a);
      const pB = getBombaPriority(b);
      if (pA !== pB) return pA - pB;
      return (a.name || a.nome || "").localeCompare(b.name || b.nome || "");
    });

    const pivoRows = pivos.length
      ? pivos.map(p => getPivotCard(p, farmName)).join("")
      : `<div class="telem-side__empty">Nenhum pivô cadastrado</div>`;

    const bombaRows = bombas.length
      ? bombas.map(b => getBombaCard(b, farmName)).join("")
      : `<div class="telem-side__empty">Nenhuma bomba cadastrada</div>`;

    const wrapper = document.createElement("div");
    wrapper.id = "telemSidebar";
    wrapper.className = "telem-sidebar";
    wrapper.innerHTML = `
      <div class="telem-sidebar__panel">
        <div class="telem-side__header">
          <span class="telem-side__title">Pivôs</span>
          <span class="telem-side__count">${pivos.length}</span>
        </div>
        <div class="telem-side__list">${pivoRows}</div>
      </div>
      <div class="telem-sidebar__divider"></div>
      <div class="telem-sidebar__panel">
        <div class="telem-side__header">
          <span class="telem-side__title">Bombas</span>
          <span class="telem-side__count telem-side__count--blue">${bombas.length}</span>
        </div>
        <div class="telem-side__list">${bombaRows}</div>
      </div>
    `;

    const _row = getTelemMapRow();
    if (_row) _row.insertBefore(wrapper, _row.querySelector(".map"));
  }

  function destroySidebar() {
    document.getElementById("telemSidebar")?.remove();
  }

  // Atualiza os badges dos pivôs no sidebar conforme o estado da simulação
  function refreshSidebarBadges() {
    const sidebar = document.getElementById("telemSidebar");
    if (!sidebar) return;
    const pivos = getPivos();
    sidebar.querySelectorAll("[data-pivot-id]").forEach(item => {
      const pivot = pivos.find(p => String(p.id) === item.dataset.pivotId);
      if (!pivot) return;
      const badge = item.querySelector(".telem-side__badge");
      if (!badge) return;
      const { text, cls, iconCls } = resolvePivotBadge(pivot);
      badge.textContent = text;
      badge.className = `telem-side__badge ${cls}`;
      
      const icon = item.querySelector(".gestao-op__timeline-icon.is-pivot");
      if (icon) {
        icon.className = `gestao-op__timeline-icon is-pivot ${iconCls}`;
      }
      
      item.dataset.priority = getPivotPriority(pivot);
    });

    const pivoList = sidebar.querySelector(".telem-side__list");
    if (pivoList) {
      const items = Array.from(pivoList.querySelectorAll(".telem-side__item"));
      if (items.length > 0) {
        items.sort((a, b) => {
          const pA = parseInt(a.dataset.priority || "3", 10);
          const pB = parseInt(b.dataset.priority || "3", 10);
          if (pA !== pB) return pA - pB;
          const kindA = a.dataset.equipKind || "pivo";
          const kindB = b.dataset.equipKind || "pivo";
          if (kindA !== kindB) return kindA === "pivo" ? -1 : 1;
          return 0;
        });
        items.forEach(node => pivoList.appendChild(node));
      }
    }
  }

  let _simTickThrottle = 0;
  function onSimTick(e) {
    const now = Date.now();
    if (now - _simTickThrottle < 500) return; // max 2fps
    _simTickThrottle = now;
    refreshSidebarBadges();
    refreshTimeline(e?.detail?.time ?? null);
  }

  function onSimStatusChange() {
    refreshSidebarBadges();
    invalidateTimeline();
    destroyTimelineSidebar();
    mountTimelineSidebar();
  }

  function buildTimelineRows(items) {
    return items.map(item => {
      const c = COLOR_MAP[item.color] || COLOR_MAP.yellow;
      return `
        <div class="telem-tl__item">
          <div class="telem-tl__icon-wrap">
            <div class="gestao-op__timeline-icon is-pivot ${c.cls}"></div>
          </div>
          <div class="telem-tl__body">
            <div class="telem-tl__top">
              <span class="telem-tl__name">${item.name}</span>
              <span class="telem-side__badge ${c.badge}">${item.status} <i class="fa-solid fa-rotate"></i></span>
            </div>
            <div class="telem-tl__sub"><strong>${item.farm}</strong> <span class="telem-tl__date">| ${item.date}</span></div>
          </div>
        </div>`;
    }).join("");
  }

  // Histórico de eventos por status — progride de mais recente para mais antigo
  const STATUS_HISTORY_TEMPLATES = {
    irrigacao_finalizada: [
      { status: "IRRIGAÇÃO FINALIZADA - 100,00%", color: "yellow" },
      { status: "MOVENDO A SECO - 100,00%",       color: "brown"  },
      { status: "IRRIGANDO - 100,00%",             color: "blue"   },
    ],
    irrigando: [
      { status: "IRRIGANDO - 80,00%",              color: "blue"   },
      { status: "MOVENDO A SECO - 75,00%",         color: "brown"  },
      { status: "ESPERANDO TEMPO DE RETARDO",      color: "blue"   },
    ],
    ferti_irrigando: [
      { status: "FERTIRRIGANDO - 80,00%",          color: "blue"   },
      { status: "MOVENDO A SECO - 75,00%",         color: "brown"  },
    ],
    painel_energizado: [
      { status: "PAINEL ENERGIZADO - 100,00%",     color: "yellow" },
    ],
    painel_desligado: [
      { status: "PAINEL DESLIGADO - 100,00%",      color: "yellow" },
      { status: "IRRIGAÇÃO FINALIZADA - 100,00%",  color: "yellow" },
    ],
    preparando_irrigar: [
      { status: "ESPERANDO TEMPO DE RETARDO",      color: "blue"   },
      { status: "MOVENDO A SECO - 100,00%",        color: "brown"  },
    ],
    alerta: [
      { status: "DESALINHADO - 100,00%",           color: "red"    },
      { status: "IRRIGANDO - 62,50%",              color: "blue"   },
    ],
    desligado_sem_internet: [
      { status: "PIVÔ DESLIGADO / SEM INTERNET",   color: "gray"   },
      { status: "MOVENDO A SECO - 100,00%",        color: "brown"  },
    ],
  };

  const TL_DATE_MONTHS = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

  function formatTlDate(d) {
    const pad = n => String(n).padStart(2, "0");
    return `${d.getDate()} ${TL_DATE_MONTHS[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // Connect existing static filter buttons (if present in HTML) to filter the .telem-side__item cards
  function attachStaticFilters() {
    document.querySelectorAll('.telem-side__filters').forEach((filters) => {
      const panel = filters.closest('.telem-sidebar__panel') || filters.parentElement;
      const list = panel ? panel.querySelector('.telem-side__list') : null;
      const buttons = Array.from(filters.querySelectorAll('[data-filter]'));
      if (buttons.length === 0 || !list) return;

      buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const filter = String(btn.dataset.filter || 'all');

          // toggle active state on buttons
          buttons.forEach((b) => {
            const active = b === btn;
            b.classList.toggle('is-active', active);
            b.setAttribute('aria-pressed', active ? 'true' : 'false');
          });

          // show/hide items in the same panel list
          list.querySelectorAll('.telem-side__item').forEach((item) => {
            const kind = item.getAttribute('data-equip-kind') || item.getAttribute('data-pivot-id') ? 'pivo' : '';
            // if data-equip-kind exists use it, fallback to 'pivo' for pivot items
            const itemKind = item.getAttribute('data-equip-kind') || (item.getAttribute('data-pivot-id') ? 'pivo' : '');
            item.hidden = !(filter === 'all' || filter === itemKind);
          });
        });
      });
    });
  }

  // run on initial load for static markup
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachStaticFilters);
  } else {
    attachStaticFilters();
  }

  let _timelineCache = null;

  function getTimelinePriority(item) {
    if (item.color === "red" || item.color === "gray" || String(item.status).toLowerCase().includes("alerta") || String(item.status).toLowerCase().includes("desalinhado") || String(item.status).toLowerCase().includes("sem internet")) return 1;
    if (item.color === "blue" || String(item.status).toLowerCase().includes("irrigando") || String(item.status).toLowerCase().includes("fertirrigando")) return 2;
    return 3;
  }

  function buildFarmTimeline() {
    const pivos    = getPivos();
    const farmName = getFarmName();
    if (!pivos.length) return [];

    const MS_HOUR = 3600000;
    const base    = new Date();
    const events  = [];
    let   cursor  = base.getTime();

    pivos.forEach(pivot => {
      const resolved  = window.IcResolvePivotStatus?.(pivot);
      const key       = resolved?.key || "painel_energizado";
      const templates = STATUS_HISTORY_TEMPLATES[key] || STATUS_HISTORY_TEMPLATES.painel_energizado;
      const name      = pivot.name || pivot.nome || "Pivô";
      const tpl       = templates[0]; // apenas o status atual (1 entrada por pivô)

      const gap = Math.random() * MS_HOUR;
      cursor -= gap;
      const d = new Date(cursor);
      events.push({
        name,
        farm:   farmName,
        status: tpl.status,
        color:  tpl.color,
        date:   formatTlDate(d),
        _date:  d,
      });

      cursor -= (2 + Math.random() * 4) * MS_HOUR;
    });

    return events.sort((a, b) => {
      const pA = getTimelinePriority(a);
      const pB = getTimelinePriority(b);
      if (pA !== pB) return pA - pB;
      return b._date - a._date;
    });
  }

  function getTimeline() {
    if (!_timelineCache) _timelineCache = buildFarmTimeline();
    return _timelineCache;
  }

  function invalidateTimeline() {
    _timelineCache = null;
    _tlLastCount = -1;
  }

  const COLOR_MAP = {
    yellow: { cls: "gestao-op__timeline-icon--yellow", badge: "telem-side__badge--warning" },
    brown:  { cls: "telem-timeline__icon--brown",      badge: "telem-side__badge--brown" },
    red:    { cls: "gestao-op__timeline-icon--red",    badge: "telem-side__badge--danger" },
    blue:   { cls: "gestao-op__timeline-icon--blue",   badge: "telem-side__badge--info" },
    gray:   { cls: "telem-timeline__icon--gray",       badge: "telem-side__badge--gray" },
  };

  function mountTimelineSidebar() {
    if (document.getElementById("telemTimeline")) return;

    const el = document.createElement("div");
    el.id = "telemTimeline";
    el.className = "telem-timeline-sidebar";
    el.innerHTML = `
      <div class="telem-side__header">
        <span class="telem-side__title">Linha do Tempo</span>
        <span class="telem-side__count telem-side__count--gray">${getTimeline().length}</span>
      </div>
      <div class="telem-tl__list">${buildTimelineRows(getTimeline())}</div>
    `;

    const _row2 = getTelemMapRow();
    if (_row2) _row2.appendChild(el);
  }

  let _tlLastCount = -1;

  function refreshTimeline(simTime) {
    const el = document.getElementById("telemTimeline");
    if (!el) return;

    const tl = getTimeline();
    const visible = simTime
      ? tl.filter(item => item._date <= simTime)
      : tl;

    if (visible.length === _tlLastCount) return; // sem mudança
    _tlLastCount = visible.length;

    const list     = el.querySelector(".telem-tl__list");
    const countEl  = el.querySelector(".telem-side__count");
    if (list)    list.innerHTML = buildTimelineRows(visible);
    if (countEl) countEl.textContent = visible.length;
  }

  function onSimStop() {
    _tlLastCount = -1;
    refreshTimeline(null); // restaura tudo
  }

  function destroyTimelineSidebar() {
    document.getElementById("telemTimeline")?.remove();
  }

  function makePluvCard(p, idx) {
    const d       = resolvePluvCardData(p, idx);
    const nome    = p.name || p.nome || d.nome || `Pluviômetro ${idx + 1}`;
    const uid     = `tl-pluv-${p.id || idx}`;
    const expandId = `pluv-card-expand-${uid}`;

    // Rain state
    const mmRaw     = d.displayMm ?? d.rainMm ?? d.mm ?? d.acumulado ?? null;
    const mmVal     = typeof mmRaw === "string"
      ? (normalizeTelemText(mmRaw) || "--")
      : (mmRaw !== null && mmRaw !== undefined ? Number(mmRaw).toFixed(1) : "--");
    const duration  = d.rainDuration || d.duration || d.duracao || "--";
    const context   = d.rainContext  || d.context  || d.situacao || (mmRaw !== null ? "Chuva detectada" : "Sem dados de chuva");
    const isRaining = d.isRaining    || d.raining  || d.chovendo || false;
    const isAlert   = d.isAlert      || d.alerta   || false;
    const isDry     = d.status === "dry";

    // Footline
    const updatedRaw = normalizeTelemText(d.updatedText || d.updatedLabel || d.updated || d.updatedAt || d.lastUpdate || d.updated_at || "");
    const updatedLabel = updatedRaw
      ? (/^(atualizado|offline|aguardando|sem )/i.test(updatedRaw) ? updatedRaw : `Atualizado ${updatedRaw}`)
      : "Aguardando dados";

    // Telemetry
    const bat     = parseInt(d.battery ?? d.bateria ?? 0, 10);
    const batCls  = bat >= 60 ? "is-high" : bat >= 30 ? "is-mid" : "is-low";
    const batPct  = bat > 0 ? bat : 50;
    const signalRaw = d.signal ?? d.sinal;
    const signal  = typeof signalRaw === "boolean" ? signalRaw : true;
    const signalTitle = normalizeTelemText(d.net || d.signalLabel || (signal ? "4G" : "Sem comunicação")) || (signal ? "4G" : "Sem comunicação");

    // Card classes
    const cardCls = ["pluv-card card"];
    if (isRaining) cardCls.push("pluv-card--rain");
    if (isAlert)   cardCls.push("pluv-card--alert");
    if (isDry)     cardCls.push("pluv-card--dry");

    // Pill
    const pillCls  = isRaining ? "pluv-card__pill" : isAlert ? "pluv-card__pill pluv-card__pill--alert" : "pluv-card__pill pluv-card__pill--ghost";
    const pillText = isRaining ? "Chovendo agora" : isAlert ? "Sem comunicação" : "&nbsp;";

    return `
      <article class="${cardCls.join(" ")}" data-pluv-card="" data-id="${uid}" aria-expanded="false">
        <div class="pluv-card__row">
          <div class="pluv-card__main">
            <div class="pluv-card__title"><span class="pluv-card__name">${nome}</span></div>
            <div class="pluv-card__rain-context">${context}</div>
          </div>
          <div class="pluv-card__right">
            <div class="pluv-card__mm-block">
              <span class="pluv-card__mm-ico">
                <svg class="pluv-mm-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/>
                  <path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/>
                </svg>
              </span>
              <div class="pluv-card__mm-text">
                <div class="pluv-card__mm"><span class="pluv-card__mm-val">${mmVal}</span><span class="pluv-card__mm-unit">mm</span></div>
                <div class="pluv-card__duration">${duration}</div>
              </div>
            </div>
            <button class="pluv-card__toggle" type="button" data-card-toggle="" aria-label="Mostrar detalhes" aria-expanded="false" aria-controls="${expandId}">
              <i class="fa-solid fa-chevron-down"></i>
            </button>
          </div>
        </div>
        <span class="${pillCls}">${isAlert ? "OFFLINE" : pillText}</span>
        <div class="pluv-card__footline">
          <div class="pluv-card__updated">
            <i class="fa-solid fa-clock pluv-card__clock" aria-hidden="true"></i>
            <span>${updatedLabel}</span>
          </div>
          <div class="pluv-card__telemetry">
            <span class="pluv-card__signal ${signal ? 'is-on' : 'is-off'}" title="${signalTitle}">
              <i class="fa-solid fa-wifi"></i>
            </span>
            <span class="pluv-card__battery ${batCls}" style="--battery-level: ${batPct}%;" title="Bateria ${batPct}%" aria-label="Bateria ${batPct}%">
              <span class="pluv-card__battery-fill"></span>
            </span>
          </div>
        </div>
        <div class="pluv-card__expand" id="${expandId}">
          <div class="pluv-card__divider"></div>
          <div class="pluv-card__context">
              ${/* try to show talhão / local name similar to pluviometria cards */ ""}
              <div class="pluv-card__context-line">
                <i class="fa-solid fa-location-dot" aria-hidden="true"></i>
                <span><span>Talhão:</span> ${d.sub || d.talhao || d.nomeTalhao || '----'}</span>
              </div>
              <div class="pluv-card__context-line">
                <i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i>
                <span>Impacta: ${Array.isArray(d.pivos) ? d.pivos.join(', ') : (typeof d.pivos === 'string' && d.pivos ? d.pivos : '—')}</span>
              </div>
            </div>
        </div>
      </article>`;
  }

  function makeMedidorCard(m, idx) {
    const nome    = m.name || m.nome || m.data?.nome || `Medidor ${idx + 1}`;
    const level   = parseInt(m.data?.levelPercent || 0, 10);
    const tipo    = m.data?.funcParams?.nivel || "Poço";
    const color   = level >= 60 ? "#22c55e" : level >= 30 ? "#f59e0b" : "#ef4444";
    const levelLabel = level > 0 ? `${level}%` : "--";
    return `
      <div class="telem-level-card" style="--level:${level}%; --level-color:${color};">
        <div class="telem-level-card__head">
          <span class="telem-level-card__name">${nome}</span>
        </div>
        <div class="telem-level-card__body">
          <div class="telem-level-card__meta">
            <div>Tipo: <strong>${tipo}</strong></div>
            <div>Nível: <strong>${level > 0 ? level + "%" : "--"}</strong></div>
          </div>
          <div class="telem-level-card__gauge-wrap">
            <span class="telem-level-card__pct">${levelLabel}</span>
            <div class="telem-level-card__gauge-box">
              <div class="telem-level-card__gauge"><span class="telem-level-card__gauge-fill"></span></div>
            </div>
          </div>
        </div>
        <div class="telem-level-card__foot">
          <span class="telem-level-card__foot-label"><i class="fa-solid fa-clock"></i> Aguardando dados</span>
          <span class="telem-level-card__signal is-on"><i class="fa-solid fa-wifi"></i></span>
        </div>
      </div>`;
  }

  function syncBottomBarHeight(barEl) {
    if (!barEl) return;

    const baseHeight = 118;
    const panels = [...barEl.querySelectorAll(".telem-bottom-panel")];

    const nextHeight = panels.reduce((maxHeight, panel) => {
      const header = panel.querySelector(".telem-side__header");
      const list = panel.querySelector(".telem-bottom-panel__list");
      if (!list) return maxHeight;

      const listStyles = window.getComputedStyle(list);
      const listPadTop = parseFloat(listStyles.paddingTop) || 0;
      const listPadBottom = parseFloat(listStyles.paddingBottom) || 0;
      const tallestCard = [...list.children].reduce((cardMax, item) => {
        return Math.max(cardMax, item.scrollHeight || item.offsetHeight || 0);
      }, 0);

      const panelHeight = (header?.offsetHeight || 0) + listPadTop + listPadBottom + tallestCard + 3;
      return Math.max(maxHeight, panelHeight);
    }, baseHeight);

    const resolvedHeight = `${Math.ceil(nextHeight)}px`;
    barEl.style.setProperty("--telem-bottom-h", resolvedHeight);

    const mapEl = barEl.closest(".map");
    if (mapEl) {
      mapEl.style.setProperty("--telem-bottom-h", resolvedHeight);
    }
  }

  function mountBottomSidebars() {
    if (document.getElementById("telemBottom")) return;

    const pluvs  = getPluviometros();
    const medids = getMedidores();

    const pluvRows = pluvs.length
      ? pluvs.map((p, i) => makePluvCard(p, i)).join("")
      : `<div class="telem-side__empty" style="color:#64748b;padding:12px;">Nenhum pluviômetro cadastrado</div>`;

    const medRows = medids.length
      ? medids.map((m, i) => makeMedidorCard(m, i)).join("")
      : `<div class="telem-side__empty" style="color:#64748b;padding:12px;">Nenhum medidor cadastrado</div>`;

    const el = document.createElement("div");
    el.id = "telemBottom";
    el.className = "telem-bottom-bar";
    el.innerHTML = `
      <div class="telem-bottom-panel">
        <div class="telem-side__header">
          <span class="telem-side__title">Pluviômetros</span>
          <span class="telem-side__count telem-side__count--blue">${pluvs.length}</span>
        </div>
        <div class="telem-bottom-panel__list">
          <article class="pluv-card card pluv-card--rain" data-pluv-card="" data-id="norte-a" aria-expanded="false">
            <div class="pluv-card__row">
              <div class="pluv-card__main">
                <div class="pluv-card__title"><span class="pluv-card__name">Pluviômetro Norte A</span></div>
                <div class="pluv-card__rain-context">Chuva moderada desde 07h</div>
              </div>
              <div class="pluv-card__right">
                <div class="pluv-card__mm-block">
                  <span class="pluv-card__mm-ico"><svg class="pluv-mm-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"></path><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"></path></svg></span>
                  <div class="pluv-card__mm-text">
                    <div class="pluv-card__mm"><span class="pluv-card__mm-val">12.5</span><span class="pluv-card__mm-unit">mm</span></div>
                    <div class="pluv-card__duration">em 45 min</div>
                  </div>
                </div>
                <button class="pluv-card__toggle" type="button" data-card-toggle="" aria-label="Mostrar detalhes" aria-expanded="false" aria-controls="telem-pluv-expand-norte-a"><i class="fa-solid fa-chevron-down"></i></button>
              </div>
            </div>
            <span class="pluv-card__pill">Chovendo agora</span>
            <div class="pluv-card__footline">
              <div class="pluv-card__updated"><i class="fa-solid fa-clock pluv-card__clock" aria-hidden="true"></i><span>Atualizado há 32 min</span></div>
              <div class="pluv-card__telemetry">
                <span class="pluv-card__signal is-on" title="4G"><i class="fa-solid fa-wifi"></i></span>
                <span class="pluv-card__battery is-high is-charging" style="--battery-level: 92%;" title="Bateria 92% (carregando)" aria-label="Bateria 92% carregando"><span class="pluv-card__battery-fill"></span><i class="fa-solid fa-bolt pluv-card__battery-charge" aria-hidden="true"></i></span>
              </div>
            </div>
            <div class="pluv-card__expand" id="telem-pluv-expand-norte-a">
              <div class="pluv-card__divider"></div>
              <div class="pluv-card__context">
                <div class="pluv-card__context-line"><i class="fa-solid fa-location-dot" aria-hidden="true"></i><span>Talhão Norte</span></div>
                <div class="pluv-card__context-line"><i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i><span>Impacta: Pivô 1, Pivô 2</span></div>
              </div>
            </div>
          </article>
          <article class="pluv-card card pluv-card--rain" data-pluv-card="" data-id="norte-b" aria-expanded="false">
            <div class="pluv-card__row">
              <div class="pluv-card__main">
                <div class="pluv-card__title"><span class="pluv-card__name">Pluviômetro Norte B</span></div>
                <div class="pluv-card__rain-context">Chuva moderada desde 18:14</div>
              </div>
              <div class="pluv-card__right">
                <div class="pluv-card__mm-block">
                  <span class="pluv-card__mm-ico"><svg class="pluv-mm-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"></path><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"></path></svg></span>
                  <div class="pluv-card__mm-text">
                    <div class="pluv-card__mm"><span class="pluv-card__mm-val">10.8</span><span class="pluv-card__mm-unit">mm</span></div>
                    <div class="pluv-card__duration">em 12 min</div>
                  </div>
                </div>
                <button class="pluv-card__toggle" type="button" data-card-toggle="" aria-label="Mostrar detalhes" aria-expanded="false" aria-controls="telem-pluv-expand-norte-b"><i class="fa-solid fa-chevron-down"></i></button>
              </div>
            </div>
            <span class="pluv-card__pill">Chovendo agora</span>
            <div class="pluv-card__footline">
              <div class="pluv-card__updated"><i class="fa-solid fa-clock pluv-card__clock" aria-hidden="true"></i><span>Atualizado há 2 min</span></div>
              <div class="pluv-card__telemetry">
                <span class="pluv-card__signal is-on" title="RADIO"><i class="fa-solid fa-wifi"></i></span>
                <span class="pluv-card__battery is-high" style="--battery-level: 76%;" title="Bateria 76%" aria-label="Bateria 76%"><span class="pluv-card__battery-fill"></span></span>
              </div>
            </div>
            <div class="pluv-card__expand" id="telem-pluv-expand-norte-b">
              <div class="pluv-card__divider"></div>
              <div class="pluv-card__context">
                <div class="pluv-card__context-line"><i class="fa-solid fa-location-dot" aria-hidden="true"></i><span>Talhão Norte</span></div>
                <div class="pluv-card__context-line"><i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i><span>Impacta: Pivô 3, Pivô 4</span></div>
              </div>
            </div>
          </article>
          <article class="pluv-card card pluv-card--alert" data-pluv-card="" data-id="sul" aria-expanded="false">
            <div class="pluv-card__row">
              <div class="pluv-card__main">
                <div class="pluv-card__title"><span class="pluv-card__name">Pluviômetro Sul</span></div>
                <div class="pluv-card__rain-context">Sem comunicação há 1 dia</div>
              </div>
              <div class="pluv-card__right">
                <div class="pluv-card__mm-block">
                  <span class="pluv-card__mm-ico"><svg class="pluv-mm-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"></path><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"></path></svg></span>
                  <div class="pluv-card__mm-text">
                    <div class="pluv-card__mm"><span class="pluv-card__mm-val">0.0</span><span class="pluv-card__mm-unit">mm</span></div>
                    <div class="pluv-card__duration">em 6h</div>
                  </div>
                </div>
                <button class="pluv-card__toggle" type="button" data-card-toggle="" aria-label="Mostrar detalhes" aria-expanded="false" aria-controls="telem-pluv-expand-sul"><i class="fa-solid fa-chevron-down"></i></button>
              </div>
            </div>
            <span class="pluv-card__pill pluv-card__pill--alert">Sem comunicação</span>
            <div class="pluv-card__footline">
              <div class="pluv-card__updated"><i class="fa-solid fa-clock pluv-card__clock" aria-hidden="true"></i><span>Offline há 1 dia</span></div>
              <div class="pluv-card__telemetry">
                <span class="pluv-card__signal is-off" title="Sem comunicação"><i class="fa-solid fa-wifi"></i></span>
                <span class="pluv-card__battery is-low" style="--battery-level: 14%;" title="Bateria 14%" aria-label="Bateria 14%"><span class="pluv-card__battery-fill"></span></span>
              </div>
            </div>
            <div class="pluv-card__expand" id="telem-pluv-expand-sul">
              <div class="pluv-card__divider"></div>
              <div class="pluv-card__context">
                <div class="pluv-card__context-line"><i class="fa-solid fa-location-dot" aria-hidden="true"></i><span>Talhão Sul</span></div>
                <div class="pluv-card__context-line"><i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i><span>Impacta: Pivô 5</span></div>
              </div>
            </div>
          </article>
          <article class="pluv-card card" data-pluv-card="" data-id="leste" aria-expanded="false">
            <div class="pluv-card__row">
              <div class="pluv-card__main">
                <div class="pluv-card__title"><span class="pluv-card__name">Pluviômetro Leste</span></div>
                <div class="pluv-card__rain-context">Última chuva às 6h</div>
              </div>
              <div class="pluv-card__right">
                <div class="pluv-card__mm-block">
                  <span class="pluv-card__mm-ico"><svg class="pluv-mm-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"></path><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"></path></svg></span>
                  <div class="pluv-card__mm-text">
                    <div class="pluv-card__mm"><span class="pluv-card__mm-val">5.7</span><span class="pluv-card__mm-unit">mm</span></div>
                    <div class="pluv-card__duration">em 6h</div>
                  </div>
                </div>
                <button class="pluv-card__toggle" type="button" data-card-toggle="" aria-label="Mostrar detalhes" aria-expanded="false" aria-controls="telem-pluv-expand-leste"><i class="fa-solid fa-chevron-down"></i></button>
              </div>
            </div>
            <span class="pluv-card__pill pluv-card__pill--ghost">&nbsp;</span>
            <div class="pluv-card__footline">
              <div class="pluv-card__updated"><i class="fa-solid fa-clock pluv-card__clock" aria-hidden="true"></i><span>Atualizado há 29 min</span></div>
              <div class="pluv-card__telemetry">
                <span class="pluv-card__signal is-on" title="4G"><i class="fa-solid fa-wifi"></i></span>
                <span class="pluv-card__battery is-mid" style="--battery-level: 58%;" title="Bateria 58%" aria-label="Bateria 58%"><span class="pluv-card__battery-fill"></span></span>
              </div>
            </div>
            <div class="pluv-card__expand" id="telem-pluv-expand-leste">
              <div class="pluv-card__divider"></div>
              <div class="pluv-card__context">
                <div class="pluv-card__context-line"><i class="fa-solid fa-location-dot" aria-hidden="true"></i><span>Talhão Leste</span></div>
                <div class="pluv-card__context-line"><i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i><span>Impacta: Pivô 6</span></div>
              </div>
            </div>
          </article>
          <article class="pluv-card card pluv-card--dry" data-pluv-card="" data-id="oeste" aria-expanded="false">
            <div class="pluv-card__row">
              <div class="pluv-card__main">
                <div class="pluv-card__title"><span class="pluv-card__name">Pluviômetro Oeste</span></div>
                <div class="pluv-card__rain-context">Última chuva às 3h</div>
              </div>
              <div class="pluv-card__right">
                <div class="pluv-card__mm-block">
                  <span class="pluv-card__mm-ico"><svg class="pluv-mm-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"></path><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"></path></svg></span>
                  <div class="pluv-card__mm-text">
                    <div class="pluv-card__mm"><span class="pluv-card__mm-val">3.4</span><span class="pluv-card__mm-unit">mm</span></div>
                    <div class="pluv-card__duration">em 3h</div>
                  </div>
                </div>
                <button class="pluv-card__toggle" type="button" data-card-toggle="" aria-label="Mostrar detalhes" aria-expanded="false" aria-controls="telem-pluv-expand-oeste"><i class="fa-solid fa-chevron-down"></i></button>
              </div>
            </div>
            <span class="pluv-card__pill pluv-card__pill--ghost">&nbsp;</span>
            <div class="pluv-card__footline">
              <div class="pluv-card__updated"><i class="fa-solid fa-clock pluv-card__clock" aria-hidden="true"></i><span>Atualizado há 18 min</span></div>
              <div class="pluv-card__telemetry">
                <span class="pluv-card__signal is-on" title="4G"><i class="fa-solid fa-wifi"></i></span>
                <span class="pluv-card__battery is-mid" style="--battery-level: 45%;" title="Bateria 45%" aria-label="Bateria 45%"><span class="pluv-card__battery-fill"></span></span>
              </div>
            </div>
            <div class="pluv-card__expand" id="telem-pluv-expand-oeste">
              <div class="pluv-card__divider"></div>
              <div class="pluv-card__context">
                <div class="pluv-card__context-line"><i class="fa-solid fa-location-dot" aria-hidden="true"></i><span>Talhão Oeste</span></div>
                <div class="pluv-card__context-line"><i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i><span>Impacta: Pivô 7</span></div>
              </div>
            </div>
          </article>
        </div>
      </div>
      <div class="telem-bottom-bar__divider"></div>
      <div class="telem-bottom-panel">
        <div class="telem-side__header">
          <span class="telem-side__title">Medidores de Nível</span>
          <span class="telem-side__count telem-side__count--gray">${medids.length}</span>
        </div>
        <div class="telem-bottom-panel__list">
          <article class="gestao-level-card card" style="--level: 78%; --level-color: #22c55e;">
            <div class="gestao-level-card__head"><span class="gestao-level-card__name">Poço Norte</span></div>
            <div class="gestao-level-card__body">
              <div class="gestao-level-card__meta">
                <div class="gestao-level-card__line">Leitura: <strong>14.2 m</strong></div>
                <div class="gestao-level-card__line">Bomba: <strong>Bomba Norte</strong></div>
              </div>
              <div class="gestao-level-gauge-block">
                <div class="gestao-level-gauge" aria-hidden="true"><span class="gestao-level-gauge__fill"></span></div>
                <span class="gestao-level-gauge__wifi gestao-level-card__signal is-on" title="4G"><i class="fa-solid fa-wifi"></i></span>
                <div class="gestao-level-gauge__value">78%</div>
              </div>
            </div>
            <div class="gestao-level-card__foot"><i class="fa-solid fa-clock"></i><span>Atualizado há 8 min</span></div>
          </article>
          <article class="gestao-level-card card" style="--level: 42%; --level-color: #f59e0b;">
            <div class="gestao-level-card__head"><span class="gestao-level-card__name">Poço Sul</span></div>
            <div class="gestao-level-card__body">
              <div class="gestao-level-card__meta">
                <div class="gestao-level-card__line">Leitura: <strong>8.1 m</strong></div>
                <div class="gestao-level-card__line">Bomba: <strong>Bomba Sul</strong></div>
              </div>
              <div class="gestao-level-gauge-block">
                <div class="gestao-level-gauge" aria-hidden="true"><span class="gestao-level-gauge__fill"></span></div>
                <span class="gestao-level-gauge__wifi gestao-level-card__signal is-on" title="4G"><i class="fa-solid fa-wifi"></i></span>
                <div class="gestao-level-gauge__value">42%</div>
              </div>
            </div>
            <div class="gestao-level-card__foot"><i class="fa-solid fa-clock"></i><span>Atualizado há 22 min</span></div>
          </article>
          <article class="gestao-level-card card" style="--level: 23%; --level-color: #ef4444;">
            <div class="gestao-level-card__head"><span class="gestao-level-card__name">Poço Leste</span></div>
            <div class="gestao-level-card__body">
              <div class="gestao-level-card__meta">
                <div class="gestao-level-card__line">Leitura: <strong>4.6 m</strong></div>
                <div class="gestao-level-card__line">Bomba: <strong>Bomba Leste</strong></div>
              </div>
              <div class="gestao-level-gauge-block">
                <div class="gestao-level-gauge" aria-hidden="true"><span class="gestao-level-gauge__fill"></span></div>
                <span class="gestao-level-gauge__wifi gestao-level-card__signal is-on" title="4G"><i class="fa-solid fa-wifi"></i></span>
                <div class="gestao-level-gauge__value">23%</div>
              </div>
            </div>
            <div class="gestao-level-card__foot"><i class="fa-solid fa-clock"></i><span>Atualizado há 1 h</span></div>
          </article>
        </div>
      </div>
    `;

    const _mainMap = document.querySelector(".main--map");
    if (_mainMap) _mainMap.appendChild(el);

    // Toggle expand on pluv-cards
    el.querySelectorAll("[data-card-toggle]").forEach(btn => {
      btn.addEventListener("click", () => {
        const card = btn.closest("[data-pluv-card]");
        if (!card) return;
        const expanded = card.getAttribute("aria-expanded") === "true";
        card.setAttribute("aria-expanded", String(!expanded));
        card.classList.toggle("is-open", !expanded);
        btn.setAttribute("aria-expanded", String(!expanded));
        requestAnimationFrame(() => syncBottomBarHeight(el));
      });
    });

    // Redireciona scroll vertical → horizontal nas listas do bottom bar
    el.querySelectorAll(".telem-bottom-panel__list").forEach(list => {
      list.addEventListener("wheel", e => {
        if (e.deltaY === 0) return;
        e.preventDefault();
        list.scrollLeft += e.deltaY;
      }, { passive: false });
    });

    requestAnimationFrame(() => syncBottomBarHeight(el));
  }

  function destroyBottomSidebars() {
    document.getElementById("telemBottom")?.remove();
  }

  function applyTelemTheme(dark) {
    document.body.classList.toggle("telem-dark", dark);
    const btnDark  = document.getElementById("telemBtnDark");
    const btnLight = document.getElementById("telemBtnLight");
    if (btnDark)  btnDark.classList.toggle("is-active", dark);
    if (btnLight) btnLight.classList.toggle("is-active", !dark);
  }

  function mountTopbar() {
    if (document.getElementById("telemTopbar")) return;

    const pivos  = getPivos();
    const bombas = getBombasData();
    const pluvs  = getPluviometros();
    const medids = getMedidores();

    // mock status split (sem dados reais de status ainda)
    const pivosOp  = 0;
    const pivosPar = pivos.length;
    const bombasOp = 0;
    const bombasDes = bombas.length;

    const totalEquip = pivos.length + bombas.length + pluvs.length + medids.length;

    const bar = document.createElement("div");
    bar.id = "telemTopbar";
    bar.className = "telem-topbar";
    const now = new Date();
    const dateStr = now.toLocaleDateString(window.IcI18n?.getLocale?.() || "pt-BR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });

    bar.innerHTML = `
      <div class="telem-topbar__header">
        <div class="telem-live">
          <span class="telem-live__dot"></span>
          <span class="telem-live__label">Ao vivo</span>
          <div class="telem-live__datetime">
            <span class="telem-live__date">${dateStr}</span>
            <span class="telem-live__time" id="telemClock"></span>
          </div>
        </div>
        <span class="telem-topbar__sub">Farm Control System — Telemetria</span>
        <span class="telem-topbar__name">${getFarmName()}</span>
      </div>

      <div class="telem-topbar__kpis">

        <div class="telem-kpi telem-kpi--green">
          <div class="telem-kpi__icon"><i class="fa-solid fa-rotate"></i></div>
          <div class="telem-kpi__body">
            <div class="telem-kpi__label">Pivôs Operando</div>
            <div class="telem-kpi__value">${pivosOp}<span class="telem-kpi__unit">/${pivos.length}</span></div>
            <div class="telem-kpi__sub telem-kpi__sub--green">${pivosOp > 0 ? "irrigando agora" : "nenhum ativo"}</div>
          </div>
        </div>

        <div class="telem-kpi telem-kpi--muted">
          <div class="telem-kpi__icon"><i class="fa-solid fa-circle-stop"></i></div>
          <div class="telem-kpi__body">
            <div class="telem-kpi__label">Pivôs Parados</div>
            <div class="telem-kpi__value">${pivosPar}<span class="telem-kpi__unit">/${pivos.length}</span></div>
            <div class="telem-kpi__sub">${pivosPar === pivos.length ? "todos parados" : `${pivosPar} <span>sem operação</span>`}</div>
          </div>
        </div>

        <div class="telem-kpi telem-kpi--green">
          <div class="telem-kpi__icon"><i class="fa-solid fa-plug-circle-bolt"></i></div>
          <div class="telem-kpi__body">
            <div class="telem-kpi__label">Bombas Ligadas</div>
            <div class="telem-kpi__value">${bombasOp}<span class="telem-kpi__unit">/${bombas.length}</span></div>
            <div class="telem-kpi__sub telem-kpi__sub--green">${bombasOp > 0 ? "bombeando" : "nenhuma ativa"}</div>
          </div>
        </div>

        <div class="telem-kpi telem-kpi--muted">
          <div class="telem-kpi__icon"><i class="fa-solid fa-plug-circle-xmark"></i></div>
          <div class="telem-kpi__body">
            <div class="telem-kpi__label">Bombas Desligadas</div>
            <div class="telem-kpi__value">${bombasDes}<span class="telem-kpi__unit">/${bombas.length}</span></div>
            <div class="telem-kpi__sub">${bombasDes === bombas.length ? "todas desligadas" : `${bombasDes} <span>offline</span>`}</div>
          </div>
        </div>

        <div class="telem-kpi">
          <div class="telem-kpi__icon"><i class="fa-solid fa-droplet"></i></div>
          <div class="telem-kpi__body">
            <div class="telem-kpi__label">Área Irrigada</div>
            <div class="telem-kpi__value">245 <span class="telem-kpi__unit">ha</span></div>
            <div class="telem-kpi__sub">+17ha hoje</div>
          </div>
        </div>

        <div class="telem-kpi">
          <div class="telem-kpi__icon"><i class="fa-solid fa-gauge-high"></i></div>
          <div class="telem-kpi__body">
            <div class="telem-kpi__label">Volume Aplicado</div>
            <div class="telem-kpi__value">4.530 <span class="telem-kpi__unit">m³</span></div>
            <div class="telem-kpi__sub">Últimas 24h</div>
          </div>
        </div>

        <div class="telem-kpi">
          <div class="telem-kpi__icon"><i class="fa-solid fa-bolt"></i></div>
          <div class="telem-kpi__body">
            <div class="telem-kpi__label">Consumo Energético</div>
            <div class="telem-kpi__value">1.248 <span class="telem-kpi__unit">kWh</span></div>
            <div class="telem-kpi__sub">4% do total</div>
          </div>
        </div>

        <div class="telem-kpi">
          <div class="telem-kpi__icon"><i class="fa-solid fa-circle-check"></i></div>
          <div class="telem-kpi__body">
            <div class="telem-kpi__label">Equipamentos</div>
            <div class="telem-kpi__value">${totalEquip}<span class="telem-kpi__unit"> total</span></div>
            <div class="telem-kpi__sub">${pivos.length}p · ${bombas.length}b · ${pluvs.length}pl · ${medids.length}mdn</div>
          </div>
        </div>

        <div class="telem-kpi telem-kpi--alert">
          <div class="telem-kpi__icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
          <div class="telem-kpi__body">
            <div class="telem-kpi__label">Alertas</div>
            <div class="telem-kpi__value">2</div>
            <div class="telem-kpi__sub">Atenção necessária</div>
          </div>
        </div>

        <div class="telem-kpi">
          <div class="telem-kpi__icon"><i class="fa-solid fa-signal"></i></div>
          <div class="telem-kpi__body">
            <div class="telem-kpi__label">Status Geral</div>
            <div class="telem-kpi__value">71<span class="telem-kpi__unit">%</span></div>
            <div class="telem-kpi__sub telem-kpi__sub--green">online</div>
          </div>
        </div>

      </div>
    `;

    const mapWrap = document.querySelector(".main--map");
    if (mapWrap) mapWrap.prepend(bar);
    else document.body.prepend(bar);

    const fullscreenBtn = document.getElementById("btnMapFullscreen");
    if (fullscreenBtn) bar.appendChild(fullscreenBtn);

    // theme toggle
    document.getElementById("telemBtnLight")?.addEventListener("click", () => applyTelemTheme(false));
    document.getElementById("telemBtnDark")?.addEventListener("click",  () => applyTelemTheme(true));

    // live clock
    function tickClock() {
      const el = document.getElementById("telemClock");
      if (!el) return;
      el.textContent = new Date().toLocaleTimeString("pt-BR");
    }
    tickClock();
    bar._clockInterval = setInterval(tickClock, 1000);
  }

  function destroyTopbar() {
    const bar = document.getElementById("telemTopbar");
    if (bar?._clockInterval) clearInterval(bar._clockInterval);
    bar?.remove();
  }

  function onFarmChanged() {
    if (!document.body.classList.contains("is-telemetria")) return;
    invalidateTimeline();
    destroyBottomSidebars();
    mountBottomSidebars();
    destroyTimelineSidebar();
    mountTimelineSidebar();
  }

  window.IcTelemetria = {
    open() {
      document.body.classList.add("is-telemetria");

      const mapCard = document.getElementById("mapCard");
      if (mapCard) mapCard.style.display = "";

      const slot = document.getElementById("pageSlot");
      if (slot) slot.innerHTML = "";

      mountTopbar();
      mountSidebar();
      mountTimelineSidebar();
      mountBottomSidebars();

      window.addEventListener("ic:farm-changed", onFarmChanged);
      window.addEventListener("ic:sim-status-change", onSimStatusChange);
      window.addEventListener("ic:sim-tick", onSimTick);
      window.addEventListener("ic:sim-stop", onSimStop);

      const map = window.icMap;
      if (map && typeof map.invalidateSize === "function") {
        map.invalidateSize({ pan: false });
        requestAnimationFrame(() => map.invalidateSize({ pan: false }));
        setTimeout(() => map.invalidateSize({ pan: false }), 180);
      }

      window.dispatchEvent(new Event("ic:layout-change"));
    },

    close() {
      const fullscreenBtn = document.getElementById("btnMapFullscreen");
      const mapActions = document.querySelector(".map-actions");
      if (fullscreenBtn && mapActions) mapActions.appendChild(fullscreenBtn);

      document.body.classList.remove("is-telemetria", "telem-dark");
      destroyTopbar();
      destroySidebar();
      destroyTimelineSidebar();
      destroyBottomSidebars();
      // Move #map de volta para .main--map e remove o wrapper
      const row = document.getElementById("telemMapRow");
      if (row) {
        const mapEl = row.querySelector(".map");
        if (mapEl) row.parentElement?.appendChild(mapEl);
        row.remove();
      }

      window.removeEventListener("ic:farm-changed", onFarmChanged);
      window.removeEventListener("ic:sim-status-change", onSimStatusChange);
      window.removeEventListener("ic:sim-tick", onSimTick);
      window.removeEventListener("ic:sim-stop", onSimStop);
    }
  };
})();
