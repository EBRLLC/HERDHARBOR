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

  assert.match(gate, /marketplace-shell\.js\?v=9/);
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


test("C7C successful seller-profile save is not undone by old-avatar cleanup failure", () => {
  const source = read("marketplace/marketplace-profile.js");
  assert.match(source, /marketplace_member_save_profile/);
  assert.match(source, /removePath\(client, previousPath\)\.catch\(\(\) => \{\}\)/);
  assert.doesNotMatch(source, /if \(uploadedPath && previousPath && previousPath !== uploadedPath\) \{\s*await removePath\(client, previousPath\);\s*\}/);
});

test("C7C listing UI distinguishes committed record from failed follow-up work", () => {
  const source = read("marketplace/marketplace-listings.js");
  assert.match(source, /let listingRecordSaved = false/);
  assert.match(source, /listingRecordSaved = true/);
  assert.match(source, /form\.elements\.listing_id\.value = String\(savedId \|\| ""\)/);
  assert.match(source, /Listing details were saved, but a follow-up Marketplace update failed/);
  assert.match(source, /if \(listingRecordSaved\)/);
  assert.match(source, /for \(const file of files\)/);
});


test("C7C SSO keeps a one-time fragment fallback without URL session tokens", () => {
  const gate = read("marketplace/marketplace-gate.js");

  assert.match(gate, /#app-sso=/);
  assert.match(gate, /#sso-ticket=/);
  assert.match(gate, /redeemFragmentTicket/);
  assert.match(gate, /client\.auth\.verifyOtp/);
  assert.match(gate, /history\.replaceState/);
  assert.match(gate, /addEventListener\("hashchange"/);
  assert.match(gate, /if \(!ssoTicketFromHash\(\)\) return/);
  assert.doesNotMatch(gate, /[?&](?:access_token|refresh_token)=/i);
  assert.doesNotMatch(gate, /searchParams\.(?:get|set)\(["'](?:access_token|refresh_token)/i);
});


test("C7C committed profile media is never deleted by a later preview failure", () => {
  const source = read("marketplace/marketplace-profile.js");
  assert.match(source, /let profileSaved = false/);
  assert.match(source, /profileSaved = true/);
  assert.match(source, /if \(uploadedPath && !profileSaved\)/);
  assert.match(source, /Seller profile was saved, but the preview could not refresh/);
});

test("C7C committed listing photos survive later pedigree or refresh failures", () => {
  const source = read("marketplace/marketplace-listings.js");
  assert.match(source, /let photosCommitted = false/);
  assert.match(source, /photosCommitted = true/);
  assert.match(source, /if \(uploadedPaths\.length && !photosCommitted\)/);
  assert.match(source, /Listing details were saved, but a follow-up Marketplace update failed/);
});


test("C7C listing delete respects moderation denial before Storage cleanup", () => {
  const source = read("marketplace/marketplace-listings.js");
  assert.match(source, /const deleted = await rpc\(client, "marketplace_member_delete_listing"/);
  assert.match(source, /if \(deleted !== true\)/);
  assert.match(source, /cannot be deleted while it is under Marketplace moderation/);

  const denial = source.indexOf("if (deleted !== true)");
  const cleanup = source.indexOf("await removePaths(client, previousPaths)", denial);
  assert.ok(denial >= 0 && cleanup > denial);
  assert.match(source, /let cleanupFailed = false/);
  assert.match(source, /Listing deleted, but one or more stored photos could not be cleaned up/);
});


test("C7C Messages can block profile-less conversation participants without account IDs", () => {
  const source = read("marketplace/messages/marketplace-messages.js");

  assert.match(source, /marketplace_member_conversation_block_state/);
  assert.match(source, /marketplace_member_set_conversation_block/);
  assert.match(source, /Block account/);
  assert.match(source, /Unblock account/);
  assert.match(source, /You blocked this Marketplace account/);
  assert.doesNotMatch(source, /peerUserId|targetUserId|blockedUserId|other_user_id/);
});
