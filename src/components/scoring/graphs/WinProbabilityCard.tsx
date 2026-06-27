import { useMemo } from "react";
import { type PlayerWithScore } from "../types";
import {
  calcRaceForecast,
  type ForecastRange,
  type PlayerForecast,
  type RaceForecast,
  type ForecastRoundSample,
  type PredictionProfilesByPlayer,
} from "@/lib/scoring/probability";

interface WinProbabilityCardProps {
  players: PlayerWithScore[];
  roundsPlayed: number;
  winThreshold: number;
  deltasByPlayer?: Record<string, number[]>;
  predictionProfiles?: PredictionProfilesByPlayer;
  roundSamplesByPlayer?: Record<string, ForecastRoundSample[]>;
}

export function WinProbabilityCard({
  players,
  roundsPlayed,
  winThreshold,
  deltasByPlayer,
  predictionProfiles,
  roundSamplesByPlayer,
}: WinProbabilityCardProps) {
  const forecast = useMemo(
    () =>
      calcRaceForecast(
        players.map((p) => ({ id: p.id, score: p.score, roundsPlayed })),
        winThreshold,
        deltasByPlayer,
        { predictionProfiles, roundSamplesByPlayer }
      ),
    [
      players,
      roundsPlayed,
      winThreshold,
      deltasByPlayer,
      predictionProfiles,
      roundSamplesByPlayer,
    ]
  );

  const sorted = useMemo(
    () =>
      forecast
        ? [...players].sort(
            (a, b) =>
              (forecast.players[b.id]?.winProbability ?? 0) -
              (forecast.players[a.id]?.winProbability ?? 0)
          )
        : players,
    [players, forecast]
  );

  if (!forecast) {
    return (
      <div className="bg-white border-[1.5px] border-[#e6d7c3] rounded-xl p-4">
        <div className="text-base md:text-sm font-bold text-[#290806] mb-0.5">
          Win Probability
        </div>
        <div className="text-[13px] md:text-xs text-[#8b5e3c]">
          Available after 3 rounds
        </div>
      </div>
    );
  }

  const topPlayerId = sorted[0]?.id;
  const topNextThreat = getTopNextThreat(sorted, forecast);
  const topBlitzThreat = getTopBlitzThreat(sorted, forecast);
  const topSwingThreat = getTopSwingThreat(sorted, forecast);

  return (
    <div className="bg-white border-[1.5px] border-[#e6d7c3] rounded-xl p-4">
      <div className="text-base md:text-sm font-bold text-[#290806] mb-0.5">
        Win Probability
      </div>
      <div className="text-[13px] md:text-xs text-[#8b5e3c] mb-3">
        {getSubtitle(roundsPlayed, forecast)}
      </div>

      <div className="space-y-2">
        {sorted.map((player) => {
          const playerForecast = forecast.players[player.id];
          const pct = playerForecast?.winProbability ?? 0;
          return (
            <div key={player.id} className="space-y-1">
              <div className="flex items-center gap-2">
                <div
                  className="w-14 md:w-10 text-[13px] md:text-[11px] font-semibold text-right flex-shrink-0 truncate leading-tight"
                  style={{ color: player.color }}
                >
                  {player.name}
                </div>
                <div className="flex-1 h-7 md:h-6 bg-[#f0e6d2] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full flex items-center justify-end pr-2 text-[13px] md:text-[11px] font-bold text-white min-w-[34px] md:min-w-[28px] tabular-nums"
                    style={{
                      width: `${Math.max(pct, 8)}%`,
                      backgroundColor: player.color,
                    }}
                  >
                    {pct}%
                  </div>
                </div>
              </div>
              <div className="ml-16 md:ml-12 text-[12px] md:text-[11px] text-[#8b5e3c] truncate">
                {getPlayerLabel(playerForecast, player.id === topPlayerId)} ·{" "}
                {getWinningRoundText(playerForecast)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-[#f0e6d2]">
        <div className="text-xs md:text-[11px] font-semibold text-[#8b5e3c] mb-2">
          Race Outlook
        </div>
        <div className="grid grid-cols-2 gap-2">
          <OutlookStat
            label="Likely ending"
            value={formatRoundRange(forecast.gameEndRound) ?? "Wide open"}
          />
          <OutlookStat
            label="Next-round danger"
            value={topNextThreat ? `${topNextThreat.pct}%` : "None"}
            detail={topNextThreat?.player.name}
            color={topNextThreat?.player.color}
          />
          <OutlookStat
            label="Blitz-out path"
            value={topBlitzThreat ? `${topBlitzThreat.pct}%` : "None"}
            detail={topBlitzThreat?.player.name}
            color={topBlitzThreat?.player.color}
          />
          <OutlookStat
            label="20+ pt swing"
            value={topSwingThreat ? `${topSwingThreat.pct}%` : "Quiet"}
            detail={topSwingThreat?.player.name}
            color={topSwingThreat?.player.color}
          />
        </div>
        {forecast.unresolvedProbability > 0 && (
          <div className="mt-2 text-[12px] md:text-[11px] text-[#8b5e3c]">
            {forecast.unresolvedProbability}% still open after the forecast window
          </div>
        )}
        {forecast.usesHistoricalData && (
          <div className="mt-2 text-[12px] md:text-[11px] text-[#8b5e3c]">
            History-backed from {forecast.historicalSampleCount} prior player scores
          </div>
        )}
      </div>

      <div className="text-xs md:text-[11px] text-[#8b5e3c] text-center mt-2 italic">
        Monte Carlo simulation · {getModelNote(forecast)}
      </div>
    </div>
  );
}

function formatRoundRange(range: ForecastRange | null): string | null {
  if (!range) return null;
  if (range.p25 === range.p75) return `R${range.median}`;
  return `R${range.p25}-R${range.p75}`;
}

function getWinningRoundText(playerForecast?: PlayerForecast): string {
  if (
    playerForecast &&
    playerForecast.winProbability === 0 &&
    playerForecast.winningRound
  ) {
    return "tail path under 1%";
  }
  const roundText = formatRoundRange(playerForecast?.winningRound ?? null);
  return roundText ? `wins around ${roundText}` : "needs a long path";
}

function getPlayerLabel(
  playerForecast: PlayerForecast | undefined,
  isTopPlayer: boolean
): string {
  if (!playerForecast || playerForecast.winProbability === 0) return "Long shot";
  if (playerForecast.nextRoundBlitzWinProbability >= 10) {
    return "Blitz-out threat";
  }
  if (playerForecast.nextRoundWinProbability >= 25) return "Can close now";
  if (playerForecast.nextRoundWinProbability >= 10) return "Next-round threat";
  if (playerForecast.nextRoundSwingProbability >= 35) return "Swing threat";
  if (isTopPlayer && playerForecast.winProbability >= 45) return "Steady favorite";
  if (playerForecast.winProbability >= 25) return "In the mix";
  if (playerForecast.winProbability >= 10) return "Needs a swing round";
  return "Chaos path";
}

function getSubtitle(roundsPlayed: number, forecast: RaceForecast): string {
  const confidence =
    forecast.confidence === "high"
      ? "high confidence"
      : forecast.confidence === "medium"
        ? "medium confidence"
        : "low confidence";
  const source = forecast.usesHistoricalData
    ? roundsPlayed > 0
      ? `${formatRoundCount(roundsPlayed)} tonight + history`
      : "player history"
    : `${formatRoundCount(roundsPlayed)} tonight`;
  return `Simulated from ${source} · ${confidence}`;
}

function getModelNote(forecast: RaceForecast): string {
  if (forecast.usesMechanicsModel) {
    return forecast.usesHistoricalData
      ? "models cards, blitz pile & player history"
      : "models cards, blitz pile & variance";
  }
  return forecast.usesHistoricalData
    ? "blends pace, variance & player history"
    : "accounts for pace & variance";
}

function formatRoundCount(roundsPlayed: number): string {
  return `${roundsPlayed} ${roundsPlayed === 1 ? "round" : "rounds"}`;
}

function getTopNextThreat(
  players: PlayerWithScore[],
  forecast: RaceForecast
): { player: PlayerWithScore; pct: number } | null {
  let top: { player: PlayerWithScore; pct: number } | null = null;
  for (const player of players) {
    const pct = forecast.players[player.id]?.nextRoundWinProbability ?? 0;
    if (pct > (top?.pct ?? 0)) {
      top = { player, pct };
    }
  }
  return top && top.pct > 0 ? top : null;
}

function getTopBlitzThreat(
  players: PlayerWithScore[],
  forecast: RaceForecast
): { player: PlayerWithScore; pct: number } | null {
  let top: { player: PlayerWithScore; pct: number } | null = null;
  for (const player of players) {
    const pct = forecast.players[player.id]?.nextRoundBlitzWinProbability ?? 0;
    if (pct > (top?.pct ?? 0)) {
      top = { player, pct };
    }
  }
  return top && top.pct > 0 ? top : null;
}

function getTopSwingThreat(
  players: PlayerWithScore[],
  forecast: RaceForecast
): { player: PlayerWithScore; pct: number } | null {
  let top: { player: PlayerWithScore; pct: number } | null = null;
  for (const player of players) {
    const pct = forecast.players[player.id]?.nextRoundSwingProbability ?? 0;
    if (pct > (top?.pct ?? 0)) {
      top = { player, pct };
    }
  }
  return top && top.pct > 0 ? top : null;
}

function OutlookStat({
  label,
  value,
  detail,
  color,
}: {
  label: string;
  value: string;
  detail?: string;
  color?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[12px] md:text-[11px] text-[#8b5e3c] truncate">
        {label}
      </div>
      <div
        className="text-lg md:text-base font-extrabold tabular-nums truncate"
        style={{ color: color ?? "#290806" }}
      >
        {value}
      </div>
      {detail && (
        <div className="text-[12px] md:text-[11px] text-[#8b5e3c] truncate">
          {detail}
        </div>
      )}
    </div>
  );
}
