import { useEffect, useMemo, useRef, useState } from "react";
import { cachedForecast, requestForecast } from "@/lib/scoring/forecastClient";
import {
  forecastKey,
  hasForecastEvidence,
  type ForecastInput,
} from "@/lib/scoring/forecastInput";
import type { RaceForecast } from "@/lib/scoring/probability";

type Result = {
  key: string;
  status: "ready" | "unavailable";
  forecast: RaceForecast | null;
};

export function useRaceForecast(input: ForecastInput) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(
    () => typeof IntersectionObserver === "undefined",
  );
  const [result, setResult] = useState<Result | null>(null);
  const key = forecastKey(input);
  const stableInput = useMemo(() => JSON.parse(key) as ForecastInput, [key]);
  const eligible = hasForecastEvidence(stableInput);
  const cached = cachedForecast(key);
  const currentResult = result?.key === key ? result : null;

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry.isIntersecting),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !eligible || cached !== undefined || currentResult) return;
    return requestForecast(stableInput, key, (reply) => {
      setResult({
        key,
        status: reply.ok ? "ready" : "unavailable",
        forecast: reply.ok ? reply.forecast : null,
      });
    });
  }, [stableInput, key, visible, eligible, cached, currentResult]);

  return {
    containerRef,
    forecast: cached !== undefined ? cached : (currentResult?.forecast ?? null),
    status: !eligible
      ? ("insufficient" as const)
      : cached !== undefined
        ? ("ready" as const)
        : currentResult
          ? currentResult.status
          : ("loading" as const),
  };
}
