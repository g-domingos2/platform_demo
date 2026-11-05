(function () {
  "use strict";
  const Cad = (window.Cad = window.Cad || {});

  const MOJIBAKE_PATTERN = /(?:[\uFFFD]f[\u0080-\u00BF]|[\uFFFD],[\u0080-\u00BF]|â[\u0080-\u00BF])/;
  const MOJIBAKE_PATTERN_GLOBAL = /(?:[\uFFFD]f[\u0080-\u00BF]|[\uFFFD],[\u0080-\u00BF]|â[\u0080-\u00BF])/g;

  function decodeLikelyMojibake(value) {
    const text = String(value ?? "");
    if (!text || !MOJIBAKE_PATTERN.test(text)) return text;
    try {
      const bytes = new Uint8Array(text.length);
      for (let i = 0; i < text.length; i += 1) {
        bytes[i] = text.charCodeAt(i) & 0xff;
      }
      const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      const before = (text.match(MOJIBAKE_PATTERN_GLOBAL) || []).length;
      const after = (decoded.match(MOJIBAKE_PATTERN_GLOBAL) || []).length;
      return after < before ? decoded : text;
    } catch (_) {
      return text;
    }
  }

  function sanitizeMojibakeDeep(value, seen = new WeakSet()) {
    if (typeof value === "string") return decodeLikelyMojibake(value);
    if (Array.isArray(value)) return value.map((item) => sanitizeMojibakeDeep(item, seen));
    if (!value || typeof value !== "object") return value;
    if (Object.prototype.toString.call(value) !== "[object Object]") return value;
    if (seen.has(value)) return value;
    seen.add(value);

    const out = {};
    Object.entries(value).forEach(([key, item]) => {
      out[key] = sanitizeMojibakeDeep(item, seen);
    });
    return out;
  }

  function sanitizeCadastrosDomEncoding(root = document.getElementById("cadastrosPanel")) {
    if (!root || typeof document === "undefined") return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const current = node.nodeValue || "";
      const fixed = decodeLikelyMojibake(current);
      if (fixed !== current) node.nodeValue = fixed;
      node = walker.nextNode();
    }

    const attrs = ["title", "placeholder", "aria-label", "data-label-text"];
    root.querySelectorAll("*").forEach((el) => {
      attrs.forEach((attr) => {
        if (!el.hasAttribute(attr)) return;
        const value = el.getAttribute(attr) || "";
        const fixed = decodeLikelyMojibake(value);
        if (fixed !== value) el.setAttribute(attr, fixed);
      });
    });
  }

  Cad.encoding = {
    decodeLikelyMojibake,
    sanitizeMojibakeDeep,
    sanitizeCadastrosDomEncoding
  };

})();
