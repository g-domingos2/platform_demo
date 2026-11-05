(function () {
  "use strict";

  const Plv = (window.Plv = window.Plv || {});
  const state = (Plv.state = Plv.state || {});
  const dom = (Plv.dom = Plv.dom || {});
  const period = (Plv.period = Plv.period || {});
  const picker = (Plv.periodPicker = Plv.periodPicker || {});
  const formatDateBR = dom.formatDateBR || ((d) => {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  });

  const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  let popover = null;
  let panel = null;
  let arrow = null;
  let leftTitle = null;
  let rightTitle = null;
  let leftMonthEl = null;
  let rightMonthEl = null;
  let anchorEl = null;
  let isOpen = false;
  let baseMonth = null;
  let draftStart = null;
  let draftEnd = null;
  let previewDate = null;
  let dragActive = false;
  let dragStart = null;
  let ignoreClick = false;

  function toDateOnly(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function isSameDay(a, b) {
    return a && b &&
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  function normalizePeriod(start, end) {
    const a = toDateOnly(start);
    const b = toDateOnly(end);
    return a.getTime() <= b.getTime()
      ? { start: a, end: b }
      : { start: b, end: a };
  }

  function parseDateBR(text) {
    if (!text) return null;
    const m = String(text).match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!m) return null;
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    if (!day || !month || !year) return null;
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    return d;
  }

  function parsePeriodFromText(text) {
    if (!text) return null;
    const matches = String(text).match(/\d{2}\/\d{2}\/\d{4}/g);
    if (!matches || matches.length < 2) return null;
    const start = parseDateBR(matches[0]);
    const end = parseDateBR(matches[1]);
    if (!start || !end) return null;
    return normalizePeriod(start, end);
  }

  function getInitialPeriod() {
    // Padrão do app inteiro (Pluviometria, Pivô, Bombas etc. — todos
    // compartilham esse mesmo popover/estado global): sempre abre em
    // "Últimos 7 dias" quando a página carrega. Isso também deixa o botão
    // "Últimos 7 dias" do popover já com a classe is-active de cara
    // (updatePresetActive compara o período atual com cada preset).
    //
    // Antes disso lia ".pluv-mapbar__range-start/-end" (mock estático no
    // index.html, ex.: "26/03/2026") como se fosse um período já
    // selecionado — só que esse texto nunca muda sozinho, então o app
    // sempre "reabria" fixo nessa data velha em vez de calcular os últimos
    // 7 dias a partir de hoje. syncUI() (chamado logo depois de
    // setPeriod) já atualiza esse texto pro período real, então não
    // precisa mais ler dele aqui.
    return computePresetRange("7d");
  }

  function getPeriod() {
    if (!state.period || !state.period.start || !state.period.end) return null;
    return {
      start: toDateOnly(state.period.start),
      end: toDateOnly(state.period.end),
    };
  }

  function syncUI(start, end) {
    const periodValue = start && end ? { start, end } : getPeriod();
    if (!periodValue || !periodValue.start || !periodValue.end) return;

    const startStr = formatDateBR(periodValue.start);
    const endStr = formatDateBR(periodValue.end);

    const mapStart = document.querySelector(".pluv-mapbar__range-start");
    const mapEnd = document.querySelector(".pluv-mapbar__range-end");
    if (mapStart) mapStart.textContent = startStr;
    if (mapEnd) mapEnd.textContent = endStr;

    document.querySelectorAll(".pluv-period-trigger").forEach((el) => {
      el.textContent = `Per\u00edodo: ${startStr} \u2192 ${endStr}`;
    });

    // Cada equipamento tem seu próprio prefixo de classe pro rótulo
    // (pivo-agenda__period-label, bmbd-agenda__period-label,
    // weatherstation-agenda__period-label, ...) — em vez de listar um por
    // um aqui (e esquecer de atualizar toda vez que um equipamento novo
    // cria o seu), pega o único <span> dentro do gatilho, que é sempre o
    // rótulo (o outro filho é o ícone de calendário).
    document.querySelectorAll(".js-period-trigger span").forEach((el) => {
      el.textContent = `${startStr} - ${endStr}`;
    });
  }

  function setPeriod(start, end, source) {
    if (!start || !end) return;
    const normalized = normalizePeriod(start, end);
    state.period = { start: normalized.start, end: normalized.end };
    syncUI(normalized.start, normalized.end);

    const detail = {
      start: new Date(normalized.start),
      end: new Date(normalized.end),
      source: source || "set",
    };
    document.dispatchEvent(new CustomEvent("pluv:periodChanged", { detail }));
  }

  function ensurePopover() {
    if (popover) return;
    popover = document.createElement("div");
    popover.className = "pluv-range-popover";
    popover.hidden = true;
    popover.innerHTML = `
      <div class="pluv-range-popover__arrow"></div>
      <div class="pluv-range-popover__panel" role="dialog" aria-label="Selecionar per\u00edodo">
        <aside class="pluv-range-popover__presets">
          <button type="button" data-preset="7d">Últimos 7 dias</button>
          <button type="button" data-preset="14d">Últimos 14 dias</button>
          <button type="button" data-preset="30d">Últimos 30 dias</button>
          <button type="button" data-preset="90d">Últimos 90 dias</button>
          <button type="button" data-preset="all" hidden>Todo o período</button>
          <button type="button" data-preset="thisWeek">Esta semana</button>
          <button type="button" data-preset="lastWeek">Semana passada</button>
          <button type="button" data-preset="thisMonth">Este mês</button>
          <button type="button" data-preset="lastMonth">Mês passado</button>
          <button type="button" data-preset="thisYear">Este ano</button>
          <button type="button" data-preset="lastYear">Ano passado</button>
        </aside>
        <section class="pluv-range-popover__cal">
          <header class="pluv-range-popover__cal-head">
            <button type="button" class="nav nav--prev" aria-label="M\u00eas anterior">\u2039</button>
            <div class="month-title month-title--left">\u2014</div>
            <div class="month-title month-title--right">\u2014</div>
            <button type="button" class="nav nav--next" aria-label="Pr\u00f3ximo m\u00eas">\u203a</button>
          </header>
          <div class="pluv-range-popover__months">
            <div class="month month--left"></div>
            <div class="month month--right"></div>
          </div>
        </section>
      </div>
    `;

    document.body.appendChild(popover);
    arrow = popover.querySelector(".pluv-range-popover__arrow");
    panel = popover.querySelector(".pluv-range-popover__panel");
    leftTitle = popover.querySelector(".month-title--left");
    rightTitle = popover.querySelector(".month-title--right");
    leftMonthEl = popover.querySelector(".month--left");
    rightMonthEl = popover.querySelector(".month--right");

    panel.addEventListener("click", handlePanelClick);
    panel.addEventListener("mouseover", handlePanelHover);
    panel.addEventListener("mouseleave", handlePanelLeave);
  }

  function isoFromDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function dateFromISO(iso) {
    if (!iso) return null;
    const parts = iso.split("-");
    if (parts.length !== 3) return null;
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }

  function renderMonths(targetMonth) {
    if (!leftMonthEl || !rightMonthEl || !leftTitle || !rightTitle) return;
    const left = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
    const right = new Date(left.getFullYear(), left.getMonth() + 1, 1);

    leftTitle.textContent = `${MONTHS[left.getMonth()]} ${left.getFullYear()}`;
    rightTitle.textContent = `${MONTHS[right.getMonth()]} ${right.getFullYear()}`;

    leftMonthEl.innerHTML = renderMonthGrid(left);
    rightMonthEl.innerHTML = renderMonthGrid(right);

    updatePresetActive();
  }

  function renderMonthGrid(monthDate) {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const first = new Date(year, month, 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();

    let html = '<div class="pluv-range-popover__weekdays">';
    WEEKDAYS.forEach((d) => { html += `<span>${d}</span>`; });
    html += '</div><div class="pluv-range-popover__grid">';

    for (let i = 0; i < startDay; i++) {
      const day = daysInPrev - startDay + 1 + i;
      const d = new Date(year, month - 1, day);
      html += renderDayCell(d, true);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      html += renderDayCell(d, false);
    }

    const totalCells = startDay + daysInMonth;
    const trailing = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= trailing; i++) {
      const d = new Date(year, month + 1, i);
      html += renderDayCell(d, true);
    }

    html += "</div>";
    return html;
  }

  function renderDayCell(date, disabled) {
    const iso = isoFromDate(date);
    let cls = "pluv-range-popover__day";
    const isEdge = !disabled && (
      isSameDay(date, draftStart) ||
      isSameDay(date, draftEnd) ||
      (previewDate && !draftEnd && isSameDay(date, previewDate))
    );
    const isInRange = !disabled && draftStart && draftEnd &&
      date.getTime() > draftStart.getTime() &&
      date.getTime() < draftEnd.getTime();
    const isPreview = !disabled && draftStart && !draftEnd && previewDate &&
      date.getTime() > Math.min(draftStart.getTime(), previewDate.getTime()) &&
      date.getTime() < Math.max(draftStart.getTime(), previewDate.getTime());

    if (disabled) cls += " is-disabled";
    if (isInRange) cls += " is-inrange";
    if (isPreview) cls += " is-preview";
    if (isEdge) cls += " is-edge";

    return `<button type="button" class="${cls}" ${disabled ? "disabled" : ""} data-date="${iso}">${date.getDate()}</button>`;
  }

  // "Todo o período" não tem data fixa: depende de onde os dados da tela
  // começam e terminam. A tela informa isso no próprio gatilho
  // (data-period-all-start / data-period-all-end, yyyy-mm-dd) — ex.: a
  // tela de Detalhes do Cosmofield, com o início e o fim da série do
  // gráfico. Sem essa informação o preset não aparece.
  function allRangeOf(el) {
    const start = dateFromISO(el?.dataset?.periodAllStart);
    const end = dateFromISO(el?.dataset?.periodAllEnd);
    return start && end ? { start, end } : null;
  }

  function computePresetRange(preset) {
    if (preset === "all") return allRangeOf(anchorEl);
    const today = toDateOnly(new Date());
    if (preset === "7d" || preset === "14d" || preset === "30d" || preset === "90d") {
      const days = { "7d": 7, "14d": 14, "30d": 30, "90d": 90 }[preset];
      const start = new Date(today);
      start.setDate(today.getDate() - (days - 1));
      return { start, end: today };
    }
    if (preset === "thisWeek") {
      const start = new Date(today);
      start.setDate(today.getDate() - today.getDay());
      return { start, end: today };
    }
    if (preset === "lastWeek") {
      const end = new Date(today);
      end.setDate(today.getDate() - today.getDay() - 1);
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      return { start, end };
    }
    if (preset === "thisMonth") {
      return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today };
    }
    if (preset === "lastMonth") {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start, end };
    }
    if (preset === "thisYear") {
      return { start: new Date(today.getFullYear(), 0, 1), end: today };
    }
    if (preset === "lastYear") {
      return { start: new Date(today.getFullYear() - 1, 0, 1), end: new Date(today.getFullYear() - 1, 11, 31) };
    }
    return null;
  }

  function updatePresetActive() {
    const buttons = popover?.querySelectorAll("[data-preset]");
    if (!buttons || buttons.length === 0) return;
    buttons.forEach((btn) => btn.classList.remove("is-active"));

    const current = getPeriod();
    if (!current) return;

    buttons.forEach((btn) => {
      const range = computePresetRange(btn.getAttribute("data-preset") || "");
      if (range && isSameDay(range.start, current.start) && isSameDay(range.end, current.end)) {
        btn.classList.add("is-active");
      }
    });
  }

  function openAt(triggerEl, source) {
    ensurePopover();
    if (!popover || !panel) return;

    anchorEl = triggerEl;
    // A tela pode limitar os presets do popover com data-period-presets
    // (lista separada por vírgula, ex.: "7d,14d,30d,90d,all" no Cosmofield).
    // Sem o atributo, aparecem todos, como sempre. "Todo o período" ainda
    // depende do intervalo dos dados (allRangeOf).
    const allowed = String(triggerEl?.dataset?.periodPresets || "")
      .split(",").map((key) => key.trim()).filter(Boolean);
    popover.querySelectorAll("[data-preset]").forEach((btn) => {
      const key = btn.getAttribute("data-preset");
      const listed = !allowed.length || allowed.includes(key);
      btn.hidden = !listed || (key === "all" && !allRangeOf(triggerEl));
    });
    const current = getPeriod();
    draftStart = current?.start ? toDateOnly(current.start) : null;
    draftEnd = current?.end ? toDateOnly(current.end) : null;
    previewDate = null;

    const base = draftStart || new Date();
    baseMonth = new Date(base.getFullYear(), base.getMonth(), 1);
    renderMonths(baseMonth);

    popover.hidden = false;
    popover.style.visibility = "hidden";
    positionPopover();
    popover.style.visibility = "visible";
    isOpen = true;

    popover.dataset.source = source || "";
  }

  function closePopover() {
    if (!popover) return;
    popover.hidden = true;
    popover.removeAttribute("data-placement");
    popover.style.removeProperty("--arrow-left");
    popover.style.removeProperty("top");
    popover.style.removeProperty("left");
    popover.style.visibility = "";
    isOpen = false;
    anchorEl = null;
    previewDate = null;
  }

  function positionPopover() {
    if (!popover || !panel || !anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const panelWidth = panelRect.width || panel.offsetWidth;
    const panelHeight = panelRect.height || panel.offsetHeight;
    const offset = 8;
    const safe = 8;

    let top = rect.bottom + offset;
    let placement = "bottom";
    if (top + panelHeight > window.innerHeight - safe) {
      top = rect.top - offset - panelHeight;
      placement = "top";
    }
    let left = rect.left;
    if (left + panelWidth > window.innerWidth - safe) {
      left = window.innerWidth - panelWidth - safe;
    }
    if (left < safe) left = safe;

    popover.style.top = `${Math.max(safe, top)}px`;
    popover.style.left = `${left}px`;
    popover.dataset.placement = placement;

    const arrowLeft = rect.left + rect.width / 2 - left;
    const clamped = Math.min(Math.max(arrowLeft, 16), panelWidth - 16);
    popover.style.setProperty("--arrow-left", `${clamped}px`);
  }

  function handlePanelClick(e) {
    if (ignoreClick) {
      const maybeDay = e.target.closest(".pluv-range-popover__day");
      if (maybeDay) {
        ignoreClick = false;
        return;
      }
      ignoreClick = false;
    }
    const presetBtn = e.target.closest("[data-preset]");
    if (presetBtn) {
      applyPreset(presetBtn.getAttribute("data-preset") || "");
      return;
    }
    const prev = e.target.closest(".nav--prev");
    if (prev) {
      baseMonth = new Date(baseMonth.getFullYear(), baseMonth.getMonth() - 1, 1);
      renderMonths(baseMonth);
      return;
    }
    const next = e.target.closest(".nav--next");
    if (next) {
      baseMonth = new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 1, 1);
      renderMonths(baseMonth);
      return;
    }
    const dayBtn = e.target.closest(".pluv-range-popover__day");
    if (dayBtn && !dayBtn.classList.contains("is-disabled")) {
      const date = dateFromISO(dayBtn.getAttribute("data-date"));
      if (date) handleDaySelection(date);
    }
  }

  function handlePanelMouseDown(e) {
    const dayBtn = e.target.closest(".pluv-range-popover__day");
    if (!dayBtn || dayBtn.classList.contains("is-disabled")) return;
    if (e.button !== 0) return;
    const date = dateFromISO(dayBtn.getAttribute("data-date"));
    if (!date) return;
    e.preventDefault();
    dragActive = true;
    dragStart = toDateOnly(date);
    draftStart = dragStart;
    draftEnd = null;
    previewDate = dragStart;
    renderMonths(baseMonth);
  }

  function handlePanelHover(e) {
    const dayBtn = e.target.closest(".pluv-range-popover__day");
    if (!dayBtn || dayBtn.classList.contains("is-disabled")) return;
    if (!draftStart || draftEnd) return;
    const date = dateFromISO(dayBtn.getAttribute("data-date"));
    if (!date) return;
    previewDate = date;
    renderMonths(baseMonth);
  }

  function handlePanelLeave() {
    if (dragActive) return;
    if (!draftStart || draftEnd) return;
    previewDate = null;
    renderMonths(baseMonth);
  }

  function handleGlobalMouseUp(e) {
    if (!dragActive) return;
    dragActive = false;
    const dayBtn = e.target.closest?.(".pluv-range-popover__day");
    const date = dayBtn && !dayBtn.classList.contains("is-disabled")
      ? dateFromISO(dayBtn.getAttribute("data-date"))
      : previewDate;
    const finalDate = date ? toDateOnly(date) : dragStart;
    if (dragStart && finalDate) {
      const normalized = normalizePeriod(dragStart, finalDate);
      setPeriod(normalized.start, normalized.end, "drag");
      closePopover();
    }
    dragStart = null;
    previewDate = null;
    ignoreClick = true;
  }

  function handleDaySelection(date) {
    if (!draftStart || (draftStart && draftEnd)) {
      draftStart = toDateOnly(date);
      draftEnd = null;
      previewDate = null;
      renderMonths(baseMonth);
      return;
    }
    if (date.getTime() < draftStart.getTime()) {
      draftEnd = draftStart;
      draftStart = toDateOnly(date);
    } else {
      draftEnd = toDateOnly(date);
    }
    setPeriod(draftStart, draftEnd, "picker");
    closePopover();
  }

  function applyPreset(preset) {
    const range = computePresetRange(preset);
    if (!range) return;
    setPeriod(range.start, range.end, "preset");
    closePopover();
  }

  function getTriggerInfo(target) {
    const genericTrigger = target.closest(".js-period-trigger");
    if (genericTrigger) return { el: genericTrigger, source: "generic" };

    const mapbar = target.closest(".pluv-mapbar__range");
    if (mapbar) return { el: mapbar, source: "mapbar" };
    const rainLabel = target.closest(".rain__period-label");
    if (rainLabel) return { el: rainLabel, source: "rain" };
    const reportLabel = target.closest(".pluv-reports__filter-label");
    if (reportLabel) return { el: reportLabel, source: "reports" };
    const reportBtn = target.closest(".pluv-reports__btn--filter");
    if (reportBtn) return { el: reportBtn, source: "reports" };
    const rainBtn = target.closest(".rain__period-btn");
    if (rainBtn) return { el: rainBtn, source: "rain" };
    return null;
  }

  function bindGlobalHandlers() {
    if (state.periodPickerBound) return;
    state.periodPickerBound = true;

    document.addEventListener("click", (e) => {
      const trigger = getTriggerInfo(e.target);
      if (trigger) {
        e.preventDefault();
        if (isOpen && anchorEl === trigger.el) {
          closePopover();
        } else {
          openAt(trigger.el, trigger.source);
        }
        return;
      }
      if (!isOpen) return;
      if (panel && panel.contains(e.target)) return;
      closePopover();
    });

    document.addEventListener("mouseup", handleGlobalMouseUp);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        closePopover();
        return;
      }
      if ((e.key === "Enter" || e.key === " ") && e.target?.classList?.contains("pluv-period-trigger")) {
        e.preventDefault();
        const trigger = getTriggerInfo(e.target);
        if (trigger) openAt(trigger.el, trigger.source);
      }
    });

    window.addEventListener("resize", () => {
      if (isOpen) positionPopover();
    });
    window.addEventListener("scroll", () => {
      if (isOpen) positionPopover();
    }, true);
  }

  function initPeriodPicker({ getPeriod: getFn, setPeriod: setFn } = {}) {
    if (getFn) period.getPeriod = getFn;
    if (setFn) period.setPeriod = setFn;
    period.getPeriod = period.getPeriod || getPeriod;
    period.setPeriod = period.setPeriod || setPeriod;
    period.syncUI = period.syncUI || syncUI;

    if (!state.period || !state.period.start || !state.period.end) {
      const initial = getInitialPeriod();
      period.setPeriod(initial.start, initial.end, "init");
    } else {
      syncUI(state.period.start, state.period.end);
    }

    ensurePopover();
    if (!state.periodPickerPanelBound && panel) {
      panel.addEventListener("mousedown", handlePanelMouseDown);
      state.periodPickerPanelBound = true;
    }
    bindGlobalHandlers();
  }

  picker.initPeriodPicker = initPeriodPicker;
  period.getPeriod = period.getPeriod || getPeriod;
  period.setPeriod = period.setPeriod || setPeriod;
  period.syncUI = period.syncUI || syncUI;
  // Exposto pra outras telas (ex.: pivô) conseguirem identificar se o
  // período atual bate com um dos presets do popover, sem duplicar a lógica.
  period.computePresetRange = period.computePresetRange || computePresetRange;
})();
