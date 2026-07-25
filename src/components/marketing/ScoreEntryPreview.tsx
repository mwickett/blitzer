"use client";

import { ScoreEntryCard } from "@/components/scoring/ScoreEntryCard";
import { DEMO_PLAYERS, DEMO_DELTAS_BY_PLAYER } from "./fixtures";

/**
 * ScoreEntryCard needs an onUpdate callback, and functions cannot be passed
 * from a server component to a client one. The no-op is created here instead.
 *
 * This renders a static, non-interactive preview. Wiring it to local state to
 * make it playable is a deliberate follow-up, not an oversight.
 */
const noop = () => {};

export function ScoreEntryPreview() {
  // The three highest-placed players — four cards overflow the phone frame.
  const shown = DEMO_PLAYERS.slice(0, 3);

  return (
    <div className="space-y-2">
      {shown.map((player) => {
        const deltas = DEMO_DELTAS_BY_PLAYER[player.id];
        const lastDelta = deltas[deltas.length - 1];
        return (
          <ScoreEntryCard
            key={player.id}
            name={player.name}
            color={player.color}
            score={player.score}
            entry={{ blitzRemaining: 0, cardsPlayed: lastDelta }}
            status="complete"
            onUpdate={noop}
          />
        );
      })}
    </div>
  );
}
