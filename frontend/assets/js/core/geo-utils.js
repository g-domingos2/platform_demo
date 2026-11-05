// assets/js/core/geo-utils.js
// Helpers de texto/coordenada compartilhados entre as páginas de
// equipamento (smart-connect, smarttouch, linestar, repetidora, medidor,
// irripump, pluviometro, rainstar, estacao-metereologica).
//
// Por quê: as 9 páginas de equipamento tinham cada uma sua própria cópia
// idêntica (byte-a-byte, no caso de escapeHtml/parseLatLng) dessas funções.
// Fica aqui, carregado uma vez antes delas, pra parar de duplicar e pra
// corrigir um bug nesse tipo de helper valer pras 9 de uma vez.
(function () {
  "use strict";

  // Escapa texto pra ir com segurança dentro de innerHTML (evita XSS via
  // nome de equipamento/fazenda etc. digitado pelo usuário).
  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // Aceita "lat, lng" / "lat lng" / "lat; lng", com vírgula ou ponto como
  // separador decimal. Retorna null se não der pra interpretar como par de
  // coordenadas válido.
  function parseLatLng(text) {
    const raw = String(text || "").trim();
    if (!raw) return null;

    const parts = raw
      .replaceAll(";", ",")
      .split(/,|\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (parts.length < 2) return null;

    const lat = Number(parts[0].replace(",", "."));
    const lng = Number(parts[1].replace(",", "."));

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

    return { lat, lng };
  }

  function formatLatLng(lat, lng) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }

  // Ponto de destino a partir de uma origem, distância (m) e rumo (graus) —
  // fórmula esférica padrão, raio da Terra 6378137m. Idêntica byte-a-byte
  // entre linestar.js e smart-connect.js antes desta extração.
  function destinationPoint(origin, distanceMeters, bearingDeg) {
    const radius = 6378137;
    const delta = distanceMeters / radius;
    const theta = bearingDeg * Math.PI / 180;
    const phi1 = origin.lat * Math.PI / 180;
    const lambda1 = origin.lng * Math.PI / 180;

    const sinPhi1 = Math.sin(phi1);
    const cosPhi1 = Math.cos(phi1);
    const sinDelta = Math.sin(delta);
    const cosDelta = Math.cos(delta);

    const sinPhi2 = sinPhi1 * cosDelta + cosPhi1 * sinDelta * Math.cos(theta);
    const phi2 = Math.asin(Math.max(-1, Math.min(1, sinPhi2)));
    const y = Math.sin(theta) * sinDelta * cosPhi1;
    const x = cosDelta - sinPhi1 * Math.sin(phi2);
    const lambda2 = lambda1 + Math.atan2(y, x);

    return {
      lat: phi2 * 180 / Math.PI,
      lng: lambda2 * 180 / Math.PI,
    };
  }

  window.IcGeo = {
    escapeHtml,
    parseLatLng,
    formatLatLng,
    destinationPoint,
  };
})();
