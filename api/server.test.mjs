import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";

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
  assert.deepEqual(await health.json(), { ok: true, providerConfigured: false });

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

  const unknown = await fetch(base + "/api/not-a-route", { headers: { origin } });
  assert.equal(unknown.status, 404);
});
