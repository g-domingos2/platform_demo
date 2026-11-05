// assets/js/pages/create-farm/view.map.js
(function initCreateFarmMap() {
  "use strict";

  const CreateFarm = (window.CreateFarm = window.CreateFarm || {});
  const state = CreateFarm.state || {};
  const helpers = CreateFarm.helpers || {};
  const view = (CreateFarm.view = CreateFarm.view || {});
  const viewMap = (view.map = view.map || {});

  function applyFarmGeo(farm) {
    if (!farm || !Number.isFinite(farm.lat) || !Number.isFinite(farm.lng)) return;

    const plv = window.Plv?.data;
    const cg = window.ChuvaGeo?.data;
    const baseCenter = helpers.getGeoBaseCenter(plv, cg);
    const offsetLat = farm.lat - baseCenter.lat;
    const offsetLng = farm.lng - baseCenter.lng;

    if (plv && Array.isArray(plv.PLUVIOS)) {
      plv.PLUVIOS.forEach((p) => {
        if (p.__fixedLatLng || p.sourceEquipId) {
          if (Number.isFinite(p.__baseLat) && Number.isFinite(p.__baseLng)) {
            p.lat = p.__baseLat;
            p.lng = p.__baseLng;
          }
          return;
        }
        const defaultBase = window.Plv?.data?.getDefaultPluvioBaseCoords?.(p);
        if (Number.isFinite(defaultBase?.lat) && Number.isFinite(defaultBase?.lng)) {
          p.__baseLat = defaultBase.lat;
          p.__baseLng = defaultBase.lng;
        } else if (!Number.isFinite(p.__baseLat) || !Number.isFinite(p.__baseLng)) {
          p.__baseLat = p.lat;
          p.__baseLng = p.lng;
        }
        p.lat = p.__baseLat + offsetLat;
        p.lng = p.__baseLng + offsetLng;
      });
    }

    if (cg) {
      if (cg.rainAreaBbox) {
        if (!cg.__baseRainBbox) cg.__baseRainBbox = { ...cg.rainAreaBbox };
        const b = cg.__baseRainBbox;
        cg.rainAreaBbox = {
          minLat: b.minLat + offsetLat,
          maxLat: b.maxLat + offsetLat,
          minLng: b.minLng + offsetLng,
          maxLng: b.maxLng + offsetLng,
        };
      }

      if (Array.isArray(cg.rainAreaPolygon)) {
        if (!cg.__baseRainAreaPolygon) {
          cg.__baseRainAreaPolygon = cg.rainAreaPolygon.map((p) => ({ lat: p[0], lng: p[1] }));
        }
        cg.rainAreaPolygon = cg.__baseRainAreaPolygon.map((p) => [p.lat + offsetLat, p.lng + offsetLng]);
      }

      if (Array.isArray(cg.rainPoints)) {
        cg.rainPoints.forEach((p) => {
          if (!Number.isFinite(p.__baseLat) || !Number.isFinite(p.__baseLng)) {
            p.__baseLat = p.lat;
            p.__baseLng = p.lng;
          }
          p.lat = p.__baseLat + offsetLat;
          p.lng = p.__baseLng + offsetLng;
        });
      }

      if (Array.isArray(cg.irrigationAreas)) {
        cg.irrigationAreas.forEach((area) => {
          if (!area.__baseCenter && Array.isArray(area.center)) {
            area.__baseCenter = [area.center[0], area.center[1]];
          }
          if (Array.isArray(area.__baseCenter)) {
            area.center = [area.__baseCenter[0] + offsetLat, area.__baseCenter[1] + offsetLng];
          }
        });
      }
    }

    if (helpers.isPluviometriaActive()) {
      window.Plv?.views?.map?.renderMarkers?.();
    }

    if (window.ChuvaGeo?.layers?.rain?.setData && window.L && cg?.rainAreaBbox) {
      const b = cg.rainAreaBbox;
      const bounds = L.latLngBounds([b.minLat, b.minLng], [b.maxLat, b.maxLng]);
      window.ChuvaGeo.layers.rain.setData({ bounds, url: cg.rainImageUrl || "./assets/img/map/testmap.png" });
      const shouldShowRain = !!window.ChuvaGeo?.state?.showRain && helpers.isPluviometriaActive();
      if (shouldShowRain) window.ChuvaGeo.layers.rain.add?.();
      else window.ChuvaGeo.layers.rain.remove?.();
    }

  }

  function getFarmMarkerIcon() {
    if (!window.L) return null;
    return L.divIcon({
      className: "map-farm-marker",
      html: `
        <div class="map-farm-pin">
          <i class="fa-solid fa-location-dot"></i>
        </div>
      `,
      iconSize: [28, 32],
      iconAnchor: [14, 32],
    });
  }

  function ensureFarmLayer() {
    if (!window.L || !window.icMap) return null;
    if (!state.farmLayer) {
      state.farmLayer = L.layerGroup().addTo(window.icMap);
    }
    return state.farmLayer;
  }

  function addFarmMarker(farm) {
    const layer = ensureFarmLayer();
    if (!layer || !farm) return;
    const tooltipHtml = `
      <div class="pivot-tooltip">
        <span class="pivot-tooltip__name">Central</span>
      </div>
    `;

    if (state.farmMarkers.has(farm.id)) {
      const existing = state.farmMarkers.get(farm.id);
      existing.setLatLng([farm.lat, farm.lng]);
      existing.unbindTooltip().bindTooltip(tooltipHtml, {
        direction: "top",
        className: "pivot-tooltip-wrap",
        opacity: 1,
        offset: [0, -10]
      });
      return;
    }
    const icon = getFarmMarkerIcon();
    const marker = L.marker([farm.lat, farm.lng], icon ? { icon } : undefined).addTo(layer);
    marker.bindTooltip(tooltipHtml, {
      direction: "top",
      className: "pivot-tooltip-wrap",
      opacity: 1,
      offset: [0, -10]
    });
    state.farmMarkers.set(farm.id, marker);
  }

  function clearFarmMarkers() {
    if (state.farmLayer) state.farmLayer.clearLayers();
    state.farmMarkers.clear();
  }

  function getActiveFarmForMarker() {
    if (state.currentFarmId) return state.farms.find((item) => item.id === state.currentFarmId) || null;
    if (state.activeFarmSnapshot?.id) {
      return state.farms.find((item) => item.id === state.activeFarmSnapshot.id) || state.activeFarmSnapshot;
    }
    return null;
  }

  function showActiveFarmMarker() {
    const farm = getActiveFarmForMarker();
    if (!farm) return;
    clearFarmMarkers();
    addFarmMarker(farm);
  }

  function parseLatLng(value) {
    if (!value) return null;
    const match = value.match(/(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/);
    if (!match) return null;
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
  }

  function bindLocationStep() {
    const input = state.bodyHost?.querySelector("[data-location-input]");
    const button = state.bodyHost?.querySelector("[data-location-btn]");
    const radiusInput = state.bodyHost?.querySelector("[data-location-radius]");
    const radiusEditBtn = state.bodyHost?.querySelector("[data-radius-edit]");
    const mapEl = state.bodyHost?.querySelector("[data-location-map]");

    if (radiusInput) {
      radiusInput.value = state.farmState.radius || "";
      radiusInput.disabled = true;
      radiusInput.addEventListener("input", () => {
        state.farmState.radius = radiusInput.value;
      });
    }

    if (radiusEditBtn && radiusInput) {
      radiusEditBtn.addEventListener("click", () => {
        radiusInput.disabled = false;
        radiusInput.focus();
        radiusInput.select();
      });
    }

    if (!input || !mapEl) return;

    const parsed = parseLatLng(input.value);
    if (!state.farmState.loc) {
      const initial = parsed || { lat: state.farmState.lat, lng: state.farmState.lng };
      state.farmState.loc = `${initial.lat.toFixed(6)}, ${initial.lng.toFixed(6)}`;
      input.value = state.farmState.loc;
    }

    const applyLocation = (lat, lng, setView = true) => {
      state.farmState.lat = lat;
      state.farmState.lng = lng;
      state.farmState.loc = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      input.value = state.farmState.loc;
      if (state.farmLocationMarker) {
        state.farmLocationMarker.setLatLng([lat, lng]);
      }
      if (state.farmLocationMap && setView) {
        state.farmLocationMap.setView([lat, lng], state.farmLocationMap.getZoom());
      }
    };

    input.addEventListener("blur", () => {
      const next = parseLatLng(input.value);
      if (next) applyLocation(next.lat, next.lng);
    });

    if (button && navigator.geolocation) {
      button.addEventListener("click", () => {
        button.disabled = true;
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            applyLocation(latitude, longitude, true);
            if (state.farmLocationMap) state.farmLocationMap.setZoom(16);
            button.disabled = false;
          },
          () => {
            button.disabled = false;
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
      });
    }

    if (!window.L) return;

    if (state.farmLocationMap) {
      try {
        state.farmLocationMap.remove();
      } catch (e) {
        // no-op
      }
      state.farmLocationMap = null;
    }

    const center = parsed || { lat: state.farmState.lat, lng: state.farmState.lng };
    state.farmLocationMap = L.map(mapEl, { zoomControl: true, attributionControl: false })
      .setView([center.lat, center.lng], 16);

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, attribution: "Tiles © Esri" }
    ).addTo(state.farmLocationMap);

    L.tileLayer(
      "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, opacity: 0.85 }
    ).addTo(state.farmLocationMap);

    const icon = getFarmMarkerIcon();
    state.farmLocationMarker = L.marker([center.lat, center.lng], icon ? { icon } : undefined).addTo(state.farmLocationMap);

    state.farmLocationMarker.bindTooltip(`
      <div class="pivot-tooltip">
        <span class="pivot-tooltip__name">Central</span>
      </div>
    `, {
      direction: "top",
      className: "pivot-tooltip-wrap",
      opacity: 1,
      offset: [0, -10]
    });

    state.farmLocationMap.on("click", (e) => {
      applyLocation(e.latlng.lat, e.latlng.lng, false);
    });

    setTimeout(() => state.farmLocationMap.invalidateSize(), 120);
  }

  viewMap.applyFarmGeo = applyFarmGeo;
  viewMap.getFarmMarkerIcon = getFarmMarkerIcon;
  viewMap.ensureFarmLayer = ensureFarmLayer;
  viewMap.addFarmMarker = addFarmMarker;
  viewMap.clearFarmMarkers = clearFarmMarkers;
  viewMap.getActiveFarmForMarker = getActiveFarmForMarker;
  viewMap.showActiveFarmMarker = showActiveFarmMarker;
  viewMap.bindLocationStep = bindLocationStep;
})();
