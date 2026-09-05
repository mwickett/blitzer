"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ScoreEntryView } from "./ScoreEntryView";
import { BetweenRoundsView } from "./BetweenRoundsView";
import { CelebrationOverlay } from "./CelebrationOverlay";
import { GameOverView } from "./GameOverView";
import { RoundEditor } from "./RoundEditor";
import { roundEditButtonId } from "./RoundHistoryTable";
import { findPlayerScore } from "./utils";
import { newRoundDraft, useScoringDraft } from "./useScoringDraft";
import { type PlayerWithScore, type RoundData } from "./types";
import { calcGameStats, type RoundResult } from "@/lib/scoring/gameStats";
import { type PredictionProfilesByPlayer } from "@/lib/scoring/probability";
import { calculateRoundScore } from "@/lib/validation/gameRules";
import { cloneGame } from "@/server/mutations/games";

interface ScoringShellProps {
  gameId: string;
  currentRoundNumber: number;
  players: PlayerWithScore[];
  winThreshold: number;
  isFinished: boolean;
  winnerId?: string;
  endedAt?: string;
  rounds: RoundData[];
  predictionProfiles?: PredictionProfilesByPlayer;
  canEdit?: boolean;
  canRematch?: boolean;
  sharedScoring?: boolean;
}

export function ScoringShell(props: ScoringShellProps) {
  return <ScoringSession key={props.gameId} {...props} />;
}

