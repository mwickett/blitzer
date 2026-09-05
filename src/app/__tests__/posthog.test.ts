/** @jest-environment node */
import PostHogClient from "../posthog";
import { PostHog } from "posthog-node";

jest.unmock("@/app/posthog");
jest.mock("posthog-node", () => ({ PostHog: jest.fn() }));

test("server helpers share one SDK client", () => {
  const first = PostHogClient();
  expect(PostHogClient()).toBe(first);
  expect(PostHog).toHaveBeenCalledTimes(1);
});
