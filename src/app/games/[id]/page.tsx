import ScoreEntry from "./scoreEntry";
import ScoreDisplay from "./scoreDisplay";
import { getGameById } from "@/server/queries";
import { notFound } from "next/navigation";
import transformGameData from "@/lib/gameLogic";
import { isScoreChartsEnabled } from "@/featureFlags";

export default async function GameView(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const game = await getGameById(params.id);
  const showCharts = await isScoreChartsEnabled();
  if (!game) {
    notFound();
  }

  const displayScores = await transformGameData(game);

  // calculate the current round number
  const currentRoundNumber = game.rounds.length + 1;

  return (
    <section>
      <ScoreDisplay
        displayScores={displayScores}
        numRounds={game.rounds.length}
        gameId={game.id}
        isFinished={game.isFinished}
        showCharts={showCharts}
      />
      <ScoreEntry
        game={game}
        currentRoundNumber={currentRoundNumber}
        displayScores={displayScores}
      />
    </section>
  );
}
