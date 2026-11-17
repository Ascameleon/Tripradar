import { EventEmitter } from "node:events";

export function createClientAbortSignal(response) {
  if (!response || typeof response.once !== "function" || typeof response.off !== "function") {
    throw new TypeError("A Node HTTP response is required");
  }

  const controller = new AbortController();
  const abortOnClose = () => {
    if (!response.writableEnded && !controller.signal.aborted) {
      controller.abort(new Error("Client disconnected"));
    }
  };

  if (response.destroyed && !response.writableEnded) controller.abort(new Error("Client disconnected"));
  else response.once("close", abortOnClose);

  return {
    signal: controller.signal,
    dispose() {
      response.off("close", abortOnClose);
    }
  };
}
