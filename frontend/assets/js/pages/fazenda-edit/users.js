// Aba "Usuários" do Editar fazenda: convidar usuário (e-mail + idioma) e definir as permissões.
// As permissões são escolhidas por nível: cada nível abre a lista de equipamentos da fazenda e
// cada equipamento só pode estar em um nível (vale o último marcado). Equipamento sem nível
// fica sem acesso. Nada vai para o servidor: o mock guarda a lista no localStorage por fazenda.
(function () {
  "use strict";

  const tr = (key, vars) => {
    let out = key;
    try { out = window.IcI18n?.t ? window.IcI18n.t(key) : key; } catch (_) { /* mantém pt */ }
    return vars ? String(out).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m)) : out;
  };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Do menor para o maior: cada nível inclui o que o anterior pode fazer. "Sem Permissão" é uma escolha
  // explícita como as demais, mas não é gravada: equipamento sem nível também fica sem acesso.
  const LEVELS = [
    { key: "none", name: "Sem Permissão", desc: "O equipamento não aparece na tela inicial da fazenda" },
    { key: "viewer", name: "Visualizador", desc: "Vê relatórios e comandos enviados" },
    { key: "operator", name: "Operador", desc: "Além de visualizar, envia comandos" },
    { key: "configurator", name: "Configurador", desc: "Além de operar, edita as configurações do equipamento" },
    { key: "admin", name: "Administrador", desc: "Além de configurar, edita a fazenda e gerencia usuários" },
  ];
  const levelOf = (key) => LEVELS.find((l) => l.key === key);

  const ABOUT = [
    { name: "Sem Permissão", text: "Nesta permissão, o usuário não terá acesso ao equipamento selecionado. Dessa forma, o mesmo não aparecerá na Tela inicial da Fazenda." },
    { name: "Visualizador", text: "Nesta permissão, o usuário tem acesso ao equipamento e consegue visualizar desde relatórios a comandos enviados. Porém, o usuário não poderá enviar comandos para o equipamento, fazer edições de configurações do mesmo e não poderá acessar a página de edições da Fazenda." },
    { name: "Operador", text: "Nesta permissão, o usuário tem as mesmas permissões do Visualizador, além disso, ele pode enviar comandos para o equipamento. Porém, o usuário não poderá fazer edições das configurações do equipamento e não poderá acessar a página de edições da Fazenda." },
    { name: "Configurador", text: "Nesta permissão, o usuário tem as mesmas permissões do Operador, além disso, ele poderá fazer edições das configurações do equipamento. Porém, o mesmo não conseguirá acessar a página de edições da Fazenda." },
    { name: "Administrador", text: "Por fim, como Administrador, o usuário terá todas as permissões do Configurador. Ele terá acesso a relatórios, histórico de comandos, envio de novos comandos, edições de todas as informações do equipamento, edições da Fazenda e, ainda, poderá adicionar e gerenciar usuários." },
  ];

  // Idiomas da plataforma (mesma lista de Configurações), cada um com o próprio nome.
  const LANGS = [
    { value: "de-AT", label: "German (Austria)" },
    { value: "en", label: "English" },
    { value: "es", label: "Español" },
    { value: "fr", label: "Français" },
    { value: "hu", label: "Magyar" },
    { value: "pt-BR", label: "Português" },
    { value: "ro", label: "Română" },
    { value: "ru", label: "Русский" },
    { value: "tr", label: "Türkçe" },
  ];
  // O convite sai por padrão no idioma em que a plataforma está aberta.
  const currentLang = () => {
    try { const l = localStorage.getItem("ic:lang"); return LANGS.some((x) => x.value === l) ? l : "pt-BR"; } catch (_) { return "pt-BR"; }
  };

  // Tipo do equipamento -> nome do grupo na lista (pivôs primeiro).
  const TYPE_LABELS = {
    smart_connect: "SmartConnect/Nexus",
    smarttouch: "SmartTouch/UniversalTouch",
    linestar: "Linestar",
    rainstar: "Rainstar",
    irripump: "Irripump",
    medidor: "IMeter",
    pluviometro: "Pluviômetro",
    cosmofield: "Cosmofield",
    repetidora: "Repetidora",
    estacao_metereologica: "Estação meteorológica",
  };
  const TYPE_ORDER = Object.keys(TYPE_LABELS);

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const ACCOUNT_NAME = "Bauer Irricontrol";

  let ui = null; // modal aberto: { mode, step, email, lang, levels, open, root }

  // ---------------------------------------------------------------------------
  // Dados
  // ---------------------------------------------------------------------------
  function activeFarm() {
    try { return window.IcFarm?.getActiveFarmSafe?.() || null; } catch (_) { return null; }
  }

  // Equipamentos da fazenda: [{ id, name, type }] (agrupados e em ordem natural do nome).
  function getEquipments() {
    let list = [];
    try {
      const farm = activeFarm();
      list = (farm && window.IcFarm?.getFarmEquipmentsSafe?.(farm)) || [];
      if (!list.length) list = window.IcFarm?.getActiveFarmEquipments?.() || [];
    } catch (_) { list = []; }
    return list
      .filter((e) => e && e.id != null)
      .map((e) => ({ id: String(e.id), name: e.name || e.data?.nome || String(e.id), type: String(e.type || "") }));
  }

  function storeKey() {
    let id = activeFarm()?.id;
    if (id == null) id = sessionStorage.getItem("ic_active_farm") || sessionStorage.getItem("ic_active_farm_id") || "default";
    return "ic:farm-users:v1:" + id;
  }

  function loadUsers() {
    try {
      const saved = JSON.parse(localStorage.getItem(storeKey()) || "null");
      if (Array.isArray(saved)) {
        saved.forEach((u) => { if (typeof u.admin !== "boolean") u.admin = Object.values(u.levels || {}).includes("admin"); });
        return saved;
      }
    } catch (_) { /* recria o padrão */ }
    // Padrão do mock: 13 administradores com acesso a todos os equipamentos.
    const all = Object.fromEntries(getEquipments().map((e) => [e.id, "admin"]));
    return Array.from({ length: 13 }, (_, i) => ({
      email: `bauer+${String(i + 1).padStart(2, "0")}@irricontrol.com`,
      name: ACCOUNT_NAME, lang: "pt-BR", pending: false, admin: true, levels: { ...all },
    }));
  }
  function saveUsers(users) {
    try { localStorage.setItem(storeKey(), JSON.stringify(users)); } catch (_) { /* sem persistência */ }
  }

  function topLevel(levels) {
    const keys = Object.values(levels || {});
    for (let i = LEVELS.length - 1; i >= 0; i--) if (keys.includes(LEVELS[i].key)) return LEVELS[i];
    return null;
  }

  // ---------------------------------------------------------------------------
  // Lista de usuários
  // ---------------------------------------------------------------------------
  function render() {
    const list = document.querySelector("#farmEditUsers .user-page__list");
    if (!list) return;
    const users = loadUsers();
    list.innerHTML = users.map((u) => {
      const top = topLevel(u.levels);
      const count = Object.keys(u.levels || {}).length;
      const levelBadge = top
        ? `<span class="badge ${top.key === "admin" ? "badge--admin" : "badge--level"}">${esc(tr(top.name))}</span>`
        : `<span class="badge badge--none">${esc(tr("Sem permissão"))}</span>`;
      const pending = u.pending ? `<span class="badge badge--pending">${esc(tr("Convite pendente"))}</span>` : "";
      const meta = count ? `<span class="user-name__sep">·</span><span>${esc(tr(count === 1 ? "{n} equipamento" : "{n} equipamentos", { n: count }))}</span>` : "";
      return `
        <div class="user-item" data-email="${esc(u.email)}">
          <div class="user-item__main">
            <div class="user-item__info">
              <div class="user-item__id">
                <span class="user-email">${esc(u.email)}</span>${levelBadge}${pending}
              </div>
              <div class="user-name"><span>${esc(u.pending ? tr("Aguardando cadastro") : u.name)}</span>${meta}</div>
            </div>
            <div class="user-item__actions">
              <button class="btn-icon" type="button" data-fu-edit title="Editar"><i class="fa-solid fa-pen"></i></button>
              <button class="btn-icon btn-icon--delete" type="button" data-fu-del title="Excluir"><i class="fa-solid fa-trash-can"></i></button>
            </div>
          </div>
        </div>`;
    }).join("");
  }

  // ---------------------------------------------------------------------------
  // Modais
  // ---------------------------------------------------------------------------
  function closeModal() {
    document.getElementById("farmUserModal")?.remove();
    document.removeEventListener("keydown", onKey, true);
    ui = null;
  }
  function onKey(e) {
    if (e.key === "Escape" && !document.getElementById("farmUserAbout")) { e.stopPropagation(); closeModal(); }
  }

  function openShell(html, wide) {
    document.getElementById("farmUserModal")?.remove();
    const root = document.createElement("div");
    root.id = "farmUserModal";
    root.className = "create-equip fu-modal is-open";
    root.innerHTML = `
      <div class="create-equip__backdrop" data-fu-close></div>
      <section class="create-equip__dialog fu-dialog${wide ? " fu-dialog--wide" : ""}" role="dialog" aria-modal="true">
        <button type="button" class="fu-close" data-fu-close aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>
        ${html}
      </section>`;
    document.body.appendChild(root);
    document.addEventListener("keydown", onKey, true);
    return root;
  }

  // Sobre as permissões -----------------------------------------------------
  function openAbout() {
    // Fica por cima do modal de convite, se estiver aberto, sem perder o que já foi preenchido.
    document.getElementById("farmUserAbout")?.remove();
    const root = document.createElement("div");
    root.id = "farmUserAbout";
    root.className = "create-equip fu-modal is-open";
    root.style.zIndex = "1300";
    root.innerHTML = `
      <div class="create-equip__backdrop" data-fu-about-close></div>
      <section class="create-equip__dialog fu-dialog fu-dialog--about" role="dialog" aria-modal="true">
        <button type="button" class="fu-close" data-fu-about-close aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>
        <h3 class="fu-title">Sobre as permissões</h3>
        <div class="fu-about">
          <p class="fu-lead">Segue abaixo uma breve descrição sobre cada nível de usuário:</p>
          ${ABOUT.map((a) => `<h4>${esc(a.name)}</h4><p>${esc(a.text)}</p>`).join("")}
        </div>
      </section>`;
    document.body.appendChild(root);
    const close = () => { root.remove(); document.removeEventListener("keydown", onAboutKey, true); };
    const onAboutKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    document.addEventListener("keydown", onAboutKey, true);
    root.addEventListener("click", (e) => { if (e.target.closest("[data-fu-about-close]")) close(); });
  }

  // Convite (etapa 1) ------------------------------------------------------
  function openInvite() {
    ui = { mode: "invite", step: 1, email: "", lang: currentLang(), admin: false, levels: {}, open: new Set() };
    ui.root = openShell("", false);
    renderStep();
  }

  // Edição de permissões de quem já está na lista (só a etapa 2).
  function openEdit(email) {
    const user = loadUsers().find((u) => u.email === email);
    if (!user) return;
    // Administrador é por fazenda (vale para todos os equipamentos): não entra nas listas por nível.
    const levels = Object.fromEntries(Object.entries(user.levels || {}).filter(([, lv]) => lv !== "admin"));
    ui = { mode: "edit", step: 2, email: user.email, lang: user.lang, admin: !!user.admin, levels, open: new Set() };
    ui.root = openShell("", true);
    renderStep();
  }

  function renderStep() {
    const dialog = ui.root.querySelector(".fu-dialog");
    dialog.classList.toggle("fu-dialog--wide", ui.step === 2);
    dialog.querySelectorAll(":scope > :not(.fu-close)").forEach((n) => n.remove());
    dialog.insertAdjacentHTML("beforeend", ui.step === 1 ? stepInviteHtml() : stepPermissionsHtml());
    if (ui.step === 1) dialog.querySelector("#fuEmail")?.focus();
    else syncLevels();
  }

  function stepsHtml() {
    if (ui.mode === "edit") return "";
    return `
      <ol class="fu-steps">
        <li class="${ui.step === 1 ? "is-active" : "is-done"}"><span class="fu-steps__n">1</span><span>Convite</span></li>
        <li class="${ui.step === 2 ? "is-active" : ""}"><span class="fu-steps__n">2</span><span>Permissões</span></li>
      </ol>`;
  }

  function stepInviteHtml() {
    return `
      <h3 class="fu-title">Adicionar Usuário</h3>
      ${stepsHtml()}
      <label class="fu-label" for="fuEmail">Insira o e-mail do usuário a ser convidado</label>
      <input class="fu-input" id="fuEmail" type="email" inputmode="email" autocomplete="off" placeholder="E-mail" value="${esc(ui.email)}">
      <div class="fu-error" id="fuEmailError" hidden></div>
      <label class="fu-label" for="fuLang">Idioma do convite</label>
      <select class="fu-input fu-select" id="fuLang" data-i18n-skip>
        ${LANGS.map((l) => `<option value="${l.value}"${l.value === ui.lang ? " selected" : ""}>${esc(l.label)}</option>`).join("")}
      </select>
      <button type="button" class="fu-btn fu-btn--outline fu-btn--block" data-fu-next>Continuar</button>`;
  }

  function stepPermissionsHtml() {
    const edit = ui.mode === "edit";
    const equips = getEquipments();
    const groups = [];
    TYPE_ORDER.concat([...new Set(equips.map((e) => e.type))].filter((t) => !TYPE_ORDER.includes(t))).forEach((type) => {
      const items = equips.filter((e) => e.type === type).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      if (items.length) groups.push({ label: TYPE_LABELS[type] || type, items });
    });

    const levelsHtml = LEVELS.filter((lv) => lv.key !== "admin").map((lv) => `
      <div class="fu-level${ui.open.has(lv.key) ? " is-open" : ""}" data-level="${lv.key}">
        <div class="fu-level__head" data-fu-expand>
          <input type="checkbox" class="fu-level__all" data-fu-all aria-label="Selecionar todos">
          <div class="fu-level__title">
            <div class="fu-level__name">${esc(lv.name)}</div>
            <div class="fu-level__desc">${esc(lv.desc)}</div>
          </div>
          <div class="fu-level__count" data-fu-count></div>
          <span class="fu-level__chev"><i class="fa-solid fa-chevron-down"></i></span>
        </div>
        <div class="fu-level__body">
          ${groups.map((g) => `
            <div class="fu-group">
              <div class="fu-group__title">${esc(g.label)}</div>
              <div class="fu-devs">
                ${g.items.map((e) => `<label class="fu-dev" data-eq="${esc(e.id)}"><input type="checkbox" data-fu-eq><span class="fu-dev__txt"><span class="fu-dev__name">${esc(e.name)}</span><span class="fu-dev__tag" data-fu-tag></span></span></label>`).join("")}
              </div>
            </div>`).join("")}
        </div>
      </div>`).join("");

    return `
      <h3 class="fu-title">${edit ? "Editar permissões" : "Adicionar Usuário"}</h3>
      ${stepsHtml()}
      <p class="fu-lead">Defina o nível de acesso de cada equipamento para:</p>
      <div class="fu-who">${esc(ui.email)}</div>
      <label class="fu-admin">
        <span class="fu-admin__name">Administrador</span>
        <input type="checkbox" class="fu-switch" id="fuAdmin" role="switch">
      </label>
      <div class="fu-note">
        <span data-fu-excl>Cada equipamento tem um único nível. Ao marcá-lo em outro nível, ele sai do anterior.</span>
        <a href="#" class="link-permissons" data-fu-about><i class="fa-regular fa-circle-question"></i> Sobre as permissões</a>
      </div>
      <div class="fu-levels">${levelsHtml}</div>
      <div class="fu-foot">
        <div class="fu-foot__sum" data-fu-sum></div>
        <div class="fu-foot__btns">
          ${edit ? '<button type="button" class="fu-btn" data-fu-close>Cancelar</button>' : '<button type="button" class="fu-btn" data-fu-back>Voltar</button>'}
          <button type="button" class="fu-btn fu-btn--primary" data-fu-save>${edit ? "Salvar permissões" : "Convidar usuário"}</button>
        </div>
      </div>`;
  }

  // Atualiza contadores, marcações e etiquetas sem redesenhar (preserva busca e rolagem).
  function syncLevels() {
    const total = ui.root.querySelectorAll(".fu-level:first-child [data-eq]").length;
    ui.root.querySelector("#fuAdmin").checked = ui.admin;
    ui.root.querySelector(".fu-levels").hidden = ui.admin;
    ui.root.querySelector("[data-fu-excl]").hidden = ui.admin;
    ui.root.querySelectorAll(".fu-level").forEach((box) => {
      const level = box.dataset.level;
      let mine = 0;
      box.querySelectorAll("[data-eq]").forEach((row) => {
        const cur = ui.levels[row.dataset.eq];
        const isMine = cur === level;
        if (isMine) mine++;
        row.querySelector("input").checked = isMine;
        row.classList.toggle("is-elsewhere", !!cur && !isMine);
        row.querySelector("[data-fu-tag]").textContent = cur && !isMine ? tr("Em {nivel}", { nivel: tr(levelOf(cur).name) }) : "";
      });
      const all = box.querySelector("[data-fu-all]");
      all.checked = total > 0 && mine === total;
      all.indeterminate = mine > 0 && mine < total;
      box.querySelector("[data-fu-count]").textContent = tr("{a} de {b} equipamentos", { a: mine, b: total });
      box.querySelector("[data-fu-count]").classList.toggle("has-items", mine > 0);
    });
    const without = total - Object.values(ui.levels).filter((lv) => lv !== "none").length;
    const sum = ui.root.querySelector("[data-fu-sum]");
    if (sum) sum.textContent = ui.admin
      ? tr("Todos os equipamentos com acesso de Administrador")
      : without <= 0
      ? tr("Todos os equipamentos têm um nível de acesso")
      : tr(without === 1 ? "{n} equipamento ficará sem acesso" : "{n} equipamentos ficarão sem acesso", { n: without });
  }

  function setEmailError(msg) {
    const input = ui.root.querySelector("#fuEmail");
    const box = ui.root.querySelector("#fuEmailError");
    input.classList.toggle("is-invalid", !!msg);
    box.hidden = !msg;
    box.textContent = msg ? tr(msg) : "";
  }

  function goNext() {
    const email = ui.root.querySelector("#fuEmail").value.trim();
    ui.lang = ui.root.querySelector("#fuLang").value;
    ui.email = email;
    if (!email) return setEmailError("Este campo é obrigatório");
    if (!EMAIL_RE.test(email)) return setEmailError("Informe um e-mail válido");
    if (loadUsers().some((u) => u.email.toLowerCase() === email.toLowerCase())) return setEmailError("Este e-mail já tem acesso a esta fazenda");
    ui.step = 2;
    renderStep();
  }

  function save() {
    const users = loadUsers();
    // Administrador vale para todos os equipamentos da fazenda; senão valem só os níveis marcados.
    const levels = ui.admin
      ? Object.fromEntries(getEquipments().map((e) => [e.id, "admin"]))
      : Object.fromEntries(Object.entries(ui.levels).filter(([, lv]) => lv !== "none"));
    if (ui.mode === "edit") {
      const user = users.find((u) => u.email === ui.email);
      if (user) { user.admin = ui.admin; user.levels = levels; }
    } else {
      users.push({ email: ui.email, name: "", lang: ui.lang, pending: true, admin: ui.admin, levels });
    }
    saveUsers(users);
    const wasEdit = ui.mode === "edit";
    const invited = { email: ui.email, lang: ui.lang };
    closeModal();
    render();
    // Convite novo: o convidado recebe o e-mail com o link para a tela de cadastro (representação).
    if (wasEdit) window.IcNotify?.success?.(tr("Permissões atualizadas"));
    else openRegister(invited.email, invited.lang);
  }

  // Tela de cadastro que o convidado recebe por e-mail (só representação: nada é enviado) ----
  const flag = (code) => `https://flagcdn.com/${code}.svg`;
  const REG_LANGS = {
    "de-AT": { flag: "at", label: "Deutsch (Österreich)", country: "at" },
    en: { flag: "us", label: "English", country: "us" },
    es: { flag: "es", label: "Español", country: "es" },
    fr: { flag: "fr", label: "Français", country: "fr" },
    hu: { flag: "hu", label: "Magyar", country: "hu" },
    "pt-BR": { flag: "br", label: "Português (BR)", country: "br" },
    ro: { flag: "ro", label: "Română", country: "ro" },
    ru: { flag: "ru", label: "Русский", country: "ru" },
    tr: { flag: "tr", label: "Türkçe", country: "tr" },
  };
  const REG_COUNTRIES = [
    { code: "za", name: "África do Sul", dial: "+27" },
    { code: "de", name: "Alemanha", dial: "+49" },
    { code: "ar", name: "Argentina", dial: "+54" },
    { code: "at", name: "Áustria", dial: "+43" },
    { code: "br", name: "Brasil", dial: "+55" },
    { code: "us", name: "Estados Unidos", dial: "+1" },
    { code: "es", name: "Espanha", dial: "+34" },
    { code: "fr", name: "França", dial: "+33" },
    { code: "hu", name: "Hungria", dial: "+36" },
    { code: "py", name: "Paraguai", dial: "+595" },
    { code: "pt", name: "Portugal", dial: "+351" },
    { code: "ro", name: "Romênia", dial: "+40" },
    { code: "ru", name: "Rússia", dial: "+7" },
    { code: "tr", name: "Turquia", dial: "+90" },
  ];

  function regSelect(id, items, value, skipI18n) {
    const cur = items.find((i) => i.value === value) || items[0];
    return `
      <div class="rg-select" id="${id}" data-value="${esc(cur.value)}"${skipI18n ? " data-i18n-skip" : ""}>
        <button type="button" class="rg-select__btn" data-rg-toggle>
          <img class="rg-select__flag" src="${flag(cur.flag)}" alt="" width="20" height="14"><span class="rg-select__label">${esc(cur.label)}</span>
          <i class="fa-solid fa-chevron-down rg-select__chev"></i>
        </button>
        <div class="rg-select__panel" hidden>
          ${items.map((i) => `<div class="rg-select__opt${i.value === cur.value ? " is-active" : ""}" data-value="${esc(i.value)}" data-flag="${i.flag}"><img class="rg-select__flag" src="${flag(i.flag)}" alt="" width="20" height="14"><span>${esc(i.label)}</span></div>`).join("")}
        </div>
      </div>`;
  }

  function openRegister(email, lang) {
    document.getElementById("farmUserRegister")?.remove();
    const reg = REG_LANGS[lang] || REG_LANGS["pt-BR"];
    const country = REG_COUNTRIES.find((c) => c.code === reg.country) || REG_COUNTRIES.find((c) => c.code === "br");
    const root = document.createElement("div");
    root.id = "farmUserRegister";
    root.className = "rg";
    const req = '<span class="rg-req">*</span>';
    root.innerHTML = `
      <button type="button" class="rg-close" data-rg-close aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>
      <div class="rg__wrap">
        <img class="rg__logo" src="./assets/img/brand/IRRICONTROL_ONE_SECONDARY_4C_POSITIVE_cropped.png" alt="Irricontrol One">
        <div class="rg__card">
          <h1 class="rg__title">Registrar</h1>

          <div class="rg-field"><label class="rg-label">${req}<span>Língua</span></label>
            ${regSelect("rgLang", Object.entries(REG_LANGS).map(([value, l]) => ({ value, flag: l.flag, label: l.label })), lang in REG_LANGS ? lang : "pt-BR", true)}
          </div>

          <div class="rg-field"><label class="rg-label">${req}<span>E-mail</span></label>
            <input class="rg-input" type="email" value="${esc(email)}" disabled>
          </div>

          <div class="rg-row">
            <div class="rg-field"><label class="rg-label">${req}<span>Nome</span></label><input class="rg-input" type="text" placeholder="Bauer" autocomplete="off"></div>
            <div class="rg-field"><label class="rg-label">${req}<span>Sobrenome</span></label><input class="rg-input" type="text" placeholder="Irricontrol" autocomplete="off"></div>
          </div>

          <div class="rg-field"><label class="rg-label"><span>País</span></label>
            ${regSelect("rgCountry", REG_COUNTRIES.map((c) => ({ value: c.code, flag: c.code, label: tr(c.name) })), country.code, false)}
          </div>

          <div class="rg-field"><label class="rg-label">${req}<span>Celular</span></label>
            <div class="rg-phone"><span class="rg-phone__dial" id="rgDial">${country.dial}</span><input class="rg-input rg-phone__input" id="rgPhone" type="tel" inputmode="tel" autocomplete="off"></div>
          </div>

          <div class="rg-field"><label class="rg-label">${req}<span>Senha</span></label>
            <div class="rg-pass"><input class="rg-input" type="password" placeholder="******" autocomplete="new-password"><button type="button" class="rg-pass__eye" data-rg-eye aria-label="Mostrar senha"><i class="fa-regular fa-eye-slash"></i></button></div>
          </div>

          <div class="rg-field"><label class="rg-label">${req}<span>Confirme sua senha</span></label>
            <div class="rg-pass"><input class="rg-input" type="password" placeholder="******" autocomplete="new-password"><button type="button" class="rg-pass__eye" data-rg-eye aria-label="Mostrar senha"><i class="fa-regular fa-eye-slash"></i></button></div>
          </div>

          <div class="rg__actions"><button type="button" class="rg__submit" data-rg-close>Cadastrar</button></div>
        </div>
      </div>`;
    document.body.appendChild(root);

    const phone = root.querySelector("#rgPhone");
    const applyPhone = (code) => {
      phone.value = "";
      phone.placeholder = code === "br" ? "(__) _____-____" : "";
    };
    applyPhone(country.code);

    const closeReg = () => { root.remove(); document.removeEventListener("keydown", onRegKey, true); document.removeEventListener("click", onRegOutside, true); };
    const onRegKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); closeReg(); } };
    const onRegOutside = (e) => { if (!e.target.closest(".rg-select")) root.querySelectorAll(".rg-select__panel").forEach((p) => { p.hidden = true; }); };
    document.addEventListener("keydown", onRegKey, true);
    document.addEventListener("click", onRegOutside, true);

    root.addEventListener("click", (e) => {
      if (e.target.closest("[data-rg-close]")) { closeReg(); return; }
      const eye = e.target.closest("[data-rg-eye]");
      if (eye) {
        const input = eye.parentElement.querySelector("input");
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        eye.querySelector("i").className = show ? "fa-regular fa-eye" : "fa-regular fa-eye-slash";
        eye.setAttribute("aria-label", tr(show ? "Ocultar senha" : "Mostrar senha"));
        return;
      }
      const toggle = e.target.closest("[data-rg-toggle]");
      if (toggle) {
        const panel = toggle.parentElement.querySelector(".rg-select__panel");
        root.querySelectorAll(".rg-select__panel").forEach((p) => { if (p !== panel) p.hidden = true; });
        panel.hidden = !panel.hidden;
        return;
      }
      const opt = e.target.closest(".rg-select__opt");
      if (opt) {
        const box = opt.closest(".rg-select");
        box.dataset.value = opt.dataset.value;
        box.querySelector(".rg-select__btn .rg-select__flag").src = flag(opt.dataset.flag);
        box.querySelector(".rg-select__btn .rg-select__label").textContent = opt.querySelector("span").textContent;
        box.querySelectorAll(".rg-select__opt").forEach((o) => o.classList.toggle("is-active", o === opt));
        box.querySelector(".rg-select__panel").hidden = true;
        if (box.id === "rgCountry") {
          root.querySelector("#rgDial").textContent = REG_COUNTRIES.find((c) => c.code === opt.dataset.value).dial;
          applyPhone(opt.dataset.value);
        }
      }
    });

    // Máscara (11) 99999-9999 só para o Brasil.
    phone.addEventListener("input", () => {
      if (root.querySelector("#rgCountry").dataset.value !== "br") return;
      const d = phone.value.replace(/\D/g, "").slice(0, 11);
      phone.value = d.length > 7 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d ? `(${d}` : "";
    });
  }

  // Exclusão -----------------------------------------------------------------
  function openDelete(email) {
    ui = { mode: "delete", email };
    ui.root = openShell(`
      <h3 class="fu-title fu-title--sm">Excluir usuário</h3>
      <p class="fu-lead">Remover o acesso deste usuário a esta fazenda:</p>
      <div class="fu-who">${esc(email)}</div>
      <div class="fu-foot fu-foot--end">
        <div class="fu-foot__btns">
          <button type="button" class="fu-btn" data-fu-close>Cancelar</button>
          <button type="button" class="fu-btn fu-btn--danger" data-fu-confirm-del>Excluir</button>
        </div>
      </div>`, false);
    ui.root.querySelector(".fu-dialog").classList.add("fu-dialog--sm");
  }

  // ---------------------------------------------------------------------------
  // Eventos (delegados no documento: o painel é montado e remontado em runtime)
  // ---------------------------------------------------------------------------
  function assignAll(level, on) {
    ui.root.querySelectorAll(".fu-level:first-child [data-eq]").forEach((row) => {
      if (on) ui.levels[row.dataset.eq] = level;
      else if (ui.levels[row.dataset.eq] === level) delete ui.levels[row.dataset.eq];
    });
  }

  if (!window.__icFarmUsersBound) {
    window.__icFarmUsersBound = true;

    document.addEventListener("click", (e) => {
      const t = e.target;
      // Lista na aba Usuários
      if (t.closest("#farmEditUsers .btn-add-user")) { e.preventDefault(); openInvite(); return; }
      if (t.closest("#farmEditUsers .link-permissons")) { e.preventDefault(); openAbout(); return; }
      const row = t.closest("#farmEditUsers .user-item");
      if (row && t.closest("[data-fu-edit]")) { openEdit(row.dataset.email); return; }
      if (row && t.closest("[data-fu-del]")) { openDelete(row.dataset.email); return; }

      // Dentro do modal de usuário
      const root = t.closest("#farmUserModal");
      if (!root || !ui) return;
      if (t.closest("[data-fu-close]")) { closeModal(); return; }
      if (t.closest("[data-fu-next]")) { goNext(); return; }
      if (t.closest("[data-fu-back]")) { ui.step = 1; renderStep(); return; }
      if (t.closest("[data-fu-save]")) { save(); return; }
      if (t.closest("[data-fu-about]")) { e.preventDefault(); openAbout(); return; }
      if (t.closest("[data-fu-confirm-del]")) {
        saveUsers(loadUsers().filter((u) => u.email !== ui.email));
        closeModal();
        render();
        window.IcNotify?.success?.(tr("Usuário excluído"));
        return;
      }
      // Abrir/fechar um nível (o checkbox do cabeçalho não alterna a lista)
      const head = t.closest("[data-fu-expand]");
      if (head && !t.closest("[data-fu-all]")) {
        const box = head.closest(".fu-level");
        const open = box.classList.toggle("is-open");
        open ? ui.open.add(box.dataset.level) : ui.open.delete(box.dataset.level);
      }
    });

    document.addEventListener("change", (e) => {
      if (!ui || !e.target.closest("#farmUserModal")) return;
      if (e.target.matches("#fuAdmin")) { ui.admin = e.target.checked; syncLevels(); return; }
      const box = e.target.closest(".fu-level");
      if (!box) return;
      const level = box.dataset.level;
      if (e.target.matches("[data-fu-all]")) assignAll(level, e.target.checked);
      else if (e.target.matches("[data-fu-eq]")) {
        const eq = e.target.closest("[data-eq]").dataset.eq;
        if (e.target.checked) ui.levels[eq] = level; // sai do nível anterior, se houver
        else delete ui.levels[eq];
      } else return;
      syncLevels();
    });

    document.addEventListener("input", (e) => {
      if (ui && e.target.matches("#fuEmail")) { ui.email = e.target.value; setEmailError(""); }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && ui?.step === 1 && e.target.matches?.("#fuEmail")) { e.preventDefault(); goNext(); }
    });
  }

  window.IcFarmUsers = { render, openInvite, openAbout };
})();
