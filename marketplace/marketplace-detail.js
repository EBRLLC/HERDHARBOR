(() => {
  "use strict";

  const root = document.getElementById("marketplace-root");
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

  function accountUrl(next) {
    return "/marketplace/account/?next=" + encodeURIComponent(next);
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
    const { data, error } = await client.functions.invoke("marketplace-public-media", {
      body: { action: "listing", listingIds: [listingId], maxPerListing: 6 }
    });
    if (error) throw error;
    const urls = data?.listings?.[listingId];
    return Array.isArray(urls) ? urls.filter(Boolean).slice(0, 6) : [];
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

  function renderPedigree(dialog, payload) {
    const body = dialog.querySelector("[data-pedigree-body]");
    const snapshot = payload?.snapshot && typeof payload.snapshot === "object" ? payload.snapshot : null;
    const nodes = Array.isArray(snapshot?.nodes) ? snapshot.nodes : [];

    if (!payload?.available || !snapshot || !nodes.length) {
      body.innerHTML = '<div class="marketplace-notice">This seller has not shared a pedigree preview for this listing.</div>';
      return;
    }

    const grouped = new Map();
    for (const node of nodes) {
      const generation = Math.max(0, Number(node?.generation) || 0);
      if (!grouped.has(generation)) grouped.set(generation, []);
      grouped.get(generation).push(node);
    }

    body.innerHTML = `
      <div class="marketplace-pedigree-meta">
        <span>${esc(String(snapshot.generations || ""))} generations</span>
        <span>HerdHarbor pedigree</span>
      </div>
      <p class="marketplace-help">Read-only public pedigree snapshot. Private herd notes, health data, contact details, photos, internal IDs, and sync metadata are not included.</p>
      <div class="marketplace-pedigree-scroll">
        ${[...grouped.entries()].sort((a,b) => a[0]-b[0]).map(([generation,nodesForGeneration]) => `
          <section class="marketplace-pedigree-generation" aria-labelledby="marketplace-pedigree-generation-${generation}">
            <h3 id="marketplace-pedigree-generation-${generation}">${esc(generationLabel(generation))}</h3>
            <div class="marketplace-pedigree-generation-grid">
              ${nodesForGeneration.map(pedigreeNodeCard).join("")}
            </div>
          </section>
        `).join("")}
      </div>
    `;
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
        if (primary) primary.outerHTML = '<div class="marketplace-gallery-fallback">HH</div>';
        else img.remove();
      }, { once: true });
    });
  }

  async function openConversation(listingId) {
    if (!interactive) {
      const next = "/marketplace/listing/?id=" + encodeURIComponent(listingId) + "&message=1";
      window.location.assign(context.isAuthenticated ? "https://app.herdharbor.com/" : accountUrl(next));
      return;
    }

    const conversationId = await rpc("marketplace_member_open_listing_conversation", {
      listing_id_value: listingId
    });
    window.location.assign("/marketplace/messages/?id=" + encodeURIComponent(conversationId));
  }

  async function reportListing(listingId) {
    if (!interactive) {
      const next = "/marketplace/listing/?id=" + encodeURIComponent(listingId);
      window.location.assign(context.isAuthenticated ? "https://app.herdharbor.com/" : accountUrl(next));
      return;
    }

    const reason = clean(globalThis.prompt("Why are you reporting this listing?") || "");
    if (!reason) return;
    const details = clean(globalThis.prompt("Add details for the Marketplace admin (optional):") || "");

    try {
      await rpc("marketplace_member_submit_report", {
        target_type_value: "listing",
        target_id_value: listingId,
        reason_value: reason,
        details_value: details
      });
      globalThis.alert("Report submitted for review.");
    } catch {
      globalThis.alert("The report could not be submitted.");
    }
  }

  async function start() {
    const params = new URLSearchParams(window.location.search);
    const listingId = params.get("id") || "";

    if (!validUuid(listingId)) {
      root.innerHTML = '<section class="marketplace-empty-state"><h1>Listing not found</h1><p>This Marketplace link is invalid.</p><a class="button" href="/marketplace/">Back to Browse</a></section>';
      root.hidden = false;
      return;
    }

    root.innerHTML = '<article class="marketplace-placeholder-card" aria-busy="true"><p>Loading listing…</p></article>';
    root.hidden = false;

    try {
      const [detailData, photos] = await Promise.all([
        rpc("marketplace_public_listing_v2", { listing_id_value: listingId }),
        gallery(listingId)
      ]);
      const listing = firstRow(detailData);

      if (!listing) {
        root.innerHTML = '<section class="marketplace-empty-state"><h1>Listing unavailable</h1><p>This listing is not currently available.</p><a class="button" href="/marketplace/">Back to Browse</a></section>';
        return;
      }

      document.title = (clean(listing.animal_name) || "Marketplace Listing") + " — HerdHarbor";

      const sellerName = listing.rabbitry_name || listing.seller_display_name || "HerdHarbor seller";
      const location = [listing.location_city, listing.location_region].filter(Boolean).join(", ");
      const sellerLocation = [listing.seller_city, listing.seller_region].filter(Boolean).join(", ");
      const age = ageLabel(listing.dob);
      const verified = clean(listing.seller_verification_status).toLowerCase() === "verified";
      const ownListing = context.isAuthenticated
        && context.sellerPublicId
        && String(context.sellerPublicId) === String(listing.seller_public_id);

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

            <div class="marketplace-listing-contact-actions">
              ${ownListing
                ? '<span class="marketplace-notice">This is your listing.</span>'
                : `<button class="button" type="button" id="marketplace-message-seller">${interactive ? "Message seller" : "Sign in to message seller"}</button>`}
              <button class="button button-secondary button-small" type="button" id="marketplace-favorite-listing">♡ ${interactive ? "Save listing" : "Sign in to save"}</button>
              <button class="button button-secondary button-small" type="button" id="marketplace-report-listing">${interactive ? "Report listing" : "Sign in to report"}</button>
            </div>

            <section class="listing-pedigree-callout">
              <div>
                <p class="eyebrow">HerdHarbor Pedigree</p>
                <h2>Recorded lineage preview</h2>
                <p>View the public read-only pedigree snapshot the seller chose to share.</p>
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

      const messageButton = root.querySelector("#marketplace-message-seller");
      messageButton?.addEventListener("click", () => {
        openConversation(listingId).catch(() => {
          globalThis.alert("The seller conversation could not be opened.");
        });
      });

      const favoriteButton = root.querySelector("#marketplace-favorite-listing");
      let favorite = false;
      if (interactive && favoriteButton) {
        try {
          const ids = await rpc("marketplace_member_favorite_ids");
          favorite = Array.isArray(ids) && ids.map(String).includes(String(listingId));
          favoriteButton.textContent = favorite ? "♥ Saved" : "♡ Save listing";
          favoriteButton.setAttribute("aria-pressed", String(favorite));
        } catch {}
      }

      favoriteButton?.addEventListener("click", async () => {
        if (!interactive) {
          const next = "/marketplace/listing/?id=" + encodeURIComponent(listingId);
          window.location.assign(context.isAuthenticated ? "https://app.herdharbor.com/" : accountUrl(next));
          return;
        }

        favoriteButton.disabled = true;
        try {
          favorite = !favorite;
          await rpc("marketplace_member_toggle_favorite", {
            listing_id_value: listingId,
            favorite_value: favorite
          });
          favoriteButton.textContent = favorite ? "♥ Saved" : "♡ Save listing";
          favoriteButton.setAttribute("aria-pressed", String(favorite));
        } catch {
          favorite = !favorite;
        } finally {
          favoriteButton.disabled = false;
        }
      });

      root.querySelector("#marketplace-report-listing")?.addEventListener("click", () => {
        reportListing(listingId);
      });

      const pedigreeButton = root.querySelector("#view-marketplace-pedigree");
      const pedigreeDialog = root.querySelector("#marketplace-pedigree-dialog");
      const closePedigree = root.querySelector("[data-close-pedigree]");

      pedigreeButton?.addEventListener("click", async () => {
        if (!pedigreeDialog) return;
        if (typeof pedigreeDialog.showModal === "function") pedigreeDialog.showModal();
        else pedigreeDialog.setAttribute("open", "");
        closePedigree?.focus();

        const body = pedigreeDialog.querySelector("[data-pedigree-body]");
        body.innerHTML = '<div class="marketplace-notice">Loading pedigree…</div>';
        try {
          const payload = await rpc("marketplace_public_pedigree_v2", { listing_id_value: listingId });
          renderPedigree(pedigreeDialog, payload);
        } catch {
          body.innerHTML = '<div class="marketplace-notice error">Pedigree preview could not be loaded.</div>';
        }
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

      if (params.get("message") === "1" && interactive && !ownListing) {
        await openConversation(listingId);
      }
    } catch {
      root.innerHTML = '<section class="marketplace-empty-state"><h1>Listing unavailable</h1><p>The listing could not be loaded. Try again.</p><a class="button" href="/marketplace/">Back to Browse</a></section>';
    }
  }

  start();
})();
