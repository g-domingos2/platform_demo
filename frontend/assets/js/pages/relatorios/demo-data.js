// assets/js/pages/relatorios/demo-data.js
// Relatórios da Fazenda montados a partir dos equipamentos realmente criados
// na fazenda ativa. Todos os números saem do IcDemoHistory (mesma fonte dos
// históricos e gráficos das telas de detalhes), filtrados pelo período e pelos
// equipamentos selecionados. Nada de lista fixa de "Pivô 1..28".
//
//   prepare(root) → antes do initReportUI: preenche os filtros de equipamento.
//   attach(root)  → depois do initReportUI: renderiza e escuta período/filtros.
(function () {
  "use strict";

  const H = () => window.IcDemoHistory;
  const PAGE_SIZE = 10;

  // Relatório → tipos de equipamento que entram nele
  const SECTION_KINDS = {
    reportIrrigacao: ["pivot", "linear"],
    reportPivots: ["pivot", "linear"],
    reportWater: ["pivot", "linear", "pump"],
    reportCarreteis: ["reel"],
    reportHidrico: ["pump"],
    reportConformidade: ["pump"],
  };
  const EMPTY_LABEL = {
    reportIrrigacao: "pivô",
    reportPivots: "pivô",
    reportWater: "pivô ou bomba",
    reportCarreteis: "carretel",
    reportHidrico: "bomba",
    reportConformidade: "bomba",
  };

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const n = (v, d = 2) => H().fmt.n(Number.isFinite(v) ? v : 0, d);
  const money = (v) => `<span class="unit unit--currency">$</span> ${n(v)}`;
  const unit = (v, u) => `${v} <span class="unit">${u}</span>`;
  const safeDiv = (a, b) => (b > 0 ? a / b : 0);
  const hhmm = (hours) => {
    const t = Math.max(0, Math.round(hours * 60));
    return `${String(Math.floor(t / 60)).padStart(2, "0")}h${String(t % 60).padStart(2, "0")}min`;
  };

  function sortByName(list) {
    return list.slice().sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "pt-BR", { numeric: true }));
  }

  function equipmentsFor(section) {
    const kinds = SECTION_KINDS[section] || [];
    const farm = H().activeFarm();
    return sortByName(H().equipmentsOf(farm).filter((e) => kinds.includes(H().kindOf(e))));
  }

  function itemHtml(equip) {
    return `<div class="farm-report__item is-selected" data-report-item data-equip-id="${esc(equip.id)}">${esc(equip.name || "Equipamento")}<span class="check"><i class="fa-solid fa-check"></i></span></div>`;
  }

  // -------------------------------------------------------------- prepare
  function prepare(root) {
    if (!H()) return;
    Object.keys(SECTION_KINDS).forEach((section) => {
      const bar = root.querySelector(`.farm-report__filters[data-filter-for="${section}"]`);
      const list = bar?.querySelector("[data-report-list]");
      if (!list) return;
      const items = equipmentsFor(section);
      list.innerHTML = items.length
        ? items.map(itemHtml).join("")
        : `<div class="farm-report__empty" style="padding:10px 12px;color:#94a3b8;font-size:13px;">Nenhum ${EMPTY_LABEL[section]} cadastrado</div>`;
    });
  }

  // ------------------------------------------------------------- seleção
  function selectedFor(root, section) {
    const all = equipmentsFor(section);
    const bar = root.querySelector(`.farm-report__filters[data-filter-for="${section}"]`);
    const ids = new Set(Array.from(bar?.querySelectorAll("[data-report-item].is-selected") || []).map((el) => el.dataset.equipId));
    return { all, selected: all.filter((e) => ids.has(String(e.id))) };
  }

  function currentRange() {
    const p = window.__icRelatoriosPeriod;
    const h = H();
    const end = p?.end ? new Date(`${p.end}T23:59:59`) : h.NOW;
    const start = p?.start ? new Date(`${p.start}T00:00:00`) : new Date(h.dayStart(h.NOW).getTime() - 29 * h.DAY);
    return h.normRange(start, end);
  }

  function setStats(root, section, values) {
    const items = root.querySelectorAll(`[data-stats-for="${section}"] .farm-report__stats-value`);
    values.forEach((html, i) => { if (items[i]) items[i].innerHTML = html; });
  }

  function emptyRow(cols, text) {
    return `<tr class="demo-report-empty"><td colspan="${cols}" style="padding:28px 16px;text-align:center;color:#64748b;">${text}</td></tr>`;
  }

  function emptyText(section, hasAny) {
    return hasAny
      ? "Nenhum equipamento selecionado no filtro."
      : `Nenhum ${EMPTY_LABEL[section]} cadastrado nesta fazenda. Crie um equipamento para ver este relatório.`;
  }

  function toggleBtn(id, name, enabled = true) {
    return `<button class="expand-btn irrigation-toggle-btn${enabled ? "" : " is-disabled"}" type="button" aria-label="Expandir detalhes de ${esc(name)}" aria-expanded="false" data-demo-toggle="${esc(id)}"${enabled ? "" : " disabled"}><i class="fa-solid fa-plus"></i></button>`;
  }

  function detailWrap(cols, id, inner) {
    return `<tr class="irrigation-detail-row" data-demo-detail="${esc(id)}" hidden><td colspan="${cols}"><div class="irrigation-detail-wrap">${inner}</div></td></tr>`;
  }

  // Paginação por linhas "principais" (linhas de detalhe acompanham a principal)
  const pageState = {};
  function paginate(root, section, groups, cols) {
    const body = root.querySelector(`[data-demo-body="${section}"]`);
    const pager = body?.closest(".edit-panel__section")?.querySelector("[data-demo-pager]");
    const total = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
    const page = Math.min(pageState[section] || 1, total);
    pageState[section] = page;
    if (body) body.innerHTML = groups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).join("") || "";
    if (pager) {
      pager.innerHTML = total > 1 ? H().paginationHtml(page, total) : "";
      pager.style.display = total > 1 ? "" : "none";
    }
    return body;
  }

  // ============================================================ IRRIGAÇÃO
  function renderIrrigacao(root, range) {
    const section = "reportIrrigacao";
    const { all, selected } = selectedFor(root, section);
    const tot = { area: 0, volume: 0, cost: 0, ops: 0 };
    const groups = selected.map((equip, i) => {
      const s = H().pivot.summary(equip, range.start, range.end);
      const ops = H().pivot.ops(equip, range.start, range.end).filter((o) => o.wet);
      const lamina = safeDiv(s.volume, s.areaHa * 10);
      tot.area += s.areaHa;
      tot.volume += s.volume;
      tot.cost += s.cost;
      tot.ops += s.wetOps;
      const rows = ops.map((op) => `<tr>
          <td>${H().fmt.dateTime(op.start)}</td>
          <td>${op.scheduled ? "Agendada" : "Simples"} · ${op.direction}</td>
          <td>${n(op.angStart, 1)}</td>
          <td>${n(op.angEnd, 1)}</td>
          <td>${n(op.laminaMm)}</td>
          <td>${n(op.volume)}</td>
          <td>${n(op.relLaminaMm)}</td>
          <td>${n(op.cost)}</td>
        </tr>`).join("");
      const detail = ops.length
        ? `<table class="irrigation-detail-table"><thead><tr>
            <th>Data</th><th>Tipo</th><th>Ângulo de Início (°)</th><th>Ângulo de Fim (°)</th>
            <th>Lâmina Configurada (mm)</th><th>Volume Aplicado (m³)</th><th>Lâmina Relativa (mm)</th><th>Custo ($)</th>
          </tr></thead><tbody>${rows}</tbody></table>`
        : `<div style="padding:12px 16px;color:#64748b;">Sem irrigações no período</div>`;
      return `<tr class="${i % 2 === 0 ? "is-even" : ""}">
          <td class="text-left">${toggleBtn(equip.id, equip.name, ops.length > 0)} ${esc(equip.name)}</td>
          <td>${n(s.areaHa)}</td>
          <td>${s.wetOps}</td>
          <td>${n(s.volume)}</td>
          <td>${n(lamina)}</td>
          <td>${n(safeDiv(s.cost, lamina * s.areaHa))}</td>
          <td>${n(safeDiv(s.cost, s.areaHa))}</td>
          <td>${n(safeDiv(s.cost, s.wetOps))}</td>
          <td>${n(s.cost)}</td>
        </tr>${detailWrap(9, equip.id, detail)}`;
    });
    if (!groups.length) groups.push(emptyRow(9, emptyText(section, all.length)));
    paginate(root, section, groups, 9);
    const lam = safeDiv(tot.volume, tot.area * 10);
    setStats(root, section, [
      unit(n(tot.area), "ha"),
      unit(n(tot.volume), "m³"),
      unit(n(lam), "mm"),
      `${money(safeDiv(tot.cost, lam * tot.area))} <span class="unit">/mm/ha</span>`,
      `${money(safeDiv(tot.cost, tot.area))} <span class="unit">/ha</span>`,
      money(tot.cost),
    ]);
  }

  // ============================================================ GERENCIAL
  const FAULT_NAME = { pressure: "Falha de Pressão", misalignment: "Desalinhamento", lowVoltage: "Tensão Baixa", peakVoltage: "Pico de Tensão" };

  function faultDowntime(op) {
    return H().round(1 + H().unit(`dt|${op.id}`) * 5, 1);
  }
  function maintenanceHours(equip, range) {
    // ~1 manutenção preventiva a cada 30 dias, de 2–6 h
    let h = 0;
    for (let d = H().dayStart(range.start); d <= range.end; d = new Date(d.getTime() + H().DAY)) {
      if (H().unit(`mt|${equip.id}|${H().dayKey(d)}`) < 1 / 30) h += 2 + H().unit(`mth|${equip.id}|${H().dayKey(d)}`) * 4;
    }
    return h;
  }
  function pointOnPivot(model, angleDeg) {
    const c = model.center;
    if (!c) return { lat: NaN, lng: NaN };
    const br = (angleDeg * Math.PI) / 180;
    const d = (model.radius * 0.85) / 6371000;
    const lat1 = (c.lat * Math.PI) / 180;
    const lng1 = (c.lng * Math.PI) / 180;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(br));
    const lng2 = lng1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
    return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
  }

  function renderGerencial(root, range) {
    const section = "reportPivots";
    const { all, selected } = selectedFor(root, section);
    const periodH = (range.end - range.start) / H().HOUR;
    const tot = { cyclesPct: 0, opH: 0, irrH: 0, stops: 0, stopH: 0, unavail: 0, n: 0 };
    const groups = selected.map((equip, i) => {
      const s = H().pivot.summary(equip, range.start, range.end);
      const ops = H().pivot.ops(equip, range.start, range.end);
      const faults = ops.filter((o) => o.fault && o.end >= range.start && o.end <= range.end);
      const stopH = faults.reduce((a, o) => a + faultDowntime(o), 0);
      const maintH = maintenanceHours(equip, range);
      const complete = ops.length ? (ops.filter((o) => !o.fault).length / ops.length) * 100 : 0;
      const unavail = safeDiv(stopH + maintH, periodH) * 100;
      tot.cyclesPct += complete;
      tot.opH += s.hours;
      tot.irrH += s.wetHours;
      tot.stops += faults.length;
      tot.stopH += stopH;
      tot.unavail += unavail;
      tot.n += 1;
      const rows = faults.map((op) => {
        const p = pointOnPivot(s.model, op.angEnd);
        return `<tr><td>${H().fmt.dateBR(op.end)}</td><td>${FAULT_NAME[op.fault]}</td><td>${H().fmt.time(op.end)}</td>
          <td>${Number.isFinite(p.lat) ? p.lat.toFixed(6) : "—"}</td><td>${Number.isFinite(p.lng) ? p.lng.toFixed(6) : "—"}</td>
          <td>${n(faultDowntime(op), 1)}</td><td>${Math.round(op.angEnd)}°</td></tr>`;
      }).join("");
      const detail = `<table class="irrigation-detail-table pivot-fault-detail-table"><thead><tr>
          <th>Data</th><th>Tipo de Falha</th><th>Início</th><th>Latitude</th><th>Longitude</th><th>Duração (h)</th><th>Ângulo (°)</th>
        </tr></thead><tbody>${rows}</tbody></table>`;
      return `<tr class="${i % 2 === 0 ? "is-even" : ""}">
          <td class="text-left">${toggleBtn(equip.id, equip.name, faults.length > 0)} ${esc(equip.name)}</td>
          <td>${n(complete)}</td>
          <td>${n(s.hours)}</td>
          <td>${n(s.wetHours)}</td>
          <td>${n(stopH)}</td>
          <td>${n(maintH)}</td>
          <td>${faults.length}</td>
          <td>${n(safeDiv(stopH, faults.length))}</td>
          <td>${n(unavail)}%</td>
        </tr>${detailWrap(9, equip.id, detail)}`;
    });
    if (!groups.length) groups.push(emptyRow(9, emptyText(section, all.length)));
    paginate(root, section, groups, 9);
    setStats(root, section, [
      unit(n(safeDiv(tot.cyclesPct, tot.n)), "%"),
      unit(n(tot.opH), "h"),
      unit(n(tot.irrH), "h"),
      String(tot.stops),
      unit(n(safeDiv(tot.stopH, tot.stops)), "h/evento"),
      unit(n(safeDiv(tot.unavail, tot.n)), "%"),
    ]);
  }

  // ============================================================== ENERGIA
  function renderEnergia(root, range) {
    const section = "reportWater";
    const { all, selected } = selectedFor(root, section);
    const tot = { kwh: 0, peak: 0, off: 0, red: 0, cost: 0 };
    const groups = selected.map((equip, i) => {
      const isPump = H().kindOf(equip) === "pump";
      const s = isPump ? H().pump.summary(equip, range.start, range.end) : H().pivot.summary(equip, range.start, range.end);
      tot.kwh += s.kwh;
      tot.peak += s.kwhPeak;
      tot.off += s.kwhOff;
      tot.red += s.kwhReduced;
      tot.cost += s.cost;
      const pct = (v) => n(safeDiv(v, s.kwh) * 100, 1);
      return `<tr class="${i % 2 === 0 ? "is-even" : ""}">
          <td class="text-left">${esc(equip.name)}</td>
          <td>${n(s.kwh)}</td>
          <td>${n(s.kwhPeak, 0)}</td>
          <td>${n(s.kwhOff, 0)}</td>
          <td>${n(s.kwhReduced, 0)}</td>
          <td>${pct(s.kwhPeak)}</td>
          <td>${pct(s.kwhOff)}</td>
          <td>${pct(s.kwhReduced)}</td>
          <td>${n(safeDiv(s.cost, s.kwh))}</td>
          <td>${n(s.cost)}</td>
        </tr>`;
    });
    if (!groups.length) groups.push(emptyRow(10, emptyText(section, all.length)));
    paginate(root, section, groups, 10);
    const pct = (v) => unit(n(safeDiv(v, tot.kwh) * 100, 1), "%");
    setStats(root, section, [
      money(tot.cost),
      unit(n(tot.kwh), "kWh"),
      `${money(safeDiv(tot.cost, tot.kwh))} <span class="unit">/kWh</span>`,
      pct(tot.peak),
      pct(tot.off),
      pct(tot.red),
    ]);
  }

  // ============================================================ CARRETÉIS
  function renderCarreteis(root, range) {
    const section = "reportCarreteis";
    const body = root.querySelector("[data-carretel-body]");
    if (!body) return;
    const { all, selected } = selectedFor(root, section);
    const days = Math.max(1, (range.end - range.start) / H().DAY);
    const tot = { ops: 0, stops: 0, area: 0, hours: 0, volume: 0 };
    let html = "";
    selected.forEach((equip, i) => {
      const ops = H().reel.ops(equip, range.start, range.end);
      const m = H().reel.model(equip);
      const sum = (k) => ops.reduce((a, o) => a + o[k], 0);
      const stops = ops.filter((o) => o.reason !== "Concluído").length;
      const hours = sum("durH");
      const area = sum("areaHa");
      const volume = sum("volume");
      tot.ops += ops.length;
      tot.stops += stops;
      tot.area += area;
      tot.hours += hours;
      tot.volume += volume;
      const rows = ops.map((o) => `<tr>
          <td>${H().fmt.dateTimeBR(o.start)}</td><td>${H().fmt.dateTimeBR(o.end)}</td><td>${o.reason}</td><td>${o.mode}</td>
          <td>${hhmm(o.durH)}</td><td>${n(o.retracted)}</td><td>${n(o.volume)}</td><td>${n(o.areaHa)}</td><td>${n(o.laminaMm)}</td>
        </tr>`).join("");
      const detail = ops.length
        ? `<table class="irrigation-detail-table"><thead><tr>
            <th>Data de início</th><th>Data de fim</th><th>Motivo da parada</th><th>Modo</th><th>Duração</th>
            <th>Comprimento recolhido (m)</th><th>Volume aplicado (m³)</th><th>Área irrigada (ha)</th><th>Lâmina relativa de irrigação (mm)</th>
          </tr></thead><tbody>${rows}</tbody></table>`
        : `<div style="padding:12px 16px;color:#64748b;">Sem operações no período</div>`;
      html += `<tr class="${i % 2 === 0 ? "is-even" : ""}">
          <td class="text-left">${toggleBtn(equip.id, equip.name, true)} ${esc(equip.name)}</td>
          <td class="text-left">${esc(m.model)}</td>
          <td>${ops.length}</td>
          <td>${stops}</td>
          <td>${n((hours / (days * 24)) * 100, 1)}%</td>
          <td>${n(hours)}</td>
          <td>${n(sum("retracted"))}</td>
          <td>${n(volume)}</td>
          <td>${n(area)}</td>
          <td>${n(safeDiv(volume, area * 10))}</td>
        </tr>${detailWrap(10, equip.id, detail)}`;
    });
    body.innerHTML = html || emptyRow(10, emptyText(section, all.length));
    const set = (k, v) => { const el = root.querySelector(`[data-carretel-derived="${k}"]`); if (el) el.innerHTML = v; };
    set("operations", String(tot.ops));
    set("area", unit(n(tot.area), "ha"));
    set("volume", unit(n(tot.volume), "m³"));
    set("depth", unit(n(safeDiv(tot.volume, tot.area * 10)), "mm"));
    set("hours", unit(n(tot.hours), "h"));
    set("stops", String(tot.stops));
  }

  // ============================================================ HÍDRICO
  function meterVolume(op) {
    // hidrômetro: volume calculado ± 3 %
    return op.volume * (0.97 + H().unit(`hd|${op.id}`) * 0.06);
  }
  function pumpPoint(equip) {
    const d = equip?.data || {};
    const lat = Number(d.lat);
    const lng = Number(d.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }

  function renderHidrico(root, range) {
    const section = "reportHidrico";
    const { all, selected } = selectedFor(root, section);
    const tot = { vol: 0, hd: 0, h: 0, ops: 0 };
    const rows = [];
    selected.forEach((equip) => {
      const p = pumpPoint(equip);
      H().pump.ops(equip, range.start, range.end).forEach((op) => {
        const hd = meterVolume(op);
        tot.vol += op.volume;
        tot.hd += hd;
        tot.h += op.durH;
        tot.ops += 1;
        rows.push({ op, html: (cls) => `<tr class="${cls}">
            <td class="text-left">${esc(equip.name)}</td>
            <td>${H().fmt.dateTime(op.start)}</td>
            <td>${H().fmt.dateTime(op.end)}</td>
            <td>${hhmm(op.durH)}</td>
            <td>${n(op.volume)}</td>
            <td>${n(hd)}</td>
            <td>${p ? p.lat.toFixed(6) : "—"}</td>
            <td>${p ? p.lng.toFixed(6) : "—"}</td>
          </tr>` });
      });
    });
    rows.sort((a, b) => b.op.start - a.op.start);
    const groups = rows.map((r, i) => r.html(i % 2 === 0 ? "is-even" : ""));
    if (!groups.length) groups.push(emptyRow(8, selected.length ? "Sem operações no período." : emptyText(section, all.length)));
    paginate(root, section, groups, 8);
    setStats(root, section, [unit(n(tot.vol), "m³"), unit(n(tot.hd), "m³"), hhmm(tot.h), String(tot.ops)]);
  }

  // ======================================================== CONFORMIDADE
  function renderConformidade(root, range) {
    const section = "reportConformidade";
    const { all, selected } = selectedFor(root, section);
    const tot = { vol: 0, ops: 0, points: 0, fails: 0 };
    const groups = selected.map((equip, i) => {
      const ops = H().pump.ops(equip, range.start, range.end).slice().sort((a, b) => b.start - a.start);
      const p = pumpPoint(equip);
      const hdId = `HD-${100 + (H().hash(equip.id) % 900)}`;
      let fails = 0;
      let vol = 0;
      const rows = ops.map((op, k) => {
        const failed = H().unit(`tx|${op.id}`) < 0.05;
        const hd = failed ? 0 : meterVolume(op);
        if (failed) fails += 1;
        vol += op.volume;
        const diff = failed ? -100 : ((hd - op.volume) / op.volume) * 100;
        const st = failed ? '<span class="conf-status conf-status--warn">Estimado</span>' : '<span class="conf-status conf-status--ok">Normal</span>';
        return `<tr><td>OP-${String(ops.length - k).padStart(3, "0")}</td><td>${H().fmt.dateTime(op.start)}</td><td>${H().fmt.dateTime(op.end)}</td>
          <td>${n(op.durH)}</td><td>${n(op.volume)}</td><td>${n(hd)}</td><td>${n(diff, 1)}%</td><td>${hdId}</td>
          <td>${p ? p.lat.toFixed(4).replace(".", ",") : "—"}</td><td>${p ? p.lng.toFixed(4).replace(".", ",") : "—"}</td><td>Trecho 1</td><td>${st}</td></tr>`;
      }).join("");
      tot.vol += vol;
      tot.ops += ops.length;
      tot.points += 1;
      tot.fails += fails;
      const ok = fails <= Math.max(1, ops.length * 0.1);
      const detail = ops.length
        ? `<table class="irrigation-detail-table"><thead><tr>
            <th>ID Operação</th><th>Início</th><th>Término</th><th>Duração (h)</th><th>Volume Calculado (m³)</th><th>Volume Hidrômetro (m³)</th>
            <th>Diferença (%)</th><th>Hidrômetro Vinculado</th><th>Latitude</th><th>Longitude</th><th>Trecho Outorgado</th><th>Status Transmissão</th>
          </tr></thead><tbody>${rows}</tbody></table>`
        : `<div style="padding:12px 16px;color:#64748b;">Sem operações no período</div>`;
      return `<tr class="${i % 2 === 0 ? "is-even" : ""}">
          <td class="text-left">${toggleBtn(equip.id, equip.name, ops.length > 0)} ${esc(equip.name)}</td>
          <td>OP-Irricontrol-${String(i + 1).padStart(2, "0")}</td>
          <td>${n(vol)}</td>
          <td>${ops.length}</td>
          <td>1</td>
          <td>${fails}</td>
          <td><span class="conf-status ${ok ? "conf-status--ok" : "conf-status--warn"}">${ok ? "Conforme" : "Atenção"}</span></td>
        </tr>${detailWrap(7, equip.id, detail)}`;
    });
    if (!groups.length) groups.push(emptyRow(7, emptyText(section, all.length)));
    paginate(root, section, groups, 7);
    setStats(root, section, [String(selected.length), unit(n(tot.vol), "m³"), String(tot.points), String(tot.ops), String(tot.fails)]);
  }

  // ============================================================ attach
  function renderAll(root) {
    if (!H() || !root.isConnected) return;
    const range = currentRange();
    renderIrrigacao(root, range);
    renderGerencial(root, range);
    renderEnergia(root, range);
    renderCarreteis(root, range);
    renderHidrico(root, range);
    renderConformidade(root, range);
  }

  function attach(root) {
    if (!H()) return;
    let timer = null;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => renderAll(root), 0);
    };

    root.addEventListener("ic-report-range", () => {
      Object.keys(pageState).forEach((k) => { pageState[k] = 1; });
      schedule();
    });

    // Mudança de seleção no filtro (os itens param a propagação → captura)
    root.addEventListener("click", (e) => {
      if (e.target.closest("[data-report-item], [data-report-select-all], [data-report-remove-all], .farm-report__chip button")) {
        Object.keys(pageState).forEach((k) => { pageState[k] = 1; });
        schedule();
      }
    }, true);

    // Expandir/recolher detalhes
    root.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-demo-toggle]");
      if (!btn || btn.disabled) return;
      const tbody = btn.closest("tbody");
      const row = tbody?.querySelector(`[data-demo-detail="${CSS.escape(btn.dataset.demoToggle)}"]`);
      if (!row) return;
      const open = row.hasAttribute("hidden");
      row.toggleAttribute("hidden", !open);
      btn.setAttribute("aria-expanded", String(open));
      const icon = btn.querySelector("i");
      icon?.classList.toggle("fa-plus", !open);
      icon?.classList.toggle("fa-minus", open);
    });

    // Paginação
    root.addEventListener("click", (e) => {
      const b = e.target.closest("[data-demo-pager] [data-page]");
      if (!b || b.disabled) return;
      const section = b.closest(".edit-panel__section")?.id;
      if (!section) return;
      pageState[section] = Number(b.dataset.page) || 1;
      renderAll(root);
    });

    renderAll(root);
  }

  window.IcReportDemo = { prepare, attach, render: renderAll };
})();
