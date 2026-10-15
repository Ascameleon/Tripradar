import http from "node:http";
import { searchFlights } from "./provider.mjs";
import { validateSearch } from "./validation.mjs";

const port = Number(process.env.PORT || 3000);
const allowedOrigin = process.env.ALLOWED_ORIGIN || "http://localhost:3000";
const requestBuckets = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const bucket = requestBuckets.get(ip);
  if (!bucket || now - bucket.start >= 60_000) { requestBuckets.set(ip, { start: now, count: 1 }); return false; }
  bucket.count += 1;
  return bucket.count > 30;
}
const json = (res, status, body) => { res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": allowedOrigin, "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type" }); res.end(JSON.stringify(body)); };

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, { "access-control-allow-origin": allowedOrigin, "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type" }); return res.end(); }
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (url.pathname === "/api/health" && req.method === "GET") return json(res, 200, { ok: true, providerConfigured: Boolean(process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET) });
  if (url.pathname !== "/api/flights/search" || req.method !== "POST") return json(res, 404, { error: "not_found" });
  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim();
  if (rateLimited(ip)) return json(res, 429, { error: "rate_limited", message: "Trop de recherches. Réessayez dans une minute." });
  let body = "";
  for await (const chunk of req) { body += chunk; if (body.length > 20_000) return json(res, 413, { error: "request_too_large" }); }
  let input;
  try { input = JSON.parse(body || "{}"); } catch { return json(res, 400, { error: "invalid_json" }); }
  const search = validateSearch(input);
  if (!search) return json(res, 400, { error: "invalid_search_parameters" });
  try { const offers = await searchFlights(search); return json(res, 200, { source: "Amadeus", checkedAt: new Date().toISOString(), offers }); }
  catch (error) { const status = error?.status === 429 ? 503 : 502; return json(res, status, { error: status === 503 ? "provider_rate_limited" : "provider_unavailable", message: "Aucune offre vérifiée disponible pour le moment." }); }
});

server.listen(port, "0.0.0.0", () => console.log(`TripRadar API listening on ${port}`));