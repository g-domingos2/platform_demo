/**
 * Leaflet adapter for heatmap.js v2
 * Wraps h337 (heatmap.js) as a proper L.Layer
 */
(function () {
  "use strict";

  if (typeof L === "undefined" || typeof h337 === "undefined") return;

  L.HeatmapOverlay = L.Layer.extend({

    initialize: function (cfg) {
      this.cfg = cfg || {};
      this._el = null;
      this._heatmap = null;
      this._data = { max: 1, min: 0, data: [] };
    },

    onAdd: function (map) {
      this._map = map;
      // Use explicit pixel dimensions so h337.create reads the correct size
      // via getComputedStyle (if width:100%, it gets "100%" not a px value → canvas = 0)
      const size = map.getSize();
      this._el = document.createElement("div");
      this._el.style.cssText = [
        "position:absolute",
        "top:0", "left:0",
        "width:"  + size.x + "px",
        "height:" + size.y + "px",
        "pointer-events:none",
        "z-index:400",
      ].join(";");
      map.getPanes().overlayPane.appendChild(this._el);

      this._heatmap = h337.create(Object.assign({
        container: this._el
      }, this.cfg));

      map.on("moveend zoomend resize", this._redraw, this);
      this._redraw();
      return this;
    },

    onRemove: function (map) {
      map.off("moveend zoomend resize", this._redraw, this);
      if (this._el && this._el.parentNode) {
        this._el.parentNode.removeChild(this._el);
      }
      this._el = null;
      this._heatmap = null;
    },

    setData: function (data) {
      this._data = data;
      if (this._heatmap) this._redraw();
      return this;
    },

    _redraw: function () {
      if (!this._map || !this._heatmap || !this._el) return;

      const size = this._map.getSize();

      // Keep container in sync with map size
      this._el.style.width  = size.x + "px";
      this._el.style.height = size.y + "px";

      // Update heatmap.js internal canvas dimensions (configure re-renders on its own,
      // but setData below will do the real render with correct coordinates)
      this._heatmap.configure({ width: size.x, height: size.y });

      const topLeft = this._map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(this._el, topLeft);

      const mapped = (this._data.data || []).map(p => {
        const pt = this._map.latLngToContainerPoint(L.latLng(p.lat, p.lng));
        return { x: Math.round(pt.x), y: Math.round(pt.y), value: p.value };
      });

      this._heatmap.setData({
        min: this._data.min || 0,
        max: this._data.max || 1,
        data: mapped
      });
    }
  });

  L.heatmapOverlay = function (cfg) {
    return new L.HeatmapOverlay(cfg);
  };

})();
