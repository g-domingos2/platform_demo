// assets/js/core/numeric-input.js
// Helper central de parsing/normalização de números digitados pelo usuário.
//
// Por quê: <input type="number"> às vezes aceita vírgula como separador
// decimal (depende do locale pt-BR do Windows), o que quebra o valor lido
// via `.value` silenciosamente (vira NaN ou string inválida). Em vez de
// duplicar "replace(',', '.')" em cada página, este arquivo concentra o
// parsing tolerante e normaliza a digitação em tempo real para todo campo
// type="number" da aplicação, uma única vez, aqui.
(function () {
  "use strict";

  // Converte para número tolerando vírgula como separador decimal.
  // Retorna null (não 0) quando o valor não é um número válido, para quem
  // chama poder distinguir "campo vazio/inválido" de "usuário digitou zero".
  function toFiniteNumber(value) {
    const num = Number(String(value ?? "").trim().replace(",", "."));
    return Number.isFinite(num) ? num : null;
  }

  // Mesma coisa, mas com fallback numérico quando inválido — cobre o padrão
  // comum `Number(x) || 0`.
  function toFiniteNumberOr(value, fallback) {
    const num = toFiniteNumber(value);
    return num === null ? (fallback === undefined ? 0 : fallback) : num;
  }

  // Lê `.value` de um elemento (ou id) e já normaliza num passo só.
  function readNumber(elOrId, fallback) {
    const el = typeof elOrId === "string" ? document.getElementById(elOrId) : elOrId;
    return toFiniteNumberOr(el ? el.value : null, fallback);
  }

  // Cobre tanto <input type="number"> quanto <input type="text" inputmode="decimal">
  // — este último é usado nos poucos campos que precisam de controle total sobre
  // o que é digitado/exibido (o type="number" nativo renderiza com vírgula em
  // locale pt-BR mesmo com .value correto em ponto por trás).
  function isDecimalNumberInput(el) {
    return !!el && el.tagName === "INPUT"
      && (el.type === "number" || (el.type === "text" && el.inputMode === "decimal"));
  }

  // Substitui vírgula por ponto no valor atual do input, preservando a
  // posição do cursor quando possível.
  function normalizeCommaInPlace(el) {
    if (!el || el.value.indexOf(",") === -1) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    el.value = el.value.replace(/,/g, ".");
    if (start !== null && end !== null && typeof el.setSelectionRange === "function") {
      try { el.setSelectionRange(start, end); } catch (_) { }
    }
  }

  // Registra um único listener delegado no document (fase de captura, para
  // rodar antes de listeners `input`/`change` de cada página) que cobre
  // todo input[type=number] da aplicação — inclusive os injetados depois via
  // fetch()+innerHTML nas páginas de edição. Idempotente: seguro chamar mais
  // de uma vez / o script carregar mais de uma vez.
  function attachGlobalNormalizer() {
    if (document.documentElement.dataset.icNumericBound === "1") return;
    document.documentElement.dataset.icNumericBound = "1";

    document.addEventListener("input", (event) => {
      if (isDecimalNumberInput(event.target)) normalizeCommaInPlace(event.target);
    }, true);

    // Ctrl+V dispara "input", mas alguns browsers só populam .value depois
    // do evento "paste" concluir — normaliza de novo no próximo tick.
    document.addEventListener("paste", (event) => {
      const el = event.target;
      if (!isDecimalNumberInput(el)) return;
      setTimeout(() => normalizeCommaInPlace(el), 0);
    }, true);
  }

  attachGlobalNormalizer();

  window.IcNumeric = {
    toFiniteNumber,
    toFiniteNumberOr,
    readNumber,
    attachGlobalNormalizer,
  };
})();
