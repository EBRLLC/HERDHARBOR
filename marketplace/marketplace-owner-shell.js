(() => {
  "use strict";

  const root = document.getElementById("marketplace-owner-root");
  const context = window.HerdHarborMarketplaceContext;
  if (!root || !context?.client || context.role !== "owner") return;

  root.innerHTML = `
    <section class="marketplace-owner-panel">
      <span class="marketplace-preview-badge">Owner Preview</span>
      <div class="marketplace-heading">
        <p class="eyebrow">HerdHarbor Marketplace</p>
        <h1>Marketplace</h1>
        <p>Browse animals, manage listings, and build a seller profile from one clean HerdHarbor marketplace destination.</p>
      </div>
      <nav class="marketplace-tabs" aria-label="Marketplace">
        <button class="marketplace-tab" type="button" data-marketplace-view="browse" aria-current="page">Browse</button>
        <button class="marketplace-tab" type="button" data-marketplace-view="listings">My Listings</button>
        <button class="marketplace-tab" type="button" data-marketplace-view="profile">Seller Profile</button>
        <a class="button button-secondary button-small" href="https://app.herdharbor.com/">Open HerdHarbor</a>
      </nav>
    </section>
    <section id="marketplace-view-root" aria-live="polite"></section>
  `;

  const viewRoot = document.getElementById("marketplace-view-root");
  const buttons = [...root.querySelectorAll("[data-marketplace-view]")];

  function setCurrent(view) {
    for (const button of buttons) {
      if (button.dataset.marketplaceView === view) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
  }

  function renderPlaceholder(view) {
    const copy = view === "listings"
      ? ["My Listings", "Listing management activates in Stack C3 after the detached listing and herd-import APIs are verified."]
      : ["Browse", "The image-led search and discovery experience activates in Stack C4 after the privacy-safe browse APIs are verified."];
    viewRoot.innerHTML = `
      <section class="marketplace-placeholder-grid">
        <article class="marketplace-placeholder-card">
          <h2>${copy[0]}</h2>
          <p>${copy[1]}</p>
        </article>
      </section>
    `;
  }

  function loadListings() {
    if (window.HerdHarborMarketplaceListings?.mount) {
      window.HerdHarborMarketplaceListings.mount(viewRoot, context);
      return;
    }

    const existing = document.querySelector("script[data-marketplace-listings]");
    if (existing) return;

    const script = document.createElement("script");
    script.src = "./marketplace-listings.js?v=1";
    script.async = true;
    script.dataset.marketplaceListings = "true";
    script.addEventListener("load", () => window.HerdHarborMarketplaceListings?.mount?.(viewRoot, context), { once: true });
    script.addEventListener("error", () => {
      viewRoot.innerHTML = '<div class="marketplace-notice error">Listing management could not load.</div>';
    }, { once: true });
    document.body.appendChild(script);
  }

  function loadProfile() {
    if (window.HerdHarborMarketplaceProfile?.mount) {
      window.HerdHarborMarketplaceProfile.mount(viewRoot, context);
      return;
    }

    const existing = document.querySelector("script[data-marketplace-profile]");
    if (existing) return;

    const script = document.createElement("script");
    script.src = "./marketplace-profile.js?v=1";
    script.async = true;
    script.dataset.marketplaceProfile = "true";
    script.addEventListener("load", () => window.HerdHarborMarketplaceProfile?.mount?.(viewRoot, context), { once: true });
    script.addEventListener("error", () => {
      viewRoot.innerHTML = '<div class="marketplace-notice error">Seller Profile could not load.</div>';
    }, { once: true });
    document.body.appendChild(script);
  }

  function show(view) {
    setCurrent(view);
    if (view === "profile") loadProfile();
    else if (view === "listings") loadListings();
    else renderPlaceholder(view);
  }

  for (const button of buttons) {
    button.addEventListener("click", () => show(button.dataset.marketplaceView));
  }

  show("browse");
  root.hidden = false;
})();
