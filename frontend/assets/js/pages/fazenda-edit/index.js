(function () {
  "use strict";
  const tMsg = (text) => window.IcI18n?.t?.(text) ?? text;

  const state = { isOpen: false, saveFeedbackTimer: null, energyFaixas: null };
  const $ = (id) => document.getElementById(id);
  const TIMEZONE_LABELS = {
    "Africa/Abidjan": "África/Abidjan (GMT+00)",
    "America/Sao_Paulo": "América/São Paulo (GMT-03)",
    "America/Cuiaba": "América/Cuiabá (GMT-04)",
    "America/Manaus": "América/Manaus (GMT-04)",
    "America/Rio_Branco": "América/Rio Branco (GMT-05)",
    "UTC": "UTC (GMT+00)",
  };

  // Regras de campos por país para o Endereço Técnico (aba Contato) — mesmo
  // padrão usado no Endereço de Faturamento do overlay de Faturamento.
  const BR_STATE_OPTIONS =
    '<option value="" disabled hidden selected>Selecione o estado</option>' +
    '<option value="AC">Acre</option><option value="AL">Alagoas</option><option value="AP">Amapá</option>' +
    '<option value="AM">Amazonas</option><option value="BA">Bahia</option><option value="CE">Ceará</option>' +
    '<option value="DF">Distrito Federal</option><option value="ES">Espírito Santo</option><option value="GO">Goiás</option>' +
    '<option value="MA">Maranhão</option><option value="MT">Mato Grosso</option><option value="MS">Mato Grosso do Sul</option>' +
    '<option value="MG">Minas Gerais</option><option value="PA">Pará</option><option value="PB">Paraíba</option>' +
    '<option value="PR">Paraná</option><option value="PE">Pernambuco</option><option value="PI">Piauí</option>' +
    '<option value="RJ">Rio de Janeiro</option><option value="RN">Rio Grande do Norte</option><option value="RS">Rio Grande do Sul</option>' +
    '<option value="RO">Rondônia</option><option value="RR">Roraima</option><option value="SC">Santa Catarina</option>' +
    '<option value="SP">São Paulo</option><option value="SE">Sergipe</option><option value="TO">Tocantins</option>';

  const CONTACT_COUNTRY_RULES = {
    "Brasil": {
      postal: { label: "Código Postal", placeholder: "00000-000" },
      city: { label: "Cidade", placeholder: "Ex: Uberlândia" },
      region: { label: "Estado", type: "select" },
      address: { label: "Endereço", placeholder: "Ex: Rodovia BR-050, Km 120" },
    },
    "Estados Unidos": {
      postal: { label: "ZIP Code", placeholder: "10001" },
      city: { label: "City", placeholder: "New York" },
      region: { label: "State", placeholder: "NY", type: "text" },
      address: { label: "Street Address", placeholder: "123 Main St" },
    },
    "Alemanha": {
      postal: { label: "Postal Code", placeholder: "10115" },
      city: { label: "City", placeholder: "Berlin" },
      region: { label: "State", placeholder: "", type: "text" },
      address: { label: "Street + Number", placeholder: "Musterstrasse 12" },
    },
    "África do Sul": {
      postal: { label: "Postal Code", placeholder: "8001" },
      city: { label: "City", placeholder: "Cape Town" },
      region: { label: "Province", placeholder: "Western Cape", type: "text" },
      address: { label: "Address Line", placeholder: "123 Main Rd" },
    },
  };

  function setContactFieldRule(inputId, cfg) {
    const input = $(inputId);
    if (!input || !cfg) return;
    if ("placeholder" in cfg && input.tagName === "INPUT") input.placeholder = cfg.placeholder || "";
    const label = input.closest(".edit-panel__field")?.querySelector("label");
    if (!label) return;
    const req = label.querySelector(".edit-panel__req");
    label.textContent = "";
    if (req) {
      label.appendChild(req);
      label.appendChild(document.createTextNode(" " + cfg.label));
    } else {
      label.textContent = cfg.label;
    }
  }

  // Estado vira lista de UFs para o Brasil; texto livre para os demais países.
  function setContactRegionField(countryName, cfg) {
    const current = $("farmEditState");
    if (!current || !cfg) return;

    if (countryName === "Brasil") {
      if (current.tagName !== "SELECT") {
        const select = document.createElement("select");
        select.className = "edit-panel__input";
        select.id = "farmEditState";
        select.name = "farm_state";
        select.innerHTML = BR_STATE_OPTIONS;
        // Substitui o wrapper do farm-select (se houver) ou o próprio input.
        (current.closest(".farm-select") || current).replaceWith(select);
        // O observador de selects do painel encapsula o novo select em seguida.
      }
    } else if (current.tagName === "SELECT") {
      const input = document.createElement("input");
      input.className = "edit-panel__input";
      input.id = "farmEditState";
      input.name = "farm_state";
      input.type = "text";
      (current.closest(".farm-select") || current).replaceWith(input);
    }

    setContactFieldRule("farmEditState", cfg);
  }

  function applyContactCountryRules(countryName) {
    const rules = CONTACT_COUNTRY_RULES[countryName];
    if (!rules) return;
    setContactFieldRule("farmEditZipCode", rules.postal);
    setContactFieldRule("farmEditCity", rules.city);
    setContactRegionField(countryName, rules.region);
    setContactFieldRule("farmEditAddress", rules.address);
  }

  function parseLatLng(text) {
    if (!text) return null;
    const parts = String(text).split(",").map((v) => v.trim()).filter(Boolean);
    if (parts.length < 2) return null;
    const lat = Number(parts[0].replace(",", "."));
    const lng = Number(parts[1].replace(",", "."));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }

  function formatLatLng(lat, lng) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }

  function getFarmData() {
    const farmState = window.CreateFarm?.state;
    const farms = Array.isArray(farmState?.farms) ? farmState.farms : [];
    const globalActiveFarm = window.IcFarmGetActive?.() || window.IcFarmActive || null;
    const globalActiveIdText = String(globalActiveFarm?.id ?? "").trim();
    const activeId =
      globalActiveIdText ||
      farmState?.currentFarmId ||
      sessionStorage.getItem("ic_active_farm") ||
      sessionStorage.getItem("ic_active_farm_id");
    const activeIdText = String(activeId ?? "").trim();
    let farm = activeIdText
      ? farms.find((item) => String(item?.id ?? "").trim() === activeIdText)
      : null;
    if (!farm && globalActiveFarm?.id) {
      farm = globalActiveFarm;
    }
    if (!farm) {
      const activeSnapshot = farmState?.activeFarmSnapshot || window.IcFarmActive || null;
      if (activeSnapshot?.id) {
        const snapshotIdText = String(activeSnapshot.id).trim();
        farm = farms.find((item) => String(item?.id ?? "").trim() === snapshotIdText) || activeSnapshot;
      }
    }
    if (!farm) farm = farms[0];

    if (!farm) {
      const cadFarms = window.Cad?.data?.getAllFarms?.();
      if (Array.isArray(cadFarms) && cadFarms.length) {
        farm = activeIdText
          ? cadFarms.find((item) => String(item?.id ?? "").trim() === activeIdText)
          : null;
        if (!farm && globalActiveIdText) {
          farm = cadFarms.find((item) => String(item?.id ?? "").trim() === globalActiveIdText) || null;
        }
        if (!farm) farm = cadFarms[0];
      }
    }

    if (!farm) {
      try {
        const stored = JSON.parse(localStorage.getItem("ic_farms") || "[]");
        if (Array.isArray(stored)) {
          farm = activeIdText
            ? stored.find((item) => String(item?.id ?? "").trim() === activeIdText)
            : null;
          if (!farm) farm = stored[0];
        }
      } catch (_) {}
    }

    return farm || null;
  }

  function getAllFarmRecords() {
    const stateFarms = window.CreateFarm?.state?.farms;
    if (Array.isArray(stateFarms) && stateFarms.length) return stateFarms.slice();

    const cadFarms = window.Cad?.data?.getAllFarms?.();
    if (Array.isArray(cadFarms) && cadFarms.length) return cadFarms.slice();

    try {
      const stored = JSON.parse(localStorage.getItem("ic_farms") || "[]");
      if (Array.isArray(stored)) return stored.slice();
    } catch (_) {}

    return [];
  }

  function resolveValue(...values) {
    for (const value of values) {
      if (value !== undefined && value !== null && String(value).trim() !== "") return value;
    }
    return "";
  }

  function setFieldValue(id, value) {
    const el = $(id);
    if (!el) return;
    el.value = value ?? "";
  }

  function getFieldValue(id) {
    const el = $(id);
    return el ? String(el.value ?? "").trim() : "";
  }

  function getSelectValue(id, fallback = "") {
    const el = $(id);
    if (!el) return fallback;
    return String(el.value ?? "").trim() || fallback;
  }

  function clearSaveFeedback() {
    const feedback = $("farmEditSaveFeedback");
    if (!feedback) return;
    feedback.textContent = "";
    feedback.classList.remove("is-visible", "is-success", "is-error");
    feedback.setAttribute("aria-hidden", "true");
  }

  function setSaveFeedback(message, type = "success", duration = 2800) {
    const feedback = $("farmEditSaveFeedback");
    if (!feedback) return;
    if (state.saveFeedbackTimer) {
      clearTimeout(state.saveFeedbackTimer);
      state.saveFeedbackTimer = null;
    }
    feedback.textContent = message || "";
    feedback.classList.remove("is-success", "is-error");
    feedback.classList.add(type === "error" ? "is-error" : "is-success");
    feedback.classList.toggle("is-visible", !!message);
    feedback.setAttribute("aria-hidden", message ? "false" : "true");
    if (!message) return;
    state.saveFeedbackTimer = window.setTimeout(() => {
      clearSaveFeedback();
      state.saveFeedbackTimer = null;
    }, duration);
  }

  function notifyError(message) {
    setSaveFeedback(message, "error", 3800);
    if (window.IcNotify?.error) window.IcNotify.error(message);
    else alert(message);
  }

  function notifySuccess(message) {
    setSaveFeedback(message, "success");
    if (window.IcNotify?.success) window.IcNotify.success(message);
  }

  function updateBillingDocTypeUI(docType) {
    const safeType = docType === "cnpj" ? "cnpj" : "cpf";
    const label = $("farmDocTypeLabel");
    if (label) {
      label.innerText = safeType === "cnpj"
        ? "CNPJ (Cadastro Nacional da Pessoa Jurídica)"
        : "CPF (Cadastro de Pessoa Física)";
    }

    const field = $("billingDocTypeField");
    if (!field) return;
    field.querySelectorAll(".edit-panel__select-option").forEach((option) => {
      const text = option.textContent?.toLowerCase?.() || "";
      const isActive = safeType === "cnpj" ? text.includes("cnpj") : text.includes("cpf");
      option.classList.toggle("is-active", isActive);
    });
  }

  function applyGeneralData() {
    const farm = getFarmData();
    const createState = window.CreateFarm?.state || {};
    const farmState = createState.farmState || {};
    const billingState = createState.farmBillingState || {};

    const name = resolveValue(farm?.name, farmState.name);
    const clientName = resolveValue(farm?.clientName, billingState.legalName, farmState.clientName);
    const energyDay = resolveValue(farm?.energyBillDay, farmState.energyBillDay);
    const waterDay = resolveValue(farm?.waterBillDay, farmState.waterBillDay);
    const timezone = resolveValue(farm?.timezone, farmState.timezone);
    const centralRadio = resolveValue(farm?.centralRadio, farmState.centralRadio);

    const nameInput = $("farmEditName");
    if (nameInput) nameInput.value = name;

    const clientInput = $("farmEditClient");
    if (clientInput) clientInput.value = clientName;

    const energyInput = $("farmEditEnergyBillDay");
    if (energyInput) energyInput.value = energyDay;

    const waterInput = $("farmEditWaterBillDay");
    if (waterInput) waterInput.value = waterDay;

    const tzInput = $("farmEditTimezone");
    if (tzInput) {
      const safeTimezone = TIMEZONE_LABELS[timezone] ? timezone : "America/Sao_Paulo";
      tzInput.value = safeTimezone;
    }

    const radioInput = $("farmEditCentralRadio");
    if (radioInput) radioInput.value = centralRadio;

    const radioDisplay = $("farmEditCentralRadioDisplay");
    if (radioDisplay) {
      radioDisplay.textContent = centralRadio || "Não configurado";
    }
  }

  function initEditMap(coords) {
    const mapEl = $("farmEditMap");
    if (!mapEl || !window.L) return;

    if (state.editMap) {
      try { state.editMap.remove(); } catch (_) {}
      state.editMap = null;
    }

    const center = coords || { lat: -22.008419, lng: -46.812567 };
    const map = L.map(mapEl, { zoomControl: true }).setView([center.lat, center.lng], 16);

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, attribution: "Tiles © Esri" }
    ).addTo(map);

    L.tileLayer(
      "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, opacity: 0.85 }
    ).addTo(map);

    const greenIcon = L.divIcon({
      html: '<div style="color:#16a34a;font-size:28px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5));"><i class="fa-solid fa-location-dot"></i></div>',
      className: "",
      iconSize: [28, 28],
      iconAnchor: [14, 28]
    });
    const redIcon = L.divIcon({
      html: '<div style="color:#dc2626;font-size:28px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5));"><i class="fa-solid fa-location-dot"></i></div>',
      className: "",
      iconSize: [28, 28],
      iconAnchor: [14, 28]
    });

    const marker = L.marker([center.lat, center.lng], { icon: greenIcon }).addTo(map);
    state.editMap = map;
    state.editMarker = marker;
    state._redIcon = redIcon;

    if (state.centralCoords) {
      state.editCentralMarker = L.marker([state.centralCoords.lat, state.centralCoords.lng], { icon: redIcon }).addTo(map);
    } else {
      state.editCentralMarker = null;
    }

    map.on("click", (e) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      const coordInput = $("farmEditLatLng");
      if (coordInput) coordInput.value = formatLatLng(lat, lng);
      const farmState = window.CreateFarm?.state?.farmState;
      if (farmState) { farmState.lat = lat; farmState.lng = lng; }
    });

    setTimeout(() => map.invalidateSize(), 120);
  }

  function applyBillingData() {
    const farm = getFarmData();
    const billing = farm?.billing || {};
    const autoBilling = farm?.autoBilling ?? billing?.auto_enabled ?? false;

    const docType = billing.document_type || "cpf";
    setFieldValue("farmEditBillingDocType", docType);
    setFieldValue("farmEditBillingDocNumber", billing.document_number || "");

    const docTypeLabel = $("farmDocTypeLabel");
    if (docTypeLabel) {
      docTypeLabel.textContent = docType === "cnpj" ? "CNPJ (Cadastro Nacional da Pessoa Jurídica)" : "CPF (Cadastro de Pessoa Física)";
    }
    const docNumberInputEl = $("farmEditBillingDocNumber");
    if (docNumberInputEl) {
      docNumberInputEl.placeholder = docType === "cnpj" ? "00.000.000/0000-00" : "000.000.000-00";
    }
    $("billingDocTypeField")?.querySelectorAll(".edit-panel__select-option").forEach((btn, i) => {
      btn.classList.toggle("is-active", docType === "cnpj" ? i === 1 : i === 0);
    });
    setFieldValue("farmEditBillingName", billing.legal_name || "");
    setFieldValue("farmEditBillingPhone", billing.phone || "");
    setFieldValue("farmEditBillingEmail", billing.email || "");
    setFieldValue("farmEditBillingEmailLanguage", billing.email_language || "pt-BR");
    setFieldValue("farmEditBillingCountry", billing.country || "BR");
    setFieldValue("farmEditBillingPostal", billing.postal || "");
    setFieldValue("farmEditBillingRegion", billing.region || "");
    setFieldValue("farmEditBillingCity", billing.city || "");
    setFieldValue("farmEditBillingAddress", billing.address || "");

    const autoBillingInput = $("farmEditAutoBilling");
    if (autoBillingInput) autoBillingInput.checked = !!autoBilling;

    updateBillingDocTypeUI(billing.document_type || "cpf");

    const expandBtn = $("farmEditCobrancaExpandBtn");
    const content   = $("farmEditCobrancaContent");
    if (expandBtn && content && !expandBtn.dataset.bound) {
      expandBtn.dataset.bound = "1";
      expandBtn.addEventListener("click", () => {
        const expanded = expandBtn.getAttribute("aria-expanded") === "true";
        expandBtn.setAttribute("aria-expanded", String(!expanded));
        expandBtn.querySelector("i").style.transform = expanded ? "" : "rotate(90deg)";
        content.classList.toggle("is-hidden", expanded);
        content.setAttribute("aria-hidden", String(expanded));
      });
    }
  }

  function applyContactData() {
    const farm = getFarmData();
    const technical = farm?.technical || {};

    setFieldValue("farmEditCountry", resolveValue(technical.country) || "Brasil");
    applyContactCountryRules($("farmEditCountry")?.value || "Brasil");
    setFieldValue("farmEditZipCode", resolveValue(technical.postal));
    setFieldValue("farmEditState", resolveValue(technical.state, technical.region));
    setFieldValue("farmEditAddress", resolveValue(technical.address));
    setFieldValue("farmEditCity", resolveValue(technical.city));
    setFieldValue("farmEditContactPhone", resolveValue(technical.contact_phone, farm?.contact));

    // Estudo de Sinal (Restaurar de chave dedicada ou do objeto)
    const farmId = String(farm?.id || "");
    let signalStudy = technical.signalStudy;
    
    if (farmId) {
      try {
        const stored = localStorage.getItem(`ic_signal_study_${farmId}`);
        if (stored) signalStudy = JSON.parse(stored);
      } catch(_) {}
    }
    const signalInfo = $("farmEditSignalUploadInfo");
    const signalZone = $("farmEditSignalUploadZone");
    const signalName = $("farmEditSignalFileName");
    
    if (signalStudy && signalStudy.name) {
      if (signalName) signalName.textContent = signalStudy.name;
      if (signalInfo) signalInfo.classList.remove("is-hidden");
      if (signalZone) signalZone.classList.add("is-hidden");
      state.signalStudyData = signalStudy;
    } else {
      if (signalInfo) signalInfo.classList.add("is-hidden");
      if (signalZone) signalZone.classList.remove("is-hidden");
      state.signalStudyData = null;
    }
  }

  function applyLocationData() {
    const farm = getFarmData();
    const farmState = window.CreateFarm?.state?.farmState || {};
    const locText = resolveValue(farm?.loc, farmState.loc);
    const parsed = parseLatLng(locText);
    state.locationCoords = parsed || (Number.isFinite(farm?.lat) && Number.isFinite(farm?.lng)
      ? { lat: farm.lat, lng: farm.lng }
      : Number.isFinite(farmState.lat) && Number.isFinite(farmState.lng)
        ? { lat: farmState.lat, lng: farmState.lng }
        : null);

    // Guarda dados da central para usar ao abrir a aba
    state.centralCoords = (() => {
      const cLat = parseFloat(resolveValue(farm?.centralLat, farmState.centralLat));
      const cLng = parseFloat(resolveValue(farm?.centralLng, farmState.centralLng));
      return Number.isFinite(cLat) && Number.isFinite(cLng) ? { lat: cLat, lng: cLng } : null;
    })();
  }

  const DAY_LABELS = { seg: "Segunda", ter: "Terça", qua: "Quarta", qui: "Quinta", sex: "Sexta", sab: "Sábado", dom: "Domingo" };

  function calcDuracao(ini, fim) {
    const [h1, m1] = ini.split(":").map(Number);
    const [h2, m2] = fim.split(":").map(Number);
    let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (mins < 0) mins += 24 * 60;
    const hh = String(Math.floor(mins / 60)).padStart(2, "0");
    const mm = String(mins % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function tipoBadge(tipo) {
    const styles = {
      ponta:      "background:#fca5a5; color:#0f172a; border:none;",
      fora_ponta: "background:#bfdbfe; color:#0f172a; border:none;",
      reduzido:   "background:#bbf7d0; color:#0f172a; border:none;"
    };
    const labels = {
      ponta:      "PICO (PONTA)",
      fora_ponta: "FORA DE PICO (FORA DE PONTA)",
      reduzido:   "REDUZIDO"
    };
    const s = styles[tipo] || "background:#e5e7eb; color:#374151; border:none;";
    const l = labels[tipo] || tipo;
    return `<span style="display:inline-block; padding:3px 10px; border-radius:5px; font-size:11px; font-weight:600; ${s}">${l}</span>`;
  }

  function renderFaixaList(groups) {
    state.energyFaixas = groups && groups.length ? JSON.parse(JSON.stringify(groups)) : null;
    const target = $("farmEnergiaFaixasList");
    if (!target) return;

    if (!groups || !groups.length) {
      target.innerHTML = `<div class="cadastros-empty-state"><span class="cadastros-empty-state__icon"><i class="fa-regular fa-folder-open"></i></span><p>Não há dados</p></div>`;
      return;
    }

    target.innerHTML = groups.map((g, gi) => `
      <div data-faixa-group="${gi}" style="border:1px solid #e2e8f0; border-radius:8px; margin-bottom:12px; overflow:hidden;">
        <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:#f8fafc; border-bottom:1px solid #e2e8f0;">
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            ${g.days.map(d => `<span style="display:inline-block; padding:2px 10px; border-radius:4px; border:1px solid #e2e8f0; background:#fff; font-size:12px; color:#374151;">${DAY_LABELS[d] || d}</span>`).join("")}
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            <button type="button" data-grp-edit="${gi}" style="background:none; border:none; color:#3b82f6; cursor:pointer; font-size:14px;" title="Editar"><i class="fa-regular fa-pen-to-square"></i></button>
            <button type="button" data-grp-del="${gi}" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:14px;" title="Remover"><i class="fa-regular fa-trash-can"></i></button>
          </div>
        </div>
        <table style="width:100%; border-collapse:collapse; font-size:12px;">
          <thead>
            <tr style="background:#f1f5f9; color:#64748b;">
              <th style="padding:8px 10px; text-align:left; border-bottom:1px solid #e2e8f0;">Início</th>
              <th style="padding:8px 10px; text-align:left; border-bottom:1px solid #e2e8f0;">Fim</th>
              <th style="padding:8px 10px; text-align:left; border-bottom:1px solid #e2e8f0;">Tipo</th>
              <th style="padding:8px 10px; text-align:left; border-bottom:1px solid #e2e8f0;">Duração</th>
            </tr>
          </thead>
          <tbody>
            ${g.rows.map(r => `
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:8px 10px;">${r.ini}</td>
                <td style="padding:8px 10px;">${r.fim}</td>
                <td style="padding:8px 10px;">${tipoBadge(r.tipo)}</td>
                <td style="padding:8px 10px; color:#64748b; font-size:12px;"><span>duração de</span> ${calcDuracao(r.ini, r.fim)} <span>horas</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `).join("");

    // Bind delete logic simple for now
    target.querySelectorAll("[data-grp-del]").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.grpDel);
        groups.splice(idx, 1);
        renderFaixaList(groups);
      });
    });

    // Editar grupo → abre o modal de faixas pré-preenchido
    target.querySelectorAll("[data-grp-edit]").forEach(btn => {
      btn.addEventListener("click", () => {
        openFaixaEditModal(parseInt(btn.dataset.grpEdit, 10));
      });
    });
  }

  const FAIXA_DAYS = [["seg", "Segunda"], ["ter", "Terça"], ["qua", "Quarta"], ["qui", "Quinta"], ["sex", "Sexta"], ["sab", "Sábado"], ["dom", "Domingo"]];

  function openFaixaEditModal(groupIndex) {
    const groups = Array.isArray(state.energyFaixas) ? JSON.parse(JSON.stringify(state.energyFaixas)) : [];
    const group = groups[groupIndex];
    if (!group) return;

    // Dias já usados por outros grupos ficam desabilitados (evita sobreposição)
    const usedByOthers = new Set();
    groups.forEach((g, gi) => { if (gi !== groupIndex) (g.days || []).forEach((d) => usedByOthers.add(d)); });

    // Estado de trabalho (só efetivado no OK)
    let workDays = Array.isArray(group.days) ? group.days.slice() : [];
    let workRows = Array.isArray(group.rows) ? JSON.parse(JSON.stringify(group.rows)) : [];

    const MODAL_ID = "farmFaixaEditModal";
    document.getElementById(MODAL_ID)?.remove();

    const modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.className = "create-equip";
    modal.innerHTML = `
      <style>
        #farmFaixaEditModal .ff-select { position: relative; }
        #farmFaixaEditModal .ff-select__trigger {
          width: 100%; display: flex; align-items: center; justify-content: space-between;
          gap: 8px; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 8px;
          background: #fff; color: #0f172a; font-size: 13px; cursor: pointer; text-align: left;
        }
        #farmFaixaEditModal .ff-select__trigger:hover,
        #farmFaixaEditModal .ff-select.is-open .ff-select__trigger { border-color: #16a34a; }
        #farmFaixaEditModal .ff-select__trigger i { color: #94a3b8; font-size: 12px; transition: transform .15s; }
        #farmFaixaEditModal .ff-select.is-open .ff-select__trigger i { transform: rotate(180deg); }
        #farmFaixaEditModal .ff-select__value.is-placeholder { color: #cbd5e1; }
        #farmFaixaEditModal .ff-select__panel {
          position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 20;
          background: #fff; border: 1px solid #e5e7eb; border-radius: 8px;
          box-shadow: 0 8px 24px rgba(15,23,42,.12); padding: 4px; display: none;
        }
        #farmFaixaEditModal .ff-select.is-open .ff-select__panel { display: block; }
        #farmFaixaEditModal .ff-select__opt {
          padding: 9px 12px; border-radius: 6px; font-size: 13px; color: #334155; cursor: pointer;
        }
        #farmFaixaEditModal .ff-select__opt:hover { background: #f8fafc; color: #0f172a; }
        #farmFaixaEditModal .ff-select__opt.is-active { background: #e2ffec; color: #0f172a; font-weight: 600; }

        #farmFaixaEditModal .ff-time { position: relative; }
        #farmFaixaEditModal .ff-time__trigger {
          width: 100%; display: flex; align-items: center; justify-content: space-between;
          gap: 8px; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 8px;
          background: #fff; color: #0f172a; font-size: 13px; cursor: pointer; text-align: left;
        }
        #farmFaixaEditModal .ff-time__trigger:hover,
        #farmFaixaEditModal .ff-time.is-open .ff-time__trigger { border-color: #16a34a; }
        #farmFaixaEditModal .ff-time__trigger i { color: #94a3b8; font-size: 13px; }
        #farmFaixaEditModal .ff-time__value.is-placeholder { color: #cbd5e1; }
        #farmFaixaEditModal .ff-time__panel {
          position: absolute; top: calc(100% + 4px); left: 0; z-index: 20;
          background: #fff; border: 1px solid #e5e7eb; border-radius: 8px;
          box-shadow: 0 8px 24px rgba(15,23,42,.12); padding: 6px; display: none; gap: 4px;
        }
        #farmFaixaEditModal .ff-time.is-open .ff-time__panel { display: flex; }
        #farmFaixaEditModal .ff-time__col {
          width: 54px; max-height: 176px; overflow-y: auto;
          display: flex; flex-direction: column; gap: 2px;
        }
        #farmFaixaEditModal .ff-time__cell {
          padding: 6px 0; text-align: center; border-radius: 6px;
          font-size: 13px; color: #334155; cursor: pointer;
        }
        #farmFaixaEditModal .ff-time__cell:hover { background: #f8fafc; color: #0f172a; }
        #farmFaixaEditModal .ff-time__cell.is-active { background: #e2ffec; color: #0f172a; font-weight: 600; }
      </style>
      <div class="create-equip__backdrop" data-faixa-close></div>
      <section class="create-equip__dialog" role="dialog" aria-modal="true" aria-labelledby="farmFaixaEditTitle"
               style="width:min(900px,calc(100vw - 48px)); padding:0; display:flex; flex-direction:column; max-height:calc(100vh - 40px); background:#fff; border-radius:12px; overflow:hidden;">
        <header style="display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid #e5e7eb; flex-shrink:0;">
          <h3 id="farmFaixaEditTitle" style="font-size:20px; font-weight:700; color:#0f172a; margin:0;">Editar Faixas de Energia</h3>
          <button type="button" data-faixa-close style="background:none; border:none; font-size:18px; color:#6b7280; cursor:pointer; line-height:1;"><i class="fa-solid fa-xmark"></i></button>
        </header>

        <div style="padding:20px; flex:1; overflow-y:auto;">
          <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:14px 16px; margin-bottom:20px;">
            <p style="font-size:12px; font-weight:600; color:#374151; margin:0 0 10px;">Válido para os dias:</p>
            <div style="display:flex; flex-wrap:wrap; gap:16px;">
              ${FAIXA_DAYS.map(([v, l]) => {
                const checked = workDays.includes(v);
                const disabled = usedByOthers.has(v) && !checked;
                return `<label style="display:flex; align-items:center; gap:6px; font-size:13px; color:${disabled ? "#cbd5e1" : "#374151"}; cursor:${disabled ? "not-allowed" : "pointer"};">
                  <input type="checkbox" class="faixa-day-cb" value="${v}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}
                    style="width:15px; height:15px; accent-color:#16a34a; cursor:${disabled ? "not-allowed" : "pointer"};">${l}
                </label>`;
              }).join("")}
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:20px;">
            <div>
              <div style="font-size:12px; font-weight:500; color:#374151; display:block; margin-bottom:6px;">Horário inicial</div>
              <div class="ff-time" id="farmFaixaIniWrap">
                <button type="button" class="ff-time__trigger" id="farmFaixaIniTrigger">
                  <span class="ff-time__value">00:00</span>
                  <i class="fa-regular fa-clock"></i>
                </button>
                <div class="ff-time__panel">
                  <div class="ff-time__col" data-col="h"></div>
                  <div class="ff-time__col" data-col="m"></div>
                </div>
                <input type="hidden" id="farmFaixaIni" value="00:00">
              </div>
            </div>
            <div>
              <div style="font-size:12px; font-weight:500; color:#374151; display:block; margin-bottom:6px;">Horário final</div>
              <div class="ff-time" id="farmFaixaFimWrap">
                <button type="button" class="ff-time__trigger" id="farmFaixaFimTrigger">
                  <span class="ff-time__value is-placeholder">--:--</span>
                  <i class="fa-regular fa-clock"></i>
                </button>
                <div class="ff-time__panel">
                  <div class="ff-time__col" data-col="h"></div>
                  <div class="ff-time__col" data-col="m"></div>
                </div>
                <input type="hidden" id="farmFaixaFim" value="">
              </div>
            </div>
            <div>
              <div style="font-size:12px; font-weight:500; color:#374151; display:block; margin-bottom:6px;">Tipo</div>
              <div class="ff-select" id="farmFaixaTipoWrap">
                <button type="button" class="ff-select__trigger" id="farmFaixaTipoTrigger">
                  <span class="ff-select__value is-placeholder">Por favor selecione</span>
                  <i class="fa-solid fa-chevron-down"></i>
                </button>
                <div class="ff-select__panel">
                  <div class="ff-select__opt" data-value="ponta">Pico (Ponta)</div>
                  <div class="ff-select__opt" data-value="fora_ponta">Fora de pico (Fora de ponta)</div>
                  <div class="ff-select__opt" data-value="reduzido">Reduzido</div>
                </div>
                <input type="hidden" id="farmFaixaTipo" value="">
              </div>
            </div>
          </div>

          <button type="button" id="farmFaixaAddRow" style="width:100%; display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:9px 16px; border-radius:8px; border:1px solid #16a34a; background:#fff; color:#16a34a; font-size:13px; font-weight:500; cursor:pointer; margin-bottom:20px;">
            <i class="fa-solid fa-circle-plus"></i> Add
          </button>

          <div id="farmFaixaWarn" style="display:none; margin-bottom:16px; padding:10px 14px; background:#fefce8; border:1px solid #fde68a; border-radius:8px; font-size:12px; color:#92400e; line-height:1.4;">
            É necessário preencher o horário inicial, final e o tipo para adicionar uma faixa.
          </div>

          <div id="farmFaixaRows"></div>
        </div>

        <footer style="display:flex; justify-content:flex-end; gap:10px; padding:14px 20px; border-top:1px solid #e5e7eb; flex-shrink:0;">
          <button type="button" data-faixa-close style="padding:8px 20px; border-radius:8px; font-size:13px; font-weight:500; border:1px solid #cbd5e1; background:#fff; color:#475569; cursor:pointer;">Cancelar</button>
          <button type="button" id="farmFaixaOk" style="padding:8px 24px; border-radius:8px; font-size:13px; font-weight:500; border:none; background:#16a34a; color:#fff; cursor:pointer;">OK</button>
        </footer>
      </section>`;
    document.body.appendChild(modal);

    const rowsEl = modal.querySelector("#farmFaixaRows");
    const okBtn = modal.querySelector("#farmFaixaOk");
    const warn = modal.querySelector("#farmFaixaWarn");

    function updateOk() {
      const hasRows = workRows.length > 0;
      okBtn.disabled = !hasRows;
      okBtn.style.opacity = hasRows ? "1" : "0.4";
      okBtn.style.cursor = hasRows ? "pointer" : "not-allowed";
    }

    function renderRows() {
      if (!workRows.length) {
        rowsEl.innerHTML = `<div style="display:flex; flex-direction:column; align-items:center; gap:8px; padding:24px 0; color:#9ca3af;"><i class="fa-regular fa-folder-open" style="font-size:32px;"></i><span style="font-size:13px;">Não há dados</span></div>`;
        updateOk();
        return;
      }
      rowsEl.innerHTML = workRows.map((r, i) => `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:14px 4px; border-bottom:1px solid #f1f5f9;">
          <div>
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-size:14px; font-weight:600; color:#0f172a;">${r.ini} - ${r.fim}</span>
              ${tipoBadge(r.tipo)}
            </div>
            <div style="font-size:13px; color:#9ca3af; margin-top:4px;"><span>Duração de</span> ${calcDuracao(r.ini, r.fim)} <span>horas</span></div>
          </div>
          <button type="button" data-del-row="${i}" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:14px;" title="Remover"><i class="fa-regular fa-trash-can"></i></button>
        </div>`).join("");
      rowsEl.querySelectorAll("[data-del-row]").forEach((b) => {
        b.addEventListener("click", () => { workRows.splice(Number(b.dataset.delRow), 1); renderRows(); });
      });
      updateOk();
    }

    // Dropdown customizado do Tipo (verde, sem depender do estilo nativo)
    const tipoWrap = modal.querySelector("#farmFaixaTipoWrap");
    const tipoTrigger = modal.querySelector("#farmFaixaTipoTrigger");
    const tipoValueEl = tipoTrigger.querySelector(".ff-select__value");
    const tipoHidden = modal.querySelector("#farmFaixaTipo");
    const TIPO_LABELS = { ponta: "Pico (Ponta)", fora_ponta: "Fora de pico (Fora de ponta)", reduzido: "Reduzido" };

    const closeAllPopovers = (except) => {
      modal.querySelectorAll(".ff-select, .ff-time").forEach((w) => { if (w !== except) w.classList.remove("is-open"); });
    };

    tipoTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const opening = !tipoWrap.classList.contains("is-open");
      closeAllPopovers(tipoWrap);
      tipoWrap.classList.toggle("is-open", opening);
    });
    modal.querySelectorAll(".ff-select__opt").forEach((opt) => {
      opt.addEventListener("click", () => {
        const v = opt.dataset.value;
        tipoHidden.value = v;
        tipoValueEl.textContent = TIPO_LABELS[v] || v;
        tipoValueEl.classList.remove("is-placeholder");
        modal.querySelectorAll(".ff-select__opt").forEach((o) => o.classList.toggle("is-active", o === opt));
        tipoWrap.classList.remove("is-open");
      });
    });

    // Seletores de hora customizados (duas colunas HH/MM, seleção verde)
    const pad2 = (n) => String(n).padStart(2, "0");
    function setupTimePicker(wrapId, triggerId, hiddenId) {
      const wrap = modal.querySelector(`#${wrapId}`);
      const trigger = modal.querySelector(`#${triggerId}`);
      const valueEl = trigger.querySelector(".ff-time__value");
      const hidden = modal.querySelector(`#${hiddenId}`);
      const colH = wrap.querySelector('[data-col="h"]');
      const colM = wrap.querySelector('[data-col="m"]');

      for (let h = 0; h < 24; h++) {
        const c = document.createElement("div");
        c.className = "ff-time__cell"; c.dataset.h = pad2(h); c.textContent = pad2(h);
        colH.appendChild(c);
      }
      for (let m = 0; m < 60; m++) {
        const c = document.createElement("div");
        c.className = "ff-time__cell"; c.dataset.m = pad2(m); c.textContent = pad2(m);
        colM.appendChild(c);
      }

      const current = () => {
        const v = hidden.value;
        return v && v.includes(":") ? { h: v.split(":")[0], m: v.split(":")[1] } : { h: "", m: "" };
      };
      const highlight = () => {
        const { h, m } = current();
        colH.querySelectorAll(".ff-time__cell").forEach((c) => c.classList.toggle("is-active", c.dataset.h === h));
        colM.querySelectorAll(".ff-time__cell").forEach((c) => c.classList.toggle("is-active", c.dataset.m === m));
      };
      const setValue = (h, m) => {
        hidden.value = `${h}:${m}`;
        valueEl.textContent = `${h}:${m}`;
        valueEl.classList.remove("is-placeholder");
        highlight();
      };
      colH.querySelectorAll(".ff-time__cell").forEach((c) => c.addEventListener("click", () => setValue(c.dataset.h, current().m || "00")));
      colM.querySelectorAll(".ff-time__cell").forEach((c) => c.addEventListener("click", () => setValue(current().h || "00", c.dataset.m)));

      trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        const opening = !wrap.classList.contains("is-open");
        closeAllPopovers(wrap);
        wrap.classList.toggle("is-open", opening);
        if (opening) {
          highlight();
          wrap.querySelectorAll(".ff-time__cell.is-active").forEach((c) => c.scrollIntoView({ block: "center" }));
        }
      });
    }
    setupTimePicker("farmFaixaIniWrap", "farmFaixaIniTrigger", "farmFaixaIni");
    setupTimePicker("farmFaixaFimWrap", "farmFaixaFimTrigger", "farmFaixaFim");

    modal.addEventListener("click", (e) => {
      modal.querySelectorAll(".ff-select, .ff-time").forEach((w) => { if (!w.contains(e.target)) w.classList.remove("is-open"); });
    });

    function resetTipo() {
      tipoHidden.value = "";
      tipoValueEl.textContent = "Por favor selecione";
      tipoValueEl.classList.add("is-placeholder");
      modal.querySelectorAll(".ff-select__opt").forEach((o) => o.classList.remove("is-active"));
    }

    modal.querySelector("#farmFaixaAddRow").addEventListener("click", () => {
      const ini = modal.querySelector("#farmFaixaIni").value;
      const fim = modal.querySelector("#farmFaixaFim").value;
      const tipo = tipoHidden.value;
      if (!ini || !fim || !tipo) { warn.style.display = "block"; return; }
      warn.style.display = "none";
      workRows.push({ ini, fim, tipo });
      renderRows();
      resetTipo();
    });

    function closeModal() {
      modal.classList.remove("is-open");
      modal.style.display = "none";
      modal.remove();
    }

    okBtn.addEventListener("click", () => {
      workDays = Array.from(modal.querySelectorAll(".faixa-day-cb:checked")).map((cb) => cb.value);
      if (!workDays.length || !workRows.length) { warn.style.display = "block"; return; }
      groups[groupIndex] = { days: workDays, rows: workRows };
      renderFaixaList(groups);
      closeModal();
    });

    modal.querySelectorAll("[data-faixa-close]").forEach((el) => el.addEventListener("click", closeModal));

    renderRows();
    modal.classList.add("is-open");
    modal.style.display = "flex";
  }

  const PRESETS = {
    ponta_17_20: [
      { days: ["seg","ter","qua","qui","sex"], rows: [
        { ini:"00:00", fim:"06:00", tipo:"reduzido" },
        { ini:"06:00", fim:"17:00", tipo:"fora_ponta" },
        { ini:"17:00", fim:"20:00", tipo:"ponta" },
        { ini:"20:00", fim:"21:30", tipo:"fora_ponta" },
        { ini:"21:30", fim:"23:59", tipo:"reduzido" }
      ]},
      { days: ["sab","dom"], rows: [
        { ini:"00:00", fim:"06:00", tipo:"reduzido" },
        { ini:"06:00", fim:"21:30", tipo:"fora_ponta" },
        { ini:"21:30", fim:"23:59", tipo:"reduzido" }
      ]}
    ],
    ponta_18_21: [
      { days: ["seg","ter","qua","qui","sex"], rows: [
        { ini:"00:00", fim:"06:00", tipo:"reduzido" },
        { ini:"06:00", fim:"18:00", tipo:"fora_ponta" },
        { ini:"18:00", fim:"21:00", tipo:"ponta" },
        { ini:"21:00", fim:"21:30", tipo:"fora_ponta" },
        { ini:"21:30", fim:"23:59", tipo:"reduzido" }
      ]},
      { days: ["sab","dom"], rows: [
        { ini:"00:00", fim:"06:00", tipo:"reduzido" },
        { ini:"06:00", fim:"21:30", tipo:"fora_ponta" },
        { ini:"21:30", fim:"23:59", tipo:"reduzido" }
      ]}
    ]
  };

  window.IcOpenEnergyPresetModal = function () {
    const MODAL_ID = "farmEnergiaFaixaPresetModal";
    let modal = document.getElementById(MODAL_ID);

    if (!modal) {
      modal = document.createElement("div");
      modal.id = MODAL_ID;
      modal.className = "create-equip";
      modal.innerHTML = `
        <div class="create-equip__backdrop" data-preset-close></div>
        <section class="create-equip__dialog" role="dialog" aria-modal="true" style="width:min(760px,calc(100vw - 48px)); padding:0; display:flex; flex-direction:column; max-height:calc(100vh - 40px); background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);">

          <header style="display:flex; align-items:center; justify-content:space-between; padding:24px 32px 16px; flex-shrink:0;">
            <h2 style="font-size:28px; font-weight:700; color:#1e293b; margin:0; letter-spacing:-0.02em;">Adicionar Faixas de Energia</h2>
            <button type="button" data-preset-close style="background:none; border:none; font-size:24px; color:#cbd5e1; cursor:pointer; line-height:1; transition:color .2s;" onmouseover="this.style.color='#94a3b8'" onmouseout="this.style.color='#cbd5e1'">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </header>

          <div style="padding:0 32px 32px; flex:1; overflow-y:auto;">
            <div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:10px; padding:16px 20px; margin-bottom:24px; font-size:14px; color:#0369a1; line-height:1.5;">
              Faixas de energia são períodos específicos durante o dia nos quais o custo da energia elétrica pode variar. Você pode personalizar as faixas da sua fazenda no menu de configurações.
            </div>
            
            <p style="font-size:15px; color:#334155; margin:0 0 20px; font-weight:500;">Selecione o padrão que melhor te atende baseado nas faixas de energia por horário da sua região</p>
            
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:16px;">
              
                <button type="button" data-preset-card="ponta_17_20" style="position:relative; text-align:left; padding:20px; border-radius:10px; border:1.5px solid #e2e8f0; background:#fff; cursor:pointer; transition:all .2s; min-height:140px; overflow:hidden;">
                  <div style="font-size:15px; font-weight:700; color:#1e293b; margin-bottom:8px;">Ponta entre 17:00 e 20:00</div>
                  <div style="font-size:13px; color:#64748b; line-height:1.5;">Define horário de ponta entre 17:00 e 20:00 durante dias úteis.</div>
                  <div class="preset-corner" style="display:none; position:absolute; top:0; right:0; width:0; height:0; border-style:solid; border-width:0 32px 32px 0; border-color:transparent #16a34a transparent transparent;">
                    <i class="fa-solid fa-check" style="position:absolute; top:4px; right:-27px; color:#fff; font-size:9px;"></i>
                  </div>
                </button>

                <button type="button" data-preset-card="ponta_18_21" style="position:relative; text-align:left; padding:20px; border-radius:10px; border:1.5px solid #e2e8f0; background:#fff; cursor:pointer; transition:all .2s; min-height:140px; overflow:hidden;">
                  <div style="font-size:15px; font-weight:700; color:#1e293b; margin-bottom:8px;">Ponta entre 18:00 e 21:00</div>
                  <div style="font-size:13px; color:#64748b; line-height:1.5;">Define horário de ponta entre 18:00 e 21:00 durante dias úteis.</div>
                  <div class="preset-corner" style="display:none; position:absolute; top:0; right:0; width:0; height:0; border-style:solid; border-width:0 32px 32px 0; border-color:transparent #16a34a transparent transparent;">
                    <i class="fa-solid fa-check" style="position:absolute; top:4px; right:-27px; color:#fff; font-size:9px;"></i>
                  </div>
                </button>

                <button type="button" data-preset-card="custom" style="position:relative; text-align:left; padding:20px; border-radius:10px; border:1.5px solid #e2e8f0; background:#fff; cursor:pointer; transition:all .2s; min-height:140px; overflow:hidden;">
                  <div style="font-size:15px; font-weight:700; color:#1e293b; margin-bottom:8px;">Personalizado</div>
                  <div style="font-size:13px; color:#64748b; line-height:1.5;">Personalize mais tarde no menu de configurações da sua fazenda.</div>
                  <div class="preset-corner" style="display:none; position:absolute; top:0; right:0; width:0; height:0; border-style:solid; border-width:0 32px 32px 0; border-color:transparent #16a34a transparent transparent;">
                    <i class="fa-solid fa-check" style="position:absolute; top:4px; right:-27px; color:#fff; font-size:9px;"></i>
                  </div>
                </button>
            </div>
          </div>

          <footer style="display:flex; justify-content:flex-end; gap:12px; padding:20px 32px; background:#fff; flex-shrink:0;">
            <button type="button" data-preset-close style="padding:10px 24px; border-radius:8px; font-size:14px; font-weight:600; border:1px solid #e2e8f0; background:#fff; color:#64748b; cursor:pointer; transition:all .2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#fff'">
              Cancelar
            </button>
            <button type="button" id="preset_modal_ok" style="padding:10px 32px; border-radius:8px; font-size:14px; font-weight:600; background:#00bd71; color:#fff; border:none; cursor:not-allowed; opacity:0.4; transition:all .2s;" disabled>
              OK
            </button>
          </footer>
        </section>`;
      document.body.appendChild(modal);

      let selectedPresetKey = null;

      modal.querySelectorAll("[data-preset-card]").forEach(card => {
        card.addEventListener("click", () => {
          modal.querySelectorAll("[data-preset-card]").forEach(c => {
            c.style.borderColor = "#e2e8f0";
            c.style.background = "#fff";
            c.querySelector(".preset-corner").style.display = "none";
          });
          
          card.style.borderColor = "#16a34a";
          card.style.background = "#f0fdf4";
          card.querySelector(".preset-corner").style.display = "block";
          
          selectedPresetKey = card.dataset.presetCard;
          const ok = modal.querySelector("#preset_modal_ok");
          ok.disabled = false;
          ok.style.opacity = "1";
          ok.style.cursor = "pointer";
        });
      });

      modal.querySelector("#preset_modal_ok").addEventListener("click", () => {
        if (!selectedPresetKey) return;
        
        if (selectedPresetKey !== "custom") {
          const data = PRESETS[selectedPresetKey];
          if (data) renderFaixaList(JSON.parse(JSON.stringify(data)));
        }
        
        closePreset();
      });

      modal.querySelectorAll("[data-preset-close]").forEach(el => el.addEventListener("click", closePreset));
    }

    function closePreset() {
      const m = document.getElementById(MODAL_ID);
      if (m) {
        m.classList.remove("is-open");
        m.style.display = "none";
      }
    }

    modal.classList.add("is-open");
    modal.style.display = "flex";
  };

  function ensureLocationMapReady() {
    const coords = state.locationCoords;

    const coordInput = $("farmEditLatLng");
    if (coordInput && coords) coordInput.value = formatLatLng(coords.lat, coords.lng);

    const cCoordInput = $("farmEditCentralLatLng");
    if (cCoordInput && state.centralCoords) cCoordInput.value = formatLatLng(state.centralCoords.lat, state.centralCoords.lng);

    initEditMap(coords);

    const pickBtn = $("farmEditPickLocationBtn");
    if (pickBtn && !pickBtn.dataset.bound) {
      pickBtn.dataset.bound = "1";
      pickBtn.addEventListener("click", () => {
        if (!state.editMap || !state.editMarker) return;
        const c = state.editMap.getCenter();
        state.editMarker.setLatLng(c);
        if (coordInput) coordInput.value = formatLatLng(c.lat, c.lng);
        const fs = window.CreateFarm?.state?.farmState;
        if (fs) { fs.lat = c.lat; fs.lng = c.lng; }
      });
    }

    const centralBtn = $("farmEditPickCentralBtn");
    if (centralBtn && !centralBtn.dataset.bound) {
      centralBtn.dataset.bound = "1";
      centralBtn.addEventListener("click", () => {
        if (!state.editMap) return;
        const c = state.editMap.getCenter();
        if (cCoordInput) cCoordInput.value = formatLatLng(c.lat, c.lng);
        if (state.editCentralMarker) {
          state.editCentralMarker.setLatLng(c);
        } else {
          state.editCentralMarker = L.marker([c.lat, c.lng], { icon: state._redIcon }).addTo(state.editMap);
        }
      });
    }
  }

  function syncFarmEditState(nextFarm) {
    const createFarm = window.CreateFarm || {};
    const createState = createFarm.state || {};
    const setters = createFarm.setters || {};
    const nextFarms = getAllFarmRecords();
    const farmIndex = nextFarms.findIndex((item) => String(item?.id) === String(nextFarm?.id));

    if (farmIndex >= 0) nextFarms[farmIndex] = nextFarm;
    else nextFarms.push(nextFarm);

    if (typeof setters.setFarms === "function") setters.setFarms(nextFarms);
    else createState.farms = nextFarms;

    if (typeof setters.setCurrentFarmId === "function") setters.setCurrentFarmId(nextFarm.id);
    else createState.currentFarmId = nextFarm.id;

    if (typeof setters.setActiveFarmSnapshot === "function") setters.setActiveFarmSnapshot(nextFarm);
    else window.IcFarmActive = { id: nextFarm.id, name: nextFarm.name, lat: nextFarm.lat, lng: nextFarm.lng };

    try {
      sessionStorage.setItem("ic_active_farm", String(nextFarm.id));
      sessionStorage.setItem("ic_active_farm_id", String(nextFarm.id));
    } catch (_) {}

    createState.farmState = createState.farmState || {};
    createState.farmBillingState = createState.farmBillingState || {};

    createState.farmState.name = nextFarm.name || "";
    createState.farmState.clientName = nextFarm.clientName || "";
    createState.farmState.timezone = nextFarm.timezone || "America/Sao_Paulo";
    createState.farmState.centralRadio = nextFarm.centralRadio || "";
    createState.farmState.loc = nextFarm.loc || "";
    createState.farmState.lat = Number.isFinite(nextFarm.lat) ? nextFarm.lat : createState.farmState.lat;
    createState.farmState.lng = Number.isFinite(nextFarm.lng) ? nextFarm.lng : createState.farmState.lng;
    createState.farmState.centralLat = Number.isFinite(nextFarm.centralLat) ? nextFarm.centralLat : createState.farmState.centralLat;
    createState.farmState.centralLng = Number.isFinite(nextFarm.centralLng) ? nextFarm.centralLng : createState.farmState.centralLng;

    createState.farmBillingState.country = nextFarm.billing?.country || "";
    createState.farmBillingState.postal = nextFarm.billing?.postal || "";
    createState.farmBillingState.city = nextFarm.billing?.city || "";
    createState.farmBillingState.address = nextFarm.billing?.address || "";
    createState.farmBillingState.region = nextFarm.billing?.region || "";
    createState.farmBillingState.legalName = nextFarm.billing?.legal_name || "";
    createState.farmBillingState.docType = nextFarm.billing?.document_type || "";
    createState.farmBillingState.docNumber = nextFarm.billing?.document_number || "";
    createState.farmBillingState.phone = nextFarm.billing?.phone || "";
    createState.farmBillingState.email = nextFarm.billing?.email || "";

    // Sincroniza dados técnicos (incluindo estudo de sinal)
    createState.farmTechnicalState = nextFarm.technical || {};

    return nextFarms;
  }

  function collectFarmPayload(existingFarm) {
    const currentFarm = existingFarm || getFarmData();
    if (!currentFarm?.id) return null;

    const nameInput = $("farmEditName");
    let name = getFieldValue("farmEditName");
    if (!name) {
      const fallbackName = resolveValue(
        currentFarm?.name,
        window.IcFarmGetActive?.()?.name,
        window.IcFarmActive?.name,
        window.CreateFarm?.state?.farmState?.name
      );
      if (fallbackName) {
        name = fallbackName;
        if (nameInput) nameInput.value = fallbackName;
      }
    }
    if (!name) {
      notifyError("O nome da fazenda é obrigatório.");
      return null;
    }

    const locationInput = getFieldValue("farmEditLatLng");
    const parsedLocation = parseLatLng(locationInput);
    const lat = parsedLocation?.lat ?? Number(currentFarm.lat);
    const lng = parsedLocation?.lng ?? Number(currentFarm.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      notifyError("Informe uma localização válida para a fazenda.");
      return null;
    }

    const centralInput = getFieldValue("farmEditCentralLatLng");
    const parsedCentral = parseLatLng(centralInput);
    const existingCentralLat = Number(currentFarm.centralLat);
    const existingCentralLng = Number(currentFarm.centralLng);
    const nextCentralLat = parsedCentral?.lat ?? (Number.isFinite(existingCentralLat) ? existingCentralLat : null);
    const nextCentralLng = parsedCentral?.lng ?? (Number.isFinite(existingCentralLng) ? existingCentralLng : null);

    const billingLegalName = getFieldValue("farmEditBillingName");
    const clientName = getFieldValue("farmEditClient") || billingLegalName || currentFarm.clientName || "";
    const centralRadio = getFieldValue("farmEditCentralRadio") || currentFarm.centralRadio || "";
    const technicalPhone = getFieldValue("farmEditContactPhone") || currentFarm?.technical?.contact_phone || currentFarm?.contact || "";

    const billing = {
      ...(currentFarm.billing || {}),
      legal_name: billingLegalName,
      document_type: getSelectValue("farmEditBillingDocType", currentFarm?.billing?.document_type || "cpf"),
      document_number: getFieldValue("farmEditBillingDocNumber") || currentFarm?.billing?.document_number || "",
      email: getFieldValue("farmEditBillingEmail") || currentFarm?.billing?.email || "",
      email_language: getSelectValue("farmEditBillingEmailLanguage", currentFarm?.billing?.email_language || "pt-BR"),
      phone: getFieldValue("farmEditBillingPhone") || currentFarm?.billing?.phone || "",
      country: getSelectValue("farmEditBillingCountry", currentFarm?.billing?.country || ""),
      postal: getFieldValue("farmEditBillingPostal") || currentFarm?.billing?.postal || "",
      city: getFieldValue("farmEditBillingCity") || currentFarm?.billing?.city || "",
      region: getFieldValue("farmEditBillingRegion") || currentFarm?.billing?.region || "",
      address: getFieldValue("farmEditBillingAddress") || currentFarm?.billing?.address || "",
      auto_enabled: !!$("farmEditAutoBilling")?.checked,
    };

    const technical = {
      ...(currentFarm.technical || {}),
      country: getFieldValue("farmEditCountry") || currentFarm?.technical?.country || "",
      postal: getFieldValue("farmEditZipCode") || currentFarm?.technical?.postal || "",
      state: getFieldValue("farmEditState") || currentFarm?.technical?.state || currentFarm?.technical?.region || "",
      address: getFieldValue("farmEditAddress") || currentFarm?.technical?.address || "",
      city: getFieldValue("farmEditCity") || currentFarm?.technical?.city || "",
      contact_phone: technicalPhone,
      signalStudy: state.signalStudyData || null
    };
    return {
      ...currentFarm,
      name,
      clientName,
      contact: technicalPhone || billing.phone || currentFarm.contact || "",
      timezone: getSelectValue("farmEditTimezone", currentFarm.timezone || "America/Sao_Paulo"),
      centralRadio,
      hasCentral: Boolean(centralRadio || (nextCentralLat != null && nextCentralLng != null) || currentFarm.hasCentral),
      lat,
      lng,
      loc: locationInput || formatLatLng(lat, lng),
      centralLat: nextCentralLat,
      centralLng: nextCentralLng,
      autoBilling: !!$("farmEditAutoBilling")?.checked,
      billing,
      technical,
      energyFaixas: state.energyFaixas || currentFarm.energyFaixas || null,
    };
  }

  async function handleSaveFarm(button) {
    if (!button || button.dataset.saving === "1") return;

    const currentFarm = getFarmData();
    if (!currentFarm?.id) {
      notifyError("Nenhuma fazenda ativa encontrada para salvar.");
      return;
    }

    const payload = collectFarmPayload(currentFarm);
    if (!payload) return;

    const originalHtml = button.innerHTML;
    button.dataset.saving = "1";
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando';

    try {
      const nextFarms = syncFarmEditState(payload);

      if (typeof window.Cad?.data?.persistFarmDataset === "function") {
        await window.Cad.data.persistFarmDataset(nextFarms);
      } else if (typeof window.CreateFarm?.events?.saveFarms === "function") {
        await window.CreateFarm.events.saveFarms();
      } else {
        localStorage.setItem("ic_farms", JSON.stringify(nextFarms));
      }

      // Persistência adicional para Estudo de Sinal (Chave dedicada)
      if (state.signalStudyData) {
        localStorage.setItem(`ic_signal_study_${payload.id}`, JSON.stringify(state.signalStudyData));
      } else {
        localStorage.removeItem(`ic_signal_study_${payload.id}`);
      }

      saveEnergyFaixas();
      window.CreateFarm?.events?.selectFarm?.(payload.id);
      window.IcFarmsRenderEquipment?.();
      window.IcMapRenderPivots?.(payload);
      window.IcWeatherCardRefresh?.();
      window.dispatchEvent(new CustomEvent("ic:farm-changed", { detail: { farm: payload } }));
      window.dispatchEvent(new Event("ic:layout-change"));

      button.innerHTML = '<i class="fa-solid fa-check"></i> Salvo';
      notifySuccess("Alterações salvas com sucesso.");
    } catch (error) {
      console.error("[FarmEdit] Falha ao salvar fazenda.", error);
      button.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar';
      notifyError("Não foi possível salvar a fazenda.");
      return;
    } finally {
      button.disabled = false;
      delete button.dataset.saving;
      setTimeout(() => {
        if (document.body.contains(button)) button.innerHTML = originalHtml;
      }, 1200);
    }
  }

  async function mountEditPanel() {
    const slot = $("pageSlot");
    if (!slot) return;

    const html = await fetch("./pages/fazenda-edit.html").then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); });
    slot.innerHTML = html;
    bindEditUI();
  }

  function bindWheelToContentScroll() {
    const panel = $("farmEditPanel");
    const content = panel?.querySelector(".edit-panel__content");
    if (!panel || !content || panel.dataset.wheelBound) return;

    panel.dataset.wheelBound = "1";
    panel.addEventListener("wheel", (event) => {
      if (window.matchMedia("(max-width: 980px)").matches) return;
      if (content.contains(event.target)) return;
      if (event.target.closest(".leaflet-control")) return;
      if (event.target.closest(".edit-panel__select-menu")) return;
      if (content.scrollHeight <= content.clientHeight) return;

      event.preventDefault();
      content.scrollTop += event.deltaY;
    }, { passive: false });
  }

  function getSaveButton() {
    return $("farmEditSaveBtn") || document.querySelector("#farmEditPanel .edit-panel__save");
  }

  function saveCurrentFarm() {
    const saveBtn = getSaveButton();
    if (!saveBtn) return;
    handleSaveFarm(saveBtn);
  }

  function bindEditUI() {
    const panel = $("farmEditPanel");
    if (!panel) return;

    const back = $("farmEditBack");
    if (back && !back.dataset.bound) {
      back.dataset.bound = "1";
      back.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (window.IcNavigate) {
          window.IcNavigate("visao-geral");
        } else {
          document.querySelector('.nav__item[data-route="visao-geral"]')?.click();
        }
      });
    }

    document.querySelectorAll("#farmEditPanel .edit-panel__nav-item").forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", () => {
        // Atualiza nav ativo
        document.querySelectorAll("#farmEditPanel .edit-panel__nav-item").forEach((item) => {
          item.classList.toggle("is-active", item === btn);
        });

        const target = btn.getAttribute("data-target");
        if (!target) return;

        // Atualiza seção ativa
        document.querySelectorAll("#farmEditPanel .edit-panel__section").forEach((s) => {
          s.classList.remove("is-active");
        });
        const section = document.querySelector(target);
        if (section) section.classList.add("is-active");

        // Inicializa mapa ao entrar em Localização
        if (target === "#farmEditLocation") {
          if (!state.editMap) {
            ensureLocationMapReady();
          } else {
            setTimeout(() => state.editMap.invalidateSize(), 80);
          }
        }
      });
    });

    // Dropdown customizado (reaproveita o componente já usado em "Criar Fazenda")
    // em todos os selects nativos do painel, evitando o hover azul do navegador.
    const farmSelectEvents = window.CreateFarm?.events;
    if (farmSelectEvents?.enhanceFarmSelect) {
      farmSelectEvents.bindFarmSelectGlobalEvents?.();
      panel.querySelectorAll("select.edit-panel__input").forEach((select) => {
        if (!select._farmSelect) farmSelectEvents.enhanceFarmSelect(select, panel);
      });
    }


    // Botão Salvar (Busca mais direta)
    const saveBtn = getSaveButton();
    if (saveBtn) {
      saveBtn.onclick = () => {
        handleSaveFarm(saveBtn);
      };
    }

    // Máscara de CPF/CNPJ conforme o usuário digita (respeita o tipo selecionado, não a quantidade de dígitos).
    const docNumberInput = $("farmEditBillingDocNumber");
    if (docNumberInput && !docNumberInput.dataset.maskBound) {
      docNumberInput.dataset.maskBound = "1";
      docNumberInput.addEventListener("input", () => {
        const isCnpj = $("farmEditBillingDocType")?.value === "cnpj";
        const digits = docNumberInput.value.replace(/\D/g, "").slice(0, isCnpj ? 14 : 11);
        docNumberInput.value = !isCnpj
          ? digits
              .replace(/(\d{3})(\d)/, "$1.$2")
              .replace(/(\d{3})(\d)/, "$1.$2")
              .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
          : digits
              .replace(/^(\d{2})(\d)/, "$1.$2")
              .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
              .replace(/\.(\d{3})(\d)/, ".$1/$2")
              .replace(/(\d{4})(\d)/, "$1-$2");
      });
    }

    // Máscara de CEP (só para Brasil; outros países têm formatos próprios).
    [
      { input: $("farmEditBillingPostal"), isBrazil: () => ($("farmEditBillingCountry")?.value || "BR") === "BR" },
      { input: $("farmEditZipCode"), isBrazil: () => ($("farmEditCountry")?.value || "Brasil") === "Brasil" },
    ].forEach(({ input: postalInput, isBrazil }) => {
      if (!postalInput || postalInput.dataset.maskBound) return;
      postalInput.dataset.maskBound = "1";
      postalInput.addEventListener("input", () => {
        if (!isBrazil()) return;
        const digits = postalInput.value.replace(/\D/g, "").slice(0, 8);
        postalInput.value = digits.replace(/(\d{5})(\d)/, "$1-$2");
      });
    });

    // Máscara de celular/telefone.
    [$("farmEditBillingPhone"), $("farmEditContactPhone")].forEach((phoneInput) => {
      if (!phoneInput || phoneInput.dataset.maskBound) return;
      phoneInput.dataset.maskBound = "1";
      phoneInput.addEventListener("input", () => {
        const digits = phoneInput.value.replace(/\D/g, "").slice(0, 11);
        phoneInput.value = digits.length > 10
          ? digits.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{4})$/, "$1-$2")
          : digits.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{4})$/, "$1-$2");
      });
    });

    // Lógica revisada para Estudo de Sinal
    if (!panel.dataset.saveShortcutBound) {
      panel.dataset.saveShortcutBound = "1";
      panel.addEventListener("keydown", (event) => {
        const isSaveShortcut = (event.ctrlKey || event.metaKey) && String(event.key || "").toLowerCase() === "s";
        if (!isSaveShortcut) return;
        event.preventDefault();
        saveCurrentFarm();
      });
    }

    const setupSignalStudy = () => {
      const signalInput = $("farmEditSignalFile");
      const signalInfo = $("farmEditSignalUploadInfo");
      const signalName = $("farmEditSignalFileName");
      const signalZone = $("farmEditSignalUploadZone");
      const signalStatus = $("farmEditSignalStatus");

      if (!signalInput || !signalZone) return;

      const log = (msg) => {
        if (signalStatus) signalStatus.textContent = `> ${msg}`;
      };

      // Listener de mudança de arquivo
      signalInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          log(`Carregando: ${file.name}...`);
          
          // Feedback Visual Forçado
          if (signalName) signalName.textContent = file.name;
          if (signalInfo) {
            signalInfo.classList.remove("is-hidden");
            signalInfo.style.display = "flex";
          }
          if (signalZone) {
            signalZone.classList.add("is-hidden");
            signalZone.style.display = "";
          }

          const reader = new FileReader();
          reader.onload = (re) => {
            state.signalStudyData = {
              name: file.name,
              content: re.target.result,
              type: file.name.toLowerCase().endsWith(".kmz") ? "kmz" : "kml"
            };
            log("PRONTO! ✅ Clique em SALVAR no topo.");
            if (window.IcNotify?.success) window.IcNotify.success(`Arquivo ${file.name} carregado.`);
          };
          
          reader.onerror = () => {
            log("Erro ao ler o arquivo.");
            alert(tMsg("Erro ao ler o arquivo selecionado."));
          };

          if (file.name.toLowerCase().endsWith(".kmz")) reader.readAsDataURL(file);
          else reader.readAsText(file);
        }
      };

      // Listener para o botão de lixeira (remover)
      const removeBtn = signalInfo?.querySelector("button");
      if (removeBtn) {
        removeBtn.onclick = (e) => {
          e.stopPropagation();
          signalInput.value = "";
          state.signalStudyData = null;
          const farmId = getFarmData()?.id;
          if (farmId) localStorage.removeItem(`ic_signal_study_${farmId}`);
          
          if (signalInfo) {
            signalInfo.classList.add("is-hidden");
            signalInfo.style.display = "";
          }
          if (signalZone) {
            signalZone.classList.remove("is-hidden");
            signalZone.style.display = "block";
          }
          log("Arquivo removido.");
        };
      }
    };

    setupSignalStudy();
    bindWheelToContentScroll();
    setupHolidays();
  }

  // Mesma chave usada em cadastros/core.data.js e create-farm/feature.events.js:
  // marca que a base ficou vazia de propósito, para o farms.json inicial não
  // "ressuscitar" a fazenda apagada na próxima recarga.
  const FARM_EMPTY_START_KEY = "ic_farm_empty_start_v3";

  // Apaga no servidor só quando ele existe (npm start → localhost:3100).
  // Publicado (GitHub Pages/Netlify) não há /api — o DELETE dava 405 — e a
  // fazenda vive só no localStorage, então basta removê-la localmente.
  async function deleteFarm(farmId) {
    const API = window.IC_API_CONFIG || {};
    if (API.usesStaticData || !API.baseUrl) return { ok: true, local: true };

    const url = `${API.baseUrl}/api/farms/${encodeURIComponent(farmId)}`;
    const resp = await fetch(url, { method: "DELETE", headers: { "Content-Type": "application/json" } });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${resp.status}`);
    }
    return resp.json().catch(() => ({ ok: true }));
  }

  // Remove a fazenda do estado em memória e do armazenamento local.
  async function removeFarmLocally(farmId) {
    const allFarms = getAllFarmRecords().filter((f) => String(f?.id) !== String(farmId));

    const createFarm = window.CreateFarm || {};
    const createState = createFarm.state || {};
    const setters = createFarm.setters || {};
    if (typeof setters.setFarms === "function") setters.setFarms(allFarms);
    else createState.farms = allFarms;

    const activeId = sessionStorage.getItem("ic_active_farm");
    if (activeId === String(farmId)) {
      sessionStorage.removeItem("ic_active_farm");
      sessionStorage.removeItem("ic_active_farm_id");
      if (typeof setters.setCurrentFarmId === "function") setters.setCurrentFarmId(null);
      else createState.currentFarmId = null;
      window.IcFarmActive = null;
    }

    if (typeof window.Cad?.data?.persistFarmDataset === "function") {
      await window.Cad.data.persistFarmDataset(allFarms);
    } else if (typeof window.CreateFarm?.events?.saveFarms === "function") {
      await window.CreateFarm.events.saveFarms();
    } else {
      localStorage.setItem("ic_farms", JSON.stringify(allFarms));
    }

    try {
      if (allFarms.length === 0) localStorage.setItem(FARM_EMPTY_START_KEY, "1");
    } catch (_) { }

    if (typeof window.Cad?.data?.loadFarmDataset === "function") {
      await window.Cad.data.loadFarmDataset();
    }

    window.dispatchEvent(new CustomEvent("ic:farm-changed", { detail: { farm: null } }));
    window.dispatchEvent(new Event("ic:layout-change"));
    return allFarms;
  }

  // ========== COMANDO OCULTO: GERENCIADOR DE FAZENDAS (Ctrl+Shift+D) ==========
  function openFarmManagerModal() {
    const MODAL_ID = "farmManagerModal";
    let modal = document.getElementById(MODAL_ID);
    if (modal) { modal.remove(); modal = null; }

    const farms = getAllFarmRecords();
    modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.className = "create-equip";
    modal.innerHTML = `
      <div class="create-equip__backdrop" data-fm-close></div>
      <section class="create-equip__dialog" role="dialog" aria-modal="true" aria-labelledby="farmManagerTitle"
               style="width:min(640px,calc(100vw - 48px)); padding:0; display:flex; flex-direction:column; max-height:calc(100vh - 40px); background:#fff; border-radius:12px; overflow:hidden;">
        <header style="display:flex; align-items:center; justify-content:space-between; padding:20px 24px; border-bottom:1px solid #e5e7eb; flex-shrink:0;">
          <h3 id="farmManagerTitle" style="font-size:18px; font-weight:700; color:#0f172a; margin:0;">Gerenciador de Fazendas</h3>
          <button type="button" data-fm-close style="background:none; border:none; font-size:18px; color:#6b7280; cursor:pointer; line-height:1;"><i class="fa-solid fa-xmark"></i></button>
        </header>
        <div style="padding:20px 24px; flex:1; overflow-y:auto;">
          <p style="font-size:13px; color:#64748b; margin:0 0 16px;">Use este painel para deletar fazendas do sistema. Esta ação não pode ser desfeita.</p>
          <div id="farmManagerList" style="display:flex; flex-direction:column; gap:10px;"></div>
          <div id="farmManagerEmpty" style="display:none; text-align:center; padding:32px 0; color:#9ca3af;">
            <i class="fa-regular fa-folder-open" style="font-size:32px;"></i>
            <p style="font-size:13px; margin-top:8px;">Nenhuma fazenda cadastrada.</p>
          </div>
        </div>
        <footer style="display:flex; justify-content:flex-end; gap:10px; padding:14px 24px; border-top:1px solid #e5e7eb; flex-shrink:0;">
          <button type="button" data-fm-close style="padding:8px 20px; border-radius:8px; font-size:13px; font-weight:500; border:1px solid #cbd5e1; background:#fff; color:#475569; cursor:pointer;">Fechar</button>
        </footer>
      </section>`;
    document.body.appendChild(modal);

    const listEl = modal.querySelector("#farmManagerList");
    const emptyEl = modal.querySelector("#farmManagerEmpty");

    function renderList() {
      const currentFarms = getAllFarmRecords();
      if (!currentFarms.length) {
        listEl.innerHTML = "";
        emptyEl.style.display = "block";
        return;
      }
      emptyEl.style.display = "none";
      listEl.innerHTML = currentFarms.map((f) => {
        const name = f.name || "Fazenda sem nome";
        const id = f.id || "";
        const equipCount = Array.isArray(f.equipments) ? f.equipments.length : 0;
        return `
          <div data-farm-id="${id}" style="display:flex; align-items:center; justify-content:space-between; padding:12px 14px; border:1px solid #e2e8f0; border-radius:8px; background:#f8fafc;">
            <div style="min-width:0;">
              <div style="font-size:14px; font-weight:600; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${name}</div>
              <div style="font-size:12px; color:#64748b; margin-top:2px;">ID: ${id} · ${equipCount} equipamento${equipCount !== 1 ? "s" : ""}</div>
            </div>
            <button type="button" data-fm-delete="${id}" data-fm-name="${name.replace(/"/g, "&quot;")}"
                    style="flex-shrink:0; margin-left:12px; display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:6px; border:1px solid #ef4444; background:#fff; color:#ef4444; font-size:12px; font-weight:600; cursor:pointer;">
              <i class="fa-regular fa-trash-can"></i>
              Deletar
            </button>
          </div>`;
      }).join("");

      // Bind delete buttons
      listEl.querySelectorAll("[data-fm-delete]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const delId = btn.dataset.fmDelete;
          const delName = btn.dataset.fmName || delId;
          if (!confirm(`Deletar a fazenda "${delName}"?\n\nEsta ação não pode ser desfeita.`)) return;
          btn.disabled = true;
          btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
          try {
            await deleteFarm(delId);
            await removeFarmLocally(delId);

            renderList();
            notifySuccess(`Fazenda "${delName}" deletada.`);
          } catch (err) {
            console.error("[FarmManager] Falha ao deletar:", err);
            notifyError("Não foi possível deletar a fazenda.");
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-regular fa-trash-can"></i> Deletar';
          }
        });
      });
    }

    function closeModal() {
      modal.classList.remove("is-open");
      modal.style.display = "none";
      modal.remove();
    }

    modal.querySelectorAll("[data-fm-close]").forEach((el) => el.addEventListener("click", closeModal));
    renderList();
    modal.classList.add("is-open");
    modal.style.display = "flex";
  }

  if (!window.__icFarmManagerShortcutBound) {
    window.__icFarmManagerShortcutBound = true;
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        openFarmManagerModal();
      }
    });
  }

  function bindSidebarShortcut() {
    const navItem = document.querySelector('.nav__item[data-route="fazenda"]');
    if (!navItem || navItem.dataset.farmEditBound) return;
    navItem.dataset.farmEditBound = "1";
    navItem.addEventListener("click", (e) => {
      e.preventDefault();
      open();
    });
  }

  function applyEnergyData() {
    try {
      const farm = getFarmData();
      const faixas = farm?.energyFaixas;
      if (Array.isArray(faixas) && faixas.length) {
        renderFaixaList(JSON.parse(JSON.stringify(faixas)));
        return;
      }
      const raw = JSON.parse(localStorage.getItem("ic_energia_faixas") || "null");
      if (Array.isArray(raw) && raw.length) {
        renderFaixaList(JSON.parse(JSON.stringify(raw)));
      }
    } catch (_) {}
  }

  function saveEnergyFaixas() {
    const faixas = state.energyFaixas;
    if (!faixas?.length) return;

    localStorage.setItem("ic_energia_faixas", JSON.stringify(faixas));

    const seen = new Set();
    const pontaSlots = [];
    faixas.forEach((g) => {
      g.rows.forEach((r) => {
        if (r.tipo === "ponta") {
          const key = `${r.ini}-${r.fim}`;
          if (!seen.has(key)) { seen.add(key); pontaSlots.push({ inicio: r.ini, fim: r.fim }); }
        }
      });
    });
    if (!pontaSlots.length) return;
    const energia = { contratos: [{ nome: "Horário de Ponta", horariosPonta: pontaSlots }] };
    localStorage.setItem("ic_energia", JSON.stringify(energia));
    if (window.IcData?.relatorios) window.IcData.relatorios.energia = energia;
  }

  const MESES_ABBR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  function renderHolidayDots(holidays) {
    document.querySelectorAll("#farmEditHolidays .feriado-mes-dots").forEach((el) => { el.innerHTML = ""; });
    if (!Array.isArray(holidays)) return;
    holidays.forEach((h) => {
      const d = new Date(`${h.date}T00:00:00`);
      if (Number.isNaN(d.getTime())) return;
      const mesEl = document.querySelector(`#farmEditHolidays .feriado-mes-dots[data-mes="${MESES_ABBR[d.getMonth()]}"]`);
      if (!mesEl) return;
      const dot = document.createElement("span");
      dot.className = "feriado-dot";
      dot.title = `${d.getDate()} ${MESES_ABBR[d.getMonth()]} — ${h.name}`;
      dot.textContent = String(d.getDate()).padStart(2, "0");
      dot.style.cssText = "display:inline-flex; align-items:center; justify-content:center; min-width:24px; height:22px; padding:0 6px; border-radius:6px; background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; font-size:12px; font-weight:500; cursor:default;";
      mesEl.appendChild(dot);
    });
  }

  // Domingo de Páscoa (algoritmo de Gauss / Anonymous Gregorian) — base das
  // datas móveis brasileiras (Carnaval, Sexta-feira Santa, Corpus Christi).
  function computeEaster(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  function ymd(date) {
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, "0");
    const da = String(date.getDate()).padStart(2, "0");
    return `${y}-${mo}-${da}`;
  }

  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  // Gera os feriados nacionais localmente (sem depender de internet).
  // Para o futuro seletor de UF/estado, é aqui que entrariam os feriados
  // estaduais/municipais (com um campo `counties`/estado por item).
  function buildLocalHolidays(countryCode, year) {
    if (countryCode === "BR") {
      const easter = computeEaster(year);
      return [
        { date: `${year}-01-01`, name: "Confraternização Universal" },
        { date: ymd(addDays(easter, -48)), name: "Carnaval" },
        { date: ymd(addDays(easter, -47)), name: "Carnaval" },
        { date: ymd(addDays(easter, -2)), name: "Sexta-feira Santa" },
        { date: ymd(easter), name: "Páscoa" },
        { date: `${year}-04-21`, name: "Tiradentes" },
        { date: `${year}-05-01`, name: "Dia do Trabalho" },
        { date: ymd(addDays(easter, 60)), name: "Corpus Christi" },
        { date: `${year}-07-09`, name: "Revolução Constitucionalista" },
        { date: `${year}-09-07`, name: "Independência do Brasil" },
        { date: `${year}-10-12`, name: "Nossa Senhora Aparecida" },
        { date: `${year}-11-02`, name: "Finados" },
        { date: `${year}-11-15`, name: "Proclamação da República" },
        { date: `${year}-12-25`, name: "Natal" },
      ].map((h) => ({ ...h, country: "BR", counties: null, global: true }));
    }
    if (countryCode === "RU") {
      return [
        { date: `${year}-01-01`, name: "Ano Novo" },
        { date: `${year}-01-02`, name: "Feriados de Ano Novo" },
        { date: `${year}-01-03`, name: "Feriados de Ano Novo" },
        { date: `${year}-01-04`, name: "Feriados de Ano Novo" },
        { date: `${year}-01-05`, name: "Feriados de Ano Novo" },
        { date: `${year}-01-06`, name: "Feriados de Ano Novo" },
        { date: `${year}-01-07`, name: "Natal Ortodoxo" },
        { date: `${year}-01-08`, name: "Feriados de Ano Novo" },
        { date: `${year}-02-23`, name: "Dia do Defensor da Pátria" },
        { date: `${year}-03-08`, name: "Dia Internacional da Mulher" },
        { date: `${year}-05-01`, name: "Primavera e Dia do Trabalho" },
        { date: `${year}-05-09`, name: "Dia da Vitória" },
        { date: `${year}-06-12`, name: "Dia da Rússia" },
        { date: `${year}-11-04`, name: "Dia da Unidade Nacional" },
      ].map((h) => ({ ...h, country: "RU", counties: null, global: true }));
    }
    return [];
  }

  // Busca os feriados nacionais. Tenta a API pública Nager.Date (mais precisa,
  // reflete mudanças de lei) e, se a rede falhar (offline/proxy), cai para o
  // cálculo local — garantindo que a importação sempre funcione.
  async function importNationalHolidays(countryCode, year) {
    try {
      const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (Array.isArray(data) && data.length) {
        return data.map((h) => ({
          date: h.date,
          name: h.localName || h.name,
          country: countryCode,
          counties: h.counties || null,
          global: h.global !== false,
        }));
      }
      throw new Error("resposta vazia");
    } catch (err) {
      console.warn("[FarmEdit] API de feriados indisponível, usando cálculo local.", err);
      return buildLocalHolidays(countryCode, year);
    }
  }

  function setupHolidays() {
    const section = $("farmEditHolidays");
    if (!section || section.dataset.holidaysBound) return;
    section.dataset.holidaysBound = "1";

    const btn = $("farmHolidayAddPreset");
    const wrapper = btn?.closest(".holiday-preset");
    const farmId = String(getFarmData()?.id || "");

    // Abre/fecha o menu por clique (além do hover) — mais confiável e funciona no toque.
    if (btn && wrapper) {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        wrapper.classList.toggle("is-open");
      });
      document.addEventListener("click", (e) => {
        if (!wrapper.contains(e.target)) wrapper.classList.remove("is-open");
      });
    }

    // Restaura feriados já importados (persistidos por fazenda)
    if (farmId) {
      try {
        const stored = JSON.parse(localStorage.getItem(`ic_holidays_${farmId}`) || "null");
        if (Array.isArray(stored) && stored.length) {
          state.holidays = stored;
          renderHolidayDots(stored);
        }
      } catch (_) {}
    }

    section.querySelectorAll(".holiday-preset__item").forEach((item) => {
      item.addEventListener("click", async () => {
        const country = item.dataset.holidayCountry || "BR";
        const year = new Date().getFullYear();
        const label = item.textContent.trim();

        const original = btn ? btn.innerHTML : "";
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Importando…'; }
        wrapper?.classList.remove("is-open");

        try {
          const holidays = await importNationalHolidays(country, year);
          if (!holidays.length) throw new Error("resposta vazia");
          state.holidays = holidays;
          renderHolidayDots(holidays);
          if (farmId) localStorage.setItem(`ic_holidays_${farmId}`, JSON.stringify(holidays));
          notifySuccess(`${holidays.length} feriados nacionais de ${label} (${year}) importados.`);
        } catch (err) {
          console.error("[FarmEdit] Falha ao importar feriados.", err);
          notifyError(`Não foi possível importar os feriados de ${label}.`);
        } finally {
          if (btn) { btn.disabled = false; btn.innerHTML = original; }
        }
      });
    });
  }

  async function open() {
    if (state.isOpen) return;
    state.isOpen = true;

    // Fecha outros paineis que compartilham IDs (ex: secao de faturamento)
    window.IcFaturamento?.close?.();

    document.body.classList.add("is-farm-edit");

    const mapCard = $("mapCard");
    if (mapCard) mapCard.style.display = "none";

    await mountEditPanel();
    applyGeneralData();
    applyBillingData();
    applyContactData();
    applyLocationData();
    applyEnergyData();

    // Sincroniza os rótulos dos dropdowns customizados com os valores carregados.
    const refreshSelect = window.CreateFarm?.events?.refreshFarmSelect;
    if (refreshSelect) {
      document.querySelectorAll("#farmEditPanel select.edit-panel__input").forEach((select) => {
        if (select._farmSelect) refreshSelect(select);
      });
    }

    window.dispatchEvent(new Event("ic:layout-change"));
  }

  function close() {
    state.isOpen = false;
    state.energyFaixas = null;
    document.body.classList.remove("is-farm-edit");

    const slot = $("pageSlot");
    if (slot) slot.innerHTML = "";

    const mapCard = $("mapCard");
    if (mapCard) mapCard.style.display = "";

    const map = window.icMap;
    if (map && typeof map.invalidateSize === "function") {
      map.invalidateSize({ pan: false });
      requestAnimationFrame(() => map.invalidateSize({ pan: false }));
      setTimeout(() => map.invalidateSize({ pan: false }), 180);
    }

    window.dispatchEvent(new Event("ic:layout-change"));
  }

  window.IcFarmNav = function (target, btn) {
    document.querySelectorAll("#farmEditPanel .edit-panel__nav-item").forEach((item) => {
      item.classList.toggle("is-active", item === btn);
    });
    document.querySelectorAll("#farmEditPanel .edit-panel__section").forEach((s) => {
      s.classList.remove("is-active");
    });
    const section = document.querySelector(target);
    if (section) section.classList.add("is-active");
    if (target === "#farmEditLocation") {
      if (!state.editMap) ensureLocationMapReady();
      else setTimeout(() => state.editMap.invalidateSize(), 80);
    }
    if (target === "#farmEditTalhoes") {
      window.IcTalhoes?.initInPlace();
      window.IcTalhoes?.invalidate();
    }
    if (target === "#farmEditEnergy") {
      applyEnergyData();
    }
    if (target === "#farmEditUsers") {
      window.IcFarmUsers?.render();
    }
  };

  window.IcFarmEdit = { open, close, save: saveCurrentFarm };

  // Garante o dropdown customizado (farm-select) em todos os selects do painel,
  // independente de qual fluxo montou/remontou o HTML: observa o DOM e encapsula
  // qualquer select.edit-panel__input novo assim que ele aparecer.
  function enhancePanelSelects() {
    const panel = document.getElementById("farmEditPanel");
    const ev = window.CreateFarm?.events;
    if (!panel || !ev?.enhanceFarmSelect) return;
    ev.bindFarmSelectGlobalEvents?.();
    panel.querySelectorAll("select.edit-panel__input").forEach((select) => {
      if (!select._farmSelect) ev.enhanceFarmSelect(select, panel);
    });
  }

  if (!window.__icFarmSelectObserver) {
    window.__icFarmSelectObserver = true;
    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        enhancePanelSelects();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    enhancePanelSelects();
  }

  // País do Endereço Técnico (aba Contato): adapta CEP/Estado/Cidade/Endereço
  // conforme o país. Delegado no documento para funcionar independente de qual
  // fluxo montou/remontou o painel.
  if (!window.__icFarmContactCountryDelegated) {
    window.__icFarmContactCountryDelegated = true;
    document.addEventListener("change", (e) => {
      if (e.target?.id === "farmEditCountry") applyContactCountryRules(e.target.value);
    });
  }

  // Fallback robusto: liga o botão Salvar via delegação no documento, para o
  // caso de o bindEditUI não rodar (re-montagem do painel ou open() barrado
  // pelo guard state.isOpen). handleSaveFarm já é idempotente (dataset.saving),
  // então não há risco de salvar duas vezes se o onclick também estiver ligado.
  if (!window.__icFarmSaveDelegated) {
    window.__icFarmSaveDelegated = true;
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("#farmEditPanel .edit-panel__save");
      if (!btn) return;
      e.preventDefault();
      handleSaveFarm(btn);
    });
  }

  bindSidebarShortcut();
})();
