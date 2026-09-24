"use client";

import { WinProbabilityCard } from "@/components/scoring/graphs/WinProbabilityCard";
import {
  DEMO_PLAYERS,
  DEMO_ROUNDS_PLAYED,
  DEMO_WIN_THRESHOLD,
  DEMO_DELTAS_BY_PLAYER,
} from "./fixtures";

/**
 * WinProbabilityCard calls client-only hooks (useRaceForecast → worker) and
 * carries no "use client" directive — in the app it is only ever mounted
 * inside client parents. The marketing page is a server component, so this
 * wrapper supplies the boundary.
 *
 * Odds resolve asynchronously via the forecast worker once the card is
 * eligible (DEMO has 4 rounds). Fixed fixture inputs keep the eventual
 * percentages stable across loads.
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
