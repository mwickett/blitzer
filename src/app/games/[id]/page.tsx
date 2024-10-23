import ScoreEntry from "./scoreEntry";
import ScoreDisplay from "./scoreDisplay";
import { getGameById } from "@/server/queries";
import { notFound } from "next/navigation";
import GameOver from "./GameOver";
import transformGameData from "@/lib/gameLogic";

export default async function GameView(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const game = await getGameById(params.id);
  if (!game) {
    notFound();
  }
  // TODO: Throw an error if the game is not found

  const displayScores = await transformGameData(game);

  // calculate the current round number
  const currentRoundNumber = game.rounds.length + 1;

  return (
    <section>
      <ScoreDisplay
        displayScores={displayScores}
        numRounds={game.rounds.length}
      />
      {game.isFinished ? (
        <GameOver gameId={game.id} />
      ) : (
        <ScoreEntry game={game} currentRoundNumber={currentRoundNumber} />
      )}
    </section>
  );
}
