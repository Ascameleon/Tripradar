export function validateSearch(input, now = new Date()) {
  const origin = String(input.origin || "").trim().toUpperCase();
  const destination = String(input.destination || "").trim().toUpperCase();
  const departureDate = String(input.departureDate || "");
  const adults = Number(input.adults || 1);
  const currencyCode = String(input.currencyCode || "EUR").toUpperCase();
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  const parsedDate = new Date(`${departureDate}T00:00:00Z`);
  const validDate = isoDate.test(departureDate) && !Number.isNaN(parsedDate.valueOf()) && parsedDate.toISOString().slice(0, 10) === departureDate;
  if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination) || origin === destination || !validDate || parsedDate < new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) || !Number.isInteger(adults) || adults < 1 || adults > 9 || !/^[A-Z]{3}$/.test(currencyCode)) return null;
  return { origin, destination, departureDate, adults, currencyCode };
}