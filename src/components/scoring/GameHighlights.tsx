import {
  describeHighlight,
  type GameHighlight,
  type HighlightPlayer,
} from "@/lib/scoring/gameHighlights";
import {
  describeNamedMoment,
  type NamedMoment,
} from "@/lib/scoring/namedMoments";

interface GameHighlightsProps {
  highlights: GameHighlight[];
  namedMoments?: NamedMoment[];
  players: (HighlightPlayer & { color: string })[];
}

export function GameHighlights({
  highlights,
  namedMoments = [],
  players,
}: GameHighlightsProps) {
  if (highlights.length === 0 && namedMoments.length === 0) return null;
  const byId = new Map(players.map((p) => [p.id, p]));
  const name = (id: string) => byId.get(id)?.name ?? "Someone";
  // Named moments lead: they are the game's turning points.
  const items = [
    ...namedMoments.map((moment) => ({
      key: moment.kind,
      ...describeNamedMoment(moment, name),
    })),
    ...highlights.map((highlight) => ({
      key: highlight.kind,
      ...describeHighlight(highlight, name),
    })),
  ];

  return (
    <section aria-labelledby="game-highlights" className="mx-4 mb-3">
      <h3
        id="game-highlights"
        className="text-[10px] font-bold uppercase tracking-widest text-[#8b5e3c] mb-1.5"
      >
        Highlights
      </h3>
      <ul className="space-y-1.5">
        {items.map(({ key, icon, title, detail }) => {
          return (
            <li
              key={key}
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
