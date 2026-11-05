(function () {
    "use strict";

    async function mountGestaoView() {
        const slot = document.getElementById("pageSlot");
        if (!slot) return;
        const html = await fetch("./pages/gestao.html").then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); });
        slot.innerHTML = html;
        initGestaoUI(slot);
    }

    function getFarms() {
        const state = window.CreateFarm?.state;
        const fromState = Array.isArray(state?.farms) ? state.farms : [];
        if (fromState.length) return fromState;
        try {
            const stored = JSON.parse(localStorage.getItem("ic_farms") || "[]");
            if (Array.isArray(stored)) return stored;
        } catch (_) {}
        return [];
    }

    function normalizePluvKey(value) {
        return String(value || "")
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/^pluviometro\s+/, "")
            .replace(/\s+/g, "-");
    }

    function normalizePluvText(value) {
        return String(value || "").replace(/\s+/g, " ").trim();
    }

    function extractPluvDuration(text) {
        const raw = normalizePluvText(text);
        if (!raw) return "";
        const match = raw.match(/\bhá\s+(.+)$/i);
        if (match) return normalizePluvText(match[1]);
        const matchAlt = raw.match(/\bem\s+(.+)$/i);
        if (matchAlt) return normalizePluvText(matchAlt[1]);
        return "";
    }

    function extractPluvTime(text) {
        const raw = normalizePluvText(text);
        if (!raw) return "";
        const hhmm = raw.match(/\b(\d{1,2}:\d{2})\b/);
        if (hhmm) return hhmm[1];
        const hour = raw.match(/\b(\d{1,2})h(\d{2})?\b/i);
        if (hour) return hour[2] ? `${hour[1]}:${hour[2]}` : `${hour[1]}h`;
        return "";
    }

    function extractPluvSince(text) {
        const raw = normalizePluvText(text);
        if (!raw) return "";
        const match = raw.match(/\bdesde\s+(.+)$/i);
        if (match) return `desde ${normalizePluvText(match[1])}`;
        const time = extractPluvTime(raw);
        return time ? `desde ${time}` : "";
    }

    function buildPluvContextText(pluvio) {
        if (!pluvio) return "Sem chuva recente";

        if (pluvio.semComunicacao) {
            const offlineFor = extractPluvDuration(pluvio.updated) || extractPluvDuration(pluvio.statusMeta);
            return offlineFor ? `Sem comunicação há ${offlineFor}` : "Sem comunicação";
        }

        if (pluvio.status === "rain") {
            const intensity = normalizePluvText(pluvio.intensidade || "Chuva").toLowerCase();
            const intensityLabel = intensity.includes("chuva") ? intensity.replace(/\bchuva\b/i, "Chuva") : `Chuva ${intensity}`;
            const since = extractPluvSince(pluvio.intensidadeMeta) || extractPluvSince(pluvio.statusMeta);
            if (since) return `${intensityLabel} ${since}`;
            const duration = extractPluvDuration(pluvio.statusMeta);
            return duration ? `${intensityLabel} desde ${duration}` : intensityLabel;
        }

        const lastTime = extractPluvTime(pluvio.statusMeta) || extractPluvTime(pluvio.intensidadeMeta);
        if (lastTime) return `Última chuva às ${lastTime}`;
        const lastDuration = extractPluvDuration(pluvio.statusMeta);
        if (lastDuration) return `Última chuva há ${lastDuration}`;
        return "Sem chuva recente";
    }

    function buildPluvDurationText(pluvio) {
        const source = pluvio?.status === "rain" ? pluvio?.statusMeta : (pluvio?.statusMeta || pluvio?.updated);
        const duration = extractPluvDuration(source);
        return duration ? `em ${duration}` : "--";
    }

    function getGestaoPluvRuntime(card, index) {
        const runtimeList = Array.isArray(window.Plv?.data?.PLUVIOS) ? window.Plv.data.PLUVIOS : [];
        const cardId = normalizePluvKey(card?.getAttribute("data-id"));
        const cardName = normalizePluvKey(card?.querySelector(".pluv-card__name")?.textContent);

        const runtimeMatch = runtimeList.find((item) => {
            const keys = [
                item?.id,
                item?.sourceEquipId,
                item?.nome,
                item?.name,
                item?.data?.nome,
                item?.__mockProfileKey,
            ].map(normalizePluvKey).filter(Boolean);
            return keys.includes(cardId) || keys.includes(cardName);
        });

        return runtimeMatch || window.Plv?.data?.getSharedPluvioProfile?.({ id: cardId, name: cardName }, index) || null;
    }

    function syncGestaoPluvCards(root) {
        const cards = root.querySelectorAll("[data-pluv-card]");
        if (!cards.length) return;
        const cardEntries = [];

        cards.forEach((card, index) => {
            const pluvio = getGestaoPluvRuntime(card, index);
            if (!pluvio) return;
            cardEntries.push({ card, index, pluvio });

            const mm = Number.isFinite(Number(pluvio.mm)) ? Number(pluvio.mm).toFixed(1) : "--";
            const battery = Math.max(0, Number(pluvio.battery) || 0);
            const isOnline = !pluvio.semComunicacao;
            const pillEl = card.querySelector(".pluv-card__pill");
            const batteryEl = card.querySelector(".pluv-card__battery");
            const signalEl = card.querySelector(".pluv-card__signal");
            const chargeEl = batteryEl?.querySelector(".pluv-card__battery-charge");
            const talhaoEl = card.querySelector(".pluv-card__context-line:first-of-type span");
            const impactaEl = card.querySelector(".pluv-card__context-line:last-of-type span");

            const setText = (selector, value) => {
                const el = card.querySelector(selector);
                if (el) el.textContent = value;
            };

            setText(".pluv-card__name", pluvio.nome || "Pluviômetro");
            setText(".pluv-card__rain-context", buildPluvContextText(pluvio));
            setText(".pluv-card__mm-val", mm);
            setText(".pluv-card__duration", buildPluvDurationText(pluvio));
            setText(".pluv-card__updated span", pluvio.updated || "Sem leituras");

            if (talhaoEl) talhaoEl.textContent = `Talhão: ${pluvio.sub || "Chuva - Milho"}`;
            if (impactaEl) impactaEl.textContent = `Impacta: ${(pluvio.pivos || []).join(", ") || "—"}`;

            card.classList.toggle("pluv-card--rain", pluvio.status === "rain");
            card.classList.toggle("pluv-card--alert", !!pluvio.semComunicacao);
            card.classList.toggle("pluv-card--dry", pluvio.status === "dry");

            if (pillEl) {
                pillEl.className = "pluv-card__pill";
                if (pluvio.status === "rain") {
                    pillEl.textContent = "Chovendo agora";
                } else if (pluvio.semComunicacao) {
                    pillEl.classList.add("pluv-card__pill--alert");
                    pillEl.textContent = "OFFLINE";
                } else {
                    pillEl.classList.add("pluv-card__pill--ghost");
                    pillEl.innerHTML = "&nbsp;";
                }
            }

            if (signalEl) {
                signalEl.classList.toggle("is-on", isOnline);
                signalEl.classList.toggle("is-off", !isOnline);
                signalEl.title = isOnline ? (pluvio.net || "4G") : "Sem comunicação";
            }

            if (batteryEl) {
                batteryEl.classList.remove("is-high", "is-mid", "is-low", "is-charging");
                batteryEl.classList.add(battery >= 60 ? "is-high" : battery >= 30 ? "is-mid" : "is-low");
                batteryEl.style.setProperty("--battery-level", `${battery}%`);
                batteryEl.title = `Bateria ${battery}%`;
                batteryEl.setAttribute("aria-label", `Bateria ${battery}%`);
            }

            if (chargeEl) chargeEl.remove();
        });

        const groups = new Map();
        cardEntries.forEach((entry) => {
            const parent = entry.card.parentElement;
            if (!parent) return;
            if (!groups.has(parent)) groups.set(parent, []);
            groups.get(parent).push(entry);
        });

        groups.forEach((entries, parent) => {
            entries
                .sort((a, b) => {
                    const priorityA = a.pluvio?.semComunicacao ? 0 : a.pluvio?.status === "rain" ? 1 : 2;
                    const priorityB = b.pluvio?.semComunicacao ? 0 : b.pluvio?.status === "rain" ? 1 : 2;
                    if (priorityA !== priorityB) return priorityA - priorityB;

                    const nameA = normalizePluvText(a.pluvio?.nome || a.card.querySelector(".pluv-card__name")?.textContent || "").toLowerCase();
                    const nameB = normalizePluvText(b.pluvio?.nome || b.card.querySelector(".pluv-card__name")?.textContent || "").toLowerCase();
                    const byName = nameA.localeCompare(nameB, "pt-BR");
                    if (byName !== 0) return byName;
                    return a.index - b.index;
                })
                .forEach(({ card }) => parent.appendChild(card));
        });
    }

    function initGestaoUI(root) {
        const farms = getFarms();
        const activeId =
            sessionStorage.getItem("ic_active_farm") ||
            sessionStorage.getItem("ic_active_farm_id");
        const defaultFarm =
            farms.find((f) => f.id === activeId) || farms[0];

        const selectedFarms = new Set();
        if (defaultFarm) selectedFarms.add(defaultFarm.id);

        const multi       = root.querySelector("[data-gestao-farm-multi]");
        const chipsHost   = root.querySelector("[data-gestao-farm-chips]");
        const searchInput = root.querySelector("[data-gestao-farm-search]");
        const dropdown    = root.querySelector("[data-gestao-farm-dropdown]");
        const listHost    = root.querySelector("[data-gestao-farm-list]");

        const sortSelect   = root.querySelector("[data-gestao-sort-select]");
        const sortBtn      = root.querySelector("[data-gestao-sort-btn]");
        const sortText     = root.querySelector("[data-gestao-sort-text]");
        const sortDropdown = root.querySelector("[data-gestao-sort-dropdown]");
        const sortList     = root.querySelector("[data-gestao-sort-list]");

        const SORT_OPTIONS = [
            { value: "alpha",         label: "Ordem alfabética" },
            { value: "alpha-rev",     label: "Ordem alfabética (Reverso)" },
            { value: "comm-new",      label: "Última comunicação mais recente" },
            { value: "comm-old",      label: "Última comunicação mais antiga" },
            { value: "progress-desc", label: "Maior progresso de irrigação" },
            { value: "progress-asc",  label: "Menor progresso de irrigação" },
            { value: "status-pos",    label: "Status positivos primeiro" },
            { value: "status-neg",    label: "Status negativos primeiro" },
        ];

        let activeSort = "status-pos";

        const typeSelect   = root.querySelector("[data-gestao-type-select]");
        const typeBtn      = root.querySelector("[data-gestao-type-btn]");
        const typeText     = root.querySelector("[data-gestao-type-text]");
        const typeDropdown = root.querySelector("[data-gestao-type-dropdown]");
        const typeList     = root.querySelector("[data-gestao-type-list]");

        const TYPE_OPTIONS = [
            { value: "pivos",        label: "Pivôs"            },
            { value: "bombas",       label: "Bombas"           },
            { value: "pluviometria", label: "Pluviometria"     },
            { value: "nivel",        label: "Medidor de Nível" },
        ];

        const activeTypes = new Set(["pivos", "bombas", "pluviometria", "nivel"]);

        const timelineContainer  = document.getElementById("gestaoTimelineContainer");
        const alertsContainer    = document.getElementById("gestaoAlertsContainer");
        const scheduledContainer = document.getElementById("gestaoScheduledContainer");

        // ─── helpers ──────────────────────────────────────────────────────────

        function getFarmName(f) {
            return f.name || "Fazenda";
        }

        function getEquipName(eq) {
            return eq.name || eq.id || "Equipamento";
        }

        function getLevelPercent(card, valueEl) {
            const fromCssVar = parseFloat(
                String(card.style.getPropertyValue("--level") || "").replace(",", ".")
            );
            if (Number.isFinite(fromCssVar)) return fromCssVar;

            const fromText = parseFloat(
                String(valueEl?.textContent || "").replace(",", ".")
            );
            if (Number.isFinite(fromText)) return fromText;

            return NaN;
        }

        function syncLevelGaugeBadges() {
            const levelCards = root.querySelectorAll(".gestao-level-card");
            levelCards.forEach((card) => {
                const valueEl = card.querySelector(".gestao-level-gauge__value");
                const fillEl = card.querySelector(".gestao-level-gauge__fill");
                if (!valueEl || !fillEl) return;

                const rawLevel = getLevelPercent(card, valueEl);
                if (!Number.isFinite(rawLevel)) return;
                const level = Math.max(0, Math.min(100, rawLevel));

                let badgeColor = "#22c55e";
                let badgeText = "#ffffff";
                if (level < 35) {
                    badgeColor = "#ef4444";
                } else if (level < 70) {
                    badgeColor = "#f59e0b";
                    badgeText = "#111827";
                }

                card.style.setProperty("--level", `${level}%`);
                card.style.setProperty("--level-badge-color", badgeColor);
                card.style.setProperty("--level-badge-text", badgeText);
            });
        }

        // ─── chips ────────────────────────────────────────────────────────────

        function renderChips() {
            if (!chipsHost) return;
            chipsHost.innerHTML = "";

            const selectedItems = farms.filter((f) => selectedFarms.has(f.id));
            const visible    = selectedItems.slice(0, 3);
            const extraCount = selectedItems.length - visible.length;

            visible.forEach((f) => {
                const chip   = document.createElement("span");
                chip.className = "gestao-op__chip";
                chip.textContent = getFarmName(f);

                const remove = document.createElement("button");
                remove.type      = "button";
                remove.innerHTML = "&times;";
                remove.addEventListener("click", (e) => {
                    e.stopPropagation();
                    selectedFarms.delete(f.id);
                    renderAll();
                });
                chip.appendChild(remove);
                chipsHost.appendChild(chip);
            });

            if (extraCount > 0) {
                const chip = document.createElement("span");
                chip.className   = "gestao-op__chip gestao-op__chip--count";
                chip.textContent = `+ ${extraCount}`;
                chipsHost.appendChild(chip);
            }

            if (searchInput) {
                searchInput.placeholder =
                    selectedItems.length > 0 ? "" : "Selecione as fazendas";
            }
        }

        // ─── dropdown list ─────────────────────────────────────────────────────

        function renderList(filterStr = "") {
            if (!listHost) return;
            listHost.innerHTML = "";

            const term     = filterStr.trim().toLowerCase();
            const filtered = farms.filter((f) =>
                getFarmName(f).toLowerCase().includes(term)
            );

            filtered.forEach((f) => {
                const item = document.createElement("div");
                item.className = "gestao-op__item";
                if (selectedFarms.has(f.id)) item.classList.add("is-selected");
                item.textContent = getFarmName(f);

                const check   = document.createElement("span");
                check.className = "check";
                check.innerHTML = '<i class="fa-solid fa-check"></i>';
                item.appendChild(check);

                item.addEventListener("click", () => {
                    if (selectedFarms.has(f.id)) selectedFarms.delete(f.id);
                    else selectedFarms.add(f.id);
                    renderAll();
                });

                listHost.appendChild(item);
            });
        }

        // ─── mock active operations (por índice de pivô) ──────────────────────

        const MOCK_OPS = [
            {
                statusText: "IRRIGANDO",      color: "blue",
                irrigacao: "Irrigação Simples", direcao: "Avanço",   modo: "Molhado",
                percent: "47%", lamina: "9,95 mm", pressao: null,   canhaoFinal: true,
                anguloAtual: "88,50°", anguloParada: "358°",
                termino: "12:54", duracao: "03h 00min",
            },
            {
                statusText: "PRESSURIZAÇÃO",  color: "warn",
                irrigacao: "Irrigação Simples", direcao: "Avanço",   modo: "Molhado",
                percent: "47%", lamina: "9,95 mm", pressao: "1,1 bar",
                anguloAtual: "88,50°", anguloParada: "358°",
                termino: "--", duracao: "--",
            },
            {
                statusText: "IRRIGANDO",      color: "blue",
                irrigacao: "Irrig. Inteligente", direcao: "Reverso", modo: "Seco",
                percent: "100%", lamina: "--", pressao: null,        canhaoFinal: false,
                anguloAtual: "45,20°", anguloParada: "180°",
                termino: "14:30", duracao: "05h 00min",
            },
            {
                statusText: "AGUARDANDO",     color: "warn",
                irrigacao: "Irrigação Simples", direcao: "Avanço",   modo: "Molhado",
                percent: "47%", lamina: "9,95 mm", pressao: "0,8 bar",
                anguloAtual: "12,80°", anguloParada: "358°",
                termino: "--", duracao: "--",
            },
            {
                statusText: "MOVENDO A SECO", color: "brown",
                irrigacao: "Sem irrigação",    direcao: "Avanço",    modo: "Seco",
                percent: "62%", lamina: "--",  pressao: null,
                anguloAtual: "156,30°", anguloParada: "350°",
                termino: "--", duracao: "--",
            },
            {
                statusText: "FERTIRRIGANDO",  color: "sky",
                irrigacao: "Fertirrigação",    direcao: "Avanço",    modo: "Molhado",
                percent: "78%", lamina: "12,40 mm", pressao: "0,9 bar",
                anguloAtual: "210,50°", anguloParada: "358°",
                termino: "16:20", duracao: "04h 15min",
            },
            {
                statusText: "ALERTA",         color: "red",         isAlert: true,
                irrigacao: "Irrigação Simples", direcao: "Avanço",  modo: "Molhado",
                percent: "33%", lamina: "5,20 mm", pressao: null,
                anguloAtual: "67,80°", anguloParada: "358°",
                termino: "--", duracao: "--",
            },
        ];

        const MOCK_PUMP_OPS = [
            {
                pressaoSaida: "4,2 bar", vazao: "85 m³/h",
                corrente: "32 A",        tensao: "380 V",
                horasHoje: "6h 20min",   horasTotal: "1.842 h",
            },
            {
                pressaoSaida: "3,8 bar", vazao: "72 m³/h",
                corrente: "28 A",        tensao: "380 V",
                horasHoje: "4h 05min",   horasTotal: "2.317 h",
            },
        ];

        // ─── buildEquipCard ────────────────────────────────────────────────────

        function buildEquipCard(eq) {
            const nome   = getEquipName(eq);
            const isPivo = eq.category === "pivos";
            const op     = eq._activeOp || null;   // active operation (pivôs only)

            // ── badge / icon color
            let colorLabel, statusText, badgeClass, badgeStyle;

            if (!isPivo) {
                colorLabel = "cyan";
                statusText = "ONLINE";
                badgeClass = "gestao-op__badge--success";
                badgeStyle = 'style="background-color:#10b981;color:#fff;"';
            } else if (op) {
                colorLabel = op.color;
                statusText = op.statusText;
                if ((op.statusText === "IRRIGANDO" || op.statusText === "FERTIRRIGANDO") && op.percent) {
                    statusText = `${op.statusText} – ${op.percent}`;
                }
                if (op.isAlert || op.statusText === "ALERTA") {
                    badgeClass = "gestao-op__badge--danger";
                    badgeStyle = "";
                } else if (op.statusText === "IRRIGANDO") {
                    badgeClass = "gestao-op__badge--info";
                    badgeStyle = "";
                } else if (op.statusText === "FERTIRRIGANDO") {
                    badgeClass = "gestao-op__badge--ferti";
                    badgeStyle = "";
                } else if (op.statusText === "MOVENDO A SECO") {
                    badgeClass = "gestao-op__badge--brown";
                    badgeStyle = "";
                } else {
                    // PRESSURIZAÇÃO, AGUARDANDO, etc.
                    badgeClass = "gestao-op__badge--warn";
                    badgeStyle = "";
                }
            } else {
                colorLabel = "yellow";
                statusText = "PARADO";
                badgeClass = "gestao-op__badge--warning";
                badgeStyle = "";
            }

            const iconHtml = isPivo
                ? `<div class="gestao-op__card-icon">
                       <div class="gestao-op__timeline-icon is-pivot gestao-op__timeline-icon--${colorLabel}"></div>
                   </div>`
                : `<div class="gestao-op__card-icon">
                       <img src="./assets/img/svg/pump.svg" alt="Bomba" style="width:28px;height:28px;">
                   </div>`;

            const startLabel = isPivo ? "Iniciar Pivô" : "Ligar Bomba";
            const stopLabel  = isPivo ? "Parar Pivô"   : "Desligar Bomba";

            // main col — 270px for pivots with op and for all bombas
            const mainColStyle = ((isPivo && op) || !isPivo) ? ' style="flex:0 0 270px;width:270px;"' : "";

            const mainColHtml = `
                <div class="gestao-op__card-header">
                    ${iconHtml}
                    <div class="gestao-op__card-info">
                        <div class="gestao-op__card-title-row">
                            <div class="gestao-op__title-group">
                                <div class="gestao-op__title-main">
                                    <span class="gestao-op__card-title">${nome}</span>
                                    <span class="gestao-op__badge ${badgeClass}" ${badgeStyle}>${statusText}</span>
                                </div>
                                <div class="gestao-op__card-subtitle">
                                    <strong>${eq._farmName}</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="gestao-op__card-actions">
                    <button class="btn btn--success js-start-equip" type="button">
                        <i class="fa-solid fa-play"></i> ${startLabel}
                    </button>
                    <button class="btn btn--stop js-stop-equip" type="button">
                        <i class="fa-regular fa-square"></i> ${stopLabel}
                    </button>
                </div>
            `;

            // ── bomba → painel direito com dados da bomba
            if (!isPivo) {
                if (!op) {
                    return `
                        <div class="gestao-op__card-main-col" style="flex:0 0 270px;width:270px;">${mainColHtml}</div>
                        <div class="gestao-op__card-vsep gestao-op__card-vsep--hidden"></div>
                        <div class="gestao-op__card-details"></div>
                        <div class="gestao-op__card-vsep gestao-op__card-vsep--hidden"></div>
                        <div class="gestao-op__card-end">
                            <button class="gestao-op__details-link gestao-op__details-link--card" type="button">Detalhes</button>
                        </div>
                    `;
                }
                return `
                    <div class="gestao-op__card-main-col"${mainColStyle}>${mainColHtml}</div>
                    <div class="gestao-op__card-vsep"></div>
                    <div class="gestao-op__card-details gestao-op__card-details--3col">
                        <div class="gestao-op__card-ditem">
                            <span class="gestao-op__card-dlabel">Pressão de Saída</span>
                            <strong class="gestao-op__card-dval">${op.pressaoSaida}</strong>
                        </div>
                        <div class="gestao-op__card-ditem">
                            <span class="gestao-op__card-dlabel">Vazão</span>
                            <strong class="gestao-op__card-dval">${op.vazao}</strong>
                        </div>
                        <div class="gestao-op__card-ditem">
                            <span class="gestao-op__card-dlabel">Corrente Motor</span>
                            <strong class="gestao-op__card-dval">${op.corrente}</strong>
                        </div>
                        <div class="gestao-op__card-ditem">
                            <span class="gestao-op__card-dlabel">Tensão</span>
                            <strong class="gestao-op__card-dval">${op.tensao}</strong>
                        </div>
                        <div class="gestao-op__card-ditem">
                            <span class="gestao-op__card-dlabel">Horas Hoje</span>
                            <strong class="gestao-op__card-dval">${op.horasHoje}</strong>
                        </div>
                        <div class="gestao-op__card-ditem">
                            <span class="gestao-op__card-dlabel">Total de Horas</span>
                            <strong class="gestao-op__card-dval">${op.horasTotal}</strong>
                        </div>
                    </div>
                    <div class="gestao-op__card-vsep gestao-op__card-vsep--hidden"></div>
                    <div class="gestao-op__card-end">
                        <button class="gestao-op__details-link gestao-op__details-link--card" type="button">Detalhes</button>
                    </div>
                `;
            }

            // ── pivô parado → painel direito só com botão Detalhes
            if (!op) {
                return `
                    <div class="gestao-op__card-main-col" style="flex:0 0 270px;width:270px;">${mainColHtml}</div>
                    <div class="gestao-op__card-vsep"></div>
                    <div class="gestao-op__card-details"></div>
                    <div class="gestao-op__card-vsep gestao-op__card-vsep--hidden"></div>
                    <div class="gestao-op__card-end">
                        <button class="gestao-op__details-link gestao-op__details-link--card" type="button">Detalhes</button>
                    </div>
                `;
            }

            // ── com operação ativa → painel direito com dados do comando
            const isFullOp = op.statusText === "IRRIGANDO" || op.statusText === "FERTIRRIGANDO";
            const percentLamina = op.lamina && op.lamina !== "--"
                ? `${op.percent} – ${op.lamina}`
                : op.percent;

            let detailsInner;
            if (isFullOp) {
                // 3 colunas — 9 campos
                let pressaoItem;
                if (op.pressao) {
                    pressaoItem = `<div class="gestao-op__card-ditem">
                           <span class="gestao-op__card-dlabel">Pressão Última Torre</span>
                           <strong class="gestao-op__card-dval">${op.pressao}</strong>
                       </div>`;
                } else if (op.canhaoFinal) {
                    pressaoItem = `<div class="gestao-op__card-ditem">
                           <span class="gestao-op__card-dlabel">Canhão Final</span>
                           <strong class="gestao-op__card-dval" style="color:#10b981;">Ativo</strong>
                       </div>`;
                } else {
                    pressaoItem = `<div class="gestao-op__card-ditem"></div>`;
                }

                detailsInner = `
                    <div class="gestao-op__card-details gestao-op__card-details--3col">
                        <div class="gestao-op__card-ditem">
                            <span class="gestao-op__card-dlabel">Irrigação Ativa</span>
                            <strong class="gestao-op__card-dval">${op.irrigacao}</strong>
                        </div>
                        <div class="gestao-op__card-ditem">
                            <span class="gestao-op__card-dlabel">Direção</span>
                            <strong class="gestao-op__card-dval">${op.direcao}</strong>
                        </div>
                        <div class="gestao-op__card-ditem">
                            <span class="gestao-op__card-dlabel">Modo</span>
                            <strong class="gestao-op__card-dval">${op.modo}</strong>
                        </div>
                        <div class="gestao-op__card-ditem">
                            <span class="gestao-op__card-dlabel">Percentímetro / Lâmina</span>
                            <strong class="gestao-op__card-dval">${percentLamina}</strong>
                        </div>
                        ${pressaoItem}
                        <div class="gestao-op__card-ditem">
                            <span class="gestao-op__card-dlabel">Ângulo Atual</span>
                            <strong class="gestao-op__card-dval">${op.anguloAtual}</strong>
                        </div>
                        <div class="gestao-op__card-ditem">
                            <span class="gestao-op__card-dlabel">Ângulo de Parada</span>
                            <strong class="gestao-op__card-dval">${op.anguloParada}</strong>
                        </div>
                        <div class="gestao-op__card-ditem">
                            <span class="gestao-op__card-dlabel">Término Previsto</span>
                            <strong class="gestao-op__card-dval">${op.termino}</strong>
                        </div>
                        <div class="gestao-op__card-ditem">
                            <span class="gestao-op__card-dlabel">Duração Prevista</span>
                            <strong class="gestao-op__card-dval">${op.duracao}</strong>
                        </div>
                    </div>`;
            } else {
                // 3 colunas — PRESSURIZAÇÃO, AGUARDANDO, MOVENDO A SECO, ALERTA
                const col2label = op.pressao ? "Pressão Última Torre" : (op.modo === "Seco" ? "Velocidade" : "Lâmina");
                const col2val   = op.pressao ?? (op.modo === "Seco" ? (eq.speed ?? 100) + "%" : op.lamina);
                detailsInner = `
                    <div class="gestao-op__card-details gestao-op__card-details--3col">
                        <div class="gestao-op__card-ditem">
                            <span class="gestao-op__card-dlabel">Irrigação Ativa</span>
                            <strong class="gestao-op__card-dval">${op.irrigacao}</strong>
                        </div>
                        <div class="gestao-op__card-ditem">
                            <span class="gestao-op__card-dlabel">Direção</span>
                            <strong class="gestao-op__card-dval">${op.direcao}</strong>
                        </div>
                        <div class="gestao-op__card-ditem">
                            <span class="gestao-op__card-dlabel">Modo</span>
                            <strong class="gestao-op__card-dval">${op.modo}</strong>
                        </div>
                        <div class="gestao-op__card-ditem">
                            <span class="gestao-op__card-dlabel">${col2label}</span>
                            <strong class="gestao-op__card-dval">${col2val}</strong>
                        </div>
                        <div class="gestao-op__card-ditem">
                            <span class="gestao-op__card-dlabel">Ângulo Atual</span>
                            <strong class="gestao-op__card-dval">${op.anguloAtual}</strong>
                        </div>
                        <div class="gestao-op__card-ditem">
                            <span class="gestao-op__card-dlabel">Ângulo de Parada</span>
                            <strong class="gestao-op__card-dval">${op.anguloParada}</strong>
                        </div>
                        <div class="gestao-op__card-ditem">
                            <span class="gestao-op__card-dlabel">Término Previsto</span>
                            <strong class="gestao-op__card-dval">${op.termino}</strong>
                        </div>
                        <div class="gestao-op__card-ditem">
                            <span class="gestao-op__card-dlabel">Duração Prevista</span>
                            <strong class="gestao-op__card-dval">${op.duracao}</strong>
                        </div>
                        <div class="gestao-op__card-ditem"></div>
                    </div>`;
            }

            const detailsHtml = `
                <div class="gestao-op__card-vsep"></div>
                ${detailsInner}
                <div class="gestao-op__card-vsep gestao-op__card-vsep--hidden"></div>
                <div class="gestao-op__card-end">
                    <button class="gestao-op__details-link gestao-op__details-link--card" type="button">Detalhes</button>
                </div>
            `;

            return `<div class="gestao-op__card-main-col"${mainColStyle}>${mainColHtml}</div>${detailsHtml}`;
        }

        // ─── renderDevices ─────────────────────────────────────────────────────

        function renderDevices() {
            const pivosContainer = document.getElementById("gestaoPivosContainer");
            if (!pivosContainer) return;

            pivosContainer.innerHTML = "";

            const activeFarms = farms.filter((f) => selectedFarms.has(f.id));
            const allEquips   = [];

            activeFarms.forEach((f) => {
                (f.equipments || []).forEach((e) => {
                    if (
                        e.category === "pivos" ||
                        e.category === "bombas" ||
                        e.type     === "irripump"
                    ) {
                        allEquips.push({ ...e, _farmName: getFarmName(f) });
                    }
                });
            });


            const wantPivos  = activeTypes.has("pivos");
            const wantBombas = activeTypes.has("bombas");

            if (!wantPivos && !wantBombas) {
                pivosContainer.innerHTML = `<p style="font-size:12px;color:#94a3b8;padding:12px;">
                    Selecione Pivôs ou Bombas para visualizar os controladores.
                </p>`;
                return;
            }

            if (!allEquips.length) {
                pivosContainer.innerHTML = `<p style="font-size:12px;color:#94a3b8;padding:12px;">
                    Não há dispositivos para a(s) fazenda(s) selecionada(s).
                </p>`;
                return;
            }

            const filteredByType = allEquips.filter((e) => {
                if (e.category === "pivos") return wantPivos;
                return wantBombas;
            });

            if (!filteredByType.length) {
                pivosContainer.innerHTML = `<p style="font-size:12px;color:#94a3b8;padding:12px;">
                    Não há equipamentos do tipo selecionado para esta fazenda.
                </p>`;
                return;
            }

            const pivos  = filteredByType.filter((e) => e.category === "pivos");
            const bombas = filteredByType.filter((e) => e.category !== "pivos");

            function appendCard(eq) {
                const el = document.createElement("div");
                el.className = "gestao-op__card";
                el.innerHTML = buildEquipCard(eq);
                const startBtn = el.querySelector(".js-start-equip");
                if (startBtn) {
                    startBtn.addEventListener("click", () => {
                        window.OpModal?.open({
                            title:      getEquipName(eq),
                            angle:      eq.angle ?? 304.6,
                            isPeakHour: Boolean(eq.isPeakHour),
                            pivotId:    eq.id,
                        });
                    });
                }
                pivosContainer.appendChild(el);
            }

            const pivosWithOps = pivos.map((eq, idx) => ({ ...eq, _activeOp: MOCK_OPS[idx] || null }));
            const sortedPivos  = sortEquips(pivosWithOps);
            const sortedBombas = sortEquips(bombas);

            sortedPivos.forEach(appendCard);

            if (sortedBombas.length) {
                sortedBombas.forEach((eq, idx) => appendCard({ ...eq, _activeOp: MOCK_PUMP_OPS[idx] || null }));
            }
        }

        // ─── renderTimeline ────────────────────────────────────────────────────

        function renderTimeline() {
            if (!timelineContainer || !alertsContainer) return;
            timelineContainer.innerHTML = "";
            alertsContainer.innerHTML  = "";

            const activeFarms  = farms.filter((f) => selectedFarms.has(f.id));
            const timelineData = [];

            activeFarms.forEach((f) => {
                (f.equipments || []).forEach((e) => {
                    if (
                        e.category === "pivos" ||
                        e.category === "bombas" ||
                        e.type     === "irripump"
                    ) {
                        timelineData.push({ ...e, _farmName: getFarmName(f) });
                    }
                });
            });

            const emptyHtml = `
                <div class="gestao-op__timeline-empty">
                    <i class="fa-regular fa-folder-open gestao-op__empty-icon"></i>
                    <p>Não há dados</p>
                </div>`;

            if (!timelineData.length) {
                timelineContainer.innerHTML = emptyHtml;
                alertsContainer.innerHTML  = emptyHtml;
                return;
            }

            const now     = new Date();
            const dateStr =
                now.toLocaleDateString("pt-BR", {
                    day: "2-digit", month: "short", year: "numeric",
                }) + " " +
                now.toLocaleTimeString("pt-BR", {
                    hour: "2-digit", minute: "2-digit",
                });

            // Enrich each equip with its mock op
            let pivoIdx = 0;
            let bombaIdx = 0;
            const enriched = timelineData.map((eq) => {
                if (eq.category === "pivos") {
                    return { ...eq, _activeOp: MOCK_OPS[pivoIdx++] || null };
                }
                return { ...eq, _activeOp: MOCK_PUMP_OPS[bombaIdx++] || null };
            });

            // color → status-- badge class mapping
            const colorToBadge = {
                red: "status--red", blue: "status--blue", sky: "status--sky",
                brown: "status--brown", warn: "status--warn", yellow: "status--yellow",
                green: "status--green", cyan: "status--cyan",
            };

            enriched.filter((eq) => !eq._activeOp?.isAlert).forEach((eq) => {
                const isPivo = eq.category === "pivos";
                const op     = eq._activeOp;
                const color  = isPivo ? (op ? op.color : "yellow") : "green";
                const status = isPivo ? (op ? op.statusText : "PARADO") : "ONLINE";
                const badge  = colorToBadge[color] || "status--yellow";

                const iconHtml = isPivo
                    ? `<div class="gestao-op__timeline-icon is-pivot gestao-op__timeline-icon--${color}"></div>`
                    : `<div class="gestao-op__card-icon" style="margin-top:0;width:34px;height:34px;">
                           <img src="./assets/img/svg/pump.svg" alt="Bomba" style="width:28px;height:28px;">
                       </div>`;

                const item = document.createElement("div");
                item.className = "gestao-op__timeline-item";
                item.innerHTML = `
                    ${iconHtml}
                    <div class="gestao-op__timeline-info">
                        <div class="gestao-op__timeline-title-row">
                            <span class="gestao-op__timeline-name">${getEquipName(eq)}</span>
                            <span class="gestao-op__timeline-badge ${badge}">${status}</span>
                        </div>
                        <div class="gestao-op__timeline-meta">
                            <strong>${eq._farmName}</strong> | ${dateStr}
                        </div>
                    </div>
                `;
                timelineContainer.appendChild(item);
            });

            // ── Alertas
            const farmName  = timelineData[0]?._farmName || "Fazenda";

            // Pivôs com ALERTA no mock
            const alertPivos = enriched.filter((e) => e._activeOp?.isAlert);

            const fixedAlerts = [
                { equip: enriched.find((e) => e.category === "pivos" && !e._activeOp?.isAlert)
                    ? getEquipName(enriched.find((e) => e.category === "pivos" && !e._activeOp?.isAlert))
                    : "Pivô", severity: "red",    label: "FALHA DE PRESSÃO" },
                { equip: enriched.filter((e) => e.category === "pivos" && !e._activeOp?.isAlert)[1]
                    ? getEquipName(enriched.filter((e) => e.category === "pivos" && !e._activeOp?.isAlert)[1])
                    : "Pivô", severity: "red",    label: "QUEDA DE ENERGIA" },
                { equip: enriched.filter((e) => e.category === "pivos" && !e._activeOp?.isAlert)[2]
                    ? getEquipName(enriched.filter((e) => e.category === "pivos" && !e._activeOp?.isAlert)[2])
                    : "Pivô", severity: "yellow", label: "BAIXA VAZÃO" },
                { equip: enriched.find((e) => e.category !== "pivos")
                    ? getEquipName(enriched.find((e) => e.category !== "pivos"))
                    : "Bomba", severity: "yellow", label: "SOBRECARGA DO MOTOR" },
            ];

            // ALERTA pivots go first in alert list
            alertPivos.forEach((eq) => {
                const item = document.createElement("div");
                item.className = "gestao-op__timeline-item";
                item.innerHTML = `
                    <div class="gestao-op__timeline-icon gestao-op__timeline-icon--red">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                    </div>
                    <div class="gestao-op__timeline-info">
                        <div class="gestao-op__timeline-title-row">
                            <span class="gestao-op__timeline-name">${getEquipName(eq)}</span>
                            <span class="gestao-op__timeline-badge status--red">ALERTA</span>
                        </div>
                        <div class="gestao-op__timeline-meta">
                            <strong>${eq._farmName}</strong> | ${dateStr}
                        </div>
                    </div>
                `;
                alertsContainer.appendChild(item);
            });

            fixedAlerts.forEach((alert) => {
                const item = document.createElement("div");
                item.className = "gestao-op__timeline-item";
                item.innerHTML = `
                    <div class="gestao-op__timeline-icon gestao-op__timeline-icon--${alert.severity}">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                    </div>
                    <div class="gestao-op__timeline-info">
                        <div class="gestao-op__timeline-title-row">
                            <span class="gestao-op__timeline-name">${alert.equip}</span>
                            <span class="gestao-op__timeline-badge status--${alert.severity}">${alert.label}</span>
                        </div>
                        <div class="gestao-op__timeline-meta">
                            <strong>${farmName}</strong> | ${dateStr}
                        </div>
                    </div>
                `;
                alertsContainer.appendChild(item);
            });
        }

        // ─── renderScheduled ───────────────────────────────────────────────────

        function renderScheduled() {
            if (!scheduledContainer) return;
            scheduledContainer.innerHTML = "";

            const activeFarms     = farms.filter((f) => selectedFarms.has(f.id));
            const scheduledEquips = [];

            activeFarms.forEach((f) => {
                (f.equipments || []).forEach((e) => {
                    if (e.category === "pivos") {
                        scheduledEquips.push({ ...e, _farmName: getFarmName(f) });
                    }
                });
            });

            if (!scheduledEquips.length) {
                scheduledContainer.innerHTML = `
                    <div style="padding:20px;font-size:12px;color:#94a3b8;">
                        Nenhum agendamento futuro.
                    </div>`;
                return;
            }

            const table = document.createElement("table");
            table.className = "gestao-op__scheduled-table";
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>Pivô</th>
                        <th>Início</th>
                        <th>Fim</th>
                        <th>Direção</th>
                        <th>Modo</th>
                        <th>Percent.</th>
                        <th>Lâmina</th>
                        <th>Ângulo início</th>
                        <th>Ângulo fim</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody></tbody>
            `;
            scheduledContainer.appendChild(table);
            const tbody = table.querySelector("tbody");

            scheduledEquips.forEach((eq, idx) => {
                const direction  = idx % 2 === 0 ? "Avanço" : "Reverso";
                const percent    = idx === 0 ? "100%" : "80%";
                const depth      = idx === 0 ? "6,73mm" : "5,20mm";
                const start      = eq.scheduledStart ?? "03/03/2026 14:00";
                const end        = eq.scheduledEnd   ?? "03/03/2026 18:30";
                const angleStart = eq.angleStart != null ? `${eq.angleStart}°` : "177.1°";
                const angleEnd   = eq.angleEnd   != null ? `${eq.angleEnd}°`   : "3.5°";

                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td><strong>${getEquipName(eq)}</strong></td>
                    <td>${start}</td>
                    <td>${end}</td>
                    <td>${direction}</td>
                    <td><span class="gestao-op__sch-badge gestao-op__sch-badge--mol">Molhado</span></td>
                    <td>${percent}</td>
                    <td>${depth}</td>
                    <td>${angleStart}</td>
                    <td>${angleEnd}</td>
                    <td>
                        <div class="gestao-op__sch-actions">
                            <button type="button" class="sch-btn sch-btn--edit" title="Editar">
                                <i class="fa-solid fa-pencil"></i>
                            </button>
                            <button type="button" class="sch-btn sch-btn--del" title="Excluir">
                                <i class="fa-regular fa-trash-can"></i>
                            </button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        // ─── type filter ──────────────────────────────────────────────────────

        function updateTypeText() {
            if (!typeText) return;
            const allSelected  = TYPE_OPTIONS.every((o) => activeTypes.has(o.value));
            const noneSelected = TYPE_OPTIONS.every((o) => !activeTypes.has(o.value));
            if (allSelected)  { typeText.textContent = "Todos"; return; }
            if (noneSelected) { typeText.textContent = "Nenhum"; return; }
            const labels = TYPE_OPTIONS.filter((o) => activeTypes.has(o.value)).map((o) => o.label);
            typeText.textContent = labels.length <= 2 ? labels.join(", ") : `${labels.length} selecionados`;
        }

        function renderTypeList() {
            if (!typeList) return;
            typeList.innerHTML = "";
            TYPE_OPTIONS.forEach((opt) => {
                const item = document.createElement("div");
                item.className = "gestao-op__item" + (activeTypes.has(opt.value) ? " is-selected" : "");
                item.textContent = opt.label;
                const check = document.createElement("span");
                check.className = "check";
                check.innerHTML = '<i class="fa-solid fa-check"></i>';
                item.appendChild(check);
                item.addEventListener("click", (e) => {
                    e.stopPropagation();
                    if (activeTypes.has(opt.value)) {
                        activeTypes.delete(opt.value);
                    } else {
                        activeTypes.add(opt.value);
                    }
                    item.classList.toggle("is-selected", activeTypes.has(opt.value));
                    updateTypeText();
                    renderDevices();
                    applyTypeFilter();
                });
                typeList.appendChild(item);
            });
        }

        // ─── sort helpers ──────────────────────────────────────────────────────

        function isAlertEquip(eq) {
            return eq._activeOp?.isAlert === true || eq._activeOp?.statusText === "ALERTA";
        }

        function getStatusPriority(eq) {
            const op = eq._activeOp;
            if (!op) return 5;
            if (op.statusText === "IRRIGANDO")     return 0;
            if (op.statusText === "FERTIRRIGANDO") return 1;
            if (op.statusText === "PRESSURIZAÇÃO") return 2;
            if (op.statusText === "MOVENDO A SECO") return 3;
            if (op.statusText === "AGUARDANDO")    return 4;
            return 5;
        }

        function sortEquips(list) {
            // Alerts always bubble to the top regardless of sort mode
            const alerts = list.filter(isAlertEquip);
            const rest   = list.filter((e) => !isAlertEquip(e));

            let sorted;
            switch (activeSort) {
                case "alpha":
                    sorted = rest.sort((a, b) =>
                        getEquipName(a).localeCompare(getEquipName(b), "pt-BR", { sensitivity: "base" })
                    );
                    break;
                case "alpha-rev":
                    sorted = rest.sort((a, b) =>
                        getEquipName(b).localeCompare(getEquipName(a), "pt-BR", { sensitivity: "base" })
                    );
                    break;
                case "progress-desc":
                    sorted = rest.sort((a, b) => {
                        const pA = parseFloat((a._activeOp?.percent || "0").replace("%", "")) || 0;
                        const pB = parseFloat((b._activeOp?.percent || "0").replace("%", "")) || 0;
                        return pB - pA;
                    });
                    break;
                case "progress-asc":
                    sorted = rest.sort((a, b) => {
                        const pA = parseFloat((a._activeOp?.percent || "0").replace("%", "")) || 0;
                        const pB = parseFloat((b._activeOp?.percent || "0").replace("%", "")) || 0;
                        return pA - pB;
                    });
                    break;
                case "status-pos":
                    sorted = rest.sort((a, b) => getStatusPriority(a) - getStatusPriority(b));
                    break;
                case "status-neg":
                    sorted = rest.sort((a, b) => getStatusPriority(b) - getStatusPriority(a));
                    break;
                default:
                    sorted = rest;
            }

            return [...alerts, ...sorted];
        }

        // ─── sort dropdown ─────────────────────────────────────────────────────

        function renderSortList() {
            if (!sortList) return;
            sortList.innerHTML = "";
            SORT_OPTIONS.forEach((opt) => {
                const item = document.createElement("div");
                item.className = "gestao-op__item" + (activeSort === opt.value ? " is-selected" : "");
                item.textContent = opt.label;
                const check = document.createElement("span");
                check.className = "check";
                check.innerHTML = '<i class="fa-solid fa-check"></i>';
                item.appendChild(check);
                item.addEventListener("click", (e) => {
                    e.stopPropagation();
                    activeSort = opt.value;
                    if (sortText) sortText.textContent = opt.label;
                    sortDropdown?.classList.remove("is-open");
                    sortDropdown?.setAttribute("aria-hidden", "true");
                    renderSortList();
                    renderDevices();
                });
                sortList.appendChild(item);
            });
        }

        function applyTypeFilter() {
            const pluvPane  = root.querySelector(".gestao-op__footer-pane--pluv");
            const levelPane = root.querySelector(".gestao-op__footer-pane--level");
            const footer    = root.querySelector(".gestao-op__footer");

            const showPluv  = activeTypes.has("pluviometria");
            const showLevel = activeTypes.has("nivel");

            if (pluvPane)  pluvPane.style.display  = showPluv  ? "" : "none";
            if (levelPane) levelPane.style.display = showLevel ? "" : "none";

            if (footer) {
                if (!showPluv && !showLevel) {
                    footer.style.display = "none";
                } else {
                    footer.style.display = "";
                    footer.style.gridTemplateColumns = (showPluv && showLevel) ? "" : "1fr";
                }
            }
        }

        // ─── renderAll ─────────────────────────────────────────────────────────

        function renderAll() {
            renderChips();
            renderList(searchInput?.value || "");
            updateTypeText();
            renderDevices();
            renderTimeline();
            renderScheduled();
            syncLevelGaugeBadges();
            applyTypeFilter();
        }

        // ─── dropdown events ───────────────────────────────────────────────────

        if (multi) {
            multi.addEventListener("click", () => {
                dropdown?.classList.add("is-open");
                dropdown?.setAttribute("aria-hidden", "false");
                searchInput?.focus();
            });

            document.addEventListener("click", (e) => {
                if (multi.contains(e.target)) return;
                dropdown?.classList.remove("is-open");
                dropdown?.setAttribute("aria-hidden", "true");
            });

            searchInput?.addEventListener("input", () =>
                renderList(searchInput.value)
            );
        }

        // ─── type dropdown events ──────────────────────────────────────────────

        if (typeBtn && typeDropdown) {
            typeBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                const isOpen = typeDropdown.classList.toggle("is-open");
                typeDropdown.setAttribute("aria-hidden", String(!isOpen));
                if (isOpen) renderTypeList();
            });
            document.addEventListener("click", (e) => {
                if (typeSelect && typeSelect.contains(e.target)) return;
                typeDropdown.classList.remove("is-open");
                typeDropdown.setAttribute("aria-hidden", "true");
            });
        }

        // ─── sort dropdown events ──────────────────────────────────────────────

        if (sortBtn && sortDropdown) {
            sortBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                const isOpen = sortDropdown.classList.toggle("is-open");
                sortDropdown.setAttribute("aria-hidden", String(!isOpen));
                if (isOpen) renderSortList();
            });
            document.addEventListener("click", (e) => {
                if (sortSelect && sortSelect.contains(e.target)) return;
                sortDropdown.classList.remove("is-open");
                sortDropdown.setAttribute("aria-hidden", "true");
            });
        }

        // ─── focus / fullscreen ────────────────────────────────────────────────

        const focusBtns = root.querySelectorAll(".js-focus-toggle");

        function syncFocusIcons(isFocus) {
            focusBtns.forEach((btn) => {
                btn.title = isFocus ? "Sair do modo foco" : "Modo foco";
                const icon = btn.querySelector("i");
                if (!icon) return;
                if (isFocus) {
                    icon.classList.replace("fa-expand", "fa-compress");
                } else {
                    icon.classList.replace("fa-compress", "fa-expand");
                }
            });
        }

        function enterFocus() {
            document.body.classList.add("is-gestao-focus");
            const el = document.documentElement;
            const req =
                el.requestFullscreen       ||
                el.webkitRequestFullscreen ||
                el.msRequestFullscreen;
            if (req) req.call(el);
            syncFocusIcons(true);
            window.dispatchEvent(new Event("resize"));
        }

        function exitFocus() {
            document.body.classList.remove("is-gestao-focus");
            const ex =
                document.exitFullscreen       ||
                document.webkitExitFullscreen ||
                document.msExitFullscreen;
            if (ex && document.fullscreenElement) ex.call(document);
            syncFocusIcons(false);
            window.dispatchEvent(new Event("resize"));
        }

        const toggleFocus = () => {
            if (document.body.classList.contains("is-gestao-focus")) {
                exitFocus();
            } else {
                enterFocus();
            }
        };

        focusBtns.forEach((btn) => btn.addEventListener("click", toggleFocus));

        // Sync quando o usuário sai do fullscreen pelo ESC
        document.addEventListener("fullscreenchange", () => {
            if (!document.fullscreenElement) {
                document.body.classList.remove("is-gestao-focus");
                syncFocusIcons(false);
                window.dispatchEvent(new Event("resize"));
            }
        });

        // ─── pluviometer card toggles ──────────────────────────────────────────

        root.addEventListener("click", (e) => {
            const toggle = e.target.closest("[data-card-toggle]");
            if (!toggle) return;
            const card = toggle.closest("[data-pluv-card]");
            if (!card) return;
            const isOpen = card.classList.toggle("is-open");
            card.setAttribute("aria-expanded",  String(isOpen));
            toggle.setAttribute("aria-expanded", String(isOpen));
        });

        // ─── init ──────────────────────────────────────────────────────────────

        renderAll();
        syncGestaoPluvCards(root);
        initHorizontalWheelScroll(root);
    }

    // ─── horizontal wheel scroll nos painéis do footer ────────────────────────

    function initHorizontalWheelScroll(root) {
        // Escuta no pane inteiro — o scroll é redirecionado para a lista interna
        var panes = root.querySelectorAll(
            ".gestao-op__footer-pane--pluv, .gestao-op__footer-pane--level"
        );
        panes.forEach(function (pane) {
            var list = pane.querySelector(".pluv-group__list, .gestao-op__level-list");
            if (!list) return;
            pane.addEventListener("wheel", function (e) {
                var delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
                if (delta === 0) return;
                e.preventDefault();
                e.stopPropagation();
                list.scrollLeft += delta;
            }, { passive: false });
        });
    }

    // ─── map card helpers ──────────────────────────────────────────────────────

    function setMapCardDisplay(value) {
        const mapCard = document.getElementById("mapCard");
        if (mapCard) mapCard.style.display = value;
    }

    // ─── public API ────────────────────────────────────────────────────────────

    window.IcGestao = {
        async open() {
            document.body.classList.add("is-gestao");
            setMapCardDisplay("none");
            await mountGestaoView();
            window.dispatchEvent(new Event("ic:layout-change"));
        },

        close() {
            document.body.classList.remove("is-gestao", "is-gestao-focus");
            // Sair do fullscreen se estiver ativo
            if (document.fullscreenElement) {
                const ex =
                    document.exitFullscreen       ||
                    document.webkitExitFullscreen ||
                    document.msExitFullscreen;
                if (ex) ex.call(document);
            }
            const slot = document.getElementById("pageSlot");
            if (slot) slot.innerHTML = "";
            setMapCardDisplay("");
            window.dispatchEvent(new Event("ic:layout-change"));
        },
    };
})();
