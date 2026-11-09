// assets/js/pages/pivos/linestar-details.js
(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);

    let minimapInstance = null;
    let selectedId = null;
    let minimapZoomHint = null;
    let minimapWheelMode = "ctrl";
    let minimapWheelListenersBound = false;
    let minimapHintTimer = null;
    let selectorOutsideClickHandler = null;
    let filterOutsideClickHandler = null;
    const lineStarOperationDetails = Object.freeze([
        { tipo: "Irrigação", laminaMm: "7,57", velocidade: "70,00", tempoOperacao: "6,60", usuario: "Bauer Irricontrol" },
        { tipo: "Chuva", laminaMm: "12,50", velocidade: "-", tempoOperacao: "-", usuario: "Bauer Irricontrol" },
        { tipo: "Irrigação", laminaMm: "7,57", velocidade: "70,00", tempoOperacao: "6,60", usuario: "Bauer Irricontrol" },
        { tipo: "Irrigação", laminaMm: "7,57", velocidade: "70,00", tempoOperacao: "6,60", usuario: "Bauer Irricontrol" },
        { tipo: "Chuva", laminaMm: "5,00", velocidade: "-", tempoOperacao: "-", usuario: "Bauer Irricontrol" },
        { tipo: "Irrigação", laminaMm: "7,57", velocidade: "70,00", tempoOperacao: "6,60", usuario: "Bauer Irricontrol" },
        { tipo: "Irrigação", laminaMm: "7,57", velocidade: "70,00", tempoOperacao: "6,60", usuario: "Bauer Irricontrol" },
        { tipo: "Chuva", laminaMm: "8,40", velocidade: "-", tempoOperacao: "-", usuario: "Bauer Irricontrol" },
        { tipo: "Irrigação", laminaMm: "7,57", velocidade: "68,00", tempoOperacao: "6,35", usuario: "Bauer Irricontrol" }
    ]);
    
    // Geographical Helpers
    const bearingRad = (from, to) => {
        const toRad = (deg) => (deg * Math.PI) / 180;
        const lat1 = toRad(from.lat);
        const lat2 = toRad(to.lat);
        const dLng = toRad(to.lng - from.lng);
        const y = Math.sin(dLng) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
        return Math.atan2(y, x);
    };

    const destinationPoint = (origin, distance, bearing) => {
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
    };

    const interpolatePoint = (from, to, ratio) => ({
        lat: from.lat + (to.lat - from.lat) * ratio,
        lng: from.lng + (to.lng - from.lng) * ratio,
    });

    const getLineStarWidths = (data, fallbackWidth) => {
        const hasSeparateWidths = Object.prototype.hasOwnProperty.call(data, "widthA")
            || Object.prototype.hasOwnProperty.call(data, "widthB");
        if (hasSeparateWidths) {
            return {
                widthA: Math.max(0, Number(data.widthA) || 0),
                widthB: Math.max(0, Number(data.widthB) || 0),
            };
        }

        const storedWidth = Number(data.width);
        const legacyWidth = Number.isFinite(storedWidth) && storedWidth > 0 ? storedWidth : fallbackWidth;
        if (data.widthSide === -1 || data.widthSide === 1) {
            return {
                widthA: data.widthSide === -1 ? legacyWidth : 0,
                widthB: data.widthSide === 1 ? legacyWidth : 0,
            };
        }
        return { widthA: legacyWidth / 2, widthB: legacyWidth / 2 };
    };

    const drawLineStarZeroAngleMarkers = (layer, track, options = {}) => {
        if (!layer || !track?.ptA || !track?.ptB) return;

        const hasWidthA = Number(track.widthA) > 0;
        const hasWidthB = Number(track.widthB) > 0;
        if (!hasWidthA && !hasWidthB) return;

        const brng = bearingRad(track.ptA, track.ptB);
        const offsetPerp = (origin, meters, side) => destinationPoint(origin, meters, brng + (side * Math.PI / 2));
        const refColor = options.color || "#ffffff";

        const selectedSide = options.hoseSide === "B" ? "B" : "A";

        const drawMarker = (origin, width, side) => {
            if (!(Number(width) > 0)) return;
            const edge = offsetPerp(origin, width, side);
            const triHeight = width * 0.44;
            const triHalfBase = width * 0.20;
            const tipBearing = side === -1 ? brng + Math.PI / 2 : brng - Math.PI / 2;
            const base1 = destinationPoint(edge, triHalfBase, brng);
            const base2 = destinationPoint(edge, triHalfBase, brng + Math.PI);
            const tip = destinationPoint(edge, triHeight, tipBearing);

            L.polygon([base1, base2, tip].map((p) => [p.lat, p.lng]), {
                color: "#000000",
                weight: 1.2,
                opacity: 0.25,
                fillColor: refColor,
                fillOpacity: 0.95,
                interactive: false
            }).addTo(layer);
        };

        if (hasWidthA && hasWidthB) {
            if (selectedSide === "A") drawMarker(track.ptA, track.widthA, -1);
            else drawMarker(track.ptB, track.widthB, 1);
            return;
        }

        const markerOrigin = selectedSide === "A" ? track.ptA : track.ptB;
        if (hasWidthA) drawMarker(markerOrigin, track.widthA, -1);
        else if (hasWidthB) drawMarker(markerOrigin, track.widthB, 1);
    };
    const STATUS_BAR_CLASS_BY_PIVOT_STATUS = Object.freeze({
        "is-info": "is-running",
        "is-sky": "is-running",
        "is-complete": "is-energized",
        "is-warning": "is-energized",
        "is-success": "is-energized",
        "is-danger": "is-stopped",
        "is-neutral": "is-offline",
    });

    function scrollToLinestarSection(section = "top") {
        const target = section === "details"
            ? document.querySelector("#linestarPanel .pivo-bottom-row") || document.querySelector("#linestarPanel .pivo-faults")
            : document.getElementById("pageSlot") || document.querySelector("#linestarPanel");
        if (target && typeof target.scrollIntoView === "function") {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }

    function ensureMinimapWheelHint(mapEl) {
        if (!mapEl) return;
        if (minimapZoomHint && !minimapZoomHint.isConnected) {
            minimapZoomHint = null;
        }
        if (minimapZoomHint) return;
        minimapZoomHint = document.createElement("div");
        minimapZoomHint.className = "map-zoom-hint map-zoom-hint--mini";
        minimapZoomHint.textContent = "Pressione Ctrl e role a tela simultaneamente para aplicar zoom no mapa";
        mapEl.appendChild(minimapZoomHint);
    }

    function showMinimapWheelHint() {
        if (!minimapZoomHint) return;
        minimapZoomHint.classList.add("is-visible");
        if (minimapHintTimer) clearTimeout(minimapHintTimer);
        minimapHintTimer = setTimeout(() => {
            minimapZoomHint?.classList.remove("is-visible");
        }, 1200);
    }

    function renderOperationDetailItem(label, value) {
        return `
            <div class="pivo-history__detail-item">
                <span class="pivo-history__detail-label">${label}:</span>
                <strong class="pivo-history__detail-value">${value}</strong>
            </div>
        `;
    }

    function renderOperationDetailsMarkup(details = {}) {
        const {
            tipo = "-",
            laminaMm = "-",
            velocidade = "-",
            tempoOperacao = "-",
            usuario = "-"
        } = details;

        return `
            <td colspan="8">
                <div class="pivo-history__details">
                    <h4>Description</h4>
                    <div class="pivo-history__details-grid pivo-history__details-grid--operations">
                        ${renderOperationDetailItem("Type", tipo)}
                        ${renderOperationDetailItem("Depth (mm)", laminaMm)}
                        ${renderOperationDetailItem("Speed (%)", velocidade)}
                        ${renderOperationDetailItem("Operation Time (h)", tempoOperacao)}
                        ${renderOperationDetailItem("User", usuario)}
                    </div>
                </div>
            </td>
        `;
    }

    function hydrateLinestarOperationDetails() {
        const operacoesBody = document.getElementById("linestarOperacoesBody");
        if (!operacoesBody) return;
        // Com o histórico do motor, cada operação já traz o próprio detalhe
        if (window.IcDemoHistory?.findEquipment(selectedId)) return;

        const detailsRows = operacoesBody.querySelectorAll("tr.pivo-history__row-details");
        detailsRows.forEach((detailsRow, index) => {
            const details = lineStarOperationDetails[index] || lineStarOperationDetails[lineStarOperationDetails.length - 1];
            detailsRow.innerHTML = renderOperationDetailsMarkup(details);
        });
    }

    function bindMinimapWheelControls() {
        if (minimapWheelListenersBound) return;
        minimapWheelListenersBound = true;

        window.addEventListener("keydown", (event) => {
            if (minimapWheelMode !== "ctrl") return;
            if (event.key === "Control" && minimapInstance) {
                minimapInstance.scrollWheelZoom.enable();
            }
        });

        window.addEventListener("keyup", (event) => {
            if (minimapWheelMode !== "ctrl") return;
            if (event.key === "Control" && minimapInstance) {
                minimapInstance.scrollWheelZoom.disable();
            }
        });

        window.addEventListener("blur", () => {
            if (minimapWheelMode !== "ctrl") return;
            if (minimapInstance) minimapInstance.scrollWheelZoom.disable();
        });
    }

    // ─── Fault Modal ────────────────────────────────────────────────────────────

    const faultTableRows = {
        "Pressure Failure": [
            { pos: "23%", hora: "06/04/2026 02:14" },
            { pos: "71%", hora: "05/04/2026 18:42" },
        ],
        "Misalignment": [
            { pos: "48%", hora: "02/04/2026 11:07" },
        ],
        "Low Voltage": [],
        "Voltage Peak": [],
        "Irrigation Accumulated": [
            { pos: "0% → 100%", hora: "06/04/2026 06:46" },
            { pos: "0% → 68%",  hora: "05/04/2026 06:54" },
            { pos: "52% → 100%", hora: "03/04/2026 03:25" },
        ],
    };

    function openLinestarFaultModal(faultTitle) {
        const modalId = "linestarFaultModal";
        if (document.getElementById(modalId)) document.getElementById(modalId).remove();

        const farm = window.IcFarmGetActive?.() || window.IcFarmActive;
        const equip = farm?.equipments?.find(e => e.id === selectedId);
        const rows = faultTableRows[faultTitle] || [];
        const isEmpty = rows.length === 0;
        const isAccumulated = faultTitle === "Irrigation Accumulated";

        const thirdColLabel = isAccumulated ? "Section" : "Position";

        const tableBody = isEmpty ? "" : `<tbody>${rows.map(r => `
            <tr>
                <td>${r.hora}</td>
                <td>${r.pos}</td>
            </tr>`).join("")}</tbody>`;

        const emptyState = isEmpty ? `
            <div class="fault-modal__empty-state">
                <svg class="fault-modal__empty-icon" viewBox="0 0 100 100" fill="none">
                    <path d="M10 30H90V80C90 85.5 85.5 90 80 90H20C14.5 90 10 85.5 10 80V30Z" stroke="currentColor" stroke-width="2"/>
                    <path d="M10 30L25 10H75L90 30" stroke="currentColor" stroke-width="2"/>
                    <path d="M40 30C40 35.5 44.5 40 50 40C55.5 40 60 35.5 60 30" stroke="currentColor" stroke-width="2"/>
                </svg>
                <p class="fault-modal__empty-text">Não há dados</p>
            </div>` : "";

        const pagination = isEmpty ? "" : `
            <footer class="fault-modal__pagination">
                <span>1-${rows.length} <span>de</span> ${rows.length} <span>itens</span></span>
                <div class="fault-modal__pagination-controls">
                    <button type="button" class="fault-modal__page-btn" disabled><i class="fa-solid fa-chevron-left"></i></button>
                    <button type="button" class="fault-modal__page-btn is-active">1</button>
                    <button type="button" class="fault-modal__page-btn" disabled><i class="fa-solid fa-chevron-right"></i></button>
                </div>
            </footer>`;

        document.body.insertAdjacentHTML("beforeend", `
            <div class="fault-modal" id="${modalId}">
                <div class="fault-modal__backdrop"></div>
                <div class="fault-modal__dialog">
                    <header class="fault-modal__header">
                        <h3 class="fault-modal__title">${faultTitle}</h3>
                        <button type="button" class="fault-modal__close" aria-label="Close">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </header>
                    <div class="fault-modal__content">
                        <div class="fault-modal__map-side">
                            <div class="fault-modal__map" id="linestarFaultMap"></div>
                        </div>
                        <div class="fault-modal__table-side">
                            <header class="fault-modal__table-header">
                                <h4 class="fault-modal__table-title">Ocorrências</h4>
                                <div class="fault-modal__date-picker">
                                    <span>10/03/2026 &nbsp;—&nbsp; 10/04/2026</span>
                                    <i class="fa-regular fa-calendar"></i>
                                </div>
                            </header>
                            <div class="fault-modal__table-container">
                                <table class="fault-modal__table">
                                    <thead>
                                        <tr>
                                            <th>Time</th>
                                            <th>${thirdColLabel}</th>
                                        </tr>
                                    </thead>
                                    ${tableBody}
                                </table>
                                ${emptyState}
                            </div>
                            ${pagination}
                        </div>
                    </div>
                </div>
            </div>
        `);

        const modalEl = document.getElementById(modalId);
        const close = () => modalEl.remove();
        modalEl.querySelector(".fault-modal__close").addEventListener("click", close);
        modalEl.querySelector(".fault-modal__backdrop").addEventListener("click", close);

        setTimeout(() => renderLinestarFaultMap(equip, faultTitle, rows), 100);
    }

    function renderLinestarFaultMap(equip, faultTitle, rows) {
        const mapEl = document.getElementById("linestarFaultMap");
        if (!mapEl) return;
        if (mapEl._leaflet_id) { delete mapEl._leaflet_id; mapEl.innerHTML = ""; }

        const data = equip?.data || {};
        const ptA = { lat: parseFloat(data.latA), lng: parseFloat(data.lngA) };
        const ptB = { lat: parseFloat(data.latB), lng: parseFloat(data.lngB) };
        const { widthA, widthB } = getLineStarWidths(data, 40);
        const width = widthA + widthB;
        const hasTrack = Number.isFinite(ptA.lat) && Number.isFinite(ptB.lat);

        const center = hasTrack
            ? [(ptA.lat + ptB.lat) / 2, (ptA.lng + ptB.lng) / 2]
            : [-15.8, -47.9];

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
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 20 }).addTo(map);

        if (!hasTrack) { map.setView(center, 14); return; }

        const toRad = d => d * Math.PI / 180;
        const toDeg = r => r * 180 / Math.PI;
        const brng = Math.atan2(
            Math.sin(toRad(ptB.lng - ptA.lng)) * Math.cos(toRad(ptB.lat)),
            Math.cos(toRad(ptA.lat)) * Math.sin(toRad(ptB.lat)) - Math.sin(toRad(ptA.lat)) * Math.cos(toRad(ptB.lat)) * Math.cos(toRad(ptB.lng - ptA.lng))
        );
        const R = 6378137;
        const offset = (origin, dist, bearing) => {
            const d = dist / R, phi1 = toRad(origin.lat), lam1 = toRad(origin.lng);
            const sinPhi = Math.sin(phi1) * Math.cos(d) + Math.cos(phi1) * Math.sin(d) * Math.cos(bearing);
            const phi2 = Math.asin(Math.max(-1, Math.min(1, sinPhi)));
            const lam2 = lam1 + Math.atan2(Math.sin(bearing) * Math.sin(d) * Math.cos(phi1), Math.cos(d) - Math.sin(phi1) * Math.sin(phi2));
            return { lat: toDeg(phi2), lng: toDeg(lam2) };
        };
        const interp = (t) => ({ lat: ptA.lat + (ptB.lat - ptA.lat) * t, lng: ptA.lng + (ptB.lng - ptA.lng) * t });
        const perp = brng + Math.PI / 2;

        const aL = offset(ptA, widthA, brng - Math.PI / 2);
        const aR = offset(ptA, widthB, perp);
        const bL = offset(ptB, widthA, brng - Math.PI / 2);
        const bR = offset(ptB, widthB, perp);
        const toLL = p => [p.lat, p.lng];

        // Faixa do trilho
        L.polygon([aL, bL, bR, aR].map(toLL), {
            color: "#ffffff", weight: 1.5, opacity: 0.6,
            fillColor: "#1e3a5f", fillOpacity: 0.55, interactive: false
        }).addTo(map);

        // Linha do eixo A→B
        L.polyline([toLL(ptA), toLL(ptB)], { color: "#60a5fa", weight: 2, opacity: 0.7, dashArray: "6 4", interactive: false }).addTo(map);


        // Marcadores de falha ao longo do trilho
        if (faultTitle !== "Irrigation Accumulated") {
            rows.forEach(r => {
                const pct = parseFloat(r.pos) / 100;
                if (!Number.isFinite(pct)) return;
                const pt = interp(pct);
                L.circleMarker(toLL(pt), {
                    radius: 7, color: "#fff", weight: 2,
                    fillColor: faultTitle === "Pressure Failure" ? "#ef4444" : "#f59e0b",
                    fillOpacity: 0.95
                }).bindTooltip(`${r.pos} — ${r.hora}`, { permanent: false, direction: "top" }).addTo(map);
            });
        }

        // Heatmap de pressão ao longo do trilho
        if (faultTitle === "Pressure Failure") {
            const steps = 80;
            for (let i = 0; i < steps; i++) {
                const t1 = i / steps, t2 = (i + 1) / steps;
                const p1 = interp(t1), p2 = interp(t2);
                const p1L = offset(p1, widthA, brng - Math.PI / 2), p1R = offset(p1, widthB, perp);
                const p2L = offset(p2, widthA, brng - Math.PI / 2), p2R = offset(p2, widthB, perp);
                const pressure = 3.8 - (t1 * 1.4) + (Math.sin(t1 * Math.PI * 3) * 0.15);
                const ratio = Math.max(0, Math.min(1, (pressure - 2.4) / 1.4));
                const hue = Math.round(ratio * 120);
                L.polygon([p1L, p2L, p2R, p1R].map(toLL), {
                    color: "transparent", fillColor: `hsl(${hue},90%,50%)`, fillOpacity: 0.55, interactive: false
                }).addTo(map);
            }
        }

        const fg = L.featureGroup([L.polygon([aL, bL, bR, aR].map(toLL))]);
        map.fitBounds(fg.getBounds(), { padding: [28, 28] });
    }

    // ─── End Fault Modal ─────────────────────────────────────────────────────────

    // Troca de período: remonta a tela (histórico, KPIs e gráficos no novo período)
    document.addEventListener("pluv:periodChanged", () => {
        if (document.getElementById("linestarHistoryBody") && selectedId) {
            window.IcLineStar?.open?.({ linestarId: selectedId });
        }
    });

    window.IcLineStar = {
        async open(options = {}) {
            selectedId = options.linestarId || options.pivotId;
            const fromMap = options.fromMap === true;
            const focusSection = options.focusSection === "details" ? "details" : null;

            const slot = document.getElementById("pageSlot");
            if (!slot) return;

            document.body.classList.remove("is-pivo-details-only");
            document.body.classList.add("is-pivo-details");
            window.icMapSetWheelMode?.("ctrl");
            
            try {
                const html = await fetch(`./pages/linestar.details.html?v=${Date.now()}`).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); });
                slot.innerHTML = html;

                hydrateLinestarOperationDetails();
                this.bindEvents();
                this.renderData();
                setTimeout(() => this.initMinimap(), 80);

                if (focusSection === "details") {
                    setTimeout(() => scrollToLinestarSection("details"), 140);
                    setTimeout(() => scrollToLinestarSection("details"), 420);
                } else if (fromMap) {
                    slot.scrollIntoView({ behavior: "smooth", block: "start" });
                }

                const map = window.icMap;
                if (map && typeof map.invalidateSize === "function") {
                    map.invalidateSize({ pan: false });
                    requestAnimationFrame(() => map.invalidateSize({ pan: false }));
                    setTimeout(() => map.invalidateSize({ pan: false }), 180);
                }
            } catch (err) {
                document.body.classList.remove("is-pivo-details");
                window.icMapSetWheelMode?.("free");
                console.error("Failed to load linestar.details.html", err);
            }
        },

        bindEvents() {
            const backBtns = document.querySelectorAll(".js-details-back");
            backBtns.forEach(btn => {
                btn.addEventListener("click", () => {
                    this.close();
                    document.querySelector('.nav__item[data-route="visao-geral"]')?.click();
                });
            });

            const selectorMenu = $("linestarSelectorMenu");
            if (selectorMenu) {
                if (selectorOutsideClickHandler) {
                    document.removeEventListener("click", selectorOutsideClickHandler);
                }
                selectorOutsideClickHandler = (e) => {
                    const menu = $("linestarSelectorMenu");
                    const selectBtn = e.target.closest("#linestarSelectBtn");
                    if (!menu) return;

                    if (selectBtn) {
                        e.stopPropagation();
                        const isHidden = getComputedStyle(menu).display === "none";
                        if (isHidden) {
                            this.renderSelectorItems(menu);
                        }
                        menu.style.display = isHidden ? "flex" : "none";
                        selectBtn.classList.toggle("is-active", isHidden);
                        return;
                    }

                    if (!menu.contains(e.target)) {
                        menu.style.display = "none";
                        $("linestarSelectBtn")?.classList.remove("is-active");
                    }
                };
                document.addEventListener("click", selectorOutsideClickHandler);
            }

            const editBtn = $("linestarEditBtn");
            if (editBtn) {
                editBtn.addEventListener("click", () => {
                    if (window.IcLineStarEdit) {
                        window.IcLineStarEdit.open({ linestarId: selectedId });
                    }
                });
            }

            // Botão Iniciar
            const startBtn = $("linestarStartBtn");
            if (startBtn) {
                startBtn.addEventListener("click", () => {
                    const farm = window.IcFarmGetActive?.() || window.IcFarmActive;
                    const equip = farm?.equipments?.find(e => e.id === selectedId);
                    const position = window.IcPivotSimulationRuntime?.states?.[selectedId]?.progress ?? 0;
                    if (window.OpModal && typeof window.OpModal.open === "function") {
                        window.OpModal.open({
                            title: equip?.name || "Pivô Linear",
                            pivotId: selectedId,
                            isLinear: true,
                            position: position,
                            isPeakHour: true
                        });
                    }
                });
            }

            // Histórico/Operações gerados pelo motor único (demo-history.js),
            // no lugar das linhas fixas de "abr 2026" do HTML.
            (function fillLinestarFromEngine() {
                const DH = window.IcDemoHistory;
                if (!DH || !selectedId || !DH.findEquipment(selectedId)) return;
                const range = DH.periodFrom(window.Plv?.state?.period, 7);
                const ops = DH.pivot.ops(selectedId, range.start, range.end);
                const pos = (ang) => `${Math.round((ang / 360) * 100)}%`;
                const dir = (op) => (op.direction === "Avanço" ? "AVANÇO A→B" : "REVERSO B→A");
                const CHECK2 = '<img src="./assets/img/svg/check-check.svg" style="width:16px;height:16px;vertical-align:middle;filter:invert(48%) sepia(79%) saturate(476%) hue-rotate(86deg) brightness(118%) contrast(119%);" alt="">';
                const CHECK1 = '<img src="./assets/img/svg/check.svg" style="width:16px;height:16px;vertical-align:middle;opacity:0.5;" alt="">';
                const events = [];
                ops.forEach((op) => {
                    const det = (when, at) => `<tr class="pivo-history__row-details" style="display: none;"><td colspan="4"><div class="pivo-history__details"><h4>Descrição</h4><div class="pivo-history__details-grid">
                        <div>Criado: ${DH.fmt.dateTime(when)}</div><div>Recebido: ${DH.fmt.dateTime(when)}</div>
                        <div>Posição atual: ${pos(at)}</div><div>Pressão: ${DH.fmt.n(op.pressureCenter, 1)} bar</div>
                        <div>Horímetro molhado: ${DH.fmt.hm(op.wetStart)}</div><div>Horímetro total: ${DH.fmt.hm(op.hourStart)}</div></div></div></td></tr>`;
                    const row = (when, type, icon, status, at) => ({ when, html: `<tr class="pivo-history__row"><td class="pivo-history__col-btn"><button class="expand-btn"><i class="fa-solid fa-plus"></i></button></td><td>${DH.fmt.dateTime(when)}</td><td>${type} ${icon}</td><td>${status}</td></tr>${det(when, at)}` });
                    if (op.start >= range.start) {
                        events.push(row(op.start, "Comando", CHECK1, "INICIAR IRRIGAÇÃO", op.angStart));
                        events.push(row(new Date(op.start.getTime() + 3 * 60000), "Atualização", CHECK2, `${op.wet ? "IRRIGANDO" : "MOVENDO A SECO"} (${dir(op)})`, op.angStart));
                    }
                    if (op.end <= range.end) {
                        events.push(op.fault
                            ? row(op.end, "Alerta", "", DH.pivot.FAULT_LABEL[op.fault], op.angEnd)
                            : row(op.end, "Atualização", CHECK2, "PARADO - FIM DO PERCURSO", op.angEnd));
                    }
                });
                events.sort((x, y) => y.when - x.when);
                const hb = $("linestarHistoryBody");
                if (hb) hb.innerHTML = events.length ? events.map((e) => e.html).join("") : '<tr class="pivo-history__row"><td colspan="4" style="text-align:center;padding:28px 12px;color:#64748b;">Nenhum evento no período selecionado.</td></tr>';
                const ob = document.getElementById("linestarOperacoesBody");
                if (ob) ob.innerHTML = ops.length ? ops.map((op) => `<tr class="pivo-history__row">
                    <td class="pivo-history__col-btn"><button class="expand-btn"><i class="fa-solid fa-plus"></i></button></td>
                    <td>${DH.fmt.dateTime(op.start)}</td><td>${DH.fmt.dateTime(op.end)}</td><td>${op.percent}%</td><td>${op.mode}</td>
                    <td>${pos(op.angStart)}</td><td>${pos(op.angEnd)}</td><td>${DH.fmt.n(op.lap, 2)}</td></tr>
                    <tr class="pivo-history__row-details" style="display: none;"><td colspan="8"><div class="pivo-history__details"><h4>Descrição</h4>
                    <div class="pivo-history__details-grid pivo-history__details-grid--operations">
                      <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Tipo:</span> <strong class="pivo-history__detail-value">${op.wet ? "Irrigação" : "Deslocamento a seco"}</strong></div>
                      <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Lâmina (mm):</span> <strong class="pivo-history__detail-value">${DH.fmt.n(op.laminaMm, 2)}</strong></div>
                      <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Velocidade (%):</span> <strong class="pivo-history__detail-value">${DH.fmt.n(op.percent, 2)}</strong></div>
                      <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Tempo de Operação (h):</span> <strong class="pivo-history__detail-value">${DH.fmt.n(op.durH, 2)}</strong></div>
                      <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Usuário:</span> <strong class="pivo-history__detail-value">${op.scheduled ? "Agendamento" : op.user}</strong></div>
                    </div></div></td></tr>`).join("") : '<tr class="pivo-history__row"><td colspan="8" style="text-align:center;padding:28px 12px;color:#64748b;">Nenhuma operação no período selecionado.</td></tr>';
                const pager = document.querySelector("#linestarPanel .pivo-history__pagination");
                if (pager) {
                    const total = Math.max(1, Math.ceil(events.length / 10));
                    const btns = ['<button type="button" class="btn-page" aria-label="Página anterior"><i class="fa-solid fa-chevron-left"></i></button>'];
                    for (let i = 1; i <= Math.min(total, 9); i++) btns.push(`<button type="button" class="btn-page${i === 1 ? " is-active" : ""}">${i}</button>`);
                    btns.push('<button type="button" class="btn-page" aria-label="Próxima página"><i class="fa-solid fa-chevron-right"></i></button>');
                    pager.innerHTML = btns.join("");
                    pager.style.display = total > 1 ? "" : "none";
                }
            })();

            // Expand/collapse rows no histórico
            const historyBody = $("linestarHistoryBody");
            if (historyBody) {
                historyBody.addEventListener("click", (e) => {
                    const btn = e.target.closest(".expand-btn");
                    if (!btn) return;
                    const tr = btn.closest("tr.pivo-history__row");
                    if (!tr) return;
                    const detailsRow = tr.nextElementSibling;
                    if (!detailsRow || !detailsRow.classList.contains("pivo-history__row-details")) return;
                    const isExpanded = detailsRow.style.display !== "none";
                    detailsRow.style.display = isExpanded ? "none" : "table-row";
                    const icon = btn.querySelector("i");
                    if (icon) icon.className = isExpanded ? "fa-solid fa-plus" : "fa-solid fa-minus";
                });

                // Marca linhas de alerta (fundo vermelho clarinho)
                historyBody.querySelectorAll("tr.pivo-history__row").forEach(row => {
                    if (row.cells[2]?.textContent?.trim() === "Alerta") {
                        row.classList.add("pivo-history__row--alerta");
                    }
                });

                // Paginação da tabela de Eventos
                const paginationEl = document.querySelector("#linestarPanel .pivo-history__pagination");
                const eventRows = Array.from(historyBody.querySelectorAll("tr.pivo-history__row"));
                const ROWS_PER_PAGE = 10;
                let currentPage = 1;
                const totalPages = Math.ceil(eventRows.length / ROWS_PER_PAGE);

                function renderEventPage(page) {
                    currentPage = page;
                    eventRows.forEach((row, idx) => {
                        const start = (currentPage - 1) * ROWS_PER_PAGE;
                        const end = start + ROWS_PER_PAGE;
                        const show = idx >= start && idx < end;
                        row.style.display = show ? "" : "none";
                        // Esconde também a details-row correspondente
                        const details = row.nextElementSibling;
                        if (details?.classList.contains("pivo-history__row-details")) {
                            details.style.display = "none";
                        }
                    });
                    if (paginationEl) {
                        paginationEl.querySelectorAll(".btn-page").forEach(btn => {
                            const btnPage = parseInt(btn.textContent, 10);
                            if (!isNaN(btnPage)) {
                                btn.classList.toggle("is-active", btnPage === currentPage);
                                btn.setAttribute("aria-current", btnPage === currentPage ? "page" : "false");
                            }
                        });
                    }
                }

                if (paginationEl) {
                    paginationEl.addEventListener("click", (e) => {
                        const btn = e.target.closest(".btn-page");
                        if (!btn || btn.classList.contains("is-static")) return;
                        const label = btn.getAttribute("aria-label");
                        if (label === "Página anterior") {
                            if (currentPage > 1) renderEventPage(currentPage - 1);
                            return;
                        }
                        if (label === "Próxima página") {
                            if (currentPage < totalPages) renderEventPage(currentPage + 1);
                            return;
                        }
                        const pageNum = parseInt(btn.textContent, 10);
                        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                            renderEventPage(pageNum);
                        }
                    });
                }

                renderEventPage(1);
            }

            // Tabs Eventos / Operações — alterna os dois wrappers de tabela
            const historyTabsEl = document.querySelector("#linestarPanel .pivo-history__tabs");
            if (historyTabsEl) {
                const ICON_DOWNLOAD = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/></svg>`;

                // 1º botão = exportar (download), visível só em Operações. O funnel (2º botão) é fixo.
                const updateFilterIcon = (tab) => {
                    const downloadBtn = document.querySelector("#linestarPanel .pivo-history__actions button:first-child");
                    if (!downloadBtn) return;
                    downloadBtn.innerHTML = ICON_DOWNLOAD;
                    downloadBtn.style.display = tab === "operacoes" ? "" : "none";
                };

                historyTabsEl.addEventListener("click", (e) => {
                    const btn = e.target.closest(".js-linestar-history-tab");
                    if (!btn) return;
                    historyTabsEl.querySelectorAll(".js-linestar-history-tab").forEach(b => b.classList.remove("is-active"));
                    btn.classList.add("is-active");
                    const tab = btn.dataset.tab;
                    updateFilterIcon(tab);
                    const tabEventos = document.getElementById("linestarTabEventos");
                    const tabOperacoes = document.getElementById("linestarTabOperacoes");
                    if (tabEventos) tabEventos.style.display = tab === "eventos" ? "" : "none";
                    if (tabOperacoes) tabOperacoes.style.display = tab === "operacoes" ? "" : "none";
                });

                // Estado inicial conforme aba ativa
                updateFilterIcon(historyTabsEl.querySelector(".js-linestar-history-tab.is-active")?.dataset.tab || "eventos");
            }

            // Expand/collapse na tabela de Operações
            const operacoesBody = document.getElementById("linestarOperacoesBody");
            if (operacoesBody) {
                operacoesBody.addEventListener("click", (e) => {
                    const btn = e.target.closest(".expand-btn");
                    if (!btn) return;
                    const tr = btn.closest("tr.pivo-history__row");
                    if (!tr) return;
                    const detailsRow = tr.nextElementSibling;
                    if (!detailsRow || !detailsRow.classList.contains("pivo-history__row-details")) return;
                    const isExpanded = detailsRow.style.display !== "none";
                    detailsRow.style.display = isExpanded ? "none" : "table-row";
                    const icon = btn.querySelector("i");
                    if (icon) icon.className = isExpanded ? "fa-solid fa-plus" : "fa-solid fa-minus";
                });
            }

            // Botão Atualizar
            const refreshBtn = document.querySelector("#linestarPanel [aria-label='Atualizar']");
            if (refreshBtn) {
                refreshBtn.addEventListener("click", () => {
                    const icon = refreshBtn.querySelector("i");
                    if (!icon) return;
                    icon.style.transition = "transform 0.6s ease";
                    icon.style.transform = "rotate(360deg)";
                    refreshBtn.disabled = true;
                    setTimeout(() => {
                        icon.style.transition = "";
                        icon.style.transform = "";
                        refreshBtn.disabled = false;
                    }, 650);
                });
            }

            // Botão Filtrar
            const filterBtn = document.querySelector("#linestarPanel [aria-label='Filtrar']");
            if (filterBtn) {
                const filterDropdown = document.createElement("div");
                filterDropdown.className = "pivo-history__filter-dropdown";
                filterDropdown.style.cssText = "position:absolute;top:calc(100% + 4px);right:0;z-index:200;background:var(--bg-card,#fff);border:1px solid var(--border-100,#e2e8f0);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.12);padding:8px;min-width:160px;display:none;";
                filterDropdown.innerHTML = `
                    <div style="font-size:11px;font-weight:600;color:var(--text-muted,#64748b);padding:4px 8px 6px;text-transform:uppercase;letter-spacing:.04em;">Tipo</div>
                    ${["Todos","Atualização","Comando","Alerta","Confirmação"].map((tipo, i) =>
                        `<button type="button" class="pivo-history__filter-opt${i === 0 ? " is-active" : ""}" data-filter="${tipo}" style="display:block;width:100%;text-align:left;padding:6px 8px;border-radius:5px;font-size:13px;background:none;border:none;cursor:pointer;color:var(--text-primary,#1e293b);">${tipo}</button>`
                    ).join("")}
                `;

                const actionsEl = filterBtn.closest(".pivo-history__actions");
                if (actionsEl) {
                    actionsEl.style.position = "relative";
                    actionsEl.appendChild(filterDropdown);
                }

                filterBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const isOpen = filterDropdown.style.display !== "none";
                    filterDropdown.style.display = isOpen ? "none" : "block";
                    filterBtn.classList.toggle("is-active", !isOpen);
                });

                filterDropdown.addEventListener("click", (e) => {
                    const opt = e.target.closest(".pivo-history__filter-opt");
                    if (!opt) return;
                    filterDropdown.querySelectorAll(".pivo-history__filter-opt").forEach(b => b.classList.remove("is-active"));
                    opt.classList.add("is-active");
                    const filter = opt.dataset.filter;
                    const body = $("linestarHistoryBody");
                    if (body) {
                        body.querySelectorAll("tr.pivo-history__row").forEach(row => {
                            const tipo = row.cells[2]?.textContent?.trim() || "";
                            const show = filter === "Todos" || tipo === filter;
                            row.style.display = show ? "" : "none";
                            const details = row.nextElementSibling;
                            if (details?.classList.contains("pivo-history__row-details")) {
                                details.style.display = "none";
                            }
                        });
                    }
                    filterDropdown.style.display = "none";
                    filterBtn.classList.remove("is-active");
                });

                if (filterOutsideClickHandler) {
                    document.removeEventListener("click", filterOutsideClickHandler);
                }
                filterOutsideClickHandler = (e) => {
                    if (!filterDropdown.contains(e.target) && e.target !== filterBtn) {
                        filterDropdown.style.display = "none";
                        filterBtn.classList.remove("is-active");
                    }
                };
                document.addEventListener("click", filterOutsideClickHandler);
            }

            // Fault items
            const faultsCard = document.querySelector("#linestarPanel .pivo-faults");
            if (faultsCard) {
                faultsCard.addEventListener("click", (e) => {
                    const item = e.target.closest(".js-fault-item");
                    if (!item) return;
                    const label = item.querySelector(".pivo-faults__label")?.textContent || "Falha";
                    openLinestarFaultModal(label);
                });
            }
        },

        renderSelectorItems(menu) {
            const farm = window.IcFarmGetActive?.() || window.IcFarmActive;
            if (!farm) return;

            const equipments = farm.equipments || [];
            menu.innerHTML = "";

            const groups = [
                {
                    label: "Piv\u00f4s Lineares",
                    type: "linestar",
                    items: equipments.filter((e) => String(e?.type || "").toLowerCase() === "linestar"),
                    open: (id) => this.open({ linestarId: id })
                },
                {
                    label: "Piv\u00f4s Centrais",
                    type: "pivos",
                    items: equipments.filter((e) => String(e?.category || "").toLowerCase() === "pivos" && String(e?.type || "").toLowerCase() !== "linestar"),
                    open: (id) => {
                        this.close();
                        window.IcPivos?.open({ pivotId: id });
                    }
                }
            ].filter(g => g.items.length > 0);

            if (!groups.length) {
                menu.innerHTML = `<div style="padding:10px 12px;font-size:12px;color:#64748b;">Nenhum equipamento encontrado.</div>`;
                return;
            }

            groups.forEach(group => {
                const hasCurrent = group.type === "linestar" && group.items.some((item) => String(item.id) === String(selectedId));
                const wrapper = document.createElement("section");
                wrapper.className = "pivo-selector__group" + (hasCurrent ? " is-open" : "");

                const header = document.createElement("button");
                header.type = "button";
                header.className = "pivo-selector__group-header";
                header.setAttribute("aria-expanded", hasCurrent ? "true" : "false");
                header.innerHTML = `<span class="pivo-selector__group-chevron"><i class="fa-solid fa-caret-right"></i></span>`;
                const titleSpan = document.createElement("span");
                titleSpan.className = "pivo-selector__group-title";
                titleSpan.textContent = group.label;
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
                    const isCurrent = group.type === "linestar" && String(item.id) === String(selectedId);
                    const btn = document.createElement("button");
                    btn.type = "button";
                    btn.className = "pivo-selector__item" + (isCurrent ? " is-selected" : "");
                    const nameSpan = document.createElement("span");
                    nameSpan.textContent = item.name || item.id;
                    btn.innerHTML = `<span class="pivo-selector__item-mark">${isCurrent ? '<i class="fa-solid fa-check"></i>' : ''}</span>`;
                    btn.appendChild(nameSpan);

                    btn.addEventListener("click", (ev) => {
                        ev.stopPropagation();
                        menu.style.display = "none";
                        $("linestarSelectBtn")?.classList.remove("is-active");
                        if (!isCurrent) {
                            group.open(item.id);
                        }
                    });
                    body.appendChild(btn);
                });

                wrapper.appendChild(header);
                wrapper.appendChild(body);
                menu.appendChild(wrapper);
            });
        },

        renderData() {
            const farm = window.IcFarmGetActive?.() || window.IcFarmActive;
            const equip = farm?.equipments?.find(e => e.id === selectedId);

            if (equip) {
                const title = $("linestarTitleLabel");
                if (title) title.textContent = equip.name || "LineStar";

                const resolvedStatus = window.IcResolvePivotStatus?.(equip) || null;
                const statusBar = $("linestarStatus");
                const statusText = $("linestarStatus")?.querySelector(".pincard__status-text");
                if (statusBar) {
                    const barClass = STATUS_BAR_CLASS_BY_PIVOT_STATUS[resolvedStatus?.statusClass] || "is-energized";
                    statusBar.className = `pincard__status-bar ${barClass}`;
                }
                if (statusText) {
                    const _stEn = {"PAINEL ENERGIZADO":"ENERGIZED PANEL","IRRIGANDO":"IRRIGATING","MOVENDO A SECO":"DRY MOVING","IRRIGACAO FINALIZADA":"IRRIGATION COMPLETE","PAINEL DESLIGADO":"PANEL OFF","PREPARANDO PARA RELIGAR":"PREPARING TO RESTART","ALERTA":"PIVOT ALERT","PIVO DESLIGADO / SEM INTERNET":"PIVOT OFF / NO INTERNET","FERTI IRRIGANDO":"FERTIGATING"};
                    const raw = resolvedStatus?.statusText || "PAINEL ENERGIZADO";
                    // Só traduz quando o idioma ativo é inglês (antes aparecia "ENERGIZED PANEL" em pt-BR)
                    const isEn = !!window.IcI18n?.isEnglish?.();
                    statusText.textContent = isEn ? (_stEn[String(raw).trim().toUpperCase()] || raw) : raw;
                }

                // Ícone "Central Online" some quando o LineStar está sem internet
                const statusPower = $("linestarStatusPower");
                if (statusPower) statusPower.style.display = resolvedStatus?.statusClass === "is-neutral" ? "none" : "";
            }

            window.Pivos?.views?.charts?.renderLinearCharts(selectedId);
            window.Pivos?.views?.charts?.renderWaterChart(selectedId);
            window.Plv?.period?.syncUI?.();
            this.renderEngineKpis();
        },

        // KPIs e card de falhas a partir do histórico fictício único
        renderEngineKpis() {
            const DH = window.IcDemoHistory;
            if (!DH || !selectedId || !DH.findEquipment(selectedId)) return;
            const cur = DH.pivot.current(selectedId);
            const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
            const simPos = window.IcPivotSimulationRuntime?.states?.[selectedId]?.progress;
            set("kpiLinPosVal", `${Math.round(Number.isFinite(simPos) ? simPos : (cur.angle / 360) * 100)}%`);
            set("kpiLinPressaoVal", `${cur.pressureCenter.toFixed(1)} bar`);
            set("kpiLinHorasVal", `${Math.round(cur.hours)}h`);
            const last = cur.lastOp;
            const speed = last ? (cur.model.length * last.lap) / Math.max(0.1, last.durH) : 0;
            set("kpiLinVelVal", `${speed.toFixed(1)} m/h`);
            const footer = $("linestarLastUpdate");
            if (footer) footer.innerHTML = `<span class="comm-label">Última comunicação:</span> ${DH.fmt.dateTime(cur.lastCommunication)}`;
            const range = DH.periodFrom(window.Plv?.state?.period, 7);
            const sum = DH.pivot.summary(selectedId, range.start, range.end);
            const fv = (k, v) => { const el = document.querySelector(`#linestarPanel .pivo-faults [data-fault="${k}"] .pivo-faults__value`); if (el) el.textContent = v; };
            fv("pressure", String(sum.faults.pressure));
            fv("misalignment", String(sum.faults.misalignment));
            fv("voltage_low", String(sum.faults.lowVoltage));
            fv("voltage_peak", String(sum.faults.peakVoltage));
            fv("irrigation_accumulated", `${Math.round(sum.relLaminaMm)} mm`);
        },

        drawPivotMinimap(equip, map, bounds, isCurrent) {
            const data = equip.data || {};
            if (equip.type === "linestar") {
                const ptA = { lat: parseFloat(data.latA), lng: parseFloat(data.lngA) };
                const ptB = { lat: parseFloat(data.latB), lng: parseFloat(data.lngB) };
                if (isNaN(ptA.lat) || isNaN(ptB.lat)) return;

                bounds.extend([[ptA.lat, ptA.lng], [ptB.lat, ptB.lng]]);

                const { widthA, widthB } = getLineStarWidths(data, 300);
                const width = widthA + widthB;
                const brng = bearingRad(ptA, ptB);
                const offsetPerp = (origin, meters, side) => destinationPoint(origin, meters, brng + (side * Math.PI / 2));

                // --- Resolve status-based visuals (mirrors getLineStarVisuals in mapa.js) ---
                const STATUS_PROGRESS_SET = new Set(["irrigando", "movendo_a_seco", "ferti_irrigando"]);
                const resolvedStatus = window.IcResolvePivotStatus?.(equip) || null;
                const simProgress = window.IcPivotSimulationRuntime?.states?.[equip.id]?.progress ?? 0;
                let visual;
                if (resolvedStatus?.visual) {
                    const statusKey = String(resolvedStatus.key || "");
                    const hasProgress = STATUS_PROGRESS_SET.has(statusKey);
                    visual = {
                        statusKey,
                        fill: resolvedStatus.visual.fill,
                        stroke: resolvedStatus.visual.stroke,
                        outline: resolvedStatus.visual.outline || resolvedStatus.visual.stroke,
                        fillOpacity: Math.max(0.38, Math.min(0.74, (resolvedStatus.visual.fillOpacity ?? 0.82) * 0.82)),
                        progressFill: resolvedStatus.visual.outerFill || resolvedStatus.visual.stroke,
                        lineProgress: hasProgress ? Math.max(0, Math.min(100, simProgress)) : 0,
                    };
                } else {
                    visual = {
                        statusKey: "",
                        fill: "#bcac24",
                        stroke: "#edb320",
                        outline: "#edb320",
                        fillOpacity: 0.82,
                        progressFill: "#edb320",
                        lineProgress: 0,
                    };
                }

                const isFinished = visual.statusKey === "irrigacao_finalizada";
                const outerStrokeColor = isFinished ? (visual.progressFill || visual.stroke) : visual.outline;
                const outerStrokeWeight = isFinished ? 6.2 : 2.5;
                const innerStrokeWeight = isFinished ? 6.4 : 2;
                const outerStrokeOpacity = isFinished ? 0.96 : 0.85;
                const progressRatio = visual.lineProgress / 100;
                const progressPoint = progressRatio > 0 ? interpolatePoint(ptA, ptB, progressRatio) : null;

                if (width > 0) {
                    const aLeft  = offsetPerp(ptA, widthA, -1);
                    const aRight = offsetPerp(ptA, widthB, 1);
                    const bLeft  = offsetPerp(ptB, widthA, -1);
                    const bRight = offsetPerp(ptB, widthB, 1);

                    // Outer border
                    L.polygon(
                        [[aLeft.lat, aLeft.lng], [bLeft.lat, bLeft.lng],
                         [bRight.lat, bRight.lng], [aRight.lat, aRight.lng]],
                        { color: outerStrokeColor, weight: outerStrokeWeight, opacity: outerStrokeOpacity, fillOpacity: 0, interactive: false }
                    ).addTo(map);

                    // Corridor fill
                    L.polygon(
                        [[aLeft.lat, aLeft.lng], [bLeft.lat, bLeft.lng],
                         [bRight.lat, bRight.lng], [aRight.lat, aRight.lng]],
                        {
                            color: isFinished ? outerStrokeColor : visual.stroke,
                            weight: innerStrokeWeight,
                            opacity: isFinished ? 0.9 : 0.75,
                            fillColor: visual.fill,
                            fillOpacity: visual.fillOpacity,
                            interactive: false
                        }
                    ).addTo(map);

                    // Progress overlay
                    if (progressPoint) {
                        const pLeft  = offsetPerp(progressPoint, widthA, -1);
                        const pRight = offsetPerp(progressPoint, widthB, 1);
                        L.polygon(
                            [[aLeft.lat, aLeft.lng], [pLeft.lat, pLeft.lng],
                             [pRight.lat, pRight.lng], [aRight.lat, aRight.lng]],
                            {
                                color: visual.stroke,
                                weight: 0,
                                fillColor: visual.progressFill,
                                fillOpacity: Math.min(0.5, visual.fillOpacity + 0.14),
                                interactive: false,
                            }
                        ).addTo(map);
                    }
                }

                // Barra (Equipamento) — use real progress position when moving, else center
                const barRatio = progressRatio > 0 ? progressRatio : (isCurrent ? 0.45 : 0.5);
                const anchorPoint = interpolatePoint(ptA, ptB, barRatio);

                if (width > 0 && anchorPoint) {
                    const crossLeft  = offsetPerp(anchorPoint, widthA, -1);
                    const crossRight = offsetPerp(anchorPoint, widthB, 1);

                    // Outline da barra
                    L.polyline(
                        [[crossLeft.lat, crossLeft.lng], [crossRight.lat, crossRight.lng]],
                        { color: "#000000", weight: 4.2, opacity: 0.35, interactive: false }
                    ).addTo(map);

                    // Barra Branca Sólida
                    L.polyline(
                        [[crossLeft.lat, crossLeft.lng], [crossRight.lat, crossRight.lng]],
                        { color: "#ffffff", weight: 2.5, opacity: 1, interactive: false }
                    ).addTo(map);

                    // Triângulo de direção — only when actively progressing
                    if (STATUS_PROGRESS_SET.has(visual.statusKey) && !isFinished && progressRatio < 0.96) {
                        const triHeight   = width * 0.22;
                        const triHalfBase = width * 0.12;
                        const tip   = destinationPoint(anchorPoint, triHeight,    brng);
                        const base1 = destinationPoint(anchorPoint, triHalfBase,  brng - Math.PI / 2);
                        const base2 = destinationPoint(anchorPoint, triHalfBase,  brng + Math.PI / 2);
                        L.polygon([[tip.lat, tip.lng], [base1.lat, base1.lng], [base2.lat, base2.lng]], {
                            color: "#000000", weight: 1.2, opacity: 0.25,
                            fillColor: "#ffffff", fillOpacity: 0.95,
                            interactive: false
                        }).addTo(map);
                    }
                }

                // Marcador do lado dos acoplamentos
                if (width > 0) {
                    drawLineStarZeroAngleMarkers(map, { ptA, ptB, widthA, widthB }, { color: "#ffffff", opacity: 0.9, hoseSide: data.hoseSide || "A" });
                }
            }
        },

        initMinimap() {
            const mapEl = $("linestarMinimap");
            if (!mapEl) return;

            if (mapEl.offsetHeight === 0) {
                setTimeout(() => this.initMinimap(), 200);
                return;
            }

            if (minimapInstance) {
                try { minimapInstance.off(); minimapInstance.remove(); } catch (_) {}
                minimapInstance = null;
            }
            if (minimapHintTimer) { clearTimeout(minimapHintTimer); minimapHintTimer = null; }
            minimapZoomHint = null;

            if (mapEl._leaflet_id) delete mapEl._leaflet_id;
            mapEl.innerHTML = "";
            mapEl.className = "pincard__map";

            const farm = window.IcFarmGetActive?.() || window.IcFarmActive;
            const equip = farm?.equipments?.find(e => e.id === selectedId);
            const data  = equip?.data || {};

            const ptA = { lat: parseFloat(data.latA), lng: parseFloat(data.lngA) };
            const ptB = { lat: parseFloat(data.latB), lng: parseFloat(data.lngB) };
            const hasTrack = Number.isFinite(ptA.lat) && Number.isFinite(ptA.lng)
                          && Number.isFinite(ptB.lat) && Number.isFinite(ptB.lng);

            // Centro do mapa para setView inicial
            const centerLat = hasTrack ? (ptA.lat + ptB.lat) / 2 : -15.8;
            const centerLng = hasTrack ? (ptA.lng + ptB.lng) / 2 : -47.9;

            try {
                minimapInstance = L.map(mapEl, {
                    zoomControl: false,
                    attributionControl: false,
                    dragging: false,
                    scrollWheelZoom: false,
                    doubleClickZoom: false,
                    boxZoom: false,
                    touchZoom: false,
                    keyboard: false,
                    tap: false,
                    zoomSnap: 0,
                });

                minimapInstance.scrollWheelZoom.disable();
                bindMinimapWheelControls();
                ensureMinimapWheelHint(mapEl);

                L.tileLayer(
                    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                    { maxZoom: 19 }
                ).addTo(minimapInstance);

                mapEl.addEventListener("wheel", (event) => {
                    if (minimapWheelMode === "ctrl" && !event.ctrlKey) showMinimapWheelHint();
                }, { passive: true });

                // Define view inicial antes de desenhar (obrigatório para camadas vetoriais)
                minimapInstance.setView([centerLat, centerLng], 14);

                if (hasTrack) {
                    const { widthA, widthB } = getLineStarWidths(data, 300);
                    const width  = widthA + widthB;
                    const brng   = bearingRad(ptA, ptB);
                    const off    = (origin, m, side) => destinationPoint(origin, m, brng + side * Math.PI / 2);
                    const interp = (t) => ({ lat: ptA.lat + (ptB.lat - ptA.lat) * t,
                                             lng: ptA.lng + (ptB.lng - ptA.lng) * t });

                    const resolvedStatus = window.IcResolvePivotStatus?.(equip) || null;
                    const simProgress    = window.IcPivotSimulationRuntime?.states?.[equip.id]?.progress ?? 0;
                    const STATUS_MOVING  = new Set(["irrigando", "movendo_a_seco", "ferti_irrigando"]);

                    let fill, stroke, fillOpacity, progressFill, statusKey, lineProgress;
                    if (resolvedStatus?.visual) {
                        statusKey    = String(resolvedStatus.key || "");
                        fill         = resolvedStatus.visual.fill;
                        stroke       = resolvedStatus.visual.stroke;
                        fillOpacity  = Math.max(0.38, Math.min(0.74, (resolvedStatus.visual.fillOpacity ?? 0.82) * 0.82));
                        progressFill = resolvedStatus.visual.outerFill || stroke;
                        lineProgress = STATUS_MOVING.has(statusKey) ? Math.max(0, Math.min(100, simProgress)) : 0;
                    } else {
                        statusKey    = "";
                        fill         = "#bcac24";
                        stroke       = "#edb320";
                        fillOpacity  = 0.72;
                        progressFill = "#edb320";
                        lineProgress = 0;
                    }

                    const isFinished     = statusKey === "irrigacao_finalizada";
                    const progressRatio  = lineProgress / 100;
                    const progressPoint  = progressRatio > 0 ? interp(progressRatio) : null;
                    const outlineColor   = isFinished ? progressFill : stroke;

                    if (width > 0) {
                        const aL = off(ptA, widthA, -1), aR = off(ptA, widthB, 1);
                        const bL = off(ptB, widthA, -1), bR = off(ptB, widthB, 1);
                        const toLL = p => [p.lat, p.lng];
                        const corners = [aL, bL, bR, aR].map(toLL);

                        // Borda externa
                        L.polygon(corners, {
                            color: outlineColor, weight: isFinished ? 6.2 : 2.5,
                            opacity: 0.85, fillOpacity: 0, interactive: false
                        }).addTo(minimapInstance);

                        // Corredor preenchido
                        L.polygon(corners, {
                            color: stroke, weight: 2,
                            fillColor: fill, fillOpacity,
                            interactive: false
                        }).addTo(minimapInstance);

                        // Overlay de progresso
                        if (progressPoint) {
                            const pL = off(progressPoint, widthA, -1);
                            const pR = off(progressPoint, widthB, 1);
                            L.polygon([aL, pL, pR, aR].map(toLL), {
                                color: stroke, weight: 0,
                                fillColor: progressFill,
                                fillOpacity: Math.min(0.5, fillOpacity + 0.14),
                                interactive: false
                            }).addTo(minimapInstance);
                        }

                        // Barra do equipamento
                        const barRatio  = progressRatio > 0 ? progressRatio : 0.5;
                        const barAnchor = interp(barRatio);
                        const cL = off(barAnchor, widthA, -1);
                        const cR = off(barAnchor, widthB, 1);
                        L.polyline([[cL.lat, cL.lng], [cR.lat, cR.lng]],
                            { color: "#000", weight: 4.2, opacity: 0.35, interactive: false }
                        ).addTo(minimapInstance);
                        L.polyline([[cL.lat, cL.lng], [cR.lat, cR.lng]],
                            { color: "#fff", weight: 2.5, opacity: 1, interactive: false }
                        ).addTo(minimapInstance);


                        // fitBounds depois das shapes, sem animação
                        const zeroRaw = parseFloat(data.zeroAngle);
                        const zeroRatio = Number.isFinite(zeroRaw) ? Math.max(0, Math.min(100, zeroRaw)) / 100 : 0.08;
                        drawLineStarZeroAngleMarkers(minimapInstance, { ptA, ptB, widthA, widthB }, {
                            color: "#ffffff",
                            opacity: 0.96,
                            markerRatio: zeroRatio
                        });
                        const fg = L.featureGroup([L.polygon(corners)]);
                        minimapInstance.fitBounds(fg.getBounds(), { padding: [24, 24], animate: false });
                    }
                }
            } catch (err) {
                console.error("[linestar minimap] Falha ao inicializar mapa:", err);
            }

            requestAnimationFrame(() => {
                minimapInstance?.invalidateSize({ pan: false });
            });
            setTimeout(() => {
                minimapInstance?.invalidateSize({ pan: false });
            }, 180);
        },

        close() {
            document.body.classList.remove("is-pivo-details");
            const slot = document.getElementById("pageSlot");
            if (slot) slot.innerHTML = "";

            if (minimapInstance) {
                minimapInstance.remove();
                minimapInstance = null;
            }
            if (selectorOutsideClickHandler) {
                document.removeEventListener("click", selectorOutsideClickHandler);
                selectorOutsideClickHandler = null;
            }
            if (filterOutsideClickHandler) {
                document.removeEventListener("click", filterOutsideClickHandler);
                filterOutsideClickHandler = null;
            }
            if (minimapHintTimer) {
                clearTimeout(minimapHintTimer);
                minimapHintTimer = null;
            }
            minimapZoomHint = null;
            
            if (window.icMapSetWheelMode) {
                window.icMapSetWheelMode("free");
            }

            const map = window.icMap;
            if (map) map.invalidateSize();
            
            window.dispatchEvent(new Event("ic:layout-change"));
        }
    };
})();
