import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { getDashboard } from "@/server/queries/stats";
import CircleCtaSection from "./_components/CircleCtaSection";
import DashboardGrid from "./_components/DashboardGrid";

export default async function Dashboard() {
  const [{ orgId }, { stats, layout }] = await Promise.all([auth(), getDashboard()]);

  return (
    <section className="p-5">
      <CircleCtaSection />
      <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-brandAccent">Your stats</h1>
          <p className="text-sm text-muted-foreground">
            Personal stats across every Circle and pickup game.
          </p>
        </div>
        {orgId ? (
          <Link
            href="/circles"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            View Circle standings
          </Link>
        ) : null}
      </div>
      {stats.games.gamesCount === 0 ? (
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
      ) : null}
      <DashboardGrid stats={stats} initialLayout={layout} />
    </section>
  );
}
