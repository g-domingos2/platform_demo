// Dados e regras de cálculo do faturamento (mock, sem backend).
//
// Fonte única para o overlay de Faturamento e para as páginas de fatura/recibo
// (que abrem em outra aba e por isso carregam este mesmo arquivo).
// Em produção, catálogo/preços/faturas/cupons vêm da API (Stripe + cadastro).
(function () {
  "use strict";

  const STORE = {
    coupon: "ic:faturamento:coupon",
    billing: "ic:faturamento:billing",
    method: "ic:faturamento:method",
    status: "ic:faturamento:status", // só para demonstração: "pending" | "overdue" | "paid"
    apiKey: "ic:faturamento:apikey", // chave da API da fazenda (mock: em produção é gerada e guardada no servidor)
    history: "ic:faturamento:history", // histórico de alterações do billing (uma entrada por Salvar)
    changes: "ic:faturamento:changes", // alterações de contratação (contratar/descontratar) do ciclo vigente
  };

  // ---------------------------------------------------------------------------
  // Catálogo de cobrança: sempre por equipamento (Irricontrol One é a plataforma).
  // Preços anuais por equipamento (editar aqui). Por ora são só estes itens.
  // ---------------------------------------------------------------------------
  const DESC_IRRIGATION = "Automação e controle remoto de equipamentos de irrigação";
  const CATALOG = [
    { key: "smartconnect", name: "SmartConnect/Nexus",        desc: DESC_IRRIGATION,     price: 1200, irrigation: true },
    { key: "smarttouch",   name: "SmartTouch/UniversalTouch", desc: DESC_IRRIGATION,     price: 1200, irrigation: true },
    { key: "rainstar",     name: "Rainstar",                  desc: DESC_IRRIGATION,     price: 1200, irrigation: true },
    { key: "linestar",     name: "Linestar",                  desc: DESC_IRRIGATION,     price: 1200, irrigation: true },
    { key: "irripump",     name: "Irripump",                  desc: DESC_IRRIGATION,     price: 800 },
    { key: "imeter",       name: "IMeter",                    desc: DESC_IRRIGATION,     price: 800 },
    // Uma API para cada equipamento de irrigação (SmartConnect/Nexus, SmartTouch/UniversalTouch, Rainstar, Linestar):
    // a inscrição da API é escolhida por equipamento, como nos demais itens.
    { key: "api",          name: "API Irricontrol One",       desc: "Integração de dados", price: 200 },
  ];
  const catalogItem = (key) => CATALOG.find((c) => c.key === key);

  // Equipamentos que já começam desativados (sem inscrição), para demonstrar a contratação.
  // { itemDoCatálogo: quantidade }: pegam-se os últimos equipamentos do item, em ordem de nome.
  // A API começa sem nenhum equipamento inscrito.
  const INACTIVE_DEMO = { smartconnect: 5, api: Infinity };

  // Contagem usada quando não há fazenda carregada (páginas de fatura abertas direto).
  const SNAPSHOT_COUNTS = { smartconnect: 24, smarttouch: 3, rainstar: 8, linestar: 1, irripump: 6, imeter: 4 };

  // Faturas anteriores (ciclos fechados). As quantidades de cada uma vêm de storyCounts(), a mesma
  // história que alimenta o Histórico, a Contratação atual e a fatura vigente.
  const PAST_INVOICES = [
    { number: "00000000-0003", yearsAgo: 1, status: "paid", method: "Cartão de crédito", paidDaysBefore: 3 },
    { number: "00000000-0002", yearsAgo: 2, status: "paid", method: "Boleto", paidDaysBefore: 1 },
  ];
  // Cartão de exemplo já cadastrado (mock impessoal): é o usado nas faturas pagas no cartão e na cobrança automática.
  const DEFAULT_CARDS = [{ id: "card-demo", last4: "4242", brand: "visa", name: "Bauer Irricontrol", exp: "12/30" }];
  const CURRENT_NUMBER = "00000000-0004";
  const DUE_DAY = 15;

  // Cupons de referência. "items" restringe o desconto aos itens do catálogo listados
  // (sem "items" vale para a fatura toda). Aplica-se às linhas de renovação e aos ajustes proporcionais.
  const COUPONS = {
    FIRSTYEARDEMO: { type: "percent", value: 100, items: ["smartconnect"], label: "1 ano grátis de SmartConnect/Nexus" },
    PACKAGEDEMO25: { type: "percent", value: 25, items: ["smartconnect", "smarttouch", "rainstar", "linestar"], label: "25% de desconto na anuidade" },
  };

  // Cliente de referência (mock impessoal): preenche o formulário de faturamento enquanto não há dados salvos.
  const CLIENT_FALLBACK = {
    name: "Bauer Irricontrol",
    docType: "cnpj",
    docNumber: "00.000.000/0000-00",
    address: "Av. Brasil, 120",
    city: "Goiânia",
    region: "GO",
    country: "BR",
    postal: "00000-000",
    phone: "123456789",
    email: "bauer@irricontrol.com",
    lang: "pt-BR",
  };

  const ISSUER = { name: "Irricontrol Tecnologia Ltda.", doc: "CNPJ: 00.000.000/0000-00" };

  // ---------------------------------------------------------------------------
  // Idioma e formatação (acompanham o idioma ativo do i18n: pt-BR, en, es)
  // ---------------------------------------------------------------------------
  const MONTHS_SHORT_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const pad2 = (n) => String(n).padStart(2, "0");

  function locale() {
    try { return window.IcI18n?.getLocale?.() || "pt-BR"; } catch (_) { return "pt-BR"; }
  }

  // Traduz uma frase pt-BR pelo dicionário e preenche {variáveis}. Para textos com valores
  // dinâmicos (o tradutor do DOM só casa texto exato), a chave no dicionário é o modelo com {n}, {d}...
  function tr(key, vars) {
    let out = key;
    try { out = window.IcI18n?.t ? window.IcI18n.t(key) : key; } catch (_) { /* mantém pt */ }
    return vars ? String(out).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m)) : out;
  }

  const fmtNumber = (value) => Number(value || 0).toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = (value) => "R$ " + fmtNumber(value);

  function fmtShort(d) {
    if (locale() === "pt-BR") return `${d.getDate()} ${MONTHS_SHORT_PT[d.getMonth()]} ${d.getFullYear()}`;
    return new Intl.DateTimeFormat(locale(), { day: "numeric", month: "short", year: "numeric" }).format(d);
  }
  // Dia e mês (sem ano): "15 nov".
  function fmtDayMonth(d) {
    if (locale() === "pt-BR") return `${d.getDate()} ${MONTHS_SHORT_PT[d.getMonth()]}`;
    return new Intl.DateTimeFormat(locale(), { day: "numeric", month: "short" }).format(d);
  }
  const fmtLong = (d) => new Intl.DateTimeFormat(locale(), { day: "numeric", month: "long", year: "numeric" }).format(d);
  function fmtTable(d) {
    const day = pad2(d.getDate());
    const month = pad2(d.getMonth() + 1);
    const date = locale() === "en-US" ? `${month}/${day}/${d.getFullYear()}` : `${day}/${month}/${d.getFullYear()}`;
    return `${date} 00:00 GMT-03`;
  }

  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  function daysBetween(from, to) {
    return Math.round((startOfDay(to) - startOfDay(from)) / 86400000);
  }

  // ---------------------------------------------------------------------------
  // Equipamentos da fazenda -> contagem por item do catálogo
  // ---------------------------------------------------------------------------
  function classify(equip) {
    const type = String(equip?.type || "").toLowerCase();
    const panel = String(equip?.data?.panelType || equip?.panelType || "").toLowerCase();
    if (type === "smart_connect" || type === "smartconnect" || type === "nexus" || panel === "nexus" || panel === "smartconnect") return "smartconnect";
    if (type === "smarttouch" || type === "centerstar") return "smarttouch";
    if (type === "linestar") return "linestar";
    if (type === "rainstar") return "rainstar";
    if (type === "irripump") return "irripump";
    if (type === "medidor") return "imeter";
    // Cosmofield, repetidora, pluviômetro e estação meteorológica não são cobrados por ora.
    return null;
  }

  function countsFromEquipments(list) {
    const counts = {};
    (list || []).forEach((equip) => {
      const key = classify(equip);
      if (key) counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }

  // Equipamentos da fazenda por item do catálogo: { chave: [{ id, name }] }, em ordem natural do nome.
  // Sem fazenda carregada (páginas de fatura abertas direto) usa a contagem de referência.
  function getDevices() {
    const groups = {};
    // Fazenda ativa do app (mesma fonte das páginas de bombas/medidores); ic_farms do localStorage como reserva.
    let list = [];
    try {
      const farm = window.IcFarm?.getActiveFarmSafe?.();
      list = (farm && window.IcFarm?.getFarmEquipmentsSafe?.(farm)) || [];
      if (!list.length) list = window.IcFarm?.getActiveFarmEquipments?.() || [];
    } catch (_) { list = []; }
    list.forEach((equip) => {
      const key = classify(equip);
      if (!key) return;
      (groups[key] = groups[key] || []).push({ id: String(equip.id), name: equip.name || equip.data?.nome || String(equip.id) });
    });
    if (!Object.keys(groups).length) {
      Object.entries(SNAPSHOT_COUNTS).forEach(([key, n]) => {
        groups[key] = Array.from({ length: n }, (_, i) => ({ id: "snap:" + key + ":" + (i + 1), name: catalogItem(key).name + " " + (i + 1) }));
      });
    }
    // A API Irricontrol One é inscrita por equipamento de irrigação (id próprio para não colidir com o do equipamento).
    groups.api = CATALOG.filter((c) => c.irrigation).flatMap((c) => groups[c.key] || []).map((d) => ({ id: "api:" + d.id, name: d.name }));
    Object.values(groups).forEach((g) => g.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })));
    return groups;
  }

  function liveCounts() {
    return Object.fromEntries(Object.entries(getDevices()).map(([key, devs]) => [key, devs.length]));
  }

  // Linhas de renovação (quantidade × valor anual) a partir da contagem de inscritos por item.
  function buildItems(counts) {
    return CATALOG
      .filter((c) => (counts[c.key] || 0) > 0)
      .map((c) => ({ key: c.key, name: c.name, desc: c.desc, qty: counts[c.key], unit: c.price, subtotal: c.price * counts[c.key] }));
  }

  // ---------------------------------------------------------------------------
  // Contratação: contratar/descontratar equipamentos ao longo do ciclo vigente.
  // Cada alteração gera um ajuste proporcional (dias restantes / dias do ciclo) que entra
  // na próxima fatura; a renovação já considera a nova quantidade.
  // ---------------------------------------------------------------------------
  const parseISO = (iso) => { const [y, m, d] = String(iso).split("-").map(Number); return new Date(y, m - 1, d); };
  const toISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const round2 = (n) => Math.round(n * 100) / 100;

  function getCycle(today) {
    const now = today || new Date();
    const end = currentDueDate(now);
    const start = new Date(end.getFullYear() - 1, end.getMonth(), end.getDate());
    return { start, end, totalDays: daysBetween(start, end) };
  }

  function getChanges() {
    try {
      const list = JSON.parse(localStorage.getItem(STORE.changes) || "[]");
      return Array.isArray(list) ? list : [];
    } catch (_) { return []; }
  }
  const saveChanges = (list) => localStorage.setItem(STORE.changes, JSON.stringify(list));

  // Ids dos equipamentos desativados de partida (fora da inscrição antes de qualquer alteração).
  function inactiveBaseIds() {
    const ids = new Set();
    const groups = getDevices();
    Object.entries(INACTIVE_DEMO).forEach(([key, n]) => (groups[key] || []).slice(-n).forEach((d) => ids.add(d.id)));
    return ids;
  }

  // Quantidade base por item: equipamentos cadastrados e inscritos (descontando os desativados).
  function baseCounts() {
    const counts = { ...liveCounts() };
    const groups = getDevices();
    const off = inactiveBaseIds();
    Object.entries(groups).forEach(([key, devs]) => { counts[key] = devs.filter((d) => !off.has(d.id)).length; });
    return counts;
  }

  function contractedCounts(changes) {
    const counts = baseCounts();
    (changes || []).forEach((c) => {
      counts[c.key] = Math.max(0, (counts[c.key] || 0) + c.delta);
    });
    return counts;
  }

  // Ajuste proporcional de uma alteração (positivo = cobra; negativo = crédito).
  function adjustmentFor(change, cycle) {
    const item = catalogItem(change.key);
    const remaining = Math.min(cycle.totalDays, Math.max(0, daysBetween(parseISO(change.date), cycle.end)));
    const unit = round2(item.price * remaining / cycle.totalDays);
    return { item, remaining, unit, amount: round2(change.delta * item.price * remaining / cycle.totalDays) };
  }

  // Fatura vigente: linhas de renovação + ajustes proporcionais das alterações informadas.
  // changes = todas as alterações de inscrição (definem as quantidades da renovação);
  // adjustFrom = só as que ainda geram ajuste proporcional (as pendentes). O ajuste é liquidado no Salvar:
  // depois dele a estimativa recomeça do zero, sem acumular ajustes de alterações já salvas.
  function buildCurrent(changes, coupons, cycle, adjustFrom) {
    const renewal = buildItems(contractedCounts(changes));
    // Cada alteração pendente gera um ajuste proporcional próprio (por item).
    const adjustments = (adjustFrom || []).flatMap((change) => [change.key].map((key) => {
      const adj = adjustmentFor({ ...change, key }, cycle);
      const sign = change.delta > 0 ? "+" : "";
      return {
        key, adj: true, changeId: change.id,
        name: tr("Ajuste proporcional: {q} {item}", { q: sign + change.delta, item: adj.item.name }),
        desc: change.delta < 0
          ? tr("Crédito dos {n} dias restantes · {u} dias já utilizados permanecem cobrados · efetivo em {d}", { n: adj.remaining, u: cycle.totalDays - adj.remaining, d: fmtShort(parseISO(change.date)) })
          : tr("Cobrança proporcional de {n} dias até o próximo ciclo · efetivo em {d}", { n: adj.remaining, d: fmtShort(parseISO(change.date)) }),
        qty: change.delta, unit: adj.unit, subtotal: adj.amount,
      };
    }));
    const items = [...renewal, ...adjustments];
    return {
      items, ...totalsFor(items, coupons),
      renewalTotal: renewal.reduce((sum, it) => sum + it.subtotal, 0),
      adjustTotal: adjustments.reduce((sum, it) => sum + it.subtotal, 0),
    };
  }

  // Alterações pendentes (ainda não salvas). Existem só na memória da tela de Faturamento: as páginas de
  // fatura/recibo (outras abas) enxergam apenas o que foi salvo. O botão Salvar grava tudo de uma vez.
  //   toggles: { idDoEquipamento: true|false }
  //   coupons: lista completa de códigos desejada (undefined = sem mudança) · method: undefined = sem mudança
  const pending = { toggles: {}, coupons: undefined, method: undefined };

  // Alterações de inscrição já salvas (a base sobre a qual a seleção pendente é calculada).
  const baseChanges = () => getChanges();

  // Situação de cada equipamento (true = inscrito). Parte de "todos inscritos" e aplica o histórico de alterações.
  function deviceStates(changes) {
    const states = {};
    const off = inactiveBaseIds();
    Object.values(getDevices()).flat().forEach((d) => { states[d.id] = !off.has(d.id); });
    (changes || []).forEach((c) => (c.devices || []).forEach((d) => { states[d.id] = c.delta > 0; }));
    return states;
  }

  // Seleção em edição ({ idDoEquipamento: true|false }) -> alterações por item (desinscrever = delta negativo).
  function entriesFromToggles(toggles) {
    const states = deviceStates(baseChanges());
    const entries = [];
    Object.entries(getDevices()).forEach(([key, devs]) => {
      const off = devs.filter((d) => toggles[d.id] === false && states[d.id]);
      const on = devs.filter((d) => toggles[d.id] === true && !states[d.id]);
      if (off.length) entries.push({ key, delta: -off.length, devices: off });
      if (on.length) entries.push({ key, delta: on.length, devices: on });
    });
    return entries;
  }

  // Alterações de inscrição que a seleção pendente vai gerar (ainda com id provisório "draft:").
  const pendingEntries = () => entriesFromToggles(pending.toggles).map((e, i) => ({ id: "draft:" + i, ...e, date: toISO(new Date()) }));

  // Projeção: fatura vigente salva (antes) x com tudo o que está pendente (depois).
  function project() {
    const cycle = getCycle();
    const savedCoupons = findCoupons(savedCouponCodes());
    const coupons = findCoupons(getCouponCodes());
    return {
      cycle, count: pendingEntries().length,
      before: { ...buildCurrent(getChanges(), savedCoupons, cycle, []), coupons: savedCoupons },
      after: { ...buildCurrent([...baseChanges(), ...pendingEntries()], coupons, cycle, pendingEntries()), coupons },
    };
  }

  function hasPending() {
    return pendingEntries().length > 0
      || pending.coupons !== undefined || pending.method !== undefined;
  }

  function discardPending() {
    Object.keys(pending.toggles).forEach((k) => delete pending.toggles[k]);
    pending.coupons = undefined;
    pending.method = undefined;
  }

  // Grava tudo o que está pendente (botão Salvar). "extras" = alterações de fora deste módulo
  // (cartões, dados de faturamento) que também entram no histórico.
  function savePending(extras) {
    const cycle = getCycle();
    const keyPlan = apiKeyPlan(); // calculada antes de gravar: depende do que está pendente
    const changes = pendingEntries().map((e) => ({
      type: "subscription", key: e.key, delta: e.delta, date: e.date,
      devices: e.devices.map((d) => d.name), amount: adjustmentFor(e, cycle).amount,
    }));
    if (pending.coupons !== undefined) {
      const before = savedCouponCodes();
      pending.coupons.filter((c) => !before.includes(c)).forEach((code) => changes.push({ type: "coupon", action: "applied", code }));
      before.filter((c) => !pending.coupons.includes(c)).forEach((code) => changes.push({ type: "coupon", action: "removed", code }));
    }
    if (pending.method !== undefined) changes.push({ type: "method", to: pending.method });
    if (keyPlan === "generate") changes.push({ type: "apikey" }); // a chave em si nunca vai para o histórico
    (extras || []).forEach((x) => changes.push(x));

    const list = baseChanges();
    pendingEntries().forEach((e, i) => {
      list.push({ id: Date.now() + "-" + e.key + "-" + i, key: e.key, delta: e.delta, devices: e.devices, date: e.date });
    });
    saveChanges(list);
    try {
      if (pending.coupons !== undefined) {
        if (pending.coupons.length) localStorage.setItem(STORE.coupon, JSON.stringify(pending.coupons)); else localStorage.removeItem(STORE.coupon);
      }
      if (pending.method !== undefined) localStorage.setItem(STORE.method, pending.method);
      if (keyPlan === "generate") localStorage.setItem(STORE.apiKey, JSON.stringify(newApiKey()));
      else if (keyPlan === "remove") localStorage.removeItem(STORE.apiKey);
    } catch (_) { /* noop */ }
    if (changes.length) appendHistory({ id: String(Date.now()), at: new Date().toISOString(), user: HISTORY_USER, title: "Alterações de faturamento", changes });
    discardPending();
  }

  // ---------------------------------------------------------------------------
  // Histórico de alterações do billing (desde o início). Entradas estruturadas: a tela monta os textos
  // no idioma ativo. As iniciais abaixo são mock impessoal; cada Salvar acrescenta uma entrada nova.
  // ---------------------------------------------------------------------------
  const HISTORY_USER = "bauer@irricontrol.com";

  // História de exemplo (mock impessoal) que liga Contratação, Faturamento, Detalhes da Anuidade e Histórico.
  // Parte do que está inscrito hoje e volta no tempo desfazendo as alterações descritas abaixo, de modo que
  //   inscritos na renovação anterior + equipamentos adicionados no ciclo − desativados = inscritos hoje.
  const STORY = {
    addedInCycle: { smartconnect: 2, rainstar: 2, irripump: 1 },              // equipamentos novos neste ciclo
    growthBefore: { smartconnect: 4, rainstar: 3, irripump: 1, imeter: 1 },   // crescimento do ciclo anterior
    addedAtDay: 66,        // dias após o início do ciclo (equipamentos adicionados)
    deactivatedAtDay: 130, // dias após o início do ciclo (equipamentos desativados)
  };

  function storyCounts() {
    const base = baseCounts(); // inscritos hoje, antes de qualquer alteração salva
    const devs = getDevices();
    const off = inactiveBaseIds();
    const renewal = {};
    const start = {};
    CATALOG.filter((c) => c.key !== "api").forEach((c) => {
      const deactivated = (devs[c.key] || []).filter((d) => off.has(d.id)).length;
      renewal[c.key] = Math.max(0, (base[c.key] || 0) - (STORY.addedInCycle[c.key] || 0) + deactivated);
      start[c.key] = Math.max(0, renewal[c.key] - (STORY.growthBefore[c.key] || 0));
    });
    return { renewal, start };
  }

  function seedHistory() {
    const cycle = getCycle();
    const yearsBack = (n) => new Date(cycle.end.getFullYear() - n, cycle.end.getMonth(), cycle.end.getDate());
    const at = (date, days, h, m) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, h, m).toISOString();
    const story = storyCounts();
    const [last, first] = PAST_INVOICES;
    const devs = getDevices();
    const off = inactiveBaseIds();

    // Alteração de inscrição de exemplo, com o mesmo ajuste proporcional que o Salvar calcularia na data.
    const sub = (key, delta, names, dayOffset) => {
      const date = toISO(new Date(cycle.start.getFullYear(), cycle.start.getMonth(), cycle.start.getDate() + dayOffset));
      return { type: "subscription", key, delta, date, devices: names, amount: adjustmentFor({ key, delta, date }, cycle).amount };
    };
    const added = Object.entries(STORY.addedInCycle)
      .map(([key, n]) => sub(key, n, (devs[key] || []).slice(-n).map((d) => d.name), STORY.addedAtDay))
      .filter((c) => c.devices.length);
    const deactivated = Object.keys(INACTIVE_DEMO).filter((key) => key !== "api").map((key) => {
      const names = (devs[key] || []).filter((d) => off.has(d.id)).map((d) => d.name);
      return names.length ? sub(key, -names.length, names, STORY.deactivatedAtDay) : null;
    }).filter(Boolean);

    return [
      { id: "seed-1", at: at(yearsBack(2), -5, 10, 12), user: HISTORY_USER, title: "Início da assinatura",
        changes: [{ type: "billing" }, { type: "subscribed", counts: story.start }, { type: "method", to: "boleto" }, { type: "invoice", number: first.number }] },
      { id: "seed-2", at: at(yearsBack(1), -4, 9, 41), user: HISTORY_USER, title: "Renovação anual",
        changes: [{ type: "subscribed", counts: story.renewal }, { type: "method", to: "card" }, { type: "card", action: "added", last4: DEFAULT_CARDS[0].last4 }, { type: "invoice", number: last.number }] },
      ...(added.length ? [{ id: "seed-3", at: at(cycle.start, STORY.addedAtDay, 14, 20), user: HISTORY_USER, title: "Equipamentos adicionados", changes: added }] : []),
      ...(deactivated.length ? [{ id: "seed-4", at: at(cycle.start, STORY.deactivatedAtDay, 15, 3), user: HISTORY_USER, title: "Equipamentos desativados", changes: deactivated }] : []),
    ];
  }

  // Extrato da anuidade do ciclo vigente: o que foi contratado no início (fatura da renovação) e todas as
  // alterações de inscrição do período, cada uma com a inclusão (+) ou o desconto (−) proporcional.
  // Vem do Histórico (alterações já salvas) e da seleção pendente (ainda não salva, saved: false).
  function getCycleStatement() {
    const cycle = getCycle();
    const initial = getInvoices({ saved: true })[1]; // fatura da renovação que abriu o ciclo
    const startISO = new Date(cycle.start.getFullYear(), cycle.start.getMonth(), cycle.start.getDate()).toISOString();
    const row = (c, saved) => ({
      date: c.date, key: c.key, name: catalogItem(c.key)?.name || c.key, delta: c.delta, devices: c.devices || [],
      amount: c.amount, remaining: Math.min(cycle.totalDays, Math.max(0, daysBetween(parseISO(c.date), cycle.end))), saved,
    });
    const savedRows = getHistory()
      .filter((e) => e.at >= startISO)
      .flatMap((e) => (e.changes || []).filter((c) => c.type === "subscription").map((c) => row(c, true)));
    const pendingRows = pendingEntries().map((e) => row({ ...e, devices: e.devices.map((d) => d.name), amount: adjustmentFor(e, cycle).amount }, false));
    const changes = [...savedRows, ...pendingRows].sort((a, b) => a.date.localeCompare(b.date));
    const inclusions = round2(changes.filter((c) => c.amount > 0).reduce((sum, c) => sum + c.amount, 0));
    const discounts = round2(changes.filter((c) => c.amount < 0).reduce((sum, c) => sum + c.amount, 0));
    return { cycle, initial, changes, inclusions, discounts, total: round2(initial.total + inclusions + discounts) };
  }

  function storedHistory() {
    try { const list = JSON.parse(localStorage.getItem(STORE.history) || "[]"); return Array.isArray(list) ? list : []; } catch (_) { return []; }
  }
  function appendHistory(entry) {
    const list = storedHistory();
    list.push(entry);
    localStorage.setItem(STORE.history, JSON.stringify(list));
  }
  // Mais recente primeiro.
  const getHistory = () => [...storedHistory(), ...seedHistory()].sort((a, b) => b.at.localeCompare(a.at));

  // Linhas da tela de contratação: equipamentos cadastrados x inscritos, com a situação de cada um.
  function getContract() {
    const devs = getDevices();
    const states = deviceStates(baseChanges());
    const contracted = contractedCounts(baseChanges());
    return CATALOG.map((c) => ({
      key: c.key, name: c.name, desc: c.desc, price: c.price,
      registered: (devs[c.key] || []).length,
      contracted: contracted[c.key] || 0,
      devices: (devs[c.key] || []).map((d) => ({ ...d, subscribed: states[d.id] !== false })),
    }));
  }

  // ---------------------------------------------------------------------------
  // Chave da API da fazenda (disponível quando há API Irricontrol One contratada)
  // ---------------------------------------------------------------------------
  const savedApiKey = () => {
    try { return JSON.parse(localStorage.getItem(STORE.apiKey) || "null"); } catch (_) { return null; }
  };
  // A chave é automática: existe só com API contratada, é gerada ao salvar a contratação e uma nova é
  // gerada sempre que a contratação (inscrições) muda. O usuário não gera nem regenera sozinho.
  const getApiKey = savedApiKey;

  function newApiKey() {
    const bytes = new Uint8Array(24);
    if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes);
    else bytes.forEach((_, i) => { bytes[i] = Math.floor(Math.random() * 256); });
    return { key: "ic_live_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(""), createdAt: new Date().toISOString() };
  }

  // O que o Salvar fará com a chave: "generate" (nova), "remove" (API deixou de ser contratada) ou null.
  function apiKeyPlan() {
    const apiAfter = contractedCounts([...baseChanges(), ...pendingEntries()]).api || 0;
    const has = !!savedApiKey();
    if (apiAfter > 0 && (pendingEntries().length > 0 || !has)) return "generate";
    if (apiAfter === 0 && has) return "remove";
    return null;
  }

  // ---------------------------------------------------------------------------
  // Cupom
  // ---------------------------------------------------------------------------
  // Cupons ativos ao mesmo tempo (guardados como lista; aceita o formato antigo de um código só).
  function savedCouponCodes() {
    try {
      const raw = localStorage.getItem(STORE.coupon) || "";
      if (!raw) return [];
      if (raw.trim().startsWith("[")) { const list = JSON.parse(raw); return Array.isArray(list) ? list : []; }
      return [raw];
    } catch (_) { return []; }
  }
  // Lista efetiva (a pendente vale sobre a salva).
  const getCouponCodes = () => (pending.coupons !== undefined ? pending.coupons : savedCouponCodes());
  function setPendingCoupons(list) {
    pending.coupons = JSON.stringify(list) === JSON.stringify(savedCouponCodes()) ? undefined : list;
  }
  const findCoupons = (codes) => (codes || []).map(findCoupon).filter(Boolean);
  // Descrição do cupom no idioma ativo.
  function couponLabel(coupon) {
    return tr(coupon.label);
  }
  // Nomes dos itens em que o cupom vale.
  function couponScope(coupon) {
    return (coupon.items || CATALOG.map((c) => c.key)).map((key) => catalogItem(key)?.name).filter(Boolean);
  }
  function findCoupon(code) {
    const key = String(code || "").trim().toUpperCase();
    return COUPONS[key] ? { code: key, ...COUPONS[key] } : null;
  }
  // Adiciona o cupom à lista (vários podem estar ativos). Repetido volta com already: true, sem alterar.
  function applyCoupon(code) {
    const coupon = findCoupon(code);
    if (!coupon) return null;
    const list = getCouponCodes();
    if (list.includes(coupon.code)) return { ...coupon, already: true };
    setPendingCoupons([...list, coupon.code]);
    return coupon;
  }
  const removeCoupon = (code) => setPendingCoupons(getCouponCodes().filter((c) => c !== code));

  // Calcula subtotal, desconto e total. Cada cupom desconta só os itens em que vale, em sequência
  // (o seguinte incide sobre o que sobrou, então a soma nunca passa de 100% de um item). O desconto
  // da linha fica em it.discount e o valor de cada cupom em byCoupon.
  function totalsFor(items, coupons) {
    const byCoupon = {};
    let discount = 0;
    items.forEach((it) => {
      let remaining = it.subtotal;
      let off = 0;
      (coupons || []).forEach((c) => {
        if (c.items && !c.items.includes(it.key)) return;
        const d = round2(remaining * c.value / 100);
        byCoupon[c.code] = round2((byCoupon[c.code] || 0) + d);
        off += d;
        remaining = round2(remaining - d);
      });
      it.discount = round2(off);
      discount += it.discount;
    });
    const subtotal = items.reduce((sum, it) => sum + it.subtotal, 0);
    return { subtotal, discount: round2(discount), total: round2(subtotal - discount), byCoupon };
  }

  // ---------------------------------------------------------------------------
  // Faturas
  // ---------------------------------------------------------------------------
  function currentDueDate(today) {
    const due = new Date(today.getFullYear(), today.getMonth(), DUE_DAY);
    return today.getDate() > DUE_DAY ? new Date(today.getFullYear(), today.getMonth() + 1, DUE_DAY) : due;
  }

  function currentStatus(dueDate, today) {
    let override = "";
    try { override = localStorage.getItem(STORE.status) || ""; } catch (_) { /* noop */ }
    if (override === "paid" || override === "overdue" || override === "pending") return override;
    return daysBetween(today, dueDate) < 0 ? "overdue" : "pending";
  }

  // Por padrão considera o que está pendente (prévia do que será salvo); { saved: true } só o já salvo.
  function getInvoices(opts) {
    const savedOnly = !!(opts && opts.saved);
    const today = new Date();
    const dueDate = currentDueDate(today);
    const status = currentStatus(dueDate, today);
    const coupons = findCoupons(savedOnly ? savedCouponCodes() : getCouponCodes());
    const changes = savedOnly ? getChanges() : [...baseChanges(), ...pendingEntries()];

    const built = buildCurrent(changes, coupons, getCycle(today), savedOnly ? [] : pendingEntries());
    const current = {
      number: CURRENT_NUMBER, dueDate, status, method: savedOnly ? (METHOD_LABELS[savedMethod()] || METHOD_LABELS.card) : getMethodLabel(), coupons,
      ...built, current: true,
      paidAt: status === "paid" ? today : null,
      periodEnd: new Date(dueDate.getFullYear() + 1, dueDate.getMonth(), dueDate.getDate()),
    };

    const past = PAST_INVOICES.map((p) => {
      const due = new Date(dueDate.getFullYear() - p.yearsAgo, dueDate.getMonth(), dueDate.getDate());
      const paidAt = new Date(due.getFullYear(), due.getMonth(), due.getDate() - p.paidDaysBefore);
      const pastItems = buildItems(storyCounts()[p.yearsAgo === 1 ? "renewal" : "start"]);
      return {
        number: p.number, dueDate: due, status: p.status, method: p.method, coupons: [],
        items: pastItems, ...totalsFor(pastItems, []), paidAt,
        periodEnd: new Date(due.getFullYear() + 1, due.getMonth(), due.getDate()),
      };
    });

    return [current, ...past];
  }

  function getInvoice(number) {
    return getInvoices().find((inv) => inv.number === number) || null;
  }

  // ---------------------------------------------------------------------------
  // Método de pagamento preferencial e dados de faturamento salvos
  // ---------------------------------------------------------------------------
  const METHOD_LABELS = { card: "Cartão de crédito", boleto: "Boleto", pix: "PIX" };

  function savedMethod() {
    try { return localStorage.getItem(STORE.method) || "card"; } catch (_) { return "card"; }
  }
  const getMethod = () => (pending.method !== undefined ? pending.method : savedMethod());
  function setMethod(key) {
    pending.method = key === savedMethod() ? undefined : key;
  }
  function getMethodLabel() {
    return METHOD_LABELS[getMethod()] || METHOD_LABELS.card;
  }

  function getBilling() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE.billing) || "null");
      if (saved && typeof saved === "object") return { ...CLIENT_FALLBACK, ...Object.fromEntries(Object.entries(saved).filter(([, v]) => v)) };
    } catch (_) { /* noop */ }
    return { ...CLIENT_FALLBACK };
  }

  window.IcBillingData = {
    STORE, CATALOG, COUPONS, ISSUER, METHOD_LABELS,
    money, fmtNumber, fmtShort, fmtDayMonth, fmtLong, fmtTable, daysBetween, locale, tr, couponLabel, couponScope,
    classify, countsFromEquipments, buildItems, totalsFor,
    getCycleStatement, pending, pendingEntries, savedCouponCodes, findCoupons, METHOD_LABELS, DEFAULT_CARDS, storyCounts, getHistory, hasPending, discardPending, savePending, setMethod, getApiKey, apiKeyPlan, getCycle, getChanges, getContract, project, getDevices, toISO, parseISO,
    getInvoices, getInvoice, getCouponCodes, findCoupon, applyCoupon, removeCoupon,
    getMethod, getMethodLabel, getBilling,
  };
})();
