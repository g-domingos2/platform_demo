// assets/js/pages/pluviometria/feature.cards.js
(function () {
  "use strict";

  const Plv = (window.Plv = window.Plv || {});
  const data = (Plv.data = Plv.data || {});
  const state = (Plv.state = Plv.state || {});
  const dom = (Plv.dom = Plv.dom || {});
  const cards = (Plv.cards = Plv.cards || {});
  const $ = dom.$ || ((id) => document.getElementById(id));

  function updateSelectionClasses() {
    const body = document.body;
    const hasSelection = state.selected.size > 0;
    const singleSelection = state.selected.size === 1;
    body.classList.toggle("pluv-has-selection", hasSelection);
    body.classList.toggle("pluv-has-single-selection", singleSelection);
  }

  function isAllMode() {
    return state.selected.size === 0;
  }

  function selectedList() {
    const list = data.PLUVIOS || [];
    return isAllMode() ? list : list.filter((p) => state.selected.has(p.id));
  }

  function rainIconSvg() {
    return `
      <svg class="pluv-rain-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <g class="pluv-rain-icon__cloud">
          <circle cx="18" cy="22" r="8"></circle>
          <circle cx="28" cy="18" r="10"></circle>
          <circle cx="36" cy="23" r="7"></circle>
          <rect x="12" y="22" width="28" height="10" rx="5"></rect>
        </g>
        <g class="pluv-rain-icon__drops">
          <path d="M0 0c-2.2 3-3.2 4.9-3.2 6.7a3.2 3.2 0 0 0 6.4 0c0-1.8-1-3.7-3.2-6.7z" transform="translate(16 31)"></path>
          <path d="M0 0c-2.2 3-3.2 4.9-3.2 6.7a3.2 3.2 0 0 0 6.4 0c0-1.8-1-3.7-3.2-6.7z" transform="translate(25 33) scale(0.9)"></path>
          <path d="M0 0c-2.2 3-3.2 4.9-3.2 6.7a3.2 3.2 0 0 0 6.4 0c0-1.8-1-3.7-3.2-6.7z" transform="translate(34 31.5) scale(0.85)"></path>
        </g>
      </svg>
    `;
  }

  function mmIconSvg() {
    return `
      <svg class="pluv-mm-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"></path>
        <path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"></path>
      </svg>
    `;
  }

  function groupIconMarkup(icon) {
    if (icon === "fa-cloud-rain") return rainIconSvg();
    return `<i class="fa-solid ${icon}"></i>`;
  }

  function hydrateRainIcons(root) {
    const host = root || document;
    if (!host || !host.querySelectorAll) return;
    host.querySelectorAll("i.fa-cloud-rain").forEach((el) => {
      el.outerHTML = rainIconSvg();
    });
  }

  function nowIconStyle(p) {
    if (p.status === "rain") return { bg: "rgba(37,99,235,.10)", color: "#2563eb" };
    if (p.status === "dry") return { bg: "rgba(245,158,11,.16)", color: "#b45309" };
    if (p.semComunicacao) return { bg: "rgba(245,158,11,.18)", color: "#92400e" };
    return { bg: "rgba(100,116,139,.12)", color: "#334155" };
  }

  function isRaining(p) {
    return p.status === "rain";
  }

  function isOffline(p) {
    return !!p.semComunicacao;
  }

  function isHighlight(p) {
    return isRaining(p) || isOffline(p);
  }

  function filterLabel() {
    if (state.pluvFilter === "highlights") return "Destaques";
    if (state.pluvFilter === "rain") return "Chovendo";
    if (state.pluvFilter === "offline") return "Offline";
    return "Todos";
  }

  function matchesSearch(p) {
    const term = state.pluvSearch.trim().toLowerCase();
    if (!term) return true;
    const haystack = [
      p.nome,
      p.sub,
      p.statusLabel,
      p.statusMeta,
      p.intensidade,
      p.intensidadeMeta,
      (p.pivos || []).join(" "),
    ].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(term);
  }

  function matchesFilter(p) {
    if (state.pluvFilter === "highlights") return isHighlight(p);
    if (state.pluvFilter === "rain") return isRaining(p);
    if (state.pluvFilter === "offline") return isOffline(p);
    return true;
  }

  function filteredList() {
    const list = data.PLUVIOS || [];
    return list.filter((p) => matchesFilter(p) && matchesSearch(p));
  }

  function syncSelectionUI() {
    const crumb = $("pluvCrumb");
    if (crumb) {
      crumb.textContent = `• ${filterLabel()}`;
    }

    const list = data.PLUVIOS || [];
    const counts = {
      all: list.length,
      rain: list.filter(isRaining).length,
      offline: list.filter(isOffline).length,
    };

    const panel = $("pluvPanel");
    panel?.querySelectorAll("[data-count]").forEach((el) => {
      const key = el.getAttribute("data-count");
      if (!key || !(key in counts)) return;
      el.textContent = String(counts[key]);
    });

    const badgeRain = $("pluvHighlightRain");
    if (badgeRain) badgeRain.textContent = `${counts.rain} chovendo agora`;

    const badgeOffline = $("pluvHighlightOffline");
    if (badgeOffline) badgeOffline.textContent = `${counts.offline} sem comunicação`;

    const highlights = $("pluvHighlights");
    if (highlights) highlights.hidden = state.pluvFilter !== "highlights";

    panel?.querySelectorAll("[data-filter]").forEach((btn) => {
      const isActive = btn.getAttribute("data-filter") === state.pluvFilter;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
    });
  }

  function cardTone(p) {
    if (isOffline(p)) return "pluv-card--alert";
    if (isRaining(p)) return "pluv-card--rain";
    if (p.status === "dry") return "pluv-card--dry";
    return "";
  }

  function metaLine(text) {
    return `<span class="pluv-card__meta-line">${text}</span>`;
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function extractDuration(text) {
    const raw = normalizeText(text);
    if (!raw) return "";
    const match = raw.match(/\bhá\s+(.+)$/i);
    if (match) return normalizeText(match[1]);
    const matchAlt = raw.match(/\bem\s+(.+)$/i);
    if (matchAlt) return normalizeText(matchAlt[1]);
    return "";
  }

  function extractTime(text) {
    const raw = normalizeText(text);
    if (!raw) return "";
    const hhmm = raw.match(/\b(\d{1,2}:\d{2})\b/);
    if (hhmm) return hhmm[1];
    const hour = raw.match(/\b(\d{1,2})h(\d{2})?\b/i);
    if (hour) return hour[2] ? `${hour[1]}:${hour[2]}` : `${hour[1]}h`;
    return "";
  }

  function extractSince(text) {
    const raw = normalizeText(text);
    if (!raw) return "";
    const match = raw.match(/\bdesde\s+(.+)$/i);
    if (match) return `desde ${normalizeText(match[1])}`;
    const time = extractTime(raw);
    return time ? `desde ${time}` : "";
  }

  function formatIntensityLabel(intensity) {
    const raw = normalizeText(intensity).toLowerCase();
    if (!raw) return "Chuva";
    if (/chuva/.test(raw)) return raw.replace(/\bchuva\b/i, "Chuva");
    return `Chuva ${raw}`;
  }

  function buildContextLine(p) {
    if (isOffline(p)) {
      const offlineFor = extractDuration(p.updated) || extractDuration(p.statusMeta);
      return offlineFor ? `Sem comunicação há ${offlineFor}` : "Sem comunicação";
    }

    if (isRaining(p)) {
      const intensity = formatIntensityLabel(p.intensidade);
      const sinceMeta = extractSince(p.intensidadeMeta) || extractSince(p.statusMeta);
      const sinceDuration = !sinceMeta ? extractDuration(p.statusMeta) : "";
      const since = sinceMeta || (sinceDuration ? `desde ${sinceDuration}` : "");
      return since ? `${intensity} ${since}` : intensity;
    }

    const lastTime = extractTime(p.statusMeta) || extractTime(p.intensidadeMeta);
    if (lastTime) return `Última chuva às ${lastTime}`;
    const lastDuration = extractDuration(p.statusMeta);
    if (lastDuration) return `Última chuva às ${lastDuration}`;
    return "Sem chuva recente";
  }

  function buildDurationLine(p) {
    const source = isRaining(p) ? p.statusMeta : (p.statusMeta || p.updated);
    const duration = extractDuration(source);
    return duration ? `em ${duration}` : "";
  }

  function renderCard(p) {
    const isSelected = state.selected.has(p.id);
    const isOpen = state.expanded.has(p.id);
    const tone = cardTone(p);
    const pivos = (p.pivos && p.pivos.length) ? p.pivos.join(", ") : "—";
    const talhao = p.sub || "—";

    const expandId = `pluv-card-expand-${p.id}`;
    const signalClass = p.semComunicacao ? "is-off" : "is-on";
    const signalTitle = p.semComunicacao ? "Sem comunicação" : (p.net || "Online");
    const contextLine = buildContextLine(p);
    const durationLine = buildDurationLine(p);
    const updatedLine = normalizeText(p.updated) || "Atualizado —";
    const rainBadge = isRaining(p) ? '<span class="pluv-card__pill">Chovendo agora</span>' : "";
    const offlineBadge = isOffline(p) ? '<span class="pluv-card__pill pluv-card__pill--alert">Sem comunicação</span>' : "";
    const statusBadge = rainBadge || offlineBadge || '<span class="pluv-card__pill pluv-card__pill--ghost">&nbsp;</span>';

    return `
      <article class="pluv-card card ${tone} ${isSelected ? "is-selected" : ""} ${isOpen ? "is-open" : ""}" data-pluv-card data-id="${p.id}" aria-expanded="${isOpen}">
        <div class="pluv-card__row">
          <div class="pluv-card__main">
            <div class="pluv-card__title">
              <span class="pluv-card__name">${p.nome}</span>
              <span class="pluv-card__signal ${signalClass}" title="${signalTitle}">
                <i class="fa-solid fa-wifi"></i>
              </span>
            </div>
            <div class="pluv-card__rain-context">${contextLine}</div>
          </div>
          <div class="pluv-card__right">
            <div class="pluv-card__mm-block">
              <span class="pluv-card__mm-ico">${mmIconSvg()}</span>
              <div class="pluv-card__mm-text">
                <div class="pluv-card__mm">
                  <span class="pluv-card__mm-val">${p.mm.toFixed(1)}</span>
                  <span class="pluv-card__mm-unit">mm</span>
                </div>
                <div class="pluv-card__duration">${durationLine || "&nbsp;"}</div>
              </div>
            </div>
            <button class="pluv-card__toggle" type="button" data-card-toggle aria-label="Mostrar detalhes" aria-expanded="${isOpen}" aria-controls="${expandId}">
              <i class="fa-solid fa-chevron-down"></i>
            </button>
          </div>
        </div>
        ${statusBadge}
        <div class="pluv-card__footline">
          <div class="pluv-card__updated">
            <i class="fa-solid fa-clock"></i>
            <span>${updatedLine}</span>
          </div>
        </div>
        <div class="pluv-card__expand" id="${expandId}">
          <div class="pluv-card__divider"></div>
          <div class="pluv-card__context">
            <div class="pluv-card__context-line">
              <i class="fa-solid fa-location-dot" aria-hidden="true"></i>
              <span>${talhao}</span>
            </div>
            <div class="pluv-card__context-line">
              <i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i>
              <span><span>Impacta:</span> ${pivos}</span>
            </div>
          </div>
        </div>
      </article>
    `;
  }

  function renderGroup(title, icon, items, kind) {
    if (!items.length) return "";
    return `
      <section class="pluv-group ${kind ? `pluv-group--${kind}` : ""}">
        <header class="pluv-group__head">
          <span class="pluv-group__icon">${groupIconMarkup(icon)}</span>
          <span>${title}</span>
          <span class="pluv-group__count">(${items.length})</span>
        </header>
        <div class="pluv-group__list">
          ${items.map(renderCard).join("")}
        </div>
      </section>
    `;
  }

  function renderCards() {
    updateSelectionClasses();
    const host = $("pluvCards");
    if (!host) return;

    const list = filteredList();
    const emptyText = state.pluvSearch.trim()
      ? "Nenhum pluviômetro encontrado."
      : "Nenhum pluviômetro neste filtro.";

    if (state.pluvFilter === "highlights") {
      const raining = list.filter(isRaining);
      const alerts = list.filter(isOffline);
      const html = [
        renderGroup("Chovendo agora", "fa-cloud-rain", raining, "rain"),
        renderGroup("Alertas", "fa-triangle-exclamation", alerts, "alert"),
      ].filter(Boolean).join("");
      host.innerHTML = html || `<div class="pluv-empty">${emptyText}</div>`;
    } else {
      host.innerHTML = list.length
        ? `<div class="pluv-group__list">${list.map(renderCard).join("")}</div>`
        : `<div class="pluv-empty">${emptyText}</div>`;
    }

    host.onclick = (e) => {
      const toggle = e.target.closest("[data-card-toggle]");
      const card = e.target.closest("[data-pluv-card]");
      if (!card) return;

      const id = card.getAttribute("data-id");
      if (!id) return;

      if (toggle) {
        if (e.ctrlKey || e.metaKey) {
          const ids = list.map((p) => p.id);
          const allOpen = ids.length > 0 && ids.every((pid) => state.expanded.has(pid));
          if (allOpen) {
            ids.forEach((pid) => state.expanded.delete(pid));
          } else {
            ids.forEach((pid) => state.expanded.add(pid));
          }
          renderCards();
          return;
        }

        const isOpen = card.classList.toggle("is-open");
        card.setAttribute("aria-expanded", isOpen ? "true" : "false");
        const btn = card.querySelector("[data-card-toggle]");
        if (btn) btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
        if (isOpen) state.expanded.add(id);
        else state.expanded.delete(id);
        return;
      }

      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl) {
        if (state.selected.has(id)) state.selected.delete(id);
        else state.selected.add(id);
      } else {
        if (state.selected.size === 1 && state.selected.has(id)) {
          state.selected.clear();
        } else {
          state.selected.clear();
          state.selected.add(id);
        }
      }

      renderCards();
      Plv.views?.data?.renderData?.();
      Plv.views?.map?.renderMarkers?.();
      Plv.maintenance?.renderMaintenanceCards?.();
      Plv.maintenance?.bindMaintenanceCards?.();
      Plv.views?.map?.focusOnMapIfSingle?.();
      Plv.rain?.renderRainChart?.();
    };
  }

  function clearSelection() {
    state.selected.clear();
    syncSelectionUI();
    renderCards();
    Plv.views?.data?.renderData?.();
    Plv.views?.map?.renderMarkers?.();
    Plv.rain?.renderRainChart?.();
  }

  function bindPluvFilters() {
    const filterWrap = document.querySelector(".pluv-filters");
    if (filterWrap) {
      filterWrap.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-filter]");
        if (!btn) return;
        const next = btn.getAttribute("data-filter");
        if (!next || next === state.pluvFilter) return;
        state.pluvFilter = next;
        state.expanded.clear();
        syncSelectionUI();
        renderCards();
      });
    }

    const search = $("pluvSearchInput");
    if (search) {
      search.addEventListener("input", () => {
        state.pluvSearch = search.value || "";
        renderCards();
      });
    }
  }

  cards.isAllMode = isAllMode;
  cards.selectedList = selectedList;
  cards.isRaining = isRaining;
  cards.isOffline = isOffline;
  cards.isHighlight = isHighlight;
  cards.filterLabel = filterLabel;
  cards.filteredList = filteredList;
  cards.syncSelectionUI = syncSelectionUI;
  cards.renderCards = renderCards;
  cards.bindPluvFilters = bindPluvFilters;
  cards.hydrateRainIcons = hydrateRainIcons;
  cards.rainIconSvg = rainIconSvg;
  cards.nowIconStyle = nowIconStyle;
  cards.clearSelection = clearSelection;
})();
