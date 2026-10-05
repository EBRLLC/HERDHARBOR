(() => {
  "use strict";

  const clean = (value) => String(value ?? "").trim();
  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function money(cents, currency = "USD") {
    if (cents === null || cents === undefined) return "Price not listed";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2
    }).format(Number(cents) / 100);
  }

  async function rpc(client, name, args) {
    const { data, error } = await client.rpc(name, args);
    if (error) throw error;
    return data;
  }

  async function listingMedia(client, listingIds) {
    if (!listingIds.length) return new Map();
    try {
      const { data, error } = await client.functions.invoke("marketplace-public-media", {
        body: { action: "listing", listingIds, maxPerListing: 1 }
      });
      if (error) throw error;
      const rows = data?.listings && typeof data.listings === "object" ? data.listings : {};
      const result = new Map();
      for (const id of listingIds) {
        const urls = Array.isArray(rows[id]) ? rows[id] : [];
        result.set(String(id), urls[0] || "");
      }
      return result;
    } catch {
      return new Map();
    }
  }

  async function mount(root, context) {
    if (!root || !context?.client || !context.isAuthenticated || context.accountStatus !== "active" || context.marketplaceAccessReady !== true) return;
    const { client } = context;

    root.innerHTML = `
      <section class="marketplace-section-heading">
        <div>
          <p class="eyebrow">Saved Animals</p>
          <h2>Your saved Marketplace listings</h2>
          <p class="marketplace-help">Available listings can be opened normally. Sold, pending, expired, archived, or removed listings stay clearly marked instead of returning to normal Marketplace browse results.</p>
        </div>
      </section>
      <section id="marketplace-saved-grid" class="marketplace-browse-grid" aria-live="polite"></section>
    `;

    const grid = root.querySelector("#marketplace-saved-grid");

    async function load() {
      grid.innerHTML = '<article class="marketplace-placeholder-card" aria-busy="true"><p>Loading saved animals…</p></article>';
      try {
        const rows = await rpc(client, "marketplace_member_saved_listings", {
          limit_value: 100,
          offset_value: 0
        });
        const saved = Array.isArray(rows) ? rows : [];
        const availableIds = saved.filter((row) => row.available === true).map((row) => String(row.listing_id));
        const media = await listingMedia(client, availableIds);

        if (!saved.length) {
          grid.innerHTML = '<article class="marketplace-empty-state"><h3>No saved animals yet</h3><p>Use Save listing on a Marketplace listing to keep it here.</p></article>';
          return;
        }

        grid.innerHTML = saved.map((row) => {
          const id = String(row.listing_id || "");
          const available = row.available === true;
          const photo = available ? (media.get(id) || "") : "";
          const seller = row.seller_rabbitry_name || row.seller_display_name || "";
          const details = [row.breed,row.variety_color,row.sex].filter(Boolean).join(" · ");
          const location = [row.location_city,row.location_region].filter(Boolean).join(", ");
          const state = clean(row.listing_state || "unavailable").toLowerCase();
          return `
            <article class="browse-card" data-saved-listing="${esc(id)}">
              ${available
                ? `<a class="browse-card-link" href="/marketplace/listing/?id=${encodeURIComponent(id)}">
                    <div class="browse-card-media">${photo ? '<img src="' + esc(photo) + '" alt="" loading="lazy" decoding="async">' : '<div class="browse-card-fallback">HH</div>'}</div>
                    <div class="browse-card-body">
                      <span class="marketplace-state-pill">${esc(state)}</span>
                      <div class="browse-card-price">${esc(money(row.price_cents,row.currency))}</div>
                      <h3>${esc(row.animal_name || "Unnamed listing")}</h3>
                      <p>${esc(details || row.species || "Animal")}</p>
                      <p>${esc(location || "Location not listed")}</p>
                      ${seller ? '<p class="marketplace-help">Seller: ' + esc(seller) + '</p>' : ""}
                    </div>
                  </a>`
                : `<div class="browse-card-body">
                    <span class="marketplace-state-pill">${esc(state)}</span>
                    <h3>${esc(row.animal_name || "Listing unavailable")}</h3>
                    <p>${esc(details || row.species || "This saved listing is no longer publicly available.")}</p>
                    <p class="marketplace-help">This item is kept only so you can remove it from Saved Animals. It does not appear in normal browse results.</p>
                  </div>`}
              <div class="marketplace-card-footer">
                <button class="button button-secondary button-small" type="button" data-unsave-listing="${esc(id)}">Remove from Saved</button>
              </div>
            </article>
          `;
        }).join("");

        grid.querySelectorAll("[data-unsave-listing]").forEach((button) => {
          button.addEventListener("click", async () => {
            button.disabled = true;
            try {
              await rpc(client, "marketplace_member_toggle_favorite_v2", {
                listing_id_value: button.dataset.unsaveListing,
                favorite_value: false
              });
              await load();
            } catch {
              button.disabled = false;
              globalThis.alert("This saved listing could not be removed.");
            }
          });
        });
      } catch {
        grid.innerHTML = '<div class="marketplace-notice error">Saved Animals could not be loaded.</div>';
      }
    }

    await load();
  }

  window.HerdHarborMarketplaceSaved = Object.freeze({ mount });
})();
