import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const manifest = JSON.parse(await readFile(new URL("../manifest.webmanifest", import.meta.url), "utf8"));
const worker = await readFile(new URL("../sw.js", import.meta.url), "utf8");

test("TripRadar exposes the core search and destination controls", () => {
  for (const id of ["searchForm", "origin", "dateFrom", "dateTo", "budget", "destinationFilter", "sortBy", "results", "savedList"]) {
    assert.match(html, new RegExp('id="' + id + '"'), "missing #" + id);
  }
});

test("search validation rejects an empty origin and same-day return", () => {
  assert.match(html, /Indiquez votre ville ou aéroport de départ/);
  assert.match(html, /value\s*<=\s*\$\("dateFrom"\)\.value/);
});

test("the interface clearly labels sample fares as demonstrations", () => {
  assert.match(html, /prix affichés sont des exemples de démonstration/);
  assert.match(html, /Aperçu de démonstration/);
});

test("PWA metadata and offline shell are present", () => {
  assert.equal(manifest.short_name, "TripRadar");
  assert.equal(manifest.display, "standalone");
  assert.match(worker, /addAll\(APP_FILES\)/);
  assert.match(html, /serviceWorker\.register/);
});
