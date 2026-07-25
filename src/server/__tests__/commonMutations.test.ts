import { auth, currentUser } from "@clerk/nextjs/server";
import prisma from "../db/db";
import {
  assertScoreRoster,
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
    expect(auth).toHaveBeenCalledTimes(1);
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

describe("pickup game scoring authorization", () => {
  const pickupGame = ({ started = true }: { started?: boolean } = {}) => ({
    id: "game-id",
    kind: "PICKUP",
    organizationId: null,
    startedAt: started ? new Date() : null,
    players: [
      { userId: "p1", guestId: null, user: { clerk_user_id: "clerk-current" } },
      { userId: null, guestId: "g1", user: null },
    ],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (auth as unknown as jest.Mock).mockResolvedValue({
      userId: "clerk-current",
      orgId: null,
    });
  });

  it("authorizes a registered player of a started pickup game", async () => {
    const game = pickupGame();
    (prisma.game.findUnique as jest.Mock).mockResolvedValue(game);

    await expect(requireGameScoringAccess("game-id")).resolves.toBe(game);
  });

  it("rejects somebody who is not on the pickup roster", async () => {
    (auth as unknown as jest.Mock).mockResolvedValue({
      userId: "clerk-stranger",
      orgId: null,
    });
    (prisma.game.findUnique as jest.Mock).mockResolvedValue(pickupGame());

    await expect(requireGameScoringAccess("game-id")).rejects.toThrow(
      "You are not a player in this game",
    );
  });

  it("rejects scoring a pickup game that has not started", async () => {
    (prisma.game.findUnique as jest.Mock).mockResolvedValue(
      pickupGame({ started: false }),
    );

    await expect(requireGameScoringAccess("game-id")).rejects.toThrow(
      "You are not a player in this game",
    );
  });

  it("rejects scoring a legacy game through the pickup path", async () => {
    (prisma.game.findUnique as jest.Mock).mockResolvedValue({
      id: "game-id",
      kind: "LEGACY",
      organizationId: null,
      startedAt: new Date(),
      players: [
        {
          userId: "p1",
          guestId: null,
          user: { clerk_user_id: "clerk-current" },
        },
      ],
    });

    await expect(requireGameScoringAccess("game-id")).rejects.toThrow(
      "You are not a player in this game",
    );
  });
});

describe("assertScoreRoster", () => {
  const roster = [
    { userId: "p1", guestId: null },
    { userId: null, guestId: "g1" },
  ];

  it("accepts an exact match across registered players and guests", () => {
    expect(() =>
      assertScoreRoster(roster, [{ userId: "p1" }, { guestId: "g1" }]),
    ).not.toThrow();
  });

  it("rejects a guest id that is not on the roster", () => {
    expect(() =>
      assertScoreRoster(roster, [{ userId: "p1" }, { guestId: "g-other" }]),
    ).toThrow("Scores must match the players in this game");
  });

  it("rejects a duplicate submission for the same player", () => {
    expect(() =>
      assertScoreRoster(roster, [{ userId: "p1" }, { userId: "p1" }]),
    ).toThrow("Scores must match the players in this game");
  });

  it("rejects a roster member with no score", () => {
    expect(() => assertScoreRoster(roster, [{ userId: "p1" }])).toThrow(
      "Scores must match the players in this game",
    );
  });

  it("rejects a score entry identifying nobody", () => {
    expect(() => assertScoreRoster(roster, [{ userId: "p1" }, {}])).toThrow(
      "Scores must match the players in this game",
    );
  });
});
