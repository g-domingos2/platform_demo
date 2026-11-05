// assets/js/pages/pivos/index.js
(function () {
    "use strict";

    const Pivos = (window.Pivos = window.Pivos || {});
    const state = (Pivos.state = Pivos.state || {});
    const views = (Pivos.views = Pivos.views || {});

    function getActiveFarm() {
        return window.IcFarmGetActive?.() || window.icFarmData || window.IcFarmActive || null;
    }

    function getDefaultPivotId() {
        const farm = getActiveFarm();
        const equipments = Array.isArray(farm?.equipments) ? farm.equipments : [];
        const pivot = equipments.find((equip) => {
            const category = String(equip?.category || "").toLowerCase();
            return category === "pivos" || category === "pivo" || category === "pivot" || category === "pivots";
        });
        if (pivot?.id) return pivot.id;

        const legacyPivots = Array.isArray(farm?.pivos) ? farm.pivos : [];
        return legacyPivots[0]?.id || null;
    }

    function isDetailsOpen() {
        return document.body.classList.contains("is-pivo-details") && !!document.getElementById("pivoSelectBtn");
    }

    function normalizeControllerType(value) {
        return String(value || "")
            .toLowerCase()
            .replaceAll(" ", "")
            .replaceAll("_", "");
    }

    function isCenterstarName(value) {
        const n = String(value || "").toLowerCase().replace(/[\s_]/g, "").replace(/[^a-z0-9]/g, "");
        return n.startsWith("centerstar") || n.startsWith("centerstart");
    }

    function resolveDetailsVariantKey(pivotId) {
        const pivotData = Pivos.data?.getPivotData?.(pivotId) || null;
        const names = [pivotData?.name, pivotData?.nome, pivotData?.data?.name, pivotData?.data?.nome];
        if (names.some(isCenterstarName)) return "centerstar";
        const controllerType = normalizeControllerType(pivotData?.controllerType || pivotData?.type);
        return controllerType === "smarttouch" ? "smarttouch" : "default";
    }

    window.IcPivos = {
        async open(options = {}) {
            const pivotId = options.pivotId ?? null;
            const fromMap = options.fromMap === true;
            const focusSection = options.focusSection === "details" ? "details" : null;
            let resolvedPivotId = pivotId != null ? pivotId : getDefaultPivotId();
            const nextVariantKey = resolveDetailsVariantKey(resolvedPivotId);

            if (resolvedPivotId != null) state.selectedId = resolvedPivotId;

            // If already open, do not rebuild the HTML.
            // Just refresh the UI for the new pivot.
            if (isDetailsOpen()) {
                if (String(state.activeDetailsVariant || "default") !== nextVariantKey) {
                    if (views.details && typeof views.details.destroyView === "function") {
                        views.details.destroyView();
                    } else if (views.details && typeof views.details.destroyMinimap === "function") {
                        views.details.destroyMinimap();
                    }

                    const slot = document.getElementById("pageSlot");
                    if (slot) slot.innerHTML = "";
                    document.body.classList.remove("is-pivo-details", "is-pivo-details-only");
                } else {
                    if (views.details && typeof views.details.updateSelected === "function") {
                        await views.details.updateSelected(state.selectedId);
                    } else if (views.details && typeof views.details.renderHeaderAndKPIs === "function") {
                        views.details.renderHeaderAndKPIs();
                    }

                    if (views.charts && typeof views.charts.renderCharts === "function") {
                        views.charts.renderCharts();
                    }

                    // Clique no mapa: rola até o painel. Seletor: fica no lugar.
                    if (focusSection && views.details && typeof views.details.scrollToSection === "function") {
                        requestAnimationFrame(() => views.details.scrollToSection(focusSection));
                        setTimeout(() => views.details.scrollToSection(focusSection), 220);
                    } else if (fromMap) {
                        const slot = document.getElementById("pageSlot");
                        if (slot) slot.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                    return;
                }
            }

            state.activeDetailsVariant = nextVariantKey;

            // First opening: mount the view.
            if (views.details && typeof views.details.showMainView === "function") {
                await views.details.showMainView({ focusSection });
            } else {
                console.warn("Pivos views.details.showMainView is not available yet.");
            }
        },

        close() {
            if (views.details && typeof views.details.destroyView === "function") {
                views.details.destroyView();
            } else if (views.details && typeof views.details.destroyMinimap === "function") {
                // fallback (caso você ainda não tenha o destroyView no view.details)
                views.details.destroyMinimap();
            }

            document.body.classList.remove("is-pivo-details");
            document.body.classList.remove("is-pivo-details-only");
            state.selectedId = null;
            state.activeDetailsVariant = "default";

            const slot = document.getElementById("pageSlot");
            if (slot) slot.innerHTML = "";

            if (window.icMapSetWheelMode) {
                window.icMapSetWheelMode("free");
            }

            const map = window.icMap;
            if (map && typeof map.invalidateSize === "function") {
                map.invalidateSize({ pan: false });
                requestAnimationFrame(() => map.invalidateSize({ pan: false }));
                setTimeout(() => map.invalidateSize({ pan: false }), 220);
            }

            window.dispatchEvent(new Event("ic:layout-change"));
        }
    };
})();
