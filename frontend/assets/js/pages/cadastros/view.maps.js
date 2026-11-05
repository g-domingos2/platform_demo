(function () {
  "use strict";
  const Cad = (window.Cad = window.Cad || {});

  const maps = Cad.maps;
  const state = Cad.state;
  const talhoesState = Cad.talhoesState;
  const pivosState = Cad.pivosState;

  function invalidateVisibleCadastrosMaps() {
    // 1. Fazendas Map
    if (maps.fazendasMap) {
      const el = document.getElementById("cadastrosFazendasMap");
      if (el && el.offsetParent !== null) {
        maps.fazendasMap.invalidateSize();
      }
    }

    // 2. Section Maps (Talhões, Sistemas, etc)
    Object.values(maps.sectionMaps).forEach((entry) => {
      if (entry?.map) {
        const el = entry.map.getContainer();
        if (el && el.offsetParent !== null) {
          entry.map.invalidateSize();
        }
      }
    });

    // 3. Fallback via ID (for any other map initialized)
    const mapIds = [
      "cadastrosFazendasMap",
      "cadastrosTalhoesMap",
      "cadastrosSistemasMap",
      "cadastrosParcelasMap",
      "cadastrosEquipamentosMap"
    ];
    mapIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el || el.offsetParent === null) return;
      const mapObj = el._leaflet_map;
      if (mapObj && typeof mapObj.invalidateSize === "function") {
        mapObj.invalidateSize();
      }
    });
  }

  function syncFarmLocationPickerButton() {
    const btn = Cad.toolbar.ensureFarmMapActionButton() || document.getElementById("farmPickLocationBtn");
    if (btn) {
      btn.classList.toggle("is-active", !!state.isPickingFarmLocation);
      btn.title = state.isPickingFarmLocation ? "Clique no mapa para capturar" : "Obter Localização";
      btn.innerHTML = '<i class="fa-solid fa-house"></i>';
      btn.onclick = () => window.IcStartFarmLocationPick();
    }
    if (maps.fazendasMap && maps.fazendasMap.getContainer) {
      maps.fazendasMap.getContainer().style.cursor = (state.isPickingFarmLocation || state.isPickingCentralLocation) ? "crosshair" : "";
    }
  }

  function syncCentralLocationPickerButton() {
    const btn = document.getElementById("farmPickCentralBtn");
    if (btn) {
      btn.classList.toggle("is-active", !!state.isPickingCentralLocation);
      btn.title = state.isPickingCentralLocation ? "Clique no mapa para capturar" : "Definir local da central";
      btn.innerHTML = '<i class="fa-solid fa-wifi"></i>';
      btn.onclick = () => window.IcStartCentralLocationPick();
    }
    if (maps.fazendasMap && maps.fazendasMap.getContainer) {
      maps.fazendasMap.getContainer().style.cursor = (state.isPickingFarmLocation || state.isPickingCentralLocation) ? "crosshair" : "";
    }
  }

  function syncPivoCursor() {
    if (pivosState.map && pivosState.map.getContainer) {
      pivosState.map.getContainer().style.cursor = pivosState.pickTarget ? "crosshair" : "";
    }
  }

  function farmMarkerIcon() {
    return L.divIcon({
      className: "",
      html: '<div class="cadastros-farm-marker"><i class="fa-solid fa-house"></i></div>',
      iconSize: [32, 32],
      iconAnchor: [16, 28],
      popupAnchor: [0, -28]
    });
  }

  function centralMarkerIcon() {
    return L.divIcon({
      className: "",
      html: '<div class="cadastros-farm-marker cadastros-farm-marker--central"><i class="fa-solid fa-wifi"></i></div>',
      iconSize: [32, 32],
      iconAnchor: [16, 28],
      popupAnchor: [0, -28]
    });
  }

  function sectionMarkerIcon(mapId, record) {
    const base = { icon: "fa-location-dot", bg: "#0f766e" };
    const bySection = {
      cadastrosTalhoesMap: { icon: "fa-draw-polygon", bg: "#2563eb" },
      cadastrosSistemasMap: { icon: "fa-fan", bg: "#22c55e" }, // Pivôs: Verde (Irrigação)
      cadastrosParcelasMap: { icon: "fa-seedling", bg: "#16a34a" },
      cadastrosEnergiaMap: { icon: "fa-bolt", bg: "#f59e0b" },
      cadastrosFaturasMap: { icon: "fa-file-invoice-dollar", bg: "#64748b" }
    };

    let style = bySection[mapId] || base;
    if (mapId === "cadastrosEquipamentosMap" || mapId === "cadastrosVinculosMap") {
      const category = String(record?.category || "").toLowerCase();
      if (category === "pivos") {
        style = { icon: "fa-fan", bg: "#22c55e" };
      } else {
        const type = String(record?.type || "").toLowerCase();
        const equipStyles = {
          irripump: { icon: "fa-droplet", bg: "#0ea5e9" }, // Bombas (Azul claro)
          medidor: { icon: "fa-gauge", bg: "#3b82f6" }, // Medidor (Azul)
          pluviometro: { icon: "fa-cloud-rain", bg: "#a855f7" }, // Pluviômetro (Roxo)
          repetidora: { icon: "fa-tower-broadcast", bg: "#f97316" }, // Repetidora (Laranja)
          estacao_metereologica: { icon: "fa-cloud-sun-rain", bg: "#64748b" },
          rainstar: { icon: "fa-arrows-rotate", bg: "#6366f1" },
          smart_connect: { icon: "fa-radio", bg: "#eab308" }, // Central (Amarelo)
          smarttouch: { icon: "fa-sliders", bg: "#eab308" } // Central (Amarelo)
        };
        style = equipStyles[type] || { icon: "fa-microchip", bg: "#0f766e" };
      }
    }

    return L.divIcon({
      className: "",
      html: `<div style="width:18px;height:18px;border-radius:999px;background:${style.bg};border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,0.2);"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      popupAnchor: [0, -9]
    });
  }

  function renderFazendasMap(farms) {
    const mapEl = document.getElementById("cadastrosFazendasMap");
    if (!mapEl || !window.L) return;

    const points = (farms || []).filter((farm) => Number.isFinite(Number(farm.lat)) && Number.isFinite(Number(farm.lng)));
    const isFormView = state.currentType === "fazendas" && state.activeView === "form";

    if (!maps.fazendasMap) {
      maps.fazendasMap = L.map(mapEl, { zoomControl: false, attributionControl: false }).setView([-14.235, -51.9253], 5);
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19
      }).addTo(maps.fazendasMap);
      maps.fazendasMapLayer = L.layerGroup().addTo(maps.fazendasMap);
      maps.fazendasPickLayer = L.layerGroup().addTo(maps.fazendasMap);
      maps.fazendasMap.on("click", (event) => {
        const lat = Number(event.latlng.lat.toFixed(6));
        const lng = Number(event.latlng.lng.toFixed(6));
        if (state.isPickingFarmLocation) {
          const latInput = document.getElementById("farm_lat");
          const lngInput = document.getElementById("farm_lng");
          if (!latInput || !lngInput) return;
          latInput.value = String(lat);
          lngInput.value = String(lng);
          if (maps.fazendasFarmMarker) { maps.fazendasPickLayer.removeLayer(maps.fazendasFarmMarker); }
          maps.fazendasFarmMarker = L.marker([lat, lng], { icon: farmMarkerIcon(), draggable: true }).addTo(maps.fazendasPickLayer);
          maps.fazendasFarmMarker.on("dragend", (e) => {
            const p = e.target.getLatLng();
            const li = document.getElementById("farm_lat");
            const lo = document.getElementById("farm_lng");
            if (li) li.value = String(Number(p.lat.toFixed(6)));
            if (lo) lo.value = String(Number(p.lng.toFixed(6)));
          });
          maps.fazendasMap.setView([lat, lng], 15);
          state.isPickingFarmLocation = false;
          syncFarmLocationPickerButton();
        } else if (state.isPickingCentralLocation) {
          const latInput = document.getElementById("farm_central_lat");
          const lngInput = document.getElementById("farm_central_lng");
          if (!latInput || !lngInput) return;
          latInput.value = String(lat);
          lngInput.value = String(lng);
          if (maps.fazendasCentralMarker) { maps.fazendasPickLayer.removeLayer(maps.fazendasCentralMarker); }
          maps.fazendasCentralMarker = L.marker([lat, lng], { icon: centralMarkerIcon(), draggable: true }).addTo(maps.fazendasPickLayer);
          maps.fazendasCentralMarker.on("dragend", (e) => {
            const p = e.target.getLatLng();
            const li = document.getElementById("farm_central_lat");
            const lo = document.getElementById("farm_central_lng");
            if (li) li.value = String(Number(p.lat.toFixed(6)));
            if (lo) lo.value = String(Number(p.lng.toFixed(6)));
          });
          maps.fazendasMap.setView([lat, lng], 15);
          state.isPickingCentralLocation = false;
          syncCentralLocationPickerButton();
        }
      });
    }

    maps.fazendasMapLayer.clearLayers();
    if (maps.fazendasPickLayer) maps.fazendasPickLayer.clearLayers();
    maps.fazendasFarmMarker = null;
    maps.fazendasCentralMarker = null;

    if (isFormView) {
      const latInput = document.getElementById("farm_lat");
      const lngInput = document.getElementById("farm_lng");
      const lat = latInput?.value?.trim() ? Number(latInput.value.trim()) : NaN;
      const lng = lngInput?.value?.trim() ? Number(lngInput.value.trim()) : NaN;

      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        maps.fazendasFarmMarker = L.marker([lat, lng], { icon: farmMarkerIcon(), draggable: true }).addTo(maps.fazendasPickLayer);
        maps.fazendasFarmMarker.on("dragend", (e) => {
          const p = e.target.getLatLng();
          const li = document.getElementById("farm_lat");
          const lo = document.getElementById("farm_lng");
          if (li) li.value = String(Number(p.lat.toFixed(6)));
          if (lo) lo.value = String(Number(p.lng.toFixed(6)));
        });
        maps.fazendasMap.setView([lat, lng], 15);
      } else {
        maps.fazendasMap.setView([-14.235, -51.9253], 5);
      }

      const cLatInput = document.getElementById("farm_central_lat");
      const cLngInput = document.getElementById("farm_central_lng");
      const cLat = cLatInput?.value?.trim() ? Number(cLatInput.value.trim()) : NaN;
      const cLng = cLngInput?.value?.trim() ? Number(cLngInput.value.trim()) : NaN;

      if (Number.isFinite(cLat) && Number.isFinite(cLng)) {
        maps.fazendasCentralMarker = L.marker([cLat, cLng], { icon: centralMarkerIcon(), draggable: true }).addTo(maps.fazendasPickLayer);
        maps.fazendasCentralMarker.on("dragend", (e) => {
          const p = e.target.getLatLng();
          const li = document.getElementById("farm_central_lat");
          const lo = document.getElementById("farm_central_lng");
          if (li) li.value = String(Number(p.lat.toFixed(6)));
          if (lo) lo.value = String(Number(p.lng.toFixed(6)));
        });
      }

      setTimeout(() => maps.fazendasMap.invalidateSize(), 0);
      syncFarmLocationPickerButton();
      syncCentralLocationPickerButton();
      return;
    }

    if (!points.length) {
      maps.fazendasMap.setView([-14.235, -51.9253], 5);
      setTimeout(() => maps.fazendasMap.invalidateSize(), 0);
      syncFarmLocationPickerButton();
      return;
    }

    const bounds = [];
    points.forEach((farm) => {
      const lat = Number(farm.lat);
      const lng = Number(farm.lng);
      const marker = L.marker([lat, lng], { icon: farmMarkerIcon() }).addTo(maps.fazendasMapLayer);
      marker.bindPopup(`
        <strong>${farm.name || "Fazenda"}</strong><br>
        ${farm.loc || "Sem identificação"}<br>
        Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}
      `);
      bounds.push([lat, lng]);

      if (Number.isFinite(Number(farm.centralLat)) && Number.isFinite(Number(farm.centralLng))) {
        const cLat = Number(farm.centralLat);
        const cLng = Number(farm.centralLng);
        const cMarker = L.marker([cLat, cLng], { icon: centralMarkerIcon() }).addTo(maps.fazendasMapLayer);
        cMarker.bindPopup(`
          <strong><span>Central –</span> ${farm.name || "Fazenda"}</strong><br>
          Lat: ${cLat.toFixed(6)}, Lng: ${cLng.toFixed(6)}
        `);
      }
    });

    if (bounds.length === 1) {
      maps.fazendasMap.setView(bounds[0], 14);
    } else {
      maps.fazendasMap.fitBounds(bounds, { padding: [56, 56], maxZoom: 16 });
    }

    setTimeout(() => maps.fazendasMap.invalidateSize(), 0);
    syncFarmLocationPickerButton();
  }

  function extractPoint(record) {
    if (!record || typeof record !== "object") return null;
    const directPairs = [
      [record.lat, record.lng],
      [record.latitude, record.longitude],
      [record.centerLat, record.centerLng],
      [record.refLat, record.refLng],
      [record.data?.lat, record.data?.lng],
      [record.data?.latitude, record.data?.longitude],
      [record.data?.centerLat, record.data?.centerLng],
      [record.data?.refLat, record.data?.refLng]
    ];

    for (const pair of directPairs) {
      const lat = Number(pair[0]);
      const lng = Number(pair[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }

    const textCandidates = [
      record.loc, record.location, record.center, record.ref,
      record.data?.loc, record.data?.location, record.data?.center, record.data?.ref
    ];
    for (const value of textCandidates) {
      if (typeof value !== "string") continue;
      const parts = value.split(",").map((p) => Number(p.trim()));
      if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
        return { lat: parts[0], lng: parts[1] };
      }
    }

    return null;
  }

  function ensureSectionMap(mapId) {
    const mapEl = document.getElementById(mapId);
    if (!mapEl || !window.L) return null;
    const needsStableZoomConfig = mapId === "cadastrosSistemasMap";
    let preferredView = null;

    const existingEntry = maps.sectionMaps[mapId];
    if (existingEntry && needsStableZoomConfig && !existingEntry.__stableZoomConfig) {
      if (existingEntry.map) {
        const center = existingEntry.map.getCenter();
        preferredView = {
          center: [center.lat, center.lng],
          zoom: existingEntry.map.getZoom()
        };
        existingEntry.map.remove();
      }
      delete maps.sectionMaps[mapId];
    }

    if (!maps.sectionMaps[mapId]) {
      const farmView = preferredView || Cad.data.getActiveFarmView();
      const mapOptions = { zoomControl: false, attributionControl: false };
      if (needsStableZoomConfig) {
        mapOptions.zoomAnimation = false;
        mapOptions.markerZoomAnimation = false;
        mapOptions.fadeAnimation = false;
      }
      const map = L.map(mapEl, mapOptions).setView(farmView.center, farmView.zoom);
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19
      }).addTo(map);
      const layer = L.layerGroup().addTo(map);
      maps.sectionMaps[mapId] = { map, layer, __stableZoomConfig: needsStableZoomConfig };
    }

    return maps.sectionMaps[mapId];
  }

  // ── Equipment form marker (draggable pin shown while form is open) ──
  function syncEquipFormMarker(lat, lng) {
    const entry = ensureSectionMap("cadastrosEquipamentosMap");
    if (!entry || !window.L) return;
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng)) || (Number(lat) === 0 && Number(lng) === 0)) return;
    const pos = [Number(lat), Number(lng)];
    if (entry._formMarker) {
      entry._formMarker.setLatLng(pos);
    } else {
      entry._formMarker = L.marker(pos, { draggable: true, zIndexOffset: 1000 }).addTo(entry.map);
      entry._formMarker.on("dragend", (e) => {
        const p = e.target.getLatLng();
        const latlngInput = document.getElementById("equip_latlng");
        if (latlngInput) latlngInput.value = p.lat.toFixed(6) + ', ' + p.lng.toFixed(6);
      });
    }
    entry.map.setView(pos, Math.max(entry.map.getZoom(), 15));
  }

  function removeEquipFormMarker() {
    const entry = maps.sectionMaps["cadastrosEquipamentosMap"];
    if (!entry?._formMarker) return;
    entry._formMarker.remove();
    entry._formMarker = null;
  }

  function renderSectionMap(mapId, records, getLabel) {
    const entry = ensureSectionMap(mapId);
    if (!entry) return;
    if (mapId === "cadastrosEquipamentosMap" && !entry._equipClickBound) {
      entry._equipClickBound = true;
      entry.map.on("click", (event) => {
        if (!(state.currentType === "equipamentos" && state.activeView === "form" && state.isPickingEquipmentLocation)) return;
        const lat = Number(event.latlng.lat.toFixed(6));
        const lng = Number(event.latlng.lng.toFixed(6));
        const latlngInput = document.getElementById("equip_latlng");
        if (latlngInput) latlngInput.value = String(lat) + ', ' + String(lng);
        state.isPickingEquipmentLocation = false;
        const btn = document.getElementById("equipPickLocationBtn");
        if (btn) btn.classList.remove("is-active");
        syncEquipFormMarker(lat, lng);
      });
    }

    const points = (Array.isArray(records) ? records : [])
      .map((record) => {
        const point = extractPoint(record);
        if (!point) return null;
        return { ...point, record };
      })
      .filter(Boolean);

    entry.layer.clearLayers();

    const isEquipFormOpen = mapId === "cadastrosEquipamentosMap" && state.activeView === "form";

    if (!points.length) {
      if (!isEquipFormOpen) {
        const farmView = Cad.data.getActiveFarmView();
        entry.map.setView(farmView.center, farmView.zoom);
      }
      setTimeout(() => entry.map.invalidateSize(), 0);
      return;
    }

    const bounds = [];
    if (!isEquipFormOpen) {
      points.forEach((point) => {
        const marker = L.marker([point.lat, point.lng], { icon: sectionMarkerIcon(mapId, point.record) }).addTo(entry.layer);
        if (typeof getLabel === "function") {
          const label = getLabel(point.record);
          if (label) {
            marker.bindTooltip(String(label), { permanent: false, direction: "top", offset: [0, -8] });
            marker.bindPopup(String(label));
          }
        }
        bounds.push([point.lat, point.lng]);
      });
    }

    if (!isEquipFormOpen) {
      if (bounds.length === 1) {
        entry.map.setView(bounds[0], 14);
      } else {
        entry.map.fitBounds(bounds, { padding: [56, 56], maxZoom: 16 });
      }
    }

    setTimeout(() => entry.map.invalidateSize(), 0);
  }

  function renderTalhoesMap(records, options = {}) {
    const entry = ensureSectionMap("cadastrosTalhoesMap");
    if (!entry) return;

    talhoesState.map = entry.map;
    talhoesState.allLayer = entry.layer;
    if (!talhoesState.editLayer) talhoesState.editLayer = L.layerGroup().addTo(entry.map);
    if (!talhoesState.drawLayer) talhoesState.drawLayer = L.layerGroup().addTo(entry.map);
    Cad.formTalhoes.bindTalhoesMapEvents();

    talhoesState.allLayer.clearLayers();
    talhoesState.editLayer.clearLayers();
    talhoesState.drawLayer.clearLayers();
    Cad.formTalhoes.clearTalhoesEditHandles();
    talhoesState.draftLine = null;
    talhoesState.previewPolygon = null;
    talhoesState.hoverPoint = null;
    talhoesState.polygon = null;
    if (!(state.currentType === "talhoes" && state.activeView === "form")) {
      talhoesState.isDrawing = false;
    }

    const list = Array.isArray(records) ? records : [];
    const bounds = [];
    list.forEach((item) => {
      const pts = Array.isArray(item.points) ? item.points : [];
      if (pts.length >= 3) {
        L.polygon(pts, {
          color: "#eab308",
          weight: 2,
          fill: false
        }).addTo(talhoesState.allLayer);
        pts.forEach((p) => bounds.push([Number(p.lat), Number(p.lng)]));
        if (item.name) {
          const center = L.polygon(pts).getBounds().getCenter();
          L.marker([center.lat, center.lng], {
            icon: L.divIcon({
              className: "cadastros-talhao-icon",
              html: `<span class="cadastros-talhao-label">${item.name}</span>`,
              iconSize: null,
              iconAnchor: null
            }),
            interactive: false
          }).addTo(talhoesState.allLayer);
        }
      } else {
        const point = extractPoint(item);
        if (!point) return;
        L.marker([point.lat, point.lng]).addTo(talhoesState.allLayer);
        bounds.push([point.lat, point.lng]);
      }
    });

    let focusedOnEditingTalhao = false;
    if (options.editPoints && options.editPoints.length >= 3) {
      const activated = Cad.formTalhoes.activateTalhoesEditMode(options.editPoints);
      if (activated) {
        focusedOnEditingTalhao = true;
        talhoesState.points.forEach((p) => bounds.push([p.lat, p.lng]));
      }
    } else {
      talhoesState.points = [];
      Cad.formTalhoes.updateTalhoesAreaInput();
    }

    if (!focusedOnEditingTalhao) {
      const farmView = Cad.data.getActiveFarmView();
      if (!bounds.length) {
        entry.map.setView(farmView.center, farmView.zoom);
      } else if (bounds.length === 1) {
        entry.map.fitBounds(bounds, { padding: [56, 56], maxZoom: 16 });
      } else {
        entry.map.fitBounds(bounds, { padding: [56, 56], maxZoom: 16 });
      }
    }

    if (talhoesState.isDrawing && talhoesState.map.doubleClickZoom) {
      talhoesState.map.doubleClickZoom.disable();
    } else if (talhoesState.map.doubleClickZoom) {
      talhoesState.map.doubleClickZoom.enable();
    }

    setTimeout(() => entry.map.invalidateSize(), 0);
    Cad.formTalhoes.updateTalhoesDrawUi();
  }

  function centerPivoMapOnFarm(map, farmId, zoom = 14) {
    if (!map) return false;
    const selectedFarm = Cad.data.getAllFarms().find((farm) => String(farm?.id) === String(farmId || ""));
    const farmLat = Number(selectedFarm?.lat);
    const farmLng = Number(selectedFarm?.lng);
    if (!Number.isFinite(farmLat) || !Number.isFinite(farmLng)) return false;
    map.setView([farmLat, farmLng], zoom);
    return true;
  }

  Cad.viewMaps = {
    invalidateVisibleCadastrosMaps,
    syncFarmLocationPickerButton,
    syncCentralLocationPickerButton,
    syncPivoCursor,
    farmMarkerIcon,
    centralMarkerIcon,
    sectionMarkerIcon,
    renderFazendasMap,
    extractPoint,
    ensureSectionMap,
    syncEquipFormMarker,
    removeEquipFormMarker,
    renderSectionMap,
    renderTalhoesMap,
    centerPivoMapOnFarm
  };

})();
