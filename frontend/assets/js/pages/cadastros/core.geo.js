(function () {
  "use strict";
  const Cad = (window.Cad = window.Cad || {});

  function normalizeBearingDeg(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return ((n % 360) + 360) % 360;
  }

  function toBooleanFlag(value) {
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "sim", "on"].includes(normalized)) return true;
      if (["false", "0", "no", "nao", "off", ""].includes(normalized)) return false;
    }
    return !!value;
  }

  function bearingBetweenPoints(lat1, lng1, lat2, lng2) {
    const lat1N = Number(lat1);
    const lng1N = Number(lng1);
    const lat2N = Number(lat2);
    const lng2N = Number(lng2);
    if (!Number.isFinite(lat1N) || !Number.isFinite(lng1N) || !Number.isFinite(lat2N) || !Number.isFinite(lng2N)) return null;

    const toRad = Math.PI / 180;
    const y = Math.sin((lng2N - lng1N) * toRad) * Math.cos(lat2N * toRad);
    const x =
      Math.cos(lat1N * toRad) * Math.sin(lat2N * toRad) -
      Math.sin(lat1N * toRad) * Math.cos(lat2N * toRad) * Math.cos((lng2N - lng1N) * toRad);

    return normalizeBearingDeg(Math.atan2(y, x) * (180 / Math.PI));
  }

  function destinationPointByBearing(lat, lng, radiusMeters, bearingDeg) {
    const latN = Number(lat);
    const lngN = Number(lng);
    const radiusN = Number(radiusMeters);
    if (!Number.isFinite(latN) || !Number.isFinite(lngN) || !Number.isFinite(radiusN) || radiusN <= 0) return null;

    const earthRadius = 6378137;
    const angularDistance = radiusN / earthRadius;
    const latRad = latN * (Math.PI / 180);
    const lngRad = lngN * (Math.PI / 180);
    const bearing = normalizeBearingDeg(bearingDeg) * (Math.PI / 180);

    const destLatRad = Math.asin(
      Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing)
    );
    const destLngRad = lngRad + Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(destLatRad)
    );

    return [destLatRad * (180 / Math.PI), destLngRad * (180 / Math.PI)];
  }

  function calculateBearingPoint(lat, lng, radiusMeters, bearingDeg) {
    const latN = Number(lat), lngN = Number(lng), radiusN = Number(radiusMeters);
    if (!Number.isFinite(latN) || !Number.isFinite(lngN) || !Number.isFinite(radiusN) || radiusN <= 0) return null;
    const earthRadius = 6378137;
    const d = radiusN / earthRadius;
    const b = (bearingDeg * Math.PI) / 180;
    const latRad = latN * (Math.PI / 180);
    const lngRad = lngN * (Math.PI / 180);
    const destLatRad = Math.asin(Math.sin(latRad) * Math.cos(d) + Math.cos(latRad) * Math.sin(d) * Math.cos(b));
    const destLngRad = lngRad + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(latRad), Math.cos(d) - Math.sin(latRad) * Math.sin(destLatRad));
    return { lat: Number((destLatRad * (180 / Math.PI)).toFixed(6)), lng: Number((destLngRad * (180 / Math.PI)).toFixed(6)) };
  }

  function calculateNorthReference(lat, lng, radiusMeters) {
    const latN = Number(lat);
    const lngN = Number(lng);
    const radiusN = Number(radiusMeters);
    if (!Number.isFinite(latN) || !Number.isFinite(lngN) || !Number.isFinite(radiusN) || radiusN <= 0) {
      return null;
    }

    // Destination point from center, bearing 0° (north), same distance as pivot radius.
    const earthRadius = 6378137;
    const angularDistance = radiusN / earthRadius;
    const latRad = latN * (Math.PI / 180);
    const lngRad = lngN * (Math.PI / 180);
    const bearing = 0;

    const destLatRad = Math.asin(
      Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing)
    );
    const destLngRad = lngRad + Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(destLatRad)
    );

    return {
      lat: Number((destLatRad * (180 / Math.PI)).toFixed(6)),
      lng: Number((destLngRad * (180 / Math.PI)).toFixed(6))
    };
  }

  function buildSectorPolygonLatLngs(lat, lng, radiusMeters, startBearingDeg, endBearingDeg, steps = 96) {
    const center = [Number(lat), Number(lng)];
    const safeSteps = Math.max(24, Number(steps) || 96);
    const start = normalizeBearingDeg(startBearingDeg);
    const end = normalizeBearingDeg(endBearingDeg);
    let sweep = normalizeBearingDeg(end - start);
    if (sweep <= 0) sweep += 360;
    const points = [center];

    for (let i = 0; i <= safeSteps; i += 1) {
      const bearing = normalizeBearingDeg(start + (sweep * (i / safeSteps)));
      const point = destinationPointByBearing(center[0], center[1], radiusMeters, bearing);
      if (point) points.push(point);
    }

    points.push(center);
    return points;
  }

  function calculateDistanceMeters(lat1, lng1, lat2, lng2) {
    if (String(lat1 || "").trim() === "" || String(lng1 || "").trim() === "" || String(lat2 || "").trim() === "" || String(lng2 || "").trim() === "") {
      return null;
    }
    const lat1N = Number(lat1);
    const lng1N = Number(lng1);
    const lat2N = Number(lat2);
    const lng2N = Number(lng2);
    if (!Number.isFinite(lat1N) || !Number.isFinite(lng1N) || !Number.isFinite(lat2N) || !Number.isFinite(lng2N)) {
      return null;
    }

    const toRad = Math.PI / 180;
    const dLat = (lat2N - lat1N) * toRad;
    const dLng = (lng2N - lng1N) * toRad;
    const lat1Rad = lat1N * toRad;
    const lat2Rad = lat2N * toRad;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return 6378137 * c;
  }

  function calculatePolygonAreaHa(latLngs) {
    if (!Array.isArray(latLngs) || latLngs.length < 3) return 0;
    const R = 6378137;
    let area = 0;

    for (let i = 0; i < latLngs.length; i += 1) {
      const p1 = latLngs[i];
      const p2 = latLngs[(i + 1) % latLngs.length];
      area +=
        ((p2.lng - p1.lng) * (Math.PI / 180)) *
        (2 + Math.sin(p1.lat * (Math.PI / 180)) + Math.sin(p2.lat * (Math.PI / 180)));
    }

    area = Math.abs((area * R * R) / 2);
    return area / 10000;
  }

  function calculatePivoAreaHa(pivoOrRadius) {
    const isObjectInput = pivoOrRadius && typeof pivoOrRadius === "object";
    const radiusValue = isObjectInput ? pivoOrRadius.radius : pivoOrRadius;
    const r = Number(radiusValue);
    if (!Number.isFinite(r) || r <= 0) return "";

    let sweepDeg = 360;
    if (isObjectInput) {
      const isPartial = toBooleanFlag(pivoOrRadius?.isPartial ?? pivoOrRadius?.data?.isPartial);
      if (isPartial) {
        const lat = Number(pivoOrRadius?.lat ?? pivoOrRadius?.data?.centerLat ?? pivoOrRadius?.data?.lat);
        const lng = Number(pivoOrRadius?.lng ?? pivoOrRadius?.data?.centerLng ?? pivoOrRadius?.data?.lng);
        const startLat = Number(pivoOrRadius?.startLat ?? pivoOrRadius?.data?.startLat);
        const startLng = Number(pivoOrRadius?.startLng ?? pivoOrRadius?.data?.startLng);
        const endLat = Number(pivoOrRadius?.endLat ?? pivoOrRadius?.data?.endLat);
        const endLng = Number(pivoOrRadius?.endLng ?? pivoOrRadius?.data?.endLng);

        if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(startLat) && Number.isFinite(startLng) && Number.isFinite(endLat) && Number.isFinite(endLng)) {
          const startBearing = bearingBetweenPoints(lat, lng, startLat, startLng);
          const endBearing = bearingBetweenPoints(lat, lng, endLat, endLng);
          if (Number.isFinite(startBearing) && Number.isFinite(endBearing)) {
            sweepDeg = normalizeBearingDeg(endBearing - startBearing);
            if (sweepDeg <= 0) sweepDeg += 360;
          }
        }
      }
    }

    const areaM2 = Math.PI * r * r * (sweepDeg / 360);
    return areaM2 / 10000;
  }

  Cad.geo = {
    normalizeBearingDeg,
    toBooleanFlag,
    bearingBetweenPoints,
    destinationPointByBearing,
    calculateBearingPoint,
    calculateNorthReference,
    buildSectorPolygonLatLngs,
    calculateDistanceMeters,
    calculatePolygonAreaHa,
    calculatePivoAreaHa
  };

})();
