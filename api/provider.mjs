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
  if (input.returnDate) params.set("returnDate", input.returnDate);
  const response = await fetchImpl(`${BASE}/v2/shopping/flight-offers?${params}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
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
  }).filter((offer) => Number.isFinite(offer.price) && offer.price >= 0).sort((a, b) => a.price - b.price);
}

export async function searchHotels(input, fetchImpl = fetch) {
  const token = await getToken(fetchImpl);
  const headers = { authorization: `Bearer ${token}` };
  const hotelParams = new URLSearchParams({ cityCode: input.cityCode, radius: "10", radiusUnit: "KM", hotelSource: "ALL" });
  const hotelResponse = await fetchImpl(`${BASE}/v1/reference-data/locations/hotels/by-city?${hotelParams}`, {
    headers, signal: AbortSignal.timeout(8000)
  });
  if (!hotelResponse.ok) {
    const error = new Error("Hotel lookup failed");
    error.status = hotelResponse.status;
    throw error;
  }
  const hotelData = await hotelResponse.json();
  const hotelIds = (hotelData.data || []).map((hotel) => hotel.hotelId).filter(Boolean).slice(0, 10);
  if (!hotelIds.length) return [];
  const offerParams = new URLSearchParams({
    hotelIds: hotelIds.join(","),
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    adults: String(input.adults || 1),
    roomQuantity: "1",
    currency: input.currencyCode || "EUR"
  });
  const offersResponse = await fetchImpl(`${BASE}/v3/shopping/hotel-offers?${offerParams}`, {
    headers, signal: AbortSignal.timeout(10000)
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
