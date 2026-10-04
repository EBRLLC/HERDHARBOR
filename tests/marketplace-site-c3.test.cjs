const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("C3W supports both manual and read-only herd-prefill listing paths", () => {
  const source = read("marketplace/marketplace-listings.js");
  assert.match(source, /Create Manual Listing/);
  assert.match(source, /Select From My Herd/);
  assert.match(source, /marketplace_member_herd_animals/);
  assert.match(source, /marketplace_member_save_listing/);
  assert.match(source, /source_animal_id_value/);
  assert.match(source, /detached snapshot/i);
});

test("C3W uses Marketplace RPCs only and never private herd sync storage directly", () => {
  const source = read("marketplace/marketplace-listings.js");
  assert.match(source, /marketplace_member_listings/);
  assert.match(source, /marketplace_member_set_listing_photos/);
  assert.match(source, /marketplace_member_delete_listing/);
  assert.doesNotMatch(source, /HerdHarborStateStore|herdharbor_user_data|herdharbor_sync_records|cloud-sync|herdharbor-cloud/i);
  assert.doesNotMatch(source, /\.from\(["'](?:herdharbor_|account_access|subscriptions|billing)/i);
});

test("C3W listing media is private signed media with strict client limits", () => {
  const source = read("marketplace/marketplace-listings.js");
  assert.match(source, /marketplace-public/);
  assert.match(source, /createSignedUrl\(path, 300\)/);
  assert.match(source, /MAX_PHOTOS = 6/);
  assert.match(source, /8 \* 1024 \* 1024/);
  assert.match(source, /image\/jpeg/);
  assert.match(source, /image\/png/);
  assert.match(source, /image\/webp/);
  assert.match(source, /userId.*listings.*listingId/s);
  assert.doesNotMatch(source, /getPublicUrl/);
});

test("C3W partial photo upload failures clean up files already uploaded", () => {
  const source = read("marketplace/marketplace-listings.js");
  const upload = source.match(/async function uploadPhotos[\s\S]*?^  }/m)?.[0] || "";
  assert.match(upload, /const uploaded = \[\]/);
  assert.match(upload, /await removePaths\(client, uploaded\)/);
});

test("C3W listing delete is explicitly isolated from source herd record", () => {
  const source = read("marketplace/marketplace-listings.js");
  assert.match(source, /marketplace_member_delete_listing/);
  assert.match(source, /source HerdHarbor animal will not be changed/);
  assert.doesNotMatch(source, /\.from\(["']herdharbor_[^"']*["']\)[\s\S]{0,160}\.delete\(/i);
  assert.doesNotMatch(source, /rpc\([^\n]+(?:delete|remove)[_-](?:animal|herd)/i);
});

test("C3W listing runtime remains lazy-loaded behind active account authorization", () => {
  const shell = read("marketplace/marketplace-owner-shell.js");
  const html = read("marketplace/index.html");
  assert.match(shell, /const interactive = context\.isAuthenticated && context\.accountStatus === "active" && context\.marketplaceAccessReady === true/);
  assert.match(shell, /marketplace-listings\.js\?v=7/);
  assert.match(shell, /data-marketplace-view="listings"/);
  assert.doesNotMatch(html, /marketplace-listings\.js/);
});
