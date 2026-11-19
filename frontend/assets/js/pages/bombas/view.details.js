// assets/js/pages/bombas/view.details.js
(function () {
  "use strict";
  const tBmb = (text) => window.IcI18n?.t?.(text) ?? text;

  const Bmb = (window.Bmb = window.Bmb || {});
  const state = (Bmb.state = Bmb.state || {});
  const views = (Bmb.views = Bmb.views || {});
  const detailsView = (views.details = views.details || {});
  const $ = (id) => document.getElementById(id);

  let minimapInstance = null;
  let minimapMarker = null;
  let detailsEventsBound = false;
  let onDocClickDetails = null;

  function isDetailsOpen() {
    return document.body.classList.contains("is-bmbd") &&
      !!document.getElementById("bmbdPanel");
  }

  // getActiveFarmSafe/getFarmEquipmentsSafe/normalizeEquipmentText/
  // isWeatherStationEquipment compartilhados \u2014 ver assets/js/core/farm-utils.js
  const { getActiveFarmSafe, getFarmEquipmentsSafe, normalizeEquipmentText, isWeatherStationEquipment } = window.IcFarm;

  function getBombasList() {
    const farm = getActiveFarmSafe();
    const list = getFarmEquipmentsSafe(farm);
    return list.filter((e) => {
      const type = String(e?.type || "").toLowerCase();
      const cat = String(e?.category || "").toLowerCase();
      return type === "irripump" || cat === "bombas";
    });
  }

  function getFocusBmb() {
    const list = getBombasList();
    if (!list.length) return null;
    if (state.detailsFocusId) {
      return list.find((m) => String(m.id) === String(state.detailsFocusId)) || list[0];
    }
    return list[0];
  }

  // toNumber/parseLatLngText/hashStr/seededRandom compartilhados â€” ver
  // assets/js/core/equip-utils.js
  const { toNumber, parseLatLngText, hashStr, seededRandom } = window.IcEquipUtils;

  function normalizeBmb(equip) {
    const data = equip?.data || {};
    const name = equip?.name || data.nome || data.serial || "Bmb";
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
    let trend = { label: "EstÃ¡vel", dir: "flat" };
    if (trendRaw.includes("sub")) trend = { label: "Subindo", dir: "up" };
    else if (trendRaw.includes("cai") || trendRaw.includes("down")) trend = { label: "Caindo", dir: "down" };
    else {
      const pick = seed % 3;
      trend = pick === 0 ? { label: "Subindo", dir: "up" } : pick === 1 ? { label: "Caindo", dir: "down" } : { label: "EstÃ¡vel", dir: "flat" };
    }

    const statusRaw = String(data.status || "");
    const offline = data.semComunicacao === true || statusRaw.toLowerCase() === "offline";
    const running = window.IcResolveBombaRunning ? window.IcResolveBombaRunning(equip) : false;

    const updated = data.updated || equip?.updatedAt || equip?.createdAt || "";

    const hoursBase = 15 + rand() * 10;
    const energyBase = 1000 + rand() * 500;
    const tempBase = 48 + rand() * 8;
    const vibBase = 2.0 + rand() * 1.5;

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
      running,
      updated,
      hours: hoursBase,
      energy: energyBase,
      temp: tempBase,
      vibration: vibBase,
      pressure: 3.5 + rand() * 1.5,
      flow: 150 + rand() * 60
    };
  }

  // formatLastUpdate compartilhado â€” ver assets/js/core/equip-utils.js
  const { formatLastUpdate } = window.IcEquipUtils;

  // =========================
  // GrÃ¡fico de Consumo â€” dados aleatÃ³rios (porÃ©m plausÃ­veis), gerados a
  // partir do mesmo popover de perÃ­odo (calendÃ¡rio duplo + presets) usado
  // no pivÃ´ e compartilhado com a Pluviometria (feature.periodPicker.js).
  // Um padrÃ£o sÃ³ de seletor de perÃ­odo pro app inteiro, em vez de um
  // widget exclusivo por tela. Ã‰ mock â€” os mesmos dados servem pra
  // qualquer bomba, nÃ£o vem de backend. Uma barra por dia do perÃ­odo
  // selecionado; perÃ­odo curto estica as barras, perÃ­odo longo (>12
  // dias) trava a largura e rola horizontalmente (dias sem consumo
  // entram como barra zerada, is-zero). Trocar o perÃ­odo regera tudo
  // (barras, eixo, KPIs e o donut de Custos em Energia). O balÃ£o some
  // por padrÃ£o e sÃ³ aparece no hover (ou clique/tap) em cima da barra,
  // sem posiÃ§Ã£o fixa.
  // =========================
  const consumoState = { days: [] };

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function fmtDateBR(d) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${d.getFullYear()}`;
  }

  function niceScaleMax(value) {
    if (value <= 0) return 100;
    const magnitude = Math.pow(10, Math.max(0, String(Math.floor(value)).length - 2));
    return Math.ceil(value / magnitude) * magnitude;
  }

  // Limite de consumo exibido no grÃ¡fico: sempre aparece (bomba normal e
  // GH), usando o valor prÃ³prio salvo no editar quando for um nÃºmero
  // positivo vÃ¡lido, senÃ£o cai no padrÃ£o 5.500,00 m³ â€” nÃ£o depende do
  // checkbox "Habilitar limite" (dados de mock antigos podem ter esse
  // flag desligado sem nunca ter passado pelo editar de verdade). A linha
  // marca o valor literal, nÃ£o dividido pelos dias do perÃ­odo, senÃ£o
  // ficaria baixo demais pra aparecer perto das barras diÃ¡rias (~3.000-
  // 6.000 m³).
  function getConsumoDailyLimit() {
    const equip = getFocusBmb();
    const saved = Number(equip?.data?.consumptionLimit);
    // Sem limite cadastrado: referÃªncia de ~12 h/dia na vazÃ£o da bomba
    // (mesma vazÃ£o usada no histÃ³rico), pra linha ficar na escala das barras.
    const flow = window.IcDemoHistory && equip ? window.IcDemoHistory.pump.current(equip)?.flow : 0;
    const limit = saved > 0 ? saved : (flow > 0 ? Math.round((flow * 12) / 100) * 100 : 5500);
    return { limit };
  }

  function fmtM3(n) {
    return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Uma barra por dia do intervalo [start, end]. Dias em que a bomba nÃ£o
  // ligou entram como barra zerada (is-zero), assim dÃ¡ pra ver de cara
  // quais dias tiveram consumo â€” mesmo padrÃ£o do modo "MÃªs" de antes,
  // sÃ³ que agora vale pra qualquer perÃ­odo escolhido no popover.
  function generateConsumoData(start, end) {
    const equip = getFocusBmb();
    if (window.IcDemoHistory && equip) {
      return window.IcDemoHistory.pump.daily(equip, start, end).map((d) => ({
        label: fmtDateBR(d.date),
        total: Math.round(d.value * 100) / 100,
      }));
    }
    const totalDays = Math.max(1, Math.round((end - start) / 86400000) + 1);
    return Array.from({ length: totalDays }, (_, i) => {
      const d = new Date(start.getTime() + i * 86400000);
      const wasOn = Math.random() < 0.85; // mock: dias em que a bomba esteve ligada
      return { label: fmtDateBR(d), total: wasOn ? randInt(3000, 6000) : 0 };
    });
  }

  function updateConsumoTooltip(day) {
    const tooltip = $("bmbdConsumoTooltip");
    if (!tooltip) return;
    const dateEl = tooltip.querySelector(".bmbd-consumo-chart__tooltip-date");
    const valEl = tooltip.querySelector(".bmbd-consumo-chart__tooltip-row strong");
    if (dateEl) dateEl.textContent = day.label;
    if (valEl) valEl.textContent = `${fmtM3(day.total)} m³`;
  }

  // BalÃ£o do grÃ¡fico: some por padrÃ£o (CSS: opacity/visibility 0) e sÃ³
  // aparece no hover/click de uma barra, posicionado em cima dela â€” em vez
  // de fixo num left/top hard-coded que nÃ£o acompanhava o tamanho do card.
  function showConsumoTooltip(day, barGroupEl) {
    const tooltip = $("bmbdConsumoTooltip");
    const plot = document.querySelector(".bmbd-consumo-chart__plot");
    if (!tooltip || !plot || !barGroupEl) return;
    updateConsumoTooltip(day);

    const barEl = barGroupEl.querySelector(".bmbd-consumo-chart__bar") || barGroupEl;
    const plotRect = plot.getBoundingClientRect();
    const barRect = barEl.getBoundingClientRect();

    let left = barRect.left + barRect.width / 2 - plotRect.left;
    const half = (tooltip.offsetWidth || 220) / 2;
    left = Math.min(Math.max(left, half + 4), plotRect.width - half - 4);

    // Sempre em cima da barra (nÃ£o inverte pra baixo, nem quando a barra Ã© alta).
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${barRect.top - plotRect.top - 10}px`;
    tooltip.style.transform = "translate(-50%, -100%)";
    tooltip.classList.add("is-visible");
  }

  function hideConsumoTooltip() {
    $("bmbdConsumoTooltip")?.classList.remove("is-visible");
  }

  function getSelectedPeriodRange() {
    const period = window.Plv?.state?.period;
    if (period?.start && period?.end) {
      return { start: new Date(period.start), end: new Date(period.end) };
    }
    const end = new Date();
    const start = new Date(end.getTime() - 6 * 86400000);
    return { start, end };
  }

  function renderConsumoChart() {
    const panel = $("bmbdPanel");
    if (!panel) return;

    const range = getSelectedPeriodRange();
    const days = generateConsumoData(range.start, range.end);
    consumoState.days = days;

    const consumoLimit = getConsumoDailyLimit();
    const scaleCandidates = days.map((d) => d.total);
    const rawMax = Math.max(0, ...scaleCandidates) * 1.08;
    // A linha do limite ganha uma folga prÃ³pria (~18%) em vez de entrar como
    // mais um candidato com o mesmo 1.08 das barras â€” senÃ£o, quando ela Ã© o
    // maior valor da escala (ex.: perÃ­odo com pouco consumo), sobra pouca
    // margem atÃ© o topo e ela cola perto do nÃºmero de cima. Linha e rÃ³tulo
    // do eixo Y (mesma escala) descem juntos.
    const limitHeadroomMax = consumoLimit ? consumoLimit.limit / 0.82 : 0;
    const maxScale = niceScaleMax(Math.max(rawMax, limitHeadroomMax));

    const yEl = $("bmbdConsumoY");
    if (yEl) {
      yEl.innerHTML = [1, 0.75, 0.5, 0.25, 0]
        .map((f) => `<span>${fmtM3(Math.round(maxScale * f))} m³</span>`)
        .join("");

      // Valor do limite (linha vermelha tracejada do grÃ¡fico) tambÃ©m entra
      // na coluna do eixo Y, em vermelho, na mesma altura da linha â€” cor Ã 
      // parte, Ã© sÃ³ mais um rÃ³tulo, entÃ£o calcula a posiÃ§Ã£o em px a partir
      // da caixa real do elemento (padding-top/bottom jÃ¡ reservam espaÃ§o
      // pros rÃ³tulos das pontas), continua certo em qualquer tamanho de tela.
      if (consumoLimit && maxScale > 0) {
        const style = getComputedStyle(yEl);
        const paddingTop = parseFloat(style.paddingTop) || 0;
        const paddingBottom = parseFloat(style.paddingBottom) || 0;
        const contentHeight = yEl.clientHeight - paddingTop - paddingBottom;
        const pct = Math.min(1, consumoLimit.limit / maxScale);
        const bottomPx = paddingBottom + pct * contentHeight;
        const limitLabel = document.createElement("span");
        limitLabel.className = "bmbd-consumo-chart__y-limit";
        limitLabel.style.bottom = `${bottomPx.toFixed(1)}px`;
        limitLabel.textContent = `${fmtM3(consumoLimit.limit)} m³`;
        yEl.appendChild(limitLabel);
      }
    }

    // Legenda abaixo do grÃ¡fico explicando a linha tracejada (mesmo padrÃ£o
    // visual da legenda de NÃ­vel mÃ­n./mÃ¡x. do medidor de nÃ­vel).
    const legendEl = $("bmbdConsumoLegend");
    if (legendEl) {
      legendEl.innerHTML = consumoLimit
        ? `<span class="bmbd-consumo-chart__legend-item bmbd-consumo-chart__legend-item--limit"><span>Limite de consumo</span> (${fmtM3(consumoLimit.limit)} m³)</span>`
        : "";
    }

    const barsEl = $("bmbdConsumoBars");
    // .plot sÃ³ tem 100% do wrap por padrÃ£o â€” quando as barras (.bars)
    // ficam mais largas que isso (perÃ­odo longo, rolÃ¡vel), o fundo com as
    // linhas de grade (.grid, que segue o tamanho do prÃ³prio .plot) para
    // de acompanhar e "acaba" antes das Ãºltimas barras. Por isso o .plot
    // precisa da mesma largura de conteÃºdo que as barras.
    const plotEl = document.querySelector(".bmbd-consumo-chart__plot");
    // PerÃ­odo com mais de 12 dias -> em vez de espremer as barras (1fr),
    // fixa a largura e deixa o wrapper (.bmbd-consumo-chart__plot-wrap,
    // que jÃ¡ tem overflow-x:auto) rolar horizontalmente. PerÃ­odo curto
    // continua esticando pra preencher o card, sem rolagem.
    const isScrollable = days.length > 12;
    // Destaca o Ãºltimo dia com consumo (nÃ£o simplesmente o Ãºltimo dia,
    // que pode estar zerado por a bomba nÃ£o ter ligado).
    const lastActiveIdx = (() => {
      for (let i = days.length - 1; i >= 0; i--) if (days[i].total > 0) return i;
      return days.length - 1;
    })();

    if (barsEl) {
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

      const limitLineHtml = (() => {
        if (!consumoLimit || maxScale <= 0) return "";
        const bottomPct = Math.min(100, (consumoLimit.limit / maxScale) * 100);
        // Sem rÃ³tulo "Limite: X m³" flutuando em cima da linha â€” o valor jÃ¡
        // aparece na coluna do eixo Y (bmbdConsumoY), em vermelho, na mesma
        // altura desta linha.
        return `<div class="bmbd-consumo-chart__limit-line" style="bottom:${bottomPct.toFixed(2)}%;" title="${tBmb("Limite de consumo cadastrado no editar bomba")} (${fmtM3(consumoLimit.limit)} m³)"></div>`;
      })();

      barsEl.innerHTML = limitLineHtml + days.map((d, i) => {
        const heightPct = maxScale > 0 ? (d.total / maxScale) * 100 : 0;
        const isZero = d.total === 0;
        const barClass = isZero ? "is-zero" : "is-offpeak";
        const label = isZero ? "" : `<span class="bmbd-consumo-chart__bar-label">${fmtM3(d.total)}</span>`;
        return `
          <div class="bmbd-consumo-chart__group${i === lastActiveIdx ? " is-highlight" : ""}" data-idx="${i}" style="cursor:pointer;">
            <div class="bmbd-consumo-chart__columns">
              <div class="bmbd-consumo-chart__bar ${barClass}" style="height:${heightPct.toFixed(2)}%;">${label}</div>
            </div>
            <div class="bmbd-consumo-chart__label">${d.label}</div>
          </div>`;
      }).join("");

      barsEl.querySelectorAll(".bmbd-consumo-chart__group").forEach((group) => {
        const idx = Number(group.dataset.idx);
        const day = consumoState.days[idx];
        if (!day) return;

        // Hover -> mostra o balÃ£o em cima da barra; sai do hover -> esconde.
        group.addEventListener("mouseenter", () => showConsumoTooltip(day, group));
        group.addEventListener("mouseleave", hideConsumoTooltip);

        // Clique -> fixa o destaque na barra (Ãºtil pra telas touch, sem hover)
        group.addEventListener("click", () => {
          barsEl.querySelectorAll(".bmbd-consumo-chart__group").forEach((g) => g.classList.remove("is-highlight"));
          group.classList.add("is-highlight");
          showConsumoTooltip(day, group);
        });
      });

      // PerÃ­odo longo (>12 dias): jÃ¡ abre rolado atÃ© o final.
      // Quem tem overflow-x Ã© o wrapper (.plot-wrap), nÃ£o o .bars em si.
      if (isScrollable) {
        const wrap = document.querySelector(".bmbd-consumo-chart__plot-wrap");
        if (wrap) requestAnimationFrame(() => { wrap.scrollLeft = wrap.scrollWidth; });
      }
    }
  }

  // Reage ao popover de perÃ­odo (mesmo componente global usado no pivÃ´ e
  // na Pluviometria). SÃ³ re-renderiza se a tela de detalhes da bomba
  // estiver mesmo montada.
  document.addEventListener("pluv:periodChanged", () => {
    if ($("bmbdConsumoBars")) renderConsumoChart();
    if ($("bmbdHistoryTableBody")) { historyPage.eventos = 1; historyPage.operacoes = 1; renderHistory(); }
  });

  // =========================
  // HistÃ³rico (Eventos / OperaÃ§Ãµes) â€” gerado pelo motor Ãºnico
  // (assets/js/core/demo-history.js): mesmas operaÃ§Ãµes do grÃ¡fico de
  // consumo e dos RelatÃ³rios (Energia, GestÃ£o HÃ­drica, Conformidade).
  // =========================
  const HIST_PAGE_SIZE = 10;
  const historyPage = { eventos: 1, operacoes: 1 };
  const CHECK_ICON = '<img src="./assets/img/svg/check-check.svg" style="width:16px;height:16px;vertical-align:middle;filter:invert(48%) sepia(79%) saturate(476%) hue-rotate(86deg) brightness(118%) contrast(119%);" alt="">';

  function historyRange() {
    return window.IcDemoHistory.periodFrom(window.Plv?.state?.period, 7);
  }

  function renderHistory() {
    const DH = window.IcDemoHistory;
    const equip = getFocusBmb();
    const panel = $("bmbdPanel");
    if (!DH || !equip || !panel) return;
    const range = historyRange();
    const empty = (cols, t) => `<tr class="bmbd-history__row"><td colspan="${cols}" style="text-align:center;padding:28px 12px;color:#64748b;">${t}</td></tr>`;

    // Eventos
    const evBody = $("bmbdHistoryTableBody");
    const events = DH.pump.events(equip, range.start, range.end);
    const evTotal = Math.max(1, Math.ceil(events.length / HIST_PAGE_SIZE));
    historyPage.eventos = Math.min(historyPage.eventos, evTotal);
    if (evBody) {
      const slice = events.slice((historyPage.eventos - 1) * HIST_PAGE_SIZE, historyPage.eventos * HIST_PAGE_SIZE);
      evBody.innerHTML = slice.length ? slice.map((ev) => {
        const details = Object.entries(ev.details || {}).map(([k, v]) =>
          `<div class="bmbd-history__detail-item"><span class="bmbd-history__detail-label">${k}:</span> <strong class="bmbd-history__detail-value">${v}</strong></div>`).join("");
        return `<tr class="bmbd-history__row">
            <td class="bmbd-history__col-btn"><button class="expand-btn"><i class="fa-solid fa-plus"></i></button></td>
            <td>${DH.fmt.dateTime(ev.date)}</td>
            <td>${ev.type}${ev.type === "Comando" ? " " + CHECK_ICON : ""}</td>
            <td>${ev.status}</td>
          </tr>
          <tr class="bmbd-history__row-details" style="display: none;"><td colspan="4"><div class="bmbd-history__details">
            <div class="bmbd-history__details-grid" style="grid-template-columns: 1fr 1fr; gap: 4px 32px;">${details}</div>
          </div></td></tr>`;
      }).join("") : empty(4, "Nenhum evento no perÃ­odo selecionado.");
    }
    const evPager = panel.querySelector('[data-panel="eventos"] .bmbd-history__pagination');
    if (evPager) { evPager.innerHTML = DH.paginationHtml(historyPage.eventos, evTotal); evPager.style.display = evTotal > 1 ? "" : "none"; }

    // OperaÃ§Ãµes
    const opBody = panel.querySelector('[data-panel="operacoes"] tbody');
    const ops = DH.pump.ops(equip, range.start, range.end);
    const opTotal = Math.max(1, Math.ceil(ops.length / HIST_PAGE_SIZE));
    historyPage.operacoes = Math.min(historyPage.operacoes, opTotal);
    if (opBody) {
      const slice = ops.slice((historyPage.operacoes - 1) * HIST_PAGE_SIZE, historyPage.operacoes * HIST_PAGE_SIZE);
      opBody.innerHTML = slice.length ? slice.map((op) => `<tr class="bmbd-history__row">
          <td>${DH.fmt.dateTime(op.start)}</td>
          <td>${op.open ? "Em andamento" : DH.fmt.dateTime(op.end)}</td>
          <td>${DH.fmt.n(op.volume, 2)} m³</td>
        </tr>`).join("") : empty(3, "Nenhuma operaÃ§Ã£o no perÃ­odo selecionado.");
    }
    const opPager = panel.querySelector('[data-panel="operacoes"] .bmbd-history__pagination');
    if (opPager) { opPager.innerHTML = DH.paginationHtml(historyPage.operacoes, opTotal); opPager.style.display = opTotal > 1 ? "" : "none"; }
  }

  function initConsumoChart() {
    const panel = $("bmbdPanel");
    if (!panel || panel.dataset.consumoInit === "1") return;
    panel.dataset.consumoInit = "1";

    // Sincroniza o rÃ³tulo do botÃ£o "PerÃ­odo" com o que jÃ¡ estava
    // selecionado no popover, em vez de deixar preso no texto padrÃ£o.
    window.Plv?.period?.syncUI?.();
    renderConsumoChart();
  }

  async function showDetailsView(options = {}) {
    const BmbId = options.BmbId ?? null;
    const fromMap = options.fromMap === true;
    const openModal = options.openModal === true;
    if (BmbId) state.detailsFocusId = BmbId;

    if (isDetailsOpen()) {
      renderDetails();
      updateDetailsMinimap();
      if (fromMap) {
        const panel = $("bmbdPanel");
        if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }

    document.body.classList.remove("is-pivo-details-only");
    document.body.classList.add("is-bmbd");
    window.icMapSetWheelMode?.("ctrl");
    unbindDetailsEvents();

    const slot = document.getElementById("pageSlot");
    if (!slot) {
      document.body.classList.remove("is-bmbd");
      window.icMapSetWheelMode?.("free");
      return;
    }
    try {
      const html = await fetch("./pages/bomba.details.html").then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); });
      slot.innerHTML = html;
    } catch (err) {
      console.error("[bmbdetails] Failed to load bomba.details.html", err);
      document.body.classList.remove("is-bmbd");
      window.icMapSetWheelMode?.("free");
      return;
    }

    bindDetailsEvents();
    renderDetails();
    initDetailsMinimap();
    populateSelector();
    initConsumoChart();

    if (openModal) {
      setTimeout(() => openBombaStartModal(), 120);
    }

    setTimeout(() => {
      const panel = $("bmbdPanel") || slot;
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
    document.body.classList.remove("is-bmbd");
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
    const equip = getFocusBmb();
    if (!equip) return;
    const d = normalizeBmb(equip);

    setText("bmbdTitleLabel", d.name || "Bmb");
    setText("bmbdKpiPressure", `${d.pressure.toFixed(1)} bar`);
    setText("bmbdKpiFlow", `${Math.round(d.flow)} m³/h`);
    setText("bmbdKpiTempMotor", `${Math.round(d.temp + 10)}Â°C`); // Slightly higher than avg
    setText("bmbdKpiVibration", `${d.vibration.toFixed(1)} mm/s`);

    setText("bmbdLastUpdate", formatLastUpdate(d.updated));
    const DHc = window.IcDemoHistory;
    const cur = DHc ? DHc.pump.current(equip) : null;
    if (cur) {
      setText("bmbdKpiPressure", `${cur.pressure.toFixed(1)} bar`);
      setText("bmbdKpiFlow", `${Math.round(cur.flow)} m³/h`);
      setText("bmbdKpiHorimeter", `${Math.round(cur.hours)}h`);
      setText("bmbdLastUpdate", DHc.fmt.dateTime(cur.lastCommunication));
    }
    historyPage.eventos = 1;
    historyPage.operacoes = 1;
    renderHistory();
    if ($("bmbdConsumoBars") && $("bmbdPanel")?.dataset.consumoInit === "1") renderConsumoChart();

    setText("bmbdSummaryHours", `${d.hours.toFixed(1)} h`);
    setText("bmbdSummaryHoursTrend", "+5% vs anterior");
    setText("bmbdSummaryEnergy", `${Math.round(d.energy).toLocaleString("pt-BR")} kWh`);
    setText("bmbdSummaryEnergyTrend", "-2% vs anterior");
    setText("bmbdSummaryTemp", `${Math.round(d.temp)}Â°C`);
    setText("bmbdSummaryTempStatus", "Normal");
    setText("bmbdSummaryVibration", `${d.vibration.toFixed(1)} mm/s`);
    setText("bmbdSummaryVibrationStatus", "Normal");

    setText("bmbdChartValue", `${Math.round(d.percent)}%`);

    const dot = $("bmbdStatusDot");
    const bar = $("bmbdStatusBar");
    const text = $("bmbdStatusText");
    if (dot) {
      dot.classList.toggle("is-offline", d.offline);
      dot.classList.toggle("is-running", !d.offline);
    }
    if (bar) {
      bar.classList.toggle("is-offline", d.offline);
      bar.classList.toggle("is-running", !d.offline);
    }
    // Status coerente com o desenho no mapa (azul = ligada, amarelo = desligada)
    if (bar) bar.classList.toggle("is-energized", !d.offline && !d.running);
    if (bar) bar.classList.toggle("is-running", !d.offline && !!d.running);
    if (text) text.textContent = d.offline ? "SEM COMUNICAÃ‡ÃƒO" : (d.running ? "LIGADO VIA INTERNET" : "DESLIGADA");

    const power = $("bmbdStatusPower");
    if (power) power.style.display = d.offline ? "none" : "";
  }

  // setText compartilhado â€” ver assets/js/core/equip-utils.js
  const { setText } = window.IcEquipUtils;

  function populateSelector() {
    const menu = $("bmbdSelectorMenu");
    if (!menu) return;
    const current = getFocusBmb();
    renderAllEquipmentInMenu(menu, current?.id, "bombas", () => window.IcBombaDetails?.close?.());
  }

  function renderAllEquipmentInMenu(menu, currentId, currentType, closeSelf) {
    const farm = window.IcFarmGetActive?.() || window.icFarmData || window.IcFarmActive || null;
    const equipments = getFarmEquipmentsSafe(farm);
    const groups = [
      { label: "PivÃ´s", type: "pivos", items: equipments.filter(e => { const c = String(e?.category || "").toLowerCase(); return c === "pivos" || c === "pivo" || c === "pivot" || c === "pivots"; }), open: id => window.IcPivos?.open?.({ pivotId: id }) },
      { label: "Bombas", type: "bombas", items: equipments.filter(e => { const t = String(e?.type || "").toLowerCase(); const c = String(e?.category || "").toLowerCase(); return t === "irripump" || c === "bombas"; }), open: id => window.IcBombaDetails?.open?.({ BmbId: id }) },
      { label: "Medidores de NÃ­vel", type: "medidores", items: equipments.filter(e => { const t = String(e?.type || "").toLowerCase(); const c = String(e?.category || "").toLowerCase(); return t === "medidor" || c === "medidores"; }), open: id => window.IcMdnDetails?.open?.({ mdnId: id }) },
      { label: "EstaÃ§Ãµes MeteorolÃ³gicas", type: "estacoes", items: equipments.filter(isWeatherStationEquipment), open: id => window.IcEstacaoDetails?.open?.({ estId: id }) }
    ].filter(g => g.items.length > 0);

    menu.innerHTML = "";
    if (!groups.length) { menu.innerHTML = `<div style="padding:10px 12px;font-size:12px;color:#64748b;">Nenhum equipamento encontrado.</div>`; return; }

    groups.forEach(group => {
      const wrapper = document.createElement("section");
      const hasCurrent = group.type === currentType && group.items.some((item) => String(item.id) === String(currentId));
      wrapper.className = "bmbd-selector__group" + (hasCurrent ? " is-open" : "");

      const header = document.createElement("button");
      header.type = "button";
      header.className = "bmbd-selector__group-header";
      header.setAttribute("aria-expanded", hasCurrent ? "true" : "false");
      header.innerHTML = `<span class="bmbd-selector__group-chevron"><i class="fa-solid fa-caret-right"></i></span><span class="bmbd-selector__group-title">${group.label}</span>`;
      header.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const nextOpen = !wrapper.classList.contains("is-open");
        wrapper.classList.toggle("is-open", nextOpen);
        header.setAttribute("aria-expanded", nextOpen ? "true" : "false");
      });

      const body = document.createElement("div");
      body.className = "bmbd-selector__group-body";

      group.items.forEach(item => {
        const isCurrent = group.type === currentType && String(item.id) === String(currentId);
        const name = item.name || item.nome || item.data?.nome || item.data?.serial || group.label;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "bmbd-selector__item" + (isCurrent ? " is-selected" : "");
        btn.innerHTML = `<span class="bmbd-selector__item-mark">${isCurrent ? '<i class="fa-solid fa-check"></i>' : ''}</span><span>${name}</span>`;
        btn.addEventListener("click", ev => {
          ev.stopPropagation();
          menu.style.display = "none";
          const sb = $("bmbdSelectBtn"); if (sb) sb.classList.remove("is-active");
          if (!isCurrent) { closeSelf?.(); group.open(item.id); }
        });
        body.appendChild(btn);
      });

      wrapper.appendChild(header);
      wrapper.appendChild(body);
      menu.appendChild(wrapper);
    });
  }

  function nowLocalISO() {
    const d = new Date();
    d.setSeconds(0, 0);
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000);
    return local.toISOString().slice(0, 16);
  }

  function addHoursISO(iso, hours) {
    const d = new Date(iso);
    d.setHours(d.getHours() + hours);
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000);
    return local.toISOString().slice(0, 16);
  }

  function openBombaStartModal() {
    const modal = $("bmbdStartModal");
    if (!modal) return;

    // Reset tabs to first
    modal.querySelectorAll(".bmbd-modal-tab").forEach((t, i) => t.classList.toggle("is-active", i === 0));
    const fields = $("bmbdIntervalFields");
    if (fields) fields.classList.remove("is-visible");

    // Set default date values
    const now = nowLocalISO();
    const startInput = $("bmbdStartDateInput");
    const endInput = $("bmbdEndDateInput");
    if (startInput) { startInput.value = now; startInput.min = now; }
    if (endInput) { endInput.value = addHoursISO(now, 1); endInput.min = now; }

    modal.classList.remove("is-hidden");
    bindBombaModalEvents(modal);
  }

  function closeBombaStartModal() {
    const modal = $("bmbdStartModal");
    if (modal) modal.classList.add("is-hidden");
  }

  function applyBombaTabState(mode) {
    const startInput = $("bmbdStartDateInput");
    const endInput = $("bmbdEndDateInput");
    // "ComeÃ§ar agora" â†’ desabilita inÃ­cio (comeÃ§a agora, sem data)
    if (startInput) startInput.disabled = mode === "agora";
    // "Sem parar" â†’ desabilita fim
    if (endInput) endInput.disabled = mode === "sem_parar";
  }

  // Liga os eventos do modal UMA vez por elemento. Antes eram religados a cada
  // abertura (e os "once" sÃ³ saÃ­am quando disparavam), entÃ£o abrir/cancelar
  // vÃ¡rias vezes fazia o OK rodar vÃ¡rias vezes. O modal Ã© recriado junto com a
  // pÃ¡gina, entÃ£o o data-bound volta a ficar vazio quando o HTML Ã© recarregado.
  function bindBombaModalEvents(modal) {
    applyBombaTabState("agora");
    if (modal.dataset.bound === "1") return;
    modal.dataset.bound = "1";

    const close = () => closeBombaStartModal();

    $("bmbdStartModalClose")?.addEventListener("click", close);
    $("bmbdStartModalCancel")?.addEventListener("click", close);
    $("bmbdStartModalBackdrop")?.addEventListener("click", close);

    // BotÃµes de calendÃ¡rio abrem o picker
    modal.querySelectorAll(".bmbd-cal-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const input = $(btn.dataset.for);
        if (input && !input.disabled && typeof input.showPicker === "function") input.showPicker();
      });
    });

    // Tabs
    modal.querySelectorAll(".bmbd-modal-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        modal.querySelectorAll(".bmbd-modal-tab").forEach(t => t.classList.remove("is-active"));
        tab.classList.add("is-active");
        applyBombaTabState(tab.dataset.mode);
      });
    });

    // Sync end date when start date changes
    $("bmbdStartDateInput")?.addEventListener("change", (e) => {
      const endInput = $("bmbdEndDateInput");
      if (!endInput) return;
      if (!endInput.value || endInput.value <= e.target.value) {
        endInput.value = addHoursISO(e.target.value, 1);
      }
      endInput.min = e.target.value;
    });

    $("bmbdStartModalConfirm")?.addEventListener("click", () => {
      const activeTab = modal.querySelector(".bmbd-modal-tab.is-active");
      const mode = activeTab?.dataset?.mode || "agora";
      const startDate = $("bmbdStartDateInput")?.value || null;
      const endDate = $("bmbdEndDateInput")?.value || null;
      console.info("[bomba] agendamento", { mode, startDate, endDate });
      // "ComeÃ§ar agora" / "Sem parar" ligam a bomba na hora; "Intervalo" fica sÃ³ agendado.
      if (mode !== "intervalo") setFocusBombaRunning(true);
      close();
    });
  }

  // Liga/desliga a bomba em foco (mesmo armazenamento do mapa/lista) e
  // re-renderiza o card de detalhes e o minimapa.
  function setFocusBombaRunning(running) {
    const equip = getFocusBmb();
    if (!equip) return;
    const id = normalizeBmb(equip).id;
    console.info(running ? "[bomba] ligar" : "[bomba] desligar", { id });
    const wasRunning = window.IcResolveBombaRunning ? !!window.IcResolveBombaRunning(equip) : null;
    window.IcSetBombaRunning?.(id, running);
    renderDetails();
    updateDetailsMinimap();
    if (wasRunning === !!running) window.IcNotify?.success?.(running ? "A bomba jÃ¡ estÃ¡ ligada." : "A bomba jÃ¡ estÃ¡ desligada.", 2000);
    else window.IcNotify?.success?.(running ? "Comando enviado: bomba ligada." : "Comando enviado: bomba desligada.", 2000);
  }

  // Comando dado por outra tela (card do mapa) ou novo registro no histÃ³rico â†’
  // o card de detalhes e a tabela se atualizam sozinhos.
  window.addEventListener("ic:bomba-status-change", () => {
    if (!$("bmbdStatusBar")) return;
    try { renderDetails(); updateDetailsMinimap(); } catch (_) { }
  });
  window.addEventListener("ic:demo-history-change", (ev) => {
    if (!$("bmbdHistoryTableBody")) return;
    const kind = ev?.detail?.kind;
    if (kind && kind !== "pump" && kind !== "event" && kind !== "clear" && kind !== "sync") return;
    try { renderHistory(); } catch (_) { }
  });

  function bindDetailsEvents() {
    if (detailsEventsBound) return;
    detailsEventsBound = true;

    const panel = $("bmbdPanel");
    if (panel) {
      const BMBD_ICON_FILTER = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z"></path></svg>`;
      const BMBD_ICON_DOWNLOAD = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/></svg>`;

      const updateBmbdFilterIcon = (tab) => {
        const filterBtn = panel.querySelector(".bmbd-history__actions button[aria-label='Filtrar']");
        if (filterBtn) filterBtn.innerHTML = tab === "operacoes" ? BMBD_ICON_DOWNLOAD : BMBD_ICON_FILTER;
      };

      // History tabs
      panel.addEventListener("click", (e) => {
        const tabBtn = e.target.closest(".js-bmbd-history-tab");
        if (tabBtn) {
          panel.querySelectorAll(".js-bmbd-history-tab").forEach(b => b.classList.remove("is-active"));
          tabBtn.classList.add("is-active");
          const tab = tabBtn.getAttribute("data-tab");
          updateBmbdFilterIcon(tab);
          panel.querySelectorAll(".bmbd-history__tab-panel").forEach(p => {
            p.style.display = p.getAttribute("data-panel") === tab ? "" : "none";
          });
          return;
        }

        const pageBtn = e.target.closest(".bmbd-history__pagination [data-page]");
        if (pageBtn) {
          if (pageBtn.disabled) return;
          const tab = pageBtn.closest("[data-panel]")?.getAttribute("data-panel") || "eventos";
          historyPage[tab] = Number(pageBtn.dataset.page) || 1;
          renderHistory();
          return;
        }

        // Expand/collapse row details
        const expandBtn = e.target.closest(".expand-btn");
        if (expandBtn) {
          const row = expandBtn.closest(".bmbd-history__row");
          if (row) {
            const detailsRow = row.nextElementSibling;
            if (detailsRow?.classList.contains("bmbd-history__row-details")) {
              const isExpanded = detailsRow.style.display !== "none";
              detailsRow.style.display = isExpanded ? "none" : "";
              const icon = expandBtn.querySelector("i");
              if (icon) icon.className = isExpanded ? "fa-solid fa-plus" : "fa-solid fa-minus";
            }
          }
          return;
        }

        const backBtn = e.target.closest(".js-details-back");
        if (backBtn) {
          window.IcNavigate?.("visao-geral");
          return;
        }

        // Ligar Bomba button
        const startBtn = e.target.closest(".pincard__control-btn.is-start");
        if (startBtn) {
          openBombaStartModal();
          return;
        }

        // Desligar Bomba button
        const stopBtn = e.target.closest(".pincard__control-btn.is-stop");
        if (stopBtn) {
          setFocusBombaRunning(false);
          return;
        }

        // Edit button
        const editBtn = e.target.closest("#bmbdEditBtn");
        if (editBtn) {
          const focusEquip = getFocusBmb();
          const isGh = String(focusEquip?.data?.version || "") === "5.2";
          const ghEditView = window.BmbGh?.views?.edit;
          if (isGh && ghEditView && typeof ghEditView.showEditView === "function") {
            window.BmbGh.state.detailsFocusId = state.detailsFocusId;
            ghEditView.showEditView();
          } else if (views.edit && typeof views.edit.showEditView === "function") {
            views.edit.showEditView();
          }
          return;
        }

        const sectionNavBtn = e.target.closest(".bmbd-section-nav__btn");
        if (sectionNavBtn) {
          const targetView = sectionNavBtn.getAttribute("data-details-view");
          if (targetView === "pivos") {
            window.IcBombaDetails?.close?.();
            window.IcPivos?.open?.();
            return;
          }
          if (targetView === "pluviometros") {
            window.IcBombaDetails?.close?.();
            window.IcPluvDetails?.open?.();
            return;
          }
          if (targetView === "medidores") {
            window.IcBombaDetails?.close?.();
            window.IcMdnDetails?.open?.();
            return;
          }
          if (targetView === "estacoes") {
            window.IcBombaDetails?.close?.();
            window.IcEstacaoDetails?.open?.();
            return;
          }
        }
      });
    }

    onDocClickDetails = (e) => {
      const menu = $("bmbdSelectorMenu");
      const selectBtn = e.target.closest("#bmbdSelectBtn");
      if (!menu) return;

      const option = e.target.closest("[data-bmbd-option]");
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

  function getPumpIcon(color) {
    // Mesmo Ã­cone da VisÃ£o Geral (mapa.js)
    if (typeof window.IcMapPumpIcon === "function") return window.IcMapPumpIcon(color);
    return L.divIcon({
      className: "map-pump-marker",
      html: `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 40 32" fill="${color}" stroke="#111827" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M10 2h10v5h3a3 3 0 0 1 3 3v2h5a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-5v2a3 3 0 0 1-3 3h1l2.5 5h-21l2.5-5h1a3 3 0 0 1-3-3V10a3 3 0 0 1 3-3h3V2z"/></svg>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
  }

  function getPumpIconLarge(color) {
    return L.divIcon({
      className: "map-pump-marker",
      html: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="90" height="82" viewBox="0 0 39 36" version="1.1" aria-hidden="true">
        <g id="surface1">
          <path fill="${color}" stroke="rgba(0,0,0,0.88)" stroke-width="5" stroke-linecap="butt" stroke-linejoin="miter" stroke-opacity="1" stroke-miterlimit="10" d="M 193.994459 131.219193 C 193.740196 116.334379 193.994459 101.470355 193.994459 86.585541 C 193.994459 78.581836 192.108671 76.17033 184.39601 76.419796 C 178.886965 76.586107 177.191875 74.486433 177.467327 69.413955 C 177.467327 69.351589 177.467327 69.268433 177.467327 69.206067 L 99.768617 69.206067 C 99.599108 69.206067 99.429599 69.206067 99.26009 69.206067 C 99.26009 69.268433 99.26009 69.351589 99.26009 69.413955 C 101.251822 77.687916 95.467325 76.066386 90.890581 76.419796 C 87.203759 76.669262 84.025465 77.521605 83.898333 82.552505 C 83.813578 85.857932 80.889547 86.918163 77.90195 86.647908 C 74.893165 86.398442 74.299883 84.402713 74.469392 81.866474 C 74.469392 81.180442 74.723656 80.328099 74.469392 79.849956 C 72.880245 77.188983 68.3035 76.856362 68.939159 72.262027 C 69.341743 69.351589 68.939159 66.337206 69.023914 63.343612 C 68.939159 61.22315 68.960348 59.081899 69.108668 56.940648 C 69.320555 55.360696 70.591873 54.113365 72.18102 53.947054 L 79.427532 53.198656 C 80.317454 47.627245 80.317454 41.95189 79.427532 36.359691 L 71.672493 35.569715 C 70.1681 35.403404 69.023914 34.135284 69.002725 32.617699 L 69.002725 12.993028 C 60.506084 12.889084 52.200141 13.13855 44.508668 12.993028 C 44.508668 17.005276 44.78412 19.998869 44.699366 23.470607 C 44.445102 35.46577 44.296782 34.551061 33.829598 36.463635 C 32.960864 41.972679 32.960864 47.585667 33.829598 53.094711 L 41.69058 53.905476 C 42.877143 54.030209 43.809443 54.965707 43.978952 56.129883 C 44.699366 61.992337 44.021329 67.771636 44.212027 73.530146 C 44.212027 74.424067 44.021329 75.98323 43.533991 76.17033 C 36.096781 78.997613 38.215644 85.379788 38.109701 90.701733 C 37.876626 100.576434 32.791355 105.773646 22.938642 105.815224 C 20.162931 105.815224 17.429597 106.522044 14.420812 106.667566 C 14.484378 115.149415 14.420812 123.007599 14.420812 131.052882 C 19.018745 131.489448 20.629081 131.863647 23.616678 131.884436 C 33.299882 131.926013 38.024947 136.624293 38.024947 146.311895 C 37.919004 147.912636 37.919004 149.513377 38.024947 151.114118 C 39.296265 160.385943 38.448719 161.071975 47.623397 160.780931 C 54.53089 160.552254 61.459573 160.593831 68.388255 160.780931 C 70.040968 160.843298 71.651304 160.198843 72.79549 159.013879 C 73.939676 157.808126 74.511769 156.186596 74.384638 154.544277 C 74.19394 150.656763 74.215128 146.769249 74.384638 142.881735 C 74.490581 140.387074 74.723656 137.871623 78.474043 137.975567 C 81.567583 138.037934 83.47456 139.243687 83.559315 142.195703 C 83.813578 148.120524 87.458023 148.473934 92.204276 148.432357 C 119.664742 148.286835 147.125208 148.36999 174.606862 148.36999 L 174.289033 148.36999 L 175.962934 148.36999 C 193.549498 148.286835 194.269912 150.781496 193.994459 131.219193 Z M 193.994459 131.219193 " transform="matrix(0.184356,0,0,0.187901,0.00159391,0)"></path>
          <path fill="${color}" stroke="rgba(0,0,0,0.88)" stroke-width="5" stroke-linecap="butt" stroke-linejoin="miter" stroke-opacity="1" stroke-miterlimit="10" d="M 113.880246 150.240986 C 112.905569 150.843863 111.994458 151.550684 111.146912 152.319871 C 106.654923 157.267616 102.438385 162.589561 94.640969 161.924317 C 90.509186 161.570907 90.657506 164.668445 90.530374 167.412573 C 90.382054 171.009043 90.530374 174.938135 95.340194 174.896557 C 123.71177 174.605513 152.125725 175.935999 180.391358 173.94027 C 181.747431 173.857115 181.260092 168.784637 181.090583 166.040509 C 180.98464 164.377401 180.687999 161.758007 178.420816 162.049051 C 169.606345 163.046915 165.601694 155.874763 159.880764 151.633839 C 159.223916 151.155696 158.503502 150.71913 157.825466 150.261775 " transform="matrix(0.184356,0,0,0.187901,0.00159391,0)"></path>
          <path fill="${color}" stroke="rgba(0,0,0,0.88)" stroke-width="5" stroke-linecap="butt" stroke-linejoin="miter" stroke-opacity="1" stroke-miterlimit="10" d="M 76.100917 86.835008 C 74.363449 88.269438 74.003242 90.119645 74.003242 92.323263 C 74.066808 105.607335 74.066808 118.870618 74.003242 132.154691 C 74.003242 134.33752 74.34226 136.208516 76.079728 137.642946 " transform="matrix(0.184356,0,0,0.187901,0.00159391,0)"></path>
          <path fill="${color}" stroke="rgba(0,0,0,0.88)" stroke-width="5" stroke-linecap="butt" stroke-linejoin="miter" stroke-opacity="1" stroke-miterlimit="10" d="M 38.152079 95.795 C 39.868358 97.333375 40.948978 99.474626 41.139676 101.782188 C 41.139676 113.403152 41.139676 125.003328 41.139676 136.603504 C 41.097298 138.578444 40.186187 140.407862 38.639417 141.613615 " transform="matrix(0.184356,0,0,0.187901,0.00159391,0)"></path>
          <path fill="${color}" stroke="rgba(0,0,0,0.88)" stroke-width="5" stroke-linecap="butt" stroke-linejoin="miter" stroke-opacity="1" stroke-miterlimit="10" d="M 154.710738 115.294937 C 151.829084 102.759263 141.065259 94.298203 136.785156 82.490139 C 136.679213 82.095151 136.530892 81.700163 136.340194 81.325964 C 131.996525 92.718251 122.334509 101.324833 118.60531 112.987375 C 114.600659 125.564627 122.609962 139.139743 136.340194 139.181321 C 148.862675 139.118954 157.507637 127.394045 154.710738 115.294937 Z M 154.710738 115.294937 " transform="matrix(0.184356,0,0,0.187901,0.00159391,0)"></path>
          <path fill="${color}" stroke="rgba(0,0,0,0.88)" stroke-width="5" stroke-linecap="butt" stroke-linejoin="miter" stroke-opacity="1" stroke-miterlimit="10" d="M 107.947429 53.718377 L 167.67818 53.718377 C 171.915906 53.718377 175.348464 57.148536 175.348464 61.389461 L 175.348464 68.998178 L 100.446654 68.998178 L 100.446654 61.202361 C 100.446654 57.065381 103.794457 53.718377 107.947429 53.718377 Z M 107.947429 53.718377 " transform="matrix(0.184356,0,0,0.187901,0.00159391,0)"></path>
        </g>
      </svg>`,
      iconSize: [90, 82],
      iconAnchor: [45, 41],
    });
  }

  function initDetailsMinimap() {
    const container = $("bmbdMinimap");
    if (!container || !window.L) return;

    const equip = getFocusBmb();
    const d = equip ? normalizeBmb(equip) : null;
    const hasCoords = d && d.center;
    const center = hasCoords ? [Number(d.center.lat), Number(d.center.lng)] : [-15.79, -47.88];
    const zoom = hasCoords ? 16 : 4;

    if (minimapInstance) {
      try { minimapInstance.remove(); } catch (_) { }
      minimapInstance = null;
      minimapMarker = null;
    }

    minimapInstance = L.map(container, {
      maxZoom: 19,
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
      const pumpColor = d.offline ? "#DA1D29" : (d.running ? "#4679ed" : "#DAC422");
      const pumpIcon = getPumpIconLarge(pumpColor);
      minimapMarker = L.marker([Number(d.center.lat), Number(d.center.lng)], { icon: pumpIcon }).addTo(minimapInstance);
    }

    setTimeout(() => minimapInstance?.invalidateSize?.(), 100);
  }

  function updateDetailsMinimap() {
    if (!minimapInstance || !window.L) return;
    const equip = getFocusBmb();
    const d = equip ? normalizeBmb(equip) : null;
    if (!d || !d.center) return;

    const ll = [Number(d.center.lat), Number(d.center.lng)];
    minimapInstance.setView(ll, 16, { animate: false });

    if (minimapMarker) {
      minimapMarker.setLatLng(ll);
    } else {
      const pumpColor = d.offline ? "#DA1D29" : (d.running ? "#4679ed" : "#DAC422");
      const pumpIcon = getPumpIconLarge(pumpColor);
      minimapMarker = L.marker(ll, { icon: pumpIcon }).addTo(minimapInstance);
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
  detailsView.openBombaStartModal = openBombaStartModal;
})();
