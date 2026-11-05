// assets/js/pages/bombas/index.js
(function () {
  "use strict";

  const Bmb = (window.Bmb = window.Bmb || {});
  const views = (Bmb.views = Bmb.views || {});

  window.IcBombaDetails = {
    async open(options = {}) {
      await views?.details?.showDetailsView?.(options);
    },
    close() {
      views?.details?.destroyDetailsView?.();
    }
  };

  // Modal flutuante sobre o mapa — sem navegar para detalhes
  window.IcBombaModal = {
    open({ name = "Bomba", equipId, running = false } = {}) {
      const MODAL_ID = "icBombaFloatModal";
      if (document.getElementById(MODAL_ID)) return;

      const nowLocal = () => {
        const d = new Date(); d.setSeconds(0, 0);
        return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      };
      const addHours = (iso, h) => {
        const d = new Date(iso); d.setHours(d.getHours() + h);
        return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      };

      const now = nowLocal();

      // Injeta CSS uma única vez
      if (!document.getElementById("icBmbFloatStyles")) {
        const s = document.createElement("style");
        s.id = "icBmbFloatStyles";
        s.textContent = `
          #icBombaFloatModal { position:fixed;inset:0;z-index:23000;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px 16px; }
          #icBombaFloatModal .ic-bmb-backdrop { position:absolute;inset:0;background:rgba(15,23,42,.4);backdrop-filter:blur(3px); }
          #icBombaFloatModal .ic-bmb-dialog { position:relative;background:#fff;width:100%;max-width:400px;border-radius:12px;box-shadow:0 20px 40px -8px rgba(0,0,0,.2);display:flex;flex-direction:column;animation:icBmbUp .25s ease-out; }
          @keyframes icBmbUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
          #icBombaFloatModal .ic-bmb-header { padding:14px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f1f5f9; }
          #icBombaFloatModal .ic-bmb-title { margin:0;font-size:16px;font-weight:600;color:#0f172a; }
          #icBombaFloatModal .ic-bmb-subtitle { font-size:12px;color:#64748b;margin-left:8px; }
          #icBombaFloatModal .ic-bmb-close { background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;width:24px;height:24px;display:flex;align-items:center;justify-content:center; }
          #icBombaFloatModal .ic-bmb-close:hover { color:#475569; }
          #icBombaFloatModal .ic-bmb-content { padding:16px 20px;display:flex;flex-direction:column;gap:16px; }
          #icBombaFloatModal .ic-bmb-tabs { display:flex;gap:6px;background:#f1f5f9;border-radius:8px;padding:4px; }
          #icBombaFloatModal .ic-bmb-tab { flex:1;padding:7px 10px;border:none;background:transparent;border-radius:6px;font-size:13px;color:#64748b;cursor:pointer;font-weight:500;transition:all .15s;white-space:nowrap; }
          #icBombaFloatModal .ic-bmb-tab.is-active { background:#fff;color:#0f172a;box-shadow:0 1px 3px rgba(0,0,0,.1); }
          #icBombaFloatModal .ic-bmb-tab:hover:not(.is-active) { color:#0f172a; }
          #icBombaFloatModal .ic-bmb-fields { display:flex;flex-direction:column;gap:12px; }
          #icBombaFloatModal .ic-bmb-label { font-size:12px;color:#64748b;font-weight:500;margin-bottom:4px;display:block; }
          #icBombaFloatModal .ic-bmb-input-wrap { position:relative; }
          #icBombaFloatModal .ic-bmb-input { width:100%;height:34px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:0 36px 0 12px;font-size:13px;color:#0f172a;outline:none;box-sizing:border-box;cursor:pointer; }
          #icBombaFloatModal .ic-bmb-input:hover:not(:disabled) { border-color:#10b981; }
          #icBombaFloatModal .ic-bmb-input::-webkit-calendar-picker-indicator { display:none; }
          #icBombaFloatModal .ic-bmb-input:disabled { background:#f8fafc;color:#cbd5e1;cursor:not-allowed;border-color:#e2e8f0; }
          #icBombaFloatModal .ic-bmb-cal { position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:#94a3b8;cursor:pointer;padding:4px;line-height:1; }
          #icBombaFloatModal .ic-bmb-cal:hover { color:#10b981; }
          #icBombaFloatModal .ic-bmb-footer { padding:12px 20px;display:flex;justify-content:flex-end;gap:8px;border-top:1px solid #f1f5f9; }
          #icBombaFloatModal .ic-bmb-btn-cancel { background:#fff;color:#0f172a;border:1px solid #e2e8f0;padding:8px 18px;border-radius:8px;font-size:13px;cursor:pointer;transition:border-color .15s,color .15s; }
          #icBombaFloatModal .ic-bmb-btn-cancel:hover { border-color:#fca5a5;color:#dc2626; }
          #icBombaFloatModal .ic-bmb-btn-ok { background:#10b981;color:#fff;border:none;padding:8px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer; }
          #icBombaFloatModal .ic-bmb-btn-ok:hover { background:#059669; }
          #icBombaFloatModal .ic-bmb-btn-stop { display:inline-flex;align-items:center;gap:7px;background:#dc2626;color:#fff;border:1px solid #dc2626;padding:8px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer; }
          #icBombaFloatModal .ic-bmb-btn-stop:hover { background:#b91c1c;border-color:#b91c1c; }
          #icBombaFloatModal .ic-bmb-statusbar { padding:10px 20px 0;display:flex;justify-content:center; }
          #icBombaFloatModal .ic-bmb-status { display:inline-flex;align-items:center;gap:6px;background:#2563eb;color:#fff;font-size:11px;font-weight:700;letter-spacing:.3px;padding:4px 10px;border-radius:6px;text-transform:uppercase;white-space:nowrap; }

          [data-theme="dark"] #icBombaFloatModal .ic-bmb-dialog { background:#0a0a0a;box-shadow:0 20px 40px -8px rgba(0,0,0,.5); }
          [data-theme="dark"] #icBombaFloatModal .ic-bmb-header { border-bottom-color:rgba(255,255,255,.08); }
          [data-theme="dark"] #icBombaFloatModal .ic-bmb-title { color:#e2e8f0; }
          [data-theme="dark"] #icBombaFloatModal .ic-bmb-close { color:#475569; }
          [data-theme="dark"] #icBombaFloatModal .ic-bmb-close:hover { color:#94a3b8; }
          [data-theme="dark"] #icBombaFloatModal .ic-bmb-tabs { background:#141414; }
          [data-theme="dark"] #icBombaFloatModal .ic-bmb-tab { color:#5a6678; }
          [data-theme="dark"] #icBombaFloatModal .ic-bmb-tab.is-active { background:#0a0a0a;color:#10b981;box-shadow:0 1px 3px rgba(0,0,0,.4); }
          [data-theme="dark"] #icBombaFloatModal .ic-bmb-tab:hover:not(.is-active) { color:#10b981; }
          [data-theme="dark"] #icBombaFloatModal .ic-bmb-label { color:#64748b; }
          [data-theme="dark"] #icBombaFloatModal .ic-bmb-input { background:#141414;border-color:rgba(255,255,255,.12);color:#e2e8f0; }
          [data-theme="dark"] #icBombaFloatModal .ic-bmb-input:hover:not(:disabled) { border-color:#10b981; }
          [data-theme="dark"] #icBombaFloatModal .ic-bmb-input:disabled { background:#141414;color:#334155;border-color:rgba(255,255,255,.06); }
          [data-theme="dark"] #icBombaFloatModal .ic-bmb-cal { color:#475569; }
          [data-theme="dark"] #icBombaFloatModal .ic-bmb-cal:hover { color:#10b981; }
          [data-theme="dark"] #icBombaFloatModal .ic-bmb-footer { border-top-color:rgba(255,255,255,.08); }
          [data-theme="dark"] #icBombaFloatModal .ic-bmb-btn-cancel { background:#141414;color:#cbd5e1;border-color:rgba(255,255,255,.12); }
          [data-theme="dark"] #icBombaFloatModal .ic-bmb-btn-cancel:hover { border-color:#f87171;color:#f87171; }
          [data-theme="dark"] #icBombaFloatModal .ic-bmb-btn-ok { background:#10b981;border-color:#10b981;color:#fff; }
          [data-theme="dark"] #icBombaFloatModal .ic-bmb-btn-ok:hover { background:#059669;border-color:#059669; }
          [data-theme="dark"] #icBombaFloatModal .ic-bmb-btn-stop { background:#dc2626;border-color:#dc2626;color:#fff; }
          [data-theme="dark"] #icBombaFloatModal .ic-bmb-btn-stop:hover { background:#b91c1c;border-color:#b91c1c; }
          [data-theme="dark"] #icBombaFloatModal .ic-bmb-status { background:#1d4ed8; }
        `;
        document.head.appendChild(s);
      }

      const el = document.createElement("div");
      el.id = MODAL_ID;
      el.innerHTML = `
        <div class="ic-bmb-backdrop"></div>
        <div class="ic-bmb-dialog">
          <header class="ic-bmb-header">
            <h3 class="ic-bmb-title">${name}</h3>
            <div style="display:flex;align-items:center;gap:8px;">
              <button type="button" class="op-modal__details-btn" id="icBmbGoDetails">Detalhes</button>
              <button class="ic-bmb-close" id="icBmbClose" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>
            </div>
          </header>
          <div class="ic-bmb-content">
            <div class="ic-bmb-tabs">
              <button class="ic-bmb-tab is-active" data-mode="agora">Começar agora</button>
              <button class="ic-bmb-tab" data-mode="sem_parar">Sem parar</button>
              <button class="ic-bmb-tab" data-mode="intervalo">Intervalo</button>
            </div>
            <div class="ic-bmb-fields">
              <div>
                <label class="ic-bmb-label" for="icBmbStart">${running ? "Ligada em" : "Começar em"}</label>
                <div class="ic-bmb-input-wrap">
                  <input class="ic-bmb-input" type="datetime-local" id="icBmbStart" value="${now}" min="${now}" disabled />
                  <button class="ic-bmb-cal" type="button" data-for="icBmbStart"><i class="fa-regular fa-calendar"></i></button>
                </div>
              </div>
              <div>
                <label class="ic-bmb-label" for="icBmbEnd">Parar em</label>
                <div class="ic-bmb-input-wrap">
                  <input class="ic-bmb-input" type="datetime-local" id="icBmbEnd" value="${addHours(now, 1)}" min="${now}" disabled />
                  <button class="ic-bmb-cal" type="button" data-for="icBmbEnd"><i class="fa-regular fa-calendar"></i></button>
                </div>
              </div>
            </div>
          </div>
          <footer class="ic-bmb-footer">
            <button class="ic-bmb-btn-cancel" id="icBmbCancel">${running ? "Fechar" : "Cancelar"}</button>
            ${running
              ? `<button class="ic-bmb-btn-stop" id="icBmbStop"><i class="fa-regular fa-square"></i> Desligar Bomba</button>`
              : `<button class="ic-bmb-btn-ok" id="icBmbOk">OK</button>`}
          </footer>
        </div>
      `;

      document.body.appendChild(el);

      const close = () => el.remove();

      el.querySelector(".ic-bmb-backdrop").addEventListener("click", close);
      el.querySelector("#icBmbClose").addEventListener("click", close);
      el.querySelector("#icBmbCancel").addEventListener("click", close);

      el.querySelector("#icBmbGoDetails").addEventListener("click", () => {
        close();
        window.IcBombaDetails?.open({ BmbId: equipId, fromMap: true });
      });

      // Botões de calendário
      el.querySelectorAll(".ic-bmb-cal").forEach(btn => {
        btn.addEventListener("click", () => {
          const input = document.getElementById(btn.dataset.for);
          if (input && !input.disabled && typeof input.showPicker === "function") input.showPicker();
        });
      });

      // Tabs
      const applyMode = (mode) => {
        document.getElementById("icBmbStart").disabled = mode === "agora";
        document.getElementById("icBmbEnd").disabled = mode === "sem_parar";
      };

      el.querySelectorAll(".ic-bmb-tab").forEach(tab => {
        tab.addEventListener("click", () => {
          el.querySelectorAll(".ic-bmb-tab").forEach(t => t.classList.remove("is-active"));
          tab.classList.add("is-active");
          applyMode(tab.dataset.mode);
        });
      });

      applyMode("agora");

      document.getElementById("icBmbStart")?.addEventListener("change", (e) => {
        const end = document.getElementById("icBmbEnd");
        if (end && end.value <= e.target.value) end.value = addHours(e.target.value, 1);
        if (end) end.min = e.target.value;
      });

      el.querySelector("#icBmbOk")?.addEventListener("click", () => {
        const activeTab = el.querySelector(".ic-bmb-tab.is-active");
        const mode = activeTab?.dataset?.mode || "agora";
        const startDate = document.getElementById("icBmbStart")?.value || null;
        const endDate = document.getElementById("icBmbEnd")?.value || null;
        console.info("[bomba] ligar", { equipId, mode, startDate, endDate });
        window.IcSetBombaRunning?.(equipId, true);
        close();
      });

      el.querySelector("#icBmbStop")?.addEventListener("click", () => {
        console.info("[bomba] desligar", { equipId });
        window.IcSetBombaRunning?.(equipId, false);
        close();
      });
    }
  };
})();
