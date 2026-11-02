/**
 * An offer is called a deal only when it can be compared with a verified,
 * sufficiently sampled baseline for the same itinerary and conditions.
 * Without that evidence, it remains a live price, not a claimed discount.
 */
export function assessOpportunity(offer, baseline) {
  const currentPrice = Number(offer?.price);
  const referencePrice = Number(baseline?.medianPrice);
  const comparable = Boolean(
    baseline?.verified === true &&
    baseline?.comparisonKey &&
    baseline.comparisonKey === offer?.comparisonKey &&
    baseline?.currency === offer?.currency &&
    Number(baseline?.sampleCount) >= 5 &&
    Number.isFinite(referencePrice) &&
    referencePrice > 0 &&
    Number.isFinite(currentPrice) &&
    currentPrice > 0
  );
  if (!comparable) {
    return {
      status: "unverified",
      label: "Baisse non confirmée",
      discountPercent: null,
      referencePrice: null
    };
  }
  const discountPercent = Math.round(((referencePrice - currentPrice) / referencePrice) * 100);
  if (discountPercent <= 0) {
    return { status: "standard", label: "Prix courant", discountPercent: 0, referencePrice };
  }
  if (discountPercent >= 30) {
    return { status: "exceptional", label: "Prix exceptionnel", discountPercent, referencePrice };
  }
  if (discountPercent >= 15) {
    return { status: "good", label: "Bonne baisse", discountPercent, referencePrice };
  }
  return { status: "standard", label: "Prix en baisse", discountPercent, referencePrice };
}
