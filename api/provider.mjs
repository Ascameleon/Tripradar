import { createHash } from "node:crypto";

const BASE = process.env.AMADEUS_BASE_URL || "https://test.api.amadeus.com";
let tokenCache = { key: null, value: null, expiresAt: 0 };
const tokenRequests = new Map();

function requestSignal(signal, timeoutMs) {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw signal.reason ?? new Error("Provider request aborted");
}

async function getToken(fetchImpl = fetch, { signal } = {}) {
  throwIfAborted(signal);
  const id = process.env.AMADEUS_CLIENT_ID;
  const secret = process.env.AMADEUS_CLIENT_SECRET;
  if (!id || !secret) {
    tokenCache = { key: null, value: null, expiresAt: 0 };
    const error = new Error("Amadeus credentials are not configured");
    error.status = 503;
    throw error;
  }
  const cacheKey = createHash("sha256")
    .update(BASE)
    .update("\0")
    .update(id)
    .update("\0")
    .update(secret)
    .digest("hex");
  const now = Date.now();
  if (tokenCache.key === cacheKey && tokenCache.value && tokenCache.expiresAt > now + 30_000) {
    return tokenCache.value;
  }

  // A rotated or expired bearer token must not remain in process memory while re-authenticating.
  tokenCache = { key: null, value: null, expiresAt: 0 };

  let request = tokenRequests.get(cacheKey);
  if (!request) {
    const controller = new AbortController();
    request = {
      controller,
      waiters: 0,
      settled: false,
      promise: null
    };
    const authSignal = AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]);
    const pending = (async () => {
      const response = await fetchImpl(`${BASE}/v1/security/oauth2/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: id,
          client_secret: secret
        }),
        signal: authSignal
      });
      if (!response.ok) {
        const error = new Error("Provider authentication failed");
        error.status = response.status;
        throw error;
      }
      const data = await response.json();
      const accessToken = typeof data.access_token === "string" ? data.access_token.trim() : "";
      if (!accessToken) {
        const error = new Error("Provider authentication returned no access token");
        error.status = 502;
        throw error;
      }
      const expiresIn = Number(data.expires_in);
      const ttlSeconds = Number.isFinite(expiresIn) ? Math.max(0, expiresIn - 60) : 0;
      // An in-flight request may finish after runtime credentials have rotated again.
      // Do not cache a token after every caller has abandoned the shared request.
      if (
        !controller.signal.aborted &&
        process.env.AMADEUS_CLIENT_ID === id &&
        process.env.AMADEUS_CLIENT_SECRET === secret
      ) {
        tokenCache = {
          key: cacheKey,
          value: accessToken,
          expiresAt: Date.now() + ttlSeconds * 1000
        };
      }
      return accessToken;
    })();
    request.promise = pending;
    tokenRequests.set(cacheKey, request);
    pending.then(
      () => {
        request.settled = true;
        if (tokenRequests.get(cacheKey) === request) tokenRequests.delete(cacheKey);
      },
      () => {
        request.settled = true;
        if (tokenRequests.get(cacheKey) === request) tokenRequests.delete(cacheKey);
      }
    );
  }

  request.waiters += 1;
  let abortHandler;
  try {
    if (!signal) return await request.promise;
    const aborted = new Promise((_, reject) => {
      abortHandler = () => reject(signal.reason ?? new Error("Provider request aborted"));
      signal.addEventListener("abort", abortHandler, { once: true });
    });
    throwIfAborted(signal);
    return await Promise.race([request.promise, aborted]);
  } finally {
    if (abortHandler) signal.removeEventListener("abort", abortHandler);
    request.waiters -= 1;
    if (request.waiters === 0 && !request.settled) {
      if (tokenRequests.get(cacheKey) === request) tokenRequests.delete(cacheKey);
      request.controller.abort(new Error("Provider authentication has no active callers"));
    }
  }
}
export async function searchFlights(input, fetchImpl = fetch, { signal } = {}) {
  const token = await getToken(fetchImpl, { signal });
  throwIfAborted(signal);
  const params = new URLSearchParams({ originLocationCode: input.origin, destinationLocationCode: input.destination, departureDate: input.departureDate, adults: String(input.adults), currencyCode: input.currencyCode, max: "20" });
  if (input.returnDate) params.set("returnDate", input.returnDate);
  const response = await fetchImpl(`${BASE}/v2/shopping/flight-offers?${params}`, { headers: { authorization: `Bearer ${token}` }, signal: requestSignal(signal, 10000) });
  if (!response.ok) { const error = new Error("Flight search failed"); error.status = response.status; throw error; }
  const payload = await response.json();
  return (payload.data || []).map((offer) => {
    const itineraries = offer.itineraries || [];
    const outboundSegments = itineraries[0]?.segments || [];
    const returnSegments = itineraries[1]?.segments || [];
    const first = outboundSegments[0];
    const last = outboundSegments[outboundSegments.length - 1];
    const returnFirst = returnSegments[0];
    const returnLast = returnSegments[returnSegments.length - 1];
    return {
      id: String(offer.id || ""),
      price: Number(offer.price?.grandTotal),
      currency: offer.price?.currency || input.currencyCode,
      origin: first?.departure?.iataCode || input.origin,
      destination: last?.arrival?.iataCode || input.destination,
      departureAt: first?.departure?.at || null,
      arrivalAt: last?.arrival?.at || null,
      returnDepartureAt: returnFirst?.departure?.at || null,
      returnArrivalAt: returnLast?.arrival?.at || null,
      stops: itineraries.map((itinerary) => Math.max(0, (itinerary.segments || []).length - 1)),
      validatingAirlineCodes: offer.validatingAirlineCodes || [],
      checkedAt: new Date().toISOString(),
      provider: "Amadeus",
      tripType: input.returnDate ? "round-trip" : "one-way"
    };
  }).filter((offer) => Number.isFinite(offer.price) && offer.price > 0).sort((a, b) => a.price - b.price);
}

export async function searchHotels(input, fetchImpl = fetch, { signal } = {}) {
  const token = await getToken(fetchImpl, { signal });
  throwIfAborted(signal);
  const headers = { authorization: `Bearer ${token}` };
  const hotelParams = new URLSearchParams({ cityCode: input.cityCode, radius: "10", radiusUnit: "KM", hotelSource: "ALL" });
  const hotelResponse = await fetchImpl(`${BASE}/v1/reference-data/locations/hotels/by-city?${hotelParams}`, {
    headers, signal: requestSignal(signal, 8000)
  });
  if (!hotelResponse.ok) {
    const error = new Error("Hotel lookup failed");
    error.status = hotelResponse.status;
    throw error;
  }
  const hotelData = await hotelResponse.json();
  const hotelIds = (hotelData.data || []).map((hotel) => hotel.hotelId).filter(Boolean).slice(0, 10);
  if (!hotelIds.length) return [];
  throwIfAborted(signal);
  const offerParams = new URLSearchParams({
    hotelIds: hotelIds.join(","),
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    adults: String(input.adults || 1),
    roomQuantity: String(input.roomQuantity || 1),
    currency: input.currencyCode || "EUR"
  });
  const offersResponse = await fetchImpl(`${BASE}/v3/shopping/hotel-offers?${offerParams}`, {
    headers, signal: requestSignal(signal, 10000)
  });
  if (!offersResponse.ok) {
    const error = new Error("Hotel offer search failed");
    error.status = offersResponse.status;
    throw error;
  }
  const payload = await offersResponse.json();
  return (payload.data || []).flatMap((entry) => (entry.offers || []).map((offer) => ({
    id: String(offer.id || ""),
    hotelId: String(entry.hotel?.hotelId || ""),
    name: String(entry.hotel?.name || "Hébergement"),
    rating: entry.hotel?.rating ? String(entry.hotel.rating) : null,
    checkInDate: offer.checkInDate || input.checkInDate,
    checkOutDate: offer.checkOutDate || input.checkOutDate,
    price: Number(offer.price?.total),
    currency: offer.price?.currency || input.currencyCode || "EUR",
    room: String(offer.room?.typeEstimated?.category || offer.room?.description?.text || "Chambre selon disponibilité"),
    boardType: String(offer.boardType || "NON RENSEIGNÉ"),
    checkedAt: new Date().toISOString(),
    provider: "Amadeus"
  })).filter((offer) => Number.isFinite(offer.price) && offer.price > 0))
    .sort((a, b) => a.price - b.price)
    .slice(0, 10);
}
