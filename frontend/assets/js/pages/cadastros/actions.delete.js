(function () {
  "use strict";
  const tMsg = (text) => window.IcI18n?.t?.(text) ?? text;
  const Cad = (window.Cad = window.Cad || {});

  const state = Cad.state || (Cad.state = {});
  const getAllFarms = () => Cad.data.getAllFarms();
  const persistFarmDataset = (farms) => Cad.data.persistFarmDataset(farms);
  const persistEnergiaDataset = (energia) => Cad.data?.persistEnergiaDataset?.(energia);
  const parseTalhaoCompositeId = (id) => Cad.data.parseTalhaoCompositeId(id);
  const getTalhoesByFarm = (farmId) => Cad.data.getTalhoesByFarm(farmId);
  const saveTalhoesByFarm = (farmId, items) => Cad.data.saveTalhoesByFarm(farmId, items);
  const parsePivoCompositeId = (id) => Cad.data.parsePivoCompositeId(id);
  const getFarmEquipmentList = (farm) => Cad.data.getFarmEquipmentList(farm);

  const renderFazendas = () => Cad.lists?.renderFazendas?.();
  const renderTalhoes = () => Cad.lists?.renderTalhoes?.();
  const renderPivos = () => Cad.lists?.renderPivos?.();
  const renderParcelas = () => Cad.lists?.renderParcelas?.();
  const renderEquipamentos = () => Cad.lists?.renderEquipamentos?.();
  const renderEnergia = () => Cad.lists?.renderEnergia?.();
  const renderFaturas = () => Cad.lists?.renderFaturas?.();

  function inferDeleteType(id) {
    const rawId = String(id || "");
    if (state.currentType) return state.currentType;
    if (rawId.includes("::")) {
      if (rawId.includes("talhao_")) return "talhoes";
      return "sistemas-irrigacao";
    }
    if (rawId.startsWith("farm_")) return "fazendas";
    return "";
  }

  async function deleteRecord(id) {
    if (!confirm(tMsg("Deseja realmente excluir este registro? Essa ação não pode ser desfeita."))) return;

    const type = inferDeleteType(id);
    const rawId = String(id || "");

    if (type === "fazendas" || !type) {
      let farms = getAllFarms();
      farms = farms.filter((f) => String(f.id) !== rawId);
      await persistFarmDataset(farms);

      if (window.IcFarmActive && String(window.IcFarmActive.id) === rawId) {
        window.IcFarmActive = null;
      }

      alert(tMsg("Fazenda excluída com sucesso!"));
      renderFazendas();
      return;
    }

    if (type === "talhoes") {
      const parsed = parseTalhaoCompositeId(rawId);
      if (!parsed?.farmId || !parsed?.talhaoId) return;
      const items = getTalhoesByFarm(parsed.farmId).filter((item) => String(item.id) !== String(parsed.talhaoId));
      saveTalhoesByFarm(parsed.farmId, items);
      renderTalhoes();
      alert(tMsg("Talhão excluído com sucesso!"));
      return;
    }

    if (type === "sistemas-irrigacao") {
      const parsed = parsePivoCompositeId(rawId);
      const fallbackPivoId = rawId.includes("::") ? "" : rawId;
      const targetPivoId = String(parsed?.pivoId || fallbackPivoId || "");
      if (!targetPivoId) return;
      const farms = getAllFarms();
      let deleted = false;

      const matchPivoId = (item) => {
        const ids = [item?.id, item?.equipId, item?.equip_id, item?.legacyId].map((value) => String(value || ""));
        return ids.includes(targetPivoId);
      };

      const matchEquipmentPivo = (equip) => {
        const data = equip?.data || {};
        const ids = [equip?.id, equip?.equipId, data?.id, data?.equipId, data?.equip_id, data?.legacyId]
          .map((value) => String(value || ""));
        const category = String(equip?.category || "").toLowerCase();
        return category === "pivos" && ids.includes(targetPivoId);
      };

      if (parsed?.farmId) {
        const farm = farms.find((item) => String(item.id) === String(parsed.farmId));
        if (farm) {
          farm.pivos = Array.isArray(farm.pivos) ? farm.pivos : [];
          const before = farm.pivos.length;
          farm.pivos = farm.pivos.filter((item) => !matchPivoId(item));
          if (farm.pivos.length !== before) deleted = true;

          farm.equipments = Array.isArray(farm.equipments) ? farm.equipments : [];
          const beforeEquip = farm.equipments.length;
          farm.equipments = farm.equipments.filter((item) => !matchEquipmentPivo(item));
          if (farm.equipments.length !== beforeEquip) deleted = true;
        }
      }

      if (!deleted) {
        farms.forEach((farm) => {
          farm.pivos = Array.isArray(farm.pivos) ? farm.pivos : [];
          const before = farm.pivos.length;
          farm.pivos = farm.pivos.filter((item) => !matchPivoId(item));
          if (farm.pivos.length !== before) deleted = true;

          farm.equipments = Array.isArray(farm.equipments) ? farm.equipments : [];
          const beforeEquip = farm.equipments.length;
          farm.equipments = farm.equipments.filter((item) => !matchEquipmentPivo(item));
          if (farm.equipments.length !== beforeEquip) deleted = true;
        });
      }

      if (!deleted) {
        alert(tMsg("Pivô não encontrado para exclusão."));
        return;
      }
      await persistFarmDataset(farms);
      renderPivos();
      alert(tMsg("Pivô excluído com sucesso!"));
      return;
    }

    if (type === "parcelas") {
      const farms = getAllFarms();
      let deleted = false;
      farms.forEach((farm) => {
        farm.parcelas = Array.isArray(farm.parcelas) ? farm.parcelas : [];
        const before = farm.parcelas.length;
        farm.parcelas = farm.parcelas.filter((item) => String(item.id) !== rawId);
        if (farm.parcelas.length !== before) deleted = true;
      });
      if (!deleted) return;
      await persistFarmDataset(farms);
      renderParcelas();
      alert(tMsg("Parcela excluída com sucesso!"));
      return;
    }

    if (type === "equipamentos") {
      const farms = getAllFarms();
      let deleted = false;
      farms.forEach((farm) => {
        const merged = getFarmEquipmentList(farm);
        const filtered = merged.filter((item) => String(item?.id || "") !== rawId);
        if (filtered.length !== merged.length) deleted = true;
        farm.equipments = filtered;
        delete farm.equipamentos;
      });
      if (!deleted) return;
      await persistFarmDataset(farms);
      renderEquipamentos();
      alert(tMsg("Equipamento excluído com sucesso!"));
      return;
    }

    if (type === "energia") {
      const contratos = window.IcData?.relatorios?.energia?.contratos;
      if (!Array.isArray(contratos)) return;
      window.IcData.relatorios.energia.contratos = contratos.filter((item) => String(item.id) !== rawId);
      persistEnergiaDataset(window.IcData.relatorios.energia);
      renderEnergia();
      alert(tMsg("Registro de energia excluído com sucesso!"));
      return;
    }

    if (type === "faturas") {
      const faturas = window.IcData?.relatorios?.energia?.energia_mensal;
      if (!Array.isArray(faturas)) return;
      window.IcData.relatorios.energia.energia_mensal = faturas.filter((item) => String(item.id) !== rawId);
      persistEnergiaDataset(window.IcData.relatorios.energia);
      renderFaturas();
      alert(tMsg("Fatura excluída com sucesso!"));
      return;
    }

    alert(tMsg("Não foi possível excluir: tipo de registro não identificado."));
  }

  Cad.actions = Object.assign(Cad.actions || {}, {
    inferDeleteType,
    deleteRecord
  });
})();
