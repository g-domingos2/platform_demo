(function initEquipmentDeleteShortcut() {
  "use strict";

  const CARD_SELECTOR = ".map-card__equip[data-equipment-id]";
  let deletionInProgress = false;

  function notifySuccess(message) {
    if (window.IcNotify?.success) window.IcNotify.success(message);
    else alert(message);
  }

  function notifyError(message) {
    if (window.IcNotify?.error) window.IcNotify.error(message);
    else alert(message);
  }

  function removeById(list, equipmentId) {
    if (!Array.isArray(list)) return { list: [], removed: false };
    const filtered = list.filter((item) => String(item?.id || "") !== equipmentId);
    return { list: filtered, removed: filtered.length !== list.length };
  }

  function farmContainsEquipment(farm, equipmentId) {
    return [farm?.equipments, farm?.equipamentos, farm?.pivos].some((list) =>
      Array.isArray(list) && list.some((item) => String(item?.id || "") === equipmentId)
    );
  }

  async function deleteEquipment({ equipmentId, farmId = "", name = "Equipamento" }) {
    equipmentId = String(equipmentId || "");
    farmId = String(
      farmId
      || window.CreateFarm?.state?.currentFarmId
      || window.IcFarmActive?.id
      || ""
    );
    if (!equipmentId || deletionInProgress) return;

    const confirmed = confirm(
      `Excluir permanentemente "${name}"?\n\nEssa ação remove o equipamento da fazenda e não pode ser desfeita.`
    );
    if (!confirmed) return;

    const data = window.Cad?.data;
    if (!data?.getAllFarms || !data?.persistFarmDataset) {
      notifyError("Não foi possível acessar os dados dos equipamentos.");
      return;
    }

    const farms = data.getAllFarms();
    const farm = farms.find((item) => String(item?.id || "") === farmId && farmContainsEquipment(item, equipmentId))
      || farms.find((item) => farmContainsEquipment(item, equipmentId));
    if (!farm) {
      notifyError("Fazenda do equipamento não encontrada.");
      return;
    }

    const canonical = removeById(farm.equipments, equipmentId);
    const legacy = removeById(farm.equipamentos, equipmentId);
    const pivots = removeById(farm.pivos, equipmentId);
    if (!canonical.removed && !legacy.removed && !pivots.removed) {
      notifyError("Equipamento não encontrado para exclusão.");
      return;
    }

    farm.equipments = canonical.list;
    if (Array.isArray(farm.equipamentos)) farm.equipamentos = legacy.list;
    if (Array.isArray(farm.pivos)) farm.pivos = pivots.list;

    deletionInProgress = true;
    try {
      await data.persistFarmDataset(farms);

      if (window.CreateFarm?.state) window.CreateFarm.state.farms = farms;
      window.IcFarmsAll = farms;
      window.Cad?.lists?.renderEquipamentos?.();

      if (window.CreateFarm?.events?.selectFarm) {
        window.CreateFarm.events.selectFarm(farm.id);
      } else {
        window.CreateFarm?.view?.render?.renderEquipmentPanels?.(farm);
        window.IcMapRenderPivots?.(farm);
        window.dispatchEvent(new CustomEvent("ic:farm-changed", { detail: { farm } }));
      }

      window.dispatchEvent(new CustomEvent("ic:equipment-deleted", {
        detail: { equipmentId, farmId: String(farm.id || ""), equipment: name }
      }));
      notifySuccess(`"${name}" excluído com sucesso.`);
    } catch (error) {
      console.error("[EquipmentDeleteShortcut] Falha ao excluir equipamento", error);
      notifyError("Não foi possível excluir o equipamento.");
    } finally {
      deletionInProgress = false;
    }
  }

  document.addEventListener("click", (event) => {
    if (!event.ctrlKey || !event.altKey) return;
    const card = event.target.closest?.(CARD_SELECTOR);
    if (!card) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    void deleteEquipment({
      equipmentId: card.dataset.equipmentId,
      farmId: card.dataset.farmId,
      name: card.querySelector(".map-card__equip-name")?.textContent?.trim() || "Equipamento",
    });
  }, true);

  function handleMapClick(equipment, leafletEvent) {
    const originalEvent = leafletEvent?.originalEvent || leafletEvent;
    if (!originalEvent?.ctrlKey || !originalEvent?.altKey) return false;

    originalEvent.preventDefault?.();
    originalEvent.stopPropagation?.();
    void deleteEquipment({
      equipmentId: equipment?.id,
      farmId: equipment?.farmId || equipment?._farmId || "",
      name: equipment?.name || equipment?.label || "Equipamento",
    });
    return true;
  }

  window.IcEquipmentDeleteShortcut = { deleteEquipment, handleMapClick };
})();
