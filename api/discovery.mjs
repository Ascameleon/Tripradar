import { assessOpportunity } from "./opportunity.mjs";

function mergeOffers(items) {
  const byKey = new Map();
  for (const item of items) {
    const key = [
      item.provider || item.source || "unknown",
      item.origin || "",
      item.destination || "",
      item.departureAt || "",
      item.price ?? "",
      item.currency || "",
      (item.validatingAirlineCodes || []).join(",")
    ].join("|");
    if (!byKey.has(key)) byKey.set(key, item);
  }
  return [...byKey.values()].sort((a, b) => {
    if (a.currency !== b.currency) return String(a.currency).localeCompare(String(b.currency));
    return Number(a.price) - Number(b.price);
  });
}

/**
 * Fan out one search per destination and provider. Provider adapters must only
 * use authorised APIs/feeds and return normalised offers; this module never
 * scrapes websites or fabricates prices.
 */
export async function searchDiscovery(search, providers = []) {
  const tasks = providers.flatMap((provider) => search.destinations.map(async (destination) => {
    const offers = await provider.search({ ...search, destination });
    return (Array.isArray(offers) ? offers : []).map((offer) => ({
      ...offer,
      provider: provider.name || provider.id,
      sourceId: provider.id,
      opportunity: assessOpportunity(offer, offer.baseline)
    }));
  }));
  const settled = await Promise.allSettled(tasks);
  const offers = [];
  const sourceStats = new Map(providers.map((provider) => [provider.id, {
    id: provider.id,
    name: provider.name || provider.id,
    status: "unavailable",
    destinationsChecked: 0,
    resultCount: 0
  }]));
  settled.forEach((result, index) => {
    const provider = providers[Math.floor(index / search.destinations.length)];
    const stats = sourceStats.get(provider.id);
    if (result.status === "fulfilled") {
      stats.destinationsChecked += 1;
      stats.resultCount += result.value.length;
      offers.push(...result.value);
      if (result.value.length) stats.status = "available";
      else if (stats.status !== "available") stats.status = "no_results";
    }
  });
  return {
    searchedDestinations: search.destinations,
    offers: mergeOffers(offers),
    sources: [...sourceStats.values()],
    checkedAt: new Date().toISOString()
  };
}
