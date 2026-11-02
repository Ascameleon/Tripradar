import test from "node:test";
import assert from "node:assert/strict";
import { searchDiscovery } from "./discovery.mjs";
import { assessOpportunity } from "./opportunity.mjs";
import { validateDiscoverySearch } from "./validation.mjs";

test("discovery searches destinations in parallel and reports partial source failures", async () => {
  const calls = [];
  const providers = [
    { id: "source-a", name: "Source A", search: async ({ destination }) => {
      calls.push(destination);
      if (destination === "FCO") throw new Error("private upstream detail");
      return [{ id: destination, origin: "LHR", destination, price: 120, currency: "EUR" }];
    } },
    { id: "source-b", name: "Source B", search: async ({ destination }) => {
      calls.push(destination);
      return [{ id: "b-" + destination, origin: "LHR", destination, price: 110, currency: "EUR" }];
    } }
  ];
  const result = await searchDiscovery({
    origin: "LHR", destinations: ["CDG", "FCO", "MAD"], departureDate: "2027-05-10",
    adults: 1, currencyCode: "EUR"
  }, providers);
  assert.equal(calls.length, 6);
  assert.equal(result.offers.length, 5);
  assert.equal(result.sources[0].status, "available");
  assert.equal(result.sources[0].destinationsChecked, 2);
  assert.equal(result.sources[1].status, "available");
  assert.equal(result.offers[0].price, 110);
  assert.equal(result.offers.every((offer) => offer.opportunity.status === "unverified"), true);
});

test("a discount is exceptional only with a verified, comparable baseline", () => {
  const offer = { price: 100, currency: "EUR", comparisonKey: "LHR-CDG-2027-05-10-ECO-1P" };
  assert.equal(assessOpportunity(offer, null).status, "unverified");
  const baseline = {
    verified: true, comparisonKey: offer.comparisonKey, currency: "EUR",
    medianPrice: 160, sampleCount: 8
  };
  const result = assessOpportunity(offer, baseline);
  assert.equal(result.status, "exceptional");
  assert.equal(result.discountPercent, 38);
  assert.equal(result.referencePrice, 160);
});

test("baseline comparisons reject mismatched currency, itinerary, or thin samples", () => {
  const offer = { price: 100, currency: "EUR", comparisonKey: "route-date-cabin" };
  assert.equal(assessOpportunity(offer, {
    verified: true, comparisonKey: "other-route", currency: "EUR", medianPrice: 180, sampleCount: 10
  }).status, "unverified");
  assert.equal(assessOpportunity(offer, {
    verified: true, comparisonKey: "route-date-cabin", currency: "USD", medianPrice: 180, sampleCount: 10
  }).status, "unverified");
  assert.equal(assessOpportunity(offer, {
    verified: true, comparisonKey: "route-date-cabin", currency: "EUR", medianPrice: 180, sampleCount: 3
  }).status, "unverified");
});

test("discovery validation accepts a bounded international destination list and rejects duplicates", () => {
  const now = new Date("2026-11-02T12:00:00Z");
  const valid = validateDiscoverySearch({
    origin: "LHR", destinations: ["CDG", "FCO", "MAD"], departureDate: "2026-11-10",
    adults: 2, currencyCode: "EUR"
  }, now);
  assert.deepEqual(valid.destinations, ["CDG", "FCO", "MAD"]);
  assert.equal(validateDiscoverySearch({
    origin: "LHR", destinations: ["CDG", "CDG"], departureDate: "2026-11-10"
  }, now), null);
  assert.equal(validateDiscoverySearch({
    origin: "LHR", destinations: Array.from({ length: 13 }, (_, i) => "A" + String(i).padStart(2, "0")),
    departureDate: "2026-11-10"
  }, now), null);
});
