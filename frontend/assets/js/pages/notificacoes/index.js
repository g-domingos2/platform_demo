(function () {
    "use strict";

    const state = { isOpen: false };
    const $ = (id) => document.getElementById(id);

    // =========================================================
    // Conteúdo de cada categoria — replicado da plataforma real
    // (nomes, ordem e quais itens têm "alertas críticos").
    //
    // items: lista na MESMA ordem da plataforma.
    //   critical: true  -> card expansível com "Deseja habilitar os alertas críticos?"
    // choice: campo de rádio do passo 1 (Pivô: Tipo de pivô / Bomba e Medidor: Versão)
    // =========================================================
    const s = (label) => ({ label, critical: false });
    const c = (label) => ({ label, critical: true });

    const NOTIF_OPTIONS = {
        pivo: {
            equipCategory: "pivos",
            groupPlaceholder: "Grupo do pivô",
            deviceNoun: "pivô",
            choice: {
                key: "pivotType",
                label: "Tipo de pivô",
                required: false,
                defaultValue: "pivots",
                filtersDevices: true,
                options: [
                    { value: "pivots", label: "SmartConnect ou Nexus" },
                    { value: "ecostarpivots", label: "SmartTouch ou UniversalTouch" }
                ]
            },
            items: [
                s("Irrigando"),
                s("Movendo a seco"),
                s("Programado"),
                s("Preparando para religar"),
                s("Parado por horário de pico"),
                s("Irrigação finalizada"),
                s("Parado em autorreversão"),
                s("Parado via internet"),
                s("Parado via painel"),
                s("Painel energizado"),
                s("Tensão fora da faixa permitida"),
                s("Painel desligado"),
                s("Tempo de bomba excedido"),
                s("Parado pelo pluviômetro"),
                s("Parado por erro no relógio interno"),
                s("Fertirrigação ligada"),
                s("Fertirrigação desligada"),
                c("Desalinhado"),
                c("Falha de pressão"),
                c("Queda de energia"),
                c("Erro desconhecido"),
                c("Botão parar pressionado (bomba ligada)")
            ]
        },
        carretel: {
            equipCategory: "carreteis",
            groupPlaceholder: "Grupo do carretel",
            deviceNoun: "carretel",
            choice: null,
            items: [
                s("Sem comunicação"),
                s("Ligado manualmente"),
                s("Programado"),
                s("Preparando partida"),
                s("Parado manualmente"),
                s("Preparando parada"),
                c("Irrigação finalizada"),
                s("Irrigando"),
                s("Irrigação pausada"),
                s("Pré-irrigando"),
                s("Pós-irrigando")
            ]
        },
        bomba: {
            equipCategory: "bombas",
            groupPlaceholder: "Grupo da bomba",
            deviceNoun: "bomba",
            choice: {
                key: "version",
                label: "Versão",
                required: true,
                defaultValue: null,
                filtersDevices: false,
                options: [
                    { value: "5", label: "Protocolo 5" },
                    { value: "5.1", label: "Protocolo 5.1" },
                    { value: "5.2", label: "Protocolo 5.2" }
                ]
            },
            items: [
                s("Ligada via internet"),
                s("Ligada manualmente"),
                s("Ligada após Horário de Pico"),
                s("Ligada após queda de energia"),
                s("Programada"),
                s("Energizada"),
                s("Bomba ligada via sensor"),
                s("Esperando tempo após queda de energia"),
                s("Horímetro não contabilizado"),
                s("Desligada após fim do agendamento"),
                s("Desligada por horário de pico"),
                s("Parada via internet"),
                c("Sem energia"),
                c("Desligada por queda de energia"),
                c("Desligada manualmente")
            ]
        },
        medidor: {
            equipCategory: "medidores",
            groupPlaceholder: "Grupo do medidor",
            deviceNoun: "medidor",
            choice: {
                key: "version",
                label: "Versão",
                required: false,
                defaultValue: "5.2",
                filtersDevices: false,
                options: [
                    { value: "5.2", label: "Protocolo 5.2" },
                    { value: "5.3", label: "Protocolo 5.3" }
                ]
            },
            items: [
                s("Ligado"),
                s("Ligado após queda de energia"),
                s("Monitorando um sensor"),
                s("Nível de bateria abaixo de 10V"),
                c("Desligado"),
                c("Desligado após queda de energia")
            ]
        }
    };

    // Tipos de pivô da família SmartTouch/UniversalTouch. O resto (SmartConnect,
    // Nexus, LineStar, CenterStar…) cai em "SmartConnect ou Nexus".
    const ECOSTAR_TYPES = ["smarttouch", "smart_touch", "universaltouch", "universal_touch"];

    function escapeHtml(str) {
        return String(str ?? "").replace(/[&<>"']/g, (ch) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[ch]));
    }

    // =========================================================
    // Persistência (localStorage, por fazenda)
    // =========================================================
    function storageKey() {
        const farm = window.IcFarmGetActive?.();
        return `ic:notif-groups:${farm?.id || "default"}`;
    }

    function readGroups() {
        try {
            const raw = localStorage.getItem(storageKey());
            const list = raw ? JSON.parse(raw) : [];
            return Array.isArray(list) ? list : [];
        } catch (_) {
            return [];
        }
    }

    function writeGroups(list) {
        try { localStorage.setItem(storageKey(), JSON.stringify(list)); } catch (_) { /* demo */ }
    }

    // =========================================================
    // Dispositivos
    // =========================================================
    function getDeviceOptions(category, choiceValue) {
        const cfg = NOTIF_OPTIONS[category] || NOTIF_OPTIONS.pivo;
        const farm = window.IcFarmGetActive?.();
        const equipments = farm?.equipments || [];
        return equipments
            .filter((eq) => eq.category === cfg.equipCategory)
            .filter((eq) => {
                if (category !== "pivo" || !cfg.choice?.filtersDevices) return true;
                const isEcostar = ECOSTAR_TYPES.includes(String(eq.type || "").toLowerCase());
                return choiceValue === "ecostarpivots" ? isEcostar : !isEcostar;
            })
            .map((eq) => ({ id: eq.id, label: eq.name || "" }))
            .sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { numeric: true }));
    }

    // =========================================================
    // Passo 2 — lista de opções (status simples + cards de alerta crítico)
    // =========================================================
    function renderOptionList(container, items, saved) {
        container.innerHTML = "";
        const savedMap = new Map((saved || []).map((o) => [o.label, o]));

        items.forEach((item, i) => {
            const prev = savedMap.get(item.label);
            if (!item.critical) {
                const row = document.createElement("div");
                row.className = "notif-status-row";
                row.innerHTML = `
                    <span class="notif-status-row__label">${escapeHtml(item.label)}</span>
                    <label class="pivo-edit__switch">
                        <input type="checkbox" data-notif-item="${i}" ${prev?.enabled ? "checked" : ""}>
                        <span class="pivo-edit__switch-slider"></span>
                    </label>`;
                container.appendChild(row);
                return;
            }

            const card = document.createElement("div");
            // Na plataforma os cards de alerta já abrem expandidos.
            card.className = "notif-alert-card is-expanded";
            card.innerHTML = `
                <div class="notif-alert-card__header">
                    <div class="notif-alert-card__heading">
                        <i class="fa-solid fa-chevron-down notif-alert-card__chevron"></i>
                        <span>${escapeHtml(item.label)}</span>
                    </div>
                    <label class="pivo-edit__switch" data-notif-stop>
                        <input type="checkbox" data-notif-item="${i}" ${prev?.enabled ? "checked" : ""}>
                        <span class="pivo-edit__switch-slider"></span>
                    </label>
                </div>
                <div class="notif-alert-card__body">
                    <div class="notif-alert-card__sub-row">
                        <span class="notif-alert-card__sub-label"><i class="fa-solid fa-circle-exclamation"></i>Deseja habilitar os alertas críticos?</span>
                        <label class="pivo-edit__switch">
                            <input type="checkbox" data-notif-critical="${i}" ${prev?.critical ? "checked" : ""}>
                            <span class="pivo-edit__switch-slider"></span>
                        </label>
                    </div>
                </div>`;
            card.querySelector(".notif-alert-card__header").addEventListener("click", (e) => {
                if (e.target.closest("[data-notif-stop]")) return;
                card.classList.toggle("is-expanded");
            });
            container.appendChild(card);
        });
    }

    function collectOptions(container, items) {
        return items.map((item, i) => ({
            label: item.label,
            enabled: !!container.querySelector(`[data-notif-item="${i}"]`)?.checked,
            critical: item.critical ? !!container.querySelector(`[data-notif-critical="${i}"]`)?.checked : false
        }));
    }

    // =========================================================
    // Multiselect de dispositivos (etiquetas com × dentro do campo)
    // =========================================================
    function setupDeviceMultiselect(modal, options, initialIds, onChange) {
        const wrap = modal.querySelector("#notifDevicesWrap");
        const trigger = modal.querySelector("#notifDevicesTrigger");
        const dropdown = modal.querySelector("#notifDevicesDropdown");
        const search = modal.querySelector("#notifDevicesSearch");
        const list = modal.querySelector("#notifDevicesList");
        const labelEl = modal.querySelector("#notifDevicesLabel");
        const field = modal.querySelector("#notifDevicesField");
        const errorEl = modal.querySelector("#notifDevicesError");

        const validIds = new Set(options.map((o) => o.id));
        const selected = new Set((initialIds || []).filter((id) => validIds.has(id)));

        field?.classList.remove("is-error");
        if (errorEl) errorEl.hidden = true;

        function closeDropdown() {
            dropdown.style.display = "none";
            wrap.classList.remove("is-open");
        }

        function changed() {
            if (selected.size) {
                field?.classList.remove("is-error");
                if (errorEl) errorEl.hidden = true;
            }
            onChange?.(selected.size);
        }

        function updateLabel() {
            labelEl.innerHTML = "";
            if (selected.size === 0) {
                labelEl.textContent = "Por favor selecione";
                labelEl.classList.add("ip-multiselect__label--placeholder");
                return;
            }
            labelEl.classList.remove("ip-multiselect__label--placeholder");
            options.filter((o) => selected.has(o.id)).forEach((o) => {
                const tag = document.createElement("span");
                tag.className = "notif-tag";
                tag.innerHTML = `<span>${escapeHtml(o.label)}</span><button type="button" class="notif-tag__x" aria-label="Remover ${escapeHtml(o.label)}">×</button>`;
                tag.querySelector(".notif-tag__x").addEventListener("click", (e) => {
                    e.stopPropagation();
                    selected.delete(o.id);
                    updateLabel();
                    renderList(search.value);
                    changed();
                });
                labelEl.appendChild(tag);
            });
        }

        function renderList(filter = "") {
            const q = filter.trim().toLowerCase();
            list.innerHTML = "";
            const filtered = options.filter((o) => o.label.toLowerCase().includes(q));
            if (!filtered.length) {
                list.innerHTML = `<div class="ip-multiselect__empty">Nenhum dispositivo encontrado</div>`;
                return;
            }
            filtered.forEach((o) => {
                const item = document.createElement("button");
                item.type = "button";
                item.className = "ip-multiselect__option" + (selected.has(o.id) ? " is-selected" : "");
                item.dataset.id = o.id;
                item.innerHTML = `<span class="ip-multiselect__check"><i class="fa-solid fa-check"></i></span>${escapeHtml(o.label)}`;
                item.addEventListener("click", (e) => {
                    e.stopPropagation();
                    if (selected.has(o.id)) selected.delete(o.id); else selected.add(o.id);
                    item.classList.toggle("is-selected", selected.has(o.id));
                    updateLabel();
                    changed();
                    positionDropdown();
                });
                list.appendChild(item);
            });
        }

        function positionDropdown() {
            const rect = trigger.getBoundingClientRect();
            dropdown.style.top = `${rect.bottom + 4}px`;
            dropdown.style.left = `${rect.left}px`;
            dropdown.style.width = `${rect.width}px`;
        }

        closeDropdown();
        renderList();
        updateLabel();

        trigger.onclick = (e) => {
            e.stopPropagation();
            if (dropdown.style.display !== "none") { closeDropdown(); return; }
            positionDropdown();
            search.value = "";
            renderList();
            dropdown.style.display = "block";
            wrap.classList.add("is-open");
            search.focus();
        };

        search.oninput = () => renderList(search.value);
        search.onclick = (e) => e.stopPropagation();

        return {
            close: closeDropdown,
            contains: (el) => wrap.contains(el) || dropdown.contains(el),
            getSelected: () => options.filter((o) => selected.has(o.id)),
            hasSelection: () => selected.size > 0,
            showError: () => {
                field?.classList.add("is-error");
                if (errorEl) errorEl.hidden = false;
            }
        };
    }

    // =========================================================
    // Lista de grupos criados
    // =========================================================
    function periodText(g) {
        if (g.allDay) return "Todo o dia";
        return `${g.start || "00:00"} – ${g.end || "23:59"}`;
    }

    function renderGroupLists(root, handlers) {
        const groups = readGroups();
        Object.keys(NOTIF_OPTIONS).forEach((category) => {
            const listEl = root.querySelector(`[data-notif-list="${category}"]`);
            const emptyEl = root.querySelector(`[data-notif-empty="${category}"]`);
            if (!listEl) return;
            const cfg = NOTIF_OPTIONS[category];
            const mine = groups.filter((g) => g.category === category);

            listEl.innerHTML = "";
            if (emptyEl) emptyEl.hidden = mine.length > 0;

            mine.forEach((g) => {
                const activeCount = (g.options || []).filter((o) => o.enabled).length;
                const choiceLabel = cfg.choice
                    ? cfg.choice.options.find((o) => o.value === g.choice)?.label
                    : "";
                const el = document.createElement("div");
                el.className = "notif-group";
                el.innerHTML = `
                    <div class="notif-group__main">
                        <div class="notif-group__name">${escapeHtml(g.name)}</div>
                        <div class="notif-group__meta">
                            ${choiceLabel ? `<span><i class="fa-solid fa-microchip"></i>${escapeHtml(choiceLabel)}</span>` : ""}
                            <span><i class="fa-regular fa-clock"></i>${escapeHtml(periodText(g))}</span>
                            <span><i class="fa-regular fa-bell"></i>${activeCount} ${activeCount === 1 ? "notificação ativa" : "notificações ativas"}</span>
                        </div>
                        <div class="notif-group__devices">
                            ${(g.devices || []).map((d) => `<span class="notif-tag">${escapeHtml(d.label)}</span>`).join("")}
                        </div>
                    </div>
                    <div class="notif-group__actions">
                        <button type="button" class="notif-group__btn" data-act="edit"><i class="fa-solid fa-pen"></i>Editar</button>
                        <button type="button" class="notif-group__btn notif-group__btn--danger" data-act="delete"><i class="fa-regular fa-trash-can"></i>Excluir</button>
                    </div>`;
                el.querySelector('[data-act="edit"]').addEventListener("click", () => handlers.edit(g));
                el.querySelector('[data-act="delete"]').addEventListener("click", () => handlers.remove(g));
                listEl.appendChild(el);
            });
        });
    }

    // =========================================================
    // Modal "Adicionar Notificação"
    // =========================================================
    function bindAddNotificationModal(root) {
        const modal = root.querySelector("#notifAddModal");
        if (!modal) return;

        const titleEl = modal.querySelector("#notifAddTitle");
        const stepEls = Array.from(modal.querySelectorAll("[data-notif-step]"));
        const stepBodies = Array.from(modal.querySelectorAll(".notif-add-step"));
        const btnPrev = modal.querySelector("#btnNotifAddPrev");
        const btnNext = modal.querySelector("#btnNotifAddNext");
        const footer = modal.querySelector("#notifAddFooter");
        const allDayChk = modal.querySelector("#notifPeriodAllDay");
        const periodStart = modal.querySelector("#notifPeriodStart");
        const periodEnd = modal.querySelector("#notifPeriodEnd");
        const nameInput = modal.querySelector("#notifGroupName");
        const nameError = modal.querySelector("#notifGroupNameError");
        const choiceField = modal.querySelector("#notifChoiceField");
        const choiceLabel = modal.querySelector("#notifChoiceLabel");
        const choiceGroup = modal.querySelector("#notifChoiceGroup");
        const choiceError = modal.querySelector("#notifChoiceError");
        const optListEl = modal.querySelector("#notifOptList");

        let currentStep = 0;
        let category = "pivo";
        let editing = null;           // grupo sendo editado (ou null)
        let devicesApi = null;
        let devicesForChoice = undefined;
        let pendingDeviceIds = [];

        const cfg = () => NOTIF_OPTIONS[category] || NOTIF_OPTIONS.pivo;
        const getChoice = () => choiceGroup.querySelector("input:checked")?.value || null;

        function stepIcon(i) {
            const num = stepEls[i]?.querySelector(".create-equip__step-num");
            if (!num) return;
            num.innerHTML = i < currentStep ? '<i class="fa-solid fa-check"></i>' : String(i + 1);
        }

        function updateNextState() {
            const isLast = currentStep === stepBodies.length - 1;
            btnNext.disabled = isLast && !(devicesApi && devicesApi.hasSelection());
        }

        function renderStep() {
            stepEls.forEach((el, i) => {
                el.classList.toggle("create-equip__step--active", i === currentStep);
                el.classList.toggle("is-done", i < currentStep);
                stepIcon(i);
            });
            stepBodies.forEach((el, i) => { el.hidden = i !== currentStep; });
            const isLast = currentStep === stepBodies.length - 1;
            btnPrev.style.display = currentStep > 0 ? "" : "none";
            footer?.classList.toggle("no-prev", currentStep === 0);
            btnNext.textContent = isLast ? (editing ? "Salvar" : "Enviar") : "Próximo";
            updateNextState();
        }

        function renderChoice(value) {
            const ch = cfg().choice;
            choiceGroup.innerHTML = "";
            if (choiceError) choiceError.hidden = true;
            if (!ch) { choiceField.hidden = true; return; }
            choiceField.hidden = false;
            choiceLabel.textContent = ch.label;
            choiceLabel.classList.toggle("is-required", !!ch.required);
            ch.options.forEach((o) => {
                const lbl = document.createElement("label");
                lbl.className = "notif-radio";
                lbl.innerHTML = `
                    <input type="radio" name="notifChoice" value="${escapeHtml(o.value)}" ${o.value === value ? "checked" : ""} />
                    <span class="notif-radio__dot"></span>
                    <span>${escapeHtml(o.label)}</span>`;
                lbl.querySelector("input").addEventListener("change", () => {
                    if (choiceError) choiceError.hidden = true;
                });
                choiceGroup.appendChild(lbl);
            });
        }

        // (Re)monta o select de dispositivos ao entrar no passo 2. Se o tipo de
        // pivô mudou, a lista muda e a seleção anterior é descartada.
        function prepareDevices() {
            const ch = cfg().choice;
            const choiceVal = ch?.filtersDevices ? getChoice() : null;
            if (devicesApi && devicesForChoice === choiceVal) return;
            const keep = devicesApi ? devicesApi.getSelected().map((d) => d.id) : pendingDeviceIds;
            devicesForChoice = choiceVal;
            devicesApi = setupDeviceMultiselect(
                modal,
                getDeviceOptions(category, choiceVal),
                keep,
                () => updateNextState()
            );
        }

        function validateStep0() {
            let ok = true;
            if (!nameInput.value.trim()) {
                nameInput.classList.add("is-error");
                if (nameError) nameError.hidden = false;
                ok = false;
            }
            const ch = cfg().choice;
            if (ch?.required && !getChoice()) {
                if (choiceError) choiceError.hidden = false;
                ok = false;
            }
            return ok;
        }

        function openModal(cat, group) {
            category = NOTIF_OPTIONS[cat] ? cat : "pivo";
            editing = group || null;
            currentStep = 0;
            devicesApi = null;
            devicesForChoice = undefined;
            pendingDeviceIds = (group?.devices || []).map((d) => d.id);

            const c0 = cfg();
            if (titleEl) titleEl.textContent = group ? "Editar Notificação" : "Adicionar Notificação";

            nameInput.value = group?.name || "";
            nameInput.placeholder = c0.groupPlaceholder;
            nameInput.classList.remove("is-error");
            if (nameError) nameError.hidden = true;

            renderChoice(group ? group.choice : c0.choice?.defaultValue ?? null);

            const allDay = group ? !!group.allDay : true;
            allDayChk.checked = allDay;
            periodStart.value = group?.start || "00:00";
            periodEnd.value = group?.end || "23:59";
            periodStart.disabled = allDay;
            periodEnd.disabled = allDay;

            renderOptionList(optListEl, c0.items, group?.options);
            optListEl.scrollTop = 0;

            const dd = modal.querySelector("#notifDevicesDropdown");
            if (dd) dd.style.display = "none";

            renderStep();
            modal.classList.add("is-open");
            modal.setAttribute("aria-hidden", "false");
            document.body.classList.add("is-modal-open");
            setTimeout(() => nameInput.focus(), 50);
        }

        function closeModal() {
            devicesApi?.close();
            modal.classList.remove("is-open");
            modal.setAttribute("aria-hidden", "true");
            document.body.classList.remove("is-modal-open");
        }

        function save() {
            const c0 = cfg();
            const group = {
                id: editing?.id || `notif_${Date.now()}`,
                category,
                name: nameInput.value.trim(),
                choice: c0.choice ? getChoice() : null,
                allDay: allDayChk.checked,
                start: allDayChk.checked ? "00:00" : (periodStart.value || "00:00"),
                end: allDayChk.checked ? "23:59" : (periodEnd.value || "23:59"),
                devices: devicesApi.getSelected(),
                options: collectOptions(optListEl, c0.items),
                createdAt: editing?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            const groups = readGroups();
            const idx = groups.findIndex((g) => g.id === group.id);
            if (idx >= 0) groups[idx] = group; else groups.push(group);
            writeGroups(groups);
            refreshLists();
            window.IcNotify?.success?.(editing ? "Notificação atualizada" : "Notificação criada");
        }

        const handlers = {
            edit: (g) => openModal(g.category, g),
            remove: (g) => {
                if (!window.confirm(`Excluir o grupo de notificações "${g.name}"?`)) return;
                writeGroups(readGroups().filter((x) => x.id !== g.id));
                refreshLists();
            }
        };
        function refreshLists() { renderGroupLists(root, handlers); }

        root.querySelectorAll("[data-notif-open]").forEach((btn) =>
            btn.addEventListener("click", () => openModal(btn.dataset.notifCategory))
        );
        modal.querySelectorAll("[data-notif-close]").forEach((el) => el.addEventListener("click", closeModal));

        nameInput.addEventListener("input", () => {
            if (!nameInput.value.trim()) return;
            nameInput.classList.remove("is-error");
            if (nameError) nameError.hidden = true;
        });

        allDayChk.addEventListener("change", () => {
            periodStart.disabled = allDayChk.checked;
            periodEnd.disabled = allDayChk.checked;
            if (allDayChk.checked) { periodStart.value = "00:00"; periodEnd.value = "23:59"; }
        });

        btnPrev.addEventListener("click", () => {
            if (currentStep > 0) { devicesApi?.close(); currentStep -= 1; renderStep(); }
        });

        btnNext.addEventListener("click", () => {
            const isLast = currentStep === stepBodies.length - 1;
            if (!isLast) {
                if (!validateStep0()) return;
                currentStep += 1;
                prepareDevices();
                renderStep();
                return;
            }
            if (!devicesApi || !devicesApi.hasSelection()) {
                devicesApi?.showError();
                return;
            }
            save();
            closeModal();
        });

        // Fecha o dropdown de dispositivos ao clicar fora dele.
        document.addEventListener("click", (e) => {
            if (!modal.classList.contains("is-open") || !devicesApi) return;
            if (!devicesApi.contains(e.target)) devicesApi.close();
        });

        // Lista (dentro do modal) rola: o dropdown é "fixed", então fecha ao rolar.
        modal.querySelector("#notifAddBody")?.addEventListener("scroll", () => devicesApi?.close(), true);

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
        });

        refreshLists();
    }

    function bindUI() {
        const root = $("notificacoesPanel");
        if (!root) return;

        root.querySelector("#notificacoesBack")?.addEventListener("click", () => window.IcNotificacoes?.close());

        const navItems = root.querySelectorAll(".edit-panel__nav-item");
        const sections = root.querySelectorAll(".edit-panel__section");
        navItems.forEach((btn) => {
            btn.addEventListener("click", () => {
                const target = root.querySelector(btn.getAttribute("data-target"));
                if (!target) return;
                navItems.forEach((b) => b.classList.remove("is-active"));
                sections.forEach((sec) => sec.classList.remove("is-active"));
                btn.classList.add("is-active");
                target.classList.add("is-active");
            });
        });

        bindAddNotificationModal(root);
    }

    async function open() {
        const alreadyMounted = !!document.getElementById("notificacoesPanel");
        if (state.isOpen && alreadyMounted) return;
        state.isOpen = true;

        document.body.classList.add("is-farm-edit");
        const mapCard = $("mapCard");
        if (mapCard) mapCard.style.display = "none";

        try {
            const slot = $("pageSlot");
            if (slot) {
                const html = await fetch("./pages/notificacoes.html").then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); });
                slot.innerHTML = html;
                bindUI();
            }
            window.dispatchEvent(new Event("ic:layout-change"));
        } catch (err) {
            console.error("IcNotificacoes: failed to open", err);
            state.isOpen = false;
            document.body.classList.remove("is-farm-edit");
            if (mapCard) mapCard.style.display = "";
        }
    }

    function close() {
        state.isOpen = false;
        document.body.classList.remove("is-farm-edit", "is-modal-open");
        const slot = $("pageSlot");
        if (slot) slot.innerHTML = "";
        const mapCard = $("mapCard");
        if (mapCard) mapCard.style.display = "";
        const map = window.icMap;
        if (map && typeof map.invalidateSize === "function") {
            map.invalidateSize({ pan: false });
        }
    }

    window.IcNotificacoes = { open, close };
})();
