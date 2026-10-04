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

  function generationLabel(index) {
    if (index === 0) return "Animal";
    if (index === 1) return "Parents";
    if (index === 2) return "Grandparents";
    if (index === 3) return "Great-grandparents";
    return "Generation " + (index + 1);
  }

  function pedigreeNodeCard(node) {
    const animal = node?.animal && typeof node.animal === "object" ? node.animal : null;
    const status = clean(node?.status || "unknown");
    const relation = clean(node?.relation || node?.key || "Pedigree slot");

    if (!animal) {
      const statusText = status === "cycle"
        ? "Circular reference"
        : status === "missing-reference"
          ? "Missing linked ancestor"
          : status === "malformed-reference"
            ? "Invalid linked ancestor"
            : "Unknown ancestor";

      return `
        <article class="marketplace-pedigree-node is-empty" data-status="${esc(status)}">
          <span class="marketplace-pedigree-relation">${esc(relation)}</span>
          <strong>${esc(statusText)}</strong>
        </article>
      `;
    }

    const details = [
      animal.prefix,
      animal.breed,
      animal.color,
      animal.sex,
      animal.dob,
      animal.registrationNumber ? "Reg. " + animal.registrationNumber : ""
    ].filter(Boolean);

    return `
      <article class="marketplace-pedigree-node" data-status="${esc(status)}">
        <span class="marketplace-pedigree-relation">${esc(relation)}</span>
        <strong>${esc(animal.name || "Unnamed ancestor")}</strong>
        ${details.length ? `<span>${esc(details.join(" · "))}</span>` : ""}
        ${status === "repeat" && node.repeatOf ? `<span class="marketplace-pedigree-repeat">Repeated from ${esc(node.repeatOf)}</span>` : ""}
      </article>
    `;
  }

  function unavailablePedigreeMessage(reason) {
    switch (clean(reason)) {
      case "hidden":
        return "The seller has not shared a pedigree preview for this listing.";
      case "no_linked_source":
        return "This manual listing is not linked to a HerdHarbor animal pedigree.";
      case "source_missing":
        return "The linked HerdHarbor animal is no longer available for pedigree preview.";
      case "source_unavailable":
        return "The linked pedigree source is temporarily unavailable.";
      case "not_available":
        return "This listing is not currently available for pedigree preview.";
      default:
        return "Pedigree preview is not available for this listing.";
    }
  }

  function renderPedigreeSnapshot(dialog, payload) {
    const body = dialog.querySelector("[data-pedigree-body]");
    const snapshot = payload?.snapshot && typeof payload.snapshot === "object" ? payload.snapshot : null;
    const nodes = Array.isArray(snapshot?.nodes) ? snapshot.nodes : [];

    if (!payload?.available || !snapshot || !nodes.length) {
      body.innerHTML = '<div class="marketplace-notice">' + esc(unavailablePedigreeMessage(payload?.reason)) + '</div>';
      return;
    }

    const grouped = new Map();
    for (const node of nodes) {
      const generation = Math.max(0, Number(node?.generation) || 0);
      if (!grouped.has(generation)) grouped.set(generation, []);
      grouped.get(generation).push(node);
    }

    const sections = [...grouped.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([generation, generationNodes]) => `
        <section class="marketplace-pedigree-generation" aria-labelledby="marketplace-pedigree-generation-${generation}">
          <h3 id="marketplace-pedigree-generation-${generation}">${esc(generationLabel(generation))}</h3>
          <div class="marketplace-pedigree-generation-grid">
            ${generationNodes.map(pedigreeNodeCard).join("")}
          </div>
        </section>
      `).join("");

    body.innerHTML = `
      <div class="marketplace-pedigree-meta">
        <span>${esc(String(snapshot.generations || ""))} generations</span>
        <span>Canonical engine ${esc(snapshot.engineVersion || "")}</span>
      </div>
      <p class="marketplace-help">Read-only sanitized lineage snapshot. Private notes, health data, contact details, photos, internal IDs, and sync metadata are not included.</p>
      <div class="marketplace-pedigree-scroll">${sections}</div>
    `;
  }

  async function loadPedigree(dialog, listingId) {
    const body = dialog.querySelector("[data-pedigree-body]");
    body.innerHTML = '<div class="marketplace-notice">Loading pedigree…</div>';

    try {
      let payload = await rpc("marketplace_owner_listing_pedigree_preview", {
        listing_id_value: listingId
      });

      if (payload?.reason === "refresh_required") {
        const { data, error } = await context.client.functions.invoke("marketplace-pedigree-snapshot", {
          body: { listingId }
        });
        if (error) {
          throw new Error("Pedigree snapshot service unavailable.");
        }
        payload = data && typeof data === "object" ? data : payload;
      }

      renderPedigreeSnapshot(dialog, payload);
    } catch {
      body.innerHTML = '<div class="marketplace-notice error">Pedigree preview could not be loaded. No private herd data was exposed.</div>';
    }
  }

  function bindSignedImageRecovery() {
    root.querySelectorAll(".marketplace-gallery img").forEach((img) => {
      img.addEventListener("error", () => {
        if (!mediaRecoveryAttempted) {
          mediaRecoveryAttempted = true;
          start();
          return;
        }

        const primary = img.closest(".marketplace-gallery-primary");
        if (primary) {
          primary.outerHTML = '<div class="marketplace-gallery-fallback">HH</div>';
        } else {
          img.remove();
        }
      }, { once: true });
    });
  }

  async function start() {
    const listingId = new URLSearchParams(window.location.search).get("id") || "";
    if (!validUuid(listingId)) {
      root.innerHTML = '<section class="marketplace-empty-state"><h1>Listing not found</h1><p>This Marketplace link is invalid.</p><a class="button" href="/marketplace/">Back to Browse</a></section>';
      root.hidden = false;
      return;
    }

    root.innerHTML = '<article class="marketplace-placeholder-card" aria-busy="true"><p>Loading listing…</p></article>';
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

      document.title = (clean(listing.animal_name) || "Marketplace Listing") + " — HerdHarbor";

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
                <p>View a read-only sanitized snapshot generated from HerdHarbor's canonical pedigree engine.</p>
              </div>
              <button class="button button-secondary" type="button" id="view-marketplace-pedigree">View HerdHarbor Pedigree</button>
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

        <dialog id="marketplace-pedigree-dialog" class="marketplace-pedigree-dialog" aria-labelledby="marketplace-pedigree-title">
          <div class="marketplace-pedigree-dialog-shell">
            <div class="marketplace-detail-section-heading">
              <div>
                <p class="eyebrow">Read-only preview</p>
                <h2 id="marketplace-pedigree-title">HerdHarbor Pedigree</h2>
              </div>
              <button class="button button-secondary button-small" type="button" data-close-pedigree>Close</button>
            </div>
            <div data-pedigree-body aria-live="polite">
              <div class="marketplace-notice">Pedigree has not been loaded yet.</div>
            </div>
          </div>
        </dialog>
      `;

      bindSignedImageRecovery();

      const pedigreeButton = root.querySelector("#view-marketplace-pedigree");
      const pedigreeDialog = root.querySelector("#marketplace-pedigree-dialog");
      const closePedigree = root.querySelector("[data-close-pedigree]");

      pedigreeButton?.addEventListener("click", async () => {
        if (!pedigreeDialog) return;
        if (typeof pedigreeDialog.showModal === "function") pedigreeDialog.showModal();
        else pedigreeDialog.setAttribute("open", "");
        closePedigree?.focus();
        await loadPedigree(pedigreeDialog, listingId);
      });

      closePedigree?.addEventListener("click", () => {
        if (typeof pedigreeDialog?.close === "function") pedigreeDialog.close();
        else pedigreeDialog?.removeAttribute("open");
        pedigreeButton?.focus();
      });

      pedigreeDialog?.addEventListener("click", (event) => {
        if (event.target !== pedigreeDialog) return;
        if (typeof pedigreeDialog.close === "function") pedigreeDialog.close();
        else pedigreeDialog.removeAttribute("open");
        pedigreeButton?.focus();
      });

      const favoriteButton = root.querySelector("#listing-favorite");
      favoriteButton?.addEventListener("click", async () => {
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
