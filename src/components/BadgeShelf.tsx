import Link from "next/link";
import type { BadgeProgress } from "@/lib/scoring/badges";

const integer = new Intl.NumberFormat("en-US");
/** Locked badges previewed under the shelf, as goals to chase. */
const NEXT_UP = 3;

function Medal({ icon, locked }: { icon: string; locked?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={
        locked
          ? "grid size-11 shrink-0 place-items-center rounded-full border-2 border-dashed border-borderWarm text-lg grayscale opacity-50"
          : "grid size-11 shrink-0 place-items-center rounded-full border-2 border-borderWarm bg-surfaceSubtle text-xl"
      }
    >
      {icon}
    </span>
  );
}

/** The player's earned badges, with a few locked ones to aim for. */
export function BadgeShelf({ badges }: { badges: BadgeProgress[] }) {
  const earned = badges.filter((b) => b.count > 0);
  const locked = badges.filter((b) => b.count === 0).slice(0, NEXT_UP);

  return (
    <>
      <p className="text-xs text-textMuted">
        {earned.length
          ? `${earned.length} of ${badges.length} earned`
          : "No badges yet. Finish a game to earn your first."}
      </p>
      {earned.length ? (
        <ul
          className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"
          aria-label="Earned badges"
        >
          {earned.map(({ badge, count, firstGameId }) => (
            <li key={badge.id}>
              <Link
                href={`/games/${firstGameId}`}
                className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-surfaceSubtle"
              >
                <Medal icon={badge.icon} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-brandAccent">
                    {badge.name}
                  </span>
                  <span className="block text-xs text-textMuted">
                    {count > 1 ? `× ${integer.format(count)}` : badge.hint}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {locked.length ? (
        <div className="mt-auto pt-3">
          <h3 className="text-xs font-medium text-textMuted">Up next</h3>
          <ul
            className="mt-1 grid gap-2 sm:grid-cols-3"
            aria-label="Badges to earn"
          >
            {locked.map(({ badge }) => (
              <li key={badge.id} className="flex items-center gap-2 p-1.5">
                <Medal icon={badge.icon} locked />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-textBody">
                    {badge.name}
                  </span>
                  <span className="block text-xs text-textMuted">
                    {badge.hint}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

/** Shown on a finished game to the player who earned badges in it. */
export function GameBadgesEarned({ badges }: { badges: BadgeProgress[] }) {
  if (badges.length === 0) return null;
  return (
    <section
      aria-labelledby="game-badges-heading"
      className="mx-auto mt-6 max-w-2xl rounded-lg border bg-card p-4"
    >
      <h2 id="game-badges-heading" className="text-lg font-semibold">
        {badges.length === 1 ? "New badge" : "New badges"}
      </h2>
      <p className="text-sm text-muted-foreground">
        You earned {badges.length === 1 ? "this" : "these"} for the first time
        in this game.
      </p>
      <ul className="mt-3 space-y-2">
        {badges.map(({ badge }) => (
          <li key={badge.id} className="flex items-center gap-3">
            <Medal icon={badge.icon} />
            <span>
              <span className="block text-sm font-semibold">{badge.name}</span>
              <span className="block text-xs text-muted-foreground">
                {badge.hint}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <Link
        href="/dashboard"
        className="mt-3 inline-block text-xs font-medium underline"
      >
        See all your badges
      </Link>
    </section>
  );
}
