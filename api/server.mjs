import http from "node:http";
import { searchFlights } from "./provider.mjs";
import { validateSearch } from "./validation.mjs";

const port = Number(process.env.PORT || 3000);
const allowedOrigin = process.env.ALLOWED_ORIGIN || "http://localhost:3000";
const maxBodyBytes = 20_000;
const requestBuckets = new Map();

function rateLimited(ip) {
  const now = Date.now();
  if (requestBuckets.size > 2_000) {
    for (const [key, entry] of requestBuckets) {
      if (now - entry.start >= 60_000) requestBuckets.delete(key);
    }
  }
  const bucket = requestBuckets.get(ip);
  if (!bucket && requestBuckets.size >= 5_000) return true;
  if (!bucket || now - bucket.start >= 60_000) {
    requestBuckets.set(ip, { start: now, count: 1 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > 30;
}

function json(res, status, body, origin = "") {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "vary": "Origin",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  };
  if (!origin || origin === allowedOrigin) headers["access-control-allow-origin"] = allowedOrigin;
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const origin = String(req.headers.origin || "");
  if (origin && origin !== allowedOrigin) return json(res, 403, { error: "origin_not_allowed" }, origin);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": allowedOrigin,
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
      "vary": "Origin"
    });
    return res.end();
  }

  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (url.pathname === "/api/health" && req.method === "GET") {
    return json(res, 200, {
      ok: true,
      providerConfigured: Boolean(process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET)
    }, origin);
  }
  if (url.pathname !== "/api/flights/search" || req.method !== "POST") {
    return json(res, 404, { error: "not_found" }, origin);
  }

  const ip = String(req.socket.remoteAddress || "unknown");
  if (rateLimited(ip)) {
    return json(res, 429, { error: "rate_limited", message: "Trop de recherches. Réessayez dans une minute." }, origin);
  }

  const contentType = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") return json(res, 415, { error: "content_type_must_be_json" }, origin);
  const declaredLength = Number(req.headers["content-length"] || 0);
  if (declaredLength > maxBodyBytes) return json(res, 413, { error: "request_too_large" }, origin);

  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body, "utf8") > maxBodyBytes) {
      res.writeHead(413, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify({ error: "request_too_large" }));
      return;
    }
  }

  let input;
  try {
    input = JSON.parse(body || "{}");
  } catch {
    return json(res, 400, { error: "invalid_json" }, origin);
  }

  const search = validateSearch(input);
  if (!search) return json(res, 400, { error: "invalid_search_parameters" }, origin);

  try {
    const offers = await searchFlights(search);
    return json(res, 200, { source: "Amadeus", checkedAt: new Date().toISOString(), offers }, origin);
  } catch (error) {
    const status = error?.status === 429 || error?.status === 503 ? 503 : 502;
    return json(res, status, {
      error: "provider_unavailable",
      message: "Aucune offre vérifiée disponible pour le moment."
    }, origin);
  }
});

server.listen(port, "0.0.0.0", () => console.log(`TripRadar API listening on ${port}`));
