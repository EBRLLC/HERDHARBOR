(() => {
  "use strict";

  const BUCKET = "marketplace-public";
  const root = document.getElementById("marketplace-owner-root");
  const context = window.HerdHarborMarketplaceContext;
  if (!root || !context?.client || context.role !== "owner") return;

  let mediaRecoveryAttempted = false;

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

  async function ownAvatar(sellerPublicId) {
    const editor = firstRow(await rpc("marketplace_owner_profile_editor"));
    if (!editor || String(editor.public_id) !== String(sellerPublicId) || !editor.avatar_path) return "";
    const { data, error } = await context.client.storage.from(BUCKET).createSignedUrl(editor.avatar_path, 900);
    return error ? "" : (data?.signedUrl || "");
  }

  async function listingMedia(listingIds) {
    if (!listingIds.length) return new Map();
    const rows = await rpc("marketplace_owner_preview_media", { listing_ids_value: listingIds });
    const map = new Map();
    for (const row of Array.isArray(rows) ? rows : []) {
      const path = Array.isArray(row.photo_paths) ? row.photo_paths[0] : "";
      if (!path) {
        map.set(String(row.listing_id), "");
        continue;
      }
      const { data, error } = await context.client.storage.from(BUCKET).createSignedUrl(path, 900);
      map.set(String(row.listing_id), error ? "" : (data?.signedUrl || ""));
    }
    return map;
  }

  async function start() {
    const sellerId = new URLSearchParams(window.location.search).get("id") || "";
    if (!validUuid(sellerId)) {
      root.innerHTML = '<section class="marketplace-empty-state"><h1>Seller not found</h1><p>This Marketplace seller link is invalid.</p><a class="button" href="/marketplace/">Back to Browse</a></section>';
      root.hidden = false;
      return;
    }

    root.innerHTML = '<article class="marketplace-placeholder-card"><p>Loading seller profile…</p></article>';
    root.hidden = false;

    try {
      const [profileData, listings, avatar] = await Promise.all([
        rpc("marketplace_owner_seller_preview", { seller_public_id_value: sellerId }),
        rpc("marketplace_owner_search_preview", {
          query_value: "",
          species_value: "",
          breed_value: "",
          sex_value: "",
          region_value: "",
          pedigree_status_value: "",
          listing_kind_value: "",
          min_price_cents_value: null,
          max_price_cents_value: null,
          seller_public_id_value: sellerId,
          sort_value: "newest",
          limit_value: 48,
          offset_value: 0
        }),
        ownAvatar(sellerId)
      ]);
      const profile = firstRow(profileData);
      if (!profile) {
        root.innerHTML = '<section class="marketplace-empty-state"><h1>Seller unavailable</h1><p>This seller profile is not currently available.</p><a class="button" href="/marketplace/">Back to Browse</a></section>';
        return;
      }

      const list = Array.isArray(listings) ? listings : [];
      const media = await listingMedia(list.map((row) => row.listing_id));
      const location = [profile.city, profile.region].filter(Boolean).join(", ");
      const breeds = Array.isArray(profile.species_breeds) ? profile.species_breeds.filter(Boolean) : [];
      const verified = clean(profile.verification_status).toLowerCase() === "verified";
      const title = profile.rabbitry_name || profile.display_name || "HerdHarbor seller";

      root.innerHTML = `
        <nav class="marketplace-detail-breadcrumb" aria-label="Breadcrumb">
          <a href="/marketplace/">Marketplace</a><span aria-hidden="true">/</span><span>${esc(title)}</span>
        </nav>

        <section class="seller-public-header">
          <div class="seller-public-avatar">
            ${avatar ? '<img src="' + esc(avatar) + '" alt="" decoding="async">' : '<span>' + esc(title.slice(0,2).toUpperCase()) + '</span>'}
          </div>
          <div>
            <p class="eyebrow">Seller Profile</p>
            <h1>${esc(title)} ${verified ? '<span class="marketplace-verified">Verified</span>' : ""}</h1>
            ${profile.display_name && profile.display_name !== title ? '<p class="seller-public-name">' + esc(profile.display_name) + '</p>' : ""}
            ${location ? '<p class="seller-public-meta">' + esc(location) + '</p>' : ""}
            <p>${esc(profile.about || "No seller description has been added.")}</p>
            ${breeds.length ? '<p class="seller-public-meta">' + esc(breeds.join(" • ")) + '</p>' : ""}
            <p class="seller-public-meta">${Number(profile.active_listing_count || 0)} active listing${Number(profile.active_listing_count || 0) === 1 ? "" : "s"}</p>
          </div>
        </section>

        <section class="marketplace-results-heading">
          <div><p class="eyebrow">Available now</p><h2>Listings from ${esc(title)}</h2></div>
        </section>
        <section class="marketplace-browse-grid">
          ${list.length ? list.map((row) => {
            const photo = media.get(String(row.listing_id)) || "";
            const details = [row.breed, row.variety_color, row.sex].filter(Boolean).join(" · ");
            const loc = [row.location_city, row.location_region].filter(Boolean).join(", ");
            return `
              <article class="browse-card">
                <a class="browse-card-link" href="/marketplace/listing/?id=${encodeURIComponent(row.listing_id)}">
                  <div class="browse-card-media">${photo ? '<img src="' + esc(photo) + '" alt="" loading="lazy" decoding="async">' : '<div class="browse-card-fallback">HH</div>'}</div>
                  <div class="browse-card-body">
                    <div class="browse-card-price">${esc(money(row.price_cents, row.currency))}</div>
                    <h3>${esc(row.animal_name || "Unnamed listing")}</h3>
                    <p>${esc(details || row.species || "Animal")}</p>
                    <p>${esc(loc || "Location not listed")}</p>
                  </div>
                </a>
              </article>
            `;
          }).join("") : '<article class="marketplace-empty-state"><h3>No active listings</h3><p>This seller does not have any active Marketplace listings right now.</p></article>'}
        </section>
      `;
      root.querySelectorAll("img").forEach((img) => {
        img.addEventListener("error", () => {
          if (!mediaRecoveryAttempted) {
            mediaRecoveryAttempted = true;
            start();
            return;
          }

          if (img.closest(".seller-public-avatar")) {
            const avatar = img.closest(".seller-public-avatar");
            avatar.innerHTML = '<span>' + esc(title.slice(0, 2).toUpperCase()) + '</span>';
          } else {
            const mediaNode = img.closest(".browse-card-media");
            if (mediaNode) mediaNode.innerHTML = '<div class="browse-card-fallback">HH</div>';
          }
        }, { once: true });
      });
    } catch {
      root.innerHTML = '<section class="marketplace-empty-state"><h1>Seller unavailable</h1><p>The seller profile could not be loaded. Try again.</p><a class="button" href="/marketplace/">Back to Browse</a></section>';
    }
  }

  start();
})();
