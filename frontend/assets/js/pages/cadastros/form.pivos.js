(function () {
  "use strict";
  const tMsg = (text) => window.IcI18n?.t?.(text) ?? text;
  const Cad = (window.Cad = window.Cad || {});

  function renderFormPivos(compositeId, container) {
    if (typeof Cad.forms?.renderFormPivos === "function" && Cad.forms.renderFormPivos !== renderFormPivos) {
      return Cad.forms.renderFormPivos(compositeId, container);
    }
    if (typeof Cad.pivosHelpers?.renderFormPivos === "function" && Cad.pivosHelpers.renderFormPivos !== renderFormPivos) {
      return Cad.pivosHelpers.renderFormPivos(compositeId, container);
    }
    if (typeof console !== "undefined") {
      console.warn("[Cadastros] renderFormPivos ainda não foi inicializado.");
    }
  }

  const passthrough = (name) => (...args) => Cad.pivosHelpers?.[name]?.(...args);

  function bindVinculosTransferList(container) {
    function setupToggleList(listId, hiddenInputId) {
      const list = container.querySelector("#" + listId);
      const hiddenInput = container.querySelector("#" + hiddenInputId);
      if (!list || !hiddenInput) return;

      function refreshVinculosMap() {
        const activeTab = container.querySelector(".farm-tab-btn[data-pivo-tab].is-active")?.getAttribute("data-pivo-tab");
        if (activeTab !== "vinculos") return;
        const formData = Cad.pivosHelpers?.collectPivoFormData?.();
        if (!formData) return;
        Cad.pivosHelpers?.renderPivosFormMap?.(formData, Cad.data?.getAllPivosRecords?.() || []);
      }

      function syncHidden() {
        const ids = Array.from(list.querySelectorAll(".vinc-item.is-selected")).map((el) => el.dataset.id);
        hiddenInput.value = JSON.stringify(ids);
      }

      function refreshEmpty() {
        const hasItems = list.querySelector(".vinc-item") !== null;
        let empty = list.querySelector(".vinc-empty");
        if (!hasItems && !empty) {
          empty = document.createElement("li");
          empty.className = "vinc-empty";
          empty.textContent = "Nenhum item";
          list.appendChild(empty);
        } else if (hasItems && empty) {
          empty.remove();
        }
      }

      list.addEventListener("click", (e) => {
        const item = e.target.closest(".vinc-item");
        if (!item) return;
        item.classList.toggle("is-selected");
        syncHidden();
        refreshVinculosMap();
      });

      refreshEmpty();
      syncHidden();
    }

    setupToggleList("vinc-talhoes-list", "pivo_talhoes_ids");
    setupToggleList("vinc-pluvio-list", "pivo_monitoramento_ids");
  }

  function bindPivoFormBaseListeners(container, source, currentFarmId) {
    const renderPivosFormMap = (...args) => Cad.pivosHelpers?.renderPivosFormMap?.(...args);
    const collectPivoFormData = (...args) => Cad.pivosHelpers?.collectPivoFormData?.(...args);
    const ensurePivoLocationDraft = (...args) => Cad.pivosHelpers?.ensurePivoLocationDraft?.(...args);
    const getAllPivosRecords = () => Cad.data.getAllPivosRecords();
    const initMultiSelect = (...args) => Cad.ui.initMultiSelect(...args);

    container.querySelectorAll(".farm-tab-btn[data-pivo-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tabId = btn.getAttribute("data-pivo-tab");
        container.querySelectorAll(".farm-tab-btn[data-pivo-tab]").forEach((item) => item.classList.remove("is-active"));
        container.querySelectorAll(".cadastros-form-section").forEach((section) => section.classList.remove("is-active"));
        btn.classList.add("is-active");
        const targetSection = container.querySelector(`#content-pivo-${tabId}`);
        if (targetSection) targetSection.classList.add("is-active");
        if (tabId === "localizacao") {
          const draft = ensurePivoLocationDraft("center");
          if (draft?.changed) {
            renderPivosFormMap(collectPivoFormData(), getAllPivosRecords());
          }
        }
        renderPivosFormMap(collectPivoFormData(), getAllPivosRecords());
      });
    });

    const togglePluvio = container.querySelector("#pivo_enablePluviometro");
    if (togglePluvio) {
      togglePluvio.addEventListener("change", (event) => {
        const fields = container.querySelector("#pivoPluvioConfigFields");
        if (fields) fields.style.display = event.target.checked ? "grid" : "none";
      });
    }

    const toggleVoltage = container.querySelector("#pivo_voltageController");
    if (toggleVoltage) {
      toggleVoltage.addEventListener("change", (event) => {
        const fields = container.querySelector("#pivoVoltageFields");
        if (fields) fields.style.display = event.target.checked ? "grid" : "none";
      });
    }

    const toggleAutorrev = container.querySelector("#pivo_enableAutorreversao");
    if (toggleAutorrev) {
      toggleAutorrev.addEventListener("change", (event) => {
        const fields = container.querySelector("#pivoAutorreversaoFields");
        if (fields) fields.style.display = event.target.checked ? "grid" : "none";
      });
    }

    const pivoCenterInput = container.querySelector("#pivo_center");
    if (pivoCenterInput) {
      pivoCenterInput.addEventListener("input", () => {
        const parts = pivoCenterInput.value.split(",").map((item) => item.trim());
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        const latInput = document.getElementById("pivo_lat");
        const lngInput = document.getElementById("pivo_lng");
        if (latInput) latInput.value = Number.isFinite(lat) ? String(lat) : "";
        if (lngInput) lngInput.value = Number.isFinite(lng) ? String(lng) : "";
      });
    }

    const pivoRefInput = container.querySelector("#pivo_ref");
    if (pivoRefInput) {
      pivoRefInput.addEventListener("input", () => {
        const parts = pivoRefInput.value.split(",").map((item) => item.trim());
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        const refLatInput = document.getElementById("pivo_refLat");
        const refLngInput = document.getElementById("pivo_refLng");
        if (refLatInput) refLatInput.value = Number.isFinite(lat) ? String(lat) : "";
        if (refLngInput) refLngInput.value = Number.isFinite(lng) ? String(lng) : "";
      });
    }

    bindVinculosTransferList(container);

    initMultiSelect({
      hostId: "#pivoBombasMulti",
      chipsSelector: "[data-pivo-bombas-chips]",
      searchSelector: "[data-pivo-bombas-search]",
      dropdownSelector: "[data-pivo-bombas-dropdown]",
      listSelector: "[data-pivo-bombas-list]",
      controlSelector: "[data-pivo-bombas-control]",
      itemSelector: "[data-pivo-bomba-item]",
      hiddenInputId: "pivo_bombas_ids",
      attrId: "data-bomba-id",
      unitLabel: "bomba"
    }, container);

    renderPivoParcelasAndSegmentsEditor();
    renderPivoCanhaoEditor();
    renderPivoMapAndCoordinateListeners(container, source, currentFarmId);
  }

  function syncPivoCursor() {
    const pivosState = Cad.pivosState || {};
    if (pivosState.map && pivosState.map.getContainer) {
      pivosState.map.getContainer().style.cursor = pivosState.pickTarget ? "crosshair" : "";
    }
  }

  function syncPivoRadiusFromInputs() {
    const calculateDistanceMeters = (...args) => Cad.geo.calculateDistanceMeters(...args);
    const latInput = document.getElementById("pivo_lat");
    const lngInput = document.getElementById("pivo_lng");
    const refLatInput = document.getElementById("pivo_refLat");
    const refLngInput = document.getElementById("pivo_refLng");
    const radiusInput = document.getElementById("pivo_radius");
    if (!latInput || !lngInput || !refLatInput || !refLngInput || !radiusInput) return;

    const distance = calculateDistanceMeters(
      latInput.value,
      lngInput.value,
      refLatInput.value,
      refLngInput.value
    );
    if (!Number.isFinite(distance)) return;
    radiusInput.value = distance.toFixed(2);
  }

  function syncPivoNorthReferenceFromInputs() {
    const calculateNorthReference = (...args) => Cad.geo.calculateNorthReference(...args);
    const alignInput = document.getElementById("pivo_alignNorth");
    const alignNorth = alignInput
      ? (alignInput.type === "checkbox"
        ? !!alignInput.checked
        : ["1", "true", "on", "yes", "sim"].includes(String(alignInput.value || "").trim().toLowerCase()))
      : false;
    if (!alignNorth) return;

    const latInput = document.getElementById("pivo_lat");
    const lngInput = document.getElementById("pivo_lng");
    const radiusInput = document.getElementById("pivo_radius");
    const refLatInput = document.getElementById("pivo_refLat");
    const refLngInput = document.getElementById("pivo_refLng");
    if (!latInput || !lngInput || !radiusInput || !refLatInput || !refLngInput) return;

    const northRef = calculateNorthReference(latInput.value, lngInput.value, radiusInput.value);
    if (!northRef) return;

    refLatInput.value = String(northRef.lat);
    refLngInput.value = String(northRef.lng);
  }

  function centerPivoMapOnFarm(map, farmId, zoom = 14) {
    if (Cad.viewMaps?.centerPivoMapOnFarm) {
      return Cad.viewMaps.centerPivoMapOnFarm(map, farmId, zoom);
    }
    if (!map) return false;
    const selectedFarm = Cad.data.getAllFarms().find((farm) => String(farm?.id) === String(farmId || ""));
    const farmLat = Number(selectedFarm?.lat);
    const farmLng = Number(selectedFarm?.lng);
    if (!Number.isFinite(farmLat) || !Number.isFinite(farmLng)) return false;
    map.setView([farmLat, farmLng], zoom);
    return true;
  }

  function ensurePivoLocationDraft(target = "center") {
    const pivosState = Cad.pivosState || {};
    const calculateBearingPoint = (...args) => Cad.geo.calculateBearingPoint(...args);
    const radiusInput = document.getElementById("pivo_radius");
    const latInput = document.getElementById("pivo_lat");
    const lngInput = document.getElementById("pivo_lng");
    const centerInput = document.getElementById("pivo_center");
    const refLatInput = document.getElementById("pivo_refLat");
    const refLngInput = document.getElementById("pivo_refLng");
    const refInput = document.getElementById("pivo_ref");

    const readCoords = (latEl, lngEl) => {
      const lat = Number(latEl?.value);
      const lng = Number(lngEl?.value);
      return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    };
    const fmt = (value) => Number(value).toFixed(6);

    let changed = false;
    let center = readCoords(latInput, lngInput);
    if (!center && pivosState.map) {
      const mapCenter = pivosState.map.getCenter();
      if (mapCenter) {
        center = {
          lat: Number(mapCenter.lat.toFixed(6)),
          lng: Number(mapCenter.lng.toFixed(6))
        };
        if (latInput) latInput.value = String(center.lat);
        if (lngInput) lngInput.value = String(center.lng);
        if (centerInput) centerInput.value = `${fmt(center.lat)}, ${fmt(center.lng)}`;
        changed = true;
      }
    }

    if (!center) return { changed: false, center: null, ref: null };

    let ref = readCoords(refLatInput, refLngInput);
    if (!ref && (target === "center" || target === "ref")) {
      const radius = Math.max(1, Number(radiusInput?.value) || 400);
      const northRef = calculateBearingPoint(center.lat, center.lng, radius, 0);
      if (northRef) {
        ref = {
          lat: Number(Number(northRef.lat).toFixed(6)),
          lng: Number(Number(northRef.lng).toFixed(6))
        };
        if (refLatInput) refLatInput.value = String(ref.lat);
        if (refLngInput) refLngInput.value = String(ref.lng);
        if (refInput) refInput.value = `${fmt(ref.lat)}, ${fmt(ref.lng)}`;
        changed = true;
      }
    }

    return { changed, center, ref };
  }

  function bindPivoMapPickEvents() {
    const state = Cad.state || {};
    const pivosState = Cad.pivosState || {};
    const calculateDistanceMeters = (...args) => Cad.geo.calculateDistanceMeters(...args);
    const bearingBetweenPoints = (...args) => Cad.geo.bearingBetweenPoints(...args);
    const renderPivosFormMap = (...args) => Cad.pivosHelpers?.renderPivosFormMap?.(...args);
    const collectPivoFormData = (...args) => Cad.pivosHelpers?.collectPivoFormData?.(...args);
    const syncPivoRadiusFromInputs = (...args) => Cad.pivosHelpers?.syncPivoRadiusFromInputs?.(...args);
    const syncPivoNorthReferenceFromInputs = (...args) => Cad.pivosHelpers?.syncPivoNorthReferenceFromInputs?.(...args);
    const getAllPivosRecords = () => Cad.data.getAllPivosRecords();
    const syncCursor = () => Cad.pivosHelpers?.syncPivoCursor?.();

    if (!pivosState.map || pivosState.map.__icPivoPickBound) return;
    pivosState.map.on("click", (event) => {
      if (!(state.currentType === "sistemas-irrigacao" && state.activeView === "form")) return;
      if (!pivosState.pickTarget || !event?.latlng) return;

      const lat = Number(event.latlng.lat.toFixed(6));
      const lng = Number(event.latlng.lng.toFixed(6));
      if (pivosState.pickTarget === "center") {
        const latInput = document.getElementById("pivo_lat");
        const lngInput = document.getElementById("pivo_lng");
        const centerInput = document.getElementById("pivo_center");
        if (latInput) latInput.value = String(lat);
        if (lngInput) lngInput.value = String(lng);
        if (centerInput) centerInput.value = `${lat}, ${lng}`;
        syncPivoRadiusFromInputs();
        syncPivoNorthReferenceFromInputs();
      }

      if (pivosState.pickTarget === "ref") {
        const refLatInput = document.getElementById("pivo_refLat");
        const refLngInput = document.getElementById("pivo_refLng");
        const refInput = document.getElementById("pivo_ref");
        if (refLatInput) refLatInput.value = String(lat);
        if (refLngInput) refLngInput.value = String(lng);
        if (refInput) refInput.value = `${lat}, ${lng}`;
        syncPivoRadiusFromInputs();
      }

      if (pivosState.pickTarget === "lastTower") {
        const ltLatInput = document.getElementById("pivo_lastTowerLat");
        const ltLngInput = document.getElementById("pivo_lastTowerLng");
        if (ltLatInput) ltLatInput.value = String(lat);
        if (ltLngInput) ltLngInput.value = String(lng);

        const d = calculateDistanceMeters(
          document.getElementById("pivo_lat")?.value,
          document.getElementById("pivo_lng")?.value,
          lat, lng
        );
        if (Number.isFinite(d) && d > 0) {
          const ltR = document.getElementById("pivo_lastTowerRadius");
          if (ltR) ltR.value = d.toFixed(2);
        }
      }

      if (pivosState.pickTarget === "start") {
        const startLatInput = document.getElementById("pivo_startLat");
        const startLngInput = document.getElementById("pivo_startLng");
        if (startLatInput) startLatInput.value = String(lat);
        if (startLngInput) startLngInput.value = String(lng);
      }

      if (pivosState.pickTarget === "end") {
        const endLatInput = document.getElementById("pivo_endLat");
        const endLngInput = document.getElementById("pivo_endLng");
        if (endLatInput) endLatInput.value = String(lat);
        if (endLngInput) endLngInput.value = String(lng);
      }

      if (pivosState.pickTarget === "parcel-start-angle" || pivosState.pickTarget === "parcel-end-angle") {
        const centerLat = Number(document.getElementById("pivo_lat")?.value);
        const centerLng = Number(document.getElementById("pivo_lng")?.value);
        if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) {
          alert(tMsg("Defina primeiro o centro do pivô para capturar ângulos da parcela."));
        } else {
          const bearing = bearingBetweenPoints(centerLat, centerLng, lat, lng);
          const normalized = Number.isFinite(bearing) ? ((bearing % 360) + 360) % 360 : 0;
          if (pivosState.pickTarget === "parcel-start-angle") {
            const input = document.getElementById("pivo_parcela_start");
            if (input) input.value = normalized.toFixed(1);
          } else {
            const input = document.getElementById("pivo_parcela_end");
            if (input) input.value = normalized.toFixed(1);
          }
        }
      }

      const lastTarget = pivosState.pickTarget;
      pivosState.pickTarget = null;
      syncCursor();
      document.querySelectorAll(
        "#section-sistemas-irrigacao .pivo-pick-icon-btn.is-active, #section-sistemas-irrigacao .sc-loc__btn.is-active"
      ).forEach((btn) => btn.classList.remove("is-active"));

      if (lastTarget === "center") {
        pivosState.map.setView([lat, lng], 15);
      } else {
        renderPivosFormMap(collectPivoFormData(), getAllPivosRecords());
      }

      renderPivosFormMap(collectPivoFormData(), getAllPivosRecords());
    });
    pivosState.map.__icPivoPickBound = true;
  }

  function renderPivoParcelasAndSegmentsEditor() {
    const pivosState = Cad.pivosState || {};
    const SEG_COLORS = Cad.SEG_COLORS || [];
    const refreshMap = () => {
      const data = Cad.pivosHelpers?.collectPivoFormData?.();
      if (data) {
        Cad.pivosHelpers?.renderPivosFormMap?.(data, Cad.data.getAllPivosRecords());
      }
    };
    const syncCursor = () => Cad.pivosHelpers?.syncPivoCursor?.();

    const parcelasHidden = document.getElementById("pivo_parcelas_json");
    let parcelas = [];
    try { parcelas = JSON.parse(parcelasHidden?.value || "[]"); } catch (_) { parcelas = []; }
    let parcelaEditIndex = -1;
    const parcelasListWrap = document.getElementById("pivoParcelasListWrap");
    const parcelaNameInput = document.getElementById("pivo_parcela_name");
    const parcelaStartInput = document.getElementById("pivo_parcela_start");
    const parcelaEndInput = document.getElementById("pivo_parcela_end");
    const parcelaSaveBtn = document.getElementById("pivoParcelaSaveBtn");
    const parcelaPickStartBtn = document.getElementById("pivoParcelaPickStartBtn");
    const parcelaPickEndBtn = document.getElementById("pivoParcelaPickEndBtn");

    const normAngle = (v, fallback = 0) => {
      const n = Number(v);
      return Number.isFinite(n) ? ((n % 360) + 360) % 360 : fallback;
    };
    const angleSpan = (s, e) => {
      const span = ((normAngle(e) - normAngle(s) + 360) % 360);
      return span || 360;
    };
    const saveParcelasToHidden = () => { if (parcelasHidden) parcelasHidden.value = JSON.stringify(parcelas); };

    const renderParcelasList = () => {
      if (!parcelasListWrap) return;
      if (!parcelas.length) {
        parcelasListWrap.innerHTML = '<p style="font-size:12px;color:#94a3b8;margin:0;">Nenhuma parcela adicionada.</p>';
        return;
      }
      parcelasListWrap.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="background:#f8fafc;">
          <th style="padding:6px 8px;text-align:left;border-bottom:1px solid #e2e8f0;">Parcela</th>
          <th style="padding:6px 8px;text-align:center;border-bottom:1px solid #e2e8f0;">Início (°)</th>
          <th style="padding:6px 8px;text-align:center;border-bottom:1px solid #e2e8f0;">Fim (°)</th>
          <th style="padding:6px 8px;text-align:center;border-bottom:1px solid #e2e8f0;">Faixa (°)</th>
          <th style="padding:6px 8px;border-bottom:1px solid #e2e8f0;"></th>
        </tr></thead>
        <tbody>${parcelas.map((p, i) => `
          <tr style="cursor:pointer;${parcelaEditIndex === i ? 'background:#f0fdf4;' : ''}">
            <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;">${p.name || "-"}</td>
            <td style="padding:5px 8px;text-align:center;border-bottom:1px solid #f1f5f9;">${normAngle(p.startAngle).toFixed(1)}</td>
            <td style="padding:5px 8px;text-align:center;border-bottom:1px solid #f1f5f9;">${normAngle(p.endAngle).toFixed(1)}</td>
            <td style="padding:5px 8px;text-align:center;border-bottom:1px solid #f1f5f9;">${angleSpan(p.startAngle, p.endAngle).toFixed(1)}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;display:flex;gap:4px;">
              <button type="button" data-edit-idx="${i}" style="height:24px;padding:0 8px;font-size:11px;border-radius:4px;cursor:pointer;background:#f8fafc;color:#475569;border:1px solid #e2e8f0;"><i class="fa-solid fa-pencil"></i></button>
              <button type="button" data-del-idx="${i}" style="height:24px;padding:0 8px;font-size:11px;border-radius:4px;cursor:pointer;background:#fef2f2;color:#ef4444;border:1px solid #fecaca;"><i class="fa-regular fa-trash-can"></i></button>
            </td>
          </tr>`).join("")}
        </tbody>
      </table>`;

      parcelasListWrap.querySelectorAll("[data-edit-idx]").forEach((btn) => {
        btn.onclick = () => {
          parcelaEditIndex = Number(btn.getAttribute("data-edit-idx"));
          const item = parcelas[parcelaEditIndex];
          if (!item) return;
          if (parcelaNameInput) parcelaNameInput.value = item.name || "";
          if (parcelaStartInput) parcelaStartInput.value = String(normAngle(item.startAngle, 0));
          if (parcelaEndInput) parcelaEndInput.value = String(normAngle(item.endAngle, 360));
          if (parcelaSaveBtn) parcelaSaveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Atualizar';
          renderParcelasList();
        };
      });

      parcelasListWrap.querySelectorAll("[data-del-idx]").forEach((btn) => {
        btn.onclick = () => {
          const idx = Number(btn.getAttribute("data-del-idx"));
          parcelas.splice(idx, 1);
          if (parcelaEditIndex === idx) {
            parcelaEditIndex = -1;
            if (parcelaSaveBtn) parcelaSaveBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Adicionar';
          }
          saveParcelasToHidden();
          renderParcelasList();
          refreshMap();
        };
      });
    };

    if (parcelaSaveBtn) {
      parcelaSaveBtn.onclick = () => {
        const name = parcelaNameInput?.value?.trim() || "";
        if (!name) { alert(tMsg("Informe o nome da parcela.")); return; }
        const startAngle = normAngle(parcelaStartInput?.value, 0);
        const endAngle = normAngle(parcelaEndInput?.value, 360);
        const item = {
          id: parcelaEditIndex >= 0 ? (parcelas[parcelaEditIndex]?.id || `parcela_${Date.now()}`) : `parcela_${Date.now()}`,
          name,
          startAngle,
          endAngle
        };
        if (parcelaEditIndex >= 0) {
          parcelas[parcelaEditIndex] = item;
          parcelaEditIndex = -1;
        } else {
          parcelas.push(item);
        }
        if (parcelaNameInput) parcelaNameInput.value = "";
        if (parcelaStartInput) parcelaStartInput.value = "";
        if (parcelaEndInput) parcelaEndInput.value = "";
        if (parcelaSaveBtn) parcelaSaveBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Adicionar';
        saveParcelasToHidden();
        renderParcelasList();
        refreshMap();
      };
    }

    if (parcelaPickStartBtn) parcelaPickStartBtn.onclick = () => { pivosState.pickTarget = "parcel-start-angle"; syncCursor(); };
    if (parcelaPickEndBtn) parcelaPickEndBtn.onclick = () => { pivosState.pickTarget = "parcel-end-angle"; syncCursor(); };

    renderParcelasList();

    const segHidden = document.getElementById("pivo_seg_json");
    let segs = [];
    try { segs = JSON.parse(segHidden?.value || "[]"); } catch (_) { segs = []; }
    if (!segs.length) segs = [{ id: `seg_${Date.now()}`, name: "Segmento 1", startAngle: 0, endAngle: 360 }];
    let activeSegIdx = 0;

    const segNameInput = document.getElementById("pivo_seg_name");
    const segStartInput = document.getElementById("pivo_seg_start");
    const segEndInput = document.getElementById("pivo_seg_end");
    const saveSegsToHidden = () => { if (segHidden) segHidden.value = JSON.stringify(segs); };

    const loadSegToForm = (idx) => {
      const seg = segs[idx];
      if (!seg) return;
      if (segNameInput) segNameInput.value = seg.name || `Segmento ${idx + 1}`;
      if (segStartInput) {
        segStartInput.value = String(seg.startAngle ?? 0);
        segStartInput.disabled = idx > 0;
        segStartInput.style.opacity = idx > 0 ? "0.5" : "";
        segStartInput.title = idx > 0 ? "Preenchido automaticamente a partir do ângulo final do segmento anterior" : "";
      }
      if (segEndInput) segEndInput.value = String(seg.endAngle ?? 360);
    };

    const saveFormToSeg = (idx) => {
      if (!segs[idx]) return;
      segs[idx].name = segNameInput?.value?.trim() || "";
      if (idx === 0) segs[idx].startAngle = Number(segStartInput?.value ?? 0);
      segs[idx].endAngle = Number(segEndInput?.value ?? 360);
      saveSegsToHidden();
    };

    const renderSegmentList = () => {
      const listWrap = document.getElementById("pivoFormSegmentList");
      if (!listWrap) return;
      listWrap.innerHTML = "";

      segs.forEach((seg, i) => {
        const color = SEG_COLORS[i % SEG_COLORS.length];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "pivo-seg-num-btn" + (i === activeSegIdx ? " is-active" : "");
        btn.setAttribute("data-seg-idx", String(i));
        btn.style.background = color;
        btn.style.setProperty("--seg-color", color);
        btn.textContent = String(i + 1);
        btn.onclick = () => {
          saveFormToSeg(activeSegIdx);
          activeSegIdx = i;
          loadSegToForm(activeSegIdx);
          renderSegmentList();
          refreshMap();
        };
        listWrap.appendChild(btn);
      });

      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "pivo-seg-add-btn";
      addBtn.title = "Adicionar segmento";
      addBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
      addBtn.disabled = segs.length >= 9;
      addBtn.onclick = () => {
        if (segs.length >= 9) return;
        saveFormToSeg(activeSegIdx);
        const prevEnd = ((Number(segs[segs.length - 1]?.endAngle ?? 270) % 360) + 360) % 360;
        const newEnd = ((prevEnd + 90) % 360);
        segs.push({ id: `seg_${Date.now()}`, name: `Segmento ${segs.length + 1}`, startAngle: prevEnd, endAngle: newEnd });
        activeSegIdx = segs.length - 1;
        saveSegsToHidden();
        loadSegToForm(activeSegIdx);
        renderSegmentList();
        refreshMap();
      };
      listWrap.appendChild(addBtn);

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "pivo-seg-del-btn";
      delBtn.title = "Remover segmento";
      delBtn.innerHTML = '<i class="fa-regular fa-trash-can"></i>';
      delBtn.disabled = segs.length <= 1;
      delBtn.onclick = () => {
        if (segs.length <= 1) return;
        segs.splice(activeSegIdx, 1);
        activeSegIdx = Math.min(activeSegIdx, segs.length - 1);
        saveSegsToHidden();
        loadSegToForm(activeSegIdx);
        renderSegmentList();
        refreshMap();
      };
      listWrap.appendChild(delBtn);
    };

    [segNameInput, segStartInput, segEndInput].forEach((input) => {
      if (!input) return;
      input.addEventListener("input", () => {
        saveFormToSeg(activeSegIdx);
        refreshMap();
      });
      input.addEventListener("change", () => {
        saveFormToSeg(activeSegIdx);
      });
    });

    pivosState._flushActiveSeg = () => saveFormToSeg(activeSegIdx);
    pivosState._setSegBoundaryAngle = (boundaryIdx, newAngle) => {
      if (boundaryIdx < 0 || boundaryIdx >= segs.length) return;
      const norm = ((newAngle % 360) + 360) % 360;
      const nextIdx = (boundaryIdx + 1) % segs.length;
      segs[boundaryIdx].endAngle = norm;
      segs[nextIdx].startAngle = norm;
      saveSegsToHidden();
      loadSegToForm(activeSegIdx);
      renderSegmentList();
    };

    pivosState._applyPresetSegments = (n) => {
      if (n < 2 || n > 9) return;
      const step = 360 / n;
      const offset = 270;
      segs = Array.from({ length: n }, (_, i) => ({
        id: `seg_${Date.now()}_${i}`,
        name: "",
        startAngle: Math.round(((offset + i * step) % 360 + 360) % 360),
        endAngle: Math.round(((offset + (i + 1) * step) % 360 + 360) % 360)
      }));
      activeSegIdx = 0;
      saveSegsToHidden();
      loadSegToForm(0);
      renderSegmentList();
      refreshMap();
    };

    document.querySelectorAll(".pivo-preset-btn").forEach((btn) => {
      btn.onclick = () => {
        const n = Number(btn.getAttribute("data-preset"));
        if (pivosState._applyPresetSegments) pivosState._applyPresetSegments(n);
      };
    });

    loadSegToForm(activeSegIdx);
    renderSegmentList();
  }


  function renderPivoCanhaoEditor() {
    const pivosState = Cad.pivosState || {};
    const SEG_COLORS = Cad.SEG_COLORS || [];
    const renderPivosFormMap = (...args) => Cad.pivosHelpers?.renderPivosFormMap?.(...args);
    const collectPivoFormData = (...args) => Cad.pivosHelpers?.collectPivoFormData?.(...args);
    const getAllPivosRecords = () => Cad.data.getAllPivosRecords();

      const modeInput = document.getElementById("pivo_canhao_mode");
      const segSection = document.getElementById("canhaoSegSection");
      const segListEl = document.getElementById("canhaoSegList");
      const segJsonInput = document.getElementById("pivo_canhao_seg_json");
      const segStartInput = document.getElementById("pivo_canhao_seg_start");
      const segEndInput = document.getElementById("pivo_canhao_seg_end");

      let cSegs = [];
      try { cSegs = JSON.parse(segJsonInput?.value || "[]"); } catch { cSegs = []; }
      let activeCSegIdx = 0;
      pivosState._activeCanhaoSegIdx = 0;

      const saveCSegs = () => { if (segJsonInput) segJsonInput.value = JSON.stringify(cSegs); };

      const loadSegToInputs = (idx) => {
        const seg = cSegs[idx];
        if (!seg) { if (segStartInput) segStartInput.value = ""; if (segEndInput) segEndInput.value = ""; return; }
        if (segStartInput) segStartInput.value = String(((Number(seg.startAngle) % 360) + 360) % 360);
        if (segEndInput) segEndInput.value = String(((Number(seg.endAngle) % 360) + 360) % 360);
      };

      const renderCanhaoSegList = () => {
        if (!segListEl) return;
        segListEl.innerHTML = "";

        cSegs.forEach((_, i) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "pivo-seg-num-btn" + (i === activeCSegIdx ? " is-active" : "");
          btn.style.cssText = `background:${SEG_COLORS[i % SEG_COLORS.length]};--seg-color:${SEG_COLORS[i % SEG_COLORS.length]};`;
          btn.textContent = String(i + 1);
          btn.title = `Canhão ${i + 1}`;
          btn.onclick = () => {
            activeCSegIdx = i;
            pivosState._activeCanhaoSegIdx = i;
            renderCanhaoSegList();
            renderPivosFormMap(collectPivoFormData(), getAllPivosRecords());
          };
          segListEl.appendChild(btn);
        });

        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.className = "pivo-seg-add-btn";
        addBtn.title = "Adicionar segmento de canhão";
        addBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
        addBtn.disabled = cSegs.length >= 9;
        addBtn.onclick = () => {
          if (cSegs.length >= 9) return;
          const prevEnd = cSegs.length ? ((Number(cSegs[cSegs.length - 1].endAngle) % 360) + 360) % 360 : 340;
          const newStart = cSegs.length ? prevEnd : 340;
          const newEnd = cSegs.length ? ((prevEnd + 40) % 360) : 20;
          cSegs.push({ id: `cs_${Date.now()}`, startAngle: newStart, endAngle: newEnd });
          activeCSegIdx = cSegs.length - 1;
          pivosState._activeCanhaoSegIdx = activeCSegIdx;
          saveCSegs();
          renderCanhaoSegList();
          renderPivosFormMap(collectPivoFormData(), getAllPivosRecords());
        };
        segListEl.appendChild(addBtn);

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "pivo-seg-del-btn";
        delBtn.title = "Remover segmento de canhão";
        delBtn.innerHTML = '<i class="fa-regular fa-trash-can"></i>';
        delBtn.disabled = cSegs.length === 0;
        delBtn.onclick = () => {
          if (!cSegs.length) return;
          cSegs.splice(activeCSegIdx, 1);
          activeCSegIdx = Math.max(0, Math.min(activeCSegIdx, cSegs.length - 1));
          pivosState._activeCanhaoSegIdx = activeCSegIdx;
          saveCSegs();
          renderCanhaoSegList();
          renderPivosFormMap(collectPivoFormData(), getAllPivosRecords());
        };
        segListEl.appendChild(delBtn);

        loadSegToInputs(activeCSegIdx);
      };

      [segStartInput, segEndInput].forEach((input, fi) => {
        if (!input) return;
        input.addEventListener("input", () => {
          if (!cSegs[activeCSegIdx]) return;
          const field = fi === 0 ? "startAngle" : "endAngle";
          const v = parseFloat(input.value);
          if (Number.isFinite(v)) {
            cSegs[activeCSegIdx][field] = ((v % 360) + 360) % 360;
            saveCSegs();
            renderPivosFormMap(collectPivoFormData(), getAllPivosRecords());
          }
        });
      });

      const modeSelect = document.getElementById("pivo_canhao_mode_select");
      if (modeSelect) {
        modeSelect.addEventListener("change", () => {
          if (modeInput) modeInput.value = modeSelect.value;
          if (modeSelect.value === "segment") {
            if (segSection) segSection.style.display = "";
            // Ao selecionar pela primeira vez, cria automaticamente o primeiro segmento
            if (!cSegs.length) {
              cSegs.push({ id: `cs_${Date.now()}`, startAngle: 340, endAngle: 20 });
              activeCSegIdx = 0;
              pivosState._activeCanhaoSegIdx = 0;
              saveCSegs();
              renderCanhaoSegList();
            }
          } else {
            if (segSection) segSection.style.display = "none";
          }
          renderPivosFormMap(collectPivoFormData(), getAllPivosRecords());
        });
      }

      pivosState._updateCanhaoSegAngle = (segIdx, field, newAngle) => {
        if (!cSegs[segIdx]) return;
        cSegs[segIdx][field] = ((newAngle % 360) + 360) % 360;
        saveCSegs();
        loadSegToInputs(segIdx);
        renderCanhaoSegList();
      };

      renderCanhaoSegList();
  }

  function renderPivoMapAndCoordinateListeners(container, source, currentFarmId) {
    const pivosState = Cad.pivosState || {};
    const calculateBearingPoint = (...args) => Cad.geo.calculateBearingPoint(...args);
    const calculateDistanceMeters = (...args) => Cad.geo.calculateDistanceMeters(...args);
    const centerPivoMapOnFarm = (...args) => Cad.pivosHelpers?.centerPivoMapOnFarm?.(...args);
    const syncPivoRadiusFromInputs = (...args) => Cad.pivosHelpers?.syncPivoRadiusFromInputs?.(...args);
    const syncPivoNorthReferenceFromInputs = (...args) => Cad.pivosHelpers?.syncPivoNorthReferenceFromInputs?.(...args);
    const resetPivoCoordinateInputs = (...args) => Cad.pivosHelpers?.resetPivoCoordinateInputs?.(...args);
    const renderPivosFormMap = (...args) => Cad.pivosHelpers?.renderPivosFormMap?.(...args);
    const collectPivoFormData = (...args) => Cad.pivosHelpers?.collectPivoFormData?.(...args);
    const ensurePivoLocationDraft = (...args) => Cad.pivosHelpers?.ensurePivoLocationDraft?.(...args);
    const syncPivoCursor = (...args) => Cad.pivosHelpers?.syncPivoCursor?.(...args);
    const normalizeMapActionsPlacement = (...args) => Cad.toolbar?.normalizeMapActionsPlacement?.(...args);
    const getAllPivosRecords = () => Cad.data.getAllPivosRecords();
    const initCadCustomSelects = (scope) => Cad.ui.initCadCustomSelects(scope);

    // --- Partial checkbox ---
    const partialCb = document.getElementById("pivo_isPartial");
    const partialEditorWrap = document.getElementById("pivoPartialEditor");
    const syncPartialUi = () => {
      if (partialEditorWrap) partialEditorWrap.style.display = partialCb?.checked ? "" : "none";
    };
    if (partialCb) {
      partialCb.addEventListener("change", () => {
        if (partialCb.checked) {
          // Default start/end to north (bearing 0?) so map doesn't break
          const lat = document.getElementById("pivo_lat")?.value;
          const lng = document.getElementById("pivo_lng")?.value;
          const radius = document.getElementById("pivo_radius")?.value || 400;
          const northPt = calculateBearingPoint(lat, lng, radius, 0);
          if (northPt) {
            const sLat = document.getElementById("pivo_startLat");
            const sLng = document.getElementById("pivo_startLng");
            const eLat = document.getElementById("pivo_endLat");
            const eLng = document.getElementById("pivo_endLng");
            if (sLat && !sLat.value) sLat.value = String(northPt.lat);
            if (sLng && !sLng.value) sLng.value = String(northPt.lng);
            if (eLat && !eLat.value) eLat.value = String(northPt.lat);
            if (eLng && !eLng.value) eLng.value = String(northPt.lng);
          }
        }
        syncPartialUi();
        refreshPivoMap();
      });
    }

    // --- hasParcelas toggle ---
    const hasParcelasCb = document.getElementById("pivo_hasParcelas");
    const parcelasEditorWrap = document.getElementById("pivoParcelasEditor");
    if (hasParcelasCb && parcelasEditorWrap) {
      hasParcelasCb.addEventListener("change", () => {
        parcelasEditorWrap.style.display = hasParcelasCb.checked ? "" : "none";
      });
    }

    // --- Map coordinate listeners ---
    const refreshPivoMap = () => {
      syncPivoRadiusFromInputs();
      syncPivoNorthReferenceFromInputs();
      renderPivosFormMap(collectPivoFormData(), getAllPivosRecords());
    };
    ["pivo_lat", "pivo_lng", "pivo_refLat", "pivo_refLng", "pivo_lastTowerLat", "pivo_lastTowerLng", "pivo_radius", "pivo_startLat", "pivo_startLng", "pivo_endLat", "pivo_endLng"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", refreshPivoMap);
      el.addEventListener("change", refreshPivoMap);
    });
    // auto-calc lastTowerRadius when lastTower coords change
    const syncLastTowerRadius = () => {
      const d = calculateDistanceMeters(
        document.getElementById("pivo_lat")?.value,
        document.getElementById("pivo_lng")?.value,
        document.getElementById("pivo_lastTowerLat")?.value,
        document.getElementById("pivo_lastTowerLng")?.value
      );
      const el = document.getElementById("pivo_lastTowerRadius");
      if (el) el.value = Number.isFinite(d) && d > 0 ? d.toFixed(2) : "";
    };

    ["pivo_lat", "pivo_lng", "pivo_lastTowerLat", "pivo_lastTowerLng"].forEach(id => {
      document.getElementById(id)?.addEventListener("input", () => {
        syncLastTowerRadius();
      });
    });


    const data = collectPivoFormData();
    renderPivosFormMap(data, getAllPivosRecords());
    normalizeMapActionsPlacement();

    // --- Map pick buttons ---
    const pickCenterBtn = document.getElementById("pivoMapPickCenterBtn");
    const pickRefBtn = document.getElementById("pivoMapPickRefBtn");
    const pickLastTowerBtn = document.getElementById("pivoMapPickLastTowerBtn");
    const pickStartBtn = document.getElementById("pivoMapPickStartBtn");
    const pickEndBtn = document.getElementById("pivoMapPickEndBtn");
    const resetCoordsBtn = document.getElementById("pivoMapResetCoordsBtn");
    const allPickBtns = [pickCenterBtn, pickRefBtn, pickLastTowerBtn, pickStartBtn, pickEndBtn].filter(Boolean);

    const activatePickBtn = (target, btn) => {
      if (target === "center" || target === "ref") {
        const draft = ensurePivoLocationDraft(target);
        if (draft?.changed) {
          renderPivosFormMap(collectPivoFormData(), getAllPivosRecords());
        }
      }

      allPickBtns.forEach(b => b.classList.remove("is-active"));
      if (pivosState.pickTarget === target) {
        pivosState.pickTarget = null;
      } else {
        pivosState.pickTarget = target;
        btn?.classList.add("is-active");

        // Se for CENTRO e as coordenadas estiverem vazias, coloca o pin no centro do mapa para começar
        if (target === "center") {
          const latVal = document.getElementById("pivo_lat")?.value;
          const lngVal = document.getElementById("pivo_lng")?.value;
          if (!latVal || !lngVal) {
            if (!pivosState.map) return;
            const mapCenter = pivosState.map.getCenter();
            const nLat = Number(mapCenter.lat.toFixed(6));
            const nLng = Number(mapCenter.lng.toFixed(6));
            document.getElementById("pivo_lat").value = String(nLat);
            document.getElementById("pivo_lng").value = String(nLng);
            const pivoCenter = document.getElementById("pivo_center");
            if (pivoCenter) pivoCenter.value = `${nLat}, ${nLng}`;
            // renderPivosFormMap will show only the pin because pickTarget is "center"
            renderPivosFormMap(collectPivoFormData(), getAllPivosRecords());
          } else {
            // If already has coords, just refresh to hide circle if picking center
            renderPivosFormMap(collectPivoFormData(), getAllPivosRecords());
          }
        }
      }
      syncPivoCursor();
    };

    if (pickCenterBtn) pickCenterBtn.onclick = () => activatePickBtn("center", pickCenterBtn);
    if (pickRefBtn) pickRefBtn.onclick = () => activatePickBtn("ref", pickRefBtn);
    if (pickLastTowerBtn) pickLastTowerBtn.onclick = () => activatePickBtn("lastTower", pickLastTowerBtn);
    if (pickStartBtn) pickStartBtn.onclick = () => activatePickBtn("start", pickStartBtn);
    if (pickEndBtn) pickEndBtn.onclick = () => activatePickBtn("end", pickEndBtn);
    if (resetCoordsBtn) resetCoordsBtn.onclick = () => {
      pivosState.pickTarget = null;
      allPickBtns.forEach(b => b.classList.remove("is-active"));
      syncPivoCursor();
      resetPivoCoordinateInputs();
      renderPivosFormMap(collectPivoFormData(), getAllPivosRecords());
    };

    // --- Cardinal point buttons ---
    container.querySelectorAll(".pivo-cardinal-btn[data-bearing]").forEach(btn => {
      btn.addEventListener("click", () => {
        const bearing = Number(btn.dataset.bearing);
        const lat = document.getElementById("pivo_lat")?.value;
        const lng = document.getElementById("pivo_lng")?.value;
        const radius = document.getElementById("pivo_radius")?.value || 400;
        const pt = calculateBearingPoint(lat, lng, radius, bearing);
        if (!pt) { alert(tMsg("Defina primeiro o centro e o raio do pivô.")); return; }
        const refLat = document.getElementById("pivo_refLat");
        const refLng = document.getElementById("pivo_refLng");
        if (refLat) refLat.value = String(pt.lat);
        if (refLng) refLng.value = String(pt.lng);
        refreshPivoMap();
      });
    });

    if (!source && pivosState.map) {
      centerPivoMapOnFarm(pivosState.map, currentFarmId, 14);
      setTimeout(() => pivosState.map.invalidateSize(), 0);
    }

    syncPivoRadiusFromInputs();
    syncPivoNorthReferenceFromInputs();
    syncPartialUi();
    initCadCustomSelects(container);

  }

  function collectPivoFormData() {
    const normalizePivoRecord = (...args) => Cad.data?.normalizePivoRecord?.(...args) || Cad.pivosHelpers?.normalizePivoRecord?.(...args);
    const calculateDistanceMeters = (...args) => Cad.geo.calculateDistanceMeters(...args);
    const calculateNorthReference = (...args) => Cad.geo.calculateNorthReference(...args);

    const parseJsonInput = (id, fallback = undefined) => {
      const raw = document.getElementById(id)?.value || "";
      if (!raw) return fallback;
      try {
        return JSON.parse(raw);
      } catch (_) {
        return fallback;
      }
    };

    const farmIdFromContext =
      document.getElementById("pivo_farm")?.value ||
      window.IcFarmActive?.id ||
      Cad.data.getAllFarms()?.[0]?.id ||
      "";

    const payload = {
      id: document.getElementById("pivo_id")?.value || `pivo_${Date.now()}`,
      farmId: farmIdFromContext,
      talhaoIds: parseJsonInput("pivo_talhoes_ids", []),
      pumpIds: parseJsonInput("pivo_bombas_ids", []),
      monitorIds: parseJsonInput("pivo_monitoramento_ids", []),
      name: document.getElementById("pivo_name")?.value?.trim() || "",
      controllerType: document.getElementById("pivo_controllerType")?.value || "none",
      manufacturer: "",
      panelType: (() => {
        const value = document.getElementById("pivo_controllerType")?.value || "none";
        if (value === "smart_connect") return "Smart Connect";
        if (value === "smarttouch") return "Smart Touch";
        return "";
      })(),
      communicationType: "",
      panelEnabled: !!document.getElementById("pivo_panelEnabled")?.checked,
      lat: document.getElementById("pivo_lat")?.value || "",
      lng: document.getElementById("pivo_lng")?.value || "",
      refLat: document.getElementById("pivo_refLat")?.value || "",
      refLng: document.getElementById("pivo_refLng")?.value || "",
      radius: document.getElementById("pivo_radius")?.value || "",
      flow: document.getElementById("pivo_flow")?.value || "",
      speed: document.getElementById("pivo_speed")?.value || "",
      maxAngle: document.getElementById("pivo_maxAngle")?.value || 360,
      isPartial: !!document.getElementById("pivo_isPartial")?.checked,
      alignNorth: (() => {
        const alignInput = document.getElementById("pivo_alignNorth");
        if (!alignInput) return false;
        if (alignInput.type === "checkbox") return !!alignInput.checked;
        return ["1", "true", "on", "yes", "sim"].includes(String(alignInput.value || "").trim().toLowerCase());
      })(),
      startLat: document.getElementById("pivo_startLat")?.value || "",
      startLng: document.getElementById("pivo_startLng")?.value || "",
      endLat: document.getElementById("pivo_endLat")?.value || "",
      endLng: document.getElementById("pivo_endLng")?.value || "",
      lastTowerLat: document.getElementById("pivo_lastTowerLat")?.value || "",
      lastTowerLng: document.getElementById("pivo_lastTowerLng")?.value || "",
      lastTowerRadius: document.getElementById("pivo_lastTowerRadius")?.value || "",
      towerSpeed: document.getElementById("pivo_towerSpeed")?.value || 100,
      hasParcelas: !!document.getElementById("pivo_hasParcelas")?.checked,
      pumpPower: document.getElementById("pivo_pump_power")?.value || "",
      pumpTime: document.getElementById("pivo_pump_time")?.value || "",
      delayTime: document.getElementById("pivo_delay_time")?.value || "",
      unstableTime: document.getElementById("pivo_unstable_time")?.value || "",
      pressureType: document.getElementById("pivo_pressure_type")?.value || "pressostato",
      sensorScale: document.getElementById("pivo_sensor_scale")?.value || "",
      voltageMin: document.getElementById("pivo_sensor_min")?.value || "",
      voltageMax: document.getElementById("pivo_sensor_max")?.value || "",
      enableFertirrigacao: !!document.getElementById("pivo_fertirrigacao")?.checked,
      radioCentral: document.getElementById("pivo_radioCentral")?.value || "",
      radioControl: document.getElementById("pivo_radioControl")?.value || "",
      radioGps: document.getElementById("pivo_radioGps")?.value || "",
      radioBomba: document.getElementById("pivo_radioBomba")?.value || "",
      language: document.getElementById("pivo_language")?.value || "pt",
      area: document.getElementById("pivo_area")?.value || "",
      pluvioScale: document.getElementById("pivo_pluvioScale")?.value || "",
      pluvioStopCondition: document.getElementById("pivo_pluvioStopCondition")?.value || "decrement",
      pluvioValue: document.getElementById("pivo_pluvioValue")?.value || "",
      pumpTimeLimit: document.getElementById("pivo_pumpTimeLimit")?.value || "",
      voltageTimeLimit: document.getElementById("pivo_voltageTimeLimit")?.value || "",
      autorreversaoCondition: document.getElementById("pivo_autorreversaoCondition")?.value || "fim_curso",
      autorreversaoWait: document.getElementById("pivo_autorreversaoWait")?.value || "30s",
      peakDays: Array.from(document.querySelectorAll(".pivo_peek_days:checked")).map((el) => Number(el.value)),
      peak1Start: document.getElementById("pivo_peak1Start")?.value || "",
      peak1End: document.getElementById("pivo_peak1End")?.value || "",
      peak2Start: document.getElementById("pivo_peak2Start")?.value || "",
      peak2End: document.getElementById("pivo_peak2End")?.value || "",
      parcelas: parseJsonInput("pivo_parcelas_json"),
      segments: parseJsonInput("pivo_seg_json"),
      canhaoMode: document.getElementById("pivo_canhao_mode_select")?.value || document.getElementById("pivo_canhao_mode")?.value || "off",
      canhaoSegments: parseJsonInput("pivo_canhao_seg_json", [])
    };

    const raw = typeof normalizePivoRecord === "function" ? normalizePivoRecord(payload) : payload;

    const radiusFromReference = calculateDistanceMeters(raw.lat, raw.lng, raw.refLat, raw.refLng);
    if (Number.isFinite(radiusFromReference) && radiusFromReference > 0) {
      raw.radius = String(Number(radiusFromReference.toFixed(2)));
    }

    const lastTowerRadiusCalc = calculateDistanceMeters(raw.lat, raw.lng, raw.lastTowerLat, raw.lastTowerLng);
    if (Number.isFinite(lastTowerRadiusCalc) && lastTowerRadiusCalc > 0) {
      raw.lastTowerRadius = String(Number(lastTowerRadiusCalc.toFixed(2)));
    }

    if (raw.alignNorth) {
      const northRef = calculateNorthReference(raw.lat, raw.lng, raw.radius);
      if (northRef) {
        raw.refLat = String(northRef.lat);
        raw.refLng = String(northRef.lng);
      }
    }

    return raw;
  }

  function resetPivoCoordinateInputs() {
    [
      "pivo_lat",
      "pivo_lng",
      "pivo_center",
      "pivo_refLat",
      "pivo_refLng",
      "pivo_ref",
      "pivo_lastTowerLat",
      "pivo_lastTowerLng",
      "pivo_lastTowerRadius",
      "pivo_startLat",
      "pivo_startLng",
      "pivo_endLat",
      "pivo_endLng"
    ].forEach((id) => {
      const input = document.getElementById(id);
      if (input) input.value = "";
    });
  }

  function preparePivoSaveData(rawData) {
    const data = rawData && typeof rawData === "object" ? { ...rawData } : {};
    const normalizeAngle = (value, fallback = 0) => {
      const n = Number(value);
      return Number.isFinite(n) ? ((n % 360) + 360) % 360 : fallback;
    };

    data.parcelas = Array.isArray(data.parcelas) ? data.parcelas : [];
    data.parcelas = data.parcelas.map((item) => {
      const start = Number(item?.startAngle);
      const end = Number(item?.endAngle);
      return {
        id: String(item?.id || `parcela_${Date.now()}`),
        name: String(item?.name || "").trim() || "Parcela",
        startAngle: Number.isFinite(start) ? normalizeAngle(start, 0) : 0,
        endAngle: Number.isFinite(end) ? normalizeAngle(end, 360) : 360
      };
    });

    data.segments = Array.isArray(data.segments) ? data.segments : [];
    data.segments = data.segments.map((item, idx) => {
      const start = Number(item?.startAngle);
      const end = Number(item?.endAngle);
      return {
        id: String(item?.id || `seg_${idx}`),
        name: String(item?.name || ""),
        startAngle: Number.isFinite(start) ? normalizeAngle(start, 0) : 0,
        endAngle: Number.isFinite(end) ? normalizeAngle(end, 360) : 360
      };
    });

    data.canhaoSegments = Array.isArray(data.canhaoSegments) ? data.canhaoSegments : [];
    data.canhaoSegments = data.canhaoSegments.map((item, idx) => {
      const start = Number(item?.startAngle);
      const end = Number(item?.endAngle);
      return {
        id: String(item?.id || `cs_${idx}`),
        startAngle: Number.isFinite(start) ? normalizeAngle(start, 0) : 0,
        endAngle: Number.isFinite(end) ? normalizeAngle(end, 360) : 360
      };
    });

    return data;
  }

  Cad.formPivos = Object.assign(Cad.formPivos || {}, {
    renderFormPivos,
    bindPivoFormBaseListeners,
    renderPivoParcelasAndSegmentsEditor,
    renderPivoCanhaoEditor,
    renderPivoMapAndCoordinateListeners,
    collectPivoFormData,
    preparePivoSaveData,
    renderPivosFormMap: passthrough("renderPivosFormMap"),
    ensurePivoLocationDraft,
    syncPivoRadiusFromInputs,
    syncPivoNorthReferenceFromInputs,
    resetPivoCoordinateInputs,
    centerPivoMapOnFarm,
    bindPivoMapPickEvents,
    syncPivoCursor
  });

  Cad.pivosHelpers = Object.assign(Cad.pivosHelpers || {}, {
    bindPivoFormBaseListeners,
    renderPivoParcelasAndSegmentsEditor,
    renderPivoCanhaoEditor,
    renderPivoMapAndCoordinateListeners,
    collectPivoFormData,
    ensurePivoLocationDraft,
    syncPivoRadiusFromInputs,
    syncPivoNorthReferenceFromInputs,
    resetPivoCoordinateInputs,
    centerPivoMapOnFarm,
    bindPivoMapPickEvents,
    syncPivoCursor,
    preparePivoSaveData
  });

})();
