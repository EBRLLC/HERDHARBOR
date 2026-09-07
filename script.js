(() => {
  "use strict";

  const navToggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".site-nav");

  function ensureSweepstakesLink() {
    if (!nav || nav.querySelector('a[href="/sweepstakes/"]')) return;
    const link = document.createElement("a");
    link.href = "/sweepstakes/";
    link.textContent = "Sweepstakes";

    const howTo = nav.querySelector('a[href="/how-to/"]');
    const faq = nav.querySelector('a[href="#faq"]');
    const appButton = nav.querySelector(".button");

    if (howTo?.nextSibling) nav.insertBefore(link, howTo.nextSibling);
    else if (faq) nav.insertBefore(link, faq);
    else if (appButton) nav.insertBefore(link, appButton);
    else nav.appendChild(link);
  }

  ensureSweepstakesLink();

  if (navToggle && nav) {
    navToggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", String(open));
    });

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        nav.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
