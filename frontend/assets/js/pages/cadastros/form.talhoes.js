(function () {
  "use strict";
  const Cad = (window.Cad = window.Cad || {});

  const state = Cad.state;
  const talhoesState = Cad.talhoesState;

  function getTalhoesSnapVertices(farmId, excludeTalhaoId = "") {
    if (!farmId) return [];
    const items = Cad.data.getTalhoesByFarm(farmId)
      .filter((item) => String(item.id) !== String(excludeTalhaoId))
      .filter((item) => Array.isArray(item.points) && item.points.length >= 3);

    const vertices = [];
    items.forEach((item) => {
      const pts = item.points.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }));
      pts.forEach((p) => vertices.push(p));
    });

    return vertices;
  }

  function snapTalhaoPoint(rawPoint, farmId, excludeTalhaoId = "") {
    const map = talhoesState.map;
    if (!map || !rawPoint || !farmId) return rawPoint;

    const vertices = getTalhoesSnapVertices(farmId, excludeTalhaoId);
    if (!vertices.length) return rawPoint;

    const SNAP_PX = 12;
    const pPx = map.latLngToContainerPoint([Number(rawPoint.lat), Number(rawPoint.lng)]);
    let best = null;
    let bestDist = Infinity;

    vertices.forEach((vertex) => {
      const vPx = map.latLngToContainerPoint([vertex.lat, vertex.lng]);
      const dx = pPx.x - vPx.x;
      const dy = pPx.y - vPx.y;
      const dist = Math.hypot(dx, dy);
      if (dist < bestDist) {
        bestDist = dist;
        best = vertex;
      }
    });

    if (!best || bestDist > SNAP_PX) return rawPoint;
    return { lat: Number(best.lat), lng: Number(best.lng) };
  }

  function focusTalhoesMapOnFarm(farmId) {
    if (!talhoesState.map) return;
    const farm = Cad.data.getAllFarms().find((item) => String(item.id) === String(farmId));
    const point = Cad.viewMaps.extractPoint(farm);
    if (!point) {
      const farmView = Cad.data.getActiveFarmView();
      talhoesState.map.setView(farmView.center, farmView.zoom);
      return;
    }
    talhoesState.map.setView([point.lat, point.lng], 14);
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

  function clearTalhoesDraft() {
    if (talhoesState.draftLine) { talhoesState.draftLine.remove(); talhoesState.draftLine = null; }
    if (talhoesState.previewPolygon) { talhoesState.previewPolygon.remove(); talhoesState.previewPolygon = null; }
    if (talhoesState._snapMarker) { talhoesState._snapMarker.remove(); talhoesState._snapMarker = null; }
    talhoesState.hoverPoint = null;
  }

  function clearTalhoesEditHandles() {
    talhoesState.vertexMarkers.forEach((marker) => marker.remove());
    talhoesState.midpointMarkers.forEach((marker) => marker.remove());
    talhoesState.vertexMarkers = [];
    talhoesState.midpointMarkers = [];
  }

  function updateTalhoesAreaInput() {
    const areaInput = document.getElementById("talhao_area");
    if (!areaInput) return;
    if (!Array.isArray(talhoesState.points) || talhoesState.points.length < 3) {
      areaInput.value = "";
      return;
    }
    areaInput.value = calculatePolygonAreaHa(talhoesState.points).toFixed(2);
  }

  function syncTalhoesPolygon() {
    if (!talhoesState.polygon || !Array.isArray(talhoesState.points) || talhoesState.points.length < 3) return;
    talhoesState.polygon.setLatLngs(talhoesState.points);
    updateTalhoesAreaInput();
  }

  function makeEditIcon(size, background, borderColor) {
    return L.divIcon({
      className: "",
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:999px;background:${background};border:2px solid ${borderColor};box-shadow:0 1px 4px rgba(0,0,0,.28);"></span>`
    });
  }

  function rebuildTalhoesEditHandles() {
    clearTalhoesEditHandles();
    if (!talhoesState.editLayer || !talhoesState.polygon || talhoesState.points.length < 3) return;

    talhoesState.points.forEach((point, index) => {
      const marker = L.marker([point.lat, point.lng], {
        draggable: true,
        icon: makeEditIcon(12, "#ffffff", "#16a34a"),
        zIndexOffset: 1200
      }).addTo(talhoesState.editLayer);

      marker.on("drag", () => {
        const ll = marker.getLatLng();
        const snapped = snapTalhaoPoint(
          { lat: Number(ll.lat), lng: Number(ll.lng) },
          Cad.data.getCurrentTalhaoFormFarmId(),
          Cad.data.getCurrentEditingTalhaoId()
        );
        marker.setLatLng([snapped.lat, snapped.lng]);
        talhoesState.points[index] = snapped;
        syncTalhoesPolygon();
      });

      marker.on("dragend", () => {
        rebuildTalhoesEditHandles();
      });

      talhoesState.vertexMarkers.push(marker);
    });

    for (let i = 0; i < talhoesState.points.length; i += 1) {
      const p1 = talhoesState.points[i];
      const p2 = talhoesState.points[(i + 1) % talhoesState.points.length];
      const midpoint = { lat: (p1.lat + p2.lat) / 2, lng: (p1.lng + p2.lng) / 2 };

      const midpointMarker = L.marker([midpoint.lat, midpoint.lng], {
        draggable: true,
        icon: makeEditIcon(10, "#dcfce7", "#15803d"),
        zIndexOffset: 1100
      }).addTo(talhoesState.editLayer);

      midpointMarker.on("dragstart", () => {
        const ll = midpointMarker.getLatLng();
        const snapped = snapTalhaoPoint(
          { lat: Number(ll.lat), lng: Number(ll.lng) },
          Cad.data.getCurrentTalhaoFormFarmId(),
          Cad.data.getCurrentEditingTalhaoId()
        );
        midpointMarker.__insertIndex = i + 1;
        midpointMarker.setLatLng([snapped.lat, snapped.lng]);
        talhoesState.points.splice(midpointMarker.__insertIndex, 0, snapped);
        syncTalhoesPolygon();
      });

      midpointMarker.on("drag", () => {
        if (typeof midpointMarker.__insertIndex !== "number") return;
        const ll = midpointMarker.getLatLng();
        const snapped = snapTalhaoPoint(
          { lat: Number(ll.lat), lng: Number(ll.lng) },
          Cad.data.getCurrentTalhaoFormFarmId(),
          Cad.data.getCurrentEditingTalhaoId()
        );
        midpointMarker.setLatLng([snapped.lat, snapped.lng]);
        talhoesState.points[midpointMarker.__insertIndex] = snapped;
        syncTalhoesPolygon();
      });

      midpointMarker.on("dragend", () => {
        rebuildTalhoesEditHandles();
      });

      talhoesState.midpointMarkers.push(midpointMarker);
    }
  }

  function renderTalhoesDraftGeometry() {
    if (!talhoesState.drawLayer) return;
    const basePoints = Array.isArray(talhoesState.points) ? talhoesState.points : [];
    const points = [...basePoints];
    if (talhoesState.hoverPoint) {
      points.push(talhoesState.hoverPoint);
    }

    // Snap indicator: circle at hover point when close to a vertex
    if (talhoesState._snapMarker) { talhoesState._snapMarker.remove(); talhoesState._snapMarker = null; }
    if (talhoesState.hoverPoint) {
      const isSnapped = getTalhoesSnapVertices(Cad.data.getCurrentTalhaoFormFarmId(), Cad.data.getCurrentEditingTalhaoId())
        .some(v => v.lat === talhoesState.hoverPoint.lat && v.lng === talhoesState.hoverPoint.lng);
      if (isSnapped) {
        talhoesState._snapMarker = L.circleMarker(
          [talhoesState.hoverPoint.lat, talhoesState.hoverPoint.lng],
          { radius: 7, color: "#eab308", weight: 2, fill: false }
        ).addTo(talhoesState.drawLayer);
      }
    }

    if (!talhoesState.draftLine) {
      talhoesState.draftLine = L.polyline([], { color: "#eab308", weight: 2, opacity: 0.95, dashArray: "5,5" }).addTo(talhoesState.drawLayer);
    }
    talhoesState.draftLine.setLatLngs(points.length > 1 ? points : (basePoints.length === 1 ? basePoints : []));

    if (points.length >= 2) {
      if (!talhoesState.previewPolygon) {
        talhoesState.previewPolygon = L.polygon([], {
          color: "#eab308",
          weight: 2,
          fill: false
        }).addTo(talhoesState.drawLayer);
      }
      talhoesState.previewPolygon.setLatLngs(points);
    } else if (talhoesState.previewPolygon) {
      talhoesState.previewPolygon.remove();
      talhoesState.previewPolygon = null;
    }
  }

  function finalizeTalhoesDrawing() {
    if (talhoesState.points.length < 3) return;
    const finalPoints = talhoesState.points.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }));
    if (talhoesState.polygon) {
      talhoesState.polygon.remove();
    }
    talhoesState.polygon = L.polygon(finalPoints, {
      color: "#eab308",
      weight: 2,
      fill: false
    }).addTo(talhoesState.editLayer);
    talhoesState.points = finalPoints;
    talhoesState.isDrawing = false;
    clearTalhoesDraft();
    if (talhoesState.map?.doubleClickZoom) talhoesState.map.doubleClickZoom.enable();
    rebuildTalhoesEditHandles();
    updateTalhoesAreaInput();
    updateTalhoesDrawUi();
  }

  function activateTalhoesEditMode(points) {
    const safePoints = (Array.isArray(points) ? points : [])
      .map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

    if (safePoints.length < 3) return false;

    talhoesState.isDrawing = false;
    clearTalhoesDraft();
    clearTalhoesEditHandles();

    if (talhoesState.polygon) {
      talhoesState.polygon.remove();
    }

    talhoesState.points = safePoints;
    talhoesState.polygon = L.polygon(talhoesState.points, {
      color: "#eab308",
      weight: 2,
      fill: false
    }).addTo(talhoesState.editLayer);
    talhoesState.polygon.bringToFront();

    rebuildTalhoesEditHandles();
    updateTalhoesAreaInput();

    if (talhoesState.map) {
      const bounds = L.latLngBounds(talhoesState.points.map((p) => [p.lat, p.lng]));
      talhoesState.map.fitBounds(bounds, { padding: [42, 42], maxZoom: 16 });
    }

    updateTalhoesDrawUi();
    return true;
  }

  function clearTalhoesPolygon() {
    if (talhoesState.polygon) {
      talhoesState.polygon.remove();
      talhoesState.polygon = null;
    }
    clearTalhoesEditHandles();
    talhoesState.points = [];
    clearTalhoesDraft();
    const areaInput = document.getElementById("talhao_area");
    if (areaInput) areaInput.value = "";
  }

  function updateTalhoesDrawUi() {
    const startBtn = document.getElementById("talhaoStartDrawBtn");
    if (startBtn) {
      const active = !!talhoesState.isDrawing;
      startBtn.classList.toggle("is-active", active);
      startBtn.innerHTML = active
        ? '<i class="fa-solid fa-check"></i> Finalizar'
        : '<i class="fa-solid fa-draw-polygon"></i> Desenhar';
    }
    if (talhoesState.map && talhoesState.map.getContainer) {
      talhoesState.map.getContainer().style.cursor = talhoesState.isDrawing ? "crosshair" : "";
    }
  }

  function bindTalhoesMapEvents() {
    if (!talhoesState.map || talhoesState.map.__icTalhoesBound) return;

    talhoesState.map.on("click", (event) => {
      if (!(state.currentType === "talhoes" && state.activeView === "form" && talhoesState.isDrawing)) return;
      if (!event?.latlng) return;

      const snapped = snapTalhaoPoint(
        { lat: Number(event.latlng.lat), lng: Number(event.latlng.lng) },
        Cad.data.getCurrentTalhaoFormFarmId(),
        Cad.data.getCurrentEditingTalhaoId()
      );
      talhoesState.points.push(snapped);
      renderTalhoesDraftGeometry();
    });

    talhoesState.map.on("mousemove", (event) => {
      if (!(state.currentType === "talhoes" && state.activeView === "form" && talhoesState.isDrawing)) return;
      if (!event?.latlng) return;
      talhoesState.hoverPoint = snapTalhaoPoint(
        { lat: Number(event.latlng.lat), lng: Number(event.latlng.lng) },
        Cad.data.getCurrentTalhaoFormFarmId(),
        Cad.data.getCurrentEditingTalhaoId()
      );
      renderTalhoesDraftGeometry();
    });

    talhoesState.map.on("contextmenu", (event) => {
      if (!(state.currentType === "talhoes" && state.activeView === "form" && talhoesState.isDrawing)) return;
      if (event) L.DomEvent.stop(event);
      finalizeTalhoesDrawing();
    });

    talhoesState.map.on("dblclick", (event) => {
      if (!(state.currentType === "talhoes" && state.activeView === "form" && talhoesState.isDrawing)) return;
      if (event) L.DomEvent.stop(event);
      // Mantido sem ação para evitar conflito com o fechamento no botão direito.
    });

    talhoesState.map.__icTalhoesBound = true;
  }

  function renderFormTalhoes(compositeId, container) {
    const farms = Cad.data.getAllFarms();
    const parsed = Cad.data.parseTalhaoCompositeId(compositeId);
    let source = null;
    let currentFarmId = Cad.data.getCurrentContextFarmId() || farms[0]?.id || "";

    if (parsed?.farmId && parsed?.talhaoId) {
      currentFarmId = parsed.farmId;
      source = Cad.data.getTalhoesByFarm(parsed.farmId).find((item) => String(item.id) === String(parsed.talhaoId)) || null;
    }

    container.innerHTML = `
    <div class="cadastros-form-card cadastros-form-card--with-footer">
      <div class="cadastros-form-content">
        <div class="cadastros-form-topbar">
          <div class="cadastros-form-topbar__text">${source ? "Editar Talhão" : "Adicionar Talhão"}</div>
        </div>
        <div class="cadastros-form-section is-active">
          <input type="hidden" id="talhao_farm" value="${currentFarmId}">
          <div class="cadastros-form-grid">
            <div class="equip-field col-span-2">
              <label class="equip-label" for="talhao_name"><span class="equip-required">*</span>Nome</label>
              <input type="text" class="equip-input" id="talhao_name" value="${source?.name || ""}" placeholder="Ex: Talhão 01">
            </div>
            <div class="equip-field">
              <label class="equip-label" for="talhao_soil"><span class="equip-required">*</span>Tipo de solo</label>
              <select class="equip-input" id="talhao_soil">
                <option value="">Selecione</option>
                <option value="Areia" ${String(source?.soilType || source?.tipoSolo || "") === "Areia" ? "selected" : ""}>Areia</option>
                <option value="Argiloso" ${String(source?.soilType || source?.tipoSolo || "") === "Argiloso" ? "selected" : ""}>Argiloso</option>
                <option value="Franco" ${String(source?.soilType || source?.tipoSolo || "") === "Franco" ? "selected" : ""}>Franco</option>
              </select>
            </div>
            <div class="equip-field">
              <label class="equip-label" for="talhao_crop"><span class="equip-required">*</span>Plantio</label>
              <select class="equip-input" id="talhao_crop">
                <option value="">Selecione</option>
                <option value="Soja" ${String(source?.crop || source?.plantio || "") === "Soja" ? "selected" : ""}>Soja</option>
                <option value="Milho" ${String(source?.crop || source?.plantio || "") === "Milho" ? "selected" : ""}>Milho</option>
                <option value="Algodão" ${String(source?.crop || source?.plantio || "") === "Algodão" ? "selected" : ""}>Algodão</option>
              </select>
            </div>
            <div class="farm-form-divider col-span-2">Polígono no mapa</div>
            <div class="equip-field col-span-2">
              <div class="cad-draw-actions">
                <button type="button" id="talhaoStartDrawBtn" class="cad-draw-btn cad-draw-btn--draw">
                  <i class="fa-solid fa-draw-polygon"></i> Desenhar
                </button>
                <button type="button" id="talhaoClearDrawBtn" class="cad-draw-btn cad-draw-btn--clear">
                  <i class="fa-solid fa-eraser"></i> Limpar
                </button>
              </div>
              <p class="cad-draw-hint">Clique no mapa para adicionar pontos. Duplo clique para finalizar o polígono.</p>
            </div>
          </div>
        </div>
      </div>
      <div class="cadastros-form-footer cadastros-form-footer--farm">
        <button type="button" class="cad-form-action-btn cad-form-action-btn--ghost" onclick="window.IcCancelCurrent('talhoes')">
          <i class="fa-solid fa-xmark"></i> Cancelar
        </button>
        <button type="button" class="cad-form-action-btn cad-form-action-btn--primary" onclick="window.IcSaveRecord('talhoes')">
          <i class="fa-solid fa-floppy-disk"></i> Salvar
        </button>
      </div>
    </div>`;

    const allTalhoes = Cad.data.getAllTalhoesRecords();
    Cad.viewMaps.renderTalhoesMap(allTalhoes, { editPoints: source?.points || [] });
    Cad.toolbar.normalizeMapActionsPlacement();

    const startDrawBtn = document.getElementById("talhaoStartDrawBtn");
    const clearDrawBtn = document.getElementById("talhaoClearDrawBtn");

    if (startDrawBtn) {
      startDrawBtn.onclick = function () {
        if (talhoesState.isDrawing) {
          finalizeTalhoesDrawing();
          return;
        }
        clearTalhoesPolygon();
        talhoesState.isDrawing = true;
        talhoesState.hoverPoint = null;
        if (talhoesState.map?.doubleClickZoom) talhoesState.map.doubleClickZoom.disable();
        renderTalhoesDraftGeometry();
        updateTalhoesDrawUi();
      };
    }

    if (clearDrawBtn) {
      clearDrawBtn.onclick = function () {
        talhoesState.isDrawing = false;
        clearTalhoesPolygon();
        if (talhoesState.map?.doubleClickZoom) talhoesState.map.doubleClickZoom.enable();
        updateTalhoesDrawUi();
      };
    }

    focusTalhoesMapOnFarm(currentFarmId);
    updateTalhoesDrawUi();
    Cad.ui.initCadCustomSelects(container);
  }

  Cad.formTalhoes = {
    renderFormTalhoes,
    bindTalhoesMapEvents,
    updateTalhoesDrawUi,
    clearTalhoesPolygon,
    clearTalhoesEditHandles,
    clearTalhoesDraft,
    updateTalhoesAreaInput,
    rebuildTalhoesEditHandles,
    activateTalhoesEditMode,
    finalizeTalhoesDrawing,
    renderTalhoesDraftGeometry,
    snapTalhaoPoint,
    getTalhoesSnapVertices,
    focusTalhoesMapOnFarm,
    calculatePolygonAreaHa
  };

})();
