const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("C5W listing editor exposes explicit pedigree visibility controls", () => {
  const source = read("marketplace/marketplace-listings.js");
  assert.match(source, /name="pedigree_visibility"/);
  for (const value of ["hidden","parents","3","4","5"]) {
    assert.match(source, new RegExp('option\\("' + value + '"'));
  }
  assert.match(source, /name="pedigree_visibility" \$\{sourceId \? "" : "disabled"\}/);
  assert.match(source, /pedigree_visibility_value: sourceId \? form\.elements\.pedigree_visibility\.value : "hidden"/);
});

test("C5W refreshes the canonical server pedigree snapshot after linked listing save", () => {
  const source = read("marketplace/marketplace-listings.js");
  assert.match(source, /body:\s*\{ listingId \}/);
  assert.match(source, /visibility === "hidden"/);
  assert.match(source, /sourceAnimalId/);
  assert.doesNotMatch(source, /buildGraph|HerdHarborPedigreeEngine|sireId|damId/);
});

test("C5W detail reads only sanitized pedigree preview contracts", () => {
  const source = read("marketplace/marketplace-detail.js");
  assert.match(source, /marketplace_public_pedigree_v2/);
  assert.match(source, /View HerdHarbor Pedigree/);
  assert.match(source, /showModal\(\)/);
  assert.match(source, /data-pedigree-body/);
  assert.doesNotMatch(source, /buildGraph|HerdHarborPedigreeEngine|sireId|damId|source_animal_id|herdharbor_user_data|herdharbor_sync_records/i);
});

test("C5W pedigree renderer only consumes the allowlisted public snapshot fields", () => {
  const source = read("marketplace/marketplace-detail.js");
  const start = source.indexOf("function pedigreeNodeCard");
  const end = source.indexOf("function renderPedigree");
  const nodeBlock = source.slice(start, end);
  for (const field of ["name","prefix","breed","color","sex","dob","registrationNumber"]) {
    assert.match(nodeBlock, new RegExp("animal\\." + field));
  }
  assert.doesNotMatch(nodeBlock, /\banimalId\b|\buser_id\b|\bsource_animal_id\b|\bseller_id\b|\bnotes\b|\bmedical\b|\bacquisition\b|\bphotoData\b|\bemail\b|\bphone\b|\bexact_address\b/i);
  assert.doesNotMatch(nodeBlock, /marketplace-pedigree-dialog/);
});

test("C5W pedigree dialog lives in the listing page template, not ancestor card markup", () => {
  const source = read("marketplace/marketplace-detail.js");
  assert.equal((source.match(/id="marketplace-pedigree-dialog"/g) || []).length, 1);
  assert.match(source, /<dialog id="marketplace-pedigree-dialog"/);
  assert.match(source, /aria-labelledby="marketplace-pedigree-title"/);
  assert.match(source, /data-close-pedigree/);
});

test("C5W website session clears private account context when auth ends", () => {
  const gate = read("marketplace/marketplace-gate.js");
  assert.match(gate, /onAuthStateChange/);
  assert.match(gate, /event === "SIGNED_OUT"/);
  assert.match(gate, /window\.HerdHarborMarketplaceContext = undefined/);
  assert.match(gate, /window\.location\.assign\("\/marketplace\/"\)/);
});

test("C5W/C7 keeps private features authenticated and SSO credentials out of URLs", () => {
  const content = [
    read("marketplace/marketplace-gate.js"),
    read("marketplace/marketplace-listings.js"),
    read("marketplace/marketplace-detail.js")
  ].join("\n");
  assert.match(content, /context\.marketplaceAccessReady === true|context\.marketplaceAccessReady !== true/);
  assert.doesNotMatch(content, /preview=true|publicLaunch|service_role|SUPABASE_SERVICE_ROLE_KEY/i);
  assert.doesNotMatch(content, /searchParams\.set\(["'](?:access_token|refresh_token)|[?&](?:access_token|refresh_token)=/i);
});

test("C5W pedigree UI is responsive and accessible", () => {
  const css = read("marketplace/marketplace.css");
  assert.match(css, /\.marketplace-pedigree-dialog/);
  assert.match(css, /\.marketplace-pedigree-dialog::backdrop/);
  assert.match(css, /\.marketplace-pedigree-generation-grid/);
  assert.match(css, /@media \(max-width: 640px\)/);
});


test("C5W keeps one history coordinator so Browse cannot overwrite another tab on back/forward", () => {
  const shell = read("marketplace/marketplace-shell.js");
  const browse = read("marketplace/marketplace-browse.js");
  assert.equal((shell.match(/addEventListener\("popstate"/g) || []).length, 1);
  assert.doesNotMatch(browse, /addEventListener\("popstate"/);
  assert.match(shell, /show\(viewFromLocation\(\)\)/);
});

test("C5W signed Marketplace media recovers once and then falls back safely", () => {
  const browse = read("marketplace/marketplace-browse.js");
  const detail = read("marketplace/marketplace-detail.js");
  const seller = read("marketplace/marketplace-seller.js");
  for (const source of [browse, detail, seller]) {
    assert.match(source, /mediaRecoveryAttempted/);
    assert.match(source, /addEventListener\("error"/);
  }
  assert.match(browse, /browse-card-fallback/);
  assert.match(detail, /marketplace-gallery-fallback/);
  assert.match(seller, /browse-card-fallback/);
});

test("C5W has no duplicate pedigree website runtime", () => {
  assert.equal(fs.existsSync(path.join(root, "marketplace/marketplace-pedigree.js")), false);
  const detail = read("marketplace/marketplace-detail.js");
  assert.equal((detail.match(/function renderPedigree/g) || []).length, 1);
  assert.equal((detail.match(/function pedigreeNodeCard/g) || []).length, 1);
});

test("C5W private routes remain noindex and load website assets only", () => {
  for (const page of [
    read("marketplace/index.html"),
    read("marketplace/listing/index.html"),
    read("marketplace/seller/index.html")
  ]) {
    assert.match(page, /name="robots" content="noindex,nofollow,noarchive"/);
    assert.doesNotMatch(page, /app\.herdharbor\.com\/[^"']+\.(?:js|css)/i);
  }

  const listing = read("marketplace/listing/index.html");
  const seller = read("marketplace/seller/index.html");
  assert.match(listing, /data-marketplace-runtime="\/marketplace\/marketplace-detail\.js\?v=9"/);
  assert.match(seller, /data-marketplace-runtime="\/marketplace\/marketplace-seller\.js\?v=9"/);
});

test("C5W final accessibility hardening includes focus and reduced-motion handling", () => {
  const css = read("marketplace/marketplace.css");
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /marketplace-placeholder-card\[aria-busy="true"\]/);
});
