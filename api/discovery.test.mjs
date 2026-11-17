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

test("discovery excludes malformed or non-positive provider offers", async () => {
  const result = await searchDiscovery({ ...input, destinations: ["CDG"] }, async () => [
    { id: "valid", price: 125, currency: "EUR" },
    { id: "zero", price: 0, currency: "EUR" },
    { id: "negative", price: -10, currency: "EUR" },
    { id: "missing" },
    { id: "not-a-number", price: "unknown", currency: "EUR" },
    { id: "infinite", price: Infinity, currency: "EUR" },
    { id: "boolean-true", price: true, currency: "EUR" },
    { id: "boolean-false", price: false, currency: "EUR" },
    { id: "numeric-string", price: "125", currency: "EUR" },
    { id: "array-price", price: [125], currency: "EUR" },
    { id: "object-price", price: { amount: 125 }, currency: "EUR" },
    null
  ]);
  assert.deepEqual(result.offers.map((offer) => offer.id), ["valid"]);
  assert.equal(result.sources[0].resultCount, 1);
});

test("discovery rejects unbounded concurrency and invalid destination counts", async () => {
  await assert.rejects(() => searchDiscovery(input, async () => [], { maxConcurrency: 9 }), RangeError);
  await assert.rejects(() => searchDiscovery({ ...input, destinations: [] }, async () => []), TypeError);
  await assert.rejects(() => searchDiscovery({ ...input, destinations: Array(10).fill("CDG") }, async () => []), TypeError);
});


test("discovery propagates client abort and does not schedule remaining destinations", async () => {
  const controller = new AbortController();
  const started = [];
  let resolveStarted;
  const bothStarted = new Promise((resolve) => { resolveStarted = resolve; });

  const pending = searchDiscovery(input, async ({ destination }, { signal }) => {
    started.push(destination);
    if (started.length === 2) resolveStarted();
    return new Promise((resolve, reject) => {
      if (signal.aborted) return reject(signal.reason);
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  }, { maxConcurrency: 2, signal: controller.signal });

  await bothStarted;
  controller.abort(new Error("client disconnected"));
  await assert.rejects(pending, /client disconnected/);
  assert.deepEqual(started, ["CDG", "IST"]);
});

test("discovery rejects an already-aborted signal before calling the provider", async () => {
  const controller = new AbortController();
  controller.abort(new Error("already disconnected"));
  let calls = 0;
  await assert.rejects(
    searchDiscovery(input, async () => { calls += 1; return []; }, { signal: controller.signal }),
    /already disconnected/
  );
  assert.equal(calls, 0);
});
