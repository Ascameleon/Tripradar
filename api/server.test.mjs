import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer, connect as connectNet } from "node:net";
import { createServer as createHttpServer, request as httpRequest } from "node:http";

async function getWithHost(port, path, origin, host) {
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: "127.0.0.1",
      port,
      path,
      method: "GET",
      headers: { origin, host }
    }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body }));
    });
    request.once("error", reject);
    request.end();
  });
}

async function freePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}

test("HTTP API health, CORS, validation, content type, and missing-provider behavior", async (t) => {
  const port = await freePort();
  const origin = "https://tripradar.example";
  const child = spawn(process.execPath, ["api/server.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      ALLOWED_ORIGIN: origin,
      AMADEUS_CLIENT_ID: "",
      AMADEUS_CLIENT_SECRET: ""
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  t.after(() => {
    if (child.exitCode === null) child.kill("SIGTERM");
  });

  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) throw new Error("API exited before ready: " + output);
    try {
      const response = await fetch(base + "/api/health", { signal: AbortSignal.timeout(300) });
      if (response.ok) { ready = true; break; }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(ready, true, "API must become ready");

  const health = await fetch(base + "/api/health", { headers: { origin } });
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("access-control-allow-origin"), origin);
  assert.equal(health.headers.get("x-content-type-options"), "nosniff");
  assert.equal(health.headers.get("x-frame-options"), "DENY");
  assert.equal(health.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.deepEqual(await health.json(), { ok: true, providerConfigured: false });

  const malformedHost = await getWithHost(port, "/api/health", origin, "localhost:99999");
  assert.equal(malformedHost.status, 200, "an untrusted Host header must not break request-target parsing");
  assert.deepEqual(JSON.parse(malformedHost.body), { ok: true, providerConfigured: false });

  const forbidden = await fetch(base + "/api/health", { headers: { origin: "https://attacker.example" } });
  assert.equal(forbidden.status, 403);
  assert.deepEqual(await forbidden.json(), { error: "origin_not_allowed" });

  const badType = await fetch(base + "/api/flights/search", {
    method: "POST", headers: { origin, "content-type": "text/plain" }, body: "{}"
  });
  assert.equal(badType.status, 415);

  const badPayload = await fetch(base + "/api/flights/search", {
    method: "POST", headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ origin: "Alger", destination: "CDG", departureDate: "2027-11-10" })
  });
  assert.equal(badPayload.status, 400);
  assert.deepEqual(await badPayload.json(), { error: "invalid_search_parameters" });

  const noCredentials = await fetch(base + "/api/flights/search", {
    method: "POST", headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ origin: "ALG", destination: "CDG", departureDate: "2027-11-10", adults: 1, currencyCode: "EUR" })
  });
  assert.equal(noCredentials.status, 503);
  assert.deepEqual(await noCredentials.json(), {
    error: "provider_unavailable",
    message: "Aucune offre vérifiée disponible pour le moment."
  });

  for (let index = 0; index < 29; index += 1) {
    const response = await fetch(base + "/api/flights/search", {
      method: "POST", headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({ origin: "ALG", destination: "CDG", departureDate: "2027-11-10", adults: 1, currencyCode: "EUR" })
    });
    assert.equal(response.status, 503, "provider errors count toward the rate limit");
    await response.arrayBuffer();
  }
  const limited = await fetch(base + "/api/flights/search", {
    method: "POST", headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ origin: "ALG", destination: "CDG", departureDate: "2027-11-10", adults: 1, currencyCode: "EUR" })
  });
  assert.equal(limited.status, 429);
  assert.deepEqual(await limited.json(), {
    error: "rate_limited",
    message: "Trop de recherches. Réessayez dans une minute."
  });

  const unknown = await fetch(base + "/api/not-a-route", { headers: { origin } });
  assert.equal(unknown.status, 404);
});


