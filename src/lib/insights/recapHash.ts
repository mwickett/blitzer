import { createHash } from "crypto";
import type { GameRecapFacts } from "./gameRecap";

// Deterministic JSON with recursively sorted object keys, so the hash is stable
// regardless of property insertion order.
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

export function hashRecapFacts(facts: GameRecapFacts): string {
  return createHash("sha256").update(stableStringify(facts)).digest("hex");
}
