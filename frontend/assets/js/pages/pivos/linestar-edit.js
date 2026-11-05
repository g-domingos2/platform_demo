// assets/js/pages/pivos/linestar-edit.js
(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);

    // Grava de verdade no dataset persistido (localStorage/API). O equip
    // passado já foi mutado em memória por handleSave; aqui só espelha esses
    // mesmos campos na cópia oficial (Cad.data.getAllFarms) e persiste.
    async function persistLinestarEquip(farm, equip) {
        if (!farm?.id || !equip?.id) return false;
        if (typeof window.Cad?.data?.getAllFarms !== "function" || typeof window.Cad?.data?.persistFarmDataset !== "function") {
            return false;
        }

        const farms = window.Cad.data.getAllFarms();
        const farmIndex = farms.findIndex((f) => String(f?.id || "") === String(farm.id || ""));
        if (farmIndex < 0) return false;

        const targetFarm = { ...farms[farmIndex] };
        const equipments = (Array.isArray(targetFarm?.equipments) ? targetFarm.equipments : []).map((item) => ({
            ...item,
            data: item?.data && typeof item.data === "object" ? { ...item.data } : {}
        }));

        const equipIndex = equipments.findIndex((item) => String(item?.id || "") === String(equip.id || ""));
        if (equipIndex < 0) return false;

        equipments[equipIndex] = {
            ...equipments[equipIndex],
            name: equip.name,
            comments: equip.comments,
            disabled: equip.disabled,
            data: { ...equipments[equipIndex].data, ...equip.data },
        };

        targetFarm.equipments = equipments;
        farms[farmIndex] = targetFarm;

        await window.Cad.data.persistFarmDataset(farms);
        window.CreateFarm?.setters?.setFarms?.(farms);
        return true;
    }

    function getActiveHoseSide() {
        const active = document.querySelector("#linestarEditPanel .js-linestar-hose-side.is-active");
        return active?.getAttribute("data-side") === "B" ? "B" : "A";
    }

    function parseNonNegativeWidth(value) {
        const numericValue = window.IcNumeric?.toFiniteNumber?.(value);
        const parsed = numericValue ?? Number(String(value ?? "").trim().replace(",", "."));
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    }

    function getStoredLineWidths(data = {}) {
        const hasSeparateWidths = Object.prototype.hasOwnProperty.call(data, "widthA")
            || Object.prototype.hasOwnProperty.call(data, "widthB");
        if (hasSeparateWidths) {
            return {
                widthA: parseNonNegativeWidth(data.widthA),
                widthB: parseNonNegativeWidth(data.widthB),
            };
        }

        const legacyWidth = parseNonNegativeWidth(data.width ?? "40");
        if (data.widthSide === -1 || data.widthSide === 1) {
            return {
                widthA: data.widthSide === -1 ? legacyWidth : 0,
                widthB: data.widthSide === 1 ? legacyWidth : 0,
            };
        }

        return { widthA: legacyWidth / 2, widthB: legacyWidth / 2 };
    }

    function getTrackEdgesAt(track, point) {
        const bearing = bearingRad(track.ptA, track.ptB);
        return {
            left: destinationPoint(point, track.widthA, bearing - (Math.PI / 2)),
            right: destinationPoint(point, track.widthB, bearing + (Math.PI / 2)),
        };
    }

    function signedPerpendicularDistanceMeters(origin, point, bearing) {
        const refLat = origin.lat;
        const metersPerDegreeLat = 111320;
        const metersPerDegreeLng = metersPerDegreeLat * Math.cos(refLat * Math.PI / 180);
        const dx = (point.lng - origin.lng) * metersPerDegreeLng;
        const dy = (point.lat - origin.lat) * metersPerDegreeLat;
        return dx * Math.cos(bearing) - dy * Math.sin(bearing);
    }

    function projectPointOntoTrack(pointA, pointB, point) {
        const refLat = (pointA.lat + pointB.lat) / 2;
        const metersPerDegreeLat = 111320;
        const metersPerDegreeLng = metersPerDegreeLat * Math.cos(refLat * Math.PI / 180);
        const toXY = (coord) => ({
            x: (coord.lng - pointA.lng) * metersPerDegreeLng,
            y: (coord.lat - pointA.lat) * metersPerDegreeLat,
        });
        const end = toXY(pointB);
        const target = toXY(point);
        const lengthSquared = end.x * end.x + end.y * end.y;
        if (!(lengthSquared > 0)) return pointA;
        const ratio = Math.max(0, Math.min(1, (target.x * end.x + target.y * end.y) / lengthSquared));
        return interpolatePoint(pointA, pointB, ratio);
    }

    function createLineStarPinIcon(side) {
        const color = side === "A" ? "#16a34a" : "#ef4444";
        const pinClass = side === "A" ? "pivot-pin--center" : "pivot-pin--ref";
        return L.divIcon({
            className: "",
            html: `<div class="pivot-pin ${pinClass}" style="color:${color}"><i class="fa-solid fa-location-dot"></i></div>`,
            iconSize: [30, 32],
            iconAnchor: [15, 30],
        });
    }

    function createLineStarTrackBadgeIcon(bearing, distance) {
        let rotation = ((bearing % 360) + 360) % 360;
        if (rotation > 90 && rotation < 270) rotation -= 180;
        return L.divIcon({
            className: "ls-track-badge-wrap",
            html: `<div class="ls-track-badge" style="--ls-track-angle:${Math.round(rotation)}deg"><span>${Math.round(bearing)}&deg;</span><span>${Math.round(distance)}m</span></div>`,
            iconSize: [1, 1],
            iconAnchor: [0, 0],
        });
    }

    function syncLocationEndpointMarkers() {
        if (!editMapInstance) return;
        [
            { side: "A", inputId: "linestarEditLocA", color: "#16a34a", markerKey: "A" },
            { side: "B", inputId: "linestarEditLocB", color: "#dc2626", markerKey: "B" },
        ].forEach(({ side, inputId, color, markerKey }) => {
            const point = parseLatLngText($(inputId)?.value);
            let marker = markerKey === "A" ? pickMarkerA : pickMarkerB;
            if (!point) {
                if (marker) marker.remove();
                if (markerKey === "A") pickMarkerA = null;
                else pickMarkerB = null;
                return;
            }

            if (!marker) {
                marker = L.marker([point.lat, point.lng], {
                    icon: createLineStarPinIcon(side),
                    draggable: true,
                    zIndexOffset: 1000,
                }).addTo(editMapInstance);
                const input = $(inputId);
                marker.on("drag", (event) => {
                    if (!input) return;
                    input.value = `${event.latlng.lat.toFixed(7)}, ${event.latlng.lng.toFixed(7)}`;
                    input.dispatchEvent(new Event("input"));
                });
                marker.on("dragend", (event) => {
                    if (!input) return;
                    const latlng = event.target.getLatLng();
                    input.value = `${latlng.lat.toFixed(7)}, ${latlng.lng.toFixed(7)}`;
                    input.dispatchEvent(new Event("input"));
                });
                if (markerKey === "A") pickMarkerA = marker;
                else pickMarkerB = marker;
            } else {
                marker.setLatLng([point.lat, point.lng]);
            }
        });
    }
    let selectedId = null;
    let editMapInstance = null;
    let editTrackLayer = null;
    let editMapZoomHint = null;
    let editMapWheelMode = "ctrl";
    let editMapWheelListenersBound = false;
    let editMapHintTimer = null;
    let lineSegments = [{
        id: "seg_0",
        name: "",
        startPercent: 0,
        endPercent: 100,
        endGunEnabled: true,
        endGunLeftEnabled: true,
        endGunRightEnabled: true
    }];
    let activeLineSegmentIndex = 0;
    let showLineSegmentColors = true;
    let endGunMapInstance = null;
    let endGunTrackLayer = null;
    let endGunSegments = [];
    let activeEndGunSegmentIndex = 0;
    let endGunSegmentsLeft = [];
    let activeEndGunSegmentIndexLeft = 0;
    let activeEndGunSide = "right";
    let endGunBoundaryMarkers = [];
    let pickMarkerA = null;
    let pickMarkerB = null;
    let pickMarkerZero = null;
    let pickMarkerWidth = null;
    let widthPickActive = null;
    let widthMeasurePoint = null;
    let widthMeasureSide = null;
    let widthPickCleanup = null;
    let widthPickLiveUpdate = false;

    let intermediatePositions = [];
    let activeIntermediateIndex = 0;
    let intermediateMapInstance = null;
    let intermediateTrackLayer = null;

    const segmentPalette = [
        "rgb(0, 31, 153)",
        "rgb(160, 0, 229)",
        "rgb(0, 196, 179)",
        "rgb(82, 183, 0)",
        "rgb(255, 213, 0)",
        "rgb(255, 115, 0)",
        "rgb(142, 68, 173)",
        "rgb(22, 160, 133)",
        "rgb(233, 30, 99)"
    ];
    const endGunSegmentColor = "#1D4ED8";
    const endGunHandleIcon = typeof L !== "undefined" ? L.divIcon({
        className: "pivo-map-drag-dot",
        html: '<div style="width: 14px; height: 14px; border-radius: 50%; background: #fff; border: 3px solid #1D4ED8; box-shadow: 0 0 4px rgba(0,0,0,.4);"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
    }) : null;

    const toNumber = (value) => {
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    };

    const parseLatLngText = (value) => {
        const parts = String(value || "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
        if (parts.length < 2) return null;
        const lat = toNumber(parts[0]);
        const lng = toNumber(parts[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { lat, lng };
    };

    const clampPercent = (value) => Math.max(0, Math.min(100, Number(value) || 0));
    const roundPercent = (value) => Math.round((Number(value) || 0) * 10) / 10;
    const roundMeters = (value) => Math.round((Number(value) || 0) * 10) / 10;
    const parsePercentDraft = (value) => {
        const text = String(value ?? "").trim().replace(",", ".");
        if (!text || text === "-" || text === "." || text === "-." || /[.,]$/.test(text)) return null;
        const parsed = Number(text);
        return Number.isFinite(parsed) ? parsed : null;
    };
    const sanitizePercentDraftInput = (input) => {
        if (!input) return "";

        const raw = String(input.value ?? "");
        let next = raw.replace(/[^\d,.\-]/g, "");

        if (next.includes("-")) {
            next = `${next.startsWith("-") ? "-" : ""}${next.replace(/\-/g, "")}`;
        }

        const sepIndex = next.search(/[.,]/);
        if (sepIndex >= 0) {
            next = `${next.slice(0, sepIndex + 1)}${next.slice(sepIndex + 1).replace(/[.,]/g, "")}`;
        }

        const parsed = parsePercentDraft(next);
        if (parsed !== null) {
            if (parsed > 100) next = "100";
            else if (parsed < 0) next = "0";
        }

        if (next !== raw) input.value = next;
        return input.value;
    };
    const createDefaultLineSegment = (id = "seg_0") => ({
        id: String(id),
        name: "",
        startPercent: 0,
        endPercent: 100,
        endGunEnabled: true,
        endGunLeftEnabled: true,
        endGunRightEnabled: true
    });
    const isLineSegmentEndGunEnabled = (segment) => segment?.endGunEnabled !== false;
    const getLineSegmentEndGunState = (segment, side) => {
        if (side === "left") return segment?.endGunLeftEnabled !== false;
        return segment?.endGunRightEnabled !== false;
    };
    const setLineSegmentEndGunState = (segment, side, enabled) => {
        if (!segment) return;
        if (side === "left") segment.endGunLeftEnabled = Boolean(enabled);
        else segment.endGunRightEnabled = Boolean(enabled);
        segment.endGunEnabled = (segment.endGunLeftEnabled !== false) || (segment.endGunRightEnabled !== false);
    };
    const getVisibleIntegratedEndGunSides = () => {
        const sideMode = $("linestarSegmentEndGunSide")?.value || "right";
        if (sideMode === "both") return ["left", "right"];
        return [sideMode === "left" ? "left" : "right"];
    };
    const isIntegratedEndGunEnabled = () => true;

    const interpolatePoint = (from, to, ratio) => ({
        lat: from.lat + (to.lat - from.lat) * ratio,
        lng: from.lng + (to.lng - from.lng) * ratio,
    });

    const distanceMetersBetween = (from, to) => {
        if (!from || !to) return 0;
        const R = 6378137;
        const toRad = (deg) => (deg * Math.PI) / 180;
        const dLat = toRad((to.lat || 0) - (from.lat || 0));
        const dLng = toRad((to.lng || 0) - (from.lng || 0));
        const lat1 = toRad(from.lat || 0);
        const lat2 = toRad(to.lat || 0);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const toLocalMeters = (p, refLat) => {
        const metersPerDegLat = 111320;
        const metersPerDegLng = 111320 * Math.cos(refLat * Math.PI / 180);
        return { x: p.lng * metersPerDegLng, y: p.lat * metersPerDegLat };
    };

    const pointToSegmentDistanceMeters = (p, a, b) => {
        const refLat = (a.lat + b.lat) / 2;
        const P = toLocalMeters(p, refLat);
        const A = toLocalMeters(a, refLat);
        const B = toLocalMeters(b, refLat);
        const ABx = B.x - A.x;
        const ABy = B.y - A.y;
        const APx = P.x - A.x;
        const APy = P.y - A.y;
        const ab2 = ABx * ABx + ABy * ABy;
        if (ab2 <= 1e-9) return Math.hypot(APx, APy);
        const t = Math.max(0, Math.min(1, (APx * ABx + APy * ABy) / ab2));
        const projX = A.x + t * ABx;
        const projY = A.y + t * ABy;
        return Math.hypot(P.x - projX, P.y - projY);
    };

    function normalizeLineSegments(segments) {
        const list = Array.isArray(segments) && segments.length ? segments : [];
        if (!list.length) return [];

        const normalized = [];
        let currentStart = 0;

        list.forEach((segment, idx) => {
            const isLast = idx === list.length - 1;
            const rawEnd = Number(segment?.endPercent ?? segment?.endAngle);
            let endPercent = Number.isFinite(rawEnd) ? clampPercent(rawEnd) : 100;
            const legacyEnabled = segment?.endGunEnabled !== false;
            const endGunLeftEnabled = typeof segment?.endGunLeftEnabled === "boolean"
                ? segment.endGunLeftEnabled
                : legacyEnabled;
            const endGunRightEnabled = typeof segment?.endGunRightEnabled === "boolean"
                ? segment.endGunRightEnabled
                : legacyEnabled;
            if (!isLast) {
                endPercent = Math.max(currentStart + 0.1, Math.min(99.9, endPercent));
            } else {
                endPercent = 100;
            }

            normalized.push({
                id: String(segment?.id || `seg_${idx}`),
                name: String(segment?.name || ""),
                startPercent: roundPercent(currentStart),
                endPercent: roundPercent(endPercent),
                endGunEnabled: endGunLeftEnabled || endGunRightEnabled,
                endGunLeftEnabled,
                endGunRightEnabled
            });

            currentStart = endPercent;
        });

        if (normalized.length) {
            normalized[0].startPercent = 0;
            normalized[normalized.length - 1].endPercent = 100;
            for (let i = 1; i < normalized.length; i += 1) {
                normalized[i].startPercent = normalized[i - 1].endPercent;
            }
        }

        return normalized;
    }

    function cloneLineSegmentsForSave() {
        return normalizeLineSegments(lineSegments).map((segment, idx) => ({
            id: String(segment?.id || `seg_${idx}`),
            name: String(segment?.name || ""),
            startPercent: roundPercent(segment?.startPercent),
            endPercent: roundPercent(segment?.endPercent),
            endGunEnabled: isLineSegmentEndGunEnabled(segment),
            endGunLeftEnabled: getLineSegmentEndGunState(segment, "left"),
            endGunRightEnabled: getLineSegmentEndGunState(segment, "right")
        }));
    }

    function applyLegacyEndGunSelectionToLineSegments(segments, legacySegments) {
        const normalizedSegments = normalizeLineSegments(segments);
        const legacy = normalizeEndGunSegments(legacySegments);
        if (!normalizedSegments.length) return [];
        if (!legacy.length) {
            return normalizedSegments.map((segment) => ({
                ...segment,
                endGunEnabled: isLineSegmentEndGunEnabled(segment),
                endGunLeftEnabled: getLineSegmentEndGunState(segment, "left"),
                endGunRightEnabled: getLineSegmentEndGunState(segment, "right")
            }));
        }

        return normalizedSegments.map((segment) => {
            const hasOverlap = legacy.some((legacySegment) => {
                return legacySegment.endPercent > segment.startPercent && legacySegment.startPercent < segment.endPercent;
            });
            return {
                ...segment,
                endGunEnabled: hasOverlap,
                endGunLeftEnabled: hasOverlap,
                endGunRightEnabled: hasOverlap
            };
        });
    }

    function loadLineSegments(segments, legacyEndGunSegments = []) {
        const rawSegments = Array.isArray(segments) && segments.length ? segments : [createDefaultLineSegment()];
        const hasExplicitEndGunState = rawSegments.some((segment) => {
            return Object.prototype.hasOwnProperty.call(segment || {}, "endGunEnabled")
                || Object.prototype.hasOwnProperty.call(segment || {}, "endGunLeftEnabled")
                || Object.prototype.hasOwnProperty.call(segment || {}, "endGunRightEnabled");
        });
        lineSegments = normalizeLineSegments(rawSegments);
        if (!hasExplicitEndGunState) {
            lineSegments = applyLegacyEndGunSelectionToLineSegments(lineSegments, legacyEndGunSegments);
        }
        activeLineSegmentIndex = Math.min(activeLineSegmentIndex, Math.max(0, lineSegments.length - 1));
        showLineSegmentColors = true;
    }

    function normalizeEndGunSegments(segments) {
        const list = (Array.isArray(segments) ? segments : [])
            .map((segment, idx) => {
                const startPercent = clampPercent(segment?.startPercent ?? segment?.startAngle ?? 0);
                const endPercent = clampPercent(segment?.endPercent ?? segment?.endAngle ?? 0);
                return {
                    id: String(segment?.id || `eg_${idx}`),
                    startPercent: roundPercent(startPercent),
                    endPercent: roundPercent(endPercent)
                };
            })
            .filter((segment) => segment.endPercent > segment.startPercent)
            .sort((a, b) => a.startPercent - b.startPercent);

        const normalized = [];
        list.forEach((segment) => {
            const previous = normalized[normalized.length - 1] || null;
            const minStart = previous ? roundPercent(previous.endPercent + 0.1) : 0;
            const startPercent = roundPercent(Math.max(minStart, clampPercent(segment.startPercent)));
            const endPercent = roundPercent(Math.min(100, Math.max(startPercent + 0.1, clampPercent(segment.endPercent))));
            if (endPercent <= startPercent) return;
            normalized.push({
                id: segment.id,
                startPercent,
                endPercent
            });
        });

        return normalized;
    }

    function cloneEndGunSegmentsForSave() {
        return normalizeEndGunSegments(endGunSegments).map((segment, idx) => ({
            id: String(segment?.id || `eg_${idx}`),
            startPercent: roundPercent(segment?.startPercent),
            endPercent: roundPercent(segment?.endPercent)
        }));
    }

    function loadEndGunSegments(segments) {
        endGunSegments = normalizeEndGunSegments(segments);
        activeEndGunSegmentIndex = Math.min(activeEndGunSegmentIndex, Math.max(0, endGunSegments.length - 1));
    }

    function ensureDefaultEndGunSegment() {
        // Agora permitimos que comece vazio (apenas com o botão de +) conforme solicitado.
        // O primeiro clique no botão de + criará o segmento 0-100%.
    }

    const bearingRad = (from, to) => {
        const toRad = (deg) => (deg * Math.PI) / 180;
        const lat1 = toRad(from.lat);
        const lat2 = toRad(to.lat);
        const dLng = toRad(to.lng - from.lng);
        const y = Math.sin(dLng) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
        return Math.atan2(y, x);
    };

    const destinationPoint = (origin, distance, bearing) => {
        const R = 6378137;
        const toRad = (deg) => (deg * Math.PI) / 180;
        const toDeg = (rad) => (rad * 180) / Math.PI;
        const delta = distance / R;
        const phi1 = toRad(origin.lat);
        const lambda1 = toRad(origin.lng);

        const sinPhi1 = Math.sin(phi1);
        const cosPhi1 = Math.cos(phi1);
        const sinDelta = Math.sin(delta);
        const cosDelta = Math.cos(delta);

        const sinPhi2 = sinPhi1 * cosDelta + cosPhi1 * sinDelta * Math.cos(bearing);
        const phi2 = Math.asin(Math.max(-1, Math.min(1, sinPhi2)));
        const y = Math.sin(bearing) * sinDelta * cosPhi1;
        const x = cosDelta - sinPhi1 * Math.sin(phi2);
        const lambda2 = lambda1 + Math.atan2(y, x);

        return { lat: toDeg(phi2), lng: toDeg(lambda2) };
    };

    function getLineStarVisuals(equip) {
        const baseVisuals = window.IcMapPivotVisualUtils?.getPivotBaseVisuals?.() || {
            fill: "#bcac24",
            stroke: "#edb320",
            outline: "#edb320",
            fillOpacity: 0.82,
            statusText: "PAINEL ENERGIZADO",
            statusClass: "is-warning"
        };
        const resolvedStatus = window.IcResolvePivotStatus?.(equip) || null;
        const simState = window.IcPivotSimulationRuntime?.states?.[equip?.id] || null;
        const progress = clampPercent(simState?.progress);
        const progressKeys = new Set(["irrigando", "movendo_a_seco", "ferti_irrigando"]);

        if (resolvedStatus?.visual) {
            const statusKey = String(resolvedStatus.key || "");
            const fillOpacityBase = Number(resolvedStatus.visual.fillOpacity ?? baseVisuals.fillOpacity);
            return {
                statusKey,
                fill: resolvedStatus.visual.fill,
                stroke: resolvedStatus.visual.stroke,
                outline: resolvedStatus.visual.outline || resolvedStatus.visual.stroke,
                fillOpacity: Math.max(0.38, Math.min(0.74, fillOpacityBase * 0.82)),
                progressFill: resolvedStatus.visual.outerFill || resolvedStatus.visual.stroke,
                lineProgress: progressKeys.has(statusKey) ? progress : 0,
                statusText: resolvedStatus.statusText || resolvedStatus.badgeText || "PIVO LINEAR",
                statusClass: resolvedStatus.statusClass || "is-warning",
            };
        }

        return {
            statusKey: "",
            fill: baseVisuals.fill,
            stroke: baseVisuals.stroke,
            outline: baseVisuals.outline,
            fillOpacity: Number(baseVisuals.fillOpacity ?? 0.82),
            progressFill: baseVisuals.stroke,
            lineProgress: 0,
            statusText: "PIVO LINEAR",
            statusClass: "is-warning",
        };
    }

    function getTrackPreviewData(equip) {
        const data = equip?.data || {};
        const pointA = parseLatLngText($("linestarEditLocA")?.value) || {
            lat: parseFloat(data.latA),
            lng: parseFloat(data.lngA)
        };
        const pointB = parseLatLngText($("linestarEditLocB")?.value) || {
            lat: parseFloat(data.latB),
            lng: parseFloat(data.lngB)
        };
        const storedWidths = getStoredLineWidths(data);
        const widthInputA = $("linestarEditWidthA");
        const widthInputB = $("linestarEditWidthB");
        const widthA = widthInputA ? parseNonNegativeWidth(widthInputA.value) : storedWidths.widthA;
        const widthB = widthInputB ? parseNonNegativeWidth(widthInputB.value) : storedWidths.widthB;

        if (!Number.isFinite(pointA?.lat) || !Number.isFinite(pointA?.lng) || !Number.isFinite(pointB?.lat) || !Number.isFinite(pointB?.lng)) {
            return null;
        }

        return {
            ptA: pointA,
            ptB: pointB,
            widthA,
            widthB,
            width: widthA + widthB
        };
    }

    function buildLineSegmentPolygon(track, startPercent, endPercent) {
        if (!track || !(track.width > 0)) return [];
        const startRatio = clampPercent(startPercent) / 100;
        const endRatio = clampPercent(endPercent) / 100;
        const ptA = interpolatePoint(track.ptA, track.ptB, startRatio);
        const ptB = interpolatePoint(track.ptA, track.ptB, endRatio);
        const aEdges = getTrackEdgesAt(track, ptA);
        const bEdges = getTrackEdgesAt(track, ptB);

        return [
            [aEdges.left.lat, aEdges.left.lng],
            [bEdges.left.lat, bEdges.left.lng],
            [bEdges.right.lat, bEdges.right.lng],
            [aEdges.right.lat, aEdges.right.lng]
        ];
    }

    function buildLineOuterBandPolygons(track, startPercent, endPercent, bandWidth) {
        if (!track || !(track.width > 0) || !(bandWidth > 0)) return { left: [], right: [] };
        const startRatio = clampPercent(startPercent) / 100;
        const endRatio = clampPercent(endPercent) / 100;
        const ptA = interpolatePoint(track.ptA, track.ptB, startRatio);
        const ptB = interpolatePoint(track.ptA, track.ptB, endRatio);
        const cappedBandA = Math.min(bandWidth, track.widthA * 0.5);
        const cappedBandB = Math.min(bandWidth, track.widthB * 0.5);
        const aEdges = getTrackEdgesAt(track, ptA);
        const bEdges = getTrackEdgesAt(track, ptB);
        const bearing = bearingRad(track.ptA, track.ptB);
        const aLeftOuter = destinationPoint(ptA, track.widthA + cappedBandA, bearing - (Math.PI / 2));
        const bLeftOuter = destinationPoint(ptB, track.widthA + cappedBandA, bearing - (Math.PI / 2));
        const aRightOuter = destinationPoint(ptA, track.widthB + cappedBandB, bearing + (Math.PI / 2));
        const bRightOuter = destinationPoint(ptB, track.widthB + cappedBandB, bearing + (Math.PI / 2));

        return {
            left: [
                [aEdges.left.lat, aEdges.left.lng],
                [bEdges.left.lat, bEdges.left.lng],
                [bLeftOuter.lat, bLeftOuter.lng],
                [aLeftOuter.lat, aLeftOuter.lng]
            ],
            right: [
                [aEdges.right.lat, aEdges.right.lng],
                [bEdges.right.lat, bEdges.right.lng],
                [bRightOuter.lat, bRightOuter.lng],
                [aRightOuter.lat, aRightOuter.lng]
            ]
        };
    }

    function drawLineStarZeroAngleMarkers(layer, track, options = {}) {
        if (!layer || !track?.ptA || !track?.ptB) return;

        const hasWidthA = Number(track.widthA) > 0;
        const hasWidthB = Number(track.widthB) > 0;
        if (!hasWidthA && !hasWidthB) return;

        const brng = bearingRad(track.ptA, track.ptB);
        const offsetPerp = (origin, meters, markerSide) => destinationPoint(origin, meters, brng + (markerSide * Math.PI / 2));
        const refColor = options.color || "#ffffff";
        const refOpacity = options.opacity ?? 0.95;
        const selectedSide = options.hoseSide === "B" ? "B" : "A";

        const drawMarker = (origin, width, markerSide) => {
            if (!(Number(width) > 0)) return;
            const edge = offsetPerp(origin, width, markerSide);
            const triHeight = width * 0.44;
            const triHalfBase = width * 0.20;
            const tipBearing = markerSide === -1 ? brng + Math.PI / 2 : brng - Math.PI / 2;
            const base1 = destinationPoint(edge, triHalfBase, brng);
            const base2 = destinationPoint(edge, triHalfBase, brng + Math.PI);
            const tip = destinationPoint(edge, triHeight, tipBearing);

            L.polygon([base1, base2, tip].map((p) => [p.lat, p.lng]), {
                color: refColor,
                weight: 1,
                opacity: refOpacity,
                fillColor: refColor,
                fillOpacity: 0.95,
                interactive: false,
            }).addTo(layer);
        };

        if (hasWidthA && hasWidthB) {
            if (selectedSide === "A") drawMarker(track.ptA, track.widthA, -1);
            else drawMarker(track.ptB, track.widthB, 1);
            return;
        }

        const markerOrigin = selectedSide === "A" ? track.ptA : track.ptB;
        if (hasWidthA) drawMarker(markerOrigin, track.widthA, -1);
        else if (hasWidthB) drawMarker(markerOrigin, track.widthB, 1);
    }

    function getTrackLengthMeters(track) {
        if (!track?.ptA || !track?.ptB) return 0;
        return distanceMetersBetween(track.ptA, track.ptB);
    }

    function percentToTrackMeters(track, percent) {
        const total = getTrackLengthMeters(track);
        if (!(total > 0)) return 0;
        return roundMeters((clampPercent(percent) / 100) * total);
    }

    function metersToTrackPercent(track, meters) {
        const total = getTrackLengthMeters(track);
        if (!(total > 0)) return 0;
        const boundedMeters = Math.max(0, Math.min(total, Number(meters) || 0));
        return roundPercent((boundedMeters / total) * 100);
    }

    function projectPointToTrackPercent(track, point) {
        if (!track?.ptA || !track?.ptB || !point) return 0;
        const lat0 = ((track.ptA.lat + track.ptB.lat) / 2) * Math.PI / 180;
        const metersPerDegLat = 111320;
        const metersPerDegLng = 111320 * Math.cos(lat0);
        const toXY = (coord) => ({
            x: (coord.lng - track.ptA.lng) * metersPerDegLng,
            y: (coord.lat - track.ptA.lat) * metersPerDegLat
        });

        const a = { x: 0, y: 0 };
        const b = toXY(track.ptB);
        const p = toXY(point);
        const abx = b.x - a.x;
        const aby = b.y - a.y;
        const abLenSq = (abx * abx) + (aby * aby);
        if (!(abLenSq > 0)) return 0;
        const ratio = ((p.x * abx) + (p.y * aby)) / abLenSq;
        return roundPercent(Math.max(0, Math.min(1, ratio)) * 100);
    }

    function getCurrentEditEquipment() {
        const farm = window.IcFarmGetActive?.() || window.IcFarmActive;
        return farm?.equipments?.find((equip) => equip.id === selectedId) || null;
    }

    function getCurrentTrackForEdit() {
        const equip = getCurrentEditEquipment();
        return equip ? getTrackPreviewData(equip) : null;
    }

    function getEndGunBoundaryPoints(track, boundaryPercent) {
        if (!track || !(track.width > 0)) return null;
        const ratio = clampPercent(boundaryPercent) / 100;
        const point = interpolatePoint(track.ptA, track.ptB, ratio);
        const edges = getTrackEdgesAt(track, point);
        return {
            center: point,
            left: edges.left,
            right: edges.right
        };
    }

    function resolveEndGunSegmentIndex(index, fallbackId, segs) {
        const list = segs || endGunSegments;
        if (!fallbackId) return Math.max(0, Math.min(index, list.length - 1));
        const nextIndex = list.findIndex((segment) => segment.id === fallbackId);
        return nextIndex >= 0 ? nextIndex : Math.max(0, Math.min(index, list.length - 1));
    }

    function clampEndGunStartPercent(index, nextPercent, segs) {
        const list = segs || endGunSegments;
        const current = list[index];
        if (!current) return 0;
        const previous = list[index - 1] || null;
        const minValue = previous ? Number(previous.endPercent) + 0.1 : 0;
        const maxValue = Number(current.endPercent) - 0.1;
        return roundPercent(Math.max(minValue, Math.min(maxValue, clampPercent(nextPercent))));
    }

    function clampEndGunEndPercent(index, nextPercent, segs) {
        const list = segs || endGunSegments;
        const current = list[index];
        if (!current) return 100;
        const minValue = Number(current.startPercent) + 0.1;
        const next = list[index + 1] || null;
        const maxValue = next ? Number(next.startPercent) - 0.1 : 100;
        return roundPercent(Math.max(minValue, Math.min(Math.max(minValue, maxValue), clampPercent(nextPercent))));
    }

    function updateEndGunSegmentBoundary(index, boundaryType, nextPercent) {
        const segs = activeEndGunSide === "left" ? endGunSegmentsLeft : endGunSegments;
        const segment = segs[index];
        if (!segment) return;
        const segmentId = segment.id;
        if (boundaryType === "start") {
            segment.startPercent = clampEndGunStartPercent(index, nextPercent, segs);
        } else {
            segment.endPercent = clampEndGunEndPercent(index, nextPercent, segs);
        }
        if (activeEndGunSide === "left") {
            endGunSegmentsLeft = normalizeEndGunSegments(endGunSegmentsLeft);
            activeEndGunSegmentIndexLeft = resolveEndGunSegmentIndex(index, segmentId, endGunSegmentsLeft);
        } else {
            endGunSegments = normalizeEndGunSegments(endGunSegments);
            activeEndGunSegmentIndex = resolveEndGunSegmentIndex(index, segmentId, endGunSegments);
        }
        renderEndGunSegmentsUI();
        populateEndGunSegmentForm(true);
        window.IcLineStarEdit?.drawEndGunOnEditMap?.();
    }

    function renderIntermediateUI() {
        const wrap = $("linestarEditIntermediateList");
        if (!wrap) return;
        wrap.innerHTML = "";

        intermediatePositions.forEach((pos, idx) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "pivo-seg-num-btn" + (idx === activeIntermediateIndex ? " is-active" : "");
            btn.style.cssText = `background: #ef4444; --seg-color: #ef4444;`;
            btn.textContent = String(idx + 1);
            btn.addEventListener("click", () => {
                activeIntermediateIndex = idx;
                renderIntermediateUI();
                populateIntermediateForm();
                window.IcLineStarEdit?.drawIntermediateOnEditMap?.();
            });
            wrap.appendChild(btn);
        });

        if (intermediatePositions.length < 12) {
        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.className = "pivo-seg-add-btn";
        addBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
        addBtn.title = "Adicionar posição intermediária";
        addBtn.addEventListener("click", () => {
            if (intermediatePositions.length >= 12) return;
            const track = getCurrentTrackForEdit();
            const totalMeters = getTrackLengthMeters(track);
            const lastDistance = intermediatePositions.length > 0
                ? (intermediatePositions[intermediatePositions.length - 1].distanceMeters || 0)
                : 0;
            const nextDistance = Math.min(totalMeters || 0, lastDistance + 100);
            intermediatePositions.push({
                id: `ip_${Date.now()}`,
                distanceMeters: nextDistance
            });
            activeIntermediateIndex = intermediatePositions.length - 1;
            renderIntermediateUI();
            populateIntermediateForm();
            window.IcLineStarEdit?.drawIntermediateOnEditMap?.();
        });
        wrap.appendChild(addBtn);
        }

        if (intermediatePositions.length > 0) {
            const delBtn = document.createElement("button");
            delBtn.type = "button";
            delBtn.className = "pivo-seg-del-btn";
            delBtn.innerHTML = '<i class="fa-regular fa-trash-can"></i>';
            delBtn.title = "Remover posição intermediária";
            delBtn.addEventListener("click", () => {
                intermediatePositions.splice(activeIntermediateIndex, 1);
                activeIntermediateIndex = Math.max(0, Math.min(activeIntermediateIndex, intermediatePositions.length - 1));
                renderIntermediateUI();
                populateIntermediateForm();
                window.IcLineStarEdit?.drawIntermediateOnEditMap?.();
            });
            wrap.appendChild(delBtn);
        }
    }

    function populateIntermediateForm() {
        const input = $("linestarEditIntermediateDistance");
        if (!input) return;
        const pos = intermediatePositions[activeIntermediateIndex];
        if (!pos) {
            input.value = "";
            input.disabled = true;
            input.classList.add("is-disabled");
            input.style.cssText = "background: #f8fafc; color: #94a3b8; cursor: not-allowed; pointer-events: none;";
            return;
        }
        input.disabled = false;
        input.classList.remove("is-disabled");
        input.style.cssText = "";
        input.value = String(roundMeters(pos.distanceMeters));
    }

    function bindIntermediateInputs() {
        const input = $("linestarEditIntermediateDistance");
        if (!input) return;
        input.addEventListener("input", () => {
            const pos = intermediatePositions[activeIntermediateIndex];
            if (!pos) return;
            const val = window.IcNumeric.toFiniteNumber(input.value);
            if (val !== null && val >= 0) {
                pos.distanceMeters = val;
                window.IcLineStarEdit?.drawIntermediateOnEditMap?.();
            }
        });
    }

    function cleanupIntermediateMap() {
        intermediateTrackLayer = null;
        if (intermediateMapInstance) {
            intermediateMapInstance.remove();
            intermediateMapInstance = null;
        }
    }

    function ensureEditMapWheelHint(mapEl) {
        if (!mapEl) return;
        if (editMapZoomHint && !editMapZoomHint.isConnected) {
            editMapZoomHint = null;
        }
        if (editMapZoomHint) return;
        editMapZoomHint = document.createElement("div");
        editMapZoomHint.className = "map-zoom-hint";
        editMapZoomHint.textContent = "Pressione Ctrl e role a tela simultaneamente para aplicar zoom no mapa";
        mapEl.appendChild(editMapZoomHint);
    }

    function cleanupEditMap() {
        if (editMapHintTimer) {
            clearTimeout(editMapHintTimer);
            editMapHintTimer = null;
        }
        widthPickCleanup?.();
        widthPickCleanup = null;
        widthPickActive = null;
        widthMeasurePoint = null;
        widthMeasureSide = null;
        editMapZoomHint = null;
        editTrackLayer = null;
        if (pickMarkerA) { pickMarkerA.remove(); pickMarkerA = null; }
        if (pickMarkerB) { pickMarkerB.remove(); pickMarkerB = null; }
        if (pickMarkerZero) { pickMarkerZero.remove(); pickMarkerZero = null; }
        if (pickMarkerWidth) { pickMarkerWidth.remove(); pickMarkerWidth = null; }
        if (editMapInstance) {
            editMapInstance.remove();
            editMapInstance = null;
        }
    }

    function cleanupEndGunMap() {
        endGunBoundaryMarkers.forEach((marker) => marker.remove());
        endGunBoundaryMarkers = [];
        endGunTrackLayer = null;
        if (endGunMapInstance) {
            endGunMapInstance.remove();
            endGunMapInstance = null;
        }
    }

    function showEditMapWheelHint() {
        if (!editMapZoomHint) return;
        editMapZoomHint.classList.add("is-visible");
        if (editMapHintTimer) clearTimeout(editMapHintTimer);
        editMapHintTimer = setTimeout(() => {
            editMapZoomHint?.classList.remove("is-visible");
        }, 1200);
    }

    function bindEditMapWheelControls() {
        if (editMapWheelListenersBound) return;
        editMapWheelListenersBound = true;

        window.addEventListener("keydown", (event) => {
            if (editMapWheelMode !== "ctrl") return;
            if (event.key === "Control" && editMapInstance) {
                editMapInstance.scrollWheelZoom.enable();
            }
        });

        window.addEventListener("keyup", (event) => {
            if (editMapWheelMode !== "ctrl") return;
            if (event.key === "Control" && editMapInstance) {
                editMapInstance.scrollWheelZoom.disable();
            }
        });

        window.addEventListener("blur", () => {
            if (editMapWheelMode !== "ctrl") return;
            if (editMapInstance) editMapInstance.scrollWheelZoom.disable();
        });
    }

    function bindInlineSelects() {
        const fields = document.querySelectorAll("#linestarEditPanel .edit-panel__select-field");
        if (!fields.length) return;

        const closeAll = () => {
            fields.forEach((field) => {
                field.classList.remove("is-open");
                const trigger = field.querySelector(".edit-panel__select-btn");
                if (trigger) trigger.setAttribute("aria-expanded", "false");
            });
        };

        fields.forEach((field) => {
            if (field.dataset.bound === "1") return;
            field.dataset.bound = "1";

            const trigger = field.querySelector(".edit-panel__select-btn");
            const options = field.querySelectorAll(".edit-panel__select-option");
            const modeInput = $("linestarEditEndGunMode");
            if (!trigger || !options.length) return;

            trigger.addEventListener("click", (event) => {
                event.stopPropagation();
                const willOpen = !field.classList.contains("is-open");
                closeAll();
                field.classList.toggle("is-open", willOpen);
                trigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
            });

            options.forEach((option) => {
                option.addEventListener("click", (event) => {
                    event.stopPropagation();
                    options.forEach((item) => item.classList.remove("is-active"));
                    option.classList.add("is-active");
                    trigger.textContent = option.textContent;
                    if (field.hasAttribute("data-endgun-select")) {
                        const sideInput = $("linestarSegmentEndGunSide");
                        if (sideInput) {
                            sideInput.value = option.dataset.value || "";
                            window.IcLineStarEdit?.drawTrackOnEditMap?.();
                            window.IcLineStarEdit?.drawEndGunOnEditMap?.();
                        }
                    } else if (modeInput) {
                        modeInput.value = option.dataset.value || "";
                        modeInput.dispatchEvent(new Event("change"));
                    }
                    field.classList.remove("is-open");
                    trigger.setAttribute("aria-expanded", "false");
                });
            });
        });

        if (!document.body.dataset.linestarSelectsBound) {
            document.body.dataset.linestarSelectsBound = "1";
            document.addEventListener("click", (event) => {
                if (event.target.closest("#linestarEditPanel .edit-panel__select-field")) return;
                document.querySelectorAll("#linestarEditPanel .edit-panel__select-field").forEach((field) => {
                    field.classList.remove("is-open");
                    const trigger = field.querySelector(".edit-panel__select-btn");
                    if (trigger) trigger.setAttribute("aria-expanded", "false");
                });
            });
        }
    }

    function bindLinestarEquipSelect(root) {
        if (!root) return;
        root.querySelectorAll(".equip-select").forEach(wrapper => {
            if (wrapper._equipBound) return;
            wrapper._equipBound = true;
            const trigger = wrapper.querySelector(".equip-select__trigger");
            const list    = wrapper.querySelector(".equip-select__list");
            const valueEl = wrapper.querySelector(".equip-select__value");
            const native  = wrapper.querySelector("select.equip-select__native");
            if (!trigger || !list) return;

            trigger.addEventListener("click", (e) => {
                e.stopPropagation();
                const isOpen = wrapper.classList.contains("is-open");
                wrapper.classList.toggle("is-open", !isOpen);
                trigger.setAttribute("aria-expanded", String(!isOpen));
            });

            list.querySelectorAll(".equip-select__option").forEach(opt => {
                opt.addEventListener("click", () => {
                    list.querySelectorAll(".equip-select__option").forEach(o => {
                        o.classList.remove("is-selected");
                        o.setAttribute("aria-selected", "false");
                    });
                    opt.classList.add("is-selected");
                    opt.setAttribute("aria-selected", "true");
                    if (valueEl) valueEl.textContent = opt.textContent.trim();
                    if (native)  native.value = opt.dataset.value || opt.textContent.trim();
                    trigger.setAttribute("aria-expanded", "false");
                    wrapper.classList.remove("is-open");
                    native?.dispatchEvent(new Event("change", { bubbles: true }));
                    // Toggle rádio/4G fields
                    if (native && native.id === "linestarEditCommType") {
                        const is4G = opt.dataset.value === "4G";
                        const radioGrid    = document.getElementById("linestarEditRadioGrid");
                        const gatewayField = document.getElementById("linestarEditGatewayField");
                        if (radioGrid)    radioGrid.style.display    = is4G ? "none" : "";
                        if (gatewayField) gatewayField.style.display = is4G ? "" : "none";
                    }
                });
            });

            document.addEventListener("click", (e) => {
                if (!wrapper.contains(e.target)) {
                    trigger.setAttribute("aria-expanded", "false");
                    wrapper.classList.remove("is-open");
                }
            });
        });
    }

    function renderLineSegmentsUI() {
        const wrap = $("linestarEditSegmentList");
        if (!wrap) return;

        wrap.innerHTML = "";

        lineSegments.forEach((segment, idx) => {
            const color = segmentPalette[idx % segmentPalette.length];
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "pivo-seg-num-btn" + (idx === activeLineSegmentIndex ? " is-active" : "");
            btn.style.cssText = `background: ${color}; --seg-color: ${color};`;
            btn.textContent = String(idx + 1);
            btn.addEventListener("click", () => {
                activeLineSegmentIndex = idx;
                showLineSegmentColors = true;
                renderLineSegmentsUI();
                populateLineSegmentForm();
                window.IcLineStarEdit?.drawTrackOnEditMap?.();
            });
            wrap.appendChild(btn);
        });

        if (lineSegments.length < 9) {
            const hasSegments = lineSegments.length > 0;
            const active = lineSegments[activeLineSegmentIndex] || lineSegments[lineSegments.length - 1] || null;
            const available = hasSegments ? Math.max(0, Number(active?.endPercent) - Number(active?.startPercent)) : 100;
            const addBtn = document.createElement("button");
            addBtn.type = "button";
            addBtn.className = "pivo-seg-add-btn";
            addBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
            addBtn.title = hasSegments ? (available <= 0.2 ? "Segmento pequeno demais para dividir." : "Dividir segmento") : "Adicionar segmento";
            addBtn.title = available <= 0.2 ? "Esse segmento está pequeno demais para dividir." : "Dividir segmento";
            addBtn.title = hasSegments ? (available <= 0.2 ? "Segmento pequeno demais para dividir." : "Dividir segmento") : "Adicionar segmento";
            addBtn.disabled = hasSegments && available <= 0.2;
            if (!addBtn.disabled) {
                addBtn.addEventListener("click", () => {
                    if (!hasSegments) {
                        lineSegments = normalizeLineSegments([createDefaultLineSegment(`seg_${Date.now()}`)]);
                        activeLineSegmentIndex = 0;
                        showLineSegmentColors = true;
                        renderLineSegmentsUI();
                        populateLineSegmentForm();
                        window.IcLineStarEdit?.drawTrackOnEditMap?.();
                        return;
                    }
                    const splitAt = roundPercent(active.startPercent + (available / 2));
                    const nextSegment = {
                        id: `seg_${Date.now()}`,
                        name: "",
                        startPercent: splitAt,
                        endPercent: active.endPercent,
                        endGunEnabled: isLineSegmentEndGunEnabled(active),
                        endGunLeftEnabled: getLineSegmentEndGunState(active, "left"),
                        endGunRightEnabled: getLineSegmentEndGunState(active, "right")
                    };
                    active.endPercent = splitAt;
                    lineSegments.splice(activeLineSegmentIndex + 1, 0, nextSegment);
                    lineSegments = normalizeLineSegments(lineSegments);
                    activeLineSegmentIndex = Math.min(activeLineSegmentIndex + 1, lineSegments.length - 1);
                    showLineSegmentColors = true;
                    renderLineSegmentsUI();
                    populateLineSegmentForm();
                    window.IcLineStarEdit?.drawTrackOnEditMap?.();
                });
            }
            wrap.appendChild(addBtn);
        }

        if (lineSegments.length > 0) {
            const delBtn = document.createElement("button");
            delBtn.type = "button";
            delBtn.className = "pivo-seg-del-btn";
            delBtn.innerHTML = '<i class="fa-regular fa-trash-can"></i>';
            const canDelete = lineSegments.length > 1;
            delBtn.title = canDelete ? "Remover segmento" : "O LineStar precisa ter pelo menos 1 segmento";
            delBtn.disabled = !canDelete;
            if (canDelete) {
                delBtn.addEventListener("click", () => {
                    lineSegments.splice(activeLineSegmentIndex, 1);
                    // Redistribute evenly
                    const n = lineSegments.length;
                    if (n > 0) {
                        const step = 100 / n;
                        lineSegments.forEach((seg, i) => {
                            seg.startPercent = parseFloat((i * step).toFixed(4));
                            seg.endPercent   = parseFloat(((i + 1) * step).toFixed(4));
                        });
                        lineSegments[n - 1].endPercent = 100;
                    }
                    lineSegments = normalizeLineSegments(lineSegments);
                    activeLineSegmentIndex = Math.max(0, Math.min(activeLineSegmentIndex - 1, lineSegments.length - 1));
                    if (!lineSegments.length) showLineSegmentColors = false;
                    renderLineSegmentsUI();
                    populateLineSegmentForm();
                    window.IcLineStarEdit?.drawTrackOnEditMap?.();
                });
            }
            wrap.appendChild(delBtn);
        }

        renderEndGunSegmentsUI();
    }

    function syncIntegratedEndGunUI() {
        renderEndGunSegmentsUI();
    }

    function toggleLineSegmentEndGun(index, side) {
        const segment = lineSegments[index];
        if (!segment) return;
        setLineSegmentEndGunState(segment, side, !getLineSegmentEndGunState(segment, side));
        lineSegments = normalizeLineSegments(lineSegments);
        renderIntegratedEndGunSegmentUI();
        window.IcLineStarEdit?.drawTrackOnEditMap?.();
        window.IcLineStarEdit?.drawEndGunOnEditMap?.();
    }

    function renderIntegratedEndGunSegmentUI() {
        const list = $("linestarSegmentEndGunList");
        const panel = $("linestarSegmentEndGunSegments");
        if (!list) return;

        const showPanel = isIntegratedEndGunEnabled();
        if (panel) panel.hidden = !showPanel;

        list.innerHTML = "";
        if (!showPanel) return;

        if (!lineSegments.length) {
            const empty = document.createElement("span");
            empty.className = "linestar-endgun-panel__hint";
            empty.textContent = "Sem segmentos definidos, o canhão vale para a pista inteira. Crie segmentos para desligar trechos específicos.";
            list.appendChild(empty);
            return;
        }

        getVisibleIntegratedEndGunSides().forEach((side) => {
            const sideLabel = side === "left" ? "Lado Esquerdo" : "Lado Direito";
            const sideWrap = document.createElement("section");
            sideWrap.className = "linestar-endgun-panel__side";

            const header = document.createElement("div");
            header.className = "linestar-endgun-panel__side-header";

            const title = document.createElement("div");
            title.className = "linestar-endgun-panel__side-title";
            title.textContent = sideLabel;
            header.appendChild(title);
            sideWrap.appendChild(header);

            const sideList = document.createElement("div");
            sideList.className = "linestar-endgun-panel__side-list";

            lineSegments.forEach((segment, idx) => {
                const isEnabled = getLineSegmentEndGunState(segment, side);
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = `pivo-seg-num-btn linestar-endgun-panel__segment-btn${isEnabled ? "" : " is-off"}`;
                btn.textContent = String(idx + 1);
                btn.title = `${sideLabel} - segmento ${idx + 1}: ${segment.startPercent}% a ${segment.endPercent}%`;
                btn.setAttribute("aria-pressed", isEnabled ? "true" : "false");
                btn.addEventListener("click", () => toggleLineSegmentEndGun(idx, side));
                sideList.appendChild(btn);
            });

            sideWrap.appendChild(sideList);
            list.appendChild(sideWrap);
        });
    }

    function syncIntegratedEndGunSideUI(side) {
        const normalizedSide = side === "left" || side === "both" ? side : "right";
        const sideInput = $("linestarSegmentEndGunSide");
        const field = $("linestarEndGunSideField");
        const trigger = $("linestarEndGunSideBtn");
        if (sideInput) sideInput.value = normalizedSide;
        if (!field) return;

        field.querySelectorAll(".edit-panel__select-option").forEach((option) => {
            const isActive = option.dataset.value === normalizedSide;
            option.classList.toggle("is-active", isActive);
            if (isActive && trigger) trigger.textContent = option.textContent;
        });

        renderEndGunSegmentsUI();
    }

    function removeLineStarDisabledField() {
        const disabledInput = $("linestarEditDisabled");
        const disabledWrap = disabledInput?.closest("div");
        if (disabledWrap) disabledWrap.remove();
    }

    function bindLinestarEditPowerUnit() {
        // Unidade de potência é sempre kW; nada a alternar aqui.
    }

    function populateLineSegmentForm() {
        const segment = lineSegments[activeLineSegmentIndex];
        const nameInput = $("linestarEditSegName");
        const startInput = $("linestarEditSegStartPct");
        const endInput = $("linestarEditSegEndPct");
        const endGunGroup = $("linestarEditSegEndGunGroup");
        const endGunState = $("linestarEditSegEndGunState");

        if (!nameInput || !startInput || !endInput) return;
        if (!segment) {
            nameInput.value = "";
            startInput.value = "";
            endInput.value = "";
            startInput.disabled = true;
            endInput.disabled = true;
            startInput.classList.add("is-disabled");
            endInput.classList.add("is-disabled");
            startInput.style.cssText = "background: #f8fafc; color: #94a3b8; cursor: not-allowed; pointer-events: none;";
            endInput.style.cssText = "background: #f8fafc; color: #94a3b8; cursor: not-allowed; pointer-events: none;";
            if (endGunState) endGunState.value = "off";
            if (endGunGroup) {
                endGunGroup.querySelectorAll(".pivo-preset-btn").forEach(b => b.classList.toggle("is-active", b.dataset.value === "off"));
            }
            return;
        }

        nameInput.value = segment.name || "";
        startInput.value = segment.startPercent;
        endInput.value = segment.endPercent;
        
        const currentSide = segment.endGunSide || "off";
        if (endGunState) endGunState.value = currentSide;
        if (endGunGroup) {
            endGunGroup.querySelectorAll(".pivo-preset-btn").forEach(b => b.classList.toggle("is-active", b.dataset.value === currentSide));
        }

        const isFirst = activeLineSegmentIndex === 0;
        const isLast = activeLineSegmentIndex === lineSegments.length - 1;

        startInput.disabled = isFirst;
        startInput.classList.toggle("is-disabled", isFirst);
        startInput.style.cssText = isFirst ? "background: #f8fafc; color: #94a3b8; cursor: not-allowed; pointer-events: none;" : "";

        endInput.disabled = isLast;
        endInput.classList.toggle("is-disabled", isLast);
        endInput.style.cssText = isLast ? "background: #f8fafc; color: #94a3b8; cursor: not-allowed; pointer-events: none;" : "";
    }

    function bindLineSegmentInputs() {
        const nameInput = $("linestarEditSegName");
        const startInput = $("linestarEditSegStartPct");
        const endInput = $("linestarEditSegEndPct");

        const applyLineSegmentBoundary = (kind, rawValue, { syncForm = false } = {}) => {
            if (!lineSegments[activeLineSegmentIndex]) return false;

            const parsedValue = parsePercentDraft(rawValue);
            if (parsedValue === null) return false;

            if (kind === "start") {
                if (activeLineSegmentIndex <= 0) return false;
                const prev = lineSegments[activeLineSegmentIndex - 1];
                const current = lineSegments[activeLineSegmentIndex];
                const minValue = (prev?.startPercent ?? 0) + 0.1;
                const maxValue = (current?.endPercent ?? 100) - 0.1;
                const nextStart = roundPercent(Math.max(minValue, Math.min(maxValue, parsedValue)));
                prev.endPercent = nextStart;
                current.startPercent = nextStart;
            } else {
                if (activeLineSegmentIndex >= lineSegments.length - 1) return false;
                const current = lineSegments[activeLineSegmentIndex];
                const next = lineSegments[activeLineSegmentIndex + 1];
                const minValue = (current?.startPercent ?? 0) + 0.1;
                const maxValue = (next?.endPercent ?? 100) - 0.1;
                const nextEnd = roundPercent(Math.max(minValue, Math.min(maxValue, parsedValue)));
                current.endPercent = nextEnd;
                next.startPercent = nextEnd;
            }

            lineSegments = normalizeLineSegments(lineSegments);
            if (syncForm) populateLineSegmentForm();
            renderLineSegmentsUI();
            window.IcLineStarEdit?.drawTrackOnEditMap?.();
            return true;
        };

        if (nameInput) {
            nameInput.addEventListener("input", (event) => {
                if (!lineSegments[activeLineSegmentIndex]) return;
                lineSegments[activeLineSegmentIndex].name = event.target.value;
            });
        }

        if (startInput) {
            startInput.addEventListener("input", (event) => {
                const draftValue = sanitizePercentDraftInput(event.target);
                applyLineSegmentBoundary("start", draftValue);
            });
            startInput.addEventListener("blur", (event) => {
                const draftValue = sanitizePercentDraftInput(event.target);
                if (!applyLineSegmentBoundary("start", draftValue, { syncForm: true })) {
                    populateLineSegmentForm();
                }
            });
        }

        if (endInput) {
            endInput.addEventListener("input", (event) => {
                const draftValue = sanitizePercentDraftInput(event.target);
                applyLineSegmentBoundary("end", draftValue);
            });
            endInput.addEventListener("blur", (event) => {
                const draftValue = sanitizePercentDraftInput(event.target);
                if (!applyLineSegmentBoundary("end", draftValue, { syncForm: true })) {
                    populateLineSegmentForm();
                }
            });
        }

        const endGunGroup = $("linestarEditSegEndGunGroup");
        const endGunState = $("linestarEditSegEndGunState");
        if (endGunGroup && endGunState) {
            endGunGroup.querySelectorAll(".pivo-preset-btn").forEach(btn => {
                btn.addEventListener("click", () => {
                    if (!lineSegments[activeLineSegmentIndex]) return;
                    endGunGroup.querySelectorAll(".pivo-preset-btn").forEach(b => b.classList.remove("is-active"));
                    btn.classList.add("is-active");
                    const val = btn.dataset.value;
                    endGunState.value = val;
                    lineSegments[activeLineSegmentIndex].endGunSide = val;
                    window.IcLineStarEdit?.drawTrackOnEditMap?.();
                });
            });
        }

        document.querySelectorAll("[data-linestar-preset]").forEach((btn) => {
            if (btn.dataset.bound === "1") return;
            btn.dataset.bound = "1";
            btn.addEventListener("click", () => {
                const total = Number(btn.dataset.linestarPreset);
                if (!Number.isFinite(total) || total < 2 || total > 9) return;
                const step = 100 / total;
                lineSegments = Array.from({ length: total }, (_, idx) => ({
                    id: `seg_${idx}`,
                    name: "",
                    startPercent: roundPercent(idx * step),
                    endPercent: idx === total - 1 ? 100 : roundPercent((idx + 1) * step),
                    endGunEnabled: true,
                    endGunLeftEnabled: true,
                    endGunRightEnabled: true
                }));
                lineSegments = normalizeLineSegments(lineSegments);
                activeLineSegmentIndex = 0;
                showLineSegmentColors = true;
                renderLineSegmentsUI();
                populateLineSegmentForm();
                window.IcLineStarEdit?.drawTrackOnEditMap?.();
            });
        });
    }

    function renderEndGunSegmentsUI() {
        const wrap = $("linestarEndGunSideCards");
        if (!wrap) return;
        wrap.innerHTML = "";

        const sideInput = $("linestarSegmentEndGunSide");
        const globalSide = (sideInput && sideInput.value) || "right";
        const sides = globalSide === "both" ? ["left", "right"] : [globalSide];

        wrap.style.cssText = `display: grid; grid-template-columns: ${sides.length > 1 ? "1fr 1fr" : "1fr"}; gap: 16px; margin-top: 16px;`;

        sides.forEach((side) => {
            const segments = side === "left" ? endGunSegmentsLeft : endGunSegments;
            const activeIdx = side === "left" ? activeEndGunSegmentIndexLeft : activeEndGunSegmentIndex;

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

            segments.forEach((seg, idx) => {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "pivo-seg-num-btn" + (idx === activeIdx && activeEndGunSide === side ? " is-active" : "");
                btn.style.cssText = `background: ${endGunSegmentColor}; --seg-color: ${endGunSegmentColor};`;
                btn.textContent = String(idx + 1);
                btn.addEventListener("click", () => {
                    activeEndGunSide = side;
                    if (side === "left") activeEndGunSegmentIndexLeft = idx;
                    else activeEndGunSegmentIndex = idx;
                    renderEndGunSegmentsUI();
                    populateEndGunSegmentForm();
                    window.IcLineStarEdit?.drawEndGunOnEditMap?.();
                });
                list.appendChild(btn);
            });

            if (segments.length < 6) {
                const addBtn = document.createElement("button");
                addBtn.type = "button";
                addBtn.className = "pivo-seg-add-btn";
                addBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
                addBtn.title = "Adicionar trecho";
                addBtn.addEventListener("click", () => {
                    activeEndGunSide = side;
                    const newCount = segments.length + 1;
                    const step = 100 / newCount;
                    const newSegments = Array.from({ length: newCount }, (_, i) => ({
                        id: i < segments.length ? segments[i].id : `eg_${side}_${Date.now()}_${i}`,
                        startPercent: roundPercent(i * step),
                        endPercent: i === newCount - 1 ? 100 : roundPercent((i + 1) * step)
                    }));
                    if (side === "left") {
                        endGunSegmentsLeft = normalizeEndGunSegments(newSegments);
                        activeEndGunSegmentIndexLeft = endGunSegmentsLeft.length - 1;
                    } else {
                        endGunSegments = normalizeEndGunSegments(newSegments);
                        activeEndGunSegmentIndex = endGunSegments.length - 1;
                    }
                    renderEndGunSegmentsUI();
                    populateEndGunSegmentForm();
                    window.IcLineStarEdit?.drawEndGunOnEditMap?.();
                });
                list.appendChild(addBtn);
            }

            if (segments.length > 0) {
                const delBtn = document.createElement("button");
                delBtn.type = "button";
                delBtn.className = "pivo-seg-del-btn";
                delBtn.title = "Remover trecho";
                delBtn.innerHTML = '<i class="fa-regular fa-trash-can"></i>';
                delBtn.addEventListener("click", () => {
                    activeEndGunSide = side;
                    if (side === "left") {
                        endGunSegmentsLeft.splice(activeEndGunSegmentIndexLeft, 1);
                        activeEndGunSegmentIndexLeft = Math.max(0, Math.min(activeEndGunSegmentIndexLeft, endGunSegmentsLeft.length - 1));
                    } else {
                        endGunSegments.splice(activeEndGunSegmentIndex, 1);
                        activeEndGunSegmentIndex = Math.max(0, Math.min(activeEndGunSegmentIndex, endGunSegments.length - 1));
                    }
                    renderEndGunSegmentsUI();
                    populateEndGunSegmentForm();
                    window.IcLineStarEdit?.drawEndGunOnEditMap?.();
                });
                list.appendChild(delBtn);
            }

            card.appendChild(list);
            wrap.appendChild(card);
        });
    }

    function populateEndGunSegmentForm(skipFocused) {
        const startInput = $("linestarEditEndGunStartPct");
        const endInput = $("linestarEditEndGunEndPct");
        if (!startInput || !endInput) return;

        const segments = activeEndGunSide === "left" ? endGunSegmentsLeft : endGunSegments;
        const activeIdx = activeEndGunSide === "left" ? activeEndGunSegmentIndexLeft : activeEndGunSegmentIndex;
        const segment = segments[activeIdx];
        const track = getCurrentTrackForEdit();
        const totalMeters = getTrackLengthMeters(track);
        if (!segment || !(totalMeters > 0)) {
            startInput.value = "";
            endInput.value = "";
            startInput.disabled = true;
            endInput.disabled = true;
            startInput.classList.add("is-disabled");
            endInput.classList.add("is-disabled");
            startInput.style.cssText = "background: #f8fafc; color: #94a3b8; cursor: not-allowed; pointer-events: none;";
            endInput.style.cssText = "background: #f8fafc; color: #94a3b8; cursor: not-allowed; pointer-events: none;";
            return;
        }

        startInput.disabled = false;
        endInput.disabled = false;
        startInput.classList.remove("is-disabled");
        endInput.classList.remove("is-disabled");
        startInput.style.cssText = "";
        endInput.style.cssText = "";
        startInput.max = String(roundMeters(totalMeters));
        endInput.max = String(roundMeters(totalMeters));
        const focused = document.activeElement;
        if (!skipFocused || focused !== startInput) {
            startInput.value = String(percentToTrackMeters(track, segment.startPercent));
        }
        if (!skipFocused || focused !== endInput) {
            endInput.value = String(percentToTrackMeters(track, segment.endPercent));
        }
    }

    function bindEndGunSegmentInputs() {
        const modeInput = $("linestarEditEndGunMode");
        const startInput = $("linestarEditEndGunStartPct");
        const endInput = $("linestarEditEndGunEndPct");

        if (modeInput) {
            modeInput.addEventListener("change", () => {
                const section = $("linestarEditEndGunAutoSection");
                const isAuto = modeInput.value === "auto";
                if (section) section.style.display = isAuto ? "block" : "none";
                if (isAuto) {
                    ensureDefaultEndGunSegment();
                    renderEndGunSegmentsUI();
                    populateEndGunSegmentForm();
                    const endGunSection = $("linestarEditEndGun");
                    if (endGunSection?.classList.contains("is-active")) {
                        setTimeout(() => window.IcLineStarEdit?.initEndGunMap?.(), 100);
                    }
                } else {
                    cleanupEndGunMap();
                }
            });
        }

        if (startInput) {
            const handleStartInput = (event) => {
                const track = getCurrentTrackForEdit();
                if (!(getTrackLengthMeters(track) > 0)) return;
                const nextPercent = metersToTrackPercent(track, event.target.value);
                const idx = activeEndGunSide === "left" ? activeEndGunSegmentIndexLeft : activeEndGunSegmentIndex;
                updateEndGunSegmentBoundary(idx, "start", nextPercent);
            };
            startInput.addEventListener("input", handleStartInput);
            startInput.addEventListener("change", handleStartInput);
        }

        if (endInput) {
            const handleEndInput = (event) => {
                const track = getCurrentTrackForEdit();
                if (!(getTrackLengthMeters(track) > 0)) return;
                const nextPercent = metersToTrackPercent(track, event.target.value);
                const idx = activeEndGunSide === "left" ? activeEndGunSegmentIndexLeft : activeEndGunSegmentIndex;
                updateEndGunSegmentBoundary(idx, "end", nextPercent);
            };
            endInput.addEventListener("input", handleEndInput);
            endInput.addEventListener("change", handleEndInput);
        }
    }

    function syncEndGunModeUI(mode) {
        const normalizedMode = mode === "auto" || mode === "off" ? mode : "on";
        const modeInput = $("linestarEditEndGunMode");
        const field = document.querySelector('#linestarEditPanel [data-edit-select="endgun-mode"]')?.closest(".edit-panel__select-field");
        if (modeInput) modeInput.value = normalizedMode;
        if (field) {
            const trigger = field.querySelector(".edit-panel__select-btn");
            const options = field.querySelectorAll(".edit-panel__select-option");
            options.forEach((option) => {
                option.classList.toggle("is-active", option.dataset.value === normalizedMode);
                if (option.dataset.value === normalizedMode && trigger) {
                    trigger.textContent = option.textContent;
                }
            });
        }
        modeInput?.dispatchEvent(new Event("change"));
    }

    function redrawEndGunPolygonsOnly(track) {
        if (!endGunMapInstance || !endGunTrackLayer || !track || !(track.width > 0)) return;

        const visual = getLineStarVisuals(getCurrentEditEquipment() || {});
        const ptA = track.ptA;
        const ptB = track.ptB;
        const width = track.width;
        const toLatLng = (point) => [point.lat, point.lng];
        const isFinished = visual.statusKey === "irrigacao_finalizada";

        // Remove apenas polígonos/polylines — preserva os marcadores arrastáveis
        const toRemove = [];
        endGunTrackLayer.eachLayer((layer) => { if (!(layer instanceof L.Marker)) toRemove.push(layer); });
        toRemove.forEach((layer) => endGunTrackLayer.removeLayer(layer));

        const aEdges = getTrackEdgesAt(track, ptA);
        const bEdges = getTrackEdgesAt(track, ptB);
        const aLeft = aEdges.left;
        const aRight = aEdges.right;
        const bLeft = bEdges.left;
        const bRight = bEdges.right;

        L.polygon([aLeft, bLeft, bRight, aRight].map(toLatLng), {
            color: isFinished ? (visual.progressFill || visual.stroke) : visual.outline,
            weight: isFinished ? 6.2 : 2.5, opacity: isFinished ? 0.96 : 0.85, fillOpacity: 0, interactive: false
        }).addTo(endGunTrackLayer);

        L.polygon([aLeft, bLeft, bRight, aRight].map(toLatLng), {
            color: isFinished ? (visual.progressFill || visual.stroke) : visual.stroke,
            weight: isFinished ? 6.4 : 2, opacity: isFinished ? 0.9 : 0.75,
            fillColor: visual.fill, fillOpacity: Math.max(0.32, visual.fillOpacity * 0.62), interactive: false
        }).addTo(endGunTrackLayer);

        const bandOpts = { color: "#1d4ed8", weight: 2, dashArray: "10 5", opacity: 0.9, fillColor: "#bfdbfe", fillOpacity: 0.35, interactive: false };
        [["left", endGunSegmentsLeft], ["right", endGunSegments]].forEach(([side, segs]) => {
            normalizeEndGunSegments(segs).forEach((seg) => {
                const bands = buildLineOuterBandPolygons(track, seg.startPercent, seg.endPercent, 400);
                const pts = side === "left" ? bands.left : bands.right;
                if (pts.length) L.polygon(pts, bandOpts).addTo(endGunTrackLayer);
            });
        });

        drawLineStarZeroAngleMarkers(endGunTrackLayer, track, { color: "#ffffff", opacity: 0.96, hoseSide: getActiveHoseSide() });
    }

    function syncEndGunBoundaryMarkers(track) {
        endGunBoundaryMarkers.forEach((marker) => marker.remove());
        endGunBoundaryMarkers = [];

        if (!endGunMapInstance || !endGunHandleIcon || !track || !(track.width > 0)) return;

        [["left", endGunSegmentsLeft], ["right", endGunSegments]].forEach(([side, segs]) => {
            normalizeEndGunSegments(segs).forEach((segment, idx) => {
                ["start", "end"].forEach((boundaryType) => {
                    const boundaryPercent = boundaryType === "start" ? segment.startPercent : segment.endPercent;
                    const pts = getEndGunBoundaryPoints(track, boundaryPercent);
                    if (!pts) return;

                    const pos = side === "left" ? pts.left : pts.right;
                    const marker = L.marker([pos.lat, pos.lng], {
                        icon: endGunHandleIcon,
                        draggable: true
                    }).addTo(endGunMapInstance);

                    marker.on("dragstart", () => endGunMapInstance?.dragging?.disable());

                    marker.on("drag", (event) => {
                        const currentSegs = side === "left" ? endGunSegmentsLeft : endGunSegments;
                        const nextPercent = projectPointToTrackPercent(track, event.latlng);
                        const clamped = boundaryType === "start"
                            ? clampEndGunStartPercent(idx, nextPercent, currentSegs)
                            : clampEndGunEndPercent(idx, nextPercent, currentSegs);

                        const seg = currentSegs[idx];
                        if (!seg) return;
                        if (boundaryType === "start") seg.startPercent = clamped;
                        else seg.endPercent = clamped;

                        const snapped = getEndGunBoundaryPoints(track, clamped);
                        if (snapped) {
                            const snappedPos = side === "left" ? snapped.left : snapped.right;
                            marker.setLatLng([snappedPos.lat, snappedPos.lng]);
                        }

                        redrawEndGunPolygonsOnly(track);
                        populateEndGunSegmentForm();
                    });

                    marker.on("dragend", () => {
                        endGunMapInstance?.dragging?.enable();
                        activeEndGunSide = side;
                        if (side === "left") {
                            endGunSegmentsLeft = normalizeEndGunSegments(endGunSegmentsLeft);
                            activeEndGunSegmentIndexLeft = resolveEndGunSegmentIndex(idx, endGunSegmentsLeft[idx]?.id, endGunSegmentsLeft);
                        } else {
                            endGunSegments = normalizeEndGunSegments(endGunSegments);
                            activeEndGunSegmentIndex = resolveEndGunSegmentIndex(idx, endGunSegments[idx]?.id, endGunSegments);
                        }
                        renderEndGunSegmentsUI();
                        populateEndGunSegmentForm();
                        window.IcLineStarEdit?.drawEndGunOnEditMap?.();
                    });

                    endGunBoundaryMarkers.push(marker);
                });
            });
        });
    }

    // positionLineStarOverlay compartilhado — ver assets/js/core/overlay-utils.js
    const positionLineStarOverlay = window.IcOverlay.positionOverlay;

    function closeLineStarEditOverlay() {
        window.IcLineStarEdit._resizeObserver?.disconnect();
        window.IcLineStarEdit._resizeObserver = null;
        const overlay = $("linestarEditOverlay");
        if (overlay) {
            overlay.classList.remove("is-open");
            setTimeout(() => overlay.remove(), 320);
        }
    }

    window.IcLineStarEdit = {
        async open(options = {}) {
            cleanupEditMap();
            cleanupEndGunMap();
            cleanupIntermediateMap();
            selectedId = options.linestarId;

            let overlay = $("linestarEditOverlay");
            if (!overlay) {
                overlay = document.createElement("div");
                overlay.id = "linestarEditOverlay";
                overlay.className = "config-overlay";
                overlay.style.zIndex = 1200 + document.querySelectorAll(".config-overlay").length;
                document.body.appendChild(overlay);
            }
            positionLineStarOverlay(overlay);
            this._resizeObserver?.disconnect();
            const mainEl = document.querySelector(".main");
            if (mainEl && typeof ResizeObserver === "function") {
                this._resizeObserver = new ResizeObserver(() => positionLineStarOverlay(overlay));
                this._resizeObserver.observe(mainEl);
            }

            try {
                const html = await fetch("./pages/linestar-edit.html").then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); });
                overlay.innerHTML = html;
                removeLineStarDisabledField();
                this.bindEvents();
                this.renderData();
                requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add("is-open")));
            } catch (err) {
                this._resizeObserver?.disconnect();
                overlay.remove();
                console.error("Failed to load linestar-edit.html", err);
            }
        },

        close() { closeLineStarEditOverlay(); },

        bindEvents() {
            const backBtn = $("linestarEditBack");
            if (backBtn) {
                backBtn.addEventListener("click", () => {
                    cleanupEditMap();
                    cleanupEndGunMap();
                    cleanupIntermediateMap();
                    closeLineStarEditOverlay();
                    window.IcLineStar.open({ linestarId: selectedId });
                });
            }

            const saveBtn = $("linestarEditSaveBtn");
            if (saveBtn) {
                saveBtn.addEventListener("click", () => this.handleSave());
            }

            const endGunSide = $("linestarSegmentEndGunSide");

            if (endGunSide) {
                endGunSide.addEventListener("change", () => {
                    window.IcLineStarEdit?.drawTrackOnEditMap?.();
                    window.IcLineStarEdit?.drawEndGunOnEditMap?.();
                });
            }

            bindInlineSelects();
            bindLinestarEquipSelect($("linestarEditPanel"));
            bindLinestarEditPowerUnit();

            const rerenderTrack = () => {
                this.drawTrackOnEditMap();
                this.drawEndGunOnEditMap();
                populateEndGunSegmentForm();
            };
            const widthInputA = $("linestarEditWidthA");
            const widthInputB = $("linestarEditWidthB");
            const widthMirror = $("linestarEditArmWidth");
            const syncTotalWidth = () => {
                if (widthMirror) {
                    widthMirror.value = (parseNonNegativeWidth(widthInputA?.value) + parseNonNegativeWidth(widthInputB?.value)).toFixed(2);
                }
                if (widthPickLiveUpdate) {
                    this.drawTrackOnEditMap({ fitBounds: false });
                } else {
                    rerenderTrack();
                }
            };

            document.querySelectorAll("#linestarEditPanel .js-linestar-hose-side").forEach(btn => {
                btn.addEventListener("click", () => {
                    document.querySelectorAll("#linestarEditPanel .js-linestar-hose-side").forEach(b => b.classList.remove("is-active"));
                    btn.classList.add("is-active");
                    document.querySelectorAll("#linestarEditPanel .js-linestar-hose-side").forEach(b => {
                        b.setAttribute("aria-pressed", String(b === btn));
                    });
                    rerenderTrack();
                });
            });

            ["linestarEditLocA", "linestarEditLocB", "linestarEditOffset", "linestarEditZeroAngle"].forEach((id) => {
                const field = $(id);
                if (!field) return;
                field.addEventListener("input", rerenderTrack);
                field.addEventListener("change", rerenderTrack);
            });

            [widthInputA, widthInputB].forEach((field) => {
                if (!field) return;
                field.addEventListener("input", syncTotalWidth);
                field.addEventListener("change", syncTotalWidth);
                field.addEventListener("blur", () => {
                    const width = parseNonNegativeWidth(field.value);
                    field.value = width > 0 ? width.toFixed(2) : "";
                    syncTotalWidth();
                });
            });

            const setupPickMarker = (inputId, btnId, color) => {
                const btn = $(btnId);
                if (!btn) return;
                btn.addEventListener("click", () => {
                    // Navigate to location section first if not there
                    const locSection = document.querySelector("#linestarEditPanel .edit-panel__nav-item[data-target='#linestarEditLocation']");
                    if (locSection && !document.querySelector("#linestarEditLocation.is-active")) {
                        locSection.click();
                        setTimeout(() => btn.click(), 250);
                        return;
                    }
                    if (!editMapInstance) return;

                    const inputEl = $(inputId);
                    const existingVal = parseLatLngText(inputEl?.value);
                    const mapCenter = editMapInstance.getCenter();
                    const startLatLng = existingVal
                        ? L.latLng(existingVal.lat, existingVal.lng)
                        : L.latLng(mapCenter.lat + (color === "#16a34a" ? 0 : -0.001), mapCenter.lng);

                    // Remove existing marker for this point
                    const isA = (btnId === "linestarPickA");
                    if (isA && pickMarkerA) { pickMarkerA.remove(); pickMarkerA = null; }
                    if (!isA && pickMarkerB) { pickMarkerB.remove(); pickMarkerB = null; }

                    const markerSide = color === "#16a34a" ? "A" : "B";
                    const marker = L.marker(startLatLng, { icon: createLineStarPinIcon(markerSide), draggable: true, zIndexOffset: 1000 })
                        .addTo(editMapInstance);

                    const updateInput = (latlng) => {
                        if (inputEl) {
                            inputEl.value = `${latlng.lat.toFixed(7)}, ${latlng.lng.toFixed(7)}`;
                            inputEl.dispatchEvent(new Event("input"));
                        }
                    };

                    marker.on("drag", (e) => updateInput(e.latlng));
                    marker.on("dragend", (e) => updateInput(e.target.getLatLng()));

                    if (isA) pickMarkerA = marker; else pickMarkerB = marker;
                    updateInput(startLatLng);

                    // Só pana o mapa se não havia coordenada salva ainda
                    if (!existingVal) editMapInstance.panTo(startLatLng);
                });
            };

            setupPickMarker("linestarEditLocA", "linestarPickA", "#16a34a");
            setupPickMarker("linestarEditLocB", "linestarPickB", "#dc2626");

            document.querySelectorAll("#linestarEditPanel [data-linestar-width-side]").forEach((widthPickBtn) => {
                widthPickBtn.addEventListener("click", () => {
                    const locSection = document.querySelector("#linestarEditPanel .edit-panel__nav-item[data-target='#linestarEditLocation']");
                    if (locSection && !document.querySelector("#linestarEditLocation.is-active")) {
                        locSection.click();
                        setTimeout(() => widthPickBtn.click(), 250);
                        return;
                    }
                    if (!editMapInstance) return;
                    widthPickActive = widthPickBtn.getAttribute("data-linestar-width-side");
                    widthMeasureSide = widthPickActive;
                    widthMeasurePoint = null;
                    document.querySelectorAll("#linestarEditPanel [data-linestar-width-side]").forEach((button) => {
                        button.classList.toggle("is-active", button === widthPickBtn);
                    });
                    this.drawTrackOnEditMap({ fitBounds: false });
                });
            });

            bindLineSegmentInputs();
            bindEndGunSegmentInputs();
            bindIntermediateInputs();

            // Tabs
            const tabs = document.querySelectorAll("#linestarEditPanel .edit-panel__tab");
            tabs.forEach(tab => {
                tab.addEventListener("click", () => {
                    tabs.forEach(t => t.classList.remove("is-active"));
                    tab.classList.add("is-active");
                    
                    const target = tab.dataset.tab;
                    const bodies = document.querySelectorAll("#linestarEditPanel .edit-panel__tab-body");
                    bodies.forEach(b => {
                        b.classList.toggle("is-active", b.dataset.tabBody === target);
                    });
                });
            });

            // Nav (Vertical)
            const navItems = document.querySelectorAll("#linestarEditPanel .edit-panel__nav-item");
            navItems.forEach(item => {
                item.addEventListener("click", () => {
                    const parentBody = item.closest(".edit-panel__body");
                    if (!parentBody) return;

                    // Only toggle nav items within the same tab body
                    parentBody.querySelectorAll(".edit-panel__nav-item").forEach(i => i.classList.remove("is-active"));
                    item.classList.add("is-active");
                    
                    const target = item.dataset.target;
                    const sections = parentBody.querySelectorAll(".edit-panel__section");
                    sections.forEach(s => {
                        s.classList.toggle("is-active", `#${s.id}` === target);
                    });

                    if (target === "#linestarEditLocation") {
                        setTimeout(() => this.initLocationMap(), 100);
                    } else if (target === "#linestarEditIntermediate") {
                        setTimeout(() => this.initIntermediateMap(), 100);
                    } else if (target === "#linestarEditEndGun") {
                        setTimeout(() => this.initEndGunMap(), 100);
                    }
                });
            });

            // History Row Expansion (Nexus style)
            document.querySelectorAll("#linestarEditPanel .edit-panel__history-expand-btn").forEach(btn => {
                if (btn.dataset.boundFn) return;
                btn.dataset.boundFn = "1";
                btn.addEventListener("click", () => {
                    const tr = btn.closest("tr");
                    const rowId = tr?.dataset?.rowId;
                    if (!rowId) return;
                    const detailsRow = document.getElementById(`details-${rowId}`);
                    if (!detailsRow) return;
                    const isVisible = detailsRow.style.display !== "none";
                    detailsRow.style.display = isVisible ? "none" : "table-row";
                    const icon = btn.querySelector("i");
                    if (icon) {
                        icon.className = isVisible ? "fa-solid fa-plus" : "fa-solid fa-minus";
                    }
                });
            });

            // Select trigger (Simple mock)
            const selectField = $("linestarEditSelectField");
            const selectBtn = $("linestarEditSelectBtn");
            if (selectBtn && selectField) {
                selectBtn.addEventListener("click", () => {
                    selectField.classList.toggle("is-open");
                });
            }
        },

        initLocationMap() {
            const mapEl = $("linestarEditLocMap");
            if (!mapEl) return;

            if (editMapInstance) {
                const currentContainer = typeof editMapInstance.getContainer === "function"
                    ? editMapInstance.getContainer()
                    : editMapInstance._container;
                if (currentContainer && currentContainer !== mapEl) {
                    cleanupEditMap();
                } else {
                    editMapInstance.invalidateSize();
                    syncLocationEndpointMarkers();
                    this.drawTrackOnEditMap();
                    return;
                }
            }

            editMapInstance = L.map(mapEl, {
                zoomControl: true,
                attributionControl: false,
                scrollWheelZoom: false
            });

            editMapInstance.scrollWheelZoom.disable();
            bindEditMapWheelControls();
            ensureEditMapWheelHint(mapEl);

            L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
                maxZoom: 19
            }).addTo(editMapInstance);

            let widthPickDragging = false;
            const stopWidthPickDrag = () => {
                if (!widthPickDragging) return;
                widthPickDragging = false;
                editMapInstance?.dragging?.enable();
                window.removeEventListener("mousemove", onWidthPickMove);
                window.removeEventListener("mouseup", finishWidthPick);
                this.drawEndGunOnEditMap();
                this.drawIntermediateOnEditMap();
            };
            const updateWidthFromMapPoint = (mapPoint) => {
                if (!widthPickActive) return;
                const pointA = parseLatLngText($("linestarEditLocA")?.value);
                const pointB = parseLatLngText($("linestarEditLocB")?.value);
                if (!pointA || !pointB) return;

                const pickedSide = widthPickActive;
                const bearing = bearingRad(pointA, pointB);
                const signedWidth = signedPerpendicularDistanceMeters(pointA, mapPoint, bearing);
                const width = Math.max(0, signedWidth * (pickedSide === "A" ? -1 : 1));
                const widthInput = $(pickedSide === "A" ? "linestarEditWidthA" : "linestarEditWidthB");
                widthMeasurePoint = { lat: mapPoint.lat, lng: mapPoint.lng };

                if (widthInput) {
                    widthPickLiveUpdate = true;
                    widthInput.value = width > 0 ? width.toFixed(2) : "";
                    widthInput.dispatchEvent(new Event("input"));
                    widthPickLiveUpdate = false;
                } else {
                    this.drawTrackOnEditMap({ fitBounds: false });
                }
            };

            const onWidthPickMove = (event) => {
                if (widthPickDragging) {
                    updateWidthFromMapPoint(editMapInstance.mouseEventToLatLng(event));
                }
            };
            const finishWidthPick = (event) => {
                if (!widthPickDragging) return;
                updateWidthFromMapPoint(editMapInstance.mouseEventToLatLng(event));
                widthPickActive = null;
                document.querySelectorAll("#linestarEditPanel [data-linestar-width-side]").forEach((button) => {
                    button.classList.remove("is-active");
                });
                stopWidthPickDrag();
                this.drawTrackOnEditMap({ fitBounds: false });
            };
            const startWidthPick = (event) => {
                if (!widthPickActive || event.originalEvent?.target?.closest?.(".leaflet-marker-icon")) return;
                L.DomEvent.stopPropagation(event.originalEvent);
                L.DomEvent.preventDefault(event.originalEvent);
                widthPickDragging = true;
                editMapInstance.dragging.disable();
                window.addEventListener("mousemove", onWidthPickMove);
                window.addEventListener("mouseup", finishWidthPick);
                updateWidthFromMapPoint(event.latlng);
            };
            editMapInstance.on("mousedown", startWidthPick);
            widthPickCleanup = () => {
                stopWidthPickDrag();
                editMapInstance?.off("mousedown", startWidthPick);
            };

            mapEl.addEventListener("wheel", (event) => {
                if (editMapWheelMode === "ctrl" && !event.ctrlKey) {
                    showEditMapWheelHint();
                }
            }, { passive: true });

            this.drawTrackOnEditMap();
        },

        initIntermediateMap() {
            const mapEl = $("linestarEditIntermediateMap");
            if (!mapEl) return;

            if (intermediateMapInstance) {
                const currentContainer = typeof intermediateMapInstance.getContainer === "function"
                    ? intermediateMapInstance.getContainer()
                    : intermediateMapInstance._container;
                if (currentContainer && currentContainer !== mapEl) {
                    cleanupIntermediateMap();
                } else {
                    intermediateMapInstance.invalidateSize();
                    this.drawIntermediateOnEditMap();
                    return;
                }
            }

            intermediateMapInstance = L.map(mapEl, {
                zoomControl: true,
                attributionControl: false,
                scrollWheelZoom: false
            });

            intermediateMapInstance.scrollWheelZoom.disable();
            bindEditMapWheelControls();
            ensureEditMapWheelHint(mapEl);

            L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
                maxZoom: 19
            }).addTo(intermediateMapInstance);

            mapEl.addEventListener("wheel", (event) => {
                if (editMapWheelMode === "ctrl" && !event.ctrlKey) {
                    showEditMapWheelHint();
                }
            }, { passive: true });

            this.drawIntermediateOnEditMap();
        },

        initEndGunMap() {
            const mapEl = $("linestarEditEndGunMap");
            if (!mapEl) return;

            if (endGunMapInstance) {
                const currentContainer = typeof endGunMapInstance.getContainer === "function"
                    ? endGunMapInstance.getContainer()
                    : endGunMapInstance._container;
                if (currentContainer && currentContainer !== mapEl) {
                    cleanupEndGunMap();
                } else {
                    endGunMapInstance.invalidateSize();
                    this.drawEndGunOnEditMap();
                    return;
                }
            }

            endGunMapInstance = L.map(mapEl, {
                zoomControl: false,
                attributionControl: false,
                scrollWheelZoom: false
            });

            mapEl.addEventListener("wheel", (e) => {
                if (e.ctrlKey) {
                    endGunMapInstance.scrollWheelZoom.enable();
                } else {
                    endGunMapInstance.scrollWheelZoom.disable();
                }
            });

            L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
                maxZoom: 19
            }).addTo(endGunMapInstance);

            ensureDefaultEndGunSegment();
            renderEndGunSegmentsUI();
            populateEndGunSegmentForm();
            this.drawEndGunOnEditMap();
        },

        drawTrackOnEditMap(options = {}) {
            if (!editMapInstance) return;

            const farm = window.IcFarmGetActive?.() || window.IcFarmActive;
            const equip = farm?.equipments?.find(e => e.id === selectedId);
            if (!equip || !equip.data) return;

            if (!editTrackLayer) {
                editTrackLayer = L.featureGroup().addTo(editMapInstance);
            }
            editTrackLayer.clearLayers();
            syncLocationEndpointMarkers();

            const track = getTrackPreviewData(equip);
            if (!track) return;

            const visual = getLineStarVisuals(equip);
            const ptA = track.ptA;
            const ptB = track.ptB;
            const width = track.width;
            const midPoint = interpolatePoint(ptA, ptB, 0.5);
            const progressRatio = clampPercent(visual.lineProgress) / 100;
            const progressPoint = progressRatio > 0 ? interpolatePoint(ptA, ptB, progressRatio) : null;
            const isFinished = visual.statusKey === "irrigacao_finalizada";
            const outerStrokeColor = isFinished ? (visual.progressFill || visual.stroke) : "#ffffff";
            const outerStrokeWeight = isFinished ? 6.2 : 2.5;
            const innerStrokeWeight = isFinished ? 6.4 : 2;
            const outerStrokeOpacity = isFinished ? 0.96 : 0.85;
            const toLatLng = (point) => [point.lat, point.lng];

            if (width > 0) {
                const aEdges = getTrackEdgesAt(track, ptA);
                const bEdges = getTrackEdgesAt(track, ptB);
                const aLeft = aEdges.left;
                const aRight = aEdges.right;
                const bLeft = bEdges.left;
                const bRight = bEdges.right;

                L.polygon(
                    [aLeft, bLeft, bRight, aRight].map(toLatLng),
                    {
                        color: outerStrokeColor,
                        weight: outerStrokeWeight,
                        opacity: outerStrokeOpacity,
                        fillOpacity: 0,
                        interactive: false
                    }
                ).addTo(editTrackLayer);

                L.polygon(
                    [aLeft, bLeft, bRight, aRight].map(toLatLng),
                    {
                        color: isFinished ? outerStrokeColor : "#ffffff",
                        weight: innerStrokeWeight,
                        opacity: isFinished ? 0.9 : 0.75,
                        fillColor: visual.fill,
                        fillOpacity: isFinished ? visual.fillOpacity : 0,
                        interactive: false
                    }
                ).addTo(editTrackLayer);

                if (progressPoint) {
                    const progressEdges = getTrackEdgesAt(track, progressPoint);
                    L.polygon(
                        [aLeft, progressEdges.left, progressEdges.right, aRight].map(toLatLng),
                        {
                            color: visual.stroke,
                            weight: 0,
                            fillColor: visual.progressFill,
                            fillOpacity: Math.min(0.5, visual.fillOpacity + 0.14),
                            interactive: false
                        }
                    ).addTo(editTrackLayer);
                }

                const normalizedSegments = normalizeLineSegments(lineSegments);
                const endGunSideInput = $("linestarSegmentEndGunSide");
                const showEndGunBand = false;
                const bandWidthMeters = 400;
                const globalEndGunSide = (endGunSideInput && endGunSideInput.value) || "right";

                normalizedSegments.forEach((segment, idx) => {
                    if (showLineSegmentColors) {
                        const polygonPoints = buildLineSegmentPolygon(track, segment.startPercent, segment.endPercent);
                        if (polygonPoints.length) {
                            const color = segmentPalette[idx % segmentPalette.length];
                            const isActive = idx === activeLineSegmentIndex;
                            L.polygon(polygonPoints, {
                                color: "#ffffff",
                                weight: isActive ? 2 : 1,
                                opacity: isActive ? 0.95 : 0.78,
                                fillColor: color,
                                fillOpacity: isActive ? 0.72 : 0.56,
                                interactive: false
                            }).addTo(editTrackLayer);
                        }
                    }
                });

                if (showEndGunBand) {
                    const bandOpts = {
                        color: "#1d4ed8",
                        weight: 2,
                        dashArray: "10 5",
                        opacity: 0.9,
                        fillColor: "#bfdbfe",
                        fillOpacity: 0.35,
                        interactive: false
                    };

                    const visibleSides = globalEndGunSide === "both" ? ["left", "right"] : [globalEndGunSide];
                    visibleSides.forEach((side) => {
                        const sideSegments = normalizedSegments.length > 0
                            ? normalizedSegments.filter((segment) => getLineSegmentEndGunState(segment, side))
                            : [{ startPercent: 0, endPercent: 100 }];

                        sideSegments.forEach((seg) => {
                            const bands = buildLineOuterBandPolygons(track, seg.startPercent, seg.endPercent, bandWidthMeters);
                            const polygonPoints = side === "left" ? bands.left : bands.right;
                            if (polygonPoints.length) {
                                L.polygon(polygonPoints, bandOpts).addTo(editTrackLayer);
                            }
                        });
                    });
                }

                drawLineStarZeroAngleMarkers(editTrackLayer, track, {
                    color: "#ffffff",
                    opacity: 0.96,
                    hoseSide: getActiveHoseSide()
                });
            }

            const trackBearing = ((bearingRad(ptA, ptB) * 180 / Math.PI) + 360) % 360;
            const trackDistance = distanceMetersBetween(ptA, ptB);
            L.polyline([toLatLng(ptA), toLatLng(ptB)], {
                color: "#facc15",
                weight: 3,
                dashArray: "8 5",
                opacity: 0.95,
                interactive: false,
            }).addTo(editTrackLayer);
            const trackMidpoint = interpolatePoint(ptA, ptB, 0.5);
            L.marker([trackMidpoint.lat, trackMidpoint.lng], {
                icon: createLineStarTrackBadgeIcon(trackBearing, trackDistance),
                interactive: false,
                keyboard: false,
                zIndexOffset: 900,
            }).addTo(editTrackLayer);

            if (widthMeasurePoint && widthMeasureSide) {
                const measureOrigin = projectPointOntoTrack(ptA, ptB, widthMeasurePoint);
                const measureWidth = distanceMetersBetween(measureOrigin, widthMeasurePoint);
                const measureColor = widthMeasureSide === "A" ? "#16a34a" : "#dc2626";
                L.polyline([toLatLng(measureOrigin), toLatLng(widthMeasurePoint)], {
                    color: measureColor,
                    weight: 3,
                    dashArray: "6 4",
                    opacity: 0.95,
                    interactive: false,
                }).addTo(editTrackLayer);
                const measureMidpoint = interpolatePoint(measureOrigin, widthMeasurePoint, 0.5);
                const measureLabel = L.divIcon({
                    className: "",
                    html: `<span style="display:inline-block;padding:4px 8px;border:1px solid #fff;border-radius:999px;background:${measureColor};color:#fff;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.35)">${measureWidth.toFixed(1)} m</span>`,
                    iconSize: [1, 1],
                    iconAnchor: [0, 0],
                });
                L.marker([measureMidpoint.lat, measureMidpoint.lng], {
                    icon: measureLabel,
                    interactive: false,
                    keyboard: false,
                    zIndexOffset: 1100,
                }).addTo(editTrackLayer);
            }

            const axisLayer = L.polyline(
                [toLatLng(ptA), toLatLng(ptB)],
                {
                    color: "transparent",
                    weight: 18,
                    opacity: 0,
                    interactive: false
                }
            ).addTo(editTrackLayer);

            const anchorPoint = progressPoint || midPoint;
            if (width > 0 && anchorPoint) {
                const crossEdges = getTrackEdgesAt(track, anchorPoint);
                const crossLeft = crossEdges.left;
                const crossRight = crossEdges.right;

                L.polyline(
                    [toLatLng(crossLeft), toLatLng(crossRight)],
                    { color: visual.outline, weight: 5, opacity: 0.3, interactive: false }
                ).addTo(editTrackLayer);

                L.polyline(
                    [toLatLng(crossLeft), toLatLng(crossRight)],
                    { color: "#ffffff", weight: 3, opacity: 1, interactive: false }
                ).addTo(editTrackLayer);
            }

            if (progressPoint) {
                L.polyline(
                    [toLatLng(ptA), toLatLng(progressPoint)],
                    { color: visual.progressFill, weight: 3.5, opacity: 0.9, interactive: false }
                ).addTo(editTrackLayer);

                L.circleMarker(toLatLng(progressPoint), {
                    radius: 4,
                    color: "#ffffff",
                    weight: 2,
                    fillColor: visual.progressFill,
                    fillOpacity: 1,
                    interactive: false,
                }).addTo(editTrackLayer);
            }

            const boundsSource = editTrackLayer.getLayers().length ? editTrackLayer : axisLayer;
            if (options.fitBounds !== false) {
                editMapInstance.fitBounds(boundsSource.getBounds(), { padding: [36, 36] });
            }
        },

        drawEndGunOnEditMap() {
            if (!endGunMapInstance) return;

            const farm = window.IcFarmGetActive?.() || window.IcFarmActive;
            const equip = farm?.equipments?.find(e => e.id === selectedId);
            if (!equip || !equip.data) return;

            if (!endGunTrackLayer) {
                endGunTrackLayer = L.featureGroup().addTo(endGunMapInstance);
            }
            endGunTrackLayer.clearLayers();

            const track = getTrackPreviewData(equip);
            if (!track) {
                syncEndGunBoundaryMarkers(null);
                return;
            }

            const visual = getLineStarVisuals(equip);
            const ptA = track.ptA;
            const ptB = track.ptB;
            const width = track.width;
            const midPoint = interpolatePoint(ptA, ptB, 0.5);
            const progressRatio = clampPercent(visual.lineProgress) / 100;
            const progressPoint = progressRatio > 0 ? interpolatePoint(ptA, ptB, progressRatio) : null;
            const isFinished = visual.statusKey === "irrigacao_finalizada";
            const outerStrokeColor = isFinished ? (visual.progressFill || visual.stroke) : visual.outline;
            const outerStrokeWeight = isFinished ? 6.2 : 2.5;
            const innerStrokeWeight = isFinished ? 6.4 : 2;
            const outerStrokeOpacity = isFinished ? 0.96 : 0.85;
            const toLatLng = (point) => [point.lat, point.lng];

            if (width > 0) {
                const aEdges = getTrackEdgesAt(track, ptA);
                const bEdges = getTrackEdgesAt(track, ptB);
                const aLeft = aEdges.left;
                const aRight = aEdges.right;
                const bLeft = bEdges.left;
                const bRight = bEdges.right;

                L.polygon([aLeft, bLeft, bRight, aRight].map(toLatLng), {
                    color: outerStrokeColor,
                    weight: outerStrokeWeight,
                    opacity: outerStrokeOpacity,
                    fillOpacity: 0,
                    interactive: false
                }).addTo(endGunTrackLayer);

                L.polygon([aLeft, bLeft, bRight, aRight].map(toLatLng), {
                    color: isFinished ? outerStrokeColor : visual.stroke,
                    weight: innerStrokeWeight,
                    opacity: isFinished ? 0.9 : 0.75,
                    fillColor: visual.fill,
                    fillOpacity: Math.max(0.32, visual.fillOpacity * 0.62),
                    interactive: false
                }).addTo(endGunTrackLayer);

                const endGunSideInput = $("linestarSegmentEndGunSide");
                const globalEndGunSide = (endGunSideInput && endGunSideInput.value) || "right";
                const bandWidthMeters = 400;
                const bandOpts = {
                    color: "#1d4ed8",
                    weight: 2,
                    dashArray: "10 5",
                    opacity: 0.9,
                    fillColor: "#bfdbfe",
                    fillOpacity: 0.35,
                    interactive: false
                };

                const visibleSides = globalEndGunSide === "both" ? ["left", "right"] : [globalEndGunSide];
                visibleSides.forEach((side) => {
                    const sideSegs = side === "left" ? endGunSegmentsLeft : endGunSegments;
                    const normalized = normalizeEndGunSegments(sideSegs);
                    normalized.forEach((seg) => {
                        const bands = buildLineOuterBandPolygons(track, seg.startPercent, seg.endPercent, bandWidthMeters);
                        const polygonPoints = side === "left" ? bands.left : bands.right;
                        if (polygonPoints.length) {
                            L.polygon(polygonPoints, bandOpts).addTo(endGunTrackLayer);
                        }
                    });
                });

                drawLineStarZeroAngleMarkers(endGunTrackLayer, track, {
                    color: "#ffffff",
                    opacity: 0.96,
                    hoseSide: getActiveHoseSide()
                });

                syncEndGunBoundaryMarkers(track);
            }

            const axisLayer = L.polyline([toLatLng(ptA), toLatLng(ptB)], {
                color: "transparent",
                weight: 18,
                opacity: 0,
                interactive: false
            }).addTo(endGunTrackLayer);

            const anchorPoint = progressPoint || midPoint;
            if (width > 0 && anchorPoint) {
                const crossEdges = getTrackEdgesAt(track, anchorPoint);
                const crossLeft = crossEdges.left;
                const crossRight = crossEdges.right;

                L.polyline([toLatLng(crossLeft), toLatLng(crossRight)], {
                    color: visual.outline,
                    weight: 5,
                    opacity: 0.22,
                    interactive: false
                }).addTo(endGunTrackLayer);

                L.polyline([toLatLng(crossLeft), toLatLng(crossRight)], {
                    color: "#ffffff",
                    weight: 3,
                    opacity: 1,
                    interactive: false
                }).addTo(endGunTrackLayer);
            }

            const boundsSource = endGunTrackLayer.getLayers().length ? endGunTrackLayer : axisLayer;
            endGunMapInstance.fitBounds(boundsSource.getBounds(), { padding: [32, 32] });
        },

        drawIntermediateOnEditMap() {
            if (!intermediateMapInstance) return;

            const farm = window.IcFarmGetActive?.() || window.IcFarmActive;
            const equip = farm?.equipments?.find(e => e.id === selectedId);
            if (!equip || !equip.data) return;

            if (!intermediateTrackLayer) {
                intermediateTrackLayer = L.featureGroup().addTo(intermediateMapInstance);
            }
            intermediateTrackLayer.clearLayers();

            const track = getTrackPreviewData(equip);
            if (!track) return;

            const visual = getLineStarVisuals(equip);
            const ptA = track.ptA;
            const ptB = track.ptB;
            const width = track.width;
            const toLatLng = (point) => [point.lat, point.lng];
            const totalLength = getTrackLengthMeters(track);

            if (width > 0) {
                const aEdges = getTrackEdgesAt(track, ptA);
                const bEdges = getTrackEdgesAt(track, ptB);
                const aLeft = aEdges.left;
                const aRight = aEdges.right;
                const bLeft = bEdges.left;
                const bRight = bEdges.right;

                L.polygon([aLeft, bLeft, bRight, aRight].map(toLatLng), {
                    color: visual.outline, weight: 2.5, opacity: 0.85, fillOpacity: 0, interactive: false
                }).addTo(intermediateTrackLayer);

                L.polygon([aLeft, bLeft, bRight, aRight].map(toLatLng), {
                    color: visual.stroke, weight: 2, opacity: 0.75, fillColor: visual.fill, fillOpacity: visual.fillOpacity * 0.5, interactive: false
                }).addTo(intermediateTrackLayer);

                drawLineStarZeroAngleMarkers(intermediateTrackLayer, track, { color: "#ffffff", opacity: 0.96, hoseSide: getActiveHoseSide() });
            }

            intermediatePositions.forEach((pos, idx) => {
                if (!(totalLength > 0)) return;
                const ratio = Math.max(0, Math.min(1, (pos.distanceMeters || 0) / totalLength));
                const point = interpolatePoint(ptA, ptB, ratio);
                const edges = getTrackEdgesAt(track, point);
                const left = edges.left;
                const right = edges.right;
                const isActive = idx === activeIntermediateIndex;
                const color = isActive ? "#dc2626" : "#ef4444";
                const weight = isActive ? 5 : 3;
                const opacity = isActive ? 1 : 0.85;

                L.polyline([toLatLng(left), toLatLng(right)], {
                    color, weight, opacity, interactive: false
                }).addTo(intermediateTrackLayer);

                if (isActive) {
                    L.circleMarker(toLatLng(point), {
                        radius: 6,
                        color: "#ffffff",
                        weight: 2,
                        fillColor: "#dc2626",
                        fillOpacity: 1,
                        interactive: false
                    }).addTo(intermediateTrackLayer);
                }
            });

            const axisLayer = L.polyline([toLatLng(ptA), toLatLng(ptB)], {
                color: "transparent", weight: 18, opacity: 0, interactive: false
            }).addTo(intermediateTrackLayer);

            const boundsSource = intermediateTrackLayer.getLayers().length ? intermediateTrackLayer : axisLayer;
            intermediateMapInstance.fitBounds(boundsSource.getBounds(), { padding: [36, 36] });
        },

        renderData() {
            const farm = window.IcFarmGetActive?.() || window.IcFarmActive;
            const equip = farm?.equipments?.find(e => e.id === selectedId);
            
            if (equip) {
                const data = equip.data || {};
                const nameInput = $("linestarEditName");
                if (nameInput) nameInput.value = equip.name || "";
                
                const selectBtn = $("linestarEditSelectBtn");
                if (selectBtn) selectBtn.textContent = equip.name || "LineStar";

                // New fields populate
                if ($("linestarEditUid")) $("linestarEditUid").value = equip.uid || "aca7cd21-29fb-4d13-970e-753b65de5172";
                if ($("linestarEditControllerId")) $("linestarEditControllerId").value = equip.data?.controllerId || "0357299070883654";

                // Communication type (Radio / 4G)
                const commTypeVal = data.commType || "";
                if (commTypeVal) {
                    const commTypeOpt = document.querySelector(`#linestarEditCommType__list [data-value="${commTypeVal}"]`);
                    if (commTypeOpt) commTypeOpt.click();
                }
                if ($("linestarEditGateway")) $("linestarEditGateway").value = data.gateway || "";

                // Radios
                if ($("linestarEditRadioCentral")) $("linestarEditRadioCentral").value = data.radioCentral || "";
                if ($("linestarEditRadioControl")) $("linestarEditRadioControl").value = data.radioControl || "";
                if ($("linestarEditRadioGps")) $("linestarEditRadioGps").value = data.radioGps || "";
                if ($("linestarEditRadioBomba")) $("linestarEditRadioBomba").value = data.radioBomba || "";

                // Technical
                if ($("linestarEditFlow")) $("linestarEditFlow").value = data.flow || "200";
                if ($("linestarEditPressMin")) $("linestarEditPressMin").value = data.pressMin || "1.0";
                if ($("linestarEditPressMax")) $("linestarEditPressMax").value = data.pressMax || "8.0";
                if ($("linestarEditSpeedMax")) $("linestarEditSpeedMax").value = data.speedMax || "";
                const hoseSide = data.hoseSide === "B" ? "B" : "A";
                document.querySelectorAll("#linestarEditPanel .js-linestar-hose-side").forEach(b => {
                    b.classList.toggle("is-active", b.getAttribute("data-side") === hoseSide);
                    b.setAttribute("aria-pressed", String(b.getAttribute("data-side") === hoseSide));
                });

                // Pump
                // Potência sempre em kW; usa o valor já convertido quando existir
                // (registros antigos salvos em CV) e cai para "power" nos mais recentes.
                if ($("linestarEditPower")) $("linestarEditPower").value = data.powerConverted || data.power || "";

                // Location
                if ($("linestarEditLocA")) $("linestarEditLocA").value = data.latA ? `${data.latA}, ${data.lngA}` : "";
                if ($("linestarEditLocB")) $("linestarEditLocB").value = data.latB ? `${data.latB}, ${data.lngB}` : "";
                const lineWidths = getStoredLineWidths(data);
                if ($("linestarEditWidthA")) $("linestarEditWidthA").value = lineWidths.widthA > 0 ? lineWidths.widthA.toFixed(2) : "";
                if ($("linestarEditWidthB")) $("linestarEditWidthB").value = lineWidths.widthB > 0 ? lineWidths.widthB.toFixed(2) : "";
                if ($("linestarEditArmWidth")) $("linestarEditArmWidth").value = (lineWidths.widthA + lineWidths.widthB).toFixed(2);
                if ($("linestarEditOffset")) $("linestarEditOffset").value = data.visualOffset || "0";
                loadLineSegments(data.segments, data.endGunSegments);
                renderLineSegmentsUI();
                populateLineSegmentForm();
                syncIntegratedEndGunSideUI("both");
                syncIntegratedEndGunUI();
                loadEndGunSegments(data.endGunSegments);
                endGunSegmentsLeft = normalizeEndGunSegments(data.endGunSegmentsLeft || []);
                activeEndGunSegmentIndexLeft = 0;
                activeEndGunSide = "right";
                renderEndGunSegmentsUI();
                populateEndGunSegmentForm();
                syncEndGunModeUI(data.endGunMode || "on");

                // Intermediate positions
                intermediatePositions = Array.isArray(data.intermediatePositions) ? data.intermediatePositions.map((p, i) => ({
                    id: String(p?.id || `ip_${i}`),
                    distanceMeters: Number(p?.distanceMeters) || 0
                })) : [];
                activeIntermediateIndex = 0;
                renderIntermediateUI();
                populateIntermediateForm();

                // Comments and Toggles
                if ($("linestarEditComments")) $("linestarEditComments").value = equip.comments || "";
                if ($("linestarEditUseMeter")) $("linestarEditUseMeter").checked = data.useMeter !== false;
                if ($("linestarEditDisabled")) $("linestarEditDisabled").checked = equip.disabled === true;
            }
        },

        async handleSave() {
            const saveBtn = $("linestarEditSaveBtn");
            const originalHtml = saveBtn.innerHTML;

            const farm = window.IcFarmGetActive?.() || window.IcFarmActive;
            const equip = farm?.equipments?.find(e => e.id === selectedId);
            if (equip && equip.data) {
                const pointA = parseLatLngText($("linestarEditLocA")?.value);
                const pointB = parseLatLngText($("linestarEditLocB")?.value);
                equip.name = $("linestarEditName")?.value || equip.name || "LineStar";
                equip.comments = $("linestarEditComments")?.value || equip.comments || "";
                if ($("linestarEditDisabled")) {
                    equip.disabled = Boolean($("linestarEditDisabled")?.checked);
                }
                equip.data.controllerId = $("linestarEditControllerId")?.value || equip.data.controllerId || "";
                equip.data.commType = $("linestarEditCommType")?.value || equip.data.commType || "4G";
                equip.data.gateway = $("linestarEditGateway")?.value || "";
                equip.data.radioCentral = $("linestarEditRadioCentral")?.value || "";
                equip.data.radioControl = $("linestarEditRadioControl")?.value || "";
                equip.data.radioGps = $("linestarEditRadioGps")?.value || "";
                equip.data.radioBomba = $("linestarEditRadioBomba")?.value || "";
                equip.data.flow = window.IcNumeric.toFiniteNumber($("linestarEditFlow")?.value) ?? "";
                equip.data.pressMin = window.IcNumeric.toFiniteNumber($("linestarEditPressMin")?.value) ?? "";
                equip.data.pressMax = window.IcNumeric.toFiniteNumber($("linestarEditPressMax")?.value) ?? "";
                equip.data.speedMax = window.IcNumeric.toFiniteNumber($("linestarEditSpeedMax")?.value) ?? "";
                equip.data.hoseSide = document.querySelector("#linestarEditPanel .js-linestar-hose-side.is-active")?.getAttribute("data-side") || "A";
                equip.data.powerUnit = "kw";
                equip.data.power = window.IcNumeric.toFiniteNumber($("linestarEditPower")?.value) ?? "";
                equip.data.widthA = parseNonNegativeWidth($("linestarEditWidthA")?.value);
                equip.data.widthB = parseNonNegativeWidth($("linestarEditWidthB")?.value);
                equip.data.width = equip.data.widthA + equip.data.widthB;
                equip.data.visualOffset = $("linestarEditOffset")?.value || "0";
                equip.data.useMeter = Boolean($("linestarEditUseMeter")?.checked);
                equip.data.segments = cloneLineSegmentsForSave();
                equip.data.endGunEnabled = true;
                equip.data.endGunSide = "both";
                equip.data.endGunMode = "auto";
                equip.data.endGunSegments = cloneEndGunSegmentsForSave();
                equip.data.endGunSegmentsLeft = normalizeEndGunSegments(endGunSegmentsLeft).map((seg, idx) => ({
                    id: String(seg?.id || `egl_${idx}`),
                    startPercent: roundPercent(seg?.startPercent),
                    endPercent: roundPercent(seg?.endPercent)
                }));
                equip.data.intermediatePositions = intermediatePositions.map((p, idx) => ({
                    id: String(p?.id || `ip_${idx}`),
                    distanceMeters: roundMeters(p?.distanceMeters)
                }));
                if (pointA) {
                    equip.data.latA = pointA.lat;
                    equip.data.lngA = pointA.lng;
                }
                if (pointB) {
                    equip.data.latB = pointB.lat;
                    equip.data.lngB = pointB.lng;
                }
                window.IcMapRenderPivots?.(farm);
            }

            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

            // Grava de verdade no dataset persistido (localStorage/API). Antes
            // isso só mutava o equip em memória e mostrava um toast de sucesso
            // sem persistir nada — a edição sumia ao recarregar a página.
            let saved = false;
            try {
                saved = await persistLinestarEquip(farm, equip);
            } catch (err) {
                console.error("[linestaredit] Falha ao gravar o LineStar.", err);
            }

            if (!saved) {
                saveBtn.innerHTML = originalHtml;
                saveBtn.disabled = false;
                window.IcNotify?.error?.("Não foi possível salvar o LineStar.", 3000);
                return;
            }

            if (window.IcToast) {
                window.IcToast.show("LineStar salvo com sucesso!");
            } else {
                window.IcNotify?.success?.("LineStar salvo com sucesso!", 2000);
            }

            saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Salvo!';
            setTimeout(() => {
                saveBtn.innerHTML = originalHtml;
                saveBtn.disabled = false;
            }, 2000);
        }
    };
})();
