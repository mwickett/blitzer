import { Game, User, Score, Round, GuestUser } from "@/generated/prisma/client";
import { updateGameAsFinished } from "@/server/mutations";
import { calculateRoundScore, isWinningScore } from "./validation/gameRules";

export interface GameWithPlayersAndScores extends Game {
  players: {
    id: string;
    gameId: string;
    userId?: string;
    guestId?: string;
    accentColor?: string | null;
    user?: User;
    guestUser?: GuestUser;
  }[];
  rounds: (Round & { scores: Score[] })[];
}

export interface Player {
  id: string;
  username: string;
  isGuest: boolean;
  blitzPileRemaining: number;
  totalCardsPlayed: number;
}

export interface DisplayScores {
  id: string;
  userId?: string; // Keep for backward compatibility with tests
  username: string;
  isGuest: boolean;
  scoresByRound: number[];
  total: number;
  isInLead?: boolean;
  isWinner?: boolean;
  accentColor?: string | null;
}

export interface ProcessedPlayerScore {
  id: string;
  username: string;
  isGuest: boolean;
  scoresByRound: number[];
  total: number;
  accentColor?: string | null;
}

// Function to get player name - handles both regular users and guest users
function getPlayerName(player: GameWithPlayersAndScores["players"][0]): string {
  if (player.user) {
    return player.user.username;
  } else if (player.guestUser) {
    return player.guestUser.name;
  }
  return "Unknown Player";
}

// Function to get player ID - uses either userId or guestId
function getPlayerId(player: GameWithPlayersAndScores["players"][0]): string {
  return player.userId || player.guestId || player.id;
}

// Function to check if player is a guest
function isGuestPlayer(
  player: GameWithPlayersAndScores["players"][0]
): boolean {
  return !!player.guestId;
}

// Function to initialize player scores map
function initializePlayerScoresMap(
  players: GameWithPlayersAndScores["players"]
): Record<string, ProcessedPlayerScore> {
  const playerScoresMap: Record<string, ProcessedPlayerScore> = {};

  players.forEach((player) => {
    const playerId = getPlayerId(player);
    playerScoresMap[playerId] = {
      id: playerId,
      username: getPlayerName(player),
      isGuest: isGuestPlayer(player),
      scoresByRound: [],
      total: 0,
      accentColor: player.accentColor ?? null,
    };
  });

  return playerScoresMap;
}

// Function to process game scores
function processGameScores(
  rounds: (Round & { scores: Score[] })[],
  playerScoresMap: Record<string, ProcessedPlayerScore>,
  winThreshold: number
): {
  maxScore: number;
  leaders: string[];
  playersAboveThreshold: { id: string; total: number }[];
} {
  let maxScore = -Infinity;
  let leaders: string[] = [];
  const playersAboveThreshold: { id: string; total: number }[] = [];

  rounds.forEach((round, roundIndex) => {
    round.scores.forEach((score) => {
      // Get the player ID from either userId or guestId
      const playerId = score.userId || score.guestId;

      if (!playerId) return; // Skip if no valid ID

      const playerScore = playerScoresMap[playerId];
      if (!playerScore) return; // Skip if player not found in map

      const { totalCardsPlayed, blitzPileRemaining } = score;
      const scoreValue = calculateRoundScore({
        blitzPileRemaining,
        totalCardsPlayed,
      });

      if (!playerScore.scoresByRound[roundIndex]) {
        playerScore.scoresByRound[roundIndex] = scoreValue;
      } else {
        playerScore.scoresByRound[roundIndex] += scoreValue;
      }

      playerScore.total += scoreValue;

      if (playerScore.total > maxScore) {
        maxScore = playerScore.total;
        leaders = [playerId];
      } else if (playerScore.total === maxScore) {
        leaders.push(playerId);
      }

      if (isWinningScore(playerScore.total, winThreshold)) {
        playersAboveThreshold.push({
          id: playerId,
          total: playerScore.total,
        });
      }
    });
  });

  return { maxScore, leaders, playersAboveThreshold };
}

// Function to determine the winner
async function determineWinner(
  game: GameWithPlayersAndScores,
  playersAboveThreshold: { id: string; total: number }[]
): Promise<string | null> {
  if (playersAboveThreshold.length > 0) {
    const highestScore = Math.max(
      ...playersAboveThreshold.map((player) => player.total)
    );
    const potentialWinners = playersAboveThreshold.filter(
      (player) => player.total === highestScore
    );

    // Tie-breaking: when multiple players have the same highest score,
    // the player with fewer blitz cards remaining in the final round wins.
    if (potentialWinners.length > 1) {
      const finalRound = game.rounds[game.rounds.length - 1];
      potentialWinners.sort((a, b) => {
        const aScore = finalRound.scores.find(
          (s) => s.userId === a.id || s.guestId === a.id
        );
        const bScore = finalRound.scores.find(
          (s) => s.userId === b.id || s.guestId === b.id
        );
        return (
          (aScore?.blitzPileRemaining ?? 10) -
          (bScore?.blitzPileRemaining ?? 10)
        );
      });
    }

    const winnerId = potentialWinners[0].id;
    if (!game.isFinished) {
      const winnerPlayer = game.players.find(
        (player) => player.guestId === winnerId || player.userId === winnerId
      );
      const isGuestWinner = !!winnerPlayer?.guestId;

      try {
        await updateGameAsFinished(game.id, winnerId, isGuestWinner);
      } catch {
        // Viewer isn't authenticated or isn't in the right circle —
        // game finalization will happen when a circle member views it.
      }
    }
    return winnerId;
  }
  return null;
}

// Main function
export default async function transformGameData(
  game: GameWithPlayersAndScores
): Promise<DisplayScores[]> {
  // Initialize player scores map with all players
  const playerScoresMap = initializePlayerScoresMap(game.players);

  // Process scores from all rounds
  const { maxScore, leaders, playersAboveThreshold } = processGameScores(
    game.rounds,
    playerScoresMap,
    game.winThreshold
  );

  // Determine the winner
  const winnerId = await determineWinner(game, playersAboveThreshold);

  // Convert to final display scores
  return Object.entries(playerScoresMap).map(
    ([id, { username, isGuest, scoresByRound, total, accentColor }]) => ({
      id,
      userId: id, // Add userId for backward compatibility with tests
      username,
      isGuest,
      scoresByRound,
      total,
      isInLead: leaders.includes(id),
      isWinner: id === winnerId,
      accentColor,
    })
  );
}
