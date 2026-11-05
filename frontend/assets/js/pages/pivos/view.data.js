// assets/js/pages/pivos/view.data.js
(function () {
    "use strict";

    const Pivos = (window.Pivos = window.Pivos || {});
    const data = (Pivos.data = Pivos.data || {});

    function parseLatLngText(text) {
        const raw = String(text || "").trim();
        if (!raw) return null;
        const parts = raw
            .replaceAll(";", ",")
            .split(/,|\s+/)
            .map((item) => item.trim())
            .filter(Boolean);
        if (parts.length < 2) return null;
        const lat = Number(parts[0].replace(",", "."));
        const lng = Number(parts[1].replace(",", "."));
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { lat, lng };
    }

    function getNorthReferencePoint(center, radius) {
        if (!center || !Number.isFinite(radius) || radius <= 0) return null;
        return {
            lat: center.lat + (radius / 111320),
            lng: center.lng
        };
    }

    function distanceMetersBetweenPoints(from, to) {
        if (!from || !to) return NaN;
        if (window.L?.latLng) {
            return window.L.latLng(from.lat, from.lng).distanceTo([to.lat, to.lng]);
        }
        const earthRadius = 6378137;
        const toRadians = (value) => value * Math.PI / 180;
        const dLat = toRadians(to.lat - from.lat);
        const dLng = toRadians(to.lng - from.lng);
        const lat1 = toRadians(from.lat);
        const lat2 = toRadians(to.lat);
        const haversine = Math.sin(dLat / 2) ** 2
            + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
        return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(haversine)));
    }

    function bearingRad(from, to) {
        const toRad = (deg) => (deg * Math.PI) / 180;
        const lat1 = toRad(from.lat);
        const lat2 = toRad(to.lat);
        const dLng = toRad(to.lng - from.lng);
        const y = Math.sin(dLng) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
        return Math.atan2(y, x);
    }

    function destinationPoint(origin, distance, bearing) {
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
    }

    function resolveSmartTouchReference(pivotObj, center, radius, equipments) {
        if (!center || !Number.isFinite(radius) || radius <= 0) return null;

        const directRefLat = parseFloat(pivotObj?.data?.refLat);
        const directRefLng = parseFloat(pivotObj?.data?.refLng);
        if (!isNaN(directRefLat) && !isNaN(directRefLng)) {
            return { lat: directRefLat, lng: directRefLng };
        }

        const directRef = parseLatLngText(pivotObj?.data?.ref);
        if (directRef) return directRef;

        const linkedPivotId = String(pivotObj?.data?.linkedPivotId || "").trim();
        if (linkedPivotId) {
            const linkedEquip = Array.isArray(equipments)
                ? equipments.find((equip) => String(equip?.id || "") === linkedPivotId && String(equip?.id || "") !== String(pivotObj?.id || ""))
                : null;
            const linkedData = linkedEquip?.data || null;
            const linkedCenterLat = parseFloat(linkedData?.centerLat || linkedData?.lat);
            const linkedCenterLng = parseFloat(linkedData?.centerLng || linkedData?.lng);
            const linkedRefLat = parseFloat(linkedData?.refLat);
            const linkedRefLng = parseFloat(linkedData?.refLng);
            if (!isNaN(linkedCenterLat) && !isNaN(linkedCenterLng) && !isNaN(linkedRefLat) && !isNaN(linkedRefLng)) {
                return destinationPoint(
                    center,
                    radius,
                    bearingRad(
                        { lat: linkedCenterLat, lng: linkedCenterLng },
                        { lat: linkedRefLat, lng: linkedRefLng }
                    )
                );
            }
        }

        return getNorthReferencePoint(center, radius);
    }

    function normalizeControllerType(value) {
        return String(value || "")
            .toLowerCase()
            .replaceAll(" ", "")
            .replaceAll("_", "");
    }

    function normalizePivotFamilyName(value) {
        return String(value || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "");
    }

    function isSmartTouchFamilyName(value) {
        const normalized = normalizePivotFamilyName(value);
        return normalized === "smarttouch"
            || normalized === "centerstar"
            || normalized === "centerstart";
    }

    function resolvePivotControllerType(pivotObj, legacyPivot, mergedData) {
        const explicitController = normalizeControllerType(
            mergedData?.controllerType || pivotObj?.controllerType || legacyPivot?.controllerType
        );
        if (explicitController === "smarttouch") return "smarttouch";
        if (explicitController === "smartconnect" || explicitController === "nexus") return "smart_connect";

        const equipType = normalizeControllerType(pivotObj?.type || mergedData?.type || legacyPivot?.type);
        if (equipType === "smarttouch") return "smarttouch";
        if (equipType === "smartconnect" || equipType === "nexus") return "smart_connect";

        const panelType = normalizeControllerType(mergedData?.panelType || pivotObj?.data?.panelType);
        if (panelType === "smarttouch") return "smarttouch";
        if (panelType === "smartconnect" || panelType === "nexus") return "smart_connect";

        const pivotName = mergedData?.name
            || mergedData?.nome
            || pivotObj?.name
            || legacyPivot?.name
            || legacyPivot?.nome;
        if (isSmartTouchFamilyName(pivotName)) return "smarttouch";

        return "none";
    }

    function getPivotData(pivotId) {
        if (!pivotId) return null;

        const getAllFarms = () => {
            return window.IcFarmsAll || window.Cad?.data?.getAllFarms?.() || [];
        };

        const getEquips = (f) => {
            const a = Array.isArray(f?.equipments) ? f.equipments : [];
            const b = Array.isArray(f?.equipamentos) ? f.equipamentos : [];
            return [...a, ...b];
        };

        const findInFarm = (f) => {
            const equipments = getEquips(f);
            const legacyPivots = Array.isArray(f?.pivos) ? f.pivos : [];
            
            const pivotObj = equipments.find((e) =>
                String(e?.id || "").trim() === String(pivotId).trim() &&
                ["pivos", "pivo", "pivot", "pivots"].includes(String(e?.category || "").toLowerCase())
            ) || null;

            const legacyPivot = legacyPivots.find((p) => String(p?.id || "").trim() === String(pivotId).trim()) || null;

            if (pivotObj || legacyPivot) return { pivotObj, legacyPivot, farm: f };
            return null;
        };

        // 1. Tenta na fazenda ativa primeiro
        let activeFarm = window.IcFarmGetActive?.() || window.icFarmData || window.IcFarmActive;
        let result = findInFarm(activeFarm);

        // 2. Se não achou, busca em TODAS as fazendas disponíveis
        if (!result) {
            const allFarms = getAllFarms();
            for (const f of allFarms) {
                result = findInFarm(f);
                if (result) {
                    // Sincroniza a fazenda ativa global se achou em outra
                    window.IcFarmActive = f;
                    if (f.id) {
                        sessionStorage.setItem("ic_active_farm", String(f.id));
                        sessionStorage.setItem("ic_active_farm_id", String(f.id));
                    }
                    activeFarm = f;
                    break;
                }
            }
        }

        if (!result) return null;

        const { pivotObj, legacyPivot, farm } = result;
        const d = { ...(legacyPivot || {}), ...((pivotObj && pivotObj.data) || {}) };

        let center = null;
        let ref = null;
        let radius = null;

        // Centro (Busca exaustiva por campos de coordenadas)
        const lat = parseFloat(d.centerLat || d.lat || d.latitude || d.center_lat || d.center_latitude || (d.center && String(d.center).includes(',') ? d.center.split(',')[0] : NaN));
        const lng = parseFloat(d.centerLng || d.lng || d.longitude || d.center_lng || d.center_longitude || (d.center && String(d.center).includes(',') ? d.center.split(',')[1] : NaN));

        if (!isNaN(lat) && !isNaN(lng)) {
            center = { lat, lng };
        } else if (typeof d.center === 'string' && d.center.includes(',')) {
            const parts = d.center.split(',');
            center = { lat: parseFloat(parts[0]), lng: parseFloat(parts[1]) };
        } else if (typeof d.location === 'string' && d.location.includes(',')) {
            const parts = d.location.split(',');
            center = { lat: parseFloat(parts[0]), lng: parseFloat(parts[1]) };
        }

        // Referência (Ângulo 0)
        const rLat = parseFloat(d.refLat || d.reference_lat || d.zero_lat);
        const rLng = parseFloat(d.refLng || d.reference_lng || d.zero_lng);
        if (!isNaN(rLat) && !isNaN(rLng)) {
            ref = { lat: rLat, lng: rLng };
        } else if (typeof d.ref === 'string' && d.ref.includes(',')) {
            const parts = d.ref.split(',');
            ref = { lat: parseFloat(parts[0]), lng: parseFloat(parts[1]) };
        }

        radius = parseFloat(d.radius || d.raio);
        if (isNaN(radius) || radius <= 0) {
            if (center && ref) {
                radius = distanceMetersBetweenPoints(center, ref);
            } else {
                radius = 300;
            }
        }

        if (!ref && String(pivotObj?.type || "").toLowerCase() === "smarttouch") {
            const allEquips = getEquips(farm);
            ref = resolveSmartTouchReference(pivotObj, center, radius, allEquips);
        }

        const pivotName = pivotObj?.name || legacyPivot?.name || d.nome || `Pivô ${String(pivotId || "").slice(-4) || "Desconhecido"}`;
        const isSector = d.isSector === true || d.isSector === "true";
        const startAngle = d.startAngle;
        const endAngle = d.endAngle;
        const refLat = ref?.lat ?? parseFloat(d.refLat || d.reference_lat);
        const refLng = ref?.lng ?? parseFloat(d.refLng || d.reference_lng);
        const maxAngle = parseFloat(d.maxAngle ?? endAngle ?? 360);

        return {
            ...d,
            id: pivotId,
            name: pivotName,
            type: String(pivotObj?.type || legacyPivot?.type || d.type || "").trim(),
            controllerType: resolvePivotControllerType(pivotObj, legacyPivot, d),
            status: pivotObj?.status || "running",
            geo: pivotObj?.geo || null,
            center: center,
            ref: ref,
            refLat: Number.isFinite(refLat) ? refLat : null,
            refLng: Number.isFinite(refLng) ? refLng : null,
            radius: radius,
            isSector: isSector,
            startAngle: startAngle,
            endAngle: endAngle,
            maxAngle: Number.isFinite(maxAngle) ? maxAngle : 360,
            segments: Array.isArray(d.segments) ? d.segments.map((seg) => ({ ...seg })) : []
        };
    }

    data.getPivotData = getPivotData;
})();
