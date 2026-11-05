(function () {
  "use strict";
  const Cad = (window.Cad = window.Cad || {});

  const state = Cad.state || (Cad.state = {});
  const pivosState = Cad.pivosState || (Cad.pivosState = {});
  const SEG_COLORS = Cad.SEG_COLORS || ["#1D4ED8", "#8B5CF6", "#22C55E", "#84CC16", "#F59E0B", "#EF4444", "#EC4899", "#06B6D4", "#F43F5E"];
  const PIVO_LOCATION_PREVIEW_STYLE = Object.freeze({
    stroke: "#ffffff",
    fill: "#f9a8d4",
    fillOpacity: 0.2,
    refStroke: "#ffffff"
  });
  Cad.SEG_COLORS = SEG_COLORS;

  function ensureSectionMap(mapId) { return Cad.viewMaps?.ensureSectionMap?.(mapId) || null; }
  function getCurrentContextFarmId() { return Cad.data?.getCurrentContextFarmId?.() || ""; }
  function getAllTalhoesRecords(farmId = null) { return Cad.data?.getAllTalhoesRecords?.(farmId) || []; }
  function parsePivoCompositeId(compositeId) { return Cad.data?.parsePivoCompositeId?.(compositeId) || null; }
  function toBooleanFlag(value) { return Cad.geo?.toBooleanFlag?.(value) || value === true; }
  function bearingBetweenPoints(lat1, lng1, lat2, lng2) { return Cad.geo?.bearingBetweenPoints?.(lat1, lng1, lat2, lng2); }
  function buildSectorPolygonLatLngs(lat, lng, radiusMeters, startBearingDeg, endBearingDeg, steps = 96) { return Cad.geo?.buildSectorPolygonLatLngs?.(lat, lng, radiusMeters, startBearingDeg, endBearingDeg, steps) || []; }
  function calculateBearingPoint(lat, lng, radiusMeters, bearingDeg) { return Cad.geo?.calculateBearingPoint?.(lat, lng, radiusMeters, bearingDeg) || null; }
  function collectPivoFormData() { return Cad.pivosHelpers?.collectPivoFormData?.() || null; }
  function getAllPivosRecords(farmId = null) { return Cad.data?.getAllPivosRecords?.(farmId) || []; }
  function getAllFarms() { return Cad.data?.getAllFarms?.() || []; }
  function getFarmEquipmentList(farm) { return Cad.data?.getFarmEquipmentList?.(farm) || []; }
  function syncPivoRadiusFromInputs() { return Cad.pivosHelpers?.syncPivoRadiusFromInputs?.(); }
  function syncPivoNorthReferenceFromInputs() { return Cad.pivosHelpers?.syncPivoNorthReferenceFromInputs?.(); }
  function getActiveFarmView() { return Cad.data?.getActiveFarmView?.() || { center: [-14.235, -51.9253], zoom: 4 }; }
  function normalizeToken(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }
  function isPluviometroEquipment(record) {
    const token = normalizeToken(record?.type);
    return token === "pluviometro" || token.startsWith("pluviometro ");
  }
  function getLinkedMonitorIds(formData) {
    const linkedIds = new Set();
    const formMonitorIds = Array.isArray(formData?.monitorIds) ? formData.monitorIds : [];
    formMonitorIds.forEach((id) => linkedIds.add(String(id)));

    const hiddenRaw = document.getElementById("pivo_monitoramento_ids")?.value || "";
    if (hiddenRaw) {
      try {
        const parsed = JSON.parse(hiddenRaw);
        if (Array.isArray(parsed)) {
          parsed.forEach((id) => linkedIds.add(String(id)));
        }
      } catch (_) {
        // Ignore invalid hidden json and keep current linked set.
      }
    }

    const linkedList = document.getElementById("vinc-pluvio-linked");
    Array.from(linkedList?.querySelectorAll(".vinc-item[data-id]") || []).forEach((el) => {
      linkedIds.add(String(el.dataset.id));
    });
    const selectedList = document.getElementById("vinc-pluvio-list");
    Array.from(selectedList?.querySelectorAll(".vinc-item.is-selected[data-id]") || []).forEach((el) => {
      linkedIds.add(String(el.dataset.id));
    });

    return linkedIds;
  }
  function centerPivoMapOnFarm(map, farmId, zoom = 14) {
    if (Cad.formPivos?.centerPivoMapOnFarm) return Cad.formPivos.centerPivoMapOnFarm(map, farmId, zoom);
    return Cad.viewMaps?.centerPivoMapOnFarm?.(map, farmId, zoom) || false;
  }
  function bindPivoMapPickEvents() { return Cad.formPivos?.bindPivoMapPickEvents?.(); }

  function renderPivosFormMap(formData, allRecords) {
    const entry = ensureSectionMap("cadastrosSistemasMap");
    if (!entry) return;

    const activePivoTab = document.querySelector(".farm-tab-btn[data-pivo-tab].is-active")?.getAttribute("data-pivo-tab") || "localizacao";
    const isLocalizacaoMode = activePivoTab === "localizacao";
    const isParcelasMode = activePivoTab === "segmentos";
    const isCanhaoMode = activePivoTab === "canhao";


    pivosState.map = entry.map;
    pivosState.listLayer = entry.layer;
    if (!pivosState.editLayer) pivosState.editLayer = L.layerGroup().addTo(entry.map);
    if (!entry.map.getPane("cadastrosTalhoesBgPane")) {
      const bgPane = entry.map.createPane("cadastrosTalhoesBgPane");
      bgPane.style.zIndex = "330";
      bgPane.style.pointerEvents = "auto";
    }
    if (!pivosState.talhoesBgLayer) pivosState.talhoesBgLayer = L.layerGroup().addTo(entry.map);
    if (!pivosState.pluvioLayer) pivosState.pluvioLayer = L.layerGroup().addTo(entry.map);
    bindPivoMapPickEvents();

    pivosState.talhoesBgLayer.clearLayers();
    pivosState.pluvioLayer.clearLayers();
    pivosState.listLayer.clearLayers();
    pivosState.editLayer.clearLayers();

    const formFarmId = String(formData?.farmId || getCurrentContextFarmId() || "");
    const isVinculosMode = activePivoTab === "vinculos";
    const talhoes = isVinculosMode ? getAllTalhoesRecords(formFarmId) : [];
    const toggleVincItemOnMap = (listId, dataId) => {
      const item = document.querySelector(`#${listId} .vinc-item[data-id="${dataId}"]`);
      if (!item) return;
      item.classList.toggle("is-selected");
      const hiddenMap = { "vinc-talhoes-list": "pivo_talhoes_ids", "vinc-pluvio-list": "pivo_monitoramento_ids" };
      const hiddenInput = document.getElementById(hiddenMap[listId]);
      if (hiddenInput) {
        const ids = Array.from(document.querySelectorAll(`#${listId} .vinc-item.is-selected`)).map(el => el.dataset.id);
        hiddenInput.value = JSON.stringify(ids);
      }
      const formData = Cad.pivosHelpers?.collectPivoFormData?.();
      if (formData) Cad.pivosHelpers?.renderPivosFormMap?.(formData, Cad.data?.getAllPivosRecords?.() || []);
    };

    talhoes.forEach((talhao) => {
      const points = Array.isArray(talhao?.points) ? talhao.points : [];
      if (points.length < 3) return;
      const talhaoId = String(talhao?.id || "");
      const isSelected = !!document.querySelector(`#vinc-talhoes-list .vinc-item.is-selected[data-id="${talhaoId}"]`);
      const polygon = L.polygon(points, {
        pane: "cadastrosTalhoesBgPane",
        color: isSelected ? "#16a34a" : "#eab308",
        weight: isSelected ? 2.5 : 1.5,
        fill: isSelected,
        fillOpacity: 0.12
      }).addTo(pivosState.talhoesBgLayer);
      const talhaoName = String(talhao?.name || "Talhão");
      polygon.on("click", () => toggleVincItemOnMap("vinc-talhoes-list", talhaoId));
      polygon.on("mouseover", () => polygon.setStyle({ weight: 2.5 }));
      polygon.on("mouseout", () => polygon.setStyle({ weight: isSelected ? 2.5 : 1.5 }));
      if (typeof polygon.bringToBack === "function") polygon.bringToBack();
      const labelCenter = polygon.getBounds().getCenter();
      L.marker([labelCenter.lat, labelCenter.lng], {
        icon: L.divIcon({
          className: "cadastros-talhao-icon",
          html: `<span class="cadastros-talhao-label">${talhaoName}</span>`,
          iconSize: null,
          iconAnchor: null
        }),
        interactive: false,
        pane: "cadastrosTalhoesBgPane"
      }).addTo(pivosState.talhoesBgLayer);
    });

    // Pluviômetros no mapa apenas na aba Vínculos
    if (isVinculosMode) {
      const farms = getAllFarms();
      const farm = farms.find((f) => String(f.id) === formFarmId);
      const allEquip = getFarmEquipmentList(farm).filter(isPluviometroEquipment);
      const linkedIds = getLinkedMonitorIds(formData);
      allEquip.forEach((equip) => {
        const eLat = Number(equip?.data?.lat ?? equip?.lat ?? "");
        const eLng = Number(equip?.data?.lng ?? equip?.lng ?? "");
        if (!Number.isFinite(eLat) || !Number.isFinite(eLng) || (eLat === 0 && eLng === 0)) return;
        const isLinked = linkedIds.has(String(equip.id));
        const name = String(equip.name || "Pluviômetro");
        const stateClass = isLinked ? "pivo-pluvio-marker--linked" : "pivo-pluvio-marker--avail";
        const marker = L.marker([eLat, eLng], {
          icon: L.divIcon({
            className: "pivo-pluvio-icon-root",
            html: `<div class="pivo-pluvio-marker ${stateClass}"><div class="pivo-pluvio-marker__icon"><i class="fa-solid fa-droplet"></i></div><span class="pivo-pluvio-marker__label">${name}</span></div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13]
          }),
          interactive: true
        }).addTo(pivosState.pluvioLayer);
        marker.bindTooltip(name, { direction: "top", offset: [0, -36] });
        marker.on("click", () => toggleVincItemOnMap("vinc-pluvio-list", String(equip.id)));
      });
    }

    const lat = Number(formData?.lat);
    const lng = Number(formData?.lng);
    const refLat = Number(formData?.refLat);
    const refLng = Number(formData?.refLng);
    const lastTowerLat = Number(formData?.lastTowerLat);
    const lastTowerLng = Number(formData?.lastTowerLng);
    const startLat = Number(formData?.startLat);
    const startLng = Number(formData?.startLng);
    const endLat = Number(formData?.endLat);
    const endLng = Number(formData?.endLng);
    const isPartial = !!formData?.isPartial;
    const radius = Number(formData?.radius);
    const parcelas = Array.isArray(formData?.parcelas) ? formData.parcelas : [];
    const segments = Array.isArray(formData?.segments) ? formData.segments : [];
    const canhaoSegments = Array.isArray(formData?.canhaoSegments) ? formData.canhaoSegments : [];
    const hasFormCenter = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
    const isFormMode = state.activeView === "form";
    const currentFormId = String(formData?.id || "");
    const currentFarmId = String(formData?.farmId || "");
    const currentFormName = String(formData?.name || "").trim().toLowerCase();
    const editingComposite = parsePivoCompositeId(state.editingId);
    const editingFarmId = String(editingComposite?.farmId || "");
    const editingPivoId = String(editingComposite?.pivoId || "");
    const isEditingAnyPivo = isFormMode && (Boolean(editingPivoId) || Boolean(currentFormId));
    const hideContextRecords = isFormMode && (isEditingAnyPivo || !hasFormCenter);

    const records = Array.isArray(allRecords) ? allRecords : [];
    const bounds = [];
    if (!hideContextRecords) {
      records.forEach((record) => {
        const lat = Number(record.lat);
        const lng = Number(record.lng);
        const refLat = Number(record?.refLat ?? record?.data?.refLat);
        const refLng = Number(record?.refLng ?? record?.data?.refLng);
        const radius = Number(record.radius);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const recordFarmId = String(record?.farmId || "");
        const recordId = String(record?.id || "");
        const recordName = String(record?.name || "").trim().toLowerCase();

        const isCurrentRecord =
          isFormMode &&
          (
            (currentFormId && currentFarmId && recordId === currentFormId && recordFarmId === currentFarmId) ||
            (editingPivoId && editingFarmId && recordId === editingPivoId && recordFarmId === editingFarmId) ||
            (currentFormName && currentFarmId && recordName && recordName === currentFormName && recordFarmId === currentFarmId)
          );
        if (isCurrentRecord) return;
        const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : 80;
        const isPartial = toBooleanFlag(record?.isPartial ?? record?.data?.isPartial);
        const startLat = Number(record?.startLat ?? record?.data?.startLat);
        const startLng = Number(record?.startLng ?? record?.data?.startLng);
        const endLat = Number(record?.endLat ?? record?.data?.endLat);
        const endLng = Number(record?.endLng ?? record?.data?.endLng);
        let circle = null;
        if (isPartial && Number.isFinite(startLat) && Number.isFinite(startLng) && Number.isFinite(endLat) && Number.isFinite(endLng)) {
          const startBearing = bearingBetweenPoints(lat, lng, startLat, startLng) ?? 0;
          const endBearing = bearingBetweenPoints(lat, lng, endLat, endLng);
          const sectorPoints = buildSectorPolygonLatLngs(lat, lng, safeRadius, startBearing, endBearing ?? startBearing);
          circle = L.polygon(sectorPoints, {
            color: "#94a3b8",
            weight: 1.5,
            fill: false
          }).addTo(pivosState.listLayer);
        } else {
          circle = L.circle([lat, lng], {
            radius: safeRadius,
            color: "#94a3b8",
            weight: 1.5,
            fill: false
          }).addTo(pivosState.listLayer);
        }
        const pivoName = String(record?.name || "Pivô Central");
        if (isPartial && Number.isFinite(startLat) && Number.isFinite(startLng)) {
          L.polyline([[lat, lng], [startLat, startLng]], {
            color: "#f59e0b",
            weight: 2
          }).addTo(pivosState.listLayer);
        }
        if (isPartial && Number.isFinite(endLat) && Number.isFinite(endLng)) {
          L.polyline([[lat, lng], [endLat, endLng]], {
            color: "#f59e0b",
            weight: 2
          }).addTo(pivosState.listLayer);
        }
        circle.bindPopup(pivoName, { autoClose: true, closeButton: false, offset: [0, -8] });
        circle.on("mouseover", () => circle.openPopup());
        circle.on("mouseout", () => circle.closePopup());
        if (Number.isFinite(refLat) && Number.isFinite(refLng)) {
          L.polyline([[lat, lng], [refLat, refLng]], {
            color: "#000000",
            weight: 2,
            opacity: 0.85
          }).addTo(pivosState.listLayer);
          bounds.push([refLat, refLng]);
        }
        bounds.push([lat, lng]);
      });
    }

    let formBounds = null;
    let formBoundsPoints = 0;

    if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
      const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : 0;
      let editShape = null;

      let centerPin = null;

      // Adicionar o PIN verde arrastável no centro (apenas Localização)
      if (isLocalizacaoMode) {
        centerPin = L.marker([lat, lng], {
          draggable: true,
          icon: L.divIcon({
            html: '<i class="fa-solid fa-location-dot" style="color: #16a34a; font-size: 28px; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3));"></i>',
            className: 'pivo-center-pin',
            iconSize: [28, 28],
            iconAnchor: [14, 28]
          })
        }).addTo(pivosState.editLayer);

        centerPin.on("dragstart", () => {
          pivosState.isDraggingCenter = true;
          // Oculta visualmente as outras geometrias sem destruir o PIN para não quebrar o arrasto
          pivosState.editLayer.eachLayer(l => {
            if (l !== centerPin && l.getElement) {
              const el = l.getElement();
              if (el) el.style.opacity = "0";
            }
          });
        });

        centerPin.on("dragend", (e) => {
          pivosState.isDraggingCenter = false;
          const newPos = e.target.getLatLng();
          const nLat = Number(newPos.lat.toFixed(6));
          const nLng = Number(newPos.lng.toFixed(6));
          const latInput = document.getElementById("pivo_lat");
          const lngInput = document.getElementById("pivo_lng");
          const centerInput = document.getElementById("pivo_center");
          if (latInput) latInput.value = String(nLat);
          if (lngInput) lngInput.value = String(nLng);
          if (centerInput) centerInput.value = `${nLat}, ${nLng}`;
          syncPivoRadiusFromInputs();
          syncPivoNorthReferenceFromInputs();
          // Recarrega tudo ao final para mostrar o círculo na nova posição
          renderPivosFormMap(collectPivoFormData(), getAllPivosRecords());
        });
      }

      const isPickingCenter = pivosState.pickTarget === "center" || pivosState.isDraggingCenter;

      if (safeRadius > 0 && (!isPickingCenter || isLocalizacaoMode)) {
        if (isParcelasMode) {
          const getParcelColor = (idx) => SEG_COLORS[idx % SEG_COLORS.length];

          // Círculo externo branco sólido
          L.circle([lat, lng], {
            radius: safeRadius,
            color: "#ffffff",
            weight: 2,
            fill: false
          }).addTo(pivosState.editLayer);

          // Preenchimento de segmentos coloridos
          segments
            .filter((p) => Number.isFinite(Number(p.startAngle)) && Number.isFinite(Number(p.endAngle)))
            .forEach((seg, i) => {
              const startAngle = ((Number(seg.startAngle) % 360) + 360) % 360;
              const endAngle = ((Number(seg.endAngle) % 360) + 360) % 360;
              const sectorPoints = buildSectorPolygonLatLngs(lat, lng, safeRadius, startAngle, endAngle);
              if (Array.isArray(sectorPoints) && sectorPoints.length > 2) {
                L.polygon(sectorPoints, {
                  color: "#ffffff",
                  weight: 1,
                  fill: true,
                  fillColor: getParcelColor(i),
                  fillOpacity: 0.35,
                  opacity: 0.9
                }).addTo(pivosState.editLayer);
              }
            });

          // Linhas internas de divisão para ângulos de segmento
          const divisaoAngles = new Set();
          segments
            .filter((p) => Number.isFinite(Number(p.startAngle)) && Number.isFinite(Number(p.endAngle)))
            .forEach((p) => {
              divisaoAngles.add(((Number(p.startAngle) % 360) + 360) % 360);
              divisaoAngles.add(((Number(p.endAngle) % 360) + 360) % 360);
            });
          if (divisaoAngles.size === 0) {
            for (let a = 0; a < 360; a += 30) divisaoAngles.add(a);
          }
          divisaoAngles.forEach((angle) => {
            const edgeOuter = calculateBearingPoint(lat, lng, safeRadius, angle);
            const edgeInner = calculateBearingPoint(lat, lng, safeRadius * 0.88, angle);
            if (edgeOuter && edgeInner) {
              L.polyline([[edgeInner.lat, edgeInner.lng], [edgeOuter.lat, edgeOuter.lng]], {
                color: "#ffffff",
                weight: 1.5,
                opacity: 0.9
              }).addTo(pivosState.editLayer);
            }
          });

          // Handles arrastáveis nas fronteiras entre segmentos (incluindo wrap-around)
          if (segments.length > 1) {
            for (let hi = 0; hi < segments.length; hi++) {
              const bAngle = ((Number(segments[hi].endAngle) % 360) + 360) % 360;
              const hPt = calculateBearingPoint(lat, lng, safeRadius, bAngle);
              if (!hPt) continue;
              const hIdx = hi;
              const colorA = SEG_COLORS[hi % SEG_COLORS.length];
              const colorB = SEG_COLORS[(hi + 1) % SEG_COLORS.length];
              const handle = L.marker([hPt.lat, hPt.lng], {
                draggable: true,
                icon: L.divIcon({
                  className: "pivo-seg-handle",
                  html: `<div class="pivo-seg-handle__dot" style="background:linear-gradient(90deg,${colorA} 50%,${colorB} 50%);border-color:#fff;"></div>`,
                  iconSize: [16, 16],
                  iconAnchor: [8, 8]
                })
              }).addTo(pivosState.editLayer);

              handle.on("drag", (e) => {
                const pos = e.target.getLatLng();
                const bearing = bearingBetweenPoints(lat, lng, pos.lat, pos.lng);
                if (bearing === null || bearing === undefined) return;
                const newAngle = ((bearing % 360) + 360) % 360;
                const snapped = calculateBearingPoint(lat, lng, safeRadius, newAngle);
                if (snapped) e.target.setLatLng([snapped.lat, snapped.lng]);
                if (typeof pivosState._setSegBoundaryAngle === "function") {
                  pivosState._setSegBoundaryAngle(hIdx, newAngle);
                }
              });

              handle.on("dragend", () => {
                renderPivosFormMap(collectPivoFormData(), getAllPivosRecords());
              });
            }
          }



          formBounds = L.circle([lat, lng], { radius: safeRadius }).getBounds();
          formBoundsPoints = 2;
        } else if (isCanhaoMode) {
          const getCanhaoColor = (idx) => SEG_COLORS[idx % SEG_COLORS.length];

          L.circle([lat, lng], {
            radius: safeRadius, color: "#ffffff", weight: 2, fill: false
          }).addTo(pivosState.editLayer);

          canhaoSegments
            .filter((s) => Number.isFinite(Number(s.startAngle)) && Number.isFinite(Number(s.endAngle)))
            .forEach((seg, i) => {
              const sA = ((Number(seg.startAngle) % 360) + 360) % 360;
              const eA = ((Number(seg.endAngle) % 360) + 360) % 360;
              const sectorPoints = buildSectorPolygonLatLngs(lat, lng, safeRadius, sA, eA);
              if (Array.isArray(sectorPoints) && sectorPoints.length > 2) {
                L.polygon(sectorPoints, {
                  color: "#ffffff", weight: 1, fill: true,
                  fillColor: getCanhaoColor(i), fillOpacity: 0.35, opacity: 0.9
                }).addTo(pivosState.editLayer);
              }
            });

          const cDivAngles = new Set();
          canhaoSegments
            .filter((s) => Number.isFinite(Number(s.startAngle)) && Number.isFinite(Number(s.endAngle)))
            .forEach((s) => {
              cDivAngles.add(((Number(s.startAngle) % 360) + 360) % 360);
              cDivAngles.add(((Number(s.endAngle) % 360) + 360) % 360);
            });
          if (!cDivAngles.size) { for (let a = 0; a < 360; a += 30) cDivAngles.add(a); }

          cDivAngles.forEach((angle) => {
            const outer = calculateBearingPoint(lat, lng, safeRadius, angle);
            const inner = calculateBearingPoint(lat, lng, safeRadius * 0.88, angle);
            if (outer && inner) {
              L.polyline([[inner.lat, inner.lng], [outer.lat, outer.lng]], {
                color: "#ffffff", weight: 1.5, opacity: 0.9
              }).addTo(pivosState.editLayer);
            }
          });

          // Handles de início e fim do segmento ativo
          const activeCIdx = pivosState._activeCanhaoSegIdx ?? 0;
          const activeCSegData = canhaoSegments[activeCIdx];
          if (activeCSegData) {
            const segColor = SEG_COLORS[activeCIdx % SEG_COLORS.length];
            [["startAngle", "#ffffff"], ["endAngle", segColor]].forEach(([field, dotColor]) => {
              const angle = ((Number(activeCSegData[field] ?? 270) % 360) + 360) % 360;
              const pt = calculateBearingPoint(lat, lng, safeRadius, angle);
              if (!pt) return;
              L.marker([pt.lat, pt.lng], {
                draggable: true,
                icon: L.divIcon({
                  className: "pivo-seg-handle",
                  html: `<div class="pivo-seg-handle__dot" style="background:${dotColor};border-color:${segColor};"></div>`,
                  iconSize: [16, 16], iconAnchor: [8, 8]
                })
              }).addTo(pivosState.editLayer)
                .on("drag", (e) => {
                  const pos = e.target.getLatLng();
                  const bearing = bearingBetweenPoints(lat, lng, pos.lat, pos.lng);
                  if (bearing === null || bearing === undefined) return;
                  const newAngle = ((bearing % 360) + 360) % 360;
                  const snapped = calculateBearingPoint(lat, lng, safeRadius, newAngle);
                  if (snapped) e.target.setLatLng([snapped.lat, snapped.lng]);
                  if (typeof pivosState._updateCanhaoSegAngle === "function") {
                    pivosState._updateCanhaoSegAngle(activeCIdx, field, newAngle);
                  }
                })
                .on("dragend", () => {
                  renderPivosFormMap(collectPivoFormData(), getAllPivosRecords());
                });
            });
          }

          formBounds = L.circle([lat, lng], { radius: safeRadius }).getBounds();
          formBoundsPoints = 2;
        } else if (isPartial && Number.isFinite(startLat) && Number.isFinite(startLng) && Number.isFinite(endLat) && Number.isFinite(endLng)) {
          const startBearing = bearingBetweenPoints(lat, lng, startLat, startLng) ?? 0;
          const endBearing = bearingBetweenPoints(lat, lng, endLat, endLng);
          const sectorPoints = buildSectorPolygonLatLngs(lat, lng, safeRadius, startBearing, endBearing ?? startBearing);
          editShape = L.polygon(sectorPoints, {
            color: isLocalizacaoMode ? PIVO_LOCATION_PREVIEW_STYLE.stroke : "#eab308",
            weight: 2,
            fill: isLocalizacaoMode,
            fillColor: PIVO_LOCATION_PREVIEW_STYLE.fill,
            fillOpacity: isLocalizacaoMode ? PIVO_LOCATION_PREVIEW_STYLE.fillOpacity : 0
          }).addTo(pivosState.editLayer);
          formBounds = editShape.getBounds();
          formBoundsPoints = 1;
        } else {
          editShape = L.circle([lat, lng], {
            radius: safeRadius,
            color: isLocalizacaoMode ? PIVO_LOCATION_PREVIEW_STYLE.stroke : "#eab308",
            weight: 2,
            fill: isLocalizacaoMode,
            fillColor: PIVO_LOCATION_PREVIEW_STYLE.fill,
            fillOpacity: isLocalizacaoMode ? PIVO_LOCATION_PREVIEW_STYLE.fillOpacity : 0
          }).addTo(pivosState.editLayer);
          formBounds = editShape.getBounds();
          formBoundsPoints = 1;
        }
      } else {
        formBounds = L.latLngBounds([[lat, lng], [lat, lng]]);
        formBoundsPoints = 1;
      }

      const isPickingRef = pivosState.pickTarget === "ref" || pivosState.isDraggingRef;

      // Ocultar polylines de referência, ângulos e parcelas se estiver escolhendo o centro ou ajustando a ref
      if ((!isPickingCenter && !isPickingRef && !isParcelasMode && !isCanhaoMode) || (isLocalizacaoMode && !isParcelasMode && !isCanhaoMode)) {
        if (Number.isFinite(refLat) && Number.isFinite(refLng)) {
          L.polyline([[lat, lng], [refLat, refLng]], {
            color: isLocalizacaoMode ? PIVO_LOCATION_PREVIEW_STYLE.refStroke : "#000000",
            weight: 2,
            opacity: 0.95
          }).addTo(pivosState.editLayer);
          formBounds.extend([refLat, refLng]);
          formBoundsPoints += 1;
          bounds.push([refLat, refLng]);
        }

        if (isPartial && Number.isFinite(startLat) && Number.isFinite(startLng)) {
          L.polyline([[lat, lng], [startLat, startLng]], { color: "#f59e0b", weight: 2 }).addTo(pivosState.editLayer);
          formBounds.extend([startLat, startLng]);
          formBoundsPoints += 1;
          bounds.push([startLat, startLng]);
        }
        if (isPartial && Number.isFinite(endLat) && Number.isFinite(endLng)) {
          L.polyline([[lat, lng], [endLat, endLng]], { color: "#f59e0b", weight: 2 }).addTo(pivosState.editLayer);
          formBounds.extend([endLat, endLng]);
          formBoundsPoints += 1;
          bounds.push([endLat, endLng]);
        }

        const _divAngles = new Set();
        parcelas
          .filter((parcela) => Number.isFinite(Number(parcela?.startAngle)) && Number.isFinite(Number(parcela?.endAngle)))
          .forEach((parcela) => {
            _divAngles.add(((Number(parcela.startAngle) % 360) + 360) % 360);
            _divAngles.add(((Number(parcela.endAngle) % 360) + 360) % 360);
          });

        if (isParcelasMode && !_divAngles.size) {
          // Se não há parcelas, ainda mostramos divisões simples (12 ticks)
          for (let a = 0; a < 360; a += 30) {
            _divAngles.add(a);
          }
        }

        _divAngles.forEach((angle) => {
          if (isParcelasMode) {
            // Traço interno curto para delimitação de cada divisão
            const outer = calculateBearingPoint(lat, lng, safeRadius, angle);
            const inner = calculateBearingPoint(lat, lng, Math.max(0, safeRadius * 0.88), angle);
            if (outer && inner) {
              L.polyline([[inner.lat, inner.lng], [outer.lat, outer.lng]], {
                color: "#ffffff",
                weight: 2,
                opacity: 0.95
              }).addTo(pivosState.editLayer);
            }
          } else {
            const edgePt = calculateBearingPoint(lat, lng, safeRadius, angle);
            if (edgePt) {
              L.polyline([[lat, lng], [edgePt.lat, edgePt.lng]], {
                color: "#22c55e",
                weight: 1.5,
                dashArray: "6 4",
                opacity: 0.9
              }).addTo(pivosState.editLayer);
            }
          }
        });
      }

      // PIN Vermelho arrastável para a Referência (apenas Localização)
      if (isLocalizacaoMode && Number.isFinite(refLat) && Number.isFinite(refLng)) {
        const refPin = L.marker([refLat, refLng], {
          draggable: true,
          icon: L.divIcon({
            html: '<i class="fa-solid fa-location-dot" style="color: #ef4444; font-size: 28px; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3)); cursor: grab;"></i>',
            className: 'pivo-ref-pin',
            iconSize: [28, 28],
            iconAnchor: [14, 28]
          })
        }).addTo(pivosState.editLayer);

        refPin.on("dragstart", () => {
          pivosState.isDraggingRef = true;
          // Hide other layers but don't re-render
          pivosState.editLayer.eachLayer(l => {
            if (l !== refPin && l !== centerPin && l.getElement) {
              const el = l.getElement();
              if (el) el.style.opacity = "0";
            }
          });
        });

        refPin.on("dragend", (e) => {
          pivosState.isDraggingRef = false;
          const newPos = e.target.getLatLng();
          const nLat = Number(newPos.lat.toFixed(6));
          const nLng = Number(newPos.lng.toFixed(6));

          const refLatInput = document.getElementById("pivo_refLat");
          const refLngInput = document.getElementById("pivo_refLng");
          const refInput = document.getElementById("pivo_ref");

          if (refLatInput) refLatInput.value = String(nLat);
          if (refLngInput) refLngInput.value = String(nLng);
          if (refInput) refInput.value = `${nLat}, ${nLng}`;

          syncPivoRadiusFromInputs();
          syncPivoNorthReferenceFromInputs();
          renderPivosFormMap(collectPivoFormData(), getAllPivosRecords());
        });
      }

      bounds.push([lat, lng]);
    }


    if (state.activeView === "form" && !hasFormCenter) {
      if (centerPivoMapOnFarm(entry.map, formData?.farmId, 14)) {
        setTimeout(() => entry.map.invalidateSize(), 0);
        return;
      }
    }

    if (!bounds.length) {
      entry.map.setView(getActiveFarmView().center, getActiveFarmView().zoom);
    } else if (state.activeView === "form" && hasFormCenter) {
      if (formBounds && formBounds.isValid() && formBoundsPoints > 1) {
        entry.map.fitBounds(formBounds, { padding: [56, 56], maxZoom: 16 });
      } else {
        entry.map.setView([lat, lng], 15);
      }
    } else if (bounds.length === 1) {
      entry.map.setView(bounds[0], 12);
    } else {
      entry.map.fitBounds(bounds, { padding: [56, 56], maxZoom: 13 });
    }

    setTimeout(() => entry.map.invalidateSize(), 0);
  }


  function renderPivosSectionMap(records) {
    const entry = ensureSectionMap("cadastrosSistemasMap");
    if (!entry) return;

    entry.layer.clearLayers();
    if (pivosState.editLayer) pivosState.editLayer.clearLayers();
    if (pivosState.talhoesBgLayer) pivosState.talhoesBgLayer.clearLayers();
    if (pivosState.pluvioLayer) pivosState.pluvioLayer.clearLayers();
    const list = Array.isArray(records) ? records : [];
    const bounds = [];

    list.forEach((record) => {
      const lat = Number(record?.lat);
      const lng = Number(record?.lng);
      const refLat = Number(record?.refLat ?? record?.data?.refLat);
      const refLng = Number(record?.refLng ?? record?.data?.refLng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const radius = Number(record?.radius);
      const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : 80;
      const isPartial = toBooleanFlag(record?.isPartial ?? record?.data?.isPartial);
      const startLat = Number(record?.startLat ?? record?.data?.startLat);
      const startLng = Number(record?.startLng ?? record?.data?.startLng);
      const endLat = Number(record?.endLat ?? record?.data?.endLat);
      const endLng = Number(record?.endLng ?? record?.data?.endLng);

      // Divisões de segmentos: apenas linhas pontilhadas e labels (sem preenchimento)
      const recSegs = Array.isArray(record?.segments) ? record.segments : [];
      if (recSegs.length > 1) {
        recSegs.forEach((seg) => {
          const sStart = ((Number(seg.startAngle) % 360) + 360) % 360;
          const sEnd = ((Number(seg.endAngle) % 360) + 360) % 360;
          // Linha pontilhada branca na fronteira de início
          const edgePt = calculateBearingPoint(lat, lng, safeRadius, sStart);
          if (edgePt) {
            L.polyline([[lat, lng], [edgePt.lat, edgePt.lng]], {
              color: "#ffffff", weight: 1.5, dashArray: "5 4", opacity: 0.85
            }).addTo(entry.layer);
          }
          // Label no centro do arco
          if (seg.name) {
            const span = ((sEnd - sStart) + 360) % 360 || 360;
            const midAngle = (sStart + span / 2) % 360;
            const lPt = calculateBearingPoint(lat, lng, safeRadius * 0.58, midAngle);
            if (lPt) {
              L.marker([lPt.lat, lPt.lng], {
                icon: L.divIcon({
                  className: "pivo-seg-map-label",
                  html: `<span class="pivo-seg-map-label__text">${seg.name}</span>`,
                  iconSize: null, iconAnchor: null
                }),
                interactive: false
              }).addTo(entry.layer);
            }
          }
        });
      }

      let circle = null;
      if (isPartial && Number.isFinite(startLat) && Number.isFinite(startLng) && Number.isFinite(endLat) && Number.isFinite(endLng)) {
        const startBearing = bearingBetweenPoints(lat, lng, startLat, startLng) ?? 0;
        const endBearing = bearingBetweenPoints(lat, lng, endLat, endLng);
        const sectorPoints = buildSectorPolygonLatLngs(lat, lng, safeRadius, startBearing, endBearing ?? startBearing);
        circle = L.polygon(sectorPoints, {
          color: "#eab308",
          weight: 1.5,
          fill: false
        }).addTo(entry.layer);
      } else {
        circle = L.circle([lat, lng], {
          radius: safeRadius,
          color: "#eab308",
          weight: 1.5,
          fill: false
        }).addTo(entry.layer);
      }
      const pivoName = String(record?.name || "Pivô Central");
      circle.bindPopup(pivoName, { autoClose: true, closeButton: false, offset: [0, -8] });
      circle.on("mouseover", () => circle.openPopup());
      circle.on("mouseout", () => circle.closePopup());
      L.marker([lat, lng], {
        icon: L.divIcon({
          className: "cadastros-talhao-icon",
          html: `<span class="cadastros-talhao-label">${pivoName}</span>`,
          iconSize: null,
          iconAnchor: null
        }),
        interactive: false
      }).addTo(entry.layer);
      if (isPartial && Number.isFinite(startLat) && Number.isFinite(startLng)) {
        L.polyline([[lat, lng], [startLat, startLng]], {
          color: "#f59e0b",
          weight: 2
        }).addTo(entry.layer);
      }
      if (isPartial && Number.isFinite(endLat) && Number.isFinite(endLng)) {
        L.polyline([[lat, lng], [endLat, endLng]], {
          color: "#f59e0b",
          weight: 2
        }).addTo(entry.layer);
      }
      if (Number.isFinite(refLat) && Number.isFinite(refLng)) {
        L.polyline([[lat, lng], [refLat, refLng]], {
          color: "#000000",
          weight: 2,
          opacity: 0.95
        }).addTo(entry.layer);
        bounds.push([refLat, refLng]);
      }
      bounds.push([lat, lng]);
    });

    if (!bounds.length) {
      entry.map.setView(getActiveFarmView().center, getActiveFarmView().zoom);
    } else if (bounds.length === 1) {
      entry.map.setView(bounds[0], 14);
    } else {
      entry.map.fitBounds(bounds, { padding: [56, 56], maxZoom: 16 });
    }

    setTimeout(() => entry.map.invalidateSize(), 0);
  }


  Cad.pivosMaps = Object.assign(Cad.pivosMaps || {}, {
    renderPivosFormMap,
    renderPivosSectionMap
  });
})();
