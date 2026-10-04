(() => {
  "use strict";

  const root = document.getElementById("marketplace-owner-root");
  const context = window.HerdHarborMarketplaceContext;
  if (!root || !context?.client) return;

  const interactive = context.isAuthenticated && context.accountStatus === "active" && context.marketplaceAccessReady === true;
  const owner = interactive && context.role === "owner";

  root.innerHTML = `
    <section class="marketplace-owner-panel">
      <div class="marketplace-heading">
        <p class="eyebrow">HerdHarbor Marketplace</p>
        <h1>Marketplace</h1>
        <p>Browse animals for sale publicly. Sign in to message sellers, save favorites, create listings, and manage your Marketplace account.</p>
      </div>
      <nav class="marketplace-tabs" aria-label="Marketplace">
        <button class="marketplace-tab" type="button" data-marketplace-view="browse" aria-current="page">Browse</button>
        ${interactive ? '<button class="marketplace-tab" type="button" data-marketplace-view="listings">My Listings</button>' : ""}
        ${interactive ? '<button class="marketplace-tab" type="button" data-marketplace-view="profile">Seller Profile</button>' : ""}
        ${interactive ? '<a class="marketplace-tab marketplace-tab-link" href="/marketplace/messages/">Messages</a>' : ""}
        ${owner ? '<button class="marketplace-tab marketplace-tab-admin" type="button" data-marketplace-view="admin">Admin</button>' : ""}
        ${context.isAuthenticated
          ? '<a class="button button-secondary button-small" href="https://app.herdharbor.com/">Open HerdHarbor</a>'
          : '<a class="button button-small" href="/marketplace/account/?next=%2Fmarketplace%2F">Sign in / Create account</a>'}
      </nav>
    </section>
    <section id="marketplace-view-root" aria-live="polite"></section>
  `;

  const viewRoot = document.getElementById("marketplace-view-root");
  const buttons = [...root.querySelectorAll("[data-marketplace-view]")];
  let currentView = "";

  function setCurrent(view) {
    for (const button of buttons) {
      if (button.dataset.marketplaceView === view) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
  }

  function loadModule({ view, globalName, marker, src, failure }) {
    const mountIfCurrent = () => {
      if (currentView !== view) return;
      window[globalName]?.mount?.(viewRoot, context);
    };

    const globalApi = window[globalName];
    if (globalApi?.mount) {
      mountIfCurrent();
      return;
    }

    const selector = 'script[data-marketplace-module="' + marker + '"]';
    const existing = document.querySelector(selector);
    if (existing) {
      existing.addEventListener("load", mountIfCurrent, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.marketplaceModule = marker;
    script.addEventListener("load", mountIfCurrent, { once: true });
    script.addEventListener("error", () => {
      if (currentView !== view) return;
      viewRoot.innerHTML = '<div class="marketplace-notice error">' + failure + '</div>';
    }, { once: true });
    document.body.appendChild(script);
  }

  function loadBrowse() {
    loadModule({
      view: "browse",
      globalName: "HerdHarborMarketplaceBrowse",
      marker: "marketplaceBrowse",
      src: "./marketplace-browse.js?v=7",
      failure: "Marketplace Browse could not load."
    });
  }

  function loadListings() {
    if (!interactive) {
      window.location.assign("/marketplace/account/?next=" + encodeURIComponent("/marketplace/#my-listings"));
      return;
    }
    loadModule({
      view: "listings",
      globalName: "HerdHarborMarketplaceListings",
      marker: "marketplaceListings",
      src: "./marketplace-listings.js?v=7",
      failure: "Listing management could not load."
    });
  }

  function loadProfile() {
    if (!interactive) {
      window.location.assign("/marketplace/account/?next=" + encodeURIComponent("/marketplace/#seller-profile"));
      return;
    }
    loadModule({
      view: "profile",
      globalName: "HerdHarborMarketplaceProfile",
      marker: "marketplaceProfile",
      src: "./marketplace-profile.js?v=7",
      failure: "Seller Profile could not load."
    });
  }

  function loadAdmin() {
    if (!owner) {
      viewRoot.innerHTML = '<div class="marketplace-notice error">Marketplace administration is available only to the protected Owner account.</div>';
      return;
    }
    loadModule({
      view: "admin",
      globalName: "HerdHarborMarketplaceAdmin",
      marker: "marketplaceAdmin",
      src: "./marketplace-admin.js?v=7",
      failure: "Marketplace Admin could not load."
    });
  }

  function show(view) {
    currentView = view;
    setCurrent(view);
    if (view === "browse") loadBrowse();
    else if (view === "listings") loadListings();
    else if (view === "profile") loadProfile();
    else if (view === "admin") loadAdmin();
    else loadBrowse();
  }

  function viewFromLocation() {
    if (window.location.hash === "#my-listings" && interactive) return "listings";
    if (window.location.hash === "#seller-profile" && interactive) return "profile";
    if (window.location.hash === "#admin" && owner) return "admin";
    return "browse";
  }

  function urlForView(view) {
    const url = new URL(window.location.href);
    url.hash = view === "listings"
      ? "my-listings"
      : view === "profile"
        ? "seller-profile"
        : view === "admin"
          ? "admin"
          : "";
    return url.pathname + url.search + url.hash;
  }

  for (const button of buttons) {
    button.addEventListener("click", () => {
      const view = button.dataset.marketplaceView;
      history.pushState({ marketplaceView: view }, "", urlForView(view));
      show(view);
    });
  }

  window.addEventListener("popstate", () => show(viewFromLocation()));

  show(viewFromLocation());
})();
