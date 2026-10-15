import http from "node:http";
import { searchFlights } from "./provider.mjs";

const port = Number(process.env.PORT || 3000);
const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
const json = (res, status, body) => { res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": allowedOrigin, "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type" }); res.end(JSON.stringify(body)); };

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, { "access-control-allow-origin": allowedOrigin, "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type" }); return res.end(); }
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (url.pathname === "/api/health" && req.method === "GET") return json(res, 200, { ok: true, providerConfigured: Boolean(process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET) });
  if (url.pathname !== "/api/flights/search" || req.method !== "POST") return json(res, 404, { error: "not_found" });
  let body = "";
  for await (const chunk of req) { body += chunk; if (body.length > 20_000) return json(res, 413, { error: "request_too_large" }); }
  let input;
  try { input = JSON.parse(body || "{}"); } catch { return json(res, 400, { error: "invalid_json" }); }
  const origin = String(input.origin || "").trim().toUpperCase();
  const destination = String(input.destination || "").trim().toUpperCase();
  const departureDate = String(input.departureDate || "");
  const adults = Number(input.adults || 1);
  const currencyCode = String(input.currencyCode || "EUR").toUpperCase();
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination) || origin === destination || !isoDate.test(departureDate) || !Number.isInteger(adults) || adults < 1 || adults > 9 || !/^[A-Z]{3}$/.test(currencyCode)) return json(res, 400, { error: "invalid_search_parameters" });
  try { const offers = await searchFlights({ origin, destination, departureDate, adults, currencyCode }); return json(res, 200, { source: "Amadeus", checkedAt: new Date().toISOString(), offers }); }
  catch (error) { const status = error?.status === 429 ? 503 : 502; return json(res, status, { error: status === 503 ? "provider_rate_limited" : "provider_unavailable", message: "Aucune offre vérifiée disponible pour le moment." }); }
});

server.listen(port, "0.0.0.0", () => console.log(`TripRadar API listening on ${port}`));