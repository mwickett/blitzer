/** @jest-environment node */
import { after } from "next/server";
import { captureServerEvent } from "../telemetry";

jest.unmock("@/server/telemetry");
jest.mock("next/server", () => ({ after: jest.fn() }));

test("event delivery starts after the response and its promise belongs to Next", async () => {
  let finish: () => void = () => {};
  const client = { captureImmediate: jest.fn(() => new Promise<void>((resolve) => { finish = resolve; })) };
  const event = { distinctId: "test", event: "score_saved" };
  captureServerEvent(client, event);
  expect(client.captureImmediate).not.toHaveBeenCalled();
  const callback = jest.mocked(after).mock.calls.at(-1)![0] as () => Promise<void>;
  let completed = false;
  const pending = callback().then(() => { completed = true; });
  await Promise.resolve();
  expect(completed).toBe(false);
  expect(client.captureImmediate).toHaveBeenCalledWith(event);
  finish();
  await pending;
  expect(completed).toBe(true);
});

test("delivery and background registration failures never fail the primary mutation", async () => {
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  const client = { captureImmediate: jest.fn().mockRejectedValue(new Error("network")) };
  captureServerEvent(client, { distinctId: "test", event: "score_saved" });
  const callback = jest.mocked(after).mock.calls.at(-1)![0] as () => Promise<void>;
  await expect(callback()).resolves.toBeUndefined();
  jest.mocked(after).mockImplementationOnce(() => { throw new Error("no request"); });
  expect(() => captureServerEvent(client, { distinctId: "test", event: "score_saved" })).not.toThrow();
  warn.mockRestore();
});
