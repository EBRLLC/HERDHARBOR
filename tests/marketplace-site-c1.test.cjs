const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Marketplace canonical route is website-hosted and noindexed during private preview", () => {
  const html = read("marketplace/index.html");
  assert.match(html, /<link rel="canonical" href="https:\/\/herdharbor\.com\/marketplace\/"/);
  assert.match(html, /name="robots" content="noindex,nofollow,noarchive"/);
  assert.match(html, /\.\.\/styles\.css/);
  assert.match(html, /https:\/\/app\.herdharbor\.com\//);
  assert.doesNotMatch(html, /app\.herdharbor\.com\/(?:.*\.js|.*\.css)/);
});

test("Marketplace uses its own Supabase session with guest, member, and protected Owner context", () => {
  const gate = read("marketplace/marketplace-gate.js");
  assert.match(gate, /client\.auth\.getSession\(\)/);
  assert.match(gate, /client\.rpc\("marketplace_member_session"\)/);
  assert.match(gate, /role: "guest"/);
  assert.match(gate, /accountRole === "owner" \? "owner" : "member"/);
  assert.match(gate, /detectSessionInUrl: false/);
  assert.match(gate, /acceptAppSessionHandoff/);
  assert.doesNotMatch(gate, /searchParams\.set\(["\'](?:access_token|refresh_token)|[?&](?:access_token|refresh_token)=/i);
});

test("Marketplace feature runtime lazy-loads only after session context is established", () => {
  const html = read("marketplace/index.html");
  const gate = read("marketplace/marketplace-gate.js");
  assert.doesNotMatch(html, /marketplace-owner-shell\.js/);
  assert.match(gate, /window\.HerdHarborMarketplaceContext = context/);
  assert.match(gate, /await loadRuntime\(\)/);
});

test("Marketplace website does not import HerdHarbor app sync runtime", () => {
  const content = [
    read("marketplace/index.html"),
    read("marketplace/marketplace-gate.js"),
    read("marketplace/marketplace-owner-shell.js")
  ].join("\n");
  assert.doesNotMatch(content, /HerdHarborStateStore|herdharbor-state-store|cloud-sync|offline save queue|conflict resolution|herdharbor-cloud\.js|app\.herdharbor\.com\/.*\.(?:js|css)/i);
});

test("Main website navigation exposes Marketplace", () => {
  const script = read("script.js");
  assert.match(script, /ensureMarketplaceLink/);
  assert.match(script, /href = "\/marketplace\/"/);
});

test("No hard-coded Owner identity exists", () => {
  const content = [
    read("marketplace/marketplace-gate.js"),
    read("marketplace/marketplace-owner-shell.js")
  ].join("\n");
  assert.doesNotMatch(content, /owner[_-]?(?:email|user[_-]?id)\s*=|@(?:gmail|yahoo|outlook|icloud)\.com/i);
});
