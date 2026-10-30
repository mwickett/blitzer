import Link from "next/link";
import {
  BADGE_FAMILIES,
  BADGE_TIERS,
  MILESTONES,
  tierName,
  type Badge,
  type BadgeId,
  type BadgeProgress,
} from "@/lib/scoring/badges";

const integer = new Intl.NumberFormat("en-US");
/** Locked badges previewed under the shelf, as goals to chase. */
const NEXT_UP = 3;
const earnedOn = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

/** A badge's entry in the catalogue. */
export const badgeHref = (id: BadgeId) => `/badges#badge-${id}`;

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
          {earned.map(({ badge, count, total }) => (
            <li key={badge.id}>
              <Link
                href={badgeHref(badge.id)}
                className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-surfaceSubtle"
              >
                <Medal icon={badge.icon} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-brandAccent">
                    {badge.name}
                  </span>
                  <span className="block text-xs text-textMuted">
                    {total !== null
                      ? tierName(count)
                      : count > 1
                        ? `× ${integer.format(count)}`
                        : badge.hint}
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
              <li key={badge.id}>
                <Link
                  href={badgeHref(badge.id)}
                  className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-surfaceSubtle"
                >
                  <Medal icon={badge.icon} locked />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-textBody">
                      {badge.name}
                    </span>
                    <span className="block text-xs text-textMuted">
                      {badge.hint}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Link
        href="/badges"
        className="mt-3 inline-block text-xs font-medium text-brandAccent underline-offset-4 hover:underline"
      >
        How to earn every badge
      </Link>
    </>
  );
}

/** Shown on a finished game to the player who earned badges in it. */
export function GameBadgesEarned({
  badges,
}: {
  badges: { badge: Badge; tier: string | null }[];
}) {
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
        You earned {badges.length === 1 ? "this" : "these"} for the first time,
        or reached a new level, in this game.
      </p>
      <ul className="mt-3 space-y-2">
        {badges.map(({ badge, tier }) => (
          <li key={badge.id}>
            <Link
              href={badgeHref(badge.id)}
              className="flex items-center gap-3 rounded-lg p-1 hover:bg-surfaceSubtle"
            >
              <Medal icon={badge.icon} />
              <span>
                <span className="block text-sm font-semibold">
                  {tier ? `${badge.name} · ${tier}` : badge.name}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {badge.rule}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href="/badges"
        className="mt-3 inline-block text-xs font-medium underline"
      >
        See all badges and how to earn them
      </Link>
    </section>
  );
}

/** Every badge by family, with how to earn it and the player's progress. */
export function BadgeCatalogue({ badges }: { badges: BadgeProgress[] }) {
  return (
    <div className="space-y-8">
      {BADGE_FAMILIES.map((family) => {
        const members = badges.filter((b) => b.badge.family === family.id);
        if (members.length === 0) return null;
        const earned = members.filter((b) => b.count > 0).length;
        return (
          <section key={family.id} aria-labelledby={`family-${family.id}`}>
            <div className="flex items-baseline justify-between gap-3">
              <h2
                id={`family-${family.id}`}
                className="font-display text-lg font-bold text-brandAccent"
              >
                {family.name}
              </h2>
              <span className="text-xs text-textMuted">
                {earned} of {members.length}
              </span>
            </div>
            <p className="text-sm text-textMuted">{family.blurb}</p>
            <ul className="mt-3 space-y-2">
              {members.map((progress) => {
                const { badge, count } = progress;
                return (
                  <li
                    key={badge.id}
                    id={`badge-${badge.id}`}
                    className="flex scroll-mt-24 items-start gap-3 rounded-lg border border-borderWarm p-3 target:ring-2 target:ring-brandAccent"
                  >
                    <Medal icon={badge.icon} locked={count === 0} />
                    <div className="min-w-0 flex-1">
                      <h3
                        className={
                          count > 0
                            ? "text-sm font-semibold text-brandAccent"
                            : "text-sm font-semibold text-textBody"
                        }
                      >
                        {badge.name}
                      </h3>
                      <p className="text-sm text-textBody">{badge.rule}</p>
                      <p className="mt-1 text-xs text-textMuted">
                        <BadgeStatus progress={progress} />
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function EarnedIn({
  label,
  gameId,
  at,
}: {
  label: string;
  gameId: string;
  at: string;
}) {
  return (
    <>
      {label} on {earnedOn.format(new Date(at))}
      {" · "}
      <Link
        href={`/games/${gameId}`}
        className="font-medium underline-offset-4 hover:underline"
      >
        See the game
      </Link>
    </>
  );
}

/** Earned or locked, and for milestones how far to the next tier. */
function BadgeStatus({ progress }: { progress: BadgeProgress }) {
  const { badge, count, firstGameId, firstAt, tiers, total } = progress;
  const milestone = MILESTONES[badge.id];
  if (milestone && total !== null) {
    const latest = tiers.at(-1);
    const next = milestone.levels[tiers.length];
    const toGo =
      next === undefined
        ? null
        : `${integer.format(total)} of ${integer.format(next)} ${milestone.stat} for ${BADGE_TIERS[tiers.length].toLowerCase()}`;
    if (!latest) return <>{toGo}</>;
    return (
      <>
        <EarnedIn
          label={`${tierName(tiers.length)} reached`}
          gameId={latest.gameId}
          at={latest.at}
        />
        {toGo ? ` · ${toGo}` : null}
      </>
    );
  }
  if (count === 0 || !firstGameId || !firstAt) return <>Not earned yet</>;
  return (
    <>
      {count > 1 ? `Earned ${integer.format(count)} times · ` : null}
      <EarnedIn label="First earned" gameId={firstGameId} at={firstAt} />
    </>
  );
}
