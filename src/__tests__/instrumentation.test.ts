/** @jest-environment node */
import { onRequestError } from "../instrumentation";

const mockSentry = jest.fn();
const mockCapture = jest.fn().mockResolvedValue(undefined);
jest.mock("@sentry/nextjs", () => ({ captureRequestError: (...args: unknown[]) => mockSentry(...args) }));
jest.mock("@/app/posthog", () => ({ __esModule: true, default: () => ({ captureExceptionImmediate: (...args: unknown[]) => mockCapture(...args) }) }));

test("preserves Next route context and awaits error delivery without recording join tokens", async () => {
  process.env.NEXT_RUNTIME = "nodejs";
  const error = new Error("fixture");
  const request = { path: "/join/private-token?secret=value", method: "GET", headers: {} };
  const context = { routerKind: "App Router" as const, routePath: "/join/[token]", routeType: "render" as const, revalidateReason: undefined };
  await onRequestError(error, request, context);
  expect(mockSentry).toHaveBeenCalledWith(error, { ...request, path: "/join/[token]" }, context);
  expect(mockCapture).toHaveBeenCalledWith(error, undefined, expect.objectContaining({ path: "/join/[token]", method: "GET", routeType: "render" }));
});
