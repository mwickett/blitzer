import ScoreEntry from "./scoreEntry";
import ScoreDisplay from "./scoreDisplay";
import { Game, User, Score } from "@prisma/client";
import { getGameById } from "@/server/queries";
import { updateGameAsFinished } from "@/server/mutations";
import { notFound } from "next/navigation";
import GameOver from "./GameOver";

export interface GameWithPlayersAndScores extends Game {
  players: { user: User; gameId: string; userId: string }[];
  scores: Score[];
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
  scoresByRound: number[][];
  total: number;
  isInLead?: boolean;
  isWinner?: boolean;
}

export default async function GameView({ params }: { params: { id: string } }) {
  const game = await getGameById(params.id);
  if (!game) {
    notFound();
  }
  // TODO: Throw an error if the game is not found

  const displayScores = await transformGameData(game);

  return (
    <section>
      <ScoreDisplay displayScores={displayScores} />
      {game.isFinished ? (
        <GameOver gameId={game.id} />
      ) : (
        <ScoreEntry game={game} />
      )}
    </section>
  );
}

// This function is doing _a lot of work_ 😬
// needs some refactoring / cleanup
const transformGameData = async (
  game: GameWithPlayersAndScores
): Promise<DisplayScores[]> => {
  const userScoresMap: {
    [key: string]: {
      username: string;
      scoresByRound: number[][];
      total: number;
    };
  } = {};

  // Number of players in the game
  const numberOfPlayers = game.players.length;

  // Initialize the map with players
  game.players.forEach((player) => {
    userScoresMap[player.userId] = {
      username: player.user.username,
      scoresByRound: [],
      total: 0,
    };
  });

  let maxScore = -Infinity;
  let leaders: string[] = [];
  const playersAboveThreshold: { userId: string; total: number }[] = [];

  // Populate the scores by round and calculate the total
  game.scores.forEach((score, index) => {
    const userScore = userScoresMap[score.userId];
    const { totalCardsPlayed, blitzPileRemaining } = score;
    if (userScore) {
      const scoreValue = -(blitzPileRemaining * 2) + totalCardsPlayed;
      const roundIndex = Math.floor(index / numberOfPlayers);

      // Ensure the scoresByRound array has enough rounds
      if (!userScore.scoresByRound[roundIndex]) {
        userScore.scoresByRound[roundIndex] = [];
      }

      userScore.scoresByRound[roundIndex].push(scoreValue);
      userScore.total += scoreValue;

      // Update the current leaders
      if (userScore.total > maxScore) {
        maxScore = userScore.total;
        leaders = [score.userId];
      } else if (userScore.total === maxScore) {
        leaders.push(score.userId);
      }

      // Check if the player is above the threshold
      if (userScore.total >= 75) {
        playersAboveThreshold.push({
          userId: score.userId,
          total: userScore.total,
        });
      }
    }
  });

  // Determine the winner if there are players above the threshold
  let winnerId = null;
  if (playersAboveThreshold.length > 0) {
    const highestScore = Math.max(
      ...playersAboveThreshold.map((player) => player.total)
    );
    const potentialWinners = playersAboveThreshold.filter(
      (player) => player.total === highestScore
    );
    if (potentialWinners.length === 1) {
      winnerId = potentialWinners[0].userId;
    } else {
      winnerId = potentialWinners[0].userId; // i need to check the rules on ties
    }
    if (!game.isFinished) {
      await updateGameAsFinished(game.id, winnerId);
    }
  }

  // Transform the map into the output array
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
};
