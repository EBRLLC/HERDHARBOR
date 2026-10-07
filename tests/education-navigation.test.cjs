const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const index = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("Education is a first-class main navigation item", () => {
  const navMatch = index.match(/<nav id="site-nav"[\s\S]*?<\/nav>/);
  assert.ok(navMatch, "main navigation should exist");
  assert.match(
    navMatch[0],
    /<a href="https:\/\/app\.herdharbor\.com\/resources\/">Education<\/a>/,
    "Education must be present in the static nav so desktop and mobile menus both expose it"
  );
});

test("Education is available from the footer", () => {
  const footerMatch = index.match(/<footer class="site-footer">[\s\S]*?<\/footer>/);
  assert.ok(footerMatch, "site footer should exist");
  assert.match(
    footerMatch[0],
    /<a href="https:\/\/app\.herdharbor\.com\/resources\/">Education<\/a>/,
    "footer should include an Education link"
  );
});

test("Education link targets the live HerdHarbor learning library", () => {
  const matches = index.match(/https:\/\/app\.herdharbor\.com\/resources\//g) || [];
  assert.ok(matches.length >= 2, "navigation and footer should point to the live Education library");
});
