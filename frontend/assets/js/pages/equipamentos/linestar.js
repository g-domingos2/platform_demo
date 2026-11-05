// assets/js/pages/equipamentos/linestar.js
(function () {
  "use strict";

  window.IcEquipamentos = window.IcEquipamentos || {};

  // escapeHtml/parseLatLng/formatLatLng/destinationPoint compartilhados — ver assets/js/core/geo-utils.js
  const { escapeHtml, parseLatLng, formatLatLng, destinationPoint } = window.IcGeo;

  function haversineDistance(a, b) {
    const R = 6378137;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const h = sinDLat * sinDLat +
      Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * sinDLng * sinDLng;
    return R * 2 * Math.asin(Math.sqrt(h));
  }

  function bearingBetweenPoints(a, b) {
    const phi1 = a.lat * Math.PI / 180;
    const phi2 = b.lat * Math.PI / 180;
    const deltaLambda = (b.lng - a.lng) * Math.PI / 180;
    const y = Math.sin(deltaLambda) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
    const theta = Math.atan2(y, x);
    return (theta * 180 / Math.PI + 360) % 360;
  }

  function midpointBetweenPoints(a, b) {
    return {
      lat: (a.lat + b.lat) / 2,
      lng: (a.lng + b.lng) / 2,
    };
  }

  function getReadableBadgeRotation(angleDeg) {
    let rotation = ((angleDeg % 360) + 360) % 360;
    if (rotation > 90 && rotation < 270) rotation -= 180;
    return rotation;
  }

  function buildTrackBadgeIcon(angleDeg, distanceMeters) {
    if (!window.L) return null;
    const safeAngle = Number.isFinite(angleDeg) ? Math.round(angleDeg) : 0;
    const safeDistance = Number.isFinite(distanceMeters) ? Math.round(distanceMeters) : 0;
    const rotation = getReadableBadgeRotation(safeAngle);
    return L.divIcon({
      className: "ls-track-badge-wrap",
      html: `
        <div class="ls-track-badge" style="--ls-track-angle:${rotation}deg;">
          <span>${safeAngle}&deg;</span>
          <span>${safeDistance}m</span>
        </div>
      `,
      iconSize: [1, 1],
      iconAnchor: [0, 0],
    });
  }

  function toLocalMeters(p, refLat) {
    const metersPerDegLat = 111320;
    const metersPerDegLng = 111320 * Math.cos(refLat * Math.PI / 180);
    return {
      x: p.lng * metersPerDegLng,
      y: p.lat * metersPerDegLat,
    };
  }

  function decomposeAlongPerpMeters(origin, point, bearingDeg) {
    const refLat = origin.lat;
    const O = toLocalMeters(origin, refLat);
    const P = toLocalMeters(point, refLat);
    const dx = P.x - O.x;
    const dy = P.y - O.y;
    const t = bearingDeg * Math.PI / 180;
    const ux = Math.sin(t);
    const uy = Math.cos(t);
    const along = Math.max(0, dx * ux + dy * uy);
    const perp = Math.abs(dx * uy - dy * ux);
    return { along, perp };
  }

  function signedPerpendicularDistanceMeters(origin, point, bearingDeg) {
    const refLat = origin.lat;
    const O = toLocalMeters(origin, refLat);
    const P = toLocalMeters(point, refLat);
    const dx = P.x - O.x;
    const dy = P.y - O.y;
    const t = bearingDeg * Math.PI / 180;
    return dx * Math.cos(t) - dy * Math.sin(t);
  }

  function getLineWidths(state) {
    const legacyWidth = parseNumber(state.width);
    const legacySide = state.widthSide === -1 ? -1 : 1;
    const widthA = state.widthA == null
      ? (legacySide === -1 ? legacyWidth : 0)
      : parseNumber(state.widthA);
    const widthB = state.widthB == null
      ? (legacySide === 1 ? legacyWidth : 0)
      : parseNumber(state.widthB);
    return {
      widthA: Math.max(0, widthA),
      widthB: Math.max(0, widthB),
    };
  }

  function parseNumber(value) {
    const normalized = String(value ?? "").trim().replace(",", ".");
    if (!normalized) return null;
    const num = Number(normalized);
    return Number.isFinite(num) ? num : null;
  }

  const segmentPalette = [
    "rgb(0, 31, 153)",
    "rgb(160, 0, 229)",
    "rgb(0, 196, 179)",
    "rgb(82, 183, 0)",
    "rgb(255, 213, 0)",
    "rgb(255, 115, 0)",
    "rgb(142, 68, 173)",
    "rgb(22, 160, 133)",
    "rgb(233, 30, 99)",
  ];

  function interpolatePoint(from, to, ratio) {
    return {
      lat: from.lat + (to.lat - from.lat) * ratio,
      lng: from.lng + (to.lng - from.lng) * ratio,
    };
  }

  function clampPercent(value) {
    return Math.max(0, Math.min(100, Number(value) || 0));
  }

  function roundPercent(value) {
    return Math.round((Number(value) || 0) * 10) / 10;
  }

  function parsePercentDraft(value) {
    const text = String(value ?? "").trim().replace(",", ".");
    if (!text || text === "-" || text === "." || text === "-." || /[.,]$/.test(text)) return null;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function projectPercentOnTrack(point, a, b) {
    const refLat = (a.lat + b.lat) / 2;
    const P = toLocalMeters(point, refLat);
    const A = toLocalMeters(a, refLat);
    const B = toLocalMeters(b, refLat);
    const ABx = B.x - A.x;
    const ABy = B.y - A.y;
    const APx = P.x - A.x;
    const APy = P.y - A.y;
    const ab2 = ABx * ABx + ABy * ABy;
    if (ab2 <= 1e-9) return 0;
    const t = Math.max(0, Math.min(1, (APx * ABx + APy * ABy) / ab2));
    return t * 100;
  }

  function normalizeSegments(segments) {
    const list = Array.isArray(segments) && segments.length ? segments : [];
    if (!list.length) return [{ name: "", startPercent: 0, endPercent: 100 }];

    const normalized = [];
    let currentStart = 0;
    list.forEach((segment, idx) => {
      const isLast = idx === list.length - 1;
      const rawEnd = Number(segment?.endPercent);
      let endPercent = Number.isFinite(rawEnd) ? clampPercent(rawEnd) : 100;
      endPercent = isLast ? 100 : Math.max(currentStart + 0.1, Math.min(99.9, endPercent));
      normalized.push({
        name: String(segment?.name || ""),
        startPercent: roundPercent(currentStart),
        endPercent: roundPercent(endPercent),
      });
      currentStart = endPercent;
    });

    normalized[0].startPercent = 0;
    normalized[normalized.length - 1].endPercent = 100;
    for (let i = 1; i < normalized.length; i += 1) normalized[i].startPercent = normalized[i - 1].endPercent;
    return normalized;
  }

  function buildLineSegmentPolygon(a, b, widthMeters, startPercent, endPercent, side = 1) {
    if (!(widthMeters > 0)) return [];
    const startPt = interpolatePoint(a, b, clampPercent(startPercent) / 100);
    const endPt = interpolatePoint(a, b, clampPercent(endPercent) / 100);
    const bearing = bearingBetweenPoints(a, b);
    const outerBearing = (bearing + side * 90 + 360) % 360;
    const endOuter = destinationPoint(endPt, widthMeters, outerBearing);
    const startOuter = destinationPoint(startPt, widthMeters, outerBearing);
    return [
      [startPt.lat, startPt.lng],
      [endPt.lat, endPt.lng],
      [endOuter.lat, endOuter.lng],
      [startOuter.lat, startOuter.lng],
    ];
  }

  function normalizeEndGunSegments(segments) {
    const list = (Array.isArray(segments) ? segments : [])
      .map((segment) => ({
        startPercent: clampPercent(segment?.startPercent),
        endPercent: clampPercent(segment?.endPercent),
      }))
      .filter((segment) => segment.endPercent > segment.startPercent)
      .sort((a, b) => a.startPercent - b.startPercent);

    const normalized = [];
    list.forEach((segment) => {
      const previous = normalized[normalized.length - 1] || null;
      const minStart = previous ? roundPercent(previous.endPercent + 0.1) : 0;
      const startPercent = roundPercent(Math.max(minStart, segment.startPercent));
      const endPercent = roundPercent(Math.min(100, Math.max(startPercent + 0.1, segment.endPercent)));
      if (endPercent <= startPercent) return;
      normalized.push({ startPercent, endPercent });
    });
    return normalized;
  }

  function clampEndGunStartPercent(index, nextPercent, segs) {
    const current = segs[index];
    if (!current) return 0;
    const previous = segs[index - 1] || null;
    const minValue = previous ? previous.endPercent + 0.1 : 0;
    const maxValue = current.endPercent - 0.1;
    return roundPercent(Math.max(minValue, Math.min(maxValue, clampPercent(nextPercent))));
  }

  function clampEndGunEndPercent(index, nextPercent, segs) {
    const current = segs[index];
    if (!current) return 100;
    const minValue = current.startPercent + 0.1;
    const next = segs[index + 1] || null;
    const maxValue = next ? next.startPercent - 0.1 : 100;
    return roundPercent(Math.max(minValue, Math.min(Math.max(minValue, maxValue), clampPercent(nextPercent))));
  }

  function getTrackEdgePoint(a, b, widthMeters, percent, side, widthSide = 1) {
    const point = interpolatePoint(a, b, clampPercent(percent) / 100);
    const bearing = bearingBetweenPoints(a, b);
    const edgeBearing = (bearing + side * 90 + 360) % 360;
    return destinationPoint(point, side === widthSide ? widthMeters : 0, edgeBearing);
  }

  function buildOuterBandPolygon(a, b, widthMeters, startPercent, endPercent, extensionMeters, side, widthSide = 1) {
    if (!(widthMeters > 0) || !(extensionMeters > 0)) return [];
    const inner = side === widthSide ? widthMeters : 0;
    const outer = inner + extensionMeters;
    const startPt = interpolatePoint(a, b, clampPercent(startPercent) / 100);
    const endPt = interpolatePoint(a, b, clampPercent(endPercent) / 100);
    const bearing = bearingBetweenPoints(a, b);
    const edgeBearing = (bearing + side * 90 + 360) % 360;
    const startInner = destinationPoint(startPt, inner, edgeBearing);
    const endInner = destinationPoint(endPt, inner, edgeBearing);
    const startOuter = destinationPoint(startPt, outer, edgeBearing);
    const endOuter = destinationPoint(endPt, outer, edgeBearing);
    return [
      [startInner.lat, startInner.lng],
      [endInner.lat, endInner.lng],
      [endOuter.lat, endOuter.lng],
      [startOuter.lat, startOuter.lng],
    ];
  }

  function pinIcon(which) {
    if (!window.L) return null;
    const type = which === "A" ? "center" : "ref";
    return L.divIcon({
      className: "",
      html: '<div class="pivot-pin pivot-pin--' + type + '"><i class="fa-solid fa-location-dot"></i></div>',
      iconSize: [28, 32],
      iconAnchor: [14, 32],
    });
  }

  // Acha o ancestral rolável (área de rolagem do modal). Reaproveita a
  // mesma técnica usada no fix do "título bugando" no Nexus/SmartConnect.
  function getScrollParent(el) {
    // Começa pelo próprio elemento: no assistente de criar equipamento, o
    // "container" passado pra cá JÁ É o `.create-equip__dynamic`, o div que
    // rola de verdade — começar por `el.parentElement` pulava ele.
    //
    // Aceita também overflow:hidden: existe uma regra CSS
    // (.create-equip__dynamic:has(.pivo-edit-specifics) { overflow:hidden })
    // que troca esse container de auto pra hidden justamente nos steps de
    // Traçado/Segmentos/Canhão — e o scrollTop dele continua mudando sozinho
    // mesmo com overflow:hidden (o Leaflet foca o mapa e o navegador rola o
    // ancestral pra revelar o foco). Exigir "scrollHeight > clientHeight" no
    // momento da checagem também falhava: na primeiríssima renderização o
    // mapa ainda não tinha altura aplicada, então os dois batiam e a busca
    // devolvia null.
    let node = el;
    while (node) {
      const oy = getComputedStyle(node).overflowY;
      if (oy === "auto" || oy === "scroll" || oy === "hidden") return node;
      node = node.parentElement;
    }
    return null;
  }

  // Executa fn() preservando a posição de rolagem: mudanças de altura no
  // conteúdo (lista de segmentos, mapa) fazem o navegador "pular" a tela e
  // dar a impressão de título quebrado. Restaura o scroll no frame seguinte
  // também, pois o navegador rola o elemento recém-focado para dentro da view.
  function withPreservedScroll(container, fn) {
    const sp = getScrollParent(container);
    const prevTop = sp ? sp.scrollTop : window.scrollY;
    const restore = () => { if (sp) sp.scrollTop = prevTop; else window.scrollTo(window.scrollX, prevTop); };
    fn();
    restore();
    requestAnimationFrame(restore);
  }

  // Trava a rolagem do modal enquanto o usuário interage com o mapa
  // (pan, zoom, scroll-zoom, duplo-clique, arraste de qualquer coisa dentro
  // dele). Em vez de confiar só nos eventos semânticos do Leaflet (que podem
  // não cobrir todo caminho que dispara um scroll), a gente trava no
  // mousedown/touchstart do próprio elemento do mapa e fica "grudando" a
  // rolagem de volta em toda mudança até soltar o botão — pega a causa raiz
  // não importa de onde ela vier.
  function lockScrollDuringMapInteraction(container, map, mapEl, { allowWheelZoom = false } = {}) {
    const sp = getScrollParent(container);
    let lockedTop = null;
    let active = false;

    const getTop = () => (sp ? sp.scrollTop : window.scrollY);
    const setTop = (v) => { if (sp) sp.scrollTop = v; else window.scrollTo(window.scrollX, v); };

    const onScroll = () => {
      if (!active || lockedTop === null) return;
      if (getTop() !== lockedTop) setTop(lockedTop);
    };

    const stop = () => {
      if (!active) return;
      active = false;
      setTop(lockedTop);
      requestAnimationFrame(() => setTop(lockedTop));
      (sp || window).removeEventListener("scroll", onScroll, true);
      document.removeEventListener("mouseup", stop, true);
      document.removeEventListener("touchend", stop, true);
      lockedTop = null;
    };

    const start = () => {
      if (active) return;
      active = true;
      lockedTop = getTop();
      (sp || window).addEventListener("scroll", onScroll, true);
      document.addEventListener("mouseup", stop, true);
      document.addEventListener("touchend", stop, true);
    };

    if (mapEl) {
      mapEl.addEventListener("mousedown", start, true);
      mapEl.addEventListener("touchstart", start, true);
      if (!allowWheelZoom) {
        mapEl.addEventListener("wheel", (e) => e.preventDefault(), { passive: false });
      }
    }
    if (map) {
      map.on("movestart zoomstart", start);
      map.on("moveend zoomend", stop);
    }
  }

  // Mapa único, compartilhado entre os steps Traçado/Segmentos/Canhão —
  // igual ao padrão já usado no Nexus/SmartConnect (state._scLocMap): em
  // vez de criar e destruir um L.map() novo toda vez que entra no step, o
  // MESMO mapa é reaproveitado e só o elemento DOM dele é realocado pro
  // slot do step atual. Evita qualquer instabilidade de criar/destruir o
  // Leaflet repetidamente.
  function ensureSharedPreviewMap(container, state, a, b) {
    if (state._lsPreviewWidthPickerCleanup) {
      state._lsPreviewWidthPickerCleanup();
      state._lsPreviewWidthPickerCleanup = null;
    }

    const slot = container.querySelector("#lsPreviewMapSlot");
    const placeholder = container.querySelector("#lsPreviewMap");
    if (!slot) return null;
    const showIntermediatePositions = Boolean(container.querySelector("#lsIntermediateList"));
    const syncIntermediateLayerVisibility = (map) => {
      const layer = state._lsPreviewIntermediateLayer;
      if (!layer || !map) return;
      if (showIntermediatePositions) {
        if (!map.hasLayer(layer)) map.addLayer(layer);
      } else {
        layer.clearLayers();
        if (map.hasLayer(layer)) map.removeLayer(layer);
      }
    };

    const hasPoints = Number.isFinite(a.lat) && Number.isFinite(a.lng) && Number.isFinite(b.lat) && Number.isFinite(b.lng);
    const fitPoints = hasPoints
      ? [[a.lat, a.lng], [b.lat, b.lng]]
      : [];
    const { widthA, widthB } = getLineWidths(state);
    if (hasPoints) {
      if (widthA > 0) {
        const outerBearing = (bearingBetweenPoints(a, b) + 270) % 360;
        const outerA = destinationPoint(a, widthA, outerBearing);
        const outerB = destinationPoint(b, widthA, outerBearing);
        fitPoints.push([outerA.lat, outerA.lng], [outerB.lat, outerB.lng]);
      }
      if (widthB > 0) {
        const outerBearing = (bearingBetweenPoints(a, b) + 90) % 360;
        const outerA = destinationPoint(a, widthB, outerBearing);
        const outerB = destinationPoint(b, widthB, outerBearing);
        fitPoints.push([outerA.lat, outerA.lng], [outerB.lat, outerB.lng]);
      }
    }

    if (state._lsPreviewMap) {
      const mapEl = state._lsPreviewMap.getContainer();
      if (placeholder && placeholder !== mapEl) placeholder.remove();
      slot.appendChild(mapEl);
      if (hasPoints) {
        state._lsPreviewMap.fitBounds(L.latLngBounds(fitPoints), { padding: [40, 40] });
      }
      syncIntermediateLayerVisibility(state._lsPreviewMap);
      setTimeout(() => {
        if (!state._lsPreviewMap._mapPane) return;
        state._lsPreviewMap.invalidateSize();
      }, 50);
      return state._lsPreviewMap;
    }

    if (!placeholder || !window.L) return null;

    const map = L.map(placeholder, {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: true,
    });
    lockScrollDuringMapInteraction(container, map, placeholder, { allowWheelZoom: true });
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
    }).addTo(map);

    if (hasPoints) {
      L.polyline([[a.lat, a.lng], [b.lat, b.lng]], { color: "#ffffff", weight: 2, opacity: 0.9 }).addTo(map);
      map.fitBounds(L.latLngBounds(fitPoints), { padding: [40, 40] });
    } else {
      map.setView([-15.780101, -47.930499], 15);
    }

    state._lsPreviewMap = map;
    syncIntermediateLayerVisibility(map);
    setTimeout(() => map.invalidateSize(), 200);
    return map;
  }

  window.IcEquipamentos.linestar = {
    label: "LineStar",

    // =================
    // STEP 2 — Localização
    // =================
    renderStep2(container, state) {
      const aText = state.locA || formatLatLng(state.latA, state.lngA) || "";
      const bText = state.locB || formatLatLng(state.latB, state.lngB) || "";
      const dist = (Number.isFinite(state.trackLengthCalc) && state.trackLengthCalc > 0)
        ? `${state.trackLengthCalc.toFixed(0)} m` : "\u2014";
      const endGunMode = state.endGunMode || "none";
      const showEgA = endGunMode === "a" || endGunMode === "ab";
      const showEgB = endGunMode === "b" || endGunMode === "ab";

      container.innerHTML = `
        <div class="sc-loc sc-loc--vertical ls-loc">
          <div class="sc-loc__top">
            <div class="sc-loc__grid">

              <div class="sc-loc__field" style="grid-column: 1 / -1;">
                <label class="sc-loc__label" for="lsLocA">
                  <span class="equip-required">*</span>
                  Ponto de In\u00edcio (A)
                  <span class="edit-panel__tooltip-icon" data-tooltip="Coordenada onde a linha de irriga\u00e7\u00e3o come\u00e7a a se deslocar."><i class="fa-regular fa-circle-question"></i></span>
                </label>
                <div class="sc-loc__row">
                  <div class="sc-loc__input-wrapper">
                    <input class="equip-input sc-loc__input-field" id="lsLocA"
                           placeholder="-15.780101, -47.930499"
                           value="${escapeHtml(aText)}" />
                  </div>
                  <button class="equip-btn btn btn--outline sc-loc__btn sc-loc__btn--center ls-loc__btn--a"
                          type="button" data-action="ls-pick-a">
                    <i class="fa-solid fa-location-dot" aria-hidden="true"></i> Obter Localização
                  </button>
                </div>
              </div>

              <div class="sc-loc__field" style="grid-column: 1 / -1;">
                <label class="sc-loc__label" for="lsLocB">
                  <span class="equip-required">*</span>
                  Ponto de Fim (B)
                  <span class="edit-panel__tooltip-icon" data-tooltip="Coordenada onde a linha de irrigação termina o deslocamento."><i class="fa-regular fa-circle-question"></i></span>
                </label>
                <div class="sc-loc__row">
                  <div class="sc-loc__input-wrapper">
                    <input class="equip-input sc-loc__input-field" id="lsLocB"
                           placeholder="-15.780101, -47.925000"
                           value="${escapeHtml(bText)}" />
                  </div>
                  <button class="equip-btn btn btn--outline sc-loc__btn sc-loc__btn--ref ls-loc__btn--b"
                          type="button" data-action="ls-pick-b">
                    <i class="fa-solid fa-location-dot" aria-hidden="true"></i> Obter Localização
                  </button>
                </div>
              </div>

              <div class="sc-loc__field" style="display:none">
                <label class="sc-loc__label" for="lsEndGunMode">Canhão</label>
                <div class="sc-loc__row">
                  <div class="sc-loc__input-wrapper">
                    <select class="equip-input sc-loc__input-field" id="lsEndGunMode">
                      <option value="none" ${endGunMode === "none" ? "selected" : ""}>Nenhum</option>
                      <option value="a" ${endGunMode === "a" ? "selected" : ""}>A</option>
                      <option value="b" ${endGunMode === "b" ? "selected" : ""}>B</option>
                      <option value="ab" ${endGunMode === "ab" ? "selected" : ""}>A e B</option>
                    </select>
                  </div>
                </div>
              </div>

              <div class="sc-loc__field" id="lsEgAField" style="${showEgA ? "" : "display:none"}">
                <label class="sc-loc__label" for="lsEgALoc">Alcance extra (A)</label>
                <div class="sc-loc__row">
                  <div class="sc-loc__input-wrapper">
                    <input class="equip-input sc-loc__input-field" id="lsEgALoc" placeholder="Ponto do canh\u00e3o (opcional)"
                           value="${escapeHtml(state.endGunALoc || formatLatLng(state.endGunALat, state.endGunALng) || "")}" />
                  </div>
                  <button class="equip-btn btn btn--outline sc-loc__btn" type="button" data-action="ls-pick-ea">
                    <i class="fa-solid fa-up-down-left-right" aria-hidden="true"></i> Marcar
                  </button>
                </div>
                <div class="ls-eg-info" id="lsEgAInfo"></div>
              </div>

              <div class="sc-loc__field" id="lsEgBField" style="${showEgB ? "" : "display:none"}">
                <label class="sc-loc__label" for="lsEgBLoc">Alcance extra (B)</label>
                <div class="sc-loc__row">
                  <div class="sc-loc__input-wrapper">
                    <input class="equip-input sc-loc__input-field" id="lsEgBLoc" placeholder="Ponto do canh\u00e3o (opcional)"
                           value="${escapeHtml(state.endGunBLoc || formatLatLng(state.endGunBLat, state.endGunBLng) || "")}" />
                  </div>
                  <button class="equip-btn btn btn--outline sc-loc__btn" type="button" data-action="ls-pick-eb">
                    <i class="fa-solid fa-up-down-left-right" aria-hidden="true"></i> Marcar
                  </button>
                </div>
                <div class="ls-eg-info" id="lsEgBInfo"></div>
              </div>

            </div>

          </div>

          <div class="sc-loc__map-wrapper ls-loc__map-wrapper">
            <div id="lsMap" class="sc-loc__map ls-loc__map"></div>
          </div>
        </div>
      `;

      this.initMap(container, state);
      this.bindStep2(container, state);
      if (window.IcEquipSelectInit) window.IcEquipSelectInit(container);
    },

    initMap(container, state) {
      if (!window.L) return;
      const initialWidths = getLineWidths(state);
      state.widthA = initialWidths.widthA > 0 ? String(initialWidths.widthA) : "";
      state.widthB = initialWidths.widthB > 0 ? String(initialWidths.widthB) : "";
      state.width = (initialWidths.widthA + initialWidths.widthB).toFixed(2);

      const mapEl = container.querySelector("#lsMap");
      const mapWrapper = mapEl?.closest(".ls-loc__map-wrapper") || mapEl?.parentElement;
      if (!mapEl) return;

      if (state._lsMap) {
        try { state._lsMap.remove(); } catch (_) {}
        state._lsMap = null;
      }

      // Crosshair CAD — cria o elemento e posiciona via mousemove
      let crosshairEl = mapWrapper?.querySelector(".ls-crosshair");
      if (!crosshairEl && mapWrapper) {
        crosshairEl = document.createElement("div");
        crosshairEl.className = "ls-crosshair";
        crosshairEl.innerHTML = `
          <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- sombra para contraste em qualquer fundo -->
            <line x1="18" y1="0"  x2="18" y2="13" stroke="#000" stroke-width="3" stroke-linecap="round" opacity=".35"/>
            <line x1="18" y1="23" x2="18" y2="36" stroke="#000" stroke-width="3" stroke-linecap="round" opacity=".35"/>
            <line x1="0"  y1="18" x2="13" y2="18" stroke="#000" stroke-width="3" stroke-linecap="round" opacity=".35"/>
            <line x1="23" y1="18" x2="36" y2="18" stroke="#000" stroke-width="3" stroke-linecap="round" opacity=".35"/>
            <!-- linhas brancas -->
            <line x1="18" y1="0"  x2="18" y2="13" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="18" y1="23" x2="18" y2="36" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="0"  y1="18" x2="13" y2="18" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="23" y1="18" x2="36" y2="18" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
            <!-- círculo central -->
            <circle cx="18" cy="18" r="3" stroke="#000" stroke-width="3" opacity=".35"/>
            <circle cx="18" cy="18" r="3" stroke="#fff" stroke-width="1.5"/>
          </svg>`;
        mapWrapper.appendChild(crosshairEl);

        mapWrapper.addEventListener("mousemove", (e) => {
          const rect = mapWrapper.getBoundingClientRect();
          crosshairEl.style.left = `${e.clientX - rect.left}px`;
          crosshairEl.style.top  = `${e.clientY - rect.top}px`;
        });
      }

      // Centro padrão: fazenda ativa
      const farmCoords = (() => {
        const farm = window.IcFarmActive;
        if (farm && Number.isFinite(farm.lat) && Number.isFinite(farm.lng))
          return { lat: farm.lat, lng: farm.lng };
        return null;
      })();

      const fallback = farmCoords || { lat: -16.767, lng: -47.613 };
      const ptA = (Number.isFinite(state.latA) && Number.isFinite(state.lngA))
        ? { lat: state.latA, lng: state.lngA } : null;
      const ptB = (Number.isFinite(state.latB) && Number.isFinite(state.lngB))
        ? { lat: state.latB, lng: state.lngB } : null;

      const center = ptA || ptB || fallback;
      const zoom = (ptA || ptB) ? 17 : (farmCoords ? 16 : 14);

      const map = L.map(mapEl, { zoomControl: false }).setView([center.lat, center.lng], zoom);
      lockScrollDuringMapInteraction(container, map, mapEl);

      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, attribution: "Tiles \u00a9 Esri" }
      ).addTo(map);

      L.tileLayer(
        "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, opacity: 0.85 }
      ).addTo(map);

      // Cursor crosshair estilo CAD
      mapEl.classList.add("ls-map--crosshair");

      const lineStyle = { color: "#facc15", weight: 3, dashArray: "8 5", opacity: 0.9 };
      let polyline = null;
      let trackBadge = null;
      const corridorStyle = {
        color: "#ffffff",
        weight: 2,
        opacity: 0.9,
        fillColor: "#ffffff",
        fillOpacity: 0.12,
      };
      let corridors = [];
      const endGunStyle = {
        color: "#a855f7",
        weight: 2,
        opacity: 0.95,
        fillColor: "#a855f7",
        fillOpacity: 0.16,
      };
      let endGunBandA = null;
      let endGunBandB = null;

      let markerA = ptA
        ? L.marker([ptA.lat, ptA.lng], { icon: pinIcon("A"), draggable: true }).addTo(map)
        : null;
      let markerB = ptB
        ? L.marker([ptB.lat, ptB.lng], { icon: pinIcon("B"), draggable: true }).addTo(map)
        : null;

      const endGunHandleIcon = L.divIcon({
        className: "",
        html: '<div style="width:14px;height:14px;border-radius:50%;background:#a855f7;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,.4);"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const ptEgA = (Number.isFinite(state.endGunALat) && Number.isFinite(state.endGunALng))
        ? { lat: state.endGunALat, lng: state.endGunALng }
        : null;
      const ptEgB = (Number.isFinite(state.endGunBLat) && Number.isFinite(state.endGunBLng))
        ? { lat: state.endGunBLat, lng: state.endGunBLng }
        : null;

      let markerEgA = ptEgA
        ? L.marker([ptEgA.lat, ptEgA.lng], { icon: endGunHandleIcon, draggable: true }).addTo(map)
        : null;
      let markerEgB = ptEgB
        ? L.marker([ptEgB.lat, ptEgB.lng], { icon: endGunHandleIcon, draggable: true }).addTo(map)
        : null;

      if (ptA && ptB) {
        polyline = L.polyline([[ptA.lat, ptA.lng], [ptB.lat, ptB.lng]], lineStyle).addTo(map);
        map.fitBounds([[ptA.lat, ptA.lng], [ptB.lat, ptB.lng]], { padding: [40, 40] });
      }

      const updateDistanceDisplay = (a, b) => {
        if (!a || !b) return;
        const dist = haversineDistance(a, b);
        const bearing = bearingBetweenPoints(a, b);
        state.trackLengthCalc = dist;
        state.trackBearingCalc = bearing;
        const el = container.querySelector("#lsDistValue");
        if (el) el.textContent = `${dist.toFixed(0)} m`;
      };

      const updateTrackBadge = (a, b) => {
        if (!a || !b) {
          if (trackBadge) {
            map.removeLayer(trackBadge);
            trackBadge = null;
          }
          return;
        }
        const distance = haversineDistance(a, b);
        const bearing = bearingBetweenPoints(a, b);
        const midpoint = midpointBetweenPoints(a, b);
        const icon = buildTrackBadgeIcon(bearing, distance);
        if (!icon) return;
        if (trackBadge) {
          trackBadge.setLatLng([midpoint.lat, midpoint.lng]);
          trackBadge.setIcon(icon);
          return;
        }
        trackBadge = L.marker([midpoint.lat, midpoint.lng], {
          icon,
          interactive: false,
          keyboard: false,
          zIndexOffset: 900,
        }).addTo(map);
      };

      const updateLine = () => {
        const a = markerA ? markerA.getLatLng() : null;
        const b = markerB ? markerB.getLatLng() : null;
        if (!a || !b) {
          if (polyline) polyline.setLatLngs([]);
          corridors.forEach((item) => map.removeLayer(item));
          corridors = [];
          updateTrackBadge(null, null);
          return;
        }
        const coords = [a, b];
        if (polyline) { polyline.setLatLngs(coords); }
        else { polyline = L.polyline(coords, lineStyle).addTo(map); }
        const pointA = { lat: a.lat, lng: a.lng };
        const pointB = { lat: b.lat, lng: b.lng };
        updateDistanceDisplay(pointA, pointB);
        updateTrackBadge(pointA, pointB);
        updateCorridor();
      };

      const updateCorridor = () => {
        const a = markerA ? markerA.getLatLng() : null;
        const b = markerB ? markerB.getLatLng() : null;
        const { widthA, widthB } = getLineWidths(state);
        if (!a || !b || (widthA <= 0 && widthB <= 0)) {
          corridors.forEach((item) => map.removeLayer(item));
          corridors = [];
          if (endGunBandA) endGunBandA.setLatLngs([]);
          if (endGunBandB) endGunBandB.setLatLngs([]);
          return;
        }
        const bearing = bearingBetweenPoints({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng });
        const endGunMode = state.endGunMode || "none";
        const showEgA = endGunMode === "a" || endGunMode === "ab";
        const showEgB = endGunMode === "b" || endGunMode === "ab";
        if (markerEgA) markerEgA.setOpacity(showEgA ? 1 : 0);
        if (markerEgB) markerEgB.setOpacity(showEgB ? 1 : 0);
        const hasEgA = showEgA && markerEgA;
        const hasEgB = showEgB && markerEgB;

        let extA = 0;
        let extB = 0;
        let perpA = 0;
        let perpB = 0;
        const infoA = container.querySelector("#lsEgAInfo");
        const infoB = container.querySelector("#lsEgBInfo");
        if (!hasEgA && infoA) infoA.textContent = "";
        if (!hasEgB && infoB) infoB.textContent = "";
        if (hasEgA) {
          const p = markerEgA.getLatLng();
          const decomp = decomposeAlongPerpMeters(
            { lat: a.lat, lng: a.lng },
            { lat: p.lat, lng: p.lng },
            (bearing + 180) % 360
          );
          extA = decomp.along;
          perpA = decomp.perp;
          state.endGunASide = signedPerpendicularDistanceMeters(
            { lat: a.lat, lng: a.lng }, { lat: p.lat, lng: p.lng }, bearing
          ) < 0 ? -1 : 1;
          state.endGunALen = extA;
          const baseWidth = state.endGunASide < 0 ? widthA : widthB;
          const extraHalf = Math.max(0, perpA - baseWidth);
          if (infoA) infoA.textContent = extraHalf > 0 ? `+${extraHalf.toFixed(0)} m` : "";
        }
        if (hasEgB) {
          const p = markerEgB.getLatLng();
          const decomp = decomposeAlongPerpMeters(
            { lat: b.lat, lng: b.lng },
            { lat: p.lat, lng: p.lng },
            bearing
          );
          extB = decomp.along;
          perpB = decomp.perp;
          state.endGunBSide = signedPerpendicularDistanceMeters(
            { lat: b.lat, lng: b.lng }, { lat: p.lat, lng: p.lng }, bearing
          ) < 0 ? -1 : 1;
          state.endGunBLen = extB;
          const baseWidth = state.endGunBSide < 0 ? widthA : widthB;
          const extraHalf = Math.max(0, perpB - baseWidth);
          if (infoB) infoB.textContent = extraHalf > 0 ? `+${extraHalf.toFixed(0)} m` : "";
        }

        corridors.forEach((item) => map.removeLayer(item));
        corridors = [];
        [
          { width: widthA, side: -1 },
          { width: widthB, side: 1 },
        ].forEach(({ width, side }) => {
          if (width <= 0) return;
          const outerBearing = (bearing + side * 90 + 360) % 360;
          const outerA = destinationPoint({ lat: a.lat, lng: a.lng }, width, outerBearing);
          const outerB = destinationPoint({ lat: b.lat, lng: b.lng }, width, outerBearing);
          const corridor = L.polygon([
            [a.lat, a.lng],
            [b.lat, b.lng],
            [outerB.lat, outerB.lng],
            [outerA.lat, outerA.lng],
          ], {
            ...corridorStyle,
            interactive: false,
          }).addTo(map);
          corridors.push(corridor);
        });

        // Faixa extra do canhão final (extensão da largura)
        const drawEndGunBand = (which) => {
          const isA = which === "A";
          const endGunSide = (isA ? state.endGunASide : state.endGunBSide) || 1;
          const baseWidth = endGunSide < 0 ? widthA : widthB;
          const widthBearing = (bearing + endGunSide * 90 + 360) % 360;
          const perpendicularDistance = isA ? perpA : perpB;
          const enabled = (isA ? showEgA : showEgB) && perpendicularDistance > baseWidth + 0.01;
          const band = isA ? endGunBandA : endGunBandB;
          if (!enabled) {
            if (band) band.setLatLngs([]);
            return;
          }
          const origin = isA ? { lat: a.lat, lng: a.lng } : { lat: b.lat, lng: b.lng };
          const outBearing = isA ? (bearing + 180) % 360 : bearing;
          const along = isA ? extA : extB;
          const outerWidth = Math.max(baseWidth, perpendicularDistance);
          const minBandLen = 20;
          const bandLen = along > 0 ? along : minBandLen;
          const axis = destinationPoint(origin, bandLen, outBearing);
          const innerOrigin = destinationPoint(origin, baseWidth, widthBearing);
          const innerAxis = destinationPoint(axis, baseWidth, widthBearing);
          const outerOrigin = destinationPoint(origin, outerWidth, widthBearing);
          const outerAxis = destinationPoint(axis, outerWidth, widthBearing);
          const points = [
            [innerOrigin.lat, innerOrigin.lng],
            [innerAxis.lat, innerAxis.lng],
            [outerAxis.lat, outerAxis.lng],
            [outerOrigin.lat, outerOrigin.lng],
          ];

          if (band) band.setLatLngs(points);
          else if (isA) endGunBandA = L.polygon(points, endGunStyle).addTo(map);
          else endGunBandB = L.polygon(points, endGunStyle).addTo(map);
        };
        drawEndGunBand("A");
        drawEndGunBand("B");
      };

      const setPoint = (which, lat, lng) => {
        const input = container.querySelector(which === "A" ? "#lsLocA" : "#lsLocB");
        const formatted = formatLatLng(lat, lng);
        if (which === "A") {
          state.latA = lat; state.lngA = lng; state.locA = formatted;
          if (input) input.value = formatted;
          if (markerA) { markerA.setLatLng([lat, lng]); }
          else {
            markerA = L.marker([lat, lng], { icon: pinIcon("A"), draggable: true }).addTo(map);
            markerA.on("drag", (e) => { const p = e.target.getLatLng(); setPoint("A", p.lat, p.lng); });
            markerA.on("dragend", () => updateLine());
          }
        } else {
          if (which === "EA") {
            state.endGunALat = lat; state.endGunALng = lng;
            state.endGunALoc = formatted;
            const egInput = container.querySelector("#lsEgALoc");
            if (egInput) egInput.value = formatted;
            if (markerEgA) markerEgA.setLatLng([lat, lng]);
            else {
              markerEgA = L.marker([lat, lng], { icon: endGunHandleIcon, draggable: true }).addTo(map);
              markerEgA.on("drag", (e) => { const p = e.target.getLatLng(); setPoint("EA", p.lat, p.lng); });
              markerEgA.on("dragend", () => updateCorridor());
            }
            updateCorridor();
            return;
          }
          if (which === "EB") {
            state.endGunBLat = lat; state.endGunBLng = lng;
            state.endGunBLoc = formatted;
            const egInput = container.querySelector("#lsEgBLoc");
            if (egInput) egInput.value = formatted;
            if (markerEgB) markerEgB.setLatLng([lat, lng]);
            else {
              markerEgB = L.marker([lat, lng], { icon: endGunHandleIcon, draggable: true }).addTo(map);
              markerEgB.on("drag", (e) => { const p = e.target.getLatLng(); setPoint("EB", p.lat, p.lng); });
              markerEgB.on("dragend", () => updateCorridor());
            }
            updateCorridor();
            return;
          }
          state.latB = lat; state.lngB = lng; state.locB = formatted;
          if (input) input.value = formatted;
          if (markerB) { markerB.setLatLng([lat, lng]); }
          else {
            markerB = L.marker([lat, lng], { icon: pinIcon("B"), draggable: true }).addTo(map);
            markerB.on("drag", (e) => { const p = e.target.getLatLng(); setPoint("B", p.lat, p.lng); });
            markerB.on("dragend", () => updateLine());
          }
        }
        updateLine();
      };

      // Bind drag nos marcadores iniciais
      if (markerA) {
        markerA.on("drag", (e) => { const p = e.target.getLatLng(); setPoint("A", p.lat, p.lng); });
      }
      if (markerB) {
        markerB.on("drag", (e) => { const p = e.target.getLatLng(); setPoint("B", p.lat, p.lng); });
      }
      if (markerEgA) {
        markerEgA.on("drag", (e) => { const p = e.target.getLatLng(); setPoint("EA", p.lat, p.lng); });
      }
      if (markerEgB) {
        markerEgB.on("drag", (e) => { const p = e.target.getLatLng(); setPoint("EB", p.lat, p.lng); });
      }

      // Clique no mapa
      map.on("click", (e) => {
        const target = state._lsActivePick || "A";
        setPoint(target, e.latlng.lat, e.latlng.lng);

        // Após colocar A, avança automaticamente para B
        if (target === "A") setActive("B");
      });

      state._lsMap = map;
      state._lsSetPoint = setPoint;
      state._lsUpdateCorridor = updateCorridor;

      // Atualiza linha se ambos já existem
      if (ptA && ptB) {
        updateDistanceDisplay(ptA, ptB);
        updateCorridor();
        if (corridors.length) {
          const bounds = L.featureGroup(corridors).getBounds();
          if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
        }
      }

      setTimeout(() => map.invalidateSize(), 200);

      // Função para setar ponto ativo (usada no bind)
      const setActive = (which) => {
        state._lsActivePick = which;
        const btnA = container.querySelector('[data-action="ls-pick-a"]');
        const btnB = container.querySelector('[data-action="ls-pick-b"]');
        const btnEA = container.querySelector('[data-action="ls-pick-ea"]');
        const btnEB = container.querySelector('[data-action="ls-pick-eb"]');
        if (btnA) btnA.classList.toggle("is-active", which === "A");
        if (btnB) btnB.classList.toggle("is-active", which === "B");
        if (btnEA) btnEA.classList.toggle("is-active", which === "EA");
        if (btnEB) btnEB.classList.toggle("is-active", which === "EB");
      };
      state._lsSetActive = setActive;

      // Ativa A por padrão
      setActive(state._lsActivePick || "A");
    },

    bindStep2(container, state) {
      const inputA = container.querySelector("#lsLocA");
      const inputB = container.querySelector("#lsLocB");
      const btnA = container.querySelector('[data-action="ls-pick-a"]');
      const btnB = container.querySelector('[data-action="ls-pick-b"]');
      const btnEA = container.querySelector('[data-action="ls-pick-ea"]');
      const btnEB = container.querySelector('[data-action="ls-pick-eb"]');
      const endGunMode = container.querySelector("#lsEndGunMode");
      const egAField = container.querySelector("#lsEgAField");
      const egBField = container.querySelector("#lsEgBField");
      const egAInput = container.querySelector("#lsEgALoc");
      const egBInput = container.querySelector("#lsEgBLoc");

      // Botões de seleção de ponto ativo + GPS
      if (btnA) {
        btnA.addEventListener("click", () => {
          if (state._lsSetActive) state._lsSetActive("A");
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                if (state._lsSetPoint) state._lsSetPoint("A", pos.coords.latitude, pos.coords.longitude);
                if (state._lsMap) state._lsMap.setView([pos.coords.latitude, pos.coords.longitude], 18);
              },
              () => {},
              { enableHighAccuracy: true, timeout: 8000 }
            );
          }
        });
      }
      if (btnB) {
        btnB.addEventListener("click", () => {
          if (state._lsSetActive) state._lsSetActive("B");
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                if (state._lsSetPoint) state._lsSetPoint("B", pos.coords.latitude, pos.coords.longitude);
              },
              () => {},
              { enableHighAccuracy: true, timeout: 8000 }
            );
          }
        });
      }

      if (btnEA) {
        btnEA.addEventListener("click", () => {
          if (state._lsSetActive) state._lsSetActive("EA");
        });
      }
      if (btnEB) {
        btnEB.addEventListener("click", () => {
          if (state._lsSetActive) state._lsSetActive("EB");
        });
      }

      if (endGunMode) {
        endGunMode.addEventListener("change", () => {
          state.endGunMode = endGunMode.value || "none";
          const showA = state.endGunMode === "a" || state.endGunMode === "ab";
          const showB = state.endGunMode === "b" || state.endGunMode === "ab";
          if (egAField) egAField.style.display = showA ? "" : "none";
          if (egBField) egBField.style.display = showB ? "" : "none";
          if (state._lsUpdateCorridor) state._lsUpdateCorridor();
        });
      }

      // Input manual com parse no blur/change
      const applyInput = (input, which) => {
        const parsed = parseLatLng(input.value);
        if (!parsed) return;
        if (state._lsSetPoint) state._lsSetPoint(which, parsed.lat, parsed.lng);
        if (state._lsMap) state._lsMap.setView([parsed.lat, parsed.lng], state._lsMap.getZoom());
      };
      if (inputA) inputA.addEventListener("change", () => applyInput(inputA, "A"));
      if (inputB) inputB.addEventListener("change", () => applyInput(inputB, "B"));
      if (egAInput) egAInput.addEventListener("change", () => applyInput(egAInput, "EA"));
      if (egBInput) egBInput.addEventListener("change", () => applyInput(egBInput, "EB"));

    },

    readStep2(container) {
      const locA = container.querySelector("#lsLocA")?.value?.trim() || "";
      const locB = container.querySelector("#lsLocB")?.value?.trim() || "";
      const parsedA = parseLatLng(locA);
      const parsedB = parseLatLng(locB);
      const endGunMode = container.querySelector("#lsEndGunMode")?.value || "none";
      const egALoc = container.querySelector("#lsEgALoc")?.value?.trim() || "";
      const egBLoc = container.querySelector("#lsEgBLoc")?.value?.trim() || "";
      const parsedEgA = parseLatLng(egALoc);
      const parsedEgB = parseLatLng(egBLoc);
      return {
        locA, latA: parsedA?.lat ?? null, lngA: parsedA?.lng ?? null,
        locB, latB: parsedB?.lat ?? null, lngB: parsedB?.lng ?? null,
        endGunMode,
        endGunALoc: egALoc,
        endGunALat: parsedEgA?.lat ?? null,
        endGunALng: parsedEgA?.lng ?? null,
        endGunBLoc: egBLoc,
        endGunBLat: parsedEgB?.lat ?? null,
        endGunBLng: parsedEgB?.lng ?? null,
      };
    },

    validateStep2(data) {
      if (data.latA === null || data.lngA === null)
        return { ok: false, msg: "Informe a localiza\u00e7\u00e3o do Ponto A (in\u00edcio da pista)." };
      if (data.latB === null || data.lngB === null)
        return { ok: false, msg: "Informe a localiza\u00e7\u00e3o do Ponto B (fim da pista)." };
      return { ok: true, msg: "" };
    },

    // =================
    // STEP 3 — Configuração
    // =================
    renderStep3(container, state) {
      state.hoseSide = state.hoseSide === "B" ? "B" : "A";
      const widthA = state.widthA ?? (state.widthSide === -1 ? state.width : "") ?? "";
      const widthB = state.widthB ?? (state.widthSide !== -1 ? state.width : "") ?? "";

      container.innerHTML = `
        <div class="sc-loc sc-loc--vertical ls-loc">
          <div class="sc-loc__top">
            <div class="sc-loc__grid">

              <div class="sc-loc__field" style="grid-column: 1 / -1;">
                <label class="sc-loc__label" for="lsWidthA">Largura irrigada — lado A <span class="edit-panel__tooltip-icon" data-tooltip="Largura medida a partir da linha central para o lado A."><i class="fa-regular fa-circle-question"></i></span></label>
                <div class="sc-loc__row">
                  <div class="sc-loc__input-wrapper">
                    <input class="equip-input sc-loc__input-field" id="lsWidthA" type="text" inputmode="decimal" placeholder="40" value="${escapeHtml(widthA)}">
                  </div>
                  <button class="equip-btn btn btn--outline sc-loc__btn ls-loc__btn--w" type="button" data-action="ls-pick-wa">
                    <i class="fa-solid fa-up-down-left-right" aria-hidden="true"></i> Medir lado A
                  </button>
                </div>
              </div>

              <div class="sc-loc__field" style="grid-column: 1 / -1;">
                <label class="sc-loc__label" for="lsWidthB">Largura irrigada — lado B <span class="edit-panel__tooltip-icon" data-tooltip="Largura medida a partir da linha central para o lado B."><i class="fa-regular fa-circle-question"></i></span></label>
                <div class="sc-loc__row">
                  <div class="sc-loc__input-wrapper">
                    <input class="equip-input sc-loc__input-field" id="lsWidthB" type="text" inputmode="decimal" placeholder="40" value="${escapeHtml(widthB)}">
                  </div>
                  <button class="equip-btn btn btn--outline sc-loc__btn ls-loc__btn--w" type="button" data-action="ls-pick-wb">
                    <i class="fa-solid fa-up-down-left-right" aria-hidden="true"></i> Medir lado B
                  </button>
                </div>
              </div>

              <div class="sc-loc__field" style="grid-column: 1 / -1;">
                <div style="font-size: 11px; font-weight: 600; color: #374151; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">Lado da mangueira <span class="edit-panel__tooltip-icon" data-tooltip="Selecione o lado em que a mangueira está conectada: A (esquerda) ou B (direita), olhando do ponto A para o ponto B. A seta indica a posição zero da mangueira."><i class="fa-regular fa-circle-question"></i></span></div>
                <div class="pivo-edit__segmented-control js-linestar-hose-side-group" style="max-width: 360px; width: 100%;">
                  <button type="button" class="js-linestar-hose-side ${state.hoseSide === "A" ? "is-active" : ""}" data-side="A" aria-pressed="${state.hoseSide === "A"}">Lado A — esquerda</button>
                  <button type="button" class="js-linestar-hose-side ${state.hoseSide === "B" ? "is-active" : ""}" data-side="B" aria-pressed="${state.hoseSide === "B"}">Lado B — direita</button>
                </div>
              </div>

            </div>
          </div>

          <div class="sc-loc__map-wrapper ls-loc__map-wrapper" id="lsPreviewMapSlot">
            <div id="lsPreviewMap" class="sc-loc__map ls-loc__map"></div>
          </div>
        </div>
      `;

      this.bindStep3(container, state);
    },

    bindStep3(container, state) {
      const a = { lat: state.latA, lng: state.lngA };
      const b = { lat: state.latB, lng: state.lngB };
      const map = ensureSharedPreviewMap(container, state, a, b);

      if (state._lsPreviewLayer) state._lsPreviewLayer.clearLayers();
      else if (map) state._lsPreviewLayer = L.layerGroup().addTo(map);
      const layer = state._lsPreviewLayer;
      // Limpa o que outro step tenha deixado no mapa compartilhado.
      state._lsPreviewBandsLayer?.clearLayers();
      state._lsPreviewMarkersLayer?.clearLayers();
      const widthInputA = container.querySelector("#lsWidthA");
      const widthInputB = container.querySelector("#lsWidthB");
      const widthButtonA = container.querySelector('[data-action="ls-pick-wa"]');
      const widthButtonB = container.querySelector('[data-action="ls-pick-wb"]');
      let activeWidthPick = null;
      let widthMeasurePoint = null;
      let widthMeasureSide = null;
      let draggingWidth = false;
      let draggingSide = null;
      let wasMapDraggingEnabled = false;
      let widthDragMoved = false;
      let suppressNextWidthClick = false;

      const drawHoseArrow = () => {
        if (!layer) return;
        const { widthA, widthB } = getLineWidths(state);
        if (!map) return;

        const bearing = bearingBetweenPoints(a, b);
        const drawMarker = (origin, width, markerSide) => {
          if (!(width > 0)) return;
          const edge = destinationPoint(origin, width, (bearing + markerSide * 90 + 360) % 360);
          const edgePoint = map.latLngToContainerPoint([edge.lat, edge.lng]);
          const inwardBearing = (bearing - markerSide * 90) * Math.PI / 180;
          const markerPoint = map.containerPointToLatLng([
            edgePoint.x + 14 * Math.sin(inwardBearing),
            edgePoint.y - 14 * Math.cos(inwardBearing),
          ]);
          const trianglePoints = markerSide < 0
            ? "8,8 8,52 52,30"
            : "52,8 52,52 8,30";
          const icon = L.divIcon({
            className: "",
            html: `<svg width="36" height="36" viewBox="0 0 60 60" style="transform:rotate(${bearing}deg);filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))" aria-hidden="true"><polygon points="${trianglePoints}" fill="#fff" stroke="#fff" stroke-width="1" stroke-linejoin="round"/></svg>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          });
          L.marker(markerPoint, {
            icon,
            interactive: false,
            keyboard: false,
            zIndexOffset: 1000,
          }).addTo(layer);
        };

        const activeSide = state.hoseSide === "B" ? "B" : "A";

        if (widthA > 0 && widthB > 0) {
          if (activeSide === "A") drawMarker(a, widthA, -1);
          else drawMarker(b, widthB, 1);
          return;
        }

        const markerOrigin = activeSide === "A" ? a : b;
        if (widthA > 0) drawMarker(markerOrigin, widthA, -1);
        else if (widthB > 0) drawMarker(markerOrigin, widthB, 1);
      };

      const redraw = () => {
        if (!layer) return;
        layer.clearLayers();
        const hasPoints = Number.isFinite(a.lat) && Number.isFinite(a.lng) && Number.isFinite(b.lat) && Number.isFinite(b.lng);
        if (!hasPoints) return;

        const { widthA, widthB } = getLineWidths(state);
        [
          { width: widthA, side: -1 },
          { width: widthB, side: 1 },
        ].forEach(({ width, side }) => {
          if (!(width > 0)) return;
          const points = buildLineSegmentPolygon(a, b, width, 0, 100, side);
          L.polygon(points, { color: "#ffffff", weight: 2, opacity: 0.9, fillColor: "#ffffff", fillOpacity: 0.12 }).addTo(layer);
          const edge = L.polyline([points[2], points[3]], {
            color: "#ffffff",
            weight: 3,
            opacity: 0.9,
            bubblingMouseEvents: false,
          }).addTo(layer);
          const widthSide = side === -1 ? "WA" : "WB";
          edge.on("mousedown", (event) => startWidthDrag(widthSide, event));
          edge.on("click", (event) => {
            if (suppressNextWidthClick) {
              suppressNextWidthClick = false;
              return;
            }
            activateWidthPick(widthSide);
            updateWidthFromPoint(event.latlng);
          });
        });
        if (widthA > 0 || widthB > 0) drawHoseArrow();

        L.polyline([[a.lat, a.lng], [b.lat, b.lng]], {
          color: "#facc15",
          weight: 3,
          dashArray: "8 5",
          opacity: 0.9,
          interactive: false,
        }).addTo(layer);

        if (widthMeasurePoint && widthMeasureSide) {
          const bearing = bearingBetweenPoints(a, b);
          const alongTrack = decomposeAlongPerpMeters(a, widthMeasurePoint, bearing).along;
          const measureOrigin = destinationPoint(a, Math.min(alongTrack, haversineDistance(a, b)), bearing);
          const measureWidth = haversineDistance(measureOrigin, widthMeasurePoint);
          const measureColor = widthMeasureSide === "WA" ? "#16a34a" : "#dc2626";
          L.polyline(
            [[measureOrigin.lat, measureOrigin.lng], [widthMeasurePoint.lat, widthMeasurePoint.lng]],
            {
              color: measureColor,
              weight: 3,
              dashArray: "6 4",
              opacity: 0.95,
              interactive: false,
            }
          ).addTo(layer);
          const measureMidpoint = midpointBetweenPoints(measureOrigin, widthMeasurePoint);
          L.marker([measureMidpoint.lat, measureMidpoint.lng], {
            icon: L.divIcon({
              className: "",
              html: `<span style="display:inline-block;padding:4px 8px;border:1px solid #fff;border-radius:999px;background:${measureColor};color:#fff;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.35)">${measureWidth.toFixed(1)} m</span>`,
              iconSize: [1, 1],
              iconAnchor: [0, 0],
            }),
            interactive: false,
            keyboard: false,
            zIndexOffset: 1100,
          }).addTo(layer);
        }
      };

      const updateWidthFromPoint = (point, sideOverride = null) => {
        const sidePick = sideOverride || activeWidthPick;
        if (!sidePick || !Number.isFinite(a.lat) || !Number.isFinite(a.lng) ||
            !Number.isFinite(b.lat) || !Number.isFinite(b.lng)) return;
        widthMeasureSide = sidePick;
        widthMeasurePoint = { lat: point.lat, lng: point.lng };
        const side = sidePick === "WA" ? -1 : 1;
        const signedWidth = signedPerpendicularDistanceMeters(a, point, bearingBetweenPoints(a, b));
        const width = Math.max(0, signedWidth * side);
        const key = side === -1 ? "widthA" : "widthB";
        state[key] = width > 0 ? width.toFixed(2) : "";
        const widths = getLineWidths(state);
        state.width = (widths.widthA + widths.widthB).toFixed(2);
        const input = side === -1 ? widthInputA : widthInputB;
        if (input) input.value = state[key];
        redraw();
      };

      const stopWidthDrag = (event) => {
        if (!draggingWidth) return;
        if (event && widthDragMoved) updateWidthFromPoint(map.mouseEventToLatLng(event), draggingSide);
        suppressNextWidthClick = widthDragMoved;
        draggingWidth = false;
        draggingSide = null;
        widthDragMoved = false;
        if (wasMapDraggingEnabled) map.dragging.enable();
        wasMapDraggingEnabled = false;
        window.removeEventListener("mousemove", onWidthMove);
        window.removeEventListener("mouseup", stopWidthDrag);
      };
      const onWidthMove = (event) => {
        if (!draggingWidth) return;
        widthDragMoved = true;
        updateWidthFromPoint(map.mouseEventToLatLng(event), draggingSide);
      };
      const startWidthDrag = (side, event) => {
        if (draggingWidth || (event.originalEvent.button !== undefined && event.originalEvent.button !== 0)) return;
        activateWidthPick(side, false);
        suppressNextWidthClick = false;
        widthDragMoved = false;
        L.DomEvent.stopPropagation(event.originalEvent);
        L.DomEvent.preventDefault(event.originalEvent);
        draggingWidth = true;
        draggingSide = side;
        wasMapDraggingEnabled = map.dragging.enabled();
        map.dragging.disable();
        window.addEventListener("mousemove", onWidthMove);
        window.addEventListener("mouseup", stopWidthDrag);
      };
      const onWidthMapClick = (event) => {
        if (suppressNextWidthClick) {
          suppressNextWidthClick = false;
          return;
        }
        if (activeWidthPick) updateWidthFromPoint(event.latlng);
      };
      const clearSuppressedClick = () => {
        suppressNextWidthClick = false;
      };

      redraw();

      const setWidthPick = (side) => {
        activeWidthPick = activeWidthPick === side ? null : side;
        if (activeWidthPick) {
          widthMeasureSide = activeWidthPick;
          widthMeasurePoint = null;
        }
        syncWidthPickButtons();
        redraw();
      };
      const activateWidthPick = (side, shouldRedraw = true) => {
        activeWidthPick = side;
        widthMeasureSide = side;
        widthMeasurePoint = null;
        syncWidthPickButtons();
        if (shouldRedraw) redraw();
      };
      const syncWidthPickButtons = () => {
        widthButtonA?.classList.toggle("is-active", activeWidthPick === "WA");
        widthButtonB?.classList.toggle("is-active", activeWidthPick === "WB");
        widthButtonA?.setAttribute("aria-pressed", String(activeWidthPick === "WA"));
        widthButtonB?.setAttribute("aria-pressed", String(activeWidthPick === "WB"));
      };
      widthButtonA?.addEventListener("click", () => setWidthPick("WA"));
      widthButtonB?.addEventListener("click", () => setWidthPick("WB"));

      [[widthInputA, "widthA"], [widthInputB, "widthB"]].forEach(([input, key]) => {
        if (!input) return;
        input.addEventListener("input", () => {
          state[key] = input.value;
          const widths = getLineWidths(state);
          state.width = (widths.widthA + widths.widthB).toFixed(2);
          redraw();
        });
        input.addEventListener("blur", () => {
          const width = parseNumber(input.value);
          if (Number.isFinite(width) && width >= 0) {
            input.value = width > 0 ? width.toFixed(2) : "";
            state[key] = input.value;
            const widths = getLineWidths(state);
            state.width = (widths.widthA + widths.widthB).toFixed(2);
            redraw();
          }
        });
      });

      if (map) {
        map.on("click", onWidthMapClick);
        map.on("mousedown", clearSuppressedClick);
        state._lsPreviewWidthPickerCleanup = () => {
          if (draggingWidth) {
            draggingWidth = false;
            draggingSide = null;
            widthDragMoved = false;
            if (wasMapDraggingEnabled) map.dragging.enable();
            wasMapDraggingEnabled = false;
            window.removeEventListener("mousemove", onWidthMove);
            window.removeEventListener("mouseup", stopWidthDrag);
          }
          map.off("click", onWidthMapClick);
          map.off("mousedown", clearSuppressedClick);
        };
      }

      container.querySelectorAll(".js-linestar-hose-side").forEach((btn) => {
        btn.addEventListener("click", () => {
          container.querySelectorAll(".js-linestar-hose-side").forEach((b) => b.classList.remove("is-active"));
          btn.classList.add("is-active");
          state.hoseSide = btn.getAttribute("data-side") === "B" ? "B" : "A";
          container.querySelectorAll(".js-linestar-hose-side").forEach((b) => {
            b.setAttribute("aria-pressed", String(b === btn));
          });
          redraw();
        });
      });
    },

    readStep3(container, state) {
      const widthA = container.querySelector("#lsWidthA")?.value?.trim() ?? state.widthA ?? "";
      const widthB = container.querySelector("#lsWidthB")?.value?.trim() ?? state.widthB ?? "";
      return {
        hoseSide: state.hoseSide || "A",
        widthA,
        widthB,
        width: ((parseNumber(widthA) || 0) + (parseNumber(widthB) || 0)).toFixed(2),
      };
    },

    validateStep3() {
      return { ok: true, errors: {} };
    },

    // =================
    // STEP 4 — Segmentos
    // =================
    renderStep4(container, state) {
      state.segments = normalizeSegments(state.segments);
      if (!Number.isFinite(state.activeSegIdx) || state.activeSegIdx >= state.segments.length) {
        state.activeSegIdx = 0;
      }

      const presetButtons = Array.from({ length: 9 }, (_, i) => i + 1)
        .map((n) => `<button type="button" class="pivo-preset-btn" data-ls-seg-preset="${n}">${n}</button>`)
        .join("");

      container.innerHTML = `
        <div class="sc-loc sc-loc--vertical ls-loc">
          <div class="sc-loc__top">
            <div class="pivo-edit__segments-section pivo-edit-specifics">
              <div style="margin-bottom:14px;">
                <div style="font-size:14px;font-weight:400;color:#0f172a;margin-bottom:6px;">Configuração automática</div>
                <div class="pivo-preset-row">${presetButtons}</div>
              </div>

              <div style="font-size:14px;font-weight:400;color:#0f172a;margin-bottom:6px;">Configuração manual</div>
              <div id="lsSegList" style="display:flex;gap:8px;margin-bottom:16px;align-items:center;flex-wrap:wrap;"></div>

              <div class="edit-panel__grid-3" style="grid-template-columns:1fr 1fr;gap:12px;">
                <div class="pivo-edit__field" style="grid-column:span 2;">
                  <label class="edit-panel__label" for="lsSegName"><span class="edit-panel__req">*</span> Nome do segmento</label>
                  <input class="edit-panel__input" id="lsSegName" type="text" placeholder="Ex: Milho" />
                </div>
                <div class="pivo-edit__field">
                  <label for="lsSegStart"><span class="edit-panel__req">*</span> Faixa inicial (%)</label>
                  <div class="sc-input-group">
                    <input class="equip-input sc-input" id="lsSegStart" type="text" inputmode="decimal" autocomplete="off" />
                    <span class="sc-input-suffix">%</span>
                  </div>
                </div>
                <div class="pivo-edit__field">
                  <label for="lsSegEnd"><span class="edit-panel__req">*</span> Faixa final (%)</label>
                  <div class="sc-input-group">
                    <input class="equip-input sc-input" id="lsSegEnd" type="text" inputmode="decimal" autocomplete="off" />
                    <span class="sc-input-suffix">%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="sc-loc__map-wrapper ls-loc__map-wrapper" id="lsPreviewMapSlot">
            <div id="lsPreviewMap" class="sc-loc__map ls-loc__map"></div>
          </div>
        </div>
      `;

      this.bindStep4(container, state);
    },

    bindStep4(container, state) {
      const a = { lat: state.latA, lng: state.lngA };
      const b = { lat: state.latB, lng: state.lngB };
      const hasPoints = Number.isFinite(a.lat) && Number.isFinite(a.lng) && Number.isFinite(b.lat) && Number.isFinite(b.lng);
      const { widthA, widthB } = getLineWidths(state);

      const segList = container.querySelector("#lsSegList");
      const nameInput = container.querySelector("#lsSegName");
      const startInput = container.querySelector("#lsSegStart");
      const endInput = container.querySelector("#lsSegEnd");

      const map = ensureSharedPreviewMap(container, state, a, b);
      if (state._lsPreviewBandsLayer) state._lsPreviewBandsLayer.clearLayers();
      else if (map) state._lsPreviewBandsLayer = L.layerGroup().addTo(map);
      if (state._lsPreviewMarkersLayer) state._lsPreviewMarkersLayer.clearLayers();
      else if (map) state._lsPreviewMarkersLayer = L.layerGroup().addTo(map);
      const bandsLayer = state._lsPreviewBandsLayer;
      const markersLayer = state._lsPreviewMarkersLayer;
      // Limpa o que outro step tenha deixado no mapa compartilhado.
      state._lsPreviewLayer?.clearLayers();

      // Só as faixas coloridas (barato de redesenhar a cada frame do arraste).
      const redrawBands = () => {
        if (!bandsLayer) return;
        bandsLayer.clearLayers();
        if (!hasPoints || (widthA <= 0 && widthB <= 0)) return;

        state.segments.forEach((segment, idx) => {
          const color = segmentPalette[idx % segmentPalette.length];
          const isActive = idx === state.activeSegIdx;
          [
            { width: widthA, side: -1 },
            { width: widthB, side: 1 },
          ].forEach(({ width, side }) => {
            if (!(width > 0)) return;
            const points = buildLineSegmentPolygon(a, b, width, segment.startPercent, segment.endPercent, side);
            L.polygon(points, {
              color: "#ffffff",
              weight: isActive ? 2 : 1,
              opacity: isActive ? 0.95 : 0.78,
              fillColor: color,
              fillOpacity: isActive ? 0.72 : 0.56,
              interactive: false,
            }).addTo(bandsLayer);
          });
        });
      };

      // Os marcadores de fronteira: só recriados em mudanças estruturais
      // (add/remover/preset/dragend), nunca durante o próprio arraste —
      // recriar o marcador enquanto ele está sendo arrastado é o que travava.
      const buildMarkers = () => {
        if (!markersLayer) return;
        markersLayer.clearLayers();
        if (!hasPoints || (widthA <= 0 && widthB <= 0)) return;

        for (let i = 0; i < state.segments.length - 1; i += 1) {
          const boundaryPercent = state.segments[i].endPercent;
          const boundaryPoint = interpolatePoint(a, b, boundaryPercent / 100);
          const marker = L.marker([boundaryPoint.lat, boundaryPoint.lng], {
            icon: L.divIcon({
              className: "pivo-map-drag-dot",
              html: '<div style="width: 14px; height: 14px; border-radius: 50%; background: #fff; border: 3px solid #1D4ED8; box-shadow: 0 0 4px rgba(0,0,0,.4);"></div>',
              iconSize: [14, 14],
              iconAnchor: [7, 7],
            }),
            draggable: true,
          }).addTo(markersLayer);

          const boundaryIndex = i;
          marker.on("drag", (event) => {
            const nextPercent = projectPercentOnTrack(event.latlng, a, b);
            const current = state.segments[boundaryIndex];
            const next = state.segments[boundaryIndex + 1];
            const minValue = current.startPercent + 0.1;
            const maxValue = next.endPercent - 0.1;
            const clamped = roundPercent(Math.max(minValue, Math.min(maxValue, nextPercent)));
            current.endPercent = clamped;
            next.startPercent = clamped;
            redrawBands();
          });

          marker.on("dragend", () => {
            withPreservedScroll(container, () => {
              state.segments = normalizeSegments(state.segments);
              buildMarkers();
              redrawBands();
              renderList();
              populateForm();
            });
          });
        }
      };

      redrawBands();
      buildMarkers();

      const renderList = () => {
        if (!segList) return;
        segList.innerHTML = "";
        state.segments.forEach((segment, idx) => {
          const color = segmentPalette[idx % segmentPalette.length];
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "pivo-seg-num-btn" + (idx === state.activeSegIdx ? " is-active" : "");
          btn.style.cssText = `background:${color};--seg-color:${color};`;
          btn.textContent = String(idx + 1);
          btn.addEventListener("click", () => {
            withPreservedScroll(container, () => {
              state.activeSegIdx = idx;
              renderList();
              populateForm();
              redrawBands();
            });
          });
          segList.appendChild(btn);
        });

        if (state.segments.length < 9) {
          const addBtn = document.createElement("button");
          addBtn.type = "button";
          addBtn.className = "pivo-seg-add-btn";
          addBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
          addBtn.addEventListener("click", () => {
            withPreservedScroll(container, () => {
              const active = state.segments[state.activeSegIdx];
              const available = active.endPercent - active.startPercent;
              if (available < 2) return;
              const splitAt = roundPercent(active.startPercent + available / 2);
              const nextSegment = { name: "", startPercent: splitAt, endPercent: active.endPercent };
              active.endPercent = splitAt;
              state.segments.splice(state.activeSegIdx + 1, 0, nextSegment);
              state.segments = normalizeSegments(state.segments);
              state.activeSegIdx = state.activeSegIdx + 1;
              renderList();
              populateForm();
              redrawBands();
              buildMarkers();
            });
          });
          segList.appendChild(addBtn);
        }

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "pivo-seg-del-btn";
        delBtn.innerHTML = '<i class="fa-regular fa-trash-can"></i>';
        if (state.segments.length <= 1) {
          delBtn.disabled = true;
          delBtn.title = "É necessário pelo menos 1 segmento";
        } else {
          delBtn.title = "Remover segmento";
          delBtn.addEventListener("click", () => {
            withPreservedScroll(container, () => {
              state.segments.splice(state.activeSegIdx, 1);
              state.activeSegIdx = Math.max(0, state.activeSegIdx - 1);
              state.segments = normalizeSegments(state.segments);
              renderList();
              populateForm();
              redrawBands();
              buildMarkers();
            });
          });
        }
        segList.appendChild(delBtn);
      };

      const populateForm = () => {
        const segment = state.segments[state.activeSegIdx];
        if (!segment || !nameInput || !startInput || !endInput) return;
        const isFirst = state.activeSegIdx === 0;
        const isLast = state.activeSegIdx === state.segments.length - 1;

        nameInput.value = segment.name || "";
        startInput.value = String(segment.startPercent);
        endInput.value = String(segment.endPercent);

        startInput.disabled = isFirst;
        startInput.classList.toggle("is-disabled", isFirst);
        endInput.disabled = isLast;
        endInput.classList.toggle("is-disabled", isLast);
      };

      container.querySelectorAll("[data-ls-seg-preset]").forEach((btn) => {
        btn.addEventListener("click", () => {
          withPreservedScroll(container, () => {
            const total = Number(btn.dataset.lsSegPreset);
            if (!Number.isFinite(total) || total < 1 || total > 9) return;
            const step = 100 / total;
            const names = state.segments.map((s) => s.name);
            state.segments = Array.from({ length: total }, (_, k) => ({
              name: names[k] || "",
              startPercent: roundPercent(k * step),
              endPercent: k === total - 1 ? 100 : roundPercent((k + 1) * step),
            }));
            state.activeSegIdx = 0;
            renderList();
            populateForm();
            redrawBands();
            buildMarkers();
          });
        });
      });

      if (nameInput) {
        nameInput.addEventListener("input", () => {
          const segment = state.segments[state.activeSegIdx];
          if (segment) segment.name = nameInput.value;
        });
      }

      const applyBoundary = (kind, rawValue, { syncForm = false } = {}) => {
        const parsedValue = parsePercentDraft(rawValue);
        if (parsedValue === null) return false;

        if (kind === "start") {
          if (state.activeSegIdx <= 0) return false;
          const prev = state.segments[state.activeSegIdx - 1];
          const current = state.segments[state.activeSegIdx];
          const minValue = prev.startPercent + 0.1;
          const maxValue = current.endPercent - 0.1;
          const nextStart = roundPercent(Math.max(minValue, Math.min(maxValue, parsedValue)));
          prev.endPercent = nextStart;
          current.startPercent = nextStart;
        } else {
          if (state.activeSegIdx >= state.segments.length - 1) return false;
          const current = state.segments[state.activeSegIdx];
          const next = state.segments[state.activeSegIdx + 1];
          const minValue = current.startPercent + 0.1;
          const maxValue = next.endPercent - 0.1;
          const nextEnd = roundPercent(Math.max(minValue, Math.min(maxValue, parsedValue)));
          current.endPercent = nextEnd;
          next.startPercent = nextEnd;
        }

        state.segments = normalizeSegments(state.segments);
        if (syncForm) populateForm();
        renderList();
        redrawBands();
        buildMarkers();
        return true;
      };

      if (startInput) {
        startInput.addEventListener("blur", (event) => {
          withPreservedScroll(container, () => {
            if (!applyBoundary("start", event.target.value, { syncForm: true })) populateForm();
          });
        });
      }
      if (endInput) {
        endInput.addEventListener("blur", (event) => {
          withPreservedScroll(container, () => {
            if (!applyBoundary("end", event.target.value, { syncForm: true })) populateForm();
          });
        });
      }

      renderList();
      populateForm();
    },

    readStep4(container, state) {
      return {
        segments: state.segments || normalizeSegments([]),
      };
    },

    validateStep4() {
      return { ok: true, errors: {} };
    },

    renderIntermediateStep(container, state) {
      const a = { lat: state.latA, lng: state.lngA };
      const b = { lat: state.latB, lng: state.lngB };
      const hasPoints = Number.isFinite(a.lat) && Number.isFinite(a.lng) && Number.isFinite(b.lat) && Number.isFinite(b.lng);
      const totalMeters = Math.max(0, parseNumber(state.trackLengthCalc) || (hasPoints ? haversineDistance(a, b) : 0));
      const { widthA, widthB } = getLineWidths(state);

      state.intermediatePositions = (Array.isArray(state.intermediatePositions) ? state.intermediatePositions : [])
        .slice(0, 12)
        .map((position, index) => ({
          id: String(position?.id || `ip_${Date.now()}_${index}`),
          distanceMeters: Math.max(0, Math.min(totalMeters, parseNumber(position?.distanceMeters) || 0)),
        }));
      if (!Number.isFinite(state.activeIntermediateIndex)) state.activeIntermediateIndex = 0;
      state.activeIntermediateIndex = Math.max(0, Math.min(state.activeIntermediateIndex, state.intermediatePositions.length - 1));

      container.innerHTML = `
        <div class="sc-loc sc-loc--vertical ls-loc">
          <div class="sc-loc__top">
            <div class="pivo-edit__segments-section pivo-edit-specifics">
              <p class="pivo-edit__loc-desc">
                Defina posições intermediárias ao longo do traçado do LineStar para marcar pontos de controle, como porteiras ou mudanças de talhão.
              </p>

              <div style="margin-top:16px;">
                <div style="font-size:14px;font-weight:400;color:#0f172a;margin-bottom:6px;">Posições cadastradas</div>
                <div id="lsIntermediateList" style="display:flex;gap:8px;margin-bottom:16px;align-items:center;flex-wrap:wrap;"></div>
              </div>

              <div class="edit-panel__grid-3" style="grid-template-columns:1fr;gap:12px;">
                <div class="pivo-edit__field">
                  <label for="lsIntermediateDistance"><span class="edit-panel__req">*</span> Distância a partir do início (m)</label>
                  <div class="sc-input-group">
                    <input class="equip-input sc-input" id="lsIntermediateDistance" type="number" step="0.1" min="0" max="${totalMeters}" placeholder="0" />
                    <span class="sc-input-suffix">m</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="sc-loc__map-wrapper ls-loc__map-wrapper" id="lsPreviewMapSlot">
            <div id="lsPreviewMap" class="sc-loc__map ls-loc__map"></div>
          </div>
        </div>
      `;

      const map = ensureSharedPreviewMap(container, state, a, b);
      if (state._lsPreviewBandsLayer) state._lsPreviewBandsLayer.clearLayers();
      if (state._lsPreviewMarkersLayer) state._lsPreviewMarkersLayer.clearLayers();
      if (state._lsPreviewLayer) state._lsPreviewLayer.clearLayers();
      if (!state._lsPreviewIntermediateLayer && map) {
        state._lsPreviewIntermediateLayer = L.layerGroup().addTo(map);
      } else {
        state._lsPreviewIntermediateLayer?.clearLayers();
      }
      const intermediateLayer = state._lsPreviewIntermediateLayer;
      const list = container.querySelector("#lsIntermediateList");
      const distanceInput = container.querySelector("#lsIntermediateDistance");

      const drawMap = () => {
        if (!intermediateLayer) return;
        intermediateLayer.clearLayers();
        if (!hasPoints) return;

        [
          { width: widthA, side: -1 },
          { width: widthB, side: 1 },
        ].forEach(({ width, side }) => {
          if (!(width > 0)) return;
          const corridor = buildLineSegmentPolygon(a, b, width, 0, 100, side);
          L.polygon(corridor, {
            color: "#ffffff",
            weight: 2,
            opacity: 0.85,
            fillColor: "#ffffff",
            fillOpacity: 0.06,
            interactive: false,
          }).addTo(intermediateLayer);
        });

        const bearing = bearingBetweenPoints(a, b);
        state.intermediatePositions.forEach((position, index) => {
          if (!(totalMeters > 0)) return;
          const ratio = Math.max(0, Math.min(1, position.distanceMeters / totalMeters));
          const point = interpolatePoint(a, b, ratio);
          const left = widthA > 0 ? destinationPoint(point, widthA, (bearing - 90 + 360) % 360) : point;
          const right = widthB > 0 ? destinationPoint(point, widthB, (bearing + 90) % 360) : point;
          const isActive = index === state.activeIntermediateIndex;
          const color = isActive ? "#dc2626" : "#ef4444";

          if (widthA > 0 || widthB > 0) {
            L.polyline([[left.lat, left.lng], [right.lat, right.lng]], {
              color,
              weight: isActive ? 5 : 3,
              opacity: isActive ? 1 : 0.8,
              interactive: false,
            }).addTo(intermediateLayer);
          }

          const marker = L.marker([point.lat, point.lng], {
            icon: L.divIcon({
              className: "pivo-map-drag-dot",
              html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,.45);"></div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            }),
            draggable: true,
          }).addTo(intermediateLayer);

          marker.on("drag", (event) => {
            if (!(totalMeters > 0)) return;
            const dragRatio = projectPercentOnTrack(event.latlng, a, b) / 100;
            position.distanceMeters = Math.round(totalMeters * dragRatio * 10) / 10;
            if (distanceInput && index === state.activeIntermediateIndex) {
              distanceInput.value = String(position.distanceMeters);
            }
          });
          marker.on("dragend", () => {
            withPreservedScroll(container, () => {
              renderList();
              populateForm();
              drawMap();
            });
          });
        });
      };

      const populateForm = () => {
        const position = state.intermediatePositions[state.activeIntermediateIndex];
        if (!distanceInput) return;
        distanceInput.disabled = !position;
        distanceInput.value = position ? String(position.distanceMeters) : "";
      };

      const renderList = () => {
        if (!list) return;
        list.innerHTML = "";
        state.intermediatePositions.forEach((position, index) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "pivo-seg-num-btn" + (index === state.activeIntermediateIndex ? " is-active" : "");
          button.style.cssText = "background:#ef4444;--seg-color:#ef4444;";
          button.textContent = String(index + 1);
          button.addEventListener("click", () => {
            withPreservedScroll(container, () => {
              state.activeIntermediateIndex = index;
              renderList();
              populateForm();
              drawMap();
            });
          });
          list.appendChild(button);
        });

        if (state.intermediatePositions.length < 12) {
          const addButton = document.createElement("button");
          addButton.type = "button";
          addButton.className = "pivo-seg-add-btn";
          addButton.innerHTML = '<i class="fa-solid fa-plus"></i>';
          addButton.title = "Adicionar posição intermediária";
          addButton.addEventListener("click", () => {
            const lastPosition = state.intermediatePositions[state.intermediatePositions.length - 1];
            const lastDistance = lastPosition?.distanceMeters || 0;
            state.intermediatePositions.push({
              id: `ip_${Date.now()}`,
              distanceMeters: Math.min(totalMeters, lastDistance + 100),
            });
            state.activeIntermediateIndex = state.intermediatePositions.length - 1;
            withPreservedScroll(container, () => {
              renderList();
              populateForm();
              drawMap();
            });
          });
          list.appendChild(addButton);
        }

        if (state.intermediatePositions.length) {
          const deleteButton = document.createElement("button");
          deleteButton.type = "button";
          deleteButton.className = "pivo-seg-del-btn";
          deleteButton.innerHTML = '<i class="fa-regular fa-trash-can"></i>';
          deleteButton.title = "Remover posição intermediária";
          deleteButton.addEventListener("click", () => {
            state.intermediatePositions.splice(state.activeIntermediateIndex, 1);
            state.activeIntermediateIndex = Math.max(0, Math.min(state.activeIntermediateIndex, state.intermediatePositions.length - 1));
            withPreservedScroll(container, () => {
              renderList();
              populateForm();
              drawMap();
            });
          });
          list.appendChild(deleteButton);
        }
      };

      distanceInput?.addEventListener("input", () => {
        const position = state.intermediatePositions[state.activeIntermediateIndex];
        const value = parseNumber(distanceInput.value);
        if (!position || value === null || value < 0) return;
        position.distanceMeters = Math.round(Math.min(totalMeters, value) * 10) / 10;
        drawMap();
      });
      distanceInput?.addEventListener("blur", () => {
        withPreservedScroll(container, populateForm);
      });

      renderList();
      populateForm();
      drawMap();
    },

    readIntermediateStep(container, state) {
      const a = { lat: state.latA, lng: state.lngA };
      const b = { lat: state.latB, lng: state.lngB };
      const totalMeters = Math.max(0, parseNumber(state.trackLengthCalc) || (
        Number.isFinite(a.lat) && Number.isFinite(a.lng) && Number.isFinite(b.lat) && Number.isFinite(b.lng)
          ? haversineDistance(a, b)
          : 0
      ));
      const positions = Array.isArray(state.intermediatePositions) ? state.intermediatePositions : [];
      const activePosition = positions[state.activeIntermediateIndex];
      const inputValue = parseNumber(container.querySelector("#lsIntermediateDistance")?.value);
      if (activePosition && inputValue !== null && inputValue >= 0) {
        activePosition.distanceMeters = Math.round(Math.min(totalMeters, inputValue) * 10) / 10;
      }

      return {
        intermediatePositions: positions.slice(0, 12).map((position, index) => ({
          id: String(position?.id || `ip_${Date.now()}_${index}`),
          distanceMeters: Math.round(Math.max(0, Math.min(totalMeters, parseNumber(position?.distanceMeters) || 0)) * 10) / 10,
        })),
      };
    },

    validateIntermediateStep() {
      return { ok: true, errors: {} };
    },

    // =================
    // STEP 5 — Canhão Final
    // =================
    renderStep5(container, state) {
      state.endGunSide = "both";
      state.endGunSegments = normalizeEndGunSegments(state.endGunSegments || []);
      state.endGunSegmentsLeft = normalizeEndGunSegments(state.endGunSegmentsLeft || []);
      if (!state.activeEndGunSide) state.activeEndGunSide = "right";
      if (!Number.isFinite(state.activeEndGunIndexRight)) state.activeEndGunIndexRight = 0;
      if (!Number.isFinite(state.activeEndGunIndexLeft)) state.activeEndGunIndexLeft = 0;

      container.innerHTML = `
        <div class="sc-loc sc-loc--vertical ls-loc">
          <div class="sc-loc__top">
            <div class="pivo-edit__segments-section pivo-edit-specifics">
              <p class="pivo-edit__loc-desc">
                Para LineStars que possuem canhão final instalado, defina os trechos do traçado onde o canhão deve ligar automaticamente.
              </p>

              <div id="lsEndGunCards" style="margin-top:16px;"></div>

              <div class="edit-panel__grid-3" style="grid-template-columns:1fr 1fr;gap:12px;margin-top:16px;">
                <div class="pivo-edit__field">
                  <label>Início do trecho (%)</label>
                  <div class="sc-input-group">
                    <input class="equip-input sc-input" id="lsEndGunStart" type="text" inputmode="decimal" autocomplete="off" />
                    <span class="sc-input-suffix">%</span>
                  </div>
                </div>
                <div class="pivo-edit__field">
                  <label>Fim do trecho (%)</label>
                  <div class="sc-input-group">
                    <input class="equip-input sc-input" id="lsEndGunEnd" type="text" inputmode="decimal" autocomplete="off" />
                    <span class="sc-input-suffix">%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="sc-loc__map-wrapper ls-loc__map-wrapper" id="lsPreviewMapSlot">
            <div id="lsPreviewMap" class="sc-loc__map ls-loc__map"></div>
          </div>
        </div>
      `;

      this.bindStep5(container, state);
    },

    bindStep5(container, state) {
      const a = { lat: state.latA, lng: state.lngA };
      const b = { lat: state.latB, lng: state.lngB };
      const hasPoints = Number.isFinite(a.lat) && Number.isFinite(a.lng) && Number.isFinite(b.lat) && Number.isFinite(b.lng);
      const { widthA, widthB } = getLineWidths(state);
      const EXTENSION_METERS = 400;
      const ENDGUN_COLOR = "#1D4ED8";

      const cardsWrap = container.querySelector("#lsEndGunCards");
      const startInput = container.querySelector("#lsEndGunStart");
      const endInput = container.querySelector("#lsEndGunEnd");

      const visibleSides = () => (state.endGunSide === "both" ? ["left", "right"] : [state.endGunSide]);
      const segsFor = (side) => (side === "left" ? state.endGunSegmentsLeft : state.endGunSegments);
      const activeIdxFor = (side) => (side === "left" ? state.activeEndGunIndexLeft : state.activeEndGunIndexRight);
      const setActiveIdxFor = (side, idx) => {
        if (side === "left") state.activeEndGunIndexLeft = idx;
        else state.activeEndGunIndexRight = idx;
      };

      const map = ensureSharedPreviewMap(container, state, a, b);
      if (state._lsPreviewBandsLayer) state._lsPreviewBandsLayer.clearLayers();
      else if (map) state._lsPreviewBandsLayer = L.layerGroup().addTo(map);
      if (state._lsPreviewMarkersLayer) state._lsPreviewMarkersLayer.clearLayers();
      else if (map) state._lsPreviewMarkersLayer = L.layerGroup().addTo(map);
      const bandsLayer = state._lsPreviewBandsLayer;
      const markersLayer = state._lsPreviewMarkersLayer;
      // Limpa o que outro step tenha deixado no mapa compartilhado.
      state._lsPreviewLayer?.clearLayers();

      // Só as faixas coloridas (barato de redesenhar a cada frame do arraste).
      const redrawBands = () => {
        if (!bandsLayer) return;
        bandsLayer.clearLayers();
        if (!hasPoints || (widthA <= 0 && widthB <= 0)) return;

        [
          { width: widthA, sideNum: -1 },
          { width: widthB, sideNum: 1 },
        ].forEach(({ width, sideNum }) => {
          if (!(width > 0)) return;
          const corridorPoints = buildLineSegmentPolygon(a, b, width, 0, 100, sideNum);
          L.polygon(corridorPoints, { color: "#ffffff", weight: 1, opacity: 0.5, fillColor: "#ffffff", fillOpacity: 0.08, interactive: false }).addTo(bandsLayer);
        });

        visibleSides().forEach((side) => {
          const sideNum = side === "left" ? -1 : 1;
          const widthMeters = sideNum < 0 ? widthA : widthB;
          if (!(widthMeters > 0)) return;
          segsFor(side).forEach((segment, idx) => {
            const points = buildOuterBandPolygon(a, b, widthMeters, segment.startPercent, segment.endPercent, EXTENSION_METERS, sideNum, sideNum);
            if (!points.length) return;
            const isActive = state.activeEndGunSide === side && idx === activeIdxFor(side);
            L.polygon(points, {
              color: "#1d4ed8",
              weight: isActive ? 2 : 1,
              opacity: isActive ? 0.95 : 0.7,
              fillColor: "#bfdbfe",
              fillOpacity: isActive ? 0.5 : 0.32,
              dashArray: "10 5",
              interactive: false,
            }).addTo(bandsLayer);
          });
        });
      };

      // Os marcadores de fronteira: só recriados em mudanças estruturais
      // (lado/add/remover/dragend), nunca durante o próprio arraste.
      const buildMarkers = () => {
        if (!markersLayer) return;
        markersLayer.clearLayers();
        if (!hasPoints || (widthA <= 0 && widthB <= 0)) return;

        visibleSides().forEach((side) => {
          const sideNum = side === "left" ? -1 : 1;
          const widthMeters = sideNum < 0 ? widthA : widthB;
          if (!(widthMeters > 0)) return;
          segsFor(side).forEach((segment, idx) => {
            ["start", "end"].forEach((boundaryType) => {
              const percent = boundaryType === "start" ? segment.startPercent : segment.endPercent;
              const edgePt = getTrackEdgePoint(a, b, widthMeters, percent, sideNum, sideNum);
              const marker = L.marker([edgePt.lat, edgePt.lng], {
                icon: L.divIcon({
                  className: "pivo-map-drag-dot",
                  html: `<div style="width: 14px; height: 14px; border-radius: 50%; background: #fff; border: 3px solid ${ENDGUN_COLOR}; box-shadow: 0 0 4px rgba(0,0,0,.4);"></div>`,
                  iconSize: [14, 14],
                  iconAnchor: [7, 7],
                }),
                draggable: true,
              }).addTo(markersLayer);

              marker.on("drag", (event) => {
                const nextPercent = projectPercentOnTrack(event.latlng, a, b);
                const segs = segsFor(side);
                const clamped = boundaryType === "start"
                  ? clampEndGunStartPercent(idx, nextPercent, segs)
                  : clampEndGunEndPercent(idx, nextPercent, segs);
                if (boundaryType === "start") segs[idx].startPercent = clamped;
                else segs[idx].endPercent = clamped;
                redrawBands();
              });

              marker.on("dragend", () => {
                withPreservedScroll(container, () => {
                  state.activeEndGunSide = side;
                  if (side === "left") state.endGunSegmentsLeft = normalizeEndGunSegments(state.endGunSegmentsLeft);
                  else state.endGunSegments = normalizeEndGunSegments(state.endGunSegments);
                  setActiveIdxFor(side, Math.min(idx, segsFor(side).length - 1));
                  buildMarkers();
                  redrawBands();
                  renderCards();
                  populateForm();
                });
              });
            });
          });
        });
      };

      redrawBands();
      buildMarkers();

      const renderCards = () => {
        if (!cardsWrap) return;
        cardsWrap.innerHTML = "";
        const sides = visibleSides();
        cardsWrap.style.cssText = `display:grid;grid-template-columns:${sides.length > 1 ? "1fr 1fr" : "1fr"};gap:16px;`;

        sides.forEach((side) => {
          const segs = segsFor(side);
          const activeIdx = activeIdxFor(side);

          const card = document.createElement("section");
          card.className = "linestar-endgun-panel__side";

          const header = document.createElement("div");
          header.className = "linestar-endgun-panel__side-header";
          const title = document.createElement("div");
          title.className = "linestar-endgun-panel__side-title";
          title.textContent = side === "left" ? "Lado Esquerdo" : "Lado Direito";
          header.appendChild(title);
          card.appendChild(header);

          const list = document.createElement("div");
          list.className = "linestar-segment-toolbar__segment-list";
          list.style.marginTop = "8px";

          segs.forEach((seg, idx) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "pivo-seg-num-btn" + (idx === activeIdx && state.activeEndGunSide === side ? " is-active" : "");
            btn.style.cssText = `background:${ENDGUN_COLOR};--seg-color:${ENDGUN_COLOR};`;
            btn.textContent = String(idx + 1);
            btn.addEventListener("click", () => {
              withPreservedScroll(container, () => {
                state.activeEndGunSide = side;
                setActiveIdxFor(side, idx);
                renderCards();
                populateForm();
                redrawBands();
              });
            });
            list.appendChild(btn);
          });

          if (segs.length < 6) {
            const addBtn = document.createElement("button");
            addBtn.type = "button";
            addBtn.className = "pivo-seg-add-btn";
            addBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
            addBtn.title = "Adicionar trecho";
            addBtn.addEventListener("click", () => {
              withPreservedScroll(container, () => {
                state.activeEndGunSide = side;
                const newCount = segs.length + 1;
                const step = 100 / newCount;
                const newSegments = Array.from({ length: newCount }, (_, i) => ({
                  startPercent: roundPercent(i * step),
                  endPercent: i === newCount - 1 ? 100 : roundPercent((i + 1) * step),
                }));
                const normalized = normalizeEndGunSegments(newSegments);
                if (side === "left") { state.endGunSegmentsLeft = normalized; state.activeEndGunIndexLeft = normalized.length - 1; }
                else { state.endGunSegments = normalized; state.activeEndGunIndexRight = normalized.length - 1; }
                renderCards();
                populateForm();
                redrawBands();
                buildMarkers();
              });
            });
            list.appendChild(addBtn);
          }

          if (segs.length > 0) {
            const delBtn = document.createElement("button");
            delBtn.type = "button";
            delBtn.className = "pivo-seg-del-btn";
            delBtn.title = "Remover trecho";
            delBtn.innerHTML = '<i class="fa-regular fa-trash-can"></i>';
            delBtn.addEventListener("click", () => {
              withPreservedScroll(container, () => {
                state.activeEndGunSide = side;
                segs.splice(activeIdx, 1);
                setActiveIdxFor(side, Math.max(0, Math.min(activeIdx, segs.length - 1)));
                renderCards();
                populateForm();
                redrawBands();
                buildMarkers();
              });
            });
            list.appendChild(delBtn);
          }

          card.appendChild(list);
          cardsWrap.appendChild(card);
        });
      };

      const populateForm = () => {
        if (!startInput || !endInput) return;
        const segs = segsFor(state.activeEndGunSide);
        const segment = segs[activeIdxFor(state.activeEndGunSide)];
        if (!segment) {
          startInput.value = "";
          endInput.value = "";
          startInput.disabled = true;
          endInput.disabled = true;
          return;
        }
        startInput.disabled = false;
        endInput.disabled = false;
        startInput.value = String(segment.startPercent);
        endInput.value = String(segment.endPercent);
      };

      const applyBoundary = (kind, rawValue) => {
        const parsedValue = parsePercentDraft(rawValue);
        if (parsedValue === null) return false;
        const side = state.activeEndGunSide;
        const segs = segsFor(side);
        const idx = activeIdxFor(side);
        const segment = segs[idx];
        if (!segment) return false;

        if (kind === "start") segment.startPercent = clampEndGunStartPercent(idx, parsedValue, segs);
        else segment.endPercent = clampEndGunEndPercent(idx, parsedValue, segs);

        const normalized = normalizeEndGunSegments(segs);
        if (side === "left") state.endGunSegmentsLeft = normalized;
        else state.endGunSegments = normalized;
        renderCards();
        populateForm();
        redrawBands();
        buildMarkers();
        return true;
      };

      if (startInput) {
        startInput.addEventListener("blur", (event) => {
          withPreservedScroll(container, () => {
            if (!applyBoundary("start", event.target.value)) populateForm();
          });
        });
      }
      if (endInput) {
        endInput.addEventListener("blur", (event) => {
          withPreservedScroll(container, () => {
            if (!applyBoundary("end", event.target.value)) populateForm();
          });
        });
      }

      renderCards();
      populateForm();
    },

    readStep5(container, state) {
      return {
        endGunSide: state.endGunSide || "both",
        endGunSegments: state.endGunSegments || [],
        endGunSegmentsLeft: state.endGunSegmentsLeft || [],
        endGunEnabled: true,
        endGunMode: "auto",
      };
    },

    validateStep5() {
      return { ok: true, errors: {} };
    },

    renderStep6(container, state) {
      const errors = state._errors || {};

      const dist = (Number.isFinite(state.trackLengthCalc) && state.trackLengthCalc > 0)
        ? `${state.trackLengthCalc.toFixed(0)}`
        : (state.trackLength || "");

      container.innerHTML = `
        <div class="rs-config">
          <div class="equip-form">
            <div class="equip-form__row">
              <div class="equip-field ${errors.name ? "is-error" : ""}">
                <label class="equip-label" for="lsName"><span class="equip-required">*</span>Nome do equipamento</label>
                <input class="equip-input" id="lsName" placeholder="LineStar 01"
                       value="${escapeHtml(state.name || "")}"
                       aria-invalid="${errors.name ? "true" : "false"}" />
                <div class="rs-error ${errors.name ? "" : "is-hidden"}">Este campo é obrigatório</div>
              </div>

              <div class="equip-field ${errors.imei ? "is-error" : ""}">
                <label class="equip-label" for="lsImei"><span class="equip-required">*</span>Unique ID (UID)</label>
                <input class="equip-input" id="lsImei" placeholder="860585004298393"
                       value="${escapeHtml(state.imei || "")}"
                       aria-invalid="${errors.imei ? "true" : "false"}" />
                <div class="rs-error ${errors.imei ? "" : "is-hidden"}">Este campo é obrigatório</div>
              </div>

              <div class="equip-field">
                <label class="equip-label" for="lsControllerId">Controller ID (Ecostar)</label>
                <input class="equip-input" id="lsControllerId" placeholder="0357299070883654"
                       value="${escapeHtml(state.controllerId || "")}" />
              </div>
            </div>
          </div>

          <div class="rs-grid">
            <div class="rs-field ${errors.model ? "is-error" : ""}">
              <label class="equip-label" for="lsModel"><span class="equip-required">*</span>Modelo</label>
              <select class="equip-input" id="lsModel" aria-invalid="${errors.model ? "true" : "false"}">
                <option value="LineStar" selected>LineStar</option>
              </select>
              <div class="rs-error ${errors.model ? "" : "is-hidden"}">Este campo é obrigatório</div>
            </div>

            <div class="rs-field ${errors.trackLength ? "is-error" : ""}">
              <label class="equip-label" for="lsTrackLength"><span class="equip-required">*</span>Comprimento da pista</label>
              <div class="rs-input-group rs-input-group--locked">
                <input class="equip-input rs-input" id="lsTrackLength" type="text" inputmode="decimal"
                       value="${escapeHtml(dist)}"
                       aria-invalid="${errors.trackLength ? "true" : "false"}"
                       aria-readonly="true"
                       readonly
                       disabled />
                <span class="rs-input-suffix">m</span>
              </div>
              <div class="rs-error ${errors.trackLength ? "" : "is-hidden"}">Este campo é obrigatório</div>
            </div>

            <div class="rs-field ${errors.width ? "is-error" : ""}">
              <label class="equip-label" for="lsWidthA">Largura irrigada — lado A</label>
              <div class="rs-input-group rs-input-group--locked">
                <input class="equip-input rs-input" id="lsWidthA" type="text" inputmode="decimal"
                       value="${escapeHtml(state.widthA || "")}"
                       aria-invalid="${errors.width ? "true" : "false"}"
                       aria-readonly="true"
                       readonly
                       disabled />
                <span class="rs-input-suffix">m</span>
              </div>
              <div class="rs-error ${errors.width ? "" : "is-hidden"}">Informe a largura de pelo menos um dos lados no mapa.</div>
            </div>

            <div class="rs-field ${errors.width ? "is-error" : ""}">
              <label class="equip-label" for="lsWidthB">Largura irrigada — lado B</label>
              <div class="rs-input-group rs-input-group--locked">
                <input class="equip-input rs-input" id="lsWidthB" type="text" inputmode="decimal"
                       value="${escapeHtml(state.widthB || "")}"
                       aria-invalid="${errors.width ? "true" : "false"}"
                       aria-readonly="true"
                       readonly
                       disabled />
                <span class="rs-input-suffix">m</span>
              </div>
              <div class="rs-error ${errors.width ? "" : "is-hidden"}">Informe a largura de pelo menos um dos lados no mapa.</div>
            </div>

          </div>
        </div>
      `;

      this.bindStep6(container, state);
      if (window.IcEquipSelectInit) window.IcEquipSelectInit(container);
    },

    bindStep6(container, state) {
      const setValue = (key, el) => {
        if (!el) return;
        el.addEventListener("input", () => { state[key] = el.value; });
      };
      const setSelect = (key, el) => {
        if (!el) return;
        el.addEventListener("change", () => { state[key] = el.value; });
      };

      setValue("name", container.querySelector("#lsName"));
      setValue("imei", container.querySelector("#lsImei"));
      setValue("controllerId", container.querySelector("#lsControllerId"));
      setSelect("model", container.querySelector("#lsModel"));
      setValue("trackLength", container.querySelector("#lsTrackLength"));
      setValue("widthA", container.querySelector("#lsWidthA"));
      setValue("widthB", container.querySelector("#lsWidthB"));
    },

    readStep6(container) {
      return {
        name: container.querySelector("#lsName")?.value?.trim() || "",
        imei: container.querySelector("#lsImei")?.value?.trim() || "",
        controllerId: container.querySelector("#lsControllerId")?.value?.trim() || "",
        model: container.querySelector("#lsModel")?.value || "",
        trackLength: container.querySelector("#lsTrackLength")?.value?.trim() || "",
        widthA: container.querySelector("#lsWidthA")?.value?.trim() || "",
        widthB: container.querySelector("#lsWidthB")?.value?.trim() || "",
        width: ((parseNumber(container.querySelector("#lsWidthA")?.value) || 0) + (parseNumber(container.querySelector("#lsWidthB")?.value) || 0)).toFixed(2),
      };
    },

    validateStep6(data) {
      const errors = {};
      if (!data.name) errors.name = true;
      if (!data.imei) errors.imei = true;
      if (!data.model) errors.model = true;
      if (!data.trackLength) errors.trackLength = true;
      if ((parseNumber(data.widthA) || 0) <= 0 && (parseNumber(data.widthB) || 0) <= 0) errors.width = true;
      return { ok: Object.keys(errors).length === 0, errors };
    },

    // =================
    // STEP 7 — Bombeamento
    // =================
    renderStep7(container, state) {
      const errors = state._errors || {};
      state.powerUnit = "kw";

      container.innerHTML = `
        <div class="rs-config">
          <div class="sc-config__grid sc-config__grid--power-kw">
            <div class="sc-field ${errors.power ? "is-error" : ""}">
              <label class="equip-label" for="lsPower"><span class="equip-required">*</span> Potência elétrica <span class="edit-panel__tooltip-icon" data-tooltip="Potência real (absorvida): energia efetivamente absorvida da rede elétrica para operar o equipamento no ponto de trabalho atual, considerando o rendimento e a conversão para o sistema internacional de unidades."><i class="fa-regular fa-circle-question"></i></span></label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="lsPower" type="text" inputmode="decimal"
                       value="${escapeHtml(state.power || "")}" />
                <span class="sc-input-suffix">kW</span>
              </div>
              <div class="sc-error ${errors.power ? "" : "is-hidden"}">Este campo é obrigatório</div>
            </div>
          </div>

          <div class="sc-config__grid" style="margin-top:16px;">
            <div class="sc-field">
              <label class="equip-label">Vazão nominal</label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="lsFlow" type="text" inputmode="decimal"
                       value="${escapeHtml(state.flow || "200")}" />
                <span class="sc-input-suffix">m³/h</span>
              </div>
            </div>

            <div class="sc-field">
              <label class="equip-label">Pressão mínima</label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="lsPressMin" type="text" inputmode="decimal"
                       value="${escapeHtml(state.pressMin || "1.0")}" />
                <span class="sc-input-suffix">bar</span>
              </div>
            </div>

            <div class="sc-field">
              <label class="equip-label">Pressão máxima</label>
              <div class="sc-input-group">
                <input class="equip-input sc-input" id="lsPressMax" type="text" inputmode="decimal"
                       value="${escapeHtml(state.pressMax || "8.0")}" />
                <span class="sc-input-suffix">bar</span>
              </div>
            </div>
          </div>
        </div>
      `;

      this.bindStep7(container, state);
      if (window.IcEquipSelectInit) window.IcEquipSelectInit(container);
    },

    bindStep7(container, state) {
      const powerInput = container.querySelector("#lsPower");

      const setValue = (key, el) => {
        if (!el) return;
        el.addEventListener("input", () => { state[key] = el.value; });
      };
      setValue("flow", container.querySelector("#lsFlow"));
      setValue("pressMin", container.querySelector("#lsPressMin"));
      setValue("pressMax", container.querySelector("#lsPressMax"));

      if (powerInput) {
        powerInput.addEventListener("input", () => { state.power = powerInput.value; });
      }
    },

    readStep7(container) {
      return {
        power: container.querySelector("#lsPower")?.value?.trim() || "",
        powerUnit: "kw",
        flow: container.querySelector("#lsFlow")?.value?.trim() || "",
        pressMin: container.querySelector("#lsPressMin")?.value?.trim() || "",
        pressMax: container.querySelector("#lsPressMax")?.value?.trim() || "",
      };
    },

    validateStep7(data) {
      const errors = {};
      if (!data.power) errors.power = true;
      return { ok: Object.keys(errors).length === 0, errors };
    },

    // =================
    // STEP 8 — Conectividade
    // =================
    renderStep8(container, state) {
      container.innerHTML = `
        <div class="sc-config">
          <div class="edit-panel__grid-3" style="margin-bottom: 16px;">
            <div class="sc-field">
              <label class="equip-label" for="lsCommType"><span class="equip-required">*</span>Tipo de comunicação</label>
              <div class="equip-select" style="position: relative;">
                <select class="equip-input equip-select__native" id="lsCommType" aria-hidden="true" tabindex="-1" disabled>
                  <option value="4G" selected>4G</option>
                </select>
              </div>
            </div>
          </div>

          <div class="edit-panel__grid-3" style="margin-bottom:14px;">
            <div class="farm-radio-field">
              <div class="farm-radio-field__header">
                <span class="farm-radio-field__label"><span class="equip-required">*</span>ID do equipamento</span>
              </div>
              <div class="farm-radio-field__value">
                <div class="sc-input-group">
                  <input class="equip-input sc-input farm-radio-input" id="lsGateway" placeholder="10000000351D266D" value="${escapeHtml(state.gateway || "")}" />
                  <div class="farm-radio-actions">
                    <button type="button" class="farm-radio-clear" title="Limpar" data-clear="lsGateway"><i class="fa-solid fa-xmark"></i></button>
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

      this.bindStep8(container, state);
    },

    bindStep8(container, state) {
      state.commType = "4G";
      container.querySelector("#lsGateway")?.addEventListener("input", (e) => { state.gateway = e.target.value; });
      container.querySelectorAll("[data-clear]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const target = container.querySelector(`#${btn.dataset.clear}`);
          if (target) { target.value = ""; target.dispatchEvent(new Event("input")); }
        });
      });
    },
  };
})();
