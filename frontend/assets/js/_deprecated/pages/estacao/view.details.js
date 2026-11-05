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

  function getActiveFarmSafe() {
    return window.IcFarmGetActive?.() || window.icFarmData || window.IcFarmActive || null;
  }

  function getMedidoresList() {
    const farm = getActiveFarmSafe();
    const list = farm?.equipments || farm?.equipamentos || [];
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

  function toNumber(val) {
    if (val === null || val === undefined || val === "") return null;
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  }

  function parseLatLngText(text) {
    if (!text) return null;
    const parts = String(text).replaceAll(";", ",").split(/,|\s+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length < 2) return null;
    const lat = Number(parts[0].replace(",", "."));
    const lng = Number(parts[1].replace(",", "."));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }

  function hashStr(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) >>> 0;
    }
    return h;
  }

  function seededRandom(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6d2b79f5;
      let x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

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
    const percent = percentRaw === null ? Math.round(40 + rand() * 50) : Math.max(0, Math.min(100, percentRaw));

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
    let trend = { label: "Estável", dir: "flat" };
    if (trendRaw.includes("sub")) trend = { label: "Subindo", dir: "up" };
    else if (trendRaw.includes("cai") || trendRaw.includes("down")) trend = { label: "Caindo", dir: "down" };
    else {
      const pick = seed % 3;
      trend = pick === 0 ? { label: "Subindo", dir: "up" } : pick === 1 ? { label: "Caindo", dir: "down" } : { label: "Estável", dir: "flat" };
    }

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

  function formatLastUpdate(val) {
    if (!val) return "—";
    const date = new Date(val);
    if (Number.isNaN(date.getTime())) return String(val);
    const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    return `${dd} ${MONTHS[date.getMonth()]} ${date.getFullYear()} ${hh}:${min}`;
  }

  async function showDetailsView(options = {}) {
    const mdnId = options.mdnId ?? null;
    if (mdnId) state.detailsFocusId = mdnId;

    if (isDetailsOpen()) {
      renderDetails();
      updateDetailsMinimap();
      const panel = $("mdndPanel");
      if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    document.body.classList.remove("is-pivo-details-only");
    document.body.classList.add("is-mdnd");
    unbindDetailsEvents();

    const mapCard = document.getElementById("mapCard");
    if (mapCard) mapCard.style.display = "none";

    const slot = document.getElementById("pageSlot");
    if (!slot) return;
    try {
      const html = await fetch("./pages/medidor.details.html").then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); });
      slot.innerHTML = html;
    } catch (err) {
      console.error("[MdnDetails] Failed to load medidor.details.html", err);
      document.body.classList.remove("is-mdnd");
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
      trendEl.classList.toggle("is-up", d.trend.dir === "up");
      trendEl.classList.toggle("is-down", d.trend.dir === "down");
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
  }

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = String(value);
  }

  function populateSelector() {
    const menu = $("mdndSelectorMenu");
    if (!menu) return;
    const list = getMedidoresList();
    const current = getFocusMdn();

    if (!list.length) {
      menu.innerHTML = `<div style="padding:10px 12px;font-size:12px;color:#64748b;">Nenhum medidor encontrado.</div>`;
      return;
    }

    menu.innerHTML = list.map((m) => {
      const name = m.name || m.data?.nome || m.data?.serial || "MDN";
      const active = current && String(m.id) === String(current.id);
      return `<button class="pivo-selector__item ${active ? "is-selected" : ""}" type="button" data-mdnd-option data-value="${m.id}">
        ${active ? '<i class="fa-solid fa-check" style="color:#7c3aed;font-size:11px;"></i>' : ""}
        ${name}
      </button>`;
    }).join("");
  }

  function bindDetailsEvents() {
    if (detailsEventsBound) return;
    detailsEventsBound = true;

    const panel = $("mdndPanel");
    if (panel) {
      panel.addEventListener("click", (e) => {
        const backBtn = e.target.closest(".js-details-back");
        if (backBtn) {
          window.IcNavigate?.("visao-geral");
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
      minimapMarker = L.circleMarker([Number(d.center.lat), Number(d.center.lng)], {
        radius: 8,
        color: "#6d28d9",
        fillColor: "#7c3aed",
        fillOpacity: 0.9,
        weight: 2,
      }).addTo(minimapInstance);
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
    } else {
      minimapMarker = L.circleMarker(ll, {
        radius: 8,
        color: "#6d28d9",
        fillColor: "#7c3aed",
        fillOpacity: 0.9,
        weight: 2,
      }).addTo(minimapInstance);
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






