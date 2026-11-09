// assets/js/pages/pluviometria/view.details.js
(function () {
  "use strict";

  const Plv = (window.Plv = window.Plv || {});
  const data = (Plv.data = Plv.data || {});
  const state = (Plv.state = Plv.state || {});
  const views = (Plv.views = Plv.views || {});
  const detailsView = (views.details = views.details || {});
  const MONTHS_LONG = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const WEEKDAYS_LONG = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  let lastMaintPluvioId = null;

  // getFarmEquipmentsSafe/normalizeEquipmentText/isWeatherStationEquipment
  // compartilhados \u2014 ver assets/js/core/farm-utils.js
  const { getFarmEquipmentsSafe, normalizeEquipmentText, isWeatherStationEquipment } = window.IcFarm;

  // Dados ficticios de manutencao por pluviometro
  const MAINT_DATA = {
    "norte-a": {
      rows: [
        { status: "atrasada",  tipo: "Calibracao de sensor",   prazo: "ha 5 dias",  resp: "Bauer Irricontrol", extra: "Ultima afericao registrada no dispositivo" },
        { status: "concluida", tipo: "Verifica\u00e7\u00e3o periodica",  prazo: "12/01/2026", resp: "Bauer Irricontrol",   extra: "Confirmado no dispositivo" },
        { status: "concluida", tipo: "Troca de bateria",       prazo: "08/11/2025", resp: "Bauer Irricontrol", extra: "Confirmado no dispositivo" },
      ]
    },
    "norte-b": {
      rows: [
        { status: "programada", tipo: "Troca de bateria",      prazo: "em 6 dias",  resp: "Bauer Irricontrol", extra: "Bateria substituida e validada" },
        { status: "concluida", tipo: "Calibra\u00e7\u00e3o anual",       prazo: "20/02/2026", resp: "Bauer Irricontrol", extra: "Confirmado no dispositivo" },
        { status: "concluida", tipo: "Inspe\u00e7\u00e3o visual",        prazo: "14/09/2025", resp: "Bauer Irricontrol", extra: "Confirmado no dispositivo" },
      ]
    },
    "sul": {
      rows: [
        { status: "atrasada", tipo: "Limpeza de bascula",      prazo: "ha 3 dias", resp: "Bauer Irricontrol", extra: "Coletor limpo e liberado" },
        { status: "concluida", tipo: "Troca de sensor",        prazo: "26/12/2025", resp: "Bauer Irricontrol", extra: "Confirmado no dispositivo" },
      ]
    },
    "leste": {
      rows: [
        { status: "programada", tipo: "Calibracao de leitura", prazo: "em 12 dias", resp: "Bauer Irricontrol",   extra: "Ciclo semestral concluido" },
        { status: "concluida", tipo: "Verifica\u00e7\u00e3o periodica", prazo: "08/01/2026", resp: "Bauer Irricontrol",   extra: "Confirmado no dispositivo" },
        { status: "concluida", tipo: "Limpeza geral",         prazo: "15/10/2025", resp: "Bauer Irricontrol", extra: "Confirmado no dispositivo" },
      ]
    },
    "oeste": {
      rows: [
        { status: "concluida", tipo: "Calibracao anual", prazo: "25/03/2026", resp: "Bauer Irricontrol", extra: "Ciclo anual concluido" },
        { status: "concluida", tipo: "Limpeza de bascula",    prazo: "03/10/2025", resp: "Bauer Irricontrol", extra: "Confirmado no dispositivo" },
        { status: "concluida", tipo: "Troca de bateria",      prazo: "18/07/2025", resp: "Bauer Irricontrol",   extra: "Confirmado no dispositivo" },
      ]
    },
  };

  function renderMaintCard(p) {
    const tbody = document.getElementById("pluvMaintBody");
    const datalist = document.getElementById("pluvMaintResponsibleOptions");
    if (!tbody) return;
    const rows = getMaintRowsForPluvio(p);
    if (datalist) {
      datalist.innerHTML = [...new Set((data.MAINT_RESPONSIBLES || []).map((name) => String(name || "").trim()).filter(Boolean))]
        .map((name) => `<option value="${escapeAttr(name)}"></option>`)
        .join("");
    }
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:16px;color:#94a3b8;">Nenhuma manutencao registrada.</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map((r) => {
      const status = String(r.status || "concluida").toLowerCase();
      const pillHtml =
        status === "atrasada"
          ? `<span class="pill pill--danger">Atrasada</span>`
          : status === "programada"
            ? `<span class="pill pill--info">Programada</span>`
            : `<span class="pill pill--ok">Conclu\u00edda</span>`;
      const respCol = formatMaintResponsible(r.resp);
      const isEditing = state.pluvMaintEditRowId === r.id;
      return `
        <tr class="pivo-history__row">
          <td class="pivo-history__col-btn">
            <button class="expand-btn pluvd-maint-edit-btn" type="button" aria-label="Adicionar detalhes da manutenção" data-maint-edit-toggle="${r.id}">
              <i class="fa-solid fa-plus"></i>
            </button>
          </td>
          <td>${escapeAttr(p.nome || "Pluviometro")}</td>
          <td>${pillHtml}</td>
          <td>${escapeAttr(r.prazo || "—")}</td>
          <td>${escapeAttr(respCol)}</td>
        </tr>
        <tr class="pivo-history__row-details pluvd-maint-edit-row" style="display: ${isEditing ? "" : "none"};">
          <td colspan="5">
            <div class="pivo-history__details pluvd-maint-edit">
              <h4>Detalhes da manutenção</h4>
              <div class="pluvd-maint-edit__grid">
                <label class="pluvd-maint-edit__field">
                  <span>Tipo de serviço realizado</span>
                  <input
                    class="maint__input pluvd-maint-edit__input"
                    type="text"
                    name="maint_type_input_${r.id}"
                    data-maint-type-input="${r.id}"
                    value="${escapeAttr(r.tipo || "")}"
                    placeholder="Ex.: Troca de bateria" />
                </label>
                <label class="pluvd-maint-edit__field pluvd-maint-edit__field--small">
                  <span>Responsável</span>
                  <input
                    class="maint__input pluvd-maint-edit__input"
                    type="text"
                    list="pluvMaintResponsibleOptions"
                    name="maint_responsible_input_${r.id}"
                    data-maint-responsible-input="${r.id}"
                    value="${escapeAttr(respCol === "Nenhum" ? "" : respCol)}"
                    placeholder="Nome" />
                </label>
              </div>
              <div class="pluvd-maint-edit__grid pluvd-maint-edit__grid--stack">
                <label class="pluvd-maint-edit__field">
                  <span>Observações</span>
                  <textarea
                    class="maint__input pluvd-maint-edit__input pluvd-maint-edit__textarea"
                    name="maint_notes_input_${r.id}"
                    data-maint-notes-input="${r.id}"
                    placeholder="Descreva o que foi feito, peças trocadas, validações, etc.">${escapeAttr(r.extra || "")}</textarea>
                </label>
                <div class="pluvd-maint-edit__actions">
                  <button class="pluvd-maint-edit__action is-primary" type="button" aria-label="Salvar edição" data-maint-save="${r.id}">
                    <i class="fa-solid fa-check"></i>
                  </button>
                  <button class="pluvd-maint-edit__action" type="button" aria-label="Cancelar edição" data-maint-cancel="${r.id}">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
              </div>
              <div class="pluvd-maint-edit__hint">Use as sugestões de responsável ou digite um novo nome. As observações ajudam a detalhar o serviço executado.</div>
            </div>
          </td>
        </tr>`;
    }).join("");
  }

  function formatMaintResponsible(value) {
    return String(value || "").trim() || "Nenhum";
  }

  function ensureMaintResponsibleOption(value) {
    const next = String(value || "").trim();
    if (!next) return;
    const list = Array.isArray(data.MAINT_RESPONSIBLES) ? data.MAINT_RESPONSIBLES : (data.MAINT_RESPONSIBLES = []);
    if (!list.includes(next)) list.unshift(next);
  }

  function getMaintRowsForPluvio(p) {
    if (!p) return [];
    state.pluvMaintRowsByPluvio = state.pluvMaintRowsByPluvio || {};
    if (state.pluvMaintRowsByPluvio[p.id]) return state.pluvMaintRowsByPluvio[p.id];

    const entries = (MAINT_DATA[p.id] && Array.isArray(MAINT_DATA[p.id].rows)) ? [...MAINT_DATA[p.id].rows] : [];
    const fillerRows = {
      atrasada: [
        { status: "atrasada", tipo: "Limpeza de coletor", prazo: "ha 2 dias", resp: "Equipe de Campo" },
        { status: "atrasada", tipo: "Inspecao do pluviometro", prazo: "ha 7 dias", resp: "Suporte Tecnico" },
      ],
      programada: [
        { status: "programada", tipo: "Teste de comunicacao", prazo: "em 8 dias", resp: "Equipe de Campo" },
        { status: "programada", tipo: "Afericao de leitura", prazo: "em 14 dias", resp: "Laboratorio" },
      ],
      concluida: [
        { status: "concluida", tipo: "Verificacao de nivelamento", prazo: "04/02/2026", resp: "Bauer Irricontrol" },
        { status: "concluida", tipo: "Revisao de vedacao", prazo: "01/03/2026", resp: "Equipe de Campo" },
        { status: "concluida", tipo: "Checklist operacional", prazo: "18/01/2026", resp: "Bauer Irricontrol" },
        { status: "concluida", tipo: "Troca preventiva de bateria", prazo: "10/12/2025", resp: "Bauer Irricontrol" }
      ]
    };

    const atrasadas = entries.filter((r) => String(r.status || "").toLowerCase() === "atrasada");
    const programadas = entries.filter((r) => String(r.status || "").toLowerCase() === "programada");
    const concluidas = entries.filter((r) => String(r.status || "").toLowerCase() === "concluida");
    const activeRow = atrasadas[0] || programadas[0] || fillerRows.atrasada[0];
    const sorted = [activeRow, ...concluidas].map((row, index) => ({
      ...row,
      id: row.id || `${p.id}_maint_${index}`,
    }));

    let concluidaIndex = 0;
    while (sorted.length < 10) {
      const filler = fillerRows.concluida[concluidaIndex % fillerRows.concluida.length];
      sorted.push({ ...filler, id: `${p.id}_maint_${sorted.length}` });
      concluidaIndex += 1;
    }

    state.pluvMaintRowsByPluvio[p.id] = sorted.slice(0, 10);
    return state.pluvMaintRowsByPluvio[p.id];
  }

  let minimapInstance = null;
  let minimapMarker = null;
  let detailsEventsBound = false;
  let onDocClickDetails = null;

  // ============================
  // Open / Close
  // ============================
  function isDetailsOpen() {
    return document.body.classList.contains("is-pluvd") &&
      !!document.getElementById("pluvdPanel");
  }

  function normalizeDetailsOptions(options) {
    if (options && typeof options === "object") {
      return {
        pluvioId: options.pluvioId ?? null,
        detailsType: options.detailsType || "pluviometros"
      };
    }
    return { pluvioId: options ?? null, detailsType: "pluviometros" };
  }

  function setDetailsNavActive(detailsType) {
    const nav = document.querySelector("#pluvdPanel .pivo-section-nav");
    if (!nav) return;
    nav.querySelectorAll(".pivo-section-nav__btn").forEach((btn) => {
      const view = btn.getAttribute("data-details-view");
      btn.classList.toggle("is-active", view === detailsType);
    });
  }

  async function showDetailsView(options = {}) {
    const opts = normalizeDetailsOptions(options);
    const pluvioId = opts.pluvioId;
    const nextType = opts.detailsType || "pluviometros";
    const prevType = state.detailsType || "pluviometros";
    // Set the focus pluvio
    if (pluvioId) state.detailsFocusId = pluvioId;
    state.detailsType = nextType;

    // If already open, just update content
    if (isDetailsOpen()) {
      if (prevType !== nextType) setDetailsNavActive(nextType);
      renderDetails();
      renderDetailsChart(state.detailsChartPeriod || "24h");
      // Scroll to panel
      const panel = document.getElementById("pluvdPanel");
      if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    // Mount the panel — only use is-pluvd (avoids conflicts with pivos.css is-pivo-details)
    document.body.classList.remove("is-pivo-details-only");
    document.body.classList.add("is-pluvd");
    window.icMapSetWheelMode?.("ctrl");
    unbindDetailsEvents();

    // Load HTML
    const slot = document.getElementById("pageSlot");
    if (!slot) {
      console.error("[PluvDetails] #pageSlot not found");
      document.body.classList.remove("is-pluvd");
      window.icMapSetWheelMode?.("free");
      return;
    }
    try {
      const html = await fetch("./pages/pluviometro.details.html").then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); });
      slot.innerHTML = html;
      setDetailsNavActive(state.detailsType || "pluviometros");
    } catch (err) {
      console.error("[PluvDetails] Failed to load pluviometro.details.html", err);
      document.body.classList.remove("is-pluvd");
      window.icMapSetWheelMode?.("free");
      return;
    }

    bindDetailsEvents();
    renderDetails();
    renderDetailsChart(state.detailsChartPeriod || "24h");
    initDetailsMinimap();
    populateSelector();
    Plv.views?.map?.renderMarkers?.();

    // Scroll to panel (scrolls main--map container, not the window)
    setTimeout(() => {
      const panel = document.getElementById("pluvdPanel") || slot;
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
    document.body.classList.remove("is-pluvd");
    window.icMapSetWheelMode?.("free");
    state.detailsFocusId = null;
    state.detailsType = "pluviometros";
    unbindDetailsEvents();

    destroyDetailsMinimap();

    const slot = document.getElementById("pageSlot");
    if (slot) slot.innerHTML = "";

    const mapCard = document.getElementById("mapCard");
    if (mapCard) mapCard.style.display = "";

    // Zera referência da layer para forçar criação de nova no mapa ao renderizar

    // Re-render pluviometer markers on map
    Plv.views?.map?.renderMarkers?.();

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

  // ============================
  // Focus / Data helpers
  // ============================
  function getFocusPluvio() {
    const list = data.PLUVIOS || [];
    return list.find(p => p.id === state.detailsFocusId) || list[0] || null;
  }

  // ============================
  // Render
  // ============================
  function renderDetails() {
    const p = getFocusPluvio();
    if (!p) return;
    window.Plv?.data?.applyEngineTelemetry?.(p);
    window.Plv?.period?.syncUI?.();
    const DH = window.IcDemoHistory;
    const pid = String(p.sourceEquipId || p.id || "");
    const engineOn = !!(DH && pid && DH.findEquipment(pid));
    if (lastMaintPluvioId !== p.id) {
      state.pluvMaintEditRowId = null;
      lastMaintPluvioId = p.id;
    }

    // Title
    const titleEl = document.getElementById("pluvdTitleLabel");
    if (titleEl) titleEl.textContent = p.nome || "Pluviômetro";

    // Status dot + bar
    const dot = document.getElementById("pluvdStatusDot");
    const bar = document.getElementById("pluvdStatusBar");
    const barText = document.getElementById("pluvdStatusText");

    if (p.semComunicacao) {
      dot?.classList.remove("is-running");
      dot?.classList.add("is-offline");
      bar?.classList.remove("is-running", "is-stopped");
      bar?.classList.add("is-offline");
      if (barText) barText.textContent = "SEM COMUNICACAO";
    } else if (p.status === "rain") {
      dot?.classList.add("is-running");
      bar?.classList.add("is-running");
      bar?.classList.remove("is-offline", "is-stopped");
      if (barText) barText.textContent = "CHOVENDO AGORA";
    } else {
      dot?.classList.add("is-running");
      bar?.classList.add("is-running");
      bar?.classList.remove("is-offline", "is-stopped");
      if (barText) barText.textContent = "ONLINE";
    }

    // KPIs left panel
    const mmEl = document.getElementById("pluvdKpiMm");
    if (mmEl) mmEl.textContent = Number.isFinite(Number(p.mm)) ? Number(p.mm).toFixed(1) : "--";

    const statusEl = document.getElementById("pluvdKpiStatus");
    if (statusEl) {
      if (p.semComunicacao) statusEl.textContent = "Offline";
      else if (p.status === "rain") statusEl.textContent = "Chuva";
      else if (p.status === "dry") statusEl.textContent = "Sem chuva";
      else statusEl.textContent = "Normal";
    }

    const powerLabel = p.alimentacao === "Solar" ? "Bateria" : (p.alimentacao || "Bateria");

    const powerEl = document.getElementById("pluvdKpiPower");
    if (powerEl) powerEl.textContent = powerLabel;

    const netEl = document.getElementById("pluvdKpiNet");
    if (netEl) netEl.textContent = p.net || (p.semComunicacao ? "Offline" : "Online");

    // Acumulados seeded
    const seed = hashStr(String(p.id || p.nome || "pluv"));
    const rand = seededRandom(seed);
    const monthVal = (20 + rand() * 200).toFixed(1);
    const yearVal = (200 + rand() * 1000).toFixed(1);

    const sumRain = (a, b) => DH.rain.daily(pid, a, b).reduce((acc, d) => acc + d.mm, 0);
    const monthEl = document.getElementById("pluvdKpiMonth");
    if (monthEl) monthEl.textContent = engineOn ? sumRain(new Date(DH.NOW.getFullYear(), DH.NOW.getMonth(), 1), DH.NOW).toFixed(1) : monthVal;

    const yearEl = document.getElementById("pluvdKpiYear");
    if (yearEl) yearEl.textContent = engineOn ? sumRain(new Date(DH.NOW.getFullYear(), 0, 1), DH.NOW).toFixed(1) : yearVal;

    // Summary KPIs
    const r2 = seededRandom(seed + 7);
    const events = 2 + Math.floor(r2() * 8);
    const maxInt = (3 + r2() * 12).toFixed(1);
    const rainDays = 2 + Math.floor(r2() * 14);
    const total = (10 + r2() * 80).toFixed(1);
    const bigEvent = (8 + r2() * 30).toFixed(1);

    setText("pluvdKpiEvents", events);
    setText("pluvdKpiMaxIntensity", `${maxInt} mm/h`);
    setText("pluvdKpiRainDays", rainDays);
    setText("pluvdKpiTotal", `${total} mm`);
    setText("pluvdKpiBigEvent", `${bigEvent} mm`);
    if (engineOn) renderEngineSummary(p);

    // Footer
    const lastEl = document.getElementById("pluvdLastUpdate");
    if (lastEl) lastEl.innerHTML = `<span class="comm-label">Última comunicação:</span> ${engineOn ? DH.fmt.dateTime(DH.lastCommunication(pid)) : (p.updated || "—")}`;

    // Info card
    setText("pluvdInfoTalhao", p.sub || "—");
    setText("pluvdInfoModel", p.model || "—");
    setText("pluvdInfoType", p.tipo || "Báscula");
    setText("pluvdInfoPower", powerLabel);

    const coordsEl = document.getElementById("pluvdInfoCoords");
    if (coordsEl) {
      if (p.lat != null && p.lng != null) {
        coordsEl.textContent = `${Number(p.lat).toFixed(6)}, ${Number(p.lng).toFixed(6)}`;
      } else {
        coordsEl.textContent = "—";
      }
    }

    const pivosEl = document.getElementById("pluvdInfoPivos");
    if (pivosEl) {
      pivosEl.textContent = (p.pivos && p.pivos.length) ? p.pivos.join(", ") : "—";
    }

    // Battery seeded
    const battPct = engineOn && Number.isFinite(Number(p.battery)) ? Number(p.battery) : 40 + Math.round(r2() * 58);
    const battFill = document.getElementById("pluvdBatteryFill");
    const battLabel = document.getElementById("pluvdBatteryPct");
    if (battFill) battFill.style.width = `${battPct}%`;
    if (battLabel) battLabel.textContent = `${battPct}%`;

    // Period label
    setText("pluvdPeriodLabel", getDetailsPeriodLabel(state.detailsChartPeriod || "24h"));

    updateDetailsMinimap();
    renderMaintCard(p);
  }

  // setText compartilhado — ver assets/js/core/equip-utils.js
  const { setText } = window.IcEquipUtils;

  // Indicadores do período (popover global) a partir das leituras reais
  function renderEngineSummary(p) {
    const DH = window.IcDemoHistory;
    const pid = String(p.sourceEquipId || p.id || "");
    const range = DH.periodFrom(window.Plv?.state?.period, 1);
    const readings = DH.rain.hourly(pid, range.start, range.end);
    const daily = DH.rain.daily(pid, range.start, range.end);
    const total = daily.reduce((a, d) => a + d.mm, 0);
    const prev = DH.rain.hourly(pid, new Date(DH.NOW.getTime() - 60 * 86400000), new Date(DH.NOW.getTime() - 30 * 86400000)).length;
    const lastMonth = DH.rain.hourly(pid, new Date(DH.NOW.getTime() - 30 * 86400000), DH.NOW).length;
    setText("pluvdKpiEvents", readings.length);
    setText("pluvdKpiMaxIntensity", `${(readings.reduce((m, r) => Math.max(m, r.mm), 0)).toFixed(1)} mm/h`);
    setText("pluvdKpiRainDays", daily.filter((d) => d.mm > 0).length);
    setText("pluvdKpiTotal", `${total.toFixed(1)} mm`);
    setText("pluvdKpiBigEvent", `${daily.reduce((m, d) => Math.max(m, d.mm), 0).toFixed(1)} mm`);
    const trend = document.querySelector("#pluvdKpiEvents")?.parentElement?.querySelector(".pivo-faults__trend");
    if (trend) {
      const diff = lastMonth - prev;
      trend.innerHTML = `Último mês <i class="fa-solid ${diff >= 0 ? "fa-arrow-trend-up is-up" : "fa-arrow-trend-down is-down"}"></i> ${Math.abs(diff)}`;
    }
  }

  document.addEventListener("pluv:periodChanged", () => {
    const p = document.getElementById("pluvdKpiEvents") ? getFocusPluvio() : null;
    if (p && window.IcDemoHistory) renderEngineSummary(p);
  });

  // ============================
  // Precipitation Chart
  // ============================
  function renderDetailsChart(period) {
    state.detailsChartPeriod = period;
    if (!state.detailsChartView) state.detailsChartView = "chart";
    if (state.detailsChartView === "calendar" && period !== "30d") {
      state.detailsChartView = "chart";
    }

    const barsEl = document.getElementById("pluvdBars");
    const xEl = document.getElementById("pluvdXAxis");
    const totalEl = document.getElementById("pluvdChartTotal");
    const yEl = document.getElementById("pluvdYAxis");
    if (!barsEl || !xEl || !totalEl || !yEl) return;

    // Sync tab active state
    document.querySelectorAll(".pluvd-chart-tab").forEach(btn => {
      btn.classList.toggle("is-active", btn.getAttribute("data-period") === period);
    });

    const p = getFocusPluvio();
    const { values, labels } = getDetailsSeries(p, period);
    const rawMax = values.reduce((max, value) => Math.max(max, value), 0);
    const maxAxis = Math.max(16, Math.ceil(rawMax / 4) * 4 || 16);

    const total = values.reduce((a, b) => a + b, 0);
    totalEl.textContent = `${total.toFixed(1)} mm`;
    setText("pluvdPeriodLabel", getDetailsPeriodLabel(period));

    const plotH = 228;
    barsEl.innerHTML = values.map(v => {
      const pct = maxAxis > 0 ? v / maxAxis : 0;
      const h = Math.max(v > 0 ? 3 : 0, Math.round(pct * plotH));
      const tone = v > 10 ? "pluvd-bar--heavy" : v > 4 ? "pluvd-bar--mid" : v > 0 ? "pluvd-bar--light" : "";
      return `<div class="pluvd-bar ${tone}" style="height:${h}px" title="${v.toFixed(1)} mm"></div>`;
    }).join("");

    yEl.innerHTML = Array.from({ length: 5 }, (_, index) => {
      const value = Math.round(((4 - index) * maxAxis) / 4);
      return `<span>${value} mm</span>`;
    }).join("");
    xEl.innerHTML = labels.map(t => `<div>${t}</div>`).join("");

    renderDetailsCalendar();
    syncDetailsChartView();
  }

  // ============================
  // Selector dropdown
  // ============================
  function renderAllEquipmentInMenu(menu, currentId, currentType, closeSelf) {
    const farm = window.IcFarmGetActive?.() || window.icFarmData || window.IcFarmActive || null;
    const equipments = getFarmEquipmentsSafe(farm);
    const groups = [
      { label: "Pluviômetros", type: "pluviometros", items: (data.PLUVIOS) || equipments.filter(e => { const c = String(e?.category || "").toLowerCase(); return c === "pluviometros" || c === "pluviometro"; }), open: id => window.IcPluvDetails?.open?.({ pluvioId: id }) }
    ].filter(g => g.items.length > 0);

    menu.innerHTML = "";
    if (!groups.length) { menu.innerHTML = `<div style="padding:10px 12px;font-size:12px;color:#64748b;">Nenhum equipamento encontrado.</div>`; return; }
    groups.forEach(group => {
      const header = document.createElement("div");
      header.className = "pivo-selector__group-header";
      header.textContent = group.label;
      menu.appendChild(header);
      group.items.forEach(item => {
        const isCurrent = group.type === currentType && String(item.id) === String(currentId);
        const name = item.name || item.nome || item.data?.nome || item.data?.serial || group.label;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "pivo-selector__item" + (isCurrent ? " is-selected" : "");
        btn.innerHTML = isCurrent ? `<i class="fa-solid fa-check"></i> <span>${name}</span>` : `<span>${name}</span>`;
        btn.addEventListener("click", ev => {
          ev.stopPropagation();
          menu.style.display = "none";
          const sb = document.getElementById("pluvdSelectBtn"); if (sb) sb.classList.remove("is-active");
          if (!isCurrent) {
            if (group.type !== currentType) { closeSelf?.(); }
            group.open(item.id);
          }
        });
        menu.appendChild(btn);
      });
    });
  }

  function populateSelector() {
    const menu = document.getElementById("pluvdSelectorMenu");
    if (!menu) return;
    const current = getFocusPluvio();
    renderAllEquipmentInMenu(menu, current?.id, "pluviometros", () => window.IcPluvDetails?.close?.());
  }

  function renderAllEquipmentInMenu(menu, currentId, currentType, closeSelf) {
    const farm = window.IcFarmGetActive?.() || window.icFarmData || window.IcFarmActive || null;
    const equipments = getFarmEquipmentsSafe(farm);
    const groups = [
      { label: "Pluviômetros", type: "pluviometros", items: (data.PLUVIOS) || equipments.filter(e => { const c = String(e?.category || "").toLowerCase(); return c === "pluviometros" || c === "pluviometro"; }), open: id => window.IcPluvDetails?.open?.({ pluvioId: id }) }
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
          const sb = document.getElementById("pluvdSelectBtn"); if (sb) sb.classList.remove("is-active");
          if (!isCurrent) {
            if (group.type !== currentType) { closeSelf?.(); }
            group.open(item.id);
          }
        });
        body.appendChild(btn);
      });

      wrapper.appendChild(header);
      wrapper.appendChild(body);
      menu.appendChild(wrapper);
    });
  }

  // ============================
  // Event Binding
  // ============================
  function bindDetailsEvents() {
    if (detailsEventsBound) return;
    detailsEventsBound = true;

    // Close button
    const closeBtn = document.getElementById("pluvdCloseBtn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        window.IcPluvDetails?.close?.();
      });
    }

    // Editar button — set focus on current pluvio then open edit view
    const editBtn = document.getElementById("pluvdEditBtn");
    if (editBtn && !editBtn.dataset.bound) {
      editBtn.dataset.bound = "1";
      editBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const p = getFocusPluvio();
        if (p) {
          // Pass the focused pluvio to the edit view
          Plv.state.settingsFocusId = p.id;
        }
        // Close details first, then open edit
        window.IcPluvDetails?.close?.();
        // Small delay to allow DOM cleanup
        setTimeout(() => {
          Plv.views?.edit?.showEditView?.({ isNew: false });
        }, 50);
      });
    }

    // Top section nav (pivot/pluviometer switch)
    const pluvdPanel = document.getElementById("pluvdPanel");
    if (pluvdPanel) {
      pluvdPanel.addEventListener("click", (e) => {
        const backBtn = e.target.closest(".js-details-back");
        if (backBtn) {
          window.IcNavigate?.("visao-geral");
          return;
        }

        const sectionNavBtn = e.target.closest(".pivo-section-nav__btn");
        if (!sectionNavBtn) return;

        const targetView = sectionNavBtn.getAttribute("data-details-view");
        if (targetView === "pivos") {
          window.IcPluvDetails?.close?.();
          window.IcPivos?.open?.();
          return;
        }

        if (targetView === "medidores") {
          window.IcPluvDetails?.close?.();
          window.IcMdnDetails?.open?.();
          return;
        }
        if (targetView === "bombas") {
          window.IcPluvDetails?.close?.();
          window.IcBombaDetails?.open?.();
          return;
        }
        if (targetView === "estacoes") {
          window.IcPluvDetails?.close?.();
          window.IcEstacaoDetails?.open?.();
          return;
        }
        if (targetView === "pluviometros") {
          state.detailsType = targetView;
          setDetailsNavActive(targetView);
          return;
        }

        // Keep active state if user clicks current tab
        const nav = sectionNavBtn.closest(".pivo-section-nav");
        if (nav) {
          nav.querySelectorAll(".pivo-section-nav__btn").forEach((btn) => {
            btn.classList.remove("is-active");
          });
        }
        sectionNavBtn.classList.add("is-active");
      });
    }

    // Eventos card - expand/collapse rows
    const evCard = document.querySelector(".pivo-history:not(.pluv-maint-card)");
    if (evCard) {
      // Expand rows no card de eventos
      evCard.addEventListener("click", (e) => {
        const btn = e.target.closest(".expand-btn");
        if (!btn) return;
        const tr = btn.closest("tr.pivo-history__row");
        if (!tr) return;
        const detailsTr = tr.nextElementSibling;
        if (!detailsTr || !detailsTr.classList.contains("pivo-history__row-details")) return;
        const isOpen = detailsTr.style.display !== "none";
        detailsTr.style.display = isOpen ? "none" : "";
        btn.innerHTML = isOpen ? '<i class="fa-solid fa-plus"></i>' : '<i class="fa-solid fa-minus"></i>';
      });
    }

    // Maintenance card — tab switching (Pendentes / Concluídas)
    const maintTabs = document.getElementById("maintTabs");
    if (maintTabs) {
      maintTabs.addEventListener("click", (e) => {
        const btn = e.target.closest(".js-history-tab");
        if (!btn) return;
        maintTabs.querySelectorAll(".js-history-tab").forEach(b => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        const target = btn.getAttribute("data-tab");
        const card = maintTabs.closest(".pluv-maint-card");
        if (card) {
          card.querySelectorAll("[data-maint-tab]").forEach(el => {
            el.style.display = el.getAttribute("data-maint-tab") === target ? "" : "none";
          });
        }
      });
    }

    // Maintenance card — expand/collapse rows
    const maintCard = document.querySelector(".pluv-maint-card");
    if (maintCard) {
      maintCard.addEventListener("click", (e) => {
        const editBtn = e.target.closest("[data-maint-edit-toggle]");
        if (editBtn) {
          const rowId = editBtn.getAttribute("data-maint-edit-toggle");
          state.pluvMaintEditRowId = state.pluvMaintEditRowId === rowId ? null : rowId;
          renderMaintCard(getFocusPluvio());
          return;
        }

        const saveBtn = e.target.closest("[data-maint-save]");
        if (saveBtn) {
          const rowId = saveBtn.getAttribute("data-maint-save");
          const p = getFocusPluvio();
          const rows = getMaintRowsForPluvio(p);
          const row = rows.find((item) => item.id === rowId);
          const typeInput = maintCard.querySelector(`[data-maint-type-input="${rowId}"]`);
          const input = maintCard.querySelector(`[data-maint-responsible-input="${rowId}"]`);
          const notesInput = maintCard.querySelector(`[data-maint-notes-input="${rowId}"]`);
          if (row && input) {
            row.tipo = String(typeInput?.value || row.tipo || "").trim();
            const nextName = String(input.value || "").trim();
            row.resp = nextName;
            row.extra = String(notesInput?.value || row.extra || "").trim();
            ensureMaintResponsibleOption(nextName);
          }
          state.pluvMaintEditRowId = null;
          renderMaintCard(p);
          return;
        }

        const cancelBtn = e.target.closest("[data-maint-cancel]");
        if (cancelBtn) {
          state.pluvMaintEditRowId = null;
          renderMaintCard(getFocusPluvio());
          return;
        }

        const btn = e.target.closest(".expand-btn");
        if (!btn || btn.hasAttribute("data-maint-edit-toggle")) return;
        const tr = btn.closest("tr.pivo-history__row");
        if (!tr) return;
        const detailsTr = tr.nextElementSibling;
        if (!detailsTr || !detailsTr.classList.contains("pivo-history__row-details")) return;
        const isOpen = detailsTr.style.display !== "none";
        detailsTr.style.display = isOpen ? "none" : "";
        btn.innerHTML = isOpen
          ? '<i class="fa-solid fa-plus"></i>'
          : '<i class="fa-solid fa-minus"></i>';
      });
    }

    // Chart tab buttons
    const tabsHost = document.getElementById("pluvdChartTabs");
    if (tabsHost) {
      tabsHost.addEventListener("click", e => {
        const btn = e.target.closest(".pluvd-chart-tab");
        if (!btn) return;
        const period = btn.getAttribute("data-period");
        if (period) renderDetailsChart(period);
      });
    }

    const viewTabsHost = document.getElementById("pluvdViewTabs");
    if (viewTabsHost) {
      viewTabsHost.addEventListener("click", e => {
        const btn = e.target.closest(".pluvd-view-tab");
        if (!btn || btn.disabled) return;
        const view = btn.getAttribute("data-view");
        if (!view) return;
        if (view === "calendar" && (state.detailsChartPeriod || "24h") !== "30d") {
          state.detailsChartView = "calendar";
          renderDetailsChart("30d");
          return;
        }
        state.detailsChartView = view;
        if (view === "calendar") renderDetailsCalendar();
        syncDetailsChartView();
      });
    }

    // Selector dropdown
    onDocClickDetails = (e) => {
      const menu = document.getElementById("pluvdSelectorMenu");
      const selectBtn = e.target.closest("#pluvdSelectBtn");

      if (!menu) return;

      // Clicked selector option
      const option = e.target.closest("[data-pluvd-option]");
      if (option) {
        const id = option.getAttribute("data-value");
        if (id) {
          state.detailsFocusId = id;
          menu.style.display = "none";
          populateSelector();
          renderDetails();
          renderDetailsChart(state.detailsChartPeriod || "24h");
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

  // ============================
  // Minimap
  // ============================
  function initDetailsMinimap() {
    const container = document.getElementById("pluvdMinimap");
    if (!container || !window.L) return;

    const p = getFocusPluvio();
    const hasCoords = p && p.lat != null && p.lng != null;
    const center = hasCoords ? [Number(p.lat), Number(p.lng)] : [-15.79, -47.88];
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
      minimapMarker = L.marker([Number(p.lat), Number(p.lng)], {
        icon: getDetailsMinimapIcon(p),
        keyboard: false,
      }).addTo(minimapInstance);
    }

    setTimeout(() => minimapInstance?.invalidateSize?.(), 100);
  }

  function updateDetailsMinimap() {
    if (!minimapInstance || !window.L) return;
    const p = getFocusPluvio();
    if (!p || p.lat == null) return;

    const ll = [Number(p.lat), Number(p.lng)];
    minimapInstance.setView(ll, 16, { animate: false });

    if (minimapMarker) {
      minimapMarker.setLatLng(ll);
      minimapMarker.setIcon?.(getDetailsMinimapIcon(p));
    } else {
      minimapMarker = L.marker(ll, {
        icon: getDetailsMinimapIcon(p),
        keyboard: false,
      }).addTo(minimapInstance);
    }

    setTimeout(() => minimapInstance?.invalidateSize?.(), 50);
  }

  function getDetailsMinimapIcon(p) {
    const displayMm = String(p?.displayMm || "").trim();
    const cls = `pluv-pin ${p?.semComunicacao ? "is-off" : ""}`;
    const mmValue = displayMm || (p?.semComunicacao
      ? "--"
      : Number.isFinite(Number(p?.mm))
        ? Number(p.mm).toFixed(1)
        : "--");

    return L.divIcon({
      className: "",
      html: `
        <div class="${cls}">
          <div class="pluv-pin__bubble">
            <div class="plv-text-wrap">
              <span class="pluv-pin__value">${mmValue}</span>
              <span class="pluv-pin__unit">mm</span>
            </div>
          </div>
        </div>
      `,
      iconSize: [44, 54],
      iconAnchor: [22, 54],
    });
  }

  function destroyDetailsMinimap() {
    if (minimapInstance) {
      try { minimapInstance.remove(); } catch (_) { }
      minimapInstance = null;
      minimapMarker = null;
    }
  }

  // ============================
  // Helpers
  // ============================
  // seededRandom/hashStr compartilhados — ver assets/js/core/equip-utils.js
  const { seededRandom, hashStr } = window.IcEquipUtils;

  function getDetailsPeriodLabel(period) {
    if (period === "7d") return "Últimos 7 dias";
    if (period === "30d") return "Últimos 30 dias";
    return "Últimas 24h";
  }

  function getDetailsCalendarMonth() {
    if (state.detailsCalendarMonth instanceof Date) return state.detailsCalendarMonth;
    const base = new Date();
    state.detailsCalendarMonth = new Date(base.getFullYear(), base.getMonth(), 1);
    return state.detailsCalendarMonth;
  }

  function getDetailsMonthlySeries(p, baseDate) {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const DH = window.IcDemoHistory;
    const pid = String(p?.sourceEquipId || p?.id || "");
    if (DH && pid && DH.findEquipment(pid)) {
      return DH.rain.daily(pid, new Date(year, month, 1), new Date(year, month, daysInMonth, 23, 59))
        .map((d) => (d.date > DH.NOW ? 0 : d.mm))
        .concat(Array(daysInMonth).fill(0)).slice(0, daysInMonth);
    }
    const seed = hashStr(String((p && (p.id || p.nome)) || "pluv") + `_${year}_${month}`);
    const rand = seededRandom(seed);
    const values = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const chance = rand();
      let mm = 0;
      if (chance > 0.45) {
        const intensity = rand();
        mm = Math.round(((intensity * intensity) * 22 + rand() * 6) * 10) / 10;
      }
      values.push(mm);
    }
    return values;
  }

  function getDetailsSeries(p, period) {
    if (period === "30d") {
      const base = getDetailsCalendarMonth();
      const values = getDetailsMonthlySeries(p, base);
      const labels = Array.from({ length: values.length }, (_, i) => String(i + 1));
      return { values, labels };
    }

    const DH = window.IcDemoHistory;
    const pid = String(p?.sourceEquipId || p?.id || "");
    if (DH && pid && DH.findEquipment(pid)) {
      if (period === "24h") {
        const end = DH.NOW;
        const start = new Date(end.getTime() - 24 * 3600000);
        const firstHour = new Date(start); firstHour.setMinutes(0, 0, 0);
        const values = new Array(24).fill(0);
        DH.rain.hourly(pid, start, end).forEach((r) => {
          const idx = Math.min(23, Math.floor((r.date - firstHour) / 3600000));
          if (idx >= 0) values[idx] = Math.round((values[idx] + r.mm) * 10) / 10;
        });
        return { values, labels: values.map((_, i) => `${String((firstHour.getHours() + i) % 24).padStart(2, "0")}h`) };
      }
      const end = DH.NOW;
      const start = new Date(DH.dayStart(end).getTime() - 6 * 86400000);
      const daily = DH.rain.daily(pid, start, end);
      const wd = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      return { values: daily.map((d) => d.mm), labels: daily.map((d) => wd[d.date.getDay()]) };
    }
    const seed = hashStr(String((p && (p.id || p.nome)) || "pluv") + period);
    const rand = seededRandom(seed);
    const len = period === "24h" ? 24 : 7;
    const maxAxis = period === "24h" ? 14 : 16;
    const values = Array.from({ length: len }, () => (rand() < 0.3 ? +(rand() * maxAxis * 0.9 + 0.5).toFixed(1) : 0));

    if (period === "24h") {
      return {
        values,
        labels: Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}h`)
      };
    }

    const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const today = new Date().getDay();
    return {
      values,
      labels: Array.from({ length: 7 }, (_, i) => days[(today - 6 + i + 7) % 7])
    };
  }

  function escapeAttr(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "&#10;");
  }

  function buildDetailsCalendarTooltip(date, mm) {
    const dayName = WEEKDAYS_LONG[date.getDay()];
    const monthName = MONTHS_LONG[date.getMonth()];
    const dateText = `${dayName}, ${date.getDate()} de ${monthName} de ${date.getFullYear()}`;
    const rainText = mm > 0 ? `${mm.toFixed(1)} mm` : "Sem precipitação";
    return `${dateText}\n${rainText}`;
  }

  function renderDetailsCalendar() {
    const panel = document.getElementById("pluvdCalendarPanel");
    const grid = document.getElementById("pluvdCalGrid");
    const monthLabel = document.getElementById("pluvdCalMonthLabel");
    const p = getFocusPluvio();
    if (!panel || !grid || !monthLabel || !p) return;

    const base = getDetailsCalendarMonth();
    const year = base.getFullYear();
    const month = base.getMonth();
    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();
    const values = getDetailsMonthlySeries(p, base);

    monthLabel.textContent = `${MONTHS_LONG[month]} ${year}`;

    let html = "";
    for (let i = 0; i < startWeekday; i++) {
      const day = daysInPrev - startWeekday + 1 + i;
      html += `<button class="rain-cal__cell is-muted" type="button" disabled><span class="rain-cal__day">${day}</span></button>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const mm = values[day - 1] || 0;
      let cls = "rain-cal__cell";
      if (mm > 0 && mm < 5) cls += " is-rain-weak";
      if (mm >= 5 && mm <= 15) cls += " is-rain-mid";
      if (mm > 15) cls += " is-rain-strong";
      const tooltip = escapeAttr(buildDetailsCalendarTooltip(date, mm));
      html += `
        <button class="${cls}" type="button" data-tooltip="${tooltip}">
          <span class="rain-cal__day">${day}</span>
          ${mm > 0 ? `<span class="rain-cal__icon"><i class="fa-solid fa-cloud-rain"></i></span>` : ""}
          ${mm > 0 ? `<span class="rain-cal__mm">${mm.toFixed(1)} mm</span>` : ""}
        </button>
      `;
    }

    const totalCells = startWeekday + daysInMonth;
    const trailing = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= trailing; i++) {
      html += `<button class="rain-cal__cell is-muted" type="button" disabled><span class="rain-cal__day">${i}</span></button>`;
    }

    grid.innerHTML = html;
  }

  function syncDetailsChartView() {
    const chartPanel = document.getElementById("pluvdChartPanel");
    const calendarPanel = document.getElementById("pluvdCalendarPanel");
    const period = state.detailsChartPeriod || "24h";
    const view = state.detailsChartView || "chart";
    const showCalendar = view === "calendar" && period === "30d";

    chartPanel?.classList.toggle("is-hidden", showCalendar);
    calendarPanel?.classList.toggle("is-hidden", !showCalendar);

    document.querySelectorAll(".pluvd-view-tab").forEach((btn) => {
      const btnView = btn.getAttribute("data-view");
      btn.classList.toggle("is-active", btnView === (showCalendar ? "calendar" : "chart"));
      if (btnView === "calendar") {
        btn.disabled = false;
      }
    });
  }

  // ============================
  // Expose
  // ============================
  detailsView.showDetailsView = showDetailsView;
  detailsView.destroyDetailsView = destroyDetailsView;
  detailsView.getFocusPluvio = getFocusPluvio;
  detailsView.renderDetails = renderDetails;
})();
