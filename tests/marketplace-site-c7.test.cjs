const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("C7W Marketplace browsing no longer requires authentication", () => {
  const gate = read("marketplace/marketplace-gate.js");
  const shell = read("marketplace/marketplace-shell.js");
  const browse = read("marketplace/marketplace-browse.js");

  assert.match(gate, /role: "guest"/);
  assert.match(gate, /isAuthenticated: false/);
  assert.match(gate, /await loadRuntime\(\)/);
  assert.match(shell, /show\(viewFromLocation\(\)\)/);
  assert.match(browse, /marketplace_public_search_v2/);
  assert.match(browse, /marketplace_public_facets_v2/);
  assert.match(browse, /functions\.invoke\("marketplace-public-media"/);
  assert.doesNotMatch(browse, /if \(!root \|\| !context\?\.client \|\| context\.role !== "owner"\)/);
});

test("C7W listing and seller pages use public read-only contracts", () => {
  const detail = read("marketplace/marketplace-detail.js");
  const seller = read("marketplace/marketplace-seller.js");

  assert.match(detail, /marketplace_public_listing_v2/);
  assert.match(detail, /functions\.invoke\("marketplace-public-media"/);
  assert.match(detail, /marketplace_public_pedigree_v2/);
  assert.match(seller, /marketplace_public_seller_v2/);
  assert.match(seller, /marketplace_public_search_v2/);
  assert.match(seller, /functions\.invoke\("marketplace-public-media"/);
  assert.doesNotMatch(seller, /marketplace_public_(?:seller_media|listing_media)_v2|createSignedUrl/);

  for (const source of [detail, seller]) {
    assert.doesNotMatch(source, /source_animal_id|herdharbor_user_data|account_access|subscription_payments|exact_address|medical|acquisition/i);
  }
});

test("C7W guest message/report/favorite actions go to account entry rather than leaking private APIs", () => {
  const detail = read("marketplace/marketplace-detail.js");
  const seller = read("marketplace/marketplace-seller.js");
  const browse = read("marketplace/marketplace-browse.js");

  assert.match(detail, /Sign in to message seller/);
  assert.match(detail, /\/marketplace\/account\/\?next=/);
  assert.match(seller, /\/marketplace\/account\/\?next=/);
  assert.match(browse, /\/marketplace\/account\/\?next=/);

  assert.match(detail, /marketplace_member_open_listing_conversation/);
  assert.match(detail, /marketplace_member_submit_report/);
  assert.match(seller, /marketplace_member_submit_report/);
  assert.match(browse, /marketplace_member_toggle_favorite/);
});

test("C7W app SSO supports exact-origin opener handoff plus one-time fragment fallback", () => {
  const gate = read("marketplace/marketplace-gate.js");

  assert.match(gate, /APP_ORIGIN = "https:\/\/app\.herdharbor\.com"/);
  assert.match(gate, /event\.origin !== APP_ORIGIN/);
  assert.match(gate, /event\.source !== window\.opener/);
  assert.match(gate, /String\(event\.data\?\.nonce \|\| ""\) !== nonce/);
  assert.match(gate, /client\.auth\.verifyOtp/);
  assert.match(gate, /type: "magiclink"/);
  assert.match(gate, /SSO_TIMEOUT_MS = 5000/);
  assert.match(gate, /history\.replaceState/);
  assert.match(gate, /ssoTicketFromHash/);
  assert.match(gate, /#sso-ticket=/);
  assert.match(gate, /redeemFragmentTicket/);
  assert.match(gate, /window\.addEventListener\("hashchange"/);
  assert.match(gate, /window\.location\.reload\(\)/);
  assert.match(gate, /history\.replaceState/);
  assert.doesNotMatch(gate, /searchParams\.get\(["'](?:access_token|refresh_token)|searchParams\.set\(["'](?:access_token|refresh_token)/i);
  assert.doesNotMatch(gate, /service_role|SUPABASE_SERVICE_ROLE_KEY/i);
});

test("C7W account page supports sign-in and account creation with a local Marketplace next path", () => {
  const html = read("marketplace/account/index.html");
  const source = read("marketplace/account/marketplace-account.js");

  assert.match(html, /Sign in or create an account/);
  assert.match(source, /signInWithPassword/);
  assert.match(source, /auth\.signUp/);
  assert.match(source, /value\.startsWith\("\/marketplace\/"\)/);
  assert.match(source, /value\.startsWith\("\/\/"\)/);
  assert.doesNotMatch(source, /service_role|SUPABASE_SERVICE_ROLE_KEY|auth\.admin/i);
});

test("C7W member listing and seller profile editors use only self-owned member RPCs", () => {
  const listings = read("marketplace/marketplace-listings.js");
  const profile = read("marketplace/marketplace-profile.js");

  for (const fn of [
    "marketplace_member_listings",
    "marketplace_member_herd_animals",
    "marketplace_member_save_listing",
    "marketplace_member_set_listing_photos",
    "marketplace_member_delete_listing"
  ]) assert.match(listings, new RegExp(fn));

  for (const fn of [
    "marketplace_member_profile_editor",
    "marketplace_member_profile_preview",
    "marketplace_member_save_profile"
  ]) assert.match(profile, new RegExp(fn));

  assert.doesNotMatch(listings, /marketplace_owner_(?:listings|herd_animals|save_listing|set_listing_photos|delete_listing)/);
  assert.doesNotMatch(profile, /marketplace_owner_(?:profile_editor|profile_preview|save_profile)/);
  assert.match(listings, /context\.marketplaceAccessReady !== true/);
  assert.match(profile, /context\.marketplaceAccessReady !== true/);
});

test("C7W Messages page never reads Marketplace tables directly", () => {
  const source = read("marketplace/messages/marketplace-messages.js");

  for (const fn of [
    "marketplace_member_inbox",
    "marketplace_member_messages",
    "marketplace_member_send_message",
    "marketplace_member_mark_conversation_read",
    "marketplace_member_submit_report"
  ]) assert.match(source, new RegExp(fn));

  assert.doesNotMatch(source, /\.from\(["']marketplace_(?:messages|conversations|conversation_members|public_profiles|listings)/i);
  assert.doesNotMatch(source, /sender_id|user_id|seller_id/);
  assert.match(source, /This conversation is unavailable to this account/);
});

test("C7W role-aware shell keeps admin Owner-only and private account tabs authenticated", () => {
  const shell = read("marketplace/marketplace-shell.js");
  const index = read("marketplace/index.html");

  assert.match(shell, /const interactive = context\.isAuthenticated[\s\S]*?context\.accountStatus === "active"[\s\S]*?context\.marketplaceAccessReady === true/);
  assert.match(shell, /const owner = interactive && context\.role === "owner"/);
  assert.match(shell, /owner \? '<button class="marketplace-tab marketplace-tab-admin"/);
  assert.match(shell, /interactive \? '<button class="marketplace-tab" type="button" data-marketplace-view="listings"/);
  assert.doesNotMatch(index, />Admin</);
  assert.doesNotMatch(index, />My Listings</);
});

test("C7W shared and nested Marketplace assets are consistently versioned", () => {
  const gate = read("marketplace/marketplace-gate.js");
  const shell = read("marketplace/marketplace-shell.js");
  const pages = [
    read("marketplace/index.html"),
    read("marketplace/listing/index.html"),
    read("marketplace/seller/index.html"),
    read("marketplace/messages/index.html"),
    read("marketplace/account/index.html")
  ].join("\n");

  assert.match(gate, /marketplace-shell\.js\?v=7/);
  assert.match(shell, /marketplace-browse\.js\?v=8/);
  assert.match(shell, /marketplace-listings\.js\?v=7/);
  assert.match(shell, /marketplace-profile\.js\?v=7/);
  assert.match(shell, /marketplace-admin\.js\?v=7/);
  assert.doesNotMatch(pages, /marketplace\.css\?v=[1-6]/);
  assert.doesNotMatch(pages, /marketplace-gate\.js\?v=[1-6]/);
});

test("C7W public browse remains noindex until explicit production launch authorization", () => {
  for (const page of [
    read("marketplace/index.html"),
    read("marketplace/listing/index.html"),
    read("marketplace/seller/index.html")
  ]) {
    assert.match(page, /name="robots" content="noindex,nofollow,noarchive"/);
  }
});


test("C7W incomplete registration stays browse-only instead of looping through sign-in", () => {
  const gate = read("marketplace/marketplace-gate.js");
  const detail = read("marketplace/marketplace-detail.js");
  const messages = read("marketplace/messages/marketplace-messages.js");

  assert.match(gate, /marketplaceAccessReady: account\.marketplace_access_ready === true/);
  assert.match(gate, /Finish HerdHarbor account setup in the app/);
  assert.match(detail, /context\.marketplaceAccessReady === true/);
  assert.match(detail, /context\.isAuthenticated \? "https:\/\/app\.herdharbor\.com\/" : accountUrl/);
  assert.match(messages, /context\.isAuthenticated \? "https:\/\/app\.herdharbor\.com\/" : accountUrl/);
});


test("C7W lazy Marketplace modules cannot render over a newer selected tab", () => {
  const shell = read("marketplace/marketplace-shell.js");
  assert.match(shell, /let currentView = ""/);
  assert.match(shell, /if \(currentView !== view\) return/);
  assert.match(shell, /data-marketplace-module/);
  assert.match(shell, /script\.dataset\.marketplaceModule = marker/);
  assert.doesNotMatch(shell, /script\[data-\$\{marker\}\]/);
  assert.match(shell, /currentView = view;[\s\S]*setCurrent\(view\)/);
  assert.match(shell, /script\.remove\(\)/);
  assert.match(shell, /dataset\.marketplaceReady = "true"/);
});


test("C7W public Marketplace media paths do not expose auth user IDs", () => {
  const listings = read("marketplace/marketplace-listings.js");
  const profile = read("marketplace/marketplace-profile.js");

  assert.match(listings, /const path = `listings\/\$\{listingId\}\/photo-/);
  assert.match(profile, /uploadedPath = `profiles\/avatar-/);
  assert.doesNotMatch(listings, /\$\{userId\}\/listings\//);
  assert.doesNotMatch(profile, /\$\{userId\}\/profiles\//);
  assert.doesNotMatch(listings, /const \{ client, userId \} = context/);
  assert.doesNotMatch(profile, /const \{ client, userId \} = context/);
});


test("C7W registers fragment fallback before waiting on opener SSO", () => {
  const gate = read("marketplace/marketplace-gate.js");
  const listener = gate.indexOf('window.addEventListener("hashchange"');
  const handoff = gate.indexOf("const fragmentRedeemed = await redeemFragmentTicket()");
  assert.ok(listener >= 0, "hashchange listener missing");
  assert.ok(handoff >= 0, "fragment redemption bootstrap missing");
  assert.ok(listener < handoff, "fragment fallback listener must exist before opener handshake wait");
});


test("C7W private messages hide sending when either participant blocks the conversation", () => {
  const source = read("marketplace/messages/marketplace-messages.js");
  assert.match(source, /blockedByMe = blockState\?\.blocked_by_me === true/);
  assert.match(source, /blockedByPeer = blockState\?\.blocked_by_peer === true/);
  assert.match(source, /messagingBlocked = blockState\?\.messaging_blocked === true/);
  assert.match(source, /This Marketplace account has blocked this conversation\. Messaging is unavailable\./);
  assert.match(source, /messageForm\.hidden = messagingBlocked/);
});


test("C7W Marketplace suspension is distinct from incomplete registration", () => {
  const gate = read("marketplace/marketplace-gate.js");
  const browse = read("marketplace/marketplace-browse.js");
  const detail = read("marketplace/marketplace-detail.js");
  const seller = read("marketplace/marketplace-seller.js");
  const messages = read("marketplace/messages/marketplace-messages.js");

  assert.match(gate, /marketplaceSuspended: account\.marketplace_suspended === true/);
  assert.match(gate, /Marketplace access is suspended\. You can continue browsing/);
  assert.match(browse, /context\.marketplaceSuspended/);
  assert.match(detail, /blockUnavailableInteraction/);
  assert.match(detail, /Marketplace suspended/);
  assert.match(seller, /blockUnavailableInteraction/);
  assert.match(messages, /Marketplace access suspended/);
  assert.doesNotMatch(messages, /if \(context\.marketplaceSuspended\)[\s\S]{0,250}app\.herdharbor\.com/);
});


test("C7W nested Marketplace pages resolve their runtime from the current page directory", () => {
  const gate = read("marketplace/marketplace-gate.js");
  const listing = read("marketplace/listing/index.html");
  const seller = read("marketplace/seller/index.html");
  const messages = read("marketplace/messages/index.html");

  assert.match(gate, /const MARKETPLACE_BASE = new URL\("\.\/", window\.location\.href\)/);
  assert.doesNotMatch(gate, /gateScript\?\.src/);
  assert.match(listing, /data-marketplace-runtime="marketplace-detail\.js\?v=7"/);
  assert.match(seller, /data-marketplace-runtime="marketplace-seller\.js\?v=7"/);
  assert.match(messages, /data-marketplace-runtime="marketplace-messages\.js\?v=7"/);
});
