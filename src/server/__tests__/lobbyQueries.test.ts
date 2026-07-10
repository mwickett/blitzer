import { auth } from "@clerk/nextjs/server";
import prisma from "../db/db";
import { getPickupLobbyForParticipant } from "../queries/lobbies";

jest.mock("server-only", () => ({}));

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn(),
}));

jest.mock("../db/db", () => ({
  __esModule: true,
  default: {
    game: { findUnique: jest.fn() },
  },
}));

describe("pickup lobby queries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as unknown as jest.Mock).mockResolvedValue({
      userId: "clerk-current-user",
    });
  });

  it("returns null instead of throwing for a non-participant", async () => {
    (prisma.game.findUnique as jest.Mock).mockResolvedValue({
      id: "game-id",
      kind: "PICKUP",
      players: [{ user: { clerk_user_id: "clerk-somebody-else" } }],
    });

    await expect(getPickupLobbyForParticipant("game-id")).resolves.toBeNull();
  });
});
