import { Game, User, Score, Round } from "@prisma/client";
import { updateGameAsFinished } from "@/server/mutations";
import { calculateRoundScore, isWinningScore } from "./validation/gameRules";

export interface GameWithPlayersAndScores extends Game {
  players: { user: User; gameId: string; userId: string }[];
  rounds: (Round & { scores: Score[] })[];
}

export interface Player {
  userId: string;
  username: string;
  blitzPileRemaining: number;
  totalCardsPlayed: number;
}

export interface DisplayScores {
  userId: string;
  username: string;
  scoresByRound: number[];
  total: number;
  isInLead?: boolean;
  isWinner?: boolean;
}

export interface ProcessedPlayerScore {
  userId: string;
  username: string;
  scoresByRound: number[];
  total: number;
}

// Function to initialize user scores map
function initializeUserScoresMap(
  players: { userId: string; username: string }[]
): Record<string, ProcessedPlayerScore> {
  const userScoresMap: Record<string, ProcessedPlayerScore> = {};
  players.forEach((player) => {
    userScoresMap[player.userId] = {
      userId: player.userId,
      username: player.username,
      scoresByRound: [],
      total: 0,
    };
  });
  return userScoresMap;
}

// Function to process game scores
function processGameScores(
  rounds: (Round & { scores: Score[] })[],
  userScoresMap: Record<string, ProcessedPlayerScore>
): {
  maxScore: number;
  leaders: string[];
  playersAboveThreshold: { userId: string; total: number }[];
} {
  let maxScore = -Infinity;
  let leaders: string[] = [];
  const playersAboveThreshold: { userId: string; total: number }[] = [];

  rounds.forEach((round, roundIndex) => {
    round.scores.forEach((score) => {
      const userScore = userScoresMap[score.userId];
      const { totalCardsPlayed, blitzPileRemaining } = score;

      if (userScore) {
        const scoreValue = calculateRoundScore({
          blitzPileRemaining,
          totalCardsPlayed,
        });

        if (!userScore.scoresByRound[roundIndex]) {
          userScore.scoresByRound[roundIndex] = scoreValue;
        } else {
          userScore.scoresByRound[roundIndex] += scoreValue;
        }

        userScore.total += scoreValue;

        if (userScore.total > maxScore) {
          maxScore = userScore.total;
          leaders = [score.userId];
        } else if (userScore.total === maxScore) {
          leaders.push(score.userId);
        }

        if (isWinningScore(userScore.total)) {
          playersAboveThreshold.push({
            userId: score.userId,
            total: userScore.total,
          });
        }
      }
    });
  });

  return { maxScore, leaders, playersAboveThreshold };
}

// Function to determine the winner
async function determineWinner(
  game: GameWithPlayersAndScores,
  playersAboveThreshold: { userId: string; total: number }[]
): Promise<string | null> {
  if (playersAboveThreshold.length > 0) {
    const highestScore = Math.max(
      ...playersAboveThreshold.map((player) => player.total)
    );
    const potentialWinners = playersAboveThreshold.filter(
      (player) => player.total === highestScore
    );

    // TODO: handle multiple winners
    let winnerId = potentialWinners[0].userId;
    if (!game.isFinished) {
      await updateGameAsFinished(game.id, winnerId);
    }
    return winnerId;
  }
  return null;
}

// Main function
export default async function transformGameData(
  game: GameWithPlayersAndScores
): Promise<DisplayScores[]> {
  const players = game.players.map((player) => ({
    userId: player.userId,
    username: player.user.username,
  }));
  const userScoresMap = initializeUserScoresMap(players);

  const { maxScore, leaders, playersAboveThreshold } = processGameScores(
    game.rounds,
    userScoresMap
  );

  const winnerId = await determineWinner(game, playersAboveThreshold);

  return Object.entries(userScoresMap).map(
    ([userId, { username, scoresByRound, total }]) => ({
      userId,
      username,
      scoresByRound,
      total,
      isInLead: leaders.includes(userId),
      isWinner: userId === winnerId,
    })
  );
}
