(function () {
  "use strict";
  const Cad = (window.Cad = window.Cad || {});

  const MONTHS = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro"
  ];

  const escapeAttr = (value) => Cad.ui.escapeAttr(value);
  const getAllFarms = () => Cad.data.getAllFarms();
  const getAllPivosRecords = (farmFilterId = null) => Cad.data.getAllPivosRecords(farmFilterId);
  const getFarmEquipmentList = (farm) => Cad.data.getFarmEquipmentList(farm);

  const DAY_LABELS = { seg: "Segunda", ter: "Terça", qua: "Quarta", qui: "Quinta", sex: "Sexta", sab: "Sábado", dom: "Domingo" };

  function calcDuracao(ini, fim) {
    const [h1, m1] = ini.split(":").map(Number);
    const [h2, m2] = fim.split(":").map(Number);
    let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (mins < 0) mins += 24 * 60;
    const hh = String(Math.floor(mins / 60)).padStart(2, "0");
    const mm = String(mins % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function tipoBadge(tipo) {
    const styles = {
      ponta:      "background:#fca5a5; color:#0f172a; border:none;",
      fora_ponta: "background:#bfdbfe; color:#0f172a; border:none;",
      reduzido:   "background:#bbf7d0; color:#0f172a; border:none;"
    };
    const labels = {
      ponta:      "PICO (PONTA)",
      fora_ponta: "FORA DE PICO (FORA DE PONTA)",
      reduzido:   "REDUZIDO"
    };
    const s = styles[tipo] || "background:#e5e7eb; color:#374151; border:none;";
    const l = labels[tipo] || tipo;
    return `<span style="display:inline-block; padding:3px 10px; border-radius:5px; font-size:11px; font-weight:600; ${s}">${l}</span>`;
  }

  function faixaTableHtml(rows, withDelete) {
    return `
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead>
          <tr style="background:#f1f5f9; color:#64748b;">
            <th style="padding:8px 10px; text-align:left; border-bottom:1px solid #e2e8f0;">Início</th>
            <th style="padding:8px 10px; text-align:left; border-bottom:1px solid #e2e8f0;">Fim</th>
            <th style="padding:8px 10px; text-align:left; border-bottom:1px solid #e2e8f0;">Tipo</th>
            <th style="padding:8px 10px; text-align:left; border-bottom:1px solid #e2e8f0;">Duração</th>
            ${withDelete ? '<th style="padding:8px 10px; border-bottom:1px solid #e2e8f0;"></th>' : ""}
          </tr>
        </thead>
        <tbody>
          ${rows.map((r, i) => `
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:8px 10px;">${r.ini}</td>
              <td style="padding:8px 10px;">${r.fim}</td>
              <td style="padding:8px 10px;">${tipoBadge(r.tipo)}</td>
              <td style="padding:8px 10px; color:#64748b; font-size:12px;"><span>duração de</span> ${calcDuracao(r.ini, r.fim)} <span>horas</span></td>
              ${withDelete ? `<td style="padding:8px 10px; text-align:right;"><button type="button" data-del-row="${i}" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:13px;"><i class="fa-regular fa-trash-can"></i></button></td>` : ""}
            </tr>`).join("")}
        </tbody>
      </table>`;
  }

  function renderFaixaGroups(groups, listTarget) {
    const hidden = document.getElementById("energia_faixas_data");
    if (hidden) hidden.value = JSON.stringify(groups);
    listTarget.innerHTML = groups.map((g, gi) => `
      <div data-faixa-group="${gi}" style="border:1px solid #e2e8f0; border-radius:8px; margin-bottom:12px; overflow:hidden;">
        <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:#f8fafc; border-bottom:1px solid #e2e8f0;">
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            ${g.days.map(d => `<span style="display:inline-block; padding:2px 10px; border-radius:4px; border:1px solid #e2e8f0; background:#fff; font-size:12px; color:#374151;">${DAY_LABELS[d] || d}</span>`).join("")}
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            <button type="button" data-grp-edit="${gi}" style="background:none; border:none; color:#3b82f6; cursor:pointer; font-size:14px;" title="Editar"><i class="fa-regular fa-pen-to-square"></i></button>
            <button type="button" data-grp-del="${gi}" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:14px;" title="Remover"><i class="fa-regular fa-trash-can"></i></button>
          </div>
        </div>
        ${faixaTableHtml(g.rows, false)}
      </div>`).join("");
    listTarget.querySelectorAll("[data-grp-del]").forEach(btn => {
      btn.addEventListener("click", () => {
        groups.splice(Number(btn.dataset.grpDel), 1);
        if (groups.length) renderFaixaGroups(groups, listTarget);
        else listTarget.innerHTML = `<div class="cadastros-empty-state"><span class="cadastros-empty-state__icon"><i class="fa-regular fa-folder-open"></i></span><p>Não há dados</p></div>`;
      });
    });
  }

  const PRESETS = [
    {
      id: "ponta_17_20",
      title: "Ponta entre 17:00 e 20:00",
      desc: "Define horário de ponta entre 17:00 e 20:00 durante dias úteis.",
      groups: [
        { days: ["seg","ter","qua","qui","sex"], rows: [
          { ini:"00:00", fim:"06:00", tipo:"reduzido" },
          { ini:"06:00", fim:"17:00", tipo:"fora_ponta" },
          { ini:"17:00", fim:"20:00", tipo:"ponta" },
          { ini:"20:00", fim:"21:30", tipo:"fora_ponta" },
          { ini:"21:30", fim:"23:59", tipo:"reduzido" }
        ]},
        { days: ["sab","dom"], rows: [
          { ini:"00:00", fim:"06:00", tipo:"reduzido" },
          { ini:"06:00", fim:"21:30", tipo:"fora_ponta" },
          { ini:"21:30", fim:"23:59", tipo:"reduzido" }
        ]}
      ]
    },
    {
      id: "ponta_18_21",
      title: "Ponta entre 18:00 e 21:00",
      desc: "Define horário de ponta entre 18:00 e 21:00 durante dias úteis.",
      groups: [
        { days: ["seg","ter","qua","qui","sex"], rows: [
          { ini:"00:00", fim:"06:00", tipo:"reduzido" },
          { ini:"06:00", fim:"18:00", tipo:"fora_ponta" },
          { ini:"18:00", fim:"21:00", tipo:"ponta" },
          { ini:"21:00", fim:"21:30", tipo:"fora_ponta" },
          { ini:"21:30", fim:"23:59", tipo:"reduzido" }
        ]},
        { days: ["sab","dom"], rows: [
          { ini:"00:00", fim:"06:00", tipo:"reduzido" },
          { ini:"06:00", fim:"21:30", tipo:"fora_ponta" },
          { ini:"21:30", fim:"23:59", tipo:"reduzido" }
        ]}
      ]
    }
  ];

  function renderFormEnergia(id, container) {
    const contratos = window.IcData?.relatorios?.energia?.contratos || [];
    const existing = id ? contratos.find((c) => String(c.id) === String(id)) : null;
    const d = existing || {};

    const mesOptions = MONTHS.map((m, i) => `<option value="${i + 1}" ${Number(d.aniversario) === (i + 1) ? "selected" : ""}>${m}</option>`).join("");
    const allPivos = getAllPivosRecords();
    const allBombas = getAllFarms().flatMap((farm) =>
      getFarmEquipmentList(farm).filter((e) => e.category === "bombas").map((e) => ({ ...e, farmName: farm.name }))
    );
    const linkedPivoIds = new Set(d.pivosVinculados || []);
    const linkedBombaIds = new Set(d.bombasVinculadas || []);

    const pivoChecksHtml = allPivos.length
      ? allPivos.map((p) => `
        <label class="energia-pivo-check">
          <input type="checkbox" class="energia-pivo-cb" name="energia_pivo_cb" value="${escapeAttr(p.id)}" ${linkedPivoIds.has(String(p.id)) ? "checked" : ""}>
          <span>${escapeAttr(p.name || p.id)}</span>
        </label>`).join("")
      : "<span style='color:#9ca3af;font-size:13px;'>Nenhum pivô cadastrado.</span>";

    const bombaChecksHtml = allBombas.length
      ? allBombas.map((b) => `
        <label class="energia-pivo-check">
          <input type="checkbox" class="energia-bomba-cb" name="energia_bomba_cb" value="${escapeAttr(b.id)}" ${linkedBombaIds.has(String(b.id)) ? "checked" : ""}>
          <span>${escapeAttr(b.name || b.data?.nome || b.id)}</span>
        </label>`).join("")
      : "<span style='color:#9ca3af;font-size:13px;'>Nenhum bombeamento cadastrado.</span>";

    container.innerHTML = `
    <div class="cadastros-form-card">
      <div class="cadastros-form-topbar">
        <div class="cadastros-form-topbar__text">${id ? "Editar Contrato de Energia" : "Novo Contrato de Energia"}</div>
        <span class="cadastros-form-topbar__sep">-</span>
        <div class="cadastros-form-topbar__actions">
          <button type="button" class="farm-tab-btn is-active" data-energia-tab="geral">Geral</button>
          <button type="button" class="farm-tab-btn" data-energia-tab="faixas">Faixas de Energia</button>
          <button type="button" class="farm-tab-btn" data-energia-tab="feriados">Feriados</button>
        </div>
      </div>
      <div class="cadastros-form-content">

        <div id="content-energia-geral" class="cadastros-form-section is-active">
          <div style="padding: 20px;">
          <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 8px;">Geral</h2>
          <p style="font-size: 11px; color: #64748b; margin-bottom: 16px; line-height: 1.4;">
            Informações gerais do contrato de energia, tarifas, limites e vínculos com pivôs e bombeamentos da fazenda.
          </p>
          <div class="cadastros-form-grid cadastros-form-grid--pivo">

            <div class="equip-field">
              <label class="equip-label" for="energia_nome"><span class="equip-required">*</span>Nome do Contrato</label>
              <input type="text" class="equip-input" id="energia_nome" value="${escapeAttr(d.nome || "")}" placeholder="Ex: Contrato Verde A3 - Fazenda Norte">
            </div>

            <div class="equip-field">
              <label class="equip-label" for="energia_concessionaria"><span class="equip-required">*</span>Concessionária</label>
              <input type="text" class="equip-input" id="energia_concessionaria" value="${escapeAttr(d.concessionaria || "")}" placeholder="Ex: CPFL, Energisa, Celg">
            </div>
            <div class="equip-field">
              <label class="equip-label" for="energia_aniversario">Aniversário da Conta</label>
              <select class="equip-input" id="energia_aniversario">
                <option value="">-- Mês --</option>
                ${mesOptions}
              </select>
            </div>

            <div class="equip-field col-span-3">
              <label class="equip-label" for="energia_descricao">Descrição</label>
              <textarea class="equip-input" id="energia_descricao" rows="2" placeholder="Observações sobre o contrato">${escapeAttr(d.descricao || "")}</textarea>
            </div>

            <div class="farm-form-divider col-span-3">Tarifas e Limites</div>

            <div class="equip-field">
              <label class="equip-label" for="energia_demanda_kw">Demanda Contratada (kW)</label>
              <input type="number" class="equip-input" id="energia_demanda_kw" value="${escapeAttr(d.demandaKw ?? "")}" placeholder="Ex: 500" min="0" step="any">
            </div>
            <div class="equip-field">
              <label class="equip-label" for="energia_reservado_pct">Meta Horario Reservado (%)</label>
              <input type="number" class="equip-input" id="energia_reservado_pct" value="${escapeAttr(d.reservadoPct ?? "")}" placeholder="Ex: 60" min="0" max="100" step="0.01">
            </div>
            <div class="equip-field">
              <label class="equip-label" for="energia_reativa_valor">Meta Energia Reativa (%)</label>
              <input type="number" class="equip-input" id="energia_reativa_valor" value="${escapeAttr(d.reativaValor ?? "")}" placeholder="Ex: 5" min="0" max="100" step="0.01">
            </div>

            <div class="farm-form-divider col-span-3">Pivôs Vinculados</div>
            <div class="equip-field col-span-3">
              <input type="hidden" id="energia_pivo_ids" value="${escapeAttr(JSON.stringify(d.pivosVinculados || []))}">
              <div class="pivo-talhoes-multi" id="energiaPivoMulti">
                <div class="farm-report__multi-control" data-energia-pivo-control>
                  <div class="farm-report__chips" data-energia-pivo-chips>
                    ${allPivos.filter(p => linkedPivoIds.has(String(p.id))).map(p => `<span class="farm-report__chip" data-pivo-id="${escapeAttr(p.id)}" data-label="${escapeAttr(p.name || p.id)}">${escapeAttr(p.name || p.id)}<button type="button">✕</button></span>`).join("")}
                  </div>
                  <input class="farm-report__search" type="text" id="energiaPivoSearch" placeholder="${linkedPivoIds.size ? linkedPivoIds.size + " pivô(s) selecionado(s)" : "Selecionar pivôs"}" data-energia-pivo-search readonly>
                  <span class="farm-report__chev" aria-hidden="true"><i class="fa-solid fa-chevron-down"></i></span>
                </div>
                <div class="farm-report__dropdown" data-energia-pivo-dropdown aria-hidden="true">
                  <div class="farm-report__list" data-energia-pivo-list>
                    ${allPivos.length
                      ? allPivos.map(p => `<button type="button" class="farm-report__item${linkedPivoIds.has(String(p.id)) ? " is-selected" : ""}" data-energia-pivo-item data-pivo-id="${escapeAttr(p.id)}">${escapeAttr(p.name || p.id)}<span class="check"><i class="fa-solid fa-check"></i></span></button>`).join("")
                      : "<p style='padding:8px 12px;font-size:12px;color:#94a3b8;'>Nenhum pivô cadastrado</p>"}
                  </div>
                </div>
              </div>
            </div>

            <div class="farm-form-divider col-span-3">Bombeamentos Vinculados</div>
            <div class="equip-field col-span-3">
              <input type="hidden" id="energia_bomba_ids" value="${escapeAttr(JSON.stringify(d.bombasVinculadas || []))}">
              <div class="pivo-talhoes-multi" id="energiaBombaMulti">
                <div class="farm-report__multi-control" data-energia-bomba-control>
                  <div class="farm-report__chips" data-energia-bomba-chips>
                    ${allBombas.filter(b => linkedBombaIds.has(String(b.id))).map(b => `<span class="farm-report__chip" data-bomba-id="${escapeAttr(b.id)}" data-label="${escapeAttr(b.name || b.data?.nome || b.id)}">${escapeAttr(b.name || b.data?.nome || b.id)}<button type="button">✕</button></span>`).join("")}
                  </div>
                  <input class="farm-report__search" type="text" id="energiaBombaSearch" placeholder="${linkedBombaIds.size ? linkedBombaIds.size + " bomba(s) selecionada(s)" : "Selecionar bombeamentos"}" data-energia-bomba-search readonly>
                  <span class="farm-report__chev" aria-hidden="true"><i class="fa-solid fa-chevron-down"></i></span>
                </div>
                <div class="farm-report__dropdown" data-energia-bomba-dropdown aria-hidden="true">
                  <div class="farm-report__list" data-energia-bomba-list>
                    ${allBombas.length
                      ? allBombas.map(b => `<button type="button" class="farm-report__item${linkedBombaIds.has(String(b.id)) ? " is-selected" : ""}" data-energia-bomba-item data-bomba-id="${escapeAttr(b.id)}">${escapeAttr(b.name || b.data?.nome || b.id)}<span class="check"><i class="fa-solid fa-check"></i></span></button>`).join("")
                      : "<p style='padding:8px 12px;font-size:12px;color:#94a3b8;'>Nenhum bombeamento cadastrado</p>"}
                  </div>
                </div>
              </div>
            </div>

          </div>
          </div>
        </div>

        <div id="content-energia-faixas" class="cadastros-form-section">
          <div class="pivo-edit__segments-section pivo-edit-specifics" style="padding: 20px;">
            <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 8px;">Faixas de Energia</h2>
            <p style="font-size: 11px; color: #64748b; margin-bottom: 16px; line-height: 1.4;">
              Os tempos de pausa são intervalos de tempo nos quais o pivô não deve operar no modo de irrigação para evitar o uso em momentos críticos, por exemplo, quando o custo da energia elétrica é mais alto.
            </p>
            <div style="display: flex; gap: 10px; margin-bottom: 24px;">
              <button type="button" class="map-card__cta" id="energia_faixa_add_manual" style="width: auto; padding: 8px 16px; border-radius: 8px; font-size: 13px;">
                <i class="fa-solid fa-plus"></i> Adicionar manualmente
              </button>
              <button type="button" class="map-card__cta map-card__cta--secondary" id="energia_faixa_add_preset" style="width: auto; padding: 8px 16px; border-radius: 8px; font-size: 13px;">
                <i class="fa-solid fa-plus"></i> Adicionar pré-definidas
              </button>
            </div>
            <input type="hidden" id="energia_faixas_data" value="${escapeAttr(JSON.stringify(d.faixasEnergia || []))}">
            <div id="energia_faixas_list">
              <div class="cadastros-empty-state">
                <span class="cadastros-empty-state__icon"><i class="fa-regular fa-folder-open"></i></span>
                <p>Não há dados</p>
              </div>
            </div>
          </div>
        </div>

        <div id="content-energia-feriados" class="cadastros-form-section">
          <div style="padding: 20px;">
            <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 8px;">Feriados</h2>
            <p style="font-size: 12px; color: #64748b; margin: 0 0 20px; line-height: 1.5;">
              Vincule feriados à sua fazenda para habilitar automações que ligam e desligam os seus equipamentos automaticamente, evitando pagamentos de tarifas adicionais por horários de ponta.
            </p>

            <div style="display:flex; align-items:center; gap:10px; margin-bottom:20px;">
              <button type="button" id="energia_feriado_add_manual"
                style="display:inline-flex; align-items:center; gap:8px; padding:8px 16px; border-radius:8px; border:1px solid #d1d5db; background:#f3f4f6; color:#9ca3af; font-size:13px; font-weight:500; cursor:pointer;">
                <i class="fa-solid fa-circle-plus" style="color:#d1d5db;"></i> Adicionar feriado
              </button>
              <button type="button" id="energia_feriado_add_preset"
                style="display:inline-flex; align-items:center; gap:8px; padding:8px 20px; border-radius:8px; border:none; background:#16a34a; color:#fff; font-size:13px; font-weight:600; cursor:pointer;">
                <i class="fa-solid fa-download"></i> Importar feriados nacionais
              </button>
            </div>

            <div style="display:flex; justify-content:flex-end; margin-bottom:12px; gap:0;">
              <button type="button" id="feriado_view_mes" data-feriado-view="mes"
                style="padding:5px 14px; font-size:12px; font-weight:500; border:1px solid #d1d5db; border-radius:6px 0 0 6px; background:#fff; color:#374151; cursor:pointer;">Mês</button>
              <button type="button" id="feriado_view_ano" data-feriado-view="ano"
                style="padding:5px 14px; font-size:12px; font-weight:500; border:1px solid #16a34a; border-radius:0 6px 6px 0; background:#fff; color:#16a34a; cursor:pointer; font-weight:600;">Ano</button>
            </div>

            <div id="feriado_cal_ano" style="border-top:1px solid #e5e7eb;">
              ${[
                ["Jan","Fev","Mar"],
                ["Abr","Mai","Jun"],
                ["Jul","Ago","Set"],
                ["Out","Nov","Dez"]
              ].map(row => `
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; border-bottom:1px solid #e5e7eb;">
                  ${row.map(m => `
                    <div style="padding:10px 16px; min-height:110px; border-right:1px solid #f1f5f9;">
                      <span style="font-size:13px; color:#64748b;">${m}</span>
                      <div class="feriado-mes-dots" data-mes="${m}" style="margin-top:6px; display:flex; flex-wrap:wrap; gap:4px;"></div>
                    </div>`).join("")}
                </div>`).join("")}
            </div>

            <div id="feriado_cal_mes" style="display:none;"></div>

            <div id="energia_feriados_list" style="display:none;"></div>
          </div>
        </div>

      </div>
    </div>`;

    container.querySelectorAll(".farm-tab-btn[data-energia-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tabId = btn.getAttribute("data-energia-tab");
        container.querySelectorAll(".farm-tab-btn[data-energia-tab]").forEach((item) => item.classList.remove("is-active"));
        container.querySelectorAll(".cadastros-form-section").forEach((section) => section.classList.remove("is-active"));
        btn.classList.add("is-active");
        const target = container.querySelector(`#content-energia-${tabId}`);
        if (target) target.classList.add("is-active");
      });
    });

    const addManualBtn = container.querySelector("#energia_faixa_add_manual");
    if (addManualBtn) addManualBtn.addEventListener("click", () => openFaixaModal(container));

    const addPresetBtn = container.querySelector("#energia_faixa_add_preset");
    if (addPresetBtn) addPresetBtn.addEventListener("click", () => openFaixaPresetModal(container));

    container.querySelectorAll("[data-feriado-view]").forEach(btn => {
      btn.addEventListener("click", () => {
        const view = btn.dataset.feriadoView;
        const btnMes = container.querySelector("#feriado_view_mes");
        const btnAno = container.querySelector("#feriado_view_ano");
        const calAno = container.querySelector("#feriado_cal_ano");
        const calMes = container.querySelector("#feriado_cal_mes");
        if (view === "ano") {
          calAno.style.display = "";
          calMes.style.display = "none";
          btnAno.style.borderColor = "#16a34a"; btnAno.style.color = "#16a34a"; btnAno.style.fontWeight = "600";
          btnMes.style.borderColor = "#d1d5db"; btnMes.style.color = "#374151"; btnMes.style.fontWeight = "500";
        } else {
          calAno.style.display = "none";
          calMes.style.display = "";
          btnMes.style.borderColor = "#16a34a"; btnMes.style.color = "#16a34a"; btnMes.style.fontWeight = "600";
          btnAno.style.borderColor = "#d1d5db"; btnAno.style.color = "#374151"; btnAno.style.fontWeight = "500";
        }
      });
    });

    Cad.ui.initCadCustomSelects(container);

    Cad.ui.initMultiSelect({
      hostId: "#energiaPivoMulti",
      chipsSelector: "[data-energia-pivo-chips]",
      searchSelector: "[data-energia-pivo-search]",
      dropdownSelector: "[data-energia-pivo-dropdown]",
      listSelector: "[data-energia-pivo-list]",
      controlSelector: "[data-energia-pivo-control]",
      itemSelector: "[data-energia-pivo-item]",
      hiddenInputId: "energia_pivo_ids",
      attrId: "data-pivo-id",
      unitLabel: "pivô"
    }, container);

    Cad.ui.initMultiSelect({
      hostId: "#energiaBombaMulti",
      chipsSelector: "[data-energia-bomba-chips]",
      searchSelector: "[data-energia-bomba-search]",
      dropdownSelector: "[data-energia-bomba-dropdown]",
      listSelector: "[data-energia-bomba-list]",
      controlSelector: "[data-energia-bomba-control]",
      itemSelector: "[data-energia-bomba-item]",
      hiddenInputId: "energia_bomba_ids",
      attrId: "data-bomba-id",
      unitLabel: "bomba"
    }, container);

    // Restaurar faixas salvas ao editar contrato existente
    if (d.faixasEnergia && d.faixasEnergia.length) {
      const listTarget = container.querySelector("#energia_faixas_list");
      if (listTarget) renderFaixaGroups(JSON.parse(JSON.stringify(d.faixasEnergia)), listTarget);
    }
  }

  function openFaixaModal(container) {
    const MODAL_ID = "energiaFaixaModal";
    let modal = document.getElementById(MODAL_ID);

    if (!modal) {
      modal = document.createElement("div");
      modal.id = MODAL_ID;
      modal.className = "create-equip";
      modal.innerHTML = `
        <div class="create-equip__backdrop" data-faixa-close></div>
        <section class="create-equip__dialog" role="dialog" aria-modal="true" aria-labelledby="faixaModalTitle"
                 style="width: min(900px, calc(100vw - 48px)); padding: 0; display: flex; flex-direction: column; max-height: calc(100vh - 40px); background:#fff;">

          <header style="display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid #e5e7eb; flex-shrink:0;">
            <h3 id="faixaModalTitle" style="font-size:20px; font-weight:700; color:#0f172a; margin:0;">Adicionar Faixas de Energia</h3>
            <button type="button" data-faixa-close style="background:none; border:none; font-size:18px; color:#6b7280; cursor:pointer; line-height:1;">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </header>

          <div style="padding:20px; flex:1; overflow-y:auto;">

            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:14px 16px; margin-bottom:20px;">
              <p style="font-size:12px; font-weight:600; color:#374151; margin:0 0 10px;">Válido para os dias:</p>
              <div style="display:flex; flex-wrap:wrap; gap:16px;">
                ${[["seg","Segunda"],["ter","Terça"],["qua","Quarta"],["qui","Quinta"],["sex","Sexta"],["sab","Sábado"],["dom","Domingo"]].map(([v,l], i) => `
                <label style="display:flex; align-items:center; gap:6px; font-size:13px; color:#374151; cursor:pointer;">
                  <input type="checkbox" class="faixa-day-cb" value="${v}" ${i === 0 ? "checked" : ""}
                    style="width:15px; height:15px; accent-color:#16a34a; cursor:pointer;">
                  ${l}
                </label>`).join("")}
              </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:20px;">
              <div>
                <label for="faixa_hora_ini" style="font-size:12px; font-weight:500; color:#374151; display:block; margin-bottom:6px;">Horário inicial</label>
                <input type="time" id="faixa_hora_ini" class="equip-input" value="00:00" style="width:100%;">
              </div>
              <div>
                <label for="faixa_hora_fim" style="font-size:12px; font-weight:500; color:#374151; display:block; margin-bottom:6px;">Horário final</label>
                <input type="time" id="faixa_hora_fim" class="equip-input" placeholder="Hora" style="width:100%;">
              </div>
              <div>
                <label for="faixa_tipo" style="font-size:12px; font-weight:500; color:#374151; display:block; margin-bottom:6px;">Tipo</label>
                <select id="faixa_tipo" class="equip-input" style="width:100%;">
                  <option value="" disabled selected hidden>Por favor selecione</option>
                  <option value="ponta">Pico (Ponta)</option>
                  <option value="fora_ponta">Fora de pico (Fora de ponta)</option>
                  <option value="reduzido">Reduzido</option>
                </select>
              </div>
            </div>

            <button type="button" id="faixa_add_row_btn" class="map-card__cta" style="border-radius:8px; font-size:13px; font-weight:600; margin-bottom:20px;">
              <i class="fa-solid fa-plus"></i> Add
            </button>

            <div id="faixa_modal_list">
              <div style="display:flex; flex-direction:column; align-items:center; gap:8px; padding:24px 0; color:#9ca3af;">
                <i class="fa-regular fa-folder-open" style="font-size:32px;"></i>
                <span style="font-size:13px;">Não há dados</span>
              </div>
            </div>
          </div>

          <div id="faixa_modal_warn" style="display:none; margin:0 20px; padding:10px 14px; background:#fefce8; border:1px solid #fde68a; border-radius:8px; font-size:12px; color:#92400e; line-height:1.4;">
            É necessário preencher todos os horários do dia para salvar uma faixa de energia.
          </div>

          <footer style="display:flex; justify-content:flex-end; gap:10px; padding:14px 20px; border-top:1px solid #e5e7eb; flex-shrink:0; margin-top:12px;">
            <button type="button" data-faixa-close class="map-card__cta--secondary" style="padding:8px 20px; border-radius:8px; font-size:13px; font-weight:600; border:1px solid #cbd5e1; background:#f8fafc; color:#475569; cursor:pointer;">
              Cancelar
            </button>
            <button type="button" id="faixa_modal_ok" class="map-card__cta" style="width:auto; padding:8px 20px; border-radius:8px; font-size:13px; font-weight:600; opacity:0.4; cursor:not-allowed;" disabled>
              OK
            </button>
          </footer>
        </section>`;
      document.body.appendChild(modal);

      const rows = [];

      const EMPTY_HTML = `
        <div style="display:flex; flex-direction:column; align-items:center; gap:8px; padding:24px 0; color:#9ca3af;">
          <i class="fa-regular fa-folder-open" style="font-size:32px;"></i>
          <span style="font-size:13px;">Não há dados</span>
        </div>`;

      function rowCardHtml(r, i) {
        return `
          <div data-row-card="${i}" style="border:1px solid #e2e8f0; border-radius:8px; margin-bottom:10px; overflow:hidden;">
            <div style="display:flex; align-items:center; justify-content:space-between; padding:7px 12px; background:#f8fafc; border-bottom:1px solid #e2e8f0;">
              <div style="display:flex; gap:6px; flex-wrap:wrap;">
                ${r.dias.map(d => `<span style="display:inline-block; padding:2px 10px; border-radius:4px; border:1px solid #e2e8f0; background:#fff; font-size:12px; color:#374151;">${DAY_LABELS[d] || d}</span>`).join("")}
              </div>
              <button type="button" data-del-row="${i}" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:14px;" title="Remover">
                <i class="fa-regular fa-trash-can"></i>
              </button>
            </div>
            ${faixaTableHtml([r], false)}
          </div>`;
      }

      function renderList() {
        const listEl = modal.querySelector("#faixa_modal_list");
        if (!rows.length) { listEl.innerHTML = EMPTY_HTML; return; }
        listEl.innerHTML = rows.map((r, i) => rowCardHtml(r, i)).join("");
        listEl.querySelectorAll("[data-del-row]").forEach(btn => {
          btn.addEventListener("click", () => { rows.splice(Number(btn.dataset.delRow), 1); renderList(); updateOkBtn(); });
        });
      }

      function updateOkBtn() {
        const okBtn = modal.querySelector("#faixa_modal_ok");
        const hasRows = rows.length > 0;
        okBtn.disabled = !hasRows;
        okBtn.style.opacity = hasRows ? "1" : "0.4";
        okBtn.style.cursor = hasRows ? "pointer" : "not-allowed";
      }

      modal.querySelector("#faixa_add_row_btn").addEventListener("click", () => {
        const ini = modal.querySelector("#faixa_hora_ini").value;
        const fim = modal.querySelector("#faixa_hora_fim").value;
        const tipoEl = modal.querySelector("#faixa_tipo");
        const tipo = tipoEl.value;
        const dias = Array.from(modal.querySelectorAll(".faixa-day-cb:checked")).map(cb => cb.value);
        const warn = modal.querySelector("#faixa_modal_warn");

        if (!ini || !fim || !tipo || !dias.length) {
          warn.style.display = "block";
          return;
        }
        warn.style.display = "none";
        rows.push({ dias, ini, fim, tipo });
        renderList();
        updateOkBtn();
      });

      modal.querySelector("#faixa_modal_ok").addEventListener("click", () => {
        const listTarget = container.querySelector("#energia_faixas_list");
        if (listTarget && rows.length) {
          const groups = rows.map(r => ({ days: r.dias, rows: [{ ini: r.ini, fim: r.fim, tipo: r.tipo }] }));
          renderFaixaGroups(groups, listTarget);
        }
        closeModal();
      });

      modal.querySelectorAll("[data-faixa-close]").forEach(el => el.addEventListener("click", closeModal));
    }

    function closeModal() {
      const m = document.getElementById(MODAL_ID);
      if (m) m.classList.remove("is-open");
    }

    modal.classList.add("is-open");
  }

  function openFaixaPresetModal(container) {
    const MODAL_ID = "energiaFaixaPresetModal";
    let modal = document.getElementById(MODAL_ID);

    if (!modal) {
      modal = document.createElement("div");
      modal.id = MODAL_ID;
      modal.className = "create-equip";
      modal.innerHTML = `
        <div class="create-equip__backdrop" data-preset-close></div>
        <section class="create-equip__dialog" role="dialog" aria-modal="true"
                 style="width:min(760px,calc(100vw - 48px)); padding:0; display:flex; flex-direction:column; max-height:calc(100vh - 40px); background:#fff;">

          <header style="display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid #e5e7eb; flex-shrink:0;">
            <h3 style="font-size:20px; font-weight:700; color:#0f172a; margin:0;">Adicionar Faixas de Energia</h3>
            <button type="button" data-preset-close style="background:none; border:none; font-size:18px; color:#6b7280; cursor:pointer; line-height:1;">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </header>

          <div style="padding:20px; flex:1; overflow-y:auto;">
            <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:12px 16px; margin-bottom:16px; font-size:12px; color:#1e40af; line-height:1.5;">
              Faixas de energia são períodos específicos durante o dia nos quais o custo da energia elétrica pode variar. Você pode personalizar as faixas da sua fazenda no menu de configurações.
            </div>
            <p style="font-size:13px; color:#374151; margin:0 0 16px;">Selecione o padrão que melhor te atende baseado nas faixas de energia por horário da sua região</p>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              ${PRESETS.map(p => `
                <button type="button" data-preset-card="${p.id}"
                  style="text-align:left; padding:16px; border-radius:8px; border:1.5px solid #e2e8f0; background:#fff; cursor:pointer; transition:border-color .15s, background .15s;">
                  <div style="font-size:13px; font-weight:700; color:#0f172a; margin-bottom:6px;">${p.title}</div>
                  <div style="font-size:12px; color:#64748b; line-height:1.4;">${p.desc}</div>
                </button>`).join("")}
            </div>
          </div>

          <footer style="display:flex; justify-content:flex-end; gap:10px; padding:14px 20px; border-top:1px solid #e5e7eb; flex-shrink:0;">
            <button type="button" data-preset-close style="padding:8px 20px; border-radius:8px; font-size:13px; font-weight:600; border:1px solid #cbd5e1; background:#f8fafc; color:#475569; cursor:pointer;">
              Cancelar
            </button>
            <button type="button" id="preset_modal_ok" style="width:auto; padding:8px 20px; border-radius:8px; font-size:13px; font-weight:600; opacity:0.4; cursor:not-allowed; background:#16a34a; color:#fff; border:none;" disabled>
              OK
            </button>
          </footer>
        </section>`;
      document.body.appendChild(modal);

      let selectedPreset = null;

      modal.querySelectorAll("[data-preset-card]").forEach(card => {
        card.addEventListener("click", () => {
          modal.querySelectorAll("[data-preset-card]").forEach(c => {
            c.style.borderColor = "#e2e8f0";
            c.style.background = "#fff";
          });
          card.style.borderColor = "#16a34a";
          card.style.background = "#f0fdf4";
          selectedPreset = PRESETS.find(p => p.id === card.dataset.presetCard) || null;
          const ok = modal.querySelector("#preset_modal_ok");
          ok.disabled = false;
          ok.style.opacity = "1";
          ok.style.cursor = "pointer";
        });
      });

      modal.querySelector("#preset_modal_ok").addEventListener("click", () => {
        if (!selectedPreset) return;
        const listTarget = container.querySelector("#energia_faixas_list");
        if (listTarget) renderFaixaGroups(JSON.parse(JSON.stringify(selectedPreset.groups)), listTarget);
        closePreset();
      });

      modal.querySelectorAll("[data-preset-close]").forEach(el => el.addEventListener("click", closePreset));
    }

    function closePreset() {
      const m = document.getElementById(MODAL_ID);
      if (m) m.classList.remove("is-open");
    }

    modal.classList.add("is-open");
  }

  function renderFormFaturas(id, container) {
    const faturas = window.IcData?.relatorios?.energia?.energia_mensal || [];
    const contratos = window.IcData?.relatorios?.energia?.contratos || [];
    const existing = id ? faturas.find((f) => String(f.id) === String(id)) : null;
    const d = existing || {};
    const dem = d.demanda_kw || {};
    const cons = d.consumo || {};
    const reat = d.reativo || {};

    const contratoOpts = contratos.map((c) => `<option value="${escapeAttr(c.id)}" ${String(d.contratoId) === String(c.id) ? "selected" : ""}>${escapeAttr(c.nome || c.id)}</option>`).join("");

    const field = (label, fieldId, val, placeholder, type = "number", required = false) => `
      <div class="equip-field">
        <label class="equip-label" for="${fieldId}">${required ? '<span class="equip-required">*</span>' : ""}${label}</label>
        <input type="${type}" class="equip-input" id="${fieldId}" value="${escapeAttr(val ?? "")}" placeholder="${placeholder}" step="any" min="0">
      </div>`;

    const dualField = (label, idQty, valQty, unitQty, idVal, valVal) => `
      <div class="equip-field">
        <label class="equip-label" for="${idQty}">${label} (${unitQty})</label>
        <input type="number" class="equip-input" id="${idQty}" value="${escapeAttr(valQty ?? "")}" placeholder="${unitQty}" step="any" min="0">
      </div>
      <div class="equip-field">
        <label class="equip-label" for="${idVal}">${label} (R$)</label>
        <input type="number" class="equip-input" id="${idVal}" value="${escapeAttr(valVal ?? "")}" placeholder="R$" step="any" min="0">
      </div>`;

    container.innerHTML = `
    <div class="cadastros-form-card">
      <div class="cadastros-form-topbar">
        <div class="cadastros-form-topbar__text">${id ? "Editar Fatura" : "Nova Fatura de Energia"}</div>
      </div>
      <div class="cadastros-form-content">
        <div class="cadastros-form-section is-active">
          <div style="padding: 20px;">
          <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 8px;">Fatura de Energia</h2>
          <p style="font-size: 11px; color: #64748b; margin-bottom: 16px; line-height: 1.4;">
            Registro mensal de fatura de energia elétrica, incluindo demanda, consumo, reativos, encargos e totais calculados.
          </p>
          <div class="cadastros-form-grid cadastros-form-grid--pivo">

            ${contratos.length ? `
            <div class="equip-field">
              <label class="equip-label" for="fatura_contrato">Contrato de energia</label>
              <select class="equip-input" id="fatura_contrato">
                <option value="">-- Sem contrato --</option>
                ${contratoOpts}
              </select>
            </div>` : ""}

            <div class="equip-field">
              <label class="equip-label" for="fatura_mes_ano"><span class="equip-required">*</span>Mês / Ano</label>
              <input type="month" class="equip-input" id="fatura_mes_ano" value="${escapeAttr(d.mes_ano_iso || "")}" placeholder="AAAA-MM">
            </div>
            <div class="equip-field">
              <label class="equip-label" for="fatura_concessionaria">Concessionária</label>
              <input type="text" class="equip-input" id="fatura_concessionaria" value="${escapeAttr(d.concessionaria || "")}" placeholder="Ex: CPFL">
            </div>
            <div class="equip-field">
              <label class="equip-label" for="fatura_leitura_ant">Leitura Anterior</label>
              <input type="date" class="equip-input" id="fatura_leitura_ant" value="${escapeAttr(d.leituraAnterior || "")}">
            </div>
            <div class="equip-field">
              <label class="equip-label" for="fatura_leitura_atu">Leitura Atual</label>
              <input type="date" class="equip-input" id="fatura_leitura_atu" value="${escapeAttr(d.leituraAtual || "")}">
            </div>

            <div class="farm-form-divider col-span-3">Demanda</div>

            ${field("Demanda Contratada (kW)", "fatura_dem_contratada", dem.contratada, "Ex: 500")}
            ${dualField("Demanda Ativa", "fatura_dem_ativa_kw", dem.ativa_kw, "kW", "fatura_dem_ativa_r", dem.ativa_r)}
            ${dualField("Ultrapassagem de Demanda", "fatura_ultrap_kw", d.ultrapassagem_kw, "kW", "fatura_ultrap_r", d.ultrapassagem_r)}
            ${dualField("Demanda Complementar", "fatura_compl_kw", d.complementar_kw, "kW", "fatura_compl_r", d.complementar_r)}

            <div class="farm-form-divider col-span-3">Consumo</div>

            ${dualField("Consumo Fora de Ponta (HFP)", "fatura_cons_hfp_kwh", cons.hfp_kwh, "kWh", "fatura_cons_hfp_r", cons.hfp_r)}
            ${dualField("Consumo Horário de Ponta (HP)", "fatura_cons_hp_kwh", cons.hp_kwh, "kWh", "fatura_cons_hp_r", cons.hp_r)}
            ${dualField("Consumo Horário Reservado", "fatura_cons_res_kwh", cons.reservado_kwh, "kWh", "fatura_cons_res_r", cons.reservado_r)}

            <div class="farm-form-divider col-span-3">Energia Reativa</div>

            ${dualField("Reativo HFP", "fatura_reat_hfp_kwh", reat.hfp_kwh, "kvarh", "fatura_reat_hfp_r", reat.hfp_r)}
            ${dualField("Reativo HP", "fatura_reat_hp_kwh", reat.hp_kwh, "kvarh", "fatura_reat_hp_r", reat.hp_r)}
            ${dualField("Reativo Reservado", "fatura_reat_res_kwh", reat.reservado_kwh, "kvarh", "fatura_reat_res_r", reat.reservado_r)}

            <div class="farm-form-divider col-span-3">Ajustes e Encargos</div>

            ${field("Descontos Gerais (R$)", "fatura_desc_gerais", d.descontos_gerais, "R$")}
            ${field("Descontos Irrigante / Produtor (R$)", "fatura_desc_irrigante", d.descontos_irrigante, "R$")}
            ${field("Custos Gerais (R$)", "fatura_custos_gerais", d.custos_gerais, "R$")}
            ${field("Impostos (R$)", "fatura_impostos", d.impostos, "R$")}
            ${field("Multas (R$)", "fatura_multas", d.multas, "R$")}

            <div class="farm-form-divider col-span-3">Totais (calculados ao salvar)</div>

            <div class="equip-field">
              <label class="equip-label" for="fatura_total_kwh">Consumo Total (kWh)</label>
              <input type="number" class="equip-input fatura-computed" id="fatura_total_kwh" value="${escapeAttr(d.consumo_kwh ?? "")}" placeholder="Calculado" readonly>
            </div>
            <div class="equip-field">
              <label class="equip-label" for="fatura_total_r">Custo Total (R$)</label>
              <input type="number" class="equip-input fatura-computed" id="fatura_total_r" value="${escapeAttr(d.custo_total ?? "")}" placeholder="Calculado" readonly>
            </div>
            <div class="equip-field">
              <label class="equip-label" for="fatura_penalidades">Penalidades (R$)</label>
              <input type="number" class="equip-input fatura-computed" id="fatura_penalidades" value="${escapeAttr(d.penalidades ?? "")}" placeholder="Calculado" readonly>
            </div>
            <div class="equip-field">
              <label class="equip-label" for="fatura_custo_kwh">Custo Elétrico (R$/kWh)</label>
              <input type="number" class="equip-input fatura-computed" id="fatura_custo_kwh" value="${escapeAttr(d.custo_kwh ?? "")}" placeholder="Calculado" step="any" readonly>
            </div>

          </div>
          </div>
        </div>
      </div>
    </div>`;

    const numVal = (elId) => Number(document.getElementById(elId)?.value || 0) || 0;
    const compute = () => {
      const kwh = numVal("fatura_cons_hfp_kwh") + numVal("fatura_cons_hp_kwh") + numVal("fatura_cons_res_kwh");
      const penalties = numVal("fatura_ultrap_r") + numVal("fatura_compl_r") + numVal("fatura_multas");
      const totalR = numVal("fatura_dem_ativa_r") + numVal("fatura_cons_hfp_r") + numVal("fatura_cons_hp_r") + numVal("fatura_cons_res_r")
        + numVal("fatura_reat_hfp_r") + numVal("fatura_reat_hp_r") + numVal("fatura_reat_res_r")
        + numVal("fatura_ultrap_r") + numVal("fatura_compl_r") + numVal("fatura_custos_gerais")
        + numVal("fatura_impostos") + numVal("fatura_multas")
        - numVal("fatura_desc_gerais") - numVal("fatura_desc_irrigante");

      const el = (elId) => document.getElementById(elId);
      if (el("fatura_total_kwh")) el("fatura_total_kwh").value = kwh > 0 ? kwh.toFixed(2) : "";
      if (el("fatura_total_r")) el("fatura_total_r").value = totalR > 0 ? totalR.toFixed(2) : "";
      if (el("fatura_penalidades")) el("fatura_penalidades").value = penalties > 0 ? penalties.toFixed(2) : "";
      if (el("fatura_custo_kwh")) el("fatura_custo_kwh").value = (kwh > 0 && totalR > 0) ? (totalR / kwh).toFixed(4) : "";
    };
    container.querySelectorAll(".equip-input:not(.fatura-computed)").forEach((inp) => inp.addEventListener("input", compute));
    compute();
    Cad.ui.initCadCustomSelects(container);
  }

  Cad.formEnergia = {
    renderFormEnergia,
    renderFormFaturas
  };

})();
