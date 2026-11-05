// Aba "Contratação" (Subscription) do Faturamento: escolher quais equipamentos estão inscritos
// em cada item do catálogo, aplicar cupom, gerar a chave da API e acompanhar a estimativa da
// próxima cobrança.
// Nada é aplicado aqui: tudo fica como alteração pendente (IcBillingData.pending) e só o botão
// Salvar grava (IcBillingData.savePending). Cada alteração de inscrição entra na próxima fatura
// como ajuste proporcional (ver project / buildCurrent em data.js).
(function () {
  "use strict";

  const D = () => window.IcBillingData;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const signedMoney = (v) => (v < 0 ? "− " : v > 0 ? "+ " : "") + D().money(Math.abs(v));

  const toggles = () => D().pending.toggles; // { idDoEquipamento: true|false } só com o que difere do salvo
  const expanded = new Set(); // itens com a lista de equipamentos aberta

  const isOn = (dev) => (dev.id in toggles() ? toggles()[dev.id] : dev.subscribed);

  function setDevice(dev, on) {
    if (on === dev.subscribed) delete toggles()[dev.id];
    else toggles()[dev.id] = on;
  }

  // Redesenha esta aba e as demais (prévia) e atualiza a barra de salvar.
  function refresh() {
    if (window.IcFaturamentoInvoices?.refresh) window.IcFaturamentoInvoices.refresh();
    else render();
  }

  // Junta, por alteração, as linhas de ajuste que ela gerou.
  function groupAdjustments(items) {
    const groups = [];
    items.filter((it) => it.adj).forEach((it) => {
      let g = groups.find((x) => x.changeId === it.changeId);
      if (!g) { g = { changeId: it.changeId, name: it.name, desc: it.desc, amount: 0 }; groups.push(g); }
      g.amount += it.subtotal;
    });
    return groups;
  }

  function topicHtml(r) {
    const total = r.devices.length;
    const onCount = r.devices.filter(isOn).length;
    const changed = onCount !== r.contracted;
    const partial = onCount > 0 && onCount < total;
    const open = expanded.has(r.key);
    const devs = r.devices.map((d) => {
      const on = isOn(d);
      return `<label class="fbill-dev${on ? "" : " is-off"}${d.id in toggles() ? " is-changed" : ""}"><input type="checkbox" data-dev="${esc(d.id)}" ${on ? "checked" : ""}><span>${esc(d.name)}</span></label>`;
    }).join("");
    return `
      <div class="fbill-topic${open ? " is-open" : ""}" data-key="${r.key}">
        <div class="fbill-topic__head">
          <input type="checkbox" class="fbill-topic__all" data-all ${onCount === total && total ? "checked" : ""} ${partial ? 'data-partial="1"' : ""} aria-label="Selecionar todos">
          <div class="fbill-topic__title">
            <div class="fbill-invoice__item-name">${esc(r.name)}</div>
            <div class="fbill-invoice__item-desc"><span>${esc(r.desc)}</span>${r.key === "api" ? " · <span>1 por equipamento de irrigação</span>" : ""}</div>
          </div>
          <div class="fbill-topic__count${changed ? " is-changed" : ""}">${esc(D().tr("{a} de {b} inscritos", { a: onCount, b: total }))}</div>
          <div class="fbill-topic__num">${D().money(r.price)}</div>
          <div class="fbill-topic__num fbill-topic__num--strong">${D().money(onCount * r.price)}</div>
          <button type="button" class="fbill-topic__toggle" data-expand aria-label="Ver equipamentos"><i class="fa-solid fa-chevron-down"></i></button>
        </div>
        <div class="fbill-topic__body"><div class="fbill-devs">${devs}</div></div>
      </div>`;
  }

  function render() {
    const box = $("fbillContract");
    if (!box || !D()) return;
    const cycle = D().getCycle();
    const rows = D().getContract();
    const left = D().daysBetween(new Date(), cycle.end);
    const inv = D().getInvoices()[0];

    const topics = rows.map(topicHtml).join("");
    const coupon = window.IcFaturamentoCoupon?.html?.(inv) || `<div class="fbill-coupon__scope">Cupons só podem ser aplicados em faturas em aberto.</div>`;

    box.innerHTML = `
      <div class="fbill-card">
        <div class="fbill-card__head">
          <h3 class="fbill-card__title"><i class="fa-solid fa-rotate"></i> Ciclo vigente</h3>
        </div>
        <div class="fbill-cycle">
          <span>${esc(D().fmtShort(cycle.start))} → ${esc(D().fmtShort(cycle.end))}</span>
          <span class="fbill-cycle__left">${esc(D().tr(left === 1 ? "restam {n} dia" : "restam {n} dias", { n: left }))}</span>
        </div>
      </div>

      <div class="fbill-card">
        <div class="fbill-card__head">
          <h3 class="fbill-card__title"><i class="fa-solid fa-sliders"></i> Equipamentos contratados</h3>
        </div>
        <div class="fbill-topic__legend">
          <span></span><span>Item</span><span>Contratados</span><span>Valor anual unit.</span><span>Subtotal anual</span><span></span>
        </div>
        <div class="fbill-topics">${topics}</div>
        <p class="fbill-hint">Ao desinscrever um equipamento, o período já utilizado até hoje continua cobrado: só os dias restantes do ciclo são creditados. Ao inscrever, cobramos o valor proporcional até o próximo ciclo.</p>
      </div>

      <div class="fbill-card fbill-card--coupon">
        <div class="fbill-card__head">
          <h3 class="fbill-card__title"><i class="fa-solid fa-ticket"></i> Cupom de desconto</h3>
        </div>
        ${coupon}
      </div>

      <div class="fbill-card" id="fbillImpact"></div>

      <div class="fbill-card" id="fbillChangeLog"></div>`;

    box.querySelectorAll("[data-partial]").forEach((el) => { el.indeterminate = true; });
    renderImpact();
    renderChanges();
  }

  function renderImpact() {
    const box = $("fbillImpact");
    if (!box) return;
    const proj = D().project();
    const edited = D().hasPending();
    const delta = proj.after.total - proj.before.total;
    const draftLines = groupAdjustments(proj.after.items.filter((it) => String(it.changeId).startsWith("draft:")));
    const arrow = (a, b, fmt) => { const f = fmt || D().money; return edited ? `${f(a)} → ${f(b)}` : f(b); };
    // Desconto do cupom (acompanha a seleção de equipamentos em edição).
    const coupons = proj.after.coupons;
    // Subtítulos: período da renovação anual e dias restantes do ciclo atual.
    const cycleEnd = proj.cycle.end;
    const renewalEnd = new Date(cycleEnd.getFullYear() + 1, cycleEnd.getMonth(), cycleEnd.getDate());
    const renewalRange = `${D().fmtShort(cycleEnd)} → ${D().fmtShort(renewalEnd)}`;
    const daysLeft = D().daysBetween(new Date(), cycleEnd);
    const leftText = D().tr(daysLeft === 1 ? "{n} dia restante" : "{n} dias restantes", { n: daysLeft });
    const negMoney = (v) => (v > 0 ? "− " + D().money(v) : D().money(0));

    const lines = draftLines.map((it) => `
      <div class="fbill-impact__line">
        <div><div class="fbill-impact__name">${esc(it.name)}</div><div class="fbill-impact__desc">${esc(it.desc)}</div></div>
        <div class="fbill-impact__amount">${signedMoney(it.amount)}</div>
      </div>`).join("");

    box.innerHTML = `
      <div class="fbill-card__head">
        <h3 class="fbill-card__title"><i class="fa-solid fa-chart-line"></i> Estimativa da próxima cobrança</h3>
      </div>
      <div class="fbill-impact__grid">
        <div class="fbill-impact__cell"><div class="fbill-impact__label">Renovação anual</div><div class="fbill-impact__value">${arrow(proj.before.renewalTotal, proj.after.renewalTotal)}</div><div class="fbill-impact__sub">${esc(renewalRange)}</div></div>
        <div class="fbill-impact__cell"><div class="fbill-impact__label">Ajuste do ciclo atual</div><div class="fbill-impact__value">${signedMoney(proj.after.adjustTotal)}</div><div class="fbill-impact__sub">${esc(leftText)}</div></div>
        <div class="fbill-impact__cell"><div class="fbill-impact__label">Desconto do cupom</div><div class="fbill-impact__value">${coupons.length ? negMoney(proj.after.discount) : "—"}</div>${coupons.length ? `<div class="fbill-impact__sub">${esc(D().tr(coupons.length === 1 ? "{n} cupom aplicado" : "{n} cupons aplicados", { n: coupons.length }))}</div>` : ""}</div>
        <div class="fbill-impact__cell"><div class="fbill-impact__label">${esc(D().tr("Total da fatura de {d}", { d: D().fmtDayMonth(cycleEnd) }))}</div><div class="fbill-impact__value">${arrow(proj.before.total, proj.after.total)}${edited ? ` <span class="fbill-impact__delta${delta < 0 ? " is-neg" : ""}">(${signedMoney(delta)})</span>` : ""}</div></div>
      </div>
      ${draftLines.length ? `<div class="fbill-impact__lines">${lines}</div>` : ""}`;
  }

  // Alterações a aplicar: tudo o que o botão Salvar vai gravar (some quando não há nada pendente).
  function pendingItems() {
    const items = [];
    const entries = D().pendingEntries();
    const proj = D().project();
    groupAdjustments(proj.after.items.filter((it) => String(it.changeId).startsWith("draft:"))).forEach((g) => {
      const idx = Number(String(g.changeId).split(":")[1]);
      const names = (entries[idx]?.devices || []).map((d) => d.name).join(", ");
      items.push({ icon: "fa-sliders", title: g.name, desc: g.desc, extra: names, amount: g.amount });
    });
    const p = D().pending;
    if (p.coupons !== undefined) {
      const saved = D().savedCouponCodes();
      p.coupons.filter((c) => !saved.includes(c)).forEach((code) => {
        const coupon = D().findCoupon(code);
        items.push({ icon: "fa-ticket", title: D().tr("Cupom {c} aplicado", { c: code }), desc: coupon ? D().couponLabel(coupon) : "" });
      });
      saved.filter((c) => !p.coupons.includes(c)).forEach((code) => items.push({ icon: "fa-ticket", title: D().tr("Cupom {c} removido", { c: code }) }));
    }
    if (p.method !== undefined) {
      items.push({ icon: "fa-wallet", title: D().tr("Método de pagamento alterado para {m}", { m: D().tr(D().METHOD_LABELS[p.method] || p.method) }) });
    }
    const keyPlan = D().apiKeyPlan();
    if (keyPlan === "generate") items.push({ icon: "fa-key", title: "Nova chave da API será gerada" });
    else if (keyPlan === "remove") items.push({ icon: "fa-key", title: "Chave da API será removida" });
    (window.IcFaturamentoPending?.() || []).forEach((it) => items.push(it));
    return items;
  }

  function renderChanges() {
    const box = $("fbillChangeLog");
    if (!box) return;
    const items = pendingItems();
    box.style.display = items.length ? "" : "none";
    box.innerHTML = `
      <div class="fbill-card__head">
        <h3 class="fbill-card__title"><i class="fa-solid fa-list-check"></i> Alterações a aplicar</h3>
      </div>
      ${items.map((it) => `
        <div class="fbill-impact__line">
          <div>
            <div class="fbill-impact__name"><i class="fa-solid ${it.icon || "fa-circle"} fbill-change__icon"></i> ${esc(it.title)}</div>
            ${it.desc ? `<div class="fbill-impact__desc">${esc(it.desc)}</div>` : ""}
            ${it.extra ? `<div class="fbill-impact__desc">${esc(it.extra)}</div>` : ""}
          </div>
          ${it.amount !== undefined ? `<div class="fbill-impact__amount">${signedMoney(it.amount)}</div>` : ""}
        </div>`).join("")}`;
  }

  function onClick(e) {
    const expand = e.target.closest("[data-expand]");
    if (expand) {
      const key = expand.closest(".fbill-topic").dataset.key;
      if (expanded.has(key)) expanded.delete(key); else expanded.add(key);
      expand.closest(".fbill-topic").classList.toggle("is-open", expanded.has(key));
      return;
    }
  }

  function onChange(e) {
    const row = D().getContract();
    if (e.target.matches("[data-dev]")) {
      const dev = row.flatMap((r) => r.devices).find((d) => d.id === e.target.dataset.dev);
      if (dev) setDevice(dev, e.target.checked);
      refresh();
      return;
    }
    if (e.target.matches("[data-all]")) {
      const key = e.target.closest(".fbill-topic").dataset.key;
      row.find((r) => r.key === key)?.devices.forEach((d) => setDevice(d, e.target.checked));
      refresh();
    }
  }

  function bind() {
    const box = $("fbillContract");
    if (!box || box.dataset.bound) return;
    box.dataset.bound = "1";
    box.addEventListener("click", onClick);
    box.addEventListener("change", onChange);
  }

  window.IcFaturamentoContract = {
    render() { bind(); render(); },
    renderChanges,
    // Ao abrir o painel: volta a lista de equipamentos ao estado inicial.
    reset() { expanded.clear(); },
  };
})();
