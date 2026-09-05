import type {
  ForecastRoundSample,
  PredictionProfilesByPlayer,
  RaceForecast,
} from "./probability";

export const MIN_HISTORICAL_ROUNDS = 5;

export interface ForecastInput {
  players: { id: string; score: number; roundsPlayed: number }[];
  winThreshold: number;
  deltasByPlayer?: Record<string, number[]>;
  options: {
    predictionProfiles?: PredictionProfilesByPlayer;
    roundSamplesByPlayer?: Record<string, ForecastRoundSample[]>;
  };
}

export function hasForecastEvidence(input: ForecastInput): boolean {
  return (
    input.players.length > 0 &&
    (input.players[0].roundsPlayed >= 3 ||
      input.players.some(
        (player) =>
          (input.options.predictionProfiles?.[player.id]?.roundsPlayed ?? 0) >=
          MIN_HISTORICAL_ROUNDS,
      ))
  );
}

/** Content identity survives unchanged polls and object-property reordering. */
export function forecastKey(input: ForecastInput): string {
  return JSON.stringify(
    {
      ...input,
      players: [...input.players].sort((a, b) => a.id.localeCompare(b.id)),
    },
    (_key, value) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, value[key]]),
        );
      }
      return value;
    },
  );
}

export type ForecastReply =
  | { key: string; ok: true; forecast: RaceForecast | null }
  | { key: string; ok: false };
