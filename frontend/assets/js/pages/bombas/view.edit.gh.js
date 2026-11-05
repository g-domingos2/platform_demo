// assets/js/pages/bombas/view.edit.gh.js
// Cópia de view.edit.js específica para bombas IrriPump versão 5.2 (GH).
// Ajustar aqui as diferenças do modelo GH sem afetar o fluxo normal de bombas.
(function () {
    "use strict";

    const Bmb = (window.BmbGh = window.BmbGh || {});
    const state = (Bmb.state = Bmb.state || {});
    const views = (Bmb.views = Bmb.views || {});
    const editView = (views.edit = views.edit || {});
    const $ = (id) => document.getElementById(id);

    let locationMapInstance = null;
    let locationMarker = null;
    let editEventsBound = false;

    // ─── Helpers ────────────────────────────────────────────────────────────────

    // getActiveFarmSafe compartilhado — ver assets/js/core/farm-utils.js
    const { getActiveFarmSafe } = window.IcFarm;

    function getBombasList() {
        // Lista TODAS as bombas (normais + GH) — o seletor do topo precisa
        // mostrar as duas, pra poder trocar de tela ao selecionar uma de
        // outro tipo (ver renderBombaSelectorList).
        const farm = getActiveFarmSafe();
        const list = Array.isArray(farm?.equipments) ? farm.equipments : [];
        return list.filter((e) => {
            const type = String(e?.type || "").toLowerCase();
            const cat = String(e?.category || "").toLowerCase();
            return type === "irripump" || cat === "bombas";
        });
    }

    function getFocusBmb() {
        const list = getBombasList();
        if (!list.length) return null;
        if (state.detailsFocusId) {
            const found = list.find((m) => String(m.id) === String(state.detailsFocusId));
            if (found) return found;
        }
        // Sem id definido: prioriza uma bomba GH como padrão dessa tela
        const ghList = list.filter((e) => String(e?.data?.version || "") === "5.2");
        return ghList[0] || list[0];
    }

    function normalizeBmbData(equip) {
        if (!equip) return null;
        const data = equip?.data || {};
        return {
            id: equip.id,
            name: equip.name || data.nome || "",
            radioCentral: data.radioCentral || data.radio_central || "",
            radioBomba: data.radioBomba || data.radio_bomba || "",
            commType: data.commType || "XBEE",
            gateway: data.gateway || "",
            power: data.power ?? data.potencia ?? "",
            powerUnit: data.powerUnit ?? "cv",
            performance: data.performance ?? "",
            converted: data.converted ?? "",
            energyTime: data.energyTime ?? data.tempoEnergia ?? "",
            flow: data.flow ?? data.vazao ?? "",
            sensorScale: data.sensorScale ?? data.escala ?? "",
            volumePerPulse: data.volumePerPulse ?? data.volumePorPulso ?? "",
            volumePerPulseTechnical: data.volumePerPulseTechnical ?? null,
            orgao: data.orgao ?? "",
            identId: data.identId ?? data.idIdentificacao ?? "",
            // Default: limite de consumo habilitado com 5.500,00 m³ pra linha
            // tracejada do gráfico de consumo já aparecer preenchida.
            enableConsumptionLimit: data.enableConsumptionLimit ?? true,
            consumptionLimit: data.consumptionLimit ?? data.limiteConsumoMensal ?? 5500,
            lat: data.lat ?? null,
            lng: data.lng ?? null,
            peakDays: data.peakDays ?? {},
            peak1Enabled: data.peak1Enabled ?? false,
            peak1Start: data.peak1Start ?? "00:00",
            peak1End: data.peak1End ?? "00:00",
            peak2Enabled: data.peak2Enabled ?? false,
            peak2Start: data.peak2Start ?? "00:00",
            peak2End: data.peak2End ?? "00:00",
            medidorId: data.medidorId ?? "",
            levelOn: data.levelOn ?? "",
            levelOff: data.levelOff ?? "",
            updatedAt: equip.updatedAt || data.updated || "",
            offline: data.semComunicacao === true,
        };
    }

    // formatLastComm compartilhado — ver assets/js/core/equip-utils.js
    const { formatLastComm } = window.IcEquipUtils;

    // ─── Mount ──────────────────────────────────────────────────────────────────

    // positionBmbOverlay compartilhado — ver assets/js/core/overlay-utils.js
    const positionBmbOverlay = window.IcOverlay.positionOverlay;

    async function mountEditPanel(container) {
        const slot = container || $("pageSlot");
        if (!slot) return false;
        try {
            const html = await fetch("./pages/bomba-gh-edit.html").then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); });
            slot.innerHTML = html;
            bindEditUI();
            return true;
        } catch (err) {
            console.error("[bmbedit] Failed to load bomba-gh-edit.html", err);
            return false;
        }
    }

    function closeBmbEditOverlay() {
        editView._resizeObserver?.disconnect();
        editView._resizeObserver = null;
        const overlay = $("ghEditOverlay");
        if (overlay) {
            overlay.classList.remove("is-open");
            setTimeout(() => overlay.remove(), 320);
        }
    }

    // ─── Relógio do equipamento (GH): picker de data + hora customizado ─────────
    // Componente próprio (verde, no padrão .seg-datepicker já usado no sistema)
    // pra substituir o picker nativo do navegador, que não respeita accent-color
    // de forma confiável no popup de data/hora.
    const MONTH_NAMES_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    const WEEKDAYS_PT = ["D", "S", "T", "Q", "Q", "S", "S"];
    // Cabecalho do datepicker no idioma selecionado (eram tabelas fixas em portugues).
    const icLocale = () => window.IcI18n?.getLocale?.() || "pt-BR";
    const monthTitle = (m, y) =>
        new Date(y, m, 1).toLocaleDateString(icLocale(), { month: "long", year: "numeric" });
    const weekdayInitials = () =>
        Array.from({ length: 7 }, (_, i) =>
            new Date(2024, 8, 1 + i).toLocaleDateString(icLocale(), { weekday: "narrow" }).toUpperCase()
        );
    const clockPicker = { open: false, viewYear: 0, viewMonth: 0, day: null, hour: 9, minute: 0 };
    const pad2 = (n) => String(n).padStart(2, "0");

    function parseClockInputs() {
        const dateInput = $("ghEditClockDate");
        const timeInput = $("ghEditClockTime");
        const now = new Date();
        let day = null, year = now.getFullYear(), month = now.getMonth(), hour = 9, minute = 0;
        const dm = dateInput?.value?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (dm) { day = Number(dm[1]); month = Number(dm[2]) - 1; year = Number(dm[3]); }
        const tm = timeInput?.value?.match(/^(\d{2}):(\d{2})$/);
        if (tm) { hour = Number(tm[1]); minute = Number(tm[2]); }
        return { day, month, year, hour, minute };
    }

    function buildClockCalendarHtml() {
        const { viewYear, viewMonth, day } = clockPicker;
        const today = new Date();
        const startOffset = new Date(viewYear, viewMonth, 1).getDay();
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

        let cells = "";
        for (let i = 0; i < startOffset; i++) {
            cells += `<button type="button" class="seg-datepicker__day is-muted" disabled>${daysInPrevMonth - startOffset + 1 + i}</button>`;
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const isToday = viewYear === today.getFullYear() && viewMonth === today.getMonth() && d === today.getDate();
            const isSelected = day === d;
            cells += `<button type="button" class="seg-datepicker__day${isToday ? " is-today" : ""}${isSelected ? " is-selected" : ""}" data-day="${d}">${d}</button>`;
        }
        const trailing = (7 - ((startOffset + daysInMonth) % 7)) % 7;
        for (let d = 1; d <= trailing; d++) {
            cells += `<button type="button" class="seg-datepicker__day is-muted" disabled>${d}</button>`;
        }

        return `
            <div class="seg-datepicker__nav">
                <span class="seg-datepicker__title">${monthTitle(viewMonth, viewYear)}</span>
                <div>
                    <button type="button" data-nav="prev" aria-label="Mês anterior"><i class="fa-solid fa-chevron-up"></i></button>
                    <button type="button" data-nav="next" aria-label="Próximo mês"><i class="fa-solid fa-chevron-down"></i></button>
                </div>
            </div>
            <div class="seg-datepicker__weekdays">${weekdayInitials().map((w) => `<span>${w}</span>`).join("")}</div>
            <div class="seg-datepicker__grid">${cells}</div>
        `;
    }

    function buildClockTimeColHtml(kind) {
        const max = kind === "hour" ? 24 : 60;
        const selected = kind === "hour" ? clockPicker.hour : clockPicker.minute;
        let html = "";
        for (let i = 0; i < max; i++) {
            html += `<button type="button" class="seg-datepicker__time-item${i === selected ? " is-selected" : ""}" data-${kind}="${i}">${pad2(i)}</button>`;
        }
        return html;
    }

    function renderClockPicker() {
        const popup = $("ghEditClockPicker");
        if (!popup) return;
        popup.innerHTML = `
            <div class="seg-datepicker__body">
                <div class="seg-datepicker__calendar" id="ghClockCalendar">${buildClockCalendarHtml()}</div>
                <div class="seg-datepicker__time">
                    <div class="seg-datepicker__time-col" id="ghClockHourCol">${buildClockTimeColHtml("hour")}</div>
                    <div class="seg-datepicker__time-col" id="ghClockMinuteCol">${buildClockTimeColHtml("minute")}</div>
                </div>
            </div>
            <div class="seg-datepicker__footer seg-datepicker__footer--split">
                <div>
                    <button type="button" class="seg-datepicker__today-btn" data-action="clear">Limpar</button>
                    <button type="button" class="seg-datepicker__today-btn" data-action="now">Agora</button>
                </div>
                <button type="button" class="seg-datepicker__ok-btn" data-action="ok">OK</button>
            </div>
        `;
        popup.querySelector("#ghClockHourCol .is-selected")?.scrollIntoView({ block: "center" });
        popup.querySelector("#ghClockMinuteCol .is-selected")?.scrollIntoView({ block: "center" });
    }

    function handleClockPickerOutsideClick(e) {
        const popup = $("ghEditClockPicker");
        if (!popup) return;
        if (popup.contains(e.target) || e.target.closest(".gh-clock-btn") || e.target.closest("#ghEditClockDate, #ghEditClockTime")) return;
        closeClockPicker();
    }

    function openClockPicker() {
        const popup = $("ghEditClockPicker");
        if (!popup) return;
        const parsed = parseClockInputs();
        clockPicker.viewYear = parsed.year;
        clockPicker.viewMonth = parsed.month;
        clockPicker.day = parsed.day;
        clockPicker.hour = parsed.hour;
        clockPicker.minute = parsed.minute;
        clockPicker.open = true;
        renderClockPicker();
        popup.style.display = "block";
        setTimeout(() => document.addEventListener("click", handleClockPickerOutsideClick, true), 0);
    }

    function closeClockPicker() {
        const popup = $("ghEditClockPicker");
        if (popup) popup.style.display = "none";
        clockPicker.open = false;
        document.removeEventListener("click", handleClockPickerOutsideClick, true);
    }

    function applyClockPickerToInputs() {
        if (clockPicker.day == null) return;
        const dateInput = $("ghEditClockDate");
        const timeInput = $("ghEditClockTime");
        if (dateInput) dateInput.value = `${pad2(clockPicker.day)}/${pad2(clockPicker.viewMonth + 1)}/${clockPicker.viewYear}`;
        if (timeInput) timeInput.value = `${pad2(clockPicker.hour)}:${pad2(clockPicker.minute)}`;
    }

    // ─── Populate form ──────────────────────────────────────────────────────────

    function renderBombaForm() {
        const equip = getFocusBmb();
        const d = normalizeBmbData(equip);
        if (!d) return;

        // Selector label
        const selectBtn = $("ghEditSelectBtn");
        if (selectBtn) selectBtn.textContent = d.name || "—";

        // Last comm
        const lastCommHtml = `<span class="comm-label">Última comunicação:</span> ${formatLastComm(d.updatedAt)}`;
        const lastComm = $("ghEditLastComm");
        if (lastComm) lastComm.innerHTML = lastCommHtml;
        document.querySelectorAll("#ghEditPanel .bmb-last-comm-display").forEach(el => { el.innerHTML = lastCommHtml; });

        // Rádios
        const rc = $("ghEditRadioCentral");
        if (rc) rc.value = d.radioCentral || "—";

        const rb = $("ghEditRadioBomba");
        if (rb) rb.value = d.radioBomba || "0000000000000000";

        const dot = $("ghEditRadioDot");
        if (dot) {
            dot.style.background = "transparent";
            dot.style.color = d.offline ? "#ef4444" : "#22c55e";
            dot.title = d.offline ? "Offline" : "Online";
        }

        // Tipo de comunicação (Rádio/4G)
        const commTypeHidden = $("ghEditCommType");
        if (commTypeHidden) commTypeHidden.value = d.commType;
        const commTypeBtn = $("ghEditCommTypeBtn");
        const commTypeMenu = $("ghEditCommTypeMenu");
        if (commTypeBtn && commTypeMenu) {
            const opt = commTypeMenu.querySelector(`[data-value="${d.commType}"]`);
            commTypeBtn.textContent = opt?.textContent || "Rádio";
            commTypeMenu.querySelectorAll(".edit-panel__select-option").forEach(o => {
                o.classList.toggle("is-active", o.dataset.value === d.commType);
            });
        }
        const is4G = d.commType === "4G";
        const radioGrid = $("ghEditRadioGrid");
        const gatewayField = $("ghEditGatewayField");
        if (radioGrid) radioGrid.style.display = is4G ? "none" : "";
        if (gatewayField) gatewayField.style.display = is4G ? "" : "none";
        const gatewayInput = $("ghEditGateway");
        if (gatewayInput) gatewayInput.value = d.gateway || "";

        // Geral fields
        const set = (id, val) => { const el = $(id); if (el) el.value = val ?? ""; };
        set("ghEditName", d.name);
        // Potência sempre em kW; usa o valor já convertido quando existir
        // (registros antigos salvos em CV) e cai para "power" nos mais recentes.
        set("ghEditPower", d.converted || d.power);
        set("ghEditEnergyTime", d.energyTime);
        set("ghEditFlow", d.flow);
        set("ghEditSensorScale", d.sensorScale);
        set("ghEditVolumePerPulse", d.volumePerPulse);
        set("ghEditIdentId", d.identId);

        // Volume por pulso warning
        const volWarn = $("ghEditVolumeWarn");
        if (volWarn && d.volumePerPulseTechnical !== null && d.volumePerPulse !== d.volumePerPulseTechnical) {
            volWarn.style.display = "block";
        }

        // Órgão regulatório
        const orgaoInput = $("ghEditOrgao");
        if (orgaoInput) orgaoInput.value = d.orgao;
        const orgaoBtn = $("ghEditOrgaoBtn");
        if (orgaoBtn) {
            const menu = document.querySelector('[data-edit-menu="orgao"]');
            const opt = menu?.querySelector(`[data-value="${d.orgao}"]`);
            orgaoBtn.textContent = opt?.textContent || "Selecione...";
            menu?.querySelectorAll(".edit-panel__select-option").forEach(o => {
                o.classList.toggle("is-active", o.dataset.value === d.orgao);
            });
        }

        // Consumption limit
        const enableCheck = $("ghEditEnableConsumptionLimit");
        const limitInput = $("ghEditConsumptionLimit");
        if (enableCheck) enableCheck.checked = d.enableConsumptionLimit;
        if (limitInput) {
            limitInput.value = d.consumptionLimit;
            limitInput.disabled = !d.enableConsumptionLimit;
            limitInput.classList.toggle("is-disabled", !d.enableConsumptionLimit);
        }

        // Localização
        if (d.lat && d.lng) {
            const coordsInput = $("ghEditLocCoords");
            if (coordsInput) coordsInput.value = `${Number(d.lat).toFixed(6)}, ${Number(d.lng).toFixed(6)}`;
        }

        // Horários de pico - dias
        const days = { Dom: "Dom", Seg: "Seg", Ter: "Ter", Qua: "Qua", Qui: "Qui", Sex: "Sex", Sab: "Sab" };
        Object.entries(days).forEach(([key]) => {
            const el = $(`ghEditDay${key}`);
            if (el) el.checked = d.peakDays?.[key.toLowerCase()] ?? false;
        });

        // Peak 1
        const p1En = $("ghEditPeak1Enabled");
        if (p1En) p1En.checked = d.peak1Enabled;
        set("ghEditPeak1Start", d.peak1Start);
        set("ghEditPeak1End", d.peak1End);

        // Peak 2
        const p2En = $("ghEditPeak2Enabled");
        if (p2En) p2En.checked = d.peak2Enabled;
        set("ghEditPeak2Start", d.peak2Start);
        set("ghEditPeak2End", d.peak2End);

        // Medidor vinculado
        populateMedidorMenu(d.medidorId);

        // Limites medidor
        set("ghEditLevelOn", d.levelOn);
        set("ghEditLevelOff", d.levelOff);
        const thresh = $("ghEditMedidorThresholds");
        if (thresh) thresh.style.display = d.medidorId ? "block" : "none";
    }

    function populateMedidorMenu(selectedId) {
        const menu = $("ghEditMedidorMenu");
        const btn = $("ghEditMedidorBtn");
        if (!menu) return;

        const farm = getActiveFarmSafe();
        const medidores = (Array.isArray(farm?.equipments) ? farm.equipments : []).filter(e => {
            const cat = String(e?.category || "").toLowerCase();
            const type = String(e?.type || "").toLowerCase();
            return cat === "medidores" || type === "level_sensor" || type === "medidor";
        });

        menu.innerHTML = "";
        const noneOpt = document.createElement("button");
        noneOpt.type = "button";
        noneOpt.className = "edit-panel__select-option" + (!selectedId ? " is-active" : "");
        noneOpt.dataset.value = "";
        noneOpt.textContent = "Nenhum";
        menu.appendChild(noneOpt);

        medidores.forEach(m => {
            const opt = document.createElement("button");
            opt.type = "button";
            opt.className = "edit-panel__select-option" + (String(m.id) === String(selectedId) ? " is-active" : "");
            opt.dataset.value = String(m.id);
            opt.textContent = m.name || m.nome || String(m.id);
            menu.appendChild(opt);
        });

        const active = menu.querySelector(".is-active");
        if (btn) btn.textContent = active?.textContent || "Nenhum";
    }

    function renderBombaSelectorList() {
        const menu = $("ghEditSelectMenu");
        if (!menu) return;

        const list = getBombasList();
        menu.innerHTML = "";

        list.forEach(b => {
            const opt = document.createElement("button");
            opt.type = "button";
            opt.className = "edit-panel__select-option" + (String(b.id) === String(state.detailsFocusId) ? " is-active" : "");
            opt.dataset.value = String(b.id);
            opt.textContent = b.name || b.nome || String(b.id);
            opt.addEventListener("click", () => {
                document.querySelectorAll(".edit-panel__select-field").forEach(f => f.classList.remove("is-open"));

                const isGhTarget = String(b?.data?.version || "") === "5.2";
                if (!isGhTarget) {
                    // Bomba normal selecionada: troca pra tela de edição normal
                    const normalEditView = window.Bmb?.views?.edit;
                    if (normalEditView && typeof normalEditView.showEditView === "function") {
                        if (window.Bmb) window.Bmb.state.detailsFocusId = b.id;
                        closeBmbEditOverlay();
                        normalEditView.showEditView();
                        return;
                    }
                }

                state.detailsFocusId = b.id;
                renderBombaSelectorList();
                renderBombaForm();
            });
            menu.appendChild(opt);
        });
    }

    // ─── Location map ───────────────────────────────────────────────────────────

    function renderLocationMap() {
        const mapEl = $("ghEditLocationMap");
        if (!mapEl) return;

        if (mapEl.offsetHeight === 0) {
            setTimeout(renderLocationMap, 300);
            return;
        }

        if (locationMapInstance) {
            try { locationMapInstance.off(); locationMapInstance.remove(); } catch (_) {}
            locationMapInstance = null;
            locationMarker = null;
        }

        mapEl.innerHTML = "";

        const coordsVal = $("ghEditLocCoords")?.value || "";
        let lat = -15.79, lng = -47.88, zoom = 4;
        if (coordsVal.includes(",")) {
            const [la, lo] = coordsVal.split(",").map(Number);
            if (Number.isFinite(la) && Number.isFinite(lo)) { lat = la; lng = lo; zoom = 16; }
        }

        locationMapInstance = L.map(mapEl, { zoomControl: true, attributionControl: false });
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 20 }).addTo(locationMapInstance);
        locationMapInstance.setView([lat, lng], zoom);

        const pumpIcon = L.divIcon({
            className: "",
            html: '<div style="color:#16a34a;font-size:28px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5));"><i class="fa-solid fa-location-dot"></i></div>',
            iconSize: [28, 28], iconAnchor: [14, 28],
        });
        locationMarker = L.marker([lat, lng], { icon: pumpIcon, draggable: true }).addTo(locationMapInstance);

        locationMarker.on("dragend", (e) => {
            const pos = e.target.getLatLng();
            const coordsInput = $("ghEditLocCoords");
            if (coordsInput) coordsInput.value = `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`;
        });

        setTimeout(() => locationMapInstance?.invalidateSize(), 150);
    }

    // ─── Bind UI ─────────────────────────────────────────────────────────────────

    function bindEditUI() {
        if (editEventsBound) return;
        editEventsBound = true;

        // Back button
        const backBtn = $("ghEditBack");
        if (backBtn && !backBtn.dataset.bound) {
            backBtn.dataset.bound = "1";
            backBtn.addEventListener("click", () => {
                editEventsBound = false;
                if (locationMapInstance) {
                    try { locationMapInstance.off(); locationMapInstance.remove(); } catch (_) {}
                    locationMapInstance = null;
                    locationMarker = null;
                }
                closeBmbEditOverlay();
                window.IcBombaDetails?.open?.({ BmbId: state.detailsFocusId });
            });
        }

        // Save button
        const saveBtn = $("ghEditSaveBtn");
        if (saveBtn && !saveBtn.dataset.bound) {
            saveBtn.dataset.bound = "1";
            saveBtn.addEventListener("click", () => {
                const payload = buildSavePayload();
                if (payload.error) {
                    alert(payload.error);
                    return;
                }

                // O botão nunca fica preso: a resposta ao clique é imediata
                // ("Salvo!") e a gravação de verdade roda depois, em segundo
                // plano — se falhar, avisa por notificação em vez de travar
                // o botão pra sempre (mesmo bug já corrigido no editar pivô).
                const originalHtml = saveBtn.innerHTML;
                saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Salvo!';
                setTimeout(() => {
                    const btn = $("ghEditSaveBtn");
                    if (btn) btn.innerHTML = originalHtml || '<i class="fa-solid fa-floppy-disk"></i> Salvar';
                }, 900);

                (async () => {
                    try {
                        const saved = await persistBombaPayload(payload);
                        if (!saved) {
                            window.IcNotify?.error?.("Não foi possível salvar a bomba.", 3000);
                            return;
                        }
                    } catch (err) {
                        console.error("[bmbedit-gh] Falha ao gravar a bomba.", err);
                        window.IcNotify?.error?.("Não foi possível salvar a bomba.", 3000);
                        return;
                    }

                    try {
                        renderBombaSelectorList();
                        renderBombaForm();
                    } catch (err) {
                        console.error("[bmbedit-gh] Falha ao atualizar a lista de bombas após salvar.", err);
                    }

                    try {
                        const activeFarm = getActiveFarmSafe();
                        if (activeFarm) {
                            window.CreateFarm?.view?.render?.renderEquipmentPanels?.(activeFarm);
                        }
                    } catch (err) {
                        console.error("[bmbedit-gh] Falha ao atualizar os painéis após salvar.", err);
                    }
                })();
            });
        }

        // Tabs
        const panel = $("ghEditPanel");
        if (panel) {
            panel.addEventListener("click", (e) => {
                // Tab switch
                const tab = e.target.closest(".edit-panel__tab");
                if (tab) {
                    const key = tab.dataset.tab;
                    panel.querySelectorAll(".edit-panel__tab").forEach(t => {
                        t.classList.toggle("is-active", t.dataset.tab === key);
                        t.setAttribute("aria-selected", String(t.dataset.tab === key));
                    });
                    panel.querySelectorAll(".edit-panel__tab-body").forEach(b => {
                        b.classList.toggle("is-active", b.dataset.tabBody === key);
                    });
                    // Activate first nav item of the newly active tab
                    const activeTabBody = panel.querySelector(`.edit-panel__tab-body[data-tab-body="${key}"]`);
                    if (activeTabBody) {
                        const firstNavItem = activeTabBody.querySelector(".edit-panel__nav-item");
                        if (firstNavItem) {
                            activeTabBody.querySelectorAll(".edit-panel__nav-item").forEach(n => n.classList.remove("is-active"));
                            firstNavItem.classList.add("is-active");
                            activeTabBody.querySelectorAll(".edit-panel__section").forEach(s => s.classList.remove("is-active"));
                            const target = firstNavItem.dataset.target;
                            if (target) activeTabBody.querySelector(target)?.classList.add("is-active");
                        }
                    }
                    return;
                }

                // Nav section
                const navItem = e.target.closest(".edit-panel__nav-item");
                if (navItem) {
                    const target = navItem.dataset.target;
                    panel.querySelectorAll(".edit-panel__nav-item").forEach(n => n.classList.remove("is-active"));
                    navItem.classList.add("is-active");
                    panel.querySelectorAll(".edit-panel__section").forEach(s => s.classList.remove("is-active"));
                    const section = panel.querySelector(target);
                    if (section) {
                        section.classList.add("is-active");
                        if (target === "#ghEditLocation") renderLocationMap();
                    }
                    return;
                }

                // Relógio do equipamento: abre o picker custom (verde) de data/hora
                const clockBtn = e.target.closest(".gh-clock-btn");
                const clockField = e.target.closest("#ghEditClockDate, #ghEditClockTime");
                if (clockBtn || clockField) {
                    const refId = clockBtn ? clockBtn.dataset.for : clockField.id;
                    const input = $(refId);
                    if (input && !input.disabled) openClockPicker();
                    return;
                }

                // Navegação de mês dentro do picker
                const clockNav = e.target.closest("#ghEditClockPicker [data-nav]");
                if (clockNav) {
                    if (clockNav.dataset.nav === "prev") {
                        clockPicker.viewMonth -= 1;
                        if (clockPicker.viewMonth < 0) { clockPicker.viewMonth = 11; clockPicker.viewYear -= 1; }
                    } else {
                        clockPicker.viewMonth += 1;
                        if (clockPicker.viewMonth > 11) { clockPicker.viewMonth = 0; clockPicker.viewYear += 1; }
                    }
                    renderClockPicker();
                    return;
                }

                // Seleção de dia
                const clockDay = e.target.closest("#ghEditClockPicker [data-day]");
                if (clockDay) {
                    clockPicker.day = Number(clockDay.dataset.day);
                    $("ghEditClockPicker").querySelectorAll("[data-day]").forEach((btn) => {
                        btn.classList.toggle("is-selected", btn === clockDay);
                    });
                    return;
                }

                // Seleção de hora
                const clockHour = e.target.closest("#ghClockHourCol [data-hour]");
                if (clockHour) {
                    clockPicker.hour = Number(clockHour.dataset.hour);
                    $("ghClockHourCol").querySelectorAll("[data-hour]").forEach((btn) => {
                        btn.classList.toggle("is-selected", btn === clockHour);
                    });
                    return;
                }

                // Seleção de minuto
                const clockMinute = e.target.closest("#ghClockMinuteCol [data-minute]");
                if (clockMinute) {
                    clockPicker.minute = Number(clockMinute.dataset.minute);
                    $("ghClockMinuteCol").querySelectorAll("[data-minute]").forEach((btn) => {
                        btn.classList.toggle("is-selected", btn === clockMinute);
                    });
                    return;
                }

                // Ações do rodapé (Limpar / Agora / OK)
                const clockAction = e.target.closest("#ghEditClockPicker [data-action]");
                if (clockAction) {
                    const action = clockAction.dataset.action;
                    if (action === "clear") {
                        clockPicker.day = null;
                        clockPicker.hour = 9;
                        clockPicker.minute = 0;
                        const dateInput = $("ghEditClockDate");
                        const timeInput = $("ghEditClockTime");
                        if (dateInput) dateInput.value = "";
                        if (timeInput) timeInput.value = "";
                        renderClockPicker();
                    } else if (action === "now") {
                        const now = new Date();
                        clockPicker.viewYear = now.getFullYear();
                        clockPicker.viewMonth = now.getMonth();
                        clockPicker.day = now.getDate();
                        clockPicker.hour = now.getHours();
                        clockPicker.minute = now.getMinutes();
                        renderClockPicker();
                    } else if (action === "ok") {
                        applyClockPickerToInputs();
                        closeClockPicker();
                    }
                    return;
                }

                // Inline select dropdowns
                const selectBtn = e.target.closest("[data-edit-select]");
                if (selectBtn) {
                    if (selectBtn.disabled) return;
                    const field = selectBtn.closest(".edit-panel__select-field");
                    const wasOpen = field?.classList.contains("is-open");
                    panel.querySelectorAll(".edit-panel__select-field.is-open").forEach(f => f.classList.remove("is-open"));
                    if (field && !wasOpen) field.classList.add("is-open");
                    return;
                }

                const selectOpt = e.target.closest("[data-edit-menu] .edit-panel__select-option");
                if (selectOpt) {
                    const menu = selectOpt.closest("[data-edit-menu]");
                    const menuKey = menu?.dataset.editMenu;
                    const val = selectOpt.dataset.value;
                    const field = selectOpt.closest(".edit-panel__select-field");

                    menu?.querySelectorAll(".edit-panel__select-option").forEach(o => o.classList.remove("is-active"));
                    selectOpt.classList.add("is-active");

                    const triggerBtn = field?.querySelector("[data-edit-select]");
                    if (triggerBtn) triggerBtn.textContent = selectOpt.textContent;
                    field?.classList.remove("is-open");

                    if (menuKey === "orgao") {
                        const hidden = $("ghEditOrgao");
                        if (hidden) hidden.value = val;
                    }
                    if (menuKey === "medidor") {
                        const hidden = $("ghEditMedidorId");
                        if (hidden) hidden.value = val;
                        const thresh = $("ghEditMedidorThresholds");
                        if (thresh) thresh.style.display = val ? "block" : "none";
                    }
                    if (menuKey === "clockmode") {
                        const hidden = $("ghEditClockModeValue");
                        if (hidden) hidden.value = val;
                        const isManual = val === "manual";
                        const dateInput = $("ghEditClockDate");
                        const timeInput = $("ghEditClockTime");
                        closeClockPicker();
                        [dateInput, timeInput].forEach((input) => {
                            if (!input) return;
                            input.disabled = !isManual;
                        });
                        if (isManual && dateInput && timeInput && !dateInput.dataset.manualValueSet) {
                            // Pré-preenche com o horário atual pra facilitar o ajuste manual
                            const now = new Date();
                            dateInput.value = `${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear()}`;
                            timeInput.value = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
                            dateInput.dataset.manualValueSet = "true";
                        }
                        if (!isManual && dateInput) delete dateInput.dataset.manualValueSet;
                    }
                    if (menuKey === "commtype") {
                        const hidden = $("ghEditCommType");
                        if (hidden) hidden.value = val;
                        const is4G = val === "4G";
                        const radioGrid = $("ghEditRadioGrid");
                        const gatewayField = $("ghEditGatewayField");
                        if (radioGrid) radioGrid.style.display = is4G ? "none" : "";
                        if (gatewayField) gatewayField.style.display = is4G ? "" : "none";
                    }
                    return;
                }

                // Selector dropdown (bomba switcher)
                const selectorTrigger = e.target.closest("#ghEditSelectBtn");
                if (selectorTrigger) {
                    const field = selectorTrigger.closest(".edit-panel__select-field");
                    field?.classList.toggle("is-open");
                    return;
                }

                // History expand/collapse
                const expandBtn = e.target.closest("[data-toggle-details]");
                if (expandBtn) {
                    const rowId = expandBtn.dataset.toggleDetails;
                    const detailsRow = document.getElementById(`details-${rowId}`);
                    if (detailsRow) {
                        const isOpen = detailsRow.style.display !== "none";
                        detailsRow.style.display = isOpen ? "none" : "table-row";
                        const icon = expandBtn.querySelector("i");
                        if (icon) {
                            icon.className = isOpen ? "fa-solid fa-plus" : "fa-solid fa-minus";
                        }
                    }
                    return;
                }

                // History filter buttons
                const filterBtn = e.target.closest("[data-filter]");
                if (filterBtn) {
                    const filter = filterBtn.dataset.filter;
                    const targetSection = filter === "favs" ? "#ghEditHistoryFavs" : "#ghEditHistoryList";
                    panel.querySelectorAll(".edit-panel__nav-item").forEach(n => n.classList.remove("is-active"));
                    panel.querySelector(`[data-target="${targetSection}"]`)?.classList.add("is-active");
                    panel.querySelectorAll(".edit-panel__section").forEach(s => s.classList.remove("is-active"));
                    panel.querySelector(targetSection)?.classList.add("is-active");
                    return;
                }

                // Close open dropdowns on outside click handled below
            });

            // Close selects on outside click
            document.addEventListener("click", (e) => {
                if (!e.target.closest(".edit-panel__select-field")) {
                    panel.querySelectorAll(".edit-panel__select-field.is-open").forEach(f => f.classList.remove("is-open"));
                }
            });
        }

        // Consumption limit checkbox
        const enableCheck = $("ghEditEnableConsumptionLimit");
        const limitInput = $("ghEditConsumptionLimit");
        if (enableCheck && limitInput) {
            enableCheck.addEventListener("change", () => {
                const enabled = enableCheck.checked;
                limitInput.disabled = !enabled;
                limitInput.classList.toggle("is-disabled", !enabled);
                if (!enabled) limitInput.value = "";
            });
        }

        // Peak hours toggles
        [["ghEditPeak1Enabled", "ghPeak1Container"], ["ghEditPeak2Enabled", "ghPeak2Container"]].forEach(([toggleId, containerId]) => {
            const toggle = $(toggleId);
            const container = $(containerId);
            if (!toggle || !container) return;
            const inputs = container.querySelectorAll('.sc-input');
            const reqs = container.querySelectorAll('.edit-panel__req');
            const handleToggle = () => {
                const isEnabled = toggle.checked;
                container.classList.toggle('is-disabled', !isEnabled);
                inputs.forEach(input => { input.disabled = !isEnabled; });
                reqs.forEach(req => req.style.opacity = isEnabled ? '' : '0.4');
            };
            toggle.addEventListener('change', handleToggle);
            handleToggle();
        });

        // Clear buttons
        document.querySelectorAll("#ghEditPanel .edit-panel__input-actions button[aria-label='Limpar campo']").forEach(btn => {
            btn.addEventListener("click", () => {
                const input = btn.closest(".edit-panel__input-wrap")?.querySelector("input");
                if (input) input.value = "";
            });
        });

        // GPS location button
        const gpsBtn = $("ghEditLocGpsBtn");
        if (gpsBtn && !gpsBtn.dataset.bound) {
            gpsBtn.dataset.bound = "1";
            gpsBtn.addEventListener("click", () => {
                if (!navigator.geolocation) return;
                navigator.geolocation.getCurrentPosition((pos) => {
                    const { latitude: lat, longitude: lng } = pos.coords;
                    const coordsInput = $("ghEditLocCoords");
                    if (coordsInput) coordsInput.value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                    if (locationMapInstance) {
                        locationMapInstance.setView([lat, lng], 16);
                        if (locationMarker) locationMarker.setLatLng([lat, lng]);
                    }
                });
            });
        }
    }

    // ─── Save payload ────────────────────────────────────────────────────────────

    function buildSavePayload() {
        const name = $("ghEditName")?.value?.trim();
        if (!name) return { error: "Informe o nome da bomba." };

        const coordsStr = $("ghEditLocCoords")?.value || "";
        let lat = null, lng = null;
        if (coordsStr.includes(",")) {
            const [la, lo] = coordsStr.split(",").map(Number);
            if (Number.isFinite(la) && Number.isFinite(lo)) { lat = la; lng = lo; }
        }

        const equip = getFocusBmb();
        const farm = getActiveFarmSafe();
        return {
            id: state.detailsFocusId || equip?.id,
            farmId: farm?.id || "",
            name,
            radioBomba: $("ghEditRadioBomba")?.value?.trim() || "",
            commType: $("ghEditCommType")?.value || "XBEE",
            gateway: $("ghEditGateway")?.value?.trim() || "",
            power: window.IcNumeric.readNumber("ghEditPower", 0),
            powerUnit: "kw",
            energyTime: window.IcNumeric.readNumber("ghEditEnergyTime", 0),
            flow: window.IcNumeric.readNumber("ghEditFlow", 0),
            sensorScale: window.IcNumeric.readNumber("ghEditSensorScale", 0),
            volumePerPulse: window.IcNumeric.readNumber("ghEditVolumePerPulse", 0),
            orgao: $("ghEditOrgao")?.value || "",
            identId: $("ghEditIdentId")?.value?.trim() || "",
            enableConsumptionLimit: $("ghEditEnableConsumptionLimit")?.checked ?? false,
            consumptionLimit: window.IcNumeric.readNumber("ghEditConsumptionLimit", 0),
            lat,
            lng,
            peakDays: {
                dom: $("ghEditDayDom")?.checked ?? false,
                seg: $("ghEditDaySeg")?.checked ?? false,
                ter: $("ghEditDayTer")?.checked ?? false,
                qua: $("ghEditDayQua")?.checked ?? false,
                qui: $("ghEditDayQui")?.checked ?? false,
                sex: $("ghEditDaySex")?.checked ?? false,
                sab: $("ghEditDaySab")?.checked ?? false,
            },
            peak1Enabled: $("ghEditPeak1Enabled")?.checked ?? false,
            peak1Start: $("ghEditPeak1Start")?.value || "00:00",
            peak1End: $("ghEditPeak1End")?.value || "00:00",
            peak2Enabled: $("ghEditPeak2Enabled")?.checked ?? false,
            peak2Start: $("ghEditPeak2Start")?.value || "00:00",
            peak2End: $("ghEditPeak2End")?.value || "00:00",
            medidorId: $("ghEditMedidorId")?.value || "",
            levelOn: window.IcNumeric.readNumber("ghEditLevelOn", 0),
            levelOff: window.IcNumeric.readNumber("ghEditLevelOff", 100),
        };
    }

    async function persistBombaPayload(payload) {
        if (!payload?.farmId || !payload?.id) return false;
        if (typeof window.Cad?.data?.getAllFarms !== "function" || typeof window.Cad?.data?.persistFarmDataset !== "function") {
            return false;
        }

        const farms = window.Cad.data.getAllFarms();
        const farmIndex = farms.findIndex((farm) => String(farm?.id || "") === String(payload.farmId || ""));
        if (farmIndex < 0) return false;

        const targetFarm = { ...farms[farmIndex] };
        const equipments = (Array.isArray(targetFarm?.equipments) ? targetFarm.equipments : []).map((item) => ({
            ...item,
            data: item?.data && typeof item.data === "object" ? { ...item.data } : {}
        }));

        const equipIndex = equipments.findIndex((item) => String(item?.id || "") === String(payload.id || ""));
        if (equipIndex < 0) return false;

        const { id, farmId, name, ...data } = payload;
        equipments[equipIndex] = {
            ...equipments[equipIndex],
            name,
            data: { ...equipments[equipIndex].data, ...data, nome: name },
        };

        targetFarm.equipments = equipments;
        farms[farmIndex] = targetFarm;

        await window.Cad.data.persistFarmDataset(farms);
        window.CreateFarm?.setters?.setFarms?.(farms);
        return true;
    }

    // ─── Public API ──────────────────────────────────────────────────────────────

    async function showEditView() {
        let overlay = $("ghEditOverlay");
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.id = "ghEditOverlay";
            overlay.className = "config-overlay";
            overlay.style.zIndex = 1200 + document.querySelectorAll(".config-overlay").length;
            document.body.appendChild(overlay);
        }
        positionBmbOverlay(overlay);
        editView._resizeObserver?.disconnect();
        const mainEl = document.querySelector(".main");
        if (mainEl && typeof ResizeObserver === "function") {
            editView._resizeObserver = new ResizeObserver(() => positionBmbOverlay(overlay));
            editView._resizeObserver.observe(mainEl);
        }

        editEventsBound = false;
        const mounted = await mountEditPanel(overlay);
        if (!mounted) {
            editView._resizeObserver?.disconnect();
            overlay.remove();
            return;
        }

        renderBombaSelectorList();
        renderBombaForm();
        requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add("is-open")));
    }

    editView.showEditView = showEditView;
    editView.close = closeBmbEditOverlay;
})();
