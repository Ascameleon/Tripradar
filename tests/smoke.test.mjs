import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const manifest = JSON.parse(await readFile(new URL("../manifest.webmanifest", import.meta.url), "utf8"));
const worker = await readFile(new URL("../sw.js", import.meta.url), "utf8");
const config = await readFile(new URL("../config.js", import.meta.url), "utf8");
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");


test("inline application JavaScript parses without syntax errors", () => {
  const start = html.indexOf("<script>") + "<script>".length;
  const end = html.indexOf("</script>", start);
  const script = html.slice(start, end);
  assert.ok(script, "inline application script must exist");
  assert.doesNotThrow(() => new vm.Script(script));
});

test("TripBoost exposes the core search, filter, and favorites controls", () => {
  for (const id of ["searchForm", "origin", "dateFrom", "dateTo", "budget", "adults", "rooms", "destinationFilter", "sortBy", "results", "savedList", "favCount"]) {
    assert.match(html, new RegExp('id="' + id + '"'), "missing #" + id);
  }
});

test("TripBoost uses an international, user-selected origin without an Algeria default", () => {
  assert.match(html, /id="origin"[^>]*placeholder="Code IATA \(ex\. JFK, LHR, CDG\)" value=""/);
  assert.match(html, /originText=\$\("origin"\)\.value\.trim\(\);/);
  assert.doesNotMatch(html, /Alger \(ALG\)|\|\|"Alger"/);
  assert.doesNotMatch(html, /ex\. ALG|Alger \(ALG\)/);
  assert.doesNotMatch(readme, /Algérie|Alger|Oran|Constantine|Annaba|Sétif|Béjaïa|Tlemcen|Batna|Biskra|Ghardaïa|Tamanrasset|Tindouf|Jijel|Adrar|El Oued/);
  assert.match(html, /london:"LHR"/);
  assert.match(html, /"new york":"JFK"/);
});

test("international IATA codes and city aliases resolve without Algeria city aliases", () => {
  const start = html.indexOf("const airportCodes=");
  const end = html.indexOf("\nfunction showLivePanel", start);
  assert.ok(start >= 0 && end > start, "airport resolver source must exist");
  const sandbox = {};
  vm.runInNewContext(html.slice(start, end), sandbox);
  assert.equal(sandbox.resolveAirport("JFK"), "JFK");
  assert.equal(sandbox.resolveAirport("LHR"), "LHR");
  assert.equal(sandbox.resolveAirport("London"), "LHR");
  assert.equal(sandbox.resolveAirport("New York"), "JFK");
  assert.equal(sandbox.resolveAirport("Alger"), null);
});

test("search validation rejects empty origin and return dates on or before departure", () => {
  assert.match(html, /Indiquez votre ville ou aéroport de départ/);
  assert.match(html, /\$\("dateTo"\)\.value\s*<=\s*\$\("dateFrom"\)\.value/);
});