test("global discovery endpoint is disabled by default and does not call a supplier", async (t) => {
  const port = await freePort();
  const origin = "https://tripradar.example";
  const child = spawn(process.execPath, ["api/server.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      ALLOWED_ORIGIN: origin,
      AMADEUS_CLIENT_ID: "test-id",
      AMADEUS_CLIENT_SECRET: "test-secret",
      TRIPBOOST_DISCOVERY_ENABLED: ""
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  t.after(() => { if (child.exitCode === null) child.kill("SIGTERM"); });
  const base = "http://127.0.0.1:" + port;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) throw new Error("API exited before ready: " + output);
    try {
      const response = await fetch(base + "/api/health", { signal: AbortSignal.timeout(300) });
      if (response.ok) { ready = true; break; }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(ready, true);
  const response = await fetch(base + "/api/discovery/search", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({
      origin: "ALG",
      destinations: ["CDG", "IST", "JFK"],
      departureDate: "2027-11-10",
      adults: 1,
      currencyCode: "EUR"
    })
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: "discovery_disabled",
    message: "La recherche mondiale est désactivée. Activez explicitement TRIPBOOST_DISCOVERY_ENABLED=true après validation des coûts fournisseur."
  });
});


test("global discovery aborts active supplier requests when the HTTP client disconnects", async (t) => {
  const apiPort = await freePort();
  let flightRequests = 0;
  let abortedFlightResponses = 0;
  let resolveFlightsStarted;
  const flightsStarted = new Promise((resolve) => { resolveFlightsStarted = resolve; });

  const providerServer = createHttpServer((req, res) => {
    const pathname = new URL(req.url || "/", "http://provider").pathname;
    if (req.method === "POST" && pathname === "/v1/security/oauth2/token") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ access_token: "local-test-token", expires_in: 3600 }));
      return;
    }
    if (req.method === "GET" && pathname === "/v2/shopping/flight-offers") {
      flightRequests += 1;
      const fallback = setTimeout(() => {
        if (!res.destroyed) {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ data: [] }));
        }
      }, 10_000);
      res.once("close", () => {
        clearTimeout(fallback);
        if (!res.writableEnded) abortedFlightResponses += 1;
      });
      if (flightRequests === 2) resolveFlightsStarted();
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise((resolve, reject) => {
    providerServer.once("error", reject);
    providerServer.listen(0, "127.0.0.1", resolve);
  });
  const providerPort = providerServer.address().port;
  const origin = "https://tripboost.example";
  const child = spawn(process.execPath, ["api/server.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(apiPort),
      ALLOWED_ORIGIN: origin,
      AMADEUS_BASE_URL: `http://127.0.0.1:${providerPort}`,
      AMADEUS_CLIENT_ID: "local-test-client",
      AMADEUS_CLIENT_SECRET: "local-test-secret",
      TRIPBOOST_DISCOVERY_ENABLED: "true"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  t.after(async () => {
    if (child.exitCode === null) child.kill("SIGTERM");
    await new Promise((resolve) => providerServer.close(() => resolve()));
  });

  const base = `http://127.0.0.1:${apiPort}`;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) throw new Error("API exited before ready: " + output);
    try {
      const response = await fetch(base + "/api/health", { signal: AbortSignal.timeout(300) });
      if (response.ok) { ready = true; break; }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(ready, true, "API must become ready");

  const request = httpRequest({
    hostname: "127.0.0.1",
    port: apiPort,
    path: "/api/discovery/search",
    method: "POST",
    headers: { origin, "content-type": "application/json" }
  });
  request.once("error", () => {});
  request.end(JSON.stringify({
    origin: "ALG",
    destinations: ["CDG", "IST", "JFK", "LHR"],
    departureDate: "2027-11-10",
    adults: 1,
    currencyCode: "EUR"
  }));

  let startTimer;
  const startedInTime = await Promise.race([
    flightsStarted.then(() => true),
    new Promise((resolve) => { startTimer = setTimeout(() => resolve(false), 3_000); })
  ]);
  clearTimeout(startTimer);
  assert.equal(startedInTime, true, "two supplier requests should start before cancellation");
  request.destroy();

  const deadline = Date.now() + 3_000;
  while (abortedFlightResponses < 2 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(abortedFlightResponses, 2, "both in-flight supplier responses must be cancelled");
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(flightRequests, 2, "no later destination request may start after client disconnect");
});


async function rawGet(port, requestTarget) {
  return new Promise((resolve, reject) => {
    const socket = connectNet(port, "127.0.0.1");
    let response = "";
    socket.setEncoding("utf8");
    socket.once("connect", () => {
      socket.end([
        `GET ${requestTarget} HTTP/1.1`,
        "Host: localhost",
        "Connection: close",
        "",
        ""
      ].join(String.fromCharCode(13, 10)));
    });
    socket.on("data", (chunk) => { response += chunk; });
    socket.once("error", reject);
    socket.once("end", () => resolve(response));
  });
}

test("malformed request targets return 400 without terminating the API", async (t) => {
  const port = await freePort();
  const origin = "https://tripradar.example";
  const child = spawn(process.execPath, ["api/server.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      ALLOWED_ORIGIN: origin,
      AMADEUS_CLIENT_ID: "",
      AMADEUS_CLIENT_SECRET: ""
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  t.after(() => {
    if (child.exitCode === null) child.kill("SIGTERM");
  });

  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) throw new Error("API exited before ready: " + output);
    try {
      const response = await fetch(base + "/api/health", { signal: AbortSignal.timeout(300) });
      if (response.ok) { ready = true; break; }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(ready, true, "API must become ready");

  const malformed = await rawGet(port, "http://[");
  assert.ok(malformed.startsWith("HTTP/1.1 400 "), malformed);
  assert.match(malformed, /invalid_request_target/);
  assert.equal(child.exitCode, null, "the malformed request must not crash the API process");

  const health = await fetch(base + "/api/health");
  assert.equal(health.status, 200, "the API must continue serving valid requests");
});
