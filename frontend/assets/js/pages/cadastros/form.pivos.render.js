(function () {
  "use strict";
  const Cad = (window.Cad = window.Cad || {});

  const getAllFarms = () => Cad.data?.getAllFarms?.() || [];
  const parsePivoCompositeId = (compositeId) => Cad.data?.parsePivoCompositeId?.(compositeId) || null;
  const getCurrentContextFarmId = () => Cad.data?.getCurrentContextFarmId?.() || "";
  const getAllPivosRecords = (farmId = null) => Cad.data?.getAllPivosRecords?.(farmId) || [];
  const normalizePivoRecord = (source, farmId) => Cad.data?.normalizePivoRecord?.(source, farmId) || source || {};
  const getTalhoesByFarm = (farmId) => Cad.data?.getTalhoesByFarm?.(farmId) || [];
  const getFarmEquipmentList = (farm) => Cad.data?.getFarmEquipmentList?.(farm) || [];

  function renderFormPivos(compositeId, container) {
    const farms = getAllFarms();
    const parsed = parsePivoCompositeId(compositeId);
    let source = null;
    let currentFarmId = getCurrentContextFarmId() || farms[0]?.id || "";

    if (parsed?.farmId && parsed?.pivoId) {
      currentFarmId = parsed.farmId;
      const allRecords = getAllPivosRecords();
      source = allRecords.find(
        (item) => String(item.farmId) === String(parsed.farmId) && String(item.id) === String(parsed.pivoId)
      ) || null;
    }

    const data = normalizePivoRecord(source, currentFarmId);
    const farmName = farms.find((f) => String(f.id) === String(currentFarmId))?.name || "Fazenda sem nome";
    const currentFarmTalhoes = getTalhoesByFarm(currentFarmId)
      .slice()
      .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "pt-BR", { sensitivity: "base" }));
    const selectedTalhaoIds = new Set((Array.isArray(data.talhaoIds) ? data.talhaoIds : []).map((id) => String(id)));

    const currentFarmPumps = getFarmEquipmentList(farms.find(f => String(f.id) === String(currentFarmId))).filter(e => e.type === 'irripump');
    const selectedPumpIds = new Set((Array.isArray(data.pumpIds) ? data.pumpIds : []).map(id => String(id)));
    const rc = (v) => (v !== null && v !== undefined && String(v).trim() !== "" && Number.isFinite(Number(v))) ? Number(v).toFixed(6) : "";
    const rr = (v) => (v !== null && v !== undefined && String(v).trim() !== "" && Number.isFinite(Number(v))) ? Number(v).toFixed(2) : "";

    container.innerHTML = `
    <div class="cadastros-form-card">
      <div class="cadastros-form-topbar">
        <div class="cadastros-form-topbar__text">${source ? "Editar Pivô" : "Adicionar Pivô"}</div>
        <span class="cadastros-form-topbar__sep">-</span>
        <div class="cadastros-form-topbar__actions">
          <button type="button" class="farm-tab-btn is-active" data-pivo-tab="geral">Geral</button>
          <button type="button" class="farm-tab-btn" data-pivo-tab="localizacao">Localização</button>
          <button type="button" class="farm-tab-btn" data-pivo-tab="vinculos">Vínculos</button>
          <button type="button" class="farm-tab-btn" data-pivo-tab="bomba">Bomba</button>
          <button type="button" class="farm-tab-btn" data-pivo-tab="segmentos">Parcelas</button>
          <button type="button" class="farm-tab-btn" data-pivo-tab="canhao">Canhão Final</button>
          <button type="button" class="farm-tab-btn" data-pivo-tab="protecao">Proteção</button>
        </div>
      </div>
      <div class="cadastros-form-content">
        <input type="hidden" id="pivo_id" value="${data.id}">
        <input type="hidden" id="pivo_farm" value="${currentFarmId}">
        <input type="hidden" id="pivo_parcelas_json" value="${JSON.stringify(data.parcelas || []).replace(/"/g, '&quot;')}">
        <input type="hidden" id="pivo_seg_json" value="${JSON.stringify(data.segments || []).replace(/"/g, '&quot;')}">

        <div id="content-pivo-geral" class="cadastros-form-section is-active">
          <div class="cadastros-form-grid">
            <div class="pivo-radio-cards col-span-2">
              <div class="pivo-radio-card">
                <div class="pivo-radio-card__head">
                  <label class="equip-label" for="pivo_radioCentral">Rádio da central</label>
                </div>
                <div class="pivo-radio-card__body">
                  <input type="text" class="equip-input" id="pivo_radioCentral" value="${data.radioCentral || "0013A20042000001"}" disabled>
                </div>
              </div>
              <div class="pivo-radio-card">
                <div class="pivo-radio-card__head">
                  <label class="equip-label" for="pivo_radioControl"><span class="equip-required">*</span> Rádio do controlador</label>
                  <span class="pivo-radio-card__sync" aria-hidden="true"><i class="fa-solid fa-rotate-right"></i></span>
                </div>
                <div class="pivo-radio-card__body">
                  <div class="pivo-radio-input-wrap">
                    <input type="text" class="equip-input" id="pivo_radioControl" value="${data.radioControl || "0013A20042000002"}">
                    <span class="pivo-radio-input__actions" aria-hidden="true">
                      <i class="fa-solid fa-circle-xmark pivo-radio-input__off"></i>
                      <i class="fa-solid fa-circle pivo-radio-input__on"></i>
                      <i class="fa-solid fa-qrcode pivo-radio-input__scan"></i>
                    </span>
                  </div>
                </div>
              </div>
              <div class="pivo-radio-card">
                <div class="pivo-radio-card__head">
                  <label class="equip-label" for="pivo_radioGps"><span class="equip-required">*</span> Rádio do GPS</label>
                  <span class="pivo-radio-card__sync" aria-hidden="true"><i class="fa-solid fa-rotate-right"></i></span>
                </div>
                <div class="pivo-radio-card__body">
                  <div class="pivo-radio-input-wrap">
                    <input type="text" class="equip-input" id="pivo_radioGps" value="${data.radioGps || "0013A20042000003"}">
                    <span class="pivo-radio-input__actions" aria-hidden="true">
                      <i class="fa-solid fa-circle-xmark pivo-radio-input__off"></i>
                      <i class="fa-solid fa-circle pivo-radio-input__on"></i>
                      <i class="fa-solid fa-qrcode pivo-radio-input__scan"></i>
                    </span>
                  </div>
                </div>
              </div>
              <div class="pivo-radio-card">
                <div class="pivo-radio-card__head">
                  <label class="equip-label" for="pivo_radioBomba">Rádio da bomba</label>
                </div>
                <div class="pivo-radio-card__body">
                  <div class="pivo-radio-input-wrap pivo-radio-input-wrap--scan-only">
                    <input type="text" class="equip-input" id="pivo_radioBomba" value="${data.radioBomba || "0000000000000000"}">
                    <span class="pivo-radio-input__actions" aria-hidden="true">
                      <i class="fa-solid fa-qrcode pivo-radio-input__scan"></i>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div class="equip-field">
              <label class="equip-label" for="pivo_name"><span class="equip-required">*</span>Nome do pivô</label>
              <input type="text" class="equip-input" id="pivo_name" value="${data.name}" placeholder="Ex: Pivô Central 01">
            </div>

            <div class="equip-field">
              <label class="equip-label" for="pivo_language"><span class="equip-required">*</span> Idioma do equipamento</label>
              <select class="equip-input" id="pivo_language">
                <option value="pt" ${data.language === "pt" ? "selected" : ""}>Português</option>
                <option value="en" ${data.language === "en" ? "selected" : ""}>English</option>
                <option value="es" ${data.language === "es" ? "selected" : ""}>Español</option>
              </select>
            </div>

            <div class="equip-field">
              <label class="equip-label" for="pivo_manufacturer"><span class="equip-required">*</span> Fabricante do equipamento</label>
              <select class="equip-input" id="pivo_manufacturer">
                <option value="bauer" ${data.manufacturer === "bauer" ? "selected" : ""}>Bauer</option>
                <option value="fOCK" ${data.manufacturer === "fOCK" ? "selected" : ""}>Fockink</option>
                <option value="irri" ${data.manufacturer === "irri" ? "selected" : ""}>Irricontrol</option>
                <option value="valm" ${data.manufacturer === "valm" ? "selected" : ""}>Valley</option>
                <option value="zimm" ${data.manufacturer === "zimm" ? "selected" : ""}>Zimmatic</option>
              </select>
            </div>

            <div class="equip-field">
              <label class="equip-label" for="pivo_controllerType"><span class="equip-required">*</span> Tipo de painel</label>
              <select class="equip-input" id="pivo_controllerType">
                <option value="none" ${String(data.controllerType || "none") === "none" ? "selected" : ""}>Sem controlador</option>
                <option value="smart_connect" ${String(data.controllerType || "") === "smart_connect" ? "selected" : ""}>Smart Connect</option>
                <option value="smarttouch" ${String(data.controllerType || "") === "smarttouch" ? "selected" : ""}>Smart Touch</option>
                <option value="nexus" ${String(data.controllerType || "") === "nexus" ? "selected" : ""}>Nexus</option>
              </select>
            </div>

            <div class="equip-field">
              <label class="equip-label" for="pivo_flow"><span class="equip-required">*</span> Vazão</label>
              <div class="equip-input-with-suffix">
                <input type="number" class="equip-input" id="pivo_flow" value="${data.flow || "100"}" step="0.1">
                <span class="equip-suffix">m³/h</span>
              </div>
            </div>
            
            <div class="equip-field">
              <label class="equip-label" for="pivo_towerSpeed" style="overflow: visible;"><span class="equip-required">*</span> Velocidade da última torre <span class="edit-panel__tooltip-icon" data-tooltip="Velocidade da última torre a 100%."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="equip-input-with-suffix">
                <input type="number" class="equip-input" id="pivo_towerSpeed" value="${data.towerSpeed || "200"}" step="0.1">
                <span class="equip-suffix">m/h</span>
              </div>
            </div>

            <div class="equip-field">
              <label class="equip-label" for="pivo_area"><span class="equip-required">*</span> Área irrigada</label>
              <div class="equip-input-with-suffix">
                <input type="number" class="equip-input" id="pivo_area" value="${data.area || "100"}" step="0.1">
                <span class="equip-suffix">ha</span>
              </div>
            </div>

          </div>
        </div>

        <!-- Tab: Bomba -->
        <div id="content-pivo-bomba" class="cadastros-form-section">
          <div class="cadastros-form-grid">
            <div class="equip-field">
              <label class="equip-label" for="pivo_pump_power"><span class="equip-required">*</span> Potência da bomba</label>
              <div class="equip-input-with-suffix">
                <input type="number" class="equip-input" id="pivo_pump_power" value="${rr(data.pumpPower) || "73.55"}" step="0.01">
                <span class="equip-suffix">kW</span>
              </div>
            </div>

            <div class="equip-field">
              <label class="equip-label" for="pivo_pressure_type" style="overflow: visible;"><span class="equip-required">*</span> Leitura de pressão <span class="edit-panel__tooltip-icon" data-tooltip="Equipamento para aferir a pressão no centro do pivô."><i class="fa-regular fa-circle-question"></i></span></label>
              <select class="equip-input" id="pivo_pressure_type">
                <option value="desabilitado" ${data.pressureType === "desabilitado" ? "selected" : ""}>Desabilitado</option>
                <option value="pressostato" ${data.pressureType === "pressostato" || !data.pressureType ? "selected" : ""}>Por pressostato</option>
                <option value="sensor" ${data.pressureType === "sensor" ? "selected" : ""}>Por sensor de pressão</option>
              </select>
            </div>

            <div class="equip-field">
              <label class="equip-label" for="pivo_pump_time" style="overflow: visible;"><span class="equip-required">*</span> Tempo de bomba <span class="edit-panel__tooltip-icon" data-tooltip="Se refere ao tempo limite para que o pivô pressurize. Caso este tempo seja ultrapassado sem atingir a pressão, a bomba é desligada por segurança."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="equip-input-with-suffix">
                <input type="number" class="equip-input" id="pivo_pump_time" value="${rr(data.pumpTime) || "5"}" step="0.5">
                <span class="equip-suffix">min</span>
              </div>
            </div>

            <div class="equip-field">
              <label class="equip-label" for="pivo_delay_time" style="overflow: visible;"><span class="equip-required">*</span> Tempo de retardo <span class="edit-panel__tooltip-icon" data-tooltip="O Tempo de retardo se refere ao tempo posterior à pressurização do pivô. Há uma espera para que a pressão chegue até a última torre, para então o pivô começar a se movimentar."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="equip-input-with-suffix">
                <input type="number" class="equip-input" id="pivo_delay_time" value="${rr(data.delayTime) || "1"}" step="1">
                <span class="equip-suffix">s</span>
              </div>
            </div>

            <div class="equip-field">
              <label class="equip-label" for="pivo_unstable_time" style="overflow: visible;"><span class="equip-required">*</span> Tempo instável de pressostato <span class="edit-panel__tooltip-icon" data-tooltip="Caso o pivô esteja operando fora dos limites de pressão por um período maior que o estabelecido, a ação do pivô é interrompida."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="equip-input-with-suffix">
                <input type="number" class="equip-input" id="pivo_unstable_time" value="${rr(data.unstableTime) || "6"}" step="0.5">
                <span class="equip-suffix">min</span>
              </div>
            </div>

            <div class="farm-form-divider col-span-2">Sensores de Pressão</div>

            <div class="equip-field">
              <label class="equip-label" for="pivo_sensor_min" style="overflow: visible;">Valor mínimo do sensor <span class="edit-panel__tooltip-icon" data-tooltip="O valor mínimo indica a faixa de pressão na qual o dispositivo deve se manter. Abaixo do valor mínimo, o funcionamento do pivô é parado."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="equip-input-with-suffix">
                <input type="number" class="equip-input" id="pivo_sensor_min" value="${rr(data.voltageMin) || "4.0"}" step="0.1">
                <span class="equip-suffix">bar</span>
              </div>
            </div>

            <div class="equip-field">
              <label class="equip-label" for="pivo_sensor_max" style="overflow: visible;">Valor máximo do sensor <span class="edit-panel__tooltip-icon" data-tooltip="O valor máximo indica a faixa de pressão na qual o dispositivo deve se manter. Acima do valor máximo, o funcionamento do pivô é parado."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="equip-input-with-suffix">
                <input type="number" class="equip-input" id="pivo_sensor_max" value="${rr(data.voltageMax) || "8.0"}" step="0.1">
                <span class="equip-suffix">bar</span>
              </div>
            </div>

            <div class="equip-field">
              <label class="equip-label" for="pivo_sensor_scale" style="overflow: visible;"><span class="equip-required">*</span> Escala do sensor <span class="edit-panel__tooltip-icon" data-tooltip="A Escala do sensor se refere ao máximo de pressão que ele consegue medir."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="equip-input-with-suffix">
                <input type="number" class="equip-input" id="pivo_sensor_scale" value="${rr(data.sensorScale) || "10.0"}" step="0.1">
                <span class="equip-suffix">bar</span>
              </div>
            </div>

            <div class="equip-field col-span-2" style="margin-top: 10px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
               <h3 style="font-size: 14px; margin: 0 0 10px; color: var(--ink-900);">Bomba de Fertirrigação</h3>
               <label class="equip-check" style="color: var(--muted-600); font-size: 13px;">
                 <input type="checkbox" id="pivo_fertirrigacao" ${data.enableFertirrigacao ? "checked" : ""}>
                 Permitir fertirrigação <span class="edit-panel__tooltip-icon" data-tooltip="Habilita a fertirrigação (aplicação de fertilizantes junto com a água) nos comandos de irrigação deste pivô."><i class="fa-regular fa-circle-question"></i></span>
               </label>
            </div>
          </div>
        </div>

        <!-- Tab: Localização -->
        <div id="content-pivo-localizacao" class="cadastros-form-section">
          <div class="cadastros-form-grid">
            <div class="equip-field col-span-2">
              <label class="equip-label" for="pivo_center"><span class="equip-required">*</span> Centro do pivô</label>
              <div class="sc-loc__row">
                <div class="sc-loc__input-wrapper" style="flex:1;">
                  <input class="equip-input sc-loc__input-field" id="pivo_center" placeholder="-15.000000, -47.000000" value="${rc(data.lat) && rc(data.lng) ? rc(data.lat) + ', ' + rc(data.lng) : ''}">
                </div>
                <button class="equip-btn btn btn--outline sc-loc__btn sc-loc__btn--center" type="button" id="pivoMapPickCenterBtn" style="padding:8px 10px;white-space:nowrap;flex-shrink:0;">
                  <i class="fa-solid fa-location-dot" aria-hidden="true" style="color:#16a34a;"></i> Obter Localização
                </button>
              </div>
              <input type="hidden" id="pivo_lat" value="${rc(data.lat)}">
              <input type="hidden" id="pivo_lng" value="${rc(data.lng)}">
            </div>
            <div class="equip-field col-span-2">
              <label class="equip-label" for="pivo_ref">Referência inicial (Ângulo 0°) <i class="fa-regular fa-circle-question" aria-hidden="true"></i></label>
              <div class="sc-loc__row">
                <div class="sc-loc__input-wrapper" style="flex:1;">
                  <input class="equip-input sc-loc__input-field" id="pivo_ref" placeholder="-15.000000, -47.000000" value="${rc(data.refLat) && rc(data.refLng) ? rc(data.refLat) + ', ' + rc(data.refLng) : ''}">
                </div>
                <button class="equip-btn btn btn--outline sc-loc__btn sc-loc__btn--ref" type="button" id="pivoMapPickRefBtn" style="white-space:nowrap;flex-shrink:0;">
                  <i class="fa-solid fa-location-dot" aria-hidden="true" style="color:#ef4444;"></i> Obter Localização
                </button>
              </div>
              <input type="hidden" id="pivo_refLat" value="${rc(data.refLat)}">
              <input type="hidden" id="pivo_refLng" value="${rc(data.refLng)}">
            </div>
            <div class="equip-field">
              <label class="equip-label" for="pivo_radius"><span class="equip-required">*</span>Raio (m)</label>
              <input type="number" class="equip-input" id="pivo_radius" value="${rr(data.radius)}" step="0.01" placeholder="Auto pelo ângulo zero">
            </div>
            <div class="equip-field">
              <label class="equip-label" for="pivo_lastTowerRadius">Raio última torre (m)</label>
              <div class="sc-loc__row">
                <div class="sc-loc__input-wrapper" style="flex:1;">
                  <input type="number" class="equip-input" id="pivo_lastTowerRadius" value="${rr(data.lastTowerRadius)}" step="0.01" placeholder="Auto pela última torre">
                </div>
                <button class="equip-btn btn btn--outline sc-loc__btn sc-loc__btn--ref" type="button" id="pivoMapPickLastTowerBtn" style="white-space:nowrap;flex-shrink:0;">
                  <i class="fa-solid fa-location-dot" aria-hidden="true" style="color:#ef4444;"></i> Obter última torre
                </button>
              </div>
            </div>
            <div class="equip-field col-span-2">
              <div class="equip-label" style="overflow: visible;">Alinhar ângulo zero (selecione um dos pontos cardeais ou demarque no mapa) <span class="edit-panel__tooltip-icon" data-tooltip="Defina onde fica o ângulo zero do pivô: arraste o pin vermelho no mapa para ajustar livremente, ou clique nos botões (Norte, Leste, Sul ou Oeste) para alinhar a um ponto cardeal. Em pivôs setoriais (ângulo menor que 360°), o ângulo zero é sempre definido no sentido horário, da esquerda para a direita."><i class="fa-regular fa-circle-question"></i></span></div>
              <div class="pivo-cardinal-btns">
                <button type="button" class="pivo-cardinal-btn" data-bearing="0" title="Norte">N</button>
                <button type="button" class="pivo-cardinal-btn" data-bearing="90" title="Leste">L</button>
                <button type="button" class="pivo-cardinal-btn" data-bearing="180" title="Sul">S</button>
                <button type="button" class="pivo-cardinal-btn" data-bearing="270" title="Oeste">O</button>
              </div>
            </div>
            <input type="hidden" id="pivo_alignNorth" value="${data.alignNorth ? "1" : "0"}">
            <div class="farm-form-divider col-span-2">Pivô parcial</div>
            <div class="equip-field col-span-2">
              <label class="equip-check cadastros-form-check--compact">
                <input type="checkbox" id="pivo_isPartial" ${data.isPartial ? "checked" : ""}>
                <span class="pivo-check-nowrap">Este pivô é parcial (define ângulo de início e fim)</span>
              </label>
            </div>
            <div id="pivoPartialEditor" class="col-span-2 pivo-parcelas-editor-wrap" ${!data.isPartial ? 'style="display:none;"' : ""}>
              <div class="cadastros-form-grid" style="padding:0;">
                <div class="equip-field">
                  <label class="equip-label" for="pivo_startLat">Lat. âng. inicial</label>
                  <input type="number" class="equip-input" id="pivo_startLat" value="${rc(data.startLat)}" step="0.000001" placeholder="">
                </div>
                <div class="equip-field">
                  <label class="equip-label" for="pivo_startLng">Lng. âng. inicial</label>
                  <div class="pivo-coord-wrap">
                    <input type="number" class="equip-input" id="pivo_startLng" value="${rc(data.startLng)}" step="0.000001" placeholder="">
                    <button type="button" id="pivoMapPickStartBtn" class="pivo-pick-icon-btn" title="Capturar ângulo inicial no mapa"><i class="fa-solid fa-crosshairs"></i></button>
                  </div>
                </div>
                <div class="equip-field">
                  <label class="equip-label" for="pivo_endLat">Lat. âng. final</label>
                  <input type="number" class="equip-input" id="pivo_endLat" value="${rc(data.endLat)}" step="0.000001" placeholder="">
                </div>
                <div class="equip-field">
                  <label class="equip-label" for="pivo_endLng">Lng. âng. final</label>
                  <div class="pivo-coord-wrap">
                    <input type="number" class="equip-input" id="pivo_endLng" value="${rc(data.endLng)}" step="0.000001" placeholder="">
                    <button type="button" id="pivoMapPickEndBtn" class="pivo-pick-icon-btn" title="Capturar ângulo final no mapa"><i class="fa-solid fa-crosshairs"></i></button>
                  </div>
                </div>
              </div>
            </div>
            <div class="equip-field col-span-2">
              <button type="button" id="pivoMapResetCoordsBtn" class="cad-draw-btn cad-draw-btn--clear pivo-reset-btn">
                <i class="fa-solid fa-rotate-left"></i> Resetar todas as coordenadas
              </button>
              <p class="cad-draw-hint">Use os botões de localização para posicionar o centro e o ângulo 0°; depois, se precisar, ajuste arrastando os pinos no mapa.</p>
            </div>
          </div>
        </div>

        <!-- Tab: Segmentos (Portado do Monitoramento) -->
        <div id="content-pivo-segmentos" class="cadastros-form-section">
           <div class="pivo-edit__segments-section pivo-edit-specifics">
             <div class="farm-form-divider" style="margin-top:0;">Planejamento de Segmentos</div>
             <p style="font-size: 11px; color: #64748b; margin-bottom: 16px; line-height: 1.4;">
               Segmente o pivô em faixas de ângulos para representar diferentes cultivos ou manejos. Isso facilita a visualização e o controle da irrigação.
             </p>

             <!-- Segmentos Pré-Definidos -->
             <div style="margin-bottom: 20px;">
               <div style="font-size: 11px; font-weight: 600; color: #374151; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">Configuração automática</div>
               <div class="pivo-preset-row">
                 <button type="button" class="pivo-preset-btn" data-preset="1">1</button>
                 <button type="button" class="pivo-preset-btn" data-preset="2">2</button>
                 <button type="button" class="pivo-preset-btn" data-preset="3">3</button>
                 <button type="button" class="pivo-preset-btn" data-preset="4">4</button>
                 <button type="button" class="pivo-preset-btn" data-preset="5">5</button>
                 <button type="button" class="pivo-preset-btn" data-preset="6">6</button>
                 <button type="button" class="pivo-preset-btn" data-preset="7">7</button>
                 <button type="button" class="pivo-preset-btn" data-preset="8">8</button>
                 <button type="button" class="pivo-preset-btn" data-preset="9">9</button>
               </div>
             </div>

             <!-- Controles do Segmento -->
             <div id="pivoFormSegmentList" style="display: flex; gap: 8px; margin-bottom: 24px; align-items: center; flex-wrap: wrap;">
                <button type="button" class="pivo-seg-num-btn is-active" data-seg-idx="0" style="background:#1D4ED8;--seg-color:#1D4ED8;">1</button>
                <button type="button" class="pivo-seg-add-btn" title="Adicionar segmento"><i class="fa-solid fa-plus"></i></button>
                <button type="button" class="pivo-seg-del-btn" title="Remover segmento" disabled><i class="fa-regular fa-trash-can"></i></button>
             </div>

             <!-- Formulário do Segmento -->
             <div class="cadastros-form-grid" style="grid-template-columns: repeat(2, 1fr); gap: 16px;">
               <div class="equip-field col-span-2">
                 <label class="equip-label" for="pivo_seg_name">Nome do segmento</label>
                 <input class="equip-input" id="pivo_seg_name" type="text" placeholder="Ex: Lado A">
               </div>

               <div class="equip-field">
                 <label class="equip-label" for="pivo_seg_start"><span class="equip-required">*</span> Ângulo inicial</label>
                 <input class="equip-input" id="pivo_seg_start" type="number" value="0" min="0" max="360">
               </div>

               <div class="equip-field">
                 <label class="equip-label" for="pivo_seg_end"><span class="equip-required">*</span> Ângulo final</label>
                 <input class="equip-input" id="pivo_seg_end" type="number" value="360" min="0" max="360">
               </div>
             </div>
           </div>
        </div>

        <!-- Tab: Parcelas -->
        <div id="content-pivo-parcelas" class="cadastros-form-section">
          <div class="cadastros-form-grid">
            <div class="equip-field col-span-2">
              <label class="equip-check cadastros-form-check--compact">
                <input type="checkbox" id="pivo_hasParcelas" ${data.hasParcelas ? "checked" : ""}>
                <span class="pivo-check-nowrap">Este pivô possui parcelas cadastradas</span>
              </label>
            </div>
            <div id="pivoParcelasEditor" class="col-span-2 pivo-parcelas-editor-wrap" ${!data.hasParcelas ? 'style="display:none;"' : ""}>
              <div class="cadastros-form-grid" style="padding:0;">
                <div class="equip-field">
                  <label class="equip-label" for="pivo_parcela_name">Nome da parcela</label>
                  <input type="text" class="equip-input" id="pivo_parcela_name" placeholder="Ex: A, Norte, Sul">
                </div>
                <div class="equip-field">
                  <div class="equip-label">&nbsp;</div>
                </div>
                <div class="equip-field">
                  <label class="equip-label" for="pivo_parcela_start">Âng. início (°) → a partir do zero</label>
                  <div class="pivo-coord-wrap">
                    <input type="number" class="equip-input" id="pivo_parcela_start" min="0" max="360" step="0.1" placeholder="0">
                    <button type="button" id="pivoParcelaPickStartBtn" class="pivo-pick-icon-btn" title="Capturar ângulo inicial no mapa"><i class="fa-solid fa-crosshairs"></i></button>
                  </div>
                </div>
                <div class="equip-field">
                  <label class="equip-label" for="pivo_parcela_end">Âng. fim (°) → a partir do zero</label>
                  <div class="pivo-coord-wrap">
                    <input type="number" class="equip-input" id="pivo_parcela_end" min="0" max="360" step="0.1" placeholder="360">
                    <button type="button" id="pivoParcelaPickEndBtn" class="pivo-pick-icon-btn" title="Capturar ângulo final no mapa"><i class="fa-solid fa-crosshairs"></i></button>
                  </div>
                </div>
                <div class="equip-field col-span-2">
                  <button type="button" id="pivoParcelaSaveBtn" class="cad-draw-btn cad-draw-btn--draw" style="background:#16a34a;color:#fff;border-color:#16a34a;">
                    <i class="fa-solid fa-plus"></i> Adicionar parcela
                  </button>
                </div>
                <div class="equip-field col-span-2">
                  <div id="pivoParcelasListWrap"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab: Canhão Final -->
        <div id="content-pivo-canhao" class="cadastros-form-section">
          <input type="hidden" id="pivo_canhao_mode" value="${data.canhaoMode || 'off'}">
          <input type="hidden" id="pivo_canhao_seg_json" value="${JSON.stringify(data.canhaoSegments || []).replace(/"/g, '&quot;')}">


          <div style="padding: 4px 0 0;">

            <div style="margin-bottom: 18px;">
              <div class="pivo-canhao-section-label">Modo de irrigação com canhão final</div>
              <div style="max-width: 260px;">
                <select class="equip-input" id="pivo_canhao_mode_select">
                  <option value="off"     ${(data.canhaoMode || 'off') === 'off' ? 'selected' : ''}>Sempre desligado</option>
                  <option value="on"      ${data.canhaoMode === 'on' ? 'selected' : ''}>Sempre ligado</option>
                  <option value="segment" ${data.canhaoMode === 'segment' ? 'selected' : ''}>Por segmento</option>
                </select>
              </div>
            </div>

            <div id="canhaoSegSection" style="display:${data.canhaoMode === 'segment' ? '' : 'none'}; margin-bottom: 18px;">
              <div class="pivo-canhao-section-label">Segmentos com canhão ativo</div>
              <div id="canhaoSegList" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;"></div>
              <div class="cadastros-form-grid" style="grid-template-columns:repeat(2,1fr);gap:12px;">
                <div class="equip-field">
                  <label class="equip-label" for="pivo_canhao_seg_start"><span class="equip-required">*</span> Ângulo inicial</label>
                  <input class="equip-input" id="pivo_canhao_seg_start" type="number" min="0" max="360" placeholder="Ex: 270">
                </div>
                <div class="equip-field">
                  <label class="equip-label" for="pivo_canhao_seg_end"><span class="equip-required">*</span> Ângulo final</label>
                  <input class="equip-input" id="pivo_canhao_seg_end" type="number" min="0" max="360" placeholder="Ex: 90">
                </div>
              </div>
            </div>

          </div>
        </div>



        <!-- Tab: Vínculos -->
        <div id="content-pivo-vinculos" class="cadastros-form-section">
          <input type="hidden" id="pivo_talhoes_ids" value="${JSON.stringify([...selectedTalhaoIds]).replace(/"/g, '&quot;')}">
          <input type="hidden" id="pivo_monitoramento_ids" value="${JSON.stringify(data.monitorIds || []).replace(/"/g, '&quot;')}">

          <div class="vinc-wrapper">

            <!-- Transfer list: Talhões -->
            <div class="vinc-block">
              <div class="vinc-block__title"><i class="fa-solid fa-map"></i> Talhões</div>
              <div class="vinc-block__divider"></div>
              <ul class="vinc-list vinc-list--single" id="vinc-talhoes-list">
                    ${currentFarmTalhoes.map(t => `<li class="vinc-item${selectedTalhaoIds.has(String(t.id)) ? ' is-selected' : ''}" data-id="${t.id}"><i class="fa-solid fa-seedling vinc-item__icon"></i><span>${t.name || 'Talhão sem nome'}</span></li>`).join('') || '<li class="vinc-empty">Nenhum talhão cadastrado</li>'}
              </ul>
            </div>

            <!-- Transfer list: Pluviômetros -->
            <div class="vinc-block">
              <div class="vinc-block__title"><i class="fa-solid fa-cloud-rain"></i> Pluviômetros</div>
              <div class="vinc-block__divider"></div>
              <ul class="vinc-list vinc-list--single" id="vinc-pluvio-list">
                    ${(() => { const all = getFarmEquipmentList(farms.find(f => String(f.id) === String(currentFarmId))).filter(e => e.type === 'pluviometro'); const linked = new Set((data.monitorIds || []).map(String)); return all.map(e => `<li class="vinc-item${linked.has(String(e.id)) ? ' is-selected' : ''}" data-id="${e.id}"><i class="fa-solid fa-droplet vinc-item__icon"></i><span>${e.name || 'Pluviômetro'}</span></li>`).join('') || '<li class="vinc-empty">Nenhum pluviômetro cadastrado</li>'; })()}
              </ul>
            </div>

          </div>
        </div>

        <!-- Tab: Proteção -->
        <div id="content-pivo-protecao" class="cadastros-form-section">
          <div class="cadastros-form-grid">
            <div class="equip-field">
              <label class="equip-label" for="pivo_pumpTimeLimit" style="overflow: visible;"><span class="equip-required">*</span> Tempo de energia <span class="edit-panel__tooltip-icon" data-tooltip="Tempo de espera antes de retomar a operação após uma queda de energia."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="equip-input-with-suffix">
                <input type="number" class="equip-input" id="pivo_pumpTimeLimit" value="${data.pumpTimeLimit || "1"}" step="1">
                <span class="equip-suffix">min</span>
              </div>
            </div>
            <div class="equip-field col-span-2">
              <label class="equip-check cadastros-form-check--compact">
                <input type="checkbox" id="pivo_voltageController" ${data.voltageController !== false ? "checked" : ""}>
                <span class="pivo-check-nowrap" style="color:var(--ink-900);font-weight:600;">Controlador de tensão <span class="edit-panel__tooltip-icon" data-tooltip="Impede que o equipamento opere fora das tensões mínima e máxima por tempo maior do que o tempo limite."><i class="fa-regular fa-circle-question"></i></span></span>
              </label>
            </div>
            <div id="pivoVoltageFields" class="col-span-2 grid grid-cols-2 gap-4" style="display:${data.voltageController !== false ? 'grid' : 'none'};">
              <div class="equip-field">
                <label class="equip-label" for="pivo_voltageMin"><span class="equip-required">*</span> Tensão mínima de operação</label>
                <div class="equip-input-with-suffix">
                  <input type="number" class="equip-input" id="pivo_voltageMin" value="${data.voltageMin || "400"}" placeholder="Ex: 400">
                  <span class="equip-suffix">V</span>
                </div>
              </div>
              <div class="equip-field">
                <label class="equip-label" for="pivo_voltageMax"><span class="equip-required">*</span> Tensão máxima de operação</label>
                <div class="equip-input-with-suffix">
                  <input type="number" class="equip-input" id="pivo_voltageMax" value="${data.voltageMax || "600"}" placeholder="Ex: 600">
                  <span class="equip-suffix">V</span>
                </div>
              </div>
              <div class="equip-field">
                <label class="equip-label" for="pivo_voltageTimeLimit" style="overflow: visible;"><span class="equip-required">*</span> Tempo limite <span class="edit-panel__tooltip-icon" data-tooltip="Período de tolerância em que o pivô pode operar fora das tensões mínima ou máxima antes de desligar por segurança."><i class="fa-regular fa-circle-question"></i></span></label>
                <div class="equip-input-with-suffix">
                  <input type="number" class="equip-input" id="pivo_voltageTimeLimit" value="${data.voltageTimeLimit || "2"}" step="1">
                  <span class="equip-suffix">min</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
      <div class="cadastros-form-footer cadastros-form-footer--pivo">
          <button type="button" class="cad-form-action-btn cad-form-action-btn--ghost" id="pivoFormCancelBtn" onclick="window.IcCancelCurrent('sistemas-irrigacao')">
            <i class="fa-solid fa-xmark"></i> Cancelar
          </button>
          <button type="button" class="cad-form-action-btn cad-form-action-btn--primary" id="pivoFormSaveBtn" onclick="window.IcSaveRecord('sistemas-irrigacao')">
            <i class="fa-solid fa-floppy-disk"></i> Salvar
          </button>
      </div>
    </div>`;

    if (window.Cad?.formPivos?.bindPivoFormBaseListeners) {
      window.Cad.formPivos.bindPivoFormBaseListeners(container, source, currentFarmId);
    } else {
      if (window.Cad?.formPivos?.renderPivoParcelasAndSegmentsEditor) {
        window.Cad.formPivos.renderPivoParcelasAndSegmentsEditor();
      }
      if (window.Cad?.formPivos?.renderPivoCanhaoEditor) {
        window.Cad.formPivos.renderPivoCanhaoEditor();
      }
      if (window.Cad?.formPivos?.renderPivoMapAndCoordinateListeners) {
        window.Cad.formPivos.renderPivoMapAndCoordinateListeners(container, source, currentFarmId);
      }
    }
  }


  Cad.pivosFormRender = Object.assign(Cad.pivosFormRender || {}, {
    renderFormPivos
  });
})();
