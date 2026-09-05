import type { CaptureResult } from "posthog-js";

/** Keep route-level analytics while excluding invitations and query values. */
export function sanitizeAnalyticsUrl(value: string) {
  return value.split(/[?#]/, 1)[0].replace(/(\/join\/)[^/]+/g, "$1[token]");
}

export function sanitizeAnalyticsProperties(properties: Record<string, unknown>) {
  const clean = { ...properties };
  for (const [key, value] of Object.entries(clean)) {
    if (typeof value === "string" && (/(?:url|pathname|referrer)$/.test(key) || /^(?:attr__)?href$/.test(key))) {
      clean[key] = sanitizeAnalyticsUrl(value);
    }
  }
  for (const key of ["$set", "$set_once"]) {
    const value = clean[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      clean[key] = sanitizeAnalyticsProperties(value as Record<string, unknown>);
    }
  }
  if (Array.isArray(clean.$elements)) {
    clean.$elements = clean.$elements.map((element) => sanitizeAnalyticsProperties(element));
  }
  // The SDK also encodes element attributes into a compact string. Keep it
  // out of invite-link events instead of trying to parse that private format.
  if (typeof clean.$elements_chain === "string" && clean.$elements_chain.includes("/join/")) {
    delete clean.$elements_chain;
  }
  return clean;
}

export function sanitizeAnalyticsEvent(event: CaptureResult | null): CaptureResult | null {
  if (!event) return null;
  return {
    ...event,
    properties: sanitizeAnalyticsProperties(event.properties),
    ...(event.$set ? { $set: sanitizeAnalyticsProperties(event.$set) } : {}),
    ...(event.$set_once ? { $set_once: sanitizeAnalyticsProperties(event.$set_once) } : {}),
  };
}
