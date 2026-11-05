// assets/js/pages/equipamentos/smarttouch.js
(function () {
  "use strict";

  window.IcEquipamentos = window.IcEquipamentos || {};

  const ST_SEG_PALETTE = [
    "rgb(0, 31, 153)", "rgb(160, 0, 229)", "rgb(0, 196, 179)",
    "rgb(82, 183, 0)", "rgb(255, 213, 0)", "rgb(255, 115, 0)",
    "rgb(142, 68, 173)", "rgb(22, 160, 133)", "rgb(233, 30, 99)",
  ];

  // escapeHtml/parseLatLng/formatLatLng compartilhados — ver assets/js/core/geo-utils.js
  const { escapeHtml, parseLatLng, formatLatLng } = window.IcGeo;

  function formatDate(dateStr) {
    if (!dateStr) return "-";
    const date = new Date(dateStr + "T00:00:00");
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${months[date.getMonth()]} ${String(date.getDate()).padStart(2, "0")}`;
  }

  function parseRadius(value) {
    const raw = String(value || "").replace(",", ".").trim();
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
  }

  function pinIcon() {
    if (!window.L) return null;
    return L.divIcon({
      className: "",
      html: `
        <div class="st-pin">
          <i class="fa-solid fa-location-dot"></i>
        </div>
      `,
      iconSize: [28, 32],
      iconAnchor: [14, 32],
    });
  }

  function getActiveStepLabel(container) {
    const modal = container?.closest?.("#createEquipmentModal");
    const label = modal?.querySelector?.(".create-equip__step--active .create-equip__step-label");
    return String(label?.textContent || "").trim();
  }

  function getFallbackCenter(state) {
    const parsed = parseLatLng(state.loc);
    if (parsed) return parsed;
    if (Number.isFinite(state.lat) && Number.isFinite(state.lng)) {
      return { lat: state.lat, lng: state.lng };
    }
    return { lat: -16.767, lng: -47.613 };
  }

  function getBearingRefDeg(pivotData) {
    if (!pivotData?.refLat || !pivotData?.refLng || !pivotData?.centerLat || !pivotData?.centerLng) return 0;
    const lat1 = Number(pivotData.centerLat) * Math.PI / 180;
    const lng1 = Number(pivotData.centerLng) * Math.PI / 180;
    const lat2 = Number(pivotData.refLat) * Math.PI / 180;
    const lng2 = Number(pivotData.refLng) * Math.PI / 180;
    const y = Math.sin(lng2 - lng1) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1);
    return Math.atan2(y, x) * 180 / Math.PI;
  }

  function normalizeAngle(value, fallback) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return ((num % 360) + 360) % 360;
  }

  function normalizeParcels(items) {
    const list = Array.isArray(items) ? items : [];
    return list.map((item, index) => {
      const name = String(item?.name || item?.deviceName || "").trim() || `Parcela ${index + 1}`;
      return {
        id: String(item?.id || `parcel_${index + 1}`),
        name,
        deviceName: name,
        plantingDate: String(item?.plantingDate || "").trim(),
        startAngle: normalizeAngle(item?.startAngle, 0),
        endAngle: normalizeAngle(item?.endAngle, 360),
      };
    });
  }

  function getArcPoints(lat, lng, radius, startAngle, endAngle, bearingRefDeg) {
    const center = L.latLng(lat, lng);
    const pts = [center];
    const latRad = lat * Math.PI / 180;
    const lngRad = lng * Math.PI / 180;
    const d = radius / 6378137;
    let start = Number(startAngle) || 0;
    let end = Number(endAngle) || 360;
    if (end <= start) end += 360;

    for (let angle = start; angle <= end; angle += 2) {
      const br = (bearingRefDeg + angle) * Math.PI / 180;
      const pLat = Math.asin(Math.sin(latRad) * Math.cos(d) + Math.cos(latRad) * Math.sin(d) * Math.cos(br));
      const pLng = lngRad + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(latRad), Math.cos(d) - Math.sin(latRad) * Math.sin(pLat));
      pts.push(L.latLng(pLat * 180 / Math.PI, pLng * 180 / Math.PI));
    }

    pts.push(center);
    return pts;
  }

  function getLineCoords(lat, lng, radius, angle, bearingRefDeg) {
    const center = L.latLng(lat, lng);
    const latRad = lat * Math.PI / 180;
    const lngRad = lng * Math.PI / 180;
    const d = radius / 6378137;
    const br = (bearingRefDeg + (Number(angle) || 0)) * Math.PI / 180;
    const pLat = Math.asin(Math.sin(latRad) * Math.cos(d) + Math.cos(latRad) * Math.sin(d) * Math.cos(br));
    const pLng = lngRad + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(latRad), Math.cos(d) - Math.sin(latRad) * Math.sin(pLat));
    return [center, L.latLng(pLat * 180 / Math.PI, pLng * 180 / Math.PI)];
  }

  function destinationPoint(origin, distanceMeters, bearingDeg) {
    const R = 6378137;
    const delta = distanceMeters / R;
    const theta = bearingDeg * Math.PI / 180;
    const phi1 = origin.lat * Math.PI / 180;
    const lambda1 = origin.lng * Math.PI / 180;
    const sinPhi1 = Math.sin(phi1), cosPhi1 = Math.cos(phi1);
    const sinDelta = Math.sin(delta), cosDelta = Math.cos(delta);
    const sinPhi2 = sinPhi1 * cosDelta + cosPhi1 * sinDelta * Math.cos(theta);
    const phi2 = Math.asin(Math.max(-1, Math.min(1, sinPhi2)));
    const y = Math.sin(theta) * sinDelta * cosPhi1;
    const x = cosDelta - sinPhi1 * Math.sin(phi2);
    const lambda2 = lambda1 + Math.atan2(y, x);
    return { lat: phi2 * 180 / Math.PI, lng: ((lambda2 * 180 / Math.PI) + 540) % 360 - 180 };
  }

  // getActiveFarmEquipments compartilhado — ver assets/js/core/farm-utils.js
  const { getActiveFarmEquipments } = window.IcFarm;

  function extractGhostPivot(equip) {
    if (!equip || !equip.data) return null;

    if (equip.type === "smart_connect") {
      const center = (
        Number.isFinite(Number(equip.data.centerLat)) && Number.isFinite(Number(equip.data.centerLng))
      ) ? {
        lat: Number(equip.data.centerLat),
        lng: Number(equip.data.centerLng),
      } : parseLatLng(equip.data.center);

      const ref = (
        Number.isFinite(Number(equip.data.refLat)) && Number.isFinite(Number(equip.data.refLng))
      ) ? {
        lat: Number(equip.data.refLat),
        lng: Number(equip.data.refLng),
      } : parseLatLng(equip.data.ref);

      if (!center) return null;

      let radius = parseRadius(equip.data.radius);
      if ((!Number.isFinite(radius) || radius <= 0) && center && ref && window.L) {
        radius = L.latLng(center.lat, center.lng).distanceTo([ref.lat, ref.lng]);
      }
      if (!Number.isFinite(radius) || radius <= 0) return null;

      return {
        id: equip.id,
        center,
        ref,
        radius,
        isSector: equip.data.isSector === true || equip.data.isSector === "true",
        startAngle: equip.data.startAngle,
        endAngle: equip.data.endAngle,
      };
    }

    if (equip.type === "smarttouch") {
      const center = (
        Number.isFinite(Number(equip.data.lat)) && Number.isFinite(Number(equip.data.lng))
      ) ? {
        lat: Number(equip.data.lat),
        lng: Number(equip.data.lng),
      } : parseLatLng(equip.data.loc);
      const radius = parseRadius(equip.data.radius);
      if (!center || !Number.isFinite(radius) || radius <= 0) return null;
      return {
        id: equip.id,
        center,
        ref: null,
        radius,
        isSector: false,
      };
    }

    return null;
  }

  function renderGhostPivots(map, excludeId = "") {
    if (!window.L || !map) return null;
    const layer = L.layerGroup().addTo(map);
    const shapeStyle = {
      color: "#e5e7eb",
      weight: 1.2,
      fillColor: "#f8fafc",
      fillOpacity: 0.12,
      interactive: false,
    };
    const centerStyle = {
      radius: 3,
      color: "#d1d5db",
      weight: 1,
      fillColor: "#ffffff",
      fillOpacity: 0.92,
      interactive: false,
    };

    getActiveFarmEquipments()
      .filter((equip) => equip?.type === "smart_connect" || equip?.type === "smarttouch")
      .filter((equip) => String(equip?.id || "") !== String(excludeId || ""))
      .map(extractGhostPivot)
      .filter(Boolean)
      .forEach((pivot) => {
        if (pivot.isSector && pivot.ref && pivot.startAngle !== undefined && pivot.endAngle !== undefined) {
          const points = getArcPoints(
            pivot.center.lat,
            pivot.center.lng,
            pivot.radius,
            pivot.startAngle,
            pivot.endAngle,
            getBearingRefDeg({
              centerLat: pivot.center.lat,
              centerLng: pivot.center.lng,
              refLat: pivot.ref.lat,
              refLng: pivot.ref.lng,
            })
          );
          if (points.length) L.polygon(points, shapeStyle).addTo(layer);
        } else {
          L.circle([pivot.center.lat, pivot.center.lng], {
            radius: pivot.radius,
            ...shapeStyle,
          }).addTo(layer);
        }

        L.circleMarker([pivot.center.lat, pivot.center.lng], centerStyle).addTo(layer);
      });

    return layer;
  }

  window.IcEquipamentos.smarttouch = {
    label: "Parcelas",

    // =================
    // STEP 2 — Localização
    // =================
    renderStep2(container, state) {
      if (!state.parcels) state.parcels = [];
      const errors = state._errors || {};

      container.innerHTML = `
        <div class="st-loc st-loc--split">
          <div class="st-loc__sidebar">
            <div class="equip-form">
              <div class="edit-panel__field-box" style="padding: 0; border: none; background: transparent;">
                <label for="stPivotId"><span class="edit-panel__req">*</span> Vincular com Pivô</label>
                <select class="equip-input" id="stPivotId" aria-label="Pivô Vinculado"></select>
              </div>

              <div class="edit-panel__field-box" style="padding: 0; border: none; background: transparent;">
                <label for="stDeviceName"><span class="edit-panel__req">*</span> Nome da parcela</label>
                <input
                  type="text"
                  class="equip-input"
                  id="stDeviceName"
                  placeholder="Ex: Parcela Norte 01"
                  value="${escapeHtml(state.deviceName || "")}"
                />
              </div>

              <div class="edit-panel__field-box" style="padding: 0; border: none; background: transparent;">
                <label for="stPlantingDate">Data de plantio</label>
                <input
                  type="date"
                  class="equip-input"
                  id="stPlantingDate"
                  value="${escapeHtml(state.plantingDate || "")}"
                />
              </div>

              <div class="edit-panel__grid-3" style="grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="pivo-edit__field">
                  <label for="stStartAngle"><span class="edit-panel__req">*</span> Ângulo inicial</label>
                  <div class="sc-input-group">
                    <input
                      type="text" inputmode="decimal"
                      class="equip-input sc-input"
                      id="stStartAngle"
                      placeholder="0"
                      value="${state.startAngle ?? ""}"
                    />
                    <span class="sc-input-suffix">°</span>
                  </div>
                </div>

                <div class="pivo-edit__field">
                  <label for="stEndAngle"><span class="edit-panel__req">*</span> Ângulo final</label>
                  <div class="sc-input-group">
                    <input
                      type="text" inputmode="decimal"
                      class="equip-input sc-input"
                      id="stEndAngle"
                      placeholder="360"
                      value="${state.endAngle ?? ""}"
                    />
                    <span class="sc-input-suffix">°</span>
                  </div>
                </div>
              </div>

              <button type="button" class="create-equip__btn create-equip__btn--primary btn" id="stAddParcel" style="width: 100%; margin-top: 12px; height: 34px; font-weight: 700; font-size: 12px; display: none; align-items: center; justify-content: center; padding: 0;">
                <i class="fa-solid fa-plus" style="margin-right: 6px; font-size: 10px; ${state._stEditIndex !== null ? 'display:none' : ''}"></i> 
                ${state._stEditIndex !== null ? 'Salvar Edição' : 'Incluir Parcela'}
              </button>

              <div class="st-parcel-list" id="stParcelList" style="${state.parcels.length === 0 ? 'display:none' : ''}">
                <div class="st-parcel-header">
                  <span>Nome</span>
                  <span>Data</span>
                  <span>Ângulo</span>
                  <span></span>
                </div>
                <div id="stParcelItems" class="st-parcel-items"></div>
              </div>
            </div>
          </div>

          <div class="st-loc__main">
            <div class="st-loc__map-wrapper">
              <div id="stMap"></div>
            </div>
          </div>
        </div>
      `;

      this.initMap(container, state);
      if (state._stEditIndex === undefined) state._stEditIndex = null;
      this.bindStep2(container, state);
      this.renderParcelList(container, state);
      if (window.IcEquipSelectInit) window.IcEquipSelectInit(container);
    },

    renderParcelList(container, state) {
      const listWrapper = container.querySelector("#stParcelList");
      const itemsContainer = container.querySelector("#stParcelItems");
      if (!itemsContainer || !listWrapper) return;

      if (state.parcels.length === 0) {
        listWrapper.style.display = "none";
        return;
      }

      listWrapper.style.display = "flex";
      itemsContainer.innerHTML = state.parcels.map((p, i) => `
        <div class="st-parcel-item ${state._stEditIndex === i ? 'is-editing' : ''}">
          <span class="st-parcel-name">${escapeHtml(p.deviceName)}</span>
          <span class="st-parcel-date">${formatDate(p.plantingDate)}</span>
          <span class="st-parcel-angles">${p.startAngle}° a ${p.endAngle}°</span>
          <div class="st-parcel-actions">
            <button type="button" class="st-parcel-edit" data-index="${i}" title="Editar">
              <i class="fa-solid fa-pencil"></i>
            </button>
            <button type="button" class="st-parcel-remove" data-index="${i}" title="Remover">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
      `).join("");

      itemsContainer.querySelectorAll(".st-parcel-edit").forEach(btn => {
        btn.onclick = () => {
          const idx = parseInt(btn.dataset.index);
          const p = state.parcels[idx];
          
          state._stEditIndex = idx;
          state.deviceName = p.deviceName;
          state.plantingDate = p.plantingDate;
          state.startAngle = p.startAngle;
          state.endAngle = p.endAngle;

          this.renderStep2(container, state);
          if (state._stUpdateParcels) state._stUpdateParcels();
        };
      });

      itemsContainer.querySelectorAll(".st-parcel-remove").forEach(btn => {
        btn.onclick = () => {
          const idx = parseInt(btn.dataset.index);
          state.parcels.splice(idx, 1);
          this.renderParcelList(container, state);
          if (state._stUpdateParcels) state._stUpdateParcels();
        };
      });
    },

    bindStep2(container, state) {
      const selectPivot = container.querySelector("#stPivotId");
      const nameInput = container.querySelector("#stDeviceName");
      const pDateInput = container.querySelector("#stPlantingDate");
      const sAngleInput = container.querySelector("#stStartAngle");
      const eAngleInput = container.querySelector("#stEndAngle");
      const addBtn = container.querySelector("#stAddParcel");

      const checkFields = () => {
        if (!addBtn) return;
        const hasAll = nameInput.value.trim() && 
                       sAngleInput.value !== "" && 
                       eAngleInput.value !== "" && 
                       (selectPivot ? selectPivot.value !== "" : true);
        addBtn.style.display = hasAll ? "flex" : "none";
      };

      const triggerMapUpdate = () => {
        if (state._stUpdateParcels) {
          state._stUpdateParcels({
            startAngle: sAngleInput.value,
            endAngle: eAngleInput.value
          });
        }
        checkFields();
      };

      if (nameInput) {
        nameInput.oninput = () => { 
          state.deviceName = nameInput.value.trim(); 
          checkFields();
        };
      }
      if (pDateInput) {
        pDateInput.oninput = () => { state.plantingDate = pDateInput.value; };
      }
      if (sAngleInput) {
        sAngleInput.oninput = () => { 
          state.startAngle = sAngleInput.value; 
          triggerMapUpdate();
        };
      }
      if (eAngleInput) {
        eAngleInput.oninput = () => { 
          state.endAngle = eAngleInput.value; 
          triggerMapUpdate();
        };
      }

      if (addBtn) {
        addBtn.onclick = () => {
          if (!state.deviceName || state.startAngle === "" || state.endAngle === "") {
            return;
          }

          const parcelData = {
            deviceName: state.deviceName,
            plantingDate: state.plantingDate,
            startAngle: state.startAngle,
            endAngle: state.endAngle
          };

          if (state._stEditIndex !== null) {
            state.parcels[state._stEditIndex] = parcelData;
            state._stEditIndex = null;
          } else {
            state.parcels.push(parcelData);
          }
          
          state.deviceName = "";
          state.startAngle = "";
          state.endAngle = "";
          nameInput.value = "";
          sAngleInput.value = "";
          eAngleInput.value = "";
          
          this.renderParcelList(container, state);
          triggerMapUpdate();
          checkFields();

          // Re-render step 2 to reset button text
          this.renderStep2(container, state);
        };
      }

      if (selectPivot && typeof window.IcGetPivotList === "function") {
        const pivos = window.IcGetPivotList() || [];
        state._allPivots = pivos;

        // Adiciona placeholder
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Selecionar pivô";
        placeholder.disabled = true;
        placeholder.hidden = true; // Impede que apareça na lista de opções
        placeholder.selected = !state.linkedPivotId;
        selectPivot.appendChild(placeholder);

        pivos.forEach(p => {
          const opt = document.createElement("option");
          opt.value = p.id;
          opt.textContent = p.name || p.deviceName || `Pivô ${p.id.slice(0,4)}`;
          if (state.linkedPivotId === p.id) opt.selected = true;
          selectPivot.appendChild(opt);
        });

        const updatePivotRef = (pid) => {
          state.linkedPivotId = pid;
          const p = pivos.find(x => x.id === pid);
          if (p && p.data && p.data.centerLat) {
            state.lat = parseFloat(p.data.centerLat);
            state.lng = parseFloat(p.data.centerLng);
            state.radius = parseFloat(p.data.radius) || 100;
            state._currentPivotData = p.data;
            if (state._stDrawPivot) state._stDrawPivot(p.data);
            triggerMapUpdate();
          }
        };

        if (state.linkedPivotId) updatePivotRef(state.linkedPivotId);
        selectPivot.onchange = (e) => {
          updatePivotRef(e.target.value);
          checkFields();
        };
      }

      checkFields();
    },

    initMap(container, state) {
      if (!window.L) return;
      const mapEl = container.querySelector("#stMap");
      if (!mapEl) return;

      if (state._stMap) {
        try { state._stMap.remove(); } catch(e){}
      }

      const fall = { lat: -16.767, lng: -47.613 };
      const start = (state.lat && state.lng) ? { lat: state.lat, lng: state.lng } : fall;
      const map = L.map(mapEl, { zoomControl: false }).setView([start.lat, start.lng], 16);
      state._stMap = map;

      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19 }).addTo(map);
      L.tileLayer("https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, opacity: 0.7 }).addTo(map);

      let pivotLayer = null;
      let sectorLayer = L.featureGroup().addTo(map);

      const getPoints = (lat, lng, rad, sA, eA, pData) => {
        let start = parseFloat(sA) || 0;
        let end = parseFloat(eA) || 360;
        if (end <= start) end += 360;

        const center = L.latLng(lat, lng);
        const pts = [center];
        const r1 = lat * Math.PI / 180;
        const c1 = lng * Math.PI / 180;

        let bRef = 0;
        if (pData && pData.refLat && pData.refLng) {
          const r2 = parseFloat(pData.refLat) * Math.PI / 180;
          const c2 = parseFloat(pData.refLng) * Math.PI / 180;
          const y = Math.sin(c2 - c1) * Math.cos(r2);
          const x = Math.cos(r1) * Math.sin(r2) - Math.sin(r1) * Math.cos(r2) * Math.cos(c2 - c1);
          bRef = Math.atan2(y, x) * 180 / Math.PI;
        }

        const d = (parseFloat(rad) || 100) / 6378137;
        for (let a = start; a <= end; a += 2) {
          const br = (bRef + a) * Math.PI / 180;
          const pLat = Math.asin(Math.sin(r1) * Math.cos(d) + Math.cos(r1) * Math.sin(d) * Math.cos(br));
          const pLng = c1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(r1), Math.cos(d) - Math.sin(r1) * Math.sin(pLat));
          pts.push(L.latLng(pLat * 180 / Math.PI, pLng * 180 / Math.PI));
        }
        pts.push(center);
        return pts;
      };

      state._stDrawPivot = (pData) => {
        if (pivotLayer) map.removeLayer(pivotLayer);
        const lat = parseFloat(pData.centerLat), lng = parseFloat(pData.centerLng), rad = parseFloat(pData.radius);
        if (!lat || !lng) return;

        const isSec = pData.isSector === true || pData.isSector === "true";
        if (isSec && pData.startAngle !== undefined && pData.refLat) {
          pivotLayer = L.polygon(getPoints(lat, lng, rad, pData.startAngle, pData.endAngle, pData), { color: "#8b5cf6", weight: 1, fillOpacity: 0.1 }).addTo(map);
        } else {
          pivotLayer = L.circle([lat, lng], { radius: rad, color: "#8b5cf6", weight: 1, fillOpacity: 0.1 }).addTo(map);
        }
        L.marker([lat, lng], { icon: pinIcon() }).addTo(map);
        map.setView([lat, lng], 16);
      };

      const getLineCoords = (lat, lng, rad, angle, pData) => {
        const center = L.latLng(lat, lng);
        const r1 = lat * Math.PI / 180;
        const c1 = lng * Math.PI / 180;
        let bRef = 0;
        if (pData && pData.refLat && pData.refLng) {
          const r2 = parseFloat(pData.refLat) * Math.PI / 180;
          const c2 = parseFloat(pData.refLng) * Math.PI / 180;
          const y = Math.sin(c2 - c1) * Math.cos(r2);
          const x = Math.cos(r1) * Math.sin(r2) - Math.sin(r1) * Math.cos(r2) * Math.cos(c2 - c1);
          bRef = Math.atan2(y, x) * 180 / Math.PI;
        }
        const d = (parseFloat(rad) || 100) / 6378137;
        const br = (bRef + (parseFloat(angle) || 0)) * Math.PI / 180;
        const pLat = Math.asin(Math.sin(r1) * Math.cos(d) + Math.cos(r1) * Math.sin(d) * Math.cos(br));
        const pLng = c1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(r1), Math.cos(d) - Math.sin(r1) * Math.sin(pLat));
        return [center, L.latLng(pLat * 180 / Math.PI, pLng * 180 / Math.PI)];
      };

      state._stUpdateParcels = (curr = null) => {
        sectorLayer.clearLayers();
        if (!state.lat || !state._currentPivotData) return;
        
        const angles = new Set();
        (state.parcels || []).forEach(p => {
          angles.add(p.startAngle);
          angles.add(p.endAngle);
        });

        angles.forEach(angle => {
          L.polyline(getLineCoords(state.lat, state.lng, state.radius, angle, state._currentPivotData), {
            color: "#000000",
            weight: 1,
            opacity: 0.8
          }).addTo(sectorLayer);
        });

        if (curr && curr.startAngle !== "" && curr.endAngle !== "") {
          L.polyline(getLineCoords(state.lat, state.lng, state.radius, curr.startAngle, state._currentPivotData), {
            color: "#3b82f6",
            weight: 2,
            dashArray: "5,5"
          }).addTo(sectorLayer);
          L.polyline(getLineCoords(state.lat, state.lng, state.radius, curr.endAngle, state._currentPivotData), {
            color: "#3b82f6",
            weight: 2,
            dashArray: "5,5"
          }).addTo(sectorLayer);
        }
      };

      setTimeout(() => map.invalidateSize(), 200);
    },

    readStep2(container, state) {
      if (getActiveStepLabel(container) === "Configuração") {
        return {
          name: String(state.name || state.deviceName || container.querySelector("#stConfigDeviceName")?.value || "Smart Touch").trim(),
          imei: String(state.imei || container.querySelector("#stConfigImei")?.value || "").trim(),
        };
      }

      return {
        linkedPivotId: state.linkedPivotId,
        parcels: state.parcels || []
      };
    },

    validateStep2(data) {
      if (!data.parcels || data.parcels.length === 0) return { ok: false, msg: "Inclua ao menos uma parcela." };
      return { ok: true };
    },

    label: "Smart Touch",

    renderStep2(container, state) {
      // create-equipment.js só chama renderStep2 do smarttouch quando o step
      // atual é "Localização" (via steps[currentStepIndex], nunca traduzido).
      // Antes isso era decidido aqui dentro lendo o texto já traduzido do
      // breadcrumb (getActiveStepLabel) — funcionava em pt-BR ("Localização"
      // bate), mas em en/es o texto vira "Location"/"Ubicación" e a
      // comparação falhava, caindo no renderConfigStep errado.
      this.renderLocationStep(container, state);
    },

    renderStep3(container, state) {
      this.renderConfigStep(container, state);
    },

    renderLocationStep(container, state) {
      const locText = state.loc || formatLatLng(state.lat, state.lng) || "";
      const radiusValue = parseRadius(state.radius) ?? 600;
      if (state.bearing === undefined) state.bearing = 0;

      container.innerHTML = `
        <div class="sc-loc sc-loc--vertical">
          <div class="sc-loc__top">
            <div class="sc-loc__grid">
              <div class="sc-loc__field" style="grid-column: 1 / -1;">
                <label for="stLoc"><span class="edit-panel__req">*</span> Localização do centro</label>
                <div class="sc-loc__row">
                  <div class="sc-loc__input-wrapper">
                    <input class="equip-input sc-loc__input-field" id="stLoc" placeholder="-5.474615, -45.201627" value="${escapeHtml(locText)}" />
                  </div>
                  <button class="equip-btn btn btn--outline sc-loc__btn" type="button" data-action="st-get-loc">
                    <i class="fa-solid fa-location-dot" aria-hidden="true" style="color:#22c55e;"></i> Obter Localização
                  </button>
                </div>
              </div>

              <div class="sc-loc__field" style="grid-column: 1 / -1;">
                <label for="stRadius"><span class="edit-panel__req">*</span> Raio total irrigado <span class="edit-panel__tooltip-icon" data-tooltip="Distância do centro do pivô até o final do último tubo do pivô."><i class="fa-regular fa-circle-question"></i></span></label>
                <div class="sc-loc__row">
                  <div class="sc-input-group" style="flex:1;">
                    <input class="equip-input sc-input" id="stRadius" type="text" inputmode="decimal" value="${escapeHtml(Number(radiusValue).toFixed(2))}" />
                    <span class="sc-input-suffix">m</span>
                  </div>
                  <button class="equip-btn btn btn--outline sc-loc__btn" type="button" data-action="st-get-radius">
                    <i class="fa-solid fa-location-dot" style="color:#ef4444;" aria-hidden="true"></i> Obter Localização
                  </button>
                </div>
              </div>

            </div>
          </div>

          <div class="sc-loc__map-wrapper" id="stMapSlot">
            <div id="stMap" class="sc-loc__map"></div>
          </div>
        </div>
      `;

      if (state._stLocMap) {
        const mapEl = state._stLocMap.getContainer();
        const slot = container.querySelector("#stMapSlot");
        if (mapEl && slot) {
          const emptyMap = slot.querySelector("#stMap");
          if (emptyMap) emptyMap.remove();
          slot.appendChild(mapEl);
          state._stLeaveAngleMode?.();
          setTimeout(() => {
            if (!state._stLocMap._mapPane) return;
            state._stLocMap.invalidateSize();
            state._stUpdateOverlays?.();
          }, 50);
          this.bindLocationStep(container, state);
          return;
        }
      }

      this.initLocationMap(container, state);
      this.bindLocationStep(container, state);
    },

    renderStep3(container, state) {
      const maxAngleValue = state.maxAngle ?? 360;
      const bearing = state.bearing ?? 0;
      // Ponto do pin vermelho = referência sobre a borda do raio (ângulo 0)
      const refPointText = (Number.isFinite(state.lat) && Number.isFinite(state.lng))
        ? (() => { const _r = destinationPoint({ lat: state.lat, lng: state.lng }, state.radius ?? 600, bearing); return formatLatLng(_r.lat, _r.lng); })()
        : "";

      container.innerHTML = `
        <div class="equip-form">
          <div class="equip-form__row">
            <div class="equip-field">
              <label class="equip-label" for="stMaxAngle"><span class="equip-required">*</span>Ângulo máximo de trabalho <span class="edit-panel__tooltip-icon" data-tooltip="Define o ângulo máximo de trabalho do pivô. Use 360° para irrigação em círculo completo, ou um valor menor para um pivô setorial."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input type="text" inputmode="decimal" class="equip-input sc-input" id="stMaxAngle" value="${escapeHtml(String(maxAngleValue))}">
                <span class="sc-input-suffix">°</span>
              </div>
              <span style="font-size: 10px; color: #94a3b8; display: block; margin-top: 4px;">Entre 1 e 360</span>
            </div>
          </div>

          <div id="stCardinalWrap" style="margin-top: 8px; display: flex; flex-direction: column; gap: 13px; align-items: flex-start;">
            <div class="pivo-edit__field" style="width: 100%;">
              <label for="stMaxLaps"><span class="edit-panel__req">*</span> Número máximo de voltas <span class="edit-panel__tooltip-icon edit-panel__tooltip-icon--right" data-tooltip="Quantidade máxima de voltas que o pivô pode realizar antes de parar automaticamente."><i class="fa-regular fa-circle-question"></i></span></label>
              <input type="text" inputmode="decimal" class="equip-input" id="stMaxLaps" value="${escapeHtml(String(state.maxLaps ?? ""))}">
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 6px; white-space: nowrap; font-size: 14px; color: #0f172a; margin-bottom: 9px; font-weight: 400;">Alinhar ângulo zero (selecione um dos pontos cardeais ou demarque no mapa) <span class="edit-panel__tooltip-icon" data-tooltip="Ponto de referência 0° do pivô. Selecione um ponto cardeal (N, L, S, O) ou demarque no mapa."><i class="fa-regular fa-circle-question"></i></span></div>
              <div class="pivo-cardinal-btns" id="stCardinalBtns" style="align-items: center; flex-wrap: nowrap; width: 100%; gap: 10px;">
                <button type="button" class="pivo-cardinal-btn${bearing === 0 ? ' is-selected' : ''}" data-action="st-cardinal" data-bearing="0" title="Norte">N</button>
                <button type="button" class="pivo-cardinal-btn${bearing === 90 ? ' is-selected' : ''}" data-action="st-cardinal" data-bearing="90" title="Leste">L</button>
                <button type="button" class="pivo-cardinal-btn${bearing === 180 ? ' is-selected' : ''}" data-action="st-cardinal" data-bearing="180" title="Sul">S</button>
                <button type="button" class="pivo-cardinal-btn${bearing === 270 ? ' is-selected' : ''}" data-action="st-cardinal" data-bearing="270" title="Oeste">O</button>
                <div class="edit-panel__input-wrap" style="display: flex; flex: 1 1 0; min-width: 0; gap: 8px;">
                  <input class="edit-panel__input" id="stAngleLatLng" type="text" inputmode="decimal" value="${escapeHtml(refPointText)}" placeholder="-12.898631, -45.794457" aria-label="Coordenadas da referência do ângulo zero" style="flex: 1; min-width: 0; padding-right: 300px;">
                  <button type="button" class="edit-panel__btn" data-action="st-get-angle-loc" style="white-space: nowrap; flex-shrink: 0;"><i class="fa-solid fa-location-dot" style="color:#ef4444;"></i> Obter Localização</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div id="stAngleMapSlot" class="sc-loc__map-wrapper" style="margin-top: 13px;"></div>
      `;

      this.bindAngleStep(container, state);

      if (state._stLocMap) {
        const mapEl = state._stLocMap.getContainer();
        const slot = container.querySelector("#stAngleMapSlot");
        if (mapEl && slot) {
          slot.appendChild(mapEl);
          state._stEnterAngleMode?.();
          setTimeout(() => {
            if (!state._stLocMap._mapPane) return;
            state._stLocMap.invalidateSize();
            state._stUpdateOverlays?.();
          }, 50);
        }
      }
    },

    bindAngleStep(container, state) {
      const maxAngleInput = container.querySelector("#stMaxAngle");
      const cardinalWrap = container.querySelector("#stCardinalWrap");
      const cardinalBtns = container.querySelector("#stCardinalBtns");
      const maxLapsInput = container.querySelector("#stMaxLaps");

      if (maxLapsInput) {
        maxLapsInput.addEventListener("change", () => {
          const v = Number(maxLapsInput.value);
          state.maxLaps = Number.isFinite(v) && v > 0 ? Math.floor(v) : null;
          maxLapsInput.value = state.maxLaps ?? "";
        });
      }

      const toggleCardinal = (v) => {
        if (!cardinalWrap) return;
        // < 360: só os BOTÕES cardeais ficam cinza/bloqueados; o título/legenda
        // continua visível e normal (o estilo cinza vem do :disabled dos botões).
        const enabled = v >= 360;
        if (cardinalBtns) cardinalBtns.querySelectorAll(".pivo-cardinal-btn").forEach((b) => { b.disabled = !enabled; });
      };
      toggleCardinal(state.maxAngle ?? 360);

      const resetBearingForAngle = (v) => {
        state.bearing = v < 360 ? 270 : 0;
        state._stUpdateOverlays?.();
      };

      if (maxAngleInput) {
        maxAngleInput.addEventListener("input", () => {
          let v = Number(maxAngleInput.value);
          if (!Number.isFinite(v)) v = 360;
          v = Math.max(1, Math.min(360, v));
          state.maxAngle = v;
          resetBearingForAngle(v);
          toggleCardinal(v);
        });
        maxAngleInput.addEventListener("change", () => {
          let v = Number(maxAngleInput.value);
          if (!Number.isFinite(v)) v = 360;
          v = Math.max(1, Math.min(360, v));
          state.maxAngle = v;
          maxAngleInput.value = String(v);
          resetBearingForAngle(v);
          toggleCardinal(v);
        });
      }

      if (cardinalBtns) {
        cardinalBtns.addEventListener("click", (e) => {
          const btn = e.target.closest("[data-action='st-cardinal']");
          if (!btn) return;
          const b = Number(btn.dataset.bearing);
          state.bearing = b;
          cardinalBtns.querySelectorAll(".pivo-cardinal-btn").forEach((el) => {
            el.classList.toggle("is-selected", Number(el.dataset.bearing) === b);
          });
          state._stUpdateOverlays?.();
        });
      }

      const brgTo = (from, to) => {
        const lat1 = from.lat * Math.PI / 180, lat2 = to.lat * Math.PI / 180;
        const dLng = (to.lng - from.lng) * Math.PI / 180;
        const y = Math.sin(dLng) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
        return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
      };

      const latLngInput = container.querySelector("#stAngleLatLng");
      if (latLngInput) {
        const syncLatLng = () => {
          const parsed = parseLatLng(latLngInput.value);
          if (!parsed) return;
          if (!Number.isFinite(state.lat) || !Number.isFinite(state.lng)) return;
          const center = { lat: state.lat, lng: state.lng };
          state.bearing = brgTo(center, parsed);
          const onCircle = destinationPoint(center, state.radius ?? 600, state.bearing);
          latLngInput.value = formatLatLng(onCircle.lat, onCircle.lng);
          state._stUpdateOverlays?.();
        };
        latLngInput.addEventListener("change", syncLatLng);
        latLngInput.addEventListener("blur", syncLatLng);
      }

      const angleLocBtn = container.querySelector('[data-action="st-get-angle-loc"]');
      if (angleLocBtn && navigator.geolocation) {
        angleLocBtn.addEventListener("click", () => {
          if (!Number.isFinite(state.lat) || !Number.isFinite(state.lng)) return;
          angleLocBtn.disabled = true;
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const center = { lat: state.lat, lng: state.lng };
              state.bearing = brgTo(center, { lat: pos.coords.latitude, lng: pos.coords.longitude });
              const onCircle = destinationPoint(center, state.radius ?? 600, state.bearing);
              if (latLngInput) latLngInput.value = formatLatLng(onCircle.lat, onCircle.lng);
              state._stUpdateOverlays?.();
              angleLocBtn.disabled = false;
            },
            () => { angleLocBtn.disabled = false; },
            { enableHighAccuracy: true, timeout: 8000 }
          );
        });
      }
    },

    renderSegmentsStep(container, state) {
      const maxAngle = Number(state.maxAngle ?? 360);
      const validMax = Number.isFinite(maxAngle) && maxAngle >= 1 ? maxAngle : 360;

      if (!state.segments || state.segments.length === 0) {
        state.segments = [{ name: "Segment 1", startAngle: 0, endAngle: validMax }];
      }
      if (state.activeSegIdx === undefined) state.activeSegIdx = 0;

      container.innerHTML = `
        <div class="pivo-edit__segments-section pivo-edit-specifics">
          <div style="margin-bottom:14px;">
            <div style="font-size:14px;font-weight:400;color:#0f172a;margin-bottom:6px;">Configuração automática</div>
            <div class="pivo-preset-row">
              <button type="button" class="pivo-preset-btn" data-st-preset="1">1</button>
              <button type="button" class="pivo-preset-btn" data-st-preset="2">2</button>
              <button type="button" class="pivo-preset-btn" data-st-preset="3">3</button>
              <button type="button" class="pivo-preset-btn" data-st-preset="4">4</button>
              <button type="button" class="pivo-preset-btn" data-st-preset="5">5</button>
              <button type="button" class="pivo-preset-btn" data-st-preset="6">6</button>
            </div>
          </div>
          <div style="font-size:14px;font-weight:400;color:#0f172a;margin-bottom:6px;">Configuração manual</div>
          <div id="stSegList" style="display:flex;gap:8px;margin-bottom:16px;align-items:center;flex-wrap:wrap;"></div>
          <div class="edit-panel__grid-3" style="grid-template-columns:1fr 1fr;">
            <div class="pivo-edit__field">
              <label for="stSegStart"><span class="edit-panel__req">*</span> Ângulo inicial</label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="stSegStart" type="text" inputmode="decimal">
                <span class="sc-input-suffix">°</span>
              </div>
            </div>
            <div class="pivo-edit__field">
              <label for="stSegEnd"><span class="edit-panel__req">*</span> Ângulo final</label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="stSegEnd" type="text" inputmode="decimal">
                <span class="sc-input-suffix">°</span>
              </div>
            </div>
            <div class="pivo-edit__field">
              <label for="stSegLaminaAvanco"><span class="edit-panel__req">*</span> Lâmina (Avanço) <span class="edit-panel__tooltip-icon" data-tooltip="Lâmina d'agua para irrigação em avanço"><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="stSegLaminaAvanco" type="text" inputmode="decimal" placeholder="10">
                <span class="sc-input-suffix">mm</span>
              </div>
            </div>
            <div class="pivo-edit__field">
              <label for="stSegLaminaReverso"><span class="edit-panel__req">*</span> Lâmina (Reverso) <span class="edit-panel__tooltip-icon" data-tooltip="Lâmina d'agua para irrigação em reverso"><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="stSegLaminaReverso" type="text" inputmode="decimal" placeholder="5">
                <span class="sc-input-suffix">mm</span>
              </div>
            </div>
          </div>
        </div>
        <div id="stSegMapSlot" class="sc-loc__map-wrapper" style="margin-top:14px;"></div>
      `;

      this.bindSegmentsStep(container, state);

      if (state._stLocMap) {
        const mapEl = state._stLocMap.getContainer();
        const slot = container.querySelector("#stSegMapSlot");
        if (mapEl && slot) {
          slot.appendChild(mapEl);
          state._stEnterSegmentsMode?.();
          setTimeout(() => {
            if (!state._stLocMap._mapPane) return;
            state._stLocMap.invalidateSize();
            state._stUpdateOverlays?.();
          }, 50);
        }
      }
    },

    bindSegmentsStep(container, state) {
      const maxAngle = Number(state.maxAngle ?? 360);
      const validMax = Number.isFinite(maxAngle) && maxAngle >= 1 ? maxAngle : 360;

      const segList = container.querySelector("#stSegList");
      const nameInput = container.querySelector("#stSegName");
      const startInput = container.querySelector("#stSegStart");
      const endInput = container.querySelector("#stSegEnd");
      const laminaAvancoInput = container.querySelector("#stSegLaminaAvanco");
      const laminaReversoInput = container.querySelector("#stSegLaminaReverso");

      const renderList = () => {
        if (!segList) return;
        segList.innerHTML = "";
        const segs = state.segments || [];
        segs.forEach((seg, i) => {
          const color = ST_SEG_PALETTE[i % ST_SEG_PALETTE.length];
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "pivo-seg-num-btn" + (i === state.activeSegIdx ? " is-active" : "");
          btn.style.cssText = `background:${color};--seg-color:${color};`;
          btn.textContent = String(i + 1);
          btn.addEventListener("click", () => {
            state.activeSegIdx = i;
            renderList();
            populateForm();
            state._stUpdateOverlays?.();
          });
          segList.appendChild(btn);
        });

        if (segs.length < 6) {
          const addBtn = document.createElement("button");
          addBtn.type = "button";
          addBtn.className = "pivo-seg-add-btn";
          addBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
          addBtn.addEventListener("click", () => {
            // Divide o último segmento ao meio, preservando as divisas ajustadas manualmente
            const last = segs[segs.length - 1];
            const lastStart = Number(last?.startAngle) || 0;
            let lastEnd = Number(last?.endAngle);
            if (!Number.isFinite(lastEnd)) lastEnd = validMax;
            if (lastEnd - lastStart < 2) return;
            const mid = Math.round(lastStart + (lastEnd - lastStart) / 2);
            last.endAngle = mid;
            state.segments = [...segs, { name: `Segment ${segs.length + 1}`, startAngle: mid, endAngle: lastEnd }];
            state.activeSegIdx = state.segments.length - 1;
            renderList();
            populateForm();
            state._stUpdateOverlays?.();
          });
          segList.appendChild(addBtn);
        }

        // Lixeira sempre visível; fica desabilitada quando há só 1 segmento
        // (igual ao edit do pivô).
        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "pivo-seg-del-btn";
        delBtn.innerHTML = '<i class="fa-regular fa-trash-can"></i>';
        if (segs.length <= 1) {
          delBtn.disabled = true;
          delBtn.title = "O pivô precisa ter pelo menos 1 segmento";
        } else {
          delBtn.title = "Remover segmento";
          delBtn.addEventListener("click", () => {
            state.segments.splice(state.activeSegIdx, 1);
            state.activeSegIdx = Math.max(0, state.activeSegIdx - 1);
            if (state.segments.length === 1) {
              state.segments[0].startAngle = 0;
              state.segments[0].endAngle = validMax;
            }
            renderList();
            populateForm();
            state._stUpdateOverlays?.();
          });
        }
        segList.appendChild(delBtn);
      };

      const populateForm = () => {
        const segs = state.segments || [];
        const seg = segs[state.activeSegIdx ?? 0];
        if (!seg) return;
        const single = segs.length === 1;
        if (nameInput) nameInput.value = seg.name || `Segment ${(state.activeSegIdx ?? 0) + 1}`;
        if (startInput) { startInput.value = String(seg.startAngle ?? 0); startInput.disabled = single; }
        if (endInput) { endInput.value = String(seg.endAngle ?? validMax); endInput.disabled = single; }
        // Lâmina é independente por segmento: cada um guarda o próprio valor,
        // então ao trocar de segmento o campo reflete só o dele (vazio se novo).
        if (laminaAvancoInput) laminaAvancoInput.value = seg.laminaAvanco ?? "";
        if (laminaReversoInput) laminaReversoInput.value = seg.laminaReverso ?? "";
      };

      container.querySelectorAll("[data-st-preset]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const n = Number(btn.dataset.stPreset);
          const slice = validMax / n;
          const names = state.segments?.map((s) => s.name) || [];
          state.segments = Array.from({ length: n }, (_, k) => ({
            name: names[k] || `Segment ${k + 1}`,
            startAngle: Math.round(k * slice),
            endAngle: k === n - 1 ? validMax : Math.round((k + 1) * slice),
          }));
          state.activeSegIdx = 0;
          renderList();
          populateForm();
          state._stUpdateOverlays?.();
        });
      });

      if (nameInput) {
        nameInput.addEventListener("input", () => {
          const seg = (state.segments || [])[state.activeSegIdx ?? 0];
          if (seg) seg.name = nameInput.value;
        });
      }

      if (startInput) {
        startInput.addEventListener("change", () => {
          const seg = (state.segments || [])[state.activeSegIdx ?? 0];
          if (!seg) return;
          let v = Number(startInput.value);
          if (!Number.isFinite(v)) v = 0;
          v = Math.max(0, Math.min(validMax, v));
          seg.startAngle = v;
          startInput.value = String(v);
          state._stUpdateOverlays?.();
        });
      }

      if (endInput) {
        endInput.addEventListener("change", () => {
          const seg = (state.segments || [])[state.activeSegIdx ?? 0];
          if (!seg) return;
          let v = Number(endInput.value);
          if (!Number.isFinite(v)) v = validMax;
          v = Math.max(0, Math.min(validMax, v));
          seg.endAngle = v;
          endInput.value = String(v);
          state._stUpdateOverlays?.();
        });
      }

      if (laminaAvancoInput) {
        laminaAvancoInput.addEventListener("input", () => {
          const seg = (state.segments || [])[state.activeSegIdx ?? 0];
          if (seg) seg.laminaAvanco = laminaAvancoInput.value;
        });
      }

      if (laminaReversoInput) {
        laminaReversoInput.addEventListener("input", () => {
          const seg = (state.segments || [])[state.activeSegIdx ?? 0];
          if (seg) seg.laminaReverso = laminaReversoInput.value;
        });
      }

      renderList();
      populateForm();
    },

    renderCanhaoStep(container, state) {
      if (!state.endGun1Segments) state.endGun1Segments = [];
      if (!state.endGun2Segments) state.endGun2Segments = [];
      if (state.activeEndGun1Idx === undefined) state.activeEndGun1Idx = 0;
      if (state.activeEndGun2Idx === undefined) state.activeEndGun2Idx = 0;
      if (!state.canhaoMode) state.canhaoMode = "off";

      container.innerHTML = `
        <div class="pivo-edit__segments-section pivo-edit-specifics">
          <div class="pivo-edit__field" style="margin-bottom:16px;">
            <label for="stCanhaoMode">Modo de acionamento</label>
            <select class="equip-input" id="stCanhaoMode">
              <option value="off" ${state.canhaoMode === "off" ? "selected" : ""}>Sempre desligado</option>
              <option value="on" ${state.canhaoMode === "on" ? "selected" : ""}>Sempre ligado</option>
              <option value="segment" ${state.canhaoMode === "segment" ? "selected" : ""}>Modo automático</option>
            </select>
          </div>

          <div id="stCanhaoSegmentsWrap" style="display:${state.canhaoMode === "segment" ? "" : "none"};">
            <p style="font-size:13px;color:#121829;line-height:1.4;margin:0 0 12px;">
              Personalize o acionamento do canhão final de acordo com o ângulo do pivô para evitar irrigação em locais impróprios.
            </p>
            <div style="display:flex;gap:12px;margin-bottom:16px;">
              <div style="flex:1;background:#eff6ff;border:1px solid #bfdbfe;color:#121829;padding:8px 12px;border-radius:10px;font-size:12px;display:flex;align-items:center;gap:8px;">
                <i class="fa-solid fa-circle-info" style="color:#3b82f6;"></i>
                <span>Você pode criar até 6 segmentos por canhão. Configure os ângulos onde o canhão deve ligar.</span>
              </div>

            </div>
            <div style="display:flex;gap:16px;margin-bottom:16px;">
              <div style="flex:1;">
                <div style="font-size:14px;font-weight:400;color:#0f172a;margin-bottom:6px;">Segmentos ativos do canhão 1</div>
                <div id="stEndGun1List" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;min-height:36px;"></div>
                <div class="edit-panel__grid-3" style="grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;">
                  <div class="pivo-edit__field">
                    <label for="stGun1Start">Ângulo inicial</label>
                    <div class="sc-input-group">
                      <input class="equip-input sc-input" id="stGun1Start" type="text" inputmode="decimal">
                      <span class="sc-input-suffix">°</span>
                    </div>
                  </div>
                  <div class="pivo-edit__field">
                    <label for="stGun1End">Ângulo final</label>
                    <div class="sc-input-group">
                      <input class="equip-input sc-input" id="stGun1End" type="text" inputmode="decimal">
                      <span class="sc-input-suffix">°</span>
                    </div>
                  </div>
                </div>
              </div>
              <div style="flex:1;">
                <div style="font-size:14px;font-weight:400;color:#0f172a;margin-bottom:6px;">Segmentos ativos do canhão 2</div>
                <div id="stEndGun2List" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;min-height:36px;"></div>
                <div class="edit-panel__grid-3" style="grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;">
                  <div class="pivo-edit__field">
                    <label for="stGun2Start">Ângulo inicial</label>
                    <div class="sc-input-group">
                      <input class="equip-input sc-input" id="stGun2Start" type="text" inputmode="decimal">
                      <span class="sc-input-suffix">°</span>
                    </div>
                  </div>
                  <div class="pivo-edit__field">
                    <label for="stGun2End">Ângulo final</label>
                    <div class="sc-input-group">
                      <input class="equip-input sc-input" id="stGun2End" type="text" inputmode="decimal">
                      <span class="sc-input-suffix">°</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div id="stCanhaoMapSlot" class="sc-loc__map-wrapper" style="margin-top:14px;display:${state.canhaoMode === "segment" ? "" : "none"};"></div>
        </div>
      `;

      this.bindCanhaoStep(container, state);

      const modeSelect = container.querySelector("#stCanhaoMode");
      const segmentsWrap = container.querySelector("#stCanhaoSegmentsWrap");
      const mapSlot = container.querySelector("#stCanhaoMapSlot");
      if (modeSelect) {
        modeSelect.addEventListener("change", () => {
          state.canhaoMode = modeSelect.value;
          const isSegment = state.canhaoMode === "segment";
          if (segmentsWrap) segmentsWrap.style.display = isSegment ? "" : "none";
          if (mapSlot) mapSlot.style.display = isSegment ? "" : "none";
          if (isSegment && state._stLocMap) {
            const mapEl = state._stLocMap.getContainer();
            if (mapEl && mapSlot && !mapSlot.contains(mapEl)) mapSlot.appendChild(mapEl);
            state._stEnterCanhaoMode?.();
            setTimeout(() => {
              if (!state._stLocMap._mapPane) return;
              state._stLocMap.invalidateSize();
              state._stUpdateOverlays?.();
            }, 50);
          }
        });
      }
      if (window.IcEquipSelectInit) window.IcEquipSelectInit(container);

      if (state._stLocMap && state.canhaoMode === "segment") {
        const mapEl = state._stLocMap.getContainer();
        if (mapEl && mapSlot) {
          mapSlot.appendChild(mapEl);
          state._stEnterCanhaoMode?.();
          setTimeout(() => {
            if (!state._stLocMap._mapPane) return;
            state._stLocMap.invalidateSize();
            state._stUpdateOverlays?.();
          }, 50);
        }
      }
    },

    bindCanhaoStep(container, state) {
      const maxAngle = Number(state.maxAngle ?? 360);
      const validMax = Number.isFinite(maxAngle) && maxAngle >= 1 ? maxAngle : 360;

      const gun1List = container.querySelector("#stEndGun1List");
      const gun2List = container.querySelector("#stEndGun2List");
      const gun1Start = container.querySelector("#stGun1Start");
      const gun1End = container.querySelector("#stGun1End");
      const gun2Start = container.querySelector("#stGun2Start");
      const gun2End = container.querySelector("#stGun2End");

      const renderGunList = (listEl, segs, activeIdxKey, baseColor, startInput, endInput) => {
        if (!listEl) return;
        const paletteOffset = baseColor === ST_SEG_PALETTE[4] ? 4 : 0;
        listEl.innerHTML = "";
        segs.forEach((seg, i) => {
          const isAct = i === (state[activeIdxKey] ?? 0);
          const color = ST_SEG_PALETTE[(i + paletteOffset) % ST_SEG_PALETTE.length];
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "pivo-seg-num-btn" + (isAct ? " is-active" : "");
          btn.style.cssText = `background:${color};--seg-color:${color};`;
          btn.textContent = String(i + 1);
          btn.addEventListener("click", () => {
            state[activeIdxKey] = i;
            renderGunList(listEl, segs, activeIdxKey, baseColor, startInput, endInput);
            populateGunForm(segs, activeIdxKey, startInput, endInput);
            state._stUpdateOverlays?.();
          });
          listEl.appendChild(btn);
        });

        if (segs.length < 6) {
          const addBtn = document.createElement("button");
          addBtn.type = "button";
          addBtn.className = "pivo-seg-add-btn";
          addBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
          addBtn.addEventListener("click", () => {
            const prevEnd = segs.length > 0 ? (segs[segs.length - 1].endAngle ?? 0) : 0;
            segs.push({ startAngle: prevEnd, endAngle: Math.min(prevEnd + 30, validMax) });
            state[activeIdxKey] = segs.length - 1;
            renderGunList(listEl, segs, activeIdxKey, baseColor, startInput, endInput);
            populateGunForm(segs, activeIdxKey, startInput, endInput);
            state._stUpdateOverlays?.();
          });
          listEl.appendChild(addBtn);
        }

        if (segs.length > 0) {
          const delBtn = document.createElement("button");
          delBtn.type = "button";
          delBtn.className = "pivo-seg-del-btn";
          delBtn.innerHTML = '<i class="fa-regular fa-trash-can"></i>';
          delBtn.addEventListener("click", () => {
            segs.splice(state[activeIdxKey], 1);
            state[activeIdxKey] = Math.max(0, (state[activeIdxKey] ?? 0) - 1);
            renderGunList(listEl, segs, activeIdxKey, baseColor, startInput, endInput);
            populateGunForm(segs, activeIdxKey, startInput, endInput);
            state._stUpdateOverlays?.();
          });
          listEl.appendChild(delBtn);
        }

        populateGunForm(segs, activeIdxKey, startInput, endInput);
      };

      const populateGunForm = (segs, activeIdxKey, startInput, endInput) => {
        const seg = segs[state[activeIdxKey] ?? 0];
        if (!seg) {
          if (startInput) startInput.value = "";
          if (endInput) endInput.value = "";
          return;
        }
        if (startInput) startInput.value = String(seg.startAngle ?? 0);
        if (endInput) endInput.value = String(seg.endAngle ?? 30);
      };

      if (gun1Start) {
        gun1Start.addEventListener("change", () => {
          const seg = (state.endGun1Segments || [])[state.activeEndGun1Idx ?? 0];
          if (!seg) return;
          let v = Number(gun1Start.value);
          if (!Number.isFinite(v)) v = 0;
          v = Math.max(0, Math.min(validMax, v));
          seg.startAngle = v;
          gun1Start.value = String(v);
          state._stUpdateOverlays?.();
        });
      }
      if (gun1End) {
        gun1End.addEventListener("change", () => {
          const seg = (state.endGun1Segments || [])[state.activeEndGun1Idx ?? 0];
          if (!seg) return;
          let v = Number(gun1End.value);
          if (!Number.isFinite(v)) v = 30;
          v = Math.max(0, Math.min(validMax, v));
          seg.endAngle = v;
          gun1End.value = String(v);
          state._stUpdateOverlays?.();
        });
      }
      if (gun2Start) {
        gun2Start.addEventListener("change", () => {
          const seg = (state.endGun2Segments || [])[state.activeEndGun2Idx ?? 0];
          if (!seg) return;
          let v = Number(gun2Start.value);
          if (!Number.isFinite(v)) v = 0;
          v = Math.max(0, Math.min(validMax, v));
          seg.startAngle = v;
          gun2Start.value = String(v);
          state._stUpdateOverlays?.();
        });
      }
      if (gun2End) {
        gun2End.addEventListener("change", () => {
          const seg = (state.endGun2Segments || [])[state.activeEndGun2Idx ?? 0];
          if (!seg) return;
          let v = Number(gun2End.value);
          if (!Number.isFinite(v)) v = 30;
          v = Math.max(0, Math.min(validMax, v));
          seg.endAngle = v;
          gun2End.value = String(v);
          state._stUpdateOverlays?.();
        });
      }

      renderGunList(gun1List, state.endGun1Segments, "activeEndGun1Idx", ST_SEG_PALETTE[0], gun1Start, gun1End);
      renderGunList(gun2List, state.endGun2Segments, "activeEndGun2Idx", ST_SEG_PALETTE[4], gun2Start, gun2End);
    },

    renderStep4(container, state) {
      this.renderSegmentsStep(container, state);
    },

    renderStep5(container, state) {
      this.renderCanhaoStep(container, state);
    },

    renderStep6(container, state) {
      this.renderConfigStep(container, state);
    },

    renderStep7(container, state) {
      this.renderPumpStep(container, state);
    },

    renderStep8(container, state) {
      this.renderConnectivityStep(container, state);
    },

    renderConnectivityStep(container, state) {
      const commType = state.commType || "4G";
      const isXbee = commType === "XBEE";
      container.innerHTML = `
        <div class="sc-config">
          <input type="hidden" id="stCommType" value="4G" />

          <div class="edit-panel__grid-3" style="margin-bottom:14px;">
            <div class="farm-radio-field">
              <div class="farm-radio-field__header">
                <span class="farm-radio-field__label"><span class="equip-required">*</span>ID do equipamento</span>
              </div>
              <div class="farm-radio-field__value">
                <div class="sc-input-group">
                  <input class="equip-input sc-input farm-radio-input" id="stGateway" placeholder="10000000351D266D" value="${escapeHtml(state.gateway || "")}" />
                  <div class="farm-radio-actions">
                    <button type="button" class="farm-radio-clear" title="Limpar" data-clear="stGateway"><i class="fa-solid fa-xmark"></i></button>
                    <span class="farm-radio-status"><i class="fa-solid fa-check"></i></span>
                  </div>
                  <button type="button" class="farm-radio-qr" title="Escanear QR Code"><i class="fa-solid fa-qrcode"></i></button>
                </div>
                <div class="sc-error is-hidden">Este campo é obrigatório</div>
              </div>
            </div>
          </div>

        </div>
      `;

      this.bindConnectivityStep(container, state);
    },

    bindConnectivityStep(container, state) {
      state.commType = "4G";
      container.querySelector("#stGateway")?.addEventListener("input", e => { state.gateway = e.target.value; });
      container.querySelectorAll("[data-clear]").forEach(btn => {
        btn.addEventListener("click", () => {
          const target = container.querySelector(`#${btn.dataset.clear}`);
          if (target) { target.value = ""; target.dispatchEvent(new Event("input")); }
        });
      });
    },

    renderPumpStep(container, state) {
      state.pumpPowerUnit = "kw";
      container.innerHTML = `
        <div class="sc-config">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px;">
            <div class="sc-field">
              <label class="equip-label" for="stPumpPower"><span class="equip-required">*</span> Potência elétrica <span class="edit-panel__tooltip-icon" data-tooltip="Potência real (absorvida): energia efetivamente absorvida da rede elétrica para operar o equipamento no ponto de trabalho atual, considerando o rendimento e a conversão para o sistema internacional de unidades."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="stPumpPower" type="text" inputmode="decimal" value="${escapeHtml(String(state.pumpPower || ""))}">
                <span class="sc-input-suffix">kW</span>
              </div>
              <div class="sc-error is-hidden">Este campo é obrigatório</div>
            </div>

            <div class="sc-field">
              <label class="equip-label" for="stPumpFlow"><span class="equip-required">*</span>Vazão</label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="stPumpFlow" type="text" inputmode="decimal" value="${escapeHtml(String(state.pumpFlow || ""))}">
                <span class="sc-input-suffix">m³/h</span>
              </div>
              <div class="sc-error is-hidden">Este campo é obrigatório</div>
            </div>

            <div class="sc-field">
              <label class="equip-label" for="stPumpIrrigRate">Lâmina de irrigação <span class="edit-panel__tooltip-icon" data-tooltip="Irrigation Rate 100% = VAZ × (2π × RUT × AMT / 360) / VUT / (π × RTI² × AMT / 10000 / 360) × 0.1"><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="stPumpIrrigRate" type="text" value="${escapeHtml(String(state.pumpIrrigRate || ""))}" readonly style="background:#f8fafc;color:#94a3b8;cursor:not-allowed;">
                <span class="sc-input-suffix">mm</span>
              </div>
            </div>
          </div>
        </div>
      `;
      this.bindPumpStep(container, state);
    },

    bindPumpStep(container, state) {
      const powerInput = container.querySelector("#stPumpPower");
      if (powerInput) powerInput.addEventListener("input", () => {
        state.pumpPower = powerInput.value;
      });
    },

    bindLocationStep(container, state) {
      const locInput = container.querySelector("#stLoc");
      const radiusInput = container.querySelector("#stRadius");
      const button = container.querySelector('[data-action="st-get-loc"]');

      const applyLocation = (lat, lng, setView = true) => {
        if (typeof state._stSetPoint === "function") {
          state._stSetPoint(lat, lng, setView);
          return;
        }
        state.lat = lat;
        state.lng = lng;
        state.loc = formatLatLng(lat, lng);
        if (locInput) locInput.value = state.loc;
      };

      const applyRadius = (value, opts = {}) => {
        const radius = parseRadius(value);
        if (!Number.isFinite(radius) || radius <= 0) return;
        state.radius = radius;
        if (typeof state._stSetRadius === "function") state._stSetRadius(radius);
        if (radiusInput && !opts.skipInput) radiusInput.value = radius.toFixed(2);
      };

      if (locInput) {
        const syncFromInput = () => {
          const parsed = parseLatLng(locInput.value);
          if (!parsed) return;
          applyLocation(parsed.lat, parsed.lng, true);
        };
        locInput.addEventListener("change", syncFromInput);
        locInput.addEventListener("blur", syncFromInput);
      }

      if (radiusInput) {
        radiusInput.addEventListener("input", () => applyRadius(radiusInput.value, { skipInput: true }));
        radiusInput.addEventListener("blur", () => applyRadius(radiusInput.value));
      }

      if (button && navigator.geolocation) {
        button.addEventListener("click", () => {
          button.disabled = true;
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude, longitude } = pos.coords;
              applyLocation(latitude, longitude, true);
              button.disabled = false;
            },
            () => {
              button.disabled = false;
            },
            { enableHighAccuracy: true, timeout: 8000 }
          );
        });
      }

      const radiusBtn = container.querySelector('[data-action="st-get-radius"]');
      if (radiusBtn && navigator.geolocation) {
        radiusBtn.addEventListener("click", () => {
          radiusBtn.disabled = true;
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude, longitude } = pos.coords;
              if (!Number.isFinite(state.lat) || !Number.isFinite(state.lng)) {
                radiusBtn.disabled = false;
                return;
              }
              const centerLL = L.latLng(state.lat, state.lng);
              const edgeLL = L.latLng(latitude, longitude);
              const newRadius = centerLL.distanceTo(edgeLL);
              if (newRadius >= 1) applyRadius(newRadius);
              if (state._stRadiusMarker) state._stRadiusMarker.setLatLng([latitude, longitude]);
              radiusBtn.disabled = false;
            },
            () => {
              radiusBtn.disabled = false;
            },
            { enableHighAccuracy: true, timeout: 8000 }
          );
        });
      }
    },

    initLocationMap(container, state) {
      if (!window.L) return;

      const mapEl = container.querySelector("#stMap");
      const locInput = container.querySelector("#stLoc");
      const radiusInput = container.querySelector("#stRadius");
      if (!mapEl || !locInput || !radiusInput) return;

      if (state._stLocMap) {
        try { state._stLocMap.remove(); } catch (_) {}
        state._stLocMap = null;
      }

      const firstGhostPivot = getActiveFarmEquipments()
        .filter((equip) => equip?.type === "smart_connect" || equip?.type === "smarttouch")
        .map(extractGhostPivot)
        .find(Boolean);
      const explicitStart = parseLatLng(state.loc) || (
        Number.isFinite(state.lat) && Number.isFinite(state.lng)
          ? { lat: state.lat, lng: state.lng }
          : null
      );
      const start = explicitStart || firstGhostPivot?.center || getFallbackCenter(state);
      const radius = parseRadius(radiusInput.value) ?? parseRadius(state.radius) ?? 600;
      const map = L.map(mapEl, { zoomControl: false, keyboard: false }).setView([start.lat, start.lng], 15);
      state._stLocMap = map;

      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
        attribution: "Tiles © Esri",
      }).addTo(map);
      L.tileLayer("https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
        opacity: 0.85,
      }).addTo(map);

      map.createPane('whiteOverlay');
      map.getPane('whiteOverlay').style.zIndex = 450;
      map.getPane('whiteOverlay').style.pointerEvents = 'none';

      renderGhostPivots(map, state.id);

      const marker = L.marker([start.lat, start.lng], { icon: pinIcon(), draggable: true }).addTo(map);

      const shapeLayer = L.layerGroup().addTo(map);
      const segmentLayer = L.layerGroup().addTo(map);
      const segBoundaryLayer = L.layerGroup().addTo(map);
      let isDraggingBoundary = false;

      const circleFill = L.circle([start.lat, start.lng], {
        radius: 0, color: 'transparent', weight: 0, fillColor: '#8b5cf6', fillOpacity: 0.28,
      }).addTo(map);
      const circleStroke = L.circle([start.lat, start.lng], {
        radius: 0, color: '#ffffff', weight: 2, opacity: 1, fill: false, pane: 'whiteOverlay',
      }).addTo(map);
      const sectorFill = L.polygon([], {
        color: 'transparent', weight: 0, fillColor: '#8b5cf6', fillOpacity: 0.28,
      });
      const sectorStroke = L.polygon([], {
        color: '#ffffff', weight: 2, opacity: 1, fill: false, pane: 'whiteOverlay',
      });

      const endPinIcon = L.divIcon({
        className: "",
        html: `<div class="st-pin" style="color:#ef4444;"><i class="fa-solid fa-location-dot"></i></div>`,
        iconSize: [28, 32],
        iconAnchor: [14, 32],
      });
      const endMarker = L.marker([start.lat, start.lng], { icon: endPinIcon, draggable: true, interactive: true });

      const radiusPinIcon = L.divIcon({
        className: "",
        html: `<div class="st-pin" style="color:#ef4444;"><i class="fa-solid fa-location-dot"></i></div>`,
        iconSize: [28, 32],
        iconAnchor: [14, 32],
      });
      const radiusEdgePt = destinationPoint({ lat: start.lat, lng: start.lng }, radius, state.bearing ?? 0);
      const radiusMarker = L.marker([radiusEdgePt.lat, radiusEdgePt.lng], { icon: radiusPinIcon, draggable: true, interactive: true }).addTo(map);

      let radiusDragging = false;
      radiusMarker.on("dragstart", () => { radiusDragging = true; });
      radiusMarker.on("drag", () => {
        if (!Number.isFinite(state.lat) || !Number.isFinite(state.lng)) return;
        const centerLL = L.latLng(state.lat, state.lng);
        const newRadius = centerLL.distanceTo(radiusMarker.getLatLng());
        if (newRadius < 1) return;
        state.radius = newRadius;
        radiusInput.value = String(Math.round(newRadius));
        updateOverlays(state.lat, state.lng, newRadius);
      });
      radiusMarker.on("dragend", () => {
        radiusDragging = false;
        if (!Number.isFinite(state.lat) || !Number.isFinite(state.lng)) return;
        updateOverlays(state.lat, state.lng, state.radius ?? 600);
      });

      state._stRadiusMarker = radiusMarker;

      endMarker.on("drag dragend", () => {
        if (!Number.isFinite(state.lat) || !Number.isFinite(state.lng)) return;
        const centerLL = L.latLng(state.lat, state.lng);
        const pinLL = endMarker.getLatLng();
        const newRadius = centerLL.distanceTo(pinLL);
        if (newRadius < 1) return;

        const lat1 = state.lat * Math.PI / 180;
        const lng1 = state.lng * Math.PI / 180;
        const lat2 = pinLL.lat * Math.PI / 180;
        const lng2 = pinLL.lng * Math.PI / 180;
        const y = Math.sin(lng2 - lng1) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1);
        const endBearing = ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;

        const maxAngle = Number(state.maxAngle ?? 360);
        const validMax = Number.isFinite(maxAngle) && maxAngle >= 1 ? maxAngle : 360;
        state.bearing = ((endBearing - validMax) + 360) % 360;
        state.radius = newRadius;
        radiusInput.value = String(Math.round(newRadius));

        updateOverlays(state.lat, state.lng, newRadius);
      });

      const buildSectorPoints = (center, rad, startBearing, arcAngle) => {
        const pts = [[center.lat, center.lng]];
        const steps = Math.max(Math.ceil(arcAngle * 2), 2);
        for (let i = 0; i <= steps; i++) {
          const b = (startBearing + (arcAngle * i) / steps) % 360;
          const pt = destinationPoint(center, rad, b);
          pts.push([pt.lat, pt.lng]);
        }
        pts.push([center.lat, center.lng]);
        return pts;
      };

      let angleMode = false;
      let segmentsMode = false;
      let canhaoMode = false;

      const rotatePinIcon = L.divIcon({
        className: "",
        html: `<div class="st-pin" style="color:#ef4444;"><i class="fa-solid fa-location-dot"></i></div>`,
        iconSize: [28, 32],
        iconAnchor: [14, 32],
      });
      const rotatePin = L.marker([start.lat, start.lng], { icon: rotatePinIcon, draggable: true, interactive: true });

      // Triângulo branco na ponta da linha do ângulo zero (mesmo estilo do painel de edição)
      const angleTriangleIcon = (rotationDeg = 0) => L.divIcon({
        className: "",
        html: `<div style="pointer-events:none;width:32px;height:32px;">
            <svg width="32" height="32" viewBox="-16 -16 32 32" xmlns="http://www.w3.org/2000/svg">
                <polygon points="0,-14 11,8 -11,8" fill="white" opacity="0.95"
                    style="filter:drop-shadow(0 1px 3px rgba(0,0,0,.65));"
                    transform="rotate(${rotationDeg})"/>
            </svg>
        </div>`,
        iconSize: [32, 32], iconAnchor: [16, 16],
      });
      const angleZeroTriangle = L.marker([start.lat, start.lng], {
        icon: angleTriangleIcon(0), interactive: false,
      });

      const updateShape = (lat, lng, rad) => {
        shapeLayer.clearLayers();
        const center = { lat, lng };
        const bearing = state.bearing ?? 0;
        const maxAngle = Number(state.maxAngle ?? 360);
        const validMax = Number.isFinite(maxAngle) && maxAngle >= 1 ? maxAngle : 360;

        if (validMax >= 360) {
          circleFill.setLatLng([lat, lng]);
          circleFill.setRadius(rad);
          circleFill.setStyle({ fillOpacity: 0.28 });
          circleStroke.setLatLng([lat, lng]);
          circleStroke.setRadius(rad);
          circleStroke.setStyle({ opacity: 1, weight: 2 });
          if (sectorFill._map) map.removeLayer(sectorFill);
          if (sectorStroke._map) map.removeLayer(sectorStroke);
          if (map.hasLayer(endMarker)) map.removeLayer(endMarker);
        } else {
          const pts = buildSectorPoints(center, rad, bearing, validMax);
          circleFill.setStyle({ fillOpacity: 0 });
          circleStroke.setStyle({ opacity: 0 });
          sectorFill.setLatLngs(pts);
          sectorFill.setStyle({ fillOpacity: 0.28 });
          if (!sectorFill._map) sectorFill.addTo(map);
          sectorStroke.setLatLngs(pts);
          sectorStroke.setStyle({ opacity: 1, weight: 2 });
          if (!sectorStroke._map) sectorStroke.addTo(map);
          if (!angleMode) {
            const endPt = destinationPoint(center, rad, (bearing + validMax) % 360);
            endMarker.setLatLng([endPt.lat, endPt.lng]);
            if (!map.hasLayer(endMarker)) endMarker.addTo(map);
          } else {
            if (map.hasLayer(endMarker)) map.removeLayer(endMarker);
          }
        }

        const edgePt = destinationPoint(center, rad, bearing);
        if (angleMode) {
          if (!rotateDragging && map.hasLayer(rotatePin)) rotatePin.setLatLng([edgePt.lat, edgePt.lng]);
        } else if (!radiusDragging) {
          radiusMarker.setLatLng([edgePt.lat, edgePt.lng]);
        }
      };

      const tickLayer = L.layerGroup().addTo(map);
      const drawTicks = (center, rad, startBearing = 0, arcAngle = 360) => {
        tickLayer.clearLayers();
        const innerR = rad * 0.92;
        const step = 5;
        const count = Math.floor(arcAngle / step);
        for (let i = 0; i <= count; i++) {
          const bearing = (startBearing + i * step) % 360;
          const outer = destinationPoint(center, rad, bearing);
          const inner = destinationPoint(center, innerR, bearing);
          L.polyline([[outer.lat, outer.lng], [inner.lat, inner.lng]], {
            color: "#ffffff", weight: 2, opacity: 1, interactive: false, pane: 'whiteOverlay',
          }).addTo(tickLayer);
        }
      };

      const refLine = L.polyline([], {
        color: "#ffffff", weight: 2.5, opacity: 0, interactive: false, pane: 'whiteOverlay',
      }).addTo(map);

      const updateOverlays = (lat, lng, rad) => {
        const center = { lat, lng };
        // Triângulo do ângulo zero aparece no passo Ângulo, Segmentos e Canhão
        if (!angleMode && !segmentsMode && !canhaoMode && angleZeroTriangle._map) map.removeLayer(angleZeroTriangle);
        const bearing = state.bearing ?? 0;
        const maxAngle = Number(state.maxAngle ?? 360);
        const validMaxAngle = Number.isFinite(maxAngle) && maxAngle >= 1 ? maxAngle : 360;

        if (canhaoMode) {
          shapeLayer.clearLayers();
          segmentLayer.clearLayers();
          refLine.setLatLngs([]);
          circleFill.setStyle({ fillOpacity: 0 });
          if (sectorFill._map) map.removeLayer(sectorFill);
          const gun1Segs = state.endGun1Segments || [];
          const gun2Segs = state.endGun2Segments || [];
          gun1Segs.forEach((seg, i) => {
            const isAct = i === (state.activeEndGun1Idx ?? 0);
            const color = ST_SEG_PALETTE[i % ST_SEG_PALETTE.length];
            const span = (seg.endAngle ?? 0) - (seg.startAngle ?? 0);
            if (span <= 0) return;
            const startBrg = (bearing + (seg.startAngle ?? 0) + 360) % 360;
            const pts = buildSectorPoints(center, rad, startBrg, span);
            L.polygon(pts, { color: '#ffffff', weight: isAct ? 2 : 1, fillColor: color, fillOpacity: isAct ? 0.85 : 0.65, interactive: false }).addTo(segmentLayer);
          });
          gun2Segs.forEach((seg, i) => {
            const isAct = i === (state.activeEndGun2Idx ?? 0);
            const color = ST_SEG_PALETTE[(i + 4) % ST_SEG_PALETTE.length];
            const span = (seg.endAngle ?? 0) - (seg.startAngle ?? 0);
            if (span <= 0) return;
            const startBrg = (bearing + (seg.startAngle ?? 0) + 360) % 360;
            const pts = buildSectorPoints(center, rad, startBrg, span);
            L.polygon(pts, { color: '#ffffff', weight: isAct ? 2 : 1, fillColor: color, fillOpacity: isAct ? 0.85 : 0.65, interactive: false }).addTo(segmentLayer);
          });
          // Borda branca via whiteOverlay (z-index 450) — garantido acima dos segmentos
          if (validMaxAngle >= 360) {
            circleStroke.setLatLng([lat, lng]);
            circleStroke.setRadius(rad);
            circleStroke.setStyle({ opacity: 1, weight: 2 });
            if (!circleStroke._map) circleStroke.addTo(map);
            if (sectorStroke._map) map.removeLayer(sectorStroke);
          } else {
            circleStroke.setStyle({ opacity: 0 });
            const pts = buildSectorPoints(center, rad, bearing, validMaxAngle);
            sectorStroke.setLatLngs(pts);
            sectorStroke.setStyle({ opacity: 1, weight: 2 });
            if (!sectorStroke._map) sectorStroke.addTo(map);
          }
          drawTicks(center, rad, bearing, validMaxAngle);
          tickLayer.eachLayer((l) => l.bringToFront?.());

          if (!isDraggingBoundary) {
            segBoundaryLayer.clearLayers();
            const minSpan = 3;
            const calcGunAngle = (latlng) => {
              const rawBrg = Math.atan2(
                Math.sin((latlng.lng - center.lng) * Math.PI / 180) * Math.cos(latlng.lat * Math.PI / 180),
                Math.cos(center.lat * Math.PI / 180) * Math.sin(latlng.lat * Math.PI / 180) - Math.sin(center.lat * Math.PI / 180) * Math.cos(latlng.lat * Math.PI / 180) * Math.cos((latlng.lng - center.lng) * Math.PI / 180)
              ) * 180 / Math.PI;
              return ((rawBrg - bearing) % 360 + 360) % 360;
            };
            const makeGunDots = (segs, paletteOffset) => {
              segs.forEach((seg, si) => {
                const color = ST_SEG_PALETTE[(si + paletteOffset) % ST_SEG_PALETTE.length];
                const makeDot = (isStart) => {
                  const angle = isStart ? (seg.startAngle ?? 0) : (seg.endAngle ?? 0);
                  const pos = destinationPoint(center, rad, (bearing + angle + 360) % 360);
                  const dot = L.marker([pos.lat, pos.lng], {
                    icon: L.divIcon({
                      className: '',
                      html: `<div style="width:16px;height:16px;background:#fff;border:3px solid ${color};border-radius:50%;cursor:grab;box-shadow:0 2px 6px rgba(0,0,0,0.45);"></div>`,
                      iconSize: [16, 16], iconAnchor: [8, 8],
                    }),
                    draggable: true, zIndexOffset: 600,
                  });
                  dot.on('dragstart', () => { isDraggingBoundary = true; });
                  dot.on('drag', (e) => {
                    let newAngle = calcGunAngle(e.target.getLatLng());
                    if (isStart) {
                      if (newAngle > 180) newAngle -= 360;
                      const hiS = (seg.endAngle ?? 0) - minSpan;
                      const loS = si > 0
                        ? (segs[si - 1].endAngle ?? 0) + minSpan
                        : (seg.endAngle ?? 0) - (validMaxAngle - minSpan);
                      newAngle = Math.round(Math.max(loS, Math.min(hiS, newAngle)));
                      seg.startAngle = newAngle;
                    } else {
                      const loE = (seg.startAngle ?? 0) + minSpan;
                      const hiE = si < segs.length - 1
                        ? (segs[si + 1].startAngle ?? validMaxAngle) - minSpan
                        : validMaxAngle;
                      newAngle = Math.round(Math.max(loE, Math.min(hiE, newAngle)));
                      seg.endAngle = newAngle;
                    }
                    e.target.setLatLng(destinationPoint(center, rad, (bearing + newAngle + 360) % 360));
                    updateOverlays(lat, lng, rad);
                  });
                  dot.on('dragend', () => { isDraggingBoundary = false; updateOverlays(lat, lng, rad); });
                  dot.addTo(segBoundaryLayer);
                };
                makeDot(true);
                makeDot(false);
              });
            };
            makeGunDots(gun1Segs, 0);
            makeGunDots(gun2Segs, 4);
          }
          segBoundaryLayer.eachLayer((l) => l.bringToFront?.());
          const triEdgeCanhao = destinationPoint(center, rad * 0.95, bearing);
          angleZeroTriangle.setIcon(angleTriangleIcon((bearing + 180) % 360));
          angleZeroTriangle.setLatLng([triEdgeCanhao.lat, triEdgeCanhao.lng]);
          if (!angleZeroTriangle._map) angleZeroTriangle.addTo(map);
          angleZeroTriangle.setZIndexOffset(1000);
          return;
        }

        if (segmentsMode) {
          shapeLayer.clearLayers();
          segmentLayer.clearLayers();
          circleFill.setStyle({ fillOpacity: 0 });
          if (sectorFill._map) map.removeLayer(sectorFill);
          const refEdgeSeg = destinationPoint(center, rad, bearing);
          refLine.setLatLngs([[lat, lng], [refEdgeSeg.lat, refEdgeSeg.lng]]);
          const segs = state.segments || [];
          segs.forEach((seg, i) => {
            const isAct = i === (state.activeSegIdx ?? 0);
            const color = ST_SEG_PALETTE[i % ST_SEG_PALETTE.length];
            const span = (seg.endAngle ?? 0) - (seg.startAngle ?? 0);
            if (span <= 0) return;
            const startBrg = (bearing + (seg.startAngle ?? 0) + 360) % 360;
            const pts = buildSectorPoints(center, rad, startBrg, span);
            L.polygon(pts, { color: '#ffffff', opacity: 0, weight: isAct ? 2 : 1, fillColor: color, fillOpacity: isAct ? 0.85 : 0.65, interactive: false }).addTo(segmentLayer);
          });
          // Borda branca via whiteOverlay (z-index 450) — garantido acima dos segmentos
          if (validMaxAngle >= 360) {
            circleStroke.setLatLng([lat, lng]);
            circleStroke.setRadius(rad);
            circleStroke.setStyle({ opacity: 1, weight: 2 });
            if (!circleStroke._map) circleStroke.addTo(map);
            if (sectorStroke._map) map.removeLayer(sectorStroke);
          } else {
            circleStroke.setStyle({ opacity: 0 });
            const pts = buildSectorPoints(center, rad, bearing, validMaxAngle);
            sectorStroke.setLatLngs(pts);
            sectorStroke.setStyle({ opacity: 1, weight: 2 });
            if (!sectorStroke._map) sectorStroke.addTo(map);
          }
          drawTicks(center, rad, bearing, validMaxAngle);
          tickLayer.eachLayer((l) => l.bringToFront?.());

          if (!isDraggingBoundary) {
            segBoundaryLayer.clearLayers();
            const minSpan = 3;

            const calcAngle = (latlng) => {
              const rawBrg = Math.atan2(
                Math.sin((latlng.lng - center.lng) * Math.PI / 180) * Math.cos(latlng.lat * Math.PI / 180),
                Math.cos(center.lat * Math.PI / 180) * Math.sin(latlng.lat * Math.PI / 180) - Math.sin(center.lat * Math.PI / 180) * Math.cos(latlng.lat * Math.PI / 180) * Math.cos((latlng.lng - center.lng) * Math.PI / 180)
              ) * 180 / Math.PI;
              return ((rawBrg - bearing) % 360 + 360) % 360;
            };

            const reRenderSegs = () => {
              segmentLayer.clearLayers();
              segs.forEach((seg, i) => {
                const isAct2 = i === (state.activeSegIdx ?? 0);
                const c = ST_SEG_PALETTE[i % ST_SEG_PALETTE.length];
                const sp = (seg.endAngle ?? 0) - (seg.startAngle ?? 0);
                if (sp <= 0) return;
                L.polygon(buildSectorPoints(center, rad, (bearing + (seg.startAngle ?? 0) + 360) % 360, sp), {
                  color: '#ffffff', opacity: 0, weight: isAct2 ? 2 : 1,
                  fillColor: c, fillOpacity: isAct2 ? 0.85 : 0.65,
                  interactive: false,
                }).addTo(segmentLayer);
              });
            };

            // Dot no ângulo zero — fronteira entre segs[lastIdx] e segs[0], arrasta em ambas direções
            if (segs.length > 1) {
              const lastIdx = segs.length - 1;
              const zeroAngle = segs[0].startAngle ?? 0;
              const zeroPos = destinationPoint(center, rad, (bearing + zeroAngle + 360) % 360);
              const zeroDot = L.marker([zeroPos.lat, zeroPos.lng], {
                icon: L.divIcon({
                  className: '',
                  html: `<div style="width:14px;height:14px;background:#fff;border:3px solid #94a3b8;border-radius:50%;cursor:grab;box-shadow:0 0 4px rgba(0,0,0,.4);"></div>`,
                  iconSize: [16, 16], iconAnchor: [8, 8],
                }),
                draggable: true, zIndexOffset: 700,
              });
              zeroDot.on('dragstart', () => { isDraggingBoundary = true; });
              zeroDot.on('drag', (e) => {
                let relAngle = calcAngle(e.target.getLatLng());
                if (relAngle > 180) relAngle -= 360;
                const lo = (segs[lastIdx].startAngle ?? 0) + minSpan - validMaxAngle;
                const hi = (segs[0].endAngle ?? minSpan) - minSpan;
                const newStart = Math.round(Math.max(lo, Math.min(hi, relAngle)));
                const delta = newStart - (segs[0].startAngle ?? 0);
                segs[0].startAngle = newStart;
                segs[lastIdx].endAngle = (segs[lastIdx].endAngle ?? validMaxAngle) + delta;
                e.target.setLatLng(destinationPoint(center, rad, (bearing + newStart + 360) % 360));
                reRenderSegs();
                const activeIdx = state.activeSegIdx ?? 0;
                if (activeIdx === 0) {
                  const startEl = document.querySelector('#stSegStart');
                  if (startEl) startEl.value = String(newStart);
                }
                if (activeIdx === lastIdx) {
                  const endEl = document.querySelector('#stSegEnd');
                  if (endEl) endEl.value = String(segs[lastIdx].endAngle);
                }
              });
              zeroDot.on('dragend', () => { isDraggingBoundary = false; updateOverlays(lat, lng, rad); });
              zeroDot.addTo(segBoundaryLayer);
            }

            // Dots nas fronteiras entre segmentos adjacentes
            for (let bi = 0; bi < segs.length - 1; bi++) {
              const boundaryAngle = segs[bi].endAngle ?? 0;
              const bPos = destinationPoint(center, rad, (bearing + boundaryAngle + 360) % 360);
              const bColor = ST_SEG_PALETTE[bi % ST_SEG_PALETTE.length];
              const capturedBi = bi;
              const dot = L.marker([bPos.lat, bPos.lng], {
                icon: L.divIcon({
                  className: '',
                  html: `<div style="width:16px;height:16px;background:#fff;border:3px solid ${bColor};border-radius:50%;cursor:grab;box-shadow:0 2px 6px rgba(0,0,0,0.45);"></div>`,
                  iconSize: [16, 16], iconAnchor: [8, 8],
                }),
                draggable: true, zIndexOffset: 600,
              });
              dot.on('dragstart', () => { isDraggingBoundary = true; });
              dot.on('drag', (e) => {
                let newAngle = calcAngle(e.target.getLatLng());
                const lo = (segs[capturedBi].startAngle ?? 0) + minSpan;
                const hi = (segs[capturedBi + 1].endAngle ?? validMaxAngle) - minSpan;
                newAngle = Math.round(Math.max(lo, Math.min(hi, newAngle)));
                segs[capturedBi].endAngle = newAngle;
                segs[capturedBi + 1].startAngle = newAngle;
                e.target.setLatLng(destinationPoint(center, rad, (bearing + newAngle + 360) % 360));
                reRenderSegs();
                const activeIdx = state.activeSegIdx ?? 0;
                const startEl = document.querySelector('#stSegStart');
                const endEl = document.querySelector('#stSegEnd');
                if (activeIdx === capturedBi && endEl) endEl.value = String(newAngle);
                if (activeIdx === capturedBi + 1 && startEl) startEl.value = String(newAngle);
              });
              dot.on('dragend', () => { isDraggingBoundary = false; updateOverlays(lat, lng, rad); });
              dot.addTo(segBoundaryLayer);
            }
          }
          segBoundaryLayer.eachLayer((l) => l.bringToFront?.());
          return;
        }

        segmentLayer.clearLayers();
        segBoundaryLayer.clearLayers();
        updateShape(lat, lng, rad);
        drawTicks(center, rad, bearing, validMaxAngle);
        const refEdge = destinationPoint(center, rad, bearing);
        if (angleMode) {
          const angleInp = document.getElementById("stAngleLatLng");
          if (angleInp && document.activeElement !== angleInp) {
            angleInp.value = formatLatLng(refEdge.lat, refEdge.lng);
          }
        }
        if (angleMode || segmentsMode || canhaoMode) {
          if (angleMode) refLine.setLatLngs([[lat, lng], [refEdge.lat, refEdge.lng]]);
          const triEdge = destinationPoint(center, rad * 0.95, bearing);
          angleZeroTriangle.setIcon(angleTriangleIcon((bearing + 180) % 360));
          angleZeroTriangle.setLatLng([triEdge.lat, triEdge.lng]);
          if (!angleZeroTriangle._map) angleZeroTriangle.addTo(map);
        } else {
          refLine.setLatLngs([]);
          if (angleZeroTriangle._map) map.removeLayer(angleZeroTriangle);
        }
      };

      const setPoint = (lat, lng, setView = true) => {
        marker.setLatLng([lat, lng]);
        locInput.value = formatLatLng(lat, lng);
        state.lat = lat;
        state.lng = lng;
        state.loc = locInput.value;
        if (setView) map.setView([lat, lng], map.getZoom());
        updateOverlays(lat, lng, parseRadius(radiusInput.value) ?? state.radius ?? 600);
      };

      const setRadius = (nextRadius) => {
        const parsed = parseRadius(nextRadius);
        if (!Number.isFinite(parsed) || parsed <= 0) return;
        radiusInput.value = String(parsed);
        state.radius = parsed;
        if (Number.isFinite(state.lat) && Number.isFinite(state.lng)) {
          updateOverlays(state.lat, state.lng, parsed);
        }
      };

      marker.on("drag dragend", () => {
        const point = marker.getLatLng();
        setPoint(point.lat, point.lng, false);
      });

      state._stSetPoint = setPoint;
      state._stSetRadius = setRadius;
      state._stUpdateOverlays = () => {
        if (Number.isFinite(state.lat) && Number.isFinite(state.lng)) {
          updateOverlays(state.lat, state.lng, parseRadius(radiusInput.value) ?? state.radius ?? 600);
          const angleInput = document.getElementById("stAngleLatLng");
          if (angleInput && document.activeElement !== angleInput) {
            const refPoint = destinationPoint(
              { lat: state.lat, lng: state.lng },
              parseRadius(radiusInput.value) ?? state.radius ?? 600,
              state.bearing ?? 0
            );
            angleInput.value = formatLatLng(refPoint.lat, refPoint.lng);
          }
        }
      };

      let rotateDragging = false;
      const calcBearingToPin = (pinLL) => {
        const lat1 = state.lat * Math.PI / 180;
        const lng1 = state.lng * Math.PI / 180;
        const lat2 = pinLL.lat * Math.PI / 180;
        const lng2 = pinLL.lng * Math.PI / 180;
        const y = Math.sin(lng2 - lng1) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1);
        return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
      };
      rotatePin.on("dragstart", () => { rotateDragging = true; });
      rotatePin.on("drag", () => {
        if (!Number.isFinite(state.lat) || !Number.isFinite(state.lng)) return;
        const brg = calcBearingToPin(rotatePin.getLatLng());
        state.bearing = brg;
        // Mantém o pin preso à linha do raio (só gira, não entra/sai do raio)
        const onCircle = destinationPoint({ lat: state.lat, lng: state.lng }, state.radius ?? 600, brg);
        rotatePin.setLatLng([onCircle.lat, onCircle.lng]);
        const angleInput = document.getElementById("stAngleLatLng");
        if (angleInput && document.activeElement !== angleInput) {
          angleInput.value = formatLatLng(onCircle.lat, onCircle.lng);
        }
        updateOverlays(state.lat, state.lng, state.radius ?? 600);
      });
      rotatePin.on("dragend", () => {
        rotateDragging = false;
        if (!Number.isFinite(state.lat) || !Number.isFinite(state.lng)) return;
        updateOverlays(state.lat, state.lng, state.radius ?? 600);
      });

      const mapClickHandler = (event) => setPoint(event.latlng.lat, event.latlng.lng, false);
      map.on("click", mapClickHandler);

      state._stEnterAngleMode = () => {
        segmentsMode = false;
        canhaoMode = false;
        angleMode = true;
        segmentLayer.clearLayers();
        segBoundaryLayer.clearLayers();
        map.off("click", mapClickHandler);
        if (map.hasLayer(marker)) map.removeLayer(marker);
        if (map.hasLayer(radiusMarker)) map.removeLayer(radiusMarker);
        if (map.hasLayer(endMarker)) map.removeLayer(endMarker);
        if (map.hasLayer(rotatePin)) map.removeLayer(rotatePin);
        const rad = state.radius ?? 600;
        const edgePt = destinationPoint({ lat: state.lat, lng: state.lng }, rad, state.bearing ?? 0);
        rotatePin.setLatLng([edgePt.lat, edgePt.lng]);
        rotatePin.addTo(map);
        state._stUpdateOverlays?.();
      };

      state._stLeaveAngleMode = () => {
        segmentsMode = false;
        canhaoMode = false;
        angleMode = false;
        if (map.hasLayer(rotatePin)) map.removeLayer(rotatePin);
        if (!map.hasLayer(marker)) marker.addTo(map);
        if (!map.hasLayer(radiusMarker)) radiusMarker.addTo(map);
        map.on("click", mapClickHandler);
        state._stUpdateOverlays?.();
      };

      state._stEnterSegmentsMode = () => {
        segmentsMode = true;
        canhaoMode = false;
        angleMode = false;
        segBoundaryLayer.clearLayers();
        map.off("click", mapClickHandler);
        if (map.hasLayer(marker)) map.removeLayer(marker);
        if (map.hasLayer(radiusMarker)) map.removeLayer(radiusMarker);
        if (map.hasLayer(endMarker)) map.removeLayer(endMarker);
        if (map.hasLayer(rotatePin)) map.removeLayer(rotatePin);
        state._stUpdateOverlays?.();
      };

      state._stEnterCanhaoMode = () => {
        canhaoMode = true;
        segmentsMode = false;
        angleMode = false;
        segBoundaryLayer.clearLayers();
        map.off("click", mapClickHandler);
        if (map.hasLayer(marker)) map.removeLayer(marker);
        if (map.hasLayer(radiusMarker)) map.removeLayer(radiusMarker);
        if (map.hasLayer(endMarker)) map.removeLayer(endMarker);
        if (map.hasLayer(rotatePin)) map.removeLayer(rotatePin);
        state._stUpdateOverlays?.();
      };

      setPoint(start.lat, start.lng, false);
      setRadius(radius);

      setTimeout(() => map.invalidateSize(), 150);
    },

    renderConfigStep(container, state) {
      const _irrigAreaHa = state.radius > 0 ? (Math.PI * state.radius * state.radius / 10000).toFixed(2) : "";
      const _calcIR100 = (flowRate, maxSpeed, lastTowerDist, radius) => {
        if (!flowRate || !maxSpeed || !lastTowerDist || !radius) return "";
        return ((flowRate * (2 * Math.PI * lastTowerDist / maxSpeed)) / (Math.PI * radius * radius / 10000) * 0.1).toFixed(2);
      };
      const _irrigRateVal = _calcIR100(state.flowRate, state.maxSpeed, state.lastTowerDistance, state.radius);
      container.innerHTML = `
        <div class="sc-config">
          <div class="sc-config__grid" style="margin-bottom:16px;">
            <div class="sc-field">
              <label class="equip-label" for="stConfigDeviceName"><span class="equip-required">*</span>Nome do equipamento</label>
              <input type="text" class="equip-input" id="stConfigDeviceName" placeholder="SmartTouch 01" value="${escapeHtml(state.name || state.deviceName || "")}" />
              <div class="sc-error is-hidden">Este campo é obrigatório</div>
            </div>

            <div class="sc-field">
              <label class="equip-label" for="stConfigManufacturer"><span class="equip-required">*</span>Fabricante do equipamento</label>
              <select class="equip-input" id="stConfigManufacturer">
                <option value="bauer" ${(state.manufacturer || "bauer") === "bauer" ? "selected" : ""}>Bauer</option>
                <option value="valley" ${state.manufacturer === "valley" ? "selected" : ""}>Valley</option>
                <option value="irrigabras" ${state.manufacturer === "irrigabras" ? "selected" : ""}>Irrigabras</option>
                <option value="krebs" ${state.manufacturer === "krebs" ? "selected" : ""}>Krebs</option>
                <option value="carborundum" ${state.manufacturer === "carborundum" ? "selected" : ""}>Carborundum</option>
              </select>
              <div class="sc-error is-hidden">Este campo é obrigatório</div>
            </div>

            <div class="sc-field">
              <label class="equip-label" for="stConfigPanelType"><span class="equip-required">*</span>Tipo de painel</label>
              <select class="equip-input" id="stConfigPanelType">
                <option value="smarttouch" ${(state.panelType || "smarttouch") === "smarttouch" ? "selected" : ""}>SmartTouch</option>
                <option value="universaltouch" ${state.panelType === "universaltouch" ? "selected" : ""}>UniversalTouch</option>
              </select>
              <div class="sc-error is-hidden">Este campo é obrigatório</div>
            </div>
          </div>

          <div class="sc-config__grid">
            <div class="sc-field">
              <label class="equip-label" for="pivoEditLastTowerDistance"><span class="equip-required">*</span>Raio até a última torre <span class="edit-panel__tooltip-icon" data-tooltip="Distância do centro do pivô até a última torre (sem incluir o alcance do canhão/aspersor final)."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="pivoEditLastTowerDistance" type="text" inputmode="decimal" data-bound="1" value="${escapeHtml(state.lastTowerDistance ? Number(state.lastTowerDistance).toFixed(2) : "")}">
                <span class="sc-input-suffix">m</span>
              </div>
            </div>

            <div class="sc-field">
              <label class="equip-label" for="pivoEditSpeed"><span class="equip-required">*</span>Velocidade da última torre <span class="edit-panel__tooltip-icon" data-tooltip="Velocidade da última torre a 100%."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="pivoEditSpeed" type="text" inputmode="decimal" data-bound="1" value="${escapeHtml(String(state.maxSpeed || ""))}">
                <span class="sc-input-suffix">m/h</span>
              </div>
            </div>

            <div class="sc-field">
              <label class="equip-label" for="pivoEditLocRadius">Raio total irrigado <span class="edit-panel__tooltip-icon" data-tooltip="Distância do centro do pivô até o final do último tubo do pivô."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="pivoEditLocRadius" type="text" inputmode="decimal" data-loc-bound="1" value="${escapeHtml(state.radius ? Number(state.radius).toFixed(2) : "")}" readonly style="background:#f8fafc;color:#94a3b8;cursor:not-allowed;">
                <span class="sc-input-suffix">m</span>
              </div>
            </div>

            <div class="sc-field">
              <label class="equip-label" for="pivoEditMaxAngle">Ângulo máximo de trabalho <span class="edit-panel__tooltip-icon" data-tooltip="Define o ângulo máximo de trabalho do pivô. Use 360° para irrigação em círculo completo, ou um valor menor para um pivô setorial."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="pivoEditMaxAngle" type="text" inputmode="decimal" value="${escapeHtml(String(state.maxAngle || ""))}" readonly style="background:#f8fafc;color:#94a3b8;cursor:not-allowed;">
                <span class="sc-input-suffix">°</span>
              </div>
            </div>

            <div class="sc-field">
              <label class="equip-label" for="pivoEditIrrigArea">Área irrigada</label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="pivoEditIrrigArea" type="text" inputmode="decimal" value="${_irrigAreaHa}" readonly style="background:#f8fafc;color:#94a3b8;cursor:not-allowed;">
                <span class="sc-input-suffix">ha</span>
              </div>
            </div>
          </div>

          <div class="edit-panel__section-divider" style="margin-top: 32px;"></div>
          <div style="margin-top: 24px;">
            <h3 class="pref-section-title" style="margin-top: 0;">Autorreversão</h3>

            <div class="pivo-edit__switch-row" style="margin-top: 0;">
              <label for="pivoEditAutoRevEnabled" class="pivo-edit__check-label">Habilitar autorreversão</label>
              <label class="pivo-edit__switch">
                <input id="pivoEditAutoRevEnabled" type="checkbox" data-bound="1">
                <span class="pivo-edit__switch-slider"></span>
              </label>
            </div>
          </div>

          <div class="edit-panel__section-divider" style="margin-top: 32px;"></div>
          <div style="margin-top: 24px;">
            <div class="edit-panel__divider-label" style="border-top: none; padding-top: 0; margin-bottom: 16px;">Modo de Operação</div>

            <div style="display: flex; flex-direction: column; gap: 20px;">
              <!-- Opção Posição de parada -->
              <div style="display: flex; align-items: flex-start; gap: 12px;">
                <label class="sc-radio" style="cursor: pointer; margin-top: 26px;">
                  <input class="sc-radio__input" type="radio" name="pivoOpMode" value="stop">
                </label>
                <div style="flex: 1; max-width: 400px;">
                  <label for="pivoEditStopPos" style="display: block; font-size: 13px; color: #334155; margin-bottom: 6px;"><span class="edit-panel__req" style="color: #ef4444;">*</span> Posição de parada <span class="edit-panel__tooltip-icon" data-tooltip="Modo de estacionamento. O pivô se move até a posição de parada configurada e permanece estacionado nessa posição."><i class="fa-regular fa-circle-question"></i></span></label>
                  <div class="sc-input-group">
                    <input class="equip-input sc-input" id="pivoEditStopPos" type="text" inputmode="decimal" value="0">
                    <span class="sc-input-suffix">°</span>
                  </div>
                </div>
              </div>

              <!-- Opção Posição intermediária -->
              <div style="display: flex; align-items: flex-start; gap: 12px;">
                <label class="sc-radio" style="cursor: pointer; margin-top: 26px;">
                  <input class="sc-radio__input" type="radio" name="pivoOpMode" value="intermediate">
                </label>
                <div style="flex: 1; max-width: 400px;">
                  <label for="pivoEditInterPos" style="display: block; font-size: 13px; color: #334155; margin-bottom: 6px;"><span class="edit-panel__req" style="color: #ef4444;">*</span> Posição intermediária <span class="edit-panel__tooltip-icon" data-tooltip="Modo intermediário. O pivô se move até a posição intermediária configurada e permanece nessa posição."><i class="fa-regular fa-circle-question"></i></span></label>
                  <div class="sc-input-group">
                    <input class="equip-input sc-input" id="pivoEditInterPos" type="text" inputmode="decimal" value="0">
                    <span class="sc-input-suffix">°</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      this.bindConfigStep(container, state);
      if (window.IcEquipSelectInit) window.IcEquipSelectInit(container);
      return;

    },

    renderParcelList(container, state) {
      const listWrapper = container.querySelector("#stParcelList");
      const itemsContainer = container.querySelector("#stParcelItems");
      if (!itemsContainer || !listWrapper) return;

      state.parcels = normalizeParcels(state.parcels);

      if (state.parcels.length === 0) {
        listWrapper.style.display = "none";
        itemsContainer.innerHTML = "";
        return;
      }

      listWrapper.style.display = "flex";
      itemsContainer.innerHTML = state.parcels.map((parcel, index) => `
        <div class="st-parcel-item ${state._stEditIndex === index ? "is-editing" : ""}">
          <span class="st-parcel-name">${escapeHtml(parcel.name)}</span>
          <span class="st-parcel-date">${formatDate(parcel.plantingDate)}</span>
          <span class="st-parcel-angles">${parcel.startAngle}° a ${parcel.endAngle}°</span>
          <div class="st-parcel-actions">
            <button type="button" class="st-parcel-edit" data-index="${index}" title="Editar">
              <i class="fa-solid fa-pencil"></i>
            </button>
            <button type="button" class="st-parcel-remove" data-index="${index}" title="Remover">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
      `).join("");

      itemsContainer.querySelectorAll(".st-parcel-edit").forEach((btn) => {
        btn.onclick = () => {
          const index = Number(btn.dataset.index);
          const parcel = state.parcels[index];
          if (!parcel) return;

          state._stEditIndex = index;
          state.parcelName = parcel.name || parcel.deviceName || "";
          state.plantingDate = parcel.plantingDate || "";
          state.startAngle = String(parcel.startAngle ?? "");
          state.endAngle = String(parcel.endAngle ?? "");

          this.renderConfigStep(container, state);
        };
      });

      itemsContainer.querySelectorAll(".st-parcel-remove").forEach((btn) => {
        btn.onclick = () => {
          const index = Number(btn.dataset.index);
          if (state._stEditIndex === index) state._stEditIndex = null;
          state.parcels.splice(index, 1);
          this.renderParcelList(container, state);
          state._stUpdateParcels?.();
        };
      });
    },

    bindConfigStep(container, state) {
      const configNameInput = container.querySelector("#stConfigDeviceName");
      const configImeiInput = container.querySelector("#stConfigImei");
      if (configNameInput || configImeiInput) {
        if (configNameInput) {
          configNameInput.oninput = () => {
            state.name = configNameInput.value.trim();
          };
        }
        if (configImeiInput) {
          configImeiInput.oninput = () => {
            state.imei = configImeiInput.value.trim();
          };
        }

        const flowInput     = container.querySelector("#pivoEditFlow");
        const speedInput    = container.querySelector("#pivoEditSpeed");
        const distInput     = container.querySelector("#pivoEditLastTowerDistance");
        const irRateOutput  = container.querySelector("#pivoEditIrrigationRate");

        const recalcIR100 = () => {
          const flowRate       = parseFloat(flowInput?.value);
          const maxSpeed       = parseFloat(speedInput?.value);
          const lastTowerDist  = parseFloat(distInput?.value);
          const radius         = parseFloat(state.radius);
          if (!irRateOutput) return;
          if (flowRate > 0 && maxSpeed > 0 && lastTowerDist > 0 && radius > 0) {
            irRateOutput.value = ((flowRate * (2 * Math.PI * lastTowerDist / maxSpeed)) / (Math.PI * radius * radius / 10000) * 0.1).toFixed(2);
          } else {
            irRateOutput.value = "";
          }
          state.flowRate          = isNaN(flowRate) ? undefined : flowRate;
          state.maxSpeed          = isNaN(maxSpeed) ? undefined : maxSpeed;
          state.lastTowerDistance = isNaN(lastTowerDist) ? undefined : lastTowerDist;
        };

        [flowInput, speedInput, distInput].forEach(el => { if (el) el.oninput = recalcIR100; });
        return;
      }

      const selectPivot = container.querySelector("#stPivotId");
      const nameInput = container.querySelector("#stParcelName");
      const plantingDateInput = container.querySelector("#stPlantingDate");
      const startAngleInput = container.querySelector("#stStartAngle");
      const endAngleInput = container.querySelector("#stEndAngle");
      const addBtn = container.querySelector("#stAddParcel");

      const checkFields = () => {
        if (!addBtn) return;
        const hasAll =
          String(nameInput?.value || "").trim() &&
          String(startAngleInput?.value || "").trim() !== "" &&
          String(endAngleInput?.value || "").trim() !== "" &&
          String(selectPivot?.value || "").trim() !== "";
        addBtn.style.display = hasAll ? "flex" : "none";
      };

      const triggerMapUpdate = (currentAngles = null) => {
        state._stSyncWorkingGeometry?.();
        state._stUpdateParcels?.(currentAngles);
        checkFields();
      };

      if (nameInput) {
        nameInput.oninput = () => {
          state.parcelName = nameInput.value.trim();
          checkFields();
        };
      }

      if (plantingDateInput) {
        plantingDateInput.oninput = () => {
          state.plantingDate = plantingDateInput.value;
        };
      }

      if (startAngleInput) {
        startAngleInput.oninput = () => {
          state.startAngle = startAngleInput.value;
          triggerMapUpdate({
            startAngle: startAngleInput.value,
            endAngle: endAngleInput?.value || "",
          });
        };
      }

      if (endAngleInput) {
        endAngleInput.oninput = () => {
          state.endAngle = endAngleInput.value;
          triggerMapUpdate({
            startAngle: startAngleInput?.value || "",
            endAngle: endAngleInput.value,
          });
        };
      }

      if (addBtn) {
        addBtn.onclick = () => {
          const name = String(nameInput?.value || "").trim();
          const plantingDate = String(plantingDateInput?.value || "").trim();
          const startAngle = String(startAngleInput?.value || "").trim();
          const endAngle = String(endAngleInput?.value || "").trim();
          if (!name || startAngle === "" || endAngle === "") return;

          const nextParcel = {
            id: state._stEditIndex !== null && state.parcels[state._stEditIndex]?.id
              ? state.parcels[state._stEditIndex].id
              : `parcel_${Date.now()}`,
            name,
            deviceName: name,
            plantingDate,
            startAngle: normalizeAngle(startAngle, 0),
            endAngle: normalizeAngle(endAngle, 360),
          };

          if (state._stEditIndex !== null) {
            state.parcels[state._stEditIndex] = nextParcel;
            state._stEditIndex = null;
          } else {
            state.parcels.push(nextParcel);
          }

          state.parcelName = "";
          state.plantingDate = "";
          state.startAngle = "";
          state.endAngle = "";

          this.renderConfigStep(container, state);
        };
      }

      if (selectPivot && typeof window.IcGetPivotList === "function") {
        const pivots = window.IcGetPivotList() || [];
        state._allPivots = pivots;

        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Selecionar pivô";
        placeholder.disabled = true;
        placeholder.hidden = true;
        placeholder.selected = !state.linkedPivotId;
        selectPivot.appendChild(placeholder);

        pivots.forEach((pivot) => {
          const option = document.createElement("option");
          option.value = pivot.id;
          option.textContent = pivot.name || pivot.deviceName || `Pivô ${String(pivot.id || "").slice(0, 4)}`;
          if (state.linkedPivotId === pivot.id) option.selected = true;
          selectPivot.appendChild(option);
        });

        const updatePivotRef = (pivotId) => {
          state.linkedPivotId = pivotId;
          const pivot = pivots.find((item) => item.id === pivotId) || null;
          state._currentPivotData = pivot?.data || null;

          if ((!Number.isFinite(state.lat) || !Number.isFinite(state.lng)) && pivot?.data?.centerLat && pivot?.data?.centerLng) {
            state.lat = Number(pivot.data.centerLat);
            state.lng = Number(pivot.data.centerLng);
            state.loc = formatLatLng(state.lat, state.lng);
          }

          if (!Number.isFinite(parseRadius(state.radius)) && pivot?.data?.radius) {
            state.radius = parseRadius(pivot.data.radius);
          }

          state._stDrawPivot?.(state._currentPivotData);
          triggerMapUpdate();
        };

        if (state.linkedPivotId) updatePivotRef(state.linkedPivotId);
        selectPivot.onchange = (event) => {
          updatePivotRef(event.target.value);
          checkFields();
        };
      }

      triggerMapUpdate();
      checkFields();
    },

    initConfigMap(container, state) {
      if (!window.L) return;
      const mapEl = container.querySelector("#stConfigMap");
      if (!mapEl) return;

      if (state._stConfigMap) {
        try { state._stConfigMap.remove(); } catch (_) {}
        state._stConfigMap = null;
      }

      const start = getFallbackCenter(state);
      const map = L.map(mapEl, { zoomControl: false }).setView([start.lat, start.lng], 16);
      state._stConfigMap = map;

      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19 }).addTo(map);
      L.tileLayer("https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
        opacity: 0.7,
      }).addTo(map);

      let linkedPivotLayer = null;
      let workingCircle = null;
      let centerMarker = null;
      const divisionsLayer = L.featureGroup().addTo(map);

      const syncWorkingGeometry = () => {
        const lat = Number(state.lat);
        const lng = Number(state.lng);
        const radius = parseRadius(state.radius);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radius) || radius <= 0) return;

        if (!workingCircle) {
          workingCircle = L.circle([lat, lng], {
            radius,
            color: "#ffffff",
            weight: 2,
            fillColor: "#8b5cf6",
            fillOpacity: 0.16,
          }).addTo(map);
        } else {
          workingCircle.setLatLng([lat, lng]);
          workingCircle.setRadius(radius);
        }

        if (!centerMarker) centerMarker = L.marker([lat, lng], { icon: pinIcon() }).addTo(map);
        else centerMarker.setLatLng([lat, lng]);
      };

      state._stDrawPivot = (pivotData) => {
        if (linkedPivotLayer) {
          map.removeLayer(linkedPivotLayer);
          linkedPivotLayer = null;
        }

        const lat = Number(pivotData?.centerLat);
        const lng = Number(pivotData?.centerLng);
        const radius = Number(pivotData?.radius);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radius) || radius <= 0) return;

        const isSector = pivotData?.isSector === true || pivotData?.isSector === "true";
        if (isSector && pivotData?.startAngle !== undefined && pivotData?.endAngle !== undefined && pivotData?.refLat && pivotData?.refLng) {
          linkedPivotLayer = L.polygon(
            getArcPoints(lat, lng, radius, pivotData.startAngle, pivotData.endAngle, getBearingRefDeg(pivotData)),
            { color: "#8b5cf6", weight: 1.2, fillOpacity: 0.06 }
          ).addTo(map);
        } else {
          linkedPivotLayer = L.circle([lat, lng], {
            radius,
            color: "#8b5cf6",
            weight: 1.2,
            fillOpacity: 0.06,
          }).addTo(map);
        }
      };

      state._stUpdateParcels = (currentAngles = null) => {
        divisionsLayer.clearLayers();
        syncWorkingGeometry();

        const lat = Number(state.lat);
        const lng = Number(state.lng);
        const radius = parseRadius(state.radius);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radius) || radius <= 0) return;

        const bearingRefDeg = getBearingRefDeg(state._currentPivotData);
        const angles = new Set();

        normalizeParcels(state.parcels).forEach((parcel) => {
          angles.add(parcel.startAngle);
          angles.add(parcel.endAngle);
        });

        if (currentAngles?.startAngle !== "") angles.add(currentAngles.startAngle);
        if (currentAngles?.endAngle !== "") angles.add(currentAngles.endAngle);

        angles.forEach((angle) => {
          L.polyline(getLineCoords(lat, lng, radius, angle, bearingRefDeg), {
            color: "#111827",
            weight: 1,
            opacity: 0.8,
          }).addTo(divisionsLayer);
        });

        if (currentAngles?.startAngle !== "" && currentAngles?.endAngle !== "") {
          L.polyline(getLineCoords(lat, lng, radius, currentAngles.startAngle, bearingRefDeg), {
            color: "#2563eb",
            weight: 2,
            dashArray: "5,5",
          }).addTo(divisionsLayer);
          L.polyline(getLineCoords(lat, lng, radius, currentAngles.endAngle, bearingRefDeg), {
            color: "#2563eb",
            weight: 2,
            dashArray: "5,5",
          }).addTo(divisionsLayer);
        }
      };

      state._stSyncWorkingGeometry = syncWorkingGeometry;
      syncWorkingGeometry();
      state._stDrawPivot(state._currentPivotData);
      state._stUpdateParcels();

      setTimeout(() => map.invalidateSize(), 200);
    },

    readStep2(container, state) {
      if (getActiveStepLabel(container) === "Configuração") {
        return {
          name: String(state.name || state.deviceName || container.querySelector("#stConfigDeviceName")?.value || "Smart Touch").trim(),
          imei: String(state.imei || container.querySelector("#stConfigImei")?.value || "").trim(),
        };
      }

      return {
        name: String(state.name || "Smart Touch").trim() || "Smart Touch",
        loc: String(state.loc || formatLatLng(state.lat, state.lng) || "").trim(),
        lat: Number.isFinite(Number(state.lat)) ? Number(state.lat) : null,
        lng: Number.isFinite(Number(state.lng)) ? Number(state.lng) : null,
        radius: parseRadius(state.radius),
        linkedPivotId: String(state.linkedPivotId || "").trim(),
        parcels: normalizeParcels(state.parcels),
      };
    },

    validateStep2(data) {
      if ("imei" in data) {
        if (!String(data.name || "").trim()) {
          return { ok: false, msg: "Informe o nome do dispositivo." };
        }
        if (!String(data.imei || "").trim()) {
          return { ok: false, msg: "Informe o IMEI do dispositivo." };
        }
        return { ok: true };
      }

      if (!Number.isFinite(data.lat) || !Number.isFinite(data.lng)) {
        return { ok: false, msg: "Informe uma localização válida para o centro do Smart Touch." };
      }
      if (!Number.isFinite(data.radius) || data.radius <= 0) {
        return { ok: false, msg: "Informe um raio válido para a última torre." };
      }
      return { ok: true };
    },

    readStep3(container, state) {
      return {
        name: String(state.name || state.deviceName || container.querySelector("#stConfigDeviceName")?.value || "Smart Touch").trim(),
        imei: String(state.imei || container.querySelector("#stConfigImei")?.value || "").trim(),
      };
    },

    validateStep3(data) {
      if (!String(data.name || "").trim()) {
        return { ok: false, msg: "Informe o nome do dispositivo." };
      }
      if (!String(data.imei || "").trim()) {
        return { ok: false, msg: "Informe o IMEI do dispositivo." };
      }
      return { ok: true };
    }

  };
})();
