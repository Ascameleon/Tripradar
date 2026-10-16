export function validateSearch(input, now = new Date()) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const origin = String(input.origin || "").trim().toUpperCase();
  const destination = String(input.destination || "").trim().toUpperCase();
  const departureDate = String(input.departureDate || "");
  const returnDate = String(input.returnDate || "");
  const adults = Number(input.adults ?? 1);
  const currencyCode = String(input.currencyCode || "EUR").toUpperCase();
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  const parseDate = (value) => {
    if (!isoDate.test(value)) return null;
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value ? null : parsed;
  };
  const departure = parseDate(departureDate);
  const returnParsed = returnDate ? parseDate(returnDate) : null;
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination) || origin === destination ||
      !departure || departure < today || (returnDate && (!returnParsed || returnParsed <= departure)) ||
      !Number.isInteger(adults) || adults < 1 || adults > 9 || !/^[A-Z]{3}$/.test(currencyCode)) return null;
  const result = { origin, destination, departureDate, adults, currencyCode };
  if (returnDate) result.returnDate = returnDate;
  return result;
}
export function validateHotelSearch(input, now = new Date()) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const cityCode = String(input.cityCode || "").trim().toUpperCase();
  const checkInDate = String(input.checkInDate || "");
  const checkOutDate = String(input.checkOutDate || "");
  const adults = Number(input.adults ?? 1);
  const currencyCode = String(input.currencyCode || "EUR").toUpperCase();
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  const parseDate = (value) => {
    if (!isoDate.test(value)) return null;
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value ? null : parsed;
  };
  const checkIn = parseDate(checkInDate);
  const checkOut = parseDate(checkOutDate);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (!/^[A-Z]{3}$/.test(cityCode) || !checkIn || !checkOut || checkIn < today || checkOut <= checkIn ||
      !Number.isInteger(adults) || adults < 1 || adults > 9 || !/^[A-Z]{3}$/.test(currencyCode)) return null;
  return { cityCode, checkInDate, checkOutDate, adults, currencyCode };
}
