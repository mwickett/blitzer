import Link from "next/link";
import { getDashboard } from "@/server/queries/stats";
import { requireSignedIn } from "@/server/pageAuth";
import CircleCtaSection from "./_components/CircleCtaSection";
import DashboardGrid from "./_components/DashboardGrid";

function FirstGamePrompt() {
  return (
    <div className="mb-4 rounded-xl bg-brandAccent p-5 text-brand">
      <p className="font-display text-xl font-bold">Your stats start with your first game.</p>
      <p className="mt-1 text-sm opacity-80">
        Score a game of Dutch Blitz and this page fills up with your win rate,
        streaks, rivals, and best hands.
      </p>
      <Link
        href="/games/new"
        className="mt-3 inline-block rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brandAccent"
      >
        Start a game
      </Link>
    </div>
  );
}

export default async function Dashboard() {
  const { orgId } = await requireSignedIn();
  const { stats, layout } = await getDashboard();

  return (
    <section className="p-5">
      <CircleCtaSection />
      <DashboardGrid
        stats={stats}
        initialLayout={layout}
        intro={stats.games.gamesCount === 0 ? <FirstGamePrompt /> : null}
        heading={
          <>
            <h1 className="font-display text-2xl font-bold text-brandAccent">Your stats</h1>
            <p className="text-sm text-muted-foreground">
              Personal stats across every Circle and pickup game.
              {orgId ? (
                <>
                  {" "}
                  <Link
                    href="/circles"
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    View Circle standings
                  </Link>
                </>
              ) : null}
            </p>
          </>
        }
      />
    </section>
  );
}
