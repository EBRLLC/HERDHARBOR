"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Publishing without a Seller Profile preserves the listing as Draft", () => {
  const source = read("marketplace/marketplace-listings.js");

  assert.match(source, /marketplace_member_profile_preview/);
  assert.match(source, /requestedState === "available"/);
  assert.match(source, /requiresSellerProfileSetup = true/);
  assert.match(source, /saveState = "draft"/);
  assert.match(source, /state_value: saveState/);
  assert.match(source, /Listing saved as draft\. Complete your Seller Profile to publish it\./);
  assert.match(source, /beginSellerProfileSetup\(\)/);
});

test("Seller Profile setup is explicit and never bypasses suspension", () => {
  const listings = read("marketplace/marketplace-listings.js");
  const profile = read("marketplace/marketplace-profile.js");

  assert.match(listings, /currentProfileStatus === "suspended"/);
  assert.match(listings, /seller profile is suspended\. This listing cannot be published\./i);
  assert.match(listings, /Complete your Seller Profile before publishing a listing/);
  assert.match(listings, /seller-profile-setup=publish#seller-profile/);

  assert.match(profile, /seller-profile-setup/);
  assert.match(profile, /Your listing was saved as Draft so nothing was lost/);
});

test("Publish-flow assets have fresh cache identities", () => {
  const shell = read("marketplace/marketplace-shell.js");
  const gate = read("marketplace/marketplace-gate.js");
  const pages = [
    read("marketplace/index.html"),
    read("marketplace/listing/index.html"),
    read("marketplace/messages/index.html"),
    read("marketplace/seller/index.html")
  ].join("\n");

  assert.match(shell, /marketplace-listings\.js\?v=8/);
  assert.match(shell, /marketplace-profile\.js\?v=8/);
  assert.match(gate, /marketplace-shell\.js\?v=10/);
  assert.match(pages, /marketplace-gate\.js\?v=11/);
});
