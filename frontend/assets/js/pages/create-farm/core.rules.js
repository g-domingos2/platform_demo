// assets/js/pages/create-farm/core.rules.js
(function initCreateFarmRules() {
  "use strict";

  const CreateFarm = (window.CreateFarm = window.CreateFarm || {});
  const rules = (CreateFarm.rules = CreateFarm.rules || {});
  const helpers = (CreateFarm.helpers = CreateFarm.helpers || {});
  const events = (CreateFarm.events = CreateFarm.events || {});

  const BILLING_RULES = {
    BR: {
      fields: {
        country: {
          label: "País",
          placeholder: "",
          required: true,
          show: true,
        },
        address: {
          label: "Endereço",
          placeholder: "Ex: Av. Brasil, 120",
          required: true,
          show: true,
        },
        city: {
          label: "Cidade",
          placeholder: "Ex: Goiânia",
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
          type: "select",
        },
        neighborhood: {
          label: "Bairro",
          placeholder: "Opcional",
          required: false,
          show: false,
        },
      },
      docTypes: [
        { value: "cpf", label: "CPF (Cadastro de Pessoa Física)" },
        { value: "cnpj", label: "CNPJ (Cadastro Nacional da Pessoa Jurídica)" },
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

  const BR_STATE_CODES = [
    { value: "AC", label: "Acre" },
    { value: "AL", label: "Alagoas" },
    { value: "AP", label: "Amapá" },
    { value: "AM", label: "Amazonas" },
    { value: "BA", label: "Bahia" },
    { value: "CE", label: "Ceará" },
    { value: "DF", label: "Distrito Federal" },
    { value: "ES", label: "Espírito Santo" },
    { value: "GO", label: "Goiás" },
    { value: "MA", label: "Maranhão" },
    { value: "MT", label: "Mato Grosso" },
    { value: "MS", label: "Mato Grosso do Sul" },
    { value: "MG", label: "Minas Gerais" },
    { value: "PA", label: "Pará" },
    { value: "PB", label: "Paraíba" },
    { value: "PR", label: "Paraná" },
    { value: "PE", label: "Pernambuco" },
    { value: "PI", label: "Piauí" },
    { value: "RJ", label: "Rio de Janeiro" },
    { value: "RN", label: "Rio Grande do Norte" },
    { value: "RS", label: "Rio Grande do Sul" },
    { value: "RO", label: "Rondônia" },
    { value: "RR", label: "Roraima" },
    { value: "SC", label: "Santa Catarina" },
    { value: "SP", label: "São Paulo" },
    { value: "SE", label: "Sergipe" },
    { value: "TO", label: "Tocantins" },
  ];

  const EQUIP_CATEGORY_BY_TYPE = {
    smart_connect: "pivos",
    smarttouch: "pivos",
    irripump: "bombas",
    medidor: "medidores",
    pluviometro: "pluviometros",
    repetidora: "repetidoras",
    rainstar: "carreteis",
    linestar: "carreteis",
    estacao_metereologica: "estacoes",
    cosmofield: "cosmofields",
  };

  const EQUIP_LABEL_BY_TYPE = {
    smart_connect: "Pivô",
    smarttouch: "Pivô",
    irripump: "Bomba",
    medidor: "Medidor",
    pluviometro: "Pluviômetro",
    repetidora: "Repetidora",
    rainstar: "Carretel",
    linestar: "LineStar",
    estacao_metereologica: "Estação",
    cosmofield: "Cosmofield",
  };

  const FARM_STORAGE_KEY = "ic_farms";

  const FARM_API_URL = `${window.IC_API_CONFIG?.baseUrl || ""}/api/farms`;

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
    return window.IcNumeric.toFiniteNumber(value);
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
        const defaultBase = window.Plv?.data?.getDefaultPluvioBaseCoords?.(p);
        const lat = Number.isFinite(defaultBase?.lat)
          ? defaultBase.lat
          : Number.isFinite(p.__baseLat)
            ? p.__baseLat
            : p.lat;
        const lng = Number.isFinite(defaultBase?.lng)
          ? defaultBase.lng
          : Number.isFinite(p.__baseLng)
            ? p.__baseLng
            : p.lng;
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
    if (events.refreshFarmSelect) events.refreshFarmSelect(select);
  }

  function applyBillingRules(root, countryCode) {
    const rulesConfig = BILLING_RULES[countryCode] || DEFAULT_BILLING;
    const countryField = root.querySelector('[data-field="country"]');
    const addressField = root.querySelector('[data-field="address"]');
    const cityField = root.querySelector('[data-field="city"]');
    const postalField = root.querySelector('[data-field="postal"]');
    const neighborhoodField = root.querySelector('[data-field="neighborhood"]');
    const regionField = root.querySelector('[data-field="region"]');
    const regionInput = root.querySelector("[data-region-input]");
    const regionSelect = root.querySelector("[data-region-select]");
    const docTypeSelect = root.querySelector("[data-doc-type]");

    setFieldState(countryField, rulesConfig.fields.country);
    setFieldState(addressField, rulesConfig.fields.address);
    setFieldState(cityField, rulesConfig.fields.city);
    setFieldState(postalField, rulesConfig.fields.postal);
    setFieldState(neighborhoodField, rulesConfig.fields.neighborhood);

    if (regionField) {
      setHidden(regionField, !rulesConfig.fields.region.show);
      const labelText = regionField.querySelector("[data-label-text]");
      setText(labelText, rulesConfig.fields.region.label);
      const useSelect = rulesConfig.fields.region.type === "select";
      setControlState(regionInput, rulesConfig.fields.region.show && !useSelect);
      setControlState(regionSelect, rulesConfig.fields.region.show && useSelect);
      if (useSelect) {
        const options = countryCode === "US" ? US_STATE_CODES : countryCode === "BR" ? BR_STATE_CODES : [];
        buildSelectOptions(regionSelect, options, rulesConfig.regionSelectPlaceholder);
        if (regionSelect) {
          regionSelect.required = !!rulesConfig.fields.region.required && rulesConfig.fields.region.show;
        }
      } else if (regionInput) {
        regionInput.placeholder = rulesConfig.fields.region.placeholder || "";
        regionInput.required = !!rulesConfig.fields.region.required && rulesConfig.fields.region.show;
      }
    }

    if (docTypeSelect) {
      buildSelectOptions(docTypeSelect, rulesConfig.docTypes || DEFAULT_BILLING.docTypes, null);
      docTypeSelect.selectedIndex = 0;
      if (events.refreshFarmSelect) events.refreshFarmSelect(docTypeSelect);
    }
  }

  rules.BILLING_RULES = BILLING_RULES;
  rules.DEFAULT_BILLING = DEFAULT_BILLING;
  rules.US_STATE_CODES = US_STATE_CODES;
  rules.BR_STATE_CODES = BR_STATE_CODES;
  rules.EQUIP_CATEGORY_BY_TYPE = EQUIP_CATEGORY_BY_TYPE;
  rules.EQUIP_LABEL_BY_TYPE = EQUIP_LABEL_BY_TYPE;
  rules.FARM_STORAGE_KEY = FARM_STORAGE_KEY;
  rules.FARM_API_URL = FARM_API_URL;

  helpers.setHidden = setHidden;
  helpers.setText = setText;
  helpers.formatDateTime = formatDateTime;
  helpers.toNumber = toNumber;
  helpers.formatDecimal = formatDecimal;
  helpers.parseLatLngText = parseLatLngText;
  helpers.getPivotAngleDeg = getPivotAngleDeg;
  helpers.buildMetric = buildMetric;
  helpers.getGeoBaseCenter = getGeoBaseCenter;
  helpers.isPluviometriaActive = isPluviometriaActive;
  helpers.getNextNameForCategory = getNextNameForCategory;
  helpers.isPlainObject = isPlainObject;
  helpers.sanitizeValue = sanitizeValue;
  helpers.sanitizeEquipmentData = sanitizeEquipmentData;
  helpers.setFieldState = setFieldState;
  helpers.setControlState = setControlState;
  helpers.buildSelectOptions = buildSelectOptions;
  helpers.applyBillingRules = applyBillingRules;
})();
