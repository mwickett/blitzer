import { auth, currentUser } from "@clerk/nextjs/server";
import prisma from "../db/db";
import { ensureCurrentPrismaUser } from "../mutations/common";

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn(),
  currentUser: jest.fn(),
}));

jest.mock("@/app/posthog", () => ({
  __esModule: true,
  default: () => ({ capture: jest.fn() }),
}));

jest.mock("../db/db", () => ({
  __esModule: true,
  default: {
    game: { findUnique: jest.fn() },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

describe("shared mutation authorization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as unknown as jest.Mock).mockResolvedValue({
      userId: "clerk-current",
      orgId: null,
    });
    (currentUser as unknown as jest.Mock).mockResolvedValue({
      username: "current",
      firstName: "Current",
      lastName: "Player",
      imageUrl: "https://example.test/avatar.png",
      primaryEmailAddress: { emailAddress: "player@example.test" },
    });
  });

  it("accepts the webhook race when the email row has the same Clerk id", async () => {
    const user = {
      id: "user-id",
      clerk_user_id: "clerk-current",
      email: "player@example.test",
    };
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(user);

    await expect(ensureCurrentPrismaUser()).resolves.toBe(user);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("never transfers an email-matched row to a different Clerk identity", async () => {
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "existing-user",
        clerk_user_id: "clerk-somebody-else",
        email: "player@example.test",
      });

    await expect(ensureCurrentPrismaUser()).rejects.toThrow(
      "An account already exists for this email",
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("takes the Clerk username so the webhook does not rename the player", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockImplementation(({ data }) => data);

    await expect(ensureCurrentPrismaUser()).resolves.toMatchObject({
      username: "current",
      clerk_user_id: "clerk-current",
      email: "player@example.test",
    });
  });

  it("falls back to a generated username when Clerk has none", async () => {
    (currentUser as unknown as jest.Mock).mockResolvedValue({
      username: null,
      imageUrl: "https://example.test/avatar.png",
      primaryEmailAddress: { emailAddress: "player@example.test" },
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockImplementation(({ data }) => data);

    const created = await ensureCurrentPrismaUser();
    expect(created.username).toBeTruthy();
    expect(created.username).not.toBe("null");
  });

  it("retries with a fresh username after a username collision", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock)
      .mockRejectedValueOnce({ code: "P2002", meta: { target: ["username"] } })
      .mockImplementationOnce(({ data }) => data);

    const created = await ensureCurrentPrismaUser();
    expect(prisma.user.create).toHaveBeenCalledTimes(2);
    // The retry cannot reuse the name that just collided.
    expect(created.username).not.toBe("current");
  });
});
