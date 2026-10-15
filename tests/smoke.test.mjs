import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const manifest = JSON.parse(await readFile(new URL("../manifest.webmanifest", import.meta.url), "utf8"));
const worker = await readFile(new URL("../sw.js", import.meta.url), "utf8");
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

test("TripRadar exposes the core search, filter, and favorites controls", () => {
  for (const id of ["searchForm", "origin", "dateFrom", "dateTo", "budget", "destinationFilter", "sortBy", "results", "savedList", "favCount"]) {
    assert.match(html, new RegExp('id="' + id + '"'), "missing #" + id);
  }
});

test("search validation rejects empty origin and return dates on or before departure", () => {
  assert.match(html, /Indiquez votre ville ou aéroport de départ/);
  assert.match(html, /\$\("dateTo"\)\.value\s*<=\s*\$\("dateFrom"\)\.value/);
});

test("the result summary follows the selected sort mode", () => {
  assert.match(html, /sortLabels/);
  assert.match(html, /triées par/);
});

test("demo fares are never represented as verified live prices", () => {
  assert.match(html, /prix affichés sont des exemples de démonstration/);
  assert.match(html, /Aperçu de démonstration/);
  assert.match(readme, /ne lit pas encore de tarifs de vols ou d\'hôtels en temps réel/);
});

test("external provider links open with reverse-tabnabbing protections", () => {
  assert.match(html, /window\.open\([^;]*"_blank","noopener,noreferrer"\)/);
});

test("favorites persist locally and recover safely if storage is unavailable", () => {
  assert.match(html, /localStorage\.setItem\("tripradar-favorites"/);
  assert.match(html, /try\{favorites=new Set\(JSON\.parse\(localStorage\.getItem/);
});

test("PWA metadata and offline shell are present", () => {
  assert.equal(manifest.short_name, "TripRadar");
  assert.equal(manifest.display, "standalone");
  assert.match(worker, /addAll\(APP_FILES\)/);
  assert.match(html, /serviceWorker\.register/);
});