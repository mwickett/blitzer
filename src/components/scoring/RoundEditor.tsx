"use client";

import { useEffect, useRef } from "react";
import { ScoreEntryCard } from "./ScoreEntryCard";
import { getEntryStatus, type PlayerEntry } from "./types";
import { type ScoringDraft } from "./useScoringDraft";

interface RoundEditorProps {
  draft: ScoringDraft;
  isSaving: boolean;
  blocked: boolean;
  onUpdate: (
    playerId: string,
    field: keyof PlayerEntry,
    value: number | null,
  ) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function RoundEditor({
  draft,
  isSaving,
  blocked,
  onUpdate,
  onSave,
  onCancel,
}: RoundEditorProps) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    form.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, []);
  const complete = Object.values(draft.entries).every(
    (entry) => getEntryStatus(entry) === "complete",
  );
  return (
    <form
      ref={form}
      className="mx-4 my-3 rounded-xl border-2 border-[#fbbf24] bg-[#fffbeb] p-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <h2 className="mb-3 font-bold text-[#290806]">
        Edit Round {draft.roundNumber}
      </h2>
      <fieldset disabled={isSaving} className="space-y-2">
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
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={isSaving}
          onClick={onCancel}
          className="flex-1 rounded-lg bg-[#f0e6d2] px-3 py-3 font-bold text-[#8b5e3c]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving || blocked || !complete}
          className="flex-1 rounded-lg bg-[#2a6517] px-3 py-3 font-bold text-white disabled:opacity-50"
        >
          {isSaving ? "Saving changes…" : "Save Changes"}
        </button>
      </div>
      <p className="mt-2 text-sm text-[#8b5e3c]">
        Saving recalculates scores from round {draft.roundNumber} onward.
      </p>
    </form>
  );
}
