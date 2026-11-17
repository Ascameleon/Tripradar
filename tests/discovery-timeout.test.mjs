import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const server = await readFile(new URL("../api/server.mjs", import.meta.url), "utf8");

test("global discovery client timeout covers the bounded nine-destination provider fan-out", () => {
  assert.match(html, /AbortSignal\.timeout\(65000\)/);
  assert.doesNotMatch(html, /AbortSignal\.timeout\(25000\)/);
});

test("API routes bind upstream cancellation to the client response lifecycle", () => {
  assert.match(server, /createClientAbortSignal\(res\)/);
  assert.match(server, /signal:\s*clientAbort\.signal/);
  assert.match(server, /clientAbort\.dispose\(\)/);
});
