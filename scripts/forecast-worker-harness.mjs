// Node adapter for exercising the same message handler shipped to browsers.
import { parentPort } from "node:worker_threads";
import { require as tsxRequire } from "tsx/cjs/api";

globalThis.self = {
  addEventListener: (_type, listener) =>
    parentPort.on("message", (data) => listener({ data })),
  postMessage: (message) => parentPort.postMessage(message),
};
tsxRequire("../src/lib/scoring/forecast.worker.ts", import.meta.url);
parentPort.postMessage({ ready: true });
