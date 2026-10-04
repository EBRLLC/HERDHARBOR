(() => {
  "use strict";

  const BUCKET = "marketplace-public";
  const root = document.getElementById("marketplace-owner-root");
  const context = window.HerdHarborMarketplaceContext;
  if (!root || !context?.client || context.role !== "owner") return;

  const clean = (value) => String(value ?? "").trim();
  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function validUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean(value));
  }

  function firstRow(value) {
    return Array.isArray(value) ? (value[0] || null) : (value || null);
  }

  async function rpc(name, args) {
    const { data, error } = await context.client.rpc(name, args);
    if (error) throw error;
    return data;
  }

  function money(cents, currency = "USD") {
    if (cents === null || cents === undefined) return "Price not listed";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2
    }).format(Number(cents) / 100);
  }

  function ageLabel(dob) {
    const birth = new Date(String(dob || "") + "T12:00:00");
    if (!Number.isFinite(birth.getTime())) return "";
    const days = Math.max(0, Math.floor((Date.now() - birth.getTime()) / 86400000));
    if (days < 60) return days + " days old";
    const months = Math.floor(days / 30.4375);
    if (months < 24) return months + (months === 1 ? " month old" : " months old");
    const years = Math.floor(months / 12);
    return years + (years === 1 ? " year old" : " years old");
  }

  async function gallery(listingId) {
    const rows = await rpc("marketplace_owner_preview_media", { listing_ids_value: [listingId] });
    const paths = Array.isArray(rows) && Array.isArray(rows[0]?.photo_paths) ? rows[0].photo_paths : [];
    const urls = [];
    for (const path of paths.slice(0, 6)) {
      const { data, error } = await context.client.storage.from(BUCKET).createSignedUrl(path, 900);
      if (!error && data?.signedUrl) urls.push(data.signedUrl);
    }
    return urls;
  }

  function fact(label, value) {
    if (!clean(value)) return "";
    return '<div class="listing-fact"><dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd></div>';
  }

  async function start() {
    const listingId = new URLSearchParams(window.location.search).get("id") || "";
    if (!validUuid(listingId)) {
      root.innerHTML = '<section class="marketplace-empty-state"><h1>Listing not found</h1><p>This Marketplace link is invalid.</p><a class="button" href="/marketplace/">Back to Browse</a></section>';
      root.hidden = false;
      return;
    }

    root.innerHTML = '<article class="marketplace-placeholder-card"><p>Loading listing…</p></article>';
    root.hidden = false;

    try {
      const [detailData, photos, favoriteData] = await Promise.all([
        rpc("marketplace_owner_listing_preview", { listing_id_value: listingId }),
        gallery(listingId),
        rpc("marketplace_owner_favorite_ids")
      ]);
      const listing = firstRow(detailData);
      if (!listing) {
        root.innerHTML = '<section class="marketplace-empty-state"><h1>Listing unavailable</h1><p>This listing is not currently available.</p><a class="button" href="/marketplace/">Back to Browse</a></section>';
        return;
      }

      const favorites = new Set(Array.isArray(favoriteData) ? favoriteData.map(String) : []);
      const favorite = favorites.has(listingId);
      const sellerName = listing.rabbitry_name || listing.seller_display_name || "HerdHarbor seller";
      const location = [listing.location_city, listing.location_region].filter(Boolean).join(", ");
      const sellerLocation = [listing.seller_city, listing.seller_region].filter(Boolean).join(", ");
      const age = ageLabel(listing.dob);
      const verified = clean(listing.seller_verification_status).toLowerCase() === "verified";

      root.innerHTML = `
        <nav class="marketplace-detail-breadcrumb" aria-label="Breadcrumb">
          <a href="/marketplace/">Marketplace</a><span aria-hidden="true">/</span><span>${esc(listing.animal_name || "Listing")}</span>
        </nav>
        <article class="marketplace-detail-layout">
          <section class="marketplace-gallery" aria-label="Listing photos">
            ${photos.length
              ? '<div class="marketplace-gallery-primary"><img src="' + esc(photos[0]) + '" alt="" decoding="async"></div>' +
                (photos.length > 1 ? '<div class="marketplace-gallery-thumbs">' + photos.slice(1).map((url) => '<img src="' + esc(url) + '" alt="" loading="lazy" decoding="async">').join("") + '</div>' : "")
              : '<div class="marketplace-gallery-fallback">HH</div>'}
          </section>

          <section class="marketplace-detail-copy">
            <div class="marketplace-detail-heading">
              <div>
                <p class="eyebrow">${esc((listing.listing_kind || "individual").replaceAll("_", " "))}</p>
                <h1>${esc(listing.animal_name || "Unnamed listing")}</h1>
                <p class="marketplace-detail-price">${esc(money(listing.price_cents, listing.currency))}</p>
              </div>
              <button class="marketplace-favorite detail-favorite" type="button" id="listing-favorite" aria-pressed="${favorite ? "true" : "false"}" aria-label="${favorite ? "Remove from favorites" : "Add to favorites"}"><span aria-hidden="true">${favorite ? "♥" : "♡"}</span></button>
            </div>

            <dl class="listing-facts">
              ${fact("Breed", listing.breed)}
              ${fact("Color / variety", listing.variety_color)}
              ${fact("Sex", listing.sex)}
              ${fact("DOB", listing.dob)}
              ${fact("Age", age)}
              ${fact("Location", location)}
              ${fact("Pedigree", listing.pedigree_status)}
              ${fact("Registration", listing.registration_status)}
              ${fact("Available from", listing.available_from)}
            </dl>

            <section class="listing-description">
              <h2>About this listing</h2>
              <p>${esc(listing.description || "No description has been added.")}</p>
            </section>

            <section class="listing-pedigree-callout">
              <div>
                <p class="eyebrow">HerdHarbor Pedigree</p>
                <h2>Recorded lineage preview</h2>
                <p>Pedigree preview is connected to HerdHarbor's canonical lineage system in the final Marketplace phase.</p>
              </div>
              <button class="button button-secondary" type="button" disabled aria-disabled="true">View HerdHarbor Pedigree</button>
            </section>

            <aside class="marketplace-seller-card">
              <p class="eyebrow">Seller</p>
              <h2>${esc(sellerName)} ${verified ? '<span class="marketplace-verified">Verified</span>' : ""}</h2>
              ${listing.seller_display_name && listing.seller_display_name !== sellerName ? '<p>' + esc(listing.seller_display_name) + '</p>' : ""}
              ${sellerLocation ? '<p>' + esc(sellerLocation) + '</p>' : ""}
              <a class="button button-secondary" href="/marketplace/seller/?id=${encodeURIComponent(listing.seller_public_id)}">View seller profile</a>
            </aside>
          </section>
        </article>
      `;

      const favoriteButton = root.querySelector("#listing-favorite");
      favoriteButton.addEventListener("click", async () => {
        const next = favoriteButton.getAttribute("aria-pressed") !== "true";
        favoriteButton.disabled = true;
        try {
          await rpc("marketplace_owner_toggle_favorite", {
            listing_id_value: listingId,
            favorite_value: next
          });
          favoriteButton.setAttribute("aria-pressed", String(next));
          favoriteButton.setAttribute("aria-label", next ? "Remove from favorites" : "Add to favorites");
          favoriteButton.querySelector("span").textContent = next ? "♥" : "♡";
        } finally {
          favoriteButton.disabled = false;
        }
      });
    } catch {
      root.innerHTML = '<section class="marketplace-empty-state"><h1>Listing unavailable</h1><p>The listing could not be loaded. Try again.</p><a class="button" href="/marketplace/">Back to Browse</a></section>';
    }
  }

  start();
})();
