import { isFeatureEnabled } from "../featureFlags";

let mockUserId = "cache-test";
const mockFlags = jest.fn();
jest.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: mockUserId }),
  currentUser: async () => ({ id: mockUserId }),
}));
jest.mock("@/app/posthog", () => ({ __esModule: true, default: () => ({ getAllFlags: (...args: unknown[]) => mockFlags(...args) }) }));

test("boolean flags, variants, shared requests, expiry, and failed fetch retry have consistent semantics", async () => {
  const clock = jest.spyOn(Date, "now").mockReturnValue(1_000_000);
  mockFlags.mockResolvedValue({ enabled: true, variant: "control" });
  expect(await Promise.all([isFeatureEnabled("enabled"), isFeatureEnabled("variant")])).toEqual([true, false]);
  expect(mockFlags).toHaveBeenCalledTimes(1);
  clock.mockReturnValue(1_060_001);
  await isFeatureEnabled("enabled");
  expect(mockFlags).toHaveBeenCalledTimes(2);
  mockUserId = "failed-cache-user";
  mockFlags.mockRejectedValueOnce(new Error("offline"));
  expect(await isFeatureEnabled("enabled")).toBe(false);
  expect(await isFeatureEnabled("enabled")).toBe(true);
  expect(mockFlags).toHaveBeenCalledTimes(4);
  clock.mockRestore();
});

test("inactive users are evicted once the cache reaches its maximum size", async () => {
  const clock = jest.spyOn(Date, "now").mockReturnValue(2_000_000);
  mockFlags.mockClear().mockResolvedValue({ enabled: true });
  for (let index = 0; index <= 1000; index++) {
    mockUserId = `bounded-user-${index}`;
    await isFeatureEnabled("enabled");
  }
  expect(mockFlags).toHaveBeenCalledTimes(1001);
  mockUserId = "bounded-user-0";
  await isFeatureEnabled("enabled");
  expect(mockFlags).toHaveBeenCalledTimes(1002);
  clock.mockRestore();
});
