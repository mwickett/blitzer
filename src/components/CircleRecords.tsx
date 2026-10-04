import Link from "next/link";
import type {
  CircleRecord,
  CircleRecordKind,
} from "@/server/queries/circleRecords";

const LABELS: Record<CircleRecordKind, string> = {
  highestRound: "Highest round",
  lowestRound: "Lowest round",
  mostBlitzes: "Most blitzes in a game",
  biggestComeback: "Biggest comeback",
  longestGame: "Longest game",
  fastestWin: "Fastest win",
};

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function formatDate(at: Date): string {
  return at.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function recordLabel(kind: CircleRecordKind): string {
  return LABELS[kind];
}

/** The headline number, with its unit where the bare number would be unclear. */
export function recordValue(record: CircleRecord): string {
  switch (record.kind) {
    case "highestRound":
    case "lowestRound":
      return record.value < 0
        ? `−${Math.abs(record.value)}`
        : `${record.value}`;
    case "mostBlitzes":
      return `${record.value}`;
    case "biggestComeback":
      return `${record.value} pts`;
    case "longestGame":
    case "fastestWin":
      return plural(record.value, "round");
  }
}

/** One line of who and how, e.g. "Priya in round 4". */
export function recordDetail(record: CircleRecord): string {
  const who = record.playerName ?? "";
  switch (record.kind) {
    case "highestRound":
    case "lowestRound":
      return record.roundNumber ? `${who} in round ${record.roundNumber}` : who;
    case "mostBlitzes":
      return `${who} emptied their Blitz pile ${plural(record.value, "time")}`;
    case "biggestComeback":
      return `${who} won from ${record.value} points behind`;
    case "longestGame":
      return "Most rounds in a finished game";
    case "fastestWin":
      return `${who} reached the target`;
  }
}

export function CircleRecordBook({ records }: { records: CircleRecord[] }) {
  if (records.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Record book</h2>
      <p className="text-sm text-muted-foreground">
        All-time bests and worsts from your Circle games. The first game to set
        a record keeps it until someone beats it.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {records.map((record) => (
          <li key={record.kind}>
            <Link
              href={`/games/${record.gameId}`}
              className="flex h-full items-start justify-between gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  {recordLabel(record.kind)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {recordDetail(record)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatDate(record.at)}
                </div>
              </div>
              <div className="font-display shrink-0 text-2xl font-bold tabular-nums">
                {recordValue(record)}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Shown on a finished game that holds one or more Circle records. */
export function GameRecordsHeld({ records }: { records: CircleRecord[] }) {
  if (records.length === 0) return null;

  return (
    <section
      aria-labelledby="game-records-heading"
      className="mx-auto mt-6 max-w-2xl rounded-lg border-2 border-dashed border-destructive/60 bg-card p-4"
    >
      <h2
        id="game-records-heading"
        className="text-xs font-bold uppercase tracking-widest text-destructive"
      >
        {records.length === 1 ? "Circle record" : "Circle records"}
      </h2>
      <ul className="mt-2 space-y-1 text-sm">
        {records.map((record) => (
          <li key={record.kind}>
            <span className="font-medium">{recordLabel(record.kind)}:</span>{" "}
            <span className="tabular-nums">{recordValue(record)}</span>
            <span className="text-muted-foreground">
              {" "}
              · {recordDetail(record)}
            </span>
          </li>
        ))}
      </ul>
      <Link
        href="/circles"
        className="mt-3 inline-block text-xs font-medium underline"
      >
        See the record book
      </Link>
    </section>
  );
}
