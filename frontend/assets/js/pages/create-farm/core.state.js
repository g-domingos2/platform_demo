// assets/js/pages/create-farm/core.state.js
(function initCreateFarmState() {
  "use strict";

  const CreateFarm = (window.CreateFarm = window.CreateFarm || {});
  const state = (CreateFarm.state = CreateFarm.state || {});
  const setters = (CreateFarm.setters = CreateFarm.setters || {});

  if (!state.steps) {
    state.steps = ["Geral", "Faturamento", "Contato", "Faixas de Energia", "Localização"];
  }

  if (!state.farmState) {
    state.farmState = {
      name: "",
      clientName: "",
      energyBillDay: "",
      waterBillDay: "",
      timezone: "America/Sao_Paulo",
      hasCentral: false,
      centralRadio: "",
      loc: "",
      lat: -22.008419,
      lng: -46.812567,
      radius: "",
    };
  }

  if (!state.farmBillingState) {
    state.farmBillingState = {
      country: "",
      postal: "",
      city: "",
      address: "",
      region: "",
      regionCode: "",
      neighborhood: "",
      legalName: "",
      docType: "",
      docNumber: "",
      phone: "",
      email: "",
    };
  }

  if (!state.farmContactState) {
    state.farmContactState = {
      useBillingAddress: false,
    };
  }

  if (!Array.isArray(state.farms)) state.farms = [];
  if (!(state.farmMarkers instanceof Map)) state.farmMarkers = new Map();
  if (!(state.farmSelectRegistry instanceof Set)) state.farmSelectRegistry = new Set();
  if (typeof state.farmSelectListenersBound !== "boolean") state.farmSelectListenersBound = false;

  if (typeof state.currentStepIndex !== "number") state.currentStepIndex = 0;
  if (!state.farmLocationMap) state.farmLocationMap = null;
  if (!state.farmLocationMarker) state.farmLocationMarker = null;
  if (!state.farmLayer) state.farmLayer = null;
  if (!state.currentFarmId) state.currentFarmId = null;
  if (!state.activeFarmSnapshot) state.activeFarmSnapshot = null;

  if (typeof state.openBtn === "undefined") state.openBtn = null;
  if (typeof state.modal === "undefined") state.modal = null;
  if (typeof state.nextBtn === "undefined") state.nextBtn = null;
  if (typeof state.prevBtn === "undefined") state.prevBtn = null;
  if (typeof state.stepsContainer === "undefined") state.stepsContainer = null;
  if (typeof state.bodyHost === "undefined") state.bodyHost = null;
  if (typeof state.footer === "undefined") state.footer = null;
  if (typeof state.closeTriggers === "undefined") state.closeTriggers = null;

  if (typeof state.farmListHost === "undefined") state.farmListHost = null;
  if (typeof state.farmSearchInput === "undefined") state.farmSearchInput = null;
  if (typeof state.farmSearchPanel === "undefined") state.farmSearchPanel = null;
  if (typeof state.farmSearchHost === "undefined") state.farmSearchHost = null;
  if (typeof state.mapCardTitle === "undefined") state.mapCardTitle = null;

  function initDomRefs() {
    state.openBtn = document.getElementById("btnCreateFarm");
    state.modal = document.getElementById("createFarmModal");
    state.nextBtn = document.getElementById("btnCreateFarmNext");
    state.prevBtn = document.getElementById("btnCreateFarmPrev");
    state.stepsContainer = document.getElementById("createFarmSteps");
    state.bodyHost = document.getElementById("createFarmBody");
    state.footer = document.getElementById("createFarmFooter");

    if (!state.openBtn || !state.modal || !state.nextBtn || !state.stepsContainer || !state.bodyHost) return false;

    state.closeTriggers = state.modal.querySelectorAll("[data-close-farm]");

    state.farmListHost = document.getElementById("farmList");
    state.farmSearchInput = document.getElementById("farmSearchInput");
    state.farmSearchPanel = document.getElementById("farmSearchPanel");
    state.farmSearchHost = document.getElementById("farmSearch");
    state.mapCardTitle = document.querySelector("#mapCard .map-card__title h2");

    if (state.farmSearchInput) {
      state.farmSearchInput.setAttribute("autocomplete", "new-password");
      state.farmSearchInput.setAttribute("autocapitalize", "off");
      state.farmSearchInput.setAttribute("autocorrect", "off");
      state.farmSearchInput.setAttribute("spellcheck", "false");
      state.farmSearchInput.setAttribute("data-lpignore", "true");
      state.farmSearchInput.name = `farm_search_runtime_${Date.now()}`;
    }

    return true;
  }

  function setCurrentStepIndex(index) {
    state.currentStepIndex = index;
  }

  function setFarmLocationMap(map) {
    state.farmLocationMap = map;
  }

  function setFarmLocationMarker(marker) {
    state.farmLocationMarker = marker;
  }

  function setFarmLayer(layer) {
    state.farmLayer = layer;
  }

  function setCurrentFarmId(id) {
    state.currentFarmId = id;
  }

  function setFarms(list) {
    state.farms = Array.isArray(list) ? list : [];
  }

  function setFarmSelectListenersBound(value) {
    state.farmSelectListenersBound = value;
  }

  function setActiveFarmSnapshot(farm) {
    if (!farm) return;
    state.activeFarmSnapshot = {
      id: farm.id,
      name: farm.name,
      lat: farm.lat,
      lng: farm.lng,
    };
    window.IcFarmActive = { ...state.activeFarmSnapshot };
  }

  function clearActiveFarmSnapshot() {
    state.activeFarmSnapshot = null;
    window.IcFarmActive = null;
  }

  setters.setCurrentStepIndex = setCurrentStepIndex;
  setters.setFarmLocationMap = setFarmLocationMap;
  setters.setFarmLocationMarker = setFarmLocationMarker;
  setters.setFarmLayer = setFarmLayer;
  setters.setCurrentFarmId = setCurrentFarmId;
  setters.setFarms = setFarms;
  setters.setFarmSelectListenersBound = setFarmSelectListenersBound;
  setters.setActiveFarmSnapshot = setActiveFarmSnapshot;
  setters.clearActiveFarmSnapshot = clearActiveFarmSnapshot;

  CreateFarm.initDomRefs = initDomRefs;
})();
