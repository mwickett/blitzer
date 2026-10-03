import Link from "next/link";
import type { HighlightGame, HighlightRival, PlayerHighlights as Highlights } from "@/server/queries/playerHighlights";

type Moment = {
  key: string;
  emoji: string;
  title: string;
  headline: string;
  detail: string;
  gameId?: string;
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const when = (game: HighlightGame) =>
  game.finishedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const record = (rival: HighlightRival) =>
  `You ${rival.wins}, ${rival.name} ${rival.losses} across ${plural(rival.gamesPlayed, "game")}`;

export function highlightMoments(highlights: Highlights): Moment[] {
  const { currentStreak, rivals, biggestComeback, closestWin, biggestWin, heartbreaker, blitzStreak } = highlights;
  const moments: Array<Moment | null> = [
    currentStreak && currentStreak.length >= 2
      ? currentStreak.result === "W"
        ? { key: "streak", emoji: "🔥", title: "On a heater", headline: plural(currentStreak.length, "win") + " in a row", detail: `Longest ever: ${highlights.longestWinStreak}` }
        : { key: "streak", emoji: "🌧️", title: "Due for a bounce", headline: `${currentStreak.length} losses in a row`, detail: `Your best run is ${plural(highlights.longestWinStreak, "win")}` }
      : null,
    biggestComeback
      ? { key: "comeback", emoji: "🎢", title: "Biggest comeback", headline: `Down ${biggestComeback.maxDeficit}, still won`, detail: when(biggestComeback), gameId: biggestComeback.gameId }
      : null,
    rivals.nemesis
      ? { key: "nemesis", emoji: "😈", title: "Your nemesis", headline: rivals.nemesis.name, detail: record(rivals.nemesis) }
      : null,
    rivals.favoriteOpponent
      ? { key: "favorite", emoji: "😇", title: "Favorite opponent", headline: rivals.favoriteOpponent.name, detail: record(rivals.favoriteOpponent) }
      : null,
    closestWin
      ? { key: "closest", emoji: "😅", title: "Photo finish", headline: `Won by ${plural(closestWin.finalMargin, "point")}`, detail: when(closestWin), gameId: closestWin.gameId }
      : null,
    heartbreaker
      ? { key: "heartbreaker", emoji: "💔", title: "So close", headline: `Lost by ${plural(-heartbreaker.finalMargin, "point")}`, detail: when(heartbreaker), gameId: heartbreaker.gameId }
      : null,
    biggestWin
      ? { key: "blowout", emoji: "🚀", title: "Biggest blowout", headline: `Won by ${plural(biggestWin.finalMargin, "point")}`, detail: when(biggestWin), gameId: biggestWin.gameId }
      : null,
    blitzStreak
      ? { key: "blitz", emoji: "⚡", title: "Hottest hand", headline: `${blitzStreak.rounds} blitzes in a row`, detail: "In a single game", gameId: blitzStreak.gameId }
      : null,
    !rivals.nemesis && !rivals.favoriteOpponent && rivals.mostPlayed
      ? { key: "rival", emoji: "🤝", title: "Usual suspect", headline: rivals.mostPlayed.name, detail: record(rivals.mostPlayed) }
      : null,
  ];
  return moments.filter((moment): moment is Moment => moment !== null);
}

export default function PlayerHighlights({ highlights }: { highlights: Highlights }) {
  const moments = highlightMoments(highlights);

  if (!highlights.sampledGames) {
    return (
      <div className="rounded-lg border bg-muted/30 p-6 text-center text-muted-foreground">
        Finish a game to start collecting highlights.
      </div>
    );
  }

  return (
    <section aria-labelledby="highlights-heading" className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="highlights-heading" className="text-xl font-semibold">Highlights</h2>
        {highlights.recentResults.length ? (
          <div className="flex items-center gap-1" aria-label="Recent results, newest first">
            <span className="mr-1 text-sm text-muted-foreground">Recent form</span>
            {highlights.recentResults.map((result, index) => (
              <span
                key={index}
                title={result === "W" ? "Win" : "Loss"}
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  result === "W" ? "bg-green-600 text-white" : "bg-muted text-muted-foreground"
                }`}
              >
                {result}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {moments.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {moments.map((moment) => {
            const body = (
              <>
                <div className="text-sm text-muted-foreground">
                  <span aria-hidden="true" className="mr-1">{moment.emoji}</span>
                  {moment.title}
                </div>
                <div className="mt-1 text-lg font-semibold leading-tight">{moment.headline}</div>
                <div className="mt-1 text-sm text-muted-foreground">{moment.detail}</div>
              </>
            );
            return (
              <li key={moment.key} className="rounded-lg border bg-card">
                {moment.gameId ? (
                  <Link href={`/games/${moment.gameId}`} className="block h-full p-4 hover:bg-muted/50">
                    {body}
                  </Link>
                ) : (
                  <div className="p-4">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Play a few more games and the stories will start showing up here.</p>
      )}
    </section>
  );
}
