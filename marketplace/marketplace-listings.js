(() => {
  "use strict";

  const BUCKET = "marketplace-public";
  const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
  const MAX_PHOTOS = 6;
  const ALLOWED_IMAGE_TYPES = new Map([
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"]
  ]);

  const clean = (value) => String(value ?? "").trim();

  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function moneyToCents(value) {
    const input = clean(value);
    if (!input) return null;
    const amount = Number(input);
    return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
  }

  function centsToMoney(value) {
    if (value === null || value === undefined || value === "") return "";
    return (Number(value) / 100).toFixed(2);
  }

  async function rpc(client, name, args) {
    const { data, error } = await client.rpc(name, args);
    if (error) throw error;
    return data;
  }

  async function sellerProfileStatus(client) {
    const data = await rpc(client, "marketplace_member_profile_preview");
    const row = Array.isArray(data) ? data[0] : data;
    return clean(row && row.marketplace_status).toLowerCase() || "not_created";
  }

  function beginSellerProfileSetup() {
    window.location.assign("/marketplace/?seller-profile-setup=publish#seller-profile");
  }
  async function signedUrl(client, path) {
    if (!path) return "";
    const { data, error } = await client.storage.from(BUCKET).createSignedUrl(path, 300);
    return error ? "" : (data?.signedUrl || "");
  }

  async function removePaths(client, paths) {
    const safe = Array.isArray(paths) ? paths.filter(Boolean) : [];
    if (!safe.length) return;
    await client.storage.from(BUCKET).remove(safe);
  }

  async function refreshPedigreeSnapshot(client, listingId, visibility, sourceAnimalId) {
    if (!listingId || visibility === "hidden" || !sourceAnimalId) return { available: false, skipped: true };
    const { data, error } = await client.functions.invoke("marketplace-pedigree-snapshot", {
      body: { listingId }
    });
    if (error) return { available: false, error };
    return data && typeof data === "object" ? data : { available: false };
  }

  async function uploadPhotos(client, listingId, files) {
    const uploaded = [];
    try {
      for (const [index, file] of files.slice(0, MAX_PHOTOS).entries()) {
        const ext = ALLOWED_IMAGE_TYPES.get(file.type);
        if (!ext || file.size <= 0 || file.size > MAX_PHOTO_BYTES) {
          throw new Error("Listing photos must be JPG, PNG, or WebP and no larger than 8 MB each.");
        }

        const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${index}`;
        const path = `listings/${listingId}/photo-${index}-${token}.${ext}`;
        const { error } = await client.storage.from(BUCKET).upload(path, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false
        });
        if (error) throw new Error("A listing photo failed to upload.");
        uploaded.push(path);
      }
      return uploaded;
    } catch (error) {
      await removePaths(client, uploaded).catch(() => {});
      throw error;
    }
  }

  function priceLabel(listing) {
    if (listing?.price_cents === null || listing?.price_cents === undefined) return "Price not listed";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: listing.currency || "USD",
      maximumFractionDigits: 2
    }).format(Number(listing.price_cents) / 100);
  }

  function dateLabel(value) {
    const date = new Date(value || "");
    if (!Number.isFinite(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
  }

  function lifecycleButtons(listing) {
    const id = esc(listing.id);
    const state = clean(listing.state).toLowerCase();
    if (state === "removed") return '<span class="marketplace-help">Locked</span>';

    const buttons = [];
    if (state === "available") {
      buttons.push(`<button type="button" class="button button-secondary button-small" data-reconfirm-listing="${id}">Reconfirm 30 days</button>`);
      buttons.push(`<button type="button" class="button button-secondary button-small" data-lifecycle-listing="${id}" data-lifecycle-state="pending">Mark pending</button>`);
      buttons.push(`<button type="button" class="button button-secondary button-small" data-lifecycle-listing="${id}" data-lifecycle-state="sold">Mark sold</button>`);
    } else if (state === "pending") {
      buttons.push(`<button type="button" class="button button-secondary button-small" data-lifecycle-listing="${id}" data-lifecycle-state="available">Make available</button>`);
      buttons.push(`<button type="button" class="button button-secondary button-small" data-lifecycle-listing="${id}" data-lifecycle-state="sold">Mark sold</button>`);
    } else if (state === "expired") {
      buttons.push(`<button type="button" class="button button-secondary button-small" data-reconfirm-listing="${id}">Renew 30 days</button>`);
    } else if (state === "sold" || state === "archived") {
      buttons.push(`<button type="button" class="button button-secondary button-small" data-lifecycle-listing="${id}" data-lifecycle-state="available">Relist available</button>`);
    }

    if (["available","pending","expired","sold"].includes(state)) {
      buttons.push(`<button type="button" class="button button-secondary button-small" data-lifecycle-listing="${id}" data-lifecycle-state="archived">Archive</button>`);
    }
    buttons.push(`<button type="button" class="button button-secondary button-small" data-edit-listing="${id}">Edit</button>`);
    return buttons.join(" ");
  }

  async function listingCard(client, listing) {
    const firstPath = Array.isArray(listing.photo_paths) ? listing.photo_paths[0] : "";
    const photo = await signedUrl(client, firstPath);
    const location = [listing.location_city, listing.location_region].filter(Boolean).join(", ");
    const state = clean(listing.state).toLowerCase();
    const removed = state === "removed";
    const expiry = dateLabel(listing.expires_at);

    return `
      <article class="marketplace-listing-card ${removed ? "is-moderation-removed" : ""}" data-listing-id="${esc(listing.id)}">
        <div class="marketplace-listing-photo">
          ${photo ? `<img src="${esc(photo)}" alt="">` : '<div class="marketplace-listing-photo-empty">HH</div>'}
          <span class="marketplace-state-pill">${esc(listing.state || "draft")}</span>
        </div>
        <div class="marketplace-listing-copy">
          <p class="eyebrow">${esc((listing.listing_kind || "individual").replaceAll("_", " "))}</p>
          <h3>${esc(listing.animal_name || "Unnamed listing")}</h3>
          <p class="marketplace-card-meta">${esc([listing.breed, listing.variety_color, listing.sex].filter(Boolean).join(" · ") || listing.species || "Animal")}</p>
          <p class="marketplace-card-meta">${esc(location || "Location not set")}</p>
          ${state === "available" && expiry ? `<p class="marketplace-card-meta">Available through ${esc(expiry)}</p>` : ""}
          ${state === "expired" ? '<div class="marketplace-notice">This listing expired and is no longer in Browse. Renew it for another 30 days or archive it.</div>' : ""}
          ${state === "pending" ? '<div class="marketplace-notice">Pending listings are hidden from normal Browse until you make them Available again.</div>' : ""}
          ${state === "sold" ? '<div class="marketplace-notice success">Sold listings are hidden from normal Browse.</div>' : ""}
          ${state === "archived" ? '<div class="marketplace-notice">Archived listings are hidden from normal Browse.</div>' : ""}
          ${removed ? '<div class="marketplace-notice error">Removed by Marketplace moderation. This listing is locked until the Owner restores it to draft.</div>' : ""}
          <div class="marketplace-card-footer">
            <strong>${esc(priceLabel(listing))}</strong>
            <span class="marketplace-listing-actions">${lifecycleButtons(listing)}</span>
          </div>
        </div>
      </article>
    `;
  }

  async function mount(root, context) {
    if (!root || !context?.client || !context?.userId || !context.isAuthenticated || context.accountStatus !== "active" || context.marketplaceAccessReady !== true) return;

    const { client } = context;
    root.innerHTML = `
      <section class="marketplace-section-heading">
        <div>
          <p class="eyebrow">My Listings</p>
          <h2>Manage Marketplace listings</h2>
          <p class="marketplace-help">Create a listing manually or prefill safe fields from an animal already in HerdHarbor. A Marketplace listing is a detached snapshot; editing or deleting it does not edit or delete the herd record.</p>
        </div>
        <div class="marketplace-listing-actions">
          <button type="button" class="button button-secondary" id="marketplace-create-manual">Create Manual Listing</button>
          <button type="button" class="button" id="marketplace-select-herd">Select From My Herd</button>
        </div>
      </section>
      <div id="marketplace-seller-profile-notice"></div>
      <section id="marketplace-listing-editor" class="marketplace-listing-editor" hidden></section>
      <section id="marketplace-listing-grid" class="marketplace-listing-grid" aria-live="polite"></section>
    `;

    const editor = root.querySelector("#marketplace-listing-editor");
    const grid = root.querySelector("#marketplace-listing-grid");
    const sellerProfileNotice = root.querySelector("#marketplace-seller-profile-notice");
    let listings = [];
    let herdAnimals = null;
    let liveSellerProfileStatus = clean(context.marketplaceStatus).toLowerCase() || "not_created";

    function renderSellerProfileNotice() {
      if (!sellerProfileNotice) return;
      if (liveSellerProfileStatus === "active") {
        const resumed = new URLSearchParams(window.location.search).get("seller-profile-saved") === "1";
        sellerProfileNotice.innerHTML = resumed
          ? '<div class="marketplace-notice success">Seller Profile saved. Your listing is still a draft; open it and set Status to Available when you are ready to publish.</div>'
          : "";
        if (resumed) {
          const url = new URL(window.location.href);
          url.searchParams.delete("seller-profile-saved");
          history.replaceState(history.state, "", url.pathname + url.search + url.hash);
        }
        return;
      }

      if (liveSellerProfileStatus === "suspended") {
        sellerProfileNotice.innerHTML = '<div class="marketplace-notice error">Your Marketplace seller profile is suspended. Drafts can still be edited, but listings cannot be published until the suspension is lifted.</div>';
        return;
      }

      sellerProfileNotice.innerHTML = '<div class="marketplace-notice">Complete your Seller Profile before publishing a listing. You can create and save drafts now. <button type="button" class="button button-secondary button-small" data-open-seller-profile>Complete Seller Profile</button></div>';
      const button = sellerProfileNotice.querySelector("[data-open-seller-profile]");
      if (button) button.addEventListener("click", function(){ beginSellerProfileSetup(""); });
    }

    async function refreshSellerProfileStatus() {
      try {
        liveSellerProfileStatus = await sellerProfileStatus(client);
      } catch {
        liveSellerProfileStatus = clean(context.marketplaceStatus).toLowerCase() || "not_created";
      }
      renderSellerProfileNotice();
      return liveSellerProfileStatus;
    }

    async function loadListings() {
      await rpc(client, "marketplace_member_refresh_listing_lifecycle").catch(() => 0);
      const data = await rpc(client, "marketplace_member_listings_v2");
      listings = Array.isArray(data) ? data : [];
      const cards = await Promise.all(listings.map((listing) => listingCard(client, listing)));
      grid.innerHTML = cards.length
        ? cards.join("")
        : '<article class="marketplace-placeholder-card"><h3>No listings yet</h3><p>Create a manual listing or select an eligible animal from your herd.</p></article>';

      grid.querySelectorAll("[data-edit-listing]").forEach((button) => {
        button.addEventListener("click", () => {
          const listing = listings.find((item) => String(item.id) === button.dataset.editListing);
          openEditor(listing || null, null);
        });
      });

      grid.querySelectorAll("[data-reconfirm-listing]").forEach((button) => {
        button.addEventListener("click", async () => {
          button.disabled = true;
          try {
            await rpc(client, "marketplace_member_reconfirm_listing", { listing_id_value: button.dataset.reconfirmListing });
            await loadListings();
          } catch {
            button.disabled = false;
            globalThis.alert("This listing could not be renewed. Confirm your Seller Profile is active and try again.");
          }
        });
      });

      grid.querySelectorAll("[data-lifecycle-listing]").forEach((button) => {
        button.addEventListener("click", async () => {
          const nextState = button.dataset.lifecycleState;
          if (nextState === "sold" && !globalThis.confirm("Mark this listing Sold? It will immediately leave normal Marketplace Browse.")) return;
          button.disabled = true;
          try {
            await rpc(client, "marketplace_member_update_listing_lifecycle", {
              listing_id_value: button.dataset.lifecycleListing,
              state_value: nextState
            });
            await loadListings();
          } catch {
            button.disabled = false;
            globalThis.alert("The listing status could not be changed.");
          }
        });
      });
    }

    async function loadHerdAnimals() {
      if (Array.isArray(herdAnimals)) return herdAnimals;
      const data = await rpc(client, "marketplace_member_herd_animals");
      herdAnimals = Array.isArray(data) ? data : [];
      return herdAnimals;
    }

    function renderHerdPicker(animals) {
      editor.hidden = false;
      editor.innerHTML = `
        <div class="marketplace-section-heading compact">
          <div>
            <p class="eyebrow">Select From My Herd</p>
            <h2>Choose an animal</h2>
            <p class="marketplace-help">Only the approved prefill fields are read. Private notes, health records, contact data, and photos are not imported.</p>
          </div>
          <button type="button" class="button button-secondary button-small" data-close-listing-editor>Close</button>
        </div>
        <label>Search my herd
          <input type="search" id="marketplace-herd-search" placeholder="Name, breed, color, status">
        </label>
        <div id="marketplace-herd-picker" class="marketplace-herd-picker"></div>
      `;

      const picker = editor.querySelector("#marketplace-herd-picker");
      const search = editor.querySelector("#marketplace-herd-search");

      function draw() {
        const q = clean(search.value).toLowerCase();
        const matches = animals.filter((animal) => !q || [
          animal.animal_name,
          animal.species,
          animal.breed,
          animal.sex,
          animal.variety_color,
          animal.herd_status
        ].some((value) => clean(value).toLowerCase().includes(q)));

        picker.innerHTML = matches.length
          ? matches.map((animal) => `
              <button type="button" class="marketplace-herd-option" data-source-animal="${esc(animal.source_animal_id)}">
                <strong>${esc(animal.animal_name || "Unnamed animal")}</strong>
                <span>${esc([animal.breed, animal.variety_color, animal.sex, animal.herd_status].filter(Boolean).join(" · ") || animal.species || "Animal")}</span>
              </button>
            `).join("")
          : '<p class="marketplace-help">No matching eligible animals.</p>';

        picker.querySelectorAll("[data-source-animal]").forEach((button) => {
          button.addEventListener("click", () => {
            const animal = animals.find((item) => String(item.source_animal_id) === button.dataset.sourceAnimal);
            openEditor(null, animal || null);
          });
        });
      }

      search.addEventListener("input", draw);
      editor.querySelector("[data-close-listing-editor]").addEventListener("click", () => {
        editor.hidden = true;
      });
      draw();
      editor.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function option(value, selected, label = value) {
      return `<option value="${esc(value)}" ${selected === value ? "selected" : ""}>${esc(label)}</option>`;
    }

    function openEditor(listing, sourceAnimal) {
      if (clean(listing?.state).toLowerCase() === "removed") {
        editor.hidden = false;
        editor.innerHTML = '<div class="marketplace-notice error">This listing was removed by Marketplace moderation and cannot be edited or deleted by the seller. The Owner must restore it to draft first.</div>';
        editor.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      const listingId = clean(listing?.id);
      const sourceId = clean(listing?.source_animal_id || sourceAnimal?.source_animal_id);
      const asking = listing ? centsToMoney(listing.price_cents) : clean(sourceAnimal?.asking_price);

      editor.hidden = false;
      editor.innerHTML = `
        <form id="marketplace-listing-form" class="seller-profile-form">
          <div class="marketplace-section-heading compact">
            <div>
              <p class="eyebrow">${sourceId ? "Herd Snapshot" : "Manual Listing"}</p>
              <h2>${listingId ? "Edit listing" : "Create listing"}</h2>
            </div>
            <button type="button" class="button button-secondary button-small" data-close-listing-editor>Close</button>
          </div>

          <input type="hidden" name="listing_id" value="${esc(listingId)}">
          <input type="hidden" name="source_animal_id" value="${esc(sourceId)}">

          <div class="field-row">
            <label>Listing type
              <select name="listing_kind">
                ${option("individual", listing?.listing_kind || "individual", "Individual animal")}
                ${option("future_offspring", listing?.listing_kind || "individual", "Future offspring")}
                ${option("litter_announcement", listing?.listing_kind || "individual", "Litter announcement")}
              </select>
            </label>
            <label>Status
              <select name="state">
                ${["draft","available","pending","sold","archived"].map((value) => option(value, listing?.state || "draft")).join("")}
              </select>
            </label>
          </div>

          <div class="field-row">
            <label>Animal name
              <input name="animal_name" maxlength="120" required value="${esc(listing?.animal_name || sourceAnimal?.animal_name || "")}">
            </label>
            <label>Species
              <input name="species" maxlength="80" value="${esc(listing?.species || sourceAnimal?.species || "Rabbit")}">
            </label>
          </div>

          <div class="field-row">
            <label>Breed
              <input name="breed" maxlength="120" value="${esc(listing?.breed || sourceAnimal?.breed || "")}">
            </label>
            <label>Sex
              <input name="sex" maxlength="32" value="${esc(listing?.sex || sourceAnimal?.sex || "")}">
            </label>
          </div>

          <div class="field-row">
            <label>Date of birth
              <input name="dob" type="date" value="${esc(listing?.dob || sourceAnimal?.dob || "")}">
            </label>
            <label>Color / variety
              <input name="variety_color" maxlength="120" value="${esc(listing?.variety_color || sourceAnimal?.variety_color || "")}">
            </label>
          </div>

          <div class="field-row">
            <label>Price
              <input name="price" type="number" min="0" step="0.01" value="${esc(asking)}">
            </label>
            <label>Available from
              <input name="available_from" type="date" value="${esc(listing?.available_from || "")}">
            </label>
          </div>

          <div class="field-row">
            <label>City
              <input name="location_city" maxlength="100" value="${esc(listing?.location_city || "")}">
            </label>
            <label>State / region
              <input name="location_region" maxlength="100" value="${esc(listing?.location_region || "")}">
            </label>
          </div>

          <div class="field-row">
            <label>Pedigree
              <select name="pedigree_status">
                ${option("", listing?.pedigree_status || "", "Not specified")}
                ${option("none", listing?.pedigree_status || "")}
                ${option("partial", listing?.pedigree_status || "")}
                ${option("full", listing?.pedigree_status || "")}
              </select>
            </label>
            <label>Pedigree preview
              <select name="pedigree_visibility" ${sourceId ? "" : "disabled"}>
                ${option("hidden", listing?.pedigree_visibility || "hidden", "Hidden")}
                ${option("parents", listing?.pedigree_visibility || "hidden", "Parents")}
                ${option("3", listing?.pedigree_visibility || "hidden", "3 generations")}
                ${option("4", listing?.pedigree_visibility || "hidden", "4 generations")}
                ${option("5", listing?.pedigree_visibility || "hidden", "5 generations")}
              </select>
              <span class="marketplace-help">${sourceId ? "Controls the read-only public-shaped pedigree snapshot. Private notes, health records, photos, and source IDs are never included." : "Pedigree preview requires a listing linked through Select From My Herd. Manual listings remain hidden."}</span>
            </label>
            <label>Registration
              <select name="registration_status">
                ${option("", listing?.registration_status || "", "Not specified")}
                ${option("none", listing?.registration_status || "")}
                ${option("eligible", listing?.registration_status || "")}
                ${option("registered", listing?.registration_status || "")}
              </select>
            </label>
          </div>

          <label>Description
            <textarea name="description" maxlength="4000" rows="7">${esc(listing?.description || "")}</textarea>
          </label>

          <label>Photos
            <input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple>
            <span class="marketplace-help">Up to six JPG, PNG, or WebP photos; 8 MB maximum each. Existing photos remain unless you choose replacement photos.</span>
          </label>

          <div class="seller-profile-actions">
            <button class="button" type="submit">${listingId ? "Save Changes" : "Create Listing"}</button>
            ${listingId ? '<button class="button button-secondary" type="button" data-delete-listing>Delete Listing</button>' : ""}
            <span id="marketplace-listing-status" class="marketplace-form-status" role="status"></span>
          </div>
        </form>
      `;

      const form = editor.querySelector("#marketplace-listing-form");
      const status = editor.querySelector("#marketplace-listing-status");

      function setStatus(message, state = "") {
        status.textContent = message;
        status.dataset.state = state;
      }

      editor.querySelector("[data-close-listing-editor]").addEventListener("click", () => {
        editor.hidden = true;
      });

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const submit = form.querySelector('button[type="submit"]');
        submit.disabled = true;
        setStatus("Saving…");

        let uploadedPaths = [];
        let photosCommitted = false;
        let listingRecordSaved = false;
        let savedId = clean(form.elements.listing_id.value);

        try {
          const requestedState = clean(form.elements.state.value).toLowerCase() || "draft";
          let saveState = requestedState;
          let requiresSellerProfileSetup = false;

          if (requestedState === "available") {
            const currentProfileStatus = await refreshSellerProfileStatus();
            if (currentProfileStatus === "suspended") {
              throw new Error("Your Marketplace seller profile is suspended. This listing cannot be published.");
            }
            if (currentProfileStatus !== "active") {
              requiresSellerProfileSetup = true;
              saveState = "draft";
              setStatus("Saving as draft before Seller Profile setup…");
            }
          }

          const files = [...(form.elements.photos.files || [])];
          if (files.length > MAX_PHOTOS) throw new Error("Choose no more than six listing photos.");
          for (const file of files) {
            const ext = ALLOWED_IMAGE_TYPES.get(file.type);
            if (!ext || file.size <= 0 || file.size > MAX_PHOTO_BYTES) {
              throw new Error("Listing photos must be JPG, PNG, or WebP and no larger than 8 MB each.");
            }
          }

          savedId = await rpc(client, "marketplace_member_save_listing", {
            listing_id_value: clean(form.elements.listing_id.value) || null,
            source_animal_id_value: clean(form.elements.source_animal_id.value) || null,
            state_value: saveState,
            animal_name_value: clean(form.elements.animal_name.value),
            species_value: clean(form.elements.species.value),
            breed_value: clean(form.elements.breed.value),
            sex_value: clean(form.elements.sex.value),
            dob_value: form.elements.dob.value || null,
            variety_color_value: clean(form.elements.variety_color.value),
            price_cents_value: moneyToCents(form.elements.price.value),
            currency_value: "USD",
            location_city_value: clean(form.elements.location_city.value),
            location_region_value: clean(form.elements.location_region.value),
            description_value: clean(form.elements.description.value),
            pedigree_status_value: form.elements.pedigree_status.value,
            registration_status_value: form.elements.registration_status.value,
            pedigree_visibility_value: sourceId ? form.elements.pedigree_visibility.value : "hidden",
            listing_kind_value: form.elements.listing_kind.value,
            available_from_value: form.elements.available_from.value || null
          });
          listingRecordSaved = true;
          form.elements.listing_id.value = String(savedId || "");

          if (files.length) {
            const previousPaths = Array.isArray(listing?.photo_paths) ? listing.photo_paths.filter(Boolean) : [];
            uploadedPaths = await uploadPhotos(client, savedId, files);
            await rpc(client, "marketplace_member_set_listing_photos", {
              listing_id_value: savedId,
              paths_value: uploadedPaths
            });
            photosCommitted = true;
            if (previousPaths.length) await removePaths(client, previousPaths).catch(() => {});
          }

          const sourceAnimalId = clean(form.elements.source_animal_id.value);
          const visibility = sourceAnimalId ? form.elements.pedigree_visibility.value : "hidden";
          const pedigreeRefresh = await refreshPedigreeSnapshot(client, savedId, visibility, sourceAnimalId);

          if (requiresSellerProfileSetup) {
            form.elements.state.value = "draft";
            setStatus("Listing saved as draft. Complete your Seller Profile to publish it.", "success");
            editor.hidden = true;
            herdAnimals = null;
            await loadListings();
            beginSellerProfileSetup();
            return;
          }

          if (visibility !== "hidden" && sourceAnimalId && pedigreeRefresh?.error) {
            setStatus("Listing saved. Pedigree preview needs to be refreshed.", "error");
          } else {
            setStatus("Listing saved.", "success");
          }

          editor.hidden = true;
          herdAnimals = null;
          await loadListings();
        } catch (error) {
          if (uploadedPaths.length && !photosCommitted) {
            await removePaths(client, uploadedPaths).catch(() => {});
          }
          if (listingRecordSaved) {
            setStatus("Listing details were saved, but a follow-up Marketplace update failed. Reopen the listing and retry the failed step.", "error");
            await loadListings().catch(() => {});
          } else {
            setStatus(error?.message || "Listing could not be saved.", "error");
          }
        } finally {
          submit.disabled = false;
        }
      });

      editor.querySelector("[data-delete-listing]")?.addEventListener("click", async () => {
        if (!globalThis.confirm("Delete this Marketplace listing? The source HerdHarbor animal will not be changed.")) return;
        setStatus("Deleting…");
        try {
          const deleted = await rpc(client, "marketplace_member_delete_listing", { listing_id_value: listingId });
          if (deleted !== true) {
            throw new Error("This listing cannot be deleted while it is under Marketplace moderation.");
          }
          const previousPaths = Array.isArray(listing?.photo_paths) ? listing.photo_paths.filter(Boolean) : [];
          let cleanupFailed = false;
          if (previousPaths.length) {
            try {
              await removePaths(client, previousPaths);
            } catch {
              cleanupFailed = true;
            }
          }
          editor.hidden = true;
          await loadListings();
          setStatus(
            cleanupFailed
              ? "Listing deleted, but one or more stored photos could not be cleaned up."
              : "Listing deleted.",
            cleanupFailed ? "error" : "success"
          );
        } catch (error) {
          setStatus(error?.message || "Listing could not be deleted.", "error");
        }
      });

      editor.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    root.querySelector("#marketplace-create-manual").addEventListener("click", () => openEditor(null, null));
    root.querySelector("#marketplace-select-herd").addEventListener("click", async () => {
      editor.hidden = false;
      editor.innerHTML = '<p class="marketplace-help">Loading eligible animals…</p>';
      try {
        renderHerdPicker(await loadHerdAnimals());
      } catch (error) {
        editor.innerHTML = `<div class="marketplace-notice error">${esc(error?.message || "Eligible herd animals could not be loaded.")}</div>`;
      }
    });

    try {
      await refreshSellerProfileStatus();
      await loadListings();
    } catch (error) {
      grid.innerHTML = `<div class="marketplace-notice error">${esc(error?.message || "Listings could not be loaded.")}</div>`;
    }
  }

  window.HerdHarborMarketplaceListings = Object.freeze({ mount });
})();
