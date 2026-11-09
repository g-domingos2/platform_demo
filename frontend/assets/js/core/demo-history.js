// assets/js/core/demo-history.js
// Motor único de histórico fictício da Fazenda Demo.
//
// Por quê: cada tela (detalhes, gráficos, relatórios) tinha números e datas
// fixos e diferentes entre si (ex.: histórico em "mai 2026" com período em
// "nov 2026", relatório com 28 pivôs numa fazenda com 1). Aqui tudo nasce de
// UMA fonte determinística por equipamento (seed = id), com datas relativas
// a hoje. Assim o mesmo dado aparece igual no histórico, nos KPIs, nos
// gráficos e nos relatórios, para qualquer período escolhido.
//
// API: window.IcDemoHistory (ver o objeto exportado no fim do arquivo).
(function () {
  "use strict";

  const DAY = 86400000;
  const HOUR = 3600000;
  const MIN = 60000;
  const HISTORY_DAYS = 400; // cobre "último ano" + folga

  // "Agora" fixo durante a sessão (arredondado ao minuto) para os números não
  // mudarem entre uma tela e outra.
  const NOW = new Date(Math.floor(Date.now() / MIN) * MIN);

  // ------------------------------------------------------------------ util
  function hash(str) {
    let h = 1779033703 ^ String(str).length;
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }

  function rng(seed) {
    let a = typeof seed === "number" ? seed >>> 0 : hash(seed);
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const unit = (seed) => rng(seed)();
  const between = (r, a, b) => a + (b - a) * r();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
  const num = (v, fb = NaN) => {
    if (v == null || v === "") return fb;
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : fb;
  };

  function dayStart(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  function dayKey(d) {
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  }
  const HISTORY_START = new Date(dayStart(NOW).getTime() - HISTORY_DAYS * DAY);

  function normRange(start, end) {
    let s = start ? new Date(start) : new Date(NOW.getTime() - 7 * DAY);
    let e = end ? new Date(end) : new Date(NOW);
    if (Number.isNaN(s.getTime())) s = new Date(NOW.getTime() - 7 * DAY);
    if (Number.isNaN(e.getTime())) e = new Date(NOW);
    if (s > e) [s, e] = [e, s];
    // "fim" informado só como dia → até o fim do dia (limitado a agora)
    if (e.getHours() === 0 && e.getMinutes() === 0) e = new Date(e.getTime() + DAY - 1);
    if (e > NOW) e = new Date(NOW);
    return { start: s, end: e };
  }

  // ------------------------------------------------------------ formatação
  const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const pad = (n) => String(n).padStart(2, "0");
  const fmt = {
    dateTime(d) {
      const x = new Date(d);
      return `${pad(x.getDate())} ${MONTHS[x.getMonth()]} ${x.getFullYear()} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
    },
    dateTimeSec(d) {
      const x = new Date(d);
      return `${fmt.dateTime(x)}:${pad(x.getSeconds())}`;
    },
    date(d) {
      const x = new Date(d);
      return `${pad(x.getDate())} ${MONTHS[x.getMonth()]} ${x.getFullYear()}`;
    },
    dateBR(d) {
      const x = new Date(d);
      return `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()}`;
    },
    dateTimeBR(d) {
      const x = new Date(d);
      return `${fmt.dateBR(x)} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
    },
    dayMonth(d) {
      const x = new Date(d);
      return `${pad(x.getDate())}/${pad(x.getMonth() + 1)}`;
    },
    time(d) {
      const x = new Date(d);
      return `${pad(x.getHours())}:${pad(x.getMinutes())}`;
    },
    hm(hours) {
      const total = Math.max(0, Math.round(hours * 60));
      return `${Math.floor(total / 60)}h ${pad(total % 60)}min`;
    },
    hmShort(hours) {
      const total = Math.max(0, Math.round(hours * 60));
      return `${pad(Math.floor(total / 60))}h ${pad(total % 60)}min`;
    },
    n(v, d = 2) {
      return Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
    },
    money(v) {
      return `R$ ${fmt.n(v, 2)}`;
    },
    MONTHS,
  };

  // ---------------------------------------------------------- equipamentos
  function allFarms() {
    try {
      const fromWin = window.IcFarmsAll || window.Cad?.data?.getAllFarms?.();
      if (Array.isArray(fromWin) && fromWin.length) return fromWin;
    } catch (_) { }
    try {
      const stored = JSON.parse(localStorage.getItem("ic_farms") || "[]");
      if (Array.isArray(stored)) return stored;
    } catch (_) { }
    return [];
  }

  function activeFarm() {
    const live = window.IcFarmGetActive?.() || window.icFarmData || window.IcFarmActive;
    if (live && (Array.isArray(live.equipments) || Array.isArray(live.equipamentos))) return live;
    const farms = allFarms();
    let activeId = null;
    try {
      activeId = sessionStorage.getItem("ic_active_farm") || sessionStorage.getItem("ic_active_farm_id");
    } catch (_) { }
    return farms.find((f) => String(f?.id) === String(activeId)) || farms[0] || null;
  }

  function equipmentsOf(farm) {
    const a = Array.isArray(farm?.equipments) ? farm.equipments : [];
    const b = Array.isArray(farm?.equipamentos) ? farm.equipamentos : [];
    const seen = new Set();
    return [...a, ...b].filter((e) => {
      const k = String(e?.id || `${e?.type}_${e?.name}`);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  function findEquipment(id) {
    if (id == null) return null;
    const sid = String(id);
    const farm = activeFarm();
    const inActive = equipmentsOf(farm).find((e) => String(e?.id) === sid);
    if (inActive) return { equip: inActive, farm };
    for (const f of allFarms()) {
      const e = equipmentsOf(f).find((x) => String(x?.id) === sid);
      if (e) return { equip: e, farm: f };
    }
    return null;
  }

  const KIND_BY_TYPE = {
    smart_connect: "pivot",
    smarttouch: "pivot",
    linestar: "linear",
    irripump: "pump",
    medidor: "meter",
    pluviometro: "rain",
    rainstar: "reel",
    estacao_metereologica: "station",
    cosmofield: "cosmo",
    repetidora: "repeater",
  };
  function kindOf(equip) {
    const t = String(equip?.type || "").toLowerCase();
    if (KIND_BY_TYPE[t]) return KIND_BY_TYPE[t];
    const c = String(equip?.category || "").toLowerCase();
    if (c === "pivos") return "pivot";
    if (c === "bombas") return "pump";
    if (c === "medidores") return "meter";
    if (c === "pluviometros") return "rain";
    if (c === "carreteis") return t === "linestar" ? "linear" : "reel";
    if (c === "estacoes") return "station";
    if (c === "cosmofields") return "cosmo";
    if (c === "repetidoras") return "repeater";
    return "other";
  }

  function listByKind(kind, farm) {
    return equipmentsOf(farm || activeFarm()).filter((e) => kindOf(e) === kind);
  }

  function resolve(equipOrId) {
    if (equipOrId && typeof equipOrId === "object") {
      const farm = activeFarm();
      return { equip: equipOrId, farm };
    }
    return findEquipment(equipOrId);
  }

  // ------------------------------------------------------------------ clima
  // Clima por fazenda/dia (cerrado: chuvas de out–abr, seca de mai–set).
  const RAIN_PROB_BY_MONTH = [0.55, 0.5, 0.5, 0.35, 0.12, 0.03, 0.02, 0.04, 0.12, 0.3, 0.45, 0.55];
  const weatherCache = new Map();
  function weatherDay(farmId, date) {
    const key = `${farmId}|${dayKey(date)}`;
    if (weatherCache.has(key)) return weatherCache.get(key);
    const r = rng(`wx|${key}`);
    const m = new Date(date).getMonth();
    const wet = RAIN_PROB_BY_MONTH[m];
    let rain = 0;
    if (r() < wet) {
      rain = -Math.log(1 - r() * 0.98) * (wet > 0.3 ? 12 : 6);
      rain = round(clamp(rain, 0.4, 85), 1);
    } else r();
    const dry = 1 - wet;
    const tmax = round(29 + dry * 4 + between(r, -1.8, 1.8) - (rain > 5 ? 2.5 : 0), 1);
    const tmin = round(tmax - 9 - dry * 4 + between(r, -1.5, 1.5), 1);
    const rh = round(clamp(45 + wet * 45 + (rain > 0 ? 10 : 0) + between(r, -6, 6), 18, 98), 0);
    const wind = round(clamp(1.4 + dry * 1.6 + between(r, -0.6, 1.2), 0.4, 6), 1);
    const solar = round(clamp(16 + dry * 7 - (rain > 2 ? 5 : 0) + between(r, -2, 2), 7, 27), 1);
    const eto = round(clamp(3.2 + dry * 2.8 - (rain > 2 ? 1.2 : 0) + between(r, -0.5, 0.5), 1.4, 7.5), 2);
    const res = { date: dayStart(date), rain, tmax, tmin, rh, wind, solar, eto };
    weatherCache.set(key, res);
    return res;
  }

  // Chuva medida num ponto (pluviômetro, pivô, estação): chuva da fazenda com
  // variação local estável por equipamento.
  function localRainFull(farmId, equipId, date) {
    const base = weatherDay(farmId, date).rain;
    if (!base) return 0;
    const f = 0.82 + unit(`lr|${equipId}|${dayKey(date)}`) * 0.36;
    return round(base * f, 1);
  }

  // Chuva do dia distribuída em leituras horárias (soma = total do dia)
  function rainParts(farmId, equipId, date) {
    const total = localRainFull(farmId, equipId, date);
    if (!total) return [];
    const day = dayStart(date);
    const r = rng(`rh|${equipId}|${dayKey(day)}`);
    const startH = Math.floor(r() * 20);
    const len = 1 + Math.floor(r() * 4);
    const weights = Array.from({ length: len }, () => 0.3 + r());
    const tot = weights.reduce((a, b) => a + b, 0);
    let acc = 0;
    return weights.map((w, i) => {
      const mm = i === len - 1 ? round(total - acc, 1) : round((total * w) / tot, 1);
      acc = round(acc + mm, 1);
      return { date: new Date(day.getTime() + (startH + i) * HOUR + Math.floor(r() * 50) * MIN), mm, dayTotal: total, acc };
    });
  }

  // Chuva medida no dia; para "hoje" conta só o que já caiu até agora.
  function localRain(farmId, equipId, date) {
    if (dayKey(date) !== dayKey(NOW)) return localRainFull(farmId, equipId, date);
    return round(rainParts(farmId, equipId, date).filter((p) => p.date <= NOW).reduce((a, p) => a + p.mm, 0), 1);
  }

  function rainSeries(farmId, equipId, start, end) {
    const out = [];
    const s = dayStart(start);
    const e = dayStart(end);
    for (let d = new Date(s); d <= e; d = new Date(d.getTime() + DAY)) {
      out.push({ date: new Date(d), mm: equipId ? localRain(farmId, equipId, d) : weatherDay(farmId, d).rain });
    }
    return out;
  }

  // -------------------------------------------------------------- geometria
  function haversine(a, b) {
    const R = 6371000;
    const toR = (x) => (x * Math.PI) / 180;
    const dLat = toR(b.lat - a.lat);
    const dLng = toR(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function pt(lat, lng) {
    const a = num(lat);
    const b = num(lng);
    return Number.isFinite(a) && Number.isFinite(b) ? { lat: a, lng: b } : null;
  }
  function parsePt(text) {
    const parts = String(text || "").split(/[,;\s]+/).filter(Boolean);
    return parts.length >= 2 ? pt(parts[0], parts[1]) : null;
  }

  // ===================================================================== PIVÔ
  const PEAK_START = 18; // horário de ponta 18:00–21:00
  const PEAK_END = 21;
  const REDUCED_START = 21.5; // tarifa reduzida irrigante 21:30–06:00
  const REDUCED_END = 6;
  const TARIFF = { peak: 2.1, off: 0.68, reduced: 0.27 }; // R$/kWh

  function splitTariff(start, end) {
    // Divide [start,end] nas faixas ponta / fora de ponta / reduzida (em horas).
    const out = { peak: 0, off: 0, reduced: 0 };
    let t = start.getTime();
    const stop = end.getTime();
    const step = 5 * MIN;
    while (t < stop) {
      const nxt = Math.min(stop, t + step);
      const h = new Date(t).getHours() + new Date(t).getMinutes() / 60;
      const dh = (nxt - t) / HOUR;
      if (h >= PEAK_START && h < PEAK_END) out.peak += dh;
      else if (h >= REDUCED_START || h < REDUCED_END) out.reduced += dh;
      else out.off += dh;
      t = nxt;
    }
    return out;
  }

  function pivotModel(equip) {
    const d = equip?.data || {};
    const r = rng(`pm|${equip.id}`);
    const center = pt(d.centerLat ?? d.lat, d.centerLng ?? d.lng) || parsePt(d.center);
    const ref = pt(d.refLat, d.refLng) || parsePt(d.ref);
    let radius = num(d.radius ?? d.raio);
    if (!(radius > 0) && center && ref) radius = haversine(center, ref);
    if (!(radius > 0)) radius = 300 + r() * 250;
    else r();
    let sweep = 360;
    const segs = Array.isArray(d.segments) ? d.segments : [];
    const maxAngle = num(d.maxAngle, 360);
    if (maxAngle > 0 && maxAngle < 360) sweep = maxAngle;
    const isLinear = kindOf(equip) === "linear";
    const length = isLinear ? num(d.length ?? d.comprimento, 600 + r() * 400) : 0;
    const width = isLinear ? num(d.width ?? d.largura, radius) : 0;
    const areaHa = isLinear ? (length * width) / 10000 : (Math.PI * radius * radius * (sweep / 360)) / 10000;
    const towerSpeed = between(r, 190, 260); // m/h da última torre a 100%
    const lapH100 = isLinear ? (length / towerSpeed) : (2 * Math.PI * radius * (sweep / 360)) / towerSpeed;
    const lamina100 = between(r, 2.4, 3.6); // mm aplicados a 100%
    let flow = num(d.flow ?? d.vazao);
    if (!(flow > 0)) flow = (lamina100 * areaHa * 10) / lapH100;
    let power = num(d.power ?? d.potencia);
    if (power > 0 && String(d.powerUnit || "").toLowerCase().includes("cv")) power *= 0.7355;
    if (!(power > 0)) power = clamp(flow * 0.42, 25, 450); // kW (bomba + torres)
    const minV = num(d.minVoltage, 400);
    const maxV = num(d.maxVoltage, 600);
    const nominalV = 440 >= minV && 440 <= maxV ? 440 : round((minV + maxV) / 2, 0);
    const basePercent = Math.round(between(r, 35, 70));
    const pCenter = round(between(r, 3.6, 5.2), 1);
    const pTower = round(between(r, 1.2, 2.2), 1);
    const hourBase = Math.round(between(r, 900, 3200));
    const wetShare = between(r, 0.82, 0.93);
    const altitude = Math.round(between(r, 640, 880));
    return {
      center, radius, sweep, areaHa, lapH100, flow, power, nominalV, minV, maxV,
      basePercent, pCenter, pTower, hourBase, wetHourBase: hourBase * wetShare,
      lamina100: (flow * lapH100) / (areaHa * 10), isLinear, length, altitude,
      segments: segs,
    };
  }

  const cache = new Map();
  function cacheKey(prefix, equip) {
    let sig = "";
    try { sig = JSON.stringify(equip?.data || {}).length + "|" + (equip?.createdAt || ""); } catch (_) { }
    return `${prefix}|${equip?.id}|${sig}`;
  }

  const USERS = ["bauer@irricontrol.com", "gerente@fazendademo.com", "operador@fazendademo.com"];

  function pivotTimeline(equip, farm) {
    const key = cacheKey("pv", equip);
    if (cache.has(key)) return cache.get(key);
    const m = pivotModel(equip);
    const farmId = farm?.id || "farm";
    const r = rng(`pt|${equip.id}`);
    const ops = [];
    let angle = Math.round(r() * 360);
    let hours = m.hourBase;
    let wet = m.wetHourBase;
    let busyUntil = HISTORY_START.getTime();
    const lastAllowed = NOW.getTime() - 40 * MIN;

    for (let d = new Date(HISTORY_START); d <= NOW; d = new Date(d.getTime() + DAY)) {
      const wx = weatherDay(farmId, d);
      const prev = weatherDay(farmId, new Date(d.getTime() - DAY));
      const month = d.getMonth();
      const dryMonth = RAIN_PROB_BY_MONTH[month] < 0.2;
      let pRun = dryMonth ? 0.78 : 0.42;
      if (wx.rain > 6 || prev.rain > 15) pRun *= 0.15;
      if (r() > pRun) continue;

      // Início: preferência pela tarifa reduzida (noite)
      const slot = r();
      const startHour = slot < 0.55 ? 21.5 + r() * 2 : slot < 0.8 ? 5 + r() * 3 : 13 + r() * 4;
      let start = new Date(dayStart(d).getTime() + startHour * HOUR + Math.floor(r() * 4) * MIN);
      start = new Date(Math.round(start.getTime() / MIN) * MIN);
      if (start.getTime() < busyUntil + 30 * MIN) continue;

      const dryOp = r() < 0.08;
      const percent = dryOp ? 100 : clamp(m.basePercent + Math.round((r() - 0.5) * 20), 15, 100);
      const lap = dryOp ? between(r, 0.15, 0.4) : between(r, 0.35, 1);
      const direction = r() < 0.8 ? "Avanço" : "Reverso";
      const scheduled = r() < 0.3;
      const user = USERS[Math.floor(r() * USERS.length)];
      let durH = (lap * m.lapH100 * 100) / percent;

      // Alertas (interrompem a operação)
      const fr = r();
      let fault = null;
      if (!dryOp) {
        if (fr < 0.045) fault = "pressure";
        else if (fr < 0.065) fault = "misalignment";
        else if (fr < 0.1) fault = "lowVoltage";
        else if (fr < 0.115) fault = "peakVoltage";
      }
      let lapDone = lap;
      if (fault) {
        const cut = between(r, 0.2, 0.85);
        durH *= cut;
        lapDone = lap * cut;
      }
      let end = new Date(start.getTime() + durH * HOUR);
      if (end.getTime() > lastAllowed) {
        if (start.getTime() > lastAllowed - 2 * HOUR) break;
        end = new Date(lastAllowed);
        durH = (end - start) / HOUR;
        lapDone = (durH * percent) / (100 * m.lapH100);
      }

      const sign = direction === "Avanço" ? 1 : -1;
      const angStart = angle;
      const angEnd = (((angle + sign * lapDone * m.sweep) % 360) + 360) % 360;
      angle = angEnd;

      const isWet = !dryOp;
      const volume = isWet ? m.flow * durH : 0;
      const tariff = splitTariff(start, end);
      const kw = isWet ? m.power : m.power * 0.12;
      const kwh = { peak: tariff.peak * kw, off: tariff.off * kw, reduced: tariff.reduced * kw };
      const cost = kwh.peak * TARIFF.peak + kwh.off * TARIFF.off + kwh.reduced * TARIFF.reduced;
      const laminaMm = isWet ? (m.lamina100 * 100) / percent : 0;

      const hourStart = hours;
      const wetStart = wet;
      hours += durH;
      if (isWet) wet += durH;

      ops.push({
        id: `${equip.id}-op${ops.length}`,
        start, end, durH, percent, laminaMm, lap: lapDone, direction,
        mode: isWet ? "Molhado" : "Seco", wet: isWet, angStart, angEnd,
        volume, kwh, kwhTotal: kwh.peak + kwh.off + kwh.reduced, tariffHours: tariff, cost,
        fault, scheduled, user,
        pressureCenter: isWet ? round(m.pCenter + (r() - 0.5) * 0.6, 1) : 0,
        pressureTower: isWet ? round((fault === "pressure" ? 0.3 : m.pTower) + (r() - 0.5) * 0.3, 1) : 0,
        voltage: Math.round(m.nominalV * (fault === "lowVoltage" ? 0.86 : fault === "peakVoltage" ? 1.12 : 0.98 + r() * 0.05)),
        hourStart, hourEnd: hours, wetStart, wetEnd: wet,
        relLaminaMm: isWet ? volume / (m.areaHa * 10) : 0,
      });
      busyUntil = end.getTime();
    }

    const res = { model: m, ops, hours, wet, angle };
    cache.set(key, res);
    return res;
  }

  function opsInRange(ops, start, end) {
    const s = start.getTime();
    const e = end.getTime();
    return ops.filter((o) => o.start.getTime() <= e && o.end.getTime() >= s);
  }

  // Fração de uma operação dentro do período (para somatórios proporcionais)
  function overlapFraction(op, start, end) {
    const a = Math.max(op.start.getTime(), start.getTime());
    const b = Math.min(op.end.getTime(), end.getTime());
    const tot = op.end - op.start;
    return tot > 0 ? clamp((b - a) / tot, 0, 1) : 0;
  }

  const FAULT_LABEL = {
    pressure: "FALHA DE PRESSÃO NA ÚLTIMA TORRE",
    misalignment: "DESALINHADO",
    lowVoltage: "TENSÃO BAIXA",
    peakVoltage: "PICO DE TENSÃO",
  };
  const FAULT_TYPE = {
    pressure: "Falha de Pressão",
    misalignment: "Desalinhado",
    lowVoltage: "Tensão Baixa",
    peakVoltage: "Pico de Tensão",
  };

  function pivotStatusLine(op, upper) {
    const kind = op.scheduled ? "IRRIGAÇÃO POR AGENDAMENTO" : "IRRIGAÇÃO SIMPLES";
    const dir = op.direction.toUpperCase();
    const mode = op.mode.toUpperCase();
    const lam = op.wet ? ` | ${fmt.n(op.laminaMm, 2)} ${upper ? "MM" : "mm"}` : "";
    return `${kind} | ${dir} | ${mode} | ${op.percent}%${lam}`;
  }

  function pivotEvents(equipOrId, start, end) {
    const ctx = resolve(equipOrId);
    if (!ctx) return [];
    const { equip, farm } = ctx;
    const { ops, model } = pivotTimeline(equip, farm);
    const range = normRange(start, end);
    const list = [];
    const s = range.start.getTime();
    const e = range.end.getTime();
    const push = (date, type, status, details, dot) => {
      const t = date.getTime();
      if (t >= s && t <= e) list.push({ date, type, status, details, dot });
    };
    opsInRange(ops, new Date(s - DAY), new Date(e + DAY)).forEach((op) => {
      const common = {
        horimetroTotal: fmt.hm(op.hourStart),
        horimetroMolhado: fmt.hm(op.wetStart),
        irrigacaoAtiva: `${op.scheduled ? "Irrigação por Agendamento" : "Irrigação Simples"} - Fertirrigação Desabilitada`,
        modoInicio: op.scheduled ? "Agendado" : "Imediato",
        direcao: op.direction,
        modo: op.mode,
        modoParada: "Parada por Ângulo",
        anguloAtual: `${fmt.n(op.angStart, 2)}°`,
        anguloParada: `${fmt.n(op.angEnd, 0)}°`,
        percentimetroLamina: op.wet ? `${op.percent}% - ${fmt.n(op.laminaMm, 2)} mm` : `${op.percent}%`,
        previsaoTermino: fmt.dateTimeBR(op.end),
        duracaoPrevista: fmt.hmShort(op.durH),
        pressaoUltimaTorre: `${fmt.n(op.pressureTower, 1)} bar`,
      };
      const line = pivotStatusLine(op, false);
      push(op.start, "Comando", line, { ...common, enviadoEm: fmt.dateTimeSec(op.start), enviadoPor: op.scheduled ? "Agendamento" : op.user }, "green");
      if (op.wet) {
        push(new Date(op.start.getTime() + 1 * MIN), "Atualização", "ESPERANDO PRESSURIZAÇÃO", { ...common, recebidoEm: fmt.dateTimeSec(new Date(op.start.getTime() + MIN)) });
      }
      push(new Date(op.start.getTime() + 4 * MIN), "Atualização", pivotStatusLine(op, true), { ...common, recebidoEm: fmt.dateTimeSec(new Date(op.start.getTime() + 4 * MIN)) });
      const endCommon = { ...common, horimetroTotal: fmt.hm(op.hourEnd), horimetroMolhado: fmt.hm(op.wetEnd), anguloAtual: `${fmt.n(op.angEnd, 2)}°` };
      if (op.fault) {
        push(op.end, "Alerta", FAULT_LABEL[op.fault], { ...endCommon, recebidoEm: fmt.dateTimeSec(op.end), tipoAlerta: FAULT_TYPE[op.fault], pressaoUltimaTorre: `${fmt.n(op.pressureTower, 1)} bar` });
      } else if (op.end.getTime() < NOW.getTime() - 41 * MIN) {
        push(op.end, "Atualização", "IRRIGAÇÃO FINALIZADA", { ...endCommon, recebidoEm: fmt.dateTimeSec(op.end) });
      }
    });
    list.sort((a, b) => b.date - a.date);
    return list;
  }

  function pivotOps(equipOrId, start, end) {
    const ctx = resolve(equipOrId);
    if (!ctx) return [];
    const range = normRange(start, end);
    return opsInRange(pivotTimeline(ctx.equip, ctx.farm).ops, range.start, range.end).sort((a, b) => b.start - a.start);
  }

  function pivotSummary(equipOrId, start, end) {
    const ctx = resolve(equipOrId);
    if (!ctx) return null;
    const { equip, farm } = ctx;
    const tl = pivotTimeline(equip, farm);
    const range = normRange(start, end);
    const ops = opsInRange(tl.ops, range.start, range.end);
    const sum = {
      model: tl.model, ops: ops.length, wetOps: 0, volume: 0, hours: 0, wetHours: 0, dryHours: 0,
      kwh: 0, kwhPeak: 0, kwhOff: 0, kwhReduced: 0, cost: 0, costPeak: 0, costOff: 0, costReduced: 0,
      hoursPeak: 0, hoursOff: 0, hoursReduced: 0,
      relLaminaMm: 0, laps: 0,
      faults: { pressure: 0, misalignment: 0, lowVoltage: 0, peakVoltage: 0 },
      rainMm: 0,
    };
    ops.forEach((op) => {
      const f = overlapFraction(op, range.start, range.end);
      sum.volume += op.volume * f;
      sum.hours += op.durH * f;
      if (op.wet) { sum.wetHours += op.durH * f; sum.wetOps += 1; } else sum.dryHours += op.durH * f;
      sum.kwhPeak += op.kwh.peak * f;
      sum.kwhOff += op.kwh.off * f;
      sum.kwhReduced += op.kwh.reduced * f;
      if (op.wet) {
        sum.hoursPeak += op.tariffHours.peak * f;
        sum.hoursOff += op.tariffHours.off * f;
        sum.hoursReduced += op.tariffHours.reduced * f;
      }
      sum.relLaminaMm += op.relLaminaMm * f;
      sum.laps += op.lap * f;
      if (op.fault && op.end >= range.start && op.end <= range.end) sum.faults[op.fault] += 1;
    });
    sum.kwh = sum.kwhPeak + sum.kwhOff + sum.kwhReduced;
    sum.costPeak = sum.kwhPeak * TARIFF.peak;
    sum.costOff = sum.kwhOff * TARIFF.off;
    sum.costReduced = sum.kwhReduced * TARIFF.reduced;
    sum.cost = sum.costPeak + sum.costOff + sum.costReduced;
    sum.rainMm = rainSeries(farm?.id, equip.id, range.start, range.end).reduce((a, x) => a + x.mm, 0);
    sum.areaHa = tl.model.areaHa;
    return sum;
  }

  // Leitura "atual" do pivô (última operação até agora)
  function pivotCurrent(equipOrId) {
    const ctx = resolve(equipOrId);
    if (!ctx) return null;
    const tl = pivotTimeline(ctx.equip, ctx.farm);
    const last = tl.ops[tl.ops.length - 1] || null;
    const weekAgo = new Date(NOW.getTime() - 7 * DAY);
    const week = pivotSummary(ctx.equip, weekAgo, NOW);
    const r = rng(`pc|${ctx.equip.id}|${dayKey(NOW)}`);
    return {
      angle: tl.angle,
      pressureCenter: last?.wet ? last.pressureCenter : tl.model.pCenter,
      pressureTower: last?.wet ? last.pressureTower : tl.model.pTower,
      voltage: Math.round(tl.model.nominalV * (0.985 + r() * 0.03)),
      hours: tl.hours,
      wetHours: tl.wet,
      laps: tl.ops.reduce((a, o) => a + o.lap, 0),
      lastOp: last,
      lastCommunication: new Date(NOW.getTime() - Math.round(2 + r() * 12) * MIN),
      rain7d: week?.rainMm || 0,
      model: tl.model,
    };
  }

  // Série de tensão: amostras a cada `stepMin` minutos dentro do período.
  function pivotVoltageSeries(equipOrId, start, end, points = 120) {
    const ctx = resolve(equipOrId);
    if (!ctx) return [];
    const tl = pivotTimeline(ctx.equip, ctx.farm);
    const range = normRange(start, end);
    const span = range.end - range.start;
    const out = [];
    for (let i = 0; i < points; i++) {
      const t = new Date(range.start.getTime() + (span * i) / Math.max(1, points - 1));
      const r = rng(`pv|${ctx.equip.id}|${Math.floor(t.getTime() / (15 * MIN))}`);
      let v = tl.model.nominalV * (0.975 + r() * 0.05 + 0.012 * Math.sin(t.getHours() / 24 * 2 * Math.PI));
      const op = tl.ops.find((o) => o.fault && (o.fault === "lowVoltage" || o.fault === "peakVoltage") && Math.abs(o.end - t) < span / points);
      if (op) v = op.voltage;
      out.push({ t, v: round(v, 1) });
    }
    return out;
  }

  // ===================================================================== BOMBA
  function pumpModel(equip) {
    const d = equip?.data || {};
    const r = rng(`bm|${equip.id}`);
    let flow = num(d.flow ?? d.vazao);
    if (!(flow > 0)) flow = Math.round(between(r, 120, 380));
    else r();
    let power = num(d.power ?? d.potencia);
    if (power > 0 && String(d.powerUnit || "").toLowerCase().includes("cv")) power *= 0.7355;
    if (!(power > 0)) power = round(flow * between(r, 0.28, 0.4), 1);
    else r();
    const limit = num(d.consumptionLimit);
    return {
      flow, power,
      pressure: round(between(r, 3.2, 6.5), 1),
      hourBase: Math.round(between(r, 300, 2400)),
      limit: d.enableConsumptionLimit && limit > 0 ? limit : null,
    };
  }

  function pumpTimeline(equip, farm) {
    const key = cacheKey("bm", equip);
    if (cache.has(key)) return cache.get(key);
    const m = pumpModel(equip);
    const r = rng(`bt|${equip.id}`);
    const farmId = farm?.id || "farm";
    const ops = [];
    let hours = m.hourBase;
    let busyUntil = HISTORY_START.getTime();
    const lastAllowed = NOW.getTime() - 30 * MIN;
    for (let d = new Date(HISTORY_START); d <= NOW; d = new Date(d.getTime() + DAY)) {
      const wx = weatherDay(farmId, d);
      const dry = RAIN_PROB_BY_MONTH[d.getMonth()] < 0.2;
      const runs = r() < (wx.rain > 8 ? 0.2 : dry ? 0.9 : 0.6) ? (r() < 0.35 ? 2 : 1) : 0;
      for (let k = 0; k < runs; k++) {
        const startHour = k === 0 ? (r() < 0.6 ? 21.5 + r() * 2 : 6 + r() * 4) : 13 + r() * 3;
        let start = new Date(dayStart(d).getTime() + startHour * HOUR);
        start = new Date(Math.round(start.getTime() / MIN) * MIN);
        if (start.getTime() < busyUntil + 20 * MIN) continue;
        let durH = between(r, 0.4, k === 0 ? 9 : 4);
        let end = new Date(start.getTime() + durH * HOUR);
        if (end.getTime() > lastAllowed) {
          if (start.getTime() > lastAllowed - HOUR) break;
          end = new Date(lastAllowed);
          durH = (end - start) / HOUR;
        }
        const via = r();
        const manual = via < 0.15;
        const failure = !manual && via > 0.97;
        const hourStart = hours;
        hours += durH;
        const tariff = splitTariff(start, end);
        const kwh = { peak: tariff.peak * m.power, off: tariff.off * m.power, reduced: tariff.reduced * m.power };
        ops.push({
          id: `${equip.id}-op${ops.length}`, start, end, durH,
          volume: m.flow * durH, kwh, kwhTotal: kwh.peak + kwh.off + kwh.reduced,
          cost: kwh.peak * TARIFF.peak + kwh.off * TARIFF.off + kwh.reduced * TARIFF.reduced,
          manual, failure, user: USERS[Math.floor(r() * USERS.length)], hourStart, hourEnd: hours,
        });
        busyUntil = end.getTime();
      }
    }
    const res = { model: m, ops, hours };
    cache.set(key, res);
    return res;
  }

  function pumpOps(equipOrId, start, end) {
    const ctx = resolve(equipOrId);
    if (!ctx) return [];
    const range = normRange(start, end);
    return opsInRange(pumpTimeline(ctx.equip, ctx.farm).ops, range.start, range.end).sort((a, b) => b.start - a.start);
  }

  function pumpEvents(equipOrId, start, end) {
    const ctx = resolve(equipOrId);
    if (!ctx) return [];
    const range = normRange(start, end);
    const s = range.start.getTime();
    const e = range.end.getTime();
    const out = [];
    const push = (date, type, status, details) => {
      if (date.getTime() >= s && date.getTime() <= e) out.push({ date, type, status, details });
    };
    opsInRange(pumpTimeline(ctx.equip, ctx.farm).ops, new Date(s - DAY), new Date(e + DAY)).forEach((op) => {
      if (op.manual) {
        push(op.start, "Atualização de Bomba", "LIGADA MANUALMENTE", { "Horímetro": fmt.hm(op.hourStart) });
        push(op.end, "Atualização de Bomba", "DESLIGADA MANUALMENTE", { "Horímetro": fmt.hm(op.hourEnd) });
        return;
      }
      push(op.start, "Comando", "LIGAR", { "Enviado por": op.user });
      push(new Date(op.start.getTime() + 20000), "Atualização de Bomba", "LIGADA VIA INTERNET", { "Horímetro": fmt.hm(op.hourStart) });
      if (op.failure) {
        push(op.end, "Atualização de Bomba", "AGUARDANDO APÓS FALHA", { "Horímetro": fmt.hm(op.hourEnd) });
      } else if (op.end.getTime() < NOW.getTime() - 31 * MIN) {
        push(op.end, "Comando", "DESLIGAR", { "Enviado por": op.user });
        push(new Date(op.end.getTime() + 20000), "Atualização de Bomba", "DESLIGADA PELA INTERNET", { "Horímetro": fmt.hm(op.hourEnd) });
      }
    });
    out.sort((a, b) => b.date - a.date);
    return out;
  }

  function dailyFromOps(ops, start, end, field) {
    const range = normRange(start, end);
    const days = [];
    for (let d = dayStart(range.start); d <= range.end; d = new Date(d.getTime() + DAY)) {
      const dEnd = new Date(d.getTime() + DAY - 1);
      let v = 0;
      ops.forEach((op) => {
        const f = overlapFraction(op, d, dEnd);
        if (f > 0) v += (typeof field === "function" ? field(op) : op[field]) * f;
      });
      days.push({ date: new Date(d), value: v });
    }
    return days;
  }

  function pumpDaily(equipOrId, start, end) {
    const ctx = resolve(equipOrId);
    if (!ctx) return [];
    return dailyFromOps(pumpTimeline(ctx.equip, ctx.farm).ops, start, end, "volume");
  }

  function pumpSummary(equipOrId, start, end) {
    const ctx = resolve(equipOrId);
    if (!ctx) return null;
    const tl = pumpTimeline(ctx.equip, ctx.farm);
    const range = normRange(start, end);
    const sum = { model: tl.model, ops: 0, volume: 0, hours: 0, kwh: 0, kwhPeak: 0, kwhOff: 0, kwhReduced: 0, cost: 0 };
    opsInRange(tl.ops, range.start, range.end).forEach((op) => {
      const f = overlapFraction(op, range.start, range.end);
      sum.ops += 1;
      sum.volume += op.volume * f;
      sum.hours += op.durH * f;
      sum.kwhPeak += op.kwh.peak * f;
      sum.kwhOff += op.kwh.off * f;
      sum.kwhReduced += op.kwh.reduced * f;
      sum.cost += op.cost * f;
    });
    sum.kwh = sum.kwhPeak + sum.kwhOff + sum.kwhReduced;
    return sum;
  }

  function pumpCurrent(equipOrId) {
    const ctx = resolve(equipOrId);
    if (!ctx) return null;
    const tl = pumpTimeline(ctx.equip, ctx.farm);
    const r = rng(`bc|${ctx.equip.id}|${dayKey(NOW)}`);
    return {
      hours: tl.hours,
      flow: tl.model.flow,
      pressure: tl.model.pressure,
      lastOp: tl.ops[tl.ops.length - 1] || null,
      lastCommunication: new Date(NOW.getTime() - Math.round(2 + r() * 12) * MIN),
      model: tl.model,
    };
  }

  // =================================================================== MEDIDOR
  function meterModel(equip) {
    const d = equip?.data || {};
    const r = rng(`mm|${equip.id}`);
    const maxM = num(d.nivelMax, round(between(r, 5, 9), 1));
    const offset = num(d.nivelOffset, 0.5);
    const minPct = clamp(num(d.nivelValMin, 20), 0, 90);
    const maxPct = clamp(num(d.nivelValMax, 90), minPct + 5, 100);
    return {
      maxM, offset, minPct, maxPct,
      base: between(r, 0.45, 0.72),
      amp: between(r, 0.08, 0.18),
      phase: r() * Math.PI * 2,
    };
  }

  // Nível em % num instante (contínuo, suave, estável)
  function meterLevelAt(equip, model, t) {
    const time = t.getTime();
    const hourAngle = ((time / HOUR) % 24) / 24 * 2 * Math.PI;
    const dayIdx = Math.floor(time / DAY);
    const slow = Math.sin(dayIdx / 9 + model.phase) * 0.08;
    const daily = Math.sin(hourAngle + model.phase) * model.amp;
    const n1 = unit(`ml|${equip.id}|${Math.floor(time / (3 * HOUR))}`) - 0.5;
    const n2 = unit(`ml|${equip.id}|${Math.floor(time / (3 * HOUR)) + 1}`) - 0.5;
    const frac = (time % (3 * HOUR)) / (3 * HOUR);
    const noise = (n1 + (n2 - n1) * frac) * 0.06;
    const pctRaw = (model.base + slow + daily + noise) * 100;
    return clamp(pctRaw, model.minPct * 0.6, Math.min(100, model.maxPct * 1.05));
  }

  function meterReadings(equipOrId, start, end, stepMin = 15) {
    const ctx = resolve(equipOrId);
    if (!ctx) return [];
    const m = meterModel(ctx.equip);
    const range = normRange(start, end);
    const step = stepMin * MIN;
    const first = Math.ceil(range.start.getTime() / step) * step;
    const out = [];
    for (let t = first; t <= range.end.getTime(); t += step) {
      const date = new Date(t);
      const pct = meterLevelAt(ctx.equip, m, date);
      const level = (pct / 100) * m.maxM;
      out.push({ date, pct: round(pct, 1), level: round(level, 2), measure: round(Math.max(0, level - m.offset), 2), offset: m.offset });
    }
    return out.reverse(); // mais recente primeiro
  }

  function meterCurrent(equipOrId) {
    const ctx = resolve(equipOrId);
    if (!ctx) return null;
    const m = meterModel(ctx.equip);
    const step = 15 * MIN;
    const t = new Date(Math.floor(NOW.getTime() / step) * step);
    const pct = meterLevelAt(ctx.equip, m, t);
    return { pct: round(pct, 1), level: round((pct / 100) * m.maxM, 2), model: m, date: t, lastCommunication: t };
  }

  // ================================================================= CARRETEL
  function reelModel(equip) {
    const d = equip?.data || {};
    const r = rng(`rm|${equip.id}`);
    const hose = num(d.hoseLength, NaN);
    const lane = num(d.laneLength, NaN);
    const flowDef = round(between(r, 14, 36), 1);
    const widthDef = 72;
    const laneDef = Math.round(between(r, 300, 420));
    const model = String(d.model || "").trim();
    return {
      flow: num(d.flowRate || d.flow, flowDef),
      width: num(d.workingWidth || d.width, widthDef),
      // comprimento útil = o menor entre mangueira e faixa desenhada
      lane: Math.round(Math.min(hose > 0 ? hose : Infinity, lane > 0 ? lane : Infinity, hose > 0 || lane > 0 ? Infinity : laneDef)) || laneDef,
      pressure: num(d.pressure || d.minPressure, round(between(r, 6, 9), 1)),
      model: model && model !== "-" ? model : "Rainstar",
      start: pt(d.startLat, d.startLng),
      reel: pt(d.reelLat, d.reelLng),
    };
  }

  function reelTimeline(equip, farm) {
    const key = cacheKey("rl", equip);
    if (cache.has(key)) return cache.get(key);
    const m = reelModel(equip);
    const r = rng(`rt|${equip.id}`);
    const farmId = farm?.id || "farm";
    const ops = [];
    let busyUntil = HISTORY_START.getTime();
    const lastAllowed = NOW.getTime() - HOUR;
    for (let d = new Date(HISTORY_START); d <= NOW; d = new Date(d.getTime() + DAY)) {
      const wx = weatherDay(farmId, d);
      const dry = RAIN_PROB_BY_MONTH[d.getMonth()] < 0.2;
      if (r() > (wx.rain > 6 ? 0.1 : dry ? 0.7 : 0.4)) continue;
      const start = new Date(Math.round((dayStart(d).getTime() + (17 + r() * 5) * HOUR) / MIN) * MIN);
      if (start.getTime() < busyUntil + HOUR) continue;
      const mr = r();
      const mode = mr < 0.55 ? "Velocidade" : mr < 0.8 ? "Zonas" : "Taxa de Irrigação";
      const baseSpeed = round(between(r, 14, 26), 2); // m/h
      const speeds = mode === "Zonas"
        ? [1.25, 1.07, 0.94, 1.07].map((k) => round(baseSpeed * k, 2))
        : [baseSpeed];
      const rr = r();
      const reason = rr < 0.8 ? "Concluído" : rr < 0.9 ? "Sensor de parada" : rr < 0.96 ? "Parada manual" : "Velocidade não atingida";
      const full = reason === "Concluído" || reason === "Sensor de parada";
      const retracted = Math.round(m.lane * (full ? between(r, 0.93, 1) : between(r, 0.45, 0.8)));
      const zoneLen = retracted / speeds.length;
      const durH = speeds.reduce((a, s) => a + zoneLen / s, 0);
      const end = new Date(start.getTime() + durH * HOUR);
      if (end.getTime() > lastAllowed) break;
      const volume = m.flow * durH;
      const areaHa = (retracted * m.width) / 10000;
      ops.push({
        id: `${equip.id}-op${ops.length}`, start, end, durH, mode, speeds, retracted, volume, areaHa,
        laminaMm: volume / (areaHa * 10),
        cfgDepths: speeds.map((s) => (m.flow / (s * m.width)) * 1000),
        pressure: round(m.pressure + (r() - 0.5) * 0.8, 1),
        reason,
        stopReason: reason,
      });
      busyUntil = end.getTime();
    }
    const res = { model: m, ops };
    cache.set(key, res);
    return res;
  }

  function reelOps(equipOrId, start, end) {
    const ctx = resolve(equipOrId);
    if (!ctx) return [];
    const range = normRange(start, end);
    return opsInRange(reelTimeline(ctx.equip, ctx.farm).ops, range.start, range.end).sort((a, b) => b.start - a.start);
  }

  function reelSummary(equipOrId, start, end) {
    const ops = reelOps(equipOrId, start, end);
    const ctx = resolve(equipOrId);
    const m = ctx ? reelTimeline(ctx.equip, ctx.farm).model : null;
    return {
      model: m, ops: ops.length,
      volume: ops.reduce((a, o) => a + o.volume, 0),
      hours: ops.reduce((a, o) => a + o.durH, 0),
      areaHa: ops.reduce((a, o) => a + o.areaHa, 0),
      laminaMm: ops.length ? ops.reduce((a, o) => a + o.laminaMm, 0) / ops.length : 0,
    };
  }

  // ============================================================ PLUVIÔMETRO
  function rainEquipSeries(equipOrId, start, end) {
    const ctx = resolve(equipOrId);
    if (!ctx) return [];
    const range = normRange(start, end);
    return rainSeries(ctx.farm?.id, ctx.equip.id, range.start, range.end);
  }

  // Distribui a chuva do dia em horas (para tabelas/medições)
  function rainHourly(equipOrId, start, end) {
    const ctx = resolve(equipOrId);
    if (!ctx) return [];
    const range = normRange(start, end);
    const out = [];
    for (let d = dayStart(range.start); d <= range.end; d = new Date(d.getTime() + DAY)) {
      rainParts(ctx.farm?.id, ctx.equip.id, d).forEach((p) => {
        if (p.date >= range.start && p.date <= range.end && p.date <= NOW) out.push(p);
      });
    }
    return out.sort((a, b) => b.date - a.date);
  }

  // ================================================================ ESTAÇÃO
  function stationDaily(equipOrId, start, end) {
    const ctx = resolve(equipOrId);
    if (!ctx) return [];
    const range = normRange(start, end);
    const out = [];
    for (let d = dayStart(range.start); d <= range.end; d = new Date(d.getTime() + DAY)) {
      const w = weatherDay(ctx.farm?.id, d);
      out.push({ ...w, rain: localRain(ctx.farm?.id, ctx.equip.id, d) });
    }
    return out;
  }

  function stationAt(equipOrId, t) {
    const ctx = resolve(equipOrId);
    if (!ctx) return null;
    const w = weatherDay(ctx.farm?.id, t);
    const h = new Date(t).getHours() + new Date(t).getMinutes() / 60;
    const k = (Math.cos(((h - 15) / 24) * 2 * Math.PI) + 1) / 2; // 1 às 15h, 0 às 3h
    const r = rng(`sa|${ctx.equip.id}|${Math.floor(new Date(t).getTime() / (30 * MIN))}`);
    return {
      temp: round(w.tmin + (w.tmax - w.tmin) * k + (r() - 0.5) * 0.6, 1),
      rh: round(clamp(w.rh + (0.5 - k) * 30 + (r() - 0.5) * 4, 12, 100), 0),
      wind: round(clamp(w.wind * (0.6 + k * 0.8) + (r() - 0.5) * 0.6, 0, 12), 1),
      windDir: Math.round((200 + Math.sin(new Date(t).getTime() / DAY) * 60 + r() * 30) % 360),
      solar: round(Math.max(0, Math.sin(((h - 6) / 12) * Math.PI)) * (w.solar * 48), 0), // W/m²
      pressure: round(1012 + (r() - 0.5) * 6 - k * 2, 1),
      eto: w.eto,
      rainDay: localRain(ctx.farm?.id, ctx.equip.id, t),
    };
  }

  // ============================================================== COSMOFIELD
  function cosmoDaily(equipOrId, start, end) {
    const ctx = resolve(equipOrId);
    if (!ctx) return [];
    const range = normRange(start, end);
    const out = [];
    // Umidade do solo integra chuva - ETo (modelo de balde)
    let moisture = 28;
    const warm = new Date(dayStart(range.start).getTime() - 30 * DAY);
    for (let d = new Date(warm); d <= range.end; d = new Date(d.getTime() + DAY)) {
      const w = weatherDay(ctx.farm?.id, d);
      const irr = unit(`ci|${ctx.equip.id}|${dayKey(d)}`) < 0.35 ? 8 : 0;
      moisture = clamp(moisture + (w.rain + irr) * 0.35 - w.eto * 0.45, 12, 42);
      if (d >= dayStart(range.start)) out.push({ date: new Date(d), moisture: round(moisture, 1), rain: w.rain, eto: w.eto });
    }
    return out;
  }

  // ===================================================================== GERAL
  function lastCommunication(equipOrId) {
    const ctx = resolve(equipOrId);
    if (!ctx) return new Date(NOW);
    const r = rng(`lc|${ctx.equip.id}|${dayKey(NOW)}`);
    return new Date(NOW.getTime() - Math.round(1 + r() * 14) * MIN);
  }

  // Paginação genérica: devolve HTML dos botões ‹ 1 2 3 … N ›
  function paginationHtml(current, total, opts = {}) {
    total = Math.max(1, total);
    current = clamp(current, 1, total);
    const btn = opts.btnClass || "btn-page";
    const pages = [];
    if (total <= 7) for (let i = 1; i <= total; i++) pages.push(i);
    else {
      pages.push(1);
      const a = Math.max(2, current - 1);
      const b = Math.min(total - 1, current + 1);
      if (a > 2) pages.push("…");
      for (let i = a; i <= b; i++) pages.push(i);
      if (b < total - 1) pages.push("…");
      pages.push(total);
    }
    const prevDis = current <= 1 ? " disabled" : "";
    const nextDis = current >= total ? " disabled" : "";
    return [
      `<button type="button" class="${btn}" data-page="${current - 1}" aria-label="Página anterior"${prevDis}><i class="fa-solid fa-chevron-left"></i></button>`,
      ...pages.map((p) => (p === "…"
        ? `<button type="button" class="${btn} is-static" tabindex="-1" aria-hidden="true">...</button>`
        : `<button type="button" class="${btn}${p === current ? " is-active" : ""}" data-page="${p}"${p === current ? ' aria-current="page"' : ""}>${p}</button>`)),
      `<button type="button" class="${btn}" data-page="${current + 1}" aria-label="Próxima página"${nextDis}><i class="fa-solid fa-chevron-right"></i></button>`,
    ].join("");
  }

  // Lê o período selecionado nos objetos de estado das telas (formatos variados)
  function periodFrom(obj, fallbackDays = 7) {
    const s = obj?.start || obj?.from || obj?.inicio;
    const e = obj?.end || obj?.to || obj?.fim;
    if (s && e) return normRange(s, e);
    return normRange(new Date(dayStart(NOW).getTime() - (fallbackDays - 1) * DAY), NOW);
  }

  window.IcDemoHistory = {
    NOW, DAY, HOUR, MIN, HISTORY_START, TARIFF,
    hash, rng, unit, round, clamp, dayStart, dayKey, normRange, periodFrom, fmt,
    activeFarm, equipmentsOf, findEquipment, kindOf, listByKind,
    weatherDay, localRain, rainSeries,
    pivot: { model: (e) => pivotModel(resolve(e).equip), timeline: (e) => { const c = resolve(e); return c ? pivotTimeline(c.equip, c.farm) : null; }, ops: pivotOps, events: pivotEvents, summary: pivotSummary, current: pivotCurrent, voltage: pivotVoltageSeries, statusLine: pivotStatusLine, FAULT_LABEL },
    pump: { ops: pumpOps, events: pumpEvents, daily: pumpDaily, summary: pumpSummary, current: pumpCurrent },
    meter: { readings: meterReadings, current: meterCurrent, model: (e) => meterModel(resolve(e).equip) },
    reel: { ops: reelOps, summary: reelSummary, model: (e) => reelModel(resolve(e).equip) },
    rain: { daily: rainEquipSeries, hourly: rainHourly },
    station: { daily: stationDaily, at: stationAt },
    cosmo: { daily: cosmoDaily },
    dailyFromOps, lastCommunication, paginationHtml,
  };
})();
