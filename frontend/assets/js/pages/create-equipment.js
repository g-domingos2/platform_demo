// assets/js/pages/create-equipment.js
(function initCreateEquipment() {
  "use strict";

  // =========================
  // DOM refs
  // =========================
  const openBtn = document.getElementById("btnCreateEquipment");
  const modal = document.getElementById("createEquipmentModal");
  const nextBtn = document.getElementById("btnCreateEquipNext");
  const prevBtn = document.getElementById("btnCreateEquipPrev");
  const stepsContainer = document.getElementById("createEquipSteps");
  const footer = document.getElementById("createEquipFooter");
  const titleEl = document.getElementById("createEquipTitle");

  if (!openBtn || !modal || !nextBtn || !stepsContainer) return;

  const closeTriggers = modal.querySelectorAll("[data-close-create]");
  const cards = Array.from(modal.querySelectorAll(".create-equip__card"));
  const BASE_TITLE = "Criar equipamento";
  // textContent não passa pela varredura do DOM feita pelo i18n: estes
  // textos são atribuídos em JS e precisam do t() explícito.
  const tCe = (text) => window.IcI18n?.t?.(text) ?? text;
  const EN_TYPES = new Set([]);

  // =========================
  // Dynamic host (telas 2..N)
  // =========================
  let dynamicHost = modal.querySelector(".create-equip__dynamic");
  if (!dynamicHost) {
    dynamicHost = document.createElement("div");
    dynamicHost.className = "create-equip__dynamic";
    const grid = modal.querySelector(".create-equip__grid");
    grid?.after(dynamicHost);
  }

  // =========================
  // Tooltips flutuantes (position:fixed) — escapam do overflow/scroll
  // do modal e ficam sempre por cima de tudo. Substituem o balão CSS
  // (::before) que era cortado pela área rolável dos steps.
  // =========================
  (function setupFloatingTooltips() {
    let tipEl = null;

    function ensureTip() {
      if (tipEl) return tipEl;
      tipEl = document.createElement("div");
      tipEl.className = "ce-tooltip";
      document.body.appendChild(tipEl);
      return tipEl;
    }

    function showTip(icon) {
      const text = icon.getAttribute("data-tooltip");
      if (!text) return;
      const tip = ensureTip();
      tip.textContent = text;
      tip.classList.add("is-visible");

      const r = icon.getBoundingClientRect();
      const margin = 8;
      const tw = tip.offsetWidth;
      const th = tip.offsetHeight;

      let left = r.left + r.width / 2 - tw / 2;
      left = Math.max(margin, Math.min(left, window.innerWidth - tw - margin));

      // Prefere acima do ícone; se não couber, posiciona abaixo.
      let top = r.top - th - margin;
      let placement = "top";
      if (top < margin) {
        top = r.bottom + margin;
        placement = "bottom";
      }

      tip.style.left = `${Math.round(left)}px`;
      tip.style.top = `${Math.round(top)}px`;
      tip.dataset.placement = placement;
      tip.style.setProperty("--ce-tip-arrow", `${Math.round(r.left + r.width / 2 - left)}px`);
    }

    function hideTip() {
      if (tipEl) tipEl.classList.remove("is-visible");
    }

    modal.addEventListener("mouseover", (e) => {
      const icon = e.target.closest?.(".edit-panel__tooltip-icon[data-tooltip]");
      if (icon) showTip(icon);
    });
    modal.addEventListener("mouseout", (e) => {
      if (e.target.closest?.(".edit-panel__tooltip-icon[data-tooltip]")) hideTip();
    });
    // Some ao rolar os steps, redimensionar ou fechar.
    modal.addEventListener("scroll", hideTip, true);
    window.addEventListener("resize", hideTip);
  })();

  // =========================
  // State
  // =========================
  let selectedType = null;
  let currentStepIndex = 0;
  let lastFocusBeforeOpen = null;

  const THREE_STEPS = ["Equipamento", "Localização", "Configuração"];
  const THREE_STEPS_EN = ["Equipamento", "Localização", "Configuração"];
  const MDN_STEPS = ["Equipamento", "Localização", "Ficha Técnica", "Nível", "Conectividade"];
  const LINESTAR_STEPS = ["Equipamento", "Localização", "Área Irrigada", "Segmentos", "Posições Intermediárias", "Canhão", "Ficha Técnica", "Bombeamento", "Conectividade"];
  const FOUR_STEPS_ST = ["Equipamento", "Localização", "Ângulo", "Segmentos", "Canhão", "Ficha Técnica", "Bombeamento", "Conectividade"];
  const FOUR_STEPS_SC = ["Equipamento", "Localização", "Ângulo", "Segmentos", "Canhão", "Ficha Técnica", "Bombeamento", "Conectividade"];
  const TWO_STEPS = ["Equipamento", "Configuração"];
  const RAINSTAR_STEPS = ["Equipamento", "Ficha Técnica", "Pré e Pós-Irrigação", "Conectividade"];
  // Repetidora no padrão dos demais: Ficha Técnica + aba de Conectividade
  // (o rádio sai da "Configuração" e vira step próprio).
  const REPETIDORA_STEPS = ["Equipamento", "Localização", "Ficha Técnica", "Conectividade"];
  // Estação Davis não entra na malha (igual Cosmofield) — sem Conectividade.
  // Estação Davis: a localização vem automática da plataforma Davis — sem step de Localização.
  const ESTACAO_STEPS = ["Equipamento", "Ficha Técnica"];
  // Na versão 5.2 (GH) o vínculo do medidor de nível entra dentro da própria
  // Ficha Técnica (Step 3) — não existe mais um step separado pra isso.
  const IRRIPUMP_STEPS = ["Equipamento", "Localização", "Ficha Técnica", "Conectividade"];
  const SIX_STEPS = ["Equipamento", "Localização", "Módulos", "Funções", "Vincular equipamento", "Resumo"];
  const COSMOFIELD_STEPS = ["Equipamento", "Identificação", "Localização", "Solo", "Cultura", "Integração"];

  const stepFlows = {
    smart_connect: FOUR_STEPS_SC,
    smarttouch: FOUR_STEPS_ST,
    repetidora: REPETIDORA_STEPS,
    rainstar: RAINSTAR_STEPS,
    linestar: LINESTAR_STEPS,
    estacao_metereologica: ESTACAO_STEPS,
    cosmofield: COSMOFIELD_STEPS,
    pluviometro: THREE_STEPS,
    irripump: IRRIPUMP_STEPS,
    medidor: MDN_STEPS,
  };

  const stateByType = {};
  const equipSelectRegistry = new Set();
  let equipSelectListenersBound = false;
  let pivotListCache = null;
  let pivotListCacheFarmId = null;

  // =========================
  // Helpers
  // =========================
  function bindEquipSelectGlobalEvents() {
    if (equipSelectListenersBound) return;
    equipSelectListenersBound = true;

    document.addEventListener("click", (event) => {
      if (event.target.closest(".equip-select")) return;
      closeAllEquipSelects();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      closeAllEquipSelects();
    });

    let _resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(_resizeTimer);
      _resizeTimer = setTimeout(() => {
        equipSelectRegistry.forEach((select) => {
          if (select?._equipSelect?.wrapper.classList.contains("is-open")) {
            positionEquipSelectList(select);
          }
        });
      }, 150);
    });

    if (modal && !modal._equipSelectScrollBound) {
      modal._equipSelectScrollBound = true;
      modal.addEventListener(
        "scroll",
        (event) => {
          // Rolar dentro da própria lista aberta (.equip-select__list) não
          // deve fechá-la — só rolar o modal/formulário atrás dela. Sem este
          // filtro, o scroll (ou arrastar a scrollbar) dentro do dropdown de
          // opções fechava a lista no meio da rolagem.
          if (event.target.closest?.(".equip-select__list")) return;
          closeAllEquipSelects();
        },
        true
      );
    }
  }

  function closeEquipSelect(select) {
    const data = select?._equipSelect;
    if (!data) return;
    data.wrapper.classList.remove("is-open");
    data.trigger.setAttribute("aria-expanded", "false");
  }

  function closeAllEquipSelects(except) {
    equipSelectRegistry.forEach((select) => {
      if (select === except) return;
      closeEquipSelect(select);
    });
  }

  function positionEquipSelectList(select) {
    const data = select?._equipSelect;
    if (!data) return;
    const rect = data.trigger.getBoundingClientRect();
    const margin = 12;
    const spacing = 6;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const preferredMaxHeight = 240; // mesmo teto do .equip-select__list no CSS
    const spaceBelow = viewportHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
    // Nunca deixa a lista esticar até ocupar todo o espaço disponível — isso
    // fazia ela "pular" pro topo da tela quando o campo estava perto do fim
    // do painel (pouco espaço abaixo = spaceAbove gigante).
    const availableHeight = Math.min(preferredMaxHeight, Math.max(120, openUp ? spaceAbove : spaceBelow));
    // Usa a altura real do conteúdo (a lista já está com display:block nesse
    // ponto — is-open é aplicado antes de chamar isto) pra colar a lista
    // rente ao campo, em vez de reservar o espaço máximo disponível.
    // scrollHeight não conta a borda (border-box tira o espaço da borda do
    // conteúdo útil) — sem somar isso aqui, listas curtas (2-3 itens) ficam
    // com 1-2px de overflow "fantasma" da própria borda e mostram barra de
    // rolagem à toa, mesmo sem nenhum item cortado.
    const borderVertical = data.list.offsetHeight - data.list.clientHeight;
    const contentHeight = data.list.scrollHeight
        ? data.list.scrollHeight + borderVertical
        : availableHeight;
    const maxHeight = Math.min(availableHeight, contentHeight);
    const top = openUp
      ? Math.max(margin, rect.top - maxHeight - spacing)
      : rect.bottom + spacing;
    const width = Math.min(rect.width, viewportWidth - margin * 2);
    const left = Math.max(margin, Math.min(rect.left, viewportWidth - width - margin));

    data.list.style.left = `${left}px`;
    data.list.style.top = `${top}px`;
    data.list.style.width = `${width}px`;
    data.list.style.maxHeight = `${maxHeight}px`;

    // A lista é position:fixed, mas dentro de um ancestral com transform (ex.:
    // o overlay de edição, .config-overlay.is-open) o "fixed" passa a ser
    // relativo a esse ancestral e a lista abria deslocada para fora da tela.
    // Mede onde ela realmente caiu e corrige a diferença.
    const placed = data.list.getBoundingClientRect();
    const shiftX = placed.left - left;
    const shiftY = placed.top - top;
    if (Math.abs(shiftX) > 0.5 || Math.abs(shiftY) > 0.5) {
      data.list.style.left = `${left - shiftX}px`;
      data.list.style.top = `${top - shiftY}px`;
    }
  }

  function syncEquipSelectDisabled(select) {
    const data = select?._equipSelect;
    if (!data) return;
    const disabled = !!select.disabled;
    data.wrapper.classList.toggle("is-disabled", disabled);
    data.trigger.disabled = disabled;
  }

  function updateEquipSelectValue(select) {
    const data = select?._equipSelect;
    if (!data) return;
    const option = select.selectedOptions[0] || select.options[0];
    const value = option ? option.value : "";
    const label = option ? option.textContent : "";

    data.valueEl.textContent = label || "";
    data.valueEl.classList.toggle("is-placeholder", value === "");

    Array.from(data.list.children).forEach((btn) => {
      const isSelected = btn.dataset.value === value;
      btn.classList.toggle("is-selected", isSelected);
      btn.setAttribute("aria-selected", String(isSelected));
    });
  }

  function rebuildEquipSelectOptions(select) {
    const data = select?._equipSelect;
    if (!data) return;
    data.list.innerHTML = "";
    Array.from(select.options).forEach((option) => {
      // Don't show hidden options or the placeholder if disabled
      if (option.hidden || (option.value === "" && option.disabled)) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "equip-select__option";
      btn.dataset.value = option.value;
      btn.textContent = option.textContent;
      btn.setAttribute("role", "option");
      if (option.disabled) {
        btn.disabled = true;
        btn.setAttribute("aria-disabled", "true");
      }
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        updateEquipSelectValue(select);
        closeEquipSelect(select);
        data.trigger.focus();
      });
      data.list.appendChild(btn);
    });
    updateEquipSelectValue(select);
  }

  function refreshEquipSelect(select) {
    if (!select?._equipSelect) return;
    rebuildEquipSelectOptions(select);
    syncEquipSelectDisabled(select);
  }

  function enhanceEquipSelect(select, root) {
    if (!select || select._equipSelect) return;
    const wrapper = document.createElement("div");
    wrapper.className = "equip-select";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "equip-select__trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");

    const valueEl = document.createElement("span");
    valueEl.className = "equip-select__value";
    const chev = document.createElement("i");
    chev.className = "fa-solid fa-chevron-down";
    trigger.append(valueEl, chev);

    const list = document.createElement("div");
    list.className = "equip-select__list";
    list.setAttribute("role", "listbox");
    const listId = select.id
      ? `${select.id}__list`
      : `equipSelectList_${Math.random().toString(36).slice(2)}`;
    list.id = listId;
    trigger.setAttribute("aria-controls", listId);

    select.classList.add("equip-select__native");
    select.setAttribute("aria-hidden", "true");
    select.tabIndex = -1;

    select.parentNode.insertBefore(wrapper, select);
    wrapper.append(trigger, list, select);

    select._equipSelect = { wrapper, trigger, valueEl, list };
    equipSelectRegistry.add(select);

    trigger.addEventListener("click", () => {
      if (select.disabled) return;
      const isOpen = wrapper.classList.contains("is-open");
      closeAllEquipSelects(select);
      if (isOpen) {
        closeEquipSelect(select);
      } else {
        wrapper.classList.add("is-open");
        positionEquipSelectList(select);
        trigger.setAttribute("aria-expanded", "true");
      }
    });

    select.addEventListener("change", () => updateEquipSelectValue(select));
    select.addEventListener("input", () => updateEquipSelectValue(select));

    if (select.id && root) {
      const escapeId = window.CSS && CSS.escape ? CSS.escape(select.id) : select.id;
      const label = root.querySelector(`label[for="${escapeId}"]`);
      if (label && !label.dataset.equipSelectBound) {
        label.dataset.equipSelectBound = "true";
        label.addEventListener("click", (event) => {
          event.preventDefault();
          if (select.disabled) return;
          closeAllEquipSelects(select);
          wrapper.classList.add("is-open");
          positionEquipSelectList(select);
          trigger.setAttribute("aria-expanded", "true");
          trigger.focus();
        });
      }
    }

    const observer = new MutationObserver((mutations) => {
      let needsRebuild = false;
      let needsSync = false;
      mutations.forEach((mutation) => {
        if (mutation.type === "childList") needsRebuild = true;
        if (mutation.type === "attributes") needsSync = true;
      });
      if (needsRebuild) rebuildEquipSelectOptions(select);
      if (needsRebuild || needsSync) {
        updateEquipSelectValue(select);
        syncEquipSelectDisabled(select);
      }
    });
    observer.observe(select, { childList: true, attributes: true, attributeFilter: ["disabled"] });

    refreshEquipSelect(select);
  }

  function initEquipSelects(root) {
    if (!modal && !root) return;
    bindEquipSelectGlobalEvents();
    equipSelectRegistry.forEach((select) => {
      if (!document.contains(select)) equipSelectRegistry.delete(select);
    });
    const host = root || modal;
    host.querySelectorAll("select.equip-input, select[data-equip-select]").forEach((select) => {
      if (!root && !select.closest("#createEquipmentModal")) return;
      if (select._equipSelect) {
        refreshEquipSelect(select);
        return;
      }
      enhanceEquipSelect(select, host);
    });
  }
  function getActiveFarmCoords() {
    const farm = window.IcFarmActive;
    if (!farm) return null;
    if (!Number.isFinite(farm.lat) || !Number.isFinite(farm.lng)) return null;
    return { lat: farm.lat, lng: farm.lng };
  }

  function formatLatLng(lat, lng) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }

  function applyFarmDefaults(type) {
    const farm = getActiveFarmCoords();
    if (!farm) return;
    const st = (stateByType[type] ||= {});

    if (type === "smart_connect") {
      const hasCenter =
        Number.isFinite(st.centerLat) && Number.isFinite(st.centerLng);
      if (!hasCenter && !st.center) {
        st.centerLat = farm.lat;
        st.centerLng = farm.lng;
        st.center = formatLatLng(farm.lat, farm.lng);
      }
      return;
    }

    if (type === "smarttouch") {
      const hasLoc = Number.isFinite(st.lat) && Number.isFinite(st.lng);
      if (!hasLoc && !st.loc) {
        st.lat = farm.lat;
        st.lng = farm.lng;
        st.loc = formatLatLng(farm.lat, farm.lng);
      }
      if (!Number.isFinite(st.radius)) {
        st.radius = 600;
      }
      return;
    }

    if (type === "repetidora") {
      const hasLoc = Number.isFinite(st.lat) && Number.isFinite(st.lng);
      if (!hasLoc && !st.loc) {
        st.lat = farm.lat;
        st.lng = farm.lng;
        st.loc = formatLatLng(farm.lat, farm.lng);
      }
      return;
    }

    if (type === "irripump" || type === "medidor" || type === "pluviometro") {
      const hasLoc = Number.isFinite(st.lat) && Number.isFinite(st.lng);
      if (!hasLoc && !st.loc) {
        st.lat = farm.lat;
        st.lng = farm.lng;
        st.loc = formatLatLng(farm.lat, farm.lng);
      }
    }
  }

  function getEquipmentName(type, data) {
    if (!data) return "";
    if (type === "smart_connect") return data.name || "";
    if (type === "smarttouch") return data.name || data.deviceName || "Smart Touch";
    if (type === "irripump") return data.nome || "";
    if (type === "medidor") return data.nome || "";
    if (type === "rainstar") return data.name || "";
    if (type === "linestar") return data.name || "";
    if (type === "repetidora") return data.name || "";
    if (type === "pluviometro") return data.nome || "";
    if (type === "estacao_metereologica") return data.name || "";
    if (type === "cosmofield") return data.name || "";
    return data.name || "";
  }

  function getSelectedTypeLabel(type = selectedType) {
    if (!type) return "";
    const card = cards.find((item) => item.dataset.equip === type);
    const label = card?.querySelector(".create-equip__card-title")?.textContent?.trim() || "";
    return label;
  }

  function getActiveFarmId() {
    const activeFarm =
      window.IcFarmGetActive?.() ||
      window.IcFarmActive ||
      window.CreateFarm?.state?.activeFarmSnapshot ||
      null;
    const activeFarmId = activeFarm?.id;
    return String(
      activeFarmId ||
      sessionStorage.getItem("ic_active_farm") ||
      sessionStorage.getItem("ic_active_farm_id") ||
      ""
    );
  }

  function invalidatePivotCache(nextFarmId = "") {
    const normalizedFarmId = String(nextFarmId || "");
    if (normalizedFarmId && normalizedFarmId === String(pivotListCacheFarmId || "")) return;
    pivotListCache = null;
    pivotListCacheFarmId = normalizedFarmId || null;
  }

  async function fetchPivotsForActiveFarm(forceReload = false) {
    const activeFarmId = getActiveFarmId();
    if (!forceReload && pivotListCache && pivotListCacheFarmId === activeFarmId) return pivotListCache;

    try {
      let farms = [];
      if (window.IC_API_CONFIG?.baseUrl) {
        const FARM_API_URL = `${window.IC_API_CONFIG.baseUrl}/api/farms`;
        const response = await fetch(FARM_API_URL, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error("Falha ao buscar fazendas");
        const payload = await response.json();
        farms = Array.isArray(payload) ? payload : (payload.farms || []);
      } else {
        farms = window.Cad?.data?.getAllFarms?.() || JSON.parse(localStorage.getItem("ic_farms") || "[]");
      }

      let pivos = [];
      if (farms.length > 0) {
        const currentFarm = farms.find((farm) => String(farm?.id || "") === activeFarmId) || farms[0];
        const currentEquipments = Array.isArray(currentFarm?.equipments) ? currentFarm.equipments : [];
        pivos = currentEquipments.filter((equip) => equip.type === "smart_connect");
      }

      pivotListCache = pivos;
      pivotListCacheFarmId = activeFarmId;
      return pivos;
    } catch (error) {
      console.error("Erro ao buscar pivôs:", error);
      pivotListCache = [];
      pivotListCacheFarmId = activeFarmId;
      return [];
    }
  }

  function updateModalTitle(type = selectedType) {
    if (!titleEl) return;
    const label = getSelectedTypeLabel(type);
    const base = tCe(BASE_TITLE);
    titleEl.textContent = label ? `${base} - ${tCe(label)}` : base;
  }

  function getStepsFor(type) {
    return stepFlows[type] || THREE_STEPS;
  }

  // Exposto para os handlers de equipamento (ex.: medidor.js) pedirem o
  // redesenho da trilha de steps quando uma escolha muda o fluxo — como
  // trocar a versão do Medidor de Nível entre 5.2 e 5.3 (GH).
  window.IcCreateEquip = window.IcCreateEquip || {};
  window.IcCreateEquip.refreshSteps = function refreshStepsExternal() {
    if (!selectedType) return;
    const steps = getStepsFor(selectedType);
    if (currentStepIndex > steps.length - 1) currentStepIndex = steps.length - 1;
    renderSteps(selectedType);
    setButtons();
    updateFooterLayout();
  };

  function renderSteps(type) {
    const steps = getStepsFor(type);
    stepsContainer.innerHTML = "";

    steps.forEach((label, index) => {
      const stepEl = document.createElement("div");
      stepEl.className = "create-equip__step";
      if (index === currentStepIndex) stepEl.classList.add("create-equip__step--active");

      const numEl = document.createElement("span");
      numEl.className = "create-equip__step-num";
      numEl.textContent = String(index + 1);

      const labelEl = document.createElement("span");
      labelEl.className = "create-equip__step-label";
      labelEl.textContent = tCe(label);

      stepEl.append(numEl, labelEl);
      stepsContainer.appendChild(stepEl);
    });
  }

  function showGrid(show) {
    const grid = modal.querySelector(".create-equip__grid");
    if (!grid) return;
    grid.style.display = show ? "" : "none";
  }

  function updateFooterLayout() {
    if (!prevBtn || !footer) return;

    const showPrev = currentStepIndex > 0;
    prevBtn.style.display = showPrev ? "" : "none";
    footer.classList.toggle("no-prev", !showPrev);
  }

  function setButtons() {
    const steps = getStepsFor(selectedType);
    const label = steps[currentStepIndex];
    const isLast = currentStepIndex === steps.length - 1;
    const isEn = EN_TYPES.has(selectedType);

    nextBtn.textContent = isLast ? tCe("Finalizar") : tCe("Próximo");
    if (prevBtn) prevBtn.textContent = tCe("Anterior");

    // antes era Funções -> Resumo
    // agora Funções -> Vincular equipamento
    if (label === "Funções") nextBtn.textContent = tCe("Avançar");
    if (label === "Vincular equipamento") nextBtn.textContent = tCe("Avançar para Resumo");
  }

  function setSelected(card) {
    cards.forEach((c) => c.classList.remove("is-selected"));
    card.classList.add("is-selected");

    selectedType = card.dataset.equip || null;
    currentStepIndex = 0;
    if (selectedType) applyFarmDefaults(selectedType);

    updateModalTitle(selectedType);

    renderCurrentStep();
    if (typeof showDraftBanner === "function" && selectedType) showDraftBanner(selectedType);
  }

  function ensureDefaultSelection() {
    if (selectedType) return;
    if (!cards.length) return;
    setSelected(cards[0]);
  }

  function renderPlaceholder(label) {
    dynamicHost.innerHTML = `
      <div class="card create-equip__placeholder">
        <strong>${label}</strong><br/>
        <span class="create-equip__placeholder-muted">Tela ainda não implementada para este equipamento.</span>
      </div>
    `;
  }

  function renderCurrentStep() {
    ensureDefaultSelection();

    const steps = getStepsFor(selectedType);
    const label = steps[currentStepIndex];

    renderSteps(selectedType);
    setButtons();
    updateFooterLayout();
    if (typeof updateDraftBtn === "function") updateDraftBtn();

    const closeBtn = modal.querySelector(".create-equip__close");
    if (closeBtn) closeBtn.setAttribute("aria-label", EN_TYPES.has(selectedType) ? "Close" : "Fechar");

    const dialog = modal.querySelector(".create-equip__dialog");
    if (dialog) {
      if ((selectedType === "smarttouch" || selectedType === "smart_connect" || selectedType === "linestar") && currentStepIndex > 0) {
        dialog.classList.add("create-equip__dialog--large");
      } else {
        dialog.classList.remove("create-equip__dialog--large");
      }
    }

    // Step 1: grid de equipamentos
    if (label === "Equipamento") {
      showGrid(true);
      dynamicHost.style.display = "none";
      dynamicHost.innerHTML = "";
      return;
    }

    // Steps 2..N
    showGrid(false);
    dynamicHost.style.display = "";

    // placeholder padrão
    renderPlaceholder(label);

    // Delegação: Irripump + Medidor (6 steps)
    if (selectedType === "irripump" || selectedType === "medidor") {
      const handler = window.IcEquipamentos?.[selectedType];
      if (!handler) return;

      const st = (stateByType[selectedType] ||= {});

      if (label === "Localização") handler.renderStep2(dynamicHost, st);
      else if ((label === "Configuração" || label === "Ficha Técnica" || label === "General") && typeof handler.renderConfigStep === "function") handler.renderConfigStep(dynamicHost, st);
      else if (label === "Nível" && typeof handler.renderNivelStep === "function") handler.renderNivelStep(dynamicHost, st);
      else if (label === "Conectividade" && typeof handler.renderConnectivityStep === "function") handler.renderConnectivityStep(dynamicHost, st);
      // Irripump ainda usa Módulos/Funções; o Medidor de Nível usa o fluxo
      // reduzido: Equipamento > Localização > Ficha Técnica > Nível > Conectividade.
      // O vínculo de bombas do Medidor 5.3 (GH) fica dentro da Ficha Técnica.
      else if (label === "Módulos" && typeof handler.renderStep3 === "function") handler.renderStep3(dynamicHost, st);
      else if (label === "Funções" && typeof handler.renderStep4 === "function") handler.renderStep4(dynamicHost, st);
      else if (label === "Vincular equipamento" && typeof handler.renderStep5 === "function") handler.renderStep5(dynamicHost, st);
      else if (label === "Resumo") {
        if (typeof handler.renderStep6 === "function") handler.renderStep6(dynamicHost, st);
        else renderPlaceholder("Resumo");
      }
    }

    // SmartConnect/Nexus — Step 2 (Ficha Técnica)
    if (selectedType === "smart_connect") {
      const handler = window.IcEquipamentos?.smart_connect;
      if (!handler) return;
      const st = (stateByType[selectedType] ||= {});

      if (label === "Conectividade") {
        if (typeof handler.renderConectividadeStep === "function") {
          handler.renderConectividadeStep(dynamicHost, st);
        }
      } else if (label === "Bombeamento") {
        if (typeof handler.renderBombaStep === "function") {
          handler.renderBombaStep(dynamicHost, st);
        }
      } else if (label === "Ficha Técnica") {
        if (typeof handler.renderStep3 === "function") {
          handler.renderStep3(dynamicHost, st);
        }
      } else if (label === "Canhão") {
        if (typeof handler.renderCanhaoStep === "function") {
          handler.renderCanhaoStep(dynamicHost, st);
        }
      } else if (label === "Segmentos") {
        if (typeof handler.renderSegmentsStep === "function") {
          handler.renderSegmentsStep(dynamicHost, st);
        }
      } else if (label === "Ângulo") {
        if (typeof handler.renderAngleStep === "function") {
          handler.renderAngleStep(dynamicHost, st);
        }
      } else if (label === "Localização") {
        handler.renderStep2(dynamicHost, st);
      }
    }

    // SmartTouch — handled below by label

    // Carretel (Rainstar) — ficha técnica, controles e conectividade
    if (selectedType === "rainstar") {
      const handler = window.IcEquipamentos?.rainstar;
      if (!handler) return;
      const st = (stateByType[selectedType] ||= {});
      if (label === "Ficha Técnica" && typeof handler.renderStep2 === "function") handler.renderStep2(dynamicHost, st);
      else if (label === "Pré e Pós-Irrigação" && typeof handler.renderStep3 === "function") handler.renderStep3(dynamicHost, st);
      else if (label === "Zonas de Irrigação" && typeof handler.renderStep4 === "function") handler.renderStep4(dynamicHost, st);
      else if (label === "Conectividade" && typeof handler.renderStep5 === "function") handler.renderStep5(dynamicHost, st);
    }

    // LineStar — Steps 2-8
    if (selectedType === "linestar") {
      const handler = window.IcEquipamentos?.linestar;
      if (!handler) return;
      const st = (stateByType[selectedType] ||= {});

      if (label && label.indexOf("Localiza") === 0) handler.renderStep2(dynamicHost, st);
      else if (label === "Área Irrigada" && typeof handler.renderStep3 === "function") {
        handler.renderStep3(dynamicHost, st);
      } else if (label === "Segmentos" && typeof handler.renderStep4 === "function") {
        handler.renderStep4(dynamicHost, st);
      } else if (label === "Posições Intermediárias" && typeof handler.renderIntermediateStep === "function") {
        handler.renderIntermediateStep(dynamicHost, st);
      } else if (label === "Canhão" && typeof handler.renderStep5 === "function") {
        handler.renderStep5(dynamicHost, st);
      } else if (label === "Ficha Técnica" && typeof handler.renderStep6 === "function") {
        handler.renderStep6(dynamicHost, st);
      } else if (label === "Bombeamento" && typeof handler.renderStep7 === "function") {
        handler.renderStep7(dynamicHost, st);
      } else if (label === "Conectividade" && typeof handler.renderStep8 === "function") {
        handler.renderStep8(dynamicHost, st);
      }
    }

    if (selectedType === "repetidora") {
      const handler = window.IcEquipamentos?.repetidora;
      if (!handler) return;
      const st = (stateByType[selectedType] ||= {});

      if (label === "Localização") handler.renderStep2(dynamicHost, st);
      else if (label === "Ficha Técnica" && typeof handler.renderStep3 === "function") {
        handler.renderStep3(dynamicHost, st);
      }
      else if (label === "Conectividade" && typeof handler.renderConnectivityStep === "function") {
        handler.renderConnectivityStep(dynamicHost, st);
      }
    }

    // Estação Meteorológica — Ficha Técnica (a localização vem da Davis, sem step)
    if (selectedType === "estacao_metereologica") {
      const handler = window.IcEquipamentos?.estacao_metereologica;
      if (!handler) return;
      const st = (stateByType[selectedType] ||= {});
      if (label === "Ficha Técnica" || label === "Configuração") handler.renderStep2(dynamicHost, st);
    }

    // Cosmofield — Steps 2-4
    if (selectedType === "cosmofield") {
      const handler = window.IcEquipamentos?.cosmofield;
      if (!handler) return;
      const st = (stateByType[selectedType] ||= {});

      if (label === "Identificação") handler.renderStep2(dynamicHost, st);
      else if (label === "Localização") handler.renderStep3(dynamicHost, st);
      else if (label === "Solo") handler.renderStep4(dynamicHost, st);
      else if (label === "Cultura") handler.renderStep5(dynamicHost, st);
      else if (label === "Integração") handler.renderStep6(dynamicHost, st);
    }

    // Pluviometro — Steps 2-3
    if (selectedType === "pluviometro") {
      const handler = window.IcEquipamentos?.pluviometro;
      if (!handler) return;
      const st = (stateByType[selectedType] ||= {});

      if (label === "Localização") handler.renderStep2(dynamicHost, st);
      else if (label === "Configuração" && typeof handler.renderStep3 === "function") {
        handler.renderStep3(dynamicHost, st);
      }
    }

    if (selectedType === "smarttouch" && label === "Localização") {
      const handler = window.IcEquipamentos?.smarttouch;
      const st = (stateByType[selectedType] ||= {});
      if (handler) handler.renderStep2(dynamicHost, st);
    }

    if (selectedType === "smarttouch" && label === "Ângulo") {
      const handler = window.IcEquipamentos?.smarttouch;
      const st = (stateByType[selectedType] ||= {});
      if (handler) handler.renderStep3(dynamicHost, st);
    }

    if (selectedType === "smarttouch" && label === "Segmentos") {
      const handler = window.IcEquipamentos?.smarttouch;
      const st = (stateByType[selectedType] ||= {});
      if (handler && typeof handler.renderSegmentsStep === "function") handler.renderSegmentsStep(dynamicHost, st);
    }

    if (selectedType === "smarttouch" && label === "Canhão") {
      const handler = window.IcEquipamentos?.smarttouch;
      const st = (stateByType[selectedType] ||= {});
      if (handler && typeof handler.renderCanhaoStep === "function") handler.renderCanhaoStep(dynamicHost, st);
    }

    if (selectedType === "smarttouch" && label === "Ficha Técnica") {
      const handler = window.IcEquipamentos?.smarttouch;
      const st = (stateByType[selectedType] ||= {});
      if (handler) handler.renderStep6(dynamicHost, st);
    }

    if (selectedType === "smarttouch" && label === "Bombeamento") {
      const handler = window.IcEquipamentos?.smarttouch;
      const st = (stateByType[selectedType] ||= {});
      if (handler) handler.renderStep7(dynamicHost, st);
    }

    if (selectedType === "smarttouch" && label === "Conectividade") {
      const handler = window.IcEquipamentos?.smarttouch;
      const st = (stateByType[selectedType] ||= {});
      if (handler) handler.renderStep8(dynamicHost, st);
    }

    initEquipSelects(dynamicHost);
  }

  function goNext() {
    ensureDefaultSelection();

    // Preview/UX: os campos obrigatórios (marcados com * vermelho) continuam
    // sinalizados, mas NÃO travam o avanço entre os steps. Assim dá para
    // navegar e validar o fluxo sem precisar preencher tudo. Os dados
    // digitados continuam sendo lidos e persistidos normalmente.
    const SKIP_REQUIRED_VALIDATION = true;

    const steps = getStepsFor(selectedType);
    const label = steps[currentStepIndex];

    // Validação Step 2 (Localização) — Irripump + Medidor
    if ((selectedType === "irripump" || selectedType === "medidor") && label === "Localização") {
      const handler = window.IcEquipamentos?.[selectedType];
      if (!handler) return;

      const st = (stateByType[selectedType] ||= {});
      const data = handler.readStep2(dynamicHost, st);
      const val = handler.validateStep2(data, st);

      if (!val.ok && !SKIP_REQUIRED_VALIDATION) {
        alert(val.msg);
        return;
      }

      Object.assign(st, data);
    }

    // Validação Step 3 (Configuração / Ficha Técnica) — Irripump + Medidor
    if ((selectedType === "irripump" || selectedType === "medidor") && (label === "Configuração" || label === "Ficha Técnica")) {
      const handler = window.IcEquipamentos?.[selectedType];
      if (!handler || typeof handler.readConfigStep !== "function") return;

      const st = (stateByType[selectedType] ||= {});
      const data = handler.readConfigStep(dynamicHost, st);
      const val = handler.validateConfigStep ? handler.validateConfigStep(data, st) : { ok: true, msg: "" };

      if (!val.ok && !SKIP_REQUIRED_VALIDATION) {
        alert(val.msg);
        return;
      }

      Object.assign(st, data);
    }

    // Validação Step Nível — Medidor
    if (selectedType === "medidor" && label === "Nível") {
      const handler = window.IcEquipamentos?.medidor;
      if (!handler || typeof handler.readNivelStep !== "function") return;

      const st = (stateByType[selectedType] ||= {});
      const data = handler.readNivelStep(dynamicHost, st);
      const val = handler.validateNivelStep ? handler.validateNivelStep(data, st) : { ok: true, msg: "" };

      if (!val.ok && !SKIP_REQUIRED_VALIDATION) {
        alert(val.msg);
        return;
      }

      Object.assign(st, data);
    }

    // Validação Step 4 (Conectividade) — Irripump + Medidor
    if ((selectedType === "irripump" || selectedType === "medidor") && label === "Conectividade") {
      const handler = window.IcEquipamentos?.[selectedType];
      if (!handler || typeof handler.readConnectivityStep !== "function") return;

      const st = (stateByType[selectedType] ||= {});
      const data = handler.readConnectivityStep(dynamicHost, st);
      const val = handler.validateConnectivityStep ? handler.validateConnectivityStep(data, st) : { ok: true, msg: "" };

      if (!val.ok && !SKIP_REQUIRED_VALIDATION) {
        alert(val.msg);
        return;
      }

      Object.assign(st, data);
    }

    // Validação Step 3 (Módulos) — Irripump + Medidor
    if ((selectedType === "irripump" || selectedType === "medidor") && label === "Módulos") {
      const handler = window.IcEquipamentos?.[selectedType];
      if (!handler || typeof handler.readStep3 !== "function") return;

      const st = (stateByType[selectedType] ||= {});
      const data = handler.readStep3(dynamicHost, st);
      const val = handler.validateStep3 ? handler.validateStep3(data, st) : { ok: true, msg: "" };

      if (!val.ok && !SKIP_REQUIRED_VALIDATION) {
        alert(val.msg);
        return;
      }

      Object.assign(st, data);
    }

    // Validação Step 2 (Localização) — SmartConnect/Nexus
    // Validação Step 2 (Localização) - Pluviometro
    if (selectedType === "pluviometro" && label === "Localização") {
      const handler = window.IcEquipamentos?.pluviometro;
      if (!handler) return;

      const st = (stateByType[selectedType] ||= {});
      const data = handler.readStep2(dynamicHost, st);
      const val = handler.validateStep2 ? handler.validateStep2(data, st) : { ok: true, msg: "" };

      if (!val.ok && !SKIP_REQUIRED_VALIDATION) {
        alert(val.msg);
        return;
      }

      Object.assign(st, data);
    }

    // Validação Step 3 (Configuração) - Pluviometro
    if (selectedType === "pluviometro" && label === "Configuração") {
      const handler = window.IcEquipamentos?.pluviometro;
      if (!handler || typeof handler.readStep3 !== "function") return;

      const st = (stateByType[selectedType] ||= {});
      const data = handler.readStep3(dynamicHost, st);
      const val = handler.validateStep3 ? handler.validateStep3(data, st) : { ok: true, msg: "" };

      if (!val.ok && !SKIP_REQUIRED_VALIDATION) {
        alert(val.msg);
        return;
      }

      Object.assign(st, data);
    }

    if (selectedType === "smart_connect" && label === "Localização") {
      const handler = window.IcEquipamentos?.smart_connect;
      if (!handler) return;

      const st = (stateByType[selectedType] ||= {});
      const data = handler.readStep2(dynamicHost, st);
      const val = handler.validateStep2 ? handler.validateStep2(data, st) : { ok: true, msg: "" };

      if (!val.ok && !SKIP_REQUIRED_VALIDATION) {
        alert(val.msg);
        return;
      }

      Object.assign(st, data);
    }

    // Validação Step 3 (Ângulo) — SmartConnect/Nexus
    if (selectedType === "smart_connect" && label === "Ângulo") {
      // maxAngle e bearing já atualizados em tempo real pelo bindAngleStep
    }

    // Validação Step 4 (Segmentos) — SmartConnect/Nexus
    if (selectedType === "smart_connect" && label === "Segmentos") {
      const st = (stateByType[selectedType] ||= {});
      const segs = st.segments || [];
      if (segs.length > 1 && !SKIP_REQUIRED_VALIDATION) {
        const unnamed = segs.findIndex((s) => !String(s.name || "").trim());
        if (unnamed !== -1) {
          alert(`${tCe("Preencha o nome do segmento")} ${unnamed + 1} ${tCe("antes de continuar.")}`);
          return;
        }
      }
    }

    // Validação Step 4 (Segmentos) — SmartTouch
    if (selectedType === "smarttouch" && label === "Segmentos") {
      const st = (stateByType[selectedType] ||= {});
      const segs = st.segments || [];
      if (segs.length > 1 && !SKIP_REQUIRED_VALIDATION) {
        const unnamed = segs.findIndex((s) => !String(s.name || "").trim());
        if (unnamed !== -1) {
          alert(`${tCe("Preencha o nome do segmento")} ${unnamed + 1} ${tCe("antes de continuar.")}`);
          return;
        }
      }
    }

    // Validação Step 6 (Ficha Técnica) — SmartTouch
    if (selectedType === "smarttouch" && label === "Ficha Técnica") {
      const handler = window.IcEquipamentos?.smarttouch;
      if (!handler) return;

      const st = (stateByType[selectedType] ||= {});
      const data = handler.readStep2(dynamicHost, st);
      const val = handler.validateStep2 ? handler.validateStep2(data, st) : { ok: true };

      if (!val.ok && !SKIP_REQUIRED_VALIDATION) {
        if (val.msg) alert(val.msg);
        st._errors = val.errors || {};
        handler.renderStep2(dynamicHost, st);
        return;
      }

      st._errors = {};
      Object.assign(st, data);
    }

    // Validação — Carretel (Rainstar)
    if (selectedType === "rainstar" && ["Ficha Técnica", "Pré e Pós-Irrigação", "Zonas de Irrigação", "Conectividade"].includes(label)) {
      const handler = window.IcEquipamentos?.rainstar;
      if (!handler) return;

      const st = (stateByType[selectedType] ||= {});
      const stepByLabel = label === "Ficha Técnica" ? "Step2" : (label === "Pré e Pós-Irrigação" ? "Step3" : (label === "Zonas de Irrigação" ? "Step4" : "Step5"));
      const readFn = handler["read" + stepByLabel];
      const validateFn = handler["validate" + stepByLabel];
      const renderFn = handler["render" + stepByLabel];
      if (typeof readFn !== "function") return;

      const data = readFn.call(handler, dynamicHost, st);
      const val = typeof validateFn === "function" ? validateFn.call(handler, data, st) : { ok: true };

      if (!val.ok && !SKIP_REQUIRED_VALIDATION) {
        st._errors = val.errors || {};
        if (typeof renderFn === "function") renderFn.call(handler, dynamicHost, st);
        return;
      }

      st._errors = {};
      Object.assign(st, data);
    }

    // Validação Step 2 (Localização) — SmartTouch
    if (selectedType === "smarttouch" && label === "Localização") {
      const handler = window.IcEquipamentos?.smarttouch;
      if (!handler) return;

      const st = (stateByType[selectedType] ||= {});
      const data = handler.readStep2(dynamicHost, st);
      const val = handler.validateStep2 ? handler.validateStep2(data, st) : { ok: true };

      if (!val.ok && !SKIP_REQUIRED_VALIDATION) {
        if (val.msg) alert(val.msg);
        st._errors = val.errors || {};
        handler.renderStep2(dynamicHost, st);
        return;
      }

      st._errors = {};
      Object.assign(st, data);
    }

    if (
      selectedType === "smarttouch" &&
      label &&
      label.indexOf("Localiza") === 0
    ) {
      const handler = window.IcEquipamentos?.smarttouch;
      if (!handler) return;

      const st = (stateByType[selectedType] ||= {});
      const data = handler.readStep2(dynamicHost, st);
      const val = handler.validateStep2 ? handler.validateStep2(data, st) : { ok: true };

      if (!val.ok && !SKIP_REQUIRED_VALIDATION) {
        if (val.msg) alert(val.msg);
        st._errors = val.errors || {};
        handler.renderStep2(dynamicHost, st);
        return;
      }

      st._errors = {};
      Object.assign(st, data);
    }

    if (selectedType === "linestar" && label && label.indexOf("Localiza") === 0) {
      const handler = window.IcEquipamentos?.linestar;
      if (!handler) return;

      const st = (stateByType[selectedType] ||= {});
      const data = handler.readStep2(dynamicHost, st);
      const val = handler.validateStep2 ? handler.validateStep2(data, st) : { ok: true, msg: "" };

      if (!val.ok && !SKIP_REQUIRED_VALIDATION) {
        alert(val.msg);
        return;
      }

      Object.assign(st, data);
    }

    if (selectedType === "linestar" && label === "Área Irrigada") {
      const handler = window.IcEquipamentos?.linestar;
      if (!handler || typeof handler.readStep3 !== "function") return;

      const st = (stateByType[selectedType] ||= {});
      const data = handler.readStep3(dynamicHost, st);
      const val = handler.validateStep3 ? handler.validateStep3(data, st) : { ok: true };

      if (!val.ok && !SKIP_REQUIRED_VALIDATION) {
        st._errors = val.errors || {};
        handler.renderStep3(dynamicHost, st);
        return;
      }

      st._errors = {};
      Object.assign(st, data);
    }

    if (selectedType === "linestar" && label === "Segmentos") {
      const handler = window.IcEquipamentos?.linestar;
      if (!handler || typeof handler.readStep4 !== "function") return;

      const st = (stateByType[selectedType] ||= {});
      const data = handler.readStep4(dynamicHost, st);
      const val = handler.validateStep4 ? handler.validateStep4(data, st) : { ok: true };

      if (!val.ok && !SKIP_REQUIRED_VALIDATION) {
        st._errors = val.errors || {};
        handler.renderStep4(dynamicHost, st);
        return;
      }

      st._errors = {};
      Object.assign(st, data);
    }

    if (selectedType === "linestar" && label === "Canhão") {
      const handler = window.IcEquipamentos?.linestar;
      if (!handler || typeof handler.readStep5 !== "function") return;

      const st = (stateByType[selectedType] ||= {});
      const data = handler.readStep5(dynamicHost, st);
      const val = handler.validateStep5 ? handler.validateStep5(data, st) : { ok: true };

      if (!val.ok && !SKIP_REQUIRED_VALIDATION) {
        st._errors = val.errors || {};
        handler.renderStep5(dynamicHost, st);
        return;
      }

      st._errors = {};
      Object.assign(st, data);
    }

    if (selectedType === "linestar" && label === "Posições Intermediárias") {
      const handler = window.IcEquipamentos?.linestar;
      if (!handler || typeof handler.readIntermediateStep !== "function") return;

      const st = (stateByType[selectedType] ||= {});
      const data = handler.readIntermediateStep(dynamicHost, st);
      const val = handler.validateIntermediateStep ? handler.validateIntermediateStep(data, st) : { ok: true };

      if (!val.ok && !SKIP_REQUIRED_VALIDATION) {
        st._errors = val.errors || {};
        handler.renderIntermediateStep(dynamicHost, st);
        return;
      }

      st._errors = {};
      Object.assign(st, data);
    }

    if (selectedType === "linestar" && label === "Ficha Técnica") {
      const handler = window.IcEquipamentos?.linestar;
      if (!handler || typeof handler.readStep6 !== "function") return;

      const st = (stateByType[selectedType] ||= {});
      const data = handler.readStep6(dynamicHost, st);
      const val = handler.validateStep6 ? handler.validateStep6(data, st) : { ok: true };

      if (!val.ok && !SKIP_REQUIRED_VALIDATION) {
        st._errors = val.errors || {};
        handler.renderStep6(dynamicHost, st);
        return;
      }

      st._errors = {};
      Object.assign(st, data);
    }

    if (selectedType === "linestar" && label === "Bombeamento") {
      const handler = window.IcEquipamentos?.linestar;
      if (!handler || typeof handler.readStep7 !== "function") return;

      const st = (stateByType[selectedType] ||= {});
      const data = handler.readStep7(dynamicHost, st);
      const val = handler.validateStep7 ? handler.validateStep7(data, st) : { ok: true };

      if (!val.ok && !SKIP_REQUIRED_VALIDATION) {
        st._errors = val.errors || {};
        handler.renderStep7(dynamicHost, st);
        return;
      }

      st._errors = {};
      Object.assign(st, data);
    }

    if (selectedType === "repetidora" && label === "Localização") {
      const handler = window.IcEquipamentos?.repetidora;
      if (!handler) return;

      const st = (stateByType[selectedType] ||= {});
      const data = handler.readStep2(dynamicHost, st);
      const val = handler.validateStep2 ? handler.validateStep2(data, st) : { ok: true, msg: "" };

      if (!val.ok && !SKIP_REQUIRED_VALIDATION) {
        alert(val.msg);
        return;
      }

      Object.assign(st, data);
    }

    // Validação Step 3 (Ficha Técnica) — Repetidora
    if (selectedType === "repetidora" && label === "Ficha Técnica") {
      const handler = window.IcEquipamentos?.repetidora;
      if (!handler || typeof handler.readStep3 !== "function") return;

      const st = (stateByType[selectedType] ||= {});
      const data = handler.readStep3(dynamicHost, st);
      const val = handler.validateStep3 ? handler.validateStep3(data, st) : { ok: true };

      if (!val.ok && !SKIP_REQUIRED_VALIDATION) {
        st._errors = val.errors || {};
        handler.renderStep3(dynamicHost, st);
        return;
      }

      st._errors = {};
      Object.assign(st, data);
    }

    // Validação Step 4 (Conectividade) — Repetidora
    if (selectedType === "repetidora" && label === "Conectividade") {
      const handler = window.IcEquipamentos?.repetidora;
      if (!handler || typeof handler.readConnectivityStep !== "function") return;

      const st = (stateByType[selectedType] ||= {});
      const data = handler.readConnectivityStep(dynamicHost, st);
      const val = handler.validateConnectivityStep ? handler.validateConnectivityStep(data, st) : { ok: true, msg: "" };

      if (!val.ok && !SKIP_REQUIRED_VALIDATION) {
        alert(val.msg);
        return;
      }

      Object.assign(st, data);
    }

    // Validação Ficha Técnica — Estação Meteorológica
    if (selectedType === "estacao_metereologica" && (label === "Ficha Técnica" || label === "Configuração")) {
      const handler = window.IcEquipamentos?.estacao_metereologica;
      if (!handler || typeof handler.readStep2 !== "function") return;

      const st = (stateByType[selectedType] ||= {});
      const data = handler.readStep2(dynamicHost, st);
      const val = handler.validateStep2 ? handler.validateStep2(data, st) : { ok: true };

      if (!val.ok && !SKIP_REQUIRED_VALIDATION) {
        st._errors = val.errors || {};
        handler.renderStep2(dynamicHost, st);
        return;
      }

      st._errors = {};
      Object.assign(st, data);
    }

    // Validação Steps 2-4 — Cosmofield
    if (selectedType === "cosmofield") {
      const handler = window.IcEquipamentos?.cosmofield;
      if (!handler) return;

      const stepByLabel = {
        "Identificação": { read: "readStep2", validate: "validateStep2" },
        "Localização": { read: "readStep3", validate: "validateStep3" },
        "Solo": { read: "readStep4", validate: "validateStep4" },
        "Cultura": { read: "readStep5", validate: "validateStep5" },
        // Os vínculos são todos opcionais: só leitura, sem validação.
        "Integração": { read: "readStep6" },
      };
      const step = stepByLabel[label];

      if (step && typeof handler[step.read] === "function") {
        const st = (stateByType[selectedType] ||= {});
        const data = handler[step.read](dynamicHost, st);
        const val = handler[step.validate] ? handler[step.validate](data, st) : { ok: true, msg: "" };

        // Mesmo padrão dos outros equipamentos: com SKIP_REQUIRED_VALIDATION
        // ligado, o "Avançar" não trava por campo obrigatório vazio — só
        // facilita testar/validar os campos sem preencher tudo a cada vez.
        // val.hard: regra que bloqueia mesmo com a validação desligada
        // (alvo maior que o gatilho).
        if (!val.ok && (val.hard || !SKIP_REQUIRED_VALIDATION)) {
          alert(val.msg);
          return;
        }

        Object.assign(st, data);
      }
    }

    // Validação Step 7 (Bomba) — SmartConnect/Nexus
    if (selectedType === "smart_connect" && label === "Bombeamento") {
      const handler = window.IcEquipamentos?.smart_connect;
      if (!handler || typeof handler.readBombaStep !== "function") return;

      const st = (stateByType[selectedType] ||= {});
      const data = handler.readBombaStep(dynamicHost, st);
      const val = handler.validateBombaStep ? handler.validateBombaStep(data, st) : { ok: true };

      if (!val.ok && !SKIP_REQUIRED_VALIDATION) {
        if (val.msg) alert(val.msg);
        st._errors = val.errors || {};
        handler.renderBombaStep(dynamicHost, st);
        return;
      }

      st._errors = {};
      Object.assign(st, data);
    }

    // Validação Step 8 (Conectividade) — SmartConnect/Nexus
    if (selectedType === "smart_connect" && label === "Conectividade") {
      const handler = window.IcEquipamentos?.smart_connect;
      if (!handler || typeof handler.readConectividadeStep !== "function") return;

      const st = (stateByType[selectedType] ||= {});
      const data = handler.readConectividadeStep(dynamicHost, st);
      const val = handler.validateConectividadeStep ? handler.validateConectividadeStep(data, st) : { ok: true };

      if (!val.ok && !SKIP_REQUIRED_VALIDATION) {
        if (val.msg) alert(val.msg);
        st._errors = val.errors || {};
        handler.renderConectividadeStep(dynamicHost, st);
        return;
      }

      st._errors = {};
      Object.assign(st, data);
    }

    // Validação Step 3 (Ficha Técnica) — SmartConnect/Nexus
    if (selectedType === "smart_connect" && label === "Ficha Técnica") {
      const handler = window.IcEquipamentos?.smart_connect;
      if (!handler || typeof handler.readStep3 !== "function") return;

      const st = (stateByType[selectedType] ||= {});
      const data = handler.readStep3(dynamicHost, st);
      const val = handler.validateStep3 ? handler.validateStep3(data, st) : { ok: true };

      if (!val.ok && !SKIP_REQUIRED_VALIDATION) {
        if (val.msg) alert(val.msg);
        st._errors = val.errors || {};
        handler.renderStep3(dynamicHost, st);
        return;
      }

      st._errors = {};
      Object.assign(st, data);
    }

    // Finalizar
    if (currentStepIndex >= steps.length - 1) {
      const data = stateByType[selectedType] || {};
      const equip = {
        type: selectedType,
        name: getEquipmentName(selectedType, data),
        createdAt: new Date().toISOString(),
        data,
      };
      if (typeof clearDraft === "function") clearDraft(selectedType);
      console.log("[CreateEquipment] Salvando equipamento:", equip);
      console.log("[CreateEquipment] IcFarmsAddEquipment existe?", !!window.IcFarmsAddEquipment);
      if (window.IcFarmsAddEquipment) {
        window.IcFarmsAddEquipment(equip);
        // Força re-render do mapa após atualização do estado
        setTimeout(() => {
          const isPluviometriaMode =
            document.body.classList.contains("is-pluviometria") ||
            document.body.classList.contains("is-pluviometria-edit") ||
            document.body.classList.contains("is-pluvd");
          if (isPluviometriaMode) {
            window.IcMapClearPivots?.();
            window.Plv?.views?.map?.renderMarkers?.();
            return;
          }
          const activeFarm = window.IcFarmGetActive?.();
          if (window.IcMapRenderPivots && activeFarm) {
            window.IcMapRenderPivots(activeFarm);
          }
          window.IcMapSimulation?.refresh?.();
          window.IcSimulation?.refresh?.();
        }, 0);
      }
      closeModal();
      return;
    }

    currentStepIndex++;
    renderCurrentStep();
  }

  function goPrev() {
    if (currentStepIndex === 0) return;

    const steps = getStepsFor(selectedType);
    const currentLabel = steps[currentStepIndex];

    if (selectedType === "smarttouch" && currentLabel === "Ângulo") {
      const st = (stateByType[selectedType] ||= {});
      st.maxAngle = 360;
      st.bearing = 0;
    }

    if (selectedType === "smart_connect" && currentLabel === "Ângulo") {
      const st = (stateByType[selectedType] ||= {});
      st.maxAngle = 360;
      st.bearing = 0;
    }

    currentStepIndex--;
    renderCurrentStep();
  }

  function openModal() {
    ensureDefaultSelection();

    lastFocusBeforeOpen = document.activeElement;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    modal.removeAttribute("inert");
    document.body.classList.add("is-modal-open");

    currentStepIndex = 0;
    if (selectedType) {
      applyFarmDefaults(selectedType);
      if (stateByType[selectedType]) delete stateByType[selectedType].id;
    }
    updateModalTitle(selectedType);
    renderCurrentStep();
  }

  function closeModal() {
    const activeEl = document.activeElement;
    if (activeEl && modal.contains(activeEl)) {
      if (openBtn && typeof openBtn.focus === "function") {
        openBtn.focus();
      } else if (lastFocusBeforeOpen && document.contains(lastFocusBeforeOpen)) {
        lastFocusBeforeOpen.focus();
      } else if (typeof activeEl.blur === "function") {
        activeEl.blur();
      }
    }
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    modal.setAttribute("inert", "");
    document.body.classList.remove("is-modal-open");
    updateModalTitle(selectedType);
  }

  // =========================
  // Eventos base
  // =========================
  openBtn.addEventListener("click", () => {
    console.log("[CreateEquipment] Botão Criar Equipamento clicado. is-connectivity?", openBtn.classList.contains("is-connectivity"));
    if (openBtn.classList.contains("is-connectivity")) return;

    // O modal abre na hora: a lista de pivôs só é usada nos steps de
    // vínculo, bem depois do Step 1. Esperar o fetch aqui prendia a
    // abertura ao tempo de resposta da API — com o backend fora do ar, o
    // clique parecia morto até o timeout do navegador.
    openModal();
    fetchPivotsForActiveFarm(true).catch(() => {});
  });
  closeTriggers.forEach((t) => t.addEventListener("click", closeModal));

  modal.addEventListener("click", (e) => {
    const card = e.target.closest(".create-equip__card");
    if (card && currentStepIndex === 0) setSelected(card);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
  });

  window.addEventListener("ic:farm-changed", (event) => {
    invalidatePivotCache(event?.detail?.farm?.id || getActiveFarmId());
  });

  nextBtn.addEventListener("click", goNext);
  if (prevBtn) prevBtn.addEventListener("click", goPrev);

  // =========================
  // Rascunho (draft)
  // =========================
  const DRAFT_TYPES = new Set(Object.keys(stepFlows));
  const draftBtn = document.getElementById("btnSaveDraft");

  function draftKey(type) { return `equip_draft_${type}`; }

  function serializeState(st) {
    const clean = {};
    for (const key of Object.keys(st || {})) {
      if (key.startsWith("_")) continue;
      const val = st[key];
      if (typeof val === "function") continue;
      clean[key] = val;
    }
    return JSON.parse(JSON.stringify(clean));
  }

  function saveDraft() {
    if (!selectedType || !DRAFT_TYPES.has(selectedType)) return;
    try {
      const draft = {
        type: selectedType,
        stepIndex: currentStepIndex,
        state: serializeState(stateByType[selectedType]),
        savedAt: Date.now(),
      };
      localStorage.setItem(draftKey(selectedType), JSON.stringify(draft));
      showDraftToast();
    } catch (e) {
      console.warn("Falha ao salvar rascunho:", e);
    }
  }

  function clearDraft(type) {
    try { localStorage.removeItem(draftKey(type)); } catch (e) {}
  }

  function loadDraft(type) {
    try { return JSON.parse(localStorage.getItem(draftKey(type))); } catch (e) { return null; }
  }

  function showDraftToast() {
    let toast = document.getElementById("draftToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "draftToast";
      toast.className = "draft-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = "Rascunho salvo!";
    toast.classList.add("is-visible");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove("is-visible"), 2500);
  }

  function showDraftBanner(type) {
    const draft = loadDraft(type);
    if (!draft || draft.stepIndex === 0) return;

    const existing = document.getElementById("draftOverlay");
    if (existing) existing.remove();

    const mins = Math.round((Date.now() - draft.savedAt) / 60000);
    const timeLabel = mins < 1 ? "agora mesmo" : mins === 1 ? "há 1 minuto" : `há ${mins} minutos`;

    const overlay = document.createElement("div");
    overlay.id = "draftOverlay";
    overlay.className = "draft-overlay";
    overlay.innerHTML = `
      <div class="draft-overlay__card">
        <div class="draft-overlay__icon"><i class="fa-regular fa-floppy-disk"></i></div>
        <div class="draft-overlay__title">Rascunho encontrado</div>
        <div class="draft-overlay__sub">Você tem um rascunho salvo <strong>${timeLabel}</strong>.<br>Deseja continuar de onde parou?</div>
        <div class="draft-overlay__actions">
          <button type="button" class="draft-overlay__btn draft-overlay__btn--resume">Continuar</button>
          <button type="button" class="draft-overlay__btn draft-overlay__btn--discard">Descartar rascunho</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("is-visible"));

    overlay.querySelector(".draft-overlay__btn--resume").addEventListener("click", () => {
      stateByType[type] = draft.state;
      currentStepIndex = draft.stepIndex;
      overlay.remove();
      renderCurrentStep();
    });

    overlay.querySelector(".draft-overlay__btn--discard").addEventListener("click", () => {
      clearDraft(type);
      overlay.remove();
    });
  }

  if (draftBtn) {
    draftBtn.addEventListener("click", saveDraft);
  }

  function updateDraftBtn() {
    if (!draftBtn) return;
    draftBtn.style.display = "none";
  }

  modal.addEventListener("ic:step-rendered", updateDraftBtn);

  window.IcEquipSelectInit = initEquipSelects;
  window.IcGetPivotList = () => pivotListCache || [];
  // Recalcula o cabeçalho de steps (usado quando algo dentro do step muda
  // a quantidade/rótulo dos passos, sem precisar navegar Próximo/Anterior).
  window.IcEquipStepsRefresh = () => {
    if (!selectedType) return;
    renderSteps(selectedType);
    setButtons();
    updateFooterLayout();
  };

  // =========================
  // Step 4 — Funções (fallback global)
  // OBS: seus handlers já tratam onchange internamente,
  // mas manter isso não muda lógica e ajuda caso você remova de lá depois.
  // =========================
  modal.addEventListener("change", (e) => {
    const el = e.target;
    if (!(el instanceof Element)) return;

    const action = el.getAttribute("data-action");
    if (!action) return;

    if (selectedType !== "irripump" && selectedType !== "medidor") return;

    const handler = window.IcEquipamentos?.[selectedType];
    if (!handler) return;

    const st = (stateByType[selectedType] ||= {});
    st.funcs = st.funcs || {};
    st.funcParams = st.funcParams || {};

    if (action === "func-toggle") {
      const key = el.getAttribute("data-key");
      const checked = el.checked === true;

      st.funcs[key] = checked;
      if (!checked) st.funcParams[key] = "";

      handler.renderStep4(dynamicHost, st);
      return;
    }

    if (action === "func-select") {
      const key = el.getAttribute("data-key");
      st.funcParams[key] = el.value || "";
    }
  });

  // =========================
  // Botões do Step 4 (Excluir módulo) — genérico
  // =========================
  modal.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    if (selectedType !== "irripump" && selectedType !== "medidor") return;

    const handler = window.IcEquipamentos?.[selectedType];
    if (!handler) return;

    const st = (stateByType[selectedType] ||= {});

    // Irripump usa ip-mod-del-first; Medidor usa md-mod-del-first (se você seguiu o padrão que te mandei)
    if (btn.dataset.action === "ip-mod-del-first" || btn.dataset.action === "md-mod-del-first") {
      st.modules = (st.modules || []).slice(1);
      st.funcs = {};
      st.funcParams = {};
      handler.renderStep4(dynamicHost, st);
    }
  });
})();
