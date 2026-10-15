import test from "node:test";
import assert from "node:assert/strict";
import { validateSearch } from "./validation.mjs";

const today = new Date("2026-10-15T12:00:00Z");
const valid = { origin: "ALG", destination: "CDG", departureDate: "2026-11-10", adults: 1, currencyCode: "EUR" };

test("accepts a valid future IATA flight search", () => {
  assert.deepEqual(validateSearch(valid, today), valid);
});

test("rejects missing or malformed airport codes", () => {
  assert.equal(validateSearch({ ...valid, origin: "Alger" }, today), null);
  assert.equal(validateSearch({ ...valid, destination: "ALG" }, today), null);
});

test("rejects impossible dates and dates in the past", () => {
  assert.equal(validateSearch({ ...valid, departureDate: "2026-02-30" }, today), null);
  assert.equal(validateSearch({ ...valid, departureDate: "2026-10-14" }, today), null);
});

test("rejects unsupported passenger counts and malformed currency codes", () => {
  assert.equal(validateSearch({ ...valid, adults: 0 }, today), null);
  assert.equal(validateSearch({ ...valid, adults: 10 }, today), null);
  assert.equal(validateSearch({ ...valid, currencyCode: "EURO" }, today), null);
});