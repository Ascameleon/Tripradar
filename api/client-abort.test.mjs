import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createClientAbortSignal } from "./client-abort.mjs";

function fakeResponse({ writableEnded = false, destroyed = false } = {}) {
  const response = new EventEmitter();
  response.writableEnded = writableEnded;
  response.destroyed = destroyed;
  return response;
}

test("aborts provider work when the HTTP response closes before completion", () => {
  const response = fakeResponse();
  const binding = createClientAbortSignal(response);
  response.emit("close");
  assert.equal(binding.signal.aborted, true);
  assert.match(binding.signal.reason.message, /client disconnected/i);
  binding.dispose();
});

test("does not abort after a normal completed response", () => {
  const response = fakeResponse({ writableEnded: true });
  const binding = createClientAbortSignal(response);
  response.emit("close");
  assert.equal(binding.signal.aborted, false);
  binding.dispose();
});

test("does not abort after the response listener has been disposed", () => {
  const response = fakeResponse();
  const binding = createClientAbortSignal(response);
  binding.dispose();
  response.emit("close");
  assert.equal(binding.signal.aborted, false);
});

test("immediately aborts when the response was already destroyed", () => {
  const response = fakeResponse({ destroyed: true });
  const binding = createClientAbortSignal(response);
  assert.equal(binding.signal.aborted, true);
  binding.dispose();
});
