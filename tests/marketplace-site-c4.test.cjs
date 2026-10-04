const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("C4W Browse is the default real Marketplace experience with required filters", () => {
  const shell = read("marketplace/marketplace-shell.js");
  const source = read("marketplace/marketplace-browse.js");

  assert.match(shell, /show\(viewFromLocation\(\)\)/);
  assert.match(shell, /return "browse"/);
  assert.match(shell, /marketplace-browse\.js\?v=\d+/);
  assert.match(source, /marketplace_public_search_v2/);
  assert.match(source, /marketplace_public_facets_v2/);
  assert.match(source, /functions\.invoke\("marketplace-public-media"/);
  assert.match(source, /marketplace_member_favorite_ids/);
  assert.match(source, /marketplace_member_toggle_favorite/);

  for (const field of ["q","species","breed","sex","region","pedigree","kind","min","max","sort"]) {
    assert.match(source, new RegExp('name="' + field + '"'));
  }
  assert.match(source, /history\.pushState/);
  assert.match(source, /URLSearchParams\(window\.location\.search\)/);
  assert.match(source, /total_count/);
});

test("C4W browse cards are image-led and expose no private herd/contact fields", () => {
  const source = read("marketplace/marketplace-browse.js");
  assert.match(source, /browse-card-media/);
  assert.match(source, /rabbitry_name/);
  assert.match(source, /seller_verification_status/);
  assert.match(source, /\/marketplace\/listing\/\?id=/);
  assert.doesNotMatch(source, /source_animal_id|seller_id\b|user_id\b|exact_address|billing|subscription|medical|acquisition/i);
  assert.doesNotMatch(source, /email|phone/i);
});

test("C4W direct listing route uses only privacy-safe detail and private media RPCs", () => {
  const html = read("marketplace/listing/index.html");
  const source = read("marketplace/marketplace-detail.js");

  assert.match(html, /data-marketplace-runtime="marketplace-detail\.js\?v=\d+"/);
  assert.match(html, /noindex,nofollow,noarchive/);
  assert.match(html, /https:\/\/herdharbor\.com\/marketplace\/listing\//);
  assert.match(source, /marketplace_public_listing_v2/);
  assert.match(source, /marketplace_public_listing_media_v2/);
  assert.match(source, /marketplace_member_favorite_ids/);
  assert.doesNotMatch(source, /createSignedUrl|storage\.from\("marketplace-public"\)/);
  assert.match(source, /View HerdHarbor Pedigree/);
  assert.match(source, /\/marketplace\/seller\/\?id=/);
  assert.doesNotMatch(source, /source_animal_id|seller_id\b|user_id\b|exact_address|email|phone|medical|acquisition/i);
});

test("C4W direct seller route uses public-shaped seller/search contracts", () => {
  const html = read("marketplace/seller/index.html");
  const source = read("marketplace/marketplace-seller.js");

  assert.match(html, /data-marketplace-runtime="marketplace-seller\.js\?v=\d+"/);
  assert.match(html, /noindex,nofollow,noarchive/);
  assert.match(source, /marketplace_public_seller_v2/);
  assert.match(source, /marketplace_public_search_v2/);
  assert.match(source, /seller_public_id_value: sellerId/);
  assert.match(source, /marketplace_public_seller_media_v2/);
  assert.match(source, /createSignedUrl\(path, 300\)/);
  assert.doesNotMatch(source, /exact_address|billing|subscription|medical|acquisition/i);
  assert.doesNotMatch(source, /name="(?:email|phone|street)"/i);
});

test("C4W nested routes reuse the Marketplace gate and keep SSO tokens out of URLs", () => {
  const gate = read("marketplace/marketplace-gate.js");
  const pages = [read("marketplace/listing/index.html"), read("marketplace/seller/index.html")].join("\n");

  assert.match(gate, /document\.currentScript/);
  assert.match(gate, /dataset\.marketplaceRuntime/);
  assert.match(gate, /client\.auth\.getSession\(\)/);
  assert.match(gate, /client\.rpc\("marketplace_member_session"\)/);
  assert.match(gate, /APP_ORIGIN = "https:\/\/app\.herdharbor\.com"/);
  assert.match(gate, /event\.origin !== APP_ORIGIN/);
  assert.match(pages, /\.\.\/marketplace-gate\.js\?v=\d+/);
  assert.doesNotMatch(gate, /searchParams\.set\(["\'](?:access_token|refresh_token)|[?&](?:access_token|refresh_token)=/i);
  assert.doesNotMatch(pages, /app\.herdharbor\.com\/.*\.(?:js|css)/i);
});

test("C4W Marketplace tabs support direct hashes and browser history", () => {
  const shell = read("marketplace/marketplace-shell.js");
  assert.match(shell, /#my-listings/);
  assert.match(shell, /#seller-profile/);
  assert.match(shell, /history\.pushState/);
  assert.match(shell, /addEventListener\("popstate"/);
});

test("C4W responsive marketplace styling stays website-oriented", () => {
  const css = read("marketplace/marketplace.css");
  assert.match(css, /marketplace-browse-grid/);
  assert.match(css, /marketplace-detail-layout/);
  assert.match(css, /seller-public-header/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /var\(--navy\)/);
  assert.match(css, /var\(--teal\)/);
});

test("C4W guest browsing uses public read contracts while account features remain explicit", () => {
  const content = [
    read("marketplace/marketplace-gate.js"),
    read("marketplace/marketplace-browse.js"),
    read("marketplace/marketplace-detail.js"),
    read("marketplace/marketplace-seller.js")
  ].join("\n");
  assert.doesNotMatch(content, /preview=true|publicLaunch/i);
  assert.match(content, /role: "guest"/);
  assert.match(content, /marketplace_public_search_v2/);
  assert.match(content, /marketplace_member_open_listing_conversation/);
});
