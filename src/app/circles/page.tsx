import { getCircleStandings } from "@/server/queries/circleStandings";
import { getCircleRecords } from "@/server/queries/circleRecords";
import { CircleRecordBook } from "@/components/CircleRecords";
import {
  CircleHeadToHeadList,
  CircleStandingsTable,
} from "@/components/CircleStandings";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requireCircle } from "@/server/pageAuth";

export default async function CircleStandingsPage() {
  await requireCircle();
  const [{ standings, headToHead }, records] = await Promise.all([
    getCircleStandings(),
    getCircleRecords(),
  ]);

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Circle standings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All-time results for games in your active Circle. Pickup and legacy
            games stay on your personal dashboard.
          </p>
        </div>
        <Button asChild>
          <Link href="/games/new?type=circle">New Circle game</Link>
        </Button>
      </div>

      <div className="space-y-8">
        <CircleStandingsTable standings={standings} />
        <CircleRecordBook records={records} />
        <CircleHeadToHeadList pairs={headToHead} />
      </div>
    </main>
  );
}
