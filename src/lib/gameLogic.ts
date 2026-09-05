import type {
  Game,
  User,
  Score,
  Round,
  GuestUser,
} from "@/generated/prisma/client";
import { calculateRoundScore, isWinningScore } from "./validation/gameRules";
import { breakTie } from "./scoring/tiebreak";

type ScoredRound = Pick<Round, "id" | "round" | "revision"> & {
  scores: Pick<
    Score,
    "userId" | "guestId" | "totalCardsPlayed" | "blitzPileRemaining"
  >[];
};

export interface GameWithPlayersAndScores extends Game {
  players: {
    id: string;
    gameId: string;
    userId?: string | null;
    guestId?: string | null;
    accentColor?: string | null;
    user?: User | null;
    guestUser?: GuestUser | null;
  }[];
  rounds: ScoredRound[];
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

export interface GameCompletion {
  winnerId: string | null;
  isGuestWinner: boolean;
  gameShouldBeFinalized: boolean;
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
  player: GameWithPlayersAndScores["players"][0],
): boolean {
  return !!player.guestId;
}

// Function to initialize player scores map
function initializePlayerScoresMap(
  players: GameWithPlayersAndScores["players"],
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
  rounds: ScoredRound[],
  playerScoresMap: Record<string, ProcessedPlayerScore>,
  winThreshold: number,
): {
  leaders: string[];
  playersAboveThreshold: { id: string; total: number }[];
} {
  [...rounds]
    .sort((a, b) => a.round - b.round)
    .forEach((round, roundIndex) => {
      for (const player of Object.values(playerScoresMap)) {
        player.scoresByRound[roundIndex] = 0;
      }
      for (const score of round.scores) {
        const playerId = score.userId || score.guestId;
        const player = playerId ? playerScoresMap[playerId] : undefined;
        if (!player) continue;
        const points = calculateRoundScore(score);
        player.scoresByRound[roundIndex] += points;
        player.total += points;
      }
    });

  // Historical edits retain every round, so leaders and completion must use
  // the final cumulative snapshot rather than a peak reached along the way.
  const totals = Object.values(playerScoresMap);
  const maxScore = Math.max(...totals.map((player) => player.total));
  const leaders = rounds.length
    ? totals
        .filter((player) => player.total === maxScore)
        .map((player) => player.id)
    : [];
  const playersAboveThreshold = rounds.length
    ? totals.filter((player) => isWinningScore(player.total, winThreshold))
    : [];

  return { leaders, playersAboveThreshold };
}

// Function to determine the winner
function determineWinner(
  game: GameWithPlayersAndScores,
  playersAboveThreshold: { id: string; total: number }[],
): string | null {
  if (playersAboveThreshold.length > 0) {
    const highestScore = Math.max(
      ...playersAboveThreshold.map((player) => player.total),
    );
    const potentialWinners = playersAboveThreshold
      .filter((player) => player.total === highestScore)
      .sort((a, b) => a.id.localeCompare(b.id));

    // Tie-breaking: when multiple players have the same highest score,
    // the player with fewer blitz cards remaining in the final round wins.
    let winnerId: string;
    if (potentialWinners.length > 1) {
      const finalRound = [...game.rounds]
        .sort((a, b) => a.round - b.round)
        .at(-1)!;
      const candidates = potentialWinners.map((pw) => {
        const score = finalRound.scores.find(
          (s) => s.userId === pw.id || s.guestId === pw.id,
        );
        return {
          playerId: pw.id,
          blitzPileRemaining: score?.blitzPileRemaining ?? 10,
        };
      });
      winnerId = breakTie(candidates);
    } else {
      winnerId = potentialWinners[0].id;
    }
    return winnerId;
  }
  return null;
}

export function getGameCompletion(
  game: GameWithPlayersAndScores,
): GameCompletion {
  const playerScoresMap = initializePlayerScoresMap(game.players);
  const { playersAboveThreshold } = processGameScores(
    game.rounds,
    playerScoresMap,
    game.winThreshold,
  );
  const winnerId = determineWinner(game, playersAboveThreshold);
  const winnerPlayer = winnerId
    ? game.players.find(
        (player) => player.guestId === winnerId || player.userId === winnerId,
      )
    : undefined;

  return {
    winnerId,
    isGuestWinner: !!winnerPlayer?.guestId,
    gameShouldBeFinalized: !!winnerId && !game.isFinished,
  };
}

// Main function
export default function transformGameData(
  game: GameWithPlayersAndScores,
): DisplayScores[] {
  // Initialize player scores map with all players
  const playerScoresMap = initializePlayerScoresMap(game.players);

  // Process scores from all rounds
  const { leaders, playersAboveThreshold } = processGameScores(
    game.rounds,
    playerScoresMap,
    game.winThreshold,
  );

  // Determine the winner
  const winnerId = determineWinner(game, playersAboveThreshold);

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
    }),
  );
}