test("traveler count is sent to live flight and hotel searches and invalidates old estimates", () => {
  assert.match(html, /id="adults"/);
  assert.match(html, /adults:Number\(\$\("adults"\)\.value\|\|1\)/);
  assert.match(html, /group_adults",String\(adults\)/);
  assert.match(html, /roomQuantity:Number\(\$\("rooms"\)\.value\|\|1\)/);
  assert.match(html, /no_rooms",String\(\$\("rooms"\)\.value\|\|1\)/);
  assert.match(html, /\$\("rooms"\)\.addEventListener\("change"/);
  assert.match(html, /\$\("adults"\)\.addEventListener\("change"/);
  assert.match(html, /voyageur\(s\)/);
});

test("the result summary follows the selected sort mode", () => {
  assert.match(html, /sortLabels/);
  assert.match(html, /triées par/);
});

test("demo fares are never represented as verified live prices", () => {
  assert.match(html, /prix affichés sont des exemples de démonstration/);
  assert.match(html, /Aperçu de démonstration/);
  assert.match(readme, /Les prix et durées du catalogue de destinations sont/);
});


test("flight cards attempt live API search and clearly fall back without inventing prices", () => {
  assert.match(html, /id="livePanel"/);
  assert.match(html, /\/api\/health/);
  assert.match(html, /\/api\/flights\/search/);
  assert.match(html, /\/api\/hotels\/search/);
  assert.match(html, /Résultats d’hébergements/);
  assert.match(html, /tripEstimatePanel/);
  assert.match(html, /renderTripEstimate/);
  assert.match(html, /liveFlightCriteriaByDestination\[destinationId\]!==key\|\|liveHotelCriteriaByDestination\[destinationId\]!==key/);
  assert.match(html, /function currentCriteriaKey\(\)/);
  assert.match(html, /\["origin","dateFrom","dateTo"\]\.forEach\(id=>\$\(id\)\.addEventListener\("input"/);
  assert.match(html, /flight\.tripType==="round-trip"/);
  assert.match(html, /returnDate:\$\("dateTo"\)\.value/);
  assert.match(readme, /\/api\/hotels\/search/);
  assert.match(html, /Aucun prix fictif n’est affiché/);
  assert.match(html, /london:"LHR"/);
  assert.match(html, /amsterdam:"AMS"/);
  assert.match(html, /"new york":"JFK"/);
  assert.match(html, /Comparer les vols sur Google Flights/);
  assert.match(readme, /window\.TRIPBOOST_API_BASE/);
});

test("external fallback links use safe new-tab attributes", () => {
  assert.match(html, /a\.target="_blank"/);
  assert.match(html, /a\.rel="noopener noreferrer"/);
  assert.match(html, /booking\.com\/searchresults\.html/);
});

test("favorites persist locally and recover safely if storage is unavailable", () => {
  assert.match(html, /localStorage\.setItem\("tripboost-favorites"/);
  assert.match(html, /try\{favorites=new Set\(JSON\.parse\(localStorage\.getItem/);
});

test("API applies bounded request, header, and keep-alive timeouts", async () => {
  const server = await readFile(new URL("../api/server.mjs", import.meta.url), "utf8");
  assert.match(server, /server\.headersTimeout\s*=\s*10_000/);
  assert.match(server, /server\.requestTimeout\s*=\s*15_000/);
  assert.match(server, /server\.keepAliveTimeout\s*=\s*5_000/);
});

test("TripBoost map-first discovery and PWA metadata are present", () => {
  assert.match(html, /id="radarMap"/);
  assert.match(html, /\/api\/discovery\/search/);
  assert.match(html, /searchAllDestinations/);
  assert.match(html, /Baisse non confirmée/);
  assert.match(readme, /carte mondiale est l.interface principale/);
  assert.equal(manifest.short_name, "TripBoost");
  assert.equal(manifest.display, "standalone");
  assert.match(worker, /tripboost-static-v1/);
  assert.match(worker, /addAll\(APP_FILES\)/);
  assert.match(html, /serviceWorker\.register/);
  assert.ok(html.includes('<script src="./config.js"></script>'));
  assert.ok(worker.includes('"./config.js"'));
  assert.ok(config.includes("TRIPBOOST_API_BASE"));
});

test("late flight or hotel responses cannot overwrite newer searches or changed criteria", () => {
  assert.match(html, /let activeLiveRequest=0/);
  assert.match(html, /const requestId=\+\+activeLiveRequest;const criteriaKey=currentCriteriaKey\(\)/);
  assert.match(html, /requestId!==activeLiveRequest\|\|currentCriteriaKey\(\)!==criteriaKey\)return/);
  assert.match(html, /liveFlightCriteriaByDestination\[destination\.id\]=criteriaKey/);
  assert.match(html, /liveHotelCriteriaByDestination\[destination\.id\]=criteriaKey/);
});
