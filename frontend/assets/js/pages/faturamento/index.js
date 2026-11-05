(function () {
    "use strict";
  const tMsg = (text) => window.IcI18n?.t?.(text) ?? text;

    const state = { isOpen: false };
    const $ = (id) => document.getElementById(id);
    const D = () => window.IcBillingData;
    const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    // Persistência do(s) cartão(ões) cadastrado(s) — mock local (sem backend ainda).
    // Necessário porque o overlay de faturamento é recarregado via fetch a cada
    // abertura (innerHTML é substituído), então o cartão precisa sobreviver a isso.
    const CARDS_KEY = "ic:faturamento:cards";

    // ---------------------------------------------------------------------------
    // Países e regras de campos (o formulário serve para qualquer local)
    // ---------------------------------------------------------------------------

    // Regras específicas (rótulos/placeholders no idioma local). Países sem regra própria
    // usam GENERIC_RULES + o tipo de documento de DOCS (ou DEFAULT_DOCS).
    const BILLING_COUNTRY_RULES = {
        BR: {
            postal: { label: "CEP", placeholder: "00000-000" },
            city: { label: "Cidade", placeholder: "Ex: Goiânia" },
            region: { label: "Estado (UF)", placeholder: "Ex: SP" },
            address: { label: "Endereço", placeholder: "Ex: Av. Brasil, 120" },
            docTypes: [
                { value: "cpf", label: "CPF (Cadastro de Pessoa Física)", placeholder: "000.000.000-00" },
                { value: "cnpj", label: "CNPJ (Cadastro Nacional da Pessoa Jurídica)", placeholder: "00.000.000/0000-00" },
            ],
        },
        US: {
            postal: { label: "CEP (ZIP Code)", placeholder: "10001" },
            city: { label: "Cidade", placeholder: "New York" },
            region: { label: "Estado", placeholder: "NY" },
            address: { label: "Endereço", placeholder: "123 Main St" },
            docTypes: [
                { value: "ssn", label: "SSN", placeholder: "000-00-0000" },
                { value: "ein", label: "EIN", placeholder: "00-0000000" },
            ],
        },
        DE: {
            postal: { label: "Código postal", placeholder: "10115" },
            city: { label: "Cidade", placeholder: "Berlin" },
            region: { label: "Estado", placeholder: "" },
            address: { label: "Rua e número", placeholder: "Musterstrasse 12" },
            docTypes: [{ value: "vat", label: "VAT", placeholder: "DE000000000" }],
        },
        ZA: {
            postal: { label: "Código postal", placeholder: "8001" },
            city: { label: "Cidade", placeholder: "Cape Town" },
            region: { label: "Província", placeholder: "Western Cape" },
            address: { label: "Endereço", placeholder: "123 Main Rd" },
            docTypes: [{ value: "id", label: "Número de identidade", placeholder: "0000000000000" }],
        },
    };

    const GENERIC_RULES = {
        postal: { label: "Código postal", placeholder: "" },
        city: { label: "Cidade", placeholder: "" },
        region: { label: "Estado / Província", placeholder: "" },
        address: { label: "Endereço", placeholder: "" },
    };

    const DEFAULT_DOCS = [
        { value: "taxid", label: "Documento fiscal (Tax ID)", placeholder: "" },
        { value: "passport", label: "Passaporte / Documento de identidade", placeholder: "" },
    ];

    const DOCS = {
        AR: [{ value: "cuit", label: "CUIT", placeholder: "00-00000000-0" }, { value: "dni", label: "DNI", placeholder: "00000000" }],
        CL: [{ value: "rut", label: "RUT", placeholder: "00.000.000-0" }],
        CO: [{ value: "nit", label: "NIT", placeholder: "000.000.000-0" }],
        PE: [{ value: "ruc", label: "RUC", placeholder: "00000000000" }],
        PY: [{ value: "ruc", label: "RUC", placeholder: "00000000-0" }],
        UY: [{ value: "rut", label: "RUT", placeholder: "000000000000" }],
        MX: [{ value: "rfc", label: "RFC", placeholder: "XAXX010101000" }],
        PT: [{ value: "nif", label: "NIF", placeholder: "000000000" }],
        ES: [{ value: "nif", label: "NIF / NIE", placeholder: "X0000000X" }],
        FR: [{ value: "vat", label: "TVA (VAT)", placeholder: "FR00000000000" }],
        IT: [{ value: "vat", label: "Partita IVA", placeholder: "00000000000" }],
        GB: [{ value: "vat", label: "VAT", placeholder: "GB000000000" }],
        CA: [{ value: "bn", label: "Business Number (BN)", placeholder: "000000000" }],
    };

    const COUNTRY_CODES = [
        "BR", "AR", "BO", "CL", "CO", "EC", "PY", "PE", "UY", "VE", "MX", "US", "CA",
        "PT", "ES", "FR", "DE", "IT", "GB", "IE", "NL", "BE", "CH", "AT", "SE", "NO", "DK", "FI", "PL",
        "ZA", "MZ", "AO", "NA", "ZM", "KE", "NG", "EG", "MA",
        "AE", "SA", "IL", "TR", "IN", "CN", "JP", "KR", "ID", "AU", "NZ", "RU", "UA",
    ];

    function countryName(code) {
        try {
            return new Intl.DisplayNames([D().locale()], { type: "region" }).of(code) || code;
        } catch (err) {
            return code;
        }
    }

    function getCountries() {
        const list = COUNTRY_CODES.map((code) => ({ code, name: countryName(code) }));
        const rest = list.filter((c) => c.code !== "BR").sort((a, b) => a.name.localeCompare(b.name, D().locale()));
        return [list.find((c) => c.code === "BR"), ...rest];
    }

    function rulesFor(code) {
        if (BILLING_COUNTRY_RULES[code]) return BILLING_COUNTRY_RULES[code];
        return { ...GENERIC_RULES, docTypes: DOCS[code] || DEFAULT_DOCS };
    }

    const BR_STATES = [
        ["AC", "Acre"], ["AL", "Alagoas"], ["AP", "Amapá"], ["AM", "Amazonas"], ["BA", "Bahia"],
        ["CE", "Ceará"], ["DF", "Distrito Federal"], ["ES", "Espírito Santo"], ["GO", "Goiás"],
        ["MA", "Maranhão"], ["MT", "Mato Grosso"], ["MS", "Mato Grosso do Sul"], ["MG", "Minas Gerais"],
        ["PA", "Pará"], ["PB", "Paraíba"], ["PR", "Paraná"], ["PE", "Pernambuco"], ["PI", "Piauí"],
        ["RJ", "Rio de Janeiro"], ["RN", "Rio Grande do Norte"], ["RS", "Rio Grande do Sul"],
        ["RO", "Rondônia"], ["RR", "Roraima"], ["SC", "Santa Catarina"], ["SP", "São Paulo"],
        ["SE", "Sergipe"], ["TO", "Tocantins"],
    ];

    function setBillingFieldRule(inputId, cfg) {
        const input = $(inputId);
        if (!input || !cfg) return;
        input.placeholder = cfg.placeholder || "";
        const label = input.closest(".edit-panel__field")?.querySelector("label");
        if (!label) return;
        const req = label.querySelector(".edit-panel__req");
        label.textContent = "";
        if (req) {
            label.appendChild(req);
            label.appendChild(document.createTextNode(" " + cfg.label));
        } else {
            label.textContent = cfg.label;
        }
    }

    function buildRegionMenu(wrapper) {
        const menu = wrapper.querySelector(".edit-panel__select-menu");
        const labelEl = wrapper.querySelector("#farmRegionLabel");
        const hidden = wrapper.querySelector("#farmEditBillingRegion");
        if (!menu || menu.dataset.built) return;
        menu.dataset.built = "1";
        BR_STATES.forEach(([uf, name]) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "edit-panel__select-option";
            btn.textContent = name;
            btn.addEventListener("click", () => {
                hidden.value = uf;
                labelEl.textContent = name;
                labelEl.style.color = "";
                menu.querySelectorAll(".edit-panel__select-option").forEach((b) => b.classList.remove("is-active"));
                btn.classList.add("is-active");
                wrapper.classList.remove("is-open");
            });
            menu.appendChild(btn);
        });
    }

    // Estado (UF) vira lista (dropdown customizado) só para o Brasil; para os demais países, campo de texto livre.
    function setBillingRegionField(code, cfg) {
        if (!cfg) return;

        if (code === "BR") {
            const current = $("farmEditBillingRegion");
            let wrapper = $("farmRegionField");
            const alreadyDropdown = wrapper && current && current.tagName === "INPUT" && current.type === "hidden";
            if (!alreadyDropdown) {
                wrapper = document.createElement("div");
                wrapper.className = "edit-panel__select-field";
                wrapper.id = "farmRegionField";
                wrapper.innerHTML = `
                    <button type="button" class="edit-panel__select-btn" onclick="event.stopPropagation(); this.parentElement.classList.toggle('is-open')" onblur="setTimeout(() => this.parentElement.classList.remove('is-open'), 200)" style="display:flex; align-items:center;">
                        <span id="farmRegionLabel" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block; padding-right:12px; color:#94a3b8;">Selecione o estado</span>
                        <i class="fa-solid fa-chevron-down" style="position:absolute; right:10px;"></i>
                    </button>
                    <div class="edit-panel__select-menu"></div>
                    <input type="hidden" id="farmEditBillingRegion" value="">
                `;
                if (current) current.replaceWith(wrapper);
            }
            buildRegionMenu(wrapper);
        } else {
            const wrapper = $("farmRegionField");
            if (wrapper) {
                const input = document.createElement("input");
                input.type = "text";
                input.className = "edit-panel__input";
                input.id = "farmEditBillingRegion";
                wrapper.replaceWith(input);
            }
        }

        setBillingFieldRule("farmEditBillingRegion", cfg);
    }

    function rebuildBillingDocTypes(docTypes) {
        const field = $("billingDocTypeField");
        const menu = field?.querySelector(".edit-panel__select-menu");
        const hidden = $("farmEditBillingDocType");
        const labelEl = $("farmDocTypeLabel");
        const numberInput = $("farmEditBillingDocNumber");
        if (!field || !menu || !hidden || !docTypes?.length) return;

        menu.innerHTML = "";
        docTypes.forEach((dt, i) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "edit-panel__select-option" + (i === 0 ? " is-active" : "");
            btn.textContent = dt.label;
            btn.addEventListener("click", () => {
                hidden.value = dt.value;
                if (labelEl) labelEl.textContent = dt.label;
                menu.querySelectorAll(".edit-panel__select-option").forEach((b) => b.classList.remove("is-active"));
                btn.classList.add("is-active");
                field.classList.remove("is-open");
                if (numberInput) numberInput.placeholder = dt.placeholder || "";
            });
            menu.appendChild(btn);
        });

        hidden.value = docTypes[0].value;
        if (labelEl) labelEl.textContent = docTypes[0].label;
        if (numberInput) numberInput.placeholder = docTypes[0].placeholder || "";
    }

    function setDocType(value) {
        const code = $("farmEditBillingCountry")?.value;
        const docTypes = rulesFor(code).docTypes;
        const idx = docTypes.findIndex((dt) => dt.value === value);
        if (idx < 0) return;
        const menu = $("billingDocTypeField")?.querySelector(".edit-panel__select-menu");
        menu?.querySelectorAll(".edit-panel__select-option")[idx]?.click();
    }

    function applyBillingCountry(code) {
        const rules = rulesFor(code);
        setBillingFieldRule("farmEditBillingPostal", rules.postal);
        setBillingFieldRule("farmEditBillingCity", rules.city);
        setBillingRegionField(code, rules.region);
        setBillingFieldRule("farmEditBillingAddress", rules.address);
        rebuildBillingDocTypes(rules.docTypes);
    }

    function selectCountry(code) {
        const hidden = $("farmEditBillingCountry");
        if (!hidden) return;
        hidden.value = code;
        const label = $("billingCountryLabel");
        if (label) label.textContent = countryName(code);
        const field = $("billingCountryField");
        field?.classList.remove("is-open");
        field?.querySelectorAll(".edit-panel__select-option").forEach((b) => {
            b.classList.toggle("is-active", b.dataset.code === code);
        });
        applyBillingCountry(code);
        renderMethodTabs();
    }

    function buildCountryMenu() {
        const menu = $("billingCountryMenu");
        if (!menu) return;
        menu.innerHTML = "";
        const selected = $("farmEditBillingCountry")?.value;
        getCountries().forEach(({ code, name }) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "edit-panel__select-option";
            btn.dataset.code = code;
            btn.textContent = name;
            btn.classList.toggle("is-active", code === selected);
            btn.addEventListener("click", () => selectCountry(code));
            menu.appendChild(btn);
        });
        const label = $("billingCountryLabel");
        if (label && selected) label.textContent = countryName(selected);
    }

    window.IcFaturamentoBilling = { applyCountry: applyBillingCountry };

    // Máscara de CPF/CNPJ conforme o usuário digita (respeita o tipo selecionado, não a quantidade de dígitos).
    function maskCpfCnpj(rawValue, isCnpj) {
        const digits = rawValue.replace(/\D/g, "").slice(0, isCnpj ? 14 : 11);
        if (!isCnpj) {
            return digits
                .replace(/(\d{3})(\d)/, "$1.$2")
                .replace(/(\d{3})(\d)/, "$1.$2")
                .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
        }
        return digits
            .replace(/^(\d{2})(\d)/, "$1.$2")
            .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
            .replace(/\.(\d{3})(\d)/, ".$1/$2")
            .replace(/(\d{4})(\d)/, "$1-$2");
    }

    // ---------------------------------------------------------------------------
    // Dados de faturamento salvos (endereço + informações)
    // ---------------------------------------------------------------------------
    const FORM_FIELDS = {
        country: "farmEditBillingCountry",
        postal: "farmEditBillingPostal",
        city: "farmEditBillingCity",
        region: "farmEditBillingRegion",
        address: "farmEditBillingAddress",
        docType: "farmEditBillingDocType",
        docNumber: "farmEditBillingDocNumber",
        name: "farmEditBillingName",
        phone: "farmEditBillingPhone",
        email: "farmEditBillingEmail",
        lang: "farmEditBillingEmailLanguage",
    };
    const REQUIRED_FIELDS = ["country", "postal", "city", "region", "address", "docNumber", "name", "email"];

    function collectBilling() {
        const data = {};
        Object.entries(FORM_FIELDS).forEach(([key, id]) => {
            data[key] = ($(id)?.value || "").trim();
        });
        return data;
    }

    function markInvalid(id, invalid) {
        const el = $(id);
        if (!el) return;
        const target = el.type === "hidden" ? el.closest(".edit-panel__select-field") : el;
        target?.classList.toggle("is-invalid", invalid);
    }

    function validateBilling() {
        const data = collectBilling();
        let ok = true;
        REQUIRED_FIELDS.forEach((key) => {
            let invalid = !data[key];
            if (key === "email" && data.email) invalid = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email);
            markInvalid(FORM_FIELDS[key], invalid);
            if (invalid) ok = false;
        });
        return ok;
    }

    function saveBilling() {
        localStorage.setItem(D().STORE.billing, JSON.stringify(collectBilling()));
    }

    function restoreBilling() {
        let saved = null;
        try {
            saved = JSON.parse(localStorage.getItem(D().STORE.billing) || "null");
        } catch (err) { /* noop */ }

        // Sem dados salvos, o formulário já vem preenchido com o cliente de referência (mock impessoal).
        const data = saved || D().getBilling();
        selectCountry(data.country || "BR");
        if (data.docType) setDocType(data.docType);
        ["postal", "city", "address", "docNumber", "name", "phone", "email"].forEach((key) => {
            const el = $(FORM_FIELDS[key]);
            if (el && data[key]) el.value = data[key];
        });

        const region = $("farmEditBillingRegion");
        if (region && data.region) {
            region.value = data.region;
            if (region.type === "hidden") {
                const name = BR_STATES.find(([uf]) => uf === data.region)?.[1] || data.region;
                const labelEl = $("farmRegionLabel");
                if (labelEl) { labelEl.textContent = name; labelEl.style.color = ""; }
            }
        }

        if (data.lang) {
            $("farmEditBillingEmailLanguage").value = data.lang;
            const langLabel = $("billingLangLabel");
            if (langLabel) langLabel.textContent = data.lang === "en-US" ? "Inglês" : "Português";
            $("billingLangField")?.querySelectorAll(".edit-panel__select-option").forEach((b, i) => {
                b.classList.toggle("is-active", (data.lang === "en-US") === (i === 1));
            });
        }
    }

    // ---------------------------------------------------------------------------
    // Cartões (mock). Em produção o cadastro/edição do cartão é feito no Stripe Elements
    // (PCI): este modal é só a representação da tela. NUNCA guardamos número completo nem
    // CVV — persistimos apenas bandeira, final, titular e validade.
    // ---------------------------------------------------------------------------
    const BRAND_LABEL = { visa: "VISA", mastercard: "MASTERCARD", amex: "AMEX", elo: "ELO" };

    // Cartões: o que o usuário adiciona/edita/exclui fica em pendingCards até clicar em Salvar.
    let pendingCards = null; // null = sem alteração

    // Sem nada salvo ainda, vem o cartão de exemplo (mock impessoal); depois de salvar vale o que o usuário deixou.
    function savedCards() {
        try {
            const raw = localStorage.getItem(CARDS_KEY);
            return raw === null ? D().DEFAULT_CARDS.map((c) => ({ ...c })) : JSON.parse(raw);
        } catch (err) {
            return [];
        }
    }

    const loadCards = () => (pendingCards !== null ? pendingCards : savedCards());

    function saveCards(list) {
        pendingCards = JSON.stringify(list) === JSON.stringify(savedCards()) ? null : list;
        window.IcFaturamentoContract?.renderChanges?.();
    }

    function commitCards() {
        if (pendingCards === null) return;
        localStorage.setItem(CARDS_KEY, JSON.stringify(pendingCards));
        pendingCards = null;
    }

    function cardBrand(card) {
        return card.brand || (card.isMaster ? "mastercard" : "visa");
    }

    function buildCardRow(data) {
        const last4 = data.last4 || "0000";
        const brand = cardBrand(data);
        const name = (data.name || "Sem nome").toUpperCase();
        const exp = data.exp || "--/--";

        const row = document.createElement("div");
        row.className = "fbill-card-row";
        row.dataset.cardId = data.id;
        row.innerHTML =
            `<div class="fbill-card-visual is-${brand}">` +
            `<div class="fbill-card-visual__top"><span class="fbill-card-visual__brand">${BRAND_LABEL[brand]}</span><i class="fa-solid fa-wifi fbill-card-visual__wifi"></i></div>` +
            `<div class="fbill-card-visual__number">•••• •••• •••• ${esc(last4)}</div>` +
            `<div class="fbill-card-visual__bottom"><span class="fbill-card-visual__name">${esc(name)}</span><span>${esc(exp)}</span></div>` +
            `<div class="fbill-card-visual__actions">` +
            `<button type="button" class="fbill-card-visual__action fbill-card-visual__action--edit"><i class="fa-solid fa-pen"></i> Editar</button>` +
            `<button type="button" class="fbill-card-visual__action fbill-card-visual__action--remove"><i class="fa-solid fa-trash"></i> Excluir</button>` +
            `</div>` +
            `</div>`;

        row.querySelector(".fbill-card-visual__action--edit").addEventListener("click", () => {
            window.IcFaturamentoCards.openModal(data.id);
        });

        row.querySelector(".fbill-card-visual__action--remove").addEventListener("click", () => {
            saveCards(loadCards().filter((c) => c.id !== data.id));
            renderCards();
            renderNext();
        });

        return row;
    }

    function renderCards() {
        const methods = $("farmEditPayMethods");
        const empty = $("farmEditPayEmpty");
        const autopay = $("farmEditAutopayAlert");
        const addBtn = $("farmEditAddCard");
        if (!methods) return;

        const cards = loadCards();
        methods.innerHTML = "";
        cards.forEach((c) => methods.appendChild(buildCardRow(c)));

        const has = cards.length > 0;
        methods.style.display = has ? "" : "none";
        if (empty) empty.style.display = has ? "none" : "";
        if (autopay) autopay.style.display = has && D().getMethod() === "card" ? "" : "none";
        if (addBtn) {
            addBtn.style.display = has ? "none" : "";
            if (addBtn.parentElement) addBtn.parentElement.style.display = has ? "none" : "";
        }
    }

    function detectBrand(digits) {
        if (/^(636368|438935|504175|451416|636297|506699|4011|4576|5067)/.test(digits)) return "elo";
        if (/^4/.test(digits)) return "visa";
        if (/^(5[1-5]|222[1-9]|22[3-9]|2[3-6]|27[01]|2720)/.test(digits)) return "mastercard";
        if (/^3[47]/.test(digits)) return "amex";
        return "";
    }

    function luhnOk(digits) {
        let sum = 0;
        let dbl = false;
        for (let i = digits.length - 1; i >= 0; i--) {
            let n = Number(digits[i]);
            if (dbl) { n *= 2; if (n > 9) n -= 9; }
            sum += n;
            dbl = !dbl;
        }
        return digits.length > 0 && sum % 10 === 0;
    }

    function formatCardNumber(digits, brand) {
        if (brand === "amex") {
            return digits.slice(0, 15).replace(/^(\d{4})(\d{0,6})(\d{0,5}).*/, (m, a, b, c) => [a, b, c].filter(Boolean).join(" "));
        }
        return digits.slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
    }

    function expiryValid(value) {
        const m = /^(\d{2})\/(\d{2})$/.exec(value);
        if (!m) return false;
        const month = Number(m[1]);
        const year = 2000 + Number(m[2]);
        if (month < 1 || month > 12) return false;
        const now = new Date();
        return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
    }

    function closeCardModal() {
        const modal = $("fbillCardModal");
        if (!modal) return;
        modal.classList.remove("is-open");
        document.removeEventListener("keydown", onModalKey);
        setTimeout(() => modal.remove(), 180);
    }

    function onModalKey(e) {
        if (e.key === "Escape") closeCardModal();
    }

    function openCardModal(editId) {
        $("fbillCardModal")?.remove();
        const editing = editId ? loadCards().find((c) => c.id === editId) : null;

        const modal = document.createElement("div");
        modal.className = "fbill-modal";
        modal.id = "fbillCardModal";
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        modal.setAttribute("aria-labelledby", "fbillCardModalTitle");
        modal.innerHTML = `
            <div class="fbill-modal__backdrop" data-close></div>
            <div class="fbill-modal__dialog">
              <div class="fbill-modal__head">
                <h3 id="fbillCardModalTitle">${editing ? "Editar cartão" : "Adicionar cartão"}</h3>
                <button type="button" class="fbill-modal__close" data-close aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>
              </div>
              <div class="fbill-modal__body fbill-card-form__cols">
                <div class="fbill-card-form__grid">
                  <div class="edit-panel__field fbill-card-form__full">
                    <label for="fbillCcNumber"><span class="edit-panel__req">*</span> Número do cartão</label>
                    <input class="edit-panel__input" id="fbillCcNumber" type="text" inputmode="numeric" autocomplete="off" placeholder="0000 0000 0000 0000">
                    <div class="fbill-field-error" data-err="number"></div>
                  </div>
                  <div class="edit-panel__field fbill-card-form__full">
                    <label for="fbillCcName"><span class="edit-panel__req">*</span> Nome impresso no cartão</label>
                    <input class="edit-panel__input" id="fbillCcName" type="text" autocomplete="off" placeholder="Como aparece no cartão">
                    <div class="fbill-field-error" data-err="name"></div>
                  </div>
                  <div class="edit-panel__field">
                    <label for="fbillCcExp"><span class="edit-panel__req">*</span> Validade</label>
                    <input class="edit-panel__input" id="fbillCcExp" type="text" inputmode="numeric" autocomplete="off" placeholder="MM/AA">
                    <div class="fbill-field-error" data-err="exp"></div>
                  </div>
                  <div class="edit-panel__field" id="fbillCcCvvField">
                    <label for="fbillCcCvv"><span class="edit-panel__req">*</span> CVV</label>
                    <input class="edit-panel__input" id="fbillCcCvv" type="password" inputmode="numeric" autocomplete="off" placeholder="000">
                    <div class="fbill-field-error" data-err="cvv"></div>
                  </div>
                  <div class="fbill-card-form__note fbill-card-form__full"><i class="fa-solid fa-lock"></i> <span>Os dados do cartão são processados com segurança pelo Stripe. Não armazenamos o número completo nem o CVV.</span></div>
                </div>
                <div>
                  <div class="fbill-cc-preview" id="fbillCcPreview">
                    <div class="fbill-cc-preview__top"><span class="fbill-cc-preview__brand" id="fbillCcBrand">CARTÃO</span><i class="fa-solid fa-wifi fbill-cc-preview__wifi"></i></div>
                    <div class="fbill-cc-preview__number" id="fbillCcPreviewNumber">•••• •••• •••• ••••</div>
                    <div class="fbill-cc-preview__bottom"><span class="fbill-cc-preview__name" id="fbillCcPreviewName">NOME NO CARTÃO</span><span id="fbillCcPreviewExp">MM/AA</span></div>
                  </div>
                  <div class="fbill-cc-secure"><i class="fa-solid fa-shield-halved"></i> <span>Pagamento seguro via Stripe</span></div>
                </div>
              </div>
              <div class="fbill-modal__foot">
                <button type="button" class="fbill-btn fbill-btn--neutral" data-close>Cancelar</button>
                <button type="button" class="fbill-btn fbill-btn--primary" id="fbillCcSave">${editing ? "Salvar alterações" : "Salvar cartão"}</button>
              </div>
            </div>`;
        document.body.appendChild(modal);

        const q = (id) => modal.querySelector("#" + id);
        const numberEl = q("fbillCcNumber");
        const nameEl = q("fbillCcName");
        const expEl = q("fbillCcExp");
        const cvvEl = q("fbillCcCvv");
        const preview = q("fbillCcPreview");
        const setErr = (key, msg) => {
            const el = modal.querySelector(`[data-err="${key}"]`);
            if (el) el.textContent = msg || "";
        };

        function paintPreview() {
            const digits = numberEl.value.replace(/\D/g, "");
            const brand = editing ? cardBrand(editing) : detectBrand(digits);
            preview.className = "fbill-cc-preview" + (brand ? ` is-${brand}` : "");
            q("fbillCcBrand").textContent = BRAND_LABEL[brand] || "CARTÃO";
            q("fbillCcPreviewNumber").textContent = editing
                ? `•••• •••• •••• ${editing.last4}`
                : (formatCardNumber(digits.padEnd(16, "•"), brand) || "•••• •••• •••• ••••");
            q("fbillCcPreviewName").textContent = (nameEl.value || "NOME NO CARTÃO").toUpperCase();
            q("fbillCcPreviewExp").textContent = expEl.value || "MM/AA";
            cvvEl.maxLength = brand === "amex" ? 4 : 3;
            cvvEl.placeholder = brand === "amex" ? "0000" : "000";
        }

        if (editing) {
            numberEl.value = `•••• •••• •••• ${editing.last4}`;
            numberEl.disabled = true;
            nameEl.value = editing.name || "";
            expEl.value = editing.exp || "";
            q("fbillCcCvvField").style.display = "none";
        } else {
            numberEl.addEventListener("input", () => {
                const digits = numberEl.value.replace(/\D/g, "").slice(0, 16);
                numberEl.value = formatCardNumber(digits, detectBrand(digits));
                paintPreview();
            });
        }
        nameEl.addEventListener("input", paintPreview);
        expEl.addEventListener("input", () => {
            const d = expEl.value.replace(/\D/g, "").slice(0, 4);
            expEl.value = d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d;
            paintPreview();
        });
        cvvEl.addEventListener("input", () => { cvvEl.value = cvvEl.value.replace(/\D/g, ""); });

        q("fbillCcSave").addEventListener("click", () => {
            ["number", "name", "exp", "cvv"].forEach((k) => setErr(k, ""));
            let ok = true;

            const digits = numberEl.value.replace(/\D/g, "");
            const brand = editing ? cardBrand(editing) : detectBrand(digits);
            if (!editing) {
                const lenOk = brand === "amex" ? digits.length === 15 : digits.length === 16;
                if (!lenOk || !luhnOk(digits)) { setErr("number", "Número de cartão inválido."); ok = false; }
                const cvvLen = brand === "amex" ? 4 : 3;
                if (cvvEl.value.length !== cvvLen) { setErr("cvv", D().tr("Informe os {n} dígitos do CVV.", { n: cvvLen })); ok = false; }
            }
            if (nameEl.value.trim().length < 2) { setErr("name", "Informe o nome impresso no cartão."); ok = false; }
            if (!expiryValid(expEl.value)) { setErr("exp", "Validade inválida ou vencida."); ok = false; }
            if (!ok) return;

            const cards = loadCards();
            if (editing) {
                const idx = cards.findIndex((c) => c.id === editing.id);
                if (idx > -1) cards[idx] = { ...cards[idx], name: nameEl.value.trim(), exp: expEl.value };
            } else {
                cards.push({
                    id: Date.now() + Math.random().toString(16).slice(2),
                    last4: digits.slice(-4),
                    brand: brand || "visa",
                    name: nameEl.value.trim(),
                    exp: expEl.value,
                });
            }
            saveCards(cards);
            closeCardModal();
            renderCards();
            renderNext();
        });

        modal.addEventListener("click", (e) => {
            if (e.target.closest("[data-close]")) closeCardModal();
        });
        document.addEventListener("keydown", onModalKey);

        paintPreview();
        requestAnimationFrame(() => {
            modal.classList.add("is-open");
            (editing ? nameEl : numberEl).focus();
        });
    }

    window.IcFaturamentoCards = { openModal: openCardModal };

    // ---------------------------------------------------------------------------
    // Métodos de pagamento: Brasil = cartão, boleto e PIX; demais países = só cartão
    // ---------------------------------------------------------------------------
    const METHODS = [
        { key: "card", label: "Cartão de crédito", icon: "fa-regular fa-credit-card" },
        { key: "boleto", label: "Boleto", icon: "fa-solid fa-barcode", countries: ["BR"] },
        { key: "pix", label: "PIX", icon: "fa-brands fa-pix", countries: ["BR"] },
    ];

    function billingCountry() {
        return $("farmEditBillingCountry")?.value || "BR";
    }

    function availableMethods() {
        const country = billingCountry();
        return METHODS.filter((m) => !m.countries || m.countries.includes(country));
    }

    function showMethodPanel(key) {
        const root = $("faturamentoPanel");
        if (!root) return;
        root.querySelectorAll(".fbill-pm-panel").forEach((p) => { p.hidden = p.dataset.panel !== key; });
        root.querySelectorAll("#fbillMethodTabs .fbill-method-tab").forEach((t) => {
            const on = t.dataset.method === key;
            t.classList.toggle("is-active", on);
            t.setAttribute("aria-selected", on ? "true" : "false");
        });
        renderCards();
    }

    function setMethod(key) {
        D().setMethod(key);
        showMethodPanel(key);
        renderNext();
        window.IcFaturamentoContract?.renderChanges?.();
    }

    function renderMethodTabs() {
        const wrap = $("fbillMethodTabs");
        if (!wrap) return;
        const methods = availableMethods();
        let active = D().getMethod();
        if (!methods.some((m) => m.key === active)) {
            active = "card";
            D().setMethod(active);
        }
        wrap.innerHTML = "";
        methods.forEach((m) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "fbill-method-tab";
            btn.dataset.method = m.key;
            btn.setAttribute("role", "tab");
            btn.innerHTML = `<i class="${m.icon}"></i><span>${m.label}</span>`;
            btn.addEventListener("click", () => setMethod(m.key));
            wrap.appendChild(btn);
        });
        showMethodPanel(active);
        renderNext();
    }

    function copyText(text) {
        const done = () => (window.IcNotify?.success || alert)("Copiado para a área de transferência.");
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, done);
        else done();
    }

    // QR Code ilustrativo (padrão determinístico — não é um QR real).
    function mockQrSvg(seed) {
        const n = 25;
        let h = 2166136261;
        for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
        h = h || 1;
        const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
        const finder = (x, y) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
        let cells = "";
        for (let y = 0; y < n; y++) {
            for (let x = 0; x < n; x++) {
                let on;
                if (finder(x, y)) {
                    const fx = x < 7 ? x : x - (n - 7);
                    const fy = y < 7 ? y : y - (n - 7);
                    on = fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4);
                } else {
                    on = rnd() > 0.5;
                }
                if (on) cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
            }
        }
        return `<svg viewBox="-1 -1 ${n + 2} ${n + 2}" width="168" height="168" shape-rendering="crispEdges" aria-label="QR Code ilustrativo"><rect x="-1" y="-1" width="${n + 2}" height="${n + 2}" fill="#fff"/><g fill="#0f172a">${cells}</g></svg>`;
    }

    function showPix() {
        const box = $("fbillPixBox");
        if (!box) return;
        const inv = D().getInvoices()[0];
        const code = `00020126360014br.gov.bcb.pix0114+0000000000005204000053039865802BR5913IRRICONTROL6007GOIANIA62070503***${inv.number.replace(/\D/g, "")}6304ABCD`;
        box.hidden = false;
        box.innerHTML = `
            <div class="fbill-pix__qr">${mockQrSvg(inv.number)}</div>
            <div class="fbill-pix__info">
              <div class="fbill-pix__amount">${D().money(inv.total)}</div>
              <div class="fbill-pix__due">${esc(D().tr("Vencimento em {d}", { d: D().fmtLong(inv.dueDate) }))}</div>
              <div class="fbill-pix__label">PIX copia e cola</div>
              <div class="fbill-pix__code"><code>${esc(code)}</code><button type="button" class="fbill-btn fbill-btn--outline-primary" id="fbillPixCopy"><i class="fa-regular fa-copy"></i> Copiar código</button></div>
            </div>`;
        $("fbillPixCopy")?.addEventListener("click", () => copyText(code));
    }

    window.IcFaturamentoPayment = { showPix };

    // ---------------------------------------------------------------------------
    // Próxima cobrança, cupom, anuidade e histórico (tudo calculado de IcBillingData)
    // ---------------------------------------------------------------------------
    const STATUS = {
        pending: { label: "Em aberto", rowLabel: "Em aberto", pill: "pending", filter: "Pendente" },
        overdue: { label: "Vencida", rowLabel: "Vencido", pill: "overdue", filter: "Vencido" },
        paid: { label: "Paga", rowLabel: "Pago", pill: "paid", filter: "Pago" },
    };

    function billedEquipmentCount(inv) {
        return inv.items.filter((it) => !it.adj && it.key !== "api").reduce((sum, it) => sum + it.qty, 0);
    }

    function receiptUrl(inv, methodLabel) {
        const q = new URLSearchParams({
            status: inv.status,
            amount: D().money(inv.total),
            number: inv.number,
            date: D().fmtLong(inv.status === "paid" && inv.paidAt ? inv.paidAt : inv.dueDate),
            method: methodLabel || inv.method,
        });
        return "./pages/fatura-recibo.html?" + q.toString();
    }

    function downloadUrl(inv) {
        return "./pages/fatura-detalhes.html?" + new URLSearchParams({ number: inv.number, status: inv.status, download: "1" }).toString();
    }

    function daysLabel(one, many, n) {
        return D().tr(n === 1 ? one : many, { n });
    }

    function nextStatusCell(inv, days) {
        const st = STATUS[inv.status];
        const cards = loadCards();
        const method = D().getMethod();
        let sub;
        let subClass = "fbill-tile__sub";
        if (inv.status === "paid") {
            sub = esc(D().tr("Pago em {d}.", { d: D().fmtShort(inv.paidAt) }));
        } else if (inv.status === "overdue") {
            sub = `<strong>Pagamento em atraso.</strong> ${esc(daysLabel("Venceu há {n} dia.", "Venceu há {n} dias.", Math.abs(days)))}<br>Regularize para evitar o bloqueio do acesso à fazenda.`;
            subClass += " fbill-tile__sub--danger";
        } else if (method === "card") {
            sub = cards.length
                ? esc(D().tr("Cobrança automática no cartão •••• {l}.", { l: cards[0].last4 }))
                : "Cadastre um cartão para habilitar a cobrança automática.";
        } else {
            sub = esc(D().tr("Pagamento manual via {m}.", { m: D().tr(D().getMethodLabel()) }));
        }
        const action = inv.status === "paid"
            ? ""
            : `<button type="button" class="fbill-btn ${inv.status === "overdue" ? "fbill-btn--danger" : "fbill-btn--primary"} fbill-btn--sm" onclick="window.IcFaturamentoInvoices.pay()"><i class="fa-solid fa-wallet"></i> Pagar agora</button>`;
        return `
            <div class="fbill-next__cell">
              <div class="fbill-tile__label fbill-tile__label--with-action"><span><i class="fa-solid fa-circle-info"></i> Status</span>${action}</div>
              <div class="fbill-next__status"><span class="fbill-pill fbill-pill--${st.pill}">${st.label}</span></div>
              <div class="${subClass}">${sub}</div>
            </div>`;
    }

    // Cupom: o campo fica na aba Contratação (contract.js); a próxima cobrança só mostra o resumo.
    function renderCoupon(inv) {
        if (inv.status === "paid") return "";
        const saved = D().savedCouponCodes();
        const rows = inv.coupons.map((c) => `
                  <div class="fbill-coupon__item">
                    <div class="fbill-coupon__applied">
                      <i class="fa-solid fa-ticket"></i>
                      <span class="fbill-coupon__code">${esc(c.code)}</span>
                      <span class="fbill-coupon__desc">${esc(D().couponLabel(c))}${saved.includes(c.code) ? "" : ' <span class="fbill-tag">Não salvo</span>'}</span>
                      <button type="button" class="fbill-coupon__remove" onclick="window.IcFaturamentoCoupon.remove('${esc(c.code)}')">Remover</button>
                    </div>
                    <div class="fbill-coupon__scope">${esc(D().tr("Aplicado em: {items}", { items: D().couponScope(c).join(", ") }))}</div>
                  </div>`).join("");
        return `
            <div class="fbill-coupon">
              ${rows}
              <button type="button" class="fbill-coupon__toggle" id="fbillCouponToggle" onclick="window.IcFaturamentoCoupon.toggle()"><i class="fa-solid fa-ticket"></i> ${inv.coupons.length ? "Adicionar outro cupom de desconto" : "Adicionar cupom de desconto"}</button>
              <div class="fbill-coupon__form" id="fbillCouponForm" hidden>
                <input class="edit-panel__input" id="fbillCouponInput" type="text" placeholder="Código do cupom" autocomplete="off" maxlength="24"
                       onkeydown="if(event.key==='Enter'){event.preventDefault();window.IcFaturamentoCoupon.apply();}">
                <button type="button" class="fbill-btn fbill-btn--outline-primary" onclick="window.IcFaturamentoCoupon.apply()">Aplicar</button>
              </div>
              <div class="fbill-field-error" id="fbillCouponError"></div>
            </div>`;
    }

    // Resumo na próxima cobrança: cupom aplicado ou atalho para a tela de anuidade.
    function renderCouponHint(inv) {
        if (inv.status === "paid") return "";
        if (inv.coupons.length) {
            return `
                <div class="fbill-coupon">
                  ${inv.coupons.map((c) => `<div class="fbill-coupon__applied">
                    <i class="fa-solid fa-ticket"></i>
                    <span class="fbill-coupon__code">${esc(c.code)}</span>
                    <span class="fbill-coupon__desc">${esc(D().couponLabel(c))}</span>
                  </div>`).join("")}
                </div>`;
        }
        return `
            <div class="fbill-coupon">
              <button type="button" class="fbill-coupon__toggle" onclick="window.IcFaturamentoInvoices.showSubscription()"><i class="fa-solid fa-ticket"></i> Adicionar cupom de desconto</button>
            </div>`;
    }

    function renderNext() {
        const box = $("fbillNext");
        if (!box || !D()) return;
        const inv = D().getInvoices()[0];
        const days = D().daysBetween(new Date(), inv.dueDate);
        const dueSub = inv.status === "paid"
            ? "Ciclo quitado"
            : days > 0 ? daysLabel("em {n} dia", "em {n} dias", days) : days === 0 ? "vence hoje" : daysLabel("venceu há {n} dia", "venceu há {n} dias", Math.abs(days));
        const hasDiscount = inv.discount > 0;

        box.innerHTML = `
            <div class="fbill-next__grid">
              <div class="fbill-next__cell">
                <div class="fbill-tile__label"><i class="fa-solid fa-calendar-day"></i> Próxima cobrança</div>
                <div class="fbill-tile__value">${D().fmtShort(inv.dueDate)}</div>
                <div class="fbill-tile__sub">${dueSub}</div>
              </div>
              <div class="fbill-next__cell">
                <div class="fbill-tile__label"><i class="fa-solid fa-money-bill-wave"></i> Valor esperado</div>
                <div class="fbill-tile__value">${hasDiscount ? `<s class="fbill-next__old">${D().money(inv.subtotal)}</s>` : ""}${D().money(inv.total)}</div>
                <div class="fbill-tile__sub">${esc(D().tr("{n} equipamentos cobrados", { n: billedEquipmentCount(inv) }))} · <button type="button" class="fbill-link-btn" onclick="window.IcFaturamentoInvoices.showDetails()">Ver detalhes</button></div>
              </div>
              ${nextStatusCell(inv, days)}
            </div>
            ${renderCouponHint(inv)}`;
    }

    window.IcFaturamentoCoupon = {
        html: renderCoupon,
        toggle() {
            const form = $("fbillCouponForm");
            if (!form) return;
            form.hidden = !form.hidden;
            if (!form.hidden) $("fbillCouponInput")?.focus();
        },
        apply() {
            const code = $("fbillCouponInput")?.value || "";
            const err = $("fbillCouponError");
            if (!code.trim()) { if (err) err.textContent = "Informe o código do cupom."; return; }
            const previous = D().pending.coupons;
            const coupon = D().applyCoupon(code);
            if (!coupon) { if (err) err.textContent = "Cupom inválido ou expirado."; return; }
            if (coupon.already) { if (err) err.textContent = "Este cupom já está aplicado."; return; }
            const inv = D().getInvoices()[0];
            if (!inv.items.some((it) => !it.adj && (!coupon.items || coupon.items.includes(it.key)))) {
                D().pending.coupons = previous;
                if (err) err.textContent = "Este cupom não se aplica aos itens da fatura.";
                return;
            }
            refreshAll();
        },
        remove(code) {
            D().removeCoupon(code);
            refreshAll();
        },
    };

    // Valor da linha: com cupom mostra o original riscado e o líquido.
    function lineAmount(it) {
        const fmt = (v) => (v < 0 ? "− " + D().money(-v) : D().money(v));
        return it.discount > 0 ? `<s class="fbill-next__old">${fmt(it.subtotal)}</s>${fmt(it.subtotal - it.discount)}` : fmt(it.subtotal);
    }

    // Extrato do ciclo vigente: contratação inicial + alterações do período (com inclusões/descontos
    // proporcionais) = total da anuidade no período.
    function cycleStatementHtml() {
        const st = D().getCycleStatement();
        const signed = (v) => (v < 0 ? "− " : v > 0 ? "+ " : "") + D().money(Math.abs(v));
        const initial = st.initial;
        const initialRows = initial.items.map((it) => `
            <tr>
              <td><div class="fbill-invoice__item-name">${esc(it.name)}</div><div class="fbill-invoice__item-desc">${esc(it.desc)}</div></td>
              <td class="num">${it.qty}</td>
              <td class="num">${D().money(it.unit)}</td>
              <td class="num">${D().money(it.subtotal)}</td>
            </tr>`).join("");
        const changeRows = st.changes.map((c) => `
            <tr>
              <td>${esc(D().fmtShort(D().parseISO(c.date)))}${c.saved ? "" : ' <span class="fbill-tag">Não salvo</span>'}</td>
              <td><div class="fbill-invoice__item-name">${c.delta > 0 ? "+" : ""}${c.delta} ${esc(c.name)}</div><div class="fbill-invoice__item-desc">${esc(c.devices.join(", "))}</div></td>
              <td><span>${c.delta > 0 ? "Inclusão proporcional" : "Desconto proporcional"}</span></td>
              <td class="num">${c.remaining}</td>
              <td class="num">${signed(c.amount)}</td>
            </tr>`).join("");
        const paidLine = initial.paidAt
            ? ` · <span>${esc(D().tr("Pago em {d}", { d: D().fmtLong(initial.paidAt) }))}</span> · <span>${esc(D().tr(initial.method))}</span>`
            : "";

        return `
            <div class="fbill-annuity__heading"><span>Anuidade do ciclo vigente</span> · ${esc(D().fmtShort(st.cycle.start))} → ${esc(D().fmtShort(st.cycle.end))}</div>

            <div class="fbill-card">
              <div class="fbill-card__head">
                <h3 class="fbill-card__title"><i class="fa-solid fa-file-contract"></i> Assinatura inicial</h3>
              </div>
              <div class="fbill-hint fbill-hint--top"><span>${esc(D().tr("Fatura Nº {n}", { n: initial.number }))}</span>${paidLine}</div>
              <table class="fbill-invoice__table">
                <thead><tr><th>Item</th><th class="num">Qtd.</th><th class="num">Valor unit.</th><th class="num">Subtotal</th></tr></thead>
                <tbody>${initialRows}</tbody>
              </table>
              <div class="fbill-invoice__totals">
                <div class="fbill-invoice__totals-row fbill-invoice__totals-row--balance"><span>Total contratado inicialmente</span><span>${D().money(initial.total)}</span></div>
              </div>
            </div>

            <div class="fbill-card">
              <div class="fbill-card__head">
                <h3 class="fbill-card__title"><i class="fa-solid fa-arrows-up-down"></i> Alterações no período</h3>
              </div>
              ${st.changes.length ? `
              <table class="fbill-invoice__table">
                <thead><tr><th>Data</th><th>Alteração</th><th>Tipo</th><th class="num">Dias restantes</th><th class="num">Valor proporcional</th></tr></thead>
                <tbody>${changeRows}</tbody>
              </table>` : `<div class="fbill-empty"><i class="fa-regular fa-clock"></i><div class="fbill-empty__text">Nenhuma alteração no período.</div></div>`}
              <div class="fbill-invoice__totals">
                <div class="fbill-invoice__totals-row"><span>Total contratado inicialmente</span><span>${D().money(initial.total)}</span></div>
                <div class="fbill-invoice__totals-row"><span>Inclusões proporcionais</span><span>${signed(st.inclusions)}</span></div>
                <div class="fbill-invoice__totals-row"><span>Descontos proporcionais</span><span>${signed(st.discounts)}</span></div>
                <div class="fbill-invoice__totals-row fbill-invoice__totals-row--balance"><span>Total da anuidade no período</span><span>${D().money(st.total)}</span></div>
              </div>
            </div>`;
    }

    function renderAnnuity() {
        const box = $("fbillAnnuity");
        if (!box || !D()) return;
        const inv = D().getInvoices()[0];
        const st = STATUS[inv.status];
        const client = D().getBilling();
        const docLabel = (client.docType || "").toUpperCase();
        const dateLine = esc(inv.status === "paid"
            ? D().tr("Pago em {d}", { d: D().fmtLong(inv.paidAt) })
            : D().tr("Vencimento em {d}", { d: D().fmtLong(inv.dueDate) }));
        const place = [client.city, client.region].filter(Boolean).join("/");

        const rows = inv.items.map((it) => `
            <tr>
              <td>
                <div class="fbill-invoice__item-name">${esc(it.name)}${it.discount > 0 ? ' <span class="fbill-tag">Cupom</span>' : ""}</div>
                <div class="fbill-invoice__item-desc"><span>${esc(it.desc)}</span>${it.adj || it.key === "api" ? "" : ` · <span>${D().fmtShort(inv.dueDate)} → ${D().fmtShort(inv.periodEnd)}</span>`}</div>
              </td>
              <td class="num">${it.adj && it.qty > 0 ? "+" : ""}${it.qty}</td>
              <td class="num">${it.unit > 0 ? D().money(it.unit) : "—"}</td>
              <td class="num">${lineAmount(it)}</td>
            </tr>`).join("");

        const discountRow = inv.coupons.length
            ? inv.coupons.map((c) => `<div class="fbill-invoice__totals-row"><span>${esc(D().tr("Descontos (cupom {c})", { c: c.code }))}</span><span>− ${D().money(inv.byCoupon[c.code] || 0)}</span></div>`).join("")
            : `<div class="fbill-invoice__totals-row"><span>Descontos</span><span>${D().money(0)}</span></div>`;

        const payment = inv.status === "paid"
            ? `<div class="fbill-invoice__payment">
                 <div class="fbill-invoice__payment-icon"><i class="fa-solid fa-check"></i></div>
                 <div class="fbill-invoice__payment-body">
                   <div class="fbill-invoice__payment-amount">${D().money(inv.total)}</div>
                   <div class="fbill-invoice__payment-desc">${esc(D().tr("Pago via {m}", { m: D().tr(inv.method) }))}</div>
                 </div>
                 <div class="fbill-invoice__payment-date">${D().fmtShort(inv.paidAt)}</div>
               </div>`
            : `<div class="fbill-empty"><i class="fa-regular fa-clock"></i><div class="fbill-empty__text">Nenhum pagamento registrado para esta fatura.</div></div>`;

        box.innerHTML = `
            ${cycleStatementHtml()}

            <div class="fbill-annuity__heading">Próxima renovação</div>
            <div class="fbill-card">
              <div class="fbill-invoice__head">
                <div>
                  <div class="fbill-invoice__number">${esc(D().tr("Fatura Nº {n}", { n: inv.number }))}</div>
                  <div class="fbill-invoice__paid-date">${dateLine}</div>
                </div>
                <span class="fbill-pill fbill-pill--${st.pill}">${st.label}</span>
              </div>

              <div class="fbill-invoice__meta">
                <div class="fbill-invoice__meta-block">
                  <h4>Cobrado de</h4>
                  <div class="fbill-invoice__meta-row"><b>${esc((client.name || "").toUpperCase())}</b></div>
                  <div class="fbill-invoice__meta-row">${esc(docLabel)}: ${esc(client.docNumber)}</div>
                  <div class="fbill-invoice__meta-row">${esc([client.address, place].filter(Boolean).join(" — "))}</div>
                  <div class="fbill-invoice__meta-row">E-mail de cobrança: <span>${esc(client.email)}</span></div>
                </div>
                <div class="fbill-invoice__meta-block">
                  <h4>Emitido por</h4>
                  <div class="fbill-invoice__meta-row"><b>${esc(D().ISSUER.name)}</b></div>
                  <div class="fbill-invoice__meta-row">${esc(D().ISSUER.doc)}</div>
                  <div class="fbill-invoice__meta-row">Fatura nº <span>${esc(inv.number)}</span></div>
                  <div class="fbill-invoice__meta-row">Pagamento processado via <b>Stripe</b></div>
                </div>
              </div>
            </div>

            <div class="fbill-card">
              <div class="fbill-card__head">
                <h3 class="fbill-card__title"><i class="fa-solid fa-list-check"></i> Itens inclusos nesta fatura</h3>
              </div>
              <table class="fbill-invoice__table">
                <thead><tr><th>Item</th><th class="num">Qtd.</th><th class="num">Valor unit.</th><th class="num">Subtotal</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
              <div class="fbill-invoice__totals">
                <div class="fbill-invoice__totals-row"><span>Subtotal</span><span>${D().money(inv.subtotal)}</span></div>
                ${discountRow}
                <div class="fbill-invoice__totals-row fbill-invoice__totals-row--balance"><span>Total</span><span>${D().money(inv.total)}</span></div>
              </div>
            </div>

            <div class="fbill-card">
              <div class="fbill-card__head">
                <h3 class="fbill-card__title"><i class="fa-solid fa-clock-rotate-left"></i> Histórico de pagamentos</h3>
              </div>
              ${payment}
            </div>`;
    }

    function renderHistory() {
        const body = $("farmEditHistoricoBody");
        if (!body || !D()) return;
        const invoices = D().getInvoices();
        body.innerHTML = invoices.map((inv) => {
            const st = STATUS[inv.status];
            const download = inv.status === "paid"
                ? `<a class="fbill-link" href="${esc(downloadUrl(inv))}" target="_blank"><i class="fa-solid fa-file-arrow-down"></i> Baixar</a>`
                : "—";
            return `
                <tr data-status="${st.filter}">
                  <td>${D().fmtTable(inv.dueDate)}</td>
                  <td><span class="fbill-pill fbill-pill--${st.pill}">${st.rowLabel}</span></td>
                  <td>${D().money(inv.total)}</td>
                  <td><a class="fbill-link" href="${esc(receiptUrl(inv))}" target="_blank">Link</a></td>
                  <td>${download}</td>
                </tr>`;
        }).join("");
        const count = $("farmEditHistoricoCount");
        if (count) count.textContent = D().tr("1-{n} de {n} itens", { n: invoices.length });
        window.IcFaturamentoHistorico?.applyFilter(true);
    }

    function refreshAll() {
        renderNext();
        renderAnnuity();
        renderHistory();
        window.IcFaturamentoContract?.render();
        window.IcFaturamentoHistory?.render();
        window.IcFaturamentoApi?.render();
    }

    // ---------------------------------------------------------------------------
    // Salvar / descartar: nada do billing vale antes de clicar em Salvar
    // ---------------------------------------------------------------------------
    let billingBaseline = "";

    const billingDirty = () => !!$("faturamentoPanel") && JSON.stringify(collectBilling()) !== billingBaseline;
    function notify(type, msg) {
        if (window.IcNotify) window.IcNotify[type](msg);
        else alert(tMsg(msg));
    }

    // Resumo do que o Salvar vai aplicar fora da contratação (cartões e dados de faturamento),
    // mostrado em "Alterações a aplicar" na aba Contratação.
    function pendingExtras() {
        const out = [];
        if (pendingCards !== null) {
            const saved = savedCards();
            const byId = (list) => Object.fromEntries(list.map((c) => [c.id, c]));
            const before = byId(saved);
            const after = byId(pendingCards);
            pendingCards.forEach((c) => {
                if (!before[c.id]) out.push({ type: "card", action: "added", last4: c.last4 });
                else if (JSON.stringify(before[c.id]) !== JSON.stringify(c)) out.push({ type: "card", action: "updated", last4: c.last4 });
            });
            saved.forEach((c) => { if (!after[c.id]) out.push({ type: "card", action: "removed", last4: c.last4 }); });
        }
        if (billingDirty()) out.push({ type: "billing" });
        return out;
    }

    const CARD_CHANGE_TEXT = { added: "Cartão •••• {l} adicionado", updated: "Cartão •••• {l} atualizado", removed: "Cartão •••• {l} removido" };
    window.IcFaturamentoPending = () => pendingExtras().map((x) => (x.type === "card"
        ? { icon: "fa-regular fa-credit-card", title: D().tr(CARD_CHANGE_TEXT[x.action], { l: x.last4 }) }
        : { icon: "fa-regular fa-address-card", title: "Dados de faturamento alterados" }));

    // Aplica de uma vez: contratação, cupom, método de pagamento, chave da API, cartões e dados de faturamento.
    function saveAll() {
        if (billingDirty() && !validateBilling()) { notify("error", "Preencha os campos obrigatórios do faturamento."); return; }
        D().savePending(pendingExtras());
        commitCards();
        if (billingDirty()) saveBilling();
        billingBaseline = JSON.stringify(collectBilling());
        renderCards();
        renderMethodTabs();
        refreshAll();
        notify("success", "Faturamento salvo com sucesso!");
    }

    window.addEventListener("ic:lang-change", () => {
        if (!$("faturamentoPanel")) return;
        buildCountryMenu();
        renderMethodTabs();
        refreshAll();
    });

    window.IcFaturamentoInvoices = {
        renderHistory,
        refresh: refreshAll,
        // Abre o recibo/boleto da cobrança atual no método informado (ou no preferencial).
        openReceipt(methodLabel) {
            window.open(receiptUrl(D().getInvoices()[0], methodLabel), "_blank");
        },
        pay() {
            const inv = D().getInvoices()[0];
            const method = D().getMethod();
            if (method === "pix") { showMethodPanel("pix"); showPix(); $("fbillPixBox")?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
            window.open(receiptUrl(inv, D().getMethodLabel()), "_blank");
        },
        showSubscription() {
            $("faturamentoPanel")?.querySelector('.edit-panel__nav-item[data-target="#contratacaoSection"]')?.click();
        },
        showDetails() {
            const root = $("faturamentoPanel");
            root?.querySelector('.edit-panel__nav-item[data-target="#planoItensSection"]')?.click();
        },
    };

    // Filtro de status do histórico (dropdown com checkboxes)
    window.IcFaturamentoHistorico = {
        applyFilter(keepOpen) {
            const field = $("farmEditStatusFilter");
            const body = $("farmEditHistoricoBody");
            if (!field || !body) return;

            const checked = Array.from(field.querySelectorAll('input[type="checkbox"]:checked')).map((i) => i.value);
            body.querySelectorAll("tr[data-status]").forEach((row) => {
                row.style.display = checked.includes(row.dataset.status) ? "" : "none";
            });
            if (!keepOpen) field.classList.remove("is-open");
        },

        resetFilter() {
            const field = $("farmEditStatusFilter");
            const body = $("farmEditHistoricoBody");
            if (!field || !body) return;
            field.querySelectorAll('input[type="checkbox"]').forEach((i) => (i.checked = true));
            body.querySelectorAll("tr[data-status]").forEach((row) => (row.style.display = ""));
        }
    };

    document.addEventListener("click", () => {
        $("farmEditStatusFilter")?.classList.remove("is-open");
    });

    // Sincroniza o badge de pendências nos dois botões (Faturamento e "..." colapsado)
    function setPending(n) {
        n = Number(n) || 0;
        ["faturamentoBadge", "settingsBadge"].forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (n > 0) {
                el.textContent = n > 99 ? "99+" : String(n);
                el.style.display = "";
            } else {
                el.style.display = "none";
            }
        });
    }

    function bindUI() {
        const root = $("faturamentoPanel");
        if (!root) return;

        const btnBack = root.querySelector("#faturamentoBack");
        if (btnBack) {
            btnBack.addEventListener("click", () => window.IcFaturamento?.close());
        }

        // Endereço/informações: países globais; restaura o que foi salvo (padrão: Brasil).
        window.IcFaturamentoContract?.reset();
        window.IcFaturamentoHistory?.reset();
        window.IcFaturamentoApi?.reset();
        buildCountryMenu();
        restoreBilling();
        billingBaseline = JSON.stringify(collectBilling());

        refreshAll();

        root.querySelectorAll(".edit-panel__nav-item").forEach((btn) => {
            btn.addEventListener("click", () => {
                const scope = btn.closest(".edit-panel__tab-body") || root;
                scope.querySelectorAll(".edit-panel__nav-item").forEach((item) => {
                    item.classList.toggle("is-active", item === btn);
                });
                const target = btn.getAttribute("data-target");
                if (!target) return;
                scope.querySelectorAll(".edit-panel__section").forEach((s) => s.classList.remove("is-active"));
                root.querySelector(target)?.classList.add("is-active");
            });
        });

        // Abas do topo: Geral e Histórico.
        root.querySelectorAll(".edit-panel__tab[data-tab]").forEach((tab) => {
            tab.addEventListener("click", () => {
                root.querySelectorAll(".edit-panel__tab[data-tab]").forEach((t) => {
                    const on = t === tab;
                    t.classList.toggle("is-active", on);
                    t.setAttribute("aria-selected", on ? "true" : "false");
                });
                root.querySelectorAll(".edit-panel__tab-body").forEach((b) => b.classList.toggle("is-active", b.dataset.tabBody === tab.dataset.tab));
            });
        });

        // O botão Salvar aplica tudo de uma vez (contratação, cupom, método, chave da API, cartões e dados de faturamento).
        root.querySelector(".btn-save-pref")?.addEventListener("click", saveAll);

        // Limpa o destaque de erro assim que o usuário corrige o campo.
        root.addEventListener("input", (e) => {
            e.target.closest?.(".is-invalid")?.classList.remove("is-invalid");
            window.IcFaturamentoContract?.renderChanges?.();
        });
        root.addEventListener("click", (e) => {
            e.target.closest?.(".edit-panel__select-option")?.closest(".edit-panel__select-field")?.classList.remove("is-invalid");
            setTimeout(() => window.IcFaturamentoContract?.renderChanges?.(), 0);
        });

        const docNumberInput = root.querySelector("#farmEditBillingDocNumber");
        if (docNumberInput && !docNumberInput.dataset.maskBound) {
            docNumberInput.dataset.maskBound = "1";
            docNumberInput.addEventListener("input", () => {
                const docType = root.querySelector("#farmEditBillingDocType")?.value;
                if (docType === "cpf" || docType === "cnpj") {
                    docNumberInput.value = maskCpfCnpj(docNumberInput.value, docType === "cnpj");
                }
            });
        }

        const postalInput = root.querySelector("#farmEditBillingPostal");
        if (postalInput && !postalInput.dataset.maskBound) {
            postalInput.dataset.maskBound = "1";
            postalInput.addEventListener("input", () => {
                if (root.querySelector("#farmEditBillingCountry")?.value !== "BR") return;
                const digits = postalInput.value.replace(/\D/g, "").slice(0, 8);
                postalInput.value = digits.replace(/(\d{5})(\d)/, "$1-$2");
            });
        }

        const phoneInput = root.querySelector("#farmEditBillingPhone");
        if (phoneInput && !phoneInput.dataset.maskBound) {
            phoneInput.dataset.maskBound = "1";
            phoneInput.addEventListener("input", () => {
                // Máscara brasileira só para BR; nos demais países o número é livre.
                if (root.querySelector("#farmEditBillingCountry")?.value !== "BR") return;
                const digits = phoneInput.value.replace(/\D/g, "").slice(0, 11);
                phoneInput.value = digits.length > 10
                    ? digits.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{4})$/, "$1-$2")
                    : digits.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{4})$/, "$1-$2");
            });
        }
    }

    // positionOverlay compartilhado — ver assets/js/core/overlay-utils.js
    const positionOverlay = window.IcOverlay.positionOverlay;

    async function open() {
        if (state.isOpen) return;
        state.isOpen = true;

        // Fecha os painéis de edição se estiverem abertos
        window.Pivos?.views?.edit?.close?.();
        window.Bmb?.views?.edit?.close?.();
        window.Mdn?.views?.edit?.close?.();
        window.IcLineStarEdit?.close?.();
        window.IcFarmEdit?.close?.();

        // Guarda a rota ativa anterior do menu para restaurar ao voltar
        const prevActive = document.querySelector(".nav__item.is-active, .sidebar__footer-btn.is-active");
        state.prevRoute = prevActive ? prevActive.getAttribute("data-route") : null;

        try {
            let overlay = $("faturamentoOverlay");
            if (!overlay) {
                overlay = document.createElement("div");
                overlay.id = "faturamentoOverlay";
                overlay.className = "config-overlay";
                overlay.style.zIndex = 1200 + document.querySelectorAll(".config-overlay").length;
                document.body.appendChild(overlay);
            }
            positionOverlay(overlay);

            // Reposiciona se a sidebar colapsar/expandir ou a janela mudar de tamanho
            state.resizeObserver?.disconnect();
            const host = document.querySelector(".main");
            if (host && typeof ResizeObserver === "function") {
                state.resizeObserver = new ResizeObserver(() => positionOverlay(overlay));
                state.resizeObserver.observe(host);
            }

            const html = await fetch("./pages/faturamento.html").then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); });
            overlay.innerHTML = html;
            bindUI();

            // Anima a entrada (desliza da direita para a esquerda)
            requestAnimationFrame(() => {
                requestAnimationFrame(() => overlay.classList.add("is-open"));
            });
        } catch (err) {
            console.error("IcFaturamento: failed to open", err);
            state.isOpen = false;
            state.resizeObserver?.disconnect();
            $("faturamentoOverlay")?.remove();
        }
    }

    function close() {
        D()?.discardPending?.();
        pendingCards = null;
        state.resizeObserver?.disconnect();
        state.resizeObserver = null;
        const overlay = $("faturamentoOverlay");
        const wasOpen = state.isOpen;
        state.isOpen = false;
        closeCardModal();

        if (overlay) {
            overlay.classList.remove("is-open");
            setTimeout(() => overlay.remove(), 320);
        }

        // Restaura o item ativo do menu apenas se "faturamento" ainda estiver selecionado
        // (se o usuário navegou para outra rota, o setActive dela já assumiu)
        if (wasOpen && state.prevRoute) {
            const faturamentoActive = document.querySelector('[data-route="faturamento"].is-active');
            if (faturamentoActive) {
                document.querySelectorAll(".nav__item, .sidebar__footer-btn").forEach((a) => {
                    a.classList.toggle("is-active", a.getAttribute("data-route") === state.prevRoute);
                });
            }
        }
        state.prevRoute = null;
    }

    function init() {
        // Mock: 1 pendência. Trocar por valor real vindo da API.
        setPending(1);
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    window.IcFaturamento = { open, close, setPending };
})();
