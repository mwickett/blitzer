import prisma from "@/db";
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

interface Output {
  userId: string;
  email: string | null;
  scores: number[];
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

  const scoreMatrix = createScoreMatrix(game);

  console.log(scoreMatrix);
  return (
    <section>
      <ScoreDisplay game={game} />
      <ScoreEntry game={game} />
    </section>
  );
}

const createScoreMatrix = (game: GameWithPlayersAndScores): Output[] => {
  // Do I need to encode the concept of rounds?

  const userScoresMap: {
    [key: string]: { email: string | null; scores: number[]; total: number };
  } = {};

  // Initialize the map with players
  game.players.forEach((player) => {
    userScoresMap[player.userId] = {
      email: player.user.email,
      scores: [],
      total: 0,
    };
  });

  // Populate the scores and calculate the total
  game.scores.forEach((score) => {
    const userScore = userScoresMap[score.userId];
    const { blitzPileRemaining, totalCardsPlayed } = score;
    if (userScore) {
      const scoreValue = -(blitzPileRemaining * 2) + totalCardsPlayed;
      userScore.scores.push(scoreValue);
      userScore.total += scoreValue;
    }
  });

  // Transform the map into the output array
  return Object.entries(userScoresMap).map(
    ([userId, { email, scores, total }]) => ({
      userId,
      email,
      scores,
      total,
    })
  );
};
