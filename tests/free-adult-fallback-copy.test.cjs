"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const home = read("index.html");
const howTo = read("how-to/index.html");
const currentRelease = read("releases/v2.0.0/index.html");

test("Free Adult is not presented as a selectable website plan", () => {
  assert.doesNotMatch(home, /<h3>Free Adult<\/h3>/);
  assert.doesNotMatch(home, /Free Adult and Junior are free account paths/i);
  assert.doesNotMatch(home, /continue (?:as|with) (?:a )?paid Member or (?:fall back to )?Free Adult/i);
  assert.match(home, /Free Adult is account protection, not a signup plan/i);
  assert.match(home, /It cannot be selected when creating an account/i);
  assert.match(home, /subscription is canceled or a payment failure interrupts access/i);
});

test("pricing presents actual signup paths separately from fallback protection", () => {
  assert.match(home, /<h3>Junior<\/h3>/);
  assert.match(home, /Choose Junior/);
  assert.match(home, /<h3>Member<\/h3>/);
  assert.match(home, /Start your free month/);
  assert.match(home, /<h3>Business<\/h3>/);
  assert.match(home, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});

test("website help and release copy use the same fallback-only rule", () => {
  for (const source of [howTo, currentRelease]) {
    assert.match(source, /not (?:a selectable signup plan|a signup plan|selectable at signup)/i);
    assert.match(source, /subscription is canceled or (?:a )?payment (?:failure|fails)/i);
  }
  assert.doesNotMatch(howTo, /fallback after trial or paid Member access ends/i);
  assert.doesNotMatch(howTo, /paid\/trial Member access ends/i);
});
