import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { getDashboardStats } from "@/server/queries/stats";
import BasicStatBlock from "@/components/BasicStatBlock";
import CircleCtaSection from "./_components/CircleCtaSection";

export default async function Dashboard() {
  const [{ orgId }, stats] = await Promise.all([auth(), getDashboardStats()]);
  const {
    battingAverage,
    scoreExtremes: { highest, lowest },
    cumulativeScore,
    gameRoundExtremes: { longest, shortest },
  } = stats;

  return (
    <section className="border-zinc-500 p-5">
      <CircleCtaSection />
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Personal stats across every Circle and pickup game.
        </p>
        {orgId ? (
          <Link
            href="/circles"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            View Circle standings
          </Link>
        ) : null}
      </div>
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
          value={highest ? `${highest.score} / ${lowest?.score ?? "—"}` : "No rounds yet"}
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
