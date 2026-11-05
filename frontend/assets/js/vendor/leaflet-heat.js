/* leaflet-heat.js (lightweight) */
(function () {
  if (!window.L) return;

  const HeatLayer = L.Layer.extend({
    options: {
      minOpacity: 0.05,
      maxZoom: 18,
      radius: 25,
      blur: 15,
      max: 1.0,
      gradient: null,
      pane: 'overlayPane'
    },

    initialize: function (latlngs, options) {
      this._latlngs = latlngs || [];
      L.setOptions(this, options);
    },

    setLatLngs: function (latlngs) {
      this._latlngs = latlngs || [];
      this._redraw();
      return this;
    },

    addLatLng: function (latlng) {
      this._latlngs.push(latlng);
      this._redraw();
      return this;
    },

    setOptions: function (options) {
      L.setOptions(this, options);
      this._updateOptions();
      this._redraw();
      return this;
    },

    onAdd: function (map) {
      this._map = map;

      if (!this._canvas) {
        this._canvas = L.DomUtil.create('canvas', 'leaflet-heatmap-layer');
        this._canvas.style.position = 'absolute';
        this._canvas.style.top = '0';
        this._canvas.style.left = '0';
        this._canvas.style.pointerEvents = 'none';
        this._ctx = this._canvas.getContext('2d');
      }

      this._updateOptions();
      this._reset();

      map.on('moveend zoomend resize', this._reset, this);
    },

    onRemove: function (map) {
      map.off('moveend zoomend resize', this._reset, this);
      if (this._canvas && this._canvas.parentNode) {
        this._canvas.parentNode.removeChild(this._canvas);
      }
      this._map = null;
    },

    _reset: function () {
      if (!this._map) return;

      const size = this._map.getSize();
      if (this._canvas.width !== size.x) this._canvas.width = size.x;
      if (this._canvas.height !== size.y) this._canvas.height = size.y;

      const pane = this.getPane ? this.getPane() : this._map.getPane(this.options.pane || 'overlayPane');
      if (pane && this._canvas.parentNode !== pane) {
        pane.appendChild(this._canvas);
      }

      L.DomUtil.setPosition(this._canvas, L.point(0, 0));
      this._redraw();
    },

    _updateOptions: function () {
      this._circle = null;
      this._gradient = null;
    },

    _getCircle: function () {
      if (this._circle) return this._circle;

      const r = this.options.radius || 25;
      const blur = this.options.blur || 15;
      const size = (r + blur) * 2;
      const circle = document.createElement('canvas');
      circle.width = circle.height = size;

      const ctx = circle.getContext('2d');
      const center = size / 2;
      ctx.clearRect(0, 0, size, size);
      ctx.shadowBlur = blur;
      ctx.shadowColor = 'black';
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.beginPath();
      ctx.arc(center, center, r, 0, Math.PI * 2, false);
      ctx.closePath();
      ctx.fill();

      this._circle = circle;
      return circle;
    },

    _getGradient: function () {
      if (this._gradient) return this._gradient;

      const gradient = this.options.gradient || {
        0.0: '#dbeafe',
        0.35: '#93c5fd',
        0.65: '#3b82f6',
        1.0: '#1e3a8a'
      };

      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      const grad = ctx.createLinearGradient(0, 0, 0, 256);

      Object.keys(gradient).forEach((stop) => {
        grad.addColorStop(Number(stop), gradient[stop]);
      });

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1, 256);
      this._gradient = ctx.getImageData(0, 0, 1, 256).data;
      return this._gradient;
    },

    _redraw: function () {
      if (!this._map || !this._ctx) return;

      const ctx = this._ctx;
      const w = this._canvas.width;
      const h = this._canvas.height;
      ctx.clearRect(0, 0, w, h);

      if (!this._latlngs || this._latlngs.length === 0) return;

      const circle = this._getCircle();
      const r = circle.width / 2;
      const max = this.options.max || 1.0;
      const minOpacity = this.options.minOpacity || 0.05;

      if (!this._heatCanvas) this._heatCanvas = document.createElement('canvas');
      if (this._heatCanvas.width !== w) this._heatCanvas.width = w;
      if (this._heatCanvas.height !== h) this._heatCanvas.height = h;

      if (!this._heatCtx) this._heatCtx = this._heatCanvas.getContext('2d');
      const hctx = this._heatCtx;
      hctx.clearRect(0, 0, w, h);

      for (let i = 0; i < this._latlngs.length; i++) {
        const p = this._latlngs[i];
        const lat = Array.isArray(p) ? p[0] : p.lat;
        const lng = Array.isArray(p) ? p[1] : p.lng;
        const intensity = Array.isArray(p) ? p[2] : (p.intensity || 0);
        if (lat == null || lng == null) continue;

        const point = this._map.latLngToContainerPoint([lat, lng]);
        const alpha = Math.max(Math.min(intensity / max, 1), 0);
        if (alpha <= 0) continue;

        hctx.globalAlpha = Math.max(alpha, minOpacity);
        hctx.drawImage(circle, point.x - r, point.y - r);
      }

      const image = hctx.getImageData(0, 0, w, h);
      const data = image.data;
      const gradient = this._getGradient();

      for (let j = 0; j < data.length; j += 4) {
        const alpha = data[j + 3];
        if (!alpha) continue;
        const idx = Math.min(255, alpha) * 4;
        data[j] = gradient[idx];
        data[j + 1] = gradient[idx + 1];
        data[j + 2] = gradient[idx + 2];
        data[j + 3] = alpha;
      }

      ctx.putImageData(image, 0, 0);
    }
  });

  L.HeatLayer = HeatLayer;
  L.heatLayer = function (latlngs, options) {
    return new HeatLayer(latlngs, options);
  };
})();
