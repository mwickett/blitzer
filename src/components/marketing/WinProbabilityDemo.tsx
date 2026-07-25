"use client";

import { WinProbabilityCard } from "@/components/scoring/graphs/WinProbabilityCard";
import {
  DEMO_PLAYERS,
  DEMO_ROUNDS_PLAYED,
  DEMO_WIN_THRESHOLD,
  DEMO_DELTAS_BY_PLAYER,
} from "./fixtures";

/**
 * WinProbabilityCard calls useMemo but carries no "use client" directive — in
 * the app it is only ever mounted inside client parents. The marketing page is
 * a server component, so this wrapper supplies the boundary.
 *
 * The Monte Carlo is seeded from its inputs (see makeRng in
 * lib/scoring/probability.ts), so fixed props give identical percentages on
 * server and client. No hydration mismatch.
 */
export function WinProbabilityDemo() {
  return (
    <WinProbabilityCard
      players={DEMO_PLAYERS}
      roundsPlayed={DEMO_ROUNDS_PLAYED}
      winThreshold={DEMO_WIN_THRESHOLD}
      deltasByPlayer={DEMO_DELTAS_BY_PLAYER}
    />
  );
}
