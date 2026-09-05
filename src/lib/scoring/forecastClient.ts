import type { ForecastInput, ForecastReply } from "./forecastInput";
import type { RaceForecast } from "./probability";
import { createForecastWorker } from "./createForecastWorker";

const CACHE_LIMIT = 20;
const cache = new Map<string, RaceForecast | null>();

export function cachedForecast(key: string) {
  return cache.get(key);
}

/** Each request owns its worker, so cancellation stops CPU work immediately. */
export function requestForecast(
  input: ForecastInput,
  key: string,
  onResult: (reply: ForecastReply) => void,
): () => void {
  let worker: Worker;
  try {
    worker = createForecastWorker();
  } catch {
    onResult({ key, ok: false });
    return () => {};
  }
  let active = true;
  const timeout = setTimeout(() => finish({ key, ok: false }), 30_000);
  function cancel() {
    if (!active) return;
    active = false;
    clearTimeout(timeout);
    worker.terminate();
  }
  function finish(reply: ForecastReply) {
    if (!active || reply.key !== key) return;
    cancel();
    if (reply.ok) {
      cache.set(key, reply.forecast);
      if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
    }
    onResult(reply);
  }
  worker.onmessage = (event: MessageEvent<ForecastReply>) => finish(event.data);
  worker.onerror = (event) => {
    event.preventDefault();
    finish({ key, ok: false });
  };
  worker.onmessageerror = () => finish({ key, ok: false });
  try {
    worker.postMessage({ key, input });
  } catch {
    finish({ key, ok: false });
  }
  return cancel;
}
