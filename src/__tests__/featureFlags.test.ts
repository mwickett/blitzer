const mockGetAllFlags = jest.fn();
const mockGetFeatureFlag = jest.fn();
jest.mock("@/app/posthog", () => ({
  __esModule: true,
  default: () => ({ getAllFlags: mockGetAllFlags, getFeatureFlag: mockGetFeatureFlag }),
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
    await isFeatureEnabled("another-flag");

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
    await expect(isFeatureEnabled("llm-features")).resolves.toBe(false);

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

describe("isFeatureEnabledForUser (email recipients)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("targets the stored profile without the caller's Clerk session", async () => {
    const { isFeatureEnabledForUser } = await importFlags();
    mockGetFeatureFlag.mockResolvedValue(true);
    await expect(isFeatureEnabledForUser("llm-features", {
      clerkUserId: "user-2", email: "user-2@example.com", username: "user-two",
    })).resolves.toBe(true);
    expect(mockGetFeatureFlag).toHaveBeenCalledWith("llm-features", "user-2", {
      personProperties: { email: "user-2@example.com", username: "user-two" },
    });
    expect(mockAuth).not.toHaveBeenCalled();
  });

  it.each([["variant"], [false], [undefined]])("treats %p as disabled", async (value) => {
    const { isFeatureEnabledForUser } = await importFlags();
    mockGetFeatureFlag.mockResolvedValue(value);
    await expect(isFeatureEnabledForUser("llm-features", { clerkUserId: "user-2" })).resolves.toBe(false);
  });

  it("fails closed when evaluation errors", async () => {
    const { isFeatureEnabledForUser } = await importFlags();
    mockGetFeatureFlag.mockRejectedValue(new Error("network"));
    await expect(isFeatureEnabledForUser("llm-features", { clerkUserId: "user-2" })).resolves.toBe(false);
  });
});
