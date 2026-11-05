// assets/js/pages/create-farm/index.js
(function initCreateFarm() {
  "use strict";

  const CreateFarm = window.CreateFarm || {};
  if (!CreateFarm.initDomRefs || !CreateFarm.initDomRefs()) return;

  const state = CreateFarm.state || {};
  const events = CreateFarm.events || {};
  const render = CreateFarm.view?.render || {};
  const viewMap = CreateFarm.view?.map || {};

  events.initFarmList?.();

  state.openBtn.addEventListener("click", events.openModal);
  state.closeTriggers.forEach((t) => t.addEventListener("click", events.closeModal));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.modal.classList.contains("is-open")) events.closeModal();
  });

  state.nextBtn.addEventListener("click", events.goNext);
  if (state.prevBtn) state.prevBtn.addEventListener("click", events.goPrev);

  window.IcFarmsAddEquipment = events.addEquipmentToFarm;
  window.IcFarmApplyGeo = viewMap.applyFarmGeo;
  window.IcFarmHideMarkers = viewMap.clearFarmMarkers;
  window.IcFarmShowMarker = viewMap.showActiveFarmMarker;
  window.IcFarmGetActive = viewMap.getActiveFarmForMarker;
  window.IcFarmsRenderEquipment = () => {
    const farm = state.farms.find((item) => item.id === state.currentFarmId) || state.farms[0];
    if (farm) render.renderEquipmentPanels?.(farm);
  };
})();
