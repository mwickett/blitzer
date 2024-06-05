import prisma from "@/prisma/db";
import ScoreEntry from "./scoreEntry";
import ScoreDisplay from "./scoreDisplay";
import { Game, User, Score } from "@prisma/client";

export interface GameWithPlayersAndScores extends Game {
  players: { user: User; gameId: string; userId: string }[];
  scores: Score[];
}

export interface Player {
  userId: string;
  email: string;
  blitzPileRemaining: number;
  totalCardsPlayed: number;
}

export interface DisplayScores {
  userId: string;
  email: string;
  scoresByRound: number[][];
  total: number;
}

export default async function GameView({ params }: { params: { id: string } }) {
  const game = await prisma.game.findUnique({
    where: {
      id: params.id,
    },
    include: {
      players: {
        include: {
          user: true,
        },
      },
      scores: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!game) {
    return (
      <div>
        <h2>No game found.</h2>
      </div>
    );
  }

  // TODO: Handle scoring logic

  const displayScores = transformGameData(game);

  return (
    <section>
      <ScoreDisplay displayScores={displayScores} />
      <ScoreEntry game={game} />
    </section>
  );
}

const transformGameData = (game: GameWithPlayersAndScores): DisplayScores[] => {
  const userScoresMap: {
    [key: string]: {
      email: string;
      scoresByRound: number[][];
      total: number;
    };
  } = {};

  // Number of players in the game
  const numberOfPlayers = game.players.length;

  // Initialize the map with players
  game.players.forEach((player) => {
    userScoresMap[player.userId] = {
      email: player.user.email,
      scoresByRound: [],
      total: 0,
    };
  });

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
    }
  });

  // Transform the map into the output array
  return Object.entries(userScoresMap).map(
    ([userId, { email, scoresByRound, total }]) => ({
      userId,
      email,
      scoresByRound,
      total,
    })
  );
};
