// assets/js/pages/cosmofield/chart.js
// Gráfico "Soil Moisture" (linha de umidade do solo + barras de chuva/irrigação)
// desenhado em SVG puro, responsivo (viewBox escala com o container).
(function () {
    "use strict";

    // ---- PRNG determinístico (só usado para preencher o trecho fora da
    // janela em destaque, no mini-gráfico do navegador) ------------------
    function mulberry32(seed) {
        return function () {
            seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    // Datas no idioma ativo da plataforma, em vez de meses fixos em inglês.
    const chartLocale = () => window.IcI18n?.getLocale?.() || "pt-BR";

    function fmtDate(d) {
        return d
            .toLocaleDateString(chartLocale(), { day: "2-digit", month: "short" })
            .replace(/\sde\s/g, " ")
            .replace(/\.$/, "");
    }

    // Balão de baixo do gráfico: dia da semana, data e horário (fictício).
    function fmtDateTime(d) {
        return d.toLocaleDateString(chartLocale(), {
            weekday: "long", day: "2-digit", month: "short",
        }) + `, ${d.toLocaleTimeString(chartLocale())}`;
    }

    // ---- dataset mock -----------------------------------------------------
    // Dia 0 = 2 de março. Janela em destaque (mais fiel ao mock de origem):
    // 1 abr → 9 mai (dia 30 a 69).
    // opts: { seed, moisture, fieldCapacity, wiltingPoint, trigger,
    //         gaps: [{ from, to }], trailingMissing }
    // gaps: dias sem leitura (perda de dados). O gráfico quebra a linha.
    // Em cada gap, { empty: [dias] } lista os dias em que a sonda transmitiu
    // sem enviar dados: a tabela lista a data com as colunas vazias. Nos
    // demais dias do gap a sonda não transmitiu e a tabela não tem a linha.
    // { emptyFrom } é a forma curta: todos os dias a partir dele são vazios.
    // trailingMissing: dias recentes sem leitura. A linha segue fixa na
    // última leitura recebida, até hoje.
    // A série é simulada, mas ancorada nos parâmetros reais da sonda: a
    // última leitura tem de bater com a que o mapa e o card mostram.
    function buildDataset(opts = {}) {
        const seed = opts.seed ?? 42;
        const fc = Number(opts.fieldCapacity);
        const wp = Number(opts.wiltingPoint);
        const trigger = Number(opts.trigger);
        const hasSoil = Number.isFinite(fc) && Number.isFinite(wp) && fc > wp;
        const targetMoisture = Number(opts.moisture);

        // A série termina hoje: uma data de início fixa deixaria o gráfico
        // parado no passado conforme o tempo passa.
        const total = 100;
        const trailing = Math.max(0, Math.min(Math.floor(Number(opts.trailingMissing)) || 0, total - 3));
        const anchorIdx = total - 1 - trailing;
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - (total - 1));
        const rnd = mulberry32(seed);

        // âncoras de umidade do solo (%) dentro da janela Apr1..May9 (40 pontos)
        const anchors = [
            17, 19, 22, 24, 23.5, 21, 20, 21, 24, 27,
            26, 23, 21, 19.5, 19.7, 20, 22, 24, 25.5, 26,
            25, 23, 21, 19.7, 19.5, 20, 21, 22, 23, 24.3,
            23.5, 22, 20.5, 19, 17.5, 16, 14.5, 13.5, 12.5, 11.7
        ];

        const values = new Array(total);

        if (hasSoil) {
            // Manejo real: o solo seca até perto do trigger, a irrigação
            // repõe até a capacidade de campo, e o ciclo recomeça. Os
            // eventos de irrigação saem daí, não de uma lista fixa.
            const triggerPct = Number.isFinite(trigger) ? trigger : 50;
            const floor = wp + (fc - wp) * (triggerPct / 100);
            const irrigationDays = [];

            let level = fc - (fc - floor) * 0.25;
            for (let i = 0; i < total; i++) {
                // Evapotranspiração diária com variação leve.
                level -= 0.35 + rnd() * 0.45;
                if (level <= floor) {
                    // Irriga: volta perto da capacidade de campo.
                    level = fc - (fc - floor) * (0.05 + rnd() * 0.1);
                    irrigationDays.push(i);
                }
                values[i] = Math.max(wp, Math.min(fc + 0.5, level));
            }

            // Ancora o último ponto na leitura que o mapa mostra, e suaviza
            // os anteriores pra não criar um degrau artificial.
            if (Number.isFinite(targetMoisture)) {
                const delta = targetMoisture - values[anchorIdx];
                for (let i = 0; i <= anchorIdx; i++) {
                    const weight = i / Math.max(1, anchorIdx);
                    values[i] = Math.max(wp, Math.min(fc + 0.5, values[i] + delta * weight));
                }
            }

            opts._irrigationDays = irrigationDays;
        } else {
            // Sem parâmetros de solo: caminhada genérica (comportamento antigo).
            let v = 18;
            for (let i = 0; i < 30; i++) {
                v += (rnd() - 0.5) * 1.6;
                v = Math.max(14, Math.min(22, v));
                values[i] = v;
            }
            for (let i = 0; i < anchors.length; i++) values[30 + i] = anchors[i];
            v = anchors[anchors.length - 1];
            for (let i = 70; i < total; i++) {
                v += (rnd() - 0.5) * 1.4;
                v = Math.max(9, Math.min(16, v));
                values[i] = v;
            }
        }

        // Perda recente de dados: a série fica fixa na última leitura.
        for (let i = anchorIdx + 1; i < total; i++) values[i] = values[anchorIdx];

        // eventos de chuva/irrigação (offset a partir do dia 30 = 1 abr)
        const rain = new Map();

        // Chuva: eventos esparsos, determinísticos pela seed da sonda.
        const rainRnd = mulberry32(seed + 7);
        for (let i = 0; i < total; i++) {
            if (rainRnd() < 0.12) {
                rain.set(i, { mm: Math.round((3 + rainRnd() * 25) * 10) / 10, irrigation: false });
            }
        }

        // Sem fonte de chuva: nenhuma chuva automática (só lançamentos manuais).
        if (opts.noRain) rain.clear();

        // Irrigação: os dias em que o manejo repôs água. Barra proporcional
        // à lâmina necessária pra ir do trigger à capacidade de campo.
        const irrigation = new Map();
        if (hasSoil && Array.isArray(opts._irrigationDays)) {
            const bladeMm = ((fc - wp) * (1 - (Number.isFinite(trigger) ? trigger : 50) / 100) / 100) * 400;
            opts._irrigationDays.forEach((day) => {
                irrigation.set(day, { mm: Math.round(bladeMm * 10) / 10, irrigation: true });
            });
        }

        // Dias sem leitura: perda de dados no meio da série (gap) e perda
        // recente (held). Sem leitura também não há chuva nem irrigação
        // registradas pela sonda nesses dias.
        const gap = new Set();
        const emptyRows = new Set();
        (Array.isArray(opts.gaps) ? opts.gaps : []).forEach(({ from, to, emptyFrom, empty }) => {
            for (let i = Math.max(0, from); i < Math.min(to, total); i++) {
                gap.add(i);
                if (Number.isFinite(emptyFrom) && i >= emptyFrom) emptyRows.add(i);
                if (Array.isArray(empty) && empty.includes(i)) emptyRows.add(i);
            }
        });
        const held = new Set();
        for (let i = anchorIdx + 1; i < total; i++) held.add(i);
        gap.forEach((i) => { rain.delete(i); irrigation.delete(i); });
        held.forEach((i) => { rain.delete(i); irrigation.delete(i); });

        // Lançamentos manuais substituem o valor simulado do seu tipo, sem
        // afetar o outro — a mesma regra do calendário e da tabela.
        if (Array.isArray(opts.manualEvents)) {
            const keyOf = (date) => date.getFullYear() + "-" +
                String(date.getMonth() + 1).padStart(2, "0") + "-" +
                String(date.getDate()).padStart(2, "0");
            const dayIndex = new Map();
            for (let i = 0; i < total; i++) {
                const d = new Date();
                d.setDate(d.getDate() - (total - 1 - i));
                dayIndex.set(keyOf(d), i);
            }
            opts.manualEvents.forEach((item) => {
                const i = dayIndex.get(item.date);
                if (i === undefined) return;
                const mm = Number(item.mm) || 0;
                if (mm <= 0) return;
                if (item.type === "irrigation") irrigation.set(i, { mm, irrigation: true });
                else rain.set(i, { mm, irrigation: false });
            });
        }

        // horário fictício (determinístico) de cada leitura, só pra
        // preencher o balão de baixo (dia da semana, data e hora)
        const rndTime = mulberry32(99);
        const dates = new Array(total);
        const now = new Date();
        for (let i = 0; i < total; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            d.setHours(Math.floor(rndTime() * 24), Math.floor(rndTime() * 60), Math.floor(rndTime() * 60));
            // A última leitura é hoje: a hora sorteada não pode cair no futuro.
            if (d > now) d.setTime(now.getTime());
            dates[i] = d;
        }

        // Bateria: descarrega devagar e recupera com o sol. A última leitura
        // é ancorada no valor que os KPIs e o card mostram.
        const battery = new Array(total);
        const batteryEnd = Number.isFinite(opts.battery) ? opts.battery : 12.4;
        for (let i = 0; i < total; i++) {
            // A oscilação diária zera no último ponto, para a ponta da curva
            // ser exatamente o valor que os KPIs e o card mostram.
            const daily = Math.sin((i - (total - 1)) / 3) * 0.12;
            const drift = ((total - 1 - i) / total) * 0.5;
            battery[i] = Math.round((batteryEnd + drift + daily) * 100) / 100;
        }
        // Perda recente: a bateria também fica na última leitura recebida.
        for (let i = anchorIdx + 1; i < total; i++) battery[i] = battery[anchorIdx];

        return { dates, values, rain, irrigation, total, battery, gap, held, emptyRows };
    }

    // Recalculado por sonda: cada Cosmofield tem sua própria série. Sem
    // isso, todas mostravam a mesma curva.
    let DATA = buildDataset();
    // Linhas de referência do gráfico: acompanham os parâmetros da sonda.
    let FIELD_CAPACITY = 27;
    let WILTING_POINT = 13;
    let RANGE_LOW = 19.5;
    let RANGE_HIGH = 24.5;
    // Eixo Y esquerdo (umidade). "auto" ajusta à série e às linhas de
    // referência da sonda — com valor fixo, uma CC acima do teto ficava
    // fora do gráfico. "soil" enquadra só a faixa útil (PM → CC).
    let Y_MODE = "auto";
    let LEFT_MAX = 28;
    let LEFT_MIN = 0;

    // Limites definidos por equipamento nos Settings. Vazios = automático.
    let Y_MANUAL = { max: null, rightMax: null };

    function computeYScale() {
        const values = DATA.values.filter(Number.isFinite);
        const dataMax = values.length ? Math.max(...values) : 25;
        const dataMin = values.length ? Math.min(...values) : 0;

        // O mínimo é sempre 0 — umidade negativa não existe. Só o teto é
        // configurável, e apenas no modo manual.
        LEFT_MIN = 0;
        if (Y_MODE === "manual" && Y_MANUAL.max !== null && Y_MANUAL.max > 0) {
            LEFT_MAX = Y_MANUAL.max;
            return;
        }

        // Padrão: 0 até a capacidade de campo — a faixa que importa para o
        // manejo. Se a leitura passar da CC, o teto acompanha para o ponto
        // não sair do gráfico.
        if (Number.isFinite(FIELD_CAPACITY)) {
            LEFT_MIN = 0;
            LEFT_MAX = Math.max(FIELD_CAPACITY, dataMax) * 1.02;
            return;
        }

        // Sem CC cadastrada: cobre os dados com folga de 10%.
        const span = Math.max(1, dataMax - dataMin);
        LEFT_MIN = Math.max(0, dataMin - span * 0.1);
        LEFT_MAX = dataMax + span * 0.1;
    }
    // let: pode ser sobrescrito pelo limite definido no equipamento.
    // Chuva/irrigação: 0–50 mm por padrão. Pode ser sobrescrito por
    // equipamento nos Settings.
    const RIGHT_MAX_DEFAULT = 50;
    let RIGHT_MAX = RIGHT_MAX_DEFAULT;

    const NS = "http://www.w3.org/2000/svg";
    function svgEl(tag, attrs) {
        const el = document.createElementNS(NS, tag);
        for (const k in attrs) el.setAttribute(k, attrs[k]);
        return el;
    }

    function ZOOM_DAYS(key) {
        switch (key) {
            case "14d": return 14;
            case "1m": return 40; // janela de destaque original (Apr1-May9)
            case "3m": return 90;
            case "1y": return DATA.total;
            case "all": return DATA.total;
            default: return 40;
        }
    }

    // Balão do gráfico: criado uma vez por card e reposicionado no hover.
    function ensureTooltip(card) {
        let tip = card.querySelector(".cf-tip");
        if (!tip) {
            tip = document.createElement("div");
            tip.className = "cf-tip";
            card.appendChild(tip);
        }
        return tip;
    }

    // Séries visíveis no gráfico. Todas ligadas por padrão, menos a bateria
    // — que é informação de manutenção, não de manejo.
    const SERIES = {
        moisture: true, fc: true, wp: true,
        rain: true, irrigation: true, band: true, battery: true,
    };

    // Eixo auxiliar da bateria (V). Começa sempre em zero, para a altura da
    // linha representar a carga de forma proporcional; o topo é configurável
    // por equipamento.
    const BATTERY_MIN = 0;
    const BATTERY_MAX_DEFAULT = 14;
    let BATTERY_MAX = BATTERY_MAX_DEFAULT;

    // Trecho da série visível no gráfico (zoom/navegador). A tabela de dados
    // brutos usa o mesmo recorte.
    let VISIBLE_WINDOW = null;

    // Janela da safra (semeadura → colheita), quando a sonda tem as datas.
    let CROP_WINDOW = null;

    // Último gráfico montado: setRange (filtro de período da tela de
    // Detalhes) move a janela dele por fora do zoom/navegador.
    let ACTIVE_CHART = null;

    function initSoilMoistureChart(root, opts) {
        if (opts !== undefined) {
            const config = typeof opts === "number" ? { seed: opts } : (opts || {});
            DATA = buildDataset(config);

            // Limites de eixo definidos para este equipamento.
            const num = (value) => {
                const parsed = Number(String(value ?? "").replace(",", "."));
                return Number.isFinite(parsed) ? parsed : null;
            };
            Y_MANUAL = {
                max: num(config.yMax),
                rightMax: num(config.yRightMax),
            };
            RIGHT_MAX = (Y_MODE === "manual" && Y_MANUAL.rightMax !== null && Y_MANUAL.rightMax > 0)
                ? Y_MANUAL.rightMax
                : RIGHT_MAX_DEFAULT;

            const battMax = num(config.yBattMax);
            BATTERY_MAX = (battMax !== null && battMax > 0) ? battMax : BATTERY_MAX_DEFAULT;
            if (config.yMode) Y_MODE = config.yMode;

            // Converte as datas do cultivo em índices da série.
            CROP_WINDOW = null;
            const sowing = config.sowingDate ? new Date(config.sowingDate) : null;
            const harvest = config.harvestDate ? new Date(config.harvestDate) : null;
            if (sowing && !Number.isNaN(sowing.getTime())) {
                const findIndex = (target, fallback) => {
                    if (!target || Number.isNaN(target.getTime())) return fallback;
                    let best = fallback;
                    let bestDiff = Infinity;
                    DATA.dates.forEach((date, i) => {
                        const diff = Math.abs(date.getTime() - target.getTime());
                        if (diff < bestDiff) { bestDiff = diff; best = i; }
                    });
                    return best;
                };
                const from = findIndex(sowing, 0);
                const to = findIndex(harvest, DATA.total);
                if (to > from) CROP_WINDOW = { from, to: Math.min(DATA.total, to + 1) };
            }

            const fc = Number(config.fieldCapacity);
            const wp = Number(config.wiltingPoint);
            if (Number.isFinite(fc) && Number.isFinite(wp) && fc > wp) {
                FIELD_CAPACITY = fc;
                WILTING_POINT = wp;
                // Faixa de irrigação: do gatilho até o alvo. O alvo nunca passa
                // de 100% (capacidade de campo) nem fica abaixo do gatilho.
                const trigger = Number.isFinite(Number(config.trigger)) ? Number(config.trigger) : 50;
                const rawTarget = Number.isFinite(Number(config.target)) ? Number(config.target) : 100;
                const target = Math.max(trigger, Math.min(100, rawTarget));
                RANGE_LOW = wp + (fc - wp) * (trigger / 100);
                RANGE_HIGH = wp + (fc - wp) * (target / 100);
            }
        }
        const card = root.querySelector("#cfSoilChart");
        if (!card) return;

        const mainSvg = card.querySelector("#cfChartMainSvg");
        const navSvg = card.querySelector("#cfChartNavSvg");
        const navigator = card.querySelector("#cfChartNavigator");
        const navRange = card.querySelector("#cfNavRange");
        const maskL = card.querySelector("#cfNavMaskLeft");
        const maskR = card.querySelector("#cfNavMaskRight");
        const zoomBtns = Array.from(card.querySelectorAll(".cf-zoom-btn"));
        // Navegador e zoom são opcionais. A tela de Detalhes não tem os
        // botões de zoom: a janela vem do filtro de período (setRange) e o
        // navegador só ajusta o gráfico dentro dela.
        const hasNav = !!(navSvg && navigator && navRange && maskL && maskR);

        let winStart = DATA.total - 40;
        let winEnd = DATA.total; // exclusivo

        // Janela do filtro de período: limite do navegador. Sem filtro
        // (aba Geral antiga) é a série inteira. Com filtro (filterDriven), a
        // tabela, o calendário e a exportação seguem esta janela; o
        // navegador mexe só em winStart/winEnd.
        let baseStart = 0;
        let baseEnd = DATA.total; // exclusivo
        let filterDriven = false;

        function setWindow(start, end) {
            start = Math.max(0, Math.min(start, DATA.total - 1));
            end = Math.max(start + 2, Math.min(end, DATA.total));
            winStart = start;
            winEnd = end;
            // A tabela de dados brutos mostra o que está no gráfico: publica
            // a janela e avisa quem depende dela.
            VISIBLE_WINDOW = { from: winStart, to: winEnd };
            renderMain();
            renderNavRange();
            window.dispatchEvent(new CustomEvent("ic:cosmofield-window"));
        }

        // Filtro de período: define a janela base e abre o gráfico nela.
        function setBase(start, end) {
            start = Math.max(0, Math.min(start, DATA.total - 2));
            end = Math.max(start + 2, Math.min(end, DATA.total));
            baseStart = start;
            baseEnd = end;
            filterDriven = true;
            winStart = start;
            winEnd = end;
            VISIBLE_WINDOW = { from: baseStart, to: baseEnd };
            renderMain();
            renderNav();
            renderNavRange();
            window.dispatchEvent(new CustomEvent("ic:cosmofield-window"));
        }

        // Navegador: ajusta só o gráfico, dentro do período do filtro. Não
        // publica a janela, então o filtro e os demais blocos não mudam.
        function setView(start, end) {
            start = Math.max(baseStart, Math.min(start, baseEnd - 2));
            end = Math.max(start + 2, Math.min(end, baseEnd));
            winStart = start;
            winEnd = end;
            renderMain();
            renderNavRange();
        }

        const navSet = (start, end) => (filterDriven ? setView(start, end) : setWindow(start, end));

        function applyZoom(key) {
            if (key === "crop" && CROP_WINDOW) {
                // Safra: recorta exatamente o ciclo da cultura.
                setWindow(CROP_WINDOW.from, CROP_WINDOW.to);
            } else {
                const len = Math.min(ZOOM_DAYS(key), DATA.total);
                setWindow(DATA.total - len, DATA.total);
            }
            zoomBtns.forEach((b) => b.classList.toggle("is-active", b.dataset.zoom === key));
        }

        // ---- eixo principal ------------------------------------------------
        // O viewBox é recalculado a partir do tamanho real (em px) do
        // container a cada render, então o SVG nunca fica esticado —
        // 1 unidade de viewBox = 1px na tela, não importa a largura/altura.
        // A margem direita abre espaço para o eixo da bateria quando ela
        // está visível — sem isso o terceiro eixo cairia fora do viewBox.
        const PAD_L = 46, PAD_T = 16, PAD_B = 34;
        // let: recalculado a cada render, porque depende de a bateria estar
        // visível ou não.
        let PAD_R = SERIES.battery ? 92 : 46;
        let VB_W = 1000, VB_H = 400, plotW = VB_W - PAD_L - PAD_R, plotH = VB_H - PAD_T - PAD_B;

        function measureMain() {
            const w = Math.round(mainSvg.clientWidth) || VB_W;
            const h = Math.round(mainSvg.clientHeight) || VB_H;
            VB_W = Math.max(280, w);
            VB_H = Math.max(160, h);
            // Espaço do eixo auxiliar só quando a bateria está ligada.
            PAD_R = SERIES.battery ? 92 : 46;
            mainSvg.setAttribute("viewBox", `0 0 ${VB_W} ${VB_H}`);
            plotW = VB_W - PAD_L - PAD_R;
            plotH = VB_H - PAD_T - PAD_B;
        }

        function yLeft(val) { return PAD_T + (1 - (val - LEFT_MIN) / (LEFT_MAX - LEFT_MIN)) * plotH; }
        function yRight(val) { return PAD_T + (1 - val / RIGHT_MAX) * plotH; }

        function renderMain() {
            measureMain();
            const n = winEnd - winStart;
            const idx = (i) => winStart + i;
            const x = (i) => PAD_L + (n <= 1 ? 0 : (i / (n - 1)) * plotW);

            while (mainSvg.firstChild) mainSvg.removeChild(mainSvg.firstChild);

            // fundo
            mainSvg.appendChild(svgEl("rect", { x: 0, y: 0, width: VB_W, height: VB_H, fill: "transparent" }));

            // faixa "Irrigation Range"
            if (SERIES.band) {
                mainSvg.appendChild(svgEl("rect", {
                    x: PAD_L, y: yLeft(RANGE_HIGH), width: plotW, height: yLeft(RANGE_LOW) - yLeft(RANGE_HIGH),
                    fill: "#bfe6f5", opacity: 0.55
                }));
            }

            // Gridlines derivadas do domínio: com ticks fixos, mudar a escala
            // deixava os rótulos mentindo sobre a posição das linhas.
            const TICK_COUNT = 6;
            const leftTicks = Array.from({ length: TICK_COUNT + 1 }, (_, i) =>
                LEFT_MIN + ((LEFT_MAX - LEFT_MIN) * i) / TICK_COUNT);
            const rightTicks = Array.from({ length: TICK_COUNT + 1 }, (_, i) =>
                (RIGHT_MAX * i) / TICK_COUNT);
            leftTicks.forEach((t, i) => {
                const y = yLeft(t);
                mainSvg.appendChild(svgEl("line", { x1: PAD_L, y1: y, x2: PAD_L + plotW, y2: y, stroke: "#eef2f6", "stroke-width": 1 }));
                const lbl = svgEl("text", { x: PAD_L - 10, y: y + 4, "text-anchor": "end", "font-size": 11, fill: "#94a3b8" });
                lbl.textContent = Math.round(t * 10) / 10;
                mainSvg.appendChild(lbl);
                const rlbl = svgEl("text", { x: PAD_L + plotW + 10, y: y + 4, "text-anchor": "start", "font-size": 11, fill: "#94a3b8" });
                rlbl.textContent = Math.round(rightTicks[i]);
                mainSvg.appendChild(rlbl);
            });

            // eixo Y labels (vertical)
            const leftAxisLabel = svgEl("text", {
                x: 8, y: PAD_T + plotH / 2, "text-anchor": "middle", "font-size": 10, fill: "#94a3b8",
                transform: `rotate(-90 8 ${PAD_T + plotH / 2})`
            });
            leftAxisLabel.textContent = (window.IcI18n?.t?.("Umidade volumétrica do solo (%)") ?? "Umidade volumétrica do solo (%)");
            mainSvg.appendChild(leftAxisLabel);

            const rightAxisLabel = svgEl("text", {
                x: PAD_L + plotW + 40, y: PAD_T + plotH / 2, "text-anchor": "middle", "font-size": 10, fill: "#94a3b8",
                transform: `rotate(90 ${PAD_L + plotW + 40} ${PAD_T + plotH / 2})`
            });
            rightAxisLabel.textContent = (window.IcI18n?.t?.("Chuva / Irrigação (mm)") ?? "Chuva / Irrigação (mm)");
            mainSvg.appendChild(rightAxisLabel);

            // barras de chuva/irrigação
            const barW = Math.max(2, Math.min(9, plotW / n * 0.42));
            for (let i = 0; i < n; i++) {
                const rainEv = DATA.rain.get(idx(i));
                const irrEv = DATA.irrigation?.get(idx(i));

                const shown = [];
                if (rainEv && SERIES.rain) shown.push([rainEv, "#2e9e5b"]);
                if (irrEv && SERIES.irrigation) shown.push([irrEv, "#4aa3e0"]);
                if (!shown.length) continue;

                // Com os dois no mesmo dia, cada barra ocupa metade da
                // largura e elas se encostam no centro do dia.
                const w = shown.length > 1 ? barW / 2 : barW;
                shown.forEach(([ev, fill], k) => {
                    const bx = x(i) - barW / 2 + (shown.length > 1 ? k * w : 0);
                    const by = yRight(ev.mm);
                    mainSvg.appendChild(svgEl("rect", {
                        x: bx, y: by, width: w, height: (PAD_T + plotH) - by,
                        fill, "data-idx": idx(i)
                    }));
                });
            }

            // linhas tracejadas (Field Capacity / Wilting Point)
            [[FIELD_CAPACITY, "#2f7ed8", "fc"], [WILTING_POINT, "#e74c3c", "wp"]].forEach(([val, color, key]) => {
                if (!SERIES[key]) return;
                mainSvg.appendChild(svgEl("line", {
                    x1: PAD_L, y1: yLeft(val), x2: PAD_L + plotW, y2: yLeft(val),
                    stroke: color, "stroke-width": 1.5, "stroke-dasharray": "6 5"
                }));
            });

            // linha de umidade do solo
            // Dias sem leitura no meio da série quebram a linha; perda recente
            // segue fixa na última leitura (os valores já repetem a última).
            let d = "";
            let pen = false;
            for (let i = 0; i < n; i++) {
                if (DATA.gap?.has(idx(i))) { pen = false; continue; }
                const px = x(i), py = yLeft(DATA.values[idx(i)]);
                d += (pen ? "L" : "M") + px.toFixed(2) + " " + py.toFixed(2) + " ";
                pen = true;
            }
            if (SERIES.moisture) {
                mainSvg.appendChild(svgEl("path", { d, fill: "none", stroke: "#8bc34a", "stroke-width": 2 }));
            }

            // Série de bateria: opcional, escala própria (10–14 V mapeados
            // no eixo esquerdo) pra caber junto da umidade.
            if (SERIES.battery && Array.isArray(DATA.battery)) {
                const yBattery = (v) => PAD_T + (1 - (v - BATTERY_MIN) / (BATTERY_MAX - BATTERY_MIN)) * plotH;

                // Eixo auxiliar da bateria, à direita do eixo de chuva.
                const axisX = PAD_L + plotW + 52;
                mainSvg.appendChild(svgEl("line", {
                    x1: axisX, y1: PAD_T, x2: axisX, y2: PAD_T + plotH,
                    stroke: "#e9d5ff", "stroke-width": 1,
                }));

                const TICKS = 4;
                for (let k = 0; k <= TICKS; k++) {
                    const value = BATTERY_MIN + ((BATTERY_MAX - BATTERY_MIN) * k) / TICKS;
                    const ty = yBattery(value);
                    mainSvg.appendChild(svgEl("line", {
                        x1: axisX, y1: ty, x2: axisX + 4, y2: ty,
                        stroke: "#e9d5ff", "stroke-width": 1,
                    }));
                    const tick = svgEl("text", {
                        x: axisX + 8, y: ty + 4, "text-anchor": "start",
                        "font-size": 11, fill: "#a855f7",
                    });
                    tick.textContent = value.toFixed(2);
                    mainSvg.appendChild(tick);
                }

                const battLabel = svgEl("text", {
                    x: VB_W - 8, y: PAD_T + plotH / 2, "text-anchor": "middle",
                    "font-size": 10, fill: "#a855f7",
                    transform: `rotate(90 ${VB_W - 8} ${PAD_T + plotH / 2})`,
                });
                battLabel.textContent = window.IcI18n?.t?.("Tensão da bateria (V)") ?? "Tensão da bateria (V)";
                mainSvg.appendChild(battLabel);
                let db = "";
                let battPen = false;
                for (let i = 0; i < n; i++) {
                    const value = DATA.battery[idx(i)];
                    if (!Number.isFinite(value) || DATA.gap?.has(idx(i))) { battPen = false; continue; }
                    db += (battPen ? "L" : "M") + x(i).toFixed(2) + " " + yBattery(value).toFixed(2) + " ";
                    battPen = true;
                }
                if (db) {
                    mainSvg.appendChild(svgEl("path", {
                        d: db, fill: "none", stroke: "#a855f7",
                        "stroke-width": 1.6, "stroke-dasharray": "5 3",
                    }));
                }
            }

            // eixo X labels
            const step = Math.max(1, Math.round(n / 20));
            for (let i = 0; i < n; i += step) {
                const lbl = svgEl("text", {
                    x: x(i), y: PAD_T + plotH + 20, "text-anchor": "middle", "font-size": 10, fill: "#94a3b8"
                });
                lbl.textContent = fmtDate(DATA.dates[idx(i)]);
                mainSvg.appendChild(lbl);
            }

            // ---- tooltip do ponto -------------------------------------
            // Um balão por dia com o que está sendo exibido: umidade, água
            // disponível e o evento de chuva/irrigação daquela data.
            const marker = svgEl("circle", {
                r: 4, cx: 0, cy: 0, fill: "#8bc34a", stroke: "#fff",
                "stroke-width": 2, opacity: 0, "pointer-events": "none",
            });
            const guide = svgEl("line", {
                x1: 0, y1: PAD_T, x2: 0, y2: PAD_T + plotH,
                stroke: "#cbd5e1", "stroke-width": 1, "stroke-dasharray": "3 3",
                opacity: 0, "pointer-events": "none",
            });
            mainSvg.appendChild(guide);
            mainSvg.appendChild(marker);

            const tip = ensureTooltip(card);

            const hideTip = () => {
                tip.classList.remove("is-visible");
                marker.setAttribute("opacity", 0);
                guide.setAttribute("opacity", 0);
            };

            const hover = svgEl("rect", {
                x: PAD_L, y: PAD_T, width: plotW, height: plotH, fill: "transparent",
            });

            hover.addEventListener("mousemove", (event) => {
                const box = mainSvg.getBoundingClientRect();
                const px = ((event.clientX - box.left) / box.width) * VB_W;
                const i = Math.round(((px - PAD_L) / plotW) * (n - 1));
                if (i < 0 || i >= n) { hideTip(); return; }

                const di = idx(i);
                // Sem leitura neste dia: não há ponto para mostrar.
                if (DATA.gap?.has(di)) { hideTip(); return; }
                const value = DATA.values[di];
                const rainEv = DATA.rain.get(di);
                const irrEv = DATA.irrigation?.get(di);
                const cx = x(i);
                const cy = yLeft(value);

                marker.setAttribute("cx", cx);
                marker.setAttribute("cy", cy);
                marker.setAttribute("opacity", 1);
                guide.setAttribute("x1", cx);
                guide.setAttribute("x2", cx);
                guide.setAttribute("opacity", 1);

                const tc = (text) => window.IcI18n?.t?.(text) ?? text;
                const available = (Number.isFinite(FIELD_CAPACITY) && Number.isFinite(WILTING_POINT) && FIELD_CAPACITY > WILTING_POINT)
                    ? Math.max(0, Math.min(100, ((value - WILTING_POINT) / (FIELD_CAPACITY - WILTING_POINT)) * 100))
                    : null;

                const rows = [
                    '<div class="cf-tip__row"><i class="cf-tip__dot" style="background:#8bc34a"></i>' +
                    tc("Umidade do solo") + ": <strong>" + value.toFixed(2) + "%</strong></div>",
                ];
                if (available !== null) {
                    rows.push('<div class="cf-tip__row cf-tip__row--muted">' +
                        tc("Água disponível") + ": <strong>" + available.toFixed(2) + "%</strong></div>");
                }
                // A tensão descreve o ponto, então entra no balão mesmo com a
                // linha da bateria desligada na legenda.
                if (Number.isFinite(DATA.battery?.[di])) {
                    rows.push('<div class="cf-tip__row"><i class="cf-tip__dot" style="background:#a855f7"></i>' +
                        tc("Bateria") + ": <strong>" + DATA.battery[di].toFixed(2) + " V</strong></div>");
                }
                if (irrEv) {
                    rows.push('<div class="cf-tip__row"><i class="cf-tip__dot" style="background:#4aa3e0"></i>' +
                        tc("Irrigação") + ": <strong>" + irrEv.mm.toFixed(2) + " mm</strong></div>");
                }
                if (rainEv) {
                    rows.push('<div class="cf-tip__row"><i class="cf-tip__dot" style="background:#2e9e5b"></i>' +
                        tc("Chuva") + ": <strong>" + rainEv.mm.toFixed(2) + " mm</strong></div>");
                }

                tip.innerHTML = '<div class="cf-tip__date">' + fmtDateTime(DATA.dates[di]) + "</div>" + rows.join("");
                tip.classList.add("is-visible");

                // Posiciona em px reais do card, não em unidades do viewBox.
                const scaleX = box.width / VB_W;
                const scaleY = box.height / VB_H;
                const cardBox = card.getBoundingClientRect();
                const left = box.left - cardBox.left + cx * scaleX;
                const top = box.top - cardBox.top + cy * scaleY;
                tip.style.left = Math.round(left) + "px";
                tip.style.top = Math.round(top) + "px";
                // Vira para a esquerda quando encosta na borda direita.
                tip.classList.toggle("is-flipped", left + tip.offsetWidth + 24 > cardBox.width);
            });

            hover.addEventListener("mouseleave", hideTip);
            mainSvg.addEventListener("mouseleave", hideTip);
            mainSvg.appendChild(hover);

        }

        // ---- mini gráfico do navegador -------------------------------------
        function measureNav() {
            const w = Math.round(navSvg.clientWidth) || 1000;
            const h = Math.round(navSvg.clientHeight) || 46;
            const NAV_W = Math.max(200, w);
            const NAV_H = Math.max(20, h);
            navSvg.setAttribute("viewBox", `0 0 ${NAV_W} ${NAV_H}`);
            return { NAV_W, NAV_H };
        }

        function renderNav() {
            if (!hasNav) return;
            const { NAV_W, NAV_H } = measureNav();
            while (navSvg.firstChild) navSvg.removeChild(navSvg.firstChild);
            // Miniatura do período do filtro (a série inteira sem filtro).
            const slice = DATA.values.slice(baseStart, baseEnd);
            const n = slice.length;
            if (n < 2) return;
            const min = Math.min(...slice), max = Math.max(...slice);
            const span = max - min || 1;
            const padT = NAV_H * 0.1, padB = NAV_H * 0.12;
            const usableH = NAV_H - padT - padB;
            const x = (i) => (i / (n - 1)) * NAV_W;
            const y = (v) => padT + (1 - (v - min) / span) * usableH;

            let d = `M${x(0)} ${y(slice[0])} `;
            for (let i = 1; i < n; i++) d += `L${x(i)} ${y(slice[i])} `;
            let area = d + `L${NAV_W} ${NAV_H} L0 ${NAV_H} Z`;

            navSvg.appendChild(svgEl("path", { d: area, fill: "#e3f0d8", stroke: "none" }));
            navSvg.appendChild(svgEl("path", { d, fill: "none", stroke: "#8bc34a", "stroke-width": 1.4 }));
        }

        // ---- overlay de seleção (drag) --------------------------------------
        function renderNavRange() {
            if (!hasNav) return;
            const span = Math.max(1, baseEnd - baseStart);
            const pctL = ((winStart - baseStart) / span) * 100;
            const pctR = ((winEnd - baseStart) / span) * 100;
            navRange.style.left = `${pctL}%`;
            navRange.style.width = `${pctR - pctL}%`;
            maskL.style.width = `${pctL}%`;
            maskR.style.width = `${100 - pctR}%`;
        }

        function bindNavDrag() {
            if (!hasNav) return;
            let mode = null; // "move" | "l" | "r"
            let startX = 0, startWinStart = 0, startWinEnd = 0;

            function onDown(mode_) {
                return (e) => {
                    mode = mode_;
                    startX = e.clientX;
                    startWinStart = winStart;
                    startWinEnd = winEnd;
                    e.preventDefault();
                    e.stopPropagation();
                    document.addEventListener("mousemove", onMove);
                    document.addEventListener("mouseup", onUp);
                };
            }

            function onMove(e) {
                if (!mode) return;
                const rect = navigator.getBoundingClientRect();
                const deltaDays = ((e.clientX - startX) / rect.width) * (baseEnd - baseStart);
                if (mode === "move") {
                    const len = startWinEnd - startWinStart;
                    let s = startWinStart + deltaDays;
                    s = Math.max(baseStart, Math.min(s, baseEnd - len));
                    navSet(Math.round(s), Math.round(s + len));
                } else if (mode === "l") {
                    navSet(Math.round(startWinStart + deltaDays), winEnd);
                } else if (mode === "r") {
                    navSet(winStart, Math.round(startWinEnd + deltaDays));
                }
                zoomBtns.forEach((b) => b.classList.remove("is-active"));
            }

            function onUp() {
                mode = null;
                document.removeEventListener("mousemove", onMove);
                document.removeEventListener("mouseup", onUp);
            }

            navRange.addEventListener("mousedown", onDown("move"));
            navRange.querySelector('[data-handle="l"]').addEventListener("mousedown", onDown("l"));
            navRange.querySelector('[data-handle="r"]').addEventListener("mousedown", onDown("r"));
        }

        zoomBtns.forEach((btn) => btn.addEventListener("click", () => applyZoom(btn.dataset.zoom)));

        ACTIVE_CHART = { setWindow, setBase, zoomBtns };

        // Cada item da legenda liga/desliga a sua série.
        card.querySelectorAll("[data-cf-series]").forEach((btn) => {
            const key = btn.dataset.cfSeries;
            btn.classList.toggle("is-off", !SERIES[key]);
            btn.addEventListener("click", () => {
                SERIES[key] = !SERIES[key];
                btn.classList.toggle("is-off", !SERIES[key]);
                renderMain();
            });
        });

        // Abre mostrando todo o período: com a série ancorada no manejo real,
        // a leitura interessante é a evolução inteira, não a última janela.
        computeYScale();

        // Botão de safra só existe quando há datas cadastradas.
        const cropBtn = root.querySelector("#cfZoomCrop");
        if (cropBtn) cropBtn.hidden = !CROP_WINDOW;

        applyZoom("all");

        renderNav();
        renderNavRange();
        renderMain();
        bindNavDrag();

        // redesenha ao mudar o tamanho real do container (sidebar
        // colapsa/expande, resize da janela etc.) — o viewBox é recalculado
        // a partir do clientWidth/clientHeight a cada render, então o
        // traçado nunca fica esticado, não importa a proporção da tela.
        let rafPending = false;
        function scheduleRedraw() {
            if (rafPending) return;
            rafPending = true;
            requestAnimationFrame(() => {
                rafPending = false;
                renderMain();
                renderNav();
                renderNavRange();
            });
        }
        if (typeof ResizeObserver !== "undefined") {
            const ro = new ResizeObserver(scheduleRedraw);
            ro.observe(card.querySelector(".cf-chart-card__plot"));
            if (navigator) ro.observe(navigator);
        } else {
            window.addEventListener("resize", scheduleRedraw);
        }
        window.addEventListener("ic:layout-change", scheduleRedraw);
    }

    // Converte um intervalo de datas (dia inteiro nas duas pontas) na janela
    // de índices da série. Fora do que a série cobre, o setWindow encosta
    // na borda — quem chama lê de volta a janela real via getSeries.
    function setRange(start, end) {
        if (!ACTIVE_CHART || !DATA.dates.length) return;
        const dayOf = (value) => {
            const d = new Date(value);
            d.setHours(0, 0, 0, 0);
            return d.getTime();
        };
        const first = dayOf(DATA.dates[0]);
        let from = Math.round((dayOf(start) - first) / 86400000);
        let to = Math.round((dayOf(end) - first) / 86400000) + 1;
        if (!Number.isFinite(from) || !Number.isFinite(to)) return;
        // Pelo menos 2 dias dentro da série: um período todo no futuro (ou
        // todo antes dela) vira a ponta mais próxima, nunca um trecho vazio.
        from = Math.max(0, Math.min(from, DATA.total - 2));
        to = Math.max(from + 2, Math.min(to, DATA.total));
        ACTIVE_CHART.setBase(from, to);
        ACTIVE_CHART.zoomBtns.forEach((b) => b.classList.remove("is-active"));
    }

    window.IcCosmofieldChart = {
        init: initSoilMoistureChart,
        setRange,
        rebuild: (opts) => { DATA = buildDataset(opts); },
        // Série atual, para a tabela de dados brutos e a exportação.
        // Só o trecho visível: a tabela e a exportação refletem o gráfico.
        getSeries: (options = {}) => {
            const full = options.full === true;
            const from = full ? 0 : (VISIBLE_WINDOW?.from ?? 0);
            const to = full ? DATA.total : (VISIBLE_WINDOW?.to ?? DATA.total);
            const rain = new Map();
            const irrigation = new Map();
            // Dias sem leitura (perda de dados no meio da série e recente):
            // a tabela e a exportação não listam esses dias.
            const missing = new Set();
            DATA.gap?.forEach((key) => { if (key >= from && key < to) missing.add(key - from); });
            DATA.held?.forEach((key) => { if (key >= from && key < to) missing.add(key - from); });
            // Dias em que a sonda transmitiu sem enviar dados (linha vazia).
            const emptyRows = new Set();
            DATA.emptyRows?.forEach((key) => { if (key >= from && key < to) emptyRows.add(key - from); });
            DATA.irrigation?.forEach((value, key) => {
                if (key >= from && key < to) irrigation.set(key - from, value);
            });
            DATA.rain.forEach((value, key) => {
                if (key >= from && key < to) rain.set(key - from, value);
            });
            return {
                dates: DATA.dates.slice(from, to),
                values: DATA.values.slice(from, to),
                battery: (DATA.battery || []).slice(from, to),
                rain,
                irrigation,
                missing,
                emptyRows,
                total: to - from,
                fieldCapacity: FIELD_CAPACITY,
                wiltingPoint: WILTING_POINT,
            };
        },
    };
})();
