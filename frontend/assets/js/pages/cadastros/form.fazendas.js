(function () {
  "use strict";
  const Cad = (window.Cad = window.Cad || {});

  const state = Cad.state;

  function bindCadastrosBillingForm(data) {
    const root = document.getElementById("cadastrosFarmBilling");
    if (!root) return;

    const billing = data?.billing || {};
    const bindFn = window.CreateFarm?.events?.bindBillingForm;
    const applyRules = window.CreateFarm?.helpers?.applyBillingRules;

    if (bindFn) {
      bindFn(root, {});
    } else {
      // fallback manual show/hide
      const countryEl = root.querySelector("[data-country]");
      const detailBlocks = root.querySelectorAll("[data-billing-details]");
      const toggle = (show) => detailBlocks.forEach(b => {
        b.classList.toggle("is-hidden", !show);
        b.setAttribute("aria-hidden", String(!show));
        b.querySelectorAll("input, select").forEach(el => { el.disabled = !show; });
      });
      if (countryEl) {
        countryEl.addEventListener("change", () => {
          const has = !!countryEl.value;
          toggle(has);
          if (has && applyRules) applyRules(root, countryEl.value);
          setTimeout(() => Cad.ui.initCadCustomSelects(root), 0);
        });
        toggle(!!countryEl.value);
      }
    }

    // pre-populate saved values
    const country = billing.country || "";
    const countryEl = root.querySelector("[data-country]");
    if (countryEl && country) {
      countryEl.value = country;
      countryEl.dispatchEvent(new Event("change"));
      if (applyRules) applyRules(root, country);
    }

    // Always re-check after country change (covers both bindFn and fallback paths)
    if (countryEl) {
      countryEl.addEventListener("change", () => setTimeout(() => Cad.ui.initCadCustomSelects(root), 0));
    }
    setTimeout(() => Cad.ui.initCadCustomSelects(root), 0);

    const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
    set("cadFarmBillingPostal", billing.postal || "");
    set("cadFarmBillingCity", billing.city || "");
    set("cadFarmBillingAddress", billing.address || "");
    set("cadFarmBillingRegion", billing.region || "");
    set("cadFarmBillingNeighborhood", billing.neighborhood || "");
    set("cadFarmBillingDocType", billing.document_type || "");
    set("cadFarmBillingDocNumber", billing.document_number || "");
    set("cadFarmBillingName", billing.legal_name || "");
    set("cadFarmBillingPhone", billing.phone || "");
    set("cadFarmBillingEmail", billing.email || "");
    set("cadFarmBillingEmailLanguage", billing.email_language || "pt-BR");

    const autoBillingExpandBtn = root.querySelector("[data-cobranca-expand]");
    const autoBillingContent = root.querySelector("[data-cobranca-content]");
    if (autoBillingExpandBtn && autoBillingContent) {
      const autoBillingSection = autoBillingExpandBtn.closest(".farm-billing__section");
      const autoBillingExpandIcon = autoBillingExpandBtn.querySelector("i");
      const setAutoBillingExpanded = (isExpanded) => {
        autoBillingContent.classList.toggle("is-hidden", !isExpanded);
        autoBillingContent.setAttribute("aria-hidden", String(!isExpanded));
        autoBillingExpandBtn.setAttribute("aria-expanded", String(isExpanded));
        if (autoBillingSection) {
          autoBillingSection.classList.toggle("is-collapsed", !isExpanded);
        }
        if (autoBillingExpandIcon) {
          autoBillingExpandIcon.classList.toggle("fa-chevron-left", isExpanded);
          autoBillingExpandIcon.classList.toggle("fa-chevron-right", !isExpanded);
        }
      };

      setAutoBillingExpanded(false);
      autoBillingExpandBtn.addEventListener("click", () => {
        const isExpanded = autoBillingExpandBtn.getAttribute("aria-expanded") === "true";
        setAutoBillingExpanded(!isExpanded);
      });
    }
  }

  function setupFarmTabs(container) {
    const host = container || document;
    const tabs = Array.from(host.querySelectorAll("[data-farm-tab-target]"));
    if (!tabs.length) return;

    const activateTab = (targetId) => {
      tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.farmTabTarget === targetId));
      ["content-farm-geral", "content-farm-faturamento", "content-farm-contato"].forEach((sectionId) => {
        const section = host.querySelector(`#${sectionId}`);
        if (!section) return;
        section.classList.toggle("is-active", sectionId === targetId);
      });
    };

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => activateTab(tab.dataset.farmTabTarget));
    });
  }

  function resolveFarmHistoryDate(data) {
    const candidates = [
      data?.billing?.last_due_date,
      data?.billing?.updated_at,
      data?.updatedAt,
      data?.createdAt
    ];
    for (const value of candidates) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date;
    }

    const rawId = String(data?.id || "");
    if (rawId.startsWith("farm_")) {
      const ts = Number(rawId.slice(5));
      if (Number.isFinite(ts)) {
        const date = new Date(ts);
        if (!Number.isNaN(date.getTime())) return date;
      }
    }
    return new Date();
  }

  function renderFarmBillingHistory(data) {
    const tbody = document.getElementById("farm_historico_body");
    if (!tbody) return;
    const dt = resolveFarmHistoryDate(data);
    const dateText = dt.toLocaleDateString("pt-BR");
    tbody.innerHTML = `
      <tr>
        <td>${dateText}</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
      </tr>
    `;
  }

  function ensureFarmBillingHistoryClean(data) {
    const tbody = document.getElementById("farm_historico_body");
    if (!tbody) return;

    const forceSimpleHistoryRow = () => {
      renderFarmBillingHistory(data);
    };

    const needsCleanup = () => {
      const hasActionButtons = !!tbody.querySelector(".gestao-op__sch-actions, .sch-btn, .cad-row-active-dot");
      const row = tbody.querySelector("tr");
      if (!row || row.children.length !== 4) return true;
      const firstCellText = (row.children[0]?.textContent || "").trim();
      const looksLikeDate = /^\d{2}\/\d{2}\/\d{4}$/.test(firstCellText);
      return hasActionButtons || !looksLikeDate;
    };

    const enforce = () => {
      if (needsCleanup()) forceSimpleHistoryRow();
    };

    // tenta limpar em diferentes momentos para cobrir reescritas assíncronas
    enforce();
    setTimeout(enforce, 0);
    setTimeout(enforce, 100);
    setTimeout(enforce, 350);
    setTimeout(enforce, 900);

    if (typeof MutationObserver !== "undefined") {
      const observer = new MutationObserver(() => enforce());
      observer.observe(tbody, { childList: true, subtree: true });
      // evita observer permanente, pois a tabela é estática nessa tela
      setTimeout(() => observer.disconnect(), 2500);
    }
  }

  function setupFarmFormFormatters() {
    // --- utilidades ---
    function digits(v) { return v.replace(/\D/g, ""); }

    function applyMask(input, maskFn) {
      const pos = input.selectionStart;
      const raw = input.value;
      const formatted = maskFn(raw);
      if (formatted === raw) return;
      // preserva posicao do cursor aproximadamente
      const diff = formatted.length - raw.length;
      input.value = formatted;
      try { input.setSelectionRange(pos + diff, pos + diff); } catch (_) { }
    }

    function maskPhone(v) {
      const d = digits(v).slice(0, 11);
      if (d.length === 0) return "";
      if (d.length <= 2) return `(${d}`;
      if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
      if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
      return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    }

    function maskCep(v) {
      const d = digits(v).slice(0, 8);
      if (d.length <= 5) return d;
      return `${d.slice(0, 5)}-${d.slice(5)}`;
    }

    function maskCpf(v) {
      const d = digits(v).slice(0, 11);
      if (d.length <= 3) return d;
      if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
      if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
      return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
    }

    function maskCnpj(v) {
      const d = digits(v).slice(0, 14);
      if (d.length <= 2) return d;
      if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
      if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
      if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
      return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
    }

    function maskUf(v) {
      return v.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2);
    }

    function titleCase(v) {
      // capitaliza a primeira letra de cada palavra, mantem o restante
      return v.replace(/\b\w/g, (c) => c.toUpperCase());
    }

    // --- bind ---
    const phone1 = document.getElementById("farm_contact");
    const phone2 = document.getElementById("farm_phone");
    const phone3 = document.getElementById("farmTechContactPhone");
    [phone1, phone2, phone3].forEach((el) => {
      if (!el) return;
      el.addEventListener("input", () => applyMask(el, maskPhone));
    });

    const postal = document.getElementById("farm_postal");
    if (postal) postal.addEventListener("input", () => applyMask(postal, maskCep));
    const techPostal = document.getElementById("farmTechPostal");
    if (techPostal) techPostal.addEventListener("input", () => applyMask(techPostal, maskCep));

    const docType = document.getElementById("farm_document_type");
    const docNum = document.getElementById("farm_document_number");
    if (docNum) {
      docNum.addEventListener("input", () => {
        const type = docType?.value || "cpf";
        applyMask(docNum, type === "cnpj" ? maskCnpj : maskCpf);
      });
      if (docType) {
        docType.addEventListener("change", () => {
          docNum.value = "";
          docNum.placeholder = docType.value === "cnpj" ? "00.000.000/0001-00" : "000.000.000-00";
        });
      }
    }

    const uf = document.getElementById("farm_region");
    if (uf) uf.addEventListener("input", () => { uf.value = maskUf(uf.value); });
    const techState = document.getElementById("farmTechState");
    if (techState) techState.addEventListener("input", () => { techState.value = maskUf(techState.value); });

    // capitalizacao automatica em campos de texto livre
    ["farm_name", "farm_owner", "farm_legal_name", "farm_city",
      "farm_neighborhood", "farm_address", "farm_loc_label", "farmTechAddress", "farmTechCity"].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("blur", () => { el.value = titleCase(el.value); });
      });
  }

  function renderFormFazendas(id, container) {
    let data = {
      name: '', owner: '', contact: '', lat: '', lng: '', energyBillDay: '', waterBillDay: '', hasCentral: false, timezone: 'America/Sao_Paulo',
      billing: { country: '', postal: '', city: '', address: '', region: '', neighborhood: '', document_type: 'cpf', document_number: '', legal_name: '', phone: '', email: '', email_language: 'pt-BR' },
      technical: { country: 'BR', postal: '', state: '', address: '', city: '', contact_phone: '' }
    };

    if (id) {
      const farms = Cad.data.getAllFarms();
      const found = farms.find(f => String(f.id) === String(id));
      if (found) data = found;
      if (!data.billing) data.billing = {};
    }

    if (!id) {
      data = {
        name: '', owner: '', contact: '', lat: '', lng: '', energyBillDay: '', waterBillDay: '', hasCentral: false, timezone: 'America/Sao_Paulo',
        billing: { country: '', postal: '', city: '', address: '', region: '', neighborhood: '', document_type: 'cpf', document_number: '', legal_name: '', phone: '', email: '', email_language: 'pt-BR' },
        technical: { country: 'BR', postal: '', state: '', address: '', city: '', contact_phone: '' }
      };
    }

    if (!data.technical) {
      data.technical = {
        country: data.billing?.country || 'BR',
        postal: data.billing?.postal || '',
        state: data.billing?.region || '',
        address: data.billing?.address || '',
        city: data.billing?.city || '',
        contact_phone: data.contact || ''
      };
    }

    const initialHistoryDateText = resolveFarmHistoryDate(data).toLocaleDateString("pt-BR");

    container.innerHTML = `
    <div class="cadastros-form-card cadastros-form-card--with-footer">
      <div class="cadastros-form-topbar">
        <div class="cadastros-form-topbar__text">${id ? 'Editar Fazenda' : 'Nova Fazenda'}</div>
        <span class="cadastros-form-topbar__sep">-</span>
        <div class="cadastros-form-topbar__actions">
          <button type="button" class="farm-tab-btn is-active" data-farm-tab-target="content-farm-geral">Geral</button>
          <button type="button" class="farm-tab-btn" data-farm-tab-target="content-farm-faturamento">Faturamento</button>
          <button type="button" class="farm-tab-btn" data-farm-tab-target="content-farm-contato">Contato</button>
        </div>
      </div>

      <div class="cadastros-form-content">
        <div id="content-farm-geral" class="cadastros-form-section is-active">
          <div class="cadastros-form-grid cadastros-form-grid--farm">

            <div class="equip-field col-span-2">
              <div class="farm-radio-field">
                <div class="farm-radio-field__header">
                  <span class="farm-radio-field__label">R\u00e1dio da central</span>
                  <button type="button" class="farm-radio-field__edit" title="Editar r\u00e1dio">
                    <i class="fa-solid fa-pen-to-square"></i>
                  </button>
                </div>
                <div class="farm-radio-field__value">
                  <span class="farm-radio-field__text" id="farm_central_radio_display">${data.centralRadio || ''}</span>
                  <i class="fa-solid fa-check" style="color:#9ca3af;font-size:11px;"></i>
                </div>
                <input type="hidden" id="farm_central_radio" value="${data.centralRadio || ''}">
              </div>
            </div>

            <div class="equip-field col-span-2">
              <label class="equip-label" for="farm_name"><span class="equip-required">*</span>Nome da fazenda</label>
              <input type="text" class="equip-input" id="farm_name" value="${data.name || ''}" placeholder="Ex: Recanto da Serra" required>
            </div>

            <div class="equip-field">
              <label class="equip-label" for="farm_owner">Nome do Cliente</label>
              <input type="text" class="equip-input" id="farm_owner" value="${data.owner || ''}" placeholder="Ex: Jo\u00e3o da Silva">
            </div>
            <div class="equip-field">
              <label class="equip-label" for="farm_timezone"><span class="equip-required">*</span>Fuso hor\u00e1rio</label>
              <select class="equip-input" id="farm_timezone">
                <option value="Africa/Abidjan" ${data.timezone === 'Africa/Abidjan' ? 'selected' : ''}>\u00c1frica/Abidjan (GMT+00)</option>
                <option value="America/Sao_Paulo" ${data.timezone === 'America/Sao_Paulo' ? 'selected' : ''}>Am\u00e9rica/Sao_Paulo (GMT-03)</option>
                <option value="America/Cuiaba" ${data.timezone === 'America/Cuiaba' ? 'selected' : ''}>Am\u00e9rica/Cuiab\u00e1 (GMT-04)</option>
                <option value="America/Manaus" ${data.timezone === 'America/Manaus' ? 'selected' : ''}>Am\u00e9rica/Manaus (GMT-04)</option>
                <option value="America/Rio_Branco" ${data.timezone === 'America/Rio_Branco' ? 'selected' : ''}>Am\u00e9rica/Rio Branco (GMT-05)</option>
                <option value="UTC" ${data.timezone === 'UTC' ? 'selected' : ''}>UTC (GMT+00)</option>
              </select>
            </div>
            <div class="farm-form-divider col-span-2">Localização da Sede</div>

            <div class="col-span-2 farm-coords-row">
              <div class="equip-field">
                <label class="equip-label" for="farm_lat"><span class="equip-required">*</span>Latitude</label>
                <input type="number" class="equip-input" id="farm_lat" value="${data.lat ?? ''}" step="0.000001" placeholder="-21.836500">
              </div>
              <div class="equip-field">
                <label class="equip-label" for="farm_lng"><span class="equip-required">*</span>Longitude</label>
                <input type="number" class="equip-input" id="farm_lng" value="${data.lng ?? ''}" step="0.000001" placeholder="-46.947900">
              </div>
              <div class="equip-field farm-coords-pin">
                <div class="equip-label">&nbsp;</div>
                <button type="button" class="cadastros-map-pin-btn cadastros-map-picker-top" id="farmPickLocationBtn" onclick="window.IcStartFarmLocationPick()" title="Capturar coordenadas clicando no mapa">
                  <i class="fa-solid fa-house"></i>
                </button>
              </div>
            </div>

            <div class="farm-form-divider col-span-2">Localização da Central de Rádio</div>

            <div class="col-span-2 farm-coords-row">
              <div class="equip-field">
                <label class="equip-label" for="farm_central_lat">Latitude</label>
                <input type="number" class="equip-input" id="farm_central_lat" value="${data.centralLat ?? ''}" step="0.000001" placeholder="-21.836500">
              </div>
              <div class="equip-field">
                <label class="equip-label" for="farm_central_lng">Longitude</label>
                <input type="number" class="equip-input" id="farm_central_lng" value="${data.centralLng ?? ''}" step="0.000001" placeholder="-46.947900">
              </div>
              <div class="equip-field farm-coords-pin">
                <div class="equip-label">&nbsp;</div>
                <button type="button" class="cadastros-map-pin-btn cadastros-map-picker-top" id="farmPickCentralBtn" onclick="window.IcStartCentralLocationPick()" title="Definir local da central">
                  <i class="fa-solid fa-wifi"></i>
                </button>
              </div>
            </div>

          </div>
        </div>

        <div id="content-farm-faturamento" class="cadastros-form-section">
          <div class="farm-billing" id="cadastrosFarmBilling" data-farm-billing>
            <section class="farm-billing__section farm-billing__details is-hidden" data-billing-details aria-hidden="true">
              <header class="farm-billing__section-head">
                <h4 class="farm-billing__section-title">Informa\u00e7\u00f5es de Faturamento</h4>
              </header>

              <div class="equip-form farm-billing__grid farm-billing__grid--billing-top">
                <div class="equip-field farm-billing__field farm-billing__field--span-2" data-field="docGroup">
                  <label class="equip-label" for="cadFarmBillingDocType">
                    <span data-label-text>Documento</span>
                    <span class="equip-required">*</span>
                  </label>
                  <div class="farm-billing__doc">
                    <select class="equip-input" id="cadFarmBillingDocType" data-doc-type aria-label="Tipo de documento" disabled></select>
                    <input class="equip-input" id="cadFarmBillingDocNumber" type="text" placeholder="000.000.000-00" aria-label="N\u00famero do documento" disabled>
                  </div>
                </div>

                <div class="equip-field farm-billing__field" data-field="legalName">
                  <label class="equip-label" for="cadFarmBillingName">
                    <span data-label-text>Nome completo</span>
                    <span class="equip-required">*</span>
                  </label>
                  <input class="equip-input" id="cadFarmBillingName" type="text" placeholder="Nome completo" disabled>
                </div>
              </div>

              <div class="equip-form farm-billing__grid farm-billing__grid--billing-bottom">
                <div class="equip-field farm-billing__field" data-field="phone">
                  <label class="equip-label" for="cadFarmBillingPhone">
                    <span data-label-text>Celular</span>
                    <span class="equip-required">*</span>
                  </label>
                  <input class="equip-input" id="cadFarmBillingPhone" type="tel" placeholder="(00) 00000-0000" disabled>
                </div>

                <div class="equip-field farm-billing__field" data-field="email">
                  <label class="equip-label" for="cadFarmBillingEmail">
                    <span data-label-text>E-mail</span>
                    <span class="equip-required">*</span>
                  </label>
                  <input class="equip-input" id="cadFarmBillingEmail" type="email" placeholder="exemplo@mail.com.br" disabled>
                </div>

                <div class="equip-field farm-billing__field" data-field="emailLanguage">
                  <label class="equip-label" for="cadFarmBillingEmailLanguage">
                    <span class="equip-required">*</span>
                    <span data-label-text>Idioma para e-mails</span>
                    <i class="fa-solid fa-circle-info farm-billing__label-help" title="Idioma utilizado nos e-mails autom\u00e1ticos"></i>
                  </label>
                  <select class="equip-input" id="cadFarmBillingEmailLanguage" aria-label="Idioma para e-mails" disabled>
                    <option value="pt-BR">Portugu\u00eas</option>
                    <option value="en-US">Ingl\u00eas</option>
                  </select>
                </div>
              </div>
            </section>

            <section class="farm-billing__section">
              <header class="farm-billing__section-head">
                <h4 class="farm-billing__section-title">Endere\u00e7o de Faturamento</h4>
              </header>

              <div class="equip-form farm-billing__grid farm-billing__grid--country">
                <div class="equip-field farm-billing__field" data-field="country">
                  <label class="equip-label" for="cadFarmBillingCountry">
                    <span data-label-text>Pa\u00eds</span>
                    <span class="equip-required">*</span>
                  </label>
                  <select class="equip-input" id="cadFarmBillingCountry" data-country data-input>
                    <option value="">Selecione o pa\u00eds</option>
                    <option value="BR">Brasil</option>
                    <option value="US">Estados Unidos</option>
                    <option value="DE">Alemanha</option>
                    <option value="ZA">\u00c1frica do Sul</option>
                  </select>
                </div>

                <div class="equip-field farm-billing__field is-hidden" data-field="postal" data-billing-details aria-hidden="true">
                  <label class="equip-label" for="cadFarmBillingPostal">
                    <span data-label-text>CEP</span>
                    <span class="equip-required">*</span>
                  </label>
                  <input class="equip-input" id="cadFarmBillingPostal" data-input type="text" placeholder="00000-000" disabled>
                </div>

                <div class="equip-field farm-billing__field is-hidden" data-field="city" data-billing-details aria-hidden="true">
                  <label class="equip-label" for="cadFarmBillingCity">
                    <span data-label-text>Cidade</span>
                    <span class="equip-required">*</span>
                  </label>
                  <input class="equip-input" id="cadFarmBillingCity" data-input type="text" placeholder="Ex: Goi\u00e2nia" disabled>
                </div>
              </div>

              <div class="farm-billing__details is-hidden" data-billing-details aria-hidden="true">
                <div class="equip-form farm-billing__grid farm-billing__grid--address">
                  <div class="equip-field farm-billing__field" data-field="region">
                    <label class="equip-label" for="cadFarmBillingRegion">
                      <span data-label-text>Estado (UF)</span>
                      <span class="equip-required">*</span>
                    </label>
                    <input class="equip-input farm-billing__control" id="cadFarmBillingRegion" data-region-input type="text" placeholder="Ex: SP" disabled>
                    <select class="equip-input farm-billing__control" id="cadFarmBillingRegionSelect" data-region-select disabled></select>
                  </div>

                  <div class="equip-field farm-billing__field farm-billing__field--span-2" data-field="address">
                    <label class="equip-label" for="cadFarmBillingAddress">
                      <span data-label-text>Endere\u00e7o</span>
                      <span class="equip-required">*</span>
                    </label>
                    <input class="equip-input" id="cadFarmBillingAddress" data-input type="text" placeholder="Ex: Av. Brasil, 120" disabled>
                  </div>
                </div>
              </div>
            </section>

            <section class="farm-billing__section">
              <div class="farm-cobranca__header">
                <div class="farm-cobranca__title">
                  <button type="button" class="farm-cobranca__expand-btn" data-cobranca-expand aria-expanded="false" aria-controls="farm_cobranca_content" title="Expandir ou recolher cobran\u00e7a autom\u00e1tica">
                    <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
                  </button>
                  <span class="farm-billing__section-title">Cobran\u00e7a autom\u00e1tica</span>
                  <i class="fa-solid fa-circle-info farm-cobranca__info-icon" title="Sobre cobran\u00e7a autom\u00e1tica"></i>
                </div>
                <div class="farm-cobranca__actions">
                  <label class="farm-cobranca__toggle">
                    <input type="checkbox" id="farm_auto_billing" ${data.autoBilling ? 'checked' : ''}>
                    <span class="farm-cobranca__toggle-track"></span>
                  </label>
                </div>
              </div>
              <div class="farm-cobranca__content is-hidden" id="farm_cobranca_content" data-cobranca-content aria-hidden="true">
              <p class="farm-cobranca__desc">Adicione um cart\u00e3o de cr\u00e9dito para habilitar o pagamento autom\u00e1tico das anuidades. Essa op\u00e7\u00e3o \u00e9 recomendada para evitar que voc\u00ea esque\u00e7a de realizar os pagamentos nas datas corretas, o que pode causar bloqueios no seu acesso \u00e0 fazenda.</p>
              <div class="farm-cobranca__alert">
                <span>Nenhuma forma de pagamento cadastrada.</span>
              </div>
              </div>
            </section>

            <section class="farm-billing__section">
              <div class="farm-historico__header">
                <span class="farm-billing__section-title">Hist\u00f3rico de faturamento</span>
                <div class="farm-historico__actions">
                  <button type="button" class="farm-historico__icon-btn" title="Atualizar"><i class="fa-solid fa-rotate-right"></i></button>
                  <button type="button" class="farm-historico__icon-btn" title="Exportar"><i class="fa-solid fa-up-right-from-square"></i></button>
                  <button type="button" class="farm-historico__icon-btn" title="Configurar"><i class="fa-solid fa-gear"></i></button>
                </div>
              </div>
              <table class="farm-historico__table">
                <thead>
                  <tr>
                    <th>Vencimento</th>
                    <th>Status <i class="fa-solid fa-filter farm-historico__filter-icon"></i></th>
                    <th>Valor</th>
                    <th>Link</th>
                  </tr>
                </thead>
                <tbody id="farm_historico_body">
                  <tr>
                    <td>${initialHistoryDateText}</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                  </tr>
                </tbody>
              </table>
            </section>
          </div>
        </div>

        <div id="content-farm-contato" class="cadastros-form-section">
          <div class="farm-billing farm-contact-tab">
            <section class="farm-billing__section">
              <header class="farm-billing__section-head">
                <h4 class="farm-billing__section-title">Informa\u00e7\u00f5es do Endere\u00e7o T\u00e9cnico</h4>
              </header>
              <div class="equip-form farm-billing__grid farm-contact__grid--technical">
                <div class="equip-field farm-billing__field">
                  <label class="equip-label" for="farmTechCountry">
                    <span class="equip-required">*</span>
                    <span data-label-text>Pa\u00eds</span>
                  </label>
                  <select class="equip-input" id="farmTechCountry" aria-label="Pa\u00eds do endere\u00e7o t\u00e9cnico">
                    <option value="BR" ${data.technical?.country === 'BR' ? 'selected' : ''}>BR Brasil</option>
                    <option value="US" ${data.technical?.country === 'US' ? 'selected' : ''}>US Estados Unidos</option>
                    <option value="DE" ${data.technical?.country === 'DE' ? 'selected' : ''}>DE Alemanha</option>
                    <option value="ZA" ${data.technical?.country === 'ZA' ? 'selected' : ''}>ZA \u00c1frica do Sul</option>
                  </select>
                </div>
                <div class="equip-field farm-billing__field">
                  <label class="equip-label" for="farmTechPostal">
                    <span class="equip-required">*</span>
                    <span data-label-text>C\u00f3digo Postal</span>
                  </label>
                  <input class="equip-input" id="farmTechPostal" type="text" placeholder="73850-000" value="${data.technical?.postal || ''}">
                </div>
                <div class="equip-field farm-billing__field">
                  <label class="equip-label" for="farmTechState">
                    <span class="equip-required">*</span>
                    <span data-label-text>Estado</span>
                  </label>
                  <input class="equip-input" id="farmTechState" type="text" placeholder="GO" value="${data.technical?.state || ''}">
                </div>
                <div class="equip-field farm-billing__field farm-contact__field--span-2">
                  <label class="equip-label" for="farmTechAddress">
                    <span class="equip-required">*</span>
                    <span data-label-text>Endere\u00e7o</span>
                  </label>
                  <input class="equip-input" id="farmTechAddress" type="text" placeholder="- Endere\u00e7o" value="${data.technical?.address || ''}">
                </div>
                <div class="equip-field farm-billing__field">
                  <label class="equip-label" for="farmTechCity">
                    <span class="equip-required">*</span>
                    <span data-label-text>Cidade</span>
                  </label>
                  <input class="equip-input" id="farmTechCity" type="text" placeholder="Cristalina" value="${data.technical?.city || ''}">
                </div>
              </div>
            </section>

            <section class="farm-billing__section">
              <header class="farm-billing__section-head">
                <h4 class="farm-billing__section-title">Informa\u00e7\u00f5es do Contato T\u00e9cnico</h4>
              </header>
              <div class="equip-form farm-billing__grid farm-contact__grid--contact">
                <div class="equip-field farm-billing__field">
                  <label class="equip-label" for="farmTechContactPhone">
                    <span data-label-text>Celular de contato</span>
                    <i class="fa-solid fa-circle-info farm-billing__label-help" title="Telefone para contato t\u00e9cnico"></i>
                  </label>
                  <input class="equip-input" id="farmTechContactPhone" type="tel" placeholder="(38) 99610-919" value="${data.technical?.contact_phone || ''}">
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
      <div class="cadastros-form-footer cadastros-form-footer--farm">
        <button type="button" class="cad-form-action-btn cad-form-action-btn--ghost" onclick="window.IcCancelCurrent('fazendas')">
          <i class="fa-solid fa-xmark"></i> Cancelar
        </button>
        <button type="button" class="cad-form-action-btn cad-form-action-btn--primary" onclick="window.IcSaveRecord('fazendas')">
          <i class="fa-solid fa-floppy-disk"></i> Salvar
        </button>
      </div>
    </div>`;

    Cad.viewMaps.syncFarmLocationPickerButton();
    Cad.viewMaps.renderFazendasMap(Cad.data.getAllFarms());
    bindCadastrosBillingForm(data);

    const latInput = document.getElementById("farm_lat");
    const lngInput = document.getElementById("farm_lng");
    [latInput, lngInput].forEach((input) => {
      if (!input) return;
      input.addEventListener("input", () => Cad.viewMaps.renderFazendasMap(Cad.data.getAllFarms()));
    });

    setupFarmFormFormatters();
    setupFarmTabs(container);
    Cad.ui.initCadCustomSelects(container);
    renderFarmBillingHistory(data);
    ensureFarmBillingHistoryClean(data);
    setupRadioField();
  }

  function setupRadioField() {
    const editBtn = document.querySelector(".farm-radio-field__edit");
    const display = document.getElementById("farm_central_radio_display");
    const hidden = document.getElementById("farm_central_radio");
    const valueRow = document.querySelector(".farm-radio-field__value");
    if (!editBtn || !display || !hidden || !valueRow) return;

    let editing = false;
    let inlineInput = null;

    const enterEdit = () => {
      editing = true;
      inlineInput = document.createElement("input");
      inlineInput.type = "text";
      inlineInput.className = "farm-radio-field__input";
      inlineInput.value = hidden.value;
      inlineInput.placeholder = "Ex: 0013A20041F0BC0C";
      display.replaceWith(inlineInput);
      editBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
      editBtn.title = "Confirmar";
      inlineInput.focus();
      inlineInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") confirmEdit();
        if (e.key === "Escape") cancelEdit();
      });
    };

    const confirmEdit = () => {
      if (!editing) return;
      editing = false;
      const val = inlineInput.value.trim();
      hidden.value = val;
      const newDisplay = document.createElement("span");
      newDisplay.className = "farm-radio-field__text";
      newDisplay.id = "farm_central_radio_display";
      newDisplay.textContent = val;
      inlineInput.replaceWith(newDisplay);
      editBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
      editBtn.title = "Editar r\u00e1dio";
    };

    const cancelEdit = () => {
      if (!editing) return;
      editing = false;
      const newDisplay = document.createElement("span");
      newDisplay.className = "farm-radio-field__text";
      newDisplay.id = "farm_central_radio_display";
      newDisplay.textContent = hidden.value;
      inlineInput.replaceWith(newDisplay);
      editBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
      editBtn.title = "Editar r\u00e1dio";
    };

    editBtn.addEventListener("click", () => {
      if (editing) confirmEdit(); else enterEdit();
    });
  }

  Cad.formFazendas = {
    renderFormFazendas,
    bindCadastrosBillingForm,
    setupFarmFormFormatters
  };

})();
