// assets/js/core/farm-utils.js
// Helpers de fazenda ativa compartilhados entre as páginas de equipamento.
//
// Por quê: getActiveFarmEquipments() existia idêntica (byte-a-byte) em
// smart-connect.js e smarttouch.js. getActiveFarmSafe/getFarmEquipmentsSafe/
// normalizeEquipmentText/isWeatherStationEquipment existiam idênticas em
// bombas/view.details.js, medidores/view.details.js e estacoes/view.details.js
// (getActiveFarmSafe também em bombas/view.edit.js, view.edit.gh.js,
// medidores/view.edit.js e repetidoras/view.edit.js). Mesmo padrão de sempre:
// carregado uma vez antes de quem usa.
(function () {
  "use strict";

  // Lê a fazenda ativa (localStorage "ic_farms" + sessionStorage
  // "ic_active_farm"/"ic_active_farm_id") e devolve a lista de
  // equipamentos dela. [] em qualquer cenário inválido/vazio.
  function getActiveFarmEquipments() {
    try {
      const farms = JSON.parse(localStorage.getItem("ic_farms") || "[]");
      if (!Array.isArray(farms) || !farms.length) return [];
      const activeFarmId = sessionStorage.getItem("ic_active_farm") || sessionStorage.getItem("ic_active_farm_id");
      const farm = farms.find((item) => String(item?.id || "") === String(activeFarmId || "")) || farms[0];
      return Array.isArray(farm?.equipments) ? farm.equipments : [];
    } catch (_) {
      return [];
    }
  }

  // Variante usada pelas páginas de bombas/medidores/estações/repetidoras:
  // lê a fazenda ativa de window.IcFarmGetActive (setado por outro módulo)
  // com fallback pra window.icFarmData/IcFarmActive.
  function getActiveFarmSafe() {
    return window.IcFarmGetActive?.() || window.icFarmData || window.IcFarmActive || null;
  }

  // Junta equipments+equipamentos da fazenda, sem duplicar (por id, ou por
  // tipo+nome quando não tem id).
  function getFarmEquipmentsSafe(farm) {
    const listA = Array.isArray(farm?.equipments) ? farm.equipments : [];
    const listB = Array.isArray(farm?.equipamentos) ? farm.equipamentos : [];
    const merged = [...listA, ...listB];
    const seen = new Set();

    return merged.filter((item) => {
      const id = String(item?.id || "");
      const key = id || `${item?.type || ""}_${item?.name || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function normalizeEquipmentText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function isWeatherStationEquipment(item) {
    const type = normalizeEquipmentText(item?.type);
    const category = normalizeEquipmentText(item?.category);
    const name = normalizeEquipmentText(item?.name || item?.nome || item?.data?.nome);

    return type === "weather_station"
      || type === "estacao"
      || type === "estacao meteorologica"
      || type === "estacao_metereologica"
      || type === "estacao_meteorologica"
      || category === "estacoes"
      || category === "estacoes meteorologicas"
      || name.includes("estacao meteorologica");
  }

  window.IcFarm = {
    getActiveFarmEquipments,
    getActiveFarmSafe,
    getFarmEquipmentsSafe,
    normalizeEquipmentText,
    isWeatherStationEquipment,
  };
})();
