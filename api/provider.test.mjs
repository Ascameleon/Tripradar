import test from "node:test";
import assert from "node:assert/strict";
import { searchFlights, searchHotels } from "./provider.mjs";

test("rejects live searches when provider credentials are missing", async () => {
  const oldId = process.env.AMADEUS_CLIENT_ID;
  const oldSecret = process.env.AMADEUS_CLIENT_SECRET;
  delete process.env.AMADEUS_CLIENT_ID;
  delete process.env.AMADEUS_CLIENT_SECRET;
  try {
    await assert.rejects(searchFlights({
      origin: "ALG", destination: "CDG", departureDate: "2026-11-10", adults: 1, currencyCode: "EUR"
    }, async () => { throw new Error("fetch must not be called"); }), /credentials are not configured/);
  } finally {
    if (oldId === undefined) delete process.env.AMADEUS_CLIENT_ID;
    else process.env.AMADEUS_CLIENT_ID = oldId;
    if (oldSecret === undefined) delete process.env.AMADEUS_CLIENT_SECRET;
    else process.env.AMADEUS_CLIENT_SECRET = oldSecret;
  }
});

test("normalizes and price-sorts flight offers from the provider", async () => {
  const oldId = process.env.AMADEUS_CLIENT_ID;
  const oldSecret = process.env.AMADEUS_CLIENT_SECRET;
  process.env.AMADEUS_CLIENT_ID = "test-client";
  process.env.AMADEUS_CLIENT_SECRET = "test-secret";
  const calls = [];
  const fakeFetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes("/v1/security/oauth2/token")) {
      return { ok: true, json: async () => ({ access_token: "test-token", expires_in: 3600 }) };
    }
    return {
      ok: true,
      json: async () => ({
        data: [
          { id: "expensive", price: { grandTotal: "210.00", currency: "EUR" }, validatingAirlineCodes: ["ZZ"], itineraries: [{ segments: [{ departure: { iataCode: "ALG", at: "2026-11-10T08:00:00" }, arrival: { iataCode: "CDG", at: "2026-11-10T11:00:00" } }] }] },
          { id: "cheap", price: { grandTotal: "99.50", currency: "EUR" }, validatingAirlineCodes: ["YY"], itineraries: [{ segments: [{ departure: { iataCode: "ALG", at: "2026-11-10T09:00:00" }, arrival: { iataCode: "CDG", at: "2026-11-10T12:00:00" } }] }] }
        ]
      })
    };
  };
  try {
    const offers = await searchFlights({
      origin: "ALG", destination: "CDG", departureDate: "2026-11-10", adults: 1, currencyCode: "EUR"
    }, fakeFetch);
    assert.equal(offers.length, 2);
    assert.equal(offers[0].id, "cheap");
    assert.equal(offers[0].price, 99.5);
    assert.equal(offers[0].origin, "ALG");
    assert.equal(offers[0].destination, "CDG");
    assert.deepEqual(offers[0].validatingAirlineCodes, ["YY"]);
    assert.equal(offers[0].stops[0], 0);
    assert.equal(calls.length, 2);
    assert.match(calls[1].url, /originLocationCode=ALG/);
    assert.equal(calls[1].options.headers.authorization, "Bearer test-token");
  } finally {
    if (oldId === undefined) delete process.env.AMADEUS_CLIENT_ID;
    else process.env.AMADEUS_CLIENT_ID = oldId;
    if (oldSecret === undefined) delete process.env.AMADEUS_CLIENT_SECRET;
    else process.env.AMADEUS_CLIENT_SECRET = oldSecret;
  }
});


test("searches hotel inventory and sorts verified offers by total price", async () => {
  const oldId = process.env.AMADEUS_CLIENT_ID;
  const oldSecret = process.env.AMADEUS_CLIENT_SECRET;
  process.env.AMADEUS_CLIENT_ID = "test-client";
  process.env.AMADEUS_CLIENT_SECRET = "test-secret";
  const calls = [];
  const fakeFetch = async (url) => {
    const value = String(url);
    calls.push(value);
    if (value.includes("/v1/security/oauth2/token")) {
      return { ok: true, json: async () => ({ access_token: "hotel-test-token", expires_in: 3600 }) };
    }
    if (value.includes("/v1/reference-data/locations/hotels/by-city")) {
      return { ok: true, json: async () => ({ data: [{ hotelId: "H1" }, { hotelId: "H2" }] }) };
    }
    if (value.includes("/v3/shopping/hotel-offers")) {
      return {
        ok: true,
        json: async () => ({
          data: [
            { hotel: { hotelId: "H1", name: "Hotel Alpha", rating: "4" }, offers: [{ id: "O1", price: { total: "300.00", currency: "EUR" }, room: { typeEstimated: { category: "DOUBLE" } } }] },
            { hotel: { hotelId: "H2", name: "Hotel Beta" }, offers: [{ id: "O2", price: { total: "180.00", currency: "EUR" }, room: { typeEstimated: { category: "SINGLE" } } }] }
          ]
        })
      };
    }
    throw new Error("Unexpected provider URL: " + value);
  };
  try {
    const offers = await searchHotels({
      cityCode: "IST", checkInDate: "2026-11-10", checkOutDate: "2026-11-14", adults: 2, currencyCode: "EUR"
    }, fakeFetch);
    assert.equal(offers.length, 2);
    assert.equal(offers[0].name, "Hotel Beta");
    assert.equal(offers[0].price, 180);
    assert.equal(offers[0].checkInDate, "2026-11-10");
    assert.equal(offers[0].checkOutDate, "2026-11-14");
    assert.ok(calls.some((url) => url.includes("cityCode=IST")));
    assert.ok(calls.some((url) => url.includes("hotelIds=H1%2CH2")));
  } finally {
    if (oldId === undefined) delete process.env.AMADEUS_CLIENT_ID;
    else process.env.AMADEUS_CLIENT_ID = oldId;
    if (oldSecret === undefined) delete process.env.AMADEUS_CLIENT_SECRET;
    else process.env.AMADEUS_CLIENT_SECRET = oldSecret;
  }
});
