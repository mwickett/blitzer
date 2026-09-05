import { calcRaceForecast } from "./probability";
import type { ForecastInput, ForecastReply } from "./forecastInput";

self.addEventListener(
  "message",
  (event: MessageEvent<{ key: string; input: ForecastInput }>) => {
    const { key, input } = event.data;
    let reply: ForecastReply;
    try {
      reply = {
        key,
        ok: true,
        forecast: calcRaceForecast(
          input.players,
          input.winThreshold,
          input.deltasByPlayer,
          input.options,
        ),
      };
    } catch {
      reply = { key, ok: false };
    }
    self.postMessage(reply);
  },
);
