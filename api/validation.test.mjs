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

test("rejects non-string flight identifiers, dates, and currency values without coercion", () => {
  for (const [field, value] of [
    ["origin", ["ALG"]],
    ["origin", { code: "ALG" }],
    ["destination", ["CDG"]],
    ["destination", true],
    ["departureDate", ["2026-11-10"]],
    ["departureDate", 20261110],
    ["returnDate", ["2026-11-14"]],
    ["returnDate", { date: "2026-11-14" }],
    ["currencyCode", ["EUR"]],
    ["currencyCode", { code: "EUR" }]
  ]) {
    assert.equal(validateSearch({ ...valid, [field]: value }, today), null, field);
  }
});

test("rejects impossible dates and dates in the past", () => {
  assert.equal(validateSearch({ ...valid, departureDate: "2026-02-30" }, today), null);
  assert.equal(validateSearch({ ...valid, departureDate: "2026-10-14" }, today), null);
});

test("enforces the six-adult flight product limit and validates currency", () => {
  assert.equal(validateSearch({ ...valid, adults: 0 }, today), null);
  assert.deepEqual(validateSearch({ ...valid, adults: null }, today), valid);
  assert.deepEqual(validateSearch({ ...valid, adults: 6 }, today), { ...valid, adults: 6 });
  assert.equal(validateSearch({ ...valid, adults: 7 }, today), null);
  assert.equal(validateSearch({ ...valid, adults: 9 }, today), null);
  assert.equal(validateSearch({ ...valid, adults: "2" }, today), null);
  assert.equal(validateSearch({ ...valid, adults: true }, today), null);
  assert.equal(validateSearch({ ...valid, adults: 2.5 }, today), null);
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
    cityCode: "IST", checkInDate: "2026-11-10", checkOutDate: "2026-11-14", adults: 2, roomQuantity: 1, currencyCode: "EUR"
  });
});

test("rejects non-string hotel codes, dates, and currency values without coercion", () => {
  const hotel = { cityCode: "IST", checkInDate: "2026-11-10", checkOutDate: "2026-11-14", adults: 2, currencyCode: "EUR" };
  for (const [field, value] of [
    ["cityCode", ["IST"]],
    ["cityCode", { code: "IST" }],
    ["checkInDate", ["2026-11-10"]],
    ["checkInDate", 20261110],
    ["checkOutDate", ["2026-11-14"]],
    ["checkOutDate", true],
    ["currencyCode", ["EUR"]],
    ["currencyCode", { code: "EUR" }]
  ]) {
    assert.equal(validateHotelSearch({ ...hotel, [field]: value }, today), null, field);
  }
});

test("rejects invalid hotel payloads, dates, city codes, guests, and currency", () => {
  assert.equal(validateHotelSearch(null, today), null);
  assert.equal(validateHotelSearch([], today), null);
  const hotel = { cityCode: "IST", checkInDate: "2026-11-10", checkOutDate: "2026-11-14", adults: 2, currencyCode: "EUR" };
  assert.equal(validateHotelSearch({ ...hotel, checkOutDate: hotel.checkInDate }, today), null);
  assert.equal(validateHotelSearch({ ...hotel, checkInDate: "2026-02-30" }, today), null);
  assert.equal(validateHotelSearch({ ...hotel, cityCode: "Istanbul" }, today), null);
  assert.equal(validateHotelSearch({ ...hotel, adults: 0 }, today), null);
  assert.equal(validateHotelSearch({ ...hotel, adults: 7 }, today), null);
  assert.equal(validateHotelSearch({ ...hotel, adults: 9 }, today), null);
  assert.equal(validateHotelSearch({ ...hotel, adults: "2" }, today), null);
  assert.equal(validateHotelSearch({ ...hotel, adults: true }, today), null);
  assert.equal(validateHotelSearch({ ...hotel, roomQuantity: 0 }, today), null);
  assert.equal(validateHotelSearch({ ...hotel, roomQuantity: 5 }, today), null);
  assert.equal(validateHotelSearch({ ...hotel, roomQuantity: "2" }, today), null);
  assert.equal(validateHotelSearch({ ...hotel, roomQuantity: true }, today), null);
  assert.equal(validateHotelSearch({ ...hotel, roomQuantity: 2.5 }, today), null);
  assert.equal(validateHotelSearch({ ...hotel, roomQuantity: 3 }, today).roomQuantity, 3);
  assert.equal(validateHotelSearch({ ...hotel, currencyCode: "EURO" }, today), null);
});
