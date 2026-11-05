// assets/js/pages/pluviometria/feature.rain.js
(function () {
  "use strict";

  const Plv = (window.Plv = window.Plv || {});
  const state = (Plv.state = Plv.state || {});
  const data = (Plv.data = Plv.data || {});
  const dom = (Plv.dom = Plv.dom || {});
  const rain = (Plv.rain = Plv.rain || {});
  const $ = dom.$ || ((id) => document.getElementById(id));
  // seededRandom compartilhado — ver assets/js/core/equip-utils.js
  const { seededRandom } = window.IcEquipUtils;
  const formatDateBR = dom.formatDateBR || ((d) => {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  });
  const MONTHS_LONG = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const WEEKDAYS_LONG = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

  function setRainChips() {
    const scope = $("rainScopeChip");
    const dateChip = $("rainDateChip");
    const note = $("rainPeriodNote");
    if (!scope || !dateChip) return;

    const period = Plv.period?.getPeriod?.() || state.period || null;
    const selCount = state.selected.size;
    scope.textContent = selCount === 0 ? "Todos os pluviômetros" : `${selCount} selecionado(s)`;

    const now = new Date();
    let rangeStart = null;
    let rangeEnd = null;

    if (period && period.start && period.end) {
      dateChip.textContent = `Período: ${formatDateBR(period.start)} → ${formatDateBR(period.end)}`;
      rangeStart = period.start;
      rangeEnd = period.end;
    } else {
      dateChip.textContent =
        state.rainPeriod === "24h" ? "Período: últimas 24h" :
        state.rainPeriod === "7d"  ? "Período: últimos 7 dias" :
        state.rainPeriod === "14d" ? "Período: últimos 14 dias" :
        state.rainPeriod === "30d" ? "Período: últimos 30 dias" :
                                "Período: este mês";

      if (state.rainPeriod === "24h") {
        rangeEnd = now;
        rangeStart = new Date(now);
        rangeStart.setDate(now.getDate() - 1);
      } else if (state.rainPeriod === "7d") {
        rangeEnd = now;
        rangeStart = new Date(now);
        rangeStart.setDate(now.getDate() - 6);
      } else if (state.rainPeriod === "14d") {
        rangeEnd = now;
        rangeStart = new Date(now);
        rangeStart.setDate(now.getDate() - 13);
      } else if (state.rainPeriod === "30d") {
        rangeEnd = now;
        rangeStart = new Date(now);
        rangeStart.setDate(now.getDate() - 29);
      } else {
        rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
        rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      }
    }

    if (note && rangeStart && rangeEnd) {
      note.textContent = `Informações referentes ao período de ${formatDateBR(rangeStart)} a ${formatDateBR(rangeEnd)}.`;
    }
  }

  function daysInCurrentMonth() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  }

  function dateOnly(value) {
    if (!value) return null;
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  function periodDays(period) {
    if (!period || !period.start || !period.end) return null;
    const start = dateOnly(period.start);
    const end = dateOnly(period.end);
    if (!start || !end) return null;
    const diff = Math.round((end - start) / 86400000);
    return diff >= 0 ? diff + 1 : null;
  }

  function getSeries(period) {
    const len = period === "24h"
      ? 24
      : period === "7d"
        ? 7
        : period === "14d"
          ? 14
          : period === "30d"
            ? 30
            : daysInCurrentMonth();
    const base = (Plv.cards?.selectedList?.() || data.PLUVIOS || []).length || (data.PLUVIOS || []).length;
    const seed = period.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) + (base * 97);
    const rand = seededRandom(seed);

    const arr = new Array(len).fill(0);
    const factor = Math.min(1.6, 0.85 + base * 0.12);
    const maxVal = period === "24h" ? 14 : 16;
    const eventCount = period === "24h"
      ? 1 + Math.floor(rand() * 3)
      : period === "7d"
        ? 1 + Math.floor(rand() * 2)
        : period === "14d"
          ? 2 + Math.floor(rand() * 3)
          : period === "30d"
            ? 3 + Math.floor(rand() * 4)
            : 3 + Math.floor(rand() * 4);

    const drizzleChance = period === "24h"
      ? 0.08
      : period === "7d"
        ? 0.12
        : period === "14d"
          ? 0.14
          : period === "30d"
            ? 0.18
            : 0.18;
    const maxLen = period === "24h"
      ? 4
      : period === "7d"
        ? 2
        : period === "14d"
          ? 3
          : period === "30d"
            ? 4
            : 3;

    function addEvent(start, length, peak) {
      for (let j = 0; j < length; j++) {
        const idx = Math.min(len - 1, start + j);
        const t = length === 1 ? 0.5 : j / (length - 1);
        const shape = 0.6 + 0.8 * (1 - Math.abs(t - 0.5) * 2);
        const variance = 0.7 + rand() * 0.6;
        arr[idx] += peak * shape * variance;
      }
    }

    for (let e = 0; e < eventCount; e++) {
      const length = 1 + Math.floor(rand() * maxLen);
      const start = Math.floor(rand() * Math.max(1, len - length));
      const heavy = rand() < 0.2;
      const peakBase = heavy ? (8 + rand() * 6) : (2 + rand() * 4);
      addEvent(start, length, peakBase);
    }

    for (let i = 0; i < len; i++) {
      if (rand() < drizzleChance) {
        arr[i] = Math.max(arr[i], 0.3 + rand() * 1.4);
      }
    }

    return arr.map((v) => {
      const scaled = Math.min(maxVal, Math.max(0, v * factor));
      return Math.round(scaled * 10) / 10;
    });
  }

  function renderRainChart() {
    const barsHost = $("rainBars");
    const xHost = $("rainXAxis");
    const totalEl = $("rainTotal");
    if (!barsHost || !xHost || !totalEl) return;

    const period = getPeriod();
    const days = periodDays(period);
    const periodKey = days
      ? (days <= 1 ? "24h" : days <= 7 ? "7d" : days <= 14 ? "14d" : "30d")
      : state.rainPeriod;
    let series = getSeries(periodKey);
    const seriesMax = Math.max(0, ...series);
    if (seriesMax > 0) {
      const targetMax =
        seriesMax < 8 ? 8 :
        seriesMax < 12 ? 12 :
        16;
      const scale = targetMax / seriesMax;
      series = series.map((v) => {
        const scaled = Math.min(16, Math.max(0, v * scale));
        return Math.round(scaled * 10) / 10;
      });
    }
    const maxAxis = 16;
    const total = series.reduce((a, b) => a + b, 0);

    totalEl.textContent = total.toFixed(1);

    const styles = getComputedStyle(barsHost);
    const padTop = parseFloat(styles.paddingTop) || 0;
    const padBottom = parseFloat(styles.paddingBottom) || 0;
    const plotHeight = Math.max(0, barsHost.clientHeight - padTop - padBottom) || 180;

    barsHost.innerHTML = series.map((v) => {
      const clamped = Math.min(Math.max(v, 0), maxAxis);
      const h = Math.round((clamped / maxAxis) * plotHeight);
      return `<div class="rain-bar" style="height:${Math.max(2, h)}px" title="${v.toFixed(1)} mm"></div>`;
    }).join("");

    let labels = [];
    if (periodKey === "24h") {
      labels = series.map((_, i) => `${String(i).padStart(2, "0")}h`);
    } else if (periodKey === "7d" && (!period || !period.start || !period.end)) {
      labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    } else {
      const len = series.length;
      const start = period?.start ? dateOnly(period.start) : null;
      labels = Array.from({ length: len }, (_, i) => {
        if (start) {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          return String(d.getDate()).padStart(2, "0");
        }
        return String(i + 1);
      });
    }

    xHost.innerHTML = labels.map((t) => `<div>${t}</div>`).join("");

    updateKpis({ series24h: periodKey === "24h" ? series : null });
    setRainChips();

    const monthlyPanel = $("rainMonthlyPanel");
    if (monthlyPanel && !monthlyPanel.classList.contains("is-hidden")) {
      renderMonthlyCalendar();
    }
  }

  function seededValue(seed, min, max) {
    const rand = seededRandom(seed);
    const val = min + (max - min) * rand();
    return Math.round(val * 10) / 10;
  }

  function selectionSeed() {
    const list = Plv.cards?.selectedList?.() || [];
    if (!list.length) return 0;
    return list.reduce((acc, item, idx) => {
      const str = String(item.id || item.nome || idx);
      let h = 0;
      for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
      return acc + h;
    }, 0);
  }

  function updateKpis({ series24h } = {}) {
    const totalEl = $("rainTotal");
    const todayEl = $("rainToday");
    const monthEl = $("rainMonthTotal");
    const yearEl = $("rainYearTotal");

    const period = getPeriod();
    const baseDate = state.rainCalMonth || period?.start || new Date();
    const baseYear = baseDate.getFullYear();
    const baseMonth = baseDate.getMonth();
    const baseDay = baseDate.getDate();
    const selSeed = selectionSeed();

    const last24hSeries = series24h || getSeries("24h");
    const last24h = last24hSeries.reduce((a, b) => a + b, 0);
    if (totalEl) totalEl.textContent = (last24h + (selSeed % 7) * 0.3).toFixed(1);

    const todaySeed = baseYear * 10000 + (baseMonth + 1) * 100 + baseDay + selSeed;
    const monthSeed = baseYear * 100 + (baseMonth + 1) + (selSeed % 97);
    const yearSeed = baseYear + (selSeed % 19);
    const todayVal = seededValue(todaySeed, 0, 16);
    const monthVal = seededValue(monthSeed, 20, 240);
    const yearVal = seededValue(yearSeed, 200, 1400);

    if (todayEl) todayEl.textContent = todayVal.toFixed(1);
    if (monthEl) monthEl.textContent = monthVal.toFixed(1);
    if (yearEl) yearEl.textContent = yearVal.toFixed(1);
  }

  function getPeriod() {
    return Plv.period?.getPeriod?.() || state.period || null;
  }

  function syncCalendarMonthFromPeriod() {
    const period = getPeriod();
    const base = period?.start ? new Date(period.start) : new Date();
    state.rainCalMonth = new Date(base.getFullYear(), base.getMonth(), 1);
  }

  function formatMonthLabel(date) {
    return `${MONTHS_LONG[date.getMonth()]} ${date.getFullYear()}`;
  }

  function seededMonthData(year, month, seedBoost) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const base = (Plv.cards?.selectedList?.() || data.PLUVIOS || []).length || (data.PLUVIOS || []).length;
    const seed = (year * 100 + month + 1) * 37 + base * 97 + (seedBoost || 0);
    const rand = seededRandom(seed);
    const values = [];
    for (let d = 1; d <= daysInMonth; d++) {
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

  function escapeAttr(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "&#10;");
  }

  function buildTooltip(date, mm) {
    const dayName = WEEKDAYS_LONG[date.getDay()];
    const monthName = MONTHS_LONG[date.getMonth()];
    const dateText = `${dayName}, ${date.getDate()} de ${monthName} de ${date.getFullYear()}`;
    const rainText = mm > 0 ? `${mm.toFixed(1)} mm` : "Sem precipitação";
    return `${dateText}\n${rainText}`;
  }

  function renderMonthlyCalendar() {
    const panel = $("rainMonthlyPanel");
    const grid = $("rainCalGrid");
    const monthLabel = $("rainCalMonthLabel");
    if (!panel || !grid || !monthLabel) return;

    if (!state.rainCalMonth) syncCalendarMonthFromPeriod();
    const base = state.rainCalMonth || new Date();
    const year = base.getFullYear();
    const month = base.getMonth();

    monthLabel.textContent = formatMonthLabel(base);

    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();
    const values = seededMonthData(year, month, selectionSeed());

    const period = getPeriod();
    const selectedDate = period && period.start && period.end && formatDateBR(period.start) === formatDateBR(period.end)
      ? new Date(period.start)
      : null;

    let html = "";
    for (let i = 0; i < startWeekday; i++) {
      const day = daysInPrev - startWeekday + 1 + i;
      html += `
        <button class="rain-cal__cell is-muted" type="button" disabled>
          <span class="rain-cal__day">${day}</span>
        </button>
      `;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const mm = values[day - 1] || 0;
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      let cls = "rain-cal__cell";
      if (mm > 0 && mm < 5) cls += " is-rain-weak";
      if (mm >= 5 && mm <= 15) cls += " is-rain-mid";
      if (mm > 15) cls += " is-rain-strong";
      if (selectedDate && date.getFullYear() === selectedDate.getFullYear() &&
        date.getMonth() === selectedDate.getMonth() &&
        date.getDate() === selectedDate.getDate()) {
        cls += " is-selected";
      }
      const tooltip = escapeAttr(buildTooltip(date, mm));
      html += `
        <button class="${cls}" type="button" data-date="${iso}" data-tooltip="${tooltip}">
          <span class="rain-cal__day">${day}</span>
          ${mm > 0 ? `<span class="rain-cal__icon"><i class="fa-solid fa-cloud-rain"></i></span>` : ""}
          ${mm > 0 ? `<span class="rain-cal__mm">${mm.toFixed(1)} mm</span>` : ""}
        </button>
      `;
    }

    const totalCells = startWeekday + daysInMonth;
    const trailing = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= trailing; i++) {
      html += `
        <button class="rain-cal__cell is-muted" type="button" disabled>
          <span class="rain-cal__day">${i}</span>
        </button>
      `;
    }

    grid.innerHTML = html;
    updateKpis();
  }

  function bindRainUI() {
    const wasBound = state.rainBound;
    if (!state.rainBound) {
      state.rainBound = true;
    }

    const chartView = $("rainChartView");
    const monthlyPanel = $("rainMonthlyPanel");
    const btnMonthly = $("rainBtnMonthlyView");
    const btnBack = $("rainBtnChartView");

    const showCalendar = () => {
      if (!chartView || !monthlyPanel) return;
      chartView.classList.add("is-hidden");
      monthlyPanel.classList.remove("is-hidden");
      syncCalendarMonthFromPeriod();
      renderMonthlyCalendar();
    };

    const showChart = () => {
      if (!chartView || !monthlyPanel) return;
      chartView.classList.remove("is-hidden");
      monthlyPanel.classList.add("is-hidden");
    };

    if (btnMonthly && !btnMonthly.dataset.bound) {
      btnMonthly.dataset.bound = "1";
      btnMonthly.addEventListener("click", (event) => {
        event.preventDefault();
        if (monthlyPanel && !monthlyPanel.classList.contains("is-hidden")) {
          showChart();
        } else {
          showCalendar();
        }
      });
    }
    if (btnBack && !btnBack.dataset.bound) {
      btnBack.dataset.bound = "1";
      btnBack.addEventListener("click", (event) => {
        event.preventDefault();
        showChart();
      });
    }

    if (monthlyPanel && !monthlyPanel.dataset.bound) {
      monthlyPanel.dataset.bound = "1";
      monthlyPanel.addEventListener("click", (event) => {
        const nav = event.target.closest("[data-rain-cal-nav]");
        if (nav) {
          const dir = Number(nav.getAttribute("data-rain-cal-nav") || "0");
          if (!state.rainCalMonth) syncCalendarMonthFromPeriod();
          const base = state.rainCalMonth || new Date();
          state.rainCalMonth = new Date(base.getFullYear(), base.getMonth() + dir, 1);
          renderMonthlyCalendar();
          return;
        }

        const cell = event.target.closest(".rain-cal__cell");
        if (cell && !cell.classList.contains("is-muted")) {
          const iso = cell.getAttribute("data-date");
          if (!iso) return;
          const [yy, mm, dd] = iso.split("-").map(Number);
          if (!yy || !mm || !dd) return;
          const date = new Date(yy, mm - 1, dd);
          Plv.period?.setPeriod?.(date, date, "calendar");
          renderMonthlyCalendar();
        }
      });
    }

    if (!wasBound) {
      document.addEventListener("pluv:periodChanged", () => {
        syncCalendarMonthFromPeriod();
        renderRainChart();
        updateKpis();
        if (monthlyPanel && !monthlyPanel.classList.contains("is-hidden")) {
          renderMonthlyCalendar();
        }
      });
    }
  }

  rain.renderRainChart = renderRainChart;
  rain.bindRainUI = bindRainUI;
})();
