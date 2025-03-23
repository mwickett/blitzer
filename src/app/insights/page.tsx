import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import ModernChatUI from "./ModernChatUI";
import { isLlmFeaturesEnabled } from "@/featureFlags";

export default async function InsightsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Check if LLM features are enabled
  const llmFeaturesEnabled = await isLlmFeaturesEnabled();

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Game Insights</h1>

      {llmFeaturesEnabled ? (
        <>
          <p className="text-muted-foreground mb-6">
            Chat with your game data to discover insights about your gameplay.
          </p>
          <ModernChatUI />
        </>
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
