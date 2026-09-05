import { sanitizeAnalyticsEvent, sanitizeAnalyticsProperties } from "../analytics";

test("removes tokens and query data from pageview, referrer, person-origin and link attributes", () => {
  const input = {
    $current_url: "https://example.invalid/join/private-token?email=person@example.invalid#secret",
    $referrer: "https://example.invalid/?ticket=secret",
    $set_once: { $initial_current_url: "/join/private-token" },
    $elements: [{ attr__href: "/join/private-token?code=secret" }],
    $elements_chain: 'a href="/join/private-token"',
    $session_entry_url: "https://example.invalid/join/private-token?code=secret",
    $session_entry_pathname: "/join/private-token",
    $session_entry_referrer: "https://example.invalid/join/private-token",
    $external_click_url: "https://example.invalid/join/private-token",
    round_number: 3,
  };
  const output = sanitizeAnalyticsProperties(input);
  expect(JSON.stringify(output)).not.toMatch(/private-token|person@example|secret/);
  expect(output.round_number).toBe(3);
  expect(output.$current_url).toBe("https://example.invalid/join/[token]");
  expect(input.$current_url).toContain("private-token");
});

test("sanitizes the SDK's top-level person-origin envelope", () => {
  const result = sanitizeAnalyticsEvent({
    uuid: "fixture", event: "$identify", properties: { distinct_id: "user" },
    $set: { $initial_referrer: "https://example.invalid/join/private-token?email=private" },
    $set_once: { $initial_current_url: "https://example.invalid/join/private-token" },
  });
  expect(JSON.stringify(result)).not.toContain("private");
  expect(result?.$set_once?.$initial_current_url).toBe("https://example.invalid/join/[token]");
});
