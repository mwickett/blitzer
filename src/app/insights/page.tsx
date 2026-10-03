import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import ModernChatUI from "./ModernChatUI";
import { isLlmFeaturesEnabled } from "@/featureFlags";
import { Badge } from "@/components/ui/badge";
import PlayerHighlights from "@/components/insights/PlayerHighlights";
import { getPlayerHighlightsForClerkUser } from "@/server/queries/playerHighlights";

export default async function InsightsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Check if LLM features are enabled
  const llmFeaturesEnabled = await isLlmFeaturesEnabled();
  const highlights = llmFeaturesEnabled ? await getPlayerHighlightsForClerkUser(userId) : null;

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold">Game Insights</h1>
        <Badge
          variant="outline"
          className="bg-yellow-100 text-yellow-800 border-yellow-300"
        >
          Experimental
        </Badge>
      </div>

      {highlights ? (
        <div className="space-y-8">
          <PlayerHighlights highlights={highlights} />
          <section aria-labelledby="chat-heading" className="space-y-3">
            <h2 id="chat-heading" className="text-xl font-semibold">Ask about your games</h2>
            <p className="text-muted-foreground">
              Chat about your record, your rivals, and your most memorable games.
            </p>
            <ModernChatUI />
          </section>
        </div>
      ) : (
        <div className="p-6 border rounded-lg bg-muted/30 text-center">
          <h2 className="text-xl font-medium mb-2">Coming Soon</h2>
          <p className="text-muted-foreground">
            AI-powered insights about your games are coming soon! Check back
            later for personalized analysis of your gameplay.
          </p>
        </div>
      )}
    </div>
  );
}
