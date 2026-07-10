import { auth, currentUser } from "@clerk/nextjs/server";
import prisma from "../db/db";
import {
  ensureCurrentPrismaUser,
  requireGameScoringAccess,
} from "../mutations/common";

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

  it("preserves the established no-active-circle error", async () => {
    (prisma.game.findUnique as jest.Mock).mockResolvedValue({
      id: "game-id",
      kind: "CIRCLE",
      organizationId: "org-game",
      players: [],
    });

    await expect(requireGameScoringAccess("game-id")).rejects.toThrow(
      "No active circle",
    );
  });
});
