import test from "node:test";
import assert from "node:assert/strict";
import { searchDiscovery } from "./discovery.mjs";

const input = {
  origin: "ALG",
  destinations: ["CDG", "IST", "JFK", "LHR"],
  departureDate: "2027-11-10",
  adults: 2,
  currencyCode: "EUR"
};

test("discovery limits concurrency and sorts only verified provider offers", async () => {
  let active = 0;
  let maximum = 0;
  const result = await searchDiscovery(input, async ({ destination }) => {
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return [{ id: destination, destination, price: destination === "CDG" ? 180 : 100, currency: "EUR" }];
  });
  assert.equal(maximum, 2);
  assert.deepEqual(result.offers.map((offer) => offer.destination), ["IST", "JFK", "LHR", "CDG"]);
  assert.deepEqual(result.searchedDestinations, input.destinations);
  assert.deepEqual(result.failedDestinations, []);
  assert.equal(result.sources[0].resultCount, 4);
});

test("discovery preserves successful destinations when one provider search fails", async () => {
  const result = await searchDiscovery(input, async ({ destination }) => {
    if (destination === "IST") throw new Error("private upstream detail");
    return [{ id: destination, price: 90, currency: "EUR" }];
  });
  assert.deepEqual(result.failedDestinations, ["IST"]);
  assert.deepEqual(result.searchedDestinations, ["CDG", "JFK", "LHR"]);
  assert.equal(result.offers.length, 3);
  assert.equal(JSON.stringify(result).includes("private upstream detail"), false);
});

test("discovery rejects unbounded concurrency and invalid destination counts", async () => {
  await assert.rejects(() => searchDiscovery(input, async () => [], { maxConcurrency: 9 }), RangeError);
  await assert.rejects(() => searchDiscovery({ ...input, destinations: [] }, async () => []), TypeError);
  await assert.rejects(() => searchDiscovery({ ...input, destinations: Array(10).fill("CDG") }, async () => []), TypeError);
});
