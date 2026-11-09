// assets/js/pages/pivos/view.details.js
(function () {
    "use strict";

    const Pivos = (window.Pivos = window.Pivos || {});
    const state = (Pivos.state = Pivos.state || {});
    const views = (Pivos.views = Pivos.views || {});
    const detailsView = (views.details = views.details || {});
    const detailVariants = (views.detailVariants = views.detailVariants || {});
    const $ = (id) => document.getElementById(id);

    // Cache dos templates HTML das telas de pivô, compartilhado entre detalhes
    // e edição. Eles são estáticos e somam ~200 KB; sem cache, cada ida do
    // modal para os detalhes e daí para a edição rebaixava tudo de novo, o que
    // dava a sensação de travamento. Guarda a promessa, e não só o texto, para
    // que chamadas simultâneas reaproveitem a mesma requisição.
    const templateCache = (Pivos._templateCache = Pivos._templateCache || new Map());
    async function loadTemplateCached(path) {
        const key = String(path || "");
        if (!templateCache.has(key)) {
            const pending = fetch(key)
                .then((r) => {
                    if (!r.ok) throw new Error(`HTTP ${r.status}`);
                    return r.text();
                })
                .catch((err) => {
                    // Não guarda falha: a próxima tentativa refaz a busca.
                    templateCache.delete(key);
                    throw err;
                });
            templateCache.set(key, pending);
        }
        return templateCache.get(key);
    }
    Pivos._loadTemplateCached = loadTemplateCached;

    // Pré-carrega os templates das telas de pivô assim que a página fica ociosa.
    // Eles somam ~200 KB e antes só eram buscados no momento em que o usuário
    // clicava, o que deixava a primeira ida do modal para os detalhes, e daí
    // para a edição, com uma espera visível. Buscar antes torna essas aberturas
    // instantâneas; falhas são ignoradas de propósito, porque o carregamento
    // sob demanda continua valendo como caminho normal.
    (function preloadPivotTemplates() {
        const paths = [
            "./pages/pivo.details.html",
            "./pages/pivo-edit.html",
            "./pages/pivo-smarttouch-edit.html",
            "./pages/pivo-smarttouch.details.html",
        ];
        const run = () => paths.forEach((p) => { loadTemplateCached(p).catch(() => { }); });
        if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: 3000 });
        else setTimeout(run, 1200);
    })();
    const PT_TO_EN_MONTHS = Object.freeze({
        jan: "Jan",
        fev: "Feb",
        mar: "Mar",
        abr: "Apr",
        mai: "May",
        jun: "Jun",
        jul: "Jul",
        ago: "Aug",
        set: "Sep",
        out: "Oct",
        nov: "Nov",
        dez: "Dec",
    });
    const PT_TO_ES_MONTHS = Object.freeze({
        jan: "ene",
        fev: "feb",
        mar: "mar",
        abr: "abr",
        mai: "may",
        jun: "jun",
        jul: "jul",
        ago: "ago",
        set: "sep",
        out: "oct",
        nov: "nov",
        dez: "dic",
    });
    const DETAILS_COPY = Object.freeze({
        pt: {
            english: false,
            back: "Voltar",
            selectOtherPivot: "Selecionar outro pivô",
            panelEnergized: "PAINEL ENERGIZADO",
            lastCommunication: "Última comunicação",
            angle: "Ângulo",
            centerPressure: "Pressão Centro",
            hours: "Horas",
            voltage: "Tensão",
            turnCount: "Número de Voltas",
            maintenance: "Manutenção",
            agronomic: "Agronômico",
            weather: "Clima",
            edit: "Editar",
            startPivot: "Iniciar Pivô",
            stopPivot: "Parar Pivô",
            period: "Período",
            last24h: "Últimas 24h",
            events: "Eventos",
            operations: "Operações",
            filter: "Filtrar",
            refresh: "Atualizar",
            occurrence: "Ocorrência",
            type: "Tipo",
            status: "Status",
            pivots: "Pivôs",
            pumps: "Bombas",
            levelMeters: "Medidores de Nível",
            weatherStation: "Estação Meteorológica",
            noEquipment: "Nenhum equipamento encontrado.",
            update: "Atualização",
            alert: "Alerta",
            confirmation: "Confirmação",
            changeConfiguration: "ALTERAR CONFIGURAÇÃO",
            noCommunication: "SEM COMUNICAÇÃO",
            stoppedReverse: "PARADO | REVERSO",
            operation: "Operação",
            user: "Usuário",
            command: "Comando",
            positionAndMovement: "Posição e Movimento",
            lastTowerRadius: "Raio na última torre",
            sectorStart: "Começo do setor",
            sectorEnd: "Fim do setor",
            positionZero: "Posição 0",
            pressureDataGeneratedBetween: "Dados de pressão gerado entre",
            comparisonDataGeneratedBetween: "Dados de comparação gerado entre",
            depthAngle: "Lâmina x Ângulo",
            currentPressure: "Pressão Atual",
            pressureComparison: "Comparação de Pressão",
            pressure: "Pressão",
            consumption: "Consumo",
            totalVolume: "Volume Total",
            totalVolumeLastMonth: "Volume Total no Último Mês",
            totalWorkHours: "Horas Totais de Trabalho",
            totalWorkHoursLastMonth: "Horas Totais de Trabalho no Último Mês",
            wetWorkHours: "Horas de Trabalho - Molhado",
            energyCosts: "Custos em Energia",
            peakHour: "Horário de Pico",
            offPeak: "Fora do Horário de Pico",
            reduced: "Reduzido",
            previousPage: "Página anterior",
            nextPage: "Próxima página",
            historyPagination: "Paginação de histórico",
            currentAngle: "Ângulo atual",
            stopAngle: "Ângulo de parada",
            description: "Descrição",
            close: "Fechar",
            stops: "Paradas",
            location: "Localização",
            time: "Hora",
            noData: "Não há dados",
            itemsSuffix: "itens",
        },
        en: {
            english: true,
            back: "Back",
            selectOtherPivot: "Select another pivot",
            panelEnergized: "ENERGIZED PANEL",
            lastCommunication: "Last communication",
            angle: "Angle",
            centerPressure: "Center Pressure",
            hours: "Hours",
            voltage: "Voltage",
            turnCount: "Number of Turns",
            maintenance: "Maintenance",
            agronomic: "Agronomic",
            weather: "Weather",
            edit: "Edit",
            startPivot: "Start Pivot",
            stopPivot: "Stop Pivot",
            period: "Period",
            last24h: "Last 24h",
            events: "Events",
            operations: "Operations",
            filter: "Filter",
            refresh: "Refresh",
            occurrence: "Occurrence",
            type: "Type",
            status: "Status",
            pivots: "Pivots",
            pumps: "Pumps",
            levelMeters: "Level Meters",
            weatherStation: "Weather Station",
            noEquipment: "No equipment found.",
            update: "Update",
            alert: "Alert",
            confirmation: "Confirmation",
            changeConfiguration: "CHANGE CONFIGURATION",
            noCommunication: "NO COMMUNICATION",
            stoppedReverse: "STOPPED | REVERSE",
            operation: "Operation",
            user: "User",
            command: "Command",
            positionAndMovement: "Position and Movement",
            lastTowerRadius: "Radius at last tower",
            sectorStart: "Sector start",
            sectorEnd: "Sector end",
            positionZero: "Position 0",
            pressureDataGeneratedBetween: "Pressure data generated between",
            comparisonDataGeneratedBetween: "Comparison data generated between",
            depthAngle: "Depth x Angle",
            currentPressure: "Average Pressure",
            pressureComparison: "Pressure Comparison",
            pressure: "Pressure",
            consumption: "Consumption",
            totalVolume: "Total Volume",
            totalVolumeLastMonth: "Total Volume in the Last Month",
            totalWorkHours: "Total Working Hours",
            totalWorkHoursLastMonth: "Total Working Hours in the Last Month",
            wetWorkHours: "Wet Working Hours",
            energyCosts: "Energy Costs",
            peakHour: "Peak Hour",
            offPeak: "Off-Peak",
            reduced: "Reduced",
            previousPage: "Previous page",
            nextPage: "Next page",
            historyPagination: "History pagination",
            currentAngle: "Current angle",
            stopAngle: "Stop angle",
            description: "Description",
            close: "Close",
            stops: "Stops",
            location: "Location",
            time: "Time",
            noData: "No data",
            itemsSuffix: "items",
        },
        es: {
            english: false,
            spanish: true,
            back: "Volver",
            selectOtherPivot: "Seleccionar otro pivote",
            panelEnergized: "PANEL ENERGIZADO",
            lastCommunication: "Última comunicación",
            angle: "Ángulo",
            centerPressure: "Presión del centro",
            hours: "Horas",
            voltage: "Voltaje",
            turnCount: "Número de vueltas",
            maintenance: "Mantenimiento",
            agronomic: "Agronómico",
            weather: "Clima",
            edit: "Editar",
            startPivot: "Iniciar pivote",
            stopPivot: "Detener pivote",
            period: "Periodo",
            last24h: "Últimas 24h",
            events: "Eventos",
            operations: "Operaciones",
            filter: "Filtrar",
            refresh: "Actualizar",
            occurrence: "Ocurrencia",
            type: "Tipo",
            status: "Estado",
            pivots: "Pivotes",
            pumps: "Bombas",
            levelMeters: "Medidores de nivel",
            weatherStation: "Estación meteorológica",
            noEquipment: "Ningún equipo encontrado.",
            update: "Actualización",
            alert: "Alerta",
            confirmation: "Confirmación",
            changeConfiguration: "CAMBIAR CONFIGURACIÓN",
            noCommunication: "SIN COMUNICACIÓN",
            stoppedReverse: "DETENIDO | REVERSA",
            operation: "Operación",
            user: "Usuario",
            command: "Comando",
            positionAndMovement: "Posición y movimiento",
            lastTowerRadius: "Radio en la última torre",
            sectorStart: "Inicio del sector",
            sectorEnd: "Fin del sector",
            positionZero: "Posición 0",
            pressureDataGeneratedBetween: "Datos de presión generados entre",
            comparisonDataGeneratedBetween: "Datos de comparación generados entre",
            depthAngle: "Lámina x ángulo",
            currentPressure: "Presión promedio",
            pressureComparison: "Comparación de presión",
            pressure: "Presión",
            consumption: "Consumo",
            totalVolume: "Volumen total",
            totalVolumeLastMonth: "Volumen total en el último mes",
            totalWorkHours: "Horas totales de trabajo",
            totalWorkHoursLastMonth: "Horas totales de trabajo en el último mes",
            wetWorkHours: "Horas de trabajo - Húmedo",
            energyCosts: "Costos de energía",
            peakHour: "Hora punta",
            offPeak: "Fuera de hora punta",
            reduced: "Reducido",
            previousPage: "Página anterior",
            nextPage: "Página siguiente",
            historyPagination: "Paginación de historial",
            currentAngle: "Ángulo actual",
            stopAngle: "Ángulo de parada",
            description: "Descripción",
            close: "Cerrar",
            stops: "Paradas",
            location: "Ubicación",
            time: "Hora",
            noData: "No hay datos",
            itemsSuffix: "ítems",
        },
    });

    function normalizePivotFamilyName(value) {
        return String(value || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "");
    }

    function isCenterstarFamilyName(value) {
        const normalized = normalizePivotFamilyName(value);
        return normalized.startsWith("centerstar") || normalized.startsWith("centerstart");
    }

    function isCenterstarSelected() {
        const selected = Pivos.data.getPivotData?.(state.selectedId);
        return [
            selected?.name,
            selected?.nome,
            selected?.data?.name,
            selected?.data?.nome,
        ].some(isCenterstarFamilyName);
    }

    function isSmartTouchVariantActive() {
        return getActiveDetailsVariant()?.key === "smarttouch";
    }

    function getDetailsCopy() {
        const lang = window.IcI18n?.getLang?.() || "pt-BR";
        if (lang === "en") return DETAILS_COPY.en;
        if (lang === "es") return DETAILS_COPY.es;
        return DETAILS_COPY.pt;
    }

    function localizeMonthText(value, copy = getDetailsCopy()) {
        const text = String(value || "");
        const map = copy.english ? PT_TO_EN_MONTHS : copy.spanish ? PT_TO_ES_MONTHS : null;
        if (!map) return text;
        return text.replace(/\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b/gi, (token) => {
            const key = token.toLowerCase();
            return map[key] || token;
        });
    }

    function normalizeDegreeText(value) {
        return String(value || "").replaceAll("°", "°").replaceAll("º", "°");
    }

    function localizeTextValue(value, copy = getDetailsCopy()) {
        return normalizeDegreeText(localizeMonthText(value, copy));
    }

    function normalizeDisplayText(value) {
        return String(value || "")
            .replaceAll("\u00C2\u00B0", "°")
            .replaceAll("°", "°")
            .replaceAll("º", "°")
            .replaceAll("º", "°")
            .replaceAll("m³", "m³")
            .replaceAll("—", "—");
    }

    function localizeUiText(value, copy = getDetailsCopy()) {
        return normalizeDisplayText(localizeTextValue(value, copy));
    }

    function getFaultTitleKey(value) {
        return normalizePivotFamilyName(value);
    }

    function getFaultTitleLabel(faultTitle, copy = getDetailsCopy()) {
        const pick = (pt, en, es) => (copy.english ? en : copy.spanish ? es : pt);
        switch (getFaultTitleKey(faultTitle)) {
            case "falhadepressao":
            case "pressurefault":
                return pick("Falha de Pressão", "Pressure Fault", "Fallo de presión");
            case "desalinhamento":
            case "misalignment":
                return pick("Desalinhamento", "Misalignment", "Desalineación");
            case "pressaoatual":
            case "currentpressure":
            case "pressure":
                return pick("Falha de Pressão", "Pressure Fault", "Fallo de presión");
            case "vazao":
            case "flow":
                return pick("Vazão", "Flow", "Caudal");
            case "taxadeprecipitacao":
            case "precipitationrate":
                return pick("Taxa de Precipitação", "Precipitation Rate", "Tasa de precipitación");
            case "acumuladodeirrigacao":
            case "irrigationaccumulation":
            case "irrigationaccumulated":
                return pick("Acumulado de Irrigação | Precipitação", "Accumulated Irrigation | Precipitation", "Acumulado de riego | Precipitación");
            case "tensaobaixa":
            case "lowvoltage":
            case "voltagelow":
                return pick("Tensão Baixa", "Low Voltage", "Tensión baja");
            case "picodetensao":
            case "voltagespike":
            case "voltagesurge":
            case "voltagepeak":
                return pick("Pico de Tensão", "Voltage Spike", "Pico de tensión");
            default:
                return localizeUiText(faultTitle, copy);
        }
    }

    function isPressureFaultTitle(faultTitle) {
        const key = getFaultTitleKey(faultTitle);
        return key === "falhadepressao" || key === "pressurefault" || key === "pressure";
    }

    function isIrrigationAccumulationFaultTitle(faultTitle) {
        const key = getFaultTitleKey(faultTitle);
        return key === "acumuladodeirrigacao" || key === "irrigationaccumulation" || key === "irrigationaccumulated"
            || key === "taxadeprecipitacao" || key === "precipitationrate";
    }

    function isVoltageFaultTitle(faultTitle) {
        const key = getFaultTitleKey(faultTitle);
        return key === "tensaobaixa" || key === "lowvoltage" || key === "voltagelow" || key === "picodetensao" || key === "voltagespike" || key === "voltagesurge" || key === "voltagepeak";
    }

    function isMisalignmentFaultTitle(faultTitle) {
        const key = getFaultTitleKey(faultTitle);
        return key === "desalinhamento" || key === "misalignment";
    }

    function setElementText(selector, value, root = document) {
        const element = root.querySelector(selector);
        if (element) element.textContent = value;
    }

    function localizeSmartTouchStaticUI() {
        const copy = getDetailsCopy();
        setElementText(".pincard__status-text", copy.panelEnergized);

        if (!isSmartTouchVariantActive() && !isCenterstarSelected()) return;

        const backBtn = document.querySelector(".minimap-back-btn.js-details-back");
        if (backBtn) {
            backBtn.innerHTML = `<i class="fa-solid fa-chevron-left"></i> ${copy.back}`;
            backBtn.setAttribute("aria-label", copy.back);
        }

        const selectBtn = $("pivoSelectBtn");
        if (selectBtn) selectBtn.setAttribute("aria-label", copy.selectOtherPivot);

        const footer = document.querySelector(".pincard__footer");
        if (footer) {
            const currentValue = footer.textContent.split(":").slice(1).join(":").trim() || (window.IcDemoHistory ? window.IcDemoHistory.fmt.dateTime(window.IcDemoHistory.NOW) : "");
            footer.innerHTML = `<span class="comm-label">Última comunicação:</span> ${localizeUiText(currentValue, copy)}`;
        }

        const angleKpi = $("kpiAnguloVal")?.closest(".pincard__kpi");
        if (angleKpi) {
            setElementText(".pincard__kpi-lbl", copy.angle, angleKpi);
            angleKpi.querySelector("img")?.setAttribute("alt", copy.angle);
        }
        const pressureKpi = $("kpiPressaoCentroVal")?.closest(".pincard__kpi");
        if (pressureKpi) {
            setElementText(".pincard__kpi-lbl", copy.centerPressure, pressureKpi);
            pressureKpi.querySelector("img")?.setAttribute("alt", copy.centerPressure);
        }
        const hoursKpi = $("kpiHorasVal")?.closest(".pincard__kpi");
        if (hoursKpi) {
            setElementText(".pincard__kpi-lbl", copy.hours, hoursKpi);
            hoursKpi.querySelector("img")?.setAttribute("alt", copy.hours);
        }
        const voltageKpi = $("kpiVoltagemVal")?.closest(".pincard__kpi");
        if (voltageKpi) {
            setElementText(".pincard__kpi-lbl", copy.voltage, voltageKpi);
            voltageKpi.querySelector("img")?.setAttribute("alt", copy.voltage);
        }
        const turnsKpi = $("kpiVoltasVal")?.closest(".pincard__kpi");
        if (turnsKpi) {
            setElementText(".pincard__kpi-lbl", copy.turnCount, turnsKpi);
            turnsKpi.querySelector("img")?.setAttribute("alt", copy.turnCount);
        }

        const actionButtons = document.querySelectorAll(".pincard__actions .pincard__icon-btn");
        if (actionButtons[0]) actionButtons[0].setAttribute("aria-label", copy.maintenance);
        if (actionButtons[1]) actionButtons[1].setAttribute("aria-label", copy.agronomic);
        if (actionButtons[2]) actionButtons[2].setAttribute("aria-label", copy.weather);

        const editBtn = document.querySelector(".pincard__btn-text");
        if (editBtn) {
            editBtn.setAttribute("aria-label", copy.edit);
            editBtn.innerHTML = `<i class="fa-solid fa-pen"></i> ${copy.edit}`;
        }

        const startBtn = document.querySelector(".pincard__control-btn.is-start");
        if (startBtn) startBtn.innerHTML = `<i class="fa-regular fa-circle-play"></i> ${copy.startPivot}`;
        const stopBtn = document.querySelector(".pincard__control-btn.is-stop");
        if (stopBtn) stopBtn.innerHTML = `<i class="fa-regular fa-square"></i> ${copy.stopPivot}`;

        setElementText(".pivo-agenda__title", copy.period);
        setElementText(".pivo-agenda__period-label", copy.last24h);

        const historyTabs = document.querySelectorAll(".js-history-tab");
        if (historyTabs[0]) historyTabs[0].textContent = copy.events;
        if (historyTabs[1]) historyTabs[1].textContent = copy.operations;

        const historyActionButtons = document.querySelectorAll(".pivo-history__actions button");
        if (historyActionButtons[0]) {
            historyActionButtons[0].setAttribute("aria-label", copy.filter);
            historyActionButtons[0].querySelector("img")?.setAttribute("alt", copy.filter);
        }
        if (historyActionButtons[1]) historyActionButtons[1].setAttribute("aria-label", copy.refresh);

        const pagination = document.querySelector(".pivo-history__pagination");
        if (pagination) pagination.setAttribute("aria-label", copy.historyPagination);
        const pageButtons = document.querySelectorAll(".pivo-history__pagination .btn-page");
        if (pageButtons[0]) pageButtons[0].setAttribute("aria-label", copy.previousPage);
        if (pageButtons[pageButtons.length - 1]) pageButtons[pageButtons.length - 1].setAttribute("aria-label", copy.nextPage);

        setElementText(".pivo-lamina .pivo-data-card__title", copy.depthAngle);
        setElementText(".pivo-pressao .pivo-data-card__title", copy.currentPressure);
        setElementText(".pivo-water-consumption .pivo-data-card__title", "Consumo de Água");

        document.querySelectorAll(".pivo-lamina .x-axis-labels span, .pivo-pressao .x-axis-labels span").forEach((item) => {
            item.textContent = normalizeDegreeText(item.textContent);
        });
        document.querySelectorAll(".pivo-water-consumption .x-axis-labels span").forEach((item) => {
            item.textContent = localizeUiText(item.textContent, copy);
        });

        const laminaTooltip = document.querySelector(".pivo-lamina .mock-tooltip-row");
        if (laminaTooltip) laminaTooltip.innerHTML = `<span class="dot blue"></span> ${copy.depthAngle.split(" x ")[0].replace("Â", "")}: <span>7.95 mm</span>`;

        // Subtítulos de Pressão: renderizados por view.charts.js (dependem do
        // período selecionado). Só re-renderiza aqui se os gráficos já existem.
        if (window.Pivos?.views?.charts?.renderCharts && document.getElementById("pivoChartPressao")) {
            window.Pivos.views.charts.renderCharts();
        }

        const waterTooltip = document.querySelector(".pivo-water-consumption .mock-tooltip-row");
        if (waterTooltip) waterTooltip.innerHTML = `<span class="dot blue"></span> ${copy.consumption}: <span>113.8 m³</span>`;
        const waterTooltipTitle = document.querySelector(".pivo-water-consumption .mock-tooltip strong");
        if (waterTooltipTitle) waterTooltipTitle.textContent = localizeUiText(waterTooltipTitle.textContent, copy);

        const consumoCard = document.querySelector(".pivo-consumo-card");
        if (consumoCard) {
            setElementText(".pivo-data-card__title", copy.consumption, consumoCard);
            const labels = consumoCard.querySelectorAll(".pivo-consumo__kpi span");
            if (labels[0]) labels[0].textContent = copy.totalVolume;
            if (labels[1]) labels[1].textContent = copy.totalVolumeLastMonth;
            if (labels[2]) labels[2].textContent = copy.totalWorkHours;
            if (labels[3]) labels[3].textContent = copy.totalWorkHoursLastMonth;
            const headings = consumoCard.querySelectorAll("h4");
            if (headings[0]) headings[0].textContent = copy.wetWorkHours;
            if (headings[1]) headings[1].textContent = copy.energyCosts;
        }

        document.querySelectorAll("#pivoConsumptionLegend span, #pivoCostsLegend span").forEach((item) => {
            const text = item.textContent || "";
            if (text.includes("Horário de Pico")) item.lastChild.textContent = copy.peakHour;
            if (text.includes("Fora do Horário de Pico")) item.lastChild.textContent = copy.offPeak;
            if (text.includes("Reduzido")) item.lastChild.textContent = copy.reduced;
        });
    }
    const pivotOperationDetails = Object.freeze([
        { tipo: "Irrigação", laminaMm: "7,57", velocidade: "70,00", tempoOperacao: "6,60", usuario: "Bauer Irricontrol" },
        { tipo: "Chuva", laminaMm: "12,50", velocidade: "-", tempoOperacao: "-", usuario: "Bauer Irricontrol" },
        { tipo: "Irrigação", laminaMm: "7,57", velocidade: "70,00", tempoOperacao: "6,60", usuario: "Bauer Irricontrol" },
        { tipo: "Irrigação", laminaMm: "7,57", velocidade: "70,00", tempoOperacao: "6,60", usuario: "Bauer Irricontrol" },
        { tipo: "Chuva", laminaMm: "5,00", velocidade: "-", tempoOperacao: "-", usuario: "Bauer Irricontrol" },
        { tipo: "Irrigação", laminaMm: "7,57", velocidade: "70,00", tempoOperacao: "6,60", usuario: "Bauer Irricontrol" },
        { tipo: "Irrigação", laminaMm: "7,57", velocidade: "70,00", tempoOperacao: "6,60", usuario: "Bauer Irricontrol" },
        { tipo: "Chuva", laminaMm: "8,40", velocidade: "-", tempoOperacao: "-", usuario: "Bauer Irricontrol" },
        { tipo: "Irrigação", laminaMm: "7,57", velocidade: "68,00", tempoOperacao: "6,35", usuario: "Bauer Irricontrol" },
        { tipo: "Irrigação", laminaMm: "6,90", velocidade: "65,00", tempoOperacao: "5,82", usuario: "Bauer Irricontrol" }
    ]);

    detailVariants.centerstar = detailVariants.centerstar || {
        key: "centerstar",
        templatePath: "./pages/centerstar.details.html"
    };

    detailVariants.default = detailVariants.default || {
        key: "default",
        templatePath: "./pages/pivo.details.html"
    };

    let minimapInstance = null;
    let minimapLayer = null;
    let minimapCenterMarker = null;
    let minimapTilesPrimary = null;
    let minimapTilesFallback = null;

    // Guard para não registrar listeners duplicados
    let eventsBound = false;
    let onDocClick = null;
    let onSimStatusChange = null;

    function getRegisteredDetailVariants() {
        return Object.values(views.detailVariants || {});
    }

    function clearDetailsVariantBodyClasses() {
        getRegisteredDetailVariants().forEach((variant) => {
            if (variant?.bodyClass) document.body.classList.remove(variant.bodyClass);
        });
    }

    function getActiveDetailsVariant() {
        const activeKey = String(state.activeDetailsVariant || "default");
        return detailVariants[activeKey] || detailVariants.default;
    }

    function applyActiveDetailsVariant() {
        const variant = getActiveDetailsVariant();
        clearDetailsVariantBodyClasses();
        if (variant?.bodyClass) document.body.classList.add(variant.bodyClass);
        return variant;
    }

    async function mountPanel() {
        const slot = document.getElementById("pageSlot");
        if (!slot) return false;

        try {
            // A tela de detalhes é recriada ao voltar da edição, então os
            // listeners precisam ser religados no novo DOM.
            unbindEvents();

            const variant = applyActiveDetailsVariant();
            const templatePath = String(variant?.templatePath || detailVariants.default.templatePath || "./pages/pivo.details.html");
            const html = await loadTemplateCached(templatePath);
            slot.innerHTML = html;

            const panel = document.getElementById("pivosPanel");
            if (panel) {
                panel.dataset.detailsVariant = String(variant?.key || "default");
                if (variant?.panelClass) panel.classList.add(variant.panelClass);
            }
            variant?.afterMount?.({ panel, slot, state });

            // Se o template vier sem o menu, não adianta tentar abrir
            const selectorMenu = $("pivoSelectorMenu");
            if (selectorMenu) selectorMenu.style.display = "none";

            bindEvents();
            renderHistoryTable("eventos");
            return true;
        } catch (err) {
            console.error(`Failed to load ${getActiveDetailsVariant()?.templatePath || "./pages/pivo.details.html"}`, err);
            clearDetailsVariantBodyClasses();
            document.body.classList.remove("is-pivo-details", "is-pivo-details-only");
            const errCopy = getDetailsCopy();
            const loadErrorMessage = errCopy.english
                ? "Failed to load pivot details. Please try again."
                : errCopy.spanish
                ? "Error al cargar los detalles del pivote. Inténtelo de nuevo."
                : "Falha ao carregar detalhes do pivo. Tente novamente.";
            slot.innerHTML = `<div style="padding:2rem;color:#ef4444;">${loadErrorMessage}</div>`;
            return false;
        }
    }

    function bindEvents() {
        // Evita duplicar listeners se abrir/fechar várias vezes
        if (eventsBound) return;
        eventsBound = true;

        onSimStatusChange = () => updatePincardStatus(state.selectedId);
        window.addEventListener("ic:sim-status-change", onSimStatusChange);

        const closeBtn = $("pivosCloseBtn");
        if (closeBtn) {
            closeBtn.style.cursor = "pointer";
            closeBtn.addEventListener("click", () => window.IcPivos?.close?.());
        }

        // 1 listener global para toggle do seletor
        onDocClick = (e) => {
            const selectorMenu = $("pivoSelectorMenu");
            const selectBtn = e.target.closest("#pivoSelectBtn");

            // Se não existe menu nessa view, nada a fazer
            if (!selectorMenu) return;

            // Clicou no botão -> toggle
            if (selectBtn) {
                e.stopPropagation();
                const isHidden = getComputedStyle(selectorMenu).display === "none";
                selectorMenu.style.display = isHidden ? "flex" : "none";

                if (isHidden) selectBtn.classList.add("is-active");
                else selectBtn.classList.remove("is-active");

                return;
            }

            // Clique fora -> fecha
            if (!selectorMenu.contains(e.target)) {
                selectorMenu.style.display = "none";
                const btn = $("pivoSelectBtn");
                if (btn) btn.classList.remove("is-active");
            }
        };

        document.addEventListener("click", onDocClick);

        // Listener for History table expansion
        const historyTableBody = $("pivoHistoryTableBody");
        if (historyTableBody) {
            historyTableBody.addEventListener("click", (e) => {
                const btn = e.target.closest(".expand-btn");
                if (!btn) return;

                const tr = btn.closest("tr.pivo-history__row");
                if (!tr) return;

                const detailsRow = tr.nextElementSibling;
                if (!detailsRow || !detailsRow.classList.contains("pivo-history__row-details")) return;

                const isExpanded = detailsRow.style.display !== "none";
                detailsRow.style.display = isExpanded ? "none" : "table-row";

                const icon = btn.querySelector("i");
                if (icon) {
                    icon.className = isExpanded ? "fa-solid fa-plus" : "fa-solid fa-minus";
                }
            });
        }

        // History Tabs
        const historyTabs = document.querySelector(".pivo-history__tabs");
        if (historyTabs) {
            const ICON_DOWNLOAD = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/></svg>`;

            // 1º botão = exportar (download), visível só em Operações. O funnel (2º botão) é fixo.
            const updateFilterIcon = (tab) => {
                const downloadBtn = document.querySelector(".pivo-history__actions button:first-child");
                if (!downloadBtn) return;
                downloadBtn.innerHTML = ICON_DOWNLOAD;
                downloadBtn.style.display = tab === "operacoes" ? "" : "none";
            };

            // Estado inicial conforme aba ativa
            updateFilterIcon(document.querySelector(".js-history-tab.is-active")?.getAttribute("data-tab") || "eventos");

            historyTabs.addEventListener("click", (e) => {
                const btn = e.target.closest(".js-history-tab");
                if (!btn) return;

                historyTabs.querySelectorAll(".js-history-tab").forEach(b => b.classList.remove("is-active"));
                btn.classList.add("is-active");

                const tab = btn.getAttribute("data-tab");
                updateFilterIcon(tab);
                renderHistoryTable(tab, 1);
            });
        }

        // Filtro do histórico (Central / GPS): só acrescenta os eventos desses
        // tipos na aba Eventos, então re-renderiza a página atual.
        const historyFilterPanel = document.querySelector(".pivo-history__actions .pivo-filter__panel");
        if (historyFilterPanel) {
            historyFilterPanel.querySelectorAll("[data-history-filter]").forEach((input) => {
                historyFilters[input.dataset.historyFilter] = input.checked;
            });
            historyFilterPanel.addEventListener("change", (e) => {
                const input = e.target.closest("[data-history-filter]");
                if (!input) return;
                historyFilters[input.dataset.historyFilter] = input.checked;
                const activeTab = document.querySelector(".js-history-tab.is-active")?.getAttribute("data-tab") || "eventos";
                if (activeTab !== "eventos") return;
                const activePage = parseInt(document.querySelector(".pivo-history__pagination .btn-page.is-active")?.textContent.trim(), 10) || 1;
                renderHistoryTable("eventos", activePage);
            });
        }

        // History Pagination
        const historyPagination = document.querySelector(".pivo-history__pagination");
        if (historyPagination) {
            historyPagination.addEventListener("click", (e) => {
                const btn = e.target.closest(".btn-page");
                if (!btn || btn.disabled || btn.classList.contains("is-static")) return;

                const pageNum = parseInt(btn.dataset.page || btn.textContent.trim(), 10);
                if (isNaN(pageNum)) return;

                const activeTab = document.querySelector(".js-history-tab.is-active")?.getAttribute("data-tab") || "eventos";
                renderHistoryTable(activeTab, pageNum);
            });
        }

        // Delegate clicks for buttons inside the panel
        const pivosPanel = $("pivosPanel");
        if (pivosPanel) {
            pivosPanel.addEventListener("click", (e) => {
                const backBtn = e.target.closest(".js-details-back");
                if (backBtn) {
                    window.IcPivos?.close?.();
                    window.IcPluvDetails?.close?.();
                    document.querySelector('.nav__item[data-route="visao-geral"]')?.click();
                    return;
                }

                // 0. Top section nav
                const sectionNavBtn = e.target.closest(".pivo-section-nav__btn");
                if (sectionNavBtn) {
                    const targetView = sectionNavBtn.getAttribute("data-details-view");

                    if (targetView === "pluviometros") {
                        // Switch from pivot details to pluviometer details
                        window.IcPivos?.close?.();
                        window.IcPluvDetails?.open?.();
                        return;
                    }
                    if (targetView === "medidores") {
                        // Switch from pivot details to water meter details
                        window.IcPivos?.close?.();
                        window.IcMdnDetails?.open?.();
                        return;
                    }
                    if (targetView === "bombas") {
                        // Switch from pivot details to pump details
                        window.IcPivos?.close?.();
                        window.IcBombaDetails?.open?.();
                        return;
                    }
                    if (targetView === "estacoes") {
                        // Switch from pivot details to weather station details
                        window.IcPivos?.close?.();
                        window.IcEstacaoDetails?.open?.();
                        return;
                    }

                    const nav = sectionNavBtn.closest(".pivo-section-nav");
                    if (nav) {
                        nav.querySelectorAll(".pivo-section-nav__btn").forEach((btn) => {
                            btn.classList.remove("is-active");
                        });
                    }
                    sectionNavBtn.classList.add("is-active");
                    return;
                }

                // 1. Fault items
                const faultItem = e.target.closest(".js-fault-item");
                if (faultItem) {
                    const faultCopy = getDetailsCopy();
                    const faultLabel = faultItem.dataset.fault || faultItem.querySelector(".pivo-faults__label")?.textContent || (faultCopy.english ? "Fault" : faultCopy.spanish ? "Fallo" : "Falha");
                    openFaultModal(faultLabel);
                    return;
                }

                // 2. Edit button
                const editBtn = e.target.closest(".pincard__btn-text");
                if (editBtn) {
                    if (views.edit && typeof views.edit.showEditView === "function") {
                        // showEditView é assíncrono: sem o catch, uma falha
                        // virava unhandled rejection e a tela ficava travada
                        // sem nenhum aviso.
                        Promise.resolve(views.edit.showEditView()).catch((err) => {
                            console.error("Falha ao abrir a edição do pivô.", err);
                            window.IcNotify?.error?.("Não foi possível abrir a edição do pivô.", 3000);
                        });
                    }
                    return;
                }

                // 3. Start Pivot button
                const startBtn = e.target.closest(".pincard__control-btn.is-start");
                if (startBtn) {
                    const pivoData = Pivos.data.getPivotData?.(state.selectedId);
                    const angleText = $("kpiAnguloVal")?.textContent || "0";
                    const angle = parseFloat(angleText) || 0;
                    const fbCopy = getDetailsCopy();
                    const fallbackTitle = fbCopy.english ? "Pivot" : fbCopy.spanish ? "Pivote" : "Pivo";

                    if (window.OpModal && typeof window.OpModal.open === "function") {
                        window.OpModal.open({
                            title: pivoData?.name || fallbackTitle,
                            pivotId: state.selectedId,
                            angle: angle,
                            isPeakHour: true,
                            isSector: !!pivoData?.isSector,
                            sectorStart: pivoData?.startAngle ?? 0,
                            sectorEnd: pivoData?.endAngle ?? 360
                        });
                    }
                    return;
                }
            });
        }
    }

    // ── Modal "Acumulado de Irrigação | Precipitação" ─────────────────────────
    // Mapa do pivô com o desenho e a divisão dos segmentos em linhas pontilhadas, faixas azuis de irrigação e uma
    // tabela por segmento (período, faixa de ângulo, lâmina acumulada e precipitação). Cada segmento tem o seu
    // período (início e fim), que começa igual ao da tela de detalhes e pode ser preenchido na linha; "Atualizar
    // dados" recalcula só o modal para as datas das linhas e "Exportar" baixa o que está na tela.
    // Os dados vêm de Pivos.views.charts (mesma fonte do card de indicadores).
    function openIrrigationAccumulatedModal() {
        const modalId = "pivoFaultModal";
        if ($(modalId)) $(modalId).remove();

        const charts = Pivos.views?.charts;
        if (!charts?.getSegmentsBreakdown) return;

        const copy = getDetailsCopy();
        const pick = (pt, en, es) => (copy.english ? en : copy.spanish ? es : pt);
        const locale = copy.english ? "en-US" : copy.spanish ? "es-ES" : "pt-BR";
        const fmtNum = (v) => Number(v).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        const pad2 = (n) => String(n).padStart(2, "0");
        const toISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
        const fromISO = (v) => {
            const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || "");
            return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
        };
        const fmtDate = (d) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
        const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

        const pivoData = Pivos.data.getPivotData?.(state.selectedId);
        const segments = charts.getPivotSegments(pivoData);
        const text = {
            title: getFaultTitleLabel("irrigation_accumulated", copy),
            segment: pick("Segmento", "Segment", "Segmento"),
            period: pick("Período (início – fim)", "Period (start – end)", "Período (inicio – fin)"),
            angleRange: pick("Faixa de ângulo", "Angle range", "Rango de ángulo"),
            irrigation: pick("Lâmina acumulada (mm)", "Accumulated depth (mm)", "Lámina acumulada (mm)"),
            rain: pick("Precipitação (mm)", "Rainfall (mm)", "Precipitación (mm)"),
            refresh: pick("Atualizar dados", "Update data", "Actualizar datos"),
            refreshTitle: pick("Atualizar os dados do modal para as datas das linhas", "Update the modal data for the dates in the rows", "Actualizar los datos del modal para las fechas de las filas"),
            export: pick("Exportar", "Export", "Exportar"),
            exportTitle: pick("Exportar para Excel", "Export to Excel", "Exportar a Excel"),
            legend: pick("Irrigação (mm)", "Irrigation (mm)", "Riego (mm)"),
            startDate: pick("Data início", "Start date", "Fecha inicio"),
            endDate: pick("Data fim", "End date", "Fecha fin"),
            from: pick("Ângulo inicial (°)", "Start angle (°)", "Ángulo inicial (°)"),
            to: pick("Ângulo final (°)", "End angle (°)", "Ángulo final (°)"),
            pivot: pick("Pivô", "Pivot", "Pivote"),
            start: pick("Início", "Start", "Inicio"),
            end: pick("Fim", "End", "Fin"),
        };

        // Período de cada segmento: começa igual ao da tela de detalhes e é preenchido na linha.
        const pagePeriod = charts.getSelectedPeriod();
        const periods = {};
        segments.forEach((seg) => { periods[seg.id] = { start: new Date(pagePeriod.start), end: new Date(pagePeriod.end) }; });

        const modalHtml = `
            <div class="fault-modal" id="${modalId}">
                <div class="fault-modal__backdrop"></div>
                <div class="fault-modal__dialog fault-modal__dialog--irrigation">
                    <header class="fault-modal__header">
                        <h3 class="fault-modal__title">${esc(text.title)}</h3>
                        <button type="button" class="fault-modal__close" aria-label="${esc(copy.close)}">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </header>
                    <div class="fault-modal__content">
                        <div class="fault-modal__map-side">
                            <div class="fault-modal__map" id="faultModalMap"></div>
                            <div class="fault-modal__legend" aria-label="${esc(text.legend)}">
                                <span class="fault-modal__legend-title">${esc(text.legend)}</span>
                                <span id="faultLegendMin">0</span>
                                <i class="fault-modal__legend-bar"></i>
                                <span id="faultLegendMax">0</span>
                            </div>
                        </div>
                        <div class="fault-modal__table-side">
                            <div class="fault-modal__table-container fault-modal__table-container--scroll">
                                <table class="fault-modal__table">
                                    <thead>
                                        <tr>
                                            <th>${esc(text.segment)}</th>
                                            <th>${esc(text.period)}</th>
                                            <th>${esc(text.angleRange)}</th>
                                            <th class="num">${esc(text.irrigation)}</th>
                                            <th class="num">${esc(text.rain)}</th>
                                        </tr>
                                    </thead>
                                    <tbody id="faultSegBody"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    <footer class="fault-modal__footer">
                        <button type="button" class="fault-modal__refresh-btn" id="faultRefreshBtn" title="${esc(text.refreshTitle)}">
                            <i class="fa-solid fa-rotate"></i> ${esc(text.refresh)}
                        </button>
                        <button type="button" class="fault-modal__export-btn" id="faultExportBtn" title="${esc(text.exportTitle)}">
                            <i class="fa-solid fa-file-excel"></i> ${esc(text.export)}
                        </button>
                    </footer>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML("beforeend", modalHtml);
        const modalEl = $(modalId);
        if (!modalEl) return;

        let current = null; // último cálculo aplicado (alimenta a tabela, o mapa e a exportação)
        let map = null;
        let layer = null;

        // Ponto a "meters" metros do centro, no rumo "bearing" (graus, 0 = norte, sentido horário).
        const bearingPoint = (meters, bearing) => {
            const t = (bearing * Math.PI) / 180;
            const lat0 = pivoData.center.lat;
            return [
                lat0 + (meters / 111320) * Math.cos(t),
                pivoData.center.lng + (meters / (111320 * Math.cos((lat0 * Math.PI) / 180))) * Math.sin(t),
            ];
        };
        const inSegment = (seg, angle) => (seg.endAngle > seg.startAngle
            ? angle >= seg.startAngle && angle < seg.endAngle
            : angle >= seg.startAngle || angle < seg.endAngle);
        const angleText = (seg) => `${Math.round(seg.startAngle)}° – ${Math.round(seg.endAngle)}°`;

        const paintMap = () => {
            if (!map || !layer || !current || !pivoData?.center || !pivoData?.radius) return;
            layer.clearLayers();
            const { rows } = current;
            const center = [pivoData.center.lat, pivoData.center.lng];

            // Faixas azuis de irrigação: cada região segue a lâmina acumulada do seu segmento (e portanto as datas
            // dele), com transição suave entre um segmento e o vizinho, sem bloco preenchido por segmento, e uma
            // leve variação por ângulo para formar as faixas. Mais escuro = mais lâmina acumulada.
            const STEP = 3;
            const phase = String(state.selectedId || "").split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 628 / 100;
            const ripple = (a) => 1 + 0.07 * Math.sin(a * 0.11 + phase) + 0.05 * Math.sin(a * 0.43 + 1.3 + phase) + 0.03 * Math.sin(a * 1.7);
            const centers = rows.map((r) => ({ mid: (r.startAngle + r.span / 2) % 360, v: r.irrigation })).sort((x, y) => x.mid - y.mid);
            const valueAt = (angle) => {
                if (centers.length === 1) return centers[0].v * ripple(angle);
                // vizinhos (circulares) do ângulo entre os centros dos segmentos
                let prev = centers[centers.length - 1];
                let next = centers[0];
                for (let i = 0; i < centers.length; i++) {
                    if (centers[i].mid > angle) {
                        next = centers[i];
                        prev = centers[(i - 1 + centers.length) % centers.length];
                        break;
                    }
                    if (i === centers.length - 1) { prev = centers[i]; next = centers[0]; }
                }
                const gap = (((next.mid - prev.mid) % 360) + 360) % 360 || 360;
                const t = ((((angle - prev.mid) % 360) + 360) % 360) / gap;
                const smooth = t * t * (3 - 2 * t);
                return (prev.v + (next.v - prev.v) * smooth) * ripple(angle);
            };
            const slices = [];
            for (let a = 0; a < 360; a += STEP) {
                if (rows.some((r) => inSegment(r, a + STEP / 2))) slices.push({ a, v: valueAt(a + STEP / 2) });
            }
            const values = slices.map((sl) => sl.v);
            const min = Math.min(...values);
            const max = Math.max(...values);
            slices.forEach(({ a, v }) => {
                const n = max > min ? (v - min) / (max - min) : 0.6;
                L.polygon([center, bearingPoint(pivoData.radius, a), bearingPoint(pivoData.radius, a + STEP)], {
                    color: "transparent", fillColor: `hsl(210, 100%, ${85 - (0.1 + n * 0.85) * 50}%)`, fillOpacity: 0.8, interactive: false,
                }).addTo(layer);
            });

            // Contorno do pivô e divisão dos segmentos em linhas pontilhadas.
            const dashed = { color: "#ffffff", weight: 2, dashArray: "6 6", opacity: 0.95, interactive: false };
            L.circle(center, { ...dashed, radius: pivoData.radius, fill: false }).addTo(layer);
            const fullCircle = rows.length === 1 && rows[0].span >= 360;
            if (!fullCircle) {
                const bounds = new Set(rows.flatMap((r) => [r.startAngle % 360, r.endAngle % 360]));
                bounds.forEach((b) => L.polyline([center, bearingPoint(pivoData.radius, b)], dashed).addTo(layer));
            }

            // Nome de cada segmento no meio da sua faixa (só o número quando há muitos, para não sobrepor).
            rows.forEach((seg) => {
                const mid = seg.startAngle + seg.span / 2;
                const shortName = rows.length > 8 ? (String(seg.name).match(/\d+/)?.[0] || seg.name) : seg.name;
                L.marker(bearingPoint(pivoData.radius * (fullCircle ? 0.3 : 0.62), mid), {
                    interactive: false,
                    icon: L.divIcon({ className: "fault-seg-label", html: `<span>${esc(shortName)}</span>`, iconSize: [90, 20], iconAnchor: [45, 10] }),
                }).addTo(layer);
            });

            const legendMin = $("faultLegendMin");
            const legendMax = $("faultLegendMax");
            if (legendMin) legendMin.textContent = fmtNum(min);
            if (legendMax) legendMax.textContent = fmtNum(max);
        };

        const refreshBtn = $("faultRefreshBtn");

        // Realça as linhas cujas datas foram preenchidas mas ainda não aplicadas com "Atualizar dados".
        const markPending = () => {
            let any = false;
            modalEl.querySelectorAll("#faultSegBody tr[data-seg]").forEach((tr) => {
                const applied = periods[tr.dataset.seg];
                const pending = tr.querySelector("[data-field=start]").value !== toISO(applied.start)
                    || tr.querySelector("[data-field=end]").value !== toISO(applied.end);
                tr.classList.toggle("is-pending", pending);
                any = any || pending;
            });
            refreshBtn?.classList.toggle("is-attention", any);
        };

        // Calcula com os períodos aplicados e redesenha a tabela e o mapa.
        const render = () => {
            current = charts.getSegmentsBreakdown(state.selectedId, segments, periods, pagePeriod);

            const body = $("faultSegBody");
            if (body) {
                body.innerHTML = current.rows.map((r) => `
                    <tr data-seg="${esc(r.id)}">
                        <td>${esc(r.name)}</td>
                        <td class="fault-modal__period-cell">
                            <input type="date" class="fault-modal__date-input" data-field="start" value="${toISO(r.start)}" aria-label="${esc(text.start)}">
                            <span>–</span>
                            <input type="date" class="fault-modal__date-input" data-field="end" value="${toISO(r.end)}" aria-label="${esc(text.end)}">
                        </td>
                        <td>${esc(angleText(r))}</td>
                        <td class="num">${fmtNum(r.irrigation)}</td>
                        <td class="num">${fmtNum(r.rain)}</td>
                    </tr>`).join("");
            }
            markPending();
            paintMap();
        };

        // "Atualizar dados": aplica as datas preenchidas nas linhas (início depois do fim vira fim/início;
        // data vazia mantém a que já estava aplicada).
        const applyRows = () => {
            modalEl.querySelectorAll("#faultSegBody tr[data-seg]").forEach((tr) => {
                let start = fromISO(tr.querySelector("[data-field=start]").value);
                let end = fromISO(tr.querySelector("[data-field=end]").value);
                if (!start || !end) return;
                if (start > end) [start, end] = [end, start];
                periods[tr.dataset.seg] = { start, end };
            });
            render();
        };

        // Exporta o que está na tela em .xls — mesmo método de exportação do Cosmofield e da Estação: o Excel abre
        // uma tabela HTML com extensão .xls. Cada segmento sai com o seu período.
        const exportExcel = () => {
            if (!current) return;
            const header = [text.segment, text.startDate, text.endDate, text.from, text.to, text.irrigation, text.rain];
            const lines = current.rows.map((r) => [r.name, fmtDate(r.start), fmtDate(r.end), Math.round(r.startAngle), Math.round(r.endAngle), r.irrigation, r.rain]);
            const cell = (v) => `<td>${esc(typeof v === "number" ? String(v).replace(".", copy.english ? "." : ",") : v)}</td>`;
            const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
                <head><meta charset="utf-8"><style>table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px}th{background:#f1f5f9}</style></head>
                <body>
                  <table><tr><th>${esc(text.pivot)}</th><td colspan="6">${esc(pivoData?.name || "")}</td></tr></table>
                  <br>
                  <table>
                    <thead><tr>${header.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
                    <tbody>${lines.map((l) => `<tr>${l.map(cell).join("")}</tr>`).join("")}</tbody>
                  </table>
                </body></html>`;
            const slug = String(pivoData?.name || "pivo").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            const stamp = (d) => `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
            const when = current.samePeriod ? `${stamp(current.rows[0].start)}-${stamp(current.rows[0].end)}` : "periodos-por-segmento";
            const blob = new Blob([html], { type: "application/vnd.ms-excel" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `acumulado-irrigacao-precipitacao-${slug}-${when}.xls`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        };

        const closeModal = () => modalEl.remove();
        modalEl.querySelector(".fault-modal__close")?.addEventListener("click", closeModal);
        modalEl.querySelector(".fault-modal__backdrop")?.addEventListener("click", closeModal);
        refreshBtn?.addEventListener("click", applyRows);
        $("faultExportBtn")?.addEventListener("click", exportExcel);
        modalEl.querySelector("#faultSegBody")?.addEventListener("input", markPending);
        modalEl.querySelector("#faultSegBody")?.addEventListener("change", markPending);

        render();
        // O mapa só pode ser criado depois que o modal tem tamanho.
        setTimeout(() => {
            const mapEl = $("faultModalMap");
            if (!mapEl || !pivoData?.center || !pivoData?.radius) return;
            map = L.map(mapEl, { zoomControl: true, attributionControl: false, zoomSnap: 0, scrollWheelZoom: false });
            mapEl.addEventListener("wheel", (e) => { if (e.ctrlKey) map.scrollWheelZoom.enable(); else map.scrollWheelZoom.disable(); });
            L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 20 }).addTo(map);
            layer = L.layerGroup().addTo(map);
            const dLat = pivoData.radius / 111320;
            const dLng = pivoData.radius / (111320 * Math.cos((pivoData.center.lat * Math.PI) / 180));
            map.fitBounds(L.latLngBounds(
                [pivoData.center.lat - dLat, pivoData.center.lng - dLng],
                [pivoData.center.lat + dLat, pivoData.center.lng + dLng]
            ), { padding: [30, 30] });
            paintMap();
        }, 100);
    }

    function openFaultModal(faultTitle) {
        // Acumulado de irrigação tem modal próprio (segmentos, período e exportação).
        if (isIrrigationAccumulationFaultTitle(faultTitle)) { openIrrigationAccumulatedModal(); return; }
        const modalId = "pivoFaultModal";
        if ($(modalId)) $(modalId).remove();

        const copy = getDetailsCopy();
        const pivoData = Pivos.data.getPivotData?.(state.selectedId);
        const localizedFaultTitle = getFaultTitleLabel(faultTitle, copy);
        const isEmptyState = isVoltageFaultTitle(faultTitle);

        const tableBody = isEmptyState ? "" : `
            <tbody>
                <tr>
                    <td>-16.2574215,-47.413506</td>
                    <td>10/02/2026 17:44</td>
                    <td>0.5°</td>
                </tr>
                <tr>
                    <td>-16.2572492,-47.4129491</td>
                    <td>12/02/2026 08:34</td>
                    <td>354.6°</td>
                </tr>
                <tr>
                    <td>-16.2572492,-47.4129491</td>
                    <td>12/02/2026 08:33</td>
                    <td>354.6°</td>
                </tr>
                <tr>
                    <td>-16.2572492,-47.4129491</td>
                    <td>12/02/2026 08:24</td>
                    <td>354.6°</td>
                </tr>
                <tr>
                    <td>-16.2572492,-47.4129491</td>
                    <td>11/02/2026 10:28</td>
                    <td>354.6°</td>
                </tr>
                <tr>
                    <td>-16.2572492,-47.4129491</td>
                    <td>11/02/2026 10:22</td>
                    <td>354.6°</td>
                </tr>
            </tbody>
        `;

        const emptyStateContent = isEmptyState ? `
            <div class="fault-modal__empty-state">
                <svg class="fault-modal__empty-icon" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 30H90V80C90 85.5228 85.5228 90 80 90H20C14.4772 90 10 85.5228 10 80V30Z" stroke="currentColor" stroke-width="2"/>
                    <path d="M10 30L25 10H75L90 30" stroke="currentColor" stroke-width="2"/>
                    <path d="M40 30C40 35.5228 44.4772 40 50 40C55.5228 40 60 35.5228 60 30" stroke="currentColor" stroke-width="2"/>
                </svg>
                <p class="fault-modal__empty-text">${copy.noData}</p>
            </div>
        ` : "";

        const paginationContent = isEmptyState ? "" : `
            <footer class="fault-modal__pagination">
                <span>${copy.english ? "1-6 of 10 items" : copy.spanish ? "1-6 de 10 ítems" : "1-6 de 10 itens"}</span>
                <div class="fault-modal__pagination-controls">
                    <button type="button" class="fault-modal__page-btn" disabled><i class="fa-solid fa-chevron-left"></i></button>
                    <button type="button" class="fault-modal__page-btn is-active">1</button>
                    <button type="button" class="fault-modal__page-btn">2</button>
                    <button type="button" class="fault-modal__page-btn"><i class="fa-solid fa-chevron-right"></i></button>
                </div>
            </footer>
        `;

        const modalHtml = `
            <div class="fault-modal" id="${modalId}">
                <div class="fault-modal__backdrop"></div>
                <div class="fault-modal__dialog">
                    <header class="fault-modal__header">
                        <h3 class="fault-modal__title">${localizedFaultTitle}</h3>
                        <button type="button" class="fault-modal__close" aria-label="${copy.close}">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </header>
                    <div class="fault-modal__content">
                        <div class="fault-modal__map-side">
                            <div class="fault-modal__map" id="faultModalMap"></div>
                        </div>
                        <div class="fault-modal__table-side">
                            <header class="fault-modal__table-header">
                                <h4 class="fault-modal__table-title">${copy.stops}</h4>
                                <div class="fault-modal__date-picker">
                                    <span>25/01/2026 &nbsp; - &nbsp; 24/02/2026</span>
                                    <i class="fa-regular fa-calendar"></i>
                                </div>
                            </header>
                            <div class="fault-modal__table-container">
                                <table class="fault-modal__table">
                                    <thead>
                                        <tr>
                                            <th>${copy.location}</th>
                                            <th>${copy.time}</th>
                                            <th class="is-filterable">${copy.angle} <i class="fa-solid fa-sort"></i></th>
                                        </tr>
                                    </thead>
                                    ${tableBody}
                                </table>
                                ${emptyStateContent}
                            </div>
                            ${paginationContent}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML("beforeend", modalHtml);

        const modalEl = $(modalId);
        if (!modalEl) return;

        const closeBtn = modalEl.querySelector(".fault-modal__close");
        const backdrop = modalEl.querySelector(".fault-modal__backdrop");

        const closeModal = () => {
            modalEl.remove();
        };

        if (closeBtn) closeBtn.addEventListener("click", closeModal);
        if (backdrop) backdrop.addEventListener("click", closeModal);

        // Initialize Map
        setTimeout(() => {
            renderFaultMap(pivoData, faultTitle);
        }, 100);
    }

    function renderFaultMap(pivoData, faultTitle) {
        const mapEl = $("faultModalMap");
        if (!mapEl || !pivoData) return;

        // Limpar mapa anterior
        if (mapEl._leaflet_id) {
            delete mapEl._leaflet_id;
            mapEl.innerHTML = "";
        }

        const map = L.map(mapEl, {
            zoomControl: true,
            attributionControl: false,
            zoomSnap: 0,
            scrollWheelZoom: false
        });

        mapEl.addEventListener("wheel", (e) => {
            if (e.ctrlKey) {
                map.scrollWheelZoom.enable();
            } else {
                map.scrollWheelZoom.disable();
            }
        });

        L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            { maxZoom: 20 }
        ).addTo(map);

        if (pivoData.center && pivoData.radius) {
            const latlng = [pivoData.center.lat, pivoData.center.lng];
            const _dLat = pivoData.radius / 111320;
            const _dLng = pivoData.radius / (111320 * Math.cos(pivoData.center.lat * Math.PI / 180));
            const pivBounds = L.latLngBounds(
                [pivoData.center.lat - _dLat, pivoData.center.lng - _dLng],
                [pivoData.center.lat + _dLat, pivoData.center.lng + _dLng]
            );

            const drawPivotBoundary = () => L.circle(latlng, {
                radius: pivoData.radius,
                color: "rgba(255,255,255,0.8)",
                weight: 2,
                fill: false,
                pointerEvents: 'none'
            }).addTo(map);

            // 2. Lógica Especial para Falha de Pressão (Heat Map multi-anel)
            if (isPressureFaultTitle(faultTitle)) {
                const seed = (pivoData.id || "pivo").split('').reduce((a, b) => a + b.charCodeAt(0), 0);

                const RDYLGN = [
                    [0.0,  [165,   0,  38]],
                    [0.1,  [215,  48,  39]],
                    [0.2,  [244, 109,  67]],
                    [0.3,  [253, 174,  97]],
                    [0.4,  [254, 224, 139]],
                    [0.5,  [255, 255, 191]],
                    [0.6,  [217, 239, 139]],
                    [0.7,  [166, 217, 106]],
                    [0.8,  [102, 189,  99]],
                    [0.9,  [ 26, 152,  80]],
                    [1.0,  [  0, 104,  55]],
                ];
                const rdylgn = (t) => {
                    t = Math.min(1, Math.max(0, t));
                    let i = 0;
                    while (i < RDYLGN.length - 2 && t > RDYLGN[i + 1][0]) i++;
                    const [t0, c0] = RDYLGN[i], [t1, c1] = RDYLGN[i + 1];
                    const f = (t - t0) / (t1 - t0);
                    return [
                        Math.round(c0[0] + f * (c1[0] - c0[0])),
                        Math.round(c0[1] + f * (c1[1] - c0[1])),
                        Math.round(c0[2] + f * (c1[2] - c0[2])),
                    ];
                };

                const SIZE = 512;
                const canvas = document.createElement('canvas');
                canvas.width = canvas.height = SIZE;
                const ctx = canvas.getContext('2d');
                const imgData = ctx.createImageData(SIZE, SIZE);
                const data = imgData.data;
                const cx = SIZE / 2, cy = SIZE / 2, rpx = SIZE / 2 - 1;

                const offsetAngle = ((seed * 137) % 360) * Math.PI / 180;
                const offsetMag   = rpx * 0.30;
                const oCX = cx + offsetMag * Math.cos(offsetAngle);
                const oCY = cy + offsetMag * Math.sin(offsetAngle);
                const gradR     = rpx * 0.86;
                const gradValue = -0.5;

                for (let y = 0; y < SIZE; y++) {
                    for (let x = 0; x < SIZE; x++) {
                        const dx = x - cx, dy = y - cy;
                        const dist = Math.hypot(dx, dy);
                        if (dist > rpx) continue;

                        let p = 0.85;

                        const dOff  = Math.hypot(x - oCX, y - oCY);
                        const normD = Math.max(0, Math.min(1, (dOff - gradR) / (rpx * 1.44)));
                        const grad  = dOff <= gradR ? 1.0 : (1 - normD * (1 - gradValue));
                        p = Math.min(1, Math.max(0, p * grad));

                        const alpha = Math.min(1, (rpx - dist) / 1.5) * 220;
                        const [r, g, b] = rdylgn(p);
                        const i = (y * SIZE + x) * 4;
                        data[i] = r; data[i+1] = g; data[i+2] = b;
                        data[i+3] = Math.round(alpha);
                    }
                }
                ctx.putImageData(imgData, 0, 0);

                L.imageOverlay(canvas.toDataURL(), pivBounds, { opacity: 0.72, interactive: false }).addTo(map);
                drawPivotBoundary();
                map.fitBounds(pivBounds, { padding: [30, 30] });
            } else if (isVoltageFaultTitle(faultTitle)) {
                drawPivotBoundary();
                map.fitBounds(pivBounds, { padding: [30, 30] });
            } else if (isMisalignmentFaultTitle(faultTitle)) {
                const mockAngles = [0.5, 354.6, 354.0, 355.2];
                mockAngles.forEach(angle => {
                    const mathAngleRad = (90 - angle) * (Math.PI / 180);
                    for (let i = 0; i <= 60; i++) {
                        const dist = (pivoData.radius * i) / 60;
                        const fLat = pivoData.center.lat + (dist / 111320) * Math.sin(mathAngleRad);
                        const fLng = pivoData.center.lng + (dist / (111320 * Math.cos(pivoData.center.lat * Math.PI / 180))) * Math.cos(mathAngleRad);
                        const progress = i / 60;
                        const areaMetros = pivoData.radius * 0.05;

                        L.circle([fLat, fLng], {
                            radius: areaMetros * (1 + progress * 1.5),
                            color: 'transparent',
                            fillColor: '#facc15',
                            fillOpacity: 0.04,
                            interactive: false
                        }).addTo(map);

                        L.circle([fLat, fLng], {
                            radius: areaMetros * (0.6 + progress * 1.0),
                            color: 'transparent',
                            fillColor: '#fb923c',
                            fillOpacity: 0.06,
                            interactive: false
                        }).addTo(map);

                        if (progress > 0.1) {
                            L.circle([fLat, fLng], {
                                radius: areaMetros * (0.2 + progress * 0.5),
                                color: 'transparent',
                                fillColor: '#ef4444',
                                fillOpacity: 0.12,
                                interactive: false
                            }).addTo(map);
                        }
                    }
                });
                drawPivotBoundary();
                map.fitBounds(pivBounds, { padding: [30, 30] });
            } else {
                drawPivotBoundary();
                map.fitBounds(pivBounds, { padding: [30, 30] });
            }
        } else if (pivoData.geo && window.icMapParseWKT) {
            const geoJson = window.icMapParseWKT(pivoData.geo);
            if (geoJson) {
                const layer = L.geoJSON(geoJson, {
                    style: { color: "#fff", weight: 4, fill: false }
                }).addTo(map);
                map.fitBounds(layer.getBounds());
            }
        }

        setTimeout(() => { map.invalidateSize(); }, 250);
        setTimeout(() => { map.invalidateSize(); }, 600);
    }

    function unbindEvents() {
        if (!eventsBound) return;
        eventsBound = false;

        if (onDocClick) {
            document.removeEventListener("click", onDocClick);
            onDocClick = null;
        }

        if (onSimStatusChange) {
            window.removeEventListener("ic:sim-status-change", onSimStatusChange);
            onSimStatusChange = null;
        }
    }

    // getFarmDataSafe/getFarmEquipmentsSafe/normalizeEquipmentText/
    // isWeatherStationEquipment compartilhados \u2014 ver assets/js/core/farm-utils.js
    const getFarmDataSafe = window.IcFarm.getActiveFarmSafe;
    const { getFarmEquipmentsSafe, normalizeEquipmentText, isWeatherStationEquipment } = window.IcFarm;

    function normalizeControllerToken(value) {
        return String(value || "")
            .toLowerCase()
            .replaceAll(" ", "")
            .replaceAll("_", "");
    }

    function shouldShowFaultsCard(pivoData) {
        const controllerToken = normalizeControllerToken(
            pivoData?.controllerType || pivoData?.type || pivoData?.panelType
        );
        return controllerToken === "smartconnect" || controllerToken === "nexus";
    }

    function syncFaultsCardVisibility(pivoData) {
        const faultsCard = $("pivoFaultsCard");
        if (!faultsCard) return;
        faultsCard.hidden = !shouldShowFaultsCard(pivoData);
    }

    function getAllPivotOptions(farm) {
        const equipments = getFarmEquipmentsSafe(farm);
        const pivotEquipments = equipments.filter((e) => {
            const c = String(e?.category || "").toLowerCase();
            return c === "pivos" || c === "pivo" || c === "pivot" || c === "pivots";
        });

        const existingIds = new Set(pivotEquipments.map((item) => String(item?.id || "")));
        const legacyPivots = Array.isArray(farm?.pivos) ? farm.pivos : [];
        const extraPivots = legacyPivots
            .filter((item) => !existingIds.has(String(item?.id || "")))
            .map((item) => ({
                id: item.id,
                name: item.name || item.nome,
                category: "pivos",
                type: item.controllerType || "smart_connect",
                data: {
                    lat: item.lat,
                    lng: item.lng,
                    radius: item.radius,
                    refLat: item.refLat,
                    refLng: item.refLng
                }
            }));

        return [...pivotEquipments, ...extraPivots];
    }

    function getSelectedPivotEquipment() {
        const farm = getFarmDataSafe();
        return getAllPivotOptions(farm).find((item) => String(item?.id || "") === String(state.selectedId)) || null;
    }

    function renderPivotSelectorList() {
        const selectorMenu = $("pivoSelectorMenu");
        if (!selectorMenu) return;
        renderAllEquipmentInMenu(selectorMenu, state.selectedId, "pivos", () => window.IcPivos?.close?.());
    }

    function renderAllEquipmentInMenu(menu, currentId, currentType, closeSelf) {
        const copy = getDetailsCopy();
        const farm = getFarmDataSafe();
        const equipments = getFarmEquipmentsSafe(farm);
        const allPivots = getAllPivotOptions(farm);

        const groups = [
            {
                label: copy.pivots, type: "pivos",
                items: allPivots,
                open: id => window.IcPivos?.open?.({ pivotId: id })
            },
            {
                label: copy.pumps, type: "bombas",
                items: equipments.filter(e => { const t = String(e?.type || "").toLowerCase(); const c = String(e?.category || "").toLowerCase(); return t === "irripump" || c === "bombas"; }),
                open: id => window.IcBombaDetails?.open?.({ BmbId: id })
            },
            {
                label: copy.levelMeters, type: "medidores",
                items: equipments.filter(e => { const t = String(e?.type || "").toLowerCase(); const c = String(e?.category || "").toLowerCase(); return t === "medidor" || c === "medidores"; }),
                open: id => window.IcMdnDetails?.open?.({ mdnId: id })
            },
            {
                label: copy.weatherStation, type: "estacoes",
                items: equipments.filter(isWeatherStationEquipment),
                open: id => window.IcEstacaoDetails?.open?.({ estId: id })
            }
        ].filter(g => g.items.length > 0);

        menu.innerHTML = "";

        if (!groups.length) {
            menu.innerHTML = `<div style="padding:10px 12px;font-size:12px;color:#64748b;">${copy.noEquipment}</div>`;
            return;
        }

        groups.forEach(group => {
            const wrapper = document.createElement("section");
            const hasCurrent = group.type === currentType && group.items.some((item) => String(item.id) === String(currentId));
            wrapper.className = "pivo-selector__group" + (hasCurrent ? " is-open" : "");

            const header = document.createElement("button");
            header.type = "button";
            header.className = "pivo-selector__group-header";
            header.setAttribute("aria-expanded", hasCurrent ? "true" : "false");
            const titleSpan = document.createElement("span");
            titleSpan.className = "pivo-selector__group-title";
            titleSpan.textContent = group.label;
            header.innerHTML = `<span class="pivo-selector__group-chevron"><i class="fa-solid fa-caret-right"></i></span>`;
            header.appendChild(titleSpan);
            header.addEventListener("click", (ev) => {
                ev.stopPropagation();
                const nextOpen = !wrapper.classList.contains("is-open");
                wrapper.classList.toggle("is-open", nextOpen);
                header.setAttribute("aria-expanded", nextOpen ? "true" : "false");
            });

            const body = document.createElement("div");
            body.className = "pivo-selector__group-body";

            group.items.forEach(item => {
                const isCurrent = group.type === currentType && String(item.id) === String(currentId);
                const name = item.name || item.nome || item.data?.nome || item.data?.serial || group.label;
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "pivo-selector__item" + (isCurrent ? " is-selected" : "");
                const nameSpan = document.createElement("span");
                nameSpan.textContent = name;
                btn.innerHTML = `<span class="pivo-selector__item-mark">${isCurrent ? '<i class="fa-solid fa-check"></i>' : ''}</span>`;
                btn.appendChild(nameSpan);
                btn.addEventListener("click", ev => {
                    ev.stopPropagation();
                    menu.style.display = "none";
                    const selectBtn = $("pivoSelectBtn");
                    if (selectBtn) selectBtn.classList.remove("is-active");
                    if (!isCurrent) {
                        if (group.type !== currentType) {
                            closeSelf?.();
                        }
                        group.open(item.id);
                    }
                });
                body.appendChild(btn);
            });

            wrapper.appendChild(header);
            wrapper.appendChild(body);
            menu.appendChild(wrapper);
        });
    }

    function renderHeaderAndKPIs() {
        // Sempre monta lista
        renderPivotSelectorList();

        const activeVariant = getActiveDetailsVariant();
        const copy = getDetailsCopy();
        const fallbackTitle = copy.english ? "Pivot" : copy.spanish ? "Pivote" : "Pivo";
        const pivoData = Pivos.data.getPivotData?.(state.selectedId);
        syncFaultsCardVisibility(pivoData);

        if (!pivoData) {
            const titleEl = document.querySelector(".pincard__title");
            if (titleEl) titleEl.textContent = fallbackTitle;
            return;
        }

        const titleEl = document.querySelector(".pincard__title");
        if (titleEl) titleEl.textContent = pivoData.name || fallbackTitle;

        // Gerar dados "aleatórios" mas estáveis por pivô para simular realidade
        const seed = String(state.selectedId).split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        
        const kpiAngulo = $("kpiAnguloVal");
        if (kpiAngulo) kpiAngulo.textContent = `${(seed * 7) % 360}°`;

        const kpiPCentro = $("kpiPressaoCentroVal");
        if (kpiPCentro) kpiPCentro.textContent = `${(3.5 + (seed % 20) / 10).toFixed(1)} bar`;

        const kpiHoras = $("kpiHorasVal");
        if (kpiHoras) kpiHoras.textContent = `${150 + (seed % 200)}h`;

        const kpiPluv = $("kpiPluviometroVal");
        if (kpiPluv) kpiPluv.textContent = `${(5 + (seed % 150) / 10).toFixed(1)} mm`;

        const kpiPTorre = $("kpiPressaoTorreVal");
        if (kpiPTorre) kpiPTorre.textContent = `${(2.0 + (seed % 15) / 10).toFixed(1)} bar`;

        const kpiVoltagem = $("kpiVoltagemVal");
        if (kpiVoltagem) kpiVoltagem.textContent = `${208 + (seed % 23)} V`;

        const kpiVoltas = $("kpiVoltasVal");
        if (kpiVoltas) kpiVoltas.textContent = 20 + (seed % 31);

        // Valores reais do histórico fictício (mesma fonte do Histórico,
        // gráficos e Relatórios) — sobrescreve os placeholders acima.
        const DHc = window.IcDemoHistory;
        const cur = DHc?.findEquipment(state.selectedId) ? DHc.pivot.current(state.selectedId) : null;
        if (cur) {
            const f1 = (v) => Number(v).toFixed(1);
            if (kpiAngulo) kpiAngulo.textContent = `${Math.round(cur.angle)}°`;
            if (kpiPCentro) kpiPCentro.textContent = `${f1(cur.pressureCenter)} bar`;
            if (kpiHoras) kpiHoras.textContent = `${Math.round(cur.hours)}h`;
            // chuva de hoje no pluviômetro do pivô (= última barra do gráfico Pluviometria)
            const ctxP = DHc.findEquipment(state.selectedId);
            if (kpiPluv) kpiPluv.textContent = `${f1(DHc.localRain(ctxP?.farm?.id, state.selectedId, DHc.NOW))} mm`;
            if (kpiPTorre) kpiPTorre.textContent = `${f1(cur.pressureTower)} bar`;
            if (kpiVoltagem) kpiVoltagem.textContent = `${cur.voltage} V`;
            if (kpiVoltas) kpiVoltas.textContent = Math.round(cur.laps);
            const footer = document.querySelector(".pincard__footer");
            if (footer) footer.innerHTML = `<span class="comm-label">${getDetailsCopy().lastCommunication || "Última comunicação"}:</span> ${localizeUiText(DHc.fmt.dateTime(cur.lastCommunication), getDetailsCopy())}`;
        }
        activeVariant?.afterRenderHeader?.({ pivoData, state });
        const activeHistoryTab = document.querySelector(".js-history-tab.is-active")?.getAttribute("data-tab") || "eventos";
        renderHistoryTable(activeHistoryTab);
        localizeSmartTouchStaticUI();
        updatePincardStatus(state.selectedId);

        // Aumentado timeout para garantir que o container esteja visível e com dimensões calculadas
        setTimeout(() => renderMinimap(pivoData), 300);
    }

    const _PINCARD_STATUS_MAP = {
        painel_energizado:      { cls: "is-energized", text: "PAINEL ENERGIZADO" },
        irrigando:              { cls: "is-running",   text: "IRRIGANDO" },
        movendo_a_seco:         { cls: "is-brown",     text: "MOVENDO A SECO" },
        irrigacao_finalizada:   { cls: "is-complete",  text: "IRRIGAÇÃO FINALIZADA" },
        painel_desligado:       { cls: "is-orange",    text: "PAINEL DESLIGADO" },
        preparando_irrigar:     { cls: "is-success",   text: "PREPARANDO PARA RELIGAR" },
        alerta:                 { cls: "is-danger",    text: "ALERTA" },
        desligado_sem_internet: { cls: "is-neutral",   text: "SEM INTERNET" },
        ferti_irrigando:        { cls: "is-ferti",     text: "FERTI IRRIGANDO" },
    };

    function updatePincardStatus(pivotId) {
        const bar = document.querySelector(".pincard__status-bar");
        const textEl = document.querySelector(".pincard__status-text");
        if (!bar) return;

        const pivoData = Pivos.data.getPivotData?.(pivotId);
        const resolved = window.IcResolvePivotStatus?.(pivoData || { id: pivotId });
        const key = resolved?.key || "painel_energizado";
        const map = _PINCARD_STATUS_MAP[key] || _PINCARD_STATUS_MAP.painel_energizado;

        const allCls = Object.values(_PINCARD_STATUS_MAP).map(m => m.cls);
        bar.classList.remove(...allCls);
        bar.classList.add(map.cls);
        if (textEl) textEl.textContent = map.text;

        // Ícone "Central Online" some quando o pivô está sem internet
        const powerEl = document.querySelector(".pincard__status-power");
        if (powerEl) powerEl.style.display = key === "desligado_sem_internet" ? "none" : "";
    }

    function safeInvalidateMinimap() {
        if (!minimapInstance) return;
        try {
            minimapInstance.invalidateSize(true);
        } catch (e) { }
    }

    function destroyMinimapOnly() {
        // ❗ NÃO mexe em eventos aqui. Só minimapa.
        if (minimapCenterMarker) {
            try {
                minimapCenterMarker.remove();
            } catch (e) { }
            minimapCenterMarker = null;
        }

        if (minimapLayer) {
            try {
                minimapLayer.remove();
            } catch (e) { }
            minimapLayer = null;
        }

        if (minimapInstance) {
            try {
                minimapInstance.stop();
                minimapInstance.off();
                minimapInstance.remove();
            } catch (e) { }
            minimapInstance = null;
        }

        minimapTilesPrimary = null;
        minimapTilesFallback = null;
    }

    function renderMinimap(pivoData) {
        // 1. Localizar o elemento (usando querySelector para ser mais versátil se houver duplicates)
        const mapEl = document.querySelector("#pivoMinimap");
        if (!mapEl) return;

        // 2. Destruição rigorosa da instância anterior
        if (minimapInstance) {
            try {
                minimapInstance.stop();
                minimapInstance.off();
                minimapInstance.remove();
            } catch (e) {
                console.warn("[pivo minimap] Erro ao remover mapa:", e);
            }
            minimapInstance = null;
        }

        // 3. Limpeza total do DOM de qualquer vestígio do Leaflet
        const cleanElement = (el) => {
            if (el._leaflet_id) delete el._leaflet_id;
            el.innerHTML = "";
            el.className = "pincard__map"; // Remove leaflet-container, leaflet-fade-anim, etc.
        };

        // Limpa TODOS os elementos com esse ID (prevejo IDs duplicados no DOM)
        document.querySelectorAll("#pivoMinimap").forEach(cleanElement);

        // 4. Verificação de Visibilidade
        // Se o elemento não tem tamanho, o Leaflet gera o mapa cinza.
        if (mapEl.offsetHeight === 0) {
            setTimeout(() => renderMinimap(pivoData), 200);
            return;
        }

        // 5. Nova Instância
        try {
            minimapInstance = L.map(mapEl, {
                zoomControl: false,
                attributionControl: false,
                dragging: false,
                scrollWheelZoom: false,
                doubleClickZoom: false,
                boxZoom: false,
                keyboard: false,
                tap: false,
                fadeAnimation: false,
                zoomAnimation: false,
                zoomSnap: 0
            });

            // 6. Tiles (ArcGIS Satellite)
            minimapTilesPrimary = L.tileLayer(
                "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                { maxZoom: 19 }
            );
            minimapTilesPrimary.addTo(minimapInstance);

            // Tiles Fallback (OSM)
            minimapTilesPrimary.on("tileerror", () => {
                if (!minimapInstance || minimapTilesFallback) return;
                minimapTilesFallback = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                    maxZoom: 19
                });
                minimapTilesFallback.addTo(minimapInstance);
            });

            // 7. Configuração da View
            const lat = pivoData?.center?.lat || -16.257;
            const lng = pivoData?.center?.lng || -47.413;
            const radius = pivoData?.radius || 300;
            const sharedPivotUtils = window.IcMapPivotVisualUtils || null;
            const selectedPivotEquip = getSelectedPivotEquipment();
            const pivotColors = sharedPivotUtils?.getPivotVisuals?.(pivoData, selectedPivotEquip) || {
                outline: "#fbbf24",
                stroke: "#fbbf24",
                fill: "#fbbf24",
                fillOpacity: 0.22,
                ref: "#ffffff",
                refFill: "#ffffff",
                outerFill: "",
                outerFillOpacity: 0,
                bandProgress: 0
            };
            const useOuterBand = sharedPivotUtils?.getPivotVisualStyle?.() === "outer_band";
            const innerRadius = radius * (pivotColors.outerFill ? (sharedPivotUtils?.statusBandInnerRatio || 0.9) : 0.8);
            const hasStatusBand = Boolean(pivotColors.outerFill) && innerRadius > 0;
            const shapeFillOpacity = hasStatusBand ? (pivotColors.fillOpacity ?? 0.92) : (useOuterBand ? 0 : pivotColors.fillOpacity);
            const bandFillColor = hasStatusBand ? pivotColors.outerFill : pivotColors.fill;
            const bandFillOpacity = hasStatusBand
                ? (pivotColors.outerFillOpacity ?? 0.98)
                : (useOuterBand ? Math.min(pivotColors.fillOpacity ?? 0.22, 0.82) : 0);
            const bandProgress = Math.max(0, Math.min(100, Number(pivotColors.bandProgress) || 0));
            const centerMarkerHtml = sharedPivotUtils?.getCentralMarkerHtml?.() || `
                <div class="map-central-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path class="rep-path-4" d="M16.247 7.761a6 6 0 0 1 0 8.478"/>
                        <path class="rep-path-5" d="M19.075 4.933a10 10 0 0 1 0 14.134"/>
                        <path class="rep-path-2" d="M4.925 19.067a10 10 0 0 1 0-14.134"/>
                        <path class="rep-path-3" d="M7.753 16.239a6 6 0 0 1 0-8.478"/>
                        <circle cx="12" cy="12" r="2" fill="currentColor"/>
                    </svg>
                </div>
            `;

            minimapInstance.setView([lat, lng], 16.5);

            // 8. Desenho do Equipamento (Estilo Clássico Amarelo/Ouro do Mapa Principal)
            if (pivoData?.center) {
                const centerPt = [pivoData.center.lat, pivoData.center.lng];
                const centerLL = L.latLng(pivoData.center.lat, pivoData.center.lng);
                const lat1 = pivoData.center.lat * Math.PI / 180;
                const lon1 = pivoData.center.lng * Math.PI / 180;
                const R = 6378137;
                const d = radius / R;

                const shapeOutlineOpts = {
                    color: pivotColors.outline,
                    weight: 2.5,
                    opacity: 0.85,
                    fillOpacity: 0,
                    interactive: false,
                };
                const shapeOpts = {
                    color: pivotColors.stroke,
                    weight: 2,
                    fillColor: pivotColors.fill,
                    fillOpacity: shapeFillOpacity,
                };

                if (pivoData.isSector && pivoData.startAngle !== undefined && pivoData.endAngle !== undefined && pivoData.ref) {
                    // Setor parcial — igual ao mapa principal
                    const lat2 = pivoData.ref.lat * Math.PI / 180;
                    const lon2 = pivoData.ref.lng * Math.PI / 180;
                    const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
                    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
                    const bearingRef = Math.atan2(y, x) * 180 / Math.PI;

                    let startAngle = parseFloat(pivoData.startAngle) || 0;
                    let endAngle = parseFloat(pivoData.endAngle) || 360;
                    if (endAngle <= startAngle) endAngle += 360;

                    const points = [centerLL];
                    for (let angle = startAngle; angle <= endAngle; angle += 2) {
                        const brng = (bearingRef + angle) * Math.PI / 180;
                        const pLat = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
                        const pLng = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(pLat));
                        points.push(L.latLng(pLat * 180 / Math.PI, pLng * 180 / Math.PI));
                    }
                    const brngEnd = (bearingRef + endAngle) * Math.PI / 180;
                    const eLat = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brngEnd));
                    const eLng = lon1 + Math.atan2(Math.sin(brngEnd) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(eLat));
                    points.push(L.latLng(eLat * 180 / Math.PI, eLng * 180 / Math.PI));
                    points.push(centerLL);

                    L.polygon(points, shapeOutlineOpts).addTo(minimapInstance);
                    minimapLayer = L.polygon(points, shapeOpts).addTo(minimapInstance);

                    const shouldDrawStatusBand = hasStatusBand && bandProgress > 0;
                    const bandEndAngle = startAngle + ((endAngle - startAngle) * bandProgress) / 100;
                    if (shouldDrawStatusBand && sharedPivotUtils?.buildSectorRing) {
                        L.polygon(sharedPivotUtils.buildSectorRing(pivoData.center, radius, innerRadius, bearingRef, startAngle, bandEndAngle), {
                            color: pivotColors.stroke,
                            weight: 0,
                            fillColor: bandFillColor,
                            fillOpacity: bandFillOpacity,
                            interactive: false,
                        }).addTo(minimapInstance);
                    } else if (useOuterBand && innerRadius > 0 && sharedPivotUtils?.buildSectorRing) {
                        L.polygon(sharedPivotUtils.buildSectorRing(pivoData.center, radius, innerRadius, bearingRef, startAngle, endAngle), {
                            color: pivotColors.stroke,
                            weight: 0,
                            fillColor: bandFillColor,
                            fillOpacity: bandFillOpacity,
                            interactive: false,
                        }).addTo(minimapInstance);
                    }

                    // Linha de referência branca
                    const brngRefRad = bearingRef * Math.PI / 180;
                    const rLat = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brngRefRad));
                    const rLng = lon1 + Math.atan2(Math.sin(brngRefRad) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(rLat));
                    L.polyline([centerPt, [rLat * 180 / Math.PI, rLng * 180 / Math.PI]], {
                        color: "rgba(0,0,0,0.7)", weight: 3, opacity: 1
                    }).addTo(minimapInstance);
                    L.polyline([centerPt, [rLat * 180 / Math.PI, rLng * 180 / Math.PI]], {
                        color: pivotColors.ref,
                        weight: 2,
                        opacity: 0.95
                    }).addTo(minimapInstance);

                } else {
                    // Círculo completo
                    L.circle(centerPt, { radius, ...shapeOutlineOpts }).addTo(minimapInstance);
                    minimapLayer = L.circle(centerPt, { radius, ...shapeOpts }).addTo(minimapInstance);

                    const shouldDrawStatusBand = hasStatusBand && bandProgress > 0 && pivoData.ref;
                    if (shouldDrawStatusBand && sharedPivotUtils?.buildSectorRing && sharedPivotUtils?.getPivotBearingRefDeg) {
                        L.polygon(sharedPivotUtils.buildSectorRing(
                            pivoData.center,
                            radius,
                            innerRadius,
                            sharedPivotUtils.getPivotBearingRefDeg(pivoData),
                            0,
                            (360 * bandProgress) / 100
                        ), {
                            color: pivotColors.stroke,
                            weight: 0,
                            fillColor: bandFillColor,
                            fillOpacity: bandFillOpacity,
                            interactive: false,
                        }).addTo(minimapInstance);
                    } else if (useOuterBand && innerRadius > 0 && sharedPivotUtils?.buildFullRing) {
                        L.polygon(sharedPivotUtils.buildFullRing(pivoData.center, radius, innerRadius), {
                            color: pivotColors.stroke,
                            weight: 0,
                            fillColor: bandFillColor,
                            fillOpacity: bandFillOpacity,
                            interactive: false,
                        }).addTo(minimapInstance);
                    }

                    // Linha de referência e triângulo se existir ref
                    if (pivoData.ref) {
                        const ang = bearingRad(pivoData.center, pivoData.ref);
                        const lineEnd = destinationPoint(pivoData.center, radius, ang);

                        L.polyline([centerPt, [lineEnd.lat, lineEnd.lng]], {
                            color: "rgba(0,0,0,0.7)", weight: 3, opacity: 1
                        }).addTo(minimapInstance);
                        L.polyline([centerPt, [lineEnd.lat, lineEnd.lng]], {
                            color: pivotColors.ref,
                            weight: 2,
                            opacity: 0.95
                        }).addTo(minimapInstance);

                        const wedgeAngle = (8 * Math.PI) / 180;
                        const left = destinationPoint(pivoData.center, radius, ang - wedgeAngle);
                        const right = destinationPoint(pivoData.center, radius, ang + wedgeAngle);
                        const inner = destinationPoint(pivoData.center, radius * 0.7, ang);
                        L.polygon([
                            [left.lat, left.lng],
                            [right.lat, right.lng],
                            [inner.lat, inner.lng]
                        ], {
                            color: pivotColors.ref,
                            weight: 1,
                            fillColor: pivotColors.refFill,
                            fillOpacity: 0.95
                        }).addTo(minimapInstance);
                    }
                }



                // Força o ajuste se as bordas forem maiores
                try {
                    minimapInstance.fitBounds(minimapLayer.getBounds(), {
                        padding: [18, 18],
                        maxZoom: 14.2
                    });
                } catch (e) { }
            }
        } catch (err) {
            console.error("[pivo minimap] Falha crítica ao iniciar mapa:", err);
        }

        // 9. Ciclo de Invalidação Persistente (Solução definitiva para o "Gray Bug")
        const forceInval = () => {
            if (minimapInstance) {
                minimapInstance.invalidateSize();
            }
        };

        setTimeout(forceInval, 150);
        setTimeout(forceInval, 600);
    }

    function scrollToSection(section = "top") {
        const target = section === "details"
            ? document.querySelector("#pivosPanel .pivo-bottom-row") || document.querySelector("#pivosPanel .pivo-faults")
            : $("pageSlot") || document.querySelector("#pivosPanel");
        if (target && typeof target.scrollIntoView === "function") {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }

    async function showMainView(options = {}) {
        document.body.classList.remove("is-pivo-details-only");
        document.body.classList.add("is-pivo-details");

        if (window.icMapSetWheelMode) window.icMapSetWheelMode("ctrl");

        const mounted = await mountPanel();
        if (!mounted) {
            document.body.classList.remove("is-pivo-details");
            if (window.icMapSetWheelMode) window.icMapSetWheelMode("free");
            return;
        }

        renderHeaderAndKPIs();

        if (views.charts && typeof views.charts.renderCharts === "function" && getActiveDetailsVariant()?.key !== "smarttouch") {
            views.charts.renderCharts();
        }
        // Gráfico "Consumo de Água" existe no Centerstar, SmartTouch e
        // LineStar (id compartilhado #pivoChartWaterST) — diferente do
        // renderCharts acima, roda pra todas as variantes.
        if (views.charts && typeof views.charts.renderWaterChart === "function") {
            views.charts.renderWaterChart(state.selectedId);
        }
        // Popover de período é global (compartilhado com a Pluviometria); ao
        // montar a tela do pivô, sincroniza o rótulo "Período" com o que já
        // estava selecionado, em vez de deixar preso no texto padrão.
        window.Plv?.period?.syncUI?.();

        const map = window.icMap;
        if (map && typeof map.invalidateSize === "function") {
            map.invalidateSize({ pan: false });
            requestAnimationFrame(() => map.invalidateSize({ pan: false }));
            setTimeout(() => map.invalidateSize({ pan: false }), 180);
        }

        setTimeout(() => {
            scrollToSection(options.focusSection);
            setTimeout(safeInvalidateMinimap, 120);
            setTimeout(safeInvalidateMinimap, 300);
        }, 350);
    }

    // ✅ usado no close da view (aí sim desliga eventos)
    function destroyView() {
        unbindEvents();
        destroyMinimapOnly();
        clearDetailsVariantBodyClasses();
    }

    async function updateSelected(pivotId) {
        state.selectedId = pivotId;

        const menu = $("pivoSelectorMenu");
        if (menu) menu.style.display = "none";

        // ✅ só destrói minimapa, NÃO remove eventos
        destroyMinimapOnly();

        renderHeaderAndKPIs();

        if (views.charts && typeof views.charts.renderCharts === "function" && getActiveDetailsVariant()?.key !== "smarttouch") {
            views.charts.renderCharts();
        }
        if (views.charts && typeof views.charts.renderWaterChart === "function") {
            views.charts.renderWaterChart(state.selectedId);
        }

        const map = window.icMap;
        if (map && typeof map.invalidateSize === "function") {
            requestAnimationFrame(() => map.invalidateSize({ pan: false }));
        }
    }

    // Helpers Geográficos para desenhar o pivô exatamente como no mapa principal
    function bearingRad(from, to) {
        const toRad = (deg) => (deg * Math.PI) / 180;
        const lat1 = toRad(from.lat);
        const lat2 = toRad(to.lat);
        const dLng = toRad(to.lng - from.lng);
        const y = Math.sin(dLng) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
        return Math.atan2(y, x);
    }

    function destinationPoint(origin, distance, bearing) {
        const R = 6378137;
        const toRad = (deg) => (deg * Math.PI) / 180;
        const toDeg = (rad) => (rad * 180) / Math.PI;
        const delta = distance / R;
        const theta = bearing;
        const phi1 = toRad(origin.lat);
        const lambda1 = toRad(origin.lng);

        const sinPhi1 = Math.sin(phi1);
        const cosPhi1 = Math.cos(phi1);
        const sinDelta = Math.sin(delta);
        const cosDelta = Math.cos(delta);

        const sinPhi2 = sinPhi1 * cosDelta + cosPhi1 * sinDelta * Math.cos(theta);
        const phi2 = Math.asin(Math.max(-1, Math.min(1, sinPhi2)));
        const y = Math.sin(theta) * sinDelta * cosPhi1;
        const x = cosDelta - sinPhi1 * Math.sin(phi2);
        const lambda2 = lambda1 + Math.atan2(y, x);

        return { lat: toDeg(phi2), lng: toDeg(lambda2) };
    }
    // Filtros do histórico: eventos de Central e de GPS só aparecem quando ligados.
    const historyFilters = { central: false, gps: false };

    // Comando com operações em cadeia: o painel aceita até 7 operações
    // programadas em sequência, executadas uma após a outra.
    const CHAINED_OPERATIONS_MOCK = Object.freeze([
        { modo: "Seco", direcao: "Avanço", percentimetroLamina: "100% - 3,93 mm", modoInicio: "Imediato", modoParada: "Parada por Ângulo", anguloParada: "180°" },
        { modo: "Molhado", direcao: "Reverso", percentimetroLamina: "100% - 3,93 mm", modoInicio: "Imediato", modoParada: "Parada por Ângulo", anguloParada: "0°" },
        { modo: "Molhado", direcao: "Avanço", percentimetroLamina: "80% - 4,91 mm", modoInicio: "Imediato", modoParada: "Parada por Ângulo", anguloParada: "180°" },
        { modo: "Seco", direcao: "Reverso", percentimetroLamina: "100% - 3,93 mm", modoInicio: "Imediato", modoParada: "Parada por Ângulo", anguloParada: "90°" },
        { modo: "Molhado", direcao: "Avanço", percentimetroLamina: "60% - 6,55 mm", modoInicio: "Imediato", modoParada: "Parada por Ângulo", anguloParada: "270°" },
        { modo: "Molhado", direcao: "Reverso", percentimetroLamina: "60% - 6,55 mm", modoInicio: "Imediato", modoParada: "Parada por Ângulo", anguloParada: "90°" },
        { modo: "Seco", direcao: "Avanço", percentimetroLamina: "100% - 3,93 mm", modoInicio: "Imediato", modoParada: "Parada por Ângulo", anguloParada: "173°" },
    ]);

    function renderCentralEventoRow(date, online) {
        return renderEventoRow(date, "Atualização de Central", online ? "Central Online" : "Central Offline", { central: true, recebidoEm: `${date}:00` });
    }

    function renderGpsEventoRow(date, angle, details) {
        const angleText = `${angle.toFixed(1).replace(".", ",")}°`;
        const posicao = getLastTowerPosition(angle);
        return renderEventoRow(date, "Atualização de GPS", `${angleText} | ${details.lamina} | ${details.pressaoCentro} - ${details.pressaoUltimaTorre} | ${details.tensao}`, {
            gps: true,
            recebidoEm: `${date}:00`,
            posicao,
            previsaoTermino: "-",
            duracaoPrevista: "-",
            pressaoUltimaTorre: details.pressao,
            horimetroTotal: details.horimetroTotal,
            horimetroMolhado: details.horimetroMolhado,
            irrigacaoAtiva: details.irrigacaoAtiva,
            modoInicio: details.modoInicio,
            direcao: details.direcao,
            modo: details.modo,
            modoParada: details.modoParada,
            anguloAtual: angleText,
            anguloParada: details.anguloParada,
            percentimetroLamina: details.percentimetroLamina,
        });
    }

    // Posição da última torre (onde fica o GPS) a partir do centro do pivô
    // aberto, do raio e do ângulo, medido a partir da referência de 0°.
    function getLastTowerPosition(angleDeg) {
        const pivoData = Pivos.data?.getPivotData?.(state.selectedId);
        const center = {
            lat: Number(pivoData?.center?.lat) || -16.257,
            lng: Number(pivoData?.center?.lng) || -47.413,
        };
        const radius = Number(pivoData?.radius) || 300;
        const refBearing = pivoData?.ref ? bearingRad(center, pivoData.ref) : 0;
        const point = destinationPoint(center, radius, refBearing + (angleDeg * Math.PI) / 180);
        return { lat: point.lat, lng: point.lng };
    }

    function formatLatLng(position) {
        return `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`;
    }

    function renderMapLink(position) {
        const query = `${position.lat.toFixed(6)},${position.lng.toFixed(6)}`;
        return `<a class="pivo-history__map-link" href="https://www.google.com/maps/search/?api=1&amp;query=${query}" target="_blank" rel="noopener noreferrer">${formatLatLng(position)}</a>`;
    }

    const GPS_MOCK_DETAILS = Object.freeze({
        lamina: "9,95 mm",
        pressao: "1,1 bar",
        // Linha fechada mostra as duas pressões: centro - última torre
        pressaoCentro: "2,40 bar",
        pressaoUltimaTorre: "1,10 bar",
        tensao: "486 V",
        horimetroTotal: "2962h 39min",
        horimetroMolhado: "2757h 55min",
        irrigacaoAtiva: "Irrigação Simples - Fertirrigação Desabilitada",
        modoInicio: "Imediato",
        direcao: "Avanço",
        modo: "Molhado",
        modoParada: "Parada por Ângulo",
        anguloParada: "358°",
        percentimetroLamina: "47% - 9,95 mm",
    });

    const EVENTOS_PAGES = {
        1: () => `
            ${renderEventoRow("18 mai 2026 10:12", "Comando", "IRRIGAÇÃO POR AGENDAMENTO", { cadeia: CHAINED_OPERATIONS_MOCK, enviadoEm: "18 mai 2026 10:12:00", enviadoPor: "bauer@irricontrol.com", horimetroTotal: "2962h 53min", horimetroMolhado: "2758h 09min", anguloAtual: "172,90°" }, "green")}
            ${historyFilters.central ? renderCentralEventoRow("18 mai 2026 10:05", true) : ""}
            ${historyFilters.central ? renderCentralEventoRow("18 mai 2026 10:01", false) : ""}
            ${historyFilters.gps ? renderGpsEventoRow("18 mai 2026 09:58", 89.4, GPS_MOCK_DETAILS) : ""}
            ${renderEventoRow("18 mai 2026 09:54", "Comando", "IRRIGAÇÃO SIMPLES | AVANÇO | MOLHADO | 47% | 9,95 mm", { enviadoEm: "18 mai 2026 09:54:00", enviadoPor: "Nome", previsaoTermino: "18/05/2026 12:54", duracaoPrevista: "03h 00min", pressaoUltimaTorre: "1,1 bar", horimetroTotal: "2962h 35min", horimetroMolhado: "2757h 51min", irrigacaoAtiva: "Irrigação Simples - Fertirrigação Desabilitada", modoInicio: "Imediato", direcao: "Avanço", modo: "Molhado", modoParada: "Parada por Ângulo", anguloAtual: "88,50°", anguloParada: "358°", percentimetroLamina: "47% - 9,95 mm" }, "green")}
            ${renderEventoRow("18 mai 2026 09:54", "Comando", "IRRIGAÇÃO SIMPLES | AVANÇO | MOLHADO | 47% | 9,95 mm", { enviadoEm: "18 mai 2026 09:54:00", enviadoPor: "Nome", previsaoTermino: "18/05/2026 12:54", duracaoPrevista: "03h 00min", pressaoUltimaTorre: "1,1 bar", horimetroTotal: "2962h 35min", horimetroMolhado: "2757h 51min", irrigacaoAtiva: "Irrigação Simples - Fertirrigação Habilitada", modoInicio: "Imediato", direcao: "Avanço", modo: "Molhado", modoParada: "Parada por Ângulo", anguloAtual: "88,50°", anguloParada: "358°", percentimetroLamina: "47% - 9,95 mm" }, "green")}
            ${renderEventoRow("18 mai 2026 09:54", "Atualização", "ESPERANDO PRESSURIZAÇÃO", { recebidoEm: "18 mai 2026 09:54:00", previsaoTermino: "18/05/2026 12:54", duracaoPrevista: "03h 00min", pressaoUltimaTorre: "1,1 bar", horimetroTotal: "2962h 35min", horimetroMolhado: "2757h 51min", irrigacaoAtiva: "Irrigação Simples - Fertirrigação Desabilitada", modoInicio: "Imediato", direcao: "Avanço", modo: "Molhado", modoParada: "Parada por Ângulo", anguloAtual: "88,50°", anguloParada: "358°", percentimetroLamina: "47% - 9,95 mm" })}
            ${renderEventoRow("18 mai 2026 09:54", "Atualização", "ESPERANDO TEMPO DE RETARDO", { recebidoEm: "18 mai 2026 09:54:00", previsaoTermino: "18/05/2026 12:54", duracaoPrevista: "03h 00min", pressaoUltimaTorre: "1,1 bar", horimetroTotal: "2962h 35min", horimetroMolhado: "2757h 51min", irrigacaoAtiva: "Irrigação Simples - Fertirrigação Desabilitada", modoInicio: "Imediato", direcao: "Avanço", modo: "Molhado", modoParada: "Parada por Ângulo", anguloAtual: "88,50°", anguloParada: "358°", percentimetroLamina: "47% - 9,95 mm" })}
            ${renderEventoRow("18 mai 2026 09:54", "Atualização", "IRRIGAÇÃO SIMPLES | AVANÇO | MOLHADO | 47% | 9,95 MM", { recebidoEm: "18 mai 2026 09:54:00", previsaoTermino: "18/05/2026 12:54", duracaoPrevista: "03h 00min", pressaoUltimaTorre: "1,1 bar", horimetroTotal: "2962h 35min", horimetroMolhado: "2757h 51min", irrigacaoAtiva: "Irrigação Simples - Fertirrigação Desabilitada", modoInicio: "Imediato", direcao: "Avanço", modo: "Molhado", modoParada: "Parada por Ângulo", anguloAtual: "88,50°", anguloParada: "358°", percentimetroLamina: "47% - 9,95 mm" })}
            ${renderEventoRow("18 mai 2026 09:54", "Comando", "IRRIGAÇÃO SIMPLES | AVANÇO | SECO | 47%", { enviadoEm: "18 mai 2026 09:54:00", enviadoPor: "Nome", previsaoTermino: "18/05/2026 12:54", duracaoPrevista: "03h 00min", pressaoUltimaTorre: "0 bar", horimetroTotal: "2962h 35min", horimetroMolhado: "2757h 51min", irrigacaoAtiva: "Irrigação Simples - Fertirrigação Desabilitada", modoInicio: "Imediato", direcao: "Avanço", modo: "Seco", modoParada: "Parada por Ângulo", anguloAtual: "88,50°", anguloParada: "358°", percentimetroLamina: "47%" }, "green")}
            ${renderEventoRow("18 mai 2026 09:54", "Atualização", "IRRIGAÇÃO SIMPLES | AVANÇO | SECO | 47%", { recebidoEm: "18 mai 2026 09:54:00", previsaoTermino: "18/05/2026 12:54", duracaoPrevista: "03h 00min", pressaoUltimaTorre: "0 bar", horimetroTotal: "2962h 35min", horimetroMolhado: "2757h 51min", irrigacaoAtiva: "Irrigação Simples - Fertirrigação Desabilitada", modoInicio: "Imediato", direcao: "Avanço", modo: "Seco", modoParada: "Parada por Ângulo", anguloAtual: "88,50°", anguloParada: "358°", percentimetroLamina: "47%" })}
            ${renderEventoRow("18 mai 2026 09:54", "Comando", "IRRIGAÇÃO INTELIGENTE | AVANÇO | MOLHADO | 47% | 9,95 MM", { enviadoEm: "18 mai 2026 09:54:00", enviadoPor: "Nome", previsaoTermino: "18/05/2026 12:54", duracaoPrevista: "03h 00min", pressaoUltimaTorre: "1,1 bar", horimetroTotal: "2962h 35min", horimetroMolhado: "2757h 51min", irrigacaoAtiva: "Irrigação Inteligente - Fertirrigação Desabilitada", modoInicio: "Imediato", direcao: "Avanço", modo: "Molhado", modoParada: "Parada por Ângulo", anguloAtual: "88,50°", anguloParada: "358°", percentimetroLamina: "47% - 9,95 mm" }, "green")}
        `,
        2: () => `
            ${historyFilters.gps ? renderGpsEventoRow("18 mai 2026 09:54", 88.5, GPS_MOCK_DETAILS) : ""}
            ${historyFilters.central ? renderCentralEventoRow("18 mai 2026 09:54", true) : ""}
            ${historyFilters.central ? renderCentralEventoRow("18 mai 2026 09:53", false) : ""}
            ${renderEventoRow("18 mai 2026 09:54", "Comando", "PARAR PIVÔ", { parada: true, enviadoEm: "18 mai 2026 09:54:00", enviadoPor: "Nome", horimetroTotal: "2962h 35min", horimetroMolhado: "2757h 51min", anguloAtual: "88,50°" }, "green")}
            ${renderEventoRow("18 mai 2026 09:54", "Comando", "PARADO VIA INTERNET", { parada: true, enviadoEm: "18 mai 2026 09:54:00", enviadoPor: "Nome", horimetroTotal: "2962h 35min", horimetroMolhado: "2757h 51min", anguloAtual: "88,50°" }, "green")}
            ${renderEventoRow("18 mai 2026 09:54", "Alerta", "SEM COMUNICAÇÃO", { recebidoEm: "18 mai 2026 09:54:00", tipoAlerta: "Sem Comunicação", horimetroTotal: "2962h 35min", horimetroMolhado: "2757h 51min", irrigacaoAtiva: "Irrigação Simples - Fertirrigação Desabilitada", modoInicio: "Imediato", direcao: "Avanço", modo: "Molhado", modoParada: "Parada por Ângulo", anguloAtual: "88,50°", anguloParada: "358°", percentimetroLamina: "47% - 9,95 mm" })}
            ${renderEventoRow("18 mai 2026 09:54", "Alerta", "ERRO DESCONHECIDO", { recebidoEm: "18 mai 2026 09:54:00", tipoAlerta: "Erro Desconhecido", horimetroTotal: "2962h 35min", horimetroMolhado: "2757h 51min", irrigacaoAtiva: "Irrigação Simples - Fertirrigação Desabilitada", modoInicio: "Imediato", direcao: "Avanço", modo: "Molhado", modoParada: "Parada por Ângulo", anguloAtual: "88,50°", anguloParada: "358°", percentimetroLamina: "47% - 9,95 mm" })}
            ${renderEventoRow("18 mai 2026 09:54", "Alerta", "DESALINHADO", { recebidoEm: "18 mai 2026 09:54:00", tipoAlerta: "Desalinhado", horimetroTotal: "2962h 35min", horimetroMolhado: "2757h 51min", irrigacaoAtiva: "Irrigação Simples - Fertirrigação Desabilitada", modoInicio: "Imediato", direcao: "Avanço", modo: "Molhado", modoParada: "Parada por Ângulo", anguloAtual: "88,50°", anguloParada: "358°", percentimetroLamina: "47% - 9,95 mm" })}
            ${renderEventoRow("17 mai 2026 22:11", "Alerta", "FALHA DE PRESSÃO NA ÚLTIMA TORRE", { recebidoEm: "17 mai 2026 22:11:00", tipoAlerta: "Falha de Pressão", pressaoUltimaTorre: "0,3 bar", horimetroTotal: "2961h 48min", horimetroMolhado: "2756h 34min", irrigacaoAtiva: "Irrigação Simples", modoInicio: "Imediato", direcao: "Avanço", modo: "Molhado", modoParada: "Parada por Ângulo", anguloAtual: "210,30°", anguloParada: "358°", percentimetroLamina: "47% - 9,95 mm" })}
            ${renderEventoRow("18 mai 2026 09:54", "Atualização", "IRRIGAÇÃO SIMPLES | AVANÇO | MOLHADO | 47% | 9,95 MM", { recebidoEm: "18 mai 2026 09:54:00", pressaoUltimaTorre: "1,1 bar", horimetroTotal: "2962h 35min", horimetroMolhado: "2757h 51min", irrigacaoAtiva: "Irrigação Simples", modoInicio: "Imediato", direcao: "Avanço", modo: "Molhado", modoParada: "Parada por Ângulo", anguloAtual: "88,50°", anguloParada: "358°", percentimetroLamina: "47% - 9,95 mm" })}
            ${renderEventoRow("18 mai 2026 09:54", "Comando", "IRRIGAÇÃO SIMPLES | AVANÇO | SECO | 47%", { enviadoEm: "18 mai 2026 09:54:00", enviadoPor: "Nome", previsaoTermino: "18/05/2026 12:54", duracaoPrevista: "03h 00min", horimetroTotal: "2962h 35min", horimetroMolhado: "2757h 51min", irrigacaoAtiva: "Irrigação Simples", modoInicio: "Imediato", direcao: "Avanço", modo: "Seco", modoParada: "Parada por Ângulo", anguloAtual: "88,50°", anguloParada: "358°", percentimetroLamina: "47%" }, "green")}
            ${renderEventoRow("18 mai 2026 09:54", "Atualização", "IRRIGAÇÃO SIMPLES | AVANÇO | SECO | 47%", { recebidoEm: "18 mai 2026 09:54:00", horimetroTotal: "2962h 35min", horimetroMolhado: "2757h 51min", irrigacaoAtiva: "Irrigação Simples", modoInicio: "Imediato", direcao: "Avanço", modo: "Seco", modoParada: "Parada por Ângulo", anguloAtual: "88,50°", anguloParada: "358°", percentimetroLamina: "47%" })}
            ${renderEventoRow("18 mai 2026 09:54", "Comando", "IRRIGAÇÃO INTELIGENTE | AVANÇO | MOLHADO | 47% | 9,95 MM", { enviadoEm: "18 mai 2026 09:54:00", enviadoPor: "Nome", tipoIrrigacao: "Segmento 1 (0° - 100°)", previsaoTermino: "18/05/2026 12:54", duracaoPrevista: "03h 00min", horimetroTotal: "2962h 35min", horimetroMolhado: "2757h 51min", irrigacaoAtiva: "Irrigação Inteligente", modoInicio: "Imediato", direcao: "Avanço", modo: "Molhado", modoParada: "Parada por Ângulo", anguloAtual: "88,50°", anguloParada: "358°", percentimetroLamina: "47% - 9,95 mm" }, "green")}
        `,
        3: () => ``,
        4: () => ``,
        5: () => ``,
    };

    // ===== Histórico gerado pelo motor (assets/js/core/demo-history.js) =====
    const HIST_PAGE_SIZE = 10;

    function dhHistoryRange() {
        return window.IcDemoHistory.periodFrom(window.Plv?.state?.period, 7);
    }

    function renderHistoryPager(page, total) {
        const pager = document.querySelector(".pivo-history__pagination");
        if (!pager) return;
        pager.innerHTML = window.IcDemoHistory.paginationHtml(page, total);
        pager.style.display = total > 1 ? "" : "none";
    }

    function emptyHistoryRow(cols, text) {
        return `<tr class="pivo-history__row"><td colspan="${cols}" style="text-align:center;padding:28px 12px;color:var(--muted-500,#64748b);">${text}</td></tr>`;
    }

    function renderHistoryTableFromEngine(tab, page) {
        const DHx = window.IcDemoHistory;
        const head = $("pivoHistoryTableHead");
        const body = $("pivoHistoryTableBody");
        const copy = getDetailsCopy();
        const activeVariantKey = getActiveDetailsVariant()?.key;
        const isSmartTouch = activeVariantKey === "smarttouch" || activeVariantKey === "centerstar";
        const range = dhHistoryRange();
        const id = state.selectedId;
        const table = head.closest("table");
        table?.classList.remove("is-centered");

        if (tab === "eventos") {
            head.innerHTML = `<tr><th></th><th style="width: 160px;">${copy.occurrence}</th><th>${copy.type}</th><th>${copy.status}</th></tr>`;
            const items = [];
            if (isSmartTouch) {
                DHx.pivot.ops(id, range.start, range.end).forEach((op) => {
                    if (op.start >= range.start) items.push({ date: op.start, html: () => renderSmartTouchEventoRow(DHx.fmt.dateTime(op.start), "change_configuration") });
                    if (op.end <= range.end) items.push({ date: op.end, html: () => renderSmartTouchEventoRow(DHx.fmt.dateTime(op.end), op.fault ? "no_communication" : "stopped_reverse") });
                });
            } else {
                DHx.pivot.events(id, range.start, range.end).forEach((ev) => {
                    items.push({ date: ev.date, html: () => renderEventoRow(DHx.fmt.dateTime(ev.date), ev.type, ev.status, ev.details, ev.dot || null) });
                });
                const ops = DHx.pivot.ops(id, range.start, range.end);
                if (historyFilters.gps) {
                    ops.filter((o) => o.wet).forEach((op) => {
                        const mid = new Date((op.start.getTime() + op.end.getTime()) / 2);
                        if (mid < range.start || mid > range.end) return;
                        const span = op.lap * 360 * (op.direction === "Avanço" ? 1 : -1);
                        const ang = (((op.angStart + span / 2) % 360) + 360) % 360;
                        const det = {
                            ...GPS_MOCK_DETAILS,
                            lamina: `${DHx.fmt.n(op.laminaMm, 2)} mm`,
                            pressao: `${DHx.fmt.n(op.pressureTower, 1)} bar`,
                            pressaoCentro: `${DHx.fmt.n(op.pressureCenter, 2)} bar`,
                            pressaoUltimaTorre: `${DHx.fmt.n(op.pressureTower, 2)} bar`,
                            tensao: `${op.voltage} V`,
                            horimetroTotal: DHx.fmt.hm((op.hourStart + op.hourEnd) / 2),
                            horimetroMolhado: DHx.fmt.hm((op.wetStart + op.wetEnd) / 2),
                            direcao: op.direction,
                            modo: op.mode,
                            anguloParada: `${Math.round(op.angEnd)}°`,
                            percentimetroLamina: `${op.percent}% - ${DHx.fmt.n(op.laminaMm, 2)} mm`,
                        };
                        items.push({ date: mid, html: () => renderGpsEventoRow(DHx.fmt.dateTime(mid), ang, det) });
                    });
                }
                if (historyFilters.central) {
                    for (let d = DHx.dayStart(range.start); d <= range.end; d = new Date(d.getTime() + DHx.DAY)) {
                        if (DHx.unit(`co|${id}|${DHx.dayKey(d)}`) > 0.25) continue;
                        const off = new Date(d.getTime() + Math.floor(DHx.unit(`cot|${id}|${DHx.dayKey(d)}`) * 23) * DHx.HOUR + 7 * DHx.MIN);
                        const on = new Date(off.getTime() + (3 + Math.floor(DHx.unit(`cod|${id}|${DHx.dayKey(d)}`) * 20)) * DHx.MIN);
                        if (off >= range.start && off <= range.end) items.push({ date: off, html: () => renderCentralEventoRow(DHx.fmt.dateTime(off), false) });
                        if (on >= range.start && on <= range.end) items.push({ date: on, html: () => renderCentralEventoRow(DHx.fmt.dateTime(on), true) });
                    }
                }
            }
            items.sort((a, b) => b.date - a.date);
            const total = Math.max(1, Math.ceil(items.length / HIST_PAGE_SIZE));
            const pg = Math.min(Math.max(1, page), total);
            body.innerHTML = items.length
                ? items.slice((pg - 1) * HIST_PAGE_SIZE, pg * HIST_PAGE_SIZE).map((it) => it.html()).join("")
                : emptyHistoryRow(4, "Nenhum evento no período selecionado.");
            renderHistoryPager(pg, total);
            return;
        }

        // Operações
        const ops = DHx.pivot.ops(id, range.start, range.end);
        const total = Math.max(1, Math.ceil(ops.length / HIST_PAGE_SIZE));
        const pg = Math.min(Math.max(1, page), total);
        const slice = ops.slice((pg - 1) * HIST_PAGE_SIZE, pg * HIST_PAGE_SIZE);
        if (isSmartTouch) {
            head.innerHTML = `<tr><th></th><th style="text-align:left">Dia</th><th>Hora início</th><th>Hora fim</th><th>Ângulo inicial</th><th>Ângulo final</th><th>Horas totais</th><th>Consumo de água (m³/h)</th></tr>`;
            body.innerHTML = slice.length ? slice.map((op) => renderSmartTouchOperacaoRow(
                DHx.fmt.date(op.start), DHx.fmt.time(op.start), DHx.fmt.time(op.end),
                `${Math.round(op.angStart)}°`, `${Math.round(op.angEnd)}°`, DHx.fmt.hm(op.durH),
                op.wet ? DHx.fmt.n(op.volume / op.durH, 1) : "0,0"
            )).join("") : emptyHistoryRow(8, "Nenhuma operação no período selecionado.");
        } else {
            head.innerHTML = `<tr><th></th><th>Início</th><th>Fim</th><th>Lâmina</th><th>Modo</th><th>Ângulo início</th><th>Ângulo fim</th><th>Voltas</th></tr>`;
            body.innerHTML = slice.length ? slice.map((op) => renderOperacaoRow(
                DHx.fmt.dateTime(op.start), DHx.fmt.dateTime(op.end), `${op.percent}%`, op.mode,
                `${DHx.fmt.n(op.angStart, 1)}°`, `${DHx.fmt.n(op.angEnd, 1)}°`, DHx.fmt.n(op.lap, 2),
                {
                    tipo: op.scheduled ? "Irrigação por Agendamento" : "Irrigação Simples",
                    laminaMm: op.wet ? DHx.fmt.n(op.laminaMm, 2) : "0,00",
                    velocidade: `${op.percent}`,
                    tempoOperacao: DHx.fmt.n(op.durH, 2),
                    usuario: op.scheduled ? "Agendamento" : op.user,
                }
            )).join("") : emptyHistoryRow(8, "Nenhuma operação no período selecionado.");
        }
        renderHistoryPager(pg, total);
    }

    // Troca de período → histórico acompanha
    document.addEventListener("pluv:periodChanged", () => {
        if (!document.getElementById("pivoHistoryTableBody")) return;
        const activeTab = document.querySelector(".js-history-tab.is-active")?.getAttribute("data-tab") || "eventos";
        renderHistoryTable(activeTab, 1);
    });

    function renderHistoryTable(tab, page = 1) {
        const head = $("pivoHistoryTableHead");
        const body = $("pivoHistoryTableBody");
        if (!head || !body) return;
        if (window.IcDemoHistory?.findEquipment(state.selectedId)) {
            renderHistoryTableFromEngine(tab, page);
            return;
        }

        const copy = getDetailsCopy();
        const activeVariantKey = getActiveDetailsVariant()?.key;
        const isSmartTouch = activeVariantKey === "smarttouch" || activeVariantKey === "centerstar";

        // Update active page button
        document.querySelectorAll(".pivo-history__pagination .btn-page").forEach((btn) => {
            if (btn.textContent.trim() === String(page)) {
                btn.classList.add("is-active");
                btn.setAttribute("aria-current", "page");
            } else {
                btn.classList.remove("is-active");
                btn.removeAttribute("aria-current");
            }
        });

        if (tab === "eventos") {
            const eventosTable = head.closest("table");
            eventosTable?.classList.remove("is-centered");
            head.innerHTML = `
                <tr>
                    <th></th>
                    <th style="width: 160px;">${copy.occurrence}</th>
                    <th>${copy.type}</th>
                    <th>${copy.status}</th>
                </tr>
            `;

            if (isSmartTouch) {
                body.innerHTML = `
                    ${renderSmartTouchEventoRow("30 abr 2026 15:17", "change_configuration")}
                    ${renderSmartTouchEventoRow("30 abr 2026 15:14", "change_configuration")}
                    ${renderSmartTouchEventoRow("30 abr 2026 06:29", "no_communication")}
                    ${renderSmartTouchEventoRow("30 abr 2026 05:48", "stopped_reverse")}
                    ${renderSmartTouchEventoRow("30 abr 2026 05:47", "stopped_reverse")}
                    ${renderSmartTouchEventoRow("30 abr 2026 05:47", "no_communication")}
                    ${renderSmartTouchEventoRow("30 abr 2026 05:41", "stopped_reverse")}
                    ${renderSmartTouchEventoRow("30 abr 2026 05:40", "stopped_reverse")}
                `;
            } else {
                body.innerHTML = (EVENTOS_PAGES[page] || EVENTOS_PAGES[1])();
            }
        } else if (tab === "operacoes") {
            const table = head.closest("table");
            if (isSmartTouch) {
                table?.classList.remove("is-centered");
                head.innerHTML = `
                    <tr>
                        <th></th>
                        <th style="text-align:left">Dia</th>
                        <th>Hora início</th>
                        <th>Hora fim</th>
                        <th>Ângulo inicial</th>
                        <th>Ângulo final</th>
                        <th>Horas totais</th>
                        <th>Consumo de água (m³/h)</th>
                    </tr>
                `;
                body.innerHTML = `
                    ${renderSmartTouchOperacaoRow("30 abr 2026", "05:27", "07:14", "310°", "42°",  "1h 47min",  "112.4")}
                    ${renderSmartTouchOperacaoRow("29 abr 2026", "22:03", "06:51", "180°", "310°", "8h 48min",  "108.7")}
                    ${renderSmartTouchOperacaoRow("29 abr 2026", "14:30", "21:58", "42°",  "180°", "7h 28min",  "114.2")}
                    ${renderSmartTouchOperacaoRow("28 abr 2026", "23:15", "14:22", "310°", "42°",  "15h 07min", "110.9")}
                    ${renderSmartTouchOperacaoRow("27 abr 2026", "06:00", "23:10", "42°",  "310°", "17h 10min", "109.3")}
                    ${renderSmartTouchOperacaoRow("26 abr 2026", "18:45", "05:55", "180°", "42°",  "11h 10min", "113.8")}
                    ${renderSmartTouchOperacaoRow("25 abr 2026", "08:20", "18:40", "310°", "180°", "10h 20min", "111.5")}
                    ${renderSmartTouchOperacaoRow("24 abr 2026", "20:05", "08:15", "42°",  "310°", "12h 10min", "107.6")}
                `;
            } else {
                table?.classList.remove("is-centered");
            head.innerHTML = `
                <tr>
                    <th></th>
                    <th>Início</th>
                    <th>Fim</th>
                    <th>Lâmina</th>
                    <th>Modo</th>
                    <th>Ângulo início</th>
                    <th>Ângulo fim</th>
                    <th>Voltas</th>
                </tr>
            `;
            body.innerHTML = `
                ${renderOperacaoRow("05 mar 2026 21:07", "06 mar 2026 06:46", "41%", "Seco", "170.5°", "337.1°", "0.47", true)}
                ${renderOperacaoRow("04 mar 2026 21:19", "05 mar 2026 06:54", "41%", "Seco", "0.8°", "169.9°", "0.47")}
                ${renderOperacaoRow("02 mar 2026 21:22", "03 mar 2026 03:25", "41%", "Seco", "253.9°", "338.7°", "0.30")}
                ${renderOperacaoRow("01 mar 2026 16:36", "02 mar 2026 06:57", "41%", "Seco", "1.8°", "250.3°", "0.71")}
                ${renderOperacaoRow("27 fev 2026 21:06", "28 fev 2026 09:20", "41%", "Seco", "147°", "357.8°", "0.60")}
                ${renderOperacaoRow("26 fev 2026 22:31", "27 fev 2026 06:42", "41%", "Seco", "0.4°", "143.6°", "0.40")}
                ${renderOperacaoRow("21 fev 2026 12:23", "21 fev 2026 13:01", "100%", "Molhado", "25.2°", "359.7°", "0.08")}
                ${renderOperacaoRow("20 fev 2026 04:45", "20 fev 2026 11:18", "36%", "Molhado", "12.4°", "118.9°", "0.29")}
            `;
            } // end else (non-smarttouch operacoes)
        }
    }

    function renderSmartTouchOperacaoRow(day, startHour, endHour, initialAngle, finalAngle, totalHours, waterConsumption) {
        const copy = getDetailsCopy();
        return `
            <tr class="pivo-history__row">
                <td class="pivo-history__col-btn"><button class="expand-btn"><i class="fa-solid fa-plus"></i></button></td>
                <td style="text-align:left">${localizeUiText(day, copy)}</td>
                <td>${startHour}</td>
                <td>${endHour}</td>
                <td>${localizeUiText(initialAngle, copy)}</td>
                <td>${localizeUiText(finalAngle, copy)}</td>
                <td>${totalHours}</td>
                <td>${waterConsumption}</td>
            </tr>
        `;
    }

    const EVENT_TYPE_DOT = {
        "Atualização": "gray",
        "Alerta": "orange",
        "Confirmação": "blue",
        "Comando": "green",
    };

    const SMARTTOUCH_EVENTO_DETAILS = {
        change_configuration: {
            eventType: "Comando",
            user: "bauer@irricontrol.com",
            command: "SET-CONFIG",
            radius: "500 m",
            sectorStart: "0°",
            sectorEnd: "160°",
            positionZero: "310°",
        },
        no_communication: {
            eventType: "Alerta",
            user: "bauer@irricontrol.com",
            command: "—",
            radius: "500 m",
            sectorStart: "0°",
            sectorEnd: "160°",
            positionZero: "310°",
        },
        stopped_reverse: {
            eventType: "Atualização",
            user: "bauer@irricontrol.com",
            command: "—",
            radius: "500 m",
            sectorStart: "0°",
            sectorEnd: "160°",
            positionZero: "310°",
        },
    };

    function getSmartTouchStatusLabel(statusCode, copy = getDetailsCopy()) {
        switch (statusCode) {
            case "change_configuration":
                return copy.changeConfiguration;
            case "no_communication":
                return copy.noCommunication;
            case "stopped_reverse":
                return copy.stoppedReverse;
            default:
                return copy.changeConfiguration;
        }
    }

    function renderSmartTouchEventoRow(date, statusCode) {
        const copy = getDetailsCopy();
        const statusLabel = getSmartTouchStatusLabel(statusCode, copy);
        const d = SMARTTOUCH_EVENTO_DETAILS[statusCode] || SMARTTOUCH_EVENTO_DETAILS.change_configuration;
        const eventType = d.eventType || "Atualização";
        let typeLabel = copy.update;
        let typeSvg = "";
        if (eventType === "Atualização") {
            typeLabel = copy.update;
            typeSvg = `<img src="./assets/img/svg/check-check.svg" style="width:16px;height:16px;vertical-align:middle;filter:invert(48%) sepia(79%) saturate(476%) hue-rotate(86deg) brightness(118%) contrast(119%);" alt="">`;
        } else if (eventType === "Confirmação") {
            typeLabel = copy.confirmation;
            typeSvg = `<img src="./assets/img/svg/check-check.svg" style="width:16px;height:16px;vertical-align:middle;filter:invert(48%) sepia(79%) saturate(476%) hue-rotate(86deg) brightness(118%) contrast(119%);" alt="">`;
        } else if (eventType === "Comando") {
            typeLabel = copy.command;
            typeSvg = `<img src="./assets/img/svg/check.svg" style="width:16px;height:16px;vertical-align:middle;opacity:0.5;" alt="">`;
        } else if (eventType === "Alerta") {
            typeLabel = copy.alert;
            typeSvg = "";
        }
        return `
            <tr class="pivo-history__row">
                <td class="pivo-history__col-btn"><button class="expand-btn"><i class="fa-solid fa-plus"></i></button></td>
                <td>${localizeUiText(date, copy)}</td>
                <td>${typeLabel} ${typeSvg}</td>
                <td>${statusLabel}</td>
            </tr>
            <tr class="pivo-history__row-details" style="display: none;">
                <td colspan="4">
                    <div class="pivo-history__details">
                        <h4>${copy.operation}</h4>
                        <div class="pivo-history__details-grid">
                            <div><span style="color:var(--muted-500)">${copy.user}:</span> ${d.user}</div>
                            <div><span style="color:var(--muted-500)">${copy.status}:</span> ${copy.noCommunication}</div>
                            <div><span style="color:var(--muted-500)">${copy.command}:</span> ${d.command}</div>
                            <div></div>
                        </div>
                        <h4 style="margin-top:12px;">${copy.positionAndMovement}</h4>
                        <div class="pivo-history__details-grid">
                            <div><span style="color:var(--muted-500)">${copy.lastTowerRadius}:</span> ${localizeUiText(d.radius, copy)}</div>
                            <div><span style="color:var(--muted-500)">${copy.sectorStart}:</span> ${localizeUiText(d.sectorStart, copy)}</div>
                            <div><span style="color:var(--muted-500)">${copy.sectorEnd}:</span> ${localizeUiText(d.sectorEnd, copy)}</div>
                            <div><span style="color:var(--muted-500)">${copy.positionZero}:</span> ${localizeUiText(d.positionZero, copy)}</div>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }

    function renderComandoDetails(d) {
        const fi = (label, value) => value != null
            ? `<div class="pivo-history__detail-item"><span class="pivo-history__detail-label">${label}:</span> <strong class="pivo-history__detail-value">${value}</strong></div>`
            : `<div></div>`;

        let leftCol, rightCol;

        // Atualização de Central: só o recebimento da notificação
        if (d.central) {
            return wrapHistoryDetails(`
                <div class="pivo-history__details-grid" style="grid-template-columns: 1fr;">
                    ${fi("Recebida em", d.recebidoEm)}
                </div>
            `);
        }

        if (d.cadeia) return renderChainDetails(d, fi);

        if (d.tipoAlerta != null) {
            // Layout Alerta
            leftCol = [
                fi("Recebido em", d.recebidoEm),
                fi(null, null),
                fi("Tipo de Alerta", d.tipoAlerta),
                fi("Pressão na Última Torre", d.pressaoUltimaTorre),
                fi(null, null),
                fi(null, null),
                fi("Horímetro Total", d.horimetroTotal),
                fi("Horímetro Molhado", d.horimetroMolhado),
            ];
        } else if (d.recebidoEm != null) {
            // Layout Atualização
            leftCol = [
                fi("Recebida em", d.recebidoEm),
                d.posicao ? fi("Posição", renderMapLink(d.posicao)) : fi(null, null),
                d.tipoIrrigacao != null ? fi("Tipo de Irrigação", d.tipoIrrigacao) : fi(null, null),
                fi("Previsão de Término", d.previsaoTermino),
                fi("Duração Prevista", d.duracaoPrevista),
                fi("Pressão na Última Torre", d.pressaoUltimaTorre),
                fi("Horímetro Total", d.horimetroTotal),
                fi("Horímetro Molhado", d.horimetroMolhado),
            ];
        } else {
            // Layout Comando
            leftCol = [
                fi("Enviado em", d.enviadoEm),
                fi("Enviado por", d.enviadoPor),
                d.tipoIrrigacao != null ? fi("Tipo de Irrigação", d.tipoIrrigacao) : fi(null, null),
                fi("Previsão de Término", d.previsaoTermino),
                fi("Duração Prevista", d.duracaoPrevista),
                fi("Pressão na Última Torre", d.pressaoUltimaTorre),
                fi("Horímetro Total", d.horimetroTotal),
                fi("Horímetro Molhado", d.horimetroMolhado),
            ];
        }

        rightCol = [
            fi("Irrigação Ativa", d.irrigacaoAtiva),
            fi("Modo de Início", d.modoInicio),
            fi("Direção", d.direcao),
            fi("Modo", d.modo),
            fi("Modo de Parada", d.modoParada),
            fi("Ângulo Atual", d.anguloAtual),
            fi("Ângulo de Parada", d.anguloParada),
            fi("Percentímetro/Lâmina", d.percentimetroLamina),
        ];

        // Comando de parada: só Enviado em/por + horímetros à esquerda e Ângulo Atual no topo à direita
        if (d.parada) {
            leftCol = [
                fi("Enviado em", d.enviadoEm),
                fi("Enviado por", d.enviadoPor),
                fi(null, null),
                fi(null, null),
                fi(null, null),
                fi(null, null),
                fi("Horímetro Total", d.horimetroTotal),
                fi("Horímetro Molhado", d.horimetroMolhado),
            ];
            rightCol = [
                fi("Ângulo Atual", d.anguloAtual),
                fi(null, null),
                fi(null, null),
                fi(null, null),
                fi(null, null),
                fi(null, null),
                fi(null, null),
                fi(null, null),
            ];
        }

        const rows = leftCol.map((l, i) => l + rightCol[i]).join("");

        return wrapHistoryDetails(`
            <div class="pivo-history__details-grid" style="grid-template-columns: 1fr 1fr; gap: 4px 32px;">
                ${rows}
            </div>
        `);
    }

    function wrapHistoryDetails(content) {
        return `
            <tr class="pivo-history__row-details" style="display: none;">
                <td colspan="4">
                    <div class="pivo-history__details">
                        ${content}
                    </div>
                </td>
            </tr>
        `;
    }

    // Comando com operações em cadeia: resumo do envio no topo e, abaixo, cada
    // operação na mesma grade de rótulo/valor dos demais cards.
    function renderChainDetails(d, fi) {
        const steps = d.cadeia || [];
        const summary = [
            fi("Enviado em", d.enviadoEm),
            fi("Irrigação Ativa", "Irrigação por Agendamento"),
            fi("Enviado por", d.enviadoPor),
            fi("Operações em Cadeia", steps.length),
            fi("Horímetro Total", d.horimetroTotal),
            fi("Ângulo Atual", d.anguloAtual),
            fi("Horímetro Molhado", d.horimetroMolhado),
            fi(null, null),
        ].join("");

        const stepsHtml = steps.map((step, i) => `
            <h4 style="margin: 16px 0 6px;"><span>Operação</span> ${i + 1}</h4>
            <div class="pivo-history__details-grid" style="grid-template-columns: 1fr 1fr; gap: 4px 32px;">
                ${fi("Modo", step.modo)}
                ${fi("Direção", step.direcao)}
                ${fi("Percentímetro/Lâmina", step.percentimetroLamina)}
                ${fi("Modo de Início", step.modoInicio)}
                ${fi("Modo de Parada", step.modoParada)}
                ${fi("Ângulo de Parada", step.anguloParada)}
            </div>
        `).join("");

        return wrapHistoryDetails(`
            <div class="pivo-history__details-grid" style="grid-template-columns: 1fr 1fr; gap: 4px 32px;">
                ${summary}
            </div>
            ${stepsHtml}
        `);
    }

    function localizeStatusLine(status) {
        if (!getDetailsCopy().english) return status;
        return String(status)
            // Frases completas de status/alerta
            .replace(/FALHA DE PRESSÃO NA ÚLTIMA TORRE/gi, "PRESSURE FAULT AT LAST TOWER")
            .replace(/PARADO VIA INTERNET/gi, "STOPPED VIA INTERNET")
            .replace(/ERRO DESCONHECIDO/gi, "UNKNOWN ERROR")
            .replace(/DESALINHADO/gi, "MISALIGNED")
            .replace(/SEM COMUNICAÇÃO/gi, "NO COMMUNICATION")
            .replace(/IRRIGAÇÃO POR AGENDAMENTO/gi, "SCHEDULED IRRIGATION")
            // Tokens
            .replace(/IRRIGAÇÃO SIMPLES/gi, "SIMPLE IRRIGATION")
            .replace(/IRRIGAÇÃO INTELIGENTE/gi, "SMART IRRIGATION")
            .replace(/OPERAÇÃO/gi, "OPERATION")
            .replace(/AVANÇO/gi, "FORWARD")
            .replace(/REVERSO/gi, "REVERSE")
            .replace(/MOLHADO/gi, "WET")
            .replace(/\bSECO\b/gi, "DRY")
            .replace(/\bPARADO\b/gi, "STOPPED");
    }

    function renderEventoRow(date, type, status, details = null, dotClass = null) {
        let statusHtml = localizeStatusLine(status);
        if (dotClass) {
            type = "Comando";
        }

        let typeDot = "";
        if (type === "Atualização" || type === "Confirmação") {
            typeDot = `<img src="./assets/img/svg/check-check.svg" style="width:16px;height:16px;vertical-align:middle;filter:invert(48%) sepia(79%) saturate(476%) hue-rotate(86deg) brightness(118%) contrast(119%);" alt="">`;
        } else if (type === "Comando") {
            typeDot = `<img src="./assets/img/svg/check.svg" style="width:16px;height:16px;vertical-align:middle;opacity:0.5;" alt="">`;
        } else if (type === "Alerta") {
            typeDot = "";
        } else if (EVENT_TYPE_DOT[type]) {
            typeDot = `<span class="status-dot ${EVENT_TYPE_DOT[type]}"></span>`;
        }

        const detailsRow = details ? renderComandoDetails(details) : "";
        const rowClass = type === "Alerta" ? " pivo-history__row--alerta" : "";

        return `
            <tr class="pivo-history__row${rowClass}">
                <td class="pivo-history__col-btn"><button class="expand-btn"><i class="fa-solid fa-plus"></i></button></td>
                <td>${date}</td>
                <td>${type} ${typeDot}</td>
                <td>${statusHtml}</td>
            </tr>
            ${detailsRow}
        `;
    }

    function renderOperacaoRow(start, end, lamina, modo, angStart, angEnd, voltas, hasDetails = false) {
        const detailsRow = `
            <tr class="pivo-history__row-details" style="display: none;">
                <td colspan="8">
                    <div class="pivo-history__details">
                        <h4 style="margin-bottom: 12px;">Descrição</h4>
                        <div class="pivo-history__details-grid" style="grid-template-columns: repeat(2, 1fr);">
                            <div><span style="color: var(--muted-500)">Horas (Ponta):</span> <strong style="color: var(--ink-900);">0.00</strong></div>
                            <div><span style="color: var(--muted-500)">Horas (Total):</span> <strong style="color: var(--ink-900);">${hasDetails ? '9.63' : '0.00'}</strong></div>
                        </div>
                    </div>
                </td>
            </tr>
        `;

        return `
            <tr class="pivo-history__row">
                <td class="pivo-history__col-btn"><button class="expand-btn"><i class="fa-solid fa-plus"></i></button></td>
                <td>${start}</td>
                <td>${end}</td>
                <td>${lamina}</td>
                <td>${modo}</td>
                <td>${angStart}</td>
                <td>${angEnd}</td>
                <td>${voltas}</td>
            </tr>
            ${detailsRow}
        `;
    }
    let pivotOperationCursor = 0;

    function renderOperationDetailItem(label, value) {
        return `
            <div class="pivo-history__detail-item">
                <span class="pivo-history__detail-label">${label}:</span>
                <strong class="pivo-history__detail-value">${value}</strong>
            </div>
        `;
    }

    function resolvePivotOperationDetails(detailsInput) {
        if (detailsInput === true) {
            pivotOperationCursor = 0;
        }

        if (detailsInput && typeof detailsInput === "object") {
            return detailsInput;
        }

        const details = pivotOperationDetails[pivotOperationCursor % pivotOperationDetails.length] || {};
        pivotOperationCursor += 1;
        return details;
    }

    function renderOperacaoRow(start, end, lamina, modo, angStart, angEnd, voltas, detailsInput = false) {
        const details = resolvePivotOperationDetails(detailsInput);
        const {
            tipo = "-",
            laminaMm = "-",
            velocidade = "-",
            tempoOperacao = "-",
            usuario = "-"
        } = details;

        const detailsRow = `
            <tr class="pivo-history__row-details" style="display: none;">
                <td colspan="8">
                    <div class="pivo-history__details">
                        <h4>Descrição</h4>
                        <div class="pivo-history__details-grid pivo-history__details-grid--operations">
                            ${renderOperationDetailItem("Tipo", tipo)}
                            ${renderOperationDetailItem("Lâmina (mm)", laminaMm)}
                            ${renderOperationDetailItem("Velocidade (%)", velocidade)}
                            ${renderOperationDetailItem("Tempo de Operação (h)", tempoOperacao)}
                            ${renderOperationDetailItem("Usuário", usuario)}
                        </div>
                    </div>
                </td>
            </tr>
        `;

        return `
            <tr class="pivo-history__row">
                <td class="pivo-history__col-btn"><button class="expand-btn"><i class="fa-solid fa-plus"></i></button></td>
                <td>${start}</td>
                <td>${end}</td>
                <td>${lamina}</td>
                <td>${modo}</td>
                <td>${angStart}</td>
                <td>${angEnd}</td>
                <td>${voltas}</td>
            </tr>
            ${detailsRow}
        `;
    }

    detailsView.mountPanel = mountPanel;
    detailsView.showMainView = showMainView;
    detailsView.scrollToSection = scrollToSection;
    detailsView.renderHeaderAndKPIs = renderHeaderAndKPIs;

    // IMPORTANTE: o index.js deve chamar destroyView() no close
    detailsView.destroyView = destroyView;

    // se você ainda chama destroyMinimap em algum lugar, mantenho apontando pro minimapa only
    detailsView.destroyMinimap = destroyMinimapOnly;

    detailsView.updateSelected = updateSelected;
})();
