"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Marketplace browse has baseline filter values even with zero listings", () => {
  const source = read("marketplace/marketplace-browse.js");

  for (const species of ["Rabbit","Cattle","Goat","Sheep","Poultry","Swine"]) {
    assert.ok(source.includes('"' + species + '"'), species);
  }

  for (const breed of ["Holland Lop","French Lop","Angus","Nigerian Dwarf","Katahdin","Rhode Island Red","Berkshire"]) {
    assert.ok(source.includes('"' + breed + '"'), breed);
  }

  assert.match(source, /\["KY","Kentucky"\]/);
  assert.match(source, /\["CA","California"\]/);
  assert.match(source, /\["NY","New York"\]/);
  assert.match(source, /Male \/ Buck \/ Bull \/ Boar \/ Ram \/ Rooster/);
  assert.match(source, /Female \/ Doe \/ Cow \/ Sow \/ Ewe \/ Hen/);
});

test("Marketplace breeds follow the selected species and merge live custom breeds", () => {
  const source = read("marketplace/marketplace-browse.js");
  assert.match(source, /function breedValues\(species, facets\)/);
  assert.match(source, /facets\?\.breed_pairs/);
  assert.match(source, /canonicalSpecies\(row\?\.species\) === key/);
  assert.match(source, /form\.elements\.species\.addEventListener\("change"/);
  assert.match(source, /renderBreedOptions\(form\.elements\.species\.value, ""\)/);
});

test("Marketplace fixed filters include canonical listing types and working pedigree choices", () => {
  const browse = read("marketplace/marketplace-browse.js");
  assert.match(browse, /value: "individual", label: "Individual animal"/);
  assert.match(browse, /value: "future_offspring", label: "Future offspring"/);
  assert.match(browse, /value: "litter_announcement", label: "Litter announcement"/);
  assert.match(browse, /<option value="none">None<\/option>/);
  assert.match(browse, /<option value="partial">Partial<\/option>/);
  assert.match(browse, /<option value="full">Full<\/option>/);
});

test("Marketplace filter catalogs survive an empty or failed live facet response", () => {
  const source = read("marketplace/marketplace-browse.js");
  assert.match(source, /catch \{\s*facets = \{\};\s*\}/);
  assert.match(source, /mergeValues\(BASE_SPECIES, live\)/);
  assert.match(source, /Object\.values\(BASE_BREEDS\)\.flat\(\)/);
});

test("Marketplace Browse cache identity changes with the filter catalog hotfix", () => {
  const shell = read("marketplace/marketplace-shell.js");
  assert.match(shell, /marketplace-browse\.js\?v=8/);
});
