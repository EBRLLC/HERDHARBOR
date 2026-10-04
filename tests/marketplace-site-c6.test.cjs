const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("C6W Admin tab is injected only inside the verified Owner shell", () => {
  const shell = read("marketplace/marketplace-shell.js");
  const index = read("marketplace/index.html");
  assert.match(shell, /const owner = interactive && context\.role === "owner"/);
  assert.match(shell, /data-marketplace-view="admin"/);
  assert.match(shell, /marketplace-admin\.js\?v=7/);
  assert.match(shell, /#admin/);
  assert.doesNotMatch(index, />Admin</);
  assert.doesNotMatch(index, /marketplace-admin\.js/);
});

test("C6W admin browser code uses Owner RPCs only and never reads moderation tables directly", () => {
  const source = read("marketplace/marketplace-admin.js");
  for (const fn of [
    "marketplace_owner_admin_summary_v2",
    "marketplace_owner_admin_reports_v2",
    "marketplace_owner_admin_sellers",
    "marketplace_owner_admin_listings",
    "marketplace_owner_admin_moderate_listing",
    "marketplace_owner_admin_moderate_seller",
    "marketplace_owner_admin_resolve_report_v2",
    "marketplace_owner_admin_history"
  ]) assert.match(source, new RegExp(fn));

  assert.doesNotMatch(source, /\.from\(["']marketplace_(?:reports|moderation_actions|listings|public_profiles)/i);
  assert.doesNotMatch(source, /auth\.admin|service_role|SUPABASE_SERVICE_ROLE_KEY/i);
});

test("C6W destructive moderation requires a written reason", () => {
  const source = read("marketplace/marketplace-admin.js");
  assert.match(source, /Moderation reason/);
  assert.match(source, /A moderation reason is required/);
  assert.match(source, /maxlength="1000"/);
  assert.match(source, /if \(!reason\)/);
  assert.match(source, /reason_value:\s*reason/);
});

test("C6W listing moderation restores only to draft and never directly republishes", () => {
  const source = read("marketplace/marketplace-admin.js");
  assert.match(source, /data-listing-action="restore_to_draft"/);
  assert.match(source, /Restore to draft/);
  assert.match(source, /It will not be automatically republished/);
  assert.doesNotMatch(source, /data-listing-action="available"/);
});

test("C6/C7 moderation preserves the main HerdHarbor account while separating seller and account suspension", () => {
  const source = read("marketplace/marketplace-admin.js");
  assert.match(source, /None of these controls disable the main HerdHarbor account/);
  assert.match(source, /The account can still browse and message unless you use a full Marketplace account suspension/);
  assert.match(source, /Block this account from Marketplace messaging, favorites, seller tools/);
  assert.match(source, /Their main HerdHarbor account stays active/);
  assert.doesNotMatch(source, /deleteUser|banUser|auth\.admin|account_access/i);
});

test("C6W report queue supports remove listing, suspend seller, resolve, and dismiss", () => {
  const source = read("marketplace/marketplace-admin.js");
  for (const action of ["remove_listing","suspend_seller","suspend_account","resolve","dismiss"]) {
    assert.match(source, new RegExp('data-report-action="' + action + '"'));
  }
  assert.match(source, /marketplace_owner_admin_resolve_report_v2/);
});

test("C6W audit log is read-only in the browser", () => {
  const source = read("marketplace/marketplace-admin.js");
  assert.match(source, /marketplace_owner_admin_history/);
  assert.match(source, /Every moderation action performed through the Owner controls is recorded here/);
  assert.doesNotMatch(source, /insert.*marketplace_moderation_actions|update.*marketplace_moderation_actions/i);
});

test("C6W moderation UI escapes report and profile content before rendering", () => {
  const source = read("marketplace/marketplace-admin.js");
  assert.match(source, /const esc =/);
  assert.match(source, /esc\(report\.details\)/);
  assert.match(source, /esc\(report\.reason/);
  assert.match(source, /esc\(seller\.rabbitry_name|esc\(name\)/);
});

test("C6W changed shared assets have new identities", () => {
  const gate = read("marketplace/marketplace-gate.js");
  const index = read("marketplace/index.html");
  const listing = read("marketplace/listing/index.html");
  const seller = read("marketplace/seller/index.html");
  assert.match(gate, /marketplace-shell\.js\?v=7/);
  assert.match(index, /marketplace\.css\?v=7/);
  assert.match(index, /marketplace-gate\.js\?v=8/);
  assert.match(listing, /marketplace\.css\?v=7/);
  assert.match(listing, /marketplace-gate\.js\?v=8/);
  assert.match(seller, /marketplace\.css\?v=7/);
  assert.match(seller, /marketplace-gate\.js\?v=8/);
});

test("C6W admin remains responsive and keyboard accessible", () => {
  const css = read("marketplace/marketplace.css");
  assert.match(css, /marketplace-admin-summary/);
  assert.match(css, /marketplace-admin-dialog/);
  assert.match(css, /button-danger/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /:focus-visible/);
});
