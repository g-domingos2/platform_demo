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

  // toNumber/parseLatLngText/hashStr/seededRandom compartilhados — ver
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
    let trend = { label: "Estável", dir: "flat" };
    if (trendRaw.includes("sub")) trend = { label: "Subindo", dir: "up" };
    else if (trendRaw.includes("cai") || trendRaw.includes("down")) trend = { label: "Caindo", dir: "down" };
    else {
      const pick = seed % 3;
      trend = pick === 0 ? { label: "Subindo", dir: "up" } : pick === 1 ? { label: "Caindo", dir: "down" } : { label: "Estável", dir: "flat" };
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

  // formatLastUpdate compartilhado — ver assets/js/core/equip-utils.js
  const { formatLastUpdate } = window.IcEquipUtils;

  // =========================
  // Gráfico de Consumo — dados aleatórios (porém plausíveis), gerados a
  // partir do mesmo popover de período (calendário duplo + presets) usado
  // no pivô e compartilhado com a Pluviometria (feature.periodPicker.js).
  // Um padrão só de seletor de período pro app inteiro, em vez de um
  // widget exclusivo por tela. É mock — os mesmos dados servem pra
  // qualquer bomba, não vem de backend. Uma barra por dia do período
  // selecionado; período curto estica as barras, período longo (>12
  // dias) trava a largura e rola horizontalmente (dias sem consumo
  // entram como barra zerada, is-zero). Trocar o período regera tudo
  // (barras, eixo, KPIs e o donut de Custos em Energia). O balão some
  // por padrão e só aparece no hover (ou clique/tap) em cima da barra,
  // sem posição fixa.
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

  // Limite de consumo exibido no gráfico: sempre aparece (bomba normal e
  // GH), usando o valor próprio salvo no editar quando for um número
  // positivo válido, senão cai no padrão 5.500,00 m³ — não depende do
  // checkbox "Habilitar limite" (dados de mock antigos podem ter esse
  // flag desligado sem nunca ter passado pelo editar de verdade). A linha
  // marca o valor literal, não dividido pelos dias do período, senão
  // ficaria baixo demais pra aparecer perto das barras diárias (~3.000-
  // 6.000 m³).
  function getConsumoDailyLimit() {
    const equip = getFocusBmb();
    const saved = Number(equip?.data?.consumptionLimit);
    // Sem limite cadastrado: referência de ~12 h/dia na vazão da bomba
    // (mesma vazão usada no histórico), pra linha ficar na escala das barras.
    const flow = window.IcDemoHistory && equip ? window.IcDemoHistory.pump.current(equip)?.flow : 0;
    const limit = saved > 0 ? saved : (flow > 0 ? Math.round((flow * 12) / 100) * 100 : 5500);
    return { limit };
  }

  function fmtM3(n) {
    return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Uma barra por dia do intervalo [start, end]. Dias em que a bomba não
  // ligou entram como barra zerada (is-zero), assim dá pra ver de cara
  // quais dias tiveram consumo — mesmo padrão do modo "Mês" de antes,
  // só que agora vale pra qualquer período escolhido no popover.
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

  // Balão do gráfico: some por padrão (CSS: opacity/visibility 0) e só
  // aparece no hover/click de uma barra, posicionado em cima dela — em vez
  // de fixo num left/top hard-coded que não acompanhava o tamanho do card.
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

    // Sempre em cima da barra (não inverte pra baixo, nem quando a barra é alta).
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
    // A linha do limite ganha uma folga própria (~18%) em vez de entrar como
    // mais um candidato com o mesmo 1.08 das barras — senão, quando ela é o
    // maior valor da escala (ex.: período com pouco consumo), sobra pouca
    // margem até o topo e ela cola perto do número de cima. Linha e rótulo
    // do eixo Y (mesma escala) descem juntos.
    const limitHeadroomMax = consumoLimit ? consumoLimit.limit / 0.82 : 0;
    const maxScale = niceScaleMax(Math.max(rawMax, limitHeadroomMax));

    const yEl = $("bmbdConsumoY");
    if (yEl) {
      yEl.innerHTML = [1, 0.75, 0.5, 0.25, 0]
        .map((f) => `<span>${fmtM3(Math.round(maxScale * f))} m³</span>`)
        .join("");

      // Valor do limite (linha vermelha tracejada do gráfico) também entra
      // na coluna do eixo Y, em vermelho, na mesma altura da linha — cor à
      // parte, é só mais um rótulo, então calcula a posição em px a partir
      // da caixa real do elemento (padding-top/bottom já reservam espaço
      // pros rótulos das pontas), continua certo em qualquer tamanho de tela.
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

    // Legenda abaixo do gráfico explicando a linha tracejada (mesmo padrão
    // visual da legenda de Nível mín./máx. do medidor de nível).
    const legendEl = $("bmbdConsumoLegend");
    if (legendEl) {
      legendEl.innerHTML = consumoLimit
        ? `<span class="bmbd-consumo-chart__legend-item bmbd-consumo-chart__legend-item--limit"><span>Limite de consumo</span> (${fmtM3(consumoLimit.limit)} m³)</span>`
        : "";
    }

    const barsEl = $("bmbdConsumoBars");
    // .plot só tem 100% do wrap por padrão — quando as barras (.bars)
    // ficam mais largas que isso (período longo, rolável), o fundo com as
    // linhas de grade (.grid, que segue o tamanho do próprio .plot) para
    // de acompanhar e "acaba" antes das últimas barras. Por isso o .plot
    // precisa da mesma largura de conteúdo que as barras.
    const plotEl = document.querySelector(".bmbd-consumo-chart__plot");
    // Período com mais de 12 dias -> em vez de espremer as barras (1fr),
    // fixa a largura e deixa o wrapper (.bmbd-consumo-chart__plot-wrap,
    // que já tem overflow-x:auto) rolar horizontalmente. Período curto
    // continua esticando pra preencher o card, sem rolagem.
    const isScrollable = days.length > 12;
    // Destaca o último dia com consumo (não simplesmente o último dia,
    // que pode estar zerado por a bomba não ter ligado).
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
        // Sem rótulo "Limite: X m³" flutuando em cima da linha — o valor já
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

        // Hover -> mostra o balão em cima da barra; sai do hover -> esconde.
        group.addEventListener("mouseenter", () => showConsumoTooltip(day, group));
        group.addEventListener("mouseleave", hideConsumoTooltip);

        // Clique -> fixa o destaque na barra (útil pra telas touch, sem hover)
        group.addEventListener("click", () => {
          barsEl.querySelectorAll(".bmbd-consumo-chart__group").forEach((g) => g.classList.remove("is-highlight"));
          group.classList.add("is-highlight");
          showConsumoTooltip(day, group);
        });
      });

      // Período longo (>12 dias): já abre rolado até o final.
      // Quem tem overflow-x é o wrapper (.plot-wrap), não o .bars em si.
      if (isScrollable) {
        const wrap = document.querySelector(".bmbd-consumo-chart__plot-wrap");
        if (wrap) requestAnimationFrame(() => { wrap.scrollLeft = wrap.scrollWidth; });
      }
    }
  }

  // Reage ao popover de período (mesmo componente global usado no pivô e
  // na Pluviometria). Só re-renderiza se a tela de detalhes da bomba
  // estiver mesmo montada.
  document.addEventListener("pluv:periodChanged", () => {
    if ($("bmbdConsumoBars")) renderConsumoChart();
    if ($("bmbdHistoryTableBody")) { historyPage.eventos = 1; historyPage.operacoes = 1; renderHistory(); }
  });

  // =========================
  // Histórico (Eventos / Operações) — gerado pelo motor único
  // (assets/js/core/demo-history.js): mesmas operações do gráfico de
  // consumo e dos Relatórios (Energia, Gestão Hídrica, Conformidade).
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
      }).join("") : empty(4, "Nenhum evento no período selecionado.");
    }
    const evPager = panel.querySelector('[data-panel="eventos"] .bmbd-history__pagination');
    if (evPager) { evPager.innerHTML = DH.paginationHtml(historyPage.eventos, evTotal); evPager.style.display = evTotal > 1 ? "" : "none"; }

    // Operações
    const opBody = panel.querySelector('[data-panel="operacoes"] tbody');
    const ops = DH.pump.ops(equip, range.start, range.end);
    const opTotal = Math.max(1, Math.ceil(ops.length / HIST_PAGE_SIZE));
    historyPage.operacoes = Math.min(historyPage.operacoes, opTotal);
    if (opBody) {
      const slice = ops.slice((historyPage.operacoes - 1) * HIST_PAGE_SIZE, historyPage.operacoes * HIST_PAGE_SIZE);
      opBody.innerHTML = slice.length ? slice.map((op) => `<tr class="bmbd-history__row">
          <td>${DH.fmt.dateTime(op.start)}</td>
          <td>${DH.fmt.dateTime(op.end)}</td>
          <td>${DH.fmt.n(op.volume, 2)} m³</td>
        </tr>`).join("") : empty(3, "Nenhuma operação no período selecionado.");
    }
    const opPager = panel.querySelector('[data-panel="operacoes"] .bmbd-history__pagination');
    if (opPager) { opPager.innerHTML = DH.paginationHtml(historyPage.operacoes, opTotal); opPager.style.display = opTotal > 1 ? "" : "none"; }
  }

  function initConsumoChart() {
    const panel = $("bmbdPanel");
    if (!panel || panel.dataset.consumoInit === "1") return;
    panel.dataset.consumoInit = "1";

    // Sincroniza o rótulo do botão "Período" com o que já estava
    // selecionado no popover, em vez de deixar preso no texto padrão.
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
    setText("bmbdKpiTempMotor", `${Math.round(d.temp + 10)}°C`); // Slightly higher than avg
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
    setText("bmbdSummaryTemp", `${Math.round(d.temp)}°C`);
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
    if (text) text.textContent = d.offline ? "SEM COMUNICAÇÃO" : (d.running ? "LIGADO VIA INTERNET" : "DESLIGADA");

    const power = $("bmbdStatusPower");
    if (power) power.style.display = d.offline ? "none" : "";
  }

  // setText compartilhado — ver assets/js/core/equip-utils.js
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

  function bindBombaModalEvents(modal) {
    const close = () => closeBombaStartModal();

    $("bmbdStartModalClose")?.addEventListener("click", close, { once: true });
    $("bmbdStartModalCancel")?.addEventListener("click", close, { once: true });
    $("bmbdStartModalBackdrop")?.addEventListener("click", close, { once: true });

    // Botões de calendário abrem o picker
    modal.querySelectorAll(".bmbd-cal-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const input = $(btn.dataset.for);
        if (input && !input.disabled && typeof input.showPicker === "function") input.showPicker();
      });
    });

    const applyTabState = (mode) => {
      const startInput = $("bmbdStartDateInput");
      const endInput = $("bmbdEndDateInput");
      // "Começar agora" → desabilita início (começa agora, sem data)
      if (startInput) startInput.disabled = mode === "agora";
      // "Sem parar" → desabilita fim
      if (endInput) endInput.disabled = mode === "sem_parar";
    };

    // Tabs
    modal.querySelectorAll(".bmbd-modal-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        modal.querySelectorAll(".bmbd-modal-tab").forEach(t => t.classList.remove("is-active"));
        tab.classList.add("is-active");
        applyTabState(tab.dataset.mode);
      });
    });

    applyTabState("agora");

    // Sync end date when start date changes
    $("bmbdStartDateInput")?.addEventListener("change", (e) => {
      const endInput = $("bmbdEndDateInput");
      if (!endInput || endInput.value <= e.target.value) {
        endInput.value = addHoursISO(e.target.value, 1);
      }
      endInput.min = e.target.value;
    });

    $("bmbdStartModalConfirm")?.addEventListener("click", () => {
      const activeTab = modal.querySelector(".bmbd-modal-tab.is-active");
      const mode = activeTab?.dataset?.mode || "agora";
      const startDate = $("bmbdStartDateInput")?.value || null;
      const endDate = $("bmbdEndDateInput")?.value || null;
      console.info("[bomba] ligar", { mode, startDate, endDate });
      close();
    }, { once: true });
  }

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
    // Mesmo ícone da Visão Geral (mapa.js)
    if (typeof window.IcMapPumpIcon === "function") return window.IcMapPumpIcon(color);
    return L.divIcon({
      className: "map-pump-marker",
      html: `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 40 32" fill="${color}" stroke="#111827" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M10 2h10v5h3a3 3 0 0 1 3 3v2h5a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-5v2a3 3 0 0 1-3 3h1l2.5 5h-21l2.5-5h1a3 3 0 0 1-3-3V10a3 3 0 0 1 3-3h3V2z"/></svg>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
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
      const pumpIcon = getPumpIcon(pumpColor);
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
      const pumpIcon = getPumpIcon(pumpColor);
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
