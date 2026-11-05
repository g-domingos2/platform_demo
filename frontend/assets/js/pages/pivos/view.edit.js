// assets/js/pages/pivos/view.edit.js
(function () {
    "use strict";
  const tMsg = (text) => window.IcI18n?.t?.(text) ?? text;

    const Pivos = (window.Pivos = window.Pivos || {});
    const state = (Pivos.state = Pivos.state || {});
    const views = (Pivos.views = Pivos.views || {});
    const edit = (views.edit = views.edit || {});
    const $ = (id) => document.getElementById(id);

    // positionEditOverlay compartilhado — ver assets/js/core/overlay-utils.js
    const positionEditOverlay = window.IcOverlay.positionOverlay;

    async function mountEditPanel(container) {
        const slot = container || $("pageSlot");
        if (!slot) return false;

        destroyEditState();

        const pivoData = Pivos.data?.getPivotData?.(state.selectedId) || null;
        const templatePath = isSmartTouchFamilyPivot(pivoData)
            ? "./pages/pivo-smarttouch-edit.html"
            : "./pages/pivo-edit.html";

        try {
            // Reaproveita o cache de templates compartilhado (ver view.details).
            // O HTML da edição tem ~96 KB e era rebaixado a cada abertura.
            const html = typeof Pivos._loadTemplateCached === "function"
                ? await Pivos._loadTemplateCached(templatePath)
                : await fetch(templatePath).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); });
            slot.innerHTML = html;
            // O painel já está no DOM: uma falha ao ligar os controles não pode
            // fazer mountEditPanel reportar erro e descartar a tela inteira.
            try {
                bindEditUI();
            } catch (err) {
                console.error("Falha ao ligar os controles da edição do pivô.", err);
            }
            try {
                if (isCenterstarFamilyPivot(pivoData)) applyCenterstarEditTranslations();
            } catch (err) {
                console.error("Falha ao aplicar as traduções do Centerstar.", err);
            }
            return true;
        } catch (err) {
            console.error(`Failed to load ${templatePath}`, err);
            return false;
        }
    }

    function getFarmDataSafe() {
        // Tenta pegar a ativa
        let farm = window.IcFarmGetActive?.() || window.icFarmData || window.IcFarmActive;
        
        // Verifica se essa fazenda realmente contém o pivô que estamos editando
        const hasPivot = (f) => {
            if (!f || !state.selectedId) return false;
            const equips = [...(Array.isArray(f.equipments) ? f.equipments : []), ...(Array.isArray(f.equipamentos) ? f.equipamentos : [])];
            const legacy = Array.isArray(f.pivos) ? f.pivos : [];
            return equips.some(e => String(e.id).trim() === String(state.selectedId).trim()) || 
                   legacy.some(p => String(p.id).trim() === String(state.selectedId).trim());
        };

        if (hasPivot(farm)) return farm;

        // Se não tem, busca em todas
        const allFarms = window.IcFarmsAll || window.Cad?.data?.getAllFarms?.() || [];
        for (const f of allFarms) {
            if (hasPivot(f)) return f;
        }

        return farm || null;
    }

    function isPivotEquipment(item) {
        const category = String(item?.category || "").toLowerCase();
        const type = String(item?.type || item?.controllerType || "").toLowerCase();
        return category === "pivos" || category === "pivo" || category === "pivot" || category === "pivots"
            || type === "smart_connect" || type === "smarttouch";
    }

    function toFiniteNumber(value) {
        return window.IcNumeric.toFiniteNumber(value);
    }

    // Nenhum pivô real passa disso — usado só pra descartar raio/distância
    // corrompidos (dado antigo salvo com valor cru, sem arredondar) em vez de
    // exibir números absurdos tipo "5185614,33 m" na tela.
    const MAX_SANE_PIVOT_RADIUS_M = 3000;
    function saneRadiusValue(value) {
        const n = toFiniteNumber(value);
        return (Number.isFinite(n) && n > 0 && n <= MAX_SANE_PIVOT_RADIUS_M) ? n : null;
    }

    function normalizePivotFamilyToken(value) {
        return String(value || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "");
    }

    function isSmartTouchFamilyPivot(pivotLike = null) {
        const controllerType = normalizePivotFamilyToken(pivotLike?.controllerType);
        const type = normalizePivotFamilyToken(pivotLike?.type);
        const name = normalizePivotFamilyToken(pivotLike?.name || pivotLike?.nome);

        return controllerType === "smarttouch"
            || type === "smarttouch"
            || name === "smarttouch"
            || name === "centerstar"
            || name === "centerstart";
    }

    function isCenterstarFamilyPivot(pivotLike = null) {
        const name = normalizePivotFamilyToken(pivotLike?.name || pivotLike?.nome);
        return name.startsWith("centerstar") || name.startsWith("centerstart");
    }

    // Teto de segmentos (canhão e segmentos de irrigação): SmartTouch/Centerstar ficam em 6,
    // Nexus/SmartConnect em 9. Centralizado aqui para não divergir entre os pontos que usam o limite.
    function getSegmentCapForPivot(pivotLike = null) {
        return isSmartTouchFamilyPivot(pivotLike) ? 6 : 9;
    }

    function applyCenterstarEditTranslations() {
        const panel = document.getElementById("pivoEditPanel");
        if (!panel) return;

        const setText = (el, text) => { if (el) el.textContent = text; };
        const setInnerHTML = (el, html) => { if (el) el.innerHTML = html; };
        const attr = (el, name, val) => { if (el) el.setAttribute(name, val); };
        const qs = (sel) => panel.querySelector(sel);
        const qsa = (sel) => panel.querySelectorAll(sel);

        // Titlebar
        const backSpan = qs("#pivoEditBack span");
        setText(backSpan, "Editar Pivô");
        attr(qs("#pivoEditBack"), "aria-label", "Voltar");
        attr(qs("#pivoEditSelectBtn"), "aria-label", "Selecionar Centerstar");

        const saveBtn = qs(".edit-panel__save");
        if (saveBtn) {
            const icon = saveBtn.querySelector("i");
            saveBtn.textContent = " Salvar";
            if (icon) saveBtn.prepend(icon);
        }

        // Tabs
        const tabs = qsa(".edit-panel__tab");
        const tabLabels = { config: "Configurações", history: "Histórico" };
        tabs.forEach(btn => {
            const key = btn.dataset.tab;
            if (tabLabels[key]) setText(btn, tabLabels[key]);
        });
        attr(qs(".edit-panel__tabs"), "aria-label", "Seções");

        // Nav items (config)
        const navItems = qs(".edit-panel__tab-body[data-tab-body='config'] .edit-panel__nav");
        if (navItems) {
            const navMap = {
                "#pivoEditGeneral": "Geral",
                "#pivoEditLocation": "Localização e Segmentos",
                "#pivoEditCanhao": "Canhão Final",
                "#pivoEditHorarios": "Horários de Pico",
                "#pivoEditFirmware": "Firmware"
            };
            navItems.querySelectorAll(".edit-panel__nav-item").forEach(btn => {
                const target = btn.dataset.target;
                if (navMap[target]) setText(btn, navMap[target]);
            });
            attr(navItems, "aria-label", "Atalhos");

            // Adiciona botão Bombeamento após Geral (somente se ainda não existe)
            if (!navItems.querySelector('[data-target="#pivoEditBombeamento"]')) {
                const geralBtn = navItems.querySelector('[data-target="#pivoEditGeneral"]');
                if (geralBtn) {
                    const bombaBtn = document.createElement("button");
                    bombaBtn.className = "edit-panel__nav-item";
                    bombaBtn.type = "button";
                    bombaBtn.dataset.target = "#pivoEditBombeamento";
                    bombaBtn.dataset.bound = "1";
                    bombaBtn.textContent = "Bombeamento";
                    bombaBtn.addEventListener("click", () => {
                        const nav = bombaBtn.closest(".edit-panel__nav");
                        const body = bombaBtn.closest(".edit-panel__body");
                        if (nav) nav.querySelectorAll(".edit-panel__nav-item").forEach(item => item.classList.toggle("is-active", item === bombaBtn));
                        if (body) body.querySelectorAll(".edit-panel__section").forEach(section => section.classList.toggle("is-active", `#${section.id}` === "#pivoEditBombeamento"));
                    });
                    geralBtn.insertAdjacentElement("afterend", bombaBtn);
                }
            }

            // Injeta seção Bombeamento no conteúdo (somente se ainda não existe)
            if (!qs("#pivoEditBombeamento")) {
                const geralSection = qs("#pivoEditGeneral");
                if (geralSection) {
                    const lastComm = geralSection.querySelector(".edit-panel__section-head span")?.textContent || "";
                    const bombaSection = document.createElement("section");
                    bombaSection.className = "edit-panel__section";
                    bombaSection.id = "pivoEditBombeamento";
                    bombaSection.innerHTML = `
                        <div class="edit-panel__section-head">
                            <h2 style="color:rgba(0,0,0,0.88);font-weight:600;font-size:30px;margin-bottom:0.5em;line-height:1.2666666666666666;">Bombeamento</h2>
                            <span style="font-size:12px;color:rgba(0,0,0,0.45);">${lastComm}</span>
                        </div>
                        <div class="edit-panel__section-body pivo-edit-specifics edit-panel__section-body--stack">
                            <h3 class="pref-section-title" style="margin-top: 0;">Ficha Técnica</h3>
                            <div class="sc-config" style="font-size: 14px;">
                                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;">
                                    <div class="sc-field">
                                        <label class="equip-label" for="stPumpPower"><span class="equip-required">*</span> Potência elétrica <span class="edit-panel__tooltip-icon" data-tooltip="Potência real (absorvida): energia efetivamente absorvida da rede elétrica para operar o equipamento no ponto de trabalho atual, considerando o rendimento e a conversão para o sistema internacional de unidades."><i class="fa-regular fa-circle-question"></i></span></label>
                                        <div class="sc-input-group">
                                            <input class="equip-input sc-input" id="stPumpPower" type="number" min="0" step="0.01" value="">
                                            <span class="sc-input-suffix">kW</span>
                                        </div>
                                    </div>
                                    <div class="sc-field">
                                        <label class="equip-label" for="stPumpFlow"><span class="equip-required">*</span> Vazão</label>
                                        <div class="sc-input-group">
                                            <input class="equip-input sc-input" id="stPumpFlow" type="number" min="0" step="0.01" value="">
                                            <span class="sc-input-suffix">m³/h</span>
                                        </div>
                                    </div>
                                    <div class="sc-field">
                                        <label class="equip-label" for="stPumpIrrigRate">Lâmina de irrigação <span class="edit-panel__tooltip-icon" data-tooltip="Irrigation Rate 100% = VAZ × (2π × RUT × AMT / 360) / VUT / (π × RTI² × AMT / 10000 / 360) × 0.1"><i class="fa-regular fa-circle-question"></i></span></label>
                                        <div class="sc-input-group">
                                            <input class="equip-input sc-input" id="stPumpIrrigRate" type="text" value="" readonly style="background:#f8fafc;color:#94a3b8;cursor:not-allowed;">
                                            <span class="sc-input-suffix">mm</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                    geralSection.insertAdjacentElement("afterend", bombaSection);
                }
            }
        }

        // Section: General
        const radiolabel = qs("#pivoEditRadioCentral")?.closest(".edit-panel__field-box")?.querySelector("label");
        setText(radiolabel, "ID do equipamento");

        const nameLabel = qs("#pivoEditName")?.closest(".edit-panel__field-box")?.querySelector("label");
        if (nameLabel) setInnerHTML(nameLabel, '<span class="edit-panel__req">*</span> Nome do equipamento');

        const clearBtn = qs("#pivoEditName")?.closest(".edit-panel__field-box")?.querySelector("button");
        attr(clearBtn, "aria-label", "Limpar campo");

        // O titulo ja pode estar traduzido pelo i18n: aceita qualquer idioma suportado.
        const findH3 = (...titulos) => [...qsa("#pivoEditGeneral h3")].find(h => titulos.includes(h.textContent.trim()));

        const dadosGeraisH3 = findH3("Dados gerais", "General data", "Datos generales");
        setText(dadosGeraisH3, "Dados gerais");

        const opModeH3 = findH3("Modo de Operação", "Operation Mode", "Modo de operación");
        setText(opModeH3, "Modo de Operação");

        // Stop position label
        const stopLabel = qs("#pivoEditStopPos")?.closest("div[style*='flex: 1']")?.querySelector("label");
        if (stopLabel) setInnerHTML(stopLabel, '<span class="edit-panel__req" style="color: #ef4444;">*</span> Posição de parada <span class="edit-panel__tooltip-icon" data-tooltip="Modo de estacionamento. O pivô se move até a posição de parada configurada e permanece estacionado nessa posição."><i class="fa-regular fa-circle-question"></i></span>');

        // Intermediate position label
        const interLabel = qs("#pivoEditInterPos")?.closest("div[style*='flex: 1']")?.querySelector("label");
        if (interLabel) setInnerHTML(interLabel, '<span class="edit-panel__req" style="color: #ef4444;">*</span> Posição intermediária <span class="edit-panel__tooltip-icon" data-tooltip="Modo intermediário. O pivô se move até a posição intermediária configurada e permanece nessa posição."><i class="fa-regular fa-circle-question"></i></span>');

        // Section: Location
        const locH3 = qs(".pivo-edit__loc-form h3");
        setText(locH3, "Localização");

        const locDesc = qs(".pivo-edit__loc-form p");
        setText(locDesc, "A localização em campo do dispositivo é essencial para mostrar geograficamente no mapa a posição do equipamento.");

        const centerLabel = qs("#pivoEditLocCenter")?.closest(".pivo-edit__field")?.querySelector("label");
        if (centerLabel) setInnerHTML(centerLabel, '<span class="edit-panel__req">*</span> Localização do centro <span class="edit-panel__tooltip-icon" data-tooltip="Localização do centro do pivô."><i class="fa-regular fa-circle-question"></i></span>');

        const refLabel = qs("#pivoEditRefDist,#pivoEditLocRef")?.closest(".pivo-edit__field")?.querySelector("label");
        if (refLabel) setInnerHTML(refLabel, '<span class="edit-panel__req">*</span> Raio total irrigado <span class="edit-panel__tooltip-icon" data-tooltip="Distância do centro do pivô até o final do último tubo do pivô."><i class="fa-regular fa-circle-question"></i></span>');

        // "Obter Localização" buttons (apenas os do formulário de localização,
        // para não sobrescrever botões como "Ver Faixas de Energia")
        qsa(".pivo-edit__loc-form .edit-panel__btn").forEach(btn => {
            if (btn.id === "pivoEditSetSystemLengthBtn") return;
            const icon = btn.querySelector("i");
            btn.textContent = " Obter Localização";
            if (icon) btn.prepend(icon);
        });

        // System Length button — keep red pin icon
        const sysLenBtn = $("pivoEditSetSystemLengthBtn");
        if (sysLenBtn) {
            const sysIcon = sysLenBtn.querySelector("i");
            sysLenBtn.textContent = " Obter Localização";
            if (sysIcon) sysLenBtn.prepend(sysIcon);
        }

        // Radius label
        const radiusLabel = qs("#pivoEditLocRadius")?.closest(".pivo-edit__field, .edit-panel__field-box")?.querySelector("label");
        if (radiusLabel && /Raio|radius/i.test(radiusLabel.textContent)) {
            setInnerHTML(radiusLabel, '<span class="edit-panel__req">*</span> Raio de irrigação (m)');
        }

        // Cardinal buttons
        const cardinalAlignLabel = qs(".pivo-cardinal-btns")?.previousElementSibling;
        setInnerHTML(cardinalAlignLabel, 'Alinhar ângulo zero (selecione um dos pontos cardeais ou demarque no mapa) <span class="edit-panel__tooltip-icon" data-tooltip="Ponto de referência 0° do pivô. Selecione um ponto cardeal (N, L, S, O) ou demarque no mapa."><i class="fa-regular fa-circle-question"></i></span>');

        const lBtn = qs(".pivo-cardinal-btn[data-bearing='90']");
        if (lBtn) { lBtn.textContent = "L"; lBtn.title = "Leste"; }
        const oBtn = qs(".pivo-cardinal-btn[data-bearing='270']");
        if (oBtn) { oBtn.textContent = "O"; oBtn.title = "Oeste"; }
        const nBtn = qs(".pivo-cardinal-btn[data-bearing='0']");
        if (nBtn) nBtn.title = "Norte";
        const sBtn = qs(".pivo-cardinal-btn[data-bearing='180']");
        if (sBtn) sBtn.title = "Sul";

        // Max angle
        const maxAngLabel = qs("#pivoEditLocMaxAng")?.closest(".pivo-edit__field")?.querySelector("label");
        if (maxAngLabel) setInnerHTML(maxAngLabel, '<span class="edit-panel__req">*</span> Ângulo máximo de trabalho <span class="edit-panel__tooltip-icon" data-tooltip="Define o ângulo máximo de trabalho do pivô. Use 360° para irrigação em círculo completo, ou um valor menor para um pivô setorial."><i class="fa-regular fa-circle-question"></i></span>');
        const maxAngHint = qs("#pivoEditLocMaxAng")?.closest(".pivo-edit__field")?.querySelector("span[style*='10px']");
        setText(maxAngHint, "Entre 1 e 360");

        // Section: Segments
        const segPlanH3 = qs(".pivo-edit__segments-section h3");
        setText(segPlanH3, "Segmentos");

        const segDesc = qs(".pivo-edit__segments-section p");
        setText(segDesc, "É comum segmentar o pivô em faixas de ângulos para representar diferentes sementes, cultivos ou manejos. Isso facilita a visualização dos dados e o controle da irrigação em diferentes lâminas. Com esta funcionalidade, você pode segmentar o seu pivô para facilitar os comandos de irrigação durante a safra.");

        const presetLabel = qs(".pivo-preset-row")?.previousElementSibling;
        setText(presetLabel, "Configuração automática");

        const segNameLabel = qs("#pivoEditSegName")?.closest(".pivo-edit__field")?.querySelector("label");
        setText(segNameLabel, "Nome de identificação");
        const segNameInput = qs("#pivoEditSegName");
        segNameInput?.removeAttribute("placeholder");

        const segStartLabel = qs("#pivoEditSegStartAng")?.closest(".pivo-edit__field")?.querySelector("label");
        if (segStartLabel) setInnerHTML(segStartLabel, '<span class="edit-panel__req">*</span> Ângulo inicial');
        const segEndLabel = qs("#pivoEditSegEndAng")?.closest(".pivo-edit__field")?.querySelector("label");
        if (segEndLabel) setInnerHTML(segEndLabel, '<span class="edit-panel__req">*</span> Ângulo final');

        // Section: End Gun (Canhão)
        const canhao1H3 = qs("#pivoEditCanhao1Section > h3");
        setText(canhao1H3, "Canhão 1");
        const canhao2H3 = qs("#pivoEditCanhao2Section > h3");
        setText(canhao2H3, "Canhão 2");

        [1, 2].forEach(idx => {
            const infoBox = qs(`#pivoEditCanhao${idx}Section .fa-circle-info`)?.parentElement;
            if (infoBox) {
                const icon = infoBox.querySelector("i");
                infoBox.textContent = " Você pode criar até 6 segmentos por canhão. Configure os ângulos onde o canhão deve ligar.";
                if (icon) infoBox.prepend(icon);
            }
            const activeSegsH3 = qs(`#pivoEditCanhaoSegmentList${idx}`)?.previousElementSibling;
            setText(activeSegsH3, "Você pode criar até 6 segmentos por canhão. Configure os ângulos onde o canhão deve ligar.");

            const startLabel = qs(`#pivoEditCanhaoSegStart${idx}`)?.closest(".pivo-edit__field")?.querySelector("label");
            setText(startLabel, "Ângulo inicial");
            const startHint = qs(`#pivoEditCanhaoSegStart${idx}`)?.closest(".pivo-edit__field")?.querySelector("div[style*='10px']");
            setText(startHint, "Máximo de 360");

            const endLabel = qs(`#pivoEditCanhaoSegEnd${idx}`)?.closest(".pivo-edit__field")?.querySelector("label");
            setText(endLabel, "Ângulo final");
            const endHint = qs(`#pivoEditCanhaoSegEnd${idx}`)?.closest(".pivo-edit__field")?.querySelector("div[style*='10px']");
            setText(endHint, "Máximo de 360");
        });

        // History tab nav
        const histNav = qs(".edit-panel__tab-body[data-tab-body='history'] .edit-panel__nav");
        if (histNav) {
            attr(histNav, "aria-label", "Histórico");
            const histNavItems = histNav.querySelectorAll(".edit-panel__nav-item");
            const histMap = { "#pivoEditHistoryList": "Histórico de Configurações", "#pivoEditHistoryFavs": "Favoritos" };
            histNavItems.forEach(btn => {
                const key = btn.dataset.target;
                if (histMap[key]) setText(btn, histMap[key]);
            });
        }

        // History table toolbar
        setText(qs(".edit-panel__history-table-toolbar h3"), "Lista");

        // History table headers — só as tabelas principais (não as mini-tabelas
        // Nome/Protocolo/Valor aninhadas na linha de detalhe), senão a contagem
        // de índice escorrega e reescreve headers errados dentro do detalhe.
        const thMap = ["", "Data", "Usuário", "Status Controlador", "Ações"];
        qsa(".edit-panel__history-table-container > table.edit-panel__history-table thead th").forEach((th, i) => {
            if (i > 0 && thMap[i]) setText(th, thMap[i]);
        });

        // Hide "Irrigation radius" display field (not needed for CenterStar)
        const irrigRadiusField = qs("#pivoEditLocRadius[data-loc-bound]")?.closest(".edit-panel__field-box");
        if (irrigRadiusField) irrigRadiusField.style.display = "none";

        // Hide "Tipo de comunicação" field (CenterStar é sempre 4G, campo não se aplica)
        const commTypeField = qs("#pivoEditCommType")?.closest(".sc-field")?.parentElement;
        if (commTypeField) commTypeField.style.display = "none";
    }

    function formatInputNumber(value, digits = 2) {
        const num = toFiniteNumber(value);
        return Number.isFinite(num) ? String(Number(num.toFixed(digits))) : "";
    }

    // Exibe sempre com 2 casas decimais, com ponto
    function setFixed2Input(input, value) {
        if (!input) return;
        const num = toFiniteNumber(value);
        if (!Number.isFinite(num)) { input.value = ""; return; }
        input.value = num.toFixed(2);
    }

    function distanceMetersBetweenPoints(a, b) {
        if (!a || !b) return null;

        if (window.L?.latLng) {
            return L.latLng(a.lat, a.lng).distanceTo(L.latLng(b.lat, b.lng));
        }

        const toRad = (deg) => (deg * Math.PI) / 180;
        const earthRadius = 6378137;
        const dLat = toRad(b.lat - a.lat);
        const dLng = toRad(b.lng - a.lng);
        const lat1 = toRad(a.lat);
        const lat2 = toRad(b.lat);
        const sinDLat = Math.sin(dLat / 2);
        const sinDLng = Math.sin(dLng / 2);
        const hav = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
        return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(hav)));
    }

    function getCurrentCenterPoint() {
        return parseLL($("pivoEditLocCenter")?.value || "")
            || (Number.isFinite(toFiniteNumber(pivoGlobalData?.center?.lat)) && Number.isFinite(toFiniteNumber(pivoGlobalData?.center?.lng))
                ? { lat: Number(pivoGlobalData.center.lat), lng: Number(pivoGlobalData.center.lng) }
                : null);
    }

    function syncRefDistDisplay(refLat, refLng) {
        const cPt = safeMarkerLatLng(locationCenterMarker);
        const cStr = $("pivoEditLocCenter")?.value || "";
        const c = cPt || parseLL(cStr);
        if (!c) return;
        const dist = L.latLng(c.lat, c.lng).distanceTo(L.latLng(refLat, refLng));
        setFixed2Input($("pivoEditRefDist"), dist);
        setFixed2Input($("pivoEditSystemLength"), dist);
        const angleLL = $("pivoEditAngleLatLng");
        if (angleLL && document.activeElement !== angleLL) angleLL.value = fmtLL(refLat, refLng);
        syncDisplayFields(dist);
    }

    function syncDisplayFields(radius) {
        // Sempre roda (mesmo com raio inválido/corrompido) pra nunca deixar
        // "Raio total irrigado"/"Área irrigada" com o valor do pivô anterior
        // pendurado na tela, e nunca exibir um raio fora do fisicamente possível.
        const saneR = saneRadiusValue(radius);
        const raioTotalInput = $("pivoEditRaioTotal");
        if (raioTotalInput) raioTotalInput.value = Number.isFinite(saneR) ? saneR.toFixed(2) : "";

        const maxAng = parseFloat($("pivoEditLocMaxAng")?.value) || 360;
        const anguloMax = $("pivoEditAnguloMax");
        if (anguloMax) anguloMax.value = maxAng;

        const areaHa = Number.isFinite(saneR) ? (Math.PI * saneR * saneR * (maxAng / 360)) / 10000 : NaN;
        const area = $("pivoEditArea");
        if (area) area.value = Number.isFinite(areaHa) ? areaHa.toFixed(2) : "";
        const irrigAreaInput = $("pivoEditIrrigArea");
        if (irrigAreaInput) irrigAreaInput.value = Number.isFinite(areaHa) ? areaHa.toFixed(2) : "";
    }

    function getCurrentLastTowerPoint() {
        const fromInput = parseLL($("pivoEditLocLastTower")?.value || "");
        if (fromInput) return fromInput;

        const lat = toFiniteNumber(pivoGlobalData?.lastTowerLat);
        const lng = toFiniteNumber(pivoGlobalData?.lastTowerLng);
        return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    }

    function getDerivedLastTowerDistance() {
        const center = getCurrentCenterPoint();
        const lastTower = getCurrentLastTowerPoint();
        const derived = saneRadiusValue(distanceMetersBetweenPoints(center, lastTower));
        if (Number.isFinite(derived) && derived > 0) return Number(derived.toFixed(2));

        const saved = saneRadiusValue(pivoGlobalData?.lastTowerRadius);
        return Number.isFinite(saved) && saved > 0 ? Number(saved.toFixed(2)) : null;
    }

    function syncSmartTouchLocationCopy() {
        if (!isSmartTouchFamilyPivot(pivoGlobalData) && !$("pivoEditIrrigationRadius")) return;

        const radiusInput = $("pivoEditLocRadius");
        const lastTowerInput = $("pivoEditLocLastTower");

        const radiusLabel = radiusInput?.closest(".pivo-edit__field")?.querySelector("label");
        if (radiusLabel) radiusLabel.innerHTML = '<span class="edit-panel__req">*</span> Raio de irrigação (m)';
        if (radiusInput) radiusInput.placeholder = "Usado para desenhar o pivô no mapa";

        const lastTowerLabel = lastTowerInput?.closest(".pivo-edit__field")?.querySelector("label");
        if (lastTowerLabel) lastTowerLabel.textContent = "Coordenada da ultima torre";
        if (lastTowerInput) {
            lastTowerInput.type = "text";
            lastTowerInput.placeholder = "Ex: -18.849702, -48.391492";
        }

    }

    function syncSmartTouchGeneralFields(options = {}) {
        if (!isSmartTouchFamilyPivot(pivoGlobalData) && !$("pivoEditIrrigationRadius")) return;

        syncSmartTouchLocationCopy();

        const radiusInput = $("pivoEditLocRadius");
        const irrigationRadiusInput = $("pivoEditIrrigationRadius");
        const lastTowerDistanceInput = $("pivoEditLastTowerDistance");

        if (radiusInput && irrigationRadiusInput) {
            if (options.source === "general-radius") {
                radiusInput.value = irrigationRadiusInput.value || "";
            } else if (options.source === "location-radius" || !irrigationRadiusInput.value) {
                irrigationRadiusInput.value = radiusInput.value || "";
            }
        }

        if (lastTowerDistanceInput) {
            const shouldReplaceDistance = options.force
                || options.source === "last-tower"
                || (!lastTowerDistanceInput.dataset.userEdited && !lastTowerDistanceInput.dataset.markerPlaced);

            if (shouldReplaceDistance) {
                const derived = getDerivedLastTowerDistance();
                // Only auto-fill if there's a saved value from the pivot data — never derive from wrong points
                if (derived !== null && lastTowerDistanceInput.dataset.markerPlaced) {
                    lastTowerDistanceInput.value = formatInputNumber(derived);
                }
            }
        }
    }

    function syncPressureFields() {
        const pressureEl = $("scPressure");
        const val = pressureEl?.value || "pressostato";
        const isDisabled = val === "desabilitado";
        const isSensor = val === "sensor";

        [$("scPumpTime"), $("scDelayTime"), $("scUnstableTime")].forEach(el => {
            if (!el) return;
            el.disabled = isDisabled;
            el.closest(".pivo-edit__field")?.classList.toggle("is-disabled", isDisabled);
        });

        [$("scSensorMin"), $("scSensorMax"), $("scSensorScale")].forEach(el => {
            if (!el) return;
            el.disabled = isDisabled || !isSensor;
            el.closest(".pivo-edit__field")?.classList.toggle("is-disabled", isDisabled || !isSensor);
        });
    }

    function normalizeAngle(value, fallback = 0) {
        const num = Number(value);
        if (!Number.isFinite(num)) return fallback;
        return ((num % 360) + 360) % 360;
    }

    function roundAngle(value) {
        const num = Number(value);
        return Number.isFinite(num) ? Math.round(num * 100) / 100 : 0;
    }

    function cloneSegmentsForSave() {
        const raw = Array.isArray(pivoSegments) ? pivoSegments : [];
        const base = raw.map((seg, idx) => ({
            id: String(seg?.id || `seg_${idx}`),
            name: String(seg?.name || ""),
            startAngle: normalizeAngle(seg?.startAngle, 0),
            endAngle: normalizeAngle(seg?.endAngle, 360),
            laminaAvanco: seg?.laminaAvanco ?? "",
            laminaReverso: seg?.laminaReverso ?? ""
        }));
        if (typeof window.Cad?.formPivos?.preparePivoSaveData === "function") {
            return window.Cad.formPivos.preparePivoSaveData({ segments: base }).segments || base;
        }
        return base;
    }

    function getPivotMaxAngleValue(fallback = 360) {
        const inputMaxAngle = toFiniteNumber($("pivoEditLocMaxAng")?.value);
        if (Number.isFinite(inputMaxAngle) && inputMaxAngle > 0) {
            return Math.min(360, Math.max(1, inputMaxAngle));
        }

        const stateMaxAngle = toFiniteNumber(pivoGlobalData?.maxAngle ?? pivoGlobalData?.endAngle);
        if (Number.isFinite(stateMaxAngle) && stateMaxAngle > 0) {
            return Math.min(360, Math.max(1, stateMaxAngle));
        }

        return Math.min(360, Math.max(1, fallback));
    }

    function clampCanhaoAngleToPivot(angle, fallback = 0, maxAngle = getPivotMaxAngleValue()) {
        const fallbackValue = toFiniteNumber(fallback);
        const safeFallback = Number.isFinite(fallbackValue) ? fallbackValue : 0;
        const numericAngle = toFiniteNumber(angle);

        if (maxAngle >= 360) {
            let val = Number.isFinite(numericAngle) ? numericAngle : safeFallback;
            if (val > 360) val = 360;
            if (val < 0) val = 0;
            return roundAngle(val);
        }

        const candidate = Number.isFinite(numericAngle) ? numericAngle : safeFallback;

        // Normaliza para [0, 360) para tratar ângulos negativos oriundos do drag
        // (ex: bearing – refBearing pode dar -89° quando o usuário arrasta além do fim do setor)
        const normalized = ((candidate % 360) + 360) % 360;

        if (normalized <= maxAngle) {
            return roundAngle(normalized);
        }

        // Ângulo está na "zona proibida" (maxAngle → 360°).
        // Se estiver mais perto do fim (maxAngle) → clipa para maxAngle.
        // Se estiver mais perto do início (360°/0°) → clipa para 0.
        const midGap = (maxAngle + 360) / 2;
        return roundAngle(normalized <= midGap ? maxAngle : 0);
    }

    const MIN_CANHAO_GAP = 1;

    function normalizeCanhaoSegment(segment, options = {}) {
        const maxAngle = options.maxAngle ?? getPivotMaxAngleValue();
        const fallbackStart = options.fallbackStart ?? 0;
        const fallbackEnd = options.fallbackEnd ?? (maxAngle >= 360
            ? fallbackStart + 30
            : Math.min(maxAngle, fallbackStart + 30));

        let startAngle = clampCanhaoAngleToPivot(segment?.startAngle, fallbackStart, maxAngle);
        let endAngle = clampCanhaoAngleToPivot(segment?.endAngle, fallbackEnd, maxAngle);

        if (maxAngle < 360) {
            if (endAngle < startAngle) endAngle = startAngle;
            // Garante gap mínimo para pivôs setoriais
            if (endAngle - startAngle < MIN_CANHAO_GAP) {
                endAngle = Math.min(maxAngle, startAngle + MIN_CANHAO_GAP);
            }
        } else {
            // Garante gap mínimo para pivôs circulares (360°)
            if (Math.abs(endAngle - startAngle) < MIN_CANHAO_GAP) {
                endAngle = roundAngle(normalizeAngle(startAngle + MIN_CANHAO_GAP, 0));
            }
        }

        return {
            ...(segment && typeof segment === "object" ? segment : {}),
            startAngle,
            endAngle
        };
    }

    function getNormalizedCanhaoSegments(segments = [], maxAngle = getPivotMaxAngleValue()) {
        const raw = Array.isArray(segments) ? segments : [];
        const normalized = [];

        raw.forEach((segment, idx) => {
            const previousEnd = idx > 0 ? normalized[idx - 1]?.endAngle : 0;
            const fallbackStart = maxAngle >= 360
                ? normalizeAngle(previousEnd, 0)
                : roundAngle(Math.max(0, Math.min(maxAngle, previousEnd)));
            const fallbackEnd = maxAngle >= 360
                ? fallbackStart + 30
                : Math.min(maxAngle, fallbackStart + 30);

            normalized.push(normalizeCanhaoSegment(segment, {
                maxAngle,
                fallbackStart,
                fallbackEnd
            }));
        });

        return normalized;
    }

    function syncCanhaoSegmentsToPivotBounds(idx = 1) {
        if (idx === 1) {
            canhao1Segments = getNormalizedCanhaoSegments(canhao1Segments);
            if (!canhao1Segments.length) activeCanhao1SegmentIndex = -1;
            else if (activeCanhao1SegmentIndex < 0) activeCanhao1SegmentIndex = 0;
            else if (activeCanhao1SegmentIndex >= canhao1Segments.length) activeCanhao1SegmentIndex = canhao1Segments.length - 1;
            return canhao1Segments;
        } else {
            canhao2Segments = getNormalizedCanhaoSegments(canhao2Segments);
            if (!canhao2Segments.length) activeCanhao2SegmentIndex = -1;
            else if (activeCanhao2SegmentIndex < 0) activeCanhao2SegmentIndex = 0;
            else if (activeCanhao2SegmentIndex >= canhao2Segments.length) activeCanhao2SegmentIndex = canhao2Segments.length - 1;
            return canhao2Segments;
        }
    }

    function clampCanhaoBoundaryAngle(segmentIndex, boundaryType, nextAngle, segments, maxAngle) {
        const normalizedSegments = getNormalizedCanhaoSegments(segments, maxAngle);
        const segment  = normalizedSegments[segmentIndex];
        const prevSeg  = normalizedSegments[segmentIndex - 1] ?? null;
        const nextSeg  = normalizedSegments[segmentIndex + 1] ?? null;
        const fallback = boundaryType === "start"
            ? segment?.startAngle ?? 0
            : segment?.endAngle   ?? 0;
        const clamped = clampCanhaoAngleToPivot(nextAngle, fallback, maxAngle);

        if (!segment) return clamped;

        if (maxAngle >= 360) {
            // Gap direcional que distingue "mesmo ponto" (0) de "círculo completo" (360)
            const fwdGap = (a, b) => { const d = b - a; return d > 0 ? d : (d === 0 ? 0 : d + 360); };

            if (boundaryType === "start") {
                // Não pode ultrapassar o próprio fim
                if (fwdGap(clamped, segment.endAngle) < MIN_CANHAO_GAP)
                    return roundAngle(normalizeAngle(segment.endAngle + MIN_CANHAO_GAP, 0));
                // Não pode entrar no segmento anterior
                if (prevSeg) {
                    const gapPrev = ((clamped - prevSeg.endAngle) + 360) % 360;
                    if (gapPrev > 360 - MIN_CANHAO_GAP)
                        return roundAngle(normalizeAngle(prevSeg.endAngle, 0));
                }
            } else {
                // Não pode ultrapassar o próprio início
                if (fwdGap(segment.startAngle, clamped) < MIN_CANHAO_GAP)
                    return roundAngle(normalizeAngle(segment.startAngle + MIN_CANHAO_GAP, 0));
                // Não pode entrar no segmento seguinte
                if (nextSeg) {
                    const gapNext = ((nextSeg.startAngle - clamped) + 360) % 360;
                    if (gapNext < MIN_CANHAO_GAP)
                        return roundAngle(normalizeAngle(nextSeg.startAngle - MIN_CANHAO_GAP, 0));
                }
            }
            return clamped;
        }

        // Pivô setorial: limites são os vizinhos (ou 0 / maxAngle nas pontas)
        if (boundaryType === "start") {
            const minBound = prevSeg ? prevSeg.endAngle : 0;
            const maxBound = segment.endAngle - MIN_CANHAO_GAP;
            return roundAngle(Math.max(minBound, Math.min(maxBound, clamped)));
        } else {
            const minBound = segment.startAngle + MIN_CANHAO_GAP;
            const maxBound = nextSeg ? nextSeg.startAngle : maxAngle;
            return roundAngle(Math.max(minBound, Math.min(maxBound, clamped)));
        }
    }

    function cloneCanhaoSegmentsForSave(idx = 1) {
        const segs = idx === 1 ? canhao1Segments : canhao2Segments;
        return getNormalizedCanhaoSegments(segs).map((segment) => ({ ...segment }));
    }

    function buildPivotSavePayload() {
        const farm = getFarmDataSafe();
        const current = Pivos.data?.getPivotData?.(state.selectedId) || {};
        const center = parseLL($("pivoEditLocCenter")?.value || "");
        if (!center) return { error: "Informe a localização do centro do pivô." };

        const ref = parseLL($("pivoEditLocRef")?.value || "");

        // Raio total irrigado: a distância do centro até o pino de referência.
        // As fontes são consultadas em cascata e nenhuma delas depende de uma
        // aba específica estar aberta — ler um único campo fazia o salvamento
        // abortar quando esse campo não estava montado na tela.
        const firstPositive = (...values) => {
            for (const value of values) {
                const n = toFiniteNumber(value);
                if (Number.isFinite(n) && n > 0) return n;
            }
            return NaN;
        };

        // "Raio até a última torre" (campo editável da aba Geral).
        // pivoEditRadius existe só no template SmartConnect/Nexus;
        // pivoEditLastTowerDistance é o equivalente no template SmartTouch —
        // os dois nunca coexistem no DOM, então é seguro tentar ambos.
        const towerRadiusInput = firstPositive(
            $("pivoEditRadius")?.value,
            $("pivoEditLastTowerDistance")?.value,
            current?.lastTowerRadius
        );

        const measuredRadius = (center && ref) ? distanceMetersBetweenPoints(center, ref) : NaN;
        const radiusValue = firstPositive(
            measuredRadius,
            $("pivoEditLocRadius")?.value,
            Number.isFinite(towerRadiusInput) ? towerRadiusInput + 20 : NaN,
            current?.radius
        );
        if (!Number.isFinite(radiusValue) || radiusValue <= 0) {
            return { error: "Informe um raio válido para o pivô." };
        }
        const snappedRef = snapPointToPivotRadius(center, ref, radiusValue, 0);

        let maxAngle = toFiniteNumber($("pivoEditLocMaxAng")?.value);
        if (!Number.isFinite(maxAngle) || maxAngle <= 0) maxAngle = 360;
        maxAngle = Math.min(360, Math.max(1, maxAngle));

        const isSector = maxAngle < 360;
        const lastTower = parseLL($("pivoEditLocLastTower")?.value || "");
        // Raio até a última torre. A coordenada da torre no mapa, quando
        // existe, tem precedência por ser uma medição real; depois vem o valor
        // digitado e, por fim, a convenção de 20 m a menos que o raio total.
        const measuredTower = lastTower ? distanceMetersBetweenPoints(center, lastTower) : NaN;
        const lastTowerRadius = firstPositive(
            measuredTower,
            towerRadiusInput,
            radiusValue > 20 ? radiusValue - 20 : NaN,
            current?.lastTowerRadius
        );
        const currentLastTowerRadius = toFiniteNumber(current?.lastTowerRadius);
        const payload = {
            ...current,
            id: state.selectedId,
            farmId: farm?.id || current?.farmId || "",
            name: String($("pivoEditName")?.value || current?.name || current?.nome || "").trim() || "Pivô",
            lat: center.lat,
            lng: center.lng,
            centerLat: center.lat,
            centerLng: center.lng,
            center: fmtLL(center.lat, center.lng),
            refLat: snappedRef?.lat ?? "",
            refLng: snappedRef?.lng ?? "",
            ref: snappedRef ? fmtLL(snappedRef.lat, snappedRef.lng) : "",
            radius: Number(radiusValue.toFixed(2)),
            maxAngle: Number(maxAngle.toFixed(2)),
            isPartial: isSector,
            isSector,
            startAngle: 0,
            endAngle: isSector ? Number(maxAngle.toFixed(2)) : 360,
            lastTowerLat: lastTower?.lat ?? "",
            lastTowerLng: lastTower?.lng ?? "",
            lastTowerRadius: Number.isFinite(lastTowerRadius)
                ? Number(lastTowerRadius.toFixed(2))
                : (Number.isFinite(currentLastTowerRadius) ? Number(currentLastTowerRadius.toFixed(2)) : ""),
            flow: $("pivoEditFlow")?.value ?? current?.flow ?? "",
            speed: $("pivoEditSpeed")?.value ?? current?.speed ?? "",
            irrigationRate: $("pivoEditIrrigationRate")?.value ?? current?.irrigationRate ?? "",
            radioBomba: $("pivoEditRadioBomba")?.value ?? current?.radioBomba ?? "",
            radioCentral: $("pivoEditRadioCentral")?.value ?? current?.radioCentral ?? "",
            radioControl: $("pivoEditRadioControl")?.value ?? current?.radioControl ?? "",
            radioGps: $("pivoEditRadioGps")?.value ?? current?.radioGps ?? "",
            canhaoMode: $("pivoEditCanhaoMode")?.value || "off",
            canhaoSegments1: cloneCanhaoSegmentsForSave(1),
            canhaoSegments2: cloneCanhaoSegmentsForSave(2),
            canhaoSegments: cloneCanhaoSegmentsForSave(1), // Backwards compatibility
            segments: cloneSegmentsForSave(),
            systemLength: $("pivoEditSystemLength")?.value ?? current?.systemLength ?? "",
            irrigationRadius: current?.irrigationRadius ?? "",
            ...collectExtraPivotFields(current)
        };

        if (typeof window.Cad?.formPivos?.preparePivoSaveData === "function") {
            return { payload: window.Cad.formPivos.preparePivoSaveData(payload) };
        }
        return { payload };
    }

    // Campos das seções Pluviômetro, Proteção/Religamento e Horários de Pico.
    // Eles existiam apenas no HTML: nenhum era lido no salvamento, então tudo
    // que o usuário digitava ali era descartado ao salvar.
    //
    // Parte deles aparece duas vezes na tela — uma na seção Geral e outra na
    // seção dedicada, com o sufixo "Tab" (ex.: pivoEditMinVoltage e
    // pivoEditMinVoltageTab). São o mesmo dado, então grava-se um valor só: o
    // do campo que o usuário realmente enxerga. A seção dedicada vence quando
    // está visível; caso contrário vale a de Geral.
    function collectExtraPivotFields(current) {
        const cur = current || {};

        const isVisible = (id) => {
            const el = $(id);
            if (!el) return false;
            // offsetParent é null quando o elemento (ou um ancestral) está com
            // display:none — é o caso das seções ocultas no menu lateral.
            return el.offsetParent !== null;
        };

        // Lê o par [campo da aba dedicada, campo de Geral] na ordem de
        // precedência, caindo para o valor já salvo quando nenhum existe.
        const pick = (tabId, generalId, fallback) => {
            const order = isVisible(tabId) ? [tabId, generalId] : [generalId, tabId];
            for (const id of order) {
                const el = $(id);
                if (el && String(el.value ?? "").trim() !== "") return el.value;
            }
            return fallback ?? "";
        };

        const pickBool = (tabId, generalId, fallback) => {
            const order = isVisible(tabId) ? [tabId, generalId] : [generalId, tabId];
            for (const id of order) {
                const el = $(id);
                if (el) return !!el.checked;
            }
            return !!fallback;
        };

        const val = (id, fallback) => {
            const el = $(id);
            if (el && String(el.value ?? "").trim() !== "") return el.value;
            return fallback ?? "";
        };

        // Lê o valor atualmente selecionado num select customizado
        // (.edit-panel__select-field com data-edit-menu="X" / .is-active),
        // usado por Fabricante/Painel na Ficha Técnica.
        const pickCustomSelect = (menuName, fallback) => {
            const active = document.querySelector(`[data-edit-menu="${menuName}"] .edit-panel__select-option.is-active`);
            return active?.dataset.value || fallback || "";
        };

        const peakDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
        const savedDays = Array.isArray(cur.peakDays) ? cur.peakDays : null;
        const dayEls = peakDays.map((d) => $(`pivoEditDay${d}`));
        const hasDayInputs = dayEls.some(Boolean);

        return {
            // Conectividade
            gateway: val("pivoEditGateway", cur.gateway),
            commType: val("pivoEditCommType", cur.commType),

            // Número máximo de voltas (exclusivo SmartTouch)
            maxLaps: val("pivoEditMaxLaps", cur.maxLaps),

            // Ficha Técnica
            manufacturer: pickCustomSelect("maker", cur.manufacturer),
            panelType: pickCustomSelect("panel", cur.panelType),
            lang: pickCustomSelect("lang", cur.lang),

            // Bombeamento
            power: val("scPower", cur.converted || cur.power),
            powerUnit: "kw",
            flow: val("scFlow", cur.flow),
            pressure: val("scPressure", cur.pressure),
            pumpTime: val("scPumpTime", cur.pumpTime),
            delayTime: val("scDelayTime", cur.delayTime),
            unstableTime: val("scUnstableTime", cur.unstableTime),
            sensorMin: val("scSensorMin", cur.sensorMin),
            sensorMax: val("scSensorMax", cur.sensorMax),
            sensorScale: val("scSensorScale", cur.sensorScale),
            fertigation: val("scFertigation", cur.fertigation),

            // Pluviômetro
            pluvioEnabled: pickBool("pivoEditPluvioEnabledTab", "pivoEditPluvioEnabled", cur.pluvioEnabled ?? cur.pluvio),
            pluvioScale: pick("pivoEditPluvioScaleTab", "pivoEditPluvioScale", cur.pluvioScale),
            pluvioValue: pick("pivoEditPluvioValueTab", "pivoEditPluvioValue", cur.pluvioValue),

            // Proteção e religamento
            energyTime: pick("pivoEditEnergyTimeTab", "pivoEditEnergyTime", cur.energyTime),
            voltageController: pickBool("pivoEditVoltageControllerTab", "pivoEditVoltageController", cur.voltageController),
            minVoltage: pick("pivoEditMinVoltageTab", "pivoEditMinVoltage", cur.minVoltage),
            maxVoltage: pick("pivoEditMaxVoltageTab", "pivoEditMaxVoltage", cur.maxVoltage),
            timeLimit: pick("pivoEditTimeLimitTab", "pivoEditTimeLimit", cur.timeLimit),

            // Horários de pico
            peakDays: hasDayInputs
                ? peakDays.filter((d, i) => !!dayEls[i]?.checked)
                : (savedDays || []),
            peak1Start: val("pivoEditPeak1Start", cur.peak1Start),
            peak1End: val("pivoEditPeak1End", cur.peak1End),
            peak2Start: val("pivoEditPeak2Start", cur.peak2Start),
            peak2End: val("pivoEditPeak2End", cur.peak2End),
            pricePonta: val("pivoEditPricePonta", cur.pricePonta),
            priceForaPonta: val("pivoEditPriceForaPonta", cur.priceForaPonta),
            priceReduzido: val("pivoEditPriceReduzido", cur.priceReduzido),
        };
    }

    // Repassa ao equipamento os campos coletados por collectExtraPivotFields.
    // O objeto data é montado com uma lista fixa de chaves, então sem isto os
    // valores existiriam no payload mas nunca chegariam à base.
    const EXTRA_PIVOT_FIELD_KEYS = [
        "gateway", "commType", "maxLaps",
        "manufacturer", "panelType", "lang",
        "power", "powerUnit", "flow", "pressure", "pumpTime", "delayTime", "unstableTime",
        "sensorMin", "sensorMax", "sensorScale", "fertigation",
        "pluvioEnabled", "pluvioScale", "pluvioValue",
        "energyTime", "voltageController", "minVoltage", "maxVoltage", "timeLimit",
        "peakDays", "peak1Start", "peak1End", "peak2Start", "peak2End",
        "pricePonta", "priceForaPonta", "priceReduzido",
    ];

    function extraPivotFieldsFromPayload(payload) {
        const out = {};
        EXTRA_PIVOT_FIELD_KEYS.forEach((key) => {
            if (payload?.[key] === undefined) return;
            out[key] = Array.isArray(payload[key]) ? payload[key].slice() : payload[key];
        });
        return out;
    }

    async function persistPivotPayload(payload) {
        if (!payload?.farmId) return false;
        if (typeof window.Cad?.data?.getAllFarms !== "function" || typeof window.Cad?.data?.persistFarmDataset !== "function") {
            return false;
        }

        const farms = window.Cad.data.getAllFarms();
        const farmIndex = farms.findIndex((farm) => String(farm?.id || "") === String(payload.farmId || ""));
        if (farmIndex < 0) return false;

        const targetFarm = { ...farms[farmIndex] };
        const equipments = (typeof window.Cad?.data?.getFarmEquipmentList === "function"
            ? window.Cad.data.getFarmEquipmentList(targetFarm)
            : (Array.isArray(targetFarm?.equipments) ? targetFarm.equipments : [])
        ).map((item) => ({
            ...item,
            data: item?.data && typeof item.data === "object" ? { ...item.data } : {}
        }));
        const legacyPivots = Array.isArray(targetFarm?.pivos)
            ? targetFarm.pivos.map((item) => ({ ...item }))
            : [];

        const equipIndex = equipments.findIndex((item) => String(item?.id || "") === String(payload.id || "") && isPivotEquipment(item));
        if (equipIndex >= 0) {
            const currentEquip = equipments[equipIndex];
            equipments[equipIndex] = {
                ...currentEquip,
                name: payload.name,
                category: currentEquip?.category || "pivos",
                type: currentEquip?.type || currentEquip?.controllerType || "smart_connect",
                data: {
                    ...currentEquip.data,
                    name: payload.name,
                    centerLat: payload.centerLat,
                    centerLng: payload.centerLng,
                    center: payload.center,
                    lat: payload.centerLat,
                    lng: payload.centerLng,
                    refLat: payload.refLat,
                    refLng: payload.refLng,
                    ref: payload.ref,
                    radius: payload.radius,
                    maxAngle: payload.maxAngle,
                    isPartial: payload.isPartial,
                    isSector: payload.isSector,
                    startAngle: payload.startAngle,
                    endAngle: payload.endAngle,
                    lastTowerLat: payload.lastTowerLat,
                    lastTowerLng: payload.lastTowerLng,
                    lastTowerRadius: payload.lastTowerRadius,
                    flow: payload.flow,
                    speed: payload.speed,
                    radioBomba: payload.radioBomba,
                    radioCentral: payload.radioCentral,
                    radioControl: payload.radioControl,
                    radioGps: payload.radioGps,
                    canhaoMode: payload.canhaoMode,
                    canhaoSegments1: Array.isArray(payload.canhaoSegments1) ? payload.canhaoSegments1.map((seg) => ({ ...seg })) : [],
                    canhaoSegments2: Array.isArray(payload.canhaoSegments2) ? payload.canhaoSegments2.map((seg) => ({ ...seg })) : [],
                    canhaoSegments: Array.isArray(payload.canhaoSegments1) ? payload.canhaoSegments1.map((seg) => ({ ...seg })) : [],
                    segments: Array.isArray(payload.segments) ? payload.segments.map((seg) => ({ ...seg })) : [],
                    softwareVersion: payload.softwareVersion,
                    systemLength: payload.systemLength,
                    irrigationRadius: payload.irrigationRadius,
                    irrigationRate: payload.irrigationRate,
                    ...extraPivotFieldsFromPayload(payload)
                }
            };
        }

        const legacyIndex = legacyPivots.findIndex((item) => String(item?.id || "") === String(payload.id || ""));
        if (legacyIndex >= 0) {
            legacyPivots[legacyIndex] = {
                ...legacyPivots[legacyIndex],
                id: payload.id,
                farmId: payload.farmId,
                name: payload.name,
                lat: payload.centerLat,
                lng: payload.centerLng,
                refLat: payload.refLat,
                refLng: payload.refLng,
                radius: payload.radius,
                maxAngle: payload.maxAngle,
                isPartial: payload.isPartial,
                isSector: payload.isSector,
                startAngle: payload.startAngle,
                endAngle: payload.endAngle,
                lastTowerLat: payload.lastTowerLat,
                lastTowerLng: payload.lastTowerLng,
                lastTowerRadius: payload.lastTowerRadius,
                flow: payload.flow,
                speed: payload.speed,
                radioBomba: payload.radioBomba,
                radioCentral: payload.radioCentral,
                radioControl: payload.radioControl,
                radioGps: payload.radioGps,
                canhaoMode: payload.canhaoMode,
                canhaoSegments1: Array.isArray(payload.canhaoSegments1) ? payload.canhaoSegments1.map((seg) => ({ ...seg })) : [],
                canhaoSegments2: Array.isArray(payload.canhaoSegments2) ? payload.canhaoSegments2.map((seg) => ({ ...seg })) : [],
                canhaoSegments: Array.isArray(payload.canhaoSegments1) ? payload.canhaoSegments1.map((seg) => ({ ...seg })) : [],
                segments: Array.isArray(payload.segments) ? payload.segments.map((seg) => ({ ...seg })) : [],
                softwareVersion: payload.softwareVersion,
                systemLength: payload.systemLength,
                irrigationRadius: payload.irrigationRadius,
                irrigationRate: payload.irrigationRate,
                ...extraPivotFieldsFromPayload(payload)
            };
        }

        targetFarm.equipments = equipments;
        if (legacyIndex >= 0) targetFarm.pivos = legacyPivots;
        delete targetFarm.equipamentos;
        farms[farmIndex] = targetFarm;

        await window.Cad.data.persistFarmDataset(farms);
        window.CreateFarm?.setters?.setFarms?.(farms);
        if (window.CreateFarm?.state) {
            const activeFarm = farms.find((farm) => String(farm?.id || "") === String(payload.farmId || ""));
            if (activeFarm) {
                window.CreateFarm.state.currentFarmId = activeFarm.id;
                window.CreateFarm.state.activeFarmSnapshot = {
                    id: activeFarm.id,
                    name: activeFarm.name,
                    lat: activeFarm.lat,
                    lng: activeFarm.lng
                };
                window.IcFarmActive = { ...window.CreateFarm.state.activeFarmSnapshot };
            }
        }
        return true;
    }

    async function handleSave() {
        if (pivoSegments.length > 1) {
            const unnamed = pivoSegments.findIndex((s) => !String(s.name || "").trim());
            if (unnamed !== -1) {
                alert(`${tMsg("Preencha o nome do segmento")} ${unnamed + 1} ${tMsg("antes de salvar.")}`);
                return;
            }
        }
        const saveBtn = document.querySelector("#pivoEditPanel .edit-panel__save");
        const originalHtml = saveBtn ? saveBtn.innerHTML : "";
        const result = buildPivotSavePayload();
        if (result.error) {
            alert(result.error);
            return;
        }

        // O botão NUNCA é desabilitado. Toda a espera acontecia aqui: o
        // salvamento gravava, redesenhava mapa e painéis e só então devolvia o
        // clique, e qualquer falha no meio deixava o botão preso para sempre.
        // Agora o retorno é imediato e o trabalho pesado corre depois.
        pivoGlobalData = { ...pivoGlobalData, ...result.payload };

        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Salvo!';
            setTimeout(() => {
                const btn = document.querySelector("#pivoEditPanel .edit-panel__save");
                if (btn) btn.innerHTML = originalHtml || '<i class="fa-solid fa-floppy-disk"></i> Salvar';
            }, 900);
        }

        // Gravação e atualização de tela em segundo plano. persistPivotPayload
        // escreve no localStorage antes de tocar a rede, então o dado já está
        // seguro quando o usuário vê "Salvo!".
        (async () => {
            try {
                const saved = await persistPivotPayload(result.payload);
                if (!saved) {
                    window.IcNotify?.error?.("Não foi possível salvar o pivô.", 3000);
                    return;
                }
            } catch (err) {
                console.error("Falha ao gravar o pivô.", err);
                window.IcNotify?.error?.("Não foi possível salvar o pivô.", 3000);
                return;
            }

            try {
                renderPivotSelectorList();
            } catch (err) {
                console.error("Falha ao atualizar a lista de pivôs após salvar.", err);
            }

            try {
                const activeFarm = window.IcFarmGetActive?.() || getFarmDataSafe();
                if (activeFarm) {
                    window.IcMapRenderPivots?.(activeFarm);
                    window.CreateFarm?.view?.render?.renderEquipmentPanels?.(activeFarm);
                }
            } catch (err) {
                console.error("Falha ao atualizar o mapa após salvar.", err);
            }
        })();
    }

    function renderPivotSelectorList() {
        const selectorMenu = $("pivoEditSelectMenu");
        const selectBtn = $("pivoEditSelectBtn");
        if (!selectorMenu || !selectBtn) return;

        const farmData = getFarmDataSafe();
        const equipments = farmData?.equipments;

        selectorMenu.innerHTML = "";

        if (!Array.isArray(equipments)) {
            selectorMenu.innerHTML = '<div style="padding: 10px 12px; font-size: 12px; color: #64748b;">Nenhum pivô encontrado.</div>';
            return;
        }

        // SmartTouch/Centerstar e Nexus/SmartConnect usam templates HTML diferentes
        // (campos diferentes). Trocar de pivô nesse seletor só atualiza valores no
        // template já montado — nunca troca de template. Por isso o seletor só lista
        // pivôs da MESMA família do que está aberto agora: pra editar um pivô de
        // outra família, o usuário volta pra lista e abre ele por lá (fluxo que já
        // monta o template certo do zero).
        // Usa a lista de equipamentos (não pivoGlobalData) pra achar o pivô atual:
        // no primeiro render do painel, pivoGlobalData ainda não foi setado.
        const currentPivotRaw = equipments.find((e) => String(e?.id) === String(state.selectedId));
        const currentIsSmartTouch = isSmartTouchFamilyPivot(currentPivotRaw || pivoGlobalData);
        const allPivots = equipments.filter((e) => {
            const cat = String(e?.category || "").toLowerCase();
            const isPivot = cat === "pivos" || cat === "pivo" || cat === "pivot" || cat === "pivots";
            return isPivot && isSmartTouchFamilyPivot(e) === currentIsSmartTouch;
        });

        if (!allPivots.length) {
            selectorMenu.innerHTML = '<div style="padding: 10px 12px; font-size: 12px; color: #64748b;">Nenhum pivô encontrado.</div>';
            return;
        }

        allPivots.forEach((p) => {
            const btn = document.createElement("button");
            btn.type = "button";
            
            const isSelected = String(p.id) === String(state.selectedId);
            btn.className = "edit-panel__select-option" + (isSelected ? " is-active" : "");
            btn.dataset.value = p.id;

            const label = p.name || p.nome || `Pivô ${String(p.id).slice(-4)}`;
            btn.textContent = label;

            if (isSelected) {
                selectBtn.textContent = label;
                selectBtn.dataset.value = p.id;
            }

            btn.addEventListener("click", async (e) => {
                e.stopPropagation();

                document.querySelectorAll(".edit-panel__select-field").forEach(w => w.classList.remove("is-open"));

                if (!isSelected) {
                    // SmartTouch/Centerstar e Nexus/SmartConnect usam templates HTML
                    // diferentes (campos diferentes). Trocar de pivô no seletor só
                    // atualizava os valores no template já montado — ao alternar
                    // entre famílias, os campos ficavam errados/desatualizados.
                    // Se a família mudar, remonta o painel inteiro com o template certo.
                    const wasSmartTouch = isSmartTouchFamilyPivot(pivoGlobalData);
                    const willBeSmartTouch = isSmartTouchFamilyPivot(p);

                    state.selectedId = p.id;

                    if (wasSmartTouch !== willBeSmartTouch) {
                        await mountEditPanel();
                        return;
                    }

                    renderPivotSelectorList();
                    renderPivotForm();
                }
            });

            selectorMenu.appendChild(btn);
        });
    }

    function renderPivotForm() {
        const pivoData = Pivos.data?.getPivotData?.(state.selectedId) || null;
        if (!pivoData) {
            return;
        }

        pivoGlobalData = pivoData;

        const nameInput = $("pivoEditName");
        if (nameInput) nameInput.value = pivoData.name || pivoData.nome || "";

        // O campo editável é o raio até a última torre. Quando o pivô ainda não
        // tem esse dado, cai para o raio total menos os 20 m do canhão.
        const radiusInput = $("pivoEditRadius");
        if (radiusInput) {
            const savedTower = saneRadiusValue(pivoData.lastTowerRadius);
            const totalRadius = saneRadiusValue(pivoData.radius);
            const resolvedTower = Number.isFinite(savedTower)
                ? savedTower
                : (Number.isFinite(totalRadius) && totalRadius > 20 ? totalRadius - 20 : NaN);
            radiusInput.value = Number.isFinite(resolvedTower) ? resolvedTower.toFixed(2) : "";
        }

        // Sincroniza inputs de localização base imediatamente (Shared across tabs)
        const lat = toFiniteNumber(pivoData.center?.lat || pivoData.lat || pivoData.centerLat || pivoData.latitude);
        const lng = toFiniteNumber(pivoData.center?.lng || pivoData.lng || pivoData.centerLng || pivoData.longitude);
        const radius = toFiniteNumber(pivoData.radius || pivoData.raio);
        const maxAng = toFiniteNumber(pivoData.maxAngle || pivoData.endAngle);

        if (lat && lng && $("pivoEditLocCenter")) $("pivoEditLocCenter").value = fmtLL(lat, lng);
        // O campo de raio da aba Localização fica oculto e nasce com um valor
        // fixo no HTML. Sem raio cadastrado ele precisa ser limpo, senão esse
        // número residual acaba virando o raio do pivô.
        if ($("pivoEditLocRadius")) {
            if (radius) setFixed2Input($("pivoEditLocRadius"), radius);
            else $("pivoEditLocRadius").value = "";
        }
        if (radius && $("pivoEditLastTowerCoords")) $("pivoEditLastTowerCoords").value = radius;
        if (maxAng && $("pivoEditLocMaxAng")) { $("pivoEditLocMaxAng").value = maxAng; if ($("pivoEditMaxAngle")) $("pivoEditMaxAngle").value = maxAng; }
        // Sempre chama (mesmo sem raio): syncDisplayFields já limpa os campos
        // quando o valor é inválido, em vez de deixar o do pivô anterior na tela.
        syncDisplayFields(radius);
        
        const rLat = toFiniteNumber(pivoData.refLat || pivoData.reference_lat || pivoData.zero_lat);
        const rLng = toFiniteNumber(pivoData.refLng || pivoData.reference_lng || pivoData.zero_lng);
        if (rLat && rLng) {
            if ($("pivoEditLocRef")) $("pivoEditLocRef").value = fmtLL(rLat, rLng);
            syncRefDistDisplay(rLat, rLng);
        } else if ($("pivoEditLocRef")) {
            // Mesmo bug do último campo: sem isso, trocar de pivô sem ponto de
            // referência salvo mantinha a coordenada (e a distância derivada dela)
            // do pivô anterior.
            $("pivoEditLocRef").value = "";
        }

        const lastTowerLat = toFiniteNumber(pivoData.lastTowerLat);
        const lastTowerLng = toFiniteNumber(pivoData.lastTowerLng);
        // Sempre reatribui (mesmo pra limpar): sem isso, ao trocar de pivô no seletor,
        // esse campo mantinha a coordenada do pivô anterior. O cálculo de distância então
        // comparava o centro do pivô NOVO com a última torre do pivô ANTIGO, gerando
        // valores absurdos tipo "5185614,33 m" em vez do raio real salvo.
        if ($("pivoEditLocLastTower")) {
            $("pivoEditLocLastTower").value = (lastTowerLat && lastTowerLng) ? fmtLL(lastTowerLat, lastTowerLng) : "";
        }

        const flowInput = $("pivoEditFlow");
        if (flowInput) flowInput.value = pivoData.flow ?? "";

        const speedInput = $("pivoEditSpeed");
        if (speedInput) speedInput.value = pivoData.speed ?? "";

        const irrigationRateInput = $("pivoEditIrrigationRate");
        if (irrigationRateInput) irrigationRateInput.value = pivoData.irrigationRate ?? "";

        // Exemplo ficticio dos rádios
        const radioCentral = $("pivoEditRadioCentral");
        if (radioCentral) radioCentral.value = pivoData.radioCentral || radioCentral.value || "";

        const radioBomba = $("pivoEditRadioBomba");
        if (radioBomba) radioBomba.value = pivoData.radioBomba || "0000000000000000";

        renderLocationMap(pivoData);

        // Canhao data: modo de acionamento (off / on / segment), 'segment' por padrão para compatibilidade com registros antigos
        const canhaoMode = pivoData.canhaoMode || "segment";
        const canhaoModeInput = $("pivoEditCanhaoMode");
        if (canhaoModeInput) {
            canhaoModeInput.value = canhaoMode;
            const canhaoModeWrap = canhaoModeInput.closest(".edit-panel__select-field");
            if (canhaoModeWrap) {
                const activeOption = canhaoModeWrap.querySelector(`.edit-panel__select-option[data-value="${canhaoMode}"]`);
                const btn = canhaoModeWrap.querySelector(".edit-panel__select-btn");
                if (activeOption) {
                    if (btn) btn.textContent = activeOption.textContent;
                    canhaoModeWrap.querySelectorAll(".edit-panel__select-option").forEach(opt => {
                        opt.classList.toggle("is-active", opt === activeOption);
                    });
                }
            }
            canhaoModeInput.dispatchEvent(new Event("change"));
        }

        canhao1Segments = Array.isArray(pivoData.canhaoSegments1 || pivoData.canhaoSegments)
            ? (pivoData.canhaoSegments1 || pivoData.canhaoSegments).map((segment) => ({ ...segment }))
            : [];
        activeCanhao1SegmentIndex = canhao1Segments.length > 0 ? 0 : -1;
        syncCanhaoSegmentsToPivotBounds(1);
        
        canhao2Segments = Array.isArray(pivoData.canhaoSegments2)
            ? pivoData.canhaoSegments2.map((segment) => ({ ...segment }))
            : [];
        activeCanhao2SegmentIndex = canhao2Segments.length > 0 ? 0 : -1;
        syncCanhaoSegmentsToPivotBounds(2);

        renderCanhaoMap(pivoData, 1);
        renderCanhaoUI(1);
        
        renderCanhaoMap(pivoData, 2);
        renderCanhaoUI(2);

        // SmartTouch specific fields
        const lengthInput = $("pivoEditSystemLength");
        if (lengthInput) setFixed2Input(lengthInput, pivoData.systemLength || pivoData.radius);

        const maxLapsInput = $("pivoEditMaxLaps");
        if (maxLapsInput) {
            const savedMaxLaps = toFiniteNumber(pivoData?.maxLaps ?? pivoData?.data?.maxLaps);
            maxLapsInput.value = Number.isFinite(savedMaxLaps) && savedMaxLaps > 0 ? String(Math.floor(savedMaxLaps)) : "";
        }

        const lastTowerDistanceInput = $("pivoEditLastTowerDistance");
        if (lastTowerDistanceInput) {
            delete lastTowerDistanceInput.dataset.userEdited;
            delete lastTowerDistanceInput.dataset.markerPlaced;
            const pivRadius = saneRadiusValue(pivoData?.radius) || 400;
            const savedDist = saneRadiusValue(pivoData?.lastTowerRadius);
            if (savedDist && savedDist > 0 && savedDist <= pivRadius) {
                lastTowerDistanceInput.value = formatInputNumber(savedDist);
                lastTowerDistanceInput.dataset.markerPlaced = "1";
            } else {
                lastTowerDistanceInput.value = "";
            }
        }

        syncSmartTouchGeneralFields({ force: true });

        // Smart Connect (Nexus) — pre-fill Conectividade, Ficha Técnica e Bombeamento
        const d = pivoData.data || pivoData;

        const _randRadio = () => "0013A200" + Array.from({length: 8}, () => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join("");

        const radioControl = $("pivoEditRadioControl");
        if (radioControl) radioControl.value = d.radioController || d.radioControl || pivoData.radioController || pivoData.radioControl || _randRadio();

        const radioGps = $("pivoEditRadioGps");
        if (radioGps) radioGps.value = d.radioMonitor || d.radioGps || pivoData.radioMonitor || pivoData.radioGps || _randRadio();

        // Ficha Técnica — manufacturer e panel (custom selects com data-edit-select)
        const makerSel = document.querySelector('[data-edit-select="maker"]');
        const makerVal = d.manufacturer || pivoData.manufacturer || "";
        if (makerSel && makerVal) {
            const makerOpt = makerSel.querySelector(`[data-value="${makerVal}"]`);
            if (makerOpt) makerOpt.click();
        }

        const panelSel = document.querySelector('[data-edit-select="panel"]');
        const panelVal = d.panelType || pivoData.panelType || "";
        if (panelSel && panelVal) {
            const panelOpt = panelSel.querySelector(`[data-value="${panelVal}"]`);
            if (panelOpt) panelOpt.click();
        }

        const langSel = document.querySelector('[data-edit-select="lang"]');
        const langVal = d.lang || pivoData.lang || "";
        if (langSel && langVal) {
            const langOpt = langSel.querySelector(`[data-value="${langVal}"]`);
            if (langOpt) langOpt.click();
        }

        // Tipo de comunicação (Rádio/4G) — widget .equip-select, clicar na
        // opção salva já sincroniza o <select> nativo e o texto exibido.
        const commTypeVal = d.commType || pivoData.commType || "";
        if (commTypeVal) {
            const commTypeOpt = document.querySelector(`#pivoEditCommType__list [data-value="${commTypeVal}"]`);
            if (commTypeOpt) commTypeOpt.click();
        }

        // Bombeamento — potência sempre em kW; usa o valor já convertido quando existir
        // (registros antigos salvos em CV) e cai para "power" nos mais recentes.
        const setVal = (id, val) => { const el = $(id); if (el && val != null) el.value = val; };
        setVal("scPower",        d.converted || pivoData.converted || d.power || pivoData.power || "");
        setVal("scFlow",         d.flow         || pivoData.flow         || "");
        setVal("scPressure",     d.pressure     || pivoData.pressure     || "");
        setVal("scPumpTime",     d.pumpTime     || pivoData.pumpTime     || "");
        setVal("scDelayTime",    d.delayTime    || pivoData.delayTime    || "");
        setVal("scUnstableTime", d.unstableTime || pivoData.unstableTime || "");
        setVal("scSensorMin",    d.sensorMin    || pivoData.sensorMin    || "");
        setVal("scSensorMax",    d.sensorMax    || pivoData.sensorMax    || "");
        setVal("scSensorScale",  d.sensorScale  || pivoData.sensorScale  || "");
        setVal("scFertigation", d.fertigation || pivoData.fertigation || "");
        syncPressureFields();

        // Pluviômetro e Autorreversão toggles
        const pluvioToggle = $("pivoEditPluvioEnabled");
        if (pluvioToggle) {
            pluvioToggle.checked = !!(d.pluvio ?? pivoData.pluvio);
            pluvioToggle.dispatchEvent(new Event("change", { bubbles: true }));
        }

        const autoRevToggle = $("pivoEditAutoRevEnabled");
        if (autoRevToggle) {
            autoRevToggle.checked = !!(d.autoRev ?? pivoData.autoRev);
            autoRevToggle.dispatchEvent(new Event("change", { bubbles: true }));
        }

        // Isolado: estas seções são complementares, então uma falha aqui não
        // pode impedir o restante do formulário de carregar.
        try {
            fillExtraPivotFields(d, pivoData);
        } catch (err) {
            console.error("Falha ao preencher os campos complementares do pivô.", err);
        }

        // Calcula lâmina diretamente (sem depender de eventos)
        const _laminaEl = $("scIrrigationRate");
        if (_laminaEl) {
            const _Q = parseFloat($("scFlow")?.value);
            const _V = parseFloat($("pivoEditSpeed")?.value);
            const _R = parseFloat($("pivoEditRadius")?.value);
            if (_Q > 0 && _V > 0 && _R > 0) {
                _laminaEl.value = (2000 * _Q / (_V * _R)).toFixed(2);
            } else {
                _laminaEl.value = d.irrigationRate || pivoData.irrigationRate || "";
            }
        }
    }

    // Preenche as seções que antes não eram nem salvas nem recarregadas
    // (Pluviômetro, Proteção/Religamento e Horários de Pico). Escreve nos dois
    // campos de cada par duplicado — Geral e aba dedicada — para que a tela
    // mostre o mesmo valor independente de por onde o usuário abrir.
    function fillExtraPivotFields(d, pivoData) {
        const src = d || {};
        const base = pivoData || {};
        const readValue = (key) => src[key] ?? base[key];

        const setBoth = (tabId, generalId, value) => {
            if (value == null || value === "") return;
            [tabId, generalId].forEach((id) => {
                const el = $(id);
                if (el) el.value = value;
            });
        };

        const setBothChecked = (tabId, generalId, checked) => {
            [tabId, generalId].forEach((id) => {
                const el = $(id);
                if (!el) return;
                el.checked = !!checked;
                el.dispatchEvent(new Event("change", { bubbles: true }));
            });
        };

        const setOne = (id, value) => {
            if (value == null || value === "") return;
            const el = $(id);
            if (el) el.value = value;
        };

        setOne("pivoEditGateway", readValue("gateway"));

        // O toggle de Geral (pivoEditPluvioEnabled) já foi ajustado logo acima,
        // junto com os demais toggles; aqui só o espelho da aba dedicada é
        // escrito, para não disparar o evento change duas vezes no mesmo campo.
        const pluvioOn = readValue("pluvioEnabled") ?? readValue("pluvio");
        if (pluvioOn != null) {
            const tabToggle = $("pivoEditPluvioEnabledTab");
            if (tabToggle) {
                tabToggle.checked = !!pluvioOn;
                tabToggle.dispatchEvent(new Event("change", { bubbles: true }));
            }
        }
        setBoth("pivoEditPluvioScaleTab", "pivoEditPluvioScale", readValue("pluvioScale"));
        setBoth("pivoEditPluvioValueTab", "pivoEditPluvioValue", readValue("pluvioValue"));

        setBoth("pivoEditEnergyTimeTab", "pivoEditEnergyTime", readValue("energyTime"));
        const voltageOn = readValue("voltageController");
        if (voltageOn != null) setBothChecked("pivoEditVoltageControllerTab", "pivoEditVoltageController", voltageOn);
        setBoth("pivoEditMinVoltageTab", "pivoEditMinVoltage", readValue("minVoltage"));
        setBoth("pivoEditMaxVoltageTab", "pivoEditMaxVoltage", readValue("maxVoltage"));
        setBoth("pivoEditTimeLimitTab", "pivoEditTimeLimit", readValue("timeLimit"));

        const peakDays = readValue("peakDays");
        if (Array.isArray(peakDays)) {
            ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"].forEach((day) => {
                const el = $(`pivoEditDay${day}`);
                if (el) el.checked = peakDays.includes(day);
            });
        }
        setOne("pivoEditPeak1Start", readValue("peak1Start"));
        setOne("pivoEditPeak1End", readValue("peak1End"));
        setOne("pivoEditPeak2Start", readValue("peak2Start"));
        setOne("pivoEditPeak2End", readValue("peak2End"));
        setOne("pivoEditPricePonta", readValue("pricePonta"));
        setOne("pivoEditPriceForaPonta", readValue("priceForaPonta"));
        setOne("pivoEditPriceReduzido", readValue("priceReduzido"));
    }

    function renderCanhaoUI(idx = 1) {
        let wrap = $(`pivoEditCanhaoSegmentList${idx}`);
        if (!wrap && idx === 1) wrap = $("pivoEditCanhaoSegmentList");
        if (!wrap) return;
        const maxAngle = getPivotMaxAngleValue();

        const segments = idx === 1 ? canhao1Segments : canhao2Segments;
        const activeIdx = idx === 1 ? activeCanhao1SegmentIndex : activeCanhao2SegmentIndex;

        syncCanhaoSegmentsToPivotBounds(idx);

        // Nexus/SmartConnect permitem até 9 segmentos de canhão; SmartTouch/Centerstar seguem limitados a 6.
        const maxSegments = getSegmentCapForPivot(pivoGlobalData);

        wrap.innerHTML = "";
        segments.forEach((seg, i) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "pivo-seg-num-btn" + (i === activeIdx ? " is-active" : "");
            const btnColor = segmentPalette[i % segmentPalette.length];
            btn.style.cssText = `background: ${btnColor}; --seg-color: ${btnColor};`;
            btn.textContent = i + 1;
            btn.onclick = () => {
                if (idx === 1) activeCanhao1SegmentIndex = i;
                else activeCanhao2SegmentIndex = i;
                renderCanhaoUI(idx);
            };
            wrap.appendChild(btn);
        });

        // Add Btn
        if (segments.length < maxSegments) {
            const isSectorial = maxAngle < 360;
            const total       = isSectorial ? maxAngle : 360;

            const addBtn = document.createElement("button");
            addBtn.type = "button";
            addBtn.className = "pivo-seg-add-btn";
            addBtn.title = "Adicionar segmento de canhão";
            addBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
            addBtn.onclick = () => {
                let newSegments = [...segments];
                const newCount = newSegments.length + 1;

                if (newCount === 1) {
                    const size = Math.min(30, roundAngle(total * 0.25));
                    newSegments = [{ startAngle: 0, endAngle: size }];
                } else {
                    const slice = total / newCount;
                    newSegments = Array.from({ length: newCount }, (_, i) => ({
                        startAngle: roundAngle(i * slice),
                        endAngle:   roundAngle((i + 1) * slice)
                    }));
                }

                if (idx === 1) {
                    canhao1Segments = newSegments;
                    activeCanhao1SegmentIndex = newCount - 1;
                } else {
                    canhao2Segments = newSegments;
                    activeCanhao2SegmentIndex = newCount - 1;
                }
                renderCanhaoUI(idx);
            };
            wrap.appendChild(addBtn);
        }

        // Del Btn
        if (segments.length > 0) {
            const delBtn = document.createElement("button");
            delBtn.type = "button";
            delBtn.className = "pivo-seg-del-btn";
            delBtn.innerHTML = '<i class="fa-regular fa-trash-can"></i>';
            delBtn.onclick = () => {
                if (idx === 1) {
                    canhao1Segments.splice(activeCanhao1SegmentIndex, 1);
                    activeCanhao1SegmentIndex = canhao1Segments.length ? Math.min(activeCanhao1SegmentIndex, canhao1Segments.length - 1) : -1;
                } else {
                    canhao2Segments.splice(activeCanhao2SegmentIndex, 1);
                    activeCanhao2SegmentIndex = canhao2Segments.length ? Math.min(activeCanhao2SegmentIndex, canhao2Segments.length - 1) : -1;
                }
                renderCanhaoUI(idx);
            };
            wrap.appendChild(delBtn);
        }

        populateCanhaoForm(idx);
    }

    function populateCanhaoForm(idx = 1, shouldDraw = true) {
        syncCanhaoSegmentsToPivotBounds(idx);

        const segments = idx === 1 ? canhao1Segments : canhao2Segments;
        const activeIdx = idx === 1 ? activeCanhao1SegmentIndex : activeCanhao2SegmentIndex;
        const seg = segments[activeIdx];
        
        let startInput = $(`pivoEditCanhaoSegStart${idx}`);
        if (!startInput && idx === 1) startInput = $("pivoEditCanhaoSegStart");

        let endInput = $(`pivoEditCanhaoSegEnd${idx}`);
        if (!endInput && idx === 1) endInput = $("pivoEditCanhaoSegEnd");
        const maxAngle = getPivotMaxAngleValue();

        if (startInput) {
            startInput.min = "0";
            startInput.max = String(maxAngle);
        }
        if (endInput) {
            endInput.min = "0";
            endInput.max = String(maxAngle);
        }

        if (seg) {
            if (startInput) startInput.value = seg.startAngle ?? "";
            if (endInput) endInput.value = seg.endAngle ?? "";
        } else {
            if (startInput) startInput.value = "";
            if (endInput) endInput.value = "";
        }
        
        if (shouldDraw) {
            drawCanhaoMapFeatures(idx);
        }
    }

    function renderCanhaoMap(pivoData, idx = 1) {
        let mapEl = $(`pivoEditCanhaoMap${idx}`);
        if (!mapEl && idx === 1) mapEl = $("pivoEditCanhaoMap");
        if (!mapEl) return;

        let instance = idx === 1 ? canhao1MapInstance : canhao2MapInstance;

        if (instance) {
            try {
                instance.off();
                instance.remove();
            } catch (e) {}
            if (idx === 1) canhao1MapInstance = null;
            else canhao2MapInstance = null;
        }

        if (mapEl.offsetHeight === 0) return;

        mapEl.innerHTML = "";

        instance = L.map(mapEl, {
            zoomControl: true,
            attributionControl: false,
            zoomSnap: 0,
            scrollWheelZoom: false,
            dragging: false
        });

        mapEl.addEventListener("wheel", (e) => {
            if (e.ctrlKey) {
                instance.scrollWheelZoom.enable();
            } else {
                instance.scrollWheelZoom.disable();
            }
        });

        mapEl.addEventListener("mousedown", (e) => {
            if (e.ctrlKey) instance.dragging.enable();
        });
        mapEl.addEventListener("mouseup", () => {
            instance.dragging.disable();
        });

        if (idx === 1) canhao1MapInstance = instance;
        else canhao2MapInstance = instance;

        L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            { maxZoom: 20 }
        ).addTo(instance);

        const farm = getFarmDataSafe();
        const farmLat = toFiniteNumber(farm?.lat || farm?.centerLat);
        const farmLng = toFiniteNumber(farm?.lng || farm?.centerLng);

        let lat = toFiniteNumber(pivoData?.center?.lat || pivoData?.centerLat || pivoData?.lat || pivoData?.latitude) || farmLat || -18.846005;
        let lng = toFiniteNumber(pivoData?.center?.lng || pivoData?.centerLng || pivoData?.lng || pivoData?.longitude) || farmLng || -48.386471;

        instance.setView([lat, lng], 15);

        // Geometrias
        const circle = L.circle([lat, lng], { radius: pivoData?.radius || 300, color: "#ffffff", weight: 2, fillOpacity: 0 }).addTo(instance);
        const sector = L.polygon([], { color: "#ffffff", weight: 2, fillOpacity: 0 }).addTo(instance);
        const segLayer = L.layerGroup().addTo(instance);
        const tickLayer = L.featureGroup().addTo(instance);
        const refLine = L.polyline([], { color: "#ffffff", weight: 2, opacity: 0 }).addTo(instance);
        const triangle = L.marker([lat, lng], {
            icon: makeTriangleIcon(0), draggable: false, opacity: 0, interactive: false,
        }).addTo(instance);

        if (idx === 1) {
            canhao1Circle = circle;
            canhao1Sector = sector;
            canhao1SegmentLayer = segLayer;
            canhao1TickLayer = tickLayer;
            canhao1RefLine = refLine;
            canhao1Triangle = triangle;
        } else {
            canhao2Circle = circle;
            canhao2Sector = sector;
            canhao2SegmentLayer = segLayer;
            canhao2TickLayer = tickLayer;
            canhao2RefLine = refLine;
            canhao2Triangle = triangle;
        }

        // Renderiza pivos fundo
        const farmObj = getFarmDataSafe();
        const allEquips = [...(Array.isArray(farmObj?.equipments) ? farmObj.equipments : []), ...(Array.isArray(farmObj?.equipamentos) ? farmObj.equipamentos : [])];
        allEquips.filter(e => isPivotEquipment(e) && String(e.id) !== String(pivoData?.id)).forEach(p => {
             const pLat = p.center?.lat || p.lat || p.centerLat;
             const pLng = p.center?.lng || p.lng || p.centerLng;
             const pRad = p.radius || 300;
             if (pLat && pLng) {
                 L.circle([pLat, pLng], { radius: pRad, color: "#94a3b8", weight: 1, fillColor: "#e2e8f0", fillOpacity: 0.2, dashArray: "4,4" }).addTo(instance);
             }
        });

        drawCanhaoMapFeatures(idx);
        
        setTimeout(() => {
            if (instance) {
                instance.invalidateSize();
                const center = parseLL($("pivoEditLocCenter")?.value);
                if (center) instance.panTo([center.lat, center.lng]);
            }
        }, 300);
    }

    function _redrawCanhaoSegmentPolygonsOnly(idx = 1, lat, lng, radius) {
        const segLayer = idx === 1 ? canhao1SegmentLayer : canhao2SegmentLayer;
        if (!segLayer) return;
        segLayer.clearLayers();

        const segments = idx === 1 ? canhao1Segments : canhao2Segments;
        const activeIdx = idx === 1 ? activeCanhao1SegmentIndex : activeCanhao2SegmentIndex;

        segments.forEach((seg, i) => {
            const isAct = i === activeIdx;
            const color = segmentPalette[i % segmentPalette.length];
            const sAng  = toFiniteNumber(seg.startAngle);
            const eAng  = toFiniteNumber(seg.endAngle);
            if (sAng !== null && eAng !== null) {
                const poly = L.polygon(getPointsForArc(lat, lng, radius, sAng, eAng), {
                    color: "#ffffff",
                    weight: isAct ? 2 : 1,
                    fillColor: color,
                    fillOpacity: isAct ? 0.85 : 0.65,
                }).addTo(segLayer);
                poly.bringToFront();
            }
        });

        const tickLayer = idx === 1 ? canhao1TickLayer : canhao2TickLayer;
        const circle    = idx === 1 ? canhao1Circle    : canhao2Circle;
        const sector    = idx === 1 ? canhao1Sector    : canhao2Sector;
        const refLine   = idx === 1 ? canhao1RefLine   : canhao2RefLine;
        if (tickLayer) tickLayer.bringToFront();
        if (circle)    circle.bringToFront();
        if (sector)    sector.bringToFront();
        if (refLine)   refLine.bringToFront();
    }

    function drawCanhaoMapFeatures(idx = 1) {
        const instance = idx === 1 ? canhao1MapInstance : canhao2MapInstance;
        const circle = idx === 1 ? canhao1Circle : canhao2Circle;
        const sector = idx === 1 ? canhao1Sector : canhao2Sector;
        const segLayer = idx === 1 ? canhao1SegmentLayer : canhao2SegmentLayer;
        const tickLayer = idx === 1 ? canhao1TickLayer : canhao2TickLayer;
        const refLine = idx === 1 ? canhao1RefLine : canhao2RefLine;
        
        if (!instance || !circle) return;

        const centerLL = parseLL($("pivoEditLocCenter")?.value) || { lat: -18.846005, lng: -48.386471 };
        const lat = centerLL.lat;
        const lng = centerLL.lng;

        const radius = getPivotRadiusValue(pivoGlobalData?.radius || 300);
        const maxAngle = getPivotMaxAngleValue();

        syncCanhaoSegmentsToPivotBounds(idx);

        const sharedPivotUtils = window.IcMapPivotVisualUtils || null;
        const pivotColors = sharedPivotUtils?.getPivotVisuals?.(pivoGlobalData) || {
            outline: "#c78a1d", stroke: "#c78a1d", fill: "#c78a1d", fillOpacity: 0.15
        };

        const refStr = $("pivoEditLocRef")?.value || "";
        let refBearing = 0;
        if (refStr.includes(",")) {
            const refLL = parseLL(refStr);
            if (refLL) refBearing = bearingBetween(lat, lng, refLL.lat, refLL.lng);
        }

        if (maxAngle >= 360) {
            circle.setLatLng([lat, lng]);
            circle.setRadius(radius);
            circle.setStyle({ color: "#ffffff", weight: 2, opacity: 1, fillOpacity: 0 });
            drawCircleTicks(lat, lng, radius, 0, 360, tickLayer);
            sector.setLatLngs([]);
            sector.setStyle({ opacity: 0, fillOpacity: 0 });
        } else {
            circle.setStyle({ opacity: 0, fillOpacity: 0 });
            if (tickLayer) tickLayer.clearLayers();
            drawCircleTicks(lat, lng, radius, refBearing, maxAngle, tickLayer);
            sector.setLatLngs(getPointsForArc(lat, lng, radius, 0, maxAngle));
            sector.setStyle({ color: "#ffffff", weight: 2, opacity: 1, fillOpacity: 0 });
        }

        segLayer.clearLayers();
        const segments = idx === 1 ? canhao1Segments : canhao2Segments;
        const activeIdx = idx === 1 ? activeCanhao1SegmentIndex : activeCanhao2SegmentIndex;

        segments.forEach((seg, i) => {
            const isAct = i === activeIdx;
            const color = segmentPalette[i % segmentPalette.length];
            const sAng  = toFiniteNumber(seg.startAngle);
            const eAng  = toFiniteNumber(seg.endAngle);
            if (sAng !== null && eAng !== null) {
                const poly = L.polygon(getPointsForArc(lat, lng, radius, sAng, eAng), {
                    color: "#ffffff", opacity: 0, weight: isAct ? 2 : 1,
                    fillColor: color, fillOpacity: isAct ? 0.85 : 0.65,
                }).addTo(segLayer);
                poly.bringToFront();
            }
        });

        // Garante que o círculo/setor e ticks ficam acima dos segmentos
        if (tickLayer) tickLayer.bringToFront();
        if (circle) circle.bringToFront();
        if (sector) sector.bringToFront();

        instance.panTo([lat, lng]);

        // Drag dots
        const boundaries = [];
        segments.forEach((seg, i) => {
            boundaries.push({ angle: Number(seg.startAngle || 0), sIdx: i, type: "start" });
            boundaries.push({ angle: Number(seg.endAngle   || 0), sIdx: i, type: "end" });
        });

        const currentMarkers = idx === 1 ? canhao1SegBoundaryMarkers : canhao2SegBoundaryMarkers;
        currentMarkers.forEach(m => m.remove());
        
        const newMarkers = boundaries.map((boundary, bIdx) => {
            const pos = destPoint(lat, lng, radius, (refBearing + boundary.angle) % 360);
            const marker = L.marker([pos.lat, pos.lng], {
                icon: L.divIcon({
                    className: "pivo-map-drag-dot",
                    html: '<div style="width: 14px; height: 14px; border-radius: 50%; background: #fff; border: 3px solid #1D4ED8; box-shadow: 0 0 4px rgba(0,0,0,.4); cursor: grab;"></div>',
                    iconSize: [14, 14], iconAnchor: [7, 7]
                }),
                draggable: true, autoPan: false
            }).addTo(instance);

            marker.on("dragstart", () => {
                instance.dragging.disable();
                if (marker.getElement()) marker.getElement().style.cursor = "grabbing";
            });

            marker.on("drag", (e) => {
                const mPos = e.target.getLatLng();
                const rawAngle = ((bearingBetween(lat, lng, mPos.lat, mPos.lng) - refBearing) + 360) % 360;
                const segs = idx === 1 ? canhao1Segments : canhao2Segments;
                const seg = segs[boundary.sIdx];
                if (!seg) return;

                const clampedAngle = clampCanhaoBoundaryAngle(boundary.sIdx, boundary.type, rawAngle, segs, maxAngle);
                if (boundary.type === "start") seg.startAngle = clampedAngle;
                else seg.endAngle = clampedAngle;

                segs[boundary.sIdx] = normalizeCanhaoSegment(seg, { maxAngle, fallbackStart: seg.startAngle, fallbackEnd: seg.endAngle });
                syncCanhaoSegmentsToPivotBounds(idx);

                const snappedPos = destPoint(lat, lng, radius, (refBearing + clampedAngle) % 360);
                marker.setLatLng([snappedPos.lat, snappedPos.lng]);

                _redrawCanhaoSegmentPolygonsOnly(idx, lat, lng, radius);
                populateCanhaoForm(idx, false);
            });

            marker.on("dragend", () => {
                if (marker.getElement()) marker.getElement().style.cursor = "grab";
                drawCanhaoMapFeatures(idx);
            });

            return marker;
        });

        if (idx === 1) canhao1SegBoundaryMarkers = newMarkers;
        else canhao2SegBoundaryMarkers = newMarkers;

        const canhaoTriangle = idx === 1 ? canhao1Triangle : canhao2Triangle;
        if (refStr.includes(",") && canhaoTriangle) {
            const triPt = destPoint(lat, lng, radius * 0.95, refBearing);
            canhaoTriangle.setIcon(makeTriangleIcon((refBearing + 180) % 360));
            canhaoTriangle.setLatLng([triPt.lat, triPt.lng]);
            canhaoTriangle.setOpacity(0.95);
        } else if (canhaoTriangle) {
            canhaoTriangle.setOpacity(0);
        }

        if (tickLayer) tickLayer.bringToFront();
        if (circle) circle.bringToFront();
        if (sector) sector.bringToFront();
        if (canhaoTriangle) canhaoTriangle.setZIndexOffset(1000);
    }

    let locationMapInstance = null;
    let locationCircle = null;
    let locationTickLayer = null;
    let locationSector = null;
    let locationSegmentLayer = null;
    let locationRefLine = null;
    let locationCenterMarker = null;
    let locationRefMarker = null;
    let locationSectorStartMarker = null;
    let locationSectorEndMarker = null;
    let locationCardinalTriangle = null;
    let selectedCardinalPoint = null;
    let lockedRefBearing = null;

    const makeTriangleIcon = (rotationDeg = 0) => L.divIcon({
        className: "",
        html: `<div style="pointer-events:none;width:32px;height:32px;">
            <svg width="32" height="32" viewBox="-16 -16 32 32" xmlns="http://www.w3.org/2000/svg">
                <polygon points="0,-14 11,8 -11,8" fill="white" opacity="0.95"
                    style="filter:drop-shadow(0 1px 3px rgba(0,0,0,.65));"
                    transform="rotate(${rotationDeg})"/>
            </svg>
        </div>`,
        iconSize: [32, 32], iconAnchor: [16, 16],
    });
    let locationSegBoundaryMarkers = [];
    let locationLastTowerMarker = null;
    let showSegmentMarkers = false;

    function fmtLL(lat, lng) {
        return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }

    function parseLL(str) {
        if (!str || !str.includes(",")) return null;
        const [la, lo] = str.split(",").map(Number);
        return Number.isFinite(la) && Number.isFinite(lo) ? { lat: la, lng: lo } : null;
    }

    function bearingBetween(aLat, aLng, bLat, bLng) {
        const r1 = aLat * Math.PI / 180, c1 = aLng * Math.PI / 180;
        const r2 = bLat * Math.PI / 180, c2 = bLng * Math.PI / 180;
        const y = Math.sin(c2 - c1) * Math.cos(r2);
        const x = Math.cos(r1) * Math.sin(r2) - Math.sin(r1) * Math.cos(r2) * Math.cos(c2 - c1);
        return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    }

    function destPoint(lat, lng, distMeters, bearingDeg) {
        const R = 6378137;
        const d = distMeters / R;
        const b = bearingDeg * Math.PI / 180;
        const r1 = lat * Math.PI / 180;
        const c1 = lng * Math.PI / 180;
        const r2 = Math.asin(Math.sin(r1) * Math.cos(d) + Math.cos(r1) * Math.sin(d) * Math.cos(b));
        const c2 = c1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(r1), Math.cos(d) - Math.sin(r1) * Math.sin(r2));
        return { lat: r2 * 180 / Math.PI, lng: c2 * 180 / Math.PI };
    }

    // Raio TOTAL irrigado: a distância do centro até o pino de referência
    // (vermelho). É essa medida no mapa que define o raio — o campo
    // pivoEditLocRadius fica oculto e traz um valor fixo do HTML, então não
    // pode ter precedência: era ele que fazia o raio aparecer errado ao abrir,
    // até o usuário mexer no pino.
    // Posição de um marcador do mapa, tolerante a marcador já destruído ou
    // ainda não criado: getLatLng() lança quando a instância foi removida, e
    // esta função é consultada de muitos pontos do formulário.
    function safeMarkerLatLng(marker) {
        if (!marker || typeof marker.getLatLng !== "function") return null;
        try {
            const pos = marker.getLatLng();
            return (pos && Number.isFinite(pos.lat) && Number.isFinite(pos.lng))
                ? { lat: pos.lat, lng: pos.lng }
                : null;
        } catch (_) {
            return null;
        }
    }

    function getPivotRadiusValue(fallback = 300) {
        // O campo de raio vem primeiro: é ele que o usuário digita e é ele que
        // o arraste do pino vermelho atualiza. Derivar o raio da posição do
        // pino, como se tentou antes, tornava o campo inútil — o valor digitado
        // era descartado e o pino voltava para onde já estava.
        const locRadius = toFiniteNumber($("pivoEditLocRadius")?.value);
        if (Number.isFinite(locRadius) && locRadius > 0) return locRadius;

        // Sem valor no campo (ex.: pivô ainda sem raio), mede no mapa.
        const center = safeMarkerLatLng(locationCenterMarker) || parseLL($("pivoEditLocCenter")?.value || "");
        const ref = safeMarkerLatLng(locationRefMarker) || parseLL($("pivoEditLocRef")?.value || "");
        if (center && ref) {
            const measured = distanceMetersBetweenPoints(center, ref);
            if (Number.isFinite(measured) && measured > 0) return measured;
        }
        const stateRadius = toFiniteNumber(pivoGlobalData?.radius);
        if (Number.isFinite(stateRadius) && stateRadius > 0) return stateRadius;
        return fallback;
    }

    function snapPointToPivotRadius(center, point, radius, fallbackBearing = 0) {
        if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return point || null;
        if (!Number.isFinite(radius) || radius <= 0) return point || null;

        let bearing = normalizeAngle(fallbackBearing, 0);
        if (point && Number.isFinite(point.lat) && Number.isFinite(point.lng)) {
            bearing = bearingBetween(center.lat, center.lng, point.lat, point.lng);
        }

        return destPoint(center.lat, center.lng, radius, bearing);
    }

    function syncPivotReferenceToRadius(candidatePoint = null, options = {}) {
        const opts = {
            updateInput: true,
            updateMarker: true,
            fallbackBearing: 0,
            ...options
        };
        const center = parseLL($("pivoEditLocCenter")?.value || "") || pivoGlobalData?.center || null;
        const radius = getPivotRadiusValue();
        const currentRef = candidatePoint || parseLL($("pivoEditLocRef")?.value || "") || null;
        const snappedRef = snapPointToPivotRadius(center, currentRef, radius, opts.fallbackBearing);
        if (!snappedRef) return currentRef;

        if (opts.updateInput && $("pivoEditLocRef")) {
            $("pivoEditLocRef").value = fmtLL(snappedRef.lat, snappedRef.lng);
            syncRefDistDisplay(snappedRef.lat, snappedRef.lng);
        }
        if (opts.updateMarker && locationRefMarker) {
            locationRefMarker.setLatLng([snappedRef.lat, snappedRef.lng]);
        }

        return snappedRef;
    }

    let pivoGlobalData = null;
    let pivoSegments = [];
    let activeSegmentIndex = 0;

    let canhao1MapInstance = null;
    let canhao1Circle = null;
    let canhao1Sector = null;
    let canhao1SegmentLayer = null;
    let canhao1TickLayer = null;
    let canhao1RefLine = null;
    let canhao1Segments = [];
    let activeCanhao1SegmentIndex = 0;
    let canhao1SegBoundaryMarkers = [];
    let canhao1Triangle = null;

    let canhao2MapInstance = null;
    let canhao2Circle = null;
    let canhao2Sector = null;
    let canhao2SegmentLayer = null;
    let canhao2TickLayer = null;
    let canhao2RefLine = null;
    let canhao2Segments = [];
    let activeCanhao2SegmentIndex = 0;
    let canhao2SegBoundaryMarkers = [];
    let canhao2Triangle = null;

    function destroyEditState() {
        // mountEditPanel troca o innerHTML do painel, então qualquer mapa
        // Leaflet vivo passa a apontar para nós que saíram do documento.
        // Precisa ser destruído de verdade, e não apenas ter a referência
        // zerada: reabrir a edição reaproveitava a instância órfã e travava.
        [locationMapInstance, canhao1MapInstance, canhao2MapInstance].forEach((instance) => {
            if (!instance) return;
            try {
                instance.off();
                instance.remove();
            } catch (_) { }
        });
        locationMapInstance = null;
        locationCircle = null;
        locationSector = null;
        locationCenterMarker = null;
        locationRefMarker = null;
        locationLastTowerMarker = null;

        pivoGlobalData = null;
        pivoSegments = [];
        activeSegmentIndex = 0;

        canhao1Segments = [];
        activeCanhao1SegmentIndex = 0;
        canhao1SegBoundaryMarkers = [];
        canhao1MapInstance = null;
        canhao1Circle = null;
        canhao1Sector = null;
        canhao1SegmentLayer = null;
        canhao1RefLine = null;
        canhao1Triangle = null;

        canhao2Segments = [];
        activeCanhao2SegmentIndex = 0;
        canhao2SegBoundaryMarkers = [];
        canhao2MapInstance = null;
        canhao2Circle = null;
        canhao2Sector = null;
        canhao2SegmentLayer = null;
        canhao2RefLine = null;
        canhao2Triangle = null;
    }

    const segmentPalette = [
        "rgb(0, 31, 153)",
        "rgb(160, 0, 229)",
        "rgb(0, 196, 179)",
        "rgb(82, 183, 0)",
        "rgb(255, 213, 0)",
        "rgb(255, 115, 0)",
        "rgb(142, 68, 173)",
        "rgb(22, 160, 133)",
        "rgb(233, 30, 99)"
    ];

    function getPointsForArc(lat, lng, rad, sA, eA) {
        let start = parseFloat(sA) || 0;
        let end = parseFloat(eA) || 360;
        if (end <= start) end += 360;

        const center = L.latLng(lat, lng);
        const pts = [center];
        const r1 = lat * Math.PI / 180;
        const c1 = lng * Math.PI / 180;

        let bRef = 0;
        const refStr = $("pivoEditLocRef")?.value || "";
        if (refStr.includes(",")) {
            const refLL = parseLL(refStr);
            if (refLL) {
                bRef = bearingBetween(lat, lng, refLL.lat, refLL.lng);
            }
        }

        const d = (toFiniteNumber(rad) || 100) / 6378137;
        for (let a = start; a <= end; a += 5) {
            const br = (bRef + a) * Math.PI / 180;
            const pLat = Math.asin(Math.sin(r1) * Math.cos(d) + Math.cos(r1) * Math.sin(d) * Math.cos(br));
            const pLng = c1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(r1), Math.cos(d) - Math.sin(r1) * Math.sin(pLat));
            const pt = L.latLng(pLat * 180 / Math.PI, pLng * 180 / Math.PI);
            if (Number.isFinite(pt.lat) && Number.isFinite(pt.lng)) {
                pts.push(pt);
            }
        }

        const brLast = (bRef + end) * Math.PI / 180;
        const pLatLast = Math.asin(Math.sin(r1) * Math.cos(d) + Math.cos(r1) * Math.sin(d) * Math.cos(brLast));
        const pLngLast = c1 + Math.atan2(Math.sin(brLast) * Math.sin(d) * Math.cos(r1), Math.cos(d) - Math.sin(r1) * Math.sin(pLatLast));
        const ptLast = L.latLng(pLatLast * 180 / Math.PI, pLngLast * 180 / Math.PI);
        if (Number.isFinite(ptLast.lat) && Number.isFinite(ptLast.lng)) {
            pts.push(ptLast);
        }

        pts.push(center);
        return pts;
    }

    function drawCircleTicks(lat, lng, radius, startBearing = 0, arcAngle = 360, tickLayer = null) {
        const layer = tickLayer || locationTickLayer;
        if (!layer) return;
        layer.clearLayers();
        const outerR = radius;
        const innerR = radius * 0.92;
        const step = 5;
        const count = Math.floor(arcAngle / step);
        for (let i = 0; i <= count; i++) {
            const bearing = (startBearing + i * step) % 360;
            const outer = destPoint(lat, lng, outerR, bearing);
            const inner = destPoint(lat, lng, innerR, bearing);
            L.polyline([[outer.lat, outer.lng], [inner.lat, inner.lng]], {
                color: "#ffffff", weight: 1.5, opacity: 1,
            }).addTo(layer);
        }
    }

    // Enquadra o mapa ao círculo do pivô (zoom automático para raios grandes e pequenos)
    function fitLocationMapToPivot() {
        if (!locationMapInstance) return;
        const c = parseLL($("pivoEditLocCenter")?.value);
        if (!c) return;
        const r = toFiniteNumber($("pivoEditLocRadius")?.value) || pivoGlobalData?.radius || 300;
        try {
            locationMapInstance.fitBounds(L.latLng(c.lat, c.lng).toBounds(r * 2), { padding: [40, 40] });
        } catch (_) {}
    }

    function drawMapFeatures() {
        if (!locationMapInstance || !locationCircle) return;

        const centerStr = $("pivoEditLocCenter")?.value || "";
        const refStr    = $("pivoEditLocRef")?.value || "";

        let lat = -18.846005, lng = -48.386471;
        if (centerStr.includes(",")) {
            lat = parseFloat(centerStr.split(",")[0]);
            lng = parseFloat(centerStr.split(",")[1]);
        }

        const centerLL = L.latLng(lat, lng);
        const radius   = parseFloat($("pivoEditLocRadius")?.value) || pivoGlobalData?.radius || 300;
        let maxAngle   = parseFloat($("pivoEditLocMaxAng")?.value);
        if (isNaN(maxAngle) || maxAngle <= 0) maxAngle = 360;

        // Bearing do ponto de referência (ângulo 0°)
        const refStr0 = $("pivoEditLocRef")?.value || "";
        let refBearing = 0;
        if (refStr0.includes(",")) {
            const rr = parseFloat(refStr0.split(",")[0]);
            const rc = parseFloat(refStr0.split(",")[1]);
            refBearing = bearingBetween(lat, lng, rr, rc);
        }

        // Atualiza círculo / setor in-place
        if (maxAngle >= 360) {
            locationCircle.setLatLng(centerLL);
            locationCircle.setRadius(radius);
            locationCircle.setStyle({ opacity: 1, fillOpacity: 0 });
            drawCircleTicks(lat, lng, radius);
            locationSector.setLatLngs([]);
            locationSector.setStyle({ opacity: 0, fillOpacity: 0 });
            if (locationSectorStartMarker) locationSectorStartMarker.setOpacity(0);
            if (locationSectorEndMarker) locationSectorEndMarker.setOpacity(0);
        } else {
            locationCircle.setStyle({ opacity: 0, fillOpacity: 0 });
            drawCircleTicks(lat, lng, radius, refBearing, maxAngle);
            locationSector.setLatLngs(getPointsForArc(lat, lng, radius, 0, maxAngle));
            locationSector.setStyle({ opacity: 1, fillOpacity: 0 });
            // Posiciona marcadores de canto do setor (visibilidade controlada pela seleção abaixo)
            if (locationSectorStartMarker) {
                const startPt = destPoint(lat, lng, radius, refBearing);
                locationSectorStartMarker.setLatLng([startPt.lat, startPt.lng]);
            }
            if (locationSectorEndMarker) {
                const endBearing = (refBearing + maxAngle) % 360;
                const endPt = destPoint(lat, lng, radius, endBearing);
                locationSectorEndMarker.setLatLng([endPt.lat, endPt.lng]);
            }
        }

        // Redesenha segmentos
        normalizeSingleSegment();
        locationSegmentLayer.clearLayers();
        // Borda branca (mesmo estilo do criar equipamento): separa as cores sem uma pintar por cima da outra
        pivoSegments.forEach((seg, i) => {
            const isAct   = i === activeSegmentIndex;
            const bColor  = segmentPalette[i % segmentPalette.length];
            if (seg.startAngle !== "" && seg.endAngle !== "") {
                L.polygon(getPointsForArc(lat, lng, radius, seg.startAngle, seg.endAngle), {
                    color: "#ffffff", opacity: 0, weight: isAct ? 2 : 1,
                    fillColor: bColor,
                    fillOpacity: isAct ? 0.85 : 0.65,
                }).addTo(locationSegmentLayer);
            }
        });

        // Ticks, borda do setor e borda do círculo ficam na frente dos segmentos (fillOpacity=0, sem cobertura)
        if (locationTickLayer) locationTickLayer.bringToFront();
        if (locationSector) locationSector.bringToFront();
        if (locationCircle) locationCircle.bringToFront();

        // Visibilidade dos marcadores: 3 modos mutuamente exclusivos
        const isSector = maxAngle < 360;
        if (activeSegmentIndex >= pivoSegments.length) activeSegmentIndex = 0;
        const seg = pivoSegments[activeSegmentIndex];
        const segColor = segmentPalette[activeSegmentIndex % segmentPalette.length];

        // Helper de visibilidade
        const show = (m, v) => {
            if (!m) return;
            if (typeof m.setOpacity === 'function') m.setOpacity(v ? 1 : 0);
            else if (typeof m.setStyle === 'function') m.setStyle({ opacity: v ? 1 : 0, fillOpacity: v ? 1 : 0 });
            // Não chama enable/disable se o marker está sendo arrastado agora — interromperia o drag
            try { if (!m.dragging?._dragging) m.dragging?.[v ? 'enable' : 'disable']?.(); } catch (_) {}
        };

        if (showSegmentMarkers && pivoSegments.length > 1) {
            // Modo segmento: bolinha em cada fronteira de parcela, esconde pinos
            show(locationCenterMarker, false);
            show(locationRefMarker, false);
            show(locationSectorStartMarker, false);
            show(locationSectorEndMarker, false);

            const isFull = maxAngle >= 360;
            // Para círculo completo: sincroniza última.endAngle = primeira.startAngle
            if (isFull && pivoSegments.length > 1) {
                pivoSegments[pivoSegments.length - 1].endAngle = pivoSegments[0].startAngle;
            }

            if (isFull) {
                // Slot 0 = fronteira entre última e primeira parcela
                if (locationSegBoundaryMarkers[0]) {
                    const sA = parseFloat(pivoSegments[0].startAngle) || 0;
                    const p = destPoint(lat, lng, radius, (refBearing + sA) % 360);
                    locationSegBoundaryMarkers[0].setLatLng([p.lat, p.lng]);
                    show(locationSegBoundaryMarkers[0], true);
                }
                // Slots 1 .. N-1 = fronteiras internas
                for (let i = 1; i < pivoSegments.length; i++) {
                    const bm = locationSegBoundaryMarkers[i];
                    if (!bm) continue;
                    const eA = parseFloat(pivoSegments[i - 1].endAngle) || 0;
                    const p = destPoint(lat, lng, radius, (refBearing + eA) % 360);
                    bm.setLatLng([p.lat, p.lng]);
                    show(bm, true);
                }
                // Esconde slot N em diante (extras)
                for (let i = pivoSegments.length; i < locationSegBoundaryMarkers.length; i++) {
                    show(locationSegBoundaryMarkers[i], false);
                }
            } else {
                // Setor: mostra todas as fronteiras (slot 0 = início, slots 1..N = fim de cada seg)
                if (locationSegBoundaryMarkers[0]) {
                    const sA = parseFloat(pivoSegments[0].startAngle) || 0;
                    const p = destPoint(lat, lng, radius, (refBearing + sA) % 360);
                    locationSegBoundaryMarkers[0].setLatLng([p.lat, p.lng]);
                    show(locationSegBoundaryMarkers[0], true);
                }
                pivoSegments.forEach((s, i) => {
                    const bm = locationSegBoundaryMarkers[i + 1];
                    if (!bm) return;
                    const eA = parseFloat(s.endAngle) || 0;
                    const p = destPoint(lat, lng, radius, (refBearing + eA) % 360);
                    bm.setLatLng([p.lat, p.lng]);
                    show(bm, true);
                });
                for (let i = pivoSegments.length + 1; i < locationSegBoundaryMarkers.length; i++) {
                    show(locationSegBoundaryMarkers[i], false);
                }
            }
        } else {
            // Modo normal: pinos e bolinhas de setor
            locationSegBoundaryMarkers.forEach(bm => show(bm, false));

            show(locationCenterMarker, true);
            show(locationRefMarker, !isSector);

            // Bolinhas: sempre visíveis em modo setor (arrastáveis para ajustar ângulos)
            show(locationSectorStartMarker, isSector);
            show(locationSectorEndMarker, isSector);

        }

        // Atualiza linha de referência in-place.
        // Se um botão cardinal estiver selecionado, aponta para aquele bearing em vez do ref padrão.
        if (refStr.includes(",")) {
            let targetBearing = refBearing;
            if (selectedCardinalPoint === "end") {
                targetBearing = (refBearing + maxAngle) % 360;
            } else if (selectedCardinalPoint !== null && selectedCardinalPoint !== "start") {
                targetBearing = Number(selectedCardinalPoint);
            }
            // Linha travada no bearing inicial carregado, não muda com arraste ou botões cardeais
            const endPt = destPoint(lat, lng, radius, lockedRefBearing ?? refBearing);
            locationRefLine.setLatLngs([[lat, lng], [endPt.lat, endPt.lng]]);
            locationRefLine.setStyle({ opacity: 0.9 });
            locationRefLine.bringToFront();

            // Triângulo segue o targetBearing (inclui alinhamento cardeal)
            if (locationCardinalTriangle) {
                const rotation = (targetBearing + 180) % 360;
                const triPt = destPoint(lat, lng, radius * 0.95, targetBearing);
                locationCardinalTriangle.setIcon(makeTriangleIcon(rotation));
                locationCardinalTriangle.setLatLng([triPt.lat, triPt.lng]);
                locationCardinalTriangle.setOpacity(0.95);
            }
        } else {
            locationRefLine.setStyle({ opacity: 0 });
            if (locationCardinalTriangle) locationCardinalTriangle.setOpacity(0);
        }
        
        drawCanhaoMapFeatures(1);
        drawCanhaoMapFeatures(2);
    }

    function normalizeSingleSegment() {
        if (pivoSegments.length !== 1) return;
        const maxAngle = getPivotMaxAngleValue();
        pivoSegments[0].startAngle = 0;
        pivoSegments[0].endAngle = maxAngle;
    }

    function syncSegmentsToPivotBounds() {
        const maxAngle = getPivotMaxAngleValue();
        if (pivoSegments.length === 0) return;
        if (pivoSegments.length === 1) { normalizeSingleSegment(); return; }
        // Escala proporcional: mantém as proporções relativas dos segmentos
        const totalSpan = pivoSegments.reduce((sum, seg) => {
            const s = parseFloat(seg.startAngle) || 0;
            const e = parseFloat(seg.endAngle) || 0;
            return sum + Math.max(0, e - s);
        }, 0);
        if (!Number.isFinite(totalSpan) || totalSpan <= 0) {
            const step = maxAngle / pivoSegments.length;
            pivoSegments.forEach((seg, i) => {
                seg.startAngle = Math.round(i * step);
                seg.endAngle = Math.round((i + 1) * step);
            });
            return;
        }
        let cursor = 0;
        pivoSegments.forEach((seg, i) => {
            const span = (parseFloat(seg.endAngle) - parseFloat(seg.startAngle)) / totalSpan * maxAngle;
            seg.startAngle = Math.round(cursor);
            cursor += span;
            seg.endAngle = i === pivoSegments.length - 1 ? maxAngle : Math.round(cursor);
        });
    }

    function renderSegmentsUI() {
        const wrap = $("pivoEditSegmentList");
        if (!wrap) return;

        wrap.innerHTML = "";

        pivoSegments.forEach((seg, i) => {
            const btn = document.createElement("button");
            const bColor = segmentPalette[i % segmentPalette.length];
            btn.type = "button";
            btn.className = "pivo-seg-num-btn" + (i === activeSegmentIndex ? " is-active" : "");
            btn.dataset.segIdx = i;
            btn.style.cssText = `background: ${bColor}; --seg-color: ${bColor};`;
            btn.textContent = i + 1;
            btn.onclick = () => {
                activeSegmentIndex = i;
                showSegmentMarkers = true;
                renderSegmentsUI();
                populateSegmentForm();
                drawMapFeatures();
            };
            wrap.appendChild(btn);
        });

        // Nexus/SmartConnect permitem até 9 segmentos; SmartTouch/Centerstar seguem limitados a 6.
        const maxSegmentsUI = getSegmentCapForPivot(pivoGlobalData);
        if (pivoSegments.length < maxSegmentsUI) {
            let maxAngle = parseFloat($("pivoEditLocMaxAng")?.value);
            if (isNaN(maxAngle) || maxAngle <= 0) maxAngle = 360;
            const lastAngle = parseFloat(pivoSegments[pivoSegments.length - 1]?.endAngle) || 0;
            const isFull = lastAngle >= maxAngle;

            const addBtn = document.createElement("button");
            addBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
            addBtn.type = "button";
            addBtn.className = "pivo-seg-add-btn";
            addBtn.title = "Adicionar segmento";
            addBtn.onclick = () => {
                // Divide o último segmento ao meio em vez de redistribuir tudo,
                // preservando as divisas que o usuário ajustou manualmente
                const newCount = pivoSegments.length + 1;
                const last = pivoSegments[pivoSegments.length - 1];
                const lastStart = parseFloat(last.startAngle) || 0;
                let lastEnd = parseFloat(last.endAngle);
                if (!Number.isFinite(lastEnd)) lastEnd = maxAngle;
                let span = lastEnd - lastStart;
                if (span <= 0) span += 360; // segmento que cruza o ângulo zero
                const mid = +((lastStart + span / 2) % 360).toFixed(2);
                last.endAngle = mid;
                pivoSegments.push({ name: `Segmento ${newCount}`, startAngle: mid, endAngle: lastEnd });
                activeSegmentIndex = pivoSegments.length - 1;
                showSegmentMarkers = true;
                renderSegmentsUI();
                populateSegmentForm();
                drawMapFeatures();
            };
            wrap.appendChild(addBtn);
        }

        if (pivoSegments.length >= 1) {
            const delBtn = document.createElement("button");
            delBtn.innerHTML = '<i class="fa-regular fa-trash-can"></i>';
            delBtn.type = "button";
            delBtn.className = "pivo-seg-del-btn";
            const canDelete = pivoSegments.length > 1;
            delBtn.title = canDelete ? "Remover parcela" : "O pivô precisa ter pelo menos 1 segmento";
            delBtn.disabled = !canDelete;
            if (canDelete) {
                delBtn.onclick = () => {
                    pivoSegments.splice(activeSegmentIndex, 1);
                    activeSegmentIndex = Math.max(0, activeSegmentIndex - 1);
                    const remCount = pivoSegments.length;
                    const delMaxAngle = getPivotMaxAngleValue();
                    const remStep = delMaxAngle / remCount;
                    for (let i = 0; i < remCount; i++) {
                        pivoSegments[i].startAngle = +(i * remStep).toFixed(2);
                        pivoSegments[i].endAngle   = +(((i + 1) * remStep)).toFixed(2);
                    }
                    normalizeSingleSegment();
                    showSegmentMarkers = remCount > 1;
                    renderSegmentsUI();
                    populateSegmentForm();
                    drawMapFeatures();
                };
            }
            wrap.appendChild(delBtn);
        }
    }

    function populateSegmentForm() {
        const seg = pivoSegments[activeSegmentIndex];
        if (!seg) return;

        if ($("pivoEditSegName")) $("pivoEditSegName").value = seg.name || "";

        if ($("pivoEditSegStartAng")) {
            const startInp = $("pivoEditSegStartAng");
            startInp.value = seg.startAngle;
            if (activeSegmentIndex === 0) {
                startInp.removeAttribute("disabled");
                startInp.classList.remove("is-disabled");
                startInp.style.cssText = "";
            } else {
                startInp.setAttribute("disabled", "true");
                startInp.classList.add("is-disabled");
                startInp.style.cssText = "background: #f8fafc; color: #94a3b8; cursor: not-allowed; pointer-events: none;";
            }
        }
        if ($("pivoEditSegEndAng")) $("pivoEditSegEndAng").value = seg.endAngle;

        // Lâmina é independente por segmento: cada um guarda o próprio valor,
        // então ao trocar de segmento o campo reflete só o dele (vazio se novo).
        if ($("pivoEditSegLaminaAvanco")) $("pivoEditSegLaminaAvanco").value = seg.laminaAvanco ?? "";
        if ($("pivoEditSegLaminaReverso")) $("pivoEditSegLaminaReverso").value = seg.laminaReverso ?? "";
    }

    function bindSegmentInputs() {
        if ($("pivoEditSegName")) {
            $("pivoEditSegName").oninput = (e) => {
                if (pivoSegments[activeSegmentIndex]) pivoSegments[activeSegmentIndex].name = e.target.value;
            };
        }

        if ($("pivoEditSegStartAng")) {
            $("pivoEditSegStartAng").oninput = (e) => {
                if (pivoSegments[activeSegmentIndex]) {
                    pivoSegments[activeSegmentIndex].startAngle = e.target.value;
                    drawMapFeatures();
                }
            };
        }
        if ($("pivoEditSegEndAng")) {
            $("pivoEditSegEndAng").oninput = (e) => {
                if (pivoSegments[activeSegmentIndex]) {
                    pivoSegments[activeSegmentIndex].endAngle = e.target.value;
                    if (pivoSegments[activeSegmentIndex + 1]) {
                        pivoSegments[activeSegmentIndex + 1].startAngle = e.target.value;
                    }
                    drawMapFeatures();
                    renderSegmentsUI();
                }
            };
        }

        if ($("pivoEditSegLaminaAvanco")) {
            $("pivoEditSegLaminaAvanco").oninput = (e) => {
                if (pivoSegments[activeSegmentIndex]) pivoSegments[activeSegmentIndex].laminaAvanco = e.target.value;
            };
        }
        if ($("pivoEditSegLaminaReverso")) {
            $("pivoEditSegLaminaReverso").oninput = (e) => {
                if (pivoSegments[activeSegmentIndex]) pivoSegments[activeSegmentIndex].laminaReverso = e.target.value;
            };
        }

        // Botões de parcelas pré-definidas
        document.querySelectorAll(".pivo-preset-btn").forEach(btn => {
            if (btn.dataset.bound) return;
            btn.dataset.bound = "1";
            btn.addEventListener("click", () => {
                const n = parseInt(btn.dataset.preset);
                const presetMax = getSegmentCapForPivot(pivoGlobalData);
                if (!n || n < 1 || n > presetMax) return;
                let maxAngle = parseFloat($("pivoEditLocMaxAng")?.value);
                if (isNaN(maxAngle) || maxAngle <= 0) maxAngle = 360;
                const step = maxAngle / n;
                pivoSegments = Array.from({ length: n }, (_, i) => ({
                    name: `Segmento ${i + 1}`,
                    startAngle: Math.round(i * step),
                    endAngle: Math.round((i + 1) * step),
                }));
                activeSegmentIndex = 0;
                showSegmentMarkers = true;
                renderSegmentsUI();
                populateSegmentForm();
                drawMapFeatures();
            });
        });
    }

    function bindLocationInputs() {
        const centerInput = $("pivoEditLocCenter");
        const refInput    = $("pivoEditLocRef");
        const radiusInput = $("pivoEditLocRadius");
        const lastTowerInput = $("pivoEditLocLastTower");

        // Inputs -> redraw
        if (centerInput && !centerInput.dataset.locBound) {
            centerInput.dataset.locBound = "1";
            centerInput.addEventListener("change", () => {
                const pt = parseLL(centerInput.value);
                if (pt && locationCenterMarker) locationCenterMarker.setLatLng([pt.lat, pt.lng]);
                if (pt && locationMapInstance) locationMapInstance.panTo([pt.lat, pt.lng]);
                syncSmartTouchGeneralFields({ source: "center" });
                syncPivotReferenceToRadius();
                drawMapFeatures();
            });
        }
        if (refInput && !refInput.dataset.locBound) {
            refInput.dataset.locBound = "1";
            refInput.addEventListener("change", () => {
                const pt = parseLL(refInput.value);
                syncPivotReferenceToRadius(pt);
                drawMapFeatures();
            });
        }

        // Campo visível "Localização da referência inicial ângulo zero"
        const angleLLInput = $("pivoEditAngleLatLng");
        if (angleLLInput && !angleLLInput.dataset.locBound) {
            angleLLInput.dataset.locBound = "1";
            const applyAngleLL = () => {
                const pt = parseLL(angleLLInput.value);
                if (!pt) return;
                if ($("pivoEditLocRef")) $("pivoEditLocRef").value = fmtLL(pt.lat, pt.lng);
                const snapped = syncPivotReferenceToRadius(pt);
                if (snapped) angleLLInput.value = fmtLL(snapped.lat, snapped.lng);
                drawMapFeatures();
            };
            angleLLInput.addEventListener("change", applyAngleLL);
            angleLLInput.addEventListener("blur", applyAngleLL);
        }

        const angleLocBtn = $("pivoEditAngleLocBtn");
        if (angleLocBtn && !angleLocBtn.dataset.locBound && navigator.geolocation) {
            angleLocBtn.dataset.locBound = "1";
            angleLocBtn.addEventListener("click", () => {
                angleLocBtn.disabled = true;
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const pt = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                        if ($("pivoEditLocRef")) $("pivoEditLocRef").value = fmtLL(pt.lat, pt.lng);
                        syncPivotReferenceToRadius(pt);
                        drawMapFeatures();
                        angleLocBtn.disabled = false;
                    },
                    () => { angleLocBtn.disabled = false; },
                    { enableHighAccuracy: true, timeout: 8000 }
                );
            });
        }

        // pivoEditRefDist: user types distance in meters → move ref marker keeping current bearing
        const refDistInput = $("pivoEditRefDist");
        if (refDistInput && !refDistInput.dataset.locBound) {
            refDistInput.dataset.locBound = "1";
            refDistInput.addEventListener("change", () => {
                const newDist = parseFloat(String(refDistInput.value).replace(",", "."));
                if (!newDist || newDist <= 0) return;
                const cPt = locationCenterMarker?.getLatLng();
                const rPt = locationRefMarker?.getLatLng();
                if (!cPt || !rPt) return;
                const bearing = bearingBetween(cPt.lat, cPt.lng, rPt.lat, rPt.lng);
                const newPt = destPoint(cPt.lat, cPt.lng, newDist, bearing);
                if ($("pivoEditLocRef")) $("pivoEditLocRef").value = fmtLL(newPt.lat, newPt.lng);
                if (locationRefMarker) locationRefMarker.setLatLng([newPt.lat, newPt.lng]);
                setFixed2Input($("pivoEditLocRadius"), newDist);
                syncPivotReferenceToRadius({ lat: newPt.lat, lng: newPt.lng });
                drawMapFeatures();
                fitLocationMapToPivot();
            });
        }

        if (radiusInput && !radiusInput.dataset.locBound) {
            radiusInput.dataset.locBound = "1";
            const applyRadiusChange = () => {
                if (pivoGlobalData) pivoGlobalData.radius = parseFloat(radiusInput.value) || pivoGlobalData.radius;
                syncSmartTouchGeneralFields({ source: "location-radius" });
                syncPivotReferenceToRadius();
                drawMapFeatures();
                fitLocationMapToPivot();
            };
            radiusInput.addEventListener("input", applyRadiusChange);
            radiusInput.addEventListener("change", applyRadiusChange);
        }

        if (lastTowerInput && !lastTowerInput.dataset.locBound) {
            lastTowerInput.dataset.locBound = "1";
            lastTowerInput.addEventListener("change", () => {
                syncSmartTouchGeneralFields({ source: "last-tower" });
            });
        }

        // pivoEditSystemLength (SmartTouch): user types meters → update pivoEditLocRef + move marker
        const systemLengthInput = $("pivoEditSystemLength");
        if (systemLengthInput && !systemLengthInput.dataset.locBound) {
            systemLengthInput.dataset.locBound = "1";
            systemLengthInput.addEventListener("change", () => {
                const newDist = parseFloat(systemLengthInput.value);
                if (!newDist || newDist <= 0) return;
                const cPt = locationCenterMarker?.getLatLng();
                const rPt = locationRefMarker?.getLatLng();
                if (!cPt || !rPt) return;
                const bearing = bearingBetween(cPt.lat, cPt.lng, rPt.lat, rPt.lng);
                const newPt = destPoint(cPt.lat, cPt.lng, newDist, bearing);
                if ($("pivoEditLocRef")) $("pivoEditLocRef").value = fmtLL(newPt.lat, newPt.lng);
                setFixed2Input($("pivoEditLocRadius"), newDist);
                if (pivoGlobalData) pivoGlobalData.radius = newDist;
                if (locationRefMarker) locationRefMarker.setLatLng([newPt.lat, newPt.lng]);
                syncPivotReferenceToRadius({ lat: newPt.lat, lng: newPt.lng });
                drawMapFeatures();
            });
        }

        const maxAngInput = $("pivoEditLocMaxAng");
        if (maxAngInput && !maxAngInput.dataset.locBound) {
            maxAngInput.dataset.locBound = "1";
            maxAngInput.addEventListener("input", () => {
                const v = parseFloat(maxAngInput.value);
                if (!isNaN(v) && v > 360) maxAngInput.value = 360;
                if ($("pivoEditMaxAngle")) $("pivoEditMaxAngle").value = maxAngInput.value;
                if (!isNaN(v) && v > 0) {
                    syncSegmentsToPivotBounds();
                    [1, 2].forEach(idx => syncCanhaoSegmentsToPivotBounds(idx));
                    drawMapFeatures();
                    renderSegmentsUI();
                    syncDisplayFields(getPivotRadiusValue());
                }
            });
            maxAngInput.addEventListener("change", () => {
                if (parseFloat(maxAngInput.value) > 360) maxAngInput.value = 360;
                syncSegmentsToPivotBounds();
                [1, 2].forEach(idx => {
                    syncCanhaoSegmentsToPivotBounds(idx);
                    populateCanhaoForm(idx, false);
                });
                syncCardinalBtnsMode();
                drawMapFeatures();
                renderSegmentsUI();
                populateSegmentForm();
            });
        }

        // "Obter Localização" Centro
        const centerWrap = centerInput?.closest(".edit-panel__input-wrap");
        const centerBtn  = centerWrap?.querySelector("button");
        if (centerBtn && !centerBtn.dataset.locBound) {
            centerBtn.dataset.locBound = "1";
            centerBtn.addEventListener("click", () => {
                showSegmentMarkers = false;
                renderSegmentsUI();
                drawMapFeatures();
                const pt = parseLL(centerInput?.value);
                if (pt && locationMapInstance) locationMapInstance.panTo([pt.lat, pt.lng]);
                // Garante drag ativo após qualquer mudança de estado
                setTimeout(() => {
                    if (locationCenterMarker) {
                        locationCenterMarker.setOpacity(1);
                        try { locationCenterMarker.dragging?.enable(); } catch (_) {}
                    }
                }, 50);
            });
        }

        // "Obter Localização" Referência
        const refWrap = refInput?.closest(".edit-panel__input-wrap");
        const refBtn  = refWrap?.querySelector("button");
        if (refBtn && !refBtn.dataset.locBound) {
            refBtn.dataset.locBound = "1";
            refBtn.addEventListener("click", () => {
                showSegmentMarkers = false;
                renderSegmentsUI();
                drawMapFeatures();
                const pt = parseLL(refInput?.value);
                if (pt && locationMapInstance) locationMapInstance.panTo([pt.lat, pt.lng]);
                setTimeout(() => {
                    if (locationRefMarker) {
                        locationRefMarker.setOpacity(1);
                        try { locationRefMarker.dragging?.enable(); } catch (_) {}
                    }
                }, 50);
            });
        }

        // "Set on map" System Length (SmartTouch)
        const systemLengthBtn = $("pivoEditSetSystemLengthBtn");
        if (systemLengthBtn && !systemLengthBtn.dataset.locBound) {
            systemLengthBtn.dataset.locBound = "1";
            systemLengthBtn.addEventListener("click", () => {
                showSegmentMarkers = false;
                renderSegmentsUI();
                drawMapFeatures();
                const cPt = locationCenterMarker?.getLatLng();
                if (cPt && locationMapInstance) locationMapInstance.panTo([cPt.lat, cPt.lng]);
                setTimeout(() => {
                    if (locationRefMarker) {
                        locationRefMarker.setOpacity(1);
                        try { locationRefMarker.dragging?.enable(); } catch (_) {}
                    }
                }, 50);
            });
        }

        // "Obter última torre"
        const lastTowerBtn = $("pivoEditMapPickLastTowerBtn");
        if (lastTowerBtn && !lastTowerBtn.dataset.locBound) {
            lastTowerBtn.dataset.locBound = "1";
            lastTowerBtn.addEventListener("click", () => {
                if (!navigator.geolocation) { alert(tMsg("Geolocalização não suportada neste navegador.")); return; }
                navigator.geolocation.getCurrentPosition((pos) => {
                    const { latitude: la, longitude: lo } = pos.coords;
                    if ($("pivoEditLocLastTower")) $("pivoEditLocLastTower").value = fmtLL(la, lo);
                    syncSmartTouchGeneralFields({ source: "last-tower", force: true });
                }, () => alert(tMsg("Não foi possível obter a localização.")));
            });
        }

        // Botões cardinais (com suporte ao modo setor A/B)
        const cardinalBtnsWrap = document.querySelector(".pivo-cardinal-btns");


        const updateCardinalBtnStyles = () => {
            if (!cardinalBtnsWrap) return;
            cardinalBtnsWrap.querySelectorAll(".pivo-cardinal-btn").forEach(btn => {
                const val = btn.dataset.sectorPoint || btn.dataset.bearing;
                btn.classList.toggle("is-selected", val === selectedCardinalPoint);
            });
        };

        const syncCardinalBtnsMode = () => {
            if (!cardinalBtnsWrap) return;
            let maxAngle = parseFloat($("pivoEditLocMaxAng")?.value);
            if (isNaN(maxAngle) || maxAngle <= 0) maxAngle = 360;
            const cardinalContainer = cardinalBtnsWrap.parentElement;
            // O título/legenda fica sempre visível; só os botões são travados
            // quando o ângulo máximo é menor que 360°.
            if (cardinalContainer) cardinalContainer.style.display = "";
            cardinalBtnsWrap.innerHTML = `
                <button type="button" class="pivo-cardinal-btn" data-bearing="0" title="Norte">N</button>
                <button type="button" class="pivo-cardinal-btn" data-bearing="90" title="Leste">L</button>
                <button type="button" class="pivo-cardinal-btn" data-bearing="180" title="Sul">S</button>
                <button type="button" class="pivo-cardinal-btn" data-bearing="270" title="Oeste">O</button>
            `;
            const locked = maxAngle < 360;
            cardinalBtnsWrap.classList.toggle("is-locked", locked);
            cardinalBtnsWrap.querySelectorAll(".pivo-cardinal-btn").forEach(b => { b.disabled = locked; });
            // Reseta seleção ao mudar de modo (setor ↔ 360°)
            selectedCardinalPoint = null;
            updateCardinalBtnStyles();
        };

        if (cardinalBtnsWrap && !cardinalBtnsWrap.dataset.locBound) {
            cardinalBtnsWrap.dataset.locBound = "1";
            cardinalBtnsWrap.addEventListener("click", (e) => {
                const btn = e.target.closest(".pivo-cardinal-btn");
                if (!btn) return;
                const val = btn.dataset.sectorPoint || btn.dataset.bearing;
                // Toggle: clicando no mesmo botão desseleciona
                selectedCardinalPoint = selectedCardinalPoint === val ? null : val;

                // Alinha o ângulo zero de verdade: move a referência (pino vermelho) para o cardeal,
                // mantendo o raio atual. O pino continua arrastável para ajuste fino.
                const bearing = Number(val);
                if (selectedCardinalPoint !== null && !btn.dataset.sectorPoint && Number.isFinite(bearing)) {
                    const cPos = locationCenterMarker?.getLatLng() || parseLL($("pivoEditLocCenter")?.value);
                    const radius = parseFloat($("pivoEditLocRadius")?.value) || pivoGlobalData?.radius || 300;
                    if (cPos) {
                        const pt = destPoint(cPos.lat, cPos.lng, radius, bearing);
                        if ($("pivoEditLocRef")) {
                            $("pivoEditLocRef").value = fmtLL(pt.lat, pt.lng);
                            syncRefDistDisplay(pt.lat, pt.lng);
                        }
                        if (locationRefMarker) locationRefMarker.setLatLng([pt.lat, pt.lng]);
                    }
                }

                updateCardinalBtnStyles();
                drawMapFeatures();
            });
        }

        syncCardinalBtnsMode();
    }

    function renderLocationMap(pivoData) {
        pivoGlobalData = pivoData;
        const mapEl = $("pivoEditLocationMap");
        if (!mapEl) return;

        if (locationMapInstance) {
            try {
                locationMapInstance.off();
                locationMapInstance.remove();
            } catch (e) {}
            locationMapInstance = null;
        }
        
        if (mapEl.offsetHeight === 0) {
            return;
        }

        mapEl.innerHTML = "";

        locationMapInstance = L.map(mapEl, {
            zoomControl: true,
            attributionControl: false,
            zoomSnap: 0,
            scrollWheelZoom: false,
            dragging: false
        });

        mapEl.addEventListener("wheel", (e) => {
            if (e.ctrlKey) {
                locationMapInstance.scrollWheelZoom.enable();
            } else {
                locationMapInstance.scrollWheelZoom.disable();
            }
        });

        mapEl.addEventListener("mousedown", (e) => {
            if (e.ctrlKey) locationMapInstance.dragging.enable();
        });
        mapEl.addEventListener("mouseup", () => {
            locationMapInstance.dragging.disable();
        });

        L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            { maxZoom: 20 }
        ).addTo(locationMapInstance);

        let lat = pivoData?.center?.lat || -18.846005;
        let lng = pivoData?.center?.lng || -48.386471;

        // Zoom automático conforme o raio do pivô (não corta o círculo nas bordas)
        const fitRadius = getPivotRadiusValue(pivoData?.radius || 300) || 300;
        locationMapInstance.fitBounds(L.latLng(lat, lng).toBounds(fitRadius * 2), { padding: [40, 40] });
        
        // Sincroniza os inputs com os dados reais do pivô carregado para não desenhar longe
        if ($("pivoEditLocCenter")) $("pivoEditLocCenter").value = fmtLL(lat, lng);
        if ($("pivoEditLocRadius")) $("pivoEditLocRadius").value = pivoData?.radius || "";
        if ($("pivoEditLocMaxAng")) { $("pivoEditLocMaxAng").value = pivoData?.maxAngle || 360; if ($("pivoEditMaxAngle")) $("pivoEditMaxAngle").value = pivoData?.maxAngle || 360; }
        
        let rLat = pivoData?.refLat;
        let rLng = pivoData?.refLng;
        if (!rLat || !rLng) {
            // Sem ref salva: coloca na borda norte ao raio do pivo
            const initRadius = pivoData?.radius || 300;
            const northPt = destPoint(lat, lng, initRadius, 0);
            rLat = northPt.lat;
            rLng = northPt.lng;
        }
        const snappedInitialRef = snapPointToPivotRadius(
            { lat, lng },
            { lat: Number(rLat), lng: Number(rLng) },
            getPivotRadiusValue(pivoData?.radius || 300),
            0
        );
        if ($("pivoEditLocRef") && snappedInitialRef) { $("pivoEditLocRef").value = fmtLL(snappedInitialRef.lat, snappedInitialRef.lng); syncRefDistDisplay(snappedInitialRef.lat, snappedInitialRef.lng); }
        lockedRefBearing = bearingBetween(lat, lng, snappedInitialRef?.lat ?? rLat, snappedInitialRef?.lng ?? rLng);

        // Renderiza pivos cadastrados como fundo suave, menos o ativo
        const farmObj = getFarmDataSafe();
        const allEquips = [...(Array.isArray(farmObj?.equipments) ? farmObj.equipments : []), ...(Array.isArray(farmObj?.equipamentos) ? farmObj.equipamentos : [])];
        const otherPivots = allEquips.filter(e => {
            const cat = String(e?.category || "").toLowerCase();
            return (cat === "pivos" || cat === "pivo" || cat === "pivot" || cat === "pivots") && String(e.id) !== String(pivoData?.id);
        });

        otherPivots.forEach(p => {
             const pLat = p.center?.lat;
             const pLng = p.center?.lng;
             const pRad = p.radius || 300;
             if (pLat && pLng) {
                 L.circle([pLat, pLng], {
                     radius: pRad,
                     color: "#94a3b8",
                     weight: 1,
                     fillColor: "#e2e8f0",
                     fillOpacity: 0.2,
                     dashArray: "4,4"
                 }).addTo(locationMapInstance);
             }
        });
        
        // Setup state dos segmentos
        if (pivoData?.segments && Array.isArray(pivoData.segments) && pivoData.segments.length > 0) {
            // Clona para n ter mutacao direta no state do db ate salvar
            pivoSegments = pivoData.segments.map((s, i) => ({...s, name: s.name || `Segmento ${i + 1}`}));
        } else {
            // Sem segmentos salvos: inicializa com 1 segmento cobrindo o pivô inteiro
            const initMaxAngle = getPivotMaxAngleValue();
            pivoSegments = [{ name: 'Segmento 1', startAngle: 0, endAngle: initMaxAngle }];
        }
        activeSegmentIndex = 0;
        showSegmentMarkers = true;
        normalizeSingleSegment();
        
        // Layers permanentes: criados uma vez, atualizados in-place
        locationCircle = L.circle([lat, lng], {
            radius: pivoGlobalData?.radius || 300,
            color: "#ffffff", weight: 2,
            fillOpacity: 0,
        }).addTo(locationMapInstance);

        locationTickLayer = L.featureGroup().addTo(locationMapInstance);

        locationSector = L.polygon([], {
            color: "#ffffff", weight: 2,
            fillOpacity: 0,
        }).addTo(locationMapInstance);

        locationSegmentLayer = L.featureGroup().addTo(locationMapInstance);

        locationRefLine = L.polyline([], {
            color: "#ffffff", weight: 2, opacity: 0,
        }).addTo(locationMapInstance);

        locationCardinalTriangle = L.marker([lat, lng], {
            icon: makeTriangleIcon(0), draggable: false, opacity: 0, interactive: false,
        }).addTo(locationMapInstance);

        // Marcadores arrastáveis
        const centerIcon = L.divIcon({
            className: "",
            html: '<div style="color:#16a34a;font-size:28px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5));pointer-events:none;"><i class="fa-solid fa-location-dot" style="pointer-events:none;"></i></div>',
            iconSize: [28, 28], iconAnchor: [14, 28],
        });
        locationCenterMarker = L.marker([lat, lng], { icon: centerIcon, draggable: true }).addTo(locationMapInstance);
        locationCenterMarker.on("drag", (e) => {
            const pos = e.target.getLatLng();
            if ($("pivoEditLocCenter")) $("pivoEditLocCenter").value = fmtLL(pos.lat, pos.lng);
            if (locationRefMarker) {
                const radius = parseFloat($("pivoEditLocRadius")?.value) || pivoGlobalData?.radius || 300;
                const oldRef = locationRefMarker.getLatLng();
                const brg = bearingBetween(pos.lat, pos.lng, oldRef.lat, oldRef.lng);
                const snapped = destPoint(pos.lat, pos.lng, radius, brg);
                locationRefMarker.setLatLng([snapped.lat, snapped.lng]);
                if ($("pivoEditLocRef")) { $("pivoEditLocRef").value = fmtLL(snapped.lat, snapped.lng); syncRefDistDisplay(snapped.lat, snapped.lng); }
            }
            drawMapFeatures();
        });
        locationCenterMarker.on("dragend", (e) => {
            const pos = e.target.getLatLng();
            if (pivoGlobalData) { pivoGlobalData.centerLat = pos.lat; pivoGlobalData.centerLng = pos.lng; }
            syncSmartTouchGeneralFields({ source: "center" });
            syncPivotReferenceToRadius();
            drawMapFeatures();
        });

        const refIcon = L.divIcon({
            className: "",
            html: '<div style="color:#ef4444;font-size:28px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5));pointer-events:none;"><i class="fa-solid fa-location-dot" style="pointer-events:none;"></i></div>',
            iconSize: [28, 28], iconAnchor: [14, 28],
        });
        const rPt = parseLL($("pivoEditLocRef")?.value) || { lat, lng };
        locationRefMarker = L.marker([rPt.lat, rPt.lng], { icon: refIcon, draggable: true }).addTo(locationMapInstance);
        locationRefMarker.on("drag", (e) => {
            const pos = e.target.getLatLng();
            const cPos = locationCenterMarker.getLatLng();

            // Arraste manual do ângulo zero: solta a trava do botão cardeal
            // para a linha branca e o triângulo acompanharem o pino
            if (selectedCardinalPoint !== null) {
                selectedCardinalPoint = null;
                document.querySelectorAll(".pivo-cardinal-btn").forEach(b => b.classList.remove("is-selected"));
            }

            // Calcula novo raio baseado no arraste
            const newRadius = L.latLng(cPos.lat, cPos.lng).distanceTo(pos);
            setFixed2Input($("pivoEditLocRadius"), newRadius);
            setFixed2Input($("pivoEditSystemLength"), newRadius);
            if (pivoGlobalData) pivoGlobalData.radius = newRadius;

            // Atualiza posição de referência (latitude/longitude livre no arraste)
            if ($("pivoEditLocRef")) { $("pivoEditLocRef").value = fmtLL(pos.lat, pos.lng); syncRefDistDisplay(pos.lat, pos.lng); }

            drawMapFeatures();
        });
        // Reenquadra ao soltar: o arraste do pino vermelho pode ter mudado o raio
        locationRefMarker.on("dragend", () => fitLocationMapToPivot());

        // Marcador azul: distância da última torre
        const lastTowerIcon = L.divIcon({
            className: "",
            html: '<div style="color:#3b82f6;font-size:22px;"><i class="fa-solid fa-location-dot"></i></div>',
            iconSize: [22, 22], iconAnchor: [11, 22],
        });
        const pivotRad = saneRadiusValue($("pivoEditLocRadius")?.value) || saneRadiusValue(pivoData?.radius) || 400;
        const rawLastTowerDist = saneRadiusValue(pivoData?.lastTowerRadius);
        const savedLastTowerDist = (rawLastTowerDist && rawLastTowerDist > 0 && rawLastTowerDist <= pivotRad)
            ? rawLastTowerDist : null;
        const lastTowerInitPos = savedLastTowerDist
            ? destPoint(lat, lng, savedLastTowerDist, 0)
            : destPoint(lat, lng, Math.min(400, pivotRad), 0);
        // O pino da última torre não é usado para posicionar nada no mapa: o
        // raio da torre é digitado no formulário. Fica sempre invisível e sem
        // interação — antes ele só não aparecia porque lastTowerRadius vinha
        // vazio, e passou a poluir o mapa quando o campo começou a ser gravado.
        locationLastTowerMarker = L.marker([lastTowerInitPos.lat, lastTowerInitPos.lng], {
            icon: lastTowerIcon,
            draggable: false,
            opacity: 0,
            interactive: false,
            keyboard: false,
        }).addTo(locationMapInstance);
        locationLastTowerMarker.on("drag", (e) => {
            const pos = e.target.getLatLng();
            const cPos = locationCenterMarker.getLatLng();
            const dist = Math.round(L.latLng(cPos.lat, cPos.lng).distanceTo(pos));
            const inpDist = $("pivoEditLastTowerDistance");
            if (inpDist) { inpDist.value = dist; inpDist.dataset.userEdited = "1"; inpDist.dataset.markerPlaced = "1"; }
            const inpCoords = $("pivoEditLastTowerCoords");
            if (inpCoords) inpCoords.value = fmtLL(pos.lat, pos.lng);
        });

        // Pino vermelho início do setor (arrastável)
        const startBolinha = L.divIcon({
            className: "",
            html: '<div style="color:#ef4444;font-size:20px;"><i class="fa-solid fa-location-dot"></i></div>',
            iconSize: [20, 20], iconAnchor: [10, 20],
        });
        locationSectorStartMarker = L.marker([lat, lng], { icon: startBolinha, draggable: true, opacity: 0 }).addTo(locationMapInstance);
        locationSectorStartMarker.on("drag", (e) => {
            const pos = e.target.getLatLng();
            const cPos = locationCenterMarker.getLatLng();
            
            // Calcula novo raio baseado no arraste
            const newRadius = L.latLng(cPos.lat, cPos.lng).distanceTo(pos);
            setFixed2Input($("pivoEditLocRadius"), newRadius);
            if (pivoGlobalData) pivoGlobalData.radius = newRadius;

            // Para o marcador de início, o arraste também redefine a linha de referência (ângulo 0)
            if ($("pivoEditLocRef")) { $("pivoEditLocRef").value = fmtLL(pos.lat, pos.lng); syncRefDistDisplay(pos.lat, pos.lng); }
            if (locationRefMarker) locationRefMarker.setLatLng([pos.lat, pos.lng]);
            
            drawMapFeatures();
        });

        // Pino vermelho fim do setor (arrastável)
        const endIcon = L.divIcon({
            className: "",
            html: '<div style="color:#ef4444;font-size:20px;"><i class="fa-solid fa-location-dot"></i></div>',
            iconSize: [20, 20], iconAnchor: [10, 20],
        });
        locationSectorEndMarker = L.marker([lat, lng], { icon: endIcon, draggable: true, opacity: 0 }).addTo(locationMapInstance);
        locationSectorEndMarker.on("drag", (e) => {
            const pos = e.target.getLatLng();
            const cPos = locationCenterMarker.getLatLng();
            const rPos = locationRefMarker.getLatLng();

            // Calcula novo raio baseado no arraste
            const newRadius = L.latLng(cPos.lat, cPos.lng).distanceTo(pos);
            setFixed2Input($("pivoEditLocRadius"), newRadius);
            if (pivoGlobalData) pivoGlobalData.radius = newRadius;

            // Calcula o ângulo final relativo à referência
            const refBrg = bearingBetween(cPos.lat, cPos.lng, rPos.lat, rPos.lng);
            const endBrg = bearingBetween(cPos.lat, cPos.lng, pos.lat, pos.lng);
            let angle = (endBrg - refBrg + 360) % 360;
            if (angle < 1) angle = 1;

            const inp = $("pivoEditLocMaxAng");
            if (inp) inp.value = Math.round(angle);

            syncSegmentsToPivotBounds();
            syncCanhaoSegmentsToPivotBounds();
            drawMapFeatures();
            renderSegmentsUI();
            populateCanhaoForm(false);
        });


        // Bolinhas de fronteira de parcelas (uma por segmento, máx 10)
        const mkBoundaryBolinha = () => L.divIcon({
            className: "",
            html: '<div style="width:14px;height:14px;border-radius:50%;background:#fff;border:3px solid #6366f1;box-shadow:0 0 4px rgba(0,0,0,.4);"></div>',
            iconSize: [14, 14], iconAnchor: [7, 7],
        });

        // Slot 0 = startAngle de seg[0]; slot b (1..N) = endAngle de seg[b-1]
        locationSegBoundaryMarkers = [];
        for (let b = 0; b < 10; b++) {
            const bm = L.marker([lat, lng], { icon: mkBoundaryBolinha(), draggable: true, opacity: 0, autoPan: false }).addTo(locationMapInstance);
            const bIdx = b;

            bm.on("dragstart", () => {
                locationMapInstance.dragging.disable();
                const el = bm.getElement();
                if (el) el.style.cursor = "grabbing";
            });

            bm.on("drag", (e) => {
                const pos  = e.target.getLatLng();
                const cPos = locationCenterMarker.getLatLng();
                const rPos = locationRefMarker.getLatLng();
                const refBrg  = bearingBetween(cPos.lat, cPos.lng, rPos.lat, rPos.lng);
                const r       = parseFloat($("pivoEditLocRadius")?.value) || pivoGlobalData?.radius || 300;
                const maxAng  = parseFloat($("pivoEditLocMaxAng")?.value);
                const isFull  = isNaN(maxAng) || maxAng >= 360;
                const MGAP    = 1;

                let angle = (bearingBetween(cPos.lat, cPos.lng, pos.lat, pos.lng) - refBrg + 360) % 360;

                // Corrige wrap-around em pivôs setoriais (ex: arrasta além de maxAng e o bearing volta a 0°)
                if (!isFull && angle > maxAng) {
                    const midGap = (maxAng + 360) / 2;
                    angle = angle <= midGap ? maxAng : 0;
                }

                angle = Math.round(angle);

                // Clamp contra segmentos vizinhos para não sobrescrever.
                // Em pivô circular a fronteira só pode se mover dentro do arco combinado dos dois
                // segmentos vizinhos (prev.startAngle → next.endAngle); checar apenas a distância
                // mínima até cada borda deixaria a bolinha dar a volta por cima dos outros segmentos.
                const clampInsideArc = (prevStart, nextEnd) => {
                    const spanTotal = ((nextEnd - prevStart + 360) % 360) || 360;
                    let rel = (angle - prevStart + 360) % 360;
                    rel = Math.max(MGAP, Math.min(spanTotal - MGAP, rel));
                    return Math.round((prevStart + rel) % 360);
                };
                if (bIdx === 0) {
                    if (isFull && pivoSegments.length > 1) {
                        const first = pivoSegments[0];
                        const last  = pivoSegments[pivoSegments.length - 1];
                        if (first && last) angle = clampInsideArc(last.startAngle, first.endAngle);
                    } else if (!isFull) {
                        const first = pivoSegments[0];
                        if (first) angle = Math.max(0, Math.min(first.endAngle - MGAP, angle));
                    }
                } else {
                    const prev = pivoSegments[bIdx - 1];
                    const next = pivoSegments[bIdx];
                    if (prev && next) {
                        if (isFull) {
                            angle = clampInsideArc(prev.startAngle, next.endAngle);
                        } else {
                            angle = Math.max(prev.startAngle + MGAP, Math.min(next.endAngle - MGAP, angle));
                        }
                    } else if (prev && !next) {
                        if (!isFull) angle = Math.max(prev.startAngle + MGAP, Math.min(maxAng, angle));
                    } else if (!prev && next) {
                        if (!isFull) angle = Math.max(0, Math.min(next.endAngle - MGAP, angle));
                    }
                }

                // Reposiciona a bolinha na borda do círculo com o ângulo corrigido
                const snapped = destPoint(cPos.lat, cPos.lng, r, (refBrg + angle) % 360);
                bm.setLatLng([snapped.lat, snapped.lng]);

                // Atualiza os segmentos
                if (bIdx === 0) {
                    if (isFull && pivoSegments.length > 1) {
                        // Pivô circular: bIdx=0 é a fronteira compartilhada entre o último e o primeiro segmento
                        const first = pivoSegments[0];
                        const last  = pivoSegments[pivoSegments.length - 1];
                        if (first) {
                            first.startAngle = angle;
                            if (activeSegmentIndex === 0 && $("pivoEditSegStartAng")) $("pivoEditSegStartAng").value = angle;
                        }
                        if (last) {
                            last.endAngle = angle;
                            if (activeSegmentIndex === pivoSegments.length - 1 && $("pivoEditSegEndAng")) $("pivoEditSegEndAng").value = angle;
                        }
                    } else {
                        // Pivô setorial: bIdx=0 é APENAS o startAngle do primeiro segmento
                        const first = pivoSegments[0];
                        if (first) {
                            first.startAngle = angle;
                            if (activeSegmentIndex === 0 && $("pivoEditSegStartAng")) $("pivoEditSegStartAng").value = angle;
                        }
                    }
                } else {
                    const prev = pivoSegments[bIdx - 1];
                    const next = pivoSegments[bIdx];
                    if (prev) {
                        prev.endAngle = angle;
                        if (bIdx - 1 === activeSegmentIndex && $("pivoEditSegEndAng")) $("pivoEditSegEndAng").value = angle;
                    }
                    if (next) {
                        next.startAngle = angle;
                        if (bIdx === activeSegmentIndex && $("pivoEditSegStartAng")) $("pivoEditSegStartAng").value = angle;
                    }
                }

                drawMapFeatures();
                renderSegmentsUI();
            });

            bm.on("dragend", () => {
                const el = bm.getElement();
                if (el) el.style.cursor = "";
            });

            locationSegBoundaryMarkers.push(bm);
        }

        showSegmentMarkers = false;

        renderSegmentsUI();
        populateSegmentForm();
        bindSegmentInputs();
        bindLocationInputs();

        drawMapFeatures();
        setTimeout(() => locationMapInstance.invalidateSize(), 400);
    }

    async function showEditView(options = {}) {
        // Cancela uma remoção ainda pendente da última vez que o painel foi
        // fechado: o overlay abaixo pode ser justamente aquele que está
        // esperando o fim da animação para sair.
        if (edit._overlayRemoveTimer) {
            clearTimeout(edit._overlayRemoveTimer);
            edit._overlayRemoveTimer = null;
        }

        // Cria (ou reutiliza) o overlay que desliza da direita, igual ao padrão config/faturamento
        let overlay = $("pivoEditOverlay");
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.id = "pivoEditOverlay";
            overlay.className = "config-overlay";
            overlay.style.zIndex = 1200 + document.querySelectorAll(".config-overlay").length;
            document.body.appendChild(overlay);
        }
        positionEditOverlay(overlay);

        // Reposiciona se a sidebar colapsar/expandir
        edit._resizeObserver?.disconnect();
        const mainEl = document.querySelector(".main");
        if (mainEl && typeof ResizeObserver === "function") {
            edit._resizeObserver = new ResizeObserver(() => positionEditOverlay(overlay));
            edit._resizeObserver.observe(mainEl);
        }

        const mounted = await mountEditPanel(overlay);
        if (!mounted) {
            edit._resizeObserver?.disconnect();
            overlay.remove();
            return;
        }

        // O painel já está montado com o HTML do formulário. Se popular os
        // campos falhar, registra o erro mas mantém o painel aberto: os
        // campos que deram certo continuam utilizáveis, e cada bloco é
        // independente. Desmontar aqui deixava o usuário sem tela nenhuma.
        try {
            renderPivotSelectorList();
        } catch (err) {
            console.error("Falha ao montar a lista de pivôs da edição.", err);
        }
        try {
            renderPivotForm();
        } catch (err) {
            console.error("Falha ao preencher o formulário de edição do pivô.", err);
        }

        // Anima a entrada (slide da direita)
        requestAnimationFrame(() => {
            requestAnimationFrame(() => overlay.classList.add("is-open"));
        });
    }

    function closeEditOverlay() {
        edit._resizeObserver?.disconnect();
        edit._resizeObserver = null;
        const overlay = $("pivoEditOverlay");
        if (overlay) {
            overlay.classList.remove("is-open");
            // A remoção espera a animação de saída. Guarda-se o timer para que
            // uma reabertura dentro desses 320ms possa cancelá-lo: sem isso o
            // timer pendente removia o overlay recém-montado e a tela ficava
            // travada, com o painel some sem erro nenhum no console.
            clearTimeout(edit._overlayRemoveTimer);
            edit._overlayRemoveTimer = setTimeout(() => {
                edit._overlayRemoveTimer = null;
                overlay.remove();
            }, 320);
        }
    }

    function bindSimpleEquipSelect(root) {
        if (!root) return;
        root.querySelectorAll(".equip-select").forEach(wrapper => {
            if (wrapper._equipBound) return;
            wrapper._equipBound = true;
            const trigger = wrapper.querySelector(".equip-select__trigger");
            const list    = wrapper.querySelector(".equip-select__list");
            const valueEl = wrapper.querySelector(".equip-select__value");
            const native  = wrapper.querySelector("select.equip-select__native");
            if (!trigger || !list) return;

            trigger.addEventListener("click", (e) => {
                e.stopPropagation();
                const isOpen = wrapper.classList.contains("is-open");
                wrapper.classList.toggle("is-open", !isOpen);
                trigger.setAttribute("aria-expanded", String(!isOpen));
            });

            list.querySelectorAll(".equip-select__option").forEach(opt => {
                opt.addEventListener("click", () => {
                    list.querySelectorAll(".equip-select__option").forEach(o => {
                        o.classList.remove("is-selected");
                        o.setAttribute("aria-selected", "false");
                    });
                    opt.classList.add("is-selected");
                    opt.setAttribute("aria-selected", "true");
                    if (valueEl) valueEl.textContent = opt.textContent.trim();
                    if (native)  native.value = opt.dataset.value || opt.textContent.trim();
                    trigger.setAttribute("aria-expanded", "false");
                    wrapper.classList.remove("is-open");
                    native?.dispatchEvent(new Event("change", { bubbles: true }));
                    // Toggle rádio/4G fields
                    if (native && native.id === "pivoEditCommType") {
                        const is4G = opt.dataset.value === "4G";
                        const radioGrid    = document.getElementById("pivoEditRadioGrid");
                        const gatewayField = document.getElementById("pivoEditGatewayField");
                        if (radioGrid)    radioGrid.style.display    = is4G ? "none" : "";
                        if (gatewayField) gatewayField.style.display = is4G ? "" : "none";
                    }
                });
            });

            document.addEventListener("click", (e) => {
                if (!wrapper.contains(e.target)) {
                    trigger.setAttribute("aria-expanded", "false");
                    wrapper.classList.remove("is-open");
                }
            });
        });
    }

    function bindEditUI() {
        // Voltar e Salvar são ligados primeiro e isolados: são as duas ações
        // essenciais do painel, e uma falha em qualquer bind seguinte não pode
        // deixar o usuário sem conseguir salvar nem fechar a edição.
        try {
            const backBtn = $("pivoEditBack");
            if (backBtn && !backBtn.dataset.bound) {
                backBtn.dataset.bound = "1";
                backBtn.addEventListener("click", () => {
                    closeEditOverlay();
                });
            }

            const saveBtn = document.querySelector("#pivoEditPanel .edit-panel__save");
            if (saveBtn && !saveBtn.dataset.bound) {
                saveBtn.dataset.bound = "1";
                saveBtn.disabled = false;
                saveBtn.addEventListener("click", () => {
                    Promise.resolve(handleSave()).catch((err) => {
                        console.error("Falha ao salvar o pivô.", err);
                        const btn = document.querySelector("#pivoEditPanel .edit-panel__save");
                        if (btn) btn.disabled = false;
                        window.IcNotify?.error?.("Não foi possível salvar o pivô.", 3000);
                    });
                });
            }
        } catch (err) {
            console.error("Falha ao ligar as ações principais da edição.", err);
        }

        syncSmartTouchLocationCopy();

        const speedEditInput = $("pivoEditSpeed");
        if (speedEditInput && !speedEditInput.dataset.bound) {
            speedEditInput.dataset.bound = "1";
            speedEditInput.addEventListener("input", () => {
                if (pivoGlobalData) pivoGlobalData.speed = speedEditInput.value;
            });
        }

        const irrigationRateEditInput = $("pivoEditIrrigationRate");
        if (irrigationRateEditInput && !irrigationRateEditInput.dataset.bound) {
            irrigationRateEditInput.dataset.bound = "1";
            irrigationRateEditInput.addEventListener("input", () => {
                if (pivoGlobalData) pivoGlobalData.irrigationRate = irrigationRateEditInput.value;
            });
        }

        // Lâmina de irrigação = 2000 × Q / (V × R)
        function calcLamina() {
            const Q = parseFloat($("scFlow")?.value);
            const V = parseFloat($("pivoEditSpeed")?.value);
            const R = parseFloat($("pivoEditRadius")?.value);
            const out = $("scIrrigationRate");
            if (!out) return;
            if (Q > 0 && V > 0 && R > 0) {
                out.value = (2000 * Q / (V * R)).toFixed(2);
            }
        }

        ["scFlow", "pivoEditSpeed", "pivoEditRadius"].forEach((id) => {
            const el = $(id);
            if (el && !el.dataset.laminaBound) {
                el.dataset.laminaBound = "1";
                el.addEventListener("input", calcLamina);
            }
        });

        calcLamina();

        const lastTowerDistanceInput = $("pivoEditLastTowerDistance");
        if (lastTowerDistanceInput && !lastTowerDistanceInput.dataset.bound) {
            lastTowerDistanceInput.dataset.bound = "1";
            lastTowerDistanceInput.addEventListener("input", () => {
                lastTowerDistanceInput.dataset.userEdited = "1";
                // Move the blue marker when user types a distance manually
                if (locationLastTowerMarker && locationCenterMarker) {
                    const dist = toFiniteNumber(lastTowerDistanceInput.value);
                    if (dist && dist > 0) {
                        const cPos = locationCenterMarker.getLatLng();
                        const curPos = locationLastTowerMarker.getLatLng();
                        const brg = (cPos.lat === curPos.lat && cPos.lng === curPos.lng)
                            ? 0
                            : bearingBetween(cPos.lat, cPos.lng, curPos.lat, curPos.lng);
                        const newPos = destPoint(cPos.lat, cPos.lng, dist, brg);
                        locationLastTowerMarker.setLatLng([newPos.lat, newPos.lng]);
                        locationLastTowerMarker.setOpacity(1);
                    }
                }
            });
        }

        const markLastTowerBtn = $("pivoEditMarkLastTowerBtn");
        if (markLastTowerBtn && !markLastTowerBtn.dataset.locBound) {
            markLastTowerBtn.dataset.locBound = "1";
            markLastTowerBtn.addEventListener("click", () => {
                if (!locationMapInstance || !locationCenterMarker) return;
                const cPos = locationCenterMarker.getLatLng();
                const pivotRadius = toFiniteNumber($("pivoEditLocRadius")?.value) || pivoGlobalData?.radius || 400;
                const currentDist = toFiniteNumber($("pivoEditLastTowerDistance")?.value);
                const dist = Math.min((currentDist && currentDist > 0) ? currentDist : 400, pivotRadius);
                const initPos = destPoint(cPos.lat, cPos.lng, dist, 0);
                if (locationLastTowerMarker) {
                    locationLastTowerMarker.setLatLng([initPos.lat, initPos.lng]);
                    locationLastTowerMarker.setOpacity(1);
                }
                locationMapInstance.panTo([cPos.lat, cPos.lng]);
                const inp = $("pivoEditLastTowerDistance");
                if (inp && (!inp.value || !toFiniteNumber(inp.value))) {
                    inp.value = dist;
                    inp.dataset.userEdited = "1";
                    inp.dataset.markerPlaced = "1";
                }
                const inpCoords = $("pivoEditLastTowerCoords");
                if (inpCoords) inpCoords.value = fmtLL(initPos.lat, initPos.lng);
            });
        }

        // Dropdown toggle global click handler for the edit screen
        if (!document.body.dataset.pivoEditSelectBound) {
            document.body.dataset.pivoEditSelectBound = "1";
            document.addEventListener("click", (e) => {
                // Só age quando o clique acontece dentro do painel de edição do pivô.
                // (Antes dependia de body.is-pivo-edit, classe que não é mais setada,
                // o que travava a abertura de todos os selects.)
                if (!e.target.closest("#pivoEditPanel")) return;

                const wrap = e.target.closest(".edit-panel__select-field");
                const option = e.target.closest(".edit-panel__select-option");

                if (option && wrap) {
                    const val = option.dataset.value;
                    const label = option.textContent;
                    const btn = wrap.querySelector(".edit-panel__select-btn");
                    if (btn) btn.textContent = label;

                    const hidden = wrap.parentElement.querySelector("input[type='hidden']");
                    if (hidden) {
                        hidden.value = val;
                        hidden.dispatchEvent(new Event("change", { bubbles: true }));
                    }

                    const selectEl = wrap.querySelector("select");
                    if (selectEl) {
                        selectEl.value = val;
                        selectEl.dispatchEvent(new Event("change", { bubbles: true }));
                    }

                    wrap.querySelectorAll(".edit-panel__select-option").forEach(opt => {
                        opt.classList.toggle("is-active", opt === option);
                    });

                    wrap.classList.remove("is-open");
                    return;
                }

                if (wrap) {
                    const isOpen = wrap.classList.contains("is-open");
                    document.querySelectorAll(".edit-panel__select-field").forEach(w => w.classList.remove("is-open"));
                    if (!isOpen) wrap.classList.add("is-open");
                    return;
                }

                document.querySelectorAll(".edit-panel__select-field").forEach(w => w.classList.remove("is-open"));
            });
        }

        const scPressureEl = $("scPressure");
        if (scPressureEl) scPressureEl.addEventListener("change", syncPressureFields);

        // Canhão Mode Change
        const canhaoModeInput = $("pivoEditCanhaoMode");
        if (canhaoModeInput) {
            const applyCanhaoModeVisibility = () => {
                const isSegment = canhaoModeInput.value === "segment";
                const segmentsWrap = $("pivoEditCanhaoSegmentsWrap");
                if (segmentsWrap) segmentsWrap.style.display = isSegment ? "flex" : "none";

                const sect = $("pivoEditCanhaoSegmentSection");
                if (sect) sect.style.display = isSegment ? "" : "none";
            };
            applyCanhaoModeVisibility();

            canhaoModeInput.addEventListener("change", () => {
                applyCanhaoModeVisibility();

                if (canhaoModeInput.value !== "segment") return;
                [1, 2].forEach(idx => {
                    const instance = idx === 1 ? canhao1MapInstance : canhao2MapInstance;
                    if (instance) {
                        setTimeout(() => {
                            if (!instance._container?.isConnected) return;
                            if (!instance._mapPane) return;
                            instance.invalidateSize();
                            drawCanhaoMapFeatures(idx);
                            const center = parseLL($("pivoEditLocCenter")?.value);
                            if (center) instance.panTo([center.lat, center.lng]);
                        }, 50);
                    } else if ($("pivoEditCanhaoSegmentSection")) {
                        renderCanhaoMap(pivoGlobalData, idx);
                    }
                });
            });
        }

        // Canhão 1 Segment Inputs
        let canhaoStart1 = $("pivoEditCanhaoSegStart1");
        if (!canhaoStart1) canhaoStart1 = $("pivoEditCanhaoSegStart");

        let canhaoEnd1 = $("pivoEditCanhaoSegEnd1");
        if (!canhaoEnd1) canhaoEnd1 = $("pivoEditCanhaoSegEnd");

        const _bindCanhaoInput = (input, idx, type) => {
            if (!input) return;
            input.addEventListener("input", (e) => {
                const segs = idx === 1 ? canhao1Segments : canhao2Segments;
                const activeIdx = idx === 1 ? activeCanhao1SegmentIndex : activeCanhao2SegmentIndex;
                const seg = segs[activeIdx];
                if (!seg) return;
                const val = parseFloat(e.target.value);
                if (!Number.isFinite(val)) return;
                const clamped = Math.max(0, Math.min(360, val));
                if (type === "start") seg.startAngle = clamped;
                else seg.endAngle = clamped;
                drawCanhaoMapFeatures(idx);
            });
            input.addEventListener("blur", (e) => {
                const segs = idx === 1 ? canhao1Segments : canhao2Segments;
                const activeIdx = idx === 1 ? activeCanhao1SegmentIndex : activeCanhao2SegmentIndex;
                if (!segs[activeIdx]) return;
                if (type === "start") {
                    segs[activeIdx].startAngle = clampCanhaoBoundaryAngle(activeIdx, "start", e.target.value, segs);
                } else {
                    // "Fim de volta completa": 360 (circular) ou o próprio maxAngle (setorial)
                    // no último/único segmento não deve ser embrulhado para 0 e colapsar no
                    // gap mínimo (virava 1). Preserva o valor cheio nesse caso.
                    const maxAngle = getPivotMaxAngleValue();
                    const fullEnd = maxAngle >= 360 ? 360 : maxAngle;
                    const raw = toFiniteNumber(e.target.value);
                    const isLast = activeIdx === segs.length - 1;
                    if (isLast && Number.isFinite(raw) && raw >= fullEnd) {
                        segs[activeIdx].endAngle = fullEnd;
                    } else {
                        segs[activeIdx].endAngle = clampCanhaoBoundaryAngle(activeIdx, "end", e.target.value, segs);
                    }
                }
                renderCanhaoUI(idx);
            });
        };

        _bindCanhaoInput(canhaoStart1, 1, "start");
        _bindCanhaoInput(canhaoEnd1,   1, "end");

        // Canhão 2 Segment Inputs
        const canhaoStart2 = $("pivoEditCanhaoSegStart2");
        const canhaoEnd2 = $("pivoEditCanhaoSegEnd2");
        _bindCanhaoInput(canhaoStart2, 2, "start");
        _bindCanhaoInput(canhaoEnd2,   2, "end");

        // Tabs
        document.querySelectorAll("#pivoEditPanel .edit-panel__tab").forEach((tab) => {
            if (tab.dataset.bound) return;
            tab.dataset.bound = "1";
            tab.addEventListener("click", () => {
                const target = tab.getAttribute("data-tab");
                if (!target) return;
                
                document.querySelectorAll("#pivoEditPanel .edit-panel__tab").forEach((btn) => {
                    const active = btn === tab;
                    btn.classList.toggle("is-active", active);
                    btn.setAttribute("aria-selected", active ? "true" : "false");
                });
                
                document.querySelectorAll("#pivoEditPanel [data-tab-body]").forEach((body) => {
                    const active = body.getAttribute("data-tab-body") === target;
                    body.classList.toggle("is-active", active);
                });
            });
        });

        // Left Nav
        document.querySelectorAll("#pivoEditPanel .edit-panel__nav").forEach((nav) => {
            const body = nav.closest(".edit-panel__body");
            if (!body) return;
            
            nav.querySelectorAll(".edit-panel__nav-item").forEach(btn => {
                if (btn.dataset.bound) return;
                btn.dataset.bound = "1";
                btn.addEventListener("click", () => {
                    nav.querySelectorAll(".edit-panel__nav-item").forEach((item) => {
                        item.classList.toggle("is-active", item === btn);
                    });
                    const target = btn.getAttribute("data-target");
                    if (!target) return;
                    
                    body.querySelectorAll(".edit-panel__section").forEach((section) => {
                        const active = `#${section.id}` === target;
                        section.classList.toggle("is-active", active);
                    });

                    if (target === "#pivoEditLocation") {
                        if (!locationMapInstance) {
                            renderLocationMap(pivoGlobalData);
                        } else {
                            setTimeout(() => locationMapInstance.invalidateSize(), 150);
                        }
                    }
                    if (target === "#pivoEditCanhao") {
                        if (!canhao1MapInstance) renderCanhaoMap(pivoGlobalData, 1);
                        else { setTimeout(() => { canhao1MapInstance.invalidateSize(); drawCanhaoMapFeatures(1); }, 150); }
                        
                        if (!canhao2MapInstance) renderCanhaoMap(pivoGlobalData, 2);
                        else { setTimeout(() => { canhao2MapInstance.invalidateSize(); drawCanhaoMapFeatures(2); }, 150); }
                    }
                });
            });
        });

        // Pluviometer toggle
        const pluvioToggle = $("pivoEditPluvioEnabled");
        const pluvioFields = $("pivoEditPluvioFields");
        if (pluvioToggle && pluvioFields) {
            if(!pluvioToggle.dataset.bound) {
                pluvioToggle.dataset.bound = "1";
                pluvioToggle.addEventListener("change", () => {
                    if (pluvioToggle.checked) {
                        pluvioFields.style.display = "block";
                    } else {
                        pluvioFields.style.display = "none";
                    }
                });
                // Initial state check in case it's loaded as checked
                if (pluvioToggle.checked) {
                    pluvioFields.style.display = "block";
                }
            }
        }

        // Autorreversão toggle
        const autoRevToggle = $("pivoEditAutoRevEnabled");
        const autoRevFields = $("pivoEditAutoRevFields");
        if (autoRevToggle && autoRevFields) {
            if (!autoRevToggle.dataset.bound) {
                autoRevToggle.dataset.bound = "1";
                autoRevToggle.addEventListener("change", () => {
                    autoRevFields.style.display = autoRevToggle.checked ? "block" : "none";
                });
                autoRevFields.style.display = autoRevToggle.checked ? "block" : "none";
            }
        }

        // Segmented control — Condição de parada (Autorreversão inline)
        const autoRevCondition = $("pivoEditAutoRevCondition");
        if (autoRevCondition && !autoRevCondition.dataset.bound) {
            autoRevCondition.dataset.bound = "1";
            const condBtns = autoRevCondition.querySelectorAll("button");
            condBtns.forEach(btn => {
                btn.addEventListener("click", () => {
                    condBtns.forEach(b => b.classList.remove("is-active"));
                    btn.classList.add("is-active");
                });
            });
        }

        // Protection/Reclosing toggle
        const voltageToggle = $("pivoEditVoltageController");
        const voltageFields = $("pivoEditVoltageFields");
        if (voltageToggle && voltageFields) {
            if(!voltageToggle.dataset.bound) {
                voltageToggle.dataset.bound = "1";
                const inputsToToggle = voltageFields.querySelectorAll('.sc-input');
                const reqIndicators = voltageFields.querySelectorAll('.edit-panel__req');

                const handleVoltageToggle = () => {
                    const isEnabled = voltageToggle.checked;
                    voltageFields.classList.toggle('is-disabled', !isEnabled);
                    inputsToToggle.forEach(input => {
                        input.disabled = !isEnabled;
                    });
                    reqIndicators.forEach(req => req.style.opacity = isEnabled ? '' : '0.4');
                };
                
                voltageToggle.addEventListener("change", handleVoltageToggle);
                
                // Set initial state on bind
                handleVoltageToggle();
            }
        }

        // Peak Hours toggles
        const peak1Container = $("pico1Container");
        if (peak1Container) {
            const toggle = $("pivoEditPeak1Enabled");
            const inputs = peak1Container.querySelectorAll('.sc-input');
            const reqs = peak1Container.querySelectorAll('.edit-panel__req');

            if (toggle) {
                const handleToggle = () => {
                    const isEnabled = toggle.checked;
                    peak1Container.classList.toggle('is-disabled', !isEnabled);
                    inputs.forEach(input => { input.disabled = !isEnabled; });
                    reqs.forEach(req => req.style.display = isEnabled ? '' : 'none');
                };
                toggle.addEventListener('change', handleToggle);
                handleToggle();
            }
        }

        const peak2Container = $("pico2Container");
        if (peak2Container) {
            const toggle = $("pivoEditPeak2Enabled");
            const inputs = peak2Container.querySelectorAll('.sc-input');
            // The labels in Pico 2 don't have asterisks initially, so we need to add/remove them
            const labels = peak2Container.querySelectorAll('.pivo-edit__field > label');

            if (toggle) {
                const handleToggle = () => {
                    const isEnabled = toggle.checked;
                    peak2Container.classList.toggle('is-disabled', !isEnabled);
                    inputs.forEach(input => { input.disabled = !isEnabled; });
                     labels.forEach(label => {
                        // Check if asterisk already exists
                        let asterisk = label.querySelector('.edit-panel__req');
                        if (isEnabled && !asterisk) {
                            label.insertAdjacentHTML('afterbegin', '<span class="edit-panel__req">*</span> ');
                        } else if (!isEnabled && asterisk) {
                            asterisk.remove();
                        }
                    });
                };
                toggle.addEventListener('change', handleToggle);
                handleToggle();
            }
        }

        // Autoreversion toggle
        const autoreversionToggle = $("pivoEditAutorreversaoEnabled");
        const autoreversionFields = $("pivoEditAutorreversaoFields");
        if (autoreversionToggle && autoreversionFields) {
            if(!autoreversionToggle.dataset.bound) {
                autoreversionToggle.dataset.bound = "1";
                const handleToggle = () => {
                    autoreversionFields.style.display = autoreversionToggle.checked ? 'block' : 'none';
                };
                autoreversionToggle.addEventListener('change', handleToggle);
                handleToggle(); // Set initial state
            }
        }
        
        // Segmented control logic within Autorreversão
        const segmentedControl = document.querySelector('#pivoEditAutorreversao .pivo-edit__segmented-control');
        if (segmentedControl && !segmentedControl.dataset.bound) {
            segmentedControl.dataset.bound = "1";
            const buttons = segmentedControl.querySelectorAll('button');
            buttons.forEach(button => {
                button.addEventListener('click', () => {
                    buttons.forEach(btn => btn.classList.remove('is-active'));
                    button.classList.add('is-active');
                });
            });
        }

        // History Row Expansion
        document.querySelectorAll(".edit-panel__history-expand-btn").forEach((btn) => {
            if (btn.dataset.boundFn) return;
            btn.dataset.boundFn = "1";
            btn.addEventListener("click", () => {
                const tr = btn.closest("tr");
                const rowId = tr?.dataset?.rowId;
                if (!rowId) return;

                const detailsRow = document.getElementById(`details-${rowId}`);
                if (!detailsRow) return;

                const isVisible = detailsRow.style.display !== "none";
                detailsRow.style.display = isVisible ? "none" : "table-row";
                });
        });

        // Bomba section - potência (kW)
        const bombaSection = $("pivoEditBomba");
        if (bombaSection && !bombaSection.dataset.bombaBound) {
            bombaSection.dataset.bombaBound = "1";
            const sc = window.IcEquipamentos?.smart_connect;
            if (sc) {
                const bombaState = { powerUnit: "kw", power: "" };
                sc.bindBombaStep(bombaSection, bombaState);
            }
        }

        // Radio reload buttons
        const radioGrid = document.querySelector("#pivoEditPanel .edit-panel__grid-4");
        if (radioGrid) {
            radioGrid.querySelectorAll(".edit-panel__icon-reload").forEach(btn => {
                if (btn.dataset.bound) return;
                btn.dataset.bound = "1";
                btn.addEventListener("click", () => {
                    const fieldBoxes = radioGrid.querySelectorAll(".edit-panel__field-box");

                    // Ensure all fields have an actions container for the status indicator
                    fieldBoxes.forEach(box => {
                        if (!box.querySelector(".edit-panel__input-wrap") && !box.dataset.radioWrapped) {
                            box.dataset.radioWrapped = "1";
                            const input = box.querySelector("input");
                            if (input) {
                                const wrap = document.createElement("div");
                                wrap.className = "edit-panel__input-wrap";
                                input.parentNode.insertBefore(wrap, input);
                                wrap.appendChild(input);
                                const actions = document.createElement("div");
                                actions.className = "edit-panel__input-actions";
                                wrap.appendChild(actions);
                            }
                        }
                    });

                    // Loading state
                    fieldBoxes.forEach(box => {
                        const isPassive = !!box.querySelector(".edit-panel__input.is-disabled") || !box.querySelector(".edit-panel__icon-reload");
                        box.classList.remove("is-radio-success", "is-radio-passive");
                        box.classList.add(isPassive ? "is-radio-loading-passive" : "is-radio-loading");
                        box.querySelector(".edit-panel__radio-status")?.remove();

                        const actions = box.querySelector(".edit-panel__input-actions");
                        if (actions) {
                            const status = document.createElement("span");
                            status.className = "edit-panel__radio-status";
                            status.innerHTML = isPassive
                                ? '<span class="edit-panel__radio-spinner edit-panel__radio-spinner--passive"></span>'
                                : '<span class="edit-panel__radio-spinner"></span>';
                            actions.appendChild(status);
                        }
                    });

                    // After 2.5s → success
                    setTimeout(() => {
                        fieldBoxes.forEach(box => {
                            const isPassive = !!box.querySelector(".edit-panel__input.is-disabled") || !box.querySelector(".edit-panel__icon-reload");
                            box.classList.remove("is-radio-loading", "is-radio-loading-passive");
                            box.classList.add(isPassive ? "is-radio-passive" : "is-radio-success");
                            const status = box.querySelector(".edit-panel__radio-status");
                            if (status) {
                                status.innerHTML = isPassive
                                    ? '<img class="edit-panel__radio-check edit-panel__radio-check--passive" src="./assets/img/svg/check.svg" alt="">'
                                    : '<img class="edit-panel__radio-check" src="./assets/img/svg/check-check.svg" alt="">';
                            }
                        });

                        // After 2s more → cleanup
                        setTimeout(() => {
                            fieldBoxes.forEach(box => {
                                box.classList.remove("is-radio-success", "is-radio-passive");
                                box.querySelector(".edit-panel__radio-status")?.remove();
                            });
                        }, 2000);
                    }, 2500);
                });
            });
        }

        // Radio swap modal
        bindRadioTrocarModal();

        // Modal "Ver Faixas de Energia" (Horários de Pico)
        bindFaixasEnergiaModal();

        // Tipo de comunicação dropdown
        bindSimpleEquipSelect($("pivoEditPanel"));
    }

    function bindRadioTrocarModal() {
        const modal    = $("radioTrocarModal");
        const grid     = $("radioTrocarGrid");
        const closeBtn = $("radioTrocarModalClose");
        const backdrop = $("radioTrocarModalBackdrop");
        const confirmBtn = $("radioTrocarConfirm");
        if (!modal) return;

        const pivotIds = [
            "0013A20041BE3E80","0013A20041BE3D08","0013A20041BE3FAE",
            "0013A20041BE3F8F","0013A20041BE3F1F","0013A20419AB36C",
            "0013A20041BE34DC","0013A20041BE3D32","0013A20041BE2C74",
            "0013A20419AAFEE","0013A20041BE2AB3","0013A20041BE2BDA",
            "0013A20041AF351B","0013A20041BE3D84","0013A20041CF6393",
            "0013A20041BE2B85","0013A20041AF34DC","0013A20041BE3D62",
            "0013A20041AF3513","0013A20041D95328","0013A20419AAF2A",
            "0013A20419AAFCE","0013A20041270841","0013A20041BE2CD4",
            "0013A20041BE3D58","0013A20419AAF34","0013A20041072696",
        ];

        let targetInput = null;
        let selectedCard = null;

        function buildGrid() {
            const options = document.querySelectorAll("#pivoEditSelectMenu .edit-panel__select-option");
            grid.innerHTML = "";
            options.forEach((opt, i) => {
                const name = opt.textContent.trim();
                const num  = name.replace(/\D/g, "").padStart(2, "0");
                const id   = pivotIds[i] || "0013A20041000000";
                const card = document.createElement("button");
                card.type = "button";
                card.className = "radio-trocar__card";
                card.dataset.radioId = id;
                card.innerHTML =
                    `<span class="radio-trocar__card-name"><span>Pivô</span> ${num}</span>` +
                    `<span class="radio-trocar__card-id">${id}</span>`;
                card.addEventListener("click", () => {
                    selectedCard?.classList.remove("is-selected");
                    selectedCard = card;
                    card.classList.add("is-selected");
                });
                grid.appendChild(card);
            });
        }

        function openModal(btn) {
            const field = btn.closest(".farm-radio-field");
            targetInput = field?.querySelector(".farm-radio-input") ?? null;
            const labelEl = field?.querySelector(".farm-radio-field__label");
            const labelText = labelEl ? labelEl.textContent.replace("*", "").trim() : "Rádio";
            const titleEl = $("radioTrocarModalTitle");
            if (titleEl) titleEl.textContent = "Trocar o " + labelText;
            selectedCard = null;
            buildGrid();
            modal.classList.remove("is-hidden");
        }

        function closeModal() {
            modal.classList.add("is-hidden");
            selectedCard = null;
        }

        document.querySelectorAll(".farm-radio-field__edit").forEach(btn => {
            if (btn.dataset.radioModalBound) return;
            btn.dataset.radioModalBound = "1";
            btn.addEventListener("click", () => openModal(btn));
        });

        if (!closeBtn.dataset.radioModalBound) {
            closeBtn.dataset.radioModalBound = "1";
            closeBtn.addEventListener("click", closeModal);
            backdrop.addEventListener("click", closeModal);
            confirmBtn.addEventListener("click", () => {
                if (selectedCard && targetInput) targetInput.value = selectedCard.dataset.radioId;
                closeModal();
            });
        }
    }

    function bindFaixasEnergiaModal() {
        const openBtn  = $("pivoEditVerFaixasBtn");
        const modal    = $("faixasEnergiaModal");
        const body     = $("faixasEnergiaBody");
        const closeBtn = $("faixasEnergiaClose");
        const closeFt  = $("faixasEnergiaCloseFooter");
        const backdrop = $("faixasEnergiaBackdrop");
        if (!openBtn || !modal || !body) return;

        // Grupos de faixas por conjunto de dias (mock — trocar por dados reais depois)
        const GROUPS = [
            {
                days: ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"],
                weekend: false,
                rows: [
                    { ini: "00:00", fim: "06:00", dur: "06:00", tipo: "reduzido" },
                    { ini: "06:00", fim: "17:00", dur: "11:00", tipo: "fora_ponta" },
                    { ini: "17:00", fim: "21:00", dur: "04:00", tipo: "ponta" },
                    { ini: "21:00", fim: "22:00", dur: "01:00", tipo: "fora_ponta" },
                    { ini: "22:00", fim: "23:59", dur: "01:59", tipo: "reduzido" },
                ],
            },
            {
                days: ["Sábado", "Domingo"],
                weekend: true,
                rows: [
                    { ini: "00:00", fim: "06:00", dur: "06:00", tipo: "reduzido" },
                    { ini: "06:00", fim: "22:00", dur: "16:00", tipo: "fora_ponta" },
                    { ini: "22:00", fim: "23:59", dur: "01:59", tipo: "reduzido" },
                ],
            },
        ];

        const TIPO_LABEL = {
            ponta:      "PICO (PONTA)",
            fora_ponta: "FORA DE PICO (FORA DE PONTA)",
            reduzido:   "REDUZIDO",
        };

        function render() {
            body.innerHTML = GROUPS.map(g => `
                <div class="faixas-view__group">
                    <div class="faixas-view__days">
                        ${g.days.map(d =>
                            `<span class="faixas-view__day-chip${g.weekend ? " faixas-view__day-chip--weekend" : ""}">${d}</span>`
                        ).join("")}
                    </div>
                    <table class="faixas-view__table">
                        <thead>
                            <tr><th>Intervalo</th><th>Duração</th><th>Tipo</th></tr>
                        </thead>
                        <tbody>
                            ${g.rows.map(r => `
                                <tr>
                                    <td>${r.ini} - ${r.fim}</td>
                                    <td>${r.dur}</td>
                                    <td><span class="faixas-view__badge faixas-view__badge--${r.tipo}">${TIPO_LABEL[r.tipo] || r.tipo}</span></td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            `).join("");
        }

        function openModal() {
            render();
            modal.classList.remove("is-hidden");
        }
        function closeModal() {
            modal.classList.add("is-hidden");
        }

        if (openBtn.dataset.faixasBound) return;
        openBtn.dataset.faixasBound = "1";
        openBtn.addEventListener("click", openModal);
        closeBtn?.addEventListener("click", closeModal);
        closeFt?.addEventListener("click", closeModal);
        backdrop?.addEventListener("click", closeModal);
    }

    edit.showEditView = showEditView;
    edit.close = closeEditOverlay;

})();
