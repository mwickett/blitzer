/** @jest-environment node */
jest.mock("server-only", () => ({}));

const mockProtect = jest.fn();
const mockRedirect = jest.fn((path: string) => {
  throw new Error(`redirect:${path}`);
});
jest.mock("@clerk/nextjs/server", () => ({ auth: { protect: () => mockProtect() } }));
jest.mock("next/navigation", () => ({ redirect: (path: string) => mockRedirect(path) }));

import { requireCircle, requireSignedIn } from "../pageAuth";

beforeEach(() => jest.clearAllMocks());

describe("requireSignedIn", () => {
  it("returns the signed-in session, with or without a Circle", async () => {
    mockProtect.mockResolvedValue({ userId: "user_1", orgId: null });
    await expect(requireSignedIn()).resolves.toEqual({ userId: "user_1", orgId: null });
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("lets Clerk's sign-in redirect propagate", async () => {
    mockProtect.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(requireSignedIn()).rejects.toThrow("NEXT_REDIRECT");
  });
});

describe("requireCircle", () => {
  it("returns the session for a Circle member", async () => {
    mockProtect.mockResolvedValue({ userId: "user_1", orgId: "org_1" });
    await expect(requireCircle()).resolves.toEqual({ userId: "user_1", orgId: "org_1" });
  });

  it("sends a signed-in player without a Circle to setup", async () => {
    mockProtect.mockResolvedValue({ userId: "user_1", orgId: null });
    await expect(requireCircle()).rejects.toThrow("redirect:/circles/setup");
  });

  it("checks sign-in before the Circle", async () => {
    mockProtect.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(requireCircle()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
