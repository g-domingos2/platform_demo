// assets/js/pages/repetidoras/view.edit.js
(function () {
    "use strict";

    const Rep = (window.Rep = window.Rep || {});
    const state = (Rep.state = Rep.state || {});
    const $ = (id) => document.getElementById(id);

    let locationMapInstance = null;
    let locationMarker = null;
    let editEventsBound = false;

    // ─── Helpers ─────────────────────────────────────────────────────────────────

    // getActiveFarmSafe compartilhado — ver assets/js/core/farm-utils.js
    const { getActiveFarmSafe } = window.IcFarm;

    function getRepetidorasList() {
        const farm = getActiveFarmSafe();
        const list = Array.isArray(farm?.equipments) ? farm.equipments : [];
        return list.filter((e) => {
            const type = String(e?.type || "").toLowerCase();
            const cat = String(e?.category || "").toLowerCase();
            return type === "repetidora" || type === "repeater" || cat === "repetidoras";
        });
    }

    function getFocusRep() {
        const list = getRepetidorasList();
        if (!list.length) return null;
        if (state.editFocusId) {
            return list.find((r) => String(r.id) === String(state.editFocusId)) || list[0];
        }
        return list[0];
    }

    function normalizeRepData(equip) {
        if (!equip) return null;
        const data = equip?.data || {};
        const farm = getActiveFarmSafe();
        // Chaves canônicas (as que o wizard grava): name, radio, type, height,
        // loc/lat/lng. Fallback para nomes pt antigos (tipo/altura) e para o
        // radio herdado da central da fazenda.
        return {
            id: equip.id,
            name: equip.name || data.name || data.nome || "",
            radioCentral: data.radioCentral || data.radio_central || farm?.radioCentral || farm?.data?.radioCentral || "",
            radio: data.radio || data.radioRepetidora || data.radio_repetidora || "",
            tipo: String(data.type || data.tipo || "solar").toLowerCase(),
            altura: data.height ?? data.altura ?? "",
            lat: data.lat ?? data.centerLat ?? equip.lat ?? null,
            lng: data.lng ?? data.centerLng ?? equip.lng ?? null,
            updatedAt: equip.updatedAt || data.updated || "",
        };
    }

    // formatLastComm compartilhado — ver assets/js/core/equip-utils.js
    const { formatLastComm } = window.IcEquipUtils;

    // ─── Mount ────────────────────────────────────────────────────────────────────

    async function mountEditPanel() {
        const slot = $("pageSlot");
        if (!slot) return false;
        try {
            const html = await fetch("./pages/repetidora-edit.html").then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); });
            slot.innerHTML = html;
            bindEditUI();
            return true;
        } catch (err) {
            console.error("[repedit] Failed to load repetidora-edit.html", err);
            return false;
        }
    }

    // ─── Populate form ────────────────────────────────────────────────────────────

    function renderRepForm() {
        const equip = getFocusRep();
        const d = normalizeRepData(equip);
        if (!d) return;

        const selectBtn = $("repEditSelectBtn");
        if (selectBtn) selectBtn.textContent = d.name || "—";

        const lastCommHtml = `<span class="comm-label">Última comunicação:</span> ${formatLastComm(d.updatedAt)}`;
        document.querySelectorAll("#repEditPanel .rep-last-comm-display").forEach(el => { el.innerHTML = lastCommHtml; });

        const rc = $("repEditRadioCentral");
        if (rc) rc.value = d.radioCentral || "—";

        const radio = $("repEditRadio");
        if (radio) radio.value = d.radio || "";

        const set = (id, val) => { const el = $(id); if (el) el.value = val ?? ""; };
        set("repEditName", d.name);
        set("repEditAltura", d.altura);

        const tipoVal = d.tipo === "bivolt" ? "bivolt" : "solar";
        const tipoHidden = $("repEditTipo");
        if (tipoHidden) tipoHidden.value = tipoVal;
        const tipoBtn = $("repEditTipoBtn");
        if (tipoBtn) tipoBtn.textContent = tipoVal === "bivolt" ? "Bivolt" : "Solar";
        document.querySelectorAll('#repEditPanel [data-edit-menu="tipo"] .edit-panel__select-option').forEach(o => {
            o.classList.toggle("is-active", o.dataset.value === tipoVal);
        });

        const coords = $("repEditLocCoords");
        if (coords) {
            coords.value = (Number.isFinite(Number(d.lat)) && Number.isFinite(Number(d.lng)) && d.lat !== null && d.lng !== null)
                ? `${Number(d.lat).toFixed(6)}, ${Number(d.lng).toFixed(6)}`
                : "";
        }
    }

    function renderRepSelectorList() {
        const menu = $("repEditSelectMenu");
        if (!menu) return;

        const list = getRepetidorasList();
        menu.innerHTML = "";
        list.forEach(r => {
            const opt = document.createElement("button");
            opt.type = "button";
            opt.className = "edit-panel__select-option" + (String(r.id) === String(state.editFocusId) ? " is-active" : "");
            opt.dataset.value = String(r.id);
            opt.textContent = r.name || r.nome || String(r.id);
            opt.addEventListener("click", () => {
                state.editFocusId = r.id;
                document.querySelectorAll(".edit-panel__select-field").forEach(f => f.classList.remove("is-open"));
                renderRepSelectorList();
                renderRepForm();
            });
            menu.appendChild(opt);
        });
    }

    // ─── Location map ─────────────────────────────────────────────────────────────

    function renderLocationMap() {
        const mapEl = $("repEditLocationMap");
        if (!mapEl || !window.L) return;

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

        const coordsVal = $("repEditLocCoords")?.value || "";
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
            const coordsInput = $("repEditLocCoords");
            if (coordsInput) coordsInput.value = `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`;
        });

        setTimeout(() => locationMapInstance?.invalidateSize(), 150);
    }

    // ─── Bind UI ──────────────────────────────────────────────────────────────────

    function closeEditView() {
        document.body.classList.remove("is-rep-edit", "is-pluviometria-edit");
        editEventsBound = false;
        if (locationMapInstance) {
            try { locationMapInstance.off(); locationMapInstance.remove(); } catch (_) {}
            locationMapInstance = null;
            locationMarker = null;
        }
        const slot = $("pageSlot");
        if (slot) slot.innerHTML = "";
        const mapCard = $("mapCard");
        if (mapCard) mapCard.style.display = "";
        const map = window.icMap;
        if (map && typeof map.invalidateSize === "function") {
            requestAnimationFrame(() => map.invalidateSize({ pan: false }));
        }
    }

    function bindEditUI() {
        if (editEventsBound) return;
        editEventsBound = true;

        const backBtn = $("repEditBack");
        if (backBtn && !backBtn.dataset.bound) {
            backBtn.dataset.bound = "1";
            backBtn.addEventListener("click", closeEditView);
        }

        const saveBtn = $("repEditSaveBtn");
        if (saveBtn && !saveBtn.dataset.bound) {
            saveBtn.dataset.bound = "1";
            saveBtn.addEventListener("click", () => {
                const payload = buildSavePayload();
                if (payload.error) { alert(payload.error); return; }

                // Atualiza a tela/mapa na hora e fecha, mas a gravação real
                // (persistFarmDataset) roda em segundo plano — se falhar,
                // avisa por notificação em vez de fingir que salvou.
                applySave(payload);
                closeEditView();

                (async () => {
                    try {
                        const saved = await persistRepPayload(payload);
                        if (!saved) {
                            window.IcNotify?.error?.("Não foi possível salvar a repetidora.", 3000);
                        }
                    } catch (err) {
                        console.error("[repedit] Falha ao gravar a repetidora.", err);
                        window.IcNotify?.error?.("Não foi possível salvar a repetidora.", 3000);
                    }
                })();
            });
        }

        const panel = $("repEditPanel");
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
                    // Salvar só faz sentido na aba Configurações (display:inline-flex
                    // vence [hidden], então alterna pelo style).
                    const saveBtn = $("repEditSaveBtn");
                    if (saveBtn) { saveBtn.hidden = key !== "config"; saveBtn.style.display = key === "config" ? "" : "none"; }
                    // Ativa o primeiro item de navegação da aba recém-aberta
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
                        if (target === "#repEditLocation") renderLocationMap();
                    }
                    return;
                }

                // Histórico — expandir/recolher os detalhes de uma linha
                const expandBtn = e.target.closest("[data-toggle-details]");
                if (expandBtn) {
                    const detailsRow = document.getElementById(`details-${expandBtn.dataset.toggleDetails}`);
                    if (detailsRow) {
                        const isOpen = detailsRow.style.display !== "none";
                        detailsRow.style.display = isOpen ? "none" : "table-row";
                        const icon = expandBtn.querySelector("i");
                        if (icon) icon.className = isOpen ? "fa-solid fa-plus" : "fa-solid fa-minus";
                    }
                    return;
                }

                // Inline select dropdowns
                const selectBtn = e.target.closest("[data-edit-select]");
                if (selectBtn) {
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

                    if (menuKey === "tipo") {
                        const hidden = $("repEditTipo");
                        if (hidden) hidden.value = val;
                    }
                    return;
                }

                // Selector (rep switcher)
                const selectorTrigger = e.target.closest("#repEditSelectBtn");
                if (selectorTrigger) {
                    const field = selectorTrigger.closest(".edit-panel__select-field");
                    field?.classList.toggle("is-open");
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
        document.querySelectorAll("#repEditPanel .edit-panel__input-actions button[aria-label='Limpar campo']").forEach(btn => {
            btn.addEventListener("click", () => {
                const input = btn.closest(".edit-panel__input-wrap")?.querySelector("input");
                if (input) input.value = "";
            });
        });
        document.querySelectorAll("#repEditPanel .farm-radio-clear").forEach(btn => {
            btn.addEventListener("click", () => {
                const input = btn.closest(".sc-input-group")?.querySelector("input");
                if (input && !input.readOnly) input.value = "";
            });
        });

        // GPS button
        const gpsBtn = $("repEditLocGpsBtn");
        if (gpsBtn && !gpsBtn.dataset.bound) {
            gpsBtn.dataset.bound = "1";
            gpsBtn.addEventListener("click", () => {
                if (!navigator.geolocation) return;
                navigator.geolocation.getCurrentPosition((pos) => {
                    const { latitude: lat, longitude: lng } = pos.coords;
                    const coordsInput = $("repEditLocCoords");
                    if (coordsInput) coordsInput.value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                    if (locationMapInstance) {
                        locationMapInstance.setView([lat, lng], 16);
                        if (locationMarker) locationMarker.setLatLng([lat, lng]);
                    }
                });
            });
        }
    }

    // ─── Save ─────────────────────────────────────────────────────────────────────

    function buildSavePayload() {
        const name = $("repEditName")?.value?.trim();
        if (!name) return { error: "Informe o nome da repetidora." };

        const coordsStr = $("repEditLocCoords")?.value || "";
        let lat = null, lng = null;
        if (coordsStr.includes(",")) {
            const [la, lo] = coordsStr.split(",").map(Number);
            if (Number.isFinite(la) && Number.isFinite(lo)) { lat = la; lng = lo; }
        }

        const equip = getFocusRep();
        const farm = getActiveFarmSafe();
        return {
            id: state.editFocusId || equip?.id,
            farmId: farm?.id || "",
            name,
            radio: $("repEditRadio")?.value?.trim() || "",
            type: $("repEditTipo")?.value || "solar",
            height: window.IcNumeric.toFiniteNumber($("repEditAltura")?.value) ?? "",
            lat,
            lng,
        };
    }

    // Grava de verdade no dataset persistido (localStorage/API). O applySave
    // acima só atualizava o objeto em memória — fechava a tela como se
    // tivesse salvo, mas ao recarregar a página a edição sumia.
    async function persistRepPayload(payload) {
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

        equipments[equipIndex] = {
            ...equipments[equipIndex],
            name: payload.name,
            data: {
                ...equipments[equipIndex].data,
                name: payload.name,
                nome: payload.name,
                radio: payload.radio,
                type: payload.type,
                height: payload.height,
                // chaves antigas (pt) que registros anteriores usavam — remove
                // pra não deixar dado duplicado divergente no equipamento
                tipo: undefined,
                altura: undefined,
                ...(payload.lat !== null && payload.lng !== null ? { lat: payload.lat, lng: payload.lng, loc: `${payload.lat}, ${payload.lng}` } : {}),
            },
        };

        targetFarm.equipments = equipments;
        farms[farmIndex] = targetFarm;

        await window.Cad.data.persistFarmDataset(farms);
        window.CreateFarm?.setters?.setFarms?.(farms);
        return true;
    }

    function applySave(payload) {
        const farm = getActiveFarmSafe();
        const list = Array.isArray(farm?.equipments) ? farm.equipments : [];
        const equip = list.find((e) => String(e.id) === String(payload.id));
        if (!equip) return;

        equip.name = payload.name;
        equip.data = {
            ...(equip.data || {}),
            name: payload.name,
            nome: payload.name,
            radio: payload.radio,
            type: payload.type,
            height: payload.height,
            tipo: undefined,
            altura: undefined,
        };
        if (payload.lat !== null && payload.lng !== null) {
            equip.data.lat = payload.lat;
            equip.data.lng = payload.lng;
            equip.data.loc = `${payload.lat}, ${payload.lng}`;
        }

        // Re-renderiza os marcadores do mapa com os dados novos
        if (window.IcMapRenderPivots && farm) {
            setTimeout(() => window.IcMapRenderPivots(farm), 0);
        }
    }

    // ─── Public API ───────────────────────────────────────────────────────────────

    async function open(options = {}) {
        const repId = options.repId ?? options.equipmentId ?? null;
        if (repId) state.editFocusId = repId;

        document.body.classList.add("is-rep-edit", "is-pluviometria-edit");
        editEventsBound = false;

        const mapCard = $("mapCard");
        if (mapCard) mapCard.style.display = "none";

        const mounted = await mountEditPanel();
        if (!mounted) {
            document.body.classList.remove("is-rep-edit", "is-pluviometria-edit");
            if (mapCard) mapCard.style.display = "";
            return;
        }

        renderRepSelectorList();
        renderRepForm();
    }

    window.IcRepetidoraEdit = { open };
})();
