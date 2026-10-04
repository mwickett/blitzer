"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardCardId } from "@/lib/dashboardLayout";
import type { DashboardStats } from "@/server/queries/stats";
import type { RecentGame, SpreadGame } from "@/server/queries/playerStats";
import { BigNumber, EmptyNote, StatRow } from "./StatCard";
import { cn } from "@/lib/utils";
import { DeckIcon } from "@/components/scoring/DeckIcon";
import { deckLabel } from "@/lib/scoring/decks";

const WIN = "#2a6517";
const LOSS = "#b91c1c";
const NEUTRAL = "#b8a08c";

const integer = new Intl.NumberFormat("en-US");
const oneDecimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

function ordinal(n: number) {
  const suffix = n % 100 >= 11 && n % 100 <= 13
    ? "th"
    : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}

function plural(n: number, word: string, many = `${word}s`) {
  return `${integer.format(n)} ${n === 1 ? word : many}`;
}

const NO_GAMES = "Finish a game to see this.";
// Rounds typed as totals have no cards or Blitz pile to count.
const NO_BREAKDOWN = "Enter a round with cards and Blitz pile to see this.";

function describeExtreme(round: {
  totalCardsPlayed: number | null;
  blitzPileRemaining: number | null;
}) {
  if (round.totalCardsPlayed === null || round.blitzPileRemaining === null) {
    return "Entered as a round total";
  }
  return `${round.totalCardsPlayed} cards, ${round.blitzPileRemaining} left in Blitz`;
}

function RecordCard({ stats }: { stats: DashboardStats }) {
  const { winCount, lossCount, decidedGames, winRate, gamesCount, inProgressGames } = stats.games;
  if (!decidedGames) return <EmptyNote>{NO_GAMES}</EmptyNote>;
  return (
    <>
      <BigNumber
        value={`${Math.round(winRate)}%`}
        caption={`${plural(winCount, "win")}, ${plural(lossCount, "loss", "losses")}`}
      />
      <div className="mt-auto pt-3">
        <StatRow label="Games played" value={integer.format(gamesCount)} />
        {inProgressGames ? (
          <StatRow label="In progress" value={integer.format(inProgressGames)} />
        ) : null}
      </div>
    </>
  );
}

function streakText(stats: DashboardStats) {
  const { current } = stats.streaks;
  if (!current) return null;
  if (current.kind === "win") {
    return current.length >= 3
      ? `On fire: ${current.length} wins in a row`
      : `Won the last ${current.length === 1 ? "game" : `${current.length} games`}`;
  }
  return current.length >= 3
    ? `${current.length} games without a win. Due for one!`
    : `Lost the last ${current.length === 1 ? "game" : `${current.length} games`}`;
}

function FormCard({ stats }: { stats: DashboardStats }) {
  const games = [...stats.recentGames].reverse();
  if (!games.length) return <EmptyNote>{NO_GAMES}</EmptyNote>;
  return (
    <>
      <ol className="grid grid-cols-10 gap-1" aria-label="Results, oldest to newest">
        {games.map((game) => (
          <li key={game.id}>
            <Link
              href={`/games/${game.id}`}
              title={`${ordinal(game.place)} of ${game.playerCount}, ${game.score} points`}
              className={cn(
                "flex aspect-square max-w-8 items-center justify-center rounded-md text-xs font-bold",
                game.won === true && "bg-[#dcfce7] text-[#2a6517]",
                game.won === false && "bg-[#fef2f2] text-[#b91c1c]",
                game.won === null && "bg-surfaceSubtle text-textMuted",
              )}
            >
              {game.won === true ? "W" : game.won === false ? "L" : "–"}
            </Link>
          </li>
        ))}
      </ol>
      <div className="mt-auto pt-3">
        {streakText(stats) ? (
          <p className="mb-1 text-sm font-medium text-textBody">{streakText(stats)}</p>
        ) : null}
        <StatRow label="Best win streak" value={integer.format(stats.streaks.bestWin)} />
        <StatRow
          label="Average finish"
          value={ordinal(
            Math.round(games.reduce((sum, game) => sum + game.place, 0) / games.length),
          )}
        />
      </div>
    </>
  );
}

