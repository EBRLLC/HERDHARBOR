"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("D4 shell exposes Saved Animals only to interactive members and lazy loads it", () => {
  const shell = read("marketplace/marketplace-shell.js");
  assert.match(shell, /data-marketplace-view="saved"/);
  assert.match(shell, /HerdHarborMarketplaceSaved/);
  assert.match(shell, /marketplace-saved\.js\?v=1/);
  assert.match(shell, /#saved/);
});

test("D4 Saved Animals uses canonical favorites and allows unavailable items to be removed", () => {
  const saved = read("marketplace/marketplace-saved.js");
  assert.match(saved, /marketplace_member_saved_listings/);
  assert.match(saved, /marketplace_member_toggle_favorite_v2/);
  assert.match(saved, /favorite_value: false/);
  assert.match(saved, /Remove from Saved/);
  assert.match(saved, /no longer publicly available/);
});

test("D4 My Listings refreshes stale lifecycle and supports reconfirm state actions", () => {
  const listings = read("marketplace/marketplace-listings.js");
  assert.match(listings, /marketplace_member_refresh_listing_lifecycle/);
  assert.match(listings, /marketplace_member_listings_v2/);
  assert.match(listings, /marketplace_member_reconfirm_listing/);
  assert.match(listings, /marketplace_member_update_listing_lifecycle/);
  assert.match(listings, /Reconfirm 30 days/);
  assert.match(listings, /Mark pending/);
  assert.match(listings, /Mark sold/);
  assert.match(listings, /Renew 30 days/);
});

test("D4 lifecycle and Saved Animals modules have fresh cache identities and CI validation", () => {
  const shell = read("marketplace/marketplace-shell.js");
  const gate = read("marketplace/marketplace-gate.js");
  const workflow = read(".github/workflows/website-ci.yml");
  const pages = [
    read("marketplace/index.html"),
    read("marketplace/listing/index.html"),
    read("marketplace/seller/index.html"),
    read("marketplace/messages/index.html")
  ].join("\n");

  assert.match(shell, /marketplace-listings\.js\?v=9/);
  assert.match(shell, /marketplace-saved\.js\?v=1/);
  assert.match(gate, /marketplace-shell\.js\?v=11/);
  assert.match(pages, /marketplace-gate\.js\?v=12/);
  assert.match(workflow, /node --check marketplace\/marketplace-saved\.js/);
});
