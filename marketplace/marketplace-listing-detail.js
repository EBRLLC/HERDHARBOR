(() => {
  "use strict";

  const BUCKET = "marketplace-public";
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const root = document.getElementById("marketplace-owner-root");
  const context = window.HerdHarborMarketplaceContext;
  if (!root || !context?.client || context.role !== "owner") return;

  const clean = (value) => String(value ?? "").trim();
  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  const rpc = async (client, name, args) => {
    const { data, error } = await client.rpc(name, args);
    if (error) throw error;
    return data;
  };

  const money = (cents, currency = "USD") => cents == null
    ? "Price not listed"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency || "USD",
        maximumFractionDigits: 2
      }).format(Number(cents) / 100);

  function row(data) {
    return Array.isArray(data) ? (data[0] || null) : (data || null);
  }

  function listingId() {
    const id = clean(new URLSearchParams(window.location.search).get("id"));
    return UUID_RE.test(id) ? id : "";
  }

  async function signedPhotos(client, id) {
    const rows = await rpc(client, "marketplace_owner_preview_media", {
      listing_ids_value: [id]
    }) || [];
    const paths = Array.isArray(rows?.[0]?.photo_paths) ? rows[0].photo_paths.filter(Boolean) : [];
    const urls = [];
    for (const path of paths.slice(0, 6)) {
      const { data, error } = await client.storage.from(BUCKET).createSignedUrl(path, 900);
      if (!error && data?.signedUrl) urls.push(data.signedUrl);
    }
    return urls;
  }

  async function mount() {
    const id = listingId();
    if (!id) {
      root.innerHTML = '<div class="marketplace-notice error">This Marketplace listing link is invalid.</div>';
      root.hidden = false;
      return;
    }

    root.innerHTML = '<div class="marketplace-notice">Loading listing…</div>';
    root.hidden = false;

    try {
      const [listingData, favoriteData] = await Promise.all([
        rpc(context.client, "marketplace_owner_listing_preview", { listing_id_value: id }),
        rpc(context.client, "marketplace_owner_favorite_ids")
      ]);
      const listing = row(listingData);
      if (!listing) {
        root.innerHTML = '<div class="marketplace-empty-state"><h2>Listing unavailable</h2><p>This listing is not available in the private Marketplace preview.</p><a class="button" href="/marketplace/">Back to Marketplace</a></div>';
        return;
      }

      const favoriteIds = new Set(Array.isArray(favoriteData) ? favoriteData.map(String) : []);
      const photos = await signedPhotos(context.client, id);
      const location = [listing.location_city, listing.location_region].filter(Boolean).join(", ");
      const sellerLocation = [listing.seller_city, listing.seller_region].filter(Boolean).join(", ");
      const seller = clean(listing.rabbitry_name || listing.seller_display_name || "HerdHarbor seller");
      const favorite = favoriteIds.has(id);

      document.title = `${clean(listing.animal_name) || "Marketplace Listing"} — HerdHarbor`;

      root.innerHTML = `
        <section class="marketplace-route-header">
          <a class="marketplace-back-link" href="/marketplace/">← Back to Marketplace</a>
          <span class="marketplace-preview-badge">Owner Preview</span>
        </section>

        <article class="marketplace-detail-layout">
          <section class="marketplace-detail-media" aria-label="Listing photos">
            ${photos.length
              ? `<img class="marketplace-detail-primary" src="${esc(photos[0])}" alt="" decoding="async">
                 ${photos.length > 1 ? `<div class="marketplace-detail-thumbs">${photos.slice(1).map((url) => `<img src="${esc(url)}" alt="" loading="lazy" decoding="async">`).join("")}</div>` : ""}`
              : '<div class="marketplace-detail-fallback">HH</div>'}
          </section>

          <section class="marketplace-detail-copy">
            <div class="marketplace-detail-title-row">
              <div>
                <p class="eyebrow">${esc((listing.listing_kind || "individual").replaceAll("_", " "))}</p>
                <h1>${esc(listing.animal_name || "Unnamed animal")}</h1>
              </div>
              <button class="marketplace-favorite marketplace-favorite-large" type="button" id="marketplace-detail-favorite" aria-pressed="${favorite}" aria-label="${favorite ? "Remove from favorites" : "Add to favorites"}">${favorite ? "♥" : "♡"}</button>
            </div>

            <div class="marketplace-detail-price">${esc(money(listing.price_cents, listing.currency))}</div>
            <dl class="marketplace-fact-grid">
              ${listing.breed ? `<div><dt>Breed</dt><dd>${esc(listing.breed)}</dd></div>` : ""}
              ${listing.variety_color ? `<div><dt>Color / variety</dt><dd>${esc(listing.variety_color)}</dd></div>` : ""}
              ${listing.sex ? `<div><dt>Sex</dt><dd>${esc(listing.sex)}</dd></div>` : ""}
              ${listing.dob ? `<div><dt>Date of birth</dt><dd>${esc(listing.dob)}</dd></div>` : ""}
              ${location ? `<div><dt>Location</dt><dd>${esc(location)}</dd></div>` : ""}
              ${listing.pedigree_status ? `<div><dt>Pedigree</dt><dd>${esc(listing.pedigree_status)}</dd></div>` : ""}
              ${listing.registration_status ? `<div><dt>Registration</dt><dd>${esc(listing.registration_status)}</dd></div>` : ""}
              ${listing.available_from ? `<div><dt>Available from</dt><dd>${esc(listing.available_from)}</dd></div>` : ""}
            </dl>

            ${listing.description ? `<section class="marketplace-detail-section"><h2>About this listing</h2><p>${esc(listing.description)}</p></section>` : ""}

            <section class="marketplace-detail-section">
              <div class="marketplace-detail-section-heading">
                <h2>Pedigree</h2>
                <button class="button button-secondary button-small" type="button" disabled title="Pedigree preview activates in Stack C5">View HerdHarbor Pedigree</button>
              </div>
              <p class="marketplace-help">Pedigree visibility is shown here without exposing private herd records. The interactive read-only preview activates in the final Marketplace phase.</p>
            </section>
          </section>
        </article>

        <aside class="marketplace-seller-card">
          <div>
            <p class="eyebrow">Seller</p>
            <h2>${esc(seller)}</h2>
            ${listing.seller_display_name && listing.seller_display_name !== seller ? `<p>${esc(listing.seller_display_name)}</p>` : ""}
            ${sellerLocation ? `<p class="marketplace-card-meta">${esc(sellerLocation)}</p>` : ""}
            ${listing.seller_verification_status ? `<span class="marketplace-verified">${esc(listing.seller_verification_status)}</span>` : ""}
          </div>
          <a class="button button-secondary" href="/marketplace/seller/?id=${encodeURIComponent(listing.seller_public_id || "")}">View Seller Profile</a>
        </aside>
      `;

      const favoriteButton = root.querySelector("#marketplace-detail-favorite");
      favoriteButton?.addEventListener("click", async () => {
        const next = favoriteButton.getAttribute("aria-pressed") !== "true";
        favoriteButton.disabled = true;
        try {
          await rpc(context.client, "marketplace_owner_toggle_favorite", {
            listing_id_value: id,
            favorite_value: next
          });
          favoriteButton.setAttribute("aria-pressed", String(next));
          favoriteButton.setAttribute("aria-label", next ? "Remove from favorites" : "Add to favorites");
          favoriteButton.textContent = next ? "♥" : "♡";
        } finally {
          favoriteButton.disabled = false;
        }
      });
    } catch {
      root.innerHTML = '<div class="marketplace-notice error">This Marketplace listing could not be loaded. No private herd data was exposed.</div>';
    }
  }

  mount();
})();
