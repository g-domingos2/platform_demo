// assets/js/pages/equipamentos/cosmofield.js
(function () {
  "use strict";

  window.IcEquipamentos = window.IcEquipamentos || {};

  // ========= Helpers =========
  // pinIcon compartilhado — ver assets/js/core/map-icons.js
  const { pinIcon } = window.IcMapIcons;
  // escapeHtml/parseLatLng compartilhados — ver assets/js/core/geo-utils.js
  const { escapeHtml, parseLatLng, destinationPoint } = window.IcGeo;

  // Traduz para o idioma ativo da plataforma.
  const t = (text) => window.IcI18n?.t?.(text) ?? text;

  // Rumo A→B em graus. destinationPoint espera graus, e o corredor do
  // LineStar precisa da perpendicular a esse rumo.
  function bearingDegBetween(from, to) {
    const phi1 = from.lat * Math.PI / 180;
    const phi2 = to.lat * Math.PI / 180;
    const dLambda = (to.lng - from.lng) * Math.PI / 180;
    const y = Math.sin(dLambda) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  // Contorno de um pivô setorial: arco do raio externo fechado de volta
  // pelo centro, formando a "fatia". Mesma convenção do mapa da visão
  // geral (buildSectorRing em mapa.js): os ângulos são relativos ao rumo
  // centro→referência, não ao norte.
  function sectorOutline(center, radius, bearingRefDeg, startAngle, endAngle, stepDeg = 2) {
    const start = parseFloat(startAngle) || 0;
    let end = parseFloat(endAngle) || 360;
    if (end <= start) end += 360;

    const points = [[center.lat, center.lng]];
    for (let angle = start; angle <= end; angle += stepDeg) {
      const point = destinationPoint(center, radius, bearingRefDeg + angle);
      points.push([point.lat, point.lng]);
    }

    // Garante o ângulo final exato: o passo de 2° quase nunca cai nele.
    const last = destinationPoint(center, radius, bearingRefDeg + end);
    points.push([last.lat, last.lng]);

    return points;
  }

  // Data de instalação: o campo é texto (dd/mm/aaaa hh:mm), sem valor
  // pré-preenchido; o estado guarda "YYYY-MM-DDTHH:mm", o mesmo formato que a
  // tela de edição lê.
  function isoToBrDateTime(iso) {
    const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : "";
  }

  function brDateTimeToIso(text) {
    const m = String(text || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
    if (!m) return "";
    const [, day, month, year, hour, minute] = m;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return "";
    if (Number(hour) > 23 || Number(minute) > 59) return "";
    return `${year}-${month}-${day}T${hour}:${minute}`;
  }

  // Teste de conexão (SIMULADO no mockup). Na produção, a Finapp API valida o
  // ID da instalação e a chave de acesso. Aqui valem: ID 123 com chave 123
  // (valores de teste) ou o ID no formato CF-000000 com chave de 8 ou mais
  // caracteres.
  const SIMULATED_ID_FORMAT = /^CF-\d{6}$/i;

  function simulateConnectionTest(id, key) {
    return new Promise((resolve) => {
      const testValues = id === "123" && String(key) === "123";
      setTimeout(() => resolve(testValues || (SIMULATED_ID_FORMAT.test(id) && String(key).length >= 8)), 1200);
    });
  }

  // Liga o ícone de teste de conexão (à frente do campo Chave de acesso).
  // Habilita depois que ID e chave são preenchidos. O resultado aparece na cor
  // e no tooltip do ícone: verde validado, vermelho inválido. No mockup o
  // resultado NÃO bloqueia o avanço. Compartilhado com a tela de edição.
  function bindConnectionTest({ idInput, keyInput, button }) {
    if (!idInput || !keyInput || !button) return;
    const icon = button.querySelector("i");
    const label = t("Testar conexão");
    const setState = (state, text) => {
      button.classList.remove("is-ok", "is-error", "is-busy");
      if (state) button.classList.add(`is-${state}`);
      if (icon) icon.className = state === "busy" ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-wifi";
      button.title = text || label;
      button.setAttribute("aria-label", text || label);
    };
    const refresh = () => {
      button.disabled = !(idInput.value.trim() && keyInput.value.trim());
      setState("", "");
    };

    [idInput, keyInput].forEach((el) => el.addEventListener("input", refresh));

    button.addEventListener("click", async () => {
      const tested = `${idInput.value.trim()}|${keyInput.value.trim()}`;
      button.disabled = true;
      setState("busy", t("Testando conexão..."));
      const ok = await simulateConnectionTest(idInput.value.trim(), keyInput.value.trim());
      if (`${idInput.value.trim()}|${keyInput.value.trim()}` !== tested) { refresh(); return; }
      setState(ok ? "ok" : "error", ok
        ? t("Conexão validada.")
        : t("ID da instalação ou Chave de acesso inválidos. Confira a etiqueta da caixa do Cosmofield."));
      button.disabled = false;
    });

    refresh();
  }

  // Máscara dd/mm/aaaa hh:mm enquanto o usuário digita.
  function bindDateTimeMask(input) {
    input.addEventListener("input", () => {
      const digits = input.value.replace(/\D/g, "").slice(0, 12);
      let out = "";
      for (let i = 0; i < digits.length; i++) {
        if (i === 2 || i === 4) out += "/";
        if (i === 8) out += " ";
        if (i === 10) out += ":";
        out += digits[i];
      }
      input.value = out;
    });
  }

  // Os quatro parâmetros de solo são percentuais opcionais. Ficam num só
  // lugar porque leitura, validação e render precisam da mesma lista.
  // Allen, R.G., Pereira, L.S., Raes, D. & Smith, M. (1998). Crop
  // evapotranspiration: guidelines for computing crop water requirements.
  // FAO Irrigation and Drainage Paper 56. FAO, Roma. ISBN 92-5-104219-5.
  // https://www.fao.org/4/x0490e/x0490e0e.htm
  //
  // Tabela 22: p é a fração da água disponível que a cultura tolera perder
  // antes do estresse hídrico. O gatilho é o que sobra — abaixo dele a
  // planta sofre — então trigger = (1 - p)*100. Valores para ETc de 5 mm/dia;
  // a própria tabela prevê ajuste conforme a demanda atmosférica, daí o
  // campo seguir editável.
  const CROP_GROUPS = [
    { group: "Grandes culturas", crops: [
      ["Soja", 0.50], ["Milho", 0.55], ["Algodão", 0.65], ["Trigo", 0.55],
      ["Sorgo", 0.55], ["Arroz", 0.20], ["Feijão", 0.45], ["Cevada", 0.55],
      ["Girassol", 0.45], ["Canola", 0.60], ["Amendoim", 0.50],
      ["Cana-de-açúcar", 0.65],
    ]},
    { group: "Hortaliças", crops: [
      ["Tomate", 0.40], ["Batata", 0.35], ["Cebola", 0.30], ["Alho", 0.30],
      ["Cenoura", 0.35], ["Alface", 0.30], ["Repolho", 0.45],
      ["Pimentão", 0.30], ["Melancia", 0.40], ["Melão", 0.40],
    ]},
    { group: "Fruteiras e perenes", crops: [
      ["Café", 0.40], ["Citros", 0.50], ["Banana", 0.35],
      ["Maçã", 0.50], ["Cereja", 0.50], ["Pera", 0.50], ["Uva de mesa", 0.35],
      ["Uva para vinho", 0.45], ["Abacate", 0.70], ["Oliveira", 0.65],
      ["Morango", 0.20],
    ]},
    { group: "Forrageiras", crops: [
      ["Pastagem", 0.60], ["Alfafa", 0.55], ["Grama-bermuda", 0.55],
      ["Capim-sudão", 0.55],
    ]},
  ];

  // Índice plano nome -> p, para resolver o gatilho sem varrer os grupos.
  const CROP_DEPLETION = Object.fromEntries(
    CROP_GROUPS.flatMap((entry) => entry.crops)
  );

  const triggerForCrop = (crop) => {
    const p = CROP_DEPLETION[crop];
    return p === undefined ? null : Math.round((1 - p) * 100);
  };

  // Monta <option>s garantindo que o valor atual esteja na lista, mesmo que
  // a fazenda use um fuso/país fora do catálogo.
  function optionList(values, selected) {
    const list = selected && !values.includes(selected) ? [selected, ...values] : values;
    return list
      .map((v) => `<option value="${escapeHtml(v)}" ${v === selected ? "selected" : ""}>${escapeHtml(v)}</option>`)
      .join("");
  }

  // Equipamentos de irrigação da fazenda aos quais a sonda pode se vincular.
  // IcGetPivotList() devolve só smart_connect — aqui entram também
  // SmartTouch, LineStar e carretéis, que igualmente irrigam uma área.
  const LINKABLE_TYPES = new Set(["smart_connect", "smarttouch", "centerstar", "linestar", "rainstar"]);

  function irrigationEquipments() {
    const farm = window.IcFarmGetActive?.() || window.icFarmData || window.IcFarmActive || null;
    const equipments = Array.isArray(farm?.equipments)
      ? farm.equipments
      : (window.IcGetPivotList?.() || []);
    return equipments.filter((item) => LINKABLE_TYPES.has(item?.type));
  }

  // Pluviômetros cadastrados na fazenda ativa. A sonda mede chuva por conta
  // própria, mas um pluviômetro dedicado costuma ser mais confiável, então
  // a fonte de chuva é escolhida no cadastro.
  function rainGaugeEquipments() {
    const farm = window.IcFarmGetActive?.() || window.icFarmData || window.IcFarmActive || null;
    const equipments = Array.isArray(farm?.equipments) ? farm.equipments : [];
    return equipments.filter((item) => item?.type === "pluviometro");
  }

  // O pluviômetro guarda o nome em data.nome; os demais equipamentos usam
  // name/deviceName. Resolve os dois para não depender do tipo.
  function equipmentName(item, fallbackPrefix) {
    return item?.name
      || item?.deviceName
      || item?.data?.nome
      || `${fallbackPrefix} ${String(item?.id || "").slice(0, 4)}`;
  }

  // Campos decimais exibem sempre duas casas, inclusive quando o valor é
  // redondo. Normaliza ao sair do campo, para o usuário ver o mesmo formato
  // que a tela de configurações mostra.
  function fmtDecimal(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    const num = Number(raw.replace(",", "."));
    return Number.isFinite(num) ? num.toFixed(2) : raw;
  }

  function bindDecimalFields(container) {
    container.querySelectorAll('input[inputmode="decimal"]').forEach((input) => {
      if (input.dataset.decimalBound) return;
      input.dataset.decimalBound = "1";
      input.addEventListener("blur", () => {
        const formatted = fmtDecimal(input.value);
        if (formatted) input.value = formatted;
      });
    });
  }

  // Valor sentinela do select de chuva: a própria sonda é a fonte.
  const OWN_RAIN_GAUGE = "__own__";

  // Chuva estimada pela mesma weather API da fazenda (Open-Meteo), só que
  // consultada na coordenada da sonda em vez da sede.
  const WEATHER_API_RAIN = "__weather__";

  // Sem fonte de chuva: a plataforma não registra chuva automaticamente (o
  // usuário ainda pode lançar chuva como evento no calendário).
  const NO_RAIN = "__norain__";

  // Sentinela de "nada escolhido". Precisa ser diferente de "" para o
  // navegador não pintar o select inteiro como campo vazio; vira "" na
  // leitura.
  const NO_SELECTION = "__none__";

  // Marca o select enquanto nada foi escolhido, para o texto ficar cinza
  // como placeholder e virar preto após a escolha.
  function bindPlaceholderState(container, id) {
    const select = container.querySelector(`#${id}`);
    if (!select) return;
    const sync = () => select.classList.toggle("is-placeholder", select.value === NO_SELECTION);
    sync();
    select.addEventListener("change", sync);
  }

  // Países com operação Irricontrol; "Outro" cobre o resto sem inflar a lista.
  const COUNTRIES = [
    "Brasil", "Argentina", "Paraguai", "Uruguai", "Bolívia", "Chile",
    "Colômbia", "Peru", "México", "Estados Unidos", "Portugal", "Espanha", "Outro",
  ];

  // Código ISO do país (Nominatim) -> opção da lista. O nome do país vem no
  // idioma do navegador e nem sempre bate com a lista; o código sempre bate.
  const COUNTRY_BY_CODE = {
    br: "Brasil", ar: "Argentina", py: "Paraguai", uy: "Uruguai", bo: "Bolívia",
    cl: "Chile", co: "Colômbia", pe: "Peru", mx: "México", us: "Estados Unidos",
    pt: "Portugal", es: "Espanha",
  };

  // Fuso padrão do país, usado no preenchimento automático depois da
  // localização. O usuário pode trocar.
  const COUNTRY_TIMEZONE = {
    br: "America/Sao_Paulo", ar: "America/Argentina/Buenos_Aires", py: "America/Asuncion",
    uy: "America/Montevideo", bo: "America/La_Paz", cl: "America/Santiago",
    co: "America/Bogota", pe: "America/Lima", mx: "America/Mexico_City",
    us: "America/Chicago", pt: "Europe/Lisbon", es: "Europe/Madrid",
  };

  // Fusos usados nas regiões atendidas.
  const TIMEZONES = [
    "America/Sao_Paulo", "America/Bahia", "America/Fortaleza", "America/Recife",
    "America/Belem", "America/Manaus", "America/Cuiaba", "America/Campo_Grande",
    "America/Porto_Velho", "America/Boa_Vista", "America/Rio_Branco", "America/Noronha",
    "America/Argentina/Buenos_Aires", "America/Asuncion", "America/Montevideo",
    "America/La_Paz", "America/Santiago", "America/Bogota", "America/Lima",
    "America/Mexico_City", "America/Chicago", "America/Los_Angeles", "America/New_York",
    "Europe/Lisbon", "Europe/Madrid", "UTC",
  ];

  // Presets de textura de solo. PWP e FC em % volumétrico; TAW é a água
  // disponível (FC - PWP) em mm por metro de solo, mostrada como referência.
  // Fontes:
  //   Ratliff, Ritchie & Cassel (1983), Soil Sci. Soc. Am. J. 47(4):770-775
  //     https://doi.org/10.2136/sssaj1983.03615995004700040032x
  //   Hanson, Orloff & Peters (2000), California Agriculture 54(3):38-42
  //     https://doi.org/10.3733/ca.v054n03p38
  const SOIL_PRESETS = [
    { key: "clay", label: "Argiloso", wp: 24, fc: 37.5, taw: 135 },
    { key: "silty_clay", label: "Argilossiltoso", wp: 22.5, fc: 36.5, taw: 140 },
    { key: "silty_clay_loam", label: "Franco-argilossiltoso", wp: 20, fc: 34.5, taw: 145 },
    { key: "silt", label: "Silte", wp: 12, fc: 34, taw: 220 },
    { key: "clay_loam", label: "Franco-argiloso", wp: 18, fc: 32, taw: 140 },
    { key: "silt_loam", label: "Franco-siltoso", wp: 13.5, fc: 30, taw: 165 },
    { key: "sandy_clay_loam", label: "Franco-argiloarenoso", wp: 16.5, fc: 27.5, taw: 110 },
    { key: "loam", label: "Franco", wp: 12.5, fc: 25, taw: 125 },
    { key: "sandy_loam", label: "Franco-arenoso", wp: 10, fc: 22.5, taw: 125 },
    { key: "loamy_sand", label: "Areia franca", wp: 5, fc: 17.5, taw: 125 },
    { key: "sand", label: "Areia", wp: 3.5, fc: 11, taw: 75 },
    // A fonte não traz valores para a textura argiloarenosa; o PRD define
    // 32.0 e 18.0 para ela.
    { key: "sandy_clay", label: "Argiloarenoso", wp: 18, fc: 32, taw: 140 },
  ];

  // Valor do seletor quando o usuário digita CC e PM à mão.
  const SOIL_MANUAL = "__manual__";

  const SOIL_FIELDS = [
    {
      key: "fieldCapacity", id: "cfFieldCapacity",
      label: "Capacidade de campo", unit: "% vol.", placeholder: "Ex: 31",
      tip: "Conteúdo volumétrico de água retido pelo solo após a drenagem livre, correspondente ao potencial matricial de -10 a -33 kPa conforme a textura. Define o limite superior da água disponível e o valor até o qual a lâmina recomendada repõe o perfil.",
    },
    {
      key: "wiltingPoint", id: "cfWiltingPoint",
      label: "Ponto de murcha permanente", unit: "% vol.", placeholder: "Ex: 15",
      tip: "Conteúdo volumétrico de água retido a -1500 kPa, no qual a força de retenção do solo supera a capacidade de absorção radicular. Define o limite inferior da água disponível.",
    },
    {
      key: "targetIrrigation", id: "cfTargetIrrigation",
      label: "Umidade alvo", unit: "%", placeholder: "Ex: 100",
      tip: "Percentual da água disponível que a irrigação deve repor. Com 100% a lâmina recomendada leva o solo de volta à capacidade de campo.",
    },
    {
      key: "triggerIrrigation", id: "cfTriggerIrrigation",
      label: "Umidade gatilho", unit: "%", placeholder: "Ex: 50",
      tip: "Percentual da água disponível em que a irrigação passa a ser recomendada. Abaixo desse ponto a sonda entra em alerta, então o manejo procura nunca deixar a umidade cair além dele. Escolher a cultura sugere um valor a partir do fator de depleção do FAO 56, que segue editável.",
    },
  ];

  window.IcEquipamentos.cosmofield = {
    label: "Cosmofield",

    // Data de instalação (dd/mm/aaaa hh:mm), compartilhada com a edição.
    isoToBrDateTime,
    brDateTimeToIso,
    bindDateTimeMask,
    bindConnectionTest,

    // Catálogos compartilhados com a tela de configurações, para que as duas
    // telas ofereçam exatamente as mesmas opções e sugestões.
    CROP_GROUPS,
    SOIL_PRESETS,
    SOIL_MANUAL,
    triggerForCrop,

    // =================
    // STEP 2 — Identificação
    // =================
    renderStep2(container, state) {
      const name = state.name ?? "";
      const installationId = state.installationId ?? "";
      const accessKey = state.accessKey ?? "";
      // Sem pré-preenchimento: o campo mostra só um exemplo de texto.
      const firstInstall = isoToBrDateTime(state.firstInstallAt);

      container.innerHTML = `
        <div class="equip-page equip-page--link">
          <div class="equip-page__title"></div>
          <div class="equip-page__sub"></div>

          <div class="equip-form">
            <div class="equip-field">
              <label class="equip-label" for="cfName"><span class="equip-required">*</span>${t("Nome do equipamento")}</label>
              <input class="equip-input" id="cfName" placeholder="Ex: Cosmofield 01" value="${escapeHtml(name)}" />
            </div>

            <div class="equip-form__row">
              <div class="equip-field">
                <label class="equip-label" for="cfInstallationId"><span class="equip-required">*</span>${t("ID da instalação")} <span class="edit-panel__tooltip-icon" data-tooltip="${t("Você encontra este dado no manual e na etiqueta da caixa do Cosmofield instalado.")}"><i class="fa-regular fa-circle-question"></i></span></label>
                <input class="equip-input" id="cfInstallationId" placeholder="Ex: CF-001234" value="${escapeHtml(installationId)}" />
              </div>

              <div class="equip-field">
                <label class="equip-label" for="cfAccessKey"><span class="equip-required">*</span>${t("Chave de acesso")} <span class="edit-panel__tooltip-icon" data-tooltip="${t("Você encontra este dado no manual e na etiqueta da caixa do Cosmofield instalado.")}"><i class="fa-regular fa-circle-question"></i></span></label>
                <div class="rp-loc__row rp-loc__row--compact">
                  <div class="rp-loc__input">
                    <input class="equip-input" id="cfAccessKey" placeholder="Ex: aw12!fg4SYufdGg3@1ssD" value="${escapeHtml(accessKey)}" />
                  </div>
                  <button class="equip-btn btn btn--outline rp-loc__btn cf-conn-btn" type="button" id="cfTestConn" title="${t("Testar conexão")}" aria-label="${t("Testar conexão")}">
                    <i class="fa-solid fa-wifi" aria-hidden="true"></i>
                  </button>
                </div>
              </div>
            </div>

            <div class="equip-field">
              <label class="equip-label" for="cfFirstInstall"><span class="equip-required">*</span>${t("Data de instalação")}</label>
              <input class="equip-input" id="cfFirstInstall" type="text" inputmode="numeric" maxlength="16" placeholder="Ex: 30/10/2026 09:53" value="${escapeHtml(firstInstall)}" />
            </div>
          </div>
        </div>
      `;

      bindDateTimeMask(container.querySelector("#cfFirstInstall"));
      bindConnectionTest({
        idInput: container.querySelector("#cfInstallationId"),
        keyInput: container.querySelector("#cfAccessKey"),
        button: container.querySelector("#cfTestConn"),
      });
    },

    readStep2(container) {
      return {
        name: container.querySelector("#cfName")?.value?.trim() || "",
        installationId: container.querySelector("#cfInstallationId")?.value?.trim() || "",
        accessKey: container.querySelector("#cfAccessKey")?.value?.trim() || "",
        firstInstallAt: brDateTimeToIso(container.querySelector("#cfFirstInstall")?.value || ""),
      };
    },

    validateStep2(data) {
      if (!data.name) return { ok: false, msg: t("Informe o Nome do equipamento.") };
      if (!data.installationId) return { ok: false, msg: t("Informe o ID da instalação.") };
      if (!data.accessKey) return { ok: false, msg: t("Informe a Chave de acesso.") };
      if (!data.firstInstallAt) return { ok: false, msg: t("Informe a Data de instalação (dd/mm/aaaa hh:mm).") };
      return { ok: true, msg: "" };
    },

    // =================
    // STEP 3 — Localização
    // =================
    renderStep3(container, state) {
      const loc = state.loc ?? "";

      container.innerHTML = `
        <div class="equip-page equip-page--link">
          <div class="equip-page__title"></div>
          <div class="equip-page__sub"></div>

          <div class="equip-form">
            <div class="equip-field">
              <label class="equip-label" for="cfLoc"><span class="equip-required">*</span>${t("Localização do equipamento")} <span class="edit-panel__tooltip-icon" data-tooltip="${t("Coordenada onde a sonda foi instalada. Clique no mapa ou arraste o pino para posicionar, ou digite a latitude e a longitude.")}"><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="rp-loc__row">
                <div class="rp-loc__input">
                  <input class="equip-input" id="cfLoc" placeholder="Ex: -23.550520, -46.633308" value="${escapeHtml(loc)}" />
                </div>
                <button class="equip-btn btn btn--outline rp-loc__btn" type="button" data-action="cf-get-loc">
                  <i class="fa-solid fa-location-dot" aria-hidden="true" style="color:#22c55e;"></i> ${t("Obter localização")}
                </button>
              </div>
            </div>

            <div class="equip-form__row equip-form__row--quad">
              <div class="equip-field">
                <label class="equip-label" for="cfAddress"><span class="equip-required">*</span>${t("Endereço")}</label>
                <input class="equip-input" id="cfAddress" placeholder="Ex: Barreiras, Bahia, Brasil" value="${escapeHtml(state.address ?? "")}" />
              </div>

              <div class="equip-field">
                <label class="equip-label" for="cfCountry"><span class="equip-required">*</span>${t("País")}</label>
                <select class="equip-input" id="cfCountry">
                  <option value="">${t("Selecione")}</option>
                  ${optionList(COUNTRIES, state.country ?? "")}
                </select>
              </div>

              <div class="equip-field">
                <label class="equip-label" for="cfTimezone"><span class="equip-required">*</span>${t("Fuso horário")}</label>
                <select class="equip-input" id="cfTimezone">
                  <option value="">${t("Selecione")}</option>
                  ${optionList(TIMEZONES, state.timezone ?? "")}
                </select>
              </div>

              <div class="equip-field">
                <label class="equip-label" for="cfAltitude"><span class="equip-required">*</span>${t("Altitude")}</label>
                <div class="rp-loc__row rp-loc__row--compact">
                  <div class="rp-loc__input">
                    <div class="sc-input-group">
                      <input class="equip-input sc-input" id="cfAltitude" type="text" inputmode="decimal" placeholder="Ex: 39" value="${escapeHtml(state.altitude ?? "")}" />
                      <span class="sc-input-suffix">m</span>
                    </div>
                  </div>
                  <button class="equip-btn btn btn--outline rp-loc__btn" type="button" data-action="cf-calc-alt" title="${t("Calcular")}">
                    <i class="fa-solid fa-mountain" aria-hidden="true" style="color:#22c55e;"></i>
                  </button>
                </div>
              </div>
            </div>

            <div id="cfMiniMap" class="equip-mini-map equip-mini-map--compact"></div>
          </div>
        </div>
      `;

      this.initMiniMap(container, state);
      bindDecimalFields(container);

    },

    // Contorno dos equipamentos de irrigação da fazenda, com o nome no
    // centro. Serve só pra orientar quem está posicionando a sonda: são
    // puramente demonstrativos — sem clique, hover, tooltip ou foco.
    drawIrrigationOutlines(miniMap) {
      // Lê a fazenda viva (mesma fonte do mapa da visão geral). O helper
      // getActiveFarmEquipments() só olha o localStorage, então devolvia
      // vazio quando a fazenda vem da API.
      const farm = window.IcFarmGetActive?.() || window.icFarmData || window.IcFarmActive || null;
      const equipments = Array.isArray(farm?.equipments)
        ? farm.equipments
        : (window.IcFarm?.getActiveFarmEquipments?.() || []);
      if (!equipments.length) return;

      const SHAPE = {
        interactive: false,
        color: "#ffffff",
        weight: 1.5,
        opacity: 0.85,
        fill: false,
        dashArray: "4 4",
      };

      const label = (lat, lng, name) => {
        L.marker([lat, lng], {
          interactive: false,
          keyboard: false,
          icon: L.divIcon({
            className: "cf-pivot-label",
            html: `<span>${escapeHtml(name)}</span>`,
            // Box de largura fixa ancorado no próprio meio: o nome fica
            // centrado no eixo do equipamento nos dois sentidos.
            iconSize: [120, 16],
            iconAnchor: [60, 8],
          }),
        }).addTo(miniMap);
      };

      for (const equip of equipments) {
        const data = equip?.data || {};
        const name = equip.name || "Equipamento";

        // LineStar: trecho A→B com largura, desenhado como corredor.
        if (equip.type === "linestar") {
          const latA = Number(data.latA);
          const lngA = Number(data.lngA);
          const latB = Number(data.latB);
          const lngB = Number(data.lngB);
          if (![latA, lngA, latB, lngB].every(Number.isFinite)) continue;

          const ptA = { lat: latA, lng: lngA };
          const ptB = { lat: latB, lng: lngB };
          const width = Number(data.width);

          if (Number.isFinite(width) && width > 0) {
            const bearing = bearingDegBetween(ptA, ptB);
            const half = width / 2;
            const corner = (origin, side) => destinationPoint(origin, half, bearing + side * 90);
            const aL = corner(ptA, -1);
            const aR = corner(ptA, 1);
            const bL = corner(ptB, -1);
            const bR = corner(ptB, 1);
            L.polygon(
              [[aL.lat, aL.lng], [bL.lat, bL.lng], [bR.lat, bR.lng], [aR.lat, aR.lng]],
              SHAPE
            ).addTo(miniMap);
          } else {
            L.polyline([[latA, lngA], [latB, lngB]], SHAPE).addTo(miniMap);
          }

          label((latA + latB) / 2, (lngA + lngB) / 2, name);
          continue;
        }

        // Pivôs e carretéis: círculo de centro + raio. O centro mora em
        // centerLat/centerLng; lat/lng só existe em parte dos registros, e
        // os cadastros antigos guardam "lat, lng" no campo center.
        const parsed = parseLatLng(data.center || "");
        const lat = Number(data.centerLat ?? data.lat ?? parsed?.lat);
        const lng = Number(data.centerLng ?? data.lng ?? parsed?.lng);
        const radius = Number(data.radius);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        if (lat === 0 && lng === 0) continue;
        if (!Number.isFinite(radius) || radius <= 0) continue;

        // Setorial: desenha só a fatia varrida, como na visão geral. O
        // círculo completo daria a impressão de uma área que o pivô não cobre.
        const isSector = data.isSector === true || data.isSector === "true";
        const refLat = Number(data.refLat);
        const refLng = Number(data.refLng);
        const bearingRefDeg = (Number.isFinite(refLat) && Number.isFinite(refLng))
          ? bearingDegBetween({ lat, lng }, { lat: refLat, lng: refLng })
          : 0;

        if (isSector) {
          L.polygon(
            sectorOutline({ lat, lng }, radius, bearingRefDeg, data.startAngle, data.endAngle),
            SHAPE
          ).addTo(miniMap);
        } else {
          L.circle([lat, lng], { ...SHAPE, radius }).addTo(miniMap);
        }

        label(lat, lng, name);
      }
    },

    initMiniMap(container, state) {
      if (!window.L) return;

      const mapEl = container.querySelector("#cfMiniMap");
      const inputLoc = container.querySelector("#cfLoc");
      if (!mapEl || !inputLoc) return;

      if (state._miniMap) {
        try {
          state._miniMap.remove();
        } catch (e) { }
        state._miniMap = null;
      }

      // Abre na área da fazenda ativa, não numa coordenada fixa: quem está
      // cadastrando o equipamento já está olhando a própria lavoura.
      // getActiveFarmView() traz a cascata de fallbacks (sede -> central ->
      // primeiro pivô -> primeiro equipamento -> Brasil).
      const farmView = window.Cad?.data?.getActiveFarmView?.();
      let center = farmView?.center || [-16.767, -47.613];
      let zoom = farmView?.zoom || 14;

      // Localização já escolhida tem precedência: volta onde o usuário parou.
      if (typeof state.lat === "number" && typeof state.lng === "number") {
        center = [state.lat, state.lng];
        zoom = 17;
      }

      const miniMap = L.map(mapEl, { zoomControl: false }).setView(center, zoom);

      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, attribution: "Tiles © Esri" }
      ).addTo(miniMap);

      L.tileLayer(
        "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, opacity: 0.85 }
      ).addTo(miniMap);

      this.drawIrrigationOutlines(miniMap);

      // O mapa abre focado na fazenda, sem pino. O pino só aparece depois
      // que o usuário clica no mapa, digita a coordenada ou usa "Obter
      // Localização". Arrastável: clicar posiciona grosso, arrastar ajusta
      // fino sem precisar acertar o ponto exato no clique.
      let marker = null;
      const placeMarker = (lat, lng) => {
        if (marker) {
          marker.setLatLng([lat, lng]);
          return;
        }
        marker = L.marker([lat, lng], { icon: pinIcon(), draggable: true, autoPan: true }).addTo(miniMap);
        // Só no dragend: durante o arraste seriam dezenas de chamadas ao
        // Nominatim para posições que o usuário nem escolheu.
        marker.on("dragend", () => {
          const { lat: dragLat, lng: dragLng } = marker.getLatLng();
          applyLatLng(dragLat, dragLng);
        });
      };

      // Voltando ao step com uma localização já escolhida, o pino reaparece.
      if (typeof state.lat === "number" && typeof state.lng === "number") {
        placeMarker(state.lat, state.lng);
      }

      const applyLatLng = (lat, lng) => {
        placeMarker(lat, lng);

        const txt = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        inputLoc.value = txt;

        state.loc = txt;
        state.lat = lat;
        state.lng = lng;
        state._fillAddress?.(lat, lng);
      };

      miniMap.on("click", (e) => applyLatLng(e.latlng.lat, e.latlng.lng));

      // Coordenada digitada: o pino acompanha o campo enquanto o usuário
      // digita; ao sair do campo o texto é normalizado para 6 casas decimais
      // (mesmo formato do clique no mapa e do "Obter localização").
      inputLoc.addEventListener("input", () => {
        const point = parseLatLng(inputLoc.value || "");
        if (!point) return;
        placeMarker(point.lat, point.lng);
        miniMap.panTo([point.lat, point.lng]);
        state.lat = point.lat;
        state.lng = point.lng;
      });
      inputLoc.addEventListener("change", () => {
        const point = parseLatLng(inputLoc.value || "");
        if (point) applyLatLng(point.lat, point.lng);
      });

      state._miniMap = miniMap;
      setTimeout(() => miniMap.invalidateSize(), 120);

      // Endereço, país, fuso e altitude nascem vazios e são preenchidos a
      // partir da coordenada (Nominatim e Open-Elevation) depois que o
      // usuário informa a localização. Cada campo só é preenchido quando está
      // vazio ou quando foi o próprio preenchimento automático que o
      // preencheu: nunca sobrescreve o que o usuário digitou.
      const addressInput = container.querySelector("#cfAddress");
      const countryEl = container.querySelector("#cfCountry");
      const timezoneEl = container.querySelector("#cfTimezone");
      const altitudeEl = container.querySelector("#cfAltitude");
      const canAutofill = (el) => el && (!el.value.trim() || el.dataset.autofilled === "true");
      const autofill = (el, value, key) => {
        if (!canAutofill(el) || value === undefined || value === null || value === "") return;
        el.value = value;
        el.dataset.autofilled = "true";
        state[key] = el.value;
      };

      // Fuso horário pela coordenada (Open-Meteo, a mesma API de clima da
      // plataforma). Se o fuso não estiver na lista, entra como opção.
      const applyTimezone = (zone, fallback = false) => {
        if (!timezoneEl || !zone) return;
        // O fuso do país é só plano B: não sobrescreve o que veio da coordenada.
        if (fallback && timezoneEl.dataset.tzSource === "coordinate") return;
        if (!fallback) timezoneEl.dataset.tzSource = "coordinate";
        if (canAutofill(timezoneEl) && !Array.from(timezoneEl.options).some((option) => option.value === zone)) {
          const option = document.createElement("option");
          option.value = zone;
          option.textContent = zone;
          timezoneEl.appendChild(option);
        }
        autofill(timezoneEl, zone, "timezone");
      };

      const fillAddress = (lat, lng) => {
        if (!addressInput) return;

        if (canAutofill(timezoneEl)) {
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m&timezone=auto`)
            .then((response) => response.json())
            .then((payload) => applyTimezone(payload?.timezone))
            .catch(() => { });
        }

        // Altitude pela coordenada (arredondada em metros).
        if (canAutofill(altitudeEl)) {
          fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`)
            .then((response) => response.json())
            .then((payload) => {
              const elevation = payload?.results?.[0]?.elevation;
              if (Number.isFinite(elevation)) autofill(altitudeEl, String(Math.round(elevation)), "altitude");
            })
            .catch(() => { });
        }

        fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10`)
          .then((response) => response.json())
          .then((payload) => {
            const a = payload?.address || {};
            const parts = [
              a.city || a.town || a.village || a.municipality || a.county,
              a.state,
              a.country,
            ].filter(Boolean);
            if (!parts.length) return;
            autofill(addressInput, parts.join(", "), "address");

            if (a.country_code || a.country) {
              const code = String(a.country_code || "").toLowerCase();
              autofill(countryEl, COUNTRY_BY_CODE[code] || "Outro", "country");
              // Plano B: fuso padrão do país, caso a consulta pela coordenada
              // não responda.
              applyTimezone(COUNTRY_TIMEZONE[code], true);
            }
          })
          .catch(() => { });
      };

      // Digitar ou escolher manualmente desliga o preenchimento automático.
      [addressInput, countryEl, timezoneEl, altitudeEl].forEach((el) => {
        el?.addEventListener("input", () => { el.dataset.autofilled = "false"; });
      });

      state._fillAddress = fillAddress;

      // Botão "Calcular" altitude — usa a API pública Open-Elevation a partir
      // das coordenadas do formulário; sem elas, tenta o GPS do dispositivo.
      const altBtn = container.querySelector('[data-action="cf-calc-alt"]');
      const altInput = container.querySelector("#cfAltitude");
      if (altBtn && altInput) {
        altBtn.addEventListener("click", async () => {
          const fromField = parseLatLng(inputLoc.value || "");
          const point = fromField || (state.lat != null ? { lat: state.lat, lng: state.lng } : null);

          const resolve = (lat, lng) => {
            altBtn.disabled = true;
            fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`)
              .then((response) => response.json())
              .then((payload) => {
                const elevation = payload?.results?.[0]?.elevation;
                if (Number.isFinite(elevation)) {
                  altInput.value = Math.round(elevation);
                  state.altitude = altInput.value;
                }
              })
              .catch(() => { })
              .finally(() => { altBtn.disabled = false; });
          };

          if (point) {
            resolve(point.lat, point.lng);
          } else if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (pos) => resolve(pos.coords.latitude, pos.coords.longitude),
              () => { },
              { enableHighAccuracy: true, timeout: 8000 }
            );
          }
        });
      }

      // Botão "Obter localização" — usa o GPS do dispositivo
      const locBtn = container.querySelector('[data-action="cf-get-loc"]');
      if (locBtn && navigator.geolocation) {
        locBtn.addEventListener("click", () => {
          locBtn.disabled = true;
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude, longitude } = pos.coords;
              placeMarker(latitude, longitude);
              miniMap.setView([latitude, longitude], 17);

              const txt = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
              inputLoc.value = txt;
              state.loc = txt;
              state.lat = latitude;
              state.lng = longitude;
              state._fillAddress?.(latitude, longitude);
              locBtn.disabled = false;
            },
            () => { locBtn.disabled = false; },
            { enableHighAccuracy: true, timeout: 8000 }
          );
        });
      }
    },

    readStep3(container) {
      const loc = container.querySelector("#cfLoc")?.value?.trim() || "";

      const parsed = parseLatLng(loc);

      return {
        address: container.querySelector("#cfAddress")?.value?.trim() || "",
        country: container.querySelector("#cfCountry")?.value?.trim() || "",
        timezone: container.querySelector("#cfTimezone")?.value?.trim() || "",
        altitude: container.querySelector("#cfAltitude")?.value?.trim() || "",
        loc,
        lat: parsed?.lat ?? null,
        lng: parsed?.lng ?? null,
      };
    },

    validateStep3(data) {
      if (data.lat === null || data.lng === null) {
        return { ok: false, msg: t("Informe uma Localização válida (Latitude, Longitude) ou clique no mapa.") };
      }
      if (!data.address) return { ok: false, msg: t("Informe o Endereço.") };
      if (!data.country) return { ok: false, msg: t("Informe o País.") };
      if (!data.timezone) return { ok: false, msg: t("Informe o Fuso horário.") };
      if (!data.altitude) return { ok: false, msg: t("Informe a Altitude.") };
      if (!Number.isFinite(Number(String(data.altitude).replace(",", ".")))) {
        return { ok: false, msg: t("Altitude: informe um número válido.") };
      }
      return { ok: true, msg: "" };
    },

    // =================
    // STEP 4 — Solo (capacidade de campo e ponto de murcha)
    // =================
    renderStep4(container, state) {
      const soilField = (field) => `
            <div class="equip-field">
              <label class="equip-label" for="${field.id}"><span class="equip-required">*</span>${t(field.label)} <span class="edit-panel__tooltip-icon" data-tooltip="${t(field.tip)}"><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="${field.id}" type="text" inputmode="decimal" placeholder="${field.placeholder}" value="${escapeHtml(state[field.key] ?? "")}" />
                <span class="sc-input-suffix">${field.unit}</span>
              </div>
            </div>
      `;

      // Textura conhecida preenche CC e PM com valores de referência; quem
      // tem análise de laboratório escolhe "Definição manual" e digita.
      const presetOptions = SOIL_PRESETS.map((preset) => `
                <option value="${preset.key}" ${state.soilPreset === preset.key ? "selected" : ""}>${t(preset.label)}</option>
      `).join("");

      const presetField = `
            <div class="equip-field">
              <label class="equip-label" for="cfSoilPreset">${t("Textura do solo")} <span class="edit-panel__tooltip-icon" data-tooltip="${t("Escolha a textura para preencher a capacidade de campo e o ponto de murcha com valores de referência, ou use a definição manual para informar os seus próprios valores.")}"><i class="fa-regular fa-circle-question"></i></span></label>
              <select class="equip-input" id="cfSoilPreset">
                <option value="${SOIL_MANUAL}" ${!state.soilPreset || state.soilPreset === SOIL_MANUAL ? "selected" : ""}>${t("Definição manual")}</option>
                ${presetOptions}
              </select>
            </div>
      `;

      // Limites físicos do solo, lado a lado; o aviso da fonte vem depois
      // dos campos, para não separar o seletor de textura deles.
      const fields = `
            ${presetField}

            <div class="equip-form__row">
              ${soilField(SOIL_FIELDS[0])}
              ${soilField(SOIL_FIELDS[1])}
            </div>

            <div class="cf-soil-note" id="cfSoilNote" ${state.soilPreset && state.soilPreset !== SOIL_MANUAL ? "" : "hidden"}>
              <i class="fa-solid fa-circle-info"></i>
              <span>${t("Valores sugeridos por textura, apenas como ponto de partida. Para um direcionamento preciso da área, consulte um técnico local e obtenha a capacidade de campo e o ponto de murcha por análise laboratorial. Os valores podem ser ajustados a qualquer momento nas configurações do equipamento.")}
                <em class="cf-soil-note__src">${t("Fontes:")}
                  <a href="https://doi.org/10.2136/sssaj1983.03615995004700040032x" target="_blank" rel="noopener noreferrer">Ratliff, Ritchie &amp; Cassel (1983), Soil Sci. Soc. Am. J. 47(4):770-775</a>
                  <a href="https://doi.org/10.3733/ca.v054n03p38" target="_blank" rel="noopener noreferrer">Hanson, Orloff &amp; Peters (2000), California Agriculture 54(3):38-42</a>
                </em>
              </span>
            </div>
      `;

      container.innerHTML = `
        <div class="equip-page equip-page--link">
          <div class="equip-page__title"></div>
          <div class="equip-page__sub"></div>

          <div class="equip-form">
            ${fields}
          </div>
        </div>
      `;

      this.bindSoilPreset(container, state);
      bindDecimalFields(container);
    },

    // Liga o seletor de textura aos campos de CC e PM.
    bindSoilPreset(container, state) {
      const select = container.querySelector("#cfSoilPreset");
      const note = container.querySelector("#cfSoilNote");
      const fcInput = container.querySelector("#cfFieldCapacity");
      const wpInput = container.querySelector("#cfWiltingPoint");
      if (!select || !fcInput || !wpInput) return;

      select.addEventListener("change", () => {
        const value = select.value;
        state.soilPreset = value;

        if (value === SOIL_MANUAL) {
          // Definição manual: os campos ficam vazios para o usuário digitar.
          fcInput.value = "";
          wpInput.value = "";
          state.fieldCapacity = "";
          state.wiltingPoint = "";
          if (note) note.hidden = true;
          return;
        }

        const preset = SOIL_PRESETS.find((item) => item.key === value);
        if (!preset) return;

        // Textura sem valores de referência: mantém o aviso, mas deixa os
        // campos para o usuário preencher.
        if (preset.fc === null || preset.wp === null) {
          if (note) note.hidden = false;
          return;
        }

        fcInput.value = String(preset.fc);
        wpInput.value = String(preset.wp);
        state.fieldCapacity = String(preset.fc);
        state.wiltingPoint = String(preset.wp);
        if (note) note.hidden = false;
      });

      // Digitar à mão desfaz o vínculo com a textura escolhida.
      const toManual = () => {
        if (select.value === SOIL_MANUAL) return;
        select.value = SOIL_MANUAL;
        state.soilPreset = SOIL_MANUAL;
        if (note) note.hidden = true;
      };
      fcInput.addEventListener("input", toManual);
      wpInput.addEventListener("input", toManual);
    },

    // =================
    // STEP 5 — Cultura (umidades de manejo e ciclo da cultura)
    // =================
    renderStep5(container, state) {
      const soilField = (field) => `
            <div class="equip-field">
              <label class="equip-label" for="${field.id}"><span class="equip-required">*</span>${t(field.label)} <span class="edit-panel__tooltip-icon" data-tooltip="${t(field.tip)}"><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="${field.id}" type="text" inputmode="decimal" placeholder="${field.placeholder}" value="${escapeHtml(state[field.key] ?? "")}" />
                <span class="sc-input-suffix">${field.unit}</span>
              </div>
            </div>
      `;

      // Alvo e gatilho definem o manejo da cultura, não o solo em si.
      const moistureFields = `
            <div class="equip-form__row">
              ${soilField(SOIL_FIELDS[2])}
              ${soilField(SOIL_FIELDS[3])}
            </div>

            <div class="cf-soil-note" id="cfCropNote" ${state.cropType && CROP_DEPLETION[state.cropType] !== undefined ? "" : "hidden"}>
              <i class="fa-solid fa-circle-info"></i>
              <span>${t("Gatilho sugerido a partir do fator de depleção da cultura, apenas como ponto de partida. Para um direcionamento preciso da área, consulte um técnico local: o valor adequado depende do solo, do clima e do estágio da cultura. Pode ser ajustado a qualquer momento.")}
                <em class="cf-soil-note__src">
                  <a href="https://www.fao.org/4/x0490e/x0490e0e.htm" target="_blank" rel="noopener noreferrer">${t("Allen, Pereira, Raes &amp; Smith (1998), Crop evapotranspiration: guidelines for computing crop water requirements. FAO Irrigation and Drainage Paper 56, Roma")}</a>
                </em>
              </span>
            </div>
      `;
      // Lista simples, sem grupos, na ordem do PRD; "Outro" por último.
      const cropOptions = CROP_GROUPS.flatMap((entry) => entry.crops).map(([crop]) =>
        `<option value="${escapeHtml(crop)}" ${state.cropType === crop ? "selected" : ""}>${escapeHtml(t(crop))}</option>`
      ).join("") + `<option value="Outro" ${state.cropType === "Outro" ? "selected" : ""}>${escapeHtml(t("Outro"))}</option>`;

      // Cultivo: opcional. Serve pra contextualizar a recomendação de
      // irrigação — a mesma umidade pede lâminas diferentes conforme a
      // cultura e o estágio em que ela está.
      const cropField = `
            <div class="equip-field">
              <label class="equip-label" for="cfCropType">${t("Cultura")} <span class="edit-panel__tooltip-icon" data-tooltip="${t("Ao selecionar a cultura, a umidade gatilho é preenchida a partir do fator de depleção p do FAO 56, que é a fração da água disponível que aquela espécie tolera perder sem estresse hídrico. A umidade alvo assume 100%, repondo o perfil até a capacidade de campo. Ambos seguem editáveis.")}"><i class="fa-regular fa-circle-question"></i></span></label>
              <select class="equip-input" id="cfCropType">
                <option value="__none__" ${state.cropType ? "" : "selected"}>${t("Nenhuma (definir depois)")}</option>
                ${cropOptions}
              </select>
            </div>

            <div class="equip-form__row">
              <div class="equip-field">
                <label class="equip-label" for="cfSowingDate">${t("Data de semeadura")} <span class="edit-panel__tooltip-icon" data-tooltip="${t("Início do ciclo da cultura. Serve para recortar o gráfico de umidade pelo período da safra.")}"><i class="fa-regular fa-circle-question"></i></span></label>
                <input class="equip-input" id="cfSowingDate" type="text" data-date-mask placeholder="dd/mm/aaaa" value="${escapeHtml(window.IcDateInput?.isoToBr?.(state.sowingDate) ?? "")}" />
              </div>

              <div class="equip-field">
                <label class="equip-label" for="cfHarvestDate">${t("Data de colheita")} <span class="edit-panel__tooltip-icon" data-tooltip="${t("Fim previsto do ciclo. Junto com a semeadura, delimita a safra no filtro do gráfico.")}"><i class="fa-regular fa-circle-question"></i></span></label>
                <input class="equip-input" id="cfHarvestDate" type="text" data-date-mask placeholder="dd/mm/aaaa" value="${escapeHtml(window.IcDateInput?.isoToBr?.(state.harvestDate) ?? "")}" />
              </div>
            </div>
      `;

      container.innerHTML = `
        <div class="equip-page equip-page--link">
          <div class="equip-page__title"></div>
          <div class="equip-page__sub"></div>

          <div class="equip-form">
            ${cropField}
            ${moistureFields}
          </div>
        </div>
      `;

      bindPlaceholderState(container, "cfCropType");
      bindDecimalFields(container);
      this.bindCropTrigger(container, state);

      // Máscara dd/mm/aaaa: o <input type="date"> nativo desenha o formato
      // do idioma do navegador, que em inglês inverte dia e mês.
      container.querySelectorAll("[data-date-mask]").forEach((input) => {
        window.IcDateInput?.bindDateMask?.(input);
      });
    },

    // Escolher a cultura sugere o gatilho a partir do fator de depleção.
    bindCropTrigger(container, state) {
      const select = container.querySelector("#cfCropType");
      const trigger = container.querySelector("#cfTriggerIrrigation");
      const target = container.querySelector("#cfTargetIrrigation");
      const note = container.querySelector("#cfCropNote");
      if (!select || !trigger) return;

      select.addEventListener("change", () => {
        const suggested = triggerForCrop(select.value);
        if (suggested === null) {
          // "Nenhuma (definir depois)" e "Outro": alvo e gatilho ficam vazios
          // para o usuário digitar.
          trigger.value = "";
          state.triggerIrrigation = "";
          if (target) target.value = "";
          state.targetIrrigation = "";
          if (note) note.hidden = true;
          return;
        }
        trigger.value = String(suggested);
        state.triggerIrrigation = String(suggested);

        // Repor até a capacidade de campo é o padrão do manejo; quem
        // trabalha com déficit controlado ajusta o valor depois.
        if (target) {
          target.value = "100";
          state.targetIrrigation = "100";
        }

        if (note) note.hidden = false;
      });

      // Ajuste manual desfaz a sugestão: o aviso deixa de descrever o valor.
      trigger.addEventListener("input", () => {
        if (note) note.hidden = true;
      });
    },

    // =================
    // STEP 6 — Integração (vínculos com outros equipamentos, opcionais)
    // =================
    renderStep6(container, state) {
      // Vínculo com pivô: opcional. A sonda pode ser instalada solta na
      // lavoura ou associada a um pivô, pra que a leitura de umidade
      // alimente as decisões de irrigação daquele equipamento.
      const pivots = irrigationEquipments();
      const options = pivots.map((pivot) => {
        const name = equipmentName(pivot, t("Pivô"));
        const selected = String(state.linkedPivotId ?? "") === String(pivot.id ?? "") ? "selected" : "";
        return `<option value="${escapeHtml(String(pivot.id ?? ""))}" ${selected}>${escapeHtml(name)}</option>`;
      }).join("");

      const pivotField = `
            <div class="equip-field">
              <label class="equip-label" for="cfLinkedPivot">${t("Vincular a um equipamento")} <span class="edit-panel__tooltip-icon" data-tooltip="${t("Associa a sonda ao equipamento de irrigação desta área. A plataforma mostra a irrigação desse equipamento no gráfico de umidade do solo e no calendário. Não afeta as leituras da sonda.")}"><i class="fa-regular fa-circle-question"></i></span></label>
              <select class="equip-input" id="cfLinkedPivot" ${pivots.length ? "" : "disabled"}>
                <option value="__none__" ${state.linkedPivotId ? "" : "selected"}>${pivots.length ? t("Nenhum (sonda independente)") : t("Nenhum equipamento cadastrado nesta fazenda")}</option>
                ${options}
              </select>
            </div>
      `;

      // Fonte de chuva: opcional. Um único select com o pluviômetro próprio
      // da sonda no topo e, abaixo, os pluviômetros cadastrados na fazenda.
      const gauges = rainGaugeEquipments();
      const gaugeOptions = gauges.map((gauge) => {
        const name = equipmentName(gauge, t("Pluviômetro"));
        const selected = String(state.rainGaugeId ?? "") === String(gauge.id ?? "") ? "selected" : "";
        return `<option value="${escapeHtml(String(gauge.id ?? ""))}" ${selected}>${escapeHtml(name)}</option>`;
      }).join("");

      const rainGaugeField = `
            <div class="equip-field">
              <label class="equip-label" for="cfRainGauge">${t("Fonte de dados de chuva")} <span class="edit-panel__tooltip-icon" data-tooltip="${t("De onde vem a chuva mostrada no gráfico e no calendário: o pluviômetro embutido na própria sonda, um pluviômetro da fazenda ou a estimativa da API de clima para a coordenada da sonda. Não afeta as leituras da sonda.")}"><i class="fa-regular fa-circle-question"></i></span></label>
              <select class="equip-input" id="cfRainGauge">
                <option value="${NO_RAIN}" ${String(state.rainGaugeId ?? NO_RAIN) === NO_RAIN ? "selected" : ""}>${t("Nenhuma (sem dados de chuva)")}</option>
                <option value="${OWN_RAIN_GAUGE}" ${state.rainGaugeId === OWN_RAIN_GAUGE ? "selected" : ""}>${t("Pluviômetro próprio da sonda")}</option>
                <option value="${WEATHER_API_RAIN}" ${state.rainGaugeId === WEATHER_API_RAIN ? "selected" : ""}>${t("Estimativa da API de clima")}</option>
                ${gaugeOptions}
              </select>
            </div>
      `;

      container.innerHTML = `
        <div class="equip-page equip-page--link">
          <div class="equip-page__title"></div>
          <div class="equip-page__sub"></div>

          <div class="equip-form">
            ${pivotField}
            ${rainGaugeField}
          </div>
        </div>
      `;

      bindPlaceholderState(container, "cfLinkedPivot");
    },

    readStep4(container) {
      const data = {};
      for (const field of SOIL_FIELDS.slice(0, 2)) {
        data[field.key] = container.querySelector(`#${field.id}`)?.value?.trim() || "";
      }
      // Guarda a textura escolhida: a tela de configurações mostra de onde
      // vieram os valores.
      data.soilPreset = container.querySelector("#cfSoilPreset")?.value || SOIL_MANUAL;
      return data;
    },

    readStep5(container) {
      const data = {};
      for (const field of SOIL_FIELDS.slice(2)) {
        data[field.key] = container.querySelector(`#${field.id}`)?.value?.trim() || "";
      }

      const rawCropType = container.querySelector("#cfCropType")?.value || "";
      data.cropType = rawCropType === NO_SELECTION ? "" : rawCropType;
      data.sowingDate = window.IcDateInput?.getDateValue?.(container.querySelector("#cfSowingDate")) || "";
      data.harvestDate = window.IcDateInput?.getDateValue?.(container.querySelector("#cfHarvestDate")) || "";

      return data;
    },

    readStep6(container) {
      const data = {};

      const rawLinkedPivotId = container.querySelector("#cfLinkedPivot")?.value || "";
      const linkedPivotId = rawLinkedPivotId === NO_SELECTION ? "" : rawLinkedPivotId;
      data.linkedPivotId = linkedPivotId;

      // Guarda o nome junto: as telas de detalhe/edição mostram o pivô
      // vinculado sem precisar recarregar a lista pra resolver o id.
      const pivots = irrigationEquipments();
      const linked = pivots.find((pivot) => String(pivot.id ?? "") === String(linkedPivotId));
      data.linkedPivotName = linked ? equipmentName(linked, t("Pivô")) : "";

      // Fonte de chuva: o padrão é "Nenhuma". Os sentinelas (nenhuma, a própria
      // sonda e a API de clima) não têm equipamento para resolver o nome.
      const rainGaugeId = container.querySelector("#cfRainGauge")?.value || NO_RAIN;
      data.rainGaugeId = rainGaugeId;

      if (rainGaugeId === OWN_RAIN_GAUGE || rainGaugeId === WEATHER_API_RAIN || rainGaugeId === NO_RAIN) {
        data.rainGaugeName = "";
      } else {
        const gauge = rainGaugeEquipments().find((item) => String(item.id ?? "") === String(rainGaugeId));
        data.rainGaugeName = gauge ? equipmentName(gauge, t("Pluviômetro")) : "";
      }

      return data;
    },

    // CC e PM delimitam a faixa de água disponível: sem os dois não há
    // como calcular a lâmina.
    validateStep4(data) {
      for (const field of SOIL_FIELDS.slice(0, 2)) {
        const raw = data[field.key];
        if (!raw) {
          return { ok: false, msg: `${t("Informe:")} ${t(field.label)}` };
        }
        if (!Number.isFinite(Number(String(raw).replace(",", ".")))) {
          return { ok: false, msg: `${t(field.label)}: ${t("informe um número válido.")}` };
        }
      }

      // A capacidade de campo tem de ficar acima do ponto de murcha, senão
      // a faixa de água disponível fica negativa e a lâmina não faz sentido.
      const fc = Number(String(data.fieldCapacity).replace(",", "."));
      const wp = Number(String(data.wiltingPoint).replace(",", "."));
      if (fc <= wp) {
        return { ok: false, msg: t("A capacidade de campo deve ser maior que o ponto de murcha.") };
      }

      return { ok: true, msg: "" };
    },

    // Alvo e gatilho são obrigatórios; cultura e datas do ciclo, opcionais.
    validateStep5(data) {
      for (const field of SOIL_FIELDS.slice(2)) {
        const raw = data[field.key];
        if (!raw) {
          return { ok: false, msg: `${t("Informe:")} ${t(field.label)}` };
        }
        if (!Number.isFinite(Number(String(raw).replace(",", ".")))) {
          return { ok: false, msg: `${t(field.label)}: ${t("informe um número válido.")}` };
        }
      }

      // O alvo tem de ser maior que o gatilho: a faixa de irrigação vai do
      // gatilho até o alvo. Acima de 100% não bloqueia (a faixa é limitada a
      // 100%). Esta regra bloqueia o avanço mesmo com a validação dos demais
      // campos desligada no mockup (hard).
      const target = Number(String(data.targetIrrigation).replace(",", "."));
      const trigger = Number(String(data.triggerIrrigation).replace(",", "."));
      if (target <= trigger) {
        return { ok: false, hard: true, msg: t("A umidade alvo deve ser maior que a umidade gatilho.") };
      }
      return { ok: true, msg: "" };
    },
  };
})();
