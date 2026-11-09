// assets/js/pages/medidores/view.details.js
(function () {
  "use strict";

  const Mdn = (window.Mdn = window.Mdn || {});
  const state = (Mdn.state = Mdn.state || {});
  const views = (Mdn.views = Mdn.views || {});
  const detailsView = (views.details = views.details || {});
  const $ = (id) => document.getElementById(id);

  let minimapInstance = null;
  let minimapMarker = null;
  let detailsEventsBound = false;
  let onDocClickDetails = null;

  function isDetailsOpen() {
    return document.body.classList.contains("is-mdnd") &&
      !!document.getElementById("mdndPanel");
  }

  // getActiveFarmSafe/getFarmEquipmentsSafe/normalizeEquipmentText/
  // isWeatherStationEquipment compartilhados \u2014 ver assets/js/core/farm-utils.js
  const { getActiveFarmSafe, getFarmEquipmentsSafe, normalizeEquipmentText, isWeatherStationEquipment } = window.IcFarm;

  function getMedidoresList() {
    const farm = getActiveFarmSafe();
    const list = getFarmEquipmentsSafe(farm);
    return list.filter((e) => {
      const type = String(e?.type || "").toLowerCase();
      const cat = String(e?.category || "").toLowerCase();
      return type === "medidor" || cat === "medidores";
    });
  }

  function getFocusMdn() {
    const list = getMedidoresList();
    if (!list.length) return null;
    if (state.detailsFocusId) {
      return list.find((m) => String(m.id) === String(state.detailsFocusId)) || list[0];
    }
    return list[0];
  }

  // toNumber/parseLatLngText/hashStr/seededRandom compartilhados — ver
  // assets/js/core/equip-utils.js
  const { toNumber, parseLatLngText, hashStr, seededRandom } = window.IcEquipUtils;

  function normalizeMdn(equip) {
    const data = equip?.data || {};
    const name = equip?.name || data.nome || data.serial || "MDN";
    const id = equip?.id || data.serial || name;

    const lat = toNumber(data.lat);
    const lng = toNumber(data.lng);
    const center =
      Number.isFinite(lat) && Number.isFinite(lng)
        ? { lat, lng }
        : parseLatLngText(data.loc);

    const percentRaw =
      toNumber(data.levelPercent) ??
      toNumber(data.percent) ??
      toNumber(data.nivelPercent);

    const seed = hashStr(String(id));
    const rand = seededRandom(seed);
    // Sem leitura salva: leitura atual do histórico fictício (mesma do mapa/gráfico)
    const engineNow = percentRaw === null && window.IcDemoHistory ? window.IcDemoHistory.meter.current(equip) : null;
    const percent = percentRaw === null ? (engineNow ? engineNow.pct : Math.round(40 + rand() * 50)) : Math.max(0, Math.min(100, percentRaw));

    const capacity =
      toNumber(data.capacidadeM3) ??
      toNumber(data.capacidade) ??
      Math.round(200 + rand() * 500);

    const volumeRaw =
      toNumber(data.volumeAtual) ??
      toNumber(data.volume) ??
      toNumber(data.volumeM3);
    const volume = volumeRaw === null ? Math.round((percent / 100) * capacity) : volumeRaw;

    const autonomyRaw =
      toNumber(data.autonomiaDias) ??
      toNumber(data.autonomia) ??
      toNumber(data.autonomiaDays);
    const autonomy = autonomyRaw === null ? Math.round((1 + rand() * 7) * 10) / 10 : autonomyRaw;

    const trendRaw = String(data.tendencia || data.trend || "").toLowerCase();
    let trend = { label: "Subindo", dir: "up" };
    if (trendRaw.includes("cai") || trendRaw.includes("down")) trend = { label: "Caindo", dir: "down" };
    else if (trendRaw.includes("estavel") || trendRaw.includes("flat")) trend = { label: "Estável", dir: "flat" };

    const statusRaw = String(data.status || "");
    const offline = data.semComunicacao === true || statusRaw.toLowerCase() === "offline";

    const updated = data.updated || equip?.updatedAt || equip?.createdAt || "";

    return {
      id,
      name,
      center,
      percent,
      volume,
      capacity,
      autonomy,
      trend,
      offline,
      updated
    };
  }

  // formatLastUpdate compartilhado — ver assets/js/core/equip-utils.js
  const { formatLastUpdate } = window.IcEquipUtils;

  async function showDetailsView(options = {}) {
    const mdnId = options.mdnId ?? null;
    const fromMap = options.fromMap === true;
    if (mdnId) state.detailsFocusId = mdnId;

    if (isDetailsOpen()) {
      renderDetails();
      updateDetailsMinimap();
      if (fromMap) {
        const panel = $("mdndPanel");
        if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }

    document.body.classList.remove("is-pivo-details-only");
    document.body.classList.add("is-mdnd");
    window.icMapSetWheelMode?.("ctrl");
    unbindDetailsEvents();

    const slot = document.getElementById("pageSlot");
    if (!slot) {
      document.body.classList.remove("is-mdnd");
      window.icMapSetWheelMode?.("free");
      return;
    }
    try {
      const html = await fetch("./pages/medidor.details.html").then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); });
      slot.innerHTML = html;
    } catch (err) {
      console.error("[MdnDetails] Failed to load medidor.details.html", err);
      document.body.classList.remove("is-mdnd");
      window.icMapSetWheelMode?.("free");
      return;
    }

    bindDetailsEvents();
    renderDetails();
    initDetailsMinimap();
    populateSelector();

    setTimeout(() => {
      const panel = $("mdndPanel") || slot;
      if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);

    const map = window.icMap;
    if (map && typeof map.invalidateSize === "function") {
      map.invalidateSize({ pan: false });
      requestAnimationFrame(() => map.invalidateSize({ pan: false }));
      setTimeout(() => map.invalidateSize({ pan: false }), 180);
    }
  }

  function destroyDetailsView() {
    document.body.classList.remove("is-mdnd");
    window.icMapSetWheelMode?.("free");
    state.detailsFocusId = null;
    unbindDetailsEvents();

    destroyDetailsMinimap();

    const slot = document.getElementById("pageSlot");
    if (slot) slot.innerHTML = "";

    const mapCard = document.getElementById("mapCard");
    if (mapCard) mapCard.style.display = "";

    const map = window.icMap;
    if (map && typeof map.invalidateSize === "function") {
      map.invalidateSize({ pan: false });
      requestAnimationFrame(() => map.invalidateSize({ pan: false }));
      setTimeout(() => map.invalidateSize({ pan: false }), 220);
    }

    window.dispatchEvent(new Event("ic:layout-change"));
  }

  function unbindDetailsEvents() {
    detailsEventsBound = false;

    if (onDocClickDetails) {
      document.removeEventListener("click", onDocClickDetails);
      onDocClickDetails = null;
    }
  }

  function renderDetails() {
    const equip = getFocusMdn();
    if (!equip) return;
    const d = normalizeMdn(equip);

    setText("mdndTitleLabel", d.name || "MDN");
    setText("mdndKpiLevel", `${Math.round(d.percent)}%`);
    setText("mdndKpiVolume", `${Math.round(d.volume)} m³`);
    setText("mdndKpiAutonomy", `${Number(d.autonomy).toFixed(1)} dias`);
    setText("mdndKpiStatus", d.offline ? "Offline" : "Normal");
    setText("mdndKpiCapacity", `${Math.round(d.capacity)} m³`);

    const trendEl = $("mdndKpiTrend");
    if (trendEl) {
      trendEl.textContent = d.trend.label;
      trendEl.classList.remove("is-up", "is-down");
    }

    setText("mdndLastUpdate", formatLastUpdate(d.updated));

    setText("mdndSummaryLevel", `${Math.round(d.percent)}%`);
    setText("mdndSummaryStatus", d.offline ? "Sem comunicação" : "Normal");
    setText("mdndSummaryVolume", `${Math.round(d.volume)} m³`);
    setText("mdndSummaryVolumeMeta", `de ${Math.round(d.capacity)} m³ total`);
    setText("mdndSummaryAutonomy", `${Number(d.autonomy).toFixed(1)} dias`);
    setText("mdndSummaryTrend", d.trend.label);

    setText("mdndChartValue", `${Math.round(d.percent)}%`);

    const dot = $("mdndStatusDot");
    const bar = $("mdndStatusBar");
    const text = $("mdndStatusText");
    if (dot) {
      dot.classList.toggle("is-offline", d.offline);
      dot.classList.toggle("is-running", !d.offline);
    }
    if (bar) {
      bar.classList.toggle("is-offline", d.offline);
      bar.classList.toggle("is-running", !d.offline);
    }
    if (text) text.textContent = d.offline ? "SEM COMUNICAÇÃO" : "MONITORANDO";

    renderLevelHistory(equip);
  }

  // =========================
  // Histórico + gráfico de nível — gerados pelo motor único
  // (assets/js/core/demo-history.js), leitura a cada 15 min, filtrados
  // pelo período global (mesmo popover do pivô/bomba/pluviometria).
  // =========================
  const HIST_PAGE_SIZE = 10;
  let historyPageMdn = 1;

  function levelRange() {
    return window.IcDemoHistory.periodFrom(window.Plv?.state?.period, 1);
  }

  function renderLevelHistory(equip) {
    const DH = window.IcDemoHistory;
    const panel = $("mdndPanel");
    if (!DH || !equip || !panel) return;
    window.Plv?.period?.syncUI?.();
    const range = levelRange();
    const model = DH.meter.model(equip);
    const readings = DH.meter.readings(equip, range.start, range.end, 15); // recente → antigo
    const cur = DH.meter.current(equip);
    const fm = (v) => `${v.toFixed(2)} m`;

    setText("mdndKpiMin", `Min.: ${Math.round(model.minPct)}%`);
    setText("mdndKpiMax", `Max.: ${Math.round(model.maxPct)}%`);
    setText("mdndLastUpdate", DH.fmt.dateTime(cur.lastCommunication));

    // Tabela
    const body = panel.querySelector(".mdnd-history tbody");
    const total = Math.max(1, Math.ceil(readings.length / HIST_PAGE_SIZE));
    historyPageMdn = Math.min(Math.max(1, historyPageMdn), total);
    if (body) {
      const slice = readings.slice((historyPageMdn - 1) * HIST_PAGE_SIZE, historyPageMdn * HIST_PAGE_SIZE);
      body.innerHTML = slice.length
        ? slice.map((r) => `<tr class="pivo-history__row"><td>${DH.fmt.dateTime(r.date)}</td><td>${fm(r.measure)}</td><td>${fm(r.offset)}</td><td>${fm(r.level)} <small style="color:#94a3b8">(${r.pct.toFixed(0)}%)</small></td></tr>`).join("")
        : `<tr class="pivo-history__row"><td colspan="4" style="text-align:center;padding:28px 12px;color:#64748b;">Nenhuma leitura no período selecionado.</td></tr>`;
    }
    const pager = panel.querySelector(".mdnd-history .pivo-history__pagination");
    if (pager) {
      pager.innerHTML = DH.paginationHtml(historyPageMdn, total);
      pager.style.display = total > 1 ? "" : "none";
    }

    // Gráfico (ordem cronológica, reduzido a ~160 pontos)
    const chrono = readings.slice().reverse();
    const step = Math.max(1, Math.floor(chrono.length / 160));
    const pts = chrono.filter((_, i) => i % step === 0 || i === chrono.length - 1);
    const maxM = Math.max(1, Math.ceil(model.maxM));
    const W = 1000;
    const TOP = 10;
    const BOT = 270;
    const y = (m) => BOT - (m / maxM) * (BOT - TOP);
    const t0 = range.start.getTime();
    const t1 = Math.max(t0 + 1, range.end.getTime());
    const x = (d) => ((d.getTime() - t0) / (t1 - t0)) * W;
    const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.level).toFixed(1)}`).join(" ");
    const svg = panel.querySelector(".mdnd-level-svg");
    if (svg && pts.length) {
      const first = x(pts[0].date).toFixed(1);
      const last = x(pts[pts.length - 1].date).toFixed(1);
      svg.querySelector(".mdnd-level-line")?.setAttribute("d", line);
      svg.querySelector(".mdnd-level-fill")?.setAttribute("d", `${line} L${last},${BOT} L${first},${BOT} Z`);
      const maxLine = svg.querySelector(".mdnd-level-ref--max");
      const minLine = svg.querySelector(".mdnd-level-ref--min");
      const yMax = y((model.maxPct / 100) * model.maxM).toFixed(1);
      const yMin = y((model.minPct / 100) * model.maxM).toFixed(1);
      maxLine?.setAttribute("y1", yMax); maxLine?.setAttribute("y2", yMax);
      minLine?.setAttribute("y1", yMin); minLine?.setAttribute("y2", yMin);
    }
    const yAxis = panel.querySelector(".mdnd-level-y");
    if (yAxis) yAxis.innerHTML = [1, 0.75, 0.5, 0.25, 0].map((f) => `<span>${(maxM * f).toFixed(maxM * f % 1 ? 1 : 0)}m</span>`).join("");
    const xAxis = panel.querySelector(".mdnd-level-x");
    if (xAxis) {
      const spanH = (t1 - t0) / 3600000;
      const n = 6;
      const labels = Array.from({ length: n }, (_, i) => new Date(t0 + ((t1 - t0) * i) / (n - 1)));
      xAxis.innerHTML = labels.map((d) => `<span>${spanH <= 26 ? DH.fmt.time(d) : DH.fmt.dayMonth(d)}</span>`).join("");
    }
    const legMin = panel.querySelector(".mdnd-level-legend__item--min");
    const legMax = panel.querySelector(".mdnd-level-legend__item--max");
    if (legMin) legMin.textContent = `Nível mínimo (${Math.round(model.minPct)}%)`;
    if (legMax) legMax.textContent = `Nível máximo (${Math.round(model.maxPct)}%)`;

    // Indicador: nível atual e variação vs período anterior (média)
    const avg = (arr) => (arr.length ? arr.reduce((a, r) => a + r.pct, 0) / arr.length : 0);
    const span = t1 - t0;
    const prev = DH.meter.readings(equip, new Date(t0 - span), new Date(t0), 30);
    const diff = avg(readings) - avg(prev);
    const kpiVal = panel.querySelector(".mdnd-level-kpi__val");
    const kpiTrend = panel.querySelector(".mdnd-level-kpi__trend");
    if (kpiVal) kpiVal.textContent = `${Math.round(cur.pct)}%`;
    if (kpiTrend) {
      kpiTrend.textContent = `${diff >= 0 ? "+" : ""}${diff.toFixed(0)}% vs período anterior`;
      kpiTrend.style.color = diff >= 0 ? "#16a34a" : "";
    }
  }

  document.addEventListener("pluv:periodChanged", () => {
    if (!$("mdndPanel")) return;
    historyPageMdn = 1;
    renderLevelHistory(getFocusMdn());
  });

  // setText compartilhado — ver assets/js/core/equip-utils.js
  const { setText } = window.IcEquipUtils;

  function populateSelector() {
    const menu = $("mdndSelectorMenu");
    if (!menu) return;
    const current = getFocusMdn();
    renderAllEquipmentInMenu(menu, current?.id, "medidores", () => window.IcMdnDetails?.close?.());
  }

  function renderAllEquipmentInMenu(menu, currentId, currentType, closeSelf) {
    const farm = getActiveFarmSafe();
    const equipments = getFarmEquipmentsSafe(farm);
    const groups = [
      { label: "Pivôs", type: "pivos", items: equipments.filter(e => { const c = String(e?.category || "").toLowerCase(); return c === "pivos" || c === "pivo" || c === "pivot" || c === "pivots"; }), open: id => window.IcPivos?.open?.({ pivotId: id }) },
      { label: "Bombas", type: "bombas", items: equipments.filter(e => { const t = String(e?.type || "").toLowerCase(); const c = String(e?.category || "").toLowerCase(); return t === "irripump" || c === "bombas"; }), open: id => window.IcBombaDetails?.open?.({ BmbId: id }) },
      { label: "Medidores de Nível", type: "medidores", items: equipments.filter(e => { const t = String(e?.type || "").toLowerCase(); const c = String(e?.category || "").toLowerCase(); return t === "medidor" || c === "medidores"; }), open: id => window.IcMdnDetails?.open?.({ mdnId: id }) },
      { label: "Estações Meteorológicas", type: "estacoes", items: equipments.filter(isWeatherStationEquipment), open: id => window.IcEstacaoDetails?.open?.({ estId: id }) }
    ].filter(g => g.items.length > 0);

    menu.innerHTML = "";
    if (!groups.length) { menu.innerHTML = `<div style="padding:10px 12px;font-size:12px;color:#64748b;">Nenhum equipamento encontrado.</div>`; return; }

    groups.forEach(group => {
      const wrapper = document.createElement("section");
      const hasCurrent = group.type === currentType && group.items.some((item) => String(item.id) === String(currentId));
      wrapper.className = "pivo-selector__group" + (hasCurrent ? " is-open" : "");

      const header = document.createElement("button");
      header.type = "button";
      header.className = "pivo-selector__group-header";
      header.setAttribute("aria-expanded", hasCurrent ? "true" : "false");
      header.innerHTML = `<span class="pivo-selector__group-chevron"><i class="fa-solid fa-caret-right"></i></span><span class="pivo-selector__group-title">${group.label}</span>`;
      header.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const nextOpen = !wrapper.classList.contains("is-open");
        wrapper.classList.toggle("is-open", nextOpen);
        header.setAttribute("aria-expanded", nextOpen ? "true" : "false");
      });

      const body = document.createElement("div");
      body.className = "pivo-selector__group-body";

      group.items.forEach(item => {
        const isCurrent = group.type === currentType && String(item.id) === String(currentId);
        const name = item.name || item.nome || item.data?.nome || item.data?.serial || group.label;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "pivo-selector__item" + (isCurrent ? " is-selected" : "");
        btn.innerHTML = `<span class="pivo-selector__item-mark">${isCurrent ? '<i class="fa-solid fa-check"></i>' : ''}</span><span>${name}</span>`;
        btn.addEventListener("click", ev => {
          ev.stopPropagation();
          menu.style.display = "none";
          const sb = $("mdndSelectBtn"); if (sb) sb.classList.remove("is-active");
          if (!isCurrent) { closeSelf?.(); group.open(item.id); }
        });
        body.appendChild(btn);
      });

      wrapper.appendChild(header);
      wrapper.appendChild(body);
      menu.appendChild(wrapper);
    });
  }

  function bindDetailsEvents() {
    if (detailsEventsBound) return;
    detailsEventsBound = true;

    const panel = $("mdndPanel");
    if (panel) {
      panel.addEventListener("click", (e) => {
        const pageBtn = e.target.closest(".mdnd-history .pivo-history__pagination [data-page]");
        if (pageBtn) {
          if (!pageBtn.disabled) {
            historyPageMdn = Number(pageBtn.dataset.page) || 1;
            renderLevelHistory(getFocusMdn());
          }
          return;
        }
        const backBtn = e.target.closest(".js-details-back");
        if (backBtn) {
          window.IcNavigate?.("visao-geral");
          return;
        }

        // Edit button
        const editBtn = e.target.closest("#mdndEditBtn");
        if (editBtn) {
          if (views.edit && typeof views.edit.showEditView === "function") {
            views.edit.showEditView();
          }
          return;
        }

        const sectionNavBtn = e.target.closest(".pivo-section-nav__btn");
        if (sectionNavBtn) {
          const targetView = sectionNavBtn.getAttribute("data-details-view");
          if (targetView === "pivos") {
            window.IcMdnDetails?.close?.();
            window.IcPivos?.open?.();
            return;
          }
          if (targetView === "pluviometros") {
            window.IcMdnDetails?.close?.();
            window.IcPluvDetails?.open?.();
            return;
          }
          if (targetView === "bombas") {
            window.IcMdnDetails?.close?.();
            window.IcBombaDetails?.open?.();
            return;
          }
          if (targetView === "estacoes") {
            window.IcMdnDetails?.close?.();
            window.IcEstacaoDetails?.open?.();
            return;
          }
        }
      });
    }

    onDocClickDetails = (e) => {
      const menu = $("mdndSelectorMenu");
      const selectBtn = e.target.closest("#mdndSelectBtn");
      if (!menu) return;

      const option = e.target.closest("[data-mdnd-option]");
      if (option) {
        const id = option.getAttribute("data-value");
        if (id) {
          state.detailsFocusId = id;
          menu.style.display = "none";
          populateSelector();
          renderDetails();
          updateDetailsMinimap();
        }
        return;
      }

      if (selectBtn) {
        e.stopPropagation();
        const isHidden = getComputedStyle(menu).display === "none";
        menu.style.display = isHidden ? "flex" : "none";
        return;
      }

      if (!menu.contains(e.target)) {
        menu.style.display = "none";
      }
    };

    document.addEventListener("click", onDocClickDetails);
  }

  function initDetailsMinimap() {
    const container = $("mdndMinimap");
    if (!container || !window.L) return;

    const equip = getFocusMdn();
    const d = equip ? normalizeMdn(equip) : null;
    const hasCoords = d && d.center;
    const center = hasCoords ? [Number(d.center.lat), Number(d.center.lng)] : [-15.79, -47.88];
    const zoom = hasCoords ? 16 : 4;

    if (minimapInstance) {
      try { minimapInstance.remove(); } catch (_) { }
      minimapInstance = null;
      minimapMarker = null;
    }

    minimapInstance = L.map(container, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
    }).setView(center, zoom);

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19 }
    ).addTo(minimapInstance);

    L.tileLayer(
      "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, opacity: 0.85 }
    ).addTo(minimapInstance);

    if (hasCoords) {
      const mdnIcon = L.divIcon({
        className: "",
        html: `<div class="map-mdn-marker" style="--level:${Math.round(d.percent)}%"><div class="mdn-water"></div><span class="map-mdn-marker__value">${Number(d.percent).toFixed(2)}%</span></div>`,
        iconSize: [64, 64],
        iconAnchor: [32, 32],
      });
      minimapMarker = L.marker([Number(d.center.lat), Number(d.center.lng)], { icon: mdnIcon }).addTo(minimapInstance);
    }

    setTimeout(() => minimapInstance?.invalidateSize?.(), 100);
  }

  function updateDetailsMinimap() {
    if (!minimapInstance || !window.L) return;
    const equip = getFocusMdn();
    const d = equip ? normalizeMdn(equip) : null;
    if (!d || !d.center) return;

    const ll = [Number(d.center.lat), Number(d.center.lng)];
    minimapInstance.setView(ll, 16, { animate: false });

    if (minimapMarker) {
      minimapMarker.setLatLng(ll);
      minimapMarker.setIcon(L.divIcon({
        className: "",
        html: `<div class="map-mdn-marker" style="--level:${Math.round(d.percent)}%"><div class="mdn-water"></div><span class="map-mdn-marker__value">${Number(d.percent).toFixed(2)}%</span></div>`,
        iconSize: [64, 64],
        iconAnchor: [32, 32],
      }));
    } else {
      const mdnIcon = L.divIcon({
        className: "",
        html: `<div class="map-mdn-marker" style="--level:${Math.round(d.percent)}%"><div class="mdn-water"></div><span class="map-mdn-marker__value">${Number(d.percent).toFixed(2)}%</span></div>`,
        iconSize: [64, 64],
        iconAnchor: [32, 32],
      });
      minimapMarker = L.marker(ll, { icon: mdnIcon }).addTo(minimapInstance);
    }

    setTimeout(() => minimapInstance?.invalidateSize?.(), 50);
  }

  function destroyDetailsMinimap() {
    if (minimapInstance) {
      try { minimapInstance.remove(); } catch (_) { }
      minimapInstance = null;
      minimapMarker = null;
    }
  }

  detailsView.showDetailsView = showDetailsView;
  detailsView.destroyDetailsView = destroyDetailsView;
})();
