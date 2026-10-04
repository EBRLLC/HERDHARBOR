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
        <button class="marketplace-tab" type="button" aria-current="page">Browse</button>
        <button class="marketplace-tab" type="button">My Listings</button>
        <button class="marketplace-tab" type="button">Seller Profile</button>
        <a class="button button-secondary button-small" href="https://app.herdharbor.com/">Open HerdHarbor</a>
      </nav>
    </section>
    <section class="marketplace-placeholder-grid" aria-label="Private Marketplace preview">
      <article class="marketplace-placeholder-card">
        <h2>Browse</h2>
        <p>The secure browse experience will activate after the dedicated Marketplace read APIs are added in later Stack C phases.</p>
      </article>
      <article class="marketplace-placeholder-card">
        <h2>My Listings</h2>
        <p>Listing creation and herd import remain unavailable until the detached listing API phase is complete.</p>
      </article>
      <article class="marketplace-placeholder-card">
        <h2>Seller Profile</h2>
        <p>Seller profile management will use privacy-safe server contracts and private media during preview.</p>
      </article>
    </section>
  `;

  root.hidden = false;
})();
