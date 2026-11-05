(function () {
    "use strict";

    const state = { isOpen: false };
    const $ = (id) => document.getElementById(id);

    function bindUI() {
        const root = $("notificacoesPanel");
        if (!root) return;

        const btnBack = root.querySelector("#notificacoesBack");
        if (btnBack) {
            btnBack.addEventListener("click", () => window.IcNotificacoes?.close());
        }

        const navItems = root.querySelectorAll(".edit-panel__nav-item");
        const sections = root.querySelectorAll(".edit-panel__section");

        navItems.forEach((btn) => {
            btn.addEventListener("click", () => {
                const target = root.querySelector(btn.getAttribute("data-target"));
                if (!target) return;
                navItems.forEach((b) => b.classList.remove("is-active"));
                sections.forEach((s) => s.classList.remove("is-active"));
                btn.classList.add("is-active");
                target.classList.add("is-active");
            });
        });

        bindAddNotificationModal(root);
    }

    // Categoria -> conteúdo do Step 2.
    // Pivô: nomenclatura e ordem replicadas exatamente da página real de notificações de pivôs.
    // Bomba e Medidor de Nível ainda não existem no site — rascunho montado a partir dos
    // status/eventos que já aparecem nas telas de detalhe/histórico de cada equipamento
    // (bomba.details.html, medidor.details.html, view.details.js). Ajustar quando o time
    // definir a lista final.
    const EQUIP_CATEGORY_MAP = { pivo: "pivos", bomba: "bombas", medidor: "medidores" };

    const NOTIF_OPTIONS = {
        pivo: {
            groupPlaceholder: "Grupo do pivô",
            status: [
                "Irrigando",
                "Movendo a seco",
                "Programado",
                "Preparando para religar",
                "Parado por horário de pico",
                "Irrigação finalizada",
                "Parado em autorreversão",
                "Parado via internet",
                "Parado via painel",
                "Painel energizado",
                "Tensão fora da faixa permitida",
                "Painel desligado",
                "Tempo de bomba excedido",
                "Parado pelo pluviômetro",
                "Parado por erro no relógio interno",
                "Fertirrigação ligada",
                "Fertirrigação desligada"
            ],
            alerts: [
                "Desalinhado",
                "Falha de pressão",
                "Queda de energia",
                "Erro desconhecido",
                "Botão parar pressionado (bomba ligada)"
            ]
        },
        bomba: {
            groupPlaceholder: "Grupo da bomba",
            status: [
                "Ligada via internet",
                "Desligada pela internet",
                "Ligada manualmente",
                "Desligada manualmente",
                "Aguardando após falha",
                "Programada",
                "Preparando para religar",
                "Parado por horário de pico",
                "Painel energizado",
                "Painel desligado",
                "Tensão fora da faixa permitida",
                "Parado por erro no relógio interno"
            ],
            alerts: [
                "Falha de pressão",
                "Queda de energia",
                "Erro desconhecido",
                "Botão parar pressionado"
            ]
        },
        medidor: {
            groupPlaceholder: "Grupo do medidor",
            status: [
                "Monitorando",
                "Nível normal",
                "Bateria baixa"
            ],
            alerts: [
                "Nível abaixo do mínimo",
                "Nível acima do máximo",
                "Sem comunicação",
                "Falha no sensor"
            ]
        }
    };

    function escapeHtml(str) {
        return String(str ?? "").replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[c]));
    }

    function getDeviceOptions(category) {
        const eqCategory = EQUIP_CATEGORY_MAP[category];
        const farm = window.IcFarmGetActive?.();
        const equipments = farm?.equipments || [];
        return equipments
            .filter((eq) => eq.category === eqCategory)
            .map((eq) => ({ id: eq.id, label: eq.name || "" }));
    }

    function appendStatusRows(container, items) {
        items.forEach((label, i) => {
            const row = document.createElement("div");
            row.className = "notif-status-row";
            row.innerHTML = `
                <span class="notif-status-row__label">${escapeHtml(label)}</span>
                <label class="pivo-edit__switch">
                    <input type="checkbox" id="notifStatus_${i}">
                    <span class="pivo-edit__switch-slider"></span>
                </label>`;
            container.appendChild(row);
        });
    }

    function appendAlertCards(container, items) {
        items.forEach((label, i) => {
            const card = document.createElement("div");
            card.className = "notif-alert-card";
            card.innerHTML = `
                <div class="notif-alert-card__header">
                    <div class="notif-alert-card__heading">
                        <i class="fa-solid fa-chevron-down notif-alert-card__chevron"></i>
                        <span>${escapeHtml(label)}</span>
                    </div>
                    <label class="pivo-edit__switch" data-notif-stop>
                        <input type="checkbox" id="notifAlert_${i}">
                        <span class="pivo-edit__switch-slider"></span>
                    </label>
                </div>
                <div class="notif-alert-card__body">
                    <div class="notif-alert-card__sub-row">
                        <span class="notif-alert-card__sub-label"><i class="fa-solid fa-circle-exclamation"></i>Deseja habilitar os alertas críticos?</span>
                        <label class="pivo-edit__switch">
                            <input type="checkbox" id="notifAlertCrit_${i}">
                            <span class="pivo-edit__switch-slider"></span>
                        </label>
                    </div>
                </div>`;
            const header = card.querySelector(".notif-alert-card__header");
            header.addEventListener("click", (e) => {
                if (e.target.closest("[data-notif-stop]")) return;
                card.classList.toggle("is-expanded");
            });
            container.appendChild(card);
        });
    }

    function setupDeviceMultiselect(modal, category) {
        const wrap = modal.querySelector("#notifDevicesWrap");
        const trigger = modal.querySelector("#notifDevicesTrigger");
        const dropdown = modal.querySelector("#notifDevicesDropdown");
        const search = modal.querySelector("#notifDevicesSearch");
        const list = modal.querySelector("#notifDevicesList");
        const labelEl = modal.querySelector("#notifDevicesLabel");
        const field = modal.querySelector("#notifDevicesField");
        const errorEl = modal.querySelector("#notifDevicesError");
        if (!wrap || !trigger || !dropdown || !search || !list || !labelEl) return { hasSelection: () => true, showError: () => {} };

        const options = getDeviceOptions(category);
        const selected = new Set();

        field?.classList.remove("is-error");
        if (errorEl) errorEl.hidden = true;

        function updateLabel() {
            if (selected.size === 0) {
                labelEl.textContent = "Por favor selecione";
                labelEl.classList.add("ip-multiselect__label--placeholder");
            } else {
                const names = options.filter((o) => selected.has(o.id)).map((o) => o.label);
                labelEl.textContent = names.join(", ");
                labelEl.classList.remove("ip-multiselect__label--placeholder");
                field?.classList.remove("is-error");
                if (errorEl) errorEl.hidden = true;
            }
        }

        function renderList(filter = "") {
            const q = filter.toLowerCase();
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
                item.addEventListener("click", () => {
                    if (selected.has(o.id)) selected.delete(o.id); else selected.add(o.id);
                    item.classList.toggle("is-selected", selected.has(o.id));
                    updateLabel();
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

        function closeDropdown() {
            dropdown.style.display = "none";
            wrap.classList.remove("is-open");
        }

        renderList();
        updateLabel();

        trigger.onclick = (e) => {
            e.stopPropagation();
            const isOpen = dropdown.style.display !== "none";
            if (isOpen) { closeDropdown(); return; }
            positionDropdown();
            search.value = "";
            renderList();
            dropdown.style.display = "block";
            wrap.classList.add("is-open");
            search.focus();
        };

        search.oninput = () => renderList(search.value);

        document.addEventListener("click", function closeOut(e) {
            if (!wrap.contains(e.target) && !dropdown.contains(e.target)) {
                closeDropdown();
                document.removeEventListener("click", closeOut);
            }
        });

        return {
            hasSelection: () => selected.size > 0,
            showError: () => {
                field?.classList.add("is-error");
                if (errorEl) errorEl.hidden = false;
            }
        };
    }

    function bindAddNotificationModal(root) {
        const modal = root.querySelector("#notifAddModal");
        if (!modal) return;

        const openBtns = root.querySelectorAll("[data-notif-open]");
        const closeTriggers = modal.querySelectorAll("[data-notif-close]");
        const stepEls = Array.from(modal.querySelectorAll("[data-notif-step]"));
        const stepBodies = Array.from(modal.querySelectorAll(".notif-add-step"));
        const btnPrev = modal.querySelector("#btnNotifAddPrev");
        const btnNext = modal.querySelector("#btnNotifAddNext");
        const footer = modal.querySelector("#notifAddFooter");
        const allDayChk = modal.querySelector("#notifPeriodAllDay");
        const periodStart = modal.querySelector("#notifPeriodStart");
        const periodEnd = modal.querySelector("#notifPeriodEnd");
        const groupNameInput = modal.querySelector("#notifGroupName");
        const optListEl = modal.querySelector("#notifOptList");

        let currentStep = 0;
        let currentCategory = "pivo";
        let devicesApi = null;

        function renderStep() {
            stepEls.forEach((el, i) => el.classList.toggle("create-equip__step--active", i === currentStep));
            stepBodies.forEach((el, i) => { el.hidden = i !== currentStep; });
            const isLast = currentStep === stepBodies.length - 1;
            if (btnPrev) btnPrev.style.display = currentStep > 0 ? "" : "none";
            if (footer) footer.classList.toggle("no-prev", currentStep === 0);
            if (btnNext) btnNext.textContent = isLast ? "Enviar" : "Próximo";
        }

        function openModal(category) {
            currentStep = 0;
            currentCategory = category || "pivo";
            const opts = NOTIF_OPTIONS[currentCategory] || NOTIF_OPTIONS.pivo;

            if (groupNameInput) {
                groupNameInput.value = "";
                groupNameInput.placeholder = opts.groupPlaceholder;
            }
            if (optListEl) {
                optListEl.innerHTML = "";
                appendStatusRows(optListEl, opts.status);
                appendAlertCards(optListEl, opts.alerts);
            }
            devicesApi = setupDeviceMultiselect(modal, currentCategory);

            renderStep();
            modal.classList.add("is-open");
            modal.setAttribute("aria-hidden", "false");
            document.body.classList.add("is-modal-open");
        }

        function closeModal() {
            modal.classList.remove("is-open");
            modal.setAttribute("aria-hidden", "true");
            document.body.classList.remove("is-modal-open");
        }

        openBtns.forEach((btn) => btn.addEventListener("click", () => openModal(btn.dataset.notifCategory)));
        closeTriggers.forEach((el) => el.addEventListener("click", closeModal));

        if (allDayChk && periodStart && periodEnd) {
            allDayChk.addEventListener("change", () => {
                periodStart.disabled = allDayChk.checked;
                periodEnd.disabled = allDayChk.checked;
            });
        }

        if (btnPrev) {
            btnPrev.addEventListener("click", () => {
                if (currentStep > 0) { currentStep -= 1; renderStep(); }
            });
        }

        if (btnNext) {
            btnNext.addEventListener("click", () => {
                const isLast = currentStep === stepBodies.length - 1;
                if (!isLast) { currentStep += 1; renderStep(); return; }
                if (devicesApi && !devicesApi.hasSelection()) {
                    devicesApi.showError();
                    modal.querySelector("#notifDevicesField")?.scrollIntoView({ block: "center", behavior: "smooth" });
                    return;
                }
                closeModal();
            });
        }

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
        });
    }

    async function open() {
        const alreadyMounted = !!document.getElementById('notificacoesPanel');
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

    window.IcNotificacoes = { open, close };
})();
