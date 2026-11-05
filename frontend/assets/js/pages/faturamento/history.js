// Aba "Histórico" do Faturamento: documenta as alterações do billing desde o início.
// Segue o modelo do histórico dos equipamentos (linha expansível com data, usuário e resumo; detalhes
// em seções de chave/valor). Os registros vêm de IcBillingData.getHistory (uma entrada por Salvar).
(function () {
  "use strict";

  const D = () => window.IcBillingData;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const signedMoney = (v) => (v < 0 ? "− " : v > 0 ? "+ " : "") + D().money(Math.abs(v));

  const expanded = new Set();
  let seeded = false; // a entrada mais recente abre na primeira renderização

  function dateTime(iso) {
    const d = new Date(iso);
    const time = new Intl.DateTimeFormat(D().locale(), { hour: "2-digit", minute: "2-digit" }).format(d);
    return `${D().fmtShort(d)} ${time}`;
  }

  const catalogName = (key) => D().CATALOG.find((c) => c.key === key)?.name || key;

  // Alterações de uma entrada agrupadas por seção: [{ title, items: [{ k, v }] }].
  function sectionsOf(entry) {
    const groups = new Map();
    const add = (title, k, v) => {
      if (!groups.has(title)) groups.set(title, []);
      groups.get(title).push({ k, v });
    };
    (entry.changes || []).forEach((c) => {
      if (c.type === "subscribed") {
        D().CATALOG.filter((item) => (c.counts[item.key] || 0) > 0).forEach((item) => add("Assinatura", item.name, D().tr("{n} inscritos", { n: c.counts[item.key] })));
      } else if (c.type === "subscription") {
        add("Assinatura", D().tr("Ajuste proporcional: {q} {item}", { q: (c.delta > 0 ? "+" : "") + c.delta, item: catalogName(c.key) }), `${c.devices.join(", ")} · ${signedMoney(c.amount)}`);
      } else if (c.type === "coupon") {
        const coupon = D().findCoupon(c.code);
        add("Cupom de desconto", c.code, c.action === "applied" ? (coupon ? D().couponLabel(coupon) : "") : D().tr("Removido"));
      } else if (c.type === "method") {
        add("Método de Pagamento", D().tr("Método"), D().tr(D().METHOD_LABELS[c.to] || c.to));
      } else if (c.type === "apikey") {
        add("Chave da API", D().tr("Chave"), D().tr("Nova chave gerada"));
      } else if (c.type === "card") {
        const word = { added: "Adicionado", updated: "Atualizado", removed: "Removido" }[c.action];
        add("Cartões", D().tr("Cartão •••• {l}", { l: c.last4 }), D().tr(word));
      } else if (c.type === "billing") {
        add("Dados de faturamento", D().tr("Endereço e informações"), D().tr("Alterados"));
      } else if (c.type === "invoice") {
        add("Fatura", D().tr("Número"), c.number);
        const inv = D().getInvoice(c.number);
        if (inv) add("Fatura", D().tr("Valor"), `${D().money(inv.total)} · ${D().tr("Paga")}`);
      }
    });
    return [...groups.entries()].map(([title, items]) => ({ title, items }));
  }

  function detailsHtml(entry) {
    return sectionsOf(entry).map((sec) => `
      <div class="edit-panel__history-details-section">
        <h4>${esc(sec.title)}</h4>
        <div class="edit-panel__history-details-grid">
          ${sec.items.map((it) => `<div class="edit-panel__history-details-item"><span class="edit-panel__history-details-key">${esc(it.k)}</span><span>${esc(it.v)}</span></div>`).join("")}
        </div>
      </div>`).join("");
  }

  function render() {
    const body = $("fbillHistoryBody");
    if (!body || !D()) return;
    const entries = D().getHistory();
    if (!seeded && entries.length) { expanded.add(entries[0].id); seeded = true; }

    body.innerHTML = entries.map((entry) => {
      const open = expanded.has(entry.id);
      const n = (entry.changes || []).length;
      return `
        <tr class="edit-panel__history-row" data-row-id="${esc(entry.id)}">
          <td><button class="edit-panel__history-expand-btn" type="button" data-fbill-toggle="${esc(entry.id)}" aria-label="Ver detalhes"><i class="fa-solid ${open ? "fa-minus" : "fa-plus"}"></i></button></td>
          <td>${esc(dateTime(entry.at))}</td>
          <td>${esc(entry.user)}</td>
          <td><span>${esc(entry.title)}</span> · <span>${esc(D().tr(n === 1 ? "{n} alteração" : "{n} alterações", { n }))}</span></td>
        </tr>
        <tr class="edit-panel__history-details-row" id="fbillh-${esc(entry.id)}" style="display:${open ? "table-row" : "none"};">
          <td colspan="4"><div class="edit-panel__history-details">${detailsHtml(entry)}</div></td>
        </tr>`;
    }).join("");
  }

  function bind() {
    const body = $("fbillHistoryBody");
    if (!body || body.dataset.bound) return;
    body.dataset.bound = "1";
    body.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-fbill-toggle]");
      if (!btn) return;
      const id = btn.dataset.fbillToggle;
      if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
      const row = $("fbillh-" + id);
      if (row) row.style.display = expanded.has(id) ? "table-row" : "none";
      const icon = btn.querySelector("i");
      if (icon) icon.className = expanded.has(id) ? "fa-solid fa-minus" : "fa-solid fa-plus";
    });
    document.querySelector("#faturamentoPanel [data-fbill-history-refresh]")?.addEventListener("click", render);
  }

  window.IcFaturamentoHistory = {
    render() { bind(); render(); },
    reset() { expanded.clear(); seeded = false; },
  };
})();
