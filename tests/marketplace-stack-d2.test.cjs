"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("D2 listing and seller pages expose direct block controls without exposing auth IDs", () => {
  const detail = read("marketplace/marketplace-detail.js");
  const seller = read("marketplace/marketplace-seller.js");

  for (const source of [detail,seller]) {
    assert.match(source, /marketplace_member_user_block_state/);
    assert.match(source, /marketplace_member_set_user_block/);
    assert.doesNotMatch(source, /blocked_id_value|seller_id_value/);
  }
});

test("D2 report flows use structured report v2", () => {
  const combined = [
    read("marketplace/marketplace-detail.js"),
    read("marketplace/marketplace-seller.js"),
    read("marketplace/messages/marketplace-messages.js")
  ].join("\n");

  assert.match(combined, /marketplace_member_submit_report_v2/);
  assert.match(combined, /category_value/);
  assert.match(combined, /evidence_refs_value/);
  assert.match(combined, /fraud_scam/);
  assert.match(combined, /animal_welfare/);
});

test("D2 Messages can report an individual peer message", () => {
  const source = read("marketplace/messages/marketplace-messages.js");
  assert.match(source, /data-report-message/);
  assert.match(source, /target_type_value: "message"/);
  assert.match(source, /evidence_refs_value: \[messageId\]/);
});

test("D2 safety runtimes use fresh absolute cache identities", () => {
  assert.match(read("marketplace/listing/index.html"), /\/marketplace\/marketplace-detail\.js\?v=9/);
  assert.match(read("marketplace/seller/index.html"), /\/marketplace\/marketplace-seller\.js\?v=9/);
  assert.match(read("marketplace/messages/index.html"), /\/marketplace\/messages\/marketplace-messages\.js\?v=10/);
});
