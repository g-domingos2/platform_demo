// assets/js/pages/equipamentos/smart-connect.js
(function () {
  "use strict";

  window.IcEquipamentos = window.IcEquipamentos || {};

  // escapeHtml/parseLatLng/formatLatLng/destinationPoint compartilhados — ver assets/js/core/geo-utils.js
  const { escapeHtml, parseLatLng, formatLatLng, destinationPoint } = window.IcGeo;

  function parseRadius(value) {
    const raw = String(value || "").replace(",", ".").trim();
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
  }

  const SC_SEG_PALETTE = [
    "rgb(0, 31, 153)", "rgb(160, 0, 229)", "rgb(0, 196, 179)",
    "rgb(82, 183, 0)", "rgb(255, 213, 0)", "rgb(255, 115, 0)",
    "rgb(142, 68, 173)", "rgb(22, 160, 133)", "rgb(233, 30, 99)",
  ];

  function normalizeAngleValue(value, fallback = 0) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return ((num % 360) + 360) % 360;
  }

  function bearingBetweenPoints(from, to) {
    const lat1 = from.lat * Math.PI / 180;
    const lon1 = from.lng * Math.PI / 180;
    const lat2 = to.lat * Math.PI / 180;
    const lon2 = to.lng * Math.PI / 180;
    const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  function pinIcon(type) {
    if (!window.L) return null;
    return L.divIcon({
      className: "",
      html: `
        <div class="pivot-pin pivot-pin--${type}">
          <i class="fa-solid fa-location-dot"></i>
        </div>
      `,
      iconSize: [28, 32],
      iconAnchor: [14, 32],
    });
  }

  // getActiveFarmEquipments compartilhado — ver assets/js/core/farm-utils.js
  const { getActiveFarmEquipments } = window.IcFarm;

  function buildSectorPoints(center, ref, radius, startAngle, endAngle) {
    if (!center || !ref || !Number.isFinite(radius) || radius <= 0) return [];
    const centerLL = L.latLng(center.lat, center.lng);
    let start = normalizeAngleValue(startAngle, 0);
    let end = normalizeAngleValue(endAngle, 360);
    if (end <= start) end += 360;

    const points = [centerLL];
    const refBearing = bearingBetweenPoints(center, ref);
    const step = 2;

    for (let angle = start; angle <= end; angle += step) {
      const point = destinationPoint(center, radius, refBearing + angle);
      points.push(L.latLng(point.lat, point.lng));
    }

    const exactEnd = destinationPoint(center, radius, refBearing + end);
    points.push(L.latLng(exactEnd.lat, exactEnd.lng));
    points.push(centerLL);
    return points;
  }

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
        type: equip.type,
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
        type: equip.type,
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
    const ghostStyle = {
      color: "#e5e7eb",
      weight: 1.2,
      fillColor: "#f8fafc",
      fillOpacity: 0.12,
      interactive: false,
    };
    const ghostCenterStyle = {
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
          const points = buildSectorPoints(pivot.center, pivot.ref, pivot.radius, pivot.startAngle, pivot.endAngle);
          if (points.length) L.polygon(points, ghostStyle).addTo(layer);
        } else {
          L.circle([pivot.center.lat, pivot.center.lng], {
            radius: pivot.radius,
            ...ghostStyle,
          }).addTo(layer);
        }

        L.circleMarker([pivot.center.lat, pivot.center.lng], ghostCenterStyle).addTo(layer);
      });

    return layer;
  }

  window.IcEquipamentos.smart_connect = {
    label: "Pivô Central",

    renderStep2(container, state) {
      const centerText = state.center || formatLatLng(state.centerLat, state.centerLng) || "";
      const radiusValue = Number.isFinite(Number(state.radius)) && Number(state.radius) > 0
        ? Number(state.radius).toFixed(2)
        : "600.00";

      container.innerHTML = `
        <div class="sc-loc sc-loc--vertical">
          <div class="sc-loc__top">
            <div class="sc-loc__grid">
              <div class="sc-loc__field" style="grid-column: 1 / -1;">
                <label class="sc-loc__label" for="scCenter"><span class="equip-required">*</span> Localização do centro</label>
                <div class="sc-loc__row">
                  <div class="sc-loc__input-wrapper">
                    <input class="equip-input sc-loc__input-field" id="scCenter" placeholder="-5.474444, -45.201627" value="${escapeHtml(centerText)}" />
                  </div>
                  <button class="equip-btn btn btn--outline sc-loc__btn" type="button" data-action="sc-get-loc">
                    <i class="fa-solid fa-location-dot" aria-hidden="true" style="color:#22c55e;"></i> Obter Localização
                  </button>
                </div>
              </div>

              <div class="sc-loc__field" style="grid-column: 1 / -1;">
                <label class="sc-loc__label" for="scRadius"><span class="equip-required">*</span> Raio total irrigado <span class="edit-panel__tooltip-icon" data-tooltip="Distância do centro do pivô até o final do último tubo do pivô."><i class="fa-regular fa-circle-question"></i></span></label>
                <div class="sc-loc__row">
                  <div class="sc-input-group" style="flex:1;">
                    <input class="equip-input sc-input" id="scRadius" type="text" inputmode="decimal" value="${escapeHtml(radiusValue)}" />
                    <span class="sc-input-suffix">m</span>
                  </div>
                  <button class="equip-btn btn btn--outline sc-loc__btn" type="button" data-action="sc-get-radius">
                    <i class="fa-solid fa-location-dot" style="color:#ef4444;" aria-hidden="true"></i> Obter Localização
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="sc-loc__map-wrapper" id="scMapSlot">
            <div id="scPivotMap" class="sc-loc__map"></div>
          </div>
        </div>
      `;

      if (state._scLocMap) {
        const mapEl = state._scLocMap.getContainer();
        const slot = container.querySelector("#scMapSlot");
        if (mapEl && slot) {
          const emptyMap = slot.querySelector("#scPivotMap");
          if (emptyMap) emptyMap.remove();
          slot.appendChild(mapEl);
          state._scLeaveAngleMode?.();
          setTimeout(() => {
            if (!state._scLocMap._mapPane) return;
            state._scLocMap.invalidateSize();
            state._scUpdateOverlays?.();
          }, 50);
          this.bindStep2(container, state);
          return;
        }
      }

      this.initMap(container, state);
      this.bindStep2(container, state);
      if (window.IcEquipSelectInit) window.IcEquipSelectInit(container);
    },

    bindStep2(container, state) {
      const centerInput = container.querySelector("#scCenter");
      const radiusInput = container.querySelector("#scRadius");

      const applyLocation = (lat, lng, setView = true) => {
        if (typeof state._scSetPoint === "function") {
          state._scSetPoint(lat, lng, setView);
          return;
        }
        state.centerLat = lat;
        state.centerLng = lng;
        state.center = formatLatLng(lat, lng);
        if (centerInput) centerInput.value = state.center;
      };

      const applyRadius = (value, opts = {}) => {
        const r = Number(String(value).replace(",", "."));
        if (!Number.isFinite(r) || r <= 0) return;
        state.radius = r;
        if (typeof state._scSetRadius === "function") state._scSetRadius(r);
        if (radiusInput && !opts.skipInput) radiusInput.value = r.toFixed(2);
        const locRadiusEl = document.getElementById("scLocRadius");
        if (locRadiusEl) locRadiusEl.value = r.toFixed(2);
        const irrigatedAreaEl = document.getElementById("scIrrigatedArea");
        if (irrigatedAreaEl) irrigatedAreaEl.value = (Math.PI * r * r / 10000).toFixed(2);
        if (typeof state._scRecalcIR === "function") state._scRecalcIR();
      };

      if (centerInput) {
        const syncFromInput = () => {
          const parsed = parseLatLng(centerInput.value);
          if (!parsed) return;
          applyLocation(parsed.lat, parsed.lng, true);
        };
        centerInput.addEventListener("change", syncFromInput);
        centerInput.addEventListener("blur", syncFromInput);
      }

      if (radiusInput) {
        radiusInput.addEventListener("input", () => applyRadius(radiusInput.value, { skipInput: true }));
        radiusInput.addEventListener("blur", () => applyRadius(radiusInput.value));
        if (!state.radius) applyRadius(radiusInput.value);
      }

      const locBtn = container.querySelector('[data-action="sc-get-loc"]');
      if (locBtn && navigator.geolocation) {
        locBtn.addEventListener("click", () => {
          locBtn.disabled = true;
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              applyLocation(pos.coords.latitude, pos.coords.longitude, true);
              locBtn.disabled = false;
            },
            () => { locBtn.disabled = false; },
            { enableHighAccuracy: true, timeout: 8000 }
          );
        });
      }

      const radiusBtn = container.querySelector('[data-action="sc-get-radius"]');
      if (radiusBtn && navigator.geolocation) {
        radiusBtn.addEventListener("click", () => {
          radiusBtn.disabled = true;
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude, longitude } = pos.coords;
              if (!Number.isFinite(state.centerLat) || !Number.isFinite(state.centerLng)) {
                radiusBtn.disabled = false;
                return;
              }
              const centerLL = L.latLng(state.centerLat, state.centerLng);
              const edgeLL = L.latLng(latitude, longitude);
              const newRadius = centerLL.distanceTo(edgeLL);
              if (newRadius >= 1) applyRadius(newRadius);
              if (state._scRadiusMarker) state._scRadiusMarker.setLatLng([latitude, longitude]);
              radiusBtn.disabled = false;
            },
            () => { radiusBtn.disabled = false; },
            { enableHighAccuracy: true, timeout: 8000 }
          );
        });
      }
    },

    initMap(container, state) {
      if (!window.L) return;

      const mapEl = container.querySelector("#scPivotMap");
      const centerInput = container.querySelector("#scCenter");
      const radiusInput = container.querySelector("#scRadius");
      if (!mapEl) return;

      if (state._pivotMap) {
        try { state._pivotMap.remove(); } catch (e) {}
        state._pivotMap = null;
      }

      let centerPoint = parseLatLng(centerInput?.value) || null;
      if (!centerPoint && Number.isFinite(state.centerLat) && Number.isFinite(state.centerLng)) {
        centerPoint = { lat: state.centerLat, lng: state.centerLng };
      }

      let radius = Number(state.radius) || 600;

      const fallback = { lat: -16.767, lng: -47.613 };
      const firstGhostPivot = getActiveFarmEquipments()
        .filter((e) => e?.type === "smart_connect" || e?.type === "smarttouch")
        .map(extractGhostPivot).find(Boolean);
      const basePoint = centerPoint || firstGhostPivot?.center || fallback;

      const map = L.map(mapEl, { zoomControl: false, keyboard: false }).setView([basePoint.lat, basePoint.lng], 15);
      state._pivotMap = map;
      map.createPane('whiteOverlay');
      map.getPane('whiteOverlay').style.zIndex = 450;
      map.getPane('whiteOverlay').style.pointerEvents = 'none';

      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, attribution: "Tiles \u00a9 Esri" }
      ).addTo(map);
      L.tileLayer(
        "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, opacity: 0.85 }
      ).addTo(map);

      renderGhostPivots(map, state.id);

      const stPin = (color) => L.divIcon({
        className: "",
        html: `<div class="st-pin" style="color:${color};"><i class="fa-solid fa-location-dot"></i></div>`,
        iconSize: [28, 32],
        iconAnchor: [14, 32],
      });

      const centerMarker = L.marker([basePoint.lat, basePoint.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div class="st-pin"><i class="fa-solid fa-location-dot"></i></div>`,
          iconSize: [28, 32],
          iconAnchor: [14, 32],
        }),
        draggable: true,
        zIndexOffset: 200,
      });

      // Preenchimento roxo no pane padrão (abaixo das linhas brancas)
      const circleFill = L.circle([basePoint.lat, basePoint.lng], {
        radius: centerPoint ? radius : 0,
        color: 'transparent', weight: 0,
        fillColor: '#8b5cf6', fillOpacity: 0.28,
      });
      // Borda branca no pane elevado (sempre visível acima do fill)
      const circle = L.circle([basePoint.lat, basePoint.lng], {
        radius: centerPoint ? radius : 0,
        color: '#ffffff', weight: 3, opacity: 1,
        fill: false,
        pane: 'whiteOverlay',
      });

      const tickLayer = L.layerGroup();
      const segmentLayer = L.layerGroup();
      const segBoundaryLayer = L.layerGroup();
      let isDraggingBoundary = false;

      const refLine = L.polyline([], { color: "#ffffff", weight: 2.5, opacity: 0, interactive: false, pane: 'whiteOverlay' });

      let currentBearing = 270;
      let radiusDragging = false;
      let segmentsMode = false;
      let canhaoMode = false;

      const getRadiusMarkerPos = (cp, rad) => {
        const p = destinationPoint(cp, rad, currentBearing);
        return [p.lat, p.lng];
      };

      const radiusMarker = L.marker(
        centerPoint ? getRadiusMarkerPos(centerPoint, radius) : [basePoint.lat, basePoint.lng],
        { icon: stPin("#ef4444"), draggable: true, zIndexOffset: 100 }
      );

      // Preenchimento do setor no pane padrão
      const sectorFill = L.polygon([], {
        color: 'transparent', weight: 0,
        fillColor: '#8b5cf6', fillOpacity: 0.28,
      });
      // Borda branca do setor no pane elevado
      const sectorPolygon = L.polygon([], {
        color: '#ffffff', weight: 3, opacity: 1,
        fill: false,
        pane: 'whiteOverlay',
      });

      let angleMode = false;
      let rotateDragging = false;

      const buildSectorPts = (cp, rad, bearing, maxAng) => {
        const pts = [L.latLng(cp.lat, cp.lng)];
        for (let i = 0; i <= maxAng; i += 2) {
          const pt = destinationPoint(cp, rad, (bearing + i) % 360);
          pts.push(L.latLng(pt.lat, pt.lng));
        }
        const endPt = destinationPoint(cp, rad, (bearing + maxAng) % 360);
        pts.push(L.latLng(endPt.lat, endPt.lng));
        pts.push(L.latLng(cp.lat, cp.lng));
        return pts;
      };

      const rotatePin = L.marker([basePoint.lat, basePoint.lng], {
        icon: stPin("#ef4444"), draggable: true, zIndexOffset: 300,
      });

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
      const angleZeroTriangle = L.marker([basePoint.lat, basePoint.lng], {
        icon: angleTriangleIcon(0), interactive: false, zIndexOffset: 250,
      });

      const drawShape = (cp, rad) => {
        if (!cp) return;
        // Triângulo do ângulo zero aparece no passo Ângulo, Segmentos e Canhão
        if (!angleMode && !segmentsMode && !canhaoMode && angleZeroTriangle._map) map.removeLayer(angleZeroTriangle);
        const bearing = state.bearing ?? 0;
        const maxAngle = Number(state.maxAngle ?? 360);
        const validMax = Number.isFinite(maxAngle) && maxAngle >= 1 ? maxAngle : 360;

        if (canhaoMode) {
          const refEdgeCanhao = destinationPoint(cp, rad, bearing);
          refLine.setLatLngs([[cp.lat, cp.lng], [refEdgeCanhao.lat, refEdgeCanhao.lng]]);
          segmentLayer.clearLayers();
          if (circleFill._map) map.removeLayer(circleFill);
          if (sectorFill._map) map.removeLayer(sectorFill);
          // Segmentos do canhão em azul
          (state.canhaoSegments || []).forEach((seg, i) => {
            const isAct = i === (state.activeCanhaoSegIdx ?? 0);
            const color = SC_SEG_PALETTE[i % SC_SEG_PALETTE.length];
            const span = (seg.endAngle ?? 0) - (seg.startAngle ?? 0);
            if (span <= 0) return;
            L.polygon(buildSectorPts(cp, rad, (bearing + (seg.startAngle ?? 0) + 360) % 360, span), {
              color: '#ffffff', weight: isAct ? 2 : 1,
              fillColor: color, fillOpacity: isAct ? 0.85 : 0.65,
              interactive: false,
            }).addTo(segmentLayer);
          });
          // Borda branca e ticks por cima
          if (validMax >= 360) {
            circle.setLatLng([cp.lat, cp.lng]);
            circle.setRadius(rad);
            circle.setStyle({ color: "#ffffff", opacity: 1, weight: 2, fillOpacity: 0 });
            if (!circle._map) circle.addTo(map);
            if (sectorPolygon._map) map.removeLayer(sectorPolygon);
            circle.bringToFront();
          } else {
            circle.setStyle({ opacity: 0, fillOpacity: 0 });
            sectorPolygon.setLatLngs(buildSectorPts(cp, rad, bearing, validMax));
            sectorPolygon.setStyle({ color: "#ffffff", opacity: 1, weight: 3, fillOpacity: 0 });
            if (!sectorPolygon._map) sectorPolygon.addTo(map);
            sectorPolygon.bringToFront();
          }
          tickLayer.clearLayers();
          const innerRc = rad * 0.92;
          for (let i = 0; i <= validMax; i += 5) {
            const brg = (bearing + i) % 360;
            const outer = destinationPoint(cp, rad, brg);
            const inner = destinationPoint(cp, innerRc, brg);
            L.polyline([[outer.lat, outer.lng], [inner.lat, inner.lng]], {
              color: "#ffffff", weight: 2, opacity: 1, interactive: false, pane: 'whiteOverlay',
            }).addTo(tickLayer);
          }
          tickLayer.eachLayer((l) => l.bringToFront?.());

          // Marcadores arrastáveis por segmento de canhão (start + end)
          if (!isDraggingBoundary) {
            segBoundaryLayer.clearLayers();
            const cSegs = state.canhaoSegments || [];
            cSegs.forEach((seg, si) => {
              const color = SC_SEG_PALETTE[si % SC_SEG_PALETTE.length];
              const minSpan = 3;

              const makeDot = (isStart) => {
                const angle = isStart ? (seg.startAngle ?? 0) : (seg.endAngle ?? 0);
                const pos = destinationPoint(cp, rad, (bearing + angle + 360) % 360);
                const dot = L.marker([pos.lat, pos.lng], {
                  icon: L.divIcon({
                    className: '',
                    html: `<div style="width:16px;height:16px;background:#fff;border:3px solid ${color};border-radius:50%;cursor:grab;box-shadow:0 2px 6px rgba(0,0,0,0.45);"></div>`,
                    iconSize: [16, 16], iconAnchor: [8, 8],
                  }),
                  draggable: true,
                  zIndexOffset: 600,
                });
                dot.on('dragstart', () => { isDraggingBoundary = true; });
                dot.on('drag', (e) => {
                  let rawBrg = bearingBetweenPoints(cp, e.target.getLatLng());
                  let newAngle = ((rawBrg - bearing) % 360 + 360) % 360;
                  if (isStart) {
                    if (newAngle > 180) newAngle -= 360;
                    const hiS = (seg.endAngle ?? 0) - minSpan;
                    const loS = si > 0
                      ? (cSegs[si - 1].endAngle ?? 0) + minSpan
                      : cSegs.length > 1
                        ? (cSegs[cSegs.length - 1].endAngle ?? validMax) - validMax + minSpan
                        : (seg.endAngle ?? 0) - (validMax - minSpan);
                    newAngle = Math.round(Math.max(loS, Math.min(hiS, newAngle)));
                    seg.startAngle = newAngle;
                  } else {
                    const loE = (seg.startAngle ?? 0) + minSpan;
                    const hiE = si < cSegs.length - 1
                      ? (cSegs[si + 1].startAngle ?? validMax) - minSpan
                      : cSegs.length > 1
                        ? (cSegs[0].startAngle ?? 0) + validMax - minSpan
                        : validMax;
                    newAngle = Math.round(Math.max(loE, Math.min(hiE, newAngle)));
                    seg.endAngle = newAngle;
                  }
                  e.target.setLatLng(destinationPoint(cp, rad, (bearing + newAngle + 360) % 360));
                  segmentLayer.clearLayers();
                  cSegs.forEach((s, i) => {
                    const isAct2 = i === (state.activeCanhaoSegIdx ?? 0);
                    const c = SC_SEG_PALETTE[i % SC_SEG_PALETTE.length];
                    const sp = (s.endAngle ?? 0) - (s.startAngle ?? 0);
                    if (sp <= 0) return;
                    L.polygon(buildSectorPts(cp, rad, (bearing + (s.startAngle ?? 0) + 360) % 360, sp), {
                      color: '#ffffff', weight: isAct2 ? 2 : 1,
                      fillColor: c, fillOpacity: isAct2 ? 0.85 : 0.65,
                      interactive: false,
                    }).addTo(segmentLayer);
                  });
                  if (circle._map) circle.bringToFront();
                  if (sectorPolygon._map) sectorPolygon.bringToFront();
                  tickLayer.eachLayer((l) => l.bringToFront?.());
                  refLine.bringToFront();
                  if (si === (state.activeCanhaoSegIdx ?? 0)) {
                    const startEl = document.querySelector('#scCanhaoStart');
                    const endEl = document.querySelector('#scCanhaoEnd');
                    if (isStart && startEl) startEl.value = String(seg.startAngle);
                    if (!isStart && endEl) endEl.value = String(seg.endAngle);
                  }
                });
                dot.on('dragend', () => {
                  isDraggingBoundary = false;
                  drawShape(cp, rad);
                });
                dot.addTo(segBoundaryLayer);
              };

              makeDot(true);
              makeDot(false);
            });
          }
          segBoundaryLayer.eachLayer((l) => l.bringToFront?.());
          const triEdgeCanhao = destinationPoint(cp, rad * 0.95, bearing);
          angleZeroTriangle.setIcon(angleTriangleIcon((bearing + 180) % 360));
          angleZeroTriangle.setLatLng([triEdgeCanhao.lat, triEdgeCanhao.lng]);
          if (!angleZeroTriangle._map) angleZeroTriangle.addTo(map);
          angleZeroTriangle.bringToFront?.();
          return;
        }

        if (segmentsMode) {
          const refEdgeSeg = destinationPoint(cp, rad, bearing);
          refLine.setLatLngs([[cp.lat, cp.lng], [refEdgeSeg.lat, refEdgeSeg.lng]]);
          segmentLayer.clearLayers();
          if (circleFill._map) map.removeLayer(circleFill);
          if (sectorFill._map) map.removeLayer(sectorFill);
          const segs = state.segments || [];
          segs.forEach((seg, i) => {
            const isAct = i === (state.activeSegIdx ?? 0);
            const color = SC_SEG_PALETTE[i % SC_SEG_PALETTE.length];
            const span = (seg.endAngle ?? 0) - (seg.startAngle ?? 0);
            if (span <= 0) return;
            const startBrg = (bearing + (seg.startAngle ?? 0) + 360) % 360;
            const pts = buildSectorPts(cp, rad, startBrg, span);
            L.polygon(pts, {
              color: '#ffffff', opacity: 0, weight: isAct ? 2 : 1,
              fillColor: color, fillOpacity: isAct ? 0.85 : 0.65,
              interactive: false,
            }).addTo(segmentLayer);
          });

          // Borda branca e ticks por cima dos segmentos
          if (validMax >= 360) {
            circle.setLatLng([cp.lat, cp.lng]);
            circle.setRadius(rad);
            circle.setStyle({ color: "#ffffff", opacity: 1, weight: 2, fillOpacity: 0 });
            if (!circle._map) circle.addTo(map);
            if (sectorPolygon._map) map.removeLayer(sectorPolygon);
            circle.bringToFront();
          } else {
            circle.setStyle({ opacity: 0, fillOpacity: 0 });
            sectorPolygon.setLatLngs(buildSectorPts(cp, rad, bearing, validMax));
            sectorPolygon.setStyle({ color: "#ffffff", opacity: 1, weight: 3, fillOpacity: 0 });
            if (!sectorPolygon._map) sectorPolygon.addTo(map);
            sectorPolygon.bringToFront();
          }

          tickLayer.clearLayers();
          const innerR = rad * 0.92;
          for (let i = 0; i <= validMax; i += 5) {
            const brg = (bearing + i) % 360;
            const outer = destinationPoint(cp, rad, brg);
            const inner = destinationPoint(cp, innerR, brg);
            L.polyline([[outer.lat, outer.lng], [inner.lat, inner.lng]], {
              color: "#ffffff", weight: 2, opacity: 1, interactive: false, pane: 'whiteOverlay',
            }).addTo(tickLayer);
          }
          tickLayer.eachLayer((l) => l.bringToFront?.());

          // Marcadores arrastáveis nas fronteiras entre segmentos
          if (!isDraggingBoundary) {
            segBoundaryLayer.clearLayers();
            const minSpan = 3;

            const reRenderSegs = () => {
              segmentLayer.clearLayers();
              segs.forEach((seg, i) => {
                const isAct2 = i === (state.activeSegIdx ?? 0);
                const c = SC_SEG_PALETTE[i % SC_SEG_PALETTE.length];
                const sp = (seg.endAngle ?? 0) - (seg.startAngle ?? 0);
                if (sp <= 0) return;
                L.polygon(buildSectorPts(cp, rad, (bearing + (seg.startAngle ?? 0) + 360) % 360, sp), {
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
              const zeroPos = destinationPoint(cp, rad, (bearing + zeroAngle + 360) % 360);
              const zeroDot = L.marker([zeroPos.lat, zeroPos.lng], {
                icon: L.divIcon({
                  className: '',
                  html: `<div style="width:14px;height:14px;background:#fff;border:3px solid #94a3b8;border-radius:50%;cursor:grab;box-shadow:0 0 4px rgba(0,0,0,.4);"></div>`,
                  iconSize: [16, 16], iconAnchor: [8, 8],
                }),
                draggable: true,
                zIndexOffset: 700,
              });
              zeroDot.on('dragstart', () => { isDraggingBoundary = true; });
              zeroDot.on('drag', (e) => {
                let rawBrg = bearingBetweenPoints(cp, e.target.getLatLng());
                let relAngle = ((rawBrg - bearing) % 360 + 360) % 360;
                if (relAngle > 180) relAngle -= 360;
                const lo = (segs[lastIdx].startAngle ?? 0) + minSpan - validMax;
                const hi = (segs[0].endAngle ?? minSpan) - minSpan;
                const newStart = Math.round(Math.max(lo, Math.min(hi, relAngle)));
                const delta = newStart - (segs[0].startAngle ?? 0);
                segs[0].startAngle = newStart;
                segs[lastIdx].endAngle = (segs[lastIdx].endAngle ?? validMax) + delta;
                e.target.setLatLng(destinationPoint(cp, rad, (bearing + newStart + 360) % 360));
                reRenderSegs();
                const activeIdx = state.activeSegIdx ?? 0;
                if (activeIdx === 0) {
                  const startEl = document.querySelector('#scSegStart');
                  if (startEl) startEl.value = String(newStart);
                }
                if (activeIdx === lastIdx) {
                  const endEl = document.querySelector('#scSegEnd');
                  if (endEl) endEl.value = String(segs[lastIdx].endAngle);
                }
              });
              zeroDot.on('dragend', () => {
                isDraggingBoundary = false;
                drawShape(cp, rad);
              });
              zeroDot.addTo(segBoundaryLayer);
            }

            // Dots nas fronteiras entre segmentos adjacentes
            for (let bi = 0; bi < segs.length - 1; bi++) {
              const boundaryAngle = segs[bi].endAngle ?? 0;
              const bPos = destinationPoint(cp, rad, (bearing + boundaryAngle + 360) % 360);
              const bColor = SC_SEG_PALETTE[bi % SC_SEG_PALETTE.length];
              const capturedBi = bi;
              const dot = L.marker([bPos.lat, bPos.lng], {
                icon: L.divIcon({
                  className: '',
                  html: `<div style="width:16px;height:16px;background:#fff;border:3px solid ${bColor};border-radius:50%;cursor:grab;box-shadow:0 2px 6px rgba(0,0,0,0.45);"></div>`,
                  iconSize: [16, 16], iconAnchor: [8, 8],
                }),
                draggable: true,
                zIndexOffset: 600,
              });
              dot.on('dragstart', () => { isDraggingBoundary = true; });
              dot.on('drag', (e) => {
                let rawBrg = bearingBetweenPoints(cp, e.target.getLatLng());
                let newAngle = ((rawBrg - bearing) % 360 + 360) % 360;
                const lo = (segs[capturedBi].startAngle ?? 0) + minSpan;
                const hi = (segs[capturedBi + 1].endAngle ?? validMax) - minSpan;
                newAngle = Math.round(Math.max(lo, Math.min(hi, newAngle)));
                segs[capturedBi].endAngle = newAngle;
                segs[capturedBi + 1].startAngle = newAngle;
                e.target.setLatLng(destinationPoint(cp, rad, (bearing + newAngle + 360) % 360));
                reRenderSegs();
                const activeIdx = state.activeSegIdx ?? 0;
                const startEl = document.querySelector('#scSegStart');
                const endEl = document.querySelector('#scSegEnd');
                if (activeIdx === capturedBi && endEl) endEl.value = String(newAngle);
                if (activeIdx === capturedBi + 1 && startEl) startEl.value = String(newAngle);
              });
              dot.on('dragend', () => {
                isDraggingBoundary = false;
                drawShape(cp, rad);
              });
              dot.addTo(segBoundaryLayer);
            }
          }
          segBoundaryLayer.eachLayer((l) => l.bringToFront?.());
          return;
        }

        if (validMax >= 360) {
          circle.setLatLng([cp.lat, cp.lng]);
          circle.setRadius(rad);
          circle.setStyle({ opacity: 1, weight: 2, fillOpacity: 0 });
          circleFill.setLatLng([cp.lat, cp.lng]);
          circleFill.setRadius(rad);
          circleFill.setStyle({ fillOpacity: 0.28 });
          if (!circleFill._map) circleFill.addTo(map);
          if (sectorPolygon._map) map.removeLayer(sectorPolygon);
          if (sectorFill._map) map.removeLayer(sectorFill);
        } else {
          circle.setStyle({ opacity: 0, fillOpacity: 0 });
          if (circleFill._map) map.removeLayer(circleFill);
          sectorPolygon.setLatLngs(buildSectorPts(cp, rad, bearing, validMax));
          sectorPolygon.setStyle({ opacity: 1, weight: 2, fillOpacity: 0 });
          sectorFill.setLatLngs(buildSectorPts(cp, rad, bearing, validMax));
          sectorFill.setStyle({ fillOpacity: 0.28 });
          if (!sectorFill._map && circle._map) sectorFill.addTo(map);
          if (!sectorPolygon._map && circle._map) sectorPolygon.addTo(map);
        }

        tickLayer.clearLayers();
        const innerR = rad * 0.92;
        for (let i = 0; i <= validMax; i += 5) {
          const brg = (bearing + i) % 360;
          const outer = destinationPoint(cp, rad, brg);
          const inner = destinationPoint(cp, innerR, brg);
          L.polyline([[outer.lat, outer.lng], [inner.lat, inner.lng]], {
            color: "#ffffff", weight: 2, opacity: 1, interactive: false, pane: 'whiteOverlay',
          }).addTo(tickLayer);
        }

        const refEdge = destinationPoint(cp, rad, bearing);
        if (angleMode) {
          const angleInp = document.getElementById("scAngleLatLng");
          if (angleInp && document.activeElement !== angleInp) {
            angleInp.value = formatLatLng(refEdge.lat, refEdge.lng);
          }
        }
        if (angleMode || segmentsMode || canhaoMode) {
          if (angleMode) refLine.setLatLngs([[cp.lat, cp.lng], [refEdge.lat, refEdge.lng]]);
          const triEdge = destinationPoint(cp, rad * 0.95, bearing);
          angleZeroTriangle.setIcon(angleTriangleIcon((bearing + 180) % 360));
          angleZeroTriangle.setLatLng([triEdge.lat, triEdge.lng]);
          if (!angleZeroTriangle._map) angleZeroTriangle.addTo(map);
        } else {
          refLine.setLatLngs([]);
          if (angleZeroTriangle._map) map.removeLayer(angleZeroTriangle);
        }

        if (angleMode && !rotateDragging) rotatePin.setLatLng([refEdge.lat, refEdge.lng]);
        if (!angleMode && !radiusDragging) radiusMarker.setLatLng(getRadiusMarkerPos(cp, rad));
      };

      if (centerPoint) {
        centerMarker.addTo(map);
        circleFill.addTo(map);
        circle.addTo(map);
        tickLayer.addTo(map);
        refLine.addTo(map);
        radiusMarker.addTo(map);
        if (centerInput) centerInput.value = formatLatLng(centerPoint.lat, centerPoint.lng);
        drawShape(centerPoint, radius);
      } else {
        centerMarker.addTo(map);
      }

      const mapClickHandler = (e) => setPoint(e.latlng.lat, e.latlng.lng, false);

      const setPoint = (lat, lng, setView = true) => {
        centerPoint = { lat, lng };
        centerMarker.setLatLng([lat, lng]);
        if (centerInput) centerInput.value = formatLatLng(lat, lng);
        state.center = formatLatLng(lat, lng);
        state.centerLat = lat;
        state.centerLng = lng;
        if (setView) map.setView([lat, lng], map.getZoom());

        if (!circle._map) {
          circleFill.addTo(map);
          circle.addTo(map);
          tickLayer.addTo(map);
          refLine.addTo(map);
          radiusMarker.addTo(map);
        }
        drawShape(centerPoint, radius);
      };

      const setRadius = (r) => {
        radius = r;
        state.radius = r;
        if (radiusInput) radiusInput.value = String(Math.round(r));
        if (centerPoint) drawShape(centerPoint, r);
      };

      centerMarker.on("drag", (e) => {
        const { lat, lng } = e.target.getLatLng();
        setPoint(lat, lng, false);
      });

      radiusMarker.on("dragstart", () => { radiusDragging = true; });
      radiusMarker.on("drag", () => {
        if (!centerPoint) return;
        const pos = radiusMarker.getLatLng();
        const newR = L.latLng(centerPoint.lat, centerPoint.lng).distanceTo(pos);
        if (newR >= 1) {
          radius = newR;
          state.radius = newR;
          if (radiusInput) radiusInput.value = String(Math.round(newR));
          currentBearing = bearingBetweenPoints(centerPoint, { lat: pos.lat, lng: pos.lng });
          state.bearing = currentBearing;
          const angleInput = document.getElementById("scAngleLatLng");
          if (angleInput && document.activeElement !== angleInput) {
            const onCircle = destinationPoint(centerPoint, radius, currentBearing);
            angleInput.value = formatLatLng(onCircle.lat, onCircle.lng);
          }
          drawShape(centerPoint, radius);
        }
      });
      radiusMarker.on("dragend", () => {
        radiusDragging = false;
        if (centerPoint) drawShape(centerPoint, radius);
      });

      rotatePin.on("dragstart", () => { rotateDragging = true; });
      rotatePin.on("drag", () => {
        if (!centerPoint) return;
        const brg = bearingBetweenPoints(centerPoint, rotatePin.getLatLng());
        state.bearing = brg;
        // Mantém o pin preso à linha do raio (só gira, não entra/sai do raio)
        const onCircle = destinationPoint(centerPoint, radius, brg);
        rotatePin.setLatLng([onCircle.lat, onCircle.lng]);
        const angleInput = document.getElementById("scAngleLatLng");
        if (angleInput && document.activeElement !== angleInput) {
          angleInput.value = formatLatLng(onCircle.lat, onCircle.lng);
        }
        drawShape(centerPoint, radius);
      });
      rotatePin.on("dragend", () => {
        rotateDragging = false;
        if (centerPoint) drawShape(centerPoint, radius);
      });

      map.on("click", mapClickHandler);

      state._scEnterAngleMode = () => {
        segmentsMode = false;
        canhaoMode = false;
        angleMode = true;
        segmentLayer.clearLayers();
        segBoundaryLayer.clearLayers();
        map.off("click", mapClickHandler);
        if (map.hasLayer(centerMarker)) map.removeLayer(centerMarker);
        if (map.hasLayer(radiusMarker)) map.removeLayer(radiusMarker);
        if (map.hasLayer(rotatePin)) map.removeLayer(rotatePin);
        if (centerPoint) {
          const bearing = state.bearing ?? 0;
          const refEdge = destinationPoint(centerPoint, radius, bearing);
          rotatePin.setLatLng([refEdge.lat, refEdge.lng]);
          rotatePin.addTo(map);
          if (!circle._map) circle.addTo(map);
          if (!tickLayer._map) tickLayer.addTo(map);
          if (!refLine._map) refLine.addTo(map);
          drawShape(centerPoint, radius);
        }
      };

      state._scLeaveAngleMode = () => {
        segmentsMode = false;
        angleMode = false;
        if (map.hasLayer(rotatePin)) map.removeLayer(rotatePin);
        if (!map.hasLayer(centerMarker)) centerMarker.addTo(map);
        if (centerPoint && !map.hasLayer(radiusMarker)) radiusMarker.addTo(map);
        map.on("click", mapClickHandler);
        if (centerPoint) drawShape(centerPoint, radius);
      };

      state._scEnterSegmentsMode = () => {
        segmentsMode = true;
        canhaoMode = false;
        angleMode = false;
        map.off("click", mapClickHandler);
        if (map.hasLayer(centerMarker)) map.removeLayer(centerMarker);
        if (map.hasLayer(radiusMarker)) map.removeLayer(radiusMarker);
        if (map.hasLayer(rotatePin)) map.removeLayer(rotatePin);
        if (!circle._map) circle.addTo(map);
        if (!tickLayer._map) tickLayer.addTo(map);
        if (!segmentLayer._map) segmentLayer.addTo(map);
        if (!segBoundaryLayer._map) segBoundaryLayer.addTo(map);
        if (!refLine._map) refLine.addTo(map);
        if (centerPoint) drawShape(centerPoint, radius);
      };

      state._scEnterCanhaoMode = () => {
        canhaoMode = true;
        segmentsMode = false;
        angleMode = false;
        segBoundaryLayer.clearLayers();
        map.off("click", mapClickHandler);
        if (map.hasLayer(centerMarker)) map.removeLayer(centerMarker);
        if (map.hasLayer(radiusMarker)) map.removeLayer(radiusMarker);
        if (map.hasLayer(rotatePin)) map.removeLayer(rotatePin);
        if (!circle._map) circle.addTo(map);
        if (!tickLayer._map) tickLayer.addTo(map);
        if (!segmentLayer._map) segmentLayer.addTo(map);
        if (!refLine._map) refLine.addTo(map);
        if (centerPoint) drawShape(centerPoint, radius);
      };

      state._scUpdateOverlays = () => {
        if (centerPoint) {
          drawShape(centerPoint, radius);
          const angleInput = document.getElementById("scAngleLatLng");
          if (angleInput && document.activeElement !== angleInput) {
            const refPoint = destinationPoint(centerPoint, radius, state.bearing ?? 0);
            angleInput.value = formatLatLng(refPoint.lat, refPoint.lng);
          }
        }
      };

      state._scSetPoint = setPoint;
      state._scSetRadius = setRadius;
      state._scRadiusMarker = radiusMarker;
      state._scLocMap = map;

      setTimeout(() => map.invalidateSize(), 120);
    },

    renderCanhaoStep(container, state) {
      const maxAngle = Number(state.maxAngle ?? 360);
      const validMax = Number.isFinite(maxAngle) && maxAngle >= 1 ? maxAngle : 360;

      if (!state.canhaoSegments) state.canhaoSegments = [];
      if (state.activeCanhaoSegIdx === undefined) state.activeCanhaoSegIdx = 0;
      if (!state.canhaoMode) state.canhaoMode = "off";

      container.innerHTML = `
        <div class="pivo-edit__segments-section pivo-edit-specifics">
          <div class="pivo-edit__field" style="margin-bottom:16px;">
            <label for="scCanhaoMode">Modo de acionamento</label>
            <select class="equip-input" id="scCanhaoMode">
              <option value="off" ${state.canhaoMode === "off" ? "selected" : ""}>Sempre desligado</option>
              <option value="on" ${state.canhaoMode === "on" ? "selected" : ""}>Sempre ligado</option>
              <option value="segment" ${state.canhaoMode === "segment" ? "selected" : ""}>Ligado por segmento</option>
            </select>
          </div>

          <div id="scCanhaoSegmentsWrap" style="display:${state.canhaoMode === "segment" ? "" : "none"};">
            <p style="font-size:13px;color:#121829;line-height:1.4;margin:0 0 12px;">
              Personalize o acionamento do canhão final de acordo com o ângulo do pivô para evitar irrigação em locais impróprios.
            </p>
            <div style="background:#eff6ff;border:1px solid #bfdbfe;color: #121829;padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
              <i class="fa-solid fa-circle-info" style="color:#3b82f6;"></i>
              Você pode criar até 9 segmentos. Configure os ângulos onde o canhão deve ligar.
            </div>
            <h3 style="font-size:14px;margin:0 0 10px;color:#0f172a;font-weight:400;">Segmentos com canhão ativo</h3>
            <div id="scCanhaoSegList" style="display:flex;gap:8px;margin-bottom:16px;align-items:center;flex-wrap:wrap;"></div>
            <div class="edit-panel__grid-3" style="grid-template-columns:1fr 1fr;gap:16px;">
              <div class="pivo-edit__field">
                <label for="scCanhaoStart">Ângulo inicial</label>
                <div class="sc-input-group">
                  <input class="equip-input sc-input" id="scCanhaoStart" type="text" inputmode="decimal" placeholder="Ex: 270">
                  <span class="sc-input-suffix">°</span>
                </div>
                <div style="font-size:10px;color:#94a3b8;margin-top:4px;"><span>Máximo de</span> ${validMax}</div>
              </div>
              <div class="pivo-edit__field">
                <label for="scCanhaoEnd">Ângulo final</label>
                <div class="sc-input-group">
                  <input class="equip-input sc-input" id="scCanhaoEnd" type="text" inputmode="decimal" placeholder="Ex: 90">
                  <span class="sc-input-suffix">°</span>
                </div>
                <div style="font-size:10px;color:#94a3b8;margin-top:4px;"><span>Máximo de</span> ${validMax}</div>
              </div>
            </div>
          </div>
        </div>
        <div id="scCanhaoMapSlot" class="sc-loc__map-wrapper" style="margin-top:14px;display:${state.canhaoMode === "segment" ? "" : "none"};"></div>
      `;

      this.bindCanhaoStep(container, state);

      const modeSelect = container.querySelector("#scCanhaoMode");
      const segmentsWrap = container.querySelector("#scCanhaoSegmentsWrap");
      const mapSlot = container.querySelector("#scCanhaoMapSlot");
      if (modeSelect) {
        modeSelect.addEventListener("change", () => {
          state.canhaoMode = modeSelect.value;
          const isSegment = state.canhaoMode === "segment";
          if (segmentsWrap) segmentsWrap.style.display = isSegment ? "" : "none";
          if (mapSlot) mapSlot.style.display = isSegment ? "" : "none";
          if (isSegment && state._scLocMap) {
            const mapEl = state._scLocMap.getContainer();
            if (mapEl && mapSlot && !mapSlot.contains(mapEl)) mapSlot.appendChild(mapEl);
            state._scEnterCanhaoMode?.();
            setTimeout(() => {
              if (!state._scLocMap._mapPane) return;
              state._scLocMap.invalidateSize();
              state._scUpdateOverlays?.();
            }, 50);
          }
        });
      }
      if (window.IcEquipSelectInit) window.IcEquipSelectInit(container);

      if (state._scLocMap && state.canhaoMode === "segment") {
        const mapEl = state._scLocMap.getContainer();
        if (mapEl && mapSlot) {
          mapSlot.appendChild(mapEl);
          state._scEnterCanhaoMode?.();
          setTimeout(() => {
            if (!state._scLocMap._mapPane) return;
            state._scLocMap.invalidateSize();
            state._scUpdateOverlays?.();
          }, 50);
        }
      }
    },

    bindCanhaoStep(container, state) {
      const maxAngle = Number(state.maxAngle ?? 360);
      const validMax = Number.isFinite(maxAngle) && maxAngle >= 1 ? maxAngle : 360;

      const segList = container.querySelector("#scCanhaoSegList");
      const startInput = container.querySelector("#scCanhaoStart");
      const endInput = container.querySelector("#scCanhaoEnd");

      const renderList = () => {
        if (!segList) return;
        segList.innerHTML = "";
        const segs = state.canhaoSegments || [];
        segs.forEach((seg, i) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "pivo-seg-num-btn" + (i === state.activeCanhaoSegIdx ? " is-active" : "");
          const btnColor = SC_SEG_PALETTE[i % SC_SEG_PALETTE.length];
          btn.style.cssText = `background:${btnColor};--seg-color:${btnColor};`;
          btn.textContent = String(i + 1);
          btn.addEventListener("click", () => {
            state.activeCanhaoSegIdx = i;
            renderList();
            populateForm();
            state._scUpdateOverlays?.();
          });
          segList.appendChild(btn);
        });

        if (segs.length < 9) {
          const addBtn = document.createElement("button");
          addBtn.type = "button";
          addBtn.className = "pivo-seg-add-btn";
          addBtn.title = "Adicionar segmento de canhão";
          addBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
          addBtn.addEventListener("click", () => {
            const prevEnd = segs.length > 0 ? (segs[segs.length - 1].endAngle ?? 0) : 0;
            const newStart = Math.min(prevEnd, validMax);
            const newEnd = Math.min(newStart + 30, validMax);
            state.canhaoSegments = [...segs, { startAngle: newStart, endAngle: newEnd }];
            state.activeCanhaoSegIdx = state.canhaoSegments.length - 1;
            renderList();
            populateForm();
            state._scUpdateOverlays?.();
          });
          segList.appendChild(addBtn);
        }

        if (segs.length > 0) {
          const delBtn = document.createElement("button");
          delBtn.type = "button";
          delBtn.className = "pivo-seg-del-btn";
          delBtn.innerHTML = '<i class="fa-regular fa-trash-can"></i>';
          delBtn.addEventListener("click", () => {
            state.canhaoSegments.splice(state.activeCanhaoSegIdx, 1);
            state.activeCanhaoSegIdx = Math.max(0, state.activeCanhaoSegIdx - 1);
            renderList();
            populateForm();
            state._scUpdateOverlays?.();
          });
          segList.appendChild(delBtn);
        }
      };

      const populateForm = () => {
        const seg = (state.canhaoSegments || [])[state.activeCanhaoSegIdx ?? 0];
        if (!seg) { if (startInput) startInput.value = ""; if (endInput) endInput.value = ""; return; }
        if (startInput) startInput.value = String(seg.startAngle ?? 0);
        if (endInput) endInput.value = String(seg.endAngle ?? validMax);
      };

      if (startInput) {
        startInput.addEventListener("change", () => {
          const seg = (state.canhaoSegments || [])[state.activeCanhaoSegIdx ?? 0];
          if (!seg) return;
          let v = Number(startInput.value);
          if (!Number.isFinite(v)) v = 0;
          v = Math.max(0, Math.min(validMax, v));
          seg.startAngle = v;
          startInput.value = String(v);
          state._scUpdateOverlays?.();
        });
      }

      if (endInput) {
        endInput.addEventListener("change", () => {
          const seg = (state.canhaoSegments || [])[state.activeCanhaoSegIdx ?? 0];
          if (!seg) return;
          let v = Number(endInput.value);
          if (!Number.isFinite(v)) v = validMax;
          v = Math.max(0, Math.min(validMax, v));
          seg.endAngle = v;
          endInput.value = String(v);
          state._scUpdateOverlays?.();
        });
      }

      renderList();
      populateForm();
    },

    renderSegmentsStep(container, state) {
      const maxAngle = Number(state.maxAngle ?? 360);
      const validMax = Number.isFinite(maxAngle) && maxAngle >= 1 ? maxAngle : 360;

      if (!state.segments || state.segments.length === 0) {
        state.segments = [{ name: "Segmento 1", startAngle: 0, endAngle: validMax }];
      }
      if (state.activeSegIdx === undefined) state.activeSegIdx = 0;

      container.innerHTML = `
        <div class="pivo-edit__segments-section pivo-edit-specifics">
          <div style="margin-bottom:14px;">
            <div style="font-size:14px;font-weight:400;color:#0f172a;margin-bottom:6px;">Configuração automática</div>
            <div class="pivo-preset-row">
              <button type="button" class="pivo-preset-btn" data-sc-preset="1">1</button>
              <button type="button" class="pivo-preset-btn" data-sc-preset="2">2</button>
              <button type="button" class="pivo-preset-btn" data-sc-preset="3">3</button>
              <button type="button" class="pivo-preset-btn" data-sc-preset="4">4</button>
              <button type="button" class="pivo-preset-btn" data-sc-preset="5">5</button>
              <button type="button" class="pivo-preset-btn" data-sc-preset="6">6</button>
              <button type="button" class="pivo-preset-btn" data-sc-preset="7">7</button>
              <button type="button" class="pivo-preset-btn" data-sc-preset="8">8</button>
              <button type="button" class="pivo-preset-btn" data-sc-preset="9">9</button>
            </div>
          </div>

          <div style="font-size:14px;font-weight:400;color:#0f172a;margin-bottom:6px;">Configuração manual</div>
          <div id="scSegList" style="display:flex;gap:8px;margin-bottom:16px;align-items:center;flex-wrap:wrap;"></div>

          <div class="edit-panel__grid-3" style="grid-template-columns:1fr 1fr;gap:12px;">
            <div class="pivo-edit__field" style="grid-column:span 2;">
              <label class="edit-panel__label" for="scSegName"><span class="edit-panel__req">*</span> Nome do segmento</label>
              <input class="edit-panel__input" id="scSegName" type="text" placeholder="Ex: Lado A">
            </div>
            <div class="pivo-edit__field">
              <label for="scSegStart"><span class="edit-panel__req">*</span> Ângulo inicial</label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="scSegStart" type="text" inputmode="decimal">
                <span class="sc-input-suffix">°</span>
              </div>
            </div>
            <div class="pivo-edit__field">
              <label for="scSegEnd"><span class="edit-panel__req">*</span> Ângulo final</label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="scSegEnd" type="text" inputmode="decimal">
                <span class="sc-input-suffix">°</span>
              </div>
            </div>
          </div>
        </div>
        <div id="scSegMapSlot" class="sc-loc__map-wrapper" style="margin-top:6px;"></div>
      `;

      this.bindSegmentsStep(container, state);

      if (state._scLocMap) {
        const mapEl = state._scLocMap.getContainer();
        const slot = container.querySelector("#scSegMapSlot");
        if (mapEl && slot) {
          slot.appendChild(mapEl);
          state._scEnterSegmentsMode?.();
          setTimeout(() => {
            if (!state._scLocMap._mapPane) return;
            state._scLocMap.invalidateSize();
            state._scUpdateOverlays?.();
          }, 50);
        }
      }
    },

    bindSegmentsStep(container, state) {
      const maxAngle = Number(state.maxAngle ?? 360);
      const validMax = Number.isFinite(maxAngle) && maxAngle >= 1 ? maxAngle : 360;

      const segList = container.querySelector("#scSegList");
      const nameInput = container.querySelector("#scSegName");
      const startInput = container.querySelector("#scSegStart");
      const endInput = container.querySelector("#scSegEnd");

      const renderList = () => {
        if (!segList) return;
        segList.innerHTML = "";
        const segs = state.segments || [];
        segs.forEach((seg, i) => {
          const color = SC_SEG_PALETTE[i % SC_SEG_PALETTE.length];
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "pivo-seg-num-btn" + (i === state.activeSegIdx ? " is-active" : "");
          btn.style.cssText = `background:${color};--seg-color:${color};`;
          btn.textContent = String(i + 1);
          btn.addEventListener("click", () => {
            state.activeSegIdx = i;
            renderList();
            populateForm();
            state._scUpdateOverlays?.();
          });
          segList.appendChild(btn);
        });

        if (segs.length < 9) {
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
            state.segments = [...segs, { name: `Segmento ${segs.length + 1}`, startAngle: mid, endAngle: lastEnd }];
            state.activeSegIdx = state.segments.length - 1;
            renderList();
            populateForm();
            state._scUpdateOverlays?.();
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
            state._scUpdateOverlays?.();
          });
        }
        segList.appendChild(delBtn);
      };

      const populateForm = () => {
        const segs = state.segments || [];
        const seg = segs[state.activeSegIdx ?? 0];
        if (!seg) return;
        const single = segs.length === 1;
        if (nameInput) nameInput.value = seg.name || `Segmento ${(state.activeSegIdx ?? 0) + 1}`;
        if (startInput) {
          startInput.value = String(seg.startAngle ?? 0);
          startInput.disabled = single;
        }
        if (endInput) {
          endInput.value = String(seg.endAngle ?? validMax);
          endInput.disabled = single;
        }
      };

      container.querySelectorAll("[data-sc-preset]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const n = Number(btn.dataset.scPreset);
          const slice = validMax / n;
          const names = state.segments?.map((s) => s.name) || [];
          state.segments = Array.from({ length: n }, (_, k) => ({
            name: names[k] || `Segmento ${k + 1}`,
            startAngle: Math.round(k * slice),
            endAngle: k === n - 1 ? validMax : Math.round((k + 1) * slice),
          }));
          state.activeSegIdx = 0;
          renderList();
          populateForm();
          state._scUpdateOverlays?.();
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
          state._scUpdateOverlays?.();
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
          state._scUpdateOverlays?.();
        });
      }

      renderList();
      populateForm();
    },

    renderAngleStep(container, state) {
      const maxAngleValue = state.maxAngle ?? 360;
      const bearing = state.bearing ?? 0;
      // Ponto do pin vermelho = referência sobre a borda do raio (ângulo 0)
      const refPointText = (Number.isFinite(state.centerLat) && Number.isFinite(state.centerLng))
        ? (() => { const _r = destinationPoint({ lat: state.centerLat, lng: state.centerLng }, state.radius ?? 0, bearing); return formatLatLng(_r.lat, _r.lng); })()
        : "";

      container.innerHTML = `
        <div class="equip-form">
          <div class="equip-form__row">
            <div class="equip-field">
              <label class="equip-label" for="scMaxAngle"><span class="equip-required">*</span>Ângulo máximo de trabalho <span class="edit-panel__tooltip-icon" data-tooltip="Define o ângulo máximo de trabalho do pivô. Use 360° para irrigação em círculo completo, ou um valor menor para um pivô setorial."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input type="text" inputmode="decimal" class="equip-input sc-input" id="scMaxAngle" value="${escapeHtml(String(maxAngleValue))}">
                <span class="sc-input-suffix">°</span>
              </div>
              <span style="font-size: 10px; color: #94a3b8; display: block; margin-top: 4px;">Entre 1 e 360</span>
            </div>
          </div>

          <div id="scCardinalWrap" style="margin-top: 12px; display: flex; flex-wrap: wrap; align-items: flex-start;">
            <div>
              <div class="pivo-edit__cardinal-label" style="display: flex; align-items: center; gap: 6px; white-space: nowrap; font-size: 14px; color: #0f172a; margin-bottom: 10px; font-weight: 400;">Alinhar ângulo zero (selecione um dos pontos cardeais ou demarque no mapa) <span class="edit-panel__tooltip-icon" data-tooltip="Ponto de referência 0° do pivô. Selecione um ponto cardeal (N, L, S, O) ou demarque no mapa."><i class="fa-regular fa-circle-question"></i></span></div>
              <div class="pivo-cardinal-btns" id="scCardinalBtns" style="align-items: center; flex-wrap: nowrap; width: 100%; gap: 10px;">
                <button type="button" class="pivo-cardinal-btn${bearing === 0 ? " is-selected" : ""}" data-action="sc-angle-cardinal" data-bearing="0" title="Norte">N</button>
                <button type="button" class="pivo-cardinal-btn${bearing === 90 ? " is-selected" : ""}" data-action="sc-angle-cardinal" data-bearing="90" title="Leste">L</button>
                <button type="button" class="pivo-cardinal-btn${bearing === 180 ? " is-selected" : ""}" data-action="sc-angle-cardinal" data-bearing="180" title="Sul">S</button>
                <button type="button" class="pivo-cardinal-btn${bearing === 270 ? " is-selected" : ""}" data-action="sc-angle-cardinal" data-bearing="270" title="Oeste">O</button>
                <div class="edit-panel__input-wrap" style="display: flex; flex: 1 1 360px; min-width: 0; gap: 8px;">
                  <input class="edit-panel__input" id="scAngleLatLng" type="text" inputmode="decimal" value="${escapeHtml(refPointText)}" placeholder="-12.898631, -45.794457" aria-label="Coordenadas da referência do ângulo zero" style="flex: 1; min-width: 0; padding-right: 300px;">
                  <button type="button" class="edit-panel__btn" data-action="sc-get-angle-loc" style="white-space: nowrap; flex-shrink: 0;"><i class="fa-solid fa-location-dot" style="color:#ef4444;"></i> Obter Localização</button>
                </div>
              </div>
            </div>
            <div style="width: 60px;"></div>
            <!-- Exclusivo SmartTouch/Centerstar: este fluxo (Nexus/SmartConnect) não usa esse campo, fica oculto. -->
            <div class="pivo-edit__field" id="scMaxLapsField" style="max-width: 220px; display: none;">
              <label for="scMaxLaps">Número máximo de voltas <span class="edit-panel__tooltip-icon" data-tooltip="Quantidade máxima de voltas que o pivô pode realizar antes de parar automaticamente."><i class="fa-regular fa-circle-question"></i></span></label>
              <input type="text" inputmode="decimal" class="equip-input" id="scMaxLaps">
            </div>
          </div>
        </div>
        <div id="scAngleMapSlot" class="sc-loc__map-wrapper" style="margin-top: 16px;"></div>
      `;

      this.bindAngleStep(container, state);

      if (state._scLocMap) {
        const mapEl = state._scLocMap.getContainer();
        const slot = container.querySelector("#scAngleMapSlot");
        if (mapEl && slot) {
          slot.appendChild(mapEl);
          state._scEnterAngleMode?.();
          setTimeout(() => {
            if (!state._scLocMap._mapPane) return;
            state._scLocMap.invalidateSize();
            state._scUpdateOverlays?.();
          }, 50);
        }
      }
    },

    bindAngleStep(container, state) {
      const maxAngleInput = container.querySelector("#scMaxAngle");
      const cardinalWrap = container.querySelector("#scCardinalWrap");
      const cardinalBtns = container.querySelector("#scCardinalBtns");

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
        state._scUpdateOverlays?.();
      };

      if (maxAngleInput) {
        const maxAngleDisplay = container.querySelector("#scMaxAngleDisplay");

        maxAngleInput.addEventListener("input", () => {
          let v = Number(maxAngleInput.value);
          if (!Number.isFinite(v)) v = 360;
          v = Math.max(1, Math.min(360, v));
          state.maxAngle = v;
          if (maxAngleDisplay) maxAngleDisplay.value = String(v);
          resetBearingForAngle(v);
          toggleCardinal(v);
        });
        maxAngleInput.addEventListener("change", () => {
          let v = Number(maxAngleInput.value);
          if (!Number.isFinite(v)) v = 360;
          v = Math.max(1, Math.min(360, v));
          state.maxAngle = v;
          maxAngleInput.value = String(v);
          if (maxAngleDisplay) maxAngleDisplay.value = String(v);
          resetBearingForAngle(v);
          toggleCardinal(v);
        });
      }

      if (cardinalBtns) {
        cardinalBtns.addEventListener("click", (e) => {
          const btn = e.target.closest("[data-action='sc-angle-cardinal']");
          if (!btn) return;
          const b = Number(btn.dataset.bearing);
          state.bearing = b;
          cardinalBtns.querySelectorAll(".pivo-cardinal-btn").forEach((el) => {
            el.classList.toggle("is-selected", Number(el.dataset.bearing) === b);
          });
          state._scUpdateOverlays?.();
        });
      }

      const latLngInput = container.querySelector("#scAngleLatLng");
      if (latLngInput) {
        const syncLatLng = () => {
          const parsed = parseLatLng(latLngInput.value);
          if (!parsed) return;
          if (!Number.isFinite(state.centerLat) || !Number.isFinite(state.centerLng)) return;
          const center = { lat: state.centerLat, lng: state.centerLng };
          // O ponto digitado define a direção; o pin é projetado sobre a linha do raio
          state.bearing = bearingBetweenPoints(center, parsed);
          const onCircle = destinationPoint(center, state.radius ?? 0, state.bearing);
          latLngInput.value = formatLatLng(onCircle.lat, onCircle.lng);
          state._scUpdateOverlays?.();
        };
        latLngInput.addEventListener("change", syncLatLng);
        latLngInput.addEventListener("blur", syncLatLng);
      }

      const angleLocBtn = container.querySelector('[data-action="sc-get-angle-loc"]');
      if (angleLocBtn && navigator.geolocation) {
        angleLocBtn.addEventListener("click", () => {
          if (!Number.isFinite(state.centerLat) || !Number.isFinite(state.centerLng)) return;
          angleLocBtn.disabled = true;
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const center = { lat: state.centerLat, lng: state.centerLng };
              state.bearing = bearingBetweenPoints(center, { lat: pos.coords.latitude, lng: pos.coords.longitude });
              const onCircle = destinationPoint(center, state.radius ?? 0, state.bearing);
              if (latLngInput) latLngInput.value = formatLatLng(onCircle.lat, onCircle.lng);
              state._scUpdateOverlays?.();
              angleLocBtn.disabled = false;
            },
            () => { angleLocBtn.disabled = false; },
            { enableHighAccuracy: true, timeout: 8000 }
          );
        });
      }
    },

    readStep2(container, state = {}) {
      const center = container.querySelector("#scCenter")?.value?.trim() || "";
      const radiusRaw = Number(String(container.querySelector("#scRadius")?.value || "").replace(",", "."));
      const parsedCenter = parseLatLng(center);
      const radius = Number.isFinite(radiusRaw) && radiusRaw > 0 ? radiusRaw : null;

      let refLat = null, refLng = null;
      if (parsedCenter && radius) {
        const bearing = state.bearing ?? 0;
        const ref = destinationPoint(parsedCenter, radius, bearing);
        refLat = ref.lat;
        refLng = ref.lng;
      }
      const ref = refLat !== null ? formatLatLng(refLat, refLng) : "";

      return {
        center,
        ref,
        centerLat: parsedCenter?.lat ?? null,
        centerLng: parsedCenter?.lng ?? null,
        refLat,
        refLng,
        radius,
      };
    },


    validateStep2(data) {
      if (data.centerLat === null || data.centerLng === null) {
        return { ok: false, msg: "Informe o centro do pivô (Latitude, Longitude)." };
      }
      if (!data.radius || !Number.isFinite(data.radius) || data.radius <= 0) {
        return { ok: false, msg: "Informe o raio da última torre (em metros)." };
      }
      return { ok: true, msg: "" };
    },

    // =================
    // STEP 3 — Ficha Técnica
    // =================
    renderStep3(container, state) {
      const errors = state._errors || {};

      if (!state.manufacturer) state.manufacturer = "Bauer";
      if (!state.panelType) state.panelType = "Nexus";
      state.powerUnit = "kw";

      const showOther = state.manufacturer === "outro";

      container.innerHTML = `
        <div class="sc-config">
          <div class="sc-config__grid">
            <div class="sc-field ${errors.name ? "is-error" : ""}">
              <label class="equip-label" for="scName"><span class="equip-required">*</span>Nome do equipamento</label>
              <input class="equip-input" id="scName" placeholder="Piv\u00f4 01" value="${escapeHtml(state.name || "")}" aria-invalid="${errors.name ? "true" : "false"}" />
              <div class="sc-error ${errors.name ? "" : "is-hidden"}">Este campo \u00e9 obrigat\u00f3rio</div>
            </div>

            <div class="sc-field ${errors.manufacturer ? "is-error" : ""}">
              <label class="equip-label" for="scManufacturer"><span class="equip-required">*</span>Fabricante do equipamento</label>
              <select class="equip-input" id="scManufacturer" aria-invalid="${errors.manufacturer ? "true" : "false"}">
                <option value="Bauer">Bauer</option>
                <option value="Carborundum">Carborundum</option>
                <option value="Fockink">Fockink</option>
                <option value="Irrigabras">Irrigabras</option>
                <option value="Krebs">Krebs</option>
                <option value="Lindsay">Lindsay</option>
                <option value="Reinke">Reinke</option>
                <option value="Valley">Valley</option>
                <option value="outro">Outro</option>
              </select>
              <div class="sc-error ${errors.manufacturer ? "" : "is-hidden"}">Este campo \u00e9 obrigat\u00f3rio</div>
            </div>

            <div class="sc-field ${showOther ? "" : "is-hidden"} ${errors.manufacturerOther ? "is-error" : ""}">
              <label class="equip-label" for="scManufacturerOther"><span class="equip-required">*</span>Outro</label>
              <input class="equip-input" id="scManufacturerOther" placeholder="Outro" value="${escapeHtml(state.manufacturerOther || "")}" aria-invalid="${errors.manufacturerOther ? "true" : "false"}" />
              <div class="sc-error ${errors.manufacturerOther ? "" : "is-hidden"}">Este campo \u00e9 obrigat\u00f3rio</div>
            </div>

            <div class="sc-field ${errors.panelType ? "is-error" : ""}">
              <label class="equip-label" for="scPanelType"><span class="equip-required">*</span>Tipo de painel</label>
              <select class="equip-input" id="scPanelType" aria-invalid="${errors.panelType ? "true" : "false"}">
                ${state.panelType === "SmartTouch" ? '<option value="SmartTouch" disabled>SmartTouch (legado)</option>' : ""}
                <option value="Nexus">Nexus</option>
                <option value="SmartConnect">SmartConnect</option>
              </select>
              <div class="sc-error ${errors.panelType ? "" : "is-hidden"}">Este campo \u00e9 obrigat\u00f3rio</div>
            </div>

            <div class="sc-field ${errors.lang ? "is-error" : ""}">
              <label class="equip-label" for="scLang"><span class="equip-required">*</span>Idioma do equipamento</label>
              <select class="equip-input" id="scLang" aria-invalid="${errors.lang ? "true" : "false"}">
                <option value="en" ${(state.lang || "en") === "en" ? "selected" : ""}>English</option>
                <option value="pt" ${state.lang === "pt" ? "selected" : ""}>Portugu\u00eas</option>
                <option value="es" ${state.lang === "es" ? "selected" : ""}>Espa\u00f1ol</option>
                <option value="ru" ${state.lang === "ru" ? "selected" : ""}>Russo</option>
                <option value="de" ${state.lang === "de" ? "selected" : ""}>Alem\u00e3o</option>
              </select>
              <div class="sc-error ${errors.lang ? "" : "is-hidden"}">Este campo \u00e9 obrigat\u00f3rio</div>
            </div>

            <div class="sc-field">
              <label class="equip-label" for="scRadius"><span class="equip-required">*</span>Raio at\u00e9 a \u00faltima torre <span class="edit-panel__tooltip-icon" data-tooltip="Dist\u00e2ncia do centro do piv\u00f4 at\u00e9 a \u00faltima torre (sem incluir o alcance do canh\u00e3o/aspersor final)."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="scRadius" type="text" inputmode="decimal" value="${escapeHtml(state.techRadius || "")}" />
                <span class="sc-input-suffix">m</span>
              </div>
            </div>

            <div class="sc-field ${errors.speed ? "is-error" : ""}">
              <label class="equip-label" for="scSpeed"><span class="equip-required">*</span>Velocidade da \u00faltima torre <span class="edit-panel__tooltip-icon" data-tooltip="Velocidade da \u00faltima torre a 100%."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="scSpeed" type="text" inputmode="decimal" value="${escapeHtml(state.speed || "")}" aria-invalid="${errors.speed ? "true" : "false"}" />
                <span class="sc-input-suffix">m/h</span>
              </div>
              <div class="sc-error ${errors.speed ? "" : "is-hidden"}">Este campo \u00e9 obrigat\u00f3rio</div>
            </div>


          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px;">
            <div class="sc-field">
              <label class="equip-label" for="scLocRadius">Raio total irrigado <span class="edit-panel__tooltip-icon" data-tooltip="Distância do centro do pivô até o final do último tubo do pivô."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="scLocRadius" type="text" value="${escapeHtml((Number(state.radius) || 600).toFixed(2))}" readonly style="background:#f8fafc;color:#94a3b8;cursor:not-allowed;" />
                <span class="sc-input-suffix">m</span>
              </div>
            </div>

            <div class="sc-field">
              <label class="equip-label" for="scMaxAngleDisplay">\u00c2ngulo M\u00e1ximo de Trabalho <span class="edit-panel__tooltip-icon" data-tooltip="Define o \u00e2ngulo m\u00e1ximo de trabalho do piv\u00f4. Use 360\u00b0 para irriga\u00e7\u00e3o em c\u00edrculo completo, ou um valor menor para um piv\u00f4 setorial."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="scMaxAngleDisplay" type="text" value="${escapeHtml(String(state.maxAngle ?? 360))}" readonly style="background:#f8fafc;color:#94a3b8;cursor:not-allowed;" />
                <span class="sc-input-suffix">\u00b0</span>
              </div>
            </div>

            <div class="sc-field">
              <label class="equip-label" for="scIrrigatedArea">\u00c1rea irrigada</label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="scIrrigatedArea" type="text" value="${(() => { const r = Number(state.radius) || 600; return (Math.PI * r * r / 10000).toFixed(2); })()}" readonly style="background:#f8fafc;color:#94a3b8;cursor:not-allowed;" />
                <span class="sc-input-suffix">ha</span>
              </div>
            </div>
          </div>

          <div id="scPluvioFields" style="margin-top:0;padding:4px 0 16px;">
            <div style="border-top:1px solid #e5e7eb;margin:8px 0 16px;"></div>
            <div class="equip-label" style="font-size:14px;font-weight:600;color:#0f172a;margin-bottom:16px;display:block;">Pluviômetro</div>
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
              <label for="scPluvioEnabled" style="font-size:14px;color:#334155;cursor:pointer;">Habilitar pluviômetro</label>
              <label class="pivo-edit__switch">
                <input id="scPluvioEnabled" type="checkbox" ${state.pluvioEnabled ? "checked" : ""} />
                <span class="pivo-edit__switch-slider"></span>
              </label>
            </div>
            <div id="scPluvioSubFields" style="display:${state.pluvioEnabled ? "block" : "none"};">
              <div class="sc-config__grid">
                <div class="sc-field">
                  <label class="equip-label" for="scPluvioScale"><span class="equip-required">*</span>Escala do sensor <span class="edit-panel__tooltip-icon" data-tooltip="A Escala do sensor se refere ao máximo de pressão que ele consegue medir."><i class="fa-regular fa-circle-question"></i></span></label>
                  <div class="sc-input-group">
                    <input class="equip-input sc-input" id="scPluvioScale" type="text" inputmode="decimal" value="${escapeHtml(state.pluvioScale || "0.2")}" />
                    <span class="sc-input-suffix">mm</span>
                  </div>
                </div>
                <div class="sc-field">
                  <label class="equip-label" for="scPluvioStopCondition"><span class="equip-required">*</span>Condi\u00e7\u00e3o de parada <span class="edit-panel__tooltip-icon" data-tooltip="'Por valor': o comando do piv\u00f4 \u00e9 interrompido ao atingir o limite definido no campo 'Valor'. 'Por decremento': o piv\u00f4 aumenta a velocidade para compensar a l\u00e2mina aplicada."><i class="fa-regular fa-circle-question"></i></span></label>
                  <select class="equip-input" id="scPluvioStopCondition">
                    <option value="none" ${(state.pluvioStopCondition || "decrement") === "none" ? "selected" : ""}>N\u00e3o configurado</option>
                    <option value="value" ${state.pluvioStopCondition === "value" ? "selected" : ""}>Por valor</option>
                    <option value="decrement" ${(state.pluvioStopCondition || "decrement") === "decrement" ? "selected" : ""}>Por decremento</option>
                  </select>
                </div>
                <div class="sc-field">
                  <label class="equip-label" for="scPluvioValue"><span class="equip-required">*</span>Valor <span class="edit-panel__tooltip-icon" data-tooltip="Limite de chuva, em milímetros, estabelecido em uma determinada área."><i class="fa-regular fa-circle-question"></i></span></label>
                  <div class="sc-input-group">
                    <input class="equip-input sc-input" id="scPluvioValue" type="text" inputmode="decimal" value="${escapeHtml(state.pluvioValue || "1")}" />
                    <span class="sc-input-suffix">mm</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div id="scAutoRevFields" style="padding:4px 0 16px;">
            <div style="border-top:1px solid #e5e7eb;margin:8px 0 16px;"></div>
            <div class="equip-label" style="font-size:14px;font-weight:600;color:#0f172a;margin-bottom:16px;display:block;">Autorreversão</div>
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
              <label for="scAutoRevEnabled" style="font-size:14px;color:#334155;cursor:pointer;">Habilitar autorreversão</label>
              <label class="pivo-edit__switch">
                <input id="scAutoRevEnabled" type="checkbox" ${state.autoRevEnabled ? "checked" : ""} />
                <span class="pivo-edit__switch-slider"></span>
              </label>
            </div>
            <div id="scAutoRevSubFields" style="display:${state.autoRevEnabled ? "block" : "none"};">
              <div class="sc-config__grid" style="margin-bottom:12px;">
                <div class="sc-field">
                  <div class="equip-label" style="display:flex;align-items:center;min-height:20px;">Condição de parada <span class="edit-panel__tooltip-icon" data-tooltip="'Por valor': o comando do pivô é interrompido ao atingir o limite definido no campo 'Valor'. 'Por decremento': o pivô aumenta a velocidade para compensar a lâmina aplicada."><i class="fa-regular fa-circle-question"></i></span></div>
                  <div class="pivo-edit__segmented-control" id="scAutoRevCondition">
                    <button type="button" class="${(state.autoRevCondition || "fim") === "fim" ? "is-active" : ""}" data-value="fim">Por fim de curso</button>
                    <button type="button" class="${state.autoRevCondition === "angulo" ? "is-active" : ""}" data-value="angulo">Por ângulo</button>
                  </div>
                </div>
                <div class="sc-field">
                  <label class="equip-label" for="scAutoRevTime" style="white-space: nowrap; display:flex;align-items:center;min-height:20px;">Tempo de espera para Autorreversão</label>
                  <select class="equip-input" id="scAutoRevTime">
                    <option value="30s" ${(state.autoRevTime || "30s") === "30s" ? "selected" : ""}>30 segundos</option>
                    <option value="1m" ${state.autoRevTime === "1m" ? "selected" : ""}>1 minuto</option>
                    <option value="2m" ${state.autoRevTime === "2m" ? "selected" : ""}>2 minutos</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div class="sc-config__block" style="margin-top:0;padding-top:0;">
            <div style="border-top:1px solid #e5e7eb;margin:8px 0 16px;"></div>
            <div class="equip-label" style="font-size:14px;font-weight:600;color:#0f172a;margin-bottom:16px;display:block;">Proteção e Religamento</div>

            <div class="sc-config__grid">
              <div class="sc-field">
                <label class="equip-label" for="scEnergyTime"><span class="equip-required">*</span>Tempo de energia <span class="edit-panel__tooltip-icon" data-tooltip="Tempo de espera antes de retomar a operação após uma queda de energia."><i class="fa-regular fa-circle-question"></i></span></label>
                <div class="sc-input-group">
                  <input class="equip-input sc-input" id="scEnergyTime" type="text" inputmode="decimal" value="${escapeHtml(state.energyTime || "1")}" />
                  <span class="sc-input-suffix">min</span>
                </div>
              </div>
            </div>

            <div style="margin-top:20px;display:flex;align-items:center;gap:8px;">
              <label for="scVoltageController" style="font-size:13px;color:#334155;cursor:pointer;margin:0;">Controlador de tensão <span class="edit-panel__tooltip-icon" data-tooltip="Impede que o equipamento opere fora das tensões mínima e máxima por tempo maior do que o tempo limite."><i class="fa-regular fa-circle-question"></i></span></label>
              <label class="pivo-edit__switch">
                <input type="checkbox" id="scVoltageController" ${state.voltageController !== false ? "checked" : ""} />
                <span class="pivo-edit__switch-slider"></span>
              </label>
            </div>

            <div id="scVoltageFields" style="margin-top:16px;">
              <div class="sc-config__grid">
                <div class="sc-field">
                  <label class="equip-label" for="scMinVoltage">Tensão mínima de operação</label>
                  <div class="sc-input-group">
                    <input class="equip-input sc-input" id="scMinVoltage" type="text" inputmode="decimal" value="${escapeHtml(state.minVoltage || "400")}" ${state.voltageController === false ? "disabled" : ""} />
                    <span class="sc-input-suffix">V</span>
                  </div>
                </div>
                <div class="sc-field">
                  <label class="equip-label" for="scMaxVoltage">Tensão máxima de operação</label>
                  <div class="sc-input-group">
                    <input class="equip-input sc-input" id="scMaxVoltage" type="text" inputmode="decimal" value="${escapeHtml(state.maxVoltage || "600")}" ${state.voltageController === false ? "disabled" : ""} />
                    <span class="sc-input-suffix">V</span>
                  </div>
                </div>
                <div class="sc-field">
                  <label class="equip-label" for="scTimeLimit">Tempo limite <span class="edit-panel__tooltip-icon" data-tooltip="Período de tolerância em que o pivô pode operar fora das tensões mínima ou máxima antes de desligar por segurança."><i class="fa-regular fa-circle-question"></i></span></label>
                  <div class="sc-input-group">
                    <input class="equip-input sc-input" id="scTimeLimit" type="text" inputmode="decimal" value="${escapeHtml(state.timeLimit || "2")}" ${state.voltageController === false ? "disabled" : ""} />
                    <span class="sc-input-suffix">min</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      this.bindStep3(container, state);
      this.updateStep3(container, state);
      if (window.IcEquipSelectInit) window.IcEquipSelectInit(container);
    },

    bindStep3(container, state) {
      const manufacturer = container.querySelector("#scManufacturer");
      const manufacturerOther = container.querySelector("#scManufacturerOther");
      const panelType = container.querySelector("#scPanelType");
      const nameInput = container.querySelector("#scName");
      const pluvioInput = container.querySelector("#scPluvio");

      if (manufacturer) {
        manufacturer.value = state.manufacturer || "Bauer";
        manufacturer.addEventListener("change", () => {
          state.manufacturer = manufacturer.value;
          if (state.manufacturer !== "outro") {
            state.manufacturerOther = "";
          }
          this.renderStep3(container, state);
        });
      }

      if (manufacturerOther) {
        manufacturerOther.addEventListener("input", () => {
          state.manufacturerOther = manufacturerOther.value.trim();
        });
      }

      if (panelType) {
        panelType.value = state.panelType || "Nexus";
        panelType.addEventListener("change", () => {
          state.panelType = panelType.value;
        });
      }

      if (nameInput) {
        nameInput.addEventListener("input", () => {
          state.name = nameInput.value.trim();
        });
      }

      const langInput = container.querySelector("#scLang");
      const radiusInput = container.querySelector("#scRadius");
      const speedInput = container.querySelector("#scSpeed");
      const flowInput = container.querySelector("#scFlow");
      const irRateOutput = container.querySelector("#scIrrigationRate");

      const recalcIR = () => {
        const techRadius = parseFloat(radiusInput?.value);
        const speed = parseFloat(speedInput?.value);
        const flow = parseFloat(flowInput?.value);
        const locRadius = parseFloat(state.radius) || parseFloat(String(container.querySelector("#scLocRadius")?.value || "").replace(",", ".")) || 600;
        const angleFactor = (parseFloat(state.maxAngle) || 360) / 360;
        if (!irRateOutput) return;
        if (techRadius > 0 && speed > 0 && flow > 0 && locRadius > 0) {
          const area = Math.PI * locRadius * locRadius / 10000 * angleFactor;
          const circumference = 2 * Math.PI * techRadius * angleFactor;
          const ir = (flow * (circumference / speed)) / area * 0.1;
          irRateOutput.value = ir.toFixed(2);
        } else if (radiusInput && speedInput) {
          irRateOutput.value = "";
        }
      };

      state._scRecalcIR = recalcIR;

      if (langInput) {
        langInput.addEventListener("change", () => { state.lang = langInput.value; });
      }
      if (radiusInput) {
        radiusInput.addEventListener("input", () => { state.techRadius = radiusInput.value; recalcIR(); });
      }
      if (speedInput) {
        speedInput.addEventListener("input", () => { state.speed = speedInput.value; recalcIR(); });
      }
      if (flowInput) {
        flowInput.addEventListener("input", () => recalcIR());
      }
      recalcIR();
      const pluvioEnabledInput = container.querySelector("#scPluvioEnabled");
      const pluvioScaleInput = container.querySelector("#scPluvioScale");
      const pluvioStopInput = container.querySelector("#scPluvioStopCondition");
      const pluvioValueInput = container.querySelector("#scPluvioValue");

      if (pluvioEnabledInput) pluvioEnabledInput.addEventListener("change", () => {
        state.pluvioEnabled = pluvioEnabledInput.checked;
        const sub = container.querySelector("#scPluvioSubFields");
        if (sub) sub.style.display = state.pluvioEnabled ? "block" : "none";
      });
      if (pluvioScaleInput) pluvioScaleInput.addEventListener("input", () => { state.pluvioScale = pluvioScaleInput.value; });
      if (pluvioStopInput) pluvioStopInput.addEventListener("change", () => { state.pluvioStopCondition = pluvioStopInput.value; });
      if (pluvioValueInput) pluvioValueInput.addEventListener("input", () => { state.pluvioValue = pluvioValueInput.value; });

      const autoRevEnabled = container.querySelector("#scAutoRevEnabled");
      const autoRevConditionBtns = container.querySelectorAll("#scAutoRevCondition button");
      const autoRevTimeInput = container.querySelector("#scAutoRevTime");

      if (autoRevEnabled) autoRevEnabled.addEventListener("change", () => {
        state.autoRevEnabled = autoRevEnabled.checked;
        const sub = container.querySelector("#scAutoRevSubFields");
        if (sub) sub.style.display = state.autoRevEnabled ? "block" : "none";
      });
      autoRevConditionBtns.forEach(btn => {
        btn.addEventListener("click", () => {
          autoRevConditionBtns.forEach(b => b.classList.remove("is-active"));
          btn.classList.add("is-active");
          state.autoRevCondition = btn.dataset.value;
        });
      });
      if (autoRevTimeInput) autoRevTimeInput.addEventListener("change", () => { state.autoRevTime = autoRevTimeInput.value; });

      const energyTimeInput = container.querySelector("#scEnergyTime");
      const voltageControllerInput = container.querySelector("#scVoltageController");
      const minVoltageInput = container.querySelector("#scMinVoltage");
      const maxVoltageInput = container.querySelector("#scMaxVoltage");
      const timeLimitInput = container.querySelector("#scTimeLimit");

      if (energyTimeInput) energyTimeInput.addEventListener("input", () => { state.energyTime = energyTimeInput.value; });
      if (voltageControllerInput) voltageControllerInput.addEventListener("change", () => {
        state.voltageController = voltageControllerInput.checked;
        const disabled = !state.voltageController;
        [container.querySelector("#scMinVoltage"), container.querySelector("#scMaxVoltage"), container.querySelector("#scTimeLimit")]
          .forEach(el => { if (el) el.disabled = disabled; });
      });
      if (minVoltageInput) minVoltageInput.addEventListener("input", () => { state.minVoltage = minVoltageInput.value; });
      if (maxVoltageInput) maxVoltageInput.addEventListener("input", () => { state.maxVoltage = maxVoltageInput.value; });
      if (timeLimitInput) timeLimitInput.addEventListener("input", () => { state.timeLimit = timeLimitInput.value; });
    },

    updateStep3(container, state) {
      const converted = container.querySelector("#scConverted");
      const powerSuffix = container.querySelector("[data-sc-power-unit]");
      if (powerSuffix) powerSuffix.textContent = state.powerUnit === "kw" ? "kW" : "CV";

      const power = Number(String(state.power || "").replace(",", "."));
      const perf = Number(String(state.performance || "").replace(",", "."));
      if (!Number.isFinite(power) || !Number.isFinite(perf) || perf === 0) {
        if (converted) converted.value = "";
        state.converted = "";
        return;
      }
      const kw = power / (perf / 100);
      const formatted = kw.toFixed(2);
      if (converted) converted.value = formatted;
      state.converted = formatted;
    },

    readStep3(container) {
      const name = container.querySelector("#scName")?.value?.trim() || "";
      const manufacturer = container.querySelector("#scManufacturer")?.value || "";
      const manufacturerOther = container.querySelector("#scManufacturerOther")?.value?.trim() || "";
      const panelType = container.querySelector("#scPanelType")?.value || "";
      const lang = container.querySelector("#scLang")?.value || "en";
      const radius = container.querySelector("#scRadius")?.value?.trim() || "";
      const speed = container.querySelector("#scSpeed")?.value?.trim() || "";
      const pluvioEnabled = !!container.querySelector("#scPluvioEnabled")?.checked;
      const pluvioScale = container.querySelector("#scPluvioScale")?.value?.trim() || "0.2";
      const pluvioStopCondition = container.querySelector("#scPluvioStopCondition")?.value || "decrement";
      const pluvioValue = container.querySelector("#scPluvioValue")?.value?.trim() || "1";
      const autoRevEnabled = !!container.querySelector("#scAutoRevEnabled")?.checked;
      const autoRevCondition = container.querySelector("#scAutoRevCondition .is-active")?.dataset?.value || "fim";
      const autoRevTime = container.querySelector("#scAutoRevTime")?.value || "30s";
      const energyTime = container.querySelector("#scEnergyTime")?.value?.trim() || "1";
      const voltageController = !!container.querySelector("#scVoltageController")?.checked;
      const minVoltage = container.querySelector("#scMinVoltage")?.value?.trim() || "400";
      const maxVoltage = container.querySelector("#scMaxVoltage")?.value?.trim() || "600";
      const timeLimit = container.querySelector("#scTimeLimit")?.value?.trim() || "2";

      return {
        name,
        manufacturer,
        manufacturerOther,
        panelType,
        lang,
        radius,
        speed,
        pluvioEnabled,
        pluvioScale,
        pluvioStopCondition,
        pluvioValue,
        autoRevEnabled,
        autoRevCondition,
        autoRevTime,
        energyTime,
        voltageController,
        minVoltage,
        maxVoltage,
        timeLimit,
      };
    },

    validateStep3(data, state) {
      const errors = {};

      if (!data.name) errors.name = true;
      if (!data.manufacturer) errors.manufacturer = true;
      if (data.manufacturer === "outro" && !data.manufacturerOther) {
        errors.manufacturerOther = true;
      }
      if (!data.panelType) errors.panelType = true;
      if (!data.lang) errors.lang = true;
      if (!data.radius) errors.radius = true;
      if (!data.speed) errors.speed = true;
      const fieldLabels = {
        name: "Nome do equipamento",
        manufacturer: "Fabricante do equipamento",
        manufacturerOther: "Outro (fabricante)",
        panelType: "Tipo de painel",
        lang: "Idioma",
        radius: "Raio até a última torre",
        speed: "Velocidade da última torre",
      };

      const missing = Object.keys(errors).map((k) => fieldLabels[k] || k);
      const msg = missing.length
        ? `Preencha os campos obrigatórios:\n• ${missing.join("\n• ")}`
        : "";

      return { ok: missing.length === 0, errors, msg };
    },

    // =================
    // STEP 7 — Bomba
    // =================
    renderBombaStep(container, state) {
      const errors = state._errors || {};
      state.powerUnit = "kw";

      container.innerHTML = `
        <div class="sc-config sc-config--bomba">
          <div class="sc-config__grid sc-config__grid--power" style="margin-bottom:10px;">
            <div class="sc-field ${errors.power ? "is-error" : ""}">
              <label class="equip-label" for="scPower"><span class="equip-required">*</span> Potência elétrica <span class="edit-panel__tooltip-icon" data-tooltip="Potência real (absorvida): energia efetivamente absorvida da rede elétrica para operar o equipamento no ponto de trabalho atual, considerando o rendimento e a conversão para o sistema internacional de unidades."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="scPower" type="text" inputmode="decimal" value="${escapeHtml(state.power || "")}" aria-invalid="${errors.power ? "true" : "false"}" />
                <span class="sc-input-suffix">kW</span>
              </div>
              <div class="sc-error ${errors.power ? "" : "is-hidden"}">Este campo é obrigatório</div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:10px;">
            <div class="sc-field ${errors.pressure ? "is-error" : ""}">
              <label class="equip-label" for="scPressure"><span class="equip-required">*</span>Leitura de pressão <span class="edit-panel__tooltip-icon" data-tooltip="Equipamento para aferir a pressão no centro do pivô."><i class="fa-regular fa-circle-question"></i></span></label>
              <select class="equip-input" id="scPressure" aria-invalid="${errors.pressure ? "true" : "false"}">
                <option value="desabilitado" ${(state.pressure || "pressostato") === "desabilitado" ? "selected" : ""}>Desabilitado</option>
                <option value="pressostato" ${(state.pressure || "pressostato") === "pressostato" ? "selected" : ""}>Por pressostato</option>
                <option value="sensor" ${state.pressure === "sensor" ? "selected" : ""}>Por sensor de pressão</option>
              </select>
              <div class="sc-error ${errors.pressure ? "" : "is-hidden"}">Este campo é obrigatório</div>
            </div>

            <div class="sc-field ${errors.flow ? "is-error" : ""}">
              <label class="equip-label" for="scFlow"><span class="equip-required">*</span>Vazão</label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="scFlow" type="text" inputmode="decimal" value="${escapeHtml(state.flow || "")}" aria-invalid="${errors.flow ? "true" : "false"}" />
                <span class="sc-input-suffix">m³/h</span>
              </div>
              <div class="sc-error ${errors.flow ? "" : "is-hidden"}">Este campo é obrigatório</div>
            </div>

            <div class="sc-field">
              <label class="equip-label" for="scIrrigationRate">Lâmina de irrigação <span class="edit-panel__tooltip-icon" data-tooltip="Irrigation Rate 100% = VAZ × (2π × RUT × AMT / 360) / VUT / (π × RTI² × AMT / 10000 / 360) × 0.1"><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="scIrrigationRate" type="text" value="${escapeHtml(state.irrigationRate || "")}" readonly style="background:#f8fafc;color:#94a3b8;cursor:not-allowed;" />
                <span class="sc-input-suffix">mm</span>
              </div>
            </div>
          </div>

          <div class="sc-config__grid">

            <div class="sc-field ${errors.pumpTime ? "is-error" : ""}">
              <label class="equip-label" for="scPumpTime"><span class="equip-required">*</span>Tempo de bomba <span class="edit-panel__tooltip-icon" data-tooltip="Se refere ao tempo limite para que o pivô pressurize. Caso este tempo seja ultrapassado sem atingir a pressão, a bomba é desligada por segurança."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="scPumpTime" type="text" inputmode="decimal" value="${escapeHtml(state.pumpTime || "")}" aria-invalid="${errors.pumpTime ? "true" : "false"}" />
                <span class="sc-input-suffix">min</span>
              </div>
              <div class="sc-error ${errors.pumpTime ? "" : "is-hidden"}">Este campo é obrigatório</div>
            </div>

            <div class="sc-field ${errors.delayTime ? "is-error" : ""}">
              <label class="equip-label" for="scDelayTime"><span class="equip-required">*</span>Tempo de retardo <span class="edit-panel__tooltip-icon" data-tooltip="O Tempo de retardo se refere ao tempo posterior à pressurização do pivô. Há uma espera para que a pressão chegue até a última torre, para então o pivô começar a se movimentar."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="scDelayTime" type="text" inputmode="decimal" value="${escapeHtml(state.delayTime || "")}" aria-invalid="${errors.delayTime ? "true" : "false"}" />
                <span class="sc-input-suffix">s</span>
              </div>
              <div class="sc-error ${errors.delayTime ? "" : "is-hidden"}">Este campo é obrigatório</div>
            </div>

            <div class="sc-field ${errors.unstableTime ? "is-error" : ""}">
              <label class="equip-label" for="scUnstableTime"><span class="equip-required">*</span>Tempo instável de pressostato <span class="edit-panel__tooltip-icon" data-tooltip="Caso o pivô esteja operando fora dos limites de pressão por um período maior que o estabelecido, a ação do pivô é interrompida."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="scUnstableTime" type="text" inputmode="decimal" value="${escapeHtml(state.unstableTime || "")}" aria-invalid="${errors.unstableTime ? "true" : "false"}" />
                <span class="sc-input-suffix">min</span>
              </div>
              <div class="sc-error ${errors.unstableTime ? "" : "is-hidden"}">Este campo é obrigatório</div>
            </div>
          </div>

          <div class="sc-config__grid">
            <div class="sc-field">
              <label class="equip-label" for="scSensorMin">Valor mínimo do sensor <span class="edit-panel__tooltip-icon" data-tooltip="O valor mínimo indica a faixa de pressão na qual o dispositivo deve se manter. Abaixo do valor mínimo, o funcionamento do pivô é parado."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="scSensorMin" type="text" inputmode="decimal" value="${escapeHtml(state.sensorMin || "")}" />
                <span class="sc-input-suffix">bar</span>
              </div>
            </div>

            <div class="sc-field">
              <label class="equip-label" for="scSensorMax">Valor máximo do sensor <span class="edit-panel__tooltip-icon" data-tooltip="O valor máximo indica a faixa de pressão na qual o dispositivo deve se manter. Acima do valor máximo, o funcionamento do pivô é parado."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="scSensorMax" type="text" inputmode="decimal" value="${escapeHtml(state.sensorMax || "")}" />
                <span class="sc-input-suffix">bar</span>
              </div>
            </div>

            <div class="sc-field ${errors.sensorScale ? "is-error" : ""}">
              <label class="equip-label" for="scSensorScale"><span class="equip-required">*</span>Escala do sensor <span class="edit-panel__tooltip-icon" data-tooltip="A Escala do sensor se refere ao máximo de pressão que ele consegue medir."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="scSensorScale" type="text" inputmode="decimal" value="${escapeHtml(state.sensorScale || "")}" aria-invalid="${errors.sensorScale ? "true" : "false"}" />
                <span class="sc-input-suffix">bar</span>
              </div>
              <div class="sc-error ${errors.sensorScale ? "" : "is-hidden"}">Este campo é obrigatório</div>
            </div>
          </div>

          <div class="sc-config__block" style="margin-top:12px;padding-top:0;">
            <div class="equip-label" style="font-size:14px;font-weight:600;color:#0f172a;margin-bottom:8px;display:block;">Bomba de Fertirrigação</div>
            <div style="display:flex;align-items:center;gap:8px;">
              <input id="scFertigation" type="checkbox" ${state.fertigation ? "checked" : ""} style="accent-color:#16a34a;" />
              <label for="scFertigation" style="cursor:pointer;margin:0;font-size:14px;color:#0f172a;">Permitir fertirrigação <span class="edit-panel__tooltip-icon" data-tooltip="Habilita a fertirrigação (aplicação de fertilizantes junto com a água) nos comandos de irrigação deste pivô."><i class="fa-regular fa-circle-question"></i></span></label>
            </div>
          </div>
        </div>
      `;

      this.bindBombaStep(container, state);
      this.updateBombaStep(container, state);
      if (window.IcEquipSelectInit) window.IcEquipSelectInit(container);
    },

    updateBombaStep(container, state) {
      // Unidade de potência é sempre kW; nada a alternar aqui.
    },

    bindBombaStep(container, state) {
      const powerInput = container.querySelector("#scPower");

      if (powerInput) powerInput.addEventListener("input", () => {
        state.power = powerInput.value;
      });

      const pressureInput = container.querySelector("#scPressure");
      const pumpTimeInput = container.querySelector("#scPumpTime");
      const delayTimeInput = container.querySelector("#scDelayTime");
      const unstableTimeInput = container.querySelector("#scUnstableTime");
      const sensorMinInput = container.querySelector("#scSensorMin");
      const sensorMaxInput = container.querySelector("#scSensorMax");
      const sensorScaleInput = container.querySelector("#scSensorScale");
      const flowInput = container.querySelector("#scFlow");
      const irRateOutput = container.querySelector("#scIrrigationRate");
      const fertigationInput = container.querySelector("#scFertigation");

      const recalcIR = () => {
        const techRadius = parseFloat(state.techRadius);
        const speed = parseFloat(state.speed);
        const flow = parseFloat(flowInput?.value);
        const locRadius = parseFloat(state.radius) || 600;
        const angleFactor = (parseFloat(state.maxAngle) || 360) / 360;
        if (!irRateOutput) return;
        if (techRadius > 0 && speed > 0 && flow > 0 && locRadius > 0) {
          const area = Math.PI * locRadius * locRadius / 10000 * angleFactor;
          const circumference = 2 * Math.PI * techRadius * angleFactor;
          const ir = (flow * (circumference / speed)) / area * 0.1;
          irRateOutput.value = ir.toFixed(2);
        } else {
          irRateOutput.value = "";
        }
      };

      const updateSensorFields = () => {
        const val = pressureInput?.value || "pressostato";
        const isSensor = val === "sensor";
        const isDisabled = val === "desabilitado";

        [sensorMinInput, sensorMaxInput, sensorScaleInput].forEach(el => {
          if (!el) return;
          el.disabled = !isSensor;
          el.closest(".sc-field")?.classList.toggle("is-disabled", !isSensor);
        });

        [pumpTimeInput, delayTimeInput, unstableTimeInput].forEach(el => {
          if (!el) return;
          el.disabled = isDisabled;
          el.closest(".sc-field")?.classList.toggle("is-disabled", isDisabled);
        });
      };

      if (flowInput) flowInput.addEventListener("input", () => { state.flow = flowInput.value; recalcIR(); });
      if (pressureInput) pressureInput.addEventListener("change", () => { state.pressure = pressureInput.value; updateSensorFields(); });
      recalcIR();
      if (pumpTimeInput) pumpTimeInput.addEventListener("input", () => { state.pumpTime = pumpTimeInput.value; });
      if (delayTimeInput) delayTimeInput.addEventListener("input", () => { state.delayTime = delayTimeInput.value; });
      if (unstableTimeInput) unstableTimeInput.addEventListener("input", () => { state.unstableTime = unstableTimeInput.value; });
      if (sensorMinInput) sensorMinInput.addEventListener("input", () => { state.sensorMin = sensorMinInput.value; });
      if (sensorMaxInput) sensorMaxInput.addEventListener("input", () => { state.sensorMax = sensorMaxInput.value; });
      if (sensorScaleInput) sensorScaleInput.addEventListener("input", () => { state.sensorScale = sensorScaleInput.value; });
      if (fertigationInput) fertigationInput.addEventListener("change", () => { state.fertigation = fertigationInput.checked; });

      updateSensorFields();
    },

    readBombaStep(container) {
      const power = container.querySelector("#scPower")?.value?.trim() || "";
      const powerUnit = "kw";
      const flow = container.querySelector("#scFlow")?.value?.trim() || "";
      const pressure = container.querySelector("#scPressure")?.value || "pressostato";
      const pumpTime = container.querySelector("#scPumpTime")?.value?.trim() || "";
      const delayTime = container.querySelector("#scDelayTime")?.value?.trim() || "";
      const unstableTime = container.querySelector("#scUnstableTime")?.value?.trim() || "";
      const sensorMin = container.querySelector("#scSensorMin")?.value?.trim() || "";
      const sensorMax = container.querySelector("#scSensorMax")?.value?.trim() || "";
      const sensorScale = container.querySelector("#scSensorScale")?.value?.trim() || "";
      const fertigation = !!container.querySelector("#scFertigation")?.checked;

      return { power, powerUnit, flow, pressure, pumpTime, delayTime, unstableTime, sensorMin, sensorMax, sensorScale, fertigation };
    },

    validateBombaStep(data, state) {
      const errors = {};

      const isDisabled = data.pressure === "desabilitado";
      const isSensor = data.pressure === "sensor";

      if (!data.power) errors.power = true;
      if (!data.performance) errors.performance = true;
      if (!data.flow) errors.flow = true;
      if (!isDisabled && !data.pumpTime) errors.pumpTime = true;
      if (!isDisabled && !data.delayTime) errors.delayTime = true;
      if (!isDisabled && !data.unstableTime) errors.unstableTime = true;
      if (isSensor && !data.sensorScale) errors.sensorScale = true;

      const fieldLabels = {
        power: "Potência",
        performance: "Rendimento",
        flow: "Vazão",
        pumpTime: "Tempo de bomba",
        delayTime: "Tempo de retardo",
        unstableTime: "Tempo instável de pressostato",
        sensorScale: "Escala do sensor",
      };

      const missing = Object.keys(errors).map((k) => fieldLabels[k] || k);
      const msg = missing.length
        ? `Preencha os campos obrigatórios:\n• ${missing.join("\n• ")}`
        : "";

      return { ok: missing.length === 0, errors, msg };
    },

    // =================
    // STEP 8 — Conectividade
    // =================
    renderConectividadeStep(container, state) {
      const errors = state._errors || {};

      if (!state.commType) state.commType = "4G";
      const isXbee = state.commType === "XBEE";

      container.innerHTML = `
        <div class="sc-config">

          <div class="sc-config__grid" style="margin-bottom:14px;">
            <div class="sc-field ${errors.commType ? "is-error" : ""}">
              <label class="equip-label" for="scCommType"><span class="equip-required">*</span>Tipo de comunicação</label>
              <select class="equip-input" id="scCommType" aria-invalid="${errors.commType ? "true" : "false"}">
                <option value="XBEE" ${state.commType === "XBEE" ? "selected" : ""}>Rádio</option>
                <option value="4G" ${state.commType !== "XBEE" ? "selected" : ""}>4G</option>
              </select>
              <div class="sc-error ${errors.commType ? "" : "is-hidden"}">Este campo é obrigatório</div>
            </div>
          </div>

          <div class="edit-panel__grid-3" style="margin-bottom:14px;">
            <div class="farm-radio-field ${isXbee ? "is-hidden" : ""}">
              <div class="farm-radio-field__header">
                <span class="farm-radio-field__label"><span class="equip-required">*</span>ID do equipamento</span>
              </div>
              <div class="farm-radio-field__value">
                <div class="sc-input-group">
                  <input class="equip-input sc-input farm-radio-input" id="scGateway" placeholder="10000000351D266D" value="${escapeHtml(state.gateway || "")}" aria-invalid="${errors.gateway ? "true" : "false"}" />
                  <div class="farm-radio-actions">
                    <button type="button" class="farm-radio-clear" title="Limpar" data-clear="scGateway"><i class="fa-solid fa-xmark"></i></button>
                    <span class="farm-radio-status"><i class="fa-solid fa-check"></i></span>
                  </div>
                  <button type="button" class="farm-radio-qr" title="Escanear QR Code"><i class="fa-solid fa-qrcode"></i></button>
                </div>
                <div class="sc-error ${errors.gateway ? "" : "is-hidden"}">Este campo é obrigatório</div>
              </div>
            </div>

            <div class="farm-radio-field ${isXbee ? "" : "is-hidden"}">
              <div class="farm-radio-field__header">
                <span class="farm-radio-field__label"><span class="equip-required">*</span>Rádio do controlador</span>
              </div>
              <div class="farm-radio-field__value">
                <div class="sc-input-group">
                  <input class="equip-input sc-input farm-radio-input" id="scRadioController" placeholder="0013A200422E3CC5" value="${escapeHtml(state.radioController || "")}" aria-invalid="${errors.radioController ? "true" : "false"}" />
                  <div class="farm-radio-actions">
                    <button type="button" class="farm-radio-clear" title="Limpar" data-clear="scRadioController"><i class="fa-solid fa-xmark"></i></button>
                    <span class="farm-radio-status"><i class="fa-solid fa-check"></i></span>
                  </div>
                  <button type="button" class="farm-radio-qr" title="Escanear QR Code"><i class="fa-solid fa-qrcode"></i></button>
                </div>
                <div class="sc-error ${errors.radioController ? "" : "is-hidden"}">Este campo é obrigatório</div>
              </div>
            </div>

            <div class="farm-radio-field ${isXbee ? "" : "is-hidden"}">
              <div class="farm-radio-field__header">
                <span class="farm-radio-field__label"><span class="equip-required">*</span>Rádio do GPS</span>
              </div>
              <div class="farm-radio-field__value">
                <div class="sc-input-group">
                  <input class="equip-input sc-input farm-radio-input" id="scRadioMonitor" placeholder="0013A20041F0A2E1" value="${escapeHtml(state.radioMonitor || "")}" aria-invalid="${errors.radioMonitor ? "true" : "false"}" />
                  <div class="farm-radio-actions">
                    <button type="button" class="farm-radio-clear" title="Limpar" data-clear="scRadioMonitor"><i class="fa-solid fa-xmark"></i></button>
                    <span class="farm-radio-status"><i class="fa-solid fa-check"></i></span>
                  </div>
                  <button type="button" class="farm-radio-qr" title="Escanear QR Code"><i class="fa-solid fa-qrcode"></i></button>
                </div>
                <div class="sc-error ${errors.radioMonitor ? "" : "is-hidden"}">Este campo é obrigatório</div>
              </div>
            </div>

            <div class="farm-radio-field ${isXbee ? "" : "is-hidden"}">
              <div class="farm-radio-field__header">
                <span class="farm-radio-field__label"><span class="equip-required">*</span>Rádio da bomba (Spoti)</span>
              </div>
              <div class="farm-radio-field__value">
                <div class="sc-input-group">
                  <input class="equip-input sc-input farm-radio-input" id="scRemoteCable" placeholder="0013A20031F0A2E4" value="${escapeHtml(state.remoteCable || "")}" aria-invalid="${errors.remoteCable ? "true" : "false"}" />
                  <div class="farm-radio-actions">
                    <button type="button" class="farm-radio-clear" title="Limpar" data-clear="scRemoteCable"><i class="fa-solid fa-xmark"></i></button>
                    <span class="farm-radio-status"><i class="fa-solid fa-check"></i></span>
                  </div>
                  <button type="button" class="farm-radio-qr" title="Escanear QR Code"><i class="fa-solid fa-qrcode"></i></button>
                </div>
                <div class="sc-error ${errors.remoteCable ? "" : "is-hidden"}">Este campo é obrigatório</div>
              </div>
            </div>
          </div>

        </div>
      `;

      this.bindConectividadeStep(container, state);
      if (window.IcEquipSelectInit) window.IcEquipSelectInit(container);
    },

    bindConectividadeStep(container, state) {
      const radioCtrlInput = container.querySelector("#scRadioCtrl");
      const radioGpsInput = container.querySelector("#scRadioGps");
      const radioBombaInput = container.querySelector("#scRadioBomba");

      if (radioCtrlInput) radioCtrlInput.addEventListener("input", () => { state.radioCtrl = radioCtrlInput.value.trim(); });
      if (radioGpsInput) radioGpsInput.addEventListener("input", () => { state.radioGps = radioGpsInput.value.trim(); });
      if (radioBombaInput) radioBombaInput.addEventListener("input", () => { state.radioBomba = radioBombaInput.value.trim(); });

      container.querySelectorAll("[data-clear]").forEach(btn => {
        btn.addEventListener("click", () => {
          const target = container.querySelector(`#${btn.dataset.clear}`);
          if (target) { target.value = ""; target.dispatchEvent(new Event("input")); }
        });
      });

      const commType = container.querySelector("#scCommType");
      const gatewayInput = container.querySelector("#scGateway");
      const radioControllerInput = container.querySelector("#scRadioController");
      const radioMonitorInput = container.querySelector("#scRadioMonitor");
      const remoteCableInput = container.querySelector("#scRemoteCable");

      if (commType) {
        commType.value = state.commType || "4G";
        commType.addEventListener("change", () => {
          state.commType = commType.value;
          if (state.commType !== "4G") state.gateway = "";
          if (state.commType !== "XBEE") {
            state.radioController = "";
            state.radioMonitor = "";
            state.remoteCable = "";
          }
          this.renderConectividadeStep(container, state);
        });
      }

      if (gatewayInput) {
        gatewayInput.addEventListener("input", () => {
          state.gateway = gatewayInput.value.trim();
        });
      }

      if (radioControllerInput) {
        radioControllerInput.addEventListener("input", () => {
          state.radioController = radioControllerInput.value.trim();
        });
      }

      if (radioMonitorInput) {
        radioMonitorInput.addEventListener("input", () => {
          state.radioMonitor = radioMonitorInput.value.trim();
        });
      }

      if (remoteCableInput) {
        remoteCableInput.addEventListener("input", () => {
          state.remoteCable = remoteCableInput.value.trim();
        });
      }
    },

    readConectividadeStep(container) {
      const commType = container.querySelector("#scCommType")?.value || "";
      const gateway = container.querySelector("#scGateway")?.value?.trim() || "";
      const radioController = container.querySelector("#scRadioController")?.value?.trim() || "";
      const radioMonitor = container.querySelector("#scRadioMonitor")?.value?.trim() || "";
      const remoteCable = container.querySelector("#scRemoteCable")?.value?.trim() || "";
      const radioCentral = container.querySelector("#scRadioCentral")?.value?.trim() || "";
      const radioCtrl = container.querySelector("#scRadioCtrl")?.value?.trim() || "";
      const radioGps = container.querySelector("#scRadioGps")?.value?.trim() || "";
      const radioBomba = container.querySelector("#scRadioBomba")?.value?.trim() || "";

      return { commType, gateway, radioController, radioMonitor, remoteCable, radioCentral, radioCtrl, radioGps, radioBomba };
    },

    validateConectividadeStep(data, state) {
      const errors = {};

      if (!data.commType) errors.commType = true;
      if (data.commType === "4G" && !data.gateway) errors.gateway = true;
      if (data.commType === "XBEE" && !data.radioController) errors.radioController = true;
      if (data.commType === "XBEE" && !data.radioMonitor) errors.radioMonitor = true;
      if (data.commType === "XBEE" && !data.remoteCable) errors.remoteCable = true;

      const fieldLabels = {
        commType: "Tipo de comunicação",
        gateway: "Número do gateway",
        radioController: "Rádio do controlador",
        radioMonitor: "Rádio do GPS",
        remoteCable: "Rádio da bomba (Spoti)",
      };

      const missing = Object.keys(errors).map((k) => fieldLabels[k] || k);
      const msg = missing.length
        ? `Preencha os campos obrigatórios:\n• ${missing.join("\n• ")}`
        : "";

      return { ok: missing.length === 0, errors, msg };
    },
  };
})();