function BlitzRateCard({ stats }: { stats: DashboardStats }) {
  const { battingAverage, totalHandsWon, totalHandsPlayed } = stats.battingAverage;
  if (!totalHandsPlayed)
    return (
      <EmptyNote>
        {stats.rounds.totalRounds ? NO_BREAKDOWN : "Play a round to see this."}
      </EmptyNote>
    );
  return (
    <>
      <BigNumber
        value={battingAverage}
        caption={`Blitzed in ${plural(totalHandsWon, "round")} of ${integer.format(totalHandsPlayed)}`}
      />
      <Link
        href="/guide/reading-your-stats"
        className="mt-auto pt-3 text-xs text-textMuted underline-offset-4 hover:underline"
      >
        What is a batting average?
      </Link>
    </>
  );
}

function RecentScoresCard({ games }: { games: RecentGame[] }) {
  if (!games.length) return <EmptyNote>{NO_GAMES}</EmptyNote>;
  const data = [...games].reverse().map((game, index) => {
    const result = game.won === true ? "Win" : game.won === false ? "Loss" : "No winner";
    return {
      label: `${index + 1}`,
      score: game.score,
      won: game.won,
      mark: game.won === true ? "W" : game.won === false ? "L" : "–",
      result,
      detail: `${result}, ${ordinal(game.place)} of ${game.playerCount}, ${plural(game.roundCount, "round")}`,
    };
  });
  return (
    <div
      className="h-[160px]"
      role="img"
      aria-label={`Final scores, oldest to newest: ${data.map((d) => `${d.score} (${d.result.toLowerCase()})`).join(", ")}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 4, bottom: 0, left: -24 }}>
          <XAxis dataKey="label" hide />
          <YAxis
            tick={{ fontSize: 12, fill: "#8b5e3c" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <ReferenceLine y={0} stroke="#d1bfa8" />
          <Tooltip
            cursor={{ fill: "#faf5ed" }}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e6d7c3" }}
            labelFormatter={() => ""}
            formatter={(value, _name, item) => [
              `${value} points (${(item.payload as { detail: string }).detail})`,
              "",
            ]}
            separator=""
          />
          <Bar dataKey="score" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            <LabelList dataKey="mark" position="top" fontSize={11} fontWeight={700} fill="#5b4038" />
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.won === true ? WIN : entry.won === false ? LOSS : NEUTRAL}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RivalsCard({ stats }: { stats: DashboardStats }) {
  if (!stats.rivals.length) {
    return <EmptyNote>Finish a game with friends or family to start a rivalry.</EmptyNote>;
  }
  return (
    <ul className="divide-y divide-borderWarm/60">
      {stats.rivals.map((rival) => {
        const verdict =
          rival.myWins > rival.theirWins
            ? "You lead"
            : rival.myWins < rival.theirWins
              ? `${rival.name} leads`
              : "All square";
        return (
          <li key={rival.playerId} className="flex items-center gap-3 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surfaceSubtle text-sm font-bold text-brandAccent">
              {rival.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={rival.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                rival.name.slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-brandAccent">
                {rival.name}
                {rival.kind === "guest" ? (
                  <span className="ml-1 text-xs font-normal text-textMuted">guest</span>
                ) : null}
              </div>
              <div className="text-xs text-textMuted">
                {plural(rival.gamesTogether, "game")} together · {verdict}
              </div>
            </div>
            <div className="text-right font-display text-lg font-bold text-brandAccent">
              {rival.myWins}
              <span className="px-1 text-textMuted">–</span>
              {rival.theirWins}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function BestHandCard({ stats }: { stats: DashboardStats }) {
  const { highest, lowest } = stats.scoreExtremes;
  if (!highest) return <EmptyNote>Play a round to see this.</EmptyNote>;
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <div className="text-xs font-medium text-textMuted">Best</div>
        <div className="font-display text-4xl font-bold text-[#2a6517]">{highest.score}</div>
        <div className="text-xs text-textBody">
          {describeExtreme(highest)}
        </div>
      </div>
      <div>
        <div className="text-xs font-medium text-textMuted">Worst</div>
        <div className="font-display text-4xl font-bold text-[#b91c1c]">
          {lowest ? lowest.score : "—"}
        </div>
        {lowest ? (
          <div className="text-xs text-textBody">
            {describeExtreme(lowest)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CareerCard({ stats }: { stats: DashboardStats }) {
  return (
    <>
      <BigNumber
        value={integer.format(stats.cumulativeScore)}
        caption="points scored all time"
      />
      <div className="mt-auto pt-3">
        <StatRow label="Cards played" value={integer.format(stats.rounds.totalCardsPlayed)} />
        <StatRow label="Rounds played" value={integer.format(stats.rounds.totalRounds)} />
      </div>
    </>
  );
}

function GameLengthCard({ stats }: { stats: DashboardStats }) {
  const { longest, shortest } = stats.gameRoundExtremes;
  if (!longest || !shortest) return <EmptyNote>{NO_GAMES}</EmptyNote>;
  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        { label: "Longest", game: longest },
        { label: "Shortest", game: shortest },
      ].map(({ label, game }) => (
        <Link key={label} href={`/games/${game.id}`} className="group">
          <div className="text-xs font-medium text-textMuted">{label}</div>
          <div className="font-display text-4xl font-bold text-brandAccent">{game.roundCount}</div>
          <div className="text-xs text-textBody group-hover:underline">rounds</div>
        </Link>
      ))}
    </div>
  );
}

function AveragesCard({ stats }: { stats: DashboardStats }) {
  if (!stats.rounds.totalRounds) return <EmptyNote>Play a round to see this.</EmptyNote>;
  if (!stats.rounds.breakdownRounds) return <EmptyNote>{NO_BREAKDOWN}</EmptyNote>;
  return (
    <>
      <BigNumber
        value={oneDecimal.format(stats.rounds.avgCardsPlayed)}
        caption="cards played per round"
      />
      <div className="mt-auto pt-3">
        <StatRow
          label="Blitz cards left per round"
          value={oneDecimal.format(stats.rounds.avgBlitzRemaining)}
        />
      </div>
    </>
  );
}

function MomentsCard({ stats }: { stats: DashboardStats }) {
  if (!stats.moments.length) {
    return <EmptyNote>Play a few more games and the stories will start showing up here.</EmptyNote>;
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {stats.moments.slice(0, 4).map((moment) => {
        const body = (
          <>
            <div className="text-xs font-medium text-textMuted">
              <span aria-hidden="true" className="mr-1">{moment.emoji}</span>
              {moment.title}
            </div>
            <div className="text-sm font-semibold leading-tight text-brandAccent">{moment.headline}</div>
            <div className="text-xs text-textBody">{moment.detail}</div>
          </>
        );
        return (
          <li key={moment.key} className="rounded-lg bg-surfaceSubtle">
            {moment.gameId ? (
              <Link href={`/games/${moment.gameId}`} className="block h-full p-2.5 hover:bg-borderWarm/40">
                {body}
              </Link>
            ) : (
              <div className="p-2.5">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// A deck needs a few games before it can be called lucky.
const LUCKY_DECK_MIN_GAMES = 3;

function DecksCard({ stats }: { stats: DashboardStats }) {
  if (!stats.decks.length) {
    return (
      <EmptyNote>
        Tag your deck when you set up a game to see which one brings you luck.
      </EmptyNote>
    );
  }
  const lucky = [...stats.decks]
    .filter((deck) => deck.games >= LUCKY_DECK_MIN_GAMES)
    .sort((a, b) => b.winRate - a.winRate || b.games - a.games)[0];
  return (
    <>
      {lucky ? (
        <div className="mb-3 flex items-center gap-3">
          <DeckIcon deck={lucky.deck} className="h-10 w-10 text-brandAccent" />
          <div>
            <div className="font-display text-2xl font-bold leading-tight text-brandAccent">
              {deckLabel(lucky.deck)}
            </div>
            <div className="text-sm text-textBody">
              {Math.round(lucky.winRate)}% wins with this deck
            </div>
          </div>
        </div>
      ) : (
        <p className="mb-3 text-sm text-textBody">
          Play {LUCKY_DECK_MIN_GAMES} games with a deck to crown a lucky one.
        </p>
      )}
      <ul className="mt-auto">
        {stats.decks.map((deck) => (
          <li key={deck.deck}>
            <StatRow
              label={
                <span className="flex items-center gap-1.5">
                  <DeckIcon deck={deck.deck} className="h-4 w-4" />
                  {deckLabel(deck.deck)}
                </span>
              }
              value={`${Math.round(deck.winRate)}% of ${plural(deck.games, "game")}`}
            />
          </li>
        ))}
      </ul>
    </>
  );
}

const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

// Rendered in the viewer's time zone, which can differ from the server's.
function GameDate({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {shortDate.format(new Date(iso))}
    </time>
  );
}

function spreadPoints(entry: SpreadGame) {
  return `+${oneDecimal.format(entry.spread)}`;
}

function WidestCard({ stats }: { stats: DashboardStats }) {
  const { games, round } = stats.widest;
  const [top, ...rest] = games;
  if (!top) return <EmptyNote>{NO_GAMES}</EmptyNote>;
  const leader = (entry: SpreadGame) => (entry.leaderIsMe ? "You" : entry.leaderName);
  return (
    <>
      <Link href={`/games/${top.gameId}`} className="group">
        <BigNumber
          value={spreadPoints(top)}
          caption={
            <span className="group-hover:underline">
              {leader(top)} finished this far ahead of the table&apos;s average on{" "}
              <GameDate iso={top.finishedAt} />
            </span>
          }
        />
      </Link>
      <ul className="mt-auto pt-3">
        {rest.map((game) => (
          <li key={game.gameId}>
            <StatRow
              label={
                <Link href={`/games/${game.gameId}`} className="hover:underline">
                  <GameDate iso={game.finishedAt} />, {leader(game)} led
                </Link>
              }
              value={spreadPoints(game)}
            />
          </li>
        ))}
        {round ? (
          <li>
            <StatRow
              label={
                <Link href={`/games/${round.gameId}`} className="hover:underline">
                  Widest round: {leader(round)} in round {round.roundNumber},{" "}
                  <GameDate iso={round.finishedAt} />
                </Link>
              }
              value={spreadPoints(round)}
            />
          </li>
        ) : null}
      </ul>
    </>
  );
}

function NamedMomentsCard({ stats }: { stats: DashboardStats }) {
  const { feed, mine, tornadoesSuffered } = stats.momentHistory;
  const tallies = [
    { label: "Tornadoes", value: mine.tornado },
    { label: "U-turns", value: mine.u_turn },
    { label: "Short fuses", value: mine.short_fuse },
    { label: "Bounce backs", value: mine.bounce_back },
  ];
  if (!feed.length && tallies.every((tally) => !tally.value)) {
    return (
      <EmptyNote>
        No tornadoes or U-turns yet. Keep playing and the wild games will land here.
      </EmptyNote>
    );
  }
  return (
    <>
      {feed.length ? (
        <ul className="grid gap-2 sm:grid-cols-2" aria-label="Latest named moments">
          {feed.map((item) => (
            <li key={item.key} className="rounded-lg bg-surfaceSubtle">
              <Link href={`/games/${item.gameId}`} className="block h-full p-2.5 hover:bg-borderWarm/40">
                <div className="flex items-center justify-between gap-2 text-xs font-medium text-textMuted">
                  <span>
                    <span aria-hidden="true" className="mr-1">{item.icon}</span>
                    {item.title}
                    {item.starring ? <span className="ml-1 font-semibold text-brandAccent">· you</span> : null}
                  </span>
                  <GameDate iso={item.finishedAt} />
                </div>
                <div className="text-sm text-textBody">{item.detail}</div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <dl className="mt-auto grid grid-cols-2 gap-x-4 pt-3 sm:grid-cols-4">
        {tallies.map((tally) => (
          <div key={tally.label}>
            <dt className="text-xs text-textMuted">{tally.label}</dt>
            <dd className="font-display text-2xl font-bold text-brandAccent">{integer.format(tally.value)}</dd>
          </div>
        ))}
      </dl>
      {tornadoesSuffered ? (
        <p className="pt-1 text-xs text-textMuted">
          Caught in {plural(tornadoesSuffered, "tornado", "tornadoes")}: you led, then finished last.
        </p>
      ) : null}
    </>
  );
}

function LeadChangesCard({ stats }: { stats: DashboardStats }) {
  const {
    gamesAnalyzed,
    gamesWithLeadChanges,
    totalLeadChanges,
    leadsTaken,
    leadsLost,
    winsFromBehind,
    mostLeadChanges,
  } = stats.momentHistory.leadChanges;
  if (!gamesAnalyzed) return <EmptyNote>{NO_GAMES}</EmptyNote>;
  return (
    <>
      <BigNumber
        value={`${Math.round((gamesWithLeadChanges / gamesAnalyzed) * 100)}%`}
        caption={`of your last ${plural(gamesAnalyzed, "game")} saw the lead change hands`}
      />
      <div className="mt-auto pt-3">
        <StatRow label="Changes per game" value={oneDecimal.format(totalLeadChanges / gamesAnalyzed)} />
        <StatRow label="Times you took the lead" value={integer.format(leadsTaken)} />
        <StatRow label="Times you lost it" value={integer.format(leadsLost)} />
        <StatRow label="Wins from behind" value={integer.format(winsFromBehind)} />
        {mostLeadChanges ? (
          <StatRow
            label={
              <Link href={`/games/${mostLeadChanges.gameId}`} className="hover:underline">
                Wildest game, <GameDate iso={mostLeadChanges.finishedAt} />
              </Link>
            }
            value={plural(mostLeadChanges.count, "change")}
          />
        ) : null}
      </div>
    </>
  );
}

export const WIDE_CARDS = new Set<DashboardCardId>(["recentScores", "rivals", "moments", "namedMoments"]);

export function DashboardCardBody({
  id,
  stats,
}: {
  id: DashboardCardId;
  stats: DashboardStats;
}) {
  switch (id) {
    case "record":
      return <RecordCard stats={stats} />;
    case "form":
      return <FormCard stats={stats} />;
    case "blitzRate":
      return <BlitzRateCard stats={stats} />;
    case "recentScores":
      return <RecentScoresCard games={stats.recentGames} />;
    case "rivals":
      return <RivalsCard stats={stats} />;
    case "bestHand":
      return <BestHandCard stats={stats} />;
    case "career":
      return <CareerCard stats={stats} />;
    case "gameLength":
      return <GameLengthCard stats={stats} />;
    case "moments":
      return <MomentsCard stats={stats} />;
    case "decks":
      return <DecksCard stats={stats} />;
    case "widest":
      return <WidestCard stats={stats} />;
    case "namedMoments":
      return <NamedMomentsCard stats={stats} />;
    case "leadChanges":
      return <LeadChangesCard stats={stats} />;
    case "averages":
      return <AveragesCard stats={stats} />;
  }
}
