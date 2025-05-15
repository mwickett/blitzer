import {
  getPlayerBattingAverage,
  getHighestAndLowestScore,
  getCumulativeScore,
  getLongestAndShortestGamesByRounds,
} from "@/server/queries";

import BasicStatBlock from "@/components/BasicStatBlock";

export default async function Dashboard() {
  const battingAverage = await getPlayerBattingAverage();
  const { highest, lowest } = await getHighestAndLowestScore();
  const cumulativeScore = await getCumulativeScore();
  const { longest, shortest } = await getLongestAndShortestGamesByRounds();

  return (
    <section className="border-zinc-500 p-5">
      <div className="mb-4">
        <BasicStatBlock
          label="Batting Average"
          value={battingAverage.battingAverage}
          details={
            <div>
              <div className="flex items-center justify-between">
                <div className="text-base text-gray-400">Rounds Won</div>
                <div className="text-base font-medium">
                  {battingAverage.totalHandsWon}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-base text-gray-400">Rounds Played</div>
                <div className="text-base font-medium">
                  {battingAverage.totalHandsPlayed}
                </div>
              </div>
            </div>
          }
        />
      </div>
      <div className="mb-4">
        <BasicStatBlock
          label="High / Low Single Hand"
          value={`${highest?.score ?? null} / ${lowest?.score ?? null}`}
        />
      </div>
      <div className="mb-4">
        <BasicStatBlock
          label="Total Cumulative Score"
          value={cumulativeScore.toString()}
        />
      </div>
      <div className="mb-4">
        <BasicStatBlock
          label="Longest Game"
          value={longest ? longest.roundCount.toString() : "0"}
          details={
            longest && (
              <div className="flex items-center justify-between">
                <div className="text-base text-gray-400">Status</div>
                <div className="text-base font-medium">
                  {longest.isFinished ? "Completed" : "In Progress"}
                </div>
              </div>
            )
          }
        />
      </div>
      <div className="mb-4">
        <BasicStatBlock
          label="Shortest Game"
          value={shortest ? shortest.roundCount.toString() : "0"}
          details={
            shortest && (
              <div className="flex items-center justify-between">
                <div className="text-base text-gray-400">Status</div>
                <div className="text-base font-medium">
                  {shortest.isFinished ? "Completed" : "In Progress"}
                </div>
              </div>
            )
          }
        />
      </div>
    </section>
  );
}
