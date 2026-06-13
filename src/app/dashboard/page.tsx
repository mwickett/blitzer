import { Suspense } from "react";
import {
  getPlayerBattingAverage,
  getHighestAndLowestScore,
  getCumulativeScore,
  getLongestAndShortestGamesByRounds,
} from "@/server/queries";
import BasicStatBlock from "@/components/BasicStatBlock";
import InviteBannerSection from "./_components/InviteBannerSection";

export default async function Dashboard() {
  // The four stats are independent — fetch them in parallel
  const [
    battingAverage,
    { highest, lowest },
    cumulativeScore,
    { longest, shortest },
  ] = await Promise.all([
    getPlayerBattingAverage(),
    getHighestAndLowestScore(),
    getCumulativeScore(),
    getLongestAndShortestGamesByRounds(),
  ]);

  return (
    <section className="border-zinc-500 p-5">
      <Suspense fallback={null}>
        <InviteBannerSection />
      </Suspense>
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
          label="Longest / Shortest Game (Rounds)"
          value={`${longest ? longest.roundCount : 0} / ${shortest ? shortest.roundCount : 0}`}
        />
      </div>
    </section>
  );
}
