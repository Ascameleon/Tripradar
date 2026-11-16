export function validateSearch(input, now = new Date()) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  if (
    typeof input.origin !== "string" ||
    typeof input.destination !== "string" ||
    typeof input.departureDate !== "string" ||
    (input.returnDate != null && typeof input.returnDate !== "string") ||
    (input.currencyCode != null && typeof input.currencyCode !== "string")
  ) return null;

  const origin = input.origin.trim().toUpperCase();
  const destination = input.destination.trim().toUpperCase();
  const departureDate = input.departureDate;
  const returnDate = input.returnDate ?? "";
  const adults = input.adults ?? 1;
  const currencyCode = (input.currencyCode ?? "EUR").toUpperCase();
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  const parseDate = (value) => {
    if (!isoDate.test(value)) return null;
    const parsed = new Date(value + "T00:00:00Z");
    return Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value ? null : parsed;
  };
  const departure = parseDate(departureDate);
  const returnParsed = returnDate ? parseDate(returnDate) : null;
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination) || origin === destination ||
      !departure || departure < today || (returnDate && (!returnParsed || returnParsed <= departure)) ||
      typeof adults !== "number" || !Number.isSafeInteger(adults) || adults < 1 || adults > 6 || !/^[A-Z]{3}$/.test(currencyCode)) return null;
  const result = { origin, destination, departureDate, adults, currencyCode };
  if (returnDate) result.returnDate = returnDate;
  return result;
}

export function validateHotelSearch(input, now = new Date()) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  if (
    typeof input.cityCode !== "string" ||
    typeof input.checkInDate !== "string" ||
    typeof input.checkOutDate !== "string" ||
    (input.currencyCode != null && typeof input.currencyCode !== "string")
  ) return null;

  const cityCode = input.cityCode.trim().toUpperCase();
  const checkInDate = input.checkInDate;
  const checkOutDate = input.checkOutDate;
  const adults = input.adults ?? 1;
  const roomQuantity = input.roomQuantity ?? 1;
  const currencyCode = (input.currencyCode ?? "EUR").toUpperCase();
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  const parseDate = (value) => {
    if (!isoDate.test(value)) return null;
    const parsed = new Date(value + "T00:00:00Z");
    return Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value ? null : parsed;
  };
  const checkIn = parseDate(checkInDate);
  const checkOut = parseDate(checkOutDate);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (!/^[A-Z]{3}$/.test(cityCode) || !checkIn || !checkOut || checkIn < today || checkOut <= checkIn ||
      typeof adults !== "number" || !Number.isSafeInteger(adults) || adults < 1 || adults > 6 ||
      typeof roomQuantity !== "number" || !Number.isSafeInteger(roomQuantity) || roomQuantity < 1 ||
      roomQuantity > 4 || !/^[A-Z]{3}$/.test(currencyCode)) return null;
  return { cityCode, checkInDate, checkOutDate, adults, roomQuantity, currencyCode };
}
