import prisma from "@/db";
import { ScoreEntry } from "./scoreEntry";

export default async function Game({ params }: { params: { id: string } }) {
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
      scores: true,
    },
  });

  if (!game) {
    return (
      <div>
        <h2>No game found.</h2>
      </div>
    );
  }

  console.log(game);

  // TODO: Handle scoring logic

  return (
    <section>
      <div>
        <pre>{JSON.stringify(game.scores, null, 2)}</pre>
      </div>
      <ScoreEntry game={game} />
    </section>
  );
}
