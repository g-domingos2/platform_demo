// assets/js/pages/pluviometria/core.data.js
(function () {
  "use strict";

  const Plv = (window.Plv = window.Plv || {});
  const data = (Plv.data = Plv.data || {});

  if (data.__initialized) return;
  data.__initialized = true;

  const PLUV_EMPTY_START_KEY = "ic_pluvio_empty_start_v2";

  // ======== mock inicial (você troca por API depois) ========
  // ======== mock inicial (você troca por API depois) ========
  const PLUVIOS = [
    {
      id: "norte-a",
      nome: "Pluviômetro Norte A",
      sub: "Talhão 1 - Soja",
      pivos: ["Pivô Norte A", "Pivô Norte B"],
      lat: -16.7672,
      lng: -47.6134,
      status: "rain",
      statusLabel: "Chovendo agora",
      statusMeta: "há 45 min",
      mm: 12.5,
      intensidade: "Moderada",
      intensidadeMeta: "desde 07h",
      updated: "Atualizado há 32 min",
      tipo: "Báscula",
      alimentacao: "Bateria",
      alimentacaoEstado: "OK",
      unidade: "mm",
      uso: { irrigacao: true, alertas: true, relatorios: true },
      model: "Davis",
      radioCentral: "0013A20041F0BC0C",
      radioControlador: "0013A200422E3C4B",
      radioGps: "0013A200422E7D7C",
      battery: 81,
      net: "4G",
      semComunicacao: false,
    },
    {
      id: "norte-b",
      nome: "Pluviômetro Norte B",
      sub: "Talhão 2 - Milho",
      pivos: ["Pivô Norte B"],
      lat: -16.7619,
      lng: -47.6029,
      status: "rain",
      statusLabel: "Chovendo agora",
      statusMeta: "há 12 min",
      mm: 10.8,
      intensidade: "Moderada",
      intensidadeMeta: "desde 18:14",
      updated: "Atualizado há 2 min",
      tipo: "Digital",
      alimentacao: "Bateria",
      alimentacaoEstado: "OK",
      unidade: "mm/h",
      uso: { irrigacao: true, alertas: true, relatorios: true },
      model: "Davis",
      radioCentral: "0013A20041F0BC0C",
      radioControlador: "0013A200422E3C4B",
      radioGps: "0013A200422E7D7C",
      battery: 72,
      net: "RADIO",
      semComunicacao: false,
    },
    {
      id: "sul",
      nome: "Pluviômetro Sul",
      sub: "Talhão 3 - Algodão",
      pivos: ["Pivô Sul"],
      lat: -16.7744,
      lng: -47.6218,
      status: "none",
      statusLabel: "Sem chuva no momento",
      statusMeta: "última chuva há 6h",
      mm: 0.0,
      intensidade: "Sem chuva",
      intensidadeMeta: "desde 07h",
      updated: "Offline há 1 dia",
      tipo: "Estação compacta",
      alimentacao: "Bateria",
      alimentacaoEstado: "Aten\u00e7\u00e3o",
      unidade: "mm",
      uso: { irrigacao: false, alertas: true, relatorios: true },
      model: "Davis",
      radioCentral: "0013A20041F0BC0C",
      radioControlador: "0013A200422E3C4B",
      radioGps: "0013A200422E7D7C",
      battery: 12,
      net: "RADIO",
      semComunicacao: true,
    },
    {
      id: "leste",
      nome: "Pluviômetro Leste",
      sub: "Talhão 4 - Soja",
      pivos: ["Pivô Leste"],
      lat: -16.7698,
      lng: -47.5885,
      status: "none",
      statusLabel: "Sem chuva no momento",
      statusMeta: "última chuva há 6h",
      mm: 5.7,
      intensidade: "Moderada",
      intensidadeMeta: "desde 07h",
      updated: "Atualizado há 29 min",
      tipo: "Báscula",
      alimentacao: "Rede",
      alimentacaoEstado: "OK",
      unidade: "mm",
      uso: { irrigacao: true, alertas: true, relatorios: false },
      model: "Davis",
      radioCentral: "0013A20041F0BC0C",
      radioControlador: "0013A200422E3C4B",
      radioGps: "0013A200422E7D7C",
      battery: 64,
      net: "4G",
      semComunicacao: false,
    },
    {
      id: "oeste",
      nome: "Pluviômetro Oeste",
      sub: "Talhão 5 - Sorgo",
      pivos: ["Pivô Oeste"],
      lat: -16.7583,
      lng: -47.6305,
      status: "dry",
      statusLabel: "Tempo seco",
      statusMeta: "última chuva há 3h",
      mm: 3.4,
      intensidade: "Fraca",
      intensidadeMeta: "desde 08h",
      updated: "Atualizado há 18 min",
      tipo: "Báscula",
      alimentacao: "Bateria",
      alimentacaoEstado: "OK",
      unidade: "mm",
      uso: { irrigacao: true, alertas: true, relatorios: true },
      model: "Davis",
      radioCentral: "0013A20041F0BC0C",
      radioControlador: "0013A200422E3C4B",
      radioGps: "0013A200422E7D7C",
      battery: 88,
      net: "4G",
      semComunicacao: false,
    },
    {
      id: "teste-offline-visual",
      nome: "Pluviômetro Teste Offline",
      sub: "Talhão teste - Visualização",
      pivos: ["Pivô Sudoeste"],
      lat: -16.7711,
      lng: -47.6098,
      status: "none",
      statusLabel: "Sem chuva no momento",
      statusMeta: "última chuva há 1h",
      mm: 1.2,
      intensidade: "Fraca",
      intensidadeMeta: "desde 16:40",
      updated: "Atualizado há 6 min",
      tipo: "Estação compacta",
      alimentacao: "Bateria",
      alimentacaoEstado: "OK",
      unidade: "mm",
      uso: { irrigacao: true, alertas: true, relatorios: true },
      model: "Davis 6465",
      radioCentral: "0013A20041F0BC0C",
      radioControlador: "0013A200422E3C4B",
      radioGps: "0013A200422E7D7C",
      battery: 49,
      net: "4G",
      semComunicacao: false,
    },
  ];

  const DEFAULT_PLUVIOS = PLUVIOS.map((pluvio) => ({
    ...pluvio,
    pivos: Array.isArray(pluvio.pivos) ? [...pluvio.pivos] : [],
    pivosAssoc: Array.isArray(pluvio.pivosAssoc) ? [...pluvio.pivosAssoc] : [],
    uso: pluvio.uso && typeof pluvio.uso === "object" ? { ...pluvio.uso } : {},
  }));

  function slugify(text) {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function normalizeSharedPluvioKey(value) {
    return slugify(value)
      .replace(/^pluviometro-/, "")
      .replace(/^pluviometros-/, "");
  }

  const SHARED_PLUVIO_PROFILES = [
    {
      key: "sul",
      aliases: ["sul"],
      sub: "Chuva - Milho",
      pivos: [],
      status: "none",
      statusLabel: "Sem chuva no momento",
      statusMeta: "sem leitura recente",
      mm: 0.0,
      intensidade: "Sem chuva",
      intensidadeMeta: "sem leitura recente",
      updated: "Offline há 1 dia",
      tipo: "Báscula",
      alimentacao: "Bateria",
      alimentacaoEstado: "Atenção",
      unidade: "mm",
      uso: { irrigacao: false, alertas: true, relatorios: true },
      model: "Davis 6465",
      radioCentral: "0013A20041F0BC0C",
      radioControlador: "0013A200422E3C4B",
      radioGps: "0013A200422E7D7C",
      battery: 14,
      net: "RADIO",
      semComunicacao: true,
    },
    {
      key: "norte",
      aliases: ["norte", "norte-a", "norte-b"],
      sub: "Chuva - Milho",
      pivos: ["Pivô Norte"],
      status: "rain",
      statusLabel: "Chovendo agora",
      statusMeta: "há 18 min",
      mm: 10.8,
      intensidade: "Moderada",
      intensidadeMeta: "desde 18:14",
      updated: "Atualizado há 2 min",
      tipo: "Digital",
      alimentacao: "Bateria",
      alimentacaoEstado: "OK",
      unidade: "mm",
      uso: { irrigacao: true, alertas: true, relatorios: true },
      model: "Davis 6465",
      radioCentral: "0013A20041F0BC0C",
      radioControlador: "0013A200422E3C4B",
      radioGps: "0013A200422E7D7C",
      battery: 76,
      net: "4G",
      semComunicacao: false,
    },
    {
      key: "leste",
      aliases: ["leste"],
      sub: "Chuva - Milho",
      pivos: ["Pivô Leste"],
      status: "none",
      statusLabel: "Sem chuva no momento",
      statusMeta: "última chuva há 6h",
      mm: 5.7,
      intensidade: "Moderada",
      intensidadeMeta: "desde 07h",
      updated: "Atualizado há 29 min",
      tipo: "Báscula",
      alimentacao: "Rede",
      alimentacaoEstado: "OK",
      unidade: "mm",
      uso: { irrigacao: true, alertas: true, relatorios: false },
      model: "Davis 6465",
      radioCentral: "0013A20041F0BC0C",
      radioControlador: "0013A200422E3C4B",
      radioGps: "0013A200422E7D7C",
      battery: 58,
      net: "4G",
      semComunicacao: false,
    },
    {
      key: "oeste",
      aliases: ["oeste"],
      sub: "Chuva - Milho",
      pivos: ["Pivô Oeste"],
      status: "dry",
      statusLabel: "Tempo seco",
      statusMeta: "última chuva há 3h",
      mm: 3.4,
      intensidade: "Fraca",
      intensidadeMeta: "desde 08h",
      updated: "Atualizado há 18 min",
      tipo: "Estação compacta",
      alimentacao: "Bateria",
      alimentacaoEstado: "OK",
      unidade: "mm",
      uso: { irrigacao: true, alertas: true, relatorios: true },
      model: "Davis 6465",
      radioCentral: "0013A20041F0BC0C",
      radioControlador: "0013A200422E3C4B",
      radioGps: "0013A200422E7D7C",
      battery: 88,
      net: "4G",
      semComunicacao: false,
    },
    {
      key: "centro",
      aliases: ["centro"],
      sub: "Chuva - Milho",
      pivos: ["Pivô Central"],
      status: "rain",
      statusLabel: "Chovendo agora",
      statusMeta: "há 45 min",
      mm: 12.5,
      intensidade: "Moderada",
      intensidadeMeta: "desde 07h",
      updated: "Atualizado há 12 min",
      tipo: "Báscula",
      alimentacao: "Bateria",
      alimentacaoEstado: "OK",
      unidade: "mm",
      uso: { irrigacao: true, alertas: true, relatorios: true },
      model: "Davis 6465",
      radioCentral: "0013A20041F0BC0C",
      radioControlador: "0013A200422E3C4B",
      radioGps: "0013A200422E7D7C",
      battery: 92,
      net: "4G",
      semComunicacao: false,
    },
    {
      key: "sudoeste",
      aliases: ["sudoeste", "teste-offline-visual"],
      sub: "Chuva - Milho",
      pivos: ["Pivô Sudoeste"],
      status: "none",
      statusLabel: "Sem chuva no momento",
      statusMeta: "última chuva há 1h",
      mm: 1.2,
      intensidade: "Fraca",
      intensidadeMeta: "desde 16:40",
      updated: "Atualizado há 6 min",
      tipo: "Estação compacta",
      alimentacao: "Bateria",
      alimentacaoEstado: "OK",
      unidade: "mm",
      uso: { irrigacao: true, alertas: true, relatorios: true },
      model: "Davis 6465",
      radioCentral: "0013A20041F0BC0C",
      radioControlador: "0013A200422E3C4B",
      radioGps: "0013A200422E7D7C",
      battery: 49,
      net: "4G",
      semComunicacao: false,
    },
  ];

  const SHARED_PLUVIO_PROFILE_MAP = new Map();
  SHARED_PLUVIO_PROFILES.forEach((profile, index) => {
    [profile.key].concat(profile.aliases || [])
      .map((key) => normalizeSharedPluvioKey(key))
      .filter(Boolean)
      .forEach((key) => {
        SHARED_PLUVIO_PROFILE_MAP.set(key, { ...profile, __profileIndex: index });
      });
  });

  function cloneSharedPluvioProfile(profile) {
    if (!profile) return null;
    return {
      ...profile,
      aliases: Array.isArray(profile.aliases) ? [...profile.aliases] : [],
      pivos: Array.isArray(profile.pivos) ? [...profile.pivos] : [],
      uso: profile.uso && typeof profile.uso === "object" ? { ...profile.uso } : {},
    };
  }

  function getSharedPluvioProfile(source, index = 0) {
    const keys = [
      source?.key,
      source?.id,
      source?.nome,
      source?.name,
      source?.data?.nome,
      source?.data?.serial,
      source?.serial,
    ]
      .map((value) => normalizeSharedPluvioKey(value))
      .filter(Boolean);

    for (const key of keys) {
      const match = SHARED_PLUVIO_PROFILE_MAP.get(key);
      if (match) return cloneSharedPluvioProfile(match);
    }

    if (!SHARED_PLUVIO_PROFILES.length) return null;
    const length = SHARED_PLUVIO_PROFILES.length;
    const fallbackIndex = ((Number(index) % length) + length) % length;
    return cloneSharedPluvioProfile(SHARED_PLUVIO_PROFILES[fallbackIndex]);
  }

  const PIVOS = Array.from(
    new Set(PLUVIOS.flatMap((p) => p.pivos || []))
  ).map((name) => ({ id: slugify(name), nome: name }));

  const PIVO_BY_NAME = new Map(PIVOS.map((p) => [p.nome, p.id]));
  PLUVIOS.forEach((p) => {
    if (!p.pivosAssoc) {
      p.pivosAssoc = (p.pivos || []).map((name) => PIVO_BY_NAME.get(name)).filter(Boolean);
    }
  });

  // Dados mock de manutenção (1 por pluviômetro)
  const PLUV_MAINTENANCE = {
    "norte-a": {
      status: "ok",
      daysRemaining: 10,
      lastDate: "08/01/2026",
      nextDate: "15/02/2026",
      progress: 72,
      confirmTitle: "Aguardando confirmação",
      confirmHint: "Pressione o botão físico no equipamento",
      frequency: "Mensal (30 dias)",
      responsible: "Bauer Irricontrol",
      reminderDays: 3,
      reminderEnabled: true,
      expected: "Programada",
      tagClass: "programada",
      description: "Limpeza do sensor e calibração realizada",
      meta: "1 sem. atrás",
      device_confirmed: false,
      requires_device_confirmation: true,
    },
    "norte-b": {
      status: "ok",
      daysRemaining: 6,
      lastDate: "15/01/2026",
      nextDate: "11/02/2026",
      progress: 64,
      confirmTitle: "Confirmado no dispositivo",
      confirmHint: "Última confirmação via painel",
      frequency: "Mensal (30 dias)",
      responsible: "Bauer Irricontrol",
      reminderDays: 3,
      reminderEnabled: true,
      expected: "Preventiva",
      tagClass: "preventiva",
      description: "Verificação de bateria e painel solar",
      meta: "1 sem. atrás",
      device_confirmed: true,
      requires_device_confirmation: true,
      completed_at: "2026-01-21T08:30:00Z",
    },
    "sul": {
      status: "late",
      daysRemaining: -3,
      lastDate: "25/12/2025",
      nextDate: "02/02/2026",
      progress: 100,
      confirmTitle: "Atrasada",
      confirmHint: "Substituição de bateria necessária",
      frequency: "Mensal (30 dias)",
      responsible: "Bauer Irricontrol",
      reminderDays: 3,
      reminderEnabled: true,
      expected: "Corretiva",
      tagClass: "corretiva",
      description: "Substituição de bateria necessária",
      meta: "3 dias atrasado",
      device_confirmed: false,
      requires_device_confirmation: true,
    },
    "leste": {
      status: "ok",
      daysRemaining: 12,
      lastDate: "02/01/2026",
      nextDate: "17/02/2026",
      progress: 58,
      confirmTitle: "Aguardando confirmação",
      confirmHint: "Verifique limpeza do sensor",
      frequency: "Mensal (30 dias)",
      responsible: "Bauer Irricontrol",
      reminderDays: 3,
      reminderEnabled: false,
      expected: "Programada",
      tagClass: "programada",
      description: "Verifique limpeza do sensor",
      meta: "Agendada: 17/02/2026",
      device_confirmed: false,
      requires_device_confirmation: true,
    },
    "oeste": {
      status: "late",
      daysRemaining: -13,
      lastDate: "06/01/2026",
      nextDate: "05/02/2026",
      progress: 100,
      confirmTitle: "Aguardando confirmação",
      confirmHint: "Pressione o botão físico no equipamento",
      frequency: "Mensal (30 dias)",
      responsible: "Bauer Irricontrol",
      reminderDays: 3,
      reminderEnabled: true,
      expected: "Programada",
      tagClass: "programada",
      description: "Manutenção programada para hoje",
      meta: "13 dias atrasado",
      device_confirmed: false,
      requires_device_confirmation: true,
    },
  };

  const MAINTENANCE_TYPES = [
    { id: "cleaning", label: "Limpeza do sensor de chuva" },
    { id: "preventive", label: "Inspe\u00e7\u00e3o preventiva" },
    { id: "electrical", label: "Verifica\u00e7\u00e3o el\u00e9trica" },
    { id: "mechanical", label: "Ajuste mec\u00e2nico" },
    { id: "replacement", label: "Troca de componente" },
    { id: "other", label: "Outro" },
  ];

  const MAINTENANCE_HISTORY = [
    {
      date: "08/01/2026",
      type: "Verifica\u00e7\u00e3o peri\u00f3dica",
      responsible: "Bauer Irricontrol",
      status: "ok",
      statusLabel: "Confirmado no dispositivo",
    },
    {
      date: "26/12/2025",
      type: "Troca de sensor",
      responsible: "Bauer Irricontrol",
      status: "warn",
      statusLabel: "Corretiva fora do ciclo",
    },
    {
      date: "14/11/2025",
      type: "Calibra\u00e7\u00e3o de leitura",
      responsible: "Bauer Irricontrol",
      status: "ok",
      statusLabel: "Confirmado no dispositivo",
    },
  ];

  // Dados mock de sensores (1 por pluviômetro)
  const PLUV_SENSORS = {
    "norte-a": {
      model: "Davis",
      pulse: "0.254",
      thresholdMin: 1,
      thresholdMinMinutes: 15,
    },
    "norte-b": {
      model: "Davis",
      pulse: "0.254",
      thresholdMin: 1,
      thresholdMinMinutes: 10,
    },
    "sul": {
      model: "Davis",
      pulse: "0.200",
      thresholdMin: 0.8,
      thresholdMinMinutes: 20,
    },
    "leste": {
      model: "Davis",
      pulse: "0.254",
      thresholdMin: 1.2,
      thresholdMinMinutes: 15,
    },
    "oeste": {
      model: "Davis",
      pulse: "0.254",
      thresholdMin: 1,
      thresholdMinMinutes: 12,
    },
  };

  // Dados mock de redundância (1 por pluviômetro)
  const PLUV_REDUNDANCY = {
    "norte-a": { limit: 18, alertAuto: true },
    "norte-b": { limit: 22, alertAuto: true },
    "sul": { limit: 30, alertAuto: false },
    "leste": { limit: 15, alertAuto: true },
    "oeste": { limit: 20, alertAuto: true },
  };

  const MAINT_FREQUENCIES = [
    "Semanal (7 dias)",
    "Quinzenal (15 dias)",
    "Mensal (30 dias)",
    "Bimestral (60 dias)",
    "Trimestral (90 dias)",
    "Semestral (180 dias)",
    "Anual (365 dias)",
  ];
  const REMINDER_DAYS = [1, 2, 3, 5, 7];
  const MAINT_RESPONSIBLES = [
    "Bauer Irricontrol",
    "Bauer Irricontrol",
    "Bauer Irricontrol",
    "Bauer Irricontrol",
    "Bauer Irricontrol",
  ];
  const EDIT_TYPES = ["Báscula", "Digital", "Estação compacta"];
  const EDIT_POWER = ["Bateria", "Solar", "Rede"];
  const EDIT_UNITS = ["mm", "mm/h"];
  const EDIT_SELECTS = {
    type: { options: EDIT_TYPES, key: "tipo" },
    power: { options: EDIT_POWER, key: "alimentacao" },
    unit: { options: EDIT_UNITS, key: "unidade" },
  };

  function cloneDefaultPluvios() {
    return DEFAULT_PLUVIOS.map((pluvio) => ({
      ...pluvio,
      pivos: Array.isArray(pluvio.pivos) ? [...pluvio.pivos] : [],
      pivosAssoc: Array.isArray(pluvio.pivosAssoc) ? [...pluvio.pivosAssoc] : [],
      uso: pluvio.uso && typeof pluvio.uso === "object" ? { ...pluvio.uso } : {},
    }));
  }

  function ensureVisualTestPluvio(list) {
    if (!Array.isArray(list)) return list;
    if (window.IC_DEMO) return list; // DEMO: sem pluviômetro de teste injetado
    const fallback = getDefaultPluvioById("teste-offline-visual");
    if (!fallback) return list;
    const existing = list.find((pluvio) => String(pluvio?.id || "") === "teste-offline-visual");
    if (existing) {
      Object.assign(existing, {
        ...fallback,
        pivos: Array.isArray(fallback.pivos) ? [...fallback.pivos] : [],
        pivosAssoc: Array.isArray(fallback.pivosAssoc) ? [...fallback.pivosAssoc] : [],
        uso: fallback.uso && typeof fallback.uso === "object" ? { ...fallback.uso } : {},
        id: existing.id || fallback.id,
      });
      return list;
    }
    list.push({
      ...fallback,
      pivos: Array.isArray(fallback.pivos) ? [...fallback.pivos] : [],
      pivosAssoc: Array.isArray(fallback.pivosAssoc) ? [...fallback.pivosAssoc] : [],
      uso: fallback.uso && typeof fallback.uso === "object" ? { ...fallback.uso } : {},
    });
    return list;
  }

  function isPluvioEmptyStartEnabled() {
    try {
      return localStorage.getItem(PLUV_EMPTY_START_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function clearPluvioEmptyStartFlag() {
    try {
      localStorage.removeItem(PLUV_EMPTY_START_KEY);
    } catch (_) {
      // ignore storage errors
    }
  }

  function getDefaultPluvioById(id) {
    const key = String(id || "");
    if (!key) return null;
    return DEFAULT_PLUVIOS.find((pluvio) => String(pluvio.id || "") === key) || null;
  }

  function getDefaultPluvioBaseCoords(pluvio) {
    if (!pluvio || pluvio.__fixedLatLng || pluvio.sourceEquipId) return null;
    const fallback = getDefaultPluvioById(pluvio.id);
    if (!fallback) return null;
    return { lat: fallback.lat, lng: fallback.lng };
  }

  function restoreMockPluvioBaseCoords(pluvio) {
    const base = getDefaultPluvioBaseCoords(pluvio);
    if (!base) return;
    pluvio.__baseLat = base.lat;
    pluvio.__baseLng = base.lng;
    pluvio.lat = base.lat;
    pluvio.lng = base.lng;
    delete pluvio.__manualLocation;
  }

  data.PLUVIOS = isPluvioEmptyStartEnabled() ? [] : cloneDefaultPluvios();
  data.PIVOS = PIVOS;
  data.PIVO_BY_NAME = PIVO_BY_NAME;
  data.PLUV_MAINTENANCE = PLUV_MAINTENANCE;
  data.MAINTENANCE_TYPES = MAINTENANCE_TYPES;
  data.MAINTENANCE_HISTORY = MAINTENANCE_HISTORY;
  data.PLUV_SENSORS = PLUV_SENSORS;
  data.PLUV_REDUNDANCY = PLUV_REDUNDANCY;
  data.MAINT_FREQUENCIES = MAINT_FREQUENCIES;
  data.REMINDER_DAYS = REMINDER_DAYS;
  data.MAINT_RESPONSIBLES = MAINT_RESPONSIBLES;
  data.EDIT_TYPES = EDIT_TYPES;
  data.EDIT_POWER = EDIT_POWER;
  data.EDIT_UNITS = EDIT_UNITS;
  data.EDIT_SELECTS = EDIT_SELECTS;
  data.getDefaultPluvioBaseCoords = getDefaultPluvioBaseCoords;
  data.getSharedPluvioProfile = getSharedPluvioProfile;

  // Storage Helpers
  function getActiveFarmId() {
    const s = window.CreateFarm?.state;
    return s?.currentFarmId || sessionStorage.getItem("ic_active_farm") || sessionStorage.getItem("ic_active_farm_id") || "default";
  }

  function getActiveFarmRecord() {
    const activeFarmId = String(getActiveFarmId() || "");
    try {
      const farms = typeof window.Cad?.data?.getAllFarms === "function"
        ? window.Cad.data.getAllFarms()
        : JSON.parse(localStorage.getItem("ic_farms") || "[]");
      if (!Array.isArray(farms)) return null;
      return farms.find((farm) => String(farm?.id || "") === activeFarmId) || null;
    } catch (e) {
      console.warn("Error loading active farm for pluviometers", e);
      return null;
    }
  }

  function normalizePluvioKey(value) {
    return slugify(value)
      .replace(/^pluviometro-/, "")
      .replace(/^pluviometros-/, "");
  }

  function getFarmPluviometros(farm) {
    const listA = Array.isArray(farm?.equipments) ? farm.equipments : [];
    const listB = Array.isArray(farm?.equipamentos) ? farm.equipamentos : [];
    return [...listA, ...listB].filter((item) => {
      const type = String(item?.type || "").toLowerCase();
      const category = String(item?.category || "").toLowerCase();
      return type === "pluviometro" || category === "pluviometros";
    });
  }

  function getFarmPivos(farm) {
    const listA = Array.isArray(farm?.equipments) ? farm.equipments : [];
    const listB = Array.isArray(farm?.equipamentos) ? farm.equipamentos : [];
    const listC = Array.isArray(farm?.pivos) ? farm.pivos : [];
    return [...listA, ...listB].filter((item) => {
      const type = String(item?.type || item?.controllerType || "").toLowerCase();
      const category = String(item?.category || "").toLowerCase();
      return category === "pivos" || type === "smart_connect" || type === "smarttouch";
    }).concat(listC);
  }

  function getPivotNameMap(farm) {
    const map = new Map();
    getFarmPivos(farm).forEach((item) => {
      const id = String(item?.id || item?.data?.id || "").trim();
      const name = String(item?.name || item?.data?.name || item?.nome || item?.data?.nome || "").trim();
      if (id && name) map.set(id, name);
    });
    return map;
  }

  // Telemetria "ao vivo" coerente com o histórico fictício (assets/js/core/demo-history.js):
  // mm de hoje, status de chuva e última leitura saem da mesma série dos gráficos.
  function applyEngineTelemetry(pluvio) {
    const DH = window.IcDemoHistory;
    const id = pluvio?.sourceEquipId || pluvio?.id;
    if (!DH || !id || !DH.findEquipment(id)) return pluvio;
    const today = DH.dayStart(DH.NOW);
    const readings = DH.rain.hourly(id, today, DH.NOW);
    const mmToday = DH.round(readings.reduce((a, r) => a + r.mm, 0), 1);
    const last = readings[0] || null;
    const minsAgo = last ? Math.round((DH.NOW - last.date) / 60000) : null;
    const raining = last && minsAgo <= 90;
    const lastComm = DH.lastCommunication(id);
    const commMin = Math.max(1, Math.round((DH.NOW - lastComm) / 60000));
    pluvio.mm = mmToday;
    delete pluvio.displayMm;
    pluvio.status = raining ? "rain" : "none";
    pluvio.statusLabel = raining ? "Chovendo agora" : mmToday > 0 ? "Choveu hoje" : "Sem chuva no momento";
    pluvio.statusMeta = last ? `há ${minsAgo >= 60 ? `${Math.floor(minsAgo / 60)}h ${minsAgo % 60}min` : `${minsAgo} min`}` : "Sem chuva hoje";
    const rate = last ? last.mm : 0;
    pluvio.intensidade = !raining ? "Sem chuva" : rate < 2.5 ? "Fraca" : rate < 10 ? "Moderada" : "Forte";
    pluvio.intensidadeMeta = raining ? `desde ${DH.fmt.time(readings[readings.length - 1].date)}` : "—";
    pluvio.updated = `Atualizado há ${commMin} min`;
    pluvio.semComunicacao = false;
    pluvio.battery = Math.round(70 + DH.unit(`bat|${id}`) * 30);
    return pluvio;
  }

  function buildPluvioRuntimeFromEquipment(equip, farm, index = 0) {
    const coords = resolveEquipmentCoords(equip) || { lat: null, lng: null };
    const pivotNameMap = getPivotNameMap(farm);
    const linkedPivotId = String(equip?.data?.linkedPivotId || equip?.data?.pivoId || "").trim();
    const linkedPivotName = linkedPivotId ? pivotNameMap.get(linkedPivotId) : "";
    const nextName = String(equip?.data?.nome || equip?.name || `Pluviômetro ${index + 1}`).trim();
    const profile = getSharedPluvioProfile(equip, index);
    const usage = profile?.uso && typeof profile.uso === "object"
      ? { ...profile.uso }
      : { irrigacao: true, alertas: true, relatorios: true };

    return applyEngineTelemetry({
      id: String(equip?.id || `pluv_${Date.now()}_${index}`),
      nome: nextName || profile?.nome || `Pluviômetro ${index + 1}`,
      sub: String(equip?.data?.sub || profile?.sub || "").trim(),
      pivos: linkedPivotName ? [linkedPivotName] : (Array.isArray(profile?.pivos) ? [...profile.pivos] : []),
      pivosAssoc: linkedPivotId ? [linkedPivotId] : [],
      lat: coords.lat,
      lng: coords.lng,
      status: profile?.status || "none",
      statusLabel: profile?.statusLabel || "Sem chuva no momento",
      statusMeta: profile?.statusMeta || "Sem leitura recente",
      mm: Number.isFinite(Number(profile?.mm)) ? Number(profile.mm) : 0,
      displayMm: profile?.displayMm,
      intensidade: profile?.intensidade || "Sem chuva",
      intensidadeMeta: profile?.intensidadeMeta || "Aguardando dados",
      updated: profile?.updated || "Sem leituras",
      tipo: String(equip?.data?.pluviometroType || equip?.data?.tipoPluviometro || equip?.data?.tipo || profile?.tipo || "Estação compacta"),
      alimentacao: String(equip?.data?.alimentacao || profile?.alimentacao || "Bateria"),
      alimentacaoEstado: String(profile?.alimentacaoEstado || "OK"),
      unidade: String(equip?.data?.unidade || profile?.unidade || "mm"),
      uso: usage,
      model: String(equip?.data?.model || profile?.model || ""),
      serial: String(equip?.data?.serial || ""),
      radioCentral: String(profile?.radioCentral || ""),
      radioControlador: String(profile?.radioControlador || ""),
      radioGps: String(profile?.radioGps || ""),
      battery: Number.isFinite(Number(profile?.battery)) ? Number(profile.battery) : 0,
      net: String(profile?.net || "4G"),
      sourceEquipId: String(equip?.id || ""),
      __baseLat: coords.lat,
      __baseLng: coords.lng,
      __fixedLatLng: Number.isFinite(coords.lat) && Number.isFinite(coords.lng),
      __manualLocation: !!equip?.data?.manualLocation,
      __mockProfileKey: profile?.key || null,
      semComunicacao: !!profile?.semComunicacao,
    });
  }

  function applySharedPluvioTelemetry(pluvio, source, index = 0) {
    if (!pluvio) return pluvio;
    const profile = getSharedPluvioProfile(source || pluvio, index);
    if (!profile) return pluvio;

    pluvio.status = profile.status || "none";
    pluvio.statusLabel = profile.statusLabel || "Sem chuva no momento";
    pluvio.statusMeta = profile.statusMeta || "Sem leitura recente";
    pluvio.mm = Number.isFinite(Number(profile.mm)) ? Number(profile.mm) : 0;

    if (typeof profile.displayMm === "string" && profile.displayMm) {
      pluvio.displayMm = profile.displayMm;
    } else {
      delete pluvio.displayMm;
    }

    pluvio.intensidade = profile.intensidade || "Sem chuva";
    pluvio.intensidadeMeta = profile.intensidadeMeta || "Aguardando dados";
    pluvio.updated = profile.updated || "Sem leituras";
    pluvio.alimentacaoEstado = String(profile.alimentacaoEstado || pluvio.alimentacaoEstado || "OK");
    pluvio.radioCentral = String(profile.radioCentral || pluvio.radioCentral || "");
    pluvio.radioControlador = String(profile.radioControlador || pluvio.radioControlador || "");
    pluvio.radioGps = String(profile.radioGps || pluvio.radioGps || "");
    pluvio.battery = Number.isFinite(Number(profile.battery)) ? Number(profile.battery) : Number(pluvio.battery) || 0;
    pluvio.net = String(profile.net || pluvio.net || "4G");
    pluvio.__mockProfileKey = profile.key || pluvio.__mockProfileKey || null;
    pluvio.semComunicacao = !!profile.semComunicacao;
    return applyEngineTelemetry(pluvio);
  }

  function formatPluvioLatLng(lat, lng) {
    const a = Number(lat);
    const b = Number(lng);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return "";
    return `${a.toFixed(6)}, ${b.toFixed(6)}`;
  }

  function parseCoordinateValue(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    const num = Number(raw.replace(",", "."));
    return Number.isFinite(num) ? num : null;
  }

  function parseLatLngText(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    const match = raw.match(/(-?\d+(?:[.,]\d+)?)\s*[,;]\s*(-?\d+(?:[.,]\d+)?)/);
    if (!match) return null;
    const lat = parseCoordinateValue(match[1]);
    const lng = parseCoordinateValue(match[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }

  function resolveEquipmentCoords(equip) {
    const lat = parseCoordinateValue(equip?.data?.lat ?? equip?.lat);
    const lng = parseCoordinateValue(equip?.data?.lng ?? equip?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }

    return (
      parseLatLngText(equip?.data?.loc) ||
      parseLatLngText(equip?.location) ||
      parseLatLngText(equip?.loc) ||
      null
    );
  }

  function resolvePivotCoords(pivo) {
    const lat = parseCoordinateValue(
      pivo?.data?.centerLat
      ?? pivo?.centerLat
      ?? pivo?.data?.lat
      ?? pivo?.lat
      ?? pivo?.center?.lat
    );
    const lng = parseCoordinateValue(
      pivo?.data?.centerLng
      ?? pivo?.centerLng
      ?? pivo?.data?.lng
      ?? pivo?.lng
      ?? pivo?.center?.lng
    );
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }

    return (
      parseLatLngText(pivo?.data?.center) ||
      parseLatLngText(pivo?.center) ||
      parseLatLngText(pivo?.data?.loc) ||
      parseLatLngText(pivo?.loc) ||
      null
    );
  }

  function getFarmAnchorCoords(farm) {
    const pivots = getFarmPivos(farm)
      .map((item) => resolvePivotCoords(item))
      .filter((coords) => Number.isFinite(coords?.lat) && Number.isFinite(coords?.lng));

    if (pivots.length) {
      const sum = pivots.reduce((acc, coords) => {
        acc.lat += coords.lat;
        acc.lng += coords.lng;
        return acc;
      }, { lat: 0, lng: 0 });
      return { lat: sum.lat / pivots.length, lng: sum.lng / pivots.length };
    }

    const farmLat = parseCoordinateValue(farm?.lat);
    const farmLng = parseCoordinateValue(farm?.lng);
    if (Number.isFinite(farmLat) && Number.isFinite(farmLng)) {
      return { lat: farmLat, lng: farmLng };
    }

    return null;
  }

  function haversineKm(aLat, aLng, bLat, bLng) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const lat1 = toRad(aLat);
    const lat2 = toRad(bLat);
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const root = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
    return 2 * earthRadiusKm * Math.atan2(Math.sqrt(root), Math.sqrt(1 - root));
  }

  function offsetCoords(base, northMeters, eastMeters) {
    const lat = base.lat + (northMeters / 111320);
    const cosLat = Math.cos((base.lat * Math.PI) / 180);
    const safeCos = Math.abs(cosLat) < 0.000001 ? 0.000001 : cosLat;
    const lng = base.lng + (eastMeters / (111320 * safeCos));
    return { lat, lng };
  }

  function buildNearbyCoords(base, index) {
    const ringIndex = Math.floor(index / 6);
    const pointIndex = index % 6;
    const angle = ((pointIndex / 6) * Math.PI * 2) - (Math.PI / 2);
    const radiusMeters = 120 + (ringIndex * 70);
    const northMeters = Math.cos(angle) * radiusMeters;
    const eastMeters = Math.sin(angle) * radiusMeters;
    return offsetCoords(base, northMeters, eastMeters);
  }

  function applyCoordsToEquipmentRecord(equip, coords, options = {}) {
    if (!equip || !coords) return;
    const locText = formatPluvioLatLng(coords.lat, coords.lng);
    equip.data = equip.data && typeof equip.data === "object" ? equip.data : {};
    equip.data.lat = coords.lat;
    equip.data.lng = coords.lng;
    equip.data.loc = locText;
    equip.data.manualLocation = !!options.manualLocation;
    if ("lat" in equip) equip.lat = coords.lat;
    if ("lng" in equip) equip.lng = coords.lng;
    if ("loc" in equip) equip.loc = locText;
    if ("location" in equip) equip.location = locText;
  }

  function shouldBringPluvioCloser(pluvio, anchor) {
    if (pluvio?.__manualLocation) return false;
    const lat = parseCoordinateValue(pluvio?.lat);
    const lng = parseCoordinateValue(pluvio?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return true;
    return haversineKm(lat, lng, anchor.lat, anchor.lng) > 25;
  }

  function persistOutlierPluviosToFarm(farm, updatesById) {
    if (!farm || !updatesById.size) return;
    if (typeof window.Cad?.data?.getAllFarms !== "function" || typeof window.Cad?.data?.persistFarmDataset !== "function") {
      return;
    }

    const farms = window.Cad.data.getAllFarms();
    const farmIndex = farms.findIndex((item) => String(item?.id || "") === String(farm?.id || ""));
    if (farmIndex < 0) return;

    const targetFarm = farms[farmIndex];
    const farmEquipments = typeof window.Cad?.data?.getFarmEquipmentList === "function"
      ? window.Cad.data.getFarmEquipmentList(targetFarm)
      : getFarmPluviometros(targetFarm);
    const equipments = farmEquipments.map((item) => ({
      ...item,
      data: item?.data && typeof item.data === "object" ? { ...item.data } : {},
    }));

    let changed = false;
    data.PLUVIOS.forEach((pluvio, index) => {
      const nextCoords = updatesById.get(String(pluvio?.id || ""));
      if (!nextCoords) return;
      const match = findFarmPluvioEquipment(pluvio, equipments);
      if (!match) return;

      match.data = match.data || {};
      match.data.lat = nextCoords.lat;
      match.data.lng = nextCoords.lng;
      match.data.loc = formatPluvioLatLng(nextCoords.lat, nextCoords.lng);
      if (match.location !== undefined) {
        match.location = formatPluvioLatLng(nextCoords.lat, nextCoords.lng);
      }
      changed = true;
    });

    if (!changed) return;
    targetFarm.equipments = equipments;
    delete targetFarm.equipamentos;
    farms[farmIndex] = targetFarm;
    window.Cad.data.persistFarmDataset(farms);
  }

  function bringPluviosCloserToFarm(farm = getActiveFarmRecord()) {
    if (!farm || !Array.isArray(data.PLUVIOS) || !data.PLUVIOS.length) return;
    const anchor = getFarmAnchorCoords(farm);
    if (!anchor) return;

    const updatesById = new Map();
    let movedCount = 0;
    data.PLUVIOS.forEach((pluvio, index) => {
      if (!shouldBringPluvioCloser(pluvio, anchor)) return;
      const nextCoords = buildNearbyCoords(anchor, movedCount);
      movedCount += 1;
      pluvio.lat = nextCoords.lat;
      pluvio.lng = nextCoords.lng;
      pluvio.__baseLat = nextCoords.lat;
      pluvio.__baseLng = nextCoords.lng;
      pluvio.__fixedLatLng = true;
      pluvio.__manualLocation = false;
      updatesById.set(String(pluvio.id || ""), nextCoords);
    });

    if (!movedCount) return;
    savePluviosToStorage();
    persistOutlierPluviosToFarm(farm, updatesById);
  }

  function purgeLegacyFarPluvioLocations() {
    if (typeof window.Cad?.data?.getAllFarms !== "function" || typeof window.Cad?.data?.persistFarmDataset !== "function") {
      return;
    }

    const farms = window.Cad.data.getAllFarms();
    if (!Array.isArray(farms) || !farms.length) return;

    let changed = false;
    const nextFarms = farms.map((farm) => {
      const anchor = getFarmAnchorCoords(farm);
      if (!anchor) return farm;

      const allEquipments = typeof window.Cad?.data?.getFarmEquipmentList === "function"
        ? window.Cad.data.getFarmEquipmentList(farm)
        : getFarmPluviometros(farm);
      const clonedEquipments = allEquipments.map((item) => ({
        ...item,
        data: item?.data && typeof item.data === "object" ? { ...item.data } : {},
      }));

      let farmChanged = false;
      let movedCount = 0;
      clonedEquipments.forEach((equip) => {
        const type = String(equip?.type || "").toLowerCase();
        const category = String(equip?.category || "").toLowerCase();
        if (type !== "pluviometro" && category !== "pluviometros") return;

        const coords = resolveEquipmentCoords(equip);
        const isFar = !Number.isFinite(coords?.lat) || !Number.isFinite(coords?.lng)
          || haversineKm(coords.lat, coords.lng, anchor.lat, anchor.lng) > 25;
        if (!isFar) return;

        const nextCoords = buildNearbyCoords(anchor, movedCount);
        movedCount += 1;
        applyCoordsToEquipmentRecord(equip, nextCoords, { manualLocation: false });
        farmChanged = true;
      });

      if (!farmChanged) return farm;
      changed = true;
      const nextFarm = { ...farm, equipments: clonedEquipments };
      delete nextFarm.equipamentos;
      return nextFarm;
    });

    if (!changed) return;
    window.Cad.data.persistFarmDataset(nextFarms);
  }

  function getPluvioMatchKeys(pluvio) {
    return [
      normalizePluvioKey(pluvio?.sourceEquipId),
      normalizePluvioKey(pluvio?.id),
      normalizePluvioKey(pluvio?.nome),
      normalizePluvioKey(pluvio?.serial),
    ].filter(Boolean);
  }

  function getEquipmentMatchKeys(equip) {
    return [
      normalizePluvioKey(equip?.id),
      normalizePluvioKey(equip?.name),
      normalizePluvioKey(equip?.data?.nome),
      normalizePluvioKey(equip?.data?.serial),
    ].filter(Boolean);
  }

  function findFarmPluvioEquipment(pluvio, farmPluvios) {
    const matchKeys = new Set(getPluvioMatchKeys(pluvio));
    if (!matchKeys.size) return null;

    return farmPluvios.find((equip) => getEquipmentMatchKeys(equip).some((key) => matchKeys.has(key))) || null;
  }

  function hasSyncedPluvioCoverage(pluvios, farmPluvios) {
    if (!Array.isArray(pluvios) || !pluvios.length) return false;
    if (!Array.isArray(farmPluvios) || !farmPluvios.length) return false;

    return farmPluvios.every((equip) => {
      const equipId = String(equip?.id || "").trim();
      return pluvios.some((pluvio) => {
        if (equipId && String(pluvio?.sourceEquipId || "").trim() === equipId) return true;
        return !!findFarmPluvioEquipment(pluvio, [equip]);
      });
    });
  }

  function syncPluviosWithFarmEquipment(farm = getActiveFarmRecord()) {
    if (!farm || !Array.isArray(data.PLUVIOS)) return;

    const farmPluvios = getFarmPluviometros(farm);
    if (!farmPluvios.length) {
      if (isPluvioEmptyStartEnabled()) data.PLUVIOS = [];
      return;
    }

    if ((!data.PLUVIOS.length || isPluvioEmptyStartEnabled()) && farmPluvios.length) {
      data.PLUVIOS = farmPluvios.map((equip, index) => buildPluvioRuntimeFromEquipment(equip, farm, index));
      clearPluvioEmptyStartFlag();
      return;
    }

    if (!hasSyncedPluvioCoverage(data.PLUVIOS, farmPluvios)) {
      data.PLUVIOS = farmPluvios.map((equip, index) => buildPluvioRuntimeFromEquipment(equip, farm, index));
      clearPluvioEmptyStartFlag();
      return;
    }

    data.PLUVIOS.forEach((pluvio, index) => {
      const match = findFarmPluvioEquipment(pluvio, farmPluvios);
      if (!match) {
        delete pluvio.__fixedLatLng;
        delete pluvio.__manualLocation;
        if (getDefaultPluvioById(pluvio.id)) delete pluvio.sourceEquipId;
        restoreMockPluvioBaseCoords(pluvio);
        applySharedPluvioTelemetry(pluvio, pluvio, index);
        return;
      }

      pluvio.sourceEquipId = match.id || pluvio.sourceEquipId || null;

      const coords = resolveEquipmentCoords(match);
      if (!coords) {
        delete pluvio.__fixedLatLng;
        delete pluvio.__manualLocation;
        if (getDefaultPluvioById(pluvio.id)) delete pluvio.sourceEquipId;
        restoreMockPluvioBaseCoords(pluvio);
        applySharedPluvioTelemetry(pluvio, match, index);
        return;
      }

      pluvio.lat = coords.lat;
      pluvio.lng = coords.lng;
      pluvio.__baseLat = coords.lat;
      pluvio.__baseLng = coords.lng;
      pluvio.__fixedLatLng = true;
      pluvio.__manualLocation = !!match?.data?.manualLocation;

      const nextName = String(match?.data?.nome || match?.name || "").trim();
      if (nextName) pluvio.nome = nextName;
      const nextSub = String(match?.data?.sub || "").trim();
      if (nextSub) pluvio.sub = nextSub;
      applySharedPluvioTelemetry(pluvio, match, index);
    });
  }

  async function persistPluvioToFarmEquipment(pluvio, farm = getActiveFarmRecord()) {
    if (!pluvio || !farm) return false;
    if (typeof window.Cad?.data?.getAllFarms !== "function" || typeof window.Cad?.data?.persistFarmDataset !== "function") {
      return false;
    }

    const farms = window.Cad.data.getAllFarms();
    const farmIndex = farms.findIndex((item) => String(item?.id || "") === String(farm?.id || ""));
    if (farmIndex < 0) return false;

    const targetFarm = farms[farmIndex];
    const farmEquipments = typeof window.Cad?.data?.getFarmEquipmentList === "function"
      ? window.Cad.data.getFarmEquipmentList(targetFarm)
      : getFarmPluviometros(targetFarm);
    const equipments = farmEquipments.map((item) => ({
      ...item,
      data: item?.data && typeof item.data === "object" ? { ...item.data } : {},
    }));

    const match = findFarmPluvioEquipment(pluvio, equipments);
    if (!match) return false;

    pluvio.sourceEquipId = match.id || pluvio.sourceEquipId || null;

    const nextLat = Number(pluvio?.lat);
    const nextLng = Number(pluvio?.lng);
    const nextName = String(pluvio?.nome || "").trim();
    const nextSub = String(pluvio?.sub || "").trim();
    const nextLoc = formatPluvioLatLng(nextLat, nextLng);

    if (nextName) match.name = nextName;
    if (nextLoc) match.location = nextLoc;

    match.data = match.data || {};
    if (nextName) match.data.nome = nextName;
    if (nextSub) match.data.sub = nextSub;
    if (nextLoc) match.data.loc = nextLoc;
    if (Number.isFinite(nextLat)) match.data.lat = nextLat;
    if (Number.isFinite(nextLng)) match.data.lng = nextLng;
    match.data.manualLocation = !!pluvio.__manualLocation;

    targetFarm.equipments = equipments;
    delete targetFarm.equipamentos;
    farms[farmIndex] = targetFarm;

    await window.Cad.data.persistFarmDataset(farms);
    syncPluviosWithFarmEquipment(targetFarm);
    savePluviosToStorage();
    return true;
  }

  function refreshPluvioRuntime() {
    if (document.getElementById("pluvSearchInput")) {
      window.Plv?.cards?.syncSelectionUI?.();
      window.Plv?.cards?.renderCards?.();
      window.Plv?.views?.data?.renderData?.();
      window.Plv?.views?.map?.renderMarkers?.();
      window.Plv?.maintenance?.renderMaintenanceCards?.();
    }

    if (document.getElementById("pluvEditBack")) {
      window.Plv?.views?.edit?.renderEditSelect?.();
      window.Plv?.views?.edit?.renderEditSummary?.();
      window.Plv?.views?.edit?.renderEditGeneral?.();
      window.Plv?.views?.edit?.renderEditLocation?.();
      window.Plv?.views?.edit?.updateEditMap?.();
    }

    if (document.getElementById("pluvdTitleLabel")) {
      window.Plv?.views?.details?.renderDetails?.();
    }
  }

  function loadTalhoes() {
    const farmId = getActiveFarmId();
    if (typeof window.Cad?.data?.getTalhoesByFarm === "function") {
      return window.Cad.data.getTalhoesByFarm(farmId);
    }
    try {
      const raw = localStorage.getItem("ic_talhoes_" + farmId);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (e) {
      console.warn("Error loading talhoes", e);
      return [];
    }
  }

  function savePluviosToStorage() {
    const farmId = getActiveFarmId();
    const safeList = Array.isArray(data.PLUVIOS) ? data.PLUVIOS : [];
    try {
      localStorage.setItem("ic_pluvios_" + farmId, JSON.stringify(safeList));
      if (safeList.length > 0) {
        clearPluvioEmptyStartFlag();
      }
    } catch (e) {
      console.error("Failed to save pluviometers", e);
    }
    if (typeof window.Cad?.data?.savePluviosByFarm === "function") {
      window.Cad.data.savePluviosByFarm(farmId, safeList);
    }
  }

  async function loadPluviosFromStorage() {
    const farmId = getActiveFarmId();
    try {
      if (typeof window.Cad?.data?.loadSharedAppState === "function") {
        await window.Cad.data.loadSharedAppState();
      }
      const emptyStartEnabled = isPluvioEmptyStartEnabled();
      const activeFarm = getActiveFarmRecord();
      const farmPluvios = getFarmPluviometros(activeFarm);

      data.PLUVIOS = emptyStartEnabled ? [] : cloneDefaultPluvios();

      if (!emptyStartEnabled) {
        let stored = null;
        if (typeof window.Cad?.data?.getPluviosByFarm === "function") {
          stored = window.Cad.data.getPluviosByFarm(farmId);
        } else {
          const raw = localStorage.getItem("ic_pluvios_" + farmId);
          stored = raw ? JSON.parse(raw) : null;
        }
        if (Array.isArray(stored)) {
          data.PLUVIOS = stored;
        } else if (data.PLUVIOS && data.PLUVIOS.length > 0) {
          savePluviosToStorage();
        }
      } else if (!farmPluvios.length) {
        localStorage.setItem("ic_pluvios_" + farmId, JSON.stringify([]));
      }

      if (!emptyStartEnabled && Array.isArray(data.PLUVIOS)) {
        ensureVisualTestPluvio(data.PLUVIOS);
        data.PLUVIOS.forEach((pluvio) => restoreMockPluvioBaseCoords(pluvio));
      }
      purgeLegacyFarPluvioLocations();
      syncPluviosWithFarmEquipment(activeFarm);
      bringPluviosCloserToFarm();
      savePluviosToStorage();
    } catch (e) { }
  }

  data.getActiveFarmId = getActiveFarmId;
  data.loadTalhoes = loadTalhoes;
  data.savePluviosToStorage = savePluviosToStorage;
  data.loadPluviosFromStorage = loadPluviosFromStorage;
  data.syncPluviosWithFarmEquipment = syncPluviosWithFarmEquipment;
  data.persistPluvioToFarmEquipment = persistPluvioToFarmEquipment;
  data.refreshPluvioRuntime = refreshPluvioRuntime;
  data.applyEngineTelemetry = applyEngineTelemetry;
  data.bringPluviosCloserToFarm = bringPluviosCloserToFarm;
  data.purgeLegacyFarPluvioLocations = purgeLegacyFarPluvioLocations;

  if (window.IcFarmApplyGeo && window.IcFarmActive) {
    window.IcFarmApplyGeo(window.IcFarmActive);
  }
})();
