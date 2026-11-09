(function () {
    "use strict";

    const state = { isOpen: false, deviceIndex: 0 };
    const $ = (id) => document.getElementById(id);

    const t = (text) => window.IcI18n?.t?.(text) ?? text;

    const COUNTRIES = [
        "Brasil", "Argentina", "Paraguai", "Uruguai", "Bolívia", "Chile",
        "Colômbia", "Peru", "México", "Estados Unidos", "Portugal", "Espanha", "Outro",
    ];

    const TIMEZONES = [
        "America/Sao_Paulo", "America/Bahia", "America/Fortaleza", "America/Recife",
        "America/Belem", "America/Manaus", "America/Cuiaba", "America/Campo_Grande",
        "America/Porto_Velho", "America/Boa_Vista", "America/Rio_Branco", "America/Noronha",
        "America/Argentina/Buenos_Aires", "America/Asuncion", "America/Montevideo",
        "America/La_Paz", "America/Santiago", "America/Bogota", "America/Lima",
        "America/Mexico_City", "America/Chicago", "America/Los_Angeles", "America/New_York",
        "Europe/Lisbon", "Europe/Madrid", "UTC",
    ];

    function activeFarm() {
        return window.IcFarmGetActive?.() || window.icFarmData || window.IcFarmActive || null;
    }

    function farmDefaults() {
        const farm = activeFarm();
        return {
            address: farm?.address || farm?.endereco || "",
            country: farm?.country || farm?.pais || "Brasil",
            timezone: farm?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo",
            loc: farm?.loc || ((farm?.lat && farm?.lng) ? `${farm.lat}, ${farm.lng}` : ""),
            lat: farm?.lat,
            lng: farm?.lng,
        };
    }

    function toDatetimeLocal(value) {
        if (!value) return "";
        const raw = String(value);
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return raw;
        const date = new Date(raw);
        if (Number.isNaN(date.getTime())) return raw;
        date.setSeconds(0, 0);
        return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }

    function normalizeCountry(value) {
        const map = {
            BR: "Brasil",
            Brazil: "Brasil",
            Brasil: "Brasil",
            PT: "Portugal",
            Portugal: "Portugal",
            US: "Estados Unidos",
            USA: "Estados Unidos",
            "United States": "Estados Unidos",
            "Estados Unidos": "Estados Unidos",
        };
        return map[value] || value || "";
    }

    // Cosmofields da fazenda ativa, na mesma ordem usada pelo mapa e pelo
    // card — o índice é o que define a leitura de cada sonda.
    function listDevices() {
        const farm = activeFarm();
        const equipments = Array.isArray(farm?.equipments) ? farm.equipments : [];
        return equipments.filter((item) => item?.type === "cosmofield");
    }

    // Foca a sonda clicada (mapa, lista, modal) antes de montar a tela. Sem
    // id, ou com um id que não está mais na fazenda, mantém a atual — e
    // volta pra primeira se o índice guardado ficou fora da lista (sonda
    // removida, troca de fazenda).
    function focusDevice(equipId) {
        const devices = listDevices();
        if (equipId !== undefined && equipId !== null && equipId !== "") {
            const index = devices.findIndex((device) => String(device?.id) === String(equipId));
            if (index !== -1) state.deviceIndex = index;
        }
        if (state.deviceIndex >= devices.length) state.deviceIndex = 0;
    }

    const LINKABLE_TYPES = new Set(["smart_connect", "smarttouch", "centerstar", "linestar", "rainstar"]);

    function irrigationEquipments() {
        const farm = activeFarm();
        const equipments = Array.isArray(farm?.equipments)
            ? farm.equipments
            : (window.IcGetPivotList?.() || []);
        return equipments.filter((item) => LINKABLE_TYPES.has(item?.type));
    }

    function equipmentName(equipment, fallbackPrefix) {
        return equipment?.name
            || equipment?.deviceName
            || equipment?.data?.nome
            || `${fallbackPrefix || t("Pivô")} ${String(equipment?.id || "").slice(0, 4)}`;
    }

    // Pluviômetros da fazenda ativa, para a fonte de chuva da sonda.
    function rainGaugeEquipments() {
        const farm = activeFarm();
        const equipments = Array.isArray(farm?.equipments) ? farm.equipments : [];
        return equipments.filter((item) => item?.type === "pluviometro");
    }

    // Sentinela: a chuva vem do pluviômetro embutido na própria sonda.
    const OWN_RAIN_GAUGE = "__own__";

    // Chuva estimada pela weather API da fazenda (Open-Meteo), consultada
    // na coordenada da sonda.
    const WEATHER_API_RAIN = "__weather__";

    // Sem fonte de chuva: nada é registrado automaticamente.
    const NO_RAIN = "__norain__";

    // Sentinela: sonda sem equipamento vinculado. Persistido como "".
    const NO_LINKED_EQUIPMENT = "__none__";

    // Cinza enquanto nada foi escolhido, preto depois da escolha — mesmo
    // comportamento dos campos de texto com placeholder.
    function bindPlaceholderState(root, id) {
        const select = root.querySelector("#" + id);
        if (!select) return;
        const sync = () => select.classList.toggle("is-placeholder", select.value === NO_LINKED_EQUIPMENT);
        sync();
        if (!select.dataset.phBound) {
            select.dataset.phBound = "1";
            select.addEventListener("change", sync);
        }
    }

    // Catálogos vindos do módulo de criação: as duas telas oferecem as
    // mesmas culturas e texturas, sem duplicar as tabelas do FAO.
    const cropHandler = () => window.IcEquipamentos?.cosmofield;

    function renderCropSelect(root, selected) {
        const select = root.querySelector("#cfCfgCropType");
        const groups = cropHandler()?.CROP_GROUPS;
        if (!select || !groups) return;

        const current = String(selected || "");
        const options = ['<option value="' + NO_LINKED_EQUIPMENT + '" ' +
            (current ? "" : "selected") + ">" + t("Nenhuma (definir depois)") + "</option>"];

        // Lista simples, sem grupos, na ordem do PRD.
        groups.forEach((entry) => {
            entry.crops.forEach(([crop]) => {
                options.push('<option value="' + escapeHtml(crop) + '" ' +
                    (crop === current ? "selected" : "") + ">" + escapeHtml(t(crop)) + "</option>");
            });
        });

        options.push('<option value="Outro" ' + (current === "Outro" ? "selected" : "") + ">" + t("Outro") + "</option>");
        select.innerHTML = options.join("");
    }

    function renderSoilPresetSelect(root, selected) {
        const select = root.querySelector("#cfCfgSoilPreset");
        const handler = cropHandler();
        if (!select || !handler?.SOIL_PRESETS) return;

        const manual = handler.SOIL_MANUAL;
        const current = String(selected || manual);
        const options = ['<option value="' + manual + '" ' +
            (current === manual ? "selected" : "") + ">" + t("Definição manual") + "</option>"];

        handler.SOIL_PRESETS.forEach((preset) => {
            options.push('<option value="' + escapeHtml(preset.key) + '" ' +
                (preset.key === current ? "selected" : "") + ">" + escapeHtml(t(preset.label)) + "</option>");
        });

        select.innerHTML = options.join("");
    }

    // Ao reabrir uma sonda que já tem textura ou cultura definida, os avisos
    // precisam vir visíveis — senão a referência só apareceria depois de
    // mexer no seletor, ao contrário do que acontece no create.
    function syncSuggestionNotes(root, data) {
        const handler = cropHandler();
        if (!handler) return;

        const soilNote = root.querySelector("#cfCfgSoilNote");
        if (soilNote) {
            const preset = String(data.soilPreset || "");
            soilNote.hidden = !preset || preset === handler.SOIL_MANUAL;
        }

        const cropNote = root.querySelector("#cfCfgCropNote");
        if (cropNote) {
            const suggested = handler.triggerForCrop?.(data.cropType);
            cropNote.hidden = suggested === null || suggested === undefined;
        }
    }

    // Mesmas sugestões do create: a textura preenche CC/PM e a cultura
    // preenche o gatilho (e o alvo, quando ainda vazio).
    function bindSuggestions(root) {
        const handler = cropHandler();
        if (!handler) return;

        const soilSelect = root.querySelector("#cfCfgSoilPreset");
        const fc = root.querySelector("#cfCfgFieldCap");
        const wp = root.querySelector("#cfCfgWilting");
        const soilNote = root.querySelector("#cfCfgSoilNote");

        if (soilSelect && fc && wp && !soilSelect.dataset.bound) {
            soilSelect.dataset.bound = "1";
            soilSelect.addEventListener("change", () => {
                if (soilSelect.value === handler.SOIL_MANUAL) {
                    // Definição manual: os campos ficam vazios.
                    fc.value = "";
                    wp.value = "";
                    if (soilNote) soilNote.hidden = true;
                    return;
                }
                const preset = handler.SOIL_PRESETS.find((item) => item.key === soilSelect.value);
                if (!preset) return;
                if (preset.fc !== null && preset.wp !== null) {
                    fc.value = String(preset.fc);
                    wp.value = String(preset.wp);
                }
                if (soilNote) soilNote.hidden = false;
            });

            // Digitar à mão desfaz o vínculo com a textura escolhida.
            const toManual = () => {
                if (soilSelect.value === handler.SOIL_MANUAL) return;
                soilSelect.value = handler.SOIL_MANUAL;
                if (soilNote) soilNote.hidden = true;
            };
            fc.addEventListener("input", toManual);
            wp.addEventListener("input", toManual);
        }

        const cropSelect = root.querySelector("#cfCfgCropType");
        const trigger = root.querySelector("#cfCfgTrigger");
        const target = root.querySelector("#cfCfgTarget");
        const cropNote = root.querySelector("#cfCfgCropNote");

        if (cropSelect && trigger && !cropSelect.dataset.suggestBound) {
            cropSelect.dataset.suggestBound = "1";
            cropSelect.addEventListener("change", () => {
                const suggested = handler.triggerForCrop?.(cropSelect.value);
                if (suggested === null || suggested === undefined) {
                    // "Nenhuma (definir depois)" e "Outro": alvo e gatilho vazios.
                    trigger.value = "";
                    if (target) target.value = "";
                    if (cropNote) cropNote.hidden = true;
                    return;
                }
                trigger.value = String(suggested);
                if (target) target.value = "100";
                if (cropNote) cropNote.hidden = false;
            });

            trigger.addEventListener("input", () => {
                if (cropNote) cropNote.hidden = true;
            });
        }
    }

    function renderRainGaugeSelect(root, device) {
        const select = root.querySelector("#cfCfgRainGauge");
        if (!select) return;

        const items = rainGaugeEquipments();
        const data = settingsDataFromCreate(device);
        const selectedId = String(data.rainGaugeId || NO_RAIN);

        const options = [
            '<option value="' + NO_RAIN + '" ' +
            (selectedId === NO_RAIN ? "selected" : "") + ">" +
            t("Nenhuma (sem dados de chuva)") + "</option>",
            '<option value="' + OWN_RAIN_GAUGE + '" ' +
            (selectedId === OWN_RAIN_GAUGE ? "selected" : "") + ">" +
            t("Pluviômetro próprio da sonda") + "</option>",
            '<option value="' + WEATHER_API_RAIN + '" ' +
            (selectedId === WEATHER_API_RAIN ? "selected" : "") + ">" +
            t("Estimativa da API de clima") + "</option>",
        ];

        items.forEach((item) => {
            const id = String(item?.id ?? "");
            options.push(
                '<option value="' + escapeHtml(id) + '" ' + (id === selectedId ? "selected" : "") + ">" +
                escapeHtml(equipmentName(item, t("Pluviômetro"))) +
                "</option>"
            );
        });

        select.innerHTML = options.join("");
    }

    function renderLinkedEquipmentSelect(root, device) {
        const select = root.querySelector("#cfCfgLinkedPivot");
        if (!select) return;

        const items = irrigationEquipments();
        const data = settingsDataFromCreate(device);
        const selectedId = String(data.linkedPivotId || "");
        const selectedName = data.linkedPivotName || "";

        const options = ['<option value="' + NO_LINKED_EQUIPMENT + '" ' +
            (selectedId ? "" : "selected") + ">" + t("Nenhum (sonda independente)") + "</option>"];
        items.forEach((item) => {
            const id = String(item?.id ?? "");
            const name = equipmentName(item, t("Pivô"));
            const selected = (selectedId && id === selectedId) || (!selectedId && selectedName && name === selectedName);
            options.push(
                '<option value="' + escapeHtml(id) + '" ' + (selected ? "selected" : "") + ">" +
                escapeHtml(name) +
                "</option>"
            );
        });

        select.innerHTML = options.join("");
        select.disabled = false;
        bindPlaceholderState(root, "cfCfgLinkedPivot");
    }


    // Seletor de equipamento na barra de abas (mesmo padrão do edit de
    // pivô). Substitui a lista lateral: o aside voltou a ser tópicos de
    // seção, como nas demais telas de edição.
    // Sondas com o índice original, em ordem alfabética pelo nome.
    function alphabeticalDevices(devices) {
        return devices
            .map((device, index) => ({ device, index }))
            .sort((a, b) => String(a.device?.name || "").localeCompare(
                String(b.device?.name || ""),
                undefined,
                { numeric: true, sensitivity: "base" }
            ));
    }

    function renderDeviceSelect(root) {
        const btn = root.querySelector("#cfDeviceSelectBtn");
        const menu = root.querySelector("#cfDeviceSelectMenu");
        if (!btn || !menu) return;

        const devices = listDevices();
        if (!devices.length) {
            btn.textContent = t("Nenhum Cosmofield");
            menu.innerHTML = "";
            return;
        }

        const current = devices[state.deviceIndex] || devices[0];
        btn.textContent = current?.name || `Cosmofield ${state.deviceIndex + 1}`;
        btn.dataset.value = current?.id || "";

        // A lista aparece sempre em ordem alfabética (numeração natural:
        // "CF 2" antes de "CF 10"). O índice continua sendo o da fazenda, que
        // é o que o restante da tela usa para localizar a sonda.
        menu.innerHTML = alphabeticalDevices(devices)
            .map(({ device, index }) => `
                <button type="button" class="edit-panel__select-option ${index === state.deviceIndex ? "is-active" : ""}"
                        data-value="${escapeHtml(String(device.id ?? index))}" data-device-index="${index}">
                  ${escapeHtml(device.name || `Cosmofield ${index + 1}`)}
                </button>`)
            .join("");

        menu.querySelectorAll("[data-device-index]").forEach((option) => {
            option.addEventListener("click", () => {
                const index = Number(option.dataset.deviceIndex);
                if (!Number.isFinite(index)) return;
                selectDevice(root, index);
                menu.closest(".edit-panel__select-field")?.classList.remove("is-open");
            });
        });
    }

    // Troca a sonda ativa e atualiza tudo que depende dela.
    function selectDevice(root, index) {
        state.deviceIndex = index;
        renderDeviceSelect(root);
        // O gráfico vem primeiro: os KPIs leem a série dele, e com a ordem
        // invertida mostravam os valores da sonda anterior (ou os padrões,
        // na primeira carga) — daí o "0% de água disponível".
        window.IcCosmofieldChart?.init(root, chartConfig(listDevices()[index], index));
        renderDeviceData(root);
        renderDeviceSettings(root);
        renderRawData(root);
        renderCalendar(root);
    }

    // Seed estável por equipamento: mesma soma de char codes usada pelo
    // mapa, pra que a curva de cada sonda seja sempre a mesma.
    function deviceSeed(device) {
        return String(device?.id || "").split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0) || 42;
    }

    // Config do gráfico com os parâmetros reais da sonda: a série é simulada,
    // mas a última leitura tem de bater com a que o mapa e o card mostram.
    function chartConfig(device, index) {
        const data = settingsDataFromCreate(device);
        const reading = window.IcCosmofieldReading?.(device, index);
        return {
            seed: deviceSeed(device),
            equipId: device?.id,
            moisture: reading?.moistureValue,
            fieldCapacity: Number(String(data.fieldCapacity ?? "").replace(",", ".")),
            wiltingPoint: Number(String(data.wiltingPoint ?? "").replace(",", ".")),
            trigger: Number(String(data.triggerIrrigation ?? "").replace(",", ".")),
            // Datas do cultivo: habilitam o filtro de safra no gráfico.
            // Ancora a série de bateria no valor que os KPIs mostram.
            battery: reading?.batteryValue,
            // Lançamentos manuais do calendário: aparecem também no gráfico.
            manualEvents: Array.isArray(device?.data?.calendarEvents) ? device.data.calendarEvents : [],
            // Sem fonte de chuva, o gráfico não mostra chuva simulada: só os
            // lançamentos manuais do calendário.
            noRain: data.rainGaugeId === NO_RAIN,
            // Alvo da irrigação: limita a faixa de irrigação do gráfico.
            target: Number(String(data.targetIrrigation ?? "").replace(",", ".")),
            // Perda recente de dados: dias inteiros sem leitura até hoje; o
            // gráfico fica fixo na última leitura recebida.
            trailingMissing: reading?.isOffline ? Math.floor((reading.minutesSince || 0) / 1440) : 0,
            // Exemplo de perda de dados nas pontas da série (fáceis de achar na
            // Raw Data: primeira e última página). Vale para a 2ª sonda da
            // fazenda e a cada 4 depois dela. Sem linha na tabela: a sonda não
            // transmitiu. Linha só com a data: transmitiu sem enviar dados.
            //  - primeiro dia: dias 0 e 1 transmitiram sem dados; o dia 2 não transmitiu;
            //  - último dia (hoje): os dias 97 e 98 não transmitiram; o dia 99 transmitiu sem dados.
            gaps: index % 4 === 1
                ? [
                    { from: 0, to: 3, empty: [0, 1] },
                    { from: 97, to: 100, empty: [99] },
                ]
                : [],
            sowingDate: data.sowingDate || "",
            harvestDate: data.harvestDate || "",
            // Escala do gráfico definida para este equipamento.
            yMax: data.yMax || "",
            yRightMax: data.yRightMax || "",
            yBattMax: data.yBattMax || "",
            yMode: data.yMode || "auto",
        };
    }

    // Aplica os dados da sonda selecionada aos KPIs do dashboard, usando a
    // mesma leitura do marcador, do tooltip e do card.
    function renderDeviceData(root) {
        const devices = listDevices();
        const device = devices[state.deviceIndex];
        if (!device) return;

        const reading = window.IcCosmofieldReading?.(device, state.deviceIndex);
        if (!reading) return;

        const setText = (id, value) => {
            const el = root.querySelector(`#${id}`);
            if (el) el.textContent = value;
        };

        // Unidade em corpo menor, como nos relatórios.
        const setValueUnit = (id, value, unit) => {
            const el = root.querySelector(`#${id}`);
            if (el) el.innerHTML = value === null ? "—" : `${value} <span class="unit">${unit}</span>`;
        };

        // Fonte única: a leitura exibida é o último ponto da própria série do
        // gráfico. Antes os KPIs liam de IcCosmofieldReading e a tabela da
        // série — os dois batiam por coincidência (a série é ancorada nessa
        // leitura), mas divergiam assim que o zoom mudava a janela.
        // Série completa, não a janela do zoom: o cabeçalho mostra a última
        // leitura da sonda, e recortar o período no gráfico não muda qual é.
        const series = window.IcCosmofieldChart?.getSeries?.({ full: true });
        const lastValue = series?.values?.length
            ? series.values[series.values.length - 1]
            : reading.moistureValue;

        setValueUnit("cfKpiMoisture", lastValue.toFixed(2), "%");

        const fcValue = series?.fieldCapacity ?? reading.fieldCapacity;
        const wpValue = series?.wiltingPoint ?? reading.wiltingPoint;
        const hasRange = Number.isFinite(fcValue) && Number.isFinite(wpValue) && fcValue > wpValue;
        const available = hasRange
            ? Math.max(0, Math.min(100, ((lastValue - wpValue) / (fcValue - wpValue)) * 100))
            : null;
        setValueUnit("cfKpiAvailable", available === null ? null : available.toFixed(2), "%");

        // Lâmina até a capacidade de campo, com os 40 cm de perfil — mesma
        // conta do tooltip e do card.
        const blade = Number.isFinite(fcValue)
            ? Math.max(0, ((fcValue - lastValue) / 100) * 400)
            : null;
        setValueUnit("cfKpiBlade", blade === null ? null : blade.toFixed(2), "mm");

        const locale = window.IcI18n?.getLocale?.() || "pt-BR";
        const shortDate = (date) => date
            .toLocaleDateString(locale, { day: "2-digit", month: "short" })
            .replace(/\sde\s/g, " ")
            .replace(/\.$/, "");

        // Próxima irrigação: mesmo mock determinístico do tooltip.
        const nextDate = new Date(Date.now() + (reading.seed % 7) * 86400000);
        setText("cfKpiNext", shortDate(nextDate));

        // Última tensão da série — o mesmo ponto que o gráfico e o tooltip
        // mostram na ponta direita.
        const lastBattery = series?.battery?.length
            ? series.battery[series.battery.length - 1]
            : reading.batteryValue;
        setValueUnit("cfKpiBattery", (lastBattery ?? 0).toFixed(2), "V");

        const commDate = new Date(Date.now() - (reading.minutesSince ?? 30) * 60000);
        const commTime = commDate.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
        setText("cfKpiComm", `${shortDate(commDate)} ${commTime}`);

        // Cabeçalho de cada seção de configurações, no padrão do edit de
        // pivô/bomba/medidor: "dd mon yyyy hh:mm" via formatLastComm
        // compartilhado (assets/js/core/equip-utils.js).
        const commFull = window.IcEquipUtils?.formatLastComm?.(commDate) || `${String(commDate.getDate()).padStart(2, "0")}/${String(commDate.getMonth() + 1).padStart(2, "0")}/${commDate.getFullYear()} ${commTime}`;
        root.querySelectorAll("[id^='cfCfgLastComm']").forEach((el) => {
            el.textContent = commFull;
        });

        // Sem comunicação: os valores viram cinza, como no tooltip e no modal.
        ["cfKpiMoisture", "cfKpiAvailable", "cfKpiBlade", "cfKpiBattery"].forEach((id) => {
            root.querySelector(`#${id}`)?.classList.toggle("is-stale", !!reading.isOffline);
        });
    }

    // Campos que aceitam decimal são exibidos sempre com duas casas, mesmo
    // quando o valor é redondo. Coordenada tem regra própria (6 casas) e não
    // passa por aqui.
    function fmtDecimal(value) {
        const raw = String(value ?? "").trim();
        if (!raw) return "";
        const num = Number(raw.replace(",", "."));
        return Number.isFinite(num) ? num.toFixed(2) : raw;
    }

    // Normaliza para duas casas ao sair do campo, como no create.
    function bindDecimalFields(root) {
        root.querySelectorAll('input[inputmode="decimal"]').forEach((input) => {
            if (input.dataset.decimalBound) return;
            input.dataset.decimalBound = "1";
            input.addEventListener("blur", () => {
                const formatted = fmtDecimal(input.value);
                if (formatted) input.value = formatted;
            });
        });
    }

    function firstFilled(...values) {
        for (const value of values) {
            if (value !== undefined && value !== null && String(value).trim() !== "") return value;
        }
        return "";
    }

    // O create salva tudo em device.data. Esta camada lê primeiro esses nomes
    // canônicos e depois cobre registros antigos/raiz do equipamento.
    function settingsDataFromCreate(device) {
        const data = device?.data || {};
        const defaults = farmDefaults();
        const loc = firstFilled(
            data.loc,
            data.location,
            device?.loc,
            (data.lat && data.lng) ? `${data.lat}, ${data.lng}` : "",
            (device?.lat && device?.lng) ? `${device.lat}, ${device.lng}` : "",
            defaults.loc
        );

        return {
            name: firstFilled(data.name, device?.name),
            installationId: firstFilled(data.installationId, data.installationID, data.installation_id, device?.installationId),
            accessKey: firstFilled(data.accessKey, data.access_key, data.key, device?.accessKey),
            address: firstFilled(data.address, data.endereco, device?.address, defaults.address),
            loc,
            altitude: firstFilled(data.altitude, data.elevation, device?.altitude),
            firstInstallAt: firstFilled(data.firstInstallAt, data.installedAt, data.installationDate, data.firstInstall, device?.firstInstallAt, device?.createdAt),
            country: normalizeCountry(firstFilled(data.country, data.pais, device?.country, defaults.country)),
            timezone: firstFilled(data.timezone, data.timeZone, data.tz, device?.timezone, defaults.timezone),
            fieldCapacity: firstFilled(data.fieldCapacity, data.field_capacity, data.fc, device?.fieldCapacity),
            wiltingPoint: firstFilled(data.wiltingPoint, data.wilting_point, data.wp, device?.wiltingPoint),
            targetIrrigation: firstFilled(data.targetIrrigation, data.target_irrigation, data.target, device?.targetIrrigation),
            triggerIrrigation: firstFilled(data.triggerIrrigation, data.trigger_irrigation, data.trigger, device?.triggerIrrigation),
            cropType: firstFilled(data.cropType, data.crop, data.culture, device?.cropType),
            sowingDate: firstFilled(data.sowingDate, data.sowing, data.plantingDate, device?.sowingDate),
            harvestDate: firstFilled(data.harvestDate, data.harvest, device?.harvestDate),
            linkedPivotId: firstFilled(data.linkedPivotId, data.linkedEquipmentId, data.linkedId, device?.linkedPivotId),
            linkedPivotName: firstFilled(data.linkedPivotName, data.linkedEquipmentName, data.linkedName, device?.linkedPivotName),
            // Sonda cadastrada antes deste campo existir cai no pluviômetro
            // próprio, que é o comportamento que ela já tinha.
            rainGaugeId: firstFilled(data.rainGaugeId, device?.rainGaugeId, NO_RAIN),
            rainGaugeName: firstFilled(data.rainGaugeName, device?.rainGaugeName),
            // Textura escolhida no create: sem ela o seletor voltava sempre
            // para "Definição manual" e o aviso da fonte não aparecia.
            soilPreset: firstFilled(data.soilPreset, device?.soilPreset),
            // Coordenada: o create grava lat/lng separados e loc no formato
            // "lat, lng". Reconstrói o texto quando só os números existirem.
            loc: firstFilled(
                data.loc,
                (data.lat !== undefined && data.lng !== undefined && data.lat !== "" && data.lng !== "")
                    ? `${data.lat}, ${data.lng}`
                    : "",
                device?.loc
            ),
            yMax: firstFilled(data.yMax, data.chartYMax, device?.yMax),
            yRightMax: firstFilled(data.yRightMax, data.chartYRightMax, device?.yRightMax),
            yBattMax: firstFilled(data.yBattMax, device?.yBattMax),
            yMode: firstFilled(data.yMode, data.chartYMode, device?.yMode, "auto"),
        };
    }


    // Preenche o formulário de Settings com os dados da sonda selecionada.
    function renderDeviceSettings(root) {
        const device = listDevices()[state.deviceIndex];

        // As listas de cultura e textura não dependem do equipamento: são
        // catálogos fixos. Popular antes do early-return evita o select
        // ficar só com o placeholder quando não há sonda cadastrada.
        renderCropSelect(root, device ? settingsDataFromCreate(device).cropType : "");
        renderSoilPresetSelect(root, device ? settingsDataFromCreate(device).soilPreset : "");
        bindSuggestions(root);
        bindDecimalFields(root);

        if (!device) return;
        const data = settingsDataFromCreate(device);

        const setValue = (id, value) => {
            const el = root.querySelector(`#${id}`);
            if (el) el.value = value ?? "";
        };

        setValue("cfCfgName", data.name);
        setValue("cfCfgInstallationId", data.installationId);
        setValue("cfCfgAccessKey", data.accessKey);
        // Ícone de teste de conexão (à frente da chave de acesso). Simulado.
        const connButton = root.querySelector("#cfCfgTestConn");
        if (connButton && !connButton.dataset.connBound) {
            connButton.dataset.connBound = "1";
            cropHandler()?.bindConnectionTest?.({
                idInput: root.querySelector("#cfCfgInstallationId"),
                keyInput: root.querySelector("#cfCfgAccessKey"),
                button: connButton,
            });
        }
        setValue("cfCfgAddress", data.address);
        // Equipamentos criados antes do geocoding ficaram sem endereço:
        // resolve pelas coordenadas, como o create faz.
        if (!data.address) resolveAddressFromCoords(root, device);
        // Campo único "lat, lng" — mesmo formato do create.
        setValue("cfCfgLoc", data.loc);
        setValue("cfCfgAltitude", fmtDecimal(data.altitude));
        if (!data.altitude) resolveAltitudeFromCoords(root, device);
        // Data de instalação sempre em dd/mm/aaaa hh:mm.
        setValue("cfCfgInstallDate", cropHandler()?.isoToBrDateTime?.(toDatetimeLocal(data.firstInstallAt)) ?? "");
        const installInput = root.querySelector("#cfCfgInstallDate");
        if (installInput && !installInput.dataset.maskBound) {
            installInput.dataset.maskBound = "1";
            cropHandler()?.bindDateTimeMask?.(installInput);
        }
        setValue("cfCfgFieldCap", fmtDecimal(data.fieldCapacity));
        setValue("cfCfgWilting", fmtDecimal(data.wiltingPoint));
        setValue("cfCfgTarget", fmtDecimal(data.targetIrrigation));
        setValue("cfCfgTrigger", fmtDecimal(data.triggerIrrigation));
        syncSuggestionNotes(root, data);

        // Mesmo select customizado do create (agrupado, com busca visual),
        // em vez do dropdown nativo do sistema.
        window.IcEquipSelectInit?.(root);
        bindPlaceholderState(root, "cfCfgCropType");
        // Datas com máscara dd/mm/aaaa: o valor ISO fica no dataset.
        root.querySelectorAll("[data-date-mask]").forEach((input) => {
            window.IcDateInput?.bindDateMask?.(input);
        });
        window.IcDateInput?.setDateValue?.(root.querySelector("#cfCfgSowing"), data.sowingDate);
        window.IcDateInput?.setDateValue?.(root.querySelector("#cfCfgHarvest"), data.harvestDate);
        renderLinkedEquipmentSelect(root, device);
        renderRainGaugeSelect(root, device);
        setValue("cfCfgYMax", fmtDecimal(data.yMax));
        setValue("cfCfgYRightMax", fmtDecimal(data.yRightMax));
        setValue("cfCfgYBattMax", fmtDecimal(data.yBattMax));
        const yModeEl = root.querySelector("#cfCfgYMode");
        if (yModeEl) {
            yModeEl.value = data.yMode || "auto";
            syncYScaleFields(root);
            if (!yModeEl.dataset.bound) {
                yModeEl.dataset.bound = "1";
                yModeEl.addEventListener("change", () => syncYScaleFields(root));
            }
        }

        // Selects custom guardam o valor num hidden e o rótulo no botão.
        const fillSelectOptions = (fieldId, list) => {
            const field = root.querySelector(`#${fieldId}`);
            const menu = field?.querySelector(".edit-panel__select-menu");
            if (!menu || menu.dataset.filledFromCreate) return;
            menu.dataset.filledFromCreate = "1";
            menu.innerHTML = list.map((value) =>
                '<button type="button" class="edit-panel__select-option" data-value="' +
                escapeHtml(value) + '">' + escapeHtml(t(value)) + "</button>"
            ).join("");
        };
        const setSelect = (fieldId, hiddenId, value) => {
            if (!value) return;
            const hidden = root.querySelector(`#${hiddenId}`);
            if (hidden) hidden.value = value;
            const field = root.querySelector(`#${fieldId}`);
            const trigger = field?.querySelector("[data-select-trigger]");
            if (trigger) trigger.textContent = t(value);
            field?.querySelectorAll(".edit-panel__select-option").forEach((opt) => {
                opt.classList.toggle("is-active", opt.dataset.value === value);
            });
        };
        fillSelectOptions("cfCfgCountryField", COUNTRIES);
        fillSelectOptions("cfCfgTzField", TIMEZONES);
        setSelect("cfCfgCountryField", "cfCfgCountry", data.country);
        setSelect("cfCfgTzField", "cfCfgTz", data.timezone);

        renderSettingsMap(root);
    }

    // Tabela de dados brutos: mesma série do gráfico, em formato tabular.
    function renderRawData(root) {
        const body = root.querySelector("#cfRawTableBody");
        const count = root.querySelector("#cfRawCount");
        if (!body) return;

        const series = window.IcCosmofieldChart?.getSeries?.();
        if (!series) { body.innerHTML = ""; return; }

        const { dates, values, rain, total, fieldCapacity, wiltingPoint, battery } = series;
        const manual = manualByIndex(dates);
        const hasRange = Number.isFinite(fieldCapacity) && Number.isFinite(wiltingPoint) && fieldCapacity > wiltingPoint;
        const locale = window.IcI18n?.getLocale?.() || "pt-BR";

        // A sonda transmite de hora em hora. A série do gráfico é diária, então
        // cada dia vira 24 leituras interpoladas entre o valor do dia e o do
        // seguinte — o mesmo dado, na granularidade real de transmissão.
        const READINGS_PER_DAY = 24;
        const fmtEvent = (mm) => (mm > 0 ? mm.toFixed(2) : "—");
        // Mesmo formato da legenda "Última comunicação" da tela: dd mon
        // yyyy hh:mm (helper compartilhado em core/equip-utils.js).
        const fmtCell = (date) => window.IcEquipUtils?.formatLastComm?.(date)
            || date.toLocaleString();

        const rows = [];

        // A ordem das linhas segue o cabeçalho: as horas dentro do dia
        // acompanham a mesma direção, senão a sequência ficaria quebrada.
        const desc = rawSortDir === "desc";
        const dayFrom = desc ? total - 1 : 0;
        const dayTo = desc ? -1 : total;
        const dayStep = desc ? -1 : 1;

        for (let i = dayFrom; i !== dayTo; i += dayStep) {
            const value = values[i];
            const isMissing = series.missing?.has(i);
            // Sem transmissão: a linha existe, mas sem Soil Moisture, Available
            // water, Rain, Irrigation e Battery (só vêm a data e os parâmetros do
            // solo). Sem dados: a sonda transmitiu, mas a linha vem toda vazia.
            const noData = isMissing && series.emptyRows?.has(i);
            const noTransmission = isMissing && !noData;
            if (!Number.isFinite(value)) continue;
            const next = Number.isFinite(values[i + 1]) ? values[i + 1] : value;
            const event = rain.get(i);

            const hourFrom = desc ? READINGS_PER_DAY - 1 : 0;
            const hourTo = desc ? -1 : READINGS_PER_DAY;
            const hourStep = desc ? -1 : 1;

            for (let hour = hourFrom; hour !== hourTo; hour += hourStep) {
                const ratio = hour / READINGS_PER_DAY;
                const hourly = value + (next - value) * ratio;
                const available = hasRange
                    ? Math.max(0, Math.min(100, ((hourly - wiltingPoint) / (fieldCapacity - wiltingPoint)) * 100))
                    : null;

                const stamp = new Date(dates[i]);
                stamp.setHours(hour, 0, 0, 0);
                // Não lista horas que ainda não aconteceram.
                if (stamp > new Date()) continue;

                if (noTransmission) {
                    rows.push(`
                <tr class="cf-raw-row--none">
                  <td>${fmtCell(stamp)}</td>
                  <td>—</td>
                  <td>${Number.isFinite(fieldCapacity) ? fieldCapacity.toFixed(2) : "—"}</td>
                  <td>${Number.isFinite(wiltingPoint) ? wiltingPoint.toFixed(2) : "—"}</td>
                  <td>—</td><td>—</td><td>—</td><td>—</td>
                </tr>`);
                    continue;
                }

                if (noData) {
                    rows.push(`
                <tr class="cf-raw-row--nodata">
                  <td>${fmtCell(stamp)}</td>
                  <td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>
                </tr>`);
                    continue;
                }

                // Cada evento aparece na hora em que foi lançado; os
                // simulados, que não têm hora, ficam nas 12h. Chuva e
                // irrigação são independentes: um lançamento manual
                // substitui só o valor do seu tipo.
                const m = manual.get(i);
                const rainAt = (h) => {
                    if (m && m.rain > 0) return (m.rainHour ?? 12) === h ? m.rain : 0;
                    return (h === 12 && event && !event.irrigation) ? event.mm : 0;
                };
                const irrigationAt = (h) => {
                    if (m && m.irrigation > 0) return (m.irrigationHour ?? 12) === h ? m.irrigation : 0;
                    return (h === 12 && event && event.irrigation) ? event.mm : 0;
                };

                rows.push(`
                <tr>
                  <td>${fmtCell(stamp)}</td>
                  <td>${hourly.toFixed(2)}</td>
                  <td>${Number.isFinite(fieldCapacity) ? fieldCapacity.toFixed(2) : "—"}</td>
                  <td>${Number.isFinite(wiltingPoint) ? wiltingPoint.toFixed(2) : "—"}</td>
                  <td>${available === null ? "—" : available.toFixed(2)}</td>
                  <td>${fmtEvent(rainAt(hour))}</td>
                  <td>${fmtEvent(irrigationAt(hour))}</td>
                  <td>${Number.isFinite(battery?.[i]) ? battery[i].toFixed(2) : "—"}</td>
                </tr>`);
            }
        }

        // Pagina o array inteiro — a busca/ordenação acima já roda sobre
        // todas as linhas, só a exibição é fatiada.
        const totalPages = Math.max(1, Math.ceil(rows.length / RAW_PAGE_SIZE));
        rawPage = Math.min(Math.max(1, rawPage), totalPages);
        const startIdx = (rawPage - 1) * RAW_PAGE_SIZE;
        body.innerHTML = rows.slice(startIdx, startIdx + RAW_PAGE_SIZE).join("");
        if (count) count.textContent = `${rows.length} ${t("leituras")}`;

        const pagination = root.querySelector("#cfRawPagination");
        if (pagination) {
            pagination.innerHTML = buildRawPaginationHtml(rawPage, totalPages);
            if (!pagination.dataset.bound) {
                pagination.dataset.bound = "1";
                pagination.addEventListener("click", (e) => {
                    const btn = e.target.closest(".btn-page");
                    if (!btn || btn.disabled || btn.classList.contains("is-static")) return;
                    const target = btn.dataset.page;
                    if (target === "prev") rawPage -= 1;
                    else if (target === "next") rawPage += 1;
                    else rawPage = parseInt(target, 10);
                    renderRawData(root);
                });
            }
        }

        const sortBtn = root.querySelector("#cfRawSort");
        if (sortBtn) {
            sortBtn.dataset.dir = rawSortDir;
            const icon = sortBtn.querySelector("i");
            if (icon) {
                icon.className = rawSortDir === "desc"
                    ? "fa-solid fa-arrow-down-long"
                    : "fa-solid fa-arrow-up-long";
            }
            if (!sortBtn.dataset.bound) {
                sortBtn.dataset.bound = "1";
                sortBtn.addEventListener("click", () => {
                    rawSortDir = rawSortDir === "desc" ? "asc" : "desc";
                    rawPage = 1;
                    renderRawData(root);
                });
            }
        }
    }

    // Exporta a série em CSV. Blob + link temporário: sem servidor no meio.
    // ===== Calendário de irrigação =====
    // Mês exibido no calendário. Os eventos vêm da série do gráfico
    // (histórico), da recomendação (previsão) e de lançamentos manuais.
    let calMonth = new Date();

    function dayKey(date) {
        const d = new Date(date);
        return d.getFullYear() + "-" +
            String(d.getMonth() + 1).padStart(2, "0") + "-" +
            String(d.getDate()).padStart(2, "0");
    }

    function calendarEvents() {
        const map = new Map();
        const series = window.IcCosmofieldChart?.getSeries?.();

        // Histórico: irrigações e chuvas já registradas na série.
        if (series) {
            series.rain.forEach((event, index) => {
                const date = series.dates[index];
                if (!date) return;
                const key = dayKey(date);
                const entry = map.get(key) || { irrigation: 0, rain: 0, planned: false };
                if (event.irrigation) entry.irrigation += event.mm;
                else entry.rain += event.mm;
                map.set(key, entry);
            });
        }

        // Previsão: próxima irrigação recomendada para esta sonda.
        const device = listDevices()[state.deviceIndex];
        const reading = window.IcCosmofieldReading?.(device, state.deviceIndex);
        if (reading) {
            const next = new Date(Date.now() + (reading.seed % 7) * 86400000);
            const key = dayKey(next);
            const entry = map.get(key) || { irrigation: 0, rain: 0, planned: false };
            entry.planned = true;
            const fc = reading.fieldCapacity;
            if (fc !== null && entry.irrigation === 0) {
                entry.plannedMm = Math.max(0, ((fc - reading.moistureValue) / 100) * 400);
            }
            map.set(key, entry);
        }

        // Lançamentos manuais, salvos no próprio equipamento. Substituem o
        // valor simulado do mesmo tipo, preservando o outro: um dia pode ter
        // chuva e irrigação ao mesmo tempo.
        (device?.data?.calendarEvents || []).forEach((item) => {
            const entry = map.get(item.date) || { irrigation: 0, rain: 0, planned: false };
            const mm = Number(item.mm) || 0;
            if (item.type === "irrigation") {
                entry.irrigation = mm;
                entry.manualIrrigation = true;
            } else {
                entry.rain = mm;
                entry.manualRain = true;
            }
            map.set(item.date, entry);
        });

        return map;
    }

    function renderCalendar(root) {
        const grid = root.querySelector("#cfCalGrid");
        const label = root.querySelector("#cfCalMonthLabel");
        const weekdays = root.querySelector("#cfCalWeekdays");
        if (!grid) return;

        const locale = window.IcI18n?.getLocale?.() || "pt-BR";
        const events = calendarEvents();
        const todayKey = dayKey(new Date());

        if (label) {
            label.textContent = calMonth
                .toLocaleDateString(locale, { month: "short", year: "numeric" })
                .replace(/\sde\s/g, " ")
                .replace(/\./g, "");
        }

        // Cabeçalho começa na segunda-feira.
        if (weekdays && !weekdays.dataset.filled) {
            weekdays.dataset.filled = "1";
            const base = new Date(2024, 0, 1);
            weekdays.innerHTML = Array.from({ length: 7 }, (_, i) => {
                const d = new Date(base);
                d.setDate(base.getDate() + i);
                const name = d.toLocaleDateString(locale, { weekday: "short" }).replace(".", "");
                return "<span>" + name + "</span>";
            }).join("");
        }

        const year = calMonth.getFullYear();
        const month = calMonth.getMonth();
        const first = new Date(year, month, 1);
        const offset = (first.getDay() + 6) % 7;
        const start = new Date(year, month, 1 - offset);

        const cells = [];
        for (let i = 0; i < 42; i++) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            const key = dayKey(date);
            const event = events.get(key);

            const classes = ["cf-cal__day"];
            if (date.getMonth() !== month) classes.push("is-outside");
            if (key === todayKey) classes.push("is-today");
            if (event && event.irrigation > 0) classes.push("is-irrigated");
            else if (event && event.planned) classes.push("is-planned");
            if (event && event.rain > 0) classes.push("has-rain");

            const marks = [];
            if (event && event.irrigation > 0) {
                marks.push('<button type="button" class="cf-cal__mark cf-cal__mark--irrigation"' +
                    ' data-cf-mark="irrigation" title="' + escapeHtml(t("Editar irrigação")) + '">' +
                    event.irrigation.toFixed(2) + " mm</button>");
            } else if (event && event.planned) {
                const mm = event.plannedMm ? " " + event.plannedMm.toFixed(2) + " mm" : "";
                marks.push('<span class="cf-cal__mark cf-cal__mark--planned">' +
                    t("Próxima irrigação") + mm + "</span>");
            }
            if (event && event.rain > 0) {
                marks.push('<button type="button" class="cf-cal__mark cf-cal__mark--rain"' +
                    ' data-cf-mark="rain" title="' + escapeHtml(t("Editar chuva")) + '">' +
                    event.rain.toFixed(2) + " mm</button>");
            }

            // Qualquer dia é clicável: com evento, abre para editar; vazio,
            // abre para lançar naquela data.
            cells.push('<div class="' + classes.join(" ") + '" data-date="' + key + '"' +
                ' role="button" tabindex="0"' +
                ' title="' + escapeHtml(t("Clique para lançar ou editar")) + '">' +
                '<span class="cf-cal__daynum">' + date.getDate() + "</span>" +
                marks.join("") + "</div>");
        }

        grid.innerHTML = cells.join("");
    }

    function bindCalendar(root) {
        if (root.dataset.calBound) return;
        root.dataset.calBound = "1";

        const step = (delta) => {
            calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + delta, 1);
            renderCalendar(root);
        };

        root.querySelector("#cfCalPrev")?.addEventListener("click", () => step(-1));
        root.querySelector("#cfCalNext")?.addEventListener("click", () => step(1));
        root.querySelector("#cfCalToday")?.addEventListener("click", () => {
            calMonth = new Date();
            renderCalendar(root);
        });

        // Popover de seleção rápida de mês/ano (clique no rótulo do mês):
        // grade Jan-Dez + navegação por ano, sem abas Year/Month/Week.
        let pickerYear = calMonth.getFullYear();
        const monthBtn = root.querySelector("#cfCalMonth");
        const picker = root.querySelector("#cfCalMonthPicker");
        const pickerYearLabel = root.querySelector("#cfCalPickerYear");
        const pickerGrid = root.querySelector("#cfCalPickerGrid");

        const renderMonthPicker = () => {
            if (!pickerGrid) return;
            const locale = window.IcI18n?.getLocale?.() || "pt-BR";
            if (pickerYearLabel) pickerYearLabel.textContent = String(pickerYear);
            const base = new Date(2024, 0, 1);
            pickerGrid.innerHTML = Array.from({ length: 12 }, (_, i) => {
                const d = new Date(base.getFullYear(), i, 1);
                const name = d.toLocaleDateString(locale, { month: "short" }).replace(".", "");
                const active = pickerYear === calMonth.getFullYear() && i === calMonth.getMonth();
                return '<button type="button" class="cf-cal__month-picker-btn' + (active ? " is-active" : "") +
                    '" data-month="' + i + '">' + escapeHtml(name) + "</button>";
            }).join("");
        };

        const openPicker = () => {
            if (!picker) return;
            pickerYear = calMonth.getFullYear();
            renderMonthPicker();
            picker.hidden = false;
            monthBtn?.setAttribute("aria-expanded", "true");
        };
        const closePicker = () => {
            if (!picker || picker.hidden) return;
            picker.hidden = true;
            monthBtn?.setAttribute("aria-expanded", "false");
        };

        monthBtn?.addEventListener("click", (e) => {
            e.stopPropagation();
            if (picker?.hidden === false) closePicker();
            else openPicker();
        });

        root.querySelector("#cfCalPickerYearPrev")?.addEventListener("click", () => {
            pickerYear -= 1;
            renderMonthPicker();
        });
        root.querySelector("#cfCalPickerYearNext")?.addEventListener("click", () => {
            pickerYear += 1;
            renderMonthPicker();
        });

        pickerGrid?.addEventListener("click", (e) => {
            const btn = e.target.closest(".cf-cal__month-picker-btn");
            if (!btn) return;
            calMonth = new Date(pickerYear, Number(btn.dataset.month), 1);
            renderCalendar(root);
            closePicker();
        });

        document.addEventListener("click", (e) => {
            if (!picker || picker.hidden) return;
            if (picker.contains(e.target) || e.target === monthBtn) return;
            closePicker();
        });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") closePicker();
        });

        // O mesmo botão aparece no Calendário, no gráfico Geral e no Raw
        // Data — todos abrem o mesmo modal.
        root.querySelectorAll("[data-cf-add-event]").forEach((btn) => {
            btn.addEventListener("click", () => openEventModal(root));
        });

        // Lápis no canto da célula: reabre o modal com o lançamento do dia
        // para ajustar ou remover. Delegado, porque as células são
        // reconstruídas a cada troca de mês.
        const grid = root.querySelector("#cfCalGrid");
        const openDay = (cell, type) => {
            const key = cell?.dataset?.date;
            if (key) openEventModal(root, key, type);
        };

        grid?.addEventListener("click", (event) => {
            const cell = event.target.closest(".cf-cal__day");
            if (!cell) return;
            // Clique numa marca edita aquele tipo; no resto da célula, abre
            // o dia sem tipo definido.
            const mark = event.target.closest("[data-cf-mark]");
            openDay(cell, mark?.dataset.cfMark);
        });

        grid?.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            const cell = event.target.closest(".cf-cal__day");
            if (!cell) return;
            event.preventDefault();
            openDay(cell, event.target.closest("[data-cf-mark]")?.dataset.cfMark);
        });
    }

    // Modal de lançamento manual. A irrigação normalmente é registrada pela
    // plataforma; aqui entra o que foi aplicado fora dela, ou uma chuva
    // medida em campo.
    // editDate: dia clicado. editType: "irrigation" ou "rain" quando o
    // clique foi numa marca específica — um dia pode ter as duas.
    // Evento manual salvo ou removido: gráfico, calendário e dados brutos
    // mostram sempre os mesmos dados. Na tela de Detalhes, remonta a tela (o
    // gráfico não pode ser reiniciado sobre o mesmo DOM, senão os cliques da
    // legenda dobram) mantendo o período escolhido; fora dela, atualiza só o
    // calendário e a tabela.
    function refreshAfterEventChange(root) {
        if (root.id === "cosmofieldDetailsPanel" && window.IcCosmofieldDetails?.refresh) {
            window.IcCosmofieldDetails.refresh();
            return;
        }
        renderCalendar(root);
        renderRawData(root);
    }

    function openEventModal(root, editDate, editType) {
        const modal = root.querySelector("#cfEventModal");
        if (!modal) return;

        const dateInput = modal.querySelector("#cfEventDate");
        const mmInput = modal.querySelector("#cfEventMm");
        const device = listDevices()[state.deviceIndex];
        const savedList = (device?.data?.calendarEvents || [])
            .filter((entry) => entry.date === editDate);
        const saved = editDate
            ? (editType
                ? savedList.find((entry) => entry.type === editType)
                : savedList[0])
            : null;

        // Sem lançamento manual, usa o que o dia mostra no calendário: o
        // valor simulado vira o ponto de partida da edição.
        let existing = saved;
        if (!existing && editDate) {
            const day = calendarEvents().get(editDate);
            if (day) {
                const wanted = editType
                    || (day.irrigation > 0 ? "irrigation" : (day.rain > 0 ? "rain" : null));
                const mm = wanted === "irrigation" ? day.irrigation : day.rain;
                if (wanted && mm > 0) existing = { date: editDate, type: wanted, mm };
            }
        }

        // Guarda o que está sendo editado: o confirmar substitui em vez de
        // acrescentar, e o remover sabe o que apagar.
        modal.dataset.editDate = editDate || "";

        // datetime-local espera "yyyy-mm-ddThh:mm".
        if (dateInput) {
            const day = existing?.date || editDate || dayKey(new Date());
            const time = existing?.time || "12:00";
            dateInput.value = `${day}T${time}`;
        }
        if (mmInput) mmInput.value = existing ? String(existing.mm ?? "") : "";


        setEventType(modal, existing?.type || "irrigation");

        const title = modal.querySelector("#cfEventTitle");
        if (title) title.textContent = existing ? t("Editar evento") : t("Adicionar evento");
        const removeBtn = modal.querySelector("#cfEventRemove");
        if (removeBtn) removeBtn.hidden = !saved;

        // O botão acompanha o modo: salvar sobre um dia que já tem valor é
        // "Salvar", não "Adicionar".
        const confirmBtn = modal.querySelector("#cfEventConfirm");
        if (confirmBtn) {
            confirmBtn.innerHTML = '<i class="fa-solid fa-check"></i> ' +
                escapeHtml(existing ? t("Salvar") : t("Adicionar"));
        }

        modal.setAttribute("aria-hidden", "false");
        modal.classList.add("is-open");
        dateInput?.focus();

        if (modal.dataset.bound) return;
        modal.dataset.bound = "1";

        const close = () => {
            modal.setAttribute("aria-hidden", "true");
            modal.classList.remove("is-open");
        };

        modal.querySelectorAll("[data-cf-event-close]").forEach((el) => {
            el.addEventListener("click", close);
        });
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && modal.classList.contains("is-open")) close();
        });

        modal.querySelectorAll("[data-cf-event-type]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const type = btn.dataset.cfEventType;
                if (modal.querySelector("[data-cf-event-type].is-active") === btn) return;

                setEventType(modal, type);
                reloadEventValue(modal, type);
            });
        });

        modal.querySelector("#cfEventConfirm")?.addEventListener("click", () => {
            const type = modal.querySelector("[data-cf-event-type].is-active")?.dataset.cfEventType || "irrigation";
            const stamp = modal.querySelector("#cfEventDate")?.value || "";
            const [date, time] = stamp.split("T");
            const raw = modal.querySelector("#cfEventMm")?.value;
            const mm = Number(String(raw ?? "").replace(",", "."));

            if (!date || !Number.isFinite(mm) || mm <= 0) {
                // Campos obrigatórios: sinaliza em vez de gravar lixo.
                modal.querySelectorAll(".edit-panel__input, .sc-input").forEach((input) => {
                    input.classList.toggle("is-error", !input.value.trim());
                });
                return;
            }

            const device = listDevices()[state.deviceIndex];
            if (!device) return;
            device.data = device.data || {};
            const editing = modal.dataset.editDate || "";
            // Um lançamento manual por tipo por dia: salvar substitui o do
            // mesmo tipo na data escolhida (e o original, se a data mudou).
            // Chuva e irrigação coexistem.
            const list = (device.data.calendarEvents || []).filter(
                (entry) => !(entry.type === type && (entry.date === date || entry.date === editing))
            );
            device.data.calendarEvents = list.concat([
                { date, time: time || "12:00", type, mm },
            ]);

            persistFarm();
            refreshAfterEventChange(root);
            close();
        });

        modal.querySelector("#cfEventRemove")?.addEventListener("click", () => {
            const editing = modal.dataset.editDate || "";
            const device = listDevices()[state.deviceIndex];
            if (!editing || !device) return;

            device.data = device.data || {};
            const openType = modal.querySelector("[data-cf-event-type].is-active")
                ?.dataset.cfEventType || "irrigation";
            device.data.calendarEvents = (device.data.calendarEvents || [])
                .filter((entry) => !(entry.date === editing && entry.type === openType));

            persistFarm();
            refreshAfterEventChange(root);
            close();
        });
    }

    // Recarrega o volume ao trocar o tipo: cada tipo tem o seu lançamento
    // naquele dia, e o valor do outro não se aplica.
    function reloadEventValue(modal, type) {
        const mmInput = modal.querySelector("#cfEventMm");
        if (!mmInput) return;

        const editDate = modal.dataset.editDate || "";
        const device = listDevices()[state.deviceIndex];
        const saved = editDate
            ? (device?.data?.calendarEvents || [])
                .find((entry) => entry.date === editDate && entry.type === type)
            : null;

        let mm = saved ? saved.mm : null;
        if (mm === null && editDate) {
            const day = calendarEvents().get(editDate);
            const value = type === "irrigation" ? day?.irrigation : day?.rain;
            if (value > 0) mm = value;
        }

        mmInput.value = mm === null || mm === undefined ? "" : String(mm);
        mmInput.classList.remove("is-error");

        const title = modal.querySelector("#cfEventTitle");
        if (title) title.textContent = mm ? t("Editar evento") : t("Adicionar evento");

        const removeBtn = modal.querySelector("#cfEventRemove");
        if (removeBtn) removeBtn.hidden = !saved;

        const confirmBtn = modal.querySelector("#cfEventConfirm");
        if (confirmBtn) {
            confirmBtn.innerHTML = '<i class="fa-solid fa-check"></i> ' +
                escapeHtml(mm ? t("Salvar") : t("Adicionar"));
        }
    }

    function setEventType(modal, type) {
        modal.querySelectorAll("[data-cf-event-type]").forEach((btn) => {
            btn.classList.toggle("is-active", btn.dataset.cfEventType === type);
        });
        // Chuva é volume registrado, irrigação é lâmina aplicada.
        const label = modal.querySelector('label[for="cfEventMm"]');
        if (label) {
            label.textContent = type === "rain" ? t("Volume (mm)") : t("Lâmina (mm)");
        }
    }

    // Persiste a fazenda ativa. Usado pelo calendário e pelos Settings.
    function persistFarm() {
        const farm = window.IcFarmGetActive?.() || window.icFarmData || window.IcFarmActive || null;
        if (!farm) return;
        const farms = window.Cad?.data?.getAllFarms?.() || [];
        const index = farms.findIndex((item) => String(item?.id || "") === String(farm.id || ""));
        if (index !== -1) farms[index] = farm;
        window.Cad?.data?.persistFarmDataset?.(index === -1 ? farms.concat([farm]) : farms);
    }

    // PDF: monta uma página e usa a impressão do navegador (o usuário
    // escolhe "Salvar como PDF"). Evita carregar uma biblioteca só pra isso.
    async function exportPdf(root, options = {}) {
        const device = listDevices()[state.deviceIndex];
        const rows = options.includeReadings === false ? null : buildExportRows();
        const image = options.includeChart === false ? null : await chartImage(root);
        const calendar = options.includeCalendar
            ? root.querySelector("#cfCalGrid")?.parentElement?.outerHTML
            : null;

        const win = window.open("", "_blank");
        if (!win) return;

        const esc = (value) => String(value ?? "")
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        const table = rows ? `
            <table>
              <thead><tr>${rows.header.map((h) => "<th>" + esc(h) + "</th>").join("")}</tr></thead>
              <tbody>${rows.data.map((row) =>
                  "<tr>" + row.map((cell) => "<td>" + esc(cell || "—") + "</td>").join("") + "</tr>"
              ).join("")}</tbody>
            </table>` : "";

        win.document.write(`<!doctype html><html><head><meta charset="utf-8">
          <title>${esc(device?.name || "Cosmofield")}</title>
          <style>
            body { font: 12px system-ui, sans-serif; color: #0f172a; padding: 24px; }
            h1 { font-size: 18px; margin: 0 0 16px; }
            img { max-width: 100%; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th, td { padding: 4px 6px; border-bottom: 1px solid #e5e7eb; text-align: left; }
            th { background: #f8fafc; }
            .cf-cal__grid, .cf-cal__weekdays { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
            .cf-cal__day { border: 1px solid #e5e7eb; border-radius: 4px; padding: 4px; min-height: 52px; font-size: 9px; }
            .cf-cal__toolbar, .cf-cal__legend { display: none; }
          </style></head><body>
          <h1>${esc(device?.name || "Cosmofield")}</h1>
          ${image ? '<img src="' + image + '">' : ""}
          ${calendar || ""}
          ${table}
          </body></html>`);
        win.document.close();
        win.focus();
        // Espera o layout assentar antes de abrir o diálogo de impressão.
        setTimeout(() => win.print(), 400);
    }

    // Modal de exportação — mesmo padrão do modal dos relatórios: escolhe
    // o conteúdo e o formato antes de baixar.
    function bindExportModal(root) {
        const modal = root.querySelector("#cfExportModal");
        if (!modal || modal.dataset.bound) return;
        modal.dataset.bound = "1";

        const open = () => {
            modal.setAttribute("aria-hidden", "false");
            modal.classList.add("is-open");
        };
        const close = () => {
            modal.setAttribute("aria-hidden", "true");
            modal.classList.remove("is-open");
        };

        root.querySelector("#cfExportBtn")?.addEventListener("click", open);
        modal.querySelectorAll("[data-cf-export-close]").forEach((el) => {
            el.addEventListener("click", close);
        });
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && modal.classList.contains("is-open")) close();
        });

        // Conteúdo: marca/desmarca mantendo ao menos uma opção ativa.
        modal.querySelectorAll("[data-cf-export-option]").forEach((option) => {
            const input = option.querySelector("input");
            input?.addEventListener("change", () => {
                const checked = modal.querySelectorAll("[data-cf-export-option] input:checked");
                if (!checked.length) {
                    input.checked = true;
                    return;
                }
                option.classList.toggle("is-active", input.checked);
            });
        });

        // Formato: seleção única.
        modal.querySelectorAll("[data-cf-format]").forEach((btn) => {
            btn.addEventListener("click", () => {
                modal.querySelectorAll("[data-cf-format]").forEach((b) => {
                    b.classList.toggle("is-active", b === btn);
                });
            });
        });

        modal.querySelector("#cfExportConfirm")?.addEventListener("click", async () => {
            const format = modal.querySelector("[data-cf-format].is-active")?.dataset.cfFormat || "Excel";
            const picked = (value) => !!modal.querySelector('[data-cf-export-option="' + value + '"] input')?.checked;

            const options = {
                includeReadings: picked("readings"),
                includeChart: picked("chart"),
                includeCalendar: picked("calendar"),
            };

            if (format === "CSV") {
                // CSV é tabular: só as leituras cabem no formato.
                exportRawData(root);
            } else if (format === "PDF") {
                exportPdf(root, options);
            } else {
                await exportExcel(root, options);
            }
            close();
        });
    }

    // Ordem da tabela de dados brutos. Começa pela leitura mais recente,
    // que é a que interessa ao abrir.
    let rawSortDir = "desc";
    // Página atual da tabela de dados brutos — mesmo padrão de paginação
    // do histórico do pivô (.pivo-history__pagination/.btn-page).
    let rawPage = 1;
    const RAW_PAGE_SIZE = 15;

    // Gera os botões de página (anterior, números com reticências, próxima)
    // no mesmo HTML/classes do histórico do pivô, mas com contagem real —
    // lá é mock fixo de 5 páginas, aqui varia com o tamanho da série.
    function buildRawPaginationHtml(current, total) {
        if (total <= 1) return "";
        const pages = new Set([1, total, current, current - 1, current + 1]);
        const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

        let html = `<button type="button" class="btn-page" data-page="prev" aria-label="Página anterior"${current === 1 ? " disabled" : ""}><i class="fa-solid fa-chevron-left"></i></button>`;
        let prev = 0;
        sorted.forEach((p) => {
            if (prev && p - prev > 1) {
                html += `<button type="button" class="btn-page is-static" tabindex="-1" aria-hidden="true">...</button>`;
            }
            const active = p === current;
            html += `<button type="button" class="btn-page${active ? " is-active" : ""}"${active ? ' aria-current="page"' : ""} data-page="${p}">${p}</button>`;
            prev = p;
        });
        html += `<button type="button" class="btn-page" data-page="next" aria-label="Próxima página"${current === total ? " disabled" : ""}><i class="fa-solid fa-chevron-right"></i></button>`;
        return html;
    }

    // Eventos manuais do equipamento, mapeados para o índice do dia dentro
    // da série. Sem isso um lançamento feito pelo botão só aparecia no
    // calendário — a tabela e a exportação leem apenas a série do gráfico.
    function manualByIndex(dates) {
        const map = new Map();
        const device = listDevices()[state.deviceIndex];
        const list = device?.data?.calendarEvents || [];
        if (!list.length) return map;

        const keyOf = (date) => {
            const d = new Date(date);
            return d.getFullYear() + "-" +
                String(d.getMonth() + 1).padStart(2, "0") + "-" +
                String(d.getDate()).padStart(2, "0");
        };

        const byDay = new Map();
        dates.forEach((date, i) => byDay.set(keyOf(date), i));

        list.forEach((item) => {
            const i = byDay.get(item.date);
            if (i === undefined) return;
            const entry = map.get(i) || { rain: 0, irrigation: 0 };
            const mm = Number(item.mm) || 0;
            // Substitui o valor do dia, como no calendário: os dois tipos são
            // independentes e cada um sobrepõe apenas o seu.
            if (item.type === "irrigation") {
                entry.irrigation = mm;
                entry.irrigationHour = item.time ? Number(item.time.slice(0, 2)) : 12;
            } else {
                entry.rain = mm;
                entry.rainHour = item.time ? Number(item.time.slice(0, 2)) : 12;
            }
            map.set(i, entry);
        });

        return map;
    }

    // Monta as linhas de exportação uma única vez: CSV e Excel partem dos
    // mesmos dados, senão os dois formatos divergiriam.
    function buildExportRows() {
        const series = window.IcCosmofieldChart?.getSeries?.();
        if (!series) return null;

        const { dates, values, rain, total, fieldCapacity, wiltingPoint, battery } = series;
        const manual = manualByIndex(dates);
        const hasRange = Number.isFinite(fieldCapacity) && Number.isFinite(wiltingPoint) && fieldCapacity > wiltingPoint;

        const header = [
            t("Data e hora"), t("Umidade do solo (% vol.)"), t("Capacidade de campo (% vol.)"),
            t("Ponto de murcha permanente (% vol.)"), t("Água disponível (%)"), t("Chuva (mm)"), t("Irrigação (mm)"),
            t("Bateria (V)"),
        ];

        const READINGS_PER_DAY = 24;
        // Sem valor: traço, o mesmo padrão da tabela.
        const sumEvent = (mm) => (mm > 0 ? mm.toFixed(2) : "—");
        const data = [];

        for (let i = 0; i < total; i++) {
            const value = values[i];
            const isMissing = series.missing?.has(i);
            // Mesma regra da tabela: sem transmissão mantém a data e os
            // parâmetros do solo; sem dados deixa tudo vazio.
            const noData = isMissing && series.emptyRows?.has(i);
            const noTransmission = isMissing && !noData;
            if (!Number.isFinite(value)) continue;
            const next = Number.isFinite(values[i + 1]) ? values[i + 1] : value;
            const event = rain.get(i);

            for (let hour = 0; hour < READINGS_PER_DAY; hour++) {
                const hourly = value + (next - value) * (hour / READINGS_PER_DAY);
                const available = hasRange
                    ? Math.max(0, Math.min(100, ((hourly - wiltingPoint) / (fieldCapacity - wiltingPoint)) * 100))
                    : "";
                const stamp = new Date(dates[i]);
                stamp.setHours(hour, 0, 0, 0);
                // Não lista horas que ainda não aconteceram.
                if (stamp > new Date()) continue;

                if (noTransmission) {
                    data.push([
                        `${stamp.toISOString().slice(0, 10)} ${String(hour).padStart(2, "0")}:00`,
                        "—",
                        Number.isFinite(fieldCapacity) ? fieldCapacity.toFixed(2) : "—",
                        Number.isFinite(wiltingPoint) ? wiltingPoint.toFixed(2) : "—",
                        "—", "—", "—", "—",
                    ]);
                    continue;
                }

                if (noData) {
                    data.push([`${stamp.toISOString().slice(0, 10)} ${String(hour).padStart(2, "0")}:00`, "—", "—", "—", "—", "—", "—", "—"]);
                    continue;
                }

                // Mesma regra da tabela: o manual substitui o simulado do seu
                // tipo e aparece na hora em que foi lançado.
                const m = manual.get(i);
                const rainAt = (h) => {
                    if (m && m.rain > 0) return (m.rainHour ?? 12) === h ? m.rain : 0;
                    return (h === 12 && event && !event.irrigation) ? event.mm : 0;
                };
                const irrigationAt = (h) => {
                    if (m && m.irrigation > 0) return (m.irrigationHour ?? 12) === h ? m.irrigation : 0;
                    return (h === 12 && event && event.irrigation) ? event.mm : 0;
                };

                data.push([
                    `${stamp.toISOString().slice(0, 10)} ${String(hour).padStart(2, "0")}:00`,
                    hourly.toFixed(2),
                    Number.isFinite(fieldCapacity) ? fieldCapacity.toFixed(2) : "—",
                    Number.isFinite(wiltingPoint) ? wiltingPoint.toFixed(2) : "—",
                    available === "" ? "—" : available.toFixed(2),
                    sumEvent(rainAt(hour)),
                    sumEvent(irrigationAt(hour)),
                    Number.isFinite(battery?.[i]) ? battery[i].toFixed(2) : "—",
                ]);
            }
        }

        // Período sem dados: as colunas vêm com traço, como na tabela.
        if (!data.length) data.push(header.map(() => "—"));

        return { header, data };
    }

    // Exporta em CSV.
    function exportRawData(root) {
        const rows = buildExportRows();
        if (!rows) return;

        const device = listDevices()[state.deviceIndex];
        const NL = String.fromCharCode(10);
        const lines = [rows.header.join(","), ...rows.data.map((row) => row.join(","))];
        downloadFile(lines.join(NL), `cosmofield-${slug(device?.name)}.csv`, "text/csv");
    }


    // Converte o SVG do gráfico em PNG (data URI) para embutir no Excel.
    // Rasteriza num canvas: o SVG inline não é aceito direto pelo Excel.
    function chartImage(root) {
        return new Promise((resolve) => {
            const svg = root.querySelector("#cfChartMainSvg");
            if (!svg) { resolve(null); return; }

            const clone = svg.cloneNode(true);
            const width = svg.clientWidth || 900;
            const height = svg.clientHeight || 340;
            clone.setAttribute("width", width);
            clone.setAttribute("height", height);
            // Fundo branco: sem ele o PNG sai transparente e some na planilha.
            const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            bg.setAttribute("width", "100%");
            bg.setAttribute("height", "100%");
            bg.setAttribute("fill", "#ffffff");
            clone.insertBefore(bg, clone.firstChild);

            const markup = new XMLSerializer().serializeToString(clone);
            const svgUrl = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(markup)));

            const image = new Image();
            image.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = width * 2;
                canvas.height = height * 2;
                const ctx = canvas.getContext("2d");
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL("image/png"));
            };
            image.onerror = () => resolve(null);
            image.src = svgUrl;
        });
    }

    // Exporta em Excel (SpreadsheetML): abre nativamente e aceita a imagem
    // do gráfico embutida, sem depender de biblioteca externa.
    async function exportExcel(root, options = {}) {
        const rows = buildExportRows();
        if (!rows) return;

        const device = listDevices()[state.deviceIndex];
        const image = options.includeChart === false ? null : await chartImage(root);

        const esc = (value) => String(value ?? "")
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        const headerCells = rows.header
            .map((label) => `<Cell ss:StyleID="head"><Data ss:Type="String">${esc(label)}</Data></Cell>`)
            .join("");

        const bodyRows = rows.data.map((row) => `<Row>${row
            .map((cell) => (cell === "" || cell === null
                ? "<Cell/>"
                : (Number.isFinite(Number(cell)) && String(cell).trim() !== ""
                    ? `<Cell><Data ss:Type="Number">${cell}</Data></Cell>`
                    : `<Cell><Data ss:Type="String">${esc(cell)}</Data></Cell>`)))
            .join("")}</Row>`).join("");

        const imageSheet = image
            ? `<Worksheet ss:Name="${esc(t("Gráfico"))}"><Table><Row><Cell><Data ss:Type="String">${esc(t("Umidade do solo"))} — ${esc(device?.name || "")}</Data></Cell></Row></Table>
                 <Pictures xmlns="urn:schemas-microsoft-com:office:spreadsheet">
                   <Picture><Data>${image.split(",")[1]}</Data></Picture>
                 </Pictures></Worksheet>`
            : "";

        const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="head"><Font ss:Bold="1"/><Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/></Style>
 </Styles>
 <Worksheet ss:Name="${esc(t("Leituras"))}">
  <Table>
   <Row>${headerCells}</Row>
   ${bodyRows}
  </Table>
 </Worksheet>
 ${imageSheet}
</Workbook>`;

        downloadFile(xml, `cosmofield-${slug(device?.name)}.xls`, "application/vnd.ms-excel");
    }

    function slug(name) {
        return String(name || "dados").replace(/\s+/g, "-").toLowerCase();
    }

    function downloadFile(content, filename, mime) {
        const BOM = String.fromCharCode(0xFEFF);
        const blob = new Blob([BOM + content], { type: `${mime};charset=utf-8` });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // "lat, lng" -> { loc, lat, lng }. Aceita vírgula decimal.
    function parseLoc(text) {
        const parsed = window.IcGeo?.parseLatLng?.(text);
        if (!parsed) return { loc: text, lat: "", lng: "" };
        return { loc: text, lat: String(parsed.lat), lng: String(parsed.lng) };
    }

    // Endereço a partir das coordenadas do equipamento (Nominatim), no
    // formato "Cidade, Estado, País" — mesmo do create.
    function resolveAddressFromCoords(root, device) {
        const input = root.querySelector("#cfCfgAddress");
        if (!input || input.value.trim()) return;

        const num = (value) => {
            const parsed = Number(String(value ?? "").replace(",", "."));
            return Number.isFinite(parsed) ? parsed : null;
        };

        const parsed = window.IcGeo?.parseLatLng?.(device?.data?.loc || "");
        const lat = num(device?.data?.lat) ?? parsed?.lat;
        const lng = num(device?.data?.lng) ?? parsed?.lng;
        if (lat === null || lat === undefined || lng === null || lng === undefined) return;

        fetch("https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=" +
            lat + "&lon=" + lng + "&zoom=10")
            .then((response) => response.json())
            .then((payload) => {
                const a = payload?.address || {};
                const text = [
                    a.city || a.town || a.village || a.municipality || a.county,
                    a.state,
                    a.country,
                ].filter(Boolean).join(", ");
                // Não sobrescreve se o usuário digitou enquanto a busca corria.
                if (!text || input.value.trim()) return;
                input.value = text;
            })
            .catch(() => { });
    }

    function resolveAltitudeFromCoords(root, device) {
        const input = root.querySelector("#cfCfgAltitude");
        if (!input || input.value.trim()) return;

        const locInput = root.querySelector("#cfCfgLoc");
        const parsed = window.IcGeo?.parseLatLng?.(locInput?.value || device?.data?.loc || "");
        const num = (value) => {
            const parsedNum = Number(String(value ?? "").replace(",", "."));
            return Number.isFinite(parsedNum) ? parsedNum : null;
        };
        const lat = parsed?.lat ?? num(device?.data?.lat) ?? num(device?.lat);
        const lng = parsed?.lng ?? num(device?.data?.lng) ?? num(device?.lng);
        if (lat === null || lng === null) return;

        const key = lat.toFixed(5) + "," + lng.toFixed(5);
        if (altitudeCache.has(key)) {
            input.value = altitudeCache.get(key);
            return;
        }

        fetch("https://api.open-elevation.com/api/v1/lookup?locations=" + lat + "," + lng)
            .then((response) => response.json())
            .then((payload) => {
                if (input.value.trim()) return;
                const elevation = payload?.results?.[0]?.elevation;
                if (!Number.isFinite(elevation)) return;
                const value = String(Math.round(elevation));
                altitudeCache.set(key, value);
                input.value = value;
            })
            .catch(() => { });
    }

    // Mapa de posicionamento nos Settings: clicar move o pino e atualiza os
    // campos de latitude/longitude. Instância própria do Cosmofield — não
    // reaproveita o mapa da visão geral nem o do modal de criar.
    let settingsMap = null;
    let settingsMarker = null;
    const altitudeCache = new Map();

    function renderSettingsMap(root) {
        const mapEl = root.querySelector("#cfCfgMap");
        if (!mapEl || !window.L) return;

        const locInput = root.querySelector("#cfCfgLoc");
        const num = (value) => {
            const parsed = Number(String(value ?? "").replace(",", "."));
            return Number.isFinite(parsed) ? parsed : null;
        };

        const device = listDevices()[state.deviceIndex];
        const fromField = window.IcGeo?.parseLatLng?.(locInput?.value || "");
        const lat = fromField?.lat ?? num(device?.data?.lat);
        const lng = fromField?.lng ?? num(device?.data?.lng);

        const farm = window.IcFarmGetActive?.() || window.icFarmData || window.IcFarmActive || null;
        const center = (lat !== null && lng !== null)
            ? [lat, lng]
            : [num(farm?.lat) ?? -16.767, num(farm?.lng) ?? -47.613];

        // Recria a cada troca de sonda: o Leaflet não reposiciona sozinho
        // quando o container é reaproveitado com outro equipamento.
        if (settingsMap) {
            try { settingsMap.remove(); } catch (_) { }
            settingsMap = null;
            settingsMarker = null;
        }

        // Mesmo padrão do mapa de localização do edit de pivô: controle de
        // zoom visível e scroll só com Ctrl, pra não "roubar" o scroll da
        // página quando o usuário passa o mouse por cima sem querer navegar.
        settingsMap = L.map(mapEl, { zoomControl: true, scrollWheelZoom: false }).setView(center, lat !== null ? 15 : 12);

        mapEl.addEventListener("wheel", (e) => {
            if (e.ctrlKey) {
                settingsMap.scrollWheelZoom.enable();
            } else {
                settingsMap.scrollWheelZoom.disable();
            }
        });

        L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            { maxZoom: 19, attribution: "Tiles © Esri" }
        ).addTo(settingsMap);

        L.tileLayer(
            "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
            { maxZoom: 19, opacity: 0.85 }
        ).addTo(settingsMap);

        // Mesmos contornos do create (pivôs setoriais como fatia, LineStar
        // como corredor): reusa o helper em vez de duplicar a geometria.
        window.IcEquipamentos?.cosmofield?.drawIrrigationOutlines?.(settingsMap);

        const icon = window.IcMapIcons?.pinIcon?.();
        // Arrastável, como no create: clicar posiciona grosso, arrastar
        // ajusta fino.
        const markerOpts = { draggable: true, autoPan: true };
        if (icon) markerOpts.icon = icon;
        settingsMarker = L.marker(center, markerOpts).addTo(settingsMap);

        const applyLatLng = (nextLat, nextLng) => {
            settingsMarker.setLatLng([nextLat, nextLng]);
            if (locInput) locInput.value = `${nextLat.toFixed(6)}, ${nextLng.toFixed(6)}`;
        };

        settingsMap.on("click", (event) => applyLatLng(event.latlng.lat, event.latlng.lng));

        settingsMarker.on("dragend", () => {
            const { lat: dragLat, lng: dragLng } = settingsMarker.getLatLng();
            applyLatLng(dragLat, dragLng);
        });

        // Coordenada digitada: o pino acompanha o campo; ao sair do campo o
        // texto volta com 6 casas decimais, como no clique no mapa. Atribuído
        // por propriedade para não empilhar listeners quando o mapa é refeito.
        if (locInput) {
            locInput.oninput = () => {
                const point = window.IcGeo?.parseLatLng?.(locInput.value || "");
                if (!point) return;
                settingsMarker.setLatLng([point.lat, point.lng]);
                settingsMap.panTo([point.lat, point.lng]);
            };
            locInput.onchange = () => {
                const point = window.IcGeo?.parseLatLng?.(locInput.value || "");
                if (point) applyLatLng(point.lat, point.lng);
            };
        }

        // O container tem largura zero enquanto a aba está oculta: sem medir
        // de novo ao exibir, o Leaflet desenha só uma faixa de tiles.
        const remeasure = () => settingsMap?.invalidateSize();
        setTimeout(remeasure, 60);
        setTimeout(remeasure, 240);
        if (window.ResizeObserver && !mapEl.dataset.observed) {
            mapEl.dataset.observed = "1";
            new ResizeObserver(remeasure).observe(mapEl);
        }

        // Botão "Obter localização": usa o GPS do dispositivo.
        const locBtn = root.querySelector("#cfCfgUseLoc");
        if (locBtn && navigator.geolocation && !locBtn.dataset.bound) {
            locBtn.dataset.bound = "1";
            locBtn.addEventListener("click", () => {
                locBtn.disabled = true;
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const { latitude, longitude } = pos.coords;
                        const currentLoc = root.querySelector("#cfCfgLoc");
                        if (currentLoc) currentLoc.value = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
                        settingsMarker?.setLatLng([latitude, longitude]);
                        settingsMap?.setView([latitude, longitude], 17);
                        locBtn.disabled = false;
                    },
                    () => { locBtn.disabled = false; },
                    { enableHighAccuracy: true, timeout: 8000 }
                );
            });
        }

        const altBtn = root.querySelector("#cfCfgCalcAltitude");
        const altInput = root.querySelector("#cfCfgAltitude");
        if (altBtn && altInput && !altBtn.dataset.bound) {
            altBtn.dataset.bound = "1";
            altBtn.addEventListener("click", () => {
                const currentLoc = root.querySelector("#cfCfgLoc");
                const currentDevice = listDevices()[state.deviceIndex];
                const fromField = window.IcGeo?.parseLatLng?.(currentLoc?.value || "");
                const deviceLat = num(currentDevice?.data?.lat);
                const deviceLng = num(currentDevice?.data?.lng);
                const point = fromField
                    || ((deviceLat !== null && deviceLng !== null) ? { lat: deviceLat, lng: deviceLng } : null);

                const resolve = (pointLat, pointLng) => {
                    altBtn.disabled = true;
                    fetch("https://api.open-elevation.com/api/v1/lookup?locations=" + pointLat + "," + pointLng)
                        .then((response) => response.json())
                        .then((payload) => {
                            const elevation = payload?.results?.[0]?.elevation;
                            if (Number.isFinite(elevation)) altInput.value = String(Math.round(elevation));
                        })
                        .catch(() => { })
                        .finally(() => { altBtn.disabled = false; });
                };

                if (point) {
                    resolve(point.lat, point.lng);
                } else if (navigator.geolocation) {
                    altBtn.disabled = true;
                    navigator.geolocation.getCurrentPosition(
                        (pos) => resolve(pos.coords.latitude, pos.coords.longitude),
                        () => { altBtn.disabled = false; },
                        { enableHighAccuracy: true, timeout: 8000 }
                    );
                }
            });
        }
    }

    // Automático calcula a escala; manual usa os limites digitados. Os
    // campos ficam bloqueados no automático pra deixar claro que não têm
    // efeito ali.
    function syncYScaleFields(root) {
        const mode = root.querySelector("#cfCfgYMode")?.value || "auto";
        const manual = mode === "manual";
        ["cfCfgYMax", "cfCfgYRightMax", "cfCfgYBattMax"].forEach((id) => {
            const field = root.querySelector(`#${id}`);
            if (!field) return;
            field.disabled = !manual;
            // Modo automático: sem texto de placeholder — só o ícone de
            // cadeado (CSS, via .edit-panel__field.is-disabled) já indica
            // que o campo está bloqueado.
            field.placeholder = "";
            field.closest(".edit-panel__field")?.classList.toggle("is-disabled", !manual);
        });
    }

    // Grava no equipamento e propaga: mapa, card e KPIs passam a refletir os
    // novos parâmetros de solo imediatamente.
    function saveDeviceSettings(root) {
        const device = listDevices()[state.deviceIndex];
        if (!device) return false;

        const val = (id) => root.querySelector(`#${id}`)?.value?.trim() ?? "";
        const cropType = val("cfCfgCropType");
        const rawLinkedPivotId = val("cfCfgLinkedPivot");
        const linkedPivotId = rawLinkedPivotId === NO_LINKED_EQUIPMENT ? "" : rawLinkedPivotId;
        const linkedPivot = irrigationEquipments().find((item) => String(item?.id ?? "") === String(linkedPivotId));

        // Sonda própria não tem equipamento vinculado, então o nome fica vazio.
        const rainGaugeId = root.querySelector("#cfCfgRainGauge")?.value || NO_RAIN;
        const rainGauge = (rainGaugeId === OWN_RAIN_GAUGE || rainGaugeId === WEATHER_API_RAIN || rainGaugeId === NO_RAIN)
            ? null
            : rainGaugeEquipments().find((item) => String(item?.id ?? "") === String(rainGaugeId));
        device.name = val("cfCfgName") || device.name;
        device.data = {
            ...(device.data || {}),
            name: val("cfCfgName"),
            installationId: val("cfCfgInstallationId"),
            accessKey: val("cfCfgAccessKey"),
            address: val("cfCfgAddress"),
            ...parseLoc(val("cfCfgLoc")),
            altitude: val("cfCfgAltitude"),
            firstInstallAt: cropHandler()?.brDateTimeToIso?.(val("cfCfgInstallDate")) || "",
            country: root.querySelector("#cfCfgCountry")?.value || "",
            timezone: root.querySelector("#cfCfgTz")?.value || "",
            fieldCapacity: val("cfCfgFieldCap"),
            wiltingPoint: val("cfCfgWilting"),
            targetIrrigation: val("cfCfgTarget"),
            triggerIrrigation: val("cfCfgTrigger"),
            cropType: cropType === NO_LINKED_EQUIPMENT ? "" : cropType,
            soilPreset: root.querySelector("#cfCfgSoilPreset")?.value || "",
            linkedPivotId,
            linkedPivotName: linkedPivot ? equipmentName(linkedPivot, t("Pivô")) : "",
            rainGaugeId,
            rainGaugeName: rainGauge ? equipmentName(rainGauge, t("Pluviômetro")) : "",
            sowingDate: window.IcDateInput?.getDateValue?.(root.querySelector("#cfCfgSowing")) ?? "",
            harvestDate: window.IcDateInput?.getDateValue?.(root.querySelector("#cfCfgHarvest")) ?? "",
            yMax: val("cfCfgYMax"),
            yRightMax: val("cfCfgYRightMax"),
            yBattMax: val("cfCfgYBattMax"),
            yMode: root.querySelector("#cfCfgYMode")?.value || "auto",
        };

        // Persiste o dataset inteiro (API do projeto) e propaga para o mapa e
        // o card. Só o equipamento Cosmofield foi alterado.
        const farm = window.IcFarmGetActive?.() || window.icFarmData || window.IcFarmActive || null;
        if (farm) {
            const farms = window.Cad?.data?.getAllFarms?.() || [];
            const index = farms.findIndex((item) => String(item?.id || "") === String(farm.id || ""));
            if (index !== -1) farms[index] = farm;
            window.Cad?.data?.persistFarmDataset?.(index === -1 ? [...farms, farm] : farms);

            window.IcMapRenderPivots?.(farm);
            window.CreateFarm?.view?.render?.renderEquipmentPanels?.(farm);
        }

        renderDeviceSelect(root);
        // Parâmetros de solo mudaram: série e linhas de referência acompanham,
        // e só então os KPIs leem os novos valores.
        window.IcCosmofieldChart?.init(root, chartConfig(device, state.deviceIndex));
        renderDeviceData(root);
        return true;
    }

    function escapeHtml(str) {
        return String(str ?? "").replace(/[&<>"']/g, (ch) => (
            { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
        ));
    }

    // Dropdown do seletor de equipamento.
    function bindDeviceSelect(root) {
        const field = root.querySelector("[data-cf-device-select]");
        if (!field || field.dataset.bound) return;
        field.dataset.bound = "1";

        const trigger = field.querySelector("[data-select-trigger]");
        trigger?.addEventListener("click", (event) => {
            event.stopPropagation();
            field.classList.toggle("is-open");
            trigger.setAttribute("aria-expanded", field.classList.contains("is-open") ? "true" : "false");
        });

        document.addEventListener("click", (event) => {
            if (!field.contains(event.target)) field.classList.remove("is-open");
        });
    }

    // O seletor de equipamento vale nas duas abas — é como se escolhe a
    // sonda. Só o Salvar é exclusivo das Configurações: o Painel é leitura.
    function syncTabsActions(root, tab) {
        // Geral exporta (é leitura), Configurações salva, Histórico não tem ação.
        const saveBtn = root.querySelector("#cfCfgSaveBtn");
        const exportBtn = root.querySelector("#cfExportBtn");
        if (saveBtn) saveBtn.hidden = tab !== "config";
        if (exportBtn) exportBtn.hidden = tab !== "general";
    }

    // root explícito no overlay do Editar: lá o painel é montado fora do
    // #pageSlot e não pode depender de qual #cosmofieldPanel vem primeiro.
    function bindUI(root = $("cosmofieldPanel")) {
        if (!root) return;

        // Aberto pelo Editar da tela de Detalhes, o painel é um overlay por
        // cima dela: o Voltar fecha só o overlay e devolve pros Detalhes.
        const btnBack = root.querySelector("#cosmofieldBack");
        if (btnBack) {
            btnBack.addEventListener("click", () => {
                if (root.closest("#" + EDIT_OVERLAY_ID)) closeEdit();
                else window.IcCosmofield?.close();
            });
        }

        // Cada .edit-panel__body (Dashboard / Configurações) tem seu próprio
        // aside + seções — escopado por body pra não interferir uma na outra.
        root.querySelectorAll(".edit-panel__body").forEach((body) => {
            const navItems = body.querySelectorAll(".edit-panel__nav-item");
            const sections = body.querySelectorAll(".edit-panel__section");
            navItems.forEach((btn) => {
                btn.addEventListener("click", () => {
                    const target = body.querySelector(btn.getAttribute("data-target"));
                    if (!target) return;
                    navItems.forEach((b) => b.classList.remove("is-active"));
                    sections.forEach((s) => s.classList.remove("is-active"));
                    btn.classList.add("is-active");
                    target.classList.add("is-active");
                });
            });
        });

        // Histórico — expandir/recolher os detalhes de cada linha
        root.querySelectorAll("[data-toggle-details]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const row = document.getElementById(`details-${btn.dataset.toggleDetails}`);
                if (!row) return;
                const open = row.style.display !== "none";
                row.style.display = open ? "none" : "table-row";
                const icon = btn.querySelector("i");
                if (icon) icon.className = open ? "fa-solid fa-plus" : "fa-solid fa-minus";
            });
        });

        // Histórico — estrela marca/desmarca favorito (visual no mockup).
        root.querySelectorAll("[data-cf-fav]").forEach((star) => {
            star.addEventListener("click", () => {
                const on = star.classList.contains("fa-regular");
                star.classList.toggle("fa-regular", !on);
                star.classList.toggle("fa-solid", on);
                star.classList.toggle("is-favorite", on);
                star.title = on ? t("Remover dos favoritos") : t("Favoritar");
            });
        });

        // Histórico — Restaurar carrega os valores da linha na aba
        // Configurações, sem salvar: o usuário revisa e clica em Salvar.
        root.querySelectorAll("[data-cf-restore]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const row = btn.closest("tr");
                if (!row) return;
                const fill = (id, value) => {
                    const field = root.querySelector("#" + id);
                    if (field && value !== undefined) field.value = value;
                };
                fill("cfCfgName", row.dataset.cfName);
                fill("cfCfgFieldCap", row.dataset.cfFc);
                fill("cfCfgWilting", row.dataset.cfWp);
                fill("cfCfgTarget", row.dataset.cfTarget);
                fill("cfCfgTrigger", row.dataset.cfTrigger);
                root.querySelector('.edit-panel__tab[data-tab="config"]')?.click();
            });
        });

        // Abas superiores (Geral / Configurações / Histórico)
        const tabs = root.querySelectorAll(".edit-panel__tab");
        tabs.forEach((tab) => {
            tab.addEventListener("click", () => {
                const targetTab = tab.getAttribute("data-tab");
                if (!targetTab) return;
                tabs.forEach((btn) => {
                    const active = btn === tab;
                    btn.classList.toggle("is-active", active);
                    btn.setAttribute("aria-selected", active ? "true" : "false");
                });
                root.querySelectorAll("[data-tab-body]").forEach((body) => {
                    body.classList.toggle("is-active", body.getAttribute("data-tab-body") === targetTab);
                });
                syncTabsActions(root, targetTab);
                // O mapa dos Settings só mede certo quando visível.
                if (targetTab === "config") setTimeout(() => settingsMap?.invalidateSize(), 80);
            });
        });

        bindDeviceSelect(root);
        renderDeviceSelect(root);

        // ── Aba Geral omitida (Dashboard / Calendário / Dados brutos) ──
        // O conteúdo agora vive na tela de Detalhes (cosmofield-details.js),
        // que chama estas mesmas funções via IcCosmofield.general. Mantido
        // comentado, não apagado, junto com o markup em cosmofield.html.
        //
        // // Constrói o gráfico antes de tudo que depende da série dele.
        // const initialDevices = listDevices();
        // if (initialDevices.length) {
        //     window.IcCosmofieldChart?.init(root, chartConfig(initialDevices[state.deviceIndex], state.deviceIndex));
        // }

        // Preenche também a "Última comunicação" das seções de Configurações.
        renderDeviceData(root);
        renderDeviceSettings(root);
        // renderRawData(root);
        //
        // // Mudou o zoom do gráfico: a tabela acompanha o mesmo recorte.
        // if (!root.dataset.windowBound) {
        //     root.dataset.windowBound = "1";
        //     window.addEventListener("ic:cosmofield-window", () => renderRawData(root));
        // }

        // Estado inicial: a aba ativa no markup (Configurações, sem a Geral).
        syncTabsActions(root, root.querySelector(".edit-panel__tab.is-active")?.dataset.tab || "config");

        // renderCalendar(root);
        // bindCalendar(root);
        //
        // // Exportação: um único botão na barra, que abre o modal de seleção.
        // bindExportModal(root);

        bindConfigSelects(root);
        bindSaveButton(root);
        // bindInfoModal(root);
    }

    // Botão "Salvar" único no topo (tabs bar) — mesmo padrão do editar pivô:
    // troca o rótulo por "Salvo!" por um instante ao clicar.
    function bindSaveButton(root) {
        const btn = root.querySelector("#cfCfgSaveBtn");
        if (!btn || btn.dataset.bound) return;
        btn.dataset.bound = "1";
        const originalHtml = btn.innerHTML;
        btn.addEventListener("click", () => {
            // O alvo tem de ser maior que o gatilho: bloqueia o Salvar.
            const toNum = (id) => Number(String(root.querySelector("#" + id)?.value ?? "").replace(",", "."));
            const targetField = root.querySelector("#cfCfgTarget");
            const triggerField = root.querySelector("#cfCfgTrigger");
            const targetValue = toNum("cfCfgTarget");
            const triggerValue = toNum("cfCfgTrigger");
            const invalidTarget = targetField?.value.trim() && triggerField?.value.trim()
                && Number.isFinite(targetValue) && Number.isFinite(triggerValue)
                && targetValue <= triggerValue;
            targetField?.classList.toggle("is-error", !!invalidTarget);
            if (invalidTarget) {
                btn.disabled = true;
                btn.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${t("Alvo deve ser maior que o gatilho")}`;
                setTimeout(() => {
                    btn.innerHTML = originalHtml;
                    btn.disabled = false;
                }, 2200);
                return;
            }

            // Grava de fato no equipamento antes do feedback visual: antes o
            // botão só trocava o rótulo e as edições se perdiam.
            const saved = saveDeviceSettings(root);
            btn.disabled = true;
            btn.innerHTML = saved
                ? `<i class="fa-solid fa-check"></i> ${t("Salvo!")}`
                : `<i class="fa-solid fa-triangle-exclamation"></i> ${t("Nada para salvar")}`;
            setTimeout(() => {
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            }, 900);
        });
    }

    // Abre/fecha os selects da aba Configurações (.edit-panel__select-field,
    // mesmo padrão usado em fazenda-edit/pivo-edit).
    function bindConfigSelects(root) {
        const selects = root.querySelectorAll("[data-cf-select]");
        selects.forEach((field) => {
            const trigger = field.querySelector("[data-select-trigger]");
            const menu = field.querySelector(".edit-panel__select-menu");
            const hidden = field.querySelector("input[type='hidden']");
            if (!trigger || !menu) return;

            trigger.addEventListener("click", (e) => {
                e.stopPropagation();
                const isOpen = field.classList.contains("is-open");
                selects.forEach((f) => f.classList.remove("is-open"));
                field.classList.toggle("is-open", !isOpen);
            });

            menu.querySelectorAll(".edit-panel__select-option").forEach((opt) => {
                opt.addEventListener("click", () => {
                    menu.querySelectorAll(".edit-panel__select-option").forEach((o) => o.classList.remove("is-active"));
                    opt.classList.add("is-active");
                    trigger.textContent = opt.textContent;
                    if (hidden) hidden.value = opt.getAttribute("data-value") || opt.textContent;
                    field.classList.remove("is-open");
                });
            });
        });

        document.addEventListener("click", (e) => {
            if (e.target.closest("[data-cf-select]")) return;
            selects.forEach((f) => f.classList.remove("is-open"));
        });
    }

    function bindInfoModal(root) {
        const modal = root.querySelector("#cfInfoModal");
        const openBtn = root.querySelector("#cfAdviceInfoBtn");
        if (!modal || !openBtn) return;

        const closeTriggers = modal.querySelectorAll("[data-cf-modal-close]");

        function openModal() {
            modal.classList.add("is-open");
            modal.setAttribute("aria-hidden", "false");
            document.body.classList.add("is-modal-open");
        }

        function closeModal() {
            modal.classList.remove("is-open");
            modal.setAttribute("aria-hidden", "true");
            document.body.classList.remove("is-modal-open");
        }

        openBtn.addEventListener("click", openModal);
        closeTriggers.forEach((el) => el.addEventListener("click", closeModal));

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
        });
    }

    // O HTML da tela não muda entre aberturas: buscar de novo a cada clique
    // custava uma ida ao servidor antes de qualquer pixel aparecer. Guarda a
    // promise (não o texto) pra que cliques rápidos seguidos compartilhem a
    // mesma requisição em vez de dispararem várias.
    let markupPromise = null;
    let markupText = null;

    function loadMarkup() {
        if (!markupPromise) {
            markupPromise = fetch("./pages/cosmofield.html")
                .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
                .then((text) => { markupText = text; return text; })
                .catch((err) => { markupPromise = null; throw err; });
        }
        return markupPromise;
    }

    // Pré-carrega o markup assim que o módulo sobe: quando o usuário clica,
    // o HTML já está em memória e a tela monta sem await nenhum.
    loadMarkup().catch(() => { });

    async function open(options = {}) {
        focusDevice(options.equipId);
        const alreadyMounted = !!document.getElementById('cosmofieldPanel');
        if (state.isOpen && alreadyMounted) return;
        state.isOpen = true;

        document.body.classList.add("is-farm-edit");
        const mapCard = $("mapCard");
        if (mapCard) mapCard.style.display = "none";

        try {
            const slot = $("pageSlot");
            if (slot) {
                // Com o markup em cache, monta na mesma tarefa do clique —
                // sem await, sem frame perdido antes de aparecer.
                slot.innerHTML = markupText ?? await loadMarkup();
                bindUI();
            }
            window.dispatchEvent(new Event("ic:layout-change"));
        } catch (err) {
            console.error("IcCosmofield: failed to open", err);
            state.isOpen = false;
            document.body.classList.remove("is-farm-edit");
            if (mapCard) mapCard.style.display = "";
        }
    }

    function close() {
        state.isOpen = false;
        closeEdit({ silent: true });
        // As rotas que fecham o Cosmofield (visão geral, notificações,
        // telemetria, mapa) fecham também a tela de Detalhes dele.
        window.IcCosmofieldDetails?.close?.();
        document.body.classList.remove("is-farm-edit");
        const slot = $("pageSlot");
        if (slot) slot.innerHTML = "";
        const mapCard = $("mapCard");
        if (mapCard) mapCard.style.display = "";
        const map = window.icMap;
        if (map && typeof map.invalidateSize === "function") {
            map.invalidateSize({ pan: false });
        }
    }

    // ===== Editar (overlay por cima da tela de Detalhes) =====
    // Mesmo padrão do IcEstacaoEdit: o painel de sempre (cosmofield.html)
    // desliza da direita por cima dos Detalhes, sem tocar no #pageSlot, e
    // abre direto na aba pedida (Configurações por padrão).
    const EDIT_OVERLAY_ID = "cfEditOverlay";
    let editRemoveTimer = null;
    let editResizeObserver = null;

    async function openEdit(options = {}) {
        focusDevice(options.equipId);
        const tab = ["config", "history"].includes(options.tab) ? options.tab : "config";

        // Reabriu antes de terminar a animação de saída: reaproveita o overlay.
        if (editRemoveTimer) {
            clearTimeout(editRemoveTimer);
            editRemoveTimer = null;
        }

        let overlay = $(EDIT_OVERLAY_ID);
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.id = EDIT_OVERLAY_ID;
            overlay.className = "config-overlay";
            overlay.style.zIndex = 1200 + document.querySelectorAll(".config-overlay").length;
            document.body.appendChild(overlay);
        }

        const positionOverlay = window.IcOverlay?.positionOverlay;
        if (positionOverlay) positionOverlay(overlay);
        editResizeObserver?.disconnect();
        const mainEl = document.querySelector(".main");
        if (mainEl && positionOverlay && typeof ResizeObserver === "function") {
            editResizeObserver = new ResizeObserver(() => positionOverlay(overlay));
            editResizeObserver.observe(mainEl);
        }

        try {
            overlay.innerHTML = `<div class="config-page">${markupText ?? await loadMarkup()}</div>`;
        } catch (err) {
            console.error("IcCosmofieldEdit: failed to open", err);
            editResizeObserver?.disconnect();
            editResizeObserver = null;
            overlay.remove();
            return;
        }

        bindUI(overlay.querySelector("#cosmofieldPanel"));
        overlay.querySelector(`.edit-panel__tab[data-tab="${tab}"]`)?.click();
        window.dispatchEvent(new Event("ic:layout-change"));

        requestAnimationFrame(() => {
            requestAnimationFrame(() => overlay.classList.add("is-open"));
        });
    }

    // silent: fechado junto com a tela de baixo (troca de rota), sem
    // re-renderizar os Detalhes que estão saindo.
    function closeEdit(options = {}) {
        const overlay = $(EDIT_OVERLAY_ID);
        // Já saindo (animação de 320 ms em curso): nada a refazer.
        if (!overlay || (editRemoveTimer && !overlay.classList.contains("is-open"))) return;
        editResizeObserver?.disconnect();
        editResizeObserver = null;
        overlay.classList.remove("is-open");
        clearTimeout(editRemoveTimer);
        editRemoveTimer = setTimeout(() => {
            editRemoveTimer = null;
            overlay.remove();
        }, 320);
        if (settingsMap) {
            try { settingsMap.remove(); } catch (_) { }
            settingsMap = null;
        }
        // O que foi salvo (solo, cultura, escala, sonda escolhida no seletor)
        // tem de aparecer nos Detalhes ao voltar.
        if (!options.silent) window.IcCosmofieldDetails?.refresh?.();
    }

    // Renderizadores da aba Geral, expostos para a tela de Detalhes
    // (cosmofield-details.js) montar o mesmo dashboard, calendário e dados
    // brutos sem duplicar a lógica — tudo aqui trabalha sobre o root que
    // recebe, então serve igual às duas telas.
    const general = {
        listDevices,
        alphabeticalDevices,
        focusDevice,
        getDeviceIndex: () => state.deviceIndex,
        setDeviceIndex: (index) => {
            const devices = listDevices();
            if (Number.isInteger(index) && index >= 0 && index < devices.length) state.deviceIndex = index;
        },
        chartConfig,
        renderDeviceData,
        renderRawData,
        renderCalendar,
        bindCalendar,
        bindExportModal,
        bindInfoModal,
    };

    window.IcCosmofield = { open, close, general };
    window.IcCosmofieldEdit = { open: openEdit, close: closeEdit };
})();
