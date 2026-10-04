import { ImageResponse } from "next/og";
import { getGameById } from "@/server/queries/games";
import { buildRecapCard, type RecapCard } from "@/lib/scoring/recapCard";

// The link preview and the picture behind "Share result". It shows only what
// the public spectator page already shows.
export const alt = "Final scores from a game of Dutch Blitz on Blitzer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Scores change until the game ends and can be edited after, so the picture
// is drawn per request rather than cached at first view.
export const dynamic = "force-dynamic";

/** Long names shrink, then end in an ellipsis, so they stay in their column. */
const clip = {
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
} as const;

function winnerSize(name: string): number {
  if (name.length <= 10) return 88;
  if (name.length <= 16) return 64;
  return 48;
}

const INK = "#290806";
const CREAM = "#fff7ea";
const MAX_ROWS = 6;

function formatDate(at: Date | null): string {
  if (!at) return "";
  return at.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function Plain() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 80,
        background: INK,
        color: CREAM,
      }}
    >
      <div style={{ fontSize: 96, fontWeight: 700 }}>Blitzer</div>
      <div style={{ fontSize: 40, opacity: 0.8, marginTop: 16 }}>
        Dutch Blitz scores, stats and stories
      </div>
    </div>
  );
}

function Recap({ card }: { card: RecapCard }) {
  const rows = card.players.slice(0, MAX_ROWS);
  const top = Math.max(1, ...rows.map((p) => p.score));
  const meta = [
    formatDate(card.endedAt),
    `${card.roundCount} ${card.roundCount === 1 ? "round" : "rounds"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        padding: 64,
        gap: 56,
        background: INK,
        color: CREAM,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: 500,
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 20,
              letterSpacing: 2,
              textTransform: "uppercase",
              opacity: 0.7,
            }}
          >
            {`Blitzer · ${meta}`}
          </div>
          <div style={{ fontSize: 30, opacity: 0.75, marginTop: 40 }}>
            Winner
          </div>
          <div
            style={{
              ...clip,
              display: "block",
              maxWidth: 500,
              fontSize: winnerSize(card.winnerName),
              fontWeight: 700,
              lineHeight: 1.1,
              marginTop: 8,
            }}
          >
            {card.winnerName}
          </div>
        </div>
        {card.moment ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              borderTop: "2px solid rgba(255,247,234,0.25)",
              paddingTop: 20,
            }}
          >
            <div style={{ fontSize: 30, fontWeight: 700 }}>
              {card.moment.title}
            </div>
            <div style={{ fontSize: 24, opacity: 0.85, marginTop: 6 }}>
              {card.moment.detail}
            </div>
          </div>
        ) : null}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          flex: 1,
          gap: 22,
        }}
      >
        {rows.map((player, index) => (
          <div
            key={index}
            style={{ display: "flex", flexDirection: "column", gap: 6 }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 28,
                fontWeight: player.isWinner ? 700 : 400,
              }}
            >
              <span style={{ ...clip, maxWidth: 420 }}>{player.name}</span>
              <span style={{ marginLeft: 16 }}>{player.score}</span>
            </div>
            <div
              style={{
                display: "flex",
                height: 16,
                borderRadius: 8,
                background: "rgba(255,247,234,0.12)",
              }}
            >
              <div
                style={{
                  width: `${Math.max(0, (player.score / top) * 100)}%`,
                  height: 16,
                  borderRadius: 8,
                  background: player.color,
                }}
              />
            </div>
          </div>
        ))}
        {card.players.length > rows.length ? (
          <div style={{ fontSize: 22, opacity: 0.7 }}>
            {`+ ${card.players.length - rows.length} more`}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = await getGameById(id).catch(() => null);
  // Unstarted pickup lobbies are private, like their page.
  const card =
    game && !(game.kind === "PICKUP" && !game.startedAt)
      ? buildRecapCard(game)
      : null;

  return new ImageResponse(card ? <Recap card={card} /> : <Plain />, size);
}
