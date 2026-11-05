(function () {
  "use strict";
  const Cad = (window.Cad = window.Cad || {});

  function ensureMapActionsContainer(mapCard) {
    if (!mapCard) return null;
    let mapColumn = mapCard.closest(".cadastros-map-column");
    if (!mapColumn) {
      const parent = mapCard.parentElement;
      if (!parent) return null;
      mapColumn = document.createElement("div");
      mapColumn.className = "cadastros-map-column";
      parent.insertBefore(mapColumn, mapCard);
      mapColumn.appendChild(mapCard);
    }

    let actions = mapColumn.querySelector(":scope > .cadastros-map-actions.cadastros-map-actions--external");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "cadastros-map-actions cadastros-map-actions--external";
      mapColumn.appendChild(actions);
    }
    return actions;
  }

  function ensureFarmMapActionButton() {
    return document.getElementById("farmPickLocationBtn");
  }

  function normalizeMapActionsPlacement() {
    const sections = document.querySelectorAll("#cadastrosPanel .cad-section");
    const mapOverlaySections = new Set(["section-talhoes", "section-sistemas-irrigacao"]);
    sections.forEach((section) => {
      const isFormView = section.classList.contains("is-form-view");
      const hasOverlay = mapOverlaySections.has(section.id);
      const show = hasOverlay && isFormView;

      const overlay = section.querySelector(".cq-right .cq-map-actions");
      if (overlay) overlay.style.display = show ? "flex" : "none";
    });
  }

  function syncSectionToolbar(toolbarRoot, view) {
    if (!toolbarRoot) return;
    const addBtn = toolbarRoot.querySelector('.cadastros-toolbar__add');
    const formActions = toolbarRoot.querySelector('.cadastros-toolbar__form-actions');
    if (addBtn) addBtn.style.display = view === 'form' ? 'none' : '';
    if (formActions) formActions.style.display = view === 'form' ? 'flex' : 'none';
  }

  function getSectionCreateLabel(type) {
    const labels = {
      "fazendas": "Fazenda",
      "talhoes": "Talhão",
      "sistemas-irrigacao": "Pivô",
      "parcelas": "Parcela",
      "equipamentos": "Equipamento",
      "energia": "Energia",
      "feriados": "Feriado",
      "usuarios": "Usuário",
      "faturas": "Fatura de Energia"
    };
    return labels[type] || "Item";
  }

  function renderMenuActions(section, view) {
    const menuHost = document.getElementById("cadastrosMenuActions");
    if (!section) return;

    const type = section.id.replace("section-", "");
    const toolbarActions = section.querySelector(".cad-table-toolbar__actions");

    if (menuHost) menuHost.innerHTML = "";
    if (toolbarActions) toolbarActions.innerHTML = "";

    if (type === "usuarios") {
      section.querySelectorAll(".cad-toolbar-add-btn").forEach((btn) => btn.remove());
      if (view !== "form") {
        const addUserBtn = document.createElement("button");
        addUserBtn.type = "button";
        addUserBtn.className = "btn-add-user";
        addUserBtn.innerHTML = '<i class="fa-solid fa-circle-plus"></i> Adicionar usuário';
        if (toolbarActions) {
          toolbarActions.appendChild(addUserBtn);
        } else if (menuHost) {
          menuHost.appendChild(addUserBtn);
        }
      }
      return;
    }

    const baseStyle = "height:32px;padding:0 12px;font-size:13px;font-weight:500;border-radius:6px;display:inline-flex;align-items:center;gap:6px;cursor:pointer;";

    if (view === "form") {
      if (type === "fazendas" || type === "talhoes" || type === "sistemas-irrigacao" || type === "equipamentos") {
        // Fazenda, Talhões e Sistemas (Pivô) usam ações no rodapé do próprio card.
        return;
      }

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.style.cssText = baseStyle + "background:#ffffff;color:#475569;border:1px solid #e2e8f0;";
      cancelBtn.innerHTML = '<i class="fa-solid fa-xmark"></i> Cancelar';
      cancelBtn.onclick = () => window.IcCancelCurrent(type);

      const saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.style.cssText = baseStyle + "background:#16a34a;color:#ffffff;border:1px solid #16a34a;";
      saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar';
      saveBtn.onclick = () => window.IcSaveRecord(type);

      if (menuHost) {
        menuHost.appendChild(cancelBtn);
        menuHost.appendChild(saveBtn);
      }
    } else {
      const uploadShpBtn = document.createElement("button");
      uploadShpBtn.type = "button";
      uploadShpBtn.className = "talhoes__icon-btn";
      uploadShpBtn.setAttribute("aria-label", "Upload de shapefile");
      uploadShpBtn.title = "Upload de shapefile";
      uploadShpBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i>';

      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "cad-toolbar-add-btn";
      addBtn.innerHTML = `<i class="fa-solid fa-plus"></i> Criar ${getSectionCreateLabel(type)}`;
      addBtn.onclick = () => window.IcToggleView(type, "form");

      if (type === "feriados") {
        return;
      }

      if (toolbarActions) {
        if (type === "talhoes") toolbarActions.appendChild(uploadShpBtn);
        toolbarActions.appendChild(addBtn);
      } else if (menuHost) {
        if (type === "talhoes") menuHost.appendChild(uploadShpBtn);
        addBtn.style.cssText = baseStyle + "background:#16a34a;color:#ffffff;border:1px solid #16a34a;";
        menuHost.appendChild(addBtn);
      }
    }
  }

  function initTableSortFilter(tableEl, filterColIdx = -1, onFilter = null) {
    if (!tableEl) return;

    const wrapper = tableEl.closest(".table-responsive");
    if (!wrapper) return;

    // ── Dropdown filter: only when filterColIdx >= 0, rebuild on every call ──
    if (filterColIdx >= 0) {
      const dataRows = Array.from(tableEl.tBodies[0]?.rows || []).filter((r) => r.cells.length > 1);
      const uniqueVals = [...new Set(
        dataRows.map((r) => (r.cells[filterColIdx]?.textContent || "").trim()).filter(Boolean)
      )].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));

      let filterWrap = wrapper.querySelector(".cad-table-filter-wrap");
      if (!filterWrap) {
        filterWrap = document.createElement("div");
        filterWrap.className = "cad-table-filter-wrap";
        wrapper.insertBefore(filterWrap, tableEl);
      }

      const prevVal = filterWrap.dataset.filterValue || "";
      filterWrap.innerHTML = "";

      if (uniqueVals.length > 1) {
        const currentDisplay = prevVal || "Todos";
        filterWrap.innerHTML = `
          <div class="cad-filter-bar">
            <span class="cad-filter-bar__icon"><i class="fa-solid fa-filter"></i></span>
            <span class="cad-filter-bar__label">Filtrar por tipo</span>
            <div class="cad-filter-bar__select-wrap">
              <div class="cad-custom-select" tabindex="0">
                <div class="cad-custom-select__label">
                  <span>${currentDisplay}</span>
                  <i class="fa-solid fa-chevron-down"></i>
                </div>
                <div class="cad-custom-select__options">
                  <div class="cad-custom-select__opt ${!prevVal ? "selected" : ""}" data-value="">Todos</div>
                  ${uniqueVals.map((v) => `<div class="cad-custom-select__opt ${v === prevVal ? "selected" : ""}" data-value="${v}">${v}</div>`).join("")}
                </div>
              </div>
              <span class="cad-filter-bar__count"></span>
            </div>
          </div>`;

        const customSelect = filterWrap.querySelector(".cad-custom-select");
        const countEl = filterWrap.querySelector(".cad-filter-bar__count");

        const applyFilter = (val) => {
          filterWrap.dataset.filterValue = val;
          const q = val.toLowerCase();
          let visible = 0;
          Array.from(tableEl.tBodies[0]?.rows || []).forEach((row) => {
            if (!q) { row.style.display = ""; visible++; return; }
            const cellVal = (row.cells[filterColIdx]?.textContent || "").trim().toLowerCase();
            const show = cellVal.includes(q);
            row.style.display = show ? "" : "none";
            if (show) visible++;
          });
          if (countEl) {
            const total = Array.from(tableEl.tBodies[0]?.rows || []).filter(r => r.cells.length > 1).length;
            countEl.textContent = val ? `${visible} de ${total}` : `${total} itens`;
            countEl.style.display = "";
          }
          if (typeof onFilter === "function") onFilter(val);
        };

        // Custom Select Events
        customSelect.onclick = (e) => {
          e.stopPropagation();
          customSelect.classList.toggle("is-open");
        };

        customSelect.onblur = () => {
          setTimeout(() => customSelect.classList.remove("is-open"), 150);
        };

        customSelect.querySelectorAll(".cad-custom-select__opt").forEach(opt => {
          opt.onclick = (e) => {
            e.stopPropagation();
            const val = opt.dataset.value;
            customSelect.querySelector(".cad-custom-select__label span").textContent = val || "Todos";
            customSelect.querySelectorAll(".cad-custom-select__opt").forEach(o => o.classList.remove("selected"));
            opt.classList.add("selected");
            customSelect.classList.remove("is-open");
            applyFilter(val);
          };
        });

        applyFilter(prevVal);
      } else if (uniqueVals.length === 1) {
        // Single type: show count only, no filter
        const total = Array.from(tableEl.tBodies[0]?.rows || []).filter(r => r.cells.length > 1).length;
        filterWrap.innerHTML = `<div class="cad-filter-bar"><span class="cad-filter-bar__count">${total} <span>${total !== 1 ? "itens" : "item"}</span></span></div>`;
      }
    }

    // ── Sort headers (bind once per th) ──
    const sortState = tableEl._cadSortState || (tableEl._cadSortState = { col: -1, dir: 1 });
    const headers = Array.from(tableEl.tHead?.rows[0]?.cells || []);
    headers.forEach((th, colIdx) => {
      if (th.dataset.sortBound) return;
      const label = th.textContent.trim();
      if (label === "Ações" || label === "") return;
      th.dataset.sortBound = "1";
      th.classList.add("cad-th-sortable");
      th.innerHTML = `<span class="cad-th-label">${label}</span><span class="cad-th-sort-icon"><i class="fa-solid fa-sort"></i></span>`;
      th.addEventListener("click", () => {
        const dir = sortState.col === colIdx ? -sortState.dir : 1;
        sortState.col = colIdx;
        sortState.dir = dir;
        headers.forEach((h) => { const i = h.querySelector(".cad-th-sort-icon i"); if (i) i.className = "fa-solid fa-sort"; });
        const ico = th.querySelector(".cad-th-sort-icon i");
        if (ico) ico.className = dir === 1 ? "fa-solid fa-sort-up" : "fa-solid fa-sort-down";
        const tbody = tableEl.tBodies[0];
        if (!tbody) return;
        const tryNum = (s) => {
          const stripped = s.replace(/\s+/g, "").replace(",", ".");
          if (!/^-?\d+(\.\d+)?$/.test(stripped)) return null;
          const n = Number(stripped);
          return Number.isFinite(n) ? n : null;
        };
        Array.from(tbody.rows)
          .sort((a, b) => {
            const va = (a.cells[colIdx]?.textContent || "").trim().toLowerCase();
            const vb = (b.cells[colIdx]?.textContent || "").trim().toLowerCase();
            const na = tryNum(va); const nb = tryNum(vb);
            if (na !== null && nb !== null) return (na - nb) * dir;
            return va < vb ? -dir : va > vb ? dir : 0;
          })
          .forEach((row) => tbody.appendChild(row));
      });
    });
  }

  // Bind to window resize to prevent white map on screen change
  window.addEventListener("resize", () => {
    clearTimeout(window._cadastrosResizeTimer);
    window._cadastrosResizeTimer = setTimeout(() => {
      if (Cad.maps && typeof Cad.maps === "object") {
        Cad.viewMaps && typeof Cad.viewMaps.invalidateVisibleCadastrosMaps === "function"
          ? Cad.viewMaps.invalidateVisibleCadastrosMaps()
          : null;
      }
    }, 100);
  });

  Cad.toolbar = {
    renderMenuActions,
    syncSectionToolbar,
    initTableSortFilter,
    normalizeMapActionsPlacement,
    ensureMapActionsContainer,
    ensureFarmMapActionButton,
    getSectionCreateLabel
  };

})();
