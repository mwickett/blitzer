/** @jest-environment node */
import * as Sentry from "@sentry/nextjs";
import { onRequestError } from "../instrumentation";

jest.mock("@/app/posthog", () => ({
  __esModule: true,
  default: () => ({ captureExceptionImmediate: async () => {} }),
}));

test("installed Sentry SDK receives route context without invitation-bearing request headers", async () => {
  const events: Sentry.ErrorEvent[] = [];
  const send = jest.fn(async () => ({}));
  Sentry.init({
    dsn: "https://synthetic@example.invalid/1",
    defaultIntegrations: false,
    integrations: [Sentry.requestDataIntegration()],
    sendClientReports: false,
    transport: () => ({ send, flush: async () => true }),
    beforeSend: (event) => { events.push(event); return null; },
  });
  process.env.NEXT_RUNTIME = "nodejs";
  try {
    await onRequestError(new Error("synthetic fixture"), {
      path: "/join/synthetic-path-token?ticket=synthetic-query",
      method: "GET",
      headers: {
        referer: "https://example.invalid/join/synthetic-referrer-token?ticket=synthetic-query",
        "next-url": "/join/synthetic-next-token",
        "next-router-state-tree": '%5B%22join%22%2C%22synthetic-tree-token%22%5D',
      },
    }, {
      routerKind: "App Router", routePath: "/join/[token]", routeType: "render",
      revalidateReason: undefined,
    });
    await Sentry.flush(1000);
    expect(events).toHaveLength(1);
    expect(events[0].contexts?.nextjs).toMatchObject({
      request_path: "/join/[token]", router_path: "/join/[token]", route_type: "render",
    });
    expect(events[0].request?.method).toBe("GET");
    expect(JSON.stringify(events)).not.toMatch(/synthetic-(?:path|referrer|next|tree)-token|synthetic-query/);
    expect(send).not.toHaveBeenCalled();
  } finally {
    await Sentry.close(1000);
  }
});
