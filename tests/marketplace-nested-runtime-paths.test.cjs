"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function runtimeFrom(file) {
  const html = read(file);
  const match = html.match(/data-marketplace-runtime="([^"]+)"/);
  assert.ok(match, file + " must declare a Marketplace runtime");
  return match[1];
}

test("nested Marketplace pages use absolute runtime paths that match repository files", () => {
  const cases = [
    ["marketplace/listing/index.html", "/marketplace/marketplace-detail.js?v=9", "marketplace/marketplace-detail.js"],
    ["marketplace/seller/index.html", "/marketplace/marketplace-seller.js?v=9", "marketplace/marketplace-seller.js"],
    ["marketplace/messages/index.html", "/marketplace/messages/marketplace-messages.js?v=10", "marketplace/messages/marketplace-messages.js"]
  ];

  for (const [page, expectedRuntime, repoFile] of cases) {
    assert.equal(runtimeFrom(page), expectedRuntime, page);
    assert.equal(fs.existsSync(path.join(root, repoFile)), true, repoFile + " must exist");
  }
});
