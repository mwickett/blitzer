import { Game, User, Score, Round, GuestUser } from "@prisma/client";
import { updateGameAsFinished } from "@/server/mutations";
import { calculateRoundScore, isWinningScore } from "./validation/gameRules";

export interface GameWithPlayersAndScores extends Game {
  players: {
    id: string;
    gameId: string;
    userId?: string;
    guestId?: string;
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
  username: string;
  isGuest: boolean;
  scoresByRound: number[];
  total: number;
  isInLead?: boolean;
  isWinner?: boolean;
}

export interface ProcessedPlayerScore {
  id: string;
  username: string;
  isGuest: boolean;
  scoresByRound: number[];
  total: number;
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
    };
  });

  return playerScoresMap;
}

// Function to process game scores
function processGameScores(
  rounds: (Round & { scores: Score[] })[],
  playerScoresMap: Record<string, ProcessedPlayerScore>
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

      if (isWinningScore(playerScore.total)) {
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

    // TODO: handle multiple winners
    const winnerId = potentialWinners[0].id;
    if (!game.isFinished) {
      const isGuestWinner = game.players.some(
        (p) =>
          (p.guestId === winnerId || p.userId === winnerId) &&
          p.guestId !== undefined
      );

      await updateGameAsFinished(game.id, winnerId, isGuestWinner);
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
    playerScoresMap
  );

  // Determine the winner
  const winnerId = await determineWinner(game, playersAboveThreshold);

  // Convert to final display scores
  return Object.entries(playerScoresMap).map(
    ([id, { username, isGuest, scoresByRound, total }]) => ({
      id,
      username,
      isGuest,
      scoresByRound,
      total,
      isInLead: leaders.includes(id),
      isWinner: id === winnerId,
    })
  );
}
