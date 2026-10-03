import { tellGameStory } from "@/server/ai/gameStory";
import type { GameDetail } from "@/server/queries/games";

/** Streams in under the finished scoreboard; a failed story never breaks the page. */
export default async function GameStory({ game, viewerId }: { game: GameDetail; viewerId: string }) {
  const result = await tellGameStory(game, viewerId, "game_story");
  if (!result) return null;

  return (
    <section aria-labelledby="game-story-heading" className="mx-auto mt-6 max-w-2xl rounded-lg border bg-card p-4">
      <h2 id="game-story-heading" className="text-lg font-semibold">
        <span aria-hidden="true" className="mr-1">📖</span>
        The story of this game
      </h2>
      <p className="mt-2 whitespace-pre-wrap leading-relaxed">{result.story}</p>
      <p className="mt-2 text-xs text-muted-foreground">Written by AI from this game&apos;s scores.</p>
    </section>
  );
}

export function GameStorySkeleton() {
  return (
    <div className="mx-auto mt-6 max-w-2xl rounded-lg border bg-card p-4 text-sm text-muted-foreground" aria-live="polite">
      Writing the story of this game…
    </div>
  );
}
