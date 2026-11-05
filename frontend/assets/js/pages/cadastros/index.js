(function () {
  "use strict";

  const BR_VIEW = { center: [-14.235, -51.9253], zoom: 4 };

  function getActiveFarmView() {
    if (window.Cad?.data?.getActiveFarmView) {
      return window.Cad.data.getActiveFarmView();
    }
    return BR_VIEW;
  }

  function initCadastros() {
    window.Cad?.encoding?.sanitizeCadastrosDomEncoding?.();
    if (window.IcData && typeof window.IcData === "object") {
      window.IcData = window.Cad?.encoding?.sanitizeMojibakeDeep
        ? window.Cad.encoding.sanitizeMojibakeDeep(window.IcData)
        : window.IcData;
    }
    _loadTalhoesFromStorage();
    normalizeMapActionsPlacement();

    const navItems = document.querySelectorAll("#cadastrosPanel .cadastros-menu__item");
    const sections = document.querySelectorAll("#cadastrosPanel .cad-section");

    navItems.forEach(item => {
      item.addEventListener("click", () => {
        // Remove active de todos
        navItems.forEach(nav => nav.classList.remove("is-active"));
        sections.forEach(sec => {
          sec.classList.remove("is-active");
          sec.style.display = "none";
        });

        // Adiciona active no clicado
        item.classList.add("is-active");
        const sectionId = item.getAttribute("data-section");
        window.IcToggleView(sectionId, 'list');
      });
    });

    loadFarmDataset().finally(async () => {
      await loadSharedAppState();
      loadEnergiaDataset();

      // Expose farms globally so dashboard/map/pivos can consume cadastros data
      const syncGlobalFarms = () => {
        const farms = getAllFarms();
        window.IcFarmsAll = farms;
        if (farms.length && !window.IcFarmActive) {
          window.IcFarmActive = farms[0];
        }
      };
      syncGlobalFarms();

      renderFazendas();
      renderTalhoes();
      if (window.Cad?.lists?.renderPivos) {
        window.Cad.lists.renderPivos();
      } else {
        renderPivos();
      }
      renderEquipamentos();
      if (window.Cad?.lists?.renderVinculos) window.Cad.lists.renderVinculos();
      if (window.Cad?.lists?.renderEnergia) {
        window.Cad.lists.renderEnergia();
      } else {
        renderEnergia();
      }
      if (window.Cad?.lists?.renderFeriados) {
        window.Cad.lists.renderFeriados();
      }
      if (window.Cad?.lists?.renderFaturas) {
        window.Cad.lists.renderFaturas();
      } else {
        renderFaturas();
      }

      // Inicia a primeira tela
      setTimeout(() => {
        window.IcToggleView('fazendas', 'list');
      }, 50);
    });
  }

  // --- GERENCIAMENTO DE ESTADO (CRUD Genérico) ---
  const state = Cad.state || (Cad.state = { activeView: 'list', currentType: null, editingId: null, isPickingFarmLocation: false, isPickingCentralLocation: false, isPickingEquipmentLocation: false });
  const talhoesState = Cad.talhoesState || (Cad.talhoesState = {
    map: null,
    points: [],
    polygon: null,
    previewPolygon: null,
    hoverPoint: null,
    draftLine: null,
    allLayer: null,
    editLayer: null,
    drawLayer: null,
    isDrawing: false,
    vertexMarkers: [],
    midpointMarkers: []
  });
  const pivosState = Cad.pivosState || (Cad.pivosState = {
    map: null,
    listLayer: null,
    editLayer: null,
    talhoesBgLayer: null,
    pickTarget: null
  });
  const SEG_COLORS = Cad.SEG_COLORS || ["#1D4ED8", "#8B5CF6", "#22C55E", "#84CC16", "#F59E0B", "#EF4444", "#EC4899", "#06B6D4", "#F43F5E"];
  Cad.SEG_COLORS = SEG_COLORS;
  function ensureMapActionsContainer(mapCard) {
    if (window.Cad?.toolbar?.ensureMapActionsContainer) {
      return window.Cad.toolbar.ensureMapActionsContainer(mapCard);
    }
    return null;
  }

  function ensureFarmMapActionButton() {
    if (window.Cad?.toolbar?.ensureFarmMapActionButton) {
      return window.Cad.toolbar.ensureFarmMapActionButton();
    }
    return null;
  }

  function normalizeMapActionsPlacement() {
    if (window.Cad?.toolbar?.normalizeMapActionsPlacement) {
      return window.Cad.toolbar.normalizeMapActionsPlacement();
    }
  }

  function invalidateVisibleCadastrosMaps() {
    if (window.Cad?.viewMaps?.invalidateVisibleCadastrosMaps) {
      return window.Cad.viewMaps.invalidateVisibleCadastrosMaps();
    }
  }

  // Bind to window resize to prevent white map on screen change
  window.addEventListener("resize", () => {
    clearTimeout(window._cadastrosResizeTimer);
    window._cadastrosResizeTimer = setTimeout(invalidateVisibleCadastrosMaps, 100);
  });

  function normalizeFarmRecord(farm) {
    if (window.Cad?.data?.normalizeFarmRecord) {
      return window.Cad.data.normalizeFarmRecord(farm);
    }
    return farm && typeof farm === "object" ? farm : {};
  }

  function normalizeFarmDataset(farms) {
    if (window.Cad?.data?.normalizeFarmDataset) {
      return window.Cad.data.normalizeFarmDataset(farms);
    }
    return Array.isArray(farms) ? farms : [];
  }

  async function loadFarmDataset() {
    if (window.Cad?.data?.loadFarmDataset) {
      return window.Cad.data.loadFarmDataset();
    }
    return false;
  }

  async function loadSharedAppState() {
    if (window.Cad?.data?.loadSharedAppState) {
      return window.Cad.data.loadSharedAppState();
    }
    return false;
  }

  function loadEnergiaDataset() {
    if (window.Cad?.data?.loadEnergiaDataset) {
      return window.Cad.data.loadEnergiaDataset();
    }
    return null;
  }

  async function persistFarmDataset(farms) {
    if (window.Cad?.data?.persistFarmDataset) {
      return window.Cad.data.persistFarmDataset(farms);
    }
    return false;
  }

  function syncSectionToolbar(toolbarRoot, view) {
    if (window.Cad?.toolbar?.syncSectionToolbar) {
      return window.Cad.toolbar.syncSectionToolbar(toolbarRoot, view);
    }
  }

  function getSectionCreateLabel(type) {
    if (window.Cad?.toolbar?.getSectionCreateLabel) {
      return window.Cad.toolbar.getSectionCreateLabel(type);
    }
    return "Item";
  }

  function renderMenuActions(section, view) {
    if (window.Cad?.toolbar?.renderMenuActions) {
      return window.Cad.toolbar.renderMenuActions(section, view);
    }
  }



  function syncFarmLocationPickerButton() {
    if (window.Cad?.viewMaps?.syncFarmLocationPickerButton) {
      return window.Cad.viewMaps.syncFarmLocationPickerButton();
    }
  }

  function syncCentralLocationPickerButton() {
    if (window.Cad?.viewMaps?.syncCentralLocationPickerButton) {
      return window.Cad.viewMaps.syncCentralLocationPickerButton();
    }
  }

  function syncPivoCursor() {
    if (window.Cad?.controller?.syncPivoCursor) {
      return window.Cad.controller.syncPivoCursor();
    }
    if (window.Cad?.formPivos?.syncPivoCursor) {
      return window.Cad.formPivos.syncPivoCursor();
    }
    if (window.Cad?.viewMaps?.syncPivoCursor) {
      return window.Cad.viewMaps.syncPivoCursor();
    }
  }

  function toggleView(type, view, id = null) {
    if (window.Cad?.controller?.toggleView) {
      return window.Cad.controller.toggleView(type, view, id);
    }
  }

  window.IcToggleView = toggleView;

  window.IcCancelCurrent = function (type) {
    if (window.Cad?.controller?.cancelCurrent) {
      return window.Cad.controller.cancelCurrent(type);
    }
  };

  window.IcEquipPickerBack = function () {
    if (window.Cad?.controller?.equipPickerBack) {
      return window.Cad.controller.equipPickerBack();
    }
  };

  window.IcStartFarmLocationPick = function () {
    if (window.Cad?.controller?.startFarmLocationPick) {
      return window.Cad.controller.startFarmLocationPick();
    }
  };

  window.IcStartCentralLocationPick = function () {
    if (window.Cad?.controller?.startCentralLocationPick) {
      return window.Cad.controller.startCentralLocationPick();
    }
  };

  function renderForm(type, id, container) {
    if (window.Cad?.controller?.renderForm) {
      return window.Cad.controller.renderForm(type, id, container);
    }
  }

  function initTableSortFilter(tableEl, filterColIdx = -1, onFilter = null) {
    if (window.Cad?.toolbar?.initTableSortFilter) {
      return window.Cad.toolbar.initTableSortFilter(tableEl, filterColIdx, onFilter);
    }
  }

  function getEquipmentTypeLabel(type) {
    if (window.Cad?.ui?.getEquipmentTypeLabel) {
      return window.Cad.ui.getEquipmentTypeLabel(type);
    }
    const labels = {
      smart_connect: "Central (SmartConnect)",
      repetidora: "Repetidora",
      irripump: "Irripump",
      medidor: "Medidor de Nível",
      pluviometro: "Pluviômetro",
      estacao_metereologica: "Estação Meteorológica",
      rainstar: "Carretel (Rainstar)"
    };
    return labels[String(type || "")] || "Equipamento";
  }

  function renderFormEquipamentos(id, container, preselectedType = null) {
    if (window.Cad?.formEquipamentos?.renderFormEquipamentos) {
      return window.Cad.formEquipamentos.renderFormEquipamentos(id, container, preselectedType);
    }
  }

  function renderFormEnergia(id, container) {
    if (window.Cad?.formEnergia?.renderFormEnergia) {
      return window.Cad.formEnergia.renderFormEnergia(id, container);
    }
  }

  function renderFormFaturas(id, container) {
    if (window.Cad?.formEnergia?.renderFormFaturas) {
      return window.Cad.formEnergia.renderFormFaturas(id, container);
    }
  }

  function renderFormFazendas(id, container) {
    if (window.Cad?.formFazendas?.renderFormFazendas) {
      return window.Cad.formFazendas.renderFormFazendas(id, container);
    }
  }

  function bindCadastrosBillingForm(data) {
    if (window.Cad?.formFazendas?.bindCadastrosBillingForm) {
      return window.Cad.formFazendas.bindCadastrosBillingForm(data);
    }
  }

  function setupFarmFormFormatters() {
    if (window.Cad?.formFazendas?.setupFarmFormFormatters) {
      return window.Cad.formFazendas.setupFarmFormFormatters();
    }
  }

  function _loadTalhoesFromStorage() {
    if (window.Cad?.data?._loadTalhoesFromStorage) {
      return window.Cad.data._loadTalhoesFromStorage();
    }
  }

  function getTalhoesByFarm(farmId) {
    if (window.Cad?.data?.getTalhoesByFarm) {
      return window.Cad.data.getTalhoesByFarm(farmId);
    }
    return [];
  }

  function saveTalhoesByFarm(farmId, items) {
    if (window.Cad?.data?.saveTalhoesByFarm) {
      return window.Cad.data.saveTalhoesByFarm(farmId, items);
    }
  }

  function parseTalhaoCompositeId(compositeId) {
    if (window.Cad?.data?.parseTalhaoCompositeId) {
      return window.Cad.data.parseTalhaoCompositeId(compositeId);
    }
    return null;
  }

  function buildTalhaoCompositeId(farmId, talhaoId) {
    if (window.Cad?.data?.buildTalhaoCompositeId) {
      return window.Cad.data.buildTalhaoCompositeId(farmId, talhaoId);
    }
    return "";
  }

  function getCurrentContextFarmId() {
    if (window.Cad?.data?.getCurrentContextFarmId) {
      return window.Cad.data.getCurrentContextFarmId();
    }
    return "";
  }

  function getCurrentTalhaoFormFarmId() {
    if (window.Cad?.data?.getCurrentTalhaoFormFarmId) {
      return window.Cad.data.getCurrentTalhaoFormFarmId();
    }
    return getCurrentContextFarmId();
  }

  function getCurrentEditingTalhaoId() {
    if (window.Cad?.data?.getCurrentEditingTalhaoId) {
      return window.Cad.data.getCurrentEditingTalhaoId();
    }
    return "";
  }

  function getTalhoesSnapVertices(farmId, excludeTalhaoId = "") {
    if (window.Cad?.formTalhoes?.getTalhoesSnapVertices) {
      return window.Cad.formTalhoes.getTalhoesSnapVertices(farmId, excludeTalhaoId);
    }
    return [];
  }

  function snapTalhaoPoint(rawPoint, farmId, excludeTalhaoId = "") {
    if (window.Cad?.formTalhoes?.snapTalhaoPoint) {
      return window.Cad.formTalhoes.snapTalhaoPoint(rawPoint, farmId, excludeTalhaoId);
    }
    return rawPoint;
  }

  function focusTalhoesMapOnFarm(farmId) {
    if (window.Cad?.formTalhoes?.focusTalhoesMapOnFarm) {
      return window.Cad.formTalhoes.focusTalhoesMapOnFarm(farmId);
    }
  }

  function getAllTalhoesRecords(farmFilterId = null) {
    if (window.Cad?.data?.getAllTalhoesRecords) {
      return window.Cad.data.getAllTalhoesRecords(farmFilterId);
    }
    return [];
  }

  function calculatePolygonAreaHa(latLngs) {
    if (window.Cad?.formTalhoes?.calculatePolygonAreaHa) {
      return window.Cad.formTalhoes.calculatePolygonAreaHa(latLngs);
    }
    if (window.Cad?.geo?.calculatePolygonAreaHa) {
      return window.Cad.geo.calculatePolygonAreaHa(latLngs);
    }
    return 0;
  }

  function clearTalhoesDraft() {
    if (window.Cad?.formTalhoes?.clearTalhoesDraft) {
      return window.Cad.formTalhoes.clearTalhoesDraft();
    }
  }

  function clearTalhoesEditHandles() {
    if (window.Cad?.formTalhoes?.clearTalhoesEditHandles) {
      return window.Cad.formTalhoes.clearTalhoesEditHandles();
    }
  }

  function updateTalhoesAreaInput() {
    if (window.Cad?.formTalhoes?.updateTalhoesAreaInput) {
      return window.Cad.formTalhoes.updateTalhoesAreaInput();
    }
  }

  function rebuildTalhoesEditHandles() {
    if (window.Cad?.formTalhoes?.rebuildTalhoesEditHandles) {
      return window.Cad.formTalhoes.rebuildTalhoesEditHandles();
    }
  }

  function renderTalhoesDraftGeometry() {
    if (window.Cad?.formTalhoes?.renderTalhoesDraftGeometry) {
      return window.Cad.formTalhoes.renderTalhoesDraftGeometry();
    }
  }

  function finalizeTalhoesDrawing() {
    if (window.Cad?.formTalhoes?.finalizeTalhoesDrawing) {
      return window.Cad.formTalhoes.finalizeTalhoesDrawing();
    }
  }

  function activateTalhoesEditMode(points) {
    if (window.Cad?.formTalhoes?.activateTalhoesEditMode) {
      return window.Cad.formTalhoes.activateTalhoesEditMode(points);
    }
    return false;
  }

  function clearTalhoesPolygon() {
    if (window.Cad?.formTalhoes?.clearTalhoesPolygon) {
      return window.Cad.formTalhoes.clearTalhoesPolygon();
    }
  }

  function updateTalhoesDrawUi() {
    if (window.Cad?.formTalhoes?.updateTalhoesDrawUi) {
      return window.Cad.formTalhoes.updateTalhoesDrawUi();
    }
  }

  function bindTalhoesMapEvents() {
    if (window.Cad?.formTalhoes?.bindTalhoesMapEvents) {
      return window.Cad.formTalhoes.bindTalhoesMapEvents();
    }
  }

  function renderTalhoesMap(records, options = {}) {
    if (window.Cad?.viewMaps?.renderTalhoesMap) {
      return window.Cad.viewMaps.renderTalhoesMap(records, options);
    }
  }

  function renderFormTalhoes(compositeId, container) {
    if (window.Cad?.formTalhoes?.renderFormTalhoes) {
      return window.Cad.formTalhoes.renderFormTalhoes(compositeId, container);
    }
  }

  function parsePivoCompositeId(compositeId) {
    if (window.Cad?.data?.parsePivoCompositeId) {
      return window.Cad.data.parsePivoCompositeId(compositeId);
    }
    return null;
  }

  function getAllPivosRecords(farmFilterId = null) {
    if (window.Cad?.data?.getAllPivosRecords) {
      return window.Cad.data.getAllPivosRecords(farmFilterId);
    }
    return [];
  }

  function calculatePivoAreaHa(pivoOrRadius) {
    if (window.Cad?.geo?.calculatePivoAreaHa) {
      return window.Cad.geo.calculatePivoAreaHa(pivoOrRadius);
    }
    return "";
  }

  function calculateBearingPoint(lat, lng, radiusMeters, bearingDeg) {
    if (window.Cad?.geo?.calculateBearingPoint) {
      return window.Cad.geo.calculateBearingPoint(lat, lng, radiusMeters, bearingDeg);
    }
    return null;
  }

  function calculateNorthReference(lat, lng, radiusMeters) {
    if (window.Cad?.geo?.calculateNorthReference) {
      return window.Cad.geo.calculateNorthReference(lat, lng, radiusMeters);
    }
    return null;
  }

  function normalizeBearingDeg(value) {
    if (window.Cad?.geo?.normalizeBearingDeg) {
      return window.Cad.geo.normalizeBearingDeg(value);
    }
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return ((num % 360) + 360) % 360;
  }

  function toBooleanFlag(value) {
    if (window.Cad?.geo?.toBooleanFlag) {
      return window.Cad.geo.toBooleanFlag(value);
    }
    return value === true;
  }

  function destinationPointByBearing(lat, lng, radiusMeters, bearingDeg) {
    if (window.Cad?.geo?.destinationPointByBearing) {
      return window.Cad.geo.destinationPointByBearing(lat, lng, radiusMeters, bearingDeg);
    }
    return null;
  }

  function bearingBetweenPoints(lat1, lng1, lat2, lng2) {
    if (window.Cad?.geo?.bearingBetweenPoints) {
      return window.Cad.geo.bearingBetweenPoints(lat1, lng1, lat2, lng2);
    }
    return null;
  }

  function buildSectorPolygonLatLngs(lat, lng, radiusMeters, startBearingDeg, endBearingDeg, steps = 96) {
    if (window.Cad?.geo?.buildSectorPolygonLatLngs) {
      return window.Cad.geo.buildSectorPolygonLatLngs(lat, lng, radiusMeters, startBearingDeg, endBearingDeg, steps);
    }
    return [];
  }

  function calculateDistanceMeters(lat1, lng1, lat2, lng2) {
    if (window.Cad?.geo?.calculateDistanceMeters) {
      return window.Cad.geo.calculateDistanceMeters(lat1, lng1, lat2, lng2);
    }
    return null;
  }

  function syncPivoRadiusFromInputs() {
    if (window.Cad?.formPivos?.syncPivoRadiusFromInputs) {
      return window.Cad.formPivos.syncPivoRadiusFromInputs();
    }
  }

  function syncPivoNorthReferenceFromInputs() {
    if (window.Cad?.formPivos?.syncPivoNorthReferenceFromInputs) {
      return window.Cad.formPivos.syncPivoNorthReferenceFromInputs();
    }
  }

  function ensurePivotPluviometer(farm, pivo) {
    if (!farm || !pivo || !pivo.enablePluviometro) return;

    const lat = Number(pivo.lat);
    const lng = Number(pivo.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    farm.equipments = Array.isArray(farm.equipments) ? farm.equipments : [];
    const pivotId = String(pivo.id || "");
    if (!pivotId) return;

    const existing = farm.equipments.find((equip) => {
      const isPluvio = String(equip?.category || "").toLowerCase() === "pluviometros";
      const linked = String(equip?.data?.linkedPivotId || "");
      return isPluvio && linked === pivotId;
    });

    const payload = {
      lat,
      lng,
      loc: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      serial: existing?.data?.serial || "",
      nome: existing?.data?.nome || `Pluviômetro - ${pivo.name || "Pivô"}`,
      linkedPivotId: pivotId
    };

    if (existing) {
      existing.name = existing.name || payload.nome;
      existing.type = existing.type || "pluviometro";
      existing.category = "pluviometros";
      existing.data = { ...(existing.data || {}), ...payload };
      return;
    }

    farm.equipments.push({
      id: `equip_${Date.now()}`,
      type: "pluviometro",
      category: "pluviometros",
      name: payload.nome,
      createdAt: new Date().toISOString(),
      data: payload
    });
  }

  function normalizePivoRecord(source, farmId) {
    if (window.Cad?.data?.normalizePivoRecord) {
      return window.Cad.data.normalizePivoRecord(source, farmId);
    }
    return source && typeof source === "object" ? source : {};
  }

  function collectPivoFormData() {
    if (window.Cad?.formPivos?.collectPivoFormData && window.Cad.formPivos.collectPivoFormData !== collectPivoFormData) {
      return window.Cad.formPivos.collectPivoFormData();
    }

    return normalizePivoRecord({
      id: document.getElementById("pivo_id")?.value || `pivo_${Date.now()}`,
      farmId: document.getElementById("pivo_farm")?.value || getCurrentContextFarmId(),
      name: document.getElementById("pivo_name")?.value?.trim() || "",
      lat: document.getElementById("pivo_lat")?.value || "",
      lng: document.getElementById("pivo_lng")?.value || "",
      refLat: document.getElementById("pivo_refLat")?.value || "",
      refLng: document.getElementById("pivo_refLng")?.value || "",
      radius: document.getElementById("pivo_radius")?.value || "",
      parcelas: [],
      segments: []
    });
  }


  function resetPivoCoordinateInputs() {
    if (window.Cad?.formPivos?.resetPivoCoordinateInputs && window.Cad.formPivos.resetPivoCoordinateInputs !== resetPivoCoordinateInputs) {
      window.Cad.formPivos.resetPivoCoordinateInputs();
      return;
    }
    ["pivo_lat", "pivo_lng", "pivo_center", "pivo_refLat", "pivo_refLng", "pivo_ref", "pivo_lastTowerLat", "pivo_lastTowerLng", "pivo_lastTowerRadius", "pivo_startLat", "pivo_startLng", "pivo_endLat", "pivo_endLng"].forEach((id) => {
      const input = document.getElementById(id);
      if (input) input.value = "";
    });
  }

  function centerPivoMapOnFarm(map, farmId, zoom = 14) {
    if (window.Cad?.formPivos?.centerPivoMapOnFarm) {
      return window.Cad.formPivos.centerPivoMapOnFarm(map, farmId, zoom);
    }
    if (window.Cad?.viewMaps?.centerPivoMapOnFarm) {
      return window.Cad.viewMaps.centerPivoMapOnFarm(map, farmId, zoom);
    }
    return false;
  }

  function bindPivoMapPickEvents() {
    if (window.Cad?.formPivos?.bindPivoMapPickEvents) {
      return window.Cad.formPivos.bindPivoMapPickEvents();
    }
  }

  function renderPivosFormMap(formData, allRecords) {
    if (window.Cad?.pivosMaps?.renderPivosFormMap) {
      return window.Cad.pivosMaps.renderPivosFormMap(formData, allRecords);
    }
  }

  function renderPivosSectionMap(records) {
    if (window.Cad?.pivosMaps?.renderPivosSectionMap) {
      return window.Cad.pivosMaps.renderPivosSectionMap(records);
    }
  }

  function renderFormPivos(compositeId, container) {
    if (window.Cad?.pivosFormRender?.renderFormPivos) {
      return window.Cad.pivosFormRender.renderFormPivos(compositeId, container);
    }
  }

  async function savePivoRecord() {
    if (window.Cad?.actionsSave?.savePivoRecord) {
      return window.Cad.actionsSave.savePivoRecord();
    }
    return false;
  }

  window.IcSaveRecord = async function (type) {
    if (window.Cad?.actionsSave?.saveRecord) {
      return window.Cad.actionsSave.saveRecord(type);
    }
  };

  window.IcDuplicateRecord = async function (id) {
    if (window.Cad?.actionsSave?.duplicateRecord) {
      return window.Cad.actionsSave.duplicateRecord(id);
    }
  };

  function inferDeleteType(id) {
    if (window.Cad?.actions?.inferDeleteType) {
      return window.Cad.actions.inferDeleteType(id);
    }
    const rawId = String(id || "");
    if (state.currentType) return state.currentType;
    if (rawId.includes("::")) {
      if (rawId.includes("talhao_")) return "talhoes";
      return "sistemas-irrigacao";
    }
    if (rawId.startsWith("farm_")) return "fazendas";
    return "";
  }

  window.IcDeleteRecord = async function (id) {
    if (window.Cad?.actions?.deleteRecord) {
      return window.Cad.actions.deleteRecord(id);
    }
  };

  function syncFarmDataset(farms) {
    if (window.Cad?.data?.syncFarmDataset) {
      return window.Cad.data.syncFarmDataset(farms);
    }
  }

  function getAllFarms() {
    if (window.Cad?.data?.getAllFarms) {
      return window.Cad.data.getAllFarms();
    }
    return [];
  }

  function renderFazendas() {
    if (window.Cad?.lists?.renderFazendas && window.Cad.lists.renderFazendas !== renderFazendas) {
      return window.Cad.lists.renderFazendas();
    }
  }

  function farmMarkerIcon() {
    if (window.Cad?.viewMaps?.farmMarkerIcon) {
      return window.Cad.viewMaps.farmMarkerIcon();
    }
    return null;
  }

  function centralMarkerIcon() {
    if (window.Cad?.viewMaps?.centralMarkerIcon) {
      return window.Cad.viewMaps.centralMarkerIcon();
    }
    return null;
  }

  function sectionMarkerIcon(mapId, record) {
    if (window.Cad?.viewMaps?.sectionMarkerIcon) {
      return window.Cad.viewMaps.sectionMarkerIcon(mapId, record);
    }
    return null;
  }

  function renderFazendasMap(farms) {
    if (window.Cad?.viewMaps?.renderFazendasMap) {
      return window.Cad.viewMaps.renderFazendasMap(farms);
    }
  }

  function extractPoint(record) {
    if (window.Cad?.viewMaps?.extractPoint) {
      return window.Cad.viewMaps.extractPoint(record);
    }
    return null;
  }

  function ensureSectionMap(mapId) {
    if (window.Cad?.viewMaps?.ensureSectionMap) {
      return window.Cad.viewMaps.ensureSectionMap(mapId);
    }
    return null;
  }

  function syncEquipFormMarker(lat, lng) {
    if (window.Cad?.viewMaps?.syncEquipFormMarker) {
      return window.Cad.viewMaps.syncEquipFormMarker(lat, lng);
    }
  }

  function removeEquipFormMarker() {
    if (window.Cad?.viewMaps?.removeEquipFormMarker) {
      return window.Cad.viewMaps.removeEquipFormMarker();
    }
  }

  function renderSectionMap(mapId, records, getLabel) {
    if (window.Cad?.viewMaps?.renderSectionMap) {
      return window.Cad.viewMaps.renderSectionMap(mapId, records, getLabel);
    }
  }

  function renderTalhoes() {
    if (window.Cad?.lists?.renderTalhoes && window.Cad.lists.renderTalhoes !== renderTalhoes) {
      return window.Cad.lists.renderTalhoes();
    }
  }

  function renderPivos() {
    if (window.Cad?.lists?.renderPivos && window.Cad.lists.renderPivos !== renderPivos) {
      return window.Cad.lists.renderPivos();
    }
  }



  function renderParcelas() {
    if (window.Cad?.lists?.renderParcelas && window.Cad.lists.renderParcelas !== renderParcelas) {
      return window.Cad.lists.renderParcelas();
    }
  }



  function renderEquipamentos() {
    if (window.Cad?.lists?.renderEquipamentos && window.Cad.lists.renderEquipamentos !== renderEquipamentos) {
      return window.Cad.lists.renderEquipamentos();
    }
  }



  function renderEnergia() {
    if (window.Cad?.lists?.renderEnergia && window.Cad.lists.renderEnergia !== renderEnergia) {
      return window.Cad.lists.renderEnergia();
    }
  }

  function renderFaturas() {
    if (window.Cad?.lists?.renderFaturas && window.Cad.lists.renderFaturas !== renderFaturas) {
      return window.Cad.lists.renderFaturas();
    }
  }

  renderTalhoes = function () {
    if (window.Cad?.lists?.renderTalhoes && window.Cad.lists.renderTalhoes !== renderTalhoes) {
      return window.Cad.lists.renderTalhoes();
    }
  };



  renderPivos = function () {
    if (window.Cad?.lists?.renderPivos && window.Cad.lists.renderPivos !== renderPivos) {
      return window.Cad.lists.renderPivos();
    }
  };



  window.Cad = window.Cad || {};
  window.Cad.pivosHelpers = Object.assign(window.Cad.pivosHelpers || {}, {
    renderFormPivos,
    normalizePivoRecord,
    collectPivoFormData,
    renderPivosFormMap,
    syncPivoRadiusFromInputs,
    syncPivoNorthReferenceFromInputs,
    ensurePivotPluviometer,
    resetPivoCoordinateInputs,
    centerPivoMapOnFarm,
    bindPivoMapPickEvents,
    syncPivoCursor,
    renderPivosSectionMap,
    setEmptyPivosColspan: function () {
      const table = document.querySelector("#section-sistemas-irrigacao table");
      if (!table) return;
      const colCount = Math.max(1, table.querySelectorAll("thead th").length || 7);
      const cell = table.querySelector("tbody tr td[colspan]");
      if (cell) cell.setAttribute("colspan", String(colCount));
    }
  });
  window.Cad.forms = Object.assign(window.Cad.forms || {}, {
    renderFormFazendas,
    renderFormTalhoes,
    renderFormPivos,
    renderFormEquipamentos,
    renderFormEnergia,
    renderFormFaturas
  });
  window.Cad.lists = Object.assign(window.Cad.lists || {}, {
    renderFazendas: window.Cad.lists?.renderFazendas || renderFazendas,
    renderTalhoes: window.Cad.lists?.renderTalhoes || renderTalhoes,
    renderParcelas: window.Cad.lists?.renderParcelas || renderParcelas,
    renderPivos: window.Cad.lists?.renderPivos || renderPivos,
    renderEquipamentos: window.Cad.lists?.renderEquipamentos || renderEquipamentos,
    renderEnergia: window.Cad.lists?.renderEnergia || renderEnergia,
    renderFaturas: window.Cad.lists?.renderFaturas || renderFaturas
  });
  window.Cad.initCadastros = initCadastros;
  window.IcInitCadastros = initCadastros;
})();
