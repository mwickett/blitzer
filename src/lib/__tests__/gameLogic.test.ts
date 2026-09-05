import transformGameData, {
  ScoredGame,
  getGameCompletion,
} from "../gameLogic";

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
    }>,
    winThreshold = 75
  ): ScoredGame => {
    const mockGame: ScoredGame = {
      isFinished: false,
      winThreshold,
      players: players.map((player) => ({
        id: `game-player-${player.userId}`,
        userId: player.userId,
        guestId: null,
        accentColor: null,
        user: { username: player.username },
        guestUser: null,
      })),
      rounds: rounds.map((round) => ({
        round: round.roundNumber,
        scores: round.scores.map((score) => ({ ...score, guestId: null })),
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
          id: "user1",
          username: "Player 1",
          scoresByRound: [10], // 20 - (5 * 2) = 10
          total: 10,
          isInLead: true,
        }),
        expect.objectContaining({
          id: "user2",
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
          id: "user1",
          scoresByRound: [10, 21], // [20-(5*2), 25-(2*2)]
          total: 31,
          isInLead: false,
        }),
        expect.objectContaining({
          id: "user2",
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
    expect(winner?.id).toBe("user1");
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
      const player1 = result.find((p) => p.id === "user1");
      const player2 = result.find((p) => p.id === "user2");
      expect(player1?.total).toBe(78);
      expect(player2?.total).toBe(78);

      // Player 2 should win because they had fewer blitz cards remaining (0 vs 2) in the final round
      expect(player2?.isWinner).toBe(true);
      expect(player1?.isWinner).toBe(false);
    });
  });

  it("identifies unfinished custom-threshold games that need finalization", () => {
    const mockGame = createMockGame(
      [
        { userId: "user1", username: "Player 1" },
        { userId: "user2", username: "Player 2" },
      ],
      [
        {
          roundNumber: 1,
          scores: [
            { userId: "user1", blitzPileRemaining: 0, totalCardsPlayed: 52 },
            { userId: "user2", blitzPileRemaining: 3, totalCardsPlayed: 20 },
          ],
        },
      ],
      50
    );

    expect(getGameCompletion(mockGame)).toEqual({
      winnerId: "user1",
      isGuestWinner: false,
      gameShouldBeFinalized: true,
    });
  });

  it("marks guest winners correctly without mutating games", async () => {
    const mockGame: ScoredGame = {
      isFinished: false,
      winThreshold: 75,
      players: [
        { id: "gp-guest", guestId: "guest-1", userId: null, accentColor: null, user: null, guestUser: { name: "Guest Winner" } },
        { id: "gp-user", userId: "user-1", guestId: null, accentColor: null, user: { username: "Player 1" }, guestUser: null },
      ],
      rounds: [{
        round: 1,
        scores: [
          { userId: null, guestId: "guest-1", blitzPileRemaining: 0, totalCardsPlayed: 80 },
          { userId: "user-1", guestId: null, blitzPileRemaining: 0, totalCardsPlayed: 20 },
        ],
      }],
    };

    const result = await transformGameData(mockGame);

    expect(result.find((player) => player.id === "guest-1")?.isWinner).toBe(
      true
    );
    expect(getGameCompletion(mockGame)).toEqual({
      winnerId: "guest-1",
      isGuestWinner: true,
      gameShouldBeFinalized: true,
    });
  });

  it("uses final cumulative totals for leaders after a negative round", () => {
    const game = createMockGame(
      [{ userId: "a", username: "A" }, { userId: "b", username: "B" }],
      [
        { roundNumber: 1, scores: [
          { userId: "a", totalCardsPlayed: 40, blitzPileRemaining: 0 },
          { userId: "b", totalCardsPlayed: 10, blitzPileRemaining: 0 },
        ] },
        { roundNumber: 2, scores: [
          { userId: "a", totalCardsPlayed: 0, blitzPileRemaining: 10 },
          { userId: "b", totalCardsPlayed: 20, blitzPileRemaining: 0 },
        ] },
      ],
    );
    expect(transformGameData(game).filter((p) => p.isInLead).map((p) => p.id)).toEqual(["b"]);
  });

  it("reopens an edited history when final totals fall below the threshold", () => {
    const game = createMockGame(
      [{ userId: "a", username: "A" }, { userId: "b", username: "B" }],
      [30, 30, -20].map((points, index) => ({ roundNumber: index + 1, scores: [
        { userId: "a", totalCardsPlayed: Math.max(0, points), blitzPileRemaining: points < 0 ? 10 : 0 },
        { userId: "b", totalCardsPlayed: 4, blitzPileRemaining: 0 },
      ] })),
      50,
    );
    expect(getGameCompletion(game).winnerId).toBeNull();
    expect(transformGameData(game).every((p) => !p.isWinner)).toBe(true);
  });

});
