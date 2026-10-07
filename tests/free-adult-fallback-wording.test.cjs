"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const home = fs.readFileSync(path.join(root, "index.html"), "utf8");
const help = fs.readFileSync(path.join(root, "how-to/index.html"), "utf8");

test("Free Adult is never presented as a selectable public pricing plan", () => {
  assert.doesNotMatch(home, /<h3>Free Adult<\/h3>/);
  assert.doesNotMatch(home, /Free Adult and Junior are free account paths/i);
  assert.match(home, /Free Adult is not a selectable plan/i);
  assert.match(home, /You cannot select Free Adult during signup/i);
  assert.match(home, /automatic fallback/i);
});

test("Free Adult is described as record-protection fallback after Member access ends", () => {
  assert.match(home, /cancellation, non-renewal, or an unresolved payment failure/i);
  assert.match(home, /existing animals and records are not deleted/i);
  assert.match(home, /Returning to Member should not require rebuilding those records/i);

  assert.match(help, /Free Adult is not a selectable account type/i);
  assert.match(help, /automatic fallback for eligible adult accounts when Member access ends/i);
  assert.match(help, /cancellation, non-renewal, or billing failure/i);
  assert.doesNotMatch(help, /Free Adult allows up to five active animals for new growth/i);
});

test("Junior remains the selectable free account option", () => {
  assert.match(home, /Junior is the selectable free account option/i);
  assert.match(help, /Junior is the selectable free plan/i);
});
