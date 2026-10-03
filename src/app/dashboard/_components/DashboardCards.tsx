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
import type { RecentGame } from "@/server/queries/playerStats";
import { BigNumber, EmptyNote, StatRow } from "./StatCard";
import { cn } from "@/lib/utils";

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
  if (!totalHandsPlayed) return <EmptyNote>Play a round to see this.</EmptyNote>;
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
          {highest.totalCardsPlayed} cards, {highest.blitzPileRemaining} left in Blitz
        </div>
      </div>
      <div>
        <div className="text-xs font-medium text-textMuted">Worst</div>
        <div className="font-display text-4xl font-bold text-[#b91c1c]">
          {lowest ? lowest.score : "—"}
        </div>
        {lowest ? (
          <div className="text-xs text-textBody">
            {lowest.totalCardsPlayed} cards, {lowest.blitzPileRemaining} left in Blitz
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

export const WIDE_CARDS = new Set<DashboardCardId>(["recentScores", "rivals"]);

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
    case "averages":
      return <AveragesCard stats={stats} />;
  }
}
