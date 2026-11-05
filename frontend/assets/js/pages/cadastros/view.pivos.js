(function () {
  "use strict";
  const Cad = (window.Cad = window.Cad || {});

  const renderPivosSectionMap = (...args) => Cad.pivosHelpers?.renderPivosSectionMap?.(...args);
  const setEmptyPivosColspan = (...args) => Cad.pivosHelpers?.setEmptyPivosColspan?.(...args);
  const initTableSortFilter = (...args) => Cad.toolbar.initTableSortFilter(...args);

  function renderPivos() {
    const tbody = document.querySelector("#section-sistemas-irrigacao tbody");
    if (!tbody) return;

    const pivos = Cad.data.getAllPivosRecords().sort((a, b) =>
      String(a?.name || "").localeCompare(String(b?.name || ""), "pt-BR", { sensitivity: "base" })
    );

    if (pivos.length === 0) {
      const colCount = Math.max(1, document.querySelectorAll("#section-sistemas-irrigacao thead th").length || 7);
      tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; padding: 2rem;">Nenhum sistema de irrigação cadastrado.</td></tr>`;
      setEmptyPivosColspan();
      renderPivosSectionMap([]);
      return;
    }

    tbody.innerHTML = pivos.map((p) => {
      const areaHa = Cad.geo.calculatePivoAreaHa(p);
      const segs = Array.isArray(p.segments) && p.segments.length > 1 ? p.segments : [];

      return `
      <tr>
        <td style="text-align: left; padding-left: 15px;">
          <div style="font-weight: 600;">${p.name || "-"}</div>
          <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">${(() => {
            const ctrl = String(p.controllerType || "").toLowerCase();
            if (ctrl === "smart_connect") return "Controlador: Smart Connect";
            if (ctrl === "smarttouch") return "Controlador: Smart Touch";
            return "Controlador: Sem controlador";
          })()}</div>
        </td>
        <td style="font-weight: 500; font-size: 13px;">${areaHa ? `${areaHa.toFixed(2)} ha` : "-"}</td>
        <td>
          ${segs.length ? `
            <div style="display:flex; gap:6px; flex-wrap:wrap; justify-content:center; align-items:center; font-size:11px; color:#475569;">
              ${segs.map((s, i) => `
                <div style="display:inline-flex; align-items:center; gap:4px;">
                  <span style="width:7px; height:7px; border-radius:50%; background:${Cad.SEG_COLORS[i % Cad.SEG_COLORS.length]}; flex-shrink:0;"></span>
                  <span>${s.name || ("Seg " + (i + 1))}</span>
                </div>
                ${i < segs.length - 1 ? '<span style="color:#cbd5e1; margin: 0 1px;">/</span>' : ''}
              `).join("")}
            </div>
          ` : '<span style="color:#9ca3af; font-size:11px;">Sem parcelas</span>'}
        </td>
        <td>
          <div class="gestao-op__sch-actions">
            <button type="button" class="sch-btn sch-btn--edit" title="Editar" onclick="window.IcToggleView('sistemas-irrigacao', 'form', '${Cad.data.buildPivoCompositeId(p.farmId, p.id)}')"><i class="fa-solid fa-pencil"></i></button>
            <button type="button" class="sch-btn sch-btn--dup" title="Duplicar" onclick="window.IcDuplicateRecord('${Cad.data.buildPivoCompositeId(p.farmId, p.id)}')"><i class="fa-regular fa-copy"></i></button>
            <button type="button" class="sch-btn sch-btn--del" title="Excluir" onclick="window.IcDeleteRecord('${Cad.data.buildPivoCompositeId(p.farmId, p.id)}')"><i class="fa-regular fa-trash-can"></i></button>
          </div>
        </td>
      </tr>`;
    }).join("");

    renderPivosSectionMap(pivos);
    initTableSortFilter(tbody.closest("table"));
  }

  Cad.lists = Object.assign(Cad.lists || {}, {
    renderPivos
  });

})();
