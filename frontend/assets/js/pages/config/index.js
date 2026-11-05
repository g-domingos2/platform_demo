(function () {
    "use strict";
    const tMsg = (text) => window.IcI18n?.t?.(text) ?? text;

    const state = { isOpen: false };
    const $ = (id) => document.getElementById(id);
    const PREF_DEFS = {
        lang: {
            storageKey: "ic:lang",
            defaultValue: "pt-BR",
            labels: {
                "de-AT": "German (Austria)",
                en: "English",
                es: "Español",
                fr: "Français",
                hu: "Magyar",
                "pt-BR": "Português",
                ro: "Română",
                ru: "Русский",
                tr: "Türkçe",
            },
        },
        pivotClickAction: {
            storageKey: "ic:pivot-click-action",
            defaultValue: "details",
            labels: {
                details: "Ir para a tela de dispositivo",
                schedule: "Ir para o atalho de comando",
            },
        },
        cosmofieldClickAction: {
            storageKey: "ic:cosmofield-click-action",
            defaultValue: "modal",
            labels: {
                modal: "Abrir o modal de informações",
                details: "Ir para a tela de dispositivo",
            },
        },
        weatherStationClickAction: {
            storageKey: "ic:weather-station-click-action",
            defaultValue: "modal",
            labels: {
                modal: "Abrir o modal de informações",
                details: "Ir para a tela de dispositivo",
            },
        },
        pivotVisualStyle: {
            storageKey: "ic:pivot-visual-style",
            defaultValue: "solid",
            labels: {
                solid: "Preenchimento total",
                outer_band: "Somente borda externa (20%)",
            },
        },
    };

    function getActiveFarm() {
        try {
            const farms = JSON.parse(localStorage.getItem("ic_farms") || "[]");
            if (!Array.isArray(farms) || !farms.length) return null;
            const activeFarmId = sessionStorage.getItem("ic_active_farm") || sessionStorage.getItem("ic_active_farm_id");
            return farms.find((farm) => String(farm?.id || "") === String(activeFarmId || "")) || farms[0] || null;
        } catch (_) {
            return null;
        }
    }

    function refreshPivotMapPreview() {
        const activeFarm = getActiveFarm();
        if (activeFarm && typeof window.IcMapRenderPivots === "function") {
            window.IcMapRenderPivots(activeFarm);
        }
    }

    function syncPreferenceUI(root, prefKey, value) {
        const wrapper = root.querySelector(`.custom-select-wrapper[data-pref-key="${prefKey}"]`);
        const prefDef = PREF_DEFS[prefKey];
        if (!wrapper || !prefDef) return;

        const labelSpan = wrapper.querySelector(`[data-pref-label="${prefKey}"]`);
        if (labelSpan) {
            labelSpan.textContent = prefDef.labels[value] || prefDef.labels[prefDef.defaultValue] || "";
        }

        wrapper.querySelectorAll(".advanced-dropdown-item").forEach((item) => {
            item.classList.toggle("is-active", item.getAttribute("data-value") === value);
        });

        // Espelha a bandeira do item selecionado no botão (seletor de idioma)
        const activeItem = wrapper.querySelector(`.advanced-dropdown-item[data-value="${value}"]`);
        const infoFlag = wrapper.querySelector(".lang-select__info .lang-flag");
        const itemFlag = activeItem?.querySelector(".lang-flag");
        if (infoFlag && itemFlag) {
            infoFlag.src = itemFlag.src;
            infoFlag.alt = itemFlag.alt;
        }
    }

    function bindConfigUI() {
        const root = document.getElementById('configPanel');
        if (!root) return;

        const btnBack = root.querySelector('#configBack');
        if (btnBack) {
            btnBack.addEventListener('click', () => window.IcConfig?.close());
        }

        // Tabs logic
        const navItems = root.querySelectorAll('.edit-panel__nav-item');
        const sections = root.querySelectorAll('.edit-panel__section');
        const crumbsStrong = root.querySelector('.edit-panel__crumbs strong');

        navItems.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const targetSelector = btn.getAttribute('data-target');
                if (!targetSelector) return;

                const target = root.querySelector(targetSelector);
                if (!target) return;

                navItems.forEach(b => b.classList.remove('is-active'));
                sections.forEach(s => s.classList.remove('is-active'));

                btn.classList.add('is-active');
                target.classList.add('is-active');

                if (crumbsStrong) crumbsStrong.textContent = btn.textContent;
            });
        });

        // Sync theme toggle UI to current theme
        const themeGroup = root.querySelector('.toggle-group[data-pref-key="theme"]');
        if (themeGroup) {
            const savedTheme = localStorage.getItem('ic:theme') || 'light';
            themeGroup.querySelectorAll('.toggle-btn').forEach(b => {
                b.classList.toggle('is-active', b.dataset.value === savedTheme);
            });
        }

        // Toggle buttons
        root.addEventListener('click', (e) => {
            const btn = e.target.closest('.toggle-btn');
            if (btn) {
                const group = btn.closest('.toggle-group');
                if (group) {
                    group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('is-active'));
                    btn.classList.add('is-active');

                    if (group.dataset.prefKey === 'theme') {
                        const theme = btn.dataset.value || 'light';
                        localStorage.setItem('ic:theme', theme);
                        if (theme === 'dark') {
                            document.documentElement.setAttribute('data-theme', 'dark');
                        } else {
                            document.documentElement.removeAttribute('data-theme');
                        }
                    }
                }
                return;
            }

            // Eye icon toggle for passwords
            const eye = e.target.closest('.fa-eye, .fa-eye-slash');
            if (eye) {
                const input = eye.parentElement.querySelector('input');
                if (input) {
                    const isPassword = input.getAttribute('type') === 'password';
                    input.setAttribute('type', isPassword ? 'text' : 'password');
                    eye.classList.toggle('fa-eye-slash', !isPassword);
                    eye.classList.toggle('fa-eye', isPassword);
                }
                return;
            }

            // Advanced Dropdown toggle
            const select = e.target.closest('.js-advanced-select');
            if (select) {
                const dropdown = select.parentElement.querySelector('.advanced-dropdown-panel');
                if (dropdown) dropdown.classList.toggle('is-hidden');
                return;
            }

            // Close dropdown when clicking outside
            if (!e.target.closest('.custom-select-wrapper')) {
                root.querySelectorAll('.advanced-dropdown-panel').forEach(d => d.classList.add('is-hidden'));
            }

            // Select item logic
            const item = e.target.closest('.advanced-dropdown-item');
            if (item) {
                const value = item.getAttribute('data-value');
                const wrapper = item.closest('.custom-select-wrapper');

                if (wrapper) {
                    const prefKey = wrapper.dataset.prefKey;
                    wrapper.querySelector('.advanced-dropdown-panel').classList.add('is-hidden');
                    if (prefKey && PREF_DEFS[prefKey]) {
                        syncPreferenceUI(root, prefKey, value);
                        state.pendingPrefs = state.pendingPrefs || {};
                        state.pendingPrefs[prefKey] = value;
                    }
                }
                return;
            }

            // Save button logic
            const btnSave = e.target.closest('.btn-save-pref');
            if (btnSave) {
                let hasChanges = false;
                if (state.pendingPrefs) {
                    Object.keys(state.pendingPrefs).forEach(key => {
                        const prefDef = PREF_DEFS[key];
                        if (prefDef) {
                            localStorage.setItem(prefDef.storageKey, state.pendingPrefs[key]);
                            hasChanges = true;
                        }
                    });
                    if (state.pendingPrefs.pivotVisualStyle) {
                        refreshPivotMapPreview();
                    }
                    // Aplica o idioma escolhido em runtime (tradução pt-BR/en)
                    if (state.pendingPrefs.lang && window.IcI18n) {
                        window.IcI18n.setLang(state.pendingPrefs.lang);
                    }
                    delete state.pendingPrefs;
                }
                if (window.IcNotify) {
                    window.IcNotify.success('Configurações salvas com sucesso!');
                } else {
                    alert(tMsg('Configurações salvas com sucesso!'));
                }
                return;
            }
        });

        // Initialize values from localStorage
        Object.keys(PREF_DEFS).forEach((prefKey) => {
            const prefDef = PREF_DEFS[prefKey];
            const savedValue = localStorage.getItem(prefDef.storageKey) || prefDef.defaultValue;
            syncPreferenceUI(root, prefKey, savedValue);
        });
    }

    // positionOverlay compartilhado — ver assets/js/core/overlay-utils.js
    const positionOverlay = window.IcOverlay.positionOverlay;

    async function open() {
        if (state.isOpen) return;
        state.isOpen = true;

        // Fecha os painéis de edição se estiverem abertos
        window.Pivos?.views?.edit?.close?.();
        window.Bmb?.views?.edit?.close?.();
        window.Mdn?.views?.edit?.close?.();
        window.IcLineStarEdit?.close?.();

        // Guarda a rota ativa anterior do menu para restaurar ao voltar
        const prevActive = document.querySelector(".nav__item.is-active, .sidebar__footer-btn.is-active");
        state.prevRoute = prevActive ? prevActive.getAttribute("data-route") : null;

        try {
            let overlay = $("configOverlay");
            if (!overlay) {
                overlay = document.createElement("div");
                overlay.id = "configOverlay";
                overlay.className = "config-overlay";
                overlay.style.zIndex = 1200 + document.querySelectorAll(".config-overlay").length;
                document.body.appendChild(overlay);
            }
            positionOverlay(overlay);

            // Reposiciona se a sidebar colapsar/expandir ou a janela mudar de tamanho
            state.resizeObserver?.disconnect();
            const host = document.querySelector(".main");
            if (host && typeof ResizeObserver === "function") {
                state.resizeObserver = new ResizeObserver(() => positionOverlay(overlay));
                state.resizeObserver.observe(host);
            }

            const html = await fetch("./pages/config.html").then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); });
            overlay.innerHTML = html;
            bindConfigUI();

            // Anima a entrada (desliza da direita para a esquerda)
            requestAnimationFrame(() => {
                requestAnimationFrame(() => overlay.classList.add("is-open"));
            });
        } catch (err) {
            console.error("IcConfig: failed to open", err);
            state.isOpen = false;
            state.resizeObserver?.disconnect();
            $("configOverlay")?.remove();
        }
    }

    function close() {
        state.resizeObserver?.disconnect();
        state.resizeObserver = null;
        const overlay = $("configOverlay");
        const wasOpen = state.isOpen;
        state.isOpen = false;

        if (overlay) {
            overlay.classList.remove("is-open");
            setTimeout(() => overlay.remove(), 320);
        }

        // Restaura o item ativo do menu apenas se "config" ainda estiver selecionado
        // (se o usuário navegou para outra rota, o setActive dela já assumiu)
        if (wasOpen && state.prevRoute) {
            const configActive = document.querySelector('[data-route="config"].is-active');
            if (configActive) {
                document.querySelectorAll(".nav__item, .sidebar__footer-btn").forEach((a) => {
                    a.classList.toggle("is-active", a.getAttribute("data-route") === state.prevRoute);
                });
            }
        }
        state.prevRoute = null;
    }

    window.IcConfig = { open, close };

})();
