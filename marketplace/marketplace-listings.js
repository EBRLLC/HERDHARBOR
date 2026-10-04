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

  async function signedUrl(client, path) {
    if (!path) return "";
    const { data, error } = await client.storage.from(BUCKET).createSignedUrl(path, 900);
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

  async function uploadPhotos(client, userId, listingId, files) {
    const uploaded = [];
    try {
      for (const [index, file] of files.slice(0, MAX_PHOTOS).entries()) {
        const ext = ALLOWED_IMAGE_TYPES.get(file.type);
        if (!ext || file.size <= 0 || file.size > MAX_PHOTO_BYTES) {
          throw new Error("Listing photos must be JPG, PNG, or WebP and no larger than 8 MB each.");
        }

        const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${index}`;
        const path = `${userId}/listings/${listingId}/photo-${index}-${token}.${ext}`;
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

  async function listingCard(client, listing) {
    const firstPath = Array.isArray(listing.photo_paths) ? listing.photo_paths[0] : "";
    const photo = await signedUrl(client, firstPath);
    const location = [listing.location_city, listing.location_region].filter(Boolean).join(", ");

    return `
      <article class="marketplace-listing-card" data-listing-id="${esc(listing.id)}">
        <div class="marketplace-listing-photo">
          ${photo ? `<img src="${esc(photo)}" alt="">` : '<div class="marketplace-listing-photo-empty">HH</div>'}
          <span class="marketplace-state-pill">${esc(listing.state || "draft")}</span>
        </div>
        <div class="marketplace-listing-copy">
          <p class="eyebrow">${esc((listing.listing_kind || "individual").replaceAll("_", " "))}</p>
          <h3>${esc(listing.animal_name || "Unnamed listing")}</h3>
          <p class="marketplace-card-meta">${esc([listing.breed, listing.variety_color, listing.sex].filter(Boolean).join(" · ") || listing.species || "Animal")}</p>
          <p class="marketplace-card-meta">${esc(location || "Location not set")}</p>
          <div class="marketplace-card-footer">
            <strong>${esc(priceLabel(listing))}</strong>
            <button type="button" class="button button-secondary button-small" data-edit-listing="${esc(listing.id)}">Edit</button>
          </div>
        </div>
      </article>
    `;
  }

  async function mount(root, context) {
    if (!root || !context?.client || !context?.userId || context.role !== "owner") return;

    const { client, userId } = context;
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
      <section id="marketplace-listing-editor" class="marketplace-listing-editor" hidden></section>
      <section id="marketplace-listing-grid" class="marketplace-listing-grid" aria-live="polite"></section>
    `;

    const editor = root.querySelector("#marketplace-listing-editor");
    const grid = root.querySelector("#marketplace-listing-grid");
    let listings = [];
    let herdAnimals = null;

    async function loadListings() {
      const data = await rpc(client, "marketplace_owner_listings");
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
    }

    async function loadHerdAnimals() {
      if (Array.isArray(herdAnimals)) return herdAnimals;
      const data = await rpc(client, "marketplace_owner_herd_animals");
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
              <select name="pedigree_visibility">
                ${option("hidden", listing?.pedigree_visibility || "hidden", "Hidden")}
                ${option("parents", listing?.pedigree_visibility || "hidden", "Parents")}
                ${option("3", listing?.pedigree_visibility || "hidden", "3 generations")}
                ${option("4", listing?.pedigree_visibility || "hidden", "4 generations")}
                ${option("5", listing?.pedigree_visibility || "hidden", "5 generations")}
              </select>
              <span class="marketplace-help">Controls the read-only public-shaped pedigree snapshot. Private notes, health records, photos, and source IDs are never included.</span>
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
        try {
          const savedId = await rpc(client, "marketplace_owner_save_listing", {
            listing_id_value: clean(form.elements.listing_id.value) || null,
            source_animal_id_value: clean(form.elements.source_animal_id.value) || null,
            state_value: form.elements.state.value,
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
            pedigree_visibility_value: form.elements.pedigree_visibility.value,
            listing_kind_value: form.elements.listing_kind.value,
            available_from_value: form.elements.available_from.value || null
          });

          const files = [...(form.elements.photos.files || [])];
          if (files.length > MAX_PHOTOS) throw new Error("Choose no more than six listing photos.");

          if (files.length) {
            const previousPaths = Array.isArray(listing?.photo_paths) ? listing.photo_paths.filter(Boolean) : [];
            uploadedPaths = await uploadPhotos(client, userId, savedId, files);
            await rpc(client, "marketplace_owner_set_listing_photos", {
              listing_id_value: savedId,
              paths_value: uploadedPaths
            });
            if (previousPaths.length) await removePaths(client, previousPaths).catch(() => {});
          }

          const visibility = form.elements.pedigree_visibility.value;
          const sourceAnimalId = clean(form.elements.source_animal_id.value);
          const pedigreeRefresh = await refreshPedigreeSnapshot(client, savedId, visibility, sourceAnimalId);

          if (visibility !== "hidden" && sourceAnimalId && pedigreeRefresh?.error) {
            setStatus("Listing saved. Pedigree preview needs to be refreshed.", "error");
          } else {
            setStatus("Listing saved.", "success");
          }

          editor.hidden = true;
          herdAnimals = null;
          await loadListings();
        } catch (error) {
          if (uploadedPaths.length) await removePaths(client, uploadedPaths).catch(() => {});
          setStatus(error?.message || "Listing could not be saved.", "error");
        } finally {
          submit.disabled = false;
        }
      });

      editor.querySelector("[data-delete-listing]")?.addEventListener("click", async () => {
        if (!globalThis.confirm("Delete this Marketplace listing? The source HerdHarbor animal will not be changed.")) return;
        setStatus("Deleting…");
        try {
          await rpc(client, "marketplace_owner_delete_listing", { listing_id_value: listingId });
          const previousPaths = Array.isArray(listing?.photo_paths) ? listing.photo_paths.filter(Boolean) : [];
          if (previousPaths.length) await removePaths(client, previousPaths).catch(() => {});
          editor.hidden = true;
          await loadListings();
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
      await loadListings();
    } catch (error) {
      grid.innerHTML = `<div class="marketplace-notice error">${esc(error?.message || "Listings could not be loaded.")}</div>`;
    }
  }

  window.HerdHarborMarketplaceListings = Object.freeze({ mount });
})();
