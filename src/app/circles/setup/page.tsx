import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function CircleSetupPage() {
  const { userId, orgId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // DO NOT redirect if orgId is set — user may need to complete
  // the friend migration step after creating/joining a circle.
  // Task 11 replaces this shell with the full setup UI.

  return (
    <main className="container mx-auto p-4 max-w-lg">
      <h1 className="text-2xl font-bold mb-4">Set Up Your Circle</h1>
      <p className="text-muted-foreground">
        Circles are groups of players you play Dutch Blitz with.
        You need at least one circle to use Blitzer.
      </p>
      {/* Full setup UI will be added in Task 11 */}
    </main>
  );
}
