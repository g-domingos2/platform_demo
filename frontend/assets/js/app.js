// assets/js/app.js
(function appRouter() {
  "use strict";

  const nav = document.querySelector(".sidebar__nav");
  if (!nav) return;

  function setActive(route) {
    document.querySelectorAll(".nav__item, .sidebar__footer-btn").forEach((a) => {
      a.classList.toggle("is-active", a.getAttribute("data-route") === route);
    });
  }

  function setWeatherCardVisibility(visible) {
    const weatherCard = document.getElementById("mapWeatherCard");
    if (weatherCard) weatherCard.style.display = visible ? "" : "none";
  }

  function syncMainRouteState(route) {
    const isVisaoGeral = route === "visao-geral" || route === "dashboard" || !route;
    document.body.classList.toggle("is-visao-geral", isVisaoGeral);
    document.body.classList.toggle("is-conectividade", route === "conectividade");
  }


  async function openFarmEditFallback() {
    document.body.classList.add("is-farm-edit");

    const mapCard = document.getElementById("mapCard");
    if (mapCard) mapCard.style.display = "none";

    const slot = document.getElementById("pageSlot");
    if (slot) {
      try {
        const html = await fetch("./pages/fazenda-edit.html").then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); });
        slot.innerHTML = html;
      } catch (_) {
        // silencioso: fallback visual mínimo
      }
    }

    window.dispatchEvent(new Event("ic:layout-change"));
  }

  function closeFarmEditFallback() {
    document.body.classList.remove("is-farm-edit");
    const slot = document.getElementById("pageSlot");
    if (slot) slot.innerHTML = "";
    const mapCard = document.getElementById("mapCard");
    if (mapCard) mapCard.style.display = "";
    const map = window.icMap;
    if (map && typeof map.invalidateSize === "function") {
      map.invalidateSize({ pan: false });
      requestAnimationFrame(() => map.invalidateSize({ pan: false }));
      setTimeout(() => map.invalidateSize({ pan: false }), 180);
    }
  }

  function ensureFarmEditClosed() {
    if (document.body.classList.contains("is-farm-edit")) {
      closeFarmEditFallback();
      window.IcConfig?.close?.();
    }
  }

  function resetPivoDetailsOnlyLayout() {
    document.body.classList.remove("is-pivo-details-only");
  }

  function applyPivoDetailsOnlyLayout() {
    document.body.classList.add("is-pivo-details-only");
  }

  function getPreferredFarmFromList(farms) {
    const list = Array.isArray(farms) ? farms : [];
    if (!list.length) return null;
    const scoreFarm = (farm) => {
      const equipments = Array.isArray(farm?.equipments) ? farm.equipments : [];
      const pivos = Array.isArray(farm?.pivos) ? farm.pivos : [];
      const pivotCount = equipments.filter((equip) => {
        const type = String(equip?.type || "").toLowerCase();
        const category = String(equip?.category || "").toLowerCase();
        return category === "pivos" || type === "smart_connect" || type === "smarttouch" || type === "linestar";
      }).length + pivos.length;
      return (pivotCount * 1000) + equipments.length;
    };
    return list.slice().sort((farmA, farmB) => scoreFarm(farmB) - scoreFarm(farmA))[0] || list[0];
  }

  function syncGlobalActiveFarmFromDataset() {
    const farms = window.Cad?.data?.getAllFarms?.() || [];
    window.IcFarmsAll = farms;
    if (!farms.length) {
      window.IcFarmActive = null;
      return null;
    }

    const savedFarmId = sessionStorage.getItem("ic_active_farm") || sessionStorage.getItem("ic_active_farm_id");
    const savedFarm = savedFarmId
      ? farms.find((farm) => String(farm?.id || "") === String(savedFarmId))
      : null;
    const activeFarm = savedFarm || getPreferredFarmFromList(farms) || farms[0];

    if (activeFarm?.id) {
      sessionStorage.setItem("ic_active_farm", String(activeFarm.id));
      sessionStorage.setItem("ic_active_farm_id", String(activeFarm.id));
    }

    const currentActiveId = String(window.IcFarmActive?.id || "");
    if (!currentActiveId || currentActiveId !== String(activeFarm?.id || "")) {
      window.IcFarmActive = activeFarm || null;
    }

    return activeFarm || null;
  }

  function renderDashboardView(fitToItems = false) {
    const activeFarm = syncGlobalActiveFarmFromDataset();

    if (activeFarm && typeof window.CreateFarm?.events?.selectFarm === "function") {
      window.CreateFarm.events.selectFarm(activeFarm.id);
    } else if (activeFarm) {
      window.CreateFarm?.view?.render?.updateActiveFarm?.();
      window.CreateFarm?.view?.render?.renderEquipmentPanels?.(activeFarm);
      window.IcMapRenderPivots?.(activeFarm, { fitToItems });
    }

    window.IcPluviometria?.initDashboardMode?.();
    window.IcChuvaGeo?.open?.();

    const allFarms = window.Cad?.data?.getAllFarms?.() || [];
    if (window.IcMapRenderPivots) {
      if (allFarms.length > 1 && !document.body.classList.contains("is-conectividade")) {
        const merged = {
          equipments: allFarms.flatMap((f) => (Array.isArray(f.equipments) ? f.equipments : [])),
          pivos: allFarms.flatMap((f) => (Array.isArray(f.pivos) ? f.pivos : [])),
        };
        window.IcMapRenderPivots(merged, { fitToItems });
      } else {
        const farmToRender = window.IcFarmGetActive?.() || activeFarm || allFarms[0];
        if (farmToRender) window.IcMapRenderPivots(farmToRender, { fitToItems });
      }
    }
    window.IcMapSimulation?.refresh?.();

    const map = window.icMap;
    if (map && typeof map.invalidateSize === 'function') {
      map.invalidateSize({ pan: false });
      requestAnimationFrame(() => map.invalidateSize({ pan: false }));
      setTimeout(() => map.invalidateSize({ pan: false }), 180);
      setTimeout(() => map.invalidateSize({ pan: false }), 400);
    }
  }

  function safeRun(label, fn) {
    try {
      return typeof fn === "function" ? fn() : undefined;
    } catch (err) {
      console.error(`Failed to ${label}:`, err);
      return undefined;
    }
  }

  function resetOverviewShell() {
    const mapCard = document.getElementById("mapCard");
    if (mapCard) mapCard.style.display = "";

    const weatherCard = document.getElementById("mapWeatherCard");
    if (weatherCard) weatherCard.style.display = "";

    const slot = document.getElementById("pageSlot");
    if (slot) slot.innerHTML = "";

    document.body.classList.remove(
      "is-pluvd",
      "is-bmbd",
      "is-estd",
      "is-mdnd",
      "is-pivo-details",
      "is-pivo-details-only",
      "is-pluviometria",
      "is-pluviometria-edit",
      "is-pivo-edit",
      "is-bmb-edit",
      "is-mdn-edit",
      "pluv-panel-open",
      "is-conectividade",
      "is-monitoramento",
      "is-relatorios",
      "is-gestao",
      "is-telemetria"
    );
  }

  function go(route, options) {
    syncMainRouteState(route);
    window.dispatchEvent(new CustomEvent("ic:route-change", {
      detail: { route: route || "dashboard" }
    }));
    setWeatherCardVisibility(!route || route === "dashboard" || route === "visao-geral");
    if (route !== "hidrica") {
      resetPivoDetailsOnlyLayout();
    }
    if (route === 'pluviometria') {
      setActive('pluviometria');
      document.body.classList.remove('is-pivo-edit', 'is-pluviometria-edit', 'is-bmb-edit', 'is-mdn-edit');
      try { window.IcFarmEdit?.close?.(); } catch (_) { closeFarmEditFallback(); }
      ensureFarmEditClosed();
      window.IcPluvDetails?.close?.();
      safeRun("close detalhes de medidor", () => window.IcMdnDetails?.close?.());
      safeRun("close detalhes de bomba", () => window.IcBombaDetails?.close?.());
      window.IcEstacaoDetails?.close?.();
      window.IcCosmofieldDetails?.close?.();
      window.IcGestao?.close?.();
      window.IcChuvaGeo?.close?.();
      window.IcRelatorios?.close?.();
      window.IcTalhoes?.close?.();
      window.IcPivos?.close?.();
      window.IcMonitoramento?.close?.();
      window.IcTelemetria?.close?.();
      window.IcFaturamento?.close?.();
      window.IcNotificacoes?.close?.();
      window.IcPluviometria?.open?.();
      return;
    }
    if (route === 'relatorios') {
      setActive('relatorios');
      try { window.IcFarmEdit?.close?.(); } catch (_) { closeFarmEditFallback(); }
      ensureFarmEditClosed();
      window.IcPluvDetails?.close?.();
      window.IcMdnDetails?.close?.();
      window.IcBombaDetails?.close?.();
      window.IcEstacaoDetails?.close?.();
      window.IcCosmofieldDetails?.close?.();
      window.IcGestao?.close?.();
      window.IcPluviometria?.close?.();
      window.IcChuvaGeo?.close?.();
      window.IcTalhoes?.close?.();
      window.IcPivos?.close?.();
      window.IcMonitoramento?.close?.();
      window.IcTelemetria?.close?.();
      window.IcFaturamento?.close?.();
      window.IcNotificacoes?.close?.();
      window.IcRelatorios?.open?.(options || {});
      return;
    }
    if (route === 'fazenda') {
      setActive('fazenda');
      window.IcPluvDetails?.close?.();
      window.IcMdnDetails?.close?.();
      window.IcBombaDetails?.close?.();
      window.IcEstacaoDetails?.close?.();
      window.IcCosmofieldDetails?.close?.();
      window.IcConfig?.close?.();
      window.IcPluviometria?.close?.();
      window.IcChuvaGeo?.close?.();
      window.IcGestao?.close?.();
      window.IcRelatorios?.close?.();
      window.IcTalhoes?.close?.();
      window.IcPivos?.close?.();
      window.IcMonitoramento?.close?.();
      window.IcTelemetria?.close?.();
      window.IcFaturamento?.close?.();
      window.IcNotificacoes?.close?.();
      // DEMO: o painel oficial já monta o HTML e preenche os campos; rodar o
      // fallback em paralelo remontava o HTML vazio por cima (nome em branco).
      if (window.IcFarmEdit?.open) {
        Promise.resolve(window.IcFarmEdit.open()).catch(() => openFarmEditFallback());
        // o painel pode já ter sido aberto pelo listener do próprio item; os
        // close() acima (ex.: notificações) tiram a classe — recoloca.
        document.body.classList.add("is-farm-edit");
        const mapCardEl = document.getElementById("mapCard");
        if (mapCardEl) mapCardEl.style.display = "none";
      } else {
        openFarmEditFallback();
      }
      return;
    }
    if (route === 'talhoes') {
      setActive('talhoes');
      try { window.IcFarmEdit?.close?.(); } catch (_) { closeFarmEditFallback(); }
      ensureFarmEditClosed();
      window.IcPluvDetails?.close?.();
      window.IcMdnDetails?.close?.();
      window.IcBombaDetails?.close?.();
      window.IcEstacaoDetails?.close?.();
      window.IcCosmofieldDetails?.close?.();
      window.IcGestao?.close?.();
      window.IcPluviometria?.close?.();
      window.IcChuvaGeo?.close?.();
      window.IcRelatorios?.close?.();
      window.IcPivos?.close?.();
      window.IcMonitoramento?.close?.();
      window.IcTelemetria?.close?.();
      window.IcFaturamento?.close?.();
      window.IcNotificacoes?.close?.();
      window.IcTalhoes?.open?.();
      return;
    }

    if (route === 'usuarios') {
      setActive('usuarios');
      try { window.IcFarmEdit?.close?.(); } catch (_) { closeFarmEditFallback(); }
      window.IcConfig?.close?.();

      document.body.classList.add("is-farm-edit");
      const mapCard = document.getElementById("mapCard");
      if (mapCard) mapCard.style.display = "none";

      window.IcPluviometria?.close?.();
      window.IcGestao?.close?.();
      window.IcChuvaGeo?.close?.();
      window.IcRelatorios?.close?.();
      window.IcTalhoes?.close?.();
      window.IcPivos?.close?.();
      window.IcMonitoramento?.close?.();
      window.IcTelemetria?.close?.();
      window.IcFaturamento?.close?.();
      window.IcNotificacoes?.close?.();

      const slot = document.getElementById("pageSlot");
      if (slot) {
        fetch("./pages/usuarios.html")
          .then(r => r.text())
          .then(html => {
            slot.innerHTML = html;
            window.dispatchEvent(new Event("ic:layout-change"));
          });
      }
      return;
    }

    if (route === 'gestao') {
      setActive('gestao');
      try { window.IcFarmEdit?.close?.(); } catch (_) { closeFarmEditFallback(); }
      ensureFarmEditClosed();
      window.IcPluvDetails?.close?.();
      window.IcMdnDetails?.close?.();
      window.IcBombaDetails?.close?.();
      window.IcEstacaoDetails?.close?.();
      window.IcCosmofieldDetails?.close?.();
      window.IcPluviometria?.close?.();
      window.IcChuvaGeo?.close?.();
      window.IcRelatorios?.close?.();
      window.IcTalhoes?.close?.();
      window.IcPivos?.close?.();
      window.IcMonitoramento?.close?.();
      window.IcTelemetria?.close?.();
      window.IcFaturamento?.close?.();
      window.IcNotificacoes?.close?.();
      window.IcGestao?.open?.();
      return;
    }

    if (route === 'hidrica') {
      setActive('hidrica');
      try { window.IcFarmEdit?.close?.(); } catch (_) { closeFarmEditFallback(); }
      ensureFarmEditClosed();
      window.IcGestao?.close?.();
      window.IcPluviometria?.close?.();
      window.IcChuvaGeo?.close?.();
      window.IcRelatorios?.close?.();
      window.IcTalhoes?.close?.();
      window.IcPivos?.close?.();
      window.IcMonitoramento?.close?.();
      window.IcTelemetria?.close?.();
      window.IcFaturamento?.close?.();
      window.IcNotificacoes?.close?.();
      const pivos = window.IcPivos;
      if (pivos && typeof pivos.open === "function") {
        applyPivoDetailsOnlyLayout();
        const openPromise = pivos.open();
        if (openPromise && typeof openPromise.catch === "function") {
          openPromise.catch(() => resetPivoDetailsOnlyLayout());
        }
      } else {
        resetPivoDetailsOnlyLayout();
      }
      return;
    }

    if (route === 'monitoramento') {
      setActive(route);
      try { window.IcFarmEdit?.close?.(); } catch (_) { closeFarmEditFallback(); }
      ensureFarmEditClosed();
      window.IcGestao?.close?.();
      window.IcPluviometria?.close?.();
      window.IcChuvaGeo?.close?.();
      window.IcRelatorios?.close?.();
      window.IcTalhoes?.close?.();
      window.IcPivos?.close?.();
      window.IcFaturamento?.close?.();
      window.IcNotificacoes?.close?.();
      window.IcMonitoramento?.open?.();

      const map = window.icMap;
      if (map && typeof map.invalidateSize === "function") {
        requestAnimationFrame(() => map.invalidateSize({ pan: false }));
        setTimeout(() => map.invalidateSize({ pan: false }), 180);
      }
      return;
    }

    if (route === 'faturamento') {
      // Bloqueado até destravar (Ctrl+D): não abre nem marca ativo, mas o
      // hover/tooltip continua funcionando (o botão não tem pointer-events:none).
      const fbtn = document.querySelector('.sidebar__footer-btn[data-route="faturamento"]');
      if (fbtn && fbtn.classList.contains('is-locked')) return;
      // Faturamento abre como overlay por cima da página atual — não fecha as
      // demais páginas, para que o "Voltar" retorne exatamente à tela anterior.
      // Fecha o overlay de config ANTES (para não empilhar os dois) e o
      // open() roda antes do setActive para capturar a rota anterior correta.
      window.IcConfig?.close?.();
      window.IcFaturamento?.open?.();
      setActive('faturamento');
      return;
    }

    if (route === 'notificacoes') {
      setActive('notificacoes');
      try { window.IcFarmEdit?.close?.(); } catch (_) { closeFarmEditFallback(); }
      window.IcConfig?.close?.();
      window.IcGestao?.close?.();
      window.IcPluviometria?.close?.();
      window.IcChuvaGeo?.close?.();
      window.IcRelatorios?.close?.();
      window.IcTalhoes?.close?.();
      window.IcPivos?.close?.();
      window.IcMonitoramento?.close?.();
      window.IcTelemetria?.close?.();
      window.IcFaturamento?.close?.();
      window.IcCosmofield?.close?.();
      window.IcNotificacoes?.open?.();
      return;
    }

    // Cosmofield abre a tela de Detalhes (cockpit, no padrão da Estação) —
    // options.equipId vem do clique no mapa/lista/modal. O painel de
    // Configurações/Histórico abre pelo "Editar" dos Detalhes.
    if (route === 'cosmofield') {
      // Sem item próprio no menu: a tela de Detalhes abre sobre a Visão Geral,
      // como as demais telas de detalhes.
      setActive('visao-geral');
      try { window.IcFarmEdit?.close?.(); } catch (_) { closeFarmEditFallback(); }
      ensureFarmEditClosed();
      window.IcConfig?.close?.();
      window.IcGestao?.close?.();
      window.IcPluviometria?.close?.();
      window.IcChuvaGeo?.close?.();
      window.IcRelatorios?.close?.();
      window.IcTalhoes?.close?.();
      window.IcPivos?.close?.();
      window.IcMonitoramento?.close?.();
      window.IcTelemetria?.close?.();
      window.IcFaturamento?.close?.();
      window.IcNotificacoes?.close?.();
      window.IcPluvDetails?.close?.();
      window.IcMdnDetails?.close?.();
      window.IcBombaDetails?.close?.();
      window.IcEstacaoDetails?.close?.();
      window.IcCosmofieldDetails?.close?.();
      window.IcCosmofieldDetails?.open?.(options || {});
      return;
    }

    if (route === 'config') {
      // Config abre como overlay por cima da página atual — não fecha as demais
      // páginas, para que o "Voltar" retorne exatamente à tela anterior.
      // Fecha o overlay de faturamento ANTES (para não empilhar os dois) e o
      // open() roda antes do setActive para capturar a rota anterior correta.
      window.IcFaturamento?.close?.();
      window.IcConfig?.open?.();
      setActive('config');
      return;
    }

    if (route === 'telemetria' || route === 'conectividade') {
      const activeTab = route === 'telemetria' ? 'telemetria' : 'conectividade';
      setActive(activeTab);
      try { window.IcFarmEdit?.close?.(); } catch (_) { closeFarmEditFallback(); }
      ensureFarmEditClosed();
      window.IcPluvDetails?.close?.();
      window.IcMdnDetails?.close?.();
      window.IcBombaDetails?.close?.();
      window.IcEstacaoDetails?.close?.();
      window.IcCosmofieldDetails?.close?.();
      window.IcGestao?.close?.();
      window.IcPluviometria?.close?.();
      window.IcChuvaGeo?.close?.();
      window.IcRelatorios?.close?.();
      window.IcTalhoes?.close?.();
      window.IcPivos?.close?.();
      window.IcMonitoramento?.close?.();
      window.IcTelemetria?.close?.();
      window.IcFaturamento?.close?.();
      window.IcNotificacoes?.close?.();
      window.IcCosmofield?.close?.();

      if (route === 'conectividade') {
         renderDashboardView(true);
      } else {
         window.IcTelemetria?.open?.();
      }
      return;
    }


    if (route === 'visao-geral' || route === 'dashboard' || !route) {
      setActive('visao-geral');
      try { window.IcFarmEdit?.close?.(); } catch (_) { closeFarmEditFallback(); }
      ensureFarmEditClosed();
      safeRun("close gestão", () => window.IcGestao?.close?.());
      safeRun("close config", () => window.IcConfig?.close?.());
      safeRun("close notificacoes", () => window.IcNotificacoes?.close?.());
      safeRun("close cosmofield", () => window.IcCosmofield?.close?.());
      safeRun("close faturamento", () => window.IcFaturamento?.close?.());
      safeRun("close pluviometria", () => window.IcPluviometria?.close?.());
      safeRun("close relatórios", () => window.IcRelatorios?.close?.());
      safeRun("close talhões", () => window.IcTalhoes?.close?.());
      safeRun("close pivôs", () => window.IcPivos?.close?.());
      safeRun("close monitoramento", () => window.IcMonitoramento?.close?.());
      safeRun("close telemetria", () => window.IcTelemetria?.close?.());
      window.IcPluvDetails?.close?.(); // fecha tela de detalhes do pluviômetro se estiver aberta
      window.IcMdnDetails?.close?.();
      window.IcBombaDetails?.close?.();
      window.IcEstacaoDetails?.close?.(); // fecha tela de detalhes do medidor se estiver aberta
      window.IcCosmofieldDetails?.close?.();

      // Garante que mapCard está visível
      resetOverviewShell();
      const mapCard = document.getElementById('mapCard');
      if (mapCard) mapCard.style.display = '';

      // Garante que pageSlot está limpo
      const slot = document.getElementById('pageSlot');
      if (slot) slot.innerHTML = '';

      // Remove classes de estado residuais
      document.body.classList.remove('is-pluvd', 'is-bmbd', 'is-estd', 'is-mdnd', 'is-pivo-details', 'is-pivo-details-only', 'is-pluviometria', 'is-pluviometria-edit', 'is-pivo-edit', 'is-bmb-edit', 'is-mdn-edit', 'pluv-panel-open', 'is-conectividade', 'is-monitoramento', 'is-relatorios', 'is-gestao', 'is-telemetria');


      if (window.IC_API_CONFIG?.usesStaticData && typeof window.Cad?.data?.loadFarmDataset === "function") {
        (async () => {
          try {
            await window.Cad.data.loadFarmDataset();
          } catch (err) {
            console.error("Failed to load farm dataset:", err);
          }
          try {
            if (typeof window.CreateFarm?.events?.loadFarms === "function") {
              await window.CreateFarm.events.loadFarms();
            }
          } catch (err) {
            console.error("Failed to load farms:", err);
          }
          renderDashboardView();
        })();
        return;
      }

      renderDashboardView(true);
      return;
    }

    // default: volta para o mapa normal
    setActive('mapa');
    try { window.IcFarmEdit?.close?.(); } catch (_) { closeFarmEditFallback(); }
    ensureFarmEditClosed();
    window.IcGestao?.close?.();
    window.IcConfig?.close?.();
    window.IcPluviometria?.close?.();
    window.IcChuvaGeo?.close?.();
    window.IcRelatorios?.close?.();
    window.IcTalhoes?.close?.();
    window.IcPivos?.close?.();
    window.IcMonitoramento?.close?.();
    window.IcTelemetria?.close?.();
    window.IcNotificacoes?.close?.();
    window.IcCosmofield?.close?.();
    const map = window.icMap;
    if (map && typeof map.invalidateSize === "function") {
      requestAnimationFrame(() => map.invalidateSize({ pan: false }));
      setTimeout(() => map.invalidateSize({ pan: false }), 180);
    }
  }
  const sidebar = document.querySelector(".sidebar");
  if (sidebar) {
    sidebar.addEventListener("click", (e) => {
      if (e.target.closest("[data-demo-locked]")) { e.preventDefault(); e.stopPropagation(); return; }
      const item = e.target.closest("[data-route]");
      if (!item) return;

      const route = item.getAttribute("data-route");
      if (!route) return;

      e.preventDefault();

      const app = document.querySelector(".app");
      if (item.id === "btnSettings" && app && app.classList.contains("is-collapsed")) {
        app.classList.remove("is-collapsed");
        localStorage.setItem("ic_sidebar_collapsed", "0");
        window.dispatchEvent(new CustomEvent("ic:layout-change", { detail: { sidebarCollapsed: false } }));
        return;
      }

      go(route);
    });
  }

  // Expose router for pages loaded dynamically (ex: cadastros back button)
  window.IcNavigate = go;

  // Garante que itens "em breve" iniciam desativados, exceto se dev features já estiver ligado (persistido via Ctrl+D)
  document.querySelectorAll(".nav__item .nav__badge--soon").forEach(function(badge) {
    var navItem = badge.closest(".nav__item"); navItem.classList.toggle("is-disabled", !window.__icDevFeaturesOn || navItem.hasAttribute("data-demo-locked"));
  });
  var btnWeeklyScheduleInit = document.getElementById("btnWeeklySchedule");
  if (btnWeeklyScheduleInit) btnWeeklyScheduleInit.classList.toggle("is-hidden", !window.__icDevFeaturesOn);

  // Elementos genéricos marcados [data-dev-only] (ex.: aba "Geral" da Estação
  // Meteorológica, guardada pra virar a tela de Detalhes) — mesmo padrão do
  // nav__badge--soon/btnWeeklySchedule acima, só que reutilizável por
  // qualquer tela sem precisar tocar neste arquivo de novo. Como algumas
  // dessas telas carregam depois deste init (via #pageSlot), cada tela
  // também deve reaplicar esse mesmo toggle quando renderiza.
  document.querySelectorAll("[data-dev-only]").forEach(function(el) {
    el.classList.toggle("is-hidden", !window.__icDevFeaturesOn);
  });

  // Ctrl+D — liga/desliga recursos ocultos (dev shortcut). Troca instantânea, sem reload:
  // op-modal/op-programacoes legacy e dev ficam ambos carregados e o IcOpRouter decide
  // em tempo real qual motor está ativo (ver assets/js/core/op-router.js).
  document.addEventListener("keydown", function(e) {
    if (e.ctrlKey && e.key === "d") {
      e.preventDefault();
      var next = window.IcOpRouter.active === "dev" ? "legacy" : "dev";
      window.IcOpRouter.setActive(next);
      window.__icDevFeaturesOn = next === "dev";
      document.querySelectorAll(".nav__item .nav__badge--soon").forEach(function(badge) {
        var navItem = badge.closest(".nav__item"); navItem.classList.toggle("is-disabled", !window.__icDevFeaturesOn || navItem.hasAttribute("data-demo-locked"));
      });
      var btnWeekly = document.getElementById("btnWeeklySchedule");
      if (btnWeekly) btnWeekly.classList.toggle("is-hidden", !window.__icDevFeaturesOn);
      document.querySelectorAll("[data-dev-only]").forEach(function(el) {
        el.classList.toggle("is-hidden", !window.__icDevFeaturesOn);
      });
    }
  });

  // rota inicial: agora carrega como dashboard para ativar pluviometria por padrão
  go("dashboard");
})();
