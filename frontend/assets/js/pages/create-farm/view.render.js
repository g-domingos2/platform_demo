// assets/js/pages/create-farm/view.render.js
(function initCreateFarmRender() {
  "use strict";

  const CreateFarm = (window.CreateFarm = window.CreateFarm || {});
  const state = CreateFarm.state || {};
  const helpers = CreateFarm.helpers || {};
  const view = (CreateFarm.view = CreateFarm.view || {});
  const render = (view.render = view.render || {});
  const events = (CreateFarm.events = CreateFarm.events || {});

  // Prioridade de ordenação da lista de pivôs no card do mapa: quanto menor, mais no topo.
  // Falha (alerta) sempre primeiro, depois irrigando/ferti, depois demais estados ativos.
  const PIVOT_LIST_SORT_PRIORITY = {
    alerta: 0,
    irrigando: 1,
    ferti_irrigando: 1,
    movendo_a_seco: 2,
    preparando_irrigar: 2,
    irrigacao_finalizada: 3,
  };

  // Atualiza ao vivo (durante a simulação) só os badges de status dos pivôs na lista,
  // sem re-renderizar o painel inteiro — leve o suficiente p/ rodar a cada frame.
  function updatePivotStatusBadgesLive() {
    const badges = document.querySelectorAll("[data-pivot-status-badge]");
    if (!badges.length) return;
    badges.forEach((badge) => {
      const id = badge.dataset.pivotStatusBadge;
      const resolved = window.IcResolvePivotStatus?.({ id }) || null;
      const statusText = resolved?.badgeText || "PAINEL ENERGIZADO";
      badge.className = `map-card__equip-badge ${resolved?.badgeClass || "map-card__equip-badge--warn"}`;
      const meta = window.IcBuildPivotStatusMeta?.(id) || "";
      if (meta) badge.innerHTML = `${statusText}${meta}`;
      else badge.textContent = statusText;
    });
  }
  // Reordena a lista de pivôs sempre que um status muda de verdade (não a cada frame),
  // pra falha/irrigando pularem pro topo automaticamente sem re-render constante.
  function reorderPivotListOnStatusChange() {
    const farm = window.IcFarmGetActive?.() || window.IcFarmActive || null;
    if (!farm || !Array.isArray(farm.equipments) || !farm.equipments.length) return;
    if (!document.querySelector('.map-card__panel[data-equip-list="pivos"]')) return;
    renderEquipmentPanels(farm);
  }
  if (!window.__icPivotBadgeLiveBound) {
    window.__icPivotBadgeLiveBound = true;
    window.addEventListener("ic:pivot-motion-tick", updatePivotStatusBadgesLive);
    window.addEventListener("ic:sim-tick", updatePivotStatusBadgesLive);
    window.addEventListener("ic:sim-status-change", updatePivotStatusBadgesLive);
    window.addEventListener("ic:sim-status-change", reorderPivotListOnStatusChange);
  }

  function buildFarmDisplayName(farm) {
    const rawDisplayId = farm?.displayId ?? farm?.code ?? farm?.farmCode ?? "";
    const farmId = String(rawDisplayId).replace(/\D/g, "");
    const farmName = String(farm?.name || "Fazenda sem nome").trim() || "Fazenda sem nome";
    return farmId ? `${farmId} - ${farmName}` : farmName;
  }

  function resetPanelState(panel, toggle) {
    if (toggle) {
      toggle.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }
    if (panel) {
      panel.classList.remove("is-open");
      panel.setAttribute("aria-hidden", "true");
    }
  }

  function updateEquipmentCta() {
    const isConnectivity = document.body.classList.contains("is-conectividade");
    const ctaBtn = document.getElementById("btnCreateEquipment");
    if (!ctaBtn) return;

    const t = (text) => window.IcI18n?.t?.(text) ?? text;
    const scanDone = isConnectivity && window.IcConnectivityScanDone?.();
    ctaBtn.innerHTML = isConnectivity
      ? `
        <span class="map-card__cta-ico"><i class="fa-solid fa-wifi"></i></span>
        <span>${t("Buscar Rádios")}</span>${scanDone ? " 100%" : ""}
      `
      : `
        <span class="map-card__cta-ico"><i class="fa-solid fa-plus"></i></span>
        <span>${t("Criar equipamento")}</span>
      `;
    ctaBtn.classList.toggle("is-connectivity", isConnectivity);
    ctaBtn.style.fontWeight = "900";
  }

  function isLineStarItem(item) {
    return String(item?.type || "").toLowerCase() === "linestar";
  }

  function isRainstarItem(item) {
    return String(item?.type || "").toLowerCase() === "rainstar" && String(item?.category || "").toLowerCase() === "carreteis";
  }

  function isPivotLikeItem(item) {
    return item?.category === "pivos" || isLineStarItem(item);
  }

  function getRainstarStatus(item) {
    const status = String(item?.data?.status || item?.status || "stopped_stop_sensor").toLowerCase();
    const map = {
      irrigating: { text: "IRRIGANDO", cls: "map-card__equip-badge--info" },
      stopped_stop_sensor: { text: "PARADO POR SENSOR DE PARADA", cls: "map-card__equip-badge--warn" },
      speed_not_reached: { text: "VELOCIDADE NÃO ATINGIDA", cls: "map-card__equip-badge--danger" },
      disconnected: { text: "DESCONECTADO", cls: "map-card__equip-badge--neutral" },
      waiting_connection: { text: "ESPERANDO CONEXÃO", cls: "map-card__equip-badge--neutral" },
    };
    return map[status] || map.stopped_stop_sensor;
  }

  function buildRainstarSummary(item) {
    const d = item?.data || {};
    const fmt = (v, unit = "", digits = 1) => {
      const n = helpers.toNumber(v);
      return n === null ? "--" : `${helpers.formatDecimal(n, digits)}${unit}`;
    };
    const pressure = helpers.toNumber(d.currentPressure ?? d.pressureValue);
    const battery = helpers.toNumber(d.battery);
    const speed = helpers.toNumber(d.currentSpeed);
    const pulledPipeLabel = fmt(d.pulledPipeLength ?? d.hosePulledLength, "m", 1).replace(/\.0m$/, "m");
    return {
      pulledPipeLabel,
      pressureLabel: pressure === null ? "--" : `${helpers.formatDecimal(pressure, 2)}bar`,
      signalLabel: d.signal || (d.connected === false ? "Sem sinal" : "Bom"),
      batteryLabel: battery === null ? "--" : `${helpers.formatDecimal(battery, 0)}%`,
      preIrrigationLabel: d.preIrrigation?.enabled ? "Habilitado" : "Desabilitado",
      postIrrigationLabel: d.postIrrigation?.enabled ? "Habilitado" : "Desabilitado",
      lastCommunication: d.lastCommunication ? helpers.formatDateTime(d.lastCommunication) : helpers.formatDateTime(item.createdAt),
      statusMeta: (speed === null || String(item?.data?.status || item?.status || "").toLowerCase() !== "irrigating") ? "" : ` <span class="map-card__badge-meta"><i class="fa-solid fa-droplet"></i> ${helpers.formatDecimal(speed, 1).replace(/\.0$/, "")}m/h${d.timeRemaining ? ` <i class="fa-regular fa-clock"></i> ${d.timeRemaining}` : ""}</span>`,
    };
  }

  function appendRainstarMetrics(container, summary) {
    if (!container || !summary) return;
    const routeIcon = '<svg viewBox="0 0 512 512" height="18" width="18"><path fill="rgba(0,0,0,0.88)" d="M268.537,116.46c-25.779,0-46.751,20.973-46.751,46.751s20.972,46.751,46.751,46.751 c25.785,0,46.763-20.973,46.763-46.751S294.322,116.46,268.537,116.46z M268.537,185.783c-12.445,0-22.572-10.125-22.572-22.572 c0-12.446,10.125-22.571,22.572-22.571c12.452,0,22.584,10.125,22.584,22.571C291.121,175.658,280.989,185.783,268.537,185.783z"></path><path fill="rgba(0,0,0,0.88)" d="M365.967,126.571c-1.379-3.663-2.98-7.279-4.76-10.749c-3.045-5.942-10.334-8.286-16.274-5.242 c-5.941,3.047-8.287,10.332-5.242,16.274c1.361,2.656,2.588,5.427,3.645,8.236c1.824,4.847,6.427,7.834,11.317,7.834 c1.415,0,2.853-0.25,4.257-0.779C365.159,139.794,368.318,132.82,365.967,126.571z"></path><path fill="rgba(0,0,0,0.88)" d="M268.537,0c-89.995,0-163.211,73.217-163.211,163.211v169.256H92.329c-6.677,0-12.09,5.414-12.09,12.09v41.71 c0,6.676,5.413,12.09,12.09,12.09h14.214l10.94,102.833c0.654,6.148,5.841,10.811,12.022,10.811h34.976 c6.182,0,11.368-4.663,12.022-10.811l10.94-102.833h14.203c6.677,0,12.09-5.414-12.09-12.09v-41.71 c0-6.676-5.413-12.09-12.09-12.09h-12.984v-26.874c24.258,13.684,51.479,20.829,79.876,20.829 c90.001,0,163.223-73.217,163.223-163.211S358.538,0,268.537,0z M153.608,487.821h-13.231l-9.518-89.464h32.266L153.608,487.821z  M189.555,356.647v17.53h0H176.57h-59.155h-12.996v-17.53H189.555z M268.537,302.243c-28.93,0-56.42-8.703-79.877-25.228V229.81 c19.103,22.873,47.815,37.458,79.877,37.458c57.384,0,104.068-46.68,104.068-104.056c0-6.676-5.414-12.09-12.09-12.09 c-6.676,0-12.09,5.414-12.09,12.09c0,44.045-35.839,79.877-79.889,79.877c-44.044,0-79.877-35.833-79.877-79.877 c0-44.044,35.833-79.877,79.877-79.877c19.466,0,38.217,7.079,52.802,19.932c5.011,4.415,12.648,3.932,17.063-1.076 c4.415-5.01,3.933-12.649-1.076-17.063c-19.003-16.748-43.432-25.972-68.789-25.972c-57.377,0-104.056,46.68-104.056,104.056 v119.918v49.338h-34.976V163.211c0-76.662,62.37-139.032,139.032-139.032c76.669,0,139.044,62.37,139.044,139.032 S345.206,302.243,268.537,302.243z"></path></svg>';
    const gaugeIcon = '<img src="./assets/img/svg/gauge.svg" alt="Pressão Atual" style="filter: invert(33%) sepia(14%) saturate(620%) hue-rotate(175deg) brightness(80%) contrast(90%); height: 18px; width: 18px;">';
    const signalIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.88)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M5.5 13.5a9 9 0 0 1 13 0"/><path d="M2.5 10.5a13 13 0 0 1 19 0"/><path d="M12 20h.01"/></svg>';
    const batteryIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.88)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(-90deg);"><rect x="2" y="7" width="16" height="10" rx="2" ry="2"/><line x1="22" y1="11" x2="22" y2="13"/></svg>';
    const preIcon = "";
    const postIcon = "";

    const metricsTop = document.createElement("div");
    metricsTop.className = "map-card__metrics map-card__metrics--three";
    metricsTop.append(
      helpers.buildMetric(routeIcon, summary.pulledPipeLabel, "Comprimento puxado da mangueira"),
      helpers.buildMetric(gaugeIcon, summary.pressureLabel, "Pressão Atual"),
      helpers.buildMetric(signalIcon, summary.signalLabel, "Sinal do Modem")
    );
    const metricsBottom = document.createElement("div");
    metricsBottom.className = "map-card__metrics map-card__metrics--three";
    metricsBottom.append(
      helpers.buildMetric(batteryIcon, summary.batteryLabel, "Carga da Bateria"),
      helpers.buildMetric(preIcon, `Pré - ${summary.preIrrigationLabel}`, "Pré-Irrigação"),
      helpers.buildMetric(postIcon, `Pós - ${summary.postIrrigationLabel}`, "Pós-Irrigação")
    );
    container.append(metricsTop, metricsBottom);
  }

  function buildLineStarCardSummary(item) {
    const resolvedStatus = window.IcResolvePivotStatus?.(item) || null;
    const tooltipUtils = window.IcMapTooltipUtils || null;
    const visual = tooltipUtils?.getLineStarVisuals?.(item) || {
      statusText: resolvedStatus?.statusText || "PAINEL ENERGIZADO",
      statusClass: resolvedStatus?.statusClass || "is-warning",
    };

    if (typeof tooltipUtils?.buildLineStarTooltipSummary === "function") {
      return tooltipUtils.buildLineStarTooltipSummary(item, visual);
    }

    return {
      positionLabel: "45%",
      pressureLabel: "3,8 bar",
      hoursLabel: "420h",
      turnCountLabel: "12",
      pluviometerLabel: "0,0 mm",
      speedLabel: "1,2 m/h",
      lastCommunication: helpers.formatDateTime(item?.createdAt),
    };
  }

  function appendLineStarMetrics(container, summary) {
    if (!container || !summary) return;

    const iconFilter = "width: 15px; height: 15px; object-fit: contain; filter: invert(33%) sepia(14%) saturate(620%) hue-rotate(175deg) brightness(80%) contrast(90%);";
    const positionIcon = '<i class="fa-solid fa-arrows-left-right" style="color: #64748b;"></i>';
    const pressureIcon = `<img src="./assets/img/svg/gauge.svg" alt="Pressão Centro" style="${iconFilter}">`;
    const hoursIcon = `<img src="./assets/img/svg/clock.svg" alt="Horas" style="${iconFilter}">`;
    const pluviometerIcon = `<img src="./assets/img/svg/cloud-rain.svg" alt="Pluviômetro" style="${iconFilter}">`;
    const runIcon = '<i class="fa-solid fa-repeat" style="color: #64748b;"></i>';
    const speedIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #64748b; width: 14px; height: 14px;" aria-hidden="true"><path d="M12.8 19.6A2 2 0 1 0 14 16H2"></path><path d="M17.5 8a2.5 2.5 0 1 1 2 4H2"></path><path d="M9.8 4.4A2 2 0 1 1 11 8H2"></path></svg>';

    const metricsTop = document.createElement("div");
    metricsTop.className = "map-card__metrics map-card__metrics--three";
    metricsTop.append(
      helpers.buildMetric("fa-solid fa-arrows-left-right", summary.positionLabel, "Posição"),
      helpers.buildMetric("fa-solid fa-gauge-high", summary.pressureLabel, "Pressão"),
      helpers.buildMetric("fa-regular fa-clock", summary.hoursLabel, "Horas")
    );

    const metricsBottom = document.createElement("div");
    metricsBottom.className = "map-card__metrics map-card__metrics--three";
    metricsBottom.append(
      helpers.buildMetric("fa-solid fa-arrows-rotate", summary.turnCountLabel, "Número de Voltas", "map-card__metric--rotations"),
      helpers.buildMetric("fa-solid fa-droplet", summary.pluviometerLabel, "Pluviômetro"),
      helpers.buildMetric("fa-solid fa-wind", summary.speedLabel, "Velocidade")
    );

    container.append(metricsTop, metricsBottom);
  }

  function replaceLineStarMetricsMarkup(container, summary) {
    if (!container || !summary) return;

    container.querySelectorAll(".map-card__metrics").forEach((metricRow) => metricRow.remove());

    const iconFilter = "width: 15px; height: 15px; object-fit: contain; filter: invert(33%) sepia(14%) saturate(620%) hue-rotate(175deg) brightness(80%) contrast(90%);";
    const positionIcon = '<i class="fa-solid fa-arrows-left-right" style="color: #64748b;"></i>';
    const pressureIcon = `<img src="./assets/img/svg/gauge.svg" alt="Pressão Centro" style="${iconFilter}">`;
    const hoursIcon = `<img src="./assets/img/svg/clock.svg" alt="Horas" style="${iconFilter}">`;
    const pluviometerIcon = `<img src="./assets/img/svg/cloud-rain.svg" alt="Pluviômetro" style="${iconFilter}">`;
    const runIcon = '<i class="fa-solid fa-repeat" style="color: #64748b;"></i>';
    const speedIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #64748b; width: 14px; height: 14px;" aria-hidden="true"><path d="M12.8 19.6A2 2 0 1 0 14 16H2"></path><path d="M17.5 8a2.5 2.5 0 1 1 2 4H2"></path><path d="M9.8 4.4A2 2 0 1 1 11 8H2"></path></svg>';

    const metricsTop = document.createElement("div");
    metricsTop.className = "map-card__metrics map-card__metrics--three";
    metricsTop.append(
      helpers.buildMetric(positionIcon, summary.positionLabel, "Posição"),
      helpers.buildMetric(pressureIcon, summary.pressureLabel, "Pressão"),
      helpers.buildMetric(hoursIcon, summary.hoursLabel, "Horas")
    );

    const metricsBottom = document.createElement("div");
    metricsBottom.className = "map-card__metrics map-card__metrics--three";
    metricsBottom.append(
      helpers.buildMetric(pluviometerIcon, summary.pluviometerLabel, "Pluviômetro"),
      helpers.buildMetric(runIcon, summary.turnCountLabel, "Corridas", "map-card__metric--rotations"),
      helpers.buildMetric(speedIcon, summary.speedLabel, "Velocidade")
    );

    const foot = container.querySelector(".map-card__equip-foot");
    if (foot) container.insertBefore(metricsTop, foot);
    else container.appendChild(metricsTop);

    if (foot) container.insertBefore(metricsBottom, foot);
    else container.appendChild(metricsBottom);
  }

  function renderEquipmentPanels(farm) {
    const panels = document.querySelectorAll(".map-card__panel[data-equip-list]");
    if (!panels.length) return;

    const isConnectivity = document.body.classList.contains("is-conectividade");
    updateEquipmentCta();

    const equipments = Array.isArray(farm?.equipments) ? farm.equipments : [];

    const grouped = {};
    equipments.forEach((item) => {
      const cat = item.category === "carreteis" && item.type === "linestar" ? "linestars" : item.category;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    });
    const equipIds = new Set(equipments.map((e) => e.id));

    const togglesMap = new Map();
    document.querySelectorAll(".map-card__item--toggle[data-panel]").forEach((t) => {
      togglesMap.set(t.dataset.panel, t);
    });

    panels.forEach((panel) => {
      const key = panel.dataset.equipList;
      let list = grouped[key] ? [...grouped[key]] : [];
      if (key === "pivos" && Array.isArray(farm?.pivos)) {
        const extraPivos = farm.pivos
          .filter(p => !equipIds.has(p.id))
          .map(p => ({ id: p.id, name: p.name, category: "pivos", type: "smart_connect", data: { lat: p.lat, lng: p.lng } }));
        list = list.concat(extraPivos);
      }
      if (key === "pivos") {
        // Ordena a lista por urgência: alerta (falha) primeiro, depois irrigando/ferti,
        // depois os demais estados ativos, mantendo a ordem original dentro de cada grupo.
        list = list
          .map((item, idx) => ({ item, idx }))
          .sort((a, b) => {
            const pa = PIVOT_LIST_SORT_PRIORITY[window.IcResolvePivotStatus?.(a.item)?.key] ?? 4;
            const pb = PIVOT_LIST_SORT_PRIORITY[window.IcResolvePivotStatus?.(b.item)?.key] ?? 4;
            return pa !== pb ? pa - pb : a.idx - b.idx;
          })
          .map((entry) => entry.item);
      }
      panel.innerHTML = "";
      const toggle = togglesMap.get(panel.dataset.panel);

      if (!list.length) {
        resetPanelState(panel, toggle);
        if (toggle) toggle.style.display = "none";
        panel.style.display = "none";
        return;
      }

      if (toggle) toggle.style.display = "";
      panel.style.display = "";

      list.forEach((item, itemIndex) => {
        // Leitura da sonda: uma vez por item, compartilhada entre o badge e
        // as métricas — com dois contadores separados elas divergiriam.
        const cosmofieldReading = item.category === "cosmofields"
          ? window.IcCosmofieldReading?.(item, itemIndex)
          : null;
        const isLineStar = isLineStarItem(item);
        const isRainstar = isRainstarItem(item);
        const isPivotLike = isPivotLikeItem(item);
        const lineStarSummary = isLineStar ? buildLineStarCardSummary(item) : null;
        const rainstarSummary = isRainstar ? buildRainstarSummary(item) : null;
        const equip = document.createElement("div");
        equip.className = "map-card__equip";
        equip.dataset.equipmentId = String(item.id || "");
        equip.dataset.farmId = String(farm?.id || "");
        if (isConnectivity) equip.classList.add("map-card__equip--connectivity");
        if (isRainstar) equip.classList.add("map-card__equip--rainstar");

        const head = document.createElement("div");
        head.className = "map-card__equip-head";

        const name = document.createElement("span");
        name.className = "map-card__equip-name";
        name.textContent = item.name || item.label || "Equipamento";

        head.appendChild(name);

        if (isConnectivity) {
          // Connectivity Mode Badges
          const badgesWrap = document.createElement("div");
          badgesWrap.className = "map-card__badges-wrap";
          badgesWrap.dataset.equipBadges = item.id;
          const tech = window.IcConnectivityModel?.resolveTech?.(item) || "radio";
          
          if (tech === "4g") {
            badgesWrap.innerHTML = `
              <span class="map-card__badge-tag is-connectivity-tag is-4g" data-tag="4g">4G</span>
            `;
          } else if (isPivotLike) {
            badgesWrap.innerHTML = `
              <span class="map-card__badge-tag is-connectivity-tag" data-tag="controlador">Controlador</span>
              <span class="map-card__badge-tag is-connectivity-tag" data-tag="gps">GPS</span>
            `;
          } else {
            badgesWrap.innerHTML = `
              <span class="map-card__badge-tag is-connectivity-tag" data-tag="radio">Rádio</span>
            `;
          }
          head.appendChild(badgesWrap);
          // Clicar numa badge de rádio abre o painel de conexões daquele rádio.
          badgesWrap.querySelectorAll("[data-tag]").forEach((tag) => {
            const kind = tag.dataset.tag;
            if (kind !== "controlador" && kind !== "gps" && kind !== "radio") return;
            tag.classList.add("is-clickable");
            tag.addEventListener("click", (ev) => {
              ev.stopPropagation();
              window.IcConnectivitySelectRadio?.(item.id, kind === "gps" ? "gps" : "controlador");
            });
          });
          requestAnimationFrame(() => window.IcConnectivityApplyCardState?.(item.id));
        } else {
          // Normal Mode Badges
          if (isRainstar) {
            const resolvedStatus = getRainstarStatus(item);
            const badge = document.createElement("span");
            badge.className = `map-card__equip-badge ${resolvedStatus.cls}`;
            badge.innerHTML = `${window.IcI18n?.t?.(resolvedStatus.text) ?? resolvedStatus.text}${rainstarSummary?.statusMeta || ""}`;
            head.appendChild(badge);
          }

          if (!isConnectivity && isRainstar) {
          equip.style.cursor = "pointer";
          equip.classList.add("is-clickable");
          equip.addEventListener("click", () => {
            if (window.IcCarretel && typeof window.IcCarretel.open === "function") {
              window.IcCarretel.open({ carretelId: item.id, fromMap: true });
            }
          });
        }

        if (isPivotLike) {
            const resolvedStatus = window.IcResolvePivotStatus?.(item) || null;
            const badge = document.createElement("span");
            badge.className = `map-card__equip-badge ${resolvedStatus?.badgeClass || "map-card__equip-badge--warn"}`;
            badge.dataset.pivotStatusBadge = item.id;
            const statusText = resolvedStatus?.badgeText || "PAINEL ENERGIZADO";
            // Mesma legenda do balão: % + direção + tempo restante quando operando.
            const statusMeta = window.IcBuildPivotStatusMeta?.(item.id) || "";
            if (statusMeta) badge.innerHTML = `${statusText}${statusMeta}`;
            else badge.textContent = statusText;
            head.appendChild(badge);
          }

          if (item.category === "bombas") {
            const status = window.IcResolveBombaStatus
              ? window.IcResolveBombaStatus(item)
              : null;
            const running = status ? status.running : (item.running != null ? !!item.running : /ligad/i.test(item.status || item.statusBomba || ""));
            const badge = document.createElement("span");
            badge.className = `map-card__equip-badge ${status?.badgeClass || (running ? "map-card__equip-badge--info" : "map-card__equip-badge--warn")}`;
            const tb = (text) => window.IcI18n?.t?.(text) ?? text;
            badge.textContent = tb(status?.text || (running ? "LIGADA VIA INTERNET" : "DESLIGADA"));
            head.appendChild(badge);
          }

          if (item.category === "cosmofields") {
            // Mesma leitura do marcador e do tooltip do mapa.
            const reading = cosmofieldReading;
            const badge = document.createElement("span");
            // Alerta: água abaixo do gatilho, sem comunicação ou bateria
            // baixa. Atenção: abaixo de 50% da faixa (ver IcCosmofieldReading).
            const isAlert = reading?.status === "alert";
            const toneClass = isAlert
              ? "map-card__equip-badge--danger"
              : (reading?.status === "attention"
                ? "map-card__equip-badge--warn"
                : "map-card__equip-badge--success");
            badge.className = `map-card__equip-badge is-caps ${toneClass}`;
            // Mesma cor do ícone do mapa (escala RdYlGn ou vermelho em alerta).
            const badgeStyle = window.IcCosmofieldStatus?.(reading)?.style;
            if (badgeStyle) badge.style.cssText = badgeStyle;
            const tx = (text) => window.IcI18n?.t?.(text) ?? text;
            // Em alerta, o badge mostra só ALERTA — não uma umidade que pode
            // estar desatualizada ou abaixo do gatilho.
            badge.textContent = isAlert
              ? tx("ALERTA")
              : (reading?.availablePct !== null && reading?.availablePct !== undefined
                ? `${helpers.formatDecimal(reading.availablePct, 0)}% ${tx("da água disponível")}`
                : `${helpers.formatDecimal(reading?.moistureValue ?? 0, 1)}%`);
            head.appendChild(badge);
          }

          if (item.category === "medidores") {
            // Leitura ao vivo do nível; sem telemetria no mock, deriva do
            // nível máximo cadastrado + um mock determinístico por id.
            const md = item?.data || {};
            let levelPercent = helpers.toNumber(md.levelPercent) ?? helpers.toNumber(md.percent) ?? helpers.toNumber(md.nivelPercent);
            const nivelMax = helpers.toNumber(md.nivelMax) ?? helpers.toNumber(md.nivelMaximo) ?? helpers.toNumber(md.maxLevel);
            if (!Number.isFinite(levelPercent) || levelPercent <= 0) {
              // Mesma leitura do histórico fictício (detalhes/gráfico/mapa)
              const now = window.IcDemoHistory?.meter.current(item);
              if (now) levelPercent = now.pct;
              else {
                const seed = String(item.id || item.name || "").split("").reduce((s, ch) => s + ch.charCodeAt(0), 0);
                levelPercent = 55 + (seed % 40); // 55–94%
              }
            }
            let levelMeters = helpers.toNumber(md.levelMeters) ?? helpers.toNumber(md.meters) ?? helpers.toNumber(md.nivelMeters);
            if (!Number.isFinite(levelMeters) || levelMeters <= 0) {
              levelMeters = Number.isFinite(nivelMax) ? (levelPercent / 100) * nivelMax : (levelPercent / 100) * 6;
            }
            const badge = document.createElement("span");
            badge.className = "map-card__equip-badge map-card__equip-badge--info";
            badge.textContent = `${helpers.formatDecimal(levelPercent, 2)}% (${helpers.formatDecimal(levelMeters, 2)}m)`;
            head.appendChild(badge);
          }
        }

        equip.appendChild(head);

        // Hide metrics in connectivity mode
        if (!isConnectivity) {
          if (item.category === "pivos") {
            const angle = helpers.getPivotAngleDeg(item.data);
            const iconStyle = "width: 15px; height: 15px; object-fit: contain; filter: invert(33%) sepia(14%) saturate(620%) hue-rotate(175deg) brightness(80%) contrast(90%);";

            const metricsTop = document.createElement("div");
            metricsTop.className = "map-card__metrics map-card__metrics--three";
            metricsTop.append(
              helpers.buildMetric(`<img src="./assets/img/svg/circle-gauge.svg" alt="Ângulo" style="${iconStyle}">`, angle === null ? "--" : `${angle}°`, "Ângulo"),
              helpers.buildMetric(`<img src="./assets/img/svg/gauge.svg" alt="Pressão Centro" style="${iconStyle}">`, "--", "Pressão Centro"),
              helpers.buildMetric(`<img src="./assets/img/svg/clock.svg" alt="Horas" style="${iconStyle}">`, "00h00min", "Horas")
            );

            const voltage = helpers.toNumber(item?.data?.voltage ?? item?.data?.voltagem ?? item?.data?.tensao);
            const voltageLabel = Number.isFinite(voltage) ? `${Math.round(voltage)} V` : "0 V";

            const metricsBottom = document.createElement("div");
            metricsBottom.className = "map-card__metrics map-card__metrics--three";
            metricsBottom.append(
              helpers.buildMetric(`<img src="./assets/img/svg/cloud-rain.svg" alt="Pluviômetro" style="${iconStyle}">`, "0mm", "Pluviômetro"),
              helpers.buildMetric(`<img src="./assets/img/svg/gauge.svg" alt="Pressão Última Torre" style="${iconStyle}">`, "--", "Pressão Última Torre", "map-card__metric--motor"),
              helpers.buildMetric(`<img src="./assets/img/svg/zap.svg" alt="Tensão" style="${iconStyle}">`, voltageLabel, "Tensão")
            );

            equip.append(metricsTop, metricsBottom);
          }

          if (isLineStar) {
            appendLineStarMetrics(equip, lineStarSummary);
            replaceLineStarMetricsMarkup(equip, lineStarSummary);
          }

          if (item.category === "medidores") {
            const md = item?.data || {};
            const minPercent = helpers.toNumber(md.nivelValMin) ?? helpers.toNumber(md.valorMinimo) ?? helpers.toNumber(md.minPercent) ?? 20;
            const maxPercent = helpers.toNumber(md.nivelValMax) ?? helpers.toNumber(md.valorMaximo) ?? helpers.toNumber(md.maxPercent) ?? 100;
            const isOffline = md.semComunicacao === true || String(md.status || "").toLowerCase() === "offline" || String(md.status || "").toLowerCase().includes("sem comunica");
            const batteryLabel = isOffline ? "-" : (md.status || "Carregada");
            const batteryClass = isOffline ? "map-card__metric--danger" : "map-card__metric--success";
            const batteryIcon = `<i class="fa-solid fa-battery-full" style="transform:rotate(-90deg);display:inline-block;"></i>`;

            const metricsRow = document.createElement("div");
            metricsRow.className = "map-card__metrics map-card__metrics--three";
            metricsRow.append(
              helpers.buildMetric(`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5.116 4.104A1 1 0 0 1 6.11 3h11.78a1 1 0 0 1 .994 1.105L17.19 20.21A2 2 0 0 1 15.2 22H8.8a2 2 0 0 1-2-1.79z"></path><path d="M6 12a5 5 0 0 1 6 0 5 5 0 0 0 6 0"></path></svg>`, `Min.: ${helpers.formatDecimal(minPercent, 0)}%`),
              helpers.buildMetric(`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5.116 4.104A1 1 0 0 1 6.11 3h11.78a1 1 0 0 1 .994 1.105L17.19 20.21A2 2 0 0 1 15.2 22H8.8a2 2 0 0 1-2-1.79z"></path><path d="M6 12a5 5 0 0 1 6 0 5 5 0 0 0 6 0"></path></svg>`, `Max.: ${helpers.formatDecimal(maxPercent, 0)}%`, null, "map-card__metric--danger"),
              helpers.buildMetric(batteryIcon, batteryLabel, null, batteryClass)
            );

            equip.append(metricsRow);
          }

          if (item.category === "cosmofields") {
            const reading = cosmofieldReading;
            const iconStyle = "width: 15px; height: 15px; object-fit: contain; filter: invert(33%) sepia(14%) saturate(620%) hue-rotate(175deg) brightness(80%) contrast(90%);";
            const t = (text) => window.IcI18n?.t?.(text) ?? text;

            // Lâmina até a capacidade de campo, com os 40 cm de perfil.
            const fc = helpers.toNumber(item?.data?.fieldCapacity);
            const blade = (fc !== null && reading?.moistureValue !== undefined)
              ? Math.max(0, ((fc - reading.moistureValue) / 100) * 400)
              : null;

            // Próxima irrigação: mesmo mock determinístico do tooltip e do
            // modal — 0 a 6 dias à frente, pelo id do equipamento.
            const nextDate = new Date(Date.now() + ((reading?.seed ?? 0) % 7) * 86400000);
            const nextIrrigationLabel = nextDate
              .toLocaleDateString(window.IcI18n?.getLocale?.() || "pt-BR", { day: "2-digit", month: "short" })
              .replace(/\sde\s/g, " ")
              .replace(/\.$/, "");

            const metricsRow = document.createElement("div");
            metricsRow.className = "map-card__metrics map-card__metrics--three";
            // Leitura antiga fica esmaecida: continua visível, mas sinaliza
            // que não reflete o estado atual do solo.
            if (reading?.isOffline) metricsRow.style.opacity = "0.55";
            metricsRow.append(
              helpers.buildMetric(
                `<img src="./assets/img/svg/droplet.svg" alt="${t("Umidade atual")}" style="${iconStyle}">`,
                reading?.moistureValue !== undefined ? `${helpers.formatDecimal(reading.moistureValue, 1)}%` : "--",
                t("Umidade atual")
              ),
              helpers.buildMetric(
                `<img src="./assets/img/svg/waves-arrow-down.svg" alt="${t("Lâmina recomendada")}" style="${iconStyle}">`,
                blade === null ? "--" : `${helpers.formatDecimal(blade, 1)} mm`,
                t("Lâmina recomendada")
              ),
              helpers.buildMetric(
                `<img src="./assets/img/svg/zap.svg" alt="${t("Tensão da bateria")}" style="${iconStyle}">`,
                `${helpers.formatDecimal(reading?.batteryValue ?? 0, 2)} V`,
                t("Tensão da bateria")
              ),
              helpers.buildMetric(
                `<img src="./assets/img/svg/calendar-1.svg" alt="${t("Próxima irrigação")}" style="${iconStyle}">`,
                nextIrrigationLabel,
                t("Próxima irrigação")
              )
            );

            equip.append(metricsRow);

          }

          if (isRainstar) {
            appendRainstarMetrics(equip, rainstarSummary);
          }

          if (item.category === "repetidoras") {
            const height = helpers.toNumber(item?.data?.height);
            const metricsRow = document.createElement("div");
            metricsRow.className = "map-card__metrics map-card__metrics--one";
            metricsRow.append(
              helpers.buildMetric("fa-solid fa-up-down", height === null ? "-- m" : `${helpers.formatDecimal(height, 1)} m`)
            );
            equip.append(metricsRow);
          }

          if (item.category === "estacoes") {
            // Leitura atual da estação — ETo e Chuva do dia em destaque, mais
            // temperatura, umidade e vento.
            const c = (item?.data?.current && typeof item.data.current === "object") ? item.data.current : {};
            const n = (v) => helpers.toNumber(v);
            const etoIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3c-.6.7-.6 1.6 0 2.3s.6 1.6 0 2.3"/><path d="M11.7 3c-.6.7-.6 1.6 0 2.3s.6 1.6 0 2.3"/><path d="M15.4 3c-.6.7-.6 1.6 0 2.3s.6 1.6 0 2.3"/><path d="M12 19.5c-.2-3 1.3-5.8 4.8-6.4.2 3-1.3 5.8-4.8 6.4Z"/><path d="M12 19.5c.1-2.5-1.2-4.6-3.9-5-.1 2.5 1.2 4.6 3.9 5Z"/><path d="M12 19.5V15"/><path d="M4 19.5h16"/><path d="M9 22h6"/></svg>';
            const fmt = (v, u, d = 1) => (Number.isFinite(n(v)) ? `${helpers.formatDecimal(n(v), d)} ${u}` : `-- ${u}`);
            const radTxt = Number.isFinite(n(c.solarRadiation))
              ? `${Math.round(n(c.solarRadiation))} W/m²`
              : fmt(c.solarRadiationDay, "MJ/m²", 1);
            // Gota de água p/ umidade (fa-droplet no card é remapeado p/
            // "Pluviômetro" — por isso SVG inline).
            const humIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5S12.5 5.5 12 3c-.5 2.5-2 4.9-4 6.5S5 13 5 15a7 7 0 0 0 7 7Z"/></svg>';
            const metricsRow = document.createElement("div");
            metricsRow.className = "map-card__metrics map-card__metrics--three";
            metricsRow.append(
              helpers.buildMetric(etoIcon, fmt(c.eto, "mm", 2), "ETo (hoje)"),
              helpers.buildMetric("fa-solid fa-cloud-rain", fmt(c.rainDay, "mm"), "Chuva (hoje)"),
              helpers.buildMetric("fa-solid fa-temperature-half", fmt(c.temperature, "°C"), "Temperatura"),
              helpers.buildMetric(humIcon, fmt(c.humidity, "%", 0), "Umidade"),
              helpers.buildMetric("fa-solid fa-wind", fmt(c.windSpeed, "m/s"), "Vento"),
              helpers.buildMetric("fa-solid fa-sun", radTxt, "Radiação")
            );
            equip.append(metricsRow);
          }
        }

        const foot = document.createElement("div");
        foot.className = "map-card__equip-foot";
        foot.innerHTML = `<span class="comm-label">Última comunicação:</span> ${rainstarSummary?.lastCommunication || lineStarSummary?.lastCommunication || helpers.formatDateTime(item.createdAt)}`;
        equip.appendChild(foot);

        if (isPivotLike) {
          equip.style.cursor = "pointer";
          equip.classList.add("is-clickable");
          equip.addEventListener("click", () => {
            if (isConnectivity) {
              window.IcConnectivitySelect?.(item.id);
              return;
            }
            // Respeita a mesma preferência do clique no desenho do pivô no mapa
            // (Configurações > Navegação > Ação ao Clicar nos Ícones do Mapa).
            const action = localStorage.getItem("ic:pivot-click-action") || "details";
            if (action === "schedule" && window.OpModal && typeof window.OpModal.open === "function") {
              if (isLineStar) {
                const position = window.IcPivotSimulationRuntime?.states?.[item.id]?.progress ?? 0;
                window.OpModal.open({ title: item.name || "Pivô Linear", pivotId: item.id, isLinear: true, position, isPeakHour: true });
              } else {
                window.OpModal.open({ title: item.name || "Pivô", pivotId: item.id });
              }
              return;
            }
            if (isLineStar && window.IcLineStar && typeof window.IcLineStar.open === "function") {
              window.IcLineStar.open({ linestarId: item.id, fromMap: true });
              return;
            }
            if (window.IcPivos && typeof window.IcPivos.open === "function") {
              window.IcPivos.open({ pivotId: item.id });
            }
          });
        }

        if (isConnectivity && !isPivotLike) {
          equip.style.cursor = "pointer";
          equip.classList.add("is-clickable");
          equip.addEventListener("click", () => window.IcConnectivitySelect?.(item.id));
        }

        if (!isConnectivity && item.category === "cosmofields") {
          equip.style.cursor = "pointer";
          equip.classList.add("is-clickable");
          equip.addEventListener("click", () => {
            // Mesma preferência do clique no marcador do mapa
            // (Configurações > Navegação > Ação ao Clicar no Cosmofield).
            const action = localStorage.getItem("ic:cosmofield-click-action") || "modal";
            if (action === "modal" && window.IcCosmofieldModal?.open) {
              window.IcCosmofieldModal.open({
                name: item.name || "Cosmofield",
                equipId: item.id,
                data: item.data || {},
                index: itemIndex,
              });
              return;
            }
            window.IcNavigate?.("cosmofield", { equipId: item.id, fromMap: true });
          });
        }

        if (!isConnectivity && item.category === "bombas") {
          equip.style.cursor = "pointer";
          equip.classList.add("is-clickable");
          equip.addEventListener("click", () => {
            // Mesma preferência do clique no desenho da bomba no mapa
            // (Configurações > Navegação > Ação ao Clicar nos Ícones do Mapa).
            const action = localStorage.getItem("ic:pivot-click-action") || "details";
            if (action === "schedule" && window.IcBombaModal && typeof window.IcBombaModal.open === "function") {
              window.IcBombaModal.open({
                name: item.name || "Bomba",
                equipId: item.id,
                running: window.IcResolveBombaRunning
                  ? window.IcResolveBombaRunning(item)
                  : (item.running != null ? !!item.running : /ligad/i.test(item.status || item.statusBomba || "")),
              });
              return;
            }
            if (window.IcBombaDetails && typeof window.IcBombaDetails.open === "function") {
              window.IcBombaDetails.open({ BmbId: item.id, fromMap: true });
            }
          });
        }

        // Equipamentos sem parte de operação: o card abre direto os detalhes.
        if (!isConnectivity) {
          let openDetails = null;
          if (item.category === "medidores") {
            openDetails = () => window.IcMdnDetails?.open?.({ mdnId: item.id, fromMap: true });
          } else if (item.category === "pluviometros") {
            openDetails = () => window.IcPluvDetails?.open?.({ pluvioId: item.id, detailsType: "pluviometros" });
          } else if (item.category === "estacoes") {
            openDetails = () => window.IcEstacaoDetails?.open?.({ estId: item.id, fromMap: true });
          } else if (item.category === "repetidoras") {
            openDetails = () => window.IcRepetidoraDetails?.open?.({ repetidoraId: item.id, fromMap: true });
          }
          if (openDetails) {
            equip.style.cursor = "pointer";
            equip.classList.add("is-clickable");
            equip.addEventListener("click", openDetails);
          }
        }

        panel.appendChild(equip);
      });
    });

    window.IcMapUpdateCardStatusCounts?.();
  }

  function clearEquipmentPanels(message) {
    const panels = document.querySelectorAll(".map-card__panel[data-equip-list]");
    if (!panels.length) return;
    updateEquipmentCta();
    panels.forEach((panel) => {
      panel.innerHTML = "";
      const toggle = document.querySelector(`.map-card__item--toggle[data-panel="${panel.dataset.panel}"]`);
      resetPanelState(panel, toggle);
      if (toggle) toggle.style.display = "none";
      panel.style.display = "none";
    });

    window.IcMapUpdateCardStatusCounts?.();
  }

  function updateActiveFarm() {
    if (!state.farmListHost) return;
    state.farmListHost.querySelectorAll(".farm-list__item").forEach((item) => {
      item.classList.toggle("is-active", item.dataset.farmId === state.currentFarmId);
    });
  }

  function renderFarmList(filter = "") {
    if (!state.farmListHost) return;
    state.farmListHost.innerHTML = "";
    const term = filter.trim().toLowerCase();
    const filtered = state.farms.filter((farm) => {
      const name = String(farm?.name || "").toLowerCase();
      const label = buildFarmDisplayName(farm).toLowerCase();
      return !term || name.includes(term) || label.includes(term);
    });

    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "farm-list__empty";
      empty.textContent = term ? "Nenhuma fazenda encontrada." : "Nenhuma fazenda cadastrada.";
      state.farmListHost.appendChild(empty);
      return;
    }

    filtered.forEach((farm) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "farm-list__item";
      btn.dataset.farmId = farm.id;

      const dot = document.createElement("span");
      dot.className = "farm-list__dot";

      const name = document.createElement("span");
      name.className = "farm-list__name";
      name.textContent = buildFarmDisplayName(farm);

      btn.append(dot, name);
      btn.addEventListener("click", () => events.selectFarm?.(farm.id));
      state.farmListHost.appendChild(btn);
    });

    updateActiveFarm();
  }

  function renderSteps() {
    state.stepsContainer.innerHTML = "";
    state.steps.forEach((label, index) => {
      const stepEl = document.createElement("div");
      stepEl.className = "create-equip__step";
      if (index === state.currentStepIndex) stepEl.classList.add("create-equip__step--active");

      const numEl = document.createElement("span");
      numEl.className = "create-equip__step-num";
      numEl.textContent = String(index + 1);

      const labelEl = document.createElement("span");
      labelEl.className = "create-equip__step-label";
      labelEl.textContent = label;

      stepEl.append(numEl, labelEl);
      state.stepsContainer.appendChild(stepEl);
    });
  }

  function updateFooterLayout() {
    if (!state.prevBtn || !state.footer) return;
    const showPrev = state.currentStepIndex > 0;
    state.prevBtn.style.display = showPrev ? "" : "none";
    state.footer.classList.toggle("no-prev", !showPrev);
  }

  function setButtons() {
    const isLast = state.currentStepIndex === state.steps.length - 1;
    state.nextBtn.textContent = isLast ? "Finalizar" : "Próximo";
  }

  function renderPlaceholder(label) {
    state.bodyHost.innerHTML = `
      <div style="padding:14px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;">
        <strong>${label}</strong><br/>
        <span style="color:#6b7280;">Conteúdo em construção.</span>
      </div>
    `;
  }

  function renderStepContent() {
    const label = state.steps[state.currentStepIndex];
    const stepKeyMap = {
      "Geral": "geral",
      "Faturamento": "billing",
      "Contato": "contact",
      "Faixas de Energia": "energy",
      "Localização": "location",
      "Localizacao": "location",
    };
    const stepKey = stepKeyMap[label] || label;
    renderSteps();
    setButtons();
    updateFooterLayout();

    if (stepKey === "geral") {
      state.bodyHost.innerHTML = `
        <div class="equip-wizard__head">
          <div class="equip-wizard__title"></div>
          <div class="equip-wizard__subtitle"></div>
        </div>
        <div class="equip-form">
          <div class="equip-field">
            <label class="equip-label" for="farmGeneralName"><span class="equip-required">*</span>Nome da fazenda</label>
            <input class="equip-input" id="farmGeneralName" name="farm_name" type="text" placeholder="Recanto da Serra" data-farm-name />
          </div>

          <div class="equip-form__row">
            <div class="equip-field">
              <label class="equip-label" for="farmGeneralEnergyDay"><span class="equip-required">*</span>Dia da fatura de energia</label>
              <input class="equip-input" id="farmGeneralEnergyDay" name="farm_energy_bill_day" type="number" min="1" max="31" inputmode="numeric" placeholder="1" data-farm-energy-day />
            </div>
            <div class="equip-field">
              <label class="equip-label" for="farmGeneralWaterDay"><span class="equip-required">*</span>Dia da fatura de água</label>
              <input class="equip-input" id="farmGeneralWaterDay" name="farm_water_bill_day" type="number" min="1" max="31" inputmode="numeric" placeholder="1" data-farm-water-day />
            </div>
          </div>

          <label class="equip-check">
            <input class="equip-check__input" id="farmGeneralHasCentral" name="farm_has_central" type="checkbox" data-farm-has-central />
            <span>A fazenda possui Central?</span>
          </label>

          <div class="equip-field">
            <label class="equip-label" for="farmGeneralTimezone"><span class="equip-required">*</span>Fuso horário</label>
            <select class="equip-input" id="farmGeneralTimezone" name="farm_timezone" data-farm-timezone>
              <option value="Africa/Abidjan">África/Abidjan (GMT+00)</option>
              <option value="America/Sao_Paulo">América/Sao_Paulo (GMT-03)</option>
              <option value="America/Cuiaba">América/Cuiabá (GMT-04)</option>
              <option value="America/Manaus">América/Manaus (GMT-04)</option>
              <option value="America/Rio_Branco">América/Rio Branco (GMT-05)</option>
              <option value="UTC">UTC (GMT+00)</option>
            </select>
          </div>
        </div>
      `;
      events.bindGeneralStep?.();
      events.initFarmSelects?.(state.bodyHost);
      return;
    }

    if (stepKey === "billing") {
      state.bodyHost.innerHTML = `
        <div class="farm-billing" data-farm-billing>
          <div class="farm-billing__intro">
            <div class="equip-alert farm-billing__alert" role="note">
              <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
              <span>As informações devem ser do cliente!</span>
            </div>
            <p class="farm-billing__hint">
              Essas informações serão utilizadas para emitir faturas relacionadas ao uso da plataforma Irricontrol.
            </p>
          </div>

          <section class="farm-billing__section">
            <header class="farm-billing__section-head">
              <h4 class="farm-billing__section-title">Endereço de Faturamento</h4>
            </header>

            <div class="equip-form farm-billing__grid farm-billing__grid--country">
              <div class="equip-field farm-billing__field" data-field="country">
                <label class="equip-label" for="farmBillingCountry">
                  <span class="equip-required">*</span>
                  <span data-label-text>País</span>
                </label>
                <select class="equip-input" id="farmBillingCountry" name="billing_country" data-country data-input required>
                  <option value="">Selecione o país</option>
                  <option value="BR">Brasil</option>
                  <option value="US">Estados Unidos</option>
                  <option value="DE">Alemanha</option>
                  <option value="ZA">África do Sul</option>
                </select>
              </div>

              <div class="equip-field farm-billing__field" data-field="postal" data-billing-details>
                <label class="equip-label" for="farmBillingPostal">
                  <span class="equip-required">*</span>
                  <span data-label-text>CEP</span>
                </label>
                <input class="equip-input" id="farmBillingPostal" name="billing_postal_code" data-input type="text" placeholder="00000-000" required />
              </div>

              <div class="equip-field farm-billing__field" data-field="city" data-billing-details>
                <label class="equip-label" for="farmBillingCity">
                  <span class="equip-required">*</span>
                  <span data-label-text>Cidade</span>
                </label>
                <input class="equip-input" id="farmBillingCity" name="billing_city" data-input type="text" placeholder="Ex: Goiânia" required />
              </div>
            </div>

            <div class="farm-billing__details is-hidden" data-billing-details>
              <div class="equip-form farm-billing__grid farm-billing__grid--address">
                <div class="equip-field farm-billing__field farm-billing__field--span-2" data-field="address">
                  <label class="equip-label" for="farmBillingAddress">
                    <span class="equip-required">*</span>
                    <span data-label-text>Endereço</span>
                  </label>
                  <input class="equip-input" id="farmBillingAddress" name="billing_address" data-input type="text" placeholder="Ex: Av. Brasil, 120" required />
                </div>

                <div class="equip-field farm-billing__field" data-field="region">
                  <label class="equip-label" for="farmBillingRegion">
                    <span class="equip-required">*</span>
                    <span data-label-text>Estado (UF)</span>
                  </label>
                  <input class="equip-input farm-billing__control" id="farmBillingRegion" name="billing_region" data-region-input type="text" placeholder="Ex: SP" />
                  <select class="equip-input farm-billing__control" id="farmBillingRegionSelect" name="billing_region_code" data-region-select></select>
                </div>

                <div class="equip-field farm-billing__field" data-field="neighborhood">
                  <label class="equip-label" for="farmBillingNeighborhood">
                    <span data-label-text>Bairro</span>
                  </label>
                  <input class="equip-input" id="farmBillingNeighborhood" name="billing_neighborhood" data-input type="text" placeholder="Opcional" />
                </div>
              </div>
            </div>
          </section>

          <section class="farm-billing__section farm-billing__details is-hidden" data-billing-details>
            <header class="farm-billing__section-head">
              <h4 class="farm-billing__section-title">Informações de Faturamento</h4>
            </header>

            <div class="equip-form farm-billing__grid farm-billing__grid--billing-top">
              <div class="equip-field farm-billing__field farm-billing__field--span-2" data-field="docGroup">
                <label class="equip-label" for="farmBillingDocType">
                  <span class="equip-required">*</span>
                  <span data-label-text>Documento</span>
                </label>
                <div class="farm-billing__doc">
                  <select class="equip-input" id="farmBillingDocType" name="billing_document_type" data-doc-type aria-label="Tipo de documento" required></select>
                  <input class="equip-input" id="farmBillingDocNumber" name="billing_document_number" type="text" placeholder="000.000.000-00" aria-label="Número do documento" required />
                </div>
              </div>

              <div class="equip-field farm-billing__field" data-field="legalName">
                <label class="equip-label" for="farmBillingName">
                  <span class="equip-required">*</span>
                  <span data-label-text>Nome completo</span>
                </label>
                <input class="equip-input" id="farmBillingName" name="billing_legal_name" type="text" placeholder="Nome completo" required />
              </div>
            </div>

            <div class="equip-form farm-billing__grid farm-billing__grid--billing-bottom">
              <div class="equip-field farm-billing__field" data-field="phone">
                <label class="equip-label" for="farmBillingPhone">
                  <span class="equip-required">*</span>
                  <span data-label-text>Celular</span>
                </label>
                <input class="equip-input" id="farmBillingPhone" name="billing_phone" type="tel" placeholder="(00) 00000-0000" required />
              </div>

              <div class="equip-field farm-billing__field" data-field="email">
                <label class="equip-label" for="farmBillingEmail">
                  <span class="equip-required">*</span>
                  <span data-label-text>E-mail</span>
                </label>
                <input class="equip-input" id="farmBillingEmail" name="billing_email" type="email" placeholder="exemplo@mail.com.br" required />
              </div>
            </div>
          </section>
        </div>
      `;
      events.bindBillingForm?.(null, { applyState: true, syncState: true });
      events.initFarmSelects?.(state.bodyHost);
      return;
    }

    if (stepKey === "contact") {
      state.bodyHost.innerHTML = `
        <div class="farm-billing farm-contact" data-farm-contact>
          <section class="farm-billing__section">
            <header class="farm-billing__section-head">
              <h4 class="farm-billing__section-title">Endereço de Contato</h4>
            </header>

            <div class="farm-billing__details farm-contact__toggle is-hidden" data-contact-details>
              <label class="farm-switch">
                <input class="farm-switch__input" id="farmContactSameRender" type="checkbox" data-contact-same />
                <span class="farm-switch__track" aria-hidden="true"></span>
                <span class="farm-switch__label">Mesmo do endereço de faturamento</span>
              </label>
            </div>

            <div class="equip-form farm-billing__grid farm-billing__grid--country">
              <div class="equip-field farm-billing__field" data-field="country">
                <label class="equip-label" for="farmContactCountry">
                  <span class="equip-required">*</span>
                  <span data-label-text>País</span>
                </label>
                <select class="equip-input" id="farmContactCountry" name="contact_country" data-country data-input required>
                  <option value="">Selecione o país</option>
                  <option value="BR">Brasil</option>
                  <option value="US">Estados Unidos</option>
                  <option value="DE">Alemanha</option>
                  <option value="ZA">África do Sul</option>
                </select>
              </div>

              <div class="equip-field farm-billing__field" data-field="postal" data-contact-details>
                <label class="equip-label" for="farmContactPostal">
                  <span class="equip-required">*</span>
                  <span data-label-text>CEP</span>
                </label>
                <input class="equip-input" id="farmContactPostal" name="contact_postal_code" data-input type="text" placeholder="00000-000" required />
              </div>

              <div class="equip-field farm-billing__field" data-field="city" data-contact-details>
                <label class="equip-label" for="farmContactCity">
                  <span class="equip-required">*</span>
                  <span data-label-text>Cidade</span>
                </label>
                <input class="equip-input" id="farmContactCity" name="contact_city" data-input type="text" placeholder="Ex: Goiânia" required />
              </div>
            </div>

            <div class="farm-billing__details is-hidden" data-contact-details>
              <div class="equip-form farm-billing__grid farm-billing__grid--address" data-contact-address>
                <div class="equip-field farm-billing__field farm-billing__field--span-2" data-field="address">
                  <label class="equip-label" for="farmContactAddress">
                    <span class="equip-required">*</span>
                    <span data-label-text>Endereço</span>
                  </label>
                  <input class="equip-input" id="farmContactAddress" name="contact_address" data-input type="text" placeholder="Ex: Av. Brasil, 120" required />
                </div>

                <div class="equip-field farm-billing__field" data-field="region">
                  <label class="equip-label" for="farmContactRegion">
                    <span class="equip-required">*</span>
                    <span data-label-text>Estado (UF)</span>
                  </label>
                  <input class="equip-input farm-billing__control" id="farmContactRegion" name="contact_region" data-region-input type="text" placeholder="Ex: SP" />
                  <select class="equip-input farm-billing__control" id="farmContactRegionSelect" name="contact_region_code" data-region-select></select>
                </div>

                <div class="equip-field farm-billing__field" data-field="neighborhood">
                  <label class="equip-label" for="farmContactNeighborhood">
                    <span data-label-text>Bairro</span>
                  </label>
                  <input class="equip-input" id="farmContactNeighborhood" name="contact_neighborhood" data-input type="text" placeholder="Opcional" />
                </div>
              </div>
            </div>
          </section>

          <section class="farm-billing__section farm-billing__details is-hidden" data-contact-details>
            <header class="farm-billing__section-head">
              <h4 class="farm-billing__section-title">Informações de Contato</h4>
            </header>

            <div class="equip-form farm-billing__grid">
              <div class="equip-field farm-billing__field" data-field="phone">
                <label class="equip-label" for="farmContactPhone">
                  <span class="equip-required">*</span>
                  <span data-label-text>Celular</span>
                </label>
                <input class="equip-input" id="farmContactPhone" name="contact_phone" type="tel" placeholder="+55 (00) 90000-0000" required />
              </div>
              <div class="equip-field farm-billing__field" data-field="email">
                <label class="equip-label" for="farmContactEmail">
                  <span data-label-text>E-mail</span>
                </label>
                <input class="equip-input" id="farmContactEmail" name="contact_email" type="email" placeholder="contato@email.com" />
              </div>
            </div>
          </section>
        </div>
      `;
      events.bindContactForm?.();
      events.initFarmSelects?.(state.bodyHost);
      return;
    }

    if (stepKey === "energy") {
      state.bodyHost.innerHTML = `
        <div class="farm-energy">
          <div class="farm-energy__note" role="note">
            Faixas de energia são períodos específicos durante o dia nos quais o custo da energia elétrica pode variar. Você pode personalizar as faixas da sua fazenda no menu de configurações.
          </div>

          <p class="farm-energy__lead">
            Selecione o padrão que melhor te atende baseado nas faixas de energia por horário da sua região
          </p>

          <div class="farm-energy__grid">
            <button class="farm-energy__card" type="button" data-energy-card aria-pressed="false">
              <span class="farm-energy__card-title">Ponta entre 17:00 e 20:00</span>
              <span class="farm-energy__card-desc">Define horário de ponta entre 17:00 e 20:00 durante dias úteis.</span>
            </button>

            <button class="farm-energy__card" type="button" data-energy-card aria-pressed="false">
              <span class="farm-energy__card-title">Ponta entre 18:00 e 21:00</span>
              <span class="farm-energy__card-desc">Define horário de ponta entre 18:00 e 21:00 durante dias úteis.</span>
            </button>

            <button class="farm-energy__card is-selected" type="button" data-energy-card aria-pressed="true">
              <span class="farm-energy__card-title">Personalizado</span>
              <span class="farm-energy__card-desc">Personalize mais tarde no menu de configurações da sua fazenda.</span>
            </button>
          </div>
        </div>
      `;
      events.bindEnergyStep?.();
      return;
    }

    if (stepKey === "location") {
      state.bodyHost.innerHTML = `
        <div class="farm-location">
          <div class="farm-location__row">
            <div class="equip-field farm-location__field">
              <label class="equip-label" for="farmLocationInput">
                <span class="equip-required">*</span>
                <span>Localização da fazenda</span>
              </label>
              <div class="farm-location__input">
                <input
                  class="equip-input farm-location__input-field"
                  id="farmLocationInput"
                  name="farm_location"
                  type="text"
                  placeholder="-22.008419, -46.812567"
                  data-location-input
                  required
                />
              </div>
            </div>

            <button class="equip-btn btn btn--outline farm-location__btn sc-loc__btn" type="button" data-location-btn>
              <i class="fa-solid fa-location-dot" aria-hidden="true" style="color:#22c55e;"></i> Obter Localização
            </button>
          </div>

          <div class="farm-location__radius" style="width:100%; display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; border:none; background:transparent; padding:0; border-radius:0;">
            <div class="farm-radio-field">
              <div class="farm-radio-field__header">
                <span class="farm-radio-field__label">Rádio da central</span>
              </div>
              <div class="farm-radio-field__value">
                <div class="sc-input-group">
                  <input class="equip-input sc-input farm-radio-input" type="text" name="farm_radius" placeholder="0000000000000000" data-location-radius readonly>
                  <div class="farm-radio-actions">
                    <button type="button" class="farm-radio-clear" title="Limpar"><i class="fa-solid fa-xmark"></i></button>
                    <span class="farm-radio-status"><i class="fa-solid fa-check"></i></span>
                  </div>
                  <button type="button" class="farm-radio-qr" title="Escanear QR Code"><i class="fa-solid fa-qrcode"></i></button>
                </div>
              </div>
            </div>

            <div class="farm-radio-field" style="visibility:hidden;" aria-hidden="true">
              <div class="farm-radio-field__header">
                <span class="farm-radio-field__label">Rádio do controlador</span>
              </div>
              <div class="farm-radio-field__value">
                <div class="sc-input-group">
                  <input class="equip-input sc-input farm-radio-input" type="text" name="farm_radio_control" placeholder="0000000000000000" data-location-radio-control readonly>
                  <div class="farm-radio-actions">
                    <button type="button" class="farm-radio-clear" title="Limpar"><i class="fa-solid fa-xmark"></i></button>
                    <span class="farm-radio-status"><i class="fa-solid fa-check"></i></span>
                  </div>
                  <button type="button" class="farm-radio-qr" title="Escanear QR Code"><i class="fa-solid fa-qrcode"></i></button>
                </div>
              </div>
            </div>

            <div class="farm-radio-field" style="visibility:hidden;" aria-hidden="true">
              <div class="farm-radio-field__header">
                <span class="farm-radio-field__label">Rádio do GPS</span>
              </div>
              <div class="farm-radio-field__value">
                <div class="sc-input-group">
                  <input class="equip-input sc-input farm-radio-input" type="text" name="farm_radio_gps" placeholder="0000000000000000" data-location-radio-gps readonly>
                  <div class="farm-radio-actions">
                    <button type="button" class="farm-radio-clear" title="Limpar"><i class="fa-solid fa-xmark"></i></button>
                    <span class="farm-radio-status"><i class="fa-solid fa-check"></i></span>
                  </div>
                  <button type="button" class="farm-radio-qr" title="Escanear QR Code"><i class="fa-solid fa-qrcode"></i></button>
                </div>
              </div>
            </div>
          </div>

          <div class="farm-location__map" data-location-map></div>
        </div>
      `;
      CreateFarm.view?.map?.bindLocationStep?.();
      return;
    }

    renderPlaceholder(label);
  }

  render.renderEquipmentPanels = renderEquipmentPanels;
  render.clearEquipmentPanels = clearEquipmentPanels;
  render.renderFarmList = renderFarmList;
  render.updateActiveFarm = updateActiveFarm;
  render.renderSteps = renderSteps;
  render.updateFooterLayout = updateFooterLayout;
  render.setButtons = setButtons;
  render.renderPlaceholder = renderPlaceholder;
  render.renderStepContent = renderStepContent;
})();
