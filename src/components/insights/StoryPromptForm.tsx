"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { STORY_PROMPT_MAX_LENGTH } from "@/lib/validation/submissions";
import { saveStoryPrompt } from "@/server/mutations/insights";

type Status = { kind: "idle" } | { kind: "saved"; cleared: boolean } | { kind: "error"; message: string };

/** Lets a player choose the style of their own game story in completion emails. */
export function StoryPromptForm({ initialPrompt }: { initialPrompt: string | null }) {
  const [prompt, setPrompt] = useState(initialPrompt ?? "");
  const [saved, setSaved] = useState(initialPrompt ?? "");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  const save = (value: string) =>
    startTransition(async () => {
      try {
        const result = await saveStoryPrompt(value);
        if (!result.ok) return setStatus({ kind: "error", message: result.message });
        setPrompt(result.storyPrompt ?? "");
        setSaved(result.storyPrompt ?? "");
        setStatus({ kind: "saved", cleared: !result.storyPrompt });
      } catch {
        setStatus({ kind: "error", message: "Couldn't save your story style. Please try again." });
      }
    });

  return (
    <section aria-labelledby="story-style-heading" className="space-y-3">
      <h2 id="story-style-heading" className="text-xl font-semibold">Your game story style</h2>
      <p className="text-muted-foreground">
        When a game ends, your email tells its story. Describe how you&apos;d like yours told and
        you&apos;ll get your own version. Leave it blank for the standard story.
      </p>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          save(prompt);
        }}
      >
        <Label htmlFor="story-style">Story style</Label>
        <textarea
          id="story-style"
          value={prompt}
          maxLength={STORY_PROMPT_MAX_LENGTH}
          rows={3}
          placeholder="Like a nature documentary, and always mention who blitzed"
          onChange={(event) => {
            setPrompt(event.target.value);
            setStatus({ kind: "idle" });
          }}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending || prompt.trim() === saved}>
            {pending ? "Saving…" : "Save style"}
          </Button>
          {saved && (
            <Button type="button" variant="outline" disabled={pending} onClick={() => save("")}>
              Use the standard story
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            {prompt.length}/{STORY_PROMPT_MAX_LENGTH}
          </span>
          <span role="status" className="text-sm">
            {status.kind === "saved" && (status.cleared ? "Back to the standard story." : "Saved. Your next game email will use it.")}
          </span>
        </div>
        {status.kind === "error" && (
          <p role="alert" className="text-sm text-destructive">
            {status.message}
          </p>
        )}
      </form>
    </section>
  );
}
