"use client";

import { useEffect, useRef } from "react";
import { ScoreEntryCard } from "./ScoreEntryCard";
import { FloatingCTA } from "./FloatingCTA";
import { RoundHeader } from "./RoundHeader";
import { RaceTrack } from "./RaceTrack";
import { getEntryStatus, type PlayerEntry } from "./types";
import { type ScoringDraft } from "./useScoringDraft";

interface ScoreEntryViewProps {
  draft: ScoringDraft;
  winThreshold: number;
  isSaving: boolean;
  blocked: boolean;
  onUpdate: (
    playerId: string,
    field: keyof PlayerEntry,
    value: number | null,
  ) => void;
  onSubmit: () => void;
  onCancel?: () => void;
}

export function ScoreEntryView({
  draft,
  winThreshold,
  isSaving,
  blocked,
  onUpdate,
  onSubmit,
  onCancel,
}: ScoreEntryViewProps) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    form.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, []);
  const remainingCount = Object.values(draft.entries).filter(
    (entry) => getEntryStatus(entry) !== "complete",
  ).length;
  return (
    <form
      ref={form}
      className="pb-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <RoundHeader
        title={`Round ${draft.roundNumber}`}
        subtitle={`First to ${winThreshold} wins`}
      />
      <div className="px-4 pt-2 pb-2">
        <RaceTrack players={draft.players} winThreshold={winThreshold} />
      </div>
      <fieldset
        disabled={isSaving}
        className="px-4 pt-2 pb-2 space-y-2.5 max-w-[540px]"
      >
        <legend className="sr-only">Round {draft.roundNumber} scores</legend>
        {draft.players.map((player) => (
          <ScoreEntryCard
            key={player.id}
            name={player.name}
            color={player.color}
            score={player.score}
            entry={draft.entries[player.id]}
            status={getEntryStatus(draft.entries[player.id])}
            onUpdate={(field, value) => onUpdate(player.id, field, value)}
          />
        ))}
      </fieldset>
      {isSaving && (
        <p role="status" className="px-4 text-sm">
          Saving round…
        </p>
      )}
      {onCancel && (
        <button
          type="button"
          disabled={isSaving}
          onClick={onCancel}
          className="mx-4 my-2 underline"
        >
          Discard draft
        </button>
      )}
      <FloatingCTA
        state={{
          mode: "submit",
          remainingCount,
          allComplete: remainingCount === 0 && !isSaving && !blocked,
        }}
        onAction={onSubmit}
      />
    </form>
  );
}
