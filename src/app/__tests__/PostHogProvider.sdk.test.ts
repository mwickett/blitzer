import type { CaptureResult } from "posthog-js";
import posthog from "posthog-js";
import { PostHog } from "posthog-js/lib/src/posthog-core";
import { PostHogFeatureFlags } from "posthog-js/lib/src/posthog-featureflags";
import { LazyLoadedSessionRecording } from "posthog-js/lib/src/extensions/replay/external/lazy-loaded-session-recorder";
import "@/app/PostHogProvider";

jest.mock("posthog-js", () => ({ __esModule: true, default: { init: jest.fn() } }));
jest.mock("posthog-js/react", () => ({ PostHogProvider: () => null }));

// Exercise the installed SDK's actual envelopes and flags/recorder paths. The
// provider's init is intercepted, and every real client transport is replaced.
// Private SDK paths are deliberate: upgrades must preserve these privacy checks.
test("installed SDK keeps join tokens out of events, flag requests, and replay URLs", () => {
  jest.useFakeTimers();
  // Bundle and source declarations use distinct private class identities.
  const config = jest.mocked(posthog.init).mock.calls[0][1] as unknown as NonNullable<Parameters<PostHog["init"]>[1]>;
  const previousExtensions = PostHog.__defaultExtensionClasses;
  PostHog.__defaultExtensionClasses = { featureFlags: PostHogFeatureFlags };
  const client = new PostHog();
  const requests: Array<{ url: string; data?: unknown }> = [];
  const captured: CaptureResult[] = [];
  const previousUrl = window.location.href;
  window.history.replaceState({}, "", "/join/synthetic-token?ticket=synthetic-query");
  const referrer = jest.spyOn(document, "referrer", "get")
    .mockReturnValue("https://synthetic.example/join/synthetic-referrer");
  client._send_request = jest.fn((request) => {
    requests.push(request);
    request.callback?.({ statusCode: 200, json: { featureFlags: {} } });
  });

  try {
    client.init("synthetic-test-key", {
      ...config,
      persistence: "memory",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      request_batching: false,
      disable_external_dependency_loading: true,
      disable_session_recording: true,
      remote_config_refresh_interval_ms: 0,
      before_send: (event) => {
        const sanitized = typeof config.before_send === "function" ? config.before_send(event) : event;
        if (sanitized) captured.push(sanitized);
        return null;
      },
      loaded: (instance) => {
        // Simulate initial-origin persistence from a previous installation.
        instance.register({ $initial_person_info: { u: window.location.href, r: document.referrer } });
        expect(JSON.stringify(client.persistence?.get_initial_props())).toContain("synthetic-token");
        config.loaded?.(instance);
      },
    });
    client.setPersonPropertiesForFlags({ email: "synthetic@example.invalid", username: "synthetic-user" }, false);
    client.identify("synthetic-clerk-id");
    client.capture("$pageview");
    // Debounced identify-triggered request uses the SDK's real request builder.
    jest.advanceTimersByTime(10);
    const flags = requests.find((request) => request.url.includes("/flags/"));
    expect(flags?.data).toEqual(expect.objectContaining({
      person_properties: { email: "synthetic@example.invalid", username: "synthetic-user" },
    }));
    expect(client.persistence?.get_initial_props()).toEqual({});
    expect(captured.map((event) => event.event)).toEqual(["$identify", "$pageview"]);
    const serialized = JSON.stringify(captured);
    for (const secret of ["synthetic-token", "synthetic-query", "synthetic-referrer", "synthetic@example.invalid", "synthetic-user"]) {
      expect(serialized).not.toContain(secret);
    }
    expect(captured[1].properties.$session_entry_url).toBe(window.origin + "/join/[token]");

    const recorder = Object.create(LazyLoadedSessionRecording.prototype) as {
      _instance: PostHog;
      _maskReplayUrl: (url: string) => string;
    };
    recorder._instance = client;
    expect(recorder._maskReplayUrl(window.location.href)).toBe(window.origin + "/join/[token]");
  } finally {
    PostHog.__defaultExtensionClasses = previousExtensions;
    window.history.replaceState({}, "", previousUrl);
    referrer.mockRestore();
    jest.clearAllTimers();
    jest.useRealTimers();
  }
});
