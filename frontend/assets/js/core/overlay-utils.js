// assets/js/core/overlay-utils.js
// Helper de posicionamento de overlay compartilhado — existia com o
// mesmo corpo (3 linhas, função pura, só recebe o elemento overlay) em 7
// arquivos, cada um com um nome local diferente (positionBmbOverlay,
// positionMdnOverlay, positionOverlay, positionEditOverlay,
// positionLineStarOverlay). Cada call site continua chamando pelo nome
// que já usava — só a implementação virou uma referência compartilhada.
(function () {
  "use strict";

  // Alinha a borda esquerda do overlay com a área de conteúdo principal
  // (".main"), não cobrindo a sidebar.
  function positionOverlay(overlay) {
    const host = document.querySelector(".main");
    if (!host) return;
    overlay.style.left = Math.max(0, host.getBoundingClientRect().left) + "px";
  }

  window.IcOverlay = {
    positionOverlay,
  };
})();
