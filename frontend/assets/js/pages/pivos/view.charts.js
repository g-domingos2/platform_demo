// assets/js/pages/pivos/view.charts.js
(function () {
  "use strict";

  const Pivos = (window.Pivos = window.Pivos || {});
  const state = (Pivos.state = Pivos.state || {});
  const views = (Pivos.views = Pivos.views || {});
  const chartsView = (views.charts = views.charts || {});

  const numberFormatter = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const chartColors = Object.freeze({
    peak: "#f87171",
    offPeak: "#93c5fd",
    reduced: "#86efac",
  });

  const consumptionPresets = Object.freeze([
    {
      volumeTotal: 18420,
      volumeLastMonth: 6240,
      hoursTotal: 214.6,
      hoursLastMonth: 72.4,
      wetHours: { peak: 36, offPeak: 31, reduced: 33 },
      energyCosts: { peak: 4820, offPeak: 3910, reduced: 2680 },
    },
    {
      volumeTotal: 22680,
      volumeLastMonth: 7585,
      hoursTotal: 246.9,
      hoursLastMonth: 81.3,
      wetHours: { peak: 29, offPeak: 34, reduced: 37 },
      energyCosts: { peak: 4360, offPeak: 4150, reduced: 2875 },
    },
    {
      volumeTotal: 19760,
      volumeLastMonth: 6895,
      hoursTotal: 231.4,
      hoursLastMonth: 76.8,
      wetHours: { peak: 34, offPeak: 28, reduced: 38 },
      energyCosts: { peak: 5110, offPeak: 3520, reduced: 3010 },
    },
  ]);

  function polarToXY(cx, cy, r, angleDeg) {
    const angle = (angleDeg - 90) * (Math.PI / 180);
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  }

  function donutSectorPath(cx, cy, rOuter, rInner, startDeg, endDeg) {
    const p1 = polarToXY(cx, cy, rOuter, startDeg);
    const p2 = polarToXY(cx, cy, rOuter, endDeg);
    const p3 = polarToXY(cx, cy, rInner, endDeg);
    const p4 = polarToXY(cx, cy, rInner, startDeg);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;

    return [
      `M ${p1.x} ${p1.y}`,
      `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
      `L ${p3.x} ${p3.y}`,
      `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
      "Z",
    ].join(" ");
  }

  function pieSectorPath(cx, cy, r, startDeg, endDeg) {
    const p1 = polarToXY(cx, cy, r, startDeg);
    const p2 = polarToXY(cx, cy, r, endDeg);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;

    return [
      `M ${cx} ${cy}`,
      `L ${p1.x} ${p1.y}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
      "Z",
    ].join(" ");
  }

  const faultPresets = Object.freeze([
    { pressure: 2, misalignment: 1, voltageLow: 1, voltagePeak: 0, irrigationAccumulated: 98 },
    { pressure: 4, misalignment: 0, voltageLow: 2, voltagePeak: 1, irrigationAccumulated: 132 },
    { pressure: 1, misalignment: 2, voltageLow: 0, voltagePeak: 0, irrigationAccumulated: 76 },
  ]);

  function hashPivotId(pivotId) {
    return String(pivotId || "pivot")
      .split("")
      .reduce((total, char) => total + char.charCodeAt(0), 0);
  }

  function getPivotConsumptionSnapshot(pivotId) {
    return consumptionPresets[hashPivotId(pivotId) % consumptionPresets.length];
  }

  function getPivotFaultsSnapshot(pivotId) {
    return faultPresets[hashPivotId(pivotId) % faultPresets.length];
  }

  // Os presets acima representam uma referência de 30 dias (mesma base do
  // KPI "no Último Mês"). O período selecionado no popover de calendário
  // (mesmo popover reaproveitado da Pluviometria) escala esses valores
  // linearmente pra parecer plausível pro intervalo escolhido, sem inventar
  // uma fonte de dados nova.
  function getSelectedPeriodDays() {
    const period = window.Plv?.state?.period;
    if (period?.start && period?.end) {
      const ms = new Date(period.end) - new Date(period.start);
      return Math.max(1, Math.round(ms / 86400000) + 1);
    }
    return 1;
  }

  function scaleSnapshotToPeriod(snapshot, days) {
    const scale = days / 30;
    return {
      ...snapshot,
      volumeTotal: snapshot.volumeTotal * scale,
      hoursTotal: snapshot.hoursTotal * scale,
      energyCosts: {
        peak: snapshot.energyCosts.peak * scale,
        offPeak: snapshot.energyCosts.offPeak * scale,
        reduced: snapshot.energyCosts.reduced * scale,
      },
    };
  }

  function scaleFaultCount(base, days) {
    return Math.round(base * (days / 30));
  }

  const PRESET_LABELS = Object.freeze({
    "7d": "nos Últimos 7 dias",
    "14d": "nos Últimos 14 dias",
    "30d": "nos Últimos 30 dias",
    "90d": "nos Últimos 90 dias",
    thisWeek: "nesta Semana",
    lastWeek: "na Semana Passada",
    thisMonth: "neste Mês",
    lastMonth: "no Mês Passado",
    thisYear: "neste Ano",
    lastYear: "no Ano Passado",
  });

  function fmtDateBR(d) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${d.getFullYear()}`;
  }

  // Identifica se o período atual bate com um dos presets do popover
  // (mesma lógica usada pra marcar o preset ativo no calendário).
  function matchSelectedPreset() {
    const period = window.Plv?.state?.period;
    const computePresetRange = window.Plv?.period?.computePresetRange;
    if (!period?.start || !period?.end || typeof computePresetRange !== "function") return null;

    const start = new Date(period.start);
    const end = new Date(period.end);
    for (const preset of Object.keys(PRESET_LABELS)) {
      const range = computePresetRange(preset);
      if (range && isSameDay(range.start, start) && isSameDay(range.end, end)) return preset;
    }
    return null;
  }

  // Traduz o período selecionado no popover pra um texto curto ("nos
  // Últimos 7 dias", "neste Mês"...), reconhecendo os mesmos presets do
  // calendário. Fora dos presets (intervalo escolhido à mão), cai pro
  // range de datas. Usado só nos KPIs da direita — os da esquerda
  // ("Volume Total"/"Horas Totais de Trabalho") são o total geral fixo,
  // não acompanham o calendário.
  function getPeriodLabel() {
    const period = window.Plv?.state?.period;
    if (!period?.start || !period?.end) return "no Período";

    const preset = matchSelectedPreset();
    if (preset) return PRESET_LABELS[preset];

    const start = new Date(period.start);
    const end = new Date(period.end);
    if (isSameDay(start, end)) return `em ${fmtDateBR(start)}`;
    return `de ${fmtDateBR(start)} a ${fmtDateBR(end)}`;
  }

  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  // ── Acumulado de irrigação | precipitação por segmento ─────────────────────
  // Mock determinístico: o mesmo pivô no mesmo dia sempre dá o mesmo valor. Assim o total de um período
  // é a soma dos dias e períodos diferentes continuam coerentes entre si (card de indicadores e modal).
  function seededRandom(seed) {
    let h = 1779033703 ^ seed.length;
    for (let i = 0; i < seed.length; i++) {
      h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  const normAngle = (a) => ((Number(a) % 360) + 360) % 360;

  // Segmentos cadastrados no pivô (nome + faixa de ângulo). Sem segmentos cadastrados, vale um único
  // segmento cobrindo o pivô inteiro (ou só o setor, quando o pivô é parcial).
  function getPivotSegments(pivo) {
    const registered = (Array.isArray(pivo?.segments) ? pivo.segments : [])
      .filter((s) => Number.isFinite(Number(s?.startAngle)) && Number.isFinite(Number(s?.endAngle)));
    const raw = registered.length
      ? registered.map((s, i) => ({ id: s.id || `seg_${i}`, name: s.name || `Segmento ${i + 1}`, startAngle: s.startAngle, endAngle: s.endAngle }))
      : [{
        id: "seg_all", name: "Segmento 1",
        startAngle: pivo?.isSector ? Number(pivo.startAngle) || 0 : 0,
        endAngle: pivo?.isSector ? Number(pivo.endAngle) || 360 : 360,
      }];
    return raw.map((s) => {
      const start = normAngle(s.startAngle);
      const endMod = normAngle(s.endAngle);
      const end = endMod === 0 ? 360 : endMod; // 0° como fim de faixa significa volta completa (360°)
      const span = end > start ? end - start : end + 360 - start;
      return { id: s.id, name: s.name, startAngle: start, endAngle: end, span };
    });
  }

  // Período escolhido no calendário compartilhado; sem seleção, últimos 7 dias.
  function getSelectedPeriod() {
    const period = window.Plv?.state?.period;
    if (period?.start && period?.end) return { start: new Date(period.start), end: new Date(period.end) };
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    return { start, end };
  }

  const round1 = (n) => Math.round(n * 10) / 10;
  const round2 = (n) => Math.round(n * 100) / 100;

  // Acumulado de um segmento (índice i) em um período: lâmina de irrigação e precipitação (chuva).
  function accumulateSegment(pivotId, i, start, end) {
    const base = getPivotFaultsSnapshot(pivotId).irrigationAccumulated / 30; // mm/dia médio do pivô
    const RUN_PROB = 0.65; // fração de dias em que o pivô irriga
    const factor = 0.75 + seededRandom(`${pivotId}|seg${i}`) * 0.5; // cada segmento recebe um pouco diferente
    const from = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const to = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    let irrigation = 0;
    let rain = 0;
    let days = 0;

    for (const day = new Date(from); day <= to && days < 3700; day.setDate(day.getDate() + 1)) {
      days += 1;
      const key = `${pivotId}|${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}`;
      if (seededRandom(`${key}|run`) < RUN_PROB) irrigation += (base / RUN_PROB) * factor * (0.8 + 0.4 * seededRandom(`${key}|irr${i}`));
      if (seededRandom(`${key}|rain`) < 0.22) rain += (2 + seededRandom(`${key}|rainmm`) * 14) * (0.9 + 0.2 * seededRandom(`${key}|rain${i}`));
    }
    return { irrigation: round1(irrigation), rain: round1(rain), days };
  }

  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  // Acumulado de cada segmento, cada um com o seu período ({ [idDoSegmento]: { start, end } }); o que não
  // tiver período próprio usa "fallback". samePeriod diz se todos os segmentos estão no mesmo período
  // (só então a média do pivô faz sentido).
  function getSegmentsBreakdown(pivotId, segments, periodsById, fallback) {
    const rows = segments.map((seg, i) => {
      const period = periodsById?.[seg.id] || fallback;
      return { ...seg, start: period.start, end: period.end, ...accumulateSegment(pivotId, i, period.start, period.end) };
    });
    const spanTotal = rows.reduce((sum, row) => sum + row.span, 0) || 1;
    const weighted = (field) => rows.reduce((sum, row) => sum + row[field] * row.span, 0) / spanTotal;
    const samePeriod = rows.every((row) => sameDay(row.start, rows[0].start) && sameDay(row.end, rows[0].end));
    return { rows, samePeriod, totals: { irrigation: round2(weighted("irrigation")), rain: round2(weighted("rain")) } };
  }

  // Mesmo período para todos os segmentos (card de indicadores).
  function getIrrigationBreakdown(pivotId, segments, start, end) {
    return getSegmentsBreakdown(pivotId, segments, null, { start, end });
  }

  // Valores do pivô inteiro no período da página (média ponderada pelos ângulos dos segmentos).
  function getPivotIrrigationSummary(pivotId) {
    const pivo = window.Pivos?.data?.getPivotData?.(pivotId);
    const period = getSelectedPeriod();
    return getIrrigationBreakdown(pivotId, getPivotSegments(pivo), period.start, period.end).totals;
  }

  function renderFaults(pivotId, days) {
    const card = document.getElementById("pivoFaultsCard");
    if (!card) return;

    const snapshot = getPivotFaultsSnapshot(pivotId);
    const setValue = (fault, text) => {
      const el = card.querySelector(`.js-fault-item[data-fault="${fault}"] .pivo-faults__value`);
      if (el) el.textContent = text;
    };

    setValue("pressure", String(scaleFaultCount(snapshot.pressure, days)));
    setValue("misalignment", String(scaleFaultCount(snapshot.misalignment, days)));
    setValue("voltage_low", String(scaleFaultCount(snapshot.voltageLow, days)));
    setValue("voltage_peak", String(scaleFaultCount(snapshot.voltagePeak, days)));
    // Irrigação | precipitação do pivô no período da página (mesma fonte do modal).
    const irrigation = getPivotIrrigationSummary(pivotId);
    const pairEl = card.querySelector('.js-fault-item[data-fault="irrigation_accumulated"] .pivo-faults__value');
    if (pairEl) {
      const locale = window.IcI18n?.getLocale?.() || "pt-BR";
      const fmt2 = (v) => Number(v).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      pairEl.innerHTML = `${fmt2(irrigation.irrigation)}<small>mm</small><span class="pivo-faults__sep">|</span>${fmt2(irrigation.rain)}<small>mm</small>`;
    }
  }

  function formatNumber(value) {
    return numberFormatter.format(Number(value) || 0);
  }

  function formatCurrency(value) {
    return currencyFormatter.format(Number(value) || 0);
  }

  function setMetricHtml(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  // Balão de hover compartilhado pelos gráficos de pizza/donut/barras do
  // pivô. Um único elemento por container, recriado a cada render — por
  // isso remove qualquer balão anterior antes de criar o novo (necessário
  // pra Pluviometria, cujo container não é limpo por inteiro a cada
  // render como acontece com renderPie/renderDonut).
  function attachSectorTooltips(container, svg) {
    container.querySelectorAll(":scope > .pivo-chart-tooltip").forEach((el) => el.remove());

    const tooltip = document.createElement("div");
    tooltip.className = "pivo-chart-tooltip";
    tooltip.innerHTML = `<span class="pivo-chart-tooltip__dot"></span><span class="pivo-chart-tooltip__label"></span><strong class="pivo-chart-tooltip__value"></strong>`;
    container.appendChild(tooltip);

    const dot = tooltip.querySelector(".pivo-chart-tooltip__dot");
    const labelEl = tooltip.querySelector(".pivo-chart-tooltip__label");
    const valueEl = tooltip.querySelector(".pivo-chart-tooltip__value");

    const positionTooltip = (evt) => {
      const rect = container.getBoundingClientRect();
      tooltip.style.left = `${evt.clientX - rect.left}px`;
      tooltip.style.top = `${evt.clientY - rect.top}px`;
    };

    const showTooltip = (shape, evt) => {
      // paths/rects de SVG usam fill; divs (barras HTML) usam data-color
      dot.style.background = shape.dataset.color || shape.getAttribute("fill") || "";
      labelEl.textContent = shape.dataset.label || "";
      valueEl.textContent = shape.dataset.tooltipValue || "";
      positionTooltip(evt);
      tooltip.classList.add("is-visible");
    };

    svg.querySelectorAll("[data-label]").forEach((shape) => {
      shape.addEventListener("mouseenter", (evt) => showTooltip(shape, evt));
      shape.addEventListener("mousemove", positionTooltip);
      shape.addEventListener("mouseleave", () => tooltip.classList.remove("is-visible"));
    });
  }

  function renderDonut(el, segments, opts = {}) {
    if (!el) return;

    const total = segments.reduce((sum, segment) => sum + (Number(segment.value) || 0), 0) || 1;
    const cx = 50;
    const cy = 50;
    const rOuter = opts.rOuter ?? 45;
    const rInner = opts.rInner ?? 32;
    const gapDeg = opts.gapDeg ?? 1.2;

    el.innerHTML = "";

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("class", "donut-svg");

    let angle = 0;

    segments.forEach((segment) => {
      const value = Math.max(0, Number(segment.value) || 0);
      const sweep = (value / total) * 360;
      let start = angle + gapDeg / 2;
      let end = angle + sweep - gapDeg / 2;

      if (sweep <= gapDeg + 0.2) {
        start = angle;
        end = angle + sweep;
      }

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", donutSectorPath(cx, cy, rOuter, rInner, start, end));
      path.setAttribute("fill", segment.color);
      path.setAttribute("class", "donut-sector");
      path.setAttribute("data-label", segment.label);
      path.dataset.tooltipValue = opts.formatValue ? opts.formatValue(value) : String(value);
      path.style.strokeWidth = "0px";
      svg.appendChild(path);

      angle += sweep;
    });

    el.appendChild(svg);

    const center = document.createElement("div");
    center.className = "donut-center-text";
    center.innerHTML = `${opts.centerTop ?? "R$ 0,00"}<br>${opts.centerBottom ?? "Total"}`;
    el.appendChild(center);

    attachSectorTooltips(el, svg);
  }

  function renderPie(el, segments, opts = {}) {
    if (!el) return;

    const total = segments.reduce((sum, segment) => sum + (Number(segment.value) || 0), 0) || 1;
    const cx = 50;
    const cy = 50;
    const r = opts.r ?? 45;
    const gapDeg = opts.gapDeg ?? 1.0;

    el.innerHTML = "";

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("class", "pie-svg");

    let angle = 0;

    segments.forEach((segment) => {
      const value = Math.max(0, Number(segment.value) || 0);
      const sweep = (value / total) * 360;
      let start = angle + gapDeg / 2;
      let end = angle + sweep - gapDeg / 2;

      if (sweep <= gapDeg + 0.2) {
        start = angle;
        end = angle + sweep;
      }

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", pieSectorPath(cx, cy, r, start, end));
      path.setAttribute("fill", segment.color);
      path.setAttribute("class", "pie-sector");
      path.setAttribute("data-label", segment.label);
      path.dataset.tooltipValue = opts.formatValue ? opts.formatValue(value) : String(value);
      path.style.strokeWidth = "0px";
      svg.appendChild(path);

      angle += sweep;
    });

    el.appendChild(svg);

    attachSectorTooltips(el, svg);
  }

  // Total geral do equipamento (esquerda do grid): fixo, n\u00e3o acompanha o
  // calend\u00e1rio. Os presets s\u00e3o uma refer\u00eancia mensal (30 dias) \u2014 pra virar
  // um "total geral" que fa\u00e7a sentido (maior que qualquer per\u00edodo que d\u00e1
  // pra selecionar no popover, ex.: Ano Passado), ele \u00e9 anualizado.
  const TOTAL_REFERENCE_DAYS = 365;

  function renderCharts() {
    const days = getSelectedPeriodDays();
    const totalSnapshot = scaleSnapshotToPeriod(getPivotConsumptionSnapshot(state.selectedId), TOTAL_REFERENCE_DAYS);
    const periodSnapshot = scaleSnapshotToPeriod(getPivotConsumptionSnapshot(state.selectedId), days);
    renderFaults(state.selectedId, days);
    const wetHoursSegments = [
      { label: ax("Hor\u00e1rio de Pico"), value: periodSnapshot.wetHours.peak, color: chartColors.peak },
      { label: ax("Fora do Hor\u00e1rio de Pico"), value: periodSnapshot.wetHours.offPeak, color: chartColors.offPeak },
      { label: ax("Reduzido"), value: periodSnapshot.wetHours.reduced, color: chartColors.reduced },
    ];
    const energyCostSegments = [
      { label: ax("Hor\u00e1rio de Pico"), value: periodSnapshot.energyCosts.peak, color: chartColors.peak },
      { label: ax("Fora do Hor\u00e1rio de Pico"), value: periodSnapshot.energyCosts.offPeak, color: chartColors.offPeak },
      { label: ax("Reduzido"), value: periodSnapshot.energyCosts.reduced, color: chartColors.reduced },
    ];
    const totalEnergyCost = energyCostSegments.reduce((sum, segment) => sum + segment.value, 0);

    setText("pivoConsumptionVolumeTotalLabel", ax("Volume Total"));
    setText("pivoConsumptionHoursTotalLabel", ax("Horas Totais de Trabalho"));

    const periodLabel = getPeriodLabel();
    setText("pivoConsumptionVolumeMonthLabel", `${ax("Volume Total")} ${ax(periodLabel)}`);
    setText("pivoConsumptionHoursMonthLabel", `${ax("Horas Totais de Trabalho")} ${ax(periodLabel)}`);

    setMetricHtml("pivoConsumptionVolumeTotal", `${formatNumber(totalSnapshot.volumeTotal)} m<sup>3</sup>`);
    setMetricHtml("pivoConsumptionVolumeMonth", `${formatNumber(periodSnapshot.volumeTotal)} m<sup>3</sup>`);
    setMetricHtml("pivoConsumptionHoursTotal", `${formatNumber(totalSnapshot.hoursTotal)} h`);
    setMetricHtml("pivoConsumptionHoursMonth", `${formatNumber(periodSnapshot.hoursTotal)} h`);

    const consumoEl = document.getElementById("pivoChartConsumo");
    if (consumoEl) {
      consumoEl.classList.add("pivo-chart-container--pie");
      renderPie(consumoEl, wetHoursSegments, {
        r: 45,
        gapDeg: 1.0,
        formatValue: (value) => `${Math.round(value)} hrs`,
      });
    }

    const custosEl = document.getElementById("pivoChartCustos");
    if (custosEl) {
      renderDonut(custosEl, energyCostSegments, {
        rOuter: 46,
        rInner: 32,
        gapDeg: 1.2,
        centerTop: formatCurrency(totalEnergyCost),
        centerBottom: "Total",
        formatValue: (value) => formatCurrency(value),
      });
    }

    renderPluviometriaChart(state.selectedId);
    renderPivotLineCharts(state.selectedId, days);
  }

  // =========================
  // Gráficos de linha "reais mockados": Pressão, Lâmina x Ângulo e Tensão.
  // Curvas geradas por função determinística (seed = id do pivô), eixos e
  // hover interativo (linha vertical + pontos + tooltip seguindo o mouse).
  // =========================

  // PRNG determinístico simples (mulberry32) a partir de um seed inteiro.
  function makeRng(seed) {
    let s = seed >>> 0;
    return function () {
      s |= 0; s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Fim do período: quando o popover define um range usamos o fim dele; senão,
  // "agora" do mock. O período (days) também entra no seed pra a leitura mudar
  // ao trocar o filtro, como se fosse outra medição.
  function getPeriodEnd() {
    const period = window.Plv?.state?.period;
    return period?.end ? new Date(period.end) : new Date("2026-05-30T12:00:00");
  }

  // Pressão × ângulo do pivô. A ponta do pivô cruza um relevo (altitude do
  // GPS): num ponto baixo a pressão sobe, num ponto alto ela cai — nunca
  // abaixo de 1.1 bar. Duas séries:
  //   - "atual": leitura da volta mais recente (com ruído de sensor)
  //   - "comparação": média das leituras dos últimos 30 dias (mais suave)
  const PRESSURE_MIN_BAR = 1.1;
  function buildPressureSeries(pivotId, days) {
    const seed = hashPivotId(pivotId) * 2654435761;
    // --- Relevo: altitude do GPS (m acima do nível do mar) percorrida pela
    //     ponta do pivô. Base > 300 m + um morro e uma baixada. ---
    const rTerr = makeRng(seed + 101);
    const altBase = 360 + Math.floor(rTerr() * 180);    // ~360–540 m
    const aHigh = Math.floor(rTerr() * 360);            // setor mais alto
    const aLow = (aHigh + 150 + Math.floor(rTerr() * 60)) % 360; // setor mais baixo
    const amp = 14 + rTerr() * 12;                      // desnível pico a pico (m)
    const ridge = 3 + rTerr() * 3;                      // ondulações menores
    // h() = altitude relativa (± em torno de altBase)
    const relAt = (a) => {
      const dHigh = Math.min(Math.abs(a - aHigh), 360 - Math.abs(a - aHigh));
      const dLow = Math.min(Math.abs(a - aLow), 360 - Math.abs(a - aLow));
      const hill = (amp / 2) * Math.cos((dHigh / 180) * Math.PI);
      const valley = -(amp / 2) * Math.cos((dLow / 180) * Math.PI);
      return hill + valley + ridge * Math.sin((a * Math.PI) / 180 * 4);
    };
    const altAt = (a) => altBase + relAt(a);
    // --- Pressão base na bomba e ganho por metro de queda de altitude ---
    const rP = makeRng(seed);
    const pumpBar = 4.4 + rP() * 0.6;
    const barPerM = 0.06 + rP() * 0.02;

    const alt = [];
    const readings = [];
    const comparison = [];
    for (let a = 0; a <= 359; a += 2) {
      const h = relAt(a);                               // relativa, pra pressão
      alt.push({ x: a, y: Number(altAt(a).toFixed(0)) }); // absoluta, pra exibir
      // pressão cai quando a ponta sobe (h>0) e sobe quando desce (h<0)
      let p = pumpBar - h * barPerM;
      // Média 30 dias (comparação): perfil limpo, leve viés de degradação.
      let cmp = p - 0.12 - Math.sin((a * Math.PI) / 180 * 2) * 0.05;
      // Atual: ruído de sensor + microvariação por período (nova leitura).
      const rN = makeRng(seed + a * 7 + days * 977);
      p += (rN() - 0.5) * 0.22 + (rN() > 0.97 ? -0.4 : 0);
      p = Math.max(PRESSURE_MIN_BAR, p);
      cmp = Math.max(PRESSURE_MIN_BAR, cmp);
      readings.push({ x: a, y: Number(p.toFixed(2)) });
      comparison.push({ x: a, y: Number(cmp.toFixed(2)) });
    }
    const altMin = Math.min(...alt.map((p) => p.y));
    const altMax = Math.max(...alt.map((p) => p.y));
    return { readings, comparison, alt, altDomain: [Math.floor(altMin - 2), Math.ceil(altMax + 2)] };
  }

  // Lâmina aplicada (mm) por ângulo — patamar com dois setores de reforço.
  function buildDepthSeries(pivotId, days) {
    const rng = makeRng(hashPivotId(pivotId) * 40503 + 7 + days * 131);
    const base = 8 + rng() * 4;
    const boostA = Math.floor(rng() * 360);
    const boostB = (boostA + 120 + Math.floor(rng() * 120)) % 360;
    const readings = [];
    for (let a = 0; a <= 359; a += 3) {
      let v = base + 1.2 * Math.sin((a * Math.PI) / 180 * 3);
      [boostA, boostB].forEach((c) => {
        const d = Math.min(Math.abs(a - c), 360 - Math.abs(a - c));
        if (d < 40) v += 6 * Math.cos((d / 40) * (Math.PI / 2));
      });
      v += (rng() - 0.5) * 0.6;
      readings.push({ x: a, y: Number(Math.max(0, v).toFixed(2)) });
    }
    return { readings };
  }

  // Lâmina x Posição (LineStar). Mesma lógica de buildDepthSeries,
  // mas o eixo X representa posição percentual ao longo da trilha (0–100%).
  function buildLinearDepthSeries(pivotId, days) {
    const rng = makeRng(hashPivotId(pivotId) * 40503 + 7 + days * 131);
    const base = 8 + rng() * 4;
    const boostA = Math.floor(rng() * 100);
    const boostB = (boostA + 30 + Math.floor(rng() * 40)) % 100;
    const readings = [];
    for (let p = 0; p <= 100; p += 2) {
      let v = base + 1.2 * Math.sin((p * Math.PI) / 100 * 6);
      [boostA, boostB].forEach((c) => {
        const d = Math.abs(p - c);
        if (d < 20) v += 6 * Math.cos((d / 20) * (Math.PI / 2));
      });
      v += (rng() - 0.5) * 0.6;
      readings.push({ x: p, y: Number(Math.max(0, v).toFixed(2)) });
    }
    return { readings };
  }

  // Pressão × posição do LineStar (trilha linear A→B, 0–100%).
  // Mesma física do pivô (relevo afeta pressão), mas aplicada a uma linha reta.
  function buildLinearPressureSeries(pivotId, days) {
    const seed = hashPivotId(pivotId) * 2654435761;
    const rTerr = makeRng(seed + 101);
    const altBase = 360 + Math.floor(rTerr() * 180);
    // Dois pontos de elevação/baixada ao longo da trilha (0–100)
    const pHigh = Math.floor(rTerr() * 100);
    const pLow = (pHigh + 30 + Math.floor(rTerr() * 40)) % 100;
    const amp = 14 + rTerr() * 12;
    const ridge = 3 + rTerr() * 3;
    const relAt = (p) => {
      const dHigh = Math.abs(p - pHigh);
      const dLow = Math.abs(p - pLow);
      const hill = (amp / 2) * Math.cos((dHigh / 100) * Math.PI);
      const valley = -(amp / 2) * Math.cos((dLow / 100) * Math.PI);
      return hill + valley + ridge * Math.sin((p * Math.PI) / 100 * 8);
    };
    const rP = makeRng(seed);
    const pumpBar = 4.4 + rP() * 0.6;
    const barPerM = 0.06 + rP() * 0.02;

    const readings = [];
    const comparison = [];
    const alt = [];
    for (let p = 0; p <= 100; p += 2) {
      const h = relAt(p);
      alt.push({ x: p, y: Number((altBase + h).toFixed(0)) });
      let press = pumpBar - h * barPerM;
      let cmp = press - 0.12 - Math.sin((p * Math.PI) / 100 * 4) * 0.05;
      const rN = makeRng(seed + p * 7 + days * 977);
      press += (rN() - 0.5) * 0.22 + (rN() > 0.97 ? -0.4 : 0);
      press = Math.max(PRESSURE_MIN_BAR, press);
      cmp = Math.max(PRESSURE_MIN_BAR, cmp);
      readings.push({ x: p, y: Number(press.toFixed(2)) });
      comparison.push({ x: p, y: Number(cmp.toFixed(2)) });
    }
    const altMin = Math.min(...alt.map((p) => p.y));
    const altMax = Math.max(...alt.map((p) => p.y));
    return { readings, comparison, alt, altDomain: [Math.floor(altMin - 2), Math.ceil(altMax + 2)] };
  }

  // Tensão (V) ao longo do PERÍODO selecionado: uma amostra a cada ~janela/N,
  // com quedas pontuais. Segue o filtro de período de verdade.
  function buildVoltageSeries(pivotId, days) {
    const rng = makeRng(hashPivotId(pivotId) * 22695477 + 13 + days * 613);
    const nominal = 500 + Math.floor(rng() * 20);
    const end = getPeriodEnd().getTime();
    const spanMs = Math.max(1, days) * 86400000;
    const start = end - spanMs;
    const n = Math.min(48, Math.max(14, Math.round(days * (days <= 7 ? 4 : days <= 30 ? 1.5 : 0.4))));
    const dipCount = Math.max(1, Math.round(days / 15));
    const dips = new Set();
    for (let k = 0; k < dipCount; k += 1) dips.add(Math.floor(rng() * n));
    const readings = [];
    for (let i = 0; i < n; i += 1) {
      let v = nominal + Math.sin(i / 3 + rng() * 0.01) * 6 + (rng() - 0.5) * 10;
      if (dips.has(i)) v -= 60 + rng() * 40;
      const t = new Date(start + (i / (n - 1)) * spanMs);
      readings.push({ x: i, y: Number(v.toFixed(1)), t });
    }
    return { readings, nominal };
  }

  // Curva suave (Catmull-Rom -> cúbica de Bézier) a partir de pontos já em px.
  function smoothPath(pts) {
    if (pts.length < 2) return "";
    let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i += 1) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return d;
  }

  const SVG_NS = "http://www.w3.org/2000/svg";

  // Renderiza um gráfico de linha interativo num .pivo-chart-container.
  // series: [{ points:[{x,y,t?}], color, label, formatY, axis?:2, dashed? }]
  // opts: { xDomain, yDomain, y2Domain?, gridLines?, formatTooltipX }
  function renderLineChart(el, series, opts) {
    if (!el) return;
    // O SVG/hover mudam o DOM a cada frame no hover — sem isso o
    // MutationObserver do i18n re-traduz a árvore toda e trava a página.
    el.setAttribute("data-i18n-skip", "");
    const W = 1000, H = 250;
    const [x0, x1] = opts.xDomain;
    const [y0, y1] = opts.yDomain;
    const [y2a, y2b] = opts.y2Domain || opts.yDomain;
    const sx = (x) => ((x - x0) / (x1 - x0 || 1)) * W;
    const sy = (y) => H - ((y - y0) / (y1 - y0 || 1)) * H;
    const sy2 = (y) => H - ((y - y2a) / (y2b - y2a || 1)) * H;
    const scaleY = (s) => (s.axis === 2 ? sy2 : sy);

    // Limpa mock estático do HTML e qualquer render anterior (mantém só os
    // labels de eixo .x-axis-labels / .y-axis-labels).
    el.querySelectorAll(".mock-svg-lines, .mock-hover-indicator, .pivo-line-svg, .pivo-line-hover").forEach((n) => n.remove());
    // Remove os handlers de hover do render anterior (re-render no period change).
    if (el._lineHoverCleanup) el._lineHoverCleanup();

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "pivo-line-svg mock-svg-lines");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("preserveAspectRatio", "none");

    // Grid horizontal pontilhado (linhas nos mesmos níveis dos rótulos Y).
    const gridN = opts.gridLines || 5;
    for (let i = 1; i < gridN; i += 1) {
      const gy = (H / gridN) * i;
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", 0); line.setAttribute("x2", W);
      line.setAttribute("y1", gy); line.setAttribute("y2", gy);
      line.setAttribute("class", "pivo-line-grid");
      svg.appendChild(line);
    }

    series.forEach((s) => {
      const scale = scaleY(s);
      const px = s.points.map((p) => ({ x: sx(p.x), y: scale(p.y) }));
      const d = opts.smooth === false
        ? px.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
        : smoothPath(px);
      if (s.area) {
        const area = document.createElementNS(SVG_NS, "path");
        area.setAttribute("d", `${d} L${px[px.length - 1].x.toFixed(1)},${H} L${px[0].x.toFixed(1)},${H} Z`);
        area.setAttribute("fill", s.color);
        area.setAttribute("fill-opacity", s.axis === 2 ? "0.08" : "0.12");
        area.setAttribute("stroke", "none");
        svg.appendChild(area);
      }
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", s.color);
      path.setAttribute("stroke-width", s.width || 2);
      path.setAttribute("stroke-linejoin", "round");
      path.setAttribute("stroke-linecap", "round");
      if (s.dashed) path.setAttribute("stroke-dasharray", "6 5");
      path.setAttribute("vector-effect", "non-scaling-stroke");
      svg.appendChild(path);
    });
    el.appendChild(svg);

    // Títulos de eixo (Y esquerdo/direito na vertical, X embaixo).
    el.querySelectorAll(".pivo-axis-title").forEach((n) => n.remove());
    const addAxisTitle = (text, cls) => {
      if (!text) return;
      const t = document.createElement("span");
      t.className = `pivo-axis-title ${cls}`;
      t.textContent = text;
      el.appendChild(t);
    };
    addAxisTitle(opts.yTitle, "pivo-axis-title--y");
    addAxisTitle(opts.y2Title, "pivo-axis-title--y2");
    addAxisTitle(opts.xTitle, "pivo-axis-title--x");

    // Legenda: cada item é um traço (representa a linha da série no gráfico).
    if (opts.legend !== false && series.length > 1) {
      let legend = el.parentElement.querySelector(".pivo-line-legend");
      if (!legend) {
        legend = document.createElement("div");
        legend.className = "pivo-line-legend";
        legend.setAttribute("data-i18n-skip", "");
        el.insertAdjacentElement("afterend", legend);
      }
      legend.innerHTML = series
        .map((s) =>
          `<span><i class="pivo-line-legend__stroke${s.dashed ? " is-dashed" : ""}" style="--c:${s.color}"></i>${s.label}</span>`
        )
        .join("");
    }

    // Camada de hover (DOM, em % — acompanha o resize do container).
    const hover = document.createElement("div");
    hover.className = "pivo-line-hover";
    hover.hidden = true;
    hover.innerHTML =
      `<div class="pivo-line-hover__line"></div>` +
      series.map((s) => `<div class="pivo-line-hover__dot" style="--c:${s.color}"></div>`).join("") +
      `<div class="pivo-line-hover__tip"></div>`;
    el.appendChild(hover);
    const tip = hover.querySelector(".pivo-line-hover__tip");
    const dots = hover.querySelectorAll(".pivo-line-hover__dot");

    const move = (evt) => {
      const rect = el.getBoundingClientRect();
      const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
      let ratio = (clientX - rect.left) / rect.width;
      ratio = Math.max(0, Math.min(1, ratio));
      const xVal = x0 + ratio * (x1 - x0);
      hover.hidden = false;
      hover.style.left = `${ratio * 100}%`;

      const rows = series.map((s, i) => {
        // ponto mais próximo em x
        let nearest = s.points[0];
        for (const p of s.points) {
          if (Math.abs(p.x - xVal) < Math.abs(nearest.x - xVal)) nearest = p;
        }
        dots[i].style.top = `${(scaleY(s)(nearest.y) / H) * 100}%`;
        return { s, p: nearest };
      });
      const head = opts.formatTooltipX
        ? opts.formatTooltipX(rows[0].p)
        : String(Math.round(rows[0].p.x));
      tip.innerHTML =
        `<strong>${head}</strong>` +
        rows
          .map(
            (r) =>
              `<span class="pivo-line-hover__row"><i style="background:${r.s.color}"></i>${r.s.label}: <b>${
                r.s.formatY ? r.s.formatY(r.p.y) : r.p.y
              }</b></span>`
          )
          .join("");
      tip.classList.toggle("is-right", ratio > 0.62);
    };
    const leave = () => { hover.hidden = true; };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("touchmove", move, { passive: true });
    el.addEventListener("touchend", leave);
    el._lineHoverCleanup = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", leave);
    };
  }

  function setAxisLabels(el, selector, values) {
    const spans = el.querySelectorAll(`${selector} span`);
    spans.forEach((span, i) => {
      if (values[i] != null) span.textContent = values[i];
    });
  }

  // Eixo Y secundário à direita do gráfico (ex.: altitude do GPS no card
  // de Pressão). Criado uma vez e só atualizado nas re-renderizações.
  function ensureSecondaryYAxis(el, values) {
    let axis = el.querySelector(".y-axis-labels--secondary");
    if (!axis) {
      axis = document.createElement("div");
      axis.className = "y-axis-labels y-axis-labels--secondary";
      axis.innerHTML = values.map(() => "<span></span>").join("");
      el.appendChild(axis);
    }
    axis.querySelectorAll("span").forEach((span, i) => {
      if (values[i] != null) span.textContent = values[i];
    });
  }

  // Subtítulos + tooltip de lógica do card de Pressão. O período de "pressão"
  // é o intervalo do relatório; o de "comparação" são os 30 dias anteriores.
  function renderPressureMeta(pressEl, days) {
    const lang = (window.IcI18n?.getLocale?.() || "pt-BR").slice(0, 2);
    const T = {
      pt: {
        title: "Comparativo de Pressão (bar)",
        info: 'Os valores de "Pressão" são relativos ao intervalo de tempo definido pelo relatório. Os valores de "Pressão de Comparação" são relativos ao intervalo de tempo selecionado neste gráfico. Use os dados de "Pressão de Comparação" para comparar as leituras de pressão para cada ângulo irrigado entre diferentes períodos.',
        p: "Dados de pressão gerado entre", c: "Dados de comparação gerado entre", and: "e",
      },
      en: {
        title: "Pressure Comparison (bar)",
        info: '"Pressure" values relate to the time range defined by the report. "Comparison Pressure" values relate to the time range selected in this chart. Use "Comparison Pressure" data to compare pressure readings for each irrigated angle across different periods.',
        p: "Pressure data generated between", c: "Comparison data generated between", and: "and",
      },
      es: {
        title: "Comparativo de Presión (bar)",
        info: 'Los valores de "Presión" corresponden al intervalo de tiempo definido por el informe. Los valores de "Presión de Comparación" corresponden al intervalo de tiempo seleccionado en este gráfico. Use los datos de "Presión de Comparación" para comparar las lecturas de presión de cada ángulo irrigado entre diferentes períodos.',
        p: "Datos de presión generados entre", c: "Datos de comparación generados entre", and: "y",
      },
    };
    const t = T[lang] || T.pt;

    const end = getPeriodEnd();
    const span = Math.max(1, days) * 86400000;
    const fmt = (d) => {
      const day = String(d.getDate()).padStart(2, "0");
      const mon = d.toLocaleDateString(lang === "en" ? "en-US" : lang === "es" ? "es" : "pt-BR", { month: "short" }).replace(".", "");
      const M = mon.charAt(0).toUpperCase() + mon.slice(1);
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${day} ${M} ${d.getFullYear()} ${hh}:${mm}`;
    };
    const pStart = new Date(end.getTime() - span);
    const cEnd = new Date(pStart.getTime());
    const cStart = new Date(cEnd.getTime() - 30 * 86400000);

    const card = pressEl.closest(".pivo-data-card");
    if (card) {
      const titleEl = card.querySelector(".pivo-data-card__title");
      if (titleEl && titleEl.dataset.pressureTitle !== t.title) {
        titleEl.dataset.pressureTitle = t.title;
        titleEl.setAttribute("data-i18n-skip", "");
        titleEl.innerHTML = `${t.title} <button type="button" class="pivo-data-card__info" aria-label="Info"><i class="fa-solid fa-circle-info"></i><span class="pivo-data-card__info-pop">${t.info}</span></button>`;
      }
      const subsWrap = card.querySelector(".pivo-pressao__subtitles");
      if (subsWrap) subsWrap.setAttribute("data-i18n-skip", "");
      const subs = card.querySelectorAll(".pivo-pressao__subtitles span");
      if (subs[0]) subs[0].textContent = `${t.p} ${fmt(pStart)} ${t.and} ${fmt(end)}`;
      if (subs[1]) subs[1].textContent = `${t.c} ${fmt(cStart)} ${t.and} ${fmt(cEnd)}`;
    }
  }

  // Títulos de eixo por idioma (chave = texto pt).
  const AXIS_I18N = {
    en: {
      "Pressão (bar)": "Pressure (bar)", "Altitude (m)": "Altitude (m)", "Ângulo": "Angle",
      "Lâmina (mm)": "Depth (mm)", "Tensão (V)": "Voltage (V)", "Período": "Period", "Posição": "Position",
    },
    es: {
      "Pressão (bar)": "Presión (bar)", "Altitude (m)": "Altitud (m)", "Ângulo": "Ángulo",
      "Lâmina (mm)": "Lámina (mm)", "Tensão (V)": "Tensión (V)", "Período": "Período", "Posição": "Posición",
    },
  };
  // Os gráficos ficam sob data-i18n-skip (o hover reescreve o DOM a cada frame e
  // o observer travaria a página), então todo texto deles precisa ser traduzido
  // aqui na origem. Usa o dicionário central e cai na tabela local como reserva.
  function ax(ptText) {
    const hit = window.IcI18n?.t?.(ptText);
    if (hit && hit !== ptText) return hit;
    const lang = (window.IcI18n?.getLocale?.() || "pt-BR").slice(0, 2);
    return AXIS_I18N[lang]?.[ptText] || ptText;
  }

  function renderPivotLineCharts(pivotId, days) {
    const period = Number(days) || getSelectedPeriodDays();
    // ---- Pressão (× ângulo, com altitude do GPS no eixo secundário) ----
    const pressEl = document.getElementById("pivoChartPressao");
    if (pressEl) {
      const { readings, comparison, alt, altDomain } = buildPressureSeries(pivotId, period);
      // Labels do eixo = só o número inteiro (a unidade fica no título do eixo).
      setAxisLabels(pressEl, ".y-axis-labels", ["10", "8", "6", "4", "2", "0"]);
      setAxisLabels(pressEl, ".x-axis-labels", ["0", "90", "180", "270", "359"]);
      const [a0, a1] = altDomain;
      const altLabels = [];
      for (let i = 5; i >= 0; i -= 1) altLabels.push(`${Math.round(a0 + ((a1 - a0) / 5) * i)}`);
      ensureSecondaryYAxis(pressEl, altLabels);
      renderLineChart(
        pressEl,
        [
          { points: alt, color: "#cbd5e1", label: ax("Altitude do GPS"), width: 2, axis: 2, area: true, formatY: (v) => `${Math.round(v)} m` },
          { points: comparison, color: "#93c5fd", label: ax("Pressão de comparação · Última torre"), width: 2.5, formatY: (v) => `${v.toFixed(2)} bar` },
          { points: readings, color: "#2563eb", label: ax("Pressão · Última torre"), width: 2, formatY: (v) => `${v.toFixed(2)} bar` },
        ],
        { xDomain: [0, 359], yDomain: [0, 10], y2Domain: altDomain, gridLines: 5, yTitle: ax("Pressão (bar)"), y2Title: ax("Altitude (m)"), xTitle: ax("Ângulo"), formatTooltipX: (p) => `${Math.round(p.x)}º` }
      );
      renderPressureMeta(pressEl, period);
    }

    // ---- Lâmina x Ângulo ----
    const depthEl = document.getElementById("pivoChartLamina");
    if (depthEl) {
      const { readings } = buildDepthSeries(pivotId, period);
      const dys = readings.map((r) => r.y);
      // Escala justa à variação real (múltiplo de 2 mm, margem de 1 mm),
      // mesmo critério do gráfico de Tensão — a área não fica achatada
      // num canto do card.
      const dlo = Math.max(0, Math.floor((Math.min(...dys) - 1) / 2) * 2);
      const dhi = Math.ceil((Math.max(...dys) + 1) / 2) * 2;
      const yl = [];
      for (let i = 5; i >= 0; i -= 1) yl.push(`${Math.round(dlo + ((dhi - dlo) / 5) * i)}`);
      setAxisLabels(depthEl, ".y-axis-labels", yl);
      setAxisLabels(depthEl, ".x-axis-labels", ["0", "90", "180", "270", "359"]);
      renderLineChart(
        depthEl,
        [{ points: readings, color: "#3b82f6", label: ax("Lâmina"), width: 2, area: true, formatY: (v) => `${v.toFixed(2)} mm` }],
        { xDomain: [0, 359], yDomain: [dlo, dhi], gridLines: 5, yTitle: ax("Lâmina (mm)"), xTitle: ax("Ângulo"), formatTooltipX: (p) => `${Math.round(p.x)}º` }
      );
    }

    // ---- Tensão ----
    const voltEl = document.getElementById("pivoChartTensoes");
    if (voltEl) {
      const { readings } = buildVoltageSeries(pivotId, period);
      const ys = readings.map((r) => r.y);
      // Escala justa à variação real (múltiplo de 20 V, margem de 10 V).
      const lo = Math.floor((Math.min(...ys) - 10) / 20) * 20;
      const hi = Math.ceil((Math.max(...ys) + 10) / 20) * 20;
      const yl = [];
      for (let i = 6; i >= 0; i -= 1) yl.push(`${Math.round(lo + ((hi - lo) / 6) * i)}`);
      setAxisLabels(voltEl, ".y-axis-labels", yl);
      const fmtDate = (d) =>
        d.toLocaleDateString(window.IcI18n?.getLocale?.() || "pt-BR", { day: "2-digit", month: "short" }).replace(".", "") +
        " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const step = Math.floor(readings.length / 4);
      setAxisLabels(voltEl, ".x-axis-labels", [0, step, step * 2, step * 3, readings.length - 1].map((i) => fmtDate(readings[i].t)));
      renderLineChart(
        voltEl,
        [{ points: readings, color: "#60a5fa", label: ax("Tensão"), width: 2, area: true, formatY: (v) => `${v.toFixed(1)}(V)` }],
        { xDomain: [0, readings.length - 1], yDomain: [lo, hi], gridLines: 6, yTitle: ax("Tensão (V)"), xTitle: ax("Período"), formatTooltipX: (p) => fmtDate(p.t) }
      );
      const stats = voltEl.closest(".pivo-energy__bottom")?.querySelectorAll(".pivo-energy__kpi strong");
      if (stats && stats.length >= 3) {
        stats[0].textContent = `${Math.round(Math.min(...ys))} V`;
        stats[1].textContent = `${(ys.reduce((a, b) => a + b, 0) / ys.length).toFixed(1)} V`;
        stats[2].textContent = `${Math.max(...ys).toFixed(2)} V`;
      }
    }
  }

  // =========================
  // Card "Pluviometria" — uma barra por dia do período selecionado no
  // popover (mock plausível), igual ao padrão adotado no gráfico de
  // Consumo das bombas: período curto estica as barras pra preencher o
  // card, período longo (>12 dias) trava a largura e rola horizontalmente
  // (mesmas classes .bmbd-consumo-chart__*, reaproveitadas aqui).
  // =========================
  function niceScaleMax(value) {
    if (value <= 0) return 10;
    const magnitude = Math.pow(10, Math.max(0, String(Math.floor(value)).length - 1));
    return Math.ceil(value / magnitude) * magnitude;
  }

  // Topo do eixo da Pluviometria: só o próximo múltiplo de 5 acima do pico
  // (sem margem "nice" de 10/100), pra barra mais alta encostar no topo do
  // card em vez de ficar achatada na metade de baixo.
  function rainScaleMax(peak) {
    if (peak <= 0) return 10;
    const step = peak <= 20 ? 2 : peak <= 60 ? 5 : 10;
    return Math.max(step, Math.ceil(peak / step) * step);
  }

  // Hash determinístico (pivô + dia) só pra não ficar sorteando uma chuva
  // diferente a cada re-render sem o período ter mudado. Datas vizinhas
  // (16 dez, 17 dez...) diferem só no fim da string — um hash polinomial
  // simples (`h*31 + char`) sai correlacionado pra strings tão parecidas
  // e gerava sequências inteiras de dias com chuva zero. Por isso mistura
  // os bits do hash (mesma técnica mulberry32 já usada nas bombas) antes
  // de tirar o valor final, pra descorrelacionar dias consecutivos.
  function seededUnit(seedStr) {
    let h = 0;
    for (let i = 0; i < seedStr.length; i++) h = (Math.imul(31, h) + seedStr.charCodeAt(i)) >>> 0;
    let t = (h + 0x6d2b79f5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  const RAIN_MONTH_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

  function fmtDateShort(d) {
    return `${String(d.getDate()).padStart(2, "0")} ${RAIN_MONTH_ABBR[d.getMonth()]}`;
  }

  function generateRainDays(pivotId, start, end) {
    const totalDays = Math.max(1, Math.round((end - start) / 86400000) + 1);
    return Array.from({ length: totalDays }, (_, i) => {
      const date = new Date(start.getTime() + i * 86400000);
      const unit = seededUnit(`${pivotId}|${date.toISOString().slice(0, 10)}`);
      const mm = unit < 0.35 ? 0 : Math.round((unit * 50 + 2) * 10) / 10;
      return { date, mm };
    });
  }

  function renderPluviometriaChart(pivotId) {
    const yEl = document.getElementById("pivoPluvY");
    const barsEl = document.getElementById("pivoPluvBars");
    if (!barsEl) return;

    const period = window.Plv?.state?.period;
    const end = period?.end ? new Date(period.end) : new Date();
    const start = period?.start ? new Date(period.start) : new Date(end.getTime() - 29 * 86400000);

    const days = generateRainDays(pivotId, start, end);
    const maxMm = rainScaleMax(Math.max(...days.map((d) => d.mm)));

    if (yEl) {
      yEl.innerHTML = [1, 0.75, 0.5, 0.25, 0]
        .map((f) => `<span>${(maxMm * f).toFixed(maxMm % 4 === 0 ? 0 : 1)} mm</span>`)
        .join("");
    }

    // .plot só cresce até 100% do wrap por padrão — quando as barras
    // (.bars) ficam mais largas que isso (modo rolável), o fundo com as
    // linhas de grade (.grid, que segue o tamanho do próprio .plot) para
    // de acompanhar e "acaba" antes das últimas barras. Por isso o .plot
    // precisa da mesma largura de conteúdo que as barras.
    const plotEl = document.querySelector("#pivoPluviometriaChart .bmbd-consumo-chart__plot");
    const isScrollable = days.length > 12;
    if (isScrollable) {
      barsEl.style.gridTemplateColumns = `repeat(${days.length}, 40px)`;
      barsEl.style.width = "max-content";
      barsEl.style.minWidth = "100%";
      if (plotEl) {
        plotEl.style.width = "max-content";
        plotEl.style.minWidth = "100%";
      }
    } else {
      barsEl.style.gridTemplateColumns = `repeat(${days.length}, minmax(30px, 1fr))`;
      barsEl.style.width = "";
      barsEl.style.minWidth = "";
      if (plotEl) {
        plotEl.style.width = "";
        plotEl.style.minWidth = "";
      }
    }

    barsEl.innerHTML = days.map((d) => {
      const heightPct = maxMm > 0 ? (d.mm / maxMm) * 100 : 0;
      const isZero = d.mm === 0;
      const label = `${fmtDateShort(d.date)} ${d.date.getFullYear()}`;
      const color = isZero ? "#1f2937" : "#60a5fa";
      return `
        <div class="bmbd-consumo-chart__group" data-label="${label}" data-tooltip-value="${d.mm.toFixed(2)} mm" data-color="${color}" style="cursor:default;">
          <div class="bmbd-consumo-chart__columns">
            <div class="bmbd-consumo-chart__bar ${isZero ? "is-zero" : "is-rain"}" style="height:${heightPct.toFixed(2)}%;"></div>
          </div>
          <div class="bmbd-consumo-chart__label">${fmtDateShort(d.date)}</div>
        </div>`;
    }).join("");

    if (plotEl) attachSectorTooltips(plotEl, barsEl);

    if (isScrollable) {
      const wrap = document.querySelector("#pivoPluviometriaChart .bmbd-consumo-chart__plot-wrap");
      if (wrap) requestAnimationFrame(() => { wrap.scrollLeft = wrap.scrollWidth; });
    }
  }

  // =========================
  // Card "Consumo de Água" (SmartTouch/Centerstar/LineStar) — uma barra por
  // dia do período selecionado no popover de calendário, mesmo padrão do
  // gráfico de Pluviometria acima (mock plausível + seededUnit pra não
  // "piscar" valores diferentes a cada re-render sem o período mudar).
  // A escala do eixo Y é "zoom" (min = pico mais baixo arredondado pra
  // baixo), igual ao mock original, pra não achatar as barras quando os
  // valores diários variam pouco entre si.
  // =========================
  function generateWaterDays(pivotId, start, end) {
    const totalDays = Math.max(1, Math.round((end - start) / 86400000) + 1);
    return Array.from({ length: totalDays }, (_, i) => {
      const date = new Date(start.getTime() + i * 86400000);
      const unit = seededUnit(`${pivotId}|water|${date.toISOString().slice(0, 10)}`);
      const value = Math.round((100 + unit * 20) * 10) / 10; // 100.0–120.0 m³
      return { date, value, unit: "m³" };
    });
  }

  function niceWaterScale(values) {
    const step = 5;
    let min = Math.floor(Math.min(...values) / step) * step;
    let max = Math.ceil(Math.max(...values) / step) * step;
    while (max - min < step * 4) {
      max += step;
      if (max - min < step * 4) min -= step;
    }
    return { min: Math.max(0, min), max };
  }

  function fmtDateWater(d) {
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }

  // Balão do gráfico de água: mesmo componente/comportamento do balão do
  // Consumo das bombas (#bmbdConsumoTooltip) — some por padrão e só aparece
  // no hover/click de uma barra, sempre grudado em cima dela.
  let waterDaysCache = [];

  function updateWaterTooltip(day) {
    const tooltip = document.getElementById("pivoWaterTooltip");
    if (!tooltip) return;
    const dateEl = tooltip.querySelector(".bmbd-consumo-chart__tooltip-date");
    const valEl = tooltip.querySelector(".bmbd-consumo-chart__tooltip-row strong");
    if (dateEl) dateEl.textContent = fmtDateWater(day.date);
    if (valEl) valEl.textContent = `${formatNumber(day.value)} ${day.unit}`;
  }

  function showWaterTooltip(day, barGroupEl) {
    const tooltip = document.getElementById("pivoWaterTooltip");
    const plot = document.querySelector("#pivoChartWaterST .bmbd-consumo-chart__plot");
    if (!tooltip || !plot || !barGroupEl) return;
    updateWaterTooltip(day);

    const barEl = barGroupEl.querySelector(".bmbd-consumo-chart__bar") || barGroupEl;
    const plotRect = plot.getBoundingClientRect();
    const barRect = barEl.getBoundingClientRect();

    let left = barRect.left + barRect.width / 2 - plotRect.left;
    const half = (tooltip.offsetWidth || 220) / 2;
    left = Math.min(Math.max(left, half + 4), plotRect.width - half - 4);

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${barRect.top - plotRect.top - 10}px`;
    tooltip.style.transform = "translate(-50%, -100%)";
    tooltip.classList.add("is-visible");
  }

  function hideWaterTooltip() {
    document.getElementById("pivoWaterTooltip")?.classList.remove("is-visible");
  }

  function renderWaterChart(pivotId) {
    const yEl = document.getElementById("pivoWaterY");
    const barsEl = document.getElementById("pivoWaterBars");
    if (!barsEl) return;

    const period = window.Plv?.state?.period;
    const end = period?.end ? new Date(period.end) : new Date();
    const start = period?.start ? new Date(period.start) : new Date(end.getTime() - 8 * 86400000);

    const days = generateWaterDays(pivotId, start, end);
    waterDaysCache = days;
    const unit = days[0]?.unit || "m³";
    const { min, max } = niceWaterScale(days.map((d) => d.value));

    if (yEl) {
      yEl.innerHTML = [0, 1, 2, 3, 4]
        .map((i) => `<span>${Math.round(max - (i * (max - min)) / 4)} ${unit}</span>`)
        .join("");
    }

    // Período curto estica as barras pra preencher o card, período longo
    // (>12 dias) trava a largura das colunas e rola horizontalmente — mesma
    // regra do gráfico de Consumo das bombas.
    const plotEl = document.querySelector("#pivoChartWaterST .bmbd-consumo-chart__plot");
    const isScrollable = days.length > 12;
    if (isScrollable) {
      barsEl.style.gridTemplateColumns = `repeat(${days.length}, 56px)`;
      barsEl.style.width = "max-content";
      barsEl.style.minWidth = "100%";
      if (plotEl) {
        plotEl.style.width = "max-content";
        plotEl.style.minWidth = "100%";
      }
    } else {
      barsEl.style.gridTemplateColumns = `repeat(${days.length}, minmax(60px, 1fr))`;
      barsEl.style.width = "";
      barsEl.style.minWidth = "";
      if (plotEl) {
        plotEl.style.width = "";
        plotEl.style.minWidth = "";
      }
    }

    const lastIdx = days.length - 1;

    barsEl.innerHTML = days.map((d, i) => {
      const heightPct = max > min ? ((d.value - min) / (max - min)) * 100 : 0;
      const label = `<span class="bmbd-consumo-chart__bar-label">${formatNumber(d.value)}</span>`;
      return `
        <div class="bmbd-consumo-chart__group${i === lastIdx ? " is-highlight" : ""}" data-idx="${i}" style="cursor:pointer;">
          <div class="bmbd-consumo-chart__columns">
            <div class="bmbd-consumo-chart__bar is-water" style="height:${heightPct.toFixed(2)}%;">${label}</div>
          </div>
          <div class="bmbd-consumo-chart__label">${fmtDateWater(d.date)}</div>
        </div>`;
    }).join("");

    barsEl.querySelectorAll(".bmbd-consumo-chart__group").forEach((group) => {
      const idx = Number(group.dataset.idx);
      const day = waterDaysCache[idx];
      if (!day) return;

      group.addEventListener("mouseenter", () => showWaterTooltip(day, group));
      group.addEventListener("mouseleave", hideWaterTooltip);
      group.addEventListener("click", () => {
        barsEl.querySelectorAll(".bmbd-consumo-chart__group").forEach((g) => g.classList.remove("is-highlight"));
        group.classList.add("is-highlight");
        showWaterTooltip(day, group);
      });
    });

    if (isScrollable) {
      const wrap = document.querySelector("#pivoChartWaterST .bmbd-consumo-chart__plot-wrap");
      if (wrap) requestAnimationFrame(() => { wrap.scrollLeft = wrap.scrollWidth; });
    }
  }

  function renderLinearCharts(pivotId) {
    const snapshot = getPivotConsumptionSnapshot(pivotId);
    const wetHoursSegments = [
      { label: ax("Horário de Pico"), value: snapshot.wetHours.peak, color: chartColors.peak },
      { label: ax("Fora do Horário de Pico"), value: snapshot.wetHours.offPeak, color: chartColors.offPeak },
      { label: ax("Reduzido"), value: snapshot.wetHours.reduced, color: chartColors.reduced },
    ];
    const energyCostSegments = [
      { label: ax("Horário de Pico"), value: snapshot.energyCosts.peak, color: chartColors.peak },
      { label: ax("Fora do Horário de Pico"), value: snapshot.energyCosts.offPeak, color: chartColors.offPeak },
      { label: ax("Reduzido"), value: snapshot.energyCosts.reduced, color: chartColors.reduced },
    ];
    const totalEnergyCost = energyCostSegments.reduce((sum, segment) => sum + segment.value, 0);

    setMetricHtml("linestarConsumptionVolumeTotal", `${formatNumber(snapshot.volumeTotal)} m<sup>3</sup>`);
    setMetricHtml("linestarConsumptionVolumeMonth", `${formatNumber(snapshot.volumeLastMonth)} m<sup>3</sup>`);
    setMetricHtml("linestarConsumptionHoursTotal", `${formatNumber(snapshot.hoursTotal)} h`);
    setMetricHtml("linestarConsumptionHoursMonth", `${formatNumber(snapshot.hoursLastMonth)} h`);

    const consumoEl = document.getElementById("linestarChartConsumo");
    if (consumoEl) {
      consumoEl.classList.add("pivo-chart-container--pie");
      renderPie(consumoEl, wetHoursSegments, {
        r: 45,
        gapDeg: 1.0,
      });
    }

    const custosEl = document.getElementById("linestarChartCustos");
    if (custosEl) {
      renderDonut(custosEl, energyCostSegments, {
        rOuter: 46,
        rInner: 32,
        gapDeg: 1.2,
        centerTop: formatCurrency(totalEnergyCost),
        centerBottom: "Total",
      });
    }

    // ---- Pressão Atual (LineStar) ----
    const linPressEl = document.getElementById("linestarChartPressao");
    if (linPressEl) {
      const periodDays = getSelectedPeriodDays();
      const { readings, comparison, alt, altDomain } = buildLinearPressureSeries(pivotId, periodDays);
      setAxisLabels(linPressEl, ".y-axis-labels", ["10", "8", "6", "4", "2", "0"]);
      setAxisLabels(linPressEl, ".x-axis-labels", ["A (0%)", "25%", "50%", "75%", "B (100%)"]);
      const [a0, a1] = altDomain;
      const altLabels = [];
      for (let i = 5; i >= 0; i -= 1) altLabels.push(`${Math.round(a0 + ((a1 - a0) / 5) * i)}`);
      ensureSecondaryYAxis(linPressEl, altLabels);
      renderLineChart(
        linPressEl,
        [
          { points: alt, color: "#cbd5e1", label: ax("Altitude do GPS"), width: 2, axis: 2, area: true, formatY: (v) => `${Math.round(v)} m` },
          { points: comparison, color: "#93c5fd", label: ax("Pressão de comparação · Última torre"), width: 2.5, formatY: (v) => `${v.toFixed(2)} bar` },
          { points: readings, color: "#2563eb", label: ax("Pressão · Última torre"), width: 2, formatY: (v) => `${v.toFixed(2)} bar` },
        ],
        { xDomain: [0, 100], yDomain: [0, 10], y2Domain: altDomain, gridLines: 5, yTitle: ax("Pressão (bar)"), y2Title: ax("Altitude (m)"), xTitle: ax("Posição"), formatTooltipX: (p) => `${Math.round(p.x)}%` }
      );
      renderPressureMeta(linPressEl, periodDays);
    }

    // ---- Lâmina x Posição (LineStar) ----
    const linDepthEl = document.getElementById("linestarChartLamina");
    if (linDepthEl) {
      const { readings } = buildLinearDepthSeries(pivotId, getSelectedPeriodDays());
      const dys = readings.map((r) => r.y);
      const dlo = Math.max(0, Math.floor((Math.min(...dys) - 1) / 2) * 2);
      const dhi = Math.ceil((Math.max(...dys) + 1) / 2) * 2;
      const yl = [];
      for (let i = 5; i >= 0; i -= 1) yl.push(`${Math.round(dlo + ((dhi - dlo) / 5) * i)}`);
      setAxisLabels(linDepthEl, ".y-axis-labels", yl);
      setAxisLabels(linDepthEl, ".x-axis-labels", ["A (0%)", "25%", "50%", "75%", "B (100%)"]);
      renderLineChart(
        linDepthEl,
        [{ points: readings, color: "#3b82f6", label: ax("Lâmina"), width: 2, area: true, formatY: (v) => `${v.toFixed(2)} mm` }],
        { xDomain: [0, 100], yDomain: [dlo, dhi], gridLines: 5, yTitle: ax("Lâmina (mm)"), xTitle: ax("Posição"), formatTooltipX: (p) => `${Math.round(p.x)}%` }
      );
    }
  }

  chartsView.renderCharts = renderCharts;
  chartsView.renderLinearCharts = renderLinearCharts;
  chartsView.renderWaterChart = renderWaterChart;
  // Usados pelo modal "Acumulado de Irrigação | Precipitação" (view.details.js).
  chartsView.getPivotSegments = getPivotSegments;
  chartsView.getSelectedPeriod = getSelectedPeriod;
  chartsView.getIrrigationBreakdown = getIrrigationBreakdown;
  chartsView.getSegmentsBreakdown = getSegmentsBreakdown;

  // Reage ao popover de período (mesmo componente global usado na
  // Pluviometria, já reaproveitado pelo botão "Período" do pivô). Só
  // re-renderiza se a tela de detalhes do pivô estiver mesmo montada.
  document.addEventListener("pluv:periodChanged", () => {
    if (document.getElementById("pivoChartConsumo")) {
      renderCharts();
    }
    if (document.getElementById("pivoChartWaterST")) {
      renderWaterChart(state.selectedId);
    }
    if (document.getElementById("linestarChartLamina")) {
      renderLinearCharts(state.selectedId);
    }
  });

  // Troca de idioma: re-renderiza (títulos de eixo, subtítulos e tooltip
  // de lógica do card de Pressão dependem do idioma).
  window.addEventListener("ic:lang-change", () => {
    if (document.getElementById("pivoChartConsumo")) renderCharts();
    if (document.getElementById("pivoChartWaterST")) renderWaterChart(state.selectedId);
    if (document.getElementById("linestarChartLamina")) renderLinearCharts(state.selectedId);
  });
})();
