// assets/js/pages/chuva-geo/core.data.js
(function () {
  'use strict';

  const Cg = (window.ChuvaGeo = window.ChuvaGeo || {});
  const data = (Cg.data = Cg.data || {});

  if (data.__initialized) return;
  data.__initialized = true;

  data.rainMaxMm = 25;

  data.rainImageUrl = './assets/img/map/testmap.png';

  data.rainAreaBbox = {
    minLat: -16.86,
    maxLat: -16.68,
    minLng: -47.72,
    maxLng: -47.50,
  };

  data.rainAreaPolygon = [
    [-16.788, -47.635],
    [-16.752, -47.632],
    [-16.748, -47.592],
    [-16.784, -47.585],
  ];

  data.rainPoints = [
    { lat: -16.7672, lng: -47.6134, mm: 12.5 },
    { lat: -16.7619, lng: -47.6029, mm: 5.2 },
    { lat: -16.7744, lng: -47.6218, mm: 0.8 },
    { lat: -16.7698, lng: -47.5885, mm: 18.3 },
    { lat: -16.7681, lng: -47.6340, mm: 22.4 },
    { lat: -16.7660, lng: -47.6102, mm: 9.6 },
    { lat: -16.7585, lng: -47.6170, mm: 15.1 },
    { lat: -16.7550, lng: -47.5980, mm: 6.4 },
    { lat: -16.7825, lng: -47.6065, mm: 11.0 },
    { lat: -16.7800, lng: -47.6255, mm: 19.2 },
    { lat: -16.7720, lng: -47.5925, mm: 4.1 },
    { lat: -16.7590, lng: -47.6300, mm: 13.4 }
  ];

  data.irrigationAreas = [
    { id: 'pivo-01', name: 'Pivo 01', center: [-16.767, -47.612], radius: 480 },
    { id: 'pivo-02', name: 'Pivo 02', center: [-16.7715, -47.603], radius: 520 },
    { id: 'pivo-03', name: 'Pivo 03', center: [-16.7625, -47.620], radius: 430 }
  ];

  function toNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function getActiveFarmId() {
    const activeFarm = window.IcFarmGetActive?.() || window.icFarmData || window.IcFarmActive || null;
    return activeFarm?.id != null ? String(activeFarm.id) : "";
  }

  function getSavedIrrigationAreas() {
    const farmId = getActiveFarmId();
    const rows = window.Cad?.data?.getAllPivosRecords?.(farmId) || [];
    const normalized = rows.map((record) => {
      const sourceData = record?.data && typeof record.data === "object" ? record.data : {};
      const lat = toNumber(record?.lat ?? record?.center?.lat ?? sourceData?.centerLat ?? sourceData?.lat);
      const lng = toNumber(record?.lng ?? record?.center?.lng ?? sourceData?.centerLng ?? sourceData?.lng);
      const radius = toNumber(record?.radius ?? sourceData?.radius);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radius) || radius <= 0) return null;

      return {
        id: String(record?.id || ""),
        name: String(record?.name || sourceData?.name || "Pivô"),
        center: [lat, lng],
        radius,
        refLat: toNumber(record?.refLat ?? sourceData?.refLat),
        refLng: toNumber(record?.refLng ?? sourceData?.refLng),
        startLat: toNumber(record?.startLat ?? sourceData?.startLat),
        startLng: toNumber(record?.startLng ?? sourceData?.startLng),
        endLat: toNumber(record?.endLat ?? sourceData?.endLat),
        endLng: toNumber(record?.endLng ?? sourceData?.endLng),
        isPartial: window.Cad?.geo?.toBooleanFlag?.(record?.isPartial ?? sourceData?.isPartial) === true,
      };
    }).filter(Boolean);

    return normalized.length ? normalized : data.irrigationAreas;
  }

  data.getSavedIrrigationAreas = getSavedIrrigationAreas;

  if (window.IcFarmApplyGeo && window.IcFarmActive) {
    window.IcFarmApplyGeo(window.IcFarmActive);
  }
})();

