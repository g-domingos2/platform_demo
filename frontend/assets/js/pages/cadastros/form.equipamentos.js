(function () {
  "use strict";
  const Cad = (window.Cad = window.Cad || {});

  const state = Cad.state;
  let pluvMaintenanceOutsideClickHandler = null;
  let moduleFuncSelectOutsideClickHandler = null;

  function renderEquipTypeSpecificFields(type, data) {
    const escapeAttr = Cad.ui.escapeAttr;
    const d = data?.data || {};
    const pluvType = String(d.pluviometroType || d.tipoPluviometro || d.tipo || "Estação compacta");
    let fields = "";

    if (type === "smart_connect") {
      fields = `
        <div class="equip-field col-span-2" style="display:none;">
          <label class="equip-label" for="equip_pluv_type">Tipo de pluviômetro</label>
          <select class="equip-input" id="equip_pluv_type">
            <option value="Bascula" ${pluvType === "Bascula" ? "selected" : ""}>Báscula</option>
            <option value="Digital" ${pluvType === "Digital" ? "selected" : ""}>Digital</option>
            <option value="Estação compacta" ${pluvType === "Estação compacta" ? "selected" : ""}>Estação compacta</option>
          </select>
        </div>
        <div class="equip-field col-span-2">
          <label class="equip-label" for="equip_manufacturer">Fabricante do equipamento</label>
          <select class="equip-input" id="equip_manufacturer">
            <option value="Bauer"       ${d.manufacturer === "Bauer" ? "selected" : ""}>Bauer</option>
            <option value="Carborundum" ${d.manufacturer === "Carborundum" ? "selected" : ""}>Carborundum</option>
            <option value="Fockink"     ${d.manufacturer === "Fockink" ? "selected" : ""}>Fockink</option>
            <option value="Irrigabras"  ${d.manufacturer === "Irrigabras" ? "selected" : ""}>Irrigabras</option>
            <option value="Krebs"       ${d.manufacturer === "Krebs" ? "selected" : ""}>Krebs</option>
            <option value="Lindsay"     ${d.manufacturer === "Lindsay" ? "selected" : ""}>Lindsay</option>
            <option value="Reinke"      ${d.manufacturer === "Reinke" ? "selected" : ""}>Reinke</option>
            <option value="Valley"      ${d.manufacturer === "Valley" ? "selected" : ""}>Valley</option>
            <option value="outro"       ${d.manufacturer === "outro" ? "selected" : ""}>Outro</option>
          </select>
        </div>
        <div class="equip-field col-span-2">
          <label class="equip-label" for="equip_panel_type">Tipo de painel</label>
          <select class="equip-input" id="equip_panel_type">
            ${d.panelType === "SmartTouch" ? '<option value="SmartTouch" selected disabled>SmartTouch (legado)</option>' : ""}
            <option value="Nexus"        ${d.panelType === "Nexus" ? "selected" : ""}>Nexus</option>
            <option value="SmartConnect" ${d.panelType === "SmartConnect" ? "selected" : ""}>SmartConnect</option>
            ${d.panelType === "Outros" ? '<option value="Outros" selected disabled>Outros (legado)</option>' : ""}
          </select>
        </div>
        <div class="equip-field col-span-2">
          <label class="equip-label" for="equip_comm_type">Tipo de comunicação</label>
          <select class="equip-input" id="equip_comm_type">
            <option value="4G"   ${(!d.commType || d.commType === "4G") ? "selected" : ""}>4G</option>
            <option value="XBEE" ${d.commType === "XBEE" ? "selected" : ""}>Rádio (XBEE)</option>
          </select>
        </div>
        <div class="equip-field">
          <label class="equip-label" for="equip_gateway"><span class="equip-required">*</span> Número do gateway</label>
          <input type="text" class="equip-input" id="equip_gateway" value="${escapeAttr(d.gateway || d.radioController || "")}" placeholder="10000000351D266D">
        </div>
      `;
    } else if (type === "repetidora") {
      fields = `
        <div class="equip-field">
          <label class="equip-label" for="equip_radio">Rádio da repetidora</label>
          <input type="text" class="equip-input" id="equip_radio" value="${escapeAttr(d.radio || "")}" placeholder="0012A20021A0B1C3">
        </div>
        <div class="equip-field">
          <label class="equip-label" for="equip_height">Altura (m)</label>
          <input type="number" class="equip-input" id="equip_height" min="0" step="0.1" value="${escapeAttr(d.height || "")}" placeholder="8">
        </div>
        <div class="equip-field">
          <label class="equip-label" for="equip_power_type">Tipo de alimentação</label>
          <select class="equip-input" id="equip_power_type">
            <option value="Solar"  ${String(d.type || "") === "Solar" ? "selected" : ""}>Solar</option>
            <option value="Bivolt" ${String(d.type || "") === "Bivolt" ? "selected" : ""}>Bivolt</option>
          </select>
        </div>
      `;
    } else if (type === "pluviometro") {
      const pluvType = String(d.pluviometroType || d.tipoPluviometro || d.tipo || "Estação compacta");

      fields = `
        <div class="equip-field col-span-2">
          <label class="equip-label" for="equip_model">Modelo</label>
          <input type="text" class="equip-input" id="equip_model" value="${escapeAttr(d.model || "")}">
        </div>
        <div class="equip-field col-span-2">
          <label class="equip-label" for="equip_pluv_type">Tipo de pluviômetro</label>
          <select class="equip-input" id="equip_pluv_type">
            <option value="Bascula" ${pluvType === "Bascula" ? "selected" : ""}>Báscula</option>
            <option value="Digital" ${pluvType === "Digital" ? "selected" : ""}>Digital</option>
            <option value="Estação compacta" ${pluvType === "Estação compacta" ? "selected" : ""}>Estação compacta</option>
          </select>
        </div>
        <div class="equip-field">
          <label class="equip-label" for="equip_comm_type">Tipo de comunicação</label>
          <select class="equip-input" id="equip_comm_type">
            <option value="4g"   ${(!d.comunicacao || d.comunicacao === "4g") ? "selected" : ""}>4G</option>
            <option value="radio" ${d.comunicacao === "radio" ? "selected" : ""}>Rádio</option>
          </select>
        </div>
        <div class="equip-field">
          <label class="equip-label" for="equip_pivo">Pivô vinculado</label>
          <select class="equip-input" id="equip_pivo">
            <option value="">Sem vínculo</option>

          </select>
        </div>
        <div class="equip-field">
          <label class="equip-label" for="equip_talhao">Talhão vinculado</label>
          <select class="equip-input" id="equip_talhao">
            <option value="">Sem vínculo</option>
            
          </select>
        </div>
      `;
    } else if (type === "estacao_metereologica") {
      fields = `
        <div class="equip-field">
          <label class="equip-label" for="equip_vendor">Fabricante</label>
          <select class="equip-input" id="equip_vendor">
            <option value="Davis">Davis</option>
          </select>
        </div>
        <div class="equip-field">
          <label class="equip-label" for="equip_station_id">ID da estação</label>
          <input type="text" class="equip-input" id="equip_station_id" value="${escapeAttr(d.stationId || "")}" placeholder="F4GT65H32">
        </div>
        <div class="equip-field">
          <label class="equip-label" for="equip_api_key">Chave da API</label>
          <input type="text" class="equip-input" id="equip_api_key" value="${escapeAttr(d.apiKey || "")}" placeholder="aw12!fg4SYufdGg3@1ssD">
        </div>
        <div class="equip-field">
          <label class="equip-label" for="equip_api_secret">Segredo da API</label>
          <input type="password" class="equip-input" id="equip_api_secret" value="${escapeAttr(d.apiSecret || "")}" placeholder="••••••••••••••••">
        </div>
      `;
    } else if (type === "rainstar") {
      fields = `
        <div class="equip-field">
          <label class="equip-label" for="equip_imei">IMEI</label>
          <input type="text" class="equip-input" id="equip_imei" value="${escapeAttr(d.imei || "")}" placeholder="860585004298393">
        </div>
        <div class="equip-field">
          <label class="equip-label" for="equip_model">Modelo</label>
          <select class="equip-input" id="equip_model">
            <option value="Rainstar A2" ${d.model === "Rainstar A2" ? "selected" : ""}>Rainstar A2</option>
            <option value="Rainstar A3" ${d.model === "Rainstar A3" ? "selected" : ""}>Rainstar A3</option>
            <option value="Rainstar A4" ${d.model === "Rainstar A4" ? "selected" : ""}>Rainstar A4</option>
          </select>
        </div>
        <div class="equip-field">
          <label class="equip-label" for="equip_method">Método</label>
          <select class="equip-input" id="equip_method">
            <option value="Puxando o carrinho (Padrão)"  ${d.method === "Puxando o carrinho (Padrão)" ? "selected" : ""}>Puxando o carrinho (Padrão)</option>
            <option value="Recolhendo o carrinho"         ${d.method === "Recolhendo o carrinho" ? "selected" : ""}>Recolhendo o carrinho</option>
          </select>
        </div>
        <div class="equip-field">
          <label class="equip-label" for="equip_flow">Taxa de fluxo (m³/h)</label>
          <input type="number" class="equip-input" id="equip_flow" min="0" step="0.01" value="${escapeAttr(d.flow || "")}" placeholder="0">
        </div>
        <div class="equip-field">
          <label class="equip-label" for="equip_width">Largura operacional (m)</label>
          <input type="number" class="equip-input" id="equip_width" min="0" step="0.01" value="${escapeAttr(d.width || "")}" placeholder="0">
        </div>
      `;
    } else if (type === "irripump") {
      fields = ` `;
    } else if (type === "medidor") {
      fields = ` `;
    }

    if (!fields || !fields.trim()) return "";
    return fields;
  }

  function renderEquipTypeFieldsHost(type, data) {
    const host = document.getElementById("equipTypeFieldsHost");
    if (!host) return;
    host.innerHTML = renderEquipTypeSpecificFields(type, data);
    host.style.display = host.innerHTML.trim() ? "" : "none";
    Cad.ui.initCadCustomSelects(host);
    const modulosSection = document.getElementById("equipModulosSection");
    if (modulosSection) {
      modulosSection.style.display = (type === "medidor" || type === "irripump") ? "flex" : "none";
    }
  }

  function renderEquipTypePicker(container) {
    const escapeAttr = Cad.ui.escapeAttr;
    const EQUIP_PICKER_CARDS = Cad.EQUIP_PICKER_CARDS;
    container.innerHTML = `
    <div class="cadastros-form-card">
      <div class="cadastros-form-topbar">
        <div class="cadastros-form-topbar__text">Novo Equipamento</div>
      </div>
      <div class="cadastros-form-content">
        <div class="cadastros-form-section is-active" style="padding:16px 20px;">
          <p style="font-size:13px; color:#64748b; margin:0 0 14px;">Selecione o tipo de equipamento que deseja cadastrar.</p>
          <div class="create-equip__grid" role="list">
            ${EQUIP_PICKER_CARDS.map(c => `
              <button class="create-equip__card card" type="button" role="listitem" data-equip-pick="${escapeAttr(c.value)}">
                <img class="create-equip__img" src="${escapeAttr(c.img)}" alt="${escapeAttr(c.label)}">
                <div class="create-equip__card-body">
                  <div class="create-equip__card-title">${c.label}</div>
                  <div class="create-equip__card-desc">${c.desc}</div>
                </div>
              </button>
            `).join("")}
          </div>
        </div>
      </div>
      <div class="cadastros-form-footer cadastros-form-footer--equip">
        <button type="button" class="cad-form-action-btn cad-form-action-btn--ghost" onclick="window.IcCancelCurrent('equipamentos')">
          <i class="fa-solid fa-xmark"></i> Cancelar
        </button>
      </div>
    </div>`;

    container.querySelectorAll("[data-equip-pick]").forEach(btn => {
      btn.addEventListener("click", () => {
        renderFormEquipamentos(null, container, btn.dataset.equipPick);
      });
    });

    // Centraliza mapa na fazenda ativa assim que o picker abre
    setTimeout(() => {
      const entry = Cad.viewMaps.ensureSectionMap("cadastrosEquipamentosMap");
      if (entry) {
        const view = Cad.data.getActiveFarmView();
        entry.map.setView(view.center, view.zoom);
        entry.map.invalidateSize();
      }
    }, 300);
  }

  function buildPluvTopbarTabs() {
    return `
      <span class="cadastros-form-topbar__sep">-</span>
      <aside class="cadastros-form-topbar__actions edit-panel__nav" aria-label="Atalhos">
        <button class="farm-tab-btn edit-panel__nav-item is-active" type="button" data-target="#pluvEditGeneral">Geral</button>
        <button class="farm-tab-btn edit-panel__nav-item" type="button" data-target="#pluvEditAssociation">Vínculo</button>
        <button class="farm-tab-btn edit-panel__nav-item" type="button" data-target="#pluvEditMaintenance">Manutenção</button>
        <button class="farm-tab-btn edit-panel__nav-item" type="button" data-target="#pluvEditSensors">Sensores</button>
        <button class="farm-tab-btn edit-panel__nav-item" type="button" data-target="#pluvEditRedundancy">Redundância</button>
        <button class="farm-tab-btn edit-panel__nav-item" type="button" data-target="#pluvEditFirmware">Firmware (OTA)</button>
      </aside>`;
  }

  function buildPluvMaintenanceMarkup() {
    return `
      <div class="maint">
        <div class="maint__header">
          <div class="maint__title">Manutenção</div>
          <span class="maint__summary"><span class="maint__summary-pill maint__summary-pill--danger">Atraso</span></span>
        </div>
        <div class="maint__timeline is-overdue" style="--maint-today: 99%; --maint-next: 50%; --maint-done-gradient: linear-gradient(90deg, rgb(22, 163, 74) 0%, rgb(22, 163, 74) 100%); --maint-overdue-gradient: linear-gradient(90deg, #f59e0b 0%, #f59e0b 35%, #ef4444 100%);">
          <div class="maint__track">
            <span class="maint__line maint__line--base"></span>
            <span class="maint__line maint__line--ok"></span>
            <span class="maint__marker maint__marker--last"></span>
            <span class="maint__marker maint__marker--today"></span>
            <span class="maint__marker maint__marker--next is-overdue"></span>
          </div>
          <div class="maint__labels">
            <span class="maint__label maint__label--last">
              <span class="maint__label-title">Última manutenção</span>
              <span class="maint__label-date">15/01/2026</span>
            </span>
            <span class="maint__label maint__label--today">
              <span class="maint__label-title">Hoje</span>
            </span>
            <span class="maint__label maint__label--next">
              <span class="maint__label-title">Manutenção em atraso desde</span>
              <span class="maint__label-date">11/02/2026</span>
            </span>
          </div>
        </div>
        <div class="maint__alert maint__alert--danger">
          <span class="maint__alert-ico"><i class="fa-solid fa-triangle-exclamation"></i></span>
          <div>
            <div class="maint__alert-title">Manutenção em atraso há 42 dias</div>
            <div class="maint__alert-sub">Ação imediata necessária</div>
          </div>
        </div>
        <div class="maint-config">
          <div class="maint-config__head">
            <i class="fa-regular fa-calendar-check"></i>
            <span>Configuração de manutenção</span>
          </div>
          <div class="maint-config__grid">
            <div class="maint__field">
              <div class="maint__field-label">Frequência de manutenção</div>
              <div class="pluv-maint__select maint__select" data-maint-frequency>
                <button class="pluv-maint__input pluv-maint__input--select maint__input" type="button" data-maint-trigger aria-expanded="false">
                  <span>Mensal (30 dias)</span>
                  <i class="fa-solid fa-chevron-down"></i>
                </button>
                <div class="pluv-maint__menu maint__menu" role="listbox" aria-label="Frequência de manutenção">
                  <button class="pluv-maint__option maint__option" type="button" role="option" data-frequency-option="Semanal (7 dias)"><span>Semanal (7 dias)</span></button>
                  <button class="pluv-maint__option maint__option" type="button" role="option" data-frequency-option="Quinzenal (15 dias)"><span>Quinzenal (15 dias)</span></button>
                  <button class="pluv-maint__option maint__option is-active" type="button" role="option" data-frequency-option="Mensal (30 dias)"><span>Mensal (30 dias)</span><i class="fa-solid fa-check"></i></button>
                  <button class="pluv-maint__option maint__option" type="button" role="option" data-frequency-option="Bimestral (60 dias)"><span>Bimestral (60 dias)</span></button>
                  <button class="pluv-maint__option maint__option" type="button" role="option" data-frequency-option="Trimestral (90 dias)"><span>Trimestral (90 dias)</span></button>
                  <button class="pluv-maint__option maint__option" type="button" role="option" data-frequency-option="Semestral (180 dias)"><span>Semestral (180 dias)</span></button>
                  <button class="pluv-maint__option maint__option" type="button" role="option" data-frequency-option="Anual (365 dias)"><span>Anual (365 dias)</span></button>
                </div>
              </div>
            </div>
            <div class="maint__field">
              <div class="maint__field-label"><i class="fa-regular fa-bell"></i> Lembrete</div>
              <div class="pluv-maint__select maint__select" data-reminder-select>
                <button class="pluv-maint__input pluv-maint__input--select maint__input" type="button" data-reminder-trigger aria-expanded="false">
                  <span>3 dias antes</span>
                  <i class="fa-solid fa-chevron-down"></i>
                </button>
                <div class="pluv-maint__menu maint__menu" role="listbox" aria-label="Lembrete">
                  <button class="pluv-maint__option maint__option" type="button" role="option" data-reminder-option="1"><span>1 dia antes</span></button>
                  <button class="pluv-maint__option maint__option" type="button" role="option" data-reminder-option="2"><span>2 dias antes</span></button>
                  <button class="pluv-maint__option maint__option is-active" type="button" role="option" data-reminder-option="3"><span>3 dias antes</span><i class="fa-solid fa-check"></i></button>
                  <button class="pluv-maint__option maint__option" type="button" role="option" data-reminder-option="5"><span>5 dias antes</span></button>
                  <button class="pluv-maint__option maint__option" type="button" role="option" data-reminder-option="7"><span>7 dias antes</span></button>
                </div>
              </div>
            </div>
            <div class="maint__field">
              <div class="maint__field-label"><i class="fa-solid fa-user"></i> Responsável padrão</div>
              <div class="pluv-maint__select maint__select" data-responsible-select>
                <button class="pluv-maint__input pluv-maint__input--select maint__input" type="button" data-responsible-trigger aria-expanded="false">
                  <span>Bauer Irricontrol</span>
                  <i class="fa-solid fa-chevron-down"></i>
                </button>
                <div class="pluv-maint__menu maint__menu" role="listbox" aria-label="Responsável padrão">
                  <button class="pluv-maint__option maint__option" type="button" role="option" data-responsible-option="Bauer Irricontrol"><span>Bauer Irricontrol</span></button>
                  <button class="pluv-maint__option maint__option" type="button" role="option" data-responsible-option="Bauer Irricontrol"><span>Bauer Irricontrol</span></button>
                  <button class="pluv-maint__option maint__option" type="button" role="option" data-responsible-option="Bauer Irricontrol"><span>Bauer Irricontrol</span></button>
                  <button class="pluv-maint__option maint__option" type="button" role="option" data-responsible-option="Bauer Irricontrol"><span>Bauer Irricontrol</span></button>
                  <button class="pluv-maint__option maint__option is-active" type="button" role="option" data-responsible-option="Bauer Irricontrol"><span>Bauer Irricontrol</span><i class="fa-solid fa-check"></i></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="maint-history edit-panel__maintenance-history-card">
        <div class="maint-history__head">
          <div class="maint-history__title">
            <span class="maint-history__icon"><i class="fa-regular fa-file-lines"></i></span>
            <span>Histórico de manutenções</span>
          </div>
        </div>
        <ul class="maint-history__list">
          <li class="maint-history__item">
            <div class="maint-history__top">
              <span class="maint-history__date">08/01/2026</span>
              <span class="maint__pill maint__pill--ok"><i class="fa-solid fa-check"></i> Confirmado no dispositivo</span>
            </div>
            <div class="maint-history__meta">
              <span>Tipo realizado: Verificação periódica</span>
              <span>Responsável: Bauer Irricontrol</span>
            </div>
          </li>
          <li class="maint-history__item">
            <div class="maint-history__top">
              <span class="maint-history__date">26/12/2025</span>
              <span class="maint__pill maint__pill--warn"><i class="fa-solid fa-triangle-exclamation"></i> Corretiva fora do ciclo</span>
            </div>
            <div class="maint-history__meta">
              <span>Tipo realizado: Troca de sensor</span>
              <span>Responsável: Bauer Irricontrol</span>
            </div>
          </li>
        </ul>
      </div>
    `;
  }

  function buildPluvSensorsMarkup() {
    return `
      <div class="pluv-sensors">
        <div class="pluv-sensors__grid">
          <div class="pluv-sensors__field">
            <label for="pluvSensorModel">Modelo do Sensor</label>
            <input class="pluv-sensors__input" id="pluvSensorModel" value="Davis">
          </div>
          <div class="pluv-sensors__field">
            <label for="pluvSensorPulse">Valor por Pulso (mm)</label>
            <input class="pluv-sensors__input" id="pluvSensorPulse" value="0.254">
            <span class="pluv-sensors__hint">Até 3 casas decimais</span>
          </div>
        </div>
        <div class="pluv-sensors__divider"></div>
        <div class="pluv-sensors__section-title">Chuva Válida (threshold)</div>
        <div class="pluv-sensors__inline">
          <div class="pluv-sensors__field">
            <label for="pluvSensorMin">Mínimo (mm)</label>
            <input class="pluv-sensors__input" id="pluvSensorMin" value="1">
          </div>
          <span class="pluv-sensors__inline-text">em</span>
          <div class="pluv-sensors__field">
            <label for="pluvSensorTime">Tempo (min)</label>
            <input class="pluv-sensors__input" id="pluvSensorTime" value="10">
          </div>
        </div>
        <div class="pluv-sensors__note">Considera chuva válida se &gt;1mm em 10 minutos</div>
      </div>
    `;
  }

  function buildPluvRedundancyMarkup() {
    return `
      <div class="pluv-red">
        <div class="pluv-red__row pluv-red__row--main">
          <div class="pluv-red__control">
            <div class="pluv-red__label">Limite de divergência</div>
            <div class="pluv-red__slider">
              <input type="range" id="pluvRedundancyLimit" min="0" max="100" step="1" value="22" style="--red-fill: 22%;">
              <span class="pluv-red__value">22%</span>
            </div>
            <div class="pluv-red__hint">Alertar quando a diferença entre sensores exceder este limite</div>
          </div>
          <div class="pluv-red__alert">
            <div class="pluv-red__alert-left">
              <span class="pluv-red__alert-ico"><i class="fa-solid fa-triangle-exclamation"></i></span>
              <div>
                <div class="pluv-red__title">Alerta automático</div>
                <div class="pluv-red__sub">quando exceder o limite</div>
              </div>
            </div>
            <button class="pluv-switch is-on" type="button" aria-pressed="true"></button>
          </div>
        </div>
      </div>
    `;
  }

  function buildPluvFirmwareMarkup() {
    return `
      <div class="pluv-fw">
        <div class="pluv-fw__header">
          <div class="pluv-fw__title">
            <span class="pluv-fw__icon"><i class="fa-solid fa-download"></i></span>
            <div class="pluv-fw__title-text">
              <span class="pluv-fw__name">Firmware (OTA)</span>
              <span class="pluv-fw__sub">Atualizacao remota com rastreabilidade do ciclo OTA</span>
            </div>
          </div>
          <button class="pluv-fw__toggle" type="button" aria-label="Recolher"><i class="fa-solid fa-chevron-up"></i></button>
        </div>
        <div class="pluv-fw__body">
          <div class="pluv-fw__version-row">
            <div class="pluv-fw__version">
              <span class="pluv-fw__label">Versão atual</span>
              <strong class="pluv-fw__value">2.4.1</strong>
            </div>
            <div class="pluv-fw__version pluv-fw__version--right">
              <span class="pluv-fw__pill">Nova versão disponível</span>
              <strong class="pluv-fw__value">2.5.0</strong>
            </div>
          </div>
          <button class="pluv-fw__cta" type="button"><i class="fa-solid fa-arrow-down-to-line"></i> Atualizar para 2.5.0</button>
          <div class="pluv-fw__last">
            <span class="pluv-fw__last-label">Última tentativa</span>
            <div class="pluv-fw__last-row">
              <span class="pluv-fw__badge"><i class="fa-solid fa-circle-check"></i> Sucesso</span>
              <span class="pluv-fw__date">07/02/2026</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function setupPluviometroTabs(container, equipment = {}) {
    const section = container.querySelector(".cadastros-form-section.is-active");
    const grid = section?.querySelector(".cadastros-form-grid");
    if (!section || !grid) return;

    const equipTypeSelect = grid.querySelector("#equip_type");
    const fieldName = grid.querySelector("#equip_name")?.closest(".equip-field");
    const fieldSerial = grid.querySelector("#equip_serial")?.closest(".equip-field");
    const fieldLocation = grid.querySelector("#equip_latlng")?.closest(".equip-field");
    const fieldPivos = grid.querySelector("#equipPivoMulti")?.closest(".equip-field");
    const fieldTalhoes = grid.querySelector("#equipTalhaoMulti")?.closest(".equip-field");
    const sensorsHost = grid.querySelector("#equipTypeFieldsHost");
    const fieldModel = grid.querySelector("#equip_model")?.closest(".equip-field");
    const fieldPluvType = grid.querySelector("#equip_pluv_type")?.closest(".equip-field");
    const fieldCommType = grid.querySelector("#equip_comm_type")?.closest(".equip-field");
    const fieldLinkedPivo = grid.querySelector("#equip_pivo")?.closest(".equip-field");
    const fieldLinkedTalhao = grid.querySelector("#equip_talhao")?.closest(".equip-field");
    const commLabel = fieldCommType?.querySelector(".equip-label");
    if (commLabel) commLabel.innerHTML = `<span class="equip-required">*</span>Tipo de comunicacao`;
    const pluvTypeLabel = fieldPluvType?.querySelector(".equip-label");
    if (pluvTypeLabel) pluvTypeLabel.textContent = "Tipo de pluviometro";

    const commSelect = fieldCommType?.querySelector("#equip_comm_type");
    if (commSelect) {
      const currentComm = String(commSelect.value || "").toLowerCase();
      commSelect.innerHTML = `
        <option value="4g">4G</option>
        <option value="radio">Radio</option>`;
      commSelect.value = (currentComm === "radio") ? "radio" : "4g";
    }

    const pluvTypeSelect = fieldPluvType?.querySelector("#equip_pluv_type");
    if (pluvTypeSelect) {
      const currentRaw = String(pluvTypeSelect.value || "").toLowerCase();
      const currentType = currentRaw.includes("bascul")
        ? "Bascula"
        : (currentRaw.includes("digital") ? "Digital" : "Estacao compacta");
      pluvTypeSelect.innerHTML = `
        <option value="Bascula">Bascula</option>
        <option value="Digital">Digital</option>
        <option value="Estacao compacta">Estacao compacta</option>`;
      pluvTypeSelect.value = currentType;
    }

    const extractedNodes = [
      fieldName, fieldSerial, fieldLocation, fieldPivos, fieldTalhoes,
      fieldModel, fieldPluvType, fieldCommType, fieldLinkedPivo, fieldLinkedTalhao,
      sensorsHost
    ].filter(Boolean);
    extractedNodes.forEach((node) => node.remove());
    if (equipTypeSelect) equipTypeSelect.remove();
    grid.innerHTML = "";

    if (equipTypeSelect) grid.appendChild(equipTypeSelect);

    const panesHost = document.createElement("div");
    panesHost.className = "equip-pluv-panes col-span-2";

    function createPane(id, emptyText) {
      const pane = document.createElement("section");
      pane.id = id;
      pane.className = "equip-pluv-pane";
      const paneGrid = document.createElement("div");
      paneGrid.className = "equip-pluv-pane__grid";
      pane.appendChild(paneGrid);
      if (emptyText) {
        const empty = document.createElement("div");
        empty.className = "equip-field col-span-2 equip-pluv-placeholder";
        empty.textContent = emptyText;
        paneGrid.appendChild(empty);
      }
      return { pane, paneGrid };
    }

    const general = createPane("pluvEditGeneral");
    const association = createPane("pluvEditAssociation");
    const maintenance = createPane("pluvEditMaintenance", "Sem campos de manutenção nesta etapa.");
    const sensors = createPane("pluvEditSensors", "Sem sensores adicionais nesta etapa.");
    const redundancy = createPane("pluvEditRedundancy", "Sem configurações de redundância nesta etapa.");
    const firmware = createPane("pluvEditFirmware", "Sem configurações de firmware (OTA) nesta etapa.");

    [fieldModel, fieldPluvType, fieldCommType, fieldLinkedPivo, fieldLinkedTalhao].forEach((field) => {
      if (field) field.classList.add("col-span-2");
    });

    if (fieldSerial) general.paneGrid.appendChild(fieldSerial);
    if (fieldName) general.paneGrid.appendChild(fieldName);
    if (fieldModel) general.paneGrid.appendChild(fieldModel);
    if (fieldPluvType) general.paneGrid.appendChild(fieldPluvType);
    if (fieldCommType) general.paneGrid.appendChild(fieldCommType);
    if (fieldLocation) {
      const locDivider = document.createElement("div");
      locDivider.className = "farm-form-divider col-span-2";
      locDivider.textContent = "Localização";
      general.paneGrid.appendChild(locDivider);
      general.paneGrid.appendChild(fieldLocation);
    }
    {
      const farmId = Cad.data.getCurrentContextFarmId();
      const linkedTalhaoIds = new Set((equipment?.talhaoIds || []).map(String));
      const linkedPivoIds = new Set((equipment?.pivoIds || (equipment?.pivoId ? [equipment.pivoId] : [])).map(String));
      const talhoes = Cad.data.getTalhoesByFarm(farmId) || [];
      const pivos = Cad.data.getAllPivosRecords(farmId) || [];

      const talhaoItems = talhoes.map(t =>
        `<li class="vinc-item${linkedTalhaoIds.has(String(t.id)) ? ' is-selected' : ''}" data-id="${t.id}">
          <i class="fa-solid fa-seedling vinc-item__icon"></i><span>${t.name || 'Talhão'}</span>
        </li>`
      ).join('') || '<li class="vinc-empty">Nenhum talhão cadastrado</li>';

      const pivoItems = pivos.map(p =>
        `<li class="vinc-item${linkedPivoIds.has(String(p.id)) ? ' is-selected' : ''}" data-id="${p.id}">
          <i class="fa-solid fa-circle-notch vinc-item__icon"></i><span>${p.name || 'Pivô'}</span>
        </li>`
      ).join('') || '<li class="vinc-empty">Nenhum pivô cadastrado</li>';

      association.paneGrid.innerHTML = `
        <div class="col-span-2">
          <div class="vinc-wrapper">
            <div class="vinc-block">
              <div class="vinc-block__title"><i class="fa-solid fa-map"></i> Talhões</div>
              <div class="vinc-block__divider"></div>
              <ul class="vinc-list vinc-list--single" id="vinc-pluv-talhoes-list">${talhaoItems}</ul>
            </div>
            <div class="vinc-block">
              <div class="vinc-block__title"><i class="fa-solid fa-circle-notch"></i> Pivôs</div>
              <div class="vinc-block__divider"></div>
              <ul class="vinc-list vinc-list--single" id="vinc-pluv-pivos-list">${pivoItems}</ul>
            </div>
          </div>
        </div>`;
    }
    // Click handlers nos vinc-items da aba Vínculo
    association.pane.querySelectorAll(".vinc-item").forEach((item) => {
      item.addEventListener("click", () => {
        item.classList.toggle("is-selected");
        renderVinculoMap();
      });
    });

    maintenance.paneGrid.innerHTML = `<div class="equip-field col-span-2">${buildPluvMaintenanceMarkup()}</div>`;

    // Inicializa os custom selects do maint-config
    maintenance.paneGrid.querySelectorAll(".pluv-maint__select").forEach((selectEl) => {
      const trigger = selectEl.querySelector("[data-maint-trigger], [data-reminder-trigger], [data-responsible-trigger]");
      const menu = selectEl.querySelector(".pluv-maint__menu");
      const label = trigger?.querySelector("span");
      if (!trigger || !menu) return;

      trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = selectEl.classList.toggle("is-open");
        trigger.setAttribute("aria-expanded", String(isOpen));
      });

      menu.querySelectorAll(".pluv-maint__option").forEach((opt) => {
        opt.addEventListener("click", (e) => {
          e.stopPropagation();
          menu.querySelectorAll(".pluv-maint__option").forEach((o) => {
            o.classList.remove("is-active");
            const chk = o.querySelector(".fa-check");
            if (chk) chk.remove();
          });
          opt.classList.add("is-active");
          if (!opt.querySelector(".fa-check")) {
            const icon = document.createElement("i");
            icon.className = "fa-solid fa-check";
            opt.appendChild(icon);
          }
          if (label) label.textContent = opt.querySelector("span")?.textContent || opt.textContent.trim();
          selectEl.classList.remove("is-open");
          trigger.setAttribute("aria-expanded", "false");
        });
      });
    });

    if (pluvMaintenanceOutsideClickHandler) {
      document.removeEventListener("click", pluvMaintenanceOutsideClickHandler);
    }

    pluvMaintenanceOutsideClickHandler = () => {
      maintenance.paneGrid.querySelectorAll(".pluv-maint__select.is-open").forEach((el) => {
        el.classList.remove("is-open");
        const t = el.querySelector("[aria-expanded]");
        if (t) t.setAttribute("aria-expanded", "false");
      });
    };

    document.addEventListener("click", pluvMaintenanceOutsideClickHandler, { capture: false });

    sensors.paneGrid.innerHTML = `<div class="equip-field col-span-2">${buildPluvSensorsMarkup()}</div>`;
    redundancy.paneGrid.innerHTML = `<div class="equip-field col-span-2">${buildPluvRedundancyMarkup()}</div>`;
    firmware.paneGrid.innerHTML = `<div class="equip-field col-span-2">${buildPluvFirmwareMarkup()}</div>`;

    [general, association, maintenance, sensors, redundancy, firmware].forEach(({ pane }) => panesHost.appendChild(pane));
    grid.appendChild(panesHost);

    const navButtons = Array.from(container.querySelectorAll(".edit-panel__nav-item[data-target]"));
    const panes = Array.from(panesHost.querySelectorAll(".equip-pluv-pane"));

    const getVincSelection = () => {
      const talhaoIds = new Set(
        Array.from(association.pane.querySelectorAll("#vinc-pluv-talhoes-list .vinc-item.is-selected"))
          .map(el => el.dataset.id)
      );
      const pivoIds = new Set(
        Array.from(association.pane.querySelectorAll("#vinc-pluv-pivos-list .vinc-item.is-selected"))
          .map(el => el.dataset.id)
      );
      return { talhaoIds, pivoIds };
    };

    const renderVinculoMap = () => {
      const farmId = Cad.data.getCurrentContextFarmId();
      const entry = Cad.viewMaps?.ensureSectionMap?.("cadastrosEquipamentosMap");
      if (!entry || !window.L) return;

      if (entry._vincLayer) { entry._vincLayer.clearLayers(); } else { entry._vincLayer = L.layerGroup().addTo(entry.map); }

      const { talhaoIds, pivoIds } = getVincSelection();

      const toggleVincItem = (listId, dataId) => {
        const item = association.pane.querySelector(`#${listId} .vinc-item[data-id="${dataId}"]`);
        if (item) { item.classList.toggle("is-selected"); renderVinculoMap(); }
      };

      // Talhões — polígonos
      const talhoes = Cad.data.getTalhoesByFarm(farmId) || [];
      talhoes.forEach((t) => {
        const pts = Array.isArray(t.points) ? t.points : [];
        if (pts.length < 3) return;
        const selected = talhaoIds.has(String(t.id));
        const color = selected ? "#16a34a" : "#eab308";
        const poly = L.polygon(pts, { color, weight: 2, fill: true, fillOpacity: selected ? 0.14 : 0.08, cursor: "pointer" });
        poly.on("click", () => toggleVincItem("vinc-pluv-talhoes-list", String(t.id)));
        poly.addTo(entry._vincLayer);
        const center = L.polygon(pts).getBounds().getCenter();
        L.marker([center.lat, center.lng], {
          icon: L.divIcon({ className: "cadastros-talhao-icon", html: `<span class="cadastros-talhao-label">${t.name || ''}</span>`, iconSize: null, iconAnchor: null }),
          interactive: false
        }).addTo(entry._vincLayer);
      });

      // Pivôs — setor exato ou círculo completo
      const pivos = Cad.data.getAllPivosRecords(farmId) || [];
      pivos.forEach((p) => {
        const lat = Number(p.lat ?? p.data?.lat ?? "");
        const lng = Number(p.lng ?? p.data?.lng ?? "");
        const radius = Number(p.radius ?? p.data?.radius ?? 0);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0) || radius <= 0) return;

        const selected = pivoIds.has(String(p.id));
        const color = selected ? "#16a34a" : "#eab308";
        const shapeStyle = { color, weight: 2, fill: true, fillOpacity: selected ? 0.14 : 0.06, cursor: "pointer" };

        const isPartial = Cad.geo.toBooleanFlag(p.isPartial ?? p.data?.isPartial);
        const startLat = Number(p.startLat ?? p.data?.startLat ?? "");
        const startLng = Number(p.startLng ?? p.data?.startLng ?? "");
        const endLat   = Number(p.endLat   ?? p.data?.endLat   ?? "");
        const endLng   = Number(p.endLng   ?? p.data?.endLng   ?? "");

        let shapePoints = null;
        if (isPartial && Number.isFinite(startLat) && Number.isFinite(startLng) && Number.isFinite(endLat) && Number.isFinite(endLng)) {
          const startBearing = Cad.geo.bearingBetweenPoints(lat, lng, startLat, startLng) ?? 0;
          const endBearing   = Cad.geo.bearingBetweenPoints(lat, lng, endLat, endLng) ?? startBearing;
          shapePoints = Cad.geo.buildSectorPolygonLatLngs(lat, lng, radius, startBearing, endBearing);
        }

        let shape;
        if (shapePoints && shapePoints.length > 2) {
          shape = L.polygon(shapePoints, shapeStyle);
        } else {
          shape = L.circle([lat, lng], { ...shapeStyle, radius });
        }
        shape.on("click", () => toggleVincItem("vinc-pluv-pivos-list", String(p.id)));
        shape.addTo(entry._vincLayer);

        L.marker([lat, lng], {
          icon: L.divIcon({
            className: "cadastros-talhao-icon",
            html: `<span class="cadastros-talhao-label">${p.name || 'Pivô'}</span>`,
            iconSize: null, iconAnchor: null
          }),
          interactive: false
        }).addTo(entry._vincLayer);
      });

      // Mantém apenas o marcador do pluviômetro sendo editado
      entry.layer.clearLayers();
      const lat = Number(equipment?.data?.lat ?? "");
      const lng = Number(equipment?.data?.lng ?? "");
      if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
        if (!entry._formMarker) {
          entry._formMarker = L.marker([lat, lng], { draggable: false, zIndexOffset: 1000 }).addTo(entry.map);
        }
        entry.map.setView([lat, lng], Math.max(entry.map.getZoom(), 14));
      }

      setTimeout(() => entry.map.invalidateSize(), 0);
    };

    const activateTab = (targetSelector) => {
      navButtons.forEach((btn) => btn.classList.toggle("is-active", btn.getAttribute("data-target") === targetSelector));
      panes.forEach((pane) => pane.classList.toggle("is-active", ("#" + pane.id) === targetSelector));
      if (targetSelector === "#pluvEditAssociation") {
        setTimeout(renderVinculoMap, 50);
      } else {
        // Limpa layer de vínculo ao sair da aba
        const entry = Cad.viewMaps?.ensureSectionMap?.("cadastrosEquipamentosMap");
        if (entry?._vincLayer) entry._vincLayer.clearLayers();
      }
    };

    navButtons.forEach((btn) => {
      btn.addEventListener("click", () => activateTab(btn.getAttribute("data-target")));
    });

    activateTab("#pluvEditGeneral");
  }

  function renderFormEquipamentos(id, container, preselectedType = null) {
    const escapeAttr = Cad.ui.escapeAttr;
    const getEquipmentTypeLabel = Cad.ui.getEquipmentTypeLabel;
    const EQUIP_TYPE_OPTIONS = Cad.EQUIP_TYPE_OPTIONS;

    if (!id && !preselectedType) {
      renderEquipTypePicker(container);
      return;
    }

    const farms = Cad.data.getAllFarms();
    const found = id ? Cad.data.findEquipmentById(id) : null;
    const equipment = found?.equipment || {};
    const equipData = equipment?.data || {};
    const farmId = String(found?.farm?.id || Cad.data.getCurrentContextFarmId() || farms[0]?.id || "");
    const activeFarm = farms.find((f) => String(f.id) === farmId) || farms[0] || {};
    const type = String(equipment?.type || preselectedType || "smart_connect");
    const existingLat = equipData?.lat ?? "";
    const existingLng = equipData?.lng ?? "";
    const selectedTalhaoId = String(equipData?.talhaoId || "");
    const selectedPivoId = String(equipData?.pivoId || "");

    container.innerHTML = `
    <div class="cadastros-form-card">
      <div class="cadastros-form-topbar">
        <div class="cadastros-form-topbar__text">${id ? `Editar ${getEquipmentTypeLabel(type)}` : `Novo ${getEquipmentTypeLabel(type)}`}</div>
        ${type === "pluviometro" ? buildPluvTopbarTabs() : ""}
      </div>

      <div class="cadastros-form-content">
        <div class="cadastros-form-section is-active" style="padding:10px;">
          <div class="cadastros-form-grid cadastros-form-grid--pivo" style="gap:10px; grid-template-columns:repeat(2,minmax(0,1fr));">
            <select id="equip_type" style="display:none;">
              ${EQUIP_TYPE_OPTIONS.map((opt) => `<option value="${opt.value}" ${opt.value === type ? "selected" : ""}>${opt.label}</option>`).join("")}
            </select>

            <div class="equip-field col-span-2">
              <label class="equip-label" for="equip_name"><span class="equip-required">*</span>Nome do Equipamento</label>
              <input type="text" class="equip-input" id="equip_name" value="${escapeAttr(equipment?.name || equipData?.nome || "")}" placeholder="Ex: Bomba Principal, Poço 01">
            </div>

            <div class="equip-field col-span-2">
              <label class="equip-label" for="equip_serial">ID do dispositivo</label>
              <div class="equip-latlng-row">
                <input type="text" class="equip-input" id="equip_serial" value="${escapeAttr(equipData?.serial || "")}" placeholder="Ex: GH2-001234">
                <button type="button" class="btn" style="white-space:nowrap;padding:8px 14px;font-size:12px;border-radius:8px;background:#fff;color:var(--primary);border-color:var(--primary);" data-action="ip-test"><i class="fa-solid fa-wifi" style="margin-right:6px;"></i>Tentar Conexão</button>
              </div>
            </div>

            <div class="farm-form-divider col-span-2">Localização</div>

            <div class="equip-field col-span-2">
              <label class="equip-label" for="equip_latlng"><span class="equip-required">*</span>Localização (Latitude, Longitude)</label>
              <div class="equip-latlng-row">
                <input type="text" class="equip-input" id="equip_latlng" value="${escapeAttr(existingLat && existingLng ? existingLat + ', ' + existingLng : '')}" placeholder="ex: -21.836500, -46.947900">
                <button type="button" class="cadastros-map-pin-btn" id="equipPickLocationBtn" title="Clique e depois clique no mapa para capturar">
                  <i class="fa-solid fa-crosshairs"></i>
                </button>
              </div>
            </div>
            <div class="equip-field col-span-2">
              <label class="equip-label" for="equipPivoSearch">Pivôs vinculados</label>
              <input type="hidden" id="equip_pivo_ids" value="${JSON.stringify(Array.isArray(equipData?.pivoIds) ? equipData.pivoIds : (equipData?.pivoId ? [equipData.pivoId] : [])).replace(/"/g, '&quot;')}">
              <div class="pivo-talhoes-multi" id="equipPivoMulti">
                <div class="farm-report__multi-control" data-equip-pivo-control>
                  <div class="farm-report__chips" data-equip-pivo-chips>
                    ${Cad.data.getAllPivosRecords(farmId).filter(p => (Array.isArray(equipData?.pivoIds) ? equipData.pivoIds : (equipData?.pivoId ? [equipData.pivoId] : [])).includes(String(p.id))).map(p => `<span class="farm-report__chip" data-pivo-id="${p.id}" data-label="${(p.name || 'Pivô').replace(/"/g, '&quot;')}">${p.name || 'Pivô'}<button type="button">✕</button></span>`).join('')}
                  </div>
                  <input class="farm-report__search" type="text" id="equipPivoSearch" placeholder="${(Array.isArray(equipData?.pivoIds) ? equipData.pivoIds.length : (equipData?.pivoId ? 1 : 0)) ? (Array.isArray(equipData?.pivoIds) ? equipData.pivoIds.length : 1) + ' pivô(s) selecionado(s)' : 'Selecionar pivôs'}" data-equip-pivo-search readonly>
                  <span class="farm-report__chev" aria-hidden="true"><i class="fa-solid fa-chevron-down"></i></span>
                </div>
                <div class="farm-report__dropdown" data-equip-pivo-dropdown aria-hidden="true">
                  <div class="farm-report__list" data-equip-pivo-list>
                    ${Cad.data.getAllPivosRecords(farmId).map(p => `<button type="button" class="farm-report__item${(Array.isArray(equipData?.pivoIds) ? equipData.pivoIds : (equipData?.pivoId ? [equipData.pivoId] : [])).includes(String(p.id)) ? ' is-selected' : ''}" data-equip-pivo-item data-pivo-id="${p.id}">${p.name || 'Pivô'}<span class="check"><i class="fa-solid fa-check"></i></span></button>`).join('') || '<p style="padding:8px 12px;font-size:12px;color:#94a3b8;">Nenhum pivô cadastrado</p>'}
                  </div>
                </div>
              </div>
            </div>

            <div class="equip-field col-span-2">
              <label class="equip-label" for="equipTalhaoSearch">Talhões vinculados</label>
              <input type="hidden" id="equip_talhao_ids" value="${JSON.stringify(Array.isArray(equipData?.talhaoIds) ? equipData.talhaoIds : (selectedTalhaoId ? [selectedTalhaoId] : [])).replace(/"/g, '&quot;')}">
              <div class="pivo-talhoes-multi" id="equipTalhaoMulti">
                <div class="farm-report__multi-control" data-equip-talhao-control>
                  <div class="farm-report__chips" data-equip-talhao-chips>
                    ${Cad.data.getTalhoesByFarm(farmId).filter(t => (Array.isArray(equipData?.talhaoIds) ? equipData.talhaoIds : (selectedTalhaoId ? [selectedTalhaoId] : [])).includes(String(t.id))).map(t => `<span class="farm-report__chip" data-talhao-id="${t.id}" data-label="${(t.name || 'Talhão').replace(/"/g, '&quot;')}">${t.name || 'Talhão'}<button type="button">✕</button></span>`).join('')}
                  </div>
                  <input class="farm-report__search" type="text" id="equipTalhaoSearch" placeholder="${(Array.isArray(equipData?.talhaoIds) ? equipData.talhaoIds.length : (selectedTalhaoId ? 1 : 0)) ? (Array.isArray(equipData?.talhaoIds) ? equipData.talhaoIds.length : 1) + ' talhão(ões) selecionado(s)' : 'Selecionar talhões'}" data-equip-talhao-search readonly>
                  <span class="farm-report__chev" aria-hidden="true"><i class="fa-solid fa-chevron-down"></i></span>
                </div>
                <div class="farm-report__dropdown" data-equip-talhao-dropdown aria-hidden="true">
                  <div class="farm-report__list" data-equip-talhao-list>
                    ${Cad.data.getTalhoesByFarm(farmId).map(t => `<button type="button" class="farm-report__item${(Array.isArray(equipData?.talhaoIds) ? equipData.talhaoIds : (selectedTalhaoId ? [selectedTalhaoId] : [])).includes(String(t.id)) ? ' is-selected' : ''}" data-equip-talhao-item data-talhao-id="${t.id}">${t.name || 'Talhão'}<span class="check"><i class="fa-solid fa-check"></i></span></button>`).join('') || '<p style="padding:8px 12px;font-size:12px;color:#94a3b8;">Nenhum talhão cadastrado</p>'}
                  </div>
                </div>
              </div>
            </div>

            <div id="equipModulosSection" class="col-span-2" style="display:none; flex-direction:column; gap:8px; margin-top:12px;">
              <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; min-height:50px;">
                <div style="display:flex; flex-direction:column; gap:2px;">
                  <span style="font-size:13px; font-weight:700; color:var(--ink-900);">Descoberta de Módulos</span>
                  <span style="font-size:11px; color:var(--muted-600);">Adicione os módulos manualmente</span>
                </div>
                <button class="equip-btn btn equip-btn--primary" type="button" data-action="ip-mod-open" style="height:32px; padding:0 12px; font-size:13px; border-radius:8px; white-space:nowrap;">
                  <i class="fa-solid fa-plus"></i> Adicionar Módulo
                </button>
              </div>
              <div id="equipModulosList" style="display:flex; flex-direction:column; gap:6px;"></div>
            </div>

            <div id="equipTypeFieldsHost" class="col-span-2 cadastros-form-grid" style="padding:0; margin-top:0;"></div>
          </div>
        </div>
      </div>
      <div class="cadastros-form-footer cadastros-form-footer--equip">
        ${!id ? `<button type="button" class="cad-form-action-btn cad-form-action-btn--ghost" style="margin-right:auto;" onclick="window.IcEquipPickerBack()">
          <i class="fa-solid fa-arrow-left"></i> Voltar
        </button>` : ""}
        <button type="button" class="cad-form-action-btn cad-form-action-btn--ghost" onclick="window.IcCancelCurrent('equipamentos')">
          <i class="fa-solid fa-xmark"></i> Cancelar
        </button>
        <button type="button" class="cad-form-action-btn cad-form-action-btn--primary" onclick="window.IcSaveRecord('equipamentos')">
          <i class="fa-solid fa-floppy-disk"></i> Salvar
        </button>
      </div>
    </div>`;

    renderEquipTypeFieldsHost(type, equipment);
    if (type === "pluviometro") {
      container.querySelector("#equipPivoMulti")?.closest(".equip-field")?.remove();
      container.querySelector("#equipTalhaoMulti")?.closest(".equip-field")?.remove();
      container.querySelector("#equip_pivo_ids")?.remove();
      container.querySelector("#equip_talhao_ids")?.remove();
      setupPluviometroTabs(container, equipment);
    }
    if (type === "repetidora" || type === "irripump" || type === "medidor") {
      container.querySelector("#equipPivoMulti")?.closest(".equip-field")?.remove();
      container.querySelector("#equipTalhaoMulti")?.closest(".equip-field")?.remove();
      container.querySelector("#equip_pivo_ids")?.remove();
      container.querySelector("#equip_talhao_ids")?.remove();
    }

    // Show draggable pin on map at existing/current location
    if (Number.isFinite(Number(existingLat)) && Number.isFinite(Number(existingLng)) && (Number(existingLat) !== 0 || Number(existingLng) !== 0)) {
      setTimeout(() => Cad.viewMaps.syncEquipFormMarker(Number(existingLat), Number(existingLng)), 80);
    } else {
      // Novo equipamento: centraliza o mapa na fazenda ativa
      setTimeout(() => {
        const entry = Cad.viewMaps.ensureSectionMap("cadastrosEquipamentosMap");
        if (entry && state.activeView === "form") {
          const view = Cad.data.getActiveFarmView();
          entry.map.setView(view.center, view.zoom);
          entry.map.invalidateSize();
        }
      }, 300);
    }

    const typeSelect = container.querySelector("#equip_type");
    if (typeSelect) {
      typeSelect.addEventListener("change", () => {
        renderEquipTypeFieldsHost(typeSelect.value, { data: {} });
      });
    }

    const farmSelect = container.querySelector("#equip_farm");
    const talhaoSelect = container.querySelector("#equip_talhao");
    const pivoSelect = container.querySelector("#equip_pivo");
    const bindVinculos = () => {
      const farmIdVal = String(farmSelect?.value || farmId || "");
      const talhoes = Cad.data.getTalhoesByFarm(farmIdVal);
      const pivos = Cad.data.getAllPivosRecords(farmIdVal);
      if (talhaoSelect) {
        talhaoSelect.innerHTML = `<option value="">Sem vínculo</option>${talhoes.map((t) => `<option value="${escapeAttr(t.id)}">${escapeAttr(t.name || t.id)}</option>`).join("")}`;
        talhaoSelect.value = talhoes.some((t) => String(t.id) === selectedTalhaoId) ? selectedTalhaoId : "";
      }
      if (pivoSelect) {
        pivoSelect.innerHTML = `<option value="">Sem vínculo</option>${pivos.map((p) => `<option value="${escapeAttr(p.id)}">${escapeAttr(p.name || p.id)}</option>`).join("")}`;
        pivoSelect.value = pivos.some((p) => String(p.id) === selectedPivoId) ? selectedPivoId : "";
      }
    };
    bindVinculos();
    farmSelect?.addEventListener("change", bindVinculos);

    Cad.ui.initCadCustomSelects(container);

    Cad.ui.initMultiSelect({
      hostId: "#equipPivoMulti",
      chipsSelector: "[data-equip-pivo-chips]",
      searchSelector: "[data-equip-pivo-search]",
      dropdownSelector: "[data-equip-pivo-dropdown]",
      listSelector: "[data-equip-pivo-list]",
      controlSelector: "[data-equip-pivo-control]",
      itemSelector: "[data-equip-pivo-item]",
      hiddenInputId: "equip_pivo_ids",
      attrId: "data-pivo-id",
      unitLabel: "pivô"
    }, container);

    Cad.ui.initMultiSelect({
      hostId: "#equipTalhaoMulti",
      chipsSelector: "[data-equip-talhao-chips]",
      searchSelector: "[data-equip-talhao-search]",
      dropdownSelector: "[data-equip-talhao-dropdown]",
      listSelector: "[data-equip-talhao-list]",
      controlSelector: "[data-equip-talhao-control]",
      itemSelector: "[data-equip-talhao-item]",
      hiddenInputId: "equip_talhao_ids",
      attrId: "data-talhao-id",
      unitLabel: "talhão"
    }, container);

    const pickBtn = container.querySelector("#equipPickLocationBtn");
    if (pickBtn) {
      pickBtn.onclick = () => {
        state.isPickingEquipmentLocation = !state.isPickingEquipmentLocation;
        pickBtn.classList.toggle("is-active", state.isPickingEquipmentLocation);
        if (state.isPickingEquipmentLocation) {
          const view = Cad.data.getActiveFarmView();
          const entry = Cad.viewMaps.ensureSectionMap("cadastrosEquipamentosMap");
          if (view && entry?.map) {
            entry.map.setView(view.center, Math.max(entry.map.getZoom(), 15));
          }
        }
      };
    }

    // Módulos
    const modListEl = container.querySelector("#equipModulosList");
    const modOpenBtn = container.querySelector('[data-action="ip-mod-open"]');

    const modModules = Array.isArray(equipment?.modulos) ? equipment.modulos : (Array.isArray(equipData?.modulos) ? equipData.modulos : []);
    window._equipFormModules = [...modModules].map(m => {
      if (typeof m === 'string') return {
        serial: m,
        functions: {
          automacao: { active: false, type: "" },
          vazao: { active: false, type: "" },
          nivel: { active: false, type: "" },
          corrente_tensao: { active: false, type: "" }
        }
      };
      return m;
    });

    function renderModuleFunctionsHtml(modIdx) {
      const mod = window._equipFormModules[modIdx];
      const functions = [
        { key: "automacao", title: "Automação", sub: "Tipo de Automação", icon: "fa-gears", options: ["Bomba de Superfície", "Bomba Submersa"] },
        { key: "vazao", title: "Medição de Vazão", sub: "Tipo de Medição de Vazão", icon: "fa-gauge-high", options: ["Hidrômetro", "Medidor Eletrônico"] },
        { key: "nivel", title: "Medição de Nível", sub: "Tipo de Medição de Nível", icon: "fa-water", options: ["Poço", "Reservatório", "Rio"] },
        { key: "corrente_tensao", title: "Medição de Corrente e Tensão", sub: "Tipo de Medição de Corrente e Tensão", icon: "fa-bolt", options: ["Digital Soft Starter", "Digital Inversora", "Sensores Analógicos"] }
      ];

      return functions.map(f => {
        const state = mod.functions[f.key] || { active: false, type: "" };
        const isActive = state.active;
        return `
          <div class="func-row ${isActive ? 'is-active' : 'is-inactive'}" data-func="${f.key}">
            <label class="func-row__head">
              <span class="func-row__check">
                <input type="checkbox" name="func_toggle_${f.key}" data-action="func-toggle" data-key="${f.key}" ${isActive ? 'checked' : ''}>
              </span>
              <span class="func-row__ico">
                <i class="fa-solid ${f.icon}"></i>
              </span>
              <span class="func-row__text">
                <span class="func-row__title">${f.title}</span>
                <span class="func-row__sub">${f.sub}</span>
              </span>
            </label>

            <div class="func-row__body" style="${isActive ? '' : 'display:none;'}">
              <div class="func-select ${isActive ? '' : 'is-disabled'}" data-key="${f.key}">
                <button type="button" class="func-select__trigger" data-action="func-select-toggle" data-key="${f.key}" ${isActive ? '' : 'disabled'}>
                  <span class="func-select__label">${state.type || 'Selecionar tipo...'}</span>
                  <span class="func-select__chev"><i class="fa-solid fa-chevron-down"></i></span>
                </button>
                <div class="func-select__list" role="listbox">
                  ${f.options.map(opt => `<button type="button" class="func-select__option" data-action="func-select-option" data-key="${f.key}" data-value="${opt}">${opt}</button>`).join("")}
                </div>
              </div>
            </div>
          </div>
        `;
      }).join("");
    }

    function updateModuleStats(panel) {
      if (!panel) return;
      const modIdx = Number(panel.dataset.modIdx);
      const mod = window._equipFormModules[modIdx];

      let activeCount = 0;
      let configured = 0;

      Object.keys(mod.functions).forEach(k => {
        if (mod.functions[k].active) {
          activeCount++;
          if (mod.functions[k].type) configured++;
        }
      });

      panel.querySelector(".active-count").textContent = activeCount;
      panel.querySelector(".pending-count").textContent = activeCount - configured;
    }

    function renderEquipModuleList() {
      if (!modListEl) return;
      modListEl.innerHTML = window._equipFormModules.map((mod, i) => `
        <div class="mod-panel card" data-mod-idx="${i}">
          <div class="mod-panel__head">
            <div class="mod-panel__module">
              <span class="mod-panel__ico"><i class="fa-solid fa-microchip"></i></span>
              <div class="mod-panel__module-info">
                <div class="mod-panel__title"><span>Módulo</span> ${i + 1}</div>
                <div class="mod-panel__meta"><span>Serial:</span> ${mod.serial} <span>· Manual</span></div>
              </div>
              <span class="mod-panel__badge pill">MANUAL</span>
            </div>

            <button class="mod-panel__danger btn" type="button" data-mod-remove="${i}">
              <i class="fa-solid fa-trash"></i> Excluir módulo
            </button>
          </div>

          <div class="mod-panel__stats">
            <span class="mod-stat mod-stat--ok">
              <span class="mod-stat__dot"></span>
              <span class="active-count">0</span> função(ões) ativas
            </span>
            <span class="mod-stat mod-stat--warn">
              <span class="mod-stat__dot"></span>
              <span class="pending-count">0</span> pendente(s) de configuração
            </span>
          </div>

          <div class="func-list">
            ${renderModuleFunctionsHtml(i)}
          </div>
        </div>
      `).join("");

      // Atualiza stats iniciais
      modListEl.querySelectorAll(".mod-panel").forEach(p => updateModuleStats(p));

      // Bind deletion
      modListEl.querySelectorAll("[data-mod-remove]").forEach(btn => {
        btn.onclick = () => {
          window._equipFormModules.splice(Number(btn.dataset.modRemove), 1);
          renderEquipModuleList();
        };
      });

      // Bind logic for functions
      modListEl.querySelectorAll('[data-action="func-toggle"]').forEach(cb => {
        cb.onchange = () => {
          const panel = cb.closest(".mod-panel");
          const modIdx = Number(panel.dataset.modIdx);
          const key = cb.dataset.key;
          const row = cb.closest(".func-row");
          const body = row.querySelector(".func-row__body");
          const select = body.querySelector(".func-select");
          const trigger = select.querySelector(".func-select__trigger");

          window._equipFormModules[modIdx].functions[key].active = cb.checked;

          if (cb.checked) {
            row.classList.remove("is-inactive");
            row.classList.add("is-active");
            body.style.display = "";
            select.classList.remove("is-disabled");
            trigger.disabled = false;
          } else {
            row.classList.add("is-inactive");
            row.classList.remove("is-active");
            body.style.display = "none";
            select.classList.add("is-disabled");
            trigger.disabled = true;
          }
          updateModuleStats(panel);
        };
      });

      modListEl.querySelectorAll('[data-action="func-select-toggle"]').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const select = btn.closest(".func-select");
          const isOpen = select.classList.contains("is-open");
          document.querySelectorAll(".func-select.is-open").forEach(s => s.classList.remove("is-open"));
          if (!isOpen) select.classList.add("is-open");
        };
      });

      modListEl.querySelectorAll('[data-action="func-select-option"]').forEach(opt => {
        opt.onclick = (e) => {
          e.stopPropagation();
          const panel = opt.closest(".mod-panel");
          const modIdx = Number(panel.dataset.modIdx);
          const key = opt.dataset.key;
          const val = opt.dataset.value;

          window._equipFormModules[modIdx].functions[key].type = val;

          const select = opt.closest(".func-select");
          const label = select.querySelector(".func-select__label");
          label.textContent = val;
          select.classList.remove("is-open");
          updateModuleStats(panel);
        };
      });

      if (moduleFuncSelectOutsideClickHandler) {
        document.removeEventListener("click", moduleFuncSelectOutsideClickHandler);
      }

      moduleFuncSelectOutsideClickHandler = () => {
        document.querySelectorAll(".func-select.is-open").forEach(s => s.classList.remove("is-open"));
      };

      document.addEventListener("click", moduleFuncSelectOutsideClickHandler);
    }

    const modHeaderRow = container.querySelector("#equipModulosSection > div:first-child");

    function showModAddRow() {
      if (container.querySelector("#equipModAddRow")) return;
      const openBtn = modHeaderRow?.querySelector('[data-action="ip-mod-open"]');
      if (openBtn) openBtn.style.display = "none";

      const addRow = document.createElement("div");
      addRow.id = "equipModAddRow";
      addRow.style.cssText = "display:flex; flex-direction:column; gap:2px; flex:1; max-width:280px;";
      addRow.innerHTML = `
        <label class="equip-label" for="newModuleSerial" style="font-size:12px; margin-bottom:2px; font-weight:400;">Serial do módulo</label>
        <div style="display:flex; align-items:center; gap:6px;">
          <input type="text" id="newModuleSerial" class="equip-input" placeholder="Ex: GH2-001A-M01" style="flex:1; height:32px; font-size:13px; padding:0 10px;">
          <button type="button" id="modConfirmBtn" style="height:32px; min-width:32px; border-radius:6px; border:none; background:var(--primary); color:#fff; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; font-size:14px;"><i class="fa-solid fa-check"></i></button>
          <button type="button" id="modCancelBtn" style="height:32px; min-width:32px; border-radius:6px; border:1px solid #e5e7eb; background:#fff; color:#ef4444; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; font-size:14px;"><i class="fa-solid fa-xmark"></i></button>
        </div>
      `;
      modHeaderRow.appendChild(addRow);

      const input = addRow.querySelector("#newModuleSerial");
      input?.focus();

      const close = () => {
        addRow.remove();
        if (openBtn) openBtn.style.display = "flex";
      };
      addRow.querySelector("#modConfirmBtn").onclick = () => {
        const val = input.value.trim();
        if (val) {
          window._equipFormModules.push({
            serial: val,
            functions: {
              automacao: { active: false, type: "" },
              vazao: { active: false, type: "" },
              nivel: { active: false, type: "" },
              corrente_tensao: { active: false, type: "" }
            }
          });
        }
        close();
        renderEquipModuleList();
      };
      addRow.querySelector("#modCancelBtn").onclick = close;
      input?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") addRow.querySelector("#modConfirmBtn").click();
        if (e.key === "Escape") addRow.querySelector("#modCancelBtn").click();
      });
    }

    if (modOpenBtn) {
      modOpenBtn.addEventListener("click", showModAddRow);
    }
    renderEquipModuleList();
  }

  Cad.formEquipamentos = {
    renderFormEquipamentos,
    renderEquipTypePicker,
    renderEquipTypeFieldsHost,
    renderEquipTypeSpecificFields
  };

})();
