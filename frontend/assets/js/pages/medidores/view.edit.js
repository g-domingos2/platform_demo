// assets/js/pages/medidores/view.edit.js
(function () {
    "use strict";

    const Mdn = (window.Mdn = window.Mdn || {});
    const state = (Mdn.state = Mdn.state || {});
    const views = (Mdn.views = Mdn.views || {});
    const editView = (views.edit = views.edit || {});
    const $ = (id) => document.getElementById(id);

    let locationMapInstance = null;
    let locationMarker = null;
    let editEventsBound = false;

    // ─── Helpers ─────────────────────────────────────────────────────────────────

    // getActiveFarmSafe compartilhado — ver assets/js/core/farm-utils.js
    const { getActiveFarmSafe } = window.IcFarm;

    function getMedidoresList() {
        const farm = getActiveFarmSafe();
        const list = Array.isArray(farm?.equipments) ? farm.equipments : [];
        return list.filter((e) => {
            const type = String(e?.type || "").toLowerCase();
            const cat = String(e?.category || "").toLowerCase();
            return type === "medidor" || type === "level_sensor" || cat === "medidores";
        });
    }

    function getBombasList() {
        const farm = getActiveFarmSafe();
        const list = Array.isArray(farm?.equipments) ? farm.equipments : [];
        return list.filter((e) => {
            const type = String(e?.type || "").toLowerCase();
            const version = String(e?.data?.version || "");
            // Só GH fala com GH: o Medidor de Nível GH (5.3) só vincula a
            // Irripumps GH (versão 5.2 do Irripump).
            return type === "irripump" && version === "5.2";
        });
    }

    function getFocusMdn() {
        const list = getMedidoresList();
        if (!list.length) return null;
        if (state.detailsFocusId) {
            return list.find((m) => String(m.id) === String(state.detailsFocusId)) || list[0];
        }
        return list[0];
    }

    // Chaves canônicas = as que o wizard grava (equipamentos/medidor.js):
    // nome/name, radio, version, sensor, coefA/B/C, loc/lat/lng,
    // radioImanage, nivelMax, nivelOffset, nivelValMin, nivelValMax, bombas.
    // Cada campo mantém fallback para os nomes antigos vistos em farms.json.
    function normalizeMdnData(equip) {
        if (!equip) return null;
        const data = equip?.data || {};
        return {
            id: equip.id,
            name: equip.name || data.name || data.nome || "",
            // sysName removido — usar 'name'
            radio: data.radio || data.radioDevice || data.radioMdn || "",
            version: data.version || data.versao || "5.2",
            radioCentral: data.radioCentral || data.radio_central || "",
            radioImanage: data.radioImanage || data.radio_imanage || "",
            sensor: data.sensor || "",
            coefA: data.coefA ?? data.a ?? "",
            coefB: data.coefB ?? data.b ?? "",
            coefC: data.coefC ?? data.c ?? "",
            lat: data.lat ?? null,
            lng: data.lng ?? null,
            maxLevel: data.nivelMax ?? data.nivelMaximo ?? data.maxLevel ?? "",
            offset: data.nivelOffset ?? data.offsetMedicao ?? data.offset ?? "",
            minVal: data.nivelValMin ?? data.valorMinimo ?? data.minVal ?? "",
            maxVal: data.nivelValMax ?? data.valorMaximo ?? data.maxVal ?? "",
            vazaoEnabled: data.vazaoEnabled ?? false,
            linkedBombas: Array.isArray(data.bombas) ? data.bombas
                : (Array.isArray(data.linkedBombas) ? data.linkedBombas : []),
            updatedAt: equip.updatedAt || data.updated || "",
            offline: data.semComunicacao === true,
        };
    }

    // formatLastComm compartilhado — ver assets/js/core/equip-utils.js
    const { formatLastComm } = window.IcEquipUtils;

    // ─── Mount ────────────────────────────────────────────────────────────────────

    // positionMdnOverlay compartilhado — ver assets/js/core/overlay-utils.js
    const positionMdnOverlay = window.IcOverlay.positionOverlay;

    async function mountEditPanel(container) {
        const slot = container || $("pageSlot");
        if (!slot) return false;
        try {
            const html = await fetch("./pages/medidor-edit.html").then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); });
            slot.innerHTML = html;
            bindEditUI();
            return true;
        } catch (err) {
            console.error("[mdnedit] Failed to load medidor-edit.html", err);
            return false;
        }
    }

    function closeMdnEditOverlay() {
        editView._resizeObserver?.disconnect();
        editView._resizeObserver = null;
        const overlay = $("mdnEditOverlay");
        if (overlay) {
            overlay.classList.remove("is-open");
            setTimeout(() => overlay.remove(), 320);
        }
    }

    // ─── Populate form ────────────────────────────────────────────────────────────

    function renderMdnForm() {
        const equip = getFocusMdn();
        const d = normalizeMdnData(equip);
        if (!d) return;

        const selectBtn = $("mdnEditSelectBtn");
        if (selectBtn) selectBtn.textContent = d.name || "—";

        const lastCommHtml = `<span class="comm-label">Última comunicação:</span> ${formatLastComm(d.updatedAt)}`;
        const lastComm = $("mdnEditLastComm");
        if (lastComm) lastComm.innerHTML = lastCommHtml;
        document.querySelectorAll("#mdnEditPanel .mdn-last-comm-display").forEach(el => { el.innerHTML = lastCommHtml; });

        const rc = $("mdnEditRadioCentral");
        if (rc) rc.value = d.radioCentral || "—";

        const dot = $("mdnEditRadioDot");
        if (dot) {
            dot.style.color = d.offline ? "#ef4444" : "#22c55e";
            dot.title = d.offline ? "Offline" : "Online";
        }

        // Versão travada (definida na criação). A 5.3 é a versão GH.
        const isGh = String(d.version) === "5.3";
        const verBtn = $("mdnEditVersaoBtn");
        if (verBtn) verBtn.textContent = isGh ? "5.3 (GH)" : "5.2";

        // Vínculo de bombas só existe no GH — só GH fala com GH.
        const bombasNav = document.querySelector('#mdnEditPanel [data-target="#mdnEditBombas"]');
        if (bombasNav) bombasNav.style.display = isGh ? "" : "none";
        if (!isGh) {
            const bombasSection = $("mdnEditBombas");
            if (bombasSection?.classList.contains("is-active")) {
                bombasSection.classList.remove("is-active");
                $("mdnEditGeneral")?.classList.add("is-active");
                document.querySelectorAll("#mdnEditPanel .edit-panel__tab-body[data-tab-body='config'] .edit-panel__nav-item").forEach(n => n.classList.remove("is-active"));
                document.querySelector('#mdnEditPanel [data-target="#mdnEditGeneral"]')?.classList.add("is-active");
            }
        }

        const set = (id, val) => { const el = $(id); if (el) el.value = val ?? ""; };
        // sysName removido — usar 'name'
        set("mdnEditName", d.name);
        set("mdnEditRadio", d.radio);
        set("mdnEditCoefA", d.coefA);
        set("mdnEditCoefB", d.coefB);
        set("mdnEditCoefC", d.coefC);
        set("mdnEditMaxLevel", d.maxLevel);
        set("mdnEditOffset", d.offset);
        set("mdnEditMinVal", d.minVal);
        set("mdnEditMaxVal", d.maxVal);

        // Toggle Vazão Residual
        const vazaoEnabled = !!(d.vazaoEnabled || (d.coefA || d.coefB || d.coefC));
        const vazaoToggle = $("mdnEditVazaoEnabled");
        const vazaoFields = $("mdnEditVazaoFields");
        if (vazaoToggle) vazaoToggle.checked = vazaoEnabled;
        if (vazaoFields) vazaoFields.style.display = vazaoEnabled ? "grid" : "none";

        // Selects customizados (sensor + versão): igual rótulo, hidden e is-active.
        const syncEditSelect = (key, value, fallbackLabel) => {
            const hidden = $(`mdnEdit${key}`);
            if (hidden) hidden.value = value ?? "";
            const menu = document.querySelector(`[data-edit-menu="${key.toLowerCase()}"]`);
            const btn = document.querySelector(`[data-edit-select="${key.toLowerCase()}"]`);
            const opt = menu?.querySelector(`[data-value="${value}"]`);
            if (btn) btn.textContent = opt?.textContent || value || fallbackLabel;
            menu?.querySelectorAll(".edit-panel__select-option").forEach(o => {
                o.classList.toggle("is-active", o.dataset.value === value);
            });
        };
        syncEditSelect("Sensor", d.sensor, "Selecione...");
        // Versão é somente-leitura no edit (botão desabilitado); só o hidden
        // precisa carregar o valor para o save. O rótulo é ajustado acima.
        const verHidden = $("mdnEditVersao");
        if (verHidden) verHidden.value = d.version || "5.2";

        // Localização
        if (d.lat && d.lng) {
            const coordsInput = $("mdnEditLocCoords");
            if (coordsInput) coordsInput.value = `${Number(d.lat).toFixed(6)}, ${Number(d.lng).toFixed(6)}`;
        }

        // Bombas vinculadas
        renderLinkedBombasList(d.linkedBombas);
        populateBombaMenu(d.linkedBombas);
    }

    function renderLinkedBombasList(linkedIds) {
        // Bombas vinculadas viram chips dentro do próprio campo de seleção
        const btn = $("mdnEditAddBombaBtn");
        const listContainer = $("mdnEditLinkedBombasList");
        if (listContainer) listContainer.innerHTML = "";
        if (!btn) return;

        const bombas = getBombasList();
        const linked = bombas.filter(b => linkedIds.includes(String(b.id)));

        if (!linked.length) {
            btn.textContent = "Por favor selecione";
            return;
        }

        const MAX_VISIBLE = 5;
        const visible = linked.slice(0, MAX_VISIBLE);
        const hidden = linked.slice(MAX_VISIBLE);
        const chips = visible.map(b => `
            <span class="farm-report__chip">
                <span class="farm-report__chip-label">${b.name || b.nome || String(b.id)}</span>
                <button type="button" data-unlink-bomba="${b.id}" title="Desvincular">&times;</button>
            </span>`).join("");
        const overflow = hidden.length
            ? `<span class="farm-report__chip farm-report__chip--count" title="${hidden.map(b => b.name || b.nome || String(b.id)).join(", ")}">+${hidden.length}</span>`
            : "";
        btn.innerHTML = `<span class="farm-report__chips">${chips}${overflow}</span>`;
    }

    function populateBombaMenu(linkedIds) {
        const menu = $("mdnEditBombaMenu");
        const btn = $("mdnEditAddBombaBtn");
        if (!menu) return;

        const bombas = getBombasList();
        const available = bombas.filter(b => !linkedIds.includes(String(b.id)));

        menu.innerHTML = "";
        if (!available.length) {
            const opt = document.createElement("button");
            opt.type = "button";
            opt.className = "edit-panel__select-option";
            opt.dataset.value = "";
            opt.textContent = "Nenhuma disponível";
            opt.disabled = true;
            menu.appendChild(opt);
            return;
        }

        available.forEach(b => {
            const opt = document.createElement("button");
            opt.type = "button";
            opt.className = "edit-panel__select-option";
            opt.dataset.value = String(b.id);
            opt.textContent = b.name || b.nome || String(b.id);
            menu.appendChild(opt);
        });
    }

    function renderMdnSelectorList() {
        const menu = $("mdnEditSelectMenu");
        if (!menu) return;

        const list = getMedidoresList();
        menu.innerHTML = "";
        list.forEach(m => {
            const opt = document.createElement("button");
            opt.type = "button";
            opt.className = "edit-panel__select-option" + (String(m.id) === String(state.detailsFocusId) ? " is-active" : "");
            opt.dataset.value = String(m.id);
            opt.textContent = m.name || m.nome || String(m.id);
            opt.addEventListener("click", () => {
                state.detailsFocusId = m.id;
                document.querySelectorAll(".edit-panel__select-field").forEach(f => f.classList.remove("is-open"));
                renderMdnSelectorList();
                renderMdnForm();
            });
            menu.appendChild(opt);
        });
    }

    // ─── Location map ─────────────────────────────────────────────────────────────

    function renderLocationMap() {
        const mapEl = $("mdnEditLocationMap");
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

        const coordsVal = $("mdnEditLocCoords")?.value || "";
        let lat = -15.79, lng = -47.88, zoom = 4;
        if (coordsVal.includes(",")) {
            const [la, lo] = coordsVal.split(",").map(Number);
            if (Number.isFinite(la) && Number.isFinite(lo)) { lat = la; lng = lo; zoom = 16; }
        }

        locationMapInstance = L.map(mapEl, { zoomControl: true, attributionControl: false });
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 20 }).addTo(locationMapInstance);
        locationMapInstance.setView([lat, lng], zoom);

        const icon = L.divIcon({
            className: "",
            html: '<div style="color:#16a34a;font-size:28px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5));"><i class="fa-solid fa-location-dot"></i></div>',
            iconSize: [28, 28], iconAnchor: [14, 28],
        });
        locationMarker = L.marker([lat, lng], { icon, draggable: true }).addTo(locationMapInstance);
        locationMarker.on("dragend", (e) => {
            const pos = e.target.getLatLng();
            const coordsInput = $("mdnEditLocCoords");
            if (coordsInput) coordsInput.value = `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`;
        });

        setTimeout(() => locationMapInstance?.invalidateSize(), 150);
    }

    // ─── Bind UI ──────────────────────────────────────────────────────────────────

    function bindEditUI() {
        if (editEventsBound) return;
        editEventsBound = true;

        const backBtn = $("mdnEditBack");
        if (backBtn && !backBtn.dataset.bound) {
            backBtn.dataset.bound = "1";
            backBtn.addEventListener("click", () => {
                editEventsBound = false;
                if (locationMapInstance) {
                    try { locationMapInstance.off(); locationMapInstance.remove(); } catch (_) {}
                    locationMapInstance = null;
                    locationMarker = null;
                }
                closeMdnEditOverlay();
                window.IcMdnDetails?.open?.({ mdnId: state.detailsFocusId });
            });
        }

        const saveBtn = $("mdnEditSaveBtn");
        if (saveBtn && !saveBtn.dataset.bound) {
            saveBtn.dataset.bound = "1";
            saveBtn.addEventListener("click", () => {
                const payload = buildSavePayload();
                if (payload.error) { alert(payload.error); return; }

                // O botão nunca fica preso: a resposta ao clique é imediata
                // ("Salvo!") e a gravação de verdade roda depois, em segundo
                // plano — se falhar, avisa por notificação em vez de travar
                // o botão pra sempre (mesmo padrão do editar pivô/bomba).
                const originalHtml = saveBtn.innerHTML;
                saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Salvo!';
                setTimeout(() => {
                    const btn = $("mdnEditSaveBtn");
                    if (btn) btn.innerHTML = originalHtml || '<i class="fa-solid fa-floppy-disk"></i> Salvar';
                }, 900);

                (async () => {
                    try {
                        const saved = await persistMdnPayload(payload);
                        if (!saved) {
                            window.IcNotify?.error?.("Não foi possível salvar o medidor.", 3000);
                            return;
                        }
                    } catch (err) {
                        console.error("[mdnedit] Falha ao gravar o medidor.", err);
                        window.IcNotify?.error?.("Não foi possível salvar o medidor.", 3000);
                        return;
                    }

                    try {
                        renderMdnSelectorList();
                        renderMdnForm();
                    } catch (err) {
                        console.error("[mdnedit] Falha ao atualizar a lista de medidores após salvar.", err);
                    }

                    try {
                        const activeFarm = getActiveFarmSafe();
                        if (activeFarm) {
                            window.CreateFarm?.view?.render?.renderEquipmentPanels?.(activeFarm);
                        }
                    } catch (err) {
                        console.error("[mdnedit] Falha ao atualizar os painéis após salvar.", err);
                    }
                })();
            });
        }

        const panel = $("mdnEditPanel");
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
                        if (target === "#mdnEditLocation") renderLocationMap();
                    }
                    // Update history header title
                    const historyTitle = panel.querySelector(".edit-panel__history-header h2");
                    if (historyTitle) {
                        if (target === "#mdnEditHistoryFavs") historyTitle.textContent = "Favoritos";
                        else if (target === "#mdnEditHistoryList") historyTitle.textContent = "Histórico de Configurações";
                    }
                    return;
                }

                // Inline select dropdowns (o × dos chips cai no handler de desvincular abaixo)
                const selectBtn = e.target.closest("[data-edit-select]");
                if (selectBtn && !e.target.closest("[data-unlink-bomba]")) {
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

                    if (menuKey === "sensor") {
                        const hidden = $("mdnEditSensor");
                        if (hidden) hidden.value = val;
                    }
                    if (menuKey === "versao") {
                        const hidden = $("mdnEditVersao");
                        if (hidden) hidden.value = val;
                    }
                    if (menuKey === "add-bomba" && val) {
                        const equip = getFocusMdn();
                        if (equip) {
                            // Persiste no equipamento para acumular vínculos (até 10 bombas)
                            equip.data = equip.data || {};
                            if (!Array.isArray(equip.data.linkedBombas)) equip.data.linkedBombas = [];
                            const linked = equip.data.linkedBombas;
                            if (!linked.includes(val) && linked.length < 10) {
                                linked.push(val);
                                renderLinkedBombasList(linked);
                                populateBombaMenu(linked);
                            }
                        }
                    }
                    return;
                }

                // Selector (mdn switcher)
                const selectorTrigger = e.target.closest("#mdnEditSelectBtn");
                if (selectorTrigger) {
                    const field = selectorTrigger.closest(".edit-panel__select-field");
                    field?.classList.toggle("is-open");
                    return;
                }

                // Unlink bomba
                const unlinkBtn = e.target.closest("[data-unlink-bomba]");
                if (unlinkBtn) {
                    const bombaId = unlinkBtn.dataset.unlinkBomba;
                    const equip = getFocusMdn();
                    if (equip) {
                        equip.data = equip.data || {};
                        const linked = (Array.isArray(equip.data.linkedBombas) ? equip.data.linkedBombas : []).filter(id => id !== bombaId);
                        equip.data.linkedBombas = linked;
                        renderLinkedBombasList(linked);
                        populateBombaMenu(linked);
                    }
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
                        if (icon) icon.className = isOpen ? "fa-solid fa-plus" : "fa-solid fa-minus";
                    }
                    return;
                }

                // History filter buttons
                const filterBtn = e.target.closest("[data-filter]");
                if (filterBtn) {
                    const filter = filterBtn.dataset.filter;
                    const targetSection = filter === "favs" ? "#mdnEditHistoryFavs" : "#mdnEditHistoryList";
                    panel.querySelectorAll(".edit-panel__nav-item").forEach(n => n.classList.remove("is-active"));
                    panel.querySelector(`[data-target="${targetSection}"]`)?.classList.add("is-active");
                    panel.querySelectorAll(".edit-panel__section").forEach(s => s.classList.remove("is-active"));
                    panel.querySelector(targetSection)?.classList.add("is-active");
                    return;
                }

            });

            // Close selects on outside click
            document.addEventListener("click", (e) => {
                if (!e.target.closest(".edit-panel__select-field")) {
                    panel.querySelectorAll(".edit-panel__select-field.is-open").forEach(f => f.classList.remove("is-open"));
                }
            });
        }

        // Clear buttons
        document.querySelectorAll("#mdnEditPanel .edit-panel__input-actions button[aria-label='Limpar campo']").forEach(btn => {
            btn.addEventListener("click", () => {
                const input = btn.closest(".edit-panel__input-wrap")?.querySelector("input");
                if (input) input.value = "";
            });
        });

        // GPS button
        const gpsBtn = $("mdnEditLocGpsBtn");
        if (gpsBtn && !gpsBtn.dataset.bound) {
            gpsBtn.dataset.bound = "1";
            gpsBtn.addEventListener("click", () => {
                if (!navigator.geolocation) return;
                navigator.geolocation.getCurrentPosition((pos) => {
                    const { latitude: lat, longitude: lng } = pos.coords;
                    const coordsInput = $("mdnEditLocCoords");
                    if (coordsInput) coordsInput.value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                    if (locationMapInstance) {
                        locationMapInstance.setView([lat, lng], 16);
                        if (locationMarker) locationMarker.setLatLng([lat, lng]);
                    }
                });
            });
        }

        // Toggle Vazão Residual
        const vazaoToggleBtn = $("mdnEditVazaoEnabled");
        if (vazaoToggleBtn && !vazaoToggleBtn.dataset.bound) {
            vazaoToggleBtn.dataset.bound = "1";
            vazaoToggleBtn.addEventListener("change", () => {
                const vazaoFields = $("mdnEditVazaoFields");
                if (vazaoFields) vazaoFields.style.display = vazaoToggleBtn.checked ? "grid" : "none";
            });
        }
    }

    // ─── Save payload ─────────────────────────────────────────────────────────────

    function buildSavePayload() {
        const name = $("mdnEditName")?.value?.trim();
        if (!name) return { error: "Informe o nome do medidor." };

        if (!$("mdnEditRadio")?.value?.trim()) return { error: "Informe o Rádio do Medidor de Nível." };

        const coordsStr = $("mdnEditLocCoords")?.value || "";
        let lat = null, lng = null;
        if (coordsStr.includes(",")) {
            const [la, lo] = coordsStr.split(",").map(Number);
            if (Number.isFinite(la) && Number.isFinite(lo)) { lat = la; lng = lo; }
        }

        const equip = getFocusMdn();
        const farm = getActiveFarmSafe();
        const linkedBombas = Array.isArray(equip?.data?.bombas) ? equip.data.bombas
            : (Array.isArray(equip?.data?.linkedBombas) ? equip.data.linkedBombas : []);
        return {
            id: state.detailsFocusId || equip?.id,
            farmId: farm?.id || "",
            name,
            // Chaves canônicas do wizard (equipamentos/medidor.js read*Step).
            // sysName removido — usar 'name'
            radio: $("mdnEditRadio")?.value?.trim() || "",
            version: $("mdnEditVersao")?.value || "5.2",
            sensor: $("mdnEditSensor")?.value || "",
            coefA: window.IcNumeric.readNumber("mdnEditCoefA", 0),
            coefB: window.IcNumeric.readNumber("mdnEditCoefB", 0),
            coefC: window.IcNumeric.readNumber("mdnEditCoefC", 0),
            loc: (lat !== null && lng !== null) ? `${lat}, ${lng}` : "",
            lat,
            lng,
            nivelMax: window.IcNumeric.readNumber("mdnEditMaxLevel", 0),
            nivelOffset: window.IcNumeric.readNumber("mdnEditOffset", 0),
            nivelValMin: window.IcNumeric.readNumber("mdnEditMinVal", 0),
            nivelValMax: window.IcNumeric.readNumber("mdnEditMaxVal", 100),
            vazaoEnabled: !!$("mdnEditVazaoEnabled")?.checked,
            bombas: linkedBombas,
        };
    }

    async function persistMdnPayload(payload) {
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
            data: {
                ...equipments[equipIndex].data,
                ...data,
                name,
                nome: name,
                // chaves pt antigas — apaga pra não deixar par divergente
                nomeSistema: undefined,
                nivelMaximo: undefined,
                offsetMedicao: undefined,
                valorMinimo: undefined,
                valorMaximo: undefined,
                linkedBombas: undefined,
                versao: undefined,
                // rádio unificado: um só campo ("Rádio do Medidor de Nível")
                radioImanage: undefined,
                radio_imanage: undefined,
            },
        };

        targetFarm.equipments = equipments;
        farms[farmIndex] = targetFarm;

        await window.Cad.data.persistFarmDataset(farms);
        window.CreateFarm?.setters?.setFarms?.(farms);
        return true;
    }

    // ─── Public API ───────────────────────────────────────────────────────────────

    async function showEditView() {
        let overlay = $("mdnEditOverlay");
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.id = "mdnEditOverlay";
            overlay.className = "config-overlay";
            overlay.style.zIndex = 1200 + document.querySelectorAll(".config-overlay").length;
            document.body.appendChild(overlay);
        }
        positionMdnOverlay(overlay);
        editView._resizeObserver?.disconnect();
        const mainEl = document.querySelector(".main");
        if (mainEl && typeof ResizeObserver === "function") {
            editView._resizeObserver = new ResizeObserver(() => positionMdnOverlay(overlay));
            editView._resizeObserver.observe(mainEl);
        }

        editEventsBound = false;
        const mounted = await mountEditPanel(overlay);
        if (!mounted) {
            editView._resizeObserver?.disconnect();
            overlay.remove();
            return;
        }

        renderMdnSelectorList();
        renderMdnForm();
        requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add("is-open")));
    }

    editView.showEditView = showEditView;
    editView.close = closeMdnEditOverlay;
})();
