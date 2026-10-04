const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("C2W Seller Profile uses only approved RPC contracts", () => {
  const source = read("marketplace/marketplace-profile.js");
  assert.match(source, /marketplace_owner_profile_editor/);
  assert.match(source, /marketplace_owner_profile_preview/);
  assert.match(source, /marketplace_owner_save_profile/);
  assert.doesNotMatch(source, /\.from\(["'](?:account_access|subscriptions|subscription_payments|billing|herdharbor_user_data)/i);
  assert.doesNotMatch(source, /HerdHarborStateStore|cloud-sync|herdharbor-cloud/i);
});

test("C2W profile form contains only approved public-facing fields", () => {
  const source = read("marketplace/marketplace-profile.js");
  for (const field of ["display_name","rabbitry_name","city","region","species_breeds","about","avatar"]) {
    assert.match(source, new RegExp('name="' + field + '"'));
  }
  assert.doesNotMatch(source, /name="(?:email|phone|street|exact_address|billing|subscription)"/i);
});

test("C2W avatar media is private, signed, validated, and Owner-prefixed", () => {
  const source = read("marketplace/marketplace-profile.js");
  assert.match(source, /marketplace-public/);
  assert.match(source, /createSignedUrl\(path, 900\)/);
  assert.match(source, /image\/jpeg/);
  assert.match(source, /image\/png/);
  assert.match(source, /image\/webp/);
  assert.match(source, /5 \* 1024 \* 1024/);
  assert.match(source, /userId.*profiles.*avatar-/s);
  assert.match(source, /removePath\(client, previousPath\)/);
  assert.doesNotMatch(source, /getPublicUrl/);
});

test("C2W profile runtime is lazy-loaded only from the authorized Owner shell", () => {
  const shell = read("marketplace/marketplace-owner-shell.js");
  const html = read("marketplace/index.html");
  assert.match(shell, /context\.role !== "owner"/);
  assert.match(shell, /marketplace-profile\.js\?v=1/);
  assert.match(shell, /data-marketplace-view="profile"/);
  assert.doesNotMatch(html, /marketplace-profile\.js/);
});

test("C2W preview never renders raw storage paths or contact details", () => {
  const source = read("marketplace/marketplace-profile.js");
  assert.doesNotMatch(source, /textContent\s*=\s*.*avatar_path/);
  assert.doesNotMatch(source, /email|phone|exact address/i);
});
