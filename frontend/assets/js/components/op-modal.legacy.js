/* assets/js/components/op-modal.js */
(function () {
  "use strict";

  // Tradução pontual para textos interpolados (lê a preferência de idioma).
  // Prioriza o dicionário do idioma ativo (en/es/...); se não houver entrada e
  // o idioma for inglês, usa o "en" inline; caso contrário mantém o português.
  const tOp = (pt, en) => {
    const i18n = window.IcI18n;
    if (i18n && i18n.t) {
      const hit = i18n.t(pt);
      if (hit !== pt) return hit;
    }
    return i18n && i18n.isEnglish && i18n.isEnglish() ? en : pt;
  };

  const asNum = (value, fallback = 0) => {
    const raw = typeof value === "string" ? value.replace(",", ".") : value;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const pad2 = (value) => String(value).padStart(2, "0");
  const clampPercent = (value) => Math.max(0, Math.min(100, asNum(value, 0)));

  const toDateTimeLocalValue = (value) => {
    const date = value instanceof Date ? value : new Date(value || Date.now());
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  };

  const parseDisplayDateTime = (value) => {
    const txt = String(value || "").trim();
    const match = /^(\d{2})\/(\d{2})\/(\d{2}|\d{4})\s+(\d{2}):(\d{2})$/.exec(txt);
    if (!match) return null;
    const day = asNum(match[1], NaN);
    const month = asNum(match[2], NaN);
    const yearRaw = asNum(match[3], NaN);
    const hours = asNum(match[4], NaN);
    const minutes = asNum(match[5], NaN);
    if (![day, month, yearRaw, hours, minutes].every(Number.isFinite)) return null;
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    const parsed = new Date(year, month - 1, day, hours, minutes, 0, 0);
    if (Number.isNaN(parsed.getTime())) return null;
    if (parsed.getDate() !== day || parsed.getMonth() !== month - 1 || parsed.getFullYear() !== year) return null;
    return parsed;
  };

  const toValidDate = (value, fallback = Date.now()) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return new Date(value.getTime());
    }
    const displayParsed = typeof value === "string" ? parseDisplayDateTime(value) : null;
    if (displayParsed) return displayParsed;
    const parsed = new Date(value || fallback);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    const fallbackDate = fallback instanceof Date ? fallback : new Date(fallback);
    return !Number.isNaN(fallbackDate.getTime()) ? fallbackDate : new Date();
  };

  const formatDateTime = (value) => {
    const date = value instanceof Date ? value : new Date(value || Date.now());
    if (Number.isNaN(date.getTime())) return "";
    return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  };

  // Traduz recursivamente as strings de um objeto de cópia para o idioma ativo,
  // usando o dicionário (en/es/...). Strings sem entrada permanecem em pt.
  const translateCopy = (obj) => {
    const i = window.IcI18n;
    if (!i || !i.t || !i.getLang || i.getLang() === "pt-BR") return obj;
    const walk = (v) => {
      if (typeof v === "string") return i.t(v);
      if (v && typeof v === "object") {
        const out = Array.isArray(v) ? [] : {};
        for (const k in v) out[k] = walk(v[k]);
        return out;
      }
      return v;
    };
    return walk(obj);
  };

  const getModalCopy = ({ english = false } = {}) => {
    if (english) {
      return {
        loadLastIrrigation: "Load last irrigation",
        continueLastCommand: "Continue last command",
        details: "Details",
        close: "Close",
        peakHourEnabled: "Peak hour enabled",
        currentPosition: "Current position",
        currentAngle: "Current angle",
        segment: "Segment",
        startMode: "Start mode",
        startDate: "Start date",
        direction: "Direction",
        irrigationMode: "Irrigation mode",
        fertigation: "Fertigation",
        speed: "Percentimeter",
        lamina: "Irrigation Rate",
        stopMode: "Stop mode",
        stopPosition: "Stop position",
        stopAngle: "Stop angle",
        segments: "Segments",
        turns: "Turns",
        estimateDuration: "Estimated operation duration",
        estimateEnd: "Estimated end time",
        clear: "Clear",
        cancel: "Cancel",
        startModes: {
          agora: "Now",
          agendado: "Scheduled",
          pos_pico: "After peak hour",
        },
        stopModes: {
          sem_parar: "No stop",
          por_posicao: "By position",
          por_passagens: "By segments",
          por_angulo: "By angle",
          por_voltas: "By turns",
        },
        irrigationModes: {
          molhado: "Wet",
          seco: "Dry",
        },
        directions: {
          avanco: "Forward",
          reverso: "Reverse",
        },
      };
    }

    return translateCopy({
      loadLastIrrigation: "Carregar última irrigação",
      continueLastCommand: "Continuar o último comando",
      details: "Detalhes",
      close: "Fechar",
      peakHourEnabled: "Horário de pico habilitado",
      currentPosition: "Posição atual",
      currentAngle: "Ângulo atual",
      segment: "Segmento",
      startMode: "Modo de início",
      startDate: "Data de início",
      direction: "Direção",
      irrigationMode: "Modo de irrigação",
      fertigation: "Fertirrigação",
      speed: "Percentímetro",
      lamina: "Lâmina",
      stopMode: "Modo de parada",
      stopPosition: "Posição de parada",
      stopAngle: "Ângulo de parada",
      segments: "Segmentos",
      turns: "Voltas",
      estimateDuration: "Duração estimada da operação",
      estimateEnd: "Horário estimado para término",
      clear: "Limpar",
      cancel: "Cancelar",
      startModes: {
        agora: "Agora",
        agendado: "Agendado",
        pos_pico: "Após horário de pico",
      },
      stopModes: {
        sem_parar: "Sem parar",
        por_posicao: "Por posição",
        por_passagens: "Por segmentos",
        por_angulo: "Por ângulo",
        por_voltas: "Por voltas",
      },
      irrigationModes: {
        molhado: "Molhado",
        seco: "Seco",
      },
      directions: {
        avanco: "Avanço",
        reverso: "Reverso",
      },
    });
  };

  const resolveStartModeLabel = (mode, copy) => {
    if (mode === "agendado") return copy.startModes.agendado;
    if (mode === "pos_pico") return copy.startModes.pos_pico;
    return copy.startModes.agora;
  };

  const normalizeLinearStopMode = (mode) => {
    const raw = String(mode || "").trim().toLowerCase();
    if (raw === "por_posicao") return "por_posicao";
    if (raw === "por_passagens") return "por_passagens";
    return "sem_parar";
  };

  const normalizePivotStopMode = (mode) => {
    const raw = String(mode || "").trim().toLowerCase();
    if (raw === "por_angulo" || raw === "por_angulos") return "por_angulo";
    if (raw === "por_voltas" || raw === "volta_completa") return "por_voltas";
    return "sem_parar";
  };

  const resolveStopModeLabel = (isLinear, mode, copy) => {
    if (isLinear) {
      if (mode === "por_posicao") return copy.stopModes.por_posicao;
      if (mode === "por_passagens") return copy.stopModes.por_passagens;
      return copy.stopModes.sem_parar;
    }
    if (mode === "por_angulo") return copy.stopModes.por_angulo;
    if (mode === "por_voltas") return copy.stopModes.por_voltas;
    return copy.stopModes.sem_parar;
  };

  const resolveStopDynamicLabel = (isLinear, mode, copy) => {
    if (isLinear) return mode === "por_passagens" ? copy.segments : copy.stopPosition;
    return mode === "por_voltas" ? copy.turns : copy.stopAngle;
  };

  const formatEstimateDurationLabel = (copy, value = "--") => `${copy.estimateDuration}: ${value}`;
  const formatEstimateEndLabel = (copy, value = "--") => `${copy.estimateEnd}: ${value}`;
  const formatDurationValue = (durationMs) => {
    const totalMinutes = Math.max(0, Math.round(asNum(durationMs, 0) / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours} h ${minutes} min`;
  };

  const getModalHost = () => document.fullscreenElement || document.body || document.body;

  const normalizePivotFamilyName = (value) => String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");

  const isCenterstarFamilyName = (value) => {
    const normalized = normalizePivotFamilyName(value);
    return normalized.startsWith("centerstar") || normalized.startsWith("centerstart");
  };

  const isSmartTouchFamilyName = (value) => {
    const normalized = normalizePivotFamilyName(value);
    return normalized === "smarttouch"
      || isCenterstarFamilyName(normalized);
  };

  const getPivotSnapshot = (pivotId) => {
    if (!pivotId) return null;

    const fromPivosData = window.Pivos?.data?.getPivotData?.(pivotId);
    if (fromPivosData) return fromPivosData;

    const activeFarm = window.IcFarmGetActive?.() || window.icFarmData || window.IcFarmActive || null;
    const equipments = Array.isArray(activeFarm?.equipments) ? activeFarm.equipments : [];
    const match = equipments.find((item) => String(item?.id || "") === String(pivotId || ""));
    if (!match) return null;

    return {
      ...match?.data,
      id: match.id,
      name: match.name || match?.data?.name || "Pivo",
      type: match.type || match?.data?.type || "",
      controllerType: match.controllerType || match?.data?.controllerType || match?.data?.panelType || "",
    };
  };

  const resolveActionVariant = ({ pivotId = null, title = "", isLinear = false } = {}) => {
    if (isLinear) return { key: "default", pivot: null };

    const pivot = getPivotSnapshot(pivotId);
    const controllerToken = normalizePivotFamilyName(
      pivot?.controllerType || pivot?.type || pivot?.panelType || pivot?.data?.panelType
    );
    const matchesName = [
      title,
      pivot?.name,
      pivot?.nome,
      pivot?.data?.name,
      pivot?.data?.nome,
    ].some(isSmartTouchFamilyName);

    if (controllerToken === "smarttouch" || matchesName) {
      return { key: "smarttouch", pivot };
    }

    return { key: "default", pivot };
  };

  // Atalho oculto (Ctrl+D): revela elementos de teste do modal de operação
  // (resumo de operações e botões de adicionar/remover operação).
  document.addEventListener("keydown", (e) => {
    if (!e.ctrlKey || e.key.toLowerCase() !== "d") return;
    if (window.IcOpRouter && window.IcOpRouter.active !== "legacy") return;
    const modal = document.getElementById("opModalIrrigation");
    if (!modal) return;
    const hiddenEls = modal.querySelectorAll(".js-hidden-shortcut");
    if (!hiddenEls.length) return;
    e.preventDefault();
    hiddenEls.forEach((el) => {
      el.style.display = "";
    });
  });

  let _opModalPivotMap = null;
  const OpModal = {
    open(data = {}) {
      const modalId = "opModalIrrigation";
      document.getElementById(modalId)?.remove();

      // Auto-detect sector from pivot data before destructuring
      const _snap = getPivotSnapshot(data?.pivotId ?? null);
      if (_snap) {
        const _end = Number(_snap.endAngle ?? 360);
        const _start = Number(_snap.startAngle ?? 0);
        const _isSector = !!_snap.isSector || (_end > 0 && _end < 360);
        data = { ...data, isSector: _isSector, sectorStart: _start, sectorEnd: _end };
      }

      const {
        title = "Irrigacao simples",
        angle = 304.6,
        isPeakHour = true,
        isLinear = false,
        position = 0,
        pivotId = null,
        startMode = "agora",
        startAt = null,
        stopMode = null,
        stopValue = null,
        direction = "avanco",
        irrigationMode = "molhado",
        speedPct = 100,
        laminaMm = 5.75,
        ferti = false,
        fertiObs = "",
        showClear = false,
        onSave = null,
        onClear = null,
        resolveStartAt = null,
        resolveEstimate = null,
        isSector = false,
        sectorStart = 0,
        sectorEnd = 360,
      } = data;

      const actionVariant = resolveActionVariant({ pivotId, title, isLinear });
      const isSmartTouchVariant = actionVariant.key === "smarttouch";
      const resolvedTitle = actionVariant.pivot?.name || title;
      const isCenterstarVariant = [
        resolvedTitle,
        title,
        actionVariant.pivot?.name,
        actionVariant.pivot?.data?.name,
      ].some(isCenterstarFamilyName);
      const copy = getModalCopy({ english: !!window.IcI18n?.isEnglish?.() });

      const SEGMENT_PALETTE = [
        "rgb(0, 31, 153)", "rgb(160, 0, 229)", "rgb(0, 196, 179)", "rgb(82, 183, 0)",
        "rgb(255, 213, 0)", "rgb(255, 115, 0)", "rgb(142, 68, 173)", "rgb(22, 160, 133)", "rgb(233, 30, 99)",
      ];
      const _pivotSnap = getPivotSnapshot(pivotId);
      const _pivotSegments = Array.isArray(_pivotSnap?.segments) && _pivotSnap.segments.length > 1
        ? _pivotSnap.segments : null;
      const legendHtml = _pivotSegments
        ? _pivotSegments.map((seg, i) => {
            const color = SEGMENT_PALETTE[i % SEGMENT_PALETTE.length];
            const name = seg.name || `${copy.segment} ${i + 1}`;
            return `<div class="op-modal__legend-item" data-seg-index="${i}" style="--seg-color:${color}"><span class="op-modal__legend-color" style="background:${color}"></span><span>${name}</span></div>`;
          }).join("")
        : `<div class="op-modal__legend-item" style="--seg-color:#1e40af"><span class="op-modal__legend-color" style="background:#1e40af"></span><span>${copy.segment} 1</span></div>`;

      const initialStartMode = ["agora", "agendado", "pos_pico"].includes(String(startMode || ""))
        ? String(startMode || "")
        : "agora";
      const initialStopMode = isLinear
        ? normalizeLinearStopMode(stopMode)
        : normalizePivotStopMode(stopMode);
      const initialDirection = String(direction || "") === "reverso" ? "reverso" : "avanco";
      const initialIrrigationMode = String(irrigationMode || "") === "seco" ? "seco" : "molhado";
      const currentLinearPosition = clampPercent(position);

      const resolveDateForMode = (mode) => {
        if (typeof resolveStartAt === "function") {
          const resolved = resolveStartAt(mode);
          const parsed = toValidDate(resolved, Date.now());
          if (!Number.isNaN(parsed.getTime())) return parsed;
        }
        if (startAt) {
          const seeded = toValidDate(startAt, Date.now());
          if (!Number.isNaN(seeded.getTime())) return seeded;
        }
        return new Date();
      };

      const initialStartDate = resolveDateForMode(initialStartMode);
      let scheduledStartDate = toValidDate(
        initialStartMode === "agendado" ? initialStartDate : resolveDateForMode("agendado"),
        initialStartDate
      );
      const defaultDynamicValue = (() => {
        if (initialStopMode === "por_posicao") return clampPercent(stopValue).toFixed(1);
        if (initialStopMode === "por_passagens") return String(Math.max(0.1, asNum(stopValue, 1)));
        if (initialStopMode === "por_angulo") {
          const fallback = isSector ? sectorEnd : angle;
          const val = Math.min(asNum(stopValue, fallback), isSector ? sectorEnd : Infinity);
          return String(val.toFixed(1));
        }
        if (initialStopMode === "por_voltas") return String(Math.max(0.1, asNum(stopValue, 1)));
        return isLinear ? "100" : (isSector ? String(sectorEnd) : "305");
      })();

      const positionLabel = isLinear
        ? `${copy.currentPosition}: ${currentLinearPosition.toFixed(1)}%`
        : `${copy.currentAngle}: ${asNum(angle, 0).toFixed(1)}°`;

      const directionButtons = isLinear ? `
        <button type="button" class="op-form__seg-btn ${initialDirection === "avanco" ? "is-active" : ""}" data-value="avanco" aria-label="A para B" title="A para B">
          ${copy.directions.avanco} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
        </button>
        <button type="button" class="op-form__seg-btn ${initialDirection === "reverso" ? "is-active" : ""}" data-value="reverso" aria-label="B para A" title="B para A">
          <i class="fa-solid fa-arrow-left" aria-hidden="true"></i> ${copy.directions.reverso}
        </button>
      ` : `
        <button type="button" class="op-form__seg-btn ${initialDirection === "avanco" ? "is-active" : ""}" data-value="avanco">
          ${copy.directions.avanco} <i class="fa-solid fa-arrow-rotate-right"></i>
        </button>
        <button type="button" class="op-form__seg-btn ${initialDirection === "reverso" ? "is-active" : ""}" data-value="reverso">
          ${copy.directions.reverso} <i class="fa-solid fa-arrow-rotate-left"></i>
        </button>
      `;

      const stopModeOptions = isLinear ? `
        <div class="op-form__dropdown-item ${initialStopMode === "sem_parar" ? "is-active" : ""}" data-value="sem_parar">${copy.stopModes.sem_parar}</div>
        <div class="op-form__dropdown-item ${initialStopMode === "por_posicao" ? "is-active" : ""}" data-value="por_posicao">${copy.stopModes.por_posicao}</div>
        <div class="op-form__dropdown-item ${initialStopMode === "por_passagens" ? "is-active" : ""}" data-value="por_passagens">${copy.stopModes.por_passagens}</div>
      ` : isSector ? `
        <div class="op-form__dropdown-item ${initialStopMode === "sem_parar" ? "is-active" : ""}" data-value="sem_parar">${copy.stopModes.sem_parar}</div>
        <div class="op-form__dropdown-item ${initialStopMode === "por_angulo" ? "is-active" : ""}" data-value="por_angulo">${copy.stopModes.por_angulo}</div>
      ` : `
        <div class="op-form__dropdown-item ${initialStopMode === "sem_parar" ? "is-active" : ""}" data-value="sem_parar">${copy.stopModes.sem_parar}</div>
        <div class="op-form__dropdown-item ${initialStopMode === "por_voltas" ? "is-active" : ""}" data-value="por_voltas">${copy.stopModes.por_voltas}</div>
        <div class="op-form__dropdown-item ${initialStopMode === "por_angulo" ? "is-active" : ""}" data-value="por_angulo">${copy.stopModes.por_angulo}</div>
      `;

      const stopDynamicLabel = resolveStopDynamicLabel(isLinear, initialStopMode, copy);
      const stopDynamicSuffixText = isLinear
        ? (initialStopMode === "por_passagens" ? "" : "%")
        : (initialStopMode === "por_voltas" ? "" : "°");

      const visualizer = isLinear ? `
        <div class="op-modal__visualizer op-modal__visualizer--linear">
          <div class="op-modal__linear-track-container" id="opModalLinearTrack"></div>
          <div class="op-modal__legend">${legendHtml}</div>
        </div>
      ` : `
        <div class="op-modal__visualizer">
          <div class="op-modal__dial-container" id="opModalDial"></div>
          <div class="op-modal__legend">${legendHtml}</div>
        </div>
      `;

      const alertsHtml = `<span class="op-modal__pos-badge"><i class="fa-solid fa-circle-info"></i> ${positionLabel}</span>`;

      const formHtml = `
        <div class="op-form__summary-bar js-hidden-shortcut" style="display:none">
          <div class="op-form__summary-pills js-summary-pills">
            <div class="op-form__summary-item is-active">
              <span class="op-form__summary-title">${tOp("Operação", "Operation")} 1</span>
              <div class="op-form__summary-pill js-op-summary-pill">–</div>
            </div>
          </div>
        </div>
        <div class="op-form__grid">
          <div class="op-form__group">
            <div class="op-form__label">${copy.startMode}</div>
            <div class="op-form__custom-select">
              <div class="op-form__select js-start-mode-trigger js-op-dropdown-trigger" ${(isLinear || isCenterstarVariant) ? 'style="pointer-events: none; opacity: 0.6; cursor: default;"' : ""}>
                <span class="selected-text">${resolveStartModeLabel(initialStartMode, copy)}</span>
              </div>
              <div class="op-form__dropdown-panel">
                <div class="op-form__dropdown-item ${initialStartMode === "agora" ? "is-active" : ""}" data-value="agora">${copy.startModes.agora}</div>
                <div class="op-form__dropdown-item ${initialStartMode === "agendado" ? "is-active" : ""}" data-value="agendado">${copy.startModes.agendado}</div>
                <div class="op-form__dropdown-item ${initialStartMode === "pos_pico" ? "is-active" : ""}" data-value="pos_pico">${copy.startModes.pos_pico}</div>
              </div>
            </div>
          </div>
          <div class="op-form__group">
            <label class="op-form__label" for="opStartAtDisplay">${copy.startDate}</label>
            <div class="op-form__input--with-suffix js-op-start-at-trigger" style="background: #f8fafc;">
              <input type="text" id="opStartAtDisplay" class="js-op-start-at" value="${formatDateTime(initialStartDate)}" readonly aria-readonly="true" style="background: transparent;">
              <div class="op-form__input-suffix"><i class="fa-regular fa-calendar"></i></div>
            </div>
            <input type="datetime-local" id="opStartAtNative" class="js-op-start-at-native" value="${toDateTimeLocalValue(scheduledStartDate)}" tabindex="-1" aria-hidden="true" style="position: fixed; left: -9999px; top: -9999px; opacity: 0; pointer-events: none; width: 1px; height: 1px;">
          </div>

          <div class="op-form__group">
            <div class="op-form__label">${copy.direction}</div>
            <div class="op-form__segmented js-direction-group">
              ${directionButtons}
            </div>
          </div>
          <div class="op-form__group">
            <div class="op-form__label">${copy.irrigationMode}</div>
            <div class="op-form__segmented js-irrigation-group">
              <button type="button" class="op-form__seg-btn ${initialIrrigationMode === "molhado" ? "is-active" : ""}" data-value="molhado">
                ${copy.irrigationModes.molhado} <i class="fa-solid fa-droplet"></i>
              </button>
              <button type="button" class="op-form__seg-btn ${initialIrrigationMode === "seco" ? "is-active" : ""}" data-value="seco">
                ${copy.irrigationModes.seco} <i class="fa-solid fa-droplet-slash"></i>
              </button>
            </div>
          </div>

          ${isSmartTouchVariant ? "" : `
          <div class="op-form__group" style="grid-column: span 2;">
            <div class="op-form__checkbox-label">
              <span>${copy.fertigation}</span>
              <label class="op-form__switch">
                <input type="checkbox" id="opSimpleFerti" ${ferti ? "checked" : ""}>
                <span class="op-form__switch-slider"></span>
              </label>
            </div>
          </div>
          <div class="op-form__group" id="opFertiObsGroup" style="grid-column: span 2; display: ${ferti ? "block" : "none"};">
            <label class="op-form__label">Observação</label>
            <textarea id="opFertiObs" class="op-form__textarea" rows="3" placeholder="Por favor insira">${fertiObs || ""}</textarea>
          </div>
          `}

          <div class="op-form__group">
            <label class="op-form__label" for="opSimpleSpeedPct">${copy.speed}</label>
            <div class="op-form__input--with-suffix">
              <input type="number" id="opSimpleSpeedPct" value="${Math.max(1, asNum(speedPct, 100)).toFixed(2)}" min="1" max="100" step="0.1">
              <div class="op-form__input-suffix">%</div>
            </div>
          </div>
          ${(isSmartTouchVariant || isCenterstarVariant) ? `
          <div class="op-form__group">
            <label class="op-form__label" for="opIrrigationRate">${copy.lamina}</label>
            <div class="op-form__input--with-suffix">
              <input type="text" inputmode="decimal" id="opIrrigationRate" placeholder="—">
              <div class="op-form__input-suffix">mm</div>
            </div>
          </div>
          ` : ""}
          ${isSmartTouchVariant ? "" : `
          <div class="op-form__group">
            <label class="op-form__label" for="opSimpleLaminaMm">${copy.lamina}</label>
            <div class="op-form__input--with-suffix">
              <input type="number" id="opSimpleLaminaMm" value="${Math.max(0, asNum(laminaMm, 0)).toFixed(2)}" step="0.01">
              <div class="op-form__input-suffix">mm</div>
            </div>
          </div>
          `}

          <div class="op-form__group" style="grid-column: span 2;">
            <div class="op-form__stop-row">
              <div class="op-form__group">
                <label class="op-form__label">${copy.stopMode}</label>
                <div class="op-form__custom-select">
                  <div class="op-form__select js-op-dropdown-trigger js-stop-mode-trigger">
                    <span class="selected-text">${resolveStopModeLabel(isLinear, initialStopMode, copy)}</span>
                  </div>
                  <div class="op-form__dropdown-panel">
                    ${stopModeOptions}
                  </div>
                </div>
              </div>

              <div class="op-form__group ${initialStopMode === "sem_parar" ? "is-hidden" : ""} js-stop-dynamic-field">
                <label class="op-form__label js-stop-dynamic-label">${stopDynamicLabel}</label>
                <div class="op-form__input--with-suffix js-stop-dynamic-input-container">
                  <input type="number" value="${defaultDynamicValue}" class="js-stop-dynamic-input" min="0" max="${sectorEnd}">
                  <div class="op-form__input-suffix js-stop-dynamic-suffix" style="${stopDynamicSuffixText ? "" : "display:none;"}">${stopDynamicSuffixText}</div>
                </div>
              </div>
            </div>

            <div class="op-form__estimate ${initialStopMode === "sem_parar" ? "is-hidden" : ""} js-stop-estimate">
              <div class="op-form__estimate-line js-estimate-duration">${formatEstimateDurationLabel(copy)}</div>
              <div class="op-form__estimate-line js-estimate-end">${formatEstimateEndLabel(copy)}</div>
            </div>
          </div>
        </div>
      `;

      const defaultContent = `
        ${alertsHtml}
        ${visualizer}
        ${formHtml}
      `;

      const html = `
        <div class="op-modal" id="${modalId}">
          <div class="op-modal__backdrop"></div>
          <div class="op-modal__dialog">
            <header class="op-modal__header">
              <div class="op-modal__title-row">
                <h3 class="op-modal__title">${resolvedTitle}</h3>
                ${isPeakHour && !isCenterstarVariant && !isLinear ? `
                  <span class="op-modal__peak-icon" data-tooltip="${copy.peakHourEnabled}">
                    <i class="fa-solid fa-circle-exclamation"></i>
                  </span>
                ` : ""}
              </div>
              <div class="op-modal__header-center">
                <button type="button" class="op-modal__load-btn">${copy.loadLastIrrigation}</button>
              </div>
              <div class="op-modal__header-actions">
                ${pivotId ? `<button type="button" class="op-modal__details-btn js-op-go-details">${copy.details}</button>` : ""}
                <button type="button" class="op-modal__close" aria-label="${copy.close}">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              </div>
            </header>

            <div class="op-modal__content">
              <div class="js-config-page">
                ${defaultContent}
              </div>
              <div class="js-review-page is-hidden">
                <div class="op-review">
                  <div class="op-review__list js-review-list"></div>
                </div>
              </div>
            </div>

            <footer class="op-modal__footer">
              <div class="js-footer-config">
                <div class="op-schedule__footer-row ${(isSmartTouchVariant || isCenterstarVariant) ? "" : "js-hidden-shortcut"}" style="display:none">
                  <button type="button" class="btn btn--schedule-remove js-schedule-remove" disabled><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg> Remover Operação</button>
                  <button type="button" class="btn btn--schedule-add js-schedule-add"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg> Adicionar Operação</button>
                </div>
                <div class="op-modal__footer-confirm">
                  <button type="button" class="btn btn--stop js-op-stop"><i class="fa-regular fa-square"></i> Parar Pivô</button>
                  ${showClear ? `<button type="button" class="btn btn--cancel js-op-clear">${copy.clear}</button>` : ""}
                  <button type="button" class="btn btn--cancel js-op-cancel">${copy.cancel}</button>
                  <button type="button" class="btn btn--ok js-op-confirm">OK</button>
                </div>
              </div>
              <div class="js-footer-review is-hidden">
                <div class="op-modal__footer-confirm">
                  <button type="button" class="btn btn--cancel js-review-back">Anterior</button>
                  <button type="button" class="btn btn--ok js-review-send">Enviar</button>
                </div>
              </div>
            </footer>
          </div>
        </div>
      `;

      getModalHost().insertAdjacentHTML("beforeend", html);
      const modal = document.getElementById(modalId);
      if (!modal) return;

      const closePanels = () => {
        modal.querySelectorAll(".op-form__dropdown-panel").forEach((panel) => panel.classList.remove("is-active"));
        modal.querySelectorAll(".js-op-dropdown-trigger").forEach((trigger) => trigger.classList.remove("is-active"));
        modal.querySelectorAll(".op-form__custom-select").forEach((dropdown) => dropdown.classList.remove("is-active"));
      };

      let outsideClickHandler = null;
      const closeModal = () => {
        if (outsideClickHandler) {
          document.removeEventListener("click", outsideClickHandler);
          outsideClickHandler = null;
        }
        document.querySelector(".js-summary-dropdown")?.remove();
        modal.remove();
      };

      const getDropdownValue = (triggerCls, fallback) =>
        modal.querySelector(`.${triggerCls} + .op-form__dropdown-panel .op-form__dropdown-item.is-active`)?.dataset?.value || fallback;
      const getSegmentValue = (groupCls, fallback) =>
        modal.querySelector(`.${groupCls} .op-form__seg-btn.is-active`)?.dataset?.value || fallback;

      const stopDynamicField = modal.querySelector(".js-stop-dynamic-field");
      const stopDynamicLabelEl = modal.querySelector(".js-stop-dynamic-label");
      const stopDynamicInput = modal.querySelector(".js-stop-dynamic-input");
      const stopDynamicSuffix = modal.querySelector(".js-stop-dynamic-suffix");
      const stopEstimateEl = modal.querySelector(".js-stop-estimate");
      const startAtTrigger = modal.querySelector(".js-op-start-at-trigger");
      const startAtInput = modal.querySelector(".js-op-start-at");
      const startAtNativeInput = modal.querySelector(".js-op-start-at-native");
      const speedInput = modal.querySelector("#opSimpleSpeedPct");
      const laminaInput = modal.querySelector("#opSimpleLaminaMm");
      const irrigationRateEl = modal.querySelector("#opIrrigationRate");
      const estimateDurationEl = modal.querySelector(".js-estimate-duration");
      const estimateEndEl = modal.querySelector(".js-estimate-end");

      const baseIrrigationRate = (asNum(laminaMm, 0) * Math.max(1, asNum(speedPct, 100)) / 100)
        || asNum(getPivotSnapshot(pivotId)?.irrigationRate, 0);

      const refreshIrrigationRate = () => {
        if (!irrigationRateEl) return;
        if (document.activeElement === irrigationRateEl) return;
        if (!baseIrrigationRate) { irrigationRateEl.value = ""; return; }
        const pct = Math.max(1, asNum(speedInput?.value, 100));
        const rate = baseIrrigationRate / (pct / 100);
        irrigationRateEl.value = rate.toFixed(2);
      };

      const laminaDecimals = 2;
      const refreshLamina = () => {
        if (!laminaInput) return;
        if (document.activeElement === laminaInput) return;
        if (!baseIrrigationRate) return;
        const pct = Math.max(1, asNum(speedInput?.value, 100));
        laminaInput.value = (baseIrrigationRate / (pct / 100)).toFixed(laminaDecimals);
      };

      const resolveSelectedStartDate = (mode) => {
        if (mode === "agendado") {
          const nativeValue = startAtNativeInput?.value ? new Date(startAtNativeInput.value) : null;
          if (nativeValue instanceof Date && !Number.isNaN(nativeValue.getTime())) {
            scheduledStartDate = nativeValue;
            return new Date(nativeValue.getTime());
          }
          return toValidDate(scheduledStartDate, resolveDateForMode(mode));
        }
        return resolveDateForMode(mode);
      };

      const syncStartDateUI = (mode) => {
        const isScheduled = mode === "agendado";
        const selectedDate = resolveSelectedStartDate(mode);
        if (isScheduled) {
          scheduledStartDate = toValidDate(selectedDate, scheduledStartDate);
        }
        if (startAtInput) {
          startAtInput.disabled = !isScheduled;
          startAtInput.readOnly = true;
          startAtInput.setAttribute("aria-readonly", "true");
          startAtInput.value = formatDateTime(selectedDate);
        }
        if (startAtNativeInput) {
          startAtNativeInput.min = toDateTimeLocalValue(new Date());
          startAtNativeInput.value = toDateTimeLocalValue(isScheduled ? scheduledStartDate : selectedDate);
        }
        if (startAtTrigger) {
          startAtTrigger.style.background = isScheduled ? "#ffffff" : "#f8fafc";
          startAtTrigger.style.cursor = isScheduled ? "pointer" : "not-allowed";
        }
      };

      const openStartDatePicker = () => {
        const startModeValue = getDropdownValue("js-start-mode-trigger", initialStartMode);
        if (startModeValue !== "agendado" || !startAtNativeInput) return;
        scheduledStartDate = toValidDate(resolveSelectedStartDate(startModeValue), scheduledStartDate);
        startAtNativeInput.min = toDateTimeLocalValue(new Date());
        startAtNativeInput.value = toDateTimeLocalValue(scheduledStartDate);
        if (typeof startAtNativeInput.showPicker === "function") {
          startAtNativeInput.showPicker();
          return;
        }
        startAtNativeInput.focus();
        startAtNativeInput.click();
      };

      const syncStopModeUI = () => {
        const mode = getDropdownValue("js-stop-mode-trigger", initialStopMode);
        if (!isLinear) {
          const tilePanes = modal.querySelectorAll("#opModalDial .leaflet-tile-pane");
          tilePanes.forEach(el => { el.style.display = mode === "por_angulo" ? "" : "none"; });
          const pivotShape = modal.querySelector("#opModalDial .leaflet-overlay-pane path[fill='#1e40af']");
          if (pivotShape) pivotShape.setAttribute("fill-opacity", mode === "por_angulo" ? "0" : "0.9");
          modal.querySelectorAll("#opModalDial .leaflet-overlay-pane path:not([fill='#1e40af']):not([fill='#ffffff']):not([fill='none'])").forEach(el => {
            el.style.display = mode === "por_angulo" ? "none" : "";
          });
        }
        if (mode === "sem_parar") {
          stopDynamicField?.classList.add("is-hidden");
          stopEstimateEl?.classList.add("is-hidden");
          _opModalPivotMap?.updateAngleOverlay?.(0, false);
          return;
        }
        stopDynamicField?.classList.remove("is-hidden");
        stopEstimateEl?.classList.remove("is-hidden");
        if (mode === "por_angulo" || mode === "por_posicao") {
          if (stopDynamicLabelEl) stopDynamicLabelEl.textContent = isLinear ? copy.stopPosition : copy.stopAngle;
          if (stopDynamicSuffix) {
            stopDynamicSuffix.textContent = isLinear ? "%" : "°";
            stopDynamicSuffix.style.display = "flex";
          }
          if (stopDynamicInput && !String(stopDynamicInput.value || "").trim() && document.activeElement !== stopDynamicInput) {
            stopDynamicInput.value = isLinear ? "100" : (isSector ? String(sectorEnd) : "305");
          }
          if (stopDynamicInput) {
            stopDynamicInput.min = "0";
            stopDynamicInput.max = String(sectorEnd);
          }
        } else {
          if (stopDynamicLabelEl) stopDynamicLabelEl.textContent = isLinear ? copy.segments : copy.turns;
          if (stopDynamicSuffix) {
            stopDynamicSuffix.textContent = "";
            stopDynamicSuffix.style.display = "none";
          }
          if (stopDynamicInput && !String(stopDynamicInput.value || "").trim() && document.activeElement !== stopDynamicInput) {
            stopDynamicInput.value = "1";
          }
        }
        if (!isLinear && _opModalPivotMap?.updateAngleOverlay) {
          const visible = mode === "por_angulo";
          const dir = getSegmentValue("js-direction-group", initialDirection);
          const irrMode = getSegmentValue("js-irrigation-group", initialIrrigationMode);
          _opModalPivotMap.updateAngleOverlay(asNum(stopDynamicInput?.value, 0), visible, dir, irrMode, _opFromAngle);
        }
      };

      const buildPayload = () => {
        const payloadStartMode = getDropdownValue("js-start-mode-trigger", initialStartMode);
        const payloadStartDate = resolveSelectedStartDate(payloadStartMode);
        return {
          pivotId,
          isLinear,
          actionVariant: actionVariant.key,
          angle: asNum(angle, 0),
          position: currentLinearPosition,
          startMode: payloadStartMode,
          stopMode: getDropdownValue("js-stop-mode-trigger", initialStopMode),
          stopValue: asNum(stopDynamicInput?.value, 0),
          direction: getSegmentValue("js-direction-group", initialDirection),
          irrigationMode: getSegmentValue("js-irrigation-group", initialIrrigationMode),
          speedPct: Math.max(1, asNum(speedInput?.value, 100)),
          laminaMm: Math.max(0, asNum(laminaInput?.value, laminaMm)),
          ferti: modal.querySelector("#opSimpleFerti") ? !!modal.querySelector("#opSimpleFerti")?.checked : !!ferti,
          fertiObs: modal.querySelector("#opFertiObs")?.value || "",
          startAtDate: payloadStartDate,
          startAt: formatDateTime(payloadStartDate),
        };
      };

      let scheduleOps = [];
      let scheduleCurrentIndex = -1;
      let _reviewMaps = [];
      let _opFromAngle = null;

      const dirLabel = (v) => v === "R" ? "Recuo" : "Avanço";
      const irrLabel = (v) => v === "dry" ? "Seco" : "Úmido";

      const buildOpSummary = () => {
        const dir = getSegmentValue("js-direction-group", initialDirection);
        const irrMode = getSegmentValue("js-irrigation-group", initialIrrigationMode);
        const speed = speedInput?.value ? `${parseFloat(speedInput.value).toFixed(0)}%` : "–";
        const lamina = laminaInput?.value ? `${parseFloat(laminaInput.value).toFixed(2)} mm` : "–";
        const date = startAtInput?.value || "–";
        return `${dirLabel(dir)} • ${irrLabel(irrMode)} • ${speed} • ${lamina} • ${date}`;
      };

      const PILLS_VISIBLE = 2;

      const renderSummaryPills = () => {
        const container = modal.querySelector(".js-summary-pills");
        if (!container) return;

        if (scheduleOps.length === 0) {
          container.innerHTML = `
            <div class="op-form__summary-item is-active">
              <span class="op-form__summary-title">${tOp("Operação", "Operation")} 1</span>
              <div class="op-form__summary-pill js-op-summary-pill">–</div>
            </div>
          `;
          return;
        }

        const hasOverflow = scheduleOps.length >= 3;

        container.innerHTML = scheduleOps.map((op, i) => {
          const isActive = i === scheduleCurrentIndex;
          return `
            <div class="op-form__summary-item${isActive ? " is-active" : ""}" data-op-idx="${i}">
              <span class="op-form__summary-title">${tOp("Operação", "Operation")} ${i + 1}</span>
              <div class="op-form__summary-pill${isActive ? " js-op-summary-pill" : ""}">${op.pillHtml || "–"}</div>
            </div>
          `;
        }).join("");

        const bar = container.parentElement;
        bar.querySelector(".op-summary__overflow-wrap")?.remove();
        if (hasOverflow) {
          const wrap = document.createElement("div");
          wrap.className = "op-summary__overflow-wrap";
          wrap.innerHTML = `<button type="button" class="op-summary__overflow-btn js-summary-overflow-btn" title="Ver todas">···</button>`;
          bar.appendChild(wrap);
        }

        let existingDropdown = modal.querySelector(".js-summary-dropdown");
        if (existingDropdown) existingDropdown.remove();

        if (hasOverflow) {
          const dropdown = document.createElement("div");
          dropdown.className = "op-summary__dropdown js-summary-dropdown";
          dropdown.innerHTML = scheduleOps.map((op, i) => `
            <div class="op-summary__dropdown-item${i === scheduleCurrentIndex ? " is-active" : ""}" data-op-idx="${i}">
              <span class="op-summary__dropdown-title">${tOp("Operação", "Operation")} ${i + 1}</span>
              <div class="op-summary__dropdown-pill">${op.pillHtml || "–"}</div>
            </div>
          `).join("");
          document.body.appendChild(dropdown);

          const overflowBtn = modal.querySelector(".js-summary-overflow-btn");
          let hideTimer = null;

          const showDropdown = () => {
            clearTimeout(hideTimer);
            const rect = overflowBtn.getBoundingClientRect();
            dropdown.style.top = `${rect.bottom + 6}px`;
            dropdown.style.left = `${rect.left}px`;
            dropdown.classList.add("is-open");
          };

          const scheduleHide = () => {
            hideTimer = setTimeout(() => dropdown.classList.remove("is-open"), 120);
          };

          overflowBtn?.addEventListener("mouseenter", showDropdown);
          overflowBtn?.addEventListener("mouseleave", scheduleHide);
          dropdown.addEventListener("mouseenter", () => clearTimeout(hideTimer));
          dropdown.addEventListener("mouseleave", scheduleHide);

          dropdown.querySelectorAll(".op-summary__dropdown-item").forEach((el) => {
            el.addEventListener("click", () => {
              commitCurrentOp();
              scheduleCurrentIndex = parseInt(el.dataset.opIdx, 10);
              loadOpIntoForm(scheduleOps[scheduleCurrentIndex]);
              dropdown.classList.remove("is-open");
              renderSummaryPills();
            });
          });
        }

        container.querySelectorAll(".op-form__summary-item").forEach((el) => {
          el.addEventListener("click", () => {
            commitCurrentOp();
            scheduleCurrentIndex = parseInt(el.dataset.opIdx, 10);
            loadOpIntoForm(scheduleOps[scheduleCurrentIndex]);
            renderSummaryPills();
          });
        });

        const removeBtn = modal.querySelector(".js-schedule-remove");
        if (removeBtn) removeBtn.disabled = scheduleOps.length < 2;

        if (!container._wheelBound) {
          container._wheelBound = true;
          container.addEventListener("wheel", (e) => {
            if (e.deltaY === 0) return;
            e.preventDefault();
            container.scrollLeft += e.deltaY;
          }, { passive: false });
        }
      };

      const renderScheduleList = () => {
        const listEl = modal.querySelector(".js-schedule-list");
        const countEl = modal.querySelector(".js-schedule-count");
        if (!listEl) return;
        const n = scheduleOps.length;
        if (countEl) countEl.textContent = `${n} operação(ões)`;
        if (n === 0) {
          listEl.innerHTML = '<div class="op-schedule__empty">Nenhuma operação agendada.</div>';
          return;
        }
        listEl.innerHTML = scheduleOps.map((op, i) => `
          <div class="op-schedule__item${i === scheduleCurrentIndex ? " is-active" : ""}" data-schedule-idx="${i}">
            <span class="op-schedule__item-index">#${i + 1}</span>
            <span class="op-schedule__item-text">${op.summary}</span>
          </div>
        `).join("");
        listEl.querySelectorAll(".op-schedule__item").forEach((el) => {
          el.addEventListener("click", () => {
            scheduleCurrentIndex = parseInt(el.dataset.scheduleIdx, 10);
            renderScheduleList();
          });
        });
        const activeEl = listEl.querySelector(".is-active");
        if (activeEl) activeEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      };

      const syncScheduleMode = () => {};

      const refreshComputedFields = () => {
        const currentStartMode = getDropdownValue("js-start-mode-trigger", initialStartMode);
        syncStopModeUI();
        syncStartDateUI(currentStartMode);
        syncScheduleMode(currentStartMode);
        refreshIrrigationRate();
        refreshLamina();
        const payload = buildPayload();
        if (typeof resolveEstimate === "function") {
          const estimate = resolveEstimate(payload) || {};
          if (estimateDurationEl) {
            estimateDurationEl.textContent = isCenterstarVariant && Number.isFinite(asNum(estimate.durationMs, NaN))
              ? formatEstimateDurationLabel(copy, formatDurationValue(estimate.durationMs))
              : (estimate.durationText || formatEstimateDurationLabel(copy));
          }
          if (estimateEndEl) {
            const estimateEndDate = estimate.endDate != null ? toValidDate(estimate.endDate, Date.now()) : null;
            estimateEndEl.textContent = isCenterstarVariant && estimateEndDate && !Number.isNaN(estimateEndDate.getTime())
              ? formatEstimateEndLabel(copy, formatDateTime(estimateEndDate))
              : (estimate.endText || formatEstimateEndLabel(copy));
          }
        } else {
          if (estimateDurationEl) estimateDurationEl.textContent = formatEstimateDurationLabel(copy);
          if (estimateEndEl) estimateEndEl.textContent = formatEstimateEndLabel(copy, formatDateTime(payload.startAtDate) || "--");
        }
        const summaryPillEl = modal.querySelector(".js-op-summary-pill");
        if (summaryPillEl) {
          const sMode = getDropdownValue("js-start-mode-trigger", initialStartMode);
          const sDir = getSegmentValue("js-direction-group", initialDirection);
          const sIrr = getSegmentValue("js-irrigation-group", initialIrrigationMode);
          const sSpeed = speedInput?.value ? `${parseFloat(speedInput.value).toFixed(2)}%` : "–";
          const sStartLabel = sMode === "agora" ? copy.startModes.agora
            : sMode === "pos_pico" ? copy.startModes.pos_pico
            : copy.startModes.agendado;
          const sDirIcon = sDir === "reverso"
            ? '<i class="fa-solid fa-arrow-rotate-left"></i>'
            : '<i class="fa-solid fa-arrow-rotate-right"></i>';
          const sIrrIcon = sIrr === "seco"
            ? '<i class="fa-solid fa-droplet-slash"></i>'
            : '<i class="fa-solid fa-droplet"></i>';
          summaryPillEl.innerHTML = `<span>${sStartLabel}</span><span class="op-form__summary-sep">|</span>${sDirIcon}<span class="op-form__summary-sep">|</span>${sIrrIcon}<span class="op-form__summary-sep">|</span><span>${sSpeed}</span>`;
        }
      };

      modal.querySelector(".op-modal__close")?.addEventListener("click", closeModal);
      modal.querySelector(".op-modal__backdrop")?.addEventListener("click", closeModal);
      modal.querySelector(".js-op-cancel")?.addEventListener("click", closeModal);

      modal.querySelectorAll(".op-modal__legend-item[data-seg-index]").forEach(btn => {
        btn.addEventListener("click", () => {
          const isActive = btn.classList.contains("is-active");
          modal.querySelectorAll(".op-modal__legend-item[data-seg-index]").forEach(b => b.classList.remove("is-active"));
          if (!isActive) {

            btn.classList.add("is-active");
            const segIndex = parseInt(btn.dataset.segIndex, 10);
            const seg = _pivotSegments?.[segIndex];
            if (!seg) return;

            const curAngle = asNum(angle, 0);
            const curSpeed = speedInput ? parseFloat(speedInput.value) || null : null;
            const curLamina = laminaInput ? parseFloat(laminaInput.value) || null : null;
            const curStartAt = startAtInput?.value || null;
            const curStartAtNative = startAtNativeInput?.value || null;
            const curStartMode = getDropdownValue("js-start-mode-trigger", initialStartMode);

            let segStart = parseFloat(seg.startAngle) || 0;
            let segEnd = parseFloat(seg.endAngle) || 0;
            if (segEnd <= segStart) segEnd += 360;
            const sEmod = segEnd % 360; // ângulo real do fim do segmento (0-359)

            const isInsideSegment = curAngle >= segStart && curAngle <= segEnd;

            // Distância para chegar ao segmento em cada direção
            const distFwd = isInsideSegment
              ? segEnd - curAngle                          // quanto falta para sair pelo fim (avanço)
              : (segStart - curAngle + 360) % 360;        // quanto percorrer até a entrada (avanço)
            const distRev = isInsideSegment
              ? curAngle - segStart                        // quanto falta para sair pelo início (reverso)
              : (curAngle - sEmod + 360) % 360;           // quanto percorrer até a entrada pelo fim (reverso)

            const bestDir = distFwd <= distRev ? "avanco" : "reverso";

            // Atualiza botões de direção no formulário
            modal.querySelectorAll(".js-direction-group .op-form__seg-btn").forEach(b => {
              b.classList.toggle("is-active", b.dataset.value === bestDir);
            });

            const makePill = (irrMode) => {
              const dirIcon = bestDir === "reverso"
                ? '<i class="fa-solid fa-arrow-rotate-left"></i>'
                : '<i class="fa-solid fa-arrow-rotate-right"></i>';
              const irrIcon = irrMode === "seco"
                ? '<i class="fa-solid fa-droplet-slash"></i>'
                : '<i class="fa-solid fa-droplet"></i>';
              const sSpeed = curSpeed != null ? `${curSpeed.toFixed(2)}%` : "–";
              const startLabel = curStartMode === "agora" ? copy.startModes.agora
                : curStartMode === "pos_pico" ? copy.startModes.pos_pico
                : copy.startModes.agendado;
              return `<span>${startLabel}</span><span class="op-form__summary-sep">|</span>${dirIcon}<span class="op-form__summary-sep">|</span>${irrIcon}<span class="op-form__summary-sep">|</span><span>${sSpeed}</span>`;
            };

            const segColor = SEGMENT_PALETTE[segIndex % SEGMENT_PALETTE.length];
            const makeOp = (irrMode, stopVal, label, opFromAngle = null) => ({
              summary: label,
              pillHtml: makePill(irrMode),
              segmentName: segName,
              segmentColor: segColor,
              formState: {
                startMode: curStartMode,
                direction: bestDir,
                irrigationMode: irrMode,
                stopMode: "por_angulo",
                stopValue: stopVal,
                fromAngle: opFromAngle,
                speed: curSpeed,
                laminaMm: curLamina,
                startAt: curStartAt,
                startAtNative: curStartAtNative,
              },
            });

            const segName = seg.name || `Segmento ${segIndex + 1}`;
            const ops = [];

            if (isInsideSegment) {
              if (bestDir === "avanco") {
                const wetStop = sEmod || 360;
                ops.push(makeOp("molhado", wetStop, `Irrigar ${segName} → ${wetStop}°`, null));
              } else {
                ops.push(makeOp("molhado", segStart, `Irrigar ${segName} → ${segStart}°`, null));
              }
            } else if (bestDir === "avanco") {
              if (distFwd > 0) {
                ops.push(makeOp("seco", segStart, `Avanço a seco → ${segStart}°`, null));
              }
              const wetStop = sEmod || 360;
              ops.push(makeOp("molhado", wetStop, `Irrigar ${segName} → ${wetStop}°`, segStart));
            } else {
              // reverso: percorre seco até sEmod, depois irriga de sEmod até segStart
              if (distRev > 0) {
                const dryStop = sEmod || 360;
                ops.push(makeOp("seco", dryStop, `Recuo a seco → ${dryStop}°`, null));
              }
              ops.push(makeOp("molhado", segStart, `Irrigar ${segName} → ${segStart}°`, sEmod));
            }

            scheduleOps = ops;
            scheduleCurrentIndex = 0;
            renderScheduleList();
            renderSummaryPills();
            loadOpIntoForm(scheduleOps[0]);
            updateConfirmBtn();
          } else {
            // Desselecionou — restaura comportamento normal
            _opModalPivotMap?.updateAngleOverlay?.(0, false);
          }
        });
      });
      modal.querySelector(".js-op-clear")?.addEventListener("click", () => {
        if (typeof onClear === "function") onClear();
        closeModal();
      });
      const confirmBtn = modal.querySelector(".js-op-confirm");

      // Pivô já operando na simulação → mostra um botão "Parar Pivô" extra (à esquerda),
      // mantendo o OK para que o usuário ainda possa enviar outros comandos (seco/reverso/etc).
      const RUNNING_STATUS_KEYS = ["irrigando", "movendo_a_seco", "ferti_irrigando", "preparando_irrigar"];
      const pivotStatusKey = pivotId ? (window.IcResolvePivotStatus?.({ id: pivotId })?.key || null) : null;
      const pivotIsRunning = RUNNING_STATUS_KEYS.includes(pivotStatusKey);

      const stopBtn = modal.querySelector(".js-op-stop");
      if (stopBtn && !pivotIsRunning) stopBtn.style.display = "none";

      const updateConfirmBtn = () => {
        if (!confirmBtn) return;
        confirmBtn.textContent = scheduleOps.length > 1 ? "Próximo" : "OK";
      };
      updateConfirmBtn();

      const destroyReviewMaps = () => {
        _reviewMaps.forEach(m => { try { m.remove(); } catch (_) {} });
        _reviewMaps = [];
      };

      const initReviewMiniMap = (containerId, opSnap) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        if (!window.L) { OpModal.renderDial(containerId, opSnap.currentAngle ?? 0, opSnap.isSector, opSnap.sectorStart, opSnap.sectorEnd); return; }

        const snap = getPivotSnapshot(pivotId);
        const centerLat = parseFloat(snap?.centerLat ?? snap?.center?.lat ?? snap?.lat);
        const centerLng = parseFloat(snap?.centerLng ?? snap?.center?.lng ?? snap?.lng);
        const pivRadius = parseFloat(snap?.radius);
        const refLat = parseFloat(snap?.refLat ?? snap?.ref?.lat);
        const refLng = parseFloat(snap?.refLng ?? snap?.ref?.lng);

        if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng) || !Number.isFinite(pivRadius) || pivRadius <= 0) {
          OpModal.renderDial(containerId, opSnap.currentAngle ?? 0, opSnap.isSector, opSnap.sectorStart, opSnap.sectorEnd);
          return;
        }

        let refBearing = 0;
        if (Number.isFinite(refLat) && Number.isFinite(refLng)) {
          const lat1 = centerLat * Math.PI / 180, lng1 = centerLng * Math.PI / 180;
          const lat2 = refLat * Math.PI / 180, lng2 = refLng * Math.PI / 180;
          const y = Math.sin(lng2 - lng1) * Math.cos(lat2);
          const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1);
          refBearing = ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
        }

        // Pivot fills ~55% of container height so satellite is clearly visible
        const containerH = container.offsetHeight || 160;
        const cosLat = Math.cos(centerLat * Math.PI / 180);
        const mPerPx = (pivRadius * 2 * 1.1) / containerH;
        const zoom = Math.max(1, Math.min(18, Math.round(Math.log2(156543.03392 * cosLat / mPerPx))));

        container.innerHTML = "";
        const map = L.map(container, {
          zoomControl: false, attributionControl: false,
          dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
          touchZoom: false, keyboard: false,
        }).setView([centerLat, centerLng], zoom);
        _reviewMaps.push(map);

        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19 }).addTo(map);

        const dest = (bearing, dist) => {
          const R = 6378137, d = dist / R, t = bearing * Math.PI / 180;
          const p1 = centerLat * Math.PI / 180, l1 = centerLng * Math.PI / 180;
          const sp1 = Math.sin(p1), cp1 = Math.cos(p1);
          const sd = Math.sin(d), cd = Math.cos(d);
          const sp2 = sp1 * cd + cp1 * sd * Math.cos(t);
          const p2 = Math.asin(Math.max(-1, Math.min(1, sp2)));
          const y2 = Math.sin(t) * sd * cp1, x2 = cd - sp1 * Math.sin(p2);
          return [p2 * 180 / Math.PI, (((centerLng * Math.PI / 180 + Math.atan2(y2, x2)) * 180 / Math.PI) + 540) % 360 - 180];
        };

        const isSec = opSnap.isSector, secStart = opSnap.sectorStart ?? 0, secEnd = opSnap.sectorEnd ?? 360;
        // Transparent fill — only the programmed arc strip will be blue
        const shapeStyle = { color: "#ffffff", weight: 2, fillColor: "#1e40af", fillOpacity: 0, interactive: false };
        // Contorno escuro atrás da linha branca p/ destacar o raio do pivô sobre o satélite.
        const outlineStyle = { color: "rgba(0,0,0,0.5)", weight: 3, fill: false, interactive: false };

        if (isSec) {
          const pts = [[centerLat, centerLng]];
          const steps = Math.max(Math.ceil((secEnd - secStart) * 2), 2);
          for (let i2 = 0; i2 <= steps; i2++) {
            const a = secStart + ((secEnd - secStart) * i2) / steps;
            pts.push(dest((refBearing + a) % 360, pivRadius));
          }
          pts.push([centerLat, centerLng]);
          L.polygon(pts, outlineStyle).addTo(map);
          L.polygon(pts, shapeStyle).addTo(map);
        } else {
          L.circle([centerLat, centerLng], { radius: pivRadius, ...outlineStyle }).addTo(map);
          L.circle([centerLat, centerLng], { radius: pivRadius, ...shapeStyle }).addTo(map);
        }

        // Ticks
        const innerR = pivRadius * 0.92;
        const arcTickStart = isSec ? secStart : 0, arcTickEnd = isSec ? secEnd : 360;
        for (let a = arcTickStart; a <= arcTickEnd; a += 5) {
          L.polyline([dest((refBearing + a) % 360, pivRadius), dest((refBearing + a) % 360, innerR)], {
            color: "#fff", weight: 1.5, opacity: 0.75, interactive: false,
          }).addTo(map);
        }

        // Reference wedge at 0°
        const wLeft = dest((refBearing - 5 + 360) % 360, pivRadius);
        const wRight = dest((refBearing + 5) % 360, pivRadius);
        const wInner = dest(refBearing, pivRadius * 0.82);
        L.polygon([wLeft, wRight, wInner], { color: "rgba(0,0,0,0.45)", weight: 2, fillColor: "#ffffff", fillOpacity: 0.95, interactive: false }).addTo(map);

        // Angle labels rotated outward
        map.createPane('arcPane');
        map.getPane('arcPane').style.zIndex = 350;
        const arcGroup = L.layerGroup({ pane: 'arcPane' }).addTo(map);
        const lblStyle = "font-size:10px;font-weight:700;color:#fff;white-space:nowrap;pointer-events:none;line-height:1.4;text-shadow:-0.5px -0.5px 0 rgba(0,0,0,0.55),0.5px -0.5px 0 rgba(0,0,0,0.55),-0.5px 0.5px 0 rgba(0,0,0,0.55),0.5px 0.5px 0 rgba(0,0,0,0.55),0 0 2px rgba(0,0,0,0.4);";
        // const labelAngles = isSec
        //   ? [secStart, ...([90, 180, 270].filter(a => a > secStart && a < secEnd)), secEnd]
        //   : [0, 90, 180, 270];
        // const labelR = pivRadius * 1.08;
        // labelAngles.forEach(a => {
        //   const bearing = (refBearing + a) % 360;
        //   const pos = dest(bearing, labelR);
        //   const w = 36, h = 16;
        //   L.marker(pos, {
        //     icon: L.divIcon({
        //       className: "",
        //       html: `<div style="width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center;transform-origin:center bottom;transform:rotate(${bearing}deg);"><span style="${lblStyle}">${a}°</span></div>`,
        //       iconAnchor: [w / 2, h],
        //     }),
        //     interactive: false, keyboard: false,
        //   }).addTo(map);
        // });

        // Arc overlay showing programmed sweep
        const direction = opSnap.direction ?? "avanco";
        const irrigationMode = opSnap.irrigationMode ?? "molhado";
        const stopMode = opSnap.stopMode ?? "sem_parar";
        const stopAngle = opSnap.stopAngle ?? 0;
        const curAngle = opSnap.currentAngle ?? 0;
        const arcColor = irrigationMode === "seco" ? "#92400e" : "#1e40af";

        if (stopMode === "por_angulo" && stopAngle > 0) {
          const isReverso = direction === "reverso";
          const rawAngle = ((stopAngle % 360) + 360) % 360;
          let startA, normalizedAngle, sweep;
          if (isReverso) {
            startA = isSec ? secEnd : ((curAngle % 360) + 360) % 360;
            normalizedAngle = isSec ? Math.max(rawAngle, secStart) : rawAngle;
            sweep = startA - normalizedAngle;
            if (!isSec && sweep < 0) sweep += 360;
            if (sweep < 0) sweep = 0;
          } else {
            startA = isSec ? secStart : ((curAngle % 360) + 360) % 360;
            normalizedAngle = isSec ? Math.min(rawAngle, secEnd) : rawAngle;
            sweep = normalizedAngle - startA;
            if (!isSec && sweep < 0) sweep += 360;
            if (sweep < 0) sweep = 0;
          }
          const outerPts = [], innerPts = [], step = 2;
          const outerR2 = pivRadius, innerR2 = pivRadius * 0.91;
          for (let i2 = 0; i2 <= sweep; i2 += step) {
            const b = (refBearing + startA + (isReverso ? -i2 : i2) + 360) % 360;
            outerPts.push(dest(b, outerR2));
            innerPts.unshift(dest(b, innerR2));
          }
          const endB = (refBearing + normalizedAngle + 360) % 360;
          outerPts.push(dest(endB, outerR2));
          innerPts.unshift(dest(endB, innerR2));
          L.polygon([...outerPts, ...innerPts], { pane: 'arcPane', color: "transparent", weight: 0, fillColor: arcColor, fillOpacity: 0.75, interactive: false }).addTo(arcGroup);

          // Arrowhead at the leading end of the arc, pointing in the travel direction
          if (sweep > 0.5) {
            const headDeg = Math.min(6, sweep);
            const midR = (outerR2 + innerR2) / 2;
            const tipA = normalizedAngle + (isReverso ? -headDeg : headDeg);
            const tip = dest((refBearing + tipA + 360) % 360, midR);
            const baseOut = dest((refBearing + normalizedAngle + 360) % 360, outerR2);
            const baseIn = dest((refBearing + normalizedAngle + 360) % 360, innerR2);
            L.polygon([baseOut, tip, baseIn], { pane: 'arcPane', color: "rgba(0,0,0,0.45)", weight: 1, fillColor: arcColor, fillOpacity: 0.95, interactive: false }).addTo(arcGroup);
          }

          // Start needle (current position — spans)
          const startBearing = (refBearing + startA + 360) % 360;
          const startPos = dest(startBearing, pivRadius);
          L.polyline([[centerLat, centerLng], startPos], { color: "rgba(0,0,0,0.75)", weight: 3, opacity: 1, interactive: false }).addTo(map);
          L.polyline([[centerLat, centerLng], startPos], { color: "#fff", weight: 2, opacity: 0.95, interactive: false }).addTo(map);
          // Stop needle (solid)
          const targetBearing = (refBearing + normalizedAngle + 360) % 360;
          const targetPos = dest(targetBearing, pivRadius);
          L.polyline([[centerLat, centerLng], targetPos], { color: "rgba(0,0,0,0.75)", weight: 3, opacity: 1, interactive: false }).addTo(map);
          L.polyline([[centerLat, centerLng], targetPos], { color: "#fff", weight: 2, opacity: 0.95, interactive: false }).addTo(map);

          // Center badge with angle
          const sz = 26;
          L.marker([centerLat, centerLng], {
            icon: L.divIcon({
              className: "",
              html: `<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:#fff;border:1.5px solid #cbd5e1;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#0f172a;white-space:nowrap;pointer-events:none;">${Math.round(normalizedAngle)}°</div>`,
              iconAnchor: [sz / 2, sz / 2],
            }),
            interactive: false, keyboard: false,
          }).addTo(map);
        } else {
          // Just show current position needle
          if (curAngle > 0) {
            const nb = (refBearing + curAngle) % 360;
            L.polyline([[centerLat, centerLng], dest(nb, pivRadius)], { color: "rgba(0,0,0,0.75)", weight: 3, opacity: 1, interactive: false }).addTo(map);
            L.polyline([[centerLat, centerLng], dest(nb, pivRadius)], { color: "#fff", weight: 2, opacity: 0.95, interactive: false }).addTo(map);
          }
          L.circleMarker([centerLat, centerLng], { radius: 5, color: "rgba(0,0,0,0.45)", weight: 2, fillColor: "#fff", fillOpacity: 1, interactive: false }).addTo(map);
        }

        setTimeout(() => { try { map.invalidateSize(); map.setView([centerLat, centerLng], zoom); } catch (_) {} }, 80);
      };

      const showReviewPage = () => {
        const headerCenter = modal.querySelector(".op-modal__header-center");
        const peakIcon = modal.querySelector(".op-modal__peak-icon");
        const detailsBtn = modal.querySelector(".op-modal__details-btn");

        if (headerCenter) headerCenter.innerHTML = `<span class="op-modal__review-label">Revisão das Operações</span>`;
        if (detailsBtn) detailsBtn.style.display = "none";

        modal.querySelector(".op-modal__dialog")?.classList.add("is-review");
        modal.querySelector(".js-config-page")?.classList.add("is-hidden");
        modal.querySelector(".js-review-page")?.classList.remove("is-hidden");
        modal.querySelector(".js-footer-config")?.classList.add("is-hidden");
        modal.querySelector(".js-footer-review")?.classList.remove("is-hidden");

        const reviewList = modal.querySelector(".js-review-list");
        if (reviewList) {
          const reviewSnaps = scheduleOps.reduce((acc, op, i) => {
            const fs = op.formState || {};
            let snap = op.dialSnapshot ?? {
              isSector, sectorStart, sectorEnd,
              currentAngle: angle,
              direction: fs.direction ?? "avanco",
              irrigationMode: fs.irrigationMode ?? "molhado",
              stopMode: fs.stopMode ?? "sem_parar",
              stopAngle: fs.stopValue ?? 0,
            };
            if (i > 0) {
              const prev = acc[i - 1];
              if (prev?.stopMode === "por_angulo" && prev?.stopAngle > 0) {
                snap = { ...snap, currentAngle: prev.stopAngle };
              }
            }
            acc.push(snap);
            return acc;
          }, []);

          const getSegmentsInArc = (fromAngle, toAngle, direction, pivotSegs) => {
            if (!Array.isArray(pivotSegs) || pivotSegs.length < 2) return [];
            let aFrom = ((fromAngle % 360) + 360) % 360;
            let aTo = ((toAngle % 360) + 360) % 360;
            if (direction === "reverso") [aFrom, aTo] = [aTo, aFrom];
            const arcLen = aTo >= aFrom ? aTo - aFrom : (360 - aFrom + aTo);
            if (arcLen <= 0) return [];
            const inArc = (p) => ((((p % 360) + 360) % 360) - aFrom + 360) % 360 <= arcLen;
            return pivotSegs.map((seg, i) => {
              const sFrom = ((parseFloat(seg.startAngle) || 0) + 360) % 360;
              const sTo = ((parseFloat(seg.endAngle) || 0) + 360) % 360;
              const segLen = sTo >= sFrom ? sTo - sFrom : (360 - sFrom + sTo);
              const inSeg = (p) => ((((p % 360) + 360) % 360) - sFrom + 360) % 360 <= segLen;
              if (inArc(sFrom) || inSeg(aFrom)) {
                return { name: seg.name || `Segmento ${i + 1}`, color: SEGMENT_PALETTE[i % SEGMENT_PALETTE.length] };
              }
              return null;
            }).filter(Boolean);
          };

          reviewList.innerHTML = scheduleOps.map((op, i) => {
            const snap = reviewSnaps[i];
            const hasAngleRange = snap.stopMode === "por_angulo" && snap.stopAngle > 0;
            const startDeg = typeof snap.currentAngle === "number" ? Math.round(snap.currentAngle) : "–";
            const stopDeg  = hasAngleRange ? Math.round(snap.stopAngle) : null;
            const rangeHtml = hasAngleRange
              ? `<span class="op-review__card-range"><span>${startDeg}°</span><i class="fa-solid fa-arrow-right"></i><span>${stopDeg}°</span></span>`
              : `<span class="op-review__card-range"><span>${startDeg}°</span></span>`;

            const isSeco = op.formState?.irrigationMode === "seco";
            let traversedSegs;
            if (isSeco) {
              const allSegs = _pivotSegments
                ? getSegmentsInArc(snap.currentAngle ?? 0, op.formState?.stopValue ?? 0, op.formState?.direction ?? "avanco", _pivotSegments)
                : [];
              traversedSegs = allSegs.filter(s => s.name !== op.segmentName);
            } else {
              traversedSegs = op.segmentName
                ? [{ name: op.segmentName, color: op.segmentColor || "#1e40af" }]
                : [];
            }
            const legendHtmlForOp = traversedSegs.length > 0
              ? `<div class="op-review__card-legends">${traversedSegs.map(s => `<div class="op-review__card-legend"><span class="op-modal__legend-color" style="background:${s.color};"></span><span>${s.name}</span></div>`).join("")}</div>`
              : "";

            return `
              <div class="op-review__card">
                <div class="op-review__card-header">
                  <span class="op-review__card-title">${tOp("Operação", "Operation")} ${i + 1}</span>
                  ${rangeHtml}
                </div>
                <div class="op-review__card-dial" id="opReviewDial_${i}"></div>
                <div class="op-review__card-footer">
                  ${legendHtmlForOp}
                  <div class="op-review__card-pill">${op.pillHtml || "–"}</div>
                  <div class="op-review__card-estimate">${op.estimateDurationText ? `<span>${op.estimateDurationText}</span>` : `<span>${formatEstimateDurationLabel(getModalCopy({ english: !!(window.IcI18n && window.IcI18n.isEnglish && window.IcI18n.isEnglish()) }))}</span>`}${op.estimateEndText ? `<span>${op.estimateEndText}</span>` : ""}</div>
                </div>
              </div>
            `;
          }).join("");

          destroyReviewMaps();
          requestAnimationFrame(() => {
            scheduleOps.forEach((op, i) => {
              initReviewMiniMap(`opReviewDial_${i}`, reviewSnaps[i]);
            });
          });
        }
      };

      const showConfigPage = () => {
        const headerCenter = modal.querySelector(".op-modal__header-center");
        const peakIcon = modal.querySelector(".op-modal__peak-icon");
        const detailsBtn = modal.querySelector(".op-modal__details-btn");

        if (headerCenter) headerCenter.innerHTML = `<button type="button" class="op-modal__load-btn">${copy.loadLastIrrigation}</button>`;
        if (peakIcon) peakIcon.style.display = "";
        if (detailsBtn) detailsBtn.style.display = "";

        destroyReviewMaps();

        modal.querySelector(".op-modal__dialog")?.classList.remove("is-review");
        modal.querySelector(".js-review-page")?.classList.add("is-hidden");
        modal.querySelector(".js-config-page")?.classList.remove("is-hidden");
        modal.querySelector(".js-footer-review")?.classList.add("is-hidden");
        modal.querySelector(".js-footer-config")?.classList.remove("is-hidden");

        updateConfirmBtn();

        if (_opModalPivotMap) {
          requestAnimationFrame(() => { try { _opModalPivotMap.invalidateSize(); } catch (_) {} });
        }
      };

      const buildMiniDialSvg = (snap) => {
        if (!snap) return "";
        const size = 72;
        const cx = size / 2;
        const cy = size / 2;
        const R = size / 2 - 4;
        const toXY = (bearing, r) => {
          const rad = (bearing - 90) * Math.PI / 180;
          return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
        };
        let shapePath = "";
        if (snap.isSector) {
          const [x1, y1] = toXY(snap.sectorStart, R);
          const [x2, y2] = toXY(snap.sectorEnd, R);
          const span = snap.sectorEnd - snap.sectorStart;
          const largeArc = span > 180 ? 1 : 0;
          shapePath = `<path d="M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${R},${R} 0 ${largeArc} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z" fill="#1e40af" fill-opacity="0.9" stroke="#fff" stroke-width="1.5"/>`;
        } else {
          shapePath = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="#1e40af" fill-opacity="0.9" stroke="#fff" stroke-width="1.5"/>`;
        }
        const tickStart = snap.isSector ? snap.sectorStart : 0;
        const tickEnd = snap.isSector ? snap.sectorEnd : 360;
        const innerR = R * 0.86;
        let ticks = "";
        for (let a = tickStart; a <= tickEnd; a += 15) {
          const [ox, oy] = toXY(a, R);
          const [ix, iy] = toXY(a, innerR);
          ticks += `<line x1="${ox.toFixed(2)}" y1="${oy.toFixed(2)}" x2="${ix.toFixed(2)}" y2="${iy.toFixed(2)}" stroke="#fff" stroke-width="1" stroke-opacity="0.65"/>`;
        }
        let needle = "";
        if (snap.currentAngle > 0) {
          const [nx, ny] = toXY(snap.currentAngle, R * 0.78);
          needle = `<line x1="${cx}" y1="${cy}" x2="${nx.toFixed(2)}" y2="${ny.toFixed(2)}" stroke="rgba(0,0,0,0.7)" stroke-width="2"/><line x1="${cx}" y1="${cy}" x2="${nx.toFixed(2)}" y2="${ny.toFixed(2)}" stroke="#fff" stroke-width="1.5"/>`;
        }
        return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0">${shapePath}${ticks}${needle}<circle cx="${cx}" cy="${cy}" r="3.5" fill="#fff" stroke="rgba(0,0,0,0.3)" stroke-width="1"/></svg>`;
      };

      const buildCurrentOpData = () => {
        const _dir = getSegmentValue("js-direction-group", initialDirection);
        const _irr = getSegmentValue("js-irrigation-group", initialIrrigationMode);
        const _stopMode = getDropdownValue("js-stop-mode-trigger", initialStopMode);
        const _stopAngle = parseFloat(stopDynamicInput?.value ?? 0) || 0;
        const sMode = getDropdownValue("js-start-mode-trigger", initialStartMode);
        const sStartLabel = sMode === "agora" ? copy.startModes.agora
          : sMode === "pos_pico" ? copy.startModes.pos_pico
          : copy.startModes.agendado;
        const sDirIcon = _dir === "reverso"
          ? '<i class="fa-solid fa-arrow-rotate-left"></i>'
          : '<i class="fa-solid fa-arrow-rotate-right"></i>';
        const sIrrIcon = _irr === "seco"
          ? '<i class="fa-solid fa-droplet-slash"></i>'
          : '<i class="fa-solid fa-droplet"></i>';
        const sSpeed = speedInput?.value ? `${parseFloat(speedInput.value).toFixed(2)}%` : "–";
        const pillHtml = `<span>${sStartLabel}</span><span class="op-form__summary-sep">|</span>${sDirIcon}<span class="op-form__summary-sep">|</span>${sIrrIcon}<span class="op-form__summary-sep">|</span><span>${sSpeed}</span>`;
        const dialSnapshot = {
          isSector, sectorStart, sectorEnd, currentAngle: angle,
          direction: _dir, irrigationMode: _irr,
          stopMode: _stopMode, stopAngle: _stopAngle,
        };
        const estimateDurationText = estimateDurationEl?.textContent?.trim() || "";
        const estimateEndText = estimateEndEl?.textContent?.trim() || "";
        return {
          summary: buildOpSummary(),
          pillHtml,
          dialSnapshot,
          estimateDurationText,
          estimateEndText,
          formState: {
            startMode: sMode,
            direction: _dir,
            irrigationMode: _irr,
            stopMode: _stopMode,
            stopValue: _stopAngle,
            speed: speedInput?.value ? parseFloat(speedInput.value) : null,
            laminaMm: laminaInput?.value ? parseFloat(laminaInput.value) : null,
            startAt: startAtInput?.value || null,
            startAtNative: startAtNativeInput?.value || null,
          },
        };
      };

      const commitCurrentOp = () => {
        if (scheduleCurrentIndex < 0 || scheduleCurrentIndex >= scheduleOps.length) return;
        const data = buildCurrentOpData();
        // buildCurrentOpData não inclui fromAngle — preserva o valor original da op
        data.formState.fromAngle = scheduleOps[scheduleCurrentIndex]?.formState?.fromAngle ?? null;
        scheduleOps[scheduleCurrentIndex] = { ...scheduleOps[scheduleCurrentIndex], ...data };
      };

      const loadOpIntoForm = (op) => {
        const fs = op?.formState;
        if (!fs) return;

        if (fs.startMode) {
          modal.querySelectorAll(".js-start-mode-trigger + .op-form__dropdown-panel .op-form__dropdown-item").forEach((item) => {
            item.classList.toggle("is-active", item.dataset.value === fs.startMode);
          });
          const startModeText = modal.querySelector(".js-start-mode-trigger .selected-text");
          if (startModeText) startModeText.textContent = resolveStartModeLabel(fs.startMode, copy);
        }

        if (fs.direction) {
          modal.querySelectorAll(".js-direction-group .op-form__seg-btn").forEach((btn) => {
            btn.classList.toggle("is-active", btn.dataset.value === fs.direction);
          });
        }

        if (fs.irrigationMode) {
          modal.querySelectorAll(".js-irrigation-group .op-form__seg-btn").forEach((btn) => {
            btn.classList.toggle("is-active", btn.dataset.value === fs.irrigationMode);
          });
        }

        if (fs.stopMode) {
          modal.querySelectorAll(".js-stop-mode-trigger + .op-form__dropdown-panel .op-form__dropdown-item").forEach((item) => {
            item.classList.toggle("is-active", item.dataset.value === fs.stopMode);
          });
          const stopModeText = modal.querySelector(".js-stop-mode-trigger .selected-text");
          if (stopModeText) stopModeText.textContent = resolveStopModeLabel(isLinear, fs.stopMode, copy);
        }

        if (stopDynamicInput && fs.stopValue != null) {
          stopDynamicInput.value = String(fs.stopValue);
        }

        if (speedInput && fs.speed != null) {
          speedInput.value = fs.speed.toFixed(2);
        }

        if (laminaInput && fs.laminaMm != null) {
          laminaInput.value = fs.laminaMm.toFixed(2);
        }

        if (fs.startAt && startAtInput) {
          startAtInput.value = fs.startAt;
        }

        if (fs.startAtNative && startAtNativeInput) {
          startAtNativeInput.value = fs.startAtNative;
          const parsed = new Date(fs.startAtNative);
          if (!Number.isNaN(parsed.getTime())) scheduledStartDate = parsed;
        }

        _opFromAngle = fs.fromAngle ?? null;
        refreshComputedFields();
      };

      const MAX_OPS = 9;

      const handleAddOp = () => {
        if (scheduleOps.length >= MAX_OPS) return;
        const data = buildCurrentOpData();
        scheduleOps.push(data);
        scheduleCurrentIndex = scheduleOps.length - 1;
        renderScheduleList();
        renderSummaryPills();
        updateConfirmBtn();
        const addBtn = modal.querySelector(".js-schedule-add");
        if (addBtn) addBtn.disabled = scheduleOps.length >= MAX_OPS;
      };

      const handleRemoveOp = () => {
        if (scheduleOps.length < 2) return;
        const addBtn = modal.querySelector(".js-schedule-add");
        if (addBtn) addBtn.disabled = false;
        const idx = scheduleCurrentIndex >= 0 ? scheduleCurrentIndex : scheduleOps.length - 1;
        scheduleOps.splice(idx, 1);
        scheduleCurrentIndex = Math.min(idx, scheduleOps.length - 1);
        renderScheduleList();
        renderSummaryPills();
        updateConfirmBtn();
      };

      // Aplica a operação na simulação (cards abertos pelo mapa, sem onSave próprio):
      // "agora" liga o pivô na hora (cores/arco no mapa); "agendado"/"após pico"
      // viram atividades programadas que o motor inicia sozinho no horário.
      const simStatusForOp = (op) => {
        if (op?.ferti) return "ferti_irrigando";
        return op?.irrigationMode === "molhado" ? "irrigando" : "movendo_a_seco";
      };
      const normalizeSimOp = (rawOp, payload) => {
        const fs = rawOp?.formState || {};
        return {
          pivotId,
          pivotName: resolvedTitle || title || "Pivô",
          isLinear,
          // Ângulo de início desta operação (encadeado entre operações: op2 começa onde op1 terminou).
          angle: Number.isFinite(fs.fromAngle) ? fs.fromAngle : asNum(payload.angle, 0),
          startMode: fs.startMode ?? rawOp?.startMode ?? payload.startMode ?? "agora",
          direction: fs.direction ?? rawOp?.direction ?? payload.direction,
          irrigationMode: fs.irrigationMode ?? rawOp?.irrigationMode ?? payload.irrigationMode,
          ferti: rawOp?.ferti ?? payload.ferti,
          speedPct: fs.speed ?? rawOp?.speedPct ?? payload.speedPct,
          laminaMm: fs.laminaMm ?? rawOp?.laminaMm ?? payload.laminaMm,
          stopMode: fs.stopMode ?? rawOp?.stopMode ?? payload.stopMode,
          stopValue: fs.stopValue ?? rawOp?.stopValue ?? payload.stopValue,
          startAt: fs.startAtNative ? new Date(fs.startAtNative) : (payload.startAtDate || null),
        };
      };
      const applyOperationsToSim = (payload) => {
        if (!pivotId) return;
        const rawOps = (Array.isArray(payload?.scheduledOps) && payload.scheduledOps.length)
          ? payload.scheduledOps
          : [null];
        const ops = rawOps.map((rawOp) => normalizeSimOp(rawOp, payload));
        const agoraOps = ops.filter((op) => (op.startMode || "agora") === "agora");
        const futureOps = ops.filter((op) => (op.startMode || "agora") !== "agora");

        // "Agora" (uma ou várias) → roda em sequência na hora, animando no mapa.
        if (agoraOps.length && typeof window.IcRunPivotOperations === "function") {
          window.IcRunPivotOperations(pivotId, agoraOps);
        } else if (agoraOps.length) {
          const op = agoraOps[0];
          window.IcSetSimPivotDirection?.(pivotId, op.direction === "reverso" ? -1 : 1);
          window.IcSetSimPivotSpeed?.(pivotId, asNum(op.speedPct, 100));
          window.IcSetSimPivotStatus?.(pivotId, simStatusForOp(op));
        }
        // "Agendado"/"após pico" → motor de programação inicia no horário.
        futureOps.forEach((op) => window.IcScheduleOperation?.(op));

        const parts = [];
        if (agoraOps.length) parts.push(agoraOps.length > 1 ? `${agoraOps.length} operações em sequência` : "Pivô ligado");
        if (futureOps.length) parts.push(`${futureOps.length} programada${futureOps.length > 1 ? "s" : ""}`);
        if (parts.length) window.IcNotify?.success?.(`${parts.join(" • ")}.`, 2000);
      };

      const handleConfirm = () => {
        if (scheduleOps.length > 1) {
          commitCurrentOp();
          showReviewPage();
          return;
        }
        const payload = buildPayload();
        if (typeof onSave === "function") {
          const shouldClose = onSave(payload);
          if (shouldClose === false) return;
        } else {
          applyOperationsToSim(payload);
        }
        closeModal();
      };

      confirmBtn?.addEventListener("click", handleConfirm);

      stopBtn?.addEventListener("click", () => {
        window.IcSetSimPivotStatus?.(pivotId, "painel_energizado");
        if (typeof onSave === "function") {
          try { onSave({ ...buildPayload(), action: "stop" }); } catch (_) {}
        }
        closeModal();
      });

      modal.querySelectorAll(".op-form__custom-select").forEach((dropdown) => {
        const trigger = dropdown.querySelector(".js-op-dropdown-trigger");
        const panel = dropdown.querySelector(".op-form__dropdown-panel");
        const items = dropdown.querySelectorAll(".op-form__dropdown-item");
        const selectedSpan = trigger?.querySelector(".selected-text");
        if (!trigger || !panel || !selectedSpan) return;

        const positionPanel = () => {
          const rect = trigger.getBoundingClientRect();
          panel.style.position = "fixed";
          panel.style.top = (rect.bottom + 4) + "px";
          panel.style.left = rect.left + "px";
          panel.style.width = rect.width + "px";
          panel.style.zIndex = "9999";
        };

        trigger.addEventListener("click", (event) => {
          event.stopPropagation();
          modal.querySelectorAll(".op-form__dropdown-panel").forEach((otherPanel) => {
            if (otherPanel !== panel) otherPanel.classList.remove("is-active");
          });
          modal.querySelectorAll(".js-op-dropdown-trigger").forEach((otherTrigger) => {
            if (otherTrigger !== trigger) otherTrigger.classList.remove("is-active");
          });
          modal.querySelectorAll(".op-form__custom-select").forEach((otherDropdown) => {
            if (otherDropdown !== dropdown) otherDropdown.classList.remove("is-active");
          });
          const isOpening = !panel.classList.contains("is-active");
          panel.classList.toggle("is-active");
          trigger.classList.toggle("is-active");
          dropdown.classList.toggle("is-active");
          if (isOpening) positionPanel();
        });

        items.forEach((item) => {
          item.addEventListener("click", () => {
            items.forEach((currentItem) => currentItem.classList.remove("is-active"));
            item.classList.add("is-active");
            selectedSpan.textContent = item.textContent;
            panel.classList.remove("is-active");
            trigger.classList.remove("is-active");
            dropdown.classList.remove("is-active");
            refreshComputedFields();
          });
        });
      });

      outsideClickHandler = () => closePanels();
      document.addEventListener("click", outsideClickHandler);

      modal.querySelectorAll(".op-form__segmented").forEach((group) => {
        const buttons = group.querySelectorAll(".op-form__seg-btn");
        const isDirectionGroup = group.classList.contains("js-direction-group");
        buttons.forEach((button) => {
          button.addEventListener("click", () => {
            buttons.forEach((otherButton) => otherButton.classList.remove("is-active"));
            button.classList.add("is-active");
            refreshComputedFields();
            if (!isLinear && _opModalPivotMap?.updateAngleOverlay) {
              const mode = getDropdownValue("js-stop-mode-trigger", initialStopMode);
              if (mode === "por_angulo") {
                const dir = getSegmentValue("js-direction-group", initialDirection);
                const irrMode = getSegmentValue("js-irrigation-group", initialIrrigationMode);
                _opModalPivotMap.updateAngleOverlay(asNum(stopDynamicInput?.value, 0), true, dir, irrMode, _opFromAngle);
              }
            }
          });
        });
      });

      speedInput?.addEventListener("input", refreshComputedFields);
      irrigationRateEl?.addEventListener("input", () => {
        if (!baseIrrigationRate || !speedInput) return;
        const rate = parseFloat(irrigationRateEl.value.replace(",", "."));
        if (!rate || rate <= 0) return;
        const newPct = Math.min(100, Math.max(1, (baseIrrigationRate / rate) * 100));
        speedInput.value = newPct.toFixed(2);
        refreshComputedFields();
      });
      irrigationRateEl?.addEventListener("blur", () => {
        const rate = parseFloat(irrigationRateEl.value.replace(",", "."));
        if (rate > 0) irrigationRateEl.value = rate.toFixed(2);
        else refreshIrrigationRate();
      });
      laminaInput?.addEventListener("input", () => {
        if (baseIrrigationRate && speedInput) {
          const mm = parseFloat(laminaInput.value);
          if (mm > 0) {
            const newPct = Math.min(100, Math.max(1, (baseIrrigationRate / mm) * 100));
            speedInput.value = newPct.toFixed(2);
          }
        }
        refreshComputedFields();
      });
      laminaInput?.addEventListener("blur", () => {
        const mm = parseFloat(laminaInput.value);
        if (mm > 0) laminaInput.value = mm.toFixed(laminaDecimals);
        else refreshLamina();
      });
      if (!isLinear && stopDynamicInput) {
        const clampToMax = () => {
          const val = parseFloat(stopDynamicInput.value);
          if (!isNaN(val) && val > sectorEnd) stopDynamicInput.value = sectorEnd;
          if (!isNaN(val) && val < 0) stopDynamicInput.value = 0;
        };
        let _angleOverlayTimer = null;
        stopDynamicInput.addEventListener("input", () => {
          refreshComputedFields();
          if (_opModalPivotMap?.updateAngleOverlay) {
            const mode = getDropdownValue("js-stop-mode-trigger", initialStopMode);
            if (mode === "por_angulo") {
              clearTimeout(_angleOverlayTimer);
              _angleOverlayTimer = setTimeout(() => {
                clampToMax();
                const dir = getSegmentValue("js-direction-group", initialDirection);
                const irrMode = getSegmentValue("js-irrigation-group", initialIrrigationMode);
                _opModalPivotMap.updateAngleOverlay(asNum(stopDynamicInput.value, 0), true, dir, irrMode, _opFromAngle);
              }, 400);
            }
          }
        });
        stopDynamicInput.addEventListener("blur", clampToMax);
        stopDynamicInput.addEventListener("keydown", (e) => { if (e.key === "Enter") clampToMax(); });
      } else {
        stopDynamicInput?.addEventListener("input", refreshComputedFields);
      }
      const fertiCheckbox = modal.querySelector("#opSimpleFerti");
      fertiCheckbox?.addEventListener("change", refreshComputedFields);
      fertiCheckbox?.addEventListener("change", () => {
        const obsGroup = modal.querySelector("#opFertiObsGroup");
        if (obsGroup) obsGroup.style.display = fertiCheckbox.checked ? "block" : "none";
      });
      startAtTrigger?.addEventListener("click", (event) => {
        event.stopPropagation();
        openStartDatePicker();
      });
      startAtInput?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openStartDatePicker();
      });
      startAtNativeInput?.addEventListener("change", () => {
        const parsed = startAtNativeInput.value ? new Date(startAtNativeInput.value) : null;
        if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) {
          scheduledStartDate = parsed;
        }
        refreshComputedFields();
      });

      modal.querySelector(".js-schedule-add")?.addEventListener("click", handleAddOp);
      modal.querySelector(".js-schedule-remove")?.addEventListener("click", handleRemoveOp);

      modal.querySelector(".js-review-back")?.addEventListener("click", showConfigPage);
      modal.querySelector(".js-review-send")?.addEventListener("click", () => {
        const payload = buildPayload();
        payload.scheduledOps = scheduleOps;
        if (typeof onSave === "function") {
          const shouldClose = onSave(payload);
          if (shouldClose === false) return;
        } else {
          applyOperationsToSim(payload);
        }
        closeModal();
      });

      modal.querySelector(".js-schedule-prev")?.addEventListener("click", () => {
        if (scheduleOps.length === 0) return;
        scheduleCurrentIndex = scheduleCurrentIndex <= 0 ? scheduleOps.length - 1 : scheduleCurrentIndex - 1;
        renderScheduleList();
      });

      modal.querySelector(".js-schedule-next")?.addEventListener("click", () => {
        if (scheduleOps.length === 0) return;
        scheduleCurrentIndex = scheduleCurrentIndex >= scheduleOps.length - 1 ? 0 : scheduleCurrentIndex + 1;
        renderScheduleList();
      });

      const scheduleListEl = modal.querySelector(".js-schedule-list");
      if (scheduleListEl) {
        let dragStartX = 0;
        let dragScrollLeft = 0;
        let isDragging = false;

        scheduleListEl.addEventListener("mousedown", (e) => {
          if (e.target.closest(".op-schedule__item")) return;
          isDragging = true;
          dragStartX = e.pageX - scheduleListEl.getBoundingClientRect().left;
          dragScrollLeft = scheduleListEl.scrollLeft;
          scheduleListEl.classList.add("is-dragging");
        });

        scheduleListEl.addEventListener("mousemove", (e) => {
          if (!isDragging) return;
          e.preventDefault();
          const x = e.pageX - scheduleListEl.getBoundingClientRect().left;
          scheduleListEl.scrollLeft = dragScrollLeft - (x - dragStartX);
        });

        const stopDrag = () => {
          isDragging = false;
          scheduleListEl.classList.remove("is-dragging");
        };
        scheduleListEl.addEventListener("mouseup", stopDrag);
        scheduleListEl.addEventListener("mouseleave", stopDrag);
      }

      if (isLinear) {
        this.renderLinearTrack("opModalLinearTrack", currentLinearPosition);
      } else {
        this.renderPivotMap("opModalDial", pivotId, asNum(angle, 0), isSector, sectorStart, sectorEnd, initialStopMode !== "por_angulo");
        requestAnimationFrame(() => {
          if (initialStopMode !== "por_angulo") {
            modal.querySelectorAll("#opModalDial .leaflet-tile-pane").forEach(el => { el.style.display = "none"; });
          } else {
            const pivotShape = modal.querySelector("#opModalDial .leaflet-overlay-pane path[fill='#1e40af']");
            if (pivotShape) pivotShape.setAttribute("fill-opacity", "0");
          }
        });
      }
      refreshComputedFields();

      const detailBtn = modal.querySelector(".js-op-go-details");
      if (detailBtn && pivotId) {
        detailBtn.addEventListener("click", async () => {
          if (_opModalPivotMap) {
            try { _opModalPivotMap.remove(); } catch (_) {}
            _opModalPivotMap = null;
          }
          closeModal();
          const farm = window.IcFarmGetActive?.() || window.IcFarmActive || null;
          const equip = Array.isArray(farm?.equipments)
            ? farm.equipments.find((item) => String(item?.id || "") === String(pivotId || ""))
            : null;
          const shouldOpenLinearDetails =
            isLinear || String(equip?.type || "").toLowerCase() === "linestar";
          if (shouldOpenLinearDetails && window.IcLineStar && typeof window.IcLineStar.open === "function") {
            await window.IcLineStar.open({ linestarId: pivotId, fromMap: true });
            return;
          }
          if (window.IcPivos && typeof window.IcPivos.open === "function") {
            await window.IcPivos.open({ pivotId, fromMap: true });
          }
        });
      }
    },

    renderLinearTrack(containerId, currentPosition) {
      const container = document.getElementById(containerId);
      if (!container) return;

      const pct = Math.max(0, Math.min(100, currentPosition));
      const w = 320;
      const h = 110;
      const rectX = 28;
      const rectW = w - 56;
      const rectY = 32;
      const rectH = 36;
      const rectR = 5;
      const trackLen = rectW;
      const posX = rectX + (pct / 100) * trackLen;

      let svg = `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" style="overflow:visible;">`;
      svg += `<rect x="${rectX}" y="${rectY}" width="${rectW}" height="${rectH}" rx="${rectR}" fill="#1e40af" fill-opacity="0.9"/>`;

      for (let i = 0; i <= 100; i += 5) {
        const x = rectX + (i / 100) * trackLen;
        svg += `<line x1="${x}" y1="${rectY}" x2="${x}" y2="${rectY - 4}" stroke="#fff" stroke-width="1" stroke-opacity="0.35"/>`;
      }

      [0, 25, 50, 75, 100].forEach((tick) => {
        const x = rectX + (tick / 100) * trackLen;
        svg += `<line x1="${x}" y1="${rectY}" x2="${x}" y2="${rectY - 9}" stroke="#fff" stroke-width="1.5" stroke-opacity="0.7"/>`;
        svg += `<text x="${x}" y="${rectY + rectH + 16}" text-anchor="middle" font-size="9" fill="#64748b">${tick}%</text>`;
      });

      svg += `<line x1="${posX}" y1="${rectY - 4}" x2="${posX}" y2="${rectY + rectH + 4}" stroke="#0f172a" stroke-width="7" stroke-linecap="round" stroke-opacity="0.28"/>`;
      svg += `<line x1="${posX}" y1="${rectY - 4}" x2="${posX}" y2="${rectY + rectH + 4}" stroke="#334155" stroke-width="5.5" stroke-linecap="round"/>`;
      svg += `<line x1="${posX}" y1="${rectY - 4}" x2="${posX}" y2="${rectY + rectH + 4}" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`;

      const triX = rectX;
      svg += `<polygon points="${triX},${rectY + 9} ${triX - 7},${rectY} ${triX + 7},${rectY}" fill="#fff" stroke="#334155" stroke-width="0.8"/>`;
      svg += `</svg>`;
      container.innerHTML = svg;
    },

    renderPivotMap(containerId, pivotId, currentAngle, isSector, sectorStart, sectorEnd, showSegments = false) {
      const container = document.getElementById(containerId);
      if (!container) return;

      if (_opModalPivotMap) {
        try { _opModalPivotMap.remove(); } catch (_) {}
        _opModalPivotMap = null;
      }

      const snap = getPivotSnapshot(pivotId);
      const centerLat = parseFloat(snap?.centerLat ?? snap?.center?.lat ?? snap?.lat);
      const centerLng = parseFloat(snap?.centerLng ?? snap?.center?.lng ?? snap?.lng);
      const radius = parseFloat(snap?.radius);
      const refLat = parseFloat(snap?.refLat ?? snap?.ref?.lat);
      const refLng = parseFloat(snap?.refLng ?? snap?.ref?.lng);

      if (!window.L || !Number.isFinite(centerLat) || !Number.isFinite(centerLng) || !Number.isFinite(radius) || radius <= 0) {
        this.renderDial(containerId, currentAngle, isSector, sectorStart, sectorEnd);
        return;
      }

      let refBearing = 0;
      if (Number.isFinite(refLat) && Number.isFinite(refLng)) {
        const lat1 = centerLat * Math.PI / 180;
        const lng1 = centerLng * Math.PI / 180;
        const lat2 = refLat * Math.PI / 180;
        const lng2 = refLng * Math.PI / 180;
        const y = Math.sin(lng2 - lng1) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1);
        refBearing = ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
      }

      // Calcula zoom para o pivô ocupar ~45% da altura do container (260px fixos no CSS)
      const containerH = 260;
      const cosLat = Math.cos(centerLat * Math.PI / 180);
      const mPerPx = (radius * 2 * 1.6) / containerH;
      const initialZoom = Math.max(1, Math.min(18, Math.round(Math.log2(156543.03392 * cosLat / mPerPx))));

      container.innerHTML = "";
      const map = L.map(container, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
        keyboard: false,
      }).setView([centerLat, centerLng], initialZoom);
      _opModalPivotMap = map;

      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19 }).addTo(map);

      const dest = (bearing, dist) => {
        const R = 6378137;
        const d = dist / R;
        const t = bearing * Math.PI / 180;
        const p1 = centerLat * Math.PI / 180;
        const l1 = centerLng * Math.PI / 180;
        const sp1 = Math.sin(p1), cp1 = Math.cos(p1);
        const sd = Math.sin(d), cd = Math.cos(d);
        const sp2 = sp1 * cd + cp1 * sd * Math.cos(t);
        const p2 = Math.asin(Math.max(-1, Math.min(1, sp2)));
        const y = Math.sin(t) * sd * cp1;
        const x = cd - sp1 * Math.sin(p2);
        const l2 = l1 + Math.atan2(y, x);
        return [p2 * 180 / Math.PI, ((l2 * 180 / Math.PI) + 540) % 360 - 180];
      };

      const shapeStyle = { color: "#ffffff", weight: 2, fillColor: "#1e40af", fillOpacity: 0.9, interactive: false };
      // Contorno escuro atrás da linha branca p/ destacar o raio do pivô sobre o satélite.
      const outlineStyle = { color: "rgba(0,0,0,0.5)", weight: 3, fill: false, interactive: false };

      if (isSector) {
        const pts = [[centerLat, centerLng]];
        const steps = Math.max(Math.ceil((sectorEnd - sectorStart) * 2), 2);
        for (let i = 0; i <= steps; i++) {
          const a = sectorStart + ((sectorEnd - sectorStart) * i) / steps;
          pts.push(dest((refBearing + a) % 360, radius));
        }
        pts.push([centerLat, centerLng]);
        L.polygon(pts, outlineStyle).addTo(map);
        L.polygon(pts, shapeStyle).addTo(map);
      } else {
        L.circle([centerLat, centerLng], { radius, ...outlineStyle }).addTo(map);
        L.circle([centerLat, centerLng], { radius, ...shapeStyle }).addTo(map);
      }

      const _snapSegments = showSegments && Array.isArray(snap?.segments) && snap.segments.length > 1 ? snap.segments : null;
      if (_snapSegments) {
        const SEG_PALETTE = [
          "rgb(0, 31, 153)", "rgb(160, 0, 229)", "rgb(0, 196, 179)", "rgb(82, 183, 0)",
          "rgb(255, 213, 0)", "rgb(255, 115, 0)", "rgb(142, 68, 173)", "rgb(22, 160, 133)", "rgb(233, 30, 99)",
        ];
        _snapSegments.forEach((seg, i) => {
          let sA = parseFloat(seg.startAngle) || 0;
          let eA = parseFloat(seg.endAngle) || 0;
          if (eA <= sA) eA += 360;
          const color = SEG_PALETTE[i % SEG_PALETTE.length];
          const steps = Math.max(Math.ceil((eA - sA) * 2), 2);
          const segPts = [[centerLat, centerLng]];
          for (let s = 0; s <= steps; s++) {
            const a = sA + ((eA - sA) * s) / steps;
            segPts.push(dest((refBearing + a) % 360, radius));
          }
          segPts.push([centerLat, centerLng]);
          L.polygon(segPts, {
            color: "transparent", weight: 0, fillColor: color, fillOpacity: 0.75, interactive: false,
          }).addTo(map);
        });
      }

      map.createPane('arcPane');
      map.getPane('arcPane').style.zIndex = 350;
      const arcGroup = L.layerGroup().addTo(map);

      const arcStart = isSector ? sectorStart : 0;
      const arcEnd = isSector ? sectorEnd : 360;
      const innerR = radius * 0.92;
      for (let a = arcStart; a <= arcEnd; a += 5) {
        const b = (refBearing + a) % 360;
        L.polyline([dest(b, radius), dest(b, innerR)], {
          color: "#fff", weight: 1.5, opacity: 0.75, interactive: false,
        }).addTo(map);
      }

      // Zero-angle reference triangle (inward wedge at refBearing)
      const wLeft  = dest((refBearing - 5 + 360) % 360, radius);
      const wRight = dest((refBearing + 5) % 360, radius);
      const wInner = dest(refBearing, radius * 0.82);
      L.polygon([wLeft, wRight, wInner], {
        color: "rgba(0,0,0,0.45)", weight: 2, fillColor: "#ffffff", fillOpacity: 0.95, interactive: false,
      }).addTo(map);


      const needleGroup = L.layerGroup().addTo(map);
      const needleInRange = !isSector || (currentAngle >= sectorStart && currentAngle <= sectorEnd);
      if (currentAngle > 0 && needleInRange) {
        const needleBearing = (refBearing + currentAngle) % 360;
        L.polyline([[centerLat, centerLng], dest(needleBearing, radius)], {
          color: "rgba(0,0,0,0.75)", weight: 3.5, opacity: 1, interactive: false,
        }).addTo(needleGroup);
        L.polyline([[centerLat, centerLng], dest(needleBearing, radius)], {
          color: "#fff", weight: 2.5, opacity: 0.95, interactive: false,
        }).addTo(needleGroup);
      }
      map.setNeedleVisible = (visible) => {
        if (visible) map.addLayer(needleGroup);
        else map.removeLayer(needleGroup);
      };

      L.circleMarker([centerLat, centerLng], {
        radius: 6, color: "rgba(0,0,0,0.45)", weight: 2, fillColor: "#fff", fillOpacity: 1, interactive: false,
      }).addTo(map);

      const angleOverlayGroup = L.layerGroup().addTo(map);
      const lblStyle = "font-size:12px;font-weight:700;color:#fff;white-space:nowrap;pointer-events:none;line-height:1.4;text-shadow:-0.5px -0.5px 0 rgba(0,0,0,0.55),0.5px -0.5px 0 rgba(0,0,0,0.55),-0.5px 0.5px 0 rgba(0,0,0,0.55),0.5px 0.5px 0 rgba(0,0,0,0.55),0 0 2px rgba(0,0,0,0.4);";
      const drawAngleLabels = () => {
        // const labelAngles = isSector
        //   ? [sectorStart, ...([90, 180, 270].filter(a => a > sectorStart && a < sectorEnd)), sectorEnd]
        //   : [0, 90, 180, 270];
        // labelAngles.forEach(a => {
        //   const bearing = (refBearing + a) % 360;
        //   const pos = dest(bearing, radius);
        //   const w = 52, h = 22;
        //   L.marker(pos, {
        //     icon: L.divIcon({
        //       className: "",
        //       html: `<div style="width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center;transform-origin:center bottom;transform:rotate(${bearing}deg);"><span style="${lblStyle}">${a}°</span></div>`,
        //       iconAnchor: [w / 2, h],
        //     }),
        //     interactive: false, keyboard: false,
        //   }).addTo(angleOverlayGroup);
        // });
      };
      drawAngleLabels();

      map.updateAngleOverlay = (angleDeg, visible, direction = "avanco", irrigationMode = "molhado", fromAngle = null) => {
        const arcColor = irrigationMode === "seco" ? "#92400e" : "#1e40af";
        const badgeColor = irrigationMode === "seco" ? "rgba(146,64,14,0.85)" : "rgba(30,64,175,0.85)";
        arcGroup.clearLayers();
        angleOverlayGroup.clearLayers();
        drawAngleLabels();
        if (!visible) return;

        const isReverso = direction === "reverso";
        const rawAngle = ((angleDeg % 360) + 360) % 360;
        const pivotAngle = fromAngle != null ? fromAngle : currentAngle;

        let startA, normalizedAngle, sweep;
        if (isReverso) {
          startA = isSector ? sectorEnd : ((pivotAngle % 360) + 360) % 360;
          normalizedAngle = isSector ? Math.max(rawAngle, sectorStart) : rawAngle;
          sweep = startA - normalizedAngle;
          if (!isSector && sweep < 0) sweep += 360;
          if (sweep < 0) sweep = 0;
        } else {
          startA = isSector ? sectorStart : ((pivotAngle % 360) + 360) % 360;
          normalizedAngle = isSector ? Math.min(rawAngle, sectorEnd) : rawAngle;
          sweep = normalizedAngle - startA;
          if (!isSector && sweep < 0) sweep += 360;
          if (sweep < 0) sweep = 0;
        }

        const outerR = radius;
        const innerR = radius * 0.9;
        const outerPts = [];
        const innerPts = [];
        const step = 2;
        for (let i = 0; i <= sweep; i += step) {
          const b = (refBearing + startA + (isReverso ? -i : i) + 360) % 360;
          outerPts.push(dest(b, outerR));
          innerPts.unshift(dest(b, innerR));
        }
        const endB = (refBearing + normalizedAngle + 360) % 360;
        outerPts.push(dest(endB, outerR));
        innerPts.unshift(dest(endB, innerR));
        L.polygon([...outerPts, ...innerPts], {
          pane: 'arcPane', color: "transparent", weight: 0, fillColor: arcColor, fillOpacity: 0.75, interactive: false,
        }).addTo(arcGroup);

        // Arrowhead at the leading end of the arc, pointing in the travel direction
        if (sweep > 0.5) {
          const headDeg = Math.min(6, sweep);
          const midR = (outerR + innerR) / 2;
          const tipA = normalizedAngle + (isReverso ? -headDeg : headDeg);
          const tip = dest((refBearing + tipA + 360) % 360, midR);
          const baseOut = dest((refBearing + normalizedAngle + 360) % 360, outerR);
          const baseIn = dest((refBearing + normalizedAngle + 360) % 360, innerR);
          L.polygon([baseOut, tip, baseIn], {
            pane: 'arcPane', color: "rgba(0,0,0,0.45)", weight: 1, fillColor: arcColor, fillOpacity: 0.95, interactive: false,
          }).addTo(arcGroup);
        }

        const targetBearing = (refBearing + normalizedAngle + 360) % 360;
        const targetPos = dest(targetBearing, radius);
        const midPos = [centerLat, centerLng];
        // Start needle (current position — dashed)
        const startBearing = (refBearing + startA + 360) % 360;
        const startPos = dest(startBearing, radius);
        L.polyline([[centerLat, centerLng], startPos], {
          color: "rgba(0,0,0,0.75)", weight: 3.5, opacity: 1, interactive: false,
        }).addTo(angleOverlayGroup);
        L.polyline([[centerLat, centerLng], startPos], {
          color: "#fff", weight: 2.5, opacity: 0.95, interactive: false,
        }).addTo(angleOverlayGroup);
        // Stop needle (solid)
        L.polyline([[centerLat, centerLng], targetPos], {
          color: "rgba(0,0,0,0.75)", weight: 3.5, opacity: 1, interactive: false,
        }).addTo(angleOverlayGroup);
        L.polyline([[centerLat, centerLng], targetPos], {
          color: "#fff", weight: 2.5, opacity: 0.95, interactive: false,
        }).addTo(angleOverlayGroup);
        const sz = 36;
        L.marker(midPos, {
          icon: L.divIcon({
            className: "",
            html: `<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:#fff;border:2px solid #cbd5e1;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#0f172a;white-space:nowrap;pointer-events:none;box-shadow:0 1px 4px rgba(0,0,0,0.18);">${Math.round(normalizedAngle)}°</div>`,
            iconAnchor: [sz / 2, sz / 2],
          }),
          interactive: false, keyboard: false,
        }).addTo(angleOverlayGroup);
      };

      setTimeout(() => map.invalidateSize(), 100);
    },

    renderDial(containerId, currentAngle, isSector = false, sectorStart = 0, sectorEnd = 360) {
      const container = document.getElementById(containerId);
      if (!container) return;

      const size = 240;
      const center = size / 2;
      const radius = 95;

      // For sector: rotate so the gap is centered at the bottom (both radii point down)
      // For full circle: 0° = north (top), standard compass orientation
      let angleOffset = -90;
      if (isSector) {
        const sweep = sectorEnd - sectorStart;
        const gapMid = sectorEnd + (360 - sweep) / 2;
        angleOffset = 90 - gapMid;
      }
      const toRad = (deg) => (deg + angleOffset) * (Math.PI / 180);

      let svg = `<svg viewBox="0 0 ${size} ${size}" width="100%" height="100%" style="overflow: visible;">`;

      if (isSector) {
        const sweep = sectorEnd - sectorStart;
        const startRad = toRad(sectorStart);
        const endRad = toRad(sectorEnd);
        const sx = center + radius * Math.cos(startRad);
        const sy = center + radius * Math.sin(startRad);
        const ex = center + radius * Math.cos(endRad);
        const ey = center + radius * Math.sin(endRad);
        const largeArc = sweep > 180 ? 1 : 0;
        svg += `<path d="M ${center},${center} L ${sx},${sy} A ${radius},${radius} 0 ${largeArc} 1 ${ex},${ey} Z" fill="#1e40af" fill-opacity="0.9" />`;
        for (let i = sectorStart; i <= sectorEnd; i += 5) {
          const angleRad = toRad(i);
          const x1 = center + (radius + 3) * Math.cos(angleRad);
          const y1 = center + (radius + 3) * Math.sin(angleRad);
          const x2 = center + (radius - 5) * Math.cos(angleRad);
          const y2 = center + (radius - 5) * Math.sin(angleRad);
          svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#fff" stroke-width="1.5" stroke-opacity="0.75" />`;
        }
      } else {
        svg += `<circle cx="${center}" cy="${center}" r="${radius}" fill="#1e40af" fill-opacity="0.9" />`;
        for (let i = 0; i < 360; i += 5) {
          const angleRad = toRad(i);
          const x1 = center + (radius + 3) * Math.cos(angleRad);
          const y1 = center + (radius + 3) * Math.sin(angleRad);
          const x2 = center + (radius - 5) * Math.cos(angleRad);
          const y2 = center + (radius - 5) * Math.sin(angleRad);
          svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#fff" stroke-width="1.5" stroke-opacity="0.75" />`;
        }
      }

      const needleAngleRad = (currentAngle - 90) * (Math.PI / 180);
      const needleX = center + radius * Math.cos(needleAngleRad);
      const needleY = center + radius * Math.sin(needleAngleRad);
      svg += `<line x1="${center}" y1="${center}" x2="${needleX}" y2="${needleY}" stroke="rgba(0,0,0,0.7)" stroke-width="3"/><line x1="${center}" y1="${center}" x2="${needleX}" y2="${needleY}" stroke="#fff" stroke-width="2"/>`;
      svg += `<circle cx="${center}" cy="${center}" r="8" fill="#fff" />`;

      const tipInX = center + (radius - 12) * Math.cos(needleAngleRad);
      const tipInY = center + (radius - 12) * Math.sin(needleAngleRad);
      const leftAngle = needleAngleRad - (8 * Math.PI / 180);
      const rightAngle = needleAngleRad + (8 * Math.PI / 180);
      const lx = center + radius * Math.cos(leftAngle);
      const ly = center + radius * Math.sin(leftAngle);
      const rx = center + radius * Math.cos(rightAngle);
      const ry = center + radius * Math.sin(rightAngle);

      svg += `<polygon points="${tipInX},${tipInY} ${lx},${ly} ${rx},${ry}" fill="#fff" stroke="#334155" stroke-width="1" />`;
      svg += `</svg>`;
      container.innerHTML = svg;
    }
  };
  window.IcOpRouter.registerOpModal("legacy", OpModal);
})();
