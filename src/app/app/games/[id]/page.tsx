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

  return (
    <section>
      <ScoreDisplay game={game} />
      <ScoreEntry game={game} />
    </section>
  );
}
