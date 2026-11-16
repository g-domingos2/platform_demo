// assets/js/core/demo-config-history.js
// DEMO — Histórico de Configurações "de verdade" na tela Editar equipamento.
//
// O que faz:
//  - Cada clique em Salvar gera uma linha no Histórico de Configurações do
//    equipamento (data, usuário, status e o detalhe do que foi salvo).
//  - Ao abrir a linha aparece a configuração completa que foi salva (como na
//    plataforma). Coordenadas (centro, referência do ângulo 0°) são links que
//    abrem o Google Maps.
//  - Cada configuração salva leva um e-mail fictício de usuário.
//  - Favoritar funciona e a aba Favoritos lista as configurações marcadas.
//  - Paginação e "itens por página" usam a quantidade real.
//
// Onde fica guardado: window.IcDemoHistory.log (localStorage), junto com o
// histórico de comandos (chave "ic_demo_userlog_v1").
//
// API: window.IcConfigHistory
//   attach(panel, equipId, opts)  → liga a tabela ao equipamento (ao abrir a edição)
//   record(panel, equipId, opts)  → grava a configuração atual (ao salvar)
//   opts.extraSections: () => [{ title | sectionId, fields: [{ label, value }] }]
//   opts.skipSelector: campos que não entram na fotografia
(function () {
  "use strict";

  const CONFIRM_MS = 3500; // tempo até o equipamento "confirmar" o recebimento
  const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const pad = (n) => String(n).padStart(2, "0");
  const fmtDate = (ms) => {
    const d = new Date(ms);
    return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const log = () => window.IcDemoHistory?.log || null;

  // E-mails fictícios: cada configuração salva sai em nome de um deles.
  const FAKE_USERS = [
    "joao.pereira@fazendademo.com.br",
    "marina.costa@fazendademo.com.br",
    "carlos.almeida@fazendademo.com.br",
    "ana.ribeiro@fazendademo.com.br",
    "operador.turno1@fazendademo.com.br",
    "gerente.irrigacao@fazendademo.com.br",
    "tecnico.campo@fazendademo.com.br",
  ];
  const pickUser = (avoid) => {
    const pool = FAKE_USERS.filter((u) => u !== avoid);
    return pool[Math.floor(Math.random() * pool.length)];
  };

  // Estado por painel (página atual, itens por página, linhas abertas)
  const stateByPanel = new WeakMap();
  const getState = (panel) => {
    if (!stateByPanel.has(panel)) stateByPanel.set(panel, { equipId: null, page: 1, pageSize: 10, open: new Set(), opts: {}, timer: null });
    return stateByPanel.get(panel);
  };

  // ------------------------------------------------------------ fotografia
  // Lê o formulário de edição e devolve [{ title, fields: [{ key, group, label, value }] }].
  function cleanLabel(el) {
    if (!el) return "";
    const c = el.cloneNode(true);
    c.querySelectorAll(".edit-panel__tooltip-icon, .edit-panel__req, .equip-required, i, svg, button, input, select").forEach((n) => n.remove());
    return c.textContent.replace(/\s+/g, " ").replace(/^\*\s*/, "").replace(/[:：]\s*$/, "").trim();
  }

  function labelFor(panel, el) {
    if (el.id) {
      const direct = panel.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      const t = cleanLabel(direct);
      if (t) return t;
    }
    const wrap = el.closest(".sc-field, .pivo-edit__field, .edit-panel__field, .edit-panel__field-box, .equip-field, .edit-panel__toggle-row, .edit-panel__switch-row, label");
    if (wrap) {
      const lab = wrap.matches("label") ? wrap : wrap.querySelector("label, .edit-panel__field-box-label, .equip-label, .edit-panel__label");
      const t = cleanLabel(lab);
      if (t) return t;
    }
    return (el.getAttribute("aria-label") || "").trim();
  }

  function valueOf(el) {
    const tag = el.tagName;
    if (tag === "SELECT") {
      const custom = el.closest(".equip-select")?.querySelector(".equip-select__value");
      const txt = (custom?.textContent || el.selectedOptions?.[0]?.textContent || el.value || "").trim();
      return txt;
    }
    if (el.type === "checkbox") return el.checked ? "Habilitado" : "Desabilitado";
    let v = String(el.value ?? "").trim();
    if (v === "") return "";
    const suffix = el.closest(".sc-input-group, .edit-panel__input-group, .edit-panel__input-wrap")?.querySelector(".sc-input-suffix, .edit-panel__input-suffix, .sc-input-addon");
    const unit = (suffix?.textContent || "").trim();
    if (unit && unit.length <= 6) v += unit === "°" || unit === "%" ? unit : ` ${unit}`;
    return v;
  }

  // Campo dentro de um bloco escondido "na mão" (style="display:none") não entra.
  function isManuallyHidden(el, section) {
    let n = el.parentElement;
    while (n && n !== section) {
      if (n.style && n.style.display === "none") return true;
      n = n.parentElement;
    }
    return false;
  }

  function snapshot(panel, opts = {}) {
    const sections = [];
    const configBody = panel.querySelector('.edit-panel__tab-body[data-tab-body="config"]') || panel;
    configBody.querySelectorAll(".edit-panel__section").forEach((section) => {
      if (section.closest('.edit-panel__tab-body[data-tab-body="history"]')) return;
      const title = cleanLabel(section.querySelector(".edit-panel__section-head h2, .edit-panel__section-head h3, h2"))
        || cleanLabel(panel.querySelector(`.edit-panel__nav-item[data-target="#${section.id}"]`))
        || "Geral";
      const fields = [];
      const seen = new Set();
      let group = "";
      section.querySelectorAll("h3.pref-section-title, .edit-panel__subsection-title, input, select, textarea").forEach((el) => {
        if (el.matches("h3, .edit-panel__subsection-title")) { group = cleanLabel(el); return; }
        if (["hidden", "file", "button", "submit", "radio"].includes(el.type) && !(el.type === "radio" && el.checked)) return;
        if (isManuallyHidden(el, section)) return;
        if (opts.skipSelector && el.matches(opts.skipSelector)) return;
        const label = el.type === "radio" ? cleanLabel(el.closest("fieldset, .edit-panel__radio-group")?.querySelector("legend, .edit-panel__label")) || labelFor(panel, el) : labelFor(panel, el);
        if (!label) return;
        const value = el.type === "radio" ? cleanLabel(el.closest("label")) || el.value : valueOf(el);
        const key = `${section.id || title}|${el.id || el.name || `${group}/${label}`}`;
        if (seen.has(key)) return;
        seen.add(key);
        fields.push({ key, group, label, value });
      });
      if (fields.length) sections.push({ id: section.id || "", title, fields });
    });
    let extra = [];
    try { extra = (typeof opts.extraSections === "function" ? opts.extraSections() : opts.extraSections) || []; } catch (_) { extra = []; }
    extra.forEach((sec) => {
      const fields = (sec.fields || []).map((f) => ({ key: `x:${sec.sectionId || sec.title}|${f.label}`, group: f.group || "", label: f.label, value: String(f.value ?? "") }));
      if (!fields.length) return;
      // sectionId: os campos entram numa seção que já existe no formulário.
      const host = sec.sectionId ? sections.find((x) => x.id === sec.sectionId) : null;
      if (host) {
        const at = Number.isInteger(sec.after) ? Math.min(host.fields.length, sec.after) : host.fields.length;
        host.fields.splice(at, 0, ...fields.map((f) => ({ ...f, group: f.group || host.fields[Math.max(0, at - 1)]?.group || "" })));
      } else sections.push({ id: "", title: sec.title || "Outros", fields });
    });
    return sections;
  }

  function diff(prev, next) {
    const before = new Map();
    (prev || []).forEach((s) => s.fields.forEach((f) => before.set(f.key, { ...f, section: s.title })));
    const changes = [];
    const nextKeys = new Set();
    (next || []).forEach((s) => s.fields.forEach((f) => {
      nextKeys.add(f.key);
      const old = before.get(f.key);
      if (!old) { if (f.value !== "") changes.push({ section: s.title, label: f.label, from: "", to: f.value }); return; }
      if (old.value !== f.value) changes.push({ section: s.title, label: f.label, from: old.value, to: f.value });
    }));
    before.forEach((f, key) => {
      if (!nextKeys.has(key) && f.value !== "") changes.push({ section: f.section, label: f.label, from: f.value, to: "" });
    });
    return changes;
  }

  // ------------------------------------------------------------ gravação
  function ensureBaseline(panel, st) {
    const L = log();
    if (!L || st.equipId == null) return;
    if (L.configs(st.equipId).length) return;
    const equip = window.IcDemoHistory?.findEquipment?.(st.equipId)?.equip;
    const created = equip?.createdAt ? new Date(equip.createdAt).getTime() : NaN;
    const rec = L.addConfig(st.equipId, {
      user: pickUser(),
      sections: snapshot(panel, st.opts),
      changes: [],
      status: { controller: "received", hardware: "received", gps: "received", pump: "not_sent" },
      snapshot: { initial: true },
    });
    // A primeira linha é a configuração com que o equipamento foi criado.
    if (rec && Number.isFinite(created)) {
      rec.date = Math.min(created, Date.now());
      rec.confirmed = true;
      L.touch?.(st.equipId);
    } else if (rec) rec.confirmed = true;
  }

  function record(panel, equipId, opts) {
    const L = log();
    if (!L || !panel || equipId == null) return null;
    const st = getState(panel);
    if (opts) st.opts = opts;
    st.equipId = String(equipId);
    const sections = snapshot(panel, st.opts);
    const last = L.configs(st.equipId)[0] || null;
    // "changes" serve só para saber se a bomba recebeu configuração nova.
    const changes = last ? diff(last.sections, sections) : [];
    const pumpTouched = changes.some((c) => /bomb/i.test(c.section));
    const rec = L.addConfig(st.equipId, {
      user: pickUser(last?.user),
      sections,
      changes: [],
      status: { controller: "waiting", hardware: "waiting", gps: "waiting", pump: pumpTouched ? "waiting" : "not_sent" },
    });
    st.page = 1;
    render(panel);
    scheduleConfirm(panel);
    return rec;
  }

  // "Aguardando confirmação" vira "Recebido" alguns segundos depois de salvar.
  function effectiveStatus(rec) {
    const s = rec.status || {};
    const done = rec.confirmed || Date.now() - rec.date >= CONFIRM_MS;
    const fix = (v) => (v === "waiting" && done ? "received" : v || "not_sent");
    return { controller: fix(s.controller), hardware: fix(s.hardware), gps: fix(s.gps), pump: fix(s.pump) };
  }
  function scheduleConfirm(panel) {
    const st = getState(panel);
    clearTimeout(st.timer);
    st.timer = setTimeout(() => { if (panel.isConnected) render(panel); }, CONFIRM_MS + 100);
  }

  // ------------------------------------------------------------ desenho
  const STATUS_HTML = {
    received: '<span class="status-dot dot-received"></span> Recebido',
    waiting: '<span class="status-dot dot-waiting"></span> Aguardando confirmação',
    not_sent: '<span class="status-dot dot-not-sent"></span> Não enviado',
  };

  // "-12.404179, -45.558844" → link para o Google Maps + botão de copiar
  const COORD_RE = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;
  function valueHtml(value) {
    if (value === "") return "—";
    const m = COORD_RE.exec(value);
    if (m && Math.abs(parseFloat(m[1])) <= 90 && Math.abs(parseFloat(m[2])) <= 180) {
      const q = `${m[1]},${m[2]}`;
      return `<a class="ic-cfg-hist__map-link" href="https://www.google.com/maps?q=${encodeURIComponent(q)}" target="_blank" rel="noopener noreferrer" title="Abrir no Google Maps">${esc(`${m[1]}, ${m[2]}`)}</a>`
        + `<button type="button" class="ic-cfg-hist__copy" data-cfg-copy="${esc(`${m[1]}, ${m[2]}`)}" title="Copiar coordenadas" aria-label="Copiar coordenadas"><i class="fa-regular fa-copy"></i></button>`;
    }
    return esc(value);
  }

  // Detalhe da linha: a configuração completa que foi salva, seção por seção.
  function detailsHtml(rec) {
    const parts = (rec.sections || []).map((sec) => {
      let group = null;
      const items = sec.fields.map((f) => {
        let head = "";
        if ((f.group || "") !== (group ?? "")) {
          group = f.group || "";
          if (group) head = `<div class="edit-panel__history-details-subtitle">${esc(group)}</div>`;
        }
        return `${head}<div class="edit-panel__history-details-item"><span class="edit-panel__history-details-key">${esc(f.label)}:</span> <span>${valueHtml(f.value)}</span></div>`;
      }).join("");
      return `<div class="edit-panel__history-details-section"><h4>${esc(sec.title)}</h4><div class="edit-panel__history-details-grid">${items}</div></div>`;
    });
    if (!parts.length) parts.push('<div class="ic-cfg-hist__note">Sem dados para esta configuração.</div>');
    return `<div class="edit-panel__history-details">${parts.join("")}</div>`;
  }

  function rowsHtml(list, cols, st) {
    return list.map((rec) => {
      const s = effectiveStatus(rec);
      const open = st.open.has(rec.id);
      const statusCells = cols >= 8
        ? `<td>${STATUS_HTML[s.controller]}</td><td>${STATUS_HTML[s.hardware]}</td><td>${STATUS_HTML[s.gps]}</td><td>${STATUS_HTML[s.pump]}</td>`
        : `<td>${STATUS_HTML[s.controller]}</td>`;
      return `
        <tr class="edit-panel__history-row" data-cfg-id="${esc(rec.id)}">
          <td><button class="edit-panel__history-expand-btn" type="button" data-cfg-toggle="${esc(rec.id)}" aria-expanded="${open}" aria-label="Ver detalhes"><i class="fa-solid ${open ? "fa-minus" : "fa-plus"}"></i></button></td>
          <td>${fmtDate(rec.date)}</td>
          <td>${esc(rec.user || "—")}</td>
          ${statusCells}
          <td><div class="table-actions"><i class="${rec.favorite ? "fa-solid" : "fa-regular"} fa-star ic-cfg-hist__star${rec.favorite ? " is-on" : ""}" role="button" tabindex="0" data-cfg-fav="${esc(rec.id)}" title="${rec.favorite ? "Remover dos favoritos" : "Favoritar"}"></i></div></td>
        </tr>
        <tr class="edit-panel__history-details-row" data-cfg-details="${esc(rec.id)}" style="display:${open ? "table-row" : "none"};">
          <td colspan="${cols}">${open ? detailsHtml(rec) : ""}</td>
        </tr>`;
    }).join("");
  }

  function ensureTbody(table) {
    let tbody = table.querySelector(":scope > tbody");
    if (!tbody) { tbody = document.createElement("tbody"); table.appendChild(tbody); }
    return tbody;
  }

  function renderPager(container, st, total) {
    let pager = container.querySelector(":scope > .edit-panel__pagination");
    if (!pager) {
      pager = document.createElement("div");
      pager.className = "edit-panel__pagination";
      container.appendChild(pager);
    }
    const pages = Math.max(1, Math.ceil(total / st.pageSize));
    st.page = Math.min(Math.max(1, st.page), pages);
    const from = total ? (st.page - 1) * st.pageSize + 1 : 0;
    const to = Math.min(total, st.page * st.pageSize);
    const nums = [];
    if (pages <= 7) for (let i = 1; i <= pages; i++) nums.push(i);
    else {
      nums.push(1);
      const a = Math.max(2, st.page - 1);
      const b = Math.min(pages - 1, st.page + 1);
      if (a > 2) nums.push("…");
      for (let i = a; i <= b; i++) nums.push(i);
      if (b < pages - 1) nums.push("…");
      nums.push(pages);
    }
    pager.innerHTML = `
      <span>${from}-${to} de ${total} ${total === 1 ? "item" : "itens"}</span>
      <div class="edit-panel__pagination-pages">
        <button class="edit-panel__pagination-btn" type="button" data-cfg-page="${st.page - 1}" aria-label="Página anterior"${st.page <= 1 ? " disabled" : ""}><i class="fa-solid fa-chevron-left"></i></button>
        ${nums.map((n) => (n === "…" ? '<span style="margin: 0 4px;">...</span>' : `<button class="edit-panel__pagination-btn${n === st.page ? " is-active" : ""}" type="button" data-cfg-page="${n}">${n}</button>`)).join("")}
        <button class="edit-panel__pagination-btn" type="button" data-cfg-page="${st.page + 1}" aria-label="Próxima página"${st.page >= pages ? " disabled" : ""}><i class="fa-solid fa-chevron-right"></i></button>
      </div>
      <select class="edit-panel__pagination-select" data-cfg-page-size aria-label="Itens por página">
        ${[10, 20, 50].map((n) => `<option value="${n}"${n === st.pageSize ? " selected" : ""}>${n} / página</option>`).join("")}
      </select>`;
  }

  function renderSection(section, list, st, withPager, emptyText) {
    if (!section) return;
    const container = section.querySelector(".edit-panel__history-table-container");
    const table = container?.querySelector(":scope > table.edit-panel__history-table");
    if (!container || !table) return;
    const cols = table.querySelectorAll(":scope > thead th").length || 8;
    const tbody = ensureTbody(table);
    const total = list.length;
    let pageList = list;
    if (withPager) {
      const pages = Math.max(1, Math.ceil(total / st.pageSize));
      st.page = Math.min(Math.max(1, st.page), pages);
      pageList = list.slice((st.page - 1) * st.pageSize, st.page * st.pageSize);
    }
    tbody.innerHTML = rowsHtml(pageList, cols, st);
    let empty = container.querySelector(":scope > .edit-panel__history-no-data");
    if (!total) {
      if (!empty) {
        empty = document.createElement("div");
        empty.className = "edit-panel__history-no-data";
        empty.innerHTML = `<i class="fa-solid fa-inbox"></i><span></span>`;
        table.insertAdjacentElement("afterend", empty);
      }
      const span = empty.querySelector("span");
      if (span) span.textContent = emptyText;
      empty.style.display = "";
    } else if (empty) empty.style.display = "none";
    if (withPager) renderPager(container, st, total);
  }

  function render(panel) {
    const L = log();
    const st = getState(panel);
    if (!L || st.equipId == null) return;
    const all = L.configs(st.equipId);
    const histBody = panel.querySelector('.edit-panel__tab-body[data-tab-body="history"]') || panel;
    const sections = [...histBody.querySelectorAll(".edit-panel__section")];
    const listSection = sections.find((s) => /HistoryList$/i.test(s.id)) || sections[0];
    const favSection = sections.find((s) => /HistoryFavs$/i.test(s.id)) || sections[1];
    renderSection(listSection, all, st, true, "Nenhuma configuração salva ainda.");
    if (favSection && favSection !== listSection) renderSection(favSection, all.filter((c) => c.favorite), st, false, "Nenhuma configuração favorita.");
    if (all.some((c) => !c.confirmed && Date.now() - c.date < CONFIRM_MS)) scheduleConfirm(panel);
  }

  function bind(panel) {
    if (panel.dataset.cfgHistBound) return;
    panel.dataset.cfgHistBound = "1";
    panel.addEventListener("click", (e) => {
      const st = getState(panel);
      const toggle = e.target.closest("[data-cfg-toggle]");
      if (toggle) {
        const id = toggle.getAttribute("data-cfg-toggle");
        if (st.open.has(id)) st.open.delete(id); else st.open.add(id);
        render(panel);
        return;
      }
      const fav = e.target.closest("[data-cfg-fav]");
      if (fav) {
        const on = log()?.toggleFavorite(st.equipId, fav.getAttribute("data-cfg-fav"));
        render(panel);
        window.IcNotify?.success?.(on ? "Configuração adicionada aos favoritos." : "Configuração removida dos favoritos.", 1800);
        return;
      }
      const copy = e.target.closest("[data-cfg-copy]");
      if (copy) {
        const text = copy.getAttribute("data-cfg-copy");
        Promise.resolve(navigator.clipboard?.writeText?.(text))
          .then(() => window.IcNotify?.success?.("Coordenadas copiadas.", 1500))
          .catch(() => window.IcNotify?.error?.("Não foi possível copiar.", 2000));
        return;
      }
      const pageBtn = e.target.closest("[data-cfg-page]");
      if (pageBtn && !pageBtn.disabled) {
        st.page = parseInt(pageBtn.getAttribute("data-cfg-page"), 10) || 1;
        render(panel);
        return;
      }
      if (e.target.closest(".edit-panel__history-table-actions .fa-rotate-right")) render(panel);
    });
    panel.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.matches?.("[data-cfg-fav]")) { e.preventDefault(); e.target.click(); }
    });
    panel.addEventListener("change", (e) => {
      if (!e.target.matches?.("[data-cfg-page-size]")) return;
      const st = getState(panel);
      st.pageSize = parseInt(e.target.value, 10) || 10;
      st.page = 1;
      render(panel);
    });
  }

  function attach(panel, equipId, opts) {
    if (!panel || equipId == null || !log()) return;
    const st = getState(panel);
    if (String(st.equipId) !== String(equipId)) { st.page = 1; st.open = new Set(); }
    st.equipId = String(equipId);
    if (opts) st.opts = opts;
    bind(panel);
    ensureBaseline(panel, st);
    render(panel);
  }

  window.IcConfigHistory = { attach, record, render, snapshot, diff };
})();
