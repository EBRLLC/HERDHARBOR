"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("D3 Owner moderation uses reports v3 and exposes review/warn controls", () => {
  const source = read("marketplace/marketplace-admin.js");
  assert.match(source, /marketplace_owner_admin_reports_v3/);
  assert.match(source, /marketplace_owner_admin_set_report_reviewing/);
  assert.match(source, /marketplace_owner_admin_warn_reported_user/);
  assert.match(source, /Start review/);
  assert.match(source, /Warn member/);
});

test("D3 Owner can inspect structured report category and evidence references", () => {
  const source = read("marketplace/marketplace-admin.js");
  assert.match(source, /report\.category/);
  assert.match(source, /report\.evidence_refs/);
  assert.match(source, /Evidence references/);
});

test("D3 member warnings load only inside Marketplace shell and can be acknowledged", () => {
  const shell = read("marketplace/marketplace-shell.js");
  assert.match(shell, /marketplace_member_warnings/);
  assert.match(shell, /marketplace_member_acknowledge_warning/);
  assert.match(shell, /Marketplace warning/);
  assert.match(shell, /Acknowledge/);

  const gate = read("marketplace/marketplace-gate.js");
  assert.doesNotMatch(gate, /marketplace_member_warnings/);
});

test("D3 shell/admin/gate use fresh cache identities", () => {
  const shell = read("marketplace/marketplace-shell.js");
  const gate = read("marketplace/marketplace-gate.js");
  const pages = [
    read("marketplace/index.html"),
    read("marketplace/listing/index.html"),
    read("marketplace/seller/index.html"),
    read("marketplace/messages/index.html")
  ].join("\n");

  assert.match(shell, /marketplace-admin\.js\?v=8/);
  assert.match(gate, /marketplace-shell\.js\?v=10/);
  assert.match(pages, /marketplace-gate\.js\?v=11/);
});
