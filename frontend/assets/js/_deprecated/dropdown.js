(function () {
  function closeAll() {
    document.querySelectorAll(".dropdown.is-open").forEach(d => d.classList.remove("is-open"));
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".dropdown__btn");
    const dd = e.target.closest(".dropdown");

    if (btn && dd) {
      const isOpen = dd.classList.contains("is-open");
      closeAll();
      if (!isOpen) dd.classList.add("is-open");
      return;
    }

    // clique fora
    if (!e.target.closest(".dropdown")) closeAll();
  });
})();
