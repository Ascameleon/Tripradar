/**
 * Bounded multi-destination flight discovery.
 * The caller supplies the provider adapter so tests never need live credentials.
 */
export async function searchDiscovery(input, searchFlightsImpl, { maxConcurrency = 2 } = {}) {
  if (typeof searchFlightsImpl !== "function") throw new TypeError("A flight search adapter is required");
  if (!Number.isSafeInteger(maxConcurrency) || maxConcurrency < 1 || maxConcurrency > 2) {
    throw new RangeError("Discovery concurrency must be between 1 and 2");
  }
  if (!Array.isArray(input?.destinations) || input.destinations.length < 1 || input.destinations.length > 9) {
    throw new TypeError("Discovery requires between 1 and 9 validated destinations");
  }

  const results = new Array(input.destinations.length);
  let nextIndex = 0;
  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= input.destinations.length) return;
      const destination = input.destinations[index];
      try {
        const offers = await searchFlightsImpl({
          origin: input.origin,
          destination,
          departureDate: input.departureDate,
          ...(input.returnDate ? { returnDate: input.returnDate } : {}),
          adults: input.adults,
          currencyCode: input.currencyCode
        });
        if (!Array.isArray(offers)) throw new TypeError("Provider returned a non-array offer result");
        results[index] = { destination, offers, failed: false };
      } catch {
        results[index] = { destination, offers: [], failed: true };
      }
    }
  }

  const workerCount = Math.min(maxConcurrency, input.destinations.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const successful = results.filter((result) => !result.failed);
  const failed = results.filter((result) => result.failed);
  const offers = successful.flatMap((result) =>
    result.offers
      .filter((offer) => offer && typeof offer === "object" && Number.isFinite(Number(offer.price)) && Number(offer.price) > 0)
      .map((offer) => ({
        ...offer,
        destination: offer.destination || result.destination
      }))
  ).sort((a, b) => Number(a.price) - Number(b.price));

  return {
    offers,
    searchedDestinations: successful.map((result) => result.destination),
    failedDestinations: failed.map((result) => result.destination),
    sources: [{
      name: "Amadeus",
      resultCount: offers.length,
      successfulDestinations: successful.length,
      failedDestinations: failed.length
    }]
  };
}
