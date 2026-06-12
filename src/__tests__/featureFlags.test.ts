const mockGetAllFlags = jest.fn();
jest.mock("@/app/posthog", () => ({
  __esModule: true,
  default: () => ({ getAllFlags: mockGetAllFlags }),
}));

const mockAuth = jest.fn();
const mockCurrentUser = jest.fn();
jest.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
  currentUser: () => mockCurrentUser(),
}));

// Each test re-imports the module after resetModules so the per-instance
// flag cache starts empty.
async function importFlags() {
  return import("@/featureFlags");
}

describe("isFeatureEnabled (#200 — server-side flag caching)", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: "user-1" });
    mockCurrentUser.mockResolvedValue({
      primaryEmailAddress: { emailAddress: "user-1@example.com" },
      username: "user-one",
    });
    mockGetAllFlags.mockResolvedValue({ "llm-features": true });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns the flag value for an authenticated user", async () => {
    const { isFeatureEnabled } = await importFlags();
    await expect(isFeatureEnabled("llm-features")).resolves.toBe(true);
    await expect(isFeatureEnabled("missing-flag")).resolves.toBe(false);
  });

  it("fetches flags from Clerk + PostHog only once per user within the TTL", async () => {
    const { isFeatureEnabled } = await importFlags();

    await isFeatureEnabled("llm-features");
    await isFeatureEnabled("llm-features");
    await isFeatureEnabled("scoring-revamp");

    expect(mockGetAllFlags).toHaveBeenCalledTimes(1);
    expect(mockCurrentUser).toHaveBeenCalledTimes(1);
  });

  it("refetches after the TTL expires", async () => {
    jest.useFakeTimers();
    const { isFeatureEnabled } = await importFlags();

    await isFeatureEnabled("llm-features");
    jest.advanceTimersByTime(61_000);
    await isFeatureEnabled("llm-features");

    expect(mockGetAllFlags).toHaveBeenCalledTimes(2);
  });

  it("caches per user, not globally", async () => {
    const { isFeatureEnabled } = await importFlags();

    mockAuth.mockResolvedValueOnce({ userId: "user-1" });
    await isFeatureEnabled("llm-features");
    mockAuth.mockResolvedValueOnce({ userId: "user-2" });
    await isFeatureEnabled("llm-features");

    expect(mockGetAllFlags).toHaveBeenCalledTimes(2);
  });

  it("does not cache failed fetches", async () => {
    const { isFeatureEnabled } = await importFlags();

    mockGetAllFlags.mockRejectedValueOnce(new Error("posthog down"));
    await expect(isFeatureEnabled("llm-features")).rejects.toThrow(
      "posthog down"
    );

    await expect(isFeatureEnabled("llm-features")).resolves.toBe(true);
    expect(mockGetAllFlags).toHaveBeenCalledTimes(2);
  });

  it("returns false for unauthenticated users without calling PostHog", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { isFeatureEnabled } = await importFlags();

    await expect(isFeatureEnabled("llm-features")).resolves.toBe(false);
    expect(mockGetAllFlags).not.toHaveBeenCalled();
    expect(mockCurrentUser).not.toHaveBeenCalled();
  });
});
