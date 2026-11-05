// assets/js/pages/monitoramento/index.js
(function () {
  "use strict";

  async function mountMonitorView() {
    const slot = document.getElementById("pageSlot");
    if (!slot) return;
    const html = await fetch("./pages/monitoramento.html").then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); });
    slot.innerHTML = html;
    initMonitorUI(slot);
  }

  function hideMapCard() {
    const mapCard = document.getElementById("mapCard");
    if (mapCard) mapCard.style.display = "none";
  }

  function showMapCard() {
    const mapCard = document.getElementById("mapCard");
    if (mapCard) mapCard.style.display = "";
  }

  window.IcMonitoramento = {
    async open() {
      document.body.classList.add("is-monitoramento");
      hideMapCard();
      await mountMonitorView();
      window.dispatchEvent(new Event("ic:layout-change"));
    },

    close() {
      document.body.classList.remove("is-monitoramento");
      const slot = document.getElementById("pageSlot");
      if (slot) slot.innerHTML = "";
      showMapCard();
      window.dispatchEvent(new Event("ic:layout-change"));
    },
  };

  function initMonitorUI(root) {
    const tabs = Array.from(root.querySelectorAll(".monitor-view__tab"));

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach(t => {
          t.classList.remove("is-active");
          t.setAttribute("aria-selected", "false");
        });
        tab.classList.add("is-active");
        tab.setAttribute("aria-selected", "true");
        // Lógica de filtro por período virá depois
      });
    });

    const layers = Array.from(root.querySelectorAll(".monitor-layer"));
    const content = root.querySelector(".monitor-view__content");

    layers.forEach((layer) => {
      layer.addEventListener("click", () => {
        layers.forEach(l => l.classList.remove("is-active"));
        layer.classList.add("is-active");

        const layerType = layer.dataset.layer;
        if (content) {
          content.dataset.currentLayer = layerType;
        }

        // Seleciona todos os rótulos e valores de métricas
        const allLabels = root.querySelectorAll(".monitor-view__metric-label");
        const allValues = root.querySelectorAll(".monitor-view__metric-value");

        allLabels.forEach((label, idx) => {
          if (layerType === 'uniformity') {
            const uLabels = ['Média', 'Tendência', 'Nível', 'Mínima'];
            if (uLabels[idx]) label.textContent = uLabels[idx];
          } else {
            const nLabels = ['Média', 'Tendência', 'Vigor', 'Uniform.'];
            if (nLabels[idx]) label.textContent = nLabels[idx];
          }
        });

        allValues.forEach((val, idx) => {
          // Lógica para o campo de Vigor/Nível (índice 2)
          if (idx === 2) {
            if (layerType === 'uniformity') {
              const uValues = ['Alto', 'Médio', 'Alto'];
              val.textContent = uValues[Math.floor(idx / 4)] || 'Alto'; // Simula por linha se necessário
              // Simplificando: como o querySelectorAll pega todos de todos os pivôs, 
              // vamos usar um seletor mais preciso ou um data-attribute.
            }
          }
        });

        // Refatorando para tratar cada pivô individualmente e garantir que os valores Alto/Médio/Baixo 
        // apareçam corretamente no lugar do Vigor.
        const rows = root.querySelectorAll(".monitor-view__row-group");
        rows.forEach((row, rowIdx) => {
          const vigorValue = row.querySelector("[data-metric-value-vigor]");
          const vigorLabel = row.querySelector("[data-metric-label-vigor]");
          const otherLabels = row.querySelectorAll(".monitor-view__metric-label");

          if (layerType === 'uniformity') {
            vigorLabel.textContent = 'Nível';
            // Simulação de valores p/ cada pivô
            const levels = ['Alto', 'Médio', 'Alto'];
            vigorValue.textContent = levels[rowIdx];
            otherLabels[3].textContent = 'Mínima';
          } else {
            vigorLabel.textContent = 'Vigor';
            const vigors = ['Ótimo', 'Alerta', 'Excelente'];
            vigorValue.textContent = vigors[rowIdx];
            otherLabels[3].textContent = 'Uniform.';
          }
        });

        // Atualiza a escala do eixo Y dinamicamente
        const axisContainers = root.querySelectorAll("[data-axis-y]");
        axisContainers.forEach(container => {
          const spans = container.querySelectorAll("span");
          if (layerType === 'uniformity') {
            const values = ['100', '85', '75', '65', '50']; // Escala 50 a 100
            spans.forEach((span, i) => span.textContent = values[i]);
          } else {
            const values = ['1.00', '0.75', '0.50', '0.25', '0.00']; // Escala NDVI
            spans.forEach((span, i) => span.textContent = values[i]);
          }
        });
      });
    });

    const multi = root.querySelector("[data-monitor-multi]");
    if (multi) {
    }

    const dateInput = root.querySelector(".monitor-view__date-input");
    if (dateInput) {
      dateInput.addEventListener("click", () => {
      });
    }

    const headRow = root.querySelector("[data-monitor-header]");
    const bodyRow = root.querySelector("[data-monitor-body]");
    if (headRow && bodyRow) {
      const syncHead = () => {
        headRow.scrollLeft = bodyRow.scrollLeft;
      };
      bodyRow.addEventListener("scroll", syncHead, { passive: true });
      syncHead();
    }

    // Modal de Imagem do Monitoramento
    const imageModal = root.querySelector("#monitorImageModal");
    if (imageModal) {
      const modalImg = imageModal.querySelector("#modalMainImg");
      const modalVisual = imageModal.querySelector("#modalMainVisual");
      const modalTitle = imageModal.querySelector("#modalImgTitle");
      const pressureBtn = imageModal.querySelector("[data-btn-pressure]");
      const closeButtons = imageModal.querySelectorAll("[data-close-modal]");

      let monitorMapInstance = null;
      let currentSelectedPivoId = null;

      const resolvePivotData = (pivoId) => {
        // 1. Tentar dados oficiais do módulo de Pivôs (que lê da fazenda ativa)
        if (window.Pivos && window.Pivos.data && typeof window.Pivos.data.getPivotData === 'function') {
          const data = window.Pivos.data.getPivotData(pivoId);
          if (data && data.center) return data;
        }

        // 2. Fallback para dados do Chuva Geo (irrigationAreas)
        if (window.ChuvaGeo && window.ChuvaGeo.data && Array.isArray(window.ChuvaGeo.data.irrigationAreas)) {
          const area = window.ChuvaGeo.data.irrigationAreas.find(a => a.id === pivoId);
          if (area && area.center) {
            return {
              center: { lat: area.center[0], lng: area.center[1] },
              radius: area.radius || 300,
              name: area.name
            };
          }
        }

        // 3. Mock final se nada for encontrado (Fazenda Santa Clara)
        return {
          center: { lat: -16.257, lng: -47.413 },
          radius: 300,
          name: "Pivô Desconhecido"
        };
      };

      const updateTechInfo = (pivoData) => {
        const gpsEl = imageModal.querySelector("[data-modal-gps]");
        // const angleEl = imageModal.querySelector("[data-modal-angle]"); // Mantém mock por enquanto se não houver no dado

        if (pivoData && pivoData.center) {
          if (gpsEl) gpsEl.textContent = `${pivoData.center.lat.toFixed(5)}, ${pivoData.center.lng.toFixed(5)}`;
        }
      };

      const renderMonitorMap = (pivoData) => {
        const mapEl = root.querySelector("#monitorModalMap");
        if (!mapEl || !pivoData) return;

        // Limpar instância anterior para evitar fantasmas no DOM
        if (monitorMapInstance) {
          monitorMapInstance.remove();
          monitorMapInstance = null;
        }

        try {
          monitorMapInstance = L.map(mapEl, {
            zoomControl: false,
            attributionControl: false,
            zoomSnap: 0,
            dragging: true, // Permitir arrastar agora que ocupa o lugar da imagem
            scrollWheelZoom: true,
            fadeAnimation: true
          });

          // ArcGIS Satellite como primário
          const satelliteTiles = L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            {
              maxZoom: 19,
              attribution: 'ArcGIS'
            }
          ).addTo(monitorMapInstance);

          // Fallback se o satélite falhar (Garante que nunca fique cinza)
          satelliteTiles.on('tileerror', () => {
            console.warn("Monitor Map: ArcGIS tiles falharam, usando OSM como fallback.");
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(monitorMapInstance);
          });

          if (pivoData.center && pivoData.radius) {
            const latlng = [pivoData.center.lat, pivoData.center.lng];

            // 1. Desenhar contorno físico do pivô (Linha Branca)
            L.circle(latlng, {
              radius: pivoData.radius,
              color: "#ffffff",
              weight: 2,
              fill: true,
              fillColor: "rgba(255,255,255,0.05)",
              pointerEvents: 'none'
            }).addTo(monitorMapInstance);

            // 2. Gerar Dados de Pressão e Heat Map
            const pressurePoints = [];
            const segments = [];
            const steps = 120;
            const seed = (pivoData.id || "pivo").split('').reduce((a, b) => a + b.charCodeAt(0), 0);

            for (let i = 0; i <= 360; i += (360 / steps)) {
              const angleRad = (i - 90) * (Math.PI / 180);

              // Simulação de pressão (7.0 = Perfeito)
              let pressure = 6.4 + (Math.sin(i * 0.05 + seed) * 0.3);

              // Zonas de Falha determinísticas para o efeito visual
              if ((i > 40 && i < 75) || (i > 160 && i < 210) || (i > 290 && i < 335)) {
                const intensity = Math.sin((i - 40) * 0.1) * 2.0;
                pressure -= Math.max(0.5, intensity + (seed % 10 / 10));
              }

              pressure = Math.min(7.0, Math.max(0.5, pressure));
              const ratio = pressure / 7.0;

              // Ponto da Linha Azul (Pressão Real)
              const dReal = pivoData.radius * ratio;
              const pReal = [
                pivoData.center.lat + (dReal / 111320) * Math.sin(angleRad),
                pivoData.center.lng + (dReal / (111320 * Math.cos(pivoData.center.lat * Math.PI / 180))) * Math.cos(angleRad)
              ];

              // Ponto da Linha Branca (Limite Físico)
              const dWhite = pivoData.radius;
              const pWhite = [
                pivoData.center.lat + (dWhite / 111320) * Math.sin(angleRad),
                pivoData.center.lng + (dWhite / (111320 * Math.cos(pivoData.center.lat * Math.PI / 180))) * Math.cos(angleRad)
              ];

              pressurePoints.push(pReal);
              segments.push({ pReal, pWhite, pressure });
            }

            // A. Desenhar áreas de Heat Map / Irrigação Complementar
            // Estilo Futurista: Onde a pressão é boa, completa com Azul. Onde falha, Amarelo -> Vermelho.
            for (let i = 0; i < segments.length - 1; i++) {
              const s1 = segments[i];
              const s2 = segments[i + 1];
              const gap = 7.0 - s1.pressure;

              let color, opacity;

              if (gap < 0.4) {
                // Pressão OK: Azul mais presente para destacar a área irrigada
                color = "#00d4ff";
                opacity = 0.4;
              } else {
                // Falha de Pressão: Cores mais vivas (Amarelo Neon -> Vermelho Fogo)
                const hue = Math.max(0, 60 - ((gap - 0.4) * 20)); // Aceleramos a transição para o vermelho
                color = `hsl(${hue}, 100%, 50%)`; // 50% de brilho para cores mais puras
                opacity = Math.min(0.85, 0.2 + (gap * 0.2)); // Aumentamos consideravelmente a opacidade
              }

              L.polygon([s1.pReal, s1.pWhite, s2.pWhite, s2.pReal], {
                color: 'transparent',
                fillColor: color,
                fillOpacity: opacity,
                pointerEvents: 'none'
              }).addTo(monitorMapInstance);
            }

            // B. Desenhar o Miolo Irrigado (Azul Holográfico Ultra Vibrante)
            L.polygon(pressurePoints, {
              color: 'transparent',
              fillColor: "#00d4ff",
              fillOpacity: 0.4,
              pointerEvents: 'none'
            }).addTo(monitorMapInstance);

            // 3. Posicionar o mapa com zoom ligeiramente mais afastado (15.5)
            monitorMapInstance.setView(latlng, 15.5);

            // Sequência de invalidação para garantir renderização perfeita em modais/containers display:none
            const forceRefresh = () => {
              if (monitorMapInstance) {
                monitorMapInstance.invalidateSize();
              }
            };

            setTimeout(forceRefresh, 50);
            setTimeout(forceRefresh, 200);
            setTimeout(forceRefresh, 500);
          }
        } catch (err) {
          console.error("Erro ao inicializar mapa de monitoramento:", err);
        }
      };

      const openModal = (imgSrc, date, pivoId) => {
        currentSelectedPivoId = pivoId;
        const pivoData = resolvePivotData(pivoId);

        if (modalImg) modalImg.src = imgSrc;
        if (modalTitle) modalTitle.textContent = `${pivoData.name || 'Monitoramento'} - ${date}`;

        // Atualiza as coordenadas GPS nos dados técnicos
        updateTechInfo(pivoData);

        // Reset visual state (always shows image first)
        if (modalVisual) modalVisual.classList.remove("is-map-active");

        imageModal.classList.add("is-open");
        imageModal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
      };

      const closeModal = () => {
        imageModal.classList.remove("is-open");
        imageModal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
      };

      if (pressureBtn) {
        pressureBtn.addEventListener("click", () => {
          if (!modalVisual) return;

          const isMapNow = !modalVisual.classList.contains("is-map-active");
          modalVisual.classList.toggle("is-map-active", isMapNow);

          if (isMapNow) {
            const pivoData = resolvePivotData(currentSelectedPivoId);

            // Agora que o CSS não bloqueia as imagens, um único invalidateSize basta.
            setTimeout(() => {
              renderMonitorMap(pivoData);
            }, 50);
          }
        });
      }

      closeButtons.forEach(btn => btn.addEventListener("click", closeModal));

      // Delegar clique para os cards de imagem
      root.addEventListener("click", (e) => {
        const card = e.target.closest(".monitor-view__img-card");
        if (card) {
          const img = card.querySelector("img");
          const dateSpan = card.querySelector(".monitor-view__img-date");
          const group = card.closest("[data-pivo-id]");
          const pivoId = group ? group.dataset.pivoId : null;

          if (img && dateSpan) {
            openModal(img.src, dateSpan.textContent, pivoId);
          }
        }
      });
    }
  }
})();
