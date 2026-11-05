(function () {
  "use strict";
  const Cad = (window.Cad = window.Cad || {});

  const MONTHS = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const MONTHS_FULL = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  const initTableSortFilter = (...args) => Cad.toolbar.initTableSortFilter(...args);

  function renderEnergia() {
    const tbody = document.querySelector("#section-energia tbody");
    if (!tbody) return;
    const data = window.IcData?.relatorios?.energia?.contratos || [];
    const faturas = window.IcData?.relatorios?.energia?.energia_mensal || [];

    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;">Nenhum contrato de energia cadastrado.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map((item) => {
      const leituras = faturas.filter((f) => String(f.contratoId) === String(item.id)).length;
      const hasFaixas = Array.isArray(item.faixasEnergia) && item.faixasEnergia.length > 0;
      const hasFeriados = Array.isArray(item.feriados) && item.feriados.length > 0;
      const badgeAtivas = `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:#dcfce7;color:#16a34a;">Ativas</span>`;
      const badgeInativas = `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500;background:#f1f5f9;color:#94a3b8;">Inativas</span>`;
      return `
      <tr>
        <td>
          <div style="font-weight:600;">${item.nome || "-"}</div>
          ${item.concessionaria ? `<div style="font-size:12px;color:#6b7280;">${item.concessionaria}</div>` : ""}
        </td>
        <td style="max-width:200px;color:#6b7280;font-size:13px;">${item.descricao || "-"}</td>
        <td>${item.aniversario ? MONTHS[Number(item.aniversario)] || "-" : "-"}</td>
        <td style="text-align:center;">${hasFaixas ? badgeAtivas : badgeInativas}</td>
        <td style="text-align:center;">${hasFeriados ? badgeAtivas : badgeInativas}</td>
        <td style="text-align:center;">${leituras > 0 ? `<strong>${leituras}</strong>` : "-"}</td>
        <td>
          <div class="gestao-op__sch-actions">
            <button type="button" class="sch-btn sch-btn--edit" title="Editar" onclick="window.IcToggleView('energia','form','${item.id}')"><i class="fa-solid fa-pencil"></i></button>
            <button type="button" class="sch-btn sch-btn--del" title="Excluir" onclick="window.IcDeleteRecord('${item.id}')"><i class="fa-regular fa-trash-can"></i></button>
          </div>
        </td>
      </tr>`;
    }).join("");

    initTableSortFilter(tbody.closest("table"));
  }

  function renderFaturas() {
    const tbody = document.querySelector("#section-faturas tbody");
    if (!tbody) return;
    const data = window.IcData?.relatorios?.energia?.energia_mensal || [];

    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;">Nenhuma fatura cadastrada.</td></tr>';
      return;
    }

    const fmt = (n) => n != null ? Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "-";
    tbody.innerHTML = data
      .slice()
      .sort((a, b) => String(b.mes_ano_iso || "").localeCompare(String(a.mes_ano_iso || "")))
      .map((item) => {
        const iso = item.mes_ano_iso || "";
        const [ano, mesNum] = iso.split("-");
        const mesNome = MONTHS_FULL[Number(mesNum)] || item.mes_ano || "-";
        const hasPenalty = (item.penalidades || 0) > 0;
        return `
        <tr>
          <td><strong>${ano || "-"}</strong></td>
          <td>${mesNome}</td>
          <td style="text-align:center;">1</td>
          <td style="color:#16a34a;font-weight:600;">R$ ${fmt(item.custo_total)}</td>
          <td>${item.consumo_kwh != null ? `${Number(item.consumo_kwh).toLocaleString("pt-BR")} kWh` : "-"}</td>
          <td style="color:${hasPenalty ? "#dc2626" : "#9ca3af"};">${hasPenalty ? `R$ ${fmt(item.penalidades)}` : "-"}</td>
          <td>${item.demanda_kw?.contratada != null ? `${Number(item.demanda_kw.contratada).toLocaleString("pt-BR")} kW` : "-"}</td>
          <td>
            <div class="gestao-op__sch-actions">
              <button type="button" class="sch-btn sch-btn--edit" title="Editar" onclick="window.IcToggleView('faturas','form','${item.id}')"><i class="fa-solid fa-pencil"></i></button>
              <button type="button" class="sch-btn sch-btn--del" title="Excluir" onclick="window.IcDeleteRecord('${item.id}')"><i class="fa-regular fa-trash-can"></i></button>
            </div>
          </td>
        </tr>`;
      }).join("");

    initTableSortFilter(tbody.closest("table"));
  }

  function renderFeriados() {
    const tbody = document.querySelector("#section-feriados tbody");
    if (!tbody) return;
    const data = window.IcData?.relatorios?.energia?.feriados || [];

    if (!Array.isArray(data) || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;padding:2rem;">Nenhum feriado cadastrado.</td></tr>';
      return;
    }

    tbody.innerHTML = data
      .slice()
      .sort((a, b) => String(a.data || "").localeCompare(String(b.data || "")))
      .map((item) => `
        <tr>
          <td>${item.data || "-"}</td>
          <td>${item.descricao || item.nome || "-"}</td>
        </tr>
      `).join("");

    initTableSortFilter(tbody.closest("table"));
  }

  Cad.lists = Object.assign(Cad.lists || {}, {
    renderEnergia,
    renderFeriados,
    renderFaturas
  });

})();
