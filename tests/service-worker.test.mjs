import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const workerSource = await readFile(new URL("../sw.js", import.meta.url), "utf8");
const scope = "https://example.test/tripboost/";

function createWorker({ cacheNames = [], fetchImpl = async () => new Response("network") } = {}) {
  const listeners = new Map();
  const deleted = [];
  const store = new Map();
  const caches = {
    async keys() {
      return [...cacheNames];
    },
    async delete(name) {
      deleted.push(name);
      return true;
    },
    async open() {
      return {
        async addAll(files) {
          for (const file of files) {
            store.set(new URL(file, scope).href, new Response("cached:" + file));
          }
        },
        async match(request) {
          const key = typeof request === "string" ? new URL(request, scope).href : request.url;
          return store.get(key) ?? null;
        },
        async put(request, response) {
          const key = typeof request === "string" ? new URL(request, scope).href : request.url;
          store.set(key, response);
        }
      };
    },
    async match(request) {
      const key = typeof request === "string" ? new URL(request, scope).href : request.url;
      return store.get(key) ?? null;
    }
  };
  const self = {
    registration: { scope },
    location: new URL(scope),
    clients: { claim: async () => { self.claimed = true; } },
    skipWaiting: () => { self.skippedWaiting = true; },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    }
  };

  vm.runInNewContext(workerSource, { self, caches, fetch: fetchImpl, URL }, { filename: "sw.js" });
  return { listeners, caches, deleted, store, self };
}

test("activation removes only stale TripBoost caches and preserves other applications", async () => {
  const worker = createWorker({
    cacheNames: ["tripboost-static-v1", "other-app-cache", "tripboost-images-v1", "tripboost-static-v2"]
  });
  let activation;
  worker.listeners.get("activate")({ waitUntil(promise) { activation = promise; } });
  await activation;

  assert.deepEqual(worker.deleted, ["tripboost-static-v1", "tripboost-images-v1"]);
  assert.equal(worker.self.claimed, true);
});

test("offline navigation falls back to the cached TripBoost app shell", async () => {
  const worker = createWorker({ fetchImpl: async () => { throw new Error("offline"); } });
  worker.store.set(new URL("./index.html", scope).href, new Response("cached app shell"));
  let responsePromise;

  worker.listeners.get("fetch")({
    request: { url: new URL("./", scope).href, method: "GET", mode: "navigate" },
    respondWith(promise) { responsePromise = promise; }
  });

  const response = await responsePromise;
  assert.equal(await response.text(), "cached app shell");
});

test("a missing static asset does not receive the HTML navigation fallback", async () => {
  const worker = createWorker({ fetchImpl: async () => { throw new Error("offline"); } });
  let responsePromise;

  worker.listeners.get("fetch")({
    request: { url: new URL("./icon.svg", scope).href, method: "GET", mode: "no-cors" },
    respondWith(promise) { responsePromise = promise; }
  });

  await assert.rejects(responsePromise, /offline/);
});

test("API and out-of-scope requests are not intercepted or cached", () => {
  const worker = createWorker();
  let apiIntercepted = false;
  let outsideIntercepted = false;

  worker.listeners.get("fetch")({
    request: { url: new URL("./api/health", scope).href, method: "GET", mode: "cors" },
    respondWith() { apiIntercepted = true; }
  });
  worker.listeners.get("fetch")({
    request: { url: "https://example.test/another-app/index.html", method: "GET", mode: "navigate" },
    respondWith() { outsideIntercepted = true; }
  });

  assert.equal(apiIntercepted, false);
  assert.equal(outsideIntercepted, false);
});
