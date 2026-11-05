(function () {
  "use strict";
  const Cad = (window.Cad = window.Cad || {});

  const state = Cad.state || (Cad.state = {
    activeView: "list",
    currentType: null,
    editingId: null,
    isPickingFarmLocation: false,
    isPickingCentralLocation: false,
    isPickingEquipmentLocation: false
  });
  const talhoesState = Cad.talhoesState || (Cad.talhoesState = {});
  const pivosState = Cad.pivosState || (Cad.pivosState = {});
  const maps = Cad.maps || (Cad.maps = {});

  function sanitizeDom(root) {
    return Cad.encoding?.sanitizeCadastrosDomEncoding?.(root);
  }

  function normalizeMapActionsPlacement() {
    return Cad.toolbar?.normalizeMapActionsPlacement?.();
  }

  function renderMenuActions(section, view) {
    return Cad.toolbar?.renderMenuActions?.(section, view);
  }

  function invalidateVisibleCadastrosMaps() {
    return Cad.viewMaps?.invalidateVisibleCadastrosMaps?.();
  }

  function removeEquipFormMarker() {
    return Cad.viewMaps?.removeEquipFormMarker?.();
  }

  function syncFarmLocationPickerButton() {
    return Cad.viewMaps?.syncFarmLocationPickerButton?.();
  }

  function syncCentralLocationPickerButton() {
    return Cad.viewMaps?.syncCentralLocationPickerButton?.();
  }

  function syncPivoCursor() {
    if (Cad.formPivos?.syncPivoCursor) {
      Cad.formPivos.syncPivoCursor();
      return;
    }
    if (Cad.viewMaps?.syncPivoCursor) {
      Cad.viewMaps.syncPivoCursor();
      return;
    }
    if (pivosState.map && pivosState.map.getContainer) {
      pivosState.map.getContainer().style.cursor = pivosState.pickTarget ? "crosshair" : "";
    }
  }

  function renderForm(type, id, container) {
    if (type === "fazendas") {
      if (Cad.formFazendas?.renderFormFazendas) {
        Cad.formFazendas.renderFormFazendas(id, container);
        return;
      }
    }
    if (type === "talhoes") {
      if (Cad.formTalhoes?.renderFormTalhoes) {
        Cad.formTalhoes.renderFormTalhoes(id, container);
        return;
      }
    }
    if (type === "sistemas-irrigacao") {
      if (Cad.formPivos?.renderFormPivos) {
        Cad.formPivos.renderFormPivos(id, container);
        return;
      }
    }
    if (type === "equipamentos") {
      if (Cad.formEquipamentos?.renderFormEquipamentos) {
        Cad.formEquipamentos.renderFormEquipamentos(id, container);
        return;
      }
    }
    if (type === "energia") {
      if (Cad.formEnergia?.renderFormEnergia) {
        Cad.formEnergia.renderFormEnergia(id, container);
        return;
      }
    }
    if (type === "faturas") {
      if (Cad.formEnergia?.renderFormFaturas) {
        Cad.formEnergia.renderFormFaturas(id, container);
        return;
      }
    }

    const typeLabel = {
      fazendas: "Fazenda",
      talhoes: "Talhão",
      "sistemas-irrigacao": "Pivô",
      parcelas: "Parcela",
      equipamentos: "Equipamento",
      energia: "Energia",
      feriados: "Feriado",
      faturas: "Fatura",
      "estudo-sinal": "Estudo de Sinal"
    }[type] || "Item";

    container.innerHTML = `
    <div class="cadastros-form-card">
      <div class="cadastros-form-content">
        <div class="cadastros-form-topbar">
          <div class="cadastros-form-topbar__text"><span>${id ? "Editar" : "Adicionar"}</span> <span>${typeLabel}</span></div>
        </div>
        <div class="cadastros-form-section is-active">
          <div class="cadastros-form-grid cadastros-form-grid--pivo">
            <div class="equip-field">
              <label class="equip-label" for="form_name">Nome / Descrição</label>
              <input type="text" class="equip-input" id="form_name" placeholder="Nome do item">
            </div>
            <div class="equip-field">
              <label class="equip-label" for="form_details">Detalhes</label>
              <input type="text" class="equip-input" id="form_details" placeholder="Detalhes adicionais">
            </div>
          </div>
          <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
            <i class="fa-solid fa-info-circle"></i> <span>O formulário para a categoria</span> (${typeLabel}) <span>deve ser mapeado conforme cadastros.json.</span>
          </p>
        </div>
      </div>
    </div>`;
  }

  function toggleView(type, view, id = null) {
    state.activeView = view || "list";
    state.currentType = type;
    state.editingId = id || null;
    const section = document.getElementById("section-" + type);
    if (!section) return;

    document.querySelectorAll("#cadastrosPanel .cad-section").forEach((sec) => {
      sec.classList.remove("is-active");
      sec.classList.remove("is-form-view");
      sec.style.display = "none";
    });

    section.classList.add("is-active");
    if (view === "form") section.classList.add("is-form-view");
    section.style.display = "";

    const tablePanel = section.querySelector(".cad-table-panel");
    const tableContainer =
      section.querySelector(".cq-left > .table-responsive") ||
      section.querySelector(".cf-main > .table-responsive") ||
      section.querySelector(".cq-left .irrigation-report__table-wrap") ||
      section.querySelector(".cq-left .cadastros-table");
    const formHost = section.querySelector(".cadastros-form-host");
    const actionsHeader = document.querySelector(".cad-actions");

    if (tablePanel) {
      tablePanel.style.display = view === "form" ? "none" : "";
    } else if (tableContainer) {
      tableContainer.style.display = view === "form" ? "none" : "block";
    }
    if (actionsHeader) actionsHeader.innerHTML = "";
    renderMenuActions(section, view);

    if (formHost) {
      if (view === "form") {
        formHost.style.display = "block";
        renderForm(type, id, formHost);
      } else {
        formHost.style.display = "none";
        formHost.innerHTML = "";
        if (type === "equipamentos") removeEquipFormMarker();
      }
    }

    normalizeMapActionsPlacement();

    const sectionRenderers = {
      fazendas: () => Cad.lists?.renderFazendas?.(),
      talhoes: () => Cad.lists?.renderTalhoes?.(),
      "sistemas-irrigacao": () => Cad.lists?.renderPivos?.(),
      equipamentos: () => Cad.lists?.renderEquipamentos?.(),
      energia: () => Cad.lists?.renderEnergia?.(),
      feriados: () => Cad.lists?.renderFeriados?.(),
      faturas: () => Cad.lists?.renderFaturas?.(),
      "estudo-sinal": () => {
        // Popula o select de fazendas na nova seção
        const select = document.getElementById("signal_farm_select");
        if (select && Cad.data.getAllFarms) {
          const farms = Cad.data.getAllFarms();
          select.innerHTML = '<option value="">Selecione a fazenda...</option>' + 
            farms.map(f => `<option value="${f.id}">${f.name}</option>`).join("");
        }
      }
    };
    const skipSectionRender = view === "form" && (type === "talhoes" || type === "sistemas-irrigacao");
    if (!skipSectionRender && sectionRenderers[type]) {
      sectionRenderers[type]();
    }
    sanitizeDom(section);

    setTimeout(() => invalidateVisibleCadastrosMaps(), 0);
    setTimeout(() => {
      invalidateVisibleCadastrosMaps();
      if (!skipSectionRender && sectionRenderers[type]) {
        sectionRenderers[type]();
      }
      sanitizeDom(section);
    }, 250);
  }

  function cancelCurrent(type) {
    state.isPickingFarmLocation = false;
    state.isPickingCentralLocation = false;
    state.isPickingEquipmentLocation = false;

    if (type === "talhoes") {
      talhoesState.isDrawing = false;
      Cad.formTalhoes?.clearTalhoesDraft?.();
      if (talhoesState.map?.doubleClickZoom) talhoesState.map.doubleClickZoom.enable();
      Cad.formTalhoes?.updateTalhoesDrawUi?.();
    }

    if (type === "sistemas-irrigacao") {
      pivosState.pickTarget = null;
      syncPivoCursor();
      if (pivosState.editLayer) pivosState.editLayer.clearLayers();
      if (pivosState.talhoesBgLayer) pivosState.talhoesBgLayer.clearLayers();
      if (pivosState.pluvioLayer) pivosState.pluvioLayer.clearLayers();
      if (maps.pivoTalhoesOutsideClickHandler) {
        document.removeEventListener("click", maps.pivoTalhoesOutsideClickHandler);
        maps.pivoTalhoesOutsideClickHandler = null;
      }
    }

    syncFarmLocationPickerButton();
    toggleView(type, "list");
  }

  function equipPickerBack() {
    const section = document.getElementById("section-equipamentos");
    const formHost = section?.querySelector(".cadastros-form-host");
    if (!formHost) return;
    state.isPickingEquipmentLocation = false;
    removeEquipFormMarker();
    if (Cad.formEquipamentos?.renderFormEquipamentos) {
      Cad.formEquipamentos.renderFormEquipamentos(null, formHost);
    }
  }

  function startFarmLocationPick() {
    state.isPickingFarmLocation = !state.isPickingFarmLocation;
    if (state.isPickingFarmLocation) state.isPickingCentralLocation = false;
    syncFarmLocationPickerButton();
    syncCentralLocationPickerButton();
  }

  function startCentralLocationPick() {
    state.isPickingCentralLocation = !state.isPickingCentralLocation;
    if (state.isPickingCentralLocation) state.isPickingFarmLocation = false;
    syncCentralLocationPickerButton();
    syncFarmLocationPickerButton();
  }

  window.IcToggleView = toggleView;
  window.IcCancelCurrent = cancelCurrent;
  window.IcEquipPickerBack = equipPickerBack;
  window.IcStartFarmLocationPick = startFarmLocationPick;
  window.IcStartCentralLocationPick = startCentralLocationPick;

  Cad.controller = Object.assign(Cad.controller || {}, {
    syncPivoCursor,
    renderForm,
    toggleView,
    cancelCurrent,
    equipPickerBack,
    startFarmLocationPick,
    startCentralLocationPick
  });
})();
