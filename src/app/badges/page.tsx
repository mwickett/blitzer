import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCatalogue } from "@/components/BadgeShelf";
import { requireSignedIn } from "@/server/pageAuth";
import { BADGE_GAMES_WINDOW, getMyBadges } from "@/server/queries/badges";

export const metadata: Metadata = {
  title: "Badges — Blitzer",
  description: "Every Blitzer badge and how to earn it.",
};

export default async function BadgesPage() {
  await requireSignedIn();
  const badges = await getMyBadges();
  const earned = badges.filter((b) => b.count > 0).length;

  return (
    <section className="mx-auto max-w-2xl p-5">
      <h1 className="font-display text-2xl font-bold text-brandAccent">Badges</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {earned} of {badges.length} earned. Badges come from your finished
        games, Circle and pickup alike, counting your latest{" "}
        {BADGE_GAMES_WINDOW}.
      </p>
      <p className="mt-1 text-sm">
        <Link
          href="/dashboard"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Back to your stats
        </Link>
      </p>
      <div className="mt-6">
        <BadgeCatalogue badges={badges} />
      </div>
    </section>
  );
}
