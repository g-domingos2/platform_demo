// assets/js/pages/chuva-geo/layers.irrigation.js
(function () {
  'use strict';

  const Cg = (window.ChuvaGeo = window.ChuvaGeo || {});
  const data = (Cg.data = Cg.data || {});
  const state = (Cg.state = Cg.state || {});
  const layers = (Cg.layers = Cg.layers || {});
  const irrigation = (layers.irrigation = layers.irrigation || {});

  function getActiveFarmKey() {
    const activeFarm = window.IcFarmGetActive?.() || window.icFarmData || window.IcFarmActive || null;
    return activeFarm?.id != null ? String(activeFarm.id) : "__default__";
  }

  function toNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function bearingBetweenPoints(lat1, lng1, lat2, lng2) {
    return window.Cad?.geo?.bearingBetweenPoints?.(lat1, lng1, lat2, lng2) ?? null;
  }

  function buildSectorPolygonLatLngs(lat, lng, radiusMeters, startBearingDeg, endBearingDeg, steps = 96) {
    return window.Cad?.geo?.buildSectorPolygonLatLngs?.(lat, lng, radiusMeters, startBearingDeg, endBearingDeg, steps) || [];
  }

  function buildLayer() {
    if (!window.L) return null;
    const group = L.layerGroup();

    const areas = data.getSavedIrrigationAreas?.() || data.irrigationAreas || [];
    areas.forEach((area) => {
      const lat = toNumber(area?.center?.[0]);
      const lng = toNumber(area?.center?.[1]);
      const radius = toNumber(area?.radius);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radius) || radius <= 0) return;

      const startLat = toNumber(area?.startLat);
      const startLng = toNumber(area?.startLng);
      const endLat = toNumber(area?.endLat);
      const endLng = toNumber(area?.endLng);
      const isPartial = area?.isPartial === true;

      let shape = null;
      if (isPartial && Number.isFinite(startLat) && Number.isFinite(startLng) && Number.isFinite(endLat) && Number.isFinite(endLng)) {
        const startBearing = bearingBetweenPoints(lat, lng, startLat, startLng) ?? 0;
        const endBearing = bearingBetweenPoints(lat, lng, endLat, endLng);
        const sectorPoints = buildSectorPolygonLatLngs(lat, lng, radius, startBearing, endBearing ?? startBearing);
        if (sectorPoints.length) {
          shape = L.polygon(sectorPoints, {
            color: '#eab308',
            weight: 2,
            fillColor: '#eab308',
            fillOpacity: 0.08,
            dashArray: '6 6',
          });
        }
      }

      if (!shape) {
        shape = L.circle([lat, lng], {
          radius,
          color: '#eab308',
          weight: 2,
          fillColor: '#eab308',
          fillOpacity: 0.08,
          dashArray: '6 6',
        });
      }

      shape.bindTooltip(area.name, { direction: 'center' });
      group.addLayer(shape);
    });

    return group;
  }

  function ensureLayer() {
    const farmKey = getActiveFarmKey();
    if (state.layers && state.layers.irrigation && state.irrigationFarmKey === farmKey) return state.layers.irrigation;
    state.layers = state.layers || {};
    state.irrigationFarmKey = farmKey;
    const layer = buildLayer();
    if (layer) state.layers.irrigation = layer;
    return layer;
  }

  function add() {
    const map = window.icMap;
    if (!map) return;
    const existing = state.layers && state.layers.irrigation;
    if (existing && map.hasLayer(existing)) {
      map.removeLayer(existing);
    }
    if (state.layers) state.layers.irrigation = null;
    const layer = ensureLayer();
    if (!layer) return;
    if (!map.hasLayer(layer)) layer.addTo(map);
  }

  function remove() {
    const map = window.icMap;
    const layer = state.layers && state.layers.irrigation;
    if (!map || !layer) return;
    if (map.hasLayer(layer)) map.removeLayer(layer);
  }

  function rebuild() {
    remove();
    if (state.layers) state.layers.irrigation = null;
    state.irrigationFarmKey = null;
    add();
  }

  irrigation.add = add;
  irrigation.remove = remove;
  irrigation.rebuild = rebuild;
})();
