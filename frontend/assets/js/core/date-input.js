// assets/js/core/date-input.js
(function () {
  "use strict";

  // <input type="date"> desenha o formato que o navegador quiser: em inglês
  // sai mm/dd/yyyy, e não há atributo que force outra ordem. Onde a data
  // precisa ser lida igual em qualquer idioma, o campo vira texto com
  // máscara dd/mm/yyyy e o valor continua sendo trocado em ISO (yyyy-mm-dd),
  // que é o formato que o resto do sistema grava.

  const pad = (value) => String(value).padStart(2, "0");

  // "yyyy-mm-dd" -> "dd/mm/yyyy". Devolve "" para valor vazio ou inválido.
  function isoToBr(iso) {
    const raw = String(iso ?? "").trim();
    if (!raw) return "";
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return "";
    return `${match[3]}/${match[2]}/${match[1]}`;
  }

  // "dd/mm/yyyy" -> "yyyy-mm-dd". Devolve "" enquanto a data não estiver
  // completa ou não existir no calendário (31/02, por exemplo).
  function brToIso(br) {
    const digits = String(br ?? "").replace(/\D/g, "");
    if (digits.length !== 8) return "";

    const day = Number(digits.slice(0, 2));
    const month = Number(digits.slice(2, 4));
    const year = Number(digits.slice(4, 8));
    if (!day || !month || month > 12 || year < 1900) return "";

    const date = new Date(year, month - 1, day);
    if (date.getDate() !== day || date.getMonth() !== month - 1) return "";

    return `${year}-${pad(month)}-${pad(day)}`;
  }

  // Formata enquanto digita, inserindo as barras nas posições certas.
  function maskValue(text) {
    const digits = String(text ?? "").replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  }

  // Liga a máscara a um input de texto. O valor ISO fica em dataset.iso, de
  // onde as telas leem na hora de salvar.
  function bindDateMask(input) {
    if (!input || input.dataset.dateMask === "1") return;
    input.dataset.dateMask = "1";

    input.setAttribute("inputmode", "numeric");
    input.setAttribute("maxlength", "10");
    if (!input.placeholder) input.placeholder = "dd/mm/aaaa";

    const sync = () => {
      input.value = maskValue(input.value);
      input.dataset.iso = brToIso(input.value);
    };

    input.addEventListener("input", sync);
    // Data incompleta ao sair do campo não vira valor pela metade.
    input.addEventListener("blur", () => {
      if (!input.dataset.iso) input.value = input.value.trim() ? "" : "";
    });

    sync();
  }

  // Escreve um valor ISO no campo já formatado.
  function setDateValue(input, iso) {
    if (!input) return;
    input.value = isoToBr(iso);
    input.dataset.iso = String(iso ?? "").slice(0, 10);
  }

  // Lê o campo em ISO, para gravar no equipamento.
  function getDateValue(input) {
    if (!input) return "";
    return input.dataset.iso || brToIso(input.value);
  }

  window.IcDateInput = {
    isoToBr,
    brToIso,
    maskValue,
    bindDateMask,
    setDateValue,
    getDateValue,
  };
})();
