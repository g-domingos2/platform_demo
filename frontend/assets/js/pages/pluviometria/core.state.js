// assets/js/pages/pluviometria/core.state.js
(function () {
  "use strict";

  const Plv = (window.Plv = window.Plv || {});
  const state = (Plv.state = Plv.state || {});

  state.selected = state.selected || new Set();
  state.layer = state.layer || null;

  state.pluvFilter = state.pluvFilter || "highlights";
  state.pluvSearch = state.pluvSearch || "";
  state.maintFilter = state.maintFilter || null;
  state.expanded = state.expanded || new Set();

  state.rainPeriod = state.rainPeriod || "24h";
  state.period = state.period || null;
  state.rainBound = state.rainBound || false;
  state.clampBound = state.clampBound || false;
  state.clampTimer = state.clampTimer || null;
  state.settingsBound = state.settingsBound || false;
  state.settingsFocusId = state.settingsFocusId || null;
  state.maintMenuOpen = state.maintMenuOpen || null;
  state.reminderMenuOpen = state.reminderMenuOpen || null;
  state.responsibleMenuOpen = state.responsibleMenuOpen || null;
  state.maintTicker = state.maintTicker || null;
  state.editMap = state.editMap || null;
  state.editMarker = state.editMarker || null;

  if (!state.maintenanceState) {
    state.maintenanceState = {
      awaiting: true,
      confirmedAt: null,
      selectedTypes: new Set(),
      otherText: "",
      notes: "",
      responsible: "Bauer Irricontrol",
    };
  } else if (!(state.maintenanceState.selectedTypes instanceof Set)) {
    state.maintenanceState.selectedTypes = new Set(state.maintenanceState.selectedTypes || []);
  }
})();
