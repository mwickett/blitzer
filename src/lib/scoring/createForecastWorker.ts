export function createForecastWorker(): Worker {
  return new Worker(new URL("./forecast.worker.ts", import.meta.url), {
    type: "module",
  });
}
