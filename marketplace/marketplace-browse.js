(() => {
  "use strict";

  const PAGE_SIZE = 24;

  const BASE_SPECIES = Object.freeze(["Rabbit","Cattle","Goat","Sheep","Poultry","Swine"]);
  const BASE_BREEDS = Object.freeze({
    rabbit: Object.freeze([
      "American","American Chinchilla","American Fuzzy Lop","American Sable","Belgian Hare",
      "Beveren","Blanc de Hotot","Britannia Petite","Californian","Champagne d'Argent",
      "Checkered Giant","Cinnamon","Creme d'Argent","Dutch","Dwarf Hotot","English Angora",
      "English Lop","English Spot","Flemish Giant","Florida White","French Angora","French Lop",
      "Giant Angora","Giant Chinchilla","Harlequin","Havana","Himalayan","Holland Lop",
      "Jersey Wooly","Lilac","Lionhead","Mini Lop","Mini Rex","Mini Satin","Netherland Dwarf",
      "New Zealand","Palomino","Polish","Rex","Rhinelander","Satin","Satin Angora","Silver",
      "Silver Fox","Silver Marten","Standard Chinchilla","Tan","Thrianta","Mixed / Crossbred"
    ]),
    cattle: Object.freeze([
      "Angus","Red Angus","Hereford","Holstein","Jersey","Brown Swiss","Guernsey","Charolais",
      "Simmental","Limousin","Shorthorn","Brahman","Highland","Belted Galloway","Gelbvieh",
      "Mixed / Crossbred"
    ]),
    goat: Object.freeze([
      "Alpine","Angora","Boer","Kiko","LaMancha","Myotonic","Nigerian Dwarf","Nubian",
      "Oberhasli","Pygmy","Saanen","Sable","Spanish","Toggenburg","Mixed / Crossbred"
    ]),
    sheep: Object.freeze([
      "Border Leicester","Cheviot","Columbia","Dorper","Dorset","Finnsheep","Hampshire","Icelandic",
      "Jacob","Katahdin","Merino","Rambouillet","Southdown","Suffolk","Texel","Mixed / Crossbred"
    ]),
    poultry: Object.freeze([
      "Ameraucana","Australorp","Barred Plymouth Rock","Brahma","Cochin","Cornish","Delaware",
      "Leghorn","Marans","New Hampshire","Orpington","Rhode Island Red","Silkie","Sussex",
      "Wyandotte","Mixed / Crossbred"
    ]),
    swine: Object.freeze([
      "Berkshire","Chester White","Duroc","Gloucestershire Old Spots","Hampshire","Hereford",
      "Landrace","Large Black","Mangalitsa","Poland China","Red Wattle","Tamworth","Yorkshire",
      "Mixed / Crossbred"
    ])
  });
  const SEX_OPTIONS = Object.freeze([
    Object.freeze({ value: "male", label: "Male / Buck / Bull / Boar / Ram / Rooster" }),
    Object.freeze({ value: "female", label: "Female / Doe / Cow / Sow / Ewe / Hen" }),
    Object.freeze({ value: "unknown", label: "Unknown / Unsexed" })
  ]);
  const LISTING_KIND_OPTIONS = Object.freeze([
    Object.freeze({ value: "individual", label: "Individual animal" }),
    Object.freeze({ value: "future_offspring", label: "Future offspring" }),
    Object.freeze({ value: "litter_announcement", label: "Litter announcement" })
  ]);
  const US_STATES = Object.freeze([
    ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],
    ["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["DC","District of Columbia"],
    ["FL","Florida"],["GA","Georgia"],["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],
    ["IN","Indiana"],["IA","Iowa"],["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],
    ["ME","Maine"],["MD","Maryland"],["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],
    ["MS","Mississippi"],["MO","Missouri"],["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],
    ["NH","New Hampshire"],["NJ","New Jersey"],["NM","New Mexico"],["NY","New York"],
    ["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],["OK","Oklahoma"],["OR","Oregon"],
    ["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],["SD","South Dakota"],
    ["TN","Tennessee"],["TX","Texas"],["UT","Utah"],["VT","Vermont"],["VA","Virginia"],
    ["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"]
  ].map(([value,name]) => Object.freeze({ value, label: name + " (" + value + ")" })));

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
    const { data, error } = await client.functions.invoke("marketplace-public-media", {
      body: { action: "listing", listingIds, maxPerListing: 1 }
    });
    if (error) throw error;
    const listings = data?.listings && typeof data.listings === "object" ? data.listings : {};
    const result = new Map();
    for (const id of listingIds) {
      const urls = Array.isArray(listings[id]) ? listings[id] : [];
      result.set(String(id), urls[0] || "");
    }
    return result;
  }

  const SPECIES_ALIASES = Object.freeze({
    rabbit: "rabbit", rabbits: "rabbit",
    cattle: "cattle", cow: "cattle", cows: "cattle",
    goat: "goat", goats: "goat", sheep: "sheep",
    poultry: "poultry", chicken: "poultry", chickens: "poultry",
    swine: "swine", pig: "swine", pigs: "swine"
  });
  const SEX_ALIASES = Object.freeze({
    male: "male", m: "male", buck: "male", bull: "male", boar: "male", ram: "male",
    rooster: "male", cock: "male", steer: "male", wether: "male", barrow: "male", capon: "male",
    female: "female", f: "female", doe: "female", cow: "female", sow: "female", ewe: "female",
    hen: "female", heifer: "female", gilt: "female",
    unknown: "unknown", unsexed: "unknown", na: "unknown", "n/a": "unknown"
  });
  const STATE_CODES = new Map();
  for (const entry of US_STATES) {
    STATE_CODES.set(entry.value.toLowerCase(), entry.value);
    STATE_CODES.set(entry.label.replace(/\s*\([A-Z]{2}\)$/, "").toLowerCase(), entry.value);
  }
  STATE_CODES.set("washington dc", "DC");
  STATE_CODES.set("washington, dc", "DC");

  function canonicalSpecies(value) {
    const normalized = clean(value).toLowerCase();
    return SPECIES_ALIASES[normalized] || normalized;
  }

  function canonicalSpeciesLabel(value) {
    const key = canonicalSpecies(value);
    const baseline = BASE_SPECIES.find((item) => item.toLowerCase() === key);
    return baseline || clean(value);
  }

  function canonicalSex(value) {
    const normalized = clean(value).toLowerCase();
    return SEX_ALIASES[normalized] || normalized;
  }

  function canonicalRegion(value) {
    const normalized = clean(value).toLowerCase();
    return STATE_CODES.get(normalized) || clean(value);
  }

  function mergeValues(...groups) {
    const seen = new Set();
    const values = [];
    for (const group of groups) {
      if (!Array.isArray(group)) continue;
      for (const item of group) {
        const value = clean(item);
        const key = value.toLowerCase();
        if (!value || seen.has(key)) continue;
        seen.add(key);
        values.push(value);
      }
    }
    return values;
  }

  function optionEntries(entries, current, emptyLabel) {
    const wanted = clean(current).toLowerCase();
    return [
      '<option value="">' + esc(emptyLabel) + '</option>',
      ...(Array.isArray(entries) ? entries : []).map((entry) => {
        const value = clean(entry?.value);
        const label = clean(entry?.label) || value;
        return '<option value="' + esc(value) + '"' +
          (wanted === value.toLowerCase() ? " selected" : "") +
          '>' + esc(label) + '</option>';
      })
    ].join("");
  }

  function valueOptions(values, current, emptyLabel) {
    return optionEntries(
      mergeValues(values).map((value) => ({ value, label: value })),
      current,
      emptyLabel
    );
  }

  function speciesValues() {
    const live = Array.isArray(facets.species)
      ? facets.species.map(canonicalSpeciesLabel)
      : [];
    return mergeValues(BASE_SPECIES, live);
  }

  function breedValues(species) {
    const key = canonicalSpecies(species);
    const baseline = key
      ? (BASE_BREEDS[key] || [])
      : Object.values(BASE_BREEDS).flat();
    const pairs = Array.isArray(facets.breed_pairs) ? facets.breed_pairs : [];
    const liveForSpecies = key
      ? pairs
          .filter((row) => canonicalSpecies(row?.species) === key)
          .map((row) => row?.breed)
      : (Array.isArray(facets.breeds) ? facets.breeds : pairs.map((row) => row?.breed));
    return mergeValues(baseline, liveForSpecies);
  }

  function sexEntries() {
    const entries = [...SEX_OPTIONS];
    const known = new Set(SEX_OPTIONS.map((entry) => entry.value));
    for (const value of Array.isArray(facets.sexes) ? facets.sexes : []) {
      const canonical = canonicalSex(value);
      if (!clean(value) || known.has(canonical)) continue;
      known.add(canonical);
      entries.push({ value: clean(value), label: clean(value) });
    }
    return entries;
  }

  function regionEntries() {
    const entries = [...US_STATES];
    const known = new Set(US_STATES.map((entry) => entry.value.toLowerCase()));
    for (const value of Array.isArray(facets.regions) ? facets.regions : []) {
      const canonical = canonicalRegion(value);
      const key = clean(canonical).toLowerCase();
      if (!key || known.has(key)) continue;
      known.add(key);
      entries.push({ value: clean(value), label: clean(value) });
    }
    return entries;
  }

  function listingCard(row, photoUrl, favorite, interactive, suspended) {
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
          aria-label="${interactive ? (favorite ? "Remove from favorites" : "Add to favorites") : suspended ? "Marketplace access suspended" : "Sign in to save this listing"}">
          <span aria-hidden="true">${favorite ? "♥" : "♡"}</span>
        </button>
      </article>
    `;
  }

  async function mount(root, context) {
    if (!root || !context?.client) return;
    const { client } = context;
    const interactive = context.isAuthenticated && context.accountStatus === "active" && context.marketplaceAccessReady === true;
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

    function renderBreedOptions(species, currentBreed = "") {
      form.elements.breed.innerHTML = valueOptions(
        breedValues(species),
        currentBreed,
        species ? "All " + canonicalSpeciesLabel(species).toLowerCase() + " breeds" : "All breeds"
      );
    }

    function renderFilterOptions(state) {
      const normalizedSpecies = canonicalSpeciesLabel(state.species);
      const normalizedSex = canonicalSex(state.sex);
      const normalizedRegion = canonicalRegion(state.region);

      form.elements.species.innerHTML = valueOptions(speciesValues(), normalizedSpecies, "All species");
      renderBreedOptions(normalizedSpecies, state.breed);
      form.elements.sex.innerHTML = optionEntries(SEX_OPTIONS.concat(
        sexEntries().filter((entry) => !SEX_OPTIONS.some((base) => base.value === entry.value))
      ), normalizedSex, "Any sex");
      form.elements.region.innerHTML = optionEntries(regionEntries(), normalizedRegion, "Any state");
      form.elements.kind.innerHTML = optionEntries(LISTING_KIND_OPTIONS, state.kind, "Any listing type");
    }

    async function loadFacets() {
      try {
        facets = await rpc(client, "marketplace_public_facets_v2") || {};
      } catch {
        facets = {};
      }
      renderFilterOptions(currentState());
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
        if (!form.elements[name]) continue;
        const value = name === "species"
          ? canonicalSpeciesLabel(state[name])
          : name === "sex"
            ? canonicalSex(state[name])
            : name === "region"
              ? canonicalRegion(state[name])
              : state[name];
        form.elements[name].value = value || "";
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
              interactive,
              context.marketplaceSuspended === true
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
              if (context.marketplaceSuspended) {
                globalThis.alert("Your Marketplace access is suspended. You can continue browsing, but favorites and other Marketplace interaction are disabled.");
                return;
              }
              window.location.assign(context.isAuthenticated
                ? "https://app.herdharbor.com/"
                : accountUrl(stateUrl(currentState())));
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

    form.elements.species.addEventListener("change", () => {
      renderBreedOptions(form.elements.species.value, "");
    });

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
