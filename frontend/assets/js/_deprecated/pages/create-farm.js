// assets/js/pages/create-farm.js
(function initCreateFarm() {
  "use strict";

  const openBtn = document.getElementById("btnCreateFarm");
  const modal = document.getElementById("createFarmModal");
  const nextBtn = document.getElementById("btnCreateFarmNext");
  const prevBtn = document.getElementById("btnCreateFarmPrev");
  const stepsContainer = document.getElementById("createFarmSteps");
  const bodyHost = document.getElementById("createFarmBody");
  const footer = document.getElementById("createFarmFooter");

  if (!openBtn || !modal || !nextBtn || !stepsContainer || !bodyHost) return;

  const closeTriggers = modal.querySelectorAll("[data-close-farm]");
  const steps = ["Geral", "Faturamento", "Contato", "Faixas de Energia", "Localização"];
  let currentStepIndex = 0;
  let farmLocationMap = null;
  let farmLocationMarker = null;

  const farmState = {
    name: "",
    loc: "",
    lat: -22.008419,
    lng: -46.812567,
    radius: "",
  };

  const BILLING_RULES = {
    BR: {
      fields: {
        country: {
          label: "Pa\u00eds",
          placeholder: "",
          required: true,
          show: true,
        },
        address: {
          label: "Endere\u00e7o",
          placeholder: "Ex: Av. Brasil, 120",
          required: true,
          show: true,
        },
        city: {
          label: "Cidade",
          placeholder: "Ex: Goi\u00e2nia",
          required: true,
          show: true,
        },
        postal: {
          label: "CEP",
          placeholder: "00000-000",
          required: true,
          show: true,
        },
        region: {
          label: "Estado (UF)",
          placeholder: "Ex: SP",
          required: true,
          show: true,
          type: "text",
        },
        neighborhood: {
          label: "Bairro",
          placeholder: "Opcional",
          required: false,
          show: false,
        },
      },
      docTypes: [
        { value: "cpf", label: "CPF (Cadastro de Pessoa F\u00edsica)" },
        { value: "cnpj", label: "CNPJ (Cadastro Nacional da Pessoa Jur\u00eddica)" },
      ],
      regionSelectPlaceholder: "Selecione o estado",
    },
    US: {
      fields: {
        country: {
          label: "Country",
          placeholder: "",
          required: true,
          show: true,
        },
        address: {
          label: "Street Address",
          placeholder: "123 Main St",
          required: true,
          show: true,
        },
        city: {
          label: "City",
          placeholder: "New York",
          required: true,
          show: true,
        },
        postal: {
          label: "ZIP Code",
          placeholder: "10001",
          required: true,
          show: true,
        },
        region: {
          label: "State",
          placeholder: "",
          required: true,
          show: true,
          type: "select",
        },
        neighborhood: {
          label: "Neighborhood",
          placeholder: "",
          required: false,
          show: false,
        },
      },
      docTypes: [
        { value: "ssn", label: "SSN" },
        { value: "ein", label: "EIN" },
      ],
      regionSelectPlaceholder: "Select a state",
    },
    DE: {
      fields: {
        country: {
          label: "Country",
          placeholder: "",
          required: true,
          show: true,
        },
        address: {
          label: "Street + Number",
          placeholder: "Musterstrasse 12",
          required: true,
          show: true,
        },
        city: {
          label: "City",
          placeholder: "Berlin",
          required: true,
          show: true,
        },
        postal: {
          label: "Postal Code",
          placeholder: "10115",
          required: true,
          show: true,
        },
        region: {
          label: "State",
          placeholder: "",
          required: false,
          show: false,
          type: "text",
        },
        neighborhood: {
          label: "Neighborhood",
          placeholder: "",
          required: false,
          show: false,
        },
      },
      docTypes: [{ value: "vat", label: "VAT" }],
      regionSelectPlaceholder: "Select a state",
    },
    ZA: {
      fields: {
        country: {
          label: "Country",
          placeholder: "",
          required: true,
          show: true,
        },
        address: {
          label: "Address Line",
          placeholder: "123 Main Rd",
          required: true,
          show: true,
        },
        city: {
          label: "City",
          placeholder: "Cape Town",
          required: true,
          show: true,
        },
        postal: {
          label: "Postal Code",
          placeholder: "8001",
          required: true,
          show: true,
        },
        region: {
          label: "Province",
          placeholder: "Western Cape",
          required: true,
          show: true,
          type: "text",
        },
        neighborhood: {
          label: "Neighborhood",
          placeholder: "",
          required: false,
          show: false,
        },
      },
      docTypes: [{ value: "id", label: "ID Number" }],
      regionSelectPlaceholder: "Select a province",
    },
  };

  const DEFAULT_BILLING = {
    fields: {
      country: {
        label: "Country",
        placeholder: "",
        required: true,
        show: true,
      },
      address: {
        label: "Address Line",
        placeholder: "",
        required: true,
        show: true,
      },
      city: {
        label: "City",
        placeholder: "",
        required: true,
        show: true,
      },
      postal: {
        label: "Postal Code",
        placeholder: "",
        required: true,
        show: true,
      },
      region: {
        label: "Region",
        placeholder: "",
        required: true,
        show: true,
        type: "text",
      },
      neighborhood: {
        label: "Neighborhood",
        placeholder: "",
        required: false,
        show: false,
      },
    },
    docTypes: [{ value: "id", label: "ID Number" }],
    regionSelectPlaceholder: "Select",
  };

  const US_STATE_CODES = [
    "AL",
    "AK",
    "AZ",
    "AR",
    "CA",
    "CO",
    "CT",
    "DE",
    "FL",
    "GA",
    "HI",
    "ID",
    "IL",
    "IN",
    "IA",
    "KS",
    "KY",
    "LA",
    "ME",
    "MD",
    "MA",
    "MI",
    "MN",
    "MS",
    "MO",
    "MT",
    "NE",
    "NV",
    "NH",
    "NJ",
    "NM",
    "NY",
    "NC",
    "ND",
    "OH",
    "OK",
    "OR",
    "PA",
    "RI",
    "SC",
    "SD",
    "TN",
    "TX",
    "UT",
    "VT",
    "VA",
    "WA",
    "WV",
    "WI",
    "WY",
    "DC",
  ];

  const farmBillingState = {
    country: "",
    postal: "",
    city: "",
    address: "",
    region: "",
    regionCode: "",
    neighborhood: "",
  };

  const farmContactState = {
    useBillingAddress: false,
  };

  const FARM_STORAGE_KEY = "ic_farms";
  const farmListHost = document.getElementById("farmList");
  const farmSearchInput = document.getElementById("farmSearchInput");
  const farmSearchPanel = document.getElementById("farmSearchPanel");
  const farmSearchHost = document.getElementById("farmSearch");
  const mapCardTitle = document.querySelector("#mapCard .map-card__title h2");
  let farms = [];
  let farmMarkers = new Map();
  let farmLayer = null;
  let currentFarmId = null;
  let activeFarmSnapshot = null;
  const farmSelectRegistry = new Set();
  let farmSelectListenersBound = false;
  const EQUIP_CATEGORY_BY_TYPE = {
    smart_connect: "pivos",
    smarttouch: "pivos",
    irripump: "bombas",
    medidor: "medidores",
    pluviometro: "pluviometros",
    repetidora: "repetidoras",
    rainstar: "carreteis",
    estacao_metereologica: "estacoes",
  };
  const EQUIP_LABEL_BY_TYPE = {
    smart_connect: "Pivô",
    smarttouch: "Pivô",
    irripump: "Bomba",
    medidor: "Medidor",
    pluviometro: "Pluviômetro",
    repetidora: "Repetidora",
    rainstar: "Carretel",
    estacao_metereologica: "Estação",
  };

  function setHidden(el, hidden) {
    if (!el) return;
    el.classList.toggle("is-hidden", hidden);
    el.setAttribute("aria-hidden", String(hidden));
    if (el._farmSelect?.wrapper) {
      el._farmSelect.wrapper.classList.toggle("is-hidden", hidden);
      el._farmSelect.wrapper.setAttribute("aria-hidden", String(hidden));
    }
  }

  function setText(el, text) {
    if (!el) return;
    el.textContent = text || "";
  }

  function setActiveFarmSnapshot(farm) {
    if (!farm) return;
    activeFarmSnapshot = {
      id: farm.id,
      name: farm.name,
      lat: farm.lat,
      lng: farm.lng,
    };
    window.IcFarmActive = { ...activeFarmSnapshot };
  }

  function clearActiveFarmSnapshot() {
    activeFarmSnapshot = null;
    window.IcFarmActive = null;
  }

  function ensureDefaultFarm() {
    if (farms.length) return farms[0];
    const title = mapCardTitle?.textContent?.trim() || "Minha Fazenda";
    let lat = -22.008419;
    let lng = -46.812567;
    if (window.icMap && typeof window.icMap.getCenter === "function") {
      const center = window.icMap.getCenter();
      if (center && Number.isFinite(center.lat) && Number.isFinite(center.lng)) {
        lat = center.lat;
        lng = center.lng;
      }
    }

    const farm = {
      id: `farm_${Date.now()}`,
      name: title,
      lat,
      lng,
    };

    farms.push(farm);
    saveFarms();
    addFarmMarker(farm);
    currentFarmId = farm.id;
    setActiveFarmSnapshot(farm);
    renderFarmList(farmSearchInput ? farmSearchInput.value : "");
    return farm;
  }

  function formatDateTime(dateInput) {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (Number.isNaN(date.getTime())) return "--";
    const day = String(date.getDate()).padStart(2, "0");
    const monthNames = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    const month = monthNames[date.getMonth()] || "";
    const year = date.getFullYear();
    const hour = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    return `${day} ${month} ${year} ${hour}:${min}`;
  }

  function toNumber(value) {
    const num = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(num) ? num : null;
  }

  function formatDecimal(value, digits) {
    const num = toNumber(value);
    if (num === null) return "--";
    return num.toFixed(digits);
  }

  function parseLatLngText(text) {
    const raw = String(text || "").trim();
    if (!raw) return null;
    const parts = raw
      .replaceAll(";", ",")
      .split(/,|\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length < 2) return null;
    const lat = Number(parts[0].replace(",", "."));
    const lng = Number(parts[1].replace(",", "."));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }

  function getPivotAngleDeg(data) {
    if (!data) return null;
    const center =
      Number.isFinite(Number(data.centerLat)) && Number.isFinite(Number(data.centerLng))
        ? { lat: Number(data.centerLat), lng: Number(data.centerLng) }
        : parseLatLngText(data.center);
    const ref =
      Number.isFinite(Number(data.refLat)) && Number.isFinite(Number(data.refLng))
        ? { lat: Number(data.refLat), lng: Number(data.refLng) }
        : parseLatLngText(data.ref);
    if (!center || !ref) return null;

    const toRad = (deg) => (deg * Math.PI) / 180;
    const lat1 = toRad(center.lat);
    const lat2 = toRad(ref.lat);
    const dLng = toRad(ref.lng - center.lng);
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    let deg = (Math.atan2(y, x) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    return Math.round(deg);
  }

  const METRIC_SVG_FILTER = "invert(33%) sepia(14%) saturate(620%) hue-rotate(175deg) brightness(80%) contrast(90%)";
  const METRIC_ICON_SVG_MAP = {
    "fa-solid fa-location-arrow": { src: "./assets/img/svg/circle-gauge.svg", alt: "Angulo" },
    "fa-solid fa-cloud": { src: "./assets/img/svg/gauge.svg", alt: "Pressao" },
    "fa-regular fa-clock": { src: "./assets/img/svg/clock.svg", alt: "Horas" },
    "fa-solid fa-droplet": { src: "./assets/img/svg/cloud-rain.svg", alt: "Pluviometro" },
    "fa-solid fa-arrows-rotate": { src: "./assets/img/svg/refresh-cw.svg", alt: "Numero de Voltas", size: 14 },
    "fa-solid fa-bolt": { src: "./assets/img/svg/zap.svg", alt: "Tensão" },
  };

  function resolveMetricIconMarkup(iconContent, tooltip) {
    const raw = String(iconContent || "").trim();
    if (!raw) return "";
    if (/^\s*</.test(raw)) return raw;

    const svgMeta = METRIC_ICON_SVG_MAP[raw];
    if (svgMeta) {
      const size = svgMeta.size || 15;
      const alt = tooltip || svgMeta.alt;
      return `<img src="${svgMeta.src}" alt="${alt}" style="width: ${size}px; height: ${size}px; object-fit: contain; filter: ${METRIC_SVG_FILTER};">`;
    }

    return `<i class="${raw}"></i>`;
  }

  function normalizeMetricTooltip(iconContent, tooltip, extraClass) {
    const raw = String(iconContent || "").trim();
    if (raw === "fa-solid fa-location-arrow") return "\u00c2ngulo";
    if (raw === "fa-solid fa-cloud" && String(extraClass || "").includes("map-card__metric--motor")) {
      return "Press\u00e3o \u00daltima Torre";
    }
    if (raw === "fa-solid fa-cloud") return "Press\u00e3o Centro";
    if (raw === "fa-regular fa-clock") return "Horas";
    if (raw === "fa-solid fa-droplet") return "Pluvi\u00f4metro";
    if (raw === "fa-solid fa-arrows-rotate") return "N\u00famero de Voltas";
    return tooltip;
  }

  function buildMetric(iconContent, value, tooltip, extraClass) {
    const metric = document.createElement("div");
    metric.className = `map-card__metric${extraClass ? ` ${extraClass}` : ""}`;
    const resolvedTooltip = normalizeMetricTooltip(iconContent, tooltip, extraClass);

    const ico = document.createElement("span");
    ico.className = "map-card__metric-ico";
    ico.innerHTML = resolveMetricIconMarkup(iconContent, resolvedTooltip);

    const val = document.createElement("span");
    val.className = "map-card__metric-val";
    val.textContent = value || "--";

    metric.append(ico, val);

    if (resolvedTooltip) {
      const tip = document.createElement("span");
      tip.className = "map-card__tooltip";
      tip.textContent = resolvedTooltip;
      metric.appendChild(tip);
    }

    return metric;
  }

  function getGeoBaseCenter(plv, cg) {
    const fallback = { lat: -16.767, lng: -47.613 };
    const bbox = cg?.__baseRainBbox || cg?.rainAreaBbox;
    if (bbox && Number.isFinite(bbox.minLat) && Number.isFinite(bbox.maxLat) && Number.isFinite(bbox.minLng) && Number.isFinite(bbox.maxLng)) {
      return {
        lat: (bbox.minLat + bbox.maxLat) / 2,
        lng: (bbox.minLng + bbox.maxLng) / 2,
      };
    }

    const polygon = cg?.__baseRainAreaPolygon || cg?.rainAreaPolygon;
    if (Array.isArray(polygon) && polygon.length) {
      let sumLat = 0;
      let sumLng = 0;
      let count = 0;
      polygon.forEach((p) => {
        const lat = Array.isArray(p) ? p[0] : p?.lat;
        const lng = Array.isArray(p) ? p[1] : p?.lng;
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          sumLat += lat;
          sumLng += lng;
          count += 1;
        }
      });
      if (count) {
        return { lat: sumLat / count, lng: sumLng / count };
      }
    }

    if (plv && Array.isArray(plv.PLUVIOS) && plv.PLUVIOS.length) {
      let sumLat = 0;
      let sumLng = 0;
      let count = 0;
      plv.PLUVIOS.forEach((p) => {
        const lat = Number.isFinite(p.__baseLat) ? p.__baseLat : p.lat;
        const lng = Number.isFinite(p.__baseLng) ? p.__baseLng : p.lng;
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          sumLat += lat;
          sumLng += lng;
          count += 1;
        }
      });
      if (count) {
        return { lat: sumLat / count, lng: sumLng / count };
      }
    }

    return fallback;
  }

  function isPluviometriaActive() {
    return document.body?.classList?.contains("is-pluviometria");
  }

  function applyFarmGeo(farm) {
    if (!farm || !Number.isFinite(farm.lat) || !Number.isFinite(farm.lng)) return;

    const plv = window.Plv?.data;
    const cg = window.ChuvaGeo?.data;
    const baseCenter = getGeoBaseCenter(plv, cg);
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
        if (!Number.isFinite(p.__baseLat) || !Number.isFinite(p.__baseLng)) {
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

    if (isPluviometriaActive()) {
      window.Plv?.views?.map?.renderMarkers?.();
    }

    if (window.ChuvaGeo?.layers?.rain?.setData && window.L && cg?.rainAreaBbox) {
      const b = cg.rainAreaBbox;
      const bounds = L.latLngBounds([b.minLat, b.minLng], [b.maxLat, b.maxLng]);
      window.ChuvaGeo.layers.rain.setData({ bounds, url: cg.rainImageUrl || "./assets/img/map/testmap.png" });
      const shouldShowRain = !!window.ChuvaGeo?.state?.showRain && isPluviometriaActive();
      if (shouldShowRain) window.ChuvaGeo.layers.rain.add?.();
      else window.ChuvaGeo.layers.rain.remove?.();
    }

  }

  function getFarmMarkerIcon() {
    if (!window.L) return null;
    return L.divIcon({
      className: "map-farm-marker",
      html: `
        <div class="map-central-icon map-farm-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path class="rep-path-4" d="M16.247 7.761a6 6 0 0 1 0 8.478"/>
            <path class="rep-path-5" d="M19.075 4.933a10 10 0 0 1 0 14.134"/>
            <path class="rep-path-2" d="M4.925 19.067a10 10 0 0 1 0-14.134"/>
            <path class="rep-path-3" d="M7.753 16.239a6 6 0 0 1 0-8.478"/>
            <circle cx="12" cy="12" r="2"/>
          </svg>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  }

  function renderEquipmentPanels(farm) {
    const panels = document.querySelectorAll(".map-card__panel[data-equip-list]");
    if (!panels.length) return;

    panels.forEach((panel) => {
      const key = panel.dataset.equipList;
      let list = (farm?.equipments || []).filter((item) => item.category === key);
      if (key === "carreteis") {
        list = (farm?.equipments || []).filter((item) => item.category === "carreteis" && item.type !== "linestar");
      }
      if (key === "linestars") {
        list = (farm?.equipments || []).filter((item) => item.category === "carreteis" && item.type === "linestar");
      }
      panel.innerHTML = "";
      const toggle = document.querySelector(`.map-card__item--toggle[data-panel="${panel.dataset.panel}"]`);

      if (!list.length) {
        if (toggle) toggle.style.display = "none";
        panel.style.display = "none";
        return;
      }

      if (toggle) toggle.style.display = "";
      panel.style.display = "";

      list.forEach((item) => {
        const equip = document.createElement("div");
        equip.className = "map-card__equip";

        const head = document.createElement("div");
        head.className = "map-card__equip-head";

        const name = document.createElement("span");
        name.className = "map-card__equip-name";
        name.textContent = item.name || item.label || "Equipamento";

        head.appendChild(name);

        if (item.category === "pivos") {
          const badge = document.createElement("span");
          badge.className = "map-card__equip-badge map-card__equip-badge--warn";
          badge.textContent = "PAINEL DESLIGADO";
          head.appendChild(badge);
        }

        if (item.category === "medidores") {
          const levelPercent =
            toNumber(item?.data?.levelPercent) ??
            toNumber(item?.data?.percent) ??
            toNumber(item?.data?.nivelPercent) ??
            82.14;
          const levelMeters =
            toNumber(item?.data?.levelMeters) ??
            toNumber(item?.data?.meters) ??
            toNumber(item?.data?.nivelMeters) ??
            5.75;
          const badge = document.createElement("span");
          badge.className = "map-card__equip-badge map-card__equip-badge--info";
          badge.textContent = `${formatDecimal(levelPercent, 2)}% (${formatDecimal(levelMeters, 2)}m)`;
          head.appendChild(badge);
        }

        equip.appendChild(head);

        if (item.category === "pivos") {
          const angle = getPivotAngleDeg(item.data);
          const turnCount = toNumber(item?.data?.turnCount) ?? toNumber(item?.data?.voltas) ?? 50;

          const metricsTop = document.createElement("div");
          metricsTop.className = "map-card__metrics map-card__metrics--three";
          metricsTop.append(
            buildMetric("fa-solid fa-location-arrow", angle === null ? "--" : `${angle}\u00b0`, "\u00c2ngulo"),
            buildMetric("fa-solid fa-cloud", "--", "Press\u00e3o (centro)"),
            buildMetric("fa-regular fa-clock", "00h00min", "Tempo ligado")
          );

          const metricsBottom = document.createElement("div");
          metricsBottom.className = "map-card__metrics map-card__metrics--three";
          if (item.type === "smarttouch") {
            const voltage = toNumber(item?.data?.voltage ?? item?.data?.voltagem ?? item?.data?.tensao);
            const voltageLabel = Number.isFinite(voltage) ? `${Math.round(voltage)} V` : "--";
            metricsBottom.append(
              buildMetric("fa-solid fa-bolt", voltageLabel, "Tensão"),
              buildMetric("fa-solid fa-arrows-rotate", String(turnCount), "Numero de Voltas", "map-card__metric--rotations")
            );
            metricsBottom.className = "map-card__metrics map-card__metrics--three";
          } else {
            const voltage = toNumber(item?.data?.voltage ?? item?.data?.voltagem ?? item?.data?.tensao);
            const voltageLabel = Number.isFinite(voltage) ? `${Math.round(voltage)} V` : "--";
            metricsBottom.append(
              buildMetric("fa-solid fa-droplet", "0mm", "Pluvi\u00f4metro"),
              buildMetric("fa-solid fa-cloud", "--", "Press\u00e3o (motor)", "map-card__metric--motor"),
              buildMetric("fa-solid fa-bolt", voltageLabel, "Tensão")
            );
          }

          equip.append(metricsTop, metricsBottom);
        }

        if (item.category === "medidores") {
          const minPercent = toNumber(item?.data?.minPercent) ?? 20;
          const maxPercent = toNumber(item?.data?.maxPercent) ?? 100;
          const status = item?.data?.status || "Carregada";

          const metricsRow = document.createElement("div");
          metricsRow.className = "map-card__metrics map-card__metrics--three";
          metricsRow.append(
            buildMetric("fa-solid fa-arrow-down-long", `Min.: ${formatDecimal(minPercent, 0)}%`),
            buildMetric("fa-solid fa-arrow-up-long", `Max.: ${formatDecimal(maxPercent, 0)}%`, null, "map-card__metric--danger"),
            buildMetric("fa-solid fa-battery-full", status, null, "map-card__metric--success")
          );

          equip.append(metricsRow);
        }

        if (item.category === "repetidoras") {
          const height = toNumber(item?.data?.height);
          const metricsRow = document.createElement("div");
          metricsRow.className = "map-card__metrics map-card__metrics--one";
          metricsRow.append(
            buildMetric("fa-solid fa-up-down", height === null ? "-- m" : `${formatDecimal(height, 1)} m`)
          );
          equip.append(metricsRow);
        }

        const foot = document.createElement("div");
        foot.className = "map-card__equip-foot";
        foot.innerHTML = `<span class="comm-label">Última comunicação:</span> ${formatDateTime(item.createdAt)}`;
        equip.appendChild(foot);

        if (item.category === "pivos") {
          equip.style.cursor = "pointer";
          equip.classList.add("is-clickable");
          equip.addEventListener("click", () => {
            // Respeita a mesma preferência do clique no desenho do pivô no mapa
            // (Configurações > Navegação > Ação ao Clicar nos Ícones do Mapa).
            const action = localStorage.getItem("ic:pivot-click-action") || "details";
            if (action === "schedule") {
              if (window.OpModal && typeof window.OpModal.open === "function") {
                window.OpModal.open({ title: item.name || "Pivô", pivotId: item.id });
              }
            } else if (window.IcPivos && typeof window.IcPivos.open === "function") {
              window.IcPivos.open({ pivotId: item.id });
            }
          });
        }

        panel.appendChild(equip);
      });
    });
  }

  function clearEquipmentPanels(message) {
    const panels = document.querySelectorAll(".map-card__panel[data-equip-list]");
    if (!panels.length) return;
    panels.forEach((panel) => {
      panel.innerHTML = "";
      const toggle = document.querySelector(`.map-card__item--toggle[data-panel="${panel.dataset.panel}"]`);
      if (toggle) toggle.style.display = "none";
      panel.style.display = "none";
    });
  }

  function clearFarmSelection() {
    currentFarmId = null;
    clearActiveFarmSnapshot();
    if (farmSearchHost) farmSearchHost.classList.remove("has-selection");
    if (farmSearchInput) delete farmSearchInput.dataset.selected;
    updateActiveFarm();
    clearEquipmentPanels();
    window.IcMapClearPivots?.();
    clearFarmMarkers();
    if (mapCardTitle) mapCardTitle.textContent = "";
  }

  function getNextNameForCategory(farm, category, baseLabel) {
    const list = (farm?.equipments || []).filter((item) => item.category === category);
    const nextIndex = list.length + 1;
    return `${baseLabel} ${String(nextIndex).padStart(2, "0")}`;
  }

  function isPlainObject(value) {
    if (!value || typeof value !== "object") return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }

  function sanitizeValue(value, depth = 0) {
    if (depth > 6) return undefined;
    if (value === null) return null;
    if (typeof value === "function") return undefined;
    if (typeof value !== "object") return value;
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) {
      const out = value
        .map((item) => sanitizeValue(item, depth + 1))
        .filter((item) => item !== undefined);
      return out;
    }
    if (!isPlainObject(value)) return undefined;
    const out = {};
    Object.keys(value).forEach((key) => {
      if (key.startsWith("_")) return;
      const clean = sanitizeValue(value[key], depth + 1);
      if (clean !== undefined) out[key] = clean;
    });
    return out;
  }

  function sanitizeEquipmentData(data) {
    if (!data || typeof data !== "object") return {};
    const clean = sanitizeValue(data);
    return isPlainObject(clean) ? clean : {};
  }

  function getPluvioCoords(data, farm) {
    const lat = toNumber(data?.lat);
    const lng = toNumber(data?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    const parsed = parseLatLngText(data?.loc);
    if (parsed) return parsed;
    if (farm && Number.isFinite(farm.lat) && Number.isFinite(farm.lng)) {
      return { lat: farm.lat, lng: farm.lng };
    }
    return null;
  }

  function addPluvioToPluviometria(equipItem, farm) {
    if (!equipItem || equipItem.type !== "pluviometro") return;
    const plvData = window.Plv?.data;
    if (!plvData) return;
    const list = Array.isArray(plvData.PLUVIOS) ? plvData.PLUVIOS : (plvData.PLUVIOS = []);
    const exists = list.some((p) => p.sourceEquipId === equipItem.id || p.id === equipItem.id);
    if (exists) return;

    const coords = getPluvioCoords(equipItem.data || {}, farm);
    if (!coords) return;

    const name = equipItem.name || equipItem.data?.nome || "Pluviômetro";
    const sub = equipItem.data?.sub || "Talhão não informado";

    list.push({
      id: equipItem.id || `pluv_${Date.now()}`,
      sourceEquipId: equipItem.id || null,
      serial: equipItem.data?.serial || "",
      nome: name,
      sub,
      pivos: [],
      pivosAssoc: [],
      lat: coords.lat,
      lng: coords.lng,
      status: "none",
      statusLabel: "Sem chuva no momento",
      statusMeta: "sem dados",
      mm: 0,
      intensidade: "Sem chuva",
      intensidadeMeta: "",
      updated: "Recém cadastrado",
      unidade: "mm",
      uso: { irrigacao: false, alertas: false, relatorios: false },
      semComunicacao: false,
    });

    if (isPluviometriaActive()) {
      const plv = window.Plv;
      plv?.cards?.renderCards?.();
      plv?.cards?.syncSelectionUI?.();
      plv?.views?.map?.renderMarkers?.();
      plv?.views?.data?.renderData?.();
      plv?.maintenance?.renderMaintenanceCards?.();
      plv?.views?.edit?.renderEditSelect?.();
      plv?.views?.edit?.renderEditSummary?.();
    }
  }

  function addEquipmentToFarm(equipPayload) {
    if (!equipPayload) return;
    const farmId = equipPayload.farmId || currentFarmId || activeFarmSnapshot?.id;
    let farm = farmId ? farms.find((item) => item.id === farmId) : null;
    if (!farm) farm = ensureDefaultFarm();
    if (!farm) return;
    if (!currentFarmId) currentFarmId = farm.id;
    setActiveFarmSnapshot(farm);

    const type = equipPayload.type;
    const category = EQUIP_CATEGORY_BY_TYPE[type] || "outros";
    const baseLabel = EQUIP_LABEL_BY_TYPE[type] || "Equipamento";
    const name = equipPayload.name || getNextNameForCategory(farm, category, baseLabel);

    const equipItem = {
      id: `equip_${Date.now()}`,
      type,
      category,
      name,
      createdAt: equipPayload.createdAt || new Date().toISOString(),
      data: sanitizeEquipmentData(equipPayload.data),
    };

    farm.equipments = farm.equipments || [];
    farm.equipments.push(equipItem);
    addPluvioToPluviometria(equipItem, farm);
    saveFarms();
    renderEquipmentPanels(farm);
    if (window.IcMapRenderPivots) window.IcMapRenderPivots(farm);
    if (mapCardTitle) mapCardTitle.textContent = farm.name;
  }

  function bindFarmSelectGlobalEvents() {
    if (farmSelectListenersBound) return;
    farmSelectListenersBound = true;
    document.addEventListener("click", (event) => {
      if (event.target.closest(".farm-select")) return;
      closeAllFarmSelects();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      closeAllFarmSelects();
    });
    window.addEventListener("resize", () => {
      farmSelectRegistry.forEach((select) => {
        if (select?._farmSelect?.wrapper.classList.contains("is-open")) {
          positionFarmSelectList(select);
        }
      });
    });
    if (modal && !modal._farmSelectScrollBound) {
      modal._farmSelectScrollBound = true;
      modal.addEventListener(
        "scroll",
        () => {
          closeAllFarmSelects();
        },
        true
      );
    }
  }

  function closeFarmSelect(select) {
    const data = select?._farmSelect;
    if (!data) return;
    data.wrapper.classList.remove("is-open");
    data.trigger.setAttribute("aria-expanded", "false");
  }

  function closeAllFarmSelects(except) {
    farmSelectRegistry.forEach((select) => {
      if (select === except) return;
      closeFarmSelect(select);
    });
  }

  function positionFarmSelectList(select) {
    const data = select?._farmSelect;
    if (!data) return;
    const rect = data.trigger.getBoundingClientRect();
    const margin = 12;
    const spacing = 6;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const spaceBelow = viewportHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, openUp ? spaceAbove : spaceBelow);
    const top = openUp
      ? Math.max(margin, rect.top - maxHeight - spacing)
      : rect.bottom + spacing;
    const width = Math.min(rect.width, viewportWidth - margin * 2);
    const left = Math.max(margin, Math.min(rect.left, viewportWidth - width - margin));
    data.list.style.left = `${left}px`;
    data.list.style.top = `${top}px`;
    data.list.style.width = `${width}px`;
    data.list.style.maxHeight = `${maxHeight}px`;
  }

  function syncFarmSelectDisabled(select) {
    const data = select?._farmSelect;
    if (!data) return;
    const disabled = !!select.disabled;
    data.wrapper.classList.toggle("is-disabled", disabled);
    data.trigger.disabled = disabled;
  }

  function syncFarmSelectHidden(select) {
    const data = select?._farmSelect;
    if (!data) return;
    const hidden = select.classList.contains("is-hidden");
    data.wrapper.classList.toggle("is-hidden", hidden);
    data.wrapper.setAttribute("aria-hidden", String(hidden));
  }

  function updateFarmSelectValue(select) {
    const data = select?._farmSelect;
    if (!data) return;
    const option = select.selectedOptions[0] || select.options[0];
    const value = option ? option.value : "";
    const label = option ? option.textContent : "";
    data.valueEl.textContent = label || "";
    data.valueEl.classList.toggle("is-placeholder", value === "");
    Array.from(data.list.children).forEach((btn) => {
      const isSelected = btn.dataset.value === value;
      btn.classList.toggle("is-selected", isSelected);
      btn.setAttribute("aria-selected", String(isSelected));
    });
  }

  function rebuildFarmSelectOptions(select) {
    const data = select?._farmSelect;
    if (!data) return;
    data.list.innerHTML = "";
    Array.from(select.options).forEach((option) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "farm-select__option";
      btn.dataset.value = option.value;
      btn.textContent = option.textContent;
      btn.setAttribute("role", "option");
      if (option.disabled) {
        btn.disabled = true;
        btn.setAttribute("aria-disabled", "true");
      }
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        updateFarmSelectValue(select);
        closeFarmSelect(select);
        data.trigger.focus();
      });
      data.list.appendChild(btn);
    });
    updateFarmSelectValue(select);
  }

  function refreshFarmSelect(select) {
    if (!select?._farmSelect) return;
    rebuildFarmSelectOptions(select);
    syncFarmSelectDisabled(select);
    syncFarmSelectHidden(select);
  }

  function enhanceFarmSelect(select, root) {
    if (!select || select._farmSelect) return;
    const wrapper = document.createElement("div");
    wrapper.className = "farm-select";
    wrapper.dataset.farmSelect = "true";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "farm-select__trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");

    const valueEl = document.createElement("span");
    valueEl.className = "farm-select__value";
    const chev = document.createElement("i");
    chev.className = "fa-solid fa-chevron-down";
    trigger.append(valueEl, chev);

    const list = document.createElement("div");
    list.className = "farm-select__list";
    list.setAttribute("role", "listbox");
    const listId = select.id
      ? `${select.id}__list`
      : `farmSelectList_${Math.random().toString(36).slice(2)}`;
    list.id = listId;
    trigger.setAttribute("aria-controls", listId);

    select.classList.add("farm-select__native");
    select.setAttribute("aria-hidden", "true");
    select.tabIndex = -1;

    select.parentNode.insertBefore(wrapper, select);
    wrapper.append(trigger, list, select);

    select._farmSelect = { wrapper, trigger, valueEl, list };
    farmSelectRegistry.add(select);

    trigger.addEventListener("click", () => {
      if (select.disabled) return;
      const isOpen = wrapper.classList.contains("is-open");
      closeAllFarmSelects(select);
      if (isOpen) {
        closeFarmSelect(select);
      } else {
        positionFarmSelectList(select);
        wrapper.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
      }
    });

    select.addEventListener("change", () => updateFarmSelectValue(select));
    select.addEventListener("input", () => updateFarmSelectValue(select));

    if (select.id && root) {
      const escapeId = window.CSS && CSS.escape ? CSS.escape(select.id) : select.id;
      const label = root.querySelector(`label[for="${escapeId}"]`);
      if (label && !label.dataset.farmSelectBound) {
        label.dataset.farmSelectBound = "true";
        label.addEventListener("click", (event) => {
          event.preventDefault();
          if (select.disabled) return;
          closeAllFarmSelects(select);
          wrapper.classList.add("is-open");
          trigger.setAttribute("aria-expanded", "true");
          trigger.focus();
        });
      }
    }

    const observer = new MutationObserver((mutations) => {
      let needsRebuild = false;
      let needsSync = false;
      mutations.forEach((mutation) => {
        if (mutation.type === "childList") needsRebuild = true;
        if (mutation.type === "attributes") needsSync = true;
      });
      if (needsRebuild) rebuildFarmSelectOptions(select);
      if (needsRebuild || needsSync) {
        updateFarmSelectValue(select);
        syncFarmSelectDisabled(select);
        syncFarmSelectHidden(select);
      }
    });
    observer.observe(select, { childList: true, attributes: true, attributeFilter: ["disabled", "class"] });

    refreshFarmSelect(select);
  }

  function initFarmSelects(root) {
    if (!root) return;
    bindFarmSelectGlobalEvents();
    farmSelectRegistry.forEach((select) => {
      if (!document.contains(select)) farmSelectRegistry.delete(select);
    });
    root.querySelectorAll("select.equip-input").forEach((select) => {
      if (!root.closest("#createFarmModal") && !select.closest("#createFarmModal")) return;
      if (select._farmSelect) {
        refreshFarmSelect(select);
        return;
      }
      enhanceFarmSelect(select, root);
    });
  }

  function setFieldState(field, config) {
    if (!field || !config) return;
    setHidden(field, !config.show);
    const labelText = field.querySelector("[data-label-text]");
    const input = field.querySelector("[data-input]");
    setText(labelText, config.label);
    if (input) {
      input.placeholder = config.placeholder || "";
      input.required = !!config.required && config.show;
      input.disabled = !config.show;
    }
  }

  function setControlState(control, show) {
    if (!control) return;
    setHidden(control, !show);
    control.disabled = !show;
  }

  function buildSelectOptions(select, options, placeholder) {
    if (!select) return;
    select.innerHTML = "";
    if (placeholder !== null) {
      const placeholderOption = document.createElement("option");
      placeholderOption.value = "";
      placeholderOption.textContent = placeholder || "Select";
      select.appendChild(placeholderOption);
    }
    options.forEach((item) => {
      const option = document.createElement("option");
      if (typeof item === "string") {
        option.value = item;
        option.textContent = item;
      } else {
        option.value = item.value;
        option.textContent = item.label;
      }
      select.appendChild(option);
    });
    refreshFarmSelect(select);
  }

  function loadFarms() {
    try {
      const raw = localStorage.getItem(FARM_STORAGE_KEY);
      farms = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(farms)) farms = [];
    } catch (e) {
      farms = [];
    }
  }

  function saveFarms() {
    localStorage.setItem(FARM_STORAGE_KEY, JSON.stringify(farms));
  }

  function ensureFarmLayer() {
    if (!window.L || !window.icMap) return null;
    if (!farmLayer) {
      farmLayer = L.layerGroup().addTo(window.icMap);
    }
    return farmLayer;
  }

  function addFarmMarker(farm) {
    const layer = ensureFarmLayer();
    if (!layer || !farm) return;
    const tooltipHtml = `
      <div class="pivot-tooltip">
        <span class="pivot-tooltip__name">Central</span>
      </div>
    `;

    if (farmMarkers.has(farm.id)) {
      const existing = farmMarkers.get(farm.id);
      existing.setLatLng([farm.lat, farm.lng]);
      existing.bindPopup(farm.name);
      existing.bindTooltip(tooltipHtml, {
        permanent: false,
        direction: "top",
        className: "pivot-tooltip-wrap",
        opacity: 1,
        offset: [0, -10]
      });
      return;
    }
    const icon = getFarmMarkerIcon();
    const marker = L.marker([farm.lat, farm.lng], icon ? { icon } : undefined).addTo(layer);
    marker.bindPopup(farm.name);
    marker.bindTooltip(tooltipHtml, {
      permanent: false,
      direction: "top",
      className: "pivot-tooltip-wrap",
      opacity: 1,
      offset: [0, -10]
    });
    farmMarkers.set(farm.id, marker);
  }

  function clearFarmMarkers() {
    if (farmLayer) farmLayer.clearLayers();
    farmMarkers.clear();
  }

  function getActiveFarmForMarker() {
    if (currentFarmId) return farms.find((item) => item.id === currentFarmId) || null;
    if (activeFarmSnapshot?.id) {
      return farms.find((item) => item.id === activeFarmSnapshot.id) || activeFarmSnapshot;
    }
    return null;
  }

  function showActiveFarmMarker() {
    const farm = getActiveFarmForMarker();
    if (!farm) return;
    clearFarmMarkers();
    addFarmMarker(farm);
  }

  function updateActiveFarm() {
    if (!farmListHost) return;
    farmListHost.querySelectorAll(".farm-list__item").forEach((item) => {
      item.classList.toggle("is-active", item.dataset.farmId === currentFarmId);
    });
  }

  function openFarmPanel() {
    if (!farmSearchPanel) return;
    farmSearchPanel.classList.add("is-open");
    farmSearchPanel.setAttribute("aria-hidden", "false");
    farmSearchPanel.removeAttribute("inert");
    if (farmSearchHost) farmSearchHost.classList.add("is-open");
  }

  function closeFarmPanel() {
    if (!farmSearchPanel) return;
    const activeEl = document.activeElement;
    if (activeEl && farmSearchPanel.contains(activeEl)) {
      if (farmSearchInput) {
        farmSearchInput.focus();
      } else if (typeof activeEl.blur === "function") {
        activeEl.blur();
      }
    }
    farmSearchPanel.classList.remove("is-open");
    farmSearchPanel.setAttribute("aria-hidden", "true");
    farmSearchPanel.setAttribute("inert", "");
    if (farmSearchHost) farmSearchHost.classList.remove("is-open");
  }

  function selectFarm(farmId) {
    const farm = farms.find((item) => item.id === farmId);
    if (!farm) return;
    currentFarmId = farmId;
    setActiveFarmSnapshot(farm);
    clearFarmMarkers();
    addFarmMarker(farm);
    if (window.icMap) {
      window.icMap.setView([farm.lat, farm.lng], 16);
    }
    const marker = farmMarkers.get(farmId);
    if (marker) marker.openPopup();
    if (mapCardTitle) mapCardTitle.textContent = farm.name;
    if (farmSearchInput) {
      farmSearchInput.value = `512 - ${farm.name}`;
      farmSearchInput.dataset.selected = farmId;
    }
    if (farmSearchHost) farmSearchHost.classList.add("has-selection");
    updateActiveFarm();
    applyFarmGeo(farm);
    renderEquipmentPanels(farm);
    if (window.IcMapRenderPivots) window.IcMapRenderPivots(farm);
    window.dispatchEvent(new CustomEvent("ic:farm-changed", { detail: { farm } }));
    closeFarmPanel();
  }

  function renderFarmList(filter = "") {
    if (!farmListHost) return;
    farmListHost.innerHTML = "";
    const term = filter.trim().toLowerCase();
    const filtered = farms.filter((farm) => farm.name.toLowerCase().includes(term));

    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "farm-list__empty";
      empty.textContent = term ? "Nenhuma fazenda encontrada." : "Nenhuma fazenda cadastrada.";
      farmListHost.appendChild(empty);
      return;
    }

    filtered.forEach((farm) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "farm-list__item";
      btn.dataset.farmId = farm.id;

      const dot = document.createElement("span");
      dot.className = "farm-list__dot";

      const name = document.createElement("span");
      name.className = "farm-list__name";
      name.textContent = `512 - ${farm.name}`;

      btn.append(dot, name);
      btn.addEventListener("click", () => selectFarm(farm.id));
      farmListHost.appendChild(btn);
    });

    updateActiveFarm();
  }

  function initFarmList() {
    if (!farmListHost && !window.icMap) return;
    loadFarms();
    if (!currentFarmId) {
      if (farms.length) {
        selectFarm(farms[0].id);
      } else {
        clearEquipmentPanels();
        window.IcMapClearPivots?.();
        clearFarmMarkers();
      }
    }
    renderFarmList(farmSearchInput ? farmSearchInput.value : "");
    if (farmSearchInput) {
      farmSearchInput.addEventListener("focus", () => {
        openFarmPanel();
        renderFarmList(farmSearchInput.value);
        farmSearchInput.select();
      });
      farmSearchInput.addEventListener("click", () => {
        openFarmPanel();
        renderFarmList(farmSearchInput.value);
        farmSearchInput.select();
      });
      farmSearchInput.addEventListener("input", (e) => {
        openFarmPanel();
        renderFarmList(e.target.value);
        clearFarmSelection();
      });
      farmSearchInput.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeFarmPanel();
      });
    }

    document.addEventListener("click", (e) => {
      if (!farmSearchHost) return;
      if (!farmSearchHost.contains(e.target)) closeFarmPanel();
    });
  }

  function addFarmFromWizard() {
    const name = (farmState.name || "").trim() || "Nova fazenda";
    const lat = Number(farmState.lat);
    const lng = Number(farmState.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const farm = {
      id: `farm_${Date.now()}`,
      name,
      lat,
      lng,
    };

    farms.push(farm);
    saveFarms();
    addFarmMarker(farm);
    renderFarmList(farmSearchInput ? farmSearchInput.value : "");
    selectFarm(farm.id);
  }

  function collectBillingState(root) {
    if (!root) return;
    const countrySelect = root.querySelector("[data-country]");
    farmBillingState.country = countrySelect?.value || farmBillingState.country || "";
    farmBillingState.postal = root.querySelector('[data-field="postal"] [data-input]')?.value || "";
    farmBillingState.city = root.querySelector('[data-field="city"] [data-input]')?.value || "";
    farmBillingState.address = root.querySelector('[data-field="address"] [data-input]')?.value || "";
    farmBillingState.neighborhood = root.querySelector('[data-field="neighborhood"] [data-input]')?.value || "";
    farmBillingState.region = root.querySelector("[data-region-input]")?.value || "";
    farmBillingState.regionCode = root.querySelector("[data-region-select]")?.value || "";
  }

  function applyBillingState(root) {
    if (!root) return;
    const countrySelect = root.querySelector("[data-country]");
    const country = farmBillingState.country || countrySelect?.value || "";
    if (countrySelect) {
      countrySelect.value = country;
      refreshFarmSelect(countrySelect);
    }
    if (!country) return;
    applyBillingRules(root, country);

    const setValue = (selector, value) => {
      const el = root.querySelector(selector);
      if (el) el.value = value || "";
    };

    setValue('[data-field="postal"] [data-input]', farmBillingState.postal);
    setValue('[data-field="city"] [data-input]', farmBillingState.city);
    setValue('[data-field="address"] [data-input]', farmBillingState.address);
    setValue('[data-field="neighborhood"] [data-input]', farmBillingState.neighborhood);

    const regionSelect = root.querySelector("[data-region-select]");
    const regionInput = root.querySelector("[data-region-input]");
    if (regionSelect && !regionSelect.classList.contains("is-hidden")) {
      regionSelect.value = farmBillingState.regionCode || farmBillingState.region || "";
      refreshFarmSelect(regionSelect);
    } else if (regionInput) {
      regionInput.value = farmBillingState.region || farmBillingState.regionCode || "";
    }
  }

  function clearContactAddress(root) {
    if (!root) return;
    const clearValue = (selector) => {
      const el = root.querySelector(selector);
      if (el) el.value = "";
    };
    clearValue('[data-field="postal"] [data-input]');
    clearValue('[data-field="city"] [data-input]');
    clearValue('[data-field="address"] [data-input]');
    clearValue('[data-field="neighborhood"] [data-input]');

    const regionSelect = root.querySelector("[data-region-select]");
    const regionInput = root.querySelector("[data-region-input]");
    if (regionSelect) {
      regionSelect.value = "";
      refreshFarmSelect(regionSelect);
    }
    if (regionInput) regionInput.value = "";
  }

  function applyBillingRules(root, countryCode) {
    const rules = BILLING_RULES[countryCode] || DEFAULT_BILLING;
    const countryField = root.querySelector('[data-field="country"]');
    const addressField = root.querySelector('[data-field="address"]');
    const cityField = root.querySelector('[data-field="city"]');
    const postalField = root.querySelector('[data-field="postal"]');
    const neighborhoodField = root.querySelector('[data-field="neighborhood"]');
    const regionField = root.querySelector('[data-field="region"]');
    const regionInput = root.querySelector("[data-region-input]");
    const regionSelect = root.querySelector("[data-region-select]");
    const docTypeSelect = root.querySelector("[data-doc-type]");

    setFieldState(countryField, rules.fields.country);
    setFieldState(addressField, rules.fields.address);
    setFieldState(cityField, rules.fields.city);
    setFieldState(postalField, rules.fields.postal);
    setFieldState(neighborhoodField, rules.fields.neighborhood);

    if (regionField) {
      setHidden(regionField, !rules.fields.region.show);
      const labelText = regionField.querySelector("[data-label-text]");
      setText(labelText, rules.fields.region.label);
      const useSelect = rules.fields.region.type === "select";
      setControlState(regionInput, rules.fields.region.show && !useSelect);
      setControlState(regionSelect, rules.fields.region.show && useSelect);
      if (useSelect) {
        const options = countryCode === "US" ? US_STATE_CODES : [];
        buildSelectOptions(regionSelect, options, rules.regionSelectPlaceholder);
        if (regionSelect) {
          regionSelect.required = !!rules.fields.region.required && rules.fields.region.show;
        }
      } else if (regionInput) {
        regionInput.placeholder = rules.fields.region.placeholder || "";
        regionInput.required = !!rules.fields.region.required && rules.fields.region.show;
      }
    }

    if (docTypeSelect) {
      buildSelectOptions(docTypeSelect, rules.docTypes || DEFAULT_BILLING.docTypes, null);
      docTypeSelect.selectedIndex = 0;
      refreshFarmSelect(docTypeSelect);
    }
  }

  function bindBillingForm(rootEl, options = {}) {
    const root = rootEl || bodyHost.querySelector("[data-farm-billing]");
    if (!root) return;
    const countrySelect = root.querySelector("[data-country]");
    const detailsBlocks = root.querySelectorAll("[data-billing-details]");
    if (!countrySelect) return;

    const setDetailsState = (show) => {
      root.classList.toggle("is-country-selected", show);
      detailsBlocks.forEach((block) => {
        setHidden(block, !show);
        block.querySelectorAll("input, select").forEach((el) => {
          el.disabled = !show;
        });
      });
    };

    const apply = () => {
      const hasCountry = !!countrySelect.value;
      setDetailsState(hasCountry);
      if (hasCountry) {
        applyBillingRules(root, countrySelect.value);
      }
    };

    countrySelect.addEventListener("change", apply);
    if (options.applyState) {
      applyBillingState(root);
      apply();
    } else {
      apply();
    }

    if (options.syncState) {
      const update = () => collectBillingState(root);
      root.addEventListener("input", update);
      root.addEventListener("change", update);
      update();
    }
  }

  function bindContactForm() {
    const root = bodyHost.querySelector("[data-farm-contact]");
    if (!root) return;
    const countrySelect = root.querySelector("[data-country]");
    const addressGrid = root.querySelector("[data-contact-address]");
    const toggle = root.querySelector("[data-contact-same]");
    const detailsBlocks = root.querySelectorAll("[data-contact-details]");
    if (!countrySelect || !addressGrid) return;

    bindBillingForm(root);

    const setDetailsState = (show) => {
      root.classList.toggle("is-country-selected", show);
      detailsBlocks.forEach((block) => {
        setHidden(block, !show);
        block.querySelectorAll("input, select").forEach((el) => {
          el.disabled = !show;
        });
      });
    };

    function setAddressEnabled(enabled) {
      addressGrid.querySelectorAll("input, select").forEach((el) => {
        const isHidden = el.classList.contains("is-hidden") || el.closest(".is-hidden");
        if (!enabled) {
          el.disabled = true;
        } else {
          el.disabled = !!isHidden;
        }
      });
    }

    const applyUseBilling = () => {
      if (!toggle) return;
      farmContactState.useBillingAddress = toggle.checked;
      if (toggle.checked) {
        if (!countrySelect.value && farmBillingState.country) {
          countrySelect.value = farmBillingState.country;
          refreshFarmSelect(countrySelect);
        }
        setDetailsState(!!countrySelect.value);
        applyBillingState(root);
        setAddressEnabled(false);
      } else {
        setAddressEnabled(true);
        clearContactAddress(root);
      }
    };

    const updateDetails = () => {
      const hasCountry = !!countrySelect.value;
      setDetailsState(hasCountry);
      if (hasCountry) {
        applyBillingRules(root, countrySelect.value);
      }
      if (toggle && toggle.checked) {
        applyUseBilling();
      }
    };

    if (toggle) {
      toggle.checked = farmContactState.useBillingAddress;
      toggle.addEventListener("change", applyUseBilling);
      applyUseBilling();
    }

    countrySelect.addEventListener("change", updateDetails);
    updateDetails();
  }

  function bindEnergyStep() {
    const cards = bodyHost.querySelectorAll("[data-energy-card]");
    if (!cards.length) return;
    cards.forEach((card) => {
      card.addEventListener("click", () => {
        cards.forEach((item) => {
          item.classList.remove("is-selected");
          item.setAttribute("aria-pressed", "false");
        });
        card.classList.add("is-selected");
        card.setAttribute("aria-pressed", "true");
      });
    });
  }

  function bindGeneralStep() {
    const nameInput = bodyHost.querySelector("[data-farm-name]");
    if (!nameInput) return;
    nameInput.value = farmState.name || "";
    nameInput.addEventListener("input", () => {
      farmState.name = nameInput.value;
    });
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
    const input = bodyHost.querySelector("[data-location-input]");
    const button = bodyHost.querySelector("[data-location-btn]");
    const radiusInput = bodyHost.querySelector("[data-location-radius]");
    const radiusEditBtn = bodyHost.querySelector("[data-radius-edit]");
    const mapEl = bodyHost.querySelector("[data-location-map]");

    if (radiusInput) {
      radiusInput.value = farmState.radius || "";
      radiusInput.disabled = true;
      radiusInput.addEventListener("input", () => {
        farmState.radius = radiusInput.value;
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
    if (!farmState.loc) {
      const initial = parsed || { lat: farmState.lat, lng: farmState.lng };
      farmState.loc = `${initial.lat.toFixed(6)}, ${initial.lng.toFixed(6)}`;
      input.value = farmState.loc;
    }

    const applyLocation = (lat, lng, setView = true) => {
      farmState.lat = lat;
      farmState.lng = lng;
      farmState.loc = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      input.value = farmState.loc;
      if (farmLocationMarker) {
        farmLocationMarker.setLatLng([lat, lng]);
      }
      if (farmLocationMap && setView) {
        farmLocationMap.setView([lat, lng], farmLocationMap.getZoom());
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
            if (farmLocationMap) farmLocationMap.setZoom(16);
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

    if (farmLocationMap) {
      try {
        farmLocationMap.remove();
      } catch (e) {
        // no-op
      }
      farmLocationMap = null;
    }

    const center = parsed || { lat: farmState.lat, lng: farmState.lng };
    farmLocationMap = L.map(mapEl, { zoomControl: true, attributionControl: false })
      .setView([center.lat, center.lng], 16);

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, attribution: "Tiles © Esri" }
    ).addTo(farmLocationMap);

    L.tileLayer(
      "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, opacity: 0.85 }
    ).addTo(farmLocationMap);

    const icon = getFarmMarkerIcon();
    farmLocationMarker = L.marker([center.lat, center.lng], icon ? { icon } : undefined).addTo(farmLocationMap);

    farmLocationMap.on("click", (e) => {
      applyLocation(e.latlng.lat, e.latlng.lng, false);
    });

    setTimeout(() => farmLocationMap.invalidateSize(), 120);
  }

  function renderSteps() {
    stepsContainer.innerHTML = "";
    steps.forEach((label, index) => {
      const stepEl = document.createElement("div");
      stepEl.className = "create-equip__step";
      if (index === currentStepIndex) stepEl.classList.add("create-equip__step--active");

      const numEl = document.createElement("span");
      numEl.className = "create-equip__step-num";
      numEl.textContent = String(index + 1);

      const labelEl = document.createElement("span");
      labelEl.className = "create-equip__step-label";
      labelEl.textContent = label;

      stepEl.append(numEl, labelEl);
      stepsContainer.appendChild(stepEl);
    });
  }

  function updateFooterLayout() {
    if (!prevBtn || !footer) return;
    const showPrev = currentStepIndex > 0;
    prevBtn.style.display = showPrev ? "" : "none";
    footer.classList.toggle("no-prev", !showPrev);
  }

  function setButtons() {
    const isLast = currentStepIndex === steps.length - 1;
    nextBtn.textContent = isLast ? "Finalizar" : "Próximo";
  }

  function renderPlaceholder(label) {
    bodyHost.innerHTML = `
      <div style="padding:14px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;">
        <strong>${label}</strong><br/>
        <span style="color:#6b7280;">Conteúdo em construção.</span>
      </div>
    `;
  }

  function renderStepContent() {
    const label = steps[currentStepIndex];
    const stepKeyMap = {
      "Geral": "geral",
      "Faturamento": "billing",
      "Contato": "contact",
      "Faixas de Energia": "energy",
      "Localização": "location",
      "Localização": "location",
    };
    const stepKey = stepKeyMap[label] || label;
    renderSteps();
    setButtons();
    updateFooterLayout();

    if (stepKey === "geral") {
      bodyHost.innerHTML = `
        <div class="equip-wizard__head">
          <div class="equip-wizard__title"></div>
          <div class="equip-wizard__subtitle"></div>
        </div>
        <div class="equip-form">
          <div class="equip-field">
            <label class="equip-label" for="farmNameInput"><span class="equip-required">*</span>Nome da fazenda</label>
            <input class="equip-input" id="farmNameInput" type="text" placeholder="Recanto da Serra" data-farm-name />
          </div>

          <div class="equip-form__row">
            <div class="equip-field">
              <label class="equip-label" for="farmEnergyBillDay"><span class="equip-required">*</span>Dia da fatura de energia</label>
              <input class="equip-input" id="farmEnergyBillDay" type="number" min="1" max="31" inputmode="numeric" placeholder="1" />
            </div>
            <div class="equip-field">
              <label class="equip-label" for="farmWaterBillDay"><span class="equip-required">*</span>Dia da fatura de água</label>
              <input class="equip-input" id="farmWaterBillDay" type="number" min="1" max="31" inputmode="numeric" placeholder="1" />
            </div>
          </div>

          <label class="equip-check">
            <input class="equip-check__input" id="farmHasCentral" type="checkbox" />
            <span>A fazenda possui Central?</span>
          </label>

          <div class="equip-field">
            <label class="equip-label" for="farmTimezoneSelect"><span class="equip-required">*</span>Fuso horário</label>
            <select class="equip-input" id="farmTimezoneSelect">
              <option value="Africa/Abidjan">África/Abidjan (GMT+00)</option>
              <option value="America/Sao_Paulo">América/Sao_Paulo (GMT-03)</option>
              <option value="America/Cuiaba">América/Cuiabá (GMT-04)</option>
              <option value="America/Manaus">América/Manaus (GMT-04)</option>
              <option value="America/Rio_Branco">América/Rio Branco (GMT-05)</option>
              <option value="UTC">UTC (GMT+00)</option>
            </select>
          </div>
        </div>
      `;
      bindGeneralStep();
      initFarmSelects(bodyHost);
      return;
    }

    if (stepKey === "billing") {
      bodyHost.innerHTML = `
        <div class="farm-billing" data-farm-billing>
          <div class="farm-billing__intro">
            <div class="equip-alert farm-billing__alert" role="note">
              <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
              <span>As informa\u00e7\u00f5es devem ser do cliente!</span>
            </div>
            <p class="farm-billing__hint">
              Essas informa\u00e7\u00f5es ser\u00e3o utilizadas para emitir faturas relacionadas ao uso da plataforma Irricontrol.
            </p>
          </div>

          <section class="farm-billing__section">
            <header class="farm-billing__section-head">
              <h4 class="farm-billing__section-title">Endere\u00e7o de Faturamento</h4>
            </header>

            <div class="equip-form farm-billing__grid farm-billing__grid--country">
              <div class="equip-field farm-billing__field" data-field="country">
                <label class="equip-label" for="farmBillingCountry">
                  <span class="equip-required">*</span>
                  <span data-label-text>Pa\u00eds</span>
                </label>
                <select class="equip-input" id="farmBillingCountry" name="billing_country" data-country data-input required>
                  <option value="">Selecione o pa\u00eds</option>
                  <option value="BR">Brasil</option>
                  <option value="US">Estados Unidos</option>
                  <option value="DE">Alemanha</option>
                  <option value="ZA">\u00c1frica do Sul</option>
                </select>
              </div>

              <div class="equip-field farm-billing__field" data-field="postal" data-billing-details>
                <label class="equip-label" for="farmBillingPostal">
                  <span class="equip-required">*</span>
                  <span data-label-text>CEP</span>
                </label>
                <input class="equip-input" id="farmBillingPostal" name="billing_postal_code" data-input type="text" placeholder="00000-000" required />
              </div>

              <div class="equip-field farm-billing__field" data-field="city" data-billing-details>
                <label class="equip-label" for="farmBillingCity">
                  <span class="equip-required">*</span>
                  <span data-label-text>Cidade</span>
                </label>
                <input class="equip-input" id="farmBillingCity" name="billing_city" data-input type="text" placeholder="Ex: Goi\u00e2nia" required />
              </div>
            </div>

            <div class="farm-billing__details is-hidden" data-billing-details>
              <div class="equip-form farm-billing__grid farm-billing__grid--address">
                <div class="equip-field farm-billing__field farm-billing__field--span-2" data-field="address">
                  <label class="equip-label" for="farmBillingAddress">
                    <span class="equip-required">*</span>
                    <span data-label-text>Endere\u00e7o</span>
                  </label>
                  <input class="equip-input" id="farmBillingAddress" name="billing_address" data-input type="text" placeholder="Ex: Av. Brasil, 120" required />
                </div>

                <div class="equip-field farm-billing__field" data-field="region">
                  <label class="equip-label" for="farmBillingRegion">
                    <span class="equip-required">*</span>
                    <span data-label-text>Estado (UF)</span>
                  </label>
                  <input class="equip-input farm-billing__control" id="farmBillingRegion" name="billing_region" data-region-input type="text" placeholder="Ex: SP" />
                  <select class="equip-input farm-billing__control" id="farmBillingRegionSelect" name="billing_region_code" data-region-select></select>
                </div>

                <div class="equip-field farm-billing__field" data-field="neighborhood">
                  <label class="equip-label" for="farmBillingNeighborhood">
                    <span data-label-text>Bairro</span>
                  </label>
                  <input class="equip-input" id="farmBillingNeighborhood" name="billing_neighborhood" data-input type="text" placeholder="Opcional" />
                </div>
              </div>
            </div>
          </section>

          <section class="farm-billing__section farm-billing__details is-hidden" data-billing-details>
            <header class="farm-billing__section-head">
              <h4 class="farm-billing__section-title">Informa\u00e7\u00f5es de Faturamento</h4>
            </header>

            <div class="equip-form farm-billing__grid farm-billing__grid--billing-top">
              <div class="equip-field farm-billing__field farm-billing__field--span-2" data-field="docGroup">
                <label class="equip-label" for="farmBillingDocType">
                  <span class="equip-required">*</span>
                  <span data-label-text>Documento</span>
                </label>
                <div class="farm-billing__doc">
                  <select class="equip-input" id="farmBillingDocType" name="billing_document_type" data-doc-type aria-label="Tipo de documento" required></select>
                  <input class="equip-input" id="farmBillingDocNumber" name="billing_document_number" type="text" placeholder="000.000.000-00" aria-label="N\u00famero do documento" required />
                </div>
              </div>

              <div class="equip-field farm-billing__field" data-field="legalName">
                <label class="equip-label" for="farmBillingName">
                  <span class="equip-required">*</span>
                  <span data-label-text>Nome completo</span>
                </label>
                <input class="equip-input" id="farmBillingName" name="billing_legal_name" type="text" placeholder="Nome completo" required />
              </div>
            </div>

            <div class="equip-form farm-billing__grid farm-billing__grid--billing-bottom">
              <div class="equip-field farm-billing__field" data-field="phone">
                <label class="equip-label" for="farmBillingPhone">
                  <span class="equip-required">*</span>
                  <span data-label-text>Celular</span>
                </label>
                <input class="equip-input" id="farmBillingPhone" name="billing_phone" type="tel" placeholder="(00) 00000-0000" required />
              </div>

              <div class="equip-field farm-billing__field" data-field="email">
                <label class="equip-label" for="farmBillingEmail">
                  <span class="equip-required">*</span>
                  <span data-label-text>E-mail</span>
                </label>
                <input class="equip-input" id="farmBillingEmail" name="billing_email" type="email" placeholder="exemplo@mail.com.br" required />
              </div>
            </div>
          </section>
        </div>
      `;
      bindBillingForm(null, { applyState: true, syncState: true });
      initFarmSelects(bodyHost);
      return;
    }

    if (stepKey === "contact") {
      bodyHost.innerHTML = `
        <div class="farm-billing farm-contact" data-farm-contact>
          <section class="farm-billing__section">
            <header class="farm-billing__section-head">
              <h4 class="farm-billing__section-title">Endere\u00e7o de Contato</h4>
            </header>

            <div class="farm-billing__details farm-contact__toggle is-hidden" data-contact-details>
              <label class="farm-switch">
                <input class="farm-switch__input" id="farmContactSame" type="checkbox" data-contact-same />
                <span class="farm-switch__track" aria-hidden="true"></span>
                <span class="farm-switch__label">Mesmo do endere\u00e7o de faturamento</span>
              </label>
            </div>

            <div class="equip-form farm-billing__grid farm-billing__grid--country">
              <div class="equip-field farm-billing__field" data-field="country">
                <label class="equip-label" for="farmContactCountry">
                  <span class="equip-required">*</span>
                  <span data-label-text>Pa\u00eds</span>
                </label>
                <select class="equip-input" id="farmContactCountry" name="contact_country" data-country data-input required>
                  <option value="">Selecione o pa\u00eds</option>
                  <option value="BR">Brasil</option>
                  <option value="US">Estados Unidos</option>
                  <option value="DE">Alemanha</option>
                  <option value="ZA">\u00c1frica do Sul</option>
                </select>
              </div>

              <div class="equip-field farm-billing__field" data-field="postal" data-contact-details>
                <label class="equip-label" for="farmContactPostal">
                  <span class="equip-required">*</span>
                  <span data-label-text>CEP</span>
                </label>
                <input class="equip-input" id="farmContactPostal" name="contact_postal_code" data-input type="text" placeholder="00000-000" required />
              </div>

              <div class="equip-field farm-billing__field" data-field="city" data-contact-details>
                <label class="equip-label" for="farmContactCity">
                  <span class="equip-required">*</span>
                  <span data-label-text>Cidade</span>
                </label>
                <input class="equip-input" id="farmContactCity" name="contact_city" data-input type="text" placeholder="Ex: Goi\u00e2nia" required />
              </div>
            </div>

            <div class="farm-billing__details is-hidden" data-contact-details>
              <div class="equip-form farm-billing__grid farm-billing__grid--address" data-contact-address>
                <div class="equip-field farm-billing__field farm-billing__field--span-2" data-field="address">
                  <label class="equip-label" for="farmContactAddress">
                    <span class="equip-required">*</span>
                    <span data-label-text>Endere\u00e7o</span>
                  </label>
                  <input class="equip-input" id="farmContactAddress" name="contact_address" data-input type="text" placeholder="Ex: Av. Brasil, 120" required />
                </div>

                <div class="equip-field farm-billing__field" data-field="region">
                  <label class="equip-label" for="farmContactRegion">
                    <span class="equip-required">*</span>
                    <span data-label-text>Estado (UF)</span>
                  </label>
                  <input class="equip-input farm-billing__control" id="farmContactRegion" name="contact_region" data-region-input type="text" placeholder="Ex: SP" />
                  <select class="equip-input farm-billing__control" id="farmContactRegionSelect" name="contact_region_code" data-region-select></select>
                </div>

                <div class="equip-field farm-billing__field" data-field="neighborhood">
                  <label class="equip-label" for="farmContactNeighborhood">
                    <span data-label-text>Bairro</span>
                  </label>
                  <input class="equip-input" id="farmContactNeighborhood" name="contact_neighborhood" data-input type="text" placeholder="Opcional" />
                </div>
              </div>
            </div>
          </section>

          <section class="farm-billing__section farm-billing__details is-hidden" data-contact-details>
            <header class="farm-billing__section-head">
              <h4 class="farm-billing__section-title">Informa\u00e7\u00f5es de Contato</h4>
            </header>

            <div class="equip-form farm-billing__grid">
              <div class="equip-field farm-billing__field" data-field="phone">
                <label class="equip-label" for="farmContactPhone">
                  <span class="equip-required">*</span>
                  <span data-label-text>Celular</span>
                </label>
                <input class="equip-input" id="farmContactPhone" name="contact_phone" type="tel" placeholder="+55 (00) 90000-0000" required />
              </div>
              <div class="equip-field farm-billing__field" data-field="email">
                <label class="equip-label" for="farmContactEmail">
                  <span data-label-text>E-mail</span>
                </label>
                <input class="equip-input" id="farmContactEmail" name="contact_email" type="email" placeholder="contato@email.com" />
              </div>
            </div>
          </section>
        </div>
      `;
      bindContactForm();
      initFarmSelects(bodyHost);
      return;
    }

    if (stepKey === "energy") {
      bodyHost.innerHTML = `
        <div class="farm-energy">
          <div class="farm-energy__note" role="note">
            Faixas de energia s\u00e3o per\u00edodos espec\u00edficos durante o dia nos quais o custo da energia el\u00e9trica pode variar. Voc\u00ea pode personalizar as faixas da sua fazenda no menu de configura\u00e7\u00f5es.
          </div>

          <p class="farm-energy__lead">
            Selecione o padr\u00e3o que melhor te atende baseado nas faixas de energia por hor\u00e1rio da sua regi\u00e3o
          </p>

          <div class="farm-energy__grid">
            <button class="farm-energy__card" type="button" data-energy-card aria-pressed="false">
              <span class="farm-energy__card-title">Ponta entre 17:00 e 20:00</span>
              <span class="farm-energy__card-desc">Define hor\u00e1rio de ponta entre 17:00 e 20:00 durante dias \u00fateis.</span>
            </button>

            <button class="farm-energy__card" type="button" data-energy-card aria-pressed="false">
              <span class="farm-energy__card-title">Ponta entre 18:00 e 21:00</span>
              <span class="farm-energy__card-desc">Define hor\u00e1rio de ponta entre 18:00 e 21:00 durante dias \u00fateis.</span>
            </button>

            <button class="farm-energy__card is-selected" type="button" data-energy-card aria-pressed="true">
              <span class="farm-energy__card-title">Personalizado</span>
              <span class="farm-energy__card-desc">Personalize mais tarde no menu de configura\u00e7\u00f5es da sua fazenda.</span>
            </button>
          </div>
        </div>
      `;
      bindEnergyStep();
      return;
    }

    if (stepKey === "location") {
      bodyHost.innerHTML = `
        <div class="farm-location">
          <div class="farm-location__row">
            <div class="equip-field farm-location__field">
              <label class="equip-label" for="farmLocationInput">
                <span class="equip-required">*</span>
                <span>Localiza\u00e7\u00e3o da fazenda</span>
              </label>
              <div class="farm-location__input">
                <span class="farm-location__icon" aria-hidden="true">
                  <i class="fa-solid fa-location-dot"></i>
                </span>
                <input
                  class="equip-input farm-location__input-field"
                  id="farmLocationInput"
                  name="farm_location"
                  type="text"
                  placeholder="-22.008419, -46.812567"
                  data-location-input
                  required
                />
              </div>
            </div>

            <button class="equip-btn equip-btn--primary farm-location__btn" type="button" data-location-btn>
              <i class="fa-solid fa-location-crosshairs" aria-hidden="true"></i>
              <span>Obter Localiza\u00e7\u00e3o</span>
            </button>
          </div>

          <div class="farm-location__radius">
            <div class="farm-location__radius-head">
              <span>Radio da central</span>
              <button class="farm-location__radius-edit" type="button" aria-label="Editar raio" data-radius-edit>
                <i class="fa-solid fa-pen"></i>
              </button>
            </div>
            <input
              class="equip-input"
              type="text"
              name="farm_radius"
              placeholder="0000000000000000"
              data-location-radius
            />
          </div>

          <div class="farm-location__map" data-location-map></div>
        </div>
      `;
      bindLocationStep();
      return;
    }

    renderPlaceholder(label);
  }

  function goNext() {
    if (currentStepIndex >= steps.length - 1) {
      addFarmFromWizard();
      closeModal();
      return;
    }
    currentStepIndex++;
    renderStepContent();
  }

  function goPrev() {
    if (currentStepIndex === 0) return;
    currentStepIndex--;
    renderStepContent();
  }

  function openModal() {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-modal-open");
    farmState.name = "";
    farmState.loc = "";
    farmState.lat = -22.008419;
    farmState.lng = -46.812567;
    farmState.radius = "";
    currentStepIndex = 0;
    renderStepContent();
  }

  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-modal-open");
  }

  initFarmList();

  openBtn.addEventListener("click", openModal);
  closeTriggers.forEach((t) => t.addEventListener("click", closeModal));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
  });

  nextBtn.addEventListener("click", goNext);
  if (prevBtn) prevBtn.addEventListener("click", goPrev);

  window.IcFarmsAddEquipment = addEquipmentToFarm;
  window.IcFarmApplyGeo = applyFarmGeo;
  window.IcFarmHideMarkers = clearFarmMarkers;
  window.IcFarmShowMarker = showActiveFarmMarker;
  window.IcFarmGetActive = getActiveFarmForMarker;
  window.IcFarmsRenderEquipment = () => {
    const farm = farms.find((item) => item.id === currentFarmId) || farms[0];
    if (farm) renderEquipmentPanels(farm);
  };
})();
