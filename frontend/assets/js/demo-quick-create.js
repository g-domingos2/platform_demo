// assets/js/demo-quick-create.js
// DEMO — "Criar rápido" na barra de simulação.
// Pivô:     1º clique = centro  →  2º clique = borda (define o raio).
// Carretel: 1º clique = carretel → 2º clique = início do carrinho (fim da mangueira).
// Esc ou botão direito cancela. Salva pelo mesmo caminho do cadastro normal
// (IcFarmsAddEquipment), então no localhost:3100 já vai para o farms.json.
(function initDemoQuickCreate() {
  "use strict";

  const CARRETEL_WIDTH = 72; // m — largura da faixa usada no desenho
  const MIN_PIVOT_RADIUS = 30; // m
  const MIN_LANE = 20; // m

  const L = () => window.L;
  const getMap = () => window.icMap;

  // ------------------------------------------------------------ helpers
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const deg = (r) => (r * 180) / Math.PI;
  const dist = (a, b) => {
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  const bearing = (a, b) => {
    const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
    const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
    return (deg(Math.atan2(y, x)) + 360) % 360;
  };
  const dest = (p, brgDeg, m) => {
    const br = rad(brgDeg);
    const d = m / R;
    const lat1 = rad(p.lat);
    const lng1 = rad(p.lng);
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(br));
    const lng2 = lng1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
    return { lat: deg(lat2), lng: deg(lng2) };
  };
  const lanePolygon = (a, b, width) => {
    const br = bearing(a, b);
    const h = width / 2;
    return [dest(a, br - 90, h), dest(b, br - 90, h), dest(b, br + 90, h), dest(a, br + 90, h)].map((p) => [p.lat, p.lng]);
  };
  const fmtM = (m) => (m >= 1000 ? `${(m / 1000).toFixed(2).replace(".", ",")} km` : `${Math.round(m)} m`);
  const fmtCoord = (p) => `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`;

  function activeFarm() {
    return window.IcFarmGetActive?.() || window.IcFarmActive || null;
  }

  // "Pivô 01", "Pivô 02"... seguindo o maior número já usado
  function nextName(base, type) {
    const list = (activeFarm()?.equipments || []).filter((e) => e?.type === type || (type === "pivot" && e?.category === "pivos"));
    let max = 0;
    list.forEach((e) => {
      const m = String(e?.name || "").match(/(\d+)\s*$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    max = Math.max(max, list.length);
    return `${base} ${String(max + 1).padStart(2, "0")}`;
  }

  function notify(msg, ok = true) {
    if (ok) window.IcNotify?.success?.(msg);
    else window.IcNotify?.error?.(msg);
  }

  // ------------------------------------------------------------ salvar
  function afterCreate() {
    setTimeout(() => {
      const farm = activeFarm();
      if (farm) window.IcMapRenderPivots?.(farm);
      window.IcMapSimulation?.refresh?.();
      window.IcSimulation?.refresh?.();
    }, 0);
  }

  function createPivot(center, edge) {
    const radius = Math.round(dist(center, edge));
    // referência (0°) apontando para o norte, na borda do pivô
    const ref = dest(center, 0, radius);
    const name = nextName("Pivô", "smart_connect");
    window.IcFarmsAddEquipment?.({
      type: "smart_connect",
      name,
      createdAt: new Date().toISOString(),
      data: {
        name,
        centerLat: center.lat,
        centerLng: center.lng,
        center: fmtCoord(center),
        radius: String(radius),
        bearing: 0,
        ref: fmtCoord(ref),
        refLat: ref.lat,
        refLng: ref.lng,
        segments: [{ name: "Segmento 1", startAngle: 0, endAngle: 360 }],
        activeSegIdx: 0,
        canhaoSegments: [],
        activeCanhaoSegIdx: 0,
        canhaoMode: "off",
        manufacturer: "Bauer",
        panelType: "Nexus",
        powerUnit: "kw",
        commType: "4G",
        pressure: "pressostato",
        voltageController: true,
        minVoltage: "400",
        maxVoltage: "600",
        quickCreated: true,
      },
    });
    afterCreate();
    notify(`${name} criado (raio ${fmtM(radius)}).`);
  }

  function createCarretel(reel, start) {
    const lane = Math.round(dist(start, reel));
    const name = nextName("Carretel", "rainstar");
    window.IcFarmsAddEquipment?.({
      type: "rainstar",
      name,
      createdAt: new Date().toISOString(),
      data: {
        name,
        reelLat: reel.lat,
        reelLng: reel.lng,
        startLat: start.lat,
        startLng: start.lng,
        initialLat: start.lat,
        initialLng: start.lng,
        laneLength: lane,
        hoseLength: String(Math.max(lane, 100)),
        workingWidth: String(CARRETEL_WIDTH),
        width: String(CARRETEL_WIDTH),
        setupMethod: "Puxando o carrinho (Padrão)",
        method: "Puxando o carrinho (Padrão)",
        model: "-",
        connectivityType: "4g",
        status: "stopped_stop_sensor",
        statusText: "PARADO POR SENSOR DE PARADA",
        connected: true,
        signal: "Bom",
        battery: 100,
        irrigationProgress: 0,
        irrigatedPipeLength: 0,
        startPositionPendingIrrigation: true,
        pulledPipeLength: lane,
        hosePulledLength: lane,
        lastCommunication: new Date().toISOString(),
        quickCreated: true,
      },
    });
    afterCreate();
    notify(`${name} criado (faixa de ${fmtM(lane)}).`);
  }

  // ------------------------------------------------------------ modo desenho
  let mode = null; // "pivot" | "carretel"
  let first = null;
  let layer = null;
  let preview = {};
  let hintEl = null;

  function setHint(text) {
    if (!hintEl) {
      hintEl = document.createElement("div");
      hintEl.className = "qc-hint";
      document.body.appendChild(hintEl);
    }
    hintEl.innerHTML = `${text}<span class="qc-hint__esc">Esc cancela</span>`;
    hintEl.classList.add("is-on");
  }

  function start(kind) {
    const map = getMap();
    if (!map || !L()) return;
    if (!activeFarm()) { notify("Selecione uma fazenda primeiro.", false); return; }
    if (mode) stop();
    mode = kind;
    first = null;
    preview = {};
    layer = L().layerGroup().addTo(map);
    map.getContainer().classList.add("qc-drawing");
    document.body.classList.add("is-quick-drawing");
    map.doubleClickZoom?.disable();
    setTimeout(() => {
      if (mode !== kind) return;
      map.on("click", onClick);
      map.on("mousemove", onMove);
      map.on("contextmenu", onCancel);
    }, 0);
    document.addEventListener("keydown", onKey, true);
    setHint(kind === "pivot"
      ? "<b>Pivô:</b> clique no <b>centro</b> do pivô"
      : "<b>Carretel:</b> clique onde fica o <b>carretel</b>");
    syncButtons();
  }

  function stop() {
    const map = getMap();
    if (map) {
      map.off("click", onClick);
      map.off("mousemove", onMove);
      map.off("contextmenu", onCancel);
      // mantém os equipamentos "não clicáveis" mais um instante: o mesmo
      // clique que finaliza o desenho não pode abrir o pivô que está embaixo
      const container = map.getContainer();
      clearTimeout(stop._t);
      stop._t = setTimeout(() => { if (!mode) container.classList.remove("qc-drawing"); }, 400);
      map.doubleClickZoom?.enable();
      if (layer) map.removeLayer(layer);
    }
    document.removeEventListener("keydown", onKey, true);
    document.body.classList.remove("is-quick-drawing");
    hintEl?.classList.remove("is-on");
    mode = null;
    first = null;
    layer = null;
    preview = {};
    syncButtons();
  }

  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); stop(); }
  }
  function onCancel(e) {
    e?.originalEvent?.preventDefault?.();
    stop();
  }

  function label(latlng, text) {
    if (!preview.label) {
      preview.label = L().tooltip({ permanent: true, direction: "right", offset: [14, 0], className: "qc-label" })
        .setLatLng(latlng).setContent(text).addTo(layer);
    } else {
      preview.label.setLatLng(latlng).setContent(text);
    }
  }

  // A barra de simulação, o card e os controles ficam dentro do container do
  // mapa: cliques/movimentos neles não podem virar ponto do desenho.
  const isOnMapSurface = (e) => {
    const t = e?.originalEvent?.target;
    if (!t || !t.closest) return true;
    return !t.closest(".sim-bar, .sim-trigger, .map-card, .leaflet-control, .qc-hint, button, input, select, a, [class*='map-equip'], [class*='weather']");
  };

  function onClick(e) {
    if (!isOnMapSurface(e)) return;
    const p = { lat: e.latlng.lat, lng: e.latlng.lng };
    if (!first) {
      first = p;
      L().circleMarker([p.lat, p.lng], {
        radius: 5, color: "#fff", weight: 2, fillColor: mode === "pivot" ? "#dac422" : "#0f172a", fillOpacity: 1, interactive: false,
      }).addTo(layer);
      setHint(mode === "pivot"
        ? "<b>Pivô:</b> clique na <b>borda</b> para definir o tamanho"
        : "<b>Carretel:</b> clique onde o <b>carrinho começa</b> (fim da mangueira)");
      return;
    }

    const d = dist(first, p);
    if (mode === "pivot") {
      if (d < MIN_PIVOT_RADIUS) { notify(`Pivô muito pequeno (mínimo ${MIN_PIVOT_RADIUS} m de raio).`, false); return; }
      const c = first;
      stop();
      createPivot(c, p);
    } else {
      if (d < MIN_LANE) { notify(`Faixa muito curta (mínimo ${MIN_LANE} m).`, false); return; }
      const reel = first;
      stop();
      createCarretel(reel, p);
    }
  }

  function onMove(e) {
    if (!first || !layer || !isOnMapSurface(e)) return;
    const p = { lat: e.latlng.lat, lng: e.latlng.lng };
    const d = dist(first, p);

    if (mode === "pivot") {
      if (!preview.circle) {
        preview.circle = L().circle([first.lat, first.lng], {
          radius: d, color: "#edb320", weight: 2, dashArray: "6 6", fillColor: "#dac422", fillOpacity: 0.35, interactive: false,
        }).addTo(layer);
        preview.radiusLine = L().polyline([], { color: "#fff", weight: 2, dashArray: "4 4", interactive: false }).addTo(layer);
      }
      preview.circle.setRadius(d);
      preview.radiusLine.setLatLngs([[first.lat, first.lng], [p.lat, p.lng]]);
      label(e.latlng, `Raio ${fmtM(d)} · ${(Math.PI * d * d / 10000).toFixed(1).replace(".", ",")} ha`);
    } else {
      if (!preview.lane) {
        preview.lane = L().polygon([], { color: "#d98c00", weight: 1.5, dashArray: "6 6", fillColor: "#d98c00", fillOpacity: 0.45, interactive: false }).addTo(layer);
        preview.axis = L().polyline([], { color: "#fff", weight: 2, dashArray: "4 4", interactive: false }).addTo(layer);
      }
      if (d > 1) preview.lane.setLatLngs(lanePolygon(p, first, CARRETEL_WIDTH));
      preview.axis.setLatLngs([[first.lat, first.lng], [p.lat, p.lng]]);
      label(e.latlng, `Faixa ${fmtM(d)}`);
    }
  }

  // ------------------------------------------------------------ botões na barra
  function syncButtons() {
    document.querySelectorAll("[data-qc]").forEach((b) => b.classList.toggle("is-active", b.dataset.qc === mode));
  }

  function mountButtons() {
    const inner = document.querySelector("#simBar .sim-bar__inner");
    const controls = inner?.querySelector(".sim-bar__controls");
    if (!inner || !controls || inner.querySelector(".sim-bar__quick")) return;
    const sep = document.createElement("div");
    sep.className = "sim-bar__sep";
    const box = document.createElement("div");
    box.className = "sim-bar__quick";
    box.innerHTML = `
      <span class="sim-bar__quick-label">Criar rápido</span>
      <div class="sim-bar__quick-btns">
        <button type="button" class="sim-bar__quick-btn" data-qc="pivot" title="Desenhar pivô no mapa"><i class="fa-solid fa-circle-dot"></i> Pivô</button>
        <button type="button" class="sim-bar__quick-btn" data-qc="carretel" title="Desenhar carretel no mapa"><i class="fa-solid fa-tape"></i> Carretel</button>
      </div>`;
    controls.after(sep, box);
    box.querySelectorAll("[data-qc]").forEach((b) => b.addEventListener("click", () => {
      if (mode === b.dataset.qc) stop();
      else start(b.dataset.qc);
    }));
  }

  // sair do desenho se trocar de tela / fechar a barra
  window.addEventListener("ic:route-change", () => mode && stop());
  document.addEventListener("click", (e) => {
    if (mode && e.target.closest("#btnSimClose, .nav__item, .map-card__edit, #btnCreateEquipment")) stop();
  }, true);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountButtons);
  else mountButtons();

  window.IcQuickCreate = { start, stop, get mode() { return mode; } };
})();
