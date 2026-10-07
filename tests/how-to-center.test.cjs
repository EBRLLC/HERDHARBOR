"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const howTo = fs.readFileSync(path.join(root, "how-to/index.html"), "utf8");

test("How To Center is canonical, complete, and ordered", () => {
  assert.match(howTo, /HERDHARBOR HOW-TO CANONICAL/);
  assert.match(howTo, /Most common tasks/);
  assert.match(howTo, /New to HerdHarbor\? Start here\./);
  assert.match(howTo, /19 guides available/);
  assert.doesNotMatch(howTo, /Visual walkthrough coming soon/);

  const expected = [
    "getting-started","animals","pedigrees","breeding","litters","health","growth","genetics",
    "tasks","analytics","sales","subscription","sync","youth","symptoms","budget","settings",
    "workflow-index","faq"
  ];
  const actual = [...howTo.matchAll(/<section class="section" id="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(actual, expected);
  assert.equal([...howTo.matchAll(/<a class="guide-card"[^>]*href="#/g)].length, 19);
});

test("How To Center points to the app and matches live workflow language", () => {
  for (const route of ["animals","pedigrees","breeding","litters","health","symptoms","tasks","analytics","budget","sales","settings"]) {
    assert.match(howTo, new RegExp('https://app\\.herdharbor\\.com/#' + route));
  }
  assert.doesNotMatch(howTo, /href="\/#/);
  assert.match(howTo, /Weight, Treatment, Medication, Vaccination, Observation, or Veterinary visit/);
  assert.match(howTo, /How to Use Genetics & Rabbit Pair Analysis/);
  assert.match(howTo, /not a substitute for veterinary diagnosis or treatment/i);
  assert.match(howTo, /not a DNA test/i);
});

test("Free Adult is documented only as an automatic fallback", () => {
  assert.match(howTo, /Free Adult is an automatic fallback state, not a selectable account or signup plan/);
  assert.match(howTo, /Free Adult is never offered as a plan choice/);
  assert.match(howTo, /initial Member trial ends without a paid subscription/i);
  assert.doesNotMatch(howTo, /value="free_adult"/i);
});

test("host-independent header assets and navigation are valid", () => {
  assert.match(howTo, /href="https:\/\/herdharbor\.com\/" aria-label="Back to HerdHarbor website"/);
  assert.match(howTo, /href="https:\/\/app\.herdharbor\.com\/">Back to app<\/a>/);
  assert.match(howTo, /src="https:\/\/herdharbor\.com\/assets\/herdharbor-icon\.png"/);
});
