import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";

async function freePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}

test("HTTP API enforces health, origin, payload, and provider error contracts", async (t) => {
  const port = await freePort();
  const origin = "https://tripradar.example";
  const child = spawn(process.execPath, ["api/server.mjs"], {
    env: {
      ...process.env,
      PORT: String(port),
      ALLOWED_ORIGIN: origin,
      AMADEUS_CLIENT_ID: "",
      AMADEUS_CLIENT_SECRET: ""
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  t.after(() => {
    if (child.exitCode === null) child.kill("SIGTERM");
  });

  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`API exited early: ${stderr}`);
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) { ready = true; break; }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(ready, true, `API did not start: ${stderr}`);

  const health = await fetch(`${base}/api/health`, { headers: { origin } });
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true, providerConfigured: false });
  assert.equal(health.headers.get("access-control-allow-origin"), origin);
  assert.equal(health.headers.get("cache-control"), "no-store");

  const forbidden = await fetch(`${base}/api/health`, { headers: { origin: "https://evil.example" } });
  assert.equal(forbidden.status, 403);
  assert.deepEqual(await forbidden.json(), { error: "origin_not_allowed" });

  const wrongType = await fetch(`${base}/api/flights/search`, {
    method: "POST", headers: { origin, "content-type": "text/plain" }, body: "{}"
  });
  assert.equal(wrongType.status, 415);

  const malformed = await fetch(`${base}/api/flights/search`, {
    method: "POST", headers: { origin, "content-type": "application/json" }, body: "{"
  });
  assert.equal(malformed.status, 400);
  assert.deepEqual(await malformed.json(), { error: "invalid_json" });

  const invalidSearch = await fetch(`${base}/api/flights/search`, {
    method: "POST", headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ origin: "ALG", destination: "ALG", departureDate: "2026-11-10" })
  });
  assert.equal(invalidSearch.status, 400);
  assert.deepEqual(await invalidSearch.json(), { error: "invalid_search_parameters" });

  const oversized = await fetch(`${base}/api/hotels/search`, {
    method: "POST", headers: { origin, "content-type": "application/json", "content-length": "20001" },
    body: " ".repeat(20001)
  });
  assert.equal(oversized.status, 413);
  assert.deepEqual(await oversized.json(), { error: "request_too_large" });

  const missingProvider = await fetch(`${base}/api/flights/search`, {
    method: "POST", headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ origin: "ALG", destination: "CDG", departureDate: "2026-11-10", adults: 1, currencyCode: "EUR" })
  });
  assert.equal(missingProvider.status, 503);
  assert.deepEqual(await missingProvider.json(), {
    error: "provider_unavailable",
    message: "Aucune offre vérifiée disponible pour le moment."
  });

  const notFound = await fetch(`${base}/api/unknown`, { headers: { origin } });
  assert.equal(notFound.status, 404);
});
