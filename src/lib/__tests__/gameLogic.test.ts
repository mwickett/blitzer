import transformGameData, { GameWithPlayersAndScores } from "../gameLogic";
import { Game, User, Round, Score } from "@prisma/client";

// Mock the updateGameAsFinished function
jest.mock("@/server/mutations", () => ({
  updateGameAsFinished: jest.fn(),
}));

describe("transformGameData", () => {
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
      players: players.map((player) => ({
        id: `player-${player.userId}`,
        userId: player.userId,
        gameId: "test-game-id",
        cardColour: null,
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
          guestId: null,
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
});
