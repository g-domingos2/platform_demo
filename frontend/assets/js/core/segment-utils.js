// assets/js/core/segment-utils.js
// Regras únicas para os segmentos do pivô e para o pivô setorial.
//
// Por quê: os segmentos eram sempre calculados como se o pivô tivesse 360°.
// Ao reduzir o "Ângulo máximo de trabalho" (ex.: 240°), os segmentos antigos
// continuavam indo até 360° e os novos nasciam um em cima do outro. Aqui os
// segmentos são sempre encaixados dentro do ângulo máximo do pivô.
//
// API: window.IcSegments
//   fit(segments, maxAngle)      → segmentos contíguos de 0° até maxAngle
//   isValid(segments, maxAngle)  → true se já estão encaixados
//   sectorFromData(data)         → { isSector, startAngle, endAngle, bearing }
(function () {
  "use strict";

  const round2 = (v) => Math.round(v * 100) / 100;
  const num = (v) => {
    const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
  };
  const clampMax = (maxAngle) => {
    const m = num(maxAngle);
    return Number.isFinite(m) && m > 0 ? Math.min(360, Math.max(1, m)) : 360;
  };

  function spansOf(segments, max) {
    return segments.map((seg) => {
      const s = num(seg?.startAngle);
      const e = num(seg?.endAngle);
      if (!Number.isFinite(s) || !Number.isFinite(e)) return NaN;
      let span = e - s;
      if (span <= 0 && max >= 360) span += 360; // volta completa: segmento pode cruzar o 0°
      return span;
    });
  }

  function isValid(segments, maxAngle) {
    const max = clampMax(maxAngle);
    if (!Array.isArray(segments) || !segments.length) return false;
    const spans = spansOf(segments, max);
    if (spans.some((sp) => !(sp > 0))) return false;
    const total = spans.reduce((a, b) => a + b, 0);
    if (Math.abs(total - max) > 0.6) return false;
    for (let i = 1; i < segments.length; i++) {
      if (Math.abs(num(segments[i].startAngle) - num(segments[i - 1].endAngle)) > 0.6) return false;
    }
    if (max < 360) {
      // Setorial: começa em 0° e termina exatamente no ângulo máximo.
      if (Math.abs(num(segments[0].startAngle)) > 0.6) return false;
      if (Math.abs(num(segments[segments.length - 1].endAngle) - max) > 0.6) return false;
    }
    return true;
  }

  // Encaixa os segmentos em 0°..maxAngle mantendo a proporção de cada um.
  // `fractions` (opcional) força as proporções (usado enquanto o usuário digita).
  function fit(segments, maxAngle, fractions) {
    const max = clampMax(maxAngle);
    const list = Array.isArray(segments) ? segments.filter(Boolean) : [];
    if (!list.length) return [{ name: "Segmento 1", startAngle: 0, endAngle: max }];
    if (!fractions && isValid(list, max)) return list.map((seg) => ({ ...seg }));
    const n = list.length;
    let fr = Array.isArray(fractions) && fractions.length === n ? fractions.slice() : null;
    if (!fr) {
      // Proporção pelo tamanho que cada segmento tinha (tratando tudo como 0..360).
      const spans = list.map((seg) => {
        const s = num(seg?.startAngle);
        const e = num(seg?.endAngle);
        return Number.isFinite(s) && Number.isFinite(e) ? e - s : NaN;
      });
      const ok = spans.every((sp) => sp >= 0.5);
      const total = ok ? spans.reduce((a, b) => a + b, 0) : 0;
      fr = ok && total > 0 ? spans.map((sp) => sp / total) : list.map(() => 1 / n);
    }
    const sum = fr.reduce((a, b) => a + b, 0) || 1;
    let cursor = 0;
    return list.map((seg, i) => {
      const start = round2(cursor);
      cursor += (fr[i] / sum) * max;
      const end = i === n - 1 ? max : round2(cursor);
      return { ...seg, startAngle: start, endAngle: end };
    });
  }

  // Proporções atuais (ou null se algum segmento estiver "amassado").
  function fractions(segments, maxAngle) {
    const max = clampMax(maxAngle);
    if (!Array.isArray(segments) || segments.length < 2) return null;
    const spans = spansOf(segments, max);
    if (spans.some((sp) => !(sp >= 1))) return null;
    const total = spans.reduce((a, b) => a + b, 0);
    return total > 0 ? spans.map((sp) => sp / total) : null;
  }

  // Pivô setorial a partir dos dados salvos. O cadastro grava "maxAngle" +
  // "bearing" (direção do ângulo zero); a edição grava isSector/startAngle/
  // endAngle. Aqui os dois formatos viram um só.
  function sectorFromData(data) {
    const d = data || {};
    const explicit = d.isSector === true || d.isSector === "true" || d.isPartial === true || d.isPartial === "true";
    const maxAngle = num(d.maxAngle);
    const hasMax = Number.isFinite(maxAngle) && maxAngle > 0 && maxAngle < 360;
    const start = num(d.startAngle);
    const end = num(d.endAngle);
    const bearing = num(d.bearing);
    if (explicit && Number.isFinite(end)) {
      return { isSector: true, startAngle: Number.isFinite(start) ? start : 0, endAngle: end, bearing: Number.isFinite(bearing) ? bearing : null };
    }
    if (hasMax) {
      return { isSector: true, startAngle: 0, endAngle: maxAngle, bearing: Number.isFinite(bearing) ? bearing : null };
    }
    return { isSector: false, startAngle: 0, endAngle: 360, bearing: Number.isFinite(bearing) ? bearing : null };
  }

  // Ponto a `distanceM` metros do centro na direção `bearingDeg` (0° = norte).
  function destination(center, bearingDeg, distanceM) {
    const R = 6371000;
    const rad = (x) => (x * Math.PI) / 180;
    const deg = (x) => (x * 180) / Math.PI;
    const br = rad(bearingDeg);
    const dr = distanceM / R;
    const lat1 = rad(center.lat);
    const lng1 = rad(center.lng);
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dr) + Math.cos(lat1) * Math.sin(dr) * Math.cos(br));
    const lng2 = lng1 + Math.atan2(Math.sin(br) * Math.sin(dr) * Math.cos(lat1), Math.cos(dr) - Math.sin(lat1) * Math.sin(lat2));
    return { lat: deg(lat2), lng: deg(lng2) };
  }

  // Acerta os pivôs de uma fazenda (chamado sempre que as fazendas são
  // carregadas/salvas). Devolve true se alterou algo.
  //  - pivô criado com ângulo máximo < 360° passa a ser gravado como setorial
  //    (era exibido como 360° no mapa e nos detalhes);
  //  - segmentos de pivô setorial são encaixados dentro do ângulo máximo.
  function parseCenter(d) {
    const pairs = [[d.centerLat, d.centerLng], [d.lat, d.lng]];
    for (const [a, b] of pairs) {
      const lat = num(a);
      const lng = num(b);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
    const m = String(d.center || d.loc || "").match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    return m ? { lat: parseFloat(m[1]), lng: parseFloat(m[2]) } : null;
  }

  function normalizeFarmPivots(farm) {
    let changed = false;
    const lists = [farm?.equipments, farm?.equipamentos].filter(Array.isArray);
    lists.forEach((list) => list.forEach((equip) => {
      const type = String(equip?.type || "").toLowerCase();
      if (type !== "smart_connect" && type !== "smarttouch") return;
      const d = equip?.data;
      if (!d || typeof d !== "object") return;
      const max = num(d.maxAngle);
      const partial = Number.isFinite(max) && max > 0 && max < 360;
      if (partial && d.isSector === undefined && d.isPartial === undefined) {
        d.isSector = true;
        d.isPartial = true;
        d.startAngle = 0;
        d.endAngle = max;
        // O ângulo zero do cadastro ("bearing") vira o ponto de referência do setor.
        const center = parseCenter(d);
        const radius = num(d.radius);
        const bearing = num(d.bearing);
        if (center && radius > 0 && Number.isFinite(bearing)) {
          const ref = destination(center, bearing, radius);
          d.refLat = ref.lat;
          d.refLng = ref.lng;
          d.ref = `${ref.lat.toFixed(6)}, ${ref.lng.toFixed(6)}`;
        }
        changed = true;
      }
      const sectorMax = (d.isSector === true || d.isSector === "true") ? num(d.endAngle) : NaN;
      if (Number.isFinite(sectorMax) && sectorMax > 0 && sectorMax < 360 && Array.isArray(d.segments) && d.segments.length && !isValid(d.segments, sectorMax)) {
        d.segments = fit(d.segments, sectorMax);
        changed = true;
      }
    }));
    return changed;
  }

  window.IcSegments = { fit, isValid, fractions, sectorFromData, destination, round2, normalizeFarmPivots };
})();
