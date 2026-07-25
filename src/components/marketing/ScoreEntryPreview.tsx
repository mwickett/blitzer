"use client";

import { ScoreEntryCard } from "@/components/scoring/ScoreEntryCard";
import {
  DEMO_PLAYERS,
  DEMO_SCORES_BY_ROUND,
  DEMO_LAST_ROUND_ENTRIES,
  DEMO_ROUNDS_PLAYED,
} from "./fixtures";

/**
 * ScoreEntryCard needs an onUpdate callback, and functions cannot be passed
 * from a server component to a client one. The no-op is created here instead.
 *
 * This renders a static, non-interactive preview. Wiring it to local state to
 * make it playable is a deliberate follow-up, not an oversight.
 *
 * Each card shows the score *before* the round being keyed in, so that the
 * "standings redraw before the next deal" claim has supporting demo: the
 * phone screen and the standings panel beside it show different snapshots in
 * time — entry in progress on the phone, post-update standings adjacent.
 */
const noop = () => {};

export function ScoreEntryPreview() {
  // The three highest-placed players — four cards overflow the phone frame.
  const shown = DEMO_PLAYERS.slice(0, 3);

  return (
    // ScoreEntryCard's inputs are wired to a no-op here — they exist only to
    // show what score entry looks like. Without `inert`, a keyboard visitor
    // tabs through six dead fields and mobile taps open the numeric keyboard
    // for nothing, so the whole preview is pulled out of the tab order and
    // the accessibility tree.
    <div inert>
      <div className="space-y-2">
        {shown.map((player) => {
          const cumulative = DEMO_SCORES_BY_ROUND[player.id];
          const scoreBeforeRound = cumulative[DEMO_ROUNDS_PLAYED - 2];
          return (
            <ScoreEntryCard
              key={player.id}
              name={player.name}
              color={player.color}
              score={scoreBeforeRound}
              entry={DEMO_LAST_ROUND_ENTRIES[player.id]}
              status="complete"
              onUpdate={noop}
            />
          );
        })}
      </div>
    </div>
  );
}
