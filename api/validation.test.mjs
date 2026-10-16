import test from "node:test";
import assert from "node:assert/strict";
import { validateSearch, validateHotelSearch } from "./validation.mjs";

const today = new Date("2026-10-15T12:00:00Z");
const valid = { origin: "ALG", destination: "CDG", departureDate: "2026-11-10", adults: 1, currencyCode: "EUR" };

test("accepts a valid future IATA flight search", () => {
  assert.deepEqual(validateSearch(valid, today), valid);
});

test("rejects malformed JSON values and missing or malformed airport codes", () => {
  assert.equal(validateSearch(null, today), null);
  assert.equal(validateSearch([], today), null);
  assert.equal(validateSearch({ ...valid, origin: "Alger" }, today), null);
  assert.equal(validateSearch({ ...valid, destination: "ALG" }, today), null);
});

test("rejects impossible dates and dates in the past", () => {
  assert.equal(validateSearch({ ...valid, departureDate: "2026-02-30" }, today), null);
  assert.equal(validateSearch({ ...valid, departureDate: "2026-10-14" }, today), null);
});

test("rejects unsupported passenger counts and malformed currency codes", () => {
  assert.equal(validateSearch({ ...valid, adults: 0 }, today), null);
  assert.deepEqual(validateSearch({ ...valid, adults: null }, today), valid);
  assert.equal(validateSearch({ ...valid, adults: 10 }, today), null);
  assert.equal(validateSearch({ ...valid, currencyCode: "EURO" }, today), null);
});

test("accepts valid round-trip dates and rejects invalid return dates", () => {
  assert.deepEqual(validateSearch({ ...valid, returnDate: "2026-11-14" }, today), {
    ...valid, returnDate: "2026-11-14"
  });
  assert.equal(validateSearch({ ...valid, returnDate: "2026-11-10" }, today), null);
  assert.equal(validateSearch({ ...valid, returnDate: "2026-02-30" }, today), null);
  assert.equal(validateSearch({ ...valid, returnDate: "2026-10-14" }, today), null);
});

test("accepts a valid hotel search and normalizes city and currency", () => {
  assert.deepEqual(validateHotelSearch({
    cityCode: "ist", checkInDate: "2026-11-10", checkOutDate: "2026-11-14", adults: 2, currencyCode: "eur"
  }, today), {
    cityCode: "IST", checkInDate: "2026-11-10", checkOutDate: "2026-11-14", adults: 2, currencyCode: "EUR"
  });
});

test("rejects invalid hotel payloads, dates, city codes, guests, and currency", () => {
  assert.equal(validateHotelSearch(null, today), null);
  assert.equal(validateHotelSearch([], today), null);
  const hotel = { cityCode: "IST", checkInDate: "2026-11-10", checkOutDate: "2026-11-14", adults: 2, currencyCode: "EUR" };
  assert.equal(validateHotelSearch({ ...hotel, checkOutDate: hotel.checkInDate }, today), null);
  assert.equal(validateHotelSearch({ ...hotel, checkInDate: "2026-02-30" }, today), null);
  assert.equal(validateHotelSearch({ ...hotel, cityCode: "Istanbul" }, today), null);
  assert.equal(validateHotelSearch({ ...hotel, adults: 10 }, today), null);
  assert.equal(validateHotelSearch({ ...hotel, adults: 0 }, today), null);
  assert.equal(validateHotelSearch({ ...hotel, currencyCode: "EURO" }, today), null);
});
