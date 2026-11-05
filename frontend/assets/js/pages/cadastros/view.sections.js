(function () {
  "use strict";
  const Cad = (window.Cad = window.Cad || {});

  const getAllFarms = () => Cad.data.getAllFarms();
  const getAllTalhoesRecords = (farmId = null) => Cad.data.getAllTalhoesRecords(farmId);
  const getFarmEquipmentList = (farm) => Cad.data.getFarmEquipmentList(farm);
  const buildTalhaoCompositeId = (farmId, talhaoId) => Cad.data.buildTalhaoCompositeId(farmId, talhaoId);
  const getEquipmentTypeLabel = (type) => Cad.ui.getEquipmentTypeLabel(type);
  const renderSectionMap = (...args) => Cad.viewMaps.renderSectionMap(...args);
  const renderTalhoesMap = (...args) => Cad.viewMaps.renderTalhoesMap(...args);
  const renderFazendasMap = (...args) => Cad.viewMaps.renderFazendasMap(...args);
  const initTableSortFilter = (...args) => Cad.toolbar.initTableSortFilter(...args);

  function renderFazendas() {
    const tbody = document.querySelector("#section-fazendas tbody");
    if (!tbody) return;
    const farms = getAllFarms();

    if (farms.length === 0) {
      tbody.innerHTML = "<tr><td colspan=\"3\">Nenhuma fazenda cadastrada.</td></tr>";
      renderFazendasMap([]);
      return;
    }

    const activeFarmId = String(window.IcFarmActive?.id || "");
    tbody.innerHTML = farms.map((f) => {
      const isActive = activeFarmId && String(f.id) === activeFarmId;
      return `
      <tr${isActive ? ' class="cad-row--active"' : ''}>
        <td>${isActive ? '<span class="cad-row-active-dot" title="Fazenda selecionada"></span>' : ''}${f.name || "-"}</td>
        <td>${f.owner || "-"}</td>
        <td>
          <div class="gestao-op__sch-actions">
            <button type="button" class="sch-btn sch-btn--edit" title="Editar" onclick="window.IcToggleView('fazendas', 'form', '${f.id || "123"}')"><i class="fa-solid fa-pencil"></i></button>
            <button type="button" class="sch-btn sch-btn--dup" title="Duplicar" onclick="window.IcDuplicateRecord('${f.id || "123"}')"><i class="fa-regular fa-copy"></i></button>
            <button type="button" class="sch-btn sch-btn--del" title="Excluir" onclick="window.IcDeleteRecord('${f.id || "123"}')"><i class="fa-regular fa-trash-can"></i></button>
          </div>
        </td>
      </tr>
    `;
    }).join("");

    renderFazendasMap(farms);
    initTableSortFilter(tbody.closest("table"));
  }

  function renderTalhoes() {
    const tbody = document.querySelector("#section-talhoes tbody");
    if (!tbody) return;
    const allTalhoes = getAllTalhoesRecords();

    if (allTalhoes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">Nenhum talhão cadastrado.</td></tr>';
      renderTalhoesMap([]);
      return;
    }

    tbody.innerHTML = allTalhoes.map((t) => `
      <tr>
        <td>
          <div style="font-weight: 600;">${t.name || "-"}</div>
        </td>
        <td>${t.crop || t.plantio || "-"}</td>
        <td>${t.area ? `${t.area} ha` : "-"}</td>
        <td>${t.soilType || t.soil || t.tipoSolo || "-"}</td>
        <td>
          <div class="gestao-op__sch-actions">
            <button type="button" class="sch-btn sch-btn--edit" title="Editar" onclick="window.IcToggleView('talhoes', 'form', '${buildTalhaoCompositeId(t.farmId, t.id)}')"><i class="fa-solid fa-pencil"></i></button>
            <button type="button" class="sch-btn sch-btn--dup" title="Duplicar" onclick="window.IcDuplicateRecord('${buildTalhaoCompositeId(t.farmId, t.id)}')"><i class="fa-regular fa-copy"></i></button>
            <button type="button" class="sch-btn sch-btn--del" title="Excluir" onclick="window.IcDeleteRecord('${buildTalhaoCompositeId(t.farmId, t.id)}')"><i class="fa-regular fa-trash-can"></i></button>
          </div>
        </td>
      </tr>
    `).join("");

    renderTalhoesMap(allTalhoes);
    initTableSortFilter(tbody.closest("table"));
  }

  function renderParcelas() {
    const tbody = document.querySelector("#section-parcelas tbody");
    if (!tbody) return;
    const farms = getAllFarms();
    let parcelas = [];
    farms.forEach((f) => {
      if (f.parcelas && Array.isArray(f.parcelas)) {
        parcelas.push(...f.parcelas.map((p) => ({ ...p, farmName: f.name })));
      }
    });

    if (parcelas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">Nenhuma parcela cadastrada.</td></tr>';
      renderSectionMap("cadastrosParcelasMap", []);
      return;
    }

    tbody.innerHTML = parcelas.map((p) => `
      <tr>
        <td>
          <div style="font-weight: 600;">${p.name || "-"}</div>
          <div style="font-size: 12px; color: #6b7280;">${p.farmName}</div>
        </td>
        <td>${p.pivoName || "-"}</td>
        <td>${p.startAngle || "-"}?</td>
        <td>${p.endAngle || "-"}?</td>
        <td>${p.plantingDate || "-"}</td>
        <td>${p.harvestDate || "-"}</td>
        <td>
          <div class="gestao-op__sch-actions">
            <button type="button" class="sch-btn sch-btn--edit" title="Editar" onclick="window.IcToggleView('parcelas', 'form', '${p.id || "123"}')"><i class="fa-solid fa-pencil"></i></button>
            <button type="button" class="sch-btn sch-btn--del" title="Excluir" onclick="window.IcDeleteRecord('${p.id || "123"}')"><i class="fa-regular fa-trash-can"></i></button>
          </div>
        </td>
      </tr>
    `).join("");

    renderSectionMap("cadastrosParcelasMap", parcelas, (p) => p.name || "Parcela");
  }

  function renderEquipamentos() {
    const tbody = document.querySelector("#section-equipamentos tbody");
    if (!tbody) return;
    const farms = getAllFarms();
    let equipamentos = [];

    farms.forEach((f) => {
      const cLat = Number(f.centralLat);
      const cLng = Number(f.centralLng);
      if (Number.isFinite(cLat) && Number.isFinite(cLng)) {
        equipamentos.push({
          _isCentral: true,
          _farmId: String(f.id || ""),
          id: `central_${f.id}`,
          type: "central",
          typeLabel: "Central",
          name: `Central \u2014 ${f.name || "Fazenda"}`,
          farmName: f.name,
          data: { lat: cLat, lng: cLng }
        });
      }
      const list = getFarmEquipmentList(f).filter((e) => e.category !== "pivos");
      equipamentos.push(...list.map((e) => ({ ...e, farmName: f.name })));
    });

    if (equipamentos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 2rem;">Nenhum equipamento cadastrado.</td></tr>';
      renderSectionMap("cadastrosEquipamentosMap", []);
      return;
    }

    tbody.innerHTML = equipamentos.map((e) => `
      <tr>
        <td>
          <span style="font-size: 12px;">${e.typeLabel || getEquipmentTypeLabel(e.type || "") || e.type || "-"}</span>
        </td>
        <td>
          <div>${e.name || e.data?.nome || "-"}</div>
        </td>
        <td>
          <div class="gestao-op__sch-actions">
            ${e._isCentral
              ? `<button type="button" class="sch-btn sch-btn--edit" title="Editar fazenda" onclick="window.IcToggleView('fazendas', 'form', '${e._farmId}')"><i class="fa-solid fa-pencil"></i></button>`
              : `<button type="button" class="sch-btn sch-btn--edit" title="Editar" onclick="window.IcToggleView('equipamentos', 'form', '${e.id || "123"}')"><i class="fa-solid fa-pencil"></i></button>
                 <button type="button" class="sch-btn sch-btn--del" title="Excluir" onclick="window.IcDeleteRecord('${e.id || "123"}')"><i class="fa-regular fa-trash-can"></i></button>`
            }
          </div>
        </td>
      </tr>
    `).join("");

    renderSectionMap("cadastrosEquipamentosMap", equipamentos, (e) => e.name || e.data?.nome || getEquipmentTypeLabel(e.type || ""));
    initTableSortFilter(tbody.closest("table"), 0, (filterVal) => {
      const q = filterVal.toLowerCase().trim();
      const filtered = q ? equipamentos.filter((e) => getEquipmentTypeLabel(e.type || "").toLowerCase().includes(q)) : equipamentos;
      renderSectionMap("cadastrosEquipamentosMap", filtered, (e) => e.name || e.data?.nome || getEquipmentTypeLabel(e.type || ""));
    });
  }

  Cad.lists = Object.assign(Cad.lists || {}, {
    renderFazendas,
    renderTalhoes,
    renderParcelas,
    renderEquipamentos
  });
})();
