(function () {
  "use strict";
  const tMsg = (text) => window.IcI18n?.t?.(text) ?? text;
  const Cad = (window.Cad = window.Cad || {});

  const state = Cad.state || (Cad.state = {});
  const talhoesState = Cad.talhoesState || (Cad.talhoesState = {});
  const pivosState = Cad.pivosState || (Cad.pivosState = {});

  const collectPivoFormData = () => Cad.pivosHelpers?.collectPivoFormData?.();
  const preparePivoSaveData = (data) => Cad.formPivos?.preparePivoSaveData ? Cad.formPivos.preparePivoSaveData(data) : data;
  const getAllFarms = () => Cad.data?.getAllFarms?.() || [];
  const parsePivoCompositeId = (id) => Cad.data?.parsePivoCompositeId?.(id) || null;
  const persistFarmDataset = (farms) => Cad.data?.persistFarmDataset?.(farms);
  const persistEnergiaDataset = (energia) => Cad.data?.persistEnergiaDataset?.(energia);
  const syncPivoCursor = () => Cad.formPivos?.syncPivoCursor?.() || Cad.viewMaps?.syncPivoCursor?.();
  const renderPivos = () => Cad.lists?.renderPivos?.();
  const renderFazendas = () => Cad.lists?.renderFazendas?.();
  const renderTalhoes = () => Cad.lists?.renderTalhoes?.();
  const renderParcelas = () => Cad.lists?.renderParcelas?.();
  const renderEquipamentos = () => Cad.lists?.renderEquipamentos?.();
  const renderEnergia = () => Cad.lists?.renderEnergia?.();
  const renderFaturas = () => Cad.lists?.renderFaturas?.();

  const getCurrentContextFarmId = () => Cad.data?.getCurrentContextFarmId?.() || "";
  const calculatePolygonAreaHa = (points) => Cad.formTalhoes?.calculatePolygonAreaHa?.(points) || Cad.geo?.calculatePolygonAreaHa?.(points) || 0;
  const parseTalhaoCompositeId = (id) => Cad.data?.parseTalhaoCompositeId?.(id) || null;
  const getTalhoesByFarm = (farmId) => Cad.data?.getTalhoesByFarm?.(farmId) || [];
  const saveTalhoesByFarm = (farmId, items) => Cad.data?.saveTalhoesByFarm?.(farmId, items);
  const clearTalhoesDraft = () => Cad.formTalhoes?.clearTalhoesDraft?.();
  const getEquipmentTypeLabel = (type) => Cad.ui?.getEquipmentTypeLabel?.(type) || "Equipamento";
  const findEquipmentById = (id) => Cad.data?.findEquipmentById?.(id) || null;
  const getFarmEquipmentList = (farm) => Cad.data?.getFarmEquipmentList?.(farm) || [];

  function syncPluviometroFrontend(farm) {
    if (!farm) return;
    window.Plv?.data?.syncPluviosWithFarmEquipment?.(farm);
    window.Plv?.data?.savePluviosToStorage?.();
    window.Plv?.data?.refreshPluvioRuntime?.();
    window.IcMapRenderPivots?.(farm);
    window.IcFarmApplyGeo?.(farm);
  }

  function parseCoordinateValue(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    const num = Number(raw.replace(",", "."));
    return Number.isFinite(num) ? num : null;
  }

  function parseLatLngInput(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    const match = raw.match(/(-?\d+(?:[.,]\d+)?)\s*[,;]\s*(-?\d+(?:[.,]\d+)?)/);
    if (!match) return null;
    const lat = parseCoordinateValue(match[1]);
    const lng = parseCoordinateValue(match[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }

  function toggleView(type, view, id = null) {
    if (window.IcToggleView) return window.IcToggleView(type, view, id);
  }

  function ensurePivotPluviometer(farm, pivo) {
    if (Cad.pivosHelpers?.ensurePivotPluviometer) {
      return Cad.pivosHelpers.ensurePivotPluviometer(farm, pivo);
    }
  }

  async function savePivoRecord() {
    if (typeof pivosState._flushActiveSeg === "function") pivosState._flushActiveSeg();
    const data = window.Cad?.formPivos?.preparePivoSaveData
      ? window.Cad.formPivos.preparePivoSaveData(collectPivoFormData())
      : collectPivoFormData();
    if (!data.farmId) {
      alert(tMsg("Nenhuma fazenda ativa encontrada para salvar o piv?."));
      return false;
    }
    if (!data.name) {
      alert(tMsg("Informe o nome do piv?."));
      return false;
    }
    if (!data.lat || !data.lng) {
      alert(tMsg("Informe latitude e longitude do centro."));
      return false;
    }
    if (!data.radius) {
      alert(tMsg("Informe o raio do piv?."));
      return false;
    }
    if (Array.isArray(data.segments) && data.segments.length > 1) {
      const unnamed = data.segments.findIndex((s) => !String(s.name || "").trim());
      if (unnamed !== -1) {
        alert(`${tMsg("Preencha o nome do segmento")} ${unnamed + 1} ${tMsg("antes de salvar.")}`);
        return false;
      }
    }

    const farms = getAllFarms();
    const parsed = parsePivoCompositeId(state.editingId);
    const sourceFarmId = parsed?.farmId || data.farmId;
    const sourcePivoId = parsed?.pivoId || data.id;
    const targetFarm = farms.find((farm) => String(farm.id) === String(data.farmId));
    const sourceFarm = farms.find((farm) => String(farm.id) === String(sourceFarmId)) || targetFarm;
    if (!targetFarm) {
      alert(tMsg("Fazenda de destino não encontrada."));
      return false;
    }

    sourceFarm.pivos = Array.isArray(sourceFarm?.pivos) ? sourceFarm.pivos : [];
    targetFarm.pivos = Array.isArray(targetFarm?.pivos) ? targetFarm.pivos : [];

    if (sourceFarm && sourceFarm !== targetFarm) {
      sourceFarm.pivos = sourceFarm.pivos.filter((item) => String(item.id) !== String(sourcePivoId));
    }
    targetFarm.pivos = targetFarm.pivos.filter((item) => String(item.id) !== String(sourcePivoId));
    const savedPivo = {
      ...data,
      id: sourcePivoId
    };
    targetFarm.pivos.push(savedPivo);
    ensurePivotPluviometer(targetFarm, savedPivo);

    pivosState.pickTarget = null;
    syncPivoCursor();
    await persistFarmDataset(farms);
    if (window.Cad?.lists?.renderPivos) {
      window.Cad.lists.renderPivos();
    } else {
      renderPivos();
    }
    alert(tMsg('Registro salvo com sucesso!'));
    toggleView("sistemas-irrigacao", 'list');
    return true;
  }

  window.IcSaveRecord = async function (type) {
    const supportedTypes = new Set(["fazendas", "talhoes", "sistemas-irrigacao"]);
    if (type === 'fazendas') {
      const farms = getAllFarms();
      const id = state.editingId || ('farm_' + Date.now());

      const formName = document.getElementById('farm_name').value.trim();
      if (!formName) {
        alert(tMsg("O Nome da fazenda é obrigatório."));
        return;
      }

      const latEl = document.getElementById('farm_lat');
      const lngEl = document.getElementById('farm_lng');
      const locLabelEl = document.getElementById('farm_loc_label');
      const existingFarm = state.editingId ? farms.find(f => String(f.id) === String(state.editingId)) : null;
      const formLat = latEl ? latEl.value.trim() : (existingFarm?.lat ?? '');
      const formLng = lngEl ? lngEl.value.trim() : (existingFarm?.lng ?? '');
      const formLocLabel = locLabelEl ? locLabelEl.value.trim() : (existingFarm?.loc || '');
      const techContactPhone = document.getElementById('farmTechContactPhone')?.value.trim() || (existingFarm?.technical?.contact_phone || '');
      if (latEl && lngEl && (!formLat || !formLng)) {
        alert(tMsg("Latitude e Longitude são obrigatórios."));
        return;
      }

      const farmData = {
        id: id,
        name: formName,
        owner: document.getElementById('farm_owner') ? document.getElementById('farm_owner').value.trim() : (existingFarm?.owner || ''),
        contact: techContactPhone || (existingFarm?.contact || ''),
        timezone: document.getElementById('farm_timezone').value,
        hasCentral: document.getElementById('farm_hasCentral')
          ? document.getElementById('farm_hasCentral').checked
          : Boolean(existingFarm?.hasCentral),
        lat: formLat !== '' ? parseFloat(formLat) : (existingFarm?.lat ?? ''),
        lng: formLng !== '' ? parseFloat(formLng) : (existingFarm?.lng ?? ''),
        loc: formLocLabel || (formLat && formLng ? (formLat + ', ' + formLng) : (existingFarm?.loc || '')),
        radius: document.getElementById('farm_radius') ? document.getElementById('farm_radius').value : (existingFarm?.radius ?? ''),
        centralLat: document.getElementById('farm_central_lat')?.value.trim() !== '' ? parseFloat(document.getElementById('farm_central_lat').value) : (existingFarm?.centralLat ?? ''),
        centralLng: document.getElementById('farm_central_lng')?.value.trim() !== '' ? parseFloat(document.getElementById('farm_central_lng').value) : (existingFarm?.centralLng ?? ''),
        centralHeight: existingFarm?.centralHeight ?? '',
        technical: {
          country: document.getElementById('farmTechCountry')?.value || (existingFarm?.technical?.country || 'BR'),
          postal: document.getElementById('farmTechPostal')?.value.trim() || (existingFarm?.technical?.postal || ''),
          state: document.getElementById('farmTechState')?.value.trim() || (existingFarm?.technical?.state || ''),
          address: document.getElementById('farmTechAddress')?.value.trim() || (existingFarm?.technical?.address || ''),
          city: document.getElementById('farmTechCity')?.value.trim() || (existingFarm?.technical?.city || ''),
          contact_phone: techContactPhone
        },
        billing: {
          legal_name: document.getElementById('cadFarmBillingName')?.value.trim() || (existingFarm?.billing?.legal_name || ''),
          document_type: document.getElementById('cadFarmBillingDocType')?.value || (existingFarm?.billing?.document_type || ''),
          document_number: document.getElementById('cadFarmBillingDocNumber')?.value.trim() || (existingFarm?.billing?.document_number || ''),
          email: document.getElementById('cadFarmBillingEmail')?.value.trim() || (existingFarm?.billing?.email || ''),
          email_language: document.getElementById('cadFarmBillingEmailLanguage')?.value || (existingFarm?.billing?.email_language || 'pt-BR'),
          phone: document.getElementById('cadFarmBillingPhone')?.value.trim() || (existingFarm?.billing?.phone || ''),
          country: document.getElementById('cadFarmBillingCountry')?.value || (existingFarm?.billing?.country || ''),
          postal: document.getElementById('cadFarmBillingPostal')?.value.trim() || (existingFarm?.billing?.postal || ''),
          city: document.getElementById('cadFarmBillingCity')?.value.trim() || (existingFarm?.billing?.city || ''),
          region: document.getElementById('cadFarmBillingRegion')?.value.trim() || (existingFarm?.billing?.region || ''),
          neighborhood: document.getElementById('cadFarmBillingNeighborhood')?.value.trim() || (existingFarm?.billing?.neighborhood || ''),
          address: document.getElementById('cadFarmBillingAddress')?.value.trim() || (existingFarm?.billing?.address || '')
        }
      };

      if (state.editingId) {
        const idx = farms.findIndex(f => String(f.id) === String(state.editingId));
        if (idx !== -1) {
          farmData.equipments = farms[idx].equipments || [];
          farms[idx] = Object.assign({}, farms[idx], farmData);
        }
      } else {
        farmData.equipments = [];
        farms.push(farmData);
      }

      await persistFarmDataset(farms);

      // Atualiza referência ativa se for a mesma fazenda
      if (window.IcFarmActive && String(window.IcFarmActive.id) === String(id)) {
        window.IcFarmActive = farmData;
      }
      renderFazendas();
      alert(tMsg('Registro salvo com sucesso!'));
      toggleView(type, 'list');
      return;
    }
    if (type === 'talhoes') {
      const farmId = document.getElementById("talhao_farm")?.value || getCurrentContextFarmId();
      const name = document.getElementById("talhao_name")?.value?.trim() || "";
      const soilType = document.getElementById("talhao_soil")?.value?.trim() || "";
      const crop = document.getElementById("talhao_crop")?.value?.trim() || "";

      if (!farmId) {
        alert(tMsg("Nenhuma fazenda ativa encontrada para salvar o talhão."));
        return;
      }
      if (!name) {
        alert(tMsg("Preencha os campos obrigatórios de Talhão."));
        return;
      }
      if (!soilType || !crop) {
        alert(tMsg("Preencha os campos obrigatórios de Tipo de solo e Plantio."));
        return;
      }
      if (!Array.isArray(talhoesState.points) || talhoesState.points.length < 3) {
        alert(tMsg("Desenhe o polígono do talhão no mapa."));
        return;
      }

      const area = calculatePolygonAreaHa(talhoesState.points);
      const idParsed = parseTalhaoCompositeId(state.editingId);
      const talhaoId = idParsed?.talhaoId || `talhao_${Date.now()}`;
      const destination = getTalhoesByFarm(farmId);
      const sourceFarmId = idParsed?.farmId || farmId;
      let sourceItems = getTalhoesByFarm(sourceFarmId);
      const existingTalhao =
        sourceItems.find((item) => String(item.id) === String(talhaoId)) ||
        destination.find((item) => String(item.id) === String(talhaoId)) ||
        null;
      const obsInput = document.getElementById("talhao_obs");
      const obsValue = obsInput ? (obsInput.value?.trim() || "") : (existingTalhao?.obs || "");

      const payload = {
        id: talhaoId,
        name,
        soilType,
        crop,
        area: area.toFixed(2),
        obs: obsValue,
        points: talhoesState.points.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) })),
        center: (window.L && talhoesState.points.length >= 3)
          ? L.polygon(talhoesState.points).getBounds().getCenter()
          : null
      };

      sourceItems = sourceItems.filter((item) => String(item.id) !== String(talhaoId));
      saveTalhoesByFarm(sourceFarmId, sourceItems);

      const updatedDestination = destination.filter((item) => String(item.id) !== String(talhaoId));
      updatedDestination.push(payload);
      saveTalhoesByFarm(farmId, updatedDestination);

      talhoesState.isDrawing = false;
      clearTalhoesDraft();
      renderTalhoes();
      alert(tMsg('Registro salvo com sucesso!'));
      toggleView(type, 'list');
      return;
    }
    if (type === "sistemas-irrigacao") {
      await savePivoRecord();
      return;
    }

    if (type === "equipamentos") {
      const equipType = String(document.getElementById("equip_type")?.value || "").trim();
      const equipTypeLabel = String(document.getElementById("equip_type")?.selectedOptions?.[0]?.textContent || "").trim();
      const farmId = String(document.getElementById("equip_farm")?.value || getCurrentContextFarmId() || "").trim();
      const name = String(document.getElementById("equip_name")?.value || "").trim();
      const serial = String(document.getElementById("equip_serial")?.value || "").trim();
      const latlngRaw = String(document.getElementById("equip_latlng")?.value || "").trim();
      const parsedLatLng = parseLatLngInput(latlngRaw);
      const pivoIdsRaw = document.getElementById("equip_pivo_ids")?.value;
      const pivoIds = pivoIdsRaw ? JSON.parse(pivoIdsRaw) : [];
      const talhaoIdsRaw = document.getElementById("equip_talhao_ids")?.value;
      const talhaoIds = talhaoIdsRaw ? JSON.parse(talhaoIdsRaw) : [];
      const pivoId = pivoIds[0] || "";
      const talhaoId = talhaoIds[0] || "";

      if (!equipType) {
        alert(tMsg("Selecione o tipo de equipamento."));
        return;
      }
      if (!farmId) {
        alert(tMsg("Selecione a fazenda do equipamento."));
        return;
      }
      if (!name) {
        alert(tMsg("Informe o nome do equipamento."));
        return;
      }
      const latNum = parsedLatLng?.lat;
      const lngNum = parsedLatLng?.lng;
      if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
        alert(tMsg("Informe latitude e longitude válidas."));
        return;
      }
      const coords = { lat: latNum, lng: lngNum };
      const loc = `${latNum.toFixed(6)}, ${lngNum.toFixed(6)}`;

      const farms = getAllFarms();
      const targetFarm = farms.find((farm) => String(farm.id) === farmId);
      if (!targetFarm) {
        alert(tMsg("Fazenda de destino nao encontrada."));
        return;
      }

      const existingEquipData = findEquipmentById(state.editingId)?.equipment?.data || {};
      const data = { serial, loc, lat: coords.lat, lng: coords.lng, farmId, talhaoId, pivoId, pivoIds, talhaoIds, modulos: window._equipFormModules || [] };

      if (equipType === "smart_connect") {
        data.manufacturer = String(document.getElementById("equip_manufacturer")?.value || "").trim();
        data.panelType = String(document.getElementById("equip_panel_type")?.value || "").trim();
        data.commType = String(document.getElementById("equip_comm_type")?.value || "").trim();
        data.gateway = String(document.getElementById("equip_gateway")?.value || "").trim();
      } else if (equipType === "repetidora") {
        data.radio = String(document.getElementById("equip_radio")?.value || "").trim();
        data.height = String(document.getElementById("equip_height")?.value || "").trim();
        data.type = String(document.getElementById("equip_power_type")?.value || "").trim();
      } else if (equipType === "irripump") {
        data.pumpType = String(document.getElementById("equip_pump_type")?.value || "").trim();
        data.flowType = String(document.getElementById("equip_flow_type")?.value || "").trim();
      } else if (equipType === "pluviometro") {
        data.comunicacao = String(document.getElementById("equip_comm_type")?.value || "").trim();
        data.model = String(document.getElementById("equip_model")?.value || "").trim();
        data.pluviometroType = String(document.getElementById("equip_pluv_type")?.value || "").trim();
        const linkedPivotInput = document.getElementById("equip_pivo") || document.getElementById("equip_linked_pivot");
        const linkedTalhaoInput = document.getElementById("equip_talhao");
        data.linkedPivotId = linkedPivotInput
          ? String(linkedPivotInput.value || "").trim()
          : String(existingEquipData.linkedPivotId || existingEquipData.pivoId || "").trim();
        data.linkedTalhaoId = linkedTalhaoInput
          ? String(linkedTalhaoInput.value || "").trim()
          : String(existingEquipData.linkedTalhaoId || existingEquipData.talhaoId || "").trim();
        data.nome = name;
      } else if (equipType === "estacao_metereologica") {
        data.vendor = "Davis";
        data.davisId = String(document.getElementById("equip_davis_id")?.value || document.getElementById("equip_vendor")?.value || "").trim();
        data.stationId = String(document.getElementById("equip_station_id")?.value || "").trim();
        data.apiKey = String(document.getElementById("equip_api_key")?.value || "").trim();
        data.apiSecret = String(document.getElementById("equip_api_secret")?.value || "").trim();
      } else if (equipType === "rainstar") {
        data.imei = String(document.getElementById("equip_imei")?.value || "").trim();
        data.model = String(document.getElementById("equip_model")?.value || "").trim();
        data.method = String(document.getElementById("equip_method")?.value || "").trim();
        data.flow = String(document.getElementById("equip_flow")?.value || "").trim();
        data.width = String(document.getElementById("equip_width")?.value || "").trim();
      }

      const equipmentId = state.editingId || `equip_${Date.now()}`;
      const payload = {
        id: equipmentId,
        type: equipType,
        typeLabel: equipTypeLabel || getEquipmentTypeLabel(equipType),
        category: (window.Cad?.EQUIP_CATEGORY_BY_TYPE || {})[equipType] || "outros",
        name,
        location: loc,
        createdAt: findEquipmentById(state.editingId)?.equipment?.createdAt || new Date().toISOString(),
        data
      };

      farms.forEach((farm) => {
        farm.equipments = getFarmEquipmentList(farm).filter((item) => String(item?.id || "") !== String(equipmentId));
        delete farm.equipamentos;
      });

      targetFarm.equipments = Array.isArray(targetFarm.equipments) ? targetFarm.equipments : [];
      targetFarm.equipments.push(payload);

      await persistFarmDataset(farms);
      if (equipType === "pluviometro") {
        syncPluviometroFrontend(targetFarm);
      }
      renderEquipamentos();
      alert(tMsg("Registro salvo com sucesso!"));
      toggleView(type, "list");
      return;
    }

    if (type === "energia") {
      const nome = String(document.getElementById("energia_nome")?.value || "").trim();
      const concessionaria = String(document.getElementById("energia_concessionaria")?.value || "").trim();
      if (!nome) { alert(tMsg("Informe o nome do contrato.")); return; }
      if (!concessionaria) { alert(tMsg("Informe a concessionária.")); return; }

      const pivosVinculados = (() => { try { return JSON.parse(document.getElementById("energia_pivo_ids")?.value || "[]"); } catch { return []; } })();
      const bombasVinculadas = (() => { try { return JSON.parse(document.getElementById("energia_bomba_ids")?.value || "[]"); } catch { return []; } })();
      const faixasEnergia = (() => { try { return JSON.parse(document.getElementById("energia_faixas_data")?.value || "[]"); } catch { return []; } })();

      const payload = {
        id: state.editingId || `energia_${Date.now()}`,
        nome,
        concessionaria,
        aniversario: Number(document.getElementById("energia_aniversario")?.value || 0) || null,
        descricao: String(document.getElementById("energia_descricao")?.value || "").trim(),
        reservadoPct: Number(document.getElementById("energia_reservado_pct")?.value || 0) || null,
        reativaValor: Number(document.getElementById("energia_reativa_valor")?.value || 0) || null,
        demandaKw: Number(document.getElementById("energia_demanda_kw")?.value || 0) || null,
        horariosPonta: Array.isArray(window.IcData?.relatorios?.energia?.contratos?.find((c) => String(c.id) === String(state.editingId))?.horariosPonta)
          ? window.IcData.relatorios.energia.contratos.find((c) => String(c.id) === String(state.editingId)).horariosPonta
          : [],
        faixasEnergia,
        pivosVinculados,
        bombasVinculadas,
      };

      window.IcData = window.IcData || {};
      window.IcData.relatorios = window.IcData.relatorios || {};
      window.IcData.relatorios.energia = window.IcData.relatorios.energia || {};
      window.IcData.relatorios.energia.contratos = window.IcData.relatorios.energia.contratos || [];
      const contratos = window.IcData.relatorios.energia.contratos;
      const existIdx = contratos.findIndex((c) => String(c.id) === String(payload.id));
      if (existIdx >= 0) contratos[existIdx] = payload; else contratos.push(payload);
      persistEnergiaDataset(window.IcData.relatorios.energia);

      if (window.Cad?.lists?.renderEnergia) {
        window.Cad.lists.renderEnergia();
      } else {
        renderEnergia();
      }
      alert(tMsg("Contrato salvo com sucesso!"));
      toggleView(type, "list");
      return;
    }

    if (type === "faturas") {
      const mesAnoIso = String(document.getElementById("fatura_mes_ano")?.value || "").trim();
      if (!mesAnoIso) { alert(tMsg("Informe o mês/ano da fatura.")); return; }

      const numVal = (elId) => window.IcNumeric.readNumber(elId, null);
      const strVal = (elId) => String(document.getElementById(elId)?.value || "").trim();

      const consumo_kwh = (numVal("fatura_cons_hfp_kwh") || 0) + (numVal("fatura_cons_hp_kwh") || 0) + (numVal("fatura_cons_res_kwh") || 0);
      const custo_total = window.IcNumeric.readNumber("fatura_total_r", 0);
      const penalidades = window.IcNumeric.readNumber("fatura_penalidades", 0);
      const custo_kwh = window.IcNumeric.readNumber("fatura_custo_kwh", 0);

      const payload = {
        id: state.editingId || `fatura_${Date.now()}`,
        mes_ano: mesAnoIso.replace("-", "/"),
        mes_ano_iso: mesAnoIso,
        concessionaria: strVal("fatura_concessionaria"),
        contratoId: strVal("fatura_contrato"),
        leituraAnterior: strVal("fatura_leitura_ant"),
        leituraAtual: strVal("fatura_leitura_atu"),
        demanda_kw: {
          contratada: numVal("fatura_dem_contratada"),
          ativa_kw: numVal("fatura_dem_ativa_kw"),
          ativa_r: numVal("fatura_dem_ativa_r"),
        },
        consumo: {
          hfp_kwh: numVal("fatura_cons_hfp_kwh"), hfp_r: numVal("fatura_cons_hfp_r"),
          hp_kwh: numVal("fatura_cons_hp_kwh"), hp_r: numVal("fatura_cons_hp_r"),
          reservado_kwh: numVal("fatura_cons_res_kwh"), reservado_r: numVal("fatura_cons_res_r"),
        },
        reativo: {
          hfp_kwh: numVal("fatura_reat_hfp_kwh"), hfp_r: numVal("fatura_reat_hfp_r"),
          hp_kwh: numVal("fatura_reat_hp_kwh"), hp_r: numVal("fatura_reat_hp_r"),
          reservado_kwh: numVal("fatura_reat_res_kwh"), reservado_r: numVal("fatura_reat_res_r"),
        },
        ultrapassagem_kw: numVal("fatura_ultrap_kw"),
        ultrapassagem_r: numVal("fatura_ultrap_r"),
        complementar_kw: numVal("fatura_compl_kw"),
        complementar_r: numVal("fatura_compl_r"),
        descontos_gerais: numVal("fatura_desc_gerais"),
        descontos_irrigante: numVal("fatura_desc_irrigante"),
        custos_gerais: numVal("fatura_custos_gerais"),
        impostos: numVal("fatura_impostos"),
        multas: numVal("fatura_multas"),
        consumo_kwh,
        custo_total,
        penalidades,
        custo_kwh,
      };

      window.IcData = window.IcData || {};
      window.IcData.relatorios = window.IcData.relatorios || {};
      window.IcData.relatorios.energia = window.IcData.relatorios.energia || {};
      window.IcData.relatorios.energia.energia_mensal = window.IcData.relatorios.energia.energia_mensal || [];
      const faturas = window.IcData.relatorios.energia.energia_mensal;
      const existIdx = faturas.findIndex((f) => String(f.id) === String(payload.id));
      if (existIdx >= 0) faturas[existIdx] = payload; else faturas.push(payload);
      persistEnergiaDataset(window.IcData.relatorios.energia);

      if (window.Cad?.lists?.renderFaturas) {
        window.Cad.lists.renderFaturas();
      } else {
        renderFaturas();
      }
      alert(tMsg("Fatura salva com sucesso!"));
      toggleView(type, "list");
      return;
    }

    if (!supportedTypes.has(type)) {
      alert(tMsg("Salvar ainda não implementado para esta seção."));
      return;
    }
  };

  window.IcDuplicateRecord = async function (id) {
    if (state.currentType === "sistemas-irrigacao") {
      const parsed = parsePivoCompositeId(id);
      if (!parsed?.farmId || !parsed?.pivoId) return;
      const farms = getAllFarms();
      const farm = farms.find((item) => String(item.id) === String(parsed.farmId));
      if (!farm) return;
      farm.pivos = Array.isArray(farm.pivos) ? farm.pivos : [];
      const sourcePivo = farm.pivos.find((item) => String(item.id) === String(parsed.pivoId));
      if (!sourcePivo) return;

      const clone = JSON.parse(JSON.stringify(sourcePivo));
      clone.id = `pivo_${Date.now()}`;
      clone.name = `${clone.name || "Pivô Central"} (Cópia)`;
      farm.pivos.push(clone);
      await persistFarmDataset(farms);
      renderPivos();
      alert(tMsg("Piv? central duplicado com sucesso!"));
      return;
    }

    if (type === "talhoes") {
      const parsed = parseTalhaoCompositeId(rawId);
      if (!parsed?.farmId || !parsed?.talhaoId) return;
      const items = getTalhoesByFarm(parsed.farmId);
      const source = items.find((item) => String(item.id) === String(parsed.talhaoId));
      if (!source) return;

      const clone = JSON.parse(JSON.stringify(source));
      clone.id = `talhao_${Date.now()}`;
      clone.name = `${clone.name || "Talhão"} (Cópia)`;
      items.push(clone);
      saveTalhoesByFarm(parsed.farmId, items);
      renderTalhoes();
      alert(tMsg("Talhão duplicado com sucesso!"));
      return;
    }

    const farms = getAllFarms();
    const source = farms.find(f => String(f.id) === String(id));
    if (!source) return;
    const clone = JSON.parse(JSON.stringify(source));
    clone.id = 'farm_' + Date.now();
    clone.name = (clone.name || 'Fazenda') + ' (Cópia)';
    farms.push(clone);
    await persistFarmDataset(farms);
    renderFazendas();
    alert(tMsg('Fazenda duplicada com sucesso!'));
  };

  // Sobrescreve delete para suportar Talhões por fazenda.

  Cad.actionsSave = Object.assign(Cad.actionsSave || {}, {
    savePivoRecord,
    saveRecord: window.IcSaveRecord,
    duplicateRecord: window.IcDuplicateRecord
  });
})();
