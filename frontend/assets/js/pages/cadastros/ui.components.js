(function () {
  "use strict";
  const Cad = (window.Cad = window.Cad || {});
  let uiDismissHandlersBound = false;

  function decodeLikelyMojibake(value) { return Cad.encoding.decodeLikelyMojibake(value); }

  function bindGlobalUiDismissHandlers() {
    if (uiDismissHandlersBound) return;
    uiDismissHandlersBound = true;

    document.addEventListener("click", (e) => {
      document.querySelectorAll(".cad-csel.is-open").forEach((wrapper) => {
        if (!wrapper.contains(e.target)) wrapper.classList.remove("is-open");
      });

      document.querySelectorAll('[data-cad-multiselect-host] .farm-report__dropdown.is-open').forEach((dropdown) => {
        const host = dropdown.closest("[data-cad-multiselect-host]");
        if (!host || !host.contains(e.target)) {
          dropdown.classList.remove("is-open");
          dropdown.setAttribute("aria-hidden", "true");
        }
      });
    });
  }

  function escapeAttr(value) {
    return decodeLikelyMojibake(String(value ?? ""))
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getEquipmentTypeLabel(type) {
    const found = Cad.EQUIP_TYPE_OPTIONS.find((item) => item.value === String(type || ""));
    return found ? found.label : "Equipamento";
  }

  function parseLatLngText(value) {
    const text = String(value || "").trim();
    if (!text) return null;
    const parts = text
      .replaceAll(";", ",")
      .split(",")
      .map((item) => Number(item.trim()));
    if (parts.length < 2) return null;
    const lat = parts[0];
    const lng = parts[1];
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }

  function initCustomSelect(selectEl) {
    if (!selectEl || selectEl._cadCselInit) return;
    bindGlobalUiDismissHandlers();
    selectEl._cadCselInit = true;
    selectEl.style.display = "none";

    const wrapper = document.createElement("div");
    wrapper.className = "cad-csel";
    // copy width/class context from original
    if (selectEl.classList.contains("col-span-2")) wrapper.classList.add("col-span-2");

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "cad-csel__trigger equip-input";

    const labelSpan = document.createElement("span");
    labelSpan.className = "cad-csel__label";

    const arrowEl = document.createElement("i");
    arrowEl.className = "fa-solid fa-chevron-down cad-csel__arrow";

    trigger.appendChild(labelSpan);
    trigger.appendChild(arrowEl);

    const list = document.createElement("div");
    list.className = "cad-csel__list";

    const syncLabel = () => {
      const sel = selectEl.options[selectEl.selectedIndex];
      const isPlaceholder = !sel || sel.value === "";
      labelSpan.textContent = sel ? sel.textContent : "";
      labelSpan.classList.toggle("cad-csel__label--placeholder", isPlaceholder);
    };

    const buildList = () => {
      list.innerHTML = "";
      const selectedVal = selectEl.value;
      Array.from(selectEl.options).forEach((opt) => {
        if (opt.disabled || opt.value === "") return;
        const item = document.createElement("div");
        item.className = "cad-csel__item";
        if (opt.value === selectedVal) item.classList.add("is-selected");
        item.textContent = opt.textContent;
        item.addEventListener("mousedown", (e) => {
          e.preventDefault();
          selectEl.value = opt.value;
          selectEl.dispatchEvent(new Event("change", { bubbles: true }));
          syncLabel();
          buildList();
          wrapper.classList.remove("is-open");
        });
        list.appendChild(item);
      });
    };

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = wrapper.classList.contains("is-open");
      document.querySelectorAll(".cad-csel.is-open").forEach((el) => el.classList.remove("is-open"));
      if (!isOpen) { buildList(); wrapper.classList.add("is-open"); }
    });

    // Keep label in sync when native select value changes programmatically
    selectEl.addEventListener("change", syncLabel);

    // Rebuild list when options are updated dynamically (e.g. bindVinculos)
    new MutationObserver(() => {
      syncLabel();
      buildList();
    }).observe(selectEl, { childList: true, subtree: true });

    syncLabel();
    wrapper.appendChild(trigger);
    wrapper.appendChild(list);
    selectEl.parentNode.insertBefore(wrapper, selectEl);
  }

  function initCadCustomSelects(container) {
    (container || document).querySelectorAll("select.equip-input").forEach((sel) => {
      if (sel.disabled || sel.options.length === 0) return;
      initCustomSelect(sel);
    });
  }

  // --- Generic Multi-Select Init ---
  const initMultiSelect = (config, container = document) => {
    const host = container.querySelector(config.hostId);
    if (!host) return;
    bindGlobalUiDismissHandlers();
    host.setAttribute("data-cad-multiselect-host", "");

    const chipsHost = host.querySelector(config.chipsSelector);
    const searchInput = host.querySelector(config.searchSelector);
    const dropdown = host.querySelector(config.dropdownSelector);
    const listHost = host.querySelector(config.listSelector);
    const hiddenInput = document.getElementById(config.hiddenInputId) || container.querySelector(`#${config.hiddenInputId}`);

    const syncHidden = () => {
      const chips = Array.from(chipsHost?.querySelectorAll(`.farm-report__chip[${config.attrId}]`) || []);
      const ids = chips.map(c => c.getAttribute(config.attrId));
      if (hiddenInput) hiddenInput.value = JSON.stringify(ids);
      if (searchInput) {
        searchInput.placeholder = ids.length ? `${ids.length} ${config.unitLabel}(s) selecionado(s)` : `Selecionar ${config.unitLabel}s`;
      }
    };

    const openDropdown = () => {
      dropdown?.classList.add("is-open");
      dropdown?.setAttribute("aria-hidden", "false");
    };
    const closeDropdown = () => {
      dropdown?.classList.remove("is-open");
      dropdown?.setAttribute("aria-hidden", "true");
    };

    host.querySelector(config.controlSelector)?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (dropdown?.classList.contains("is-open")) closeDropdown(); else openDropdown();
    });

    const addChip = (id, name) => {
      if (!chipsHost || chipsHost.querySelector(`[${config.attrId}="${id}"]`)) return;
      const chip = document.createElement("span");
      chip.className = "farm-report__chip";
      chip.setAttribute(config.attrId, id);
      chip.dataset.label = name;
      chip.innerHTML = `${name}<button type="button">✕</button>`;
      chip.querySelector("button").onclick = (e) => {
        e.stopPropagation();
        chip.remove();
        listHost?.querySelector(`[${config.attrId}="${id}"]`)?.classList.remove("is-selected");
        syncHidden();
      };
      chipsHost.appendChild(chip);
      syncHidden();
    };

    listHost?.querySelectorAll(config.itemSelector).forEach(item => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = item.getAttribute(config.attrId);
        const name = item.textContent.replace(/[\u2713✓"]/g, "").trim();
        const isSelected = item.classList.toggle("is-selected");
        if (isSelected) addChip(id, name);
        else {
          chipsHost?.querySelector(`[${config.attrId}="${id}"]`)?.remove();
          syncHidden();
        }
      });
    });

    chipsHost?.querySelectorAll(".farm-report__chip").forEach(chip => {
      const id = chip.getAttribute(config.attrId);
      if (id) {
        chip.querySelector("button").onclick = (e) => {
          e.stopPropagation();
          chip.remove();
          listHost?.querySelector(`[${config.attrId}="${id}"]`)?.classList.remove("is-selected");
          syncHidden();
        };
      }
    });

    syncHidden();
  };

  Cad.ui = {
    initCustomSelect,
    initCadCustomSelects,
    initMultiSelect,
    escapeAttr,
    parseLatLngText,
    getEquipmentTypeLabel
  };

})();
