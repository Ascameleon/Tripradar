const BASE = process.env.AMADEUS_BASE_URL || "https://test.api.amadeus.com";
let tokenCache = { value: null, expiresAt: 0 };

async function getToken(fetchImpl = fetch) {
  const id = process.env.AMADEUS_CLIENT_ID;
  const secret = process.env.AMADEUS_CLIENT_SECRET;
  if (!id || !secret) { const error = new Error("Amadeus credentials are not configured"); error.status = 503; throw error; }
  if (tokenCache.value && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.value;
  const response = await fetchImpl(`${BASE}/v1/security/oauth2/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret }), signal: AbortSignal.timeout(8000) });
  if (!response.ok) { const error = new Error("Provider authentication failed"); error.status = response.status; throw error; }
  const data = await response.json();
  tokenCache = { value: data.access_token, expiresAt: Date.now() + Math.max(0, Number(data.expires_in || 0) - 60) * 1000 };
  return tokenCache.value;
}

export async function searchFlights(input, fetchImpl = fetch) {
  const token = await getToken(fetchImpl);
  const params = new URLSearchParams({ originLocationCode: input.origin, destinationLocationCode: input.destination, departureDate: input.departureDate, adults: String(input.adults), currencyCode: input.currencyCode, max: "20" });
  const response = await fetchImpl(`${BASE}/v2/shopping/flight-offers?${params}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) { const error = new Error("Flight search failed"); error.status = response.status; throw error; }
  const payload = await response.json();
  return (payload.data || []).map((offer) => {
    const itineraries = offer.itineraries || [];
    const segments = itineraries.flatMap((itinerary) => itinerary.segments || []);
    const first = segments[0]; const last = segments[segments.length - 1];
    return { id: String(offer.id || ""), price: Number(offer.price?.grandTotal), currency: offer.price?.currency || input.currencyCode, origin: first?.departure?.iataCode || input.origin, destination: last?.arrival?.iataCode || input.destination, departureAt: first?.departure?.at || null, arrivalAt: last?.arrival?.at || null, stops: itineraries.map((itinerary) => Math.max(0, (itinerary.segments || []).length - 1)), validatingAirlineCodes: offer.validatingAirlineCodes || [], checkedAt: new Date().toISOString(), provider: "Amadeus" };
  }).filter((offer) => Number.isFinite(offer.price) && offer.price >= 0).sort((a, b) => a.price - b.price);
}