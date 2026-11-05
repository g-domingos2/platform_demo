// assets/js/core/op-router.js
// Router de variantes (legacy/dev) para op-modal e op-programacoes.
// Permite trocar qual motor está ativo em tempo real (Ctrl+D), sem reload,
// já que ambas variantes ficam carregadas simultaneamente na página.
(function () {
  "use strict";

  var VARIANTS = ["legacy", "dev"];

  var active = window.__icDevFeaturesOn ? "dev" : "legacy";

  // Marca a variante ativa no <html>. O CSS das duas variantes fica carregado
  // ao mesmo tempo e compartilha quase todos os seletores, então o dev precisa
  // ficar escopado sob este atributo — sem isso ele venceria o legacy por
  // ordem de carga e vazaria o visual novo mesmo com o Ctrl+D desligado.
  function syncDomVariant() {
    try {
      document.documentElement.setAttribute("data-op-variant", active);
    } catch (_) { }
  }
  syncDomVariant();

  var opModalImpl = { legacy: null, dev: null };
  var globalRegistry = {};

  function registerOpModal(variant, impl) {
    opModalImpl[variant] = impl;
  }

  function getOpModalRegistrant(variant) {
    if (!opModalImpl[variant]) opModalImpl[variant] = {};
    return opModalImpl[variant];
  }

  function registerGlobal(name, variant, fn) {
    if (!globalRegistry[name]) {
      globalRegistry[name] = { legacy: null, dev: null };
      window[name] = function () {
        var impl = globalRegistry[name][active];
        return impl ? impl.apply(null, arguments) : undefined;
      };
    }
    globalRegistry[name][variant] = fn;
  }

  var lastOpenArgs = null;

  function setActive(variant) {
    if (VARIANTS.indexOf(variant) === -1 || variant === active) return;
    active = variant;
    syncDomVariant();
    // O estado do Ctrl+D vale só para a sessão atual e não é persistido: a
    // página sempre volta com os recursos em desenvolvimento desligados
    // (ver o script de inicialização da flag no index.html).
    window.dispatchEvent(new CustomEvent("ic:dev-features-toggle", {
      detail: { on: variant === "dev", variant: variant }
    }));

    // Se o modal de operação estiver aberto no momento da troca, fecha e
    // reabre já com o motor novo (mesmos dados), pra não exigir fechar/abrir
    // manualmente depois do Ctrl+D.
    if (document.getElementById("opModalIrrigation") && lastOpenArgs) {
      document.getElementById("opModalIrrigation")?.remove();
      window.OpModal.open.apply(window.OpModal, lastOpenArgs);
    }
  }

  window.IcOpRouter = {
    get active() { return active; },
    registerOpModal: registerOpModal,
    getOpModalRegistrant: getOpModalRegistrant,
    registerGlobal: registerGlobal,
    setActive: setActive
  };

  window.OpModal = {
    open: function () {
      lastOpenArgs = arguments;
      var impl = opModalImpl[active];
      return impl && impl.open ? impl.open.apply(impl, arguments) : undefined;
    },
    openBulkSchedule: function () {
      var impl = opModalImpl[active];
      return impl && impl.openBulkSchedule ? impl.openBulkSchedule.apply(impl, arguments) : undefined;
    }
  };
})();
