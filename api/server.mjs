import http from "node:http";
import { searchFlights, searchHotels } from "./provider.mjs";
import { searchDiscovery } from "./discovery.mjs";
import { validateSearch, validateHotelSearch, validateDiscoverySearch } from "./validation.mjs";
import { createClientAbortSignal } from "./client-abort.mjs";

const port = Number(process.env.PORT || 3000);
const allowedOrigin = process.env.ALLOWED_ORIGIN || "http://localhost:3000";
const maxBodyBytes = 20_000;
const requestBuckets = new Map();

function rateLimited(ip, limit = 30) {
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
  return bucket.count > limit;
}

function json(res, status, body, origin = "") {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
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

  // Route parsing must not trust the untrusted Host header; only the request target is needed here.
  let url;
  try {
    url = new URL(req.url || "/", "http://localhost");
  } catch {
    return json(res, 400, { error: "invalid_request_target" }, origin);
  }
  if (url.pathname === "/api/health" && req.method === "GET") {
    return json(res, 200, {
      ok: true,
      providerConfigured: Boolean(process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET)
    }, origin);
  }
  const isFlightSearch = url.pathname === "/api/flights/search";
  const isHotelSearch = url.pathname === "/api/hotels/search";
  const isDiscoverySearch = url.pathname === "/api/discovery/search";
  if ((!isFlightSearch && !isHotelSearch && !isDiscoverySearch) || req.method !== "POST") {
    return json(res, 404, { error: "not_found" }, origin);
  }

  const contentType = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") return json(res, 415, { error: "content_type_must_be_json" }, origin);
  const declaredLength = Number(req.headers["content-length"] || 0);
  if (declaredLength > maxBodyBytes) return json(res, 413, { error: "request_too_large" }, origin);

  let body = "";
  try {
    for await (const chunk of req) {
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > maxBodyBytes) {
        json(res, 413, { error: "request_too_large" }, origin);
        return;
      }
    }
  } catch {
    // A client can disconnect before sending the declared body length. The
    // async iterator rejects with ECONNRESET; consume it here so the async
    // request handler does not create an unhandled rejection.
    if (req.aborted || res.destroyed) return;
    return json(res, 400, { error: "invalid_request_body" }, origin);
  }
  if (req.aborted || res.destroyed) return;

  let input;
  try {
    input = JSON.parse(body || "{}");
  } catch {
    return json(res, 400, { error: "invalid_json" }, origin);
  }

  const search = isFlightSearch
    ? validateSearch(input)
    : isHotelSearch
      ? validateHotelSearch(input)
      : validateDiscoverySearch(input);
  if (!search) return json(res, 400, { error: "invalid_search_parameters" }, origin);

  // Only well-formed searches consume the provider quota. Invalid content types,
  // malformed JSON and rejected parameters must not let one client exhaust the
  // valid-search allowance for everyone sharing its network address.
  const ip = String(req.socket.remoteAddress || "unknown");
  const rateKey = isDiscoverySearch ? ip + ":discovery" : ip + ":search";
  if (rateLimited(rateKey, isDiscoverySearch ? 1 : 30)) {
    return json(res, 429, { error: "rate_limited", message: "Trop de recherches. Réessayez dans une minute." }, origin);
  }

  const clientAbort = createClientAbortSignal(res);
  try {
    if (isDiscoverySearch) {
      // A map-wide search can fan out to nine supplier requests. Keep it disabled
      // unless an operator explicitly opts in after checking provider terms/costs.
      if (process.env.TRIPBOOST_DISCOVERY_ENABLED !== "true") {
        return json(res, 503, {
          error: "discovery_disabled",
          message: "La recherche mondiale est désactivée. Activez explicitement TRIPBOOST_DISCOVERY_ENABLED=true après validation des coûts fournisseur."
        }, origin);
      }
      if (!process.env.AMADEUS_CLIENT_ID || !process.env.AMADEUS_CLIENT_SECRET) {
        return json(res, 503, {
          error: "provider_unavailable",
          message: "Aucune source tarifaire vérifiée n'est configurée."
        }, origin);
      }
      const result = await searchDiscovery(
        search,
        (params, { signal } = {}) => searchFlights(params, fetch, { signal }),
        { maxConcurrency: 2, signal: clientAbort.signal }
      );
      if (!result.searchedDestinations.length) {
        return json(res, 503, {
          error: "provider_unavailable",
          message: "Aucune destination n'a pu être vérifiée auprès du fournisseur."
        }, origin);
      }
      return json(res, 200, { source: "Amadeus", checkedAt: new Date().toISOString(), ...result }, origin);
    }
    const offers = isFlightSearch
      ? await searchFlights(search, fetch, { signal: clientAbort.signal })
      : await searchHotels(search, fetch, { signal: clientAbort.signal });
    return json(res, 200, { source: "Amadeus", checkedAt: new Date().toISOString(), offers }, origin);
  } catch (error) {
    if (clientAbort.signal.aborted || res.destroyed) return;
    const status = error?.status === 429 || error?.status === 503 ? 503 : 502;
    return json(res, status, {
      error: "provider_unavailable",
      message: "Aucune offre vérifiée disponible pour le moment."
    }, origin);
  } finally {
    clientAbort.dispose();
  }
});

server.headersTimeout = 10_000;
server.requestTimeout = 15_000;
server.keepAliveTimeout = 5_000;

server.listen(port, "0.0.0.0", () => console.log(`TripRadar API listening on ${port}`));
