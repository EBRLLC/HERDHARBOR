(() => {
  "use strict";

  const BUCKET = "marketplace-public";
  const root = document.getElementById("marketplace-owner-root");
  const context = window.HerdHarborMarketplaceContext;
  if (!root || !context?.client) return;

  const { client } = context;
  const interactive = context.isAuthenticated && context.accountStatus === "active" && context.marketplaceAccessReady === true;
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
    const { data, error } = await client.rpc(name, args);
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

  async function sellerAvatar(sellerPublicId) {
    const path = await rpc("marketplace_public_seller_media_v2", {
      seller_public_id_value: sellerPublicId
    });
    if (!path) return "";
    const { data, error } = await client.storage.from(BUCKET).createSignedUrl(path, 300);
    return error ? "" : (data?.signedUrl || "");
  }

  async function listingMedia(listingIds) {
    if (!listingIds.length) return new Map();
    const rows = await rpc("marketplace_public_listing_media_v2", {
      listing_ids_value: listingIds
    });
    const map = new Map();
    for (const row of Array.isArray(rows) ? rows : []) {
      const path = Array.isArray(row.photo_paths) ? row.photo_paths[0] : "";
      if (!path) {
        map.set(String(row.listing_id), "");
        continue;
      }
      const { data, error } = await client.storage.from(BUCKET).createSignedUrl(path, 300);
      map.set(String(row.listing_id), error ? "" : (data?.signedUrl || ""));
    }
    return map;
  }

  async function reportSeller(sellerId) {
    if (!interactive) {
      window.location.assign(context.isAuthenticated
        ? "https://app.herdharbor.com/"
        : "/marketplace/account/?next=" + encodeURIComponent(window.location.pathname + window.location.search));
      return;
    }

    const reason = clean(globalThis.prompt("Why are you reporting this seller?") || "");
    if (!reason) return;
    const details = clean(globalThis.prompt("Add details for the Marketplace admin (optional):") || "");

    try {
      await rpc("marketplace_member_submit_report", {
        target_type_value: "user",
        target_id_value: sellerId,
        reason_value: reason,
        details_value: details
      });
      globalThis.alert("Report submitted for review.");
    } catch {
      globalThis.alert("The report could not be submitted.");
    }
  }

  async function start() {
    const sellerId = new URLSearchParams(window.location.search).get("id") || "";
    if (!validUuid(sellerId)) {
      root.innerHTML = '<section class="marketplace-empty-state"><h1>Seller not found</h1><p>This Marketplace seller link is invalid.</p><a class="button" href="/marketplace/">Back to Browse</a></section>';
      root.hidden = false;
      return;
    }

    root.innerHTML = '<article class="marketplace-placeholder-card" aria-busy="true"><p>Loading seller profile…</p></article>';
    root.hidden = false;

    try {
      const [profileData, listings, avatar] = await Promise.all([
        rpc("marketplace_public_seller_v2", { seller_public_id_value: sellerId }),
        rpc("marketplace_public_search_v2", {
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
        sellerAvatar(sellerId)
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
      const ownProfile = context.isAuthenticated
        && context.sellerPublicId
        && String(context.sellerPublicId) === String(sellerId);

      document.title = title + " — HerdHarbor Marketplace";

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
            ${ownProfile ? "" : '<button class="button button-secondary button-small" type="button" id="marketplace-report-seller">' + (interactive ? "Report seller" : "Sign in to report") + '</button>'}
          </div>
        </section>

        <section class="marketplace-results-heading">
          <div><p class="eyebrow">Available now</p><h2>Listings from ${esc(title)}</h2></div>
        </section>
        <section class="marketplace-browse-grid">
          ${list.length ? list.map((row) => {
            const photo = media.get(String(row.listing_id)) || "";
            const details = [row.breed,row.variety_color,row.sex].filter(Boolean).join(" · ");
            const loc = [row.location_city,row.location_region].filter(Boolean).join(", ");
            return `
              <article class="browse-card">
                <a class="browse-card-link" href="/marketplace/listing/?id=${encodeURIComponent(row.listing_id)}">
                  <div class="browse-card-media">${photo ? '<img src="' + esc(photo) + '" alt="" loading="lazy" decoding="async">' : '<div class="browse-card-fallback">HH</div>'}</div>
                  <div class="browse-card-body">
                    <div class="browse-card-price">${esc(money(row.price_cents,row.currency))}</div>
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

      root.querySelector("#marketplace-report-seller")?.addEventListener("click", () => {
        reportSeller(sellerId);
      });

      root.querySelectorAll("img").forEach((img) => {
        img.addEventListener("error", () => {
          if (!mediaRecoveryAttempted) {
            mediaRecoveryAttempted = true;
            start();
            return;
          }
          if (img.closest(".seller-public-avatar")) {
            const avatarNode = img.closest(".seller-public-avatar");
            avatarNode.innerHTML = '<span>' + esc(title.slice(0,2).toUpperCase()) + '</span>';
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
