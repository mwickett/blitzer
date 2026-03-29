import transformGameData, { GameWithPlayersAndScores } from "../gameLogic";
import { Game, User, Round, Score } from "@/generated/prisma/client";

// Mock the updateGameAsFinished function
jest.mock("@/server/mutations", () => ({
  updateGameAsFinished: jest.fn(),
}));

describe("transformGameData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  // Helper function to create a mock game with players and scores
  const createMockGame = (
    players: Array<{ userId: string; username: string }>,
    rounds: Array<{
      roundNumber: number;
      scores: Array<{
        userId: string;
        blitzPileRemaining: number;
        totalCardsPlayed: number;
      }>;
    }>
  ): GameWithPlayersAndScores => {
    const mockGame: GameWithPlayersAndScores = {
      id: "test-game-id",
      createdAt: new Date(),
      endedAt: null,
      isFinished: false,
      winnerId: null,
      winThreshold: 75,
      players: players.map((player) => ({
        userId: player.userId,
        gameId: "test-game-id",
        user: {
          id: player.userId,
          clerk_user_id: `clerk-${player.userId}`,
          email: `${player.username}@test.com`,
          username: player.username,
          avatarUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as User,
      })),
      rounds: rounds.map((round, index) => ({
        id: `round-${index}`,
        gameId: "test-game-id",
        round: round.roundNumber,
        createdAt: new Date(),
        scores: round.scores.map((score) => ({
          id: `score-${score.userId}-${round.roundNumber}`,
          userId: score.userId,
          roundId: `round-${index}`,
          blitzPileRemaining: score.blitzPileRemaining,
          totalCardsPlayed: score.totalCardsPlayed,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      })),
    };

    return mockGame;
  };

  it("should correctly calculate scores for a simple game", async () => {
    const mockGame = createMockGame(
      [
        { userId: "user1", username: "Player 1" },
        { userId: "user2", username: "Player 2" },
      ],
      [
        {
          roundNumber: 1,
          scores: [
            { userId: "user1", blitzPileRemaining: 5, totalCardsPlayed: 20 },
            { userId: "user2", blitzPileRemaining: 3, totalCardsPlayed: 15 },
          ],
        },
      ]
    );

    const result = await transformGameData(mockGame);

    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: "user1",
          username: "Player 1",
          scoresByRound: [10], // 20 - (5 * 2) = 10
          total: 10,
          isInLead: true,
        }),
        expect.objectContaining({
          userId: "user2",
          username: "Player 2",
          scoresByRound: [9], // 15 - (3 * 2) = 9
          total: 9,
          isInLead: false,
        }),
      ])
    );
  });

  it("should handle multiple rounds and accumulate scores correctly", async () => {
    const mockGame = createMockGame(
      [
        { userId: "user1", username: "Player 1" },
        { userId: "user2", username: "Player 2" },
      ],
      [
        {
          roundNumber: 1,
          scores: [
            { userId: "user1", blitzPileRemaining: 5, totalCardsPlayed: 20 },
            { userId: "user2", blitzPileRemaining: 3, totalCardsPlayed: 15 },
          ],
        },
        {
          roundNumber: 2,
          scores: [
            { userId: "user1", blitzPileRemaining: 2, totalCardsPlayed: 25 },
            { userId: "user2", blitzPileRemaining: 0, totalCardsPlayed: 30 },
          ],
        },
      ]
    );

    const result = await transformGameData(mockGame);

    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: "user1",
          scoresByRound: [10, 21], // [20-(5*2), 25-(2*2)]
          total: 31,
          isInLead: false,
        }),
        expect.objectContaining({
          userId: "user2",
          scoresByRound: [9, 30], // [15-(3*2), 30-(0*2)]
          total: 39,
          isInLead: true,
        }),
      ])
    );
  });

  it("should determine winner when score is above threshold (75)", async () => {
    const mockGame = createMockGame(
      [
        { userId: "user1", username: "Player 1" },
        { userId: "user2", username: "Player 2" },
      ],
      [
        {
          roundNumber: 1,
          scores: [
            { userId: "user1", blitzPileRemaining: 0, totalCardsPlayed: 40 },
            { userId: "user2", blitzPileRemaining: 1, totalCardsPlayed: 35 },
          ],
        },
        {
          roundNumber: 2,
          scores: [
            { userId: "user1", blitzPileRemaining: 0, totalCardsPlayed: 40 },
            { userId: "user2", blitzPileRemaining: 2, totalCardsPlayed: 38 },
          ],
        },
      ]
    );

    const result = await transformGameData(mockGame);

    const winner = result.find((player) => player.isWinner);
    expect(winner).toBeDefined();
    expect(winner?.userId).toBe("user1");
    expect(winner?.total).toBeGreaterThanOrEqual(75);
  });

  it("should handle tied scores correctly", async () => {
    const mockGame = createMockGame(
      [
        { userId: "user1", username: "Player 1" },
        { userId: "user2", username: "Player 2" },
      ],
      [
        {
          roundNumber: 1,
          scores: [
            { userId: "user1", blitzPileRemaining: 2, totalCardsPlayed: 20 },
            { userId: "user2", blitzPileRemaining: 2, totalCardsPlayed: 20 },
          ],
        },
      ]
    );

    const result = await transformGameData(mockGame);

    const leadPlayers = result.filter((player) => player.isInLead);
    expect(leadPlayers).toHaveLength(2);
    expect(leadPlayers[0].total).toBe(leadPlayers[1].total);
  });

  describe("tie-breaking", () => {
    it("should break ties by fewest blitz cards remaining in the final round", async () => {
      // user1 has MORE blitz cards remaining in the final round (worse)
      // user2 has FEWER blitz cards remaining in the final round (better)
      // Without tie-breaking, user1 would win because it appears first in the array.
      // With proper tie-breaking, user2 should win.
      const mockGame = createMockGame(
        [
          { userId: "user1", username: "Player 1" },
          { userId: "user2", username: "Player 2" },
        ],
        [
          {
            roundNumber: 1,
            scores: [
              { userId: "user1", blitzPileRemaining: 0, totalCardsPlayed: 25 },
              { userId: "user2", blitzPileRemaining: 0, totalCardsPlayed: 25 },
            ],
          },
          {
            roundNumber: 2,
            scores: [
              { userId: "user1", blitzPileRemaining: 0, totalCardsPlayed: 25 },
              { userId: "user2", blitzPileRemaining: 0, totalCardsPlayed: 25 },
            ],
          },
          {
            roundNumber: 3,
            scores: [
              // Player 1: 28 points (blitzPile=2, cards=32 -> 32-4=28). Total = 78
              { userId: "user1", blitzPileRemaining: 2, totalCardsPlayed: 32 },
              // Player 2: 28 points (blitzPile=0, cards=28). Total = 78
              { userId: "user2", blitzPileRemaining: 0, totalCardsPlayed: 28 },
            ],
          },
        ]
      );

      const result = await transformGameData(mockGame);

      // Both players should be at 78
      const player1 = result.find((p) => p.userId === "user1");
      const player2 = result.find((p) => p.userId === "user2");
      expect(player1?.total).toBe(78);
      expect(player2?.total).toBe(78);

      // Player 2 should win because they had fewer blitz cards remaining (0 vs 2) in the final round
      expect(player2?.isWinner).toBe(true);
      expect(player1?.isWinner).toBe(false);
    });
  });

  it("marks guest winners correctly when finishing a game", async () => {
    const mockGame: GameWithPlayersAndScores = {
      id: "guest-game-id",
      createdAt: new Date(),
      endedAt: null,
      isFinished: false,
      winnerId: null,
      winThreshold: 75,
      players: [
        {
          id: "gp-guest",
          gameId: "guest-game-id",
          guestId: "guest-1",
          guestUser: {
            id: "guest-1",
            name: "Guest Winner",
            ownerId: "owner-1",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        {
          id: "gp-user",
          gameId: "guest-game-id",
          userId: "user-1",
          user: {
            id: "user-1",
            clerk_user_id: "clerk-user-1",
            email: "user1@test.com",
            username: "Player 1",
            avatarUrl: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as User,
        },
      ],
      rounds: [
        {
          id: "round-1",
          gameId: "guest-game-id",
          round: 1,
          createdAt: new Date(),
          scores: [
            {
              id: "score-guest",
              userId: null,
              guestId: "guest-1",
              roundId: "round-1",
              blitzPileRemaining: 0,
              totalCardsPlayed: 80,
              createdAt: new Date(),
              updatedAt: new Date(),
            } as Score,
            {
              id: "score-user",
              userId: "user-1",
              guestId: null,
              roundId: "round-1",
              blitzPileRemaining: 0,
              totalCardsPlayed: 20,
              createdAt: new Date(),
              updatedAt: new Date(),
            } as Score,
          ],
        } as Round & { scores: Score[] },
      ],
    };

    const result = await transformGameData(mockGame);
    const updateGameAsFinished = jest.requireMock("@/server/mutations")
      .updateGameAsFinished as jest.Mock;

    expect(result.find((player) => player.id === "guest-1")?.isWinner).toBe(
      true
    );
    expect(updateGameAsFinished).toHaveBeenCalledWith(
      "guest-game-id",
      "guest-1",
      true
    );
  });

});
