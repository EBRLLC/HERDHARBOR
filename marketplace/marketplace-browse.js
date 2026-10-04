(() => {
  "use strict";

  const PAGE_SIZE = 24;
  const BUCKET = "marketplace-public";

  const clean = (value) => String(value ?? "").trim();
  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  async function rpc(client, name, args) {
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

  function dollarsToCents(value) {
    const number = Number(clean(value));
    return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) : null;
  }

  function currentState() {
    const params = new URLSearchParams(window.location.search);
    return {
      q: clean(params.get("q")),
      species: clean(params.get("species")),
      breed: clean(params.get("breed")),
      sex: clean(params.get("sex")),
      region: clean(params.get("region")),
      pedigree: clean(params.get("pedigree")),
      kind: clean(params.get("kind")),
      min: clean(params.get("min")),
      max: clean(params.get("max")),
      sort: clean(params.get("sort")) || "newest",
      page: Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1)
    };
  }

  function stateUrl(state) {
    const url = new URL(window.location.href);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(state)) {
      if (key === "page") {
        if (Number(value) > 1) params.set("page", String(value));
      } else if (clean(value)) {
        params.set(key, clean(value));
      }
    }
    url.search = params.toString();
    return url.pathname + (url.search ? url.search : "");
  }

  function accountUrl(next = window.location.pathname + window.location.search) {
    return "/marketplace/account/?next=" + encodeURIComponent(next);
  }

  async function mediaMap(client, listingIds) {
    if (!listingIds.length) return new Map();
    const rows = await rpc(client, "marketplace_public_listing_media_v2", {
      listing_ids_value: listingIds
    });
    const result = new Map();
    for (const row of Array.isArray(rows) ? rows : []) {
      const paths = Array.isArray(row.photo_paths) ? row.photo_paths : [];
      const first = paths[0] || "";
      if (!first) {
        result.set(String(row.listing_id), "");
        continue;
      }
      const { data, error } = await client.storage.from(BUCKET).createSignedUrl(first, 300);
      result.set(String(row.listing_id), error ? "" : (data?.signedUrl || ""));
    }
    return result;
  }

  function optionList(values, current, emptyLabel) {
    const safe = Array.isArray(values) ? values.filter((value) => clean(value)) : [];
    return [
      '<option value="">' + esc(emptyLabel) + '</option>',
      ...safe.map((value) => '<option value="' + esc(value) + '"' +
        (clean(current).toLowerCase() === clean(value).toLowerCase() ? " selected" : "") +
        '>' + esc(value) + '</option>')
    ].join("");
  }

  function listingCard(row, photoUrl, favorite, interactive) {
    const location = [row.location_city, row.location_region].filter(Boolean).join(", ");
    const details = [row.breed, row.variety_color, row.sex].filter(Boolean).join(" · ");
    const seller = row.rabbitry_name || row.seller_display_name || "HerdHarbor seller";
    const verified = clean(row.seller_verification_status).toLowerCase() === "verified";
    const pedigree = row.pedigree_status
      ? '<span class="marketplace-chip">Pedigree: ' + esc(row.pedigree_status) + '</span>'
      : "";

    return `
      <article class="browse-card">
        <a class="browse-card-link" href="/marketplace/listing/?id=${encodeURIComponent(row.listing_id)}" aria-label="View ${esc(row.animal_name || "listing")}">
          <div class="browse-card-media">
            ${photoUrl ? '<img src="' + esc(photoUrl) + '" alt="" loading="lazy" decoding="async">' : '<div class="browse-card-fallback">HH</div>'}
            ${pedigree}
          </div>
          <div class="browse-card-body">
            <div class="browse-card-price">${esc(money(row.price_cents, row.currency))}</div>
            <h3>${esc(row.animal_name || "Unnamed listing")}</h3>
            <p>${esc(details || row.species || "Animal")}</p>
            <p>${esc(location || "Location not listed")}</p>
            <div class="browse-card-seller">
              <span>${esc(seller)}</span>
              ${verified ? '<span class="marketplace-verified" aria-label="Verified seller">Verified</span>' : ""}
            </div>
          </div>
        </a>
        <button class="marketplace-favorite" type="button"
          data-favorite-listing="${esc(row.listing_id)}"
          aria-pressed="${favorite ? "true" : "false"}"
          aria-label="${interactive ? (favorite ? "Remove from favorites" : "Add to favorites") : "Sign in to save this listing"}">
          <span aria-hidden="true">${favorite ? "♥" : "♡"}</span>
        </button>
      </article>
    `;
  }

  async function mount(root, context) {
    if (!root || !context?.client) return;
    const { client } = context;
    const interactive = context.isAuthenticated && context.accountStatus === "active";
    let facets = {};
    let favoriteIds = new Set();
    let requestToken = 0;
    let mediaRecoveryAttempted = false;

    root.innerHTML = `
      <section class="marketplace-browse-hero">
        <div>
          <p class="eyebrow">Browse Marketplace</p>
          <h2>Find animals for sale without creating an account.</h2>
          <p class="marketplace-help">Anyone can browse available listings. A HerdHarbor account is required only when you want to save a listing, message a seller, post an animal, or use Marketplace account features.</p>
        </div>
      </section>

      <form id="marketplace-browse-form" class="marketplace-browse-form">
        <label class="marketplace-search-field">
          <span>Search Marketplace</span>
          <input name="q" type="search" placeholder="Name, breed, color, rabbitry, city or state">
        </label>
        <div class="marketplace-filter-grid">
          <label>Species<select name="species"></select></label>
          <label>Breed<select name="breed"></select></label>
          <label>Sex<select name="sex"></select></label>
          <label>State / region<select name="region"></select></label>
          <label>Pedigree
            <select name="pedigree">
              <option value="">Any pedigree</option>
              <option value="none">None</option>
              <option value="partial">Partial</option>
              <option value="full">Full</option>
            </select>
          </label>
          <label>Listing type<select name="kind"></select></label>
          <label>Min price<input name="min" type="number" min="0" step="1" inputmode="decimal" placeholder="$0"></label>
          <label>Max price<input name="max" type="number" min="0" step="1" inputmode="decimal" placeholder="No max"></label>
          <label>Sort
            <select name="sort">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
            </select>
          </label>
        </div>
        <div class="marketplace-filter-actions">
          <button class="button" type="submit">Search</button>
          <button class="button button-secondary" type="button" id="marketplace-clear-filters">Clear filters</button>
        </div>
      </form>

      <section class="marketplace-results-heading">
        <div>
          <p class="eyebrow">Available listings</p>
          <h2 id="marketplace-result-count">Loading…</h2>
        </div>
      </section>
      <section id="marketplace-browse-results" class="marketplace-browse-grid" aria-live="polite"></section>
      <nav id="marketplace-pager" class="marketplace-pager" aria-label="Marketplace result pages"></nav>
    `;

    const form = root.querySelector("#marketplace-browse-form");
    const results = root.querySelector("#marketplace-browse-results");
    const countNode = root.querySelector("#marketplace-result-count");
    const pager = root.querySelector("#marketplace-pager");

    async function loadFacets() {
      facets = await rpc(client, "marketplace_public_facets_v2") || {};
      const state = currentState();
      form.elements.species.innerHTML = optionList(facets.species, state.species, "All species");
      form.elements.breed.innerHTML = optionList(facets.breeds, state.breed, "All breeds");
      form.elements.sex.innerHTML = optionList(facets.sexes, state.sex, "Any sex");
      form.elements.region.innerHTML = optionList(facets.regions, state.region, "Any state / region");
      form.elements.kind.innerHTML = optionList(facets.listing_kinds, state.kind, "Any listing type");
    }

    async function loadFavorites() {
      if (!interactive) {
        favoriteIds = new Set();
        return;
      }
      const data = await rpc(client, "marketplace_member_favorite_ids");
      favoriteIds = new Set(Array.isArray(data) ? data.map(String) : []);
    }

    function applyState(state) {
      for (const name of ["q","species","breed","sex","region","pedigree","kind","min","max","sort"]) {
        if (form.elements[name]) form.elements[name].value = state[name] || "";
      }
    }

    function formState() {
      return {
        q: clean(form.elements.q.value),
        species: clean(form.elements.species.value),
        breed: clean(form.elements.breed.value),
        sex: clean(form.elements.sex.value),
        region: clean(form.elements.region.value),
        pedigree: clean(form.elements.pedigree.value),
        kind: clean(form.elements.kind.value),
        min: clean(form.elements.min.value),
        max: clean(form.elements.max.value),
        sort: clean(form.elements.sort.value) || "newest",
        page: 1
      };
    }

    async function refresh() {
      const token = ++requestToken;
      const state = currentState();
      applyState(state);
      results.innerHTML = '<article class="marketplace-placeholder-card" aria-busy="true"><p>Loading Marketplace listings…</p></article>';
      pager.innerHTML = "";

      try {
        const rows = await rpc(client, "marketplace_public_search_v2", {
          query_value: state.q,
          species_value: state.species,
          breed_value: state.breed,
          sex_value: state.sex,
          region_value: state.region,
          pedigree_status_value: state.pedigree,
          listing_kind_value: state.kind,
          min_price_cents_value: state.min ? dollarsToCents(state.min) : null,
          max_price_cents_value: state.max ? dollarsToCents(state.max) : null,
          seller_public_id_value: null,
          sort_value: state.sort,
          limit_value: PAGE_SIZE,
          offset_value: (state.page - 1) * PAGE_SIZE
        });
        if (token !== requestToken) return;

        const list = Array.isArray(rows) ? rows : [];
        const total = Number(list[0]?.total_count || 0);
        const media = await mediaMap(client, list.map((row) => row.listing_id));
        if (token !== requestToken) return;

        countNode.textContent = total === 1 ? "1 listing" : total + " listings";
        results.innerHTML = list.length
          ? list.map((row) => listingCard(
              row,
              media.get(String(row.listing_id)) || "",
              favoriteIds.has(String(row.listing_id)),
              interactive
            )).join("")
          : '<article class="marketplace-empty-state"><h3>No matching listings</h3><p>Try widening the filters or clearing the search.</p></article>';

        results.querySelectorAll(".browse-card-media img").forEach((img) => {
          img.addEventListener("error", () => {
            if (!mediaRecoveryAttempted) {
              mediaRecoveryAttempted = true;
              refresh();
              return;
            }
            const mediaNode = img.closest(".browse-card-media");
            if (mediaNode) mediaNode.innerHTML = '<div class="browse-card-fallback">HH</div>';
          }, { once: true });
        });

        results.querySelectorAll("[data-favorite-listing]").forEach((button) => {
          button.addEventListener("click", async () => {
            if (!interactive) {
              window.location.assign(accountUrl(stateUrl(currentState())));
              return;
            }

            const id = button.dataset.favoriteListing;
            const next = !favoriteIds.has(id);
            button.disabled = true;
            try {
              await rpc(client, "marketplace_member_toggle_favorite", {
                listing_id_value: id,
                favorite_value: next
              });
              if (next) favoriteIds.add(id); else favoriteIds.delete(id);
              button.setAttribute("aria-pressed", String(next));
              button.setAttribute("aria-label", next ? "Remove from favorites" : "Add to favorites");
              button.querySelector("span").textContent = next ? "♥" : "♡";
            } finally {
              button.disabled = false;
            }
          });
        });

        const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
        if (pageCount > 1) {
          pager.innerHTML = `
            <button class="button button-secondary button-small" type="button" data-page="${Math.max(1, state.page - 1)}" ${state.page <= 1 ? "disabled" : ""}>Previous</button>
            <span>Page ${state.page} of ${pageCount}</span>
            <button class="button button-secondary button-small" type="button" data-page="${Math.min(pageCount, state.page + 1)}" ${state.page >= pageCount ? "disabled" : ""}>Next</button>
          `;
          pager.querySelectorAll("[data-page]").forEach((button) => {
            button.addEventListener("click", () => {
              const next = { ...currentState(), page: Number(button.dataset.page) || 1 };
              history.pushState({ marketplace: true }, "", stateUrl(next));
              refresh();
              root.scrollIntoView({ behavior: "smooth", block: "start" });
            });
          });
        }
      } catch {
        countNode.textContent = "Marketplace unavailable";
        results.innerHTML = '<div class="marketplace-notice error">Marketplace listings could not be loaded. Try again.</div>';
      }
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      history.pushState({ marketplace: true }, "", stateUrl(formState()));
      refresh();
    });

    root.querySelector("#marketplace-clear-filters").addEventListener("click", () => {
      history.pushState({ marketplace: true }, "", window.location.pathname);
      applyState({ sort: "newest" });
      refresh();
    });

    try {
      await Promise.all([loadFacets(), loadFavorites()]);
      applyState(currentState());
      await refresh();
    } catch {
      countNode.textContent = "Marketplace unavailable";
      results.innerHTML = '<div class="marketplace-notice error">Marketplace could not be loaded. Try again.</div>';
    }
  }

  window.HerdHarborMarketplaceBrowse = Object.freeze({ mount });
})();
