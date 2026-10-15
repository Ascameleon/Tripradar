import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const manifest = JSON.parse(await readFile(new URL("../manifest.webmanifest", import.meta.url), "utf8"));
const worker = await readFile(new URL("../sw.js", import.meta.url), "utf8");
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");


test("inline application JavaScript parses without syntax errors", () => {
  const start = html.indexOf("<script>") + "<script>".length;
  const end = html.indexOf("</script>", start);
  const script = html.slice(start, end);
  assert.ok(script, "inline application script must exist");
  assert.doesNotThrow(() => new vm.Script(script));
});

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
  assert.match(readme, /Seule la recherche aller peut afficher des tarifs live/);
});


test("flight cards attempt live API search and clearly fall back without inventing prices", () => {
  assert.match(html, /id="livePanel"/);
  assert.match(html, /\/api\/health/);
  assert.match(html, /\/api\/flights\/search/);
  assert.match(html, /Aucun prix fictif n’est affiché/);
  assert.match(html, /Comparer les vols sur Google Flights/);
  assert.match(readme, /window\.TRIPRADAR_API_BASE/);
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