"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveGameNote } from "@/server/mutations/games";
import { GAME_NOTE_MAX_LENGTH } from "@/lib/validation/submissions";

/** A short free-text note about the game, editable by its players. */
export default function GameNote({
  gameId,
  note,
  canEdit,
}: {
  gameId: string;
  note: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  // Shows a just-saved note until the refreshed page catches up; any newer
  // note from the server (another player's edit) wins.
  const [pending, setPending] = useState<{
    value: string | null;
    base: string | null;
  } | null>(null);
  const saved = pending && pending.base === note ? pending.value : note;
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!saved && !canEdit) return null;

  const save = async () => {
    if (draft === null || saving) return;
    setSaving(true);
    setError(null);
    try {
      const result = await saveGameNote(gameId, draft);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setPending({ value: result.note, base: note });
      setDraft(null);
      router.refresh();
    } catch {
      setError("The note could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      aria-labelledby="game-note-heading"
      className="mx-auto mt-6 max-w-2xl rounded-lg border bg-card p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="game-note-heading" className="text-lg font-semibold">
          <span aria-hidden="true" className="mr-1">
            📝
          </span>
          Game note
        </h2>
        {canEdit && draft === null ? (
          <button
            type="button"
            onClick={() => setDraft(saved ?? "")}
            className="min-h-11 rounded-md px-3 text-sm font-medium underline-offset-4 hover:underline"
          >
            {saved ? "Edit note" : "Add a note"}
          </button>
        ) : null}
      </div>
      {draft !== null ? (
        <form
          className="mt-2 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label htmlFor="game-note" className="sr-only">
            Game note
          </label>
          <textarea
            id="game-note"
            value={draft}
            maxLength={GAME_NOTE_MAX_LENGTH}
            rows={3}
            autoFocus
            disabled={saving}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Grandma blitzed three rounds in a row…"
            className="w-full rounded-md border bg-background p-2 text-sm"
          />
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span aria-live="polite">
              {draft.length}/{GAME_NOTE_MAX_LENGTH}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setDraft(null);
                  setError(null);
                }}
                className="min-h-11 rounded-md px-3 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-11 rounded-md bg-[#2a6517] px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save note"}
              </button>
            </div>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-red-800">
              {error}
            </p>
          ) : null}
        </form>
      ) : saved ? (
        <p className="mt-2 whitespace-pre-line text-sm">{saved}</p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Jot down anything worth remembering about this game.
        </p>
      )}
    </section>
  );
}
