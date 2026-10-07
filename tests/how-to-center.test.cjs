"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const howTo = fs.readFileSync(path.join(root, "how-to/index.html"), "utf8");

test("How To Center is complete, ordered, and uses canonical app routes", () => {
  assert.match(howTo, /HERDHARBOR HOW-TO CANONICAL/);
  assert.match(howTo, /Most common tasks/);
  assert.match(howTo, /New to HerdHarbor\? Start here\./);
  assert.match(howTo, /20 guides available/);
  assert.doesNotMatch(howTo, /Visual walkthrough coming soon/);
  assert.doesNotMatch(howTo, /href="\/#/);

  const expected = [
    "getting-started","animals","pedigrees","breeding","litters","health","growth","genetics",
    "tasks","analytics","sales","marketplace","subscription","sync","youth","symptoms","budget","settings",
    "workflow-index","faq"
  ];
  const actual = [...howTo.matchAll(/<section class="section" id="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(actual, expected);
  assert.equal([...howTo.matchAll(/<a class="guide-card"[^>]*href="#/g)].length, 20);
});

test("How To Center matches current customer-facing workflow labels", () => {
  for (const route of ["animals","pedigrees","breeding","litters","health","symptoms","tasks","analytics","budget","sales","settings"]) {
    assert.match(howTo, new RegExp('https://app\\.herdharbor\\.com/#' + route));
  }
  assert.match(howTo, /Weight, Treatment, Medication, Vaccination, Observation, or Veterinary visit/);
  assert.match(howTo, /How to Use Genetics & Rabbit Pair Analysis/);
  assert.match(howTo, /Free Adult is the permanent adult fallback/i);
  assert.match(howTo, /not a signup plan and cannot be selected as an account type/i);
  assert.match(howTo, /payment failure ultimately ends paid access/i);
  assert.match(howTo, /herd records are not deleted/i);
  assert.match(howTo, /not a DNA test/i);
  assert.match(howTo, /not a substitute for veterinary diagnosis or treatment/i);
  assert.match(howTo, /Junior is a separate free plan/i);
  assert.doesNotMatch(howTo, /Trial, Membership & Referrals\s*v1\.8\.4/i);
  assert.doesNotMatch(howTo, /Paper Pedigree AI|guide-import-paper-pedigree|Import a paper pedigree photo/i);
  assert.doesNotMatch(howTo, /localStorage\.|sessionStorage\.|indexedDB\./);
});

test("How To Center uses host-independent navigation and a valid public brand asset", () => {
  assert.match(howTo, /href="https:\/\/herdharbor\.com\/" aria-label="Back to HerdHarbor website"/);
  assert.match(howTo, /href="https:\/\/app\.herdharbor\.com\/">Back to app<\/a>/);
  assert.match(howTo, /src="https:\/\/herdharbor\.com\/assets\/herdharbor-icon\.png"/);
});


test("Marketplace is documented as a separate website workflow", () => {
  assert.match(howTo, /id="marketplace"/);
  assert.match(howTo, /href="https:\/\/herdharbor\.com\/marketplace\/"/);
  assert.match(howTo, /Anyone can view active listings/);
  assert.match(howTo, /Seller Profile before publishing/);
  assert.match(howTo, /Buyer note:[\s\S]*do not need a Seller Profile to browse or message a seller/i);
});


test("How To Center covers live document show and production workflows", () => {
  for (const anchor of ["guide-customize-print-pedigree","guide-birth-certificate","guide-new-owner-package","guide-show-entry","guide-production-record"]) {
    assert.match(howTo, new RegExp('id="' + anchor + '"'));
  }
  assert.match(howTo, /Free Adult is an automatic fallback state/);
  assert.match(howTo, /cannot be selected during signup/);
});
