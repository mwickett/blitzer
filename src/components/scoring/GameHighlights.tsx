import {
  type GameHighlight,
  type HighlightPlayer,
} from "@/lib/scoring/gameHighlights";

interface GameHighlightsProps {
  highlights: GameHighlight[];
  players: (HighlightPlayer & { color: string })[];
}

function describe(
  highlight: GameHighlight,
  name: (id: string) => string,
): { icon: string; title: string; detail: string } {
  switch (highlight.kind) {
    case "wire_to_wire":
      return {
        icon: "🚂",
        title: "Wire to wire",
        detail: `${name(highlight.playerId)} led after every round.`,
      };
    case "comeback":
      return {
        icon: "🔄",
        title: "Comeback",
        detail: `${name(highlight.playerId)} was ${highlight.deficit} points back after round ${highlight.roundNumber} and still won.`,
      };
    case "lead_changes":
      return {
        icon: "🔀",
        title: "Seesaw",
        detail: `The lead changed hands ${highlight.count} times.`,
      };
    case "photo_finish":
      return {
        icon: "📸",
        title: "Photo finish",
        detail:
          highlight.margin === 0
            ? "Level on points; decided on the tiebreak."
            : `Won by just ${highlight.margin} ${highlight.margin === 1 ? "point" : "points"}.`,
      };
    case "lone_survivor":
      return {
        icon: "🛟",
        title: "Lone survivor",
        detail: `In round ${highlight.roundNumber}, ${name(highlight.playerId)} was the only one to score. Everyone else went negative.`,
      };
    case "blitz_streak":
      return {
        icon: "⚡",
        title: "On fire",
        detail: `${name(highlight.playerId)} blitzed ${highlight.length} rounds in a row.`,
      };
  }
}

export function GameHighlights({ highlights, players }: GameHighlightsProps) {
  if (highlights.length === 0) return null;
  const byId = new Map(players.map((p) => [p.id, p]));
  const name = (id: string) => byId.get(id)?.name ?? "Someone";

  return (
    <section aria-labelledby="game-highlights" className="mx-4 mb-3">
      <h3
        id="game-highlights"
        className="text-[10px] font-bold uppercase tracking-widest text-[#8b5e3c] mb-1.5"
      >
        Highlights
      </h3>
      <ul className="space-y-1.5">
        {highlights.map((highlight) => {
          const { icon, title, detail } = describe(highlight, name);
          return (
            <li
              key={highlight.kind}
              className="flex items-start gap-2.5 bg-white border-[1.5px] border-[#e6d7c3] rounded-lg px-3 py-2.5"
            >
              <span aria-hidden="true" className="text-lg leading-none mt-0.5">
                {icon}
              </span>
              <div>
                <div className="text-sm font-bold text-[#290806]">{title}</div>
                <div className="text-[13px] text-[#8b5e3c]">{detail}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
