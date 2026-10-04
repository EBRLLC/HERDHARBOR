"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("C7C public media never exposes Storage paths to guest runtimes", () => {
  const files = [
    read("marketplace/marketplace-browse.js"),
    read("marketplace/marketplace-detail.js"),
    read("marketplace/marketplace-seller.js")
  ];

  for (const source of files) {
    assert.match(source, /functions\.invoke\("marketplace-public-media"/);
    assert.doesNotMatch(source, /marketplace_public_(?:listing_media|seller_media)_v2/);
    assert.doesNotMatch(source, /createSignedUrl|createSignedUrls/);
    assert.doesNotMatch(source, /storage_path/);
  }
});

test("C7C generic shell contains no stale Owner-preview runtime naming", () => {
  const gate = read("marketplace/marketplace-gate.js");
  const shell = read("marketplace/marketplace-shell.js");
  const pages = [
    read("marketplace/index.html"),
    read("marketplace/listing/index.html"),
    read("marketplace/seller/index.html"),
    read("marketplace/messages/index.html")
  ].join("\n");

  assert.match(gate, /marketplace-shell\.js\?v=7/);
  assert.doesNotMatch(gate + shell + pages, /marketplace-owner-(?:shell|root|panel)/);
  assert.match(pages, /id="marketplace-root"/);
});

test("C7C Owner moderation can act on abusive buyers as Marketplace accounts", () => {
  const source = read("marketplace/marketplace-admin.js");

  assert.match(source, /marketplace_owner_admin_summary_v2/);
  assert.match(source, /marketplace_owner_admin_reports_v2/);
  assert.match(source, /marketplace_owner_admin_resolve_report_v2/);
  assert.match(source, /marketplace_owner_admin_suspensions/);
  assert.match(source, /marketplace_owner_admin_reactivate_account/);
  assert.match(source, /data-report-action="suspend_account"/);
  assert.match(source, /Suspended accounts/);
  assert.match(source, /Reported content:/);
  assert.match(source, /Reported account:/);
  assert.match(source, /Their main HerdHarbor account stays active/);
});

test("C7C message UI prevents duplicate and stale thread renders", () => {
  const source = read("marketplace/messages/marketplace-messages.js");

  assert.match(source, /let threadRequestToken = 0/);
  assert.match(source, /const requestToken = \+\+threadRequestToken/);
  assert.match(source, /requestToken !== threadRequestToken \|\| selectedConversationId !== conversationId/);
  assert.match(source, /loadInbox\(\{ openRequested: false \}\)/);
  assert.doesNotMatch(source, /Promise\.all\(\[loadInbox\(\), openThread\(conversationId\)\]\)/);
});

test("C7C shell lazy loads are view-bound", () => {
  const shell = read("marketplace/marketplace-shell.js");

  assert.match(shell, /function loadModule\(\{ view, globalName, marker, src, failure \}\)/);
  assert.match(shell, /if \(currentView !== view\) return/);
  assert.match(shell, /script\.dataset\.marketplaceModule = marker/);
});

test("C7C website contains no browser calls to superseded report or media RPCs", () => {
  const source = [
    read("marketplace/marketplace-admin.js"),
    read("marketplace/marketplace-browse.js"),
    read("marketplace/marketplace-detail.js"),
    read("marketplace/marketplace-seller.js")
  ].join("\n");

  assert.doesNotMatch(source, /marketplace_owner_admin_(?:summary|reports|resolve_report)\b(?!_v2)/);
  assert.doesNotMatch(source, /marketplace_public_(?:listing_media|seller_media)_v2/);
});
