// assets/js/pages/cosmofield/cosmofield-details.js
// Tela de Detalhes do Cosmofield — cockpit no padrão da Estação
// (weatherstation.details.html): pincard > período > indicadores >
// dashboard (gráfico) > dados brutos | calendário. SEPARADA do
// painel de Configurações/Histórico (cosmofield.html), que abre pelo
// "Editar" como overlay por cima desta tela (IcCosmofieldEdit).
//
// Layout com classes próprias, prefixadas "cosmofield-details-" (mesmo
// motivo da Estação: não acoplar ao CSS de outro equipamento — ver
// docs/engineering-fixes-log.md). O conteúdo — gráfico, KPIs, dados
// brutos, calendário, lançamento de eventos e exportação — é o da aba
// Geral: os renderizadores vêm de IcCosmofield.general (cosmofield/
// index.js) e trabalham sobre o root desta tela, então não existe uma
// segunda implementação pra divergir.
(function initCosmofieldDetails() {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const t = (text) => window.IcI18n?.t?.(text) ?? text;

  let minimap = null;
  let selectorOutsideClickHandler = null;

  const G = () => window.IcCosmofield?.general || {};
  const root = () => $("cosmofieldDetailsPanel");

  function devices() {
    return G().listDevices?.() || [];
  }
  function currentIndex() {
    const list = devices();
    const index = G().getDeviceIndex?.() ?? 0;
    return index >= 0 && index < list.length ? index : 0;
  }
  function getSelected() {
    return devices()[currentIndex()] || null;
  }
  // Mesma leitura do marcador, do tooltip, do card e do modal (mapa.js).
  function getReading(equip) {
    return equip ? window.IcCosmofieldReading?.(equip, currentIndex()) || null : null;
  }

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
  }
  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (ch) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
    ));
  }
  const num = (value) => {
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    const n = Number(raw.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  // ─── Markup ────────────────────────────────────────────────────────────
  // Buscado uma vez por sessão (mesma ideia do cosmofield.html): trocar de
  // sonda ou voltar do Editar remonta a tela a partir do cache, sem nova
  // ida ao servidor.
  let markupPromise = null;
  let markupText = null;

  function loadMarkup() {
    if (!markupPromise) {
      markupPromise = fetch(`./pages/cosmofield.details.html?v=${Date.now()}`)
        .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
        .then((text) => { markupText = text; return text; })
        .catch((err) => { markupPromise = null; throw err; });
    }
    return markupPromise;
  }

  // ─── Seletor de Cosmofield ─────────────────────────────────────────────

  function renderSelectorItems(menu) {
    const list = devices();
    const current = currentIndex();
    // Sempre em ordem alfabética; o índice segue o da fazenda.
    menu.innerHTML = list.length
      ? (G().alphabeticalDevices?.(list) || list.map((device, index) => ({ device, index })))
        .map(({ device: equip, index }) => `<button type="button" class="cosmofield-details-selector__item ${index === current ? "is-selected" : ""}" data-cfd-index="${index}">${escapeHtml(equip.name || `Cosmofield ${index + 1}`)}</button>`).join("")
      : `<div class="cosmofield-details-selector__empty">${escapeHtml(t("Nenhum Cosmofield"))}</div>`;
  }

  function closeSelector() {
    const menu = $("cfdSelectorMenu");
    if (menu) menu.style.display = "none";
    $("cfdSelectBtn")?.classList.remove("is-active");
  }

  // ─── Minimapa ──────────────────────────────────────────────────────────

  function deviceCenter(equip) {
    const lat = num(equip?.data?.lat);
    const lng = num(equip?.data?.lng);
    if (lat !== null && lng !== null) return { lat, lng };
    return window.IcGeo?.parseLatLng?.(equip?.data?.loc || "") || null;
  }

  function destroyMinimap() {
    if (!minimap) return;
    try { minimap.off(); minimap.remove(); } catch (_) { }
    minimap = null;
  }

  function initMinimap(equip) {
    const el = $("cfdMinimap");
    if (!el || !window.L) return;

    // Instância "fantasma" de uma montagem anterior: só reaproveita se o
    // container for o mesmo (mesma correção do Carretel/Estação).
    if (minimap && minimap.getContainer?.() !== el) destroyMinimap();
    if (!minimap) {
      minimap = L.map(el, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, tap: false });
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 20 }).addTo(minimap);
      L.tileLayer("https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, opacity: 0.85 }).addTo(minimap);
    }
    minimap.eachLayer((layer) => { if (layer instanceof L.Marker) minimap.removeLayer(layer); });
    setTimeout(() => minimap?.invalidateSize(), 60);

    const center = equip ? deviceCenter(equip) : null;
    if (center) {
      const reading = getReading(equip);
      const icon = window.IcMapIcons?.cosmofieldIcon?.({
        color: reading?.statusColor || "",
        alert: reading?.status === "alert",
      });
      L.marker([center.lat, center.lng], icon ? { icon, interactive: false } : { interactive: false }).addTo(minimap);
      minimap.setView([center.lat, center.lng], 16);
    } else {
      minimap.setView([-15.79, -47.88], 4);
    }
  }

  // ─── Cabeçalho: título, status, última comunicação ─────────────────────

  function renderHeader(equip) {
    const reading = getReading(equip);
    setText("cfdTitleLabel", equip?.name || (equip ? "Cosmofield" : t("Nenhum Cosmofield")));

    // Mesmo status do selo do tooltip no mapa (IcCosmofieldStatus, em
    // mapa.js): o alerta, se houver, ou a água disponível.
    const status = (reading && window.IcCosmofieldStatus?.(reading)) || { cls: "is-success", label: "" };
    const bar = $("cfdStatusBar");
    if (bar) {
      bar.classList.remove("is-info", "is-warning", "is-danger", "is-neutral", "is-success");
      bar.classList.add(status.cls);
      // display:flex da barra vence o atributo hidden.
      bar.style.display = equip ? "" : "none";
    }
    // O selo segue a cor do ícone (escala RdYlGn ou vermelho nos alertas).
    if (bar) bar.style.background = status.style ? status.style.match(/background:([^;]+)/)?.[1] || "" : "";
    if (bar) bar.style.color = status.style ? status.style.match(/color:([^;]+)/)?.[1] || "" : "";
    setText("cfdStatusText", status.label);

    // Mesmo instante que o KPI "Última transmissão" (renderDeviceData).
    const footer = $("cfdLastUpdate");
    if (footer) {
      const commDate = reading ? new Date(Date.now() - (reading.minutesSince ?? 30) * 60000) : null;
      const utils = window.IcEquipUtils;
      const formatted = commDate
        ? (utils?.formatLastUpdate?.(commDate) ?? utils?.formatLastComm?.(commDate) ?? commDate.toLocaleString())
        : "—";
      footer.innerHTML = `<span class="comm-label">${escapeHtml(t("Última comunicação:"))}</span> ${escapeHtml(formatted)}`;
    }
  }

  // ─── Período (janela visível do gráfico) ───────────────────────────────

  function fmtDay(date) {
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }

  function isoDay(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // O filtro de período é o único controle de janela da tela (o gráfico
  // não tem zoom nem navegador aqui). O gatilho carrega o início e o fim
  // da série — é o que faz o popover oferecer "Todo o período" — e o
  // gráfico abre no período global, como as outras telas de detalhes
  // (padrão da plataforma: últimos 7 dias).
  // O padrão da tela é "Todo o período" (da primeira leitura até hoje).
  // O filtro é global na plataforma, então o período anterior é guardado e
  // devolvido ao fechar a tela.
  let previousPeriod = null;

  function syncPeriodWithChart(resetToAll = false) {
    const btn = $("cfdPeriodBtn");
    const full = window.IcCosmofieldChart?.getSeries?.({ full: true });
    if (btn && full?.total) {
      btn.dataset.periodAllStart = isoDay(full.dates[0]);
      btn.dataset.periodAllEnd = isoDay(full.dates[full.total - 1]);
    }
    if (resetToAll && full?.total) {
      if (!previousPeriod) previousPeriod = window.Plv?.period?.getPeriod?.() || null;
      window.Plv?.period?.setPeriod?.(new Date(full.dates[0]), new Date(full.dates[full.total - 1]), "cosmofield-default");
    }
    const current = window.Plv?.period?.getPeriod?.();
    if (current?.start && current?.end) window.IcCosmofieldChart?.setRange?.(current.start, current.end);
  }

  function renderPeriod() {
    if (!getSelected()) return;
    const series = window.IcCosmofieldChart?.getSeries?.();
    if (!series || !series.total) return;

    // Mesmo formato que o popover escreve no gatilho (feature.periodPicker
    // syncUI), mas sempre com a janela real do gráfico — se o período
    // escolhido passar do que a série cobre, o rótulo mostra o recorte.
    setText("cfdPeriodLabel", `${fmtDay(series.dates[0])} - ${fmtDay(series.dates[series.total - 1])}`);
  }

  // ─── Render geral ──────────────────────────────────────────────────────

  // Os 4 KPIs do pincard (os do card da lista) repetem os da linha de
  // indicadores, que renderDeviceData preenche: copia valor e o cinza de
  // "sem comunicação", em vez de calcular de novo.
  const CARD_KPIS = ["Moisture", "Blade", "Battery", "Next"];
  function copyCardKpis() {
    CARD_KPIS.forEach((key) => {
      const src = $("cfKpi" + key);
      const dst = $("cfdKpi" + key);
      if (!src || !dst) return;
      dst.innerHTML = src.innerHTML;
      dst.classList.toggle("is-stale", src.classList.contains("is-stale"));
    });
  }

  function renderData(resetPeriod = false) {
    const r = root();
    if (!r) return;
    const equip = getSelected();

    renderHeader(equip);
    if (equip) {
      // O gráfico vem primeiro: KPIs, tabela e calendário leem a série
      // dele (mesma ordem do selectDevice da aba Geral).
      window.IcCosmofieldChart?.init(r, G().chartConfig?.(equip, currentIndex()));
      syncPeriodWithChart(resetPeriod === true);
      G().renderDeviceData?.(r);
      copyCardKpis();
      G().renderRawData?.(r);
      G().renderCalendar?.(r);
      renderPeriod();
    }
    initMinimap(equip);
  }

  // Remonta a tela inteira a partir do markup em cache. Usado ao abrir, ao
  // trocar de sonda e ao voltar do Editar: o gráfico registra listeners no
  // próprio card a cada init, então reiniciá-lo sobre o mesmo DOM dobraria
  // os cliques da legenda e do zoom — com DOM novo, cada montagem começa
  // limpa.
  async function mount({ resetPeriod = false } = {}) {
    const slot = $("pageSlot");
    if (!slot) return false;
    const html = markupText ?? await loadMarkup();
    closeSelector();
    slot.innerHTML = html;
    bindEvents();
    renderData(resetPeriod);
    window.dispatchEvent(new Event("ic:layout-change"));
    return true;
  }

  // Filtro de período (popover global) → janela do gráfico. Só age com a
  // tela montada; o setWindow do gráfico dispara ic:cosmofield-window, que
  // atualiza tabela e rótulo logo abaixo.
  document.addEventListener("pluv:periodChanged", (event) => {
    if (!root() || !getSelected()) return;
    const { start, end } = event.detail || {};
    if (!start || !end) return;
    window.IcCosmofieldChart?.setRange?.(start, end);
  });

  // Zoom/navegador do gráfico (ou o setRange acima) mudou a janela.
  window.addEventListener("ic:cosmofield-window", () => {
    const r = root();
    if (!r || !getSelected()) return;
    G().renderRawData?.(r);
    renderPeriod();
  });

  // ─── Eventos ───────────────────────────────────────────────────────────

  function bindEvents() {
    const r = root();
    if (!r) return;

    r.querySelectorAll(".js-cosmofield-details-back").forEach((btn) => btn.addEventListener("click", () => {
      window.IcCosmofieldDetails.close();
      document.querySelector('.nav__item[data-route="visao-geral"]')?.click();
    }));

    $("cfdEditBtn")?.addEventListener("click", () => {
      const equip = getSelected();
      if (!equip) return;
      // Configurações/Histórico como overlay por cima dos Detalhes (padrão
      // do Editar da Estação/Pivô/Carretel).
      window.IcCosmofieldEdit?.open?.({ equipId: equip.id, tab: "config" });
    });

    const menu = $("cfdSelectorMenu");
    if (menu) {
      if (selectorOutsideClickHandler) document.removeEventListener("click", selectorOutsideClickHandler);
      selectorOutsideClickHandler = (event) => {
        const btn = event.target.closest("#cfdSelectBtn");
        if (btn) {
          event.stopPropagation();
          const hidden = getComputedStyle(menu).display === "none";
          if (hidden) renderSelectorItems(menu);
          menu.style.display = hidden ? "flex" : "none";
          btn.classList.toggle("is-active", hidden);
          return;
        }
        if (!menu.contains(event.target)) closeSelector();
      };
      document.addEventListener("click", selectorOutsideClickHandler);

      menu.addEventListener("click", (event) => {
        const item = event.target.closest("[data-cfd-index]");
        if (!item) return;
        event.stopPropagation();
        const index = Number(item.dataset.cfdIndex);
        closeSelector();
        if (index === currentIndex()) return;
        G().setDeviceIndex?.(index);
        mount({ resetPeriod: true }).catch((err) => console.error("[cosmofield-details] Falha ao trocar de sonda", err));
      });
    }

    // Mesmos binds da aba Geral, sobre este root: calendário (navegação,
    // seletor de mês, clique no dia), "Adicionar evento" (só no card do
    // Calendário) + modal de lançamento, exportação e ajuda do gráfico.
    G().bindCalendar?.(r);
    G().bindExportModal?.(r);
    G().bindInfoModal?.(r);

    // Popover de período compartilhado — idempotente, já costuma estar
    // ligado pela Pluviometria.
    try { window.Plv?.periodPicker?.initPeriodPicker?.(); } catch (_) { }
  }

  // ─── Ciclo de vida ─────────────────────────────────────────────────────

  window.IcCosmofieldDetails = {
    async open(options = {}) {
      G().focusDevice?.(options.equipId);
      const slot = $("pageSlot");
      if (!slot) return;
      window.IcCosmofieldEdit?.close?.({ silent: true });
      document.body.classList.remove("is-pivo-details-only");
      document.body.classList.add("is-pivo-details");
      try {
        await mount({ resetPeriod: true });
        // O mapa fica em cima (is-pivo-details): rola até a tela, venha o
        // clique do mapa, da lista ou do menu lateral.
        slot.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (err) {
        document.body.classList.remove("is-pivo-details");
        console.error("[cosmofield-details] Falha ao carregar cosmofield.details.html", err);
      }
    },

    close() {
      window.IcCosmofieldEdit?.close?.({ silent: true });
      if (selectorOutsideClickHandler) {
        document.removeEventListener("click", selectorOutsideClickHandler);
        selectorOutsideClickHandler = null;
      }
      destroyMinimap();
      // Só desmonta (e solta o layout de detalhes) se a tela montada for
      // esta — as rotas chamam close() de todo mundo antes de abrir a sua.
      const r = root();
      if (!r) return;
      const slot = $("pageSlot");
      if (slot && slot.contains(r)) slot.innerHTML = "";
      document.body.classList.remove("is-pivo-details");
      if (previousPeriod) {
        window.Plv?.period?.setPeriod?.(previousPeriod.start, previousPeriod.end, "cosmofield-restore");
        previousPeriod = null;
      }
    },

    // Volta do Editar: o que foi salvo (solo, cultura, escala, sonda
    // escolhida no seletor do painel) aparece nos Detalhes.
    refresh() {
      if (!root()) return;
      mount().catch((err) => console.error("[cosmofield-details] Falha ao atualizar", err));
    },

    renderData: () => renderData(),
  };
})();
