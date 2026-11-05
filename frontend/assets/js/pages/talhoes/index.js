// assets/js/pages/talhoes/index.js
(function () {
  "use strict";
  const tMsg = (text) => window.IcI18n?.t?.(text) ?? text;

  const POLY_COLOR = "#eab308";

  const state = {
    // Mapa
    map: null,
    drawLayer: null,    // geometria de rascunho enquanto desenha
    editLayer: null,    // polígono ativo + handles de edição
    savedLayerGroup: null, // talhões já salvos

    // Desenho (estilo cadastros)
    isDrawing: false,
    points: [],         // [{lat, lng}] — pontos do polígono atual
    hoverPoint: null,
    draftLine: null,
    previewPolygon: null,
    polygon: null,      // layer do polígono ativo
    vertexMarkers: [],
    midpointMarkers: [],

    // Dados
    savedTalhoes: [],
    selectedId: null,
    editingId: null,    // null = novo talhão, id = editando

    // View
    viewMode: "list",   // "list" | "form"
  };

  /* =========================================================
     FARM HELPERS
     ========================================================= */
  function getFarmData() {
    const s = window.CreateFarm?.state;
    const farms = Array.isArray(s?.farms) ? s.farms : [];
    const activeId = s?.currentFarmId
      || sessionStorage.getItem("ic_active_farm")
      || sessionStorage.getItem("ic_active_farm_id");
    let farm = farms.find((f) => f.id === activeId) || farms[0];
    if (!farm) {
      try {
        const stored = JSON.parse(localStorage.getItem("ic_farms") || "[]");
        if (Array.isArray(stored)) farm = stored.find((f) => f.id === activeId) || stored[0];
      } catch (_) {}
    }
    return farm || { id: activeId || "default" };
  }

  function getActiveFarmId() {
    return getFarmData()?.id || "default";
  }

  function resolveCenter() {
    const farm = getFarmData();
    if (farm) {
      if (Number.isFinite(farm.lat) && Number.isFinite(farm.lng)) return { lat: farm.lat, lng: farm.lng };
      const parts = String(farm.loc || "").split(",").map((v) => v.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const lat = Number(parts[0]);
        const lng = Number(parts[1]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
      }
    }
    return { lat: -22.008419, lng: -46.812567 };
  }

  /* =========================================================
     STORAGE
     ========================================================= */
  function saveTalhoesToStorage() {
    if (typeof window.Cad?.data?.saveTalhoesByFarm === "function") {
      window.Cad.data.saveTalhoesByFarm(getActiveFarmId(), state.savedTalhoes);
    }
    try {
      localStorage.setItem(`talhoes_${getActiveFarmId()}`, JSON.stringify(state.savedTalhoes));
    } catch (e) {
      console.warn("Failed to save talhoes", e);
    }
  }

  async function loadTalhoesFromStorage() {
    if (typeof window.Cad?.data?.loadSharedAppState === "function") {
      try { await window.Cad.data.loadSharedAppState(); } catch (_) {}
    }
    try {
      if (typeof window.Cad?.data?.getTalhoesByFarm === "function") {
        state.savedTalhoes = window.Cad.data.getTalhoesByFarm(getActiveFarmId()) || [];
      } else {
        const data = localStorage.getItem(`talhoes_${getActiveFarmId()}`);
        state.savedTalhoes = data ? JSON.parse(data) : [];
      }
      if (!Array.isArray(state.savedTalhoes)) state.savedTalhoes = [];
    } catch (e) {
      state.savedTalhoes = [];
    }
    reRenderAllTalhoes();
    renderSidebarList();
  }

  /* =========================================================
     ÁREA
     ========================================================= */
  function calculateAreaHa(latLngs) {
    if (!latLngs || latLngs.length < 3) return 0;
    const R = 6378137;
    let area = 0;
    for (let i = 0; i < latLngs.length; i++) {
      const p1 = latLngs[i];
      const p2 = latLngs[(i + 1) % latLngs.length];
      area +=
        ((p2.lng - p1.lng) * (Math.PI / 180)) *
        (2 + Math.sin(p1.lat * (Math.PI / 180)) + Math.sin(p2.lat * (Math.PI / 180)));
    }
    return Math.abs((area * R * R) / 2) / 10000;
  }

  /* =========================================================
     MAPA
     ========================================================= */
  function initMap() {
    const mapEl = document.getElementById("talhoesMap");
    if (!mapEl || !window.L) return;
    if (state.map) {
      try { state.map.remove(); } catch (_) {}
      state.map = null;
    }

    const center = resolveCenter();
    const map = L.map(mapEl, { zoomControl: false }).setView([center.lat, center.lng], 15);

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, attribution: "Tiles © Esri" }
    ).addTo(map);
    L.tileLayer(
      "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, opacity: 0.85 }
    ).addTo(map);

    state.map = map;
    state.drawLayer = L.layerGroup().addTo(map);
    state.editLayer = L.layerGroup().addTo(map);
    state.savedLayerGroup = L.layerGroup().addTo(map);

    bindMapEvents();
    setTimeout(() => map.invalidateSize(), 120);
    setTimeout(() => {
      Promise.resolve(loadTalhoesFromStorage()).catch((e) => console.error("Error loading talhoes", e));
    }, 200);
  }

  /* =========================================================
     EVENTOS DO MAPA (estilo cadastros)
     ========================================================= */
  function bindMapEvents() {
    if (!state.map || state.map.__icFarmTalhoesBound) return;

    state.map.on("click", (e) => {
      if (!state.isDrawing || !e?.latlng) return;
      state.points.push({ lat: Number(e.latlng.lat), lng: Number(e.latlng.lng) });
      renderDraftGeometry();
    });

    state.map.on("mousemove", (e) => {
      if (!state.isDrawing || !e?.latlng) return;
      state.hoverPoint = { lat: Number(e.latlng.lat), lng: Number(e.latlng.lng) };
      renderDraftGeometry();
    });

    // Botão direito finaliza
    state.map.on("contextmenu", (e) => {
      if (!state.isDrawing) return;
      if (e) L.DomEvent.stop(e);
      finalizeDraw();
    });

    state.map.__icFarmTalhoesBound = true;
  }

  /* =========================================================
     GEOMETRIA DE RASCUNHO (estilo cadastros — linha tracejada + preview)
     ========================================================= */
  function renderDraftGeometry() {
    if (!state.drawLayer) return;
    const basePoints = Array.isArray(state.points) ? state.points : [];
    const points = [...basePoints];
    if (state.hoverPoint) points.push(state.hoverPoint);

    if (!state.draftLine) {
      state.draftLine = L.polyline([], {
        color: POLY_COLOR,
        weight: 2,
        opacity: 0.95,
        dashArray: "5,5",
      }).addTo(state.drawLayer);
    }
    state.draftLine.setLatLngs(
      points.length > 1 ? points : basePoints.length === 1 ? basePoints : []
    );

    if (points.length >= 2) {
      if (!state.previewPolygon) {
        state.previewPolygon = L.polygon([], {
          color: POLY_COLOR,
          weight: 2,
          fill: false,
        }).addTo(state.drawLayer);
      }
      state.previewPolygon.setLatLngs(points);
    } else if (state.previewPolygon) {
      state.previewPolygon.remove();
      state.previewPolygon = null;
    }
  }

  function clearDraft() {
    if (state.draftLine) { state.draftLine.remove(); state.draftLine = null; }
    if (state.previewPolygon) { state.previewPolygon.remove(); state.previewPolygon = null; }
    state.hoverPoint = null;
  }

  /* =========================================================
     FINALIZAR DESENHO
     ========================================================= */
  function finalizeDraw() {
    if (state.points.length < 3) return;
    const finalPoints = state.points.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }));

    if (state.polygon) { state.polygon.remove(); state.polygon = null; }
    state.polygon = L.polygon(finalPoints, { color: POLY_COLOR, weight: 2, fill: false }).addTo(state.editLayer);
    state.points = finalPoints;
    state.isDrawing = false;
    clearDraft();
    if (state.map?.doubleClickZoom) state.map.doubleClickZoom.enable();
    rebuildEditHandles();
    updateDrawUI();
  }

  /* =========================================================
     HANDLES DE EDIÇÃO (vértices + pontos médios)
     ========================================================= */
  function makeIcon(size, bg, border) {
    return L.divIcon({
      className: "",
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:999px;background:${bg};border:2px solid ${border};box-shadow:0 1px 4px rgba(0,0,0,.28);"></span>`,
    });
  }

  function clearEditHandles() {
    state.vertexMarkers.forEach((m) => m.remove());
    state.midpointMarkers.forEach((m) => m.remove());
    state.vertexMarkers = [];
    state.midpointMarkers = [];
  }

  function rebuildEditHandles() {
    clearEditHandles();
    if (!state.editLayer || !state.polygon || state.points.length < 3) return;

    // Vértices
    state.points.forEach((point, index) => {
      const marker = L.marker([point.lat, point.lng], {
        draggable: true,
        icon: makeIcon(12, "#ffffff", "#16a34a"),
        zIndexOffset: 1200,
      }).addTo(state.editLayer);

      marker.on("drag", () => {
        const ll = marker.getLatLng();
        state.points[index] = { lat: Number(ll.lat), lng: Number(ll.lng) };
        if (state.polygon) state.polygon.setLatLngs(state.points);
      });
      marker.on("dragend", () => rebuildEditHandles());
      state.vertexMarkers.push(marker);
    });

    // Pontos médios
    for (let i = 0; i < state.points.length; i++) {
      const p1 = state.points[i];
      const p2 = state.points[(i + 1) % state.points.length];
      const mid = { lat: (p1.lat + p2.lat) / 2, lng: (p1.lng + p2.lng) / 2 };

      const midMarker = L.marker([mid.lat, mid.lng], {
        draggable: true,
        icon: makeIcon(10, "#dcfce7", "#15803d"),
        zIndexOffset: 1100,
      }).addTo(state.editLayer);

      midMarker.__insertIndex = i + 1;

      midMarker.on("dragstart", () => {
        const ll = midMarker.getLatLng();
        state.points.splice(midMarker.__insertIndex, 0, { lat: Number(ll.lat), lng: Number(ll.lng) });
        if (state.polygon) state.polygon.setLatLngs(state.points);
      });
      midMarker.on("drag", () => {
        if (typeof midMarker.__insertIndex !== "number") return;
        const ll = midMarker.getLatLng();
        state.points[midMarker.__insertIndex] = { lat: Number(ll.lat), lng: Number(ll.lng) };
        if (state.polygon) state.polygon.setLatLngs(state.points);
      });
      midMarker.on("dragend", () => rebuildEditHandles());
      state.midpointMarkers.push(midMarker);
    }
  }

  /* =========================================================
     LIMPAR POLÍGONO
     ========================================================= */
  function clearPolygon() {
    if (state.polygon) { state.polygon.remove(); state.polygon = null; }
    clearEditHandles();
    clearDraft();
    state.points = [];
    state.isDrawing = false;
    if (state.map?.doubleClickZoom) state.map.doubleClickZoom.enable();
    updateDrawUI();
  }

  /* =========================================================
     UI DO BOTÃO DESENHAR
     ========================================================= */
  function updateDrawUI() {
    const startBtn = document.getElementById("talhaoStartDrawBtn");
    if (startBtn) {
      const active = !!state.isDrawing;
      startBtn.classList.toggle("is-active", active);
      startBtn.title = active ? "Finalizar polígono" : "Desenhar talhão";
      startBtn.setAttribute("aria-label", active ? "Finalizar polígono" : "Desenhar talhão");
      const img = startBtn.querySelector("img");
      if (img) {
        img.src = active ? "assets/img/svg/pencil.svg" : "assets/img/svg/waypoints.svg";
      }
    }
    if (state.map?.getContainer) {
      state.map.getContainer().style.cursor = state.isDrawing ? "crosshair" : "";
    }
  }

  /* =========================================================
     DRAWER (abre/fecha sobre o mapa)
     ========================================================= */
  function openDrawer(talhao = null) {
    state.editingId = talhao?.id || null;

    const drawer = document.getElementById("talhoesDrawer");
    const mapWrap = document.querySelector("#talhoesPanel .talhoes__map");
    if (drawer) { drawer.classList.add("is-open"); drawer.setAttribute("aria-hidden", "false"); }
    if (mapWrap) mapWrap.classList.add("is-drawer-open");

    const nameInput = document.getElementById("talhao_name");
    const soilInput = document.getElementById("talhao_soil");
    const cropInput = document.getElementById("talhao_crop");
    if (nameInput) nameInput.value = talhao?.name || "";
    if (soilInput) soilInput.value = talhao?.soil || "";
    if (cropInput) cropInput.value = talhao?.crop || "";

    // Restaura polígono se editando
    if (state.editLayer) state.editLayer.clearLayers();
    clearPolygon();

    if (talhao?.points?.length >= 3) {
      state.points = talhao.points.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }));
      state.polygon = L.polygon(state.points, { color: POLY_COLOR, weight: 2, fill: false }).addTo(state.editLayer);
      rebuildEditHandles();
      if (state.map) {
        const bounds = L.latLngBounds(state.points.map((p) => [p.lat, p.lng]));
        state.map.fitBounds(bounds, { padding: [42, 42], maxZoom: 16 });
      }
    }

    if (state.map) setTimeout(() => state.map.invalidateSize(), 50);
    updateDrawUI();
  }

  function closeDrawer() {
    const drawer = document.getElementById("talhoesDrawer");
    const mapWrap = document.querySelector("#talhoesPanel .talhoes__map");
    if (drawer) { drawer.classList.remove("is-open"); drawer.setAttribute("aria-hidden", "true"); }
    if (mapWrap) mapWrap.classList.remove("is-drawer-open");

    if (state.editLayer) state.editLayer.clearLayers();
    clearPolygon();
    state.editingId = null;

    if (state.map) setTimeout(() => state.map.invalidateSize(), 50);
  }

  // Aliases usados internamente
  function showListView() { closeDrawer(); }
  function showFormView(talhao = null) { openDrawer(talhao); }

  /* =========================================================
     SALVAR TALHÃO
     ========================================================= */
  function saveTalhao() {
    const name = document.getElementById("talhao_name")?.value?.trim();
    const soil = document.getElementById("talhao_soil")?.value;
    const crop = document.getElementById("talhao_crop")?.value;

    if (!name || !soil || !crop) {
      alert(tMsg("Preencha todos os campos (Nome, Solo, Plantio)."));
      return;
    }
    if (state.points.length < 3) {
      alert(tMsg("Desenhe o polígono do talhão no mapa."));
      return;
    }

    const areaHa = calculateAreaHa(state.points);
    const center = L.polygon(state.points.map((p) => [p.lat, p.lng])).getBounds().getCenter();

    if (state.editingId) {
      const idx = state.savedTalhoes.findIndex((t) => t.id === state.editingId);
      if (idx !== -1) {
        state.savedTalhoes[idx] = {
          ...state.savedTalhoes[idx],
          name, soil, crop,
          area: areaHa.toFixed(2),
          points: [...state.points],
          center: { lat: center.lat, lng: center.lng },
        };
      }
    } else {
      state.savedTalhoes.push({
        id: Date.now(),
        farmId: getActiveFarmId(),
        name, soil, crop,
        area: areaHa.toFixed(2),
        points: [...state.points],
        center: { lat: center.lat, lng: center.lng },
      });
    }

    saveTalhoesToStorage();
    reRenderAllTalhoes();
    renderSidebarList();
    showListView();
  }

  /* =========================================================
     RENDERIZAR TALHÕES SALVOS NO MAPA
     ========================================================= */
  function reRenderAllTalhoes() {
    if (!state.savedLayerGroup) return;
    state.savedLayerGroup.clearLayers();
    state.savedTalhoes.forEach((t) => {
      if (!t.points?.length) return;
      const poly = L.polygon(t.points.map((p) => [p.lat, p.lng]), {
        color: POLY_COLOR,
        weight: 2,
        fillOpacity: 0.15,
      }).addTo(state.savedLayerGroup);
      poly.bindPopup(`<strong>${t.name}</strong><br>${t.area} ha`);
    });
  }

  /* =========================================================
     LISTA LATERAL
     ========================================================= */
  function renderSidebarList() {
    const emptyEl = document.getElementById("talhoesEmpty");
    const listEl = document.getElementById("talhoesListItems");
    if (!listEl) return;

    if (state.savedTalhoes.length === 0) {
      if (emptyEl) emptyEl.style.display = "flex";
      listEl.innerHTML = "";
      return;
    }

    if (emptyEl) emptyEl.style.display = "none";
    listEl.innerHTML = state.savedTalhoes
      .map(
        (t) => `
      <div class="talhoes__item${t.id === state.selectedId ? " is-selected" : ""}" onclick="window._IcTalhoesSelect(${t.id})">
        <span class="talhoes__item-name">${t.name}</span>
        <div class="talhoes__item-actions">
          <button class="talhoes__btn-action" title="Editar" onclick="event.stopPropagation();window._IcTalhoesEdit(${t.id})"><i class="fa-solid fa-pen"></i></button>
          <button class="talhoes__btn-action text-red" title="Excluir" onclick="event.stopPropagation();window._IcTalhoesDelete(${t.id})"><i class="fa-regular fa-trash-can"></i></button>
        </div>
      </div>`
      )
      .join("");
  }

  /* =========================================================
     PAINEL DE DETALHES
     ========================================================= */
  function renderDetails(talhao) {
    const el = document.querySelector("#talhoesPanel .talhoes__details");
    if (!el || !talhao) return;
    const c = talhao.center;
    el.innerHTML = `
      <div class="talhoes__detail-grid">
        <div class="talhoes__detail-header">Informações do Talhão</div>
        <div class="talhoes__detail-row"><span class="talhoes__detail-label">Nome:</span><span class="talhoes__detail-value">${talhao.name}</span></div>
        <div class="talhoes__detail-row"><span class="talhoes__detail-label">Plantio:</span><span class="talhoes__detail-value">${talhao.crop}</span></div>
        <div class="talhoes__detail-row"><span class="talhoes__detail-label">Área:</span><span class="talhoes__detail-value">${talhao.area} ha</span></div>
        <div class="talhoes__detail-row"><span class="talhoes__detail-label">Tipo de Solo:</span><span class="talhoes__detail-value">${talhao.soil}</span></div>
        ${c ? `<div class="talhoes__detail-row" style="grid-column:span 2"><span class="talhoes__detail-label">Posição:</span><span class="talhoes__detail-value">${c.lat?.toFixed(6)}, ${c.lng?.toFixed(6)}</span></div>` : ""}
      </div>`;
  }

  /* =========================================================
     BINDINGS DA UI
     ========================================================= */
  function bindUI() {
    // Botão adicionar (lista)
    const addBtn = document.getElementById("talhoesAddBtn");
    if (addBtn) addBtn.onclick = () => showFormView(null);

    // Botão Desenhar / Finalizar
    const startBtn = document.getElementById("talhaoStartDrawBtn");
    if (startBtn) {
      startBtn.onclick = () => {
        if (state.isDrawing) {
          finalizeDraw();
          return;
        }
        // Limpa estado anterior e inicia novo desenho
        if (state.editLayer) state.editLayer.clearLayers();
        state.polygon = null;
        state.points = [];
        state.isDrawing = true;
        state.hoverPoint = null;
        if (state.map?.doubleClickZoom) state.map.doubleClickZoom.disable();
        renderDraftGeometry();
        updateDrawUI();
      };
    }

    // Botão Limpar / delete
    const clearBtn = document.getElementById("talhaoClearDrawBtn");
    if (clearBtn) {
      clearBtn.onclick = () => {
        state.isDrawing = false;
        if (state.editLayer) state.editLayer.clearLayers();
        state.polygon = null;
        clearPolygon();
      };
    }

    // Cancelar / Salvar formulário
    const cancelBtn = document.getElementById("talhoesCancelBtn");
    if (cancelBtn) cancelBtn.onclick = () => showListView();

    const saveBtn = document.getElementById("talhoesSaveBtn");
    if (saveBtn) saveBtn.onclick = () => saveTalhao();
  }

  /* =========================================================
     AÇÕES GLOBAIS (chamadas pelo HTML inline)
     ========================================================= */
  window._IcTalhoesSelect = (id) => {
    state.selectedId = id;
    renderSidebarList();
    const t = state.savedTalhoes.find((t) => t.id === id);
    if (t) {
      renderDetails(t);
      if (state.map && t.points?.length) {
        state.map.fitBounds(L.latLngBounds(t.points.map((p) => [p.lat, p.lng])), { padding: [50, 50] });
      }
    }
  };

  window._IcTalhoesEdit = (id) => {
    const t = state.savedTalhoes.find((t) => t.id === id);
    if (t) showFormView(t);
  };

  window._IcTalhoesDelete = (id) => {
    if (!confirm(tMsg("Tem certeza que deseja excluir este talhão?"))) return;
    state.savedTalhoes = state.savedTalhoes.filter((t) => t.id !== id);
    saveTalhoesToStorage();
    reRenderAllTalhoes();
    renderSidebarList();
    const detailEl = document.querySelector("#talhoesPanel .talhoes__details");
    if (detailEl)
      detailEl.innerHTML =
        '<div class="talhoes__details-empty"><div class="talhoes__details-icon"><i class="fa-regular fa-file-lines"></i></div><span>Não há dados</span></div>';
  };

  /* =========================================================
     API PÚBLICA
     ========================================================= */
  window.IcTalhoes = {
    // Inicializa inline dentro do fazenda-edit (HTML já está no DOM)
    initInPlace() {
      if (state.map) return; // já inicializado

      // Reset
      Object.assign(state, {
        isDrawing: false, points: [], hoverPoint: null,
        draftLine: null, previewPolygon: null, polygon: null,
        vertexMarkers: [], midpointMarkers: [],
        savedTalhoes: [], selectedId: null, editingId: null,
        viewMode: "list",
      });

      bindUI();
      initMap();
    },

    // Força redimensionamento do mapa quando a aba fica visível
    invalidate() {
      if (state.map) setTimeout(() => state.map.invalidateSize(), 80);
    },

    // Legado (não usado, mantido por compatibilidade)
    async open() {},
    close() {},
  };
})();
