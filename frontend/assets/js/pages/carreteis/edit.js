// assets/js/pages/carreteis/edit.js
(function () {
  "use strict";

  const Crt = (window.Crt = window.Crt || {});
  const state = (Crt.state = Crt.state || {});
  const $ = (id) => document.getElementById(id);
  const t = (text) => window.IcI18n?.t?.(text) ?? text;

  let editEventsBound = false;
  const edit = {};

  const { getActiveFarmSafe } = window.IcFarm;
  const { formatLastComm } = window.IcEquipUtils;

  function getCarreteisList() {
    const farm = getActiveFarmSafe();
    const list = Array.isArray(farm?.equipments) ? farm.equipments : [];
    return list.filter((e) => String(e?.category || "") === "carreteis" && String(e?.type || "") === "rainstar");
  }

  function getFocusCrt() {
    const list = getCarreteisList();
    if (!list.length) return null;
    if (state.editFocusId) {
      return list.find((c) => String(c.id) === String(state.editFocusId)) || list[0];
    }
    return list[0];
  }

  function normalizeCrtData(equip) {
    if (!equip) return null;
    const data = equip?.data || {};
    return {
      id: equip.id,
      name: equip.name || data.name || "",
      machineAddress: data.machineAddress || data.imei || "",
      preEnabled: !!data.preIrrigation?.enabled,
      preDuration: data.preIrrigation?.duration ?? "",
      preDistance: data.preIrrigation?.distance ?? "",
      postEnabled: !!data.postIrrigation?.enabled,
      postDuration: data.postIrrigation?.duration ?? "",
      postDistance: data.postIrrigation?.distance ?? "",
      setupMethod: data.setupMethod || data.method || "Puxando o carrinho (Padrão)",
      model: data.model || "-",
      irrigationMode: data.irrigationMode || "immediate",
      flowRate: data.flowRate ?? data.flow ?? "",
      hoseLength: data.hoseLength ?? "",
      workingWidth: data.workingWidth ?? data.width ?? "",
      minPressure: data.minPressure ?? data.pressure ?? "",
      nozzleDiameter: data.nozzleDiameter ?? "",
      zones: Array.isArray(data.zones)
        ? data.zones.slice(0, 4).map((z) => ({ start: z?.start ?? 0, end: z?.end ?? "", speed: z?.speed ?? "" }))
        : [],
      updatedAt: data.lastCommunication || equip.updatedAt || equip.createdAt || "",
    };
  }

  const ZONE_COLORS = ["#3b82f6", "#f97316", "#14b8a6", "#a16207"];

  function zoneIsValid(z) {
    const start = Number(z?.start);
    const end = Number(z?.end);
    const speed = Number(z?.speed);
    return Number.isFinite(start) && Number.isFinite(end) && end < start && Number.isFinite(speed) && speed > 0;
  }

  function renderZonesBar() {
    const bar = $("crtEditZonesBar");
    if (!bar) return;
    const zones = state.zonesDraft || [];
    const hoseLength = Number($("crtEditHoseLength")?.value) || 0;
    const totalRange = hoseLength > 0 ? hoseLength : 400;
    if (!zones.length) {
      bar.style.display = "none";
      bar.innerHTML = "";
      return;
    }
    bar.style.display = "block";

    const zonesHtml = zones.slice().reverse().map((z, reverseIndex) => {
      const i = zones.length - 1 - reverseIndex;
      const start = Number(z.start) || 0;
      const end = z.end === "" ? 0 : Number(z.end) || 0;
      const span = Math.max(start - end, 0);
      const speedNum = Number(z.speed);
      const speedLabel = z.speed !== "" && Number.isFinite(speedNum) ? `${speedNum.toFixed(1)} m/h` : "--";
      return `<div title="${t("Zona")} ${i + 1}: ${end}m ← ${start}m | ${speedLabel}" style="flex:${span > 0 ? span : 1} 0 0; min-width:0; height:100%; background:${ZONE_COLORS[i]}; border-right:2px solid #fff; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff; font-size:13px; line-height:1.25; font-weight:700; white-space:nowrap; overflow:hidden; padding:0 5px; box-sizing:border-box;">
        <span>${t("Zona")} ${i + 1}</span><span style="font-size:12px; font-weight:600; opacity:.95;">${end} m ← ${start} m | ${speedLabel}</span>
      </div>`;
    }).join("");

    bar.innerHTML = `
      <div style="display:grid; grid-template-columns:76px minmax(0,1fr) 76px; gap:10px; align-items:center;">
        <div style="display:flex; flex-direction:column; align-items:center; gap:5px; color:#0f172a; transform:translateY(8px);">
          <img class="create-equip__img" src="./assets/img/equipamentos/rainstar.png" alt="Carretel" style="width:54px; height:54px; object-fit:contain;" />
          <strong style="font-size:11px;">${t("Carretel")}</strong>
          <span style="font-size:10px; color:#64748b;">0 m</span>
        </div>
        <div style="min-width:0;">
          <div style="display:flex; position:relative; height:58px; border-top:4px solid #cbd5e1; border-bottom:4px solid #cbd5e1; background:repeating-linear-gradient(90deg, #f8fafc 0, #f8fafc 24px, #f1f5f9 24px, #f1f5f9 25px);">
            <div style="position:absolute; left:0; right:0; top:50%; height:2px; transform:translateY(-50%); background:#94a3b8;"></div>
            ${zonesHtml}
          </div>
        </div>
        <div style="display:flex; flex-direction:column; align-items:center; gap:5px; color:#0f172a; transform:translateY(6px);">
          <div aria-hidden="true" style="width:54px; height:54px;"></div>
          <strong style="font-size:11px;">Comprimento da mangueira</strong>
          <span style="font-size:10px; color:#64748b;">${totalRange} m</span>
        </div>
      </div>`;
  }

  function updateRowHint(i) {
    const zones = state.zonesDraft || [];
    const z = zones[i];
    if (!z) return;
    const hoseLength = Number($("crtEditHoseLength")?.value) || 0;
    const totalRange = hoseLength > 0 ? hoseLength : 400;
    const isLastZone = i === zones.length - 1;

    const startInput = document.querySelector(`[data-zone-field="start"][data-zone-index="${i}"]`);
    const startGroup = startInput?.closest(".sc-input-group");
    const startHint = $(`crtEditZoneStartHint-${i}`);
    let startMsg = "";
    let startHasError = false;

    if (z.start !== "") {
      const valStart = Number(z.start) || 0;
      if (valStart < 0) {
        startMsg = `${t("Mínimo de")} 0m`;
        startHasError = true;
      } else if (valStart > totalRange) {
        startMsg = `${t("Máximo de")} ${totalRange}m`;
        startHasError = true;
      }
    }

    if (startGroup) startGroup.style.borderColor = startHasError ? "#dc2626" : "";
    if (startHint) {
      startHint.style.display = startHasError ? "block" : "none";
      startHint.textContent = startMsg;
    }

    const start = Number(z.start) || totalRange;
    const endInput = document.querySelector(`[data-zone-field="end"][data-zone-index="${i}"]`);
    const hint = $(`crtEditZoneHint-${i}`);
    const endGroup = endInput?.closest(".sc-input-group");
    let msg = "";
    let hasError = false;

    if (z.end !== "") {
      const valEnd = Number(z.end) || 0;
      if (valEnd >= start) {
        msg = `${t("Deve terminar antes do início")}`;
        hasError = true;
      } else if (valEnd < 0 || (isLastZone && valEnd !== 0)) {
        msg = `${t("Deve terminar em 0")}`;
        hasError = true;
      }
    }

    if (endGroup) endGroup.style.borderColor = hasError ? "#dc2626" : "";
    if (hint) {
      hint.style.display = hasError ? "block" : "none";
      hint.textContent = msg;
    }
  }

  function updateCreateBtnState() {
    const createBtn = $("crtEditCreateZoneBtn");
    if (!createBtn) return;
    const zones = state.zonesDraft || [];
    // Sempre permitir criar ate 4 zonas
    const canCreate = zones.length < 4;
    createBtn.disabled = !canCreate;
    createBtn.classList.toggle("is-disabled", !canCreate);
  }

  function renderZonesRows() {
    const rows = $("crtEditZonesRows");
    if (!rows) return;
    const zones = state.zonesDraft || [];
    const hoseLength = Number($("crtEditHoseLength")?.value) || 0;

    if (!zones.length) {
      rows.innerHTML = `<div class="edit-panel__history-no-data" style="padding:32px; text-align:center; color:#94a3b8; font-size:13px; border:1px dashed #e2e8f0; border-radius:8px;">${t("Nenhuma zona de irrigação cadastrada.")}</div>`;
      return;
    }

    rows.innerHTML = zones
      .map((z, i) => {
        const startDisabled = i > 0;
        const prevEnd = i > 0 ? (Number(zones[i - 1]?.end) || 0) : 0;
        const startVal = startDisabled ? String(prevEnd) : (z.start ?? String(hoseLength || 400));
        return `
          <div style="display:grid; grid-template-columns:64px 1fr 1fr 1fr 32px; gap:12px; align-items:start; margin-bottom:12px;">
            <div class="pivo-edit__field" style="padding-top:6px;">
              <label style="visibility:hidden;">${t("Zona")}</label>
              <div style="font-size:13px; font-weight:600; color:#0f172a;">${t("Zona")} ${i + 1}</div>
            </div>
            <div class="pivo-edit__field">
              <label><span class="edit-panel__req">*</span> ${t("Início")} <span class="edit-panel__tooltip-icon" data-tooltip="Posição, em metros, onde a zona começa (medida a partir do carretel)."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group" id="crtEditStartGroup-${i}">
                <input class="equip-input sc-input" type="number" step="0.1" data-zone-field="start" data-zone-index="${i}" value="${startVal}" ${startDisabled ? "disabled" : ""} />
                <span class="sc-input-suffix">m</span>
              </div>
              <div id="crtEditZoneStartHint-${i}" style="display:none; font-size:11px; color:#dc2626; margin-top:4px;"></div>
            </div>
            <div class="pivo-edit__field">
              <label><span class="edit-panel__req">*</span> ${t("Fim")} <span class="edit-panel__tooltip-icon" data-tooltip="Posição, em metros, onde a zona termina (medida a partir do carretel). A última zona termina em 0."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" type="number" step="0.1" data-zone-field="end" data-zone-index="${i}" value="${z.end ?? ""}" />
                <span class="sc-input-suffix">m</span>
              </div>
              <div id="crtEditZoneHint-${i}" style="display:none; font-size:11px; color:#dc2626; margin-top:4px;"></div>
            </div>
            <div class="pivo-edit__field">
              <label><span class="edit-panel__req">*</span> ${t("Velocidade")} <span class="edit-panel__tooltip-icon" data-tooltip="Velocidade de recolhimento da mangueira nesta zona, em m/h. Quanto menor a velocidade, maior a lâmina aplicada."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group" id="crtEditSpeedGroup-${i}">
                <input class="equip-input sc-input" type="number" step="0.1" data-zone-field="speed" data-zone-index="${i}" value="${z.speed ?? ""}" />
                <span class="sc-input-suffix">m/h</span>
              </div>
              <div id="crtEditZoneSpeedHint-${i}" style="display:none; font-size:11px; color:#dc2626; margin-top:4px;">${t("Este campo é obrigatório")}</div>
            </div>
            <div class="pivo-edit__field" style="padding-top:6px;">
              <label style="visibility:hidden;">${t("Zona")}</label>
              <button type="button" title="${t("Remover")}" data-zone-remove="${i}" style="display:block; border:none; background:transparent; cursor:pointer; color:#dc2626; font-size:14px;"><i class="fa-regular fa-trash-can"></i></button>
            </div>
          </div>`;
      })
      .join("");

    zones.forEach((_, i) => updateRowHint(i));
  }

  function renderZonesUI() {
    renderZonesBar();
    renderZonesRows();
    updateCreateBtnState();
  }

  async function mountEditPanel(overlay) {
    if (!overlay) return false;
    try {
      const html = await fetch(`./pages/carretel-edit.html?v=${Date.now()}`).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); });
      overlay.innerHTML = `<div class="config-page">${html}</div>`;
      bindEditUI();
      return true;
    } catch (err) {
      console.error("[crtedit] Failed to load carretel-edit.html", err);
      return false;
    }
  }

  function setSelectValue(hiddenId, btnId, menuSelector, value) {
    const hidden = $(hiddenId);
    if (hidden) hidden.value = value;
    const menu = document.querySelector(menuSelector);
    if (menu) {
      menu.querySelectorAll(".edit-panel__select-option").forEach((opt) => {
        const isActive = opt.dataset.value === value;
        opt.classList.toggle("is-active", isActive);
        if (isActive) {
          const btn = $(btnId);
          if (btn) btn.textContent = opt.textContent;
        }
      });
    }
  }

  function renderCrtForm() {
    const equip = getFocusCrt();
    const d = normalizeCrtData(equip);
    if (!d) return;

    const selectBtn = $("crtEditSelectBtn");
    if (selectBtn) selectBtn.textContent = d.name || "—";

    const lastCommHtml = `<span class="comm-label">${t("Última comunicação:")}</span> ${formatLastComm(d.updatedAt)}`;
    document.querySelectorAll("#crtEditPanel .crt-last-comm-display").forEach((el) => { el.innerHTML = lastCommHtml; });

    const set = (id, val) => { const el = $(id); if (el) el.value = val ?? ""; };
    set("crtEditMachineAddress", d.machineAddress);
    set("crtEditName", d.name);
    set("crtEditFlowRate", d.flowRate);
    set("crtEditHoseLength", d.hoseLength);
    set("crtEditWorkingWidth", d.workingWidth);
    set("crtEditMinPressure", d.minPressure);
    set("crtEditNozzleDiameter", d.nozzleDiameter);

    const preEnabled = $("crtEditPreEnabled");
    if (preEnabled) preEnabled.checked = d.preEnabled;
    set("crtEditPreDuration", d.preDuration);
    set("crtEditPreDistance", d.preDistance);
    [$("crtEditPreDuration"), $("crtEditPreDistance")].forEach((el) => { if (el) { el.disabled = !d.preEnabled; el.classList.toggle("is-disabled", !d.preEnabled); } });

    const postEnabled = $("crtEditPostEnabled");
    if (postEnabled) postEnabled.checked = d.postEnabled;
    set("crtEditPostDuration", d.postDuration);
    set("crtEditPostDistance", d.postDistance);
    [$("crtEditPostDuration"), $("crtEditPostDistance")].forEach((el) => { if (el) { el.disabled = !d.postEnabled; el.classList.toggle("is-disabled", !d.postEnabled); } });

    setSelectValue("crtEditSetupMethod", "crtEditSetupMethodBtn", '[data-edit-menu="setupMethod"]', d.setupMethod);
    setSelectValue("crtEditModel", "crtEditModelBtn", '[data-edit-menu="model"]', d.model);

    // Irrigation Mode radio
    const irrModeGroup = $("crtEditIrrigationModeGroup");
    if (irrModeGroup) {
      const modeVal = d.irrigationMode || "immediate";
      irrModeGroup.querySelectorAll('input[type="radio"]').forEach((radio) => {
        radio.checked = radio.value === modeVal;
      });
    }

    state.zonesDraft = d.zones.map((z) => ({ ...z }));
    renderZonesUI();
  }

  function renderCrtSelectorList() {
    const menu = $("crtEditSelectMenu");
    if (!menu) return;

    const list = getCarreteisList();
    menu.innerHTML = "";
    list.forEach((c) => {
      const opt = document.createElement("button");
      opt.type = "button";
      opt.className = "edit-panel__select-option" + (String(c.id) === String(state.editFocusId) ? " is-active" : "");
      opt.dataset.value = String(c.id);
      opt.textContent = c.name || c.data?.name || String(c.id);
      opt.addEventListener("click", () => {
        state.editFocusId = c.id;
        document.querySelectorAll(".edit-panel__select-field").forEach((f) => f.classList.remove("is-open"));
        renderCrtSelectorList();
        renderCrtForm();
      });
      menu.appendChild(opt);
    });
  }

  function closeEditView() {
    edit._resizeObserver?.disconnect();
    edit._resizeObserver = null;
    const overlay = $("crtEditOverlay");
    if (overlay) {
      overlay.classList.remove("is-open");
      clearTimeout(edit._overlayRemoveTimer);
      edit._overlayRemoveTimer = setTimeout(() => {
        edit._overlayRemoveTimer = null;
        overlay.remove();
      }, 320);
    }
    // NÃO remove is-pivo-details — a tela de detalhes continua aberta por baixo
    editEventsBound = false;
    window.icMapSetWheelMode?.("free");
    const map = window.icMap;
    if (map && typeof map.invalidateSize === "function") {
      requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    }
  }

  function bindEditUI() {
    if (editEventsBound) return;
    editEventsBound = true;

    const backBtn = $("crtEditBack");
    if (backBtn && !backBtn.dataset.bound) {
      backBtn.dataset.bound = "1";
      backBtn.addEventListener("click", closeEditView);
    }

    const saveBtn = $("crtEditSaveBtn");
    if (saveBtn && !saveBtn.dataset.bound) {
      saveBtn.dataset.bound = "1";
      saveBtn.addEventListener("click", async () => {
        const payload = buildSavePayload();
        if (payload.error) { alert(t(payload.error)); return; }

        applySave(payload);

        const originalHtml = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${t("Salvando...")}`;

        let saved = false;
        try {
          saved = await persistCrtPayload(payload);
        } catch (err) {
          console.error("[crtedit] Falha ao gravar o carretel.", err);
        }

        if (!saved) {
          saveBtn.innerHTML = originalHtml;
          saveBtn.disabled = false;
          window.IcNotify?.error?.(t("Não foi possível salvar o carretel."), 3000);
          return;
        }

        if (window.IcToast) {
          window.IcToast.show(t("Carretel salvo com sucesso!"));
        } else {
          window.IcNotify?.success?.(t("Carretel salvo com sucesso!"), 2000);
        }
        saveBtn.innerHTML = `<i class="fa-solid fa-check"></i> ${t("Salvo!")}`;
        setTimeout(() => {
          saveBtn.innerHTML = originalHtml;
          saveBtn.disabled = false;
        }, 2000);

        // Atualiza a tela de detalhes que está por baixo do overlay
        if (typeof window.IcCarretel?.renderData === "function") {
          window.IcCarretel.renderData();
        }
      });
    }

    const panel = $("crtEditPanel");
    if (panel) {
      panel.addEventListener("click", (e) => {
        const tab = e.target.closest(".edit-panel__tab");
        if (tab) {
          const key = tab.dataset.tab;
          panel.querySelectorAll(".edit-panel__tab").forEach((tb) => {
            tb.classList.toggle("is-active", tb.dataset.tab === key);
            tb.setAttribute("aria-selected", String(tb.dataset.tab === key));
          });
          panel.querySelectorAll(".edit-panel__tab-body").forEach((b) => {
            b.classList.toggle("is-active", b.dataset.tabBody === key);
          });
          const saveButton = $("crtEditSaveBtn");
          if (saveButton) { saveButton.hidden = key !== "config"; saveButton.style.display = key === "config" ? "" : "none"; }
          const activeTabBody = panel.querySelector(`.edit-panel__tab-body[data-tab-body="${key}"]`);
          if (activeTabBody) {
            const firstNavItem = activeTabBody.querySelector(".edit-panel__nav-item");
            if (firstNavItem) {
              activeTabBody.querySelectorAll(".edit-panel__nav-item").forEach((n) => n.classList.remove("is-active"));
              firstNavItem.classList.add("is-active");
              activeTabBody.querySelectorAll(".edit-panel__section").forEach((s) => s.classList.remove("is-active"));
              const target = firstNavItem.dataset.target;
              if (target) activeTabBody.querySelector(target)?.classList.add("is-active");
            }
          }
          return;
        }

        const navItem = e.target.closest(".edit-panel__nav-item");
        if (navItem) {
          const target = navItem.dataset.target;
          panel.querySelectorAll(".edit-panel__nav-item").forEach((n) => n.classList.remove("is-active"));
          navItem.classList.add("is-active");
          panel.querySelectorAll(".edit-panel__section").forEach((s) => s.classList.remove("is-active"));
          panel.querySelector(target)?.classList.add("is-active");
          return;
        }

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

        const selectBtn = e.target.closest("[data-edit-select]");
        if (selectBtn) {
          const field = selectBtn.closest(".edit-panel__select-field");
          const wasOpen = field?.classList.contains("is-open");
          panel.querySelectorAll(".edit-panel__select-field.is-open").forEach((f) => f.classList.remove("is-open"));
          if (field && !wasOpen) field.classList.add("is-open");
          return;
        }

        const selectOpt = e.target.closest("[data-edit-menu] .edit-panel__select-option");
        if (selectOpt) {
          const menu = selectOpt.closest("[data-edit-menu]");
          const menuKey = menu?.dataset.editMenu;
          const val = selectOpt.dataset.value;
          const field = selectOpt.closest(".edit-panel__select-field");

          menu?.querySelectorAll(".edit-panel__select-option").forEach((o) => o.classList.remove("is-active"));
          selectOpt.classList.add("is-active");
          const triggerBtn = field?.querySelector("[data-edit-select]");
          if (triggerBtn) triggerBtn.textContent = selectOpt.textContent;
          field?.classList.remove("is-open");

          if (menuKey === "setupMethod") { const hidden = $("crtEditSetupMethod"); if (hidden) hidden.value = val; }
          if (menuKey === "model") { const hidden = $("crtEditModel"); if (hidden) hidden.value = val; }
          return;
        }

        const selectorTrigger = e.target.closest("#crtEditSelectBtn");
        if (selectorTrigger) {
          const field = selectorTrigger.closest(".edit-panel__select-field");
          field?.classList.toggle("is-open");
          return;
        }

        // Irrigation Mode radio
        const irrModeRadio = e.target.closest('#crtEditIrrigationModeGroup input[type="radio"]');
        if (irrModeRadio) {
          // Radio já troca sozinho, não precisa fazer nada extra
          return;
        }

        const createZoneBtn = e.target.closest("#crtEditCreateZoneBtn");
        if (createZoneBtn) {
          if (createZoneBtn.disabled) return;
          const zones = state.zonesDraft || (state.zonesDraft = []);
          if (zones.length >= 4) return;
          if (zones.length === 0) {
            zones.push({ start: "400", end: "", speed: "" });
          } else {
            const prevEnd = Number(zones[zones.length - 1].end) || 0;
            zones.push({ start: String(prevEnd), end: "", speed: "" });
          }
          renderZonesUI();
          return;
        }

        const removeZoneBtn = e.target.closest("[data-zone-remove]");
        if (removeZoneBtn) {
          const idx = Number(removeZoneBtn.dataset.zoneRemove);
          if (Number.isFinite(idx) && Array.isArray(state.zonesDraft)) {
            state.zonesDraft = state.zonesDraft.slice(0, idx);
            renderZonesUI();
          }
          return;
        }
      });

      panel.addEventListener("input", (e) => {
        if (e.target.id === "crtEditHoseLength") {
          renderZonesBar();
          (state.zonesDraft || []).forEach((_, i) => updateRowHint(i));
          return;
        }
        const field = e.target.closest("[data-zone-field]");
        if (!field) return;
        const idx = Number(field.dataset.zoneIndex);
        const key = field.dataset.zoneField;
        const zones = state.zonesDraft;
        if (!Array.isArray(zones) || !zones[idx]) return;

        zones[idx][key] = field.value;

        if (key === "end" && zones[idx + 1]) {
          zones[idx + 1].start = field.value === "" ? 0 : (Number(field.value) || 0);
          const nextStartInput = document.querySelector(`[data-zone-field="start"][data-zone-index="${idx + 1}"]`);
          if (nextStartInput) nextStartInput.value = zones[idx + 1].start;
          updateRowHint(idx + 1);
        }
        if (key === "start" || key === "end") {
          updateRowHint(idx);
          renderZonesBar();
        }
        if (key === "speed") {
          // Limpa erro do speed ao digitar
          const speedGroup = field.closest(".sc-input-group");
          const speedHint = $(`crtEditZoneSpeedHint-${idx}`);
          if (speedGroup) speedGroup.style.borderColor = "";
          if (speedHint) speedHint.style.display = "none";
          renderZonesBar();
        }
        updateCreateBtnState();
      });

      panel.addEventListener("focusout", (e) => {
        const field = e.target.closest("[data-zone-field]");
        if (!field) return;
        const idx = Number(field.dataset.zoneIndex);
        const key = field.dataset.zoneField;
        const zones = state.zonesDraft;

        // Valida Speed no blur se estiver vazio
        if (key === "speed" && zones[idx] && field.value.trim() === "") {
          const speedGroup = field.closest(".sc-input-group");
          const speedHint = $(`crtEditZoneSpeedHint-${idx}`);
          if (speedGroup) speedGroup.style.borderColor = "#dc2626";
          if (speedHint) speedHint.style.display = "block";
        }

        if (key !== "end") return;
        const hoseLength = Number($("crtEditHoseLength")?.value) || 0;
        const maxRange = hoseLength > 0 ? hoseLength : 400;
        let val = Number(field.value) || 0;
        if (val > maxRange) {
          field.value = maxRange;
          field.dispatchEvent(new Event("input", { bubbles: true }));
        }
      });

      document.addEventListener("click", (e) => {
        if (!e.target.closest(".edit-panel__select-field")) {
          panel.querySelectorAll(".edit-panel__select-field.is-open").forEach((f) => f.classList.remove("is-open"));
        }
      });
    }

    document.querySelectorAll("#crtEditPanel .edit-panel__input-actions button[aria-label='Limpar campo']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const input = btn.closest(".edit-panel__input-wrap")?.querySelector("input:not([readonly])");
        if (input) input.value = "";
      });
    });

    document.querySelectorAll("#crtEditPanel .farm-radio-clear").forEach((btn) => {
      btn.addEventListener("click", () => {
        const input = btn.closest(".sc-input-group")?.querySelector("input");
        if (input) input.value = "";
      });
    });

    [["crtEditPreEnabled", ["crtEditPreDuration", "crtEditPreDistance"]], ["crtEditPostEnabled", ["crtEditPostDuration", "crtEditPostDistance"]]].forEach(([toggleId, inputIds]) => {
      const toggle = $(toggleId);
      if (!toggle) return;
      toggle.addEventListener("change", () => {
        const enabled = toggle.checked;
        inputIds.forEach((id) => {
          const input = $(id);
          if (!input) return;
          input.disabled = !enabled;
          input.classList.toggle("is-disabled", !enabled);
          if (!enabled) input.value = "";
        });
      });
    });
  }

  function buildSavePayload() {
    const name = $("crtEditName")?.value?.trim();
    if (!name) return { error: "Informe o nome do carretel." };

    const equip = getFocusCrt();
    const farm = getActiveFarmSafe();
    return {
      id: state.editFocusId || equip?.id,
      farmId: farm?.id || "",
      name,
      machineAddress: $("crtEditMachineAddress")?.value?.trim() || "",
      setupMethod: $("crtEditSetupMethod")?.value || "Puxando o carrinho (Padrão)",
      model: $("crtEditModel")?.value || "-",
      irrigationMode: document.querySelector('#crtEditIrrigationModeGroup input[type="radio"]:checked')?.value || "immediate",
      flowRate: window.IcNumeric.readNumber("crtEditFlowRate", ""),
      hoseLength: window.IcNumeric.readNumber("crtEditHoseLength", ""),
      workingWidth: window.IcNumeric.readNumber("crtEditWorkingWidth", ""),
      minPressure: window.IcNumeric.readNumber("crtEditMinPressure", ""),
      nozzleDiameter: window.IcNumeric.readNumber("crtEditNozzleDiameter", ""),
      preIrrigation: {
        enabled: $("crtEditPreEnabled")?.checked ?? false,
        duration: window.IcNumeric.readNumber("crtEditPreDuration", 0),
        distance: window.IcNumeric.readNumber("crtEditPreDistance", 0),
      },
      postIrrigation: {
        enabled: $("crtEditPostEnabled")?.checked ?? false,
        duration: window.IcNumeric.readNumber("crtEditPostDuration", 0),
        distance: window.IcNumeric.readNumber("crtEditPostDistance", 0),
      },
      zones: (state.zonesDraft || [])
        .filter(zoneIsValid)
        .map((z) => ({ start: Number(z.start) || 0, end: Number(z.end) || 0, speed: Number(z.speed) || 0 })),
    };
  }

  function applySave(payload) {
    const farm = getActiveFarmSafe();
    const equip = (Array.isArray(farm?.equipments) ? farm.equipments : []).find((e) => String(e.id) === String(payload.id));
    if (!equip) return;
    equip.name = payload.name;
    equip.data = {
      ...(equip.data || {}),
      name: payload.name,
      machineAddress: payload.machineAddress, imei: payload.machineAddress,
      setupMethod: payload.setupMethod, method: payload.setupMethod,
      model: payload.model,
      irrigationMode: payload.irrigationMode,
      flowRate: payload.flowRate, flow: payload.flowRate,
      hoseLength: payload.hoseLength,
      workingWidth: payload.workingWidth, width: payload.workingWidth,
      minPressure: payload.minPressure, pressure: payload.minPressure,
      nozzleDiameter: payload.nozzleDiameter,
      preIrrigation: payload.preIrrigation,
      postIrrigation: payload.postIrrigation,
      zones: payload.zones,
    };
    if (window.IcMapRenderPivots && farm) setTimeout(() => window.IcMapRenderPivots(farm), 0);
    if (window.IcCarretel?.renderData) setTimeout(() => window.IcCarretel.renderData(), 0);
  }

  async function persistCrtPayload(payload) {
    if (!payload?.farmId || !payload?.id) return false;
    if (typeof window.Cad?.data?.getAllFarms !== "function" || typeof window.Cad?.data?.persistFarmDataset !== "function") return false;

    const farms = window.Cad.data.getAllFarms();
    const farmIndex = farms.findIndex((f) => String(f?.id || "") === String(payload.farmId || ""));
    if (farmIndex < 0) return false;

    const targetFarm = { ...farms[farmIndex] };
    const equipments = (Array.isArray(targetFarm?.equipments) ? targetFarm.equipments : []).map((item) => ({
      ...item, data: item?.data && typeof item.data === "object" ? { ...item.data } : {},
    }));
    const equipIndex = equipments.findIndex((item) => String(item?.id || "") === String(payload.id || ""));
    if (equipIndex < 0) return false;

    equipments[equipIndex] = {
      ...equipments[equipIndex],
      name: payload.name,
      data: {
        ...equipments[equipIndex].data,
        name: payload.name,
        machineAddress: payload.machineAddress, imei: payload.machineAddress,
        setupMethod: payload.setupMethod, method: payload.setupMethod,
        model: payload.model,
        irrigationMode: payload.irrigationMode,
        flowRate: payload.flowRate, flow: payload.flowRate,
        hoseLength: payload.hoseLength,
        workingWidth: payload.workingWidth, width: payload.workingWidth,
        minPressure: payload.minPressure, pressure: payload.minPressure,
        nozzleDiameter: payload.nozzleDiameter,
        preIrrigation: payload.preIrrigation,
        postIrrigation: payload.postIrrigation,
        zones: payload.zones,
      },
    };
    targetFarm.equipments = equipments;
    farms[farmIndex] = targetFarm;
    await window.Cad.data.persistFarmDataset(farms);
    window.CreateFarm?.setters?.setFarms?.(farms);
    return true;
  }

  async function open(options = {}) {
    const carretelId = options.carretelId ?? options.equipmentId ?? null;
    if (carretelId) state.editFocusId = carretelId;

    // Cancela uma remoção ainda pendente da última vez que o painel foi fechado
    if (edit._overlayRemoveTimer) {
      clearTimeout(edit._overlayRemoveTimer);
      edit._overlayRemoveTimer = null;
    }

    document.body.classList.remove("is-pivo-details-only");
    document.body.classList.add("is-pivo-details");
    window.icMapSetWheelMode?.("ctrl");
    editEventsBound = false;

    // Cria (ou reutiliza) o overlay que desliza da direita, igual ao padrão config/faturamento
    let overlay = $("crtEditOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "crtEditOverlay";
      overlay.className = "config-overlay";
      overlay.style.zIndex = 1200 + document.querySelectorAll(".config-overlay").length;
      document.body.appendChild(overlay);
    }
    const positionOverlay = window.IcOverlay?.positionOverlay;
    if (positionOverlay) positionOverlay(overlay);

    // Reposiciona se a sidebar colapsar/expandir
    edit._resizeObserver?.disconnect();
    const mainEl = document.querySelector(".main");
    if (mainEl && typeof ResizeObserver === "function") {
      edit._resizeObserver = new ResizeObserver(() => {
        if (positionOverlay) positionOverlay(overlay);
      });
      edit._resizeObserver.observe(mainEl);
    }

    const mounted = await mountEditPanel(overlay);
    if (!mounted) {
      edit._resizeObserver?.disconnect();
      edit._resizeObserver = null;
      overlay.remove();
      document.body.classList.remove("is-pivo-details");
      window.icMapSetWheelMode?.("free");
      return;
    }

    try {
      renderCrtSelectorList();
    } catch (err) {
      console.error("[crtedit] Falha ao montar a lista de carreteis da edição.", err);
    }
    try {
      renderCrtForm();
    } catch (err) {
      console.error("[crtedit] Falha ao preencher o formulário de edição do carretel.", err);
    }

    // Anima a entrada (slide da direita)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => overlay.classList.add("is-open"));
    });
  }

  window.IcCarretelEdit = { open, close: closeEditView };
})();
