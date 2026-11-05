// assets/js/pages/pluviometria/feature.maintenance.js
(function () {
  "use strict";

  const Plv = (window.Plv = window.Plv || {});
  const data = (Plv.data = Plv.data || {});
  const state = (Plv.state = Plv.state || {});
  const maintenance = (Plv.maintenance = Plv.maintenance || {});

  function getMaintenanceBadge(item) {
    const status = String(item.status || "").toLowerCase();
    const daysRemaining = Number(item.daysRemaining);
    const hasDays = Number.isFinite(daysRemaining);
    const deviceConfirmed = item.device_confirmed;
    const requiresDeviceConfirmation = item.requires_device_confirmation;
    const completionAllowedWithoutDevice = item.allow_completion_without_device;

    if (status === "late" || status === "overdue") {
      return { label: "Atrasada", variant: "danger" };
    }

    if (!deviceConfirmed && requiresDeviceConfirmation) {
      if (hasDays && daysRemaining > 0) {
        return { label: "Programada", variant: "info" };
      }
      return { label: "Atrasada", variant: "danger" };
    }

    const hasCompleted =
      deviceConfirmed ||
      Boolean(item.completed_at) ||
      completionAllowedWithoutDevice;
    if (hasCompleted) {
      return { label: "Concluída", variant: "ok" };
    }

    if (status === "scheduled") {
      return { label: "Programada", variant: "info" };
    }

    return { label: "Pendente", variant: "muted" };
  }

  function renderMaintenanceCards() {
    const host = document.querySelector("[data-maint-list]");
    if (!host) return;

    const formatDateBR = (Plv.dom && Plv.dom.formatDateBR) || ((d) => {
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yy = d.getFullYear();
      return `${dd}/${mm}/${yy}`;
    });

    const pickDateLabel = (...candidates) => {
      for (const candidate of candidates) {
        if (!candidate) continue;
        if (candidate instanceof Date && !Number.isNaN(candidate.getTime())) {
          return formatDateBR(candidate);
        }
        if (typeof candidate === "string") {
          const match = candidate.match(/\b\d{2}\/\d{2}\/\d{4}\b/);
          if (match) return match[0];
          const parsed = new Date(candidate);
          if (!Number.isNaN(parsed.getTime())) {
            return formatDateBR(parsed);
          }
        }
      }
      return "";
    };

    const entries = Object.entries(data.PLUV_MAINTENANCE || {})
      .map(([id, dataItem]) => {
        const pluvio = (data.PLUVIOS || []).find((p) => p.id === id);
        if (!pluvio) return null;
        const rawName = pluvio.nome || pluvio.sub || id;
        const shortName = /^Pluviômetro\s*/i.test(rawName)
          ? rawName
          : `Pluviômetro ${rawName}`;
        const hasCompleted =
          dataItem.device_confirmed ||
          Boolean(dataItem.completed_at) ||
          dataItem.allow_completion_without_device;
        const metaParts = [];
        const isLate = String(dataItem.status || "").toLowerCase() === "late";
        if (hasCompleted) {
          const doneDate = pickDateLabel(
            dataItem.completed_at,
            dataItem.lastDate,
            dataItem.meta
          );
          if (doneDate) metaParts.push(`Concluída em ${doneDate}`);
          if (dataItem.meta) metaParts.push(dataItem.meta);
        } else if (isLate) {
          if (dataItem.meta) {
            metaParts.push(dataItem.meta);
          } else if (typeof dataItem.daysRemaining === "number") {
            const atraso = Math.abs(Number(dataItem.daysRemaining));
            metaParts.push(`${atraso} dia${atraso === 1 ? "" : "s"} atrasado`);
          }
        } else {
          if (dataItem.meta) metaParts.push(dataItem.meta);
          else if (dataItem.lastDate) metaParts.push(dataItem.lastDate);
        }
        if (!hasCompleted && !isLate && typeof dataItem.daysRemaining === "number") {
          const days = Math.abs(Number(dataItem.daysRemaining));
          let label = "";
          if (dataItem.daysRemaining === 0) {
            label = "Hoje";
          } else if (dataItem.daysRemaining < 0) {
            label = `${days} dia${days === 1 ? "" : "s"} atrás`;
          } else {
            label = `${days} dia${days === 1 ? "" : "s"} restantes`;
          }
          if (label) metaParts.push(label);
        }
        const meta = metaParts.filter(Boolean).join(" • ");
        const isOverdue = String(dataItem.status).toLowerCase() === "late";
        const confirmText = dataItem.confirmTitle || "Sem confirmação";
        const confirmed = /confirmado/i.test(confirmText);
        const expectedLabel = dataItem.expected || "Preventiva";
        const tagClass = dataItem.tagClass || expectedLabel.toLowerCase();
        const description = dataItem.description || dataItem.confirmHint || "";
        const status = dataItem.status || "ok";
        const statusLabel =
          status === "late"
            ? "Atrasada"
            : status === "pending"
              ? "Pendente"
              : "Concluída";
        const statusTone =
          status === "late"
            ? "danger"
            : status === "pending"
              ? "muted"
              : "ok";

        return {
          id,
          shortName,
          meta,
          description,
          confirmText,
          confirmed,
          expectedLabel,
          tagClass,
          responsible: dataItem.responsible,
          status,
          statusTone,
          isOverdue,
          badgeOverride: dataItem.badge_override,
          deviceConfirmed: dataItem.device_confirmed,
          requiresDeviceConfirmation: dataItem.requires_device_confirmation,
          completedAt: dataItem.completed_at,
          allowCompletionWithoutDevice: dataItem.allow_completion_without_device,
          daysRemaining: dataItem.daysRemaining,
        };
      })
      .filter(Boolean);

    const enrichedEntries = entries.map((entry) => {
      const badge = entry.badgeOverride || getMaintenanceBadge({
        status: entry.status,
        daysRemaining: entry.daysRemaining,
        device_confirmed: entry.deviceConfirmed,
        requires_device_confirmation: entry.requiresDeviceConfirmation,
        completed_at: entry.completedAt,
        allow_completion_without_device: entry.allowCompletionWithoutDevice,
      });
      return { ...entry, badge };
    });

    const sortPriority = (entry) => {
      if (entry.badge.variant === "danger") return 0; // atrasadas
      if (entry.badge.variant === "info") return 1; // programadas
      if (entry.badge.variant === "ok") return 3; // concluídas por último
      return 2;
    };

    const orderedEntries = [...enrichedEntries].sort((a, b) => sortPriority(a) - sortPriority(b));

    const displayEntries = orderedEntries.map((entry) => {
      const badge = entry.badge;
      const statusIcon =
        badge.variant === "danger"
          ? "triangle-exclamation"
          : badge.variant === "info"
            ? "calendar-check"
            : badge.variant === "warn"
              ? "circle-exclamation"
              : "circle-check";
      const pillTone =
        badge.variant === "ok"
          ? "pill--ok"
          : badge.variant === "danger"
            ? "pill--danger"
            : badge.variant === "info"
              ? "pill--info"
              : badge.variant === "warn"
                ? "pill--warn"
                : "pill--muted";
      const statusClass = `pluv-status pill ${pillTone} pluv-status--${badge.variant}`;
      const hasDays = Number.isFinite(entry.daysRemaining);
      const awaitingDue =
        entry.requiresDeviceConfirmation &&
        !entry.deviceConfirmed &&
        (!hasDays || entry.daysRemaining <= 0 || entry.status === "late");
      const confirmationState = awaitingDue
        ? "pending"
        : entry.deviceConfirmed
          ? "confirmed"
          : "";
      return {
        ...entry,
        badge,
        statusIcon,
        statusClass,
        confirmationState,
      };
    });

    host.innerHTML = displayEntries
      .map((entry) => {
        const awaiting = entry.confirmationState === "pending";
        return `
          <article class="pluv-maint__item card" data-status="${entry.status}" data-badge="${entry.badge.variant}" data-awaiting="${awaiting}" data-pluvio="${entry.id}" data-confirmation="${entry.confirmationState}">
            <div class="pluv-maint__head">
              <div class="pluv-maint__left">
                <span class="pluv-maint__title">${entry.shortName}</span>
              </div>
              <span class="${entry.statusClass}">
                <i class="fa-solid fa-${entry.statusIcon}"></i>
                ${entry.badge.label}
              </span>
            </div>
            <div class="pluv-maint__meta">
              ${entry.meta
            ? `<span><i class="fa-regular fa-calendar"></i> ${entry.meta}</span>`
            : ""
          }
              ${entry.badge.variant === "ok" && entry.responsible
            ? `<span><i class="fa-solid fa-user"></i> ${entry.responsible}</span>`
            : ""
          }
            </div>
            
          </article>
        `;
      })
      .join("");

    const concludedCount = displayEntries.filter((entry) => entry.badge.variant === "ok").length;
    const overdueCount = displayEntries.filter((entry) => entry.badge.variant === "danger").length;
    const scheduledCount = displayEntries.filter((entry) => entry.badge.variant === "info").length;
    const concludedBadge = document.querySelector("[data-maint-filter='concluded']");
    if (concludedBadge) {
      concludedBadge.textContent = `${concludedCount} ${concludedCount === 1 ? "concluída" : "concluídas"}`;
    }
    const overdueBadge = document.querySelector("[data-maint-filter='overdue']");
    if (overdueBadge) {
      overdueBadge.textContent = `${overdueCount} ${overdueCount === 1 ? "atrasada" : "atrasadas"}`;
    }
    const scheduledBadge = document.querySelector("[data-maint-filter='scheduled']");
    if (scheduledBadge) {
      const scheduledLabel =
        scheduledCount === 1 ? "programada" : "programadas";
      scheduledBadge.textContent = `${scheduledCount} ${scheduledLabel}`;
    }

    syncMaintFilterUI();
  }

  function bindMaintenanceCards() {
    const list = document.querySelector("[data-maint-list]");
    if (!list || list.dataset.maintenanceBound) return;
    list.dataset.maintenanceBound = "1";
    list.addEventListener("click", (event) => {
      const card = event.target.closest("[data-pluvio]");
      if (!card) return;
      const pluvioId = card.getAttribute("data-pluvio");
      if (!pluvioId) return;
      Plv.views?.edit?.setSettingsFocus?.(pluvioId);
      Plv.views?.edit?.showEditView?.({ openSection: "#pluvEditMaintenance" });
    });
  }

  function syncMaintFilterUI() {
    const badges = document.querySelectorAll("[data-maint-filter]");
    badges.forEach((badge) => {
      const value = badge.getAttribute("data-maint-filter");
      const isActive = value && state.maintFilter === value;
      badge.classList.toggle("is-active", isActive);
      badge.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    const items = document.querySelectorAll(".pluv-maint__item");
    items.forEach((item) => {
      const badge = item.getAttribute("data-badge");
      if (!state.maintFilter) {
        item.hidden = false;
        return;
      }

      if (state.maintFilter === "scheduled") {
        item.hidden = badge !== "info";
        return;
      }

      if (state.maintFilter === "concluded") {
        item.hidden = badge !== "ok";
        return;
      }

      if (state.maintFilter === "overdue") {
        item.hidden = badge !== "danger";
        return;
      }

      item.hidden = false;
    });
  }

  function setMaintFilter(value) {
    const next = state.maintFilter === value ? null : value;
    if (next === state.maintFilter) return;
    state.maintFilter = next;
    syncMaintFilterUI();
  }

  function bindMaintFilters() {
    const wrap = document.querySelector(".pluv-panel__badges");
    if (!wrap) return;
    if (!wrap.dataset.bound) {
      wrap.dataset.bound = "1";
      wrap.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-maint-filter]");
        if (!btn) return;
        const filter = btn.getAttribute("data-maint-filter");
        if (!filter) return;
        event.preventDefault();
        setMaintFilter(filter);
      });
    }
    syncMaintFilterUI();
  }

  function openMaintMenu(wrapper) {
    if (!wrapper) return;
    if (state.reminderMenuOpen) closeReminderMenu();
    if (state.responsibleMenuOpen) closeResponsibleMenu();
    if (state.maintMenuOpen && state.maintMenuOpen !== wrapper) closeMaintMenu();
    wrapper.classList.add("is-open");
    wrapper.querySelector("[data-maint-trigger]")?.setAttribute("aria-expanded", "true");
    state.maintMenuOpen = wrapper;
  }

  function closeMaintMenu() {
    if (!state.maintMenuOpen) return;
    state.maintMenuOpen.classList.remove("is-open");
    state.maintMenuOpen.querySelector("[data-maint-trigger]")?.setAttribute("aria-expanded", "false");
    state.maintMenuOpen = null;
  }

  function toggleMaintMenu(wrapper) {
    if (!wrapper) return;
    if (state.maintMenuOpen === wrapper) closeMaintMenu();
    else openMaintMenu(wrapper);
  }

  function openReminderMenu(wrapper) {
    if (!wrapper) return;
    if (state.maintMenuOpen) closeMaintMenu();
    if (state.responsibleMenuOpen) closeResponsibleMenu();
    if (state.reminderMenuOpen && state.reminderMenuOpen !== wrapper) closeReminderMenu();
    wrapper.classList.add("is-open");
    wrapper.querySelector("[data-reminder-trigger]")?.setAttribute("aria-expanded", "true");
    state.reminderMenuOpen = wrapper;
  }

  function closeReminderMenu() {
    if (!state.reminderMenuOpen) return;
    state.reminderMenuOpen.classList.remove("is-open");
    state.reminderMenuOpen.querySelector("[data-reminder-trigger]")?.setAttribute("aria-expanded", "false");
    state.reminderMenuOpen = null;
  }

  function toggleReminderMenu(wrapper) {
    if (!wrapper) return;
    if (state.reminderMenuOpen === wrapper) closeReminderMenu();
    else openReminderMenu(wrapper);
  }

  function openResponsibleMenu(wrapper) {
    if (!wrapper) return;
    if (state.maintMenuOpen) closeMaintMenu();
    if (state.reminderMenuOpen) closeReminderMenu();
    if (state.responsibleMenuOpen && state.responsibleMenuOpen !== wrapper) closeResponsibleMenu();
    wrapper.classList.add("is-open");
    wrapper.querySelector("[data-responsible-trigger]")?.setAttribute("aria-expanded", "true");
    state.responsibleMenuOpen = wrapper;
  }

  function closeResponsibleMenu() {
    if (!state.responsibleMenuOpen) return;
    state.responsibleMenuOpen.classList.remove("is-open");
    state.responsibleMenuOpen.querySelector("[data-responsible-trigger]")?.setAttribute("aria-expanded", "false");
    state.responsibleMenuOpen = null;
  }

  function toggleResponsibleMenu(wrapper) {
    if (!wrapper) return;
    if (state.responsibleMenuOpen === wrapper) closeResponsibleMenu();
    else openResponsibleMenu(wrapper);
  }

  function closeAllMaintMenus() {
    closeMaintMenu();
    closeReminderMenu();
    closeResponsibleMenu();
  }

  function bindMaintenanceUI() {
    if (document.body.dataset.pluvMaintBound) return;
    document.body.dataset.pluvMaintBound = "1";

    document.addEventListener("click", (e) => {
      // Toggle Frequência
      const maintTrigger = e.target.closest("[data-maint-trigger]");
      if (maintTrigger) {
        const wrap = maintTrigger.closest("[data-maint-frequency]");
        toggleMaintMenu(wrap);
        return;
      }

      // Toggle Lembrete
      const reminderTrigger = e.target.closest("[data-reminder-trigger]");
      if (reminderTrigger) {
        const wrap = reminderTrigger.closest("[data-reminder-select]");
        toggleReminderMenu(wrap);
        return;
      }

      // Toggle Responsável
      const responsibleTrigger = e.target.closest("[data-responsible-trigger]");
      if (responsibleTrigger) {
        const wrap = responsibleTrigger.closest("[data-responsible-select]");
        toggleResponsibleMenu(wrap);
        return;
      }

      // Option Frequência
      const freqOpt = e.target.closest("[data-frequency-option]");
      if (freqOpt) {
        const val = freqOpt.getAttribute("data-frequency-option");
        setMaintenanceFrequency(val);
        closeAllMaintMenus();
        return;
      }

      // Option Lembrete
      const remOpt = e.target.closest("[data-reminder-option]");
      if (remOpt) {
        const val = remOpt.getAttribute("data-reminder-option");
        setReminderDays(val);
        closeAllMaintMenus();
        return;
      }

      // Option Responsável
      const respOpt = e.target.closest("[data-responsible-option]");
      if (respOpt) {
        const val = respOpt.getAttribute("data-responsible-option");
        setMaintenanceResponsible(val);
        closeAllMaintMenus();
        return;
      }

      // Click outside
      if (!e.target.closest(".pluv-maint__select")) {
        closeAllMaintMenus();
      }
    });

    document.addEventListener("change", (e) => {
      const typeCheck = e.target.closest("[data-maint-type]");
      if (typeCheck) {
        const id = typeCheck.getAttribute("data-maint-type");
        if (!state.maintenanceState) return;
        if (typeCheck.checked) state.maintenanceState.selectedTypes.add(id);
        else state.maintenanceState.selectedTypes.delete(id);
        renderMaintenance();
        return;
      }
    });

    document.addEventListener("input", (e) => {
      const otherInput = e.target.closest("[data-maint-other]");
      if (otherInput) {
        if (!state.maintenanceState) return;
        state.maintenanceState.otherText = otherInput.value;
        syncMaintenanceSubmit();
      }
    });
  }

  function parseBrDate(value) {
    if (!value || typeof value !== "string") return null;
    const parts = value.split("/").map((v) => Number(v));
    if (parts.length !== 3) return null;
    const [day, month, year] = parts;
    if (!day || !month || !year) return null;
    return new Date(year, month - 1, day, 12, 0, 0);
  }

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  const COLOR_OK = [22, 163, 74];
  const COLOR_WARN = [245, 158, 11];
  const COLOR_DANGER = [239, 68, 68];

  function mixColor(a, b, t) {
    const ratio = clamp01(t);
    const r = Math.round(lerp(a[0], b[0], ratio));
    const g = Math.round(lerp(a[1], b[1], ratio));
    const bch = Math.round(lerp(a[2], b[2], ratio));
    return `rgb(${r}, ${g}, ${bch})`;
  }

  function calcMaintenanceTimeline(dataItem) {
    const lastPos = 1;
    const baseTodayPos = 50;
    const endPos = 99;
    const lastDate = parseBrDate(dataItem.lastDate);
    const nextDate = parseBrDate(dataItem.nextDate);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastDay = lastDate ? new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate()) : null;
    const nextDay = nextDate ? new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate()) : null;
    const dayMs = 24 * 60 * 60 * 1000;
    let isOverdue = false;
    let isDueToday = false;
    let daysValue = 0;
    let nextPos = endPos;
    let todayPos = baseTodayPos;
    let progress = 0;
    let overdueRatio = 0;

    if (lastDay && nextDay && nextDay > lastDay) {
      isDueToday = today.getTime() === nextDay.getTime();
      if (today > nextDay) {
        isOverdue = true;
        daysValue = Math.max(1, Math.ceil((today - nextDay) / dayMs));
        const overdueShift = Math.min(daysValue / 30, 1);
        overdueRatio = overdueShift;
        nextPos = baseTodayPos;
        todayPos = lerp(baseTodayPos, endPos, overdueShift);
      } else {
        progress = clamp01((today - lastDay) / (nextDay - lastDay));
        daysValue = Math.max(0, Math.ceil((nextDay - today) / dayMs));
        nextPos = lerp(endPos, baseTodayPos, progress);
        todayPos = baseTodayPos;
      }
    } else {
      const fallback = Number(dataItem.daysRemaining || 0);
      if (fallback < 0) {
        isOverdue = true;
        daysValue = Math.abs(fallback);
        overdueRatio = clamp01(daysValue / 30);
        nextPos = baseTodayPos;
        todayPos = lerp(baseTodayPos, endPos, overdueRatio);
      } else {
        daysValue = fallback;
        progress = clamp01(1 - (daysValue / 30));
        todayPos = baseTodayPos;
      }
      isDueToday = !isOverdue && daysValue === 0;
      nextPos = isOverdue ? baseTodayPos : endPos;
    }

    const isWarn = dataItem.status === "warn" && !isOverdue;
    return {
      lastPos,
      todayPos,
      endPos,
      nextPos,
      isOverdue,
      isWarn,
      isDueToday,
      progress,
      overdueRatio,
      daysValue,
    };
  }

  function applyMaintTimelineState(stateItem) {
    if (!document.body.classList.contains("is-pluviometria-edit")) return;
    const timeline = document.querySelector(".maint__timeline");
    if (!timeline) return;

    timeline.style.setProperty("--maint-today", `${stateItem.todayPos}%`);
    timeline.style.setProperty("--maint-next", `${stateItem.nextPos}%`);

    timeline.classList.toggle("is-overdue", stateItem.isOverdue);
    timeline.classList.toggle("is-warn", stateItem.isWarn);

    const doneEnd = mixColor(COLOR_OK, COLOR_WARN, stateItem.progress || 0);
    const overdueRatio = clamp01(stateItem.overdueRatio || 0);
    const overdueSplit = Math.round(lerp(60, 35, overdueRatio));
    timeline.style.setProperty("--maint-done-gradient", `linear-gradient(90deg, ${mixColor(COLOR_OK, COLOR_OK, 0)} 0%, ${doneEnd} 100%)`);
    timeline.style.setProperty(
      "--maint-overdue-gradient",
      `linear-gradient(90deg, #f59e0b 0%, #f59e0b ${overdueSplit}%, #ef4444 100%)`
    );

    const summary = document.querySelector("[data-maint-summary]");
    const awaiting = state.maintenanceState.awaiting;
    const showAwaiting = awaiting && (stateItem.isOverdue || stateItem.isDueToday);
    if (summary) {
      if (stateItem.isOverdue) {
        summary.innerHTML = `<span class="maint__summary-pill maint__summary-pill--danger">Atraso</span>`;
      } else {
        summary.innerHTML = `<span class="maint__summary-pill maint__summary-pill--ok">Em dia</span>`;
      }
    }
  }

  function startMaintTimelineTicker() {
    if (!document.body.classList.contains("is-pluviometria-edit")) return;
    if (state.maintTicker) clearInterval(state.maintTicker);
    const prefersReduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const interval = prefersReduce ? 60000 : 1000;
    state.maintTicker = setInterval(() => {
      const p = Plv.views?.edit?.getFocusPluvio?.();
      if (!p) return;
      const dataItem = (data.PLUV_MAINTENANCE || {})[p.id] || (data.PLUV_MAINTENANCE || {})["norte-a"];
      if (!dataItem) return;
      const timelineState = calcMaintenanceTimeline(dataItem);
      applyMaintTimelineState(timelineState);
    }, interval);
  }

  function stopMaintTimelineTicker() {
    if (state.maintTicker) {
      clearInterval(state.maintTicker);
      state.maintTicker = null;
    }
  }

  function setMaintenanceFrequency(value) {
    if (!value) return;
    const p = Plv.views?.edit?.getFocusPluvio?.();
    if (!p) return;
    const dataItem = (data.PLUV_MAINTENANCE || {})[p.id];
    if (!dataItem) return;
    dataItem.frequency = value;
    renderMaintenance();
  }

  function setReminderDays(value) {
    if (!value) return;
    const p = Plv.views?.edit?.getFocusPluvio?.();
    if (!p) return;
    const dataItem = (data.PLUV_MAINTENANCE || {})[p.id];
    if (!dataItem) return;
    dataItem.reminderDays = value;
    renderMaintenance();
  }

  function toggleReminderEnabled() {
    const p = Plv.views?.edit?.getFocusPluvio?.();
    if (!p) return;
    const dataItem = (data.PLUV_MAINTENANCE || {})[p.id];
    if (!dataItem) return;
    dataItem.reminderEnabled = !dataItem.reminderEnabled;
    renderMaintenance();
  }

  function formatReminderLabel(day) {
    const value = Number(day);
    if (Number.isNaN(value) || value <= 0) return "Sem lembrete";
    return value === 1 ? "1 dia antes" : `${value} dias antes`;
  }

  function formatResponsibleLabel(value) {
    return String(value || "").trim() || "Nenhum";
  }

  function getResponsibleOptions(current) {
    const list = ["", ...(data.MAINT_RESPONSIBLES || [])];
    if (current && !list.includes(current)) {
      list.splice(1, 0, current);
    }
    return list;
  }

  function setMaintenanceResponsible(value) {
    const p = Plv.views?.edit?.getFocusPluvio?.();
    if (!p) return;
    const dataItem = (data.PLUV_MAINTENANCE || {})[p.id];
    if (!dataItem) return;
    dataItem.responsible = String(value || "").trim();
    renderMaintenance();
  }

  function isMaintenanceOtherSelected() {
    return state.maintenanceState.selectedTypes.has("other");
  }

  function isMaintenanceFormValid() {
    if (state.maintenanceState.selectedTypes.size === 0) return false;
    if (isMaintenanceOtherSelected()) {
      return state.maintenanceState.otherText.trim().length > 0;
    }
    return true;
  }

  function syncMaintenanceSubmit() {
    const submit = document.querySelector("[data-maint-submit]");
    if (!submit) return;
    const isValid = isMaintenanceFormValid();
    submit.disabled = !isValid;
    submit.classList.toggle("is-disabled", !isValid);
  }

  function renderMaintenanceHistory() {
    const card = document.querySelector(".edit-panel__maintenance-history-card");
    if (!card) return;

    const items = (data.MAINTENANCE_HISTORY || []).map((entry) => {
      const tone = entry.status === "warn" ? "warn" : "ok";
      const icon = tone === "warn" ? "triangle-exclamation" : "check";
      return `
        <li class="maint-history__item">
          <div class="maint-history__top">
            <span class="maint-history__date">${entry.date}</span>
            <span class="maint__pill maint__pill--${tone}">
              <i class="fa-solid fa-${icon}"></i>
              ${entry.statusLabel}
            </span>
          </div>
          <div class="maint-history__meta">
            <span><span>Tipo realizado:</span> ${entry.type}</span>
            <span><span>Responsável:</span> ${formatResponsibleLabel(entry.responsible)}</span>
          </div>
        </li>
      `;
    }).join("");

    card.classList.add("maint-history");
    card.innerHTML = `
      <div class="maint-history__head">
        <div class="maint-history__title">
          <span class="maint-history__icon"><i class="fa-regular fa-file-lines"></i></span>
          <span>Histórico de manutenções</span>
        </div>
        <button class="maint-history__link" type="button">
          <i class="fa-regular fa-hand-point-right"></i>
          Ver histórico completo
        </button>
      </div>
      <ul class="maint-history__list">
        ${items}
      </ul>
    `;
  }

  function renderMaintenance() {
    const host = document.querySelector('[data-section-body="maintenance"]');
    if (!host) return;

    const p = Plv.views?.edit?.getFocusPluvio?.();
    const dataItem = (p && (data.PLUV_MAINTENANCE || {})[p.id]) || (data.PLUV_MAINTENANCE || {})["norte-a"];
    if (!dataItem) return;

    const timelineState = calcMaintenanceTimeline(dataItem);
    const isOverdue = timelineState.isOverdue || dataItem.status === "late";
    const statusTone = isOverdue ? "danger" : "ok";
    const statusLabel = isOverdue ? "Atraso" : "Em dia";
    const daysLabel = isOverdue
      ? `Atrasado há ${timelineState.daysValue} dias`
      : `${timelineState.daysValue} dias restantes`;
    const timelineVars = `--maint-today:${timelineState.todayPos}%; --maint-next:${timelineState.nextPos}%;`;
    const nextTone = timelineState.isOverdue
      ? "is-overdue"
      : (timelineState.isDueToday || timelineState.daysValue <= 3 ? "is-warn" : "");
    const menuOptions = (data.MAINT_FREQUENCIES || []).map((opt) => {
      const active = opt === dataItem.frequency;
      return `
        <button class="pluv-maint__option maint__option ${active ? "is-active" : ""}"
                type="button"
                role="option"
                data-frequency-option="${opt}">
          <span>${opt}</span>
          ${active ? '<i class="fa-solid fa-check"></i>' : ""}
        </button>
      `;
    }).join("");

    const reminderOptions = (data.REMINDER_DAYS || []).map((day) => {
      const active = Number(day) === Number(dataItem.reminderDays);
      return `
        <button class="pluv-maint__option maint__option ${active ? "is-active" : ""}"
                type="button"
                role="option"
                data-reminder-option="${day}">
          <span>${formatReminderLabel(day)}</span>
          ${active ? '<i class="fa-solid fa-check"></i>' : ""}
        </button>
      `;
    }).join("");

    const responsibleOptions = getResponsibleOptions(dataItem.responsible).map((name) => {
      const active = String(name || "") === String(dataItem.responsible || "");
      return `
        <button class="pluv-maint__option maint__option ${active ? "is-active" : ""}"
                type="button"
                role="option"
                data-responsible-option="${name}">
          <span>${formatResponsibleLabel(name)}</span>
          ${active ? '<i class="fa-solid fa-check"></i>' : ""}
        </button>
      `;
    }).join("");

    const awaiting = state.maintenanceState.awaiting;
    const reminderLabel = formatReminderLabel(dataItem.reminderDays);
    const showAwaitingAlert = awaiting && (timelineState.isOverdue || timelineState.isDueToday);
    const daysValue = timelineState.daysValue;
    const okSub = daysValue === 0
      ? "Próxima manutenção hoje"
      : (daysValue === 1 ? "Próxima manutenção em 1 dia" : `Próxima manutenção em ${daysValue} dias`);
    const overdueTitle = daysValue === 1
      ? "Manutenção em atraso há 1 dia"
      : `Manutenção em atraso há ${daysValue} dias`;
    const nextLabelTitle = isOverdue ? "Manutenção em atraso desde" : "Próxima manutenção";
    const nextLabelDate = dataItem.nextDate;
    const typeMarkup = (data.MAINTENANCE_TYPES || []).map((item) => {
      const selected = state.maintenanceState.selectedTypes.has(item.id);
      return `
        <label class="maint-type ${selected ? "is-selected" : ""}">
          <input type="checkbox" name="maint_type_${item.id}" data-maint-type="${item.id}" ${selected ? "checked" : ""} />
          <span class="maint-type__check">
            <i class="fa-solid fa-check"></i>
          </span>
          <span class="maint-type__label">${item.label}</span>
        </label>
      `;
    }).join("");
    const showOtherField = isMaintenanceOtherSelected();
    const otherField = showOtherField
      ? `
        <div class="maint-form__field">
          <label for="pluvMaintOtherInput">Especifique o tipo de manutenção <span class="maint__req">*</span></label>
          <input
            id="pluvMaintOtherInput"
            class="maint__input"
            type="text"
            value="${state.maintenanceState.otherText}"
            placeholder="Descreva o tipo de manutenção realizada..."
            data-maint-other
          />
        </div>
      `
      : "";

    state.maintMenuOpen = null;
    state.reminderMenuOpen = null;
    state.responsibleMenuOpen = null;
    host.innerHTML = `
      <div class="maint">
        <div class="maint__header">
          <div class="maint__title">Manutenção</div>
          <span class="maint__summary" data-maint-summary>${statusLabel}</span>
        </div>

        <div class="maint__timeline" style="${timelineVars}">
          <div class="maint__track">
            <span class="maint__line maint__line--base"></span>
            <span class="maint__line maint__line--ok"></span>
            <span class="maint__marker maint__marker--last"></span>
            <span class="maint__marker maint__marker--today"></span>
            <span class="maint__marker maint__marker--next ${nextTone}"></span>
          </div>
          <div class="maint__labels">
            <span class="maint__label maint__label--last">
              <span class="maint__label-title">Última manutenção</span>
              <span class="maint__label-date">${dataItem.lastDate}</span>
            </span>
            <span class="maint__label maint__label--today">
              <span class="maint__label-title">Hoje</span>
            </span>
            <span class="maint__label maint__label--next">
              <span class="maint__label-title">${nextLabelTitle}</span>
              <span class="maint__label-date">${nextLabelDate}</span>
            </span>
          </div>
        </div>

        ${isOverdue
        ? `
              <div class="maint__alert maint__alert--danger">
                <span class="maint__alert-ico"><i class="fa-solid fa-triangle-exclamation"></i></span>
                <div>
                  <div class="maint__alert-title">${overdueTitle}</div>
                  <div class="maint__alert-sub">Ação imediata necessária</div>
                </div>
              </div>
            `
        : ""
      }
        ${!isOverdue
        ? `
              <div class="maint__alert maint__alert--ok">
                <span class="maint__alert-ico"><i class="fa-solid fa-check"></i></span>
                <div>
                  <div class="maint__alert-title">Em dia</div>
                  <div class="maint__alert-sub">${okSub}</div>
                </div>
              </div>
            `
        : ""
      }

        <div class="maint-config">
          <div class="maint-config__head">
            <i class="fa-regular fa-calendar-check"></i>
            <span>Configuração de manutenção</span>
          </div>
          <div class="maint-config__grid">
            <div class="maint__field">
              <div class="maint__field-label">Frequência de manutenção</div>
              <div class="pluv-maint__select maint__select" data-maint-frequency>
                <button class="pluv-maint__input pluv-maint__input--select maint__input" type="button" data-maint-trigger aria-expanded="false">
                  <span>${dataItem.frequency}</span>
                  <i class="fa-solid fa-chevron-down"></i>
                </button>
                <div class="pluv-maint__menu maint__menu" role="listbox" aria-label="Frequência de manutenção">
                  ${menuOptions}
                </div>
              </div>
            </div>
            <div class="maint__field">
              <div class="maint__field-label"><i class="fa-regular fa-bell"></i> Lembrete</div>
              <div class="pluv-maint__select maint__select" data-reminder-select>
                <button class="pluv-maint__input pluv-maint__input--select maint__input" type="button" data-reminder-trigger aria-expanded="false">
                  <span>${reminderLabel}</span>
                  <i class="fa-solid fa-chevron-down"></i>
                </button>
                <div class="pluv-maint__menu maint__menu" role="listbox" aria-label="Lembrete">
                  ${reminderOptions}
                </div>
              </div>
            </div>
            <div class="maint__field">
              <div class="maint__field-label"><i class="fa-solid fa-user"></i> Responsável padrão</div>
              <div class="pluv-maint__select maint__select" data-responsible-select>
                <button class="pluv-maint__input pluv-maint__input--select maint__input" type="button" data-responsible-trigger aria-expanded="false">
                  <span>${formatResponsibleLabel(dataItem.responsible)}</span>
                  <i class="fa-solid fa-chevron-down"></i>
                </button>
                <div class="pluv-maint__menu maint__menu" role="listbox" aria-label="Responsável padrão">
                  ${responsibleOptions}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    applyMaintTimelineState(timelineState);
    startMaintTimelineTicker();
    renderMaintenanceHistory();
    syncMaintenanceSubmit();
  }

  maintenance.getMaintenanceBadge = getMaintenanceBadge;
  maintenance.renderMaintenanceCards = renderMaintenanceCards;
  maintenance.bindMaintenanceCards = bindMaintenanceCards;
  maintenance.syncMaintFilterUI = syncMaintFilterUI;
  maintenance.setMaintFilter = setMaintFilter;
  maintenance.bindMaintFilters = bindMaintFilters;
  maintenance.openMaintMenu = openMaintMenu;
  maintenance.closeMaintMenu = closeMaintMenu;
  maintenance.toggleMaintMenu = toggleMaintMenu;
  maintenance.openReminderMenu = openReminderMenu;
  maintenance.closeReminderMenu = closeReminderMenu;
  maintenance.toggleReminderMenu = toggleReminderMenu;
  maintenance.openResponsibleMenu = openResponsibleMenu;
  maintenance.closeResponsibleMenu = closeResponsibleMenu;
  maintenance.toggleResponsibleMenu = toggleResponsibleMenu;
  maintenance.calcMaintenanceTimeline = calcMaintenanceTimeline;
  maintenance.applyMaintTimelineState = applyMaintTimelineState;
  maintenance.startMaintTimelineTicker = startMaintTimelineTicker;
  maintenance.stopMaintTimelineTicker = stopMaintTimelineTicker;
  maintenance.setMaintenanceFrequency = setMaintenanceFrequency;
  maintenance.setReminderDays = setReminderDays;
  maintenance.toggleReminderEnabled = toggleReminderEnabled;
  maintenance.formatReminderLabel = formatReminderLabel;
  maintenance.getResponsibleOptions = getResponsibleOptions;
  maintenance.setMaintenanceResponsible = setMaintenanceResponsible;
  maintenance.isMaintenanceOtherSelected = isMaintenanceOtherSelected;
  maintenance.isMaintenanceFormValid = isMaintenanceFormValid;
  maintenance.syncMaintenanceSubmit = syncMaintenanceSubmit;
  maintenance.renderMaintenanceHistory = renderMaintenanceHistory;
  maintenance.renderMaintenance = renderMaintenance;
  maintenance.bindMaintenanceUI = bindMaintenanceUI;

  // Initialize
  bindMaintenanceUI();
})();
