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
  assert.match(source, /pedigree_visibility_value: form\.elements\.pedigree_visibility\.value/);
  assert.doesNotMatch(source, /pedigree_visibility_value:\s*"hidden"/);
});

test("C5W refreshes the canonical server pedigree snapshot after linked listing save", () => {
  const source = read("marketplace/marketplace-listings.js");
  assert.match(source, /client\.functions\.invoke\("marketplace-pedigree-snapshot"/);
  assert.match(source, /body:\s*\{ listingId \}/);
  assert.match(source, /visibility === "hidden"/);
  assert.match(source, /sourceAnimalId/);
  assert.doesNotMatch(source, /buildGraph|HerdHarborPedigreeEngine|sireId|damId/);
});

test("C5W detail reads only sanitized pedigree preview contracts", () => {
  const source = read("marketplace/marketplace-detail.js");
  assert.match(source, /marketplace_owner_listing_pedigree_preview/);
  assert.match(source, /client\.functions\.invoke\("marketplace-pedigree-snapshot"/);
  assert.match(source, /View HerdHarbor Pedigree/);
  assert.match(source, /showModal\(\)/);
  assert.match(source, /data-pedigree-body/);
  assert.doesNotMatch(source, /buildGraph|HerdHarborPedigreeEngine|sireId|damId|source_animal_id|herdharbor_user_data|herdharbor_sync_records/i);
});

test("C5W pedigree renderer only consumes the allowlisted public snapshot fields", () => {
  const source = read("marketplace/marketplace-detail.js");
  const start = source.indexOf("function pedigreeNodeCard");
  const end = source.indexOf("function renderPedigreeSnapshot");
  const nodeBlock = source.slice(start, end);
  for (const field of ["name","prefix","breed","color","sex","dob","registrationNumber"]) {
    assert.match(nodeBlock, new RegExp("animal\\." + field));
  }
  assert.doesNotMatch(nodeBlock, /id\b|notes|medical|acquisition|photo|email|phone|address/i);
  assert.doesNotMatch(nodeBlock, /marketplace-pedigree-dialog/);
});

test("C5W pedigree dialog lives in the listing page template, not ancestor card markup", () => {
  const source = read("marketplace/marketplace-detail.js");
  assert.equal((source.match(/id="marketplace-pedigree-dialog"/g) || []).length, 1);
  assert.match(source, /<dialog id="marketplace-pedigree-dialog"/);
  assert.match(source, /aria-labelledby="marketplace-pedigree-title"/);
  assert.match(source, /data-close-pedigree/);
});

test("C5W private website session fails closed when auth ends", () => {
  const gate = read("marketplace/marketplace-gate.js");
  assert.match(gate, /onAuthStateChange/);
  assert.match(gate, /event === "SIGNED_OUT"/);
  assert.match(gate, /window\.HerdHarborMarketplaceContext = undefined/);
  assert.match(gate, /session ended/);
});

test("C5W retains Owner-only private preview and no token handoff", () => {
  const content = [
    read("marketplace/marketplace-gate.js"),
    read("marketplace/marketplace-listings.js"),
    read("marketplace/marketplace-detail.js")
  ].join("\n");
  assert.match(content, /context\.role !== "owner"|toLowerCase\(\) !== "owner"/);
  assert.doesNotMatch(content, /preview=true|allowAnonymous|publicLaunch|role\s*===\s*["']anon["']/i);
  assert.doesNotMatch(content, /access_token|refresh_token|service_role|SUPABASE_SERVICE_ROLE_KEY/i);
});

test("C5W pedigree UI is responsive and accessible", () => {
  const css = read("marketplace/marketplace.css");
  assert.match(css, /\.marketplace-pedigree-dialog/);
  assert.match(css, /\.marketplace-pedigree-dialog::backdrop/);
  assert.match(css, /\.marketplace-pedigree-generation-grid/);
  assert.match(css, /@media \(max-width: 640px\)/);
});
