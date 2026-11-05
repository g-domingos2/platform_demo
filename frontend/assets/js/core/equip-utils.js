// assets/js/core/equip-utils.js
// Helpers genéricos das telas de detalhes de equipamento (bombas,
// medidores, estações) — existiam idênticos byte-a-byte nos 3 arquivos
// view.details.js. Mesmo padrão dos outros módulos em core/.
(function () {
  "use strict";

  function toNumber(val) {
    if (val === null || val === undefined || val === "") return null;
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  }

  // Parser de "lat, lng" tolerante (sem validação de range) — diferente do
  // parseLatLng de core/geo-utils.js (que valida -90..90/-180..180); não
  // fundir, cada um é usado com essa diferença de propósito.
  function parseLatLngText(text) {
    if (!text) return null;
    const parts = String(text).replaceAll(";", ",").split(/,|\s+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length < 2) return null;
    const lat = Number(parts[0].replace(",", "."));
    const lng = Number(parts[1].replace(",", "."));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }

  function hashStr(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) >>> 0;
    }
    return h;
  }

  // PRNG determinístico (mulberry32) — usado pra gerar dado mock plausível
  // sem "piscar" valor diferente a cada re-render do mesmo id.
  function seededRandom(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6d2b79f5;
      let x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  function formatLastUpdate(val) {
    if (!val) return "—";
    const date = new Date(val);
    if (Number.isNaN(date.getTime())) return String(val);
    // Mês abreviado no idioma selecionado (era uma tabela fixa em português).
    const locale = window.IcI18n?.getLocale?.() || "pt-BR";
    const mmm = date.toLocaleDateString(locale, { month: "short" }).replace(".", "");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    return `${dd} ${mmm} ${date.getFullYear()} ${hh}:${min}`;
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  }

  // Igual a formatLastUpdate, mas com o nome do mês curto via
  // toLocaleString("pt-BR") em vez da tabela MONTHS fixa — existia
  // idêntica nas telas de EDIÇÃO (view.edit.js) de bombas/medidores/
  // repetidoras (formatLastUpdate acima é das telas de DETALHES).
  function formatLastComm(val) {
    if (!val) return "—";
    const date = new Date(val);
    if (Number.isNaN(date.getTime())) return String(val);
    const dd = String(date.getDate()).padStart(2, "0");
    const mo = date.toLocaleString(window.IcI18n?.getLocale?.() || "pt-BR", { month: "short" }).replace(".", "");
    const yyyy = date.getFullYear();
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${dd} ${mo} ${yyyy} ${hh}:${mm}`;
  }

  window.IcEquipUtils = {
    toNumber,
    parseLatLngText,
    hashStr,
    seededRandom,
    formatLastUpdate,
    setText,
    formatLastComm,
  };
})();
