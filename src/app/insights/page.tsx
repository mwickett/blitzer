import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import ModernChatUI from "./ModernChatUI";

export default async function InsightsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Game Insights</h1>
      <p className="text-muted-foreground mb-6">
        Chat with your game data to discover insights about your gameplay.
      </p>
      <ModernChatUI />
    </div>
  );
}