function ScoringSession({
  gameId,
  currentRoundNumber,
  players,
  winThreshold,
  isFinished,
  winnerId,
  endedAt,
  rounds,
  predictionProfiles,
  canEdit = true,
  canRematch = true,
  sharedScoring = false,
}: ScoringShellProps) {
  const router = useRouter();
  const [savedRound, setSavedRound] = useState<RoundData | null>(null);
  const initialDraft = () =>
    canEdit && !isFinished && rounds.length === 0
      ? newRoundDraft(players, currentRoundNumber)
      : null;
  const session = useScoringDraft(gameId, initialDraft, (round) => {
    setSavedRound(round);
    router.refresh();
  });
  const { draft, isSaving, hasConflict } = session;
  const returnFocusTo = useRef<string | null>(null);

  // The action returns real persisted scores. Wait for the page snapshot too,
  // so neither another edit nor the next round uses stale completion state.
  const awaitingRefresh =
    !!savedRound &&
    !rounds.some(
      (round) =>
        round.id === savedRound.id && round.revision >= savedRound.revision,
    );
  const effectiveRounds = useMemo(() => {
    if (!savedRound || !awaitingRefresh) return rounds;
    return rounds.some((round) => round.id === savedRound.id)
      ? rounds.map((round) => (round.id === savedRound.id ? savedRound : round))
      : [...rounds, savedRound];
  }, [rounds, savedRound, awaitingRefresh]);
  const effectivePlayers = useMemo(
    () =>
      !awaitingRefresh
        ? players
        : players.map((player) => ({
            ...player,
            score: effectiveRounds.reduce((total, round) => {
              const score = findPlayerScore(player, round.scores);
              return total + (score ? calculateRoundScore(score) : 0);
            }, 0),
          })),
    [players, effectiveRounds, awaitingRefresh],
  );

  const shouldPoll =
    sharedScoring &&
    canEdit &&
    !isFinished &&
    !draft &&
    !isSaving &&
    !awaitingRefresh;
  useEffect(() => {
    if (!shouldPoll) return;
    const refreshVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(refreshVisible, 5_000);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [router, shouldPoll]);

  useEffect(() => {
    if (!draft && !isSaving && !awaitingRefresh && returnFocusTo.current) {
      document.getElementById(returnFocusTo.current)?.focus();
      returnFocusTo.current = null;
    }
  }, [draft, isSaving, awaitingRefresh]);

  const [seenCompletions, setSeenCompletions] = useState(
    () =>
      new Set<string>(
        isFinished &&
          endedAt &&
          Date.now() - new Date(endedAt).getTime() >= 30_000
          ? [endedAt]
          : [],
      ),
  );
  const completionKey = isFinished ? endedAt : undefined;
  const winner = winnerId
    ? effectivePlayers.find((player) => player.id === winnerId)
    : undefined;
  const showCelebration =
    !!completionKey &&
    !seenCompletions.has(completionKey) &&
    !draft &&
    !awaitingRefresh;
  const gameStats = useMemo(() => {
    const results: RoundResult[] = effectiveRounds.map((round) => {
      const deltas: Record<string, number> = {};
      const blitzCounts: Record<string, number> = {};
      for (const score of round.scores) {
        const id = score.userId ?? score.guestId ?? "";
        deltas[id] = calculateRoundScore(score);
        blitzCounts[id] = score.blitzPileRemaining === 0 ? 1 : 0;
      }
      return { deltas, blitzCounts };
    });
    return calcGameStats(
      results,
      Object.fromEntries(players.map((player) => [player.id, player.name])),
    );
  }, [effectiveRounds, players]);

  const handleEdit = (index: number) => {
    if (!canEdit || isSaving || awaitingRefresh || !rounds[index]) return;
    returnFocusTo.current = roundEditButtonId(rounds[index].id);
    session.edit(players, rounds[index], index + 1);
  };
  const latestRound = draft?.round
    ? rounds.find((round) => round.id === draft.round!.id)
    : draft
      ? rounds[draft.roundNumber - 1]
      : undefined;
  const canReconcile =
    hasConflict &&
    latestRound &&
    (!draft?.round || latestRound.revision > draft.round.revision);
  const editEnabled = canEdit ? handleEdit : undefined;
  const showEntry = draft && !draft.round;

  if (!canEdit && !draft && !isFinished && rounds.length === 0) {
    return (
      <p className="px-4 py-16 text-center text-sm">
        This game hasn&rsquo;t started yet.
      </p>
    );
  }

  return (
    <>
      {showCelebration && winner && completionKey && (
        <CelebrationOverlay
          key={completionKey}
          winnerName={winner.name}
          winnerScore={winner.score}
          winnerColor={winner.color}
          onComplete={() =>
            setSeenCompletions((seen) => new Set([...seen, completionKey]))
          }
        />
      )}

      {awaitingRefresh && (
        <div role="status" className="mx-4 my-3 rounded-lg border p-3 text-sm">
          Scores saved. Waiting for the updated game…{" "}
          <button
            type="button"
            className="underline"
            onClick={() => router.refresh()}
          >
            Refresh scores
          </button>
        </div>
      )}
      {draft && isFinished && (
        <p role="status" className="mx-4 my-3 text-sm">
          This game is complete. Your unsaved scores are still here.
        </p>
      )}
      {session.error && (
        <p
          role="alert"
          className="mx-4 my-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {session.error}
        </p>
      )}

      {hasConflict && draft && (
        <section
          className="mx-4 my-3 space-y-3 rounded-lg border p-3"
          aria-label="Review score conflict"
        >
          <p className="text-sm">
            Your draft is still here. Refresh to compare it with the saved
            round.
          </p>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="underline"
          >
            Refresh current scores
          </button>
          {canReconcile && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="text-left font-semibold">
                    Round {draft.roundNumber}: cards played / blitz left
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Player</th>
                      <th scope="col">Your draft</th>
                      <th scope="col">Saved scores</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.players.map((player) => {
                      const saved = findPlayerScore(player, latestRound.scores);
                      const entry = draft.entries[player.id];
                      return (
                        <tr key={player.id}>
                          <th scope="row" className="break-words p-2 text-left">
                            {player.name}
                          </th>
                          <td className="p-2 text-center">
                            {entry.cardsPlayed ?? "—"} /{" "}
                            {entry.blitzRemaining ?? "—"}
                          </td>
                          <td className="p-2 text-center">
                            {saved?.totalCardsPlayed ?? "—"} /{" "}
                            {saved?.blitzPileRemaining ?? "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                className="mr-3 underline"
                onClick={() => session.reconcile(latestRound)}
              >
                Edit saved round using my draft
              </button>
              <button
                type="button"
                className="underline"
                onClick={session.cancel}
              >
                Use saved round
              </button>
            </>
          )}
        </section>
      )}

      {draft?.round && (
        <RoundEditor
          key={draft.round.id}
          draft={draft}
          isSaving={isSaving}
          blocked={hasConflict || !canEdit}
          onUpdate={session.update}
          onSave={session.submit}
          onCancel={session.cancel}
        />
      )}
      {showEntry && (
        <ScoreEntryView
          draft={draft}
          winThreshold={winThreshold}
          isSaving={isSaving}
          blocked={hasConflict || !canEdit}
          onUpdate={session.update}
          onSubmit={session.submit}
          onCancel={rounds.length || isFinished ? session.cancel : undefined}
        />
      )}

      {!showEntry &&
        (isFinished && winner ? (
          <fieldset disabled={isSaving || awaitingRefresh}>
            <GameOverView
              winner={winner}
              players={effectivePlayers}
              stats={gameStats}
              rounds={effectiveRounds}
              onEditRound={editEnabled}
              canEdit={canEdit && !draft}
              canRematch={canRematch}
              onRematch={async () => {
                const id = await cloneGame(gameId);
                router.push(`/games/${id}`);
              }}
              onBackToGames={() => router.push("/games")}
            />
          </fieldset>
        ) : (
          <BetweenRoundsView
            players={effectivePlayers}
            rounds={effectiveRounds}
            winThreshold={winThreshold}
            nextRoundNumber={
              awaitingRefresh ? effectiveRounds.length + 1 : currentRoundNumber
            }
            canEdit={canEdit}
            onEditRound={editEnabled}
            showNextRound={!draft}
            disabled={isSaving || awaitingRefresh}
            onEnterScores={() => {
              if (!awaitingRefresh && !isSaving)
                session.open(newRoundDraft(players, currentRoundNumber));
            }}
            predictionProfiles={predictionProfiles}
          />
        ))}
    </>
  );
}
