(function () {
  "use strict";

  window.IcEquipamentos = window.IcEquipamentos || {};

  // ========= Helpers =========
  // pinIcon compartilhado — ver assets/js/core/map-icons.js
  const { pinIcon } = window.IcMapIcons;
  // escapeHtml/parseLatLng compartilhados — ver assets/js/core/geo-utils.js
  const { escapeHtml, parseLatLng } = window.IcGeo;

  window.IcEquipamentos.pluviometro = {
    label: "Pluvi\u00f4metro",

    // =================
    // STEP 2 - Localiza\u00e7\u00e3o
    // =================
    renderStep2(container, state) {
      const loc = state.loc ?? "";

      container.innerHTML = `
        <div class="equip-page equip-page--link">
          <div class="equip-page__title"></div>
          <div class="equip-page__sub"></div>

          <div class="equip-form">
            <div class="equip-field">
              <label class="equip-label" for="plvLoc"><span class="equip-required">*</span>Localiza\u00e7\u00e3o do equipamento</label>
              <div class="rp-loc__row">
                <div class="rp-loc__input">
                  <input class="equip-input" id="plvLoc" placeholder="Ex: -23.5505, -46.6333" value="${escapeHtml(loc)}" />
                </div>
                <button class="equip-btn btn btn--outline rp-loc__btn" type="button" data-action="plv-get-loc">
                  <i class="fa-solid fa-location-dot" aria-hidden="true" style="color:#22c55e;"></i> Obter Localiza\u00e7\u00e3o
                </button>
              </div>
            </div>

            <div id="plvMiniMap" class="equip-mini-map"></div>
            <div class="equip-mini-map__hint"></div>
          </div>
        </div>
      `;

      this.initMiniMap(container, state);
    },

    initMiniMap(container, state) {
      if (!window.L) return;

      const mapEl = container.querySelector("#plvMiniMap");
      const inputLoc = container.querySelector("#plvLoc");
      if (!mapEl || !inputLoc) return;

      if (state._miniMap) {
        try {
          state._miniMap.remove();
        } catch (e) { }
        state._miniMap = null;
      }

      let center = [-16.767, -47.613];
      let zoom = 16;

      if (typeof state.lat === "number" && typeof state.lng === "number") {
        center = [state.lat, state.lng];
        zoom = 17;
      }

      const miniMap = L.map(mapEl, { zoomControl: false }).setView(center, zoom);

      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, attribution: "Tiles \u00a9 Esri" }
      ).addTo(miniMap);

      L.tileLayer(
        "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, opacity: 0.85 }
      ).addTo(miniMap);

      const marker = L.marker(center, { icon: pinIcon() }).addTo(miniMap);

      miniMap.on("click", (e) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);

        const txt = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        inputLoc.value = txt;

        state.loc = txt;
        state.lat = lat;
        state.lng = lng;
      });

      state._miniMap = miniMap;
      setTimeout(() => miniMap.invalidateSize(), 120);

      // Botão "Obter Localização" — usa o GPS do dispositivo
      const locBtn = container.querySelector('[data-action="plv-get-loc"]');
      if (locBtn && navigator.geolocation) {
        locBtn.addEventListener("click", () => {
          locBtn.disabled = true;
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude, longitude } = pos.coords;
              marker.setLatLng([latitude, longitude]);
              miniMap.setView([latitude, longitude], 17);

              const txt = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
              inputLoc.value = txt;
              state.loc = txt;
              state.lat = latitude;
              state.lng = longitude;
              locBtn.disabled = false;
            },
            () => { locBtn.disabled = false; },
            { enableHighAccuracy: true, timeout: 8000 }
          );
        });
      }
    },

    readStep2(container) {
      const loc = container.querySelector("#plvLoc")?.value?.trim() || "";

      const parsed = parseLatLng(loc);

      return {
        loc,
        lat: parsed?.lat ?? null,
        lng: parsed?.lng ?? null,
      };
    },

    validateStep2(data) {
      if (data.lat === null || data.lng === null) {
        return { ok: false, msg: "Informe uma Localiza\u00e7\u00e3o v\u00e1lida (Latitude, Longitude) ou clique no mapa." };
      }
      return { ok: true, msg: "" };
    },

    // =================
    // STEP 3 - Configura\u00e7\u00e3o
    // =================
    renderStep3(container, state) {
      const serial = state.serial ?? "";
      const nome = state.nome ?? "";
      const comunicacao = state.comunicacao ?? "";

      container.innerHTML = `
        <div class="equip-page equip-page--link">
          <div class="equip-page__title"></div>
          <div class="equip-page__sub"></div>

          <div class="equip-form">
            <div class="equip-form__row">
              <div class="equip-field">
                <label class="equip-label" for="plvSerial"><span class="equip-required">*</span>ID / Serial number</label>
                <input class="equip-input" id="plvSerial" placeholder="Ex: PLV-001234" value="${escapeHtml(serial)}" />
              </div>
              <button class="equip-btn btn equip-btn--primary" type="button" data-action="pluv-test">Tentar Conex\u00e3o</button>
            </div>

            <div class="equip-field">
              <label class="equip-label" for="plvNome"><span class="equip-required">*</span>Nome do pluvi\u00f4metro</label>
              <input class="equip-input" id="plvNome" placeholder="Ex: Pluvi\u00f4metro Norte, Talh\u00e3o 1" value="${escapeHtml(nome)}" />
            </div>

            <div class="equip-field">
              <label class="equip-label" for="plvCom"><span class="equip-required">*</span>Tipo de comunica\u00e7\u00e3o</label>
              <select class="equip-input" id="plvCom">
                <option value="4g" ${!comunicacao || comunicacao === "4g" ? "selected" : ""}>4G</option>
                <option value="radio" ${comunicacao === "radio" ? "selected" : ""}>R\u00e1dio</option>
              </select>
            </div>
          </div>
        </div>
      `;
    },

    readStep3(container) {
      const serial = container.querySelector("#plvSerial")?.value?.trim() || "";
      const nome = container.querySelector("#plvNome")?.value?.trim() || "";
      const comunicacao = container.querySelector("#plvCom")?.value || "";

      return { serial, nome, comunicacao };
    },

    validateStep3(data) {
      if (!data.serial) return { ok: false, msg: "Informe o ID / Serial number." };
      if (!data.nome) return { ok: false, msg: "Informe o Nome do Pluvi\u00f4metro." };
      if (!data.comunicacao) return { ok: false, msg: "Selecione o tipo de comunica\u00e7\u00e3o." };
      return { ok: true, msg: "" };
    },
  };
})();
