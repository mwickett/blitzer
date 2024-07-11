import ScoreEntry from "./scoreEntry";
import ScoreDisplay from "./scoreDisplay";
import { getGameById } from "@/server/queries";
import { notFound } from "next/navigation";
import GameOver from "./GameOver";
import transformGameData from "@/lib/gameLogic";

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
