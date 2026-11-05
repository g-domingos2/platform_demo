// assets/js/pages/chuva-geo/layers.rain.js
(function () {
  'use strict';

  const Cg = (window.ChuvaGeo = window.ChuvaGeo || {});
  const data = (Cg.data = Cg.data || {});
  const state = (Cg.state = Cg.state || {});
  const layers = (Cg.layers = Cg.layers || {});
  const rain = (layers.rain = layers.rain || {});

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function ensurePane(map, paneName) {
    if (!map.getPane(paneName)) {
      map.createPane(paneName);
    }
    const pane = map.getPane(paneName);
    if (pane) {
      pane.style.zIndex = '450';
      pane.style.pointerEvents = 'none';
    }
    return pane;
  }

  function boundsFromBbox(bbox) {
    if (!bbox || !window.L) return null;
    return L.latLngBounds(
      [bbox.minLat, bbox.minLng],
      [bbox.maxLat, bbox.maxLng]
    );
  }

  function boundsFromPoints(points) {
    if (!window.L || !points || !points.length) return null;
    let minLat = points[0].lat;
    let maxLat = points[0].lat;
    let minLng = points[0].lng;
    let maxLng = points[0].lng;

    points.forEach((p) => {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    });

    return L.latLngBounds([minLat, minLng], [maxLat, maxLng]);
  }

  function createRainImageLayer(imageUrl, options) {
    if (!window.L) return null;
    const map = window.icMap;
    if (!map) return null;

    const cfg = options || {};
    const paneName = cfg.paneName || 'icRainHeatPane';
    ensurePane(map, paneName);

    const bbox = cfg.bbox || data.rainAreaBbox;
    const bounds = cfg.bounds || boundsFromBbox(bbox) || boundsFromPoints(cfg.points || data.rainPoints || []);
    if (!bounds) return null;

    const url = imageUrl || cfg.url || data.rainImageUrl || './assets/img/map/testmap.png';
    const opacity = clamp(
      typeof cfg.opacity === 'number' ? cfg.opacity : (state.rainOpacity || 0.7),
      0,
      1
    );

    const layer = L.imageOverlay(url, bounds, {
      opacity,
      pane: paneName,
      interactive: false,
    });

    function setOpacity(value) {
      if (!layer || !layer.setOpacity) return;
      layer.setOpacity(clamp(value, 0, 1));
    }

    function setData(next) {
      if (!next) return;
      if (next.url && layer.setUrl) layer.setUrl(next.url);
      if (next.bounds && layer.setBounds) layer.setBounds(next.bounds);
    }

    return {
      layer,
      paneName,
      setOpacity,
      setData,
    };
  }

  function ensureLayer() {
    if (state.layers && state.layers.rain) return state.layers.rain;
    const handle = createRainImageLayer(null, {
      bbox: data.rainAreaBbox,
      opacity: state.rainOpacity,
      points: data.rainPoints || [],
    });
    if (state.layers) state.layers.rain = handle;
    return handle;
  }

  function add() {
    const map = window.icMap;
    const handle = ensureLayer();
    if (!map || !handle || !handle.layer) return;
    const bounds = boundsFromBbox(data.rainAreaBbox) || boundsFromPoints(data.rainPoints || []);
    if (bounds && handle.setData) {
      handle.setData({
        url: data.rainImageUrl || './assets/img/map/testmap.png',
        bounds,
      });
    }
    if (!map.hasLayer(handle.layer)) handle.layer.addTo(map);
    if (handle.setOpacity) handle.setOpacity(state.rainOpacity);
  }

  function remove() {
    const map = window.icMap;
    const handle = state.layers && state.layers.rain;
    if (!map || !handle || !handle.layer) return;
    if (map.hasLayer(handle.layer)) map.removeLayer(handle.layer);
  }

  function setOpacity(value) {
    state.rainOpacity = clamp(value, 0, 1);
    const handle = ensureLayer();
    if (handle && handle.setOpacity) handle.setOpacity(state.rainOpacity);
  }

  function setData(next) {
    const handle = ensureLayer();
    if (handle && handle.setData) handle.setData(next);
  }

  rain.createRainHeatLayer = createRainImageLayer;
  rain.createRainImageLayer = createRainImageLayer;
  rain.add = add;
  rain.remove = remove;
  rain.setOpacity = setOpacity;
  rain.setData = setData;
})();
