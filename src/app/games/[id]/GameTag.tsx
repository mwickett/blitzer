"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveGameTag } from "@/server/mutations/games";
import { GAME_TAG_MAX_LENGTH } from "@/lib/validation/submissions";

/** An optional short label for the game, such as "stoned" or "cottage". */
export default function GameTag({
  gameId,
  tag,
  canEdit,
  suggestions,
}: {
  gameId: string;
  tag: string | null;
  canEdit: boolean;
  suggestions: string[];
}) {
  const router = useRouter();
  const listId = useId();
  // Shows a just-saved tag until the refreshed page catches up; a newer tag
  // from the server (another player's edit) wins.
  const [pending, setPending] = useState<{
    value: string | null;
    base: string | null;
  } | null>(null);
  const saved = pending && pending.base === tag ? pending.value : tag;
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!saved && !canEdit) return null;

  const save = async (value: string) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const result = await saveGameTag(gameId, value);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setPending({ value: result.tag, base: tag });
      setDraft(null);
      router.refresh();
    } catch {
      setError("The tag could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (draft !== null) {
    return (
      <form
        className="mx-auto mt-4 flex max-w-2xl flex-wrap items-center gap-2 px-4 text-sm"
        onSubmit={(event) => {
          event.preventDefault();
          void save(draft);
        }}
      >
        <label htmlFor={`${listId}-tag`} className="font-medium">
          Tag
        </label>
        <input
          id={`${listId}-tag`}
          value={draft}
          list={listId}
          maxLength={GAME_TAG_MAX_LENGTH}
          autoFocus
          disabled={saving}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="stoned, sober, cottage…"
          className="h-11 min-w-0 flex-1 rounded-md border bg-background px-2"
        />
        <datalist id={listId}>
          {suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
        <button
          type="submit"
          disabled={saving}
          className="min-h-11 rounded-md bg-[#2a6517] px-4 font-bold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save tag"}
        </button>
        {saved ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => void save("")}
            className="min-h-11 rounded-md px-3 font-medium"
          >
            Remove tag
          </button>
        ) : null}
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setDraft(null);
            setError(null);
          }}
          className="min-h-11 rounded-md px-3 font-medium"
        >
          Cancel
        </button>
        {error ? (
          <p role="alert" className="w-full text-red-800">
            {error}
          </p>
        ) : null}
      </form>
    );
  }

  return (
    <div className="mx-auto mt-4 flex max-w-2xl flex-wrap items-center gap-2 px-4 text-sm">
      {saved ? (
        <Link
          href={`/games?tag=${encodeURIComponent(saved)}`}
          aria-label={`Tag: ${saved}. See all games tagged ${saved}`}
          className="rounded-full border px-3 py-1 font-medium hover:bg-muted"
        >
          <span aria-hidden="true">🏷️ </span>
          {saved}
        </Link>
      ) : null}
      {canEdit ? (
        <button
          type="button"
          onClick={() => setDraft(saved ?? "")}
          className="min-h-11 rounded-md px-3 font-medium underline-offset-4 hover:underline"
        >
          {saved ? "Change tag" : "Add a tag"}
        </button>
      ) : null}
    </div>
  );
}
