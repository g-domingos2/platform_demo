// assets/js/pages/estacoes/weatherstation-details.js
// Tela de Detalhes da Estação Meteorológica — cockpit no padrão
// pivô/bomba/carretel (.pincard > .weatherstation-agenda > bottom-row),
// SEPARADA da tela de create+config (estacao-meteorologica.html). Classes
// e IDs próprios, prefixados "weatherstation-", copiados dos equivalentes
// pivo-*/carretel-*/bmbd-* — mesma decisão tomada pra Bomba nesta sessão,
// pra uma mudança no CSS compartilhado de outro equipamento não quebrar
// (ou ser quebrada por) esta tela. Ver docs/engineering-fixes-log.md.
//
// Dados: reaproveita a camada de dados já exposta por view.details.js em
// window.Est.data (normalizeEst/getFocusEst/ensureHourly/etc.) — é lógica
// pura, sem risco de acoplamento visual, e evita duas fontes de verdade
// pro mesmo mock de leituras.
(function initWeatherStationDetails() {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const t = (text) => window.IcI18n?.t?.(text) ?? text;

  let minimap = null;
  let selectorOutsideClickHandler = null;

  const num = (v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const f0 = (v) => (Number.isFinite(v) ? String(Math.round(v)) : "--");
  const f1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : "--");
  const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : "--");
  const tC = (v) => (Number.isFinite(v) ? `${f1(v)} °C` : "—");
  const tPct = (v) => (Number.isFinite(v) ? `${f0(v)} %` : "—");
  const tMs = (v) => (Number.isFinite(v) ? `${f1(v)} m/s` : "—");
  const tMm = (v, d = 1) => (Number.isFinite(v) ? `${v.toFixed(d)} mm` : "—");
  const tWm2 = (v) => (Number.isFinite(v) ? `${f0(v)} W/m²` : "—");

  function Data() {
    return window.Est?.data || {};
  }
  function State() {
    return window.Est?.state || {};
  }

  function stations() {
    return Data().getEstacoesList?.() || [];
  }
  function getSelected() {
    return Data().getFocusEst?.() || null;
  }

  const RAW_PAGE_SIZE = 15;
  let rawPage = 0;

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
  }

  // ─── Seletor de estação ────────────────────────────────────────────────

  function renderSelectorItems(menu) {
    const list = stations();
    const focus = getSelected();
    menu.innerHTML = list.map((equip) => `<button type="button" class="weatherstation-selector__item ${focus && equip.id === focus.id ? "is-selected" : ""}" data-weatherstation-id="${equip.id}">${equip.name || equip.data?.name || "Estação"}</button>`).join("");
    menu.querySelectorAll("[data-weatherstation-id]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        State().detailsFocusId = btn.dataset.weatherstationId;
        menu.style.display = "none";
        $("weatherstationSelectBtn")?.classList.remove("is-active");
        window.IcWeatherStationDetails.renderData();
      });
    });
  }

  // ─── Minimapa ──────────────────────────────────────────────────────────

  function initMinimap() {
    const el = $("weatherstationMinimap");
    const equip = getSelected();
    if (!el || !window.L || !equip) return;

    const d = Data().normalizeEst?.(equip);
    if (minimap && minimap.getContainer?.() !== el) {
      try { minimap.off(); minimap.remove(); } catch (_) { }
      minimap = null;
    }
    if (!minimap) {
      minimap = L.map(el, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, tap: false });
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 20 }).addTo(minimap);
      L.tileLayer("https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, opacity: 0.85 }).addTo(minimap);
    }
    minimap.eachLayer((layer) => { if (layer instanceof L.Marker) minimap.removeLayer(layer); });
    setTimeout(() => minimap.invalidateSize(), 60);

    if (d?.center) {
      L.marker([Number(d.center.lat), Number(d.center.lng)], { icon: window.IcMapIcons?.weatherStationIcon?.() }).addTo(minimap);
      minimap.setView([Number(d.center.lat), Number(d.center.lng)], 16);
    } else {
      minimap.setView([-15.79, -47.88], 4);
    }
  }

  // ─── Leituras (posição do Histórico) ───────────────────────────────────

  function renderReadings() {
    const rows = State()._hourly;
    const body = $("weatherstationReadingsBody");
    if (!body || !Array.isArray(rows)) return;

    const sorted = [...rows].reverse();
    const totalPages = Math.max(1, Math.ceil(sorted.length / RAW_PAGE_SIZE));
    if (rawPage >= totalPages) rawPage = totalPages - 1;
    if (rawPage < 0) rawPage = 0;
    const start = rawPage * RAW_PAGE_SIZE;
    const page = sorted.slice(start, start + RAW_PAGE_SIZE);

    body.innerHTML = page.map((r) => {
      const dt = new Date(r.ts);
      const dstr = dt.toLocaleString(window.IcI18n?.getLocale?.() || "pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "").replace(".", "");
      return `<tr>
        <td>${dstr}</td>
        <td>${f1(r.temp)}</td>
        <td>${f0(r.humidity)}</td>
        <td>${f1(r.wind)}</td>
        <td>${f0(r.radiation)}</td>
        <td>${r.rain ? f1(r.rain) : "—"}</td>
        <td>${f2(r.eto)}</td>
        <td>${f2(r.battery)}</td>
      </tr>`;
    }).join("");

    setText("weatherstationReadingsCount", `${sorted.length} ${t("leituras")}`);

    const pag = $("weatherstationReadingsPagination");
    if (pag) {
      pag.innerHTML = `
        <button type="button" class="btn-page" data-weatherstation-raw-nav="prev" ${rawPage === 0 ? "disabled" : ""}><i class="fa-solid fa-chevron-left"></i></button>
        <span class="btn-page__info">${rawPage + 1} / ${totalPages}</span>
        <button type="button" class="btn-page" data-weatherstation-raw-nav="next" ${rawPage >= totalPages - 1 ? "disabled" : ""}><i class="fa-solid fa-chevron-right"></i></button>
      `;
    }
  }

  function slug(s) {
    return String(s || "estacao").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function exportReadingsCsv() {
    const rows = State()._hourly;
    if (!Array.isArray(rows) || !rows.length) return;
    const equip = getSelected();
    const esc = (v) => {
      const s = String(v ?? "");
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ["Data e hora", "Temp. (°C)", "Umidade (%)", "Vento (m/s)", "Radiação (W/m²)", "Chuva (mm)", "ETo (mm)", "Bateria (V)"];
    const data = [...rows].reverse().map((r) => {
      const dt = new Date(r.ts);
      return [
        dt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        f1(r.temp), f0(r.humidity), f1(r.wind), f0(r.radiation), r.rain ? f1(r.rain) : "0", f2(r.eto), f2(r.battery),
      ];
    });
    const lines = [header, ...data].map((row) => row.map(esc).join(";"));
    const blob = new Blob([lines.join("\r\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `estacao-${slug(equip?.name)}-leituras.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ─── Período selecionado (filtro de data) ──────────────────────────────
  // Mesmo componente de popover/calendário global usado por Pivô/Bomba/
  // Carretel (feature.periodPicker.js) — window.Plv.state.period.

  function getSelectedPeriodRange() {
    const period = window.Plv?.state?.period;
    if (period?.start && period?.end) {
      return { start: new Date(period.start), end: new Date(period.end) };
    }
    const end = new Date();
    const start = new Date(end.getTime() - 6 * 86400000);
    return { start, end };
  }

  function rowsInPeriod() {
    const rows = State()._hourly;
    if (!Array.isArray(rows)) return [];
    const { start, end } = getSelectedPeriodRange();
    const startMs = start.getTime();
    const endMs = end.getTime() + 86400000; // inclui o dia final inteiro
    return rows.filter((r) => {
      const ts = new Date(r.ts).getTime();
      return ts >= startMs && ts <= endMs;
    });
  }

  // ─── Indicadores acumulados do período (posição 2) ─────────────────────

  function renderPeriodStats() {
    const rows = rowsInPeriod();
    if (!rows.length) return;
    const avg = (key) => rows.reduce((sum, r) => sum + (Number(r[key]) || 0), 0) / rows.length;
    const sum = (key) => rows.reduce((sum2, r) => sum2 + (Number(r[key]) || 0), 0);
    const minMax = (key) => rows.reduce((acc, r) => {
      const v = Number(r[key]);
      if (!Number.isFinite(v)) return acc;
      return { min: Math.min(acc.min, v), max: Math.max(acc.max, v) };
    }, { min: Infinity, max: -Infinity });
    // state._hourly (e portanto rowsInPeriod, que preserva a ordem) vem do
    // mais antigo pro mais recente — a última leitura do período é sempre
    // o último item do array.
    const last = rows[rows.length - 1] || {};

    const tempRange = minMax("temp");
    setText("weatherstationPeriodTemp", tC(avg("temp")));
    setText("weatherstationPeriodTempRange", Number.isFinite(tempRange.min) ? `${t("Máx")} ${f1(tempRange.max)}° / ${t("Mín")} ${f1(tempRange.min)}°C` : "");
    setText("weatherstationPeriodHumidity", tPct(num(last.humidity)));
    setText("weatherstationPeriodWind", tMs(num(last.wind)));
    setText("weatherstationPeriodRadiation", tWm2(num(last.radiation)));
    setText("weatherstationPeriodEto", tMm(sum("eto"), 2));
    setText("weatherstationPeriodRain", tMm(sum("rain"), 1));
  }

  // ─── Gráfico de Clima (posição do Gráfico de Consumo) ──────────────────
  // Mesmo estilo visual e mesmas séries/eixos do gráfico da aba "Geral"
  // escondida da própria Estação (CHART_SERIES/CHART_AXES/chartBuildAxes/
  // chartDrawMain, em view.details.js): grade horizontal, eixo próprio por
  // série (esquerda: Temp/Umidade/Vento; direita: ETo+Chuva/Radiação/
  // Bateria), legenda com toggle por série, tooltip que acompanha o
  // cursor. Sem o zoom/navegador interno — o filtro de período da tela já
  // cumpre esse papel aqui.

  const CHART_SERIES = {
    temp: { color: "#ef4444", axisId: "temp", label: "Temperatura", unit: "°C", dec: 1 },
    humidity: { color: "#0ea5e9", axisId: "hum", label: "Umidade", unit: "%", dec: 0 },
    wind: { color: "#14b8a6", axisId: "wind", label: "Vento", unit: "m/s", dec: 1 },
    eto: { color: "#16a34a", axisId: "eto", label: "ETo", unit: "mm", dec: 2 },
    rain: { color: "#3b82f6", axisId: "rain", label: "Chuva", unit: "mm", dec: 1, kind: "bar" },
    radiation: { color: "#f59e0b", axisId: "rad", label: "Radiação", unit: "W/m²", dec: 0 },
    battery: { color: "#a855f7", axisId: "batt", label: "Bateria", unit: "V", dec: 2, dashed: true },
  };
  // ETo e Chuva têm eixo próprio (não mais compartilhado): ETo à esquerda,
  // Chuva à direita — a pedido do usuário, pra não misturar as duas
  // escalas na mesma régua.
  const CHART_AXES = {
    temp: { side: "left", order: 0, unit: "°C", color: "#ef4444", zeroBased: false },
    hum: { side: "left", order: 1, unit: "%", color: "#0ea5e9", zeroBased: true },
    wind: { side: "left", order: 2, unit: "m/s", color: "#14b8a6", zeroBased: true },
    eto: { side: "left", order: 3, unit: "mm", color: "#16a34a", zeroBased: true },
    rain: { side: "right", order: 0, unit: "mm", color: "#3b82f6", zeroBased: true },
    rad: { side: "right", order: 1, unit: "W/m²", color: "#f59e0b", zeroBased: true },
    batt: { side: "right", order: 2, unit: "V", color: "#a855f7", zeroBased: true },
  };
  // Por padrão só ETo e Chuva ficam ativas no gráfico (as demais séries
  // continuam disponíveis na legenda, um clique liga cada uma).
  const activeSeries = Object.fromEntries(Object.keys(CHART_SERIES).map((k) => [k, k === "eto" || k === "rain"]));
  const AXIS_COL_W = 38;

  const SVGNS = "http://www.w3.org/2000/svg";
  function mkSvg(tag, attrs) {
    const el = document.createElementNS(SVGNS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  function chartFmtTick(v) {
    const abs = Math.abs(v);
    if (abs >= 100) return String(Math.round(v));
    if (abs >= 10) return String(Math.round(v * 10) / 10);
    return String(Math.round(v * 100) / 100);
  }

  function chartFmtX(date, spanHours) {
    if (spanHours <= 48) return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    if (spanHours <= 24 * 20) return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    return date.toLocaleDateString(window.IcI18n?.getLocale?.() || "pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
  }

  function chartEnsureTip(card) {
    if (!card) return null;
    let tip = card.querySelector(".weatherstation-tip");
    if (!tip) {
      tip = document.createElement("div");
      tip.className = "weatherstation-tip";
      card.appendChild(tip);
    }
    return tip;
  }

  // ETo/Chuva primeiro (são as que vêm ativas por padrão), depois o resto
  // na ordem original.
  const LEGEND_ORDER = ["eto", "rain", "temp", "humidity", "wind", "radiation", "battery"];

  function renderLegend() {
    const legend = $("weatherstationChartLegend");
    if (!legend) return;
    legend.innerHTML = LEGEND_ORDER.map((key) => {
      const cfg = CHART_SERIES[key];
      const swatchCls = cfg.kind === "bar" ? "weatherstation-legend-swatch--bar" : cfg.dashed ? "weatherstation-legend-swatch--dash" : "weatherstation-legend-swatch--line";
      return `<button type="button" class="weatherstation-legend-item ${activeSeries[key] ? "" : "is-off"}" data-weatherstation-series="${key}"><i class="weatherstation-legend-swatch ${swatchCls}" style="--c:${cfg.color}"></i>${t(cfg.label)}</button>`;
    }).join("");
  }

  function chartBuildAxes(keys, rows, plotBottom, PAD_T, plotH) {
    const byId = {};
    keys.forEach((k) => {
      const id = CHART_SERIES[k].axisId;
      if (!byId[id]) byId[id] = { id, ...CHART_AXES[id], seriesKeys: [] };
      byId[id].seriesKeys.push(k);
    });
    const list = Object.values(byId);
    list.forEach((ax) => {
      let min = Infinity, max = -Infinity;
      ax.seriesKeys.forEach((k) => {
        rows.forEach((r) => {
          const v = Number(r[k]);
          if (Number.isFinite(v)) { if (v < min) min = v; if (v > max) max = v; }
        });
      });
      if (!Number.isFinite(max)) { min = 0; max = 1; }
      if (ax.zeroBased) min = Math.min(0, min);
      else min -= (max - min || 1) * 0.1;
      max += (max - min || 1) * 0.08;
      if (max === min) max += 1;
      ax.min = min;
      ax.max = max;
      ax.y = (v) => plotBottom - ((v - min) / (max - min)) * (plotBottom - PAD_T);
      ax.valueAt = (frac) => min + frac * (max - min);
    });
    const left = list.filter((a) => a.side === "left").sort((a, b) => a.order - b.order);
    const right = list.filter((a) => a.side === "right").sort((a, b) => a.order - b.order);
    const PAD_L = Math.max(14, left.length * AXIS_COL_W + 6);
    const PAD_R = Math.max(14, right.length * AXIS_COL_W + 6);
    left.forEach((a, idx) => { a.x = PAD_L - idx * AXIS_COL_W; });
    // a.x dos eixos da direita depende de W (largura total do SVG), que só
    // é conhecida em renderClimateChart — recomputado logo depois de chamar
    // esta função, antes de qualquer um deles ser desenhado.
    return { byId, left, right, PAD_L, PAD_R };
  }

  function renderClimateChart() {
    const svg = $("weatherstationChartSvg");
    const rows = rowsInPeriod();
    if (!svg || rows.length < 2) return;
    const card = svg.closest(".weatherstation-mini-chart");

    const rect = svg.getBoundingClientRect();
    const W = Math.max(320, Math.round(rect.width) || 460);
    const H = Math.max(200, Math.round(rect.height) || 220);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

    const PAD_T = 16, PAD_B = 28;
    const plotH = H - PAD_T - PAD_B;
    const plotBottom = PAD_T + plotH;
    const n = rows.length;

    const keys = Object.keys(CHART_SERIES).filter((k) => activeSeries[k]);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.appendChild(mkSvg("rect", { x: 0, y: 0, width: W, height: H, fill: "transparent" }));
    if (!keys.length) return;

    const axes = chartBuildAxes(keys, rows, plotBottom, PAD_T, plotH);
    const PAD_L = axes.PAD_L, PAD_R = axes.PAD_R;
    axes.right.forEach((a, idx) => { a.x = W - PAD_R + idx * AXIS_COL_W; });
    const plotW = W - PAD_L - PAD_R;
    const xAt = (i) => PAD_L + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
    const axisOf = (k) => axes.byId[CHART_SERIES[k].axisId];

    // Centraliza a legenda em relação ao meio do eixo X do gráfico (não do
    // card inteiro) — como a margem esquerda/direita muda conforme quantos
    // eixos estão ativos de cada lado, o "meio do plot" quase nunca é o
    // meio do card. justify-content:center já centraliza a legenda (com
    // wrap incluído) em relação à própria largura do card; um translateX
    // desloca esse centro pro ponto certo sem interferir no wrap, medindo
    // a largura real do card (não a do viewBox, que pode não bater 1:1
    // com o CSS depois de um resize).
    const legend = $("weatherstationChartLegend");
    if (legend) {
      // Mesma largura de referência do svg (mede o pai real, não o card
      // inteiro, que tem padding a mais que o svg não tem).
      const bodyWidth = svg.parentElement?.getBoundingClientRect().width || W;
      const plotCenterFrac = 0.5 + (PAD_L - PAD_R) / (2 * W);
      const shiftPx = (plotCenterFrac - 0.5) * bodyWidth;
      legend.style.transform = Math.abs(shiftPx) > 0.5 ? `translateX(${shiftPx.toFixed(1)}px)` : "";
    }

    const TICKS = 5;
    for (let g = 0; g <= TICKS; g++) {
      const y = plotBottom - (g / TICKS) * plotH;
      svg.appendChild(mkSvg("line", { x1: PAD_L, y1: y, x2: PAD_L + plotW, y2: y, stroke: "#eef2f7", "stroke-width": 1 }));
    }

    [...axes.left, ...axes.right].forEach((ax) => {
      const isLeft = ax.side === "left";
      svg.appendChild(mkSvg("line", { x1: ax.x, y1: PAD_T, x2: ax.x, y2: plotBottom, stroke: ax.color, "stroke-width": 1, opacity: 0.35 }));
      for (let g = 0; g <= TICKS; g++) {
        const frac = g / TICKS;
        const y = plotBottom - frac * plotH;
        const label = mkSvg("text", { x: isLeft ? ax.x - 4 : ax.x + 4, y: y + 3, "text-anchor": isLeft ? "end" : "start", "font-size": 9, fill: ax.color });
        label.textContent = chartFmtTick(ax.valueAt(frac));
        svg.appendChild(label);
      }
      const unit = mkSvg("text", { x: isLeft ? ax.x - 2 : ax.x + 2, y: PAD_T - 5, "text-anchor": isLeft ? "end" : "start", "font-size": 9, "font-weight": 600, fill: ax.color });
      unit.textContent = ax.unit;
      svg.appendChild(unit);
    });

    // Barras (chuva) atrás das linhas.
    keys.filter((k) => CHART_SERIES[k].kind === "bar").forEach((k) => {
      const cfg = CHART_SERIES[k];
      const ax = axisOf(k);
      const bw = Math.max(2, Math.min(12, (plotW / n) * 0.7));
      for (let i = 0; i < n; i++) {
        const val = Number(rows[i]?.[k]);
        if (!Number.isFinite(val) || val <= 0) continue;
        const by = ax.y(val);
        svg.appendChild(mkSvg("rect", { x: (xAt(i) - bw / 2).toFixed(1), y: by.toFixed(1), width: bw.toFixed(1), height: Math.max(0, plotBottom - by).toFixed(1), fill: cfg.color, opacity: 0.55 }));
      }
    });

    keys.filter((k) => CHART_SERIES[k].kind !== "bar").forEach((k) => {
      const cfg = CHART_SERIES[k];
      const ax = axisOf(k);
      let d = "", started = false;
      for (let i = 0; i < n; i++) {
        const val = Number(rows[i]?.[k]);
        if (!Number.isFinite(val)) { started = false; continue; }
        d += (started ? "L" : "M") + xAt(i).toFixed(1) + " " + ax.y(val).toFixed(1) + " ";
        started = true;
      }
      if (d) svg.appendChild(mkSvg("path", { d, fill: "none", stroke: cfg.color, "stroke-width": 1.8, "stroke-linejoin": "round", ...(cfg.dashed ? { "stroke-dasharray": "5 3" } : {}) }));
    });

    const spanHours = n;
    const xStep = Math.max(1, Math.round(n / 8));
    for (let i = 0; i < n; i += xStep) {
      const label = mkSvg("text", { x: xAt(i).toFixed(1), y: H - 8, "text-anchor": "middle", "font-size": 10, fill: "#94a3b8" });
      label.textContent = chartFmtX(new Date(rows[i].ts), spanHours);
      svg.appendChild(label);
    }

    // Tooltip: linha-guia + pontos + balão que acompanham o cursor.
    const guide = mkSvg("line", { x1: 0, y1: PAD_T, x2: 0, y2: plotBottom, stroke: "#cbd5e1", "stroke-width": 1, "stroke-dasharray": "3 3", opacity: 0, "pointer-events": "none" });
    svg.appendChild(guide);
    const dots = keys.filter((k) => CHART_SERIES[k].kind !== "bar").map((k) => {
      const c = mkSvg("circle", { r: 3.5, cx: 0, cy: 0, fill: CHART_SERIES[k].color, stroke: "#fff", "stroke-width": 1.5, opacity: 0, "pointer-events": "none" });
      svg.appendChild(c);
      return { k, c };
    });

    const tip = chartEnsureTip(card);
    const hideTip = () => {
      if (tip) tip.classList.remove("is-visible");
      guide.setAttribute("opacity", 0);
      dots.forEach((d) => d.c.setAttribute("opacity", 0));
    };

    const hover = mkSvg("rect", { x: PAD_L, y: PAD_T, width: plotW, height: plotH, fill: "transparent" });
    hover.addEventListener("mousemove", (event) => {
      const box = svg.getBoundingClientRect();
      const px = ((event.clientX - box.left) / box.width) * W;
      let i = Math.round(((px - PAD_L) / plotW) * (n - 1));
      if (i < 0) i = 0;
      if (i > n - 1) i = n - 1;
      const row = rows[i];
      if (!row) { hideTip(); return; }
      const cx = xAt(i);
      guide.setAttribute("x1", cx); guide.setAttribute("x2", cx); guide.setAttribute("opacity", 1);

      const lines = [];
      let anchorY = plotBottom - plotH / 2;
      keys.forEach((k) => {
        const cfg = CHART_SERIES[k];
        const val = Number(row[k]);
        if (!Number.isFinite(val)) return;
        if (cfg.kind !== "bar") {
          const dot = dots.find((d) => d.k === k);
          const y = axisOf(k).y(val);
          if (dot) { dot.c.setAttribute("cx", cx); dot.c.setAttribute("cy", y); dot.c.setAttribute("opacity", 1); }
          anchorY = y;
        }
        if (cfg.kind === "bar" && val <= 0) return;
        lines.push(`<div class="weatherstation-tip__row"><i class="weatherstation-tip__dot" style="background:${cfg.color}"></i>${t(cfg.label)}: <strong>${val.toFixed(cfg.dec)} ${cfg.unit}</strong></div>`);
      });

      if (tip) {
        const dt = new Date(row.ts);
        tip.innerHTML = `<div class="weatherstation-tip__date">${dt.toLocaleDateString(window.IcI18n?.getLocale?.() || "pt-BR", { weekday: "short", day: "2-digit", month: "short" }).replace(/\./g, "")}, ${dt.toLocaleTimeString(window.IcI18n?.getLocale?.() || "pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>${lines.join("")}`;
        tip.classList.add("is-visible");
        const scaleX = box.width / W, scaleY = box.height / H;
        const cardBox = card.getBoundingClientRect();
        const leftPx = box.left - cardBox.left + cx * scaleX;
        const topPx = box.top - cardBox.top + anchorY * scaleY;
        tip.style.left = Math.round(leftPx) + "px";
        tip.style.top = Math.round(topPx) + "px";
        tip.classList.toggle("is-flipped", leftPx + tip.offsetWidth + 24 > cardBox.width);
      }
    });
    hover.addEventListener("mouseleave", hideTip);
    svg.appendChild(hover);
  }

  // ─── Render geral ──────────────────────────────────────────────────────

  function renderData() {
    const equip = getSelected();
    if (!equip) return;
    const d = Data().normalizeEst?.(equip) || {};
    const c = d.current || {};

    setText("weatherstationTitleLabel", d.name || "Estação Meteorológica");

    const bar = $("weatherstationStatusBar");
    const text = $("weatherstationStatusText");
    if (bar) {
      bar.classList.toggle("is-offline", !!d.offline);
      bar.classList.toggle("is-info", !d.offline);
    }
    if (text) text.textContent = d.offline ? t("SEM COMUNICAÇÃO") : t("MONITORANDO");

    const lastUpdateEl = $("weatherstationLastUpdate");
    if (lastUpdateEl) {
      lastUpdateEl.innerHTML = `<span class="comm-label">${t("Última comunicação:")}</span> ${window.IcEquipUtils?.formatLastUpdate?.(d.updated) ?? "—"}`;
    }
    setText("weatherstationKpiComm", window.IcEquipUtils?.formatLastUpdate?.(d.updated) ?? "—");

    setText("weatherstationKpiTemp", tC(num(c.temperature)));
    setText("weatherstationKpiHumidity", tPct(num(c.humidity)));
    setText("weatherstationKpiWind", tMs(num(c.windSpeed)));
    setText("weatherstationKpiEto", tMm(num(c.eto), 2));
    setText("weatherstationKpiRadiation", tWm2(num(c.solarRadiation)));
    setText("weatherstationKpiRainDay", tMm(num(c.rainDay) ?? num(c.precipitation), 1));

    Data().ensureHourly?.(d);
    rawPage = 0;
    renderReadings();
    renderPeriodStats();
    renderLegend();
    renderClimateChart();
    initMinimap();
  }

  // Filtro de período (mesmo popover global) muda -> recalcula indicadores
  // e gráfico. Só re-renderiza se a tela da Estação estiver mesmo montada.
  document.addEventListener("pluv:periodChanged", () => {
    if ($("weatherstationChartSvg")) {
      renderPeriodStats();
      renderClimateChart();
    }
  });

  // ─── Ciclo de vida ─────────────────────────────────────────────────────

  window.IcWeatherStationDetails = {
    async open(options = {}) {
      window.Est = window.Est || {};
      window.Est.state = window.Est.state || {};
      if (options.estId) window.Est.state.detailsFocusId = options.estId;
      const slot = $("pageSlot");
      if (!slot) return;
      document.body.classList.remove("is-pivo-details-only");
      document.body.classList.add("is-pivo-details");
      try {
        const html = await fetch(`./pages/weatherstation.details.html?v=${Date.now()}`).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); });
        slot.innerHTML = html;
        this.bindEvents();
        this.renderData();
        if (options.fromMap) slot.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (err) {
        document.body.classList.remove("is-pivo-details");
        console.error("[weatherstation-details] Falha ao carregar weatherstation.details.html", err);
      }
    },

    close() {
      const slot = $("pageSlot");
      if (slot) slot.innerHTML = "";
      document.body.classList.remove("is-pivo-details");
      if (minimap) {
        try { minimap.off(); minimap.remove(); } catch (_) { }
        minimap = null;
      }
    },

    renderData,

    bindEvents() {
      document.querySelectorAll(".js-weatherstation-back").forEach((btn) => btn.addEventListener("click", () => {
        this.close();
        document.querySelector('.nav__item[data-route="visao-geral"]')?.click();
      }));

      $("weatherstationEditBtn")?.addEventListener("click", () => {
        const equip = getSelected();
        // Abre o edit como overlay por cima da tela de detalhes (igual ao pivo/carretel)
        window.IcEstacaoEdit?.open?.({ estId: equip?.id });
      });

      const menu = $("weatherstationSelectorMenu");
      if (menu) {
        if (selectorOutsideClickHandler) document.removeEventListener("click", selectorOutsideClickHandler);
        selectorOutsideClickHandler = (event) => {
          const btn = event.target.closest("#weatherstationSelectBtn");
          if (btn) {
            event.stopPropagation();
            const hidden = getComputedStyle(menu).display === "none";
            if (hidden) renderSelectorItems(menu);
            menu.style.display = hidden ? "flex" : "none";
            btn.classList.toggle("is-active", hidden);
            return;
          }
          if (!menu.contains(event.target)) {
            menu.style.display = "none";
            $("weatherstationSelectBtn")?.classList.remove("is-active");
          }
        };
        document.addEventListener("click", selectorOutsideClickHandler);
      }

      $("weatherstationReadingsPagination")?.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-weatherstation-raw-nav]");
        if (!btn || btn.disabled) return;
        rawPage += btn.dataset.weatherstationRawNav === "next" ? 1 : -1;
        renderReadings();
      });

      $("weatherstationExportCsvBtn")?.addEventListener("click", () => exportReadingsCsv());

      $("weatherstationChartLegend")?.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-weatherstation-series]");
        if (!btn) return;
        const key = btn.dataset.weatherstationSeries;
        activeSeries[key] = !activeSeries[key];
        renderLegend();
        renderClimateChart();
      });
    },
  };
})();
